import React, { useState } from 'react';
import { sound } from '../../utils/sound';
import { Clock } from 'lucide-react';
import { getTheme } from '../../utils/themes';

const QUADRANTS = [
  {
    index: 0,
    bg: 'bg-red-500 active:bg-red-600',
    border: 'border-red-400',
    shape: '▲',
    label: 'Red'
  },
  {
    index: 1,
    bg: 'bg-blue-600 active:bg-blue-700',
    border: 'border-blue-500',
    shape: '◆',
    label: 'Blue'
  },
  {
    index: 2,
    bg: 'bg-amber-500 active:bg-amber-600',
    border: 'border-amber-400',
    shape: '●',
    label: 'Yellow'
  },
  {
    index: 3,
    bg: 'bg-emerald-600 active:bg-emerald-700',
    border: 'border-emerald-500',
    shape: '■',
    label: 'Green'
  }
];

export default function AnswerPad({ question, onSelectAnswer, activeThemeId }) {
  const [selectedOpt, setSelectedOpt] = useState(null);
  const theme = getTheme(activeThemeId);

  const handleTap = (index) => {
    if (selectedOpt !== null) return; // single submission lock

    setSelectedOpt(index);

    // Haptic vibration feedback on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 30]);
    }
    sound.playTap();

    onSelectAnswer(index);
  };

  // If already answered, show locked-in state
  if (selectedOpt !== null) {
    const chosen = QUADRANTS[selectedOpt];
    return (
      <div
        className="h-full min-h-screen flex flex-col justify-center items-center p-6 text-center transition-colors duration-300"
        style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
      >
        <div className={`w-28 h-28 rounded-3xl ${chosen.bg} border-2 ${chosen.border} flex items-center justify-center text-5xl font-black text-white shadow-lg mb-6 animate-bounce-short`}>
          {chosen.shape}
        </div>
        <h2 className="text-2xl font-black" style={{ color: theme.textPrimaryHex }}>Answer Locked In!</h2>
        <p className="text-sm mt-2 max-w-xs font-medium" style={{ color: theme.textSecondaryHex }}>
          Your reaction time has been recorded by the server. Results will reveal when the countdown ends!
        </p>
        <div
          className="mt-8 flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border transition"
          style={{
            backgroundColor: theme.innerBoxHex,
            borderColor: theme.borderHex,
            color: theme.timerColor
          }}
        >
          <Clock size={14} className="animate-spin" style={{ color: theme.timerColor }} />
          <span>Waiting for timer to expire...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col select-none touch-none p-3 pb-6 transition-colors duration-300"
      style={{ backgroundColor: theme.bgHex, color: theme.textPrimaryHex }}
    >
      {/* Mini Header */}
      <div className="text-center py-2 flex items-center justify-between px-2 text-xs" style={{ color: theme.textSecondaryHex }}>
        <span className="font-extrabold" style={{ color: theme.textPrimaryHex }}>
          Question {question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <span className="text-[11px] font-bold" style={{ color: theme.timerColor }}>
          Tap matching color
        </span>
      </div>

      {/* 4 Massive Tactile Quadrants (2x2 Grid) */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3">
        {QUADRANTS.map((quad) => (
          <button
            key={quad.index}
            type="button"
            onClick={() => handleTap(quad.index)}
            className={`w-full h-full rounded-3xl ${quad.bg} border-2 ${quad.border} text-white flex flex-col items-center justify-center shadow-md active:scale-95 transition-transform duration-75`}
          >
            <span className="text-6xl md:text-7xl font-black drop-shadow-sm">
              {quad.shape}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
