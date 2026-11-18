import * as THREE from 'three';
import { GUN, ATTACHMENTS } from '../pure/arsenal.js';
import { SLOTS, CAMOS, CHARMS, CAMO, CHARM, BLURBS, optionsFor, isOpen, lockLine, choose, inSlot, compare } from '../pure/smith.js';
import { camoSwatch } from './camos.js';

// The gunsmith's bench: the gun alone on a clean backdrop, turned by a drag and brought closer by the wheel or a pinch,
// with its slots down one side, the choices for the picked slot under it and the numbers they change on the other side.
// Every change goes on the gun at once and is saved for that gun in this browser. The gun on the bench is the one in the
// hand, lent to the bench's own scene and handed back on closing.
const CSS = `
.gs { position: fixed; inset: 0; z-index: 32; display: grid; pointer-events: none; color: #e9f3f6; font: 600 13px/1.35 ui-monospace, Menlo, Consolas, monospace; user-select: none; -webkit-user-select: none;
  grid-template-columns: 300px minmax(0, 1fr) 312px; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "head stage stats" "slots stage stats" "slots opts stats";
  padding: calc(14px + env(safe-area-inset-top, 0px)) calc(14px + env(safe-area-inset-right, 0px)) calc(14px + env(safe-area-inset-bottom, 0px)) calc(14px + env(safe-area-inset-left, 0px)); gap: 12px; }
.gs * { box-sizing: border-box; }
.gs > div { pointer-events: auto; min-width: 0; }
.gs-panel { background: rgba(8, 12, 17, .94); border: 1px solid rgba(120, 220, 210, .2); border-radius: 14px; }
.gs-head { grid-area: head; padding: 16px 16px 12px; }
.gs-head h2 { margin: 0; font-size: 11px; letter-spacing: .22em; color: #5fe3d0; display: flex; justify-content: space-between; align-items: center; }
.gs-name { font-size: 22px; color: #fff; margin: 6px 0 2px; letter-spacing: .02em; } .gs-kind { color: #8fa7ae; font-weight: 400; }
.gs-guns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.gs button { font: inherit; color: #e9f3f6; background: rgba(120, 220, 210, .07); border: 1px solid rgba(120, 220, 210, .28); border-radius: 9px; padding: 7px 11px; cursor: pointer; }
.gs button:hover:not([disabled]) { background: rgba(120, 220, 210, .15); }
.gs button.on { background: #5fe3d0; color: #06110f; border-color: #5fe3d0; }
.gs button[disabled] { opacity: .45; cursor: default; }
.gs-done { padding: 6px 12px !important; letter-spacing: .08em; }
.gs-slots { grid-area: slots; padding: 8px; display: flex; flex-direction: column; gap: 4px; align-self: start; }
.gs-slot { display: grid !important; grid-template-columns: 22px 1fr; text-align: left; gap: 0 8px; padding: 9px 10px !important; background: transparent !important; border-color: transparent !important; }
.gs-slot i { grid-row: span 2; font-style: normal; color: #4f6670; font-size: 11px; align-self: center; }
.gs-slot small { color: #8fa7ae; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; }
.gs-slot b { color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gs-slot.on { background: rgba(95, 227, 208, .12) !important; border-color: rgba(95, 227, 208, .55) !important; color: #e9f3f6 !important; } .gs-slot.on i { color: #5fe3d0; }
.gs-stage { grid-area: stage; position: relative; cursor: grab; touch-action: none; } .gs-stage.drag { cursor: grabbing; }
.gs-tip { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); color: #7d939a; font-weight: 400; font-size: 11px; white-space: nowrap; pointer-events: none; text-shadow: 0 1px 4px rgba(0, 0, 0, .8); }
.gs-opts { grid-area: opts; padding: 10px; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: thin; }
.gs-opt { flex: none; width: 148px; display: flex !important; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; padding: 10px !important; }
.gs-opt em { font-style: normal; color: #8fa7ae; font-weight: 400; font-size: 11px; }
.gs-opt.on em { color: #0b2622; }
.gs-opt canvas, .gs-sw { width: 100%; height: 34px; border-radius: 6px; display: block; background: #20262b; }
.gs-opt.locked { opacity: .5; }
.gs-stats { grid-area: stats; padding: 16px; overflow: auto; }
.gs-stats h3 { margin: 0 0 10px; font-size: 11px; letter-spacing: .22em; color: #5fe3d0; font-weight: 600; }
.gs-row { display: grid; grid-template-columns: 1fr auto; gap: 3px 10px; margin: 0 0 9px; }
.gs-row span { color: #a9c2c9; font-weight: 400; } .gs-row b { color: #fff; font-weight: 600; text-align: right; white-space: nowrap; }
.gs-row b u { text-decoration: none; color: #7d939a; font-weight: 400; } .gs-row.up b em { color: #5fe3d0; font-style: normal; } .gs-row.down b em { color: #ff8a6a; font-style: normal; }
.gs-bar { grid-column: 1 / -1; position: relative; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, .09); overflow: hidden; }
.gs-bar i { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 3px; transition: width .25s ease, left .25s ease; }
.gs-bar .base { background: #dfe9ec; } .gs-bar .gain { background: #5fe3d0; } .gs-bar .loss { background: #ff8a6a; }
.gs-blurb { color: #a9c2c9; font-weight: 400; margin: 14px 0 0; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, .08); min-height: 3.2em; }
.gs-blurb b { color: #fff; display: block; margin-bottom: 2px; }
body.gs-on .rg, body.gs-on .corner, body.gs-on #prompt { visibility: hidden; }
@media (max-width: 1080px) and (min-width: 721px) { .gs { grid-template-columns: 250px minmax(0, 1fr) 270px; } }
@media (max-width: 720px) and (orientation: portrait) {
  .gs { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(190px, 1fr) auto auto auto; grid-template-areas: "head" "stage" "slots" "opts" "stats"; gap: 8px; padding-left: calc(10px + env(safe-area-inset-left, 0px)); padding-right: calc(10px + env(safe-area-inset-right, 0px)); }
  .gs-head { padding: 10px 12px; } .gs-name { font-size: 18px; margin: 2px 0 0; } .gs-guns { margin-top: 8px; flex-wrap: nowrap; overflow-x: auto; } .gs-guns button { flex: none; }
  .gs-slots { flex-direction: row; overflow-x: auto; padding: 6px; } .gs-slot { flex: none; min-width: 108px; } .gs-slot i { display: none; } .gs-slot { grid-template-columns: 1fr; }
  .gs-opts { padding: 8px; } .gs-opt { width: 128px; }
  .gs-stats { max-height: 30vh; padding: 10px 12px; } .gs-stats h3 { display: none; } .gs-row { font-size: 11px; } .gs-row span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .gs-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; } .gs-row { margin-bottom: 6px; }
  .gs-blurb { margin-top: 6px; padding-top: 8px; min-height: 0; font-size: 12px; }
}
@media (max-height: 560px) and (orientation: landscape) {
  .gs { grid-template-columns: minmax(0, 1fr) minmax(330px, 46%); grid-template-rows: auto auto auto minmax(0, 1fr); grid-template-areas: "stage head" "stage slots" "stage opts" "stage stats"; gap: 6px; }
  .gs-head { padding: 8px 12px; } .gs-name { font-size: 16px; margin: 0; } .gs-guns { margin-top: 6px; flex-wrap: nowrap; overflow-x: auto; } .gs-guns button { flex: none; padding: 5px 9px; }
  .gs-slots { flex-direction: row; overflow-x: auto; padding: 4px; } .gs-slot { flex: none; min-width: 96px; grid-template-columns: 1fr; padding: 6px 8px !important; } .gs-slot i { display: none; }
  .gs-opts { padding: 6px; } .gs-opt { width: 118px; padding: 7px !important; } .gs-opt canvas, .gs-sw { height: 22px; } .gs-opt em { display: none; }
  .gs-stats { padding: 8px 12px; } .gs-stats h3 { display: none; } .gs-row { font-size: 11px; } .gs-row span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .gs-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; } .gs-row { margin-bottom: 5px; } .gs-blurb { display: none; }
}`;

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const damp = (x, to, k, dt) => x + (to - x) * (1 - Math.exp(-k * dt));
// How the gun is turned for each slot (0 shows its left side; more turns the muzzle toward you), tipped (more shows its
// top) and how much of it the view takes in (metres across, 0 for all of it). The gun turns, not the camera, so its
// charm swings as it is turned.
const VIEWS = { all: [-0.35, 0.2, 0], muzzle: [0.8, 0.16, 0.3], optic: [-0.7, 0.45, 0.34], rail: [0.35, -0.4, 0.34], mag: [0.1, -0.25, 0.4], camo: [-0.25, 0.16, 0], charm: [0.2, 0.08, 0.13] };

export function makeSmith({ engine, coarse, env, fitter, guns, onClose }) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, 0.01, 30);
  scene.environment = env;
  // The same kinds of light as the gun's own scene (its muzzle glow comes along with it), so its materials need no new programs.
  const sky = new THREE.HemisphereLight(0xdfeaff, 0x14181d, 0.7), key = new THREE.DirectionalLight(0xfff2e2, 2.6), rim = new THREE.DirectionalLight(0xa9d4ff, 1.5);
  scene.add(sky, key, key.target, rim, rim.target, camera);
  scene.background = backdrop();
  const spinner = new THREE.Group(), pivot = new THREE.Group(), floor = shadowDisc();
  spinner.add(pivot);
  scene.add(spinner, floor);
  let layered = false, open = false, gun = null, home = null, kit = null, kits = null, slot = 'all', preview = null, lastChange = null, closing = false;
  let root = null, nodes = {};
  const swatches = new Map();
  // The gun's turn and tip (radians), how close (1 frames the gun), and the point looked at (want.at on the gun, view.at
  // where it is now); each eases to where it is asked.
  const view = { yaw: 0, pitch: 0, zoom: 1, at: new THREE.Vector3() }, want = { yaw: 0, pitch: 0, zoom: 1, at: new THREE.Vector3() };
  let fit = 1, spin = 0;
  const size = new THREE.Vector3(), box = new THREE.Box3(), part = new THREE.Box3(), centre = new THREE.Vector3(), target = new THREE.Vector3();

  function backdrop() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#16242c'); grad.addColorStop(0.55, '#0b1218'); grad.addColorStop(1, '#05080b');
    g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // A soft pool of shadow under the gun.
  function shadowDisc() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  // ---------- the page ----------
  function build() {
    if (!document.getElementById('gs-css')) { const s = el('style'); s.id = 'gs-css'; s.textContent = CSS; document.head.append(s); }
    root = el('div', 'gs');
    const head = el('div', 'gs-head gs-panel'), h2 = el('h2'), done = el('button', 'gs-done', 'Done');
    h2.append(document.createTextNode('GUNSMITH'), done);
    done.addEventListener('click', () => api.close());
    nodes.name = el('div', 'gs-name'); nodes.guns = el('div', 'gs-guns');
    head.append(h2, nodes.name, nodes.guns);
    nodes.slots = el('div', 'gs-slots gs-panel');
    nodes.stage = el('div', 'gs-stage');
    nodes.stage.append(el('div', 'gs-tip', coarse ? 'Drag to turn  ·  pinch to zoom  ·  double tap to reset' : 'Drag to turn  ·  scroll to zoom  ·  double click to reset'));
    nodes.opts = el('div', 'gs-opts gs-panel');
    const stats = el('div', 'gs-stats gs-panel');
    nodes.rows = el('div', 'gs-rows'); nodes.blurb = el('p', 'gs-blurb');
    stats.append(el('h3', '', 'WHAT IT CHANGES'), nodes.rows, nodes.blurb);
    root.append(head, nodes.slots, nodes.stage, nodes.opts, stats);
    document.body.append(root);
    grab(nodes.stage);
  }
  const nameOf = (s, id) => (s === 'camo' ? CAMO[id]?.name : s === 'charm' ? CHARM[id]?.name : id === 'none' ? SLOTS.find(x => x.id === s).none : ATTACHMENTS[id]?.name) || id;
  function drawHead() {
    nodes.name.replaceChildren(document.createTextNode(GUN[gun.id].name + ' '), el('span', 'gs-kind', GUN[gun.id].kind));
    const mine = guns.owned();
    nodes.guns.replaceChildren(...mine.map(id => {
      const b = el('button', id === gun.id ? 'on' : '', GUN[id].name);
      b.addEventListener('click', () => switchTo(id));
      return b;
    }));
    nodes.guns.style.display = mine.length > 1 ? '' : 'none';
  }
  function drawSlots() {
    nodes.slots.replaceChildren(...SLOTS.map((s, i) => {
      const b = el('button', 'gs-slot' + (slot === s.id ? ' on' : ''));
      b.append(el('i', '', String(i + 1)), el('small', '', s.name), el('b', '', nameOf(s.id, inSlot(kit, s.id))));
      b.addEventListener('click', () => pickSlot(slot === s.id ? 'all' : s.id));
      return b;
    }));
  }
  // The choices for the slot picked (or a word on what to do when none is).
  function choices(s) {
    if (s === 'camo') return CAMOS.map(c => c.id);
    if (s === 'charm') return CHARMS.map(c => c.id);
    return ['none', ...optionsFor(s)];
  }
  const itemOf = (s, id) => (s === 'camo' ? CAMO[id] : s === 'charm' ? CHARM[id] : null);
  function drawOpts() {
    if (slot === 'all') { nodes.opts.replaceChildren(el('em', 'gs-tip-in', 'Pick a slot to see what fits it.')); nodes.opts.firstChild.style.cssText = 'color:#8fa7ae;font-style:normal;font-weight:400;padding:8px'; return; }
    const now = inSlot(kit, slot), stars = guns.stars(), has = guns.has;
    nodes.opts.replaceChildren(...choices(slot).map(id => {
      const item = itemOf(slot, id), locked = item && !isOpen(item, stars, has);
      const b = el('button', 'gs-opt' + (id === now ? ' on' : '') + (locked ? ' locked' : ''));
      if (slot === 'camo') {
        if (!swatches.has(id)) swatches.set(id, camoSwatch(id) || Object.assign(el('i', 'gs-sw'), { style: 'background: linear-gradient(90deg, #15181c, #2a3036)' }));
        b.append(swatches.get(id));
      }
      b.append(el('span', '', nameOf(slot, id)), el('em', '', locked ? lockLine(item) : slot === 'camo' || slot === 'charm' ? (id === now ? 'On' : '') : id === 'none' ? 'Nothing fitted' : shortBlurb(id)));
      b.disabled = !!locked;
      if (!locked) {
        b.addEventListener('click', () => put(slot, id));
        b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { preview = id; drawStats(); } });
        b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && preview === id) { preview = null; drawStats(); } });
      }
      return b;
    }));
  }
  const shortBlurb = id => ({ light: 'Lights the way', suppressor: 'Quiet shots', holo: 'Quick to the aim', scope: `${ATTACHMENTS.scope.zoom[gun.id]}x zoom`, mag: `${ATTACHMENTS.mag.size[gun.id]} rounds` }[id] || '');
  // The bars: a hovered choice against what is on; otherwise the last change made, before and after.
  function drawStats() {
    let before = kit.att, after = kit.att, note = null;
    if (preview !== null && slot !== 'camo' && slot !== 'charm') { after = choose(kit, slot, preview).att; note = preview; }
    else if (lastChange) { before = lastChange.before; after = kit.att; note = lastChange.id; }
    const rows = compare(gun.id, before, after);
    nodes.rows.replaceChildren(...rows.map(r => {
      const row = el('div', 'gs-row' + (r.change > 0 ? ' up' : r.change < 0 ? ' down' : '')), value = el('b');
      if (r.change) value.append(el('u', '', r.fromText + ' '), el('em', '', '→ ' + r.toText)); else value.textContent = r.toText;
      const bar = el('div', 'gs-bar'), lo = Math.min(r.from, r.to), hi = Math.max(r.from, r.to);
      const base = el('i', 'base'); base.style.width = (lo * 100).toFixed(1) + '%';
      bar.append(base);
      if (r.change) { const d = el('i', r.change > 0 ? 'gain' : 'loss'); d.style.left = (lo * 100).toFixed(1) + '%'; d.style.width = ((hi - lo) * 100).toFixed(1) + '%'; bar.append(d); }
      row.append(el('span', '', r.name), value, bar);
      return row;
    }));
    const about = note && note !== 'none' && ATTACHMENTS[note] ? [ATTACHMENTS[note].name, BLURBS[note]] : slot === 'camo' ? ['Camo', 'A finish for this gun. Some are earned with stars at the range.'] : slot === 'charm' ? ['Charm', 'A little something on a chain. It swings as the gun moves.'] : null;
    nodes.blurb.replaceChildren(...(about ? [el('b', '', about[0]), document.createTextNode(about[1])] : [document.createTextNode('Every change goes on at once and is kept for this gun in this browser.')]));
  }
  function redraw() { drawHead(); drawSlots(); drawOpts(); drawStats(); }

  // ---------- changes ----------
  async function put(s, id) {
    const was = kit;
    kit = choose(kit, s, id);
    if (s !== 'camo' && s !== 'charm') lastChange = { before: was.att, id };
    preview = null;
    kits[gun.id] = kit;
    fitter.store.write(kits);
    drawSlots(); drawOpts(); drawStats();
    const g = gun;
    await fitter.dress(g, kit);
    if (g === gun && open) { onFit(); }
  }
  function pickSlot(s) {
    slot = s; preview = null;
    aimView(s);
    drawSlots(); drawOpts(); drawStats();
  }
  // The point a slot's view looks at, in the bench's space.
  // Each a little way along from its mount to where the piece itself is (in the gun's own space, x ahead, y up).
  const NUDGE = { muzzle: [0.06, 0, 0], optic: [0.01, 0.02, 0], rail: [0.02, -0.015, 0], mag: [0, 0, 0], charm: [0, -0.016, 0] };
  function focus(s) {
    const n = s === 'muzzle' ? gun.mounts.muzzle : s === 'optic' ? (gun.mounts.optic || gun.model.getObjectByName('P22_aim_holo')) : s === 'rail' ? gun.mounts.rail
      : s === 'mag' ? gun.part.mag : s === 'charm' ? gun.hook : null;
    if (!n) return centre.clone();
    spinner.updateMatrixWorld(true);
    const at = new THREE.Vector3(...NUDGE[s]).applyQuaternion(n.parent.getWorldQuaternion(new THREE.Quaternion())).add(n.getWorldPosition(new THREE.Vector3()));
    return pivot.worldToLocal(at);
  }
  function aimView(s) {
    const [yaw, pitch, span] = VIEWS[s] || VIEWS.all, zoom = span ? THREE.MathUtils.clamp(fit / span, 1.15, 4.5) : 1;
    // The nearest way round to the slot's turn.
    want.yaw = view.yaw + Math.atan2(Math.sin(yaw - view.yaw), Math.cos(yaw - view.yaw));
    want.pitch = pitch; want.zoom = zoom; want.at.copy(focus(s));
  }
  // A piece put on can change the gun's size; the gun keeps its place, the view keeps its framing.
  function onFit() { drawSlots(); }

  async function switchTo(id) {
    if (closing || id === gun?.id) return;
    const g = await guns.take(id);
    if (!g || !open) return;
    lend(g);
    redraw();
  }
  // The gun from the hand onto the bench: centred, the view framed to its length.
  function lend(g) {
    giveBack();
    gun = g; kit = kits[g.id]; slot = 'all'; preview = null; lastChange = null;
    // The bench's kit is the latest (taking the gun dressed it from what the range last read).
    fitter.dress(g, kit).then(ok => { if (ok && g === gun) drawSlots(); });
    home = g.model.parent;
    pivot.position.set(0, 0, 0); spinner.quaternion.identity();
    pivot.add(g.model);
    g.hands.right.root.visible = g.hands.left.root.visible = false;
    spinner.updateMatrixWorld(true);
    // Only what shows: the P-22's spare pieces and the magazine kept for dropping are hidden.
    box.makeEmpty();
    g.model.traverseVisible(o => { if (o.isMesh) { o.geometry.boundingBox || o.geometry.computeBoundingBox(); box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); } });
    box.getCenter(centre); box.getSize(size);
    pivot.position.copy(centre).negate();
    // A soft pool below, out of reach of the gun however it is turned.
    const reach = 0.5 * Math.max(size.x, size.y);
    floor.position.set(0, -reach - 0.01, 0); floor.scale.set(size.x * 1.3, size.x * 0.6, 1);
    fit = Math.max(size.x, 0.18);
    view.at.set(0, 0, 0);
    view.yaw = VIEWS.all[0] - 0.9; view.pitch = 0.35; view.zoom = 0.75;
    aimView('all');
  }
  function giveBack() {
    if (!gun) return;
    home?.add(gun.model);
    gun.hands.right.root.visible = gun.hands.left.root.visible = true;
    gun = null; home = null;
  }

  // ---------- turning and zooming ----------
  function grab(stage) {
    const pts = new Map();
    let pinch = 0, lastTap = 0, lastMove = 0;
    stage.addEventListener('pointerdown', e => {
      stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); stage.classList.add('drag'); spin = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
      const now = performance.now();
      if (now - lastTap < 320 && pts.size === 1) { pickSlot('all'); want.zoom = 1; }
      lastTap = now;
    });
    stage.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p[0], dy = e.clientY - p[1];
      p[0] = e.clientX; p[1] = e.clientY;
      if (pts.size === 1) { want.yaw -= dx * 0.0085; want.pitch = THREE.MathUtils.clamp(want.pitch + dy * 0.0065, -1.45, 1.45); spin = -dx * 0.0085; lastMove = performance.now(); }
      else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch > 0) want.zoom = THREE.MathUtils.clamp(want.zoom * d / pinch, 0.6, 4.5); pinch = d; }
    });
    // Held still before letting go is no flick.
    const up = e => { pts.delete(e.pointerId); if (!pts.size) stage.classList.remove('drag'); pinch = 0; if (performance.now() - lastMove > 80) spin = 0; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', e => { e.preventDefault(); want.zoom = THREE.MathUtils.clamp(want.zoom * Math.exp(-e.deltaY * 0.0012), 0.6, 4.5); }, { passive: false });
  }

  // The gun turned and the camera brought in, each eased toward where it is asked; the picture centred on the free stage.
  function place(dt) {
    view.yaw = damp(view.yaw, want.yaw, 9, dt); view.pitch = damp(view.pitch, want.pitch, 9, dt); view.zoom = damp(view.zoom, want.zoom, 8, dt);
    spinner.rotation.set(-view.pitch, view.yaw, 0, 'XYZ');
    spinner.updateMatrixWorld(true);
    target.copy(want.at).applyMatrix4(pivot.matrixWorld);
    view.at.x = damp(view.at.x, target.x, 7, dt); view.at.y = damp(view.at.y, target.y, 7, dt); view.at.z = damp(view.at.z, target.z, 7, dt);
    const W = innerWidth, H = innerHeight, r = nodes.stage.getBoundingClientRect(), sw = Math.max(80, r.width), sh = Math.max(80, r.height);
    camera.aspect = W / H;
    // The gun's length fills about three quarters of the stage's width (or its height allows less).
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), visW = sw / H * 2 * tanV, visH = sh / H * 2 * tanV;
    const dist = Math.max(fit / (0.78 * visW), (fit * 0.55) / (0.85 * visH)) / view.zoom;
    camera.position.set(view.at.x, view.at.y, view.at.z - dist);
    camera.lookAt(view.at);
    // Shifts the picture so its middle is the stage's middle, not the screen's.
    camera.setViewOffset(W, H, W / 2 - (r.left + sw / 2), H / 2 - (r.top + sh / 2), W, H);
    camera.updateProjectionMatrix();
    // The key light high over the viewer's left shoulder, the rim from behind the gun and above.
    key.position.set(view.at.x - 0.5, view.at.y + 0.9, view.at.z - 0.7); rim.position.set(view.at.x + 0.4, view.at.y + 0.7, view.at.z + 1);
    key.target.position.copy(view.at); rim.target.position.copy(view.at);
  }

  const api = {
    get open() { return open; },
    get gun() { return gun; },
    get kit() { return kit; },
    get slot() { return slot; },
    get view() { return { ...view, at: view.at.toArray() }; },
    // Opens on the gun in the hand.
    show(g) {
      if (open || !g) return false;
      if (!layered) { engine.addLayer({ scene, camera, clearDepth: true, on: () => open }); layered = true; }
      kits = fitter.store.read();
      if (!root) build();
      root.style.display = ''; document.body.classList.add('gs-on');
      open = true; closing = false;
      lend(g);
      redraw();
      fitter.loadKit().catch(() => {});
      return true;
    },
    close() {
      if (!open) return;
      closing = true; open = false;
      root.style.display = 'none'; document.body.classList.remove('gs-on');
      const g = gun;
      giveBack();
      onClose?.(g);
    },
    pick: pickSlot, put,
    // Keys on the bench: 1 to 6 pick a slot, the arrows step through its choices, R sets the view back.
    key(e, down) {
      // Keys the bench does not use stay the browser's (Ctrl+R, F5, Tab).
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (!down) return true;
      if (/^Digit[1-6]$/.test(e.code)) { const s = SLOTS[+e.code.slice(5) - 1].id; pickSlot(slot === s ? 'all' : s); return true; }
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && slot !== 'all') {
        const list = choices(slot).filter(id => !itemOf(slot, id) || isOpen(itemOf(slot, id), guns.stars(), guns.has)), i = list.indexOf(inSlot(kit, slot));
        put(slot, list[(i + (e.code === 'ArrowRight' ? 1 : list.length - 1)) % list.length]);
        return true;
      }
      if (e.code === 'KeyR') { pickSlot('all'); want.zoom = 1; return true; }
      return false;
    },
    tick(dt) {
      if (!open || !gun) return;
      // A flick keeps turning a moment after the finger lets go.
      if (!nodes.stage.classList.contains('drag') && Math.abs(spin) > 1e-4) { want.yaw += spin * Math.min(dt, 0.1) * 60; spin *= Math.exp(-6 * Math.min(dt, 0.1)); }
      place(Math.min(dt, 0.1));
      gun.swingCharm(Math.min(dt, 0.1));
    },
    hide() { root?.remove(); root = null; nodes = {}; },
  };
  return api;
}
