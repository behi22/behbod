// What is on the glass while you shoot: the crosshair (it opens with the gun's spread), the hit mark, the rounds left,
// the score and the clock, the cards between runs, and on a phone the thumb controls.
const CSS = `
.rg { position: fixed; inset: 0; z-index: 30; pointer-events: none; font: 600 13px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #e9f3f6; user-select: none; -webkit-user-select: none; }
.rg * { box-sizing: border-box; }
.rg-cross { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transition: opacity .12s; }
.rg-cross i { position: absolute; background: #f2fbff; box-shadow: 0 0 0 1px rgba(0, 0, 0, .55); }
.rg-cross i:nth-child(1), .rg-cross i:nth-child(2) { width: 2px; height: 9px; left: -1px; }
.rg-cross i:nth-child(3), .rg-cross i:nth-child(4) { height: 2px; width: 9px; top: -1px; }
.rg-cross i:nth-child(1) { bottom: var(--gap); } .rg-cross i:nth-child(2) { top: var(--gap); }
.rg-cross i:nth-child(3) { right: var(--gap); } .rg-cross i:nth-child(4) { left: var(--gap); }
.rg-cross b { position: absolute; left: -1px; top: -1px; width: 2px; height: 2px; background: #f2fbff; box-shadow: 0 0 0 1px rgba(0, 0, 0, .55); }
.rg-hit { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; opacity: 0; transform: scale(.7) rotate(45deg); }
.rg-hit::before, .rg-hit::after { content: ''; position: absolute; background: var(--c, #fff); box-shadow: 0 0 0 1px rgba(0, 0, 0, .45); }
.rg-hit::before { left: 12px; top: 0; width: 2px; height: 26px; clip-path: polygon(0 0, 100% 0, 100% 30%, 0 30%, 0 70%, 100% 70%, 100% 100%, 0 100%); }
.rg-hit::after { top: 12px; left: 0; height: 2px; width: 26px; clip-path: polygon(0 0, 30% 0, 30% 100%, 0 100%, 70% 100%, 70% 0, 100% 0, 100% 100%, 0 100%); }
.rg-hit.on { animation: rg-hit .22s ease-out; }
@keyframes rg-hit { 0% { opacity: 1; transform: scale(1.25) rotate(45deg); } 100% { opacity: 0; transform: scale(.8) rotate(45deg); } }
.rg-top { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); text-align: center; min-width: 220px; }
.rg-score { font-size: 26px; letter-spacing: .04em; text-shadow: 0 1px 6px rgba(0, 0, 0, .7); }
.rg-streak { height: 16px; color: #ffb561; font-size: 12px; letter-spacing: .12em; text-shadow: 0 1px 4px rgba(0, 0, 0, .8); }
.rg-clock { height: 3px; width: 220px; margin: 6px auto 0; background: rgba(255, 255, 255, .16); border-radius: 2px; overflow: hidden; }
.rg-clock i { display: block; height: 100%; width: 100%; background: #5fe3d0; transform-origin: left; }
.rg-left { position: absolute; top: calc(16px + env(safe-area-inset-top, 0px)); left: calc(18px + env(safe-area-inset-left, 0px)); letter-spacing: .1em; font-size: 11px; color: #a9c2c9; text-shadow: 0 1px 4px rgba(0, 0, 0, .8); }
.rg-left b { display: block; color: #fff; font-size: 13px; }
.rg-shields { margin-top: 6px; display: flex; gap: 4px; }
.rg-shields i { width: 14px; height: 5px; background: #5fe3d0; border-radius: 1px; } .rg-shields i.off { background: rgba(255, 255, 255, .18); }
.rg-ammo { position: absolute; right: calc(22px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); text-align: right; text-shadow: 0 1px 6px rgba(0, 0, 0, .8); }
.rg-ammo b { font-size: 40px; line-height: 1; } .rg-ammo span { color: #a9c2c9; font-size: 14px; } .rg-ammo em { display: block; font-style: normal; color: #a9c2c9; font-size: 11px; letter-spacing: .14em; margin-top: 2px; }
.rg-ammo.low b { color: #ff7a5c; }
.rg-pop { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); font-size: 15px; letter-spacing: .12em; color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .8); opacity: 0; white-space: nowrap; }
.rg-pop.on { animation: rg-pop .7s ease-out; }
@keyframes rg-pop { 0% { opacity: 0; transform: translate(-50%, -30%); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -110%); } }
.rg-big { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); font-size: 64px; letter-spacing: .06em; color: #fff; text-shadow: 0 4px 22px rgba(0, 0, 0, .7); opacity: 0; }
.rg-big.on { animation: rg-big .8s ease-out; }
@keyframes rg-big { 0% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; } }
.rg-hint { position: absolute; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); color: #a9c2c9; font-weight: 400; font-size: 12px; text-shadow: 0 1px 4px rgba(0, 0, 0, .9); white-space: nowrap; }
.rg-hint b { color: #fff; font-weight: 600; }
.rg-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: auto; width: min(430px, calc(100vw - 28px)); max-height: calc(100vh - 28px); overflow: auto;
  padding: 22px 24px 20px; border-radius: 14px; background: rgba(9, 13, 18, .92); border: 1px solid rgba(120, 220, 210, .28); box-shadow: 0 20px 60px rgba(0, 0, 0, .55); }
.rg-card h2 { margin: 0 0 4px; font-size: 12px; letter-spacing: .18em; color: #5fe3d0; }
.rg-card h3 { margin: 0 0 10px; font-size: 22px; color: #fff; letter-spacing: .02em; }
.rg-card p { margin: 6px 0; color: #a9c2c9; font-weight: 400; }
.rg-card .rg-num { font-size: 44px; color: #fff; line-height: 1.1; margin: 4px 0 2px; }
.rg-stars { font-size: 26px; letter-spacing: 6px; color: #2b3640; margin: 2px 0 8px; } .rg-stars b { color: #ffc24a; text-shadow: 0 0 14px rgba(255, 190, 70, .5); }
.rg-rows { display: grid; grid-template-columns: 1fr auto; gap: 3px 14px; margin: 10px 0 6px; color: #a9c2c9; font-weight: 400; } .rg-rows b { color: #fff; text-align: right; }
.rg-list { display: grid; gap: 6px; margin: 12px 0 10px; }
.rg-list button { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; text-align: left; padding: 10px 12px; }
.rg-list button small { grid-column: 1 / -1; color: #8fa7ae; font-weight: 400; }
.rg-list button span { color: #2b3640; letter-spacing: 3px; } .rg-list button span b { color: #ffc24a; }
.rg-list button[disabled] { opacity: .42; cursor: default; }
.rg-seg { display: flex; gap: 6px; margin: 8px 0 2px; } .rg-seg button { flex: 1; padding: 7px 4px; }
.rg button { font: inherit; color: #e9f3f6; background: rgba(120, 220, 210, .08); border: 1px solid rgba(120, 220, 210, .3); border-radius: 9px; padding: 9px 14px; cursor: pointer; }
.rg button:hover:not([disabled]) { background: rgba(120, 220, 210, .16); }
.rg button.on, .rg button.go { background: #5fe3d0; color: #06110f; border-color: #5fe3d0; }
.rg-acts { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; } .rg-acts button { flex: 1; white-space: nowrap; }
.rg-pad { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; border: 1px solid rgba(255, 255, 255, .28); background: rgba(10, 14, 18, .34); color: #fff; display: grid; place-items: center; font-size: 11px; letter-spacing: .08em; }
.rg-fire { right: calc(26px + env(safe-area-inset-right, 0px)); bottom: calc(92px + env(safe-area-inset-bottom, 0px)); width: 84px; height: 84px; background: rgba(255, 120, 80, .3); }
.rg-aim { right: calc(122px + env(safe-area-inset-right, 0px)); bottom: calc(60px + env(safe-area-inset-bottom, 0px)); width: 60px; height: 60px; }
.rg-load { right: calc(40px + env(safe-area-inset-right, 0px)); bottom: calc(188px + env(safe-area-inset-bottom, 0px)); width: 54px; height: 54px; }
.rg-step { left: calc(26px + env(safe-area-inset-left, 0px)); bottom: calc(70px + env(safe-area-inset-bottom, 0px)); width: 112px; height: 60px; border-radius: 30px; }
.rg-quit { position: absolute; pointer-events: auto; top: calc(58px + env(safe-area-inset-top, 0px)); left: calc(16px + env(safe-area-inset-left, 0px)); }
.rg.rg-touch .rg-hint { display: none; } .rg.rg-touch .rg-ammo { bottom: auto; top: calc(58px + env(safe-area-inset-top, 0px)); }
@media (max-width: 560px) { .rg.rg-touch .rg-ammo, .rg-quit { top: calc(124px + env(safe-area-inset-top, 0px)); } .rg-clock { width: 150px; } .rg-top { min-width: 150px; } }
.rg-dim { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 40%, rgba(120, 10, 0, .5) 100%); opacity: 0; transition: opacity .5s; }
`;

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const stars = n => { const s = el('div', 'rg-stars'); for (let i = 0; i < 3; i++) s.append(i < n ? el('b', '', '★') : document.createTextNode('★')); return s; };

export function makeHud({ coarse, onPad }) {
  if (!document.getElementById('rg-css')) { const s = el('style'); s.id = 'rg-css'; s.textContent = CSS; document.head.append(s); }
  let root = null, cross, hit, score, streak, clock, left, shields, ammo, pop, big, hint, dim, card = null, last = {};
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  function build() {
    root = el('div', 'rg' + (coarse ? ' rg-touch' : ''));
    cross = el('div', 'rg-cross'); cross.append(el('i'), el('i'), el('i'), el('i'), el('b'));
    hit = el('div', 'rg-hit');
    const top = el('div', 'rg-top'); score = el('div', 'rg-score', '0'); streak = el('div', 'rg-streak'); clock = el('div', 'rg-clock'); clock.append(el('i'));
    top.append(score, streak, clock);
    left = el('div', 'rg-left'); shields = el('div', 'rg-shields');
    ammo = el('div', 'rg-ammo');
    pop = el('div', 'rg-pop'); big = el('div', 'rg-big'); dim = el('div', 'rg-dim');
    hint = el('div', 'rg-hint');
    root.append(dim, cross, hit, top, left, ammo, pop, big, hint);
    if (coarse) {
      // Thumb controls: step along the line on the left; fire, aim and reload on the right. Dragging anywhere else looks.
      for (const [cls, label, name] of [['rg-fire', 'FIRE', 'fire'], ['rg-aim', 'AIM', 'aim'], ['rg-load', 'LOAD', 'reload'], ['rg-step', '◀  ▶', 'step']]) {
        const b = el('div', 'rg-pad ' + cls, label);
        const send = (e, down) => { e.preventDefault(); const r = b.getBoundingClientRect(); onPad?.(name, down, (e.clientX - r.left) / r.width * 2 - 1); };
        b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); send(e, true); });
        b.addEventListener('pointermove', e => { if (b.hasPointerCapture(e.pointerId)) send(e, true); });
        b.addEventListener('pointerup', e => send(e, false)); b.addEventListener('pointercancel', e => send(e, false));
        root.append(b);
      }
      const quit = el('button', 'rg-quit', 'Leave'); quit.addEventListener('click', () => onPad?.('quit', true, 0)); root.append(quit);
    }
    document.body.append(root);
    last = {};
  }

  const api = {
    get open() { return !!root; },
    get carded() { return !!card; },
    show() { if (!root) build(); },
    hide() { root?.remove(); root = null; card = null; },
    // The numbers that change every frame; only what changed touches the page.
    set(v) {
      if (!root) return;
      const put = (key, node, text) => { if (last[key] !== text) { last[key] = text; node.textContent = text; } };
      if (v.spread !== undefined) { const gap = Math.round(5 + v.spread * 9) + 'px'; if (last.gap !== gap) { last.gap = gap; cross.style.setProperty('--gap', gap); } }
      const hideCross = v.aim > 0.6 || !v.playing; if (last.hc !== hideCross) { last.hc = hideCross; cross.style.opacity = hideCross ? 0 : 1; }
      put('score', score, String(v.score ?? 0));
      put('streak', streak, v.streak >= 2 ? `STREAK x${v.streak}` : '');
      const k = Math.max(0, Math.min(1, v.left ?? 1)).toFixed(3); if (last.k !== k) { last.k = k; clock.firstChild.style.transform = `scaleX(${k})`; clock.firstChild.style.background = k < 0.2 ? '#ff7a5c' : '#5fe3d0'; }
      const a = `${v.ammo}|${v.mag}|${v.gun}|${v.state}`;
      if (last.a !== a) { last.a = a; ammo.replaceChildren(el('b', '', v.state === 'reload' ? '--' : String(v.ammo)), el('span', '', ' / ' + v.mag), el('em', '', v.state === 'reload' ? 'RELOADING' : v.gun)); ammo.classList.toggle('low', v.state !== 'reload' && v.ammo <= Math.max(2, v.mag * 0.2)); }
      const s = `${v.shields}|${v.maxShields}`;
      if (last.s !== s) { last.s = s; shields.replaceChildren(...Array.from({ length: v.maxShields || 0 }, (_, i) => el('i', i < v.shields ? '' : 'off'))); }
      const vis = v.playing ? '' : 'none'; if (last.vis !== vis) { last.vis = vis; for (const n of [score.parentNode, ammo, left]) n.style.display = vis; }
    },
    stage(name, difficulty) { if (!root) return; left.replaceChildren(el('b', '', name.toUpperCase()), document.createTextNode(difficulty.toUpperCase()), shields); },
    hint(parts) { if (!root) return; hint.replaceChildren(...parts.flatMap(([k, t], i) => [...(i ? [document.createTextNode('   ')] : []), el('b', '', k), document.createTextNode(' ' + t)])); },
    hitMark(kill, weak) { if (!root) return; hit.style.setProperty('--c', kill ? '#ff5a3c' : weak ? '#ffc24a' : '#fff'); restart(hit, 'on'); },
    pop(text) { if (!root) return; pop.textContent = text; restart(pop, 'on'); },
    big(text) { if (!root) return; big.textContent = text; restart(big, 'on'); },
    hurt(k) { if (root) dim.style.opacity = k; },
    closeCard() { card?.remove(); card = null; },
    // A card in the middle of the glass: a list of nodes, then buttons [label, handler, primary].
    card(nodes, buttons) {
      if (!root) return null;
      api.closeCard();
      card = el('div', 'rg-card');
      card.append(...nodes);
      if (buttons?.length) { const acts = el('div', 'rg-acts'); for (const [label, fn, go] of buttons) { const b = el('button', go ? 'go' : '', label); b.addEventListener('click', fn); acts.append(b); } card.append(acts); }
      root.append(card);
      return card;
    },
    el, stars,
  };
  return api;
}
