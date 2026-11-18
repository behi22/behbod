import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { lit } from './lit.js';
import { prepare } from './room.js';
import { paintCamo } from './camos.js';
import { makeCharm } from './charms.js';
import { RIGS } from '../pure/rigs.js';
import { readKits } from '../pure/smith.js';

// New materials are made ready in a scene lit like the gun's own, so nothing new stalls a frame when it first shows.
const KEY = 'loft.range.kit';

export function makeFitter({ renderer, env, stars = () => 0, has = null }) {
  let kitFile = null, charmsReady = null;
  const tokens = new WeakMap();
  // A scene with the gun scene's kinds of light, for building programs ahead.
  function stage(objects) {
    const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.01, 10);
    s.environment = env;
    s.add(new THREE.HemisphereLight(0xffffff, 0x000000, 1));
    for (let i = 0; i < 2; i++) { const d = new THREE.DirectionalLight(0xffffff, 1); s.add(d, d.target); }
    s.add(new THREE.PointLight(0xffffff, 0, 1), cam);
    const holder = new THREE.Group();
    holder.position.z = -0.5;
    for (const o of objects) holder.add(o);
    s.add(holder);
    return { s, cam, done: () => { for (const o of objects) holder.remove(o); } };
  }
  function loadKit() {
    kitFile ||= (async () => {
      const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/range/kit.glb');
      g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (!o.material.transparent) lit(o.material); } });
      const st = stage([g.scene]);
      await prepare(renderer, st.s, st.cam);
      st.done();
      return g.scene;
    })();
    kitFile.catch(e => { kitFile = null; console.warn('[range] the attachment kit was not fetched', e); });
    return kitFile;
  }
  function readyCharms() {
    charmsReady ||= (async () => { const c = makeCharm('rivet'), st = stage([c.root]); await prepare(renderer, st.s, st.cam); st.done(); })();
    return charmsReady;
  }
  // Every attachment comes from the kit file but those a gun carries itself (the P-22's optics and long magazine).
  const needsKit = (id, kit) => kit.att.some(a => !(RIGS[id]?.kit?.own || []).includes(a));
  const store = {
    read() { let t = null; try { t = localStorage.getItem(KEY); } catch (e) { /* storage blocked: every gun starts bare */ } return readKits(t, stars(), has); },
    write(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* forgotten after this visit */ } },
  };
  return {
    store, loadKit, readyCharms,
    get kitLoaded() { return !!kitFile; },
    // A later call for the same gun wins over one still waiting for the kit file.
    async dress(gun, kit) {
      const mine = (tokens.get(gun) || 0) + 1;
      tokens.set(gun, mine);
      let file = null;
      try {
        if (needsKit(gun.id, kit)) file = await loadKit();
        if (kit.charm !== 'none') await readyCharms();
      } catch (e) { return false; }
      if (tokens.get(gun) !== mine) return false;
      gun.setAttachments(kit.att, file);
      gun.setCamo(paintCamo(kit.camo));
      if (gun.charm !== kit.charm) gun.setCharm(makeCharm(kit.charm, RIGS[gun.id]?.kit?.charm || 1));
      return true;
    },
  };
}
