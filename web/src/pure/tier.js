export const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

// The frame time that one frame in ten is slower than.
export function p90(times) {
  if (!times.length) return 0;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
}

// Judged every few seconds on the last stretch of frames. Start at the best look and step down when frames stay slow:
// the first seconds (shader warm-up) and a single hitch don't count, and a stretch is judged by its slow frames (the
// 90th percentile), not its average, since 60 fps with one frame in ten at 30 fps stutters visibly. The frame interval
// is capped by the screen's refresh rate, so it can never prove there is room to step back up; instead, after a run of
// good stretches it tries one step up, and each try waits three times longer than the last, so a machine on the edge
// settles instead of flickering between two looks. It never goes above `top`, where it started.
const FIRST = 4, LONGEST = 144;
export function tierStep(current, times, now, state = {}) {
  const { slowRuns = 0, goodRuns = 0, wait = FIRST, top = current } = state;
  const i = TIER_ORDER.indexOf(current);
  if (now <= 6000) return { tier: current, slowRuns: 0, goodRuns: 0, wait, top };
  if (p90(times) > 20) {
    const runs = slowRuns + 1;
    if (runs >= 2 && i > 0) return { tier: TIER_ORDER[i - 1], slowRuns: 0, goodRuns: 0, wait, top };
    return { tier: current, slowRuns: runs, goodRuns: 0, wait, top };
  }
  const good = goodRuns + 1;
  if (i < TIER_ORDER.indexOf(top) && good >= wait) return { tier: TIER_ORDER[i + 1], slowRuns: 0, goodRuns: 0, wait: Math.min(LONGEST, wait * 3), top };
  return { tier: current, slowRuns: 0, goodRuns: good, wait, top };
}

export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
