// Looking down a scope: the gun gives way to the scope's own round picture (the world, magnified by the range's own
// zoom) with black around it and the reticle on top. Drawn on the page, so it costs the graphics card nothing.
const CSS = `
.rg-scope { position: fixed; inset: 0; z-index: 29; pointer-events: none; opacity: 0; --r: min(46vmin, 46vw);
  background: radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0) calc(var(--r) - 18px), rgba(0, 0, 0, .55) calc(var(--r) - 4px), #000 var(--r)); }
.rg-scope svg { position: absolute; left: 50%; top: 50%; width: calc(var(--r) * 2); height: calc(var(--r) * 2); transform: translate(-50%, -50%); overflow: visible; }
.rg-scope .rim { fill: none; stroke: #000; stroke-width: 7; } .rg-scope .glint { fill: none; stroke: rgba(150, 220, 255, .14); stroke-width: 1.2; }
.rg-scope .hair { stroke: #05080a; stroke-width: .55; } .rg-scope .post { stroke: #05080a; stroke-width: 3.4; } .rg-scope .mil { fill: #05080a; }
.rg-scope .dot { fill: #ff3b2f; filter: drop-shadow(0 0 1.4px rgba(255, 60, 40, .9)); }`;

const NS = 'http://www.w3.org/2000/svg';
// The reticle on a 200-unit circle: posts from the rim, fine hairs through the middle; the long scope adds mil dots
// and a lit centre, the shorter one a small open centre.
function reticle(long) {
  const parts = [`<circle class="rim" r="100"/>`, `<circle class="glint" r="96" stroke-dasharray="40 260" transform="rotate(-140)"/>`];
  for (const [x1, y1, x2, y2] of [[-100, 0, -34, 0], [100, 0, 34, 0], [0, 100, 0, 34], [0, -100, 0, -60]]) parts.push(`<line class="post" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  parts.push(`<line class="hair" x1="-34" y1="0" x2="34" y2="0"/>`, `<line class="hair" x1="0" y1="-60" x2="0" y2="34"/>`);
  if (long) {
    for (let i = -4; i <= 4; i++) if (i) parts.push(`<circle class="mil" cx="${i * 7}" cy="0" r=".9"/>`, `<circle class="mil" cx="0" cy="${i * 7}" r=".9"/>`);
    parts.push(`<circle class="dot" r="1.1"/>`);
  } else parts.push(`<circle class="hair" r="3.2" fill="none"/>`);
  return parts.join('');
}

export function makeScopeView() {
  let el = null, svg = null, kind = null, shown = -1;
  const api = {
    // k: 0 not looking through, 1 fully; long: the Longview's long scope.
    set(k, long = false) {
      if (k <= 0.001 && !el) return;
      if (!el) {
        if (!document.getElementById('rg-scope-css')) { const s = document.createElement('style'); s.id = 'rg-scope-css'; s.textContent = CSS; document.head.append(s); }
        el = document.createElement('div'); el.className = 'rg-scope';
        svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-100 -100 200 200');
        el.append(svg); document.body.append(el);
      }
      if (kind !== long) { kind = long; svg.innerHTML = reticle(long); }
      const o = (Math.round(Math.min(1, Math.max(0, k)) * 40) / 40).toFixed(3);
      if (o !== shown) { shown = o; el.style.opacity = o; }
    },
    get on() { return !!el && +shown > 0.5; },
    hide() { el?.remove(); el = null; svg = null; kind = null; shown = -1; },
  };
  return api;
}
