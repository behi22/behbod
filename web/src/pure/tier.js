export const TIER_ORDER = ['low', 'medium', 'high'];

// Start at the best look and only step down when frames stay slow: the first seconds (shader warm-up) and a single
// hitch don't count. The frame interval is capped by the screen's refresh rate, so it can never prove there is room
// to step back up.
export function tierStep(current, ms, now, slowRuns) {
  const i = TIER_ORDER.indexOf(current);
  const runs = now > 6000 && ms > 22 ? slowRuns + 1 : 0;
  if (runs >= 2 && i > 0) return { tier: TIER_ORDER[i - 1], slowRuns: 0 };
  return { tier: current, slowRuns: runs };
}

export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
