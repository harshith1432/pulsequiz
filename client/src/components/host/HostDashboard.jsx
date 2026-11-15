import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Upload,
  Play,
  Sparkles,
  Edit3,
  Key,
  HelpCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import QuestionEditorModal from './QuestionEditorModal';

const DEFAULT_SAMPLE_QUESTIONS = [
  {
    id: 's1',
    questionText: 'Which planet is known as the Red Planet in our solar system?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctOptionIndex: 1,
    timeLimitSeconds: 20,
    pointsPossible: 1000,
    explanation: 'Mars appears red because of iron oxide (rust) on its surface.'
  },
  {
    id: 's2',
    questionText: 'What is the speed of light in vacuum approximately?',
    options: ['300,000 km/s', '150,000 km/s', '1,000,000 km/s', '3,000 km/s'],
    correctOptionIndex: 0,
    timeLimitSeconds: 20,
    pointsPossible: 1000,
    explanation: 'Light travels at approximately 299,792 km/s in a vacuum.'
  },
  {
    id: 's3',
    questionText: 'Which programming language is known as the native backbone of web browsers?',
    options: ['Python', 'Java', 'JavaScript', 'C++'],
    correctOptionIndex: 2,
    timeLimitSeconds: 15,
    pointsPossible: 1000,
    explanation: 'JavaScript runs directly inside all modern web browsers.'
  },
  {
    id: 's4',
    questionText: 'What is the capital city of Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctOptionIndex: 2,
    timeLimitSeconds: 20,
    pointsPossible: 1000,
    explanation: 'Canberra was officially chosen as the federal capital in 1908.'
  },
  {
    id: 's5',
    questionText: 'Which element has the chemical symbol "Au"?',
    options: ['Silver', 'Argon', 'Gold', 'Aluminum'],
    correctOptionIndex: 2,
    timeLimitSeconds: 15,
    pointsPossible: 1000,
    explanation: 'Au derives from the Latin word "aurum", meaning shining dawn.'
  }
];

export default function HostDashboard({ onRoomCreated }) {
  const [quizTitle, setQuizTitle] = useState('Friday Tech & Science Trivia');
  const [questions, setQuestions] = useState(DEFAULT_SAMPLE_QUESTIONS);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { type: 'success' | 'error', message }
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const handleKeySave = (val) => {
    setGeminiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleDownloadTemplate = () => {
    window.open('/api/quiz/template/excel', '_blank');
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/quiz/upload/excel', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse Excel file');

      setQuestions(data.questions);
      setUploadStatus({
        type: 'success',
        message: `Successfully extracted ${data.count} questions from "${file.name}"!`
      });
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err.message
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append('file', file);
    if (geminiKey) {
      formData.append('geminiApiKey', geminiKey);
    }

    try {
      const res = await fetch('/api/quiz/upload/pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse PDF document');

      setQuestions(data.questions);
      setUploadStatus({
        type: 'success',
        message: `Successfully extracted ${data.count} questions from "${file.name}"!`
      });
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err.message
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleCreateRoom = async () => {
    if (questions.length === 0) {
      alert('Please add at least one question before starting.');
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizTitle: quizTitle.trim() || 'Live Interactive Quiz',
          questions
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      onRoomCreated(data);
    } catch (err) {
      alert('Error creating room: ' + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-3">
          <Sparkles size={14} /> Live Interactive Presentation Arena
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          Host a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">PulseQuiz</span>
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto mt-2 text-sm md:text-base">
          Upload questions via PDF or Excel, project onto the big screen, and let players join from their phones in seconds.
        </p>
      </div>

      {/* Main Setup Card */}
      <div className="bg-[#151D2F] border border-[#232E48] rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
        {/* Quiz Title */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Quiz Session Title
          </label>
          <input
            type="text"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="e.g. Science Bowl 2026 / Company Trivia"
            className="w-full bg-[#0B0F19] border border-[#232E48] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500 text-base"
          />
        </div>

        {/* Upload & Ingestion Actions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Upload Question Sources
            </span>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition"
            >
              <Key size={14} /> {geminiKey ? 'Gemini Key Configured ✓' : 'Add Gemini API Key (Optional)'}
            </button>
          </div>

          {showKeyInput && (
            <div className="mb-4 p-4 rounded-xl bg-[#0B0F19] border border-[#232E48] space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Google Gemini API Key for High-Accuracy PDF Extraction</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  Get free key ↗
                </a>
              </div>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => handleKeySave(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#151D2F] border border-[#232E48] rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Key is saved safely in your browser's local storage and used only to parse complex document PDFs.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Excel Card */}
            <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#232E48] hover:border-indigo-500/50 transition flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Excel Spreadsheet</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload your questions using our pre-formatted Excel template.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition border border-slate-700"
                >
                  <Download size={14} /> Download Template
                </button>
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-lg shadow-emerald-600/20"
                >
                  <Upload size={14} /> Upload Excel
                </button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* PDF Card */}
            <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#232E48] hover:border-indigo-500/50 transition flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">PDF Exam / Quiz Document</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Auto-extracts questions, 4 options, and answer keys from any MCQ test paper.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition shadow-lg shadow-rose-600/20"
                >
                  <Upload size={14} /> Upload PDF Document
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Upload Feedback */}
          {uploadStatus && (
            <div
              className={`mt-4 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
                uploadStatus.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}
            >
              {uploadStatus.type === 'success' ? (
                <CheckCircle size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{uploadStatus.message}</span>
            </div>
          )}
        </div>

        {/* Current Questions Summary & Editor Launcher */}
        <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#232E48] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              {questions.length}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Questions Ready for Room</h4>
              <p className="text-xs text-slate-400">
                Each question includes 4 color-coded choices & countdown timer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuestions(DEFAULT_SAMPLE_QUESTIONS)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
            >
              Reset to Sample
            </button>
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-300 transition"
            >
              <Edit3 size={14} /> Review & Edit ({questions.length})
            </button>
          </div>
        </div>

        {/* Launch Room Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isUploading || questions.length === 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Play size={20} className="fill-white" /> Launch Room & Project QR Code
          </button>
          <p className="text-center text-xs text-slate-500 mt-2">
            Launches the presenter lobby with dynamic 6-digit Room PIN & mobile QR code.
          </p>
        </div>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <QuestionEditorModal
          questions={questions}
          onSave={(updated) => {
            setQuestions(updated);
            setIsEditorOpen(false);
          }}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
}
