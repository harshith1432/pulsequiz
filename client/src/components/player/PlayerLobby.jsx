import React from 'react';
import { User, Sparkles, CheckCircle2 } from 'lucide-react';

export default function PlayerLobby({ player, roomInfo }) {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="text-center pt-6">
        <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
          PulseQuiz Arena
        </span>
        <h2 className="text-xl font-black text-white mt-1">
          {roomInfo?.quizTitle || 'Live Interactive Quiz'}
        </h2>
      </div>

      {/* Center Avatar & Status */}
      <div className="my-auto text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/40 animate-pulse">
            <span className="text-4xl font-black text-white uppercase">
              {player.nickname ? player.nickname.charAt(0) : 'P'}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white shadow-lg">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {player.nickname}
          </h1>
          <p className="text-xs font-semibold text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Connected to Room {roomInfo?.pin}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#151D2F] border border-[#232E48] max-w-xs mx-auto">
          <p className="text-xs text-slate-300 font-medium">
            👀 <strong>Look at the big screen!</strong><br />
            When the host starts, 4 color buttons will appear here to tap your answer.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-500 pb-4">
        Keep this screen open. Get ready to react fast!
      </div>
    </div>
  );
}
