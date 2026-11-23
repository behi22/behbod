import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVE, TURN, SETTLE, CAP, lastMoved, waits } from '../../web/src/pure/still.js';
import { ratioOf } from '../../web/src/pure/tier.js';

// Frames run as the page runs them: each notes whether the view moved, and the change, asked for on the first frame
// at or after `at` ms, lands once it no longer waits. `view(t)` is the camera at t ms: [metres along its way, radians
// turned, its field of view in degrees (the normal 55 if left out)]. Returns the frame it lands on and the one it was
// asked on (ms), or null if it never lands.
const NORMAL = 55, AS_EVER = { fov: NORMAL, was: NORMAL, normal: NORMAL };
function land(view, { to = 'high', from = 'ultra', dpr = 2, at = 500, fps = 60, until = 10000 } = {}) {
  const step = 1000 / fps;
  let moved = 0, asked = null, [p, a, f = NORMAL] = view(0);
  for (let k = 1; k * step <= until; k++) {
    const t = k * step, [q, b, g = NORMAL] = view(t);
    moved = lastMoved(moved, Math.abs(q - p), Math.abs(b - a), step / 1000, t, { fov: g, was: f, normal: NORMAL });
    [p, a, f] = [q, b, g];
    if (asked === null && t >= at) asked = t;
    if (asked !== null && !waits({ to, at: asked }, t, moved, ratioOf(from, dpr), dpr)) return { t, asked };
  }
  return null;
}
// Turning at `speed` radians a second until `stop` ms, then eased to rest the way the page's camera follows its target
// (a lerp of 7 a second), so its last moves are ever slower ones, not a sudden halt.
const turning = (speed, stop = Infinity) => t => {
  if (t <= stop) return [0, speed * t / 1000];
  return [0, speed * stop / 1000 + speed / 7 * (1 - Math.exp(-7 * (t - stop) / 1000))];
};
const walking = (speed, stop = Infinity) => t => [turning(speed, stop)(t)[1], 0];
const still = () => [0, 0];
const capped = r => r.t - r.asked >= CAP && r.t - r.asked < CAP + 1000 / 60;

test('a switch asked for while the view turns waits until it has been still for a moment', () => {
  const { t } = land(turning(0.6, 1500));
  assert.ok(t >= 1500 + SETTLE && t < 1500 + 1000, `landed at ${t}, the turning stopped at 1500`);
});

test('and the same while walking: it lands once the camera has come to rest', () => {
  const { t } = land(walking(1.5, 2000));
  assert.ok(t >= 2000 + SETTLE && t < 2000 + 1000, `landed at ${t}, the walking stopped at 2000`);
});

test('a view that never stills: the switch lands at the cap', () => {
  assert.ok(capped(land(turning(0.6))));
  assert.ok(capped(land(walking(1.5))));
  // Still only now and then, never for long enough.
  assert.ok(capped(land(t => [0, Math.floor(t / 250) % 2 ? 0 : t / 1000])));
});

test('a still view: the switch lands the frame it is asked for', () => {
  const r = land(still);
  assert.equal(r.t, r.asked);
  const s = land(turning(0.6, 100), { at: 2000, fps: 50 });
  assert.equal(s.t, s.asked);
});

test('a view that moves only a little is still: under 5 cm and 1.5 degrees a second', () => {
  for (const view of [walking(MOVE * 0.9), turning(TURN * 0.9)]) { const r = land(view); assert.equal(r.t, r.asked); }
  assert.ok(capped(land(turning(TURN * 1.2))));
  assert.ok(capped(land(walking(MOVE * 1.2))));
});

test('still is judged by the second, not by the frame: the same moves give the same answer at 30, 60 and 144 frames a second', () => {
  const at60 = land(turning(0.6, 1500)).t;
  for (const fps of [30, 60, 144]) {
    const dt = 1 / fps;
    assert.ok(Math.abs(land(turning(0.6, 1500), { fps }).t - at60) <= 1000 / 30 + 1000 / fps, `${fps} fps`);
    assert.equal(lastMoved(-1, 0, TURN * 0.9 * dt, dt, 7, AS_EVER), -1, `${fps} fps, turning slowly`);
    assert.equal(lastMoved(-1, 0, TURN * 1.1 * dt, dt, 7, AS_EVER), 7, `${fps} fps, turning`);
    assert.equal(lastMoved(-1, MOVE * 1.1 * dt, 0, dt, 7, AS_EVER), 7, `${fps} fps, walking`);
  }
  // One long frame with the camera barely moving is no move.
  assert.equal(lastMoved(-1, MOVE * 0.06 * 0.5, 0, 0.06, 7, AS_EVER), -1);
});

test('a switch that keeps the picture its size is never held', () => {
  // Each tier's sharpness on this screen: ultra and high differ only on screens over 1.5x.
  for (const [dpr, from, to, held] of [
    [2, 'ultra', 'high', true], [2, 'high', 'ultra', true], [2, 'high', 'medium', true], [2, 'medium', 'low', true],
    [1.5, 'ultra', 'high', false], [1.5, 'high', 'medium', true], [1.25, 'high', 'medium', false], [1.25, 'medium', 'low', true],
    [1, 'ultra', 'high', false], [1, 'high', 'medium', false], [1, 'medium', 'low', false]]) {
    const r = land(turning(0.6), { from, to, dpr });
    assert.ok(held ? capped(r) : r.t === r.asked, `${from} to ${to} at ${dpr}x`);
  }
});

test('the hold goes by the pixel ratio drawn now: after a move to a sharper screen, a switch that resizes is held', () => {
  assert.equal(waits({ to: 'high', at: 0 }, 100, 90, ratioOf('ultra', 1), 2), true);
  assert.equal(waits({ to: 'high', at: 0 }, 100, 90, ratioOf('high', 2), 2), false);
});

test('a tier is never drawn sharper than the screen', () => {
  assert.deepEqual(['low', 'medium', 'high', 'ultra'].map(n => ratioOf(n, 3)), [1, 1.25, 1.5, 2]);
  assert.deepEqual(['low', 'medium', 'high', 'ultra'].map(n => ratioOf(n, 1)), [1, 1, 1, 1]);
});

// Through the telescope the view can be a degree or two across, where a pan that is still in the house's 55 degrees
// sweeps the picture; a zoom moves the picture's edges by half the change in its width.
const DEG = Math.PI / 180;
const panning = (degrees, fov) => t => [0, degrees * DEG * t / 1000, fov];

test('a view narrower than normal is still only under a turn limit lowered in proportion', () => {
  const dt = 1 / 60;
  assert.equal(lastMoved(-1, 0, TURN * 2 / NORMAL * 0.9 * dt, dt, 7, { fov: 2, was: 2, normal: NORMAL }), -1);
  assert.equal(lastMoved(-1, 0, TURN * 2 / NORMAL * 1.1 * dt, dt, 7, { fov: 2, was: 2, normal: NORMAL }), 7);
  // Zoomed in to 2 degrees, half a degree a second waits for the cap; the same pan in the normal view lands at once.
  assert.ok(capped(land(panning(0.5, 2))));
  const r = land(panning(0.5, NORMAL));
  assert.equal(r.t, r.asked);
});

test('a normal view or a wider one keeps the turn limit as it was', () => {
  const dt = 1 / 60;
  for (const fov of [NORMAL, 60]) {
    assert.equal(lastMoved(-1, 0, TURN * 0.9 * dt, dt, 7, { fov, was: fov, normal: NORMAL }), -1, `${fov}`);
    assert.equal(lastMoved(-1, 0, TURN * 1.1 * dt, dt, 7, { fov, was: fov, normal: NORMAL }), 7, `${fov}`);
  }
  // A phone's normal view is 60 degrees: there 60 is normal, not wide.
  assert.equal(lastMoved(-1, 0, TURN * 0.9 * dt, dt, 7, { fov: 60, was: 60, normal: 60 }), -1);
});

test("a change in the view's width is movement, as far as it moves the picture's edges", () => {
  const dt = 1 / 60, edge = d => 2 * d / DEG;
  assert.equal(lastMoved(-1, 0, 0, dt, 7, { fov: NORMAL - edge(TURN * dt) * 0.9, was: NORMAL, normal: NORMAL }), -1);
  assert.equal(lastMoved(-1, 0, 0, dt, 7, { fov: NORMAL - edge(TURN * dt) * 1.1, was: NORMAL, normal: NORMAL }), 7);
  // A zoom button held for 2 s (the telescope's 1.7 a second), then let go: it lands once the zoom has stopped.
  const zoom = t => [0, 0, 16 * Math.exp(-1.7 * Math.min(t, 2000) / 1000)];
  const { t } = land(zoom);
  assert.ok(t >= 2000 + SETTLE && t < 2000 + 1000, `landed at ${t}, the zoom stopped at 2000`);
  // A zoom that never stops lands at the cap.
  assert.ok(capped(land(t => [0, 0, 55 * Math.exp(-0.2 * t / 1000)])));
});
