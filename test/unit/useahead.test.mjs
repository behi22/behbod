import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useAhead } from '../../web/src/useahead.js';

// A renderer stand-in: each material holds programs; a program records whether three's log checks were on at its first
// use; the graphics context says which linked.
function rig(linked = () => true, lost = false) {
  const firsts = [], renderer = { debug: { checkShaderErrors: true } };
  const program = name => ({ program: name, used: false, getUniforms() { if (!this.used) { this.used = true; firsts.push([name, renderer.debug.checkShaderErrors]); } return {}; } });
  const mats = { a: { programs: new Map([['k1', program('a1')], ['k2', program('a2')]]) }, b: { programs: new Map([['k3', program('b1')]]) }, c: {} };
  renderer.properties = { get: m => mats[m] };
  renderer.getContext = () => ({ LINK_STATUS: 1, isContextLost: () => lost, getProgramParameter: (p, what) => (what === 1 ? linked(p) : null) });
  return { renderer, firsts };
}

// Regression: a switch's first frame waited 60 to 260 ms on three reading each new program's compile logs back from the
// graphics card, which waits for all the card has queued.
test('in the background every linked program is first used with the log read left out, and the checks come back on', async () => {
  const { renderer, firsts } = rig();
  await useAhead(renderer, ['a', 'b', 'c']);
  assert.deepEqual(firsts, [['a1', false], ['a2', false], ['b1', false]]);
  assert.equal(renderer.debug.checkShaderErrors, true);
});

test('a program that failed to link is left for its real first use, logs and all', async () => {
  const { renderer, firsts } = rig(p => p !== 'a2');
  await useAhead(renderer, ['a', 'b']);
  assert.deepEqual(firsts.map(f => f[0]), ['a1', 'b1']);
});

test('while loading the logs are read as three always reads them', async () => {
  const { renderer, firsts } = rig();
  await useAhead(renderer, ['a', 'b'], { logs: true });
  assert.deepEqual(firsts, [['a1', true], ['a2', true], ['b1', true]]);
});

test('the checks come back on even if a first use throws, and a build that went stale stops', async () => {
  const { renderer } = rig();
  renderer.properties.get('a').programs.get('k1').getUniforms = () => { throw new Error('lost context'); };
  await assert.rejects(useAhead(renderer, ['a']), /lost context/);
  assert.equal(renderer.debug.checkShaderErrors, true);
  const r2 = rig();
  await assert.rejects(useAhead(r2.renderer, ['a', 'b'], { stale: () => true }), e => e?.stale === true);
  assert.deepEqual(r2.firsts, []);
});

// Regression: with the graphics context lost, three's first use reads compile logs that are not there and throws, so a
// context lost while the house loaded stopped it from ever opening.
test('with the graphics context lost no program is first used, and nothing throws', async () => {
  const { renderer, firsts } = rig(() => true, true);
  await useAhead(renderer, ['a', 'b'], { logs: true });
  await useAhead(renderer, ['a', 'b']);
  assert.deepEqual(firsts, []);
});

// Regression: on a slowed phone a program the card was still building was asked whether it linked, which held the page
// 120 to 150 ms until it was built (three had stopped waiting for it when the material was drawn with another one).
test('in the background a program still being built is waited for between frames before it is asked anything', async () => {
  const { renderer, firsts } = rig();
  const ready = new Set(['a1', 'b1']), gl = renderer.getContext();
  let early = 0, rests = 0;
  renderer.extensions = { has: name => name === 'KHR_parallel_shader_compile', get: () => ({ COMPLETION_STATUS_KHR: 2 }) };
  renderer.getContext = () => ({ ...gl, getProgramParameter: (p, what) => { if (what === 2) return ready.has(p); if (!ready.has(p)) early++; return gl.getProgramParameter(p, what); } });
  await useAhead(renderer, ['a', 'b'], { rest: async () => { if (++rests === 3) ready.add('a2'); } });
  assert.equal(early, 0);
  assert.ok(rests >= 3);
  assert.deepEqual(firsts.map(f => f[0]), ['a1', 'a2', 'b1']);
});
