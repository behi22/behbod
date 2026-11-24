import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, weekKey, sinSame, hypotSame, same, savePoints, makeRecorder, makeSearch, pack, unpack, choose, rate, length, frameAt, HZ, BEFORE, AFTER } from '../../web/src/pure/replay.js';
import { newMatch, stepMatch, LEN, GOAL } from '../../web/src/pure/match.js';

const seeded = (s = 9) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const week = '2026-W47';

test('the week is the ISO week: Monday to Sunday, week 1 holding the year\'s first Thursday', () => {
  assert.deepEqual(isoWeek(2026, 11, 21), { year: 2026, week: 47 });
  assert.deepEqual(isoWeek(2026, 11, 16), { year: 2026, week: 47 });
  assert.deepEqual(isoWeek(2026, 11, 15), { year: 2026, week: 46 });
  assert.deepEqual(isoWeek(2026, 12, 31), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek(2027, 1, 3), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek(2027, 1, 4), { year: 2027, week: 1 });
  assert.deepEqual(isoWeek(2024, 12, 30), { year: 2025, week: 1 });
});

test('by the calendar in Vancouver: Monday early in the morning there is already Monday in London, still Sunday there', () => {
  // Whichever offset Vancouver keeps (7 or 8 hours behind), 05:00 in London on a Monday is Sunday evening there.
  assert.equal(weekKey(new Date('2026-11-23T05:00:00Z')), '2026-W47');
  assert.equal(weekKey(new Date('2026-11-23T12:00:00Z')), '2026-W48');
  assert.equal(weekKey(new Date('2026-06-15T05:00:00Z')), '2026-W24');
  assert.equal(weekKey(new Date('2026-06-15T12:00:00Z')), '2026-W25');
  assert.equal(weekKey(new Date('2027-01-04T05:00:00Z')), '2026-W53');
  assert.equal(weekKey(new Date('2027-01-04T12:00:00Z')), '2027-W01');
});

test('the plain-arithmetic sine and hypot agree with the browser\'s, and the swap always puts them back', () => {
  const r = seeded(4);
  for (let i = 0; i < 2000; i++) { const x = (r() - 0.5) * 2000; assert.ok(Math.abs(sinSame(x) - Math.sin(x)) < 1e-9, `${x}`); }
  assert.equal(hypotSame(3, 4), 5);
  const { sin, hypot } = Math;
  assert.throws(() => same(() => { assert.equal(Math.sin, sinSame); throw new Error('x'); }));
  assert.equal(Math.sin, sin); assert.equal(Math.hypot, hypot);
});

test('harder saves score more: further to go, nearer the post, struck from closer', () => {
  const base = { travel: 0.5, line: 0.5, from: 10 };
  assert.ok(savePoints({ ...base, travel: 1.5 }) > savePoints(base));
  assert.ok(savePoints({ ...base, line: GOAL }) > savePoints(base));
  assert.ok(savePoints({ ...base, from: 4 }) > savePoints(base));
  assert.equal(savePoints({ travel: 0, line: 0, from: 30 }), 0);
  assert.equal(savePoints({ travel: 1, line: 9, from: 1 }), 2 + 1.5 + 1);
});

// The house's match for a week, played to the end.
const played = (w, opts) => { const s = makeSearch(w, opts); while (!s.run(400)); return s; };

test('the house\'s save of the week: a real save by BEHI FC\'s keeper, the same every time for the same week', () => {
  const a = played(week), b = played(week);
  assert.ok(a.best);
  assert.deepEqual(a.best, b.best);
  const c = a.best;
  assert.equal(c.week, week); assert.equal(c.who, 'house');
  assert.ok(c.frames.every(f => f.length === 22 && f.every(Number.isFinite)));
  assert.ok(c.save >= 1 && c.save < c.frames.length && c.frames.length <= Math.round((BEFORE + AFTER) * HZ) + 2);
  // At the save BEHI FC's keeper (the first player) has the ball, by its own goal.
  const f = c.frames[c.save];
  assert.ok(Math.hypot(f[0] - f[2], f[1] - f[3]) < 1, `${f.slice(0, 4)}`);
  assert.ok(f[2] < -LEN * 0.7);
  assert.ok(c.points > 0 && c.minute >= 0 && c.minute <= 90);
  // Another week, another save.
  assert.notDeepEqual(played('2026-W48').best.frames, c.frames);
});

test('it comes out the same whatever the browser\'s own sine and hypot round to', () => {
  const { sin, hypot } = Math, ref = played('2026-W30').best;
  Math.sin = x => sin(x) * (1 + 2e-16); Math.hypot = (...v) => hypot(...v) * (1 - 2e-16);
  try { assert.deepEqual(played('2026-W30').best, ref); } finally { Math.sin = sin; Math.hypot = hypot; }
});

test('every week of three years has a save, and the match never runs past thirty minutes', () => {
  for (const y of [2026, 2027, 2028]) for (let w = 1; w <= 52; w += 5) {
    const s = played(`${y}-W${String(w).padStart(2, '0')}`);
    assert.ok(s.best, `${y}-W${w}`);
    assert.ok(s.clock <= 1800 + 1e-6);
  }
});

test('a few steps at a time it is the same match as all at once', () => {
  const s = makeSearch(week);
  while (!s.run(7));
  assert.deepEqual(s.best, played(week).best);
});

// A person in goal for BEHI FC who moves across with the ball and dives at anything close.
function keeperMatch(secs, rand) {
  const m = newMatch({ kickoff: 1 }), rec = makeRecorder(), clips = [], STEP = 1 / 60;
  m.aggro = [0.6, 1.5];
  const you = m.players.find(p => p.team === 0 && p.role === 'keeper');
  let saves = 0;
  for (let t = 0; t < secs; t += STEP) {
    const b = m.ball, dy = Math.sign(Math.max(-GOAL, Math.min(GOAL, b.y)) - you.y);
    const ev = stepMatch(m, STEP, rand, { player: you, dx: 0, dy: Math.abs(b.y - you.y) > 0.2 ? dy : 0, dive: b.shot === 1 && Math.hypot(b.x - you.x, b.y - you.y) < 2.5 });
    saves += ev.filter(e => e === 'save').length;
    const c = rec.step(m, ev, STEP, () => (t / secs) * 90);
    if (c) clips.push(c);
  }
  return { clips, saves, rec };
}

test('a save I make as keeper is filmed: the 2.5 seconds before it and the second after', () => {
  const { clips, saves } = keeperMatch(90, seeded(2));
  assert.ok(saves >= 1, `${saves} saves`);
  assert.equal(clips.length, saves);
  for (const c of clips) {
    assert.ok(c.save <= Math.round(BEFORE * HZ) + 1 && c.save >= 1);
    assert.equal(c.frames.length - 1 - c.save, Math.round(AFTER * HZ));
    const f = c.frames[c.save];
    assert.ok(Math.hypot(f[0] - f[2], f[1] - f[3]) < 1.7);
  }
});

test('only BEHI FC\'s keeper\'s saves count, and a save still being filmed at the end is kept', () => {
  const m = newMatch(), rec = makeRecorder(), k1 = m.players.find(p => p.team === 1 && p.role === 'keeper');
  m.ball.shot = 0; rec.step(m, [], 1 / 30);
  m.ball.owner = k1; m.ball.shot = null;
  assert.equal(rec.step(m, ['bot-save'], 1 / 30), null);
  assert.equal(rec.flush(), null);
  // BEHI FC's keeper saves a shot; the match ends a moment later.
  const k0 = m.players.find(p => p.team === 0 && p.role === 'keeper');
  Object.assign(m.ball, { owner: null, shot: 1, x: -10, y: 2, vx: -17, vy: 0 });
  rec.step(m, [], 1 / 30);
  k0.y = 1.5;
  Object.assign(m.ball, { owner: k0, shot: null, vx: 0 });
  assert.equal(rec.step(m, ['bot-save'], 1 / 30), null);
  rec.step(m, [], 1 / 30);
  const c = rec.flush();
  assert.ok(c && c.frames.length - 1 - c.save === 1);
  assert.equal(c.points, savePoints({ travel: Math.abs(1.5 - 0), line: 2, from: 10 }));
});

test('a kept save comes back exactly, and anything else in storage is ignored', () => {
  const c = { ...played(week).best, who: 'you' }, text = pack(c), back = unpack(text, week);
  assert.deepEqual(back, { v: 1, week, who: 'you', points: c.points, save: c.save, minute: c.minute, goals: c.goals, frames: c.frames });
  assert.equal(unpack(text, '2026-W48'), null);
  const bad = o => unpack(JSON.stringify({ ...JSON.parse(text), ...o }), week);
  assert.equal(bad({ v: 2 }), null);
  assert.equal(bad({ points: 'lots' }), null);
  assert.equal(bad({ points: -1 }), null);
  assert.equal(bad({ save: 999 }), null);
  assert.equal(bad({ minute: 91 }), null);
  assert.equal(bad({ goals: [1] }), null);
  assert.equal(bad({ frames: c.frames.map((f, i) => (i === 3 ? f.slice(1) : f)) }), null);
  assert.equal(bad({ frames: c.frames.map((f, i) => (i === 3 ? [...f.slice(0, 21), 99] : f)) }), null);
  assert.equal(bad({ frames: c.frames.slice(0, 5) }), null);
  for (const t of [null, undefined, '', 'nope', '{', '[]', 'null', '{}', 'x'.repeat(70000)]) assert.equal(unpack(t, week), null);
});

test('my save is the save of the week only if it is this week\'s and better than the house\'s', () => {
  const house = { week, who: 'house', points: 2.4 }, mine = { week, who: 'you', points: 3.1 };
  assert.equal(choose(house, mine, week), mine);
  assert.equal(choose(house, { ...mine, points: 2.4 }, week), house);
  assert.equal(choose(house, { ...mine, week: '2026-W46' }, week), house);
  assert.equal(choose(null, mine, week), mine);
  assert.equal(choose(null, null, week), null);
  assert.equal(choose(house, null, week), house);
});

test('played back eased between pictures, a third as fast round the save', () => {
  const c = played(week).best, at = c.save / HZ;
  assert.equal(rate(c, at), 0.3);
  assert.equal(rate(c, at - 1), 1);
  assert.equal(rate(c, at + 0.6), 1);
  assert.equal(length(c), (c.frames.length - 1) / HZ);
  const m = frameAt(c, 0.5 / HZ), a = c.frames[0], b = c.frames[1];
  assert.ok(Math.abs(m.ball.x - (a[0] + b[0]) / 2) < 1e-9 && Math.abs(m.players[3].y - (a[9] + b[9]) / 2) < 1e-9);
  assert.equal(m.players.length, 10);
  assert.equal(frameAt(c, 99, m), m);
  assert.deepEqual([m.ball.x, m.ball.y], c.frames.at(-1).slice(0, 2));
  assert.deepEqual([frameAt(c, -1).ball.x], [c.frames[0][0]]);
});
