import * as THREE from 'three';
import { warmth, glowColour, HOLD } from './pure/warmth.js';

// The piano lamp glows warmer and brighter while the piano plays: a soft amber glow swells under its shade and eases
// away after. Its bulb sits inside the shade, out of sight, so the glow is a small soft disc of its own, turned to face
// you, added over what is behind it. It is a 'bulb' on the light switch, so with the lamps off it stays as dim as every
// other lamp. At rest it is not drawn at all, so the house looks exactly as before.
export function makePianoLamp({ scene, bulb }) {
  if (!bulb) return { tick() {}, get k() { return 0; }, get glow() { return null; } };
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, a] of [[0, 1], [0.25, 0.55], [0.5, 0.2], [0.75, 0.05], [1, 0]]) grad.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  mat.userData.lamp = 'bulb';
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat);
  glow.name = 'pianolamp_warm';
  // Just under the shade's lip, where its light comes out.
  new THREE.Box3().setFromObject(bulb).getCenter(glow.position).y -= 0.035;
  glow.renderOrder = 3;
  glow.visible = false;
  // Turned to whichever camera draws it (the view, a reflection, a test's picture) just before it is drawn.
  glow.onBeforeRender = (r, s, camera) => { glow.quaternion.setFromRotationMatrix(camera.matrixWorld); glow.updateMatrixWorld(); };
  scene.add(glow);
  let k = 0;
  return {
    get k() { return k; },
    get glow() { return glow; },
    // song: a song is playing; struck: when a key was last struck by hand (performance.now()).
    tick(dt, song, struck) {
      const next = warmth(k, song || performance.now() - struck < HOLD * 1000, dt);
      if (next !== k) { k = next; mat.color.fromArray(glowColour(k)); glow.visible = k > 0; }
    },
  };
}
