import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vanTime, sunElev, DAY } from '../../web/src/pure/calendar.js';
import * as P from '../../web/src/pure/outside.js';

const deg = r => (r * 180) / Math.PI;
const elev = v => deg(Math.asin(v[1]));
const azim = v => deg(Math.atan2(v[0], -v[2]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('vanDate is the inverse of vanTime, either side of the clock change', () => {
  for (const [y, m, d, h, min] of [[2026, 7, 1, 12, 0], [2026, 1, 15, 21, 30], [2026, 3, 8, 3, 15], [2026, 12, 31, 23, 59], [2027, 2, 1, 0, 5]]) {
    const v = vanTime(P.vanDate(y, m, d, h, min));
    assert.deepEqual([v.y, v.m, v.d, v.h, v.min], [y, m, d, h, min]);
  }
});

test('clock and date flags parse, and junk is refused', () => {
  assert.deepEqual(P.parseClock('21:30'), { h: 21, min: 30 });
  assert.deepEqual(P.parseClock('7'), { h: 7, min: 0 });
  assert.equal(P.parseClock('24:00'), null);
  assert.equal(P.parseClock('noon'), null);
  assert.equal(P.parseClock(null), null);
  assert.deepEqual(P.parseDay('2026-07-01'), { y: 2026, m: 7, d: 1 });
  assert.equal(P.parseDay('July 1'), null);
});

test('the sun sits where calendar.sunElev says, due south at its highest', () => {
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 7.3 * DAY) {
    const a = P.astro(new Date(t));
    assert.ok(Math.abs(elev(a.sun) - sunElev(new Date(t))) < 1e-6);
    assert.ok(Math.abs(Math.hypot(...a.sun) - 1) < 1e-9);
  }
  let best = -90, at = 0;
  for (let t = Date.UTC(2026, 5, 21, 17); t < Date.UTC(2026, 5, 21, 23); t += 60000) {
    const e = sunElev(new Date(t));
    if (e > best) { best = e; at = t; }
  }
  const s = P.astro(new Date(at)).sun;
  assert.ok(Math.abs(Math.abs(azim(s)) - 180) < 2, String(azim(s)));
});

test('the moon shown in the north keeps its true phase', () => {
  for (let t = Date.UTC(2026, 10, 1); t < Date.UTC(2026, 11, 1); t += 0.37 * DAY) {
    const a = P.astro(new Date(t)), mv = P.moonView(a.moon, a.sun);
    const lit = (1 - dot(mv.slice(3), mv.slice(0, 3))) / 2;
    assert.ok(Math.abs(lit - P.litFraction(a.phase)) < 1e-6, `${lit} vs ${P.litFraction(a.phase)}`);
    assert.ok(Math.abs(Math.hypot(...mv.slice(0, 3)) - 1) < 1e-9);
    if (elev(a.moon) > 0) {
      assert.ok(mv[2] <= 1e-9, 'an up moon is never shown behind the loft');
      assert.ok(Math.abs(elev(mv) - elev(a.moon) * 0.6) < 1e-6);
    }
    if (a.moon[2] < 0) assert.ok(Math.abs(azim(mv) - azim(a.moon)) < 1e-6, 'a northern moon is left where it is');
  }
});

test('the Death Star waits near a risen moon and in the north-north-west otherwise', () => {
  const high = P.deathStarDir([Math.sin(0.5) * Math.cos(0.4), Math.sin(0.4), -Math.cos(0.5) * Math.cos(0.4)]);
  const moon = [Math.sin(0.5) * Math.cos(0.4), Math.sin(0.4), -Math.cos(0.5) * Math.cos(0.4)];
  const sep = deg(Math.acos(dot(high, moon)));
  assert.ok(sep > 3 && sep < 7, String(sep));
  const home = P.deathStarDir([0, -0.3, 0.95]);
  assert.ok(Math.abs(azim(home) + 16) < 1e-6 && Math.abs(elev(home) - 24) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...home) - 1) < 1e-9);
});

test('sky colours brighten with the sun, stay finite, and grey out when overcast', () => {
  let last = -1;
  for (let e = -20; e <= 50; e += 2) {
    const s = P.skyColors(e);
    for (const k of ['zenith', 'horizon', 'horizonSun', 'glow', 'sun', 'sunLight', 'ambient', 'cloudLit', 'cloudDark']) {
      for (const c of s[k]) assert.ok(Number.isFinite(c) && c >= 0, `${k} at ${e}`);
    }
    const light = lum(s.ambient) + lum(s.sunLight);
    assert.ok(light >= last - 1e-9, `daylight dims at ${e}`);
    last = light;
  }
  assert.equal(P.skyColors(-30).night, 1);
  assert.equal(P.skyColors(30).night, 0);
  const clear = P.skyColors(30, 0), grey = P.skyColors(30, 1);
  const sat = c => Math.max(...c) - Math.min(...c);
  assert.ok(sat(grey.zenith) < sat(clear.zenith) * 0.3);
  assert.ok(lum(grey.sunLight) < lum(clear.sunLight) * 0.3);
});

test('dayK runs from 0 at night to 1 under a high clear sun', () => {
  assert.equal(P.dayLevel(-15), 0);
  assert.equal(P.dayLevel(60), 1);
  assert.ok(P.dayLevel(60, 1) < 0.8);
  assert.ok(P.dayLevel(5) > P.dayLevel(-5) && P.dayLevel(-5) > 0);
});

test('homes light up in the evening, offices in the working day', () => {
  assert.ok(P.windowFraction(21) > P.windowFraction(15));
  assert.ok(P.windowFraction(15) > P.windowFraction(4));
  assert.ok(Math.abs(P.windowFraction(0) - P.windowFraction(24)) < 1e-12);
  assert.ok(Math.abs(P.windowFraction(-1) - P.windowFraction(23)) < 1e-12);
  assert.ok(P.officeFraction(11) > 0.6 && P.officeFraction(22) < 0.15);
});

test('the share of lit windows follows the fraction, and only a few change their mind', () => {
  for (const frac of [0.15, 0.45]) {
    let lit = 0, flips = 0, n = 0;
    for (let seed = 0.05; seed < 1; seed += 0.1) {
      for (let col = 0; col < 60; col++) {
        for (let row = 0; row < 40; row++) {
          const a = P.windowLit(seed, col, row, frac, 0), b = P.windowLit(seed, col, row, frac, 4000);
          lit += a; flips += a !== b; n++;
        }
      }
    }
    assert.ok(Math.abs(lit / n - frac) < 0.03, `lit ${lit / n} for ${frac}`);
    assert.ok(flips / n > 0.002 && flips / n < 0.08, `flips ${flips / n}`);
  }
  assert.equal(P.windowLit(0.3, 4, 5, 0, 0), false);
  assert.equal(P.windowLit(0.3, 4, 5, 1, 0), true);
});

test('fireworks only on their nights, and the flag always wins', () => {
  const v = (m, d, h, min = 0) => ({ y: 2026, m, d, h, min });
  assert.equal(P.fireworksOn('newyear', v(12, 31, 23, 50), -40), true);
  assert.equal(P.fireworksOn('newyear', v(1, 1, 0, 15), -40), true);
  assert.equal(P.fireworksOn('newyear', v(12, 31, 22, 0), -40), false);
  assert.equal(P.fireworksOn('canada', v(7, 1, 22, 30), -9), true);
  assert.equal(P.fireworksOn('canada', v(7, 1, 22, 30), 2), false);
  assert.equal(P.fireworksOn('lights', v(7, 29, 22, 0), -8), true);
  assert.equal(P.fireworksOn('halloween', v(10, 31, 22, 0), -30), false);
  assert.equal(P.fireworksOn(undefined, v(3, 3, 12, 0), 40, true), true);
});

test('a show keeps every shell over the water, in its own slot', () => {
  const out = new Float32Array(P.FW_SLOTS * 8);
  let seen = 0;
  for (let t = 1000; t < 1600; t += 0.37) {
    const n = P.fireworkBursts(t, out);
    assert.ok(n >= 1 && n <= P.FW_SLOTS, String(n));
    let active = 0;
    for (let s = 0; s < P.FW_SLOTS; s++) {
      const o = s * 8, age = out[o + 3];
      if (age < -1e3) continue;
      active++;
      assert.ok(age >= -out[o + 4] - 1e-3 && age <= P.FW_LIFE + 1e-3);
      assert.ok(P.landHeight(out[o], out[o + 2]) < -5, `shell over land at ${out[o]}, ${out[o + 2]}`);
      assert.ok(out[o + 1] > 150 && out[o + 1] < 420);
    }
    assert.equal(active, n);
    seen += n;
  }
  assert.ok(seen > 500);
  const again = new Float32Array(P.FW_SLOTS * 8);
  P.fireworkBursts(1234.5, out);
  P.fireworkBursts(1234.5, again);
  assert.deepEqual(Array.from(out), Array.from(again));
});

test('the aurora is rare, wintry, needs a clear sky and dark, and the flag forces it', () => {
  let nights = 0, lit = 0;
  for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2030, 0, 1); t += DAY) {
    const d = new Date(t), m = d.getUTCMonth() + 1;
    const v = { y: d.getUTCFullYear(), m, d: d.getUTCDate(), h: 23, min: 30 };
    if (![11, 12, 1, 2].includes(m)) { assert.equal(P.auroraLevel(v, 'clear', -30), 0); continue; }
    nights++;
    if (P.auroraLevel(v, 'clear', -30) > 0) lit++;
    assert.equal(P.auroraLevel(v, 'cloudy', -30), 0);
  }
  assert.ok(lit > 0 && lit / nights < 0.06, `${lit} of ${nights}`);
  assert.equal(P.auroraLevel({ y: 2026, m: 7, d: 1, h: 23, min: 0 }, 'rain', -20, true), 1);
  assert.equal(P.auroraLevel({ y: 2026, m: 7, d: 1, h: 13, min: 0 }, 'clear', 50, true), 0);
});

test('snow lies low in winter and is gone in summer; a snowy day brings it to the shore', () => {
  assert.ok(P.snowLine(1, 15, 'clear') < 700 && P.snowLine(8, 15, 'clear') > 2000);
  assert.ok(P.snowLine(7, 15, 'snow') <= 120);
  for (let m = 1; m <= 12; m++) assert.ok(Math.abs(P.snowLine(m, 30, 'clear') - P.snowLine(m % 12 + 1, 1, 'clear')) < 60);
  assert.equal(P.skiLightsOn({ m: 1, h: 20 }, -20), true);
  assert.equal(P.skiLightsOn({ m: 1, h: 23 }, -30), false);
  assert.equal(P.skiLightsOn({ m: 7, h: 22 }, -10), false);
  assert.equal(P.skiLightsOn({ m: 12, h: 16 }, 3), false);
});

test('the land: Grouse near its height, Lions Gate towers in water and anchors on land', () => {
  let g = 0;
  for (let a = -900; a <= 900; a += 30) for (let b = -900; b <= 900; b += 30) g = Math.max(g, P.landHeight(P.GROUSE[0] + a, P.GROUSE[1] + b));
  assert.ok(Math.abs(g - 1231) < 1231 * 0.15, String(g));
  assert.ok(P.landHeight(0, 0) > 2, 'the loft stands on land');
  assert.ok(P.landHeight(0, 300) < -5, 'the inlet is in front of it');
  const pt = [0, 0];
  for (const s of [-P.BRIDGE.main, P.BRIDGE.main]) { P.bridgePoint(s, 0, pt); assert.ok(P.landHeight(pt[0], pt[1]) < 0, `tower at ${s}`); }
  for (const s of [-P.BRIDGE.anchor, P.BRIDGE.anchor]) { P.bridgePoint(s, 0, pt); assert.ok(P.landHeight(pt[0], pt[1]) > 0, `anchor at ${s}`); }
  assert.ok(P.cableHeight(P.BRIDGE.main) > P.cableHeight(0) && P.cableHeight(0) > P.deckHeight(0));
});

test('ships keep to the water and swing round smoothly at the berth', () => {
  const v = P.makeVessel();
  for (const [fn, cycle] of [[P.cruiseAt, P.CRUISE_CYCLE], [P.ferryAt, P.FERRY_CYCLE]]) {
    let prev = null, shown = 0;
    for (let s = 0; s < cycle; s += 2) {
      fn(1.7e9 + s, v);
      if (!v.on) { prev = null; continue; }
      shown++;
      assert.ok(P.landHeight(v.dx, v.dn) < -2, `on land at ${s}`);
      if (prev !== null) {
        const turn = Math.atan2(Math.sin(v.heading - prev), Math.cos(v.heading - prev));
        assert.ok(Math.abs(turn) < 0.05, `heading jumps ${turn} at ${s}`);
      }
      prev = v.heading;
    }
    assert.ok(shown > cycle * 0.3);
  }
});

test('the floatplane runs on water, climbs, and comes and goes', () => {
  const v = P.makeVessel();
  let up = 0, off = 0, low = Infinity, high = 0;
  for (let s = 0; s < 1200; s += 0.5) {
    P.floatplaneAt(s, v);
    if (!v.on) { off++; continue; }
    if (v.alt < 1) { assert.ok(P.landHeight(v.dx, v.dn) < -2, `taxiing on land at ${s}`); low = Math.min(low, v.alt); }
    high = Math.max(high, v.alt);
    up++;
  }
  assert.ok(up > 0 && off > 0 && low >= 0 && high > 250);
});

test('the city layout is repeatable and leaves the view to the North Shore open', () => {
  const a = P.towerLayout(7), b = P.towerLayout(7);
  assert.deepEqual(a, b);
  assert.ok(a.some(t => t.own));
  for (const t of a) {
    const dx = t.x - P.EYE[0], dn = P.EYE[2] - t.z, az = Math.abs(deg(Math.atan2(dx, dn)));
    if (!t.own && Math.hypot(dx, dn) < 1500) assert.ok(az > 40, `tower at ${dx.toFixed(0)}, ${dn.toFixed(0)}`);
  }
});

test('noise tiles seamlessly and spans 0 to 1; the hash stays in range', () => {
  const n = 64, t = P.tileNoise(n, 4, 3, 5);
  assert.equal(Math.min(...t), 0);
  assert.equal(Math.max(...t), 1);
  let seam = 0, inner = 0;
  for (let y = 0; y < n; y++) { seam += Math.abs(t[y * n] - t[y * n + n - 1]); inner += Math.abs(t[y * n + 30] - t[y * n + 31]); }
  assert.ok(seam < inner * 2.5, `${seam} vs ${inner}`);
  for (let i = 0; i < 2000; i++) { const h = P.hash13(i * 1.7, i * 0.3, 9 - i); assert.ok(h >= 0 && h < 1); }
});
