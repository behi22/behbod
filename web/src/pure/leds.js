// The studio's LEDs with a record playing, and their flash for a goal.
export const BANDS = 16, GOAL_BEAT = 0.25, GOAL_TIME = 9 * GOAL_BEAT;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Lands exactly on 0 or 1, so the strips end exactly as they were.
export function settle(k, on, dt, rate = 3) {
  const to = on ? 1 : 0, next = k + (to - k) * Math.min(1, dt * rate);
  return Math.abs(next - to) < 0.004 ? to : next;
}

// The level's slow average, so a quiet record moves the strips as much as a loud one.
export const follow = (avg, level, dt) => avg + (level - avg) * (1 - Math.exp(-dt / 3));

export const kicked = (kick, strength) => Math.max(kick, clamp(+strength || 0, 0, 1));
export const fade = (kick, dt) => kick * Math.exp(-dt / 0.12);

// Brightness against the scene's own (1); `k` is how much the music counts, 0 to 1.
export function pulse(level, avg, kick, k) {
  const rel = clamp(level / Math.max(avg, 0.05), 0, 2);
  const m = clamp(0.8 + 0.5 * (rel - 1) + 0.6 * kick, 0.3, 1.8);
  return 1 + (m - 1) * clamp(k, 0, 1);
}

// The analyser's bytes as bands from 50 Hz to 10 kHz, spaced as the ear hears them, each the loudest bin in it (0 to 1).
export function toBands(bytes, sampleRate, fftSize, out) {
  const n = out.length, hz = sampleRate / fftSize, last = bytes.length - 1;
  for (let i = 0; i < n; i++) {
    const a = Math.min(last, Math.max(0, Math.floor((50 * 200 ** (i / n)) / hz)));
    const b = Math.min(last, Math.max(a, Math.ceil((50 * 200 ** ((i + 1) / n)) / hz) - 1));
    let top = 0;
    for (let j = a; j <= b; j++) top = Math.max(top, bytes[j]);
    out[i] = top / 255;
  }
  return out;
}

// Each band against its own average (below 0: not heard yet), so a soft treble moves as much as a loud bass.
export function lively(bands, avg, out, dt) {
  const k = 1 - Math.exp(-dt / 1.5);
  for (let i = 0; i < bands.length; i++) {
    avg[i] = avg[i] < 0 ? bands[i] : avg[i] + (bands[i] - avg[i]) * k;
    out[i] = clamp(0.4 + (bands[i] - avg[i]) * 4, 0, 1);
  }
  return out;
}

// One change a beat stays under three flashes in any second, the safe limit; held still for anyone asking for less motion.
const WHITE = [1, 1, 1], GOLD = [1, 0.72, 0.18];
export const goalFlash = (s, still = false) => (!still && Math.floor(s / GOAL_BEAT) % 2 ? [GOLD, WHITE] : [WHITE, GOLD]);

// A goal while the flash runs, or within a beat of its end, keeps to the same beats and waits for the next one.
export function goalStart(f, t) {
  if (!f || t > f.until + GOAL_BEAT) return { at: t, from: t, until: t + GOAL_TIME };
  const beat = x => f.at + Math.ceil((x - f.at) / GOAL_BEAT - 1e-9) * GOAL_BEAT;
  return { at: f.at, from: t < f.until ? f.from : beat(t), until: beat(t + GOAL_TIME) };
}
export const goalShows = (f, t, still = false) => (f && t >= f.from && t < f.until ? goalFlash(t - f.at, still) : null);
