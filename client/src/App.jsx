import React, { useState, useEffect } from 'react';
import { useSocket } from './context/SocketContext';
import HostDashboard from './components/host/HostDashboard';
import HostLobby from './components/host/HostLobby';
import HostArena from './components/host/HostArena';
import RoundLeaderboard from './components/host/RoundLeaderboard';
import FinalPodium from './components/host/FinalPodium';

import PlayerJoin from './components/player/PlayerJoin';
import PlayerLobby from './components/player/PlayerLobby';
import AnswerPad from './components/player/AnswerPad';
import PlayerFeedback from './components/player/PlayerFeedback';

export default function App() {
  const { socket, connected, localIp } = useSocket();

  // Mode: 'HOST' or 'PLAYER'
  const [mode, setMode] = useState(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path.startsWith('/play') || params.has('pin')) {
      return 'PLAYER';
    }
    return 'HOST';
  });

  // Effective Public URL for Cloudflare Tunnel or local LAN
  const [publicUrl, setPublicUrl] = useState(() => {
    return window.location.origin;
  });

  // Fetch configured public URL from backend
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.publicUrl) {
          setPublicUrl(data.publicUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Update public URL handler
  const handleUpdatePublicUrl = async (newUrl) => {
    try {
      const res = await fetch('/api/config/public-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicUrl: newUrl })
      });
      const data = await res.json();
      if (data.publicUrl) {
        setPublicUrl(data.publicUrl);
      }
    } catch (err) {
      console.error('Error updating public url:', err);
    }
  };

  // ---------------- HOST STATE ----------------
  // 'DASHBOARD' | 'LOBBY' | 'ARENA' | 'ROUND_LEADERBOARD' | 'FINAL_PODIUM'
  const [hostState, setHostState] = useState('DASHBOARD');
  const [room, setRoom] = useState(null); // { pin, hostToken, quizTitle, totalQuestions }
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [roundResult, setRoundResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [podium, setPodium] = useState([]);

  // ---------------- PLAYER STATE ----------------
  // 'JOIN' | 'LOBBY' | 'QUESTION' | 'FEEDBACK' | 'PODIUM'
  const [playerState, setPlayerState] = useState('JOIN');
  const [playerInfo, setPlayerInfo] = useState(null); // { id, nickname, score, streak }
  const [playerRoomInfo, setPlayerRoomInfo] = useState(null);
  const [activePlayerQuestion, setActivePlayerQuestion] = useState(null);
  const [playerRoundResult, setPlayerRoundResult] = useState(null);
  const [joinError, setJoinError] = useState(null);

  // ---------------- SOCKET LISTENERS ----------------
  useEffect(() => {
    if (!socket) return;

    // Host: Players list updated in lobby
    socket.on('room:players_updated', (data) => {
      setPlayers(data.players || []);
    });

    // Host: Live answer counter
    socket.on('answer:count_update', (data) => {
      setAnsweredCount(data.answeredCount);
    });

    // Both: Active question broadcasted
    socket.on('question:active', (qData) => {
      setAnsweredCount(0);
      setRoundResult(null);

      if (mode === 'HOST') {
        setCurrentQuestion(qData);
        setHostState('ARENA');
      } else {
        setActivePlayerQuestion(qData);
        setPlayerRoundResult(null);
        setPlayerState('QUESTION');
      }
    });

    // Both: Round ended & answer revealed
    socket.on('round:ended', (resData) => {
      setRoundResult(resData);
      setLeaderboard(resData.top5Leaderboard || []);

      if (mode === 'PLAYER') {
        const myResult = (resData.playerResults && socket.id) ? resData.playerResults[socket.id] : null;
        if (myResult) {
          setPlayerInfo(prev => ({
            ...prev,
            score: myResult.score,
            streak: myResult.streak,
            lastPointsAwarded: myResult.pointsAwarded,
            lastAnswerCorrect: myResult.isCorrect,
            answered: myResult.answered,
            selectedOption: myResult.selectedOption,
            rank: myResult.rank
          }));
        } else {
          setPlayerInfo(prev => ({
            ...prev,
            answered: false,
            lastPointsAwarded: 0,
            lastAnswerCorrect: false
          }));
        }
        setPlayerRoundResult(resData);
        setPlayerState('FEEDBACK');
      }
    });

    // Both: Game finished & podium celebration
    socket.on('game:finished', (finalData) => {
      setPodium(finalData.podium || []);
      if (mode === 'HOST') {
        setHostState('FINAL_PODIUM');
      } else {
        setPlayerState('PODIUM');
      }
    });

    return () => {
      socket.off('room:players_updated');
      socket.off('answer:count_update');
      socket.off('question:active');
      socket.off('round:ended');
      socket.off('game:finished');
    };
  }, [socket, mode]);

  // ---------------- HOST HANDLERS ----------------
  const handleRoomCreated = (roomData) => {
    setRoom(roomData);
    if (roomData.publicUrl) {
      setPublicUrl(roomData.publicUrl);
    }
    // Connect host socket
    if (socket) {
      socket.emit('host:connect', { pin: roomData.pin, hostToken: roomData.hostToken }, (res) => {
        if (res.success) {
          setHostState('LOBBY');
        }
      });
    }
  };

  const handleStartGame = () => {
    if (!socket || !room) return;
    socket.emit('host:next_question', { pin: room.pin, hostToken: room.hostToken });
  };

  const handleRevealAnswer = () => {
    if (!socket || !room) return;
    socket.emit('host:reveal_answer', { pin: room.pin, hostToken: room.hostToken });
  };

  const handleShowLeaderboard = () => {
    setHostState('ROUND_LEADERBOARD');
  };

  const handleNextQuestion = () => {
    if (!socket || !room) return;
    socket.emit('host:next_question', { pin: room.pin, hostToken: room.hostToken });
  };

  const handleHostReset = () => {
    setHostState('DASHBOARD');
    setRoom(null);
    setPlayers([]);
    setCurrentQuestion(null);
    setRoundResult(null);
    setLeaderboard([]);
    setPodium([]);
  };

  // ---------------- PLAYER HANDLERS ----------------
  const handlePlayerJoin = (pin, nickname) => {
    if (!socket) return;
    setJoinError(null);

    socket.emit('player:join', { pin, nickname }, (res) => {
      if (res && res.success) {
        setPlayerInfo(res.player);
        setPlayerRoomInfo({
          pin,
          quizTitle: res.quizTitle,
          totalQuestions: res.totalQuestions
        });

        if (res.roomState === 'QUESTION_ACTIVE') {
          setPlayerState('QUESTION');
        } else {
          setPlayerState('LOBBY');
        }
      } else {
        setJoinError(res?.error || 'Failed to join room. Verify the 6-digit PIN.');
      }
    });
  };

  const handlePlayerSubmit = (selectedOption) => {
    if (!socket || !playerRoomInfo) return;

    socket.emit('player:submit_answer', {
      pin: playerRoomInfo.pin,
      selectedOption
    }, (res) => {
      if (res && res.success) {
        setPlayerInfo(prev => ({
          ...prev,
          answered: true,
          selectedOption
        }));
      }
    });
  };

  // Helper to switch mode between Host and Mobile Player for quick testing
  const toggleMode = () => {
    const newMode = mode === 'HOST' ? 'PLAYER' : 'HOST';
    setMode(newMode);
    if (newMode === 'PLAYER') {
      window.history.replaceState({}, '', '/play');
    } else {
      window.history.replaceState({}, '', '/');
    }
  };

  // ---------------- RENDER ----------------

  // Player Mode
  if (mode === 'PLAYER') {
    return (
      <div className="h-full min-h-screen bg-[#0B0F19] text-white">
        {/* Floating Switcher for testing */}
        <div className="fixed top-2 right-2 z-50 opacity-40 hover:opacity-100 transition">
          <button
            onClick={toggleMode}
            className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700"
          >
            Switch to Host View
          </button>
        </div>

        {playerState === 'JOIN' && (
          <PlayerJoin onJoinRoom={handlePlayerJoin} error={joinError} />
        )}

        {playerState === 'LOBBY' && (
          <PlayerLobby player={playerInfo} roomInfo={playerRoomInfo} />
        )}

        {playerState === 'QUESTION' && activePlayerQuestion && (
          <AnswerPad
            question={activePlayerQuestion}
            onSelectAnswer={handlePlayerSubmit}
          />
        )}

        {playerState === 'FEEDBACK' && (
          <PlayerFeedback
            roundResult={playerRoundResult}
            playerStats={playerInfo}
          />
        )}

        {playerState === 'PODIUM' && (
          <FinalPodium
            podium={podium}
            onReset={() => {
              setPlayerState('JOIN');
              setPlayerInfo(null);
            }}
          />
        )}
      </div>
    );
  }

  // Host Mode
  return (
    <div className="min-h-screen bg-[#0B0F19] text-white">
      {/* Floating Switcher */}
      <div className="fixed top-3 right-4 z-50">
        <button
          onClick={toggleMode}
          className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700 backdrop-blur-md shadow-lg transition"
        >
          📱 Switch to Mobile View
        </button>
      </div>

      {hostState === 'DASHBOARD' && (
        <HostDashboard onRoomCreated={handleRoomCreated} />
      )}

      {hostState === 'LOBBY' && room && (
        <HostLobby
          room={room}
          players={players}
          publicUrl={publicUrl}
          onStartGame={handleStartGame}
          onUpdatePublicUrl={handleUpdatePublicUrl}
        />
      )}

      {hostState === 'ARENA' && currentQuestion && (
        <HostArena
          question={currentQuestion}
          totalQuestions={room?.totalQuestions || 5}
          answeredCount={answeredCount}
          totalPlayers={players.length}
          roundResult={roundResult}
          onRevealAnswer={handleRevealAnswer}
          onNextQuestion={handleShowLeaderboard}
        />
      )}

      {hostState === 'ROUND_LEADERBOARD' && (
        <RoundLeaderboard
          leaderboard={leaderboard}
          questionIndex={currentQuestion?.questionIndex || 0}
          totalQuestions={room?.totalQuestions || 5}
          onNextQuestion={handleNextQuestion}
        />
      )}

      {hostState === 'FINAL_PODIUM' && (
        <FinalPodium
          podium={podium}
          onReset={handleHostReset}
        />
      )}
    </div>
  );
}
