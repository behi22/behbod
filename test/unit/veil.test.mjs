import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veilRadius, mirrorImage } from '../../web/src/pure/veil.js';

// A mirror 0.8 wide and 1.8 tall on the wall z = 0, facing +z, its middle 1.5 up.
const M = { p: [0, 1.5, 0], n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: 0.8, h: 1.8 };
const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

test('the veil covers the head at any distance: half as wide twice as far, wider with a narrower view', () => {
  const r = veilRadius(0.16, 2, 55);
  assert.ok(Math.abs(veilRadius(0.16, 4, 55) - r / 2) < 1e-12);
  assert.ok(veilRadius(0.16, 2, 40) > r);
  // Seen from 1 m with a 90 degree view, a 0.5 m head fills the picture's half height.
  assert.ok(Math.abs(veilRadius(0.5, 1, 90) - 0.25) < 1e-12);
  assert.equal(veilRadius(0.16, 0, 55), 0);
});

test('standing in front of the mirror, the head shows behind the glass as far back as it stands in front', () => {
  const img = mirrorImage([0.1, 1.6, 0.7], [0.3, 1.7, 2.5], M);
  assert.ok(near(img, [0.1, 1.6, -0.7]));
});

test('no image when the head or the eye is behind the mirror, or level with the glass', () => {
  assert.equal(mirrorImage([0, 1.6, -0.5], [0, 1.6, 2], M), null);
  assert.equal(mirrorImage([0, 1.6, 0.5], [0, 1.6, -2], M), null);
  assert.equal(mirrorImage([0, 1.6, 0], [0, 1.6, 2], M), null);
});

test('no image when the eye looks past the side of the glass, unless within the margin', () => {
  // The eye far off to the side: its line to the image crosses the wall 0.9 m from the middle.
  const head = [0.2, 1.6, 1], eye = [3.0, 1.6, 3];
  assert.equal(mirrorImage(head, eye, M), null);
  assert.ok(near(mirrorImage(head, eye, M, 0.55), [0.2, 1.6, -1]));
  // Above the glass: a head 2.8 m up seen level crosses the wall above its top edge at 2.4.
  assert.equal(mirrorImage([0, 2.8, 1], [0, 2.8, 3], M), null);
});

test('a mirror turned to face along x reflects across its own plane', () => {
  const side = { p: [5, 1.5, 2], n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], w: 0.8, h: 1.8 };
  assert.ok(near(mirrorImage([4.4, 1.6, 2.1], [3, 1.7, 2.3], side), [5.6, 1.6, 2.1]));
});
