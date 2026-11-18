// Each gun's parts, action (slide, bolt, turn, open) and place in the eye, so gun.js never assumes the pistol (x muzzle, y up, z right).
export const RIGS = {
  pistol: {
    prefix: 'P22', file: 'assets/range/p22.glb', action: 'slide', cycle: 'slide',
    parts: { slide: 'slide', barrel: 'barrel', trigger: 'trigger', stop: 'slidestop', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    // How far the slide goes back, where it stops when empty (of its travel), its trip back and home after a shot (s).
    travel: 0.042, lock: 0.9, cycleT: [0.028, 0.05],
    well: [-0.333, -0.943, 0], drop: 0.115, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.085, -0.072, -0.33], r: [0.02, 0.07, -0.04] }, sight: 0.30, homeCue: 'slideHome',
    rides: { left: { mag: 'mag', over: 'slide', pinch: 'slide' }, right: {} },
    // Its holo sight, scope and long magazine are its own pieces; its light and suppressor come from the kit file on
    // these mounts (its own came out of the build broken). And where a charm hangs. All in the gun's space.
    kit: { own: ['holo', 'scope', 'mag'], light: 'KIT_light_pistol', mounts: { muzzle: [0.1605, 0.0155, 0], rail: [0.105, -0.012, 0] }, hook: [0.082, -0.006, -0.0145], charm: 0.8 },
  },
  smg: {
    prefix: 'VSP', file: 'assets/range/vesper.glb', action: 'bolt', cycle: 'bolt',
    parts: { bolt: 'bolt', handle: 'handle', trigger: 'trigger', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    travel: 0.05, lock: 0.9, cycleT: [0.02, 0.032], handleTravel: 0.06,
    well: [0, -1, 0], drop: 0.11, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.12, -0.12, -0.36], r: [0.03, 0.06, -0.03] }, sight: 0.17, homeCue: 'slideHome',
    elbows: { right: [0.17, -0.5, -0.06], left: [-0.08, -0.45, -0.36] },
    rides: { left: { mag: 'mag', charge: 'handle' }, right: {} },
    kit: { rear: 'rear', hook: [0.15, 0.004, -0.0205], charm: 1.25 },
  },
  rifle: {
    prefix: 'KPR', file: 'assets/range/keeper.glb', action: 'bolt', cycle: 'bolt',
    parts: { bolt: 'bolt', handle: 'handle', trigger: 'trigger', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    travel: 0.065, lock: 0.9, cycleT: [0.024, 0.04], handleTravel: 0.07,
    well: [0.119, -0.993, 0], drop: 0.11, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.12, -0.125, -0.38], r: [0.03, 0.06, -0.03] }, sight: 0.16, homeCue: 'slideHome',
    elbows: { right: [0.17, -0.5, -0.06], left: [-0.08, -0.42, -0.45] },
    rides: { left: { mag: 'mag', charge: 'handle' }, right: {} },
    kit: { rear: 'rear', hook: [0.18, 0.004, -0.0195], charm: 1.3 },
  },
  sniper: {
    prefix: 'LNG', file: 'assets/range/longview.glb', action: 'turn', cycle: null,
    parts: { bolt: 'bolt', trigger: 'trigger', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    // The bolt's handle lifts this far (radians) before the bolt draws back `travel`.
    travel: 0.1, lift: 1.2,
    well: [0, -1, 0], drop: 0.09, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.12, -0.13, -0.4], r: [0.03, 0.06, -0.03] }, sight: 0.22, homeCue: 'boltClose',
    elbows: { right: [0.17, -0.5, -0.06], left: [-0.06, -0.42, -0.52] },
    rides: { left: { mag: 'mag' }, right: { bolt: 'bolt' } },
    kit: { rear: 'rear', scope: 'KIT_scope_long', hook: [0.185, 0.0, -0.021], charm: 1.35 },
  },
  lmg: {
    prefix: 'GTK', file: 'assets/range/gatekeeper.glb', action: 'open', cycle: null,
    parts: { handle: 'handle', cover: 'cover', belt: 'belt', trigger: 'trigger', mag: 'mag', round: 'round', casing: 'casing' },
    // The feed cover opens this far (radians); the belt draws up one link (metres) a shot.
    handleTravel: 0.09, coverOpen: 1.05, beltPitch: 0.012,
    well: [0, -0.92, -0.39], drop: 0.06, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.12, -0.14, -0.42], r: [0.03, 0.06, -0.03] }, sight: 0.19, homeCue: 'slideHome',
    elbows: { right: [0.17, -0.5, -0.06], left: [-0.06, -0.45, -0.42] },
    rides: { left: { mag: 'mag', charge: 'handle', cover: 'cover' }, right: {} },
    // Its optic stands on a riser, clear of the rear sight on the cover, and lifts with the cover.
    kit: { riser: 0.016, optic: 'cover', hook: [0.228, 0.0, -0.0235], charm: 1.4 },
  },
};

// What the file must hold for this gun: its parts and anchors by full name.
export function partNames(id) {
  const r = RIGS[id];
  return r ? Object.values(r.parts).map(n => `${r.prefix}_${n}`) : [];
}
