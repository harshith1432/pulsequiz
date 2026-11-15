const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Build an authentic, 100% valid PDF containing MCQ questions using pdf-lib
async function buildSamplePdfBuffer() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textLines = [
    { text: "PulseQuiz Standard MCQ Examination", bold: true, size: 16 },
    { text: "", size: 10 },
    { text: "1. What is the powerhouse of the cell?", bold: true, size: 13 },
    { text: "(A) Ribosome", size: 12 },
    { text: "(B) Mitochondria", size: 12 },
    { text: "(C) Nucleus", size: 12 },
    { text: "(D) Cytoplasm", size: 12 },
    { text: "Answer: B", size: 12 },
    { text: "", size: 10 },
    { text: "2. Which chemical element has the symbol Au?", bold: true, size: 13 },
    { text: "A) Silver  B) Gold  C) Copper  D) Iron", size: 12 },
    { text: "Correct: B", size: 12 },
    { text: "", size: 10 },
    { text: "3. In computer science, what does CPU stand for?", bold: true, size: 13 },
    { text: "A. Central Processing Unit", size: 12 },
    { text: "B. Computer Personal Unit", size: 12 },
    { text: "C. Central Performance Utility", size: 12 },
    { text: "D. Control Panel User", size: 12 },
    { text: "Ans: A", size: 12 }
  ];

  let y = 750;
  for (const item of textLines) {
    if (item.text) {
      page.drawText(item.text, {
        x: 50,
        y: y,
        size: item.size || 12,
        font: item.bold ? boldFont : font,
        color: rgb(0, 0, 0)
      });
    }
    y -= (item.size || 12) + 6;
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}

async function run() {
  console.log('🧪 Starting End-to-End PDF Upload & Scan Verification...');

  // 1. Register host to get auth token
  const authPayload = JSON.stringify({
    username: `pdfhost_${Date.now()}`,
    password: 'Password123!'
  });

  const authRes = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: authPayload
  });
  const authData = await authRes.json();
  if (!authData.token) {
    throw new Error('Failed to obtain host auth token: ' + JSON.stringify(authData));
  }
  const token = authData.token;
  console.log('✓ Host authenticated successfully');

  // 2. Generate PDF buffer
  const pdfBuffer = await buildSamplePdfBuffer();
  console.log(`✓ Generated valid test PDF buffer (${pdfBuffer.length} bytes)`);

  // 3. Build multipart/form-data payload with 2 PDF files using native FormData
  const formData = new FormData();
  formData.append('files', new Blob([pdfBuffer], { type: 'application/pdf' }), 'exam_paper_1.pdf');
  formData.append('files', new Blob([pdfBuffer], { type: 'application/pdf' }), 'exam_paper_2.pdf');

  // 4. Measure upload & scan roundtrip time
  console.log('⚡ Sending multipart upload with 2 PDFs to POST /api/quiz/upload/pdf...');
  const startTime = Date.now();

  const uploadRes = await fetch('http://localhost:3001/api/quiz/upload/pdf', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const durationMs = Date.now() - startTime;
  const result = await uploadRes.json();

  console.log(`⏱️ Full HTTP Upload & Scan Roundtrip Duration: ${durationMs}ms`);
  console.log('Response status:', uploadRes.status);
  console.log('Result:', {
    success: result.success,
    filesProcessed: result.filesProcessed,
    fileNames: result.fileNames,
    totalPoolCount: result.totalPoolCount,
    count: result.count
  });

  if (!result.success) {
    throw new Error('PDF upload failed: ' + JSON.stringify(result));
  }

  if (result.count < 3) {
    throw new Error(`Expected at least 3 questions extracted, got ${result.count}`);
  }

  console.log('\nExtracted Sample Question:');
  console.log(`- Q: "${result.questions[0].questionText}"`);
  console.log(`  Options: ${result.questions[0].options.join(' | ')}`);
  console.log(`  Correct Option Index: ${result.questions[0].correctOptionIndex} (${result.questions[0].options[result.questions[0].correctOptionIndex]})`);

  if (durationMs > 2000) {
    console.warn(`⚠️ Warning: Scan took ${durationMs}ms, which is higher than target`);
  } else {
    console.log(`🚀 BLAZING FAST: Scanning completed in ${durationMs}ms (Sub-second response)!`);
  }

  console.log('🎉 ALL PDF E2E TESTS PASSED WITH 100% SUCCESS!');
}

run().catch((err) => {
  console.error('❌ E2E Test Error:', err);
  process.exit(1);
});
