import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Flame, Trophy, HelpCircle } from 'lucide-react';
import { sound } from '../../utils/sound';

const OPTION_NAMES = [
  { label: 'Option A (Red ▲)', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  { label: 'Option B (Blue ◆)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { label: 'Option C (Yellow ●)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { label: 'Option D (Green ■)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
];

export default function PlayerFeedback({ roundResult, playerStats }) {
  const answered = playerStats?.answered;
  const isCorrect = playerStats?.lastAnswerCorrect;
  const points = playerStats?.lastPointsAwarded || 0;
  const streak = playerStats?.streak || 0;
  const totalScore = playerStats?.score || 0;
  const correctIdx = roundResult?.correctOptionIndex ?? 0;
  const correctMeta = OPTION_NAMES[correctIdx] || OPTION_NAMES[0];

  useEffect(() => {
    if (answered && isCorrect) {
      sound.playCorrect();
    } else {
      sound.playIncorrect();
    }
  }, [answered, isCorrect]);

  return (
    <div className={`min-h-screen flex flex-col justify-between p-6 text-white text-center ${
      !answered
        ? 'bg-gradient-to-b from-amber-950/80 via-[#0B0F19] to-[#0B0F19]'
        : isCorrect
          ? 'bg-gradient-to-b from-emerald-950 via-[#0B0F19] to-[#0B0F19]'
          : 'bg-gradient-to-b from-rose-950 via-[#0B0F19] to-[#0B0F19]'
    }`}>
      {/* Top Banner */}
      <div className="pt-6">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Timeout Reached • Round Result
        </span>
      </div>

      {/* Center Outcome Card */}
      <div className="my-auto space-y-5">
        <div className="inline-flex p-4 rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl animate-bounce-short">
          {!answered ? (
            <Clock size={64} className="text-amber-400" />
          ) : isCorrect ? (
            <CheckCircle2 size={64} className="text-emerald-400 fill-emerald-500/20" />
          ) : (
            <XCircle size={64} className="text-rose-400 fill-rose-500/20" />
          )}
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            {!answered
              ? "TIME'S UP!"
              : isCorrect
                ? 'CORRECT!'
                : 'INCORRECT'}
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {!answered
              ? 'No answer submitted in time'
              : isCorrect
                ? `Fast reaction time rewarded!`
                : 'Better luck on the next question!'}
          </p>
          <p className="text-xl font-mono font-black mt-2 text-white">
            +{points} Points
          </p>
        </div>

        {/* Revealed Correct Answer Card */}
        <div className="p-3.5 rounded-2xl bg-[#151D2F] border border-[#232E48] max-w-xs mx-auto text-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Correct Answer
          </span>
          <div className={`py-1.5 px-3 rounded-xl border font-bold text-xs ${correctMeta.color}`}>
            {correctMeta.label}
          </div>
          {roundResult?.explanation && (
            <p className="text-[11px] text-slate-400 pt-1 italic">
              "{roundResult.explanation}"
            </p>
          )}
        </div>

        {/* Streaks & Total Score */}
        <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
          {streak > 1 && (
            <div className="flex-1 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <div className="flex items-center justify-center gap-1 font-extrabold text-xs">
                <Flame size={14} className="fill-amber-400" /> {streak} Streak
              </div>
              <span className="text-[10px] text-amber-400/80">Streak active</span>
            </div>
          )}

          <div className="flex-1 p-3 rounded-2xl bg-[#151D2F] border border-[#232E48] text-white">
            <div className="font-extrabold text-sm font-mono">
              {totalScore.toLocaleString()} pts
            </div>
            <span className="text-[10px] text-slate-400">Total Score</span>
          </div>
        </div>

        {playerStats?.rank && (
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold shadow-md">
            <Trophy size={14} /> You are ranked #{playerStats.rank}!
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pb-6 text-xs text-slate-500 font-medium animate-pulse">
        👀 Look at the big screen for the top rankings...
      </div>
    </div>
  );
}
