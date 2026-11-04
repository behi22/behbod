"""The two galleries: project frames hanging on steel cables beside the stairs, so you climb past them on the way up,
and a screening wall of three video frames on the east wall that play when you walk up to them."""
from lib.core import zone, box, plane, tube, screen, interact, char_light, lamp, collider, META
from zones.layout import STAIRS, STAIR_Y0, STAIR_Y1, STAIR_N, MEZZ_Z, W

PROJECTS = ['meet-bex', 'profile-art', 'aic-voice-microsite', 'visitor-classifier', 'behbod']


def build(M, E, G):
    with zone('gallery', px=1024):
        # Project frames: double-sided, one face to the lounge, one to the stairs, rising with the steps.
        x = STAIRS[0] - 0.22
        run = (STAIR_Y0 - STAIR_Y1) / len(PROJECTS)
        for i, name in enumerate(PROJECTS):
            y = STAIR_Y0 - run * (i + 0.5)
            z = MEZZ_Z * (i + 0.5) / len(PROJECTS) + 1.45
            box(f'proj_frame{i}', (0.03, 0.66, 0.51), (x, y, z), M['frame'], bevel=0.004)
            plane(f'screen_proj{i}', 0.6, 0.45, (x - 0.017, y, z), M['paper'], '-X')
            plane(f'screen_proj{i}_b', 0.6, 0.45, (x + 0.017, y, z), M['paper'], '+X')
            screen(f'proj{i}', (x - 0.017, y, z), 0.6, 0.45, project=name)
            collider(f'proj_frame{i}', (x - 0.04, y - 0.33, z - 0.26), (x + 0.04, y + 0.33, z + 0.26))
            for s in (-1, 1):
                tube(f'proj_cable{i}{s}', [(x, y + s * 0.28, z + 0.255), (x, y + s * 0.28, 6.0)], 0.002, M['steel'])
        META['projects'] = PROJECTS
        interact('projects', 'See my projects', (x - 0.9, STAIR_Y0 - run * 1.5, 0), r=1.1)
        # The screening wall on the east wall: three 16:9 frames that play my videos.
        for i, y in enumerate((4.35, 5.4, 6.45)):
            box(f'video_frame{i}', (0.03, 0.88, 0.52), (W - 0.015, y, 1.7), M['frame'], bevel=0.004)
            plane(f'screen_video{i}', 0.8, 0.45, (W - 0.032, y, 1.7), E['screen'], '-X')
            screen(f'video{i}', (W - 0.032, y, 1.7), 0.8, 0.45, slot=i)
            interact(f'video{i}', 'Play this video', (W - 1.1, y, 0), r=0.7)
            box(f'video_lamp{i}', (0.06, 0.3, 0.03), (W - 0.06, y, 2.08), M['black'])
            box(f'video_lamp{i}_glow', (0.04, 0.26, 0.006), (W - 0.06, y, 2.062), E['warm_soft'], kind='emit')
        lamp('L_videos', 60, (W - 0.8, 5.4, 2.4), (1.0, 0.78, 0.55))
        char_light('point', '#ffc890', 1.2, (W - 1.0, 5.4, 2.2), 3.5)
        META['looks'] += [[W - 0.03, 5.4, 1.7]]
