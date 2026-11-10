// The rules for penalties at the mini goal, with BH-22 in goal. Positions are metres on the goal mouth: y across from
// the middle (posts at plus and minus half the width), z up from the floor (crossbar at the height).
export const REACH_Y = 0.15, REACH_Z = 0.37;

// BH-22 reads the kicker one time in ten; otherwise it picks a side, or stays, at random. A dive lands far enough out to
// reach the post, and its reach overlaps the middle, so no spot in the goal is a sure thing. Its hop adds height.
// Against well placed kicks it saves about a third: two in five low ones, one in five high.
export function keeperGuess(aim, width, height, rand) {
  const read = rand() < 0.1;
  const side = read ? (Math.abs(aim.y) > 0.08 ? Math.sign(aim.y) : 0) : [-1, 0, 1][Math.floor(rand() * 3)];
  const high = read ? aim.z > height * 0.5 : rand() < 0.3;
  return { dy: side * (width / 2 - REACH_Y * 0.9), hop: high ? 0.18 : 0.05 };
}

// Where a kick ends up: the aim, give or take a few centimetres (`scatter`).
export const landing = (aim, scatter) => ({ y: aim.y + scatter[0], z: Math.max(0.02, aim.z + scatter[1]) });

// What happens: wide of a post, over the bar, saved where BH-22 lands, or a goal.
export function penaltyResult(at, guess, width, height) {
  if (Math.abs(at.y) > width / 2 - 0.02) return 'wide';
  if (at.z > height - 0.02) return 'over';
  if (Math.abs(at.y - guess.dy) < REACH_Y && at.z < REACH_Z + guess.hop) return 'saved';
  return 'goal';
}
