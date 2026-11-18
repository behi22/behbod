import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lit } from './lit.js';
import { pulsing } from './room.js';
import { B, drawn, glowText, box, card, batch, beamTexture, additive } from './decor.js';
import { MOODS, moodOf, newShift, wantMood, stepShift, shifting } from '../pure/moods.js';

// Each stage's set hangs above the drones and out of the line of fire; the costliest pieces stay out on the lowest quality.
export function makeHall(room, meta, { coarse = false, fancy = () => true } = {}) {
  const R = meta.range, cx = R.line[0], H = R.height;
  // As range.py has them: the wings are 1.4 m beyond the hall's side walls.
  const xw = R.box[0][0] + 1.4, xe = R.box[1][0] - 1.4, yb = R.box[1][1], yf = R.box[0][1];
  const lanes = [-4.8, -2.4, 0, 2.4, 4.8].map(d => cx + d), rail = H - 0.6, beamW = xw - 0.02, beamE = xe + 0.02;
  const tun = { x0: cx - R.tunnel.half, x1: cx + R.tunnel.half, y1: R.line[1] - R.tunnel.from, y0: R.line[1] - R.tunnel.to, h: R.tunnel.height };
  const ahead = d => R.line[1] - d, px = coarse ? 0.5 : 1;

  const frame = lit(new THREE.MeshStandardMaterial({ color: 0x1a1e25, roughness: 0.45, metalness: 0.65 }));
  const glows = [], fancyBits = [];
  const glow = (key, k = 1, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, ...extra }); glows.push({ m, key, k }); return m; };
  const glowAdd = (key, k, map, opacity) => { const m = additive(0xffffff, map, opacity); glows.push({ m, key, k }); return m; };
  const fancyOnly = o => (fancyBits.push(o), o);

  // ---------- the sign over the far end ----------
  const SIGN = { y: yf + 3, z: 3.8, w: 6.4, h: 1.0 };
  const signTex = drawn(1024, 160, () => {}, px);
  const signMat = glowAdd('glow', 2.4, signTex, 1);
  const always = new THREE.Group();
  always.name = 'hall_always';
  {
    const b = batch();
    b.add(frame, box(SIGN.w + 0.25, 0.08, SIGN.h + 0.2, [cx, SIGN.y - 0.05, SIGN.z]));
    for (const x of [lanes[1], lanes[3]]) b.add(frame, box(0.03, 0.03, rail - SIGN.z - SIGN.h / 2 - 0.1 + 0.02, [x, SIGN.y - 0.05, (rail + SIGN.z + SIGN.h / 2 + 0.1) / 2]));
    b.build(always, 'hall_sign_frame');
    const face = new THREE.Mesh(card(SIGN.w, SIGN.h, [cx, SIGN.y + 0.005, SIGN.z], '+y'), signMat);
    face.name = 'hall_sign'; face.matrixAutoUpdate = false;
    always.add(face);
  }
  room.scene.add(always);
  const drawSign = mood => signTex.userData.redraw((g, w, h) => {
    g.font = '900 100px system-ui, "Segoe UI", Arial, sans-serif';
    glowText(g, mood.sign, w / 2, h / 2 + 4, Math.min(124, Math.floor(100 * (w - 120) / g.measureText(mood.sign).width)), { weight: 900 });
  });

  // One picture for many plates, so a set of labels is one draw.
  function plates(texts, cols, cw = 256, ch = 128, size = 75) {
    const rows = Math.ceil(texts.length / cols);
    const tex = drawn(cols * cw, rows * ch, g => texts.forEach((t, i) => glowText(g, t, (i % cols + 0.5) * cw, (Math.floor(i / cols) + 0.5) * ch + 6, t.length > 3 ? size * 0.72 : size)), px);
    const cell = (geo, i) => {
      const uv = geo.attributes.uv, c = i % cols, r = Math.floor(i / cols);
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / cols, 1 - (r + 1 - uv.getY(k)) / rows);
      return geo;
    };
    return { tex, cell };
  }

  function beacons(spots, key, dome, size, b, set) {
    const domeMat = glow(key, dome), beams = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size * 0.34), glowAdd(key, 1.4, beamTexture(), 0.85), spots.length * 2);
    beams.name = 'hall_beacon_beams'; beams.frustumCulled = false;
    spots.forEach(([x, y, z, side]) => {
      b.add(frame, box(0.24, 0.12, 0.12, [x - side * 0.12, y, z - 0.12]));
      b.add(domeMat, new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(...B(x, y, z - 0.06).toArray()));
      b.add(frame, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 14).translate(...B(x, y, z - 0.08).toArray()));
    });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), off = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const turn = (t, rate) => {
      spots.forEach(([x, y, z], i) => {
        for (const k of [0, 1]) {
          const a = t * rate + i * 1.7 + k * Math.PI;
          q.setFromAxisAngle(up, a);
          off.set(size / 2, 0, 0).applyQuaternion(q);
          p.copy(B(x, y, z)).add(off);
          beams.setMatrixAt(i * 2 + k, m.compose(p, q, s));
        }
      });
      beams.instanceMatrix.needsUpdate = true;
    };
    turn(0, 0);
    set.add(fancyOnly(beams));
    return turn;
  }

  const sets = {};
  // Warm-up, the training hall.
  sets.training = () => {
    const set = new THREE.Group(), b = batch(), D = [5, 10, 15, 20, 25];
    const { tex, cell } = plates([...'12345', ...D.map(d => `${d} M`)], 2);
    const label = glow('accent', 1.6, { map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const y = ahead(5.5);
    lanes.forEach((x, i) => {
      b.add(frame, box(0.64, 0.04, 0.34, [x, y, rail - 0.32]));
      for (const dx of [-0.24, 0.24]) b.add(frame, box(0.02, 0.02, 0.17, [x + dx, y, rail - 0.08]));
      b.add(label, cell(card(0.6, 0.3, [x, y + 0.025, rail - 0.32], '+y'), lanes.length - 1 - i));
    });
    D.forEach((d, i) => {
      for (const [x, face, s] of [[beamW, '+x', 1], [beamE, '-x', -1]]) {
        b.add(frame, box(0.03, 0.84, 0.44, [x + s * 0.015, ahead(d), 3.78]));
        b.add(label, cell(card(0.8, 0.4, [x + s * 0.035, ahead(d), 3.78], face), 5 + i));
      }
    });
    const pens = [], colours = [[0.1, 0.75, 0.68], [0.92, 0.92, 0.9], [1.0, 0.45, 0.12]];
    for (const yy of [ahead(12), ahead(21)]) {
      const n = 22;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = beamW + (beamE - beamW) * u, z = H - 0.35 - 0.55 * 4 * u * (1 - u);
        const g = new THREE.BufferGeometry().setFromPoints([B(x - 0.2, yy, z), B(x + 0.2, yy, z), B(x, yy, z - 0.42)]);
        g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
        const c = colours[i % 3];
        g.setAttribute('color', new THREE.Float32BufferAttribute([...c, ...c, ...c], 3));
        pens.push(g);
      }
    }
    b.add(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, color: new THREE.Color(0.55, 0.55, 0.55) }), ...pens);
    b.build(set, 'hall_training');
    return { set };
  };

  // Walkers, the factory.
  sets.factory = () => {
    const set = new THREE.Group(), b = batch();
    const spots = [];
    for (const d of [6, 14, 22]) { spots.push([beamW + 0.26, ahead(d), 4.1, 1]); spots.push([beamE - 0.26, ahead(d), 4.1, -1]); }
    const turn = beacons(spots, 'accent', 3, 1.5, b, set);
    const stripes = drawn(256, 32, (g, w, h) => { g.fillStyle = '#e8b21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181c'; for (let x = -h; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } }, px);
    stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(70, 1);
    const tape = new THREE.MeshBasicMaterial({ map: stripes, color: new THREE.Color(0.5, 0.5, 0.5), fog: false });
    const len = yb - yf - 0.6;
    b.add(tape, card(len, 0.26, [beamW + 0.004, (yb + yf) / 2, 3.56], '+x'), card(len, 0.26, [beamE - 0.004, (yb + yf) / 2, 3.56], '-x'));
    b.build(set, 'hall_factory');
    const GAP = 3, n = Math.floor((yb - yf - 2) / GAP) - 1;
    const hookGeo = mergeGeometries([new THREE.BoxGeometry(0.03, 0.36, 0.03).translate(0, -0.18, 0), new THREE.BoxGeometry(0.16, 0.03, 0.03).translate(0.065, -0.35, 0), new THREE.BoxGeometry(0.03, 0.1, 0.03).translate(0.13, -0.31, 0)]);
    const hooks = new THREE.InstancedMesh(hookGeo, frame, lanes.length * n);
    hooks.name = 'hall_hooks';
    const line = new THREE.Group();
    line.add(hooks);
    const m = new THREE.Matrix4();
    lanes.forEach((x, k) => { for (let i = 0; i < n; i++) hooks.setMatrixAt(k * n + i, m.makeTranslation(...B(x, yb - 1.5 - i * GAP - (k % 2) * 1.2, rail).toArray())); });
    set.add(line);
    return { set, tick(dt, t) { turn(t, 3.2); line.position.z = (t * 0.35) % GAP; } };
  };

  // Swarm, the hive.
  sets.hive = () => {
    const set = new THREE.Group(), b = batch();
    const ringAt = [[cx - 3.6, ahead(7)], [cx + 3.6, ahead(9)], [cx, ahead(13)], [cx - 3.0, ahead(18)], [cx + 3.4, ahead(22)], [cx - 0.6, ahead(26)]];
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.55, 0.035, 4, 6).rotateX(Math.PI / 2), glow('accent', 2.2), ringAt.length);
    rings.name = 'hall_rings';
    ringAt.forEach(([x, y]) => b.add(frame, box(0.02, 0.02, H - 4.15, [x, y, (H + 4.15) / 2])));
    const comb = drawn(512, 128, (g, w, h) => {
      g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      const r = 18, dx = r * Math.sqrt(3);
      for (let row = 0, y = 0; y < h + r; row++, y += r * 1.5) for (let x = (row % 2) * dx / 2; x < w + dx; x += dx) {
        g.globalAlpha = 0.35 + 0.65 * ((x * 7 + y * 13) % 5 === 0 ? 1 : 0.25);
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); g.stroke();
      }
    }, px);
    comb.wrapS = THREE.RepeatWrapping; comb.repeat.set(4, 1);
    b.add(glowAdd('glow', 0.9, comb, 0.8), card(xe - xw + 2.6, 0.9, [cx, yf + 0.03, 4.5], '+y'));
    b.build(set, 'hall_hive');
    set.add(rings);
    const lasers = new THREE.Group(), beams = [];
    lasers.name = 'hall_lasers';
    const laserMat = glowAdd('glow', 1.6, null, 0.7);
    for (const [x, phase] of [[xw + 0.3, 0], [xw + 0.6, 1.3], [xe - 0.6, 2.1], [xe - 0.3, 3.4]]) {
      const pivot = new THREE.Group();
      pivot.position.copy(B(x, yf + 0.4, H - 0.3));
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 26).translate(0, 0, -13), laserMat);
      pivot.add(ray); lasers.add(pivot); beams.push({ pivot, phase, side: x < cx ? 1 : -1 });
    }
    set.add(fancyOnly(lasers));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const tick = (dt, t) => {
      ringAt.forEach(([x, y], i) => rings.setMatrixAt(i, m.compose(p.copy(B(x, y, 4.15)), q.setFromAxisAngle(up, t * (0.3 + i * 0.07) * (i % 2 ? 1 : -1)), s)));
      rings.instanceMatrix.needsUpdate = true;
      // Kept above the drones all the way to the line.
      for (const l of beams) l.pivot.rotation.set(-0.027, -l.side * (0.17 + 0.17 * Math.sin(t * 0.5 + l.phase)), 0, 'YXZ');
    };
    tick(0, 0);
    return { set, tick };
  };

  // Lights out: emergency beacons light nothing, so the dark stays as hard as it was.
  sets.blackout = () => {
    const set = new THREE.Group(), b = batch();
    // High on the far wall: lower down, the backstop's lip hides it from the line.
    const spots = [[xw + 1.0, yf + 0.5, H - 0.3, 1], [xe - 1.0, yf + 0.5, H - 0.3, -1], [beamW + 0.26, ahead(4), 4.1, 1], [beamE - 0.26, ahead(4), 4.1, -1]];
    const turn = beacons(spots, 'accent', 3.5, 2.6, b, set);
    const exit = drawn(256, 96, (g, w, h) => glowText(g, 'EXIT', w / 2, h / 2 + 3, 64, { weight: 900 }), px);
    const exitMat = new THREE.MeshBasicMaterial({ map: exit, color: new THREE.Color(0.25, 1.8, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const x of [xw + 2.2, xe - 2.2]) {
      b.add(frame, box(0.66, 0.06, 0.28, [x, yf + 0.03, 4.3]));
      b.add(exitMat, card(0.6, 0.22, [x, yf + 0.065, 4.3], '+y'));
    }
    b.build(set, 'hall_blackout');
    return { set, tick(dt, t) { turn(t, 2.4); }, flicker: true };
  };

  // The long shot, the night range.
  sets.night = () => {
    const set = new THREE.Group(), b = batch();
    const runway = glow('accent', 2.6);
    pulsing(runway, room.pulse);
    for (let y = tun.y1 - 1; y > tun.y0 + 1; y -= 2.5) for (const x of [tun.x0 + 0.12, tun.x1 - 0.12]) b.add(runway, box(0.08, 0.08, 0.03, [x, y, 0.02]));
    for (let y = yb - 2; y > yf + 1; y -= 2.5) for (const x of [xw + 0.35, xe - 0.35]) b.add(runway, box(0.07, 0.07, 0.03, [x, y, 0.02]));
    const D = [40, 50, 60, 70];
    const { tex, cell } = plates(D.map(d => `${d} M`), 2);
    const label = glow('glow', 1.8, { map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    D.forEach((d, i) => {
      const y = ahead(d), x = d % 20 ? tun.x0 + 0.35 : tun.x1 - 0.35;
      b.add(frame, box(0.52, 0.03, 0.27, [x, y, tun.h - 0.2]));
      b.add(label, cell(card(0.48, 0.24, [x, y + 0.02, tun.h - 0.2], '+y'), i));
    });
    b.build(set, 'hall_night');
    const n = coarse ? 160 : 420, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let r = 7;
    const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      B(xw - 1.2 + rnd() * (xe - xw + 2.4), yf + 0.5 + rnd() * (yb - yf - 1), H - 0.04).toArray(pos, i * 3);
      const k = 0.35 + rnd() * 0.65; col.set([k * 0.8, k * 0.9, k], i * 3);
    }
    const sky = new THREE.BufferGeometry();
    sky.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sky.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(sky, new THREE.PointsMaterial({ size: coarse ? 2 : 2.5, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    stars.name = 'hall_stars'; stars.matrixAutoUpdate = false;
    set.add(fancyOnly(stars));
    return { set };
  };

  const SETS = Object.fromEntries(Object.keys(MOODS).map(id => [MOODS[id].set, null]));
  let shown = null, current = null;
  const shift = newShift('warmup');
  let glowK = -1;
  // The set dips with the hall, so the swap happens in the dark.
  function tone(k) {
    if (k === glowK) return;
    glowK = k;
    const mood = moodOf(shown);
    for (const { m, key, k: b } of glows) m.color.setRGB(mood[key][0] * b * k, mood[key][1] * b * k, mood[key][2] * b * k);
  }
  function show(id) {
    const mood = moodOf(id);
    if (current) room.scene.remove(current.set);
    current = SETS[mood.set] ||= sets[mood.set]();
    current.set.name = 'hall_set_' + mood.set;
    room.scene.add(current.set);
    shown = id; glowK = -1;
    tone(shift.k);
    drawSign(mood);
    room.pulse.uPulse.value = mood.pulse; room.pulse.uSpeed.value = mood.speed;
  }
  show('warmup');
  let lastFancy = null;
  return {
    want(id) { wantMood(shift, MOODS[id] ? id : 'warmup'); },
    get shown() { return shown; },
    get wanted() { return shift.want; },
    get changing() { return shifting(shift); },
    update(dt, t) {
      const swap = stepShift(shift, dt);
      if (swap) show(swap);
      room.setMood(moodOf(shown), shift.k);
      tone(shift.k);
      const f = fancy();
      if (f !== lastFancy) { lastFancy = f; for (const o of fancyBits) o.visible = f; }
      current.tick?.(dt, t);
      room.pulse.uTime.value = t;
      if (current.flicker) {
        const w = Math.sin(t * 23) + Math.sin(t * 7.3) * 0.6 + Math.sin(t * 1.1) * 0.8;
        signMat.opacity = w > 1.55 ? 0.15 : 0.85 + 0.15 * Math.sin(t * 40);
      } else signMat.opacity = 1;
    },
    // Every set is up while the room warms up, so none has a shader left to build when it is first shown.
    async ready(job, pause) {
      for (const id of Object.keys(MOODS)) { const s = moodOf(id).set; if (!SETS[s]) { SETS[s] = sets[s](); await pause?.(); } }
      const extra = Object.values(SETS).filter(s => s !== current).map(s => s.set);
      for (const o of extra) room.scene.add(o);
      try { await job(); } finally { for (const o of extra) room.scene.remove(o); }
    },
  };
}
