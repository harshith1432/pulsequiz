const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/quzi'
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// In-memory fallback caches
const inMemoryUsers = new Map(); // username -> { id, username, passwordHash }
const inMemoryQuizzes = new Map(); // id -> { id, userId, title, questions, createdAt }
const inMemoryQuizSessions = new Map(); // quizId -> array of past sessions

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        user_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option_index INT NOT NULL,
        time_limit_seconds INT DEFAULT 20,
        points_possible INT DEFAULT 10,
        explanation TEXT,
        order_num INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rooms (
        pin VARCHAR(10) PRIMARY KEY,
        host_token VARCHAR(64) NOT NULL,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
        user_id UUID,
        title VARCHAR(255) NOT NULL,
        state VARCHAR(30) DEFAULT 'LOBBY',
        current_question_index INT DEFAULT -1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        finished_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS room_players (
        id VARCHAR(64) PRIMARY KEY,
        room_pin VARCHAR(10) REFERENCES rooms(pin) ON DELETE CASCADE,
        nickname VARCHAR(100) NOT NULL,
        total_score INT DEFAULT 0,
        streak INT DEFAULT 0,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS player_answers (
        id SERIAL PRIMARY KEY,
        room_pin VARCHAR(10) REFERENCES rooms(pin) ON DELETE CASCADE,
        player_id VARCHAR(64) REFERENCES room_players(id) ON DELETE CASCADE,
        question_index INT NOT NULL,
        selected_option INT NOT NULL,
        response_time_ms INT NOT NULL,
        points_awarded INT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id UUID PRIMARY KEY,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        room_pin VARCHAR(10),
        title VARCHAR(255) NOT NULL,
        user_id UUID,
        winners JSONB NOT NULL,
        total_players INT DEFAULT 0,
        played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);
    `);

    // Ensure user_id, question_pool, used_question_ids, default_sample_count columns exist on quizzes
    try {
      await client.query('ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS user_id UUID');
      await client.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS user_id UUID');
      await client.query('ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_pool JSONB DEFAULT \'[]\'::jsonb');
      await client.query('ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS used_question_ids JSONB DEFAULT \'[]\'::jsonb');
      await client.query('ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS default_sample_count INT DEFAULT 20');
    } catch {
      // Ignore if columns already present
    }

    console.log('PostgreSQL schema initialized successfully with user isolation.');
  } catch (err) {
    console.error('Error initializing PostgreSQL schema:', err.message);
  } finally {
    client.release();
  }
}

// ---------------- USER AUTHENTICATION ----------------

async function createUser(username, password) {
  const cleanUsername = (username || '').trim().toLowerCase();
  if (cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hash}`;
  const userId = uuidv4();

  try {
    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [userId, cleanUsername, passwordHash]
    );
  } catch (err) {
    if (err.code === '23505') {
      throw new Error('Username is already registered. Please choose another or sign in.');
    }
    console.error('PostgreSQL user creation fallback:', err.message);
  }

  inMemoryUsers.set(cleanUsername, { id: userId, username: cleanUsername, passwordHash });
  return { id: userId, username: cleanUsername };
}

async function authenticateUser(username, password) {
  const cleanUsername = (username || '').trim().toLowerCase();
  if (!cleanUsername || !password) {
    throw new Error('Username and password are required.');
  }

  let user = null;
  try {
    const res = await pool.query(
      'SELECT id, username, password_hash as "passwordHash" FROM users WHERE username = $1',
      [cleanUsername]
    );
    if (res.rows.length > 0) {
      user = res.rows[0];
    }
  } catch (err) {
    console.error('Database query in authenticateUser:', err.message);
  }

  if (!user) {
    user = inMemoryUsers.get(cleanUsername);
  }

  if (!user) {
    throw new Error('Invalid username or password.');
  }

  const [salt, storedHash] = user.passwordHash.split(':');
  const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  if (computedHash !== storedHash) {
    throw new Error('Invalid username or password.');
  }

  return { id: user.id, username: user.username };
}

async function getUserById(userId) {
  try {
    const res = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (res.rows.length > 0) {
      return res.rows[0];
    }
  } catch (err) {
    console.error('Database query in getUserById:', err.message);
  }

  for (const u of inMemoryUsers.values()) {
    if (u.id === userId) return { id: u.id, username: u.username };
  }
  return null;
}

// ---------------- QUIZ PERSISTENCE & USER ISOLATION ----------------

function isValidUuid(val) {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

function ensureUuid(val) {
  return isValidUuid(val) ? val : uuidv4();
}

/**
 * Persist or update a quiz and its questions for a specific user,
 * along with its full question pool (e.g. 500 questions) and used question history.
 */
async function persistQuiz(quizId, title, questions, userId = null, questionPool = null, usedQuestionIds = null, defaultSampleCount = 20) {
  const qId = ensureUuid(quizId);
  const qTitle = title || 'Saved Quiz';

  // Normalize questions and ensure valid UUIDs for PostgreSQL
  const normalizedQuestions = (questions || []).map((q, idx) => ({
    id: ensureUuid(q.id),
    questionText: q.questionText,
    options: q.options,
    correctOptionIndex: q.correctOptionIndex,
    timeLimitSeconds: q.timeLimitSeconds || 20,
    pointsPossible: q.pointsPossible || 10,
    explanation: q.explanation || '',
    orderNum: idx
  }));

  // Normalize pool (if provided, otherwise defaults to questions)
  const rawPool = Array.isArray(questionPool) && questionPool.length > 0 ? questionPool : normalizedQuestions;
  const normalizedPool = rawPool.map((q, idx) => ({
    id: ensureUuid(q.id),
    questionText: q.questionText,
    options: q.options,
    correctOptionIndex: q.correctOptionIndex,
    timeLimitSeconds: q.timeLimitSeconds || 20,
    pointsPossible: q.pointsPossible || 10,
    explanation: q.explanation || '',
    orderNum: idx
  }));

  const initialUsed = Array.isArray(usedQuestionIds)
    ? usedQuestionIds
    : normalizedQuestions.map(q => String(q.id || q.questionText));

  inMemoryQuizzes.set(qId, {
    id: qId,
    userId,
    title: qTitle,
    createdAt: new Date().toISOString(),
    questionCount: normalizedQuestions.length,
    questions: normalizedQuestions,
    questionPool: normalizedPool,
    usedQuestionIds: initialUsed,
    defaultSampleCount: defaultSampleCount || 20
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO quizzes (id, title, user_id, question_pool, used_question_ids, default_sample_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         user_id = COALESCE(EXCLUDED.user_id, quizzes.user_id),
         question_pool = COALESCE(EXCLUDED.question_pool, quizzes.question_pool),
         used_question_ids = COALESCE(EXCLUDED.used_question_ids, quizzes.used_question_ids),
         default_sample_count = COALESCE(EXCLUDED.default_sample_count, quizzes.default_sample_count)`,
      [qId, qTitle, userId, JSON.stringify(normalizedPool), JSON.stringify(initialUsed), defaultSampleCount || 20]
    );

    // Delete previous questions for clean replacement
    await client.query('DELETE FROM questions WHERE quiz_id = $1', [qId]);

    for (let i = 0; i < normalizedQuestions.length; i++) {
      const q = normalizedQuestions[i];
      await client.query(
        `INSERT INTO questions (id, quiz_id, question_text, options, correct_option_index, time_limit_seconds, points_possible, explanation, order_num)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          q.id,
          qId,
          q.questionText,
          JSON.stringify(q.options),
          q.correctOptionIndex,
          q.timeLimitSeconds,
          q.pointsPossible,
          q.explanation,
          i
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error persisting quiz to PostgreSQL:', err.message);
  } finally {
    client.release();
  }

  return {
    id: qId,
    userId,
    title: qTitle,
    questionCount: normalizedQuestions.length,
    questions: normalizedQuestions,
    questionPool: normalizedPool,
    usedQuestionIds: initialUsed,
    totalPoolCount: normalizedPool.length,
    usedCount: initialUsed.length,
    remainingCount: Math.max(0, normalizedPool.length - initialUsed.length),
    defaultSampleCount: defaultSampleCount || 20
  };
}

/**
 * Update the list of used question IDs for a quiz session
 */
async function updateQuizUsedQuestions(quizId, usedQuestionIds, userId = null) {
  const cleanUsed = Array.isArray(usedQuestionIds) ? usedQuestionIds : [];
  try {
    let query = 'UPDATE quizzes SET used_question_ids = $1 WHERE id = $2';
    const params = [JSON.stringify(cleanUsed), quizId];
    if (userId) {
      query += ' AND user_id = $3';
      params.push(userId);
    }
    await pool.query(query, params);
  } catch (err) {
    console.error('Error updating quiz used questions in PostgreSQL:', err.message);
  }
  const cached = inMemoryQuizzes.get(quizId);
  if (cached) {
    cached.usedQuestionIds = cleanUsed;
  }
  return true;
}

/**
 * Reset used question history so host can play again from full pool
 */
async function resetQuizQuestionHistory(quizId, userId = null) {
  return updateQuizUsedQuestions(quizId, [], userId);
}

/**
 * Retrieve saved quizzes isolated by userId
 */
async function getSavedQuizzes(userId = null) {
  try {
    let query = `
      SELECT 
        q.id,
        q.title,
        q.user_id as "userId",
        q.created_at as "createdAt",
        q.question_pool as "questionPool",
        q.used_question_ids as "usedQuestionIds",
        q.default_sample_count as "defaultSampleCount",
        COUNT(ques.id)::int as "questionCount"
      FROM quizzes q
      LEFT JOIN questions ques ON ques.quiz_id = q.id
    `;
    const params = [];
    if (userId) {
      query += ' WHERE q.user_id = $1';
      params.push(userId);
    }
    query += ' GROUP BY q.id, q.title, q.user_id, q.created_at, q.question_pool, q.used_question_ids, q.default_sample_count ORDER BY q.created_at DESC';

    const res = await pool.query(query, params);

    const quizzes = [];
    for (const row of res.rows) {
      const qRes = await pool.query(
        `SELECT id, question_text as "questionText", options, correct_option_index as "correctOptionIndex",
                time_limit_seconds as "timeLimitSeconds", points_possible as "pointsPossible", explanation
         FROM questions
         WHERE quiz_id = $1
         ORDER BY order_num ASC`,
        [row.id]
      );

      const questions = qRes.rows.map(item => ({
        id: item.id,
        questionText: item.questionText,
        options: typeof item.options === 'string' ? JSON.parse(item.options) : item.options,
        correctOptionIndex: item.correctOptionIndex,
        timeLimitSeconds: item.timeLimitSeconds,
        pointsPossible: item.pointsPossible,
        explanation: item.explanation
      }));

      const rawPool = row.questionPool;
      const questionPool = Array.isArray(rawPool)
        ? rawPool
        : (typeof rawPool === 'string' ? JSON.parse(rawPool) : []);

      const rawUsed = row.usedQuestionIds;
      const usedQuestionIds = Array.isArray(rawUsed)
        ? rawUsed
        : (typeof rawUsed === 'string' ? JSON.parse(rawUsed) : []);

      const totalPoolCount = questionPool && questionPool.length > 0 ? questionPool.length : questions.length;
      const usedCount = usedQuestionIds.length;
      const remainingCount = Math.max(0, totalPoolCount - usedCount);

      quizzes.push({
        id: row.id,
        userId: row.userId,
        title: row.title,
        createdAt: row.createdAt,
        questionCount: questions.length,
        questions,
        questionPool,
        usedQuestionIds,
        totalPoolCount,
        usedCount,
        remainingCount,
        defaultSampleCount: row.defaultSampleCount || 20
      });
    }

    return quizzes;
  } catch (err) {
    console.error('Error fetching saved quizzes from PostgreSQL:', err.message);
    const inMem = Array.from(inMemoryQuizzes.values());
    if (userId) {
      return inMem.filter(q => q.userId === userId);
    }
    return inMem;
  }
}

/**
 * Retrieve a single quiz by ID, ensuring user authorization
 */
async function getQuizById(quizId, userId = null) {
  try {
    let query = `
      SELECT id, title, user_id as "userId", created_at as "createdAt",
             question_pool as "questionPool", used_question_ids as "usedQuestionIds", default_sample_count as "defaultSampleCount"
      FROM quizzes WHERE id = $1
    `;
    const params = [quizId];
    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    const quizRes = await pool.query(query, params);
    if (quizRes.rows.length === 0) {
      const cached = inMemoryQuizzes.get(quizId);
      if (cached && (!userId || cached.userId === userId)) return cached;
      return null;
    }
    const qRow = quizRes.rows[0];
    const questionsRes = await pool.query(
      `SELECT id, question_text as "questionText", options, correct_option_index as "correctOptionIndex",
              time_limit_seconds as "timeLimitSeconds", points_possible as "pointsPossible", explanation
       FROM questions
       WHERE quiz_id = $1
       ORDER BY order_num ASC`,
      [quizId]
    );

    const questions = questionsRes.rows.map(item => ({
      id: item.id,
      questionText: item.questionText,
      options: typeof item.options === 'string' ? JSON.parse(item.options) : item.options,
      correctOptionIndex: item.correctOptionIndex,
      timeLimitSeconds: item.timeLimitSeconds,
      pointsPossible: item.pointsPossible,
      explanation: item.explanation
    }));

    const rawPool = qRow.questionPool;
    const questionPool = Array.isArray(rawPool)
      ? rawPool
      : (typeof rawPool === 'string' ? JSON.parse(rawPool) : []);

    const rawUsed = qRow.usedQuestionIds;
    const usedQuestionIds = Array.isArray(rawUsed)
      ? rawUsed
      : (typeof rawUsed === 'string' ? JSON.parse(rawUsed) : []);

    const totalPoolCount = questionPool && questionPool.length > 0 ? questionPool.length : questions.length;
    const usedCount = usedQuestionIds.length;
    const remainingCount = Math.max(0, totalPoolCount - usedCount);

    return {
      id: qRow.id,
      userId: qRow.userId,
      title: qRow.title,
      createdAt: qRow.createdAt,
      questionCount: questions.length,
      questions,
      questionPool,
      usedQuestionIds,
      totalPoolCount,
      usedCount,
      remainingCount,
      defaultSampleCount: qRow.defaultSampleCount || 20
    };
  } catch (err) {
    console.error('Error fetching quiz by ID:', err.message);
    const cached = inMemoryQuizzes.get(quizId);
    if (cached && (!userId || cached.userId === userId)) return cached;
    return null;
  }
}

/**
 * Delete a saved quiz by ID with user ownership check
 */
async function deleteQuiz(quizId, userId = null) {
  try {
    if (userId) {
      await pool.query('DELETE FROM quizzes WHERE id = $1 AND user_id = $2', [quizId, userId]);
    } else {
      await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
    }
  } catch (err) {
    console.error('Error deleting quiz from PostgreSQL:', err.message);
  }
  const cached = inMemoryQuizzes.get(quizId);
  if (cached && (!userId || cached.userId === userId)) {
    inMemoryQuizzes.delete(quizId);
  }
  return true;
}

async function persistRoom(pin, hostToken, quizId, title, userId = null) {
  try {
    await pool.query(
      `INSERT INTO rooms (pin, host_token, quiz_id, title, user_id, state)
       VALUES ($1, $2, $3, $4, $5, 'LOBBY')
       ON CONFLICT (pin) DO UPDATE SET title = EXCLUDED.title, host_token = EXCLUDED.host_token, user_id = COALESCE(EXCLUDED.user_id, rooms.user_id)`,
      [pin, hostToken, quizId, title, userId]
    );
  } catch (err) {
    console.error('Error persisting room to PostgreSQL:', err.message);
  }
}

async function persistPlayer(pin, player) {
  try {
    // Ensure room exists in DB to prevent foreign key race condition on high-concurrency joins
    await pool.query(
      `INSERT INTO rooms (pin, host_token, title, state)
       VALUES ($1, 'system', 'Live Quiz', 'LOBBY')
       ON CONFLICT (pin) DO NOTHING`,
      [pin]
    );

    await pool.query(
      `INSERT INTO room_players (id, room_pin, nickname, total_score, streak)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         total_score = EXCLUDED.total_score,
         streak = EXCLUDED.streak`,
      [player.id, pin, player.nickname, player.score, player.streak]
    );
  } catch (err) {
    console.error('Error persisting player to PostgreSQL:', err.message);
  }
}

async function persistAnswer(pin, playerId, answer) {
  try {
    await pool.query(
      `INSERT INTO player_answers (room_pin, player_id, question_index, selected_option, response_time_ms, points_awarded, is_correct)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        pin,
        playerId,
        answer.questionIndex,
        answer.selectedOption,
        answer.responseTimeMs,
        answer.pointsAwarded,
        answer.isCorrect
      ]
    );

    await pool.query(
      `UPDATE room_players
       SET total_score = total_score + $1, streak = $2
       WHERE id = $3`,
      [answer.pointsAwarded, answer.isCorrect ? 1 : 0, playerId]
    );
  } catch (err) {
    console.error('Error persisting answer to PostgreSQL:', err.message);
  }
}

async function finishRoom(pin, podium = []) {
  try {
    await pool.query(
      `UPDATE rooms SET state = 'FINAL_PODIUM', finished_at = NOW() WHERE pin = $1`,
      [pin]
    );

    // If podium is provided, record session & top 10 winners
    if (Array.isArray(podium) && podium.length > 0) {
      const roomRes = await pool.query(
        `SELECT quiz_id, title, user_id FROM rooms WHERE pin = $1`,
        [pin]
      );
      if (roomRes.rows.length > 0 && roomRes.rows[0].quiz_id) {
        const { quiz_id, title, user_id } = roomRes.rows[0];
        const top10Winners = podium.slice(0, 10).map((p, idx) => ({
          rank: p.rank || (idx + 1),
          nickname: p.nickname,
          score: p.score
        }));

        const sessionId = uuidv4();
        await pool.query(
          `INSERT INTO quiz_sessions (id, quiz_id, room_pin, title, user_id, winners, total_players, played_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            sessionId,
            quiz_id,
            pin,
            title,
            user_id,
            JSON.stringify(top10Winners),
            podium.length
          ]
        );

        // Also store in in-memory fallback
        const existing = inMemoryQuizSessions.get(quiz_id) || [];
        existing.unshift({
          id: sessionId,
          quizId: quiz_id,
          roomPin: pin,
          title,
          userId: user_id,
          winners: top10Winners,
          totalPlayers: podium.length,
          playedAt: new Date().toISOString()
        });
        inMemoryQuizSessions.set(quiz_id, existing);
      }
    }
  } catch (err) {
    console.error('Error finishing room & recording winners in PostgreSQL:', err.message);
  }
}

async function getQuizPastWinners(quizId, userId = null) {
  try {
    const res = await pool.query(
      `SELECT id, quiz_id as "quizId", room_pin as "roomPin", title,
              user_id as "userId", winners, total_players as "totalPlayers", played_at as "playedAt"
       FROM quiz_sessions
       WHERE quiz_id = $1
       ORDER BY played_at DESC`,
      [quizId]
    );

    return res.rows.map(row => ({
      id: row.id,
      quizId: row.quizId,
      roomPin: row.roomPin,
      title: row.title,
      userId: row.userId,
      winners: typeof row.winners === 'string' ? JSON.parse(row.winners) : row.winners,
      totalPlayers: row.totalPlayers,
      playedAt: row.playedAt
    }));
  } catch (err) {
    console.error('Error fetching past winners from PostgreSQL:', err.message);
    return inMemoryQuizSessions.get(quizId) || [];
  }
}

module.exports = {
  pool,
  initDb,
  createUser,
  authenticateUser,
  getUserById,
  persistQuiz,
  getSavedQuizzes,
  getQuizById,
  deleteQuiz,
  updateQuizUsedQuestions,
  resetQuizQuestionHistory,
  persistRoom,
  persistPlayer,
  persistAnswer,
  finishRoom,
  getQuizPastWinners
};
