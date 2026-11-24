// The keepy-up ball in the keeper's corner: E beside it, a click or a tap on it, knocks it up; touch it again before it
// lands. It bounces, rolls and comes to rest, never leaves the corner, and does no work while it lies still.
import * as THREE from 'three';
import { piece, mesh, PAINT, sph } from './shapes.js';
import { R, newBall, touch, advance, cornerOf } from './pure/keepy.js';

// In reach for E, in metres from the ball; a click or tap reaches a little further, and walks me over from further off.
const NEAR = 1.1, TAP = 2.2, KEY = 'loft.keepy';
const UP = new THREE.Vector3(0, 1, 0), PHI = (1 + Math.sqrt(5)) / 2;
// The twelve pentagons of a football sit where an icosahedron's corners point.
const POINTS = [[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI], [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0], [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1]];

let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (shadowTex = new THREE.CanvasTexture(c));
}

export function makeKeepyBall(scene, meta, { sfx = null, toast = () => {}, store = null, coarse = false, walkTo = null } = {}) {
  const corner = cornerOf(meta);
  if (!corner) return null;
  const ball = newBall(corner.home);
  const saved = parseInt(store?.get(KEY) || '0', 10);
  ball.best = Number.isFinite(saved) && saved > 0 ? Math.min(saved, 9999) : 0;

  // The white of the ball keeps its soft light from above as it spins; only its pentagons turn with it.
  const root = new THREE.Group(), turn = new THREE.Group();
  root.name = 'keepy_ball';
  const shell = mesh([piece(sph(R, 28, 20), '#efeeea')]);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const patches = mesh(POINTS.map(v => {
    e.setFromQuaternion(q.setFromUnitVectors(UP, new THREE.Vector3(...v).normalize()));
    // Lifted a little off the white, or its straight edges would dip under the round of the ball.
    return piece(new THREE.SphereGeometry(R * 1.024, 5, 2, 0, Math.PI * 2, 0, 0.36), '#1b1d22', [0, 0, 0], [e.x, e.y, e.z], [1, 1, 1], 0.25);
  }));
  turn.add(patches);
  root.add(shell, turn);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.35, 24), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1;
  scene.add(root, shadow);

  const spot = { id: 'keepy', label: 'Keep the ball up', at: [0, 0, 0], x: 0, y: 0, z: 0, r: NEAR };
  const where = new THREE.Vector3(), spin = new THREE.Vector3(), dq = new THREE.Quaternion(), pick = new THREE.Sphere(new THREE.Vector3(), R * (coarse ? 2.4 : 1.6));
  let still = false, waitT = 0;
  function show() {
    root.position.set(ball.p[0], ball.p[1], ball.p[2]);
    const under = ball.on ? ball.on.top : 0, h = Math.max(0, ball.p[1] - R - under), k = 1 / (1 + h * 1.4);
    shadow.position.set(ball.p[0], under + 0.004, ball.p[2]);
    shadow.scale.setScalar(1 + h * 0.5);
    shadow.material.opacity = k;
    Object.assign(spot, { x: ball.p[0], z: ball.p[2], at: [ball.p[0], -ball.p[2], 0] });
  }
  // Lying still, nothing about it is worked out again each frame.
  function freeze(on) {
    if (still === on) return;
    still = on;
    for (const o of [root, turn, shell, patches, shadow]) { o.matrixAutoUpdate = !on; if (on) o.updateMatrix(); }
  }
  function label() {
    spot.label = waitT > 0 ? 'Wait for it to drop' : ball.count ? `Keep it up: ${ball.count}` : 'Keep the ball up';
  }
  show(); freeze(true);

  function kick(aim) {
    const r = touch(ball, aim);
    if (r === 'touch') { freeze(false); sfx?.ballTouch?.(where.set(...ball.p), 0.8); waitT = 0; }
    else if (r === 'early') waitT = 0.6;
    label();
    return r;
  }
  function ended({ count: n, record }) {
    if (record) { store?.set(KEY, String(n)); if (n >= 3) toast(`${n} in a row. Your best yet.`); }
    else if (n >= 3) toast(`${n} in a row. Your best is ${ball.best}.`);
  }

  return {
    spot, ball,
    get still() { return still; },
    // E beside the ball.
    kick: () => kick([0, 0]),
    // A click or tap: on the ball and close enough, a touch that sends it away from the side it was hit on; on the ball
    // from further off, a walk over to it. True when the ball was hit and nothing stood in front of it.
    tap(ray, blockers, player) {
      pick.center.set(...ball.p);
      const hit = ray.ray.intersectSphere(pick, new THREE.Vector3());
      if (!hit) return false;
      const d = hit.distanceTo(ray.ray.origin);
      if (blockers && ray.intersectObjects(blockers, true).some(h => h.distance < d - 0.15)) return false;
      const off = Math.hypot(player.x - ball.p[0], player.z - ball.p[2]);
      if (off > TAP || Math.abs(player.y) > 0.6) {
        const from = new THREE.Vector3(...ball.p).setY(0), to = new THREE.Vector3(player.x, 0, player.z).sub(from);
        walkTo?.(from.add(to.setLength(Math.min(0.6, to.length()))));
        return true;
      }
      const side = hit.sub(pick.center);
      kick([-side.x / pick.radius * 0.5, -side.z / pick.radius * 0.5]);
      return true;
    },
    // `player`: where I stand (three's axes) while walking, else null; `vel` my speed.
    tick(dt, player, vel) {
      const by = player && player.y < 0.6 && Math.hypot(player.x - ball.p[0], player.z - ball.p[2]) < 0.5;
      if (waitT > 0 && (waitT -= dt) <= 0) label();
      if (ball.rest && !by && ball.cool <= 0 && ball.lock <= 0) return;
      const ev = advance(ball, dt, { bounds: corner.bounds, solids: corner.solids, player: by ? { x: player.x, z: player.z, v: [vel?.x || 0, vel?.z || 0] } : null });
      if (ball.rest && !ev.length) return;
      freeze(false);
      for (const x of ev) {
        if ((x.type === 'bounce' || x.type === 'wall') && x.speed > 0.5) sfx?.ballBounce?.(where.set(...ball.p), Math.min(1, x.speed / 5));
        else if (x.type === 'land') ended(x);
      }
      spin.set(...ball.spin);
      const w = spin.length();
      if (w > 1e-4) turn.quaternion.premultiply(dq.setFromAxisAngle(spin.divideScalar(w), w * Math.min(dt, 0.1)));
      show();
      label();
      if (ball.rest) freeze(true);
    },
  };
}
