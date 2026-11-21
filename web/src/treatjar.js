import * as THREE from 'three';
import { piece, mesh, sph, cyl, box, PAINT } from './shapes.js';
import { b2t } from './engine.js';
import { JAR } from './pure/jar.js';

// The pets' treat jar: a glass jar of treats with a wooden lid. E or a tap shakes it, and Pishi and Jessi come for a
// treat if they are free.
export function makeTreatJar(scene, { creatures, sfx }) {
  const { at, stand, spots } = JAR;
  const group = new THREE.Group();
  group.name = 'treat_jar';
  group.position.copy(b2t(...at));
  const R = 0.052, H = 0.15;
  const BROWN = ['#8a5a2c', '#a8743c', '#6e4524', '#c08a4a'];
  // The treats: a heap of little biscuits and kibble inside, darker at the bottom.
  const bits = [];
  for (let i = 0; i < 55; i++) {
    const a = i * 2.39996, r = Math.sqrt((i % 11 + 0.5) / 11) * (R - 0.014), y = 0.012 + Math.floor(i / 11) * 0.015 + (i % 3) * 0.004;
    const c = BROWN[i % 4], p = [Math.cos(a) * r, y, Math.sin(a) * r];
    bits.push(i % 5 === 0 ? piece(box(0.018, 0.008, 0.008), c, p, [0, a, 0.3]) : piece(sph(0.0075, 6, 5), c, p, [a, 0, a * 0.5], [1.2, 0.8, 1]));
  }
  mesh([
    ...bits,
    // The jar's thick glass base and its rim, then the lid with its knob.
    piece(cyl(R - 0.002, R - 0.004, 0.006, 24), '#b9c7d6', [0, 0.003, 0]),
    piece(cyl(R + 0.002, R + 0.002, 0.008, 24), '#c9d4e0', [0, H - 0.004, 0]),
  ], PAINT, group);
  const lid = new THREE.Group();
  lid.position.y = H;
  mesh([
    piece(cyl(R + 0.006, R + 0.006, 0.022, 24), '#9a6a3a', [0, 0.011, 0]),
    piece(cyl(R + 0.002, R + 0.002, 0.006, 24), '#7a5230', [0, 0.024, 0]),
    piece(sph(0.013, 12, 8), '#7a5230', [0, 0.03, 0]),
  ], PAINT, lid);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: 0.16, depthWrite: false, fog: true, side: THREE.DoubleSide }));
  glass.position.y = H / 2; glass.renderOrder = 2;
  group.add(lid, glass);
  scene.add(group);

  const spot = { id: 'treats', at: [...stand], r: 0.6, label: 'Shake the treat jar', x: stand[0], y: stand[2], z: -stand[1] };
  const reach = new THREE.Sphere(group.position.clone().setY(group.position.y + H / 2), 0.13), hitAt = new THREE.Vector3();
  let wobble = -9, now = 0;
  return {
    spot,
    // A shake: the jar wobbles, the lid lifts, the treats rattle, and whoever is free comes. Returns what to say.
    shake() {
      const came = creatures.treats(spots);
      if (!came.length && creatures.coming) return 'One moment, they are on their way.';
      wobble = now;
      sfx?.rattle?.(group.position);
      return came.length ? `You shake the treat jar. ${came.join(' and ')} ${came.length > 1 ? 'come' : 'comes'} running.` : 'You shake the treat jar. Nobody is free right now.';
    },
    hit(ray, blockers) {
      const d = ray.ray.intersectSphere(reach, hitAt) ? ray.ray.origin.distanceTo(hitAt) : undefined;
      if (d === undefined) return null;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < d - 0.05) ? spot : null;
    },
    tick(t) {
      now = t;
      const k = t - wobble;
      if (k > 0.9) { if (group.rotation.z || lid.position.y !== H) { group.rotation.z = 0; lid.position.y = H; lid.rotation.x = 0; } return; }
      const fade = 1 - k / 0.9;
      group.rotation.z = Math.sin(k * 34) * 0.1 * fade;
      lid.position.y = H + Math.abs(Math.sin(k * 17)) * 0.012 * fade;
      lid.rotation.x = Math.sin(k * 23) * 0.15 * fade;
    },
  };
}
