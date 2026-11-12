// One run of a range stage: the clock, what is up and how hurt it is, the score and the streak, the shields on Hard,
// and the result with its stars. Pure: the view tells it what was shot, and it answers with what happened.
import { script, par, starsFor, place, STAGE, DIFFICULTIES, KINDS } from './stages.js';

// Each kill within the window of the last adds a twentieth to what the next is worth, up to half as much again.
const STREAK_WINDOW = 3.5, STREAK_STEP = 0.05, STREAK_TOP = 0.5, ACCURACY_SHARE = 0.15;

export function newRun(stageId, difficulty = 'normal', seed = 1) {
  const spawns = script(stageId, difficulty, seed), D = DIFFICULTIES[difficulty];
  return { stage: stageId, difficulty, seed, t: 0, time: STAGE[stageId]?.time || 0, queue: spawns.slice(), live: new Map(), total: spawns.length, par: par(spawns),
    scale: D?.score || 1, score: 0, kills: 0, weak: 0, escaped: 0, shots: 0, hits: 0, streak: 0, streakBest: 0, lastKill: -1e9, shields: D?.shields || 0, over: false, failed: false, cleared: false };
}

// Moves the clock on. Events: spawn { target }, escape { id }, bolt { id }, end { result }.
export function step(run, dt) {
  const ev = [];
  if (run.over) return ev;
  run.t += dt;
  const D = DIFFICULTIES[run.difficulty];
  while (run.queue.length && run.queue[0].t <= run.t) {
    const s = run.queue.shift();
    const bolt = D.bolts && KINDS[s.kind].bolt ? run.t + KINDS[s.kind].bolt * 0.5 : Infinity;
    run.live.set(s.id, { ...s, hp: s.hp, born: run.t, bolt });
    ev.push({ type: 'spawn', target: run.live.get(s.id) });
  }
  for (const [id, g] of run.live) {
    if (run.t - g.born >= g.life) { run.live.delete(id); run.escaped++; run.streak = 0; ev.push({ type: 'escape', id }); continue; }
    if (run.t >= g.bolt) { g.bolt += KINDS[g.kind].bolt; ev.push({ type: 'bolt', id }); }
  }
  if (run.t >= run.time || (!run.queue.length && !run.live.size)) {
    // Cleared means every target was taken; a stage that only ran out of targets because they got away is not.
    run.cleared = !run.queue.length && !run.live.size && run.escaped === 0;
    finish(run, ev);
  }
  return ev;
}

function finish(run, ev) {
  if (run.over) return;
  run.over = true;
  // Finishing early pays for the seconds saved, and a steady hand pays for accuracy.
  if (run.cleared && !run.failed) run.score += Math.round(Math.max(0, run.time - run.t) * 10 * run.scale);
  if (!run.failed && run.shots > 0) run.score += Math.round(Math.min(1, run.hits / run.shots) * ACCURACY_SHARE * run.par * run.scale);
  // Whatever is still up when the run ends got away too.
  for (const id of run.live.keys()) { run.escaped++; ev.push({ type: 'escape', id }); }
  run.live.clear();
  ev.push({ type: 'end', result: result(run) });
}

// The trigger was pulled (once per shot, however many targets it goes on to hit).
export function fired(run) { if (!run.over) run.shots++; }

// A shot landed on target `id` in `zone` for `damage`. `first` is false for a second target hit by the same shot, so
// accuracy counts shots that hit something, not targets. Events: hurt { id, hp, weak }, kill { id, points, streak, weak }.
export function hit(run, id, zone, damage, first = true) {
  const g = run.live.get(id);
  if (run.over || !g) return [];
  const K = KINDS[g.kind], mult = Object.hasOwn(K.zones, zone) ? K.zones[zone] : undefined;
  if (mult === undefined || !(damage > 0)) return [];
  if (first) run.hits++;
  const weak = K.weak === zone;
  g.hp -= damage * mult;
  if (g.hp > 0) return [{ type: 'hurt', id, hp: g.hp, weak }];
  run.live.delete(id);
  run.streak = run.t - run.lastKill <= STREAK_WINDOW ? run.streak + 1 : 1;
  run.lastKill = run.t;
  run.streakBest = Math.max(run.streakBest, run.streak);
  run.kills++;
  if (weak) run.weak++;
  const points = Math.round((g.points * (1 + Math.min(STREAK_TOP, (run.streak - 1) * STREAK_STEP)) + (weak ? 100 : 0)) * run.scale);
  run.score += points;
  return [{ type: 'kill', id, points, streak: run.streak, weak, kind: g.kind }];
}

// A bolt reached the player. Events: shield { left }, and end when the last one goes.
export function struck(run) {
  if (run.over) return [];
  run.shields = Math.max(0, run.shields - 1);
  run.streak = 0;
  const ev = [{ type: 'shield', left: run.shields }];
  if (run.shields === 0) { run.failed = true; finish(run, ev); }
  return ev;
}

// Leaving in the middle ends the run with what it has (no early-finish bonus).
export function quit(run) { const ev = []; if (run.over) return ev; run.cleared = false; finish(run, ev); return ev; }

export function result(run) {
  const stars = run.failed ? 0 : starsFor(run.score, run.par * run.scale);
  return { stage: run.stage, difficulty: run.difficulty, score: run.score, stars, kills: run.kills, total: run.total, weak: run.weak, escaped: run.escaped,
    accuracy: run.shots ? Math.min(1, run.hits / run.shots) : 0, streak: run.streakBest, cleared: run.cleared, failed: run.failed, shields: run.shields };
}

// Where a live target is now, in range space.
export const where = (run, g) => place(g, run.t - g.born);
