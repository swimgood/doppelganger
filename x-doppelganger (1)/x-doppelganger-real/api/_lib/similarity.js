function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function logDist(a, b) {
  // normalized 0..1 distance on a log scale, forgiving of large raw gaps
  const d = Math.abs(Math.log((a || 0) + 1) - Math.log((b || 0) + 1));
  return Math.min(d / 4, 1);
}

function hourDist(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return 0.5;
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff) / 12;
}

/**
 * Scores every candidate against the scanned user's features and returns
 * the best match plus a 0-100 display percentage.
 */
export function findBestMatch(userFeatures, candidates) {
  let best = null;
  let bestScore = -1;

  for (const c of candidates) {
    const wordSim = cosineSim(userFeatures.wordFreq, c.wordFreq || {});
    const freqD = logDist(userFeatures.postsPerDay, c.postsPerDay);
    const hourD = hourDist(userFeatures.peakHour, c.peakHour);
    const engD = logDist(userFeatures.avgEngagement, c.avgEngagement);

    // weighted combination; word overlap dominates since it's the richest signal
    const score = 0.55 * wordSim + 0.20 * (1 - freqD) + 0.10 * (1 - hourD) + 0.15 * (1 - engD);

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best) return null;

  // map raw score (roughly 0-1, rarely near either extreme) into a fun,
  // readable percentage band so results don't read as "12% similar"
  const percent = Math.round(58 + Math.max(0, Math.min(1, bestScore)) * 40);

  return { candidate: best, percent, rawScore: bestScore };
}
