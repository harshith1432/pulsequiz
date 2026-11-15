import React, { useState, useEffect } from 'react';
import { Smartphone, Sparkles, ArrowRight, AlertCircle, PlusCircle, LogIn, User, LogOut, LayoutDashboard } from 'lucide-react';
import { sound } from '../../utils/sound';
import { getTheme } from '../../utils/themes';

export default function PlayerJoin({
  onJoinRoom,
  error,
  activeThemeId,
  hostUser,
  onOpenAuth,
  onGoToHost,
  onHostLogout
}) {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = getTheme(activeThemeId);

  useEffect(() => {
    // Auto-fill PIN from query params: /play?pin=123456 or /?pin=123456
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
    <div
      className="min-h-screen flex flex-col justify-between p-4 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Top Navbar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 border-b border-stone-200/60 mb-auto">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
            style={{ backgroundColor: theme.timerColor }}
          >
            <Smartphone size={16} className="text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">
            Pulse<span className={theme.accentText}>Quiz</span>
          </span>
        </div>

        {/* Host Access Area */}
        <div className="flex items-center gap-2">
          {hostUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-700 bg-white border border-stone-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                <User size={13} className="text-amber-700" />
                <span>{hostUser.username}</span>
              </span>
              <button
                type="button"
                onClick={onGoToHost}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-white font-extrabold text-xs shadow-xs transition hover:scale-[1.02] cursor-pointer`}
              >
                <LayoutDashboard size={13} />
                <span>Host Dashboard</span>
              </button>
              <button
                type="button"
                onClick={onHostLogout}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-white font-extrabold text-xs shadow-xs transition hover:scale-[1.02] cursor-pointer`}
            >
              <PlusCircle size={14} />
              <span>Create / Host Quiz</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Join Card */}
      <div className="w-full max-w-sm mx-auto my-auto py-8">
        {/* Brand Hero */}
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-md mb-3 transform hover:scale-105 transition"
            style={{ backgroundColor: theme.timerColor }}
          >
            <Smartphone size={26} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.textPrimaryHex }}>
            Join Quiz Room
          </h1>
          <p className="text-xs mt-1 font-medium" style={{ color: theme.textSecondaryHex }}>
            Enter the 6-digit Game PIN from the host's screen
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="border rounded-3xl p-6 shadow-sm space-y-4 transition-colors duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondaryHex }}>
              Game PIN (6 Digits)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 586014"
              required
              className="w-full border rounded-2xl px-4 py-3.5 text-center text-2xl font-black font-mono tracking-widest focus:outline-none transition shadow-2xs"
              style={{
                backgroundColor: theme.innerBoxHex,
                borderColor: theme.borderHex,
                color: theme.textPrimaryHex
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondaryHex }}>
              Your Nickname
            </label>
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Alex"
              required
              className="w-full border rounded-2xl px-4 py-3 text-center text-base font-bold focus:outline-none transition shadow-2xs"
              style={{
                backgroundColor: theme.innerBoxHex,
                borderColor: theme.borderHex,
                color: theme.textPrimaryHex
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !pin.trim() || !nickname.trim()}
            className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${theme.accentGradient} disabled:opacity-50 text-white font-black text-base flex items-center justify-center gap-2 shadow-xs transition transform active:scale-95 cursor-pointer mt-1`}
          >
            <span>{loading ? 'Entering Room...' : 'Enter Room'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="text-center text-[11px] mt-6 font-medium" style={{ color: theme.textSecondaryHex }}>
          Zero app download required. Works on mobile phones, tablets, and laptops.
        </p>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto text-center py-3 text-xs text-stone-400 font-medium mt-auto">
        PulseQuiz • Interactive Audience Game Platform
      </footer>
    </div>
  );
}
