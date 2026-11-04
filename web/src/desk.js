import * as THREE from 'three';
import { b2t } from './engine.js';
import { ease } from './pure/tier.js';

// The desk: a Call of Duty style glide over my right shoulder and into my eyes, then the main screen fills the view.
// My facing at the desk is +x, so my right is +z and behind me is -x.
export function makeDesk({ camera, me, meta, coarse, follow }) {
  const desk = { pan: 0, range: 0, c: null, d: 0, fov: 42 };
  let glide = null;
  const aim = () => desk.c.clone().add(new THREE.Vector3(0, 0, desk.pan * desk.range));
  const eye = () => aim().add(new THREE.Vector3(-desk.d, 0, 0));
  const shoulder = h => h.clone().add(new THREE.Vector3(-0.45, 0.22, 0.7));
  // Points along the glide: start, over the right shoulder, into the eyes, the screen. Rebuilt every frame so it
  // follows my head while the sitting animation moves it.
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');

  function enter(from, look) {
    const s = meta.screens.main;
    const fov = camera.aspect < 1.2 ? 58 : 42, vf = THREE.MathUtils.degToRad(fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    // The curve brings the edges closer by its sagitta, so they need that much more distance to fit.
    const sag = s.r * (1 - Math.cos(s.w / 2 / s.r));
    const fitW = (s.w * 0.52) / Math.tan(hf / 2) + sag, fitH = (s.h * 0.56) / Math.tan(vf / 2);
    const d = Math.min(Math.max(fitW, fitH) + 0.03, camera.aspect < 1.2 ? 0.82 : 1.05);
    desk.range = Math.max(0, s.w / 2 - Math.tan(hf / 2) * d + 0.02);
    desk.pan = desk.range ? -1 : 0;
    desk.c = b2t(...s.center); desk.d = d; desk.fov = fov;
    glide = { t: 0, dur: 1.7, dir: 'in', fromP: from.clone(), fromL: look.clone(), fromFov: camera.fov };
  }
  function leave(from, look, done) {
    glide = { t: 0, dur: 1.4, dir: 'out', fromP: from.clone(), fromL: look.clone(), fromFov: camera.fov, done };
  }
  function pose(g, e) {
    const h = me.headNow(), eyes = h.clone().add(new THREE.Vector3(0.06, -0.02, 0));
    const ahead = eyes.clone().add(new THREE.Vector3(1.2, -0.05, 0));
    if (g.dir === 'in') {
      curve.points[0].copy(g.fromP); curve.points[1].copy(shoulder(h)); curve.points[2].copy(eyes); curve.points[3].copy(eye());
      const l = e < 0.55 ? g.fromL.clone().lerp(ahead, ease(e / 0.55)) : ahead.clone().lerp(aim(), ease((e - 0.55) / 0.45));
      return { p: curve.getPoint(e), l, fov: THREE.MathUtils.lerp(g.fromFov, desk.fov, e) };
    }
    const back = follow();
    curve.points[0].copy(g.fromP); curve.points[1].copy(eyes); curve.points[2].copy(shoulder(h)); curve.points[3].copy(back.p);
    const l = e < 0.45 ? g.fromL.clone().lerp(ahead, ease(e / 0.45)) : ahead.clone().lerp(back.l, ease((e - 0.45) / 0.55));
    return { p: curve.getPoint(e), l, fov: THREE.MathUtils.lerp(g.fromFov, coarse ? 60 : 55, e) };
  }
  // Moves the camera along the glide. Returns false when no glide is running.
  function tick(dt, camLook, atDesk) {
    if (!glide) return false;
    glide.t += dt / glide.dur;
    const e = ease(Math.min(1, glide.t)), g = pose(glide, e);
    camera.position.copy(g.p); camLook.copy(g.l);
    camera.fov = g.fov; camera.updateProjectionMatrix();
    // I disappear the moment the camera reaches my head, so it never shows the inside of the hood.
    me.root.visible = camera.position.distanceTo(me.headNow()) > 0.42 && !(glide.dir === 'in' && e > 0.75);
    if (glide.t >= 1) { const done = glide.done; glide = null; done?.(); me.root.visible = !atDesk(); }
    return true;
  }
  return {
    enter, leave, tick, aim, eye,
    get range() { return desk.range; },
    get gliding() { return !!glide; },
    pan(dx) { desk.pan = Math.max(-1, Math.min(1, desk.pan - dx / (innerWidth * 0.5))); },
  };
}
