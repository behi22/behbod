import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homography, apply, insetToEdges } from '../../web/src/pure/homography.js';
import { seatView, onView } from '../../web/src/pure/seatview.js';

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

// The seated monitor on the page at each desktop shape: its corners, as desktop.js lays the layer, and its curved top
// and bottom edges, in pixels.
const S = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url))).screens.main;
function monitorOnPage(width, height) {
  const a = width / height, v = seatView(S, a), half = S.w / 2 / S.r, chord = S.r * Math.sin(half), sag = S.r * (1 - Math.cos(half));
  const px = p => { const q = onView(p, v, a); return [q.x * width, q.y * height]; };
  const edge = (y, n) => Array.from({ length: n + 1 }, (_, i) => { const t = -half + 2 * half * i / n; return px([-S.r * (1 - Math.cos(t)), y * S.h / 2, S.r * Math.sin(t)]); });
  return { corners: [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([z, y]) => px([-sag, y * S.h / 2, z * chord])), edge };
}
const yOn = (a, b, x) => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);

test('seated, the desktop layer stays inside the curved screen, so the frame shows evenly on all four sides', () => {
  for (const [width, height] of [[1600, 900], [1440, 900], [1200, 900], [2100, 900]]) {
    const m = monitorOnPage(width, height), [tl, tr, br, bl] = m.corners, top = m.edge(1, 64), bottom = m.edge(-1, 64);
    // Laid through the corners as it was, the layer stood over the frame in the middle of the top and bottom edges.
    const was = Math.max(...top.map(q => q[1] - yOn(tl, tr, q[0]))), wasLow = Math.max(...bottom.map(q => yOn(bl, br, q[0]) - q[1]));
    assert.ok(was > height * 0.01 && wasLow > height * 0.01, `${width}x${height}: the old layer over the frame by ${was.toFixed(1)} and ${wasLow.toFixed(1)} px`);
    const [a, b, c, d] = insetToEdges(m.corners, m.edge(1, 16), m.edge(-1, 16));
    const over = Math.max(...top.map(q => q[1] - yOn(a, b, q[0]))), overLow = Math.max(...bottom.map(q => yOn(d, c, q[0]) - q[1]));
    assert.ok(over < 0.5 && overLow < 0.5, `${width}x${height}: still over the frame by ${over.toFixed(2)} and ${overLow.toFixed(2)} px`);
    // No further in than that: it meets the screen's edge in the middle, and its sides stay on the screen's sides.
    assert.ok(over > -1 && overLow > -1, `${width}x${height}: pulled in too far, ${over.toFixed(2)} and ${overLow.toFixed(2)} px`);
    for (const [p, e0, e1] of [[a, tl, bl], [d, tl, bl], [b, tr, br], [c, tr, br]]) {
      const cross = (e1[0] - e0[0]) * (p[1] - e0[1]) - (e1[1] - e0[1]) * (p[0] - e0[0]);
      assert.ok(Math.abs(cross) / Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) < 1e-6, `${width}x${height}: a corner left the screen's side`);
    }
    assert.ok((d[1] - a[1]) / (bl[1] - tl[1]) > 0.9, `${width}x${height}: the layer keeps ${(((d[1] - a[1]) / (bl[1] - tl[1])) * 100).toFixed(1)}% of the screen's height at its sides`);
  }
});
