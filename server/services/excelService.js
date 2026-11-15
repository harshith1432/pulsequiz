const writeXlsxFile = require('write-excel-file/node');
const readXlsxFile = require('read-excel-file/node');
const { v4: uuidv4 } = require('uuid');

/**
 * Sanitizes cell text to protect against CSV / Formula Injection (CWE-1236)
 * and prototype tampering. Strips leading formula characters (=, +, -, @, |, \t, \r).
 */
function sanitizeCellText(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (/^[=+\-@|\t\r]/.test(str)) {
    str = str.replace(/^[=+\-@|\t\r]+/, '').trim();
  }
  return str;
}

/**
 * Generates a styled Excel template workbook as a Buffer.
 * Uses write-excel-file (0-vulnerability, no SheetJS prototype pollution).
 */
async function generateTemplateBuffer() {
  const HEADER_ROW = [
    { value: 'Question', fontWeight: 'bold' },
    { value: 'Option A', fontWeight: 'bold' },
    { value: 'Option B', fontWeight: 'bold' },
    { value: 'Option C', fontWeight: 'bold' },
    { value: 'Option D', fontWeight: 'bold' },
    { value: 'Correct Option', fontWeight: 'bold' },
    { value: 'Time Limit (seconds)', fontWeight: 'bold' },
    { value: 'Explanation', fontWeight: 'bold' }
  ];

  const sampleQuestions = [
    [
      { value: 'Which planet is known as the Red Planet?' },
      { value: 'Venus' },
      { value: 'Mars' },
      { value: 'Jupiter' },
      { value: 'Saturn' },
      { value: 'B' },
      { value: 20 },
      { value: 'Mars appears red because of iron oxide (rust) on its surface.' }
    ],
    [
      { value: 'What is the speed of light in vacuum approximately?' },
      { value: '300,000 km/s' },
      { value: '150,000 km/s' },
      { value: '1,000,000 km/s' },
      { value: '3,000 km/s' },
      { value: 'A' },
      { value: 20 },
      { value: 'Light travels at approximately 299,792 kilometers per second in a vacuum.' }
    ],
    [
      { value: 'Which programming language is known as the backbone of modern web browsers?' },
      { value: 'Python' },
      { value: 'Java' },
      { value: 'JavaScript' },
      { value: 'C++' },
      { value: 'C' },
      { value: 15 },
      { value: 'JavaScript executes natively inside modern web engines alongside HTML and CSS.' }
    ],
    [
      { value: 'What is the capital city of Australia?' },
      { value: 'Sydney' },
      { value: 'Melbourne' },
      { value: 'Canberra' },
      { value: 'Brisbane' },
      { value: 'C' },
      { value: 20 },
      { value: 'Canberra was chosen as the compromise capital between Sydney and Melbourne in 1908.' }
    ],
    [
      { value: 'Which element has the chemical symbol "Au"?' },
      { value: 'Silver' },
      { value: 'Argon' },
      { value: 'Gold' },
      { value: 'Aluminum' },
      { value: 'C' },
      { value: 15 },
      { value: 'Au comes from the Latin word for gold, "aurum", meaning shining dawn.' }
    ]
  ];

  const sheetData = [HEADER_ROW, ...sampleQuestions];
  const fileObj = await writeXlsxFile(sheetData, { buffer: true });
  return await fileObj.toBuffer();
}

/**
 * Parses an uploaded Excel buffer into an array of validated questions.
 * Safeguarded against formula injection, prototype pollution, and malformed structures.
 */
async function parseExcelBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('A valid file buffer is required for Excel parsing.');
  }

  const rawResult = await readXlsxFile(buffer);
  const rows = (Array.isArray(rawResult) && rawResult.length > 0 && Array.isArray(rawResult[0].data))
    ? rawResult[0].data
    : rawResult;

  if (!rows || !Array.isArray(rows) || rows.length < 2) {
    throw new Error('The uploaded Excel sheet contains no readable rows or is missing header columns.');
  }

  // Header row to find column indices
  const headers = rows[0].map(h => (h !== null && h !== undefined ? String(h).trim().toLowerCase() : ''));

  const findCol = (aliases) => {
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      for (const alias of aliases) {
        if (h === alias.toLowerCase()) return c;
      }
    }
    return -1;
  };

  const qCol = findCol(['Question', 'question', 'Question Text', 'Prompt', 'QUESTION']);
  const aCol = findCol(['Option A', 'option a', 'A', 'Option 1']);
  const bCol = findCol(['Option B', 'option b', 'B', 'Option 2']);
  const cCol = findCol(['Option C', 'option c', 'C', 'Option 3']);
  const dCol = findCol(['Option D', 'option d', 'D', 'Option 4']);
  const corCol = findCol(['Correct Option', 'Correct Answer', 'Correct', 'Answer', 'correct', 'answer']);
  const timeCol = findCol(['Time Limit (seconds)', 'Time Limit', 'Timer', 'Time']);
  const expCol = findCol(['Explanation', 'explanation']);

  if (qCol === -1) {
    throw new Error('Missing required "Question" column in Excel header.');
  }

  const questions = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    const questionText = sanitizeCellText(row[qCol]);
    if (!questionText) continue;

    const optA = aCol !== -1 ? sanitizeCellText(row[aCol]) : '';
    const optB = bCol !== -1 ? sanitizeCellText(row[bCol]) : '';
    const optC = cCol !== -1 ? sanitizeCellText(row[cCol]) : '';
    const optD = dCol !== -1 ? sanitizeCellText(row[dCol]) : '';

    if (!optA || !optB) continue;

    const options = [optA, optB, optC || 'N/A', optD || 'N/A'];

    const correctRaw = corCol !== -1 ? sanitizeCellText(row[corCol]) : 'A';
    let correctIndex = 0;
    const upper = correctRaw.toUpperCase();

    if (upper === 'A' || upper === '1' || upper === 'OPTION A') correctIndex = 0;
    else if (upper === 'B' || upper === '2' || upper === 'OPTION B') correctIndex = 1;
    else if (upper === 'C' || upper === '3' || upper === 'OPTION C') correctIndex = 2;
    else if (upper === 'D' || upper === '4' || upper === 'OPTION D') correctIndex = 3;
    else {
      const matchedIdx = options.findIndex(opt => opt.toLowerCase() === correctRaw.toLowerCase());
      if (matchedIdx !== -1) {
        correctIndex = matchedIdx;
      }
    }

    let timeLimit = 20;
    if (timeCol !== -1 && row[timeCol] !== undefined && row[timeCol] !== null) {
      const parsedTime = parseInt(String(row[timeCol]), 10);
      if (!isNaN(parsedTime) && parsedTime >= 5 && parsedTime <= 120) {
        timeLimit = parsedTime;
      }
    }

    const explanation = expCol !== -1 ? sanitizeCellText(row[expCol]) : '';

    questions.push({
      id: uuidv4(),
      questionText,
      options,
      correctOptionIndex: correctIndex,
      timeLimitSeconds: timeLimit,
      pointsPossible: 10,
      explanation
    });
  }

  if (questions.length === 0) {
    throw new Error('Could not find any valid questions in the Excel file. Please use the provided template format.');
  }

  return questions;
}

module.exports = {
  generateTemplateBuffer,
  parseExcelBuffer
};
