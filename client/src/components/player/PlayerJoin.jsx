import React, { useState, useEffect } from 'react';
import { Smartphone, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { sound } from '../../utils/sound';

export default function PlayerJoin({ onJoinRoom, error }) {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto-fill PIN from query params: /play?pin=123456
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin');
    if (pinParam) {
      setPin(pinParam.trim());
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) return;

    sound.playTap();
    setLoading(true);
    onJoinRoom(pin.trim(), nickname.trim());
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-4 transform hover:scale-105 transition">
            <Smartphone size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Pulse<span className="text-indigo-400">Quiz</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Enter PIN or scan QR code from the host's screen
          </p>
        </div>

        {/* Join Card */}
        <form onSubmit={handleSubmit} className="bg-[#151D2F] border border-[#232E48] rounded-3xl p-6 shadow-2xl space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Room PIN (6 Digits)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 583921"
              required
              className="w-full bg-[#0B0F19] border border-[#232E48] rounded-2xl px-4 py-3.5 text-center text-2xl font-black font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Your Nickname
            </label>
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Maverick"
              required
              className="w-full bg-[#0B0F19] border border-[#232E48] rounded-2xl px-4 py-3 text-center text-base font-bold text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !pin.trim() || !nickname.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition transform active:scale-95"
          >
            <span>{loading ? 'Joining Room...' : 'Enter Game'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          Zero app download required. Works natively in any mobile browser.
        </p>
      </div>
    </div>
  );
}
