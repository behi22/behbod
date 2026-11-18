import { tone, noisy } from './drums.js';
import { makePanner, setPos, stats } from './core.js';

// The robots' sounds, made here: a walker's boots and servos and the chirp it gives when it looks at you, a drone's
// rotors (a loop that follows it about), the whine of a bolt gathering, the bolt leaving, passing you and being shot,
// a shield taking a hit, and the flashlight's switch. `go(pos, wet)` starts a sound at a place in the room (or in the
// head when pos is null); the rotors need nodes that live as long as the drone, so they are made from `env` directly.
export function foeSounds(go, env) {
  return {
    walkerStep(pos) {
      const S = go(pos, 0.15);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 88, 0.16, 0.002, 0.11, t);
      o.frequency.setValueAtTime(88, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.1);
      noisy(S, 'lowpass', 420, 0.8, 0.2, 0.002, 0.08, t);
      noisy(S, 'bandpass', 2700, 4, 0.05, 0.001, 0.03, t + 0.012);
      const w = tone(S, 'triangle', 330, 0.025, 0.03, 0.1, t);
      w.frequency.setValueAtTime(330, t); w.frequency.linearRampToValueAtTime(470, t + 0.13);
      S.play(t, t + 0.25);
    },
    walkerChirp(pos) {
      const S = go(pos, 0.2);
      if (!S) return;
      const t = S.t;
      for (const [at, f0, f1] of [[0, 900, 1350], [0.1, 1200, 1750]]) { const o = tone(S, 'triangle', f0, 0.06, 0.004, 0.07, t + at); o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + 0.06); }
      S.play(t, t + 0.3);
    },
    // A drone's rotors: a buzz and a breath, chopped by the blades. Returns { move(pos, hurt), stop() }, or null when
    // the sound is off.
    droneHum(pos) {
      const e = env.ready();
      if (!e) return null;
      const ctx = e.ctx, now = ctx.currentTime, nodes = [];
      const node = n => { nodes.push(n); return n; }, gain = v => { const g = node(ctx.createGain()); g.gain.value = v; return g; };
      const pan = node(makePanner(ctx, pos)), out = gain(0), chop = gain(0.6), breath = gain(0.3), depth = gain(0.4);
      const saw = node(ctx.createOscillator()), lfo = node(ctx.createOscillator()), noise = node(ctx.createBufferSource());
      const low = node(ctx.createBiquadFilter()), band = node(ctx.createBiquadFilter());
      const base = 112 + Math.random() * 24;
      saw.type = 'sawtooth'; saw.frequency.value = base; lfo.frequency.value = base * 0.4;
      low.type = 'lowpass'; low.frequency.value = 650; band.type = 'bandpass'; band.frequency.value = 2100; band.Q.value = 0.8;
      noise.buffer = e.noise; noise.loop = true;
      saw.connect(low).connect(chop); noise.connect(band).connect(breath).connect(chop);
      lfo.connect(depth).connect(chop.gain);
      chop.connect(out).connect(pan).connect(e.sfxIn);
      out.gain.setTargetAtTime(0.045, now, 0.25);
      for (const s of [saw, lfo, noise]) s.start(now, s === noise ? Math.random() : 0);
      stats.loops++;
      let done = false;
      saw.onended = () => { for (const n of nodes) n.disconnect(); stats.loops--; };
      return {
        move(p, hurt = 0) {
          if (done) return;
          setPos(pan, p);
          const f = base * (1 - 0.18 * hurt) * (hurt > 0.45 ? 1 + 0.06 * Math.sin(ctx.currentTime * 19) : 1);
          saw.frequency.setTargetAtTime(f, ctx.currentTime, 0.05); lfo.frequency.setTargetAtTime(f * 0.4, ctx.currentTime, 0.05);
        },
        stop() {
          if (done) return;
          done = true;
          const t = ctx.currentTime;
          out.gain.setTargetAtTime(0, t, 0.06);
          for (const s of [saw, lfo, noise]) s.stop(t + 0.4);
        },
      };
    },
    // The eye gathering a bolt: a whine that climbs for `span` seconds.
    droneCharge(pos, span = 1) {
      const S = go(pos, 0.25);
      if (!S) return null;
      const t = S.t;
      for (const [type, f0, k] of [['sine', 360, 0.08], ['triangle', 726, 0.03]]) {
        const o = tone(S, type, f0, k, span * 0.85, 0.18, t);
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 4.2, t + span);
      }
      S.play(t, t + span + 0.3);
      let over = false;
      S.onDone = () => { over = true; };
      // A drone shot or left mid-charge must not go on whining.
      return {
        stop() {
          if (over) return;
          const now = S.ctx.currentTime;
          S.out.gain.cancelScheduledValues(now); S.out.gain.setTargetAtTime(0, now, 0.015);
          S.stop(now + 0.08);
        },
      };
    },
    boltFire(pos) {
      const S = go(pos, 0.35);
      if (!S) return;
      const t = S.t, o = tone(S, 'square', 1700, 0.05, 0.002, 0.18, t);
      o.frequency.setValueAtTime(1700, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.18);
      const b = tone(S, 'sine', 150, 0.22, 0.002, 0.16, t);
      b.frequency.setValueAtTime(150, t); b.frequency.exponentialRampToValueAtTime(60, t + 0.15);
      noisy(S, 'highpass', 3000, 0.7, 0.1, 0.001, 0.05, t);
      S.play(t, t + 0.3);
    },
    // A bolt going by: a breath of air that falls in pitch.
    boltPass(pos) {
      const S = go(pos, 0.2);
      if (!S) return;
      const t = S.t, f = noisy(S, 'bandpass', 1900, 1.4, 0.32, 0.03, 0.32, t);
      f.frequency.setValueAtTime(1900, t); f.frequency.exponentialRampToValueAtTime(420, t + 0.35);
      const o = tone(S, 'sine', 760, 0.05, 0.01, 0.3, t);
      o.frequency.setValueAtTime(760, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.32);
      S.play(t, t + 0.45);
    },
    boltPop(pos) {
      const S = go(pos, 0.3);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 900, 0.14, 0.001, 0.09, t);
      o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1900, t + 0.06);
      noisy(S, 'bandpass', 2600, 1.2, 0.3, 0.001, 0.04, t);
      for (let i = 0; i < 4; i++) noisy(S, 'highpass', 6000, 0.7, 0.05, 0.0005, 0.02, t + 0.03 + Math.random() * 0.15);
      S.play(t, t + 0.3);
    },
    // A shield takes a bolt: a thump in the chest, the crack of it, and the glass ringing; deeper for the last one.
    shieldHit(left = 2) {
      const S = go(null, 0.4);
      if (!S) return;
      const t = S.t, last = left <= 0, o = tone(S, 'sine', last ? 62 : 78, 0.55, 0.003, last ? 0.5 : 0.3, t);
      o.frequency.setValueAtTime(last ? 62 : 78, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.3);
      noisy(S, 'bandpass', 1800, 0.7, 0.42, 0.001, 0.2, t);
      for (const [f, k] of [[1900, 0.06], [2650, 0.045], [3420, 0.03]]) tone(S, 'sine', f * (last ? 0.8 : 1), k, 0.001, 0.5, t + 0.01);
      const d = tone(S, 'triangle', 660, 0.06, 0.01, 0.35, t + 0.06);
      d.frequency.setValueAtTime(660, t + 0.06); d.frequency.exponentialRampToValueAtTime(last ? 180 : 330, t + 0.4);
      S.play(t, t + 0.8);
    },
    // A drone shot out of the air: a crunch, and its rotors whining down as it falls.
    droneHit(pos) {
      const S = go(pos, 0.4);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 1500, 0.8, 0.4, 0.001, 0.1, t);
      const o = tone(S, 'sawtooth', 820, 0.035, 0.01, 0.9, t + 0.02);
      o.frequency.setValueAtTime(820, t + 0.02); o.frequency.exponentialRampToValueAtTime(150, t + 0.9);
      S.play(t, t + 1.0);
    },
    flashlight(on) {
      const S = go(null);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', on ? 3800 : 3000, 2, 0.14, 0.0005, 0.012, t);
      tone(S, 'square', on ? 2300 : 1700, 0.025, 0.0005, 0.01, t);
      S.play(t, t + 0.06);
    },
  };
}
