"""Is the house sealed? From just inside the outer face of each solid side (the south, west and east walls, the ceiling
and the floor), rays go straight in, one every centimetre both ways on the walls and every two on the ceiling and the
floor. One that gets past the wall's inner face without touching anything went through a hole: a gap round a door, a
missing panel. Through a hole like that you see out of the map. The glass wall to the north is not checked."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _tree():
    # Every mesh in the scene as one search tree (asking the scene itself ray by ray took minutes).
    verts, tris = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        base = len(verts)
        verts.extend(o.matrix_world @ v.co for v in me.vertices)
        tris.extend(tuple(base + i for i in t.vertices) for t in me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return BVHTree.FromPolygons(verts, tris, all_triangles=True)


def _grid(a0, a1, b0, b1, step):
    # The middle of every `step` square, so any hole at least `step` across both ways has a ray through it.
    na, nb = int(round((a1 - a0) / step)), int(round((b1 - b0) / step))
    for i in range(na):
        for j in range(nb):
            yield a0 + step * (i + 0.5), b0 + step * (j + 0.5)


def leaks(W, D, H, wall, floor_under=1.0, past=0.06):
    # `past`: how far beyond a wall's inner face a ray may go before it counts as through. A door or a bookcase
    # standing against the wall stops it; furniture further into the room does not hide a hole behind it.
    tree = _tree()
    e = 0.001
    sides = {
        'south wall': (lambda x, z: (Vector((x, -wall + e, z)), Vector((0, 1, 0)), wall + past), (0.0, W, 0.0, H), 0.01),
        'west wall': (lambda y, z: (Vector((-wall + e, y, z)), Vector((1, 0, 0)), wall + past), (0.0, D, 0.0, H), 0.01),
        'east wall': (lambda y, z: (Vector((W + wall - e, y, z)), Vector((-1, 0, 0)), wall + past), (0.0, D, 0.0, H), 0.01),
        'ceiling': (lambda x, y: (Vector((x, y, H + 1.5)), Vector((0, 0, -1)), 1.5 + past), (0.0, W, 0.0, D), 0.02),
        'floor': (lambda x, y: (Vector((x, y, -floor_under)), Vector((0, 0, 1)), floor_under - 0.46), (0.0, W, 0.0, D), 0.02),
    }
    found = {}
    for name, (ray, (a0, a1, b0, b1), step) in sides.items():
        holes = []
        for a, b in _grid(a0, a1, b0, b1, step):
            o, d, far = ray(a, b)
            if tree.ray_cast(o, d, far)[0] is None:
                holes.append((round(a, 3), round(b, 3)))
        if holes:
            found[name] = holes
    return found


def report(found):
    for name, holes in found.items():
        a = [h[0] for h in holes]
        b = [h[1] for h in holes]
        print(f'  LEAK {name}: {len(holes)} rays through, between ({min(a)}, {min(b)}) and ({max(a)}, {max(b)}); first {holes[:4]}')
    print('sealed' if not found else f'NOT SEALED: {sum(len(h) for h in found.values())} rays got through')
    return not found
