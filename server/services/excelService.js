const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

/**
 * Generates a styled Excel template workbook as a Buffer.
 */
function generateTemplateBuffer() {
  const wb = XLSX.utils.book_new();

  // Header and sample questions
  const sampleData = [
    {
      'Question': 'Which planet is known as the Red Planet?',
      'Option A': 'Venus',
      'Option B': 'Mars',
      'Option C': 'Jupiter',
      'Option D': 'Saturn',
      'Correct Option': 'B',
      'Time Limit (seconds)': 20,
      'Explanation': 'Mars appears red because of iron oxide (rust) on its surface.'
    },
    {
      'Question': 'What is the speed of light in vacuum approximately?',
      'Option A': '300,000 km/s',
      'Option B': '150,000 km/s',
      'Option C': '1,000,000 km/s',
      'Option D': '3,000 km/s',
      'Correct Option': 'A',
      'Time Limit (seconds)': 20,
      'Explanation': 'Light travels at approximately 299,792 kilometers per second in a vacuum.'
    },
    {
      'Question': 'Which programming language is known as the backbone of modern web browsers?',
      'Option A': 'Python',
      'Option B': 'Java',
      'Option C': 'JavaScript',
      'Option D': 'C++',
      'Correct Option': 'C',
      'Time Limit (seconds)': 15,
      'Explanation': 'JavaScript executes natively inside modern web engines alongside HTML and CSS.'
    },
    {
      'Question': 'What is the capital city of Australia?',
      'Option A': 'Sydney',
      'Option B': 'Melbourne',
      'Option C': 'Canberra',
      'Option D': 'Brisbane',
      'Correct Option': 'C',
      'Time Limit (seconds)': 20,
      'Explanation': 'Canberra was chosen as the compromise capital between Sydney and Melbourne in 1908.'
    },
    {
      'Question': 'Which element has the chemical symbol "Au"?',
      'Option A': 'Silver',
      'Option B': 'Argon',
      'Option C': 'Gold',
      'Option D': 'Aluminum',
      'Correct Option': 'C',
      'Time Limit (seconds)': 15,
      'Explanation': 'Au comes from the Latin word for gold, "aurum", meaning shining dawn.'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Question',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Option',
      'Time Limit (seconds)',
      'Explanation'
    ]
  });

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 45 }, // Question
    { wch: 22 }, // Option A
    { wch: 22 }, // Option B
    { wch: 22 }, // Option C
    { wch: 22 }, // Option D
    { wch: 18 }, // Correct Option
    { wch: 22 }, // Time Limit
    { wch: 45 }  // Explanation
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  // Also include an Instructions sheet
  const instructionData = [
    { 'Rule': 'Question Column', 'Guideline': 'Enter the full question prompt clearly.' },
    { 'Rule': 'Options A, B, C, D', 'Guideline': 'Fill all 4 options for each question.' },
    { 'Rule': 'Correct Option', 'Guideline': 'Enter either A, B, C, or D (or 1, 2, 3, 4, or exact option text).' },
    { 'Rule': 'Time Limit', 'Guideline': 'Enter duration in seconds (recommended 15, 20, or 30). Default is 20.' },
    { 'Rule': 'Explanation (Optional)', 'Guideline': 'Shown to participants after the answer is revealed.' }
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructionData);
  wsInstructions['!cols'] = [{ wch: 25 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Parses an uploaded Excel buffer into an array of validated questions.
 */
function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded Excel sheet contains no readable rows.');
  }

  const questions = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Find question text
    const questionText = (
      row['Question'] ||
      row['question'] ||
      row['Question Text'] ||
      row['Prompt'] ||
      row['QUESTION'] ||
      ''
    ).toString().trim();

    if (!questionText) {
      continue; // skip empty rows
    }

    // Find options
    const optA = (row['Option A'] || row['option a'] || row['A'] || row['Option 1'] || '').toString().trim();
    const optB = (row['Option B'] || row['option b'] || row['B'] || row['Option 2'] || '').toString().trim();
    const optC = (row['Option C'] || row['option c'] || row['C'] || row['Option 3'] || '').toString().trim();
    const optD = (row['Option D'] || row['option d'] || row['D'] || row['Option 4'] || '').toString().trim();

    if (!optA || !optB) {
      // Must have at least options A and B
      continue;
    }

    const options = [
      optA,
      optB,
      optC || 'N/A',
      optD || 'N/A'
    ];

    // Correct Option resolution
    const correctRaw = (
      row['Correct Option'] ||
      row['Correct Answer'] ||
      row['Correct'] ||
      row['Answer'] ||
      row['correct'] ||
      row['answer'] ||
      'A'
    ).toString().trim();

    let correctIndex = 0;
    const upper = correctRaw.toUpperCase();

    if (upper === 'A' || upper === '1' || upper === 'OPTION A') correctIndex = 0;
    else if (upper === 'B' || upper === '2' || upper === 'OPTION B') correctIndex = 1;
    else if (upper === 'C' || upper === '3' || upper === 'OPTION C') correctIndex = 2;
    else if (upper === 'D' || upper === '4' || upper === 'OPTION D') correctIndex = 3;
    else {
      // Check if correctRaw matches one of the option texts exactly
      const matchedIdx = options.findIndex(opt => opt.toLowerCase() === correctRaw.toLowerCase());
      if (matchedIdx !== -1) {
        correctIndex = matchedIdx;
      }
    }

    // Time limit
    let timeLimit = parseInt(
      row['Time Limit (seconds)'] ||
      row['Time Limit'] ||
      row['Timer'] ||
      row['Time'] ||
      20,
      10
    );
    if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 120) {
      timeLimit = 20;
    }

    const explanation = (row['Explanation'] || row['explanation'] || '').toString().trim();

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
