import * as THREE from 'three';
import { b2t } from './engine.js';
import { weatherNow, BRIDGE } from '../room2.js';

// Outside: rain on the glass and snow, from Vancouver's real weather, plus traffic on the painted bridge when the flat
// backdrop is in use (the 3D outside has its own).
export function makeOutside(scene, meta, screens, { traffic: withTraffic = true } = {}) {
  const bd = meta.backdrop, win = meta.window;
  // Canvas pixels map onto the backdrop plane so the cars follow the painted bridge.
  const onBackdrop = (cx, cy) => b2t(bd.center[0] - bd.w / 2 + bd.w * cx / BRIDGE.canvasW, bd.center[1] - 0.1, bd.center[2] + bd.h / 2 - bd.h * cy / BRIDGE.canvasH);
  const CARS = withTraffic ? 44 : 0, carPos = new Float32Array(CARS * 3), carCol = new Float32Array(CARS * 3), cars = [];
  for (let i = 0; i < CARS; i++) {
    const dir = i % 2 ? 1 : -1;
    cars.push({ u: Math.random(), dir, v: 0.025 + Math.random() * 0.02 });
    carCol.set(dir > 0 ? [1.6, 1.45, 1.1] : [1.6, 0.15, 0.1], i * 3);
  }
  const carGeo = new THREE.BufferGeometry();
  carGeo.setAttribute('position', new THREE.BufferAttribute(carPos, 3));
  carGeo.setAttribute('color', new THREE.BufferAttribute(carCol, 3));
  const traffic = new THREE.Points(carGeo, new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  if (CARS) scene.add(traffic);

  const state = { weather: 'clear' };
  let rain = null, snow = null;
  weatherNow().then(w => {
    state.weather = w;
    screens.outside.weather = w;
    screens.outside.draw(new Date());
    if (w === 'rain') {
      // Streaks running down the inside of the window glass.
      rain = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float time; varying vec2 vUv;
          float h(float n) { return fract(sin(n * 91.7) * 43758.5); }
          void main() {
            float col = floor(vUv.x * 140.0), r = h(col);
            float y = fract(vUv.y + time * (0.25 + r * 0.5) + r * 7.0);
            float streak = smoothstep(0.0, 0.02, y) * (1.0 - smoothstep(0.02, 0.12 + r * 0.15, y)) * step(0.55, r);
            float edge = 1.0 - abs(fract(vUv.x * 140.0) - 0.5) * 2.0;
            gl_FragColor = vec4(vec3(0.55, 0.62, 0.75) * streak * smoothstep(0.4, 1.0, edge) * 0.22, 1.0);
          }`,
      }));
      rain.position.copy(b2t(...win.center));
      scene.add(rain);
    } else if (w === 'snow') {
      // Flakes falling in a box just outside the window.
      const N = 900, pos = new Float32Array(N * 3), c = win.center;
      for (let i = 0; i < N; i++) pos.set([c[0] - win.w / 2 - 0.4 + Math.random() * (win.w + 1.5), Math.random() * 5, -c[1] - 0.34 - Math.random() * 10], i * 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      snow = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.035, color: 0xe8eefc, transparent: true, opacity: 0.85, depthWrite: false }));
      scene.add(snow);
    }
  });

  function tick(dt, t) {
    for (let i = 0; i < CARS; i++) {
      const c = cars[i];
      c.u = (c.u + c.dir * c.v * dt + 1) % 1;
      const cx = BRIDGE.x0 + c.u * (BRIDGE.x1 - BRIDGE.x0), cy = BRIDGE.y - Math.sin(c.u * Math.PI) * BRIDGE.sag - (c.dir > 0 ? 2.5 : 0.5);
      const p = onBackdrop(cx, cy);
      carPos[i * 3] = p.x; carPos[i * 3 + 1] = p.y; carPos[i * 3 + 2] = p.z;
    }
    carGeo.attributes.position.needsUpdate = true;
    traffic.material.opacity = screens.outside.dark ? 1 : 0.35;
    if (rain) rain.material.uniforms.time.value = t;
    if (snow) {
      const a = snow.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * (0.35 + (i % 7) * 0.04); if (y < 0) y += 5; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.05); }
      a.needsUpdate = true;
    }
  }
  return { tick, get weather() { return state.weather; } };
}
