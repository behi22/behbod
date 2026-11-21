import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSide } from '../../web/src/sheetdraw.js';
import { score } from '../../web/src/pure/sheet.js';

// A stand-in for a canvas that keeps every drawing call, so the ties can be read back from what a page draws.
function recorder() {
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => { calls.push([k, a]); }),
    set: () => true,
  });
  return { g, calls };
}
// A tie is drawn as a move, a curve out and a curve back to where it began: [from x, to x, y].
function ties(calls) {
  const out = [];
  for (let i = 0; i + 2 < calls.length; i++) {
    const [a, b, c] = calls.slice(i, i + 3);
    if (a[0] !== 'moveTo' || b[0] !== 'quadraticCurveTo' || c[0] !== 'quadraticCurveTo') continue;
    if (c[1][2] === a[1][0] && c[1][3] === a[1][1]) out.push([a[1][0], b[1][2], a[1][1]]);
  }
  return out;
}

test('a note held over a system break is tied on to the next bar, not cut short', () => {
  const sc = score('gymnopedie');
  // Bars 9 to 12 and 17 to 21: the long F sharp is held four bars, over the break between the page's two systems.
  for (const n of [2, 4]) {
    const { g, calls } = recorder();
    drawSide(g, sc, n, 'left');
    const all = ties(calls);
    assert.ok(all.every(([a, b]) => b > a), `page ${n + 1}: a tie runs backwards ${JSON.stringify(all)}`);
    // Bar to bar in the first system, on to its end, a short lead-in on the second, then bar to bar again.
    const long = all.filter(([a, b]) => b - a > 40);
    assert.equal(long.length, 3, `page ${n + 1}: ${JSON.stringify(all)}`);
    const short = all.filter(([a, b]) => b - a <= 40);
    assert.equal(short.length, 1, `page ${n + 1}: ${JSON.stringify(all)}`);
    // The lead-in comes before the second system's first tie, on the same line.
    const second = all.filter(([, , y]) => y > 300);
    assert.equal(second.length, 2);
    assert.ok(second[0][1] - second[0][0] <= 40 && second[1][1] - second[1][0] > 40 && second[0][1] < second[1][1]);
  }
});
