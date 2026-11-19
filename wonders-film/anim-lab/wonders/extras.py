"""Third pass: the small furniture of a lived-in world, on-camera events, and the dream-logic that
holds the map together (water that leaps the gaps, bridges between slabs, falls that pour into the paper)."""
import math
import random

import numpy as np
import skia

from . import ease
from .core import W, ZS, SLAB, argb, smooth_poly
from .pal import *  # noqa
from . import props as pr
from .props import person, stroll, uvd

TAU = 2 * math.pi


def _path(pts, closed=True):
    p = skia.Path()
    p.addPoly([skia.Point(float(x), float(y)) for x, y in pts], closed)
    return p


def appear(t_ev, dur=0.35, until=None):
    """group motion: nothing until global time t_ev, then pop in (and optionally leave again)"""
    def m(t, age, ph):
        x = (t - t_ev) / dur
        if x <= 0:
            return (0.0, 0.0, 0.0, 1.0, 1.0, 0.0)
        s = ease.out_back(min(1.0, x), 2.0)
        a = 1.0
        if until is not None and t > until:
            a = max(0.0, 1 - (t - until) / 0.5)
        return (0.0, 0.0, 0.0, s, s, a)
    return m


# ------------------------------------------------------------- furniture ----
def bench(T, u, v, d='u', z=0.0):
    du, dv = (0.03, 0.009) if d == 'u' else (0.009, 0.03)
    T.box(u, v, du, dv, 0.004, z=z + 0.008, c=WOOD, ink=0.24, guide=False, stage='detail')
    if d == 'u':
        T.poly([(u, v, z + 0.012), (u + du, v, z + 0.012), (u + du, v, z + 0.022), (u, v, z + 0.022)], shade(WOOD, 0.9), 0.24, stage='detail')
    else:
        T.poly([(u, v, z + 0.012), (u, v + dv, z + 0.012), (u, v + dv, z + 0.022), (u, v, z + 0.022)], WOOD, 0.24, stage='detail')
    T.lines([[(u + 0.003, v + dv, z), (u + 0.003, v + dv, z + 0.008)], [(u + du - 0.003, v + dv, z), (u + du - 0.003, v + dv, z + 0.008)]], 0.3, DARK, stage='detail')


def lamp_post(T, u, v, z=0.0, h=0.05, t0=None):
    Q = T.P(u, v, z)
    T.line2(Q, [(0, 0), (0, -h * ZS)], 0.34, DARK, stage='detail')
    T.line2(Q, [(-1.0, 0), (1.0, 0)], 0.5, DARK, stage='detail')
    pr.lamp(T, Q + np.array([0, -h * ZS - 0.7]), 0.85, ACCENT_L, t0=t0 if t0 is not None else 1.2 + T.rng.uniform(0, 0.2), halo=False)


def fence(T, pts, z=0.0, h=0.014, c=MARBLE):
    segs = [[(p[0], p[1], z + h) for p in pts], [(p[0], p[1], z + h * 0.5) for p in pts]]
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.022))
        for q in range(n + 1):
            x, y = a[0] + (b[0] - a[0]) * q / n, a[1] + (b[1] - a[1]) * q / n
            segs.append([(x, y, z), (x, y, z + h * 1.15)])
    T.lines(segs, 0.26, c, stage='detail')


def stall(T, u, v, c=ACCENT, z=0.0, goods=None):
    T.box(u, v, 0.04, 0.024, 0.012, z=z, c=WOOD, ink=0.26, guide=False, stage='detail')
    T.lines([[(u, v + 0.024, z + 0.012), (u, v + 0.024, z + 0.036)], [(u + 0.04, v + 0.024, z + 0.012), (u + 0.04, v + 0.024, z + 0.036)]], 0.26, DARK, stage='detail')
    T.poly([(u - 0.004, v + 0.03, z + 0.034), (u + 0.044, v + 0.03, z + 0.034), (u + 0.044, v - 0.002, z + 0.046), (u - 0.004, v - 0.002, z + 0.046)], c, 0.28, stage='detail')
    T.lines([[(u + 0.04 * q, v + 0.03, z + 0.034), (u + 0.04 * q, v - 0.002, z + 0.046)] for q in (0.25, 0.5, 0.75)], 0.5, MARBLE, stage='detail')
    cols = goods or [TERRA, ACCENT_L, GRASS_D, ROSE]
    for k in range(4):
        T.ell2(T.P(u + 0.006 + k * 0.009, v + 0.012, z + 0.013), 0.7, 0.5, fill=cols[k % len(cols)], ink=0.16, n=7, wob=0, stage='detail')


def potted(T, u, v, z=0.0, c=FOREST):
    Q = T.P(u, v, z)
    T.poly2(Q, [(-0.9, 0), (0.9, 0), (1.1, -1.6), (-1.1, -1.6)], TERRA, 0.24, wob=0, stage='detail')
    T.ell2(Q + np.array([0, -2.7]), 1.5, 1.4, fill=c, ink=0.26, n=9, wob=0, stage='detail')


def flowers(T, region, n, cols=None, z=0.0, seed=None):
    """drifts of wildflowers: tiny bright heads on the grass"""
    cols = cols or [BLOSSOM, MARBLE, ACCENT_L, (178, 150, 220), ROSE]
    pts = T.scatter(region, n, seed=seed, mind=0.012)
    by = {}
    for k, (u, v) in enumerate(pts):
        by.setdefault(k % len(cols), []).append(T.P(u, v, z))
    for k, ps in by.items():
        T._add([[p + np.array([-0.35, 0]), p + np.array([0.35, 0])] for p in ps], False, None, 0.8, cols[k], stage='mark', raw=True)


def rocks(T, pts, s=1.0, c=None, z=0.0):
    c = c or STONE_D
    for k, (u, v) in enumerate(pts):
        r = random.Random(int(u * 977 + v * 131))
        Q = T.P(u, v, z)
        q = s * r.uniform(0.7, 1.3)
        poly = [(-2.0 * q, 0), (-1.5 * q, -1.3 * q), (-0.2 * q, -2.0 * q), (1.4 * q, -1.4 * q), (2.1 * q, 0), (0.6 * q, 0.6 * q), (-1.0 * q, 0.5 * q)]
        T.poly2(Q, poly, c, 0.3, wob=0.05, stage='detail')
        T.poly2(Q, [(-0.2 * q, -2.0 * q), (1.4 * q, -1.4 * q), (2.1 * q, 0), (0.6 * q, 0.6 * q), (0.3 * q, -0.8 * q)], shade(c, 0.84), 0, wob=0.05, stage='detail')


def laundry(T, p0, p1, cols=None):
    a, b = np.array(T.P3(p0)), np.array(T.P3(p1))
    pts = [a + (b - a) * q + np.array([0, 1.6 * math.sin(math.pi * q)]) for q in np.linspace(0, 1, 9)]
    T.line2((0, 0), pts, 0.2, DARK, stage='detail')
    cols = cols or [MARBLE, ROSE, WATER_L, ACCENT_L, MARBLE, TERRA]
    for k in range(1, 8):
        p = pts[k]
        with T.grp('grow', pivot=p, stage='life', dur=0.2, motion=lambda t, age, ph: (0.0, 0.0, 7 * math.sin(t * 3.1 + ph), 1.0, 1.0)):
            T.poly2(p, [(-0.7, 0), (0.7, 0), (0.8, 2.3), (-0.8, 2.3)], cols[k % len(cols)], 0.16, wob=0)


def jetty(T, u, v, d='u', L=0.08, z=0.0):
    du, dv = (L, 0.016) if d == 'u' else (0.016, L)
    T.poly([(u, v, z + 0.006), (u + du, v, z + 0.006), (u + du, v + dv, z + 0.006), (u, v + dv, z + 0.006)], (214, 180, 132), 0.3, stage='detail')
    n = int(L / 0.012)
    if d == 'u':
        T.lines([[(u + du * k / n, v, z + 0.006), (u + du * k / n, v + dv, z + 0.006)] for k in range(1, n)], 0.2, WOOD, stage='detail')
        T.lines([[(u + du * q, v + dv, z + 0.006), (u + du * q, v + dv, z - 0.012)] for q in (0.1, 0.5, 0.95)], 0.5, WOOD, stage='detail')
    else:
        T.lines([[(u, v + dv * k / n, z + 0.006), (u + du, v + dv * k / n, z + 0.006)] for k in range(1, n)], 0.2, WOOD, stage='detail')
        T.lines([[(u + du, v + dv * q, z + 0.006), (u + du, v + dv * q, z - 0.012)] for q in (0.1, 0.5, 0.95)], 0.5, WOOD, stage='detail')


def buoy(T, u, v, c=ACCENT, z=0.0):
    Q = T.P(u, v, z)
    with T.grp('pop', pivot=Q, motion=pr.bobber(0.5, 9, 1.2), stage='life', dur=0.2):
        T.poly2(Q, [(-1.0, 0), (1.0, 0), (0.6, -2.4), (-0.6, -2.4)], c, 0.26, wob=0)
        T.line2(Q, [(0, -2.4), (0, -4.0)], 0.26)
        T.line2(Q, [(-1.6, 0.4), (1.6, 0.4)], 0.36, FOAM, wob=0)


def rock_in_water(T, u, v, s=1.0, z=0.0):
    """a rock with rings of ripple spreading from it"""
    rocks(T, [(u, v)], s, z=z)
    Q = T.P(u, v, z)
    ph0 = T.rng.uniform(0, 1)

    def draw(c, tau, t, a, R):
        if tau < 0.9:
            return
        for k in range(2):
            f = (t * 0.28 + ph0 + k / 2.0) % 1.0
            rr = s * (2.6 + 3.2 * f)
            pts = [Q + np.array([rr * math.cos(q), 0.8 + rr * 0.45 * math.sin(q)]) for q in np.linspace(0.1, math.pi - 0.1, 10)]
            R.poly(c, pts, ink=FOAM, w=0.4, a=a * (1 - f) * 0.9, closed=False)
    T.custom(draw, [Q + np.array([-8 * s, -3]), Q + np.array([8 * s, 5 * s])], stage='life')


# ---------------------------------------------------------------- events ----
def burst_flock(T, perches, t_ev, c=MARBLE, up=30.0, spread=26.0, s=1.0, edge=None, sky=True):
    """Birds sitting about until global time t_ev, when they all take off at once, wheel up and away."""
    P = [np.asarray(p, float) for p in perches]
    cen = np.mean(P, axis=0)
    r = T.rng
    seeds = [(r.uniform(-1, 1), r.uniform(0.7, 1.3), r.uniform(0, 6.28), r.uniform(0, 0.25)) for _ in P]
    c = vivid(c)
    edge = vivid(edge or (90, 92, 110))

    def draw(c_, tau, t, a, R):
        if tau < 1.2:
            return
        for p, (sx, sp, ph, dl) in zip(P, seeds):
            x = t - t_ev - dl
            if x <= 0:
                # perched: a little body that pecks now and then
                pk = 0.5 * max(0.0, math.sin(t * 3.0 + ph * 3))
                R.poly(c_, [p + np.array([-1.3 * s, 0]), p + np.array([-0.2 * s, -1.5 * s + pk]), p + np.array([1.2 * s, -0.9 * s + pk]), p + np.array([0.9 * s, 0])], fill=c, ink=edge, w=0.24, a=a)
                continue
            if x > 3.2:
                continue
            e = 1 - math.exp(-x * 1.3)
            d = p - cen
            q = p + np.array([d[0] * 0.9 * e + sx * spread * e + 9 * math.sin(x * 1.6 + ph) * e, -up * sp * (x ** 1.15) * 0.62 - 6 * e + d[1] * 0.3 * e])
            fl = math.sin(t * 17 + ph)
            al = a * (1.0 if x < 2.2 else max(0.0, 1 - (x - 2.2)))
            wy = 1.6 * s * fl
            R.poly(c_, [q + np.array([-2.6 * s, -wy]), q + np.array([-0.9 * s, 0.2]), q, q + np.array([0.9 * s, 0.2]), q + np.array([2.6 * s, -wy])], ink=edge, w=0.5, a=al, closed=False)
            R.poly(c_, [q + np.array([-2.4 * s, -wy]), q + np.array([0, 0.5]), q + np.array([2.4 * s, -wy]), q + np.array([0, -0.7])], fill=c, a=al)
    xs = [p[0] for p in P]
    ys = [p[1] for p in P]
    T.custom(draw, [np.array([min(xs) - spread * 2.2, min(ys) - up * 3.4]), np.array([max(xs) + spread * 2.2, max(ys) + 6])], stage='sky', sky=sky)


def motes(T, at, n=8, spread=14.0, rise=30.0, c=(255, 214, 120), t0=1.4):
    """Glowing motes drifting up off a wonder, as if it were giving off a little light."""
    at = np.asarray(at, float)
    r = T.rng
    seeds = [(r.uniform(-1, 1), r.uniform(0, 1), r.uniform(0.6, 1.3), r.uniform(0, 6.28)) for _ in range(n)]
    c = vivid(c)

    def draw(c_, tau, t, a, R):
        if tau < t0:
            return
        on = min(1.0, (tau - t0) / 0.6)
        for (sx, ph, sp, w) in seeds:
            f = (t * 0.11 * sp + ph) % 1.0
            x = at[0] + sx * spread + 2.5 * math.sin(f * 9 + w)
            y = at[1] - rise * f
            al = on * a * math.sin(math.pi * f) ** 0.7 * (0.65 + 0.35 * math.sin(t * 5 + w))
            R.pf.setColor(argb(c, al))
            c_.drawCircle(float(x), float(y), 0.62, R.pf)
            R.ps.setColor(argb(ACCENT, al * 0.8))
            R.ps.setStrokeWidth(0.16)
            c_.drawCircle(float(x), float(y), 0.62, R.ps)
    T.custom(draw, [at + np.array([-spread - 4, -rise - 3]), at + np.array([spread + 4, 3])], stage='sky', sky=True)


def lanterns(T, at, n=6, spread=30.0, rise=70.0, t_ev=None, t0=1.4, period=16.0):
    """Paper sky-lanterns.  They rise in a slow endless stream; with t_ev, a whole cluster is let go together."""
    at = np.asarray(at, float)
    r = T.rng
    seeds = [(r.uniform(-1, 1), r.uniform(0, 1), r.uniform(0.75, 1.2), r.uniform(0, 6.28)) for _ in range(n)]
    A, AL, AD = vivid(ACCENT), vivid(ACCENT_L), vivid(ACCENT_D)

    def one(c_, x, y, sc, al, t, w, R):
        fl = 0.8 + 0.2 * math.sin(t * 6 + w)
        body = [(x - 1.5 * sc, y - 3.6 * sc), (x + 1.5 * sc, y - 3.6 * sc), (x + 1.8 * sc, y - 1.0 * sc), (x + 1.1 * sc, y), (x - 1.1 * sc, y), (x - 1.8 * sc, y - 1.0 * sc)]
        R.pf.setColor(argb(AL, al))
        c_.drawPath(_path(body), R.pf)
        R.pf.setColor(argb(A, al * fl))
        c_.drawPath(_path([(x - 1.0 * sc, y - 1.4 * sc), (x + 1.0 * sc, y - 1.4 * sc), (x + 1.1 * sc, y), (x - 1.1 * sc, y)]), R.pf)
        R.ps.setColor(argb(INK, al))
        R.ps.setStrokeWidth(0.26)
        c_.drawPath(_path(body), R.ps)

    def draw(c_, tau, t, a, R):
        if tau < t0:
            return
        on = min(1.0, (tau - t0) / 0.6) * a
        for k, (sx, ph, sp, w) in enumerate(seeds):
            if t_ev is None:
                f = (t / period * sp + ph) % 1.0
                al = on * min(1.0, f * 8) * (1 - f) ** 0.6
            else:
                f = (t - t_ev + 0.9 - 0.12 * k) / 7.5
                if f <= 0 or f >= 1:
                    continue
                al = on * min(1.0, f * 10) * (1 - f) ** 0.5
            x = at[0] + sx * spread * (0.35 + 0.65 * f) + 3.0 * math.sin(f * 7 + w) + 10 * f
            y = at[1] - rise * f ** 0.85
            one(c_, x, y, 0.9 + 0.2 * math.sin(w), al, t, w, R)
    T.custom(draw, [at + np.array([-spread - 8, -rise - 8]), at + np.array([spread + 20, 4])], stage='sky', sky=True)


def breach(T, u, v, t_ev, s=1.0, c=(92, 110, 140)):
    """A whale heaves out of the water, hangs, and crashes back in a ring of foam."""
    P = np.array(T.P(u, v))
    c = vivid(c)
    belly = vivid(MARBLE)
    body = [(-9, 1.5), (-6, -2.2), (-1, -3.4), (5, -2.6), (9, -0.6), (10.5, 1.0), (6, 2.6), (0, 3.0), (-6, 2.4)]
    bel = [(-6, 2.2), (0, 3.0), (6, 2.6), (10.2, 1.2), (6, 1.2), (0, 1.4), (-5, 1.2)]
    tail = [(-9, 1.0), (-12.5, -2.4), (-13.5, -0.6), (-11.4, 0.6), (-13.6, 2.6), (-12.0, 3.2), (-8.6, 2.0)]
    fin = [(2, 2.4), (0.5, 6.0), (4.2, 3.2)]

    def draw(c_, tau, t, a, R):
        x = (t - t_ev + 0.75) / 1.7
        if x <= -0.2 or x >= 1.6:
            return
        # rings of foam where it leaves and where it lands
        for (tx, ox) in ((0.0, -7.0), (0.86, 9.0)):
            f = (x - tx) / 0.55
            if 0 < f < 1:
                rr = (4 + 13 * f) * s
                R.ps.setColor(argb(vivid(FOAM), a * (1 - f)))
                R.ps.setStrokeWidth(0.9)
                c_.drawOval(skia.Rect.MakeLTRB(P[0] + ox * s - rr, P[1] - rr * 0.42, P[0] + ox * s + rr, P[1] + rr * 0.42), R.ps)
                for k in range(7):
                    ang = k * 0.9 + tx * 3
                    dx, dy = math.cos(ang) * rr * 0.8, -abs(math.sin(ang)) * 9 * s * math.sin(math.pi * f)
                    R.pf.setColor(argb(vivid(FOAM), a * (1 - f)))
                    c_.drawCircle(float(P[0] + ox * s + dx), float(P[1] + dy), 0.6, R.pf)
        if 0 < x < 1:
            c_.save()
            c_.clipRect(skia.Rect.MakeLTRB(P[0] - 60, P[1] - 80, P[0] + 60, P[1] + 1.5))
            c_.translate(float(P[0] + (x - 0.5) * 18 * s), float(P[1] - 15 * s * math.sin(math.pi * x)))
            c_.rotate(-62 + 124 * x)
            c_.scale(s, s)
            for poly, col in ((tail, c), (fin, c), (body, c), (bel, belly)):
                pth = _path(smooth_poly([np.array(p) for p in poly], 1))
                R.pf.setColor(argb(col, a))
                c_.drawPath(pth, R.pf)
                R.ps.setColor(argb(INK, a))
                R.ps.setStrokeWidth(0.34)
                c_.drawPath(pth, R.ps)
            R.ps.setStrokeWidth(0.2)
            for k in range(4):
                c_.drawLine(-3 + k * 2.6, 1.8, -2.4 + k * 2.6, 2.7, R.ps)
            R.pf.setColor(argb(INK, a))
            c_.drawCircle(7.6, -0.2, 0.32, R.pf)
            c_.restore()
    T.custom(draw, [P + np.array([-34 * s, -30 * s]), P + np.array([34 * s, 10 * s])], stage='life')


# ---------------------------------------------------- dream connections ----
def spill(T, face, a0, a1, z_top, length=34.0, t0=1.0, mist=True, c=(196, 228, 244)):
    """Water pouring off the edge of the slab, thinning into mist and vanishing into the paper."""
    def fp(a):
        return np.array(T.P3((a, 1, z_top) if face == 'L' else (1, a, z_top)))
    n = 7
    top = [fp(a0 + (a1 - a0) * k / n) for k in range(n + 1)]
    r = T.rng
    streaks = [(r.uniform(0.04, 0.96), r.uniform(0, 1), r.uniform(0.7, 1.3)) for _ in range(int(8 + 60 * (a1 - a0)))]
    puffs = [(r.uniform(0.0, 1.0), r.uniform(0, 6.28), r.uniform(1.6, 3.2)) for _ in range(6)]
    c = vivid(c)
    foam = vivid(FOAM)

    def draw(c_, tau, t, a, R):
        x = (tau - t0) / 0.5
        if x <= 0:
            return
        e = ease.out_cubic(min(1.0, x))
        fall = np.array([0.0, length * e])
        bands = ((0.0, 0.45, 0.95), (0.45, 0.75, 0.6), (0.75, 1.0, 0.28))
        for (f0, f1, al) in bands:
            poly = [p + fall * f0 for p in top] + [p + fall * f1 * (1.0 if f1 < 1 else (0.9 + 0.1 * math.sin(k * 2.3 + t * 5))) for k, p in enumerate(top)][::-1]
            R.pf.setColor(argb(c, a * al))
            c_.drawPath(_path(poly), R.pf)
        R.ps.setStrokeWidth(0.45)
        for (q, ph, sp) in streaks:
            p = top[0] + (top[-1] - top[0]) * q
            s_ = (t * 1.25 * sp + ph) % 1.0
            R.ps.setColor(argb(foam, a * (1 - s_) ** 0.6))
            p0, p1 = p + fall * s_ * 0.86, p + fall * min(1.0, s_ * 0.86 + 0.16)
            c_.drawLine(float(p0[0]), float(p0[1]), float(p1[0]), float(p1[1]), R.ps)
        R.ps.setColor(argb(INK, a))
        R.ps.setStrokeWidth(0.36)
        c_.drawPath(_path(top, False), R.ps)
        if mist and x > 0.7:
            for (q, ph, rr) in puffs:
                p = top[0] + (top[-1] - top[0]) * q + fall + np.array([3.0 * math.sin(t * 0.7 + ph), 1.5 * math.sin(t * 1.1 + ph * 2)])
                al = a * min(1.0, (x - 0.7) * 2) * (0.55 + 0.3 * math.sin(t * 0.9 + ph))
                R.pf.setColor(argb(foam, al))
                c_.drawCircle(float(p[0]), float(p[1]), rr, R.pf)
                R.ps.setColor(argb((170, 196, 220), al * 0.7))
                R.ps.setStrokeWidth(0.3)
                c_.drawCircle(float(p[0]), float(p[1]), rr, R.ps)
    T.custom(draw, [top[0] + np.array([-6, -2]), top[-1] + np.array([6, -2]), top[0] + np.array([-6, length + 8]), top[-1] + np.array([6, length + 8])], stage='detail')


def water_arc(T, axis, a, b, t_on, h=0.05, c=WATER):
    """A river does not stop at the edge of its slab: it leaps the gap to the next one in a smooth arc.
    Called on the receiving tile; (a, b) is the river's span along the shared edge."""
    def pt(q, s):
        w = -0.1 + 0.1 * s
        z = h * math.sin(math.pi * s) - 0.004 * (1 - s)
        return np.array(T.P3((q, w, z) if axis == 'v' else (w, q, z)))
    n = 12
    ea = [pt(a, k / n) for k in range(n + 1)]
    eb = [pt(b, k / n) for k in range(n + 1)]
    c = vivid(c)
    cd = vivid(WATER_D)
    foam = vivid(FOAM)
    ph0 = T.rng.uniform(0, 1)

    def draw(c_, tau, t, al, R):
        x = (t - t_on) / 0.45
        if x <= 0:
            return
        e = ease.out_cubic(min(1.0, x))
        m = max(1, int(round(n * e)))
        poly = ea[:m + 1] + eb[:m + 1][::-1]
        R.pf.setColor(argb(c, al))
        c_.drawPath(_path(poly), R.pf)
        # the underside of the ribbon, seen where it arches
        R.ps.setStrokeWidth(0.3)
        for q in (0.25, 0.5, 0.75):
            R.ps.setColor(argb(foam, al * 0.9))
            for k in range(3):
                f = (t * 0.9 + ph0 + q + k / 3.0) % 1.0
                i0 = min(m - 1, int(f * n))
                if i0 + 1 > m:
                    continue
                p0 = ea[i0] + (eb[i0] - ea[i0]) * q
                p1 = ea[i0 + 1] + (eb[i0 + 1] - ea[i0 + 1]) * q
                c_.drawLine(float(p0[0]), float(p0[1]), float(p1[0]), float(p1[1]), R.ps)
        R.ps.setColor(argb(INK, al))
        R.ps.setStrokeWidth(0.4)
        c_.drawPath(_path(ea[:m + 1], False), R.ps)
        c_.drawPath(_path(eb[:m + 1], False), R.ps)
        if e >= 1:
            R.ps.setColor(argb(foam, al))
            R.ps.setStrokeWidth(0.8)
            w = 0.6 * math.sin(t * 7 + ph0 * 9)
            c_.drawLine(float(ea[-1][0]), float(ea[-1][1] + w), float(eb[-1][0]), float(eb[-1][1] - w), R.ps)
    T.custom(draw, [ea[0] + np.array([-3, -h * ZS - 3]), eb[0] + np.array([3, -h * ZS - 3]), ea[-1] + np.array([-3, 4]), eb[-1] + np.array([3, 4])], stage='detail')


def gap_bridge(T, axis, pos, t_on, w=0.036, kind='stone', n_walk=2, h=0.022):
    """A little bridge from the neighbouring slab onto this one.  Called on the receiving tile."""
    def pt(q, s, dz=0.0):
        d = -0.112 + 0.124 * s
        z = (h * math.sin(math.pi * s) if kind != 'rope' else -0.012 * math.sin(math.pi * s)) + dz
        return T.P3((q, d, z) if axis == 'v' else (d, q, z))
    n = 10
    near = pos + w if axis == 'u' else pos + w          # the edge that faces the viewer
    far = pos
    C = np.array(pt(pos + w / 2, 0.5))
    with T.grp(None, pivot=C, motion=appear(t_on, 0.4), stage='detail', instant=True):
        deck = [pt(far, k / n) for k in range(n + 1)] + [pt(near, k / n) for k in range(n, -1, -1)]
        if kind == 'rope':
            T.poly2((0, 0), deck, (214, 180, 132), 0.3, wob=0)
            T.lines2((0, 0), [[pt(far, k / n), pt(near, k / n)] for k in range(1, n)], 0.22, WOOD, wob=0)
            for q in (far, near):
                T.line2((0, 0), [pt(q, k / n, 0.02) for k in range(n + 1)], 0.26, DARK, wob=0)
                T.lines2((0, 0), [[pt(q, k / n), pt(q, k / n, 0.02)] for k in range(0, n + 1, 2)], 0.2, DARK, wob=0)
        else:
            col = (236, 226, 206) if kind == 'stone' else (226, 218, 204)
            side = [pt(near, k / n) for k in range(n + 1)] + [pt(near, k / n, -0.02 - (0.0 if kind == 'wall' else h * math.sin(math.pi * k / n) * 0.75)) for k in range(n, -1, -1)]
            T.poly2((0, 0), deck, col, 0.34, wob=0)
            T.poly2((0, 0), side, shade(col, 0.88), 0.34, wob=0)
            hh = 0.016 if kind == 'stone' else 0.03
            for q in (far, near):
                T.poly2((0, 0), [pt(q, k / n) for k in range(n + 1)] + [pt(q, k / n, hh) for k in range(n, -1, -1)], shade(col, 0.96 if q == far else 1.02), 0.3, wob=0)
            if kind == 'wall':
                T.lines2((0, 0), [[pt(near, k / n, hh), pt(near, k / n, hh + 0.008)] for k in range(0, n + 1)], 0.5, col, wob=0)
    if n_walk:
        mid = pos + w / 2
        route = [((mid, -0.2, 0.0) if axis == 'v' else (-0.2, mid, 0.0))] + \
                [((mid, -0.112 + 0.124 * s, (h * math.sin(math.pi * s) if kind != 'rope' else -0.012 * math.sin(math.pi * s))) if axis == 'v'
                  else (-0.112 + 0.124 * s, mid, (h * math.sin(math.pi * s) if kind != 'rope' else -0.012 * math.sin(math.pi * s)))) for s in (0.0, 0.25, 0.5, 0.75, 1.0)] + \
                [((mid, 0.07, 0.0) if axis == 'v' else (0.07, mid, 0.0))]
        stroll(T, route, n_walk, spread=0.002, s=0.9)


# ------------------------------------------------------ construction marks ----
def crane(T, u, v, s=1.0, t_in=0.25, flip=False):
    """A draughtsman's crane, drawn in the same blue pencil as the guides: it rises as the slab is inked,
    swings blocks into place while the structures go up, and folds away when the colour is dry."""
    B = np.array(T.P(u, v))
    pc = PENCIL
    blk = vivid((244, 236, 214))
    sg = -1.0 if flip else 1.0
    H = 30.0 * s

    def draw(c, tau, t, a, R):
        x = tau - t_in
        if x <= 0 or x >= 1.22:
            return
        up = ease.out_back(min(1.0, x / 0.22), 1.6) if x < 1.0 else max(0.0, 1 - (x - 1.0) / 0.2)
        if up <= 0.01:
            return
        al = a * min(1.0, up * 1.5) * 0.95
        top = B + np.array([0, -H * up])
        ps = R.ps
        ps.setColor(argb(pc, al))
        ps.setStrokeWidth(0.5)
        for dx in (-1.1, 1.1):
            c.drawLine(float(B[0] + dx), float(B[1]), float(top[0] + dx), float(top[1]), ps)
        ps.setStrokeWidth(0.28)
        n = int(9 * up) + 1
        for k in range(n):                                   # lattice of the mast
            y0, y1 = B[1] - H * up * k / n, B[1] - H * up * (k + 1) / n
            c.drawLine(float(B[0] - 1.1), float(y0), float(B[0] + 1.1), float(y1), ps)
            c.drawLine(float(B[0] + 1.1), float(y0), float(B[0] - 1.1), float(y1), ps)
        if up > 0.6:
            ang = sg * (0.9 * math.sin(x * 5.2 + u * 7) + 0.4)
            jx, jy = 20.0 * s * math.cos(ang), 20.0 * s * 0.42 * math.sin(ang)
            tip = top + np.array([jx, jy - 1.0])
            back = top + np.array([-jx * 0.32, -jy * 0.32 - 1.0])
            ps.setStrokeWidth(0.5)
            c.drawLine(float(back[0]), float(back[1]), float(tip[0]), float(tip[1]), ps)
            ps.setStrokeWidth(0.26)
            pk = top + np.array([0, -5.0 * s])
            for q in (back, tip, top + np.array([jx * 0.5, jy * 0.5 - 1.0])):
                c.drawLine(float(pk[0]), float(pk[1]), float(q[0]), float(q[1]), ps)
            # the hook, lowering a block and coming up empty, over and over
            f = (x * 2.6 + u) % 1.0
            drop = (0.25 + 0.6 * (math.sin(math.pi * f) ** 2)) * H * up
            hk = tip + np.array([0, drop])
            c.drawLine(float(tip[0]), float(tip[1]), float(hk[0]), float(hk[1]), ps)
            if f < 0.5:
                R.pf.setColor(argb(blk, al))
                c.drawRect(skia.Rect.MakeLTRB(hk[0] - 1.6, hk[1], hk[0] + 1.6, hk[1] + 2.2), R.pf)
                ps.setColor(argb(INK, al))
                ps.setStrokeWidth(0.26)
                c.drawRect(skia.Rect.MakeLTRB(hk[0] - 1.6, hk[1], hk[0] + 1.6, hk[1] + 2.2), ps)
    T.custom(draw, [B + np.array([-24 * s, -H - 8]), B + np.array([24 * s, 12])], stage='sky', sky=True)



def construction_marks(T):
    """The draughtsman's working: dimension lines with arrowheads and scribbled figures, a grid of
    setting-out dots, hatching, compass arcs and a protractor - pencilled as each piece begins, erased as it is inked."""
    r = random.Random(hash(T.name) % 4099 + 3)
    th = getattr(T, 'thick', SLAB)

    def pen(pts, tp, te, w=0.34):
        pts = [np.asarray(p, float) for p in pts]
        if len(pts) == 2:
            pts = [pts[0], (pts[0] + pts[1]) / 2, pts[1]]
        sh = T.guide([pts], px=True, over=0.0, w=w)
        sh.tp, sh.te = tp, te
        return sh

    def glyphs(at, n, tp, te, s=1.0):
        """abstract figures: a few quick pencil squiggles that read as a measurement"""
        x = 0.0
        for k in range(n):
            kind = r.choice('0147+')
            o = np.asarray(at, float) + np.array([x, 0.0])
            if kind == '0':
                pts = [o + s * np.array([0.7 * math.cos(q), -1.2 + 1.2 * math.sin(q)]) for q in np.linspace(0, TAU, 8)]
            elif kind == '1':
                pts = [o + s * np.array([-0.4, -1.8]), o + s * np.array([0.2, -2.4]), o + s * np.array([0.2, 0.0])]
            elif kind == '4':
                pts = [o + s * np.array([0.5, 0.0]), o + s * np.array([0.5, -2.4]), o + s * np.array([-0.7, -0.8]), o + s * np.array([0.9, -0.8])]
            elif kind == '7':
                pts = [o + s * np.array([-0.6, -2.4]), o + s * np.array([0.7, -2.4]), o + s * np.array([-0.1, 0.0])]
            else:
                pts = [o + s * np.array([-0.7, -1.2]), o + s * np.array([0.7, -1.2]), o + s * np.array([0.0, -1.2]), o + s * np.array([0.0, -2.0]), o + s * np.array([0.0, -0.4])]
            pen(pts, tp + 0.03 * k, te, 0.3)
            x += 2.3 * s

    def dim(p0, p1, off, tp, te, label=True):
        """a dimension line between two points, offset sideways, with witness lines, arrowheads and a figure"""
        p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
        d = p1 - p0
        L = np.hypot(*d)
        u_ = d / L
        a, b = p0 + off, p1 + off
        pen([a, b], tp, te)
        pen([p0 + off * 0.25, p0 + off * 1.2], tp, te)
        pen([p1 + off * 0.25, p1 + off * 1.2], tp, te)
        nrm = np.array([-u_[1], u_[0]])
        for q, sg in ((a, 1.0), (b, -1.0)):
            pen([q + u_ * sg * 2.6 + nrm * 1.0, q, q + u_ * sg * 2.6 - nrm * 1.0], tp + 0.05, te)
        if label:
            glyphs((a + b) / 2 + off / np.hypot(*off) * 3.4 + np.array([-3.0, 1.2]), r.choice([3, 4]), tp + 0.08, te)

    crane(T, 0.13, 0.86, 1.0, 0.24)
    crane(T, 0.87, 0.14, 0.85, 0.36, flip=True)
    if T.kind == 'tile':
        # the setting-out grid, ruled across the bare slab and rubbed out as the colour arrives
        for k in range(1, 6):
            f = k / 6.0
            pen([T.P(f, 0.0), T.P(f, 1.0)], -0.42 + 0.03 * k, 0.26 + 0.05 * k, 0.26)
            pen([T.P(0.0, f), T.P(1.0, f)], -0.36 + 0.03 * k, 0.30 + 0.05 * k, 0.26)
        A, B, C, D = T.P(0, 1, -th), T.P(1, 1, -th), T.P(1, 0, -th), T.P(1, 1, 0)
        dim(A, B, np.array([-2.6, 5.2]), 0.02, 0.9)
        dim(B, C, np.array([2.6, 5.2]), 0.06, 0.95)
        dim(T.P(1, 1, 0), T.P(1, 1, -th), np.array([0.0, 0.0]) + np.array([5.0, 2.5]) * 0, 0.1, 0.8, label=False)
        # setting-out dots
        for i in range(1, 6):
            for j in range(1, 6):
                if (i + j) % 2 == 0:
                    p = T.P(i / 6.0, j / 6.0)
                    pen([p + np.array([-0.8, 0]), p + np.array([0.8, 0])], 0.03 + 0.012 * (i + j), 0.34 + 0.02 * (i + j), 0.3)
                    pen([p + np.array([0, -0.5]), p + np.array([0, 0.5])], 0.03 + 0.012 * (i + j), 0.34 + 0.02 * (i + j), 0.3)
        # a patch of hatching and a compass arc
        q0 = r.choice([(0.08, 0.62), (0.6, 0.08), (0.62, 0.62), (0.1, 0.1)])
        for k in range(7):
            f = k / 6.0
            pen([T.P(q0[0] + 0.26 * f, q0[1]), T.P(q0[0], q0[1] + 0.26 * f)], 0.08 + 0.015 * k, 0.5 + 0.01 * k, 0.28)
        cu, cv, rad = 0.5, 0.5, r.uniform(0.3, 0.44)
        a0 = r.uniform(0, 360)
        pen([T.P(cu + rad * math.cos(math.radians(a0 + q)), cv + rad * math.sin(math.radians(a0 + q))) for q in range(0, 150, 10)], 0.05, 0.62)
        pen([T.P(cu, cv), T.P(cu + rad * math.cos(math.radians(a0)), cv + rad * math.sin(math.radians(a0)))], 0.05, 0.62)
        # a protractor at the back corner
        O = T.P(0, 0)
        e1, e2 = T.P(0.16, 0) - O, T.P(0, 0.16) - O
        arc = [O + e1 * math.cos(q) + e2 * math.sin(q) for q in np.linspace(0, math.pi / 2, 9)]
        pen(arc, 0.04, 0.5)
        for q in np.linspace(0, math.pi / 2, 7):
            p = O + e1 * math.cos(q) + e2 * math.sin(q)
            pen([p, O + (p - O) * 0.86], 0.07, 0.5, 0.28)
        glyphs(O + (e1 + e2) * 0.36 + np.array([-2, 0]), 2, 0.1, 0.5, 0.8)
    else:
        cu, cv, ru, rv = getattr(T, 'foot', (0.5, 0.5, 0.3, 0.3))
        dim(T.P(cu - ru, cv + rv), T.P(cu + ru, cv + rv), np.array([-2.0, 7.0]), 0.02, 0.8)
        pen([T.P(cu + ru * 1.25 * math.cos(q), cv + rv * 1.25 * math.sin(q)) for q in np.linspace(0.3, 2.4, 12)], 0.05, 0.6)
