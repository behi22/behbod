import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, LABOURS, LIVES, INTRO, PAUSE, LION, DESERT, DRAGON, CUPS, OLAD, ARZHANG, WHITE, newQuest, step, labour, cupX, status } from '../../web/src/pure/haftkhan.js';

const DT = 1 / 60;
// Steps the quest for `secs`, asking `play(st)` each step what to do: { x, left, right, presses }. Gathers the events.
function run(st, secs, play = () => ({})) {
  const out = [];
  for (let t = 0; t < secs && !st.done; t += DT) out.push(...step(st, DT, play(st)));
  return out;
}
const into = (st, i) => { st.labour = i; st.phase = 'won'; st.labour--; st.t = PAUSE; step(st, DT, {}); run(st, INTRO + 0.1); return st; };
const at = id => LABOURS.findIndex(l => l.id === id);
// A player who never misses: what a perfect run of each labour looks like.
function perfect(st) {
  const r = st.r, id = labour(st).id;
  if (st.phase === 'intro') return st.t > 0.5 ? { presses: [{}] } : {};
  if (st.phase !== 'play') return {};
  if (id === 'lion') return r.x >= LION.ring[0] + 10 && r.x <= LION.ring[1] - 10 && r.wait <= 0 && r.cool <= 0 ? { presses: [{}] } : {};
  if (id === 'desert') return { x: r.ram };
  if (id === 'dragon') return r.at ? { presses: [{ x: r.at.x, y: r.at.y }] } : {};
  if (id === 'sorceress') return r.stage === 'pick' ? { presses: [{ x: CUPS.slots[r.cups.indexOf(r.charmed)], y: 300 }] } : {};
  if (id === 'olad') return !r.lasso && r.ox > 200 && r.ox < 520 ? { presses: [{ x: r.ox + r.ov * OLAD.fly, y: 300 }] } : {};
  if (id === 'arzhang') return { presses: [{}] };
  return { x: r.rock ? (r.rock.x < FIELD.w / 2 ? 620 : 100) : r.rx, presses: r.open > 0 ? [{}] : [] };
}

test('seven labours in the order of the story, each with its words', () => {
  assert.deepEqual(LABOURS.map(l => l.id), ['lion', 'desert', 'dragon', 'sorceress', 'olad', 'arzhang', 'whitediv']);
  for (const l of LABOURS) assert.ok(l.name && l.how && l.how.length <= 60 && l.par > 0 && !/[\u2013\u2014]/.test(l.name + l.how), l.id);
});

test('a round starts with its words, which a press skips after a moment', () => {
  const st = newQuest(7);
  assert.equal(st.phase, 'intro');
  run(st, 0.2); step(st, DT, { presses: [{}] });
  assert.equal(st.phase, 'intro', 'too soon to skip');
  run(st, 0.25); step(st, DT, { presses: [{}] });
  assert.equal(st.phase, 'play');
  const st2 = newQuest(7);
  run(st2, INTRO + 0.05);
  assert.equal(st2.phase, 'play', 'or they go by themselves');
});

test('the lion: a strike in the ring lands, a strike too soon misses, three win, and a lion that reaches Rakhsh hurts', () => {
  const st = into(newQuest(3), 0), r = st.r;
  r.wait = 0; r.x = LION.ring[1] + 30;
  let ev = step(st, DT, { presses: [{}] });
  assert.deepEqual(ev.map(e => e.type), ['miss']);
  assert.ok(r.cool > 0);
  ev = [];
  for (let k = 0; k < 600 && st.phase === 'play'; k++) ev.push(...step(st, DT, perfect(st)));
  assert.equal(ev.filter(e => e.type === 'hit').length, LION.need);
  assert.ok(ev.some(e => e.type === 'won') && st.phase === 'won' && st.score >= 100);
  const st2 = into(newQuest(3), 0);
  ev = run(st2, 3.2);
  assert.ok(ev.some(e => e.type === 'hurt') && st2.lives === LIVES - 1 && st2.phase === 'hurt');
  run(st2, PAUSE + 0.1);
  assert.equal(st2.phase, 'intro'); assert.equal(labour(st2).id, 'lion', 'the same labour again');
  assert.equal(st2.r.kicks, 0, 'from the start');
});

test('the desert: keeping by the ram finds water; standing apart from it, thirst wins', () => {
  const st = into(newQuest(5), at('desert'));
  const ev = run(st, DESERT.fill + 1, perfect);
  assert.ok(ev.some(e => e.type === 'won'), 'found the spring');
  const st2 = into(newQuest(5), at('desert'));
  st2.r.rx = 40; st2.r.ram = st2.r.to = 680; st2.r.turn = 99;
  const ev2 = run(st2, DESERT.thirst + 0.5);
  assert.ok(ev2.some(e => e.type === 'hurt'));
  // The arrow keys walk Rostam too.
  const st3 = into(newQuest(5), at('desert')), x0 = st3.r.rx;
  run(st3, 0.5, () => ({ right: true }));
  assert.ok(st3.r.rx - x0 > DESERT.walk * 0.45 && st3.r.rx <= FIELD.w - 40);
});

test('the dragon: strikes land only while it shows, a key strikes what is in sight, and time runs out', () => {
  const st = into(newQuest(9), at('dragon')), r = st.r;
  r.at = { x: 300, y: 200 }; r.show = 1; r.hide = 0;
  assert.deepEqual(step(st, DT, { presses: [{ x: 500, y: 200 }] }).map(e => e.type), ['miss']);
  r.cool = 0;
  assert.deepEqual(step(st, DT, { presses: [{ x: 320, y: 210 }] }).map(e => e.type), ['hit']);
  assert.equal(r.at, null, 'it hides again when struck');
  r.cool = 0; r.at = null;
  assert.deepEqual(step(st, DT, { presses: [{}] }).map(e => e.type), ['miss'], 'nothing in sight');
  r.cool = 0; r.at = { x: 200, y: 200 }; r.show = 1;
  assert.deepEqual(step(st, DT, { presses: [{}] }).map(e => e.type), ['hit'], 'Space strikes what shows');
  const st2 = into(newQuest(9), at('dragon'));
  assert.ok(run(st2, DRAGON.limit + 0.5).some(e => e.type === 'hurt'));
  const st3 = into(newQuest(9), at('dragon'));
  assert.ok(run(st3, DRAGON.limit, perfect).some(e => e.type === 'won'));
});

test('the sorceress: the cups swap, the charmed one can be followed, and only it wins', () => {
  const st = into(newQuest(11), at('sorceress')), r = st.r;
  const charmed = r.charmed;
  // Mid-swap, two cups are between their slots, one lifted and one lowered.
  run(st, CUPS.show + CUPS.swap * 0.5);
  assert.equal(r.stage, 'shuffle');
  const [a, b] = r.swaps[0], A = cupX(r, r.cups[a]), B = cupX(r, r.cups[b]);
  assert.ok(A.x !== CUPS.slots[a] && B.x !== CUPS.slots[b] && Math.sign(A.lift) === -Math.sign(B.lift));
  run(st, CUPS.swaps * CUPS.swap + 0.1);
  assert.equal(r.stage, 'pick');
  assert.equal(r.charmed, charmed);
  const wrong = [0, 1, 2].find(s => r.cups[s] !== charmed);
  const st2 = JSON.parse(JSON.stringify(st));
  assert.ok(step(st2, DT, { presses: [{ x: CUPS.slots[wrong], y: 300 }] }).some(e => e.type === 'hurt'));
  assert.ok(step(st, DT, { presses: [{ x: CUPS.slots[r.cups.indexOf(charmed)], y: 300 }] }).some(e => e.type === 'won'));
  // With the keys: the arrows move the choice one cup a press, and Space picks it.
  const st3 = into(newQuest(11), at('sorceress'));
  run(st3, CUPS.show + CUPS.swaps * CUPS.swap + 0.2);
  const goal = st3.r.cups.indexOf(st3.r.charmed);
  step(st3, DT, { left: true }); step(st3, DT, { left: true }); step(st3, DT, {}); step(st3, DT, { left: true });
  assert.equal(st3.r.sel, 0, 'held, it moves once; pressed again, once more, and stops at the end');
  for (let k = 0; k < goal; k++) { step(st3, DT, { right: true }); step(st3, DT, {}); }
  assert.equal(st3.r.sel, goal);
  assert.ok(step(st3, DT, { presses: [{}] }).some(e => e.type === 'won'));
});

test('Olad: the lasso lands where it was thrown, catching him only if he is there', () => {
  const st = into(newQuest(13), at('olad')), r = st.r;
  r.ov = 0; r.ox = 300;
  step(st, DT, { presses: [{ x: 500, y: 300 }] });
  assert.equal(r.lasso.x, 500);
  assert.ok(run(st, OLAD.fly).some(e => e.type === 'miss') && r.lasso === null);
  step(st, DT, { presses: [{ x: 310, y: 300 }] });
  assert.ok(run(st, OLAD.fly + 0.05).some(e => e.type === 'won'));
  // From the keys, the throw goes to the aim, which the arrows move.
  const st2 = into(newQuest(13), at('olad'));
  st2.r.ov = 0; st2.r.ox = 600;
  run(st2, 0.6, () => ({ right: true }));
  step(st2, DT, { presses: [{}] });
  assert.ok(Math.abs(st2.r.lasso.x - st2.r.aim) < 10 && st2.r.aim > 560);
  const st3 = into(newQuest(13), at('olad'));
  assert.ok(run(st3, OLAD.limit + 0.5).some(e => e.type === 'hurt'));
  assert.ok(st3.r.ox >= 60 && st3.r.ox <= FIELD.w - 60, 'he stays on the field');
});

test('the div Arzhang: fast strikes push him back, and slow ones lose', () => {
  const st = into(newQuest(17), at('arzhang'));
  let n = 0;
  assert.ok(run(st, ARZHANG.limit, () => (n++ % 8 === 0 ? { presses: [{}] } : {})).some(e => e.type === 'won'), 'about seven a second wins');
  const st2 = into(newQuest(17), at('arzhang'));
  n = 0;
  assert.ok(run(st2, ARZHANG.limit + 0.5, () => (n++ % 40 === 0 ? { presses: [{}] } : {})).some(e => e.type === 'hurt'), 'one and a half a second loses');
});

test('the White Div: a rock falls where Rostam stood; out of its way, he is open to three strikes', () => {
  const st = into(newQuest(19), at('whitediv'));
  const ev = run(st, 2.5);
  assert.ok(ev.some(e => e.type === 'hurt'), 'standing still, the rock lands on him');
  const st2 = into(newQuest(19), at('whitediv'));
  const ev2 = run(st2, 12, perfect);
  assert.equal(ev2.filter(e => e.type === 'dodge').length, WHITE.need);
  assert.ok(ev2.some(e => e.type === 'won'));
  // A strike while he is not open misses, and does not count.
  const st3 = into(newQuest(19), at('whitediv'));
  assert.deepEqual(step(st3, DT, { presses: [{}] }).map(e => e.type), ['miss']);
  assert.equal(st3.r.strikes, 0);
});

test('a perfect quest: all seven, a score for each and the lives kept, then the end', () => {
  for (const seed of [1, 2, 3, 42, 2026]) {
    const st = newQuest(seed), ev = run(st, 200, perfect);
    assert.ok(st.done && st.won, `seed ${seed} at ${labour(st).id}`);
    assert.equal(ev.filter(e => e.type === 'won').length, 7);
    assert.equal(st.lives, LIVES);
    assert.ok(st.score >= 700 + LIVES * 50, `${st.score}`);
    assert.deepEqual(ev.at(-1), { type: 'end', won: true, score: st.score });
    assert.equal(step(st, DT, { presses: [{}] }).length, 0, 'over is over');
  }
});

test('three losses end it; the same seed plays the same; odd steps change nothing', () => {
  const st = newQuest(5), ev = run(st, 60);
  assert.ok(st.done && !st.won && st.lives === 0 && ev.at(-1).type === 'end' && ev.at(-1).won === false);
  assert.equal(labour(st).id, 'lion');
  const a = newQuest(77), b = newQuest(77);
  run(a, 30, perfect); run(b, 30, perfect);
  assert.deepEqual(a, b);
  const c = newQuest(8), before = JSON.stringify(c);
  for (const dt of [0, -1, NaN, undefined]) step(c, dt, { presses: [{}] });
  assert.equal(JSON.stringify(c), before);
  step(c, 5, {});
  assert.ok(c.t <= 0.05 + 1e-9, 'a long stall counts as one short step');
  assert.equal(status(newQuest(1)), 'labour 1 of 7   score 0   lives 3');
});
