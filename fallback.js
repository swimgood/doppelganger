// Same deterministic-from-handle approach as the original prototype.
// Used only when a real scan isn't possible, so the site never just breaks.

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(rng, arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

const TWIN_A = ["void","echo","static","cipher","kestrel","marrow","nectar","orbit","glitch","ember","tundra","ferrous","lumen","gravel","paper","salt","brine","quartz","dusk","hollow","mono","feral","amber","north","low"];
const TWIN_B = ["fox","signal","habits","theory","engine","garden","archive","protocol","radio","season","paradox","index","current","circuit","harbor","almanac","static","system","bureau","transit","field","ledger","weather","drift"];
const TOPICS = ["unsolicited hot takes","late-night doomscrolling recaps","niche fandom lore","screenshot recycling","reply-guy discourse","main character energy","tech industry takes","sports discourse","local news outrage","overexplaining jokes","quote-tweeting for the dunk","group chat leaks","one very specific hobby","weather complaints as bits","conspiracy-adjacent shower thoughts","unhinged 3am threads","business account cosplay","recipe threads nobody asked for","astrology as fact","personal brand building"];
const WORDS = ["literally","ngl","no because","the fact that","ok but","respectfully","unpopular opinion","hot take","delete this","not me","it's giving","the way","say it louder","this you?","case closed","couldn't be me"];
const TIMES = ["3:14am sharp","during work hours, unbothered","the group chat hours (11pm\u20131am)","the exact minute discourse starts","6am doomscroll before coffee","whenever there's a live event on"];
const ENGAGEMENT = ["ratio-prone","reply-guy heavy","quote-tweets more than posts","likes everything, posts rarely","screenshot bait specialist","subtweets, never names names","dead-on arrival, revived by one banger"];
const RELATIONSHIPS = [
  "You have never interacted. You probably should.",
  "You follow each other but have never spoken. Suspicious.",
  "One of you liked the other's post once, in 2022. That's the whole file.",
  "Total strangers, algorithmically fated. For now.",
  "You've been in the same replies twice and never noticed.",
  "Mutuals. Somehow have still never said a word to each other.",
];
const MATCH_WORDS = ["\u2194", "\u2248", "=="];

export function generateFallback(handle, nonce = 0) {
  const rng = mulberry32(hashStr(handle.toLowerCase() + '::' + nonce));

  const twin = pick(rng, TWIN_A) + '_' + pick(rng, TWIN_B) + (rng() > 0.5 ? Math.floor(rng() * 90 + 10) : '');
  const percent = 70 + Math.floor(rng() * 29);

  return {
    real: false,
    handle,
    twin,
    percent,
    topics: pickN(rng, TOPICS, 2),
    words: pickN(rng, WORDS, 2),
    time: pick(rng, TIMES),
    engagement: pick(rng, ENGAGEMENT),
    relationship: pick(rng, RELATIONSHIPS),
    matchWord: pick(rng, MATCH_WORDS),
    followersBand: pick(rng, ["a few hundred","the low thousands","that awkward 2\u20135K zone","a suspiciously round number","just enough to feel a little famous"]),
    freq: (2 + rng() * 9).toFixed(1),
  };
}
