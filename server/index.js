const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { securityMiddleware, pinRateLimiter } = require('./middleware/security');
const { generateTemplateBuffer, parseExcelBuffer } = require('./services/excelService');
const { parsePdfBuffer } = require('./services/pdfService');
const roomManager = require('./roomManager');
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Allow all origins (including Cloudflare tunnels & local network IPs)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

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
  const localIp = getLocalIpAddress();
  return `http://${localIp}:5173`;
}

// ---------------- REST API ROUTES ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverTime: Date.now(),
    publicUrl: getEffectivePublicUrl(),
    localIp: getLocalIpAddress()
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

// Upload & Parse Excel File
app.post('/api/quiz/upload/excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No Excel file uploaded.' });
    }
    const questions = parseExcelBuffer(req.file.buffer);
    res.json({
      success: true,
      count: questions.length,
      questions
    });
  } catch (err) {
    console.error('Error parsing Excel:', err);
    res.status(400).json({ error: err.message || 'Failed to parse Excel file.' });
  }
});

// Upload & Parse PDF File
app.post('/api/quiz/upload/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    const apiKey = req.body.geminiApiKey || req.headers['x-gemini-key'] || null;
    const questions = await parsePdfBuffer(req.file.buffer, apiKey);
    res.json({
      success: true,
      count: questions.length,
      questions
    });
  } catch (err) {
    console.error('Error parsing PDF:', err);
    res.status(400).json({ error: err.message || 'Failed to parse PDF document.' });
  }
});

// Create Room & Persist to PostgreSQL
app.post('/api/rooms', async (req, res) => {
  try {
    const { quizTitle, questions } = req.body;
    const roomData = roomManager.createRoom(quizTitle, questions);

    // Persist to PostgreSQL in background
    const quizId = uuidv4();
    db.persistQuiz(quizId, roomData.quizTitle, questions).catch(() => {});
    db.persistRoom(roomData.pin, roomData.hostToken, quizId, roomData.quizTitle).catch(() => {});

    res.json({
      success: true,
      ...roomData,
      publicUrl: getEffectivePublicUrl()
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
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

io.on('connection', (socket) => {
  // --- PLAYER ACTIONS ---

  // Player joins room
  socket.on('player:join', ({ pin, nickname }, callback) => {
    try {
      const result = roomManager.joinPlayer(pin, socket.id, nickname);
      socket.join(`room:${pin}`);

      // Persist player to PostgreSQL
      db.persistPlayer(pin, result.player).catch(() => {});

      // Acknowledge player
      if (callback) callback({ success: true, ...result });

      // Notify host and room of new player
      const room = roomManager.getRoom(pin);
      const playersList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score
      }));

      io.to(`host:${pin}`).emit('room:players_updated', {
        totalPlayers: room.players.size,
        players: playersList,
        newPlayer: result.player
      });
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
        // Persist answer to PostgreSQL
        const currentAns = {
          questionIndex: roomManager.getRoom(pin).currentQuestionIndex,
          selectedOption: parseInt(selectedOption, 10),
          responseTimeMs: Date.now() - roomManager.getRoom(pin).questionStartTime,
          pointsAwarded: result.pointsAwarded,
          isCorrect: result.isCorrect
        };
        db.persistAnswer(pin, socket.id, currentAns).catch(() => {});

        // Notify host of live response counter
        io.to(`host:${pin}`).emit('answer:count_update', {
          answeredCount: result.answeredCount,
          totalPlayers: result.totalPlayers,
          allAnswered: result.allAnswered
        });
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

  // Host starts the game or advances to next question
  socket.on('host:next_question', ({ pin, hostToken }, callback) => {
    try {
      const result = roomManager.startNextQuestion(pin, hostToken);

      if (result.isFinished) {
        db.finishRoom(pin).catch(() => {});
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
      const room = roomManager.getRoom(removal.pin);
      if (room) {
        const playersList = Array.from(room.players.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          score: p.score
        }));

        io.to(`host:${removal.pin}`).emit('room:players_updated', {
          totalPlayers: removal.totalPlayers,
          players: playersList,
          disconnectedPlayer: removal.player
        });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PulseQuiz server running on port ${PORT}`);
  console.log(`Public Cloudflare / LAN URL: ${getEffectivePublicUrl()}`);
});
