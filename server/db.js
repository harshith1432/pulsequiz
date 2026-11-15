const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/quzi'
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option_index INT NOT NULL,
        time_limit_seconds INT DEFAULT 20,
        points_possible INT DEFAULT 1000,
        explanation TEXT,
        order_num INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rooms (
        pin VARCHAR(10) PRIMARY KEY,
        host_token VARCHAR(64) NOT NULL,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
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
    `);
    console.log('PostgreSQL schema initialized successfully in database "quzi".');
  } catch (err) {
    console.error('Error initializing PostgreSQL schema:', err.message);
  } finally {
    client.release();
  }
}

async function persistQuiz(quizId, title, questions) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO quizzes (id, title) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [quizId, title]
    );

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await client.query(
        `INSERT INTO questions (id, quiz_id, question_text, options, correct_option_index, time_limit_seconds, points_possible, explanation, order_num)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           question_text = EXCLUDED.question_text,
           options = EXCLUDED.options,
           correct_option_index = EXCLUDED.correct_option_index,
           time_limit_seconds = EXCLUDED.time_limit_seconds,
           explanation = EXCLUDED.explanation`,
        [
          q.id,
          quizId,
          q.questionText,
          JSON.stringify(q.options),
          q.correctOptionIndex,
          q.timeLimitSeconds || 20,
          q.pointsPossible || 1000,
          q.explanation || '',
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
}

async function persistRoom(pin, hostToken, quizId, title) {
  try {
    await pool.query(
      `INSERT INTO rooms (pin, host_token, quiz_id, title, state)
       VALUES ($1, $2, $3, $4, 'LOBBY')
       ON CONFLICT (pin) DO UPDATE SET title = EXCLUDED.title, host_token = EXCLUDED.host_token`,
      [pin, hostToken, quizId, title]
    );
  } catch (err) {
    console.error('Error persisting room to PostgreSQL:', err.message);
  }
}

async function persistPlayer(pin, player) {
  try {
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

    // Update player's total score in room_players
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

async function finishRoom(pin) {
  try {
    await pool.query(
      `UPDATE rooms SET state = 'FINAL_PODIUM', finished_at = NOW() WHERE pin = $1`,
      [pin]
    );
  } catch (err) {
    console.error('Error finishing room in PostgreSQL:', err.message);
  }
}

module.exports = {
  pool,
  initDb,
  persistQuiz,
  persistRoom,
  persistPlayer,
  persistAnswer,
  finishRoom
};
