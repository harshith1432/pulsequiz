import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function QuestionEditorModal({ questions, onSave, onClose }) {
  const [list, setList] = useState(JSON.parse(JSON.stringify(questions)));
  const [activeIdx, setActiveIdx] = useState(0);

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
      pointsPossible: 1000,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#151D2F] border border-[#232E48] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232E48]">
          <div>
            <h2 className="text-xl font-bold text-white">Quiz Question Editor</h2>
            <p className="text-xs text-slate-400">Review, modify, or add questions before launching the live room</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Question List Sidebar */}
          <div className="w-1/3 border-r border-[#232E48] p-4 overflow-y-auto space-y-2 bg-[#0E1524]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Questions ({list.length})
              </span>
              <button
                onClick={handleAddQuestion}
                className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md transition"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {list.map((q, idx) => (
              <div
                key={q.id || idx}
                onClick={() => setActiveIdx(idx)}
                className={`p-3 rounded-xl cursor-pointer text-left transition flex items-center justify-between ${
                  activeIdx === idx
                    ? 'bg-indigo-600/20 border border-indigo-500 text-white'
                    : 'bg-[#151D2F] border border-transparent hover:border-[#232E48] text-slate-300'
                }`}
              >
                <div className="truncate pr-2">
                  <span className="text-xs font-bold text-indigo-400 mr-2">Q{idx + 1}</span>
                  <span className="text-sm font-medium">{q.questionText || 'Empty Question'}</span>
                </div>
                {list.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteQuestion(idx);
                    }}
                    className="p-1 hover:text-red-400 text-slate-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Active Question Detail */}
          {currentQ && (
            <div className="flex-1 p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Question {activeIdx + 1} Text
                </label>
                <textarea
                  rows={3}
                  value={currentQ.questionText}
                  onChange={(e) => handleUpdate('questionText', e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#232E48] rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Enter question prompt..."
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Options (Click circle to set correct answer)
                </label>
                <div className="space-y-3">
                  {[
                    { label: 'Option A (Red ▲)', color: 'border-red-500/40 focus-within:border-red-500' },
                    { label: 'Option B (Blue ◆)', color: 'border-blue-500/40 focus-within:border-blue-500' },
                    { label: 'Option C (Yellow ●)', color: 'border-amber-500/40 focus-within:border-amber-500' },
                    { label: 'Option D (Green ■)', color: 'border-emerald-500/40 focus-within:border-emerald-500' }
                  ].map((optMeta, optIdx) => {
                    const isCorrect = currentQ.correctOptionIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-3 p-2 rounded-xl border bg-[#0B0F19] ${optMeta.color} ${
                          isCorrect ? 'ring-2 ring-emerald-500/50 bg-emerald-950/20' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleUpdate('correctOptionIndex', optIdx)}
                          className={`p-1.5 rounded-full transition ${
                            isCorrect ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'
                          }`}
                        >
                          <CheckCircle2 size={20} className={isCorrect ? 'fill-emerald-500/20' : ''} />
                        </button>
                        <input
                          type="text"
                          value={currentQ.options[optIdx] || ''}
                          onChange={(e) => handleOptionUpdate(optIdx, e.target.value)}
                          placeholder={optMeta.label}
                          className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                        />
                        <span className="text-xs text-slate-500 font-mono pr-2">
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
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Time Limit (seconds)
                  </label>
                  <select
                    value={currentQ.timeLimitSeconds || 20}
                    onChange={(e) => handleUpdate('timeLimitSeconds', parseInt(e.target.value, 10))}
                    className="w-full bg-[#0B0F19] border border-[#232E48] rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value={10}>10 Seconds (Fast)</option>
                    <option value={15}>15 Seconds</option>
                    <option value={20}>20 Seconds (Standard)</option>
                    <option value={30}>30 Seconds</option>
                    <option value={60}>60 Seconds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Explanation / Trivia (Optional)
                  </label>
                  <input
                    type="text"
                    value={currentQ.explanation || ''}
                    onChange={(e) => handleUpdate('explanation', e.target.value)}
                    placeholder="Fact revealed after question"
                    className="w-full bg-[#0B0F19] border border-[#232E48] rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#232E48] bg-[#0E1524]">
          <span className="text-xs text-slate-400">
            Total: {list.length} {list.length === 1 ? 'question' : 'questions'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(list)}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
