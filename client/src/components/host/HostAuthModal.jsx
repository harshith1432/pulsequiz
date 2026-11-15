import React, { useState } from 'react';
import { X, Lock, User, Sparkles, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getTheme } from '../../utils/themes';

export default function HostAuthModal({ isOpen, onClose, onAuthSuccess, activeThemeId }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const theme = getTheme(activeThemeId);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      if (data.token && data.user) {
        localStorage.setItem('pulsequiz_token', data.token);
        localStorage.setItem('pulsequiz_user', JSON.stringify(data.user));
        onAuthSuccess(data.user, data.token);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md border rounded-3xl p-6 sm:p-8 shadow-2xl relative"
        style={{ backgroundColor: theme.cardHex || '#FFFFFF', borderColor: theme.borderHex || '#E7E0D8' }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center shadow-md mb-3"
            style={{ backgroundColor: theme.timerColor || '#D97706' }}
          >
            <Lock size={22} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-stone-800">
            {isRegister ? 'Create Host Account' : 'Host & Teacher Login'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {isRegister
              ? 'Sign up to create your isolated quiz workspace and upload question banks.'
              : 'Sign in to access your saved classrooms, upload PDFs, and launch rooms.'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex rounded-2xl bg-stone-100 p-1 mb-5">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              !isRegister
                ? 'bg-white text-stone-800 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              isRegister
                ? 'bg-white text-stone-800 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Host Username / User ID
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. professor_smith"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-semibold text-stone-800 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-semibold text-stone-800 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${theme.accentGradient} text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition transform active:scale-95 cursor-pointer mt-2`}
          >
            <span>{loading ? 'Verifying...' : isRegister ? 'Register & Open Workspace' : 'Sign In as Host'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-[11px] text-stone-400 mt-5">
          🔒 Secure and isolated. Students and participants only see the Join PIN screen and cannot access your quizzes.
        </p>
      </div>
    </div>
  );
}
