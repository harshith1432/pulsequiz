import React, { useState } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { THEMES } from '../../utils/themes';

export default function ThemeSelector({ activeThemeId, onSelectTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeTheme = THEMES.find(t => t.id === activeThemeId) || THEMES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E7E0D8] text-xs font-semibold text-[#44403C] hover:bg-[#F5EFEB] shadow-sm transition"
        title="Choose Aesthetic Cream Theme"
      >
        <div className="flex items-center -space-x-1">
          {activeTheme.swatch.map((c, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full border border-white shadow-xs"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <span className="hidden sm:inline font-medium">{activeTheme.name}</span>
        <Palette size={13} className="text-amber-700" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50 w-72 md:w-80 p-3 bg-white border border-[#E7E0D8] rounded-2xl shadow-2xl space-y-1.5 max-h-96 overflow-y-auto">
            <div className="px-2 py-1 border-b border-stone-100 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                10 Aesthetic Creamy Themes
              </span>
              <Sparkles size={12} className="text-amber-600" />
            </div>

            {THEMES.map((theme) => {
              const isSelected = theme.id === activeThemeId;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300'
                      : 'border-transparent hover:bg-stone-50 hover:border-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Swatch Pill */}
                    <div className="flex items-center -space-x-1 p-0.5 rounded-full bg-stone-100 border border-stone-200">
                      {theme.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-800 leading-tight">
                        {theme.name}
                      </h4>
                      <p className="text-[10px] text-stone-500 line-clamp-1">
                        {theme.tagline}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-amber-700 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
