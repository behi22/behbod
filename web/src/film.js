import { HOUSE, makeBH } from './intro.js';

// My story over the room, filling the window like a game's opening scene: no player, just the picture. Held for a
// second, Space (or a finger, on a phone) skips it, and Esc closes it at once. Offered at the door, where it ends on
// the drawing again ("Welcome Home": in, or watch it again), and replayed from the TV and the computer, where it just
// closes. A screen taller than it is wide gets the tall cut. open() resolves 'in' at the door once you go in, else
// 'closed'.
const CUTS = { wide: 'assets/film/home-film-wide.mp4', tall: 'assets/film/home-film-tall.mp4' };
const HOLD = 1;

export function makeFilm() {
  let current = null;
  function open({ muted = false, door = null } = {}) {
    if (current) return current.done;
    const tall = innerHeight > innerWidth, coarse = matchMedia('(pointer: coarse)').matches;
    const box = document.createElement('div');
    box.className = 'video film' + (tall ? ' tall' : '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'My story');
    const v = document.createElement('video');
    v.src = tall ? CUTS.tall : CUTS.wide;
    v.playsInline = true; v.preload = 'auto'; v.muted = muted;
    v.setAttribute('playsinline', '');
    const skip = document.createElement('div');
    skip.className = 'i-skip';
    skip.innerHTML = `<svg class="i-ring" viewBox="0 0 32 32"><circle class="bgc" cx="16" cy="16" r="13"/><circle class="fg" cx="16" cy="16" r="13" pathLength="1"/></svg><span>${coarse ? 'Hold to skip' : 'Hold <kbd>SPACE</kbd> to skip'}</span>`;
    const ring = skip.querySelector('.fg');
    box.append(v, skip);
    document.body.append(box);
    let finish, alive = true, held = false, hold = 0, last = performance.now(), ending = null, endTimers = [];
    const me = current = { done: new Promise(r => { finish = r; }), scene: 'film', video: v };

    function shut(how) {
      if (!alive) return;
      alive = false;
      endTimers.forEach(clearTimeout);
      v.pause();
      removeEventListener('keydown', onKey, true); removeEventListener('keyup', onUp, true); removeEventListener('pointerup', onUp, true); removeEventListener('pointercancel', onUp, true);
      // Into the house from the door: the story (or its ending) fades out over the room, the door under it already
      // gone, so the door never shows in between. Otherwise it closes at once.
      const drop = () => { v.removeAttribute('src'); v.load(); box.remove(); };
      if (how === 'in') { box.classList.add('leaving'); setTimeout(drop, 600); } else drop();
      if (current === me) current = null;
      finish(how);
    }
    // Skipped: at the door straight in if home is ready, else back to the door until it is ('wait'); elsewhere,
    // closed. Only a story watched to its end gets the ending.
    function skipIt() {
      if (!door) return shut('closed');
      shut(door.ready() ? 'in' : 'wait');
    }
    // The end, at the door: the house draws itself again, BH-22 rolls to the front door and hops, the door lights up,
    // then "Welcome Home" and the two ways on rise in. Enter waits for home to be ready.
    function showEnd() {
      if (!alive) return;
      v.pause(); held = false; me.scene = 'end'; skip.hidden = true;
      endTimers.forEach(clearTimeout); endTimers = [];
      ending?.remove();
      ending = document.createElement('div');
      ending.className = 'i-end i-paper';
      ending.innerHTML = `<div class="i-col"><div class="i-housebox"><svg class="i-house" viewBox="0 0 400 236" aria-hidden="true">${HOUSE}</svg><div class="i-door"></div><div class="i-bh i-endbh"></div></div>
        <div class="i-name i-reveal"><h2>Welcome Home</h2><p>BEHBOD BABAI</p></div>
        <div class="i-row i-reveal"><button class="i-btn main" type="button" data-go="in">Enter${coarse ? '' : ' <kbd>ENTER</kbd>'}</button><button class="i-btn alt" type="button" data-go="again">Watch again${coarse ? '' : ' <kbd>R</kbd>'}</button></div></div>`;
      const note = box.querySelector('.film-note');
      if (note) ending.querySelector('.i-row').before(note);
      box.append(ending);
      ending.querySelectorAll('.i-house path').forEach((p, i) => { p.style.animationDelay = (i * 0.07) + 's'; });
      const bhEl = ending.querySelector('.i-endbh'), bh = makeBH(bhEl), inBtn = ending.querySelector('[data-go="in"]');
      bh.move(false);
      const at = (ms, f) => endTimers.push(setTimeout(f, ms));
      at(900, () => { bh.move(true); bhEl.classList.add('there'); });
      at(2700, () => { bh.move(false); bh.hop(); });
      at(3100, () => ending.querySelector('.i-door').classList.add('on'));
      at(3300, () => ending.querySelector('.i-name').classList.add('in'));
      at(3700, () => ending.querySelector('.i-row').classList.add('in'));
      const look = now => { if (!alive || me.scene !== 'end') return; bh.tick(now); requestAnimationFrame(look); };
      requestAnimationFrame(look);
      if (!door.ready()) { inBtn.disabled = true; door.whenReady.then(() => { inBtn.disabled = false; }); }
      ending.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (b.dataset.go === 'in') shut('in'); else again(); });
      inBtn.focus({ preventScroll: true });
    }
    function again() {
      endTimers.forEach(clearTimeout); endTimers = [];
      ending?.remove(); ending = null; me.scene = 'film'; skip.hidden = false;
      v.currentTime = 0; v.play()?.catch(() => {});
      box.focus({ preventScroll: true });
    }

    // While it plays, keys stay with it (no walking about behind it).
    const onKey = e => {
      e.stopPropagation();
      if (me.scene === 'end') {
        if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (door.ready()) shut('in'); }
        else if (e.key === 'r' || e.key === 'R') again();
        return;
      }
      if (e.key === 'Escape') skipIt();
      else if (e.key === ' ') { e.preventDefault(); if (!e.repeat) held = true; }
    };
    const onUp = e => { if (e.type !== 'keyup' || e.key === ' ') held = false; };
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onUp, true);
    addEventListener('pointerup', onUp, true);
    addEventListener('pointercancel', onUp, true);
    box.addEventListener('pointerdown', e => { if (me.scene === 'film' && !e.target.closest('button')) held = true; });
    // The ring fills over a second's hold and drains three times as fast once let go.
    const fillRing = now => {
      if (!alive) return;
      // A frame's time can come before the moment it opened, so the step is never below zero (that filled the ring).
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
      hold = Math.max(0, Math.min(HOLD, hold + (held && me.scene === 'film' ? dt : -3 * dt)));
      ring.style.strokeDashoffset = String(1 - hold / HOLD);
      if (hold >= HOLD) { hold = 0; held = false; skipIt(); }
      requestAnimationFrame(fillRing);
    };
    requestAnimationFrame(fillRing);
    v.addEventListener('ended', () => { if (door) showEnd(); else shut('closed'); });
    v.addEventListener('error', () => {
      if (!alive || box.querySelector('.film-note')) return;
      const note = document.createElement('p');
      note.className = 'film-note'; note.textContent = 'My story could not be played here.';
      box.append(note);
      if (door) showEnd();
    });
    // Started from a key or a tap, so it may play with its sound.
    v.play()?.catch(() => {});
    box.tabIndex = -1;
    box.focus({ preventScroll: true });
    return me.done;
  }
  // left: the seconds of the story still to play.
  return { open, get playing() { return !!current; }, get scene() { return current?.scene ?? null; },
    get left() { const v = current?.video; return v?.duration ? v.duration - v.currentTime : Infinity; } };
}
