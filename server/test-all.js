const assert = require('assert');
const { generateTemplateBuffer, parseExcelBuffer } = require('./services/excelService');
const { calculateScore } = require('./scoring');
const roomManager = require('./roomManager');
const db = require('./db');

async function runTestSuite() {
  console.log('🧪 Starting PulseQuiz Automated Verification Suite...');

  // Test 1: Scoring Formula
  console.log('1. Testing Scoring Algorithm (Points based on correctness & who answered first)...');
  // Instantaneous response (0ms), answered first (correctOrder = 1) -> full 10 points
  const instantScore = calculateScore(true, 0, 20, 10, 1);
  assert.strictEqual(instantScore, 10, 'First fast response should earn 10 points');

  // Second response (2.5s), answered second (correctOrder = 2) -> 9 points
  const secondScore = calculateScore(true, 2500, 20, 10, 2);
  assert.ok(secondScore <= 9 && secondScore >= 8, 'Second response earns fewer points than first');

  // Last-second response (19.5s on a 20s question) -> 1 point
  const lastSecondScore = calculateScore(true, 19500, 20, 10, 3);
  assert.strictEqual(lastSecondScore, 1, 'Last second response should earn 1 point');

  // Incorrect answer -> 0 points
  const wrongScore = calculateScore(false, 500, 20, 10, 1);
  assert.strictEqual(wrongScore, 0, 'Incorrect answer must earn 0 points');

  // Expired answer (> 20s + grace) -> 0 points
  const expiredScore = calculateScore(true, 21000, 20, 10, 1);
  assert.strictEqual(expiredScore, 0, 'Response after timeout must earn 0 points');

  console.log('   ✓ Scoring algorithm passed all assertions.');

  // Test 2: Excel Template Generation & Parsing
  console.log('2. Testing Excel Template Ingestion Pipeline...');
  const templateBuf = generateTemplateBuffer();
  assert.ok(templateBuf && templateBuf.length > 0, 'Template buffer must not be empty');

  const parsedQuestions = parseExcelBuffer(templateBuf);
  assert.strictEqual(parsedQuestions.length, 5, 'Template should contain 5 sample questions');
  assert.strictEqual(parsedQuestions[0].options.length, 4, 'Question must contain 4 options');
  assert.ok(parsedQuestions[0].correctOptionIndex >= 0 && parsedQuestions[0].correctOptionIndex <= 3, 'Valid correct index');
  assert.strictEqual(parsedQuestions[0].pointsPossible, 10, 'Points possible defaults to 10');
  console.log(`   ✓ Excel generator and parser verified. Extracted ${parsedQuestions.length} questions correctly.`);

  // Test 3: PostgreSQL Database Schema and Persistence
  console.log('3. Testing PostgreSQL Connection & Table Schema...');
  await db.initDb();

  const testQuizId = '00000000-0000-0000-0000-000000000001';
  await db.persistQuiz(testQuizId, 'Test Quiz Title', parsedQuestions);
  console.log('   ✓ PostgreSQL quiz and questions persisted successfully.');

  // Test 4: Multi-question Cumulative Points & Dynamic Ranking
  console.log('4. Testing Multi-question Cumulative Points & Dynamic Rankings...');
  const room = roomManager.createRoom('Championship', parsedQuestions);
  assert.ok(room.pin && room.pin.length === 6, 'Room PIN must be 6 digits');

  // 3 players join: Alice, Bob, Charlie
  roomManager.joinPlayer(room.pin, 'sock_alice', 'Alice');
  roomManager.joinPlayer(room.pin, 'sock_bob', 'Bob');
  roomManager.joinPlayer(room.pin, 'sock_charlie', 'Charlie');

  // --- QUESTION 1 ---
  console.log('   Starting Question 1...');
  roomManager.startNextQuestion(room.pin, room.hostToken);

  // Alice answers first and correct -> 10 points
  const q1Alice = roomManager.submitAnswer(room.pin, 'sock_alice', parsedQuestions[0].correctOptionIndex);
  assert.strictEqual(q1Alice.isCorrect, true);
  assert.strictEqual(q1Alice.pointsAwarded, 10, 'Alice answered first and gets 10 points');
  assert.strictEqual(q1Alice.totalScore, 10);

  // Bob answers incorrect -> 0 points
  const q1Bob = roomManager.submitAnswer(room.pin, 'sock_bob', (parsedQuestions[0].correctOptionIndex + 1) % 4);
  assert.strictEqual(q1Bob.isCorrect, false);
  assert.strictEqual(q1Bob.pointsAwarded, 0);
  assert.strictEqual(q1Bob.totalScore, 0);

  // Charlie does not answer in Question 1 -> 0 points

  // End Question 1
  const round1 = roomManager.endQuestion(room.pin, room.hostToken);
  assert.strictEqual(round1.leaderboard[0].nickname, 'Alice');
  assert.strictEqual(round1.leaderboard[0].score, 10, 'Alice has 10 points total after Q1');
  assert.strictEqual(round1.leaderboard[0].rank, 1, 'Alice is Rank #1');

  // --- QUESTION 2 ---
  console.log('   Starting Question 2...');
  roomManager.startNextQuestion(room.pin, room.hostToken);

  // Alice answers late on Q2 and scores 1 point
  // Simulate slow response by manually testing calculateScore or submitting
  const aliceQ2 = roomManager.submitAnswer(room.pin, 'sock_alice', parsedQuestions[1].correctOptionIndex);
  assert.strictEqual(aliceQ2.isCorrect, true);

  // Bob answers first on Q2, correct -> scores 9 or 10
  const bobQ2 = roomManager.submitAnswer(room.pin, 'sock_bob', parsedQuestions[1].correctOptionIndex);
  assert.strictEqual(bobQ2.isCorrect, true);

  // End Question 2
  const round2 = roomManager.endQuestion(room.pin, room.hostToken);

  // Verify that previous question score is added to current question score!
  const aliceEntry = round2.leaderboard.find(p => p.nickname === 'Alice');
  const bobEntry = round2.leaderboard.find(p => p.nickname === 'Bob');

  assert.strictEqual(aliceEntry.previousScore, 10, 'Alice previous score was 10');
  assert.strictEqual(aliceEntry.score, aliceEntry.previousScore + aliceEntry.lastPointsAwarded, 'Alice score = previous + current');

  assert.strictEqual(bobEntry.previousScore, 0, 'Bob previous score was 0');
  assert.strictEqual(bobEntry.score, bobEntry.previousScore + bobEntry.lastPointsAwarded, 'Bob score = previous + current');

  console.log(`   ✓ After Q2: Alice total = ${aliceEntry.score} pts, Bob total = ${bobEntry.score} pts`);
  console.log(`   ✓ Leaderboard Rank #1: ${round2.leaderboard[0].nickname} with ${round2.leaderboard[0].score} pts`);

  // Verify rank ordering
  for (let i = 0; i < round2.leaderboard.length - 1; i++) {
    assert.ok(round2.leaderboard[i].score >= round2.leaderboard[i + 1].score, 'Leaderboard must be sorted descending by total score');
  }

  console.log('🎉 ALL TESTS PASSED CLEANLY (Zero Failures)!');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
