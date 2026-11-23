// Real Madrid's game days, read from the data espn.com's own pages read: no key, and its answers let any page read them.
import { vanTime, DAY } from './calendar.js';

export const TEAM = '86';
const BASE = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/teams/${TEAM}/schedule`;
// Every competition in one list: the matches still to come, and the ones played this season (today's, once it is over).
export const SOURCES = [`${BASE}?fixture=true`, BASE];
export const FIRST_READ = 5000, TIMEOUT = 8000, CHECK = 60e3;
export const READ_EVERY = 6 * 3600e3, RETRY = 2 * 3600e3;
// A match kicked off late in Vancouver's evening keeps the room white and gold past midnight until it is over.
export const LATE = 3 * 3600e3;
const BACK = 2 * DAY, AHEAD = 120 * DAY, MOST = 200;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

// The confirmed kick-offs in one answer as [id, ms], or null when anything in it is not what ESPN sends, so a broken
// answer is refused whole. A kick-off still to be fixed (timeValid false) has a placeholder date and is left out.
export function parseSchedule(j) {
  if (!j || typeof j !== 'object' || String(j.team?.id) !== TEAM || !Array.isArray(j.events) || j.events.length > MOST) return null;
  const out = [];
  for (const e of j.events) {
    const c = e?.competitions?.[0];
    if (typeof e?.id !== 'string' || !/^\d{1,15}$/.test(e.id) || typeof e.date !== 'string' || !ISO.test(e.date) || !Array.isArray(c?.competitors)) return null;
    if (!c.competitors.some(t => String(t?.id) === TEAM)) return null;
    const at = Date.parse(e.date);
    if (!Number.isFinite(at)) return null;
    if (e.timeValid === false || c.timeValid === false || /POSTPONED|CANCEL/.test(String(c.status?.type?.name || ''))) continue;
    out.push([e.id, at]);
  }
  return out;
}

// Both answers as one list by kick-off, each match once, from two days back to four months ahead.
export function combine(ahead, played, now) {
  const by = new Map();
  for (const [id, at] of played.concat(ahead)) if (at >= now - BACK && at <= now + AHEAD) by.set(id, at);
  return [...by].sort((a, b) => a[1] - b[1]);
}

// What the browser kept from the last read: { at: last good read, tried: last try, games }, or null if it is not that.
export function readCache(text) {
  let c;
  try { c = JSON.parse(text); } catch (e) { return null; }
  if (!c || c.v !== 1 || !Number.isFinite(c.at) || !Number.isFinite(c.tried) || !Array.isArray(c.games) || c.games.length > MOST) return null;
  if (!c.games.every(g => Array.isArray(g) && g.length === 2 && typeof g[0] === 'string' && Number.isFinite(g[1]))) return null;
  return { v: 1, at: c.at, tried: c.tried, games: c.games };
}
export const fresh = () => ({ v: 1, at: 0, tried: 0, games: [] });

// When the next read may go: six hours after a good one, two after a failed try. A time ahead of now (the clock was
// set back since) does not hold reads off.
export function readDue(c, now) {
  if (!c) return 0;
  const ok = c.at > now + 60e3 ? 0 : c.at, tried = c.tried > now + 60e3 ? 0 : c.tried;
  return Math.max(ok ? ok + READ_EVERY : 0, tried ? tried + RETRY : 0);
}

const dayOf = ms => { const v = vanTime(new Date(ms)); return v.y * 1e4 + v.m * 100 + v.d; };
// A game day is the Vancouver date of a kick-off, from midnight to midnight, and on until LATE after it.
export function gameOn(games, now) {
  let today = 0;
  for (const [, at] of games) {
    if (at < now - 2 * DAY || at > now + 2 * DAY) continue;
    if (now >= at && now < at + LATE) return true;
    if (dayOf(at) === (today ||= dayOf(now))) return true;
  }
  return false;
}

// ?matchday turns it on whatever the fixtures say, ?matchday=off off; either way nothing is read.
export function forced(search) {
  const q = new URLSearchParams(search);
  if (!q.has('matchday')) return null;
  return !/^(off|0|no|false)$/i.test(q.get('matchday'));
}
