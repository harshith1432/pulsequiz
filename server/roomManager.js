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

  createRoom(quizTitle, questions) {
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('At least one question is required to create a room.');
    }

    const pin = this.generatePin();
    const hostToken = uuidv4();

    const room = {
      pin,
      hostToken,
      quizTitle: quizTitle || 'Live Interactive Quiz',
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
    return { pin, hostToken, quizTitle: room.quizTitle, totalQuestions: questions.length };
  }

  getRoom(pin) {
    return this.rooms.get(pin) || null;
  }

  validateHost(pin, hostToken) {
    const room = this.getRoom(pin);
    if (!room) return false;
    return room.hostToken === hostToken;
  }

  joinPlayer(pin, socketId, rawNickname) {
    const room = this.getRoom(pin);
    if (!room) {
      throw new Error('Room not found. Please check the 6-digit PIN.');
    }

    if (room.state === 'FINAL_PODIUM') {
      throw new Error('This quiz session has already finished.');
    }

    // Sanitize nickname (OWASP A03 / XSS defense)
    let sanitized = (rawNickname || 'Player')
      .replace(/[<>'"/\\&;]/g, '')
      .trim()
      .substring(0, 20);

    if (sanitized.length < 2) {
      sanitized = `Player_${socketId.substring(0, 4)}`;
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
      return { isFinished: true, podium: this.getTopContestants(pin, 10) };
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

    const pointsAwarded = calculateScore(
      isCorrect,
      responseTimeMs,
      currentQ.timeLimitSeconds,
      currentQ.pointsPossible
    );

    // Update player stats
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
      isCorrect
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
      isCorrect,
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

    // Sort all players by cumulative score descending to compute current ranks
    const sortedPlayers = Array.from(room.players.values()).sort((a, b) => b.score - a.score);

    // Build per-player results map (for both answered and non-answered players)
    const playerResults = {};
    for (const player of sortedPlayers) {
      const ans = room.currentAnswers.get(player.id);
      const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;
      playerResults[player.id] = {
        answered: Boolean(ans),
        selectedOption: ans ? ans.selectedOption : null,
        isCorrect: ans ? ans.isCorrect : false,
        pointsAwarded: ans ? ans.pointsAwarded : 0,
        score: player.score,
        streak: player.streak,
        rank,
        correctOptionIndex: currentQ.correctOptionIndex
      };
    }

    // Get current top 5 leaderboard
    const top5 = this.getTopContestants(pin, 5);

    return {
      questionIndex: room.currentQuestionIndex,
      correctOptionIndex: currentQ.correctOptionIndex,
      explanation: currentQ.explanation,
      distribution,
      totalAnswers: room.currentAnswers.size,
      totalPlayers: room.players.size,
      top5Leaderboard: top5,
      playerResults
    };
  }

  getTopContestants(pin, limit = 10) {
    const room = this.getRoom(pin);
    if (!room) return [];

    const sorted = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted.map((p, idx) => {
      // Find points earned in the latest question
      const lastAns = p.answers.find(a => a.questionIndex === room.currentQuestionIndex);
      return {
        rank: idx + 1,
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        lastPointsAwarded: lastAns ? lastAns.pointsAwarded : 0,
        lastAnswerCorrect: lastAns ? lastAns.isCorrect : false
      };
    });
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
