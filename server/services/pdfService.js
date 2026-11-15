const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

/**
 * Extracts multiple choice questions from a PDF buffer using:
 * 1. Google Gemini Multimodal API if an API key is available
 * 2. Intelligent local Regex & heuristic tokenizer fallback
 */
async function parsePdfBuffer(buffer, apiKey = null) {
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      const aiQuestions = await extractWithGemini(buffer, geminiKey);
      if (aiQuestions && aiQuestions.length > 0) {
        return aiQuestions;
      }
    } catch (err) {
      console.warn('Gemini PDF extraction failed or unavailable, falling back to local heuristic parser:', err.message);
    }
  }

  // Tier 2: Local heuristic parser
  return await extractWithLocalParser(buffer);
}

/**
 * Uses Gemini 2.5 Flash with structured output schema to extract questions from PDF bytes.
 */
async function extractWithGemini(buffer, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Extract all multiple choice questions (MCQs) from this document.
For each question:
1. Provide the exact question text.
2. Provide exactly 4 distinct options (Option A, Option B, Option C, Option D).
3. Identify the correct answer (0 for A, 1 for B, 2 for C, 3 for D). If an answer key is provided in the document, use it. If not explicitly stated, logically determine the correct answer.
4. Set timeLimitSeconds to 20 by default (or as appropriate).
5. Provide a brief explanation if available.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        description: 'List of extracted multiple choice quiz questions',
        items: {
          type: 'object',
          properties: {
            questionText: { type: 'string', description: 'The question text' },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Four options: [Option A, Option B, Option C, Option D]'
            },
            correctOptionIndex: {
              type: 'integer',
              description: 'Index of correct answer: 0 for A, 1 for B, 2 for C, 3 for D'
            },
            timeLimitSeconds: { type: 'integer', description: 'Timer in seconds (e.g. 20)' },
            explanation: { type: 'string', description: 'Brief explanation' }
          },
          required: ['questionText', 'options', 'correctOptionIndex']
        }
      }
    }
  });

  const rawJson = response.text;
  const parsed = JSON.parse(rawJson);

  return parsed.map(q => ({
    id: uuidv4(),
    questionText: q.questionText.trim(),
    options: (q.options || []).slice(0, 4).map(opt => opt.trim()),
    correctOptionIndex: Math.min(3, Math.max(0, q.correctOptionIndex || 0)),
    timeLimitSeconds: q.timeLimitSeconds || 20,
    pointsPossible: 1000,
    explanation: q.explanation || ''
  }));
}

/**
 * Intelligent local Regex & heuristic tokenizer fallback for standard formatted PDFs.
 */
async function extractWithLocalParser(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;

  if (!text || text.trim().length === 0) {
    throw new Error('The PDF document appears to have no extractable text. Please ensure it is not a scanned image or provide a Gemini API key for OCR parsing.');
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const questions = [];

  let currentQuestion = null;

  // Regex patterns
  const qStartRegex = /^(?:Q(?:uestion)?\s*[\d]+|[\d]{1,3})[\.\:\)]\s*(.*)/i;
  const optARegex = /^(?:[\(]?[A1][\)\.\:\-]\s*|A\s*[\.\:\-]\s*)(.*)/i;
  const optBRegex = /^(?:[\(]?[B2][\)\.\:\-]\s*|B\s*[\.\:\-]\s*)(.*)/i;
  const optCRegex = /^(?:[\(]?[C3][\)\.\:\-]\s*|C\s*[\.\:\-]\s*)(.*)/i;
  const optDRegex = /^(?:[\(]?[D4][\)\.\:\-]\s*|D\s*[\.\:\-]\s*)(.*)/i;
  const ansRegex = /^(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\:\s\-]+([A-D1-4])/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const qMatch = line.match(qStartRegex);
    if (qMatch) {
      if (currentQuestion && currentQuestion.questionText && currentQuestion.options.length >= 2) {
        questions.push(finalizeQuestion(currentQuestion));
      }
      currentQuestion = {
        questionText: qMatch[1].trim(),
        options: [],
        correctOptionIndex: 0,
        explanation: ''
      };
      continue;
    }

    if (!currentQuestion) continue;

    // Check if line contains answer key
    const ansMatch = line.match(ansRegex);
    if (ansMatch) {
      const char = ansMatch[1].toUpperCase();
      if (char === 'A' || char === '1') currentQuestion.correctOptionIndex = 0;
      else if (char === 'B' || char === '2') currentQuestion.correctOptionIndex = 1;
      else if (char === 'C' || char === '3') currentQuestion.correctOptionIndex = 2;
      else if (char === 'D' || char === '4') currentQuestion.correctOptionIndex = 3;
      continue;
    }

    // Check Option lines
    const aMatch = line.match(optARegex);
    const bMatch = line.match(optBRegex);
    const cMatch = line.match(optCRegex);
    const dMatch = line.match(optDRegex);

    if (aMatch) {
      currentQuestion.options[0] = aMatch[1].trim();
    } else if (bMatch) {
      currentQuestion.options[1] = bMatch[1].trim();
    } else if (cMatch) {
      currentQuestion.options[2] = cMatch[1].trim();
    } else if (dMatch) {
      currentQuestion.options[3] = dMatch[1].trim();
    } else {
      // Continuation of question text if no options registered yet
      if (currentQuestion.options.length === 0) {
        currentQuestion.questionText += ' ' + line;
      }
    }
  }

  // Final question push
  if (currentQuestion && currentQuestion.questionText && currentQuestion.options.length >= 2) {
    questions.push(finalizeQuestion(currentQuestion));
  }

  if (questions.length === 0) {
    throw new Error('Could not automatically parse standard questions from this PDF layout. Try using the Excel template or provide a Gemini API key for advanced AI document parsing.');
  }

  return questions;
}

function finalizeQuestion(q) {
  // Ensure exactly 4 options
  const opts = [
    q.options[0] || 'Option A',
    q.options[1] || 'Option B',
    q.options[2] || 'Option C',
    q.options[3] || 'Option D'
  ];

  return {
    id: uuidv4(),
    questionText: q.questionText,
    options: opts,
    correctOptionIndex: q.correctOptionIndex || 0,
    timeLimitSeconds: 20,
    pointsPossible: 1000,
    explanation: q.explanation || ''
  };
}

module.exports = {
  parsePdfBuffer
};
