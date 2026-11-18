// Nowruz turns at the March equinox, found as in Meeus, Astronomical Algorithms, chapter 27 (to about a minute).
const TERMS = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];
const DEG = Math.PI / 180, DAY = 86400000;
// The equinox comes out in the astronomers' even time scale, which runs about 69 seconds ahead of clock time now.
const DELTA_T = 69;

export function equinox(year) {
  const Y = (year - 2000) / 1000;
  const jde0 = 2451623.80984 + 365242.37404 * Y + 0.05169 * Y ** 2 - 0.00411 * Y ** 3 - 0.00057 * Y ** 4;
  const T = (jde0 - 2451545) / 36525, W = (35999.373 * T - 2.47) * DEG;
  const dl = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
  const S = TERMS.reduce((s, [A, B, C]) => s + A * Math.cos((B + C * T) * DEG), 0);
  return new Date((jde0 + 0.00001 * S / dl - 2440587.5) * DAY - DELTA_T * 1000);
}

// The equinox the countdown is about: this year's until thirteen days after it (the days of Nowruz), then next year's.
export function nextNowruz(now) {
  const y = now.getUTCFullYear(), at = equinox(y);
  return now - at >= 13 * DAY ? equinox(y + 1) : at;
}

const when = (date, timeZone) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map(x => [x.type, x.value]));
  return { day: `${p.weekday} ${p.day} ${p.month} ${p.year}`, short: `${p.weekday} ${p.day} ${p.month}`, time: `${p.hour}:${p.minute}` };
};
// Calendar days, not 24-hour spans: Tehran can already be on the next day.
const dayIn = (date, timeZone) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date).map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day) / DAY;
};
const VAN = 'America/Vancouver', TEH = 'Asia/Tehran';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function left(ms) {
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24, min = m % 60;
  const parts = [d && plural(d, 'day'), h && plural(h, 'hour'), min && plural(min, 'minute')].filter(Boolean);
  if (!m) return 'less than a minute to go.';
  return (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0]) + ' to go.';
}

// The Persian year that starts at the March equinox is the Gregorian one less 621.
export function nowruzLines(now = new Date()) {
  const at = nextNowruz(now), year = at.getUTCFullYear() - 621;
  if (now >= at) {
    const days = dayIn(now, VAN) - dayIn(at, VAN);
    return [`Nowruz mobarak: happy new year ${year}!`, days ? `The year turned at the spring equinox, ${plural(days, 'day')} ago.` : 'The year turned at the spring equinox, today.'];
  }
  const v = when(at, VAN), t = when(at, TEH);
  const tehran = dayIn(at, TEH) === dayIn(at, VAN) ? `, ${t.time} in Tehran.` : `; ${t.short}, ${t.time} in Tehran.`;
  return [`Nowruz ${year} begins at the spring equinox:`, `${v.day}, ${v.time} in Vancouver${tehran}`, left(at - now)];
}
