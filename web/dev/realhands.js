import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadHand, makeRealHand, handMaterial, makeSleeve } from '../src/realhand.js';
import { makeHandMaterials } from '../src/range/hands.js';
import { rest, relaxed } from '../src/pure/realhand.js';
import { GUNS, DESK_POSES } from '../src/pure/realposes.js';
import { DESK, keyTop } from '../src/pure/realholds.js';
import { makeGun } from '../src/range/gun.js';
import { stats } from '../src/pure/arsenal.js';
import { newWeapon, step } from '../src/pure/weapon.js';
import { RIGS } from '../src/pure/rigs.js';
import { ELBOWS, GUN_HOLDS } from '../src/pure/handling.js';

// Bench for the realistic hands (blender/build_hand.py), not yet in the house: ?view=<name>&look=skin|toy, or
// window.__bench.show(view, look). Desk views: typing, press, reach, mouse, rest; a hand alone: back, palm, fist;
// each range gun from the eye: pistol, smg, rifle, sniper, lmg, and the same with today's hands: pistol-today and so on.
const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const geo = await loadHand('../assets/hand/hand.glb');
const looks = { skin: handMaterial('skin', { skinUrl: '../assets/hand/skin.webp' }), toy: handMaterial('toy') };
const knit = makeHandMaterials();
let look = params.get('look') === 'toy' ? 'toy' : 'skin';

// ---------- the desk: the keyboard, wrist rest and mouse as blender/zones/studio.py builds them ----------
const desk = new THREE.Scene();
desk.environment = env;
desk.background = new THREE.Color(0x23262c);
desk.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2018, 0.7));
const sun = new THREE.DirectionalLight(0xfff1e0, 2.2);
sun.position.set(-0.4, 1.2, 0.5);
desk.add(sun, sun.target);
const std = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const add = (s, g, m, at) => { const o = new THREE.Mesh(g, m); o.position.set(...at); s.add(o); return o; };
add(desk, new THREE.BoxGeometry(1.6, 0.04, 1.4), std(0x4a3222, 0.55), [0, -0.02, 0]);
add(desk, new THREE.BoxGeometry(0.45, 0.003, 1.12), std(0x1d2024, 0.9), [0.1, 0.0015, 0]);
add(desk, new RoundedBoxGeometry(...DESK.case.size, 2, 0.006), std(0x3a3d43, 0.5), DESK.case.at);
add(desk, new RoundedBoxGeometry(...DESK.rest.size, 3, 0.008), std(0x2b2523, 0.8), DESK.rest.at);
add(desk, new RoundedBoxGeometry(...DESK.mouse.size, 4, DESK.mouse.r), std(0x3a3d43, 0.45), DESK.mouse.at);
const keys = {}, capG = new RoundedBoxGeometry(DESK.key.w, DESK.key.h, DESK.key.d, 2, 0.002), capM = std(0xc9ccd2, 0.55);
for (let r = 0; r < DESK.key.rows; r++) for (let c = 0; c < DESK.key.cols; c++) { const t = keyTop(r, c); keys[`${r},${c}`] = add(desk, capG, capM, [t[0], t[1] - DESK.key.h / 2, t[2]]); }
const deskHands = {};
for (const side of ['left', 'right']) {
  const h = makeRealHand(side, geo, looks[look]);
  h.root.getObjectByName(`${side}_arm`).add(makeSleeve(knit));
  desk.add(h.root);
  deskHands[side] = h;
}
// Each desk view: the poses, the keys pressed down, and the camera.
const SEAT = [[-0.62, 0.36, 0.0], [0.02, 0.02, 0]];
const DESK_VIEWS = {
  typing: { poses: DESK_POSES.home, cam: SEAT },
  'typing-close': { poses: DESK_POSES.home, cam: [[0.22, 0.26, 0.34], [-0.06, 0.05, 0.02]] },
  press: { poses: DESK_POSES.press, down: { '3,11': 0.003, '2,7': 0.0015 }, cam: SEAT },
  'press-close': { poses: DESK_POSES.press, down: { '3,11': 0.003, '2,7': 0.0015 }, cam: [[0.22, 0.26, -0.34], [-0.06, 0.05, -0.02]] },
  reach: { poses: DESK_POSES.reach, down: { '3,4': 0.002 }, cam: SEAT },
  mouse: { poses: DESK_POSES.mouse, cam: [[-0.3, 0.28, -0.22], [-0.02, 0.02, -0.46]] },
  rest: { poses: DESK_POSES.rest, cam: [[-0.3, 0.3, 0.62], [-0.04, 0.0, 0.34]] },
};

// ---------- a hand alone, up close ----------
const solo = new THREE.Scene();
solo.environment = env;
solo.background = new THREE.Color(0x23262c);
solo.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2018, 0.6));
const key2 = new THREE.DirectionalLight(0xfff1e0, 2.0);
key2.position.set(0.3, 1, 0.6);
solo.add(key2);
const soloHand = makeRealHand('right', geo, looks[look]);
soloHand.root.getObjectByName('right_arm').add(makeSleeve(knit));
solo.add(soloHand.root);
const fist = () => ({ ...rest(), cup: 0.6, digits: { index: [0, 1.5, 1.75, 0.9], middle: [-0.05, 1.5, 1.8, 0.85], ring: [-0.25, 1.5, 1.8, 0.85], pinky: [0.05, 1.5, 1.75, 0.8], thumb: [0.55, 0.6, 0.5, 0.4, -0.3] } });
const SOLO = {
  back: { pose: () => ({ ...rest(), digits: relaxed() }), cam: [[0.08, 0.32, 0.05], [0.09, 0, 0]] },
  palm: { pose: () => ({ ...rest(), digits: relaxed() }), cam: [[0.08, -0.32, 0.02], [0.09, -0.01, 0]] },
  side: { pose: () => ({ ...rest(), digits: relaxed() }), cam: [[0.1, -0.02, -0.33], [0.09, -0.01, 0]] },
  fist: { pose: fist, cam: [[0.12, 0.1, -0.3], [0.07, -0.01, 0]] },
};

// ---------- the guns, from the eye ----------
const guns = {};
async function gunScene(id) {
  if (guns[id]) return guns[id];
  const gun = await makeGun({ env, id, file: '../' + RIGS[id].file });
  const s = stats(id, []), w = newWeapon(s), eye = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
  gun.draw();
  const input = { aim: false, fire: false, turn: [0, 0], strafe: 0, crouch: 0 };
  for (let i = 0; i < 120; i++) { for (const ev of step(w, s, 1 / 120, {})) gun.event(ev, s); gun.update(1 / 120, eye, w, s, input); }
  const turn = gun.hands.right.root.parent, mine = {};
  for (const side of ['left', 'right']) {
    const h = makeRealHand(side, geo, looks[look]);
    h.root.getObjectByName(`${side}_arm`).add(makeSleeve(knit));
    turn.add(h.root);
    // The forearm aims at the elbow the range uses, brought from the eye's space into the gun's.
    const el = (RIGS[id].elbows || ELBOWS)[side];
    gun.camera.updateMatrixWorld(true);
    const e = turn.worldToLocal(gun.camera.localToWorld(new THREE.Vector3(...el)));
    h.pose(GUNS[id][side].grip, e.toArray());
    mine[side] = h;
  }
  // ?marks: where the trigger finger's pad and each thumb are meant to go.
  if (params.has('marks')) {
    const H = GUN_HOLDS[id], dot = (p, c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.position.set(...p); m.renderOrder = 9; turn.add(m); };
    dot(H.trigger.pad, 0xff3030);
    for (const t of Object.values(H.thumbs)) dot(t, 0x30ff60);
  }
  return (guns[id] = { gun, w, s, eye, input, mine });
}

// Outside cameras on a gun (the eye's space: the gun sits about 30 cm ahead, low and right), to check a hold all round.
const AROUND = { right: [[0.62, -0.1, -0.31], [0.085, -0.12, -0.31]], left: [[-0.45, -0.1, -0.31], [0.085, -0.12, -0.31]], below: [[0.1, -0.6, -0.26], [0.085, -0.12, -0.31]], front: [[0.09, -0.1, -0.85], [0.085, -0.12, -0.31]] };
const GUN_IDS = ['pistol', 'smg', 'rifle', 'sniper', 'lmg'];
const views = [...Object.keys(DESK_VIEWS), ...Object.keys(SOLO), ...GUN_IDS.flatMap(g => [g, g + '-today'])];
const extra = GUN_IDS.flatMap(g => Object.keys(AROUND).flatMap(a => [`${g}-${a}`, `${g}-today-${a}`]));
let view = [...views, ...extra].includes(params.get('view')) ? params.get('view') : 'typing';
const info = document.getElementById('info'), bar = document.getElementById('bar');
const cam = new THREE.PerspectiveCamera(40, 1, 0.005, 20);

async function draw() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H);
  cam.aspect = W / H; cam.updateProjectionMatrix();
  for (const h of [...Object.values(deskHands), soloHand, ...Object.values(guns).flatMap(g => Object.values(g.mine))]) h.setMaterial(looks[look]);
  if (DESK_VIEWS[view]) {
    const v = DESK_VIEWS[view];
    for (const [k, m] of Object.entries(keys)) { const [r, c] = k.split(',').map(Number); m.position.y = keyTop(r, c)[1] - DESK.key.h / 2 - ((v.down || {})[k] || 0); }
    for (const side of ['left', 'right']) {
      const p = v.poses[side];
      deskHands[side].root.visible = !!p;
      // The forearm runs back toward me from the wrist, a little out to that side.
      if (p) deskHands[side].pose(p, [p.at[0] - 0.24, p.at[1] - 0.02, p.at[2] + (side === 'left' ? -0.06 : 0.06)]);
    }
    cam.fov = 40; cam.position.set(...v.cam[0]); cam.lookAt(...v.cam[1]); cam.updateProjectionMatrix();
    renderer.render(desk, cam);
  } else if (SOLO[view]) {
    const v = SOLO[view];
    soloHand.pose(v.pose(), [-0.25, -0.02, 0]);
    cam.fov = 35; cam.position.set(...v.cam[0]); cam.lookAt(...v.cam[1]); cam.updateProjectionMatrix();
    renderer.render(solo, cam);
  } else {
    const [id, ...rest2] = view.split('-'), today = rest2[0] === 'today', around = AROUND[rest2.at(-1)], G = await gunScene(id);
    for (const h of Object.values(G.gun.hands)) h.root.visible = today;
    for (const h of Object.values(G.mine)) h.root.visible = !today;
    G.eye.aspect = W / H;
    G.gun.update(0, G.eye, G.w, G.s, G.input);
    if (around) { cam.fov = 30; cam.position.set(...around[0]); cam.lookAt(...around[1]); cam.updateProjectionMatrix(); }
    renderer.render(G.gun.scene, around ? cam : G.gun.camera);
  }
  info.textContent = `${view} · ${look === 'skin' ? 'real skin' : 'soft white'}`;
  for (const b of bar.children) b.classList.toggle('on', b.dataset.v === view || b.dataset.l === look);
}
for (const v of views) { const b = document.createElement('button'); b.textContent = v; b.dataset.v = v; b.onclick = () => { view = v; draw(); }; bar.append(b); }
for (const [l, name] of [['skin', 'real skin'], ['toy', 'soft white']]) { const b = document.createElement('button'); b.textContent = name; b.dataset.l = l; b.onclick = () => { look = l; draw(); }; bar.append(b); }
addEventListener('resize', draw);
window.__bench = {
  async show(v, l = look) { view = v; look = l; await draw(); await new Promise(r => setTimeout(r, 50)); await draw(); return true; },
  views, hideUi(on = true) { bar.style.display = info.style.display = on ? 'none' : ''; },
};
await draw();
window.__bench.ready = true;
