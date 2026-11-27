import * as THREE from 'three';
import { makeKit } from './persia/kit.js';

// A small webcam clipped on the main monitor's top bezel, just right of the light bar: a pill body on a hinge, a glass
// lens in a dark ring, and a clip whose plate rests on the monitor and whose leg hangs down behind it. Its status
// light comes on while I sit at the desk.
// Where it sits: this far right of the monitor's middle (the light bar takes 23 cm each way, the upper monitor 31.5), and the monitor's frame
// (blender/zones/studio.py: the shell runs from 2 mm to 4 cm behind the screen, its top 1.4 cm over the screen).
export const WEBCAM = { right: 0.36, bezel: 0.014, front: 0.002, back: 0.04 };
const W = 0.088, H = 0.027, D = 0.024, R = 0.0125, HINGE = 0.005, PLATE = 0.003;

// Its place on the top edge: the point under its middle and the way its lens looks (three's axes).
export function webcamPlace(s, right = WEBCAM.right) {
  const c = { x: s.center[0], y: s.center[2], z: -s.center[1] };
  return { at: [c.x, c.y + s.h / 2 + WEBCAM.bezel, c.z + right], facing: [-1, 0, 0] };
}

// A rounded rectangle w by h (corner r) pushed back d from z 0, as one closed solid.
function slab(w, h, d, r, bevel = 0) {
  const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
  s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.absarc(x, -y, r, -Math.PI / 2, 0); s.lineTo(w / 2, y); s.absarc(x, y, r, 0, Math.PI / 2);
  s.lineTo(-x, h / 2); s.absarc(-x, y, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, -y); s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -d + bevel);
  return g;
}

export function makeWebcam(scene, meta) {
  const s = meta.screens.main, { at, facing } = webcamPlace(s);
  const group = new THREE.Group();
  group.name = 'webcam';
  group.position.set(...at);
  // Its own axes: z out of the lens toward me, y up, x to my right.
  group.rotation.y = Math.atan2(facing[0], facing[2]);
  const kit = makeKit({ ambient: 0.55, sky: 0.3, key: 0.22 });
  const plastic = '#2a2c31', dark = '#141518', rubber = '#1b1c1f';
  // The clip: a plate on the monitor's top, a lip over the bezel's front, a leg down the back, and the hinge.
  const depth = WEBCAM.back - WEBCAM.front + 0.006, mid = -(WEBCAM.front + WEBCAM.back) / 2;
  kit.box(0.046, PLATE, depth, plastic, { at: [0, PLATE / 2, mid] });
  kit.box(0.046, 0.009, 0.003, rubber, { at: [0, -0.0035, -WEBCAM.front + 0.0016] });
  kit.box(0.044, 0.042, 0.004, plastic, { at: [0, -0.019, -WEBCAM.back - 0.003], rot: [0.12, 0, 0] });
  kit.cyl(HINGE, HINGE, 0.036, '#33363c', { at: [0, PLATE + HINGE * 0.8, -0.004], rot: [0, 0, Math.PI / 2], seg: 14 });
  // The body, its front a touch forward of the bezel, its back over the plate.
  const bodyY = PLATE + HINGE * 1.6 + H / 2, bodyZ = 0.012;
  kit.add(slab(W, H, D, R, 0.002), plastic, { at: [0, bodyY, bodyZ] });
  kit.add(slab(W - 0.006, H - 0.006, 0.001, R - 0.003), dark, { at: [0, bodyY, bodyZ + 0.0008] });
  // The lens: a ring, its glass with a little light caught in it, and the dark pupil in the middle.
  const lz = bodyZ + 0.0016;
  kit.cyl(0.0088, 0.0094, 0.003, '#3d4047', { at: [0, bodyY, lz], rot: [Math.PI / 2, 0, 0], seg: 24 });
  kit.cyl(0.0069, 0.0069, 0.0006, n => (n.z > 0.5 ? '#0d1220' : '#202329'), { at: [0, bodyY, lz + 0.0016], rot: [Math.PI / 2, 0, 0], seg: 24 });
  kit.cyl(0.0034, 0.0034, 0.0006, '#04060a', { at: [0, bodyY, lz + 0.0021], rot: [Math.PI / 2, 0, 0], seg: 18 });
  kit.add(new THREE.CircleGeometry(0.0018, 12), '#8d9bb4', { at: [-0.0028, bodyY + 0.0029, lz + 0.0026], light: () => 1 });
  // Two pinholes for its microphones.
  for (const x of [-0.03, 0.03]) kit.cyl(0.0011, 0.0011, 0.0004, '#08090b', { at: [x, bodyY, bodyZ + 0.0013], rot: [Math.PI / 2, 0, 0], seg: 8 });
  const body = kit.mesh();
  body.name = 'webcam_body';
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  ledMat.userData.lamp = 'glow';
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 10, 6), ledMat);
  led.name = 'webcam_led';
  led.position.set(0.0155, bodyY, bodyZ + 0.0012);
  group.add(body, led);
  group.updateMatrixWorld(true);
  scene.add(group);
  let on = null;
  // The light: a soft white while I sit at the desk, off otherwise.
  function light(v) {
    if (v === on) return;
    on = v;
    if (v) ledMat.color.setRGB(1.5, 1.6, 1.65); else ledMat.color.setRGB(0.05, 0.05, 0.055);
  }
  light(false);
  return { group, led, tick: seated => light(!!seated), get on() { return on; } };
}
