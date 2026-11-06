"""Bake every zone's light into its own lightmap, with the whole loft in the scene so light and shadow cross zones,
then turn each raw bake into a runtime texture and export one model per zone plus the world metadata."""
import bpy, json, math, os, time
import numpy as np
from .core import GROUPS, META


def use_gpu(scn):
    scn.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for dt in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
            try:
                prefs.compute_device_type = dt
                prefs.get_devices()
                if any(d.type == dt for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = d.type == dt
                    scn.cycles.device = 'GPU'
                    print('bake device', dt)
                    return
            except TypeError:
                continue
    except Exception as e:
        print('gpu probe failed', e)


def join(zid):
    objs = GROUPS[zid]['baked']
    for o in objs:
        for f in o.data.polygons:
            f.use_smooth = False
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = f'{zid}_baked'
    for uvl in list(o.data.uv_layers):
        o.data.uv_layers.remove(uvl)
    lm = o.data.uv_layers.new(name='Lightmap')
    o.data.uv_layers.active = lm
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=0.002, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    GROUPS[zid]['object'] = o
    return o


def bake(zid, px, samples, raw_dir):
    o = GROUPS[zid]['object']
    scn = bpy.context.scene
    scn.cycles.samples = samples
    scn.cycles.use_denoising = False
    img = bpy.data.images.new(f'{zid}_raw', px, px, float_buffer=True)
    for slot in o.material_slots:
        nt = slot.material.node_tree
        n = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
        n.name = 'bake_target'
        n.image = img
        nt.nodes.active = n
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    print(f'baking {zid}: {len(o.data.polygons)} faces at {px} px, {samples} samples', flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=6, use_clear=True)
    img.filepath_raw = os.path.join(raw_dir, f'{zid}_raw.exr')
    img.file_format = 'OPEN_EXR'
    img.save()
    # Write it out and free it straight away; the finishing pass reads it back one zone at a time.
    for slot in o.material_slots:
        slot.material.node_tree.nodes['bake_target'].image = None
    bpy.data.images.remove(img)


def edge_aware(rgb, filled, r=3, band=256):
    # Average each pixel with neighbours of similar brightness inside baked islands, a band of rows at a time so a
    # 4096 pixel map never needs more than a few hundred megabytes.
    h, w, _ = rgb.shape
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    padc = np.pad(rgb, ((r, r), (r, r), (0, 0)), mode='edge')
    padl = np.pad(lum, ((r, r), (r, r)), mode='edge')
    padm = np.pad(filled.astype(np.float32), ((r, r), (r, r)), mode='constant')
    out = np.empty_like(rgb)
    for y0 in range(0, h, band):
        y1 = min(h, y0 + band)
        l0 = lum[y0:y1]
        spread = 2 * (0.08 + 0.25 * l0) ** 2
        acc = np.zeros((y1 - y0, w, 3), np.float32)
        wsum = np.zeros((y1 - y0, w), np.float32)
        for dy in range(2 * r + 1):
            for dx in range(2 * r + 1):
                sim = np.exp(-((padl[y0 + dy:y1 + dy, dx:dx + w] - l0) ** 2) / spread) * padm[y0 + dy:y1 + dy, dx:dx + w]
                acc += padc[y0 + dy:y1 + dy, dx:dx + w] * sim[..., None]
                wsum += sim
        out[y0:y1] = np.where(wsum[..., None] > 0, acc / np.maximum(wsum[..., None], 1e-6), rgb[y0:y1])
    return out


def finish(zid, exposure, out_dir):
    # Light denoise that keeps edges, exposure, a soft filmic shoulder, then sRGB. Pixels move through numpy
    # buffers directly: a Python list of a 4096 pixel map's floats alone needs about 2 GB.
    raw = GROUPS[zid]['raw']
    w, h = raw.size
    px = np.empty(w * h * 4, dtype=np.float32)
    raw.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    rgb = px[:, :, :3]
    filled = px[:, :, 3] > 0.5 if px[:, :, 3].min() < 0.5 else np.any(rgb > 0, axis=2)
    x = edge_aware(rgb, filled) * exposure
    del px, rgb, filled
    x = x * (1 + x / 6.0) / (1 + x)
    srgb = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)
    del x
    out = np.concatenate([np.clip(srgb, 0, 1), np.ones((h, w, 1), np.float32)], axis=2)
    del srgb
    img = bpy.data.images.new(f'{zid}_lightmap', w, h)
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = os.path.join(out_dir, f'{zid}_lightmap.png')
    img.file_format = 'PNG'
    img.save()
    img.colorspace_settings.name = 'sRGB'
    # The baked look: one material that only shows the lightmap.
    m = bpy.data.materials.new(f'M_{zid}_baked')
    m.use_nodes = True
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    m.node_tree.links.new(t.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    o = GROUPS[zid]['object']
    o.data.materials.clear()
    o.data.materials.append(m)
    print(f'{zid} lightmap mean {float(out[..., :3].mean()):.3f}', flush=True)
    # Free the float bake now that its texture is written.
    bpy.data.images.remove(raw)
    GROUPS[zid]['raw'] = None


def export(zid, out_dir):
    g = GROUPS[zid]
    bpy.ops.object.select_all(action='DESELECT')
    for o in [g.get('object'), *g['emit'], *g['glass']]:
        if o:
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f'{zid}.glb'), export_format='GLB', use_selection=True,
                              export_draco_mesh_compression_enable=False, export_image_format='WEBP', export_yup=True, export_apply=True)


def load_raw(zid, raw_dir, quiet=False):
    path = os.path.join(raw_dir, f'{zid}_raw.exr')
    if not os.path.exists(path):
        return False
    if not quiet:
        print(f'  {zid} reusing the saved bake', flush=True)
        return True
    GROUPS[zid]['raw'] = bpy.data.images.load(path)
    return True


def build_all(root, draft, exposure=1.3, reuse=False, only=None, cpu=0):
    scn = bpy.context.scene
    if cpu:
        # A fixed number of processor cores, for when the graphics chip is busy or stuck.
        scn.render.engine = 'CYCLES'
        scn.cycles.device = 'CPU'
        scn.render.threads_mode = 'FIXED'
        scn.render.threads = cpu
        print('bake device CPU,', cpu, 'threads', flush=True)
    else:
        use_gpu(scn)
    raw_dir = os.path.join(root, 'blender', 'build')
    out_dir = os.path.join(root, 'web', 'assets', 'zones')
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    zones = [z['id'] for z in META['zones']]
    baked = [zid for zid in zones if GROUPS[zid]['baked']]
    for zid in baked:
        join(zid)
    for zid in baked:
        # `only`: bake just the zones that changed and reuse the saved full bakes of the rest.
        if (reuse or (only and zid not in only)) and load_raw(zid, raw_dir):
            continue
        px = 1024 if draft else GROUPS[zid]['px']
        t0 = time.time()
        bake(zid, px, 40 if draft else 128, raw_dir)
        print(f'  {zid} baked in {time.time() - t0:.0f} s', flush=True)
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o)
    for zid in baked:
        if not load_raw(zid, raw_dir, quiet=True):
            raise RuntimeError(f'no bake saved for {zid}')
        finish(zid, exposure, raw_dir)
    for zid in zones:
        export(zid, out_dir)
    with open(os.path.join(root, 'web', 'assets', 'world.json'), 'w') as f:
        json.dump(META, f, indent=1)
    print('world', len(zones), 'zones,', len(META['colliders']), 'colliders,', len(META['floors']), 'floors,', len(META['interact']), 'things to use', flush=True)
