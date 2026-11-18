import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { lit } from './lit.js';
import { makeHand, makeHandMaterials } from './hands.js';
import { spring, springStep, kick, critical, smoother, approach } from '../pure/springs.js';
import { blend, qFrame, add, relaxed } from '../pure/hands.js';
import { LOW, ELBOWS } from '../pure/handling.js';
import { HOLDS } from './holds.js';
import { CLIPS, sample, cues } from '../pure/clips.js';

// The gun in the hand. It is a scene of its own with its own camera, drawn over everything on a fresh depth, so it
// never pokes through the bench or a wall; its camera sits exactly where the eye is, so the room's light and
// reflections fall on it the right way round. Every part that moves on a real pistol moves: the slide, the barrel's
// tilt, the trigger, the magazine and the round on top of it, the slide stop, the magazine release, and the hands,
// which are posed from the gun's own description (src/pure/handling.js) and move by its clips (src/pure/clips.js).
const FOV = 50, SLIDE = 0.042, LOCK = 0.9;
// Where the gun sits in the eye's space (x right, y up, -z ahead), at the hip and aimed down the sights.
const HIP = { p: [0.085, -0.072, -0.33], r: [0.02, 0.07, -0.04] };
// The magazine slides along the grip's slant: this way is out.
const WELL = new THREE.Vector3(-0.333, -0.943, 0);
// Where a clip turns the gun about: the middle of the grip, in the gun's own space.
const PIVOT = new THREE.Vector3(-0.004, -0.062, 0);
// A push that carries a spring `peak` away before it comes back.
const punch = (s, peak) => kick(s, peak * Math.sqrt(s.k) * Math.E);
const REST = { gun: [0, 0, 0, 0, 0, 0], right: { a: 'grip', b: 'grip', k: 0 }, left: { a: 'grip', b: 'grip', k: 0 }, mag: [0, 0], slide: null };

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

export async function makeGun({ env, id = 'pistol', file = 'assets/range/p22.glb', onCue }) {
  // The gun file is packed with meshopt (blender/squeeze.js).
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(file);
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
  const P = name => model.getObjectByName(name);
  const part = { slide: P('P22_slide'), barrel: P('P22_barrel'), trigger: P('P22_trigger'), stop: P('P22_slidestop'), rel: P('P22_magrelease'), mag: P('P22_mag'), round: P('P22_round'), casing: P('P22_casing') };
  for (const [k, o] of Object.entries(part)) if (!o) throw new Error('the gun file has no ' + k);
  const home = Object.fromEntries(Object.entries(part).map(([k, o]) => [k, o.position.clone()]));
  const anchor = { muzzle: P('P22_muzzle'), eject: P('P22_eject'), iron: P('P22_aim_iron') };
  const fits = {};
  model.traverse(o => { if (o.name.startsWith('P22_att_')) { fits[o.name.slice(8)] = o; o.visible = false; } });
  P('P22_round_ext').visible = false;
  part.casing.visible = false;
  // The magazine that falls out is a second one; the one in the gun is the fresh one coming in.
  const spent = part.mag.clone(true);
  spent.traverse(o => { if (o.name.startsWith('P22_round')) o.visible = false; });
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

  // Aimed: the rear sight's notch sits on the eye's line, 30 cm ahead.
  const notch = anchor.iron.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const ADS = { p: [-notch.x, -notch.y, -0.30 - notch.z], r: [0, 0, 0] };

  // The flash at the muzzle: a burst facing the eye and two long tongues along the barrel, and its light on the gun.
  const flashTex = flashTexture();
  const flashMat = () => new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, color: new THREE.Color(2.1, 1.75, 1.2), fog: false });
  const flash = new THREE.Group();
  const burst = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), flashMat());
  burst.rotation.y = Math.PI / 2;
  const tongues = [0, Math.PI / 2].map(a => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.05), flashMat()); m.position.x = 0.06; m.rotation.x = a; return m; });
  flash.add(burst, ...tongues);
  flash.position.copy(anchor.muzzle.position); flash.visible = false; flash.renderOrder = 5;
  anchor.muzzle.parent.add(flash);
  const glare = new THREE.PointLight(0xffc27a, 0, 2.5, 2);
  glare.position.copy(anchor.muzzle.position).add(new THREE.Vector3(0.05, 0.02, 0));
  anchor.muzzle.parent.add(glare);

  // What moves by springs: the recoil (back, muzzle up, a twist), the lag behind the look, a bump when a magazine goes home.
  const soft = k => spring(k, critical(k) * 0.7);
  const sp = { back: soft(300), up: soft(240), side: soft(200), roll: soft(170), lagX: spring(90, critical(90)), lagY: spring(90, critical(90)), bump: soft(260) };
  const st = { aim: 0, raised: 0, slide: 0, shotT: 9, lock: false, freeT: 9, freeFrom: 0, trig: 0, flashT: 9, flashK: 1, bob: 0, t: 0, lights: 1,
    drawT: 9, inspT: -1, outK: 0, outFrom: null, clip: null, clipT: 0, held: null };
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4();
  const toGun = new THREE.Matrix4(), toGunQ = new THREE.Quaternion();
  const eyeToGun = (p, out) => out.set(p[0], p[1], p[2]).applyMatrix4(toGun);
  const arr = o => [o.x, o.y, o.z];

  // The clip the hands are in now, and its time: a reload, the look over, the draw, or none.
  function current(w, s) {
    const C = clipsOf(s);
    if (w.phase === 'reload') return [w.empty ? C.reloadEmpty : C.reload, w.t];
    if (st.inspT >= 0) return [C.inspect, st.inspT];
    if (st.drawT < C.draw.T) return [C.draw, st.drawT];
    return [null, 0];
  }

  // A named pose this frame, in the gun's space: some ride on the moving magazine or slide, the waiting one is held
  // in the eye's space.
  function named(side, name, magOff, slideX) {
    if (side === 'right') {
      if (name === 'grip') return blend(holds.right.grip, holds.right.pull, st.trig);
      return holds.right[name] || holds.right.grip;
    }
    if (name === 'low') {
      eyeToGun(LOW.at, v2);
      q.copy(toGunQ).multiply(q2.set(...lowQ));
      return { at: arr(v2), q: [q.x, q.y, q.z, q.w], digits: lowDigits };
    }
    const p = holds.left[name] || holds.left.grip;
    if (name === 'mag') return { ...p, at: add(p.at, magOff) };
    if (name === 'over' || name === 'pinch') return { ...p, at: add(p.at, [-SLIDE * slideX, 0, 0]) };
    return p;
  }
  const pick = (side, tr, magOff, slideX) => blend(named(side, tr.a, magOff, slideX), named(side, tr.b, magOff, slideX), tr.k);

  const api = {
    scene, camera, model, part, anchor, mats, hands,
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
    setAttachments(list) { for (const [fid, o] of Object.entries(fits)) if (fid !== 'mag') o.visible = list.includes(fid); },
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
        st.shotT = 0; st.lock = !!ev.last; st.freeT = 9;
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
        else if (input.aim || w.phase !== 'ready') { st.outFrom = { ...sample(C.inspect, st.inspT), slide: null }; st.outK = 1; st.inspT = -1; }
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

      // The slide: back hard on a shot and home again, held back on an empty gun until it is let go, or eased back by a
      // hand (and let go to fly home when the hand lets go).
      st.shotT += dt; st.freeT += dt;
      // A look into the chamber cut short never reaches its own slideHome cue.
      if (st.held !== null && now.slide === null) { st.freeT = 0; st.freeFrom = st.held; st.lock = false; if (cut) onCue?.('slideHome', id); }
      st.held = now.slide;
      let slide = 0;
      if (now.slide !== null) slide = now.slide;
      else if (st.freeT < 0.05) slide = st.freeFrom * (1 - st.freeT / 0.05);
      else if (st.shotT < 0.028) slide = st.shotT / 0.028;
      else if (st.lock) slide = Math.max(LOCK, 1 - (st.shotT - 0.028) / 0.5);
      else slide = Math.max(0, 1 - (st.shotT - 0.028) / 0.05);
      st.slide = slide;
      part.slide.position.copy(home.slide).x -= SLIDE * slide;
      const drop = 0.021 * smoother((slide - 0.1) / 0.4), px = 0.15, py = 0.0155;
      part.barrel.rotation.z = drop;
      part.barrel.position.set(home.barrel.x + px - (px * Math.cos(drop) - py * Math.sin(drop)) - 0.003 * Math.min(1, slide * 4), home.barrel.y + py - (px * Math.sin(drop) + py * Math.cos(drop)), home.barrel.z);
      part.stop.rotation.z = st.lock && slide >= LOCK - 0.01 ? -0.12 : 0;
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
      part.rel.position.copy(home.rel).add(v2.set(0, 0, pressing ? 0.0016 : 0));
      if (w.phase === 'reload' && w.t >= R.out) {
        const slid = Math.min(1, (w.t - R.out) / 0.1), fall = Math.max(0, w.t - (R.out + 0.07));
        spent.visible = w.t < R.out + 0.6;
        spent.position.copy(home.mag).addScaledVector(WELL, 0.115 * slid * slid).add(v2.set(-0.25 * fall, -4.9 * fall * fall, 0));
        spent.rotation.z = -3.2 * fall;
      } else spent.visible = false;

      // The hands, from the clip's poses; each forearm hangs from its elbow.
      const off = arr(magOff);
      for (const side of ['right', 'left']) {
        let p = pick(side, now[side], off, slide);
        if (back) p = blend(p, pick(side, was[side], off, slide), back);
        hands[side].pose(p, arr(eyeToGun(ELBOWS[side], v2)));
      }
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
