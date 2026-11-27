import * as THREE from 'three';
import { b2t } from './engine.js';
import { ease } from './pure/tier.js';
import { seatView } from './pure/seatview.js';

// The desk: a Call of Duty style glide over my right shoulder and into my eyes, then the whole main monitor fills most
// of the view, with the keyboard and my hands below it (pure/seatview.js, by the view's shape).
// My facing at the desk is +x, so my right is +z and behind me is -x.
export function makeDesk({ camera, me, meta, coarse, follow }) {
  const desk = { pan: 0, range: 0, c: null, v: null, aspect: 0 };
  let glide = null;
  const eye = () => desk.c.clone().add(new THREE.Vector3(-desk.v.back, desk.v.up, desk.pan * desk.range));
  const aim = () => eye().add(new THREE.Vector3(Math.cos(desk.v.pitch), -Math.sin(desk.v.pitch), 0).multiplyScalar(desk.v.back));
  function fit() { desk.v = seatView(meta.screens.main, camera.aspect); desk.aspect = camera.aspect; desk.range = desk.v.range; }
  const shoulder = h => h.clone().add(new THREE.Vector3(-0.45, 0.22, 0.7));
  // Points along the glide: start, over the right shoulder, into the eyes, the screen. Rebuilt every frame so it
  // follows my head while the sitting animation moves it.
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');

  function enter(from, look) {
    desk.c = b2t(...meta.screens.main.center);
    fit();
    desk.pan = desk.range ? -1 : 0;
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
      return { p: curve.getPoint(e), l, fov: THREE.MathUtils.lerp(g.fromFov, desk.v.fov, e) };
    }
    const back = follow();
    curve.points[0].copy(g.fromP); curve.points[1].copy(eyes); curve.points[2].copy(shoulder(h)); curve.points[3].copy(back.p);
    const l = e < 0.45 ? g.fromL.clone().lerp(ahead, ease(e / 0.45)) : ahead.clone().lerp(back.l, ease((e - 0.45) / 0.55));
    return { p: curve.getPoint(e), l, fov: THREE.MathUtils.lerp(g.fromFov, coarse ? 60 : 55, e) };
  }
  // Moves the camera along the glide. Returns false when no glide is running.
  function tick(dt, camLook, atDesk) {
    if (!glide) {
      // A phone turned or a window resized while I sit: the view is fitted to its new shape at once.
      if (desk.c && camera.aspect !== desk.aspect && atDesk()) {
        fit();
        if (!desk.range) desk.pan = 0;
        camera.position.copy(eye()); camLook.copy(aim());
        camera.fov = desk.v.fov; camera.updateProjectionMatrix();
      }
      return false;
    }
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
