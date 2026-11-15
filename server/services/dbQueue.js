/**
 * High-Throughput Database Write Queue & Micro-Batching Engine.
 * 
 * Prevents PostgreSQL connection starvation under high concurrent load (100 - 100,000 players).
 * Buffers individual player answer submissions and bulk-flushes them in high-efficiency multi-row SQL transactions.
 */

const { pool } = require('../db');

class DatabaseQueue {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 250;
    this.flushIntervalMs = options.flushIntervalMs || 400;
    this.queue = [];
    this.isFlushing = false;
    this.flushTimer = null;
    this.stats = {
      totalQueued: 0,
      totalFlushed: 0,
      flushCount: 0,
      errors: 0
    };

    this.startAutoFlush();
  }

  startAutoFlush() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0 && !this.isFlushing) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }

  /**
   * Enqueue a player's answer for bulk persistence
   */
  enqueueAnswer(pin, playerId, nickname, answer) {
    this.queue.push({
      pin,
      playerId,
      nickname: nickname || 'Player',
      questionIndex: answer.questionIndex,
      selectedOption: answer.selectedOption,
      responseTimeMs: answer.responseTimeMs,
      pointsAwarded: answer.pointsAwarded,
      isCorrect: Boolean(answer.isCorrect)
    });
    this.stats.totalQueued++;

    if (this.queue.length >= this.batchSize && !this.isFlushing) {
      this.flush();
    }
  }

  /**
   * Bulk flush queued answers into PostgreSQL
   */
  async flush() {
    if (this.queue.length === 0 || this.isFlushing) return;
    this.isFlushing = true;

    // Drain current batch from queue
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Ensure room exists in rooms table (guarantees foreign key safety under extreme concurrency)
        const uniquePins = [...new Set(batch.map(b => b.pin))];
        for (const p of uniquePins) {
          await client.query(
            `INSERT INTO rooms (pin, host_token, title, state)
             VALUES ($1, 'system', 'Live Quiz', 'LOBBY')
             ON CONFLICT (pin) DO NOTHING`,
            [p]
          );
        }

        // 2. Ensure all players exist in room_players (handles high concurrency race conditions)
        for (const item of batch) {
          await client.query(
            `INSERT INTO room_players (id, room_pin, nickname, total_score, streak)
             VALUES ($1, $2, $3, 0, 0)
             ON CONFLICT (id) DO NOTHING`,
            [item.playerId, item.pin, item.nickname]
          );
        }

        // 2. Build single multi-row INSERT statement for answers
        const valuePlaceholders = [];
        const flatValues = [];
        let paramIdx = 1;

        for (const item of batch) {
          valuePlaceholders.push(
            `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`
          );
          flatValues.push(
            item.pin,
            item.playerId,
            item.questionIndex,
            item.selectedOption,
            item.responseTimeMs,
            item.pointsAwarded,
            item.isCorrect
          );
          paramIdx += 7;
        }

        const insertQuery = `
          INSERT INTO player_answers 
            (room_pin, player_id, question_index, selected_option, response_time_ms, points_awarded, is_correct)
          VALUES ${valuePlaceholders.join(', ')}
        `;
        await client.query(insertQuery, flatValues);

        // 3. Bulk update player scores in room_players
        for (const item of batch) {
          await client.query(
            `UPDATE room_players
             SET total_score = total_score + $1, streak = $2
             WHERE id = $3`,
            [item.pointsAwarded, item.isCorrect ? 1 : 0, item.playerId]
          );
        }

        await client.query('COMMIT');
        this.stats.totalFlushed += batch.length;
        this.stats.flushCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      this.stats.errors++;
      console.error('[DatabaseQueue] Bulk flush error (re-queuing batch): %s', err.message);
      // Re-queue failed batch at front of queue so data is never dropped
      this.queue.unshift(...batch);
    } finally {
      this.isFlushing = false;
      // If queue accumulated more items during flush, immediately flush next chunk
      if (this.queue.length >= this.batchSize) {
        setImmediate(() => this.flush());
      }
    }
  }

  /**
   * Drain remaining queue completely (e.g. at end of round or server shutdown)
   */
  async flushAll() {
    while (this.queue.length > 0) {
      await this.flush();
    }
  }

  getStats() {
    return {
      ...this.stats,
      currentQueueLength: this.queue.length
    };
  }

  destroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }
}

const dbQueue = new DatabaseQueue();

module.exports = dbQueue;
