// Vancouver time, sun and moon, the README's holiday calendar and the weather codes. No browser APIs, so the
// tests can run it directly.
export const DAY = 864e5;
const D = (y, m, d) => Date.UTC(y, m - 1, d);

export function vanTime(date) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date).forEach(p => { parts[p.type] = p.value; });
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour % 24, min: +parts.minute };
}

export function sunElev(date) {
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

export function skyPhase(date) {
  const e = sunElev(date), rising = sunElev(new Date(date.getTime() + 15 * 60000)) > e;
  const phase = e < -10 ? 'night' : e < 0 ? (rising ? 'dawn' : 'dusk') : e < 8 ? (rising ? 'morning' : 'golden') : 'day';
  return { phase, elev: e };
}

export function moonPhase(date) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  return (((date.getTime() - ref) / DAY) % syn + syn) % syn / syn;
}

export function nowruz(y) {
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
export const EVENTS = [
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

// The holiday for a moment in Vancouver, the most important one when several overlap. `force` picks one by id.
export function holidayAt(date, force = null) {
  const v = vanTime(date), t = D(v.y, v.m, v.d);
  if (force) { const e = EVENTS.find(x => x.id === force); return e ? { ...e, text: e.greet(v) } : null; }
  const rank = e => (e.eve && v.h < e.eve ? e.pr + 10 : e.pr);
  let best = null;
  for (const e of EVENTS) for (const yy of [v.y, v.y - 1]) { const s = e.span(yy); if (s && t >= s[0] && t <= s[1] && (!best || rank(e) < rank(best))) best = e; }
  return best ? { ...best, text: best.greet(v) } : null;
}

// Open-Meteo's WMO weather codes, reduced to what the window can show.
export function weatherFromCode(code) {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 2) return 'cloudy';
  return 'clear';
}
