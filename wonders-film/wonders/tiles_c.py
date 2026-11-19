"""Tiles: the bottom and left of the outer ring - Reef, Machu Picchu, Chichen Itza, Niagara."""
import math

import numpy as np

from .core import W, ZS, SLAB, smooth_poly, Wave
from .pal import *  # noqa
from . import props as pr
from . import ease
from .props import person, tree, crowd, grove, water, walker, bobber, cruise
from .tiles_a import sm, sea_wall, ARCH_DK, lerp3
from .tiles_b import fish_wall, fish

LIMESTONE = (230, 220, 198)


# ================================================== GREAT BARRIER REEF ====
def reef(T):
    TH = 0.25
    sea_wall(T, 'L', TH, t0=0.34, bed=0.22)
    sea_wall(T, 'R', TH, t0=0.40, bed=0.22)
    T.slab(SAND, EARTH, walls=False, thick=TH)
    r = T.rng
    f, wv = water(T, [(0, 0), (1, 0), (1, 1), (0, 1)], src=(0.0, 0.0), marks=0, t0=0.24, dur=0.6, shore=0.0)
    # reef flats seen through the water
    flats = [(0.30, 0.26, 0.17, 0.12, 2), (0.66, 0.40, 0.15, 0.17, 5), (0.24, 0.66, 0.14, 0.13, 8), (0.62, 0.80, 0.19, 0.10, 11), (0.86, 0.14, 0.09, 0.08, 14)]
    corals = [ROSE, ACCENT_L, BLOSSOM, TERRA, MARBLE, ACCENT]
    with T.st('detail'):
        for (a, b, ru, rv, sd) in flats:
            T.blob(a, b, ru, rv, WATER_L, 0.34, inkc=WATER_D, seed=sd, wave=wv, irr=0.3)
            reg = T._last_blob
            T.blob(a + 0.01, b, ru * 0.62, rv * 0.6, (222, 238, 232), 0.0, seed=sd + 1, wave=wv, irr=0.3)
            for (u, v) in T.scatter(reg, int(20 * ru / 0.15), mind=0.03):
                P = T.P(u, v)
                c_ = r.choice(corals)
                s_ = r.uniform(0.6, 1.0)
                if r.random() < 0.5:
                    T.ell2(P, 1.5 * s_, 1.0 * s_, fill=c_, ink=0.2, inkc=shade(c_, 0.7), n=8, wob=0, wave=wv)
                else:
                    T.lines2(P, [[(-1.2 * s_, 0.5), (0, -0.6 * s_), (1.2 * s_, 0.4)], [(0, -0.6 * s_), (0.2, 0.9 * s_)]], 0.6, c_, wob=0, wave=wv, stage='mark')
    # wave scribbles on the open water
    for (u, v) in T.scatter([(0.02, 0.02), (0.98, 0.02), (0.98, 0.98), (0.02, 0.98)], 30, mind=0.06):
        P = T.P(u, v)
        d = float(wv.dist(P[None, :])[0])
        l = r.uniform(1.6, 3.0)
        with T.grp('fade', t0=wv.time_at(d) + 0.05, dur=0.18, pivot=P, motion=pr.shimmer, stage='life'):
            T.line2(P, smooth_poly([(-l, 0.3), (-l * 0.45, -0.75), (0.1, 0.0), (l * 0.55, 0.6), (l, 0.05)], 1, closed=False), 0.42, FOAM if r.random() < 0.6 else WATER_D, wob=0)

    # ---- sand cay with a palm and an umbrella
    with T.st('detail'):
        T.blob(0.47, 0.585, 0.075, 0.06, SAND, 0.4, seed=4, wave=wv)
        T.blob(0.47, 0.585, 0.095, 0.078, None, 0.3, inkc=FOAM, seed=4, wave=wv)
    tree(T, 0.455, 0.57, 0.9, FOREST, 'palm')
    tree(T, 0.49, 0.56, 0.7, FOREST, 'palm')
    U = T.P(0.50, 0.61)
    with T.grp('pop', pivot=U, stage='life', dur=0.2):
        T.line2(U, [(0, 0), (0, -4.6)], 0.26)
        T.poly2(U, [(-3.2, -3.8), (0, -6.0), (3.2, -3.8), (0, -3.0)], ACCENT, 0.26, wob=0)
    person(T, 0.465, 0.615, shirt=ROSE)
    person(T, 0.44, 0.60, shirt=MARBLE)

    # ---- a humpback: back, fluke and spout
    Wp = T.P(0.80, 0.63)
    with T.grp('pop', pivot=Wp, motion=bobber(0.7, 2.5, 0.7, (0.03, -0.02), 11), stage='life', dur=0.3):
        T.poly2(Wp, smooth_poly([(-10, 0.5), (-5, -2.6), (2, -3.0), (8, -1.0), (9.5, 0.8), (2, 1.4), (-5, 1.5)], 2), (96, 112, 132), 0.36, wob=0)
        T.poly2(Wp + np.array([-12.5, -2.0]), smooth_poly([(2.6, 2.2), (0.6, -1.2), (-3.4, -3.4), (-1.2, -0.2), (-3.6, 2.0), (0.2, 1.6)], 1), (96, 112, 132), 0.34, wob=0)
        T.line2(Wp, [(-9, 1.8), (9, 1.9)], 0.4, FOAM, wob=0)
    with T.grp('grow', t0=1.2, dur=0.3, pivot=Wp + np.array([5.5, -2.5]), stage='life',
               motion=lambda t, age, ph: (0.0, 0.0, 0.0, 1.0, 0.75 + 0.3 * math.sin(t * 3.0))):
        T.lines2(Wp + np.array([5.5, -2.5]), [[(0, 0), (-0.8, -5.5), (-2.6, -7.4)], [(0, 0), (0.8, -5.8), (2.6, -7.6)], [(0, 0), (0, -6.6)]], 0.5, FOAM, wob=0)
        T.lines2(Wp + np.array([5.5, -2.5]), [[(0, 0), (-0.8, -5.5), (-2.6, -7.4)], [(0, 0), (0.8, -5.8), (2.6, -7.6)]], 0.2, WATER_D, wob=0)
    # turtles under the surface
    for (a, b, fl) in ((0.14, 0.34, 1), (0.52, 0.20, -1)):
        Q = T.P(a, b)
        with T.grp('pop', pivot=Q, motion=cruise(0.04 * fl, 0.02, 0.6, 0.2, 2.0), stage='life', dur=0.25):
            T.lines2(Q, [[(-2.6, -1.4), (2.6, 1.4)], [(-2.6, 1.4), (2.6, -1.4)]], 0.9, (150, 186, 140), wob=0)
            T.ell2(Q, 2.4, 1.7, fill=(128, 168, 126), ink=0.28, n=10, wob=0)
            T.ell2(Q + np.array([3.0 * fl, 0.4]), 0.9, 0.7, fill=(150, 186, 140), ink=0.24, n=8, wob=0)
    # dolphins arcing
    for k, (a, b) in enumerate(((0.16, 0.90), (0.21, 0.94))):
        Q = T.P(a, b)

        def jump(t, age, ph, k=k):
            s_ = (t * 0.55 + k * 0.18) % 1.0
            return (10 * s_ - 5, -7.5 * math.sin(math.pi * min(1.0, s_ * 1.6)) * (1 if s_ < 0.625 else 0) + (2 if s_ >= 0.625 else 0),
                    -50 + 160 * min(1.0, s_ * 1.6), 1.0, 1.0 if s_ < 0.625 else 0.0)
        with T.grp('fade', pivot=Q, motion=jump, stage='life', dur=0.2):
            T.poly2(Q, smooth_poly([(-3.4, 0.6), (-1, -1.3), (2.4, -0.9), (3.8, 0.2), (1.4, 0.7), (-1.2, 0.9)], 1), (126, 146, 172), 0.28, wob=0)
            T.poly2(Q, [(-0.4, -1.1), (0.3, -2.4), (1.0, -1.0)], (126, 146, 172), 0.24, wob=0)
    # ---- dive boat, snorkellers, catamaran
    pr.steamer(T, 0.34, 0.44, 'u', L=0.12, c=MARBLE, trim=ACCENT, decks=1)
    for (a, b) in ((0.44, 0.40), (0.40, 0.33), (0.26, 0.52)):
        Q = T.P(a, b)
        with T.grp('pop', pivot=Q, motion=bobber(0.3, 0, 1.0, (0.02, 0.01), 7), stage='life', dur=0.2):
            T.ell2(Q + np.array([0, -0.7]), 1.0, fill=r.choice(SKIN), ink=0.26, n=9, wob=0)
            T.line2(Q, [(1.0, -1.0), (1.4, -2.8)], 0.36, ACCENT, wob=0)
            T.line2(Q, [(-2.4, 0.4), (2.4, 0.4)], 0.36, FOAM, wob=0)
    pr.sailboat(T, 0.74, 0.22, 'u', sail=MARBLE, motion=cruise(0.08, 0.04, 0.9), s=1.1)
    pr.sailboat(T, 0.86, 0.90, 'v', sail=ACCENT_L, motion=cruise(-0.04, -0.05, 0.7), s=0.85)
    pr.bird(T, 0.47, 0.585, 0.20, 0.8, orbit=(10, 3))
    pr.bird(T, 0.53, 0.55, 0.24, 0.7, orbit=(8, 3))
    pr.bird(T, 0.70, 0.30, 0.20, 0.7, orbit=(7, 3))
    pr.cloud(T, 0.20, 0.10, 0.20, 0.9)
    pr.glint(T, Wp + np.array([5.5, -9.0]), 0.8)

    # ---- the cut-away: coral gardens and their fish
    reef_wall(T, 'L', TH)
    reef_wall(T, 'R', TH)


def reef_wall(T, face, TH):
    r = T.rng

    def fp(a, z):
        return np.array(T.P3((a, 1, z) if face == 'L' else (1, a, z)))
    # coral bommies rising off the bed
    for k, (a, w_, h_) in enumerate(((0.16, 0.10, 0.30), (0.47, 0.14, 0.42), (0.80, 0.11, 0.34))):
        base = fp(a, -TH * 0.80)
        ax = fp(a + w_ / 2, -TH * 0.80) - base
        hh = np.array([0, -TH * ZS * h_])
        pts = [-ax * 1.1, -ax * 0.9 + hh * 0.5, -ax * 0.5 + hh * 0.95, ax * 0.1 + hh * 1.05, ax * 0.7 + hh * 0.8, ax * 1.0 + hh * 0.35, ax * 1.15]
        with T.grp('rise', t0=0.72 + 0.06 * k, dur=0.4, pivot=base, stage='struct'):
            T.poly2(base, smooth_poly(pts, 2, closed=False), (206, 190, 170) if face == 'L' else (190, 174, 156), 0.36, wob=0.1)
    fish_wall(T, face, TH, n=9 if face == 'L' else 8, corals=9, cols=[ACCENT, ZINC, ACCENT, ROSE, ACCENT_L, MARBLE])
    # a turtle and a reef shark patrol the deep
    if face == 'L':
        Q = fp(0.62, -TH * 0.36)
        with T.grp('pop', pivot=Q, motion=lambda t, age, ph: (9 * math.sin(t * 0.5), 4.5 * math.sin(t * 0.5) + math.sin(t * 2.2), 0, 1, 1), stage='life', dur=0.25):
            T.lines2(Q, [[(-2.0, 1.0), (-4.0, 3.2)], [(1.6, 1.2), (2.6, 3.4)]], 1.0, (150, 186, 140), wob=0)
            T.ell2(Q, 3.2, 2.1, fill=(128, 168, 126), ink=0.3, n=12, wob=0)
            T.lines2(Q, [[(-1.6, -1.2), (-0.6, 1.4)], [(0.4, -1.8), (1.0, 1.4)]], 0.22, FOREST, wob=0)
            T.ell2(Q + np.array([4.0, 0.6]), 1.1, 0.85, fill=(150, 186, 140), ink=0.26, n=8, wob=0)
        # diver with bubbles
        D = fp(0.30, -TH * 0.42)
        with T.grp('pop', pivot=D, motion=lambda t, age, ph: (3 * math.sin(t * 0.6), 1.5 * math.sin(t * 0.6) + 0.8 * math.sin(t * 1.7), 0, 1, 1), stage='life', dur=0.25):
            T.line2(D, [(-4.6, 1.6), (-2.2, 0.6)], 0.8, DARK, wob=0)
            T.poly2(D, [(-2.6, -0.8), (1.6, -1.1), (1.6, 1.0), (-2.6, 1.2)], DARK, 0.26, wob=0)
            T.poly2(D, [(-1.6, -2.0), (0.8, -2.2), (0.8, -1.0), (-1.6, -0.9)], ACCENT, 0.24, wob=0)
            T.ell2(D + np.array([2.6, -0.2]), 1.1, fill=SKIN[0], ink=0.26, n=9, wob=0)
        for k in range(4):
            def bub(t, age, ph, k=k):
                s_ = (t * 0.5 + k * 0.25) % 1.0
                return (3 * math.sin(t * 0.6) + 1.2 * math.sin(s_ * 9), 1.5 * math.sin(t * 0.6) - 16 * s_, 0, 0.5 + s_, 0.5 + s_)
            with T.grp('fade', pivot=D + np.array([3.0, -1.5]), motion=bub, stage='life', dur=0.2):
                T.ell2(D + np.array([3.0, -1.5]), 0.7, fill=None, ink=0.26, inkc=FOAM, n=8, wob=0)
    else:
        Q = fp(0.40, -TH * 0.30)
        with T.grp('pop', pivot=Q, motion=lambda t, age, ph: (-14 * math.sin(t * 0.42), 7 * math.sin(t * 0.42), 0, 1, 1), stage='life', dur=0.25):
            T.poly2(Q, smooth_poly([(-6.5, 0.2), (-2, -1.5), (3, -1.3), (6, 0.2), (3, 1.2), (-2, 1.1)], 1), (150, 160, 172), 0.3, wob=0)
            T.poly2(Q, [(-0.6, -1.4), (0.4, -3.6), (1.6, -1.3)], (150, 160, 172), 0.26, wob=0)
            T.poly2(Q, [(5.6, 0.2), (8.4, -2.4), (7.4, 0.2), (8.2, 2.0)], (150, 160, 172), 0.26, wob=0)
        # a ray
        Q = fp(0.74, -TH * 0.52)
        with T.grp('pop', pivot=Q, motion=lambda t, age, ph: (6 * math.sin(t * 0.5 + 1), -3 * math.sin(t * 0.5 + 1), 0, 1, 0.8 + 0.2 * math.sin(t * 3)), stage='life', dur=0.25):
            T.poly2(Q, [(-3.6, 0), (0, -2.2), (3.6, 0), (0, 1.6)], (120, 132, 150), 0.28, wob=0)
            T.line2(Q, [(2.6, 0.6), (6.4, 2.2)], 0.3, (120, 132, 150), wob=0)


# ======================================================== MACHU PICCHU ====
def machu(T):
    T.slab(GRASS, EARTH, thick=0.14)
    r = T.rng
    T.tufts([(0, 0), (1, 0), (1, 1), (0, 1)], 70)

    def peak_green(u, v, rr, h, t0, c=FOREST, steep=True):
        g = T.guide_axis(u, v, h, ticks=max(3, int(h * 12)), r=rr)
        g.tp = max(0.02, t0 - 0.22)
        g.te = t0 + 0.5
        with T.grp('rise', t0=t0, dur=0.5, pivot=T.P(u, v), stage='struct', ink_now=True, under=PAPER):
            if steep:
                prof = [(rr, 0), (rr * 0.84, h * 0.2), (rr * 0.62, h * 0.5), (rr * 0.42, h * 0.76), (rr * 0.22, h * 0.93), (0.0, h)]
                T.rev(u, v, prof, c=c, ink=0.5, guide=False)
                C = T.P(u, v)
                k_ = math.sqrt(2) * W
                T.poly2(C, smooth_poly([(rr * k_ * 0.1, -h * ZS * 0.9), (rr * k_ * 0.36, -h * ZS * 0.66), (rr * k_ * 0.42, -h * ZS * 0.36), (rr * k_ * 0.18, -h * ZS * 0.5)], 2),
                        (176, 170, 160), 0.3)
                T.lines2(C, [[(-rr * k_ * 0.3, -h * ZS * 0.6), (-rr * k_ * 0.42, -h * ZS * 0.3)], [(-rr * k_ * 0.1, -h * ZS * 0.5), (-rr * k_ * 0.16, -h * ZS * 0.2)]],
                         0.26, shade(c, 0.76))
            else:
                T.hill(u, v, rr, h, c=c, guide=False)
    # the green sugar-loaves stand along the back-left edge, clear of the tiles behind
    peak_green(0.10, 0.21, 0.09, 0.15, 0.28, JUNGLE)
    peak_green(0.135, 0.47, 0.125, 0.37, 0.34, FOREST)       # Huayna Picchu
    peak_green(0.085, 0.74, 0.085, 0.19, 0.40, JUNGLE)

    # ---- agricultural terraces: stacked retaining walls
    n = 6
    for k in range(n, 0, -1):
        z = (n - k) * 0.019
        u0, v0 = 0.36 - 0.012 * k, 0.36 - 0.03 * k
        u1, v1 = 0.70 + 0.048 * k, 0.76 + 0.038 * k
        T.box(u0, v0, u1 - u0, v1 - v0, 0.019, z=z, c=STONE, top=GRASS if k % 2 else (190, 212, 160), ink=0.4, guide=(k in (n, 1)))
    Z = n * 0.019
    with T.st('ground'):
        pass
    T.poly([(0.44, 0.52, Z), (0.62, 0.52, Z), (0.62, 0.70, Z), (0.44, 0.70, Z)], (198, 218, 166), 0.3, stage='detail')       # main plaza

    def ruin(u, v, du, dv, h, thatch=False, ax='u'):
        T.box(u, v, du, dv, h, z=Z, c=(218, 210, 196), ink=0.36, guide=False)
        if thatch:
            T.gable(u, v, du, dv, 0.02, z=Z + h, c=(204, 176, 124), axis=ax, wall=(218, 210, 196), ink=0.34)
        else:
            if ax == 'u':
                T.poly([(u + du, v, Z + h), (u + du, v + dv, Z + h), (u + du, v + dv / 2, Z + h + 0.02)], shade((218, 210, 196), 0.83), 0.34)
                T.poly([(u, v, Z + h), (u + du, v, Z + h), (u + du, v + dv, Z + h), (u, v + dv, Z + h)], (150, 140, 130), 0.3)
            else:
                T.poly([(u, v + dv, Z + h), (u + du, v + dv, Z + h), (u + du / 2, v + dv, Z + h + 0.02)], shade((218, 210, 196), 0.94), 0.34)
        T.rects('L', u, u + du, v + dv, Z + h * 0.25, Z + h * 0.8, 2, 1, fill=ARCH_DK, fw=0.4, fh=1.0, ink=0.14)
    for k, (a, b, ax, th) in enumerate(((0.345, 0.45, 'u', 0), (0.345, 0.50, 'u', 1), (0.345, 0.55, 'u', 0), (0.345, 0.60, 'u', 0), (0.345, 0.65, 'u', 1), (0.345, 0.70, 'u', 0),
                                        (0.42, 0.45, 'v', 0), (0.47, 0.45, 'v', 1), (0.52, 0.45, 'v', 0), (0.57, 0.45, 'v', 0),
                                        (0.645, 0.47, 'u', 1), (0.645, 0.525, 'u', 0), (0.645, 0.58, 'u', 0), (0.645, 0.635, 'u', 1), (0.645, 0.69, 'u', 0),
                                        (0.44, 0.725, 'v', 0), (0.50, 0.725, 'v', 1), (0.56, 0.725, 'v', 0))):
        ruin(a, b, 0.042 if ax == 'u' else 0.036, 0.036 if ax == 'u' else 0.03, 0.022, bool(th), ax)
    # temple of the sun (round tower) + intihuatana
    T.cyl(0.385, 0.755, 0.022, 0.03, z=Z, c=(218, 210, 196), guide=False, ink=0.36)
    T.box(0.60, 0.74, 0.05, 0.04, 0.008, z=Z, c=STONE, ink=0.3, guide=False)
    T.box(0.612, 0.75, 0.026, 0.02, 0.008, z=Z + 0.008, c=STONE, ink=0.3, guide=False)
    T.box(0.622, 0.756, 0.008, 0.008, 0.014, z=Z + 0.016, c=MARBLE_D, ink=0.26, guide=False)

    # ---- trees on the lower slopes
    for (a, b) in ((0.10, 0.90), (0.04, 0.95), (0.18, 0.95), (0.24, 0.88), (0.86, 0.10), (0.96, 0.20), (0.52, 0.06), (0.30, 0.06), (0.97, 0.06), (0.66, 0.05), (0.40, 0.10),
                   (0.76, 0.08)):
        tree(T, a, b, r.uniform(0.75, 1.0), r.choice([JUNGLE, FOREST]), r.choice(['jungle', 'round']))

    # ---- life: llamas on the plaza, visitors on the terraces, a condor
    pr.llama(T, 0.49, 0.58, z=Z, blanket=ACCENT)
    pr.llama(T, 0.56, 0.62, z=Z, col=(176, 132, 100), flip=True)
    pr.llama(T, 0.52, 0.66, z=Z, blanket=TERRA, walk=walker(0.03, -0.01, 8))
    pr.llama(T, 0.84, 0.80, z=3 * 0.019, col=MARBLE, flip=True)
    crowd(T, [(0.45, 0.53), (0.61, 0.53), (0.61, 0.69), (0.45, 0.69)], 7, z=Z, hat=(226, 200, 150), mind=0.03)
    for k in (1, 2, 3, 4):
        z = (6 - k) * 0.019
        crowd(T, [(0.72 + 0.048 * (k - 1), 0.5), (0.70 + 0.048 * k - 0.006, 0.5), (0.70 + 0.048 * k - 0.006, 0.76), (0.72 + 0.048 * (k - 1), 0.76)], 2, z=z,
              hat=(226, 200, 150), walk_frac=0)
        crowd(T, [(0.40, 0.78 + 0.038 * (k - 1)), (0.70, 0.78 + 0.038 * (k - 1)), (0.70, 0.76 + 0.038 * k - 0.006), (0.40, 0.76 + 0.038 * k - 0.006)], 2, z=z,
              walk_frac=0)
    person(T, 0.435, 0.60, z=Z, shirt=ACCENT, hat=DARK, arms=True)
    # clouds snagged on the peaks
    pr.cloud(T, 0.16, 0.50, 0.24, 1.1, drift=4.0)
    pr.cloud(T, 0.06, 0.26, 0.12, 0.8)
    pr.cloud(T, 0.10, 0.80, 0.14, 0.8)
    pr.cloud(T, 0.80, 0.30, 0.26, 0.8)
    pr.glint(T, T.P(0.135, 0.47, 0.38), 0.8)
    C = T.P(0.70, 0.56, 0.44)

    def soar(t, age, ph):
        a = t * 0.5 + ph
        return (14 * math.cos(a), 5 * math.sin(a), 8 * math.sin(a), 1.0, 1.0)
    with T.st('sky'):
        with T.grp('fade', dur=0.3, pivot=C, motion=soar, stage='sky'):
            T.poly2(C, smooth_poly([(-7, -1.0), (-3, -0.2), (0, 0.6), (3, -0.2), (7, -1.0), (3.4, 0.9), (0, 1.5), (-3.4, 0.9)], 1), DARK, 0.26, wob=0, sky=True)
            T.ell2(C + np.array([0, 0.2]), 0.7, fill=MARBLE, ink=0.2, n=7, wob=0, sky=True)


# ======================================================== CHICHEN ITZA ====
def chichen(T):
    T.slab(GRASS, EARTH)
    r = T.rng
    plaza = [(p[0], p[1]) for p in smooth_poly([np.array(p) for p in [(0.16, 0.20), (0.62, 0.12), (0.92, 0.22), (0.86, 0.60), (0.66, 0.86), (0.30, 0.86), (0.12, 0.62)]], 3)]
    with T.st('ground'):
        T.poly(plaza, (238, 228, 204), 0.36)
        T.poly([(0.66, 0.60), (0.72, 0.60), (0.80, 0.74), (0.74, 0.76)], (238, 228, 204), 0.3)       # sacbe to the cenote
    T.speckle(plaza, 80, c=SAND_D)
    T.tufts([(0, 0), (1, 0), (1, 1), (0, 1)], 60)

    def jtree(a, b):
        tree(T, a, b, r.uniform(0.85, 1.15), r.choice([JUNGLE, FOREST, JUNGLE]), r.choice(['jungle', 'jungle', 'round', 'palm']))
    back = [(0.03, 0.04), (0.12, 0.03), (0.22, 0.05), (0.33, 0.03), (0.45, 0.04), (0.56, 0.03), (0.04, 0.14), (0.10, 0.22), (0.03, 0.30), (0.20, 0.12), (0.34, 0.10), (0.05, 0.42)]
    for (a, b) in back:
        jtree(a, b)

    # ---- temple of the warriors, with its forest of columns
    T.box(0.68, 0.05, 0.24, 0.20, 0.03, c=LIMESTONE, ink=0.42)
    T.box(0.71, 0.07, 0.18, 0.15, 0.03, z=0.03, c=LIMESTONE, ink=0.4, guide=False)
    T.box(0.75, 0.09, 0.11, 0.09, 0.035, z=0.06, c=LIMESTONE, ink=0.4, guide=False)
    T.rects('L', 0.76, 0.85, 0.18, 0.064, 0.09, 3, 1, fill=ARCH_DK, fw=0.5, fh=1.0)
    T.poly([(0.78, 0.25, 0), (0.82, 0.25, 0), (0.82, 0.18, 0.06), (0.78, 0.18, 0.06)], shade(LIMESTONE, 1.04), 0.36)
    T.lines([[(0.78, 0.25 - 0.07 * q, 0.06 * q), (0.82, 0.25 - 0.07 * q, 0.06 * q)] for q in (0.2, 0.4, 0.6, 0.8)], 0.22, STONE_D, stage='detail')
    for row in range(2):
        for k in range(9):
            if 3 <= k <= 4:
                continue
            T.cyl(0.665 + k * 0.032, 0.285 + row * 0.03, 0.006, 0.032, c=MARBLE, guide=False, ink=0.26)
    for k in range(5):
        T.cyl(0.955, 0.08 + k * 0.035, 0.006, 0.032, c=MARBLE, guide=False, ink=0.26)

    # ---- El Castillo: nine terraces, four stairways, the temple on top
    cu, cv = 0.46, 0.50
    n = 9
    s0, s1 = 0.36, 0.15
    dz = 0.022
    H = n * dz
    for k in range(n):
        s_ = s0 + (s1 - s0) * k / (n - 1)
        T.box(cu - s_ / 2, cv - s_ / 2, s_, s_, dz, z=k * dz, c=LIMESTONE, ink=0.38, guide=(k == 0))
    T.guide_axis(cu, cv, H + 0.06, ticks=10)
    T.guide([[(cu - s0 / 2, cv + s0 / 2, 0), (cu - s1 / 2, cv + s1 / 2, H)], [(cu + s0 / 2, cv + s0 / 2, 0), (cu + s1 / 2, cv + s1 / 2, H)],
             [(cu + s0 / 2, cv - s0 / 2, 0), (cu + s1 / 2, cv - s1 / 2, H)]], over=0.06)
    sw = 0.034
    st_l = [(cu - sw, cv + s0 / 2 + 0.03, 0), (cu + sw, cv + s0 / 2 + 0.03, 0), (cu + sw, cv + s1 / 2, H), (cu - sw, cv + s1 / 2, H)]
    st_r = [(cu + s0 / 2 + 0.03, cv - sw, 0), (cu + s0 / 2 + 0.03, cv + sw, 0), (cu + s1 / 2, cv + sw, H), (cu + s1 / 2, cv - sw, H)]
    T.poly(st_l, (244, 236, 216), 0.4)
    T.poly(st_r, (222, 212, 190), 0.4)
    T.lines([[lerp3(st_l[0], st_l[3], q), lerp3(st_l[1], st_l[2], q)] for q in np.linspace(0.06, 0.94, 14)], 0.2, STONE_D, stage='detail')
    T.lines([[lerp3(st_r[0], st_r[3], q), lerp3(st_r[1], st_r[2], q)] for q in np.linspace(0.06, 0.94, 14)], 0.2, STONE_D, stage='detail')
    T.box(cu - 0.055, cv - 0.055, 0.11, 0.11, 0.045, z=H, c=LIMESTONE, ink=0.4, guide=False)
    T.box(cu - 0.06, cv - 0.06, 0.12, 0.12, 0.01, z=H + 0.045, c=(240, 232, 212), ink=0.36, guide=False)
    T.rects('L', cu - 0.03, cu + 0.03, cv + 0.055, H + 0.004, H + 0.036, 1, 1, fill=ARCH_DK, fw=0.6, fh=1.0)
    T.rects('R', cv - 0.03, cv + 0.03, cu + 0.055, H + 0.004, H + 0.036, 1, 1, fill=ARCH_DK, fw=0.6, fh=1.0)
    for (a, b) in ((cu - sw - 0.008, cv + s0 / 2 + 0.03), (cu + sw + 0.008, cv + s0 / 2 + 0.03)):     # serpent heads
        T.box(a - 0.008, b, 0.016, 0.022, 0.012, c=(196, 206, 170), ink=0.26, guide=False)

    # ---- El Caracol, the round observatory
    T.box(0.05, 0.56, 0.13, 0.12, 0.022, c=LIMESTONE, ink=0.4)
    T.cyl(0.115, 0.62, 0.04, 0.05, z=0.022, c=LIMESTONE, guide=False, ink=0.4)
    T.dome(0.115, 0.62, 0.034, 0.022, z=0.072, c=(214, 204, 184), guide=False, ink=0.36)
    T.rects('L', 0.10, 0.13, 0.66, 0.03, 0.058, 1, 1, fill=ARCH_DK, fw=0.5, fh=1.0)

    # ---- the sacred cenote
    cx, cy, cr = 0.82, 0.82, 0.095
    with T.st('ground'):
        T.poly(T.ring(cx, cy, cr, 0, n=30)[:-1], (206, 192, 164), 0.42)
        T.lines([[(cx + cr * math.cos(a), cy + cr * math.sin(a), 0), (cx + cr * 0.86 * math.cos(a), cy + cr * 0.86 * math.sin(a), -0.03)]
                 for a in np.linspace(math.radians(140), math.radians(310), 9)], 0.26, STONE_D)
    water(T, T.ring(cx + 0.012, cy + 0.012, cr * 0.84, 0, n=26)[:-1], src=(cx, cy), c=WATER_D, marks=4, t0=0.5, dur=0.35, shore=0.36, z=-0.035)
    T.lines([[(cx - cr * 0.6, cy - cr * 0.75, 0), (cx - cr * 0.58, cy - cr * 0.62, -0.045)], [(cx - cr * 0.2, cy - cr * 0.95, 0), (cx - cr * 0.2, cy - cr * 0.8, -0.04)],
             [(cx + cr * 0.3, cy - cr * 0.92, 0), (cx + cr * 0.3, cy - cr * 0.78, -0.05)]], 0.4, FOREST, stage='detail')

    # ---- market stalls
    for k, (a, b) in enumerate(((0.26, 0.80), (0.36, 0.83), (0.46, 0.84))):
        T.box(a, b, 0.05, 0.03, 0.014, c=WOOD, ink=0.28, guide=False)
        T.poly([(a - 0.005, b + 0.035, 0.03), (a + 0.055, b + 0.035, 0.03), (a + 0.055, b - 0.002, 0.045), (a - 0.005, b - 0.002, 0.045)],
               ACCENT if k != 1 else MARBLE, 0.3, stage='detail')
        T.lines([[(a, b + 0.03, 0.014), (a, b + 0.035, 0.03)], [(a + 0.05, b + 0.03, 0.014), (a + 0.05, b + 0.035, 0.03)]], 0.26, stage='detail')

    # ---- jungle closing in around the clearing
    front = [(0.04, 0.54), (0.03, 0.74), (0.10, 0.80), (0.04, 0.90), (0.14, 0.93), (0.24, 0.96), (0.36, 0.95), (0.50, 0.96), (0.62, 0.93), (0.70, 0.97), (0.97, 0.60),
             (0.94, 0.70), (0.97, 0.96), (0.66, 0.02), (0.97, 0.03), (0.97, 0.40), (0.93, 0.50), (0.60, 0.20), (0.18, 0.74)]
    front.sort(key=lambda p_: p_[0] + p_[1])
    for (a, b) in front:
        jtree(a, b)

    # ---- life
    crowd(T, [(0.30, 0.72), (0.64, 0.72), (0.62, 0.80), (0.30, 0.80)], 9, hat=(232, 214, 170), mind=0.028)
    crowd(T, [(0.68, 0.36), (0.88, 0.36), (0.86, 0.56), (0.70, 0.56)], 6, hat=(232, 214, 170), mind=0.03)
    crowd(T, [(0.20, 0.72), (0.28, 0.72), (0.28, 0.78), (0.20, 0.78)], 2)
    person(T, 0.555, 0.775, shirt=ACCENT, hat=MARBLE, arms=True)
    for (a, b) in ((0.79, 0.84), (0.85, 0.80)):                   # swimmers in the cenote
        Q = T.P(a, b, -0.035)
        with T.grp('pop', pivot=Q, motion=bobber(0.3, 0), stage='life', dur=0.2):
            T.ell2(Q + np.array([0, -0.8]), 1.0, fill=r.choice(SKIN), ink=0.26, n=9, wob=0)
            T.line2(Q, [(-2.0, 0.3), (2.0, 0.3)], 0.34, FOAM, wob=0)
    # macaws
    for k, (a, b, z) in enumerate(((0.30, 0.40, 0.34), (0.38, 0.36, 0.30), (0.74, 0.70, 0.22))):
        pr.bird(T, a, b, z, 0.9, c=ACCENT if k != 1 else TERRA, orbit=(11, 4), speed=1.2)
    pr.cloud(T, 0.10, 0.12, 0.30, 0.9)
    pr.glint(T, T.P(cu, cv, H + 0.06), 0.9)


# ============================================================= NIAGARA ====
def niagara(T):
    TH = 0.21
    GD = 0.115          # depth of the gorge
    r = T.rng
    ROCKW = (196, 186, 168)
    # slab with the gorge notched out of its left wall
    with T.st('slab'):
        T.poly([(0, 1, 0), (0.34, 1, 0), (0.34, 1, -GD), (0.70, 1, -GD), (0.70, 1, 0), (1, 1, 0), (1, 1, -TH), (0, 1, -TH)], EARTH, 0.6, wob=0.2)
        T.poly([(1, 0, 0), (1, 1, 0), (1, 1, -TH), (1, 0, -TH)], shade(EARTH, 0.86), 0.6, wob=0.2)
        T.lines([[(0.02, 1, -0.07), (0.28, 1, -0.075)], [(0.74, 1, -0.07), (0.98, 1, -0.072)], [(0.06, 1, -0.15), (0.40, 1, -0.155)], [(0.5, 1, -0.16), (0.94, 1, -0.158)],
                 [(1, 0.05, -0.07), (1, 0.5, -0.074)], [(1, 0.6, -0.07), (1, 0.95, -0.072)], [(1, 0.1, -0.15), (1, 0.8, -0.154)]], 0.3, shade(EARTH, 0.68), stage='detail')
    T.thick = TH
    with T.st('slab'):
        T.top = T.poly([(0, 0), (1, 0), (1, 1), (0, 1)], GRASS, 0.6, wob=0.2)
    T.tufts([(0, 0), (0.22, 0), (0.12, 0.4), (0.12, 0.72), (0.32, 0.84), (0.32, 1), (0, 1)], 40)
    T.tufts([(0.82, 0), (1, 0), (1, 1), (0.72, 1), (0.74, 0.7), (0.72, 0.56), (0.82, 0.3)], 44)

    brink = [(0.34, 0.56), (0.36, 0.46), (0.43, 0.39), (0.52, 0.37), (0.61, 0.39), (0.68, 0.46), (0.70, 0.56)]
    brink = [(p[0], p[1]) for p in smooth_poly([np.array(p) for p in brink], 2, closed=False)]
    upper = [(0.24, 0), (0.80, 0), (0.80, 0.30), (0.76, 0.50), (0.70, 0.56)] + brink[::-1] + [(0.33, 0.62), (0.33, 0.80), (0.21, 0.74), (0.13, 0.58), (0.15, 0.36)]
    water(T, upper, src=(0.52, 0.0), marks=16, t0=0.26, dur=0.4, region=[(0.28, 0.02), (0.78, 0.02), (0.74, 0.34), (0.3, 0.34), (0.16, 0.5), (0.2, 0.34)])
    with T.st('ground'):
        for (a, b) in ((0.40, 0.16), (0.60, 0.24), (0.50, 0.08), (0.68, 0.10)):          # rapids rocks
            T.blob(a, b, 0.018, 0.014, ROCKW, 0.3, seed=int(a * 100))
        # goat island, splitting the river between the two falls
        T.poly(smooth_poly([np.array(p_) for p_ in [(0.24, 0.39), (0.31, 0.47), (0.325, 0.575), (0.27, 0.62), (0.21, 0.56), (0.20, 0.45)]], 2), GRASS, 0.4)
    tree(T, 0.25, 0.47, 0.8, FOREST, 'round')
    tree(T, 0.285, 0.55, 0.7, ACCENT, 'round')

    # ---- the gorge: the plunge pool lies GD below, seen through the opening
    gorge = brink + [(0.72, 0.70), (0.70, 1.0), (0.34, 1.0), (0.33, 0.80), (0.33, 0.62)]
    pool_wave = Wave(T.P(0.52, 0.42, -GD), 0.66, 0.45, 150.0, foam=True, seed=3)
    import skia as _sk
    clip = _sk.Path()
    clip.addPoly([_sk.Point(*map(float, T.P(p_[0], p_[1]))) for p_ in gorge], True)
    notch = _sk.Path()
    notch.addPoly([_sk.Point(*map(float, T.P3(p_))) for p_ in [(0.34, 1, 0.004), (0.70, 1, 0.004), (0.70, 1, -GD), (0.34, 1, -GD)]], True)
    clip = _sk.Op(clip, notch, _sk.PathOp.kUnion_PathOp)
    with T.st('ground'):
        T.poly(gorge, (184, 172, 152), 0.0, tk=0.2)                     # dry gorge floor / right wall in shadow
        pool = T.poly([(p_[0], p_[1], -GD) for p_ in gorge], DEEP, 0.0, wave=pool_wave)
        pool.clip = clip
        T.line([(0.70, 0.56), (0.72, 0.70), (0.70, 1.0)], 0.46)
        T.line([(0.34, 1, -GD), (0.70, 1, -GD)], 0.4)
    for (a, b) in ((0.50, 0.60), (0.58, 0.72), (0.46, 0.80), (0.60, 0.90), (0.44, 0.94), (0.52, 0.50)):
        P_ = T.P(a, b, -GD)
        with T.grp('fade', t0=1.05, dur=0.2, pivot=P_, motion=pr.shimmer, stage='life'):
            T.line2(P_, smooth_poly([(-2.4, 0.3), (-1.1, -0.75), (0.1, 0.0), (1.3, 0.6), (2.4, 0.05)], 1, closed=False), 0.42, FOAM, wob=0)
    # left wall of the gorge (faces us): rock - american falls - rock
    def wallq(a, b, col, ink=0.36):
        return T.poly([(a[0], a[1], 0), (b[0], b[1], 0), (b[0], b[1], -GD), (a[0], a[1], -GD)], col, ink, stage='ground', tk=0.24)
    wallq((0.34, 0.56), (0.33, 0.62), ROCKW)
    wallq((0.33, 0.80), (0.34, 1.0), ROCKW)
    T.lines([[(0.335, 0.86, -0.03), (0.338, 0.97, -0.034)], [(0.335, 0.84, -0.07), (0.338, 0.95, -0.075)]], 0.26, STONE_D, stage='detail')

    def curtain(path, t0, phase, seed):
        """Falling water: the sheet pours down from the brink, then streaks keep falling."""
        top = [np.array(T.P(p[0], p[1], 0)) for p in path]
        drop = np.array([0, GD * ZS])
        rr_ = __import__('random').Random(seed)
        streaks = [(rr_.uniform(0.03, 0.97), rr_.uniform(0, 1), rr_.uniform(0.7, 1.3)) for _ in range(int(len(path) * 2.6))]
        cum = [0.0]
        for k in range(1, len(top)):
            cum.append(cum[-1] + float(np.hypot(*(top[k] - top[k - 1]))))

        def at(q):
            d = q * cum[-1]
            for k in range(1, len(top)):
                if d <= cum[k] or k == len(top) - 1:
                    f = (d - cum[k - 1]) / max(1e-6, cum[k] - cum[k - 1])
                    return top[k - 1] + (top[k] - top[k - 1]) * f
            return top[-1]

        def draw(c, tau, t, a, R):
            x = (tau - t0) / 0.32
            if x <= 0:
                return
            e = ease.out_back(min(1.0, x), 1.2) if x < 1 else 1.0
            e = min(e, 1.03)
            poly = top + [p + drop * e + np.array([0, 0.8 * math.sin(k * 1.7 + t * 9)]) for k, p in enumerate(top)][::-1]
            R.poly(c, poly, fill=(214, 234, 244), ink=None, a=a)
            for (q, ph, sp) in streaks:
                p = at(q)
                s_ = (t * 1.5 * sp + ph) % 1.0
                y0 = s_ * e
                y1 = min(e, y0 + 0.26)
                R.poly(c, [p + drop * y0, p + drop * y1], ink=FOAM, w=0.5, a=a, closed=False)
            for k in range(0, len(top), 3):
                R.poly(c, [top[k], top[k] + drop * e], ink=WATER_D, w=0.22, a=a * 0.8, closed=False)
            R.poly(c, top, ink=INK, w=0.4, a=a, closed=False)
            if x > 0.8:
                # churned foam where the sheet lands
                bot = [p + drop + np.array([0, 0.9 * math.sin(k * 2.1 + t * 7)]) for k, p in enumerate(top)]
                R.poly(c, bot, ink=FOAM, w=1.5, a=a * min(1.0, (x - 0.8) * 3), closed=False)
        T.custom(draw, top + [top[0] + drop, top[-1] + drop], stage='ground')
    curtain([(0.33, 0.62 + 0.18 * k / 8.0) for k in range(9)], 0.58, 0.0, 2)
    curtain(brink, 0.50, 0.0, 1)
    T.guide([[(p[0], p[1], 0) for p in brink], [(p[0], p[1], -GD) for p in brink], [(0.52, 0.37, 0), (0.52, 0.37, -GD)], [(0.34, 0.56, 0), (0.34, 0.56, -GD)],
             [(0.70, 0.56, 0), (0.70, 0.56, -GD)]], ticks=3).tp = 0.1
    # the river leaving the slab: a last fall off the edge of the world
    lip = [(0.34 + 0.36 * k / 8.0, 1.0) for k in range(9)]
    top = [np.array(T.P(p[0], p[1], -GD)) for p in lip]
    fall = np.array([0, (TH - GD) * ZS + 4.0])

    def edge_fall(c, tau, t, a, R):
        x = (tau - 0.98) / 0.4
        if x <= 0:
            return
        e = ease.out_cubic(min(1.0, x))
        poly = top + [p + fall * e * (0.95 + 0.05 * math.sin(k * 2.3 + t * 5)) for k, p in enumerate(top)][::-1]
        R.poly(c, poly, fill=(206, 230, 242), a=a * 0.96)
        for k in range(22):
            q = (k * 0.618) % 1.0
            p = top[0] + (top[-1] - top[0]) * q
            s_ = (t * 1.3 + k * 0.37) % 1.0
            R.poly(c, [p + fall * e * s_ * 0.8, p + fall * e * min(1.0, s_ * 0.8 + 0.2)], ink=FOAM, w=0.5, a=a, closed=False)
        R.poly(c, top, ink=INK, w=0.4, a=a, closed=False)
    T.custom(edge_fall, top + [top[0] + fall, top[-1] + fall], stage='detail')

    # ---- rainbow bridge across the gorge
    bz = 0.0
    A, B = (0.335, 0.90), (0.705, 0.90)
    arc = [(A[0] + (B[0] - A[0]) * q, 0.90, -0.085 + 0.08 * math.sin(math.pi * q)) for q in np.linspace(0, 1, 15)]
    T.line(arc, 0.7, ZINC)
    T.lines([[(p[0], 0.90, p[2]), (p[0], 0.90, 0.004)] for p in arc[1:-1:2]], 0.26, ZINC, stage='detail')
    T.box(0.32, 0.885, 0.40, 0.03, 0.007, z=0.0, c=STONE, ink=0.38, guide=True)

    # ---- town on the right bank: tower, hotels, maples
    T.box(0.86, 0.12, 0.09, 0.08, 0.10, c=MARBLE, ink=0.42)
    T.rects('L', 0.86, 0.95, 0.20, 0.008, 0.095, 4, 5, fill=(150, 170, 196), ink=0.12, fw=0.55, fh=0.55)
    T.rects('R', 0.12, 0.20, 0.95, 0.008, 0.095, 3, 5, fill=(132, 152, 180), ink=0.12, fw=0.55, fh=0.55)
    T.box(0.88, 0.26, 0.08, 0.07, 0.06, c=ROSE, ink=0.4, guide=False)
    T.rects('L', 0.88, 0.96, 0.33, 0.008, 0.055, 3, 3, fill=(150, 170, 196), ink=0.12, fw=0.55, fh=0.55)
    # observation tower
    su, sv = 0.86, 0.46
    T.guide_axis(su, sv, 0.36, ticks=8)
    T.rev(su, sv, [(0.012, 0), (0.008, 0.1), (0.008, 0.27)], c=MARBLE, ink=0.38, guide=False)
    T.rev(su, sv, [(0.014, 0), (0.034, 0.016), (0.034, 0.034), (0.02, 0.046)], z=0.27, c=ACCENT, ink=0.38, guide=False, cap=ACCENT_L)
    T.line([(su, sv, 0.316), (su, sv, 0.36)], 0.36, stage='detail')
    pr.lamp(T, T.P(su, sv, 0.362), 0.9, ACCENT_L, t0=1.3)
    # railings + promenade
    with T.st('ground'):
        T.poly([(0.725, 0.56), (0.78, 0.50), (0.80, 0.56), (0.80, 0.86), (0.735, 0.86), (0.745, 0.70)], (236, 228, 212), 0.34)
        T.poly([(0.12, 0.76), (0.31, 0.845), (0.31, 0.87), (0.10, 0.80)], (236, 228, 212), 0.3)
    T.lines([[(0.733, 0.58 + k * 0.03, 0), (0.733, 0.58 + k * 0.03, 0.02)] for k in range(10)] + [[(0.733, 0.58, 0.02), (0.74, 0.85, 0.02)]], 0.26, stage='detail')
    maples = [(0.03, 0.10), (0.12, 0.06), (0.06, 0.24), (0.04, 0.44), (0.05, 0.62), (0.07, 0.90), (0.18, 0.92), (0.26, 0.96), (0.84, 0.62), (0.93, 0.70), (0.88, 0.80),
              (0.95, 0.90), (0.80, 0.94), (0.92, 0.40), (0.97, 0.52), (0.16, 0.20), (0.87, 0.04), (0.97, 0.04)]
    maples.sort(key=lambda p_: p_[0] + p_[1])
    for k, (a, b) in enumerate(maples):
        tree(T, a, b, r.uniform(0.8, 1.05), ACCENT if k % 3 == 0 else (JUNGLE if k % 3 == 1 else FOREST), 'round' if k % 4 else 'fir')

    # ---- life
    # maid of the mist, nosing into the spray
    Mp = T.P(0.52, 0.66, -GD)
    with T.grp('pop', pivot=Mp, t0=1.16, motion=cruise(0.0, -0.06, 0.9, 0.5, 1.5), stage='life', dur=0.28):
        pr.hull(T, 0.52, 0.66, 0.05, 0.11, 0.012, 'v', MARBLE, z=-GD, blunt=0.5)
        T.box(0.508, 0.635, 0.024, 0.05, 0.014, z=-GD + 0.013, c=ZINC, ink=0.3, guide=False)
        for k in range(5):
            pp = T.P(0.512 + (k % 2) * 0.016, 0.69 + k * 0.006, -GD + 0.013)
            T.poly2(pp, [(-0.8, 0), (0.8, 0), (0.7, -2.0), (-0.7, -2.0)], ACCENT, 0.24, wob=0)
            T.ell2(pp + np.array([0, -2.8]), 0.9, fill=SKIN[k % 5], ink=0.24, n=8, wob=0)
    crowd(T, [(0.745, 0.57), (0.795, 0.57), (0.795, 0.85), (0.745, 0.85)], 8, mind=0.025, walk_frac=0.3)
    crowd(T, [(0.33, 0.888), (0.71, 0.888), (0.71, 0.908), (0.33, 0.908)], 5, z=0.008, walk_frac=0, mind=0.04)
    crowd(T, [(0.12, 0.775), (0.30, 0.85), (0.30, 0.865), (0.11, 0.795)], 4, mind=0.03)
    for (a, b) in ((0.76, 0.64), (0.775, 0.74)):
        person(T, a, b, shirt=ACCENT, pants=ACCENT)
    # mist boiling up from the foot of the falls, a rainbow hanging in it
    for k, (a, b, z, s_) in enumerate(((0.45, 0.44, -GD + 0.01, 0.8), (0.58, 0.45, -GD + 0.012, 0.75), (0.52, 0.43, -GD + 0.03, 0.9), (0.37, 0.70, -GD + 0.01, 0.6))):
        pr.cloud(T, a, b, z, s_, t0=1.0 + 0.06 * k, drift=1.2, edge=(176, 196, 214), alpha=0.9)
    for k, (a, s_) in enumerate(((0.40, 0.7), (0.52, 0.9), (0.64, 0.7))):
        pr.cloud(T, a, 1.0, -TH - 0.05, s_, t0=1.2 + 0.05 * k, drift=1.5, edge=(176, 196, 214), alpha=0.9)
    Rb = T.P(0.60, 0.70, -GD)
    with T.st('sky'):
        with T.grp('fade', t0=1.3, dur=0.5, pivot=Rb, stage='sky'):
            for k, c_ in enumerate((TERRA, ACCENT, ACCENT_L, (160, 200, 150), WATER_D)):
                T.ell2(Rb, 17 - k * 0.9, 15 - k * 0.9, fill=None, ink=0.9, inkc=c_, a0=math.pi * 1.08, a1=math.pi * 1.72, closed=False, wob=0, sky=True, alpha=0.75)
    pr.glint(T, T.P(su, sv, 0.37), 0.8)
    pr.bird(T, 0.5, 0.2, 0.2, 0.8, orbit=(9, 3))
    pr.bird(T, 0.56, 0.24, 0.24, 0.7, orbit=(8, 3))
    pr.cloud(T, 0.10, 0.20, 0.36, 0.9)


BUILDERS = {'reef': reef, 'machu': machu, 'chichen': chichen, 'niagara': niagara}
