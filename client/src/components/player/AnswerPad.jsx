import React, { useState } from 'react';
import { sound } from '../../utils/sound';
import { Check, Clock } from 'lucide-react';

const QUADRANTS = [
  {
    index: 0,
    bg: 'bg-red-600 active:bg-red-700',
    border: 'border-red-500',
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

export default function AnswerPad({ question, onSelectAnswer }) {
  const [selectedOpt, setSelectedOpt] = useState(null);

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
      <div className="h-full min-h-screen bg-[#0B0F19] text-white flex flex-col justify-center items-center p-6 text-center">
        <div className={`w-28 h-28 rounded-3xl ${chosen.bg} border-2 ${chosen.border} flex items-center justify-center text-5xl font-black shadow-2xl mb-6 animate-bounce-short`}>
          {chosen.shape}
        </div>
        <h2 className="text-2xl font-black text-white">Answer Locked In!</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-xs">
          Your reaction time has been recorded by the server. Check the big screen for results!
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-indigo-400 font-bold bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
          <Clock size={14} className="animate-spin" />
          <span>Waiting for question to conclude...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F19] select-none touch-none p-3 pb-6">
      {/* Mini Header */}
      <div className="text-center py-2 flex items-center justify-between px-2 text-xs text-slate-400">
        <span className="font-bold text-white">
          Question {question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <span className="text-[11px] font-semibold text-indigo-400">
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
            className={`w-full h-full rounded-3xl ${quad.bg} border-2 ${quad.border} text-white flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform duration-75`}
          >
            <span className="text-6xl md:text-7xl font-black drop-shadow-md">
              {quad.shape}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
