"""Palette. Deliberately small: cream paper, warm black ink, blue pencil, a
handful of muted naturals and ONE signature accent (saffron) kept for heroes."""

PAPER = (241, 236, 224)
INK = (40, 35, 33)
PENCIL = (104, 140, 182)        # non-photo blue construction pencil

WATER = (164, 207, 229)
WATER_D = (124, 180, 215)
WATER_L = (205, 230, 240)
DEEP = (96, 152, 194)
FOAM = (251, 251, 247)

GRASS = (178, 204, 148)
GRASS_D = (148, 182, 124)
FOREST = (112, 158, 108)
JUNGLE = (84, 136, 98)

SAND = (237, 223, 188)
SAND_D = (221, 201, 156)
DUNE = (229, 210, 168)

STONE = (216, 209, 196)
STONE_D = (188, 180, 164)
ROCK = (184, 180, 188)
ROCK_D = (156, 152, 168)
SNOW = (253, 252, 248)
ICE = (216, 233, 241)

EARTH = (206, 183, 149)
EARTH_D = (181, 157, 124)
MARBLE = (249, 246, 238)
MARBLE_D = (228, 224, 214)

TERRA = (212, 138, 106)
TERRA_D = (184, 112, 86)
ROSE = (236, 180, 172)
BLOSSOM = (243, 192, 202)
ZINC = (126, 146, 172)
WOOD = (158, 122, 92)
DARK = (74, 66, 72)

ACCENT = (243, 158, 30)         # saffron -- the one signature colour
ACCENT_D = (214, 126, 22)
ACCENT_L = (250, 198, 104)

SKIN = [(244, 206, 174), (226, 172, 132), (186, 128, 92), (132, 88, 62), (250, 222, 196)]
HAIR = [(52, 42, 38), (96, 62, 40), (36, 34, 40), (176, 132, 70), (120, 120, 124)]
CLOTH = [(124, 160, 196), (236, 180, 172), (248, 244, 234), (112, 158, 108), (74, 66, 72),
         (212, 138, 106), (178, 160, 200), (126, 146, 172)]


def mix(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def shade(c, f):
    return tuple(max(0, min(255, c[k] * f)) for k in range(3))
