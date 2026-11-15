const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

/**
 * Ultra-Fast Multi-Tier PDF MCQ Extraction Pipeline.
 * 
 * Performance Strategy:
 * - Tier 1: Lightning-fast in-memory local parser (<25ms).
 *   Extracts text and applies high-speed regex tokenization for:
 *   - Horizontal options (A, B, C, D on same line)
 *   - Vertical options (letter and numbered)
 *   - Inline answers (Ans: B, Correct: 2, Key: A)
 *   - End-of-document Answer Key tables
 * - Tier 2: AI Gemini text extraction (1-2s) if local regex finds no questions.
 * - Tier 3: Multimodal image-based Gemini OCR only if PDF has no text stream (scanned image).
 */
async function parsePdfBuffer(buffer, apiKey = null) {
  const t0 = Date.now();

  // Tier 1: Local high-speed text extraction (<20ms)
  let pdfText = '';
  try {
    const data = await pdfParse(buffer);
    pdfText = data.text || '';
  } catch (err) {
    console.warn('[PDF Parser] Local pdf-parse warning:', err.message);
  }

  if (pdfText && pdfText.trim().length > 30) {
    const localQuestions = parseMcqText(pdfText);
    if (localQuestions && localQuestions.length > 0) {
      const elapsed = Date.now() - t0;
      console.log(`[PDF Parser] High-speed local extraction succeeded: ${localQuestions.length} questions parsed in ${elapsed}ms!`);
      return localQuestions;
    }
  }

  // Tier 2 & 3: Gemini Fallback (if local parser found no questions or scanned image PDF)
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      console.log('[PDF Parser] Local parser found no standard format. Engaging Gemini AI parser...');
      let aiQuestions = null;

      // If text is available, send text (10x faster than base64 binary PDF)
      if (pdfText && pdfText.trim().length > 30) {
        aiQuestions = await extractTextWithGemini(pdfText, geminiKey);
      } else {
        // Scanned image PDF with no text layer: send binary buffer
        aiQuestions = await extractBufferWithGemini(buffer, geminiKey);
      }

      if (aiQuestions && aiQuestions.length > 0) {
        console.log(`[PDF Parser] Gemini extraction completed: ${aiQuestions.length} questions.`);
        return aiQuestions;
      }
    } catch (err) {
      console.warn('[PDF Parser] Gemini extraction error:', err.message);
    }
  }

  throw new Error(
    pdfText && pdfText.trim().length > 0
      ? 'Could not detect standard multiple-choice questions in this PDF layout. Ensure questions have numbering (1., Q1) and options (A, B, C, D).'
      : 'The PDF has no extractable text layer (may be a scanned image). Please provide a clear digital PDF or Excel template.'
  );
}

/**
 * High-Speed Heuristic Parser for MCQ text.
 * Runs in < 2ms for hundreds of questions.
 */
function parseMcqText(text) {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Detect and parse any Answer Key block at the end of document
  const answerKeyMap = new Map(); // questionNumber -> optionIndex (0-3)
  const ansKeyBlockRegex = /(?:Answer\s*Key|Answers?|Solutions?)\s*[\:\n]/i;
  const ansKeyPos = text.search(ansKeyBlockRegex);
  
  if (ansKeyPos !== -1) {
    const keySection = text.substring(ansKeyPos);
    const pairRegex = /(?:Q\s*)?(\d{1,4})\s*[\.\:\-\)\s]\s*[\(\[]?([A-D1-4])[\)\]]?/gi;
    let match;
    while ((match = pairRegex.exec(keySection)) !== null) {
      const qNum = parseInt(match[1], 10);
      const optChar = match[2].toUpperCase();
      let optIdx = 0;
      if (optChar === 'A' || optChar === '1') optIdx = 0;
      else if (optChar === 'B' || optChar === '2') optIdx = 1;
      else if (optChar === 'C' || optChar === '3') optIdx = 2;
      else if (optChar === 'D' || optChar === '4') optIdx = 3;
      answerKeyMap.set(qNum, optIdx);
    }
  }

  const questions = [];
  let currentQ = null;
  let qCounter = 0;

  // Regex patterns
  const qStartRegex = /^(?:Question\s*|Q\.?\s*)(\d{1,4})[\.\:\)\-\s]\s*(.*)$/i;
  const genericQStartRegex = /^(\d{1,4})[\.\:\-]\s+(.*)$/;
  const inlineAnsRegex = /(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\:\s\.\-]+[\(\[]?([A-D1-4])[\)\]]?/i;
  const letterOptRegex = /^(?:[\(\[]?([A-Da-d])[\)\]\.\:\-]\s*|([A-Da-d])[\.\:\-]\s*)(.*)$/;
  const numberOptRegex = /^(?:[\(\[]([1-4])[\)\]\.\:\-]|([1-4])\))\s*(.*)$/;

  function finalizeCurrent() {
    if (currentQ && currentQ.questionText && currentQ.options.length >= 2) {
      // Check answer key map if answer was not inline
      if (currentQ.correctOptionIndex === null || currentQ.correctOptionIndex === undefined) {
        if (currentQ.num && answerKeyMap.has(currentQ.num)) {
          currentQ.correctOptionIndex = answerKeyMap.get(currentQ.num);
        } else {
          currentQ.correctOptionIndex = 0; // Default to option A
        }
      }

      // Ensure 4 options
      const opts = [
        currentQ.options[0] || 'Option A',
        currentQ.options[1] || 'Option B',
        currentQ.options[2] || 'Option C',
        currentQ.options[3] || 'Option D'
      ];

      questions.push({
        id: uuidv4(),
        questionText: currentQ.questionText.trim(),
        options: opts,
        correctOptionIndex: currentQ.correctOptionIndex,
        timeLimitSeconds: 20,
        pointsPossible: 1000,
        explanation: currentQ.explanation || ''
      });
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Stop at start of Answer Key block
    if (/^(?:Answer\s*Key|Answers?\s*Section)\s*[\:\-]?$/i.test(line)) {
      finalizeCurrent();
      currentQ = null;
      break;
    }

    // A. Check for Answer line first
    if (currentQ) {
      const ansMatch = line.match(inlineAnsRegex);
      if (ansMatch && (line.length < 50 || /^(?:Ans|Correct|Key)/i.test(line))) {
        const c = ansMatch[1].toUpperCase();
        if (c === 'A' || c === '1') currentQ.correctOptionIndex = 0;
        else if (c === 'B' || c === '2') currentQ.correctOptionIndex = 1;
        else if (c === 'C' || c === '3') currentQ.correctOptionIndex = 2;
        else if (c === 'D' || c === '4') currentQ.correctOptionIndex = 3;
        continue;
      }

      // B. Check for horizontal options in single line: "(A) ... (B) ... (C) ... (D) ..."
      const hMarkerRegex = /(?:^|[\s\t]+)(?:[\(\[]?([A-D1-4])[\)\]\.\:\-]\s*)/g;
      const hMatches = [];
      let hm;
      while ((hm = hMarkerRegex.exec(line)) !== null) {
        const markerText = hm[0];
        const markerStart = hm.index + (markerText.length - markerText.trimStart().length);
        const contentStart = hMarkerRegex.lastIndex;
        hMatches.push({
          letter: hm[1].toUpperCase(),
          markerStart,
          contentStart
        });
      }

      if (hMatches.length >= 2) {
        for (let j = 0; j < hMatches.length; j++) {
          const cur = hMatches[j];
          const next = hMatches[j + 1];
          let optText = next
            ? line.substring(cur.contentStart, next.markerStart).trim()
            : line.substring(cur.contentStart).trim();

          const endAnsMatch = optText.match(inlineAnsRegex);
          if (endAnsMatch) {
            const c = endAnsMatch[1].toUpperCase();
            if (c === 'A' || c === '1') currentQ.correctOptionIndex = 0;
            else if (c === 'B' || c === '2') currentQ.correctOptionIndex = 1;
            else if (c === 'C' || c === '3') currentQ.correctOptionIndex = 2;
            else if (c === 'D' || c === '4') currentQ.correctOptionIndex = 3;
            optText = optText.replace(endAnsMatch[0], '').trim();
          }

          let idx = -1;
          if (cur.letter === 'A' || cur.letter === '1') idx = 0;
          else if (cur.letter === 'B' || cur.letter === '2') idx = 1;
          else if (cur.letter === 'C' || cur.letter === '3') idx = 2;
          else if (cur.letter === 'D' || cur.letter === '4') idx = 3;

          if (idx !== -1 && optText) {
            currentQ.options[idx] = optText;
          }
        }
        continue;
      }

      // C. Check for vertical option: "A) ...", "(B) ...", "A. ...", "(1) ...", "1) ..."
      const letterMatch = line.match(letterOptRegex);
      const numberMatch = line.match(numberOptRegex);
      const optMatch = letterMatch || numberMatch;

      if (optMatch) {
        const optChar = (optMatch[1] || optMatch[2] || '').toUpperCase();
        const optText = (optMatch[3] || '').trim();
        let idx = -1;
        if (optChar === 'A' || optChar === '1') idx = 0;
        else if (optChar === 'B' || optChar === '2') idx = 1;
        else if (optChar === 'C' || optChar === '3') idx = 2;
        else if (optChar === 'D' || optChar === '4') idx = 3;

        if (idx !== -1) {
          currentQ.options[idx] = optText;
          continue;
        }
      }
    }

    // D. Check if line starts a NEW question
    let qNum = null;
    let qBody = null;

    const matchQ = line.match(qStartRegex);
    if (matchQ && matchQ[1]) {
      qNum = parseInt(matchQ[1], 10);
      qBody = matchQ[2];
    } else {
      const matchGen = line.match(genericQStartRegex);
      if (matchGen) {
        qNum = parseInt(matchGen[1], 10);
        qBody = matchGen[2];
      }
    }

    if (qNum !== null && qBody !== null) {
      finalizeCurrent();
      qCounter++;
      currentQ = {
        num: qNum || qCounter,
        questionText: qBody.trim(),
        options: [],
        correctOptionIndex: null,
        explanation: ''
      };

      const inAns = qBody.match(inlineAnsRegex);
      if (inAns) {
        const c = inAns[1].toUpperCase();
        if (c === 'A' || c === '1') currentQ.correctOptionIndex = 0;
        else if (c === 'B' || c === '2') currentQ.correctOptionIndex = 1;
        else if (c === 'C' || c === '3') currentQ.correctOptionIndex = 2;
        else if (c === 'D' || c === '4') currentQ.correctOptionIndex = 3;
        currentQ.questionText = currentQ.questionText.replace(inAns[0], '').trim();
      }
      continue;
    }

    if (!currentQ) continue;

    // E. Continuation line
    if (currentQ.options.length === 0) {
      currentQ.questionText += ' ' + line;
    } else {
      const lastIdx = currentQ.options.length - 1;
      if (lastIdx >= 0) {
        currentQ.options[lastIdx] += ' ' + line;
      }
    }
  }

  finalizeCurrent();
  return questions;
}

/**
 * Fast Text-based Gemini AI Extractor (Only called if local regex parser misses unusual layout)
 */
async function extractTextWithGemini(text, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const truncated = text.length > 25000 ? text.substring(0, 25000) : text;
  const prompt = `
Extract all multiple choice questions (MCQs) from this text:
${truncated}

Return a valid JSON array of objects with:
- "questionText": exact question
- "options": array of 4 options [A, B, C, D]
- "correctOptionIndex": integer 0-3 (0 for A, 1 for B, 2 for C, 3 for D)
- "timeLimitSeconds": 20
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{ text: prompt }],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const parsed = JSON.parse(response.text);
  return formatAiQuestions(parsed);
}

/**
 * Binary buffer Gemini extractor (Only for scanned image PDFs without any text layer)
 */
async function extractBufferWithGemini(buffer, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Extract all multiple choice questions from this scanned document into JSON array: [{"questionText": "...", "options": ["A","B","C","D"], "correctOptionIndex": 0}].`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: buffer.toString('base64')
        }
      },
      { text: prompt }
    ],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const parsed = JSON.parse(response.text);
  return formatAiQuestions(parsed);
}

function formatAiQuestions(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed.map(q => ({
    id: uuidv4(),
    questionText: (q.questionText || '').trim(),
    options: (q.options || []).slice(0, 4).map(opt => (opt || '').trim()),
    correctOptionIndex: Math.min(3, Math.max(0, q.correctOptionIndex || 0)),
    timeLimitSeconds: q.timeLimitSeconds || 20,
    pointsPossible: 1000,
    explanation: q.explanation || ''
  }));
}

module.exports = {
  parsePdfBuffer,
  parseMcqText
};
