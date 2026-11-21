import * as THREE from 'three';
import { b2t } from './engine.js';
import { makeKit } from './persia/kit.js';
import { SWITCH, SPOT, GLASS_Y, SCENE_RATE, roomLight, bulbLight, fillLight, settle, dimsLamps, lightRole, label, said } from './pure/lamps.js';

// Scaled in linear light before the output conversion, so every quality setting dims alike.
const VERT_HEAD = 'varying float vLampY;\n';
const VERT_TAIL = `#include <project_vertex>
  {
    vec4 lampW = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      lampW = instanceMatrix * lampW;
    #endif
    vLampY = -(modelMatrix * lampW).z;
  }`;
const FRAG_HEAD = 'uniform vec3 uLamp;\nvarying float vLampY;\n';
const FRAG_TAIL = `gl_FragColor.rgb *= mix(vec3(1.0), uLamp, step(vLampY, ${GLASS_Y.toFixed(2)}));\n#include <colorspace_fragment>`;
const PLAIN_HOOK = THREE.Material.prototype.onBeforeCompile;

// Other pieces' glows (screens, LEDs, candles) are brighter than white, which tells them from what should dim.
function kindOf(m) {
  const tag = m.userData?.lamp;
  if (tag) return tag === 'glow' ? null : tag;
  if (!m.isMeshBasicMaterial || m.blending !== THREE.NormalBlending || m.depthTest === false) return null;
  return Math.max(m.color.r, m.color.g, m.color.b) > 1.3 ? null : 'room';
}

export function makeLights(scene, world, { sfx = null, skip = [] } = {}) {
  const U = { room: { value: new THREE.Vector3(1, 1, 1) }, bulb: { value: new THREE.Vector3(1, 1, 1) } };
  const seen = new WeakSet(), skipped = new Set(skip.filter(Boolean));
  const count = { room: 0, bulb: 0 };
  function patch(m, u) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uLamp = u;
      sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', VERT_TAIL);
      sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <colorspace_fragment>', FRAG_TAIL);
    };
    m.customProgramCacheKey = () => 'lamp';
    m.needsUpdate = true;
  }
  // Pieces added later (a holiday table) are adopted when they arrive.
  function adopt() {
    let n = 0;
    const walk = o => {
      if (skipped.has(o)) return;
      for (const m of o.material ? [].concat(o.material) : []) {
        if (seen.has(m)) continue;
        seen.add(m);
        const kind = kindOf(m);
        // A material with a shader change of its own is left alone.
        if (!kind || m.onBeforeCompile !== PLAIN_HOOK) continue;
        patch(m, U[kind]);
        count[kind]++; n++;
      }
      for (const c of o.children) walk(c);
    };
    walk(scene);
    return n;
  }

  // The amber light shows where the switch is in the dark.
  const group = new THREE.Group();
  group.name = 'light_switch';
  group.position.copy(b2t(SWITCH.wall, SWITCH.y, SWITCH.z));
  group.rotation.y = -Math.PI / 2;
  const plate = makeKit({ ambient: 0.6, sky: 0.25, key: 0.2 });
  plate.box(SWITCH.w, SWITCH.h, 0.008, '#25282e', { at: [0, 0, 0.004] });
  plate.box(SWITCH.w - 0.006, SWITCH.h - 0.006, 0.003, '#2e3239', { at: [0, 0, 0.0095] });
  for (const y of [0.052, -0.052]) plate.cyl(0.0032, 0.0032, 0.002, '#62666d', { at: [0, y, 0.0115], rot: [Math.PI / 2, 0, 0], seg: 10 });
  const rocker = new THREE.Group();
  rocker.position.z = 0.011;
  const rk = makeKit({ ambient: 0.62, sky: 0.3, key: 0.22 });
  rk.box(0.04, 0.07, 0.01, '#3a3f48', { at: [0, 0, 0.005] });
  rk.box(0.036, 0.004, 0.0015, '#4a505a', { at: [0, 0.031, 0.0105] });
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  rocker.add(rk.mesh(mat));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0035, 0.002), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  led.material.userData.lamp = 'glow';
  led.position.set(0, -0.0455, 0.012);
  group.add(plate.mesh(mat), rocker, led);
  scene.add(group);

  const lit = (world.lights || []).map(([light, l]) => ({ light, base: light.intensity, role: lightRole(l) })).filter(x => x.role);
  const at = SPOT.at, spot = { ...SPOT, at: [...at], label: label(true), x: at[0], y: at[2], z: -at[1] };
  const where = group.position.clone();
  let on = true, k = 1, tip = -0.13, dayK = -1, outK = 0, movie = 0;
  const showLed = () => (on ? led.material.color.setRGB(0.16, 0.11, 0.06) : led.material.color.setRGB(2.4, 1.25, 0.32));
  showLed();
  rocker.rotation.x = tip;

  function set(v) {
    v = !!v;
    if (v === on) return false;
    on = v;
    spot.label = label(on);
    tip = on ? -0.13 : 0.13;
    showLed();
    sfx?.lightSwitch?.(on, where);
    return true;
  }
  return {
    group, spots: [spot], uniforms: U, count, adopt, set,
    get on() { return on; },
    get k() { return k; },
    get movie() { return movie; },
    poke(id) {
      if (id !== SPOT.id) return null;
      set(!on);
      return said(on);
    },
    hit(ray, blockers) {
      const h = ray.intersectObject(group, true)[0];
      if (!h) return null;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < h.distance - 0.05) ? spot : null;
    },
    tick(dt, day, player) {
      if (rocker.rotation.x !== tip) { const r = rocker.rotation.x + (tip - rocker.rotation.x) * Math.min(1, dt * 30); rocker.rotation.x = Math.abs(tip - r) < 1e-4 ? tip : r; }
      const was = k, movieWas = movie, outWas = outK, out = player && -player.z >= GLASS_Y ? 1 : 0;
      k = settle(k, on, dt);
      movie = settle(movie, dimsLamps(world.sceneName), dt, SCENE_RATE);
      outK = Math.abs(out - outK) < 0.01 ? out : outK + (out - outK) * Math.min(1, dt * 3);
      // Fully on, nothing is touched, so the house is exactly as it always was.
      if (k === 1 && was === 1 && movie === 0 && movieWas === 0) return;
      if (k === was && movie === movieWas && outK === outWas && Math.abs(day - dayK) <= 0.005) return;
      dayK = day;
      const r = roomLight(day, k, movie), b = bulbLight(day, k, movie), f = fillLight(day, k, movie);
      U.room.value.set(r[0], r[1], r[2]);
      U.bulb.value.setScalar(b);
      for (const x of lit) { const lv = x.role === 'fill' ? f : b; x.light.intensity = outK === 1 ? x.base : x.base * (lv + (1 - lv) * outK); }
    },
  };
}
