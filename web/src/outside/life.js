import * as THREE from 'three';
import { material, OUT } from './glsl.js';
import { unitBox } from './city.js';
import { WATER_Y, EYE, rng } from '../pure/outside.js';

// Parts, x forward and z to starboard: centre x, base y, centre z, length, height, beam, style, yaw.
const SHIP = [
  [-6, -7, 0, 268, 20, 32, 6], [128, -7, 0, 22.6, 20, 22.6, 6, Math.PI / 4], [-12, 13, 0, 236, 24, 30, 4],
  [-28, 37, 0, 170, 10, 26, 4], [-36, 47, 0, 140, 7, 23, 4], [40, 47, 0, 30, 5, 30, 5], [-75, 54, 0, 22, 15, 11, 6],
  [-75, 69, 0, 18, 2, 12, 5], [104, 13, 0, 30, 12, 24, 4, Math.PI / 4],
  ...[-1, 1].flatMap(s => [-70, -40, -10, 20, 50].map(x => [x, 30, s * 15.6, 12, 3.2, 3, 5])),
];
const FERRY = [
  [0, -2.4, -4.2, 33, 3.4, 3.4, 5], [0, -2.4, 4.2, 33, 3.4, 3.4, 5], [0, 0.6, 0, 31, 3.8, 12.4, 4],
  [0, 4.4, 0, 27, 0.8, 11, 5], [15.5, 0.8, 0, 2.4, 3.2, 10.4, 5], [-15.5, 0.8, 0, 2.4, 3.2, 10.4, 5],
];
const PLANE = [
  [0.5, 1.9, 0, 10.5, 1.8, 1.6, 7], [1.5, 3.6, 0, 2.2, 0.25, 15, 7], [-4.6, 3.6, 0, 1.6, 1.6, 0.2, 7],
  [-4.6, 3.6, 0, 1.4, 0.15, 4.6, 7], [0.8, 0, -1.4, 7.6, 0.7, 0.7, 5], [0.8, 0, 1.4, 7.6, 0.7, 0.7, 5],
];
export const VESSELS = [SHIP, FERRY, PLANE];

// [kind 9, x, y, z, r, g, b, size, strobe phase, vessel]
export function vesselLights() {
  const L = [];
  const add = (v, x, y, z, c, size, strobe = 0) => L.push([9, x, y, z, c[0], c[1], c[2], size, strobe, v]);
  const W = [1, 0.95, 0.85], RED = [1, 0.1, 0.05], GRN = [0.1, 1, 0.3], WARM = [1, 0.72, 0.42];
  add(0, 110, 62, 0, W, 2.2); add(0, 60, 52, -15.5, RED, 2); add(0, 60, 52, 15.5, GRN, 2); add(0, -140, 20, 0, W, 2);
  for (let x = -120; x <= 100; x += 20) { add(0, x, 47.5, -13.5, WARM, 2.4); add(0, x, 47.5, 13.5, WARM, 2.4); }
  add(1, 0, 8.6, 0, W, 1.4); add(1, 16, 3, -6, RED, 1.2); add(1, 16, 3, 6, GRN, 1.2); add(1, -16, 3, -6, RED, 1.2); add(1, -16, 3, 6, GRN, 1.2);
  add(2, 1.5, 3.7, -7.5, RED, 0.9); add(2, 1.5, 3.7, 7.5, GRN, 0.9); add(2, -5.4, 4.4, 0, W, 1.2, 0.73); add(2, 5.6, 2.1, 0, W, 1.6);
  return L;
}

// Streaks in each vessel's frame.
export function vesselStreaks() {
  const c = [1, 0.72, 0.45];
  return [
    { x: -80, h: 28, z: 0, w: 70, c, kind: 3, v: 0 }, { x: 10, h: 30, z: 0, w: 80, c, kind: 3, v: 0 }, { x: 95, h: 26, z: 0, w: 50, c, kind: 3, v: 0 },
    { x: 0, h: 4, z: 0, w: 16, c: [0.9, 0.85, 0.7], kind: 3, v: 1 },
  ];
}

export function makeVessels(U, q, mat) {
  const parts = VESSELS.flat(), n = parts.length, geo = unitBox();
  const aStyle = new Float32Array(n), aSeed = new Float32Array(n);
  parts.forEach((p, i) => { aStyle[i] = p[6]; aSeed[i] = 0.31 + i * 0.07; });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(aStyle, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const local = parts.map(p => new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p[7] || 0), new THREE.Vector3(p[3], p[4], p[5])));
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4();
  const E = new THREE.Euler(0, 0, 0, 'YZX'), Qt = new THREE.Quaternion(), Pt = new THREE.Vector3(), One = new THREE.Vector3(1, 1, 1);
  const owner = [];
  VESSELS.forEach((v, vi) => v.forEach(() => owner.push(vi)));
  function place(vi, s) {
    const frame = U.uVessel.value[vi];
    U.uVesselOn.value[vi] = s.on;
    if (s.on) {
      E.set(s.roll || 0, Math.PI / 2 - s.heading, s.pitch || 0, 'YZX');
      frame.compose(Pt.set(EYE[0] + s.dx, WATER_Y + (s.alt || 0), EYE[2] - s.dn), Qt.setFromEuler(E), One);
    }
    for (let i = 0; i < n; i++) {
      if (owner[i] !== vi) continue;
      mesh.setMatrixAt(i, s.on ? M.multiplyMatrices(frame, local[i]) : zero);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, place };
}

// The GPU flies the gulls, so they cost nothing per frame.
export function makeGulls(U, q) {
  const count = q === 'low' ? 4 : 8, rand = rng(41);
  // Half a gull in metres (x forward, z to the right), mirrored for the left wing.
  // Body, tail, and each wing in three panels (inner, outer, the pointed tip), swept back from the wrist.
  const P = { nose: [0.3, 0.01, 0], tail: [-0.3, 0, 0], rf: [0.1, 0.01, 0.035], rb: [-0.1, 0, 0.035], wf: [0.09, 0.01, 0.3], wb: [-0.06, 0.01, 0.3],
    of: [0.02, 0.0, 0.56], ob: [-0.12, 0.0, 0.52], tip: [-0.2, 0, 0.78], tl: [-0.38, 0, 0.08] };
  const side = (p, k) => [p[0], p[1], p[2] * k];
  const tris = [];
  for (const k of [1, -1]) {
    const q3 = n => side(P[n], k);
    tris.push(q3('nose'), q3('rf'), [0.1, 0.012, 0], q3('rf'), q3('rb'), [0.1, 0.012, 0], q3('rb'), [-0.1, 0, 0], [0.1, 0.012, 0]);
    tris.push(q3('rb'), q3('tail'), [-0.1, 0, 0], q3('rb'), q3('tl'), q3('tail'));
    tris.push(q3('rf'), q3('wf'), q3('rb'), q3('rb'), q3('wf'), q3('wb'));
    tris.push(q3('wf'), q3('of'), q3('wb'), q3('wb'), q3('of'), q3('ob'));
    tris.push(q3('of'), q3('tip'), q3('ob'));
  }
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat().map(x => x * 1.4), 3));
  const geo = new THREE.InstancedBufferGeometry().copy(base);
  base.dispose();
  const centre = new Float32Array(count * 3), param = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    centre.set([EYE[0] + (rand() - 0.5) * 220, (rand() < 0.3 ? WATER_Y + 12 : 4) + rand() * 30, EYE[2] - 55 - rand() * 160], i * 3);
    param.set([22 + rand() * 40, (0.25 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1), rand() * 6.28, 3 + rand() * 6], i * 4);
  }
  geo.setAttribute('aCentre', new THREE.InstancedBufferAttribute(centre, 3));
  geo.setAttribute('aParam', new THREE.InstancedBufferAttribute(param, 4));
  geo.instanceCount = count;
  const mesh = new THREE.Mesh(geo, material(U, {
    low: q === 'low', side: THREE.DoubleSide,
    vertex: `attribute vec3 aCentre; attribute vec4 aParam; varying vec3 vWp, vN; varying float vSpan;
      void main() {
        float R = aParam.x, w = aParam.y, A = aParam.w, th = uTime * w * 30.0 / R + aParam.z;
        vec3 c = aCentre + vec3(R * cos(th), A * sin(th * 0.5 + aParam.z), R * 0.6 * sin(th));
        vec3 fwd = normalize(vec3(-R * sin(th), 0.5 * A * cos(th * 0.5 + aParam.z), 0.6 * R * cos(th))) * sign(w);
        vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
        float bank = sign(w) * clamp(abs(w) * 1.4, 0.2, 0.6);
        vec3 up = normalize(vec3(0.0, cos(bank), 0.0) + right * sin(bank));
        right = normalize(cross(fwd, up));
        float flap = smoothstep(0.55, 0.9, sin(uTime * 0.37 + aParam.z * 3.0));
        // Gliding, the inner wing lifts and the outer wing drops a little (the gull's M); flapping, the wrist follows
        // the shoulder a beat behind.
        float beat = uTime * 11.0 + aParam.z, k = abs(position.z) / 1.4;
        float shoulder = 0.16 + sin(beat) * 0.55 * flap, wrist = -0.22 + sin(beat - 0.9) * 0.45 * flap;
        vec3 p = position;
        p.y += min(k, 0.38) * 1.4 * shoulder + max(0.0, k - 0.38) * 1.4 * (shoulder + wrist);
        vSpan = k;
        vec3 wp = c + fwd * p.x + up * p.y + right * p.z;
        vWp = wp; vN = up;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragment: `varying vec3 vWp, vN; varying float vSpan;
      void main() {
        vec3 n = normalize(vN);
        // White underneath, grey on top, black wingtips.
        vec3 alb = dot(n, cameraPosition - vWp) < 0.0 ? vec3(0.66) : vec3(0.42, 0.44, 0.46);
        alb = mix(alb, vec3(0.05), smoothstep(0.62, 0.7, vSpan));
        vec3 col = alb * (uSunCol * (0.4 + 0.6 * abs(dot(n, uSunDir))) + uAmbient * 1.1);
        gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
        ${OUT}
      }`,
  }));
  mesh.frustumCulled = false;
  return mesh;
}
