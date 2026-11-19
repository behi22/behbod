import { BANDS } from './pure/leds.js';

// Along each strip, bass mid-run and treble at the ends of every 1.2 m; with uViz at 0 the strips draw exactly as before.
export function stripViz(materials) {
  const U = { uViz: { value: 0 }, uBands: { value: new Float32Array(BANDS) } };
  const last = (BANDS - 1).toFixed(1);
  for (const m of materials) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uViz = U.uViz;
      sh.uniforms.uBands = U.uBands;
      sh.vertexShader = 'varying vec3 vVizW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vVizW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `uniform float uViz;\nuniform float uBands[${BANDS}];\nvarying vec3 vVizW;\n` + sh.fragmentShader.replace('#include <colorspace_fragment>', `if (uViz > 0.0) {
    float s = abs(fract((vVizW.x - vVizW.z) / 1.2) * 2.0 - 1.0) * ${last};
    int i = int(s);
    float e = mix(uBands[i], uBands[min(i + 1, ${BANDS - 1})], fract(s));
    gl_FragColor.rgb *= mix(1.0, 0.08 + 1.8 * e * e, uViz);
  }
  #include <colorspace_fragment>`);
    };
    m.customProgramCacheKey = () => 'stripviz';
    m.needsUpdate = true;
  }
  return U;
}
