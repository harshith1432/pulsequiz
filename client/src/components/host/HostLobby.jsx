import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, Copy, Check, Volume2, VolumeX, Globe, ExternalLink, Sparkles, Clock } from 'lucide-react';
import { sound } from '../../utils/sound';
import ThemeSelector from '../common/ThemeSelector';
import { getTheme } from '../../utils/themes';

export default function HostLobby({
  room,
  players,
  publicUrl,
  activeThemeId,
  onSelectTheme,
  onStartGame,
  onUpdatePublicUrl,
  onUpdateTimer
}) {
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState(20);

  const handleTimerChange = (sec) => {
    setSelectedTimer(sec);
    if (onUpdateTimer) {
      onUpdateTimer(sec);
    }
  };

  // Validate Cloudflare Tunnel URL via strict hostname resolution to eliminate CodeQL js/incomplete-url-substring-sanitization
  const isCloudflareUrl = (urlString) => {
    try {
      const parsed = new URL(urlString, window.location.origin);
      const host = parsed.hostname.toLowerCase();
      return host === 'trycloudflare.com' || host.endsWith('.trycloudflare.com') || host.endsWith('.cloudflare.com');
    } catch {
      return false;
    }
  };

  // Compute best available public URL, strictly prioritizing Cloudflare Tunnel HTTPS over local LAN IP
  const computeBestPublicUrl = (urlA, urlB) => {
    const candidates = [
      urlA,
      urlB,
      window.location.origin
    ].filter(Boolean);

    // 1. Look for Cloudflare tunnel URL first via parsed hostname verification
    const cf = candidates.find(u => isCloudflareUrl(u));
    if (cf) return cf.replace(/\/+$/, '');

    // 2. Look for any HTTPS URL
    const https = candidates.find(u => u.startsWith('https://'));
    if (https) return https.replace(/\/+$/, '');

    // 3. Fallback to provided URL or default
    return (urlA || urlB || window.location.origin || 'https://appreciation-computed-dame-lucas.trycloudflare.com').replace(/\/+$/, '');
  };

  const effectivePublicUrl = computeBestPublicUrl(publicUrl, room?.publicUrl);
  const [customUrl, setCustomUrl] = useState(effectivePublicUrl);

  useEffect(() => {
    if (effectivePublicUrl) {
      setCustomUrl(effectivePublicUrl);
    }
  }, [effectivePublicUrl]);

  const activeBaseUrl = (customUrl || effectivePublicUrl).replace(/\/+$/, '');
  const joinUrl = `${activeBaseUrl}/play?pin=${room.pin}`;

  const theme = getTheme(activeThemeId);

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
    <div
      className="min-h-screen flex flex-col justify-between p-4 md:p-8 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between border-b pb-4 transition-colors duration-300"
        style={{ borderColor: theme.borderHex }}
      >
        <div>
          <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color: theme.timerColor }}>
            Live Presenter Lobby
          </span>
          <h1 className="text-xl md:text-2xl font-black" style={{ color: theme.textPrimaryHex }}>{room.quizTitle}</h1>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Aesthetic Theme Selector */}
          <ThemeSelector
            activeThemeId={activeThemeId}
            onSelectTheme={onSelectTheme}
          />

          <button
            onClick={handleToggleSound}
            className="p-2.5 rounded-xl border shadow-xs transition"
            style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={() => setIsEditingUrl(!isEditingUrl)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-xs transition"
            style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
          >
            <Globe size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Public URL</span>
          </button>
        </div>
      </div>

      {/* Cloudflare Public URL Editor Drawer */}
      {isEditingUrl && (
        <form
          onSubmit={handleSaveUrl}
          className="mt-4 p-4 rounded-2xl border shadow-lg max-w-2xl mx-auto w-full flex flex-col sm:flex-row gap-2 transition"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.timerColor }}
        >
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://your-tunnel.trycloudflare.com"
            className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none"
            style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
          />
          <button
            type="submit"
            className="px-5 py-2 font-bold rounded-xl text-sm text-white shadow-xs transition"
            style={{ backgroundColor: theme.timerColor }}
          >
            Update QR Code URL
          </button>
        </form>
      )}

      {/* Main Showcase: PIN & QR Code */}
      <div className="my-auto py-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 max-w-5xl mx-auto w-full">
        {/* Left: Room PIN & Join Instructions */}
        <div className="flex-1 text-center lg:text-left space-y-5">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider shadow-xs"
            style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex, color: theme.timerColor }}
          >
            <Sparkles size={13} style={{ color: theme.timerColor }} /> Join from Mobile Phone
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondaryHex }}>
              Room PIN
            </p>
            <div
              className="inline-block px-8 py-4 rounded-3xl border-2 text-6xl md:text-7xl font-black tracking-widest shadow-sm font-mono select-all transition-colors duration-300"
              style={{
                backgroundColor: theme.cardHex,
                borderColor: theme.timerColor,
                color: theme.textPrimaryHex,
                boxShadow: `0 8px 30px ${theme.borderHex}`
              }}
            >
              {room.pin}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: theme.textSecondaryHex }}>Or open this link on your phone:</p>
            <div
              className="flex items-center gap-2 max-w-md mx-auto lg:mx-0 border rounded-2xl p-2 shadow-xs transition-colors duration-300"
              style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
            >
              <span className="flex-1 font-mono text-xs truncate px-2 font-semibold" style={{ color: theme.textPrimaryHex }}>
                {joinUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-bold transition shadow-xs"
                style={{ backgroundColor: theme.timerColor }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: QR Code */}
        <div
          className="p-6 md:p-8 rounded-3xl border shadow-md flex flex-col items-center justify-center transform hover:scale-105 transition duration-300"
          style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
        >
          <div className="p-3 bg-white rounded-2xl shadow-xs">
            <QRCodeSVG
              value={joinUrl}
              size={210}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="font-extrabold text-xs uppercase tracking-wider mt-3 flex items-center gap-1.5" style={{ color: theme.textPrimaryHex }}>
            <ExternalLink size={14} style={{ color: theme.timerColor }} /> Scan with Phone Camera
          </p>
        </div>
      </div>

      {/* Bottom Section: Connected Players & Start Button */}
      <div
        className="border rounded-3xl p-6 max-w-5xl mx-auto w-full shadow-sm transition-colors duration-300"
        style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
      >
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4 mb-4 transition-colors duration-300"
          style={{ borderColor: theme.borderHex }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl border"
              style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.timerColor }}
            >
              <Users size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: theme.textPrimaryHex }}>Connected Players ({players.length})</h3>
              <p className="text-xs" style={{ color: theme.textSecondaryHex }}>Participants joined via mobile phone...</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Question Timer Presets in Lobby */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border"
              style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
            >
              <Clock size={14} style={{ color: theme.timerColor }} />
              <span className="text-xs font-bold mr-1" style={{ color: theme.textSecondaryHex }}>Timer:</span>
              {[10, 15, 20, 30, 45, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleTimerChange(sec)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                    selectedTimer === sec
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                  title={`Set all questions to ${sec} seconds`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            <button
              onClick={onStartGame}
              disabled={players.length === 0}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-base transition shadow-sm cursor-pointer ${
                players.length > 0
                  ? `bg-gradient-to-r ${theme.accentGradient} text-white transform hover:-translate-y-0.5`
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Play size={18} className="fill-current" />
              {players.length === 0 ? 'Waiting for Players...' : `Start Quiz (${players.length})`}
            </button>
            <p className="text-[11px] font-semibold text-center mt-1.5 opacity-80" style={{ color: theme.textSecondaryHex }}>
              Press <strong style={{ color: theme.textPrimaryHex }}>[Enter]</strong> or <strong style={{ color: theme.textPrimaryHex }}>[➔]</strong> to start quiz
            </p>
          </div>
        </div>

        {/* Player Nickname Tags */}
        <div className="flex flex-wrap gap-2.5 max-h-36 overflow-y-auto py-1">
          {players.length === 0 ? (
            <div className="w-full text-center py-6 text-sm font-medium animate-pulse" style={{ color: theme.textSecondaryHex }}>
              Scan the QR code or enter PIN {room.pin} on mobile to join!
            </div>
          ) : (
            players.map((p, idx) => (
              <span
                key={p.id || idx}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold shadow-xs animate-bounce-short transition"
                style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex, color: theme.textPrimaryHex }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                {p.nickname}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
