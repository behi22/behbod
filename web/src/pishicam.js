import * as THREE from 'three';
import { CAMS, pickCam, fovFor, placeOf, doingOf } from './pure/pishicam.js';

// Small and a few times a second, and only while the little screen is in sight: each picture is the house drawn again.
const W = 256, H = 152, FPS = 6, FPS_TOUCH = 2, SEEN = 7;
const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";

// The house drawn from the wall camera that sees her, with words; at the lowest quality (no effects) the words alone.
export function makePishiCam({ renderer, scene, screen, texture, pishi, me, coarse = false }) {
  const hud = texture.image, g = hud.getContext('2d');
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  // The screen's UVs run top-down; a drawn picture's rows run bottom-up.
  rt.texture.repeat.set(1, -1); rt.texture.offset.set(0, 1);
  const eye = new THREE.PerspectiveCamera(40, W / H, 0.05, 30);
  const plane = new THREE.PlaneGeometry(2, 2), uv = plane.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const over = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  over.add(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })));
  const frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), where = new THREE.Vector3(), aim = new THREE.Vector3(), want = new THREE.Vector3();
  // The screen's mesh sits at the origin with its corners in place, so its box says where it is.
  const sphere = screen ? new THREE.Box3().setFromObject(screen).getBoundingSphere(new THREE.Sphere()) : new THREE.Sphere();
  const clear = new THREE.Color();
  let mount = null, fov = 40, live = false, ready = false, warming = false, acc = 1, drawn = '', enabled = !!screen, shots = 0;

  const cat = () => [pishi.pos.x, -pishi.pos.z, pishi.pos.y];
  const caption = () => `${placeOf(cat(), pishi.state)} · ${doingOf(pishi.state, !!pishi.groomUntil)}`;
  function drawHud(now) {
    const n = (mount || pickCam(cat())).n, blink = Math.floor(now / 700) % 2, key = `${live} ${n} ${caption()} ${blink}`;
    if (key === drawn) return;
    drawn = key;
    const { width: w, height: h } = hud;
    g.clearRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (live) {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, w, 32); g.fillRect(0, h - 30, w, 30);
      g.fillStyle = '#e9edf3'; g.font = `12px ${MONO}`; g.fillText(caption(), 12, h - 11);
    } else {
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      g.textAlign = 'center';
      g.fillStyle = '#e9edf3'; g.font = `17px ${MONO}`; g.fillText(placeOf(cat(), pishi.state), w / 2, h / 2 + 2);
      g.fillStyle = '#9aa3b2'; g.font = `13px ${MONO}`; g.fillText(doingOf(pishi.state, !!pishi.groomUntil), w / 2, h / 2 + 26);
      g.textAlign = 'left';
    }
    g.fillStyle = '#d2d6de'; g.font = `13px ${MONO}`; g.fillText(`CAM 0${n} · PISHI`, 12, 22);
    if (blink) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(w - 20, 17, 6, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    texture.needsUpdate = true;
  }
  // The screen takes the picture only once one is drawn into it.
  function show(on, now) {
    live = on; drawn = '';
    drawHud(now);
    if (!on && screen) screen.material.map = texture;
  }
  // The few pictures it draws on its own (the words over it) are built in the background before the first one.
  function warm() {
    warming = true;
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    const done = renderer.compileAsync ? renderer.compileAsync(over, flat) : Promise.resolve(renderer.compile(over, flat));
    renderer.setRenderTarget(was);
    done.then(() => { ready = true; }, () => { ready = true; });
  }
  function shoot(dt) {
    const c = cat();
    const next = pickCam(c, mount?.n);
    want.set(pishi.pos.x, pishi.pos.y + 0.16, pishi.pos.z);
    if (next !== mount) { mount = next; where.set(next.at[0], next.at[2], -next.at[1]); aim.copy(want); fov = fovFor(next.at, c); }
    const k = Math.min(1, dt * 4);
    aim.lerp(want, k);
    fov += (fovFor(mount.at, c) - fov) * k;
    eye.position.copy(where); eye.fov = fov; eye.updateProjectionMatrix(); eye.lookAt(aim); eye.updateMatrixWorld();
    // Not drawn inside its own picture: the mirrors (each would draw the house again), and this screen itself.
    const hidden = scene.children.filter(o => o.isReflector && o.visible);
    if (screen.visible) hidden.push(screen);
    const veiled = me?.head === 'mosaic' && me.root.visible;
    for (const o of hidden) o.visible = false;
    if (veiled) me.root.visible = false;
    const was = renderer.getRenderTarget(), auto = renderer.autoClear, alpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    try {
      renderer.setRenderTarget(rt);
      renderer.setClearColor(scene.fog ? scene.fog.color : 0x0a0f1c, 1);
      renderer.autoClear = true;
      renderer.render(scene, eye);
      renderer.autoClear = false;
      renderer.render(over, flat);
      shots++;
    } finally {
      renderer.setRenderTarget(was); renderer.setClearColor(clear, alpha); renderer.autoClear = auto;
      for (const o of hidden) o.visible = true;
      if (veiled) me.root.visible = true;
    }
  }
  const inSight = camera => {
    if (camera.position.distanceTo(sphere.center) > SEEN) return false;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return frustum.intersectsSphere(sphere);
  };
  show(false, 0);
  return {
    // `post`: the graphics draw through their effects, so the pictures it needs are already built.
    tick(dt, now, camera, post) {
      if (!enabled) return;
      if (live && !post) show(false, now);
      if (!inSight(camera)) return;
      if (!post) mount = pickCam(cat(), mount?.n);
      else if (!ready) { if (!warming) warm(); }
      else if ((acc += dt) >= 1 / (coarse ? FPS_TOUCH : FPS) || !live) {
        if (!live) show(true, now);
        shoot(acc); acc = 0;
        screen.material.map = rt.texture;
      }
      drawHud(now);
    },
    get live() { return live; },
    // For the checks: the camera, its picture and how many it has drawn.
    eye, target: rt, get shots() { return shots; },
    get cam() { return mount?.n ?? null; },
    get caption() { return caption(); },
    get enabled() { return enabled; },
    set enabled(on) { enabled = !!on && !!screen; if (!enabled) show(false, performance.now()); },
    cams: CAMS,
  };
}
