// Test browsers stay silent. The house plays music, the piano and the room's sound, and Firefox and WebKit under
// Playwright play it out loud on the machine running the tests. Chrome is muted by a switch, Firefox by its volume
// setting, and every page (WebKit's too) gets a script that sends all sound into a silent node and mutes media.
function silence() {
  if (window.__quiet) return;
  window.__quiet = true;
  if (typeof AudioNode !== 'undefined') {
    const connect = AudioNode.prototype.connect, hush = new WeakMap();
    AudioNode.prototype.connect = function (to, ...rest) {
      if (typeof AudioDestinationNode !== 'undefined' && to instanceof AudioDestinationNode) {
        let g = hush.get(to);
        if (!g) { g = to.context.createGain(); g.gain.value = 0; connect.call(g, to); hush.set(to, g); }
        connect.call(this, g, ...rest);
        return to;
      }
      return connect.call(this, to, ...rest);
    };
  }
  if (typeof HTMLMediaElement !== 'undefined') {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; return play.call(this); };
  }
}

// Launches a browser of this type with its sound off; pages and contexts opened from it run the silencing script.
async function launch(type, opts = {}) {
  const name = type.name();
  const quiet = name === 'chromium' ? { args: [...(opts.args || []), '--mute-audio'] }
    : name === 'firefox' ? { firefoxUserPrefs: { ...(opts.firefoxUserPrefs || {}), 'media.volume_scale': '0.0' } } : {};
  const b = await type.launch({ ...opts, ...quiet });
  const newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
  b.newContext = async (...a) => { const c = await newContext(...a); await c.addInitScript(silence); return c; };
  b.newPage = async (...a) => { const p = await newPage(...a); await p.addInitScript(silence); return p; };
  return b;
}

module.exports = { launch, silence };
