/**
 * Free, unofficial fetch of a user's recent public posts via X's syndication
 * CDN — the same internal endpoint X's own "embed timeline" widget calls.
 *
 * IMPORTANT: this is NOT a supported public API. X's own developer forum
 * states it can change format, arguments, or disappear entirely with no
 * notice, and it's known to fail intermittently (empty bodies, occasional
 * blocks) even when nothing is wrong on your end. Every caller of this
 * module MUST handle a null/empty return gracefully — see api/scan.js for
 * the fallback path. Do not assume this will always work.
 *
 * If X locks this down, the only real replacement is the official paid
 * X API (see README.md "Upgrading to the official API").
 */

const BASE = 'https://cdn.syndication.twimg.com/timeline/profile';

/**
 * @param {string} handle - without the @
 * @param {number} limit - how many posts to request (best-effort; the CDN
 *   does not reliably honor large values)
 * @returns {Promise<Array<{text:string, created_at:string, favorite_count:number, retweet_count:number}>|null>}
 *   null means "could not get real data" — caller should fall back.
 */
export async function fetchRecentPosts(handle, limit = 40) {
  const clean = String(handle || '').replace(/^@/, '').trim();
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(clean)) return null;

  const url = `${BASE}?screen_name=${encodeURIComponent(clean)}&lang=en&with_replies=false&tweet_limit=${limit}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        // A normal browser-like UA reduces (does not eliminate) the chance
        // of an edge block. This is not a bypass of any auth — the endpoint
        // has none — just a plain header.
        'User-Agent': 'Mozilla/5.0 (compatible; DoppelgangerBot/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });
  } catch (err) {
    return null; // network/timeout — fall back silently
  }

  if (!res.ok) return null;

  let json;
  try {
    json = await res.json();
  } catch (err) {
    return null; // empty body is a known failure mode of this endpoint
  }

  const entries = json?.timeline?.entries || json?.entries || [];
  const tweetMap = json?.globalObjects?.tweets || json?.tweets || null;

  const posts = [];

  // Newer response shape: entries reference tweet objects in a map.
  if (tweetMap) {
    for (const key of Object.keys(tweetMap)) {
      const t = tweetMap[key];
      if (!t?.full_text && !t?.text) continue;
      posts.push({
        text: t.full_text || t.text || '',
        created_at: t.created_at || null,
        favorite_count: Number(t.favorite_count) || 0,
        retweet_count: Number(t.retweet_count) || 0,
      });
    }
  }

  // Older/simpler response shape: array of tweet-like objects directly.
  if (posts.length === 0 && Array.isArray(json)) {
    for (const t of json) {
      if (!t?.text) continue;
      posts.push({
        text: t.text,
        created_at: t.created_at || null,
        favorite_count: Number(t.favorite_count) || 0,
        retweet_count: Number(t.retweet_count) || 0,
      });
    }
  }

  if (posts.length === 0) return null;
  return posts;
}
