// The telescope's sums, kept free of three and the page so the unit tests can run them.
import { DAY } from './calendar.js';
import { eqToWorld, moonView, clamp, lerp, EYE, WATER_Y, landHeight, landKind, shoreN, inPark } from './outside.js';

const RAD = Math.PI / 180;

// Fields of view in degrees: the city and mountains are built down to `land`, only the sky goes to `sky`.
export const FOV = { start: 16, wide: 24, land: 1.5, sky: 0.15 };
// The planets are drawn this many times their real size, so their bands, rings and phases read in the eyepiece.
export const PLANET_SCALE = 4;
// How far the mount turns: about 97 degrees either side of north, from just under level to well up the sky.
export const LIMIT = { yaw: 1.7, low: -0.05, high: 1.2 };

export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// The mount cannot turn through the house behind it, so from one aim to another is always round by the north.
export const turn = (from, to) => wrap(to) - wrap(from);

// A direction (x east, y up, z = minus north) as the mount's two angles: yaw from north towards east, pitch above level.
export function aimOf(x, y, z) {
  return { yaw: Math.atan2(x, -z), pitch: Math.atan2(y, Math.hypot(x, z)) };
}
export const reachable = a => Math.abs(a.yaw) <= LIMIT.yaw && a.pitch >= LIMIT.low && a.pitch <= LIMIT.high;
export const clampAim = a => ({ yaw: clamp(a.yaw, -LIMIT.yaw, LIMIT.yaw), pitch: clamp(a.pitch, LIMIT.low, LIMIT.high) });

// An eyepiece with a 50 degree apparent field: the magnification for a true field.
export const power = fov => Math.max(1, Math.round(50 / fov));

// Frames a thing `size` metres across at `dist` metres so it fills a little under half the view.
export function fovFor(size, dist) {
  const ang = 2 * Math.atan(size / 2 / Math.max(dist, 1)) / RAD;
  return clamp(ang * 2.4, FOV.land, FOV.start);
}

// The deepest zoom on what is in the middle: planets take the high power, the moon stops when it fills the view.
export const zoomFloor = stop => (stop?.kind === 'sky' ? stop.min ?? FOV.sky : FOV.land);
export const clampFov = (fov, floor) => clamp(fov, floor, FOV.wide);
// Eased in ratios, so zooming in and out feel the same.
export function easeFov(fov, target, dt, tau = 0.12) {
  return fov * Math.pow(target / fov, 1 - Math.exp(-Math.max(dt, 0) / tau));
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Never through the house, wider mid-swing so the eye can follow, eased at both ends like a motor mount.
export function slewPlan(from, to) {
  const dyaw = turn(from.yaw, to.yaw), dpitch = to.pitch - from.pitch;
  const angle = Math.hypot(dyaw * Math.cos((from.pitch + to.pitch) / 2), dpitch);
  const mid = Math.max(from.fov, to.fov);
  // How much wider the field gets halfway: enough to keep both ends of a long swing in sight, never past the widest.
  const want = clamp(angle / RAD * 0.7, mid, FOV.wide);
  return { from: { ...from }, dyaw, dpitch, toFov: to.fov, hop: Math.log(want / mid), time: clamp(0.55 + Math.sqrt(angle / RAD) * 0.16, 0.55, 1.9) };
}
export function slewAt(plan, t, out = {}) {
  const k = clamp(t / plan.time), e = easeInOut(k);
  out.yaw = wrap(plan.from.yaw + plan.dyaw * e);
  out.pitch = plan.from.pitch + plan.dpitch * e;
  out.fov = Math.exp(lerp(Math.log(plan.from.fov), Math.log(plan.toFov), e) + plan.hop * Math.sin(Math.PI * e));
  out.done = k >= 1;
  return out;
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function bearing(yaw) {
  const deg = ((Math.round(yaw / RAD) % 360) + 360) % 360;
  return `${deg}° ${POINTS[Math.round(deg / 22.5) % 16]}`;
}
export function altitude(pitch) {
  const d = pitch / RAD;
  return `${d < 0 ? '-' : '+'}${Math.abs(d).toFixed(1)}°`;
}
export function distance(m) {
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  if (m < 1e5) return `${(m / 1000).toFixed(1)} km`;
  if (m < 1e9) return `${Math.round(m / 1000).toLocaleString('en-CA')} km`;
  return `${Math.round(m / 1e9).toLocaleString('en-CA')} million km`;
}

// ---------- the planets ----------
// JPL (Standish, 1800 to 2050): a (au), e, I, L, long. of perihelion and of the node (deg), then rates per century.
const ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};
// Magnitude law (at 1 au, then per degree of phase), disc in arcsec at 1 au, flattening, pole (RA, Dec, J2000).
export const PLANETS = [
  { id: 'mercury', name: 'Mercury', mag: [-0.42, 0.038, -0.000273, 0.000002], arc: 6.74, flat: 1, pole: [281.01, 61.42] },
  { id: 'venus', name: 'Venus', mag: [-4.4, 0.0009, 0.000239, -0.00000065], arc: 16.92, flat: 1, pole: [272.76, 67.16] },
  { id: 'mars', name: 'Mars', mag: [-1.52, 0.016, 0, 0], arc: 9.36, flat: 0.994, pole: [317.68, 52.89] },
  { id: 'jupiter', name: 'Jupiter', mag: [-9.4, 0.005, 0, 0], arc: 196.94, flat: 0.935, pole: [268.06, 64.5] },
  { id: 'saturn', name: 'Saturn', mag: [-8.88, 0.044, 0, 0], arc: 165.6, flat: 0.902, pole: [40.59, 83.54] },
];
const OBLIQ = 23.43928 * RAD, AU = 1.495978707e11;

export const julian = date => date.getTime() / DAY + 2440587.5;

function helio(id, T, out) {
  const [b, r] = ELEMENTS[id];
  const a = b[0] + r[0] * T, e = b[1] + r[1] * T, I = (b[2] + r[2] * T) * RAD, L = b[3] + r[3] * T, peri = b[4] + r[4] * T, node = b[5] + r[5] * T;
  const w = (peri - node) * RAD, O = node * RAD;
  const M = wrap((L - peri) * RAD);
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  out[0] = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  out[1] = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  out[2] = sw * sI * xp + cw * sI * yp;
  return out;
}
// Ecliptic (J2000) to the sky's equatorial frame, as right ascension and declination.
function radec(x, y, z) {
  const ye = y * Math.cos(OBLIQ) - z * Math.sin(OBLIQ), ze = y * Math.sin(OBLIQ) + z * Math.cos(OBLIQ);
  return [Math.atan2(ye, x), Math.atan2(ze, Math.hypot(x, ye))];
}
export function poleDir(ra, dec, lst, out = [0, 0, 0]) { return eqToWorld(ra * RAD, dec * RAD, lst, out); }

// Like the moon, a planet in the southern sky is folded north, the way the balcony faces; `el` and `az` stay true.
export function planets(date, lst) {
  const T = (julian(date) - 2451545.0) / 36525, E = helio('earth', T, [0, 0, 0]), P = [0, 0, 0];
  const sunW = eqToWorld(...radec(-E[0], -E[1], -E[2]), lst, [0, 0, 0]);
  return PLANETS.map(p => {
    helio(p.id, T, P);
    const g = [P[0] - E[0], P[1] - E[1], P[2] - E[2]];
    const r = Math.hypot(...P), dist = Math.hypot(...g), R = Math.hypot(...E);
    const phase = Math.acos(clamp((r * r + dist * dist - R * R) / (2 * r * dist), -1, 1));
    const i = phase / RAD, k = p.mag;
    const [ra, dec] = radec(...g), [lra, ldec] = radec(-P[0], -P[1], -P[2]);
    const trueDir = eqToWorld(ra, dec, lst, [0, 0, 0]), lightTrue = eqToWorld(lra, ldec, lst, [0, 0, 0]);
    const view = moonView(trueDir, lightTrue, new Array(6));
    // The pole turns over with the fold, as the moon's light does.
    const poleTrue = poleDir(p.pole[0], p.pole[1], lst), pole = [poleTrue[0], poleTrue[1], trueDir[2] > 0 ? -poleTrue[2] : poleTrue[2]];
    const elong = Math.acos(clamp(trueDir[0] * sunW[0] + trueDir[1] * sunW[1] + trueDir[2] * sunW[2], -1, 1)) / RAD;
    // How far the earth sits above the planet's equator (Saturn's rings open by this).
    const tilt = Math.asin(clamp(-(poleTrue[0] * trueDir[0] + poleTrue[1] * trueDir[1] + poleTrue[2] * trueDir[2]), -1, 1));
    let mag = k[0] + 5 * Math.log10(r * dist) + k[1] * i + k[2] * i * i + k[3] * i * i * i;
    // Saturn's rings add their own light as they open.
    if (p.id === 'saturn') mag += -2.6 * Math.abs(Math.sin(tilt)) + 1.25 * Math.sin(tilt) ** 2;
    return {
      id: p.id, name: p.name, dir: view.slice(0, 3), light: view.slice(3, 6), pole, tilt,
      el: Math.asin(trueDir[1]) / RAD, az: Math.atan2(trueDir[0], -trueDir[2]) / RAD, elong, mag,
      au: dist, metres: dist * AU, radius: (p.arc / dist / 2) * RAD / 3600, flat: p.flat, phase,
    };
  });
}

// Up, out of the sun's glare, and bright enough for the sky (by day only Venus, or Jupiter at its best).
export function planetShows(p, sunEl) {
  if (p.el < 1.5 || p.elong < 10) return false;
  const limit = sunEl < -9 ? 6 : sunEl < -4 ? 1.5 : sunEl < 0 ? 0 : p.elong > 25 ? -2.6 : -99;
  return p.mag <= limit;
}

// Jupiter's four big moons by Meeus' short method: the angle round each orbit, the radius in Jupiter radii.
export const GALILEAN = [['Io', 5.9], ['Europa', 9.4], ['Ganymede', 15.0], ['Callisto', 26.4]];
export function galilean(date) {
  const d = julian(date) - 2451545.0;
  const V = (172.74 + 0.00111588 * d) * RAD, M = (357.529 + 0.9856003 * d) * RAD, N = (20.02 + 0.0830853 * d + 0.329 * Math.sin(V)) * RAD;
  const J = (66.115 + 0.9025179 * d - 0.329 * Math.sin(V)) * RAD;
  const A = 1.915 * Math.sin(M) + 0.02 * Math.sin(2 * M), B = 5.555 * Math.sin(N) + 0.168 * Math.sin(2 * N);
  const K = J + (A - B) * RAD;
  const R = 1.00014 - 0.01671 * Math.cos(M) - 0.00014 * Math.cos(2 * M), r = 5.20872 - 0.25208 * Math.cos(N) - 0.00611 * Math.cos(2 * N);
  const delta = Math.sqrt(r * r + R * R - 2 * r * R * Math.cos(K)), psi = Math.asin(R / delta * Math.sin(K));
  const t = d - delta / 173;
  const base = [[163.8069, 203.4058646], [358.414, 101.2916335], [5.7176, 50.234518], [224.8092, 21.48798]];
  return base.map(([u0, n], i) => ({ name: GALILEAN[i][0], u: wrap((u0 + n * t) * RAD + psi - B * RAD), r: GALILEAN[i][1] }));
}

// ---------- what the view holds ----------
// The nearest stop to the middle of the view, if it is in the eyepiece at all (a share `within` of the field's radius).
export function inView(stops, yaw, pitch, fov, within = 1) {
  let best = null, bestD = Infinity;
  const half = fov * RAD / 2 * within;
  for (const s of stops) {
    const d = Math.hypot(wrap(s.yaw - yaw) * Math.cos(pitch), s.pitch - pitch);
    if (d < half && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

// A stop behind the downtown towers is no stop; a tower is a box turned `rot` about the vertical, foot at `base`.
export function clearLine(a, b, towers) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
  for (const t of towers) {
    if (t.own) continue;
    // Far off the line seen from above, it cannot be in the way.
    const ox = t.x - a[0], oz = t.z - a[2], along = (ox * dx + oz * dz) / len;
    if (along < -t.w - t.d || along > len + t.w + t.d || Math.abs(ox * dz - oz * dx) / len > (t.w + t.d) * 0.71) continue;
    const c = Math.cos(t.rot || 0), s = Math.sin(t.rot || 0);
    const p0 = [c * -ox - s * -oz, a[1], s * -ox + c * -oz], d = [c * dx - s * dz, dy, s * dx + c * dz];
    const lo = [-t.w / 2, t.base, -t.d / 2], hi = [t.w / 2, t.base + t.h, t.d / 2];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 3 && t0 <= t1; i++) {
      if (Math.abs(d[i]) < 1e-12) { if (p0[i] < lo[i] || p0[i] > hi[i]) t1 = -1; continue; }
      let u = (lo[i] - p0[i]) / d[i], v = (hi[i] - p0[i]) / d[i];
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    }
    if (t0 <= t1) return false;
  }
  return true;
}

// Whether the straight line from `a` to `b` stays over the ground, Stanley Park's trees and the North Shore included.
export function clearGround(a, b) {
  for (let k = 0.02; k < 0.995; k += 0.005) {
    const x = a[0] + (b[0] - a[0]) * k, z = a[2] + (b[2] - a[2]) * k;
    if (a[1] + (b[1] - a[1]) * k < WATER_Y + landHeight(x - EYE[0], EYE[2] - z)) return false;
  }
  return true;
}
// Whether something in the sky, in direction `d` from `a`, clears the towers (all within 6 km) and the ground (28 km).
export function clearSky(a, d, towers) {
  const far = s => [a[0] + d[0] * s, a[1] + d[1] * s, a[2] + d[2] * s];
  return clearLine(a, far(8000), towers) && clearGround(a, far(28000));
}

// ---------- the close-up city ----------
// Streets on the grid the slopes are drawn on: 120 by 85 m blocks, each two rows of seven lots.
export const BLOCK = [120, 85];
export function houseLots() {
  const lots = [];
  for (let i = -31; i <= 41; i++) for (let j = -60; j <= -27; j++) {
    const cx = (i + 0.5) * BLOCK[0], cz = (j + 0.5) * BLOCK[1];
    for (const row of [-1, 1]) for (let k = 0; k < 7; k++) lots.push([cx - 45 + k * 15, cz + row * 18.5, row]);
  }
  const d2 = l => (l[0] - EYE[0]) ** 2 + (l[1] - EYE[2]) ** 2;
  return lots.sort((a, b) => d2(a) - d2(b));
}

// Towers by 60 m square, so a lot can ask what stands near it.
export function towerGrid(towers) {
  const grid = new Map();
  for (const t of towers) {
    const r = Math.max(t.w, t.d) / 2 + 14;
    for (let i = Math.floor((t.x - r) / 60); i <= Math.floor((t.x + r) / 60); i++) for (let j = Math.floor((t.z - r) / 60); j <= Math.floor((t.z + r) / 60); j++) {
      const k = `${i},${j}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(t);
    }
  }
  return grid;
}

// A lot's house, false for a garden, null for none; its walls reach 6 m down, so a slope shows a basement.
export function houseOn(lot, rand, grid) {
  const [x, z] = lot, dx = x - EYE[0], dn = EYE[2] - z;
  const r = [rand(), rand(), rand(), rand(), rand(), rand(), rand()];
  if (dn - shoreN(dx) < 45 || inPark(dx, dn) < 1.3) return null;
  const h = landHeight(dx, dn);
  if (h < 3 || h > 430 || landKind(dx, dn, h)[0] < 0.45 + 0.3 * r[0]) return null;
  const hs = [landHeight(dx - 6, dn - 6), landHeight(dx + 6, dn - 6), landHeight(dx - 6, dn + 6), landHeight(dx + 6, dn + 6)];
  if (Math.max(...hs) - Math.min(...hs) > 8) return null;
  for (const t of grid.get(`${Math.floor(x / 60)},${Math.floor(z / 60)}`) || []) {
    if (Math.abs(x - t.x) < t.w / 2 + 9 && Math.abs(z - t.z) < t.d / 2 + 9) return null;
  }
  if (r[1] < 0.2) return false;
  return [x, WATER_Y + Math.min(h, ...hs), z, 9 + r[2] * 4, 8 + r[3] * 4, 5 + r[4] * 2.5, 1.6 + r[5] * 1.8, r[6] < 0.3 ? Math.PI / 2 : 0, rand()];
}

// Back-garden trees towards the block's middle, clear of the house; kind 0 a fir, 1 a broadleaf.
export function yardTrees(lot, house, rand) {
  const [x, z, row] = lot, out = [], n = house ? (rand() < 0.75 ? 1 : 2) : 3;
  for (let i = 0; i < n; i++) {
    const tx = x + (rand() - 0.5) * 11, tz = house ? z - row * (8.5 + rand() * 4) : z + (rand() - 0.5) * 16;
    const dx = tx - EYE[0], dn = EYE[2] - tz;
    out.push([tx, WATER_Y + landHeight(dx, dn) - 0.5, tz, 0.8 + rand() * 0.6, rand() < 0.55 ? 0 : 1]);
  }
  return out;
}
