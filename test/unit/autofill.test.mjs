import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, ghost, newFill, step, OFTEN } from '../../web/src/pure/autofill.js';
import { LINKS } from '../../web/src/pure/links.js';

// The terminal's offer as it stands in the house: help, help's list, the desk toys main.js adds, the link commands.
const NAMES = ['help', 'whoami', 'projects', 'postit', 'ferdowsi', 'nowruz', 'ls', 'contact', 'github', 'linkedin', 'clear', 'exit',
  'achievements', 'hood', 'shoo', 'deploy', 'scene', 'lights', 'coolant', 'fan', 'print', 'music', 'film', ...Object.keys(LINKS)];

test('only commands the line is the start of, the most used first and then a to z', () => {
  assert.deepEqual(suggest('p', NAMES), ['projects', 'print', 'postit', 'profile-art']);
  assert.deepEqual(suggest('c', NAMES), ['contact', 'clear', 'coolant']);
  assert.deepEqual(suggest('l', NAMES), ['ls', 'linkedin', 'lights']);
  assert.deepEqual(suggest('f', NAMES), ['film', 'fan', 'ferdowsi']);
  assert.deepEqual(suggest('pr', NAMES), ['projects', 'print', 'profile-art']);
  assert.deepEqual(suggest('git', NAMES), ['github']);
  assert.deepEqual(suggest('a', NAMES), ['achievements', 'aic-voice-microsite']);
});

test('nothing for an empty line, a finished command, a line past the name, or no match', () => {
  for (const t of ['', '   ', 'whoami', 'ls', 'scene ', 'scene f', 'zzz', 'xls', null, undefined]) assert.deepEqual(suggest(t, NAMES), [], String(t));
  assert.equal(ghost('', NAMES), '');
  assert.equal(ghost('zzz', NAMES), '');
  assert.equal(ghost('help', NAMES), '');
});

test('what is offered is only what it is given: hidden commands are never in the list, so never suggested', () => {
  for (const t of ['su', 'sud', 'cd', 'cat', 'hel', 'hello']) assert.ok(!suggest(t, NAMES).some(n => /^(sudo|cd |cat |hello)/.test(n)), t);
  assert.deepEqual(suggest('hel', NAMES), ['help']);
});

test('the ghost is the rest of the best command, whatever case or leading spaces were typed', () => {
  assert.equal(ghost('who', NAMES), 'ami');
  assert.equal(ghost('WHO', NAMES), 'ami');
  assert.equal(ghost('  who', NAMES), 'ami');
  assert.equal(ghost('gi', NAMES), 'thub');
  assert.equal(ghost('p', NAMES), 'rojects');
  assert.equal(ghost('meet', NAMES), '-bex');
});

test('names given twice are offered once; the order is the same whatever order they come in', () => {
  assert.deepEqual(suggest('g', ['github', 'github']), ['github']);
  assert.deepEqual(suggest('p', [...NAMES].reverse()), suggest('p', NAMES));
});

// Presses Tab (+1) or Shift+Tab (-1) one after another from a typed line, as the terminal does.
function press(f, line, dirs) {
  const seen = [];
  for (const d of dirs) { const r = step(f, line, NAMES, d); if (r !== null) line = r; seen.push(line); }
  return seen;
}

test('Tab fills the best, Tab again goes round the others and back to the first; Shift+Tab goes the other way', () => {
  assert.deepEqual(press(newFill(), 'p', [1, 1, 1, 1, 1]), ['projects', 'print', 'postit', 'profile-art', 'projects']);
  assert.deepEqual(press(newFill(), 'p', [1, 1, -1, -1, -1]), ['projects', 'print', 'projects', 'profile-art', 'postit']);
  assert.deepEqual(press(newFill(), 'p', [-1]), ['profile-art']);
  assert.deepEqual(press(newFill(), 'who', [1, 1, -1]), ['whoami', 'whoami', 'whoami']);
});

test('Tab with nothing to fill changes nothing', () => {
  const f = newFill();
  assert.equal(step(f, '', NAMES), null);
  assert.equal(step(f, 'zzz', NAMES, -1), null);
  assert.equal(step(f, 'whoami', NAMES), null);
  assert.equal(f.line, null);
});

test('a line changed since the last Tab starts a new turn from what is there now', () => {
  const f = newFill();
  assert.equal(step(f, 'p', NAMES), 'projects');
  assert.equal(step(f, 'projects', NAMES), 'print');
  assert.equal(step(f, 'c', NAMES), 'contact');
  assert.equal(step(f, 'contact', NAMES), 'clear');
  assert.equal(step(f, 'zz', NAMES), null);
  assert.equal(step(f, 'p', NAMES), 'projects');
});

test('the most used list names real commands only', () => {
  for (const n of OFTEN) assert.ok(NAMES.includes(n), n);
});
