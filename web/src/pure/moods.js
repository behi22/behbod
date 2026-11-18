// Each stage's look in the hall. Colours are linear.
export const MOODS = {
  warmup: { sign: 'WARM-UP', set: 'training', tint: [1, 1, 1], bright: 1, haze: [0.012, 0.016, 0.024], hazeK: 0.011,
    strip: [0.82, 0.9, 1.0], accent: [0.1, 0.9, 0.8], glow: [0.55, 1.0, 0.92], pulse: 0, speed: 0 },
  walkers: { sign: 'WALKERS', set: 'factory', tint: [1.0, 0.74, 0.5], bright: 0.95, haze: [0.04, 0.025, 0.012], hazeK: 0.017,
    strip: [1.0, 0.68, 0.34], accent: [1.0, 0.5, 0.08], glow: [1.0, 0.55, 0.12], pulse: 0, speed: 0 },
  swarm: { sign: 'SWARM', set: 'hive', tint: [0.86, 0.68, 1.04], bright: 0.92, haze: [0.022, 0.01, 0.036], hazeK: 0.014,
    strip: [0.92, 0.36, 1.0], accent: [0.2, 0.9, 1.0], glow: [1.0, 0.3, 0.9], pulse: 0.55, speed: 10 },
  dark: { sign: 'LIGHTS OUT', set: 'blackout', tint: [1.0, 0.58, 0.52], bright: 0.82, haze: [0.02, 0.006, 0.005], hazeK: 0.012,
    strip: [1.0, 0.3, 0.22], accent: [1.0, 0.16, 0.1], glow: [1.0, 0.16, 0.1], pulse: 0, speed: 0 },
  long: { sign: 'THE LONG SHOT', set: 'night', tint: [0.66, 0.78, 1.04], bright: 0.9, haze: [0.008, 0.016, 0.04], hazeK: 0.008,
    strip: [0.55, 0.74, 1.0], accent: [0.3, 0.75, 1.0], glow: [0.5, 0.78, 1.0], pulse: 0.7, speed: 16 },
};
export const moodOf = id => MOODS[id] || MOODS.warmup;

// The lights dip and the set changes in the dark, so nothing pops in; they come back with two stutters, like strip lights.
export const SHIFT = { down: 0.22, hold: 0.1, up: 0.75, low: 0.12 };
const SWAP = SHIFT.down + SHIFT.hold / 2, END = SHIFT.down + SHIFT.hold + SHIFT.up;
const ease = x => x * x * (3 - 2 * x);

export function newShift(id) { return { shown: id, want: id, t: END, from: 1, k: 1 }; }

// A new dip starts from the light as it is, so a quick second change never jumps.
export function wantMood(s, id) {
  if (id === s.want) return;
  s.want = id;
  if (s.t >= SWAP) { s.from = s.k; s.t = 0; }
}

export function stepShift(s, dt) {
  if (s.t >= END) { s.k = 1; return null; }
  const was = s.t;
  s.t = Math.min(END, s.t + Math.max(0, dt));
  const t = s.t;
  if (t < SHIFT.down) s.k = s.from + (SHIFT.low - s.from) * ease(t / SHIFT.down);
  else if (t < SHIFT.down + SHIFT.hold) s.k = SHIFT.low;
  else {
    const u = (t - SHIFT.down - SHIFT.hold) / SHIFT.up;
    const stutter = (u > 0.18 && u < 0.26) || (u > 0.44 && u < 0.5) ? 0.45 : 1;
    s.k = SHIFT.low + (1 - SHIFT.low) * ease(Math.min(1, u)) * stutter;
  }
  if (t >= END) s.k = 1;
  if (was < SWAP && t >= SWAP && s.want !== s.shown) { s.shown = s.want; return s.shown; }
  return null;
}
export const shifting = s => s.t < END;
