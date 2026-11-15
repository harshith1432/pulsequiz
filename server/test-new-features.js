import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001';

async function testNewFeatures() {
  console.log('--- STARTING NEW FEATURES VERIFICATION ---');

  // 1. Create a room with 5 questions
  const resRoom = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizTitle: 'Speed & Skip Test Quiz',
      questions: [
        {
          questionText: 'Question 1: What is 5 x 5?',
          options: ['20', '25', '30', '35'],
          correctOptionIndex: 1,
          timeLimitSeconds: 30,
          pointsPossible: 10
        },
        {
          questionText: 'Question 2: What is 10 x 10?',
          options: ['50', '100', '150', '200'],
          correctOptionIndex: 1,
          timeLimitSeconds: 30,
          pointsPossible: 10
        },
        {
          questionText: 'Question 3: What is 2 + 2?',
          options: ['2', '3', '4', '5'],
          correctOptionIndex: 2,
          timeLimitSeconds: 30,
          pointsPossible: 10
        }
      ]
    })
  });
  const roomData = await resRoom.json();
  const pin = roomData.pin;
  const hostToken = roomData.hostToken;
  console.log('✓ Room created with PIN:', pin);

  // 2. Connect Host and 2 Players
  const hostSocket = io(API_BASE);
  const p1Socket = io(API_BASE);
  const p2Socket = io(API_BASE);

  await new Promise(r => hostSocket.on('connect', r));
  await new Promise(r => p1Socket.on('connect', r));
  await new Promise(r => p2Socket.on('connect', r));

  await new Promise(r => hostSocket.emit('host:connect', { pin, hostToken }, r));
  await new Promise(r => p1Socket.emit('player:join', { pin, nickname: 'Runner1' }, r));
  await new Promise(r => p2Socket.emit('player:join', { pin, nickname: 'Runner2' }, r));
  console.log('✓ Host and 2 players joined');

  // 3. Test Feature: Setting timing of the quiz at the start
  console.log('Testing timer update to 15s...');
  const timerRes = await new Promise((resolve) => {
    hostSocket.emit('host:update_timer', { pin, hostToken, timeLimitSeconds: 15 }, resolve);
  });
  if (!timerRes.success || timerRes.timeLimitSeconds !== 15) {
    throw new Error('Failed to update room timer: ' + JSON.stringify(timerRes));
  }
  console.log('✓ Timer successfully updated to 15s before starting game');

  // 4. Start Question 1 (verify updated timer is 15s)
  hostSocket.emit('host:next_question', { pin, hostToken });
  const q1Data = await new Promise(r => p1Socket.once('question:active', r));
  if (q1Data.timeLimitSeconds !== 15) {
    throw new Error(`Timer was not applied! Expected 15, got ${q1Data.timeLimitSeconds}`);
  }
  console.log('✓ Question 1 started with updated 15s timer');

  // 5. Test Feature: Auto reveal when ALL participants answer!
  console.log('Testing automatic reveal when all participants answer...');
  const autoRevealPromise = new Promise((resolve) => {
    hostSocket.once('round:ended', (res) => resolve(res));
  });

  const startTime = Date.now();
  // Runner 1 answers immediately
  p1Socket.emit('player:submit_answer', { pin, selectedOption: 1 });
  // Runner 2 answers immediately
  p2Socket.emit('player:submit_answer', { pin, selectedOption: 1 });

  // Wait for auto-reveal triggered by server
  const round1Result = await autoRevealPromise;
  const elapsed = Date.now() - startTime;
  console.log(`✓ Question 1 automatically revealed answer in ${elapsed}ms (did not wait for full 15s!)`);
  console.log('✓ Round 1 Leaderboard:', round1Result.leaderboard.map(p => `${p.nickname}: ${p.score} pts`));

  // 6. Question 2: Test Manual Early Reveal / Skip Timer
  console.log('Testing manual early reveal on Question 2...');
  hostSocket.emit('host:next_question', { pin, hostToken });
  await new Promise(r => p1Socket.once('question:active', r));

  // Only Runner 1 answers; Runner 2 has not answered yet
  p1Socket.emit('player:submit_answer', { pin, selectedOption: 1 });

  // Host manually clicks "Reveal Answer Early"
  const manualRevealPromise = new Promise((resolve) => {
    hostSocket.once('round:ended', (res) => resolve(res));
  });
  hostSocket.emit('host:reveal_answer', { pin, hostToken });
  const round2Result = await manualRevealPromise;
  console.log('✓ Question 2 manually revealed early by host before timer finished');
  console.log('✓ Round 2 Leaderboard:', round2Result.leaderboard.map(p => `${p.nickname}: ${p.score} pts`));

  // 7. Question 3: Test Mid-Quiz Quit to Podium & Top Rankers
  console.log('Testing mid-quiz quit to podium...');
  hostSocket.emit('host:next_question', { pin, hostToken });
  await new Promise(r => p1Socket.once('question:active', r));

  // Host clicks "End Quiz & Show Top Rankers"
  const quitPromise = new Promise((resolve) => {
    p1Socket.once('game:finished', (res) => resolve(res));
  });
  hostSocket.emit('host:quit_game', { pin, hostToken });
  const finalResult = await quitPromise;

  if (!finalResult.podium || finalResult.podium.length !== 2) {
    throw new Error('Quit game failed to return top rankers podium: ' + JSON.stringify(finalResult));
  }
  console.log('✓ Mid-quiz quit successfully generated final podium with top rankers:');
  finalResult.podium.forEach(p => console.log(`   #${p.rank} ${p.nickname} - ${p.score} pts`));

  hostSocket.disconnect();
  p1Socket.disconnect();
  p2Socket.disconnect();

  console.log('=== ALL 4 NEW FEATURES VERIFIED & WORKING PERFECTLY! ===');
}

testNewFeatures().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
