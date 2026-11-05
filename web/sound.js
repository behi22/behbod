// Every sound is synthesised here, so the slice ships no audio files.
export class Sound {
  constructor() { this.ctx = null; this.on = false; this.lastPhase = 0; }
  start() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
    this.noise = buf;
    const tone = ctx.createBufferSource();
    tone.buffer = buf; tone.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = 0.05;
    tone.connect(lp).connect(g).connect(this.master);
    tone.start();
    const fan = ctx.createOscillator(); fan.frequency.value = 118;
    const fg = ctx.createGain(); fg.gain.value = 0.006;
    fan.connect(fg).connect(this.master); fan.start();
    this.on = true;
  }
  toggle() {
    if (!this.ctx) { this.start(); return this.on; }
    this.on = !this.on;
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    return this.on;
  }
  burst(freq, q, dur, gain, delay = 0) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // A pitched blip that glides from one note to another: chirps, barks, purrs and squeaks.
  tone(from, to, dur, gain, delay = 0, type = 'sine') {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  stepTick(action, speed) {
    if (!action) return;
    const clip = action.getClip(), ph = (action.time / clip.duration) % 1;
    for (const at of [0.08, 0.58]) if ((this.lastPhase < at && ph >= at) || (this.lastPhase > ph && ph >= at)) this.burst(260 + Math.random() * 120, 1.2, 0.09, Math.min(0.5, 0.18 + speed * 0.05));
    this.lastPhase = ph;
  }
  jump() { this.burst(500, 0.8, 0.07, 0.15); }
  land() { this.burst(180, 1.0, 0.16, 0.5); }
  chair() { this.burst(900, 4, 0.2, 0.08); this.burst(300, 1, 0.12, 0.2, 0.05); }
  key() { this.burst(2400, 6, 0.03, 0.05); }
}
