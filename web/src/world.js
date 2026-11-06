import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from './engine.js';

const EMISSIVE = { E_purple: [0.55, 0.15, 1.0, 3.2], E_teal: [0.1, 0.9, 0.8, 3.0], E_warm: [1.0, 0.62, 0.3, 2.6], E_onair: [1.0, 0.1, 0.07, 3.0],
  E_led_green: [0.25, 1.0, 0.45, 3.5], E_led_blue: [0.25, 0.55, 1.0, 3.5], E_aria_eye: [0.25, 1.0, 0.85, 3.2], E_warm_soft: [1.0, 0.75, 0.45, 2.4], E_bias: [0.35, 0.45, 1.0, 2.6],
  E_fire: [1.0, 0.45, 0.12, 3.4], E_holo: [0.25, 0.75, 1.0, 2.6], E_aqua: [0.15, 0.55, 0.8, 1.6], E_sky: [0.12, 0.17, 0.32, 1.6], E_screen: [0.55, 0.7, 1.0, 1.0] };
const DIM = new Set(['paper', 'oak', 'white', 'felt', 'kit_white']);
const isScreen = n => n.startsWith('screen_') || n === 'backdrop' || n === 'postit' || n === 'onair' || n === 'desk_mat' || n === 'neon';
const screenKey = n => (n === 'desk_mat' ? 'mat' : n.replace('screen_', '').replace(/_b$/, ''));

// Lava lamp glass: slow rising and sinking wax blobs.
function lavaMaterial(o) {
  o.geometry.computeBoundingBox();
  const bb = o.geometry.boundingBox;
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, y0: { value: bb.min.y }, h: { value: bb.max.y - bb.min.y } },
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time, y0, h; varying vec3 vP;
      void main() {
        float v = (vP.y - y0) / h, u = atan(vP.z, vP.x) / 6.2832;
        float f = 0.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float cy = 0.5 + 0.42 * sin(time * (0.11 + fi * 0.03) + fi * 1.7);
          float cu = fract(fi * 0.37 + time * 0.01);
          vec2 d = vec2(min(abs(u - cu), 1.0 - abs(u - cu)) * 1.6, v - cy);
          f += 0.012 / (dot(d, d) + 0.004);
        }
        vec3 liquid = vec3(0.35, 0.05, 0.12), wax = vec3(2.2, 0.75, 0.25);
        gl_FragColor = vec4(mix(liquid, wax, smoothstep(0.9, 1.4, f)), 1.0);
      }`,
  });
}

// Merges meshes that share a colour into one, in the space of `parent` (geometry already placed by `place`).
function mergeByColour(parent, meshes, place) {
  const buckets = new Map(), rest = [];
  for (const o of meshes) {
    const m = o.material;
    if (!m.isMeshBasicMaterial || m.map || m.transparent) { rest.push(o); continue; }
    const k = m.color.getHexString();
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  }
  const out = [];
  for (const list of buckets.values()) {
    if (list.length < 2) { rest.push(...list); continue; }
    const geos = list.map(o => {
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(place(o));
      for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
      return g;
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos), list[0].material);
    mesh.name = 'merged_' + list[0].name;
    parent.add(mesh);
    for (const o of list) { o.parent?.remove(o); o.geometry.dispose(); }
    for (const g of geos) g.dispose();
    out.push(mesh);
  }
  return { merged: out, rest };
}

// Turns a set of loose meshes into one group pivoting about a point, so a door or a ship moves as one piece, with
// the pieces that share a colour merged inside it.
function gather(scene, meshes, pivot) {
  const g = new THREE.Group();
  g.position.copy(pivot);
  scene.add(g);
  const toLocal = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
  for (const m of meshes) { m.updateMatrixWorld(); const w = m.matrixWorld.clone(); g.add(m); m.matrix.copy(w).premultiply(toLocal); m.matrix.decompose(m.position, m.quaternion, m.scale); }
  mergeByColour(g, meshes.filter(m => !m.name.startsWith('screen_')), o => { o.updateMatrix(); return o.matrix; });
  return g;
}

// The zones' baked geometry plus everything lit or moved at runtime.
export function makeWorld(scene, zones, meta, screens, onDoor) {
  const emits = {}, leds = [], clockHands = {}, aria = {}, pcGlow = [], deskThings = [], lavas = [], loose = [], baked = [];
  let dayK = 0;
  let mirrorMesh = null;
  for (const z of zones) {
    scene.add(z);
    z.traverse(o => {
      if (!o.isMesh) return;
      loose.push(o);
      const m = o.material, name = o.name;
      if (name.endsWith('_baked')) {
        o.material = new THREE.MeshBasicMaterial({ map: m.map, fog: true });
        baked.push(o.material);
        o.material.map.anisotropy = 4;
      } else if (name === 'lava_glass') {
        o.material = lavaMaterial(o);
        lavas.push(o);
      } else if (name === 'mirror') {
        mirrorMesh = o;
      } else if (isScreen(name)) {
        const key = screenKey(name);
        const k = name === 'postit' ? 0.95 : name === 'backdrop' ? 1 : name === 'desk_mat' ? 0.62 : name === 'neon' ? 1.7 : DIM.has(m.name) ? 0.8 : 1.25;
        o.material = new THREE.MeshBasicMaterial({ map: screens.textures[key] || null, color: new THREE.Color(k, k, k), fog: name !== 'backdrop' });
        if (!screens.textures[key]) console.warn('[loft] no canvas for screen', key);
        if (name === 'onair') o.material.color.setScalar(2.2);
        // The nastaliq is light on the wall itself: only the glowing letters show.
        if (key === 'nastaliq') Object.assign(o.material, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      } else if (m.name?.startsWith('G_')) {
        const water = name === 'aqua_water';
        o.material = new THREE.MeshBasicMaterial({ color: water ? 0x1f7fa8 : 0x9fb6d8, transparent: true, opacity: name === 'window_glass' ? 0.05 : water ? 0.3 : 0.12, depthWrite: false, fog: true, side: THREE.DoubleSide });
        o.renderOrder = 2;
      } else if (EMISSIVE[m.name]) {
        const [r, g, b, k] = EMISSIVE[m.name];
        o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(r * k, g * k, b * k), fog: true });
        (emits[m.name] ||= []).push(o.material);
        if (name.startsWith('led_')) leds.push(o);
        if (name.startsWith('aria_eye')) (aria.eyes ||= []).push(o);
        if (name === 'aria_tip') aria.tip = o;
      } else if (name.startsWith('clock_')) {
        o.material = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
        clockHands[name] = o;
      } else {
        // Loose pieces that move (doors, ships, BH-22) aren't baked, so give them a little lift.
        o.material = new THREE.MeshBasicMaterial({ color: (m.color || new THREE.Color(0.2, 0.2, 0.2)).clone().multiplyScalar(0.55), fog: true });
      }
      // Each PC light remembers which RGB channel it follows: a (purple), b (teal) or c (the coolant).
      if (/^(fan\d|coolant_tube|cpu_block|gpu\d_led|ram\d_led)$/.test(name)) pcGlow.push([o.material, o.material.color.clone(), /^(coolant_tube|cpu_block)$/.test(name) ? 'c' : m.name === 'E_purple' ? 'a' : 'b']);
      if (/^(screen_(main|code|top|contrib|loss|pishi|laptop|timer)|kb_|monitor|mini_case|desk_mat|mouse)/.test(name)) deskThings.push(o);
    });
  }
  const named = prefix => loose.filter(o => o.name.startsWith(prefix));

  // Lights only touch the character; the loft's light is baked.
  let rgbLight = null;
  for (const l of meta.lights) {
    if (l.kind === 'hemi') { scene.add(new THREE.HemisphereLight(l.sky, l.ground, l.power)); continue; }
    const light = l.kind === 'sun' ? new THREE.DirectionalLight(l.color, l.power) : new THREE.PointLight(l.color, l.power, l.range, 2);
    light.position.copy(b2t(...l.at));
    scene.add(light);
    if (l.role === 'rgb') rgbLight = light;
  }
  // The studio's RGB: light scenes from the terminal, holiday colours by default on a holiday, a green sweep on DEPLOY.
  const SCENES = { chill: [[0.55, 0.15, 1.0], [0.1, 0.9, 0.8]], focus: [[0.35, 0.45, 1.0], [0.75, 0.9, 1.0]], matchday: [[0.1, 0.85, 0.25], [0.95, 0.95, 0.95]], off: [[0.01, 0.01, 0.01], [0.01, 0.01, 0.01]], party: null };
  const COOLANT = { teal: [0.1, 0.9, 0.8], purple: [0.55, 0.15, 1.0], red: [1.0, 0.12, 0.1], gold: [1.0, 0.7, 0.15], white: [0.9, 0.95, 1.0] };
  const pcFam = new Set(pcGlow.map(([m]) => m));
  const holidayRGB = screens.holiday ? [new THREE.Color(screens.holiday.c.hot), new THREE.Color(screens.holiday.c.a2)] : null;
  let sceneName = holidayRGB ? 'holiday' : 'chill', deployUntil = 0;
  function paintRGB(a, b) {
    for (const m of emits.E_purple || []) if (!pcFam.has(m)) m.color.copy(a).multiplyScalar(3.2);
    for (const m of emits.E_teal || []) if (!pcFam.has(m)) m.color.copy(b).multiplyScalar(3.0);
    for (const g of pcGlow) if (g[2] !== 'c') g[1].copy(g[2] === 'a' ? a : b).multiplyScalar(3.2);
    rgbLight?.color.copy(a);
  }
  const rgb = v => new THREE.Color(v[0], v[1], v[2]);
  function applyScene() {
    if (sceneName === 'holiday') paintRGB(...holidayRGB);
    else if (SCENES[sceneName]) paintRGB(rgb(SCENES[sceneName][0]), rgb(SCENES[sceneName][1]));
  }
  applyScene();
  named('holiday_thing').forEach((o, i) => { o.visible = !!screens.holiday && i === (screens.holiday.id.length % 4); });

  // The live mirror in the dressing area.
  let mirror = null;
  if (mirrorMesh && meta.screens.mirror) {
    const s = meta.screens.mirror;
    mirror = new Reflector(new THREE.PlaneGeometry(s.w, s.h), { textureWidth: 512, textureHeight: 1024, clipBias: 0.003, color: 0x8a919c });
    // Face the way the mirror's wall faces: -X (west) or +Y (north, three's -z).
    const facesNorth = s.normal === '+Y';
    mirror.position.copy(b2t(...s.center)).add(facesNorth ? new THREE.Vector3(0, 0, -0.004) : new THREE.Vector3(-0.004, 0, 0));
    mirror.rotation.y = facesNorth ? Math.PI : -Math.PI / 2;
    scene.add(mirror);
    mirrorMesh.visible = false;
  }

  // Doors swing about their hinge; their collider is switched off while open.
  const doors = {};
  // Doors either swing about a hinge (pivot, swing degrees) or slide (slide, a Blender-axes offset). A door with `auto`
  // opens by itself while you are within that many metres of it.
  for (const d of meta.doors || []) {
    const parts = named(d.parts);
    const pivot = d.pivot || d.at;
    // Doors start shut and solid, as the collision starts; onDoor fires only when that changes.
    doors[d.id] = { ...d, group: gather(scene, parts, b2t(...pivot)), home: b2t(...pivot), open: false, k: 0, solid: true };
  }
  // The X-wing and TIE chase each other round the void, the record spins, the gull and BH-22 idle.
  const F = meta.fighters;
  const fighters = F ? { x: gather(scene, named('ship_xwing'), b2t(...F.xwing)), t: gather(scene, named('ship_tie'), b2t(...F.tie)), ...F } : null;
  const platter = named('platter').concat(named('record'), named('screen_nowplaying'));
  const spin = platter.length && meta.points.platter ? gather(scene, platter, b2t(...meta.points.platter)) : null;
  const gull = meta.points.gull ? gather(scene, named('gull_'), b2t(...meta.points.gull)) : null;
  // The 3D printer's head runs back and forth while its print slowly grows.
  const printHead = named('printer_head')[0], printPart = named('printer_print')[0];
  const headX = printHead?.position.x ?? 0;
  const wardrobeDoors = named('wardrobe_door').concat(named('wardrobe_handle')).map(o => ({ o, x: o.position.x, side: o.name.endsWith('-1') ? -1 : 1 }));
  let wardrobeOpen = 0, wardrobeK = 0;
  const fish = named('fish').map((o, i) => ({ o, x: o.position.x, ph: i * 1.7 }));
  const fire = emits.E_fire || [];
  // Unlocks wait dimmed on their stands until earned.
  const unlockParts = (meta.unlocks || []).map(u => ({ id: u.id, parts: named(u.parts).filter(o => o.material.color).map(o => [o, o.material.color.clone()]) }));
  function showUnlocks(ids) { for (const u of unlockParts) for (const [o, c] of u.parts) o.material.color.copy(c).multiplyScalar(ids.includes(u.id) ? 1 : 0.35); }
  showUnlocks([]);
  // DEPLOY dips when pressed; the desk fan spins (the cage is baked, the blades are added here).
  const deployBtn = named('deploy_btn')[0], deployBase = deployBtn?.material.color.clone();
  const cage = named('fan_cage')[0];
  let blades = null, fanOn = true;
  if (cage) {
    blades = new THREE.Group();
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.48, 0.5, 0.53), fog: true });
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.055, 0.018), bm); b.position.y = 0.03; const arm = new THREE.Group(); arm.rotation.x = i * Math.PI * 2 / 3; arm.add(b); blades.add(arm); }
    cage.updateMatrixWorld(true);
    blades.position.setFromMatrixPosition(cage.matrixWorld);
    scene.add(blades);
  }
  let ariaK = 0, spinning = false;

  // The rack's LEDs blink in seven groups (one draw call each) rather than one by one.
  const ledGroups = [];
  for (let k = 0; k < 7; k++) {
    const mine = leds.filter((_, i) => i % 7 === k);
    ledGroups.push(...mergeByColour(scene, mine, o => { o.updateMatrixWorld(true); return o.matrixWorld; }).merged.map(mesh => ({ mesh, k })));
  }

  // Static pieces that share a look are drawn together: one draw call per colour instead of one per piece.
  const keep = new Set([...leds, ...deskThings, ...(aria.eyes || []), aria.tip, ...lavas, ...Object.values(clockHands), ...pcGlow.map(([m]) => m), mirrorMesh, deployBtn, cage]);
  const pinned = o => keep.has(o) || keep.has(o.material) || o.parent?.isGroup && o.parent.parent === scene && !zones.includes(o.parent);
  const buckets = new Map();
  for (const o of loose) {
    const m = o.material;
    if (!o.parent || o.name.endsWith('_baked') || isScreen(o.name) || !m.isMeshBasicMaterial || m.map || m.transparent || pinned(o) || /^(holiday_thing|unlock_|fish)/.test(o.name)) continue;
    const k = m.color.getHexString() + (m.fog ? 'f' : '');
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  }
  let merged = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    mergeByColour(scene, list, o => { o.updateMatrixWorld(true); return o.matrixWorld; });
    merged += list.length;
  }
  // Nothing in the baked zones moves except the pieces listed here, so every other matrix is worked out once instead of
  // every frame (walking the scene graph was a steady few percent of each frame on a slow machine).
  const moving = new Set([printHead, printPart, ...wardrobeDoors.map(w => w.o), ...fish.map(f => f.o), ...(aria.eyes || []), aria.tip,
    ...Object.values(clockHands), deployBtn].filter(Boolean));
  const freeze = o => { if (moving.has(o)) return; o.updateMatrix(); o.matrixAutoUpdate = false; };
  for (const z of zones) z.traverse(freeze);
  for (const o of scene.children) if (o.name.startsWith('merged_')) freeze(o);

  // Small, subtle reflections: the studio floor mirrors only the bright things (screens, LEDs, lamps), softly.
  let floorGloss = null;
  let liveMirror = true;
  function setGloss(on) {
    if (!on) { if (floorGloss) { scene.remove(floorGloss); floorGloss.dispose(); floorGloss = null; } return; }
    if (floorGloss || !meta.gloss) return;
    const gl = meta.gloss;
    floorGloss = new Reflector(new THREE.PlaneGeometry(gl.w, gl.d), {
      textureWidth: Math.round(innerWidth * 0.35), textureHeight: Math.round(innerHeight * 0.35), clipBias: 0.003, color: 0xffffff,
      shader: {
        name: 'FloorGloss', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
        vertexShader: Reflector.ReflectorShader.vertexShader,
        fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv;
          void main() { vec4 base = texture2DProj(tDiffuse, vUv); gl_FragColor = vec4(max(base.rgb - 0.6, 0.0) * 0.4 * color, 1.0); }`,
      },
    });
    floorGloss.material.transparent = true;
    floorGloss.material.blending = THREE.AdditiveBlending;
    floorGloss.material.depthWrite = false;
    floorGloss.rotation.x = -Math.PI / 2;
    floorGloss.position.copy(b2t(...gl.center));
    scene.add(floorGloss);
  }

  // Steam rising from the tea.
  const STEAM = 16, tea = meta.points.tea ? b2t(...meta.points.tea) : null;
  const steamPos = new Float32Array(STEAM * 3), steamAge = Float32Array.from({ length: STEAM }, (_, i) => i / STEAM);
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
  if (tea) scene.add(new THREE.Points(steamGeo, new THREE.PointsMaterial({ size: 0.035, color: 0x9aa4b4, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })));

  // Dust motes drifting slowly through the light in the double-height part of the loft.
  const MOTES = 420, motePos = new Float32Array(MOTES * 3), moteSeed = Float32Array.from({ length: MOTES }, (_, i) => (i * 0.618) % 1);
  for (let i = 0; i < MOTES; i++) motePos.set([1 + ((i * 7.31) % 14), 0.4 + ((i * 3.17) % 5), -(4 + ((i * 5.13) % 7.5))], i * 3);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  scene.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.014, color: 0xffe6c0, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })));

  const clockFmt = {};
  let clockAt = -1;
  // The hands only need the time once a second; asking for it every frame was a steady cost.
  function tickClocks(t) {
    if (t - clockAt < 1) return;
    clockAt = t;
    for (const [nm, tz] of [['van', 'America/Vancouver'], ['teh', 'Asia/Tehran']]) {
      clockFmt[tz] ||= new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
      const p = clockFmt[tz].formatToParts(new Date());
      const h = +p.find(x => x.type === 'hour').value, m = +p.find(x => x.type === 'minute').value;
      if (clockHands[`clock_${nm}_h`]) clockHands[`clock_${nm}_h`].rotation.x = -((h % 12) + m / 60) / 12 * Math.PI * 2;
      if (clockHands[`clock_${nm}_m`]) clockHands[`clock_${nm}_m`].rotation.x = -m / 60 * Math.PI * 2;
    }
  }

  // busy: I'm at the computer, so the PC's lights pulse harder.
  function tick(dt, t, busy, cam, player, others = []) {
    for (const { mesh, k } of ledGroups) mesh.visible = Math.sin(t * (2 + k) + k * 1.7) > -0.6;
    // The live mirror draws the room a second time, so on the low setting it shows as plain glass instead.
    if (mirror && cam) { const on = liveMirror && cam.distanceTo(mirror.position) < 7; mirror.visible = on; if (mirrorMesh) mirrorMesh.visible = !on; }
    // Aria dozes with her eyes half shut, and wakes up when I sit down at the desk.
    ariaK += ((busy ? 1 : 0) - ariaK) * Math.min(1, dt * 2);
    if (aria.eyes) { const blink = (t % 4.2) < 0.12; for (const e of aria.eyes) e.scale.y = blink ? 0.15 : 0.3 + 0.7 * ariaK; }
    if (aria.tip) { const k = (1.2 + 0.8 * ariaK) + Math.sin(t * (1.5 + 2 * ariaK)) * (0.5 + 0.5 * ariaK); aria.tip.material.color.setRGB(1.0 * k, 0.62 * k, 0.3 * k); }
    if (sceneName === 'party') { const h = (t * 0.15) % 1; paintRGB(new THREE.Color().setHSL(h, 0.9, 0.5), new THREE.Color().setHSL((h + 0.33) % 1, 0.9, 0.5)); }
    if (deployUntil) {
      const left = deployUntil - t;
      if (left > 0) {
        const g = new THREE.Color(0.1, 1.0, 0.3).multiplyScalar(0.6 + 0.4 * Math.sin(t * 14));
        paintRGB(g, g);
        if (deployBtn) { deployBtn.scale.y = left > 2.7 ? 0.5 : 1; deployBtn.material.color.setRGB(0.2, 3, 0.6); }
      } else { deployUntil = 0; applyScene(); if (deployBtn) { deployBtn.scale.y = 1; deployBtn.material.color.copy(deployBase); } }
    }
    if (blades && fanOn) blades.rotation.x += dt * 22;
    for (const l of lavas) l.material.uniforms.time.value = t;
    if (tea) {
      for (let i = 0; i < STEAM; i++) {
        steamAge[i] = (steamAge[i] + dt * 0.35) % 1;
        const a = steamAge[i];
        steamPos.set([tea.x + Math.sin(t * 1.3 + i) * 0.012 * a, tea.y + a * 0.17, tea.z + Math.cos(t * 1.1 + i * 2) * 0.012 * a], i * 3);
      }
      steamGeo.attributes.position.needsUpdate = true;
    }
    const k = busy ? 1.35 + 0.35 * Math.sin(t * 6) : 1;
    for (const [m, base] of pcGlow) m.color.copy(base).multiplyScalar(k);
    const f = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1);
    for (const m of fire) m.color.setRGB(1.0 * 3.4 * f, 0.45 * 3.4 * f, 0.12 * 3.4 * f);
    if (spin && spinning) spin.rotation.y -= dt * 3.49;
    if (fighters) {
      const c = b2t(...fighters.center), mid = (fighters.z1 + fighters.z0) / 2, amp = (fighters.z1 - fighters.z0) / 2;
      for (const [g, lag] of [[fighters.x, 0], [fighters.t, 0.9]]) {
        const a = t * 0.35 - lag;
        const p = new THREE.Vector3(c.x + Math.cos(a) * fighters.rx, mid + Math.sin(a * 2) * amp * 0.6, c.z + Math.sin(a) * fighters.ry);
        const ahead = new THREE.Vector3(c.x + Math.cos(a + 0.05) * fighters.rx, mid + Math.sin((a + 0.05) * 2) * amp * 0.6, c.z + Math.sin(a + 0.05) * fighters.ry);
        g.position.copy(p);
        g.lookAt(ahead);
        g.rotateY(-Math.PI / 2);
        g.rotateX(Math.sin(a) * 0.5);
      }
    }
    if (gull) { gull.rotation.y = Math.sin(t * 0.3) * 0.6; gull.position.y = b2t(...meta.points.gull).y + Math.abs(Math.sin(t * 0.8)) * 0.01; }
    if (printHead) printHead.position.x = headX + Math.sin(t * 1.7) * 0.12;
    if (printPart) printPart.scale.y = 0.3 + 0.7 * ((t / 90) % 1);
    wardrobeK += ((wardrobeOpen > t ? 1 : 0) - wardrobeK) * Math.min(1, dt * 3);
    for (const w of wardrobeDoors) w.o.position.x = w.x + w.side * wardrobeK * 0.45;
    for (const q of fish) { q.o.position.x = q.x + Math.sin(t * 0.4 + q.ph) * 0.25; q.o.rotation.y = Math.cos(t * 0.4 + q.ph) > 0 ? 0 : Math.PI; }
    for (const d of Object.values(doors)) {
      // An automatic door opens for me and for the residents (BH-22 on a tea run, Jessi following me out).
      if (d.auto && player) d.open = player.distanceTo(d.home) < d.auto || others.some(p => p.distanceTo(d.home) < d.auto);
      d.k += ((d.open ? 1 : 0) - d.k) * Math.min(1, dt * 3);
      if (d.slide) d.group.position.copy(d.home).add(b2t(...d.slide).multiplyScalar(d.k));
      else d.group.rotation.y = THREE.MathUtils.degToRad(d.swing) * d.k;
      // A sliding door stops being solid once it is mostly open.
      const solid = d.k < 0.6;
      if (d.solid !== solid) { d.solid = solid; onDoor?.(d.collider, solid); }
    }
    for (let i = 0; i < MOTES; i++) {
      const k = i * 3, sd = moteSeed[i];
      motePos[k] += Math.sin(t * 0.13 + sd * 40) * dt * 0.02;
      motePos[k + 1] += (Math.sin(t * 0.09 + sd * 17) * 0.5 - 0.15) * dt * 0.03;
      if (motePos[k + 1] < 0.3) motePos[k + 1] = 5.4;
    }
    moteGeo.attributes.position.needsUpdate = true;
    tickClocks(t);
  }

  return {
    tick, setGloss, deskThings, doors, merged,
    setMirror(on) { liveMirror = on; },
    toggleDoor(id) { const d = doors[id]; if (!d) return null; d.open = !d.open; return d; },
    openWardrobe(t) { wardrobeOpen = t + 6; },
    showUnlocks,
    scenes: Object.keys(SCENES),
    scene(name) { if (!Object.hasOwn(SCENES, name)) return false; sceneName = name; applyScene(); return true; },
    coolant(name) {
      if (!Object.hasOwn(COOLANT, name)) return false;
      for (const g of pcGlow) if (g[2] === 'c') g[1].copy(rgb(COOLANT[name])).multiplyScalar(3.2);
      return true;
    },
    deploy(t) { deployUntil = t + 3; },
    fan() { fanOn = !fanOn; return fanOn; },
    setRecord(on) { spinning = on; },
    // Daylight through the glass lifts the baked light a little and cools it; at night the bake shows as it is.
    daylight(k) {
      if (Math.abs(k - dayK) < 0.02) return;
      dayK = k;
      for (const m of baked) m.color.setRGB(1 + 0.12 * k, 1 + 0.12 * k, 1 + 0.18 * k);
    },
    // How big a door is, end to end (for the checks: only its own pieces should swing with it).
    doorSize(id) { const d = doors[id]; return d ? new THREE.Box3().setFromObject(d.group).getSize(new THREE.Vector3()).toArray() : null; },
  };
}
