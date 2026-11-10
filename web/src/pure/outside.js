// The maths behind the view outside, with no three and no DOM so the tests can run it.
import { vanTime, moonPhase, DAY } from './calendar.js';

export const LAT = 49.2827, LON = -123.1207;
export const WATER_Y = -40;
export const EYE = [11, 1.6, -14.5];
const RAD = Math.PI / 180;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
const fract = x => x - Math.floor(x);

export const wx = dx => EYE[0] + dx;
export const wz = dn => EYE[2] - dn;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ihash(i, j) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Dave Hoskins' sine-free hash, written the same way in the window shader.
export function hash13(x, y, z) {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(z * 0.1031);
  const d = a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32);
  a += d; b += d; c += d;
  return fract((a + b) * c);
}

export function vanDate(y, m, d, h, min = 0) {
  const want = Date.UTC(y, m - 1, d, h, min);
  let t = want + 8 * 3600e3;
  for (let i = 0; i < 3; i++) {
    const v = vanTime(new Date(t));
    const diff = Date.UTC(v.y, v.m - 1, v.d, v.h, v.min) - want;
    if (!diff) break;
    t -= diff;
  }
  return new Date(t);
}

export function parseClock(s) {
  const m = /^(\d{1,2}):?(\d{2})?$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const h = +m[1], min = +(m[2] || 0);
  return h < 24 && min < 60 ? { h, min } : null;
}

export function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim());
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

// x east, y up, z = minus north, at the latitude of Vancouver.
export function eqToWorld(ra, dec, lst, out, o = 0) {
  const H = lst - ra, phi = LAT * RAD;
  const cd = Math.cos(dec), sd = Math.sin(dec), cH = Math.cos(H);
  out[o] = -cd * Math.sin(H);
  out[o + 1] = cd * cH * Math.cos(phi) + sd * Math.sin(phi);
  out[o + 2] = cd * cH * Math.sin(phi) - sd * Math.cos(phi);
  return out;
}

function eclToWorld(lamDeg, eps, lst, out) {
  const lam = lamDeg * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  return eqToWorld(ra, dec, lst, out);
}

export function makeAstro() { return { sun: [0, 0, 0], moon: [0, 0, 0], lst: 0, phase: 0 }; }

// Same series as calendar.sunElev, plus the moon on the ecliptic at its phase angle from the sun.
export function astro(date, out = makeAstro()) {
  const n = date.getTime() / DAY + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lam = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  out.lst = (gmst * 15 + LON) * RAD;
  out.phase = moonPhase(date);
  eclToWorld(lam, eps, out.lst, out.sun);
  eclToWorld(lam + out.phase * 360, eps, out.lst, out.moon);
  return out;
}

const elevOf = v => Math.asin(clamp(v[1], -1, 1));
const azOf = v => Math.atan2(v[0], -v[2]);
function fromAzEl(az, el, out, o = 0) {
  out[o] = Math.sin(az) * Math.cos(el); out[o + 1] = Math.sin(el); out[o + 2] = -Math.cos(az) * Math.cos(el);
  return out;
}

// The moon lives mostly in the south, behind the loft, so its southern sky is folded north and kept lower;
// the shading light keeps the true sun angle, so the phase stays right.
export function moonView(moon, sun, out = new Array(6)) {
  const fold = moon[2] > 0, el = elevOf(moon), az = fold ? Math.PI - azOf(moon) : azOf(moon);
  fromAzEl(az, el > 0 ? el * 0.6 : el, out, 0);
  const e = Math.acos(clamp(moon[0] * sun[0] + moon[1] * sun[1] + moon[2] * sun[2], -1, 1));
  let tx = sun[0], ty = sun[1], tz = fold ? -sun[2] : sun[2];
  const k = tx * out[0] + ty * out[1] + tz * out[2];
  tx -= out[0] * k; ty -= out[1] * k; tz -= out[2] * k;
  let len = Math.hypot(tx, ty, tz);
  if (len < 1e-6) { tx = 0; ty = -1; tz = 0; len = 1; }
  const c = Math.cos(e), s = Math.sin(e) / len;
  out[3] = out[0] * c + tx * s; out[4] = out[1] * c + ty * s; out[5] = out[2] * c + tz * s;
  return out;
}

export const litFraction = phase => (1 - Math.cos(phase * 2 * Math.PI)) / 2;

// The easter egg rides a few degrees off the moon, and waits in the north-north-west when the moon is down.
export function deathStarDir(moonDir, out = [0, 0, 0]) {
  const el = elevOf(moonDir), az = azOf(moonDir);
  const k = smooth(3 * RAD, 10 * RAD, el);
  const target = az + 4.5 * RAD, home = -16 * RAD, turn = Math.atan2(Math.sin(target - home), Math.cos(target - home));
  return fromAzEl(home + turn * k, lerp(24 * RAD, el + 2.6 * RAD, k), out);
}

// Linear RGB keyframes by sun elevation: zenith, horizon away from the sun, horizon under the sun, sun glow.
const SKY = [
  [-18, [0.0022, 0.003, 0.007], [0.007, 0.0085, 0.014], [0.007, 0.0085, 0.014], [0, 0, 0]],
  [-12, [0.0035, 0.0055, 0.015], [0.012, 0.014, 0.026], [0.022, 0.018, 0.026], [0.006, 0.003, 0.002]],
  [-7, [0.01, 0.018, 0.055], [0.04, 0.04, 0.075], [0.15, 0.07, 0.05], [0.08, 0.03, 0.015]],
  [-3, [0.025, 0.05, 0.14], [0.13, 0.11, 0.16], [0.5, 0.22, 0.09], [0.35, 0.13, 0.04]],
  [0, [0.05, 0.105, 0.27], [0.27, 0.23, 0.27], [0.9, 0.42, 0.14], [0.75, 0.32, 0.09]],
  [3, [0.08, 0.165, 0.4], [0.38, 0.36, 0.4], [1.0, 0.58, 0.28], [0.85, 0.45, 0.18]],
  [8, [0.11, 0.235, 0.54], [0.48, 0.5, 0.55], [0.95, 0.74, 0.5], [0.65, 0.48, 0.28]],
  [20, [0.115, 0.27, 0.64], [0.54, 0.61, 0.72], [0.76, 0.73, 0.66], [0.4, 0.35, 0.28]],
  [45, [0.095, 0.255, 0.66], [0.52, 0.62, 0.76], [0.62, 0.66, 0.72], [0.3, 0.28, 0.24]],
];
const SUN = [[-2, [1.0, 0.3, 0.08]], [1, [1.0, 0.45, 0.16]], [4, [1.0, 0.62, 0.32]], [10, [1.0, 0.82, 0.6]], [25, [1.0, 0.93, 0.84]], [60, [1.0, 0.97, 0.93]]];

function keyLerp(keys, e, slot, out) {
  let i = 0;
  while (i < keys.length - 2 && e > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], t = clamp((e - a[0]) / (b[0] - a[0]));
  for (let c = 0; c < 3; c++) out[c] = lerp(a[slot][c], b[slot][c], t);
  return out;
}

export function makeSkyState() {
  const v = () => [0, 0, 0];
  return { zenith: v(), horizon: v(), horizonSun: v(), glow: v(), sun: v(), sunLight: v(), ambient: v(), cloudLit: v(), cloudDark: v(), night: 0, stars: 0, day: 0 };
}

const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const CITY_GLOW = [0.011, 0.0085, 0.006], CLOUD_NIGHT = [0.022, 0.017, 0.014], GREY_TINT = [0.97, 0.99, 1.02];

// gloom darkens an overcast sky further for rain and snow.
export function skyColors(elev, overcast = 0, gloom = 0, out = makeSkyState()) {
  keyLerp(SKY, elev, 1, out.zenith);
  keyLerp(SKY, elev, 2, out.horizon);
  keyLerp(SKY, elev, 3, out.horizonSun);
  keyLerp(SKY, elev, 4, out.glow);
  keyLerp(SUN, elev, 1, out.sun);
  const night = 1 - smooth(-12, -4, elev);
  out.night = night;
  out.stars = 1 - smooth(-15, -7, elev);
  out.day = dayLevel(elev, overcast);
  // Vancouver's sky never gets truly dark: the city lights the haze at the horizon.
  for (let c = 0; c < 3; c++) { out.horizon[c] += CITY_GLOW[c] * night; out.horizonSun[c] += CITY_GLOW[c] * night; }
  const sunUp = smooth(-1.5, 5, elev);
  const grey = lum(out.horizon) * 0.78, dim = 1 - 0.5 * gloom;
  for (let c = 0; c < 3; c++) {
    const g = lerp(CLOUD_NIGHT[c] * (1 + gloom), grey * GREY_TINT[c], 1 - night * 0.85) * dim;
    out.zenith[c] = lerp(out.zenith[c], g * 0.9, overcast);
    out.horizon[c] = lerp(out.horizon[c], g, overcast);
    out.horizonSun[c] = lerp(out.horizonSun[c], g * 1.08, overcast);
    out.glow[c] *= 1 - 0.85 * overcast;
    out.sunLight[c] = out.sun[c] * sunUp * 1.15 * (1 - 0.82 * overcast);
    out.ambient[c] = (out.zenith[c] * 0.55 + out.horizon[c] * 0.45) * 1.1;
    out.cloudLit[c] = out.sunLight[c] * 0.9 + out.ambient[c] * 0.9 + out.glow[c] * 0.35 + CLOUD_NIGHT[c] * night * 0.8;
    out.cloudDark[c] = out.ambient[c] * 0.55 + CLOUD_NIGHT[c] * night * 0.6;
  }
  return out;
}

export function dayLevel(elev, overcast = 0) {
  return clamp(smooth(-10, 0, elev) * 0.3 + smooth(0, 30, elev) * 0.7) * (1 - 0.3 * overcast);
}

export const WEATHER = {
  clear: { cloud: 0.22, overcast: 0, rain: 0, snow: 0, fog: 0, haze: 1, rough: 0.42, low: 0 },
  cloudy: { cloud: 0.74, overcast: 0.6, rain: 0, snow: 0, fog: 0, haze: 1.5, rough: 0.6, low: 0.45 },
  rain: { cloud: 1, overcast: 1, rain: 1, snow: 0, fog: 0, haze: 3.6, rough: 0.9, low: 1 },
  snow: { cloud: 1, overcast: 0.92, rain: 0, snow: 1, fog: 0, haze: 5, rough: 0.5, low: 0.9 },
  fog: { cloud: 0.6, overcast: 0.75, rain: 0, snow: 0, fog: 1, haze: 26, rough: 0.3, low: 0.6 },
};
export const weatherTarget = name => WEATHER[name] || WEATHER.clear;

const WIN = [[0, 0.2], [2, 0.11], [4, 0.06], [5.5, 0.1], [7, 0.26], [8.5, 0.18], [10, 0.12], [15, 0.13], [17, 0.26], [19, 0.4], [21, 0.44], [22.5, 0.36], [24, 0.2]];

export function windowFraction(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (WIN[i + 1][0] < h) i++;
  const a = WIN[i], b = WIN[i + 1];
  return lerp(a[1], b[1], (h - a[0]) / (b[0] - a[0]));
}

const OFFICE = [[0, 0.05], [6, 0.06], [7.5, 0.4], [9, 0.72], [16.5, 0.7], [18.5, 0.3], [20.5, 0.12], [24, 0.05]];

// Offices empty out in the evening while homes fill up.
export function officeFraction(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (OFFICE[i + 1][0] < h) i++;
  const a = OFFICE[i], b = OFFICE[i + 1];
  return lerp(a[1], b[1], (h - a[0]) / (b[0] - a[0]));
}

// Mirrors the facade shader: homes light three windows at a time, and a few change their mind now and then.
export function windowLit(seed, col, row, frac, t) {
  const unit = Math.floor(col / 3);
  let lit = hash13(unit, row, seed * 97) < frac;
  if (hash13(unit + 17.3, row, seed * 53) < 0.07) {
    const epoch = Math.floor(t / 45 + hash13(unit, row, 3.3) * 9);
    lit = hash13(unit, row, seed * 31 + epoch) < frac;
  }
  return lit;
}

export const FW_SLOTS = 8, FW_EVERY = 1.6, FW_LIFE = 5.5, FW_RISE = 2.2;
export const FW_DAYS = ['newyear', 'canada', 'lights'];

export function fireworksOn(id, v, elev, forced = false) {
  if (forced) return true;
  if (!FW_DAYS.includes(id) || elev > -5) return false;
  const h = v.h + v.min / 60;
  if (id === 'newyear') return (v.m === 12 && v.d === 31 && h >= 23.75) || (v.m === 1 && v.d === 1 && h < 0.5);
  if (id === 'canada') return h >= 22.25 && h < 23.25;
  return h >= 21.75 && h < 22.5;
}

// 8 floats a slot: dx, height, dn, age (negative while climbing), climb, style, colour, seed. Shells never share a slot.
export function fireworkBursts(t, out = new Float32Array(FW_SLOTS * 8)) {
  out.fill(0);
  for (let s = 0; s < FW_SLOTS; s++) out[s * 8 + 3] = -1e4;
  const k1 = Math.floor(t / FW_EVERY), k0 = k1 - Math.ceil((FW_RISE + FW_LIFE) / FW_EVERY) - 1;
  let n = 0;
  for (let k = k0; k <= k1; k++) {
    const t0 = k * FW_EVERY + 0.9 * ihash(k, 1), rise = 1.5 + 0.7 * ihash(k, 2), age = t - t0 - rise;
    if (t < t0 || age > FW_LIFE) continue;
    const o = (((k % FW_SLOTS) + FW_SLOTS) % FW_SLOTS) * 8;
    out[o] = -380 + 760 * ihash(k, 3);
    out[o + 1] = 220 + 170 * ihash(k, 4);
    out[o + 2] = 1050 + 400 * ihash(k, 5);
    out[o + 3] = age;
    out[o + 4] = rise;
    out[o + 5] = Math.floor(ihash(k, 6) * 4);
    out[o + 6] = Math.floor(ihash(k, 7) * 8);
    out[o + 7] = ihash(k, 8);
    n++;
  }
  return n;
}

export function auroraLevel(v, weather, elev, forced = false) {
  const night = 1 - smooth(-14, -9, elev);
  if (forced) return night;
  if (weather !== 'clear' || ![11, 12, 1, 2].includes(v.m)) return 0;
  const day = Math.floor(Date.UTC(v.y, v.m - 1, v.d) / DAY) - (v.h < 12 ? 1 : 0);
  if (ihash(day, 77) >= 0.035) return 0;
  const h = (v.h + v.min / 60 + 12) % 24;
  return night * smooth(9, 10.5, h) * (1 - smooth(14.5, 16.5, h));
}

const SNOW = [500, 550, 700, 950, 1350, 1750, 2600, 2700, 2500, 1700, 1100, 700];

export function snowLine(m, d, weather) {
  const f = (d - 15) / 30.5, i = m - 1, j = (((f < 0 ? i - 1 : i + 1) % 12) + 12) % 12;
  const s = lerp(SNOW[i], SNOW[j], Math.abs(f));
  return weather === 'snow' ? Math.min(s, 120) : s;
}

// Grouse lights its runs for night skiing through the season and turns them off late in the evening.
export function skiLightsOn(v, elev) {
  return [11, 12, 1, 2, 3, 4].includes(v.m) && elev < -4 && v.h >= 15 && v.h < 23;
}

export function shoreS(dx) {
  let s = 62 + 10 * Math.sin(dx / 160);
  if (dx < -150) s += 0.45 * Math.min(-150 - dx, 1450);
  if (dx < -3000) s -= (-3000 - dx) * 1.25;
  s += 300 * Math.exp(-(((dx - 700) / 65) ** 8));
  if (dx > 1100) s += (dx - 1100) * 0.05;
  if (dx > 5000) s += (dx - 5000) * 0.4;
  return s;
}

export function shoreN(dx) {
  let s = 2330 + 90 * Math.sin(dx / 700 + 1) + 60 * Math.sin(dx / 1900);
  s += 280 * Math.exp(-(((dx + 1950) / 500) ** 2));
  if (dx < -2400) s += (-2400 - dx) * 0.07;
  if (dx < -9000) s += (-9000 - dx) * 0.9;
  if (dx > 4800) s -= (dx - 4800) * 0.55;
  return s;
}

function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = ihash(i, j), b = ihash(i + 1, j), c = ihash(i, j + 1), d = ihash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function ridged(x, y, oct = 5) {
  let s = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    const n = 1 - Math.abs(2 * vnoise(x * f + o * 17.1, y * f - o * 9.3) - 1);
    s += n * n * amp; norm += amp; amp *= 0.5; f *= 2.03;
  }
  return s / norm;
}

// [dx, dn, height, spread]: the named North Shore summits, so the skyline reads as the real one.
export const PEAKS = [
  [-350, 10300, 1231, 2100], [1600, 10000, 1185, 1700], [-2000, 13900, 1504, 1500], [100, 13300, 1401, 1300],
  [3400, 10700, 1000, 1500], [6900, 12600, 1449, 2200], [4800, 14900, 1441, 1600], [-8200, 8800, 1325, 2400],
  [-10500, 9900, 1454, 2000], [-10050, 21300, 1380, 1900], [-10400, 21500, 1646, 330], [-9650, 21250, 1606, 320],
  [-13500, 24500, 1788, 1900], [11000, 17000, 1509, 2100], [3500, 22000, 1700, 2600], [-5200, 17800, 1560, 2000],
];
export const GROUSE = PEAKS[0];
const VALLEYS = [-3800, 2700, 5300];

// Smooth max, with the blend kept smaller than both inputs so flat ground near zero is not lifted.
const smax = (a, b, k0) => { const k = Math.min(k0, 0.5 * Math.max(0, Math.min(a, b))) + 1e-6, h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(a, b, h) + k * h * (1 - h); };

// An envelope lifted under each named summit, carved by ridged noise so slopes break into ridges, not domes.
function northLand(dx, dn, d) {
  const edge = lerp(-14, 3, smooth(-14, 0, d));
  if (d <= 0) return edge;
  const cap = Math.exp(-(((dx + 1850) / 650) ** 2));
  const city = 3 + Math.min(d, 4500) * 0.065 * (1 - 0.75 * cap) + Math.max(0, d - 4500) * 0.03;
  let env = smooth(2300, 7800, d) * 900 + smooth(9000, 16000, d) * 520;
  let spire = 0;
  for (const p of PEAKS) {
    const ex = (dx - p[0]) / p[3], ey = (dn - p[1]) / p[3], q = ex * ex + ey * ey;
    if (q > 12) continue;
    if (p[3] < 500) spire = Math.max(spire, p[2] * Math.exp(-q));
    else env = Math.max(env, p[2] * 1.3 * Math.exp(-q * 0.55) * smooth(1500, 5000, d));
  }
  for (const v of VALLEYS) env *= 1 - 0.45 * Math.exp(-(((dx - v) / 900) ** 2)) * smooth(2500, 5000, d);
  const r = ridged(dx / 2700, dn / 2700, 6);
  const m = env * (0.38 + 0.62 * r) + env * 0.05 * (vnoise(dx / 170, dn / 170) - 0.5);
  return Math.max(edge, smax(city, smax(m, spire, 60), 120));
}

export function inPark(dx, dn) {
  const px = (dx + 2300) / 780, py = (dn - 1120) / 800;
  return px * px + py * py;
}

// Metres above the water, negative under it; dx east and dn north of the eye.
export function landHeight(dx, dn) {
  let h = -14;
  const inS = shoreS(dx) - dn;
  if (inS > -14) h = lerp(-14, 3.5, smooth(-5, 0, inS)) + clamp(inS, 0, 600) * 0.025;
  const e = inPark(dx, dn);
  if (e < 1.15) {
    const py = (dn - 1120) / 800;
    const ground = 6 + 52 * smooth(-0.6, 0.85, py) * smooth(1.05, 0.55, e);
    const canopy = 22 * (0.7 + 0.3 * vnoise(dx / 45, dn / 45));
    h = Math.max(h, lerp(-14, ground + canopy, smooth(1.12, 0.95, e)));
  }
  const d = dn - shoreN(dx);
  if (d > -14) h = Math.max(h, northLand(dx, dn, d));
  const bx = (dx + 16500) / 3200, by = (dn - 5200) / 2600, b = bx * bx + by * by;
  if (b < 1.1) h = Math.max(h, lerp(-14, 80 + 640 * Math.exp(-b * 2.2) * (0.8 + 0.2 * ridged(dx / 2000, dn / 2000, 3)), smooth(1.08, 0.9, b)));
  return h;
}

// What covers the ground: [town, forest, near lawn, seawall path], each 0..1.
export function landKind(dx, dn, h) {
  const d = dn - shoreN(dx), inS = shoreS(dx) - dn;
  const town = d > 0 ? smooth(2600, 1200, d) * smooth(480, 300, h) * (1 - 0.8 * Math.exp(-(((dx + 1850) / 500) ** 2))) : smooth(30, -20, inS - 900);
  const park = smooth(1.05, 0.9, inPark(dx, dn));
  const near = smooth(900, 500, Math.hypot(dx, dn)) * (1 - park);
  const lawn = smooth(0, 14, inS) * near;
  const path = smooth(0, 1.5, inS) * smooth(7.5, 5.5, inS) * near;
  return [clamp(town * (1 - park)), clamp(Math.max(park, 1 - town)), lawn, path];
}

export const BRIDGE = { cx: -2050, cn: 2150, az: 12 * RAD, main: 236, anchor: 423, north: 1250, south: -900, top: 111 };

export function deckHeight(s) {
  if (s < -BRIDGE.anchor) return 66 - 0.000033 * BRIDGE.anchor ** 2;
  if (s <= BRIDGE.anchor) return 66 - 0.000033 * s * s;
  return 66 - 0.000033 * BRIDGE.anchor ** 2 - (s - BRIDGE.anchor) * 0.052;
}

export function cableHeight(s) {
  const a = Math.abs(s), m = BRIDGE.main;
  if (a <= m) return deckHeight(0) + 4 + (BRIDGE.top - deckHeight(0) - 4) * (a / m) ** 2;
  const f = clamp((a - m) / (BRIDGE.anchor - m));
  return lerp(BRIDGE.top, deckHeight(BRIDGE.anchor) + 2, f) - 14 * f * (1 - f);
}

export function bridgePoint(s, side = 0, out = [0, 0]) {
  const ax = Math.sin(BRIDGE.az), an = Math.cos(BRIDGE.az);
  out[0] = BRIDGE.cx + ax * s + an * side;
  out[1] = BRIDGE.cn + an * s - ax * side;
  return out;
}

export const CRUISE = [[815, 330], [640, 760], [-150, 1290], [-1150, 1830], [-2050, 2150], [-2950, 2160], [-4400, 1900]];
export const FERRY = [[880, 300], [770, 900], [540, 1700], [410, 2225]];

function pathInfo(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return cum;
}
const PATHS = new Map();

// Catmull-Rom by distance along the route: out = [dx, dn, heading (radians from north), metres].
export function along(path, u, out = [0, 0, 0, 0]) {
  let cum = PATHS.get(path);
  if (!cum) { cum = pathInfo(path); PATHS.set(path, cum); }
  const total = cum[cum.length - 1], s = clamp(u) * total;
  let i = 0;
  while (i < path.length - 2 && cum[i + 1] < s) i++;
  const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1);
  const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(path.length - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  for (let c = 0; c < 2; c++) {
    out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
  }
  const gx = 0.5 * ((-p0[0] + p2[0]) + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t + 3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t2);
  const gn = 0.5 * ((-p0[1] + p2[1]) + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t + 3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t2);
  out[2] = Math.atan2(gx, gn);
  out[3] = total;
  return out;
}

const ease = t => t * t * (3 - 2 * t);

// Legs: [start, end, from u, to u, half turns from, to], so a ship swings round at the berth instead of flipping.
function timetable(path, legs, cycle, sec, out) {
  const t = ((sec % cycle) + cycle) % cycle;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i], a = L[0], b = L[1], u0 = L[2], u1 = L[3], r0 = L[4], r1 = L[5];
    if (t < a || t >= b) continue;
    out.on = u0 >= 0 ? 1 : 0;
    if (!out.on) return out;
    const raw = (t - a) / (b - a), f = ease(raw), u = lerp(u0, u1, f);
    along(path, u, A);
    out.dx = A[0]; out.dn = A[1];
    out.heading = A[2] + lerp(r0, r1, raw) * Math.PI;
    out.course = A[2] + (u1 < u0 ? Math.PI : 0);
    out.speed = u0 === u1 ? 0 : Math.abs(u1 - u0) * A[3] * 6 * raw * (1 - raw) / (b - a);
    out.alt = 0; out.pitch = 0; out.roll = 0; out.water = 1;
    return out;
  }
  out.on = 0;
  return out;
}
const A = [0, 0, 0, 0];
export const makeVessel = () => ({ on: 0, dx: 0, dn: 0, heading: 0, course: 0, speed: 0, alt: 0, pitch: 0, roll: 0, water: 1 });

export const CRUISE_CYCLE = 3600, FERRY_CYCLE = 1800;
const CRUISE_LEGS = [[0, 420, 0, 0, 0.5, 0], [420, 1620, 0, 1, 0, 0], [1620, 2000, -1, -1, 0, 0], [2000, 3200, 1, 0, 1, 1], [3200, 3600, 0, 0, 1, 0.5]];
const FERRY_LEGS = [[0, 150, 0, 0, 0, 0], [150, 870, 0, 1, 0, 0], [870, 1050, 1, 1, 0, 0], [1050, 1770, 1, 0, 0, 0], [1770, 1800, 0, 0, 0, 0]];
export const cruiseAt = (sec, out = makeVessel()) => timetable(CRUISE, CRUISE_LEGS, CRUISE_CYCLE, sec, out);
export const ferryAt = (sec, out = makeVessel()) => timetable(FERRY, FERRY_LEGS, FERRY_CYCLE, sec, out);

// A landing is a take-off played backwards on a mirrored route, so it comes in from the other side.
export const PLANE_CYCLE = 300, PLANE_RUN = 100;
export function floatplaneAt(sec, out = makeVessel()) {
  const k = Math.floor(sec / PLANE_CYCLE), t = sec - k * PLANE_CYCLE;
  if (t >= PLANE_RUN) { out.on = 0; return out; }
  const landing = ((k % 2) + 2) % 2 === 1;
  takeoff(landing ? PLANE_RUN - t : t, out);
  if (landing) { out.dx = 500 - out.dx; out.heading = Math.PI - out.heading; out.pitch = -out.pitch * 0.6; }
  out.course = out.heading;
  out.on = 1;
  return out;
}

function takeoff(t, out) {
  const x0 = 250, n0 = 330, h0 = -75 * RAD;
  let s, alt = 0, psi = h0, dx, dn, roll = 0, pitch = 0, v;
  if (t < 18) {
    s = 1.1 * t * t; v = 2.2 * t;
    dx = x0 + Math.sin(h0) * s; dn = n0 + Math.cos(h0) * s;
    pitch = smooth(10, 18, t) * 0.08;
  } else {
    const sA = 1.1 * 18 * 18;
    const ta = Math.min(t, 30) - 18;
    s = sA + 40 * ta; v = 40;
    dx = x0 + Math.sin(h0) * s; dn = n0 + Math.cos(h0) * s;
    alt = 5 * ta; pitch = 0.12;
    if (t > 30) {
      const w = 2.2 * RAD, tb = Math.min(t, 62) - 30;
      psi = h0 + w * tb;
      dx += (40 / w) * (Math.cos(h0) - Math.cos(psi));
      dn += (40 / w) * (Math.sin(psi) - Math.sin(h0));
      alt += 4 * tb; roll = 0.35 * smooth(0, 4, tb) * (1 - smooth(28, 32, tb)); pitch = 0.09;
      if (t > 62) {
        const tc = t - 62;
        dx += Math.sin(psi) * 42 * tc; dn += Math.cos(psi) * 42 * tc;
        alt += 4 * tc; pitch = 0.07;
      }
    }
  }
  out.dx = dx; out.dn = dn; out.alt = alt; out.heading = psi; out.roll = roll; out.pitch = pitch;
  out.speed = v; out.water = alt < 1 ? 1 : 0;
  return out;
}

// Towers keep clear of the view straight out to the North Shore.
export function towerLayout(seed = 7) {
  const rand = rng(seed), out = [];
  const near = (x, z, r) => out.some(t => Math.hypot(t.x - x, t.z - z) < r + Math.max(t.w, t.d) * 0.6);
  const put = (dx, dn, w, d, h, rot, style, extra = {}) => {
    const base = Math.max(1, landHeight(dx, dn));
    out.push({ x: wx(dx), z: wz(dn), w, d, h, rot, style, base: WATER_Y + base - 3, seed: rand(), ...extra });
  };
  out.push({ x: 11, z: 6, w: 23, d: 42, h: -0.6 - WATER_Y - 3, rot: 0, style: 8, base: WATER_Y + 3, seed: 0.37, own: true });
  const grid = 36 * RAD;
  const side = (n, dx0, dx1, minAz, sign) => {
    for (let i = 0, made = 0; i < 2600 && made < n; i++) {
      const dx = sign * lerp(dx0, dx1, Math.pow(rand(), 0.85)), dn = lerp(-420, shoreS(dx) - 28, Math.pow(rand(), 0.7));
      const az = Math.atan2(dx, dn) / RAD;
      if (sign * az < minAz || Math.hypot(dx, dn) < 150) continue;
      const lh = landHeight(dx, dn);
      if (lh < 2 || lh > 30 || inPark(dx, dn) < 1.2 || shoreS(dx) - dn < 24) continue;
      const shoreSide = smooth(240, 40, shoreS(dx) - dn);
      const w = 20 + rand() * 16, d = 18 + rand() * 12, h = 42 + Math.pow(rand(), 1.4) * 125 + shoreSide * 35 * rand();
      if (near(wx(dx), wz(dn), Math.max(w, d) * 0.7 + 8)) continue;
      const style = rand() < 0.62 ? 0 : rand() < 0.6 ? 1 : 2;
      put(dx, dn, w, d, h, grid + (rand() - 0.5) * 0.1, style);
      if (rand() < 0.45) put(dx, dn, w * 1.7, d * 1.6, 9 + rand() * 9, grid, 3);
      if (h > 90 && rand() < 0.5) {
        const last = out[out.length - (out[out.length - 1].style === 3 ? 2 : 1)];
        out.push({ ...last, w: last.w * 0.72, d: last.d * 0.72, base: last.base + last.h, h: 6 + rand() * 12, seed: rand() });
      }
      made++;
    }
  };
  side(78, 170, 3000, 52, -1);
  side(70, 170, 2300, 47, 1);
  for (let i = 0, made = 0; i < 4000 && made < 190; i++) {
    const sign = rand() < 0.5 ? -1 : 1, dx = sign * lerp(150, 2600, Math.pow(rand(), 0.8)), dn = lerp(-450, shoreS(dx) - 20, rand());
    const lh = landHeight(dx, dn);
    if (Math.abs(Math.atan2(dx, dn)) / RAD < 50 || Math.hypot(dx, dn) < 120 || lh < 2 || lh > 30 || inPark(dx, dn) < 1.2) continue;
    const w = 18 + rand() * 30, d = 16 + rand() * 26;
    if (near(wx(dx), wz(dn), Math.max(w, d) * 0.55)) continue;
    put(dx, dn, w, d, 8 + rand() * 18, grid + (rand() - 0.5) * 0.06, rand() < 0.5 ? 3 : 1);
    made++;
  }
  for (let i = 0, made = 0; i < 3000 && made < 120; i++) {
    const dx = lerp(-1300, 4200, rand()), dn = shoreN(dx) + 30 + Math.pow(rand(), 1.5) * 1500, lh = landHeight(dx, dn);
    if (lh < 2 || lh > 160 || near(wx(dx), wz(dn), 22)) continue;
    put(dx, dn, 14 + rand() * 22, 12 + rand() * 18, 6 + rand() * 12, 0, rand() < 0.6 ? 3 : 1);
    made++;
  }
  // Harbour Centre, the round-topped tower everyone knows on the east side.
  put(1150, 110, 26, 26, 146, grid, 1, { crown: true });
  out.push({ x: wx(1150), z: wz(110), w: 44, d: 44, h: 9, rot: 0, style: 2, base: WATER_Y + Math.max(1, landHeight(1150, 110)) - 3 + 140, seed: 0.5 });
  put(700, 300, 62, 210, 16, 0, 5);
  for (let i = 0, made = 0; i < 1500 && made < 34; i++) {
    const dx = lerp(-600, 1500, rand()), dn = shoreN(dx) + 40 + Math.pow(rand(), 1.6) * 900;
    const lh = landHeight(dx, dn);
    if (lh < 2 || lh > 140 || near(wx(dx), wz(dn), 30)) continue;
    const lonsdale = Math.exp(-(((dx - 450) / 420) ** 2));
    put(dx, dn, 18 + rand() * 14, 16 + rand() * 12, 28 + rand() * 50 + lonsdale * 60 * rand(), 0, rand() < 0.5 ? 0 : 1);
    made++;
  }
  for (let i = 0, made = 0; i < 800 && made < 14; i++) {
    const dx = lerp(-3700, -2700, rand()), dn = shoreN(dx) + 30 + rand() * 380;
    if (landHeight(dx, dn) < 2 || near(wx(dx), wz(dn), 25)) continue;
    put(dx, dn, 16 + rand() * 10, 14 + rand() * 10, 22 + rand() * 40, 0, rand() < 0.5 ? 1 : 0);
    made++;
  }
  // Rooftops: the taller towers get a plant room, and now and then an antenna mast. They draw on their own random
  // numbers, so adding them never moves a building.
  const roof = rng(seed + 991), tops = [];
  for (const t of out) {
    if (t.own || t.style > 2 || t.h < 60) continue;
    const top = t.base + t.h, r = roof();
    if (r < 0.65) tops.push({ ...t, w: t.w * (0.3 + roof() * 0.15), d: t.d * (0.28 + roof() * 0.12), base: top, h: 3 + roof() * 3, style: 2, seed: roof() });
    if (r < 0.16 && t.h > 100) tops.push({ ...t, w: 1.4, d: 1.4, base: top, h: 14 + roof() * 18, style: 2, seed: roof() });
  }
  return out.concat(tops);
}

// Every steady light point: [kind, dx, height above water, dn, r, g, b, size, phase].
// Kinds: 0 street, 1 port, 2 ski run, 3 tower beacon, 4 seawall lamp, 5 bridge necklace, 6 Grouse chalet.
export function lightLayout(seed = 11, count = 4000, towers = []) {
  const rand = rng(seed), L = [];
  const warm = () => (rand() < 0.55 ? [1.0, 0.62, 0.3] : [1.0, 0.9, 0.78]);
  const add = (kind, dx, h, dn, c, size, ph = rand()) => L.push([kind, dx, h, dn, c[0], c[1], c[2], size, ph]);
  const streets = Math.floor(count * 0.72);
  for (let i = 0, made = 0; i < streets * 6 && made < streets; i++) {
    const west = rand() < 0.28;
    const dx = west ? lerp(-9000, -2500, rand()) : lerp(-1500, 4800, rand());
    let d = Math.pow(rand(), 1.6) * (west ? 2600 : 3600);
    const ew = rand() < 0.5;
    let x = dx;
    if (ew) d = Math.round(d / 85) * 85 + (rand() - 0.5) * 6; else x = Math.round(dx / 120) * 120 + (rand() - 0.5) * 6;
    const dn = shoreN(x) + 25 + d, h = landHeight(x, dn);
    if (h < 2 || h > (west ? 420 : 470) || inPark(x, dn) < 1.1) continue;
    add(0, x, h + 6, dn, warm(), 2.6 + rand() * 1.4);
    made++;
  }
  for (let i = 0; i < count * 0.08; i++) {
    const dx = lerp(1300, 5200, rand()), dn = shoreN(dx) + 10 + rand() * 260;
    const h = landHeight(dx, dn);
    if (h > 1) add(1, dx, h + 10 + rand() * 25, dn, [1.0, 0.95, 0.88], 4 + rand() * 3);
  }
  for (let i = 0; i < count * 0.1; i++) {
    const s = rand() < 0.5 ? -1 : 1, dx = s * lerp(250, 2600, rand()), dn = lerp(-300, shoreS(dx) - 15, rand());
    const h = landHeight(dx, dn);
    if (h > 1 && h < 40 && Math.atan2(dx, dn) * s > 0.75) add(0, dx, h + 6, dn, warm(), 2.4);
  }
  for (let dx = -560; dx <= 680; dx += 26) {
    const dn = shoreS(dx) - 7;
    if (landHeight(dx, dn) > 1) add(4, dx, landHeight(dx, dn) + 4.2, dn, [1.0, 0.82, 0.6], 1.1);
  }
  const [gx, gn] = GROUSE;
  for (let r = 0; r < 6; r++) {
    const startX = gx - 520 + r * 210 + (rand() - 0.5) * 60, startN = gn - 650 + (rand() - 0.5) * 200;
    let x = startX, n = startN;
    const wob = (rand() - 0.5) * 0.6;
    for (let s = 0; s < 34; s++) {
      const h = landHeight(x, n);
      if (h < 780) break;
      add(2, x, h + 5, n, [0.95, 0.96, 1.0], 5.5, rand());
      n -= 32; x += Math.sin(s * 0.25 + r) * 9 + wob * 12;
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = gx - 300 + (rand() - 0.5) * 260, n = gn - 900 + (rand() - 0.5) * 160;
    add(6, x, landHeight(x, n) + 8, n, [1.0, 0.8, 0.55], 5);
  }
  // The red aviation light on each tall tower sits on its highest point, above any plant room or mast on the roof.
  const peak = new Map();
  for (const t of towers) { const k = `${t.x},${t.z}`; peak.set(k, Math.max(peak.get(k) ?? -Infinity, t.base + t.h)); }
  for (const t of towers) {
    if (t.h > 95 && t.style !== 3 && !t.own) {
      add(3, t.x - EYE[0], peak.get(`${t.x},${t.z}`) - WATER_Y + 2, EYE[2] - t.z, [1.0, 0.08, 0.04], 2.2, rand());
    }
  }
  const P = [0, 0];
  for (const side of [-8.5, 8.5]) {
    for (let s = -BRIDGE.anchor; s <= BRIDGE.anchor; s += 9) {
      bridgePoint(s, side, P);
      add(5, P[0], cableHeight(s) + 0.6, P[1], [0.9, 0.95, 1.0], 1.9, s / 50);
    }
  }
  return L;
}

export const DOCKS = [150, 204, 258];

// Moored boats in the marina off the seawall: [dx, dn, length, beam, height, which end the bow is, dark hull].
export function marinaLayout(seed = 5) {
  const rand = rng(seed), out = [];
  for (const dock of DOCKS) {
    for (let i = 0; i < 24; i++) {
      const dx = -470 + i * 17 + (rand() - 0.5) * 2;
      if (rand() < 0.25 || shoreS(dx) > dock - 34) continue;
      const len = 8 + rand() * 10, side = rand() < 0.5 ? -1 : 1;
      out.push([dx, dock + side * (len / 2 + 2.2), len, 2.6 + len * 0.17, 1.1 + rand() * 0.6, side, rand() < 0.22 ? 1 : 0]);
    }
  }
  return out;
}

export function tileNoise(size, period, octaves, seed) {
  const out = new Float32Array(size * size);
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, p = period;
      for (let o = 0; o < octaves; o++) {
        const fx = (x / size) * p, fy = (y / size) * p, i = Math.floor(fx), j = Math.floor(fy);
        const u = fx - i, w = fy - j, su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
        const s = (seed + o * 101) * 7919, i0 = ((i % p) + p) % p, j0 = ((j % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
        const a = ihash(i0 + s, j0), b = ihash(i1 + s, j0), c = ihash(i0 + s, j1), d = ihash(i1 + s, j1);
        v += amp * (a + (b - a) * su + (c - a) * sw + (a - b - c + d) * su * sw);
        amp *= 0.5; p *= 2;
      }
      const i = y * size + x;
      out[i] = v;
      if (out[i] < lo) lo = out[i];
      if (out[i] > hi) hi = out[i];
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo);
  return out;
}
