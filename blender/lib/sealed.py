"""Is the house sealed? From just inside the outer face of each solid side (the south, west and east walls, the ceiling
and the floor; the glass wall to the north; every wall, floor and ceiling of the range's rooms and its tunnel), rays go
straight in, one every centimetre both ways on the walls and every two on the ceilings and the floors. One that gets
past the side's inner face without touching anything went through a hole: a gap round a door, a missing panel. Through
a hole like that you see out of the map."""
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


def _face(axis, at, sign, depth):
    # A flat side across `axis` (0 x, 1 y, 2 z) whose outer face is at `at`: rays start just inside it, go `sign` along
    # the axis, and must stop within `depth` (the side's thickness) plus `past`. a and b are the other two axes in order.
    def ray(a, b, past):
        o = [a, b]
        o.insert(axis, at + sign * 0.001)
        d = [0.0, 0.0]
        d.insert(axis, float(sign))
        return Vector(o), Vector(d), depth + past
    return ray


def _range_sides(wall_step, top_step):
    from zones.layout import RANGE, RANGE_LINE, RANGE_LOW, RANGE_HALL_H, RANGE_TUNNEL, RANGE_TUNNEL_H
    from zones.range import WING
    T = 0.2                                         # the range's walls, floors and ceilings (zones/range.py)
    x0, y0, x1, y1 = RANGE
    yb0 = RANGE_LINE - 0.3                          # the bench's far edge: the loadout room ends here and the hall begins
    HL, HH, HT = RANGE_LOW, RANGE_HALL_H, RANGE_TUNNEL_H
    tx0, ty0, tx1, ty1 = RANGE_TUNNEL
    hx0, hx1 = x0 - WING, x1 + WING                 # the hall's side walls, behind its wings
    X, Y, Z = 0, 1, 2
    return [
        ('range loadout room, west wall', _face(X, x0 - T, 1, T), (yb0, y1, 0.0, HL), wall_step),
        ('range loadout room, east wall', _face(X, x1 + T, -1, T), (yb0, y1, 0.0, HL), wall_step),
        ('range loadout room, ceiling', _face(Z, HL + T, -1, T), (x0, x1, yb0, y1), top_step),
        ('range loadout room, floor', _face(Z, -T, 1, T), (x0, x1, yb0, y1), top_step),
        ('range hall, west wall', _face(X, hx0 - T, 1, T), (y0, yb0, 0.0, HH), wall_step),
        ('range hall, east wall', _face(X, hx1 + T, -1, T), (y0, yb0, 0.0, HH), wall_step),
        # The hall's near side: its two wings' ends either side of the loadout room, and the header over that room.
        ('range hall, west wing end', _face(Y, yb0, -1, T), (hx0, x0 - T, 0.0, HH), wall_step),
        ('range hall, east wing end', _face(Y, yb0, -1, T), (x1 + T, hx1, 0.0, HH), wall_step),
        ('range hall, over the loadout room', _face(Y, yb0 + T, -1, T), (x0 - T, x1 + T, HL, HH), wall_step),
        # The far wall, round the tunnel's mouth.
        ('range hall, far wall west', _face(Y, y0 - T, 1, T), (hx0, tx0, 0.0, HH), wall_step),
        ('range hall, far wall east', _face(Y, y0 - T, 1, T), (tx1, hx1, 0.0, HH), wall_step),
        ('range hall, over the tunnel', _face(Y, y0 - T, 1, T), (tx0, tx1, HT, HH), wall_step),
        ('range hall, ceiling', _face(Z, HH + T, -1, T), (hx0, hx1, y0, yb0), top_step),
        ('range hall, floor', _face(Z, -T, 1, T), (hx0, hx1, y0, yb0), top_step),
        ('range tunnel, west wall', _face(X, tx0 - T, 1, T), (ty0, ty1, 0.0, HT), wall_step),
        ('range tunnel, east wall', _face(X, tx1 + T, -1, T), (ty0, ty1, 0.0, HT), wall_step),
        ('range tunnel, far end', _face(Y, ty0 - T, 1, T), (tx0, tx1, 0.0, HT), wall_step),
        ('range tunnel, ceiling', _face(Z, HT + T, -1, T), (tx0, tx1, ty0, ty1), top_step),
        ('range tunnel, floor', _face(Z, -T, 1, T), (tx0, tx1, ty0, ty1), top_step),
    ]


def leaks(W, D, H, wall, floor_under=1.0, past=0.06):
    # `past`: how far beyond a side's inner face a ray may go before it counts as through. A door or a bookcase
    # standing against the wall stops it; furniture further into the room does not hide a hole behind it.
    tree = _tree()
    X, Y, Z = 0, 1, 2
    sides = [
        ('south wall', _face(Y, -wall, 1, wall), (0.0, W, 0.0, H), 0.01),
        ('west wall', _face(X, -wall, 1, wall), (0.0, D, 0.0, H), 0.01),
        ('east wall', _face(X, W + wall, -1, wall), (0.0, D, 0.0, H), 0.01),
        ('ceiling', _face(Z, H + 1.5 + 0.001, -1, 1.5), (0.0, W, 0.0, D), 0.02),
        ('floor', _face(Z, -floor_under - 0.001, 1, floor_under - 0.46 - past), (0.0, W, 0.0, D), 0.02),
        # The glass wall from the balcony side: its frame reaches 0.05 into the room and 0.15 out, so rays start 0.2 out.
        # It runs past both side walls' ends so the corners where it meets them are covered too.
        ('glass wall', _face(Y, D + 0.2, -1, 0.25), (-wall, W + wall, 0.0, H), 0.01),
    ] + _range_sides(0.01, 0.02)
    found = {}
    for name, ray, (a0, a1, b0, b1), step in sides:
        holes = []
        for a, b in _grid(a0, a1, b0, b1, step):
            o, d, far = ray(a, b, past)
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
