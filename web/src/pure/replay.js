// The save of the week, for the replay on the TV menu. The week runs Monday to Sunday by the calendar in Vancouver (an
// ISO week, "2026-W47"). The house's own save of the week comes from a match it plays out for that week, the same
// match for everyone (seeded by the week, with its sums done the same way in every browser): the best of BEHI FC's
// first four saves in it (or of those in its first ten minutes). A visitor's own save as keeper replaces it once it is better. Better means harder, in points:
// two for each metre the keeper had to go from where it stood when the shot was struck, up to one and a half for a shot
// heading for the post, up to one for a shot struck from close in.
import { newMatch, stepMatch, LEN, WID, GOAL } from './match.js';
import { makeRng } from '../audio/pure/rng.js';

export const HZ = 30, BEFORE = 2.5, AFTER = 1.0, KEY = 'loft.save';
// The house's match: steps of a thirtieth of a second, until BEHI FC has made four saves, or ten minutes have gone with
// one at least, and never past thirty minutes.
export const STEP = 1 / 30, MAX_CLOCK = 600, LAST_CLOCK = 1800, MAX_SAVES = 4;
const PLAYERS = 10, WIDTH = 2 + PLAYERS * 2;

// ---------- the week ----------
// A calendar date's ISO week: weeks start on Monday, and week 1 holds the year's first Thursday.
export function isoWeek(y, m, d) {
  const day = 86400000, t = Date.UTC(y, m - 1, d), dow = (new Date(t).getUTCDay() + 6) % 7;
  const thursday = t + (3 - dow) * day, year = new Date(thursday).getUTCFullYear();
  return { year, week: 1 + Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * day)) };
}
// A date format is slow to make, so each time zone's is made once.
const formats = new Map();
export function weekKey(date = new Date(), timeZone = 'America/Vancouver') {
  if (!formats.has(timeZone)) formats.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }));
  const parts = formats.get(timeZone).formatToParts(date);
  const get = type => +parts.find(p => p.type === type).value;
  const { year, week } = isoWeek(get('year'), get('month'), get('day'));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ---------- the same match in every browser ----------
// Math.sin and Math.hypot may differ in their last digit between browsers, and a match played for minutes grows that
// into a different match. While the house's match runs they are swapped for versions made of plain arithmetic, which
// every browser does alike, and put back straight after (nothing else runs in between).
const HALF_PI = Math.PI / 2, TAU = Math.PI * 2;
export function sinSame(x) {
  let r = x - Math.round(x / TAU) * TAU;
  if (r > HALF_PI) r = Math.PI - r; else if (r < -HALF_PI) r = -Math.PI - r;
  const q = r * r;
  return r * (1 + q * (-1 / 6 + q * (1 / 120 + q * (-1 / 5040 + q * (1 / 362880 + q * (-1 / 39916800 + q / 6227020800))))));
}
export const hypotSame = (...v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
export function same(fn) {
  const { sin, hypot } = Math;
  Math.sin = sinSame; Math.hypot = hypotSame;
  try { return fn(); } finally { Math.sin = sin; Math.hypot = hypot; }
}

// ---------- recording saves ----------
const round = v => Math.round(v * 100) / 100;
const snap = m => [round(m.ball.x), round(m.ball.y), ...m.players.flatMap(p => [round(p.x), round(p.y)])];
const keeperOf = (m, team) => m.players.find(p => p.team === team && p.role === 'keeper');

// How hard a save was, in points (see the top of this file).
export function savePoints({ travel, line, from }) {
  const post = Math.min(1, Math.abs(line) / GOAL), close = Math.max(0, Math.min(1, 1 - (from - 4) / 14));
  return round(2 * travel + 1.5 * post + close);
}

// Watches a match step by step and hands back a clip of each save BEHI FC's keeper makes: the 2.5 seconds before it
// and the second after, at 30 pictures a second. `minute` says the match minute for the clip's score bug.
export function makeRecorder() {
  const ring = [], cap = Math.round(BEFORE * HZ) + 1;
  let acc = 0, wasShot = null, shot = null, open = null;
  const finish = () => { const c = open; open = null; return c; };
  return {
    step(m, ev, dt, minute = () => 0) {
      const b = m.ball;
      // A shot at BEHI FC's goal: where its keeper stood, where the ball was headed and how far out it was struck.
      if (b.shot === 1 && wasShot !== 1) {
        const k = keeperOf(m, 0), line = b.vx < 0 ? b.y + b.vy * ((-LEN - b.x) / b.vx) : b.y;
        shot = { kx: k.x, ky: k.y, line, from: Math.abs(b.x + LEN) };
      }
      wasShot = b.shot;
      acc += dt;
      if (acc >= 1 / HZ - 1e-9) {
        acc -= 1 / HZ;
        const f = snap(m);
        ring.push(f); if (ring.length > cap) ring.shift();
        if (open) { open.frames.push(f); if (open.frames.length - 1 - open.save >= Math.round(AFTER * HZ)) return finish(); }
      }
      const saved = ev.some(e => e === 'save' || e === 'bot-save') && b.owner?.role === 'keeper' && b.owner.team === 0;
      if (saved && !open && shot) {
        const k = b.owner, travel = Math.hypot(k.x - shot.kx, k.y - shot.ky), f = snap(m);
        const frames = ring.slice();
        if (!frames.length || frames.at(-1).some((v, i) => v !== f[i])) frames.push(f);
        open = { v: 1, points: savePoints({ travel, line: shot.line, from: shot.from }), save: frames.length - 1, minute: Math.max(0, Math.min(90, Math.floor(minute()))), goals: m.score.slice(), frames };
        shot = null;
      }
      return null;
    },
    // A save still being filmed when the match ends is kept with what there is of its last second.
    flush: () => (open ? finish() : null),
  };
}

// ---------- the house's save of the week ----------
// Played a few steps at a time (`run`), so it can be spread over the page's spare moments.
export function makeSearch(week, { maxClock = MAX_CLOCK, lastClock = LAST_CLOCK, maxSaves = MAX_SAVES } = {}) {
  const rand = makeRng(week).next, m = newMatch({ kickoff: 0 }), rec = makeRecorder();
  let best = null, saves = 0, done = false;
  const take = clip => { if (!clip) return; saves++; if (!best || clip.points > best.points) best = { ...clip, week, who: 'house' }; if (saves >= maxSaves) done = true; };
  const minute = () => Math.min(90, (m.clock / maxClock) * 90);
  return {
    get done() { return done; },
    get best() { return best; },
    get clock() { return m.clock; },
    run(steps) {
      same(() => {
        for (let i = 0; i < steps && !done; i++) {
          take(rec.step(m, stepMatch(m, STEP, rand), STEP, minute));
          if (!done && (m.clock >= lastClock || (m.clock >= maxClock && best))) { take(rec.flush()); done = true; }
        }
      });
      return done;
    },
  };
}

// ---------- keeping a visitor's save ----------
export const pack = clip => JSON.stringify({ v: 1, week: clip.week, points: clip.points, save: clip.save, minute: clip.minute, goals: clip.goals, frames: clip.frames });
const isNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
// A kept save, checked all through (it comes back from the visitor's own storage), or null if it is not this week's.
export function unpack(text, week) {
  if (typeof text !== 'string' || text.length > 60000) return null;
  let c;
  try { c = JSON.parse(text); } catch (e) { return null; }
  if (!c || typeof c !== 'object' || c.v !== 1 || c.week !== week || typeof week !== 'string') return null;
  const f = c.frames;
  if (!Array.isArray(f) || f.length < 10 || f.length > 200 || !Number.isInteger(c.save) || c.save < 0 || c.save >= f.length) return null;
  if (!isNum(c.points, 0, 100) || !Number.isInteger(c.minute) || c.minute < 0 || c.minute > 90) return null;
  if (!Array.isArray(c.goals) || c.goals.length !== 2 || !c.goals.every(g => Number.isInteger(g) && g >= 0 && g < 100)) return null;
  for (const row of f) {
    if (!Array.isArray(row) || row.length !== WIDTH) return null;
    for (let i = 0; i < WIDTH; i += 2) if (!isNum(row[i], -LEN - 2, LEN + 2) || !isNum(row[i + 1], -WID - 2, WID + 2)) return null;
  }
  return { v: 1, week, who: 'you', points: c.points, save: c.save, minute: c.minute, goals: c.goals.slice(), frames: f };
}
// The save of the week: the visitor's own if it is this week's and better than the house's.
export const choose = (house, own, week) => (own && own.week === week && (!house || own.points > house.points) ? own : house || null);

// ---------- playing it back ----------
// Seconds of the clip a real second shows: a third as fast from just before the save to just after it.
export function rate(clip, t) {
  const at = clip.save / HZ;
  return t > at - 0.7 && t < at + 0.45 ? 0.3 : 1;
}
export const length = clip => (clip.frames.length - 1) / HZ;
// A match to draw at clip time `t` (seconds), the positions eased between pictures. `out` is reused from call to call.
export function frameAt(clip, t, out = null) {
  const m = out || { players: newMatch().players.map(p => ({ team: p.team, role: p.role, num: p.num, x: 0, y: 0, dive: 0 })), ball: { x: 0, y: 0, owner: null }, score: [0, 0], clock: 0, phase: 'play' };
  const f = Math.max(0, Math.min(clip.frames.length - 1, t * HZ)), i = Math.min(clip.frames.length - 2, Math.floor(f)), k = clip.frames.length > 1 ? f - i : 0;
  const a = clip.frames[Math.max(0, i)], b = clip.frames[Math.min(clip.frames.length - 1, i + 1)];
  const at = j => a[j] + (b[j] - a[j]) * k;
  m.ball.x = at(0); m.ball.y = at(1);
  m.players.forEach((p, n) => { p.x = at(2 + n * 2); p.y = at(3 + n * 2); });
  m.score = clip.goals; m.clock = t;
  return m;
}
