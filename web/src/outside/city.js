import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, OUT } from './glsl.js';
import { WATER_Y, BRIDGE, DOCKS, deckHeight, cableHeight, bridgePoint, landHeight, marinaLayout, wx, wz } from '../pure/outside.js';

// Styles: 0 glass, 1 concrete, 2 dark glass, 3 shops, 4 cruise decks, 5 white, 6 dark hull, 7 plane, 8 our building.
const FACADE_V = /* glsl */ `
  attribute float aStyle, aSeed;
  varying vec3 vWp, vN; varying vec2 vFace; varying float vStyle, vSeed;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 wp = m * vec4(position, 1.0);
    vec3 sc = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
    vec3 lp = position * sc, an = abs(normal);
    vFace = an.x > 0.5 ? vec2(lp.z, lp.y) : an.z > 0.5 ? vec2(lp.x, lp.y) : lp.xz;
    vN = normalize(mat3(m) * normal);
    vWp = wp.xyz; vStyle = aStyle; vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FACADE_F = /* glsl */ `
  varying vec3 vWp, vN; varying vec2 vFace; varying float vStyle, vSeed;
  void main() {
    int st = int(vStyle + 0.5);
    vec3 n = normalize(vN), V = normalize(vWp - cameraPosition);
    vec2 cs = vec2(1.5, 3.0), open = vec2(0.94, 0.7);
    float hue = fract(vSeed * 7.13);
    vec3 alb = mix(vec3(0.42, 0.42, 0.4), vec3(0.36, 0.34, 0.3), hue), tint = mix(vec3(0.012, 0.03, 0.034), vec3(0.016, 0.026, 0.036), hue);
    float reflK = 0.14, litK = 1.0, plain = 0.0, band = 0.16;
    if (st == 1) { cs = vec2(2.8, 3.0); open = vec2(0.55, 0.5); alb = mix(vec3(0.26, 0.25, 0.23), vec3(0.3, 0.27, 0.22), hue); tint = vec3(0.015); reflK = 0.12; band = 0.0; }
    else if (st == 2) { cs = vec2(1.8, 3.4); open = vec2(0.9, 0.78); alb = vec3(0.04); tint = vec3(0.008, 0.011, 0.014); reflK = 0.22; band = 0.0; }
    else if (st == 3) { cs = vec2(5.0, 4.6); open = vec2(0.8, 0.55); alb = vec3(0.22, 0.2, 0.18); tint = vec3(0.02); reflK = 0.2; litK = 1.6; }
    else if (st == 4) { cs = vec2(1.25, 2.9); open = vec2(0.72, 0.42); alb = vec3(0.62, 0.62, 0.6); tint = vec3(0.02); reflK = 0.15; litK = 1.7; }
    else if (st == 5) { plain = 1.0; alb = vec3(0.6, 0.6, 0.58); }
    else if (st == 6) { plain = 1.0; alb = vec3(0.018, 0.026, 0.05); }
    else if (st == 7) { plain = 1.0; alb = vec3(0.62, 0.6, 0.5); }
    else if (st == 8) { cs = vec2(3.2, 3.0); open = vec2(0.62, 0.55); alb = vec3(0.27, 0.26, 0.25); tint = vec3(0.02); reflK = 0.2; }
    vec3 diffuse = uSunCol * max(dot(n, uSunDir), 0.0) + uAmbient * (0.55 + 0.45 * n.y) + uMoonAmb * 0.6;
    vec3 col;
    if (n.y > 0.5 || plain > 0.5) {
      col = (n.y > 0.5 && plain < 0.5 ? vec3(0.09, 0.09, 0.085) : alb) * diffuse;
    } else {
      vec2 g = vFace / cs, cell = floor(g), f = fract(g);
      vec2 w = fwidth(g);
      float fp = max(w.x, w.y), aa = smoothstep(0.22, 0.75, fp);
      float lod = fp > 0.7 ? exp2(ceil(log2(fp / 0.7))) : 1.0;
      cell = floor(g / lod);
      float win = step(abs(f.x - 0.5), open.x * 0.5) * step(abs(f.y - 0.55), open.y * 0.5);
      win = mix(win, open.x * open.y, aa);
      float office = (st == 1 || st == 2) ? 1.0 : 0.0;
      float frac = clamp(mix(uWinFrac, uOffFrac, office) * litK + (vSeed - 0.5) * 0.2, 0.0, 0.95);
      vec2 unit = vec2(floor(cell.x / mix(3.0, 1.0, max(office, step(1.5, lod)))), cell.y);
      float lit = step(hash13(vec3(unit, vSeed * 97.0)), frac);
      if (hash13(vec3(unit + 17.3, vSeed * 53.0)) < 0.07) {
        float ep = floor(uTime / 45.0 + hash13(vec3(unit, 3.3)) * 9.0);
        lit = step(hash13(vec3(unit, vSeed * 31.0 + ep)), frac);
      }
      float h2 = hash13(vec3(unit, vSeed * 11.0 + 5.0));
      vec3 wcol = office > 0.5 ? vec3(0.85, 0.9, 1.0) : h2 > 0.86 ? vec3(0.65, 0.75, 1.0) : mix(vec3(1.0, 0.58, 0.28), vec3(1.0, 0.8, 0.58), h2 / 0.86);
      float dim = hash13(vec3(unit, vSeed * 7.0 + 1.0));
      wcol *= 0.2 + 1.1 * dim * dim;
      vec3 tilt = (vec3(hash13(vec3(cell, 1.7)), hash13(vec3(cell, 2.9)), hash13(vec3(cell, 4.1))) - 0.5) * 0.05 * (1.0 - aa);
      vec3 gn = normalize(n + tilt);
      vec3 R = reflect(V, gn);
      R.y = abs(R.y) * 0.9 + 0.01;
      float fres = fresnel(dot(-V, gn), 0.05);
#ifdef LOW
      vec3 refl = skyBase(normalize(R));
#else
      vec3 refl = skyFull(normalize(R));
#endif
      vec3 pane = tint * diffuse + refl * mix(reflK, 0.8, fres) * (0.8 + 0.4 * hash13(vec3(cell, 8.3)));
      pane += uSunDisc * pow(max(dot(normalize(R), uSunDir), 0.0), 2500.0) * 0.05 * (1.0 - uCloud);
      float slab = (band > 0.0 ? step(1.0 - band, fract(g.y)) : step(0.93, fract(g.y))) * (1.0 - aa);
      vec3 wall = st == 2 ? tint * 0.6 + refl * reflK * 0.5 : alb * diffuse;
      col = mix(wall, pane, win * (1.0 - slab));
      if (band > 0.0) col = mix(col, alb * diffuse * 1.1, slab + aa * band);
      col += wcol * lit * win * mix(0.05, 1.0, uNight) * 0.9;
    }
    gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
    ${OUT}
  }`;

export function facadeMaterial(U, q) {
  return material(U, { low: q === 'low', vertex: FACADE_V, fragment: FACADE_F });
}

export const unitBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

function instanceBoxes(U, q, items, mat) {
  const geo = unitBox(), n = items.length;
  const aStyle = new Float32Array(n), aSeed = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  items.forEach((t, i) => {
    Q.setFromAxisAngle(Y, t.rot || 0);
    mesh.setMatrixAt(i, M.compose(P.set(t.x, t.base, t.z), Q, S.set(t.w, t.h, t.d)));
    aStyle[i] = t.style; aSeed[i] = t.seed;
  });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(aStyle, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function makeTowers(U, q, towers, mat) {
  const items = towers.slice();
  for (const [dx, dn, len, beam, h, end, dark] of marinaLayout()) {
    const hull = len - beam * 0.5, x = wx(dx), z = wz(dn);
    items.push({ x, z: z + end * beam * 0.25, w: beam, d: hull, h, rot: 0, style: dark ? 6 : 5, base: WATER_Y - 0.5, seed: 0.2 });
    items.push({ x, z: z - end * (hull / 2 - beam * 0.25), w: beam * 0.707, d: beam * 0.707, h, rot: Math.PI / 4, style: dark ? 6 : 5, base: WATER_Y - 0.5, seed: 0.2 });
    items.push({ x, z: z + end * len * 0.12, w: beam * 0.62, d: len * 0.36, h: 1.2 + h * 0.3, rot: 0, style: 5, base: WATER_Y - 0.5 + h, seed: 0.3 });
  }
  for (const dn of DOCKS) items.push({ x: wx(-300), z: wz(dn), w: 420, d: 2.2, h: 0.9, rot: 0, style: 6, base: WATER_Y - 0.5, seed: 0.1 });
  return instanceBoxes(U, q, items, mat);
}

// Cars and boat lights keep their parameters in position, and the shader places them.
export function makeLights(U, q, list, extra) {
  const all = list.concat(extra), n = all.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), info = new Float32Array(n * 4);
  all.forEach((l, i) => {
    const [kind, a, b, c, r, g, bl, size, ph, vi = 0] = l;
    if (kind >= 7) pos.set([a, b, c], i * 3);
    else pos.set([wx(a), WATER_Y + b, wz(c)], i * 3);
    col.set([r, g, bl], i * 3);
    info.set([kind, size, ph, vi], i * 4);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  const pts = new THREE.Points(geo, material(U, {
    low: q === 'low', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertex: `attribute vec3 aCol; attribute vec4 aInfo; varying vec3 vCol;
      void main() {
        float kind = aInfo.x;
        vec3 wp = position;
        float vis = uNight, b = 1.0;
        if (kind > 1.5 && kind < 2.5) vis *= uSki;
        if (kind > 2.5 && kind < 3.5) b = 0.35 + 1.6 * pow(max(sin(uTime * 2.6 + aInfo.z * 6.28), 0.0), 6.0);
        if (kind > 6.5 && kind < 8.5) {
          float s0 = ${BRIDGE.south.toFixed(1)}, s1 = ${BRIDGE.north.toFixed(1)};
          float u = fract(position.x + uTime * position.z);
          float s = kind < 7.5 ? mix(s1, s0, u) : mix(s0, s1, u);
          wp = vec3(deckXZ(s, position.y), 0.0).xzy;
          wp.y = deckY(s) + 1.2;
          vis = 0.15 + 0.85 * uNight;
          b = smoothstep(s0, s0 + 120.0, s) * smoothstep(s1, s1 - 60.0, s);
        }
        if (kind > 8.5) {
          int vi = int(aInfo.w);
          wp = (uVessel[vi] * vec4(position, 1.0)).xyz;
          vis = uVesselOn[vi] * (0.3 + 0.7 * uNight);
          if (aInfo.z > 0.5) b = step(0.9, fract(uTime * 0.8 + aInfo.z));
        }
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        float dist = max(-mv.z, 1.0);
        float px = aInfo.y * projectionMatrix[1][1] * 0.5 * uRes / dist;
        float s = max(px, 1.7 * uPx);
        b *= clamp(px * px / (s * s) * 3.0 + 0.3, 0.0, 1.0);
        float T = exp(-hazeOD(cameraPosition, wp) * 0.85) * (1.0 - lowCloud(wp));
        vCol = aCol * b * vis * T * 1.35;
        gl_PointSize = s;
        gl_Position = vis * b * T < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
      }`,
    fragment: `varying vec3 vCol;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vCol * exp(-r * r * 3.0), 1.0);
        ${OUT}
      }`,
  }));
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return pts;
}

export function makeBridge(U, q) {
  const parts = [], P = [0, 0], Y = new THREE.Vector3(0, 1, 0), rot = Math.PI / 2 - BRIDGE.az;
  const box = (s, side, y0, len, w, h, colour, extraRot = 0) => {
    bridgePoint(s, side, P);
    const g = unitBox().scale(len, h, w).rotateY(rot + extraRot).translate(wx(P[0]), y0, wz(P[1]));
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) c.set(colour, i);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(g);
  };
  const green = [0.045, 0.085, 0.06], concrete = [0.24, 0.235, 0.22], deck = [0.06, 0.07, 0.065];
  for (let s = BRIDGE.south + 300; s < BRIDGE.north; s += 16) {
    const mid = s + 8, y = WATER_Y + deckHeight(mid), main = Math.abs(mid) <= BRIDGE.anchor;
    box(mid, 0, y - (main ? 4.5 : 2.5), 16.4, 18, main ? 4.5 : 2.5, main ? green : deck);
  }
  for (const s of [-BRIDGE.main, BRIDGE.main]) {
    for (const side of [-9.5, 9.5]) {
      box(s, side, WATER_Y - 2, 6, 5, BRIDGE.top + 2, green);
      box(s, side, WATER_Y - 2, 13, 11, 9, concrete);
    }
    for (const y of [deckHeight(s) - 7, 86, BRIDGE.top - 4]) box(s, 0, WATER_Y + y, 4, 19, 3.5, green);
  }
  for (const s of [-BRIDGE.anchor, BRIDGE.anchor]) {
    bridgePoint(s, 0, P);
    const ground = WATER_Y + Math.max(0, landHeight(P[0], P[1]));
    box(s, 0, ground - 4, 22, 21, WATER_Y + deckHeight(s) - ground + 2, [0.1, 0.1, 0.095]);
  }
  for (let s = BRIDGE.anchor + 60; s < BRIDGE.north - 20; s += 55) {
    for (const side of [-6, 6]) {
      bridgePoint(s, side, P);
      const ground = WATER_Y + Math.max(0, landHeight(P[0], P[1])) - 2, top = WATER_Y + deckHeight(s) - 2.5;
      if (top > ground + 2) box(s, side, ground, 3.2, 3.2, top - ground, concrete);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), material(U, {
    low: q === 'low', vertexColors: true,
    vertex: `varying vec3 vWp, vN, vCol;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; vN = normal; vCol = color; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragment: `varying vec3 vWp, vN, vCol;
      void main() {
        vec3 n = normalize(vN);
        vec3 col = vCol * (uSunCol * max(dot(n, uSunDir), 0.0) * 1.2 + uAmbient * (0.6 + 0.4 * n.y) + uMoonAmb);
        col += vec3(0.05, 0.07, 0.05) * uNight * smoothstep(${(WATER_Y + 70).toFixed(1)}, ${(WATER_Y + 110).toFixed(1)}, vWp.y);
        gl_FragColor = vec4(applyHaze(col, vWp), 1.0);
        ${OUT}
      }`,
  }));
  parts.forEach(g => g.dispose());
  return mesh;
}

export function makeLines(U, q) {
  const v = [], c = [], P = [0, 0];
  const seg = (a, b, colour) => { v.push(...a, ...b); c.push(...colour, ...colour); };
  const at = (s, side, h) => { bridgePoint(s, side, P); return [wx(P[0]), WATER_Y + h, wz(P[1])]; };
  const cable = [0.07, 0.09, 0.08];
  for (const side of [-8.5, 8.5]) {
    for (let s = -BRIDGE.anchor; s < BRIDGE.anchor; s += 6) seg(at(s, side, cableHeight(s)), at(s + 6, side, cableHeight(s + 6)), cable);
    for (let s = -BRIDGE.anchor + 12; s < BRIDGE.anchor; s += 12) {
      if (Math.abs(Math.abs(s) - BRIDGE.main) < 6) continue;
      seg(at(s, side, deckHeight(s)), at(s, side, cableHeight(s)), cable);
    }
  }
  for (const [dx, dn, len, , h] of marinaLayout()) {
    if (len < 13) continue;
    seg([wx(dx), WATER_Y + h, wz(dn)], [wx(dx), WATER_Y + h + len * 1.1, wz(dn)], [0.5, 0.5, 0.5]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const lines = new THREE.LineSegments(geo, material(U, {
    low: q === 'low', vertexColors: true, transparent: true, depthWrite: false,
    vertex: `varying vec3 vWp, vCol; void main() { vWp = position; vCol = color; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragment: `varying vec3 vWp, vCol;
      void main() {
        vec3 col = vCol * (uSunCol * 0.6 + uAmbient * 1.2 + uMoonAmb);
        gl_FragColor = vec4(applyHaze(col, vWp), 0.7);
        ${OUT}
      }`,
  }));
  lines.renderOrder = 3;
  return lines;
}

export function bridgeExtras(q) {
  const out = [], P = [0, 0];
  for (let s = BRIDGE.south + 320; s < BRIDGE.north - 30; s += 34) {
    for (const side of [-9.4, 9.4]) {
      bridgePoint(s, side, P);
      out.push([4, P[0], deckHeight(s) + 7, P[1], 1.0, 0.7, 0.4, 1.4, 0]);
    }
  }
  const span = BRIDGE.north - BRIDGE.south, cars = q === 'low' ? 26 : 46;
  for (let i = 0; i < cars; i++) {
    const south = i % 2 === 0, speed = 15 / span * (0.85 + ((i * 37) % 11) / 30);
    out.push([south ? 7 : 8, (i * 0.618034) % 1, south ? 2.2 : -2.2, speed, south ? 1.0 : 1.0, south ? 0.92 : 0.1, south ? 0.8 : 0.06, 1.5, 0]);
  }
  return out;
}

