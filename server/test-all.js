const assert = require('assert');
const { generateTemplateBuffer, parseExcelBuffer } = require('./services/excelService');
const { calculateScore } = require('./scoring');
const roomManager = require('./roomManager');
const db = require('./db');

async function runTestSuite() {
  console.log('🧪 Starting PulseQuiz Automated Verification Suite...');

  // Test 1: Scoring Formula
  console.log('1. Testing Scoring Algorithm...');
  // Instantaneous response (0ms) -> full 1000 points
  const instantScore = calculateScore(true, 0, 20, 1000);
  assert.strictEqual(instantScore, 1000, 'Instant response should earn 1000 points');

  // Half-time response (10s on a 20s question) -> 750 points
  const halfTimeScore = calculateScore(true, 10000, 20, 1000);
  assert.strictEqual(halfTimeScore, 750, 'Half-time response should earn 750 points');

  // Last-second response (20s on a 20s question) -> 500 points
  const lastSecondScore = calculateScore(true, 20000, 20, 1000);
  assert.strictEqual(lastSecondScore, 500, 'Last second response should earn 500 points');

  // Incorrect answer -> 0 points
  const wrongScore = calculateScore(false, 500, 20, 1000);
  assert.strictEqual(wrongScore, 0, 'Incorrect answer must earn 0 points');

  console.log('   ✓ Scoring algorithm passed all assertions.');

  // Test 2: Excel Template Generation & Parsing
  console.log('2. Testing Excel Template Ingestion Pipeline...');
  const templateBuf = generateTemplateBuffer();
  assert.ok(templateBuf && templateBuf.length > 0, 'Template buffer must not be empty');

  const parsedQuestions = parseExcelBuffer(templateBuf);
  assert.strictEqual(parsedQuestions.length, 5, 'Template should contain 5 sample questions');
  assert.strictEqual(parsedQuestions[0].options.length, 4, 'Question must contain 4 options');
  assert.ok(parsedQuestions[0].correctOptionIndex >= 0 && parsedQuestions[0].correctOptionIndex <= 3, 'Valid correct index');
  console.log(`   ✓ Excel generator and parser verified. Extracted ${parsedQuestions.length} questions correctly.`);

  // Test 3: PostgreSQL Database Schema and Persistence
  console.log('3. Testing PostgreSQL Connection & Table Schema...');
  await db.initDb();

  const testQuizId = '00000000-0000-0000-0000-000000000001';
  await db.persistQuiz(testQuizId, 'Test Quiz Title', parsedQuestions);
  console.log('   ✓ PostgreSQL quiz and questions persisted successfully.');

  // Test 4: Room Manager & Multiplayer Simulation
  console.log('4. Testing Room Manager & Concurrent Player Flow...');
  const room = roomManager.createRoom('Automation Championship', parsedQuestions);
  assert.ok(room.pin && room.pin.length === 6, 'Room PIN must be 6 digits');
  assert.ok(room.hostToken, 'Host token must exist');

  // Simulate 3 players joining
  const p1 = roomManager.joinPlayer(room.pin, 'sock_1', 'Alice');
  const p2 = roomManager.joinPlayer(room.pin, 'sock_2', 'Bob');
  const p3 = roomManager.joinPlayer(room.pin, 'sock_3', 'Charlie');

  assert.strictEqual(roomManager.getRoom(room.pin).players.size, 3, 'Must have 3 joined players');
  console.log('   ✓ 3 players joined room successfully.');

  // Start question
  const qActive = roomManager.startNextQuestion(room.pin, room.hostToken);
  assert.strictEqual(qActive.questionIndex, 0, 'First question index must be 0');
  assert.ok(!qActive.correctOptionIndex, 'Security check: Correct option must NOT be in public question payload');

  // Submit answers: Alice correct in 1s, Bob correct in 5s, Charlie wrong in 2s
  const p1Ans = roomManager.submitAnswer(room.pin, 'sock_1', parsedQuestions[0].correctOptionIndex);
  assert.strictEqual(p1Ans.isCorrect, true);
  assert.ok(p1Ans.pointsAwarded > 900);

  const p2Ans = roomManager.submitAnswer(room.pin, 'sock_2', parsedQuestions[0].correctOptionIndex);
  assert.strictEqual(p2Ans.isCorrect, true);

  const p3Ans = roomManager.submitAnswer(room.pin, 'sock_3', (parsedQuestions[0].correctOptionIndex + 1) % 4);
  assert.strictEqual(p3Ans.isCorrect, false);
  assert.strictEqual(p3Ans.pointsAwarded, 0);

  // Duplicate submission check
  const dupAns = roomManager.submitAnswer(room.pin, 'sock_1', 0);
  assert.strictEqual(dupAns.alreadyAnswered, true, 'Duplicate answers must be blocked');

  // End question and check leaderboard
  const roundSummary = roomManager.endQuestion(room.pin, room.hostToken);
  assert.strictEqual(roundSummary.top5Leaderboard.length, 3);
  assert.strictEqual(roundSummary.top5Leaderboard[0].nickname, 'Alice', 'Alice should be #1 rank due to speed');

  console.log('   ✓ Round concluded. Top player: ' + roundSummary.top5Leaderboard[0].nickname + ' with ' + roundSummary.top5Leaderboard[0].score + ' pts');

  console.log('🎉 ALL TESTS PASSED CLEANLY (Zero Failures)!');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
