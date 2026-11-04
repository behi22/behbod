import * as THREE from 'three';
import { material, OUT } from './glsl.js';
import { rng, FW_SLOTS } from '../pure/outside.js';

// Drops wrap around the camera on the GPU and stay outside the glass, so none fall inside the loft.
const OUTSIDE_GLASS = '-15.35';

export function makeRain(U, q) {
  const n = q === 'low' ? 1600 : q === 'high' ? 6000 : 3800, rand = rng(51);
  const seed = new Float32Array(n * 2 * 4);
  for (let i = 0; i < n; i++) {
    const a = [rand(), rand(), rand()];
    seed.set([...a, 0, ...a, 1], i * 8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mesh = new THREE.LineSegments(geo, material(U, {
    low: q === 'low', transparent: true, depthWrite: false,
    vertex: `attribute vec4 aSeed; varying float vA;
      void main() {
        vec3 box = vec3(34.0, 26.0, 34.0), vel = vec3(1.4, -9.5, 0.7);
        vec3 p = aSeed.xyz * box + vel * uTime;
        p = mod(p - cameraPosition + box * 0.5, box) - box * 0.5 + cameraPosition;
        float keep = step(fract(aSeed.x * 7.31 + aSeed.y * 3.17 + aSeed.z * 1.9), uRain) * step(p.z, ${OUTSIDE_GLASS});
        float d = length(p - cameraPosition);
        keep *= smoothstep(1.2, 2.2, d);
        if (aSeed.w > 0.5) p -= vel * 0.032;
        vA = keep * smoothstep(17.0, 5.0, d) * (0.5 + 0.5 * fract(aSeed.z * 13.7));
        gl_Position = keep < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragment: `varying float vA;
      void main() {
        vec3 c = uAmbient * 2.2 + vec3(0.05, 0.045, 0.04) * uNight + uSunCol * 0.2;
        gl_FragColor = vec4(c, vA * 0.26);
        ${OUT}
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  return mesh;
}

export function makeSnow(U, q) {
  const n = q === 'low' ? 1400 : q === 'high' ? 5000 : 3200, rand = rng(53);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) seed.set([rand(), rand(), rand(), rand()], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mesh = new THREE.Points(geo, material(U, {
    low: q === 'low', transparent: true, depthWrite: false,
    vertex: `attribute vec4 aSeed; varying float vA;
      void main() {
        vec3 box = vec3(40.0, 26.0, 40.0);
        float t = uTime + aSeed.w * 100.0;
        vec3 p = aSeed.xyz * box + vec3(0.35 * t + sin(t * 0.7 + aSeed.w * 6.0) * 0.6, -(0.8 + aSeed.w * 0.5) * t, cos(t * 0.5 + aSeed.x * 6.0) * 0.5);
        p = mod(p - cameraPosition + box * 0.5, box) - box * 0.5 + cameraPosition;
        float keep = step(aSeed.w, uSnow) * step(p.z, ${OUTSIDE_GLASS});
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = max(-mv.z, 0.5);
        keep *= smoothstep(1.2, 2.0, d);
        float px = 0.035 * projectionMatrix[1][1] * 0.5 * uRes / d;
        gl_PointSize = max(px, 1.0 * uPx);
        vA = keep * min(1.0, px * px * 1.5 + 0.15) * smoothstep(20.0, 8.0, d);
        gl_Position = keep < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
      }`,
    fragment: `varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        vec3 c = uAmbient * 2.6 + vec3(0.07, 0.065, 0.06) * uNight + uSunCol * 0.4;
        gl_FragColor = vec4(c, vA * smoothstep(1.0, 0.4, r) * 0.9);
        ${OUT}
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  return mesh;
}

export function makeFireworks(U, q) {
  const n = q === 'low' ? 1200 : q === 'high' ? 3600 : 2400, rand = rng(61);
  const dir = new Float32Array(n * 3), f = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    dir.set([r * Math.cos(a), z, r * Math.sin(a)], i * 3);
    f.set([i % FW_SLOTS, 0.8 + rand() * 0.2, rand() < 0.05 ? 1 : 0, rand()], i * 4);
    if (i % 2 && i > FW_SLOTS) { dir.set(dir.subarray((i - FW_SLOTS) * 3, (i - FW_SLOTS) * 3 + 3), i * 3); f[i * 4 + 1] = f[(i - FW_SLOTS) * 4 + 1]; f[i * 4 + 2] = 2 + rand(); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aF', new THREE.BufferAttribute(f, 4));
  const fw = {
    uFw: { value: Array.from({ length: FW_SLOTS }, () => new THREE.Vector4(0, 0, 0, -1e4)) },
    uFwB: { value: Array.from({ length: FW_SLOTS }, () => new THREE.Vector4()) },
    uPal: { value: Array.from({ length: 8 }, () => new THREE.Vector3(1, 1, 1)) },
  };
  const make = mirror => {
    const p = new THREE.Points(geo, material(U, {
      low: q === 'low', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...fw, uMirror: { value: mirror } },
      vertex: `attribute vec3 aDir; attribute vec4 aF; uniform vec4 uFw[${FW_SLOTS}], uFwB[${FW_SLOTS}]; uniform vec3 uPal[8]; uniform float uMirror; varying vec3 vCol;
        void main() {
          int s = int(aF.x);
          vec4 A = uFw[s], B = uFwB[s];
          float age = A.w, rise = B.x;
          int type = int(B.y + 0.5);
          vec3 o = vec3(11.0 + A.x, WATER_Y + A.y, -14.5 - A.z);
          vec3 p = o, c = uPal[int(B.z + 0.5)];
          float b = 0.0, size = 2.4;
          float ghost = aF.z > 1.5 ? aF.z - 2.0 : -1.0;
          if (ghost >= 0.0) age -= 0.06 + ghost * 0.22;
          if (age > -rise && age < 5.5) {
            if (age < 0.0) {
              if (ghost >= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
              float k = clamp(1.0 + (age - aF.w * 0.3) / rise, 0.0, 1.0);
              p = o - vec3(0.0, A.y * (1.0 - k * (2.0 - k)), 0.0);
              b = aF.z * (1.0 - aF.w) * 0.7;
              c = vec3(1.0, 0.72, 0.4);
              size = 1.6;
            } else {
              vec3 d = aDir;
              if (type == 3) { vec3 v = normalize(cameraPosition - o); d = normalize(d - v * dot(d, v)); }
              float spd = aF.y * (type == 1 ? 90.0 : type == 3 ? 135.0 : 125.0) * (0.8 + 0.4 * B.w), drag = type == 1 ? 0.75 : 1.05;
              p = o + d * spd * (1.0 - exp(-drag * age)) / drag;
              p.y -= (type == 1 ? 4.5 : 2.6) * age * age;
              float life = type == 1 ? 5.0 : 2.4 + aF.w * 0.8;
              b = exp(-age * (type == 1 ? 0.5 : 1.0)) * smoothstep(life, life * 0.6, age);
              if (type == 1) c = vec3(1.0, 0.6, 0.22);
              if (type == 2) b *= age < 0.8 ? 1.0 : step(0.6, hash13(vec3(aF.w * 113.0, floor(uTime * 24.0), 1.0))) * 2.2;
              c = mix(vec3(1.0, 0.95, 0.85), c, smoothstep(0.0, 0.3, age));
              b *= (1.0 + 1.2 * exp(-age * 18.0)) * (ghost >= 0.0 ? 0.45 * (1.0 - ghost * 0.6) : 1.0);
            }
          }
          // The reflection lands where the mirror image would, smeared by the waves.
          if (uMirror > 0.5) {
            vec3 E = cameraPosition;
            float He = max(E.y - WATER_Y, 1.0), D = max(length(p.xz - E.xz), 1.0);
            float dep = atan(He + max(p.y - WATER_Y, 0.0), D);
            float jit = hash13(vec3(aF.w * 31.0, floor(uTime * 9.0), 2.0));
            dep *= 1.0 + (jit - 0.3) * (0.18 + 0.3 * uRough);
            vec2 dir = (p.xz - E.xz) / D;
            float dw = He / tan(clamp(dep, 0.002, 1.4));
            p = vec3(E.x + dir.x * dw, WATER_Y + 0.1, E.z + dir.y * dw);
            b *= 0.2 * step(0.35, jit);
          }
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float dist = max(-mv.z, 1.0), px = size * projectionMatrix[1][1] * 0.5 * uRes / dist, sz = max(px, 1.6 * uPx);
          vCol = c * b * 2.2 * clamp(px * px / (sz * sz) * 3.0 + 0.35, 0.0, 1.0) * exp(-hazeOD(cameraPosition, p));
          gl_PointSize = sz;
          gl_Position = b < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
        }`,
      fragment: `varying vec3 vCol;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(vCol * exp(-r * r * 3.0), 1.0);
          ${OUT}
        }`,
    }));
    p.frustumCulled = false;
    p.renderOrder = 6;
    p.visible = false;
    return p;
  };
  return { sky: make(0), water: make(1), u: fw };
}
