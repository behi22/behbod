import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRunMusic } from '../../web/src/audio/runmusic.js';

// A stand-in for the house's sound: an engine exists, but the visitor has the sound switched off.
function houseWithSoundOff() {
  const ducks = [];
  const eng = { ctx: { currentTime: 0, createGain: () => ({ gain: { value: 0 }, connect: x => x }), createMediaElementSource: () => ({ connect: x => x }) }, out: {} };
  return { ducks, env: { eng: () => eng, ready: () => null, duck: (...a) => ducks.push(a) } };
}

// Regression: with the sound off, standing at the line still streamed the six-minute file (3 MB in 12 s on the card).
test('with the sound off the run music never fetches its file or fades the records', () => {
  const { env, ducks } = houseWithSoundOff();
  let made = 0;
  const was = globalThis.Audio;
  globalThis.Audio = class { constructor() { made++; } addEventListener() {} play() { return Promise.resolve(); } pause() {} };
  try {
    const m = makeRunMusic(env);
    m.prepare();
    assert.equal(m.play(), false, 'nothing plays');
    assert.equal(made, 0, 'no audio element, so no download');
    assert.equal(m.on, false);
    assert.deepEqual(ducks, [], 'the records are left alone');
  } finally {
    globalThis.Audio = was;
  }
});
