/**
 * Server-authoritative speed-weighted scoring engine.
 * Inspired by tournament-standard time-decay algorithms.
 */

/**
 * Calculates score for a given answer based on correctness and response time.
 * @param {boolean} isCorrect - Whether the selected answer is correct
 * @param {number} responseTimeMs - Server-measured time taken in milliseconds
 * @param {number} timeLimitSeconds - Total question timer in seconds
 * @param {number} maxPoints - Maximum base points (default 1000)
 * @returns {number} Integer score between 500 and 1000 if correct, 0 if incorrect
 */
function calculateScore(isCorrect, responseTimeMs, timeLimitSeconds = 20, maxPoints = 1000) {
  if (!isCorrect) {
    return 0;
  }

  const timeLimitMs = timeLimitSeconds * 1000;
  // If response came after timer expired (with 500ms network grace period)
  if (responseTimeMs > timeLimitMs + 500) {
    return 0;
  }

  const boundedResponseTime = Math.max(0, Math.min(responseTimeMs, timeLimitMs));
  // Linear decay: instantaneous gets maxPoints (1000), last second gets ~half points (500)
  const decayFactor = boundedResponseTime / (timeLimitMs * 2);
  const score = Math.floor((1 - decayFactor) * maxPoints);

  return Math.max(500, Math.min(maxPoints, score));
}

module.exports = {
  calculateScore
};
