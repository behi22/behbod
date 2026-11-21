import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteName } from '../../web/src/pianomode.js';
import { warmth, glowColour, GLOW, HOLD } from '../../web/src/pure/warmth.js';

test('the note names on the keys: letters, sharps on the black keys, and the octave on each C', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(48), 'C3');
  assert.equal(noteName(84), 'C6');
  assert.equal(noteName(61), 'C♯');
  assert.equal(noteName(64), 'E');
  assert.equal(noteName(70), 'A♯');
  assert.equal(noteName(71), 'B');
});

test('the piano lamp warms quickly, cools slowly, and settles back to exactly nothing', () => {
  let k = 0, t = 0;
  while (k < 0.9) { k = warmth(k, true, 1 / 60); t += 1 / 60; }
  assert.ok(t < 1.5, `warm in ${t.toFixed(2)} s`);
  while (k < 1) k = warmth(k, true, 1 / 60);
  assert.equal(k, 1);
  let up = 0;
  while (k > 0.1) { k = warmth(k, false, 1 / 60); up += 1 / 60; }
  assert.ok(up > 3, `cools over ${up.toFixed(2)} s`);
  while (k > 0) k = warmth(k, false, 1 / 60);
  assert.equal(k, 0);
  // A long frame never overshoots.
  assert.equal(warmth(0.5, true, 10), 1);
  assert.equal(warmth(0.5, false, 10), 0);
  assert.ok(HOLD >= 1);
  // Nothing at rest, deep amber at full warmth, in between in proportion.
  assert.deepEqual(glowColour(0), [0, 0, 0]);
  assert.deepEqual(glowColour(1), GLOW);
  assert.deepEqual(glowColour(0.5), GLOW.map(v => v / 2));
  // Warmer than the lamp's own light (more red against green and blue), and not so bright it outshines the room.
  const own = [1.0, 0.62, 0.3];
  assert.ok(GLOW[0] > GLOW[1] && GLOW[1] > GLOW[2]);
  assert.ok(GLOW[1] / GLOW[0] < own[1] / own[0] && GLOW[2] / GLOW[0] < own[2] / own[0]);
  assert.ok(Math.max(...GLOW) <= 2);
});
