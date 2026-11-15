import React, { useEffect, useState, useRef } from 'react';
import { Clock, Users, ArrowRight, CheckCircle2, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../../utils/sound';

const OPTION_THEMES = [
  {
    bg: 'bg-red-600',
    border: 'border-red-500',
    glow: 'glow-red',
    shape: '▲',
    label: 'Option A'
  },
  {
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    glow: 'glow-blue',
    shape: '◆',
    label: 'Option B'
  },
  {
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    glow: 'glow-yellow',
    shape: '●',
    label: 'Option C'
  },
  {
    bg: 'bg-emerald-600',
    border: 'border-emerald-500',
    glow: 'glow-green',
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
  onRevealAnswer,
  onNextQuestion
}) {
  const [timeLeft, setTimeLeft] = useState(question.timeLimitSeconds || 20);
  const [isRevealed, setIsRevealed] = useState(Boolean(roundResult));
  const timerRef = useRef(null);

  useEffect(() => {
    setIsRevealed(Boolean(roundResult));
  }, [roundResult]);

  // Countdown timer effect
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

  // Timer runs until full timeout. Premature reveal disabled per requirements.

  const progressPercent = Math.max(0, (timeLeft / (question.timeLimitSeconds || 20)) * 100);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-4 md:p-8">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between border-b border-[#232E48] pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-extrabold text-sm">
            Question {question.questionIndex + 1} / {totalQuestions}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users size={16} className="text-indigo-400" />
            <span>
              <strong className="text-white">{answeredCount}</strong> / {totalPlayers} Answered
            </span>
          </div>
        </div>

        {/* Circular Countdown Timer */}
        <div className="flex items-center gap-3">
          {!isRevealed ? (
            <div className="flex items-center gap-2">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#1E293B"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={timeLeft <= 5 ? '#EF4444' : '#6366F1'}
                    strokeWidth="4"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * progressPercent) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className={`absolute text-base font-black font-mono ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                  {timeLeft}
                </span>
              </div>
              <button
                onClick={onRevealAnswer}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
              >
                Skip Timer
              </button>
            </div>
          ) : (
            <button
              onClick={onNextQuestion}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <span>View Leaderboard</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Question Display */}
      <div className="my-auto py-6 max-w-5xl mx-auto w-full text-center">
        <div className="p-8 md:p-12 rounded-3xl bg-[#151D2F] border border-[#232E48] shadow-2xl relative overflow-hidden">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">
            Select Your Color
          </span>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-tight">
            {question.questionText}
          </h2>

          {/* Explanation Banner when answer is revealed */}
          {isRevealed && roundResult?.explanation && (
            <div className="mt-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-sm max-w-2xl mx-auto flex items-center justify-center gap-2">
              <HelpCircle size={16} className="text-indigo-400 shrink-0" />
              <span>{roundResult.explanation}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Colored Option Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto w-full pb-4">
        {question.options.map((optText, optIdx) => {
          const theme = OPTION_THEMES[optIdx];
          const isCorrect = isRevealed && roundResult?.correctOptionIndex === optIdx;
          const isWrong = isRevealed && roundResult?.correctOptionIndex !== optIdx;
          const voteCount = roundResult?.distribution ? roundResult.distribution[optIdx] : 0;
          const totalAnswers = roundResult?.totalAnswers || 1;
          const votePercent = Math.round((voteCount / (totalAnswers || 1)) * 100);

          return (
            <div
              key={optIdx}
              className={`p-6 rounded-3xl border-2 transition-all duration-300 relative flex items-center justify-between overflow-hidden ${
                isRevealed
                  ? isCorrect
                    ? `${theme.bg} ${theme.border} text-white ring-4 ring-emerald-400 scale-[1.02] ${theme.glow}`
                    : 'bg-[#151D2F]/50 border-slate-800 text-slate-500 opacity-40'
                  : `${theme.bg} ${theme.border} text-white shadow-xl hover:brightness-110`
              }`}
            >
              {/* Option Shape & Text */}
              <div className="flex items-center gap-4 z-10">
                <span className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center text-xl font-black shadow-inner">
                  {theme.shape}
                </span>
                <span className="text-lg md:text-xl font-bold tracking-tight">
                  {optText}
                </span>
              </div>

              {/* Reveal Badge & Votes */}
              {isRevealed && (
                <div className="flex items-center gap-3 z-10">
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-black/30 font-mono">
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
                  className="absolute inset-y-0 left-0 bg-white/10 transition-all duration-1000 ease-out z-0"
                  style={{ width: `${votePercent}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
