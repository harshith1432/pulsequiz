const assert = require('assert');

function parseMcqText(text) {
  const startTime = Date.now();

  // Normalize line endings and filter empty lines
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Detect and parse any Answer Key block at the end of document
  const answerKeyMap = new Map(); // questionNumber (int) -> optionIndex (0-3)
  const ansKeyBlockRegex = /(?:Answer\s*Key|Answers?|Solutions?)\s*[\:\n]/i;
  const fullText = text;
  const ansKeyPos = fullText.search(ansKeyBlockRegex);
  
  if (ansKeyPos !== -1) {
    const keySection = fullText.substring(ansKeyPos);
    // Find patterns like "1. A", "1 - B", "1(C)", "Q1: D", "1: A"
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
  const qStartRegex = /^(?:Question\s*|Q\.?\s*|\(?#?\s*)(\d{1,4})[\.\:\)\-\s]\s*(.*)$/i;
  const genericQStartRegex = /^(\d{1,3})[\.\)\:\-]\s+(.*)$/;
  const inlineAnsRegex = /(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\:\s\.\-]+[\(\[]?([A-D1-4])[\)\]]?/i;
  const singleOptRegex = /^(?:[\(\[]?([A-D1-4])[\)\]\.\:\-]\s*|([A-D])\s*[\.\:\-]\s*)(.*)$/i;
  
  // Regex to split horizontal options: e.g. "(A) ... (B) ... (C) ... (D) ..."
  // or "A. ... B. ... C. ... D. ..."
  const horizontalOptRegex = /(?:^|\s{2,}|\t)(?:[\(\[]?([A-D1-4])[\)\]\.\:\-]\s*)([^\(\[A-D1-4]+?)(?=(?:\s{2,}|\t)[\(\[]?[A-D1-4][\)\]\.\:\-]|$)/gi;

  function finalizeCurrent() {
    if (currentQ && currentQ.questionText && currentQ.options.length >= 2) {
      // Check answer key map if answer wasn't inline
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

    // Check for start of Answer Key block - stop parsing questions if found
    if (/^(?:Answer\s*Key|Answers?\s*Section)\s*[\:\-]?$/i.test(line)) {
      finalizeCurrent();
      currentQ = null;
      break;
    }

    // A. If within an active question, check for ANSWER line first
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
      const letterOptRegex = /^(?:[\(\[]?([A-Da-d])[\)\]\.\:\-]\s*|([A-Da-d])[\.\:\-]\s*)(.*)$/;
      const numberOptRegex = /^(?:[\(\[]([1-4])[\)\]\.\:\-]|([1-4])\))\s*(.*)$/;

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

  const elapsedMs = Date.now() - startTime;
  return { questions, elapsedMs };
}

// Sample test with 5 questions in different formats
const sampleExamDoc = `
1. What is the speed of light in a vacuum?
(A) 300,000 km/s   (B) 150,000 km/s   (C) 1,000,000 km/s   (D) 3,000 km/s
Answer: A

2. Which planet is known as the Red Planet?
A. Venus
B. Mars
C. Jupiter
D. Saturn
Ans: B

Q3. What is the capital of Australia?
(1) Sydney
(2) Melbourne
(3) Canberra
(4) Brisbane
Correct Option: 3

4. Which gas do plants primarily absorb during photosynthesis?
A) Oxygen    B) Carbon Dioxide    C) Nitrogen    D) Hydrogen
Answer Key: B

Question 5: What is the powerhouse of the cell?
(A) Nucleus
(B) Ribosome
(C) Mitochondria
(D) Golgi Apparatus
Ans: C
`;

const res = parseMcqText(sampleExamDoc);
console.log(`Extracted ${res.questions.length} questions in ${res.elapsedMs}ms!`);
res.questions.forEach((q, i) => {
  console.log(`Q${i+1}: ${q.questionText}`);
  console.log(`   Options: [${q.options.join(' | ')}]`);
  console.log(`   Correct: Option ${['A','B','C','D'][q.correctOptionIndex]} (${q.options[q.correctOptionIndex]})`);
});

assert.strictEqual(res.questions.length, 5);
assert.strictEqual(res.questions[0].correctOptionIndex, 0); // A
assert.strictEqual(res.questions[1].correctOptionIndex, 1); // B
assert.strictEqual(res.questions[2].correctOptionIndex, 2); // C
assert.strictEqual(res.questions[3].correctOptionIndex, 1); // B
assert.strictEqual(res.questions[4].correctOptionIndex, 2); // C
console.log('✅ ALL TEST ASSERTIONS PASSED!');
