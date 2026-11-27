// The door in blueprint ink: the house drawn line by line as the site loads, BH-22 riding the loading line and saying
// what it is doing, my story offered on any key (on a phone, a tap), and a way straight in once home is ready.
export const HOUSE = ['M22 220 H378', 'M60 220 V126', 'M340 220 V126', 'M46 136 L130 62 L214 136', 'M186 136 L270 62 L354 136', 'M130 62 H270',
  'M60 164 H196', 'M196 220 V208 H210 V196 H224 V184 H238 V172 H252 V164', 'M262 148 H322 V204 H262 Z', 'M292 148 V204 M262 176 H322',
  'M82 220 V178 H110 V220', 'M118 118 H160 V146 H118 Z', 'M228 100 V74 H240 V90'].map(d => `<path pathLength="1" d="${d}"/>`).join('')
  + '<path class="i-tick" pathLength="1" d="M22 230 H378 M22 226 V234 M378 226 V234 M200 226 V234"/>';

export const LINES = ['Waking up BH-22', 'Feeding Pishi and Jessi', 'Tuning the piano', 'Brewing the tea', 'Plugging in the PC', 'Booting the terminal',
  'Stacking the game shelf', 'Pumping up the ball', 'Lining up the penalty', 'Checking the Real Madrid score', 'Setting up the backgammon board',
  'Dusting off the Shahnameh', 'Warming up the 3D printer', 'Restocking the range', 'Watering the succulent', 'Filling the fish tank',
  'Turning on the LEDs', 'Waving at the ferry', 'Opening the blinds', 'Fluffing the bean bag', 'Locking the secret door', 'Asking Pishi to get off the keyboard'];

// BH-22, the Hopper, as in the house: a black dome with a lit rim, a face screen with dot eyes, an antenna, legs on wheels.
const BH = `<svg viewBox="0 0 48 60" aria-hidden="true"><ellipse cx="24" cy="58.4" rx="13" ry="1.8" fill="rgba(0,0,0,.45)"/><g class="all"><g class="bodyg">
<path d="M18.5 39 L16.5 45.5 L15.5 50 M29.5 39 L31.5 45.5 L32.5 50" stroke="#252932" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="16.5" cy="45.5" r="1.3" fill="#3a3f4c"/><circle cx="31.5" cy="45.5" r="1.3" fill="#3a3f4c"/>
${[15, 33].map(x => `<g class="spin"><circle cx="${x}" cy="52.5" r="5" fill="#0b0c10" stroke="#b5cff2" stroke-width=".9" stroke-opacity=".8"/><path d="M${x} 48.2 V56.8 M${x - 3.7} 50.4 L${x + 3.7} 54.6 M${x - 3.7} 54.6 L${x + 3.7} 50.4" stroke="#2f3440" stroke-width=".9"/><circle cx="${x}" cy="52.5" r="1.6" fill="#3a3f4c"/></g>`).join('')}
<rect x="15" y="33.5" width="18" height="7" rx="3" fill="#15171d"/><path d="M17.5 39 H30.5" stroke="#b5cff2" stroke-width=".8" filter="url(#bhGlow)"/>
<g class="dome"><g class="ant"><path d="M24 9 V3.5" stroke="#3a3f4c" stroke-width="1.4" stroke-linecap="round"/><circle class="ball" cx="24" cy="2.6" r="2.2" fill="#b5cff2" filter="url(#bhGlow)"/></g>
<rect x="6" y="8" width="36" height="27" rx="13" fill="url(#bhDome)"/><path d="M9.5 29.5 Q24 37.5 38.5 29.5" stroke="#b5cff2" stroke-width="1" fill="none" filter="url(#bhGlow)"/>
<circle cx="6.8" cy="21" r="1.7" fill="#23262e" stroke="#b5cff2" stroke-width=".5"/><circle cx="41.2" cy="21" r="1.7" fill="#23262e" stroke="#b5cff2" stroke-width=".5"/>
<rect x="11" y="13.5" width="26" height="13" rx="5" fill="url(#bhScreen)" stroke="#272c38" stroke-width=".6"/><path d="M13.5 15.6 H19" stroke="rgba(255,255,255,.16)" stroke-width="1" stroke-linecap="round"/>
<g class="eyes"><rect class="eye" x="16.3" y="17.6" width="3.8" height="4.8" rx="1.7" fill="#d4eaff" filter="url(#bhGlow)"/><rect class="eye" x="27.9" y="17.6" width="3.8" height="4.8" rx="1.7" fill="#d4eaff" filter="url(#bhGlow)"/>
<path class="happy" d="M15.6 21.8 Q18.2 17.2 20.8 21.8 M27.2 21.8 Q29.8 17.2 32.4 21.8" stroke="#d4eaff" stroke-width="1.7" fill="none" stroke-linecap="round" filter="url(#bhGlow)"/></g></g></g></g></svg>`;

// One BH-22: rolling or still, a hop, a smile now and then, a glance about, its antenna wobbling as it starts or stops.
export function makeBH(el) {
  el.innerHTML = BH;
  const eyes = el.querySelector('.eyes'), dome = el.querySelector('.dome'), ant = el.querySelector('.ant');
  let moving = null, gladUntil = 0, nextGlad = performance.now() + 4000, lookAt = 0;
  const wob = () => { ant.classList.remove('wob'); void ant.getBoundingClientRect(); ant.classList.add('wob'); };
  return {
    move(on) { if (on === moving) return; if (moving !== null) wob(); moving = on; el.classList.toggle('moving', on); },
    hop() { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); wob(); gladUntil = performance.now() + 2600; setTimeout(() => el.classList.remove('hop'), 800); },
    tick(now) {
      if (moving && now > nextGlad) { gladUntil = now + 900; nextGlad = now + 5000 + Math.random() * 4000; }
      el.classList.toggle('glad', now < gladUntil);
      if (moving) { eyes.style.translate = '1.6px 0'; dome.style.translate = '0 0'; }
      else if (now > lookAt) { lookAt = now + 1300 + Math.random() * 1800; const d = [-1.8, 0, 0, 1.8][(Math.random() * 4) | 0]; eyes.style.translate = `${d}px 0`; dome.style.translate = `${d * 0.4}px 0`; }
    },
  };
}

// The door itself. progress(f) as the files arrive, ready(onIn) once the room is warmed up; any key or a tap on the
// press plays the story (startSound first, inside that gesture), Enter goes straight in once home is ready.
export function makeDoor({ gate, loading, film, coarse, startSound }) {
  gate.querySelector('.i-house').innerHTML = HOUSE;
  loading.innerHTML = '<div class="i-gauge"><div class="base"></div><div class="done"></div><div class="ticks">'
    + Array.from({ length: 11 }, (_, i) => `<i style="left:${i * 10}%"${i % 10 ? '' : ' class="cap"'}></i>`).join('')
    + '</div><div class="i-rider"><div class="i-bh"></div></div></div><div class="meta"><span class="say"></span><span class="pct"></span></div>';
  const paths = [...gate.querySelectorAll('.i-house path:not(.i-tick)')], ticks = [...loading.querySelectorAll('.ticks i')];
  const fill = loading.querySelector('.done'), say = loading.querySelector('.say'), pct = loading.querySelector('.pct'), bhEl = loading.querySelector('.i-bh'), rider = loading.querySelector('.i-rider');
  const bh = makeBH(bhEl), press = gate.querySelector('#film'), enter = gate.querySelector('#enter');
  press.textContent = coarse ? 'TAP TO START' : 'PRESS ANY KEY';
  let f = 0, shown = 0, isReady = false, onIn = null, inside = false, lineAt = 0, lineIdx = (Math.random() * LINES.length) | 0, hopped = false, going = false, last = performance.now(), speed = 0.1, sent = 0, lead = 0;
  let readyNow; const whenReady = new Promise(r => { readyNow = r; });

  function draw(now) {
    if (inside) return;
    // An even pace, about 8 s for the line. The files arrive in bursts and the page stalls while the house is built,
    // so the real progress only nudges the speed, slowly: never dead still, never darting. Short of ready it eases to
    // a stop near the end of the line; once home is ready it rolls on a touch quicker to the end.
    const dt = Math.max(0, Math.min(2.5, (now - last) / 1000)); last = now;
    const cap = isReady ? 1 : 0.92, want = isReady ? 0.3 : Math.min(0.2, Math.max(0.06, 0.12 + 0.3 * (f - shown)));
    speed += (want - speed) * Math.min(1, dt * 0.5);
    shown = Math.min(cap, shown + speed * dt * Math.min(1, Math.max(0.1, (cap - shown) / 0.1)));
    const p = Math.round(shown * 100);
    // The compositor carries the line and BH-22 toward where they will be in 2 s, never back, so the house's busiest
    // moments loading (up to about 2 s with no frame) never stop them.
    if (now - sent > 200 || shown >= 1) { sent = now; lead = Math.max(lead, Math.min(cap, shown + speed * 2)); fill.style.transform = `scaleX(${lead})`; rider.style.transform = `translateX(${lead * 100}%)`; }
    pct.textContent = p + '%';
    ticks.forEach((t, i) => t.classList.toggle('lit', i * 10 <= p));
    paths.forEach((el, i) => { el.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, shown * paths.length - i))); });
    const done = isReady && shown >= 0.999;
    // Skipped before home was ready: in as soon as it is, nothing more to press.
    if (done && going) { goIn(); return; }
    if (!done && now - lineAt > 1900) {
      lineAt = now; say.classList.add('out');
      setTimeout(() => { if (!isReady) { say.textContent = shown > 0.9 ? 'Almost home' : LINES[lineIdx++ % LINES.length]; say.classList.remove('out'); } }, 250);
    }
    if (done) { say.textContent = 'Home is ready'; say.classList.remove('out'); enter.setAttribute('aria-disabled', 'false'); enter.textContent = 'Skip it and go in'; }
    else enter.textContent = `You can skip it once home is ready · ${p}%`;
    bh.move(!done);
    if (done && !hopped) { hopped = true; bh.hop(); }
    bh.tick(now);
    // Over the story the loader sits in its black bar; at the story's end, once home is ready, it has said all it had to.
    loading.classList.toggle('over', film.playing);
    loading.hidden = film.playing && film.scene === 'end' && done;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  function goIn() { if (inside || !isReady) return; inside = true; loading.hidden = true; loading.classList.remove('over'); onIn?.(); }
  function play() {
    if (film.playing || inside || going) return;
    startSound();
    film.open({ door: { ready: () => isReady, whenReady } }).then(how => { if (how === 'in') { gate.classList.add('instant'); goIn(); } else if (how === 'wait') { going = true; gate.classList.add('going'); } });
  }
  // A click or a tap anywhere on the door plays it, bar the way straight in (which waits for home, never plays it).
  gate.addEventListener('click', e => { if (!e.target.closest('#enter')) play(); });
  enter.addEventListener('click', goIn);
  // Any key plays the story, bar the ones that move the focus or only change another key, and Enter on a button.
  addEventListener('keydown', e => {
    if (inside || film.playing || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(Tab|Shift|Control|Alt|Meta|CapsLock|F\d+)$/.test(e.key)) return;
    if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
    e.preventDefault(); play();
  });

  return {
    progress(v) { f = Math.max(f, Math.min(0.97, v)); },
    ready(fn) { onIn = fn; isReady = true; f = 1; readyNow(); },
    // Resolves when the house may do its heavy graphics work: no story playing, or the story at its closing card
    // (its last 4 s), skipped or ended.
    quiet() { return new Promise(done => { const look = () => (!film.playing || film.scene !== 'film' || film.left < 4 ? done() : setTimeout(look, 200)); look(); }); },
    // Straight in, no door (?auto, for the checks).
    skip() { inside = true; loading.hidden = true; },
    get inside() { return inside; },
  };
}
