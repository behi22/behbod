import * as THREE from 'three';
import { b2t } from './engine.js';

// The balcony telescope: a narrow, round view of the sky over the city. Somewhere up there is a moon that is not a moon,
// visible only through the eyepiece.
const CSS = `
.ts-veil { position: fixed; inset: 0; pointer-events: none; z-index: 30; background: radial-gradient(circle at 50% 50%, transparent 0, transparent 34vmin, rgba(0,0,0,.92) 36vmin, #000 60vmin); }
.ts-ui { position: fixed; left: 0; right: 0; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 31; display: flex; justify-content: center; gap: 10px; align-items: center; pointer-events: none;
  font: 500 13px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #cfd8e6; }
.ts-ui span { background: rgba(8,10,16,.7); padding: 7px 12px; border-radius: 999px; }
.ts-ui button { pointer-events: auto; font: inherit; color: #e8edf5; background: rgba(8,10,16,.8); border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 7px 14px; cursor: pointer; }
`;
const FOV = 16;

// `facing` is the way to the viewer: the dish sits in the upper half on that side.
function deathStar(facing) {
  const g = new THREE.Group();
  // Unlit like the rest of the loft, with the sun's side painted in: lit from up and to one side of the viewer.
  const sun = facing.clone().add(new THREE.Vector3(0.8, 0.9, 0)).normalize();
  const ball = new THREE.SphereGeometry(7, 48, 32), nrm = ball.attributes.normal, col = new Float32Array(nrm.count * 3);
  for (let i = 0; i < nrm.count; i++) { const k = 0.18 + 0.62 * Math.max(0, nrm.getX(i) * sun.x + nrm.getY(i) * sun.y + nrm.getZ(i) * sun.z); col.set([k, k * 1.02, k * 1.06], i * 3); }
  ball.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dark = new THREE.MeshBasicMaterial({ color: 0x2a2d33, fog: false });
  g.add(new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  const trench = new THREE.Mesh(new THREE.TorusGeometry(7.02, 0.12, 6, 96), dark);
  trench.rotation.x = Math.PI / 2; g.add(trench);
  const n = facing.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize();
  const dish = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), dark);
  dish.position.copy(n).multiplyScalar(7.12); dish.lookAt(n.clone().multiplyScalar(20)); g.add(dish);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 0.7), fog: false }));
  eye.position.copy(n).multiplyScalar(7.18); g.add(eye);
  return g;
}

// `sky` is the 3D outside's Death Star direction (kept up to date by it). A small one is drawn on that line too, in the
// loft's own scene, so it shows through the eyepiece even when clouds cover the real sky.
export function makeTelescope(scene, camera, meta, { sky, onSpot, onExit }) {
  const scope = b2t(...meta.points.telescope);
  const eye = scope.clone().add(new THREE.Vector3(0, 0.35, 0.45));
  // North of the balcony and well up the sky, a little east of straight ahead.
  const dir = sky || new THREE.Vector3(Math.sin(0.5) * Math.cos(0.42), Math.sin(0.42), -Math.cos(0.5) * Math.cos(0.42));
  const star = deathStar(dir.clone().negate());
  star.scale.setScalar(0.2);
  star.position.copy(eye).addScaledVector(dir, 110);
  star.visible = false;
  scene.add(star);
  let fov = FOV;
  if (!document.getElementById('ts-css')) { const s = document.createElement('style'); s.id = 'ts-css'; s.textContent = CSS; document.head.append(s); }

  let active = false, yaw = 0, pitch = 0.15, onIt = 0, spotted = false, veil = null, ui = null, fov0 = 55;
  const fwd = new THREE.Vector3();
  const api = {
    get active() { return active; },
    enter() {
      active = true; star.visible = true; yaw = 0; pitch = 0.15; onIt = 0;
      fov0 = camera.fov; fov = FOV; camera.fov = fov; camera.updateProjectionMatrix();
      veil = document.createElement('div'); veil.className = 'ts-veil';
      ui = document.createElement('div'); ui.className = 'ts-ui';
      const hint = document.createElement('span'); hint.textContent = 'Drag or arrow keys to look, scroll to zoom';
      const button = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', fn); return b; };
      ui.append(hint, button('Zoom in', () => api.zoom(-1)), button('Zoom out', () => api.zoom(1)), button('Leave', () => api.exit()));
      document.body.append(veil, ui);
    },
    exit() {
      if (!active) return;
      active = false; star.visible = false;
      camera.fov = fov0; camera.updateProjectionMatrix();
      veil?.remove(); ui?.remove(); veil = ui = null;
      onExit();
    },
    // Nudges scale with the zoom, so a drag moves the view about the same amount on screen.
    nudge(dx, dy) {
      const k = fov / FOV;
      yaw = THREE.MathUtils.clamp(yaw + dx * k, -1.7, 1.7);
      pitch = THREE.MathUtils.clamp(pitch + dy * k, -0.05, 1.2);
    },
    zoom(step) {
      fov = THREE.MathUtils.clamp(fov * (step > 0 ? 1.25 : 0.8), 4, FOV);
      camera.fov = fov; camera.updateProjectionMatrix();
    },
    view(out, aim) {
      fwd.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      out.copy(eye); aim.copy(eye).add(fwd);
    },
    tick(dt) {
      if (!active) return;
      star.position.copy(eye).addScaledVector(dir, 110);
      // Hold it in the middle of the eyepiece, zoomed in, for a moment to spot it.
      onIt = fwd.angleTo(dir) < THREE.MathUtils.degToRad(fov * 0.3) && fov <= 8 ? onIt + dt : 0;
      if (onIt > 0.6 && !spotted) { spotted = true; onSpot(); }
    },
  };
  return api;
}
