import test from 'node:test';
import assert from 'node:assert/strict';
import { newSwing, swing } from '../../web/src/pure/swing.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('a charm at rest hangs straight down from its hook and stays there', () => {
  const hook = [0.1, 1.5, -0.3], st = newSwing(hook, 0.02);
  for (let i = 0; i < 300; i++) assert.deepEqual(swing(st, hook, 1 / 60).map(v => Math.round(v * 1e9) / 1e9), [0, -1, 0]);
  assert.ok(Math.abs(dist(st.b, hook) - 0.02) < 1e-12);
});

test('a hook pushed sideways leaves the charm behind; stopped, the charm swings on past and settles under it', () => {
  const st = newSwing([0, 0, 0], 0.025);
  let hook = [0, 0, 0], d;
  for (let i = 1; i <= 6; i++) { hook = [10 * (i / 60) ** 2, 0, 0]; d = swing(st, hook, 1 / 60); }
  assert.ok(d[0] < -0.3, `trails the push: ${d[0]}`);
  let crossed = false;
  for (let i = 0; i < 60; i++) { d = swing(st, hook, 1 / 60); if (d[0] > 0.05) crossed = true; }
  assert.ok(crossed, 'swings past the middle');
  for (let i = 0; i < 600; i++) d = swing(st, hook, 1 / 60);
  assert.ok(Math.abs(d[0]) < 0.01 && d[1] < -0.999, `settled: ${d}`);
});

test('the chain keeps its length at any frame rate, and the swing looks the same at 30 and 144 fps', () => {
  const run = fps => {
    const st = newSwing([0, 0, 0], 0.03), out = [];
    for (let t = 0; t < 1.5; t += 1 / fps) {
      const hook = [t < 0.2 ? t * 0.5 : 0.1, 0, Math.sin(t * 9) * 0.01];
      swing(st, hook, 1 / fps);
      assert.ok(Math.abs(dist(st.b, hook) - 0.03) < 1e-9);
      out.push(st.b[0] - hook[0]);
    }
    return out.at(-1);
  };
  assert.ok(Math.abs(run(30) - run(144)) < 0.004, `${run(30)} against ${run(144)}`);
});

test('a long stall or a broken number leaves it hanging still instead of flying off', () => {
  const st = newSwing([0, 0, 0], 0.02);
  assert.deepEqual(swing(st, [5, 2, 1], 3), [0, -1, 0]);
  assert.deepEqual(st.b, [5, 1.98, 1]);
  assert.deepEqual(swing(st, [NaN, 0, 0], 1 / 60), [0, -1, 0], 'a broken hook too');
  st.b = [5, 1.98, 1]; st.prev = [5, 1.98, 1]; st.hook = [5, 2, 1];
  st.b = [NaN, 0, 0];
  assert.deepEqual(swing(st, [0, 0, 0], 1 / 60), [0, -1, 0]);
  assert.ok(st.b.every(Number.isFinite));
  const was = JSON.stringify(st);
  swing(st, [0, 0, 0], 0); swing(st, [0, 0, 0], -1); swing(st, [0, 0, 0], NaN);
  assert.equal(JSON.stringify(st), was, 'no time, no move');
});
