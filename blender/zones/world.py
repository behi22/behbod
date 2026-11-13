"""World-wide settings the page reads: where you start, the camera's rooms, the view outside, lights for the character."""
import math
from lib.core import META, zone, plane
from zones.layout import W, D, H, STUDIO_Z, BALCONY, RANGE, RANGE_LINE, RANGE_LOW, FRONT_DOOR


def build(M, E, G):
    # You come in through the front door and face north, into the loft.
    META['points']['spawn'] = [(FRONT_DOOR[0] + FRONT_DOOR[1]) / 2, 1.2, 0.0]
    META['spawn'] = {'facing': math.pi, 'yaw': 0.15, 'pitch': 0.28}
    bx0, by0, bx1, by1 = BALCONY
    rx0, ry0, rx1, ry1 = RANGE
    # The camera stays inside whichever of these you are standing in.
    META['regions'] = [
        {'id': 'loft', 'min': [0.2, 0.2], 'max': [W - 0.2, D - 0.2], 'top': H - 0.25},
        {'id': 'balcony', 'min': [bx0 + 0.1, by0 + 0.2], 'max': [bx1 - 0.1, by1 - 0.1], 'top': 4.5},
        # The range's loadout room, from the bench across the firing line back to the house wall.
        {'id': 'range', 'min': [rx0 + 0.15, RANGE_LINE + 0.45], 'max': [rx1 - 0.15, ry1 - 0.15], 'top': RANGE_LOW - 0.25},
    ]
    META['spots'] = {'desk': META['points']['desk_use'], 'window': [5.1, 13.7, 0.0], 'lounge': [7.0, 10.2, -0.45]}
    META['window'] = {'center': [W / 2, D + 0.08, H / 2], 'w': W, 'h': H}
    META['gloss'] = {'center': [16.7, 3.0, STUDIO_Z + 0.004], 'w': 10.4, 'd': 5.8}
    with zone('outside', px=512):
        META['backdrop'] = {'center': [W / 2, 70.0, 14.0], 'w': 160.0, 'h': 60.0}
        plane('backdrop', 160.0, 60.0, (W / 2, 70.0, 14.0), E['sky'], '-Y')
    META['lights'] = [{'kind': 'hemi', 'sky': '#6d82c2', 'ground': '#2a1a12', 'power': 1.1},
                      {'kind': 'sun', 'color': '#9db2ff', 'power': 0.9, 'at': [W / 2, 30.0, 12.0]}] + META['lights']
