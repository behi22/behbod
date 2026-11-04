// Room v2 runtime pieces: the world map desk mat, the pomodoro cube, the neon sign, the lounge wall prints,
// a window view that follows Vancouver's sun, weather and lights, and the holiday calendar from the profile README.
const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";
const params = new URLSearchParams(location.search);
const DAY = 864e5;
const D = (y, m, d) => Date.UTC(y, m - 1, d);

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------- Vancouver time, sun and moon (same maths as the profile README) ----------
export function vanTime(date) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date).forEach(p => { parts[p.type] = p.value; });
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour % 24, min: +parts.minute };
}
function sunElev(date) {
  const lat = 49.2827 * Math.PI / 180, lon = -123.1207;
  const jd = date.getTime() / DAY + 2440587.5, n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180, eps = (23.439 - 0.0000004 * n) * Math.PI / 180;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const ha = ((gmst * 15 + lon) * Math.PI / 180) - ra;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) * 180 / Math.PI;
}
export function skyAt(date) {
  if (params.has('sky')) return { phase: params.get('sky'), elev: { night: -30, dawn: -4, morning: 4, day: 40, golden: 4, dusk: -4 }[params.get('sky')] ?? -30 };
  const e = sunElev(date), rising = sunElev(new Date(date.getTime() + 15 * 60000)) > e;
  const phase = e < -10 ? 'night' : e < 0 ? (rising ? 'dawn' : 'dusk') : e < 8 ? (rising ? 'morning' : 'golden') : 'day';
  return { phase, elev: e };
}
function moonPhase(date) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  return (((date.getTime() - ref) / DAY) % syn + syn) % syn / syn;
}

// ---------- holidays: the README's calendar ----------
function nowruz(y) {
  const Y = (y - 2000) / 1000;
  const jde = 2451623.80984 + 365242.37404 * Y + 0.05169 * Y * Y - 0.00411 * Y ** 3 - 0.00057 * Y ** 4;
  const t = new Date((jde - 2440587.5) * DAY + 3.5 * 3600000);
  const day = D(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  return t.getUTCHours() >= 12 ? day + DAY : day;
}
const nthWeekday = (y, m, dow, nth) => { let t = D(y, m, 1); while (new Date(t).getUTCDay() !== dow) t += DAY; return t + (nth - 1) * 7 * DAY; };
const suri = y => { const n = nowruz(y); let t = n - DAY; while (new Date(t).getUTCDay() !== 3) t -= DAY; return t - DAY; };
const prideSunday = y => nthWeekday(y, 8, 1, 1) - DAY;
const LUNAR = { 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8] };
const H = (hot, a2) => ({ hot, a2 });
const EVENTS = [
  { id: 'birthday', pr: 0, span: y => [D(y, 3, 5), D(y, 3, 5)], greet: () => "it's my birthday", c: H('#ffd43b', '#b197fc') },
  { id: 'newyear', pr: 1, span: y => [D(y, 12, 31), D(y + 1, 1, 2)], greet: d => 'happy new year ' + (d.m === 12 ? d.y + 1 : d.y), c: H('#f5d06f', '#e9a8ff') },
  { id: 'valentines', pr: 1, span: y => [D(y, 2, 14), D(y, 2, 14)], greet: () => "happy valentine's day", c: H('#ff6b81', '#ffc9c9') },
  { id: 'realmadrid', pr: 1, span: y => [D(y, 3, 6), D(y, 3, 6)], greet: d => `hala madrid · ${d.y - 1902}`, c: H('#f2c14e', '#ffffff') },
  { id: 'pi', pr: 3, span: y => [D(y, 3, 14), D(y, 3, 14)], greet: () => 'happy π day', c: H('#63e6be', '#748ffc') },
  { id: 'suri', pr: 1, eve: 17, span: y => [suri(y), suri(y)], greet: () => 'chaharshanbe suri', c: H('#ff922b', '#ffd43b') },
  { id: 'sizdah', pr: 1, span: y => [nowruz(y) + 12 * DAY, nowruz(y) + 12 * DAY], greet: () => 'sizdah bedar', c: H('#8ce99a', '#74c0fc') },
  { id: 'nowruz', pr: 2, span: y => [nowruz(y), nowruz(y) + 11 * DAY], greet: () => 'happy nowruz', c: H('#ff8fb1', '#7bd88f') },
  { id: 'lunar', pr: 2, span: y => (LUNAR[y] ? [D(y, ...LUNAR[y]), D(y, ...LUNAR[y]) + 2 * DAY] : null), greet: () => 'happy lunar new year', c: H('#ff4d4d', '#ffd43b') },
  { id: 'earth', pr: 1, span: y => [D(y, 4, 22), D(y, 4, 22)], greet: () => 'happy earth day', c: H('#8ce99a', '#74c0fc') },
  { id: 'blossom', pr: 5, span: y => [D(y, 4, 1), D(y, 4, 21)], greet: () => 'cherry blossom season', c: H('#ff8fab', '#cdb4db') },
  { id: 'canada', pr: 1, span: y => [D(y, 7, 1), D(y, 7, 1)], greet: () => 'happy canada day', c: H('#ff4d4d', '#ffffff') },
  { id: 'lights', pr: 3, span: y => [D(y, 7, 25), D(y, 8, 1)], greet: () => 'celebration of light', c: H('#ffd43b', '#74c0fc') },
  { id: 'pride', pr: 2, span: y => [prideSunday(y) - DAY, prideSunday(y)], greet: () => 'happy pride', c: H('#ff8787', '#b197fc') },
  { id: 'programmers', pr: 1, span: y => { const t = D(y, 1, 1) + 255 * DAY; return [t, t]; }, greet: () => "happy programmers' day", c: H('#69db7c', '#38d9a9') },
  { id: 'thanksgiving', pr: 2, span: y => { const m = nthWeekday(y, 10, 1, 2); return [m - 2 * DAY, m]; }, greet: () => 'happy thanksgiving', c: H('#ff922b', '#ffd43b') },
  { id: 'halloween', pr: 2, span: y => [D(y, 10, 25), D(y, 10, 31)], greet: () => 'happy halloween', c: H('#ff6d00', '#b197fc') },
  { id: 'remembrance', pr: 1, span: y => [D(y, 11, 11), D(y, 11, 11)], greet: () => 'lest we forget', c: H('#e03131', '#ced4da') },
  { id: 'winter', pr: 5, span: y => [D(y, 12, 1), D(y, 12, 19)], greet: () => 'first snow', c: H('#a5d8ff', '#91a7ff') },
  { id: 'yalda', pr: 1, span: y => [D(y, 12, 20), D(y, 12, 21)], greet: () => 'happy yalda', c: H('#ff4d6d', '#ffd6a5') },
  { id: 'christmas', pr: 2, span: y => [D(y, 12, 22), D(y, 12, 30)], greet: () => 'happy holidays', c: H('#ff6b6b', '#8ce99a') },
];
export function holidayAt(date) {
  const v = vanTime(date), t = D(v.y, v.m, v.d);
  if (params.has('holiday')) { const e = EVENTS.find(x => x.id === params.get('holiday')); return e ? { ...e, text: e.greet(v) } : null; }
  const rank = e => (e.eve && v.h < e.eve ? e.pr + 10 : e.pr);
  let best = null;
  for (const e of EVENTS) for (const yy of [v.y, v.y - 1]) { const s = e.span(yy); if (s && t >= s[0] && t <= s[1] && (!best || rank(e) < rank(best))) best = e; }
  return best ? { ...best, text: best.greet(v) } : null;
}

// ---------- Vancouver weather (Open-Meteo, no key). Anything that fails just means clear skies. ----------
export async function weatherNow() {
  if (params.has('weather')) return params.get('weather');
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=49.28&longitude=-123.12&current=weather_code', { signal: ctl.signal });
    clearTimeout(to);
    const code = (await r.json()).current.weather_code;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 2) return 'cloudy';
    return 'clear';
  } catch (e) { return 'clear'; }
}

// ---------- the world map desk mat, like his real one: dark ocean, grey countries, a grid and labels ----------
const LAND = [
  [[-168, 66], [-162, 70], [-156, 71], [-140, 70], [-128, 70], [-115, 68], [-100, 68], [-95, 72], [-85, 70], [-80, 63], [-90, 57], [-82, 55], [-79, 52], [-77, 58], [-72, 61], [-65, 60], [-62, 57], [-56, 52], [-60, 47], [-66, 44], [-70, 42], [-74, 40], [-76, 36], [-80, 32], [-81, 27], [-80, 25], [-82, 26], [-84, 30], [-89, 30], [-94, 29], [-97, 26], [-97, 22], [-94, 18], [-90, 21], [-87, 21], [-88, 16], [-84, 15], [-83, 10], [-79, 9], [-77, 8], [-80, 7], [-83, 8], [-86, 12], [-91, 14], [-95, 16], [-100, 17], [-105, 20], [-106, 23], [-110, 24], [-112, 29], [-114, 31], [-117, 32], [-120, 34], [-123, 38], [-124, 42], [-124, 47], [-125, 50], [-130, 54], [-134, 57], [-140, 59], [-147, 61], [-152, 59], [-158, 57], [-164, 55], [-158, 58], [-162, 60], [-165, 62]],
  [[-73, 78], [-60, 82], [-30, 83], [-20, 80], [-18, 75], [-22, 70], [-32, 66], [-42, 60], [-48, 61], [-53, 66], [-56, 72], [-66, 76]],
  [[-120, 72], [-110, 76], [-95, 78], [-80, 80], [-70, 77], [-66, 70], [-62, 66], [-66, 63], [-75, 65], [-82, 69], [-90, 72], [-100, 70], [-110, 71]],
  [[-80, 9], [-75, 11], [-71, 12], [-64, 10], [-60, 8], [-52, 5], [-50, 0], [-44, -2], [-35, -5], [-35, -9], [-39, -14], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-63, -41], [-65, -46], [-68, -51], [-70, -55], [-74, -52], [-75, -46], [-73, -40], [-72, -30], [-71, -18], [-76, -14], [-80, -6], [-81, -2], [-79, 2], [-78, 7]],
  [[-5, 36], [-9, 37], [-9, 43], [-2, 44], [-5, 48], [-2, 49], [2, 51], [5, 53], [8, 54], [8, 57], [10, 58], [6, 58], [5, 62], [10, 64], [14, 67], [18, 70], [25, 71], [31, 70], [40, 67], [44, 68], [54, 69], [60, 69], [70, 73], [80, 73], [90, 76], [100, 78], [110, 77], [120, 73], [130, 72], [140, 72], [150, 71], [160, 70], [170, 70], [180, 68], [180, 65], [175, 64], [170, 60], [163, 59], [160, 61], [156, 57], [162, 55], [156, 51], [155, 56], [150, 59], [143, 59], [140, 55], [137, 54], [141, 52], [140, 48], [135, 44], [131, 43], [129, 41], [127, 39], [129, 35], [126, 34], [126, 37], [124, 39], [121, 40], [118, 39], [119, 37], [122, 37], [120, 35], [122, 31], [122, 28], [119, 25], [117, 23], [113, 22], [110, 21], [108, 22], [106, 20], [106, 18], [109, 15], [109, 12], [106, 9], [105, 9], [103, 10], [100, 13], [99, 10], [101, 7], [103, 4], [104, 1], [102, 2], [100, 4], [98, 8], [98, 12], [97, 16], [94, 16], [94, 19], [92, 22], [90, 22], [87, 21], [86, 20], [82, 16], [80, 13], [80, 10], [77, 8], [76, 10], [74, 15], [73, 19], [72, 21], [69, 22], [67, 25], [62, 25], [57, 25], [56, 27], [54, 27], [51, 28], [50, 30], [48, 30], [49, 27], [50, 26], [51, 25], [52, 24], [56, 24], [56, 26], [58, 23], [59, 22], [56, 18], [52, 16], [45, 13], [43, 13], [42, 16], [39, 21], [36, 26], [34, 28], [33, 30], [32, 31], [35, 33], [36, 36], [33, 36], [30, 36], [27, 37], [26, 40], [23, 40], [22, 37], [21, 39], [19, 42], [16, 43], [14, 45], [12, 44], [16, 41], [18, 40], [16, 38], [15, 40], [12, 42], [10, 44], [7, 44], [3, 43], [0, 40], [-1, 37]],
  [[-6, 36], [-10, 30], [-13, 27], [-17, 21], [-17, 15], [-15, 11], [-13, 8], [-8, 4], [-4, 5], [0, 5], [4, 6], [8, 4], [9, 2], [9, -1], [12, -5], [13, -9], [12, -17], [15, -27], [18, -34], [20, -35], [25, -34], [28, -33], [32, -29], [35, -24], [35, -20], [40, -16], [40, -11], [39, -6], [40, -2], [43, 2], [48, 5], [51, 11], [44, 11], [43, 12], [39, 16], [37, 21], [35, 24], [34, 27], [32, 30], [30, 31], [25, 32], [20, 31], [19, 30], [15, 32], [11, 33], [10, 37], [3, 37], [-2, 35]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  [[-5, 50], [1, 51], [1, 53], [-3, 56], [-2, 58], [-5, 58], [-6, 56], [-3, 54], [-5, 52]], [[-10, 52], [-6, 52], [-6, 55], [-8, 55], [-10, 54]],
  [[-24, 65], [-14, 65], [-14, 66.4], [-22, 66.5]],
  [[130, 31], [132, 34], [136, 35], [140, 36], [141, 40], [142, 43], [145, 44], [141, 45], [140, 41], [139, 38], [136, 37], [132, 35], [130, 33]],
  [[80, 6], [82, 7], [81, 9.5], [79.8, 8]], [[120, 22], [122, 25], [121, 25.3]], [[120, 18], [122, 18.5], [126, 7], [122, 7], [120, 14]],
  [[95, 5], [98, 4], [106, -6], [104, -6], [100, 0]], [[105, -6], [115, -8], [114, -9], [106, -7.5]], [[109, 2], [114, 4], [117, 7], [119, 5], [116, -4], [111, -3], [109, -1]],
  [[119, -5], [120, 0], [123, 1], [121, -2], [122, -5]], [[131, -1], [138, -2], [145, -4], [150, -10], [143, -9], [138, -8], [132, -4]],
  [[114, -22], [114, -26], [115, -34], [118, -35], [124, -34], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [144, -38], [147, -39], [150, -37], [153, -31], [153, -25], [149, -21], [146, -19], [145, -15], [143, -11], [141, -13], [141, -17], [136, -15], [136, -12], [132, -11], [129, -15], [126, -14], [122, -17], [120, -20]],
  [[145, -41], [148, -41], [147, -43.5], [145, -43]], [[173, -35], [175, -37], [178, -38], [176, -41], [174, -41]], [[172, -41], [174, -42], [171, -46], [167, -46], [170, -43]],
  [[-85, 22], [-80, 23], [-74, 20], [-77, 20], [-82, 22]], [[-74, 18], [-69, 19], [-68, 18], [-72, 18]],
];
const WATER = [
  [[28, 41], [28, 44], [31, 46], [35, 45], [39, 47], [41, 42], [36, 41], [31, 41]],
  [[47, 45], [50, 47], [53, 45], [53, 40], [54, 37], [51, 37], [49, 39], [48, 42]],
  [[10, 54], [14, 54], [20, 55], [21, 57], [23, 59], [30, 60], [25, 61], [22, 63], [25, 65], [22, 66], [17, 62], [18, 59], [16, 56], [12, 56]],
  [[-95, 60], [-85, 58], [-80, 52], [-78, 56], [-80, 62], [-88, 64], [-94, 62]],
];
const LABELS = [['CANADA', -105, 58, 1], ['UNITED STATES', -100, 39, 1], ['BRAZIL', -52, -10, 1], ['RUSSIA', 95, 63, 1.6], ['CHINA', 104, 34, 1.1], ['INDIA', 79, 21, 0.9],
  ['IRAN', 54, 32, 0.8], ['AUSTRALIA', 134, -25, 1], ['AFRICA', 20, 5, 1.2], ['EUROPE', 15, 50, 0.8], ['GREENLAND', -41, 74, 0.8], ['ARGENTINA', -65, -36, 0.7], ['MEXICO', -102, 23, 0.7],
  ['PACIFIC OCEAN', -150, 10, 0.9, 1], ['ATLANTIC OCEAN', -38, 25, 0.9, 1], ['INDIAN OCEAN', 78, -22, 0.9, 1], ['ARCTIC OCEAN', 0, 80, 0.7, 1], ['VANCOUVER', -123, 49.3, 0.55, 2]];

export function drawWorldMat(s) {
  const { g, c, t } = s, W = c.width, Hh = c.height, r = seeded(81);
  const LAT0 = 84, LAT1 = -58;
  const px = (lon, lat) => [(lon + 180) / 360 * (W - 60) + 30, (LAT0 - lat) / (LAT0 - LAT1) * (Hh - 60) + 30];
  const path = polys => { g.beginPath(); for (const p of polys) { p.forEach(([lo, la], i) => { const [x, y] = px(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); } };
  const ocean = g.createLinearGradient(0, 0, 0, Hh);
  ocean.addColorStop(0, '#1b1e23'); ocean.addColorStop(1, '#121417');
  g.fillStyle = ocean; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) { const [x] = px(lon, 0); g.beginPath(); g.moveTo(x, 30); g.lineTo(x, Hh - 30); g.stroke(); }
  for (let lat = -45; lat <= 75; lat += 15) { const [, y] = px(0, lat); g.beginPath(); g.moveTo(30, y); g.lineTo(W - 30, y); g.stroke(); }
  // Countries: a coarse patchwork of greys inside the land, with thin borders where the patches meet.
  const gw = 384, gh = Math.round(gw * Hh / W), seeds = [];
  const land = document.createElement('canvas'); land.width = gw; land.height = gh;
  const lg = land.getContext('2d'); lg.setTransform(gw / W, 0, 0, gh / Hh, 0, 0); lg.fillStyle = '#fff';
  lg.beginPath(); for (const p of LAND) { p.forEach(([lo, la], i) => { const [x, y] = px(lo, la); i ? lg.lineTo(x, y) : lg.moveTo(x, y); }); lg.closePath(); } lg.fill();
  lg.fillStyle = '#000'; lg.beginPath(); for (const p of WATER) { p.forEach(([lo, la], i) => { const [x, y] = px(lo, la); i ? lg.lineTo(x, y) : lg.moveTo(x, y); }); lg.closePath(); } lg.fill();
  const mask = lg.getImageData(0, 0, gw, gh).data;
  for (let i = 0; i < 2600 && seeds.length < 170; i++) { const x = r() * gw | 0, y = r() * gh | 0; if (mask[(y * gw + x) * 4] > 128) seeds.push([x, y, 70 + (r() * 80 | 0)]); }
  const cell = new Int16Array(gw * gh).fill(-1), img = lg.createImageData(gw, gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const k = y * gw + x;
    if (mask[k * 4] < 128) continue;
    let best = 0, bd = 1e9;
    for (let i = 0; i < seeds.length; i++) { const dx = seeds[i][0] - x, dy = (seeds[i][1] - y) * 1.3, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    cell[k] = best;
    const v = seeds[best][2];
    img.data[k * 4] = v; img.data[k * 4 + 1] = v + 3; img.data[k * 4 + 2] = v + 8; img.data[k * 4 + 3] = 255;
  }
  for (let y = 1; y < gh; y++) for (let x = 1; x < gw; x++) {
    const k = y * gw + x;
    if (cell[k] >= 0 && ((cell[k - 1] >= 0 && cell[k - 1] !== cell[k]) || (cell[k - gw] >= 0 && cell[k - gw] !== cell[k]))) { img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = 205; }
  }
  lg.setTransform(1, 0, 0, 1, 0, 0); lg.putImageData(img, 0, 0);
  g.save(); path(LAND); g.clip();
  g.imageSmoothingEnabled = true; g.drawImage(land, 0, 0, W, Hh);
  g.restore();
  g.fillStyle = ocean; path(WATER); g.fill();
  g.strokeStyle = 'rgba(225,230,238,.55)'; g.lineWidth = 1.6; path(LAND); g.stroke(); path(WATER); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [name, lo, la, k, kind] of LABELS) {
    const [x, y] = px(lo, la);
    g.font = `${kind === 1 ? 'italic 400' : '700'} ${Math.round(22 * k)}px ${MONO}`;
    g.fillStyle = kind === 1 ? 'rgba(170,180,195,.55)' : kind === 2 ? '#3ee6c4' : 'rgba(245,247,250,.88)';
    if (kind === 2) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.textAlign = 'left'; g.fillText(name, x + 10, y - 10); g.textAlign = 'center'; }
    else g.fillText(name.split('').join(String.fromCharCode(8202)), x, y);
  }
  // Ruler ticks around the edge and a stitched border, like the real mat.
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2;
  for (let x = 30; x <= W - 30; x += 12) { const l = (x - 30) % 60 ? 6 : 12; g.beginPath(); g.moveTo(x, Hh - 30); g.lineTo(x, Hh - 30 - l); g.moveTo(x, 30); g.lineTo(x, 30 + l); g.stroke(); }
  for (let y = 30; y <= Hh - 30; y += 12) { const l = (y - 30) % 60 ? 6 : 12; g.beginPath(); g.moveTo(W - 30, y); g.lineTo(W - 30 - l, y); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeRect(10, 10, W - 20, Hh - 20); g.setLineDash([]);
  // Soft shadows where the keyboard, wrist rest and mouse sit (the mat itself isn't in the light bake).
  const shade = (x0, y0, x1, y1, a) => { const gr = g.createRadialGradient((x0 + x1) / 2, (y0 + y1) / 2, 0, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * 0.62); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x0 - 60, y0 - 60, x1 - x0 + 120, y1 - y0 + 120); };
  shade(0.29 * W, 0.56 * Hh, 0.71 * W, 0.93 * Hh, 0.55);
  shade(0.11 * W, 0.64 * Hh, 0.16 * W, 0.76 * Hh, 0.5);
  t.needsUpdate = true;
}

// ---------- pomodoro cube ----------
export function drawTimer(s, now) {
  const { g, c, t } = s;
  const left = 25 * 60 - Math.floor(now / 1000) % (25 * 60);
  g.fillStyle = '#05080c'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = left < 60 ? '#ff6b6b' : '#3ee6c4'; g.font = `700 64px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`, c.width / 2, c.height / 2 + 4);
  g.fillStyle = 'rgba(62,230,196,.25)'; g.fillRect(16, c.height - 18, (c.width - 32) * (1 - left / 1500), 6);
  t.needsUpdate = true;
}

// ---------- neon sign: "hello, friend." or the day's greeting ----------
export function drawNeon(s, text, color) {
  const { g, c, t } = s;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, c.width, c.height);
  let px = 190;
  g.font = `${px}px 'Pacifico', 'Brush Script MT', cursive`;
  const w = g.measureText(text).width;
  if (w > c.width * 0.92) { px = Math.floor(px * c.width * 0.92 / w); g.font = `${px}px 'Pacifico', 'Brush Script MT', cursive`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [blur, a] of [[48, 0.5], [22, 0.8], [8, 1]]) { g.shadowColor = color; g.shadowBlur = blur; g.fillStyle = color; g.globalAlpha = a; g.fillText(text, c.width / 2, c.height / 2 + 8); }
  g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.85)'; g.font = g.font; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.strokeText(text, c.width / 2, c.height / 2 + 8);
  t.needsUpdate = true;
}

// ---------- lounge wall: a Persian girih print, a poster of our own, and two project frames ----------
export function drawGirih(s) {
  const { g, c, t } = s, W = c.width, Hh = c.height;
  g.fillStyle = '#0f2a4a'; g.fillRect(0, 0, W, Hh);
  const star = (cx, cy, R, rot) => { g.beginPath(); for (let i = 0; i < 16; i++) { const a = rot + i * Math.PI / 8, rr = i % 2 ? R * 0.55 : R; i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); };
  const S = 96;
  for (let y = -S; y < Hh + S; y += S) for (let x = -S; x < W + S; x += S) {
    const o = (y / S) % 2 ? S / 2 : 0;
    star(x + o, y, S * 0.46, Math.PI / 8); g.fillStyle = '#e9c46a'; g.fill(); g.strokeStyle = '#0a1b30'; g.lineWidth = 4; g.stroke();
    star(x + o, y, S * 0.24, 0); g.fillStyle = '#2a9d8f'; g.fill();
    g.beginPath(); g.arc(x + o, y, S * 0.08, 0, 7); g.fillStyle = '#f4f1de'; g.fill();
  }
  g.strokeStyle = '#e9c46a'; g.lineWidth = 18; g.strokeRect(9, 9, W - 18, Hh - 18);
  g.strokeStyle = '#b23a48'; g.lineWidth = 6; g.strokeRect(26, 26, W - 52, Hh - 52);
  t.needsUpdate = true;
}
export function drawPoster(s) {
  const { g, c, t } = s, W = c.width, Hh = c.height;
  g.fillStyle = '#0a0b0e'; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(62,230,196,.12)'; g.lineWidth = 1;
  for (let y = 0; y < Hh; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = '#e8edf5'; g.font = `700 ${Math.round(W * 0.15)}px ${MONO}`; g.textAlign = 'left';
  ['STAY', 'CURIOUS.'].forEach((w, i) => g.fillText(w, W * 0.1, Hh * 0.36 + i * W * 0.17));
  g.fillStyle = '#3ee6c4'; g.font = `${Math.round(W * 0.06)}px ${MONO}`; g.fillText('$ ship --it', W * 0.1, Hh * 0.72);
  g.fillRect(W * 0.1 + g.measureText('$ ship --it ').width, Hh * 0.72 - W * 0.05, W * 0.035, W * 0.06);
  g.fillStyle = '#ff5f57'; g.fillRect(W * 0.1, Hh * 0.84, W * 0.8, 4);
  g.fillStyle = '#7f8aa0'; g.font = `${Math.round(W * 0.035)}px ${MONO}`; g.fillText('BEHBOD · VANCOUVER', W * 0.1, Hh * 0.9);
  t.needsUpdate = true;
}
export function drawProject(s, name, line, kind) {
  const { g, c, t } = s, W = c.width, Hh = c.height, r = seeded(kind === 'voice' ? 3 : 9);
  g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, Hh);
  if (kind === 'voice') {
    g.strokeStyle = '#3ee6c4'; g.lineWidth = 6; g.lineCap = 'round';
    for (let i = 0; i < 38; i++) { const x = W * 0.1 + i * W * 0.8 / 37, h = (0.15 + r() * 0.85) * Hh * 0.28 * Math.sin(Math.PI * i / 37); g.beginPath(); g.moveTo(x, Hh * 0.42 - h); g.lineTo(x, Hh * 0.42 + h); g.stroke(); }
  } else {
    const pal = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
    for (let x = 0; x < 30; x++) for (let y = 0; y < 7; y++) { g.fillStyle = pal[Math.min(4, Math.floor(r() * 5.4))]; g.fillRect(W * 0.08 + x * W * 0.028, Hh * 0.16 + y * Hh * 0.075, W * 0.023, Hh * 0.062); }
  }
  g.fillStyle = '#e8edf5'; g.font = `700 ${Math.round(W * 0.075)}px ${MONO}`; g.textAlign = 'left'; g.fillText(name, W * 0.08, Hh * 0.8);
  g.fillStyle = '#8a93a6'; g.font = `${Math.round(W * 0.036)}px ${MONO}`; g.fillText(line, W * 0.08, Hh * 0.9);
  t.needsUpdate = true;
}

// ---------- outside: Vancouver's sky by the real sun, windows that change, clouds for the weather ----------
export class Outside {
  constructor(s) {
    this.s = s;
    const r = seeded(604);
    this.stars = Array.from({ length: 260 }, () => [r() * s.c.width, r() * s.c.height * 0.45, 0.2 + r() * 0.6]);
    this.towers = Array.from({ length: 70 }, () => {
      const w = 26 + r() * 50, h = 30 + r() * 150, x = r() * s.c.width, wins = [];
      for (let wy = 560 - h + 6; wy < 590; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7) wins.push([wx, wy, r(), r() < 0.8]);
      return { w, h, x, wins };
    });
    this.glints = Array.from({ length: 400 }, () => [r() * s.c.width, 615 + r() * 120, 8 + r() * 18, r()]);
    this.rnd = seeded(97);
    this.weather = 'clear';
    this.last = -1e9;
  }
  // How many office and home windows are lit at this hour (Vancouver time).
  static litShare(h) { return [0.12, 0.08, 0.06, 0.05, 0.06, 0.1, 0.18, 0.28, 0.3, 0.26, 0.24, 0.24, 0.25, 0.25, 0.25, 0.27, 0.32, 0.42, 0.5, 0.52, 0.48, 0.4, 0.3, 0.2][h]; }
  draw(date) {
    const { g, c, t } = this.s, W = c.width, Hh = c.height;
    const sky = skyAt(date), v = vanTime(date), wet = this.weather === 'rain' || this.weather === 'snow' || this.weather === 'fog' || this.weather === 'cloudy';
    const SKIES = {
      night: ['#04060f', '#0b1230', '#2a1f4a', '#3b2a4f', '#07090f'], dawn: ['#1a2350', '#4a3d7a', '#c76b78', '#f2a07b', '#1a1622'],
      morning: ['#4f7fc4', '#8fb6e8', '#f5d0a6', '#ffe1b8', '#2a3140'], day: ['#3d7fd6', '#6fa4e8', '#a9cdf0', '#d6e8f7', '#3a4656'],
      golden: ['#3a5da8', '#e2905e', '#f6b26b', '#ffd59a', '#2c2630'], dusk: ['#0f1638', '#3a2a66', '#a34f6e', '#e07a5f', '#120f1c'],
    };
    let cols = SKIES[sky.phase] || SKIES.night;
    if (wet) cols = cols.map(h => mixHex(h, sky.phase === 'night' ? '#0d1016' : '#7d8794', sky.phase === 'night' ? 0.45 : 0.6));
    const gr = g.createLinearGradient(0, 0, 0, Hh);
    [0, 0.45, 0.62, 0.7, 1].forEach((p, i) => gr.addColorStop(p, cols[i]));
    g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    const dark = sky.phase === 'night' || sky.phase === 'dusk' || sky.phase === 'dawn';
    if (dark && !wet) for (const [x, y, a] of this.stars) { g.fillStyle = `rgba(255,255,255,${a * (sky.phase === 'night' ? 1 : 0.35)})`; g.fillRect(x, y, 1.6, 1.6); }
    if (!wet) {
      if (sky.elev > -4) { const y = 520 - Math.max(0, sky.elev) * 9; g.fillStyle = sky.elev < 8 ? '#ffcf8a' : '#fff6dc'; g.shadowColor = g.fillStyle; g.shadowBlur = 40; g.beginPath(); g.arc(380, y, 30, 0, 7); g.fill(); g.shadowBlur = 0; }
      else { const p = moonPhase(date); g.fillStyle = '#f4efe0'; g.beginPath(); g.arc(1560, 120, 26, 0, 7); g.fill(); g.fillStyle = cols[1]; g.beginPath(); g.arc(1560 + (p < 0.5 ? -1 : 1) * 52 * Math.abs(0.5 - p) * 2 - (p < 0.5 ? -12 : 12), 112, 25, 0, 7); g.fill(); }
    }
    if (wet) { const r = seeded(v.h * 31 + 7); for (let i = 0; i < 30; i++) { g.fillStyle = sky.phase === 'night' ? 'rgba(40,46,58,.55)' : 'rgba(200,206,214,.35)'; g.beginPath(); g.ellipse(r() * W, 60 + r() * 260, 120 + r() * 200, 26 + r() * 30, 0, 0, 7); g.fill(); } }
    const mount = dark ? ['#151a33', '#0e1226'] : wet ? ['#59636f', '#48515c'] : ['#3b4a63', '#2c3a4f'];
    const ridge = (base, amp, col, seed) => { const rr = seeded(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, Hh); let y = base; for (let x = 0; x <= W; x += 16) { y += (rr() - 0.5) * amp; y = Math.max(base - amp * 3, Math.min(base + amp, y)); g.lineTo(x, y - Math.sin(x / 300) * amp * 1.6); } g.lineTo(W, Hh); g.fill(); };
    ridge(470, 26, mount[0], 1); ridge(500, 20, mount[1], 2);
    if (this.weather === 'snow' || v.m === 12 || v.m <= 2) { g.fillStyle = 'rgba(235,240,250,.55)'; const rr = seeded(5); for (let x = 0; x < W; x += 22) { const y = 448 + Math.sin(x / 300) * -40 + rr() * 30; g.fillRect(x, y, 22, 6 + rr() * 6); } }
    // The Grouse ski runs are lit after dark in the season.
    if (dark && (v.m >= 11 || v.m <= 3)) { g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 9; i++) { const x0 = 560 + i * 9; for (let k = 0; k < 14; k++) g.fillRect(x0 + k * 3, 440 + k * 6 + (i % 2) * 3, 2, 2); } }
    g.fillStyle = dark ? '#05070d' : wet ? '#3a414b' : '#2b3442'; g.fillRect(0, 560, W, 190);
    const share = Outside.litShare(v.h) * (dark ? 1 : 0.25);
    for (const tw of this.towers) {
      g.fillStyle = dark ? '#080b14' : wet ? '#4a525d' : '#55657a'; g.fillRect(tw.x, 560 - tw.h, tw.w, tw.h + 40);
      for (const [wx, wy, k, warm] of tw.wins) if (k < share) { g.fillStyle = warm ? 'rgba(255,214,150,.85)' : 'rgba(170,210,255,.8)'; g.fillRect(wx, wy, 3, 4); }
        else if (!dark) { g.fillStyle = 'rgba(30,40,55,.35)'; g.fillRect(wx, wy, 3, 4); }
    }
    g.strokeStyle = dark ? 'rgba(120,255,170,.9)' : 'rgba(60,90,80,.9)'; g.lineWidth = 2; g.beginPath();
    for (let x = 1150; x <= 1560; x += 6) { const u = (x - 1150) / 410, y = 545 - Math.sin(u * Math.PI) * 34; x === 1150 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    if (dark) for (let x = 1150; x <= 1560; x += 14) { const u = (x - 1150) / 410; g.fillStyle = 'rgba(160,255,190,.95)'; g.fillRect(x, 545 - Math.sin(u * Math.PI) * 34 - 1, 3, 3); }
    const water = g.createLinearGradient(0, 600, 0, 750);
    water.addColorStop(0, dark ? '#0a1024' : mixHex(cols[2], '#1c2a3c', 0.6)); water.addColorStop(1, dark ? '#03050a' : '#18222e');
    g.fillStyle = water; g.fillRect(0, 610, W, 140);
    for (const [x, y, w, a] of this.glints) { g.fillStyle = dark ? `rgba(255,210,150,${a * 0.35})` : `rgba(255,255,255,${a * 0.18})`; g.fillRect(x, y, w, 1.5); }
    if (this.weather === 'fog') { g.fillStyle = sky.phase === 'night' ? 'rgba(30,34,42,.5)' : 'rgba(200,205,212,.5)'; g.fillRect(0, 380, W, 370); }
    t.needsUpdate = true;
    this.dark = dark;
    this.share = share;
  }
  // Windows switch on and off a few at a time; the whole view is redrawn about every half minute.
  tick(now) {
    if (now - this.last < 30000) return;
    this.last = now;
    for (let i = 0; i < 40; i++) { const tw = this.towers[(this.rnd() * this.towers.length) | 0], w = tw.wins[(this.rnd() * tw.wins.length) | 0]; if (w) w[2] = this.rnd(); }
    this.draw(new Date());
  }
}
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [r1, g1, b1] = ch(pa), [r2, g2, b2] = ch(pb);
  return '#' + [r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}
export const BRIDGE = { x0: 1150, x1: 1560, y: 545, sag: 34, canvasW: 2048, canvasH: 750 };
