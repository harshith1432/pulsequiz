import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Medal, Download, RefreshCw, Star, Flame } from 'lucide-react';
import { sound } from '../../utils/sound';

export default function FinalPodium({ podium, onReset }) {
  useEffect(() => {
    sound.playFanfare();

    // Multistage confetti celebration
    const duration = 4.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 }
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 }
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const top1 = podium[0] || null;
  const top2 = podium[1] || null;
  const top3 = podium[2] || null;
  const restTop10 = podium.slice(3, 10);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(podium, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'PulseQuiz_Final_Top10_Results.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-4 md:p-8">
      {/* Header Banner */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Trophy size={14} /> Grand Finale Showcase
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
          Top 10 Contestants
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Final tournament standings based on speed and accuracy
        </p>
      </div>

      {/* 3D Olympic Podium for Top 3 */}
      <div className="my-auto py-8 max-w-4xl mx-auto w-full">
        <div className="flex items-end justify-center gap-3 md:gap-6 px-4">
          {/* 2nd Place */}
          {top2 ? (
            <div className="flex-1 flex flex-col items-center">
              <div className="mb-2 text-center animate-bounce-short">
                <span className="text-2xl">🥈</span>
                <h4 className="font-bold text-white text-sm md:text-base truncate max-w-[120px]">
                  {top2.nickname}
                </h4>
                <p className="text-xs font-mono font-bold text-slate-300">
                  {top2.score.toLocaleString()} pts
                </p>
              </div>
              <div className="w-full h-36 md:h-44 rounded-t-2xl bg-gradient-to-t from-slate-800 to-slate-600 border-t-2 border-slate-400 flex items-center justify-center shadow-xl">
                <span className="text-4xl md:text-5xl font-black text-slate-300/40 font-mono">
                  2
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 opacity-20 h-28 bg-slate-800 rounded-t-2xl" />
          )}

          {/* 1st Place (Champion) */}
          {top1 ? (
            <div className="flex-1 flex flex-col items-center z-10">
              <div className="mb-2 text-center">
                <Crown size={32} className="text-yellow-400 fill-yellow-400 mx-auto animate-bounce" />
                <h3 className="font-black text-white text-base md:text-xl truncate max-w-[150px] drop-shadow-md">
                  {top1.nickname}
                </h3>
                <p className="text-sm font-mono font-extrabold text-amber-300">
                  {top1.score.toLocaleString()} pts
                </p>
              </div>
              <div className="w-full h-52 md:h-64 rounded-t-2xl bg-gradient-to-t from-amber-700 via-amber-600 to-yellow-500 border-t-2 border-yellow-300 flex items-center justify-center shadow-2xl shadow-yellow-500/30">
                <span className="text-6xl md:text-7xl font-black text-black/30 font-mono">
                  1
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 opacity-20 h-40 bg-slate-800 rounded-t-2xl" />
          )}

          {/* 3rd Place */}
          {top3 ? (
            <div className="flex-1 flex flex-col items-center">
              <div className="mb-2 text-center animate-bounce-short">
                <span className="text-2xl">🥉</span>
                <h4 className="font-bold text-white text-sm md:text-base truncate max-w-[120px]">
                  {top3.nickname}
                </h4>
                <p className="text-xs font-mono font-bold text-slate-300">
                  {top3.score.toLocaleString()} pts
                </p>
              </div>
              <div className="w-full h-28 md:h-36 rounded-t-2xl bg-gradient-to-t from-amber-950 to-orange-800 border-t-2 border-orange-500 flex items-center justify-center shadow-xl">
                <span className="text-4xl md:text-5xl font-black text-orange-400/30 font-mono">
                  3
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 opacity-20 h-24 bg-slate-800 rounded-t-2xl" />
          )}
        </div>

        {/* Top 4 to 10 Table */}
        {restTop10.length > 0 && (
          <div className="mt-8 bg-[#151D2F] border border-[#232E48] rounded-2xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
              Contestants Ranked 4 - 10
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {restTop10.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0F19] border border-[#232E48] text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                      #{player.rank}
                    </span>
                    <span className="font-bold text-white">{player.nickname}</span>
                  </div>
                  <span className="font-mono font-bold text-indigo-400">
                    {player.score.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-[#232E48] max-w-xl mx-auto w-full">
        <button
          onClick={handleExportJson}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#151D2F] hover:bg-slate-800 border border-[#232E48] text-xs font-bold text-slate-200 transition"
        >
          <Download size={14} /> Export Results (JSON)
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
        >
          <RefreshCw size={14} /> Host Another Quiz
        </button>
      </div>
    </div>
  );
}
