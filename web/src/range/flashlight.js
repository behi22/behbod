import * as THREE from 'three';

// Always there at no strength when off, so turning it on makes the graphics card build nothing; `mount(fn)` hands it to an attachment.
export function makeFlashlight(room, stage) {
  // stage: the targets' share, since one strength for the bright toys and the dark concrete left the robots glaring white.
  const look = { color: 0xfff0dc, intensity: 380, stage: 0.4, angle: 0.34, penumbra: 0.6, distance: 45, decay: 1.3 };
  const lamps = [room, stage].map(scene => { const l = new THREE.SpotLight(look.color, 0, look.distance, look.angle, look.penumbra, look.decay); scene.add(l, l.target); return l; });
  let on = false, level = 0, mount = null;
  const from = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const api = {
    get on() { return on; },
    get level() { return level; },
    get lamps() { return lamps; },
    set(v) { on = !!v; },
    mount(fn) { mount = typeof fn === 'function' ? fn : null; },
    // Colour, strength (candela), the targets' share, cone (radians), soft edge (0..1), reach and fall-off.
    style(s) {
      Object.assign(look, s);
      for (const l of lamps) { l.color.set(look.color); l.angle = look.angle; l.penumbra = look.penumbra; l.distance = look.distance; l.decay = look.decay; }
    },
    // Each frame, with the eye's camera and the way a shot would leave (a unit vector).
    update(dt, eye, aim) {
      level = on ? Math.min(1, level + dt * 14) : Math.max(0, level - dt * 14);
      if (mount) mount(from, dir);
      else {
        // Low on the right of the gun, turned in to meet the crosshair a dozen metres out.
        right.set(1, 0, 0).applyQuaternion(eye.quaternion); up.set(0, 1, 0).applyQuaternion(eye.quaternion);
        from.copy(eye.position).addScaledVector(right, 0.12).addScaledVector(up, -0.1).addScaledVector(aim, 0.3);
        dir.copy(eye.position).addScaledVector(aim, 12).sub(from).normalize();
      }
      // On a narrow screen (a phone held upright) the cone is kept inside the view, so it still reads as a beam.
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(eye.fov) / 2) * eye.aspect), angle = Math.min(look.angle, 0.75 * half);
      lamps.forEach((l, i) => { l.position.copy(from); l.target.position.copy(from).add(dir); l.intensity = look.intensity * level * (i ? look.stage : 1); l.angle = angle; });
    },
  };
  return api;
}
