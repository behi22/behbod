import * as THREE from 'three';

// Confetti: a burst of little paper squares that fly, tumble, settle and fade. Every burst shares one material, so one
// made after the house is ready draws with the shader already built for the first (the mini goal's, at the start).
let mat = null;

// colours: the paper's colours in turn; size: one square's width and height in metres; life: seconds from burst to gone.
export function makeConfetti(scene, { name, count = 40, size = [0.04, 0.024], colours, life = 1.8 }) {
  mat ||= new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size[0], size[1]), mat, count);
  const bits = Array.from({ length: count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < count; i++) { mesh.setColorAt(i, c.set(colours[i % colours.length])); mesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); }
  mesh.name = name; mesh.frustumCulled = false;
  scene.add(mesh);
  let t = -1, ground = () => 0;
  return {
    get active() { return t >= 0; },
    // place(p, v, i) puts bit i at its start and sets its velocity; floor(p) is the height it settles at.
    burst(place, floor) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      t = 0; mesh.visible = true; ground = floor;
      bits.forEach((b, i) => {
        place(b.p, b.v, i);
        b.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        b.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      });
      return true;
    },
    stop() { t = -1; mesh.visible = false; },
    tick(dt) {
      if (t < 0) { mesh.visible = false; return; }
      t += dt;
      if (t > life) { t = -1; mesh.visible = false; return; }
      const size = Math.min(1, (life - t) / 0.4);
      for (let i = 0; i < count; i++) {
        const b = bits[i];
        b.v.y -= 2.6 * dt;
        b.v.multiplyScalar(1 - Math.min(1, dt * 1.4));
        b.p.addScaledVector(b.v, dt);
        const g = ground(b.p);
        if (b.p.y < g) { b.p.y = g; b.v.set(0, 0, 0); b.w.set(0, 0, 0); }
        b.r.set(b.r.x + b.w.x * dt, b.r.y + b.w.y * dt, b.r.z + b.w.z * dt);
        mesh.setMatrixAt(i, m4.compose(b.p, q4.setFromEuler(b.r), s4.setScalar(size)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
