import * as THREE from 'three';
import { material, OUT } from './glsl.js';
import { WATER_Y, EYE } from '../pure/outside.js';

export function makeWater(U, q) {
  const geo = new THREE.PlaneGeometry(64000, 64000).rotateX(-Math.PI / 2).translate(EYE[0], WATER_Y, EYE[2]);
  const mesh = new THREE.Mesh(geo, material(U, {
    low: q === 'low',
    vertex: `varying vec3 vWp; void main() { vWp = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragment: `varying vec3 vWp;
      vec2 slope(vec2 uv) { return texture2D(uWave, uv).rg * 2.0 - 1.0; }
      float wake(vec2 p) {
        float f = 0.0;
        for (int i = 0; i < 3; i++) {
          vec4 w = uWake[i];
          if (w.w < 0.05) continue;
          vec2 fwd = vec2(sin(w.z), -cos(w.z)), d = p - w.xy;
          float along = -dot(d, fwd), across = dot(d, vec2(-fwd.y, fwd.x));
          if (along < -20.0 || along > 900.0) continue;
          float len = 40.0 + w.w * 22.0;
          float arm = abs(abs(across) - along * 0.36 - 4.0);
          float v = exp(-arm * arm / (6.0 + along * 0.25)) * 0.45 + exp(-across * across / (25.0 + along * 1.2)) * 0.6;
          f += v * exp(-max(along, 0.0) / len) * smoothstep(-15.0, 0.0, along) * min(w.w / 5.0, 1.0);
        }
        return f;
      }
      void main() {
        vec3 V = vWp - cameraPosition;
        float dist = length(V);
        V /= dist;
        vec2 p = vWp.xz;
        float fade = 1.0 / (1.0 + dist / 2500.0);
        vec2 g = slope(p / 150.0 + uTime * vec2(0.0021, 0.0013)) * 0.16 + slope(p / 41.0 + uTime * vec2(-0.0052, 0.0068)) * 0.26
          + slope(p / 11.0 + uTime * vec2(0.014, -0.011)) * 0.34;
#ifndef LOW
        g += slope(p / 3.1 + uTime * vec2(-0.035, 0.028)) * 0.34 * smoothstep(260.0, 40.0, dist);
        g += slope(p / 1.3 + uTime * vec2(-0.09, 0.07)) * uRain * 0.6 * smoothstep(150.0, 30.0, dist);
#endif
        g *= uRough * (1.0 + uRain * 0.5) * fade;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 R = reflect(V, N);
        R.y = max(R.y, 0.002);
        R = normalize(R);
        float cosI = max(dot(-V, N), 0.0);
        float fres = fresnel(cosI, 0.02);
        vec3 refl = skyFull(R);
        vec4 sil = texture2D(uSil, vec2(atan(R.x, -R.z) / 6.28318 + 0.5, 0.5));
        float landEl = sil.r * 0.3 - 0.02, el = asin(R.y);
        float land = smoothstep(landEl + 0.012, landEl - 0.02, el);
        float ldist = 100.0 * exp(sil.g * log(300.0));
        vec3 lalb = mix(vec3(0.02, 0.032, 0.022), vec3(0.16, 0.16, 0.17), sil.b);
        vec3 lcol = lalb * (uSunCol * 0.45 + uAmbient * 0.8) + vec3(1.0, 0.7, 0.4) * sil.b * uWinFrac * uNight * 0.12;
        lcol = mix(lcol, hazeTint(R), 1.0 - exp(-uHazeD * ldist * 0.75));
        refl = mix(refl, lcol, land);
        vec3 body = vec3(0.004, 0.013, 0.014) * (uAmbient * 2.4 + uSunCol * 0.3);
        vec3 col = body + refl * fres;
        float sunK = (pow(max(dot(R, uSunDir), 0.0), 900.0) * 60.0 + pow(max(dot(R, uSunDir), 0.0), 90.0) * 0.8) * (1.0 - land) * (1.0 - uCloud * 0.9);
        col += uSunDisc * sunK * 0.03;
        float moonK = pow(max(dot(R, uMoonDir), 0.0), 500.0) * 4.0 + pow(max(dot(R, uMoonDir), 0.0), 60.0) * 0.25;
        col += uMoonAmb * moonK * 20.0 * (1.0 - land) * (1.0 - uCloud * 0.9);
        float foam = wake(p) * smoothstep(5000.0, 300.0, dist);
        foam *= 0.55 + 0.45 * texture2D(uNoise, p / 9.0 + uTime * 0.01).b;
        col = mix(col, uAmbient * 0.8 + uSunCol * 0.45 + uMoonAmb, clamp(foam * 0.7, 0.0, 0.6));
        col = applyHaze(col, vWp);
        col = mix(col, hazeTint(V), smoothstep(17000.0, 30000.0, dist));
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// Each streak lies on the water surface, so nearer land or a boat still hides it.
export function makeStreaks(U, q, list) {
  const n = list.length, base = new THREE.PlaneGeometry(1, 1, 1, 6);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  const aPos = new Float32Array(n * 3), aCol = new Float32Array(n * 3), aW = new Float32Array(n * 3);
  list.forEach((s, i) => { aPos.set([s.x, s.h, s.z], i * 3); aCol.set(s.c, i * 3); aW.set([s.w, s.kind, s.v ?? 0], i * 3); });
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
  geo.setAttribute('aW', new THREE.InstancedBufferAttribute(aW, 3));
  geo.instanceCount = n;
  const mesh = new THREE.Mesh(geo, material(U, {
    low: q === 'low', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertex: `attribute vec3 aPos, aCol, aW; varying vec3 vCol; varying vec2 vUv; varying float vDist, vPeak, vSeed;
      void main() {
        vec3 L = vec3(aPos.x, WATER_Y + aPos.y, aPos.z);
        float k = aW.y, vis = uNight;
        if (k < 0.5) vis *= uWinFrac * 1.6;
        if (k > 2.5) {
          int vi = int(aW.z);
          L = (uVessel[vi] * vec4(aPos, 1.0)).xyz;
          vis *= uVesselOn[vi];
        }
        float He = max(cameraPosition.y - WATER_Y, 1.0), hl = max(L.y - WATER_Y, 0.5);
        vec2 to = L.xz - cameraPosition.xz;
        float D = max(length(to), 1.0);
        vec2 dir = to / D;
        float dR = atan(He + hl, D), dB = atan(He, D) + 0.0004;
        float sp = (0.025 + 0.06 * uRough + 0.05 * uRain);
        float dFar = max(dB, dR - sp * 0.3), dNear = min(dR + sp, 1.2);
        float t = position.y + 0.5;
        float dd = mix(dNear, dFar, t);
        float d = He / tan(dd);
        vec2 side = vec2(-dir.y, dir.x) * position.x * aW.x * d / D;
        vec3 wp = vec3(cameraPosition.xz + dir * d + side, 0.0).xzy;
        wp.y = WATER_Y + 0.05;
        vUv = vec2(position.x * 2.0, t);
        vPeak = (dNear - dR) / (dNear - dFar);
        vDist = d;
        vSeed = aPos.x * 0.013 + aPos.z * 0.007;
        float T = exp(-hazeOD(cameraPosition, L) * 0.9);
        vCol = aCol * vis * T * (1.0 - uFog * 0.7);
        if (vis * T < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragment: `varying vec3 vCol; varying vec2 vUv; varying float vDist, vPeak, vSeed;
      void main() {
        float wob = texture2D(uNoise, vec2(vSeed * 3.0, vDist / 40.0 + uTime * 0.01)).r - 0.5;
        float x = vUv.x + wob * 0.9;
        float across = exp(-x * x * 4.0);
        float len = 0.1 + 0.25 * fract(vSeed * 17.3);
        float a = vUv.y - vPeak;
        float along = exp(-a * a / (a > 0.0 ? 0.015 : len)) * smoothstep(1.0, 0.92, vUv.y);
        float n = texture2D(uNoise, vec2(vUv.x * 0.07 + vSeed, vDist / 6.0 - uTime * 0.07)).b * 0.6 + texture2D(uNoise, vec2(vUv.x * 0.2 - vSeed, vDist / 2.3 + uTime * 0.11)).a * 0.4;
        float dash = smoothstep(0.48, 0.75, n);
        gl_FragColor = vec4(vCol * across * along * dash * 1.9, 1.0);
        ${OUT}
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return mesh;
}
