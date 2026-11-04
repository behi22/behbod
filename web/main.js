import * as THREE from 'three';
import { makeEngine, b2t } from './src/engine.js';
import { makeLoader } from './src/load.js';
import { makeWorld } from './src/world.js';
import { makeOutside } from './src/outside.js';
import { makePhysics } from './src/physics.js';
import { makeMe, HEAD_NAMES } from './src/me.js';
import { makeFollowCam } from './src/camera.js';
import { makeDesk } from './src/desk.js';
import { makeCollision } from './src/pure/collide.js';
import { tierStep } from './src/pure/tier.js';
import { makeCanvases } from './screens.js';
import { Sound } from './sound.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
const coarse = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

const engine = makeEngine(canvas, coarse);
const { renderer, scene, camera } = engine;
let tierName = params.get('q') || 'auto', autoTier = tierName === 'auto';
engine.onTier(name => { world?.setGloss(name === 'high'); $('q').textContent = 'Quality: ' + (autoTier ? 'auto, ' : '') + name; });

// ---------- loading ----------
const load = makeLoader(f => { $('bar').style.width = (f * 100).toFixed(0) + '%'; });
const meta = await load.json('assets/room.json');
const [zoneGltfs, meGltf] = await Promise.all([Promise.all(meta.zones.map(z => load.glb('assets/' + z.glb, z.id))), load.glb('assets/behbod_v3.glb', 'me')]);

const screens = makeCanvases(meta);
let world = null;
world = makeWorld(scene, zoneGltfs.map(g => g.scene), meta, screens);
const outside = makeOutside(scene, meta, screens);
const col = makeCollision(meta);
const phys = await makePhysics(col);
const physName = phys ? phys.name : 'boxes';
const sound = new Sound();

const me = makeMe(scene, meGltf, { mosaic: params.has('mosaic'), onHead: h => { $('who').textContent = HEAD_NAMES[h]; } });
addEventListener('loft:cmd', e => {
  if (e.detail.cmd !== 'whoami' || me.mosaicUnlocked) return;
  me.unlockMosaic();
  e.detail.say('achievement unlocked: the real you.', 'press H (or the head button) to wear it.');
  toast('Achievement unlocked: the real you');
});
function toast(text) {
  const t = $('toast'); if (!t) return;
  t.textContent = text; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3600);
}

// ---------- state ----------
const pos = b2t(...meta.points.spawn);
const vel = new THREE.Vector3();
const physAt = pos.clone(), lastSafe = pos.clone();
const deskUse = b2t(...meta.points.desk_use), chair = b2t(...meta.points.chair);
const camLook = new THREE.Vector3();
const keys = new Set();
const LOOKS = meta.looks.map(p => b2t(...p));
const SPOTS = Object.fromEntries(Object.entries(meta.spots).map(([k, p]) => [k, b2t(...p)]));
let vy = 0, grounded = true, facing = Math.PI / 2, mode = 'walk', nearDesk = false, airT = 0, idleT = 0, lean = 0, prevFacing = facing;
let crouchHeld = false, lastCrouchTap = 0, rollT = 0, showStats = params.has('stats'), autoTarget = null;
let yaw = -Math.PI / 2 - 0.35, pitch = 0.3, dist = coarse ? 4.3 : 3.3, dragging = null, lastLook = 0;
me.root.position.copy(pos);
phys?.place(pos);

const followPose = makeFollowCam(col, meta.bounds);
const follow = () => followPose(pos, yaw, pitch, dist, me.crouchK);
const desk = makeDesk({ camera, me, meta, coarse, follow });

function useDesk() {
  if (mode !== 'walk') return;
  mode = 'desk';
  autoTarget = null;
  sound.chair();
  me.playOnce('Sitting_Enter');
  me.root.position.copy(chair);
  me.root.rotation.set(0, Math.PI / 2, 0);
  setTimeout(() => { if (mode === 'desk') me.holdPose('Sitting_Idle_Loop'); }, 900);
  desk.enter(camera.position, camLook);
  $('prompt').classList.remove('on');
  screens.focusTerminal(true);
  document.body.classList.add('at-desk');
  $('use').textContent = 'Back';
}
function leaveDesk() {
  if (mode !== 'desk') return;
  mode = 'leaving';
  screens.focusTerminal(false);
  document.body.classList.remove('at-desk');
  $('cmd').blur();
  me.playOnce('Sitting_Exit');
  desk.leave(camera.position, camLook, () => { mode = 'walk'; pos.copy(deskUse); me.root.position.copy(pos); phys?.place(pos); physAt.copy(pos); me.endOneShot(); });
  $('use').textContent = 'Use';
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.target && e.target.id === 'cmd') return;
  if (mode === 'desk') { if (e.key.length === 1 || e.key === 'Enter') sound.key(); return screens.terminalKey(e, () => leaveDesk()); }
  if (!e.repeat && e.code === 'KeyC' && mode === 'walk') {
    const now = performance.now();
    // Double tap C to roll; hold it to crouch. (Ctrl is avoided on purpose: Ctrl+W closes the tab.)
    if (now - lastCrouchTap < 300 && grounded && rollT <= 0) { rollT = 0.85; me.playOnce('Roll'); }
    lastCrouchTap = now;
  }
  keys.add(e.code);
  if (e.code === 'KeyE' && nearDesk) useDesk();
  if (e.code === 'KeyH' && mode === 'walk') me.nextHead();
  if (e.code === 'Backquote') { showStats = !showStats; $('stats').style.display = showStats ? 'block' : 'none'; }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', e => { dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!dragging || e.pointerId !== dragging.id) return;
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  dragging.x = e.clientX; dragging.y = e.clientY; dragging.moved += Math.abs(dx) + Math.abs(dy);
  if (mode === 'desk' && desk.range) { desk.pan(dx); return; }
  if (mode !== 'walk') return;
  yaw -= dx * 0.005; pitch = Math.max(-0.15, Math.min(1.1, pitch + dy * 0.004)); lastLook = performance.now();
});
canvas.addEventListener('pointerup', e => {
  if (dragging && dragging.moved < 6 && mode === 'walk') tapMove(e);
  dragging = null;
});
canvas.addEventListener('wheel', e => { dist = Math.max(1.8, Math.min(6, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: true });

// Click or tap the floor to walk there; click the desk or its screens to sit down and use the computer.
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  if (mode !== 'walk' || !SPOTS[b.dataset.go]) return;
  autoTarget = SPOTS[b.dataset.go].clone(); autoTarget.useDesk = b.dataset.go === 'desk';
}));
$('cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { screens.run(e.target.value, () => leaveDesk()); e.target.value = ''; sound.key(); } });
$('use').addEventListener('click', () => { if (mode === 'desk') leaveDesk(); else if (nearDesk) useDesk(); });
const ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function tapMove(e) {
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (ray.intersectObjects(world.deskThings, false).length) { autoTarget = SPOTS.desk.clone(); autoTarget.useDesk = true; return; }
  floorPlane.constant = -pos.y;
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(floorPlane, hit)) autoTarget = hit;
}
function forwardInput() {
  const f = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) f.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) f.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) f.x += 1;
  if (f.lengthSq()) autoTarget = null;
  if (autoTarget) {
    const d = autoTarget.clone().sub(pos); d.y = 0;
    if (d.length() < 0.35) { const u = autoTarget.useDesk; autoTarget = null; if (u) useDesk(); return f; }
    return d.normalize();
  }
  if (!f.lengthSq()) return f;
  // The camera sits at angle `yaw` from me, so turning the input by `yaw` makes W point away from it.
  return f.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ---------- walking ----------
function walk(dt, now) {
  // Anything that moved me from outside (the tests, leaving the desk, the respawn) moves the capsule too.
  if (phys && pos.distanceToSquared(physAt) > 1e-6) phys.place(pos);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  crouchHeld = keys.has('KeyC') && rollT <= 0;
  const want = forwardInput();
  const speed = want.lengthSq() ? (crouchHeld ? 1.2 : run ? 5.6 : autoTarget ? 2.2 : 1.9) : 0;
  let target = want.multiplyScalar(speed);
  if (rollT > 0) { rollT -= dt; target = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)).multiplyScalar(4.2); }
  const k = grounded ? 10 : 2.5;
  vel.x += (target.x - vel.x) * Math.min(1, k * dt);
  vel.z += (target.z - vel.z) * Math.min(1, k * dt);
  if (keys.has('Space') && grounded && rollT <= 0) { vy = 5.1; grounded = false; airT = 0; me.playOnce('Jump_Start'); sound.jump(); keys.delete('Space'); }
  vy -= 18 * dt;
  const wasGrounded = grounded;
  if (phys) {
    grounded = phys.move(pos, { x: vel.x * dt, y: vy * dt, z: vel.z * dt });
    if (grounded && vy < 0) vy = 0;
  } else {
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    col.pushOut(pos, pos.y);
    pos.y += vy * dt;
    const g = col.groundAt(pos.x, pos.z, pos.y - vy * dt);
    if (pos.y <= g) { pos.y = g; vy = 0; grounded = true; } else if (pos.y > g + 0.05) grounded = false;
  }
  physAt.copy(pos);
  if (grounded && !wasGrounded && airT > 0.25) { me.playOnce('Jump_Land'); sound.land(); }
  // Safety net: if anything ever lets me slip out of the world, put me back where I last stood.
  if (grounded) { lastSafe.copy(pos); airT = 0; }
  else if (pos.y < -2) { pos.copy(lastSafe); vy = 0; vel.set(0, 0, 0); }
  if (!grounded) { airT += dt; if (airT > 0.22 && me.oneShot !== me.acts.Jump_Loop) me.holdPose('Jump_Loop'); }
  else if (me.oneShot === me.acts.Jump_Loop) me.endOneShot();
  const hs = Math.hypot(vel.x, vel.z);
  if (hs > 0.05 && rollT <= 0) { let d = Math.atan2(vel.x, vel.z) - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, 12 * dt); }
  // Lean into turns when moving fast.
  const turnRate = Math.atan2(Math.sin(facing - prevFacing), Math.cos(facing - prevFacing)) / Math.max(dt, 1e-3);
  prevFacing = facing;
  lean += (THREE.MathUtils.clamp(-turnRate * hs * 0.018, -0.2, 0.2) - lean) * Math.min(1, dt * 6);
  idleT = hs < 0.12 && grounded ? idleT + dt : 0;
  // Idle moments: left alone, I glance around, and now and then do something with my hands.
  if (idleT > 14 && !me.oneShot) { me.playOnce('Interact'); idleT = 4; }
  me.root.position.copy(pos);
  me.root.rotation.set(0, facing, lean, 'YXZ');
  if (grounded && hs > 0.3) sound.stepTick(hs > 4.5 ? me.acts.Sprint_Loop : hs > 2.6 ? me.acts.Jog_Fwd_Loop : me.acts.Walk_Loop, hs);
  // Let the camera drift back behind me while I move and nobody is steering it.
  if (hs > 0.5 && now - lastLook > 1600 && !coarse) { let d = (facing + Math.PI) - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, 1.2 * dt); }
  nearDesk = pos.distanceTo(deskUse) < 1.25 && grounded;
  $('prompt').classList.toggle('on', nearDesk);
  return hs;
}

// ---------- frame loop ----------
const clock = new THREE.Clock();
let frames = 0, ftAcc = 0, tierChecked = 0, slowRuns = 0;
function step() {
  const dt = Math.min(clock.getDelta(), 1 / 20), now = performance.now(), t = now / 1000;
  renderer.info.reset();
  const hs = mode === 'walk' ? walk(dt, now) : 0;
  me.placeBlob(col.groundAt);
  me.animate(dt, hs, mode === 'walk' && crouchHeld);
  me.lookAround(dt, idleT, facing, mode === 'walk', LOOKS);
  if (!desk.tick(dt, camLook, () => mode === 'desk')) {
    if (mode === 'walk') {
      const tp = follow();
      camera.position.lerp(tp.p, Math.min(1, 7 * dt));
      camLook.lerp(tp.l, Math.min(1, 9 * dt));
    } else if (mode === 'desk' && desk.range) {
      camera.position.lerp(desk.eye(), Math.min(1, 10 * dt));
      camLook.lerp(desk.aim(), Math.min(1, 10 * dt));
    }
  }
  camera.lookAt(camLook);
  me.drawFace(now);
  me.tickMosaic(now, camera, engine.mosaicU);
  screens.tick(now, dt, mode === 'desk');
  world.tick(dt, t, mode === 'desk');
  outside.tick(dt, t);
  engine.render(dt);

  frames++; ftAcc += dt;
  if (autoTier && frames > 40 && now - tierChecked > 2500) {
    tierChecked = now;
    const r = tierStep(tierName, ftAcc / frames * 1000, now, slowRuns);
    slowRuns = r.slowRuns;
    if (r.tier !== tierName) { tierName = r.tier; engine.setTier(tierName); }
    frames = 0; ftAcc = 0;
  }
  if (showStats) $('stats').textContent = `${(1 / Math.max(dt, 1e-3)).toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · ${physName} · ${outside.weather}${screens.holiday ? ' · ' + screens.holiday.id : ''}`;
  requestAnimationFrame(step);
}

$('q').addEventListener('click', () => {
  const order = ['auto', 'low', 'medium', 'high'];
  const next = order[(order.indexOf(autoTier ? 'auto' : tierName) + 1) % order.length];
  autoTier = next === 'auto';
  tierName = autoTier ? 'high' : next;
  engine.setTier(tierName);
});
$('who').addEventListener('click', () => { if (mode === 'walk') me.nextHead(); });
$('snd').addEventListener('click', () => { const on = sound.toggle(); $('snd').textContent = on ? 'Sound on' : 'Sound off'; $('snd').classList.toggle('on', on); });
if (showStats) $('stats').style.display = 'block';

if (tierName === 'auto') tierName = coarse ? 'medium' : 'high';
engine.setTier(tierName);
engine.resize();
const start = follow();
camera.position.copy(start.p); camLook.copy(start.l);
$('note').textContent = coarse ? 'Tap a spot or the floor to walk there' : 'Drag to look around, WASD to walk, click to go somewhere';
$('enter').classList.add('ready');
$('enter').addEventListener('click', () => { $('gate').classList.add('gone'); sound.start(); $('snd').textContent = 'Sound on'; $('snd').classList.add('on'); });
if (params.has('auto')) $('gate').classList.add('gone');
window.__loft = { pos, keys, useDesk, leaveDesk, nextHead: () => me.nextHead(), renderer, camera, scene,
  get head() { return me.head; }, get mode() { return mode; }, get tier() { return tierName; }, get physics() { return physName; },
  get weights() { return me.weights; }, get headVisible() { return me.root.visible; }, get headMeshesShown() { return me.headMeshesShown; },
  set yaw(v) { yaw = v; lastLook = performance.now(); } };
requestAnimationFrame(step);
