# X Doppelgänger

Enter your @handle, get matched against a curated pool of accounts based on
real recent posts — word patterns, posting frequency, peak posting time, and
engagement. Shareable as a postcard-style image or an X post.

## How the "real" part works — and its limits

X's official API has no free tier as of Feb 2026 (pay-per-use, ~$0.015/post
read, ~$0.01/profile read, no minimum). To keep this **$0 to run**, it
instead uses the free, unofficial endpoint X's own "embed timeline" widget
calls internally (`cdn.syndication.twimg.com`).

**Read this before you rely on it:**
- It's **not a supported public API**. X's own developer forum says it can
  change format, arguments, or disappear with no notice.
- It fails intermittently even when nothing's wrong — empty responses,
  occasional edge blocks. This is a known, documented quirk of the endpoint,
  not a bug in this code.
- Because of that, `api/scan.js` **always** falls back to a fun deterministic
  estimate (seeded from the handle, so it's at least consistent) if the live
  fetch fails or returns too little data. The postcard is honestly labeled
  **● LIVE SCAN** or **○ ESTIMATED** so nobody's misled about which one they got.
- Treat this as "works most of the time, and never breaks the page when it
  doesn't" rather than "guaranteed real-time data pipeline."

If X locks this endpoint down entirely, the only real fix is switching to
the official paid API in `api/_lib/syndication.js` (swap the fetch logic;
everything downstream — feature extraction, matching, rendering — stays the
same).

## Architecture

```
/index.html              — frontend (postcard UI, canvas image export, share)
/api/scan.js              — serverless function: scan a handle, match it
/api/_lib/syndication.js  — free unofficial fetch of a user's recent posts
/api/_lib/textStats.js    — turns raw posts into word freq / timing / engagement features
/api/_lib/similarity.js   — cosine similarity + numeric feature distance -> match + %
/api/_lib/fallback.js     — deterministic fun generator, used when live data isn't available
/data/candidates.json     — the pool of accounts people get matched against
/scripts/build-candidates.mjs — refreshes candidates.json from real data
/scripts/handles.txt      — the list of handles in your candidate pool (edit this)
```

Nothing here needs an X API key or any environment variable to run.

## Building your candidate pool

The pool people get matched against is **not** "all of X" — it's whatever
accounts you put in `scripts/handles.txt`. This is a deliberate scope
decision (see the chat where this was designed): there's no "find similar
accounts across all of X" endpoint at any price, so a curated pool is the
only tractable version of "real."

1. Edit `scripts/handles.txt` — one handle per line, no `@`. Aim for 100-300
   with a real mix of posting styles/topics; a pool of near-identical
   accounts makes every match feel the same.
2. Run `npm run build-candidates` (or `node scripts/build-candidates.mjs`).
   This fetches each handle's recent posts via the same free endpoint,
   extracts features, and writes `data/candidates.json`. It runs
   sequentially with a delay between requests — a pool of 200 takes a few
   minutes.
3. Some handles will fail (see caveats above) — the script skips them and
   tells you how many succeeded. Re-run later to retry failures.
4. Commit the updated `data/candidates.json`.

Re-run the build script periodically (weekly/monthly) to keep the pool's
data fresh — it's a static file, so it doesn't update itself.

## Local development

```bash
npm install -g vercel   # if you don't have it
vercel dev
```

This runs both the static frontend and the `/api/scan` function locally.

## Deploying

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project** → import the repo → deploy. No environment
   variables are required for the default (free) setup.
3. Vercel auto-detects `/api/scan.js` as a serverless function — no config
   needed.

## Cost

$0 by default. If you later move to the official X API for reliability,
costs scale with read volume — see the pricing note in `syndication.js` for
where to swap the fetch logic, and budget roughly $0.01–0.03 per scan
(profile + a handful of recent posts) at official rates.

## What's still flavor text, not real data

- **"Your X relationship"** (never interacted / mutuals / etc.) is generated
  flavor, not a real interaction check — verifying that would need
  authenticated access to both accounts' likes/replies, which isn't
  available through the free endpoint. It's presented as the playful bit it
  obviously is, not a factual claim.
- **Topics/words** are real word-frequency output from actual recent posts
  when a live scan succeeds — genuinely theirs, not generated.
