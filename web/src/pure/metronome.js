// The metronome on the piano. Times are seconds on one clock (the sound's own, so the ticks and the arm agree).

// The marks on a real Maelzel metronome's scale, slowest to fastest.
export const MARKS = [40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120,
  126, 132, 138, 144, 152, 160, 168, 176, 184, 192, 200, 208];
export const START_BPM = 96;
export const SWING = 0.42;

// The nearest mark, so a tempo kept from another visit or typed in still lands on the scale.
export function onScale(bpm) {
  const b = Number(bpm);
  if (!Number.isFinite(b)) return START_BPM;
  return MARKS.reduce((best, m) => (Math.abs(m - b) < Math.abs(best - b) ? m : best), MARKS[0]);
}

// One mark faster (dir 1) or slower (dir -1), stopping at the ends of the scale.
export function step(bpm, dir) {
  const i = MARKS.indexOf(onScale(bpm));
  return MARKS[Math.max(0, Math.min(MARKS.length - 1, i + Math.sign(dir)))];
}

// Beats since `t0`. The arm leaves the middle at t0, so it starts from rest without a jump.
export const phase = (t, t0, bpm) => ((t - t0) * bpm) / 60;

// A tick each time the arm reaches the end of its swing: half a beat after the start, then once a beat.
export function ticks(from, to, t0, bpm) {
  const out = [];
  const beat = 60 / bpm;
  for (let n = Math.max(0, Math.ceil(phase(from, t0, bpm) - 0.5 - 1e-9)); ; n++) {
    const at = t0 + (n + 0.5) * beat;
    if (at >= to) break;
    if (at >= from) out.push(at);
  }
  return out;
}

export function armAngle(t, t0, bpm, amp = SWING) {
  if (t <= t0) return 0;
  return amp * Math.sin(Math.PI * phase(t, t0, bpm));
}

// A new tempo keeps the arm where it is in its swing: the start moves so the beat count carries on unbroken.
export function retime(t, t0, oldBpm, newBpm) {
  return t - (Math.max(0, phase(t, t0, oldBpm)) * 60) / newBpm;
}

// Where the sliding weight sits on the arm, 0 at the pivot to 1 at the tip: high and slow, low and fast, like the real one.
export function weightAt(bpm) {
  const lo = Math.log(MARKS[0]), hi = Math.log(MARKS[MARKS.length - 1]);
  const k = (Math.log(onScale(bpm)) - lo) / (hi - lo);
  return 0.9 - 0.62 * k;
}
