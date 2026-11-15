import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { getTheme } from '../../utils/themes';

export default function QuestionEditorModal({ questions, activeThemeId, onSave, onClose }) {
  const [list, setList] = useState(JSON.parse(JSON.stringify(questions)));
  const [activeIdx, setActiveIdx] = useState(0);
  const theme = getTheme(activeThemeId);

  const currentQ = list[activeIdx] || null;

  const handleUpdate = (field, val) => {
    const updated = [...list];
    updated[activeIdx][field] = val;
    setList(updated);
  };

  const handleOptionUpdate = (optIdx, val) => {
    const updated = [...list];
    updated[activeIdx].options[optIdx] = val;
    setList(updated);
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: String(Date.now()),
      questionText: 'New Question Prompt',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: 0,
      timeLimitSeconds: 20,
      pointsPossible: 10,
      explanation: ''
    };
    setList([...list, newQ]);
    setActiveIdx(list.length);
  };

  const handleDeleteQuestion = (idx) => {
    if (list.length <= 1) {
      alert('Quiz must contain at least one question.');
      return;
    }
    const filtered = list.filter((_, i) => i !== idx);
    setList(filtered);
    setActiveIdx(Math.max(0, idx - 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="border rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: theme.cardHex, borderColor: theme.borderHex }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b transition-colors duration-300"
          style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
        >
          <div>
            <h2 className="text-lg font-black" style={{ color: theme.textPrimaryHex }}>Quiz Question Editor</h2>
            <p className="text-xs" style={{ color: theme.textSecondaryHex }}>Review, modify, or add questions before launching the live room</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:opacity-80 transition cursor-pointer"
            style={{ color: theme.textSecondaryHex }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Question List Sidebar */}
          <div
            className="w-1/3 border-r p-4 overflow-y-auto space-y-2 transition-colors duration-300"
            style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondaryHex }}>
                Questions ({list.length})
              </span>
              <button
                onClick={handleAddQuestion}
                className="flex items-center gap-1 text-xs text-white font-bold px-2.5 py-1 rounded-xl shadow-xs transition cursor-pointer"
                style={{ backgroundColor: theme.timerColor }}
              >
                <Plus size={13} /> Add
              </button>
            </div>
            {list.map((q, idx) => {
              const isActive = activeIdx === idx;
              return (
                <div
                  key={q.id || idx}
                  onClick={() => setActiveIdx(idx)}
                  className="p-3 rounded-2xl cursor-pointer text-left transition flex items-center justify-between border"
                  style={{
                    backgroundColor: isActive ? theme.cardHex : 'transparent',
                    borderColor: isActive ? theme.timerColor : 'transparent',
                    boxShadow: isActive ? `0 2px 8px ${theme.borderHex}` : 'none',
                    color: theme.textPrimaryHex
                  }}
                >
                  <div className="truncate pr-2">
                    <span className="text-xs font-bold mr-2" style={{ color: theme.timerColor }}>Q{idx + 1}</span>
                    <span className="text-xs font-semibold">{q.questionText || 'Empty Question'}</span>
                  </div>
                  {list.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(idx);
                      }}
                      className="p-1 hover:text-red-600 transition"
                      style={{ color: theme.textSecondaryHex }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Question Detail */}
          {currentQ && (
            <div
              className="flex-1 p-6 overflow-y-auto space-y-5 transition-colors duration-300"
              style={{ backgroundColor: theme.cardHex }}
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondaryHex }}>
                  Question {activeIdx + 1} Prompt
                </label>
                <textarea
                  rows={3}
                  value={currentQ.questionText}
                  onChange={(e) => handleUpdate('questionText', e.target.value)}
                  className="w-full border rounded-2xl p-3 font-medium focus:outline-none text-sm transition"
                  style={{
                    backgroundColor: theme.innerBoxHex,
                    borderColor: theme.borderHex,
                    color: theme.textPrimaryHex
                  }}
                  placeholder="Enter question text..."
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondaryHex }}>
                  Options (Click checkmark circle to designate correct answer)
                </label>
                <div className="space-y-2.5">
                  {[
                    { label: 'Option A (Red ▲)', color: 'border-red-300 focus-within:border-red-500' },
                    { label: 'Option B (Blue ◆)', color: 'border-blue-300 focus-within:border-blue-500' },
                    { label: 'Option C (Yellow ●)', color: 'border-amber-300 focus-within:border-amber-500' },
                    { label: 'Option D (Green ■)', color: 'border-emerald-300 focus-within:border-emerald-500' }
                  ].map((optMeta, optIdx) => {
                    const isCorrect = currentQ.correctOptionIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-3 p-2.5 rounded-2xl border ${optMeta.color} transition ${
                          isCorrect ? 'ring-2 ring-emerald-400 bg-emerald-50/70' : ''
                        }`}
                        style={{
                          backgroundColor: isCorrect ? undefined : theme.innerBoxHex,
                          borderColor: isCorrect ? undefined : theme.borderHex
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleUpdate('correctOptionIndex', optIdx)}
                          className={`p-1 rounded-full transition ${
                            isCorrect ? 'text-emerald-600' : 'hover:opacity-75'
                          }`}
                          style={{ color: isCorrect ? undefined : theme.textSecondaryHex }}
                        >
                          <CheckCircle2 size={18} className={isCorrect ? 'fill-emerald-500/20' : ''} />
                        </button>
                        <input
                          type="text"
                          value={currentQ.options[optIdx] || ''}
                          onChange={(e) => handleOptionUpdate(optIdx, e.target.value)}
                          placeholder={optMeta.label}
                          className="flex-1 bg-transparent text-xs font-semibold focus:outline-none"
                          style={{ color: theme.textPrimaryHex }}
                        />
                        <span className="text-[11px] font-bold font-mono pr-2" style={{ color: theme.textSecondaryHex }}>
                          {isCorrect ? 'CORRECT' : `OPT ${String.fromCharCode(65 + optIdx)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Settings: Timer & Explanation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondaryHex }}>
                    Time Limit (seconds)
                  </label>
                  <select
                    value={currentQ.timeLimitSeconds || 20}
                    onChange={(e) => handleUpdate('timeLimitSeconds', parseInt(e.target.value, 10))}
                    className="w-full border rounded-xl p-2.5 text-xs font-semibold focus:outline-none transition"
                    style={{
                      backgroundColor: theme.innerBoxHex,
                      borderColor: theme.borderHex,
                      color: theme.textPrimaryHex
                    }}
                  >
                    <option value={10}>10 Seconds (Fast)</option>
                    <option value={15}>15 Seconds</option>
                    <option value={20}>20 Seconds (Standard)</option>
                    <option value={30}>30 Seconds</option>
                    <option value={45}>45 Seconds</option>
                    <option value={60}>60 Seconds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondaryHex }}>
                    Explanation / Trivia (Optional)
                  </label>
                  <input
                    type="text"
                    value={currentQ.explanation || ''}
                    onChange={(e) => handleUpdate('explanation', e.target.value)}
                    placeholder="Fact revealed after question"
                    className="w-full border rounded-xl p-2.5 text-xs font-medium focus:outline-none transition"
                    style={{
                      backgroundColor: theme.innerBoxHex,
                      borderColor: theme.borderHex,
                      color: theme.textPrimaryHex
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t transition-colors duration-300"
          style={{ backgroundColor: theme.innerBoxHex, borderColor: theme.borderHex }}
        >
          <span className="text-xs font-medium" style={{ color: theme.textSecondaryHex }}>
            Total: {list.length} {list.length === 1 ? 'question' : 'questions'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-75 transition cursor-pointer"
              style={{ color: theme.textSecondaryHex }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(list)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition cursor-pointer"
              style={{ backgroundColor: theme.timerColor }}
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
