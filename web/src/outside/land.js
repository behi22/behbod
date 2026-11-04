import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, OUT } from './glsl.js';
import { WATER_Y, EYE, landHeight, landKind, shoreS, inPark, rng, wx, wz } from '../pure/outside.js';

const SIL_N = 1024;
const RES = { low: [380, 100], medium: [720, 160], high: [960, 200] };

// A polar grid around the eye, fine near and coarse far, so every ridge gets about the same pixels.
export function makeTerrain(U, q) {
  const [cols, rows] = RES[q] || RES.medium, a0 = -128 * Math.PI / 180, a1 = 128 * Math.PI / 180, r0 = 16, r1 = 28000;
  const n = cols * rows, pos = new Float32Array(n * 3), kind = new Float32Array(n * 4);
  const ratio = Math.pow(r1 / r0, 1 / (rows - 1));
  const colEl = new Float32Array(cols).fill(-0.05), colDist = new Float32Array(cols).fill(30000);
  const mirrorY = WATER_Y - (EYE[1] - WATER_Y);
  for (let c = 0; c < cols; c++) {
    const a = a0 + (a1 - a0) * c / (cols - 1), sa = Math.sin(a), ca = Math.cos(a);
    for (let r = 0, rad = r0; r < rows; r++, rad *= ratio) {
      const dx = sa * rad, dn = ca * rad, h = landHeight(dx, dn), i = c * rows + r;
      const y = WATER_Y + (h < -2 ? -14 : h);
      pos[i * 3] = wx(dx); pos[i * 3 + 1] = y; pos[i * 3 + 2] = wz(dn);
      kind.set(landKind(dx, dn, h), i * 4);
      if (rad > 90) {
        const el = Math.atan2(y - mirrorY, rad);
        if (el > colEl[c]) { colEl[c] = el; colDist[c] = rad; }
      }
    }
  }
  // Sample the columns per texel, so no texel is left empty where the two grids beat against each other.
  const sil = { el: new Float32Array(SIL_N).fill(-0.05), dist: new Float32Array(SIL_N).fill(30000), tower: new Float32Array(SIL_N) };
  for (let b = 0; b < SIL_N; b++) {
    const fc = (((b + 0.5) / SIL_N - 0.5) * Math.PI * 2 - a0) / (a1 - a0) * (cols - 1);
    if (fc < 0 || fc > cols - 1) continue;
    const c0 = Math.floor(fc), c1 = Math.min(cols - 1, c0 + 1), c = colEl[c0] > colEl[c1] ? c0 : c1;
    sil.el[b] = colEl[c]; sil.dist[b] = colDist[c];
  }
  const index = [];
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const i = c * rows + r, j = i + rows;
      index.push(i, j, i + 1, j, j + 1, i + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 4));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material(U, {
    low: q === 'low',
    vertex: `attribute vec4 aKind; varying vec3 vWp, vN; varying vec4 vKind;
      void main() { vWp = position; vN = normal; vKind = aKind; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragment: `varying vec3 vWp, vN; varying vec4 vKind;
      void main() {
        vec3 n = normalize(vN);
        float alt = vWp.y - WATER_Y, dist = length(vWp - cameraPosition);
        float bumpK = smoothstep(80.0, 400.0, alt) * smoothstep(1200.0, 4000.0, dist);
        vec2 bp = vWp.xz / 520.0;
        float b0 = texture2D(uNoise, bp).g, bx = texture2D(uNoise, bp + vec2(0.012, 0.0)).g, bz = texture2D(uNoise, bp + vec2(0.0, 0.012)).g;
        n = normalize(n + vec3(b0 - bx, 0.0, b0 - bz) * 5.0 * bumpK);
        vec4 nz = texture2D(uNoise, vWp.xz / 1400.0);
        vec4 nf = texture2D(uNoise, vWp.xz / 160.0);
        float v = nz.r * 0.6 + nf.g * 0.4;
        vec3 forest = mix(vec3(0.012, 0.03, 0.018), vec3(0.026, 0.052, 0.028), v);
        // Late in the year the alders and maples low on the slopes go gold.
        forest = mix(forest, vec3(0.06, 0.045, 0.016), uSeason * 0.6 * smoothstep(0.6, 0.85, texture2D(uNoise, vWp.xz / 2600.0).b) * smoothstep(500.0, 150.0, alt));
        vec3 town = mix(vec3(0.07, 0.068, 0.062), vec3(0.035, 0.048, 0.03), smoothstep(0.35, 0.7, nf.r));
        vec3 rock = vec3(0.105, 0.1, 0.095) * (0.75 + 0.5 * nz.g);
        float north = step(vWp.z, -1400.0);
        float ga = mix(0.6283, 0.0, north);
        vec2 gp = mat2(cos(ga), -sin(ga), sin(ga), cos(ga)) * vWp.xz / vec2(mix(92.0, 120.0, north), mix(124.0, 85.0, north));
        vec2 gf = abs(fract(gp) - 0.5);
        float gw = max(fwidth(gp.x), fwidth(gp.y));
        float street = (1.0 - smoothstep(0.43 - gw, 0.45 + gw, max(gf.x, gf.y))) ;
        street = mix(1.0 - street, 0.18, smoothstep(0.15, 0.5, gw));
        town = mix(town, vec3(0.03, 0.03, 0.032), street * 0.85);
        vec3 alb = mix(forest, town, vKind.x);
        vec4 ng = texture2D(uNoise, vWp.xz / 23.0);
        alb = mix(alb, mix(vec3(0.03, 0.055, 0.02), vec3(0.05, 0.075, 0.03), ng.g) * (0.85 + 0.3 * ng.a), vKind.z);
        alb = mix(alb, vec3(0.13, 0.125, 0.115) * (0.9 + 0.2 * ng.b), smoothstep(0.45, 0.8, vKind.w));
        float steep = 1.0 - n.y;
        alb = mix(alb, rock, max(smoothstep(0.38, 0.62, steep) * smoothstep(450.0, 900.0, alt), smoothstep(1300.0, 1520.0, alt) * 0.7));
        float sl = uSnowLine + (nz.b - 0.5) * 300.0;
        float snow = smoothstep(sl, sl + 140.0, alt) * smoothstep(0.42, 0.62, n.y + 0.2 * smoothstep(sl + 250.0, sl + 650.0, alt));
        alb = mix(alb, vec3(0.8, 0.82, 0.86), snow * (0.85 + 0.15 * nf.g));
        alb = mix(alb, vec3(0.12, 0.115, 0.105), smoothstep(2.2, 0.8, alt) * smoothstep(-4.0, -1.0, alt));
        float sun = max(dot(n, uSunDir), 0.0);
        vec3 col = alb * (uSunCol * sun + uAmbient * (0.5 + 0.5 * n.y) + uMoonAmb * (0.3 + max(dot(n, uMoonDir), 0.0)));
        col += vec3(0.022, 0.013, 0.006) * vKind.x * uNight * smoothstep(-2.0, 20.0, alt) * smoothstep(7000.0, 1500.0, dist) * (0.6 + 0.8 * nf.a);
        col = applyHaze(col, vWp);
        float lc = lowCloud(vWp);
        if (lc > 0.001) { vec3 vd = normalize(vWp - cameraPosition); col = mix(col, skyFull(vec3(vd.x, max(vd.y, 0.02), vd.z)) * mix(0.94, 1.03, nz.a), lc * (0.85 + 0.15 * nz.a)); }
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  }));
  return { mesh, sil };
}

// The water mirrors the skyline as seen from the eye's mirror image below the surface.
export function addTowersToSilhouette(sil, towers) {
  const mirrorY = WATER_Y - (EYE[1] - WATER_Y);
  for (const t of towers) {
    if (t.own || t.h < 20) continue;
    const dx = t.x - EYE[0], dn = EYE[2] - t.z, d = Math.hypot(dx, dn);
    if (d < 120) continue;
    const az = Math.atan2(dx, dn), half = Math.atan2(Math.max(t.w, t.d) * 0.5, d), el = Math.atan2(t.base + t.h - mirrorY, d);
    const b0 = Math.floor(((az - half) / (Math.PI * 2) + 0.5) * SIL_N), b1 = Math.ceil(((az + half) / (Math.PI * 2) + 0.5) * SIL_N);
    for (let b = b0; b <= b1; b++) {
      const k = ((b % SIL_N) + SIL_N) % SIL_N;
      if (el > sil.el[k]) { sil.el[k] = el; sil.dist[k] = d; sil.tower[k] = 1; }
    }
  }
  return sil;
}

// Each canopy is a few jittered lumps so its outline breaks up.
function treeGeometry(kind, rand) {
  const parts = [];
  if (kind === 'fir') {
    for (let k = 0; k < 4; k++) parts.push(new THREE.ConeGeometry(2.6 - k * 0.55, 5.2 - k * 0.6, 7, 1).translate(0, 3.2 + k * 3, 0));
  } else {
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26 + rand(), r = k ? 1.7 : 0;
      parts.push(new THREE.IcosahedronGeometry(2.3 + rand() * 0.8, 1).translate(Math.cos(a) * r, 6.2 + (k ? rand() * 1.6 - 0.4 : 1.2), Math.sin(a) * r));
    }
  }
  parts.push(new THREE.CylinderGeometry(0.22, 0.3, 3.6, 5).translate(0, 1.8, 0));
  const flat = parts.map(p => (p.index ? p.toNonIndexed() : p));
  const g = mergeGeometries(flat);
  parts.forEach(p => p.dispose());
  flat.forEach(p => p.dispose());
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 2.2) continue;
    const k = 0.35 * (Math.sin(pos.getX(i) * 3.1 + y * 1.7) + Math.cos(pos.getZ(i) * 2.7 - y * 2.3));
    pos.setX(i, pos.getX(i) * (1 + k * 0.18)); pos.setZ(i, pos.getZ(i) * (1 + k * 0.18)); pos.setY(i, y + k * 0.25);
  }
  return g;
}

export function makeTrees(U, q) {
  const rand = rng(31), spots = [];
  const want = q === 'low' ? 60 : 150;
  for (let i = 0; i < 4000 && spots.length < want; i++) {
    const dx = (rand() - 0.5) * 1300, dn = rand() * 120;
    const inS = shoreS(dx) - dn, h = landHeight(dx, dn);
    if (inS < 13 || inS > 34 + (Math.abs(dx) > 120 ? 30 : 0) || h < 2 || inPark(dx, dn) < 1.3 || (Math.abs(dx) < 16 && dn < 14)) continue;
    if (spots.some(s => Math.hypot(s[0] - dx, s[1] - dn) < 8.5)) continue;
    spots.push([dx, dn, h, rand() < 0.62]);
  }
  const make = (geo, list, colour) => {
    const m = new THREE.InstancedMesh(geo, material(U, {
      low: q === 'low',
      vertex: `varying vec3 vWp, vN, vCol; varying float vY;
        void main() {
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWp = wp.xyz; vN = normalize(mat3(instanceMatrix) * normal); vCol = instanceColor; vY = position.y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragment: `varying vec3 vWp, vN, vCol; varying float vY;
        void main() {
          vec3 n = normalize(vN);
          float leaf = 0.7 + 0.45 * texture2D(uNoise, vWp.xz / 3.1 + vWp.y / 2.3).a * texture2D(uNoise, vWp.zy / 4.3).b;
          vec3 alb = vY < 2.2 ? vec3(0.06, 0.045, 0.035) : vCol * leaf;
          float ao = 0.45 + 0.55 * smoothstep(1.5, 11.0, vY);
          vec3 col = alb * ao * (uSunCol * max(dot(n, uSunDir), 0.0) + uAmbient * (0.5 + 0.5 * n.y) + uMoonAmb);
          gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
          ${OUT}
        }`,
    }), Math.max(1, list.length));
    m.count = list.length;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    list.forEach(([dx, dn, h], i) => {
      const s = 0.8 + rand() * 0.45;
      S.set(s, s * (0.85 + rand() * 0.35), s);
      Q.setFromAxisAngle(Y, rand() * 6.3);
      P.set(wx(dx), WATER_Y + h - 0.3, wz(dn));
      m.setMatrixAt(i, M.compose(P, Q, S));
      m.setColorAt(i, C.setRGB(...colour(rand)));
    });
    m.instanceMatrix.needsUpdate = true;
    return m;
  };
  return {
    firs: make(treeGeometry('fir', rand), spots.filter(s => !s[3]), r => [0.018 + r() * 0.008, 0.036 + r() * 0.012, 0.024]),
    leafy: make(treeGeometry('leafy', rand), spots.filter(s => s[3]), () => [0.05, 0.08, 0.03]),
  };
}

export function dressTrees(trees, month) {
  const autumn = month >= 10 && month <= 11, bare = month === 12 || month <= 3;
  const m = trees.leafy, C = new THREE.Color(), rand = rng(77);
  for (let i = 0; i < m.count; i++) {
    const r = rand();
    if (autumn) C.setRGB(...(r < 0.35 ? [0.11, 0.075, 0.018] : r < 0.6 ? [0.085, 0.04, 0.014] : r < 0.8 ? [0.06, 0.06, 0.02] : [0.04, 0.06, 0.024]));
    else if (bare) C.setRGB(0.05, 0.042, 0.035);
    else C.setRGB(0.04 + r * 0.02, 0.07 + r * 0.02, 0.025);
    m.setColorAt(i, C);
  }
  m.instanceColor.needsUpdate = true;
}
