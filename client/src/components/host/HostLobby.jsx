import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, Copy, Check, Volume2, VolumeX, Globe, ArrowRight, ExternalLink } from 'lucide-react';
import { sound } from '../../utils/sound';

export default function HostLobby({ room, players, publicUrl, onStartGame, onUpdatePublicUrl }) {
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState(publicUrl || '');

  const joinUrl = `${publicUrl}/play?pin=${room.pin}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleSaveUrl = (e) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onUpdatePublicUrl(customUrl.trim());
      setIsEditingUrl(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-4 md:p-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-[#232E48] pb-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
            Live Quiz Lobby
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{room.quizTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSound}
            className="p-2.5 rounded-xl bg-[#151D2F] border border-[#232E48] text-slate-400 hover:text-white transition"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={() => setIsEditingUrl(!isEditingUrl)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151D2F] border border-[#232E48] text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <Globe size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Cloudflare / Public URL</span>
          </button>
        </div>
      </div>

      {/* Cloudflare Public URL Editor Drawer */}
      {isEditingUrl && (
        <form onSubmit={handleSaveUrl} className="mt-4 p-4 rounded-2xl bg-[#151D2F] border border-indigo-500/50 shadow-xl max-w-2xl mx-auto w-full flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://your-tunnel.trycloudflare.com"
            className="flex-1 bg-[#0B0F19] border border-[#232E48] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl text-sm transition"
          >
            Update QR Code URL
          </button>
        </form>
      )}

      {/* Main Showcase: PIN & QR Code */}
      <div className="my-auto py-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 max-w-6xl mx-auto w-full">
        {/* Left: Huge Room PIN & Join Instructions */}
        <div className="flex-1 text-center lg:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Join from Mobile Browser
          </div>

          <div>
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">
              Join with Room PIN
            </p>
            <div className="inline-block px-8 py-4 rounded-3xl bg-[#151D2F] border-2 border-indigo-500 text-6xl md:text-7xl font-black tracking-widest text-white shadow-2xl shadow-indigo-500/20 font-mono select-all">
              {room.pin}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-400">Or visit URL directly on phone:</p>
            <div className="flex items-center gap-2 max-w-md mx-auto lg:mx-0 bg-[#151D2F] border border-[#232E48] rounded-2xl p-2.5">
              <span className="flex-1 font-mono text-xs text-slate-300 truncate px-2">
                {joinUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Dynamic High-Contrast QR Code */}
        <div className="p-6 md:p-8 rounded-3xl bg-white shadow-2xl flex flex-col items-center justify-center transform hover:scale-105 transition duration-300">
          <QRCodeSVG
            value={joinUrl}
            size={220}
            level="H"
            includeMargin={true}
          />
          <p className="text-slate-800 font-extrabold text-xs uppercase tracking-wider mt-3 flex items-center gap-1.5">
            <ExternalLink size={14} /> Scan with Phone Camera
          </p>
        </div>
      </div>

      {/* Bottom Section: Connected Players & Start Button */}
      <div className="bg-[#151D2F] border border-[#232E48] rounded-3xl p-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#232E48] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Users size={22} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Connected Players ({players.length})</h3>
              <p className="text-xs text-slate-400">Waiting for participants to enter their nicknames...</p>
            </div>
          </div>

          <button
            onClick={onStartGame}
            disabled={players.length === 0}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-extrabold text-base transition shadow-xl ${
              players.length > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/30 transform hover:-translate-y-0.5'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Play size={18} className="fill-current" />
            {players.length === 0 ? 'Waiting for Players...' : `Start Quiz (${players.length})`}
          </button>
        </div>

        {/* Player Nickname Tags */}
        <div className="flex flex-wrap gap-2.5 max-h-36 overflow-y-auto py-1">
          {players.length === 0 ? (
            <div className="w-full text-center py-6 text-slate-500 text-sm font-medium animate-pulse">
              Scan the QR code or enter PIN {room.pin} on mobile to join!
            </div>
          ) : (
            players.map((p, idx) => (
              <span
                key={p.id || idx}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B0F19] border border-indigo-500/30 text-indigo-200 text-xs font-semibold animate-bounce-short shadow-md"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                {p.nickname}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
