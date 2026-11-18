// How each gun's file is put together for the view and the hands: its parts by what they do, how its action moves,
// where it sits in the eye's space. Gun space: x to the muzzle, y up, z right (three's axes; blender's X, Z, -Y).
//   action: 'slide' a pistol's slide, 'bolt' a closed bolt that cycles on each shot and locks open when empty (its
//   charging handle only moves when a hand pulls it), 'turn' a bolt worked by hand (lift, back, forward, down),
//   'open' an open bolt (only its charging handle is seen).
// rides: hand poses that move with a part (a hand on the magazine, on the charging handle, on the bolt's knob).
// mounts: where item 10's attachments go, as empties in the file: muzzle (the thread's end), optic (the top rail's
// middle, the base of a sight), rail (the light's clamp), mag (the magazine well; the extended magazine is a magazine).
export const RIGS = {
  pistol: {
    prefix: 'P22', file: 'assets/range/p22.glb', action: 'slide', cycle: 'slide',
    parts: { slide: 'slide', barrel: 'barrel', trigger: 'trigger', stop: 'slidestop', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    // How far the slide goes back, where it stops when empty (of its travel), its trip back and home after a shot (s).
    travel: 0.042, lock: 0.9, cycleT: [0.028, 0.05],
    well: [-0.333, -0.943, 0], drop: 0.115, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.085, -0.072, -0.33], r: [0.02, 0.07, -0.04] }, sight: 0.30, homeCue: 'slideHome',
    rides: { left: { mag: 'mag', over: 'slide', pinch: 'slide' }, right: {} },
  },
  smg: {
    prefix: 'VSP', file: 'assets/range/vesper.glb', action: 'bolt', cycle: 'bolt',
    parts: { bolt: 'bolt', handle: 'handle', trigger: 'trigger', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    travel: 0.05, lock: 0.9, cycleT: [0.02, 0.032], handleTravel: 0.06,
    well: [0, -1, 0], drop: 0.11, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.12, -0.12, -0.36], r: [0.03, 0.06, -0.03] }, sight: 0.17, homeCue: 'slideHome',
    elbows: { right: [0.17, -0.5, -0.06], left: [-0.08, -0.45, -0.36] },
    rides: { left: { mag: 'mag', charge: 'handle' }, right: {} },
  },
  rifle: {
    prefix: 'KPR', file: 'assets/range/keeper.glb', action: 'bolt', cycle: 'bolt',
    parts: { bolt: 'bolt', handle: 'handle', trigger: 'trigger', rel: 'magrelease', mag: 'mag', round: 'round', casing: 'casing' },
    travel: 0.065, lock: 0.9, cycleT: [0.024, 0.04], handleTravel: 0.07,
    well: [0.119, -0.993, 0], drop: 0.11, pivot: [-0.004, -0.062, 0],
    hip: { p: [0.12, -0.125, -0.38], r: [0.03, 0.06, -0.03] }, sight: 0.16, homeCue: 'slideHome',
    elbows: { right: [0.17, -0.5, -0.06], left: [-0.08, -0.42, -0.45] },
    rides: { left: { mag: 'mag', charge: 'handle' }, right: {} },
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
  },
};

// What the file must hold for this gun: its parts and anchors by full name.
export function partNames(id) {
  const r = RIGS[id];
  return r ? Object.values(r.parts).map(n => `${r.prefix}_${n}`) : [];
}
