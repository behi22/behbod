export const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

export const TIERS = {
  low: { ratio: 1, post: false, bloom: false },
  medium: { ratio: 1.25, post: true, bloom: true },
  high: { ratio: 1.5, post: true, bloom: true, smaa: true, grain: true },
  // The screen's full sharpness, up to 2x. The first step down when frames stutter is to `high`, which keeps every effect.
  ultra: { ratio: 2, post: true, bloom: true, smaa: true, grain: true },
};

// A rebuilt effects chain recompiles every effect's shader, a long freeze, so it is only rebuilt when an effect comes or goes.
const EFFECTS = ['post', 'bloom', 'smaa', 'grain'];
export function switchWork(from, to) {
  const a = TIERS[from], b = TIERS[to];
  if (!a || !b) return { post: true, ratio: true };
  return { post: EFFECTS.some(k => !!a[k] !== !!b[k]), ratio: a.ratio !== b.ratio };
}

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

// The quality looks after itself and its only control is on the computer (Settings). The first time it steps down by
// itself, the visitor is told once what happened and where the control is; `seen` is whether they were told before.
export const QUALITY_NOTE = "Lowered the quality to keep things smooth. You can change it in the computer's Settings.";
export function qualityNote(from, to, seen) {
  return !seen && TIER_ORDER.indexOf(to) >= 0 && TIER_ORDER.indexOf(to) < TIER_ORDER.indexOf(from) ? QUALITY_NOTE : null;
}
// The note is only spent once it can be read: a slow machine steps down in its first seconds, while the welcome
// screen still covers the page, so a note due then waits for `opened()`. `seen` and `remember` read and write whether
// this visitor was ever told; `show` puts the words on the page.
export function makeQualityNotice({ seen, remember, show }) {
  let open = false, due = false, told = false, was = null;
  const tell = () => { told = true; due = false; remember(); show(QUALITY_NOTE); };
  return {
    stepped(from, to) {
      if (told) return;
      // A note still waiting is dropped if the quality climbs back to where it was: it would no longer be true.
      if (due && TIER_ORDER.indexOf(to) >= TIER_ORDER.indexOf(was)) { due = false; was = null; return; }
      if (!qualityNote(from, to, seen())) return;
      if (open) tell(); else if (!due) { due = true; was = from; }
    },
    opened() { open = true; if (due && !told) tell(); },
  };
}

export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
