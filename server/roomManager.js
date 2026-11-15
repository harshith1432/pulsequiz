const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { calculateScore } = require('./scoring');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // pin -> roomObject
    this.playerToRoom = new Map(); // socketId -> { pin, playerId }
  }

  generatePin() {
    let pin;
    let attempts = 0;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
      if (attempts > 100) break;
    } while (this.rooms.has(pin));
    return pin;
  }

  createRoom(quizTitle, questions, quizId = null, userId = null) {
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('At least one question is required to create a room.');
    }

    const pin = this.generatePin();
    const hostToken = uuidv4();

    const room = {
      pin,
      hostToken,
      quizId,
      userId,
      quizTitle: (typeof quizTitle === 'string' && quizTitle.trim()) ? quizTitle.trim() : 'Live Interactive Quiz',
      questions,
      state: 'LOBBY', // 'LOBBY' | 'QUESTION_ACTIVE' | 'QUESTION_ENDED' | 'FINAL_PODIUM'
      currentQuestionIndex: -1,
      questionStartTime: 0,
      players: new Map(), // playerId -> Player
      currentAnswers: new Map(), // playerId -> Answer
      createdAt: Date.now(),
      lastActivityAt: Date.now()
    };

    this.rooms.set(pin, room);
    return { pin, hostToken, quizTitle: room.quizTitle, totalQuestions: questions.length, quizId };
  }

  getRoom(pin) {
    if (!pin) return null;
    const cleanPin = typeof pin === 'string' ? pin.trim() : String(pin).trim();
    return this.rooms.get(cleanPin) || null;
  }

  validateHost(pin, hostToken) {
    if (!pin || !hostToken || typeof pin !== 'string' || typeof hostToken !== 'string') return false;
    const room = this.getRoom(pin);
    if (!room || !room.hostToken) return false;
    const bufA = Buffer.from(room.hostToken, 'utf8');
    const bufB = Buffer.from(hostToken, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  joinPlayer(pin, socketId, rawNickname) {
    const cleanPin = typeof pin === 'string' ? pin.trim() : (pin != null ? String(pin).trim() : '');
    const room = this.getRoom(cleanPin);
    if (!room) {
      throw new Error('Room not found. Please check the 6-digit PIN.');
    }

    if (room.state === 'FINAL_PODIUM') {
      throw new Error('This quiz session has already finished.');
    }

    // Sanitize nickname (OWASP A03 / XSS defense)
    const nickStr = (typeof rawNickname === 'string' ? rawNickname : (rawNickname != null ? String(rawNickname) : 'Player'));
    let sanitized = nickStr
      .replace(/[<>'"/\\&;]/g, '')
      .trim()
      .substring(0, 20);

    if (sanitized.length < 2) {
      sanitized = `Player_${String(socketId).substring(0, 4)}`;
    }

    // Check for duplicate nickname
    let uniqueName = sanitized;
    let counter = 1;
    const existingNames = Array.from(room.players.values()).map(p => p.nickname.toLowerCase());
    while (existingNames.includes(uniqueName.toLowerCase())) {
      uniqueName = `${sanitized} (${counter++})`;
    }

    const playerId = socketId;
    const player = {
      id: playerId,
      nickname: uniqueName,
      score: 0,
      streak: 0,
      answers: []
    };

    room.players.set(playerId, player);
    this.playerToRoom.set(socketId, { pin, playerId });
    room.lastActivityAt = Date.now();

    return {
      player,
      roomState: room.state,
      quizTitle: room.quizTitle,
      totalPlayers: room.players.size,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length
    };
  }

  removePlayer(socketId) {
    const mapping = this.playerToRoom.get(socketId);
    if (!mapping) return null;

    const { pin, playerId } = mapping;
    this.playerToRoom.delete(socketId);

    const room = this.getRoom(pin);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (player) {
      room.players.delete(playerId);
      return { pin, player, totalPlayers: room.players.size };
    }
    return null;
  }

  startNextQuestion(pin, hostToken) {
    if (!this.validateHost(pin, hostToken)) {
      throw new Error('Unauthorized: Host permissions required.');
    }

    const room = this.getRoom(pin);
    if (!room) throw new Error('Room not found.');

    const nextIndex = room.currentQuestionIndex + 1;
    if (nextIndex >= room.questions.length) {
      room.state = 'FINAL_PODIUM';
      return { isFinished: true, podium: this.getTopContestants(pin, 100) };
    }

    room.currentQuestionIndex = nextIndex;
    room.state = 'QUESTION_ACTIVE';
    room.questionStartTime = Date.now();
    room.currentAnswers.clear();
    room.lastActivityAt = Date.now();

    const q = room.questions[nextIndex];

    // Return public question payload (WITHOUT correctOptionIndex for security)
    return {
      isFinished: false,
      questionIndex: nextIndex,
      totalQuestions: room.questions.length,
      questionText: q.questionText,
      options: q.options,
      timeLimitSeconds: q.timeLimitSeconds,
      startedAt: room.questionStartTime,
      totalPlayers: room.players.size
    };
  }

  submitAnswer(pin, playerId, selectedOption) {
    const room = this.getRoom(pin);
    if (!room) throw new Error('Room not found.');

    if (room.state !== 'QUESTION_ACTIVE') {
      throw new Error('No question is currently accepting answers.');
    }

    const player = room.players.get(playerId);
    if (!player) throw new Error('Player not registered in this room.');

    // Atomic duplicate check (R3 Red Team Defense)
    if (room.currentAnswers.has(playerId)) {
      return { alreadyAnswered: true };
    }

    const optIndex = parseInt(selectedOption, 10);
    if (isNaN(optIndex) || optIndex < 0 || optIndex > 3) {
      throw new Error('Invalid option index. Must be 0, 1, 2, or 3.');
    }

    const responseTimeMs = Date.now() - room.questionStartTime;
    const currentQ = room.questions[room.currentQuestionIndex];
    const isCorrect = optIndex === currentQ.correctOptionIndex;

    // Count how many correct answers have arrived so far for this question (arrival order)
    let correctOrder = 1;
    if (isCorrect) {
      for (const ans of room.currentAnswers.values()) {
        if (ans.isCorrect) {
          correctOrder++;
        }
      }
    }

    const maxPoints = currentQ.pointsPossible || 10;
    const pointsAwarded = calculateScore(
      isCorrect,
      responseTimeMs,
      currentQ.timeLimitSeconds,
      maxPoints,
      correctOrder
    );

    // Track previous question score and accumulate new total score
    const previousScore = player.score;
    player.score += pointsAwarded;
    if (isCorrect) {
      player.streak += 1;
    } else {
      player.streak = 0;
    }

    const answerRecord = {
      questionId: currentQ.id,
      questionIndex: room.currentQuestionIndex,
      selectedOption: optIndex,
      responseTimeMs,
      pointsAwarded,
      previousScore,
      totalScore: player.score,
      isCorrect,
      correctOrder: isCorrect ? correctOrder : null
    };

    player.answers.push(answerRecord);
    room.currentAnswers.set(playerId, answerRecord);
    room.lastActivityAt = Date.now();

    const answeredCount = room.currentAnswers.size;
    const totalPlayers = room.players.size;
    const allAnswered = totalPlayers > 0 && answeredCount >= totalPlayers;

    return {
      alreadyAnswered: false,
      pointsAwarded,
      previousScore,
      totalScore: player.score,
      isCorrect,
      correctOrder: isCorrect ? correctOrder : null,
      answeredCount,
      totalPlayers,
      allAnswered
    };
  }

  endQuestion(pin, hostToken) {
    if (!this.validateHost(pin, hostToken)) {
      throw new Error('Unauthorized: Host permissions required.');
    }

    const room = this.getRoom(pin);
    if (!room) throw new Error('Room not found.');

    room.state = 'QUESTION_ENDED';
    const currentQ = room.questions[room.currentQuestionIndex];

    // Compute distribution [count0, count1, count2, count3]
    const distribution = [0, 0, 0, 0];
    for (const ans of room.currentAnswers.values()) {
      if (ans.selectedOption >= 0 && ans.selectedOption <= 3) {
        distribution[ans.selectedOption]++;
      }
    }

    // Sort all players by cumulative score descending.
    // Tie-breaker: total response time across all questions ascending (faster cumulative response earns higher rank).
    const sortedPlayers = Array.from(room.players.values()).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aTotalTime = a.answers.reduce((acc, ans) => acc + (ans.responseTimeMs || 0), 0);
      const bTotalTime = b.answers.reduce((acc, ans) => acc + (ans.responseTimeMs || 0), 0);
      return aTotalTime - bTotalTime;
    });

    // Build per-player results map (for both answered and non-answered players)
    const playerResults = {};
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      const ans = room.currentAnswers.get(player.id);
      const rank = i + 1;
      const previousScore = ans ? ans.previousScore : player.score;
      const pointsAwarded = ans ? ans.pointsAwarded : 0;

      playerResults[player.id] = {
        answered: Boolean(ans),
        selectedOption: ans ? ans.selectedOption : null,
        isCorrect: ans ? ans.isCorrect : false,
        pointsAwarded,
        previousScore,
        score: player.score,
        streak: player.streak,
        rank,
        totalParticipants: sortedPlayers.length,
        correctOptionIndex: currentQ.correctOptionIndex,
        correctOrder: ans?.correctOrder || null,
        responseTimeMs: ans?.responseTimeMs || 0
      };
    }

    // Full ranked leaderboard of all participants after this question
    const leaderboard = sortedPlayers.map((p, idx) => {
      const lastAns = p.answers.find(a => a.questionIndex === room.currentQuestionIndex);
      const lastPointsAwarded = lastAns ? lastAns.pointsAwarded : 0;
      const previousScore = lastAns ? lastAns.previousScore : (p.score - lastPointsAwarded);
      return {
        rank: idx + 1,
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        previousScore,
        lastPointsAwarded,
        lastAnswerCorrect: lastAns ? lastAns.isCorrect : false,
        streak: p.streak,
        responseTimeMs: lastAns ? lastAns.responseTimeMs : null,
        correctOrder: lastAns ? lastAns.correctOrder : null
      };
    });

    return {
      questionIndex: room.currentQuestionIndex,
      correctOptionIndex: currentQ.correctOptionIndex,
      explanation: currentQ.explanation,
      distribution,
      totalAnswers: room.currentAnswers.size,
      totalPlayers: room.players.size,
      leaderboard,
      top5Leaderboard: leaderboard.slice(0, 5), // Backwards compatibility
      playerResults
    };
  }

  getTopContestants(pin, limit = 100) {
    const room = this.getRoom(pin);
    if (!room) return [];

    const sorted = Array.from(room.players.values()).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aTotalTime = a.answers.reduce((acc, ans) => acc + (ans.responseTimeMs || 0), 0);
      const bTotalTime = b.answers.reduce((acc, ans) => acc + (ans.responseTimeMs || 0), 0);
      return aTotalTime - bTotalTime;
    });

    const sliced = limit ? sorted.slice(0, limit) : sorted;

    return sliced.map((p, idx) => {
      const lastAns = p.answers.find(a => a.questionIndex === room.currentQuestionIndex);
      const lastPointsAwarded = lastAns ? lastAns.pointsAwarded : 0;
      const previousScore = lastAns ? lastAns.previousScore : (p.score - lastPointsAwarded);
      return {
        rank: idx + 1,
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        previousScore,
        lastPointsAwarded,
        lastAnswerCorrect: lastAns ? lastAns.isCorrect : false,
        streak: p.streak,
        responseTimeMs: lastAns ? lastAns.responseTimeMs : null,
        correctOrder: lastAns ? lastAns.correctOrder : null
      };
    });
  }

  quitGame(pin, hostToken) {
    if (!this.validateHost(pin, hostToken)) {
      throw new Error('Unauthorized: Host permissions required.');
    }
    const room = this.getRoom(pin);
    if (!room) throw new Error('Room not found.');

    room.state = 'FINAL_PODIUM';
    room.lastActivityAt = Date.now();
    const podium = this.getTopContestants(pin, 100);
    return { isFinished: true, podium };
  }

  updateRoomTimer(pin, hostToken, timeLimitSeconds) {
    if (!this.validateHost(pin, hostToken)) {
      throw new Error('Unauthorized: Host permissions required.');
    }
    const room = this.getRoom(pin);
    if (!room) throw new Error('Room not found.');

    const seconds = Math.max(5, Math.min(300, parseInt(timeLimitSeconds, 10) || 20));
    room.questions.forEach(q => {
      q.timeLimitSeconds = seconds;
    });
    room.lastActivityAt = Date.now();

    return { success: true, timeLimitSeconds: seconds };
  }

  // Auto cleanup rooms older than 4 hours
  cleanupOldRooms() {
    const now = Date.now();
    for (const [pin, room] of this.rooms.entries()) {
      if (now - room.lastActivityAt > 4 * 60 * 60 * 1000) {
        this.rooms.delete(pin);
      }
    }
  }
}

module.exports = new RoomManager();
