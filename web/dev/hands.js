import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeGun } from '../src/range/gun.js';
import { stats } from '../src/pure/arsenal.js';
import { newWeapon, step } from '../src/pure/weapon.js';
import { CLIPS } from '../src/pure/clips.js';

// A bench for the hands at the range: the gun in the hand seen from the eye and from round about, at any moment of
// any clip. ?gun=pistol&file=<a gun file>&hands=0. A hold is changed in src/pure/handling.js, then node blender/holds.js.
// window.__bench drives it for the checks.
const params = new URLSearchParams(location.search), gunId = params.get('gun') || 'pistol', file = params.get('file') || '../assets/range/p22.glb';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const eye = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
const VIEWS = {
  eye: null,
  right: [[0.62, -0.1, -0.31], [0.085, -0.12, -0.31]],
  left: [[-0.45, -0.1, -0.31], [0.085, -0.12, -0.31]],
  below: [[0.1, -0.6, -0.26], [0.085, -0.12, -0.31]],
  front: [[0.09, -0.1, -0.85], [0.085, -0.12, -0.31]],
  top: [[0.09, 0.4, -0.3], [0.085, -0.12, -0.31]],
  back: [[0.32, 0.06, 0.08], [0.085, -0.12, -0.31]],
};
let gun = null, s = stats(gunId, []), w = newWeapon(s), shown = ['eye', 'right', 'left', 'below'], cueLog = [];
const input = { aim: false, fire: false, turn: [0, 0], strafe: 0, crouch: 0 };

async function build() {
  if (gun) gun.scene.clear();
  gun = await makeGun({ env, id: gunId, file, onCue: c => cueLog.push(c) });
  if (params.get('hands') === '0') for (const h of Object.values(gun.hands)) h.root.visible = false;
  gun.scene.background = new THREE.Color(0x24282f);
}

// Runs the gun from a fresh draw to `t` seconds into `what`, in steps of 1/120 s, the way the range would.
function play(what = 'idle', t = 0, opts = {}) {
  s = stats(gunId, opts.attachments || []);
  w = newWeapon(s); gun.draw(); cueLog = [];
  const dt = 1 / 120, tick = hands => {
    for (const ev of step(w, s, dt, hands)) gun.event(ev, s);
    gun.update(dt, eye, w, s, { ...input, aim: !!hands.aimHeld, fire: !!hands.fire });
  };
  for (let i = 0; i < 90; i++) tick({});
  if (what === 'empty' || what === 'reloadEmpty') w.ammo = 1;
  if (what === 'empty' || what === 'reloadEmpty' || what === 'fire') { tick({ fire: true }); tick({}); }
  if (what === 'empty') { for (let i = 0; i < 40; i++) tick({}); }
  if (what === 'reload' || what === 'reloadEmpty') { w.ammo = Math.min(w.ammo, what === 'reload' ? 7 : 0); tick({ reload: true }); }
  if (what === 'inspect') gun.inspect(w, s);
  if (what === 'draw') { w = newWeapon(s); gun.draw(); }
  const n = Math.round(t / dt);
  for (let i = 0; i < n; i++) tick({ aimHeld: what === 'aim' });
  render();
  return { phase: w.phase, t: w.t, ammo: w.ammo, cues: cueLog.slice() };
}

function render() {
  const W = innerWidth, Hh = innerHeight, n = shown.length, cols = n > 2 ? 2 : n, rows = Math.ceil(n / cols), cw = W / cols, ch = Hh / rows;
  renderer.setSize(W, Hh);
  renderer.setScissorTest(true);
  shown.forEach((name, i) => {
    const x = (i % cols) * cw, y = Hh - (Math.floor(i / cols) + 1) * ch;
    renderer.setViewport(x, y, cw, ch); renderer.setScissor(x, y, cw, ch);
    let cam = gun.camera;
    if (name === 'eye') { eye.aspect = cw / ch; gun.update(0, eye, w, s, input); }
    else { cam = new THREE.PerspectiveCamera(30, cw / ch, 0.01, 10); cam.position.set(...VIEWS[name][0]); cam.lookAt(...VIEWS[name][1]); }
    renderer.render(gun.scene, cam);
  });
  renderer.setScissorTest(false);
}

const bar = document.getElementById('bar'), info = document.getElementById('info');
const moments = [['idle', 0], ['aim', 0.4], ['fire', 0.01], ['empty', 0], ['reload', 0.2], ['reload', 0.5], ['reload', 0.8], ['reload', 1.0], ['reload', 1.3],
  ['reloadEmpty', 1.2], ['reloadEmpty', 1.45], ['reloadEmpty', 1.62], ['inspect', 0.7], ['inspect', 1.9], ['inspect', 2.7], ['draw', 0.2]];
for (const [what, t] of moments) {
  const b = document.createElement('button');
  b.textContent = `${what} ${t}`;
  b.onclick = () => { const r = play(what, t); info.textContent = JSON.stringify(r); };
  bar.append(b);
}
addEventListener('resize', render);
await build();
play('idle', 0);
const own = CLIPS[gunId];
// Holds the gun still in one place of a clip ([x, y, z, pitch, yaw, roll]) with the hands in poses by name, to try a key.
async function still(G, left = 'low', right = 'straight') {
  CLIPS[gunId] = s => ({ ...own(s), inspect: { T: 99, gun: [[0, G]], left: [[0, left]], right: [[0, right]] } });
  await build();
  const r = play('inspect', 0.4);
  CLIPS[gunId] = own;
  return r;
}
window.__bench = {
  play, render, build, still,
  views(list) { shown = list; render(); },
  get gun() { return gun; },
};
