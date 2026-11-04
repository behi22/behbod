"""The piano dais under the skylight, the records credenza with the turntable and lava lamp by the glass, the record
crate, the album-art poster wall and the wall screen with weather and the calendar."""
import math
import bpy
from mathutils import Vector
from lib.core import zone, box, cyl, sphere, plane, tube, prism, collider, point, screen, interact, char_light, area, lamp, potted, principled, META
from zones.layout import DAIS, DAIS_Z, W


def grand_outline(cx, cy, s=1.0):
    # The classic grand piano shape, keyboard side to the south (low y), the curved tail to the north.
    pts = [(-0.74, -0.75), (0.74, -0.75), (0.74, -0.2), (0.7, 0.25), (0.55, 0.6), (0.3, 0.8), (0.05, 0.88), (-0.2, 0.8),
           (-0.45, 0.55), (-0.62, 0.2), (-0.74, -0.1)]
    return [(cx + x * s, cy + y * s) for x, y in pts]


def build(M, E, G):
    M['lid_inside'] = principled('lid_inside', (0.25, 0.14, 0.07), 0.3)
    with zone('piano', px=2048):
        cx, cy, r1, r0 = DAIS
        z = DAIS_Z
        # The grand piano: body, lid propped open, keyboard, legs, pedals, bench.
        px, py = cx + 0.05, cy + 0.38
        prism('piano_body', grand_outline(px, py), z + 0.62, z + 0.98, M['piano'])
        prism('piano_lid', grand_outline(px, py), z + 0.98, z + 1.0, M['piano'])
        lift = math.tan(math.radians(32)) * 0.6
        for v in bpy.data.objects['piano_lid'].data.vertices:
            # Prop the lid open along the straight (east) side, like the real thing.
            d = v.co.x - (px - 0.74)
            v.co.z += d * lift
        tube('piano_prop', [(px + 0.3, py + 0.2, z + 0.98), (px + 0.33, py + 0.21, z + 0.99 + 1.04 * lift)], 0.008, M['brass'])
        box('piano_keybed', (1.48, 0.32, 0.12), (px, py - 0.9, z + 0.68), M['piano'], bevel=0.01)
        box('piano_keys', (1.36, 0.16, 0.025), (px, py - 0.96, z + 0.75), M['ivory'])
        for i in range(36):
            if i % 7 in (2, 6):
                continue
            box(f'piano_black{i}', (0.012, 0.09, 0.02), (px - 0.66 + i * 0.0377, py - 0.92, z + 0.772), M['piano'])
        box('piano_music_desk', (0.6, 0.02, 0.22), (px, py - 0.74, z + 0.94), M['piano'], tilt=(math.radians(-12), 0, 0))
        plane('screen_sheet', 0.42, 0.28, (px, py - 0.755, z + 0.96), M['paper'], '-Y')
        screen('sheet', (px, py - 0.755, z + 0.96), 0.42, 0.28, normal='-Y')
        for lx, ly in ((px - 0.65, py - 0.7), (px + 0.65, py - 0.7), (px + 0.1, py + 0.7)):
            cyl(f'piano_leg{lx:.1f}{ly:.1f}', 0.045, 0.62, (lx, ly, z + 0.31), M['piano'], r2=0.035)
        box('piano_pedals', (0.24, 0.12, 0.03), (px, py - 0.6, z + 0.05), M['brass'])
        box('piano_bench', (0.85, 0.36, 0.06), (px, py - 1.35, z + 0.5), M['piano'], bevel=0.01)
        box('piano_bench_cushion', (0.82, 0.33, 0.04), (px, py - 1.35, z + 0.55), M['leather'], bevel=0.015)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl(f'bench_leg{sx}{sy}', 0.022, 0.47, (px + sx * 0.37, py - 1.35 + sy * 0.14, z + 0.235), M['piano'])
        collider('piano', (px - 0.76, py - 1.07, z - 1), (px + 0.76, py + 1.05, z + 1.0))
        collider('piano_bench', (px - 0.43, py - 1.53, z - 1), (px + 0.43, py - 1.17, z + 0.57))
        # The piano lamp and the metronome on the lid's flat edge.
        cyl('pianolamp_base', 0.07, 0.02, (px + 0.55, py - 0.62, z + 0.99), M['brass'])
        tube('pianolamp_neck', [(px + 0.55, py - 0.62, z + 1.0), (px + 0.5, py - 0.66, z + 1.25), (px + 0.3, py - 0.72, z + 1.28)], 0.008, M['brass'])
        cyl('pianolamp_shade', 0.05, 0.12, (px + 0.26, py - 0.72, z + 1.26), M['brass'], axis='X', r2=0.035)
        sphere('pianolamp_glow', 0.025, (px + 0.24, py - 0.72, z + 1.245), E['warm'], sub=1, kind='emit')
        prism('metronome', [(px - 0.6, py - 0.64), (px - 0.52, py - 0.64), (px - 0.55, py - 0.58)], z + 0.98, z + 1.18, M['walnut'])
        tube('metronome_arm', [(px - 0.553, py - 0.64, z + 1.0), (px - 0.553, py - 0.645, z + 1.16)], 0.003, M['brass'], kind='emit')
        point('piano_seat', (px, py - 1.35, z))
        interact('piano', 'Play the piano', (px, py - 1.75, z), r=0.9, seat=[px, py - 1.3, z + 0.05], face=90)

        # The records credenza by the glass: cubbies of vinyl, the turntable, the lava lamp, speakers either side.
        RX, RY = 14.6, 11.42
        box('credenza', (1.6, 0.42, 0.62), (RX, RY, 0.31), M['walnut'], bevel=0.008)
        for i in range(4):
            box(f'cubby{i}', (0.36, 0.02, 0.5), (RX - 0.6 + i * 0.4, RY - 0.212, 0.31), M['black'])
            for k in range(9):
                box(f'vinyl{i}_{k}', (0.008, 0.3, 0.3), (RX - 0.74 + i * 0.4 + k * 0.032, RY - 0.05, 0.22), M[f'book{(i + k) % 4 + 1}'])
        collider('credenza', (RX - 0.8, RY - 0.21, -1), (RX + 0.8, RY + 0.21, 0.62))
        box('turntable', (0.44, 0.34, 0.08), (RX - 0.2, RY, 0.66), M['walnut'], bevel=0.01)
        cyl('platter', 0.15, 0.015, (RX - 0.24, RY, 0.71), M['metal'], seg=40, kind='emit')
        cyl('record', 0.148, 0.004, (RX - 0.24, RY, 0.72), M['vinyl'], seg=40, kind='emit')
        plane('screen_nowplaying', 0.1, 0.1, (RX - 0.24, RY, 0.7225), E['screen'], '+Z', kind='emit')
        screen('nowplaying', (RX - 0.24, RY, 0.7225), 0.1, 0.1, normal='+Z')
        tube('tonearm', [(RX - 0.02, RY + 0.12, 0.74), (RX - 0.05, RY + 0.02, 0.74), (RX - 0.17, RY - 0.05, 0.725)], 0.004, M['steel'])
        cyl('lava_base', 0.045, 0.09, (RX + 0.35, RY, 0.665), M['metal'], seg=24, r2=0.03)
        cyl('lava_glass', 0.03, 0.2, (RX + 0.35, RY, 0.81), E['warm_soft'], seg=24, r2=0.018, kind='emit')
        cyl('lava_cap', 0.018, 0.04, (RX + 0.35, RY, 0.93), M['metal'], seg=24, r2=0.012)
        for sx in (-1, 1):
            box(f'rec_speaker{sx}', (0.24, 0.26, 0.9), (RX + sx * 1.02, RY, 0.45), M['speaker'], bevel=0.01)
            for k, zz in enumerate((0.3, 0.62)):
                cyl(f'rec_cone{sx}_{k}', 0.08 if k == 0 else 0.03, 0.008, (RX + sx * 1.02, RY - 0.131, zz), M['cone'], axis='Y', seg=20)
            collider(f'rec_speaker{sx}', (RX + sx * 1.02 - 0.12, RY - 0.13, -1), (RX + sx * 1.02 + 0.12, RY + 0.13, 0.9))
        # Recently played, on a little screen by the speakers.
        box('recent_case', (0.26, 0.03, 0.18), (RX + 0.6, RY - 0.1, 0.74), M['black'], bevel=0.006, tilt=(math.radians(-10), 0, 0))
        plane('screen_recent', 0.24, 0.16, (RX + 0.6, RY - 0.118, 0.74), E['screen'], '-Y')
        screen('recent', (RX + 0.6, RY - 0.118, 0.74), 0.24, 0.16, normal='-Y')
        interact('records', 'Put on a record', (RX - 0.2, RY - 0.9, 0), r=0.9)
        # The record crate on the floor: my playlists to flip through.
        box('crate', (0.42, 0.36, 0.3), (13.25, 11.35, 0.15), M['oak'], bevel=0.006)
        for k in range(10):
            box(f'crate_rec{k}', (0.34, 0.008, 0.3), (13.25, 11.22 + k * 0.026, 0.2), M[f'book{k % 4 + 1}'], tilt=(math.radians(-8), 0, 0))
        collider('crate', (13.04, 11.17, -1), (13.46, 11.53, 0.32))
        interact('crate', 'Flip through my playlists', (13.25, 10.7, 0), r=0.8)

        # The album-art poster wall from my top tracks, and the wall screen with the weather and the calendar.
        for i in range(6):
            gx, gz = i % 3, i // 3
            box(f'album_frame{i}', (0.025, 0.56, 0.56), (W - 0.013, 9.6 + gx * 0.66, 1.55 + gz * 0.66), M['frame'], bevel=0.004)
        plane('screen_albums', 1.9, 1.24, (W - 0.028, 10.26, 1.88), E['screen'], '-X')
        screen('albums', (W - 0.028, 10.26, 1.88), 1.9, 1.24, grid=[3, 2])
        interact('albums', 'See what I have been playing', (15.0, 10.26, 0), r=1.0)
        box('wallscreen_back', (0.04, 1.44, 0.84), (W - 0.02, 8.2, 1.6), M['black'], bevel=0.008)
        plane('screen_wall', 1.36, 0.76, (W - 0.042, 8.2, 1.6), E['screen'], '-X')
        screen('wall', (W - 0.042, 8.2, 1.6), 1.36, 0.76)
        potted('piano_plant', (13.9, 6.3, 0), M, r=0.2, h=0.5, mat='pot', leaves=10, size=0.2)
        potted('glass_plant', (15.65, 6.6, 0), M, r=0.22, h=0.6, mat='pot_white', leaves=12, size=0.24)

        lamp('L_pianolamp', 30, (px + 0.25, py - 0.72, z + 1.22), (1.0, 0.75, 0.45), soft=0.05)
        lamp('L_records', 70, (RX, RY - 0.4, 1.4), (1.0, 0.7, 0.45))
        area('L_wallscreen', 25, (1.3, 0.7), (W - 0.08, 8.2, 1.6), (0, math.radians(90), 0), (0.6, 0.7, 1.0))
        char_light('point', '#b8c8ff', 1.8, (cx, cy, 3.2), 4.5)
        char_light('point', '#ffb070', 1.4, (RX, RY - 0.6, 1.2), 3.5)
        META['looks'] += [[px, py - 0.9, z + 0.75], [RX - 0.24, RY, 0.72], [W - 0.04, 8.2, 1.6]]
