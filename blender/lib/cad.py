"""Hard-surface modelling by script, for the range's guns and gear: outlines extruded to a thickness, cuts made with
booleans, every edge given a small bevel so it catches the light, and shadows and wear painted into vertex colours.
Units are metres. A gun is drawn side-on in X (forward) and Z (up), with Y across it."""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

SC = lambda: bpy.context.scene.collection


def obj_from(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    SC().objects.link(o)
    if mat:
        me.materials.append(mat)
    return o


def outline(name, pts, half, mat=None, y=0.0):
    """A flat outline in the side view, [(x, z), ...] going round once, made `2 * half` thick across (centred on y)."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y - half, z)) for x, z in pts]
    b = [bm.verts.new((x, y + half, z)) for x, z in pts]
    n = len(pts)
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(n):
        bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return obj_from(name, bm, mat)


def section(name, pts, x0, x1, mat=None):
    """A cross-section seen from behind, [(y, z), ...] going round once, run along the gun from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in pts]
    b = [bm.verts.new((x1, y, z)) for y, z in pts]
    n = len(pts)
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(n):
        bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return obj_from(name, bm, mat)


def loft(name, rings, mat=None):
    """A skin over a stack of rings (each a list of points, all the same length), closed at both ends."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(vs[0])
    for i in range(len(vs) - 1):
        for k in range(n):
            j = (k + 1) % n
            bm.faces.new((vs[i][k], vs[i][j], vs[i + 1][j], vs[i + 1][k]))
    bm.faces.new(vs[0][::-1])
    bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return obj_from(name, bm, mat)


def oval(cx, cy, z, a, b, power=2.6, n=28):
    """A rounded-rectangle ring at height z: half-length a along x, half-width b along y."""
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s_ = math.cos(t), math.sin(t)
        out.append((cx + a * math.copysign(abs(c) ** (2 / power), c), cy + b * math.copysign(abs(s_) ** (2 / power), s_), z))
    return out


def text(name, string, size, loc, mat=None, depth=0.00012, rot_x=math.pi / 2, rot_z=0.0, align='LEFT'):
    """Lettering as thin raised geometry (laser-etched markings), facing out along -Y until turned by rot_z."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body, cu.size, cu.extrude, cu.align_x = string, size, depth, align
    cu.resolution_u = 2
    o = bpy.data.objects.new(name, cu)
    SC().objects.link(o)
    o.rotation_euler = (rot_x, 0, rot_z)
    o.location = loc
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    me.transform(o.matrix_world)
    bpy.data.objects.remove(o)
    m = bpy.data.objects.new(name, me)
    SC().objects.link(m)
    if mat:
        me.materials.append(mat)
    return m


def box(name, size, loc, mat=None, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(rot[1], 3, rot[0]), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return obj_from(name, bm, mat)


def cyl(name, r, depth, loc, mat=None, axis='X', seg=32, r2=None, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    if axis == 'X':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
    elif axis == 'Y':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'), verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(rot[1], 3, rot[0]), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return obj_from(name, bm, mat)


def tube(name, r_out, r_in, depth, loc, mat=None, axis='X', seg=32):
    """A pipe: an outer wall, an inner wall and a ring at each end."""
    bm = bmesh.new()
    rings = []
    for r in (r_out, r_in):
        for h in (-depth / 2, depth / 2):
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), h)) for k in range(seg)])
    o0, o1, i0, i1 = rings
    for k in range(seg):
        j = (k + 1) % seg
        bm.faces.new((o0[k], o0[j], o1[j], o1[k]))
        bm.faces.new((i0[j], i0[k], i1[k], i1[j]))
        bm.faces.new((o1[k], o1[j], i1[j], i1[k]))
        bm.faces.new((o0[j], o0[k], i0[k], i0[j]))
    if axis == 'X':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
    elif axis == 'Y':
        bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return obj_from(name, bm, mat)


def capsule(name, a, b, r, mat=None, seg=16, rings=6, r2=None):
    """A rounded rod from a to b (a finger joint, a lever)."""
    a, b = Vector(a), Vector(b)
    r2 = r if r2 is None else r2
    ax = (b - a).normalized()
    u = ax.cross(Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))).normalized()
    v = ax.cross(u)
    bm = bmesh.new()
    loops = []
    for i in range(rings + 1):
        t = math.pi / 2 * i / rings
        loops.append((a - ax * (r * math.cos(t)), r * math.sin(t)))
    for i in range(rings + 1):
        t = math.pi / 2 * (1 - i / rings)
        loops.append((b + ax * (r2 * math.cos(t)), r2 * math.sin(t)))
    vs = [[bm.verts.new(c + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * max(rr, 1e-5)) for k in range(seg)] for c, rr in loops]
    for i in range(len(vs) - 1):
        for k in range(seg):
            j = (k + 1) % seg
            bm.faces.new((vs[i][k], vs[i][j], vs[i + 1][j], vs[i + 1][k]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return obj_from(name, bm, mat)


def _apply(o, mod):
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean(target, others, op='DIFFERENCE', keep=False):
    """Cuts (or joins, or keeps the overlap of) `others` with `target`, exactly."""
    for c in others if isinstance(others, (list, tuple)) else [others]:
        # A cut face takes its material from the cutter, so the cutter wears the target's (a bare cutter leaves an
        # empty material slot behind, and its faces draw white).
        if target.data.materials and not c.data.materials:
            c.data.materials.append(target.data.materials[0])
        m = target.modifiers.new('b', 'BOOLEAN')
        m.operation, m.object, m.solver = op, c, 'EXACT'
        _apply(target, m)
        if not keep:
            bpy.data.objects.remove(c)
    return target


cut = lambda target, cutters: boolean(target, cutters, 'DIFFERENCE')
union = lambda target, others: boolean(target, others, 'UNION')


def join(name, objs, mat=None):
    """Several pieces as one mesh with no welding (overlapping solids of one part)."""
    for x in bpy.context.selected_objects:
        x.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    if mat:
        o.data.materials.clear()
        o.data.materials.append(mat)
    return o


def bevel(o, width=0.0006, segments=2, angle=30):
    """Rounds every edge sharper than `angle` degrees a little, so it catches a highlight like machined metal."""
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width, m.segments, m.limit_method, m.angle_limit = width, segments, 'ANGLE', math.radians(angle)
    m.harden_normals = True
    m.miter_outer = 'MITER_ARC'
    _apply(o, m)
    return o


def smooth(o, angle=38):
    """Smooth shading across gentle folds, a crisp line at anything sharper, and flat faces kept flat: each corner's
    normal leans toward the bigger faces round it, so a wide machined flat does not shade like a curve."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    lim = math.radians(angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim)
    bm.to_mesh(me)
    bm.free()
    m = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    m.mode, m.weight, m.keep_sharp = 'FACE_AREA', 50, True
    _apply(o, m)
    return o


def split_at(o, z_levels):
    """Cuts edges into the surface at these heights (nothing is removed), so a finish can stop on a straight line."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for z in z_levels:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0, 0, z)), plane_no=Vector((0, 0, 1)))
    bm.to_mesh(o.data)
    bm.free()
    return o


def box_uv(o, scale=1.0):
    """UVs by which way each face points (the two other axes, in metres times `scale`), for tiling detail maps."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [i for i in range(3) if i != ax]
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co[a] * scale, lp.vert.co[b] * scale)
    bm.to_mesh(me)
    bm.free()
    return o


def shade(objs, only=None, rays=20, reach=0.035, depth=0.75, wear=0.35, seed=5):
    """Paints soft shadow into every piece's vertex colours (how much of the space just above each point is blocked by
    the gun itself) and a lighter touch along outward edges, where handling wears a finish thin."""
    rng = np.random.RandomState(seed)
    dirs = rng.normal(size=(rays * 3, 3))
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    dg = bpy.context.evaluated_depsgraph_get()
    verts, tris = [], []
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        base = len(verts)
        verts.extend(o.matrix_world @ v.co for v in me.vertices)
        tris.extend(tuple(base + i for i in t.vertices) for t in me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    tree = BVHTree.FromPolygons(verts, tris, all_triangles=True)
    # `only`: the pieces to paint, when the rest are just there to cast their shadow on them.
    for o in (only or objs):
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        rot = o.matrix_world.to_3x3()
        occ = []
        for v in bm.verts:
            p, n = o.matrix_world @ v.co, (rot @ v.normal).normalized()
            hit = total = 0
            for d in dirs:
                k = float(n.x * d[0] + n.y * d[1] + n.z * d[2])
                if k <= 0.15:
                    continue
                total += 1
                if total > rays:
                    break
                if tree.ray_cast(p + n * 0.0004, Vector(d), reach)[0] is not None:
                    hit += 1
            ao = 1 - depth * (hit / max(1, min(total, rays)))
            # An outward corner: its neighbours sit behind its own surface.
            nb = [e.other_vert(v).co for e in v.link_edges]
            convex = max(0.0, -sum((q - v.co).normalized().dot(v.normal) for q in nb) / max(1, len(nb))) if nb else 0.0
            occ.append(min(1.0, ao * (1 + wear * min(1.0, convex * 2.2))))
        col = bm.loops.layers.float_color.new('Col') if 'Col' not in bm.loops.layers.float_color else bm.loops.layers.float_color['Col']
        for f in bm.faces:
            for lp in f.loops:
                k = occ[lp.vert.index]
                lp[col] = (k, k, k, 1.0)
        bm.to_mesh(me)
        bm.free()
        me.color_attributes.active_color = me.color_attributes['Col']
        me.color_attributes.render_color_index = me.color_attributes.find('Col')


def origin(o, at):
    """Moves the piece's own origin (the point it turns and slides about) to `at`, leaving it where it is."""
    at = Vector(at)
    o.data.transform(Matrix.Translation(o.location - at))
    o.location = at
    return o


def grain(name, px=256, scale=1.0, kind='speckle', amp=3.0, seed=1):
    """A small tiling normal map: fine speckle (a blasted or moulded finish), stipple (grip texture) or brushed lines."""
    rng = np.random.RandomState(seed)
    if kind == 'brushed':
        h = np.repeat(rng.rand(px, 1), px, axis=1) + 0.15 * rng.rand(px, px)
    elif kind == 'stipple':
        h = np.zeros((px, px))
        yy, xx = np.mgrid[0:px, 0:px]
        step = px // 16
        for j in range(16):
            for i in range(16):
                cx, cy = (i + 0.5 + 0.25 * rng.rand()) * step, (j + 0.5 * (i % 2) + 0.25 * rng.rand()) * step
                d2 = (np.minimum(np.abs(xx - cx), px - np.abs(xx - cx)) ** 2 + np.minimum(np.abs(yy - cy), px - np.abs(yy - cy)) ** 2) / (step * 0.34) ** 2
                h = np.maximum(h, np.clip(1 - d2, 0, 1))
    else:
        h = rng.rand(px, px)
        for _ in range(2):
            h = (h + np.roll(h, 1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 0) + np.roll(h, -1, 1)) / 5
    gy, gx = np.gradient(h)
    gx, gy = np.roll(gx, 0, 1), gy
    n = np.dstack([-gx * amp * px / 64, -gy * amp * px / 64, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    img = bpy.data.images.new(name, px, px)
    img.pixels = np.dstack([(n + 1) / 2, np.ones((px, px))]).astype(np.float32).ravel()
    img.pack()
    img.colorspace_settings.name = 'Non-Color'
    return img


def material(name, color, rough, metal=0.0, normal=None, tile=60.0, strength=0.5, emit=None, emit_strength=0.0, alpha=1.0):
    """A real material (colour, roughness, metal) whose colour is multiplied by the painted vertex colours, with an
    optional tiling detail normal map."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs['A'].default_value = (*color, 1)
    nt.links.new(vc.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = normal
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (tile, tile, 1)
        nt.links.new(nt.nodes.new('ShaderNodeTexCoord').outputs['UV'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
    return m


def tris(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n
