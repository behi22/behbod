"""World-wide settings the page reads: where you start, the camera's rooms, the view outside, lights for the character."""
import math
from lib.core import META, char_light, zone, plane
from zones.layout import W, D, H, STUDIO_Z


def build(M, E, G):
    # You come in through the front door and face north, into the loft.
    META['points']['spawn'] = [2.5, 1.3, 0.0]
    META['spawn'] = {'facing': math.pi, 'yaw': 0.2, 'pitch': 0.28}
    # The camera stays inside whichever of these you are standing in (x0, y0, x1, y1, top).
    META['regions'] = [
        {'id': 'loft', 'min': [0.2, 0.2], 'max': [W - 0.2, D - 0.2], 'top': H - 0.2},
        {'id': 'balcony', 'min': [2.1, 12.2], 'max': [13.9, 14.4], 'top': 4.0},
        {'id': 'range', 'min': [4.8, -3.0], 'max': [15.4, -0.4], 'top': 2.8},
    ]
    META['spots'] = {'desk': META['points']['desk_use'], 'window': [3.7, 10.9, 0.0], 'lounge': [3.6, 7.0, -0.45]}
    META['window'] = {'center': [W / 2, D + 0.08, 3.0], 'w': W, 'h': H}
    META['gloss'] = {'center': [13.0, 1.9, STUDIO_Z + 0.004], 'w': 6.0, 'd': 3.4}
    with zone('outside', px=512):
        META['backdrop'] = {'center': [8.0, 40.0, 9.0], 'w': 90.0, 'h': 34.0}
        plane('backdrop', 90.0, 34.0, (8.0, 40.0, 9.0), E['sky'], '-Y')
    META['lights'] = [{'kind': 'hemi', 'sky': '#6d82c2', 'ground': '#2a1a12', 'power': 1.1},
                      {'kind': 'sun', 'color': '#9db2ff', 'power': 0.9, 'at': [8.0, 20.0, 9.0]}] + META['lights']
