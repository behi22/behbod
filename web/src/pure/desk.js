// The desk's own rules: the DEPLOY button. Places are Blender axes, in metres.

// Where I stand to press DEPLOY: in front of the desk, beside the chair.
export const DEPLOY_SPOT = [20.75, 1.95, 0.45];

// How far the DEPLOY button is pushed in, 0 to 1, `e` seconds after a press: straight down, held, then back up.
export function pressDepth(e) {
  if (!(e >= 0)) return 0;
  if (e < 0.06) return e / 0.06;
  if (e < 0.28) return 1;
  return e < 0.5 ? 1 - (e - 0.28) / 0.22 : 0;
}
