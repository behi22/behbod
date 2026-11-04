import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../web/src/games/pure/chess.js';
import * as B from '../../web/src/games/pure/backgammon.js';
import * as S from '../../web/src/games/pure/striker.js';

// ---------- chess ----------
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const find = (s, from, to, promo = 0) => C.legalMoves(s).find(m => m.from === C.sqFrom(from) && m.to === C.sqFrom(to) && (!promo || m.promo === promo));
const play = (s, ...uci) => uci.reduce((st, u) => { const m = find(st, u.slice(0, 2), u.slice(2, 4)); assert.ok(m, `illegal ${u}`); return C.makeMove(st, m); }, s);

test('perft from the start position: 20, 400, 8902', () => {
  const s = C.newGame();
  assert.equal(C.perft(s, 1), 20);
  assert.equal(C.perft(s, 2), 400);
  assert.equal(C.perft(s, 3), 8902);
});

test('perft on Kiwipete, the standard tricky position: 48, 2039, 97862', () => {
  const s = C.parseFEN(KIWIPETE);
  assert.equal(C.perft(s, 1), 48);
  assert.equal(C.perft(s, 2), 2039);
  assert.equal(C.perft(s, 3), 97862);
});

test('perft on positions with pins, en passant and promotions', () => {
  assert.equal(C.perft(C.parseFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 4), 43238);
  assert.equal(C.perft(C.parseFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), 3), 9467);
  assert.equal(C.perft(C.parseFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), 3), 62379);
});

test('FEN goes in and comes back out the same', () => {
  for (const fen of [C.START, KIWIPETE, '8/8/8/8/8/8/8/K6k b - - 12 40']) assert.equal(C.toFEN(C.parseFEN(fen)), fen);
});

test('checkmate is found and names the winner', () => {
  const mate = play(C.newGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  const st = C.status(mate);
  assert.equal(st.result, 'checkmate');
  assert.equal(st.winner, -1);
  assert.equal(st.over, true);
});

test('stalemate is a draw, not a loss', () => {
  const st = C.status(C.parseFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
  assert.equal(st.result, 'stalemate');
  assert.equal(st.winner, 0);
  assert.equal(st.check, false);
});

test('check without mate is not the end', () => {
  const s = play(C.newGame(), 'e2e4', 'f7f6', 'd1h5');
  const st = C.status(s);
  assert.equal(st.check, true);
  assert.equal(st.over, false);
  assert.ok(st.moves.length > 0);
});

test('castling moves the rook, and both sides work', () => {
  const s = C.parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const short = C.makeMove(s, find(s, 'e1', 'g1'));
  assert.equal(short.b[C.sqFrom('f1')], C.R);
  assert.equal(short.b[C.sqFrom('h1')], 0);
  assert.equal(short.b[C.sqFrom('g1')], C.K);
  const long = C.makeMove(s, find(s, 'e1', 'c1'));
  assert.equal(long.b[C.sqFrom('d1')], C.R);
  assert.equal(long.b[C.sqFrom('a1')], 0);
  assert.equal(long.castle & 3, 0, 'white loses both rights after castling');
  const b = C.parseFEN('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
  const black = C.makeMove(b, find(b, 'e8', 'c8'));
  assert.equal(black.b[C.sqFrom('d8')], -C.R);
  assert.equal(black.b[C.sqFrom('c8')], -C.K);
});

test('no castling out of, through or into check', () => {
  const castles = fen => C.legalMoves(C.parseFEN(fen)).filter(m => m.flag === 3 || m.flag === 4).map(m => C.sqName(m.to)).sort();
  assert.deepEqual(castles('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), ['c1', 'g1']);
  assert.deepEqual(castles('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1'), [], 'in check');
  assert.deepEqual(castles('r3k2r/8/8/8/5r2/8/8/R3K2R w KQkq - 0 1'), ['c1'], 'f1 is attacked');
  assert.deepEqual(castles('r3k2r/8/8/8/6r1/8/8/R3K2R w KQkq - 0 1'), ['c1'], 'g1 is attacked');
  assert.deepEqual(castles('r3k2r/8/8/8/1r6/8/8/R3K2R w KQkq - 0 1'), ['c1', 'g1'], 'b1 attacked does not stop the long castle');
  assert.deepEqual(castles('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1'), ['g1'], 'a piece in the way');
});

test('castling rights go when the king or a rook moves or the rook is taken', () => {
  let s = C.parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  s = play(s, 'h1h2', 'a8a7');
  assert.equal(s.castle, 2 | 4, 'white keeps queen side, black keeps king side');
  s = play(C.parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1e2', 'e8e7', 'e2e1', 'e7e8');
  assert.equal(s.castle, 0);
  s = play(C.parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'a1a8');
  assert.equal(s.castle & 8, 0, 'black loses queen side when the a8 rook is taken');
  assert.equal(s.castle & 2, 0);
});

test('en passant only right after the double step', () => {
  let s = play(C.newGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5');
  const ep = find(s, 'e5', 'd6');
  assert.ok(ep && ep.flag === 2);
  const after = C.makeMove(s, ep);
  assert.equal(after.b[C.sqFrom('d5')], 0, 'the passed pawn is taken');
  s = play(C.newGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'h7h6');
  assert.equal(find(s, 'e5', 'd6'), undefined, 'too late');
});

test('promotion offers all four pieces and the queen lands', () => {
  const s = C.parseFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  const promos = C.legalMoves(s).filter(m => m.from === C.sqFrom('a7')).map(m => m.promo).sort();
  assert.deepEqual(promos, [C.N, C.B, C.R, C.Q].sort());
  assert.equal(C.makeMove(s, find(s, 'a7', 'a8', C.Q)).b[C.sqFrom('a8')], C.Q);
});

test('SAN covers captures, checks, mates, castling and doubled knights', () => {
  const s = play(C.newGame(), 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6');
  assert.equal(C.toSAN(s, find(s, 'e1', 'g1')), 'O-O');
  assert.equal(C.toSAN(s, find(s, 'f3', 'e5')), 'Nxe5');
  const mate = play(C.newGame(), 'f2f3', 'e7e5', 'g2g4');
  assert.equal(C.toSAN(mate, find(mate, 'd8', 'h4')), 'Qh4#');
  const two = C.parseFEN('k7/8/8/8/8/8/8/KN3N2 w - - 0 1');
  assert.equal(C.toSAN(two, find(two, 'b1', 'd2')), 'Nbd2');
});

test('draws: bare kings, fifty moves and threefold repetition', () => {
  assert.equal(C.status(C.parseFEN('8/8/4k3/8/8/3K4/8/8 w - - 0 1')).result, 'material');
  assert.equal(C.status(C.parseFEN('8/8/4k3/8/8/3KN3/8/8 w - - 0 1')).result, 'material');
  assert.equal(C.status(C.parseFEN('8/8/4k3/8/8/3KR3/8/8 w - - 100 80')).result, 'fifty');
  let s = C.newGame();
  const keys = [C.positionKey(s)];
  for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) { s = play(s, u); keys.push(C.positionKey(s)); }
  assert.equal(C.status(s, keys).result, 'repetition');
});

test('the bot takes a free queen and finds mate in one', () => {
  const hanging = C.parseFEN('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
  const m = C.bestMove(hanging, { rng: () => 0 });
  assert.equal(C.sqName(m.to), 'd5');
  const backRank = C.parseFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const mate = C.bestMove(backRank, { rng: () => 0 });
  assert.equal(C.toSAN(backRank, mate), 'Ra8#');
});

test('the bot answers within its time budget and never under-promotes', () => {
  const t = Date.now();
  const m = C.bestMove(C.parseFEN(KIWIPETE), { timeMs: 800 });
  assert.ok(Date.now() - t < 1000, `took ${Date.now() - t} ms`);
  assert.ok(C.legalMoves(C.parseFEN(KIWIPETE)).some(x => x.from === m.from && x.to === m.to));
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    const promo = C.bestMove(C.parseFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1'), { rng: () => r });
    assert.equal(promo.promo, C.Q, 'promotes now rather than later');
    const grab = C.bestMove(C.parseFEN('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1'), { rng: () => r });
    assert.equal(C.sqName(grab.to), 'd5', 'takes the queen now');
  }
  assert.equal(C.bestMove(C.parseFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), null, 'no move in stalemate');
});

// ---------- backgammon ----------
// Builds a position from { point: count } maps in each side's own numbering (1 to 24, 25 is the bar).
function pos(you, them) {
  const side = m => { const a = new Array(25).fill(0); for (const [p, n] of Object.entries(m)) a[+p - 1] = n; return a; };
  return { b: [side(you), side(them)] };
}
const usesBoth = seqs => seqs.every(s => s.length === 2);

test('the start position has 15 each and 167 pips', () => {
  const s = B.newGame();
  assert.equal(B.onBoard(s, 0), 15);
  assert.equal(B.onBoard(s, 1), 15);
  assert.equal(B.pipCount(s, 0), 167);
  assert.equal(B.pipCount(s, 1), 167);
});

test('a checker on the bar must enter before anything else moves', () => {
  const s = pos({ 25: 1, 13: 5, 6: 5 }, { 6: 2 });
  const seqs = B.legalSequences(s, 0, 4, 2);
  assert.ok(seqs.length);
  for (const seq of seqs) assert.equal(seq[0].from, B.BAR);
  // Either die can enter: a 4 lands on my 21 point and a 2 on my 23.
  const entries = new Set(B.nextMoves(seqs, []).map(m => m.to + 1));
  assert.deepEqual([...entries].sort(), [21, 23]);
});

test('entry blocked by made points leaves only the open one, and a full block passes the turn', () => {
  const s = pos({ 25: 1, 8: 3 }, { 6: 2, 5: 2 });
  const seqs = B.legalSequences(s, 0, 6, 5);
  assert.deepEqual(seqs, [[]], 'both entry points are made, so nothing moves');
  assert.equal(B.turnDone(seqs, []), true);
  const one = B.legalSequences(pos({ 25: 1, 8: 3 }, { 6: 2 }), 0, 6, 3);
  for (const seq of one) assert.equal(seq[0].to + 1, 22, 'only the 3 enters');
});

test('two on the bar with a double enter first, then the rest of the double is free', () => {
  const s = pos({ 25: 2, 13: 3 }, { 1: 2 });
  const seqs = B.legalSequences(s, 0, 3, 3);
  assert.ok(seqs.length);
  for (const seq of seqs) {
    assert.equal(seq.length, 4);
    assert.equal(seq[0].from, B.BAR);
    assert.equal(seq[1].from, B.BAR);
  }
});

test('hitting a blot sends it to the bar', () => {
  const s = pos({ 13: 1 }, { 15: 1 });
  const m = B.canMove(s, 0, 12, 3);
  assert.equal(m.hit, true);
  const after = B.applyMove(s, 0, m);
  assert.equal(after.b[1][B.BAR], 1);
  assert.equal(after.b[1][14], 0);
  assert.equal(B.canMove(pos({ 13: 1 }, { 15: 2 }), 0, 12, 3), null, 'two checkers make a point');
});

test('both dice must be used when they can be, even if that forces the order', () => {
  // The bot's 6 point is my 19, so a 5 first is blocked; the 4 then the 5 uses both dice.
  const s = pos({ 24: 1 }, { 6: 2 });
  const seqs = B.legalSequences(s, 0, 5, 4);
  assert.ok(seqs.length > 0);
  assert.ok(usesBoth(seqs));
  for (const seq of seqs) assert.deepEqual(seq.map(m => m.die), [4, 5]);
  // Entering with the 4 strands the 2 (my 19 and 11 are held), entering with the 2 lets the 13 play the 4.
  const bar = B.legalSequences(pos({ 25: 1, 13: 1 }, { 6: 2, 14: 2 }), 0, 4, 2);
  assert.deepEqual(bar.map(s => s.map(m => `${m.from + 1}/${m.to + 1}`)), [['25/23', '13/9']]);
});

test('if only one die can be used it must be the larger one', () => {
  // From 13 a 6 or a 5 is open, but both lead on to my 2 point, which the bot holds (its 23).
  const s = pos({ 13: 1 }, { 23: 2 });
  const seqs = B.legalSequences(s, 0, 6, 5);
  assert.ok(seqs.length);
  for (const seq of seqs) { assert.equal(seq.length, 1); assert.equal(seq[0].die, 6); }
});

test('doubles play four times, or as many as fit', () => {
  const free = B.legalSequences(pos({ 13: 2, 24: 2 }, { 1: 2 }), 0, 2, 2);
  assert.ok(free.every(s => s.length === 4));
  // One checker, 13 to 10 to 7, and then my 4 point is held (the bot's 21).
  const blocked = B.legalSequences(pos({ 13: 1 }, { 21: 2 }), 0, 3, 3);
  assert.ok(blocked.every(s => s.length === 2));
  assert.equal(B.diceList(4, 4).length, 4);
});

test('bearing off: exact roll, a bigger roll from the highest point, and never with a checker outside', () => {
  const home = pos({ 4: 1, 2: 2 }, { 13: 2 });
  assert.equal(B.canMove(home, 0, 3, 4).to, B.OFF, 'exact');
  assert.equal(B.canMove(home, 0, 3, 6).to, B.OFF, 'bigger than needed from the highest point');
  assert.equal(B.canMove(home, 0, 1, 6), null, 'a checker sits higher, so the 2 point cannot use a 6');
  assert.equal(B.canMove(home, 0, 1, 2).to, B.OFF);
  const outside = pos({ 7: 1, 2: 2 }, { 13: 2 });
  assert.equal(B.canMove(outside, 0, 1, 2), null, 'one checker still outside home');
  const seqs = B.legalSequences(pos({ 6: 1, 1: 1 }, { 13: 2 }), 0, 6, 1);
  assert.ok(seqs.some(s => s.length === 2 && s.every(m => m.to === B.OFF)), 'both off with a 6 and a 1');
});

test('the turn ends as soon as the last checker is borne off', () => {
  const start = pos({ 1: 1 }, { 13: 15 });
  const seqs = B.legalSequences(start, 0, 6, 5);
  assert.ok(seqs.every(s => s.length === 1 && s[0].die === 6), 'one move, and with the larger die');
  assert.deepEqual(B.winner(B.applySeq(start, 0, seqs[0])), { side: 0, points: 2 }, 'the bot has borne off none: a gammon');
});

test('a win, a gammon and a backgammon score 1, 2 and 3', () => {
  assert.deepEqual(B.winner(pos({}, { 5: 14 })), { side: 0, points: 1 }, 'the bot got one off');
  assert.deepEqual(B.winner(pos({}, { 5: 15 })), { side: 0, points: 2 });
  assert.deepEqual(B.winner(pos({}, { 20: 1, 5: 14 })), { side: 0, points: 3 });
  assert.deepEqual(B.winner(pos({}, { 25: 1, 5: 14 })), { side: 0, points: 3 });
  assert.deepEqual(B.winner(pos({ 6: 15 }, {})), { side: 1, points: 2 });
  assert.equal(B.winner(B.newGame()), null);
});

test('stepping through a turn: next moves follow what was already played', () => {
  const s = B.newGame();
  const seqs = B.legalSequences(s, 0, 3, 1);
  const first = B.nextMoves(seqs, []);
  assert.ok(first.some(m => m.from === 7 && m.to === 4));
  const after = B.nextMoves(seqs, [first.find(m => m.from === 7 && m.to === 4)]);
  assert.ok(after.every(m => m.die === 1));
  const paths = B.targetsFrom(seqs, [], 7);
  assert.deepEqual([...paths.keys()].sort((a, b) => a - b), [3, 4, 6], 'the 8 point can go 1, 3 or 4 pips');
  assert.equal(paths.get(3).length, 2, 'four pips takes both dice');
});

test('the bot hits a blot when it can and makes points over leaving blots', () => {
  // The bot (side 1) can hit my blot on my 5 point, its 20, with the 4 from its 24 point.
  const hit = pos({ 5: 1, 6: 5, 8: 3, 13: 6 }, { 24: 2, 13: 5, 8: 3, 6: 5 });
  const seq = B.botMove(hit, 1, 4, 1);
  assert.ok(seq.some(m => m.hit), 'it takes the hit');
  // Opening 3-1: making the 5 point is the textbook move.
  const open = B.botMove(B.newGame(), 1, 3, 1);
  const after = B.applySeq(B.newGame(), 1, open);
  assert.equal(after.b[1][4], 2, 'makes its 5 point');
});

test('the bot always plays a legal sequence, and races when there is no contact', () => {
  const rng = S.seeded(3);
  for (let i = 0; i < 40; i++) {
    const s = B.newGame();
    const [a, b] = B.rollDice(rng);
    const seq = B.botMove(s, i % 2, a, b);
    const legal = B.legalSequences(s, i % 2, a, b);
    assert.ok(legal.some(l => l.length === seq.length && l.every((m, k) => m.from === seq[k].from && m.to === seq[k].to && m.die === seq[k].die)));
  }
  const race = pos({ 3: 4, 2: 4 }, { 6: 3, 4: 3 });
  const seq = B.botMove(race, 1, 6, 4);
  assert.ok(seq.every(m => m.to === B.OFF), 'bears off rather than shuffling');
});

// ---------- striker ----------
const kicks = (st, list) => list.reduce((s, [by, r]) => S.recordKick(s, by, r), st);
const five = r => Array.from({ length: 5 }, () => r);

test('you shoot five, then keep five, and the score counts only goals', () => {
  let st = S.newShootout();
  for (let i = 0; i < 5; i++) { assert.equal(S.nextKick(st).by, 'you'); st = S.recordKick(st, 'you', i % 2 ? 'save' : 'goal'); }
  assert.deepEqual(S.nextKick(st), { by: 'them', round: 1, sudden: false });
  st = kicks(st, [['them', 'goal'], ['them', 'miss']]);
  assert.deepEqual([S.tally(st).you, S.tally(st).them], [3, 1]);
});

test('the shootout stops as soon as one side cannot catch up', () => {
  // You scored 3; the bot misses its first three and can reach at most 2.
  const st = kicks(S.newShootout(), [...five('x').map((_, i) => ['you', i < 3 ? 'goal' : 'miss']), ['them', 'save'], ['them', 'miss'], ['them', 'save']]);
  assert.equal(S.outcome(st), 'win');
  assert.equal(S.nextKick(st), null);
  const lost = kicks(S.newShootout(), [...five('x').map((_, i) => ['you', i < 1 ? 'goal' : 'save']), ['them', 'goal'], ['them', 'goal']]);
  assert.equal(S.outcome(lost), 'lose');
});

test('a tie after ten kicks goes to sudden death, a pair at a time', () => {
  let st = kicks(S.newShootout(), [...five('goal').map(r => ['you', r]), ...five('goal').map(r => ['them', r])]);
  assert.equal(S.outcome(st), null);
  assert.deepEqual(S.nextKick(st), { by: 'you', round: 6, sudden: true });
  st = S.recordKick(st, 'you', 'goal');
  assert.equal(S.outcome(st), null, 'not over until the bot answers');
  assert.equal(S.nextKick(st).by, 'them');
  st = S.recordKick(st, 'them', 'goal');
  assert.equal(S.outcome(st), null, 'both scored, go again');
  assert.deepEqual(S.nextKick(st), { by: 'you', round: 7, sudden: true });
  st = kicks(st, [['you', 'miss'], ['them', 'goal']]);
  assert.equal(S.outcome(st), 'lose');
  const won = kicks(S.newShootout(), [...five('goal').map(r => ['you', r]), ...five('goal').map(r => ['them', r]), ['you', 'goal'], ['them', 'save']]);
  assert.equal(S.outcome(won), 'win');
});

test('shots: on target, wide, over and the post', () => {
  assert.equal(S.judge(0, 1), 'on');
  assert.equal(S.judge(4.2, 1), 'wide');
  assert.equal(S.judge(1, 2.8), 'over');
  assert.equal(S.judge(S.HALF, 1), 'post');
  assert.equal(S.judge(-1, S.GOAL_H), 'post');
});

test('a sweet-spot shot lands near the aim, a blasted one flies over far more often', () => {
  const rng = S.seeded(9);
  let err = 0, sweetOver = 0, hardOver = 0;
  for (let i = 0; i < 2000; i++) {
    const b = S.shoot({ x: 2, y: 1 }, 0.72, rng);
    err += Math.hypot(b.x - 2, b.y - 1);
    if (b.result === 'over') sweetOver++;
    if (S.shoot({ x: 2, y: 1.9 }, 0.99, rng).result === 'over') hardOver++;
  }
  assert.ok(err / 2000 < 0.25, `average miss ${err / 2000}`);
  assert.ok(hardOver > sweetOver + 400, `${hardOver} vs ${sweetOver}`);
  assert.ok(S.shoot({ x: 0, y: 1 }, 1).flight < S.shoot({ x: 0, y: 1 }, 0.3).flight, 'harder means faster');
});

test('the keeper saves what he reaches and misses what he cannot', () => {
  const ball = { x: 0.2, y: 1.1, flight: 0.6 };
  assert.equal(S.saves(null, ball), true, 'straight at him');
  const corner = { x: 3.3, y: 2.1, flight: 0.5 };
  assert.equal(S.saves(null, corner), false, 'standing still');
  assert.equal(S.saves({ x: -3, y: 2, start: 0 }, corner), false, 'the wrong way');
  assert.equal(S.saves({ x: 3.2, y: 2.1, start: -0.1 }, corner), true, 'the right way and early');
  assert.equal(S.saves({ x: 3.2, y: 2.1, start: 0.35 }, corner), false, 'right way but far too late');
  const low = { x: 2.6, y: 0.3, flight: 0.7 };
  assert.equal(S.saves({ x: 2.6, y: 0.3, start: -1.5 }, low), true, 'went early, landed, still covers a low ball');
  assert.equal(S.saves({ x: 2.6, y: 2.0, start: -1.5 }, { x: 2.6, y: 2.0, flight: 0.7 }), false, 'went far too early, already on the grass');
});

test('the bot keeper leans to the side you keep shooting at', () => {
  const rng = S.seeded(4);
  let left = 0, right = 0;
  for (let i = 0; i < 3000; i++) {
    const p = S.keeperPlan({ x: 3, y: 1.5, flight: 0.4 }, [-3, -2.8, -3.1, -2.5, -3], rng);
    if (p.read) continue;
    if (p.x < -1) left++; else if (p.x > 1) right++;
  }
  assert.ok(left > right * 1.3, `${left} left vs ${right} right`);
});

test('a keeper who leaves early usually gets beaten the other way', () => {
  const rng = S.seeded(5);
  let other = 0;
  for (let i = 0; i < 1000; i++) if (S.botAim(rng, { x: 2.5 }).aim.x < 0) other++;
  assert.ok(other > 650, `${other} of 1000`);
});

test('a decent penalty scores most of the time against the bot keeper', () => {
  const rng = S.seeded(6);
  let goals = 0;
  for (let i = 0; i < 2000; i++) {
    const b = S.shoot({ x: 3.0, y: 1.7 }, 0.72, rng);
    if (b.result === 'on' && !S.saves(S.keeperPlan(b, [], rng), b)) goals++;
  }
  assert.ok(goals > 1200 && goals < 1800, `${goals} of 2000`);
});
