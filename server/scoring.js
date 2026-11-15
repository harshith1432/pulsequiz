/**
 * Server-authoritative scoring engine.
 * Points are given based on who answered first and whether the answer is correct.
 * Maximum score per question defaults to 10 points.
 */

/**
 * Calculates score for a given answer based on correctness, response time, and answer order.
 * @param {boolean} isCorrect - Whether the selected answer is correct
 * @param {number} responseTimeMs - Server-measured time taken in milliseconds
 * @param {number} timeLimitSeconds - Total question timer in seconds (default 20)
 * @param {number} maxPoints - Maximum base points (default 10)
 * @param {number} correctOrder - 1-based order of this correct answer among participants (1 = answered first, 2 = answered second, etc.)
 * @returns {number} Integer score between 1 and maxPoints (e.g. 1-10) if correct, 0 if incorrect
 */
function calculateScore(isCorrect, responseTimeMs, timeLimitSeconds = 20, maxPoints = 10, correctOrder = 1) {
  if (!isCorrect) {
    return 0;
  }

  const timeLimitMs = timeLimitSeconds * 1000;
  // If response came after timer expired (with 500ms network grace period)
  if (responseTimeMs > timeLimitMs + 500) {
    return 0;
  }

  const boundedResponseTime = Math.max(0, Math.min(responseTimeMs, timeLimitMs));
  // Fraction of time remaining (1.0 = instant, 0.0 = last millisecond)
  const fractionRemaining = (timeLimitMs - boundedResponseTime) / timeLimitMs;

  // Base speed score scaled from 1 to maxPoints
  // Fastest response gets maxPoints (e.g. 10), slowest in-time response gets 1 point
  let score = Math.round(1 + (maxPoints - 1) * fractionRemaining);

  // If order of correct answers is known, reward who answered first:
  // The first person who answers correctly gets top points (up to maxPoints).
  // Slower/later participants receive points capped by their arrival order so earlier answers earn >= later answers.
  if (correctOrder > 1 && maxPoints >= 5) {
    const orderCap = Math.max(1, maxPoints - (correctOrder - 1));
    score = Math.min(score, orderCap);
  }

  return Math.max(1, Math.min(maxPoints, score));
}

module.exports = {
  calculateScore
};
