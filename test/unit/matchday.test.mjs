import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, TEAM, READ_EVERY, RETRY, LATE, parseSchedule, combine, readCache, fresh, readDue, gameOn, forced } from '../../web/src/pure/matchday.js';

const H = 3600e3, D = 24 * H, ms = s => Date.parse(s);
// One match the way ESPN's schedule lists it (trimmed to the fields read, plus a few it also sends).
const match = (id, date, { home = TEAM, away = '85', timeValid = true, status = 'STATUS_SCHEDULED' } = {}) => ({
  id, date, name: 'Celta Vigo at Real Madrid', timeValid,
  competitions: [{ id, date, timeValid, competitors: [{ id: home, homeAway: 'home', team: { id: home } }, { id: away, homeAway: 'away', team: { id: away } }], status: { type: { name: status, state: 'pre' } } }],
});
const answer = events => ({ timestamp: '2026-11-21T15:06:44Z', status: 'success', team: { id: TEAM, abbreviation: 'RMA' }, events });

test('reads both lists of every competition from ESPN, over https and with no key', () => {
  assert.equal(SOURCES.length, 2);
  for (const u of SOURCES) {
    const url = new URL(u);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'site.web.api.espn.com');
    assert.match(url.pathname, /\/soccer\/all\/teams\/86\/schedule$/);
    assert.ok(![...url.searchParams.keys()].some(k => /key|token|auth/i.test(k)));
  }
  assert.ok(SOURCES.some(u => new URL(u).searchParams.get('fixture') === 'true'), 'what is to come');
  assert.ok(SOURCES.some(u => !new URL(u).searchParams.has('fixture')), 'what has been played');
});

test('a schedule gives each confirmed kick-off, home or away', () => {
  const got = parseSchedule(answer([match('401882798', '2026-11-21T20:00Z'), match('401882801', '2026-11-24T20:00:00Z', { home: '9', away: TEAM }), match('7', '2026-12-02T18:00:00.000Z')]));
  assert.deepEqual(got, [['401882798', ms('2026-11-21T20:00Z')], ['401882801', ms('2026-11-24T20:00Z')], ['7', ms('2026-12-02T18:00Z')]]);
  assert.deepEqual(parseSchedule(answer([])), [], 'an empty season is a good answer');
});

test('a kick-off still to be fixed, a postponed match and a called-off one are left out', () => {
  const got = parseSchedule(answer([
    match('1', '2026-12-13T20:00Z', { timeValid: false }),
    match('2', '2026-12-14T20:00Z', { status: 'STATUS_POSTPONED' }),
    match('3', '2026-12-15T20:00Z', { status: 'STATUS_CANCELED' }),
    match('4', '2026-12-16T20:00Z', { status: 'STATUS_FULL_TIME' }),
  ]));
  assert.deepEqual(got, [['4', ms('2026-12-16T20:00Z')]]);
  const one = match('5', '2026-12-17T20:00Z');
  one.competitions[0].timeValid = false;
  assert.deepEqual(parseSchedule(answer([one])), []);
});

test('an answer that is not what ESPN sends is refused whole', () => {
  const good = () => answer([match('1', '2026-11-21T20:00Z'), match('2', '2026-11-28T20:00Z')]);
  const bad = [
    null, undefined, 'Service Unavailable', 42, [], {},
    { ...good(), team: { id: '83' } },
    { ...good(), team: undefined },
    { ...good(), events: 'none' },
    answer(Array.from({ length: 201 }, (_, i) => match(String(i), '2026-11-21T20:00Z'))),
  ];
  for (const b of bad) assert.equal(parseSchedule(b), null, JSON.stringify(b)?.slice(0, 60));
  const broken = [
    e => { delete e.date; }, e => { e.date = 'tomorrow'; }, e => { e.date = '2026-13-45T20:00Z'; }, e => { e.date = 1763755200000; },
    e => { e.id = 'x1'; }, e => { e.id = 401882798; }, e => { e.competitions = []; }, e => { e.competitions[0].competitors = null; },
    e => { e.competitions[0].competitors.forEach(t => { t.id = '1'; }); },
  ];
  for (const spoil of broken) {
    const a = good();
    spoil(a.events[1]);
    assert.equal(parseSchedule(a), null, spoil.toString());
  }
  const holes = good();
  holes.events.push(null);
  assert.equal(parseSchedule(holes), null);
});

test('the two lists become one, each match once, by kick-off, from two days back to four months ahead', () => {
  const now = ms('2026-11-21T15:00Z');
  const ahead = [['3', now + 3 * D], ['1', now + 5 * H], ['9', now + 200 * D]];
  const played = [['1', now + 5 * H], ['0', now - D], ['8', now - 3 * D]];
  assert.deepEqual(combine(ahead, played, now), [['0', now - D], ['1', now + 5 * H], ['3', now + 3 * D]]);
  assert.deepEqual(combine([['1', now + 2 * H]], [['1', now + 5 * H]], now), [['1', now + 2 * H]], 'what is to come has the latest time');
});

test('what the browser kept comes back only when it is whole', () => {
  const c = { v: 1, at: 100, tried: 200, games: [['1', 5], ['2', 6]] };
  assert.deepEqual(readCache(JSON.stringify(c)), c);
  for (const t of [null, '', 'undefined', '{', '[]', '{}', JSON.stringify({ ...c, v: 2 }), JSON.stringify({ ...c, at: 'x' }), JSON.stringify({ ...c, tried: null }),
    JSON.stringify({ ...c, games: [['1']] }), JSON.stringify({ ...c, games: [[1, 5]] }), JSON.stringify({ ...c, games: [['1', 'x']] }), JSON.stringify({ ...c, games: {} }),
    JSON.stringify({ ...c, games: Array.from({ length: 201 }, (_, i) => [String(i), i]) })]) {
    assert.equal(readCache(t), null, String(t));
  }
  assert.deepEqual(fresh(), { v: 1, at: 0, tried: 0, games: [] });
});

test('a read goes at once the first time, six hours after a good one and two after a failed try', () => {
  const now = ms('2026-11-21T15:00Z');
  assert.equal(readDue(null, now), 0);
  assert.equal(readDue(fresh(), now), 0);
  assert.equal(readDue({ ...fresh(), at: now, tried: now }, now), now + READ_EVERY);
  assert.equal(readDue({ ...fresh(), at: now - 7 * H, tried: now }, now), now + RETRY, 'failed just now');
  assert.equal(readDue({ ...fresh(), at: 0, tried: now - H }, now), now - H + RETRY, 'never read, failed an hour ago');
  assert.equal(readDue({ ...fresh(), at: now + D, tried: now + D }, now), 0, 'a clock set back does not hold reads off');
  assert.ok(READ_EVERY >= 4 * H && RETRY >= H, 'a few reads a day at most');
});

// British Columbia has kept daylight time all year since its last change, on 2026-03-08: midnight is 07:00 UTC.
test('a game day is the Vancouver date of the kick-off, midnight to midnight', () => {
  const games = [['1', ms('2026-11-21T20:00Z')]];
  assert.equal(gameOn(games, ms('2026-11-21T06:59:59Z')), false, '23:59 the night before');
  assert.equal(gameOn(games, ms('2026-11-21T07:00Z')), true, 'midnight in Vancouver');
  assert.equal(gameOn(games, ms('2026-11-21T19:00Z')), true, 'before kick-off');
  assert.equal(gameOn(games, ms('2026-11-22T02:00Z')), true, 'the evening after the final whistle');
  assert.equal(gameOn(games, ms('2026-11-22T06:59Z')), true, '23:59 that night');
  assert.equal(gameOn(games, ms('2026-11-22T07:00Z')), false, 'the next day');
  assert.equal(gameOn([], ms('2026-11-21T20:00Z')), false);
});

test('a match on the next day in Madrid but still today in Vancouver lights today, and a late one runs past midnight', () => {
  // 19:00 in Vancouver is 03:00 the next morning in Madrid.
  const evening = [['1', ms('2026-11-25T02:00Z')]];
  assert.equal(gameOn(evening, ms('2026-11-24T09:00Z')), true, 'the 24th in Vancouver');
  assert.equal(gameOn(evening, ms('2026-11-25T09:00Z')), false, "the 25th in Vancouver, Madrid's date");
  const late = [['2', ms('2026-11-25T06:00Z')]]; // 23:00 on the 24th
  assert.equal(gameOn(late, ms('2026-11-25T07:30Z')), true, 'half past midnight, the match still on');
  assert.equal(gameOn(late, ms('2026-11-25T06:00Z') + LATE - 1), true);
  assert.equal(gameOn(late, ms('2026-11-25T06:00Z') + LATE), false, 'over');
  assert.equal(gameOn(late, ms('2026-11-24T07:00Z')), true, 'all of the 24th');
});

test('a game day keeps Vancouver midnight across the last clock change', () => {
  // Sunday 2026-03-08 was 23 hours long: 08:00Z to 07:00Z.
  const spring = [['1', ms('2026-03-08T13:00Z')]];
  assert.equal(gameOn(spring, ms('2026-03-08T07:59Z')), false);
  assert.equal(gameOn(spring, ms('2026-03-08T08:00Z')), true);
  assert.equal(gameOn(spring, ms('2026-03-09T06:59Z')), true);
  assert.equal(gameOn(spring, ms('2026-03-09T07:00Z')), false);
  // The day before it was 24 hours of standard time, 08:00Z to 08:00Z.
  const before = [['2', ms('2026-03-07T13:00Z')]];
  assert.equal(gameOn(before, ms('2026-03-08T07:59Z')), true);
  assert.equal(gameOn(before, ms('2026-03-08T08:00Z')), false);
});

test('?matchday turns it on, ?matchday=off off, and neither reads', () => {
  assert.equal(forced(''), null);
  assert.equal(forced('?q=low&auto'), null);
  for (const s of ['?matchday', '?auto&matchday', '?matchday=1', '?matchday=on']) assert.equal(forced(s), true, s);
  for (const s of ['?matchday=off', '?matchday=0', '?matchday=no', '?matchday=OFF']) assert.equal(forced(s), false, s);
});
