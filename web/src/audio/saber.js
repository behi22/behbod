import { shot, makePanner, setPos, stats } from './core.js';
import { tone, noisy } from './drums.js';

// The saber's sounds, all made here: a hum that climbs and brightens as the blade swings, with the rush of air on top;
// the snap of it lighting and the sigh of it going out; the crack when a bolt meets it; the drone's warning, its shot,
// the sting of a bolt that gets through, and the zap of one sent back into the drone.
const BASE = 88;

export function makeSaberAudio(env) {
  const go = (pos, wet = 0) => {
    const e = env.ready();
    if (!e) return null;
    const S = shot(e, e.sfxIn, pos), bus = S.gain(1);
    bus.connect(S.out);
    if (wet) bus.connect(S.gain(wet)).connect(e.sfxSend);
    S.out = bus;
    S.t = e.ctx.currentTime + 0.01;
    return S;
  };

  // A live hum: two buzzing saws a hair apart through a filter, a low body under them, and hiss for the swing.
  const voices = {};
  function voice(name, pos) {
    const e = env.ready();
    if (!e) return null;
    if (voices[name]?.ctx === e.ctx) return voices[name];
    const ctx = e.ctx, now = ctx.currentTime;
    const out = ctx.createGain(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(), body = ctx.createGain();
    out.gain.value = 0; ng.gain.value = 0; body.gain.value = 0.55;
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 1.6;
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), c = ctx.createOscillator(), n = ctx.createBufferSource();
    a.type = b.type = 'sawtooth'; c.type = 'sine';
    a.frequency.value = BASE; b.frequency.value = BASE * 1.015; c.frequency.value = BASE / 2;
    n.buffer = e.noise; n.loop = true;
    a.connect(lp); b.connect(lp); lp.connect(out); c.connect(body).connect(out); n.connect(bp).connect(ng).connect(out);
    const pan = pos ? makePanner(ctx, pos) : null;
    if (pan) { pan.refDistance = 0.45; pan.rolloffFactor = 1.8; out.connect(pan).connect(e.sfxIn); } else out.connect(e.sfxIn);
    for (const o of [a, b, c]) o.start(now);
    n.start(now, Math.random() * 1.5);
    stats.loops++;
    return (voices[name] = { ctx, out, lp, bp, ng, body, a, b, c, n, pan });
  }
  function silence(name) {
    const v = voices[name];
    if (!v) return;
    delete voices[name];
    const t = v.ctx.currentTime;
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setTargetAtTime(0, t, 0.04);
    for (const o of [v.a, v.b, v.c, v.n]) o.stop(t + 0.3);
    v.n.onended = () => { for (const x of [v.a, v.b, v.c, v.n, v.lp, v.bp, v.ng, v.body, v.out, v.pan]) x?.disconnect(); stats.loops--; };
  }
  // level 0 lets it go. pitch, swing (0..1) and bright (the filter, Hz) come from the swing (pure/saber.js hum()).
  function set(name, level, { pitch = 1, swing = 0, bright = 700 } = {}, pos) {
    if (!(level > 0)) { silence(name); return; }
    const v = voice(name, pos);
    if (!v) return;
    const t = v.ctx.currentTime, k = 0.025;
    v.out.gain.setTargetAtTime(level * (1 + 0.6 * swing), t, k);
    v.a.frequency.setTargetAtTime(BASE * pitch, t, k);
    v.b.frequency.setTargetAtTime(BASE * 1.015 * pitch, t, k);
    v.c.frequency.setTargetAtTime(BASE / 2 * pitch, t, k);
    v.lp.frequency.setTargetAtTime(bright, t, k);
    v.ng.gain.setTargetAtTime(0.015 + 0.55 * swing * swing, t, k);
    v.bp.frequency.setTargetAtTime(700 + 1700 * swing, t, k * 2);
    if (pos && v.pan) setPos(v.pan, pos);
  }

  return {
    // The saber in the hand (no place: it is right in front of you), and the one in the case, heard from close by.
    hum(level, swing) { set('hand', level, swing); },
    caseHum(level, pos) { set('case', level, undefined, pos); },
    get humming() { return Object.keys(voices); },
    ignite() {
      const S = go(null, 0.15);
      if (!S) return;
      const t = S.t;
      noisy(S, 'highpass', 3200, 0.7, 0.3, 0.0008, 0.03, t);
      const n = S.noise(), bp = S.filt('bandpass', 300, 1.4), g = S.gain();
      n.connect(bp).connect(g).connect(S.out);
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.22);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      const o = S.osc('sawtooth', 30), lp = S.filt('lowpass', 900, 2), og = S.gain();
      o.connect(lp).connect(og).connect(S.out);
      o.frequency.setValueAtTime(30, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.12); o.frequency.exponentialRampToValueAtTime(BASE, t + 0.3);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.4, t + 0.03); og.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      S.play(t, t + 0.55);
    },
    retract() {
      const S = go(null, 0.1);
      if (!S) return;
      const t = S.t, o = S.osc('sawtooth', BASE), lp = S.filt('lowpass', 1400, 1.5), g = S.gain();
      o.connect(lp).connect(g).connect(S.out);
      o.frequency.setValueAtTime(BASE * 1.1, t); o.frequency.exponentialRampToValueAtTime(24, t + 0.36);
      lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(160, t + 0.36);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      const f = noisy(S, 'bandpass', 2600, 1, 0.12, 0.004, 0.3, t);
      f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      S.play(t, t + 0.5);
    },
    clash(pos) {
      const S = go(pos, 0.35);
      if (!S) return;
      const t = S.t;
      noisy(S, 'highpass', 2400, 0.7, 0.55, 0.0005, 0.12, t);
      noisy(S, 'bandpass', 1100, 0.8, 0.35, 0.001, 0.26, t);
      for (let k = 0; k < 9; k++) noisy(S, 'highpass', 3500 + Math.random() * 3000, 1, 0.08 + Math.random() * 0.16, 0.0005, 0.012, t + 0.02 + Math.random() * 0.28);
      const o = tone(S, 'square', 1900, 0.06, 0.001, 0.14, t);
      o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.14);
      tone(S, 'sine', 115, 0.32, 0.002, 0.16, t);
      S.play(t, t + 0.55);
    },
    tell(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t;
      tone(S, 'sine', 2300, 0.07, 0.002, 0.05, t);
      tone(S, 'sine', 2750, 0.07, 0.002, 0.06, t + 0.11);
      S.play(t, t + 0.25);
    },
    bolt(pos) {
      const S = go(pos, 0.2);
      if (!S) return;
      const t = S.t, o = tone(S, 'triangle', 1500, 0.22, 0.002, 0.2, t), o2 = tone(S, 'sine', 3100, 0.07, 0.001, 0.12, t);
      o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.19);
      o2.frequency.setValueAtTime(3100, t); o2.frequency.exponentialRampToValueAtTime(900, t + 0.1);
      noisy(S, 'bandpass', 2000, 2, 0.07, 0.001, 0.05, t);
      S.play(t, t + 0.32);
    },
    sting() {
      const S = go(null, 0.1);
      if (!S) return;
      const t = S.t, buzz = S.osc('square', 70), lp = S.filt('lowpass', 420, 1), g = S.gain();
      buzz.connect(lp).connect(g).connect(S.out);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      noisy(S, 'lowpass', 500, 0.7, 0.45, 0.002, 0.12, t);
      noisy(S, 'highpass', 5000, 0.7, 0.12, 0.0005, 0.04, t);
      S.play(t, t + 0.32);
    },
    zap(pos) {
      const S = go(pos, 0.3);
      if (!S) return;
      const t = S.t;
      noisy(S, 'highpass', 3000, 0.7, 0.35, 0.0005, 0.08, t);
      for (const [f, a, d] of [[880, 0.12, 0.35], [2350, 0.05, 0.2], [4100, 0.03, 0.1]]) tone(S, 'sine', f, a, 0.001, d, t);
      const o = tone(S, 'sawtooth', 600, 0.06, 0.002, 0.25, t + 0.02);
      o.frequency.setValueAtTime(600, t + 0.02); o.frequency.exponentialRampToValueAtTime(90, t + 0.27);
      S.play(t, t + 0.5);
    },
  };
}
