import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { B, drawn, card, batch } from './decor.js';
import { prepare, breathe } from './room.js';
import { SILHOUETTES } from './silhouettes.js';
import { wall as wallOf, prompt, said, coming, summary, hang, footprint, HIDDEN } from '../pure/gunwall.js';
import { GUNS } from '../pure/arsenal.js';

// A gun's file is fetched to hang it only once you stand near the wall, so the range never loads guns nobody looks at.
const FRONT = 5.6, LABEL = [0.56, 0.14], PX = 512, FONT = 'system-ui, "Segoe UI", Arial, sans-serif';

export function makeWall(stage, meta, { renderer, camera, player, best, held, all = false, take, fetch, sfx, seen = () => true }) {
  const R = meta.range, group = new THREE.Group();
  group.name = 'gunwall';
  stage.add(group);
  // Shown only once the picture is in, never as dark squares.
  let pictured = false;
  const atlas = new THREE.TextureLoader().load(SILHOUETTES.file, () => { pictured = true; if (list.length) sync(); }, undefined, e => console.warn('[range] the gun wall outlines were not fetched', e));
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const shade = { locked: outlineMat(0x06080b, 0.92), owned: outlineMat(0x5fe3d0, 0.3) };
  const badge = new THREE.MeshBasicMaterial({ map: drawn(128, 128, (g, w) => {
    g.fillStyle = '#0c1116'; g.beginPath(); g.arc(w / 2, w / 2, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffb43a'; g.lineWidth = 6; g.stroke();
    lock(g, w / 2, w / 2 - 10);
  }), transparent: true, depthWrite: false, fog: false, toneMapped: false });

  const mounts = GUNS.map((g, i) => {
    const at = R.mounts[i], s = SILHOUETTES.guns[g.id], hung = hang(g.id, s?.box, at);
    const m = { id: g.id, at, hung, state: null, model: null, hanging: false, ready: false, failed: false, outline: null, lock: null };
    if (s) {
      const [x0, y0, x1, y1] = s.covers, [u0, v0, u1, v1] = s.uv, geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateY(Math.PI).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      m.outline = place(new THREE.Mesh(geo, shade.locked), hung);
      m.outline.name = `gunwall_outline_${g.id}`;
      const [y0b, y1b, z0b, z1b] = footprint(hung, s.box);
      m.lock = new THREE.Mesh(card(0.11, 0.11, [hung.at[0] + 0.05, (y0b + y1b) / 2, (z0b + z1b) / 2 + 0.08], '+x'), badge);
      m.lock.renderOrder = 1; m.lock.name = `gunwall_lock_${g.id}`;
      group.add(m.outline, m.lock);
    }
    m.spot = { id: `wall_${g.id}`, label: '', at: [6.1, at[1], 0], r: 0.44, x: 6.1, y: 0, z: -at[1] };
    m.box = new THREE.Box3().setFromPoints([B(5.2, at[1] - 0.4, 0.5), B(FRONT + 0.02, at[1] + 0.4, 2.25)]);
    return m;
  });

  // One picture for all five plaques: one draw.
  const plaques = drawn(PX, PX / 4 * mounts.length, () => {});
  const b = batch();
  const plaqueMat = new THREE.MeshBasicMaterial({ map: plaques, fog: false, toneMapped: false });
  mounts.forEach((m, i) => {
    const geo = card(LABEL[0], LABEL[1], [FRONT + 0.006, m.at[1], 0.66], '+x'), uv = geo.attributes.uv, n = mounts.length;
    for (let k = 0; k < uv.count; k++) uv.setY(k, (n - 1 - i + uv.getY(k)) / n);
    b.add(plaqueMat, geo);
  });
  b.build(group, 'gunwall_plaques');

  function draw(list) {
    plaques.userData.redraw((g, w) => {
      const h = w / 4;
      list.forEach((m, i) => {
        const y = i * h, lit = m.owned, hold = m.held;
        g.fillStyle = '#0c1116'; g.fillRect(0, y, w, h);
        g.fillStyle = hold ? '#5fe3d0' : lit ? '#2f8d82' : '#ffb43a'; g.fillRect(0, y, 10, h);
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillStyle = lit ? '#e9f3f6' : '#6b7880'; g.font = `800 60px ${FONT}`;
        g.fillText(m.name.toUpperCase(), 34, y + h * 0.35);
        g.font = `700 34px ${FONT}`;
        if (hold) { g.fillStyle = '#5fe3d0'; g.fillText('IN YOUR HANDS', 34, y + h * 0.77); }
        else if (lit) { g.fillStyle = '#8fa7ae'; g.fillText(m.kind.toUpperCase(), 34, y + h * 0.77); }
        else {
          lock(g, w - 62, y + h * 0.42);
          g.fillStyle = '#ffc24a'; g.fillText(`NEEDS ★ ${m.need}`, 34, y + h * 0.77);
        }
      });
    });
  }

  let list = [], shownHeld = null;
  function sync() {
    list = wallOf(best(), { all, held: held() });
    shownHeld = held();
    for (const s of list) {
      const m = mounts[s.mount], real = s.owned && m.ready;
      m.state = s; m.spot.label = prompt(s);
      if (m.model) m.model.visible = real;
      if (m.outline) { m.outline.visible = !real && pictured; m.outline.material = s.owned ? shade.owned : shade.locked; m.lock.visible = !s.owned; }
    }
    draw(list);
  }

  // Copied as first made (slide home, nothing fitted), its shaders built for this room before it shows.
  async function hangModel(id, model) {
    const m = mounts.find(x => x.id === id);
    if (!m || m.hanging) return;
    m.hanging = true;
    let show;
    try { show = place(await bake(model), m.hung); } catch (e) { m.failed = true; console.warn('[range] gun not hung on the wall', id, e); return; }
    show.name = `gunwall_${id}`; show.visible = false;
    m.model = show;
    group.add(show);
    try { await prepare(renderer, show, camera, { into: stage, rest: breathe }); } catch (e) { /* drawn anyway; the first look builds it */ }
    m.ready = true;
    if (list.length) sync();
  }

  // One gun at a time, so a slow phone never takes several at once; `player()` is where I stand, in the page's axes.
  let busy = false;
  const near = () => { const p = player?.(); return !!p && p.x < 9 && p.z > -0.3 && p.z < 6.5 && p.y < 1; };
  function update() {
    if (held() !== shownHeld) sync();
    if (busy) return;
    const m = mounts.find(x => x.state?.owned && !x.hanging && !x.failed);
    if (!m || !near()) return;
    busy = true;
    fetch(m.id).then(() => {}, () => { m.failed = true; }).finally(() => { busy = false; });
  }

  function poke(id) {
    if (id === 'loadout') return list.length ? summary(list) : null;
    const m = mounts.find(x => x.spot.id === id);
    if (!m?.state) return null;
    const s = m.state;
    if (s.owned && !s.held) {
      take(s.id).then(ok => { if (ok) { sfx?.click?.(B(...m.at)); sync(); } }, () => {});
      // A gun already fetched is in the hands at once; one still coming may never arrive.
      if (held() !== s.id) return coming(s);
    }
    return said(s);
  }
  // Anything in `blockers` nearer than the wall wins the tap.
  const hitAt = new THREE.Vector3();
  function hit(raycaster, blockers = []) {
    if (!seen()) return null;
    let bestM = null, bd = Infinity;
    for (const m of mounts) {
      if (!raycaster.ray.intersectBox(m.box, hitAt)) continue;
      const d = hitAt.distanceTo(raycaster.ray.origin);
      if (d < bd) { bd = d; bestM = m; }
    }
    if (!bestM || raycaster.intersectObjects(blockers, true)[0]?.distance < bd - 0.1) return null;
    return bestM.spot;
  }

  return { group, mounts, spots: mounts.map(m => m.spot), sync, update, poke, hit, hang: hangModel, get list() { return list; } };

  function outlineMat(color, opacity) {
    return new THREE.MeshBasicMaterial({ map: atlas, color, transparent: true, opacity, depthWrite: false, fog: false });
  }
}

// Merged by material, a few draws a gun instead of 20 to 30; packed numbers read back first, each part has its own scale.
async function bake(model) {
  const out = new THREE.Group(), parts = new Map(), meshes = [];
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  model.traverseVisible(o => { if (o.isMesh && !HIDDEN.test(o.name)) meshes.push([o.geometry, o.material, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)]); });
  let t = performance.now();
  // A few milliseconds at a time, so a slow phone never stalls on it.
  const slice = async () => { if (performance.now() - t > 6) { await breathe(); t = performance.now(); } };
  for (const [geo, material, matrix] of meshes) {
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(geo.attributes)) {
      const f = new Float32Array(a.count * a.itemSize), get = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a[get[k]](i);
      g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
    }
    if (geo.index) g.setIndex(Array.from(geo.index.array));
    g.applyMatrix4(matrix);
    const key = `${material.uuid} ${Object.keys(g.attributes).sort()} ${!!g.index}`;
    if (!parts.has(key)) parts.set(key, { material, geos: [] });
    parts.get(key).geos.push(g);
    await slice();
  }
  for (const { material, geos } of parts.values()) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (merged) { const mesh = new THREE.Mesh(merged, material); mesh.matrixAutoUpdate = false; out.add(mesh); }
    await slice();
  }
  return out;
}

// Left side to the room, as the outlines were drawn.
function place(o, h) {
  o.position.copy(B(...h.at));
  o.rotation.set(0, -Math.PI / 2, 0);
  if (h.upright) o.rotateZ(Math.PI / 2);
  o.scale.setScalar(h.scale);
  return o;
}

function lock(g, x, y) {
  g.save();
  g.strokeStyle = '#ffc24a'; g.fillStyle = '#ffc24a'; g.lineWidth = 6;
  g.beginPath(); g.arc(x, y - 6, 13, Math.PI, 0); g.lineTo(x + 13, y + 4); g.moveTo(x - 13, y + 4); g.lineTo(x - 13, y - 6); g.stroke();
  g.beginPath(); g.roundRect(x - 21, y + 2, 42, 30, 5); g.fill();
  g.restore();
}
