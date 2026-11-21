import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteName } from '../../web/src/pianomode.js';

test('the note names on the keys: letters, sharps on the black keys, and the octave on each C', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(48), 'C3');
  assert.equal(noteName(84), 'C6');
  assert.equal(noteName(61), 'C♯');
  assert.equal(noteName(64), 'E');
  assert.equal(noteName(70), 'A♯');
  assert.equal(noteName(71), 'B');
});

