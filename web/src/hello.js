import * as THREE from 'three';
import { b2t } from './engine.js';
import { makeKit } from './persia/kit.js';
import { FINDS, HOOP, SPOT, SAYS, stitches, helloWorld } from './pure/hello.js';

const INK = ['#22314f', '#138f83', '#e8574a'];

// Aida cloth with the stitched lines, `px` pixels across the cloth's circle.
function drawCloth(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d'), { list } = stitches(), r = HOOP.radius - 0.012, k = px / (2 * r), p = HOOP.stitch * k, mid = px / 2;
  g.fillStyle = '#efe7d6'; g.fillRect(0, 0, px, px);
  // The weave: a hole at every stitch corner.
  g.fillStyle = 'rgba(120,100,70,.16)';
  for (let y = mid % p; y < px; y += p) for (let x = mid % p; x < px; x += p) g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
  g.lineCap = 'round';
  for (const s of list) {
    const x = mid + s.u * p, y = mid - s.v * p, h = p * 0.36;
    for (const [col, dx, w] of [['rgba(0,0,0,.18)', 0.8, p * 0.3], [INK[s.ink], 0, p * 0.26]]) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(x - h + dx, y - h + dx); g.lineTo(x + h + dx, y + h + dx); g.moveTo(x + h + dx, y - h + dx); g.lineTo(x - h + dx, y + h + dx); g.stroke();
    }
  }
  // The ring presses the cloth: a soft shade at its edge.
  const sh = g.createRadialGradient(mid, mid, mid * 0.78, mid, mid, mid);
  sh.addColorStop(0, 'rgba(60,40,20,0)'); sh.addColorStop(1, 'rgba(60,40,20,.28)');
  g.fillStyle = sh; g.fillRect(0, 0, px, px);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// The cross-stitch hoop on the studio wall, and the house's hello world finds. `day` is the daylight outside, 0 to 1.
export function makeHello(scene, { day = () => 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'hello_hoop';
  group.position.copy(b2t(HOOP.center[0], HOOP.center[1] + 0.012, HOOP.center[2]));
  group.rotation.y = Math.PI;
  scene.add(group);
  const R = HOOP.radius, kit = makeKit({ ambient: 0.62, sky: 0.22, key: 0.18 });
  kit.add(new THREE.TorusGeometry(R - 0.01, 0.007, 8, 64), '#d9bb8d', { at: [0, 0, 0.004] });
  kit.add(new THREE.TorusGeometry(R, 0.009, 8, 64), '#c9a475', { at: [0, 0, 0.008] });
  kit.box(0.034, 0.024, 0.026, '#c9a475', { at: [0, R + 0.014, 0.008] });
  kit.cyl(0.005, 0.005, 0.056, '#c7a14c', { at: [0, R + 0.014, 0.008], rot: [0, 0, Math.PI / 2], seg: 10 });
  kit.ball(0.0068, '#c7a14c', { at: [0.031, R + 0.014, 0.008] });
  // Twine from the clasp to a nail above it.
  for (const s of [-1, 1]) kit.box(0.0025, 0.05, 0.002, '#b39a74', { at: [s * 0.008, R + 0.048, 0.004], rot: [0, 0, s * 0.32] });
  kit.cyl(0.004, 0.004, 0.006, '#4d4f55', { at: [0, R + 0.071, 0.004], rot: [Math.PI / 2, 0, 0], seg: 10 });
  const frame = kit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
  const cloth = new THREE.Mesh(new THREE.CircleGeometry(R - 0.012, 56), new THREE.MeshBasicMaterial({ map: drawCloth(512), fog: true }));
  cloth.position.z = 0.005;
  cloth.matrixAutoUpdate = false; cloth.updateMatrix();
  group.add(frame, cloth);
  group.updateMatrixWorld(true);
  const mats = [frame.material, cloth.material];

  const at = SPOT.at, spot = { ...SPOT, at: [...at], x: at[0], y: at[2], z: -at[1] };
  const found = new Set();
  const find = where => {
    if (found.has(where)) return;
    found.add(where);
    dispatchEvent(new CustomEvent('loft:hello', { detail: { where, found: FINDS.filter(f => found.has(f)) } }));
  };
  addEventListener('loft:cmd', e => { if (helloWorld(e.detail?.cmd)) find('terminal'); });
  let said = 0, dayK = -1;
  return {
    group, spots: [spot],
    get found() { return FINDS.filter(f => found.has(f)); },
    poke(id) {
      if (id !== SPOT.id) return null;
      find('hoop');
      return SAYS[said++ % SAYS.length];
    },
    // A press on the hoop; given `blockers`, only when none of them is in front. The spot to walk to, or null.
    hit(ray, blockers) {
      const h = ray.intersectObject(group, true)[0];
      if (!h) return null;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < h.distance - 0.05) ? spot : null;
    },
    // Brightens a little by day, as the baked room does.
    tick() {
      const k = day();
      if (Math.abs(k - dayK) < 0.02) return;
      dayK = k;
      for (const m of mats) m.color.setRGB(1 + 0.12 * k, 1 + 0.12 * k, 1 + 0.18 * k).multiplyScalar(m === cloth.material ? 0.9 : 1);
    },
  };
}
