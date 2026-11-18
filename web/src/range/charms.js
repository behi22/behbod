import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lit } from './lit.js';

// Original trinkets from simple shapes; the swing turns each root on its hook, so `len` is how far below it hangs.
let M = null;
// One kind of material for every charm, so the graphics card builds a single program for all of them.
function materials() {
  if (M) return M;
  const mk = (hex, rough = 0.5, metal = 0, glow = null) => lit(new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, emissive: glow ?? 0x000000, emissiveIntensity: glow ? 1.6 : 0 }));
  M = {
    steel: mk(0xb9bec4, 0.3, 1), vinyl: mk(0xf2efe8, 0.45), orange: mk(0xff7a2e, 0.45), dark: mk(0x15191e, 0.4), teal: mk(0x5fe3d0, 0.35, 0, 0x2fb8a6),
    red: mk(0xa8182a, 0.38), crown: mk(0x6e1a1f, 0.6), leaf: mk(0x3c6b2a, 0.6), gold: mk(0xe0ab3c, 0.22, 1), grey: mk(0x8b9097, 0.62), white: mk(0xf4f1ea, 0.55),
    amber: mk(0xffb347, 0.3, 0, 0xff8a1a), green: mk(0x9ccf4a, 0.3, 0, 0x5a8a1a), pink: mk(0xe58f9a, 0.5), plate: mk(0x5fe3d0, 0.35, 0.2),
  };
  return M;
}
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const ball = (r, mat, x, y, z, d = 1) => mesh(new THREE.IcosahedronGeometry(r, d), mat, x, y, z);

// Each pendant built with its top at y = 0, hanging down, its front toward -z.
const PENDANTS = {
  pomegranate(m) {
    const g = new THREE.Group(), fruit = ball(0.0068, m.red, 0, -0.0085, 0, 2);
    fruit.scale.set(1, 0.92, 1);
    const crown = mesh(new THREE.CylinderGeometry(0.0029, 0.0019, 0.0034, 6, 1, true), m.crown, 0, -0.0017, 0);
    const leaf = mesh(new THREE.SphereGeometry(0.0022, 6, 4), m.leaf, 0.0024, -0.0012, -0.001);
    leaf.scale.set(1.6, 0.45, 0.8); leaf.rotation.z = 0.5;
    g.add(fruit, crown, leaf);
    return [g, 0.0085];
  },
  rivet(m) {
    const g = new THREE.Group();
    const head = mesh(new RoundedBoxGeometry(0.012, 0.0105, 0.0095, 2, 0.0022), m.vinyl, 0, -0.0085, 0);
    const visor = mesh(new RoundedBoxGeometry(0.0092, 0.0052, 0.0012, 1, 0.0005), m.dark, 0, -0.0085, -0.0047);
    const eyes = [-1, 1].map(s => mesh(new THREE.BoxGeometry(0.0016, 0.0016, 0.0006), m.teal, s * 0.0021, -0.0084, -0.0054));
    const ears = [-1, 1].map(s => { const e = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0016, 10), m.orange, s * 0.0066, -0.0085, 0); e.rotation.z = Math.PI / 2; return e; });
    const stalk = mesh(new THREE.CylinderGeometry(0.0004, 0.0004, 0.0024, 5), m.steel, 0, -0.0022, 0);
    g.add(head, visor, ...eyes, ...ears, stalk, ball(0.0011, m.orange, 0, -0.001, 0));
    return [g, 0.0085];
  },
  drone(m) {
    const g = new THREE.Group(), body = ball(0.0055, m.white, 0, -0.0072, 0, 2);
    body.scale.set(1, 0.72, 1);
    const eye = ball(0.0022, m.amber, 0, -0.0074, -0.0045, 1);
    g.add(body, eye);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, x = Math.cos(a) * 0.0075, z = Math.sin(a) * 0.0075;
      const arm = mesh(new THREE.BoxGeometry(0.0075, 0.0009, 0.0012), m.dark, x / 2, -0.0068, z / 2);
      arm.rotation.y = -a;
      g.add(arm, mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0005, 12), m.dark, x, -0.0062, z));
    }
    return [g, 0.0072];
  },
  die(m) {
    const g = new THREE.Group(), s = 0.0105, h = s / 2, cube = mesh(new RoundedBoxGeometry(s, s, s, 2, 0.0018), m.white, 0, 0, 0), pips = new THREE.IcosahedronGeometry(0.00105, 0);
    g.add(cube);
    // Opposite faces add to seven; the 1 faces out.
    const faces = [[[0, 0, -1], [[0, 0]]], [[0, 0, 1], [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0]]], [[1, 0, 0], [[-1, -1], [1, 1]]], [[-1, 0, 0], [[-1, -1], [0, 0], [1, 1], [-1, 1], [1, -1]]], [[0, 1, 0], [[-1, -1], [0, 0], [1, 1]]], [[0, -1, 0], [[-1, -1], [-1, 1], [1, -1], [1, 1]]]];
    for (const [n, spots] of faces) for (const [u, v] of spots) {
      const p = new THREE.Vector3(...n).multiplyScalar(h + 0.0001), k = s * 0.27;
      if (n[0]) p.add(new THREE.Vector3(0, u * k, v * k)); else if (n[1]) p.add(new THREE.Vector3(u * k, 0, v * k)); else p.add(new THREE.Vector3(u * k, v * k, 0));
      const pip = mesh(pips, m.dark, p.x, p.y, p.z);
      pip.scale.set(n[0] ? 0.35 : 1, n[1] ? 0.35 : 1, n[2] ? 0.35 : 1);
      g.add(pip);
    }
    g.rotation.set(0.35, 0.5, 0.2);
    g.position.y = -0.0078;
    const out = new THREE.Group(); out.add(g);
    return [out, 0.0078];
  },
  cat(m) {
    const g = new THREE.Group(), head = ball(0.0064, m.grey, 0, -0.0078, 0, 2);
    head.scale.set(1.08, 0.92, 0.88);
    const ears = [-1, 1].map(s => { const e = mesh(new THREE.ConeGeometry(0.0024, 0.0042, 4), m.grey, s * 0.0038, -0.0025, 0); e.rotation.z = -s * 0.35; return e; });
    const muzzle = ball(0.003, m.white, 0, -0.0099, -0.0043, 1);
    muzzle.scale.set(1.25, 0.75, 0.7);
    const eyes = [-1, 1].map(s => { const e = ball(0.0011, m.green, s * 0.0024, -0.0071, -0.0052, 1); e.scale.set(1, 1.3, 0.6); return e; });
    const nose = ball(0.0007, m.pink, 0, -0.0088, -0.0061, 0);
    g.add(head, ...ears, muzzle, ...eyes, nose);
    return [g, 0.0078];
  },
  tag(m) {
    const g = new THREE.Group(), w = 0.0115, h = 0.017, r = 0.003, shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, 0); shape.lineTo(w / 2 - r, 0); shape.quadraticCurveTo(w / 2, 0, w / 2, -r); shape.lineTo(w / 2, -h + r);
    shape.quadraticCurveTo(w / 2, -h, w / 2 - r, -h); shape.lineTo(-w / 2 + r, -h); shape.quadraticCurveTo(-w / 2, -h, -w / 2, -h + r);
    shape.lineTo(-w / 2, -r); shape.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
    const plate = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.0014, bevelEnabled: false, curveSegments: 3 }), m.plate, 0, 0, -0.0007);
    g.add(plate);
    // "22" in raised segments on the front.
    const seg = (x, y, horiz) => mesh(new THREE.BoxGeometry(horiz ? 0.0032 : 0.0008, horiz ? 0.0008 : 0.0034, 0.0006), m.dark, x, y, -0.001);
    for (const cx of [-0.0025, 0.0025]) {
      const top = -0.0045, mid = -0.0083, bot = -0.0121;
      g.add(seg(cx, top, true), seg(cx + 0.0016, (top + mid) / 2, false), seg(cx, mid, true), seg(cx - 0.0016, (mid + bot) / 2, false), seg(cx, bot, true));
    }
    return [g, 0.0085];
  },
  star(m) {
    const shape = new THREE.Shape(), R = 0.0072, r = 0.0031;
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; const x = Math.cos(a) * rad, y = Math.sin(a) * rad - R; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 1 });
    geo.translate(0, 0, -0.0006);
    const g = new THREE.Group();
    g.add(mesh(geo, m.gold));
    return [g, 0.0072];
  },
};

// A charm by id, `size` times its own size: { root, len } for the gun to hang, or null.
export function makeCharm(id, size = 1) {
  const build = PENDANTS[id];
  if (!build) return null;
  const m = materials(), root = new THREE.Group();
  // The ring on the hook and two links of chain, each turned a quarter from the last.
  const link = new THREE.TorusGeometry(0.0016, 0.00038, 5, 10);
  root.add(mesh(new THREE.TorusGeometry(0.0022, 0.0004, 5, 12), m.steel, 0, -0.0012, 0));
  for (let i = 0; i < 2; i++) { const l = mesh(link, m.steel, 0, -0.0046 - i * 0.0031, 0); l.rotation.y = i % 2 ? 0 : Math.PI / 2; l.scale.y = 1.35; root.add(l); }
  const [pendant, half] = build(m);
  pendant.position.y -= 0.0085;
  root.add(pendant);
  root.scale.setScalar(size);
  root.traverse(o => { o.frustumCulled = false; });
  return { id, root, len: (0.0085 + half) * size };
}
export const CHARM_IDS = Object.keys(PENDANTS);
