import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Upload,
  Play,
  Sparkles,
  Edit3,
  Key,
  CheckCircle,
  AlertCircle,
  Palette,
  BookmarkPlus,
  BookOpen,
  Trash2,
  Search,
  Save,
  Check,
  RotateCcw,
  Layers,
  User,
  LogOut,
  ArrowLeft,
  Clock,
  Trophy,
  Shuffle,
  Dice5,
  Sliders,
  Files
} from 'lucide-react';
import QuestionEditorModal from './QuestionEditorModal';
import PastWinnersModal from './PastWinnersModal';
import { THEMES, getTheme } from '../../utils/themes';
import { shuffleAndDistributeOptions, sampleRandomQuestions } from '../../utils/questionShuffle';

const DEFAULT_SAMPLE_QUESTIONS = [
  {
    id: 's1',
    questionText: 'Which planet is known as the Red Planet in our solar system?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctOptionIndex: 1,
    timeLimitSeconds: 20,
    pointsPossible: 10,
    explanation: 'Mars appears red because of iron oxide (rust) on its surface.'
  },
  {
    id: 's2',
    questionText: 'What is the speed of light in vacuum approximately?',
    options: ['300,000 km/s', '150,000 km/s', '1,000,000 km/s', '3,000 km/s'],
    correctOptionIndex: 0,
    timeLimitSeconds: 20,
    pointsPossible: 10,
    explanation: 'Light travels at approximately 299,792 km/s in a vacuum.'
  },
  {
    id: 's3',
    questionText: 'Which programming language is known as the native backbone of web browsers?',
    options: ['Python', 'Java', 'JavaScript', 'C++'],
    correctOptionIndex: 2,
    timeLimitSeconds: 15,
    pointsPossible: 10,
    explanation: 'JavaScript runs directly inside all modern web browsers.'
  },
  {
    id: 's4',
    questionText: 'What is the capital city of Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctOptionIndex: 2,
    timeLimitSeconds: 20,
    pointsPossible: 10,
    explanation: 'Canberra was officially chosen as the federal capital in 1908.'
  },
  {
    id: 's5',
    questionText: 'Which element has the chemical symbol "Au"?',
    options: ['Silver', 'Argon', 'Gold', 'Aluminum'],
    correctOptionIndex: 2,
    timeLimitSeconds: 15,
    pointsPossible: 10,
    explanation: 'Au derives from the Latin word "aurum", meaning shining dawn.'
  }
];

export default function HostDashboard({
  onRoomCreated,
  activeThemeId,
  onSelectTheme,
  hostUser,
  onLogout,
  onBackToPlayer
}) {
  const [quizTitle, setQuizTitle] = useState('Friday Tech & Science Trivia');
  const [questions, setQuestions] = useState(DEFAULT_SAMPLE_QUESTIONS);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Question Pool & Multi-PDF Sampling States
  const [questionPool, setQuestionPool] = useState(null); // Stores full extracted pool (e.g. 500 questions)
  const [poolSourceInfo, setPoolSourceInfo] = useState('');
  const [targetSampleCount, setTargetSampleCount] = useState(20);

  // Saved Classrooms & Quizzes Library (User Isolated)
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingWinnersQuiz, setViewingWinnersQuiz] = useState(null);

  const currentTheme = getTheme(activeThemeId);
  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Helper for auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('pulsequiz_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Fetch saved quizzes for the authenticated host
  const fetchSavedQuizzes = async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/quizzes', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.quizzes) {
        setSavedQuizzes(data.quizzes);
      }
    } catch (err) {
      console.error('Failed to load saved quizzes:', err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSavedQuizzes();
  }, []);

  const handleKeySave = (val) => {
    setGeminiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleDownloadTemplate = () => {
    window.open('/api/quiz/template/excel', '_blank');
  };

  const handleExcelUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (targetSampleCount) {
      formData.append('sampleCount', targetSampleCount);
    }

    try {
      const res = await fetch('/api/quiz/upload/excel', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse Excel file');

      const fullPool = data.pool || data.questions;
      setQuestionPool(fullPool);
      setQuestions(data.questions);
      setCurrentQuizId(null);
      const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setQuizTitle(cleanName);
      setPoolSourceInfo(`${files.length} Excel file(s) (${fullPool.length} total questions)`);

      setUploadStatus({
        type: 'success',
        message: `Extracted ${fullPool.length} questions from Excel. Selected ${data.questions.length} questions with serial non-repeating option pattern.`
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

  // Upload up to 5 PDF files, extract combined pool, and sample with serial option mixing
  const handlePdfUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 5) {
      setUploadStatus({
        type: 'error',
        message: 'You can upload a maximum of 5 PDF files at once.'
      });
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (targetSampleCount) {
      formData.append('sampleCount', targetSampleCount);
    }
    if (geminiKey) {
      formData.append('geminiApiKey', geminiKey);
    }

    try {
      const res = await fetch('/api/quiz/upload/pdf', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse PDF document(s)');

      const fullPool = data.pool || data.questions;
      setQuestionPool(fullPool);
      setQuestions(data.questions);
      if (data.quizId) {
        setCurrentQuizId(data.quizId);
      }
      setPoolSourceInfo(`${data.filesProcessed || files.length} PDF(s) (${fullPool.length} questions in bank)`);

      if (data.quizTitle) {
        setQuizTitle(data.quizTitle);
      } else if (files.length === 1) {
        const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setQuizTitle(cleanName);
      } else {
        setQuizTitle(`Multi-Exam Quiz (${files.length} PDFs)`);
      }

      setUploadStatus({
        type: 'success',
        message: `Extracted all ${data.totalPoolCount} questions across ${data.filesProcessed} PDFs & saved to your database! Selected ${data.questions.length} questions for this round (${data.remainingCount} unasked questions ready for future rounds).`
      });
      fetchSavedQuizzes();
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

  // Resample questions from questionPool with serial option mixing
  const handleResample = (count) => {
    const pool = questionPool && questionPool.length > 0 ? questionPool : questions;
    if (!pool || pool.length === 0) return;
    const targetCount = count !== undefined ? count : targetSampleCount;
    const sampled = sampleRandomQuestions(pool, targetCount);
    setQuestions(sampled);
    setTargetSampleCount(targetCount);
    setSaveStatus({
      type: 'success',
      message: `🎲 Sampled ${sampled.length} questions randomly from the ${pool.length}-question pool with serial non-repeating options!`
    });
    setTimeout(() => setSaveStatus(null), 5000);
  };

  // Mix options of current questions so consecutive questions never have the same correct option letter
  const handleShuffleCurrentOptions = () => {
    if (!questions || questions.length === 0) return;
    const mixed = shuffleAndDistributeOptions(questions);
    setQuestions(mixed);
    setSaveStatus({
      type: 'success',
      message: '🔀 Scrambled options! Answer positions (A, B, C, D) are now mixed in a serial pattern where consecutive questions never share the same option.'
    });
    setTimeout(() => setSaveStatus(null), 5000);
  };

  // Fetch next batch of fresh/unasked questions for the active quiz
  const handleNextRoundFreshQuestions = async () => {
    if (!currentQuizId) {
      const pool = questionPool && questionPool.length > 0 ? questionPool : questions;
      const result = pickUnusedQuestions(pool, [], targetSampleCount);
      setQuestions(result.selectedQuestions);
      setSaveStatus({
        type: 'success',
        message: `🎲 Sampled ${result.selectedQuestions.length} fresh questions from the pool!`
      });
      setTimeout(() => setSaveStatus(null), 5000);
      return;
    }

    try {
      const res = await fetch(`/api/quizzes/${currentQuizId}/next-round`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ count: targetSampleCount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch fresh questions');

      setQuestions(data.questions);
      setSaveStatus({
        type: 'success',
        message: `🎲 Loaded ${data.count} FRESH unasked questions! (${data.remainingCount} questions remaining in bank).`
      });
      setTimeout(() => setSaveStatus(null), 5000);
      fetchSavedQuizzes();
    } catch (err) {
      alert(err.message);
    }
  };

  // Reset question history so all questions in the bank can be asked again
  const handleResetHistory = async (quizIdToReset) => {
    const id = quizIdToReset || currentQuizId;
    if (!id) return;
    if (!window.confirm('Reset question history for this classroom? All questions in the bank will be marked as unasked/fresh again.')) return;

    try {
      const res = await fetch(`/api/quizzes/${id}/reset-history`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset history');

      setSaveStatus({
        type: 'success',
        message: '🔄 Question history reset! All questions in the bank are fresh again.'
      });
      setTimeout(() => setSaveStatus(null), 5000);
      fetchSavedQuizzes();
    } catch (err) {
      alert(err.message);
    }
  };

  // Save current questions & title to host's personal library
  const handleSaveToLibrary = async () => {
    if (!questions || questions.length === 0) {
      alert('Please add or upload at least one question before saving.');
      return;
    }

    const titleToSave = quizTitle.trim() || 'My Classroom Quiz';
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          id: currentQuizId || undefined,
          title: titleToSave,
          questions,
          questionPool: questionPool || questions,
          defaultSampleCount: targetSampleCount
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save classroom');

      if (data.quiz) {
        setCurrentQuizId(data.quiz.id);
        setSaveStatus({
          type: 'success',
          message: `Classroom "${data.quiz.title}" (${questions.length} questions, pool of ${data.quiz.totalPoolCount || questions.length}) saved to your personal library!`
        });
        setTimeout(() => setSaveStatus(null), 5000);
        fetchSavedQuizzes();
      }
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Failed to save classroom'
      });
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // Load a saved quiz into the active editor
  const handleLoadSavedQuiz = (quiz) => {
    setQuizTitle(quiz.title);
    setQuestions(quiz.questions);
    const pool = (quiz.questionPool && quiz.questionPool.length > 0) ? quiz.questionPool : quiz.questions;
    setQuestionPool(pool);
    setPoolSourceInfo(`Saved Classroom "${quiz.title}" (${pool.length} question bank)`);
    setCurrentQuizId(quiz.id);
    if (quiz.defaultSampleCount) {
      setTargetSampleCount(quiz.defaultSampleCount);
    }
    setUploadStatus({
      type: 'success',
      message: `Loaded classroom "${quiz.title}" (${quiz.questions.length} questions active • ${pool.length} in bank). Ready to host or edit!`
    });
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  // Directly host a saved quiz with same questions
  const handleDirectHost = async (quiz) => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          quizId: quiz.id,
          quizTitle: quiz.title,
          questions: quiz.questions
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      onRoomCreated(data);
    } catch (err) {
      alert('Error launching room: ' + err.message);
    }
  };

  // Directly host a saved quiz with fresh questions not asked before
  const handleDirectHostFresh = async (quiz) => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          quizId: quiz.id,
          quizTitle: quiz.title,
          pickFresh: true,
          sampleCount: quiz.defaultSampleCount || targetSampleCount || 20
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      onRoomCreated(data);
    } catch (err) {
      alert('Error launching room with fresh questions: ' + err.message);
    }
  };

  // Delete a saved quiz from host's library
  const handleDeleteSavedQuiz = async (quizId, title) => {
    if (!window.confirm(`Are you sure you want to delete the saved classroom "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        if (currentQuizId === quizId) {
          setCurrentQuizId(null);
        }
        fetchSavedQuizzes();
      }
    } catch (err) {
      console.error('Failed to delete quiz:', err);
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
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
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

  const filteredQuizzes = savedQuizzes.filter(q =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="min-h-screen py-8 px-4 md:px-8 transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bgHex, color: currentTheme.textPrimaryHex }}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Host Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: currentTheme.borderHex }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs"
              style={{ backgroundColor: currentTheme.timerColor }}
            >
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ color: currentTheme.textPrimaryHex }}>
                Pulse<span className={currentTheme.accentText}>Quiz</span> Host Workspace
              </h1>
              <p className="text-xs font-medium" style={{ color: currentTheme.textSecondaryHex }}>
                Protected host area • Isolated question sets & rooms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hostUser && (
              <span
                className="text-xs font-bold border px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs"
                style={{
                  backgroundColor: currentTheme.cardHex,
                  borderColor: currentTheme.borderHex,
                  color: currentTheme.textPrimaryHex
                }}
              >
                <User size={13} style={{ color: currentTheme.timerColor }} />
                <span>{hostUser.username}</span>
              </span>
            )}

            <button
              type="button"
              onClick={onBackToPlayer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition hover:opacity-80 cursor-pointer shadow-2xs"
              style={{
                backgroundColor: currentTheme.cardHex,
                borderColor: currentTheme.borderHex,
                color: currentTheme.textPrimaryHex
              }}
            >
              <ArrowLeft size={13} />
              <span>Join PIN View</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
            >
              <LogOut size={13} />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* 10 Aesthetic Themes Selector */}
        <div
          className="border rounded-3xl p-6 shadow-sm transition-colors duration-300"
          style={{ backgroundColor: currentTheme.cardHex, borderColor: currentTheme.borderHex }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette size={18} style={{ color: currentTheme.timerColor }} />
              <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: currentTheme.textPrimaryHex }}>
                Select Aesthetic Theme (10 Styles)
              </h3>
            </div>
            <span className="text-xs font-bold" style={{ color: currentTheme.textSecondaryHex }}>
              Active: <strong style={{ color: currentTheme.textPrimaryHex }}>{currentTheme.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {THEMES.map((theme) => {
              const isSelected = theme.id === activeThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onSelectTheme(theme.id)}
                  className="p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? currentTheme.innerBoxHex : theme.cardHex,
                    borderColor: isSelected ? currentTheme.timerColor : currentTheme.borderHex,
                    boxShadow: isSelected ? `0 0 0 2px ${currentTheme.timerColor}80` : 'none'
                  }}
                >
                  <div className="flex items-center -space-x-1.5 mb-2">
                    {theme.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full border-2 border-white shadow-xs"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold truncate" style={{ color: currentTheme.textPrimaryHex }}>{theme.name}</h4>
                    <p className="text-[10px] line-clamp-1" style={{ color: currentTheme.textSecondaryHex }}>{theme.tagline}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SAVED CLASSROOMS & QUIZZES LIBRARY (USER ISOLATED) */}
        <div
          className="border rounded-3xl p-6 md:p-8 shadow-sm space-y-5 transition-colors duration-300"
          style={{ backgroundColor: currentTheme.cardHex, borderColor: currentTheme.borderHex }}
        >
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
            style={{ borderColor: currentTheme.borderHex }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-3 rounded-2xl border"
                style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
              >
                <BookOpen size={22} style={{ color: currentTheme.timerColor }} />
              </div>
              <div>
                <h3 className="font-black text-lg" style={{ color: currentTheme.textPrimaryHex }}>
                  Your Saved Classrooms & Quizzes
                </h3>
                <p className="text-xs" style={{ color: currentTheme.textSecondaryHex }}>
                  Private question banks stored under your account. Launch anytime without re-uploading!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold border px-3 py-1.5 rounded-xl transition"
                style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex, color: currentTheme.textPrimaryHex }}
              >
                {savedQuizzes.length} Saved {savedQuizzes.length === 1 ? 'Classroom' : 'Classrooms'}
              </span>
              <button
                type="button"
                onClick={fetchSavedQuizzes}
                className="p-2 rounded-xl border hover:opacity-80 transition cursor-pointer"
                style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex, color: currentTheme.textPrimaryHex }}
                title="Refresh library"
              >
                <RotateCcw size={14} className={isLoadingSaved ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Search Box if quizzes exist */}
          {savedQuizzes.length > 2 && (
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3" style={{ color: currentTheme.textSecondaryHex }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your saved classrooms..."
                className="w-full border rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none transition"
                style={{
                  backgroundColor: currentTheme.innerBoxHex,
                  borderColor: currentTheme.borderHex,
                  color: currentTheme.textPrimaryHex
                }}
              />
            </div>
          )}

          {/* Cards Grid */}
          {savedQuizzes.length === 0 ? (
            <div
              className="text-center py-8 px-4 rounded-2xl border border-dashed space-y-2 transition"
              style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: currentTheme.cardHex, color: currentTheme.timerColor }}
              >
                <BookmarkPlus size={24} />
              </div>
              <h4 className="font-bold text-sm" style={{ color: currentTheme.textPrimaryHex }}>No Saved Classrooms Yet</h4>
              <p className="text-xs max-w-sm mx-auto" style={{ color: currentTheme.textSecondaryHex }}>
                Upload questions from PDF or Excel below, then click <strong>"Save Classroom"</strong> to store them privately in your account!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuizzes.map((quiz) => {
                const isCurrentlyActive = currentQuizId === quiz.id;
                const formattedDate = quiz.createdAt
                  ? new Date(quiz.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'Saved';

                return (
                  <div
                    key={quiz.id}
                    className="p-4 rounded-2xl border transition-all flex flex-col justify-between"
                    style={{
                      backgroundColor: isCurrentlyActive ? currentTheme.innerBoxHex : currentTheme.cardHex,
                      borderColor: isCurrentlyActive ? currentTheme.timerColor : currentTheme.borderHex,
                      boxShadow: isCurrentlyActive ? `0 0 0 2px ${currentTheme.timerColor}60` : `0 2px 8px ${currentTheme.borderHex}40`
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border"
                          style={{
                            backgroundColor: currentTheme.innerBoxHex,
                            borderColor: currentTheme.borderHex,
                            color: currentTheme.textPrimaryHex
                          }}
                        >
                          <Layers size={11} style={{ color: currentTheme.timerColor }} />
                          {quiz.totalPoolCount || (quiz.questionPool ? quiz.questionPool.length : (quiz.questions ? quiz.questions.length : quiz.questionCount))} Question Bank
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: currentTheme.textSecondaryHex }}>
                          {formattedDate}
                        </span>
                      </div>

                      {/* Question Pool Stats (Fresh Remaining vs Asked) */}
                      {quiz.totalPoolCount > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
                            {quiz.remainingCount !== undefined ? quiz.remainingCount : quiz.totalPoolCount} Fresh Left
                          </span>
                          <span style={{ color: currentTheme.textSecondaryHex }}>•</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-600">
                            {quiz.usedCount || 0} Asked
                          </span>
                        </div>
                      )}

                      {/* Title */}
                      <h4 className="font-black text-sm md:text-base line-clamp-2 mb-1.5" style={{ color: currentTheme.textPrimaryHex }}>
                        {quiz.title}
                      </h4>

                      {/* Question Preview */}
                      {quiz.questions && quiz.questions.length > 0 && (
                        <p className="text-[11px] line-clamp-2 italic mb-3" style={{ color: currentTheme.textSecondaryHex }}>
                          "{quiz.questions[0].questionText}"
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t flex items-center gap-1.5 flex-wrap" style={{ borderColor: currentTheme.borderHex }}>
                      <button
                        type="button"
                        onClick={() => handleDirectHostFresh(quiz)}
                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-gradient-to-r ${currentTheme.accentGradient} text-white font-extrabold text-xs shadow-xs transition transform hover:scale-[1.02] cursor-pointer`}
                        title={`Host fresh questions not asked before (sample of ${quiz.defaultSampleCount || 20})`}
                      >
                        <Play size={12} className="fill-white" /> Host Fresh ({quiz.defaultSampleCount || 20})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDirectHost(quiz)}
                        className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer hover:opacity-85"
                        style={{
                          backgroundColor: currentTheme.innerBoxHex,
                          borderColor: currentTheme.borderHex,
                          color: currentTheme.textPrimaryHex
                        }}
                        title="Host with the current questions"
                      >
                        Play Same
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewingWinnersQuiz(quiz)}
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer hover:opacity-85"
                        style={{
                          backgroundColor: currentTheme.innerBoxHex,
                          borderColor: currentTheme.borderHex,
                          color: currentTheme.timerColor
                        }}
                        title="View Top 10 past winners of this quiz"
                      >
                        <Trophy size={12} /> Winners
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSavedQuiz(quiz)}
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: currentTheme.innerBoxHex,
                          borderColor: currentTheme.borderHex,
                          color: currentTheme.textPrimaryHex
                        }}
                        title="Load into active editor"
                      >
                        <Edit3 size={12} /> Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetHistory(quiz.id)}
                        className="p-2 rounded-xl transition hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
                        style={{ color: currentTheme.textSecondaryHex }}
                        title="Reset question history so all questions are fresh again"
                      >
                        <RotateCcw size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSavedQuiz(quiz.id, quiz.title)}
                        className="p-2 rounded-xl transition hover:text-red-500 hover:bg-red-50/50 cursor-pointer"
                        style={{ color: currentTheme.textSecondaryHex }}
                        title="Delete from library"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ACTIVE QUIZ SETUP CARD */}
        <div
          className="border rounded-3xl p-6 md:p-8 shadow-sm space-y-6 transition-colors duration-300"
          style={{ backgroundColor: currentTheme.cardHex, borderColor: currentTheme.borderHex }}
        >
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: currentTheme.borderHex }}>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest block" style={{ color: currentTheme.timerColor }}>
                Active Classroom Configuration
              </span>
              <h3 className="font-black text-xl" style={{ color: currentTheme.textPrimaryHex }}>
                Create or Host a Classroom
              </h3>
            </div>
            {currentQuizId && (
              <span
                className="text-xs font-bold border px-3 py-1 rounded-xl flex items-center gap-1"
                style={{
                  backgroundColor: currentTheme.innerBoxHex,
                  borderColor: currentTheme.borderHex,
                  color: currentTheme.textPrimaryHex
                }}
              >
                <Check size={13} style={{ color: currentTheme.timerColor }} /> Saved in Your Library
              </span>
            )}
          </div>

          {/* Quiz Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: currentTheme.textSecondaryHex }}>
              Quiz / Classroom Title
            </label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="e.g. Science & Culture Trivia"
              className="w-full border rounded-2xl px-4 py-3 font-semibold text-base focus:outline-none transition"
              style={{
                backgroundColor: currentTheme.innerBoxHex,
                borderColor: currentTheme.borderHex,
                color: currentTheme.textPrimaryHex
              }}
            />
          </div>

          {/* Upload & Ingestion Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: currentTheme.textSecondaryHex }}>
                Upload New Questions Source (PDF / Excel)
              </span>
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-xs flex items-center gap-1 font-medium transition hover:opacity-80"
                style={{ color: currentTheme.textSecondaryHex }}
              >
                <Key size={13} /> {geminiKey ? 'Gemini Key Configured ✓' : 'Add Gemini API Key (Optional)'}
              </button>
            </div>

            {showKeyInput && (
              <div
                className="mb-4 p-4 rounded-2xl border space-y-2 transition"
                style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
              >
                <div className="flex items-center justify-between text-xs" style={{ color: currentTheme.textSecondaryHex }}>
                  <span>Google Gemini API Key for high-accuracy PDF parsing:</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold hover:underline"
                    style={{ color: currentTheme.timerColor }}
                  >
                    Get free key ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => handleKeySave(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  style={{
                    backgroundColor: currentTheme.cardHex,
                    borderColor: currentTheme.borderHex,
                    color: currentTheme.textPrimaryHex
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Excel Card */}
              <div
                className="p-5 rounded-2xl border flex flex-col justify-between transition"
                style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <FileSpreadsheet size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: currentTheme.textPrimaryHex }}>Excel Spreadsheet</h3>
                    <p className="text-xs mt-1" style={{ color: currentTheme.textSecondaryHex }}>
                      Fill our pre-formatted template with questions & options.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold hover:opacity-80 shadow-xs transition"
                    style={{
                      backgroundColor: currentTheme.cardHex,
                      borderColor: currentTheme.borderHex,
                      color: currentTheme.textPrimaryHex
                    }}
                  >
                    <Download size={14} /> Download Template
                  </button>
                  <button
                    type="button"
                    onClick={() => excelInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs transition cursor-pointer"
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
              <div
                className="p-5 rounded-2xl border flex flex-col justify-between transition"
                style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-2xl bg-rose-100 text-rose-800 border border-rose-200">
                      <FileText size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base" style={{ color: currentTheme.textPrimaryHex }}>PDF Exam Documents</h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                          Up to 5 PDFs
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: currentTheme.textSecondaryHex }}>
                        Upload 1 to 5 PDFs. Automatically extracts all questions and answers into your database library.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                  >
                    <Upload size={14} /> Upload & Extract PDFs (Select 1-5 files)
                  </button>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Upload Feedback with Quick Save Button */}
            {uploadStatus && (
              <div
                className={`mt-4 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-medium ${
                  uploadStatus.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {uploadStatus.type === 'success' ? (
                    <CheckCircle size={18} className="shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle size={18} className="shrink-0 text-rose-600" />
                  )}
                  <span>{uploadStatus.message}</span>
                </div>

                {uploadStatus.type === 'success' && (
                  <button
                    type="button"
                    onClick={handleSaveToLibrary}
                    className="shrink-0 flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <BookmarkPlus size={14} /> Save to Library
                  </button>
                )}
              </div>
            )}

            {/* Save Status Notification */}
            {saveStatus && (
              <div
                className={`mt-3 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-fade-in ${
                  saveStatus.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <CheckCircle size={16} className="shrink-0 text-emerald-600" />
                <span>{saveStatus.message}</span>
              </div>
            )}
          </div>

          {/* Question Pool & Serial Option Mixer Panel */}
          <div
            className="p-5 rounded-2xl border transition-all duration-300 space-y-4"
            style={{
              backgroundColor: currentTheme.innerBoxHex,
              borderColor: questionPool ? currentTheme.timerColor : currentTheme.borderHex,
              boxShadow: questionPool ? `0 0 0 1px ${currentTheme.timerColor}40` : 'none'
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl border flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: currentTheme.cardHex,
                    borderColor: currentTheme.borderHex,
                    color: currentTheme.timerColor
                  }}
                >
                  <Dice5 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black" style={{ color: currentTheme.textPrimaryHex }}>
                      Question Pool & Serial Option Mixer
                    </h4>
                    {questionPool && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Pool Active ({questionPool.length} Total)
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: currentTheme.textSecondaryHex }}>
                    {questionPool
                      ? `Extracted pool has ${questionPool.length} questions across ${poolSourceInfo || 'uploaded documents'}. Re-sample any count anytime!`
                      : `Serial mixing guarantees consecutive questions have non-repeating answers (e.g. A → D → C, never A → A).`}
                  </p>
                </div>
              </div>

              {/* Option Mixing & Fresh Round Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleNextRoundFreshQuestions}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r ${currentTheme.accentGradient} text-white font-extrabold text-xs shadow-xs transition hover:opacity-95 cursor-pointer`}
                  title="Loads a fresh batch of questions from the pool that haven't been asked yet in previous games!"
                >
                  <Dice5 size={14} className="fill-white" />
                  <span>Next Round ({targetSampleCount} Fresh)</span>
                </button>

                <button
                  type="button"
                  onClick={handleShuffleCurrentOptions}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition hover:opacity-80 shadow-xs cursor-pointer"
                  style={{
                    backgroundColor: currentTheme.cardHex,
                    borderColor: currentTheme.borderHex,
                    color: currentTheme.textPrimaryHex
                  }}
                  title="Mixes options so consecutive questions never share the same answer letter"
                >
                  <Shuffle size={13} style={{ color: currentTheme.timerColor }} />
                  <span>Mix Options (A, B, C, D)</span>
                </button>

                {currentQuizId && (
                  <button
                    type="button"
                    onClick={() => handleResetHistory(currentQuizId)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-bold transition hover:opacity-80 shadow-xs cursor-pointer"
                    style={{
                      backgroundColor: currentTheme.cardHex,
                      borderColor: currentTheme.borderHex,
                      color: currentTheme.textSecondaryHex
                    }}
                    title="Reset history so all questions in the bank are marked as fresh again"
                  >
                    <RotateCcw size={12} />
                    <span>Reset Pool</span>
                  </button>
                )}
              </div>
            </div>

            {/* Random Sampling Row */}
            <div
              className="p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3"
              style={{ backgroundColor: currentTheme.cardHex, borderColor: currentTheme.borderHex }}
            >
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: currentTheme.textPrimaryHex }}>
                <Sliders size={14} style={{ color: currentTheme.timerColor }} />
                <span>Pick Random Questions:</span>
                <span className="text-[11px] font-normal" style={{ color: currentTheme.textSecondaryHex }}>
                  (Target: {targetSampleCount} of {questionPool ? questionPool.length : questions.length})
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[10, 15, 20, 25, 30, 50].map((n) => {
                  const maxAllowed = questionPool ? questionPool.length : questions.length;
                  const disabled = n > maxAllowed;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleResample(n)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        targetSampleCount === n && questions.length === n
                          ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                          : disabled
                            ? 'opacity-40 cursor-not-allowed bg-stone-100 border-stone-200 text-stone-400'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}

                {/* All Button */}
                {questionPool && questionPool.length > 50 && (
                  <button
                    type="button"
                    onClick={() => handleResample(questionPool.length)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border bg-white border-stone-200 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                  >
                    All ({questionPool.length})
                  </button>
                )}

                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="number"
                    min="1"
                    max={questionPool ? questionPool.length : 500}
                    value={targetSampleCount}
                    onChange={(e) => setTargetSampleCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 px-2 py-1 rounded-lg border text-xs font-bold text-center focus:outline-none"
                    style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex, color: currentTheme.textPrimaryHex }}
                  />
                  <button
                    type="button"
                    onClick={() => handleResample(targetSampleCount)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r ${currentTheme.accentGradient} text-white font-black text-xs shadow-xs transition hover:opacity-90 cursor-pointer`}
                  >
                    <Dice5 size={13} />
                    <span>Pick Random {targetSampleCount}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Current Questions Summary & Actions */}
          <div
            className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300"
            style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl border flex items-center justify-center font-bold shadow-xs"
                style={{
                  backgroundColor: currentTheme.cardHex,
                  borderColor: currentTheme.borderHex,
                  color: currentTheme.timerColor
                }}
              >
                {questions.length}
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: currentTheme.textPrimaryHex }}>
                  {quizTitle || 'Current Quiz'}
                </h4>
                <p className="text-xs" style={{ color: currentTheme.textSecondaryHex }}>
                  {questions.length} Questions loaded • 10 Points max per question
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Save Classroom Button */}
              <button
                type="button"
                onClick={handleSaveToLibrary}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-xs transition cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: currentTheme.cardHex,
                  borderColor: currentTheme.borderHex,
                  color: currentTheme.textPrimaryHex
                }}
              >
                <Save size={14} style={{ color: currentTheme.timerColor }} /> Save Classroom
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuestions(DEFAULT_SAMPLE_QUESTIONS);
                  setQuizTitle('Friday Tech & Science Trivia');
                  setCurrentQuizId(null);
                }}
                className="px-3 py-2 rounded-xl border text-xs font-semibold hover:opacity-80 transition cursor-pointer"
                style={{
                  backgroundColor: currentTheme.cardHex,
                  borderColor: currentTheme.borderHex,
                  color: currentTheme.textSecondaryHex
                }}
              >
                Reset to Sample
              </button>

              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition cursor-pointer hover:opacity-90 shadow-xs"
                style={{
                  backgroundColor: currentTheme.timerColor,
                  borderColor: currentTheme.timerColor,
                  color: '#FFFFFF'
                }}
              >
                <Edit3 size={14} /> Review & Edit ({questions.length})
              </button>
            </div>
          </div>

          {/* Global Question Timer Selector */}
          <div
            className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors duration-300"
            style={{ backgroundColor: currentTheme.innerBoxHex, borderColor: currentTheme.borderHex }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl border flex items-center justify-center shadow-xs"
                style={{ backgroundColor: currentTheme.cardHex, borderColor: currentTheme.borderHex, color: currentTheme.timerColor }}
              >
                <Clock size={17} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: currentTheme.textPrimaryHex }}>
                  Question Timer Setting
                </h4>
                <p className="text-[11px]" style={{ color: currentTheme.textSecondaryHex }}>
                  Set time limit allowed for participants to answer each question
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[10, 15, 20, 30, 45, 60].map((sec) => {
                const isAllThisTime = questions.length > 0 && questions.every(q => (q.timeLimitSeconds || 20) === sec);
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setQuestions(prev => prev.map(q => ({ ...q, timeLimitSeconds: sec })));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                      isAllThisTime
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                    title={`Apply ${sec}s timer to all questions`}
                  >
                    {sec}s
                  </button>
                );
              })}
            </div>
          </div>

          {/* Launch Room Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isUploading || questions.length === 0}
              className={`w-full py-4 rounded-2xl bg-gradient-to-r ${currentTheme.accentGradient} text-white font-black text-lg flex items-center justify-center gap-2 shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer`}
            >
              <Play size={20} className="fill-white" /> Launch Room & Project QR Code
            </button>
            <p className="text-center text-xs mt-2 font-medium" style={{ color: currentTheme.textSecondaryHex }}>
              Displays presenter screen with 6-digit PIN and mobile QR code for all participants.
            </p>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <QuestionEditorModal
          questions={questions}
          activeThemeId={activeThemeId}
          onSave={(updated) => {
            setQuestions(updated);
            setIsEditorOpen(false);
          }}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      {/* Past Winners Hall of Fame Modal */}
      {viewingWinnersQuiz && (
        <PastWinnersModal
          isOpen={Boolean(viewingWinnersQuiz)}
          quiz={viewingWinnersQuiz}
          activeThemeId={activeThemeId}
          onClose={() => setViewingWinnersQuiz(null)}
        />
      )}
    </div>
  );
}
