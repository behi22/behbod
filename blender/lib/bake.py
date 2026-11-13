"""Bake every zone's light into its own lightmap, with the whole loft in the scene so light and shadow cross zones,
then turn each raw bake into a runtime texture and export one model per zone plus the world metadata."""
import bpy, hashlib, json, math, os, time
import numpy as np
from .core import GROUPS, META, SHADE


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


# The rug pattern is drawn in the zone's texture space, which would otherwise follow whatever sits at the zone's edge;
# pinned at the extent the rugs had when he approved them, so a new piece at an edge never moves their rings.
RUG_SPACE = {
    'studio': ((16.69965171813965, 2.5508761405944824, 2.424999713897705), (5.300347805023193, 2.599123954772949, 1.9749997854232788)),
    'lounge': ((7.100000381469727, 9.630000114440918, 3.0199999809265137), (7.100000381469727, 5.319999694824219, 3.4800000190734863)),
    'mezz': ((6.315000534057617, 2.399366617202759, 3.9993741512298584), (4.585000038146973, 2.399366617202759, 1.400625467300415)),
}


def world_uv(me, name='UVMap'):
    # Coordinates in metres, each face laid flat along the axis it faces most. A lit zone carries these beside its
    # lightmap's, and the page tiles its surface detail with them.
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    lv = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', lv)
    pn = np.empty(len(me.polygons) * 3, np.float32)
    me.polygons.foreach_get('normal', pn)
    lt = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('loop_total', lt)
    ls = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('loop_start', ls)
    axis = np.empty(len(me.loops), np.int8)
    axis[np.repeat(ls, lt) + (np.arange(len(me.loops)) - np.repeat(np.cumsum(lt) - lt, lt))] = np.repeat(np.abs(pn.reshape(-1, 3)).argmax(axis=1), lt)
    p = co[lv]
    uv = np.stack([np.where(axis == 0, p[:, 1], p[:, 0]), np.where(axis == 2, p[:, 1], p[:, 2])], axis=1)
    me.uv_layers.new(name=name).data.foreach_set('uv', uv.astype(np.float32).ravel())


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
    if zid in RUG_SPACE:
        o.data.use_auto_texspace = False
        o.data.texspace_location, o.data.texspace_size = RUG_SPACE[zid]
    for uvl in list(o.data.uv_layers):
        o.data.uv_layers.remove(uvl)
    if GROUPS[zid].get('lit'):
        world_uv(o.data)
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
    lit, finish_was = GROUPS[zid].get('lit'), []
    clamp = scn.cycles.sample_clamp_indirect
    if lit:
        # The light alone, without the surfaces' colour. Bare metal has no soft light to bake, and a polished floor
        # throws bright specks of mirrored lamp into it, so every surface bakes as matt paint of its own colour and
        # gets its finish back afterwards.
        for slot in o.material_slots:
            b = slot.material.node_tree.nodes['Principled BSDF']
            for key, v in (('Metallic', 0.0), ('Roughness', 1.0), ('Specular IOR Level', 0.0)):
                finish_was.append((b.inputs[key], b.inputs[key].default_value))
                b.inputs[key].default_value = v
        scn.cycles.sample_clamp_indirect = 8.0
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'} if lit else {'DIRECT', 'INDIRECT', 'COLOR'}, margin=6, use_clear=True)
    for socket, v in finish_was:
        socket.default_value = v
    scn.cycles.sample_clamp_indirect = clamp
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


def faces_mask(o, name, w, h, grow=5):
    # The lightmap texels of the faces that use material `name`, grown a few texels for the bake's margin (islands are
    # packed about 8 texels apart, so the growth stays off its neighbours).
    slots = {i for i, s in enumerate(o.material_slots) if s.material and s.material.name == name}
    if not slots:
        return None
    uv = o.data.uv_layers['Lightmap'].data
    mask = np.zeros((h, w), bool)
    for p in o.data.polygons:
        if p.material_index not in slots:
            continue
        q = np.array([uv[i].uv[:] for i in p.loop_indices], np.float64) * (w, h)
        for k in range(1, len(q) - 1):
            a, b, c = q[0], q[k], q[k + 1]
            x0, y0 = np.floor(np.minimum.reduce([a, b, c])).astype(int)
            x1, y1 = np.ceil(np.maximum.reduce([a, b, c])).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
            if x1 <= x0 or y1 <= y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-12:
                continue
            l1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / d
            l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
            inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (1 - l1 - l2 >= -1e-6)
            mask[y0:y1, x0:x1] |= inside
    for _ in range(grow):
        g = mask.copy()
        g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
        mask = g
    return mask


def spread(rgb, filled, n=12):
    # Push each island's edge out into the empty texels round it, so neither the map's smaller copies nor its
    # compression pull black into an island's edge.
    filled = filled.copy()
    for _ in range(n):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(filled.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            f = np.roll(filled, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * f[..., None]
            cnt += f
        new = ~filled & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        filled |= new
    return rgb


def finish_lit(zid, web_dir):
    # A lit zone's map is the light alone, for the page to multiply by each surface's colour: denoised, then squeezed
    # as x / (1 + x) so light several times brighter than white still fits in eight bits (the page undoes it), then
    # sRGB, and saved beside the model rather than inside it.
    raw = GROUPS[zid]['raw']
    w, h = raw.size
    px = np.empty(w * h * 4, dtype=np.float32)
    raw.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    rgb = px[:, :, :3]
    filled = px[:, :, 3] > 0.5 if px[:, :, 3].min() < 0.5 else np.any(rgb > 0, axis=2)
    x = spread(edge_aware(rgb, filled, r=max(3, w // 680)), filled)
    lum = (x @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[filled]
    print(f'{zid} light: mean {float(lum.mean()):.3f}, half under {float(np.percentile(lum, 50)):.3f}, 99% under {float(np.percentile(lum, 99)):.3f}, '
          f'{100 * float(filled.mean()):.0f}% of the map used', flush=True)
    del px, rgb, lum
    x = x / (1 + x)
    srgb = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)
    out = np.concatenate([np.clip(srgb, 0, 1), np.ones((h, w, 1), np.float32)], axis=2)
    del x, srgb
    img = bpy.data.images.new(f'{zid}_light', w, h, alpha=False)
    img.pixels.foreach_set(out.ravel())
    img.file_format = 'WEBP'
    img.save(filepath=os.path.join(web_dir, f'{zid}_light.webp'), quality=92)
    bpy.data.images.remove(img)
    bpy.data.images.remove(raw)
    GROUPS[zid]['raw'] = None


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
    for name, k in SHADE.items():
        mask = faces_mask(GROUPS[zid]['object'], name, w, h)
        if mask is not None:
            x[mask] *= np.array(k, np.float32)
            print(f'  {zid}: {name} shown darker over {int(mask.sum())} texels', flush=True)
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


def layout_key(zid):
    # The joined mesh's vertices and lightmap UVs. A saved bake only fits the exact layout it was baked on: the same
    # parts joined in another order paint the light onto the wrong surfaces.
    me = GROUPS[zid]['object'].data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    uv = np.empty(len(me.loops) * 2, np.float32)
    me.uv_layers['Lightmap'].data.foreach_get('uv', uv)
    h = hashlib.md5(np.round(co, 4).tobytes())
    h.update(np.round(uv, 5).tobytes())
    return h.hexdigest()


def saved_layout(zid, raw_dir):
    try:
        with open(os.path.join(raw_dir, f'{zid}_raw.json')) as f:
            return json.load(f).get('layout')
    except (OSError, ValueError):
        return None


def full_samples(zid):
    # A lit zone's map is the light alone, with no surface pattern to hide the grain: twice the samples.
    return 128 * (2 if GROUPS[zid].get('lit') else 1)


def trial(zid, raw_dir):
    # What a saved bake falls short of a full one by, as words, or '' when it is a full bake (or one from before
    # samples were written down, which only its size can speak for).
    try:
        with open(os.path.join(raw_dir, f'{zid}_raw.json')) as f:
            rec = json.load(f)
    except (OSError, ValueError):
        return ''
    short = []
    if (rec.get('px') or 0) < GROUPS[zid]['px']:
        short.append(f"{rec.get('px')} px, not {GROUPS[zid]['px']}")
    if rec.get('samples') and rec['samples'] < full_samples(zid):
        short.append(f"{rec['samples']} samples, not {full_samples(zid)}")
    return ' and '.join(short)


def load_raw(zid, raw_dir, quiet=False):
    path = os.path.join(raw_dir, f'{zid}_raw.exr')
    if not os.path.exists(path):
        return False
    if not quiet:
        print(f'  {zid} reusing the saved bake', flush=True)
        return True
    GROUPS[zid]['raw'] = bpy.data.images.load(path)
    return True


def build_all(root, draft, exposure=1.3, reuse=False, only=None, cpu=0, mid=False):
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
    # `only`: bake just these zones. The rest are reused only when their saved bake still fits their layout; one that
    # does not is left exactly as it is on disk, never re-exported with light that lands on the wrong surfaces.
    keep = []
    for zid in baked:
        if reuse or (only and zid not in only):
            if os.path.exists(os.path.join(raw_dir, f'{zid}_raw.exr')) and saved_layout(zid, raw_dir) == layout_key(zid):
                load_raw(zid, raw_dir)
                # A saved bake from a `draft` or `mid` run is a trial: say so every time it is used again.
                if trial(zid, raw_dir):
                    print(f'  WARNING {zid}: its saved bake is a trial ({trial(zid, raw_dir)}); bake it in full (only={zid}) before it ships', flush=True)
                continue
            why = 'its saved bake no longer fits its layout' if saved_layout(zid, raw_dir) else 'it has no bake with a layout record'
            if reuse and (not only or zid in only):
                raise RuntimeError(f'{zid}: {why}; bake it (only={zid})')
            print(f'  {zid} left as it is: {why} (only={zid} bakes it)', flush=True)
            keep.append(zid)
            continue
        px = 1024 if draft else min(2048, GROUPS[zid]['px']) if mid else GROUPS[zid]['px']
        t0 = time.time()
        samples = full_samples(zid) * (40 if draft else 64 if mid else 128) // 128
        bake(zid, px, samples, raw_dir)
        with open(os.path.join(raw_dir, f'{zid}_raw.json'), 'w') as f:
            json.dump({'layout': layout_key(zid), 'px': px, 'samples': samples}, f)
        print(f'  {zid} baked in {time.time() - t0:.0f} s', flush=True)
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o)
    for zid in baked:
        if zid in keep:
            continue
        if not load_raw(zid, raw_dir, quiet=True):
            raise RuntimeError(f'no bake saved for {zid}')
        if GROUPS[zid].get('lit'):
            finish_lit(zid, out_dir)
        else:
            finish(zid, exposure, raw_dir)
    for zid in zones:
        if zid not in keep:
            export(zid, out_dir)
    with open(os.path.join(root, 'web', 'assets', 'world.json'), 'w') as f:
        json.dump(META, f, indent=1)
    print('world', len(zones), 'zones,', len(META['colliders']), 'colliders,', len(META['floors']), 'floors,', len(META['interact']), 'things to use', flush=True)
