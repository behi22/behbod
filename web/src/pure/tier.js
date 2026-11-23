export const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

export const TIERS = {
  low: { ratio: 1, post: false, bloom: false },
  medium: { ratio: 1.25, post: true, bloom: true },
  high: { ratio: 1.5, post: true, bloom: true, smaa: true, grain: true },
  // The screen's full sharpness, up to 2x. The first step down when frames stutter is to `high`, which keeps every effect.
  ultra: { ratio: 2, post: true, bloom: true, smaa: true, grain: true },
};

// The pixel ratio a tier draws at on a screen of `dpr` device pixels to each CSS pixel: never sharper than the screen.
export const ratioOf = (name, dpr) => Math.min(dpr, TIERS[name].ratio);

// A tier's set of effects by name: tiers with the same set share one effects chain, so a switch between them
// changes only the sharpness.
const EFFECTS = ['post', 'bloom', 'smaa', 'grain'];
export function effectsOf(name) {
  const t = TIERS[name];
  return t ? EFFECTS.filter(k => t[k]).join('+') || 'none' : null;
}

// The frame time that one frame in ten is slower than, and the one that one frame in ten is quicker than.
export function p90(times) {
  if (!times.length) return 0;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
}
export function p10(times) {
  if (!times.length) return Infinity;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.1)];
}

// The screen's refresh, read from frame intervals taken while the house loads and the page draws next to nothing: the
// busy ones are long, the quick ones are the screen's own. Gaps under 3 ms are no frame of any screen and are left
// out; too few to tell, nothing; never quicker than 240 Hz.
const QUICKEST = 4;
export function refreshFrom(intervals) {
  const frames = (intervals || []).filter(x => x >= 3);
  return frames.length < 20 ? null : Math.max(QUICKEST, p10(frames));
}

// Judged every few seconds on the last stretch of frames. Start at the best look and step down when frames stay slow:
// a single hitch doesn't count, and a stretch is judged by its slow frames (the 90th percentile), not its average,
// since 60 fps with one frame in ten at 30 fps stutters visibly. For six seconds from `from` nothing is judged: the
// page sets it at the first frame and after a mode change, a video, a game or a return to the tab, and a switch sets
// it itself, since each of those spends its first seconds building shaders and pictures. The frame interval is capped
// by the screen's refresh rate, so it can never prove there is room to step back up; instead, after a run of good
// stretches it tries one step up, and each try of a tier waits three times longer than its last. It never goes above
// `top`, where it started. A machine on the edge settles. Each tier keeps its record over the visit (`record`: stretches
// judged on it, and how many were slow); it is shaky while at least one in four was slow, counting six good ones in
// its favour. A shaky tier is left after two slow stretches in a row, a steady one only after five, so a rare slow
// patch does not flip a tier that holds. Every stay on a tier, the first included, is a try of it, and a try fails when
// the tier is left while shaky; after two failed tries a tier is not tried again in this visit (`top` comes down).
// A step down must buy something: a frame cap or a slow screen looks slow on every tier. After a step down (`drop`),
// one of the first two stretches judged must be no longer slow, or clearly faster on average than the one that caused
// it (on a 60 Hz screen frames come in whole refreshes, so a smooth tier may average barely less than a slow one), or
// the next step down is tried (a card too slow for one frame per refresh may show no gain until a lower tier); if none
// down to the floor helps, the tier goes back to where it was and does not step below it (`floor`) until frames are
// clearly worse than they were then (`floorAt`). Frames held at one pace on the tier left and the tier below alike,
// none quicker, one and a half refreshes or more and no slower than the line forgives once judged by that pace, are a
// frame cap (a battery saver's 30 fps): it goes straight back up and judges by the cap's pace (`held`) until quicker
// frames show the cap has lifted. A step down undone, by a cap or because nothing helped, is no failed try of the tier
// left. While a step down is being checked, nothing else is judged.
// The line between smooth and slow is about 50 fps on every screen: frames come in whole refreshes, so a stretch is
// slow when its 90th-percentile frame is over 20 ms plus half a refresh (on 60 Hz over 28 ms, two refreshes; on 144 Hz
// over 23 ms, four). The refresh is learned again all visit long, so a window moved to another screen gets that
// screen's line: it is the middle of the quick frames (each stretch's 10th percentile) of the last few stretches judged
// (`seen`), starting from the one read while loading (`refresh`, or a 60 Hz screen with no reading), so one odd stretch
// moves nothing. Frames alone never make it slower than 60 Hz or the loading read, so a slow machine is never taken for
// a slow screen.
const FIRST = 4, LONGEST = 144, QUIET = 6000, FAILS = 2, CREDIT = 6, RUN = 2, STEADY_RUN = 5, GAIN = 0.9, LOOKS = 2, SEEN = 5;
const mean = t => t.reduce((a, v) => a + v, 0) / (t.length || 1), ASSUMED = 1000 / 60, line = screen => 20 + screen / 2;
const middle = xs => [...xs].sort((a, b) => a - b)[(xs.length - 1) >> 1];
export function tierStep(current, times, now, state = {}) {
  const { slowRuns = 0, goodRuns = 0, waits = {}, top = current, from = 0, record = {}, fails = {}, floor = 'low', floorAt = null, drop = null, refresh = null, seen = [refresh ?? ASSUMED], held = null } = state;
  const i = TIER_ORDER.indexOf(current);
  let lowest = TIER_ORDER.indexOf(floor);
  const base = { ...state, tier: current, slowRuns: 0, goodRuns: 0, waits, top, from, record, fails, floor, drop };
  const next = o => ({ ...base, ...o });
  if (now - from <= QUIET) return next({ goodRuns });
  const quickest = p10(times), pace = middle(times);
  base.seen = [...seen, quickest].slice(-SEEN);
  base.held = held !== null && quickest < held * 0.75 ? null : held;
  const screen = Math.max(QUICKEST, Math.min(Math.max(ASSUMED, refresh ?? 0, base.held ?? 0), middle(base.seen)));
  const slow = p90(times) > line(screen);
  const steady = quickest >= pace * 0.9 && pace >= screen * 1.5 && pace < line(pace);
  if (floorAt !== null && slow && mean(times) * GAIN > floorAt) { lowest = 0; base.floor = 'low'; base.floorAt = null; }
  if (drop) {
    if (slow && mean(times) > drop.mean * GAIN) {
      const look = { ...drop, looks: drop.looks + 1, steady: drop.steady && steady && Math.abs(pace - drop.pace) <= drop.pace * 0.1 };
      if (look.looks < LOOKS) return next({ drop: look });
      const back = TIER_ORDER.indexOf(drop.from), restored = TIER_ORDER.indexOf(top) < back ? drop.from : top;
      const unfailed = drop.failed ? { ...fails, [drop.from]: fails[drop.from] - 1 } : fails;
      if (look.steady) return next({ tier: drop.from, from: now, drop: null, held: pace, top: restored, fails: unfailed });
      if (i - 1 >= lowest) return next({ tier: TIER_ORDER[i - 1], from: now, drop: { ...look, looks: 0 } });
      return next({ tier: drop.from, from: now, drop: null, floor: drop.from, floorAt: drop.mean, top: restored, fails: unfailed });
    }
    base.drop = null;
  }
  const [judged = 0, slowOnes = 0] = record[current] || [];
  const mine = { ...record, [current]: [judged + 1, slowOnes + (slow ? 1 : 0)] };
  const shaky = mine[current][1] * 4 >= mine[current][0] + CREDIT;
  if (slow) {
    const runs = slowRuns + 1;
    if (runs >= (shaky ? RUN : STEADY_RUN) && i > lowest) {
      const failsNow = shaky ? { ...fails, [current]: (fails[current] || 0) + 1 } : fails;
      const capped = failsNow[current] >= FAILS && TIER_ORDER.indexOf(top) > i - 1 ? TIER_ORDER[i - 1] : top;
      return next({ tier: TIER_ORDER[i - 1], from: now, record: mine, fails: failsNow, top: capped, drop: { from: current, mean: mean(times), looks: 0, pace, steady, failed: shaky } });
    }
    return next({ slowRuns: runs, record: mine });
  }
  const good = goodRuns + 1, up = TIER_ORDER[i + 1], wait = waits[up] ?? FIRST;
  if (i < TIER_ORDER.indexOf(top) && good >= wait) return next({ tier: up, waits: { ...waits, [up]: Math.min(LONGEST, wait * 3) }, from: now, record: mine });
  return next({ goodRuns: good, record: mine });
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
