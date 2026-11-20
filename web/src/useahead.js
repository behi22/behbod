import { inSlices } from './pure/slices.js';
import { STALE } from './pure/rebuild.js';

// A shader program's first use reads its compile logs back from the graphics card, and that waits for everything the
// card has queued: most of a frame on a busy screen, held inside whichever frame first draws with it. Programs built
// ahead of time are first used here instead, a slice of time at a time when `rest` is given. While loading (`logs`)
// they are read as three always reads them, since a wait is not seen there; otherwise a program that linked is first
// used with the read left out, and one that failed to link is left for its real first use, logs and all.
export async function useAhead(renderer, materials, { logs = false, rest = null, stale = () => false } = {}) {
  const programs = new Set();
  for (const m of materials) for (const p of renderer.properties.get(m)?.programs?.values() || []) programs.add(p);
  const gl = renderer.getContext(), checks = renderer.debug.checkShaderErrors;
  const use = p => {
    if (stale()) throw STALE;
    if (logs) { p.getUniforms(); return; }
    if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) return;
    renderer.debug.checkShaderErrors = false;
    try { p.getUniforms(); } finally { renderer.debug.checkShaderErrors = checks; }
  };
  if (rest) await inSlices([...programs], use, { rest });
  else for (const p of programs) use(p);
}
