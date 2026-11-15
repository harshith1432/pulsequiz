import React from 'react';
import { Trophy, Flame, ArrowRight, Award } from 'lucide-react';

const RANK_BADGES = [
  { rank: 1, medal: '🥇', bg: 'from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-300' },
  { rank: 2, medal: '🥈', bg: 'from-slate-400/20 to-slate-500/10 border-slate-400/40 text-slate-200' },
  { rank: 3, medal: '🥉', bg: 'from-amber-700/20 to-orange-600/10 border-amber-700/40 text-amber-500' },
  { rank: 4, medal: '4', bg: 'from-indigo-600/10 to-slate-800 border-[#232E48] text-slate-300' },
  { rank: 5, medal: '5', bg: 'from-indigo-600/10 to-slate-800 border-[#232E48] text-slate-300' }
];

export default function RoundLeaderboard({
  leaderboard,
  questionIndex,
  totalQuestions,
  onNextQuestion
}) {
  const isLastQuestion = questionIndex + 1 >= totalQuestions;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-4 md:p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#232E48] pb-4 max-w-4xl mx-auto w-full">
        <div>
          <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
            Round Standings
          </span>
          <h1 className="text-2xl font-black text-white">Top Players</h1>
        </div>

        <button
          onClick={onNextQuestion}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
        >
          <span>{isLastQuestion ? 'Reveal Final Podium 🏆' : 'Next Question'}</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Main Leaderboard Cards */}
      <div className="my-auto py-8 max-w-3xl mx-auto w-full space-y-3">
        {leaderboard.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-medium">
            No player scores recorded yet.
          </div>
        ) : (
          leaderboard.slice(0, 5).map((player, idx) => {
            const badge = RANK_BADGES[idx] || RANK_BADGES[3];
            return (
              <div
                key={player.id || idx}
                className={`p-4 md:p-5 rounded-2xl border bg-gradient-to-r ${badge.bg} flex items-center justify-between shadow-xl transition transform hover:scale-[1.01]`}
              >
                {/* Rank & Nickname */}
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center font-black text-lg">
                    {badge.medal}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-white text-base md:text-lg">
                      {player.nickname}
                    </h3>
                    {player.streak > 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md mt-0.5">
                        <Flame size={12} className="fill-amber-400" /> {player.streak} Streak
                      </span>
                    )}
                  </div>
                </div>

                {/* Score & Delta */}
                <div className="text-right">
                  <div className="text-xl md:text-2xl font-black font-mono text-white">
                    {player.score.toLocaleString()} <span className="text-xs text-slate-400 font-sans">pts</span>
                  </div>
                  {player.lastPointsAwarded > 0 && (
                    <span className="text-xs font-bold text-emerald-400">
                      +{player.lastPointsAwarded} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-500 max-w-md mx-auto">
        Speed and accuracy determine points. Every millisecond counts!
      </div>
    </div>
  );
}
