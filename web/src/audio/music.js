import { RECORDS, generateRecord } from './pure/records.js';
import { stats, shot, perc, ahead } from './core.js';
import * as D from './drums.js';
import * as Y from './synths.js';

const PLAY = { lkick: D.lkick, lsnare: D.lsnare, lhat: D.lhat, rim: D.rim, skick: D.skick, gsnare: D.gsnare, shat: D.shat, sohat: D.sohat, tom: D.tom, bak: D.bak, tik: D.tik, rhodes: Y.rhodes, keys: Y.keys, lbass: Y.lbass, sbass: Y.sbass, pad: Y.pad, arp: Y.arp, lead: Y.lead, santur: Y.santur, drone: Y.drone, piano: Y.piano };
const FX = {
  'night-shift': { gain: 0.8, reverb: 0.16, crackle: 0.5, lofi: true },
  'lions-gate': { gain: 0.7, reverb: 0.28, crackle: 0.12, delay: 0.75 },
  dastgah: { gain: 1.5, reverb: 0.34, crackle: 0.14 },
  'rain-piano': { gain: 2, reverb: 0.4, crackle: 0.16 },
};

const seqs = new Map();
export const sequence = id => {
  if (!seqs.has(id)) seqs.set(id, generateRecord(id));
  return seqs.get(id);
};

// The per-record chain: instruments feed `in`, everything leaves through `fade` so a crossfade moves it all.
export function chain(e, id, t0, { crackle = true } = {}) {
  const ctx = e.ctx, fx = FX[id], seq = sequence(id), nodes = [], srcs = [];
  const n = x => (nodes.push(x), x);
  const fade = n(ctx.createGain());
  fade.gain.value = 0;
  fade.connect(e.musicIn);
  const send = n(ctx.createGain());
  send.gain.value = fx.reverb;
  fade.connect(send).connect(e.reverbIn);
  let input = fade, delay = null;
  if (fx.lofi) {
    const lp = n(ctx.createBiquadFilter());
    lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.3;
    // A slowly wobbling delay bends the pitch of everything a little, like a worn tape or record.
    const wow = n(ctx.createDelay(0.05)), lfo = ctx.createOscillator(), depth = n(ctx.createGain());
    wow.delayTime.value = 0.012; lfo.frequency.value = 0.55; depth.gain.value = 0.0009;
    lfo.connect(depth).connect(wow.delayTime);
    nodes.push(lfo); srcs.push(lfo);
    lp.connect(wow).connect(fade);
    input = lp;
  }
  if (fx.delay) {
    const dl = n(ctx.createDelay(2)), fb = n(ctx.createGain()), damp = n(ctx.createBiquadFilter()), wet = n(ctx.createGain());
    dl.delayTime.value = seq.beatDur * fx.delay; fb.gain.value = 0.38; damp.type = 'lowpass'; damp.frequency.value = 2500; wet.gain.value = 0.3;
    dl.connect(damp).connect(fb).connect(dl);
    damp.connect(wet).connect(fade);
    delay = dl;
  }
  const cr = ctx.createBufferSource(), cg = n(ctx.createGain());
  cr.buffer = e.texture('crackle'); cr.loop = true; cg.gain.value = crackle ? fx.crackle : 0;
  cr.connect(cg).connect(fade);
  nodes.push(cr); srcs.push(cr);
  for (const s of srcs) s.start(t0);
  return {
    in: input, delay, fade, gain: fx.gain,
    kill() {
      for (const s of srcs) try { s.stop(); } catch { /* not started */ }
      for (const x of nodes) x.disconnect();
    },
  };
}

export function needle(e, t, lift = false) {
  const S = shot(e, e.musicIn);
  const o = S.osc('sine', lift ? 90 : 55), g = S.gain();
  o.connect(g).connect(S.out);
  perc(g.gain, t, lift ? 0.08 : 0.35, 0.002, lift ? 0.05 : 0.16);
  const c = S.buffer(e.texture('crackle'), true), cg = S.gain(), hp = S.filt('highpass', 900);
  c.connect(hp).connect(cg).connect(S.out);
  cg.gain.setValueAtTime(0, t);
  cg.gain.linearRampToValueAtTime(lift ? 0.4 : 1.2, t + 0.01);
  cg.gain.setTargetAtTime(0, t + 0.08, lift ? 0.05 : 0.18);
  S.play(t, t + (lift ? 0.3 : 0.9));
}

// For an OfflineAudioContext: call window(from, to) from suspend points, the way the live clock schedules ahead.
export function offlineRecord(e, id, opts) {
  const seq = sequence(id), P = chain(e, id, 0, opts);
  P.fade.gain.value = P.gain;
  return {
    seq,
    window(from, to) {
      for (let base = Math.floor(from / seq.duration) * seq.duration; base < to; base += seq.duration) {
        for (const ev of seq.events) { const t = base + ev.t; if (t >= to) break; if (t >= from) PLAY[ev.i](e, P, t, ev); }
      }
    },
  };
}

export function makeMusic(env) {
  const listeners = new Set();
  let current = null, lvl = 0, lastT = 0, buf = null;

  function retire(p, now, secs) {
    const g = p.P.fade.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    g.linearRampToValueAtTime(0, now + secs);
    p.stopAt = now + secs;
    p.endAt = now + secs + 0.2;
  }

  function makePlayer(e, id) {
    const seq = sequence(id), now = e.ctx.currentTime, start = now + 0.5;
    const P = chain(e, id, now + 0.05);
    P.fade.gain.setValueAtTime(0, now);
    P.fade.gain.linearRampToValueAtTime(P.gain, start + 1.2);
    stats.players++;
    const p = {
      id, seq, P, start, loopStart: start, idx: 0, beat: 0, stopAt: Infinity, endAt: Infinity, dead: false,
      kill() { if (p.dead) return; p.dead = true; P.kill(); stats.players--; },
      pump() {
        const now = e.ctx.currentTime;
        if (now >= p.endAt) { p.kill(); return false; }
        const evs = seq.events, horizon = now + ahead();
        if (now - p.loopStart > seq.duration) { p.loopStart += Math.floor((now - p.loopStart) / seq.duration) * seq.duration; p.idx = 0; }
        for (let guard = 0; guard < 4000; guard++) {
          const ev = evs[p.idx], t = p.loopStart + ev.t;
          if (t > horizon || t >= p.stopAt) break;
          if (t >= now - 0.03 && env.sound.on) PLAY[ev.i](e, P, Math.max(t, now), ev);
          if (++p.idx >= evs.length) { p.idx = 0; p.loopStart += seq.duration; }
        }
        if (p === current) {
          const bd = seq.beatDur, total = seq.bars * seq.beatsPerBar;
          if (now - (p.start + p.beat * bd) > 0.25) p.beat = Math.max(p.beat, Math.ceil((now - p.start) / bd));
          while (p.start + p.beat * bd <= now) {
            const k = p.beat % total, info = { record: id, beat: k % seq.beatsPerBar, bar: Math.floor(k / seq.beatsPerBar), strength: k % seq.beatsPerBar ? 0.6 : 1, time: p.start + p.beat * bd };
            p.beat++;
            for (const fn of listeners) try { fn(info); } catch (err) { console.error(err); }
          }
        }
        return true;
      },
    };
    return p;
  }

  return {
    records: RECORDS.map(({ id, title, mood }) => ({ id, title, mood })),
    get current() { return current ? current.id : null; },
    play(id) {
      const e = env.eng();
      if (!e || !FX[id]) return false;
      if (current && current.id === id) return true;
      const now = e.ctx.currentTime;
      if (current) retire(current, now, 2.2);
      if (env.sound.on) needle(e, now);
      current = makePlayer(e, id);
      env.clock.add(current);
      return true;
    },
    stop() {
      const e = env.eng();
      if (!e || !current) return;
      const now = e.ctx.currentTime;
      retire(current, now, 1.2);
      if (env.sound.on) needle(e, now, true);
      current = null;
    },
    level() {
      const e = env.eng();
      if (!e) return 0;
      const a = e.analyser;
      if (!buf) buf = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const db = 10 * Math.log10(s / buf.length + 1e-12), target = Math.max(0, Math.min(1, (db + 40) / 32));
      const t = performance.now(), dt = lastT ? Math.min(0.5, (t - lastT) / 1000) : 0.016;
      lastT = t;
      lvl += (target - lvl) * (1 - Math.exp(-dt / (target > lvl ? 0.04 : 0.25)));
      return lvl;
    },
    onBeat(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
