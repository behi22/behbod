import { inSlices } from './pure/slices.js';
import { STALE } from './pure/rebuild.js';

// A shader program's first use reads its compile logs back from the graphics card, and that waits for everything the
// card has queued: most of a frame on a busy screen, held inside whichever frame first draws with it. Programs built
// ahead of time are first used here instead, a slice of time at a time when `rest` is given. While loading (`logs`)
// they are read as three always reads them, since a wait is not seen there; otherwise a program that linked is first
// used with the read left out, and one that failed to link is left for its real first use, logs and all. A lost
// graphics context has no logs to read (three would throw), and three builds every program again once it is back.
// Asking whether a program linked waits until the card has built it, and three waits only for the program each
// material was last asked for (a material drawn meanwhile, like my hoodie, moves that on to another): in the background
// each program is waited for between frames until it is built, then used.
export async function useAhead(renderer, materials, { logs = false, rest = null, stale = () => false } = {}) {
  const programs = new Set();
  for (const m of materials) for (const p of renderer.properties.get(m)?.programs?.values() || []) programs.add(p);
  const gl = renderer.getContext(), checks = renderer.debug.checkShaderErrors;
  const built = renderer.extensions?.has('KHR_parallel_shader_compile') ? renderer.extensions.get('KHR_parallel_shader_compile').COMPLETION_STATUS_KHR : null;
  const use = p => {
    if (stale()) throw STALE;
    if (gl.isContextLost()) return;
    if (logs) { p.getUniforms(); return; }
    if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) return;
    renderer.debug.checkShaderErrors = false;
    try { p.getUniforms(); } finally { renderer.debug.checkShaderErrors = checks; }
  };
  const whenBuilt = async p => {
    while (built && !gl.isContextLost() && !gl.getProgramParameter(p.program, built)) { await rest(); if (stale()) throw STALE; }
    use(p);
  };
  if (rest) await inSlices([...programs], whenBuilt, { rest });
  else for (const p of programs) use(p);
}
