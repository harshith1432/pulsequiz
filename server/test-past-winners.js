const assert = require('assert');
const http = require('http');
const ioClient = require('socket.io-client');

const SERVER_URL = 'http://127.0.0.1:3001';

function postJson(urlPath, payload, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_URL);
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(urlPath, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_URL);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

async function testPastWinners() {
  console.log('🧪 Starting Past Winners & Early Exit Verification Test...');

  // 1. Register host
  const username = `host_${Date.now()}`;
  const regRes = await postJson('/api/auth/register', { username, password: 'password123' });
  assert.ok(regRes.token, 'Host token received');
  const token = regRes.token;
  console.log(`✓ Host registered: ${username}`);

  // 2. Save a quiz to library
  const saveQuizRes = await postJson('/api/quizzes', {
    title: 'Championship Trivia 2026',
    questions: [
      {
        questionText: 'What is 10 + 10?',
        options: ['10', '20', '30', '40'],
        correctOptionIndex: 1,
        timeLimitSeconds: 15,
        pointsPossible: 10
      },
      {
        questionText: 'What color is the sky?',
        options: ['Green', 'Blue', 'Red', 'Yellow'],
        correctOptionIndex: 1,
        timeLimitSeconds: 15,
        pointsPossible: 10
      }
    ]
  }, token);
  assert.ok(saveQuizRes.quiz && saveQuizRes.quiz.id, 'Quiz saved successfully');
  const quizId = saveQuizRes.quiz.id;
  console.log(`✓ Saved Quiz created with ID: ${quizId}`);

  // 3. Create room for this saved quiz
  const roomRes = await postJson('/api/rooms', {
    quizId,
    quizTitle: 'Championship Trivia 2026'
  }, token);
  assert.ok(roomRes.pin, 'Room PIN generated');
  const pin = roomRes.pin;
  const hostToken = roomRes.hostToken;
  console.log(`✓ Live room launched with PIN: ${pin}`);

  // 4. Connect host socket
  const hostSocket = ioClient(SERVER_URL, { transports: ['websocket'] });
  await new Promise(resolve => {
    hostSocket.on('connect', () => {
      hostSocket.emit('host:connect', { pin, hostToken }, resolve);
    });
  });

  // 5. Connect 4 players: Alice, Bob, Charlie, Dave
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Dave'];
  const playerSockets = [];

  for (const name of playerNames) {
    const pSock = ioClient(SERVER_URL, { transports: ['websocket'] });
    await new Promise(resolve => {
      pSock.on('connect', () => {
        pSock.emit('player:join', { pin, nickname: name }, (res) => {
          assert.ok(res.success, `${name} joined room`);
          resolve();
        });
      });
    });
    playerSockets.push(pSock);
  }
  console.log(`✓ 4 players joined room [${pin}]`);

  // 6. Host starts Q1
  hostSocket.emit('host:next_question', { pin, hostToken });
  await new Promise(r => setTimeout(r, 200));

  // Alice & Bob answer correctly
  playerSockets[0].emit('player:submit_answer', { pin, selectedOption: 1 });
  playerSockets[1].emit('player:submit_answer', { pin, selectedOption: 1 });
  // Charlie answers wrong
  playerSockets[2].emit('player:submit_answer', { pin, selectedOption: 0 });

  await new Promise(r => setTimeout(r, 300));

  // Host reveals answer
  hostSocket.emit('host:reveal_answer', { pin, hostToken });
  await new Promise(r => setTimeout(r, 300));

  // 7. Test early quit / escape key simulation: host ends quiz early
  console.log('⚡ Simulating early quiz exit (Escape key)...');
  const quitResult = await new Promise(resolve => {
    hostSocket.emit('host:quit_game', { pin, hostToken }, (res) => {
      resolve(res);
    });
  });

  assert.ok(quitResult.isFinished, 'Game marked as finished');
  assert.ok(quitResult.podium.length > 0, 'Podium declared');
  console.log(`✓ Podium declared upon early exit: Rank #1 is ${quitResult.podium[0].nickname} with ${quitResult.podium[0].score} pts`);

  // Allow database flush
  await new Promise(r => setTimeout(r, 800));

  // 8. Fetch Past Winners for this saved quiz
  console.log(`🔍 Querying /api/quizzes/${quizId}/winners...`);
  const winnersRes = await getJson(`/api/quizzes/${quizId}/winners`, token);
  assert.ok(winnersRes.success, 'Fetched winners successfully');
  assert.ok(Array.isArray(winnersRes.sessions) && winnersRes.sessions.length > 0, 'Past sessions recorded');
  
  const latestSession = winnersRes.sessions[0];
  assert.strictEqual(latestSession.quizId, quizId, 'Session linked to quizId');
  assert.strictEqual(latestSession.roomPin, pin, 'Session has matching roomPin');
  assert.ok(latestSession.winners.length > 0, 'Session contains Top 10 winners');
  console.log('✓ Recorded Past Winners in Database:');
  latestSession.winners.forEach(w => {
    console.log(`   Rank ${w.rank}: ${w.nickname} - ${w.score} pts`);
  });

  // Disconnect sockets
  hostSocket.disconnect();
  playerSockets.forEach(s => s.disconnect());

  console.log('🎉 ALL PAST WINNERS & EARLY EXIT TESTS PASSED CLEANLY!');
  process.exit(0);
}

testPastWinners().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
