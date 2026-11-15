import React, { useState, useEffect } from 'react';
import { Trophy, Flame, ArrowRight, Flag, Maximize, Minimize, Keyboard, Medal, Crown } from 'lucide-react';
import ThemeSelector from '../common/ThemeSelector';
import { getTheme } from '../../utils/themes';

const TOP_3_CONFIG = [
  {
    rank: 1,
    title: '1st Place',
    medal: '🥇',
    borderColor: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    badgeColor: 'bg-amber-500 text-white',
    glow: '0 8px 24px rgba(245, 158, 11, 0.25)'
  },
  {
    rank: 2,
    title: '2nd Place',
    medal: '🥈',
    borderColor: '#94A3B8',
    bgColor: 'rgba(148, 163, 184, 0.08)',
    badgeColor: 'bg-slate-400 text-white',
    glow: '0 4px 16px rgba(148, 163, 184, 0.2)'
  },
  {
    rank: 3,
    title: '3rd Place',
    medal: '🥉',
    borderColor: '#D97706',
    bgColor: 'rgba(217, 119, 6, 0.08)',
    badgeColor: 'bg-amber-700 text-white',
    glow: '0 4px 16px rgba(217, 119, 6, 0.2)'
  }
];

export default function RoundLeaderboard({
  leaderboard,
  questionIndex,
  totalQuestions,
  activeThemeId,
  onSelectTheme,
  onNextQuestion,
  onQuitGame
}) {
  const isLastQuestion = questionIndex + 1 >= totalQuestions;
  const theme = getTheme(activeThemeId);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        onNextQuestion();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onQuitGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextQuestion, onQuitGame]);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  // Divide into Top 3 and Top 4-10
  const top3 = leaderboard.slice(0, 3);
  const restOfTop10 = leaderboard.slice(3, 10);
  const totalShown = Math.min(10, leaderboard.length);

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-4 md:p-8 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Top Header */}
      <div
        className="flex items-center justify-between border-b pb-4 max-w-4xl mx-auto w-full transition-colors duration-300"
        style={{ borderColor: theme.borderHex }}
      >
        <div>
          <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color: theme.timerColor }}>
            Round Standings • Question {questionIndex + 1} of {totalQuestions}
          </span>
          <h1 className="text-2xl md:text-3xl font-black" style={{ color: theme.textPrimaryHex }}>
            Leaderboard (Top 3 + Top 10)
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <ThemeSelector
            activeThemeId={activeThemeId}
            onSelectTheme={onSelectTheme}
          />
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
          {!isLastQuestion && (
            <button
              type="button"
              onClick={onQuitGame}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black transition shadow-2xs cursor-pointer"
              title="Finish quiz now and reveal final podium"
            >
              <Flag size={13} className="text-rose-600" />
              <span>End Quiz</span>
            </button>
          )}
          <button
            onClick={onNextQuestion}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-white font-extrabold text-sm shadow-md transition transform hover:-translate-y-0.5 cursor-pointer`}
          >
            <span>{isLastQuestion ? 'Reveal Final Podium 🏆' : 'Next Question'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Leaderboard Content */}
      <div className="my-auto py-6 max-w-4xl mx-auto w-full space-y-5">
        {leaderboard.length === 0 ? (
          <div className="text-center py-16 font-medium" style={{ color: theme.textSecondaryHex }}>
            No player scores recorded yet.
          </div>
        ) : (
          <>
            {/* Top 3 Podium Highlights Grid */}
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: theme.timerColor }}>
                  <Crown size={14} style={{ color: theme.timerColor }} />
                  Top 3 Podium Leaders
                </span>
                <span className="text-[11px] font-semibold" style={{ color: theme.textSecondaryHex }}>
                  Cumulative Points from Q1 to Q{questionIndex + 1}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {top3.map((player, idx) => {
                  const cfg = TOP_3_CONFIG[idx] || TOP_3_CONFIG[2];
                  return (
                    <div
                      key={player.id || idx}
                      className="p-5 rounded-3xl border-2 flex flex-col justify-between relative shadow-sm transition transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: theme.cardHex,
                        borderColor: cfg.borderColor,
                        boxShadow: cfg.glow
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl filter drop-shadow-sm select-none">
                          {cfg.medal}
                        </span>
                        <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${cfg.badgeColor}`}>
                          Rank #{idx + 1}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-black text-lg md:text-xl truncate" style={{ color: theme.textPrimaryHex }}>
                          {player.nickname}
                        </h3>

                        {player.streak > 1 && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md mt-1 border"
                            style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.timerColor }}
                          >
                            <Flame size={12} style={{ color: theme.timerColor, fill: theme.timerColor }} />
                            {player.streak} Streak
                          </span>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t flex items-baseline justify-between" style={{ borderColor: theme.borderHex }}>
                        <div className="text-2xl font-black font-mono tracking-tight" style={{ color: theme.textPrimaryHex }}>
                          {player.score.toLocaleString()} <span className="text-xs font-sans font-bold" style={{ color: theme.textSecondaryHex }}>pts</span>
                        </div>
                        {player.lastPointsAwarded > 0 && (
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            +{player.lastPointsAwarded}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 4 to 10 Rankings Section */}
            {restOfTop10.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1 pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondaryHex }}>
                    Rankings 4 – 10
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: theme.textSecondaryHex }}>
                    {restOfTop10.length} {restOfTop10.length === 1 ? 'Contestant' : 'Contestants'}
                  </span>
                </div>

                <div className="space-y-2">
                  {restOfTop10.map((player, idx) => {
                    const actualRank = idx + 4;
                    return (
                      <div
                        key={player.id || idx}
                        className="px-4 py-3 rounded-2xl border flex items-center justify-between shadow-2xs transition hover:scale-[1.005]"
                        style={{
                          backgroundColor: theme.cardHex,
                          borderColor: theme.borderHex
                        }}
                      >
                        <div className="flex items-center gap-3.5">
                          <span
                            className="w-8 h-8 rounded-xl border flex items-center justify-center font-black text-xs font-mono"
                            style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.textSecondaryHex }}
                          >
                            #{actualRank}
                          </span>
                          <div>
                            <span className="font-extrabold text-sm md:text-base" style={{ color: theme.textPrimaryHex }}>
                              {player.nickname}
                            </span>
                            {player.streak > 1 && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 border"
                                style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.timerColor }}
                              >
                                <Flame size={10} style={{ color: theme.timerColor, fill: theme.timerColor }} />
                                {player.streak}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-2.5">
                          {player.lastPointsAwarded > 0 && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              +{player.lastPointsAwarded}
                            </span>
                          )}
                          <span className="text-base font-black font-mono" style={{ color: theme.textPrimaryHex }}>
                            {player.score.toLocaleString()} <span className="text-[10px] font-sans" style={{ color: theme.textSecondaryHex }}>pts</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info & Keyboard Navigation Helper */}
      <div className="text-center text-xs max-w-xl mx-auto font-medium space-y-1" style={{ color: theme.textSecondaryHex }}>
        <div>
          Showing Top {totalShown} of {leaderboard.length} contestants • Dynamic speed-weighted scoring
        </div>
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold opacity-80 pt-1">
          <Keyboard size={13} style={{ color: theme.timerColor }} />
          <span>Press <strong style={{ color: theme.textPrimaryHex }}>[ ➔ ] [ Enter ] [ ↑ ] [ ↓ ]</strong> for next question</span>
          <span>•</span>
          <span><strong style={{ color: theme.textPrimaryHex }}>[ Esc ]</strong> to end quiz</span>
        </div>
      </div>
    </div>
  );
}
