"""The loft's structure: every floor level, the walls and partitions, the glass wall with its sliding door, the
ceiling, beams and skylight, the mezzanine slab and rail, the stairs along the west wall, the sunken lounge, the
piano dais and the raised studio."""
import math
from lib.core import zone, box, cyl, plane, ring, tube, collider, floor, area, META
from zones.layout import *


def disc_floors(cx, cy, r, z, bands=14):
    # A round platform as walkable strips, each as wide as the circle is at its narrowest point in the strip.
    for i in range(bands):
        y0, y1 = cy - r + 2 * r * i / bands, cy - r + 2 * r * (i + 1) / bands
        yn = max(abs(y0 - cy), abs(y1 - cy))
        hw = math.sqrt(max(0.0, r * r - yn * yn))
        if hw > 0.05:
            floor(cx - hw, y0, cx + hw, y1, z)


def build(M, E, G):
    with zone('shell', px=4096):
        x0, y0, x1, y1 = PIT
        # Ground floor around the sunken lounge, as thick slabs whose sides are the lounge's walls.
        for name, (a, b, c, d) in {'n': (0, y1, W, D), 's': (0, 0, W, y0), 'w': (0, y0, x0, y1), 'e': (x1, y0, W, y1)}.items():
            box(f'floor_{name}', (c - a, d - b, 0.6), ((a + c) / 2, (b + d) / 2, -0.3), M['floor'])
            floor(a, b, c, d, 0.0)
        sx0, sy0, sx1, sy1 = PIT_STEPS
        box('floor_pit', (x1 - x0, y1 - y0, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2, PIT_Z - 0.1), M['floor_dark'])
        floor(x0, y0, x1, y1, PIT_Z)
        for i, z in enumerate((-0.15, -0.30)):
            xa, xb = sx1 - 0.3 * (i + 1), sx1 - 0.3 * i
            box(f'pit_step{i}', (0.3, sy1 - sy0, z - PIT_Z), ((xa + xb) / 2, (sy0 + sy1) / 2, (PIT_Z + z) / 2), M['floor'], bevel=0.006)
            floor(xa, sy0, xb, sy1, z)
            box(f'pit_step{i}_led', (0.012, sy1 - sy0 - 0.1, 0.01), (xa - 0.008, (sy0 + sy1) / 2, z - 0.02), E['warm_soft'], kind='emit')
        box('pit_edge_led', (0.012, sy1 - sy0 - 0.1, 0.01), (x1 + 0.006, (sy0 + sy1) / 2, -0.02), E['warm_soft'], kind='emit')
        collider('pit_edge_n', (x0, y1, -1), (x1, y1 + 0.05, 0.0), structure=True)
        collider('pit_edge_s', (x0, y0 - 0.05, -1), (x1, y0, 0.0), structure=True)
        collider('pit_edge_w', (x0 - 0.05, y0, -1), (x0, y1, 0.0), structure=True)
        collider('pit_edge_e1', (x1, y0, -1), (x1 + 0.05, sy0, 0.0), structure=True)
        collider('pit_edge_e2', (x1, sy1, -1), (x1 + 0.05, y1, 0.0), structure=True)

        # The piano dais: a round step and a round top under the skylight.
        cx, cy, r1, r0 = DAIS
        cyl('dais_step', r1, 0.15, (cx, cy, 0.075), M['walnut'], seg=72)
        cyl('dais_top', r0, 0.15, (cx, cy, 0.225), M['walnut'], seg=72)
        ring('dais_led', r1 - 0.005, r1 + 0.006, 0.13, 0.14, (cx, cy, 0), E['warm_soft'], seg=72, kind='emit')
        ring('dais_led2', r0 - 0.005, r0 + 0.006, 0.28, 0.29, (cx, cy, 0), E['warm_soft'], seg=72, kind='emit')
        disc_floors(cx, cy, r1, 0.15)
        disc_floors(cx, cy, r0, DAIS_Z)

        # The raised studio, with steps cut into its north edge.
        a, b, c, d = STUDIO
        qa, qb, qc, qd = STUDIO_STEPS
        box('studio_w', (qa - a, d - b, STUDIO_Z), ((a + qa) / 2, (b + d) / 2, STUDIO_Z / 2), M['floor'])
        box('studio_e', (c - qc, d - b, STUDIO_Z), ((qc + c) / 2, (b + d) / 2, STUDIO_Z / 2), M['floor'])
        box('studio_mid', (qc - qa, qb - b, STUDIO_Z), ((qa + qc) / 2, (b + qb) / 2, STUDIO_Z / 2), M['floor'])
        floor(a, b, qa, d, STUDIO_Z)
        floor(qc, b, c, d, STUDIO_Z)
        floor(qa, b, qc, qb, STUDIO_Z)
        for i, z in enumerate((0.15, 0.30)):
            ya, yb = qd - 0.25 * (i + 1), qd - 0.25 * i
            box(f'studio_step{i}', (qc - qa, 0.25, z), ((qa + qc) / 2, (ya + yb) / 2, z / 2), M['floor'], bevel=0.006)
            floor(qa, ya, qc, yb, z)
            box(f'studio_step{i}_led', (qc - qa - 0.1, 0.012, 0.01), ((qa + qc) / 2, yb + 0.006, z - 0.02), E['warm_soft'], kind='emit')
        for name, (u0, u1) in {'w': (a, qa), 'e': (qc, c)}.items():
            box(f'studio_edge_led_{name}', (u1 - u0 - 0.1, 0.012, 0.01), ((u0 + u1) / 2, d + 0.006, STUDIO_Z - 0.02), E['rgb_purple'], kind='emit')
        collider('studio_riser_w', (a, d, -1), (qa, d + 0.05, STUDIO_Z), structure=True)
        collider('studio_riser_e', (qc, d, -1), (c, d + 0.05, STUDIO_Z), structure=True)
        collider('studio_riser_west', (a - 0.05, MEZZ[3], -1), (a, d, STUDIO_Z), structure=True)

        # Outer walls: south (front door and the secret door in the bookshelf), west, east (brick).
        fa, fb = FRONT_DOOR
        sa, sb = SECRET_DOOR
        for name, (u0, u1) in {'s1': (-WALL, fa), 's2': (fb, sa), 's3': (sb, W + WALL)}.items():
            box(f'wall_{name}', (u1 - u0, WALL, H), ((u0 + u1) / 2, -WALL / 2, H / 2), M['wall'])
        box('wall_s_door_head', (fb - fa, WALL, H - 2.2), ((fa + fb) / 2, -WALL / 2, 2.2 + (H - 2.2) / 2), M['wall'])
        box('wall_s_secret_head', (sb - sa, WALL, H - 2.1), ((sa + sb) / 2, -WALL / 2, 2.1 + (H - 2.1) / 2), M['wall'])
        box('wall_w', (WALL, D, H), (-WALL / 2, D / 2, H / 2), M['wall'])
        box('wall_e', (WALL, D, H), (W + WALL / 2, D / 2, H / 2), M['brick'])
        box('front_door', (fb - fa - 0.04, 0.06, 2.16), ((fa + fb) / 2, 0.02, 1.08), M['walnut'], bevel=0.01)
        cyl('front_door_handle', 0.018, 0.14, (fb - 0.12, 0.07, 1.05), M['brass'], seg=12)
        collider('front_door', (fa, -0.3, -1), (fb, 0.06, 2.3), structure=True)
        # The south wall is only as thick as it is: the holo range is right behind it.
        collider('wall_s', (-1, -WALL, -1), (sa, 0.0, H), structure=True)
        collider('wall_s_b', (sb, -WALL, -1), (W + 1, 0.0, H), structure=True)
        collider('wall_s_secret_head', (sa, -WALL, 2.1), (sb, 0.0, H), structure=True)
        collider('wall_w', (-1, -1, -1), (0.0, D + 1, H), structure=True)
        collider('wall_e', (W, -1, -1), (W + 1, D + 1, H), structure=True)
        box('plinth_s', (W, 0.02, 0.08), (W / 2, 0.01, 0.04), M['plinth'])
        box('plinth_w', (0.02, D, 0.08), (0.01, D / 2, 0.04), M['plinth'])
        # Partitions under the mezzanine: between the entry and the library (open at its north end), and between the
        # library and the studio.
        box('wall_entry', (0.15, ENTRY_WALL_Y1, MEZZ_UNDER), (ENTRY_WALL_X, ENTRY_WALL_Y1 / 2, MEZZ_UNDER / 2), M['wall'])
        collider('wall_entry', (ENTRY_WALL_X - 0.075, 0.0, -1), (ENTRY_WALL_X + 0.075, ENTRY_WALL_Y1, MEZZ_UNDER), structure=True)
        box('wall_partition', (0.2, MEZZ[3], MEZZ_UNDER), (PARTITION_X, MEZZ[3] / 2, MEZZ_UNDER / 2), M['wall'])
        collider('wall_partition', (PARTITION_X - 0.1, 0.0, -1), (PARTITION_X + 0.1, MEZZ[3], MEZZ_UNDER), structure=True)

        # The glass wall: double-height glass on a black frame, with a sliding door to the balcony.
        da, db = SLIDING_DOOR
        for i in range(12):
            x = i * 2.0
            if da - 0.05 < x < db + 0.05:
                continue
            box(f'mullion{i}', (0.08, 0.14, H), (x, D + 0.05, H / 2), M['black'])
        for x in (da, db):
            box(f'door_jamb{x:.1f}', (0.1, 0.16, H), (x, D + 0.05, H / 2), M['black'])
        box('door_head', (db - da, 0.16, 0.1), ((da + db) / 2, D + 0.05, 2.45), M['black'])
        box('glass_transom', (W, 0.14, 0.08), (W / 2, D + 0.05, 3.2), M['black'])
        box('glass_head', (W, 0.16, 0.1), (W / 2, D + 0.05, H - 0.05), M['black'])
        box('glass_sill', (W, 0.2, 0.04), (W / 2, D + 0.05, 0.02), M['black'])
        for name, (u0, u1) in {'w': (0, da), 'e': (db, W)}.items():
            plane(f'window_glass_{name}', u1 - u0, H, ((u0 + u1) / 2, D + 0.06, H / 2), G['window'], '-Y', kind='glass')
        plane('window_glass_door_top', db - da, H - 2.5, ((da + db) / 2, D + 0.06, 2.5 + (H - 2.5) / 2), G['window'], '-Y', kind='glass')
        # Two glass panels: the west one fixed, the east one slides behind it when you come near (the page moves it).
        for name, x, yy in (('fixed', da + 0.5, D + 0.02), ('slide', db - 0.5, D + 0.1)):
            kind = 'emit' if name == 'slide' else 'baked'
            box(f'slider_{name}_frame', (1.02, 0.05, 2.4), (x, yy, 1.2), M['black'], kind=kind)
            plane(f'slider_{name}_glass', 0.94, 2.32, (x, yy - 0.03, 1.2), G['window'], '-Y', kind='glass')
            box(f'slider_{name}_handle', (0.03, 0.04, 0.3), (x - 0.42 if name == 'slide' else x + 0.42, yy - 0.05, 1.05), M['steel'], kind=kind)
        META.setdefault('doors', []).append({'id': 'balcony', 'collider': 'slider_slide', 'parts': 'slider_slide_', 'slide': [-0.96, 0, 0], 'auto': 1.8, 'at': [db - 0.5, D, 0]})
        collider('glass_w', (-1, D, -1), (da + 1.0, D + 0.3, H), structure=True)
        collider('slider_slide', (da + 1.0, D, -1), (db, D + 0.3, 2.45), structure=True)
        collider('glass_e', (db, D, -1), (W + 1, D + 0.3, H), structure=True)
        collider('glass_above_door', (da, D, 2.45), (db, D + 0.3, H), structure=True)
        floor(da + 1.0, D - 0.1, db, D + 0.3, 0.0)

        # Ceiling at 6.5 m with the skylight over the piano, three beams flush under it, recessed downlights.
        ka, kb, kc, kd = SKYLIGHT
        for name, (u0, v0, u1, v1) in {'w': (0, 0, ka, D), 'e': (kc, 0, W, D), 's': (ka, 0, kc, kb), 'n': (ka, kd, kc, D)}.items():
            box(f'ceiling_{name}', (u1 - u0, v1 - v0, 0.2), ((u0 + u1) / 2, (v0 + v1) / 2, H + 0.1), M['ceiling'])
        # The frame stands 2 mm proud of the ceiling and the opening, so none of its faces shares a plane with the ceiling's.
        e = 0.002
        for name, (u0, v0, u1, v1) in {'w': (ka - 0.06, kb, ka + e, kd), 'e': (kc - e, kb, kc + 0.06, kd), 's': (ka, kb - 0.06, kc, kb + e), 'n': (ka, kd - e, kc, kd + 0.06)}.items():
            box(f'skylight_frame_{name}', (u1 - u0, v1 - v0, 0.5 + e), ((u0 + u1) / 2, (v0 + v1) / 2, H + 0.25 - e / 2), M['black'])
        plane('skylight_glass', kc - ka, kd - kb, ((ka + kc) / 2, (kb + kd) / 2, H + 0.45), G['glass'], '+Z', kind='glass')
        plane('skylight_sky', kc - ka + 0.4, kd - kb + 0.4, ((ka + kc) / 2, (kb + kd) / 2, H + 1.2), E['sky'], '+Z', kind='emit')
        for i, y in enumerate((6.5, 9.0, 13.0)):
            box(f'beam{i}', (W, 0.2, 0.32), (W / 2, y, H - 0.16), M['walnut'])
        for i, (x, y) in enumerate(((5.0, 10.2), (8.0, 10.2), (14.75, 7.85), (20.0, 7.8), (20.0, 13.6), (13.0, 11.5), (3.5, 6.0), (9.0, 6.0))):
            cyl(f'ceiling_light{i}', 0.09, 0.02, (x, y, H - 0.01), E['warm_soft'], seg=20, kind='emit')

        # The mezzanine slab over the entry and the library, edged in walnut, with a glass rail.
        a, b, c, d = MEZZ
        # The slab stops under the floorboards: a face shared with the boards' top baked black on the mezzanine.
        box('mezz_slab', (c - a, d - b, MEZZ_Z - 0.03 - MEZZ_UNDER), ((a + c) / 2, (b + d) / 2, (MEZZ_Z - 0.03 + MEZZ_UNDER) / 2), M['ceiling'])
        box('mezz_floor', (c - a, d - b, 0.03), ((a + c) / 2, (b + d) / 2, MEZZ_Z - 0.015), M['oak_mezz'])
        box('mezz_fascia_n', (c - a, 0.03, MEZZ_Z - MEZZ_UNDER + 0.02), ((a + c) / 2, d + 0.015, (MEZZ_Z + MEZZ_UNDER) / 2), M['walnut'])
        box('mezz_fascia_e', (0.03, d - b, MEZZ_Z - MEZZ_UNDER + 0.02), (c + 0.015, (b + d) / 2, (MEZZ_Z + MEZZ_UNDER) / 2), M['walnut'])
        box('mezz_under_led', (c - a - 0.2, 0.012, 0.012), ((a + c) / 2, d - 0.03, MEZZ_UNDER - 0.006), E['warm_soft'], kind='emit')
        floor(a, b, c, d, MEZZ_Z)
        collider('mezz_slab', (a, b, MEZZ_UNDER), (c, d, MEZZ_Z), structure=True)
        st0, st1 = STAIRS
        for name, (p, q) in {'rail_n': ((st1, d), (c, d)), 'rail_e': ((c, b), (c, d))}.items():
            (px, py), (qx, qy) = p, q
            horiz = abs(qy - py) < 1e-6
            size = (abs(qx - px), 0.02, 1.0) if horiz else (0.02, abs(qy - py), 1.0)
            box(f'mezz_{name}', size, ((px + qx) / 2, (py + qy) / 2 - (0.02 if horiz else 0), MEZZ_Z + 0.5), G['glass'], kind='glass')
            tube(f'mezz_{name}_cap', [(px, py - (0.02 if horiz else 0), MEZZ_Z + 1.02), (qx, qy - (0.02 if horiz else 0), MEZZ_Z + 1.02)], 0.022, M['steel'])
            collider(f'mezz_{name}', (min(px, qx) - 0.04, min(py, qy) - 0.06, MEZZ_Z), (max(px, qx) + 0.04, max(py, qy) + 0.02, MEZZ_Z + 1.1), structure=True)

        # The stairs along the west wall: walnut treads on a steel stringer, a handrail on the open side, a warm strip
        # under each nose. The wall above them carries the project gallery.
        n = STAIR_N
        rise, run = MEZZ_Z / n, (STAIR_Y0 - STAIR_Y1) / n
        for i in range(n):
            yb, ya = STAIR_Y0 - run * i, STAIR_Y0 - run * (i + 1)
            z = rise * (i + 1)
            box(f'tread{i}', (st1 - st0, run + 0.02, 0.06), ((st0 + st1) / 2, (ya + yb) / 2, z - 0.03), M['walnut'], bevel=0.004)
            box(f'tread{i}_led', (st1 - st0 - 0.1, 0.01, 0.01), ((st0 + st1) / 2, yb - 0.004, z - 0.065), E['warm_soft'], kind='emit')
            floor(st0, ya, st1, yb, z)
        tube('stair_stringer', [(st1 - 0.05, STAIR_Y0 + 0.05, 0.0), (st1 - 0.05, STAIR_Y1, MEZZ_Z - 0.12)], 0.06, M['steel'], seg=12)
        tube('stair_rail', [(st1 - 0.02, STAIR_Y0 + 0.1, 0.95), (st1 - 0.02, STAIR_Y1, MEZZ_Z + 0.95)], 0.02, M['steel'])
        for i in range(0, n, 3):
            yb = STAIR_Y0 - run * (i + 0.5)
            z = rise * (i + 1)
            tube(f'stair_post{i}', [(st1 - 0.02, yb, z), (st1 - 0.02, yb, z + 0.95)], 0.012, M['steel'])
        # The rail's collider follows the slope in short runs, so you can still walk under the high end.
        for i in range(0, n, 4):
            yb, ya = STAIR_Y0 - run * i, STAIR_Y0 - run * min(n, i + 4)
            collider(f'stair_rail{i}', (st1 - 0.05, ya, rise * (i + 1)), (st1 + 0.02, yb, rise * min(n, i + 4) + 1.0), structure=True)

        # Bake light: the city and the moon through the glass, the skylight, a soft fill so no corner is black.
        area('L_glass', 1200, (W, H - 0.4), (W / 2, D - 0.1, H / 2), (math.radians(-90), 0, 0), (0.55, 0.66, 1.0))
        area('L_skylight', 260, (kc - ka, kd - kb), ((ka + kc) / 2, (kb + kd) / 2, H - 0.05), (0, 0, 0), (0.7, 0.8, 1.0))
        area('L_fill', 320, (W - 1, D - 1), (W / 2, D / 2, H - 0.4), (0, 0, 0), (0.72, 0.78, 1.0))
        area('L_under_mezz', 120, (c - 0.6, d - 0.4), (c / 2, d / 2, MEZZ_UNDER - 0.05), (0, 0, 0), (1.0, 0.82, 0.6))
