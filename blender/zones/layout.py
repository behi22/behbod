"""The loft's plan, from map v2 (50 map units per metre). Blender axes: x east from the west wall, y north from the
south wall (y = 12 - the map's distance from the glass wall), z up. The glass wall faces north over the bay."""
W, D, H = 16.0, 12.0, 6.0
WALL = 0.2
# Floor levels.
PIT_Z, DAIS_Z, STUDIO_Z, MEZZ_Z = -0.45, 0.3, 0.45, 2.9
MEZZ_UNDER = 2.65
# Sunken lounge, piano dais, raised studio, mezzanine (x0, y0, x1, y1).
PIT = (1.0, 5.0, 7.0, 10.0)
PIT_STEPS = (6.4, 5.9, 7.0, 9.1)
DAIS = (12.0, 7.8, 1.6, 1.3)
STUDIO = (10.0, 0.0, 16.0, 3.5)
STUDIO_STEPS = (13.3, 3.0, 14.9, 3.5)
MEZZ = (0.0, 0.0, 9.8, 3.0)
# Floating stairs: 15 steps from the lounge level at y 7.5 up to the mezzanine edge at y 3.
STAIRS = (8.0, 8.9)
STAIR_Y0, STAIR_Y1, STAIR_N = 7.5, 3.0, 15
SKYLIGHT = (11.0, 6.8, 13.0, 8.8)
ENTRY = (0.0, 0.0, 4.5, 3.0)
FRONT_DOOR = (2.0, 3.0)
SECRET_DOOR = (6.6, 7.6)
SLIDING_DOOR = (7.0, 9.0)
BALCONY = (2.0, 12.0, 14.0, 14.5)
RANGE = (4.6, -3.2, 15.6, -0.2)
