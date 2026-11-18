import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../web/src/pure/scope.js';
import { astro, moonView, rng, towerLayout, landHeight, landKind, shoreN, inPark, vanDate, EYE, WATER_Y } from '../../web/src/pure/outside.js';

const RAD = Math.PI / 180;
const near = (a, b, tol, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
const at = iso => new Date(iso);
const sky = iso => { const d = at(iso); return S.planets(d, astro(d).lst); };
const one = (iso, id) => sky(iso).find(p => p.id === id);
// The angle between two things in the real sky, from their true heights and bearings.
const apart = (a, b) => Math.acos(Math.sin(a.el * RAD) * Math.sin(b.el * RAD) + Math.cos(a.el * RAD) * Math.cos(b.el * RAD) * Math.cos((a.az - b.az) * RAD)) / RAD;

test('north is straight ahead, east is to the right, and up is up', () => {
  near(S.aimOf(0, 0, -1).yaw, 0, 1e-12);
  near(S.aimOf(1, 0, 0).yaw, Math.PI / 2, 1e-12);
  near(S.aimOf(-1, 0, 0).yaw, -Math.PI / 2, 1e-12);
  near(S.aimOf(0, 1, -1).pitch, Math.PI / 4, 1e-12);
  assert.ok(S.reachable({ yaw: 1.6, pitch: 0.1 }));
  assert.ok(!S.reachable({ yaw: 2, pitch: 0.1 }), 'behind the house');
  assert.ok(!S.reachable({ yaw: 0, pitch: -0.2 }), 'into the balcony floor');
  assert.deepEqual(S.clampAim({ yaw: 3, pitch: -1 }), { yaw: S.LIMIT.yaw, pitch: S.LIMIT.low });
});

test('a swing goes the short way round, ends exactly on the stop, and pulls back a little on the way', () => {
  // The old bug: 347 to 8 degrees went the long way, through the room.
  const from = { yaw: 347 * RAD, pitch: 0.1, fov: 4 }, to = { yaw: 8 * RAD, pitch: 0.2, fov: 3 };
  const plan = S.slewPlan(from, to);
  near(plan.dyaw / RAD, 21, 1e-9, 'turn');
  let widest = 0;
  for (let t = 0; t <= plan.time; t += plan.time / 50) {
    const v = S.slewAt(plan, t);
    const off = S.wrap(v.yaw - from.yaw) / RAD;
    assert.ok(off >= -1e-9 && off <= 21 + 1e-9, `yaw left the short arc at t=${t}: ${off}`);
    widest = Math.max(widest, v.fov);
  }
  const end = S.slewAt(plan, plan.time + 1);
  assert.ok(end.done);
  near(S.wrap(end.yaw - to.yaw), 0, 1e-12, 'yaw');
  near(end.pitch, to.pitch, 1e-12, 'pitch');
  near(end.fov, to.fov, 1e-9, 'fov');
  assert.ok(widest > from.fov, 'pulls back mid-swing');
  assert.ok(widest <= S.FOV.wide + 1e-9, 'never past the widest field');
  const start = S.slewAt(plan, 0);
  assert.ok(!start.done);
  near(start.yaw, S.wrap(from.yaw), 1e-12);
  near(start.fov, from.fov, 1e-9);
  // A tiny hop stays quick, a long one takes longer, and neither drags.
  const short = S.slewPlan({ yaw: 0, pitch: 0, fov: 5 }, { yaw: 0.01, pitch: 0, fov: 5 });
  const long = S.slewPlan({ yaw: -1.5, pitch: 0, fov: 5 }, { yaw: 1.5, pitch: 0.9, fov: 0.4 });
  assert.ok(short.time < long.time && short.time >= 0.5 && long.time <= 2, `${short.time} ${long.time}`);
  near(short.hop, 0, 1e-9, 'no pull-back for a nudge');
});

test('a swing never turns through the back of the house, even from one end of the mount to the other', () => {
  // Hard left to a stop far right is more than half a turn: the short way would go through the room.
  const to = { yaw: 1.52, pitch: 0.35, fov: 1.6 }, plan = S.slewPlan({ yaw: -S.LIMIT.yaw, pitch: 0.1, fov: 16 }, to);
  for (let t = 0; t <= plan.time; t += plan.time / 60) {
    const y = S.slewAt(plan, t).yaw;
    assert.ok(Math.abs(y) <= S.LIMIT.yaw + 1e-9, `outside the mount at t=${t}: ${y / RAD}`);
  }
  near(S.slewAt(plan, plan.time + 1).yaw, to.yaw, 1e-12, 'arrives');
  near(S.turn(-S.LIMIT.yaw, to.yaw), to.yaw + S.LIMIT.yaw, 1e-12);
});

test('a moon, a planet or a boat out of sight behind a tower, the park or the slopes is no stop', () => {
  // The telescope's eye on the balcony (its point in world.json and the lens in front of it).
  const eye = [7.58, 1.6, -17.3], towers = towerLayout(7);
  const moonAt = (h, d = 20) => { const a = astro(vanDate(2026, 11, d, h)); return moonView(a.moon, a.sun).slice(0, 3); };
  assert.ok(!S.clearSky(eye, moonAt(17), towers), 'low in the east at 5 pm on 20 November, behind a tower');
  assert.ok(S.clearSky(eye, moonAt(22), towers), 'high and clear at 10 pm');
  const dir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  assert.ok(!S.clearSky(eye, dir(-3 * RAD, 4 * RAD), []), 'just over Grouse');
  assert.ok(S.clearSky(eye, dir(-3 * RAD, 12 * RAD), []), 'well above it');
  // The cruise ship's middle just west of the bridge is behind Stanley Park's trees; the SeaBus at the quay is in sight.
  const at = (dx, dn, up) => [EYE[0] + dx, WATER_Y + up, EYE[2] - dn];
  assert.ok(!S.clearGround(eye, at(-2748, 2179, 24)), 'behind the park');
  assert.ok(S.clearGround(eye, at(410, 2225, 3)), 'at Lonsdale Quay');
});

test('the zoom eases by ratios, the same speed in and out, and keeps to its limits', () => {
  let a = 16, b = 4;
  for (let i = 0; i < 6; i++) { a = S.easeFov(a, 4, 1 / 60); b = S.easeFov(b, 16, 1 / 60); }
  near(Math.log(16 / a), Math.log(b / 4), 1e-9, 'in and out alike');
  assert.ok(a < 16 && a > 4);
  let f = 16;
  for (let i = 0; i < 120; i++) f = S.easeFov(f, 2, 1 / 60);
  near(f, 2, 1e-3, 'settles in two seconds');
  near(S.easeFov(8, 2, 0), 8, 1e-12, 'no time, no change');
  assert.equal(S.zoomFloor(null), S.FOV.land);
  assert.equal(S.zoomFloor({ kind: 'land' }), S.FOV.land);
  assert.equal(S.zoomFloor({ kind: 'sky' }), S.FOV.sky);
  assert.equal(S.zoomFloor({ kind: 'sky', min: 0.6 }), 0.6);
  assert.equal(S.clampFov(0.02, S.FOV.land), S.FOV.land);
  assert.equal(S.clampFov(0.02, S.FOV.sky), S.FOV.sky);
  assert.equal(S.clampFov(200, S.FOV.land), S.FOV.wide);
  near(S.clampFov(5, S.FOV.land), 5, 1e-12);
  assert.equal(S.power(16), 3);
  assert.equal(S.power(0.15), 333);
});

test('a stop is framed by its size and distance, within the eyepiece range', () => {
  // A 470 m span at 3 km fills about 9 degrees; framed with room round it.
  const span = S.fovFor(470, 3000);
  assert.ok(span > 9 && span <= S.FOV.start, `${span}`);
  assert.equal(S.fovFor(10, 20000), S.FOV.land);
  assert.equal(S.fovFor(5000, 100), S.FOV.start);
});

test('bearings, heights and distances read the way a person says them', () => {
  assert.equal(S.bearing(0), '0° N');
  assert.equal(S.bearing(-22 * RAD), '338° NNW');
  assert.equal(S.bearing(90 * RAD), '90° E');
  assert.equal(S.altitude(4.2 * RAD), '+4.2°');
  assert.equal(S.altitude(-0.03 * RAD), '-0.0°');
  assert.equal(S.distance(812), '810 m');
  assert.equal(S.distance(2970), '3.0 km');
  assert.equal(S.distance(384400e3), '384,400 km');
  assert.equal(S.distance(628e9), '628 million km');
});

test('the planets sit where they really were: the great conjunction, Mars at its closest, Venus at its widest', () => {
  // 21 December 2020: Jupiter and Saturn a tenth of a degree apart, low in the south-west after sunset.
  const j = one('2020-12-22T01:00:00Z', 'jupiter'), s = one('2020-12-22T01:00:00Z', 'saturn');
  assert.ok(apart(j, s) < 0.25, `apart ${apart(j, s)}`);
  assert.ok(j.el > 8 && j.el < 16, `height ${j.el}`);
  assert.ok(j.az < -110 && j.az > -150, `bearing ${j.az}`);
  near(s.mag, 0.6, 0.25, 'Saturn brightness, rings and all');
  // Mars closest on 6 October 2020 at 0.415 au, and opposite the sun on the 13th.
  near(one('2020-10-06T14:00:00Z', 'mars').au, 0.415, 0.01, 'Mars distance');
  assert.ok(one('2020-10-13T23:00:00Z', 'mars').elong > 175, 'Mars at opposition');
  near(one('2020-10-06T14:00:00Z', 'mars').mag, -2.6, 0.25, 'Mars brightness');
  // Venus 46.1 degrees from the sun on 24 March 2020, and at its brightest late in April.
  near(one('2020-03-24T22:00:00Z', 'venus').elong, 46.1, 0.6, 'Venus elongation');
  near(one('2020-04-28T12:00:00Z', 'venus').mag, -4.7, 0.3, 'Venus brightness');
  // Jupiter at opposition on 3 November 2023.
  const jo = one('2023-11-03T05:00:00Z', 'jupiter');
  assert.ok(jo.elong > 175);
  near(jo.mag, -2.9, 0.2, 'Jupiter brightness');
  near(jo.radius * 2 / RAD * 3600, 49.5, 1.5, 'Jupiter disc, arcseconds');
});

test("Saturn's rings: edge on in March 2025, wide open in October 2017", () => {
  near(one('2025-03-23T12:00:00Z', 'saturn').tilt / RAD, 0, 0.6, 'ring plane crossing');
  near(Math.abs(one('2017-10-16T12:00:00Z', 'saturn').tilt / RAD), 26.9, 0.6, 'widest');
});

test('a planet in the southern sky is folded north like the moon, and keeps its true phase', () => {
  const d = at('2020-12-22T01:00:00Z'), lst = astro(d).lst, list = S.planets(d, lst);
  for (const p of list) {
    const up = Math.sin(p.el * RAD);
    if (p.el > 0) near(p.dir[1], Math.sin(p.el * 0.6 * RAD), 1e-9, `${p.id} height`);
    else near(p.dir[1], up, 1e-9, `${p.id} below`);
    if (Math.abs(p.az) > 90) assert.ok(p.dir[2] < 0, `${p.id} folded into the north`);
    const between = Math.acos(p.dir[0] * p.light[0] + p.dir[1] * p.light[1] + p.dir[2] * p.light[2]);
    near(between, Math.PI - p.phase, 1e-6, `${p.id} phase`);
    near(Math.hypot(...p.pole), 1, 1e-9);
  }
  // The same fold as the moon's: moonView on a planet's true direction lands on its drawn direction.
  const j = list.find(p => p.id === 'jupiter');
  const trueDir = [Math.sin(j.az * RAD) * Math.cos(j.el * RAD), Math.sin(j.el * RAD), -Math.cos(j.az * RAD) * Math.cos(j.el * RAD)];
  const v = moonView(trueDir, [0, 1, 0]);
  for (let i = 0; i < 3; i++) near(v[i], j.dir[i], 1e-9);
});

test('a planet shows only when it is up, clear of the sun, and bright enough for the sky', () => {
  const p = { el: 20, elong: 60, mag: 0.5 };
  assert.ok(S.planetShows(p, -12), 'dark sky');
  assert.ok(!S.planetShows(p, 10), 'Saturn in daylight');
  assert.ok(S.planetShows({ ...p, mag: -4.2 }, 30), 'Venus in daylight');
  assert.ok(!S.planetShows({ ...p, mag: -4.2, elong: 18 }, 30), 'Venus by day too near the sun');
  assert.ok(!S.planetShows({ ...p, el: 1 }, -20), 'on the horizon');
  assert.ok(!S.planetShows({ ...p, mag: -1, elong: 6 }, -20), 'in the glare');
  assert.ok(S.planetShows({ ...p, mag: 1.2 }, -6), 'twilight, a bright one');
  assert.ok(!S.planetShows({ ...p, mag: 2 }, -6), 'twilight, a faint one');
});

test("Jupiter's moons go round at their own speeds", () => {
  const a = S.galilean(at('2026-11-17T06:00:00Z')), periods = [1.769138, 3.551181, 7.15455, 16.689018];
  assert.deepEqual(a.map(m => m.name), ['Io', 'Europa', 'Ganymede', 'Callisto']);
  periods.forEach((days, i) => {
    const b = S.galilean(new Date(at('2026-11-17T06:00:00Z').getTime() + days * 864e5));
    near(S.wrap(b[i].u - a[i].u) / RAD, 0, 2, a[i].name);
  });
  for (const m of a) assert.ok(m.u >= -Math.PI && m.u <= Math.PI && m.r > 5);
});

test('the label goes to the nearest stop inside the eyepiece', () => {
  const stops = [{ id: 'a', yaw: 0.02, pitch: 0.1 }, { id: 'b', yaw: -0.01, pitch: 0.1 }, { id: 'c', yaw: 1, pitch: 0.1 }];
  assert.equal(S.inView(stops, 0, 0.1, 10).id, 'b');
  assert.equal(S.inView(stops, 0.5, 0.1, 10), null);
  assert.equal(S.inView(stops, 0.99, 0.1, 4).id, 'c');
  assert.equal(S.inView([], 0, 0, 10), null);
});

test('a stop hidden behind a tower is no stop: the line of sight is checked against every box', () => {
  const eye = [0, 2, 0], far = [0, 2, -1000];
  const tower = { x: 0, z: -300, w: 40, d: 30, h: 120, base: -40, rot: 0 };
  assert.ok(!S.clearLine(eye, far, [tower]), 'straight through it');
  assert.ok(S.clearLine(eye, [200, 2, -1000], [tower]), 'past its side');
  assert.ok(S.clearLine(eye, [0, 400, -1000], [tower]), 'over its roof');
  assert.ok(S.clearLine(eye, [0, 2, -250], [tower]), 'short of it');
  assert.ok(S.clearLine(eye, far, [{ ...tower, own: true }]), 'our own building never counts');
  assert.ok(S.clearLine(eye, far, []));
  // A long thin tower turned across the line blocks it; turned along it, a line beside it gets by.
  const slab = { x: 30, z: -300, w: 100, d: 6, h: 120, base: -40, rot: 0 };
  assert.ok(!S.clearLine(eye, [0, 2, -600], [slab]), 'across');
  assert.ok(S.clearLine(eye, [0, 2, -600], [{ ...slab, rot: Math.PI / 2 }]), 'turned along it');
});

test('the North Shore gets houses on its streets: on town land, clear of the water, the park and the towers', () => {
  const lots = S.houseLots(), towers = towerLayout(7), grid = S.towerGrid(towers), rand = rng(3), houses = [];
  const d = l => Math.hypot(l[0] - EYE[0], l[1] - EYE[2]);
  for (let i = 1; i < lots.length; i++) assert.ok(d(lots[i]) >= d(lots[i - 1]) - 1e-9, 'nearest first');
  let gardens = 0;
  const trees = [];
  for (const lot of lots.slice(0, 9000)) {
    const h = S.houseOn(lot, rand, grid);
    if (h) houses.push(h); else if (h === false) gardens++;
    if (h !== null) for (const t of S.yardTrees(lot, h, rand)) trees.push([t, h, lot]);
  }
  assert.ok(houses.length > 2500, `only ${houses.length} houses`);
  assert.ok(gardens > houses.length * 0.15 && gardens < houses.length * 0.4, `${gardens} gardens to ${houses.length} houses`);
  for (const [[tx, ty, tz, size, kind], h, lot] of trees) {
    assert.ok(Math.abs(ty - (WATER_Y + landHeight(tx - EYE[0], EYE[2] - tz) - 0.5)) < 1e-9 && size >= 0.8 && size <= 1.4 && (kind === 0 || kind === 1));
    assert.ok(Math.abs(tx - lot[0]) <= 5.5 && Math.abs(tz - lot[1]) <= 12.5, 'in its own lot');
    // Behind the house, towards the middle of the block, past its back wall.
    if (h) assert.ok((lot[1] - tz) * lot[2] >= 8.5 && Math.abs(tz - lot[1]) > Math.max(h[3], h[4]) / 2, 'clear of the house');
  }
  for (const [x, y, z, w, dp, wall, roof] of houses) {
    const dx = x - EYE[0], dn = EYE[2] - z, h = landHeight(dx, dn);
    assert.ok(dn - shoreN(dx) >= 45, 'on the shore side of the water');
    assert.ok(inPark(dx, dn) >= 1.3, 'out of the park');
    assert.ok(h >= 3 && landKind(dx, dn, h)[0] >= 0.45, 'on town land');
    assert.ok(y <= WATER_Y + h + 1e-9, 'sits into the ground, never above it');
    assert.ok(w >= 9 && w <= 13 && dp >= 8 && dp <= 12 && wall >= 5 && wall <= 7.5 && roof >= 1.6 && roof <= 3.4);
    // Inside its block, off the streets on the block's edges.
    const fx = ((x / S.BLOCK[0]) % 1 + 1) % 1, fz = ((z / S.BLOCK[1]) % 1 + 1) % 1;
    assert.ok(Math.abs(fx - 0.5) < 0.44 && Math.abs(fz - 0.5) < 0.44, `in the street at ${x}, ${z}`);
    for (const t of towers) assert.ok(!(Math.abs(x - t.x) < t.w / 2 + 6 && Math.abs(z - t.z) < t.d / 2 + 6), 'inside a tower');
  }
  // The same every visit.
  const again = [], r2 = rng(3);
  for (const lot of lots.slice(0, 9000)) { const h = S.houseOn(lot, r2, grid); if (h) again.push(h); if (h !== null) S.yardTrees(lot, h, r2); }
  assert.deepEqual(again, houses);
});
