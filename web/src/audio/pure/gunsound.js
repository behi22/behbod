import { makeRng } from './rng.js';

// The guns' sounds, made sample by sample (nothing recorded, nothing downloaded), with the hall they are heard in
// already in them: the near walls answering first, the backstop thirty metres off a beat later, then the long
// concrete tail. Pure: a name, a gun's recipe and a seed in, two channels of samples out. Each gun describes its
// own sound in GUN_SOUNDS; the parts (the crack, the blast, the thump, the action's clacks, the hall) are shared.
export const SR = 48000;

// The P-22: a 9 mm-ish crack and blast, a light slide. The other guns give their own numbers here.
export const GUN_SOUNDS = {
  pistol: {
    crack: 0.9,
    blast: { lp: 2600, body: 720, q: 0.8, decay: 0.045, level: 1 },
    thump: { from: 115, to: 42, decay: 0.085, level: 0.75 },
    // The slide going back (frame and barrel lugs) and slamming home, as ringing metal.
    cycle: [{ at: 0.014, f: [2350, 3870, 5640, 7420], d: 0.02, level: 0.2 }, { at: 0.05, f: [2050, 3420, 5180], d: 0.028, level: 0.26 }],
    hall: { rt: 1.25, level: 0.3, slap: 0.18 },
    // With the suppressor: the crack and blast mostly caught, the action louder than the shot.
    quiet: { crack: 0.06, blast: 0.2, lp: 1100, hall: 0.35 },
    // The action's own metal: the slide (heavy), the magazine and its catch (light), the frame (polymer, dull).
    slide: [1780, 2610, 3720, 5230], latch: [3150, 4420, 6900], frame: [880, 1650, 2440],
  },
};

const TAU = Math.PI * 2;
const at = (sec) => Math.round(sec * SR);

// ---------- pieces ----------
function biquad(x, type, f, q = 0.707) {
  const w = TAU * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
// Noise that rises in `rise` seconds and dies away by e every `decay` seconds, then filtered.
function burst(rng, len, rise, decay, filters) {
  const n = at(len), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] = (rng.next() * 2 - 1) * Math.min(1, t / Math.max(rise, 1e-5)) * Math.exp(-t / decay); }
  for (const [type, f, q] of filters) biquad(x, type, f, q);
  return x;
}
// Ringing metal: a few modes, each a little off its book value, dying away.
function ring(rng, freqs, decay, len = decay * 7) {
  const n = at(len), x = new Float32Array(n);
  freqs.forEach((f0, k) => {
    const f = f0 * (1 + rng.jitter(0.025)), d = decay * (1 - 0.12 * k), a = 1 / (1 + k * 0.6), ph = rng.next() * TAU;
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] += a * Math.sin(TAU * f * t + ph) * Math.exp(-t / d) * Math.min(1, t / 0.0004); }
  });
  return x;
}
// A low thump whose pitch falls.
function thump(from, to, decay, len = decay * 6) {
  const n = at(len), x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (to + (from - to) * Math.exp(-t / (decay * 0.5))) / SR; x[i] = Math.sin(ph) * Math.exp(-t / decay) * Math.min(1, t / 0.002); }
  return x;
}
// The crack of the bullet leaving: a sharp up-and-down N-shaped wave a third of a millisecond long.
function crack(width = 0.00035) {
  const n = Math.max(4, at(width)), x = new Float32Array(n + 8);
  for (let i = 0; i < n; i++) x[i] = 1 - 2 * i / (n - 1);
  return x;
}
const mix = (out, x, start, gain = 1) => { const o = at(start); for (let i = 0; i < x.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += x[i] * gain; return out; };

// The hall: the side walls and the low ceiling close by, the backstop down the hall, then the tail. Two channels,
// alike at first and drifting apart in the tail, so the room is all round.
function hall(rng, dry, { rt, level, slap }) {
  const n = dry.length + at(rt * 1.1), L = new Float32Array(n), R = new Float32Array(n);
  L.set(dry); R.set(dry);
  const soft = biquad(Float32Array.from(dry), 'lp', 3600);
  for (const [ms, g, side] of [[9, 0.32, 0], [14, 0.24, 1], [21, 0.2, 0], [29, 0.15, 1], [38, 0.12, 0], [52, 0.09, 1]]) {
    mix(side ? R : L, soft, ms / 1000, g * level * 2.2); mix(side ? L : R, soft, ms / 1000 + 0.0023, g * level * 1.4);
  }
  const far = biquad(Float32Array.from(dry), 'lp', 2200);
  mix(L, far, slap, level * 0.5); mix(R, far, slap + 0.004, level * 0.45);
  mix(L, far, slap * 2, level * 0.14); mix(R, far, slap * 2 + 0.006, level * 0.16);
  // The tail follows how loud the shot was, darkening as it dies.
  let e = 0;
  for (let i = 0; i < Math.min(dry.length, at(0.06)); i++) e += dry[i] * dry[i];
  const amp = Math.sqrt(e / at(0.06)) * level * 1.8;
  for (const ch of [L, R]) {
    const tail = new Float32Array(n);
    let y = 0;
    for (let i = at(0.012); i < n; i++) {
      const t = i / SR, fc = 5200 * Math.exp(-t / (rt * 0.45)) + 500, a = 1 - Math.exp(-TAU * fc / SR);
      y += a * ((rng.next() * 2 - 1) - y);
      tail[i] = y * amp * Math.min(1, (t - 0.012) / 0.03) * Math.exp(-6.9 * t / rt);
    }
    mix(ch, tail, 0);
  }
  return [L, R];
}
// Every sound ends at a true zero, starts on a whisper, and is scaled to its peak.
function finish(chans, peak, drive = 0) {
  if (drive) for (const c of chans) for (let i = 0; i < c.length; i++) c[i] = Math.tanh(c[i] * drive) / Math.tanh(drive);
  let top = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) top = Math.max(top, Math.abs(c[i]));
  const k = top ? peak / top : 0, fade = at(0.02);
  for (const c of chans) for (let i = 0; i < c.length; i++) { c[i] *= k; const left = c.length - 1 - i; if (left < fade) c[i] *= left / fade; }
  return chans;
}

// ---------- the sounds ----------
function shot(g, rng, quiet) {
  const q = quiet ? g.quiet : null, out = new Float32Array(at(0.4));
  mix(out, crack(), 0, g.crack * (q ? q.crack : 1));
  const b = g.blast;
  mix(out, burst(rng, 0.3, 0.0006, b.decay, [['lp', q ? q.lp : b.lp, 0.7], ['bp', b.body, b.q]]), 0.0002, b.level * 2.4 * (q ? q.blast : 1));
  mix(out, burst(rng, 0.25, 0.0004, b.decay * 0.6, [['lp', q ? q.lp * 1.6 : b.lp * 2.2, 0.7]]), 0.0002, b.level * 0.7 * (q ? q.blast : 1));
  mix(out, thump(g.thump.from, g.thump.to, g.thump.decay), 0.001, g.thump.level * (q ? 0.45 : 1));
  for (const c of g.cycle) mix(out, ring(rng, c.f, c.d), c.at, c.level * (q ? 1.6 : 1));
  const [L, R] = hall(rng, out, q ? { ...g.hall, level: g.hall.level * q.hall, rt: g.hall.rt * 0.7 } : g.hall);
  return finish([L, R], q ? 0.42 : 0.95, q ? 0 : 1.6);
}
const small = (rng, parts, len, rt = 0.5, level = 0.12) => {
  const out = new Float32Array(at(len));
  for (const [x, t, gain] of parts) mix(out, x, t, gain);
  return hall(rng, out, { rt, level, slap: 0.18 });
};
const cloth = (rng, len, level = 1) => {
  // Fabric: hiss in a soft band, coming and going.
  const x = burst(rng, len, 0.03, len * 0.6, [['bp', 1800, 0.6], ['lp', 5000]]);
  let m = 0;
  for (let i = 0; i < x.length; i++) { if (i % 480 === 0) m = 0.4 + 0.6 * rng.next(); x[i] *= m * level; }
  return x;
};

const SOUNDS = {
  shot: (g, rng) => shot(g, rng, false),
  shotQuiet: (g, rng) => shot(g, rng, true),
  // The trigger breaking on an empty chamber: a light, dry click.
  dry: (g, rng) => finish(small(rng, [[ring(rng, g.latch, 0.004), 0, 0.5], [burst(rng, 0.02, 0.0003, 0.003, [['bp', 2600, 1.2]]), 0, 0.6]], 0.08, 0.3, 0.06), 0.5),
  magRelease: (g, rng) => finish(small(rng, [[ring(rng, g.latch.map(f => f * 1.2), 0.003), 0, 0.5], [burst(rng, 0.02, 0.0003, 0.002, [['hp', 3000]]), 0, 0.4]], 0.06, 0.3, 0.05), 0.35),
  // The magazine sliding out of the grip.
  magOut: (g, rng) => {
    const rasp = burst(rng, 0.12, 0.01, 0.05, [['bp', 2200, 1.4]]);
    return finish(small(rng, [[rasp, 0, 0.8], [ring(rng, g.latch, 0.006), 0.07, 0.3]], 0.2), 0.45);
  },
  // An empty magazine landing on the concrete, a bounce and a rattle.
  magDrop: (g, rng) => {
    const hit = (t, k) => [[burst(rng, 0.06, 0.0005, 0.012, [['lp', 900], ['bp', 600, 0.8]]), t, 1.2 * k], [ring(rng, [1150, 2730, 4100], 0.018), t, 0.35 * k]];
    return finish(small(rng, [...hit(0, 1), ...hit(0.11, 0.45), ...hit(0.17, 0.2), ...hit(0.205, 0.08)], 0.45, 0.9, 0.22), 0.5);
  },
  // In: the slide up the well, the catch snapping over, the palm's slap on the foot.
  magIn: (g, rng) => {
    const slideIn = burst(rng, 0.07, 0.02, 0.025, [['bp', 1700, 1.2]]);
    return finish(small(rng, [[slideIn, 0, 0.6], [ring(rng, g.latch, 0.012), 0.055, 0.7], [burst(rng, 0.05, 0.0008, 0.01, [['lp', 500]]), 0.054, 1.4], [thump(160, 80, 0.03), 0.054, 0.5]], 0.25), 0.62);
  },
  // The slide let go: it slams home, all its metal ringing.
  slideRelease: (g, rng) => finish(small(rng, [[burst(rng, 0.03, 0.0003, 0.004, [['bp', 3000, 1]]), 0, 0.8], [ring(rng, g.slide, 0.03), 0.002, 0.9], [thump(220, 120, 0.02), 0.002, 0.5]], 0.35, 0.7, 0.16), 0.75, 1.2),
  slideHome: (g, rng) => finish(small(rng, [[ring(rng, g.slide.map(f => f * 1.05), 0.018), 0, 0.7], [burst(rng, 0.02, 0.0003, 0.003, [['bp', 3200, 1]]), 0, 0.5]], 0.2), 0.45),
  // A hand easing the slide back: steel on steel, a dry rasp.
  slidePull: (g, rng) => {
    const rasp = burst(rng, 0.18, 0.03, 0.08, [['bp', 3400, 2.2]]);
    return finish(small(rng, [[rasp, 0, 0.7], [ring(rng, g.latch, 0.004), 0, 0.15]], 0.25), 0.3);
  },
  grab: (g, rng) => finish(small(rng, [[burst(rng, 0.05, 0.002, 0.012, [['lp', 1400]]), 0, 1], [ring(rng, g.frame, 0.006), 0.004, 0.25]], 0.1), 0.25),
  handle: (g, rng) => finish(small(rng, [[ring(rng, g.frame, 0.01), 0, 0.5], [cloth(rng, 0.15, 0.5), 0, 1]], 0.2), 0.22),
  cloth: (g, rng) => finish(small(rng, [[cloth(rng, 0.3), 0, 1]], 0.35, 0.4, 0.05), 0.2),
  draw: (g, rng) => finish(small(rng, [[cloth(rng, 0.22), 0, 1], [ring(rng, g.frame, 0.008), 0.18, 0.6], [ring(rng, g.latch, 0.003), 0.2, 0.25]], 0.32, 0.4, 0.06), 0.3),
};
export const SOUND_NAMES = Object.keys(SOUNDS);
// How many takes of each sound, so a run of shots never sounds like one sample played again.
export const TAKES = { shot: 3, shotQuiet: 2, magDrop: 2 };

// One take of a sound for a gun: two channels at SR.
export function gunSound(name, gunId = 'pistol', take = 0) {
  const g = GUN_SOUNDS[gunId], make = SOUNDS[name];
  if (!g || !make) return null;
  return make(g, makeRng(`${gunId}:${name}:${take}`));
}
