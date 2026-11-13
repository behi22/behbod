import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCalc, press, show, format, work, fromKeyboard, KEYS, LABEL } from '../../web/src/pure/calc.js';

// Types a string of keys ('neg', 'back' and 'C' as words between spaces, everything else a key each).
const run = keys => { const c = newCalc(); for (const k of keys.split(' ')) press(c, k); return c; };
const main = keys => show(run(keys)).main;

test('times and divide come before plus and minus', () => {
  assert.equal(main('2 + 3 * 4 ='), '14');
  assert.equal(main('2 * 3 + 4 ='), '10');
  assert.equal(main('1 0 - 6 / 3 ='), '8');
  assert.equal(main('8 / 2 / 2 ='), '2');
  assert.equal(main('7 - 2 - 1 ='), '4');
  assert.equal(work([2, '+', 3, '*', 4, '-', 6, '/', 3]), 12);
});

test('decimals come out the way people write them', () => {
  assert.equal(main('. 1 + . 2 ='), '0.3');
  assert.equal(main('1 / 3 ='), '0.333333333333');
  assert.equal(main('1 . 5 * 2 ='), '3');
  assert.equal(main('0 . 0 0 5'), '0.005');
  assert.equal(main('1 . . 5'), '1.5', 'a second point is ignored');
  assert.equal(format(1e15), '1e15');
  assert.equal(format(0.0000000001234), '1.234e-10');
  assert.equal(format(-0), '0');
});

test('the sum is shown above, and the answer carries into the next sum', () => {
  const c = run('1 2 + 3');
  assert.deepEqual(show(c), { top: '12 +', main: '3' });
  press(c, '=');
  assert.deepEqual(show(c), { top: '12 + 3 =', main: '15' });
  press(c, '*'); press(c, '2'); press(c, '=');
  assert.deepEqual(show(c), { top: '15 \u00D7 2 =', main: '30' });
  press(c, '7');
  assert.deepEqual(show(c), { top: '', main: '7' }, 'a digit after an answer starts over');
  assert.equal(main('5 = ='), '5', 'a second equals does nothing');
});

test('a second operator replaces the first; minus signs, rubbing out and clearing work', () => {
  assert.equal(main('6 + * 2 ='), '12');
  assert.equal(main('6 + - * / 3 ='), '2');
  assert.equal(main('5 neg'), '\u22125');
  assert.equal(main('5 neg neg'), '5');
  assert.equal(main('0 neg'), '0', 'zero has no sign');
  assert.equal(main('9 + 5 neg ='), '4');
  assert.equal(main('1 2 3 back'), '12');
  assert.equal(main('7 back'), '0');
  assert.equal(main('7 neg back'), '0');
  assert.equal(main('7 back 4'), '4');
  assert.equal(main('9 * 9 C'), '0');
  assert.deepEqual(show(run('9 * 9 C')), { top: '', main: '0' });
  assert.equal(main('9 + 1 = neg'), '\u221210', 'the answer can change sign');
  assert.equal(main('0 0 7'), '7', 'no leading zeros');
});

test('percent: a hundredth, or after plus and minus a share of what came before', () => {
  assert.equal(main('5 0 %'), '0.5');
  assert.equal(main('2 0 0 + 1 0 % ='), '220');
  assert.equal(main('2 0 0 - 1 0 % ='), '180');
  assert.equal(main('2 0 0 * 1 0 % ='), '20');
  assert.equal(main('2 0 0 + 1 0 % + 5 ='), '225', 'the sum goes on after it');
});

test('dividing by zero says so, and only clearing gets out of it', () => {
  const c = run('8 / 0 =');
  assert.deepEqual(show(c), { top: '8 \u00F7 0 =', main: 'Cannot divide by zero' });
  press(c, '5'); press(c, '+');
  assert.equal(show(c).main, 'Cannot divide by zero');
  press(c, 'C');
  assert.deepEqual(show(c), { top: '', main: '0' });
  assert.equal(main('8 / 0 = back 3'), '3', 'rubbing out clears it too');
  assert.equal(main('5 / 0 + 1 ='), 'Cannot divide by zero');
});

test('a number stops at twelve digits, and odd keys are ignored', () => {
  assert.equal(main('1 2 3 4 5 6 7 8 9 0 1 2 3 4 5'), '123456789012');
  assert.equal(main('9 9 9 9 9 9 9 9 9 9 9 9 * 9 9 9 9 9 9 9 9 9 9 9 9 ='), '1e24');
  const c = run('4 2');
  for (const k of ['', 'x', '__proto__', 'constructor', '==', null, undefined, 12]) press(c, k);
  assert.equal(show(c).main, '42');
});

test('the keyboard and the keypad name the same keys', () => {
  for (const [key, want] of [['7', '7'], ['Enter', '='], ['=', '='], ['Backspace', 'back'], ['Delete', 'C'], ['c', 'C'], ['x', '*'], [',', '.'], ['%', '%'], ['/', '/']]) assert.equal(fromKeyboard(key), want, key);
  for (const key of ['a', 'Escape', 'F5', 'Tab', ' ']) assert.equal(fromKeyboard(key), null, key);
  const all = KEYS.flat();
  assert.equal(all.length, 20);
  assert.equal(new Set(all).size, 20, 'no key twice');
  for (const k of all) assert.ok(/^[0-9]$/.test(k) || LABEL[k], `a label for ${k}`);
});

test('no dust from the machine\'s own arithmetic, in the middle of a sum or at its end', () => {
  assert.equal(main('. 1 + . 2 - . 3 ='), '0');
  assert.equal(main('1 - . 9 - . 1 ='), '0');
  assert.equal(main('4 . 3 5 * 1 0 0 - 4 3 5 ='), '0');
  assert.equal(main('. 1 * 3 ='), '0.3');
  assert.equal(main('1 / 3 * 3 ='), '1');
  assert.equal(main('2 / 3 ='), '0.666666666667');
  assert.equal(main('1 0 0 0 0 0 0 . 1 - 1 0 0 0 0 0 0 ='), '0.1');
  assert.equal(main('1 / 3 * 3 - 1 ='), '0');
  assert.equal(main('9 9 9 9 9 9 9 9 9 9 9 9 + 1 ='), '1e12');
});

test('rubbing out with nothing typed changes nothing, so an operator can still be swapped after it', () => {
  assert.equal(main('5 + back * 2 ='), '10');
  assert.deepEqual(show(run('5 + back back *')), { top: '5 \u00D7', main: '5' });
  assert.equal(main('5 + 3 back * 2 ='), '5', 'rubbing out the 3 leaves 5 + 0, then times 2');
});

test('a very big or very small answer carries on at its full value, not its rounded writing', () => {
  assert.equal(main('1 2 3 4 5 6 7 8 9 0 1 2 * 1 0 ='), '1.234568e12');
  assert.equal(main('1 2 3 4 5 6 7 8 9 0 1 2 * 1 0 = / 1 0 ='), '123456789012');
  assert.equal(main('1 2 3 4 5 6 7 8 9 0 1 2 * 1 0 = neg / 1 0 ='), '\u2212123456789012');
  assert.equal(main('1 / 3 = * 3 ='), '1');
  assert.equal(main('0 . 0 0 0 0 0 0 1 ='), '0.0000001', 'small decimals are written out');
  assert.equal(main('1 / 8 0 0 0 0 0 0 0 0 ='), '0.00000000125');
  assert.equal(format(1e-10), '1e-10');
});

test('a sum too big says so, which is not the same as dividing by zero', () => {
  const big = '9 9 9 9 9 9 9 9 9 9 9 9 *';
  let keys = big;
  for (let i = 0; i < 30; i++) keys += ' = *';
  assert.equal(main(keys + ' ='), 'Too big');
  assert.equal(main('0 / 0 ='), 'Cannot divide by zero');
  const c = run('9 9 9 9 9 9 9 9 9 9 9 9 *');
  for (let i = 0; i < 26; i++) { press(c, '='); press(c, '*'); }
  press(c, '%');
  assert.ok(['Too big'].includes(show(c).main) || /e\d+$/.test(show(c).main), show(c).main);
  press(c, 'neg');
  assert.ok(!/Error/.test(show(c).main), 'never the bare word Error');
});

test('minus signs are minus signs, above and below', () => {
  assert.deepEqual(show(run('2 - 3 neg * 4 =')), { top: '2 \u2212 \u22123 \u00D7 4 =', main: '14' });
  assert.equal(main('1 - 2 ='), '\u22121');
  assert.equal(format(-2.5e-17), '-2.5e-17', 'a power of ten keeps its plain hyphen');
});

test('sums of the very small and the very big keep their twelve figures', () => {
  assert.equal(main('. 0 0 0 0 0 0 0 0 0 0 1 * = + ='), '2e-22', 'tiny plus tiny is not rounded away');
  assert.equal(main('1 . 2 3 4 5 / 1 0 0 0 0 0 0 0 0 0 = * = + 0 ='), '1.52399e-18');
  assert.equal(main('1 0 0 0 0 0 0 0 0 * = + 3 - 1 0 0 0 0 0 0 0 0 * 1 0 0 0 0 0 0 0 0 ='), '0', 'three is past the twelfth figure of ten thousand million million');
  assert.equal(main('9 9 9 9 9 9 9 9 9 9 9 9 + 9 9 9 9 9 9 9 9 9 9 9 9 + 1 = / 2 ='), '1e12', 'never thirteen figures');
  assert.equal(format(999999999999.6), '1e12');
  assert.equal(format(999999999999.4), '999999999999');
  assert.equal(format(-0.0000000009999999999999), '-0.000000001');
  assert.equal(format(0.00000000049), '4.9e-10');
});

test('the sign can be given to a number while it still reads zero', () => {
  assert.equal(main('0 . 0 neg 5'), '\u22120.05');
  assert.equal(main('0 . neg 5 ='), '\u22120.5');
  assert.equal(main('0 . 0 neg ='), '0', 'minus nothing is nothing');
  assert.equal(main('0 neg 5'), '5', 'an untouched 0 has no sign to take');
});

test('percent and the errors: too big, a zero divisor earlier in the sum, and a power of ten keeps its hyphen', () => {
  assert.equal(main('9 9 9 9 9 9 9 9 9 9 9 9 * = * = * = * = + %'), 'Too big');
  assert.equal(main('5 / 0 + 1 0 %'), 'Cannot divide by zero');
  assert.equal(main('. 0 0 0 0 0 0 0 0 0 1 ='), '1e-10');
  assert.equal(main('. 0 0 0 0 0 0 0 0 0 1 neg ='), '\u22121e-10');
  assert.deepEqual(show(run('. 0 0 0 0 0 0 0 0 0 1 + 2 =')), { top: '1e-10 + 2 =', main: '2.0000000001' });
});

// Sums of money-like numbers, checked against whole-number arithmetic: every one must come out exactly.
test('a thousand random sums of decimals come out exactly right', () => {
  let a = 12345;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < 1000; i++) {
    const n = 2 + Math.floor(rnd() * 5), places = Math.floor(rnd() * 5), scale = 10 ** places;
    let keys = '', exact = 0n;
    for (let k = 0; k < n; k++) {
      const whole = BigInt(Math.floor(rnd() * 10 ** (1 + Math.floor(rnd() * 6)))), sign = k && rnd() < 0.5 ? -1n : 1n;
      exact += sign * whole;
      const text = places ? (Number(whole) / scale).toFixed(places) : String(whole);
      keys += (k ? (sign < 0n ? ' - ' : ' + ') : '') + text.split('').join(' ');
    }
    const want = Number(exact) / scale;
    assert.equal(main(keys + ' ='), String(+want.toFixed(places)).replace('-', '\u2212'), keys.replace(/ /g, ''));
  }
});
