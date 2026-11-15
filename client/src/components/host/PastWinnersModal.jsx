import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Calendar, Users, X, Clock, Award, Sparkles, Hash } from 'lucide-react';
import { getTheme } from '../../utils/themes';

export default function PastWinnersModal({
  isOpen,
  onClose,
  quiz,
  activeThemeId
}) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);

  const theme = getTheme(activeThemeId);

  useEffect(() => {
    if (!isOpen || !quiz?.id) return;

    setIsLoading(true);
    setError(null);
    setActiveSessionIndex(0);

    const token = localStorage.getItem('pulsequiz_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    fetch(`/api/quizzes/${quiz.id}/winners`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.sessions) {
          setSessions(data.sessions);
        } else {
          setSessions([]);
        }
      })
      .catch(err => {
        console.error('Failed to load past winners:', err);
        setError('Failed to load past winners. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, quiz]);

  if (!isOpen || !quiz) return null;

  const currentSession = sessions[activeSessionIndex] || null;

  const getRankBadge = (rank) => {
    if (rank === 1) return { icon: '🥇', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (rank === 2) return { icon: '🥈', bg: 'bg-slate-200 text-slate-800 border-slate-300' };
    if (rank === 3) return { icon: '🥉', bg: 'bg-amber-50 text-amber-900 border-amber-200' };
    return { icon: `#${rank}`, bg: 'bg-stone-100 text-stone-700 border-stone-200' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300"
        style={{
          backgroundColor: theme.cardHex,
          borderColor: theme.borderHex,
          color: theme.textPrimaryHex
        }}
      >
        {/* Header */}
        <div
          className="p-6 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: theme.borderHex }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs"
              style={{ backgroundColor: `${theme.timerColor}20`, color: theme.timerColor }}
            >
              <Trophy size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ backgroundColor: theme.innerBoxHex, color: theme.timerColor }}>
                  Hall of Fame
                </span>
                <span className="text-xs font-semibold" style={{ color: theme.textSecondaryHex }}>
                  {sessions.length} {sessions.length === 1 ? 'Game Session' : 'Game Sessions'} Played
                </span>
              </div>
              <h2 className="text-xl font-black line-clamp-1 mt-0.5" style={{ color: theme.textPrimaryHex }}>
                {quiz.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border hover:opacity-80 transition cursor-pointer"
            style={{
              backgroundColor: theme.innerBoxHex,
              borderColor: theme.borderHex,
              color: theme.textSecondaryHex
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: theme.timerColor, borderTopColor: 'transparent' }} />
              <p className="text-xs font-semibold" style={{ color: theme.textSecondaryHex }}>Loading past winners...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-500 space-y-2">
              <p className="font-bold text-sm">{error}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div
              className="py-12 px-6 rounded-2xl border border-dashed text-center space-y-3"
              style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: theme.cardHex, color: theme.timerColor }}
              >
                <Award size={28} />
              </div>
              <h3 className="font-black text-base" style={{ color: theme.textPrimaryHex }}>
                No Past Game Sessions Yet
              </h3>
              <p className="text-xs max-w-md mx-auto" style={{ color: theme.textSecondaryHex }}>
                This classroom quiz has not been played in a live room yet. Once you host a room and participants play, the <strong>Top 10 Winners</strong> of every session will be permanently recorded here!
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Session Selector (if multiple games were played) */}
              {sessions.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {sessions.map((sess, idx) => {
                    const isSelected = activeSessionIndex === idx;
                    const dateFormatted = new Date(sess.playedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    });
                    return (
                      <button
                        key={sess.id || idx}
                        type="button"
                        onClick={() => setActiveSessionIndex(idx)}
                        className="px-3.5 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? theme.timerColor : theme.innerBoxHex,
                          color: isSelected ? '#FFFFFF' : theme.textPrimaryHex,
                          borderColor: isSelected ? theme.timerColor : theme.borderHex
                        }}
                      >
                        <Calendar size={12} />
                        <span>Game #{sessions.length - idx} ({dateFormatted})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Current Session Meta Card */}
              {currentSession && (
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3"
                  style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
                >
                  <div className="flex items-center gap-4 text-xs font-semibold" style={{ color: theme.textSecondaryHex }}>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} style={{ color: theme.timerColor }} />
                      {new Date(currentSession.playedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Hash size={14} style={{ color: theme.timerColor }} />
                      Room PIN: <strong style={{ color: theme.textPrimaryHex }}>{currentSession.roomPin}</strong>
                    </span>
                  </div>

                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border"
                    style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
                  >
                    <Users size={13} style={{ color: theme.timerColor }} />
                    {currentSession.totalPlayers || currentSession.winners?.length || 0} Total Players
                  </span>
                </div>
              )}

              {/* Top 10 Winners List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: theme.timerColor }}>
                    🏆 Top 10 Podium Champions
                  </h4>
                  <span className="text-[11px]" style={{ color: theme.textSecondaryHex }}>
                    Ranked by final speed-weighted points
                  </span>
                </div>

                {(!currentSession?.winners || currentSession.winners.length === 0) ? (
                  <div className="py-6 text-center text-xs" style={{ color: theme.textSecondaryHex }}>
                    No participant scores recorded for this session.
                  </div>
                ) : (
                  currentSession.winners.slice(0, 10).map((winner, wIdx) => {
                    const rankNum = winner.rank || (wIdx + 1);
                    const badge = getRankBadge(rankNum);
                    const isPodium = rankNum <= 3;

                    return (
                      <div
                        key={wIdx}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                          isPodium ? 'shadow-xs font-bold' : ''
                        }`}
                        style={{
                          backgroundColor: isPodium ? theme.cardHex : theme.innerBoxHex,
                          borderColor: rankNum === 1 ? theme.timerColor : theme.borderHex
                        }}
                      >
                        {/* Rank Badge & Nickname */}
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-sm shrink-0 ${badge.bg}`}
                          >
                            {badge.icon}
                          </span>
                          <div>
                            <span className="text-sm font-black" style={{ color: theme.textPrimaryHex }}>
                              {winner.nickname}
                            </span>
                            {rankNum === 1 && (
                              <span className="ml-2 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                👑 Champion
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Points */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-black font-mono" style={{ color: theme.timerColor }}>
                            {winner.score?.toLocaleString() || 0}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondaryHex }}>
                            pts
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex items-center justify-end shrink-0"
          style={{ borderColor: theme.borderHex }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border text-xs font-extrabold transition hover:opacity-80 cursor-pointer"
            style={{
              backgroundColor: theme.innerBoxHex,
              borderColor: theme.borderHex,
              color: theme.textPrimaryHex
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
