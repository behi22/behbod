import * as THREE from 'three';
import { b2t } from './engine.js';
import * as S from './pure/scope.js';
import { litFraction, BRIDGE, WATER_Y, wx, wz } from './pure/outside.js';
import { moonPhase, sunElev } from './pure/calendar.js';

// The balcony telescope: a round eyepiece onto the city, the mountains and the real sky, with labelled stops it swings
// to by itself. Somewhere up there is a moon that is not a moon, visible only through the eyepiece.
const CSS = `
.ts-veil { position: fixed; inset: 0; pointer-events: none; z-index: 30;
  background:
    radial-gradient(circle at calc(var(--cx) - var(--r) * .38) calc(var(--cy) - var(--r) * .42), rgba(255,255,255,.035), transparent calc(var(--r) * .55)),
    radial-gradient(circle at var(--cx) var(--cy), transparent 0, transparent calc(var(--r) * .74), rgba(0,0,0,.32) calc(var(--r) - 1px), transparent var(--r)),
    radial-gradient(circle at var(--cx) var(--cy), transparent 0, transparent calc(var(--r) - 1.5px), rgba(150,176,200,.55) var(--r), rgba(3,5,8,.97) calc(var(--r) + 3px), #000 calc(var(--r) + 30vmin)); }
.ts-dark { position: fixed; inset: 0; z-index: 32; background: #000; pointer-events: none; transition: opacity .45s ease-out; }
.ts-hud { position: fixed; inset: 0; z-index: 31; pointer-events: none; font: 500 12px/1.3 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #cfd8e6; }
.ts-read { position: absolute; left: var(--cx); top: calc(var(--cy) - var(--r) + 14px); transform: translateX(-50%); display: flex; gap: 14px; font-size: 11px; letter-spacing: .06em; color: rgba(214,224,238,.78); text-shadow: 0 1px 2px #000; white-space: nowrap; }
.ts-read b { color: #3ee6c4; font-weight: 700; }
.ts-cap { position: absolute; left: var(--cx); top: calc(var(--cy) + var(--r) * .6); transform: translateX(-50%); text-align: center; max-width: calc(var(--r) * 1.5); padding: 6px 12px; border-radius: 10px; background: rgba(4,7,11,.55); opacity: 0; transition: opacity .25s; }
.ts-cap.on { opacity: 1; }
.ts-cap b { display: block; font-size: 14px; color: #e8edf5; letter-spacing: .03em; }
.ts-cap span { display: block; font-size: 11px; color: rgba(200,212,228,.8); margin-top: 2px; }
.ts-tag { position: absolute; left: 0; top: 0; display: none; align-items: center; gap: 6px; font-size: 11px; color: rgba(232,237,245,.88); text-shadow: 0 1px 2px #000, 0 0 6px #000; white-space: nowrap; will-change: transform; }
.ts-tag::before { content: ''; width: 7px; height: 7px; border: 1.5px solid #3ee6c4; border-radius: 50%; flex: none; box-shadow: 0 0 6px rgba(62,230,196,.5); }
.ts-zoom { position: absolute; display: flex; flex-direction: column; gap: 8px; pointer-events: auto; }
.ts-zoom button, .ts-bar button { font: inherit; color: #e8edf5; background: rgba(8,12,18,.78); border: 1px solid rgba(255,255,255,.18); border-radius: 999px; cursor: pointer; touch-action: none; -webkit-tap-highlight-color: transparent; }
.ts-zoom button { width: 40px; height: 40px; font-size: 20px; line-height: 1; padding: 0; user-select: none; -webkit-user-select: none; }
.ts-bar { position: fixed; left: 0; right: 0; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); z-index: 31; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; font: 500 12px/1.3 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #cfd8e6; }
.ts-hint { font-size: 11px; color: rgba(190,202,220,.7); text-shadow: 0 1px 2px #000; padding: 0 16px; text-align: center; }
.ts-row { display: flex; align-items: center; gap: 8px; max-width: calc(100% - 32px); pointer-events: auto; }
.ts-row > button { padding: 7px 14px; flex: none; }
.ts-stops { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding: 2px 10px; mask-image: linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 10px), transparent); }
.ts-stops::-webkit-scrollbar { display: none; }
.ts-stops button { padding: 7px 12px; white-space: nowrap; flex: none; }
.ts-stops button.on { border-color: #3ee6c4; color: #3ee6c4; box-shadow: 0 0 10px rgba(62,230,196,.25); }
.ts-stops button i { font-style: normal; color: rgba(200,212,228,.55); margin-right: 6px; font-size: 10px; }
.ts-bar button:focus-visible, .ts-zoom button:focus-visible { outline: 2px solid #3ee6c4; outline-offset: 2px; }
body[data-mode="scope"] .touch, body[data-mode="scope"] .prompt { display: none; }
`;
const RAD = Math.PI / 180;
// The view starts at the front lens (the telescope point is the mount), and nothing nearer than this is drawn while
// looking through it: a real telescope cannot show its own tube, the railing or the string lights beside it.
const LENS = new THREE.Vector3(0.08, 0.4, -0.6), NEAR = 2.5;

// Places in the view: id, short name, full name, metres east and north of the window, height above the water, field.
const PLACES = [
  ['lions', 'The Lions', 'The Lions', -10025, 21375, 1560, 4],
  ['grouse', 'Grouse', 'Grouse Mountain', -350, 10100, 1040, 6],
  ['bridge', 'Lions Gate', 'Lions Gate Bridge', BRIDGE.cx, BRIDGE.cn, 78, 12],
  ['lonsdale', 'Lonsdale Quay', 'Lonsdale Quay', 430, 2400, 14, 5],
  ['seymour', 'Seymour', 'Mount Seymour', 6900, 12600, 1000, 7],
];
// What moves on the water and over it: which vessel of the world outside, short and full names, the height of its
// middle above the water, its length.
const CRAFT = [[0, 'Cruise ship', 'Cruise ship', 24, 300], [1, 'SeaBus', 'SeaBus', 3, 36], [2, 'Floatplane', 'Floatplane', 2, 16]];
const GROUP = { sky: 0, land: 1, water: 2 };

// `facing` is the way to the viewer: the dish sits in the upper half on that side.
function deathStar(facing) {
  const g = new THREE.Group();
  // Unlit like the rest of the loft, with the sun's side painted in: lit from up and to one side of the viewer.
  const sun = facing.clone().add(new THREE.Vector3(0.8, 0.9, 0)).normalize();
  const ball = new THREE.SphereGeometry(7, 48, 32), nrm = ball.attributes.normal, col = new Float32Array(nrm.count * 3);
  for (let i = 0; i < nrm.count; i++) { const k = 0.18 + 0.62 * Math.max(0, nrm.getX(i) * sun.x + nrm.getY(i) * sun.y + nrm.getZ(i) * sun.z); col.set([k, k * 1.02, k * 1.06], i * 3); }
  ball.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dark = new THREE.MeshBasicMaterial({ color: 0x2a2d33, fog: false });
  g.add(new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  const trench = new THREE.Mesh(new THREE.TorusGeometry(7.02, 0.12, 6, 96), dark);
  trench.rotation.x = Math.PI / 2; g.add(trench);
  const n = facing.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize();
  const dish = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), dark);
  dish.position.copy(n).multiplyScalar(7.12); dish.lookAt(n.clone().multiplyScalar(20)); g.add(dish);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 0.7), fog: false }));
  eye.position.copy(n).multiplyScalar(7.18); g.add(eye);
  return g;
}

// `sky` is the 3D outside's Death Star direction (kept up to date by it). A small one is drawn on that line too, in the
// loft's own scene, so it shows through the eyepiece even when clouds cover the real sky. `outside` is the 3D world
// outside, when it runs: the moon, the planets and the boats come from it.
export function makeTelescope(scene, camera, meta, { sky, outside, renderer, coarse, canvas, onSpot, onExit }) {
  const mount = b2t(...meta.points.telescope);
  const eye = mount.clone().add(LENS);
  // North of the balcony and well up the sky, a little east of straight ahead.
  const dir = sky || new THREE.Vector3(Math.sin(0.5) * Math.cos(0.42), Math.sin(0.42), -Math.cos(0.5) * Math.cos(0.42));
  const star = deathStar(dir.clone().negate());
  star.scale.setScalar(0.2);
  star.position.copy(eye).addScaledVector(dir, 110);
  star.visible = false;
  scene.add(star);

  let active = false, yaw = 0, pitch = 0.15, fov = S.FOV.start, fovT = S.FOV.start, onIt = 0, spotted = false;
  let fov0 = 55, near0 = 0.05, slew = null, slewT = 0, lock = null, zoomHeld = 0, zoomAt = 0, pinch = null, refreshIn = 0;
  let stops = [], planets = [], kit = null, kitAsked = false, layoutR = 300;
  let ui = null;
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), aimV = new THREE.Vector3();
  const step = { yaw: 0, pitch: 0, fov: 0, done: false };

  const now = () => (outside?.clock ? outside.clock() : new Date());
  // The deepest the eyepiece may go on what is in the middle of the view (see zoomFloor).
  const floor = () => S.zoomFloor(lock || S.inView(stops.filter(s => s.kind === 'sky'), yaw, pitch, fov, 0.5));
  const fit = f => S.clampFov(f, floor());
  const aimFromPoint = (p, s) => { tmp.copy(p).sub(eye); Object.assign(s, S.aimOf(tmp.x, tmp.y, tmp.z)); s.metres = tmp.length(); return s; };
  // Whether the downtown towers leave a clear line from the eyepiece to a point (the places never move, so once each).
  const seen = new Map();
  const inSight = (p, key) => {
    if (!outside?.towers) return true;
    if (key && seen.has(key)) return seen.get(key);
    const ok = S.clearLine(eye.toArray(), p.toArray(), outside.towers);
    if (key) seen.set(key, ok);
    return ok;
  };

  // Everything there is to swing to right now, in groups (sky, land, water) and left to right within each.
  function findStops() {
    const date = now(), list = [];
    const add = s => { if (S.reachable(s)) list.push(s); };
    if (outside) {
      const U = outside.U, m = U.uMoonDir.value, cloudy = U.uCloud.value > 0.8 || U.uFog.value > 0.5;
      const veiled = note => (cloudy ? `${note}, behind cloud` : note);
      if (m.y > Math.sin(1.5 * RAD)) add({ id: 'moon', kind: 'sky', short: 'Moon', name: 'The moon', note: veiled(`${Math.round(litFraction(moonPhase(date)) * 100)}% lit`), fov: 1.6, min: 0.6, dir: m.clone(), ...S.aimOf(m.x, m.y, m.z) });
      planets = kit ? S.planets(date, U.uLst.value) : [];
      const sun = sunElev(date);
      for (const p of planets) {
        p.shows = S.planetShows(p, sun);
        if (!p.shows) continue;
        const across = p.radius * 2 * (p.id === 'saturn' ? 2.3 : 1) * S.PLANET_SCALE / RAD;
        const note = p.id === 'jupiter' ? `${S.distance(p.metres)}, four of its moons beside it` : p.id === 'saturn' ? `${S.distance(p.metres)}, rings and all` : S.distance(p.metres);
        add({ id: p.id, kind: 'sky', short: p.name, name: p.name, note: veiled(note), fov: THREE.MathUtils.clamp(across * 6, S.FOV.sky, 0.6), dir: new THREE.Vector3(...p.dir), ...S.aimOf(...p.dir) });
      }
      for (const [i, short, name, up, len] of CRAFT) {
        const v = outside.vessels?.[i];
        if (!v?.on) continue;
        const s = { id: `craft${i}`, kind: 'water', short, name, craft: i, up, len };
        locate(s);
        // Seen whole: its middle and both ends clear of the towers (at the cruise berth a tower hides most of it).
        const along = tmp.set(Math.sin(v.heading || 0), 0, -Math.cos(v.heading || 0)).multiplyScalar(len * 0.42).clone();
        if (![0, 1, -1].every(k => inSight(s.point.clone().addScaledVector(along, k)))) continue;
        s.fov = S.fovFor(len, s.metres);
        add(s);
      }
    }
    for (const [id, short, name, dx, dn, h, f] of PLACES) {
      const point = new THREE.Vector3(wx(dx), WATER_Y + h, wz(dn));
      if (inSight(point, id)) add(aimFromPoint(point, { id, kind: 'land', short, name, fov: f, point }));
    }
    for (const s of list) if (!s.note) s.note = S.distance(s.metres);
    list.sort((a, b) => GROUP[a.kind] - GROUP[b.kind] || a.yaw - b.yaw);
    return list;
  }
  // A boat or the plane, wherever it is this moment.
  function locate(s) {
    const v = outside.vessels[s.craft];
    s.point = (s.point || new THREE.Vector3()).set(wx(v.dx), WATER_Y + (v.alt || 0) + s.up, wz(v.dn));
    aimFromPoint(s.point, s);
    s.note = S.distance(s.metres);
    return v.on;
  }

  function goTo(s) {
    if (!s) return;
    lock = s;
    slew = S.slewPlan({ yaw, pitch, fov }, { yaw: s.yaw, pitch: s.pitch, fov: s.fov });
    slewT = 0;
    fovT = s.fov;
    paintStops();
  }
  function stepStop(by) {
    if (!stops.length) return;
    const at = lock ? stops.findIndex(s => s.id === lock.id) : -1;
    const i = at < 0 ? (by > 0 ? 0 : stops.length - 1) : (at + by + stops.length) % stops.length;
    goTo(stops[i]);
  }
  // The person takes over: a swing stops where it is, and nothing is followed any more.
  function takeOver() {
    if (slew) { fovT = fov; slew = null; }
    if (lock) { lock = null; paintStops(); }
  }
  function zoomTo(target) {
    if (slew) takeOver();
    fovT = fit(target);
  }

  // ---------- the page: the eyepiece, its readouts, the stops ----------
  function layout() {
    if (!ui) return;
    const w = innerWidth, h = innerHeight;
    layoutR = Math.max(90, Math.min(0.44 * Math.min(w, h), h / 2 - 76));
    for (const el of [ui.veil, ui.hud]) {
      el.style.setProperty('--cx', `${w / 2}px`); el.style.setProperty('--cy', `${h / 2}px`); el.style.setProperty('--r', `${layoutR}px`);
    }
    // The zoom buttons sit beside the eyepiece when there is room, else in the corner above the stops.
    const side = w / 2 + layoutR + 18;
    if (w - side > 56) Object.assign(ui.zoom.style, { left: `${side}px`, top: `${h / 2 - 44}px`, right: '', bottom: '' });
    else Object.assign(ui.zoom.style, { left: '', top: '', right: 'calc(16px + env(safe-area-inset-right, 0px))', bottom: `calc(${coarse ? 84 : 96}px + env(safe-area-inset-bottom, 0px))` });
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  // A tap on a zoom button is one step; held, it keeps zooming after a moment.
  function holdZoom(button, dirn) {
    const end = () => { if (!zoomHeld) return; if (performance.now() - zoomAt < 220) zoomTo(fovT * (dirn < 0 ? 1 / 1.5 : 1.5)); zoomHeld = 0; };
    button.addEventListener('pointerdown', e => { e.preventDefault(); zoomHeld = dirn; zoomAt = performance.now(); if (slew) takeOver(); });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(t, end);
    button.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomTo(fovT * (dirn < 0 ? 1 / 1.5 : 1.5)); } });
  }
  function build() {
    if (!document.getElementById('ts-css')) { const s = document.createElement('style'); s.id = 'ts-css'; s.textContent = CSS; document.head.append(s); }
    const veil = el('div', 'ts-veil'), dark = el('div', 'ts-dark'), hud = el('div', 'ts-hud'), bar = el('div', 'ts-bar');
    const read = el('div', 'ts-read'), pow = el('b'), brg = el('span'), alt = el('span');
    read.append(pow, brg, alt);
    const cap = el('div', 'ts-cap'), capName = el('b'), capNote = el('span');
    cap.setAttribute('aria-live', 'polite'); cap.append(capName, capNote);
    const zoom = el('div', 'ts-zoom'), zin = el('button', null, '+'), zout = el('button', null, '−');
    zin.setAttribute('aria-label', 'Zoom in'); zout.setAttribute('aria-label', 'Zoom out');
    holdZoom(zin, -1); holdZoom(zout, 1);
    zoom.append(zin, zout);
    const tags = [];
    for (let i = 0; i < 8; i++) { const t = el('div', 'ts-tag'); tags.push(t); hud.append(t); }
    hud.append(read, cap, zoom);
    const hint = el('div', 'ts-hint', coarse ? 'Drag to look, pinch to zoom, tap a stop' : 'Drag or arrow keys to look, scroll to zoom, [ and ] to step through the stops, E to leave');
    const row = el('div', 'ts-row'), leave = el('button', null, 'Leave'), list = el('div', 'ts-stops');
    list.setAttribute('role', 'toolbar'); list.setAttribute('aria-label', 'Stops');
    leave.addEventListener('click', () => api.exit());
    row.append(leave, list);
    bar.append(hint, row);
    document.body.append(veil, hud, bar, dark);
    ui = { veil, dark, hud, bar, read, pow, brg, alt, cap, capName, capNote, zoom, tags, list, shown: '', capFor: '' };
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (ui) ui.dark.style.opacity = '0'; }));
  }
  function paintStops() {
    if (!ui) return;
    const key = stops.map(s => s.id).join(',');
    if (key !== ui.shown) {
      ui.shown = key;
      ui.list.replaceChildren(...stops.map((s, i) => {
        const b = el('button');
        b.dataset.id = s.id;
        if (!coarse && i < 9) b.append(el('i', null, String(i + 1)));
        b.append(s.short);
        b.title = s.name;
        b.addEventListener('click', () => goTo(stops.find(x => x.id === s.id)));
        return b;
      }));
    }
    for (const b of ui.list.children) {
      const on = !!lock && b.dataset.id === lock.id;
      if (b.classList.contains('on') !== on) {
        b.classList.toggle('on', on);
        if (on) ui.list.scrollTo({ left: b.offsetLeft - ui.list.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });
      }
    }
  }
  // Names next to whatever is in the eyepiece, and the one in the middle written out underneath.
  function paintView() {
    const w = innerWidth, h = innerHeight, cx = w / 2, cy = h / 2;
    ui.pow.textContent = `${S.power(fov)}x`;
    ui.brg.textContent = S.bearing(yaw);
    ui.alt.textContent = S.altitude(pitch);
    const centre = S.inView(stops, yaw, pitch, fov, 0.3);
    const capFor = centre ? `${centre.name}|${centre.note}` : '';
    if (capFor !== ui.capFor) {
      ui.capFor = capFor;
      if (centre) { ui.capName.textContent = centre.name; ui.capNote.textContent = centre.note; }
      ui.cap.classList.toggle('on', !!centre);
    }
    camera.getWorldDirection(fwd);
    let n = 0;
    for (const s of stops) {
      if (n >= ui.tags.length) break;
      if (s === centre) continue;
      if (s.dir) aimV.copy(eye).addScaledVector(s.dir, 100); else aimV.copy(s.point);
      tmp.copy(aimV).sub(eye);
      if (tmp.dot(fwd) <= 0) continue;
      aimV.project(camera);
      const x = (aimV.x + 1) / 2 * w, y = (1 - aimV.y) / 2 * h;
      if (Math.hypot(x - cx, y - cy) > layoutR - 12) continue;
      const t = ui.tags[n++];
      if (t.textContent !== s.short) t.textContent = s.short;
      t.style.display = 'flex';
      t.style.transform = `translate(${x - 5}px, ${y - 7}px)`;
    }
    for (; n < ui.tags.length; n++) ui.tags[n].style.display = 'none';
  }

  // Two fingers on the glass zoom; while they are down the one-finger drag is ignored.
  const fingers = new Map();
  const onDown = e => { if (e.pointerType !== 'touch') return; fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (fingers.size === 2) { const [a, b] = [...fingers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, fov: fovT }; takeOver(); } };
  const onMove = e => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size >= 2) { const [a, b] = [...fingers.values()]; fovT = fit(pinch.fov * pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1)); }
  };
  const onUp = e => { fingers.delete(e.pointerId); if (fingers.size < 2) pinch = null; };

  const api = {
    get active() { return active; },
    get fov() { return fov; },
    get stops() { return stops; },
    get target() { return lock?.id ?? null; },
    get aim() { return { yaw, pitch, fov }; },
    get kitReady() { return !!kit; },
    get kit() { return kit; },
    enter() {
      active = true; star.visible = true; yaw = 0; pitch = 0.15; onIt = 0;
      fov = fovT = S.FOV.start; slew = null; lock = null; zoomHeld = 0; pinch = null; fingers.clear();
      fov0 = camera.fov; near0 = camera.near; camera.near = NEAR;
      // The planets and the close-up city are only fetched the first time someone looks through.
      if (!kitAsked && outside) {
        kitAsked = true;
        import('./scopekit.js').then(m => { kit = m.makeScopeKit({ outside, renderer }); refreshIn = 0; }).catch(e => console.warn('[loft] the telescope kit could not load', e));
      }
      build();
      stops = findStops(); refreshIn = 0.5;
      paintStops();
      addEventListener('resize', layout);
      canvas?.addEventListener('pointerdown', onDown); canvas?.addEventListener('pointermove', onMove);
      for (const t of ['pointerup', 'pointercancel']) canvas?.addEventListener(t, onUp);
      api.tick(0);
    },
    exit() {
      if (!active) return;
      active = false; star.visible = false; zoomHeld = 0; pinch = null; fingers.clear();
      kit?.show(false);
      camera.fov = fov0; camera.near = near0; camera.updateProjectionMatrix();
      removeEventListener('resize', layout);
      canvas?.removeEventListener('pointerdown', onDown); canvas?.removeEventListener('pointermove', onMove);
      for (const t of ['pointerup', 'pointercancel']) canvas?.removeEventListener(t, onUp);
      if (ui) for (const e of [ui.veil, ui.hud, ui.bar, ui.dark]) e.remove();
      ui = null;
      onExit();
    },
    // Arrow keys: a share of the field each second, so it feels the same at any zoom. Nothing pressed, nothing changes.
    nudge(dx, dy) {
      if (!dx && !dy) return;
      takeOver();
      const k = fov / S.FOV.start;
      const a = S.clampAim({ yaw: yaw + dx * k, pitch: pitch + dy * k });
      yaw = a.yaw; pitch = a.pitch;
    },
    // A drag moves the view with the finger, one to one, whatever the zoom.
    drag(dx, dy) {
      if (pinch || (!dx && !dy)) return;
      takeOver();
      const k = fov * RAD / (2 * layoutR);
      const a = S.clampAim({ yaw: yaw - dx * k, pitch: pitch + dy * k });
      yaw = a.yaw; pitch = a.pitch;
    },
    // A mouse wheel notch is about 100; a trackpad sends many small ones, so the zoom follows it smoothly.
    wheel(dy, mode = 0) { zoomTo(fovT * Math.exp(THREE.MathUtils.clamp(dy * (mode === 1 ? 33 : mode === 2 ? 400 : 1), -400, 400) * 0.0013)); },
    zoom(stepBy) { zoomTo(fovT * (stepBy > 0 ? 1.25 : 0.8)); },
    goTo(id) { goTo(stops.find(s => s.id === id)); },
    // The telescope's own keys; true when it used the key.
    key(e) {
      if (e.code === 'Equal' || e.code === 'NumpadAdd') { api.zoom(-1); return true; }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') { api.zoom(1); return true; }
      if (e.repeat) return /^(Bracket|Digit|Comma|Period)/.test(e.code);
      if (e.code === 'BracketRight' || e.code === 'Period') { stepStop(1); return true; }
      if (e.code === 'BracketLeft' || e.code === 'Comma') { stepStop(-1); return true; }
      const d = /^Digit([1-9])$/.exec(e.code);
      if (d) { goTo(stops[+d[1] - 1]); return true; }
      return false;
    },
    view(out, aim) {
      fwd.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      out.copy(eye); aim.copy(eye).add(fwd);
    },
    tick(dt) {
      if (!active) return;
      if ((refreshIn -= dt) <= 0) {
        refreshIn = 0.5;
        const was = lock?.id;
        stops = findStops();
        // The stop being followed is the fresh one now; a boat that has docked out of sight lets go.
        lock = was ? stops.find(s => s.id === was) || (slew ? lock : null) : null;
        paintStops();
      }
      if (zoomHeld && performance.now() - zoomAt > 220) fovT = fit(fovT * Math.exp(zoomHeld * 1.7 * dt));
      if (slew) {
        if (lock?.craft !== undefined && outside) locate(lock);
        slewT += dt;
        // A moving stop is chased: the swing's end is moved to where it is now.
        if (lock) { slew.dyaw = S.wrap(lock.yaw - slew.from.yaw); slew.dpitch = lock.pitch - slew.from.pitch; }
        S.slewAt(slew, slewT, step);
        yaw = step.yaw; pitch = step.pitch; fov = step.fov;
        if (step.done) { slew = null; fovT = fov; }
      } else {
        if (lock) {
          if (lock.craft !== undefined && outside) locate(lock);
          const a = S.clampAim(lock);
          const k = 1 - Math.exp(-dt * 8);
          yaw += S.wrap(a.yaw - yaw) * k; pitch += (a.pitch - pitch) * k;
        }
        // Off the sky the deep eyepiece is put away again.
        fovT = fit(fovT);
        fov = S.easeFov(fov, fovT, dt);
      }
      const h = innerHeight, half = Math.atan(Math.tan(fov * RAD / 2) * h / (2 * layoutR));
      const camFov = THREE.MathUtils.clamp(2 * half / RAD, 0.05, 100);
      if (Math.abs(camera.fov - camFov) > 1e-6) { camera.fov = camFov; camera.updateProjectionMatrix(); }
      api.view(camera.position, tmp);
      camera.lookAt(tmp);
      camera.updateMatrixWorld();
      star.position.copy(eye).addScaledVector(dir, 110);
      // Hold it in the middle of the eyepiece, zoomed in, for a moment to spot it.
      onIt = fwd.angleTo(dir) < fov * 0.3 * RAD && fov <= 8 ? onIt + dt : 0;
      if (onIt > 0.6 && !spotted) { spotted = true; onSpot(); }
      kit?.update(planets, now(), true);
      if (ui) paintView();
    },
  };
  return api;
}
