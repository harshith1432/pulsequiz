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
import HostAuthModal from './components/host/HostAuthModal';
import { getTheme } from './utils/themes';

export default function App() {
  const { socket, connected, localIp } = useSocket();

  // Host User State hydrated from localStorage
  const [hostUser, setHostUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pulsequiz_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Mode: Default is strictly 'PLAYER' (Enter PIN & join room screen) for all visitors
  const [mode, setMode] = useState(() => {
    const path = window.location.pathname;
    const token = localStorage.getItem('pulsequiz_token');
    if (path.startsWith('/host') && token) {
      return 'HOST';
    }
    return 'PLAYER';
  });

  // 10 Aesthetic Creamy Themes: Default 'cream_espresso'
  const [activeThemeId, setActiveThemeId] = useState('cream_espresso');
  const currentTheme = getTheme(activeThemeId);

  // Synchronize entire document body background and text with current theme
  useEffect(() => {
    document.body.style.backgroundColor = currentTheme.bgHex;
    document.body.style.color = currentTheme.textPrimaryHex;
  }, [currentTheme]);

  // Effective Public URL for Cloudflare Tunnel (fallback to origin if already on tunnel)
  const [publicUrl, setPublicUrl] = useState(() => {
    if (window.location.origin.includes('cloudflare') || window.location.origin.includes('trycloudflare.com')) {
      return window.location.origin;
    }
    return 'https://appreciation-computed-dame-lucas.trycloudflare.com';
  });

  // Fetch configured public URL from backend on mount
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.publicUrl) {
          setPublicUrl(data.publicUrl.trim().replace(/\/+$/, ''));
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

  const handleSelectTheme = (newThemeId) => {
    setActiveThemeId(newThemeId);
    if (socket && room) {
      socket.emit('room:set_theme', { pin: room.pin, themeId: newThemeId });
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

    // Theme sync across all connected clients
    socket.on('room:theme_updated', (data) => {
      if (data.themeId) {
        setActiveThemeId(data.themeId);
      }
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

    // Both: Round ended & answer revealed on timeout
    socket.on('round:ended', (resData) => {
      setRoundResult(resData);
      setLeaderboard(resData.leaderboard || resData.top5Leaderboard || []);

      if (mode === 'PLAYER') {
        const myResult = (resData.playerResults && socket.id) ? resData.playerResults[socket.id] : null;
        if (myResult) {
          setPlayerInfo(prev => ({
            ...prev,
            score: myResult.score,
            previousScore: myResult.previousScore,
            streak: myResult.streak,
            lastPointsAwarded: myResult.pointsAwarded,
            lastAnswerCorrect: myResult.isCorrect,
            answered: myResult.answered,
            selectedOption: myResult.selectedOption,
            rank: myResult.rank,
            totalParticipants: myResult.totalParticipants,
            correctOrder: myResult.correctOrder
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
      socket.off('room:theme_updated');
      socket.off('question:active');
      socket.off('round:ended');
      socket.off('game:finished');
    };
  }, [socket, mode]);

  // ---------------- FULLSCREEN & KEYBOARD CONTROLS ----------------
  const enterFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
  };

  const exitFullscreen = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  // Auto-enable fullscreen when running quiz
  useEffect(() => {
    if (mode === 'HOST' && ['ARENA', 'ROUND_LEADERBOARD'].includes(hostState)) {
      enterFullscreen();
    }
  }, [mode, hostState]);

  // Keyboard navigation & Escape key early finish
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Do not hijack typing in inputs or textareas
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      // Escape key: Close quiz immediately and declare winners based on current rankings
      if (e.key === 'Escape') {
        if (mode === 'HOST' && ['ARENA', 'ROUND_LEADERBOARD', 'LOBBY'].includes(hostState) && socket && room) {
          e.preventDefault();
          exitFullscreen();
          socket.emit('host:quit_game', { pin: room.pin, hostToken: room.hostToken }, (res) => {
            if (res && res.success) {
              setPodium(res.podium || []);
              setHostState('FINAL_PODIUM');
            }
          });
        }
        return;
      }

      // Arrow and Enter controls: Move to next question / reveal answer
      if (['ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'Enter'].includes(e.key)) {
        if (mode === 'HOST') {
          if (hostState === 'LOBBY') {
            e.preventDefault();
            enterFullscreen();
            handleStartGame();
          } else if (hostState === 'ARENA') {
            e.preventDefault();
            enterFullscreen();
            if (!roundResult) {
              // Reveal answer early if timer is ticking
              handleRevealAnswer();
            } else {
              // Advance to leaderboard or next question
              handleNextQuestion();
            }
          } else if (hostState === 'ROUND_LEADERBOARD') {
            e.preventDefault();
            enterFullscreen();
            handleNextQuestion();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, hostState, socket, room, roundResult]);

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
    enterFullscreen();
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
    enterFullscreen();
    socket.emit('host:next_question', { pin: room.pin, hostToken: room.hostToken });
  };

  const handleQuitGame = () => {
    if (!socket || !room) return;
    exitFullscreen();
    socket.emit('host:quit_game', { pin: room.pin, hostToken: room.hostToken }, (res) => {
      if (res && res.success) {
        setPodium(res.podium || []);
        setHostState('FINAL_PODIUM');
      }
    });
  };

  const handleUpdateTimer = (timeLimitSeconds) => {
    if (!socket || !room) return;
    socket.emit('host:update_timer', {
      pin: room.pin,
      hostToken: room.hostToken,
      timeLimitSeconds
    });
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

  const handlePlayNextRound = async () => {
    if (!room?.quizId) {
      handleHostReset();
      return;
    }
    const token = localStorage.getItem('pulsequiz_token');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          quizId: room.quizId,
          pickFresh: true,
          sampleCount: room.totalQuestions || 20
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create next round room');
      setRoom(data);
      setHostState('LOBBY');
      setPlayers([]);
      setCurrentQuestion(null);
      setRoundResult(null);
      setLeaderboard([]);
      setPodium([]);
    } catch (err) {
      alert('Failed to launch next round: ' + err.message);
    }
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

  // ---------------- AUTH HANDLERS ----------------
  const handleAuthSuccess = (user) => {
    setHostUser(user);
    setMode('HOST');
    window.history.replaceState({}, '', '/host');
  };

  const handleHostLogout = () => {
    localStorage.removeItem('pulsequiz_token');
    localStorage.removeItem('pulsequiz_user');
    setHostUser(null);
    setMode('PLAYER');
    window.history.replaceState({}, '', '/');
  };

  const handleGoToHost = () => {
    const token = localStorage.getItem('pulsequiz_token');
    if (token && hostUser) {
      setMode('HOST');
      window.history.replaceState({}, '', '/host');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  // Helper to switch mode between Host and Mobile Player
  const toggleMode = () => {
    const newMode = mode === 'HOST' ? 'PLAYER' : 'HOST';
    if (newMode === 'HOST' && !localStorage.getItem('pulsequiz_token')) {
      setIsAuthModalOpen(true);
      return;
    }
    setMode(newMode);
    if (newMode === 'PLAYER') {
      window.history.replaceState({}, '', '/');
    } else {
      window.history.replaceState({}, '', '/host');
    }
  };

  // ---------------- RENDER ----------------

  // Player Mode (Default landing view for all visitors)
  if (mode === 'PLAYER') {
    return (
      <div
        className="h-full min-h-screen transition-colors duration-300"
        style={{ backgroundColor: currentTheme.bgHex, color: currentTheme.textPrimaryHex }}
      >
        {playerState === 'JOIN' && (
          <PlayerJoin
            onJoinRoom={handlePlayerJoin}
            error={joinError}
            activeThemeId={activeThemeId}
            hostUser={hostUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onGoToHost={handleGoToHost}
            onHostLogout={handleHostLogout}
          />
        )}

        {playerState === 'LOBBY' && (
          <PlayerLobby
            player={playerInfo}
            roomInfo={playerRoomInfo}
            activeThemeId={activeThemeId}
          />
        )}

        {playerState === 'QUESTION' && activePlayerQuestion && (
          <AnswerPad
            question={activePlayerQuestion}
            activeThemeId={activeThemeId}
            onSelectAnswer={handlePlayerSubmit}
          />
        )}

        {playerState === 'FEEDBACK' && (
          <PlayerFeedback
            roundResult={playerRoundResult}
            playerStats={playerInfo}
            activeThemeId={activeThemeId}
          />
        )}

        {playerState === 'PODIUM' && (
          <FinalPodium
            podium={podium}
            activeThemeId={activeThemeId}
            onReset={() => {
              setPlayerState('JOIN');
              setPlayerInfo(null);
            }}
          />
        )}

        {/* Host Authentication & Registration Modal */}
        <HostAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
          activeThemeId={activeThemeId}
        />
      </div>
    );
  }

  // Host Mode (Restricted to logged-in hosts)
  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bgHex, color: currentTheme.textPrimaryHex }}
    >
      {hostState === 'DASHBOARD' && (
        <HostDashboard
          onRoomCreated={handleRoomCreated}
          activeThemeId={activeThemeId}
          onSelectTheme={handleSelectTheme}
          hostUser={hostUser}
          onLogout={handleHostLogout}
          onBackToPlayer={() => {
            setMode('PLAYER');
            window.history.replaceState({}, '', '/');
          }}
        />
      )}

      {hostState === 'LOBBY' && room && (
        <HostLobby
          room={room}
          players={players}
          publicUrl={publicUrl}
          activeThemeId={activeThemeId}
          onSelectTheme={handleSelectTheme}
          onStartGame={handleStartGame}
          onUpdatePublicUrl={handleUpdatePublicUrl}
          onUpdateTimer={handleUpdateTimer}
        />
      )}

      {hostState === 'ARENA' && currentQuestion && (
        <HostArena
          question={currentQuestion}
          totalQuestions={room?.totalQuestions || 5}
          answeredCount={answeredCount}
          totalPlayers={players.length}
          roundResult={roundResult}
          activeThemeId={activeThemeId}
          onSelectTheme={handleSelectTheme}
          onRevealAnswer={handleRevealAnswer}
          onNextQuestion={handleShowLeaderboard}
          onQuitGame={handleQuitGame}
        />
      )}

      {hostState === 'ROUND_LEADERBOARD' && (
        <RoundLeaderboard
          leaderboard={leaderboard}
          questionIndex={currentQuestion?.questionIndex || 0}
          totalQuestions={room?.totalQuestions || 5}
          activeThemeId={activeThemeId}
          onSelectTheme={handleSelectTheme}
          onNextQuestion={handleNextQuestion}
          onQuitGame={handleQuitGame}
        />
      )}

      {hostState === 'FINAL_PODIUM' && (
        <FinalPodium
          podium={podium}
          activeThemeId={activeThemeId}
          onSelectTheme={handleSelectTheme}
          onReset={handleHostReset}
          quizId={room?.quizId}
          onPlayNextRound={room?.quizId ? handlePlayNextRound : null}
        />
      )}
    </div>
  );
}
