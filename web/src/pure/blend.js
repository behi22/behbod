// Locomotion blend sets: each clip with the speed (m/s) where it plays alone.
export const LOCO = [['Idle_Loop', 0], ['Walk_Loop', 1.6], ['Jog_Fwd_Loop', 3.4], ['Sprint_Loop', 5.6]];
export const CROUCH = [['Crouch_Idle_Loop', 0], ['Crouch_Fwd_Loop', 1.2]];
// Walk, jog and sprint share one stride phase so the feet never skip when the blend changes.
export const STRIDE = { Walk_Loop: 1.6, Jog_Fwd_Loop: 3.4, Sprint_Loop: 5.6, Crouch_Fwd_Loop: 1.2 };

export function blendWeights(set, speed) {
  const out = new Map();
  for (let i = 0; i < set.length; i++) {
    const [n, s] = set[i], prev = set[i - 1], next = set[i + 1];
    let w = 0;
    if (speed <= s && prev) w = Math.max(0, (speed - prev[1]) / (s - prev[1]));
    else if (speed >= s && next) w = Math.max(0, (next[1] - speed) / (next[1] - s));
    else if ((speed <= s && !prev) || (speed >= s && !next)) w = 1;
    out.set(n, w);
  }
  return out;
}

// Stride cycles per second for a ground speed: longer strides when running.
export const strideRate = speed => speed / (speed > 4.5 ? 2.9 : speed > 2.6 ? 2.3 : 1.45);
