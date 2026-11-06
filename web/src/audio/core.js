import { reverbIR, TEXTURES } from './pure/textures.js';
import { makeRng } from './pure/rng.js';

// Live counts, so a dev page can prove nothing piles up over a long session.
export const stats = { shots: 0, players: 0, loops: 0, songs: 0, clock: 0 };

const toBuffer = (ctx, chans) => {
  const b = ctx.createBuffer(chans.length, chans[0].length, ctx.sampleRate);
  chans.forEach((a, i) => b.copyToChannel(a, i));
  return b;
};

export function makeEngine(ctx, dest) {
  const gain = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const comp = (th, ratio) => {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = th; c.knee.value = 6; c.ratio.value = ratio; c.attack.value = 0.003; c.release.value = 0.2;
    return c;
  };
  const sr = ctx.sampleRate, r = makeRng('noise');
  const noiseData = new Float32Array(sr * 2);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = r.next() * 2 - 1;
  const out = gain(1);
  out.connect(dest);
  const reverb = ctx.createConvolver();
  reverb.buffer = toBuffer(ctx, reverbIR(sr));
  const reverbIn = gain(1), reverbOut = gain(0.6);
  reverbIn.connect(reverb).connect(reverbOut).connect(out);
  const musicIn = gain(1), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  musicIn.connect(comp(-12, 6)).connect(analyser).connect(out);
  // The piano sounds from where the piano stands, so a song left playing fades as you walk away.
  const pianoIn = gain(1), pianoSend = gain(0.22), pianoPan = ctx.createPanner();
  Object.assign(pianoPan, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 2.5, maxDistance: 40, rolloffFactor: 0.9 });
  pianoIn.connect(comp(-10, 4)).connect(pianoPan).connect(out);
  pianoIn.connect(pianoSend).connect(reverbIn);
  const sfxIn = gain(1), sfxSend = gain(0.25);
  sfxIn.connect(out);
  sfxSend.connect(reverbIn);
  const ambIn = gain(1);
  ambIn.connect(out);
  const cache = new Map();
  return {
    ctx, out, reverbIn, musicIn, analyser, pianoIn, pianoPan, sfxIn, sfxSend, ambIn,
    noise: toBuffer(ctx, [noiseData]),
    waves: new Map(),
    texture(name) {
      if (!cache.has(name)) cache.set(name, toBuffer(ctx, TEXTURES[name](sr)));
      return cache.get(name);
    },
  };
}

export function vec(p) {
  if (!p) return null;
  if (Array.isArray(p)) return { x: +p[0] || 0, y: +p[1] || 0, z: +p[2] || 0 };
  if (typeof p === 'object') return { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 };
  return null;
}

export function setPos(p, pos) {
  const v = vec(pos);
  if (!v) return;
  if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; }
  else p.setPosition(v.x, v.y, v.z);
}

export function makePanner(ctx, pos) {
  const p = ctx.createPanner();
  p.panningModel = 'equalpower';
  p.distanceModel = 'inverse';
  p.refDistance = 1.2; p.maxDistance = 40; p.rolloffFactor = 1.1;
  setPos(p, pos);
  return p;
}

// One sound's nodes: they all disconnect together when its last source ends.
export function shot(e, dest, pos) {
  const ctx = e.ctx, nodes = [], srcs = [];
  let live = 0, done = false;
  stats.shots++;
  const end = () => {
    if (--live > 0 || done) return;
    done = true;
    stats.shots--;
    for (const n of nodes) n.disconnect();
    if (S.onDone) S.onDone();
  };
  const S = {
    ctx, out: dest, onDone: null,
    node(n) { nodes.push(n); return n; },
    src(n) { nodes.push(n); srcs.push(n); live++; n.onended = end; return n; },
    gain(v = 0) { const n = ctx.createGain(); n.gain.value = v; return S.node(n); },
    filt(type, f, q = 0.7) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return S.node(n); },
    osc(type, f) { const o = ctx.createOscillator(); if (type) o.type = type; o.frequency.value = f; return S.src(o); },
    noise(buf = e.noise) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s._off = Math.random() * buf.duration * 0.9; return S.src(s); },
    buffer(buf, loop = false) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return S.src(s); },
    at(n, t0, t1) { n._t0 = t0; n._t1 = t1; return n; },
    play(t0, t1) {
      for (const s of srcs) {
        if (s._on) continue;
        s._on = true;
        s.start(s._t0 ?? t0, s._off || 0);
        const end1 = s._t1 ?? t1;
        if (end1 !== undefined) s.stop(end1);
      }
      return S;
    },
    stop(t) { for (const s of srcs) if (s._on) try { s.stop(t); } catch { /* already ended */ } },
  };
  if (pos) { S.out = S.node(makePanner(ctx, pos)); S.out.connect(dest); }
  return S;
}

export function perc(param, t, peak, attack, decay) {
  const p = Math.max(peak, 1e-5);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(p, t + attack);
  param.exponentialRampToValueAtTime(p * 1e-4, t + attack + decay);
}

export function glide(param, t, pts) {
  param.setValueAtTime(pts[0][1], t + pts[0][0]);
  for (let i = 1; i < pts.length; i++) param.exponentialRampToValueAtTime(pts[i][1], t + pts[i][0]);
}

export const ahead = () => (typeof document !== 'undefined' && document.hidden ? 1.5 : 0.3);

// One interval for everything that schedules ahead, alive only while something is playing.
export function makeClock() {
  const jobs = new Set();
  let id = 0;
  const run = () => {
    for (const j of jobs) {
      let keep = false;
      try { keep = j.pump() !== false; } catch (err) { console.error(err); if (j.kill) j.kill(); }
      if (!keep) jobs.delete(j);
    }
    if (!jobs.size && id) { clearInterval(id); id = 0; stats.clock = 0; }
  };
  return {
    run,
    add(j) { jobs.add(j); if (!id) { id = setInterval(run, 50); stats.clock = 1; } },
    remove(j) { jobs.delete(j); },
  };
}
