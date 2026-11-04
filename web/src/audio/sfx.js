import { shot, perc, glide, makePanner, setPos, stats } from './core.js';
import { tone, noisy } from './drums.js';
import { midiToFreq } from './pure/notes.js';

const V = { a: [750, 1200], e: [550, 1850], i: [300, 2300], o: [480, 880], u: [350, 750], ae: [650, 1700] };
const pt = (x, v) => [x, ...v];

// Each syllable: consonant onset, length, a pitch path and a vowel path, both over 0..1 of the syllable.
const WORDS = {
  hello: [
    { c: 'h', d: 0.15, f0: [[0, 330], [1, 390]], v: [pt(0, V.e), pt(1, V.e)] },
    { c: 'l', d: 0.32, f0: [[0, 430], [0.4, 440], [1, 300]], v: [[0, 400, 1100], pt(0.3, V.o), pt(1, V.u)] },
  ],
  behbod: [
    { c: 'b', d: 0.17, f0: [[0, 360], [1, 410]], v: [pt(0, V.e), pt(1, V.e)] },
    { c: 'b', d: 0.3, f0: [[0, 400], [1, 290]], v: [pt(0, V.o), [1, 430, 800]], tail: 'd' },
  ],
  ohno: [
    { d: 0.24, f0: [[0, 430], [1, 340]], v: [pt(0, V.o), pt(1, V.u)] },
    { gap: 0.07 },
    { c: 'n', d: 0.34, f0: [[0, 390], [1, 250]], v: [pt(0, V.o), pt(1, V.u)] },
  ],
  yay: [{ c: 'y', d: 0.38, f0: [[0, 380], [0.5, 520], [1, 600]], v: [pt(0, V.i), pt(0.3, V.ae), pt(0.7, V.e), pt(1, V.i)] }],
  followme: [
    { c: 'f', d: 0.15, f0: [[0, 370], [1, 390]], v: [pt(0, V.a), pt(1, V.a)] },
    { c: 'l', d: 0.17, f0: [[0, 390], [1, 340]], v: [[0, 400, 1100], pt(0.4, V.o), pt(1, V.o)] },
    { c: 'm', d: 0.28, f0: [[0, 380], [1, 470]], v: [pt(0, V.i), pt(1, V.i)] },
  ],
};

function ramp(param, at, d, pts, i) {
  param.setValueAtTime(pts[0][i], at);
  for (const p of pts.slice(1)) param.linearRampToValueAtTime(p[i], at + p[0] * d);
}

// A sawtooth through moving formant filters: a tiny vowel synthesiser, so the robot and the animals share one voice box.
function speak(S, t, syls, { vib = 9, vibCents = 14, level = 0.5, breath = 0.05 } = {}) {
  let at = t;
  for (const s of syls) {
    if (s.gap) { at += s.gap; continue; }
    const pre = s.c === 'h' || s.c === 'f' ? 0.06 : 0, v0 = at + pre, v1 = v0 + s.d;
    if (pre) {
      const n = S.at(S.noise(), at, v0 + 0.02), f = S.filt('bandpass', s.c === 'f' ? 5500 : 1600, s.c === 'f' ? 1.2 : 0.8), g = S.gain();
      n.connect(f).connect(g).connect(S.out);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level * 0.35, at + 0.03); g.gain.linearRampToValueAtTime(0, v0 + 0.02);
    }
    const src = S.at(S.osc('sawtooth', s.f0[0][1]), v0, v1 + 0.06);
    src.frequency.setValueAtTime(s.f0[0][1] * 1.12, v0);
    src.frequency.exponentialRampToValueAtTime(s.f0[0][1], v0 + 0.04);
    for (const [x, f] of s.f0.slice(1)) src.frequency.exponentialRampToValueAtTime(f, v0 + Math.max(0.05, x * s.d));
    const lfo = S.at(S.osc('sine', vib), v0, v1 + 0.06), lg = S.gain(vibCents);
    lfo.connect(lg).connect(src.detune);
    const amp = S.gain();
    const v = s.c === 'y' ? [pt(0, V.i), ...s.v] : s.c === 'l' || s.c === 'n' || s.c === 'm' ? [[0, 260, s.c === 'm' ? 900 : 1150], ...s.v.map(p => [Math.max(0.15, p[0]), p[1], p[2]])] : s.v;
    [[1, 6, 1], [2, 9, 0.6], [0, 8, 0.2]].forEach(([k, q, g]) => {
      const f = S.filt('bandpass', k ? v[0][k] : 2900, q), fg = S.gain(g * 2.6);
      if (k) ramp(f.frequency, v0, s.d, v, k);
      src.connect(f).connect(fg).connect(amp);
    });
    if (breath) {
      const n = S.at(S.noise(), v0, v1 + 0.06), nf = S.filt('bandpass', v[0][2], 2), ng = S.gain(breath);
      n.connect(nf).connect(ng).connect(amp);
    }
    amp.connect(S.out);
    const hard = s.c === 'b' || s.c === 'd', nasal = s.c === 'm' || s.c === 'n';
    amp.gain.setValueAtTime(0, v0);
    amp.gain.linearRampToValueAtTime(level * (nasal ? 0.45 : 1), v0 + (hard ? 0.006 : 0.025));
    if (nasal) amp.gain.linearRampToValueAtTime(level, v0 + 0.08);
    amp.gain.setValueAtTime(level, v1 - 0.04);
    amp.gain.linearRampToValueAtTime(0, v1 + (s.tail === 'd' ? 0.01 : 0.05));
    if (hard) { const n = S.at(S.noise(), v0, v0 + 0.03), f = S.filt('lowpass', 1500), g = S.gain(); n.connect(f).connect(g).connect(S.out); perc(g.gain, v0, level * 0.4, 0.001, 0.012); }
    at = v1 + 0.02;
  }
  return at;
}

function chirp(S, t, pts, { type = 'sine', level = 0.16, trill = 0, trillDepth = 0.08 } = {}) {
  const t0 = t + pts[0][0], t1 = t + pts[pts.length - 1][0];
  const o = S.at(S.osc(type, pts[0][1]), t0, t1 + 0.02), g = S.gain();
  glide(o.frequency, t, pts);
  if (trill) { const l = S.at(S.osc('sine', trill), t0, t1 + 0.02), lg = S.gain(pts[0][1] * trillDepth); l.connect(lg).connect(o.frequency); }
  o.connect(g).connect(S.out);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(level, t0 + 0.01);
  g.gain.setValueAtTime(level, Math.max(t0 + 0.01, t1 - 0.025));
  g.gain.linearRampToValueAtTime(0, t1);
  return t1;
}

function bell(S, t, m, level, decay = 1.2) {
  const f = midiToFreq(m);
  for (const [r, a, d] of [[1, 1, decay], [2.76, 0.3, decay * 0.4], [5.4, 0.12, decay * 0.2]]) {
    const o = S.at(S.osc('sine', f * r), t, t + d + 0.05), g = S.gain();
    o.connect(g).connect(S.out);
    perc(g.gain, t, level * a, 0.002, d);
  }
}

function brass(S, t, m, dur, level) {
  const f = midiToFreq(m), lp = S.filt('lowpass', 300, 1), amp = S.gain();
  for (const c of [-6, 0, 6]) { const o = S.at(S.osc('sawtooth', f), t, t + dur + 0.4); o.detune.value = c; o.connect(lp); }
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(2800, t + 0.06);
  lp.frequency.setTargetAtTime(1600, t + 0.06, 0.3);
  lp.connect(amp).connect(S.out);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(level, t + 0.03);
  amp.gain.setValueAtTime(level, t + dur);
  amp.gain.setTargetAtTime(0, t + dur, 0.12);
}

function creak(S, t, dur, lo, hi, bands, level) {
  const o = S.at(S.osc('sawtooth', lo), t, t + dur + 0.05), g = S.gain();
  for (let x = 0; x < dur; x += 0.035) o.frequency.setValueAtTime(lo + (hi - lo) * Math.random(), t + x);
  for (const [f, q] of bands) { const b = S.filt('bandpass', f, q); o.connect(b).connect(g); }
  g.connect(S.out);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.08);
  g.gain.setValueAtTime(level, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0, t + dur);
}

export function makeSfx(env) {
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
  const loop = (tex, level) => {
    let cur = null;
    return (on, pos) => {
      const e = env.eng();
      if (!e) return;
      const ctx = e.ctx, now = ctx.currentTime;
      if (on && cur) { if (pos && cur.pan) setPos(cur.pan, pos); return; }
      if (on) {
        const src = ctx.createBufferSource(), g = ctx.createGain(), pan = pos ? makePanner(ctx, pos) : null;
        src.buffer = e.texture(tex); src.loop = true;
        g.gain.value = 0; g.gain.setTargetAtTime(level, now, 0.15);
        src.connect(g);
        if (pan) g.connect(pan).connect(e.sfxIn); else g.connect(e.sfxIn);
        src.start(now, Math.random() * src.buffer.duration);
        stats.loops++;
        src.onended = () => { src.disconnect(); g.disconnect(); if (pan) pan.disconnect(); stats.loops--; };
        cur = { src, g, pan };
      } else if (cur) {
        cur.g.gain.setTargetAtTime(0, now, 0.12);
        cur.src.stop(now + 0.7);
        cur = null;
      }
    };
  };

  const bh22 = (kind, pos) => {
    const S = go(pos);
    if (!S) return;
    const t = S.t;
    let end;
    if (kind === 'sad') {
      chirp(S, t, [[0, 900], [0.25, 700], [0.7, 380]], { type: 'triangle', trill: 6, trillDepth: 0.03, level: 0.16 });
      end = chirp(S, t, [[0.8, 360], [1.2, 300]], { type: 'triangle', level: 0.09 });
    } else if (kind === 'curious') {
      chirp(S, t, [[0, 520], [0.12, 470], [0.42, 1150]], { trill: 7, trillDepth: 0.02 });
      end = chirp(S, t, [[0.5, 1300], [0.56, 1500]], { level: 0.12 });
    } else if (kind === 'alert') {
      const lp = S.filt('lowpass', 3500);
      lp.connect(S.out);
      const out = S.out;
      S.out = lp;
      chirp(S, t, [[0, 1800], [0.08, 1800]], { type: 'square', level: 0.1 });
      chirp(S, t, [[0.13, 1800], [0.21, 1800]], { type: 'square', level: 0.1 });
      end = chirp(S, t, [[0.28, 1200], [0.45, 2200]], { type: 'square', level: 0.09 });
      S.out = out;
    } else {
      chirp(S, t, [[0, 700], [0.07, 1300]]);
      chirp(S, t, [[0.1, 900], [0.16, 1600]]);
      end = chirp(S, t, [[0.2, 1400], [0.32, 1600], [0.4, 1250]], { trill: 30, trillDepth: 0.05 });
    }
    S.play(t, end + 0.05);
  };

  return {
    bh22,
    bh22Word(word, pos) {
      const syls = WORDS[String(word || '').toLowerCase().replace(/[^a-z]/g, '')];
      if (!syls) return bh22('curious', pos);
      const S = go(pos);
      if (!S) return;
      S.play(S.t, speak(S, S.t, syls, { level: 0.32, breath: 0.04 }) + 0.1);
    },
    mouse(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t;
      for (let k = 0; k < 4; k++) {
        const a = t + k * 0.17 + Math.random() * 0.05, f = 3600 + Math.random() * 800;
        chirp(S, a, [[0, f], [0.03, f * 1.4], [0.07, f * 1.15]], { level: 0.06, trill: 40, trillDepth: 0.03 });
      }
      const n = S.noise(), hp = S.filt('highpass', 4000), g = S.gain();
      n.connect(hp).connect(g).connect(S.out);
      for (let x = 0.0; x < 0.75; x += 0.03 + Math.random() * 0.03) perc(g.gain, t + x, 0.05 + Math.random() * 0.06, 0.0005, 0.006);
      S.play(t, t + 0.85);
    },
    meow(pos) {
      const S = go(pos);
      if (!S) return;
      const end = speak(S, S.t, [{ c: 'm', d: 0.75, f0: [[0, 520], [0.2, 720], [0.6, 600], [1, 430]], v: [[0, 400, 2200], [0.3, 950, 1700], [0.7, 800, 1300], [1, 420, 850]] }], { vib: 5.5, vibCents: 8, level: 0.3, breath: 0.08 });
      S.play(S.t, end + 0.1);
    },
    purr: loop('purr', 0.5),
    woof(pos) {
      const S = go(pos);
      if (!S) return;
      const end = speak(S, S.t, [{ c: 'b', d: 0.16, f0: [[0, 560], [0.3, 600], [1, 360]], v: [[0, 500, 1300], [0.3, 800, 1500], [1, 500, 1100]] }], { vib: 0.1, vibCents: 0, level: 0.45, breath: 0.25 });
      noisy(S, 'bandpass', 1200, 0.6, 0.2, 0.002, 0.09, S.t);
      S.play(S.t, end + 0.1);
    },
    pant(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t, n = S.noise(), bp = S.filt('bandpass', 1500, 2), g = S.gain();
      n.connect(bp).connect(g).connect(S.out);
      for (let k = 0; k < 7; k++) {
        const a = t + k * 0.15;
        bp.frequency.setValueAtTime(1400, a); perc(g.gain, a, 0.6, 0.01, 0.07);
        bp.frequency.setValueAtTime(2000, a + 0.085); perc(g.gain, a + 0.085, 0.28, 0.01, 0.05);
      }
      S.play(t, t + 1.1);
    },
    door(kind, pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t;
      let end;
      if (kind === 'glass') {
        const n = S.noise(), bp = S.filt('bandpass', 220, 1.2), g = S.gain(), fl = S.osc('sine', 16), fg = S.gain(0.08);
        n.connect(bp).connect(g).connect(S.out);
        fl.connect(fg).connect(g.gain);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.12); g.gain.setValueAtTime(0.3, t + 0.75); g.gain.linearRampToValueAtTime(0, t + 0.9);
        noisy(S, 'highpass', 1200, 0.7, 0.03, 0.2, 0.6, t);
        const th = tone(S, 'sine', 110, 0.35, 0.003, 0.12, t + 0.88);
        th.frequency.setValueAtTime(110, t + 0.88); th.frequency.exponentialRampToValueAtTime(65, t + 0.98);
        noisy(S, 'bandpass', 4500, 8, 0.12, 0.001, 0.09, t + 0.9);
        end = t + 1.1;
      } else if (kind === 'bookcase') {
        creak(S, t, 1.1, 40, 75, [[650, 5], [1400, 7]], 0.22);
        noisy(S, 'lowpass', 140, 0.7, 0.3, 0.3, 0.9, t);
        const th = tone(S, 'sine', 62, 0.7, 0.004, 0.35, t + 1.2);
        th.frequency.setValueAtTime(62, t + 1.2); th.frequency.exponentialRampToValueAtTime(38, t + 1.45);
        noisy(S, 'lowpass', 250, 0.7, 0.4, 0.002, 0.12, t + 1.2);
        end = t + 1.7;
      } else {
        noisy(S, 'bandpass', 3000, 3, 0.35, 0.0005, 0.01, t);
        tone(S, 'sine', 1400, 0.06, 0.0005, 0.02, t);
        creak(S, t + 0.05, 0.5, 80, 130, [[900, 5], [2000, 6]], 0.26);
        end = t + 0.65;
      }
      S.play(t, end);
    },
    kick(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 160, 0.7, 0.002, 0.14, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
      noisy(S, 'bandpass', 900, 1, 0.35, 0.001, 0.05, t);
      const p = tone(S, 'sine', 420, 0.15, 0.001, 0.04, t);
      p.frequency.exponentialRampToValueAtTime(300, t + 0.04);
      S.play(t, t + 0.2);
    },
    hit(pos) {
      const S = go(pos, 0.3);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 1500, 1, 0.35, 0.001, 0.05, t);
      for (const [f, a, d] of [[1250, 0.25, 0.5], [3450, 0.1, 0.28], [6750, 0.05, 0.14]]) tone(S, 'sine', f, a, 0.001, d, t);
      const b = tone(S, 'triangle', 880, 0.1, 0.005, 0.15, t + 0.05);
      b.frequency.setValueAtTime(880, t + 0.05); b.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
      S.play(t, t + 0.6);
    },
    miss(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 120, 0.35, 0.003, 0.12, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
      noisy(S, 'lowpass', 400, 0.7, 0.2, 0.002, 0.06, t);
      chirp(S, t + 0.08, [[0, 420], [0.28, 220]], { type: 'triangle', level: 0.14 });
      S.play(t, t + 0.45);
    },
    achievement(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t;
      [84, 88, 91, 96].forEach((m, k) => bell(S, t + k * 0.09, m, 0.12));
      noisy(S, 'highpass', 8000, 0.7, 0.04, 0.05, 0.5, t + 0.27);
      S.play(t, t + 1.6);
    },
    deploy(pos) {
      const S = go(pos, 0.6);
      if (!S) return;
      const t = S.t, n = S.noise(), bp = S.filt('bandpass', 400, 2), g = S.gain();
      n.connect(bp).connect(g).connect(S.out);
      bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.55); g.gain.linearRampToValueAtTime(0, t + 0.65);
      const timp = S.osc('sine', 98), tg = S.gain();
      timp.connect(tg).connect(S.out);
      for (let k = 0; k < 10; k++) perc(tg.gain, t + k * 0.055, 0.1 + k * 0.03, 0.002, 0.05);
      [[67, 0.6, 0.1], [72, 0.72, 0.1], [76, 0.84, 0.1], [79, 0.96, 0.42]].forEach(([m, a, d]) => brass(S, t + a, m, d, 0.06));
      for (const m of [72, 76, 79, 84]) brass(S, t + 1.45, m, 1.1, 0.05);
      tone(S, 'sine', 65, 0.5, 0.003, 0.5, t + 1.45);
      noisy(S, 'bandpass', 1800, 0.7, 0.25, 0.002, 0.4, t + 1.45);
      noisy(S, 'highpass', 5000, 0.7, 0.1, 0.003, 1.0, t + 1.45);
      [96, 100, 103].forEach((m, k) => bell(S, t + 1.5 + k * 0.07, m, 0.05, 0.8));
      S.play(t, t + 3);
    },
    click(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 1800, 0.12, 0.001, 0.02, t);
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.015);
      noisy(S, 'highpass', 3000, 0.7, 0.05, 0.0005, 0.005, t);
      S.play(t, t + 0.05);
    },
    blip(pos) {
      const S = go(pos, 0.3);
      if (!S) return;
      const t = S.t;
      for (const [d, f, a] of [[0, 900, 0.12], [0.09, 1350, 0.05]]) {
        const o = S.at(tone(S, 'sine', f, a, 0.003, 0.1, t + d), t + d, t + d + 0.12), m = S.at(S.osc('sine', 220), t + d, t + d + 0.12), mg = S.gain(300);
        m.connect(mg).connect(o.frequency);
        o.frequency.setValueAtTime(f, t + d); o.frequency.exponentialRampToValueAtTime(f * 2, t + d + 0.08);
      }
      S.play(t, t + 0.25);
    },
    printer: loop('printer', 0.35),
    pour(pos) {
      const S = go(pos);
      if (!S) return;
      const t = S.t, n = S.noise(), bp = S.filt('bandpass', 450, 4), g = S.gain();
      n.connect(bp).connect(g).connect(S.out);
      bp.frequency.setValueAtTime(450, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 2.4);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.15); g.gain.setValueAtTime(0.35, t + 2.3); g.gain.linearRampToValueAtTime(0, t + 2.6);
      noisy(S, 'lowpass', 2500, 0.7, 0.15, 0.005, 0.25, t);
      const b = S.osc('sine', 600), bg = S.gain();
      b.connect(bg).connect(S.out);
      for (let x = 0.2; x < 2.4; x += 0.06 + Math.random() * 0.1) {
        const f = 600 + 1400 * (x / 2.4) * (0.7 + Math.random() * 0.3);
        b.frequency.setValueAtTime(f, t + x); b.frequency.exponentialRampToValueAtTime(f * 1.6, t + x + 0.03);
        perc(bg.gain, t + x, 0.04 + Math.random() * 0.04, 0.002, 0.03);
      }
      S.play(t, t + 2.7);
    },
  };
}
