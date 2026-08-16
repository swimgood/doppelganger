const STOPWORDS = new Set([
  'the','a','an','and','or','but','so','to','of','in','on','at','for','with',
  'is','are','was','were','be','been','being','it','its','this','that','these',
  'those','i','you','he','she','we','they','my','your','his','her','our','their',
  'me','him','them','us','not','no','yes','just','than','then','there','here',
  'as','if','when','what','who','how','why','which','do','does','did','doing',
  'have','has','had','will','would','can','could','should','from','by','about',
  'into','out','up','down','over','under','again','more','most','some','such',
  'only','own','same','too','very','all','any','both','each','few','because',
  'im','its','dont','youre','thats','ive','were','theyre','amp'
]);

/**
 * Extracts a comparable feature set from an array of raw post objects
 * ({text, created_at, favorite_count, retweet_count}).
 */
export function extractFeatures(posts) {
  const wordFreq = {};
  const hashtagFreq = {};
  let totalEngagement = 0;
  const hours = [];
  const timestamps = [];

  for (const p of posts) {
    const text = (p.text || '').toLowerCase();

    // hashtags
    const tags = text.match(/#\w+/g) || [];
    for (const tag of tags) {
      hashtagFreq[tag] = (hashtagFreq[tag] || 0) + 1;
    }

    // words: strip urls, mentions, hashtags, punctuation
    const cleaned = text
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/@\w+/g, ' ')
      .replace(/#\w+/g, ' ')
      .replace(/[^a-z0-9'\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
    for (const w of words) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }

    totalEngagement += (Number(p.favorite_count) || 0) + (Number(p.retweet_count) || 0);

    if (p.created_at) {
      const d = new Date(p.created_at);
      if (!isNaN(d.getTime())) {
        hours.push(d.getUTCHours());
        timestamps.push(d.getTime());
      }
    }
  }

  // posts/day estimate from the spread of fetched timestamps
  let postsPerDay = 1.5; // sane default if timestamps are missing
  if (timestamps.length >= 2) {
    const span = Math.max(...timestamps) - Math.min(...timestamps);
    const days = Math.max(span / 86400000, 0.5);
    postsPerDay = +(posts.length / days).toFixed(2);
    postsPerDay = Math.min(postsPerDay, 50); // guard against single-burst spam skew
  }

  // peak hour (mode of UTC hours seen)
  let peakHour = null;
  if (hours.length) {
    const counts = {};
    hours.forEach(h => counts[h] = (counts[h] || 0) + 1);
    peakHour = +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  const avgEngagement = posts.length ? +(totalEngagement / posts.length).toFixed(2) : 0;

  // trim word frequency map to top 40 to keep candidate files small
  const topWords = Object.fromEntries(
    Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 40)
  );
  const topHashtags = Object.entries(hashtagFreq).sort((a, b) => b[1] - a[1]).map(([t]) => t);

  return {
    wordFreq: topWords,
    hashtags: topHashtags,
    postsPerDay,
    peakHour, // 0-23 UTC, or null
    avgEngagement,
    sampleSize: posts.length,
  };
}

export function peakHourLabel(hour) {
  if (hour === null || hour === undefined) return 'no clear pattern';
  const bands = [
    [0, 5, 'the deep-night hours (12am\u20135am UTC)'],
    [5, 9, 'early morning (5am\u20139am UTC)'],
    [9, 12, 'mid-morning (9am\u2013noon UTC)'],
    [12, 15, 'early afternoon (noon\u20133pm UTC)'],
    [15, 18, 'late afternoon (3pm\u20136pm UTC)'],
    [18, 22, 'evening (6pm\u201310pm UTC)'],
    [22, 24, 'late night (10pm\u2013midnight UTC)'],
  ];
  for (const [start, end, label] of bands) {
    if (hour >= start && hour < end) return label;
  }
  return 'no clear pattern';
}

export function engagementLabel(avg) {
  if (avg <= 0) return 'engagement too low to read';
  if (avg < 3) return 'quiet — posts mostly pass by unnoticed';
  if (avg < 15) return 'modest, steady engagement';
  if (avg < 80) return 'solid engagement — people actually reply';
  if (avg < 400) return 'reliably gets noticed';
  return 'high engagement — a post from this account travels';
}
