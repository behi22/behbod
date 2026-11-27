import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadHand, makeRealHand, handMaterial, makeSleeve } from '../src/realhand.js';
import { makeSleeveMaterials } from '../src/range/hands.js';
import { rest, relaxed } from '../src/pure/realhand.js';
import { DESK_POSES } from '../src/pure/realposes.js';
import { DESK, KEYS, keyTop } from '../src/pure/realholds.js';
import { makeGun } from '../src/range/gun.js';
import { stats } from '../src/pure/arsenal.js';
import { newWeapon, step } from '../src/pure/weapon.js';
import { RIGS } from '../src/pure/rigs.js';
import { GUN_HOLDS } from '../src/pure/handling.js';
import { onSurface, SHOOT } from '../src/pure/realholds.js';

// Bench for the realistic hands (blender/build_hand.py): ?view=<name>&look=skin|toy, or window.__bench.show(view, look).
// Desk views: typing, press, reach, mouse, rest; a hand alone: back, palm, fist; each range gun from the eye as the
// range holds it: pistol, smg, rifle, sniper, lmg, and from outside: pistol-right, pistol-left, pistol-below, pistol-front.
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
const knit = makeSleeveMaterials();
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
const keys = {}, capM = std(0x1a1b1e, 0.45);
for (const k of KEYS) { const t = keyTop(k); keys[k.id] = add(desk, new RoundedBoxGeometry(k.d, DESK.key.h, k.w, 2, 0.002), capM, [t[0], t[1] - DESK.key.h / 2, t[2]]); }
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
  press: { poses: DESK_POSES.press, down: { KeyE: 0.0035, KeyJ: 0.0018 }, cam: SEAT },
  'press-close': { poses: DESK_POSES.press, down: { KeyE: 0.0035, KeyJ: 0.0018 }, cam: [[0.22, 0.26, -0.34], [-0.06, 0.05, -0.02]] },
  reach: { poses: DESK_POSES.reach, cam: SEAT },
  mouse: { poses: DESK_POSES.mouse, cam: [[-0.3, 0.28, 0.22], [-0.02, 0.02, 0.26]] },
  rest: { poses: DESK_POSES.rest, cam: [[-0.3, 0.3, -0.62], [-0.04, 0.0, -0.3]] },
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
  const turn = gun.hands.right.root.parent;
  // ?marks: where the trigger finger's pad and each thumb are meant to go.
  if (params.has('marks')) {
    const H = GUN_HOLDS[id], dot = (p, c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.position.set(...p); m.renderOrder = 9; turn.add(m); };
    dot(H.trigger.pad, 0xff3030);
    dot(onSurface(H.shape, SHOOT.thumb), 0x30ff60);
    if (H.thumbs.left) dot(H.thumbs.left, 0x30ff60);
  }
  return (guns[id] = { gun, w, s, eye, input, own: gun.hands.right.mesh.material });
}

// Outside cameras on a gun (the eye's space: the gun sits about 30 cm ahead, low and right), to check a hold all round.
// Each from the gun's grip (the pistol's at the hip), on a long gun from between its two hands and further out; 'behind'
// is from over my shoulder.
const AROUND = { right: [0.535, 0.02, 0], left: [-0.535, 0.02, 0], below: [0.015, -0.48, 0.05], front: [0.005, 0.02, -0.54], top: [0.005, 0.54, 0.11], behind: [0.02, 0.12, 0.3] };
function aroundGun(id, side) {
  const hip = RIGS[id].hip.p, long = id !== 'pistol', at = [hip[0], hip[1] - 0.048, hip[2] + 0.02 - (long ? 0.15 : 0)], k = long ? 1.5 : 1;
  return [AROUND[side].map((v, i) => at[i] + v * k), at];
}
const GUN_IDS = ['pistol', 'smg', 'rifle', 'sniper', 'lmg'];
const views = [...Object.keys(DESK_VIEWS), ...Object.keys(SOLO), ...GUN_IDS];
const extra = GUN_IDS.flatMap(g => Object.keys(AROUND).map(a => `${g}-${a}`));
let view = [...views, ...extra].includes(params.get('view')) ? params.get('view') : 'typing';
const info = document.getElementById('info'), bar = document.getElementById('bar');
const cam = new THREE.PerspectiveCamera(40, 1, 0.005, 20);

async function draw() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H);
  cam.aspect = W / H; cam.updateProjectionMatrix();
  for (const h of [...Object.values(deskHands), soloHand]) h.setMaterial(looks[look]);
  if (DESK_VIEWS[view]) {
    const v = DESK_VIEWS[view];
    for (const [k, m] of Object.entries(keys)) m.position.y = DESK.key.top - DESK.key.h / 2 - ((v.down || {})[k] || 0);
    for (const side of ['left', 'right']) {
      const p = v.poses[side];
      deskHands[side].root.visible = !!p;
      // The forearm runs back toward me from the wrist, a little out to that side.
      if (p) deskHands[side].pose(p, [p.at[0] - 0.24, p.at[1] - 0.09, p.at[2] + (side === 'left' ? -0.11 : 0.11)]);
    }
    cam.fov = 40; cam.position.set(...v.cam[0]); cam.lookAt(...v.cam[1]); cam.updateProjectionMatrix();
    renderer.render(desk, cam);
  } else if (SOLO[view]) {
    const v = SOLO[view];
    soloHand.pose(v.pose(), [-0.25, -0.02, 0]);
    cam.fov = 35; cam.position.set(...v.cam[0]); cam.lookAt(...v.cam[1]); cam.updateProjectionMatrix();
    renderer.render(solo, cam);
  } else {
    const [id, side] = view.split('-'), around = AROUND[side] && aroundGun(id, side), G = await gunScene(id);
    // The soft white is the range's own material, under the range's light.
    for (const h of Object.values(G.gun.hands)) h.setMaterial(look === 'toy' ? G.own : looks.skin);
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
