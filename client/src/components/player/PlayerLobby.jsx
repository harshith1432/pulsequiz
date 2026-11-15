import React from 'react';
import { User, Sparkles, CheckCircle2 } from 'lucide-react';
import { getTheme } from '../../utils/themes';

export default function PlayerLobby({ player, roomInfo, activeThemeId }) {
  const theme = getTheme(activeThemeId);

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-6 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Top Header */}
      <div className="text-center pt-6">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.timerColor }}>
          PulseQuiz Live Arena
        </span>
        <h2 className="text-xl font-black mt-1" style={{ color: theme.textPrimaryHex }}>
          {roomInfo?.quizTitle || 'Live Interactive Quiz'}
        </h2>
      </div>

      {/* Center Avatar & Status */}
      <div className="my-auto text-center space-y-6">
        <div className="relative inline-block">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mx-auto shadow-md animate-pulse"
            style={{ backgroundColor: theme.timerColor }}
          >
            <span className="text-4xl font-black text-white uppercase">
              {player.nickname ? player.nickname.charAt(0) : 'P'}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white shadow-md">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.textPrimaryHex }}>
            {player.nickname}
          </h1>
          <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Connected to Room {roomInfo?.pin}
          </p>
        </div>

        <div
          className="p-4 rounded-3xl border max-w-xs mx-auto shadow-xs transition-colors duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          <p className="text-xs font-medium" style={{ color: theme.textPrimaryHex }}>
            👀 <strong>Look at the big screen!</strong><br />
            When the host starts, 4 color buttons will appear here to tap your answer.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] pb-4 font-medium" style={{ color: theme.textSecondaryHex }}>
        Keep this screen open. Get ready to react fast!
      </div>
    </div>
  );
}
