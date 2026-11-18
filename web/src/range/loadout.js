import * as THREE from 'three';
import { lit } from './lit.js';
import { makeFoeKit } from './foes.js';
import { B, drawn, glowText, box, card, batch, additive } from './decor.js';
import { MOODS } from '../pure/moods.js';
import { STAGES } from '../pure/stages.js';

// Only on walls and solid furniture, so nothing blocks a path; the bench top, board outlines, rack and gun wall stay free for what comes next.
const HL = 3.2;

export function makeLoadout(stage, meta, { coarse = false, low = false, sfx, hall } = {}) {
  const R = meta.range, px = coarse ? 0.5 : 1;
  // The world file has no walls for this room: the hall's side walls carry on, and the workbench stands 0.36 m out.
  const xw = R.box[0][0] + 1.4, xe = R.box[1][0] - 1.4, wall = meta.points.range_workbench[1] + 0.36 - 0.05, line = R.line[1] + 0.3;
  const group = new THREE.Group();
  group.name = 'loadout';
  stage.add(group);
  const paint = map => lit(new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.05 }));
  const frame = lit(new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.5, metalness: 0.55 }));
  const steel = lit(new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.32, metalness: 0.9 }));
  const b = batch();

  const bx = meta.points.range_workbench[0];
  const plaque = drawn(512, 128, (g, w, h) => {
    g.fillStyle = '#163a3f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff7a2a'; g.fillRect(36, h - 26, w - 72, 6);
    g.fillStyle = '#e9f3f6'; g.font = '800 64px system-ui, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('GUNSMITH', w / 2, h / 2 - 6);
  }, px);
  b.add(frame, box(1.36, 0.03, 0.36, [bx, wall - 0.03, 2.33]));
  b.add(paint(plaque), card(1.3, 0.32, [bx, wall - 0.05, 2.33], '-y'));

  const ax = bx + 3.65;
  const outline = drawn(1024, 476, (g, w, h) => {
    g.fillStyle = '#1d232b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a323c';
    for (let y = 18; y < h; y += 26) for (let x = 18; x < w; x += 26) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#5fe3d0'; g.font = '800 46px system-ui, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ATTACHMENTS', w / 2, 46);
    const slots = [['LIGHT', 'light'], ['MUZZLE', 'muzzle'], ['OPTIC', 'optic'], ['MAG', 'mag']];
    slots.forEach(([name, kind], i) => {
      const cx = (i + 0.5) * w / 4, cy = 250;
      g.save();
      g.strokeStyle = '#ff9a4a'; g.lineWidth = 6; g.setLineDash([16, 10]); g.lineJoin = 'round';
      g.beginPath();
      if (kind === 'light') { g.roundRect(cx - 34, cy - 90, 68, 120, 14); g.roundRect(cx - 52, cy - 130, 104, 44, 16); }
      else if (kind === 'muzzle') g.roundRect(cx - 30, cy - 140, 60, 210, 26);
      else if (kind === 'optic') { g.roundRect(cx - 80, cy - 70, 160, 110, 18); g.moveTo(cx - 50, cy + 40); g.lineTo(cx - 50, cy + 70); g.moveTo(cx + 50, cy + 40); g.lineTo(cx + 50, cy + 70); }
      else { g.moveTo(cx - 40, cy - 110); g.lineTo(cx + 40, cy - 110); g.quadraticCurveTo(cx + 70, cy + 20, cx + 30, cy + 80); g.lineTo(cx - 40, cy + 80); g.quadraticCurveTo(cx - 10, cy + 10, cx - 40, cy - 110); }
      g.stroke();
      g.restore();
      g.fillStyle = '#e9f3f6'; g.font = '700 34px system-ui, "Segoe UI", Arial, sans-serif';
      g.fillText(name, cx, h - 44);
    });
  }, px);
  b.add(frame, box(2.9, 0.03, 1.4, [ax, wall - 0.03, 1.66]));
  b.add(paint(outline), card(2.8, 1.3, [ax, wall - 0.05, 1.66], '-y'));

  // West of the bookcase door, clear of its swing.
  const kx = xw + 1.1;
  const rack = drawn(512, 440, (g, w, h) => {
    g.fillStyle = '#1d232b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5fe3d0'; g.font = '800 40px system-ui, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('CAMOS', w / 2, 36);
    g.strokeStyle = '#ff9a4a'; g.lineWidth = 4; g.setLineDash([10, 7]);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { g.beginPath(); g.roundRect(70 + c * 132, 70 + r * 112, 104, 92, 10); g.stroke(); }
    g.setLineDash([]); g.fillText('CHARMS', w / 2, 328);
  }, px);
  b.add(frame, box(1.36, 0.03, 1.16, [kx, wall - 0.03, 1.72]));
  b.add(paint(rack), card(1.3, 1.1, [kx, wall - 0.05, 1.72], '-y'));
  for (let i = 0; i < 4; i++) b.add(steel, new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8).rotateX(Math.PI / 2).translate(...B(kx - 0.39 + i * 0.26, wall - 0.095, 1.29).toArray()));

  const sx = xw + 0.25, sy = line + 0.02;
  const panel = drawn(256, 352, (g, w, h) => {
    g.fillStyle = '#1d232b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9f3f6'; g.font = '800 44px system-ui, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HALL', w / 2, 48);
    g.fillStyle = '#8fa7ae'; g.font = '600 26px system-ui, "Segoe UI", Arial, sans-serif'; g.fillText('LIGHTS', w / 2, 88);
  }, px);
  b.add(frame, box(0.4, 0.04, 0.56, [sx, sy + 0.02, 1.36]));
  b.add(paint(panel), card(0.36, 0.5, [sx, sy + 0.041, 1.38], '+y'));
  const keys = STAGES.map((st, i) => {
    const c = MOODS[st.id].glow, m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), fog: false });
    const key = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 14).rotateX(Math.PI / 2), m);
    key.position.copy(B(sx - 0.12 + i * 0.06, sy + 0.05, 1.24)); key.updateMatrix(); key.matrixAutoUpdate = false;
    group.add(key);
    return { id: st.id, m, c };
  });

  const door = (meta.doors.find(d => d.id === 'secret')?.pivot || [xw + 2.4])[0] + 0.5;
  const neon = drawn(512, 128, (g, w, h) => glowText(g, 'LOADOUT', w / 2, h / 2 + 3, 78, { weight: 800 }), px);
  const neonMesh = new THREE.Mesh(card(1.3, 0.32, [door, wall - 0.012, 2.66], '-y'), additive(new THREE.Color(1.3, 0.45, 0.14), neon));
  neonMesh.name = 'loadout_neon'; neonMesh.matrixAutoUpdate = false;
  group.add(neonMesh);
  const pens = [], colours = [[0.1, 0.75, 0.68], [0.92, 0.92, 0.9], [1.0, 0.45, 0.12]];
  const py = (wall + line) / 2, n = 26;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = xw + 0.3 + (xe - xw - 0.6) * u, z = HL - 0.1 - 0.22 * 4 * u * (1 - u);
    const g = new THREE.BufferGeometry().setFromPoints([B(x - 0.11, py, z), B(x + 0.11, py, z), B(x, py, z - 0.24)]);
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
    const c = colours[i % 3];
    g.setAttribute('color', new THREE.Float32BufferAttribute([...c, ...c, ...c], 3));
    pens.push(g);
  }
  b.add(lit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })), ...pens);
  b.build(group, 'loadout_pieces');

  const kit = makeFoeKit({ low: low || coarse });
  const rivet = kit.walker(), crate = [xe - 0.5, line + 0.8, 0.68];
  rivet.g.scale.setScalar(0.3);
  rivet.g.position.copy(B(...crate));
  rivet.g.rotation.y = 2.76;
  rivet.g.name = 'rivet';
  group.add(rivet.g);
  const arm = rivet.part.armL, armRest = arm.quaternion.clone(), head = rivet.part.head, headRest = head.quaternion.clone();

  const drone = kit.drone(), perch = [xe - 0.23, wall - 1.6, 1.9];
  drone.g.scale.setScalar(0.3);
  drone.g.position.copy(B(perch[0], perch[1], perch[2] + 0.07));
  drone.g.rotation.y = Math.PI / 2;
  drone.g.name = 'practice_drone';
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20), frame), ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.2), fog: false }));
  pad.position.copy(B(perch[0], perch[1], perch[2] + 0.01)); ring.position.copy(B(perch[0], perch[1], perch[2] + 0.022));
  group.add(drone.g, pad, ring);
  const eyeRest = drone.mat.eye.color.clone(), droneHome = drone.g.position.clone();
  drone.mat.eye.color.copy(eyeRest).multiplyScalar(0.18);
  for (const r of drone.rotors) r.spin.children.at(-1).visible = false;
  for (const o of [pad, ring]) { o.updateMatrix(); o.matrixAutoUpdate = false; }

  const spot = (id, label, x, y, r) => ({ id, label, at: [x, y, 0], r, x, y: 0, z: -y });
  const spots = [
    spot('rg_bench', 'Look at the gunsmith bench', bx, wall - 1.0, 0.9),
    spot('rg_attach', 'Look at the attachment board', ax, wall - 0.85, 0.9),
    spot('rg_camo', 'Look at the camo rack', kx, wall - 0.8, 0.8),
    spot('rg_lights', 'Switch the hall lights', sx + 0.6, line + 0.65, 0.7),
    spot('rg_bot', 'Say hi to Rivet', crate[0] - 0.85, crate[1] + 0.15, 0.7),
    spot('rg_drone', 'Wake the drone', perch[0] - 0.95, perch[1], 0.75),
  ];
  let waveT = 9, wakeT = 9, hum = null, says = 0;
  const RIVET = ['Rivet, the range mascot. Off duty today.', 'Rivet beeps back. It sounds like a yes.', 'Rivet waves. The walkers in the hall are its cousins.'];

  function poke(id) {
    if (id === 'rg_bench') return 'The gunsmith bench. Soon a gun goes on it, and you choose what is fitted.';
    if (id === 'rg_attach') return 'The attachment board: a light, a suppressor, an optic and a longer magazine go up here.';
    if (id === 'rg_camo') return 'Camos and charms for the guns hang here once they are made.';
    if (id === 'rg_lights') {
      const at = STAGES.findIndex(s => s.id === (hall?.wanted || 'warmup')), next = STAGES[(at + 1) % STAGES.length];
      hall?.want(next.id);
      sfx?.breaker?.(true);
      return `The hall's lights: ${next.name}.`;
    }
    if (id === 'rg_bot') { waveT = 0; sfx?.walkerChirp?.(rivet.g.getWorldPosition(new THREE.Vector3())); return RIVET[says++ % RIVET.length]; }
    if (id === 'rg_drone') {
      if (wakeT > 2.8) { wakeT = 0; hum?.stop(); hum = sfx?.droneHum?.(drone.g.getWorldPosition(new THREE.Vector3())) || null; }
      return 'A practice drone on its charger. It wakes, looks around and goes back to sleep.';
    }
    return null;
  }

  const q = new THREE.Quaternion(), e = new THREE.Euler();
  function update(dt, t) {
    if (waveT < 9) {
      waveT += dt;
      const k = waveT < 1.6 ? Math.sin(Math.PI * Math.min(1, waveT / 1.6)) : 0;
      arm.quaternion.copy(armRest).multiply(q.setFromEuler(e.set(-2.3 * k + 0.35 * k * Math.sin(waveT * 14), 0, 0)));
      head.quaternion.copy(headRest).multiply(q.setFromEuler(e.set(0.25 * k, 0, 0)));
      rivet.mat.eyes.color.setRGB(...kit.colours.TEAL).multiplyScalar(1 + k);
      if (waveT >= 1.6) waveT = 9;
    }
    if (wakeT < 2.8) {
      wakeT += dt;
      const up = Math.min(1, wakeT / 0.4) * Math.min(1, Math.max(0, (2.8 - wakeT) / 0.6));
      for (const r of drone.rotors) { r.spin.rotation.y += dt * 40 * up; r.spin.children.at(-1).visible = up > 0.5; }
      drone.g.position.copy(droneHome).y += 0.14 * up;
      drone.g.rotation.y = Math.PI / 2 + Math.sin(wakeT * 2.2) * 0.6 * up;
      drone.mat.eye.color.copy(eyeRest).multiplyScalar(0.18 + 0.82 * up);
      hum?.move(drone.g.getWorldPosition(new THREE.Vector3()));
      if (wakeT >= 2.8) { hum?.stop(); hum = null; wakeT = 9; drone.g.position.copy(droneHome); drone.g.rotation.y = Math.PI / 2; drone.mat.eye.color.copy(eyeRest).multiplyScalar(0.18); }
    } else drone.mat.eye.color.copy(eyeRest).multiplyScalar(0.12 + 0.06 * Math.sin(t * 1.3));
    const on = hall?.wanted || 'warmup';
    for (const k of keys) { const s = k.id === on ? 2.2 : 0.35; k.m.color.setRGB(k.c[0] * s, k.c[1] * s, k.c[2] * s); }
  }
  // Out of sight nothing updates, so a wake cut short must not leave the hum running.
  function rest() {
    if (waveT >= 9 && wakeT >= 9) return;
    hum?.stop(); hum = null;
    waveT = 9; wakeT = 9;
    arm.quaternion.copy(armRest); head.quaternion.copy(headRest); rivet.mat.eyes.color.setRGB(...kit.colours.TEAL);
    drone.g.position.copy(droneHome); drone.g.rotation.y = Math.PI / 2;
    for (const r of drone.rotors) r.spin.children.at(-1).visible = false;
  }
  // Where the pieces still to come go, in Blender's axes like the world file (B() turns them into the page's).
  const places = {
    bench: [...meta.points.range_workbench],
    attachments: [0, 1, 2, 3].map(i => [ax - 1.05 + i * 0.7, wall - 0.07, 1.63]),
    camos: [0, 1].flatMap(r => [0, 1, 2].map(c => [kx - 0.65 + (122 + c * 132) / 512 * 1.3, wall - 0.06, 2.27 - (116 + r * 112) / 440 * 1.1])),
    charms: [0, 1, 2, 3].map(i => [kx - 0.39 + i * 0.26, wall - 0.14, 1.29]),
  };
  return { group, spots, places, poke, update, rest, rivet, drone, get awake() { return wakeT < 2.8; } };
}
