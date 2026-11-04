export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// mulberry32: tiny and fast, and the same seed always gives the same record.
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    jitter: amt => (next() * 2 - 1) * amt,
    weighted(pairs) {
      let sum = 0;
      for (const [, w] of pairs) sum += w;
      let x = next() * sum;
      for (const [v, w] of pairs) { x -= w; if (x <= 0) return v; }
      return pairs[pairs.length - 1][0];
    },
  };
}
