import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newHistory, remember, browse, HISTORY_MAX, LINE_MAX } from '../../web/src/pure/history.js';

const UP = -1, DOWN = 1;
// Presses one key after another from a typed line, as the terminal does: each press shows what browse gives, or keeps the line.
function press(h, line, keys) {
  const seen = [];
  for (const k of keys) { const r = browse(h, k, line); if (r !== null) line = r; seen.push(line); }
  return seen;
}

test('with nothing entered yet, Up and Down change nothing', () => {
  const h = newHistory();
  assert.equal(browse(h, UP, ''), null);
  assert.equal(browse(h, DOWN, ''), null);
  assert.equal(browse(h, UP, 'hel'), null);
  assert.deepEqual(press(h, 'hel', [UP, DOWN, UP]), ['hel', 'hel', 'hel']);
});

test('Up walks back through the commands, newest first, and stops at the oldest; Down walks forward to the line being typed', () => {
  const h = newHistory();
  for (const c of ['help', 'whoami', 'ls']) remember(h, c);
  assert.deepEqual(press(h, '', [UP, UP, UP, UP, DOWN, DOWN, DOWN, DOWN]), ['ls', 'whoami', 'help', 'help', 'whoami', 'ls', '', '']);
});

test('the line being typed is kept while browsing and comes back at the bottom', () => {
  const h = newHistory();
  remember(h, 'help'); remember(h, 'scene movie');
  assert.deepEqual(press(h, 'scen', [UP, UP, DOWN, DOWN]), ['scene movie', 'help', 'scene movie', 'scen']);
});

test('a recalled line changed while browsing keeps the change until Enter, and Enter keeps the old one as it was', () => {
  const h = newHistory();
  remember(h, 'scene party'); remember(h, 'ls');
  assert.equal(browse(h, UP, ''), 'ls');
  assert.equal(browse(h, UP, 'ls'), 'scene party');
  assert.equal(browse(h, DOWN, 'scene focus'), 'ls');
  assert.equal(browse(h, UP, 'ls'), 'scene focus');
  remember(h, 'scene focus');
  assert.deepEqual(h.list, ['scene party', 'ls', 'scene focus']);
  assert.deepEqual(press(h, '', [UP, UP, UP]), ['scene focus', 'ls', 'scene party']);
});

test('the same command twice in a row is kept once; again later it is kept again', () => {
  const h = newHistory();
  for (const c of ['help', 'help', ' help ', 'ls', 'help']) remember(h, c);
  assert.deepEqual(h.list, ['help', 'ls', 'help']);
});

test('an empty or blank line is not kept, and Enter always starts browsing again from the bottom', () => {
  const h = newHistory();
  remember(h, 'whoami'); remember(h, ''); remember(h, '   '); remember(h, null);
  assert.deepEqual(h.list, ['whoami']);
  browse(h, UP, 'half typed');
  remember(h, '');
  assert.equal(h.at, h.list.length);
  assert.deepEqual(press(h, '', [UP, DOWN]), ['whoami', '']);
});

test('the list keeps the newest commands only, each no longer than the terminal line', () => {
  const h = newHistory();
  for (let i = 0; i < HISTORY_MAX + 7; i++) remember(h, 'echo ' + i);
  assert.equal(h.list.length, HISTORY_MAX);
  assert.equal(h.list[0], 'echo 7');
  assert.equal(h.list.at(-1), `echo ${HISTORY_MAX + 6}`);
  remember(h, 'x'.repeat(200));
  assert.equal(h.list.at(-1).length, LINE_MAX);
  assert.equal(browse(h, 0, 'abc'), null);
});
