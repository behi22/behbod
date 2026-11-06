import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { b2t } from './engine.js';

// The big frame on the screening wall plays its video live (muted, looping) while you are near it and in front of it.
// YouTube cannot be drawn inside the 3D picture, so the real player sits in a page layer under the canvas and the
// frame's screen becomes a see-through hole while it plays; anything in front of the frame (me, Jessi, a chair) still
// draws over it. The player is made once, while the page loads (making one later stalls a frame for about 100 ms), and
// is only told to play and pause after that; further away, or round the side, the frame shows the thumbnail.
const PX = 1280;
const ORIGIN = 'https://www.youtube-nocookie.com';

export function makeLiveVideo({ scene, camera, meta, videos, canvas }) {
  const s = meta.screens?.video0, mesh = scene.getObjectByName('screen_video0'), v = videos()[0];
  if (!s || !mesh || !v) return { tick() {}, pause() {}, resume() {}, get live() { return false; } };
  const thumb = mesh.material;
  // Writes (0, 0, 0, 0): no colour and no cover, so the page layer underneath shows. No fog, or the haze would tint it.
  const hole = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, fog: false });
  const css = new CSS3DRenderer();
  Object.assign(css.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
  css.domElement.setAttribute('aria-hidden', 'true');
  canvas.before(css.domElement);
  const cssScene = new THREE.Scene();
  const box = document.createElement('div');
  Object.assign(box.style, { width: PX + 'px', height: Math.round(PX * s.h / s.w) + 'px', background: '#000' });
  const obj = new CSS3DObject(box);
  const centre = b2t(...s.center);
  obj.position.copy(centre);
  // The frame faces west into the room (Blender -X), which is three's -x.
  obj.rotation.y = -Math.PI / 2;
  obj.scale.setScalar(s.w / PX);
  cssScene.add(obj);
  const resize = () => css.setSize(innerWidth, innerHeight);
  addEventListener('resize', resize);
  resize();

  const frame = document.createElement('iframe');
  frame.src = `${ORIGIN}/embed/${v.id}?enablejsapi=1&mute=1&loop=1&playlist=${v.id}&controls=0&disablekb=1&playsinline=1&rel=0&iv_load_policy=3&origin=${encodeURIComponent(location.origin)}`;
  // YouTube's player checks it may go fullscreen; without this WebKit throws an error from inside the player.
  frame.allow = 'autoplay; encrypted-media; fullscreen';
  frame.title = v.title || 'Video';
  frame.tabIndex = -1;
  Object.assign(frame.style, { width: '100%', height: '100%', border: '0', pointerEvents: 'none' });
  box.append(frame);
  let loaded = false, playing = false, paused = false, holeAt = 0;
  frame.addEventListener('load', () => { loaded = true; });
  // The page layer only adds the player to the page on its first draw, so draw once now and let it load.
  css.render(cssScene, camera);
  // YouTube's player takes commands as messages once it has loaded.
  const command = func => frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), ORIGIN);
  function play() { playing = true; command('playVideo'); holeAt = performance.now() + 900; }
  function stop() { playing = false; command('pauseVideo'); mesh.material = thumb; }

  const facing = new THREE.Vector3(-1, 0, 0), toCam = new THREE.Vector3();
  return {
    get live() { return playing; },
    tick() {
      if (paused || !loaded) return;
      const d = camera.position.distanceTo(centre);
      const inFront = toCam.subVectors(camera.position, centre).normalize().dot(facing) > 0.15;
      // A little give between starting and stopping, so it never flickers on and off at the edge.
      const want = inFront && d < (playing ? 9.5 : 7.5);
      if (want && !playing) play(); else if (!want && playing) stop();
      // The hole opens a moment after play, once the picture is moving, so the frame never shows the player's own UI.
      if (playing && mesh.material !== hole && performance.now() > holeAt) mesh.material = hole;
      if (playing) css.render(cssScene, camera);
    },
    // The full player (E) takes over: the live one pauses so two never run at once.
    pause() { paused = true; if (playing) stop(); },
    resume() { paused = false; },
  };
}
