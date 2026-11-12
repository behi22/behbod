// One gun in the hand: when it may fire, how its aim opens up and settles, what each shot kicks, and the reload as a
// timeline of moments (magazine out, magazine in, the slide or bolt going home) that the view and the sound follow.
// Pure: `step` takes the time passed and what the hands are doing and returns what happened.

// A pull of the trigger a moment too early (the last shot still cycling, a reload just ending) still counts for this long.
const PRESS_KEPT = 0.15;

export function newWeapon(s) {
  return { ammo: s.mag, phase: 'draw', t: 0, wait: 0, bloom: 0, run: 0, lull: 0, held: false, press: 0, reloadHeld: false, reloadDue: false, empty: false, marks: 0 };
}

// How wide the shots scatter right now, in degrees: the hip or aimed base (blended by how far the gun is raised), plus
// what recent shots have opened up. Aiming steadies the bloom too.
export function spreadNow(w, s, aim) {
  const a = Math.min(1, Math.max(0, aim));
  return s.spread.hip * (1 - a) + s.spread.ads * a + w.bloom * (1 - 0.6 * a);
}

const RELOAD_MARKS = ['out', 'in', 'rack'];

// input: { fire: the trigger is down, reload: the reload key is down, aim: 0 hip to 1 aimed }.
// Events: shot { spread, up, side, back, loud, flash, last }, dry, reload { empty }, mag_out, mag_in, rack, bolt, ready.
export function step(w, s, dt, input, rng = Math.random) {
  const ev = [];
  w.press = input.fire && !w.held ? PRESS_KEPT : Math.max(0, w.press - dt);
  w.held = !!input.fire;
  // Reloading answers the key going down, not the key being held (holding it must not start a second reload), and a
  // press while the gun is busy with its bolt or being drawn is kept until it is free.
  if (input.reload && !w.reloadHeld) w.reloadDue = true;
  w.reloadHeld = !!input.reload;
  w.lull += dt;
  // The aim only settles once the firing stops: between the shots of a burst it stays as open as they left it.
  if (w.lull > Math.max(0.12, s.interval * 1.5)) w.bloom = Math.max(0, w.bloom - s.spread.settle * dt);
  // A burst ends a quarter of a second after its last shot; the climb starts over.
  if (w.lull > 0.25) w.run = 0;

  if (w.phase === 'draw' || w.phase === 'bolt') {
    w.wait = Math.max(0, w.wait - dt);
    w.t += dt;
    if (w.t >= (w.phase === 'draw' ? s.draw : s.bolt)) { w.phase = 'ready'; w.t = 0; ev.push({ type: 'ready' }); }
    return ev;
  }
  if (w.phase === 'reload') {
    w.reloadDue = false;
    w.wait = Math.max(0, w.wait - dt);
    w.t += dt;
    const end = w.empty ? s.reload.empty : s.reload.partial;
    // The slide or bolt only has to go home after a reload from empty.
    const marks = w.empty ? RELOAD_MARKS : RELOAD_MARKS.slice(0, 2);
    while (w.marks < marks.length && w.t >= Math.min(end, s.reload[marks[w.marks]])) {
      const m = marks[w.marks++];
      // The fresh magazine is what refills the gun; a round already chambered stays on top of it.
      if (m === 'in') w.ammo = s.mag + (w.empty ? 0 : s.chamber);
      ev.push({ type: m === 'out' ? 'mag_out' : m === 'in' ? 'mag_in' : 'rack' });
    }
    if (w.t >= end) { w.phase = 'ready'; w.t = 0; w.marks = 0; ev.push({ type: 'ready' }); }
    return ev;
  }

  const startReload = () => { w.phase = 'reload'; w.t = 0; w.marks = 0; w.empty = w.ammo === 0; w.run = 0; w.press = 0; ev.push({ type: 'reload', empty: w.empty }); };
  const reloadAsked = w.reloadDue;
  w.reloadDue = false;
  if (reloadAsked && w.ammo < s.mag + s.chamber) { startReload(); return ev; }
  const wants = s.auto ? w.held : w.press > 0;
  // The time to the next shot runs below zero while the trigger is working, and the shot that follows gives the
  // overshoot back, so the rate of fire is the gun's own whatever the frame rate. An idle gun banks nothing.
  w.wait -= dt;
  if (!wants) { w.wait = Math.max(0, w.wait); return ev; }
  if (w.ammo === 0) {
    // An empty gun clicks once, then reloads by itself (an automatic held down past its last round does too).
    w.wait = Math.max(0, w.wait);
    ev.push({ type: 'dry' });
    startReload();
    return ev;
  }
  while (w.wait <= 0 && w.ammo > 0) {
    w.ammo--;
    w.wait += s.interval;
    w.press = 0;
    const climb = 1 + s.kick.climb * Math.min(w.run, 8) / 8;
    ev.push({
      type: 'shot', spread: spreadNow(w, s, input.aim || 0),
      up: s.kick.up * climb * (0.85 + 0.3 * rng()), side: s.kick.side * climb * (rng() * 2 - 1), back: s.kick.back,
      loud: s.loud, flash: s.flash, last: w.ammo === 0,
    });
    w.run++; w.lull = 0;
    w.bloom = Math.min(s.spread.max, w.bloom + s.spread.bloom);
    if (s.bolt && w.ammo > 0) { w.phase = 'bolt'; w.t = 0; ev.push({ type: 'bolt' }); }
    // One shot a pull for anything that is not an automatic.
    if (!s.auto) break;
  }
  if (!s.auto || w.ammo === 0) w.wait = Math.max(0, w.wait);
  return ev;
}

// A point inside the scatter circle for one shot, as two angles in degrees (uniform over the disc).
export function scatter(spread, rng = Math.random) {
  const r = spread * Math.sqrt(rng()), a = rng() * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)];
}

// How far through its reload the gun is, 0 to 1 (0 when it is not reloading).
export function reloadProgress(w, s) {
  return w.phase === 'reload' ? Math.min(1, w.t / (w.empty ? s.reload.empty : s.reload.partial)) : 0;
}
