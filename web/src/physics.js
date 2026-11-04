import { R } from './pure/collide.js';

// Rapier's character controller: a capsule that slides along walls and climbs steps. Returns null if it cannot
// load, and the box collision keeps working on its own.
export async function makePhysics(col) {
  try {
    const RAPIER = (await import('https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm')).default;
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const cub = (x0, x1, y0, y1, z0, z1) => world.createCollider(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    for (const f of col.floors) cub(f.x0, f.x1, f.y - 0.5, f.y, f.z0, f.z1);
    const named = new Map();
    for (const b of col.boxes) {
      if (!named.has(b.name)) named.set(b.name, []);
      named.get(b.name).push(cub(b.x0, b.x1, Math.max(b.y0, -1.5), b.y1, b.z0, b.z1));
    }
    const HH = 0.5;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const capsule = world.createCollider(RAPIER.ColliderDesc.capsule(HH, R).setTranslation(0, HH + R + 0.02, 0), body);
    const ctl = world.createCharacterController(0.02);
    ctl.enableAutostep(0.2, 0.1, false);
    ctl.enableSnapToGround(0.2);
    ctl.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    ctl.setSlideEnabled(true);
    return {
      name: 'rapier',
      setSolid(name, on) { for (const c of named.get(name) || []) c.setEnabled(on); },
      place(p) { body.setTranslation({ x: p.x, y: p.y, z: p.z }, true); world.step(); },
      move(p, d) {
        ctl.computeColliderMovement(capsule, d);
        const m = ctl.computedMovement(), t = body.translation();
        const n = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
        body.setNextKinematicTranslation(n);
        world.step();
        p.set(n.x, n.y, n.z);
        return ctl.computedGrounded();
      },
    };
  } catch (e) {
    console.warn('[loft] physics: Rapier unavailable, using box collision.', e.message);
    return null;
  }
}
