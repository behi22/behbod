import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../../web/sound.js';

// A sound clock and its gains that only remember what they were told.
function fake() {
  const param = value => ({ value, said: [],
    cancelScheduledValues(t) { this.said.push(['cancel', t]); },
    setValueAtTime(v, t) { this.said.push(['set', v, t]); this.value = v; },
    setTargetAtTime(v, t, k) { this.said.push(['to', v, t, k]); } });
  const calls = [];
  const ctx = { currentTime: 5, state: 'running',
    suspend() { calls.push('suspend'); ctx.state = 'suspended'; return Promise.resolve(); },
    resume() { calls.push('resume'); ctx.state = 'running'; return Promise.resolve(); } };
  const s = new Sound();
  Object.assign(s, { ctx, on: true, master: { gain: param(0.9) }, shown: { gain: param(1) } });
  return { s, ctx, calls };
}

test('a hidden page fades out first, then stops the sound; the Sound switch is left alone', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { s, ctx, calls } = fake();
    s.setHidden(true);
    const to = s.shown.gain.said.find(x => x[0] === 'to');
    assert.ok(to && to[1] === 0 && to[3] > 0 && to[3] * 3 < 0.2, `a fade to nothing that is nearly done before the stop: ${JSON.stringify(to)}`);
    assert.deepEqual(calls, [], 'not stopped dead');
    mock.timers.tick(250);
    assert.deepEqual(calls, ['suspend']);
    assert.equal(ctx.state, 'suspended');
    assert.equal(s.master.gain.said.length, 0, 'the master (the Sound switch, the film\'s hush) is never touched');
    assert.equal(s.on, true);
  } finally { mock.timers.reset(); }
});

test('shown again, it starts and fades back in from where it got to', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { s, ctx, calls } = fake();
    s.setHidden(true); mock.timers.tick(250);
    s.shown.gain.value = 0.002;
    s.setHidden(false);
    assert.deepEqual(calls, ['suspend', 'resume']);
    assert.equal(ctx.state, 'running');
    const said = s.shown.gain.said.slice(-3);
    assert.deepEqual(said.slice(0, 2), [['cancel', 5], ['set', 0.002, 5]], 'held where it was, no jump');
    assert.ok(said[2][0] === 'to' && said[2][1] === 1 && said[2][3] > 0, `then up to full: ${JSON.stringify(said[2])}`);
    assert.equal(s.master.gain.said.length, 0);
  } finally { mock.timers.reset(); }
});

test('hidden and shown again within a moment: the fade turns round and the sound never stops', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { s, calls } = fake();
    s.setHidden(true); mock.timers.tick(50);
    s.shown.gain.value = 0.4;
    s.setHidden(false); mock.timers.tick(1000);
    assert.deepEqual(calls, ['resume']);
    assert.deepEqual(s.shown.gain.said.at(-2), ['set', 0.4, 5]);
    assert.equal(s.shown.gain.said.at(-1)[1], 1);
  } finally { mock.timers.reset(); }
});

test('before the sound has ever started, hiding the page does nothing', () => {
  const s = new Sound();
  assert.doesNotThrow(() => { s.setHidden(true); s.setHidden(false); });
  assert.equal(s.ctx, null);
});
