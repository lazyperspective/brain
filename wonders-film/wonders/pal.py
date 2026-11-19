"""Palette. Deliberately small: cream paper, warm black ink, blue pencil, a
handful of muted naturals and ONE signature accent (saffron) kept for heroes."""

PAPER = (241.0, 236.0, 224.0)
INK = (40.0, 35.0, 33.0)
PENCIL = (104.0, 140.0, 182.0)        # non-photo blue construction pencil

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

ACCENT = (250, 138, 22)         # saffron -- the one signature colour (hotter than the vivid sands so it still leads)
ACCENT_D = (222, 106, 14)
ACCENT_L = (255, 186, 84)

SKIN = [(244, 206, 174), (226, 172, 132), (186, 128, 92), (132, 88, 62), (250, 222, 196)]
HAIR = [(52, 42, 38), (96, 62, 40), (36, 34, 40), (176, 132, 70), (120, 120, 124)]
CLOTH = [(124, 160, 196), (236, 180, 172), (248, 244, 234), (112, 158, 108), (74, 66, 72),
         (212, 138, 106), (178, 160, 200), (126, 146, 172)]


# ---- vibrancy: every fill and coloured line passes through here once ------
import colorsys

VIVID = 1.75          # >1 pushes saturation; 1.0 = the original muted print
_KEEP = {PAPER, INK, PENCIL}
_vcache = {}


def vivid(c):
    """Push a colour toward a brighter, more saturated version of itself.
    Low saturations move proportionally more than high ones (so creams stay
    creams but greens, blues, sands and roofs sing); paper, ink and the
    construction pencil are left alone."""
    if c is None:
        return None
    c = (float(c[0]), float(c[1]), float(c[2]))
    k = _vcache.get(c)
    if k is None:
        if c in _KEEP or VIVID == 1.0:
            k = c
        else:
            h, s, v = colorsys.rgb_to_hsv(c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)
            s2 = 1.0 - (1.0 - s) ** VIVID
            if s < 0.10:                         # near-neutrals (marble, snow, stone): keep them clean
                s2 = s + (s2 - s) * (s / 0.10) ** 2
            v2 = v ** 0.94 if s > 0.12 else v
            r, g, b = colorsys.hsv_to_rgb(h, s2, v2)
            k = (r * 255.0, g * 255.0, b * 255.0)
        _vcache[c] = k
    return k


def mix(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def shade(c, f):
    return tuple(max(0, min(255, c[k] * f)) for k in range(3))
