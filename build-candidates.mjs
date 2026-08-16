/**
 * Run locally (not on Vercel) to refresh data/candidates.json from real,
 * public post data for the handles listed in scripts/handles.txt.
 *
 * Usage:
 *   node scripts/build-candidates.mjs
 *
 * This uses the same free, unofficial syndication endpoint as api/scan.js.
 * Since it's undocumented, some handles may fail intermittently — the
 * script skips failures and keeps going, and re-running it later will
 * usually pick up any accounts that failed the first time.
 *
 * Be a reasonable neighbor: this runs handles sequentially with a delay
 * between requests rather than firing them all at once.
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

import { fetchRecentPosts } from '../api/_lib/syndication.js';
import { extractFeatures } from '../api/_lib/textStats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLES_FILE = path.join(__dirname, 'handles.txt');
const OUT_FILE = path.join(__dirname, '../data/candidates.json');
const DELAY_MS = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const raw = readFileSync(HANDLES_FILE, 'utf-8');
  const handles = raw
    .split('\n')
    .map(l => l.trim().replace(/^@/, ''))
    .filter(l => l && !l.startsWith('#'));

  if (handles.length === 0) {
    console.log('No handles found in scripts/handles.txt — add some, one per line.');
    return;
  }

  const results = [];
  for (const handle of handles) {
    process.stdout.write(`Fetching @${handle}... `);
    const posts = await fetchRecentPosts(handle);
    if (!posts || posts.length < 3) {
      console.log('skipped (no data / fetch failed)');
      await sleep(DELAY_MS);
      continue;
    }
    const features = extractFeatures(posts);
    results.push({ handle, ...features });
    console.log(`ok (${posts.length} posts)`);
    await sleep(DELAY_MS);
  }

  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length}/${handles.length} candidates to data/candidates.json`);
  if (results.length < handles.length) {
    console.log('Some handles failed — re-run this script later to retry them.');
  }
}

main();
