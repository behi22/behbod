import * as THREE from 'three';
import { LOCO, CROUCH, STRIDE, blendWeights, strideRate } from './pure/blend.js';
import { HEADS as ORDER, HEAD_NAMES as NAMES, FITS, sanitizeLook, hoodUp, wornColours } from './pure/look.js';

const HEADS = { hood: ['V3_head_void'], tv: ['V3_head_tv'], visor: ['V3_head_helmet', 'V3_head_visor', 'V3_head_visor_face'], emoji: ['V3_head_emoji'], mosaic: ['V3_head_toy'] };
export const HEAD_NAMES = Object.fromEntries(Object.entries(NAMES).map(([k, v]) => [k, 'Head: ' + v]));
// His picked proportions: 90% height overall and the head at 90%.
const HEIGHT = 0.9, HEAD_SIZE = 0.9;
const ONCE = ['Jump_Start', 'Jump_Land', 'Sitting_Enter', 'Sitting_Exit', 'Interact', 'Roll'];

function radialShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// The sitting styles' motions, built from the single poses in the SitPoses clip (blender/lib/sitposes.py): sitting
// down (standing, an in-between, seated: 1 s), the idle loop (seated, breathe and look one way, seated, the other way:
// 4 s) and standing up. Built here so the file holds a few dozen poses rather than thirty clips.
const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export function sitClips(anims, info) {
  const src = anims.find(c => c.name === 'SitPoses');
  if (!src || !info?.families) return [];
  const fps = info.fps || 24, STEPS = 8;
  const sources = src.tracks.map(tr => ({ tr, it: tr.createInterpolant(), n: tr.getValueSize() }));
  // The exporter puts frame N at N / fps seconds.
  const pose = (s, frame) => s.it.evaluate(frame / fps).slice();
  const q = [0, 0, 0, 0];
  function clip(name, seq) {
    const tracks = sources.map(s => {
      const times = [], values = [];
      for (let k = 0; k < seq.length - 1; k++) {
        const [fa, ta] = seq[k], [fb, tb] = seq[k + 1], A = pose(s, fa), B = pose(s, fb);
        for (let i = 0; i < STEPS; i++) {
          const u = i / STEPS, e = ease(u);
          times.push(ta + (tb - ta) * u);
          if (s.n === 4) { THREE.Quaternion.slerpFlat(q, 0, A, 0, B, 0, e); values.push(...q); } else for (let c = 0; c < s.n; c++) values.push(A[c] + (B[c] - A[c]) * e);
        }
      }
      const [fl, tl] = seq[seq.length - 1];
      times.push(tl); values.push(...pose(s, fl));
      return new s.tr.constructor(s.tr.name, times, values);
    });
    return new THREE.AnimationClip(name, seq[seq.length - 1][1], tracks);
  }
  const out = [];
  for (const [fam, p] of Object.entries(info.families)) {
    out.push(clip(`Sit_${fam}_Enter`, [[info.stand, 0], ...(p.mid ? [[p.mid, 0.45]] : []), [p.sat, 1]]));
    out.push(clip(`Sit_${fam}_Exit`, [[p.sat, 0], ...(p.mid ? [[p.mid, 0.55]] : []), [info.stand, 1]]));
    out.push(clip(`Sit_${fam}_Loop`, [[p.sat, 0], [p.a, 1], [p.sat, 2], [p.b, 3], [p.sat, 4]]));
  }
  return out;
}

// Character v3, the designer-toy me. One model holds every head and accessory; the page shows one look at a time.
export function makeMe(scene, gltf, opts) {
  const root = gltf.scene;
  const parts = {}, mats = {}, bones = {};
  root.traverse(o => {
    if (o.isMesh) { o.frustumCulled = false; [].concat(o.material).forEach(m => { m.envMapIntensity = 0.4; (mats[m.name] ||= []).push(m); }); }
    if (o.isBone) bones[o.name] = o;
    if (o.name) (parts[o.name] ||= []).push(o);
  });
  scene.add(root);

  root.scale.setScalar(HEIGHT);
  let mosaicUnlocked = !!opts.mosaic;
  const unlocked = () => opts.unlocked?.() || [];
  let look = sanitizeLook(opts.saved, { unlocked: unlocked(), mosaic: mosaicUnlocked });
  // A head with several materials loads as a group whose parts carry their own names, so switch the whole subtree.
  const show = (n, on) => (parts[n] || []).forEach(o => o.traverse(c => { c.visible = on; }));
  const tint = (names, hex, k = 1) => names.forEach(n => (mats[n] || []).forEach(m => { m.color.set(hex).multiplyScalar(k); if (m.sheen > 0) { m.sheen = 0.25; m.sheenRoughness = 0.85; m.sheenColor.copy(m.color); } }));
  const visorBase = (mats.M_Visor || [])[0]?.color.clone(), visorGlow = (mats.M_Visor || [])[0]?.emissive?.clone();
  function dress() {
    for (const n of Object.keys(parts)) if (n.startsWith('V3_head_') || n.startsWith('V3_acc_') || n.startsWith('V3_hood_')) show(n, false);
    for (const n of HEADS[look.head]) show(n, true);
    const up = hoodUp(look);
    show('V3_hood_up', up);
    show('V3_hood_down', !up);
    for (const [k, sfx] of Object.entries(FITS.hoodie)) { show('V3_hoodie' + sfx, look.fit.hoodie === k); show('V3_pocket' + sfx, look.fit.hoodie === k); }
    for (const [k, sfx] of Object.entries(FITS.pants)) for (const n of ['V3_pants', 'V3_cargo_l', 'V3_cargo_r', 'V3_flap_l', 'V3_flap_r']) show(n + sfx, look.fit.pants === k);
    for (const a of look.acc) show('V3_acc_' + a, true);
    const c = wornColours(look);
    tint(['M_Hoodie'], c.hoodie); tint(['M_Hoodie_Rib'], c.rib, 0.9); tint(['M_Pants'], c.pants); tint(['M_Pants_Pocket'], c.pants, 0.85); tint(['M_Shoe'], c.shoes);
    for (const m of mats.M_Visor || []) {
      if (look.visor === 'red') { m.color.set('#ff2a20'); m.emissive?.set('#ff2a20'); } else { if (visorBase) m.color.copy(visorBase); if (visorGlow) m.emissive?.copy(visorGlow); }
    }
    opts.onLook?.(look);
  }
  function setLook(patch) {
    look = sanitizeLook({ ...look, ...patch, fit: { ...look.fit, ...patch.fit }, colours: { ...look.colours, ...patch.colours } }, { unlocked: unlocked(), mosaic: mosaicUnlocked });
    dress();
  }
  function nextHead() {
    const order = ORDER.filter(h => h !== 'mosaic' || mosaicUnlocked);
    setLook({ head: order[(order.indexOf(look.head) + 1) % order.length], hood: null });
  }

  // The TV and emoji faces are canvases drawn a few times a second.
  const faces = {};
  for (const [key, mat] of [['tv', 'M_TV_Screen'], ['emoji', 'M_Emoji_Screen']]) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    faces[key] = { g: c.getContext('2d'), t, last: -1 };
    (mats[mat] || []).forEach(m => { m.emissiveMap = t; m.emissive.set(0xffffff); m.emissiveIntensity = 1.4; m.color.set(0x000000); });
  }
  function drawFace(now) {
    const f = faces[look.head];
    if (!f) return;
    const frame = Math.floor(now / 120);
    if (frame === f.last) return;
    f.last = frame;
    const g = f.g, blink = (now % 4200) < 140, beat = Math.floor(now / 2600) % 4;
    if (look.head === 'tv') {
      g.fillStyle = '#041714'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#3ee6c4';
      const eh = blink ? 4 : 34;
      g.fillRect(70, 96 - eh / 2, 26, eh); g.fillRect(160, 96 - eh / 2, 26, eh);
      if (beat === 2) g.fillRect(84, 168, 88, 12); else { g.fillRect(74, 156, 16, 12); g.fillRect(90, 168, 76, 12); g.fillRect(166, 156, 16, 12); }
      g.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 256, 2);
    } else {
      g.fillStyle = '#0d1117'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#ffd34d'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath();
      if (beat === 1) { g.moveTo(70, 104); g.lineTo(108, 104); } else { g.moveTo(70, 112); g.quadraticCurveTo(89, 84, 108, 112); }
      if (blink) { g.moveTo(148, 104); g.lineTo(186, 104); } else { g.moveTo(148, 112); g.quadraticCurveTo(167, 84, 186, 112); }
      g.moveTo(80, 160); g.quadraticCurveTo(128, beat === 3 ? 176 : 206, 176, 160); g.stroke();
    }
    f.t.needsUpdate = true;
  }

  // Moves: a blended locomotion layer plus one-shots on top.
  const mixer = new THREE.AnimationMixer(root);
  const acts = {};
  const clips = [...gltf.animations.filter(c => c.name !== 'SitPoses'), ...sitClips(gltf.animations, opts.sitposes)];
  for (const c of clips) { acts[c.name] = mixer.clipAction(c); acts[c.name].play(); acts[c.name].setEffectiveWeight(0); }
  for (const n of ONCE) if (acts[n]) { acts[n].setLoop(THREE.LoopOnce, 1); acts[n].clampWhenFinished = true; }
  for (const n of Object.keys(acts)) if (/^Sit_\w+_(Enter|Exit)$/.test(n)) { acts[n].setLoop(THREE.LoopOnce, 1); acts[n].clampWhenFinished = true; }
  for (const [n] of [...LOCO, ...CROUCH]) if (STRIDE[n] && acts[n]) acts[n].timeScale = 0;
  const weight = new Map(Object.values(acts).map(a => [a, 0]));
  let phase = 0, layer = 1, oneShot = null, oneShotEnd = 0, crouchK = 0;
  function playOnce(name, hold = false) {
    const a = acts[name];
    if (!a) return;
    a.reset().play();
    oneShot = a;
    oneShotEnd = hold ? Infinity : performance.now() + a.getClip().duration * 1000 / a.timeScale - 120;
  }
  function holdPose(name) { const a = acts[name]; if (!a || oneShot === a) return; a.reset().play(); oneShot = a; oneShotEnd = Infinity; }
  function animate(dt, speed, crouching) {
    const now = performance.now();
    if (oneShot && now > oneShotEnd) oneShot = null;
    layer += ((oneShot ? 0 : 1) - layer) * Math.min(1, dt * 9);
    crouchK += ((crouching ? 1 : 0) - crouchK) * Math.min(1, dt * 8);
    phase += dt * strideRate(speed);
    const stand = blendWeights(LOCO, speed), low = blendWeights(CROUCH, Math.min(speed, 1.2));
    const target = new Map();
    for (const [n, w] of stand) target.set(acts[n], w * layer * (1 - crouchK));
    for (const [n, w] of low) target.set(acts[n], w * layer * crouchK);
    if (oneShot) target.set(oneShot, (target.get(oneShot) || 0) + (1 - layer));
    for (const [a, w] of weight) {
      const goal = target.get(a) || 0;
      const v = a === oneShot ? Math.max(goal, 1 - layer) : w + (goal - w) * Math.min(1, dt * 12);
      weight.set(a, v);
      a.setEffectiveWeight(v);
      if (STRIDE[a.getClip().name]) a.time = (phase % 1) * a.getClip().duration;
    }
    mixer.update(dt);
    // The head is scaled after the animation poses it, every frame.
    if (bones.Head && headRest) bones.Head.scale.copy(headRest).multiplyScalar(HEAD_SIZE);
  }

  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ map: radialShadow(), transparent: true, depthWrite: false, opacity: 0.75 }));
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  scene.add(blob);
  function placeBlob(groundAt) {
    blob.position.set(root.position.x, groundAt(root.position.x, root.position.z, root.position.y + 0.05) + 0.012, root.position.z);
    blob.scale.setScalar(1 - Math.min(0.5, (root.position.y - blob.position.y) * 0.6));
  }

  const headPos = new THREE.Vector3();
  function headNow() { bones.Head.getWorldPosition(headPos); return headPos.clone().add(new THREE.Vector3(0, 0.12 * HEIGHT * HEAD_SIZE, 0)); }
  const headRest = bones.Head?.scale.clone();

  // My head turns toward things I pass, and wanders a little when I stand still.
  const lookQ = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), qParent = new THREE.Quaternion(), qWorld = new THREE.Quaternion();
  let lookYaw = 0, lookPitch = 0;
  function lookAround(dt, idle, facing, active, looks) {
    const h = bones.Head;
    if (!h || !active) { lookYaw *= 0.9; lookPitch *= 0.9; }
    else {
      const eye = headNow();
      let want = null, bestD = 3.2;
      for (const p of looks) {
        const d = p.clone().sub(eye), dl = d.length();
        const rel = Math.atan2(Math.sin(Math.atan2(d.x, d.z) - facing), Math.cos(Math.atan2(d.x, d.z) - facing));
        if (dl < bestD && Math.abs(rel) < 1.6) { bestD = dl; want = [rel, Math.atan2(d.y, Math.hypot(d.x, d.z))]; }
      }
      if (!want && idle > 4) want = [Math.sin(performance.now() / 2300) * 0.6, 0.05];
      const [ty, tp] = want || [0, 0];
      lookYaw += (THREE.MathUtils.clamp(ty, -1, 1) - lookYaw) * Math.min(1, dt * 3);
      lookPitch += (THREE.MathUtils.clamp(tp, -0.4, 0.35) - lookPitch) * Math.min(1, dt * 3);
    }
    if (!h || (Math.abs(lookYaw) < 1e-3 && Math.abs(lookPitch) < 1e-3)) return;
    // Add the turn in world space on top of the animated pose, then convert back to the bone's own space.
    h.parent.getWorldQuaternion(qParent);
    h.getWorldQuaternion(qWorld);
    const right = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
    lookQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), lookYaw * 0.75).multiply(qTmp.setFromAxisAngle(right, -lookPitch * 0.7));
    h.quaternion.copy(qParent.invert().multiply(lookQ.multiply(qWorld)));
  }

  // The mosaic over the toy head is a post effect, so it only shows where post effects run.
  function tickMosaic(now, camera, u) {
    if (look.head !== 'mosaic' || !root.visible) { u.radius.value = 0; return; }
    const h = headNow().add(new THREE.Vector3(0, 0.04, 0)), dd = camera.position.distanceTo(h);
    h.project(camera);
    u.centre.value.set(h.x * 0.5 + 0.5, h.y * 0.5 + 0.5);
    // A head of radius r at distance dd covers r / (dd tan(fov/2)) of the half screen height; UVs span the full height.
    u.radius.value = 0.5 * 0.2 * HEIGHT * HEAD_SIZE / dd / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    u.aspect.value = camera.aspect;
    u.cells.value = Math.max(30, Math.min(110, 26 * dd));
    u.drift.value.set(Math.sin(now / 900) * 0.5, Math.cos(now / 1300) * 0.5);
  }

  dress();
  return {
    root, bones, acts, headNow, nextHead, dress, playOnce, holdPose, animate, placeBlob, lookAround, tickMosaic, drawFace,
    endOneShot() { oneShot = null; },
    get oneShot() { return oneShot; },
    get crouchK() { return crouchK; },
    get head() { return look.head; },
    get look() { return structuredClone(look); },
    get hoodUp() { return hoodUp(look); },
    setLook, toggleHood() { setLook({ hood: !hoodUp(look) }); },
    get mosaicUnlocked() { return mosaicUnlocked; },
    unlockMosaic() { mosaicUnlocked = true; },
    get weights() { return Object.fromEntries([...weight].filter(([, w]) => w > 0.01).map(([a, w]) => [a.getClip().name, +w.toFixed(2)])); },
    // Meshes of the current head that would actually draw (every ancestor visible).
    get headMeshesShown() { let n = 0; for (const name of HEADS[look.head]) (parts[name] || []).forEach(o => o.traverse(c => { if (!c.isMesh) return; let v = true; for (let x = c; x; x = x.parent) v = v && x.visible; if (v) n++; })); return n; },
  };
}
