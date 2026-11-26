import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forIme } from '../../web/src/pure/ime.js';

test('an Enter or an arrow while a word is still being put together belongs to the input method', () => {
  assert.equal(forIme({ key: 'Enter', isComposing: true, keyCode: 229 }), true);
  assert.equal(forIme({ key: 'ArrowUp', isComposing: true, keyCode: 229 }), true);
  assert.equal(forIme({ key: 'Tab', isComposing: true, keyCode: 9 }), true);
});

test("Safari's Enter that ends a word comes after it, and says so only by its key code", () => {
  assert.equal(forIme({ key: 'Enter', isComposing: false, keyCode: 229 }), true);
});

test("a plain Enter, arrow or Tab is the box's own, and so is a key from a browser without isComposing", () => {
  assert.equal(forIme({ key: 'Enter', isComposing: false, keyCode: 13 }), false);
  assert.equal(forIme({ key: 'ArrowDown', isComposing: false, keyCode: 40 }), false);
  assert.equal(forIme({ key: 'Tab', isComposing: false, keyCode: 9 }), false);
  assert.equal(forIme({ key: 'Enter', keyCode: 13 }), false);
});
