import bpy, numpy as np, sys
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')

# Turn the raw HDR bake into the runtime texture: light denoise, exposure, filmic curve, sRGB.
A = ROOT + '/web/assets/'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
EXPOSURE = float(ARGS[0]) if ARGS else 1.6
bpy.ops.wm.open_mainfile(filepath=ROOT + '/blender/room_baked.blend')

# The post-it sits on the plastic bezel under the screen, bottom right: glue strip on the bezel, the rest hanging below,
# turned to the ultrawide's curve, a little crooked and peeling forward at the bottom like a real one.
import math
from mathutils import Matrix, Vector
MCX, MCY, MCZ, MR, MH = 3.1, 0.62, 1.17, 1.6, 0.45
note = bpy.data.objects['postit'].data
c = sum((v.co for v in note.vertices), Vector()) / len(note.vertices)
side = max(v.co.z for v in note.vertices) - min(v.co.z for v in note.vertices)
a = math.asin((c.y - MCY) / MR)
toward = Vector((-math.cos(a), -math.sin(a), 0))
along = Vector((-math.sin(a), math.cos(a), 0))
top = Vector((MCX - MR * (1 - math.cos(a)), MCY + MR * math.sin(a), MCZ - MH / 2 - 0.005)) + toward * 0.001
R = Matrix.Rotation(math.radians(7), 3, along) @ Matrix.Rotation(math.radians(-2.5), 3, toward) @ Matrix.Rotation(a, 3, 'Z')
for v in note.vertices:
    v.co = top + R @ (v.co - c - Vector((0, 0, side / 2)))

raw = bpy.data.images.load(A + 'room_lightmap_raw.exr')
w, h = raw.size
px = np.array(raw.pixels[:], dtype=np.float32).reshape(h, w, 4)
rgb = px[:, :, :3]
filled = px[:, :, 3] > 0.5 if px[:, :, 3].min() < 0.5 else np.any(rgb > 0, axis=2)


def blur(a, r):
    k = 2 * r + 1
    out = np.zeros_like(a)
    pad = np.pad(a, ((r, r), (r, r)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    for dy in range(k):
        for dx in range(k):
            out += pad[dy:dy + h, dx:dx + w]
    return out / (k * k)


# Edge-aware smoothing: average only neighbours of similar brightness, inside baked islands.
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
acc = np.zeros_like(rgb)
wsum = np.zeros((h, w), dtype=np.float32)
r = 3
padc = np.pad(rgb, ((r, r), (r, r), (0, 0)), mode='edge')
padl = np.pad(lum, ((r, r), (r, r)), mode='edge')
padm = np.pad(filled.astype(np.float32), ((r, r), (r, r)), mode='constant')
for dy in range(2 * r + 1):
    for dx in range(2 * r + 1):
        nl = padl[dy:dy + h, dx:dx + w]
        sim = np.exp(-((nl - lum) ** 2) / (2 * (0.08 + 0.25 * lum) ** 2)) * padm[dy:dy + h, dx:dx + w]
        acc += padc[dy:dy + h, dx:dx + w] * sim[..., None]
        wsum += sim
den = np.where(wsum[..., None] > 0, acc / np.maximum(wsum[..., None], 1e-6), rgb)
x = den * EXPOSURE
# Soft filmic shoulder keeps the RGB glow from clipping to flat white.
x = x * (1 + x / 6.0) / (1 + x)
srgb = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)
out = np.concatenate([np.clip(srgb, 0, 1), np.ones((h, w, 1), np.float32)], axis=2)
img = bpy.data.images.new('room_lightmap', w, h)
img.pixels = out.ravel()
img.filepath_raw = A + 'room_lightmap.png'
img.file_format = 'PNG'
img.save()
print('lightmap', w, h, 'mean', float(out[..., :3].mean()))

# Export: the baked room, and the runtime-lit pieces (screens, LEDs, glass, clock hands) beside it.
room = bpy.data.objects['room_baked']
mat = room.data.materials[0]
for n in mat.node_tree.nodes:
    if n.type == 'TEX_IMAGE':
        n.image = img
        img.colorspace_settings.name = 'sRGB'
bpy.ops.export_scene.gltf(filepath=A + 'room.glb', export_format='GLB', export_draco_mesh_compression_enable=False,
                          export_image_format='WEBP', export_yup=True, export_apply=True)
print('exported room.glb')
