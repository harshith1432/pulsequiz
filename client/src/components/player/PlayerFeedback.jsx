import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Flame, Trophy, HelpCircle, Zap, ListOrdered, ChevronUp, ChevronDown } from 'lucide-react';
import { sound } from '../../utils/sound';
import { getTheme } from '../../utils/themes';

const OPTION_NAMES = [
  { label: 'Option A (Red ▲)', color: 'text-red-700 bg-red-100 border-red-300' },
  { label: 'Option B (Blue ◆)', color: 'text-blue-700 bg-blue-100 border-blue-300' },
  { label: 'Option C (Yellow ●)', color: 'text-amber-800 bg-amber-100 border-amber-300' },
  { label: 'Option D (Green ■)', color: 'text-emerald-800 bg-emerald-100 border-emerald-300' }
];

export default function PlayerFeedback({ roundResult, playerStats, activeThemeId }) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const theme = getTheme(activeThemeId);

  const answered = playerStats?.answered;
  const isCorrect = playerStats?.lastAnswerCorrect;
  const points = playerStats?.lastPointsAwarded || 0;
  const previousScore = playerStats?.previousScore || 0;
  const streak = playerStats?.streak || 0;
  const totalScore = playerStats?.score || 0;
  const rank = playerStats?.rank;
  const totalParticipants = playerStats?.totalParticipants || 0;
  const correctOrder = playerStats?.correctOrder;

  const correctIdx = roundResult?.correctOptionIndex ?? 0;
  const correctMeta = OPTION_NAMES[correctIdx] || OPTION_NAMES[0];
  const leaderboard = roundResult?.leaderboard || roundResult?.top5Leaderboard || [];

  useEffect(() => {
    if (answered && isCorrect) {
      sound.playCorrect();
    } else {
      sound.playIncorrect();
    }
  }, [answered, isCorrect]);

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-4 md:p-6 text-center transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Top Banner */}
      <div className="pt-2">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.timerColor }}>
          Question Result • Round Standings
        </span>
      </div>

      {/* Center Outcome Card */}
      <div className="my-auto space-y-4 max-w-sm mx-auto w-full">
        <div
          className="inline-flex p-4 rounded-3xl border shadow-sm animate-bounce-short transition-colors duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          {!answered ? (
            <Clock size={56} className="text-amber-500" />
          ) : isCorrect ? (
            <CheckCircle2 size={56} className="text-emerald-500 fill-emerald-100" />
          ) : (
            <XCircle size={56} className="text-rose-500 fill-rose-100" />
          )}
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.textPrimaryHex }}>
            {!answered
              ? "TIME'S UP!"
              : isCorrect
                ? 'CORRECT!'
                : 'INCORRECT'}
          </h1>
          <p className="text-xs font-semibold mt-0.5" style={{ color: theme.textSecondaryHex }}>
            {!answered
              ? 'No answer submitted in time'
              : isCorrect
                ? correctOrder === 1
                  ? '⚡ You answered #1 (First to answer correctly)!'
                  : 'Fast response rewarded!'
                : 'No points earned on this question'}
          </p>
          <div className="text-2xl font-mono font-black mt-1.5" style={{ color: theme.textPrimaryHex }}>
            +{points} <span className="text-sm font-sans" style={{ color: theme.textSecondaryHex }}>/ 10 pts</span>
          </div>
        </div>

        {/* Revealed Correct Answer Card */}
        <div
          className="p-3 rounded-2xl border text-xs space-y-1 transition-colors duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: theme.textSecondaryHex }}>
            Correct Answer
          </span>
          <div className={`py-1.5 px-3 rounded-xl border font-bold text-xs ${correctMeta.color}`}>
            {correctMeta.label}
          </div>
          {roundResult?.explanation && (
            <p className="text-[11px] pt-1 italic" style={{ color: theme.textSecondaryHex }}>
              "{roundResult.explanation}"
            </p>
          )}
        </div>

        {/* Previous Score + Round Points = Total Score Breakdown */}
        <div
          className="p-3 rounded-2xl border space-y-2 transition-colors duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          <div className="flex items-center justify-between text-xs px-1" style={{ color: theme.textSecondaryHex }}>
            <span>Previous Score:</span>
            <span className="font-mono font-bold" style={{ color: theme.textPrimaryHex }}>{previousScore} pts</span>
          </div>
          <div className="flex items-center justify-between text-xs px-1" style={{ color: theme.textSecondaryHex }}>
            <span>This Question:</span>
            <span className={`font-mono font-bold ${points > 0 ? 'text-emerald-600' : ''}`} style={{ color: points > 0 ? undefined : theme.textSecondaryHex }}>
              +{points} pts
            </span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between font-bold text-sm px-1" style={{ borderColor: theme.borderHex }}>
            <span style={{ color: theme.textPrimaryHex }}>New Total Score:</span>
            <span className="font-mono text-emerald-600 text-base">{totalScore} pts</span>
          </div>
        </div>

        {/* Current Rank & Streak Badges */}
        <div className="flex items-center justify-center gap-2">
          {rank && (
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold shadow-xs"
              style={{
                backgroundColor: theme.innerBoxHex,
                borderColor: theme.borderHex,
                color: theme.timerColor
              }}
            >
              <Trophy size={14} style={{ color: theme.timerColor }} /> Ranked #{rank} {totalParticipants > 0 ? `of ${totalParticipants}` : ''}
            </div>
          )}

          {streak > 1 && (
            <div
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs"
              style={{
                backgroundColor: theme.innerBoxHex,
                borderColor: theme.borderHex,
                color: theme.timerColor
              }}
            >
              <Flame size={14} className="fill-amber-500 text-amber-500" /> {streak} Streak
            </div>
          )}
        </div>

        {/* Toggle Live Leaderboard on mobile */}
        {leaderboard.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold shadow-xs transition hover:opacity-85 cursor-pointer"
              style={{
                backgroundColor: theme.cardHex,
                borderColor: theme.borderHex,
                color: theme.textPrimaryHex
              }}
            >
              <ListOrdered size={14} />
              <span>{showLeaderboard ? 'Hide Standings' : 'View Top Rankings'}</span>
              {showLeaderboard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showLeaderboard && (
              <div
                className="mt-2 p-2.5 rounded-2xl border space-y-1.5 text-left max-h-48 overflow-y-auto"
                style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider block px-1" style={{ color: theme.textSecondaryHex }}>
                  Current Standings
                </span>
                {leaderboard.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border"
                    style={{
                      backgroundColor: p.id === playerStats?.id ? theme.cardHex : 'transparent',
                      borderColor: p.id === playerStats?.id ? theme.timerColor : 'transparent',
                      color: theme.textPrimaryHex,
                      fontWeight: p.id === playerStats?.id ? 'bold' : 'normal'
                    }}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="w-5 font-bold font-mono" style={{ color: theme.timerColor }}>#{idx + 1}</span>
                      <span className="truncate">{p.nickname}</span>
                      {p.id === playerStats?.id && (
                        <span className="text-[9px] text-white px-1 rounded" style={{ backgroundColor: theme.timerColor }}>You</span>
                      )}
                    </div>
                    <span className="font-mono font-bold shrink-0" style={{ color: theme.textPrimaryHex }}>
                      {p.score} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pb-3 text-xs font-medium animate-pulse" style={{ color: theme.textSecondaryHex }}>
        Waiting for host to start next question...
      </div>
    </div>
  );
}
