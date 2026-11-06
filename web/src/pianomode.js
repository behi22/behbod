// Sitting at the piano: the keyboard plays it (A W S E D F T G Y H U J K O L P ;, Z and X shift the octave), the
// keys on screen light up and can be tapped. Each song has two ways: Learn (the next keys glow gold and wait for you)
// and Play for me (it plays on, with BH-22 on the duet, even after you stand up and walk off).
const CSS = `
.pm { position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 30; width: min(760px, calc(100vw - 32px));
  box-sizing: border-box; padding: 12px; border-radius: 14px; background: rgba(10, 12, 18, .86); border: 1px solid rgba(255,255,255,.14);
  font: 500 12px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #d8dee9; }
.pm-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.pm-row .grow { flex: 1 1 auto; color: #8a93a6; }
.pm button { font: inherit; color: #e8edf5; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 5px 10px; cursor: pointer; }
.pm button[aria-pressed="true"] { border-color: #3ee6c4; color: #3ee6c4; }
.pm-keys { position: relative; height: 92px; touch-action: none; user-select: none; }
.pm-w { position: absolute; top: 0; height: 92px; box-sizing: border-box; background: #eeeae2; border: 1px solid #23262d; border-radius: 0 0 4px 4px; }
.pm-b { position: absolute; top: 0; height: 56px; background: #15171c; border-radius: 0 0 3px 3px; z-index: 1; }
.pm-w.on { background: #3ee6c4; } .pm-b.on { background: #1fa58c; }
.pm-w.duet { background: #b993ff; } .pm-b.duet { background: #7a52d0; }
.pm-w.next { background: #f5c451; box-shadow: inset 0 -6px 0 #d69a1e; } .pm-b.next { background: #c48f1c; }
.pm-song { display: inline-flex; gap: 4px; align-items: center; margin-right: 6px; } .pm-song b { font-weight: 600; color: #e8edf5; margin-right: 2px; }
.pm-msg { color: #f5c451; }
.pm-w span { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; color: #6a6f78; font-size: 10px; }
`;
const LO = 48, HI = 84, BLACK = new Set([1, 3, 6, 8, 10]);
const LABELS = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';'];

export function makePianoMode(piano, { onExit, onPlay, onLearned }) {
  if (!document.getElementById('pm-css')) { const s = document.createElement('style'); s.id = 'pm-css'; s.textContent = CSS; document.head.append(s); }
  let el = null, keys = {}, duet = true, active = false, lesson = null, hint = null;
  const light = (m, on, who) => { const k = keys[m]; if (!k) return; k.classList.toggle('on', on && who !== 'bh22'); k.classList.toggle('duet', on && who === 'bh22'); };
  function labels() {
    for (const k of Object.values(keys)) k.querySelector('span')?.remove();
    const base = 60 + 12 * piano.octave;
    LABELS.forEach((l, i) => { const k = keys[base + i]; if (k && !BLACK.has((base + i) % 12)) { const s = document.createElement('span'); s.textContent = l; k.append(s); } });
  }
  function build() {
    el = document.createElement('div'); el.className = 'pm'; el.setAttribute('role', 'dialog'); el.ariaLabel = 'Piano';
    const row = document.createElement('div'); row.className = 'pm-row';
    hint = document.createElement('span'); hint.className = 'grow'; hint.textContent = 'Play with the keys shown, Z and X for the octave';
    row.append(hint);
    const songs = document.createElement('div'); songs.className = 'pm-row';
    const button = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); return b; };
    for (const s of piano.songs) {
      const g = document.createElement('span'); g.className = 'pm-song';
      const name = document.createElement('b'); name.textContent = s.title.replace(/ No\. 1$/, '');
      g.append(name, button('Learn', () => learn(s)), button('Play for me', () => { endLesson(); piano.playSong(s.id, { duet, onNote: n => light(n.midi, n.on, n.who) }); onPlay(); }));
      songs.append(g);
    }
    const d = document.createElement('button'); d.type = 'button'; d.textContent = 'BH-22 duet'; d.setAttribute('aria-pressed', String(duet));
    d.addEventListener('click', () => { duet = !duet; d.setAttribute('aria-pressed', String(duet)); });
    const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Stop';
    stop.addEventListener('click', () => { piano.stopSong(); endLesson(); for (const m of Object.keys(keys)) light(+m, false); });
    const up = document.createElement('button'); up.type = 'button'; up.textContent = 'Stand up';
    up.addEventListener('click', () => onExit());
    row.append(d, stop, up);
    const board = document.createElement('div'); board.className = 'pm-keys';
    const whites = []; for (let m = LO; m <= HI; m++) if (!BLACK.has(m % 12)) whites.push(m);
    const w = 100 / whites.length;
    keys = {};
    whites.forEach((m, i) => { const k = document.createElement('div'); k.className = 'pm-w'; k.style.left = i * w + '%'; k.style.width = w + '%'; k.dataset.m = m; board.append(k); keys[m] = k; });
    for (let m = LO; m <= HI; m++) {
      if (!BLACK.has(m % 12)) continue;
      const i = whites.indexOf(m - 1);
      const k = document.createElement('div'); k.className = 'pm-b'; k.style.left = (i + 0.68) * w + '%'; k.style.width = w * 0.64 + '%'; k.dataset.m = m; board.append(k); keys[m] = k;
    }
    // Tapping the keys on screen plays them too, so it works on a phone.
    const held = new Map();
    board.addEventListener('pointerdown', e => {
      const m = +e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      board.setPointerCapture(e.pointerId);
      held.set(e.pointerId, m); piano.noteOn(m, 0.75); light(m, true); onPlay(); pressed(m);
    });
    const release = e => { const m = held.get(e.pointerId); if (m) { piano.noteOff(m); light(m, false); held.delete(e.pointerId); } };
    board.addEventListener('pointerup', release);
    board.addEventListener('pointercancel', release);
    el.append(row, songs, board);
    document.body.append(el);
    labels();
    if (lesson) showStep();
  }
  // Learn: the melody, a step at a time (notes struck together are one step), moved by octaves onto the keys on
  // screen; the keyboard's octave follows so the letter keys reach it.
  function learn(s) {
    piano.stopSong();
    const notes = piano.lead(s.id);
    if (!notes.length) return;
    const steps = [];
    for (const n of notes) { const last = steps[steps.length - 1]; if (last && Math.abs(last.t - n.t) < 0.02) last.midis.push(n.midi); else steps.push({ t: n.t, midis: [n.midi] }); }
    const all = steps.flatMap(st => st.midis), lo = Math.min(...all), hi = Math.max(...all);
    let shift = 0;
    while (lo + shift < LO) shift += 12;
    while (hi + shift > HI && lo + shift - 12 >= LO) shift -= 12;
    for (const st of steps) st.midis = st.midis.map(m => m + shift);
    piano.setOctave(Math.round((Math.min(...steps.flatMap(st => st.midis)) - 60) / 12));
    labels();
    lesson = { title: s.title.replace(/ No\. 1$/, ''), steps, i: 0, hit: new Set() };
    showStep();
  }
  function endLesson() { lesson = null; for (const k of Object.values(keys)) k.classList.remove('next'); if (hint) { hint.textContent = 'Play with the keys shown, Z and X for the octave'; hint.classList.remove('pm-msg'); } }
  function showStep() {
    for (const k of Object.values(keys)) k.classList.remove('next');
    if (!lesson) return;
    const st = lesson.steps[lesson.i];
    for (const m of st.midis) if (!lesson.hit.has(m)) keys[m]?.classList.add('next');
    hint.textContent = `${lesson.title}: ${lesson.i + 1} of ${lesson.steps.length}. Play the gold keys.`;
    hint.classList.add('pm-msg');
  }
  function pressed(m) {
    if (!lesson) return;
    const st = lesson.steps[lesson.i];
    if (!st.midis.includes(m)) return;
    lesson.hit.add(m);
    if (st.midis.every(x => lesson.hit.has(x))) {
      lesson.i++; lesson.hit.clear();
      if (lesson.i >= lesson.steps.length) {
        const title = lesson.title;
        endLesson();
        hint.textContent = `You played ${title}!`; hint.classList.add('pm-msg');
        onLearned?.(title);
        return;
      }
    }
    showStep();
  }
  return {
    get active() { return active; },
    enter() { if (active) return; active = true; build(); },
    // A song set playing keeps going after you stand up; a lesson ends with you.
    exit() { if (!active) return; active = false; lesson = null; el?.remove(); el = null; },
    // Returns true when the key belonged to the piano.
    key(e) {
      if (e.code === 'KeyZ' || e.code === 'KeyX') { piano.keyToMidi(e); labels(); return true; }
      const m = piano.keyToMidi(e);
      if (m === null) return false;
      if (!e.repeat) { piano.noteOn(m, 0.75); light(m, true); onPlay(); pressed(m); }
      return true;
    },
    keyup(e) { const m = piano.keyToMidi(e); if (m !== null) { piano.noteOff(m); light(m, false); } },
  };
}
