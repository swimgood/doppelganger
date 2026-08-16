import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

import { fetchRecentPosts } from './_lib/syndication.js';
import { extractFeatures, peakHourLabel, engagementLabel } from './_lib/textStats.js';
import { findBestMatch } from './_lib/similarity.js';
import { generateFallback } from './_lib/fallback.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCandidates() {
  try {
    const raw = readFileSync(path.join(__dirname, '../data/candidates.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function cleanHandle(raw) {
  return String(raw || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15);
}

// deterministic-ish pick for flavor-only fields, seeded so repeated scans
// of the same pair feel consistent rather than jittering on every request
function seededPick(seedStr, arr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  const idx = (h >>> 0) % arr.length;
  return arr[idx];
}

const RELATIONSHIPS = [
  "You have never interacted. You probably should.",
  "You follow each other but have never spoken. Suspicious.",
  "One of you liked the other's post once. That's the whole file.",
  "Total strangers, algorithmically fated. For now.",
  "You've been in the same replies twice and never noticed.",
  "Mutuals. Somehow have still never said a word to each other.",
];
const MATCH_WORDS = ['\u2194', '\u2248', '=='];

export default async function handler(req, res) {
  const handle = cleanHandle(req.query?.handle || req.query?.h);
  const nonce = parseInt(req.query?.n, 10) || 0;

  if (!handle) {
    res.status(400).json({ error: 'missing or invalid handle' });
    return;
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const posts = await fetchRecentPosts(handle);

  if (!posts || posts.length < 3) {
    // live fetch failed or returned too little to say anything meaningful —
    // fall back rather than error out
    res.status(200).json(generateFallback(handle, nonce));
    return;
  }

  const features = extractFeatures(posts);
  const candidates = loadCandidates();

  if (candidates.length === 0) {
    // no candidate pool built yet — see scripts/build-candidates.mjs
    res.status(200).json(generateFallback(handle, nonce));
    return;
  }

  const match = findBestMatch(features, candidates);
  if (!match) {
    res.status(200).json(generateFallback(handle, nonce));
    return;
  }

  const topWordEntries = Object.entries(features.wordFreq).sort((a, b) => b[1] - a[1]);
  const words = (features.hashtags.length ? features.hashtags : topWordEntries.map(([w]) => w)).slice(0, 2);
  const topics = topWordEntries.slice(2, 4).map(([w]) => w);

  const seed = `${handle}::${match.candidate.handle}`;

  res.status(200).json({
    real: true,
    handle,
    twin: match.candidate.handle,
    percent: match.percent,
    topics: topics.length ? topics : ['a little of everything'],
    words: words.length ? words : ['(not enough recent posts to tell)'],
    time: peakHourLabel(features.peakHour),
    engagement: engagementLabel(features.avgEngagement),
    relationship: seededPick(seed, RELATIONSHIPS),
    matchWord: seededPick(seed, MATCH_WORDS),
    followersBand: `based on ${features.sampleSize} recent posts`,
    freq: features.postsPerDay.toFixed(1),
  });
}
