import * as THREE from 'three';
import { newMatch, stepMatch } from './pure/match.js';
import { drawMatch, makeCamera, follow } from './games/matchdraw.js';

// The live match on the TV: a five-a-side that keeps playing whether or not anyone watches (a 90 minute match in ten
// real ones), painted onto the TV only when it is near, faced and on screen, since every repaint is an upload.
const STEP = 1 / 30, MATCH = 600, NEAR = 12, WARM = 30 * 60 * 3, WARM_CHUNK = 300;

// `fps`: how often to repaint while it is watched (fewer on a slow device).
export function makeTvMatch({ texture, at, normal, fps = () => 10 }) {
  if (!texture?.image?.getContext) return null;
  const c = texture.image, g = c.getContext('2d'), cam = makeCamera();
  const here = new THREE.Vector3(...at), facing = new THREE.Vector3(...normal), to = new THREE.Vector3();
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), screen = new THREE.Sphere(here.clone(), 1.2);
  // A match already under way when you arrive, played forward a little each frame so loading never stalls on it.
  let m = newMatch({ kickoff: Math.random() < 0.5 ? 0 : 1 }), acc = 0, paint = 1, warm = WARM;
  const minute = () => Math.min(90, Math.floor((m.clock / MATCH) * 90));
  return {
    get match() { return m; },
    get minute() { return minute(); },
    tick(dt, camera) {
      if (warm > 0) { const n = Math.min(warm, WARM_CHUNK); for (let i = 0; i < n; i++) stepMatch(m, STEP, Math.random); warm -= n; return; }
      acc = Math.min(acc + dt, 0.25);
      while (acc >= STEP) { stepMatch(m, STEP, Math.random); acc -= STEP; }
      if (m.clock > MATCH && m.phase === 'play') m = newMatch({ kickoff: Math.random() < 0.5 ? 0 : 1 });
      follow(cam, m, dt);
      to.copy(camera.position).sub(here);
      if (to.lengthSq() > NEAR * NEAR || to.dot(facing) <= 0) return;
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      if (!frustum.intersectsSphere(screen)) return;
      paint += dt;
      if (paint < 1 / fps()) return;
      paint = 0;
      drawMatch(g, c.width, c.height, m, cam, { minute: minute() });
      texture.needsUpdate = true;
    },
  };
}
