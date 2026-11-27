import test from 'node:test';
import assert from 'node:assert/strict';
import { homography, apply } from '../../web/src/pure/homography.js';

const near = (a, b, msg) => { assert.ok(Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6, `${msg}: ${a} vs ${b}`); };

test('the four corners land exactly where they are sent', () => {
  const dst = [[120, 80], [1500, 95], [1480, 690], [140, 660]];
  const m = homography(1536, 646, dst);
  near(apply(m, 0, 0), dst[0], 'top left');
  near(apply(m, 1536, 0), dst[1], 'top right');
  near(apply(m, 1536, 646), dst[2], 'bottom right');
  near(apply(m, 0, 646), dst[3], 'bottom left');
});

test('a plain rectangle gives a plain scale and shift', () => {
  const m = homography(100, 50, [[10, 20], [210, 20], [210, 120], [10, 120]]);
  near(apply(m, 50, 25), [110, 70], 'centre');
  assert.ok(Math.abs(m[3]) < 1e-9 && Math.abs(m[7]) < 1e-9, 'no perspective term');
});

test('corners squashed onto a line give no map instead of nonsense', () => {
  assert.equal(homography(100, 50, [[0, 0], [10, 0], [20, 0], [30, 0]]), null);
});
