// Squeezes a gun built by blender/build_guns.py for the page: the same pieces, much smaller on the wire. Every mesh
// moves onto a node of its own under its named part, so the part's own place stays its pivot (the trigger, the slide
// stop and the barrel turn about it); then repeats are merged, the numbers stored in fewer bits, and the whole packed
// with meshopt (three's GLTFLoader reads it with its MeshoptDecoder).
//   GLTF_TRANSFORM=<a node_modules with @gltf-transform/core, extensions, functions and meshoptimizer>
//   node blender/squeeze.js [in: blender/build/p22.glb] [out: web/assets/range/p22.glb]
const path = require('path');
const M = process.env.GLTF_TRANSFORM;
if (!M) { console.error('Set GLTF_TRANSFORM to a node_modules folder holding @gltf-transform/* and meshoptimizer.'); process.exit(1); }
const need = name => require(path.join(M, name));
const { NodeIO } = need('@gltf-transform/core');
const { ALL_EXTENSIONS } = need('@gltf-transform/extensions');
const { dedup, prune, weld, meshopt } = need('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = need('meshoptimizer');

const ROOT = path.join(__dirname, '..');
const IN = path.resolve(process.argv[2] || path.join(ROOT, 'blender/build/p22.glb'));
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'web/assets/range/p22.glb'));

(async () => {
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(IN);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    node.setMesh(null).addChild(doc.createNode('').setMesh(mesh));
  }
  await doc.transform(
    dedup(),
    prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }),
    weld(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(OUT, doc);
  const fs = require('fs');
  console.log('squeezed', IN, fs.statSync(IN).size, 'bytes to', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
