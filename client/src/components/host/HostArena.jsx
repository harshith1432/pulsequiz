import React, { useEffect, useState, useRef } from 'react';
import { Clock, Users, ArrowRight, CheckCircle2, HelpCircle, Eye, Flag, Maximize, Minimize, Keyboard } from 'lucide-react';
import { sound } from '../../utils/sound';
import ThemeSelector from '../common/ThemeSelector';
import { getTheme } from '../../utils/themes';

const OPTION_THEMES = [
  {
    bg: 'bg-red-500 hover:bg-red-600',
    border: 'border-red-400',
    shape: '▲',
    label: 'Option A'
  },
  {
    bg: 'bg-blue-600 hover:bg-blue-700',
    border: 'border-blue-500',
    shape: '◆',
    label: 'Option B'
  },
  {
    bg: 'bg-amber-500 hover:bg-amber-600',
    border: 'border-amber-400',
    shape: '●',
    label: 'Option C'
  },
  {
    bg: 'bg-emerald-600 hover:bg-emerald-700',
    border: 'border-emerald-500',
    shape: '■',
    label: 'Option D'
  }
];

export default function HostArena({
  question,
  totalQuestions,
  answeredCount,
  totalPlayers,
  roundResult,
  activeThemeId,
  onSelectTheme,
  onRevealAnswer,
  onNextQuestion,
  onQuitGame
}) {
  const [timeLeft, setTimeLeft] = useState(question.timeLimitSeconds || 20);
  const [isRevealed, setIsRevealed] = useState(Boolean(roundResult));
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const timerRef = useRef(null);

  const theme = getTheme(activeThemeId);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  const [autoLeaderboardTimer, setAutoLeaderboardTimer] = useState(3);
  const autoAdvanceRef = useRef(null);

  useEffect(() => {
    setIsRevealed(Boolean(roundResult));
  }, [roundResult]);

  // Auto transition to Leaderboard 3 seconds after answer is revealed
  useEffect(() => {
    if (!isRevealed) {
      setAutoLeaderboardTimer(3);
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
      return;
    }

    setAutoLeaderboardTimer(3);
    autoAdvanceRef.current = setInterval(() => {
      setAutoLeaderboardTimer(prev => {
        if (prev <= 1) {
          clearInterval(autoAdvanceRef.current);
          onNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    };
  }, [isRevealed, onNextQuestion]);

  // Keyboard Navigation: Enter / Space / ArrowRight to advance; Esc to quit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isRevealed) {
          if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
          onNextQuestion();
        } else {
          onRevealAnswer();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onQuitGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, onNextQuestion, onRevealAnswer, onQuitGame]);

  // Countdown timer effect: Runs all the way to 0 (no premature auto-reveal)
  useEffect(() => {
    if (isRevealed) return;

    setTimeLeft(question.timeLimitSeconds || 20);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          onRevealAnswer();
          return 0;
        }
        if (prev <= 5) {
          sound.playWarn();
        } else {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [question, isRevealed]);

  const progressPercent = Math.max(0, (timeLeft / (question.timeLimitSeconds || 20)) * 100);

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-4 md:p-8 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Top Status Bar */}
      <div
        className="flex items-center justify-between border-b pb-4 max-w-5xl mx-auto w-full transition-colors duration-300"
        style={{ borderColor: theme.borderHex }}
      >
        <div className="flex items-center gap-3">
          <span
            className="px-3.5 py-1.5 rounded-xl border font-extrabold text-sm shadow-xs transition"
            style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.timerColor }}
          >
            Question {question.questionIndex + 1} / {totalQuestions}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.textSecondaryHex }}>
            <Users size={16} style={{ color: theme.timerColor }} />
            <span>
              <strong style={{ color: theme.textPrimaryHex }}>{answeredCount}</strong> / {totalPlayers} Answered
            </span>
          </div>
        </div>

        {/* Circular Countdown Timer & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <ThemeSelector
            activeThemeId={activeThemeId}
            onSelectTheme={onSelectTheme}
          />

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border hover:opacity-80 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
            style={{
              backgroundColor: isFullscreen ? `${theme.timerColor}20` : theme.cardHex,
              borderColor: isFullscreen ? theme.timerColor : theme.borderHex,
              color: isFullscreen ? theme.timerColor : theme.textPrimaryHex
            }}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen Mode'}
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            <span className="hidden md:inline">{isFullscreen ? 'Fullscreen' : 'Full Screen'}</span>
          </button>

          {!isRevealed ? (
            <>
              {/* Circular Countdown Timer */}
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={theme.borderHex}
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={timeLeft <= 5 ? '#EF4444' : theme.timerColor}
                    strokeWidth="4"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * progressPercent) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span
                  className="absolute text-base font-black font-mono"
                  style={{ color: timeLeft <= 5 ? '#EF4444' : theme.textPrimaryHex }}
                >
                  {timeLeft}
                </span>
              </div>

              {/* Reveal Answer Early Button */}
              <button
                type="button"
                onClick={onRevealAnswer}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition transform hover:scale-105 active:scale-95 cursor-pointer ${
                  answeredCount >= totalPlayers && totalPlayers > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
                title="Skip remaining time and immediately reveal correct answer and points"
              >
                <Eye size={14} className={answeredCount >= totalPlayers && totalPlayers > 0 ? 'text-white' : 'text-amber-600'} />
                <span>
                  {answeredCount >= totalPlayers && totalPlayers > 0
                    ? 'All Answered! Show Answer'
                    : 'Reveal Answer Now'}
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
                onNextQuestion();
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-white font-extrabold text-sm shadow-md transition transform hover:-translate-y-0.5 cursor-pointer`}
              title="View round leaderboard immediately"
            >
              <span>View Leaderboard ({autoLeaderboardTimer}s)</span>
              <ArrowRight size={16} />
            </button>
          )}

          {/* End Quiz & Get Top Rankers Button */}
          <button
            type="button"
            onClick={onQuitGame}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black transition shadow-2xs cursor-pointer"
            title="End quiz early and reveal final podium winners"
          >
            <Flag size={13} className="text-rose-600" />
            <span className="hidden sm:inline">End Quiz</span>
          </button>
        </div>
      </div>

      {/* Main Question Display */}
      <div className="my-auto py-6 max-w-5xl mx-auto w-full text-center">
        <div
          className="p-8 md:p-12 rounded-3xl border shadow-sm relative overflow-hidden transition-colors duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          <span className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: theme.timerColor }}>
            Select Your Color
          </span>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black leading-tight" style={{ color: theme.textPrimaryHex }}>
            {question.questionText}
          </h2>

          {/* Explanation Banner when answer is revealed */}
          {isRevealed && roundResult?.explanation && (
            <div
              className="mt-6 p-4 rounded-2xl border text-sm max-w-2xl mx-auto flex items-center justify-center gap-2 transition"
              style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
            >
              <HelpCircle size={16} style={{ color: theme.timerColor }} className="shrink-0" />
              <span>{roundResult.explanation}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Colored Option Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto w-full pb-4">
        {question.options.map((optText, optIdx) => {
          const optTheme = OPTION_THEMES[optIdx];
          const isCorrect = isRevealed && roundResult?.correctOptionIndex === optIdx;
          const isWrong = isRevealed && roundResult?.correctOptionIndex !== optIdx;
          const voteCount = roundResult?.distribution ? roundResult.distribution[optIdx] : 0;
          const totalAnswers = roundResult?.totalAnswers || 1;
          const votePercent = Math.round((voteCount / (totalAnswers || 1)) * 100);

          return (
            <div
              key={optIdx}
              className={`p-6 rounded-3xl border-2 transition-all duration-300 relative flex items-center justify-between overflow-hidden shadow-xs ${
                isRevealed
                  ? isCorrect
                    ? `${optTheme.bg} ${optTheme.border} text-white ring-4 ring-emerald-400 scale-[1.02] shadow-md`
                    : 'bg-stone-200/60 border-stone-300 text-stone-500 opacity-40'
                  : `${optTheme.bg} ${optTheme.border} text-white hover:brightness-105`
              }`}
            >
              {/* Option Shape & Text */}
              <div className="flex items-center gap-4 z-10">
                <span className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center text-xl font-black text-white shadow-inner">
                  {optTheme.shape}
                </span>
                <span className="text-lg md:text-xl font-bold tracking-tight">
                  {optText}
                </span>
              </div>

              {/* Reveal Badge & Votes */}
              {isRevealed && (
                <div className="flex items-center gap-3 z-10">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-black/25 text-white font-mono">
                    {voteCount} votes ({votePercent}%)
                  </span>
                  {isCorrect && (
                    <CheckCircle2 size={24} className="text-white fill-emerald-500" />
                  )}
                </div>
              )}

              {/* Animated distribution bar background during reveal */}
              {isRevealed && (
                <div
                  className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-1000 ease-out z-0"
                  style={{ width: `${votePercent}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Keyboard Navigation Helper Pill */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-center gap-3 text-[11px] font-semibold pt-1 pb-2 opacity-75" style={{ color: theme.textSecondaryHex }}>
        <Keyboard size={13} style={{ color: theme.timerColor }} />
        <span>Keys: <strong style={{ color: theme.textPrimaryHex }}>[ ➔ ] [ Enter ] [ ↑ ] [ ↓ ]</strong> to move to next question</span>
        <span>•</span>
        <span><strong style={{ color: theme.textPrimaryHex }}>[ Esc ]</strong> to end quiz & declare winners</span>
      </div>
    </div>
  );
}
