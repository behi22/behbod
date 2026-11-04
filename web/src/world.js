import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { b2t } from './engine.js';

const EMISSIVE = { E_purple: [0.55, 0.15, 1.0, 3.2], E_teal: [0.1, 0.9, 0.8, 3.0], E_warm: [1.0, 0.62, 0.3, 2.6], E_onair: [1.0, 0.1, 0.07, 3.0],
  E_led_green: [0.25, 1.0, 0.45, 3.5], E_led_blue: [0.25, 0.55, 1.0, 3.5], E_aria_eye: [0.25, 1.0, 0.85, 3.2], E_warm_soft: [1.0, 0.75, 0.45, 2.4], E_bias: [0.35, 0.45, 1.0, 2.6] };
const PRINTS = new Set(['art1', 'art2', 'proj1', 'proj2']);
const isScreen = n => n.startsWith('screen_') || n === 'backdrop' || n === 'postit' || n === 'onair' || n === 'desk_mat' || n === 'neon';

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

// The zones' baked geometry plus everything lit or moved at runtime: screens, LEDs, glass, clocks, the PC, steam.
export function makeWorld(scene, zones, meta, screens) {
  const emits = {}, leds = [], clockHands = {}, aria = {}, pcGlow = [], deskThings = [], lavas = [];
  for (const z of zones) {
    scene.add(z);
    z.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material, name = o.name;
      if (name.endsWith('_baked')) {
        o.material = new THREE.MeshBasicMaterial({ map: m.map, fog: true });
        o.material.map.anisotropy = 4;
      } else if (name === 'lava_glass') {
        o.material = lavaMaterial(o);
        lavas.push(o);
      } else if (isScreen(name)) {
        const key = name === 'desk_mat' ? 'mat' : name.replace('screen_', '');
        const k = name === 'postit' ? 0.95 : name === 'backdrop' ? 1 : name === 'desk_mat' ? 0.62 : name === 'neon' ? 1.7 : PRINTS.has(key) ? 0.8 : 1.25;
        o.material = new THREE.MeshBasicMaterial({ map: screens.textures[key], color: new THREE.Color(k, k, k), fog: name !== 'backdrop' });
        if (name === 'onair') o.material.color.setScalar(2.2);
      } else if (m.name?.startsWith('G_')) {
        o.material = new THREE.MeshBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: name === 'window_glass' ? 0.06 : 0.12, depthWrite: false, fog: true });
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
        o.material = new THREE.MeshBasicMaterial({ color: (m.color || new THREE.Color(0.2, 0.2, 0.2)).clone().multiplyScalar(0.35), fog: true });
      }
      if (/^(fan\d|coolant_tube|cpu_block|gpu\d_led|ram\d_led)$/.test(name)) pcGlow.push([o.material, o.material.color.clone()]);
      if (/^(screen_|kb_|monitor|mini_case|desk_mat|mouse)/.test(name)) deskThings.push(o);
    });
  }

  // Lights only touch the character; the room's light is baked.
  let rgbLight = null;
  for (const l of meta.lights) {
    if (l.kind === 'hemi') { scene.add(new THREE.HemisphereLight(l.sky, l.ground, l.power)); continue; }
    const light = l.kind === 'sun' ? new THREE.DirectionalLight(l.color, l.power) : new THREE.PointLight(l.color, l.power, l.range, 2);
    light.position.copy(b2t(...l.at));
    scene.add(light);
    if (l.role === 'rgb') rgbLight = light;
  }
  // Holidays from the README's calendar recolour the room's RGB strips.
  if (screens.holiday) {
    const tintEmit = (name, hex, k) => (emits[name] || []).forEach(m => m.color.set(hex).multiplyScalar(k));
    tintEmit('E_purple', screens.holiday.c.hot, 3.0); tintEmit('E_teal', screens.holiday.c.a2, 2.6);
    rgbLight?.color.set(screens.holiday.c.hot);
  }

  // Small, subtle reflections: the studio floor mirrors only the bright things (screens, LEDs, lamps), softly.
  let floorGloss = null;
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

  const clockFmt = {};
  function tickClocks() {
    for (const [nm, tz] of [['van', 'America/Vancouver'], ['teh', 'Asia/Tehran']]) {
      clockFmt[tz] ||= new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
      const p = clockFmt[tz].formatToParts(new Date());
      const h = +p.find(x => x.type === 'hour').value, m = +p.find(x => x.type === 'minute').value;
      if (clockHands[`clock_${nm}_h`]) clockHands[`clock_${nm}_h`].rotation.x = -((h % 12) + m / 60) / 12 * Math.PI * 2;
      if (clockHands[`clock_${nm}_m`]) clockHands[`clock_${nm}_m`].rotation.x = -m / 60 * Math.PI * 2;
    }
  }

  // busy: I'm at the computer, so the PC's lights pulse harder.
  function tick(dt, t, busy) {
    for (let i = 0; i < leds.length; i++) leds[i].visible = Math.sin(t * (2 + (i % 7)) + i * 1.7) > -0.6;
    if (aria.eyes) { const blink = (t % 4.2) < 0.12; for (const e of aria.eyes) e.scale.y = blink ? 0.15 : 1; }
    if (aria.tip) { const k = 2 + Math.sin(t * 3); aria.tip.material.color.setRGB(1.0 * k, 0.62 * k, 0.3 * k); }
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
    tickClocks();
  }

  return { tick, setGloss, deskThings };
}
