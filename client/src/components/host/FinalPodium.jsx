import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Download, RefreshCw } from 'lucide-react';
import { sound } from '../../utils/sound';
import ThemeSelector from '../common/ThemeSelector';
import { getTheme } from '../../utils/themes';

export default function FinalPodium({ podium, activeThemeId, onSelectTheme, onReset, quizId, onPlayNextRound }) {
  const theme = getTheme(activeThemeId);

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
    <div
      className="min-h-screen flex flex-col justify-between p-4 md:p-8 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Header Banner */}
      <div
        className="flex items-center justify-between max-w-4xl mx-auto w-full border-b pb-4 transition-colors duration-300"
        style={{ borderColor: theme.borderHex }}
      >
        <div>
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-1"
            style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.timerColor }}
          >
            <Trophy size={13} style={{ color: theme.timerColor }} /> Grand Finale
          </div>
          <h1 className="text-2xl md:text-3xl font-black" style={{ color: theme.textPrimaryHex }}>
            Top 10 Contestants
          </h1>
        </div>

        {onSelectTheme && (
          <ThemeSelector
            activeThemeId={activeThemeId}
            onSelectTheme={onSelectTheme}
          />
        )}
      </div>

      {/* 3D Olympic Podium for Top 3 */}
      <div className="my-auto py-8 max-w-4xl mx-auto w-full">
        <div className="flex items-end justify-center gap-3 md:gap-6 px-4">
          {/* 2nd Place */}
          {top2 ? (
            <div className="flex-1 flex flex-col items-center">
              <div className="mb-2 text-center animate-bounce-short">
                <span className="text-2xl">🥈</span>
                <h4 className="font-bold text-sm md:text-base truncate max-w-[120px]" style={{ color: theme.textPrimaryHex }}>
                  {top2.nickname}
                </h4>
                <p className="text-xs font-mono font-bold" style={{ color: theme.textSecondaryHex }}>
                  {top2.score.toLocaleString()} pts
                </p>
              </div>
              <div
                className="w-full h-36 md:h-44 rounded-t-3xl border-t-2 flex items-center justify-center shadow-md transition-colors duration-300"
                style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
              >
                <span className="text-4xl md:text-5xl font-black font-mono opacity-40" style={{ color: theme.textPrimaryHex }}>
                  2
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 opacity-20 h-28 rounded-t-3xl" style={{ backgroundColor: theme.innerBoxHex }} />
          )}

          {/* 1st Place (Champion) */}
          {top1 ? (
            <div className="flex-1 flex flex-col items-center z-10">
              <div className="mb-2 text-center">
                <Crown size={32} className="text-amber-500 fill-amber-400 mx-auto animate-bounce" />
                <h3 className="font-black text-base md:text-xl truncate max-w-[150px]" style={{ color: theme.textPrimaryHex }}>
                  {top1.nickname}
                </h3>
                <p className="text-sm font-mono font-black" style={{ color: theme.timerColor }}>
                  {top1.score.toLocaleString()} pts
                </p>
              </div>
              <div
                className="w-full h-52 md:h-64 rounded-t-3xl border-t-2 flex items-center justify-center shadow-lg transition-colors duration-300"
                style={{ backgroundColor: theme.cardHex, borderColor: theme.timerColor, boxShadow: `0 10px 30px ${theme.borderHex}` }}
              >
                <span className="text-6xl md:text-7xl font-black font-mono opacity-30" style={{ color: theme.timerColor }}>
                  1
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 opacity-20 h-40 rounded-t-3xl" style={{ backgroundColor: theme.innerBoxHex }} />
          )}

          {/* 3rd Place */}
          {top3 ? (
            <div className="flex-1 flex flex-col items-center">
              <div className="mb-2 text-center animate-bounce-short">
                <span className="text-2xl">🥉</span>
                <h4 className="font-bold text-sm md:text-base truncate max-w-[120px]" style={{ color: theme.textPrimaryHex }}>
                  {top3.nickname}
                </h4>
                <p className="text-xs font-mono font-bold" style={{ color: theme.textSecondaryHex }}>
                  {top3.score.toLocaleString()} pts
                </p>
              </div>
              <div
                className="w-full h-28 md:h-36 rounded-t-3xl border-t-2 flex items-center justify-center shadow-md transition-colors duration-300"
                style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
              >
                <span className="text-4xl md:text-5xl font-black font-mono opacity-40" style={{ color: theme.textPrimaryHex }}>
                  3
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 opacity-20 h-24 rounded-t-3xl" style={{ backgroundColor: theme.innerBoxHex }} />
          )}
        </div>

        {/* Top 4 to 10 Table */}
        {restTop10.length > 0 && (
          <div
            className="mt-8 border rounded-3xl p-5 shadow-xs transition-colors duration-300"
            style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
          >
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: theme.textSecondaryHex }}>
              Contestants Ranked 4 - 10
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {restTop10.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-2xl border text-xs font-medium"
                  style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-6 h-6 rounded-lg border flex items-center justify-center font-bold shadow-xs"
                      style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
                    >
                      #{player.rank}
                    </span>
                    <span className="font-bold" style={{ color: theme.textPrimaryHex }}>{player.nickname}</span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: theme.timerColor }}>
                    {player.score.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        className="flex items-center justify-center gap-3 pt-4 border-t max-w-2xl mx-auto w-full transition-colors duration-300 flex-wrap"
        style={{ borderColor: theme.borderHex }}
      >
        <button
          onClick={handleExportJson}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold shadow-xs transition hover:opacity-90"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
        >
          <Download size={14} /> Export Results (JSON)
        </button>

        {onPlayNextRound && (
          <button
            onClick={onPlayNextRound}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-white text-xs font-black shadow-md transition transform hover:scale-[1.02] cursor-pointer`}
            title="Launch a new game with different questions from the bank that were not asked yet!"
          >
            <RefreshCw size={14} className="animate-spin-slow" /> Play Next Round (Fresh Questions)
          </button>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold shadow-xs transition hover:opacity-90"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
        >
          <RefreshCw size={14} /> Back to Dashboard
        </button>
      </div>
    </div>
  );
}
