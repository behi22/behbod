import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { astro, makeAstro, vanDate } from '../../web/src/pure/outside.js';
import { GLASS, sunThrough, landing, throughGlass, glassView, midsummer } from '../../web/src/pure/sunbeams.js';

const RAD = Math.PI / 180;
const dir = (az, el) => [Math.sin(az * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), -Math.cos(az * RAD) * Math.cos(el * RAD)];
const sunAt = (y, m, d, h, min) => astro(vanDate(y, m, d, h, min), makeAstro()).sun;
// The minutes of one Vancouver morning when any sun comes through, 03:00 to 13:00.
function morning(y, m, d) {
  let first = null, last = null, top = 0;
  for (let t = 180; t < 780; t++) {
    const k = sunThrough(sunAt(y, m, d, Math.floor(t / 60), t % 60));
    if (k > 0) { first ??= t; last = t; top = Math.max(top, k); }
  }
  return { first, last, top };
}

test('the glass wall is the one in the house: the north wall, floor to ceiling, end to end', () => {
  assert.deepEqual(GLASS, { z: -15.06, x0: 0, x1: 22, y0: 0, y1: 6.5 });
});

test('sun comes through only from the north-east, above the hills, and fades as it grazes the glass', () => {
  assert.equal(sunThrough(dir(60, -2)), 0, 'below the horizon');
  assert.equal(sunThrough(dir(60, 0.5)), 0, 'still behind the hills');
  assert.ok(sunThrough(dir(60, 3)) > 0 && sunThrough(dir(60, 3)) < sunThrough(dir(60, 8)), 'coming up');
  assert.ok(Math.abs(sunThrough(dir(1, 6)) - 1) < 0.02, 'straight on through the glass');
  assert.equal(sunThrough(dir(120, 20)), 0, 'south of east: behind the house');
  assert.equal(sunThrough(dir(300, 20)), 0, 'the evening sun in the north-west is not a morning');
  assert.equal(sunThrough(dir(180, 40)), 0);
  let was = 1;
  for (let az = 30; az < 90; az += 5) { const k = sunThrough(dir(az, 15)); assert.ok(k <= was + 1e-12, `az ${az}`); was = k; }
  assert.ok(sunThrough(dir(89.5, 15)) < 0.02, 'almost along the glass, almost all reflected');
  assert.ok(sunThrough(dir(45, 15)) > 0.9);
});

test('mornings with sun through the glass run from April to mid-September, and none in winter', () => {
  for (const [m, d] of [[11, 21], [12, 21], [1, 15], [2, 20], [3, 15], [9, 25], [10, 10]]) assert.equal(morning(2027, m, d).first, null, `${m}/${d}`);
  const june = morning(2027, 6, 21), april = morning(2027, 4, 15), sept = morning(2027, 9, 10);
  assert.ok(june.first >= 5 * 60 && june.first <= 5 * 60 + 40, `June starts soon after sunrise (${june.first})`);
  assert.ok(june.last - june.first >= 180, `June has three hours or more (${june.last - june.first} min)`);
  assert.ok(june.last < 9 * 60, 'and is over before nine');
  assert.ok(april.last - april.first > 30 && april.last - april.first < june.last - june.first);
  assert.ok(sept.first !== null && sept.last - sept.first < 90);
  assert.ok(june.top > 0.9);
});

test('a beam lands where the sun would put it, and the floor traces back to the same spot on the glass', () => {
  const s = dir(70, 15);
  const p = landing(s, 15, 4, 0);
  assert.ok(p[0] < 15 && p[2] > GLASS.z, 'west of where it came in, inside the room');
  assert.ok(Math.abs(p[1]) < 1e-12);
  const back = throughGlass(s, p);
  assert.ok(Math.abs(back[0] - 15) < 1e-9 && Math.abs(back[1] - 4) < 1e-9);
  const pit = landing(s, 15, 4, -0.45);
  assert.ok(pit[2] > p[2] && pit[0] < p[0], 'the sunken lounge is lit a little further in');
  const low = landing(dir(70, 8), 15, 4, 0), high = landing(dir(70, 25), 15, 4, 0);
  assert.ok(low[2] - GLASS.z > high[2] - GLASS.z, 'a lower sun reaches further into the room');
});

test('the flag\'s midsummer sun is one that comes through', () => {
  const s = midsummer(2027);
  assert.ok(sunThrough(s) > 0.7, String(sunThrough(s)));
  assert.ok(Math.asin(s[1]) / RAD > 10 && Math.asin(s[1]) / RAD < 16, 'low and long');
});

test('the view along the light puts each point at its place on the glass, and orders depth by how far the light came', () => {
  const s = dir(68, 13), d = s.map(v => -v), m = glassView(d, -0.3, 40);
  const ndc = p => [0, 1, 2].map(r => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3]);
  for (const p of [[3, 0, -10], [18, 2.5, -13], [11, 0.4, -6], [0.5, 5, -14.9]]) {
    const g = throughGlass(s, p), [x, y, z] = ndc(p), t = (p[2] - GLASS.z) / d[2];
    assert.ok(Math.abs(x - (2 * (g[0] - GLASS.x0) / (GLASS.x1 - GLASS.x0) - 1)) < 1e-9, `x for ${p}`);
    assert.ok(Math.abs(y - (2 * (g[1] - GLASS.y0) / (GLASS.y1 - GLASS.y0) - 1)) < 1e-9, `y for ${p}`);
    assert.ok(Math.abs(z - (2 * (t + 0.3) / 40.3 - 1)) < 1e-9, `depth for ${p}`);
  }
  const [, , near] = ndc([5, 1, GLASS.z - 0.3 * d[2]]), [, , far] = ndc([5, 1, GLASS.z + 40 * d[2]]);
  assert.ok(Math.abs(near + 1) < 1e-9 && Math.abs(far - 1) < 1e-9, 'near and far land on the ends of depth');
  assert.deepEqual(m.slice(12), [0, 0, 0, 1], 'no perspective: every ray of sunlight is parallel');
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
  assert.ok(det > 0, 'a mirror image of a camera looking into the room, so its front faces are those turned away from the sun');
});

// The low setting draws straight to the screen, and so does a setting moved up from low until its effects are built; a
// program three has not built for the way it draws is built inside that frame.
test('the beams\' shaders are built both ways three draws them, so a change of quality builds none in a frame', () => {
  const src = readFileSync(new URL('../../web/src/sunbeams.js', import.meta.url), 'utf8');
  const build = src.slice(src.indexOf('async function build()'), src.indexOf('function drawReach()'));
  assert.match(build, /\[target, \[\[group, camera, scene\], \[reachScene, eye\]\]\]/, 'into a picture, the beams and the map');
  assert.match(build, /\[null, \[\[group, camera, scene\]\]\]/, 'to the screen, the beams');
  assert.match(build, /renderer\.setRenderTarget\(to\);\s*for \(const args of list\) jobs\.push\(renderer\.compileAsync\(\.\.\.args\)\);/);
  assert.match(build, /await Promise\.all\(jobs\);\s*\}/, 'each way waited for before the next');
});
