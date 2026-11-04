import { stats } from './core.js';

const SPEC = { rain: 0.55, fire: 0.6, city: 0.25, waves: 0.75, wind: 0.45 };

// Levels are settings, so a level set before sound starts is kept and applied on the first tick after.
export function makeAmbience(env) {
  const want = {}, live = {}, pending = new Set();

  function apply(e, name) {
    const lv = want[name] || 0, ctx = e.ctx, now = ctx.currentTime;
    let a = live[name];
    if (lv <= 0.001) {
      if (a) { a.g.gain.setTargetAtTime(0, now, 0.35); a.src.stop(now + 1.6); delete live[name]; }
      return;
    }
    if (!a) {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = e.texture(name); src.loop = true;
      g.gain.value = 0;
      src.connect(g).connect(e.ambIn);
      src.start(now, Math.random() * src.buffer.duration);
      stats.loops++;
      src.onended = () => { src.disconnect(); g.disconnect(); stats.loops--; };
      a = live[name] = { src, g };
    }
    a.g.gain.setTargetAtTime(lv * SPEC[name], now, 0.4);
  }

  return {
    set(name, level) {
      if (!(name in SPEC)) return;
      want[name] = Math.max(0, Math.min(1, +level || 0));
      const e = env.eng();
      if (e) apply(e, name); else pending.add(name);
    },
    sync() {
      if (!pending.size) return;
      const e = env.eng();
      if (!e) return;
      for (const n of pending) apply(e, n);
      pending.clear();
    },
  };
}
