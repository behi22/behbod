// Streamed, since six minutes decoded up front would take over 100 MB on a phone; through the house's sound, so Sound off silences it.
export const RUN_MUSIC = 'assets/range/music/run.mp3';
// The file is at his song's loudness (-13.1 LUFS); this puts it at -14.9 at the speakers, where the records sit (-12.1 to -16.4).
export const LEVEL = 0.9;

export function makeRunMusic(env) {
  let el = null, gain = null, on = false, timer = 0, failed = false;
  function ready() {
    const e = env.eng();
    if (!e) return null;
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      el.loop = true;
      el.src = RUN_MUSIC;
      // A file that cannot be had must not leave the house's records faded for nothing.
      el.addEventListener('error', () => { failed = true; env.duck('run', 1, 1); });
      gain = e.ctx.createGain();
      gain.gain.value = 0;
      e.ctx.createMediaElementSource(el).connect(gain).connect(e.out);
    }
    return e;
  }
  function ramp(to, secs) {
    const e = env.eng(), g = gain.gain, t = e.ctx.currentTime;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.linearRampToValueAtTime(to, t + secs);
  }
  return {
    prepare() { ready(); },
    // Called from the click that starts a run: that click is what lets a phone play it.
    play(secs = 0.6) {
      if (!ready() || failed) return false;
      clearTimeout(timer);
      if (!on) env.duck('run', 0, 1.2);
      on = true;
      ramp(LEVEL, secs);
      el.play()?.catch?.(() => {});
      return true;
    },
    // Stops where it is, so the next run carries on from there; the records come back only once it is quiet.
    stop(secs = 1.4) {
      if (!on) return;
      on = false;
      ramp(0, secs);
      clearTimeout(timer);
      timer = setTimeout(() => { if (on) return; el.pause(); env.duck('run', 1, 3); }, secs * 1000 + 60);
    },
    get on() { return on; },
    get paused() { return !el || el.paused; },
    get time() { return el ? el.currentTime : 0; },
    get level() { return gain ? gain.gain.value : 0; },
  };
}
