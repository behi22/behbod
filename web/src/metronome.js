import * as THREE from 'three';
import { makeKit } from './persia/kit.js';
import { heard } from './audio/core.js';
import { START_BPM, onScale, step, armAngle, retime, weightAt } from './pure/metronome.js';

// The metronome on the piano's lid: off until asked, then its arm swings in time and it ticks softly. The arm follows
// the sound's own clock, so what you see and what you hear agree; with no sound yet it keeps time by the page's clock.
// A hidden tab or standing up stops it.
export function makeMetronome({ scene, arm, sound, audio, store }) {
  let bpm = onScale(store?.get('loft.metronome') ?? START_BPM), on = false, t0 = 0, dom = 'perf', angle = 0, at = 0;
  const listeners = [];
  const pivot = new THREE.Group();
  let weight = null, length = 0;
  if (arm) {
    const box = new THREE.Box3().setFromObject(arm), c = box.getCenter(new THREE.Vector3());
    length = box.max.y - box.min.y;
    pivot.position.set(c.x, box.min.y, c.z);
    scene.add(pivot);
    pivot.attach(arm);
    // The sliding weight: high on the arm for slow, low for fast, as on the real one.
    const kit = makeKit({ ambient: 0.62, sky: 0.3, key: 0.25 });
    const brass = arm.material.color.clone().multiplyScalar(1.55);
    kit.box(0.017, 0.013, 0.007, brass, { at: [0, 0, 0.0035] });
    kit.box(0.011, 0.004, 0.0075, brass.clone().multiplyScalar(0.8), { at: [0, 0.0085, 0.0035] });
    weight = kit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
    weight.name = 'metronome_weight';
    weight.matrixAutoUpdate = true;
    pivot.add(weight);
    audio.metronome.setPosition(pivot.position.clone().setY(box.min.y + length / 2));
  }
  const placeWeight = () => { if (weight) weight.position.y = weightAt(bpm) * length; };
  placeWeight();

  const clock = () => {
    const ctx = sound.ctx;
    return ctx && ctx.state === 'running' ? { t: heard(ctx), dom: 'audio' } : { t: performance.now() / 1000, dom: 'perf' };
  };
  const beat = () => ({ t0, bpm });
  const changed = () => { for (const f of listeners) f(); };
  // The sound came on (or went away) while it runs: the same beat carries on, on the other clock.
  function follow(c) {
    if (c.dom === dom) return;
    const was = dom === 'audio' ? heard(sound.ctx) : performance.now() / 1000;
    t0 += c.t - was;
    dom = c.dom;
    if (dom === 'audio') audio.metronome.start(beat); else audio.metronome.stop();
  }
  function start() {
    if (on) return;
    const c = clock();
    on = true; dom = c.dom; t0 = c.t;
    if (dom === 'audio') audio.metronome.start(beat);
    changed();
  }
  function stop() {
    if (!on) return;
    on = false;
    audio.metronome.stop();
    changed();
  }
  function setBpm(next) {
    next = onScale(next);
    if (next === bpm) return;
    if (on) { const c = clock(); follow(c); t0 = retime(c.t, t0, bpm, next); }
    bpm = next;
    store?.set('loft.metronome', String(bpm));
    if (on && dom === 'audio') audio.metronome.retime(beat);
    placeWeight();
    changed();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

  return {
    get on() { return on; },
    get bpm() { return bpm; },
    get angle() { return angle; },
    get weight() { return weight; },
    // The beat it keeps: its start and tempo, the clock it runs on and that clock's time for the arm as drawn.
    get beat() { return { t0, bpm, clock: dom, at }; },
    start, stop, setBpm,
    toggle() { if (on) stop(); else start(); },
    faster() { setBpm(step(bpm, 1)); },
    slower() { setBpm(step(bpm, -1)); },
    listen(fn) { listeners.push(fn); },
    tick(dt) {
      if (!arm) return;
      let a = 0;
      if (on) { const c = clock(); follow(c); at = c.t; a = armAngle(at, t0, bpm); }
      // Switched off, the arm settles back to the middle and then nothing more is touched.
      else if (angle !== 0) { a = angle * Math.max(0, 1 - dt * 10); if (Math.abs(a) < 1e-4) a = 0; }
      if (a === angle) return;
      angle = a;
      pivot.rotation.z = angle;
    },
  };
}
