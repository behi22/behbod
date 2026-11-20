import * as THREE from 'three';
import { skyPhase, vanTime } from './pure/calendar.js';
import * as P from './pure/outside.js';
import { makeUniforms } from './outside/glsl.js';
import { noiseTexture, waveTexture, silhouetteTexture } from './outside/textures.js';
import { makeSky } from './outside/sky.js';
import { makeTerrain, addTowersToSilhouette, makeTrees, dressTrees } from './outside/land.js';
import { makeWater, makeStreaks } from './outside/water.js';
import { facadeMaterial, makeTowers, makeLights, makeBridge, makeLines, bridgeExtras } from './outside/city.js';
import { makeVessels, makeGulls, vesselLights, vesselStreaks } from './outside/life.js';
import { makeRain, makeSnow, makeFireworks } from './outside/weather.js';
import { terrainData } from './pure/terrain.js';
import { makeRebuilder, STALE } from './pure/rebuild.js';
import { inSlices } from './pure/slices.js';

const DEG = Math.PI / 180;
const PALETTE = ['#ffcf6b', '#ff4d4d', '#5dff7a', '#5b8cff', '#cf6bff', '#fff4e6', '#5ef2ff', '#ff79c6'];
const WKEYS = ['cloud', 'overcast', 'rain', 'snow', 'fog', 'haze', 'rough', 'low'];
const HAZE = 3.4e-5;

function streakList(towers, lights) {
  const out = [];
  for (const t of towers) {
    if (t.own || t.style >= 3 || t.h < 30) continue;
    const dx = t.x - P.EYE[0], dn = P.EYE[2] - t.z;
    const fromS = P.shoreS(dx) - dn, fromN = dn - P.shoreN(dx);
    if ((fromS > 0 && fromS < 260) || (fromN > 0 && fromN < 500)) out.push({ x: t.x, h: t.base - P.WATER_Y + t.h * 0.55, z: t.z, w: t.w * 0.9, c: [1, 0.7, 0.4], kind: 0 });
  }
  lights.forEach((l, i) => {
    const [kind, dx, h, dn, r, g, b] = l;
    const fromN = dn - P.shoreN(dx);
    const keep = (kind <= 1 && fromN > 0 && fromN < 220 && i % 2 === 0) || kind === 4 || (kind === 5 && i % 7 === 0);
    if (keep) out.push({ x: P.wx(dx), h, z: P.wz(dn), w: kind === 4 ? 2.5 : kind === 5 ? 4 : 7 + (i % 5), c: [r * 0.55, g * 0.55, b * 0.55], kind: 2 });
  });
  return out.concat(vesselStreaks());
}

export function makeOutside3d(opts = {}) {
  const U = makeUniforms();
  U.uNoise.value = noiseTexture();
  U.uWave.value = waveTexture();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 32000);
  const towers = P.towerLayout(7);
  const light = { dayK: 0, sunDir: new THREE.Vector3(0, 1, 0), phase: 'day' };
  const deathStar = new THREE.Vector3(0, 0.4, -1).normalize();
  // What the telescope adds to the world outside (its planets, its close-up city): kept through a rebuild, theirs to dispose.
  const extras = new THREE.Group();
  scene.add(extras);

  let parts = null, quality = null;
  // One quality's world is made a piece at a time, in this order, into `p`; `land` is the land's numbers (from the
  // worker, or worked out here when it is null).
  function pieces(p, q, land) {
    let lightSpec = null;
    return [
      () => { p.sky = makeSky(U, q); },
      () => { const t = makeTerrain(U, q, land || terrainData(q)); addTowersToSilhouette(t.sil, towers); p.terrain = t.mesh; p.sil = silhouetteTexture(t.sil); },
      () => { p.facade = facadeMaterial(U, q); lightSpec = P.lightLayout(11, q === 'low' ? 2200 : q === 'high' ? 5200 : 4000, towers); },
      () => { p.water = makeWater(U, q); },
      () => { p.towers = makeTowers(U, q, towers, p.facade); },
      () => { p.bridge = makeBridge(U, q); },
      () => { p.lines = makeLines(U, q); },
      () => { p.lights = makeLights(U, q, lightSpec, bridgeExtras(q).concat(vesselLights())); },
      () => { p.streaks = makeStreaks(U, q, streakList(towers, lightSpec)); },
      () => { p.vessels = makeVessels(U, q, p.facade); },
      () => { p.trees = makeTrees(U, q); },
      () => { p.gulls = makeGulls(U, q); },
      () => { p.rain = makeRain(U, q); },
      () => { p.snow = makeSnow(U, q); },
      () => { p.fireworks = makeFireworks(U, q); },
    ];
  }
  const roots = p => [p.sky?.group, p.terrain, p.water, p.towers, p.bridge, p.lines, p.lights, p.streaks, p.vessels?.mesh,
    p.trees?.firs, p.trees?.leafy, p.gulls, p.rain, p.snow, p.fireworks?.sky, p.fireworks?.water].filter(Boolean);
  function attach(p) { U.uSil.value = p.sil; scene.add(...roots(p)); }
  // Lets go of one quality's world, whole or half made: out of the scene, and its shapes, materials and skyline freed.
  function drop(p) {
    const geos = new Set(), mats = new Set(p.facade ? [p.facade] : []);
    for (const root of roots(p)) {
      scene.remove(root);
      root.traverse(o => { if (o.geometry) geos.add(o.geometry); if (o.material) mats.add(o.material); if (o.isInstancedMesh) o.dispose(); });
    }
    geos.forEach(g => g.dispose());
    mats.forEach(m => m.dispose());
    p.sil?.dispose();
  }
  function build(q) {
    const p = {};
    for (const piece of pieces(p, q, null)) piece();
    attach(p);
    return p;
  }
  function teardown() {
    if (!parts) return;
    drop(parts);
    parts = null;
  }
  // A change of quality builds the new world in the background while the old one stays up, then swaps it in whole:
  // built in one go it held a slowed phone for up to 0.6 s. The land comes from a worker, the other pieces one per
  // breath, and every shader is built before the swap, both ways the outside is drawn.
  const breath = () => new Promise(done => setTimeout(done, 30));
  function landInWorker(q) {
    if (typeof Worker !== 'function') return Promise.resolve(null);
    return new Promise(resolve => {
      let w = null;
      try { w = new Worker(new URL('./outside/terrainworker.js', import.meta.url), { type: 'module' }); } catch (e) { resolve(null); return; }
      w.onmessage = ({ data }) => { w.terminate(); resolve(data.error ? null : data); };
      w.onerror = () => { w.terminate(); resolve(null); };
      w.postMessage({ q });
    });
  }
  // A piece at a time, a slice of a frame's time each, so asking for them holds no frame either.
  async function shadersFor(p, gone) {
    const r = opts.renderer;
    if (!r?.compileAsync) return;
    const picture = new THREE.WebGLRenderTarget(1, 1);
    try {
      for (const target of [null, picture]) {
        const jobs = [];
        await inSlices(roots(p), root => {
          if (gone()) throw STALE;
          const was = r.getRenderTarget();
          try { r.setRenderTarget(target); jobs.push(r.compileAsync(root, camera, scene)); } finally { r.setRenderTarget(was); }
        }, { rest: breath });
        await Promise.all(jobs);
      }
    } finally { picture.dispose(); }
  }
  async function buildInBackground(q, { made, stale }) {
    const gone = () => stale() || disposed;
    const land = await landInWorker(q);
    if (gone()) throw STALE;
    const p = {};
    made.push(p);
    for (const piece of pieces(p, q, land)) { await breath(); if (gone()) throw STALE; piece(); }
    await shadersFor(p, gone);
    if (gone()) throw STALE;
    return p;
  }
  let rebuilder = null;
  function swapIn(p, q) {
    const old = parts;
    attach(p);
    parts = p; quality = q;
    month = 0; holId = undefined; slowLeft = 0;
    if (old) drop(old);
  }

  const flags = { time: null, date: null, weather: null, fireworks: false, aurora: false };
  let lastSearch = null, overrideBase = null, overrideT0 = 0;
  const realNow = () => (opts.now ? opts.now() : new Date());
  const tier = () => { const q = opts.quality ? opts.quality() : 'medium'; return q === 'low' || q === 'high' ? q : 'medium'; };
  function readFlags() {
    const s = typeof location === 'undefined' ? '' : location.search;
    if (s === lastSearch) return;
    lastSearch = s;
    const q = new URLSearchParams(s);
    flags.time = P.parseClock(q.get('time'));
    flags.date = P.parseDay(q.get('date'));
    flags.weather = P.WEATHER[q.get('weather')] ? q.get('weather') : null;
    flags.fireworks = q.has('fireworks');
    flags.aurora = q.has('aurora');
    overrideBase = null;
  }
  function clock() {
    if (!flags.time && !flags.date) return realNow();
    if (overrideBase === null) {
      const v = vanTime(realNow()), d = flags.date || v, c = flags.time || v;
      overrideBase = P.vanDate(d.y, d.m, d.d, c.h, c.min).getTime();
      overrideT0 = performance.now();
    }
    return new Date(overrideBase + performance.now() - overrideT0);
  }

  const AST = P.makeAstro(), MV = new Array(6).fill(0), DS = [0, 0, 1], SKY = P.makeSkyState(), FWB = new Float32Array(P.FW_SLOTS * 8);
  const VS = [P.makeVessel(), P.makeVessel(), P.makeVessel()];
  const W = { ...P.WEATHER.clear };
  let target = P.WEATHER.clear, sunElev = 0, moonEl = 0, moonLit = 0, simBase = 0, simT = 0, tNow = 0, slowLeft = 0, first = true;
  let fwOn = false, aurora = 0, winFrac = 0.3, offFrac = 0.1, snowLine = 1500, ski = 0, month = 0, holId = undefined;
  const tmpC = new THREE.Color(), res = new THREE.Vector2();

  function slow() {
    readFlags();
    const date = clock();
    simBase = date.getTime() / 1000;
    simT = tNow;
    P.astro(date, AST);
    P.moonView(AST.moon, AST.sun, MV);
    P.deathStarDir(MV, DS);
    deathStar.set(DS[0], DS[1], DS[2]);
    sunElev = Math.asin(AST.sun[1]) / DEG;
    moonEl = Math.asin(MV[1]) / DEG;
    moonLit = P.litFraction(AST.phase);
    light.phase = skyPhase(date).phase;
    const v = vanTime(date), name = flags.weather || (opts.weather ? opts.weather() : 'clear');
    target = P.weatherTarget(name);
    winFrac = P.windowFraction(v.h + v.min / 60);
    offFrac = P.officeFraction(v.h + v.min / 60);
    snowLine = P.snowLine(v.m, v.d, name);
    ski = P.skiLightsOn(v, sunElev) ? 1 : 0;
    aurora = P.auroraLevel(v, name, sunElev, flags.aurora);
    const hol = opts.holiday ? opts.holiday() : null;
    fwOn = P.fireworksOn(hol?.id, v, sunElev, flags.fireworks);
    if ((hol?.id ?? null) !== holId) {
      holId = hol?.id ?? null;
      const pal = parts.fireworks.u.uPal.value;
      PALETTE.forEach((c, i) => pal[i].setFromColor(tmpC.set(c)));
      if (hol?.c) { pal[0].setFromColor(tmpC.set(hol.c.hot)); pal[3].setFromColor(tmpC.set(hol.c.a2)); }
      if (holId === 'canada') [1, 2, 4, 6, 7].forEach(i => pal[i].setFromColor(tmpC.set(i % 2 ? '#ff3b3b' : '#fff4e6')));
    }
    if (v.m !== month) {
      month = v.m;
      dressTrees(parts.trees, month);
      U.uSeason.value = month === 10 || month === 11 ? 1 : month === 9 ? 0.4 : 0;
    }
    U.uLst.value = AST.lst;
  }

  function rebuild(q) {
    teardown();
    quality = q;
    parts = build(q);
    month = 0;
    holId = undefined;
    slowLeft = 0;
  }

  scene.onBeforeRender = (renderer, _s, _c, target) => {
    U.uRes.value = target ? target.height : renderer.getDrawingBufferSize(res).y;
    U.uPx.value = renderer.getPixelRatio();
  };

  const setV = (u, a, k = 1) => u.value.set(a[0] * k, a[1] * k, a[2] * k);

  let disposed = false;
  function tick(dt, t, mainCamera) {
    if (disposed) return;
    dt = Math.min(Math.max(dt || 0, 0), 0.25);
    tNow = t;
    const q = tier();
    if (rebuilder) rebuilder.want(q); else if (q !== quality) rebuild(q);
    slowLeft -= dt;
    if (slowLeft <= 0) { slowLeft = 0.5; slow(); }

    if (mainCamera) {
      mainCamera.getWorldPosition(camera.position);
      mainCamera.getWorldQuaternion(camera.quaternion);
      if (camera.fov !== mainCamera.fov || camera.aspect !== mainCamera.aspect || camera.zoom !== mainCamera.zoom) {
        camera.fov = mainCamera.fov; camera.aspect = mainCamera.aspect; camera.zoom = mainCamera.zoom ?? 1;
        camera.updateProjectionMatrix();
      }
    }
    camera.updateMatrixWorld();

    const blend = first ? 1 : Math.min(1, dt * 0.35);
    for (let i = 0; i < WKEYS.length; i++) W[WKEYS[i]] += (target[WKEYS[i]] - W[WKEYS[i]]) * blend;
    first = false;

    P.skyColors(sunElev, W.overcast, W.rain * 0.6 + W.snow * 0.3 + W.fog * 0.25, SKY);
    setV(U.uZenith, SKY.zenith); setV(U.uHorizon, SKY.horizon); setV(U.uHorizonSun, SKY.horizonSun); setV(U.uGlow, SKY.glow);
    setV(U.uAmbient, SKY.ambient); setV(U.uSunCol, SKY.sunLight); setV(U.uCloudLit, SKY.cloudLit); setV(U.uCloudDark, SKY.cloudDark);
    setV(U.uSunDisc, SKY.sun, 24 * P.smooth(-1.0, 0.6, sunElev) * (1 - 0.95 * W.overcast));
    U.uSunDir.value.set(AST.sun[0], AST.sun[1], AST.sun[2]).normalize();
    light.sunDir.copy(U.uSunDir.value);
    light.dayK = SKY.day;
    const moonUp = P.smooth(-1, 2, moonEl);
    U.uMoonDir.value.set(MV[0], MV[1], MV[2]);
    U.uMoonLight.value.set(MV[3], MV[4], MV[5]);
    U.uMoonK.value = moonUp * (0.25 + 0.75 * SKY.night);
    const ma = moonLit * moonUp * SKY.night * (1 - 0.6 * W.overcast);
    U.uMoonAmb.value.set(0.016 * ma, 0.018 * ma, 0.024 * ma);
    U.uNight.value = SKY.night;
    U.uStars.value = SKY.stars * (1 - 0.85 * W.overcast);
    U.uCloud.value = W.cloud;
    U.uCloudOff.value.x += dt * (0.0011 + 0.0009 * W.overcast);
    U.uCloudOff.value.y += dt * 0.0003;
    U.uHazeD.value = HAZE * W.haze;
    U.uLow.value = W.low; U.uFog.value = W.fog; U.uRain.value = W.rain; U.uSnow.value = W.snow; U.uRough.value = W.rough;
    U.uWinFrac.value = winFrac; U.uOffFrac.value = offFrac; U.uSnowLine.value = snowLine; U.uSki.value = ski; U.uAurora.value = aurora;
    U.uTime.value = t % 21600;

    const sim = simBase + (t - simT);
    P.cruiseAt(sim, VS[0]);
    P.ferryAt(sim, VS[1]);
    P.floatplaneAt(sim, VS[2]);
    if (SKY.day < 0.2) VS[2].on = 0;
    for (let i = 0; i < 3; i++) {
      const s = VS[i];
      parts.vessels.place(i, s);
      // A floatplane at take-off speed throws spray, not a ship's wake.
      U.uWake.value[i].set(P.EYE[0] + s.dx, P.EYE[2] - s.dn, s.course, s.on && s.water ? Math.min(s.speed, i === 2 ? 3 : 8) : 0);
    }

    const fw = parts.fireworks;
    fw.sky.visible = fw.water.visible = fwOn;
    U.uFlash.value.w = 0;
    if (fwOn) {
      P.fireworkBursts(sim % 86400, FWB);
      let flash = 0, best = 0;
      for (let s = 0; s < P.FW_SLOTS; s++) {
        const o = s * 8;
        fw.u.uFw.value[s].set(FWB[o], FWB[o + 1], FWB[o + 2], FWB[o + 3]);
        fw.u.uFwB.value[s].set(FWB[o + 4], FWB[o + 5], FWB[o + 6], FWB[o + 7]);
        const age = FWB[o + 3];
        if (age >= 0 && age < 1.5) {
          const k = Math.exp(-age * 2.6);
          flash += k;
          if (k > best) {
            best = k;
            U.uFlash.value.set(P.EYE[0] + FWB[o] - camera.position.x, P.WATER_Y + FWB[o + 1] - camera.position.y, P.EYE[2] - FWB[o + 2] - camera.position.z, 0);
            U.uFlashCol.value.copy(fw.u.uPal.value[FWB[o + 6]]);
          }
        }
      }
      if (best > 0) {
        const w = U.uFlash.value;
        const len = Math.hypot(w.x, w.y, w.z);
        w.set(w.x / len, w.y / len, w.z / len, Math.min(flash, 1.6) * 0.016 * SKY.night);
      }
    }

    const sky = parts.sky;
    sky.dome.position.copy(camera.position);
    sky.stars.visible = U.uStars.value > 0.01;
    sky.moon.visible = moonUp > 0;
    sky.moon.material.uniforms.uDir.value.copy(U.uMoonDir.value);
    sky.deathStar.visible = SKY.night > 0.05 && deathStar.y > -0.02;
    sky.deathStar.material.uniforms.uDir.value.copy(deathStar);
    parts.lights.visible = SKY.night > 0.005;
    parts.streaks.visible = SKY.night > 0.02;
    parts.gulls.visible = SKY.day > 0.15 && W.rain < 0.6;
    parts.rain.visible = W.rain > 0.01;
    parts.snow.visible = W.snow > 0.01;
  }

  function dispose() {
    disposed = true;
    rebuilder?.stop();
    teardown();
    U.uNoise.value.dispose();
    U.uWave.value.dispose();
  }

  rebuild(tier());
  rebuilder = makeRebuilder({ current: quality, build: buildInBackground, swap: swapIn, discard: made => made.forEach(drop), onError: e => console.warn('[outside] the new quality could not be built', e) });
  return { scene, camera, tick, light, deathStar, dispose, U, extras, clock, towers, vessels: VS, get parts() { return parts; }, get quality() { return quality; } };
}
