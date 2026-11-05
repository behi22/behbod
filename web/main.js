import * as THREE from 'three';
import { makeEngine, b2t, TIERS } from './src/engine.js';
import { makeLoader } from './src/load.js';
import { makeWorld } from './src/world.js';
import { makeOutside } from './src/outside.js';
import { makePhysics } from './src/physics.js';
import { makeMe, HEAD_NAMES } from './src/me.js';
import { makeFollowCam } from './src/camera.js';
import { makeDesk } from './src/desk.js';
import { makeWardrobe } from './src/wardrobe.js';
import { makeCreatures } from './src/creatures.js';
import { openGame } from './src/games/index.js';
import { makeAudio } from './src/audio/index.js';
import { makeOutside3d } from './src/outside3d.js';
import { makeRange } from './src/range.js';
import { makeTelescope } from './src/telescope.js';
import { makePianoMode } from './src/pianomode.js';
import { makePanels } from './src/panel.js';
import { makeCollision } from './src/pure/collide.js';
import { makeInteract, headingToFacing } from './src/pure/interact.js';
import { makeNav } from './src/pure/nav.js';
import { makeProgress, ACHIEVEMENTS } from './src/pure/progress.js';
import { hoodUp } from './src/pure/look.js';
import { tierStep } from './src/pure/tier.js';
import { makeCanvases } from './screens.js';
import { Sound } from './sound.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
const coarse = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
// The visitor's own storage holds their look and progress; private windows and blocked storage just forget them.
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* forgotten */ } } };

const engine = makeEngine(canvas, coarse);
const { renderer, scene, camera } = engine;
// An unknown ?q= falls back to auto rather than stopping the page.
let tierName = Object.hasOwn(TIERS, params.get('q') || '') ? params.get('q') : 'auto', autoTier = tierName === 'auto';
engine.onTier(name => { world?.setGloss(name === 'high'); $('q').textContent = 'Quality: ' + (autoTier ? 'auto, ' : '') + name; });

// ---------- loading ----------
const load = makeLoader(f => { $('bar').style.width = (f * 100).toFixed(0) + '%'; });
const meta = await load.json('assets/world.json');
// My YouTube videos for the TV and the screening wall: [{ id, title, by }].
const media = await fetch('media.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
const videos = () => (media.videos || []).filter(v => /^[A-Za-z0-9_-]{11}$/.test(v.id || ''));
const [zoneGltfs, meGltf] = await Promise.all([Promise.all(meta.zones.map(z => load.glb('assets/' + z.glb, z.id))), load.glb('assets/behbod_v3.glb', 'me')]);

const screens = makeCanvases(meta, { videos });
const col = makeCollision(meta);
const phys = await makePhysics(col);
const physName = phys ? phys.name : 'boxes';
let world = null, nav = null;
// The sliding balcony door opens by itself for anyone who walks up, so the walk grid always treats it as open. Both
// grids (bookcase shut and open) are built once at the start, so opening the bookcase never stalls a frame.
const NAVS = {
  shut: makeNav(meta, { off: n => n === 'slider_slide' }),
  open: makeNav(meta, { off: n => n === 'slider_slide' || n === 'secret_door' }),
};
const buildNav = () => { nav = world.doors.secret?.open ? NAVS.open : NAVS.shut; };
const sound = new Sound();
const audio = makeAudio(sound);
let doorsReady = false;
// Doors tell the collision, the physics and the walk grid when they stop or start being solid.
world = makeWorld(scene, zoneGltfs.map(g => g.scene), meta, screens, (name, on) => {
  col.setSolid(name, on); phys?.setSolid(name, on);
  if (name === 'secret_door') buildNav();
  const d = meta.doors.find(x => x.collider === name);
  if (doorsReady && d?.slide) audio.sfx.door('glass', b2t(...d.at));
});
buildNav();
// The real 3D world outside the glass; if it cannot start, the painted backdrop stays.
let out3d = null;
try {
  out3d = makeOutside3d({ now: () => new Date(), weather: () => outside.weather, holiday: () => screens.holiday, quality: () => (tierName === 'auto' ? 'medium' : tierName) });
  engine.setBackground(out3d);
  scene.traverse(o => { if (o.name === 'backdrop') o.visible = false; });
} catch (e) { console.warn('[loft] the 3D outside could not start', e); out3d = null; }
const outside = makeOutside(scene, meta, screens, { traffic: !out3d });
const progress = makeProgress(store);
world.showUnlocks(progress.unlocked());

let savedLook = null, wardrobe = null;
try { savedLook = JSON.parse(store.get('loft.look') || 'null'); } catch (e) { savedLook = null; }
// makeMe dresses me once while it builds, so this runs before `me` exists and must not use it.
const me = makeMe(scene, meGltf, {
  saved: savedLook, mosaic: params.has('mosaic') || progress.has('whoami'), unlocked: () => progress.unlocked(),
  onLook: look => {
    $('who').textContent = HEAD_NAMES[look.head];
    $('hood').textContent = hoodUp(look) ? 'Hood up' : 'Hood down';
    store.set('loft.look', JSON.stringify(look));
    if (progress.sawHead(look.head) >= 5) earn('heads');
    if (wardrobe?.open) wardrobe.render();
  },
});
wardrobe = makeWardrobe(me, { unlocked: () => progress.unlocked() });
// Pishi sits at the north end of the keyboard, the end away from the mouse.
let kbTop;
const keyboard = () => {
  if (kbTop !== undefined) return kbTop;
  const box = new THREE.Box3();
  for (const o of world.deskThings) if (/^kb_/.test(o.name)) box.expandByObject(o);
  kbTop = box.isEmpty() ? null : new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.005, box.min.z + 0.1);
  return kbTop;
};
const creatures = makeCreatures(scene, meta, {
  nav: () => nav, groundAt: col.groundAt, sound, fx: audio.sfx, keyboard, toast,
  onEvent: (name, data) => { if (name === 'pishi_keys') { if (mode === 'desk') screens.type(data); } else earn(name); },
});
function toast(text) {
  const t = $('toast'); if (!t) return;
  t.textContent = text; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3600 + text.length * 25);
}
function earn(id) {
  const title = progress.earn(id);
  if (title) setTimeout(() => { toast('Achievement: ' + title); audio.sfx.achievement(); }, 400);
}

// ---------- the holo range, the telescope and the piano ----------
const UNLOCK_NAMES = { kit: 'the keeper kit', gold: 'the gold colourway', visor: 'the red visor', vault: 'the secret room' };
const range = makeRange(scene, camera, meta, {
  sfx: audio.sfx, best: () => progress.best('range'),
  onScore: s => {
    const got = progress.score('range', s);
    if (s >= 20) earn('range');
    world.showUnlocks(progress.unlocked()); wardrobe.render();
    return got.map(u => UNLOCK_NAMES[u]);
  },
  onExit: () => { mode = 'walk'; me.root.visible = true; },
});
const scope = makeTelescope(scene, camera, meta, {
  sky: out3d?.deathStar,
  onSpot: () => { toast('That is no moon.'); earn('telescope'); },
  onExit: () => { mode = 'walk'; me.root.visible = true; },
});
const pianoMode = makePianoMode(audio.piano, { onExit: () => stand(), onPlay: () => earn('piano') });
const panels = makePanels(store);
function enterRange() {
  if (mode !== 'walk') return;
  mode = 'range'; route = null; keys.clear();
  me.root.visible = false; $('prompt').classList.remove('on');
  range.enter();
}
function enterScope() {
  if (mode !== 'walk') return;
  mode = 'scope'; route = null; keys.clear();
  me.root.visible = false; $('prompt').classList.remove('on');
  scope.enter();
}
// The crate plays my four records in turn, then switches off.
let recAt = -1;
function playRecord() {
  const recs = audio.music.records;
  if (!sound.on) { toast('Turn the sound on (top right) to play a record.'); return; }
  recAt++;
  if (recAt >= recs.length) { recAt = -1; audio.music.stop(); world.setRecord(false); toast('Record off.'); return; }
  if (audio.music.play(recs[recAt].id)) { world.setRecord(true); earn('record'); toast(`Now playing: ${recs[recAt].title}. ${recs[recAt].mood}.`); }
}

// ---------- the terminal at the desk: commands beyond the built-in ones ----------
screens.command('achievements', say => {
  const got = progress.list();
  say(`${got.length} of ${Object.keys(ACHIEVEMENTS).length} achievements`, ...got.slice(-8).map(a => '  ' + a.title));
});
screens.command('hood', say => { me.toggleHood(); say(me.hoodUp ? 'hood up.' : 'hood down.'); });
screens.command('shoo', say => say(creatures.shoo() ? 'pishi hops off the keyboard.' : 'nobody is on the keyboard.'));
screens.command('deploy', say => { say('deploying...', 'build passed. shipped.'); world.deploy(performance.now() / 1000); audio.sfx.deploy(); earn('deploy'); });
screens.command('scene', (say, arg) => say(world.scene(arg) ? `lights: ${arg}` : 'scenes: ' + world.scenes.join('  ')));
screens.command('coolant', (say, arg) => say(world.coolant(arg) ? `coolant: ${arg}` : 'coolant colours: teal  purple  red  gold  white'));
screens.command('fan', say => say(world.fan() ? 'fan on.' : 'fan off.'));
screens.command('music', (say, arg) => {
  const recs = audio.music.records;
  if (arg === 'off') { audio.music.stop(); world.setRecord(false); say('music off.'); return; }
  const r = recs.find(x => arg && (x.id === arg || x.title.toLowerCase().includes(arg)));
  if (!r) { say('records: ' + recs.map(x => x.id).join('  '), 'music <name>  or  music off'); return; }
  if (!sound.on) { say('sound is off. turn it on at the top right.'); return; }
  audio.music.play(r.id); world.setRecord(true); earn('record'); say(`now playing: ${r.title}`);
});
addEventListener('loft:cmd', e => {
  if (e.detail.cmd !== 'whoami' || me.mosaicUnlocked) return;
  me.unlockMosaic();
  earn('whoami');
  e.detail.say('achievement unlocked: the real you.', 'press H (or the head button) to wear it.');
});

// ---------- state ----------
const pos = b2t(...meta.points.spawn);
const vel = new THREE.Vector3();
const physAt = pos.clone(), lastSafe = pos.clone();
const deskUse = b2t(...meta.points.desk_use), chair = b2t(...meta.points.chair);
const camLook = new THREE.Vector3();
const keys = new Set();
const LOOKS = meta.looks.map(p => b2t(...p));
const SPOTS = Object.fromEntries(Object.entries(meta.spots).map(([k, p]) => [k, b2t(...p)]));
let vy = 0, grounded = true, facing = meta.spawn?.facing ?? Math.PI / 2, mode = 'walk', near = null, seat = null, airT = 0, idleT = 0, lean = 0, prevFacing = facing;
let crouchHeld = false, lastCrouchTap = 0, rollT = 0, showStats = params.has('stats');
let yaw = meta.spawn?.yaw ?? 0, pitch = meta.spawn?.pitch ?? 0.3, dist = coarse ? 4.3 : 3.3, dragging = null, lastLook = 0;
// Where click-to-walk is heading: the waypoints still to reach, and what to do on arrival.
let route = null;
const things = makeInteract(meta.interact || []);
// What the residents need to know about me each frame.
const cctx = { player: pos, mode: 'walk', facing, stand: null };
me.root.position.copy(pos);
me.root.rotation.set(0, facing, 0);
phys?.place(pos);

const followPose = makeFollowCam(col, meta.regions);
const follow = () => followPose(pos, yaw, pitch, dist, me.crouchK);
const desk = makeDesk({ camera, me, meta, coarse, follow });

function useDesk() {
  if (mode !== 'walk') return;
  mode = 'desk';
  route = null;
  sound.chair();
  me.playOnce('Sitting_Enter');
  me.root.position.copy(chair);
  me.root.rotation.set(0, Math.PI / 2, 0);
  setTimeout(() => { if (mode === 'desk') me.holdPose('Sitting_Idle_Loop'); }, 900);
  desk.enter(camera.position, camLook);
  $('prompt').classList.remove('on');
  screens.focusTerminal(true);
  document.body.classList.add('at-desk');
  $('use').textContent = 'Back';
}
function leaveDesk() {
  if (mode !== 'desk') return;
  mode = 'leaving';
  screens.focusTerminal(false);
  document.body.classList.remove('at-desk');
  $('cmd').blur();
  me.playOnce('Sitting_Exit');
  desk.leave(camera.position, camLook, () => { mode = 'walk'; pos.copy(deskUse); me.root.position.copy(pos); phys?.place(pos); physAt.copy(pos); me.endOneShot(); });
  $('use').textContent = 'Use';
}

// ---------- sitting down anywhere there is a seat ----------
function sit(it) {
  if (mode !== 'walk') return;
  mode = 'sit'; seat = it; route = null;
  me.playOnce('Sitting_Enter');
  pos.copy(b2t(...it.seat));
  facing = prevFacing = headingToFacing(it.face);
  me.root.position.copy(pos);
  me.root.rotation.set(0, facing, 0);
  setTimeout(() => { if (mode === 'sit') me.holdPose('Sitting_Idle_Loop'); }, 900);
  $('prompt').classList.remove('on');
  $('use').textContent = 'Stand';
  earn('seat');
  if (it.id === 'piano') pianoMode.enter();
}
function stand() {
  if (mode !== 'sit') return;
  pianoMode.exit();
  me.playOnce('Sitting_Exit');
  mode = 'walk';
  pos.copy(b2t(...seat.at)); me.root.position.copy(pos); phys?.place(pos); physAt.copy(pos);
  seat = null;
  setTimeout(() => me.endOneShot(), 500);
  $('use').textContent = 'Use';
}

// ---------- things you walk up to and press E on ----------
const SAY = {
  board: 'The glass board: what I am building next.',
  vader: 'Lord Vader in his glass cube, saber up.',
  crate: 'My playlists go in this crate once Spotify is connected.',
  albums: 'Album art from my top tracks, once Spotify is connected.',
  tea: 'Fresh tea from the samovar.',
  resume: 'My resume is coming with the LinkedIn update.',
  secret_room: 'Locked. A score of 50 at the holo range opens it.',
  projects: 'My projects, all the way up the stairs.',
  printer: 'The 3D printer is making a little BH-22.',
  wall: 'The weather and this month, holidays circled.',
  trophies: 'The trophy shelf.',
  collection: 'The collection case.',
  unlocks: 'Win these at the holo range: the keeper kit, gold, and the red visor.',
  mirror: 'Looking good.',
};
// The arcade, the mini goal and the console all play the shootout; the boards play their own games.
const GAME_AT = { arcade: 'striker', penalties: 'striker', console: 'striker', holochess: 'holochess', backgammon: 'backgammon' };
const GAME_WIN = { striker: 'striker', holochess: 'chess', backgammon: 'backgammon' };
function playGame(name) {
  keys.clear(); route = null;
  openGame(name, {
    onEvent: (type, d) => {
      if (type === 'win') earn(GAME_WIN[d.game]);
      if (type === 'goal' && d.by === 'you') earn('goal');
    },
  });
}
let tvNext = 0;
function act(it) {
  if (!it) return;
  if (it.id === 'desk') return useDesk();
  if (it.seat) return sit(it);
  const at = b2t(...(it.at || [0, 0, 0]));
  if (it.id === 'secret') {
    const d = world.toggleDoor('secret');
    audio.sfx.door('bookcase', at);
    if (d.open) earn('secret');
    return toast(d.open ? 'The bookcase swings open.' : 'The bookcase swings shut.');
  }
  if (it.id === 'wardrobe') { world.openWardrobe(performance.now() / 1000); audio.sfx.door('wardrobe', at); return wardrobe.show(); }
  if (it.id === 'holiday') return toast(screens.holiday ? screens.holiday.text : 'No holiday today.');
  if (it.id === 'bh22' || it.id === 'pishi' || it.id === 'jessi') return creatures.act(it.id, cctx);
  if (GAME_AT[it.id]) return playGame(GAME_AT[it.id]);
  if (it.id === 'records') return playRecord();
  if (it.id === 'telescope') return enterScope();
  if (it.id === 'range') return enterRange();
  if (it.id === 'tea') { earn('tea'); audio.sfx.pour(at); }
  if (it.id === 'book') { earn('book'); return panels.book(); }
  if (it.id === 'about' || it.id === 'guestbook' || it.id === 'mailbox') return panels[it.id]();
  if (it.id === 'secret_room' && progress.unlocked().includes('vault')) { earn('vault'); return toast('The secret room is yours. It opens in the next build.'); }
  // The TV flips through every video in turn; the frames each keep their own.
  if (it.id === 'tv') { const n = videos().length; playVideo(n ? tvNext++ % n : 0); return; }
  if (/^video\d$/.test(it.id)) return playVideo(+it.id.slice(5));
  toast(SAY[it.id] || it.label);
}
// YouTube's own player over the room, so nothing is copied; only real video ids ever reach the address.
function playVideo(i) {
  const v = videos()[i];
  if (!v) return toast('Videos are coming soon.');
  // One player at a time: a new one replaces the old.
  document.querySelector('.video')?.remove();
  const box = document.createElement('div');
  box.className = 'video';
  const frame = document.createElement('iframe');
  frame.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture';
  frame.allowFullscreen = true;
  frame.title = v.title || 'Video';
  const close = document.createElement('button');
  close.className = 'chip'; close.textContent = 'Close';
  const shut = () => { box.remove(); removeEventListener('keydown', onKey, true); };
  // While it plays, keys stay with the player (no walking about behind it); Esc closes it.
  const onKey = e => { if (!box.isConnected) { removeEventListener('keydown', onKey, true); return; } e.stopPropagation(); if (e.key === 'Escape') shut(); };
  close.addEventListener('click', shut);
  addEventListener('keydown', onKey, true);
  box.append(frame, close);
  document.body.append(box);
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.target && (e.target.id === 'cmd' || e.target.tagName === 'INPUT')) return;
  if (mode === 'desk') { if (e.key.length === 1 || e.key === 'Enter') sound.key(); return screens.terminalKey(e, () => leaveDesk()); }
  // A held key repeats; the action keys only count the first press, or holding E would sit, stand, sit.
  if (e.repeat && (e.code === 'KeyE' || e.code === 'KeyO' || e.code === 'KeyH' || e.code === 'KeyG')) return;
  if (mode === 'range') { if (e.code === 'Escape') range.exit(); return; }
  if (mode === 'scope') {
    if (e.code === 'Escape' || e.code === 'KeyE') scope.exit();
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') scope.zoom(-1);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') scope.zoom(1);
    else keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
    return;
  }
  // At the piano the letter keys play it; Esc stands up.
  if (mode === 'sit' && pianoMode.active) {
    if (e.code === 'Escape') { stand(); return; }
    if (pianoMode.key(e)) { e.preventDefault(); return; }
  }
  if (e.code === 'Escape' && wardrobe.open) { wardrobe.hide(); return; }
  if (!e.repeat && e.code === 'KeyC' && mode === 'walk') {
    const now = performance.now();
    // Double tap C to roll; hold it to crouch. (Ctrl is avoided on purpose: Ctrl+W closes the tab.)
    if (now - lastCrouchTap < 300 && grounded && rollT <= 0) { rollT = 0.85; me.playOnce('Roll'); }
    lastCrouchTap = now;
  }
  keys.add(e.code);
  if (mode === 'sit' && (e.code === 'KeyE' || e.code === 'Escape' || /^(Key[WASD]|Arrow)/.test(e.code))) { stand(); return; }
  if (e.code === 'KeyE' && mode === 'walk' && near) act(near);
  if (e.code === 'KeyH' && mode === 'walk') me.nextHead();
  if (e.code === 'KeyG') me.toggleHood();
  if (e.code === 'KeyO') wardrobe.toggle();
  if (e.code === 'Backquote') { showStats = !showStats; $('stats').style.display = showStats ? 'block' : 'none'; }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.code); if (pianoMode.active) pianoMode.keyup(e); });
addEventListener('blur', () => keys.clear());
// Where the pointer is, in screen terms (-1 to 1), for the holo range's aim.
const pointerNdc = new THREE.Vector2();
const toNdc = e => new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
canvas.addEventListener('pointerdown', e => {
  dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 }; canvas.setPointerCapture(e.pointerId);
  if (mode === 'range') range.fire(toNdc(e));
});
canvas.addEventListener('pointermove', e => {
  pointerNdc.copy(toNdc(e));
  if (!dragging || e.pointerId !== dragging.id) return;
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  dragging.x = e.clientX; dragging.y = e.clientY; dragging.moved += Math.abs(dx) + Math.abs(dy);
  if (mode === 'desk' && desk.range) { desk.pan(dx); return; }
  if (mode === 'scope') { scope.nudge(-dx * 0.0025, dy * 0.0025); return; }
  if (mode !== 'walk' && mode !== 'sit') return;
  yaw -= dx * 0.005; pitch = Math.max(-0.15, Math.min(1.1, pitch + dy * 0.004)); lastLook = performance.now();
});
canvas.addEventListener('pointerup', e => {
  // Only the finger that started the drag counts, so a second finger never turns into a tap.
  if (!dragging || e.pointerId !== dragging.id) return;
  if (dragging.moved < 6 && mode === 'walk') tapMove(e);
  // At the desk a click on Pishi shoos her off the keyboard.
  else if (dragging.moved < 6 && mode === 'desk') { aim(e); if (creatures.hit(ray) === 'pishi') creatures.shoo(); }
  dragging = null;
});
canvas.addEventListener('pointercancel', e => { if (dragging && e.pointerId === dragging.id) dragging = null; });
canvas.addEventListener('wheel', e => {
  if (mode === 'scope') { scope.zoom(Math.sign(e.deltaY)); return; }
  dist = Math.max(1.8, Math.min(6, dist * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: true });
// Phones: a thumb stick in the corner walks me the way WASD does.
const joy = { x: 0, y: 0, id: null };
{
  const pad = $('joy'), nub = pad.firstElementChild;
  const move = e => {
    const r = pad.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    joy.x = x; joy.y = y; nub.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
  };
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; nub.style.transform = ''; };
  pad.addEventListener('pointerdown', e => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); move(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === joy.id) move(e); });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}

// Walk somewhere along a path round the furniture and up the stairs; `then` runs on arrival.
function walkTo(target, then) {
  const p = nav.path([pos.x, -pos.z, pos.y], [target.x, -target.z, target.y]);
  if (!p) return false;
  route = { points: p.slice(1).map(q => b2t(...q)), then };
  return true;
}
// The chips walk you there when they can, and fade-jump across otherwise.
function goTo(name) {
  if (mode !== 'walk' || !SPOTS[name]) return;
  const then = name === 'desk' ? useDesk : null;
  if (walkTo(SPOTS[name], then)) return;
  const veil = $('veil');
  veil.classList.add('on');
  setTimeout(() => {
    pos.copy(SPOTS[name]); vel.set(0, 0, 0); route = null;
    me.root.position.copy(pos);
    camera.position.copy(follow().p);
    veil.classList.remove('on');
    then?.();
  }, 300);
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.go)));
$('cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { screens.run(e.target.value, () => leaveDesk()); e.target.value = ''; sound.key(); } });
$('use').addEventListener('click', () => {
  if (mode === 'desk') leaveDesk(); else if (mode === 'sit') stand(); else if (mode === 'range') range.exit(); else if (mode === 'scope') scope.exit(); else if (near) act(near);
});
$('hood').addEventListener('click', () => me.toggleHood());
$('closet').addEventListener('click', () => wardrobe.toggle());
const ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aim = e => ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
function tapMove(e) {
  aim(e);
  if (ray.intersectObjects(world.deskThings, false).length) { walkTo(SPOTS.desk, useDesk); return; }
  // Clicking a resident walks me over to them and says hello on arrival.
  const who = creatures.hit(ray);
  if (who) {
    const a = creatures[who];
    walkTo(a.pos.clone(), () => { const it = creatures.nearest(pos); if (it && it.id === who) act(it); });
    return;
  }
  // Aim at whatever floor the click lands on, then walk there along a path.
  const hits = ray.intersectObjects(zoneGltfs.map(g => g.scene), true).filter(h => h.face && h.face.normal.y > 0.7);
  const hit = hits[0]?.point;
  if (hit) { walkTo(hit); return; }
  floorPlane.constant = -pos.y;
  const flat = new THREE.Vector3();
  if (ray.ray.intersectPlane(floorPlane, flat)) walkTo(flat);
}
function forwardInput() {
  const f = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) f.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) f.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) f.x += 1;
  if (Math.hypot(joy.x, joy.y) > 0.18) { f.x += joy.x; f.z += joy.y; }
  if (f.lengthSq()) route = null;
  if (route) {
    const next = route.points[0];
    if (!next) { const then = route.then; route = null; then?.(); return f; }
    const d = next.clone().sub(pos); d.y = 0;
    if (d.length() < (route.points.length > 1 ? 0.3 : 0.2)) { route.points.shift(); return forwardInput(); }
    return d.normalize();
  }
  if (!f.lengthSq()) return f;
  // The camera sits at angle `yaw` from me, so turning the input by `yaw` makes W point away from it.
  return f.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ---------- walking ----------
function walk(dt, now) {
  // Anything that moved me from outside (the tests, leaving the desk, the respawn) moves the capsule too.
  if (phys && pos.distanceToSquared(physAt) > 1e-6) phys.place(pos);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.95;
  crouchHeld = keys.has('KeyC') && rollT <= 0;
  const want = forwardInput();
  // Arriving can sit me down or start the desk (a path's `then`); that mode places me from here on.
  if (mode !== 'walk') return 0;
  const speed = want.lengthSq() ? (crouchHeld ? 1.2 : run ? 5.6 : route ? 2.2 : 1.9) : 0;
  let target = want.multiplyScalar(speed);
  if (rollT > 0) { rollT -= dt; target = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)).multiplyScalar(4.2); }
  const k = grounded ? 10 : 2.5;
  vel.x += (target.x - vel.x) * Math.min(1, k * dt);
  vel.z += (target.z - vel.z) * Math.min(1, k * dt);
  if (keys.has('Space') && grounded && rollT <= 0) { vy = 5.1; grounded = false; airT = 0; me.playOnce('Jump_Start'); sound.jump(); keys.delete('Space'); }
  vy -= 18 * dt;
  const wasGrounded = grounded;
  if (phys) {
    grounded = phys.move(pos, { x: vel.x * dt, y: vy * dt, z: vel.z * dt });
    if (grounded && vy < 0) vy = 0;
  } else {
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    col.pushOut(pos, pos.y);
    pos.y += vy * dt;
    const g = col.groundAt(pos.x, pos.z, pos.y - vy * dt);
    if (pos.y <= g) { pos.y = g; vy = 0; grounded = true; } else if (pos.y > g + 0.05) grounded = false;
  }
  physAt.copy(pos);
  if (grounded && !wasGrounded && airT > 0.25) { me.playOnce('Jump_Land'); sound.land(); }
  // Safety net: if anything ever lets me slip out of the world, put me back where I last stood.
  if (grounded) { lastSafe.copy(pos); airT = 0; }
  else if (pos.y < -2) { pos.copy(lastSafe); vy = 0; vel.set(0, 0, 0); }
  if (!grounded) { airT += dt; if (airT > 0.22 && me.oneShot !== me.acts.Jump_Loop) me.holdPose('Jump_Loop'); }
  else if (me.oneShot === me.acts.Jump_Loop) me.endOneShot();
  const hs = Math.hypot(vel.x, vel.z);
  if (hs > 0.05 && rollT <= 0) { let d = Math.atan2(vel.x, vel.z) - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, 12 * dt); }
  // Lean into turns when moving fast.
  const turnRate = Math.atan2(Math.sin(facing - prevFacing), Math.cos(facing - prevFacing)) / Math.max(dt, 1e-3);
  prevFacing = facing;
  lean += (THREE.MathUtils.clamp(-turnRate * hs * 0.018, -0.2, 0.2) - lean) * Math.min(1, dt * 6);
  idleT = hs < 0.12 && grounded ? idleT + dt : 0;
  // Idle moments: left alone, I glance around, and now and then do something with my hands.
  if (idleT > 14 && !me.oneShot) { me.playOnce('Interact'); idleT = 4; }
  me.root.position.copy(pos);
  me.root.rotation.set(0, facing, lean, 'YXZ');
  if (grounded && hs > 0.3) sound.stepTick(hs > 4.5 ? me.acts.Sprint_Loop : hs > 2.6 ? me.acts.Jog_Fwd_Loop : me.acts.Walk_Loop, hs);
  // Let the camera drift back behind me while I move and nobody is steering it.
  if (hs > 0.5 && now - lastLook > 1600 && !coarse) { let d = (facing + Math.PI) - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, 1.2 * dt); }
  if (-pos.z > meta.regions[1].min[1]) earn('balcony');
  const was = near;
  near = null;
  if (grounded) {
    const a = things.nearest(pos), c = creatures.nearest(pos);
    near = !c ? a : !a ? c : Math.hypot(pos.x - c.x, pos.z - c.z) < Math.hypot(pos.x - a.x, pos.z - a.z) ? c : a;
  }
  if (near && (near !== was || $('prompt').lastChild.nodeValue !== near.label)) $('prompt').lastChild.nodeValue = near.label;
  $('prompt').classList.toggle('on', !!near);
  return hs;
}

// ---------- sound of the room: the city through the glass, the sea and wind outside, rain, the fire, the printer ----------
let ambT = 0, printing = false;
const printerAt = meta.points.printer ? b2t(...meta.points.printer) : null;
function ambience(dt) {
  if ((ambT -= dt) > 0) return;
  ambT = 0.5;
  const north = -pos.z, out = north > 15.1, rainy = outside.weather === 'rain';
  audio.ambience.set('city', out ? 0.9 : Math.max(0.15, 0.6 - Math.max(0, 15 - north) * 0.05));
  audio.ambience.set('waves', out ? 0.6 : 0);
  audio.ambience.set('wind', out ? 0.5 : 0);
  audio.ambience.set('rain', rainy ? (out ? 1 : 0.45) : 0);
  audio.ambience.set('fire', Math.max(0, 1 - Math.hypot(pos.x - 4.35, north - 10.6) / 5));
  const nearPrinter = !!printerAt && pos.distanceTo(printerAt) < 3.5;
  if (nearPrinter !== printing) { printing = nearPrinter; audio.sfx.printer(printing, printerAt); }
}

// ---------- frame loop ----------
const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
const FOG_NIGHT = new THREE.Color(0x0a0f1c), FOG_DAY = new THREE.Color(0x6f8197);
const clock = new THREE.Clock();
let frames = 0, ftAcc = 0, tierChecked = 0, slowRuns = 0;
function step() {
  const dt = Math.min(clock.getDelta(), 1 / 20), now = performance.now(), t = now / 1000;
  renderer.info.reset();
  const hs = mode === 'walk' ? walk(dt, now) : 0;
  me.placeBlob(col.groundAt);
  me.animate(dt, hs, mode === 'walk' && crouchHeld);
  me.lookAround(dt, idleT, facing, mode === 'walk', LOOKS);
  if (!desk.tick(dt, camLook, () => mode === 'desk')) {
    if (mode === 'walk' || mode === 'sit') {
      const tp = follow();
      camera.position.lerp(tp.p, Math.min(1, 7 * dt));
      camLook.lerp(tp.l, Math.min(1, 9 * dt));
    } else if (mode === 'desk' && desk.range) {
      camera.position.lerp(desk.eye(), Math.min(1, 10 * dt));
      camLook.lerp(desk.aim(), Math.min(1, 10 * dt));
    } else if (mode === 'range') {
      range.view(tmpP, tmpL, pointerNdc.x, pointerNdc.y);
      camera.position.lerp(tmpP, Math.min(1, 6 * dt));
      camLook.lerp(tmpL, Math.min(1, 6 * dt));
    } else if (mode === 'scope') {
      const k = dt * 0.5;
      scope.nudge((keys.has('ArrowRight') || keys.has('KeyD') ? k : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? k : 0), (keys.has('ArrowUp') || keys.has('KeyW') ? k : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? k : 0));
      scope.view(camera.position, camLook);
    }
  }
  camera.lookAt(camLook);
  range.tick(dt, t); scope.tick(dt);
  me.drawFace(now);
  me.tickMosaic(now, camera, engine.mosaicU);
  screens.tick(now, dt, mode === 'desk');
  world.tick(dt, t, mode === 'desk', camera.position, pos, creatures.positions);
  cctx.mode = mode; cctx.facing = facing; cctx.stand = seat ? seat.at : null;
  creatures.tick(dt, t, cctx);
  outside.tick(dt, t);
  if (out3d) {
    out3d.tick(dt, t, camera);
    // The haze inside the loft and the light on its walls follow the time of day outside.
    const k = out3d.light.dayK;
    scene.fog.color.lerpColors(FOG_NIGHT, FOG_DAY, k);
    world.daylight(k);
  }
  audio.setListener(camera.position, camera.getWorldDirection(tmpP));
  audio.tick();
  ambience(dt);
  doorsReady = true;
  engine.render(dt);

  frames++; ftAcc += dt;
  if (autoTier && frames > 40 && now - tierChecked > 2500) {
    tierChecked = now;
    const r = tierStep(tierName, ftAcc / frames * 1000, now, slowRuns);
    slowRuns = r.slowRuns;
    if (r.tier !== tierName) { tierName = r.tier; engine.setTier(tierName); }
    frames = 0; ftAcc = 0;
  }
  if (showStats) $('stats').textContent = `${(1 / Math.max(dt, 1e-3)).toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · ${physName} · ${outside.weather}${screens.holiday ? ' · ' + screens.holiday.id : ''}`;
  requestAnimationFrame(step);
}

$('q').addEventListener('click', () => {
  const order = ['auto', 'low', 'medium', 'high'];
  const next = order[(order.indexOf(autoTier ? 'auto' : tierName) + 1) % order.length];
  autoTier = next === 'auto';
  tierName = autoTier ? 'high' : next;
  engine.setTier(tierName);
});
$('who').addEventListener('click', () => { if (mode === 'walk') me.nextHead(); });
$('snd').addEventListener('click', () => { const on = sound.toggle(); $('snd').textContent = on ? 'Sound on' : 'Sound off'; $('snd').classList.toggle('on', on); });
if (showStats) $('stats').style.display = 'block';

if (tierName === 'auto') tierName = coarse ? 'medium' : 'high';
engine.setTier(tierName);
engine.resize();
const start = follow();
camera.position.copy(start.p); camLook.copy(start.l);
$('note').textContent = coarse ? 'Tap a spot or the floor to walk there' : 'Drag to look around, WASD to walk, click to go somewhere';
$('enter').classList.add('ready');
$('enter').addEventListener('click', () => { $('gate').classList.add('gone'); sound.start(); $('snd').textContent = 'Sound on'; $('snd').classList.add('on'); earn('welcome'); });
if (params.has('auto')) $('gate').classList.add('gone');
window.__loft = { pos, keys, useDesk, leaveDesk, nextHead: () => me.nextHead(), renderer, camera, scene, meta, world, me, progress, creatures, range, scope, audio, out3d, pianoMode, act: id => act(things.items.find(i => i.id === id)), stand,
  walkTo: (x, y, z) => walkTo(b2t(x, y, z)), goTo, chair, get route() { return route ? route.points.length : 0; }, wardrobe,
  get near() { return near?.id ?? null; }, get facing() { return facing; },
  get head() { return me.head; }, get mode() { return mode; }, get tier() { return tierName; }, get physics() { return physName; },
  get weights() { return me.weights; }, get headVisible() { return me.root.visible; }, get headMeshesShown() { return me.headMeshesShown; },
  set yaw(v) { yaw = v; lastLook = performance.now(); } };
requestAnimationFrame(step);
