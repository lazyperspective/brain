"""Props: the small things that make a tile live - figures, trees, animals,
boats, vehicles, clouds, balloons, birds, water."""
import math

import numpy as np

from . import ease
from .core import W, ZS, Wave, smooth_poly, pip
from .pal import *  # noqa

TAU = 2 * math.pi


def uvd(du, dv):
    """tile-space ground delta -> map px delta"""
    return np.array([(du - dv) * W, (du + dv) * W * 0.5])


# ------------------------------------------------------------- motions ----
# A group motion is f(t, age, phase) -> (dx, dy[, rot, sx, sy[, alpha]]).
FILM = 53.4


class Walk:
    """There-and-back amble (animals, synchronised caravans).  Also understood by person()."""

    def __init__(self, d, period=6.0, bob=0.35, face=1.0):
        self.d = np.asarray(d, float)
        self.period = period
        self.bob = bob
        self.face = face          # which way the drawing faces (+1 = right)
        self.reach = float(np.hypot(*self.d)) + 16.0

    def __call__(self, t, age, ph):
        cyc = TAU * t / self.period + ph
        s = 0.5 - 0.5 * math.cos(cyc)
        vel = math.sin(cyc)
        gait = abs(math.sin(t * 5.0 + ph * 3)) * abs(vel)
        way = (1.0 if self.d[0] >= 0 else -1.0) * self.face
        turn = max(-1.0, min(1.0, vel * 7.0)) * way          # the animal turns round to walk back
        if abs(turn) < 0.08:
            turn = 0.08
        return (self.d[0] * s, self.d[1] * s - gait * self.bob, 2.0 * math.sin(t * 5.0 + ph * 3) * abs(vel) * way, turn, 1.0)


def walker(du, dv, period=6.0, bob=0.35):
    return Walk(uvd(du, dv), period, bob)


def walker_px(d, period=6.0, bob=0.35):
    return Walk(d, period, bob)


class Cruise:
    """Boats under way: sail the reach, ease up to the far end, wait a moment, and sail back - bobbing and rocking all the while."""

    def __init__(self, du, dv, speed=1.0, amp=0.3, rock=1.0, period=None):
        self.d = uvd(du, dv) * 2.2
        self.amp = amp
        self.rock = rock
        self.period = period or 30.0 / max(0.3, speed)
        self.reach = float(np.hypot(*self.d)) + 20.0

    def pos(self, t, ph):
        """-> (s in 0..1 along the reach, signed speed -1..1)"""
        x = ((t + 4.0) / self.period + ph * 0.11) % 1.0
        tri = 1 - abs(2 * x - 1)                      # 0 -> 1 -> 0
        k = min(1.0, max(0.0, (tri - 0.06) / 0.88))     # a pause at each end
        s = k * k * (3 - 2 * k)
        v = 6 * k * (1 - k) * (1 if x < 0.5 else -1) if 0 < k < 1 else 0.0
        return s, v / 1.5

    def __call__(self, t, age, ph):
        s, _ = self.pos(t, ph)
        return (self.d[0] * s, self.d[1] * s + self.amp * math.sin(t * 2.1 + ph), self.rock * math.sin(t * 1.6 + ph), 1.0, 1.0)


def cruise(du, dv, speed=1.0, amp=0.3, rock=1.0):
    return Cruise(du, dv, speed, amp, rock)


def bobber(amp=0.5, rock=1.5, speed=1.0, drift=(0.0, 0.0), period=9.0):
    d = uvd(*drift)

    def m(t, age, ph):
        s = math.sin(TAU * t / period + ph)
        return (d[0] * s, d[1] * s + amp * math.sin(t * 2.3 * speed + ph), rock * math.sin(t * 1.7 * speed + ph * 2), 1.0, 1.0)
    return m


def runner(du, dv, period=9.0, bump=0.25):
    """Vehicles: drive the stretch one way, slip out at the far end, come in again at the start."""
    d = uvd(du, dv)

    def m(t, age, ph):
        s = (t / period + ph / TAU) % 1.0
        k = ease.smooth(min(s, 1.0 - s) / 0.05)
        return (d[0] * s, d[1] * s - bump * abs(math.sin(t * 13 + ph)), 0.0, k, k, k)
    m.reach = float(np.hypot(*d)) + 16.0
    return m


def sway(deg=2.0, speed=1.0):
    def m(t, age, ph):
        g = math.sin(t * 1.25 * speed + ph) + 0.45 * math.sin(t * 2.9 * speed + ph * 1.7)
        return (0.0, 0.0, deg * g, 1.0, 1.0)
    return m


def drifter(flow=(1.0, 0.3), reach=7.0, speed=1.6):
    """Wave scribbles: slosh hard as the water arrives, then drift with the flow, fading out and in."""
    fx, fy = flow

    def m(t, age, ph):
        a = 3.2 * math.exp(-3.0 * max(age, 0.0))
        q = (t * speed / (2 * reach) + ph / TAU) % 1.0
        k = (q - 0.5) * 2 * reach
        al = math.sin(math.pi * q) ** 0.6
        return (fx * k + a * math.sin(TAU * 0.55 * t + ph), fy * k + 0.25 * math.sin(t * 1.7 + ph), 0.0, 1.0, 1.0, al)
    return m


shimmer = drifter()


def floaty(ax=3.0, ay=1.2, speed=1.0):
    def m(t, age, ph):
        return (ax * math.sin(t * 0.45 * speed + ph) + 0.4 * ax * math.sin(t * 0.17 * speed + ph * 2), ay * math.sin(t * 1.1 * speed + ph * 1.7))
    return m


# -------------------------------------------------------------- people ----
from .figures import person, crowd, stroll  # noqa  (figures that walk, pause, turn and wave)


# --------------------------------------------------------------- trees ----
def _canopy(T, P, cx, cy, rx, ry, c, lobes=5, ink=0.38, ph=0.0, amp=0.09):
    n = 22
    pts = []
    for k in range(n):
        a = TAU * k / n
        rr = 1 + amp * math.sin(lobes * a + ph)
        pts.append((cx + rx * rr * math.cos(a), cy + ry * rr * math.sin(a)))
    T.poly2(P, pts, c, 0, wob=0)
    # shade crescent, lower right
    sh = []
    for k in range(n // 2 + 3):
        a = -0.5 + (TAU * 0.5 + 0.6) * k / (n // 2 + 2)
        rr = 1 + amp * math.sin(lobes * a + ph)
        sh.append((cx + rx * rr * math.cos(a), cy + ry * rr * math.sin(a)))
    for k in range(n // 2 + 3):
        a = (TAU * 0.5 + 0.1) - (TAU * 0.5 + 0.6) * k / (n // 2 + 2)
        sh.append((cx + rx * 0.25 + rx * 0.82 * math.cos(a), cy - ry * 0.3 + ry * 0.86 * math.sin(a)))
    T.poly2(P, sh, shade(c, 0.86), 0, wob=0)
    T.poly2(P, pts, None, ink, wob=0)


def tree(T, u, v, s=1.0, c=FOREST, kind='round', z=0.0, t0=None, sw=None):
    r = T.rng
    P = T.P(u, v, z)
    ph = r.uniform(0, 6.28)
    if sw is None:
        sw = {'palm': 3.4, 'cypress': 1.6, 'fir': 1.5, 'bush': 2.6, 'stonepine': 1.8, 'acacia': 1.8}.get(kind, 2.1)
    with T.grp('pop', t0=t0, dur=0.26, pivot=P, motion=sway(sw), stage='flora', ph=P[0] * 0.045 + P[1] * 0.03 + r.uniform(-0.5, 0.5)):
        if kind == 'round':
            T.poly2(P, [(-0.55 * s, 0), (0.55 * s, 0), (0.4 * s, -3.4 * s), (-0.4 * s, -3.4 * s)], WOOD, 0.3, wob=0)
            _canopy(T, P, 0, -6.0 * s, 3.5 * s, 3.3 * s, c, 5, ph=ph)
        elif kind == 'jungle':
            T.poly2(P, [(-0.6 * s, 0), (0.6 * s, 0), (0.4 * s, -3.6 * s), (-0.4 * s, -3.6 * s)], WOOD, 0.3, wob=0)
            _canopy(T, P, -1.6 * s, -5.4 * s, 3.0 * s, 2.6 * s, shade(c, 0.93), 5, ph=ph)
            _canopy(T, P, 1.4 * s, -6.6 * s, 3.4 * s, 3.0 * s, c, 6, ph=ph + 1)
        elif kind == 'cherry':
            T.poly2(P, [(-0.5 * s, 0), (0.5 * s, 0), (0.35 * s, -3.0 * s), (-0.35 * s, -3.0 * s)], DARK, 0.3, wob=0)
            _canopy(T, P, -1.5 * s, -5.0 * s, 2.7 * s, 2.3 * s, BLOSSOM, 6, ph=ph, amp=0.13)
            _canopy(T, P, 1.3 * s, -6.2 * s, 3.0 * s, 2.6 * s, BLOSSOM, 7, ph=ph + 2, amp=0.13)
        elif kind == 'cypress':
            T.poly2(P, [(-0.35 * s, 0), (0.35 * s, 0), (0.3 * s, -1.6 * s), (-0.3 * s, -1.6 * s)], WOOD, 0.28, wob=0)
            pts = smooth_poly([(0, -12.5 * s), (1.5 * s, -7.5 * s), (1.9 * s, -3.4 * s), (0, -1.1 * s),
                               (-1.9 * s, -3.4 * s), (-1.5 * s, -7.5 * s)], 2)
            T.poly2(P, pts, c, 0, wob=0)
            T.poly2(P, smooth_poly([(0.2 * s, -12.0 * s), (1.5 * s, -7.5 * s), (1.9 * s, -3.4 * s), (0.1 * s, -1.2 * s),
                                    (0.7 * s, -5 * s)], 2), shade(c, 0.85), 0, wob=0)
            T.poly2(P, pts, None, 0.36, wob=0)
        elif kind == 'fir':
            T.poly2(P, [(-0.4 * s, 0), (0.4 * s, 0), (0.4 * s, -1.6 * s), (-0.4 * s, -1.6 * s)], WOOD, 0.28, wob=0)
            for k, (w_, y0, y1) in enumerate([(3.3, -1.3, -5.6), (2.7, -4.0, -8.2), (2.0, -6.8, -10.8)]):
                T.poly2(P, [(-w_ * s, y0 * s), (w_ * s, y0 * s), (0, y1 * s)], c, 0.36, wob=0)
                T.poly2(P, [(0.3 * s, y0 * s - 0.1), (w_ * s - 0.4, y0 * s - 0.1), (0.25 * s, y1 * s + 1.0)], shade(c, 0.85), 0, wob=0)
        elif kind == 'palm':
            lean = r.uniform(-1.6, 1.6) * s
            hgt = r.uniform(8.0, 10.5) * s
            tr = [(-0.55 * s, 0), (0.55 * s, 0), (lean * 0.5 + 0.45 * s, -hgt * 0.5), (lean + 0.3 * s, -hgt),
                  (lean - 0.3 * s, -hgt), (lean * 0.5 - 0.45 * s, -hgt * 0.5)]
            T.poly2(P, tr, WOOD, 0.3, wob=0)
            top = np.array([lean, -hgt])
            for k, a in enumerate([200, 160, 235, 125, 300, 345, 20, 265]):
                a = math.radians(a + r.uniform(-8, 8))
                L = (4.6 if k < 4 else 4.0) * s
                d = np.array([math.cos(a), -math.sin(a) * 0.62])
                tip = top + d * L + np.array([0, 1.9 * s])
                mid = top + d * L * 0.55 + np.array([0, -0.9 * s])
                nrm = np.array([-d[1], d[0]]) * 0.95 * s
                T.poly2(P, [top, mid + nrm, tip, mid - nrm], c if k % 2 else shade(c, 0.9), 0.3, wob=0)
        elif kind == 'acacia':
            T.lines2(P, [[(0, 0), (0.2 * s, -3.4 * s)], [(0.2 * s, -3.4 * s), (-2.4 * s, -5.6 * s)], [(0.2 * s, -3.4 * s), (2.6 * s, -5.8 * s)]], 0.7 * s, WOOD)
            _canopy(T, P, 0.2 * s, -6.6 * s, 5.6 * s, 1.7 * s, c, 7, ph=ph, amp=0.06)
        elif kind == 'stonepine':
            T.poly2(P, [(-0.42 * s, 0), (0.42 * s, 0), (0.3 * s, -7.0 * s), (-0.3 * s, -7.0 * s)], WOOD, 0.3, wob=0)
            _canopy(T, P, 0, -8.6 * s, 4.6 * s, 2.3 * s, c, 6, ph=ph, amp=0.07)
        elif kind == 'birch':
            T.poly2(P, [(-0.4 * s, 0), (0.4 * s, 0), (0.3 * s, -6.2 * s), (-0.3 * s, -6.2 * s)], MARBLE, 0.3, wob=0)
            T.lines2(P, [[(-0.3 * s, -1.4 * s), (0.1 * s, -1.5 * s)], [(0.0, -3.0 * s), (0.3 * s, -3.1 * s)], [(-0.3 * s, -4.4 * s), (0.0, -4.5 * s)]], 0.26, INK, wob=0)
            _canopy(T, P, 0, -8.2 * s, 2.7 * s, 3.4 * s, c, 7, ph=ph, amp=0.11)
        elif kind == 'willow':
            T.poly2(P, [(-0.6 * s, 0), (0.6 * s, 0), (0.4 * s, -3.8 * s), (-0.4 * s, -3.8 * s)], WOOD, 0.3, wob=0)
            _canopy(T, P, 0, -6.0 * s, 4.2 * s, 2.8 * s, c, 6, ph=ph)
            T.lines2(P, [[(x * s, -5.0 * s), (x * s * 1.1, (-1.2 - 0.5 * abs(x) % 1.3) * s)] for x in (-3.4, -2.2, -1.0, 0.2, 1.4, 2.6, 3.5)], 0.42, shade(c, 0.8), wob=0)
        elif kind == 'bamboo':
            for x in (-1.4, 0.0, 1.3):
                T.line2(P, [(x * s, 0), (x * s * 1.3, -9.5 * s - x)], 0.5 * s, (150, 190, 110), wob=0)
                T.lines2(P, [[(x * s * 1.3 - 0.2, -9.0 * s - x), (x * s * 1.3 + 2.2 * s, -8.2 * s - x)], [(x * s * 1.15, -6.0 * s), (x * s * 1.15 - 2.0 * s, -5.4 * s)],
                             [(x * s * 1.25, -7.6 * s), (x * s * 1.25 + 1.9 * s, -6.6 * s)]], 0.6 * s, c, wob=0)
        elif kind == 'poplar':
            T.poly2(P, [(-0.3 * s, 0), (0.3 * s, 0), (0.25 * s, -2.0 * s), (-0.25 * s, -2.0 * s)], WOOD, 0.28, wob=0)
            pts = smooth_poly([(0, -14.0 * s), (1.3 * s, -9.0 * s), (1.6 * s, -4.0 * s), (0, -1.5 * s), (-1.6 * s, -4.0 * s), (-1.3 * s, -9.0 * s)], 2)
            T.poly2(P, pts, c, 0.36, wob=0)
            T.lines2(P, [[(0.3 * s, -12 * s), (0.8 * s, -4 * s)]], 0.24, shade(c, 0.8), wob=0)
        elif kind == 'bush':
            _canopy(T, P, 0, -1.7 * s, 2.5 * s, 1.9 * s, c, 5, ph=ph, ink=0.32)
    return P


def grove(T, region, n, kinds=('round',), colors=(FOREST,), s=(0.8, 1.15), seed=None, mind=0.035, z=0.0):
    pts = T.scatter(region, n, seed=seed, mind=mind)
    pts.sort(key=lambda p: p[0] + p[1])
    r = T.rng
    for (u, v) in pts:
        tree(T, u, v, r.uniform(*s), r.choice(colors), r.choice(kinds), z)


# ------------------------------------------------------------- animals ----
def quad(T, u, v, L=5.0, H=2.4, leg=2.6, neck=(1.6, -2.4), head=(1.5, 0.9), col=(201, 164, 118), flip=False,
         hump=0, tail=True, s=1.0, z=0.0, walk=None, blanket=None, horns=False, legc=None, headc=None, t0=None,
         rider=None, at=None, neck_w=0.8, ph=None):
    P = T.P(u, v, z) if at is None else np.asarray(at, float)
    f = -1.0 if flip else 1.0
    legc = legc or shade(col, 0.72)

    def X(pts):
        return [(x * f * s, y * s) for x, y in pts]
    if isinstance(walk, Walk):
        walk = Walk(walk.d, walk.period, walk.bob, face=f)
    with T.grp('pop', t0=t0, dur=0.24, pivot=P, motion=walk, stage='life', ph=ph):
        segs = []
        for x in (-L / 2 + 0.6, -L / 2 + 1.5, L / 2 - 1.5, L / 2 - 0.6):
            segs.append(X([(x, 0), (x, -leg - 0.4)]))
        T.lines2(P, segs, 0.6 * s, legc)
        by = -leg - H / 2
        if tail:
            T.line2(P, X([(-L / 2 + 0.2, by - 0.3), (-L / 2 - 0.9, by + 1.2)]), 0.4 * s, legc)
        # neck + head
        nx0 = L / 2 - 0.8
        n1 = (nx0 + neck[0], by + neck[1])
        T.poly2(P, X([(nx0 - neck_w, by - 0.2), (nx0 + neck_w * 0.6, by + 0.6), (n1[0] + 0.5, n1[1] + 0.3), (n1[0] - 0.5, n1[1] - 0.2)]), col, 0.3, wob=0)
        T.ell2(P + np.array([0, by * s]), L / 2 * s, H / 2 * s, fill=col, ink=0.32, n=16, wob=0)
        for k in range(hump):
            hx = (-0.9 + 1.9 * k) if hump == 2 else 0.0
            T.ell2(P + np.array([hx * f * s, (by - H * 0.45) * s]), 1.25 * s, 1.15 * s, fill=col, ink=0.3, n=10, a0=math.pi, a1=TAU, closed=False, wob=0)
        if blanket is not None:
            T.poly2(P, X([(-1.3, by - H * 0.5 - (0.5 if hump else 0)), (1.3, by - H * 0.5 - (0.5 if hump else 0)), (1.5, by + 0.5), (-1.5, by + 0.5)]), blanket, 0.28, wob=0)
        hc = P + np.array([(n1[0] + head[0] * 0.45) * f * s, (n1[1] + 0.1) * s])
        T.ell2(hc, head[0] * 0.62 * s, head[1] * 0.62 * s, fill=headc or col, ink=0.3, n=10, wob=0)
        if horns:
            T.lines2(hc, [X([(-0.3, -0.4), (-0.9, -1.5)]), X([(0.3, -0.4), (0.9, -1.5)])], 0.3 * s, INK)
        if rider is not None:
            rp = P + np.array([0, (by - H * 0.5 - (1.0 if hump else 0.2)) * s])
            T.poly2(rp, [(-0.9 * s, 0.4 * s), (0.9 * s, 0.4 * s), (0.8 * s, -2.2 * s), (-0.8 * s, -2.2 * s)], rider, 0.28, wob=0)
            T.ell2(rp + np.array([0, -3.1 * s]), 1.05 * s, fill=SKIN[1], ink=0.28, n=10, wob=0)
    return P


def camel(T, u, v, flip=False, blanket=None, rider=None, walk=None, s=1.0, **kw):
    return quad(T, u, v, 6.2, 2.6, 3.3, (1.5, -3.3), (1.9, 1.1), (190, 146, 98), flip, 1, True, s * 1.3, walk=walk,
                blanket=blanket, rider=rider, **kw)


def llama(T, u, v, flip=False, col=MARBLE, s=1.0, **kw):
    return quad(T, u, v, 4.4, 2.6, 2.4, (0.5, -3.4), (1.5, 1.0), col, flip, 0, True, s, neck_w=0.65, **kw)


def yak(T, u, v, flip=False, s=1.0, **kw):
    return quad(T, u, v, 6.0, 3.6, 1.7, (1.0, -0.2), (1.9, 1.5), (92, 78, 74), flip, 0, True, s, horns=True, **kw)


def sheep(T, u, v, flip=False, s=1.0, **kw):
    return quad(T, u, v, 3.8, 2.6, 1.2, (0.7, -0.5), (1.3, 1.0), MARBLE, flip, 0, False, s, headc=DARK, legc=DARK, **kw)


def horse(T, u, v, flip=False, col=(150, 108, 80), s=1.0, **kw):
    return quad(T, u, v, 5.6, 2.3, 3.0, (1.6, -2.4), (2.0, 0.95), col, flip, 0, True, s, **kw)


def bear(T, u, v, flip=False, s=1.0, walk=None, z=0.0, **kw):
    """Polar bear: one heavy, low silhouette - sloping back, small head carried low, stubby legs."""
    P = T.P(u, v, z)
    f = -1.0 if flip else 1.0
    col = (252, 248, 236)

    def X(pts):
        return [(x * f * s, y * s) for x, y in pts]
    if isinstance(walk, Walk):
        walk = Walk(walk.d, walk.period, walk.bob, face=f)
    with T.grp('pop', dur=0.24, pivot=P, motion=walk, stage='life'):
        for (x0, x1) in ((-3.3, -2.2), (-1.9, -0.9), (1.2, 2.2), (2.5, 3.5)):
            T.poly2(P, X([(x0, 0), (x1, 0), (x1 + 0.1, -2.2), (x0 - 0.1, -2.2)]), (232, 226, 210), 0.3, wob=0)
        body = smooth_poly(X([(-3.9, -1.9), (-4.0, -3.6), (-2.6, -4.9), (0.2, -5.0), (2.6, -4.5), (4.2, -4.4), (5.6, -3.9), (6.5, -3.0), (6.4, -2.3),
                              (5.2, -2.0), (4.0, -1.6), (1.0, -1.5), (-2.0, -1.5)]), 2)
        T.poly2(P, body, col, 0.36, wob=0)
        T.ell2(P + np.array([4.5 * f * s, -4.5 * s]), 0.55 * s, fill=col, ink=0.28, n=8, wob=0)        # ear
        T.ell2(P + np.array([6.45 * f * s, -2.7 * s]), 0.36 * s, fill=INK, ink=0, n=6, wob=0)           # nose
        T.ell2(P + np.array([5.3 * f * s, -3.35 * s]), 0.2 * s, fill=INK, ink=0, n=6, wob=0)            # eye
    return P


def kangaroo(T, u, v, flip=False, s=1.0, hop=True, travel=0.05):
    """Kangaroo in profile: upright S-curve, big haunch and foot, heavy tail, ears up.  It hops across."""
    P = T.P(u, v)
    f = -1.0 if flip else 1.0
    col = (206, 134, 88)
    belly = (240, 206, 170)
    d = uvd(travel * f, 0.0)

    def X(pts):
        return [(x * f * s, y * s) for x, y in pts]

    def m(t, age, ph):
        cyc = (t / 7.0 + ph / TAU) % 1.0
        go = min(1.0, cyc / 0.55)                 # hop across, then sit and look about
        hopping = cyc < 0.55
        k = abs(math.sin(t * 5.2 + ph)) if hopping else 0.0
        back = ease.smooth((cyc - 0.8) / 0.2) if cyc > 0.8 else 0.0
        e = go * (1 - back)
        return (d[0] * e, d[1] * e - 3.2 * s * k, (-9 * f * (k - 0.4)) if hopping else 0.0, 1.0, 1.0 - 0.06 * k if hopping else 1.0)
    m.reach = float(np.hypot(*d)) + 16
    with T.grp('pop', pivot=P, motion=m if hop else None, stage='life', dur=0.24):
        T.poly2(P, smooth_poly(X([(-1.2, -2.6), (-3.6, -1.6), (-6.4, -0.2), (-6.6, 0.5), (-3.4, -0.2), (-0.6, -0.9)]), 1), col, 0.3, wob=0)      # tail
        T.poly2(P, X([(-0.6, 0.1), (2.9, 0.1), (3.0, -0.5), (0.9, -0.8)]), shade(col, 0.86), 0.28, wob=0)                                # foot
        T.poly2(P, smooth_poly(X([(-1.9, -1.4), (-0.4, -0.5), (1.3, -1.0), (2.2, -3.4), (2.6, -6.0), (2.0, -7.2), (0.8, -6.6), (-0.6, -4.4), (-1.7, -3.0)]), 2),
                col, 0.34, wob=0)
        T.poly2(P, smooth_poly(X([(1.0, -1.6), (1.9, -3.4), (2.2, -5.6), (1.4, -4.0), (0.6, -2.2)]), 1), belly, 0, wob=0)
        T.ell2(P + np.array([-0.2 * f * s, -1.7 * s]), 1.55 * s, 1.25 * s, fill=col, ink=0.3, n=10, wob=0)                              # haunch
        T.line2(P, X([(2.0, -5.0), (3.3, -4.1), (3.6, -3.3)]), 0.55 * s, shade(col, 0.86), wob=0)                                      # forearm
        T.poly2(P, smooth_poly(X([(1.5, -7.0), (2.6, -8.3), (4.3, -7.9), (4.6, -7.2), (3.2, -6.6), (2.0, -6.4)]), 1), col, 0.32, wob=0)   # head
        T.poly2(P, X([(1.9, -8.0), (1.5, -10.3), (2.6, -8.4)]), col, 0.26, wob=0)
        T.poly2(P, X([(2.6, -8.3), (2.9, -10.5), (3.5, -8.2)]), col, 0.26, wob=0)
        T.ell2(P + np.array([3.5 * f * s, -7.6 * s]), 0.2 * s, fill=INK, ink=0, n=6, wob=0)


# --------------------------------------------------------------- boats ----
def wake(T, P, d, hl, s=1.0):
    """A boat under way trails spreading chevrons of foam behind it, ripples ring it when it rests,
    and a few strokes of reflection lie on the water beneath."""
    P = np.asarray(P, float)
    dr = np.asarray(d, float)
    dr = dr / (np.hypot(*dr) + 1e-9)
    nrm = np.array([-dr[1], dr[0]])
    ph0 = T.rng.uniform(0, 1)
    g = T.cur_group
    mo = g.motion
    gph = g.ph

    def draw(c, tau, t, a, R):
        _, v = mo.pos(t, gph)
        sp = min(1.0, abs(v))
        sg = 1.0 if v >= 0 else -1.0
        stern = P - dr * hl * 0.8 * sg
        bow = P + dr * hl * sg
        for k in range(3):                      # reflection strokes
            y = 1.2 + k * 1.1
            w = hl * (0.9 - 0.2 * k) + 0.4 * math.sin(t * 2.3 + k + ph0 * 6)
            R.poly(c, [P + np.array([-w, y]), P + np.array([w, y])], ink=WATER_D, w=0.4, a=a * 0.55, closed=False)
        if sp > 0.05:
            for k in range(3):
                f = (t * 0.42 + ph0 + k / 3.0) % 1.0
                c0 = stern - dr * sg * (0.6 + f * hl * 1.7)
                w = (1.3 + f * hl * 0.6) * s
                al = a * sp * (1 - f) ** 0.9 * min(1.0, f * 6)
                bk = dr * sg
                R.poly(c, [c0 + nrm * w - bk * w * 0.75, c0 + nrm * w * 0.45 - bk * w * 0.2, c0, c0 - nrm * w * 0.45 - bk * w * 0.2, c0 - nrm * w - bk * w * 0.75],
                       ink=FOAM, w=0.55, a=al, closed=False)
            R.poly(c, [bow + nrm * 1.5 - dr * sg * 1.6, bow + dr * sg * 0.7, bow - nrm * 1.5 - dr * sg * 1.6], ink=FOAM, w=0.45, a=a * sp * (0.6 + 0.3 * math.sin(t * 6 + ph0 * 9)), closed=False)
        if sp < 0.6:                            # at rest: rings
            for k in range(2):
                f = (t * 0.3 + ph0 + k / 2.0) % 1.0
                rr = hl * (0.9 + 1.0 * f)
                pts = [P + np.array([rr * math.cos(q), 1.0 + rr * 0.45 * math.sin(q)]) for q in np.linspace(0.2, math.pi - 0.2, 9)]
                R.poly(c, pts, ink=FOAM, w=0.4, a=a * (1 - sp / 0.6) * (1 - f) * 0.8, closed=False)
    T.custom(draw, [P - dr * hl * 4 - nrm * hl * 2, P - dr * hl * 4 + nrm * hl * 2, P + dr * hl * 4 + nrm * hl * 2, P + dr * hl * 4 - nrm * hl * 2], stage='life')


def hull(T, u, v, L, B, h, d='u', c=WOOD, deck=None, n=9, z=0.0, blunt=0.0):
    """Lens-shaped hull lying along an iso axis: visible side strake + deck."""
    g = T.cur_group
    if g is not None and hasattr(g.motion, 'd') and float(np.hypot(*g.motion.d)) > 1.0:
        wake(T, T.P(u, v, z), g.motion.d, L * W * 0.62)

    def pt(a, b, zz):
        return (u + a, v + b, zz) if d == 'u' else (u + b, v + a, zz)
    side_top, side_bot, other = [], [], []
    for k in range(n + 1):
        t = k / n
        a = -L / 2 + L * t
        w = B / 2 * max(blunt, math.sin(math.pi * t) ** 0.55)
        side_top.append(pt(a, w, z + h * (1 + 0.5 * (2 * t - 1) ** 2)))
        side_bot.append(pt(a * 0.9, w * 0.8, z))
        other.append(pt(a, -w, z + h * (1 + 0.5 * (2 * t - 1) ** 2)))
    T.poly(side_bot + side_top[::-1], shade(c, 0.86), 0.34, wob=0)
    T.poly(side_top + other[::-1], deck or shade(c, 1.12), 0.34, wob=0)


def sailboat(T, u, v, d='u', sail=MARBLE, c=MARBLE, s=1.0, motion=None, t0=None, jib=True):
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion or bobber(0.4, 2.0), stage='life', dur=0.26):
        hull(T, u, v, 0.075 * s, 0.026 * s, 0.008 * s, d, c)
        M = T.P(u, v, 0.008 * s)
        T.line2(M, [(0, 0), (0, -12.5 * s)], 0.4)
        sgn = 1 if d == 'u' else -1
        T.poly2(M, [(0.5 * sgn * s, -12.0 * s), (0.5 * sgn * s, -1.6 * s), (5.6 * sgn * s, -1.0 * s + 2.2 * s)], sail, 0.34, wob=0)
        if jib:
            T.poly2(M, [(-0.5 * sgn * s, -10.5 * s), (-0.5 * sgn * s, -1.8 * s), (-4.2 * sgn * s, -3.2 * s)], shade(sail, 0.93), 0.34, wob=0)
    return P


def felucca(T, u, v, d='u', sail=MARBLE, s=1.0, motion=None, t0=None):
    """Nile boat with a tall lateen sail."""
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion or bobber(0.35, 1.6), stage='life', dur=0.26):
        hull(T, u, v, 0.085 * s, 0.024 * s, 0.007 * s, d, WOOD)
        M = T.P(u, v, 0.008 * s)
        sgn = 1 if d == 'u' else -1
        T.line2(M, [(-1.5 * sgn * s, 0), (-1.5 * sgn * s, -6.5 * s)], 0.4)
        T.poly2(M, smooth_poly([(-4.6 * sgn * s, -2.2 * s), (4.2 * sgn * s, -15.0 * s), (3.0 * sgn * s, -7.0 * s), (1.5 * sgn * s, -1.2 * s)], 1), sail, 0.34, wob=0)
        T.line2(M, [(-5.0 * sgn * s, -1.6 * s), (4.4 * sgn * s, -15.6 * s)], 0.38)
    return P


def junk(T, u, v, d='u', sail=ACCENT, s=1.0, motion=None, t0=None):
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion or bobber(0.4, 1.4), stage='life', dur=0.28):
        hull(T, u, v, 0.11 * s, 0.034 * s, 0.013 * s, d, WOOD, blunt=0.45)
        M = T.P(u, v, 0.014 * s)
        sgn = 1 if d == 'u' else -1
        for (mx, hh, ww) in ((-3.6, 9.5, 3.4), (1.0, 13.5, 4.6), (5.0, 8.0, 2.8)):
            mx *= sgn * s
            T.line2(M, [(mx, mx * 0.5 * sgn * sgn * 0.0), (mx, -hh * s - 1.5)], 0.4)
            base = np.array([mx, 0.0])
            pts = [(-ww * 0.45 * s, -1.6 * s), (ww * 0.75 * s, -1.2 * s), (ww * 0.95 * s, -hh * 0.62 * s), (ww * 0.35 * s, -hh * s),
                   (-ww * 0.55 * s, -hh * 0.78 * s)]
            T.poly2(M + base, smooth_poly(pts, 1), sail, 0.34, wob=0)
            segs = []
            for q in (0.28, 0.5, 0.72):
                yy = -1.4 * s - (hh - 2.0) * s * q
                segs.append([(-ww * 0.5 * s, yy - 0.3), (ww * 0.9 * s, yy + 0.5)])
            T.lines2(M + base, segs, 0.26, ACCENT_D if sail == ACCENT else STONE_D)
    return P


def rowboat(T, u, v, d='u', c=TERRA, s=1.0, crew=1, motion=None, t0=None):
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion or bobber(0.3, 1.5), stage='life', dur=0.24):
        hull(T, u, v, 0.05 * s, 0.017 * s, 0.006 * s, d, c)
        for k in range(crew):
            a = (k - (crew - 1) / 2) * 0.016 * s
            pp = T.P(u + (a if d == 'u' else 0), v + (0 if d == 'u' else a), 0.006 * s)
            T.poly2(pp, [(-0.8, 0), (0.8, 0), (0.7, -2.0), (-0.7, -2.0)], T.rng.choice(CLOTH), 0.26, wob=0)
            T.ell2(pp + np.array([0, -2.9]), 0.95, fill=T.rng.choice(SKIN), ink=0.26, n=9, wob=0)
    return P


def steamer(T, u, v, d='u', L=0.13, c=MARBLE, trim=ACCENT, motion=None, t0=None, decks=2):
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion or bobber(0.3, 0.8), stage='life', dur=0.28):
        hull(T, u, v, L, L * 0.3, 0.012, d, c, blunt=0.55)
        bl, bw = L * 0.58, L * 0.17
        for k in range(decks):
            sc = 1 - 0.22 * k
            if d == 'u':
                T.box(u - bl * sc / 2, v - bw / 2, bl * sc, bw, 0.016, 0.014 + 0.016 * k, c=MARBLE if k else trim, ink=0.32)
            else:
                T.box(u - bw / 2, v - bl * sc / 2, bw, bl * sc, 0.016, 0.014 + 0.016 * k, c=MARBLE if k else trim, ink=0.32)
        T.cyl(u, v, L * 0.035, 0.03, 0.014 + 0.016 * decks, c=DARK, ink=0.3)
    return P


# ------------------------------------------------------------ vehicles ----
def tuktuk(T, u, v, d='u', c=ACCENT, motion=None, t0=None, s=1.0):
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion, stage='life', dur=0.24):
        l, w = 0.042 * s, 0.026 * s
        du, dv = (l, w) if d == 'u' else (w, l)
        u0, v0 = u - du / 2, v - dv / 2
        T.box(u0, v0, du, dv, 0.016 * s, 0.006, c=c, ink=0.32)
        T.box(u0, v0, du, dv, 0.016 * s, 0.022 * s + 0.006, c=DARK, top=(250, 222, 150), left=(214, 232, 240), right=(190, 214, 226), ink=0.32)
        for a in (0.2, 0.8):
            wp = T.P(u0 + (du * a if d == 'u' else du), v0 + (dv if d == 'u' else dv * a), 0.004)
            T.ell2(wp, 1.0 * s, 1.2 * s, fill=DARK, ink=0.2, n=8, wob=0)
    return P


def car(T, u, v, d='u', c=ZINC, motion=None, t0=None, s=1.0, long=1.0):
    P = T.P(u, v)
    with T.grp('pop', t0=t0, pivot=P, motion=motion, stage='life', dur=0.24):
        l, w = 0.055 * s * long, 0.028 * s
        du, dv = (l, w) if d == 'u' else (w, l)
        u0, v0 = u - du / 2, v - dv / 2
        T.box(u0, v0, du, dv, 0.013 * s, 0.005, c=c, ink=0.32)
        if d == 'u':
            T.box(u0 + du * 0.2, v0 + dv * 0.08, du * 0.55, dv * 0.84, 0.012 * s, 0.018 * s, c=(214, 232, 240), top=shade(c, 1.05), ink=0.3)
        else:
            T.box(u0 + du * 0.08, v0 + dv * 0.2, du * 0.84, dv * 0.55, 0.012 * s, 0.018 * s, c=(214, 232, 240), top=shade(c, 1.05), ink=0.3)
    return P


# ----------------------------------------------------------------- sky ----
def cloud(T, u, v, z, s=1.0, t0=None, drift=6.5, c=SNOW, edge=(150, 168, 190), dur=0.42, alpha=1.0):
    C = T.P(u, v, z)
    r = T.rng
    puffs = [(-5.2, 0.4, 3.0), (-1.6, -1.9, 4.1), (3.0, -0.9, 3.5), (6.6, 0.7, 2.5), (0.8, 1.0, 3.3), (-8.0, 1.3, 1.9)]
    ph = r.uniform(0, 6.28)
    mo = floaty(drift, 0.7, 0.55)
    gs = []
    old = (T.cur_group, T.instant_kw, T.stage)
    T.stage = 'sky'
    from .core import Group
    for (x, y, rr) in puffs:
        g = Group('condense', t0, dur, tuple(C + np.array([x, y]) * s), (r.uniform(-16, 16) * s, r.uniform(-9, 9) * s), mo, 'sky')
        g.ph = ph
        if t0 is not None:
            g.t0 = t0 + r.uniform(0, 0.12)
        T.groups.append(g)
        gs.append(g)
    T.instant_kw = {'instant': True}
    for g, (x, y, rr) in zip(gs, puffs):
        T.cur_group = g
        T.ell2(C + np.array([x, y]) * s, rr * s, rr * 0.82 * s, fill=None, ink=0.75, inkc=edge, n=14, wob=0, sky=True, alpha=alpha)
    for g, (x, y, rr) in zip(gs, puffs):
        T.cur_group = g
        T.ell2(C + np.array([x, y]) * s, rr * s, rr * 0.82 * s, fill=c, ink=0, n=14, wob=0, sky=True, alpha=alpha)
    T.cur_group, T.instant_kw, T.stage = old
    return C


def balloon(T, u, v, z, s=1.0, c=ACCENT, c2=MARBLE, t0=None, rise=26.0):
    C = T.P(u, v, z)
    with T.st('sky'):
        with T.grp('drift', t0=t0, dur=0.7, pivot=C, off=(0, rise), motion=floaty(6.5, 2.4, 0.7), stage='sky'):
            env = []
            for k in range(13):
                a = math.pi + math.pi * k / 12
                env.append((6.0 * s * math.cos(a), 6.0 * s * math.sin(a) - 3.0 * s))
            env += [(5.2 * s, 0.2 * s), (1.5 * s, 5.4 * s), (-1.5 * s, 5.4 * s), (-5.2 * s, 0.2 * s)]
            T.poly2(C, env, c, 0, wob=0)
            # gores
            for (a, b) in ((-0.78, -0.42), (-0.14, 0.14), (0.42, 0.78)):
                g = []
                for k in range(9):
                    tt = k / 8
                    yy = -9.0 * s + tt * 14.4 * s
                    wd = 6.0 * s * math.sin(math.pi * min(1.0, 0.08 + tt * 0.75)) ** 0.7 if tt < 0.62 else 6.0 * s * (1 - (tt - 0.62) / 0.38 * 0.75)
                    g.append((a * wd, yy))
                for k in range(9):
                    tt = 1 - k / 8
                    yy = -9.0 * s + tt * 14.4 * s
                    wd = 6.0 * s * math.sin(math.pi * min(1.0, 0.08 + tt * 0.75)) ** 0.7 if tt < 0.62 else 6.0 * s * (1 - (tt - 0.62) / 0.38 * 0.75)
                    g.append((b * wd, yy))
                T.poly2(C, g, c2, 0, wob=0)
            T.poly2(C, env, None, 0.42, wob=0)
            T.lines2(C, [[(-1.4 * s, 5.4 * s), (-0.9 * s, 8.2 * s)], [(1.4 * s, 5.4 * s), (0.9 * s, 8.2 * s)]], 0.25)
            T.poly2(C, [(-1.1 * s, 8.2 * s), (1.1 * s, 8.2 * s), (0.9 * s, 10.0 * s), (-0.9 * s, 10.0 * s)], WOOD, 0.3, wob=0)
    return C


def bird(T, u, v, z, s=1.0, c=INK, t0=None, orbit=(6.0, 2.5), speed=1.0, ph=None):
    C = T.P(u, v, z)

    def m(t, age, ph):
        a = t * 0.7 * speed + ph
        fl = 0.25 + 0.75 * abs(math.sin(t * 7.0 + ph * 5))
        return (orbit[0] * math.cos(a) + 0.35 * orbit[0] * math.sin(a * 0.37), orbit[1] * math.sin(a) + 0.5 * orbit[1] * math.sin(a * 0.53 + 1), 0.0, 1.0, fl)
    m.reach = orbit[0] * 1.5 + 10
    with T.st('sky'):
        with T.grp('fade', t0=t0, dur=0.3, pivot=C, motion=m, stage='sky', ph=ph):
            T.lines2(C, [[(-2.2 * s, -1.3 * s), (-1.0 * s, -0.5 * s), (0, 0)], [(0, 0), (1.0 * s, -0.5 * s), (2.2 * s, -1.3 * s)]], 0.45, c, wob=0)


def flag(T, at, c=ACCENT, s=1.0, pole=6.0, w=0.3, sky=False):
    at = np.asarray(at, float)
    T.line2(at, [(0, 0), (0, -pole * s)], w, sky=sky)

    def m(t, age, ph):
        return (0.0, 0.0, 0.0, 1.0 + 0.16 * math.sin(t * 6.0 + ph), 1.0 + 0.1 * math.sin(t * 9.0 + ph))
    old = T.cur_group
    if old is None:
        with T.grp('grow', pivot=at + np.array([0, -pole * s + 1.0 * s]), motion=m, stage='life', dur=0.25):
            T.poly2(at, [(0, -pole * s), (3.4 * s, -pole * s + 0.9 * s), (0, -pole * s + 2.0 * s)], c, 0.28, wob=0, sky=sky)
    else:
        T.poly2(at, [(0, -pole * s), (3.4 * s, -pole * s + 0.9 * s), (0, -pole * s + 2.0 * s)], c, 0.28, wob=0, sky=sky)


def lamp(T, at, r=1.0, c=ACCENT_L, t0=None, halo=True, sky=False, stage='life'):
    """A light that comes on: flicker, then a ring of glow that expands and fades."""
    at = np.asarray(at, float)
    with T.grp('light', t0=t0, dur=0.3, pivot=at, stage=stage) as g:
        T.ell2(at, r, fill=c, ink=0.22, n=9, wob=0, sky=sky)
    if halo:
        with T.grp('halo', t0=t0, dur=0.55, pivot=at, stage=stage) as h:
            T.ell2(at, r * 2.2, fill=None, ink=0.5, inkc=ACCENT, n=14, wob=0, sky=sky)
        return g, h
    return g, None


# --------------------------------------------------------------- water ----
def water(T, pts, src=None, c=WATER, t0=0.34, dur=0.5, marks=16, shore=0.5, seed=None, z=0.0, rmax=None,
          mark_c=(FOAM, WATER_D), stage='ground', region=None, smooth=0, flow=None):
    """A water body: pours in from `src` behind a foamy front, then its wave
    scribbles slosh and settle to a gentle shimmer."""
    reg = [(p[0], p[1]) for p in pts]
    if smooth:
        reg = [(p[0], p[1]) for p in smooth_poly([np.array(p[:2]) for p in pts], smooth)]
    if src is None:
        src = reg[0]
    o = T.P(src[0], src[1], z)
    far = max(np.hypot(*(T.P(p[0], p[1], z) - o) * np.array([1, 1.7])) for p in reg)
    wv = Wave(o, t0, dur, rmax or far * 1.08, foam=True, seed=T.rng.random())
    with T.st(stage):
        f = T.poly([(p[0], p[1], z) for p in reg], c, shore, wave=wv, tk=max(0.05, t0 - 0.16))
    # foam fringing the shore: a broken white line just inside the bank
    if shore > 0 and len(reg) >= 4:
        area = sum(reg[k][0] * reg[(k + 1) % len(reg)][1] - reg[(k + 1) % len(reg)][0] * reg[k][1] for k in range(len(reg)))
        sg = 1.0 if area > 0 else -1.0
        ins = []
        m = len(reg)
        for k in range(m):
            a_, b_ = reg[k - 1], reg[(k + 1) % m]
            dx, dy = b_[0] - a_[0], b_[1] - a_[1]
            L_ = math.hypot(dx, dy) + 1e-9
            ins.append((reg[k][0] - dy / L_ * 0.013 * sg, reg[k][1] + dx / L_ * 0.013 * sg))
        segs, cur = [], []
        for k in range(m + 1):
            q = ins[k % m]
            if not (0.012 < q[0] < 0.988 and 0.012 < q[1] < 0.988):
                if len(cur) > 1:
                    segs.append(cur)
                cur = []
                continue
            cur.append((q[0], q[1], z))
            if len(cur) >= T.rng.choice([3, 4, 6]):
                segs.append(cur)
                cur = []
        if len(cur) > 1:
            segs.append(cur)
        segs = [sg_ for k, sg_ in enumerate(segs) if k % 4 != 3]
        if segs:
            T.lines(segs, 0.42, FOAM, stage='mark', wave=wv)
    r = T.rng
    mreg = region or reg
    if flow is None:
        flow = (0.9, 0.25)
    else:
        fd = uvd(*flow)
        flow = tuple(fd / (np.hypot(*fd) + 1e-9))
    drift = drifter(flow, 6.0 if marks < 8 else 8.0, 1.5)
    for (u, v) in T.scatter(mreg, marks, seed=seed, mind=0.045):
        P = T.P(u, v, z)
        d = float(wv.dist(P[None, :])[0])
        l = r.uniform(1.6, 3.0)
        col = mark_c[0] if r.random() < 0.55 else mark_c[1]
        with T.grp('fade', t0=wv.time_at(d) + 0.05, dur=0.18, pivot=P, motion=drift, stage='life'):
            T.line2(P, smooth_poly([(-l, 0.3), (-l * 0.45, -0.75), (0.1, 0.0), (l * 0.55, 0.6), (l, 0.05)], 1, closed=False), 0.42, col, wob=0)
    return f, wv


def reeds(T, u, v, n=3, c=GRASS_D):
    P = T.P(u, v)
    with T.grp('pop', pivot=P, motion=sway(3.0, 1.6), stage='flora', dur=0.2):
        segs = [[(k * 0.8 - n * 0.4, 0), (k * 0.8 - n * 0.4 + T.rng.uniform(-0.6, 0.6), -T.rng.uniform(2.2, 3.6))] for k in range(n)]
        T.lines2(P, segs, 0.42, c, wob=0)


def glint(T, at, s=1.0, c=MARBLE):
    """A finishing sparkle on a hero: fired by the timeline in a ripple across the finished map."""
    at = np.asarray(at, float)
    with T.st('sky'):
        with T.grp('halo', t0=99.0, dur=0.6, pivot=at, stage='sky') as g:
            pts = []
            for k in range(8):
                a = math.pi * k / 4
                rr = 4.6 * s if k % 2 == 0 else 1.1 * s
                pts.append((rr * math.sin(a), -rr * math.cos(a)))
            T.poly2(at, pts, c, 0.36, inkc=ACCENT_D, wob=0, sky=True)
        with T.grp('halo', t0=99.0, dur=0.75, pivot=at, stage='sky') as h:
            T.ell2(at, 3.2 * s, fill=None, ink=0.5, inkc=ACCENT, n=16, wob=0, sky=True)
    T.finale += [g, h]
    # ... and once more on the closing wide shot
    with T.st('sky'):
        with T.grp('halo', t0=99.0, dur=0.7, pivot=at, stage='sky') as g2:
            T.poly2(at, pts, c, 0.36, inkc=ACCENT_D, wob=0, sky=True)
        with T.grp('halo', t0=99.0, dur=0.9, pivot=at, stage='sky') as h2:
            T.ell2(at, 3.2 * s, fill=None, ink=0.5, inkc=ACCENT, n=16, wob=0, sky=True)
    T.finale2 += [g2, h2]


def flock(T, u, v, z, n=6, s=0.75, c=INK, orbit=(18.0, 7.0), speed=0.8, t0=None):
    """Birds wheeling together: one orbit, a loose formation strung along it."""
    r = T.rng
    base = r.uniform(0, 6.283)
    for k in range(n):
        bird(T, u + r.uniform(-0.03, 0.03), v + r.uniform(-0.03, 0.03), z + r.uniform(-0.02, 0.02), s * r.uniform(0.8, 1.1), c, t0,
             orbit, speed, ph=base - k * 0.16 + r.uniform(-0.05, 0.05))


def smoke(T, at, s=1.0, c=(152, 156, 170), lean=4.0, t0=1.25, n=5, rise=17.0, sky=False):
    """Smoke as a hand-drawn wisp: two curling strokes that widen, drift with the wind and thin away as they climb."""
    at = np.asarray(at, float)
    ph0 = T.rng.uniform(0, 6.28)
    c = vivid(c)

    def draw(c_, tau, t, a, R):
        if tau < t0:
            return
        on = min(1.0, (tau - t0) / 0.5) * a
        ps = R.ps
        for strand, (off, amp) in enumerate(((0.0, 1.0), (1.9, 0.6))):
            K = 12
            prev = None
            for k in range(K + 1):
                f = k / K
                curl = (0.5 + 2.6 * f) * s * amp * math.sin(f * 6.0 - t * 1.5 + ph0 + off)
                x = at[0] + lean * s * f * f + curl + 0.8 * off * f
                y = at[1] - rise * s * f
                if prev is not None:
                    al = on * (0.75 if strand == 0 else 0.5) * (1 - f) ** 1.2 * min(1.0, f * 5 + 0.3)
                    ps.setColor(argb_(c, al))
                    ps.setStrokeWidth((0.5 + 1.5 * f) * s * (1.0 if strand == 0 else 0.7))
                    c_.drawLine(prev[0], prev[1], x, y, ps)
                prev = (x, y)
    T.custom(draw, [at + np.array([-7 * s, -rise * s - 4]), at + np.array([lean * s + 9 * s, 2])], stage='sky' if sky else 'life', sky=sky)


def argb_(c, a):
    import skia
    return skia.ColorSetARGB(int(max(0.0, min(1.0, a)) * 255), int(c[0]), int(c[1]), int(c[2]))


def skia_circle(x, y, r):
    import skia
    p = skia.Path()
    p.addCircle(float(x), float(y), float(r))
    return p


def spray(T, pts, s=1.0, n=14, t0=1.0, up=9.0, c=FOAM):
    """Churned spray along the foot of a waterfall: droplets leap in little arcs, endlessly."""
    pts = [np.asarray(p, float) for p in pts]
    r = T.rng
    seeds = [(r.uniform(0, 1), r.uniform(0, 1), r.uniform(-1, 1), r.uniform(0.6, 1.3)) for _ in range(n)]

    def draw(c_, tau, t, a, R):
        if tau < t0:
            return
        on = min(1.0, (tau - t0) / 0.3)
        for (q, ph, dx, hh) in seeds:
            f = (t * 0.9 * hh + ph) % 1.0
            i = min(len(pts) - 2, int(q * (len(pts) - 1)))
            fr = q * (len(pts) - 1) - i
            b = pts[i] + (pts[i + 1] - pts[i]) * fr
            x = b[0] + dx * 4.0 * s * f
            y = b[1] - up * s * hh * 4 * f * (1 - f)
            p = skia_circle(x, y, (0.35 + 0.5 * (1 - f)) * s)
            R.fill(c_, p, c, on * a * (1 - f * 0.6))
            R.stroke(c_, p, WATER_D, 0.16, on * a * 0.5 * (1 - f))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    T.custom(draw, [np.array([min(xs) - 6, min(ys) - up * s * 1.4]), np.array([max(xs) + 6, max(ys) + 2])], stage='life')


def petals(T, region_px, n=14, c=BLOSSOM, t0=1.3, fall=16.0):
    """Blossom drifting down on the breeze."""
    x0, y0, x1, y1 = region_px
    r = T.rng
    seeds = [(r.uniform(x0, x1), r.uniform(y0, y1), r.uniform(0, 1), r.uniform(0.7, 1.3)) for _ in range(n)]

    def draw(c_, tau, t, a, R):
        if tau < t0:
            return
        on = min(1.0, (tau - t0) / 0.4)
        for (x, y, ph, sp) in seeds:
            f = (t * 0.16 * sp + ph) % 1.0
            px = x + 5.0 * f + 1.6 * math.sin(f * 14 + ph * 20)
            py = y + fall * f
            R.fill(c_, skia_circle(px, py, 0.55), c, on * a * math.sin(math.pi * f) ** 0.5)
    T.custom(draw, [np.array([x0 - 3, y0 - 3]), np.array([x1 + 9, y1 + fall + 3])], stage='life')


def sparkles(T, pts, t0=1.5, c=MARBLE, s=1.0, rate=1.6):
    """Lights that twinkle: each point flashes a little four-point star now and then."""
    pts = [np.asarray(p, float) for p in pts]
    r = T.rng
    seeds = [(r.uniform(0, 1), r.uniform(0.7, 1.4)) for _ in pts]

    def draw(c_, tau, t, a, R):
        if tau < t0:
            return
        for p, (ph, sp) in zip(pts, seeds):
            f = (t * rate * 0.5 * sp + ph) % 1.0
            if f > 0.3:
                continue
            k = math.sin(math.pi * f / 0.3)
            q = 2.3 * s * k
            star = [p + np.array([0, -q]), p + np.array([q * 0.22, -q * 0.22]), p + np.array([q, 0]), p + np.array([q * 0.22, q * 0.22]),
                    p + np.array([0, q]), p + np.array([-q * 0.22, q * 0.22]), p + np.array([-q, 0]), p + np.array([-q * 0.22, -q * 0.22])]
            R.poly(c_, star, fill=c, ink=ACCENT_D, w=0.2, a=a * k)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    T.custom(draw, [np.array([min(xs) - 4, min(ys) - 4]), np.array([max(xs) + 4, max(ys) + 4])], stage='sky', sky=True)
