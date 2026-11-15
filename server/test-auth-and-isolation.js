import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001';

async function runTests() {
  console.log('--- STARTING USER AUTH & ISOLATION TESTS ---');

  // 1. Register User A
  const userA = `user_a_${Date.now()}`;
  const resRegA = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userA, password: 'password' })
  });
  const dataRegA = await resRegA.json();
  if (!resRegA.ok || !dataRegA.token) {
    throw new Error(`Failed to register user A: ${JSON.stringify(dataRegA)}`);
  }
  const tokenA = dataRegA.token;
  console.log('✓ User A registered successfully:', userA);

  // 2. Register User B
  const userB = `user_b_${Date.now()}`;
  const resRegB = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userB, password: 'password' })
  });
  const dataRegB = await resRegB.json();
  if (!resRegB.ok || !dataRegB.token) {
    throw new Error(`Failed to register user B: ${JSON.stringify(dataRegB)}`);
  }
  const tokenB = dataRegB.token;
  console.log('✓ User B registered successfully:', userB);

  // 3. User A creates a saved Quiz
  const resSaveA = await fetch(`${API_BASE}/api/quizzes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      title: 'User A Secret Exam',
      description: 'Exam only visible to User A',
      questions: [
        {
          questionText: 'What is 2 + 2?',
          options: ['1', '2', '3', '4'],
          correctOptionIndex: 3,
          timeLimitSeconds: 15,
          pointsPossible: 10,
          explanation: '2+2 = 4'
        },
        {
          questionText: 'What is the capital of France?',
          options: ['London', 'Berlin', 'Paris', 'Rome'],
          correctOptionIndex: 2,
          timeLimitSeconds: 15,
          pointsPossible: 10,
          explanation: 'Paris is the capital of France'
        }
      ]
    })
  });
  const dataSaveA = await resSaveA.json();
  if (!resSaveA.ok || !dataSaveA.quiz) {
    throw new Error(`User A failed to save quiz: ${JSON.stringify(dataSaveA)}`);
  }
  const quizAId = dataSaveA.quiz.id;
  console.log('✓ User A saved quiz "User A Secret Exam" (ID:', quizAId, ')');

  // 4. User B lists quizzes -> must be EMPTY (data isolation!)
  const resListB = await fetch(`${API_BASE}/api/quizzes`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const dataListB = await resListB.json();
  if (dataListB.quizzes.length !== 0) {
    throw new Error(`Data isolation failed! User B saw quizzes: ${JSON.stringify(dataListB)}`);
  }
  console.log('✓ User B has 0 quizzes (isolation verified: cannot see User A quiz)');

  // 5. User B tries to fetch User A's quiz directly -> must return 404
  const resGetAFromB = await fetch(`${API_BASE}/api/quizzes/${quizAId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  if (resGetAFromB.status !== 404) {
    throw new Error(`Security breach! User B was able to access User A quiz directly: HTTP ${resGetAFromB.status}`);
  }
  console.log('✓ User B direct access to User A quiz was blocked with 404');

  // 6. User A lists quizzes -> must see their 1 quiz
  const resListA = await fetch(`${API_BASE}/api/quizzes`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const dataListA = await resListA.json();
  if (dataListA.quizzes.length !== 1 || dataListA.quizzes[0].id !== quizAId) {
    throw new Error(`User A did not find their own quiz: ${JSON.stringify(dataListA)}`);
  }
  console.log('✓ User A sees their own quiz in their personal library');

  // 7. User A creates a room from their saved quiz
  const resCreateRoom = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      quizId: quizAId,
      themeId: 'cream_espresso'
    })
  });
  const dataCreateRoom = await resCreateRoom.json();
  if (!resCreateRoom.ok || !dataCreateRoom.pin) {
    throw new Error(`Failed to create room: ${JSON.stringify(dataCreateRoom)}`);
  }
  const pin = dataCreateRoom.pin;
  const hostToken = dataCreateRoom.hostToken;
  console.log('✓ Room created with PIN:', pin, 'by User A');

  // 8. Public PIN check (like entering PIN on mobile or laptop)
  const resPublicRoom = await fetch(`${API_BASE}/api/rooms/${pin}`);
  const dataPublicRoom = await resPublicRoom.json();
  if (dataPublicRoom.questions || dataPublicRoom.answerKeys) {
    throw new Error('Public endpoint leaked questions/answers to participant!');
  }
  console.log('✓ Public PIN check safe (no questions leaked to participant before game)');

  // 9. Host and Player socket gameplay
  console.log('--- TESTING LIVE GAMEPLAY WITH CUMULATIVE SCORING & RANKING ---');
  const hostSocket = io(API_BASE);
  const player1Socket = io(API_BASE);
  const player2Socket = io(API_BASE);

  await new Promise((resolve) => hostSocket.on('connect', resolve));
  await new Promise((resolve) => player1Socket.on('connect', resolve));
  await new Promise((resolve) => player2Socket.on('connect', resolve));

  // Host connects
  await new Promise((resolve) => {
    hostSocket.emit('host:connect', { pin, hostToken }, (res) => {
      if (!res.success) throw new Error('Host failed to connect socket');
      resolve();
    });
  });

  // Players join
  await new Promise((resolve) => {
    player1Socket.emit('player:join', { pin, nickname: 'Alice' }, (res) => {
      if (!res.success) throw new Error('Player 1 failed to join');
      resolve();
    });
  });

  await new Promise((resolve) => {
    player2Socket.emit('player:join', { pin, nickname: 'Bob' }, (res) => {
      if (!res.success) throw new Error('Player 2 failed to join');
      resolve();
    });
  });
  console.log('✓ Alice and Bob joined room successfully');

  // Host starts Question 1
  hostSocket.emit('host:next_question', { pin, hostToken });

  // Wait for question:active
  await new Promise((resolve) => player1Socket.once('question:active', resolve));

  // Alice answers immediately (correct option 3)
  player1Socket.emit('player:submit_answer', { pin, selectedOption: 3 });
  // Bob answers a bit slower (correct option 3)
  await new Promise(r => setTimeout(r, 200));
  player2Socket.emit('player:submit_answer', { pin, selectedOption: 3 });

  // Host reveals answer
  hostSocket.emit('host:reveal_answer', { pin, hostToken });

  // Round 1 ended listener
  const round1Result = await new Promise((resolve) => player1Socket.once('round:ended', resolve));
  console.log('✓ Round 1 Leaderboard:', round1Result.leaderboard.map(p => `${p.nickname}: ${p.score} pts`));

  // Verify Alice has equal or more points than Bob due to speed
  const aliceR1 = round1Result.leaderboard.find(p => p.nickname === 'Alice');
  const bobR1 = round1Result.leaderboard.find(p => p.nickname === 'Bob');
  if (aliceR1.score < bobR1.score) {
    throw new Error('Speed scoring failed: Alice answered faster but has lower score than Bob');
  }

  // Question 2
  hostSocket.emit('host:next_question', { pin, hostToken });
  await new Promise((resolve) => player1Socket.once('question:active', resolve));

  // Question 2 (correct option 2: Paris)
  // Bob answers first correctly
  player2Socket.emit('player:submit_answer', { pin, selectedOption: 2 });
  // Alice answers incorrect option 0 (London)
  player1Socket.emit('player:submit_answer', { pin, selectedOption: 0 });

  // Host reveals answer
  hostSocket.emit('host:reveal_answer', { pin, hostToken });

  const round2Result = await new Promise((resolve) => player1Socket.once('round:ended', resolve));
  console.log('✓ Round 2 Leaderboard (Cumulative):', round2Result.leaderboard.map(p => `${p.nickname}: ${p.score} pts (rank ${p.rank})`));

  // Verify Bob added points to his previous score (cumulative)
  const bobR2 = round2Result.leaderboard.find(p => p.nickname === 'Bob');
  if (bobR2.score <= bobR1.score) {
    throw new Error('Cumulative scoring failed: Bob did not accumulate score');
  }

  // Verify Alice did not get points for incorrect answer
  const aliceR2 = round2Result.leaderboard.find(p => p.nickname === 'Alice');
  if (aliceR2.score !== aliceR1.score) {
    throw new Error('Score changed for incorrect answer');
  }

  // Finish game
  hostSocket.emit('host:next_question', { pin, hostToken });
  const finalResult = await new Promise((resolve) => hostSocket.once('game:finished', resolve));
  console.log('✓ Game finished podium:', finalResult.podium.map(p => `#${p.rank} ${p.nickname}: ${p.score} pts`));

  hostSocket.disconnect();
  player1Socket.disconnect();
  player2Socket.disconnect();

  console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
