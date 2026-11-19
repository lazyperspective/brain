"""Satellites: small islands of wonder floating in the notches of the map."""
import math

import numpy as np

from .core import W, ZS, SLAB, smooth_poly, Wave, argb
from .pal import *  # noqa
from . import props as pr
from . import ease
from .props import person, tree, crowd, grove, water, walker, bobber, cruise, runner, stroll
from .tiles_a import sm, ARCH_DK, dune

SARSEN = (200, 198, 192)


def island(T, cu, cv, ru, rv, c, seed, ink=0.5, sea=None, sea_grow=1.5, t_sea=0.2, keel=18.0):
    """Organic base for a satellite: a patch of ground (and, optionally, sea) floating free of the map,
    with a keel of rock and roots hanging beneath it."""
    T.foot = (cu, cv, ru * 1.05, rv * 1.05)
    outer = None
    with T.st('slab'):
        if sea is not None:
            T.blob(cu + sea[0], cv + sea[1], ru * sea_grow, rv * sea_grow, None, 0.0, seed=seed + 7, irr=0.16)
            reg = list(T._last_blob)
            T.shapes.pop()
            outer = reg
            water(T, reg, src=(cu, cv), marks=int(26 * ru * sea_grow), t0=t_sea, dur=0.4, shore=0.42, stage='slab')
        g = T.blob(cu, cv, ru, rv, c, ink, seed=seed, irr=0.2)
    ground = list(T._last_blob)
    if keel:
        _keel(T, outer or ground, keel, seed)
    return ground


def _keel(T, outline, depth, seed):
    import random as _r
    r = _r.Random(seed * 31 + 7)
    P = [np.array(T.P(u, v)) for u, v in outline]
    il = min(range(len(P)), key=lambda k: P[k][0])
    ir = max(range(len(P)), key=lambda k: P[k][0])
    n = len(P)
    # walk from the leftmost to the rightmost point both ways; keep the chain that passes underneath
    ch1 = [P[(il + k) % n] for k in range(((ir - il) % n) + 1)]
    ch2 = [P[(il - k) % n] for k in range(((il - ir) % n) + 1)]
    low = ch1 if np.mean([p[1] for p in ch1]) > np.mean([p[1] for p in ch2]) else ch2
    low = low[::max(1, len(low) // 18)] + [low[-1]]
    x0, x1 = low[0][0], low[-1][0]
    UR = (150, 136, 126)
    hang = []
    for k, p in enumerate(low):
        f = (p[0] - x0) / (x1 - x0 + 1e-9)
        d = depth * math.sin(math.pi * min(1.0, max(0.0, f))) ** 0.6 * (r.uniform(0.7, 1.05) if k % 2 else r.uniform(0.45, 0.75))
        hang.append(p + np.array([r.uniform(-1, 1) if 0 < k < len(low) - 1 else 0.0, d if 0 < k < len(low) - 1 else 0.0]))
    mid = len(low) // 2
    with T.at('start'), T.st('slab'):
        T._add([low + hang[::-1]], True, UR, 0.5, wob=0.2)
        T._add([low[mid:] + hang[mid:][::-1]], True, shade(UR, 0.85), 0.0, wob=0.2)
        T._add([[low[k] + np.array([0, 1.5]), (low[k] + hang[k]) / 2 + np.array([r.uniform(-1.2, 1.2), 0])] for k in range(2, len(low) - 2, 2)], False, None, 0.26, shade(UR, 0.62), stage='detail')
        T._add([[hang[k], hang[k] + np.array([r.uniform(-1.5, 1.5), r.uniform(3, 7)])] for k in range(1, len(low) - 1, 3)], False, None, 0.26, (120, 92, 66), stage='detail')


# ========================================================== STONEHENGE ====
def stonehenge(T):
    reg = island(T, 0.5, 0.5, 0.36, 0.34, GRASS, 3)
    r = T.rng
    T.tufts(reg, 50)
    cu, cv = 0.5, 0.5
    with T.st('ground'):
        T.poly(T.ring(cu, cv, 0.27, n=30)[:-1], None, 0.3, inkc=GRASS_D)
        T.poly(T.ring(cu, cv, 0.20, n=30)[:-1], (196, 214, 166), 0.3, inkc=GRASS_D)
    T.guide([T.ring(cu, cv, 0.20, n=30), [(cu - 0.3, cv, 0), (cu + 0.3, cv, 0)], [(cu, cv - 0.3, 0), (cu, cv + 0.3, 0)]], ticks=6)

    def stone(u, v, du, dv, h, c=SARSEN):
        T.box(u - du / 2, v - dv / 2, du, dv, h, c=c, ink=0.4, guide=False)
    # sarsen circle: uprights with lintels, drawn back to front
    n = 14
    R = 0.20
    items = []
    for k in range(n):
        a = 2 * math.pi * k / n + 0.2
        items.append((cu + R * math.cos(a), cv + R * math.sin(a), k))
    # inner trilithon horseshoe
    inner = [(cu - 0.06, cv - 0.07), (cu + 0.03, cv - 0.10), (cu + 0.09, cv - 0.02), (cu - 0.09, cv + 0.02)]
    every = [(u, v, 'o', k) for (u, v, k) in items] + [(u, v, 'i', k) for k, (u, v) in enumerate(inner)]
    every.sort(key=lambda e: e[0] + e[1])
    missing = {3, 4, 9}
    for (u, v, kind, k) in every:
        if kind == 'o':
            if k in missing:
                if k == 4:
                    T.box(u - 0.04, v - 0.012, 0.08, 0.026, 0.016, c=SARSEN, ink=0.36, guide=False)     # a fallen stone
                continue
            stone(u, v, 0.034, 0.03, 0.105)
            if k % 2 == 0 and (k + 1) % n not in missing:
                u2, v2, _ = items[(k + 1) % n]
                # lintel bridging to the next upright
                mx, my = (u + u2) / 2, (v + v2) / 2
                if abs(u2 - u) > abs(v2 - v):
                    with T.grp('drop', t0=0.9 + 0.03 * k, dur=0.34, pivot=T.P(mx, my, 0.105), off=(0, 18), stage='struct'):
                        T.box(min(u, u2) - 0.014, my - 0.016, abs(u2 - u) + 0.028, 0.032, 0.022, z=0.105, c=shade(SARSEN, 1.04), ink=0.38, guide=False)
                else:
                    with T.grp('drop', t0=0.9 + 0.03 * k, dur=0.34, pivot=T.P(mx, my, 0.105), off=(0, 18), stage='struct'):
                        T.box(mx - 0.016, min(v, v2) - 0.014, 0.032, abs(v2 - v) + 0.028, 0.022, z=0.105, c=shade(SARSEN, 1.04), ink=0.38, guide=False)
        else:
            stone(u - 0.022, v, 0.026, 0.03, 0.14, c=shade(SARSEN, 0.97))
            stone(u + 0.022, v, 0.026, 0.03, 0.14, c=shade(SARSEN, 0.97))
            with T.grp('drop', t0=1.0 + 0.04 * k, dur=0.36, pivot=T.P(u, v, 0.14), off=(0, 20), stage='struct'):
                T.box(u - 0.04, v - 0.017, 0.08, 0.034, 0.024, z=0.14, c=SARSEN, ink=0.38, guide=False)
    stone(0.80, 0.60, 0.03, 0.03, 0.06)        # heel stone
    for (a, b, f) in ((0.24, 0.66, False), (0.30, 0.74, True), (0.20, 0.52, False), (0.70, 0.80, True), (0.80, 0.44, True), (0.26, 0.38, False)):
        pr.sheep(T, a, b, flip=f, walk=walker(0.04 * (-1 if f else 1), 0.01, r.uniform(9, 15)))
    crowd(T, [(0.56, 0.70), (0.76, 0.66), (0.72, 0.80), (0.56, 0.82)], 5, mind=0.04)
    person(T, 0.47, 0.50, shirt=MARBLE, pants=MARBLE, arms=True)      # a druid at the altar stone
    Bk = T.P(0.36, 0.84)
    T.poly2(Bk, [(-3.4, 0), (0, -1.7), (3.4, 0), (0, 1.7)], ACCENT, 0.26, wob=0, stage='detail')
    person(T, 0.37, 0.85, shirt=ROSE)
    pr.flock(T, 0.5, 0.5, 0.30, 6, orbit=(22, 7))
    stroll(T, [(0.30, 0.60), (0.50, 0.76), (0.72, 0.62)], 5)
    pr.cloud(T, 0.22, 0.26, 0.34, 0.8)
    pr.glint(T, T.P(cu, cv, 0.18), 0.8)


# ======================================================= NORTHERN LIGHTS ====
def aurora(T):
    reg = island(T, 0.5, 0.52, 0.30, 0.27, SNOW, 5, sea=(0.02, 0.02), sea_grow=1.42)
    r = T.rng
    with T.st('ground'):
        T.blob(0.56, 0.60, 0.17, 0.12, ICE, 0.0, seed=8)
        T.blob(0.16, 0.86, 0.06, 0.045, SNOW, 0.36, seed=9)      # ice floes
        T.blob(0.86, 0.30, 0.05, 0.04, SNOW, 0.36, seed=10)
    # igloo
    T.dome(0.42, 0.50, 0.075, 0.06, c=SNOW, guide=True, ink=0.44, shade_f=0.9)
    C = T.P(0.42, 0.50)
    T.lines2(C, [[(-9, -3.6), (9, -3.2)], [(-6.4, -6.0), (6.6, -5.6)], [(-4.5, -1.0), (-4.3, -3.5)], [(2.5, -0.6), (2.6, -3.3)], [(-1.0, -3.6), (-0.9, -5.9)],
                 [(5.6, -3.3), (5.4, -5.6)]], 0.24, MARBLE_D, stage='detail')
    T.arch('L', 0.42, 0.575, 0.0, 0.034, 0.036, fill=DARK, ink=0.3)
    # cabin with a lit window
    T.house(0.60, 0.40, 0.08, 0.06, 0.035, 0.026, wall=TERRA, roof=SNOW, axis='u', ink=0.4, door=False)
    win = T.P(0.64, 0.46, 0.02)
    pr.lamp(T, win, 1.1, ACCENT_L, t0=1.1)
    for (a, b) in ((0.70, 0.56), (0.76, 0.46), (0.30, 0.36), (0.24, 0.48)):
        tree(T, a, b, 0.85, JUNGLE, 'fir')
    pr.bear(T, 0.44, 0.71, s=1.2, walk=walker(0.12, 0.0, 14))
    pr.bear(T, 0.165, 0.865, s=0.62, flip=True)
    person(T, 0.56, 0.50, shirt=ACCENT, hat=TERRA, arms=True)
    # sled with a dog
    pr.quad(T, 0.30, 0.62, 3.6, 1.8, 1.4, (0.8, -0.8), (1.3, 0.9), (150, 150, 156), s=0.8, walk=walker(0.07, -0.03, 6))
    person(T, 0.66, 0.60, shirt=ZINC, hat=ACCENT, path=[(0.66, 0.60), (0.56, 0.64), (0.52, 0.56)])

    # ---- the aurora: a scrap of polar night hangs over the island, and across it curtains of light
    #      unfurl, ripple, drift sideways and slowly change colour
    from .timeline import EV as _EV
    EV_A = _EV['aurora_everest']
    base = T.P(0.5, 0.5, 0.36)
    NIGHT = vivid((44, 52, 104))
    nc = base + np.array([4.0, -16.0])
    rr_ = __import__('random').Random(5)
    nb = []
    for k in range(13):
        a_ = 2 * math.pi * k / 13
        q = 1 + rr_.uniform(-0.12, 0.12)
        nb.append(np.array([47.0 * q * math.cos(a_), 21.0 * q * math.sin(a_)]))
    nb = smooth_poly(nb, 3)
    stars = [(rr_.uniform(-38, 38), rr_.uniform(-15, 13), rr_.uniform(0, 6.28)) for _ in range(16)]
    bands = [((70, 232, 150), -36, 6, 30, 0.0), ((90, 214, 236), -14, -1, 30, 1.7), ((126, 236, 170), 6, 5, 26, 4.4), ((214, 120, 232), 18, -3, 22, 3.1)]

    def draw(c, tau, t, a, R):
        x = (tau - 0.9) / 0.5
        if x <= 0:
            return
        g0 = ease.out_back(min(1.0, x), 1.4)
        R.poly(c, [nc + p_ * g0 for p_ in nb], fill=NIGHT, ink=INK, w=0.5, a=a * min(1.0, x * 3))
        if x < 0.5:
            return
        import skia as _sk
        cp = _sk.Path()
        cp.addPoly([_sk.Point(float(nc[0] + p_[0] * 0.965), float(nc[1] + p_[1] * 0.95)) for p_ in nb], True)
        c.save()
        c.clipPath(cp, _sk.ClipOp.kIntersect, True)
        for (sx_, sy_, ph) in stars:
            tw = 0.5 + 0.5 * math.sin(t * 3.1 + ph)
            R.fill(c, pr.skia_circle(nc[0] + sx_, nc[1] + sy_, 0.3 + 0.3 * tw), (255, 250, 226), a * (0.45 + 0.55 * tw))
        y2 = (tau - 1.15) / 0.6
        if y2 > 0:
            grow = ease.out_back(min(1.0, y2), 1.3)
            al = min(1.0, y2 * 2.0)
            for bi, (col, ox, oy, width, ph) in enumerate(bands):
                # colours breathe: each band leans toward its neighbour's hue and back
                col = mix(col, bands[(bi + 1) % 4][0], 0.5 + 0.5 * math.sin(t * 0.55 + ph))
                col = vivid(col)
                sl = 7.0 * math.sin(t * 0.33 + ph)                    # the whole curtain slides
                n = 22
                top, bot = [], []
                for k in range(n + 1):
                    q = k / n
                    xx = ox + sl + width * q
                    wv_ = 3.0 * math.sin(q * 5.0 + t * 1.7 + ph) + 1.5 * math.sin(q * 11.0 - t * 2.6 + ph)
                    yb = oy + wv_ + 4.0 * math.sin(q * 3.1 + ph + t * 0.4)
                    hgt = (17 + 7 * math.sin(q * 7 + ph * 2 + t * 1.1)) * grow * (1.0 + 0.5 * math.exp(-((t - EV_A) / 1.2) ** 2))
                    bot.append(base + np.array([xx, yb - 9.0]))
                    top.append(base + np.array([xx + 2.5 * math.sin(t * 0.8 + q * 4), yb - 9.0 - hgt]))
                m1 = [b_ + (t_ - b_) * 0.34 for b_, t_ in zip(bot, top)]
                m2 = [b_ + (t_ - b_) * 0.68 for b_, t_ in zip(bot, top)]
                R.pf.setColor(argb(col, 0.92 * al * a)); c.drawPath(_pp(bot + m1[::-1]), R.pf)
                R.pf.setColor(argb(col, 0.6 * al * a)); c.drawPath(_pp(m1 + m2[::-1]), R.pf)
                R.pf.setColor(argb(col, 0.3 * al * a)); c.drawPath(_pp(m2 + top[::-1]), R.pf)
                lite = mix(col, (255, 255, 255), 0.6)
                for k in range(0, n + 1, 2):
                    fl = 0.5 + 0.5 * math.sin(t * 4.0 + k * 1.3 + ph)
                    R.ps.setColor(argb(lite, 0.8 * al * a * fl)); R.ps.setStrokeWidth(0.4)
                    e_ = m2[k] + (top[k] - m2[k]) * 0.6
                    c.drawLine(float(bot[k][0]), float(bot[k][1]), float(e_[0]), float(e_[1]), R.ps)
                R.ps.setColor(argb(lite, al * a)); R.ps.setStrokeWidth(0.9)
                c.drawPath(_pp(bot, False), R.ps)
        c.restore()
        R.poly(c, [nc + p_ * g0 for p_ in nb], ink=INK, w=0.5, a=a)
    T.custom(draw, [nc + np.array([-52, -26]), nc + np.array([52, 26])], sky=True, stage='sky')
    pr.smoke(T, T.P(0.62, 0.42, 0.064), 0.75, lean=5)
    T.box(0.615, 0.415, 0.012, 0.012, 0.02, z=0.05, c=TERRA, ink=0.28, guide=False)


def _pp(pts, closed=True):
    import skia as _sk
    p = _sk.Path()
    p.addPoly([_sk.Point(float(x), float(y)) for x, y in pts], closed)
    return p


# ================================================================ MOAI ====
BASALT = (150, 144, 140)


def moai(T):
    reg = island(T, 0.5, 0.5, 0.34, 0.30, GRASS, 12, sea=(0.05, -0.06), sea_grow=1.36)
    r = T.rng
    T.tufts(reg, 40)
    with T.st('ground'):
        T.blob(0.30, 0.62, 0.12, 0.08, (196, 214, 166), 0.0, seed=2)
    # the ahu (platform), running along u, statues facing inland (+v)
    T.box(0.20, 0.34, 0.56, 0.085, 0.022, c=STONE, ink=0.42)
    T.box(0.18, 0.425, 0.60, 0.03, 0.008, c=STONE_D, ink=0.34, guide=False)

    def statue(u, s, hat=False):
        P = T.P(u, 0.385, 0.022)
        g = T.guide([[P + np.array([0, 0]), P + np.array([0, -17 * s])]], ticks=4, px=True)
        with T.grp('tower', t0=0.5 + 0.5 * (u - 0.2), dur=0.26, pivot=P, stage='struct', ink_now=True, under=PAPER):
            body = [(-3.0 * s, 0), (3.0 * s, 0), (2.8 * s, -6.5 * s), (2.0 * s, -7.4 * s), (2.2 * s, -15.0 * s), (-2.2 * s, -15.0 * s), (-2.0 * s, -7.4 * s), (-2.8 * s, -6.5 * s)]
            T.poly2(P, body, BASALT, 0.42, wob=0.06)
            T.poly2(P, [(0.6 * s, 0), (3.0 * s, 0), (2.8 * s, -6.5 * s), (2.0 * s, -7.4 * s), (2.2 * s, -15.0 * s), (1.0 * s, -15.0 * s), (1.2 * s, -7.6 * s)], shade(BASALT, 0.86), 0, wob=0.06)
            # brow, nose, mouth, long ears
            T.lines2(P, [[(-2.2 * s, -12.6 * s), (2.2 * s, -12.6 * s)], [(0, -12.6 * s), (-0.5 * s, -9.6 * s), (0.6 * s, -9.6 * s)], [(-1.0 * s, -8.5 * s), (1.0 * s, -8.5 * s)],
                         [(-2.3 * s, -12.0 * s), (-2.5 * s, -8.4 * s)], [(2.3 * s, -12.0 * s), (2.5 * s, -8.4 * s)], [(-1.8 * s, -4.4 * s), (1.8 * s, -4.4 * s)]], 0.3, INK, wob=0)
            if hat:
                T.poly2(P, [(-2.4 * s, -15.0 * s), (2.4 * s, -15.0 * s), (2.1 * s, -18.2 * s), (-2.1 * s, -18.2 * s)], ACCENT_D, 0.38, wob=0.05)
    for k, (u, s, hat) in enumerate(((0.27, 0.95, False), (0.38, 1.1, True), (0.49, 1.0, False), (0.60, 1.15, False), (0.70, 0.9, True))):
        statue(u, s, hat)
    # one fallen, face down
    T.box(0.60, 0.68, 0.12, 0.035, 0.02, c=BASALT, ink=0.38, guide=False)
    pr.horse(T, 0.32, 0.60, walk=walker(0.06, 0.0, 10))
    pr.horse(T, 0.42, 0.69, col=(110, 84, 70), flip=True, s=0.9, walk=walker(-0.06, 0.0, 12))
    stroll(T, [(0.22, 0.47), (0.50, 0.48), (0.76, 0.47)], 6, hat=MARBLE)
    crowd(T, [(0.40, 0.52), (0.70, 0.52), (0.70, 0.64), (0.40, 0.64)], 4, hat=MARBLE, mind=0.05)
    tree(T, 0.78, 0.56, 0.9, FOREST, 'palm')
    tree(T, 0.16, 0.44, 0.8, FOREST, 'palm')
    pr.rowboat(T, 0.78, 0.20, 'u', c=TERRA, crew=2, motion=cruise(0.06, 0.02, 0.6))
    pr.flock(T, 0.5, 0.4, 0.36, 6, orbit=(20, 6))
    pr.glint(T, T.P(0.38, 0.385, 0.022) + np.array([0, -21]), 0.7)


# ==================================================== SYDNEY OPERA HOUSE ====
def opera(T):
    reg = island(T, 0.48, 0.50, 0.26, 0.22, (232, 214, 196), 21, sea=(0.04, 0.05), sea_grow=1.7)
    r = T.rng
    # podium of pink granite, broad steps
    T.box(0.24, 0.36, 0.44, 0.31, 0.03, c=(232, 206, 190), ink=0.44)
    T.lines([[(0.26 + 0.44 * 0.0, 0.66, 0.01 * k), (0.70, 0.66, 0.01 * k)] for k in (1, 2)], 0.24, STONE_D, stage='detail')

    def shell(u, v, s):
        """one sail of the roof: a tall shell whose mouth opens toward the harbour (+u)"""
        P = T.P(u, v, 0.03)
        back = [(-6.2 * s, 1.0 * s), (-5.4 * s, -6.0 * s), (-2.6 * s, -12.5 * s), (2.2 * s, -17.5 * s), (6.4 * s, -19.5 * s)]
        mouth = [(6.4 * s, -19.5 * s), (6.6 * s, -12.0 * s), (5.6 * s, -4.0 * s), (4.0 * s, 3.2 * s)]
        out = smooth_poly(back, 2, closed=False) + smooth_poly(mouth, 2, closed=False)[1:]
        T.poly2(P, out, MARBLE, 0.46, wob=0.05)
        inner = smooth_poly([(6.4 * s, -19.5 * s), (6.6 * s, -12.0 * s), (5.6 * s, -4.0 * s), (4.0 * s, 3.2 * s)], 2, closed=False) + \
            smooth_poly([(4.0 * s, 3.2 * s), (1.4 * s, 2.0 * s), (2.6 * s, -5.0 * s), (4.6 * s, -13.0 * s), (6.4 * s, -19.5 * s)], 2, closed=False)[1:-1]
        T.poly2(P, inner, (150, 176, 200), 0.34, wob=0.05)
        T.lines2(P, [[(-4.2 * s, 0.6 * s), (5.6 * s, -18.6 * s)], [(-1.6 * s, 1.2 * s), (6.0 * s, -17.6 * s)]], 0.2, MARBLE_D, wob=0)
    T.guide([[(0.30, 0.44, 0.03), (0.66, 0.44, 0.03)], [(0.30, 0.58, 0.03), (0.66, 0.58, 0.03)], [(0.50, 0.44, 0.03), (0.50, 0.44, 0.22)]], ticks=5)
    with T.grp('tower', t0=0.52, dur=0.3, pivot=T.P(0.46, 0.45, 0.03), stage='struct', ink_now=True, under=PAPER):
        for (u, s) in ((0.33, 0.50), (0.42, 0.72), (0.53, 0.95)):
            shell(u, 0.45, s)
    with T.grp('tower', t0=0.62, dur=0.3, pivot=T.P(0.46, 0.60, 0.03), stage='struct', ink_now=True, under=PAPER):
        for (u, s) in ((0.31, 0.55), (0.40, 0.8), (0.51, 1.08)):
            shell(u, 0.60, s)
    crowd(T, [(0.28, 0.68), (0.66, 0.68), (0.62, 0.72), (0.30, 0.72)], 5, mind=0.04)
    tree(T, 0.27, 0.46, 0.8, FOREST, 'palm')
    tree(T, 0.72, 0.42, 0.7, FOREST, 'round')
    # harbour traffic
    pr.steamer(T, 0.50, 0.90, 'u', L=0.15, c=(150, 186, 140), trim=ACCENT_L, motion=cruise(0.14, -0.02, 0.6, 0.2, 0.4))
    pr.sailboat(T, 0.92, 0.40, 'v', s=0.9, motion=cruise(0.0, 0.11, 0.6))
    pr.sailboat(T, 0.16, 0.86, 'u', s=0.75, sail=ACCENT_L, motion=cruise(0.09, 0.0, 0.5))
    pr.sailboat(T, 0.84, 0.24, 'u', s=0.7)
    pr.flock(T, 0.5, 0.5, 0.32, 7, orbit=(24, 7), c=(90, 90, 100))
    stroll(T, [(0.26, 0.695), (0.66, 0.695)], 6, spread=0.01)
    stroll(T, [(0.70, 0.40), (0.70, 0.64)], 3, z=0.03, spread=0.006)
    pr.glint(T, T.P(0.53, 0.45, 0.03) + np.array([6, -19]), 0.8)


# =============================================================== ULURU ====
RED = (224, 176, 140)
ROCK_RED = (204, 118, 80)


def uluru(T):
    reg = island(T, 0.5, 0.47, 0.36, 0.28, RED, 31)
    r = T.rng
    T.speckle(reg, 70, c=(196, 140, 104))
    T.tufts(reg, 34, c=(170, 178, 120))
    C = T.P(0.50, 0.44)
    g = T.guide([[C + np.array([-34, 0]), C + np.array([34, 0])], [C + np.array([0, 4]), C + np.array([0, -22])]], ticks=6, px=True)
    with T.grp('rise', t0=0.4, dur=0.5, pivot=C, stage='struct', ink_now=True, under=PAPER):
        top = [(-30, 1.0), (-28, -7), (-22, -13.5), (-10, -16.5), (4, -17.2), (16, -15.6), (25, -11), (30, -4), (31, 2)]
        bot = [(31, 2), (22, 6.5), (6, 8.5), (-12, 7.5), (-26, 4.5), (-30, 1.0)]
        out = smooth_poly(top, 2, closed=False) + smooth_poly(bot, 2, closed=False)[1:-1]
        T.poly2(C, out, ROCK_RED, 0, wob=0.1)
        T.poly2(C, smooth_poly([(6, -17.0), (16, -15.6), (25, -11), (30, -4), (31, 2), (22, 6.5), (10, 8.2), (12, -4)], 2), shade(ROCK_RED, 0.86), 0, wob=0.1)
        T.poly2(C, smooth_poly([(-27, -7.5), (-22, -13.2), (-10, -16.2), (4, -16.9), (15, -15.2), (10, -13.2), (-4, -14.0), (-18, -11)], 2), (222, 142, 100), 0, wob=0.1)
        T.poly2(C, out, None, 0.5, wob=0.1)
        # erosion gullies
        T.lines2(C, [[(x, -15.0 + abs(x) * 0.12 + 2.5), (x + 0.8, 5.6 - abs(x) * 0.07)] for x in (-24, -19, -13.5, -8, -2, 4, 9.5, 15, 20, 25)], 0.28, shade(ROCK_RED, 0.72), wob=0.2)
    for (a, b, q) in ((0.26, 0.42, 0.6), (0.76, 0.40, 0.5), (0.46, 0.64, 0.7)):
        dune(T, a, b, q, lit=(236, 196, 160), dark=(206, 150, 112))
    for (a, b, k) in ((0.30, 0.62, 'acacia'), (0.72, 0.60, 'acacia'), (0.20, 0.50, 'bush'), (0.80, 0.50, 'bush'), (0.36, 0.70, 'bush')):
        tree(T, a, b, 0.8, (150, 170, 120), k)
    pr.kangaroo(T, 0.18, 0.56, s=1.15, travel=0.10)
    pr.kangaroo(T, 0.25, 0.62, s=0.9, travel=0.10)
    pr.kangaroo(T, 0.84, 0.54, flip=True, s=1.15, travel=0.08)
    # camper van and a campfire
    pr.car(T, 0.62, 0.64, 'u', c=MARBLE, s=1.1, long=1.2)
    F = T.P(0.52, 0.70)
    with T.grp('light', t0=1.2, dur=0.3, pivot=F, stage='life', motion=lambda t, age, ph: (0, 0, 0, 1.0, 0.8 + 0.3 * math.sin(t * 11))):
        T.poly2(F, [(-1.1, 0), (0, -3.0), (1.1, 0)], ACCENT, 0.24, wob=0)
    crowd(T, [(0.54, 0.66), (0.60, 0.68), (0.60, 0.72), (0.54, 0.72)], 3, hat=(226, 200, 150), mind=0.03, walk_frac=0)
    pr.flock(T, 0.5, 0.44, 0.32, 6, orbit=(22, 6), c=(250, 244, 236))      # cockatoos
    pr.smoke(T, F + np.array([0, -3.0]), 0.75, lean=6)
    stroll(T, [(0.22, 0.66), (0.44, 0.72), (0.70, 0.66)], 4, hat=(226, 200, 150))
    pr.glint(T, C + np.array([4, -19]), 0.8)


BUILDERS = {'stonehenge': stonehenge, 'aurora': aurora, 'moai': moai, 'opera': opera, 'uluru': uluru}
