import * as THREE from 'three';
import { b2t } from './engine.js';
import { makeConfetti } from './confetti.js';
import { newFan, fanStep, fanSet, DEPLOY_SPOT } from './pure/desk.js';

export { FAN_SPOT } from './pure/desk.js';

// The desk's own goings-on. DEPLOY, from the terminal or the button (E, a tap or a click): the lines, the green sweep,
// the fanfare and the achievement as before, plus confetti out of the button and a dance from BH-22; one at a time.
// And the fan, which BH-22 switches on while the PC is busy: a game on its screen or a deploy.
export function makeDeskBits({ scene, meta, world, screens, creatures, onDeploy }) {
  const btn = b2t(...meta.points.deploy);
  const desks = meta.colliders.filter(c => c.name === 'desk' || c.name === 'desk_return');
  const top = Math.max(...desks.map(c => c.max[2])), floor = DEPLOY_SPOT[2];
  // Confetti settles on the desk's top over the desk, and on the studio floor past its edge.
  const settle = p => (desks.some(c => p.x > c.min[0] && p.x < c.max[0] && -p.z > c.min[1] && -p.z < c.max[1]) ? top : floor) + 0.003;
  const at = DEPLOY_SPOT, spot = { id: 'deploy', at, r: 0.42, label: 'Press DEPLOY', x: at[0], y: at[2], z: -at[1] };
  const reach = new THREE.Sphere(btn.clone(), 0.06), hitAt = new THREE.Vector3();
  let confetti = null;
  const fan = newFan();
  const busy = () => { const g = screens.desktop.games.playing; return world.deploying || !!(g && !g.paused && !g.done); };

  // say(...lines): the terminal's, when the deploy was typed or the terminal is open to show it.
  function deploy(say) {
    if (world.deploying) { say?.('a deploy is already running.'); return false; }
    say?.('deploying...', 'build passed. shipped.');
    world.deploy(performance.now() / 1000);
    onDeploy();
    // Made at the first deploy; it draws with the mini goal's confetti material, so nothing new is compiled.
    confetti ||= makeConfetti(scene, { name: 'deploy_confetti', count: 44, size: [0.026, 0.015], colours: ['#3ee6c4', '#7dffa0', '#f3f4f8', '#b49cff'] });
    // High and wide enough to show round me as I stand at the button.
    confetti.burst((p, v) => {
      p.copy(btn).add(new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.02, (Math.random() - 0.5) * 0.05));
      v.set((Math.random() - 0.5) * 1.0, 1.8 + Math.random() * 1.0, (Math.random() - 0.5) * 1.0);
    }, settle);
    creatures.celebrate();
    return true;
  }
  return {
    spot, deploy,
    // The button pressed: a deploy unless one is running, with its lines in the terminal if the terminal is open.
    press() {
      if (world.deploying) return false;
      const open = screens.desktop.st.wins.some(w => w.app === 'terminal');
      return deploy(open ? (...lines) => screens.print('$ deploy', ...lines) : null);
    },
    // Whether a click lands on the button (a little generously, for a finger), with nothing nearer in the way.
    hit(ray, blockers) {
      const d = ray.ray.intersectSphere(reach, hitAt) ? ray.ray.origin.distanceTo(hitAt) : undefined;
      if (d === undefined) return false;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < d - 0.05);
    },
    // ctx.fanCall tells BH-22 the fan wants switching on.
    tick(dt, t, ctx) {
      confetti?.tick(dt);
      const did = fanStep(fan, busy(), t);
      if (did === 'off') { fanSet(fan, false, t); world.fan(false); }
      ctx.fanCall = did === 'call';
    },
    // BH-22 has switched it on.
    fanOn(t) { fanSet(fan, true, t); world.fan(true); },
    // The terminal's `fan`: the other way, and it stays as set until the PC next gets busy.
    toggleFan(t) { const on = !fan.on; fanSet(fan, on, t, true); world.fan(on); return on; },
    get fan() { return { ...fan, busy: busy() }; },
  };
}
