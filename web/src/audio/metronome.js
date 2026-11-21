import { shot, ahead } from './core.js';
import { noisy, tone } from './drums.js';
import { ticks } from '../pure/metronome.js';

// The metronome's tick: a small, soft wooden click from the metronome itself, scheduled on the sound's own clock.
export const TICK = { click: 0.07, ping: 0.012 };

export function tickAt(e, dest, t, pos) {
  const S = shot(e, dest, pos);
  noisy(S, 'bandpass', 3100, 3.5, TICK.click, 0.0006, 0.016, t);
  tone(S, 'sine', 1850, TICK.ping, 0.0008, 0.028, t);
  S.play(t, t + 0.06);
  return S;
}

export function makeMetronomeSound(env) {
  let job = null, pos = null;
  const queued = [];
  // Ticks already handed to the sound card but not yet heard are taken back on a stop or a new tempo.
  function hush(e) {
    const now = e.ctx.currentTime;
    for (const q of queued) if (q.t > now) q.S.stop(now);
    queued.length = 0;
  }
  function stop() {
    if (!job) return;
    const e = env.eng();
    env.clock.remove(job);
    job = null;
    if (e) hush(e);
  }
  return {
    setPosition(p) { pos = p; },
    get running() { return !!job; },
    // The ticks handed to the sound card and not yet heard, on its clock.
    get scheduled() { return queued.map(q => q.t); },
    // `beat()` gives the current { t0, bpm } on the sound's clock.
    start(beat) {
      stop();
      const e = env.eng();
      if (!e) return false;
      let until = e.ctx.currentTime;
      const me = job = {
        pump() {
          if (job !== me) return false;
          const now = e.ctx.currentTime, horizon = now + ahead(), { t0, bpm } = beat();
          for (const t of ticks(Math.max(until, now), horizon, t0, bpm)) if (env.sound.on) queued.push({ t, S: tickAt(e, e.sfxIn, t, pos) });
          until = horizon;
          while (queued.length && queued[0].t < now - 0.1) queued.shift();
          return true;
        },
        kill() { if (job === me) job = null; },
      };
      env.clock.add(job);
      me.pump();
      return true;
    },
    // The tempo changed: forget what was scheduled ahead and schedule again from now.
    retime(beat) { if (job) this.start(beat); },
    stop,
  };
}
