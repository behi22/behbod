import { makeEngine, makeClock, vec } from './core.js';
import { makeMusic } from './music.js';
import { makePiano } from './piano.js';
import { makeSfx } from './sfx.js';
import { makeAmbience } from './ambience.js';

// Rides on the Sound's own context and master gain, and stays silent until sound.start() has made them.
export function makeAudio(sound) {
  let eng = null;
  const env = {
    sound,
    clock: makeClock(),
    eng() {
      if (!eng && sound && sound.ctx && sound.master) eng = makeEngine(sound.ctx, sound.master);
      return eng;
    },
    ready() { return sound && sound.on ? env.eng() : null; },
  };
  const music = makeMusic(env), piano = makePiano(env), sfx = makeSfx(env), amb = makeAmbience(env);

  return {
    music, piano, sfx,
    ambience: { set: amb.set },
    setListener(pos, forward) {
      const e = env.eng(), p = vec(pos);
      if (!e || !p) return;
      let f = vec(forward), n = f ? Math.hypot(f.x, f.y, f.z) : 0;
      if (n < 1e-6) { f = { x: 0, y: 0, z: -1 }; n = 1; }
      const L = e.ctx.listener;
      const fx = f.x / n, fy = f.y / n, fz = f.z / n, up = Math.abs(fy) > 0.99 ? [0, 0, -Math.sign(fy)] : [0, 1, 0];
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
        L.upX.value = up[0]; L.upY.value = up[1]; L.upZ.value = up[2];
      } else {
        L.setPosition(p.x, p.y, p.z);
        L.setOrientation(fx, fy, fz, ...up);
      }
    },
    tick() {
      if (!env.eng()) return;
      amb.sync();
      env.clock.run();
    },
  };
}
