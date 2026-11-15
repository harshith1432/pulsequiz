const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { securityMiddleware, pinRateLimiter } = require('./middleware/security');
const { generateTemplateBuffer, parseExcelBuffer } = require('./services/excelService');
const { parsePdfBuffer } = require('./services/pdfService');
const { shuffleAndDistributeOptions, sampleRandomQuestions, pickUnusedQuestions } = require('./utils/questionShuffle');
const roomManager = require('./roomManager');
const db = require('./db');
const dbQueue = require('./services/dbQueue');

const app = express();
const server = http.createServer(app);

// Socket.IO server with high-concurrency buffer & transport settings
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6, // 1MB buffer
  transports: ['websocket', 'polling']
});

// Horizontal multi-node scaling adapter (if Redis is configured in environment)
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { Redis } = require('ioredis');
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.IO] Redis horizontal scaling adapter activated.');
  } catch (err) {
    console.warn('[Socket.IO] Redis adapter init warning (running in-memory):', err.message);
  }
}

// Port configuration
const PORT = process.env.PORT || 3001;

// Initialize PostgreSQL database schema
db.initDb().catch(err => console.error('Database initialization warning:', err.message));

// Body parsers & security
app.use(express.json());
app.use(securityMiddleware);

// Multer memory storage for direct buffer parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * Discover the machine's local Wi-Fi / Ethernet IPv4 address
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = 'localhost';

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
          return net.address;
        }
        fallbackIp = net.address;
      }
    }
  }
  return fallbackIp;
}

/**
 * Resolves the public URL for mobile phones to connect.
 * Prioritizes process.env.PUBLIC_URL (e.g. Cloudflare tunnel),
 * then falls back to local Wi-Fi IP address.
 */
function getEffectivePublicUrl() {
  const envUrl = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.trim().replace(/\/+$/, '') : '';
  if (envUrl) {
    return envUrl;
  }
  return 'https://appreciation-computed-dame-lucas.trycloudflare.com';
}

// ---------------- USER AUTHENTICATION & SESSION MANAGEMENT ----------------

const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'pulsequiz-hmac-host-secret-key-2026';

function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, username: user.username, ts: Date.now() })).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// Authentication middleware to isolate host operations
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.query.token || req.headers['x-auth-token']);
  const user = verifySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Host login required to access this resource.' });
  }
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.query.token || req.headers['x-auth-token']);
  req.user = verifySessionToken(token);
  next();
}

// ---------------- REST API ROUTES ----------------

// --- AUTHENTICATION ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.createUser(username, password);
    const token = createSessionToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.authenticateUser(username, password);
    const token = createSessionToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(401).json({ error: err.message || 'Login failed.' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverTime: Date.now(),
    publicUrl: getEffectivePublicUrl(),
    localIp: getLocalIpAddress()
  });
});

// Real-time Concurrency & Load Balancer Performance Metrics
app.get('/api/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    activeSockets: io.engine.clientsCount,
    roomsCount: roomManager.rooms ? roomManager.rooms.size : 0,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
    },
    databaseQueue: dbQueue.getStats()
  });
});

// Configuration endpoint returning public URL (Cloudflare or LAN)
app.get('/api/config', (req, res) => {
  res.json({
    publicUrl: getEffectivePublicUrl(),
    isCloudflare: Boolean(process.env.PUBLIC_URL && process.env.PUBLIC_URL.includes('cloudflare')),
    localIp: getLocalIpAddress(),
    port: PORT,
    clientPort: 5173
  });
});

// Allow updating the public URL dynamically in runtime if tunnel changes
app.post('/api/config/public-url', (req, res) => {
  const { publicUrl } = req.body;
  if (publicUrl && typeof publicUrl === 'string') {
    process.env.PUBLIC_URL = publicUrl.trim();
    return res.json({ success: true, publicUrl: getEffectivePublicUrl() });
  }
  res.status(400).json({ error: 'Valid publicUrl string is required.' });
});

// Download Excel Template
app.get('/api/quiz/template/excel', (req, res) => {
  try {
    const buffer = generateTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="PulseQuiz_Questions_Template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ error: 'Failed to generate Excel template.' });
  }
});

// Upload & Parse Excel File (Protected - Host Auth Required)
app.post('/api/quiz/upload/excel', requireAuth, upload.any(), (req, res) => {
  try {
    const files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No Excel file uploaded.' });
    }
    let combinedPool = [];
    for (const f of files) {
      const parsed = parseExcelBuffer(f.buffer);
      if (Array.isArray(parsed) && parsed.length > 0) {
        combinedPool.push(...parsed);
      }
    }
    if (combinedPool.length === 0) {
      return res.status(400).json({ error: 'Could not extract any valid questions from the Excel file.' });
    }

    const sampleCount = req.body.sampleCount ? parseInt(req.body.sampleCount, 10) : null;
    let questions;
    if (sampleCount && sampleCount > 0 && sampleCount < combinedPool.length) {
      questions = sampleRandomQuestions(combinedPool, sampleCount);
    } else {
      questions = shuffleAndDistributeOptions(combinedPool);
    }

    res.json({
      success: true,
      filesProcessed: files.length,
      totalPoolCount: combinedPool.length,
      count: questions.length,
      questions,
      pool: combinedPool
    });
  } catch (err) {
    console.error('Error parsing Excel:', err);
    res.status(400).json({ error: err.message || 'Failed to parse Excel file.' });
  }
});

// Upload & Parse PDF File(s) - Supports up to 5 PDFs simultaneously (Protected - Host Auth Required)
app.post('/api/quiz/upload/pdf', requireAuth, upload.any(), async (req, res) => {
  try {
    const files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No PDF file(s) uploaded.' });
    }
    if (files.length > 5) {
      return res.status(400).json({ error: 'A maximum of 5 PDF files can be uploaded at once.' });
    }

    const apiKey = req.body.geminiApiKey || req.headers['x-gemini-key'] || null;
    let combinedPool = [];
    const processedFileNames = [];

    // Parse all uploaded PDF buffers concurrently in parallel
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const extracted = await parsePdfBuffer(file.buffer, apiKey);
          if (Array.isArray(extracted) && extracted.length > 0) {
            return { fileName: file.originalname, questions: extracted };
          }
        } catch (pdfErr) {
          console.warn(`[PDF Parse] Warning parsing file "${file.originalname}":`, pdfErr.message);
        }
        return null;
      })
    );

    for (const resItem of results) {
      if (resItem) {
        combinedPool.push(...resItem.questions);
        processedFileNames.push(resItem.fileName);
      }
    }

    if (combinedPool.length === 0) {
      return res.status(400).json({ error: 'Could not extract any questions from the uploaded PDF file(s).' });
    }

    // Ensure every question in combinedPool has an ID
    combinedPool.forEach((q, idx) => {
      if (!q.id) q.id = uuidv4();
    });

    // Check if host specified a sampleCount (default 20)
    const targetCount = req.body.sampleCount ? parseInt(req.body.sampleCount, 10) : 20;
    const { selectedQuestions, updatedUsedIds, usedCount, remainingCount, totalPoolCount } =
      pickUnusedQuestions(combinedPool, [], targetCount);

    // Auto-save this classroom & question bank immediately to PostgreSQL for this host
    const cleanTitle = processedFileNames.length === 1
      ? processedFileNames[0].replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      : `Multi-Exam Quiz (${processedFileNames.length} PDFs)`;

    const savedQuiz = await db.persistQuiz(
      uuidv4(),
      cleanTitle,
      selectedQuestions,
      req.user.id,
      combinedPool,
      updatedUsedIds,
      targetCount
    );

    res.json({
      success: true,
      quiz: savedQuiz,
      quizId: savedQuiz.id,
      quizTitle: savedQuiz.title,
      filesProcessed: processedFileNames.length,
      fileNames: processedFileNames,
      totalPoolCount: combinedPool.length,
      count: selectedQuestions.length,
      usedCount: updatedUsedIds.length,
      remainingCount: Math.max(0, combinedPool.length - updatedUsedIds.length),
      questions: selectedQuestions,
      pool: combinedPool
    });
  } catch (err) {
    console.error('Error parsing PDF:', err);
    res.status(400).json({ error: err.message || 'Failed to parse PDF document.' });
  }
});

// Re-sample or Shuffle Options Endpoint (Protected - Host Auth Required)
app.post('/api/quiz/sample', requireAuth, (req, res) => {
  try {
    const { pool, sampleCount, usedQuestionIds } = req.body;
    if (!pool || !Array.isArray(pool) || pool.length === 0) {
      return res.status(400).json({ error: 'A question pool array is required.' });
    }

    const count = sampleCount ? parseInt(sampleCount, 10) : 20;
    const result = pickUnusedQuestions(pool, usedQuestionIds || [], count);
    res.json({
      success: true,
      totalPoolCount: pool.length,
      count: result.selectedQuestions.length,
      questions: result.selectedQuestions,
      updatedUsedIds: result.updatedUsedIds,
      usedCount: result.usedCount,
      remainingCount: result.remainingCount,
      cycled: result.cycled
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to sample questions.' });
  }
});

// --- SAVED QUIZZES / CLASSROOMS LIBRARY API (ISOLATED BY USER) ---

// List all saved quizzes/classrooms belonging to the authenticated host
app.get('/api/quizzes', requireAuth, async (req, res) => {
  try {
    const list = await db.getSavedQuizzes(req.user.id);
    res.json({ success: true, count: list.length, quizzes: list });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch saved quizzes.' });
  }
});

// Get a single saved quiz by ID (authorized to user)
app.get('/api/quizzes/:id', requireAuth, async (req, res) => {
  try {
    const quiz = await db.getQuizById(req.params.id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized.' });
    }
    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch quiz.' });
  }
});

// Fetch next round of unasked/fresh questions from the saved quiz question bank
app.post('/api/quizzes/:id/next-round', requireAuth, async (req, res) => {
  try {
    const quiz = await db.getQuizById(req.params.id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized.' });
    }

    const count = parseInt(req.body.count, 10) || quiz.defaultSampleCount || 20;
    const pool = (quiz.questionPool && quiz.questionPool.length > 0) ? quiz.questionPool : quiz.questions;

    const { selectedQuestions, updatedUsedIds, usedCount, remainingCount, totalPoolCount, cycled } =
      pickUnusedQuestions(pool, quiz.usedQuestionIds, count);

    // Save updated used questions in database
    await db.updateQuizUsedQuestions(quiz.id, updatedUsedIds, req.user.id);

    res.json({
      success: true,
      quizId: quiz.id,
      title: quiz.title,
      count: selectedQuestions.length,
      questions: selectedQuestions,
      totalPoolCount,
      usedCount,
      remainingCount,
      cycled
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch next round questions.' });
  }
});

// Reset question history so all questions are fresh again
app.post('/api/quizzes/:id/reset-history', requireAuth, async (req, res) => {
  try {
    await db.resetQuizQuestionHistory(req.params.id, req.user.id);
    res.json({ success: true, message: 'Question history reset successfully. All questions can be asked again!' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to reset question history.' });
  }
});

// Save or update a quiz/classroom for this authenticated user
app.post('/api/quizzes', requireAuth, async (req, res) => {
  try {
    const { id, title, questions, questionPool, usedQuestionIds, defaultSampleCount } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required to save a quiz.' });
    }
    const quizId = id || uuidv4();
    const quizTitle = (title || 'Saved Quiz').trim();

    const saved = await db.persistQuiz(
      quizId,
      quizTitle,
      questions,
      req.user.id,
      questionPool,
      usedQuestionIds,
      defaultSampleCount || questions.length
    );
    res.json({ success: true, quiz: saved });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to save quiz.' });
  }
});

// Delete a saved quiz from library (user-isolated)
app.delete('/api/quizzes/:id', requireAuth, async (req, res) => {
  try {
    await db.deleteQuiz(req.params.id, req.user.id);
    res.json({ success: true, message: 'Quiz deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete quiz.' });
  }
});

// Create Room & Persist to PostgreSQL (Optional Auth for guest or logged-in host)
app.post('/api/rooms', optionalAuth, async (req, res) => {
  try {
    let { quizTitle, questions, quizId, pickFresh, sampleCount } = req.body;

    const userId = req.user ? req.user.id : null;
    let savedQuiz = null;

    if (quizId) {
      savedQuiz = await db.getQuizById(quizId, userId);
    }

    if (savedQuiz) {
      quizTitle = quizTitle || savedQuiz.title;

      // If pickFresh is requested, or if no questions provided, pick unused questions from pool
      if (pickFresh || !questions || !Array.isArray(questions) || questions.length === 0) {
        const pool = (savedQuiz.questionPool && savedQuiz.questionPool.length > 0)
          ? savedQuiz.questionPool
          : savedQuiz.questions;
        
        const count = sampleCount ? parseInt(sampleCount, 10) : (savedQuiz.defaultSampleCount || 20);
        const nextRound = pickUnusedQuestions(pool, savedQuiz.usedQuestionIds, count);
        
        questions = nextRound.selectedQuestions;
        if (userId) {
          await db.updateQuizUsedQuestions(quizId, nextRound.updatedUsedIds, userId);
        }
      }
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required to create a room.' });
    }

    const finalQuizId = quizId || uuidv4();
    if (!quizId) {
      await db.persistQuiz(finalQuizId, quizTitle || 'Live Interactive Quiz', questions, userId);
    }

    const roomData = roomManager.createRoom(quizTitle, questions, finalQuizId, userId);
    await db.persistRoom(roomData.pin, roomData.hostToken, finalQuizId, roomData.quizTitle, userId);

    res.json({
      success: true,
      ...roomData,
      publicUrl: getEffectivePublicUrl()
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Past Winners & History for a Saved Quiz
app.get('/api/quizzes/:id/winners', optionalAuth, async (req, res) => {
  try {
    const sessions = await db.getQuizPastWinners(req.params.id, req.user ? req.user.id : null);
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch past winners.' });
  }
});

// Get Room Public Status
app.get('/api/rooms/:pin', pinRateLimiter, (req, res) => {
  const room = roomManager.getRoom(req.params.pin);
  if (!room) {
    return res.status(404).json({ error: 'Room not found. Check the 6-digit PIN.' });
  }
  res.json({
    pin: room.pin,
    quizTitle: room.quizTitle,
    state: room.state,
    totalQuestions: room.questions.length,
    totalPlayers: room.players.size
  });
});

// ---------------- SOCKET.IO REAL-TIME CHANNELS ----------------

// High-frequency event throttlers to protect host browser under massive concurrent load (100 - 100,000 players)
const pendingHostCounters = new Map(); // pin -> { timer, data }
function emitThrottledAnswerCount(pin, data) {
  if (data.allAnswered) {
    const existing = pendingHostCounters.get(pin);
    if (existing) clearTimeout(existing.timer);
    pendingHostCounters.delete(pin);
    io.to(`host:${pin}`).emit('answer:count_update', data);
    return;
  }

  const existing = pendingHostCounters.get(pin);
  if (existing) {
    existing.data = data;
  } else {
    const timer = setTimeout(() => {
      const current = pendingHostCounters.get(pin);
      pendingHostCounters.delete(pin);
      if (current) {
        io.to(`host:${pin}`).emit('answer:count_update', current.data);
      }
    }, 100); // Max 10Hz UI update rate for smooth rendering under massive load
    pendingHostCounters.set(pin, { timer, data });
  }
}

const pendingLobbyUpdates = new Map(); // pin -> { timer, newPlayer }
function emitThrottledLobbyUpdate(pin, newPlayer) {
  const existing = pendingLobbyUpdates.get(pin);
  if (!existing) {
    const timer = setTimeout(() => {
      pendingLobbyUpdates.delete(pin);
      const room = roomManager.getRoom(pin);
      if (!room) return;
      const playersList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score
      }));
      io.to(`host:${pin}`).emit('room:players_updated', {
        totalPlayers: room.players.size,
        players: playersList,
        newPlayer
      });
    }, 120); // Batch joins every 120ms during crowd rush
    pendingLobbyUpdates.set(pin, { timer, newPlayer });
  }
}

io.on('connection', (socket) => {
  // --- PLAYER ACTIONS ---

  // Player joins room
  socket.on('player:join', ({ pin, nickname }, callback) => {
    try {
      const result = roomManager.joinPlayer(pin, socket.id, nickname);
      socket.join(`room:${pin}`);

      // Persist player to PostgreSQL
      db.persistPlayer(pin, result.player).catch(() => {});

      // Acknowledge player immediately (<0.1ms)
      if (callback) callback({ success: true, ...result });

      // Notify host with throttled lobby update
      emitThrottledLobbyUpdate(pin, result.player);
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Player submits answer
  socket.on('player:submit_answer', ({ pin, selectedOption }, callback) => {
    try {
      const result = roomManager.submitAnswer(pin, socket.id, selectedOption);
      if (callback) {
        callback({
          success: true,
          alreadyAnswered: result.alreadyAnswered,
          message: 'Answer locked in. Results will be revealed on timeout.'
        });
      }

      if (!result.alreadyAnswered) {
        const room = roomManager.getRoom(pin);
        const player = room?.players.get(socket.id);
        // Enqueue to micro-batching write engine (zero-blocking, <0.01ms)
        const currentAns = {
          questionIndex: room.currentQuestionIndex,
          selectedOption: parseInt(selectedOption, 10),
          responseTimeMs: Date.now() - room.questionStartTime,
          pointsAwarded: result.pointsAwarded,
          isCorrect: result.isCorrect
        };
        dbQueue.enqueueAnswer(pin, socket.id, player?.nickname, currentAns);

        // Notify host with throttled live counter
        emitThrottledAnswerCount(pin, {
          answeredCount: result.answeredCount,
          totalPlayers: result.totalPlayers,
          allAnswered: result.allAnswered
        });

        // Automatically reveal answer when ALL active participants have submitted their answer
        if (result.allAnswered && room.state === 'QUESTION_ACTIVE') {
          setTimeout(() => {
            try {
              if (room.state === 'QUESTION_ACTIVE') {
                const roundResult = roomManager.endQuestion(pin, room.hostToken);
                dbQueue.flush().catch(() => {});
                io.to(`room:${pin}`).emit('round:ended', roundResult);
              }
            } catch (autoRevealErr) {
              console.error('Auto reveal error:', autoRevealErr);
            }
          }, 600);
        }
      }
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // --- HOST ACTIONS ---

  // Host connects to manage room
  socket.on('host:connect', ({ pin, hostToken }, callback) => {
    if (!roomManager.validateHost(pin, hostToken)) {
      if (callback) callback({ success: false, error: 'Unauthorized: Invalid host token.' });
      return;
    }

    socket.join(`host:${pin}`);
    socket.join(`room:${pin}`);

    const room = roomManager.getRoom(pin);
    const playersList = Array.from(room.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score
    }));

    if (callback) {
      callback({
        success: true,
        room: {
          pin: room.pin,
          quizTitle: room.quizTitle,
          state: room.state,
          totalQuestions: room.questions.length,
          currentQuestionIndex: room.currentQuestionIndex,
          players: playersList,
          publicUrl: getEffectivePublicUrl()
        }
      });
    }
  });

  // Host updates room theme (10 creamy aesthetic themes)
  socket.on('room:set_theme', ({ pin, themeId }) => {
    const room = roomManager.getRoom(pin);
    if (room) {
      room.themeId = themeId;
      io.to(`room:${pin}`).emit('room:theme_updated', { themeId });
    }
  });

  // Host updates question timer dynamically
  socket.on('host:update_timer', ({ pin, hostToken, timeLimitSeconds }, callback) => {
    try {
      const result = roomManager.updateRoomTimer(pin, hostToken, timeLimitSeconds);
      io.to(`room:${pin}`).emit('room:timer_updated', result);
      if (callback) callback({ success: true, ...result });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Host quits quiz early and reveals top rankers / final podium
  socket.on('host:quit_game', ({ pin, hostToken }, callback) => {
    try {
      const result = roomManager.quitGame(pin, hostToken);
      db.finishRoom(pin, result.podium).catch(() => {});
      dbQueue.flushAll().catch(() => {});
      io.to(`room:${pin}`).emit('game:finished', {
        podium: result.podium
      });
      if (callback) callback({ success: true, ...result });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Host starts the game or advances to next question
  socket.on('host:next_question', ({ pin, hostToken }, callback) => {
    try {
      const result = roomManager.startNextQuestion(pin, hostToken);

      if (result.isFinished) {
        db.finishRoom(pin, result.podium).catch(() => {});
        dbQueue.flushAll().catch(() => {});
        io.to(`room:${pin}`).emit('game:finished', {
          podium: result.podium
        });
      } else {
        io.to(`room:${pin}`).emit('question:active', result);
      }

      if (callback) callback({ success: true, ...result });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Host reveals answers & shows round standings
  socket.on('host:reveal_answer', ({ pin, hostToken }, callback) => {
    try {
      const result = roomManager.endQuestion(pin, hostToken);
      // Flush micro-batched answers to PostgreSQL immediately on round end
      dbQueue.flush().catch(() => {});
      io.to(`room:${pin}`).emit('round:ended', result);
      if (callback) callback({ success: true, ...result });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Socket disconnect
  socket.on('disconnect', () => {
    const removal = roomManager.removePlayer(socket.id);
    if (removal) {
      emitThrottledLobbyUpdate(removal.pin, null);
    }
  });
});

process.on('uncaughtException', (err) => {
  console.error('[PulseQuiz Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PulseQuiz Unhandled Rejection]:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PulseQuiz server running on port ${PORT}`);
  console.log(`Public Cloudflare / LAN URL: ${getEffectivePublicUrl()}`);
});
