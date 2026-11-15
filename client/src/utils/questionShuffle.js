/**
 * Shuffles option order for questions and guarantees that consecutive questions
 * do not have the same correct answer index (A, B, C, D).
 * Also balances the frequency of correct answer positions evenly across the quiz.
 */
export function shuffleAndDistributeOptions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const slotUsageCounts = [0, 0, 0, 0]; // count for A(0), B(1), C(2), D(3)
  let previousSlot = -1;

  return questions.map((q) => {
    const rawOptions = Array.isArray(q.options) && q.options.length >= 2
      ? [...q.options]
      : ['Option A', 'Option B', 'Option C', 'Option D'];

    // Ensure exactly 4 options
    while (rawOptions.length < 4) {
      rawOptions.push(`Option ${String.fromCharCode(65 + rawOptions.length)}`);
    }
    const currentCorrectIdx = Math.max(0, Math.min(rawOptions.length - 1, q.correctOptionIndex || 0));
    const correctText = rawOptions[currentCorrectIdx];

    // Distractors are all other options
    const distractors = rawOptions.filter((_, i) => i !== currentCorrectIdx);

    // Shuffle the 3 distractors
    for (let i = distractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
    }

    // Determine target slot for the correct answer
    // Must NOT be equal to previousSlot
    const allowedSlots = [0, 1, 2, 3].filter(s => s !== previousSlot);

    // Balance usage across A, B, C, D by choosing among allowed slots with lowest usage count
    let minUsage = Infinity;
    for (const slot of allowedSlots) {
      if (slotUsageCounts[slot] < minUsage) {
        minUsage = slotUsageCounts[slot];
      }
    }
    const leastUsedAllowedSlots = allowedSlots.filter(s => slotUsageCounts[s] === minUsage);

    // Pick one randomly among the least used allowed slots
    const targetSlot = leastUsedAllowedSlots[Math.floor(Math.random() * leastUsedAllowedSlots.length)];

    // Place correctText at targetSlot and fill other 3 slots with shuffled distractors
    const newOptions = [];
    let distractorIdx = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (slot === targetSlot) {
        newOptions.push(correctText);
      } else {
        newOptions.push(distractors[distractorIdx++]);
      }
    }

    slotUsageCounts[targetSlot]++;
    previousSlot = targetSlot;

    return {
      ...q,
      options: newOptions,
      correctOptionIndex: targetSlot
    };
  });
}

/**
 * Randomly picks N questions from a question pool without replacement,
 * then shuffles options so no consecutive question has the same correct answer index.
 */
export function sampleRandomQuestions(pool, count) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const n = Math.max(1, Math.min(pool.length, parseInt(count, 10) || pool.length));
  
  // Fisher-Yates shuffle copy
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selected = shuffled.slice(0, n);
  return shuffleAndDistributeOptions(selected);
}

/**
 * Picks N questions from the pool that have NOT been asked in previous rounds.
 * When all questions in the pool have been used or not enough remain,
 * it cycles back gracefully.
 * Guarantees serial non-repeating option distribution (A, B, C, D).
 */
export function pickUnusedQuestions(pool, usedQuestionIds = [], count = 20) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return {
      selectedQuestions: [],
      updatedUsedIds: Array.isArray(usedQuestionIds) ? usedQuestionIds : [],
      usedCount: 0,
      remainingCount: 0,
      totalPoolCount: 0,
      cycled: false
    };
  }

  const sampleCount = Math.max(1, parseInt(count, 10) || 20);
  const usedSet = new Set((usedQuestionIds || []).map(String));

  // Find unused questions in pool
  let unused = pool.filter(q => {
    const key = String(q.id || q.questionText);
    return !usedSet.has(key);
  });

  let cycled = false;

  // If not enough unused questions remain, cycle or refill
  if (unused.length < sampleCount) {
    cycled = true;
    if (unused.length === 0) {
      // All questions have been used! Clear used history and pick from full pool
      usedSet.clear();
      unused = [...pool];
    } else {
      // Pick all remaining unused, plus sample the rest from previously used
      const need = sampleCount - unused.length;
      const alreadyUsed = pool.filter(q => {
        const key = String(q.id || q.questionText);
        return usedSet.has(key);
      });
      // Shuffle alreadyUsed
      for (let i = alreadyUsed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [alreadyUsed[i], alreadyUsed[j]] = [alreadyUsed[j], alreadyUsed[i]];
      }
      unused.push(...alreadyUsed.slice(0, need));
    }
  }

  // Shuffle candidate pool
  const candidatePool = [...unused];
  for (let i = candidatePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
  }

  const selected = candidatePool.slice(0, sampleCount);

  // Mark newly selected questions as used
  const updatedUsedIds = [...usedSet];
  for (const q of selected) {
    const key = String(q.id || q.questionText);
    if (!usedSet.has(key)) {
      usedSet.add(key);
      updatedUsedIds.push(key);
    }
  }

  const remainingCount = Math.max(0, pool.length - updatedUsedIds.length);
  const selectedWithMixedOptions = shuffleAndDistributeOptions(selected);

  return {
    selectedQuestions: selectedWithMixedOptions,
    updatedUsedIds,
    usedCount: updatedUsedIds.length,
    remainingCount,
    totalPoolCount: pool.length,
    cycled
  };
}
