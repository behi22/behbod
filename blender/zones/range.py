"""The range behind the bookshelf: a loadout room (the gun wall, the attachment bench, lockers, the vault door), the
firing line with its bench, a hall thirty metres deep with cover for the walkers and rails overhead, a wing behind a
row of fins down each side that the walkers come out of, and a narrow tunnel beyond the far wall for the long shots. Its light is baked like the house's, but without the surfaces' own
colour: the page draws those itself, with real materials (zone(..., lit=True))."""
import bpy, math
from lib.core import zone, box, cyl, plane, tube, collider, floor, point, interact, char_light, area, META, P
from zones.layout import RANGE, RANGE_LINE, RANGE_LOW, RANGE_HALL_H, RANGE_TUNNEL, RANGE_TUNNEL_H, SECRET_DOOR

LANES = 5
LANE_W = 2.4
WING = 1.4                                          # how far the hall's side walls sit behind its fins
FIN_STEP, FIN_FIRST, FIN_N = 2.4, 3.4, 11           # fins every 2.4 m downrange; the walkers' lanes are the gaps between
WALK_LANES = [round(FIN_FIRST + FIN_STEP * (k + 0.5), 1) for k in range(2, FIN_N - 1)]   # 9.4 ... 26.2
WALK_FROM = 1.5                                     # a walker starts this far outside the targets' half-width, inside a wing


def spot(name, power, loc, angle, colour=(0.85, 0.92, 1.0), blend=0.5, M=None, E=None, can=True):
    # A downlight: a cone of light in the bake, and a small can on the ceiling with a lit face.
    d = bpy.data.lights.new(name, 'SPOT')
    d.energy, d.spot_size, d.spot_blend, d.color, d.shadow_soft_size = power, math.radians(angle), blend, colour, 0.06
    o = bpy.data.objects.new(name, d)
    o.location = P(loc)
    bpy.context.scene.collection.objects.link(o)
    if can:
        cyl(name + '_can', 0.09, 0.16, (loc[0], loc[1], loc[2] + 0.1), M['r_dark'], seg=14)
        cyl(name + '_lens', 0.07, 0.012, (loc[0], loc[1], loc[2] + 0.012), E['range_white'], seg=14, kind='emit')


def build(M, E, G):
    with zone('range', px=4096, lit=True):
        x0, y0, x1, y1 = RANGE                      # the rooms' inside: west, far wall, east, the house wall's back
        cx, T = (x0 + x1) / 2, 0.2
        yb0, yb1 = RANGE_LINE - 0.3, RANGE_LINE + 0.3   # the bench across the firing line
        tx0, ty0, tx1, ty1 = RANGE_TUNNEL
        HL, HH, HT = RANGE_LOW, RANGE_HALL_H, RANGE_TUNNEL_H
        sa, sb = SECRET_DOOR
        lx0 = cx - LANES * LANE_W / 2               # the west edge of the first lane

        # Floors: the loadout room and the strip behind the bench are walked on; the hall and the tunnel are not.
        box('r_floor_load', (x1 - x0 + 2 * T, y1 - yb0 + T, 0.2), (cx, (y1 + yb0) / 2 + T / 2, -0.1), M['r_floor'])
        hw = x1 - x0 + 2 * (WING + T)                # the hall's width over its wings and walls
        box('r_floor_hall', (hw, yb0 - y0 + T, 0.2), (cx, (yb0 + y0) / 2 - T / 2, -0.1), M['r_floor'])
        box('r_floor_tunnel', (tx1 - tx0 + 2 * T, ty1 - ty0, 0.2), ((tx0 + tx1) / 2, (ty0 + ty1) / 2, -0.1), M['r_floor'])
        floor(x0, yb1, x1, y1 + 0.25, 0.0)

        # Walls. The house's own wall is lined on this side, with the bookcase door's opening left clear.
        for name, x, s in (('w', x0, -1), ('e', x1, 1)):
            box(f'r_wall_load_{name}', (T, y1 - yb0, HL), (x + s * T / 2, (y1 + yb0) / 2, HL / 2), M['r_wall'])
            box(f'r_wall_hall_{name}', (T, yb0 - y0, HH), (x + s * (WING + T / 2), (yb0 + y0) / 2, HH / 2), M['r_panel'])
            # The wing's end at the firing line, beside the loadout room's wall.
            box(f'r_wing_end_{name}', (WING + T, T, HH), (x + s * (WING + T) / 2, yb0 - T / 2, HH / 2), M['r_panel'])
        for name, (u0, u1) in {'w': (x0, sa), 'e': (sb, x1)}.items():
            box(f'r_liner_{name}', (u1 - u0, 0.05, HL), ((u0 + u1) / 2, y1 - 0.025, HL / 2), M['r_wall'])
        box('r_liner_head', (sb - sa, 0.05, HL - 2.1), ((sa + sb) / 2, y1 - 0.025, 2.1 + (HL - 2.1) / 2), M['r_wall'])
        box('r_ceiling_load', (x1 - x0 + 2 * T, y1 - yb0, 0.2), (cx, (y1 + yb0) / 2, HL + 0.1), M['r_wall'])
        # The low ceiling ends at the bench; a header closes the step up to the hall's height.
        box('r_header', (x1 - x0 + 2 * T, T, HH - HL), (cx, yb0 + T / 2, HL + (HH - HL) / 2), M['r_wall'])
        box('r_ceiling_hall', (hw, yb0 - y0 + T, 0.2), (cx, (yb0 + y0) / 2 - T / 2, HH + 0.1), M['r_panel'])
        for name, (u0, u1) in {'w': (cx - hw / 2, tx0), 'e': (tx1, cx + hw / 2)}.items():
            box(f'r_far_{name}', (u1 - u0, T, HH), ((u0 + u1) / 2, y0 - T / 2, HH / 2), M['r_wall'])
        box('r_far_head', (tx1 - tx0, T, HH - HT), ((tx0 + tx1) / 2, y0 - T / 2, HT + (HH - HT) / 2), M['r_wall'])
        for name, x in (('w', tx0 - T / 2), ('e', tx1 + T / 2)):
            box(f'r_tunnel_{name}', (T, ty1 - ty0, HT), (x, (ty0 + ty1) / 2, HT / 2), M['r_wall'])
        box('r_tunnel_ceiling', (tx1 - tx0 + 2 * T, ty1 - ty0, 0.2), ((tx0 + tx1) / 2, (ty0 + ty1) / 2, HT + 0.1), M['r_panel'])
        box('r_tunnel_end', (tx1 - tx0 + 2 * T, T, HT), ((tx0 + tx1) / 2, ty0 - T / 2, HT / 2), M['r_rubber'])
        collider('range_wall_w', (x0 - 1, yb0, -1), (x0, y1, HL), structure=True)
        collider('range_wall_e', (x1, yb0, -1), (x1 + 1, y1, HL), structure=True)

        # The firing line: a bench right across, low plates between the lanes, a pillar at each end.
        box('r_bench', (LANES * LANE_W, yb1 - yb0, 1.05), (cx, RANGE_LINE, 0.525), M['r_dark'], bevel=0.01)
        box('r_bench_mat', (LANES * LANE_W - 0.1, yb1 - yb0 - 0.1, 0.012), (cx, RANGE_LINE, 1.056), M['r_rubber'])
        for k in range(LANES + 1):
            box(f'r_lane_plate{k}', (0.02, 0.5, 0.2), (lx0 + k * LANE_W, RANGE_LINE, 1.16), M['r_steel'], bevel=0.004)
        for name, (u0, u1) in {'w': (x0, lx0), 'e': (lx0 + LANES * LANE_W, x1)}.items():
            box(f'r_pillar_{name}', (u1 - u0, yb1 - yb0, HL), ((u0 + u1) / 2, RANGE_LINE, HL / 2), M['r_wall'])
        box('r_bench_live', (LANES * LANE_W - 0.2, 0.012, 0.012), (cx, yb1 + 0.006, 1.03), E['onair'], kind='emit')
        collider('range_bench', (x0, yb0, -1), (x1, yb1, HL), structure=True)
        # Where you stand to shoot, marked on the floor: a yellow line and the lane numbers' places.
        box('r_stand_line', (LANES * LANE_W, 0.08, 0.006), (cx, yb1 + 0.75, 0.003), M['r_yellow'])
        for k in range(LANES):
            box(f'r_lane_mark{k}', (0.5, 0.3, 0.006), (lx0 + (k + 0.5) * LANE_W, yb1 + 1.05, 0.003), M['r_line'])
        point('range_stand', (cx, yb1 + 0.25, 0))
        interact('range', 'Step up to the firing line', (cx, yb1 + 0.75, 0), r=1.2)

        # The gun wall on the west side: a slatted panel with five mounts, each lit from below. The guns are hung on
        # it by the page.
        gy0, gy1 = y1 - 1.0, y1 - 5.4
        box('r_gunwall', (0.05, gy0 - gy1, 1.9), (x0 + 0.025, (gy0 + gy1) / 2, 1.45), M['r_panel'])
        for i in range(9):
            box(f'r_gunwall_slat{i}', (0.02, gy0 - gy1, 0.03), (x0 + 0.06, (gy0 + gy1) / 2, 0.6 + i * 0.2), M['r_steel'])
        mounts = []
        for i in range(5):
            gy = gy0 - 0.45 - i * (gy0 - gy1 - 0.9) / 4
            box(f'r_mount{i}', (0.05, 0.66, 0.03), (x0 + 0.08, gy, 1.3), M['r_dark'], bevel=0.004)
            box(f'r_mount_light{i}', (0.012, 0.6, 0.012), (x0 + 0.11, gy, 1.318), E['rgb_teal'], kind='emit')
            box(f'r_mount_tag{i}', (0.006, 0.22, 0.06), (x0 + 0.055, gy, 1.16), M['r_steel'])
            mounts.append([round(x0 + 0.14, 3), round(gy, 3), 1.52])
        box('r_gunwall_shelf', (0.42, gy0 - gy1, 0.04), (x0 + 0.21, (gy0 + gy1) / 2, 0.86), M['r_dark'], bevel=0.006)
        box('r_gunwall_base', (0.4, gy0 - gy1, 0.84), (x0 + 0.2, (gy0 + gy1) / 2, 0.42), M['r_dark'], bevel=0.006)
        collider('range_gunwall', (x0, gy1, -1), (x0 + 0.42, gy0, 0.9))
        interact('loadout', 'Choose a gun and what goes on it', (x0 + 1.1, (gy0 + gy1) / 2, 0), r=1.3)

        # The attachment bench on the house wall, east of the door: a worktop on drawers, a pegboard, a lamp, a vice.
        bx0, bx1 = sb + 1.4, sb + 4.8
        box('r_work_top', (bx1 - bx0, 0.62, 0.05), ((bx0 + bx1) / 2, y1 - 0.36, 0.905), M['r_bench'], bevel=0.006)
        for i, u in enumerate((bx0 + 0.35, bx1 - 0.35)):
            box(f'r_work_unit{i}', (0.66, 0.56, 0.88), (u, y1 - 0.36, 0.44), M['r_dark'], bevel=0.006)
            for d in range(3):
                box(f'r_work_pull{i}{d}', (0.3, 0.012, 0.012), (u, y1 - 0.65, 0.2 + d * 0.27), M['r_steel'])
        box('r_pegboard', (bx1 - bx0, 0.02, 0.9), ((bx0 + bx1) / 2, y1 - 0.065, 1.6), M['r_panel'])
        for i in range(7):
            box(f'r_peg_tool{i}', (0.04 + (i % 3) * 0.03, 0.02, 0.16 + (i % 2) * 0.1), (bx0 + 0.3 + i * 0.42, y1 - 0.085, 1.5 + (i % 3) * 0.1), M['r_steel'])
        box('r_vice_base', (0.14, 0.12, 0.06), (bx0 + 0.9, y1 - 0.5, 0.96), M['r_steel'], bevel=0.006)
        box('r_vice_jaw', (0.1, 0.16, 0.07), (bx0 + 0.9, y1 - 0.5, 1.025), M['r_steel'], bevel=0.006)
        for i, c in enumerate(('r_yellow', 'r_crate', 'r_steel', 'r_yellow')):
            box(f'r_bin{i}', (0.16, 0.12, 0.08), (bx1 - 1.3 + i * 0.2, y1 - 0.18, 0.97), M[c], bevel=0.004)
        tube('r_lamp_arm', [(bx0 + 1.9, y1 - 0.12, 0.93), (bx0 + 1.9, y1 - 0.14, 1.32), (bx0 + 1.75, y1 - 0.42, 1.42)], 0.008, M['r_dark'])
        cyl('r_lamp_head', 0.05, 0.05, (bx0 + 1.75, y1 - 0.44, 1.4), M['r_dark'], seg=16, r2=0.035)
        cyl('r_lamp_bulb', 0.03, 0.01, (bx0 + 1.75, y1 - 0.44, 1.372), E['warm'], seg=12, kind='emit')
        collider('range_workbench', (bx0, y1 - 0.68, -1), (bx1, y1 - 0.06, 0.95))
        point('range_workbench', ((bx0 + bx1) / 2, y1 - 0.36, 0.93))

        # Lockers on the east wall, ammo crates beside them, spare steel plates leaning by the line, the vault door.
        for i in range(4):
            ly = y1 - 0.75 - i * 0.56
            box(f'r_locker{i}', (0.46, 0.52, 1.9), (x1 - 0.23, ly, 0.95), M['r_steel'], bevel=0.006)
            box(f'r_locker_vent{i}', (0.006, 0.3, 0.1), (x1 - 0.462, ly, 1.6), M['r_dark'])
            box(f'r_locker_pull{i}', (0.012, 0.02, 0.1), (x1 - 0.47, ly - 0.18, 1.0), M['r_dark'])
        collider('range_lockers', (x1 - 0.48, y1 - 2.75, -1), (x1, y1 - 0.45, 1.9))
        for i, (ax, ay, az) in enumerate(((x1 - 0.5, yb1 + 0.5, 0.17), (x1 - 0.5, yb1 + 1.1, 0.17), (x1 - 0.5, yb1 + 0.8, 0.51))):
            box(f'r_crate{i}', (0.7, 0.5, 0.34), (ax, ay, az), M['r_crate'], bevel=0.008, rot=0.06 * (i - 1))
            box(f'r_crate_band{i}', (0.72, 0.06, 0.345), (ax, ay, az), M['r_dark'], rot=0.06 * (i - 1))
        collider('range_crates', (x1 - 0.9, yb1 + 0.2, -1), (x1, yb1 + 1.4, 0.7))
        for i in range(3):
            box(f'r_spare_plate{i}', (0.5, 0.012, 0.5), (x0 + 0.55 + i * 0.03, yb1 + 0.45 + i * 0.05, 0.27), M['r_steel'], tilt=(math.radians(-14 - 3 * i), 0, 0))
        vy = y1 - 4.2                               # on the east wall, between the lockers and the crates
        box('vault_door', (0.05, 1.0, 2.1), (x1 - 0.025, vy, 1.05), M['r_steel'], bevel=0.01)
        box('vault_lock', (0.03, 0.1, 0.16), (x1 - 0.06, vy + 0.4, 1.1), E['onair'], kind='emit')
        point('secret_room', (x1 - 0.4, vy, 0))
        interact('secret_room', 'A locked door', (x1 - 0.9, vy, 0), r=0.5)

        # The stage board: a kiosk by the line that the page draws on.
        kx, ky = cx + 3.6, yb1 + 1.5
        box('r_kiosk_post', (0.08, 0.08, 1.1), (kx, ky, 0.55), M['r_dark'])
        box('r_kiosk_foot', (0.4, 0.3, 0.03), (kx, ky, 0.015), M['r_dark'], bevel=0.004)
        box('r_kiosk_case', (0.74, 0.05, 0.46), (kx, ky, 1.28), M['r_dark'], bevel=0.008)
        plane('rscreen_board', 0.68, 0.4, (kx, ky + 0.028, 1.287), E['screen'], '+Y')
        collider('range_kiosk', (kx - 0.37, ky - 0.15, -1), (kx + 0.37, ky + 0.15, 1.5))

        # Loadout room light: two rows of panels in the ceiling.
        for r_, ly in enumerate((y1 - 1.7, y1 - 4.6)):
            for i in range(3):
                box(f'r_load_light{r_}{i}', (1.5, 0.32, 0.02), (x0 + 2.6 + i * 4.0, ly, HL - 0.04), E['range_panel'], kind='emit')
                box(f'r_load_light_case{r_}{i}', (1.62, 0.44, 0.03), (x0 + 2.6 + i * 4.0, ly, HL - 0.015), M['r_dark'])
                area(f'L_range_load{r_}{i}', 150, (1.5, 0.32), (x0 + 2.6 + i * 4.0, ly, HL - 0.06), (0, 0, 0), (1.0, 0.92, 0.82))
        # A wash down the gun wall from a slot above it, and the workbench under its lamp.
        box('r_gunwall_wash', (0.03, gy0 - gy1 - 0.3, 0.03), (x0 + 0.3, (gy0 + gy1) / 2, 2.52), E['range_white'], kind='emit')
        box('r_gunwall_hood', (0.36, gy0 - gy1, 0.05), (x0 + 0.18, (gy0 + gy1) / 2, 2.56), M['r_dark'])
        spot('L_range_workbench', 300, (bx0 + 1.75, y1 - 0.44, 1.36), 110, (1.0, 0.72, 0.42), can=False)

        # The hall: light strips across the ceiling, a carrier rail down each lane, baffles on the side walls, lane
        # lines and distance lines on the floor.
        for i in range(6):
            sy = yb0 - 3.0 - i * 5.0
            box(f'r_strip{i}', (LANES * LANE_W - 1.0, 0.16, 0.03), (cx, sy, HH - 0.055), E['range_white'], kind='emit')
            box(f'r_strip_case{i}', (LANES * LANE_W - 0.8, 0.3, 0.04), (cx, sy, HH - 0.02), M['r_dark'])
            area(f'L_range_strip{i}', 800, (LANES * LANE_W - 1.0, 0.3), (cx, sy, HH - 0.09), (0, 0, 0), (0.8, 0.88, 1.0))
        for k in range(LANES):
            rx = lx0 + (k + 0.5) * LANE_W
            box(f'r_rail{k}', (0.07, yb0 - y0 - 1.6, 0.1), (rx, (yb0 + y0) / 2, HH - 0.55), M['r_steel'])
            for j in range(6):
                box(f'r_rail_hanger{k}{j}', (0.03, 0.03, 0.5), (rx, yb0 - 2.0 - j * 5.0, HH - 0.25), M['r_steel'])
        # Down each side, a row of fins set like the slats of a blind: from the line they hide the wing behind them,
        # and the walkers step out through the gaps. A beam runs over the fins with a line of light under it.
        FH = 3.4
        for name, x, s in (('w', x0, -1), ('e', x1, 1)):
            for i in range(FIN_N):
                box(f'r_fin_{name}{i}', (0.12, 1.4, FH), (x + s * 0.27, RANGE_LINE - FIN_FIRST - i * FIN_STEP, FH / 2), M['r_wall'], rot=-s * 0.32, bevel=0.012)
            box(f'r_beam_{name}', (0.5, yb0 - y0, HH - FH), (x + s * 0.27, (yb0 + y0) / 2, FH + (HH - FH) / 2), M['r_panel'])
            box(f'r_beam_light_{name}', (0.03, yb0 - y0 - 1.0, 0.03), (x - s * 0.0, (yb0 + y0) / 2, FH - 0.015), E['rgb_teal'], kind='emit')
            # A dim strip low on the wing's wall, so a walker waiting there shows as a shape against it.
            box(f'r_wing_light_{name}', (0.02, yb0 - y0 - 2.0, 0.05), (x + s * (WING - 0.012), (yb0 + y0) / 2, 0.3), E['onair'], kind='emit')
        for k in range(LANES + 1):
            box(f'r_lane_line{k}', (0.06, yb0 - y0 - 1.2, 0.006), (lx0 + k * LANE_W, (yb0 + y0) / 2 - 0.2, 0.003), M['r_line'])
        for d in (5, 10, 15, 20, 25):
            box(f'r_dist_line{d}', (LANES * LANE_W, 0.06, 0.006), (cx, RANGE_LINE - d, 0.003), M['r_yellow' if d % 10 == 0 else 'r_line'])
        # Cover for the walkers: low concrete barriers at four depths.
        cover = []
        # Each stands just in front of a walkers' lane: a walker in that lane passes behind it, legs hidden.
        for i, (bx, lane) in enumerate(((-3.6, 0), (2.8, 0), (-0.4, 2), (4.2, 2), (-4.4, 4), (1.6, 4), (-2.0, 6), (3.8, 6))):
            d = WALK_LANES[lane] - 0.9
            by = RANGE_LINE - d
            box(f'r_cover{i}', (2.2, 0.5, 0.95), (cx + bx, by, 0.475), M['r_wall'], bevel=0.03, seg=2)
            box(f'r_cover_cap{i}', (2.22, 0.52, 0.06), (cx + bx, by, 0.95), M['r_yellow'], bevel=0.006)
            cover.append([round(cx + bx, 2), round(by, 2), 2.2, 0.5, 0.98])
        # The backstop: a sloped steel plate over a rubber berm either side of the tunnel's mouth, which is framed in light.
        for name, (u0, u1) in {'w': (x0, tx0 - 0.15), 'e': (tx1 + 0.15, x1)}.items():
            box(f'r_backstop_{name}', (u1 - u0, 0.12, 4.2), ((u0 + u1) / 2, y0 + 0.75, 1.95), M['r_steel'], tilt=(math.radians(-20), 0, 0))
            box(f'r_berm_{name}', (u1 - u0, 1.2, 0.5), ((u0 + u1) / 2, y0 + 0.6, 0.25), M['r_rubber'], bevel=0.05, seg=2)
        for name, size, c in (('w', (0.05, 0.05, HT), (tx0 - 0.03, y0 + 0.03, HT / 2)), ('e', (0.05, 0.05, HT), (tx1 + 0.03, y0 + 0.03, HT / 2)),
                              ('t', (tx1 - tx0 + 0.1, 0.05, 0.05), ((tx0 + tx1) / 2, y0 + 0.03, HT + 0.03))):
            box(f'r_portal_{name}', size, c, E['rgb_teal'], kind='emit')
        for i, (bx, by, _w, _d, _h) in enumerate(cover):
            spot(f'L_range_cover{i}', 2600, (bx, by + 0.9, HH - 0.2), 46, M=M, E=E)
        for k in range(LANES):
            spot(f'L_range_line{k}', 1500, (lx0 + (k + 0.5) * LANE_W, RANGE_LINE - 0.9, HH - 0.2), 50, (1.0, 0.9, 0.78), M=M, E=E)
        for name, u in (('w', (x0 + tx0) / 2), ('e', (tx1 + x1) / 2)):
            for j in (-1.6, 1.6):
                spot(f'L_range_back_{name}{j > 0:d}', 5000, (u + j, y0 + 2.6, HH - 0.2), 60, M=M, E=E)

        # The tunnel: a frame of light every six metres, so its length reads at a glance, and a line down the middle.
        ty = y0 - 3.0
        i = 0
        while ty > ty0 + 1.0:
            for name, size, c in (('w', (0.03, 0.05, HT - 0.1), (tx0 + 0.02, ty, HT / 2)), ('e', (0.03, 0.05, HT - 0.1), (tx1 - 0.02, ty, HT / 2)),
                                  ('t', (tx1 - tx0 - 0.06, 0.05, 0.03), ((tx0 + tx1) / 2, ty, HT - 0.02))):
                box(f'r_ring{i}_{name}', size, c, E['range_white' if i % 2 == 0 else 'rgb_teal'], kind='emit')
            ty -= 6.0
            i += 1
        box('r_tunnel_line', (0.06, ty1 - ty0 - 1.0, 0.006), ((tx0 + tx1) / 2, (ty0 + ty1) / 2, 0.003), M['r_yellow'])

        # Light for what the page lights itself (the character, the guns, the targets).
        char_light('point', '#ffe9d2', 2.4, (cx, (y1 + yb1) / 2, HL - 0.4), 10.0)

        # What the game needs to know: where the line is, how far you may step along it, how wide and deep the hall
        # and the tunnel are, where the cover stands, where the guns hang.
        META['range'] = {
            'line': [cx, RANGE_LINE], 'stand': [cx, round(yb1 + 0.25, 3), 0.0], 'strafe': [round(lx0 + 0.5, 2), round(lx0 + LANES * LANE_W - 0.5, 2)],
            'bench': 1.07, 'half': round(LANES * LANE_W / 2 - 0.4, 2), 'far': round(RANGE_LINE - y0, 2), 'height': HH,
            'tunnel': {'half': round((tx1 - tx0) / 2, 2), 'from': round(RANGE_LINE - ty1, 2), 'to': round(RANGE_LINE - ty0, 2), 'height': HT},
            'cover': cover, 'mounts': mounts, 'lanes': WALK_LANES, 'wing': WALK_FROM,
            # The hall as a box, wings included: the page bends its reflections to fit it.
            'box': [[round(x0 - WING, 2), y0, 0.0], [round(x1 + WING, 2), round(yb0, 2), HH]],
        }
        META['looks'] += [[x0 + 0.2, (gy0 + gy1) / 2, 1.5]]
