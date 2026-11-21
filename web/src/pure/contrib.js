// His GitHub contributions for the desk's little screen, from the file profile-art publishes every hour.
export const WEEKS = 53, MAX_DAYS = 400, DAY_MAX = 100000;

const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isDays = a => Array.isArray(a) && a.length >= 1 && a.length <= MAX_DAYS && a.every(v => Number.isInteger(v) && v >= 0 && v <= DAY_MAX);

// The file's daily series added together, day by day: { start, days }, or null when the file is not what it should be.
export function parseContrib(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j) || !isDate(j.start)) return null;
  const series = Object.values(j).filter(Array.isArray);
  if (!series.length || !series.every(isDays) || series.some(s => s.length !== series[0].length)) return null;
  return { start: j.start, days: series[0].map((_, i) => series.reduce((t, s) => t + s[i], 0)) };
}

export const total = days => days.reduce((t, v) => t + v, 0);

// The last good copy, as kept in the browser: only the summed days and when they were fetched.
export const toCache = (g, at) => JSON.stringify({ start: g.start, days: g.days, at });
export function fromCache(text) {
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j !== 'object' || !isDate(j.start) || !isDays(j.days) || !Number.isFinite(j.at)) return null;
  return { start: j.start, days: j.days, at: j.at };
}

// GitHub's five shades: none, then the busy days split into quarters.
export function levels(days) {
  const busy = days.filter(v => v > 0).sort((a, b) => a - b);
  const q = f => busy[Math.floor((busy.length - 1) * f)];
  const [a, b, c] = busy.length ? [q(0.25), q(0.5), q(0.75)] : [0, 0, 0];
  return days.map(v => (v <= 0 ? 0 : v <= a ? 1 : v <= b ? 2 : v <= c ? 3 : 4));
}

// Each day's square as on GitHub: a column a week, Sunday on top, the newest week on the right, at most WEEKS columns.
export function cells(g) {
  const first = new Date(Date.parse(g.start + 'T00:00:00Z')).getUTCDay(), lv = levels(g.days), n = g.days.length;
  const cols = Math.floor((first + n - 1) / 7) + 1, skip = Math.max(0, cols - WEEKS);
  const out = [];
  for (let i = 0; i < n; i++) {
    const col = Math.floor((first + i) / 7) - skip;
    if (col >= 0) out.push({ col, row: (first + i) % 7, level: lv[i] });
  }
  return out;
}
