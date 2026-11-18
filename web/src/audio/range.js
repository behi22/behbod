import { tone, noisy } from './drums.js';
import { gunSound, SOUND_NAMES, TAKES, SR } from './pure/gunsound.js';

// The gun's sounds are made in pure/gunsound.js and played as samples at these levels against the shot; the rest are live.
const LEVEL = { shot: 0.8, shotQuiet: 0.8, dry: 0.9, magRelease: 0.8, magOut: 0.9, magDrop: 0.7, magIn: 1, slideRelease: 1, slideHome: 0.9, slidePull: 0.9, grab: 0.8, handle: 0.8, cloth: 0.7, draw: 0.8 };

// `go(pos, wet)` starts a sound at a place in the room (or in the head when pos is null) with some of it sent to the reverb.
export function rangeSounds(go) {
  const ring = (S, t, parts, level) => { for (const [f, a, d] of parts) tone(S, 'sine', f, a * level, 0.001, d, t); };
  // The gun's sounds as samples, made once; and as the sound card's own buffers, made once per card.
  const made = new Map(), cards = new WeakMap(), making = new Set();
  const samples = (gun, name, take) => { const k = `${gun}:${name}:${take}`; if (!made.has(k)) made.set(k, gunSound(name, gun, take)); return made.get(k); };
  // Everything a gun will want is made a piece at a time between frames, the first time it is heard.
  const prepare = gun => {
    if (making.has(gun)) return;
    making.add(gun);
    const todo = SOUND_NAMES.flatMap(n => Array.from({ length: TAKES[n] || 1 }, (_, t) => [gun, n, t]));
    const next = () => { const job = todo.shift(); if (!job) return; samples(...job); setTimeout(next, 0); };
    setTimeout(next, 0);
  };
  function play(gun, name, rate = 1 + (Math.random() - 0.5) * 0.04) {
    const S = go(null);
    if (!S) return;
    prepare(gun);
    const take = Math.floor(Math.random() * (TAKES[name] || 1)), k = `${gun}:${name}:${take}`;
    let card = cards.get(S.ctx);
    if (!card) cards.set(S.ctx, card = new Map());
    let b = card.get(k);
    if (!b) {
      const [L, R] = samples(gun, name, take);
      b = S.ctx.createBuffer(2, L.length, SR); b.copyToChannel(L, 0); b.copyToChannel(R, 1);
      card.set(k, b);
    }
    const src = S.buffer(b);
    src.playbackRate.value = rate;
    src.connect(S.gain(LEVEL[name])).connect(S.out);
    S.play(S.t, S.t + b.duration / rate + 0.02);
  }
  return {
    // loud: 1 for a bare muzzle, about 0.2 with a suppressor on.
    gunShot(loud = 1, gun = 'pistol') { play(gun, loud < 0.5 ? 'shotQuiet' : 'shot', 1 + (Math.random() - 0.5) * 0.05); },
    // The rest of a gun: the trigger on an empty chamber, the hands' moves, by the names its clips give.
    gunCue(name, gun = 'pistol') { if (Object.hasOwn(LEVEL, name)) play(gun, name); },
    casing(pos, k = 1) {
      const S = go(pos, 0.25);
      if (!S) return;
      const t = S.t, f = 4600 + Math.random() * 1800;
      ring(S, t, [[f, 0.05, 0.11], [f * 1.47, 0.03, 0.07], [f * 2.09, 0.015, 0.04]], k);
      noisy(S, 'highpass', 6000, 0.7, 0.02 * k, 0.0005, 0.01, t);
      S.play(t, t + 0.18);
    },
    plate(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t, f = 1050 + Math.random() * 260;
      noisy(S, 'bandpass', 2200, 1, 0.3, 0.0006, 0.03, t);
      ring(S, t, [[f, 0.22, 0.9], [f * 2.32, 0.12, 0.55], [f * 3.86, 0.07, 0.3], [f * 5.2, 0.035, 0.16]], 1);
      S.play(t, t + 1.1);
    },
    botHit(pos, weak) {
      const S = go(pos, 0.3);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', weak ? 3200 : 2100, 1.5, 0.26, 0.0006, 0.035, t);
      ring(S, t, weak ? [[1900, 0.1, 0.2], [2850, 0.06, 0.12]] : [[640, 0.12, 0.09], [1500, 0.05, 0.06]], 1);
      S.play(t, t + 0.3);
    },
    botDown(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t;
      noisy(S, 'lowpass', 900, 0.7, 0.5, 0.002, 0.22, t);
      noisy(S, 'bandpass', 2600, 1, 0.22, 0.001, 0.12, t);
      const o = tone(S, 'sawtooth', 260, 0.1, 0.01, 0.7, t + 0.03);
      o.frequency.setValueAtTime(260, t + 0.03); o.frequency.exponentialRampToValueAtTime(34, t + 0.7);
      for (let i = 0; i < 5; i++) noisy(S, 'highpass', 5000, 0.7, 0.07, 0.0005, 0.012, t + 0.12 + Math.random() * 0.5);
      S.play(t, t + 0.9);
    },
    droneDown(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 1400, 0.7, 0.5, 0.001, 0.14, t);
      const o = tone(S, 'square', 1900, 0.06, 0.005, 0.55, t);
      o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.55);
      noisy(S, 'highpass', 5200, 0.7, 0.1, 0.001, 0.3, t + 0.03);
      S.play(t, t + 0.7);
    },
    // A shot into concrete or steel that was not a target.
    thud(pos, steel) {
      const S = go(pos, 0.2);
      if (!S) return;
      const t = S.t;
      if (steel) { noisy(S, 'bandpass', 3000, 2, 0.12, 0.0006, 0.02, t); ring(S, t, [[2400 + Math.random() * 900, 0.05, 0.12]], 1); }
      else noisy(S, 'lowpass', 1100, 0.7, 0.22, 0.001, 0.05, t);
      S.play(t, t + 0.2);
    },
    // The count before a run (three low, one high), and the stars when it ends.
    beep(high) {
      const S = go(null);
      if (!S) return;
      const t = S.t;
      tone(S, 'sine', high ? 1320 : 880, 0.12, 0.004, high ? 0.3 : 0.12, t);
      S.play(t, t + 0.4);
    },
    stars(n) {
      const S = go(null, 0.4);
      if (!S) return;
      const t = S.t;
      for (let i = 0; i < Math.max(1, n); i++) ring(S, t + i * 0.16, [[[784, 988, 1319][i] || 784, 0.14, 0.7], [[1568, 1976, 2637][i] || 1568, 0.05, 0.4]], n ? 1 : 0.5);
      S.play(t, t + 1.5);
    },
    // The hall's lights going out or coming back.
    breaker(on) {
      const S = go(null, 0.5);
      if (!S) return;
      const t = S.t;
      noisy(S, 'lowpass', on ? 2400 : 600, 0.7, 0.3, 0.002, 0.16, t);
      const o = tone(S, 'sine', on ? 60 : 110, 0.2, 0.01, 0.5, t);
      o.frequency.exponentialRampToValueAtTime(on ? 120 : 40, t + 0.4);
      S.play(t, t + 0.6);
    },
  };
}
