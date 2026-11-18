import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { lit } from './lit.js';
import { makeHand, makeHandMaterials } from './hands.js';
import { spring, springStep, kick, critical, smoother, approach } from '../pure/springs.js';
import { blend, qFrame, relaxed } from '../pure/hands.js';
import { LOW, ELBOWS } from '../pure/handling.js';
import { HOLDS } from './holds.js';
import { CLIPS, sample, cues, owed } from '../pure/clips.js';
import { RIGS } from '../pure/rigs.js';
import { newSwing, swing } from '../pure/swing.js';

// Its own scene, its camera at the eye, drawn on a fresh depth so it never pokes through the bench or a wall.
const FOV = 50;
// A push that carries a spring `peak` away before it comes back.
const punch = (s, peak) => kick(s, peak * Math.sqrt(s.k) * Math.E);
const REST = { gun: [0, 0, 0, 0, 0, 0], right: { a: 'grip', b: 'grip', k: 0 }, left: { a: 'grip', b: 'grip', k: 0 }, mag: [0, 0], slide: null, bolt: [0, 0], cover: 0, belt: null };
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.colorSpace = THREE.SRGBColorSpace; WHITE.needsUpdate = true;
// How far the eye sits behind a scope's eyepiece when aimed (a holo sight keeps the eye where the iron sights had it).
const RELIEF = 0.075;

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.18, 'rgba(255,236,170,0.95)'); grad.addColorStop(0.45, 'rgba(255,150,50,0.4)'); grad.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  g.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    g.rotate(Math.PI * 2 / 7 + (i % 2) * 0.3);
    const spike = g.createLinearGradient(0, 0, 62, 0);
    spike.addColorStop(0, 'rgba(255,240,200,0.9)'); spike.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = spike;
    g.beginPath(); g.moveTo(0, -5); g.lineTo(60 - (i % 3) * 12, 0); g.lineTo(0, 5); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function makeGun({ env, id = 'pistol', file, onCue }) {
  const spec = RIGS[id];
  if (!spec) throw new Error('no such gun: ' + id);
  // The hip in the eye's space (x right, y up, -z ahead), the way the magazine comes out, the grip's middle a clip turns about.
  const HIP = spec.hip, WELL = new THREE.Vector3(...spec.well), PIVOT = new THREE.Vector3(...spec.pivot), LOCK = spec.lock ?? 1;
  // The gun file is packed with meshopt (blender/squeeze.js).
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(file || spec.file);
  const model = gltf.scene;
  const scene = new THREE.Scene();
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 8);
  scene.add(camera);
  const rig = new THREE.Group(), turn = new THREE.Group();
  camera.add(rig); rig.add(turn); turn.add(model);
  turn.rotation.y = Math.PI / 2;
  // Light from the panels behind and above the firing line, and the sky of the room.
  const sky = new THREE.HemisphereLight(0xd8e6ff, 0x16181e, 0.75), key = new THREE.DirectionalLight(0xfff0dc, 2.4), rim = new THREE.DirectionalLight(0xbfd8ff, 0.9);
  scene.add(sky, key, key.target, rim, rim.target);

  const mats = {};
  model.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = o.material;
    (mats[m.name] ||= new Set()).add(m);
    if (!m.transparent) lit(m);
  });
  const pre = spec.prefix + '_', P = name => model.getObjectByName(pre + name);
  const part = Object.fromEntries(Object.entries(spec.parts).map(([k, n]) => [k, P(n)]));
  for (const [k, o] of Object.entries(part)) if (!o) throw new Error('the gun file has no ' + k);
  const home = Object.fromEntries(Object.entries(part).map(([k, o]) => [k, o.position.clone()]));
  const homeQ = Object.fromEntries(Object.entries(part).map(([k, o]) => [k, o.quaternion.clone()]));
  const anchor = { muzzle: P('muzzle'), eject: P('eject'), iron: P('aim_iron') }, bareMuzzle = anchor.muzzle;
  // Where the long guns' attachments sit (from the kit file, fittings.js); the pistol carries its own.
  const mounts = {};
  model.traverse(o => { if (o.name.startsWith(pre + 'mount_')) mounts[o.name.slice(pre.length + 6)] = o; });
  // Mounts the file does not carry (the P-22's muzzle and rail), from rigs.js, in the gun's space.
  for (const [slot, at] of Object.entries(spec.kit?.mounts || {})) if (!mounts[slot]) { const m = new THREE.Object3D(); m.name = pre + 'mount_' + slot; m.position.set(...at); (model.getObjectByName(spec.prefix) || model).add(m); mounts[slot] = m; }
  const fits = {};
  // By exact name: the meshes inside a piece carry its name with a number after it and must stay shown.
  for (const a of ['light', 'suppressor', 'holo', 'scope', 'mag']) { const o = P('att_' + a); if (o) { fits[a] = o; o.visible = false; } }
  if (P('round_ext')) P('round_ext').visible = false;
  // The finishes paint these; each starts with a plain white picture so a camo later swaps a picture and builds no shader.
  const PAINTED = ['G_Nitride', 'G_Polymer', 'G_Slate', 'G_Olive', 'G_Sand', 'G_Ember'], factory = new Map();
  for (const name of PAINTED) for (const m of mats[name] || []) { factory.set(m, { color: m.color.clone(), rough: m.roughness, metal: m.metalness }); m.map = WHITE; m.needsUpdate = true; }
  // The charm hangs from here, on the gun's left side.
  const hook = new THREE.Object3D();
  hook.position.set(...(spec.kit?.hook || [0, 0, 0]));
  (model.getObjectByName(spec.prefix) || model).add(hook);
  part.casing.visible = false;
  // The magazine that falls out is a second one; the one in the gun is the fresh one coming in.
  const spent = part.mag.clone(true);
  // The magazine's look (not its rounds) and the longer one put in its place, in the gun and in the one that drops.
  const kit = { light: null, optic: null, mag: false }, pieces = {}, longs = new Map();
  const ownLook = (holder, extra) => holder.children.filter(c => c !== extra && !c.name.startsWith(pre + 'round') && !c.name.startsWith(pre + 'belt'));
  function setMag(src) {
    for (const holder of [part.mag, spent]) {
      let extra = longs.get(holder) || null;
      if (src && extra?.userData.from !== src) {
        if (extra) holder.remove(extra);
        extra = new THREE.Group();
        extra.userData.from = src;
        // In the gun's own paint, so a finish covers the long magazine as it does the short one.
        for (const c of src.children) if (!c.name.includes('round')) { const m = c.clone(true); m.traverse(x => { x.frustumCulled = false; x.visible = true; const own = x.isMesh && mats[x.material.name]; if (own) x.material = own.values().next().value; }); extra.add(m); }
        holder.add(extra); longs.set(holder, extra);
      }
      for (const c of ownLook(holder, extra)) c.visible = !src;
      if (extra) extra.visible = !!src;
    }
    kit.mag = !!src;
  }
  let charm = null, swingSt = null, swungIn = null;
  const sw = { v: new THREE.Vector3(), q: new THREE.Quaternion(), d: new THREE.Vector3() }, DOWN = new THREE.Vector3(0, -1, 0);
  spent.traverse(o => { if (o.name.startsWith(pre + 'round') || o.name.startsWith(pre + 'belt')) o.visible = false; });
  spent.visible = false;
  part.mag.parent.add(spent);

  // The hands: built here, posed from the gun's description, in the gun's own space.
  const hm = makeHandMaterials(m => lit(m));
  for (const m of Object.values(hm)) (mats[m.name] ||= new Set()).add(m);
  const hands = { right: makeHand('right', hm), left: makeHand('left', hm) };
  turn.add(hands.right.root, hands.left.root);
  // The hands' poses on this gun, solved ahead of time (blender/holds.js).
  const holds = HOLDS[id];
  if (!holds) throw new Error('no hands are fitted to ' + id + ': run node blender/holds.js');
  const lowQ = qFrame(LOW.fingers, LOW.back), lowDigits = relaxed();
  let clips = null, clipsFor = null;
  const clipsOf = s => { if (clipsFor !== s) { clipsFor = s; clips = CLIPS[id](s); } return clips; };

  // Aimed: the rear sight's notch sits on the eye's line, `sight` metres ahead.
  const notch = anchor.iron.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const IRONS = { p: [-notch.x, -notch.y, -spec.sight - notch.z], r: [0, 0, 0] };
  let ADS = IRONS;
  // With an optic the cheek stays put and the eye rises to its line; a scope also brings its eyepiece close to the eye.
  function aimThrough(node, scope) {
    if (!node) { ADS = IRONS; return; }
    model.updateWorldMatrix(true, true);
    const a = model.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
    ADS = { p: [-a.z, -a.y, scope ? a.x - RELIEF : anchor.iron.position.x - spec.sight], r: [0, 0, 0] };
  }

  // The flash at the muzzle: a burst facing the eye and two long tongues along the barrel, and its light on the gun.
  const flashTex = flashTexture();
  const flashMat = () => new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, color: new THREE.Color(2.1, 1.75, 1.2), fog: false });
  const flash = new THREE.Group();
  const burst = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), flashMat());
  burst.rotation.y = Math.PI / 2;
  const tongues = [0, Math.PI / 2].map(a => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.05), flashMat()); m.position.x = 0.06; m.rotation.x = a; return m; });
  flash.add(burst, ...tongues);
  flash.visible = false; flash.renderOrder = 5;
  const glare = new THREE.PointLight(0xffc27a, 0, 2.5, 2);
  // The flash and its light sit where the shot leaves: the muzzle, or a suppressor's end.
  function placeFlash(at) {
    anchor.muzzle = at;
    at.parent.add(flash, glare);
    flash.position.copy(at.position);
    glare.position.copy(at.position).add(new THREE.Vector3(0.05, 0.02, 0));
  }
  placeFlash(bareMuzzle);

  // What moves by springs: the recoil (back, muzzle up, a twist), the lag behind the look, a bump when a magazine goes home.
  const soft = k => spring(k, critical(k) * 0.7);
  const sp = { back: soft(300), up: soft(240), side: soft(200), roll: soft(170), lagX: spring(90, critical(90)), lagY: spring(90, critical(90)), bump: soft(260) };
  const st = { aim: 0, raised: 0, slide: 0, shotT: 9, lock: false, freeT: 9, freeFrom: 0, trig: 0, flashT: 9, flashK: 1, bob: 0, t: 0, lights: 1,
    drawT: 9, inspT: -1, outK: 0, outFrom: null, clip: null, clipT: 0, held: null, beltT: 9 };
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4();
  const toGun = new THREE.Matrix4(), toGunQ = new THREE.Quaternion();
  const eyeToGun = (p, out) => out.set(p[0], p[1], p[2]).applyMatrix4(toGun);
  const arr = o => [o.x, o.y, o.z];

  // The clip the hands are in now, and its time: a reload, the look over, the draw, or none.
  function current(w, s) {
    const C = clipsOf(s);
    if (w.phase === 'reload') return [w.empty ? C.reloadEmpty : C.reload, w.t];
    if (w.phase === 'bolt' && C.cycle) return [C.cycle, w.t];
    if (st.inspT >= 0) return [C.inspect, st.inspT];
    if (st.drawT < C.draw.T) return [C.draw, st.drawT];
    return [null, 0];
  }

  // A pose that rides a part (a hand on the magazine, the slide, a charging handle) moves and turns with it.
  const XAXIS = new THREE.Vector3(1, 0, 0), ZAXIS = new THREE.Vector3(0, 0, 1), D = new THREE.Matrix4(), rv = new THREE.Vector3(), rq = new THREE.Quaternion(), rq2 = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
  function ride(p, key) {
    const o = part[key];
    o.updateMatrix();
    D.compose(home[key], homeQ[key], ONE).invert().premultiply(o.matrix);
    rv.set(...p.at).applyMatrix4(D);
    rq.setFromRotationMatrix(D).multiply(rq2.set(...p.q));
    return { ...p, at: arr(rv), q: [rq.x, rq.y, rq.z, rq.w] };
  }
  // A named pose this frame in the gun's space; 'low' is held in the eye's space.
  function named(side, name) {
    if (side === 'right' && name === 'grip') return blend(holds.right.grip, holds.right.pull, st.trig);
    if (side === 'left' && name === 'low') {
      eyeToGun(LOW.at, v2);
      q.copy(toGunQ).multiply(q2.set(...lowQ));
      return { at: arr(v2), q: [q.x, q.y, q.z, q.w], digits: lowDigits };
    }
    // A longer magazine is held by its own foot where the hands were fitted to one (the P-22's).
    const set = holds[side], own = name === 'mag' && kit.mag && set.magX ? 'magX' : name, on = spec.rides[side]?.[name], p = set[own] || set.grip;
    return on && set[own] ? ride(p, on) : p;
  }
  const pick = (side, tr) => blend(named(side, tr.a), named(side, tr.b), tr.k);

  const api = {
    id, spec, scene, camera, model, part, anchor, mounts, mats, hands,
    get aim() { return st.aim; },
    // The gun is being looked over, or is on its way back from it.
    get inspecting() { return st.inspT >= 0 || st.outK > 0; },
    // Raises the gun from below (stepping up to the line, or a fresh run).
    draw() {
      st.raised = 0; st.slide = 0; st.lock = false; st.shotT = st.freeT = 9; st.drawT = 0; st.inspT = -1; st.outK = 0; st.clip = null; st.held = null;
      for (const s of Object.values(sp)) { s.x = 0; s.v = 0; }
    },
    // The look over the gun: only from a loaded gun at rest in the hand.
    inspect(w, s) {
      if (st.inspT >= 0 || st.outK > 0 || w.phase !== 'ready' || w.ammo === 0 || st.aim > 0.05 || st.drawT < clipsOf(s).draw.T) return false;
      st.inspT = 0;
      return true;
    },
    // The attachments on: pieces from the kit file (fittings.js) on the gun's mounts, or the P-22's own (rigs.js kit.own).
    // Returns false if a piece it needs is not in hand (no kit file given), leaving that slot bare.
    setAttachments(list, kitFile = null) {
      const on = a => list.includes(a), K = spec.kit || {}, own = a => ((K.own || []).includes(a) ? fits[a] : null);
      const NAME = { light: K.light || 'KIT_light', suppressor: `KIT_sup_${id}`, holo: 'KIT_holo', scope: K.scope || 'KIT_scope' };
      const MOUNT = { light: 'rail', suppressor: 'muzzle', holo: 'optic', scope: 'optic' };
      let whole = true;
      const show = (name, mount, want) => {
        if (!mount || (!want && !pieces[name])) return null;
        if (!pieces[name]) {
          const src = kitFile?.getObjectByName(name);
          if (!src) { whole = false; return null; }
          const o = src.clone(true);
          o.userData.base = o.position.clone();
          o.traverse(c => { c.frustumCulled = false; });
          mount.add(o);
          pieces[name] = o;
        }
        pieces[name].visible = want;
        return want ? pieces[name] : null;
      };
      // On the Gatekeeper the optic stands on a riser and rides the feed cover as it opens.
      if (K.riser) show('KIT_riser', mounts.optic, on('holo') || on('scope'));
      const piece = {};
      for (const a of ['light', 'suppressor', 'holo', 'scope']) {
        if (own(a)) { own(a).visible = on(a); piece[a] = on(a) ? own(a) : null; continue; }
        const o = piece[a] = show(NAME[a], mounts[MOUNT[a]], on(a));
        if (o && K.riser && MOUNT[a] === 'optic' && o.parent === mounts.optic) o.position.copy(o.userData.base).y += K.riser;
      }
      if (K.optic) for (const n of ['KIT_riser', NAME.holo, NAME.scope]) if (pieces[n] && pieces[n].parent !== part[K.optic]) part[K.optic].attach(pieces[n]);
      // A rear sight that folds away under an optic.
      if (K.rear && P(K.rear)) P(K.rear).visible = !(on('holo') || on('scope'));
      const mark = (a, ownName, suffix) => (!piece[a] ? null : own(a) ? P(ownName) : piece[a].getObjectByName(NAME[a] + suffix));
      const light = mark('light', 'light_at', '_lens'), sup = mark('suppressor', 'muzzle_sup', '_end');
      const optic = piece.scope ? mark('scope', 'aim_scope', '_aim') : piece.holo ? mark('holo', 'aim_holo', '_aim') : null;
      // The longer magazine: the P-22's own, or the kit's, put inside the gun's magazine (and the one that drops) in place of its look.
      const longMag = on('mag') ? (own('mag') || kitFile?.getObjectByName(`KIT_mag_${id}`) || longs.get(part.mag)?.userData.from || null) : null;
      if (on('mag') && !longMag) whole = false;
      setMag(longMag);
      kit.light = light || null; kit.optic = optic ? (on('scope') ? 'scope' : 'holo') : null;
      aimThrough(optic, kit.optic === 'scope');
      placeFlash(sup || bareMuzzle);
      return whole;
    },
    // The finish: { map, tint, rough, metal } (camos.js), or null for the gun's own.
    setCamo(c) {
      for (const [m, f] of factory) {
        m.map = c ? c.map : WHITE;
        m.color.copy(c ? c.tint : f.color); m.roughness = c ? c.rough : f.rough; m.metalness = c ? c.metal : f.metal;
      }
    },
    // A charm (charms.js: { root, len }) on its chain from the hook, or null for none; it swings with the gun.
    setCharm(c) {
      if (charm) { hook.remove(charm.root); charm.root.traverse(o => o.geometry?.dispose()); }
      charm = c || null;
      swingSt = null;
      if (charm) hook.add(charm.root);
    },
    // The charm's swing, from where its hook has gone since the last call (the gun in the hand, or on the bench).
    swingCharm(dt) {
      if (!charm) return;
      // Carried into another scene (onto the bench, back to the hand) the hook jumps: the charm starts there hanging still.
      let top = hook; while (top.parent) top = top.parent;
      if (top !== swungIn) { swungIn = top; swingSt = null; }
      hook.updateWorldMatrix(true, false);
      const at = hook.getWorldPosition(sw.v).toArray();
      swingSt ||= newSwing(at, charm.len);
      const d = swing(swingSt, at, dt);
      // The chain's way down, in the hook's own turn.
      hook.getWorldQuaternion(sw.q).invert();
      sw.d.set(d[0], d[1], d[2]).applyQuaternion(sw.q);
      charm.root.quaternion.setFromUnitVectors(DOWN, sw.d);
    },
    // What is fitted that the range acts on: the light's lens, the optic, the extended magazine.
    get lens() { return kit.light; },
    get optic() { return kit.optic; },
    get hook() { return hook; },
    get charm() { return charm?.id || 'none'; },
    // Looking through a scope, 0 to 1: the scope's own picture takes over as the gun comes all the way up.
    get scoped() { return kit.optic === 'scope' ? smoother((st.aim - 0.72) / 0.24) : 0; },
    // The hall's lights going down dims the gun's own light too.
    setLights(k) { st.lights = k; },
    // The sleeves in the colours he is wearing.
    setLook(colours) { for (const [name, hex] of Object.entries(colours)) for (const m of mats[name] || []) m.color.set(hex); },
    // What the gun did: a shot kicks it and cycles the slide; the last round leaves the slide locked back.
    event(ev) {
      if (ev.type === 'shot') {
        // A shot ends a look over at once: the kick hides the snap back.
        if (st.inspT >= 0 || st.outK > 0) { st.inspT = -1; st.outK = 0; st.held = null; }
        const steady = 1 - 0.45 * st.aim;
        punch(sp.back, ev.back * steady); punch(sp.up, THREE.MathUtils.degToRad(ev.up * 2.6) * steady);
        punch(sp.side, THREE.MathUtils.degToRad(ev.side * 2.2)); punch(sp.roll, (Math.random() - 0.5) * 0.1);
        st.shotT = 0; st.lock = !!ev.last && !!spec.lock; st.freeT = 9; st.beltT = 0;
        st.flashT = 0; st.flashK = ev.flash;
        // Down the sights the flash is kept small, so it never hides what was shot at.
        const big = (0.35 + 0.65 * ev.flash) * (1 - 0.5 * st.aim);
        burst.rotation.x = Math.random() * 6.28; burst.scale.setScalar((0.75 + Math.random() * 0.5) * big);
        for (const m of tongues) { m.scale.set((0.7 + Math.random() * 0.6) * big, 0.8 + Math.random() * 0.4, 1); m.rotation.x += Math.random() * 3; }
      } else if (ev.type === 'mag_in') {
        punch(sp.bump, 0.012);
      } else if (ev.type === 'rack') {
        st.freeT = 0; st.freeFrom = st.slide; st.lock = false;
        punch(sp.back, -0.006); punch(sp.up, -0.02);
      } else if (ev.type === 'dry') {
        punch(sp.up, -0.006);
      }
    },
    // dt, the eye's camera, the weapon's state and numbers, what the hands are doing:
    // { aim 0 or 1, fire, turn [yaw, pitch] moved this frame, strafe m/s, crouch 0..1 }.
    update(dt, eye, w, s, input) {
      st.t += dt;
      camera.position.copy(eye.position); camera.quaternion.copy(eye.quaternion);
      camera.aspect = eye.aspect; camera.fov = FOV - 6 * st.aim; camera.updateProjectionMatrix();
      key.position.copy(eye.position).add(v.set(0.5, 3, -2)); key.target.position.copy(eye.position);
      rim.position.copy(eye.position).add(v.set(-1.5, 1.2, 4)); rim.target.position.copy(eye.position);
      const L = 0.03 + 0.97 * st.lights;
      sky.intensity = 0.75 * L; key.intensity = 2.4 * L; rim.intensity = 0.9 * L;

      // The look over ends by itself, or eases back when the aim, a reload or the gun's state takes over.
      if (st.inspT >= 0) {
        st.inspT += dt;
        const C = clipsOf(s);
        if (st.inspT >= C.inspect.T) st.inspT = -1;
        else if (input.aim || w.phase !== 'ready') {
          st.outFrom = { ...sample(C.inspect, st.inspT), slide: null }; st.outK = 1; st.inspT = -1;
          if (st.clip === C.inspect) for (const name of owed(C.inspect, st.clipT)) onCue?.(name, id);
        }
      }
      if (st.outK > 0) st.outK = Math.max(0, st.outK - dt / 0.18);
      st.drawT += dt;

      // Coming up to the aim takes the gun's own time; a reload or a look over brings it back down.
      const busy = w.phase === 'reload' || st.inspT >= 0;
      st.aim = Math.min(1, Math.max(0, st.aim + (input.aim && !busy ? 1 : -1) * dt / Math.max(0.05, s.ads)));
      st.raised = Math.min(1, st.raised + dt / Math.max(0.1, s.draw));
      const a = smoother(st.aim), up = smoother(st.raised);

      // The clip, its cues, and what it says this frame; coming out of a look over, eased from where it was.
      const [clip, ct] = current(w, s), cut = clip !== st.clip;
      if (cut) { st.clip = clip; st.clipT = -1; }
      if (clip) { for (const name of cues(clip, st.clipT, ct)) onCue?.(name, id); st.clipT = ct; }
      const now = clip ? sample(clip, ct) : REST, back = st.outK > 0 && st.outFrom ? smoother(st.outK) : 0, was = st.outFrom;
      const G = back ? now.gun.map((x, i) => x + (was.gun[i] - x) * back) : now.gun;

      // The slide: kicked back by a shot, locked back when empty until let go, or held back by a hand.
      st.shotT += dt; st.freeT += dt;
      // A look into the chamber cut short never reaches its own cue for the action going home.
      if (st.held !== null && now.slide === null) { st.freeT = 0; st.freeFrom = st.held; st.lock = false; if (cut) onCue?.(spec.homeCue, id); }
      st.held = now.slide;
      const [tBack, tHome] = spec.cycleT || [0.028, 0.05], pulled = now.slide !== null || st.freeT < 0.05;
      let slide = 0;
      if (st.freeT < 0.05) slide = st.freeFrom * (1 - st.freeT / 0.05);
      else if (!spec.cycle) slide = 0;
      else if (st.shotT < tBack) slide = st.shotT / tBack;
      else if (st.lock) slide = Math.max(LOCK, 1 - (st.shotT - tBack) / 0.5);
      else slide = Math.max(0, 1 - (st.shotT - tBack) / tHome);
      // A hand on a pistol's slide moves it; a hand on a charging handle only pushes the bolt back further.
      if (now.slide !== null) slide = spec.action === 'slide' ? now.slide : Math.max(now.slide, slide);
      st.slide = slide;
      if (spec.cycle) part[spec.cycle].position.copy(home[spec.cycle]).x -= spec.travel * slide;
      // A charging handle stays forward while the bolt works, and goes back only in a hand (and home with the bolt).
      if (part.handle) part.handle.position.copy(home.handle).x -= spec.handleTravel * (now.slide !== null ? now.slide : pulled ? slide : 0);
      // A bolt worked by hand turns up about the bore and slides back; coming out of a look over it eases home.
      if (spec.action === 'turn') {
        const [lift, drawn] = back ? now.bolt.map((x, i) => x + (was.bolt[i] - x) * back) : now.bolt;
        part.bolt.position.copy(home.bolt).x -= spec.travel * drawn;
        part.bolt.quaternion.copy(homeQ.bolt).multiply(rq.setFromAxisAngle(XAXIS, -spec.lift * lift));
      }
      // The cover swings up on its front hinge; the belt draws up a link a shot, its links alike so the jump back is unseen.
      if (part.cover) part.cover.quaternion.copy(homeQ.cover).multiply(rq.setFromAxisAngle(ZAXIS, -spec.coverOpen * (back ? now.cover + (was.cover - now.cover) * back : now.cover)));
      if (part.belt) {
        st.beltT += dt;
        part.belt.visible = now.belt ?? w.ammo > 0;
        part.belt.position.copy(home.belt).y += st.beltT < s.interval ? spec.beltPitch * st.beltT / s.interval : 0;
      }
      if (spec.action === 'slide') {
        const drop = 0.021 * smoother((slide - 0.1) / 0.4), px = 0.15, py = 0.0155;
        part.barrel.rotation.z = drop;
        part.barrel.position.set(home.barrel.x + px - (px * Math.cos(drop) - py * Math.sin(drop)) - 0.003 * Math.min(1, slide * 4), home.barrel.y + py - (px * Math.sin(drop) + py * Math.cos(drop)), home.barrel.z);
        part.stop.rotation.z = st.lock && slide >= LOCK - 0.01 ? -0.12 : 0;
      }
      st.trig = approach(st.trig, input.fire && !clip ? 1 : 0, 40, dt);
      part.trigger.rotation.z = -0.24 * st.trig;
      part.round.visible = w.ammo > 0 || (w.phase === 'reload' && w.t > s.reload.out);

      // The flash lasts a twentieth of a second.
      st.flashT += dt;
      flash.visible = st.flashT < 0.032;
      glare.intensity = st.flashT < 0.09 ? 9 * st.flashK * (1 - st.flashT / 0.09) : 0;

      // The lag behind the look, the sway of standing, the bob of stepping along the line.
      const [dyaw, dpitch] = input.turn || [0, 0];
      sp.lagX.x = THREE.MathUtils.clamp(sp.lagX.x - dyaw * 0.55, -0.07, 0.07); sp.lagY.x = THREE.MathUtils.clamp(sp.lagY.x - dpitch * 0.55, -0.06, 0.06);
      for (const k of Object.keys(sp)) springStep(sp[k], 0, dt);
      const calm = 1 - 0.7 * a, strafe = input.strafe || 0;
      st.bob += Math.abs(strafe) * dt * 7;
      const bx = Math.cos(st.bob) * 0.005 * Math.min(1, Math.abs(strafe)), by = Math.sin(st.bob * 2) * 0.004 * Math.min(1, Math.abs(strafe));
      const breath = Math.sin(st.t * 1.25) * 0.0016 * calm, drift = Math.sin(st.t * 0.83 + 1.3) * 0.0012 * calm;

      rig.position.set(
        HIP.p[0] + (ADS.p[0] - HIP.p[0]) * a + drift + bx * calm + sp.lagX.x * 0.35 + G[0],
        HIP.p[1] + (ADS.p[1] - HIP.p[1]) * a + breath + by * calm - 0.26 * (1 - up) - 0.03 * (input.crouch || 0) * (1 - a) + sp.bump.x + sp.lagY.x * 0.3 + G[1],
        HIP.p[2] + (ADS.p[2] - HIP.p[2]) * a + sp.back.x + G[2]);
      e.set(HIP.r[0] * (1 - a) + sp.up.x - 0.95 * (1 - up) + sp.lagY.x, HIP.r[1] * (1 - a) + sp.side.x + sp.lagX.x, HIP.r[2] * (1 - a) + sp.roll.x - strafe * 0.012 * calm, 'YXZ');
      rig.quaternion.setFromEuler(e);
      // The clip's turn, about the middle of the grip.
      if (G[3] || G[4] || G[5]) {
        q.setFromEuler(e.set(G[3], G[4], G[5], 'YXZ'));
        v.copy(PIVOT).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI / 2).applyQuaternion(rig.quaternion);
        rig.position.add(v);
        rig.quaternion.multiply(q);
        rig.position.sub(v.copy(PIVOT).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI / 2).applyQuaternion(rig.quaternion));
      }
      rig.updateMatrix(); turn.updateMatrix();
      toGun.multiplyMatrices(rig.matrix, turn.matrix).invert();
      toGunQ.setFromRotationMatrix(m4.extractRotation(toGun));

      // The magazines: the old one released and dropping, the fresh one on its way up the well from the free hand.
      const R = s.reload, reloading = w.phase === 'reload', fresh = reloading && w.t >= R.out, magOff = v.set(0, 0, 0);
      if (fresh) {
        magOff.copy(WELL).multiplyScalar(now.mag[0]);
        if (now.mag[1] > 0) magOff.addScaledVector(eyeToGun(LOW.at, v2).sub(home.mag).sub(magOff), now.mag[1]);
      }
      part.mag.position.copy(home.mag).add(magOff);
      part.mag.visible = !(fresh && w.t < R.out + 0.1);
      const pressing = reloading && w.t > R.out - 0.08 && w.t < R.out + 0.1;
      if (part.rel) part.rel.position.copy(home.rel).add(v2.set(0, 0, pressing ? 0.0016 : 0));
      if (w.phase === 'reload' && w.t >= R.out) {
        const slid = Math.min(1, (w.t - R.out) / 0.1), fall = Math.max(0, w.t - (R.out + 0.07));
        spent.visible = w.t < R.out + 0.6;
        spent.position.copy(home.mag).addScaledVector(WELL, spec.drop * slid * slid).add(v2.set(-0.25 * fall, -4.9 * fall * fall, 0));
        spent.rotation.z = -3.2 * fall;
      } else spent.visible = false;

      // The hands, from the clip's poses; each forearm hangs from its elbow.
      const elbows = spec.elbows || ELBOWS;
      for (const side of ['right', 'left']) {
        let p = pick(side, now[side]);
        if (back) p = blend(p, pick(side, was[side]), back);
        hands[side].pose(p, arr(eyeToGun(elbows[side], v2)));
      }
      // The charm swings; all the way into a scope, its own picture is all there is to see.
      api.swingCharm(dt);
      rig.visible = api.scoped < 0.98;
    },
    // Where a point on the gun appears to be out in the room: the gun is drawn with its own lens, so the place is
    // carried over by where it falls on the screen and how far off it is.
    inRoom(obj, eye, out) {
      camera.updateMatrixWorld(true);
      obj.getWorldPosition(out);
      const depth = -v.copy(out).applyMatrix4(camera.matrixWorldInverse).z;
      out.project(camera);
      out.z = 0.5;
      out.unproject(eye).sub(eye.position).normalize();
      return out.multiplyScalar(depth / Math.max(0.2, out.dot(eye.getWorldDirection(v)))).add(eye.position);
    },
    // A fresh spent case to throw (the caller owns it from here).
    newCasing() { const c = part.casing.clone(true); c.visible = true; c.traverse(o => { o.frustumCulled = true; }); return c; },
    // The gun's own right and up out in the room, for throwing the case.
    axes(right, upv) { camera.updateMatrixWorld(true); rig.getWorldQuaternion(q); right.set(1, 0, 0).applyQuaternion(q); upv.set(0, 1, 0).applyQuaternion(q); },
  };
  return api;
}
