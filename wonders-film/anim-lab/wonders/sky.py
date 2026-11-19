"""The dream around the map: a great sun behind Everest, clouds threading between the slabs, a whale
and paper cranes gliding through the sky, and small floating islets, each with a tree and a lone figure."""
import math
import random

import numpy as np

from . import ease
from .core import smooth_poly, ZS
from .pal import *  # noqa
from . import props as pr
from . import extras as ex
from .props import person, tree

TAU = 2 * math.pi
SUN = (252.0, -150.0, 54.0)


def to_ij(x, y):
    """map px centre -> the (i, j) a small tile needs so that its middle sits there"""
    X = (x / 100.0 + y / 50.0) / 2.0
    Y = (y / 50.0 - x / 100.0) / 2.0
    return (X - 0.5) / 1.1, (Y - 0.5) / 1.1


def to_uv(x, y):
    return (x / 100.0 + y / 50.0) / 2.0, (y / 50.0 - x / 100.0) / 2.0


ISLETS = {
    'islet_a': to_ij(-72.0, 246.0),      # under the reef: cherry tree, a child with a kite
    'islet_b': to_ij(388.0, 206.0),      # beyond the Opera House: a little lighthouse
    'islet_c': to_ij(-394.0, 194.0),     # west of Machu Picchu: a birch, a shepherd, two sheep
    'islet_d': to_ij(-368.0, -14.0),     # off Niagara: a fir and an angler fishing into the void
    'islet_e': to_ij(388.0, -34.0),      # east of Fuji: bamboo and a stone lantern
}


# ------------------------------------------------------------------ sun ----
def sky_lo(T):
    x, y, r = SUN
    C = np.array([x, y])
    disc = [(r * math.cos(q), r * math.sin(q)) for q in np.linspace(0, TAU, 56)[:-1]]
    with T.st('flora'):
        with T.grp('grow', t0=0.15, dur=0.9, pivot=C, stage='flora'):
            T.poly2(C, disc, (255, 244, 214), 0.5, wob=0.25)
            T.poly2(C, [(0.82 * a, 0.82 * b) for a, b in disc], (255, 236, 190), 0, wob=0.2)
            T.poly2(C, [(0.6 * a, 0.6 * b) for a, b in disc], (255, 226, 166), 0, wob=0.2)
    AL = vivid(ACCENT_L)

    def rays(c, tau, t, a, R):
        g = (tau - 0.5) / 0.6
        if g <= 0:
            return
        g = min(1.0, g)
        R.ps.setStrokeWidth(0.5)
        for k in range(28):
            ang = k * TAU / 28 + t * 0.045
            L = (5.0 if k % 2 else 9.0) * g * (0.85 + 0.15 * math.sin(t * 1.3 + k))
            r0 = r + 3.5
            R.ps.setColor(skia_argb(AL, a * g))
            c.drawLine(float(x + r0 * math.cos(ang)), float(y + r0 * math.sin(ang)), float(x + (r0 + L) * math.cos(ang)), float(y + (r0 + L) * math.sin(ang)), R.ps)
    T.custom(rays, [C + np.array([-r - 16, -r - 16]), C + np.array([r + 16, r + 16])], stage='flora')
    # birds crossing the disc
    u_, v_ = to_uv(x - 8, y - 6)
    for k in range(5):
        pr.bird(T, u_, v_, 0, 0.9, c=(120, 96, 80), orbit=(30, 10), speed=0.5, ph=1.0 - k * 0.22, t0=0.9)


def skia_argb(c, a):
    import skia
    return skia.ColorSetARGB(int(max(0.0, min(1.0, a)) * 255), int(c[0]), int(c[1]), int(c[2]))


# ------------------------------------------------- clouds between the tiles ----
def big_cloud(T, x, y, s=1.0, t0=None, drift=22.0, speed=0.35):
    C = np.array([x, y])
    r = T.rng
    puffs = [(-13, 1.5, 5.0), (-7, -2.2, 6.8), (1, -3.6, 8.0), (9, -1.6, 6.4), (15, 1.4, 4.6), (2, 2.0, 7.0), (-5, 2.4, 6.0), (-19, 2.8, 3.2)]
    ph = r.uniform(0, 6.28)

    def mo(t, age, ph_):
        return (drift * math.sin(t * 0.21 * speed + ph), 1.4 * math.sin(t * 0.5 + ph * 2))
    mo.reach = drift + 30
    edge = (150, 172, 200)
    with T.st('sky'):
        with T.grp('condense', t0=t0, dur=0.6, pivot=C, off=(r.uniform(-20, 20), -10), motion=mo, stage='sky'):
            for (px, py, rr) in puffs:
                T.ell2(C + np.array([px, py]) * s, rr * s, rr * 0.8 * s, fill=None, ink=0.8, inkc=edge, n=16, wob=0)
            for (px, py, rr) in puffs:
                T.ell2(C + np.array([px, py]) * s, rr * s, rr * 0.8 * s, fill=SNOW, ink=0, n=16, wob=0)
            T.lines2(C, [[(-9 * s, 3.0 * s), (-2 * s, 3.6 * s)], [(3 * s, 2.6 * s), (10 * s, 3.0 * s)]], 0.3, edge, wob=0)


def sky_mid(T):
    big_cloud(T, 112.0, 46.0, 0.8, t0=0.2, drift=16)          # drifts behind the Taj's dome
    big_cloud(T, 16.0, 106.0, 0.62, t0=0.35, drift=14)        # in the notch between Rio, the reef and the Taj
    big_cloud(T, -108.0, 158.0, 0.7, t0=0.5, drift=18)        # slides under Rio toward Machu Picchu


# ------------------------------------------------------ whale and cranes ----
def sky_whale(T, x, y, s=1.0, t0=0.3):
    C = np.array([x, y])
    BODY = (150, 196, 232)

    def mo(t, age, ph):
        return (9.0 * math.sin(t * 0.16) + 3.0 * math.sin(t * 0.41), 4.0 * math.sin(t * 0.33 + 1), 2.5 * math.sin(t * 0.33 + 1.6), 1.0, 1.0)
    mo.reach = 40

    def P_(pts):
        return [(a * s, b * s) for a, b in pts]
    with T.st('sky'):
        with T.grp('drift', t0=t0, dur=1.4, pivot=C, off=(-70, -16), motion=mo, stage='sky'):
            # tail: beats slowly (its own group would tear the outline, so it flexes with the body's roll)
            T.poly2(C, smooth_poly(P_([(-24, -1), (-33, -9), (-36, -6), (-31, -1), (-36, 5), (-33, 7), (-24, 2)]), 1), BODY, 0.5, wob=0)
            T.poly2(C, smooth_poly(P_([(-26, -2), (-16, -8), (-2, -11), (12, -10), (24, -5), (29, 1), (26, 6), (14, 9), (0, 9), (-14, 6), (-26, 2)]), 2), BODY, 0.55, wob=0)
            T.poly2(C, smooth_poly(P_([(-18, 5), (-6, 8.2), (8, 9), (20, 7.4), (27.5, 3.4), (16, 4), (2, 5), (-10, 4)]), 1), MARBLE, 0.3, wob=0)
            T.lines2(C, [P_([(-8 + k * 5.0, 5.2), (-7 + k * 5.0, 8.0)]) for k in range(6)], 0.24, (150, 172, 200), wob=0)
            T.poly2(C, smooth_poly(P_([(6, 6), (2, 15), (12, 9)]), 1), shade(BODY, 0.9), 0.4, wob=0)
            T.ell2(C + np.array([20 * s, -1.5 * s]), 0.9 * s, fill=INK, ink=0, n=8, wob=0)
            T.line2(C, P_([(17, 2.6), (24, 3.4), (28, 2.2)]), 0.3, wob=0)
            # barnacle spots and a few stars riding on its back
            for (a, b) in ((-6, -8.4), (2, -9.4), (10, -8.8), (-14, -5.4)):
                T.ell2(C + np.array([a * s, b * s]), 0.5 * s, fill=MARBLE, ink=0, n=6, wob=0)
    # its spout: a small fountain of cloud
    for k, (dx, dy, rr) in enumerate(((8, -17, 2.4), (5, -21, 1.8), (11, -22, 1.6), (8, -26, 1.2))):
        with T.st('sky'):
            with T.grp('condense', t0=t0 + 1.0 + 0.08 * k, dur=0.4, pivot=C + np.array([dx, dy]) * s, off=(0, 8), stage='sky',
                       motion=lambda t, age, ph, k=k: (9.0 * math.sin(t * 0.16) + 3.0 * math.sin(t * 0.41) + 1.2 * math.sin(t * 1.3 + k), 4.0 * math.sin(t * 0.33 + 1) + 1.0 * math.sin(t * 0.9 + k * 2))):
                T.ell2(C + np.array([dx, dy]) * s, rr * s, rr * 0.85 * s, fill=SNOW, ink=0.5, inkc=(150, 172, 200), n=10, wob=0)


def paper_crane(T, x, y, s=1.0, t0=0.4, flip=False, orbit=(16.0, 6.0)):
    """an origami crane, as big as a house, gliding in slow circles"""
    C = np.array([x, y])
    f = -1.0 if flip else 1.0
    r = T.rng
    ph = r.uniform(0, 6.28)

    def P_(pts):
        return [(a * s * f, b * s) for a, b in pts]

    def body(t, age, ph_):
        return (orbit[0] * math.sin(t * 0.19 + ph), orbit[1] * math.sin(t * 0.38 + ph), 4.0 * f * math.sin(t * 0.38 + ph + 0.8), 1.0, 1.0)
    body.reach = 40

    def wing(t, age, ph_):
        b = body(t, age, ph_)
        return (b[0], b[1], b[2], 1.0, 0.72 + 0.34 * math.sin(t * 1.9 + ph))
    wing.reach = 40
    fold = (196, 204, 220)
    with T.st('sky'):
        with T.grp('drift', t0=t0, dur=1.2, pivot=C, off=(60 * f, -20), motion=wing, stage='sky'):
            T.poly2(C, P_([(-1, 0), (-7, -11), (2, -3)]), MARBLE_D, 0.4, wob=0)           # far wing
        with T.grp('drift', t0=t0, dur=1.2, pivot=C, off=(60 * f, -20), motion=body, stage='sky'):
            T.poly2(C, P_([(-12, -3), (-3, 0), (4, 0), (13, -6), (10.4, -4.4), (5, 3), (-4, 3)]), MARBLE, 0.42, wob=0)      # tail - body - neck
            T.poly2(C, P_([(13, -6), (16.5, -4.6), (10.4, -4.4)]), ACCENT, 0.36, wob=0)                               # beak
            T.lines2(C, [P_([(-3, 0), (-4, 3)]), P_([(4, 0), (5, 3)]), P_([(-3, 0), (5, 3)])], 0.24, fold, wob=0)
        with T.grp('drift', t0=t0, dur=1.2, pivot=C, off=(60 * f, -20), motion=wing, stage='sky'):
            T.poly2(C, P_([(-3, 0.5), (3, -13), (5, 0.5)]), MARBLE, 0.42, wob=0)           # near wing
            T.line2(C, P_([(1, 0.5), (3, -13)]), 0.24, fold, wob=0)


def sky_hi(T):
    sky_whale(T, -356.0, -92.0, 1.12, t0=0.3)
    paper_crane(T, -78.0, -176.0, 0.82, t0=0.5)
    paper_crane(T, -44.0, -190.0, 0.56, t0=0.62)
    paper_crane(T, 398.0, 122.0, 0.8, t0=0.74, flip=True, orbit=(12.0, 6.0))
    ex.lanterns(T, np.array([178.0, 268.0]), n=5, spread=30.0, rise=64.0, t0=1.0, period=20.0)


# ---------------------------------------------------------------- islets ----
def _islet(T, c=GRASS, seed=1, ru=0.2, rv=0.17, fall=True):
    from .tiles_d import island
    reg = island(T, 0.5, 0.5, ru, rv, c, seed, keel=20.0)
    T.tufts(reg, 12)
    ex.flowers(T, reg, 10, seed=seed)
    T.bob = (1.5, 6.0 + seed % 4, seed * 1.3)
    if fall:
        ex.spill(T, 'L', 0.5 - ru * 0.12, 0.5 + ru * 0.12, 0.0, length=20.0, t0=1.0, mist=False)
        sh = T.shapes[-1]
        # hang the little fall from the front lip of the islet rather than from a slab wall
        lip = np.array(T.P(0.5 + ru * 0.5, 0.5 + rv * 0.72))
        d = lip - np.array(T.P(0.5, 1.0))
        orig = sh.draw

        def moved(c_, tau, t, a, R, orig=orig, d=d):
            c_.save()
            c_.translate(float(d[0]), float(d[1]))
            orig(c_, tau, t, a, R)
            c_.restore()
        sh.draw = moved
        sh.bbox = (sh.bbox[0] + d[0], sh.bbox[1] + d[1], sh.bbox[2] + d[0], sh.bbox[3] + d[1])
    return reg


def islet_a(T):
    _islet(T, GRASS, 3)
    tree(T, 0.44, 0.44, 1.0, BLOSSOM, 'cherry')
    Q = person(T, 0.58, 0.56, shirt=ROSE, arms=True, s=0.9)
    K = Q + np.array([9.0, -24.0])
    with T.st('sky'):
        with T.grp('drift', dur=0.5, pivot=K, off=(-6, 14), motion=pr.floaty(3.5, 2.0, 1.6), stage='sky'):
            T.line2(K, [(0, 0), (-8.0, 18.5)], 0.2, STONE_D, sky=True)
            T.poly2(K, [(-2.6, 0), (0, -3.0), (2.6, 0), (0, 2.6)], ACCENT, 0.3, wob=0, sky=True)
    pr.petals(T, (T.P(0.3, 0.6)[0], T.P(0.4, 0.4)[1] - 8, T.P(0.7, 0.4)[0], T.P(0.5, 0.5)[1]), n=8, fall=22)


def islet_b(T):
    _islet(T, (232, 222, 196), 7, fall=False)
    T.rev(0.5, 0.46, [(0.03, 0), (0.022, 0.09), (0.027, 0.092), (0.027, 0.1)], c=MARBLE, ink=0.38, guide=False)
    T.lines([T.ring(0.5, 0.46, 0.027, 0.035, n=14, a0=10, a1=170), T.ring(0.5, 0.46, 0.024, 0.066, n=14, a0=10, a1=170)], 0.9, ACCENT, stage='detail')
    T.cyl(0.5, 0.46, 0.014, 0.022, z=0.1, c=(214, 232, 240), guide=False, ink=0.3)
    T.cone(0.5, 0.46, 0.02, 0.02, z=0.122, c=ACCENT, guide=False, ink=0.3)
    Lp = T.P(0.5, 0.46, 0.111)
    pr.lamp(T, Lp, 1.0, ACCENT_L, t0=1.15)
    AL = vivid(ACCENT_L)

    def beam(c, tau, t, a, R):
        if tau < 1.3:
            return
        ang = t * 0.9
        for sg in (0, math.pi):
            dx, dy = math.cos(ang + sg), 0.4 * math.sin(ang + sg)
            p1 = Lp + np.array([dx, dy]) * 26 + np.array([-dy, dx]) * 4
            p2 = Lp + np.array([dx, dy]) * 26 - np.array([-dy, dx]) * 4
            R.poly(c, [Lp, p1, p2], fill=AL, a=a * 0.42)
    T.custom(beam, [Lp + np.array([-30, -16]), Lp + np.array([30, 16])], stage='sky', sky=True)
    person(T, 0.6, 0.58, shirt=ZINC, hat=DARK)
    ex.rocks(T, [(0.38, 0.6), (0.62, 0.42)], 0.7)


def islet_c(T):
    _islet(T, GRASS, 12)
    tree(T, 0.42, 0.42, 1.0, (150, 206, 120), 'birch')
    person(T, 0.5, 0.58, shirt=TERRA, hat=(226, 200, 150), path=[(0.5, 0.58), (0.6, 0.5), (0.54, 0.44)], loop=True, speed=1.6)
    pr.sheep(T, 0.6, 0.6, walk=pr.walker(-0.05, 0.0, 9))
    pr.sheep(T, 0.4, 0.6, flip=True)


def islet_d(T):
    _islet(T, GRASS, 17)
    tree(T, 0.44, 0.42, 1.0, JUNGLE, 'fir')
    tree(T, 0.56, 0.4, 0.7, FOREST, 'fir')
    Q = person(T, 0.6, 0.6, shirt=ZINC, hat=(226, 200, 150))
    rod = Q + np.array([1.2, -4.0])
    tip = rod + np.array([9.0, -5.0])
    T.line2((0, 0), [rod, tip], 0.3, WOOD, stage='detail')

    def line(c, tau, t, a, R):
        if tau < 1.2:
            return
        sw = 1.5 * math.sin(t * 1.1)
        end = tip + np.array([sw, 30.0 + 2.0 * math.sin(t * 0.7)])
        R.poly(c, [tip, tip + np.array([sw * 0.3, 14.0]), end], ink=INK, w=0.18, a=a * 0.8, closed=False)
        R.poly(c, [end + np.array([-0.8, 0]), end + np.array([0, 1.6]), end + np.array([0.8, 0])], fill=vivid(ACCENT), ink=INK, w=0.2, a=a)
    T.custom(line, [tip + np.array([-4, 0]), tip + np.array([4, 36])], stage='life')


def islet_e(T):
    _islet(T, GRASS, 23)
    tree(T, 0.4, 0.44, 1.0, FOREST, 'bamboo')
    tree(T, 0.56, 0.38, 0.8, FOREST, 'bamboo')
    # a stone lantern
    T.box(0.55, 0.55, 0.03, 0.03, 0.01, c=STONE, ink=0.3, guide=False)
    T.box(0.56, 0.56, 0.01, 0.01, 0.03, z=0.01, c=STONE, ink=0.28, guide=False)
    T.box(0.552, 0.552, 0.026, 0.026, 0.018, z=0.04, c=STONE, ink=0.3, guide=False)
    T.pyr(0.545, 0.545, 0.04, 0.04, 0.016, z=0.058, c=STONE_D, ink=0.3, guide=False)
    pr.lamp(T, T.P(0.578, 0.565, 0.049), 0.8, ACCENT_L, t0=1.2)
    person(T, 0.44, 0.6, shirt=ROSE, pants=ROSE)
    ex.lanterns(T, T.P(0.5, 0.5, 0.06), n=3, spread=10.0, rise=52.0, t0=1.3, period=13.0)


BUILDERS = {'sky_lo': sky_lo, 'sky_mid': sky_mid, 'sky_hi': sky_hi,
            'islet_a': islet_a, 'islet_b': islet_b, 'islet_c': islet_c, 'islet_d': islet_d, 'islet_e': islet_e}
SKY_ORDER = {'sky_lo': (-99.0, 0.0), 'sky_mid': (0.5, 0.0), 'sky_hi': (99.0, 0.0)}      # where each layer falls in the painter's order
