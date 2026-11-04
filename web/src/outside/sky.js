import * as THREE from 'three';
import { material, OUT } from './glsl.js';
import { rng } from '../pure/outside.js';

const R_DOME = 29800, R_STARS = 29500, R_MOON = 29300, R_DS = 29200;

// Real bright stars (RA hours, dec, magnitude), so the Dipper and Cassiopeia wheel round Polaris.
const STARS = [
  [2.53, 89.26, 2.0], [11.062, 61.75, 1.8], [11.031, 56.38, 2.4], [11.897, 53.69, 2.4], [12.257, 57.03, 3.3], [12.9, 55.96, 1.8],
  [13.399, 54.93, 2.2], [13.792, 49.31, 1.9], [0.675, 56.54, 2.2], [0.153, 59.15, 2.3], [0.945, 60.72, 2.2], [1.43, 60.24, 2.7],
  [1.907, 63.67, 3.4], [5.278, 46.0, 0.1, 1], [18.616, 38.78, 0.0, 2], [20.69, 45.28, 1.3, 2], [14.261, 19.18, -0.1, 3],
  [14.845, 74.16, 2.1, 3], [15.345, 71.83, 3.0], [19.846, 8.87, 0.8], [4.599, 16.51, 0.9, 3], [5.919, 7.41, 0.5, 4],
  [5.242, -8.2, 0.1, 2], [6.752, -16.72, -1.4, 2], [7.655, 5.22, 0.4], [7.755, 28.03, 1.1, 1], [7.577, 31.89, 1.6],
  [10.14, 11.97, 1.4, 2], [13.42, -11.16, 1.0, 2], [3.405, 49.86, 1.8, 1], [3.136, 40.96, 2.1], [0.14, 29.09, 2.1],
  [1.162, 35.62, 2.1, 3], [2.065, 42.33, 2.1, 3], [17.943, 51.49, 2.2, 3], [17.507, 52.3, 2.8], [21.31, 62.59, 2.5],
  [14.073, 64.38, 3.7], [5.992, 44.95, 1.9], [16.4, 61.5, 2.7], [19.2, 67.66, 3.1], [9.525, 63.06, 3.7], [8.5, 60.7, 3.4],
];
const TINT = [[1, 1, 1], [1, 0.93, 0.78], [0.82, 0.88, 1], [1, 0.8, 0.6], [1, 0.62, 0.45]];

export function makeSky(U, q) {
  const group = new THREE.Group();
  const low = q === 'low';

  const dome = new THREE.Mesh(new THREE.SphereGeometry(R_DOME, 64, 32), material(U, {
    low, side: THREE.BackSide, depthWrite: false,
    vertex: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragment: `varying vec3 vDir;
      vec3 aurora(vec3 d) {
        float az = atan(d.x, -d.z);
        float base = 0.1 + 0.035 * sin(az * 2.3 + uTime * 0.021) + 0.02 * sin(az * 5.7 - uTime * 0.05);
        float up = d.y - base;
        float curtain = smoothstep(-0.02, 0.012, up) * exp(-max(up, 0.0) * 6.5);
        float rays = 0.3 + 0.7 * pow(texture2D(uNoise, vec2(az * 1.7 + uTime * 0.004, 0.13)).r, 2.0) * (0.6 + 0.8 * texture2D(uNoise, vec2(az * 6.0 - uTime * 0.012, 0.61)).g);
        vec3 c = mix(vec3(0.08, 1.0, 0.42), vec3(0.62, 0.16, 0.6), smoothstep(0.02, 0.2, up));
        return c * curtain * rays * smoothstep(1.4, 0.3, abs(az)) * uAurora * 0.15;
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyBase(d);
        if (uAurora > 0.001 && d.y > 0.0) col += aurora(d);
        float mm = max(dot(d, uMoonDir), 0.0);
        col += uMoonAmb * (pow(mm, 3000.0) * 4.0 + pow(mm, 90.0) * 0.6 + pow(mm, 12.0) * 0.15) * (1.0 + uCloud * 2.0);
        float mu = dot(d, uSunDir);
        col += uSunDisc * smoothstep(0.999945, 0.999965, mu);
        float c = cloudAt(d);
        if (d.y > 0.0) col = mix(col, cloudShade(d, c), c * 0.96);
        vec3 hz = hazeTint(d);
        col = mix(col, hz, smoothstep(0.0, -0.02, d.y));
        col = mix(col, hz, uFog * exp(-max(d.y, 0.0) * 5.0));
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // Stars ride an equatorial frame turned by the local sidereal time on the GPU.
  const rand = rng(23), FILL = low ? 650 : q === 'high' ? 2300 : 1500;
  const n = STARS.length + FILL, star = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const put = (i, ra, dec, mag, tint) => {
    star.set([ra, dec, Math.pow(10, -0.4 * (mag - 1))], i * 3);
    col.set(TINT[tint], i * 3);
  };
  STARS.forEach(([h, d, m, t = 0], i) => put(i, h * Math.PI / 12, d * Math.PI / 180, m, t));
  for (let i = 0; i < FILL; i++) {
    const m = 6.2 - 3.2 * Math.pow(rand(), 2.2);
    put(STARS.length + i, rand() * Math.PI * 2, Math.asin(rand() * 2 - 1), m, rand() < 0.7 ? 0 : 1 + Math.floor(rand() * 4));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  sg.setAttribute('aStar', new THREE.BufferAttribute(star, 3));
  sg.setAttribute('aTint', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, material(U, {
    low, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertex: `attribute vec3 aStar, aTint; varying vec3 vCol; varying vec3 vDir;
      void main() {
        float H = uLst - aStar.x, cd = cos(aStar.y), sd = sin(aStar.y);
        vec3 d = vec3(-cd * sin(H), cd * cos(H) * cos(LAT) + sd * sin(LAT), cd * cos(H) * sin(LAT) - sd * cos(LAT));
        vDir = d;
        gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + d * ${R_STARS.toFixed(1)}, 1.0);
        float tw = 0.78 + 0.22 * sin(uTime * (1.7 + fract(aStar.x * 13.1) * 4.0) + aStar.y * 57.0);
        float b = 0.05 + 0.95 * pow(aStar.z, 0.55);
        vCol = aTint * b * uStars * smoothstep(-0.01, 0.22, d.y) * mix(1.0, tw, smoothstep(0.5, 0.05, d.y)) * (1.0 - uFog);
        gl_PointSize = (1.3 + min(aStar.z, 2.5) * 0.9) * uPx;
      }`,
    fragment: `varying vec3 vCol; varying vec3 vDir;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float c = cloudAt(normalize(vDir));
        gl_FragColor = vec4(vCol * smoothstep(1.0, 0.2, r) * (1.0 - c), 1.0);
        ${OUT}
      }`,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = 1;
  group.add(stars);

  const billboard = (radius, size, fragment) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material(U, {
      low, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uDir: { value: new THREE.Vector3(0, 1, 0) }, uSize: { value: size }, uBright: { value: 1 } },
      vertex: `uniform vec3 uDir; uniform float uSize; varying vec2 vUv;
        void main() {
          vUv = position.xy;
          vec4 mv = viewMatrix * vec4(cameraPosition + uDir * ${radius.toFixed(1)}, 1.0);
          mv.xy += position.xy * uSize;
          gl_Position = projectionMatrix * mv;
        }`,
      fragment: `uniform vec3 uDir; uniform float uBright; varying vec2 vUv;
        float blob(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
        void main() {
          float r2 = dot(vUv, vUv);
          if (r2 > 1.0) discard;
          vec3 n = vec3(vUv, sqrt(1.0 - r2));
          vec3 L = normalize((viewMatrix * vec4(uMoonLight, 0.0)).xyz);
          float edge = smoothstep(1.0, 1.0 - 2.5 * fwidth(r2), r2);
          float c = cloudAt(uDir);
          ${fragment}
          gl_FragColor = vec4(col * edge * uBright * (1.0 - 0.97 * c) * (1.0 - uFog), 1.0);
          ${OUT}
        }`,
    }));
    m.frustumCulled = false;
    m.renderOrder = 2;
    return m;
  };

  // The moon a little over life size so it reads; the Death Star 0.13 degrees, a dim dot by eye.
  const moon = billboard(R_MOON, R_MOON * Math.tan(0.36 * Math.PI / 180), `
    float maria = blob(vUv, vec2(-0.32, 0.42), 0.3) + blob(vUv, vec2(0.2, 0.36), 0.17) + blob(vUv, vec2(0.36, 0.1), 0.2)
      + blob(vUv, vec2(0.68, 0.3), 0.11) + blob(vUv, vec2(-0.6, 0.0), 0.33) + blob(vUv, vec2(-0.18, -0.36), 0.18)
      + blob(vUv, vec2(0.55, -0.12), 0.14) + blob(vUv, vec2(0.38, -0.27), 0.1) + blob(vUv, vec2(-0.05, 0.72), 0.12) * 0.6;
    float tex = texture2D(uNoise, vUv * 0.7 + 0.3).g * 0.6 + texture2D(uNoise, vUv * 2.3).b * 0.4;
    float alb = mix(0.17, 0.085, clamp(maria * (0.75 + 0.5 * tex), 0.0, 1.0)) * (0.85 + 0.3 * tex);
    alb += 0.12 * blob(vUv, vec2(-0.14, -0.72), 0.05);
    float lam = smoothstep(-0.04, 0.3, dot(n, L)) * (0.75 + 0.25 * max(dot(n, L), 0.0));
    vec3 col = vec3(1.0, 0.96, 0.9) * alb * (lam * 8.5 + 0.12) * uMoonK;`);
  const deathStar = billboard(R_DS, R_DS * Math.tan(0.065 * Math.PI / 180), `
    float trench = smoothstep(0.04, 0.015, abs(n.y + 0.06));
    float dd = acos(clamp(dot(n, normalize(vec3(0.42, 0.5, 0.76))), -1.0, 1.0));
    float dish = smoothstep(0.3, 0.27, dd);
    float panels = 0.8 + 0.2 * hash13(floor(n * 36.0)) * (0.7 + 0.3 * hash13(floor(n * 9.0) + 3.1));
    float alb = 0.5 * panels * (1.0 - 0.75 * trench) * mix(1.0, 0.45 + 0.55 * dd / 0.3, dish);
    float lam = max(dot(n, L), 0.0);
    float rim = pow(1.0 - n.z, 3.0) * 0.25;
    vec3 col = vec3(0.72, 0.75, 0.8) * (alb * (lam + 0.06) + rim * lam) * (0.3 + 0.5 * uNight);`);
  group.add(moon, deathStar);

  return { group, dome, stars, moon, deathStar };
}
