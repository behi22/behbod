import * as THREE from 'three';
import { WATER_Y, LAT, BRIDGE, deckHeight } from '../pure/outside.js';

const f = n => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const v3 = () => ({ value: new THREE.Vector3() });

// One set of uniform objects shared by every material, so each frame writes them once.
export function makeUniforms() {
  return {
    uLow: { value: 0 }, uTime: { value: 0 }, uRes: { value: 900 }, uPx: { value: 1 },
    uSunDir: v3(), uSunCol: v3(), uSunDisc: v3(), uZenith: v3(), uHorizon: v3(), uHorizonSun: v3(), uGlow: v3(), uAmbient: v3(),
    uCloudLit: v3(), uCloudDark: v3(), uCloud: { value: 0.2 }, uCloudOff: { value: new THREE.Vector2() },
    uNight: { value: 0 }, uStars: { value: 0 },
    uMoonDir: v3(), uMoonLight: v3(), uMoonK: { value: 0 }, uMoonAmb: v3(),
    uHazeD: { value: 5.5e-5 }, uFog: { value: 0 }, uRain: { value: 0 }, uSnow: { value: 0 }, uRough: { value: 0.5 },
    uFlash: { value: new THREE.Vector4() }, uFlashCol: v3(), uAurora: { value: 0 },
    uWinFrac: { value: 0.3 }, uOffFrac: { value: 0.1 }, uSnowLine: { value: 1500 }, uSki: { value: 0 }, uLst: { value: 0 }, uSeason: { value: 0 },
    uNoise: { value: null }, uWave: { value: null }, uSil: { value: null },
    uVessel: { value: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()] }, uVesselOn: { value: [0, 0, 0] },
    uWake: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  };
}

export const COMMON = /* glsl */ `
#define WATER_Y ${f(WATER_Y)}
#define LAT ${f(LAT * Math.PI / 180)}
uniform float uLow, uTime, uRes, uPx, uCloud, uNight, uStars, uMoonK, uHazeD, uFog, uRain, uSnow, uRough, uAurora, uWinFrac, uOffFrac, uSnowLine, uSki, uLst, uSeason;
uniform vec3 uSunDir, uSunCol, uSunDisc, uZenith, uHorizon, uHorizonSun, uGlow, uAmbient, uCloudLit, uCloudDark, uMoonDir, uMoonLight, uMoonAmb, uFlashCol;
uniform vec2 uCloudOff;
uniform vec4 uFlash;
uniform sampler2D uNoise, uWave, uSil;
uniform mat4 uVessel[3];
uniform float uVesselOn[3];
uniform vec4 uWake[3];

// pow of a negative is NaN on the GPU, and bloom smears one NaN pixel over the whole frame.
float fresnel(float c, float f0) { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

vec3 horizonCol(vec3 d) {
  float l = length(d.xz), ls = length(uSunDir.xz);
  float s = (l > 1e-4 && ls > 1e-4) ? dot(d.xz / l, uSunDir.xz / ls) : 0.0;
  return mix(uHorizon, uHorizonSun, pow(clamp(0.5 + 0.5 * s, 0.0, 1.0), 2.6));
}

vec3 skyBase(vec3 d) {
  float h = max(d.y, 0.0);
  vec3 col = mix(horizonCol(d), uZenith, 1.0 - exp(-h * 4.2));
  float mu = max(dot(d, uSunDir), 0.0);
  col += uGlow * (0.2 * pow(mu, 5.0) + 0.6 * pow(mu, 42.0)) * (1.0 - 0.6 * h);
  col += uFlashCol * pow(max(dot(d, uFlash.xyz), 0.0), 40.0) * uFlash.w;
  return col;
}

vec3 hazeTint(vec3 d) {
  float mu = max(dot(d, uSunDir), 0.0);
  return mix(horizonCol(d), uZenith, 0.22) + uGlow * pow(mu, 7.0) * 0.45 + uFlashCol * pow(max(dot(d, uFlash.xyz), 0.0), 30.0) * uFlash.w * 0.5;
}

// Haze thins with height, so the foot of a mountain sits in more of it than the summit.
float hazeOD(vec3 a, vec3 b) {
  float d = length(b - a);
  float h0 = (a.y - WATER_Y) / 1100.0, h1 = (b.y - WATER_Y) / 1100.0, dh = h1 - h0;
  float k = abs(dh) < 1e-3 ? exp(-h0) : (exp(-h0) - exp(-h1)) / dh;
  return uHazeD * d * k;
}

// Wet days hang cloud on the North Shore peaks.
float lowCloud(vec3 wp) {
  if (uLow < 0.01) return 0.0;
  float base = mix(1100.0, 520.0, uLow) + sin(wp.x * 0.0011 + uTime * 0.01) * 120.0 + sin(wp.z * 0.0017 - uTime * 0.007) * 90.0;
  return uLow * smoothstep(base - 120.0, base + 160.0, wp.y - WATER_Y) * smoothstep(2500.0, 5000.0, -wp.z);
}

vec3 applyHaze(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float a = 1.0 - exp(-hazeOD(cameraPosition, wp));
  return mix(col, hazeTint(v / max(length(v), 1e-3)), a);
}

float deckY(float s) {
  float a = ${f(BRIDGE.anchor)};
  if (s < -a) return WATER_Y + ${f(deckHeight(-BRIDGE.anchor - 1))};
  if (s <= a) return WATER_Y + 66.0 - 0.000033 * s * s;
  return WATER_Y + ${f(deckHeight(BRIDGE.anchor))} - (s - a) * 0.052;
}
vec2 deckXZ(float s, float side) {
  vec2 ax = vec2(${f(Math.sin(BRIDGE.az))}, ${f(Math.cos(BRIDGE.az))});
  vec2 p = vec2(${f(BRIDGE.cx)}, ${f(BRIDGE.cn)}) + ax * s + vec2(ax.y, -ax.x) * side;
  return vec2(11.0 + p.x, -14.5 - p.y);
}
`;

// Clouds are a texture plane seen through the dome; fragment stages only.
export const CLOUDS = /* glsl */ `
float cloudAt(vec3 d) {
  if (d.y < 0.004) return uCloud * 0.85;
  vec2 p = d.xz / (d.y + 0.07) * 0.3 + uCloudOff;
  float n = texture2D(uNoise, p).r * 0.62 + texture2D(uNoise, p * 2.6 + 0.37).g * 0.26;
#ifdef LOW
  n += 0.06;
#else
  n += texture2D(uNoise, p * 6.3 + 0.71).b * 0.12;
#endif
  float t0 = mix(0.78, 0.1, uCloud);
  float c = smoothstep(t0, t0 + 0.2, n);
  return mix(c, uCloud * 0.85, smoothstep(0.3, 0.015, d.y) * 0.8);
}
vec3 cloudShade(vec3 d, float c) {
  float mu = max(dot(d, uSunDir), 0.0);
  float k = mix(smoothstep(0.25, 1.0, c) * 0.75, 0.5 + 0.25 * (c - 0.75), smoothstep(0.7, 1.0, uCloud)) + uRain * 0.15;
  vec3 col = mix(uCloudLit, uCloudDark, k);
  col += uGlow * pow(mu, 6.0) * (1.0 - c) * 1.3;
  col += uFlashCol * pow(max(dot(d, uFlash.xyz), 0.0), 20.0) * uFlash.w * 1.5;
  float mm = max(dot(d, uMoonDir), 0.0);
  col += uMoonAmb * pow(mm, 30.0) * 3.0;
  return col;
}
vec3 skyFull(vec3 d) {
  vec3 s = skyBase(d);
  float c = cloudAt(d);
  return mix(s, cloudShade(d, c), c * 0.96);
}
`;

export const OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

export function material(U, { vertex, fragment, uniforms = {}, low = false, defines = {}, ...rest }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...uniforms },
    defines: { ...(low ? { LOW: 1 } : {}), ...defines },
    vertexShader: COMMON + vertex,
    fragmentShader: COMMON + CLOUDS + fragment,
    ...rest,
  });
}
