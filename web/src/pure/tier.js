export const TIER_ORDER = ['low', 'medium', 'high'];

// The frame time that one frame in ten is slower than.
export function p90(times) {
  if (!times.length) return 0;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
}

// Start at the best look and only step down when frames stay slow: the first seconds (shader warm-up) and a single
// hitch don't count. A stretch is judged by its slow frames (the 90th percentile), not its average: a machine that
// averages 60 fps but drops one frame in ten to 30 fps stutters visibly. The frame interval is capped by the screen's
// refresh rate, so it can never prove there is room to step back up.
export function tierStep(current, times, now, slowRuns) {
  const i = TIER_ORDER.indexOf(current);
  const runs = now > 6000 && p90(times) > 20 ? slowRuns + 1 : 0;
  if (runs >= 2 && i > 0) return { tier: TIER_ORDER[i - 1], slowRuns: 0 };
  return { tier: current, slowRuns: runs };
}

export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
