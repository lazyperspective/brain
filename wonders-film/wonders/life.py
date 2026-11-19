"""Second pass of life, applied to each tile after its builder: strollers on every
road, quay and terrace, smoke from every hearth, flocks over every landmark."""
import math

import numpy as np

from .pal import *  # noqa
from . import props as pr
from .props import person, crowd, stroll, walker, runner, cruise, bobber

HAT = (232, 214, 170)


def taj(T):
    stroll(T, [(0.02, 0.972), (0.98, 0.972)], 11, spread=0.014)
    stroll(T, [(0.37, 0.43), (0.37, 0.87)], 5, spread=0.008)
    stroll(T, [(0.45, 0.43), (0.45, 0.87)], 5, spread=0.008)
    stroll(T, [(0.06, 0.64), (0.34, 0.64)], 4, spread=0.014)
    stroll(T, [(0.48, 0.64), (0.76, 0.64)], 4, spread=0.014)
    stroll(T, [(0.06, 0.432), (0.76, 0.432)], 5, spread=0.006)
    stroll(T, [(0.235, 0.385, 0.03), (0.585, 0.385, 0.03)], 5, spread=0.008)
    for (a, b, c_) in ((0.20, 0.50, ACCENT), (0.62, 0.74, ROSE), (0.14, 0.72, (178, 160, 200)), (0.56, 0.50, ACCENT)):
        person(T, a, b, shirt=c_, pants=c_, path=[(a, b), (a + 0.08, b + 0.03), (a + 0.03, b + 0.07)], loop=True)
    pr.smoke(T, T.P(0.515, 0.955, 0.018), 0.7, lean=5)
    pr.flock(T, 0.41, 0.23, 0.44, 8, c=(60, 150, 90), orbit=(26, 7), speed=0.9)      # parakeets round the dome
    pr.bird(T, 0.80, 0.50, 0.24, 0.8, orbit=(14, 5))


def rio(T):
    stroll(T, [(0.452, 0.335), (0.41, 0.455), (0.357, 0.58), (0.367, 0.705)], 10, spread=0.006)
    crowd(T, [(0.475, 0.36), (0.50, 0.37), (0.43, 0.60), (0.40, 0.59)], 5, mind=0.02, dense=1.6)
    # beach football
    B = T.P(0.438, 0.535)
    for (a, b, c_) in ((0.445, 0.50, ACCENT), (0.425, 0.555, MARBLE), (0.455, 0.545, ACCENT), (0.42, 0.515, MARBLE)):
        person(T, a, b, shirt=c_, path=[(a, b), (a + 0.012, b + 0.02), (a - 0.01, b + 0.006)], loop=True, speed=5.0, pause=0.1, s=0.9)
    with T.grp('pop', pivot=B, stage='life', dur=0.2,
               motion=lambda t, age, ph: (4.0 * math.sin(t * 2.3), 2.0 * math.sin(t * 1.7) - 3.0 * abs(math.sin(t * 4.6)), 0.0, 1.0, 1.0)):
        T.ell2(B, 0.7, fill=MARBLE, ink=0.24, n=8, wob=0)
    stroll(T, [(0.07, 0.79), (0.24, 0.79)], 3)
    stroll(T, [(0.24, 0.94), (0.36, 0.94)], 3)
    pr.smoke(T, T.P(0.10, 0.86, 0.03), 0.7)
    pr.smoke(T, T.P(0.17, 0.90, 0.03), 0.6)
    pr.flock(T, 0.72, 0.44, 0.22, 8, orbit=(26, 9), c=(90, 90, 100))            # gulls over the bay
    pr.rowboat(T, 0.56, 0.70, 'u', c=ACCENT, crew=2, motion=cruise(0.08, 0.03, 0.6))
    pr.sparkles(T, [T.P(0.6 + 0.3 * math.sin(k * 2.4), 0.3 + 0.06 * k) for k in range(10)], t0=1.2, s=0.6, rate=0.8)


def eiffel(T):
    stroll(T, [(0.60, 0.02), (0.60, 0.39)], 5, spread=0.012)
    stroll(T, [(0.60, 0.47), (0.60, 0.98)], 6, spread=0.012)
    stroll(T, [(0.815, 0.03), (0.815, 0.34)], 3, spread=0.006)
    stroll(T, [(0.815, 0.52), (0.815, 0.97)], 4, spread=0.006)
    stroll(T, [(0.63, 0.425), (0.81, 0.425)], 6, z=0.036, spread=0.012)
    stroll(T, [(0.03, 0.795), (0.53, 0.795)], 8, spread=0.008)
    stroll(T, [(0.02, 0.43), (0.24, 0.43), (0.24, 0.27), (0.02, 0.27)], 5, spread=0.008)
    crowd(T, [(0.27, 0.54), (0.55, 0.54), (0.55, 0.605), (0.27, 0.605)], 4, mind=0.02)
    for (a, b, h_) in ((0.875, 0.095, 0.123), (0.94, 0.25, 0.108), (0.075, 0.08, 0.113), (0.285, 0.08, 0.128), (0.08, 0.71, 0.113), (0.39, 0.71, 0.108)):
        pr.smoke(T, T.P(a, b, h_), 0.6, lean=4)
    pr.flock(T, 0.40, 0.43, 0.52, 9, s=0.6, orbit=(26, 8), speed=1.0)          # pigeons round the tower
    # the tower sparkles
    pts = []
    for k in range(14):
        z = 0.06 + 0.7 * ((k * 0.618) % 1.0)
        w = 0.135 * (1 - z / 0.8) ** 1.6 + 0.006
        a = ((k * 0.37) % 1.0) * 2 - 1
        pts.append(T.P(0.40 + a * w, 0.43 + w, z) if k % 2 else T.P(0.40 + w, 0.43 + a * w, z))
    pr.sparkles(T, pts, t0=1.5, s=0.75, rate=1.4)


def everest(T):
    stroll(T, [(0.98, 0.84), (0.84, 0.78), (0.76, 0.66), (0.60, 0.60)], 5, hat=ACCENT, spread=0.006, s=0.9)
    stroll(T, [(0.30, 0.90), (0.42, 0.93), (0.54, 0.90)], 5, hat=TERRA)
    pr.smoke(T, T.P(0.42, 0.915), 0.8, lean=7)
    pr.smoke(T, T.P(0.87, 0.60), 0.6, lean=7)
    # the banner cloud streaming off the summit
    pr.smoke(T, T.P(0.34, 0.33, 0.83), 1.5, lean=26, rise=5, n=7, t0=1.2, sky=True)
    pr.smoke(T, T.P(0.82, 0.24, 0.57), 1.0, lean=18, rise=4, n=5, t0=1.25, sky=True)
    pr.flock(T, 0.62, 0.62, 0.38, 6, orbit=(22, 8), speed=0.7)
    # snow sliding off the face now and then
    A = T.P(0.40, 0.42, 0.52)

    def slide(t, age, ph):
        f = (t / 9.0) % 1.0
        if f > 0.3:
            return (0.0, 0.0, 0.0, 1.0, 1.0, 0.0)
        q = f / 0.3
        return (5.0 * q, 26.0 * q * q, 0.0, 0.5 + 1.2 * q, 0.5 + 1.2 * q, math.sin(math.pi * q))
    slide.reach = 40
    with T.grp('fade', t0=1.3, pivot=A, motion=slide, stage='life', dur=0.2):
        for (dx, dy, rr) in ((0, 0, 2.0), (2.4, 0.8, 1.6), (-1.8, 1.0, 1.4), (0.8, 2.0, 1.5)):
            T.ell2(A + np.array([dx, dy]), rr, fill=SNOW, ink=0.26, inkc=(150, 168, 190), n=9, wob=0)


def fuji(T):
    stroll(T, [(0.08, 0.70), (0.20, 0.80), (0.36, 0.86), (0.56, 0.90)], 7, spread=0.01)
    stroll(T, [(0.62, 0.50), (0.74, 0.50), (0.86, 0.47)], 4)
    stroll(T, [(0.03, 0.32), (0.16, 0.40), (0.30, 0.44)], 4)
    for (a, b) in ((0.82, 0.675), (0.90, 0.765), (0.86, 0.855), (0.94, 0.945)):
        person(T, a, b, shirt=ZINC, hat=(232, 210, 160), path=[(a, b), (a + 0.08, b)], speed=1.5)
    for (a, b) in ((0.69, 0.555), (0.76, 0.62), (0.83, 0.54), (0.07, 0.28), (0.225, 0.20)):
        pr.smoke(T, T.P(a, b, 0.05), 0.6, lean=4)
    pr.petals(T, (T.P(0.05, 0.9)[0], T.P(0.3, 0.7)[1] - 8, T.P(0.62, 0.9)[0], T.P(0.3, 0.9)[1] - 2), n=26)
    pr.flock(T, 0.34, 0.62, 0.26, 7, orbit=(26, 8), c=(250, 248, 240), s=0.9, speed=0.6)      # cranes over the lake
    pr.rowboat(T, 0.10, 0.48, 'u', c=ACCENT, crew=1, motion=cruise(0.10, 0.04, 0.5))


def halong(T):
    for (a, b) in ((0.42, 0.82), (0.47, 0.78)):
        pr.smoke(T, T.P(a, b, 0.03), 0.55, lean=4)
    pr.flock(T, 0.52, 0.43, 0.46, 7, orbit=(26, 8))
    pr.flock(T, 0.24, 0.22, 0.30, 4, orbit=(14, 5), speed=1.1)
    pr.rowboat(T, 0.40, 0.52, 'u', c=MARBLE, crew=2, motion=cruise(0.06, 0.05, 0.7))
    pr.rowboat(T, 0.86, 0.90, 'v', c=TERRA, crew=1, motion=cruise(0.02, -0.07, 0.6))
    person(T, 0.415, 0.83, z=0.004, shirt=TERRA, hat=(232, 210, 160), path=[(0.405, 0.825, 0.004), (0.44, 0.835, 0.004)], speed=1.6)
    person(T, 0.53, 0.83, z=0.004, shirt=ZINC, hat=(232, 210, 160), arms=True)


def reef(T):
    pr.flock(T, 0.47, 0.585, 0.22, 8, orbit=(26, 9), c=(90, 90, 100))
    pr.flock(T, 0.74, 0.26, 0.20, 4, orbit=(14, 5), c=(90, 90, 100), speed=1.2)
    for (a, b) in ((0.50, 0.63), (0.43, 0.63)):
        person(T, a, b, shirt=r_(T), path=[(a, b), (a + 0.03, b - 0.02), (a - 0.01, b - 0.03)], loop=True, speed=1.8)
    pr.rowboat(T, 0.14, 0.14, 'u', c=ACCENT, crew=2, motion=cruise(0.10, 0.04, 0.6))
    pr.sparkles(T, [T.P(0.1 + 0.8 * ((k * 0.618) % 1.0), 0.06 + 0.88 * ((k * 0.37) % 1.0)) for k in range(12)], t0=1.2, s=0.55, rate=0.8)
    # a shoal turning together in the cut-away
    for face, a0 in (('L', 0.16), ('R', 0.58)):
        o = np.array(T.P3((a0, 1, -0.07) if face == 'L' else (1, a0, -0.07)))
        for k in range(9):
            def mo(t, age, ph, k=k):
                a = t * 0.7 + k * 0.5
                return (10 * math.cos(a) + 2 * math.sin(k * 3.0), 3.4 * math.sin(a) + 1.2 * math.cos(k * 2.0), 0.0, 1.0 if math.sin(a) < 0 else -1.0, 1.0)
            with T.grp('pop', pivot=o, motion=mo, stage='life', dur=0.2):
                T.poly2(o, [(-1.6, 0), (-0.4, -0.7), (1.4, 0), (-0.4, 0.7)], MARBLE if k % 3 else ACCENT_L, 0.2, wob=0)


def r_(T):
    return T.rng.choice(CLOTH)


def machu(T):
    Z = 6 * 0.019
    stroll(T, [(0.45, 0.535, Z), (0.61, 0.535, Z), (0.61, 0.695, Z), (0.45, 0.695, Z)], 6, spread=0.006)
    stroll(T, [(0.40, 0.955, 0.0), (0.98, 0.955, 0.0)], 6, spread=0.008, hat=HAT)
    stroll(T, [(0.955, 0.40), (0.955, 0.92)], 4, spread=0.008, hat=HAT)
    pr.smoke(T, T.P(0.365, 0.52, Z + 0.04), 0.6, lean=5)
    pr.smoke(T, T.P(0.665, 0.655, Z + 0.04), 0.6, lean=5)
    pr.flock(T, 0.60, 0.30, 0.40, 5, orbit=(22, 7), speed=0.6)
    pr.llama(T, 0.90, 0.96, col=(176, 132, 100), walk=walker(-0.10, 0.0, 13))


def chichen(T):
    stroll(T, [(0.30, 0.76), (0.50, 0.79), (0.64, 0.74)], 8, hat=HAT, spread=0.012)
    stroll(T, [(0.69, 0.61), (0.765, 0.745)], 4, hat=HAT, spread=0.006)
    stroll(T, [(0.70, 0.34), (0.90, 0.36), (0.88, 0.58)], 6, hat=HAT, spread=0.012)
    stroll(T, [(0.20, 0.50), (0.22, 0.72)], 3, hat=HAT)
    crowd(T, [(0.22, 0.24), (0.62, 0.17), (0.64, 0.25), (0.24, 0.29)], 4, hat=HAT)
    pr.smoke(T, T.P(0.385, 0.845, 0.045), 0.7)
    pr.smoke(T, T.P(0.115, 0.62, 0.10), 0.6, lean=5)          # copal burning at the observatory
    pr.flock(T, 0.46, 0.50, 0.40, 6, orbit=(24, 7), speed=0.7)


def niagara(T):
    GD = 0.115
    stroll(T, [(0.765, 0.52), (0.77, 0.85)], 6, spread=0.016)
    stroll(T, [(0.12, 0.785), (0.30, 0.86)], 4, spread=0.004)
    stroll(T, [(0.84, 0.36), (0.97, 0.36), (0.97, 0.56)], 4)
    stroll(T, [(0.05, 0.10), (0.10, 0.50), (0.08, 0.86)], 4)
    # spray leaping where the sheets land, and where the river leaves the slab
    brink = [(0.34, 0.56), (0.36, 0.46), (0.43, 0.39), (0.52, 0.37), (0.61, 0.39), (0.68, 0.46), (0.70, 0.56)]
    pr.spray(T, [T.P(u, v, -GD) for u, v in brink], n=30, up=7.0, t0=0.9)
    pr.spray(T, [T.P(0.33, 0.62 + 0.18 * k / 4.0, -GD) for k in range(5)], n=12, up=5.0, t0=0.95)
    pr.spray(T, [T.P(0.34 + 0.36 * k / 4.0, 1.0, -0.21) + np.array([0, 4.0]) for k in range(5)], n=18, up=6.0, t0=1.4)
    pr.flock(T, 0.52, 0.30, 0.22, 7, orbit=(26, 8), c=(90, 90, 100))
    pr.smoke(T, T.P(0.905, 0.16, 0.10), 0.7)
    pr.rowboat(T, 0.44, 0.14, 'u', c=ACCENT, crew=2, motion=cruise(0.10, 0.02, 0.6))


def pyramids(T):
    pass


EXTRA = {'taj': taj, 'rio': rio, 'eiffel': eiffel, 'everest': everest, 'fuji': fuji, 'halong': halong, 'reef': reef,
         'machu': machu, 'chichen': chichen, 'niagara': niagara}
