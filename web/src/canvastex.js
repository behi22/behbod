import * as THREE from 'three';

// Chrome copies a canvas into an sRGB texture the slow way (13 ms of the graphics card for the TV's picture), so the
// canvas goes up as plain bytes and is drawn into an sRGB picture, which ends up holding the same bytes.
let renderer = null, blit = null;
const waiting = new Set(), all = new Set();

export function usePictures(r) {
  renderer = r;
  // A lost graphics context takes the pictures with it; a canvas texture would be sent again, so these are too.
  r.domElement.addEventListener('webglcontextrestored', () => { for (const pic of all) send(pic); });
  for (const pic of waiting) send(pic);
  waiting.clear();
}

// Used as a canvas texture is: needsUpdate after each painting.
export function livePicture(canvas) {
  const plain = new THREE.Texture(canvas);
  Object.assign(plain, { colorSpace: THREE.NoColorSpace, generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, flipY: false });
  const target = new THREE.WebGLRenderTarget(canvas.width, canvas.height, { colorSpace: THREE.SRGBColorSpace, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const t = target.texture, pic = { plain, target, t, sent: false };
  all.add(pic);
  t.image = canvas;
  t.flipY = true;
  Object.defineProperty(t, 'needsUpdate', { set(on) { if (!on) return; if (renderer) send(pic); else waiting.add(pic); } });
  // Sent once even if never painted, as a canvas texture is, but after its maker sets it up: anisotropy is read once.
  queueMicrotask(() => { if (!pic.sent) t.needsUpdate = true; });
  return t;
}

// A big picture (flipY off) goes to the graphics card a band of rows at a time with `rest` between bands, so no frame
// waits for the whole of it: the range's 4096 px lightmap held the page about 100 ms in one go.
export async function sendInBands(renderer, t, rest, rows = 512) {
  const image = t.image, mips = t.generateMipmaps;
  // Room made for it, nothing copied yet.
  t.source.dataReady = false;
  t.needsUpdate = true;
  renderer.initTexture(t);
  t.source.dataReady = true;
  const from = new THREE.Texture(image), band = new THREE.Box2(), at = new THREE.Vector2();
  try {
    for (let y = 0; y < image.height; y += rows) {
      await rest();
      t.generateMipmaps = mips && y + rows >= image.height;
      band.min.set(0, y); band.max.set(image.width, Math.min(image.height, y + rows)); at.set(0, y);
      renderer.copyTextureToTexture(from, t, band, at);
    }
  } finally { t.generateMipmaps = mips; }
}

function send(pic) {
  const { plain, target, t } = pic;
  pic.sent = true;
  blit ||= makeBlit();
  const was = renderer.getRenderTarget(), clear = renderer.autoClear;
  plain.needsUpdate = true;
  blit.material.uniforms.src.value = plain;
  blit.material.uniforms.flip.value = t.flipY;
  renderer.autoClear = false;
  renderer.setRenderTarget(target);
  renderer.render(blit.scene, blit.camera);
  renderer.setRenderTarget(was);
  renderer.autoClear = clear;
  // The plain copy is only passing through, so it gives its memory back.
  plain.dispose();
}

function makeBlit() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, uniforms: { src: { value: null }, flip: { value: false } },
    vertexShader: 'in vec3 position; void main() { gl_Position = vec4(position, 1.0); }',
    // Decoded here because the sRGB picture encodes what is written to it.
    fragmentShader: `precision highp float; uniform sampler2D src; uniform bool flip; out vec4 colour;
      void main() {
        ivec2 at = ivec2(gl_FragCoord.xy);
        if (flip) at.y = textureSize(src, 0).y - 1 - at.y;
        vec4 c = texelFetch(src, at, 0);
        colour = vec4(mix(c.rgb / 12.92, pow((c.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, c.rgb)), c.a);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, camera: new THREE.OrthographicCamera(), material };
}
