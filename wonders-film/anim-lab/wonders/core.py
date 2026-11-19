"""World-model core: isometric projection, hand wobble, shapes, groups, wash
waves and the Tile builder with its drawing primitives.

Units
-----
* tile space  : (u, v, z).  u runs down-right, v runs down-left, z is up.
                A tile is the unit square; z is in the same unit.
* map space   : 2D "map px".  One tile is 200 map px wide and 100 high.
                Everything (line widths included) lives in map px, so the
                renderer can draw any part of the map at any zoom.
"""
import math
import random
from contextlib import contextmanager

import numpy as np
import skia

from . import ease
from .pal import *  # noqa

W = 100.0          # map px per unit along screen-x
ZS = 122.0         # map px per unit of height
GAP = 0.10         # paper gap between slabs
PITCH = 1.0 + GAP
SLAB = 0.11        # slab thickness (z units)
SQ2 = math.sqrt(2.0)

# stage -> (ink window start, end) in seconds relative to the tile's start
INK_WIN = {
    'slab': (0.00, 0.26),
    'ground': (0.14, 0.52),
    'struct': (0.30, 0.88),
    'detail': (0.60, 1.02),
}
FLORA_WIN = (0.86, 1.20)
LIFE_WIN = (1.10, 1.42)
SKY_WIN = (1.05, 1.38)
TILE_DONE = 1.55


def iso(X, Y, z=0.0):
    return np.array([(X - Y) * W, (X + Y) * W * 0.5 - z * ZS])


# ---------------------------------------------------------------- wobble ----
def wobble(pts, amp):
    """Displace by a smooth field anchored to the map: shared edges wobble
    together, and the wobble enlarges with the drawing in close-ups."""
    x = pts[:, 0]
    y = pts[:, 1]
    dx = (np.sin(x * 0.23 + y * 0.17 + 1.3) + 0.55 * np.sin(x * 0.51 - y * 0.43 + 4.1)
          + 0.3 * np.sin(x * 0.97 + y * 0.83 + 0.7))
    dy = (np.sin(x * 0.19 - y * 0.25 + 2.9) + 0.55 * np.sin(-x * 0.47 + y * 0.57 + 5.3)
          + 0.3 * np.sin(x * 0.89 - y * 1.03 + 3.3))
    return pts + amp * np.stack([dx, dy], 1)


def resample(pts, closed, step=2.6):
    pts = np.asarray(pts, float)
    if closed:
        pts = np.vstack([pts, pts[:1]])
    seg = np.diff(pts, axis=0)
    d = np.hypot(seg[:, 0], seg[:, 1])
    out = []
    for k in range(len(pts) - 1):
        n = max(1, int(math.ceil(d[k] / step)))
        tt = np.arange(n) / n
        out.append(pts[k] + seg[k] * tt[:, None])
    if not closed:
        out.append(pts[-1:])
    return np.vstack(out)


def argb(c, a=1.0):
    return skia.ColorSetARGB(int(max(0, min(1, a)) * 255), int(c[0]), int(c[1]), int(c[2]))


def pip(poly, x, y):
    """point in polygon (uv space)"""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i][0], poly[i][1]
        xj, yj = poly[j][0], poly[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def smooth_poly(pts, it=2, closed=True):
    """Chaikin corner cutting -> soft organic outlines."""
    pts = [np.asarray(p, float) for p in pts]
    for _ in range(it):
        out = []
        n = len(pts)
        rng = range(n) if closed else range(n - 1)
        if not closed:
            out.append(pts[0])
        for k in rng:
            a = pts[k]
            b = pts[(k + 1) % n]
            out.append(a * 0.75 + b * 0.25)
            out.append(a * 0.25 + b * 0.75)
        if not closed:
            out.append(pts[-1])
        pts = out
    return pts


# ----------------------------------------------------------------- shape ----
class Shape:
    __slots__ = ('subs', 'closed', 'fill', 'ink', 'inkc', 'stage', 'tk', 'dk', 'wave',
                 'wd0', 'wd1', 'tw1', 'group', 'path', 'bbox', 'cx', 'cy', 'layer',
                 'draw', 'length', 'tp', 'dp', 'te', 'de', 'link', 'sky', 'alpha',
                 'instant', 'order', 'under', 'clip', 'path2', 'toff')

    def __init__(self, subs, closed, fill, ink, inkc, stage):
        self.subs = subs
        self.closed = closed
        self.fill = fill
        self.ink = ink
        self.inkc = inkc
        self.stage = stage
        self.tk = None
        self.dk = None
        self.wave = None
        self.group = None
        self.layer = 'ink'
        self.draw = None
        self.tp = None
        self.te = None
        self.dp = 0.2
        self.de = 0.22
        self.link = None
        self.sky = False
        self.alpha = 1.0
        self.instant = False
        self.under = None
        self.clip = None
        self.path2 = None
        self.toff = 0.0
        self.wd0 = self.wd1 = 0.0
        self.tw1 = -1e9
        self.order = 0
        self._build()

    def _build(self):
        p = skia.Path()
        allp = []
        L = 0.0
        for sub in self.subs:
            pts = [skia.Point(float(a), float(b)) for a, b in sub]
            p.addPoly(pts, self.closed)
            allp.append(sub)
            d = np.diff(sub, axis=0)
            L += float(np.hypot(d[:, 0], d[:, 1]).sum())
        self.path = p
        a = np.vstack(allp)
        self.bbox = (a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max())
        self.cx = float(a[:, 0].mean())
        self.cy = float(a[:, 1].mean())
        self.length = L


class Group:
    """A set of shapes that arrives (and afterwards lives) as one body."""
    __slots__ = ('kind', 't0', 'dur', 'pivot', 'off', 'motion', 'stage', 'rank_pt', 'bbox', 'ph', 'reach', 'seed',
                 'role', 'fx')     # anim-lab: what this piece is, and the feel's per-piece data

    def __init__(self, kind=None, t0=None, dur=0.3, pivot=(0.0, 0.0), off=(0.0, 0.0),
                 motion=None, stage='life'):
        self.kind = kind
        self.t0 = t0
        self.dur = dur
        self.pivot = pivot
        self.off = off
        self.motion = motion
        self.stage = stage
        self.bbox = None
        self.ph = 0.0
        self.reach = 14.0 if motion is None else float(getattr(motion, 'reach', 40.0))
        self.seed = 0.0
        self.role = None
        self.fx = None

    def state(self, tau, t):
        """-> None (hidden) or (dx, dy, rot, sx, sy, alpha, wipe)"""
        dx = dy = rot = 0.0
        sx = sy = 1.0
        a = 1.0
        wipe = None
        k = self.kind
        if k is not None:
            x = (tau - self.t0) / self.dur
            if x <= 0:
                return None
            if k == 'pop':                     # squash & stretch bounce
                if x < 2.2:
                    e = ease.spring(x * 0.55, 1.25, 4.6)
                    sy = e
                    sx = e ** 0.6 if e < 1 else 1 - 0.55 * (e - 1)
            elif k == 'rise':                  # heavy mass pushing up
                if x < 1:
                    e = ease.out_back(x, 1.15)
                    sy = max(0.001, e)
                    sx = 0.88 + 0.12 * ease.out_cubic(x)
                    dx = math.sin(tau * 95.0) * 0.5 * (1 - x) ** 2
            elif k == 'tower':                 # light structure shooting up with anticipation
                if x < 1.6:
                    e = ease.anticipate_back(x / 1.6, 0.10, 2.0)
                    sy = max(0.001, e) if x > 0.16 else 0.02 + 0.2 * x
                    sx = 1 + 0.25 * (1 - min(1.0, x * 1.4)) ** 2
            elif k == 'drop':
                if x < 1:
                    dy = -(1 - ease.bounce(x)) * self.off[1]
                    a = min(1.0, x * 5)
            elif k == 'drift':
                if x < 1:
                    e = ease.out_quint(x)
                    dx = self.off[0] * (1 - e)
                    dy = self.off[1] * (1 - e)
                    a = min(1.0, x * 2.2)
                    sx = 1 + 0.5 * (1 - e)
            elif k == 'condense':
                if x < 1:
                    e = ease.out_cubic(x)
                    dx = self.off[0] * (1 - e)
                    dy = self.off[1] * (1 - e)
                    sx = sy = 0.15 + 0.85 * ease.out_back(x, 1.4)
                    a = ease.smooth(x * 1.6)
            elif k == 'grow':
                if x < 1:
                    sx = sy = max(0.001, ease.out_back(x, 1.7))
            elif k == 'fade':
                a = ease.smooth(x)
            elif k == 'light':                 # a lamp catching: flick, dip, hold
                if x < 0.18:
                    a = 1.0
                elif x < 0.36:
                    a = 0.2
                elif x < 0.6:
                    a = 1.0
                elif x < 0.75:
                    a = 0.55
            elif k == 'halo':
                if x >= 1:
                    return None
                sx = sy = 0.3 + 1.9 * ease.out_cubic(x)
                a = (1 - x) ** 1.5
            elif k == 'wipe':                  # top-down reveal (snow settling)
                if x < 1:
                    wipe = ease.out_cubic(x)
        if self.motion is not None:
            m = self.motion(t, tau - (self.t0 or 0.0), self.ph)
            dx += m[0]
            dy += m[1]
            if len(m) > 2:
                rot += m[2]
                sx *= m[3]
                sy *= m[4]
                if len(m) > 5:
                    a *= m[5]
                    if a <= 0.004:
                        return None
        return (dx, dy, rot, sx, sy, a, wipe)


class Wave:
    """An expanding wet front. Fills are revealed where it has passed."""

    def __init__(self, origin, t0, dur, rmax, foam=False, seed=0, squash=1.7):
        self.o = (float(origin[0]), float(origin[1]))
        self.t0 = t0
        self.dur = dur
        self.rmax = rmax
        self.foam = foam
        self.sq = squash
        r = random.Random(seed)
        self.ph = [r.uniform(0, 6.28) for _ in range(4)]

    def radius(self, tau):
        p = (tau - self.t0) / self.dur
        if p <= 0:
            return 0.0
        if p >= 1:
            return 1e9
        return self.rmax * (1 - (1 - p) ** 1.6)

    def time_at(self, d):
        q = min(1.0, max(0.0, d / self.rmax))
        return self.t0 + self.dur * (1 - (1 - q) ** (1 / 1.6))

    def dist(self, pts):
        return np.hypot(pts[:, 0] - self.o[0], (pts[:, 1] - self.o[1]) * self.sq)

    def blob(self, R, tau, grow=1.0):
        th = np.linspace(0, 2 * math.pi, 56, endpoint=False)
        p = self.ph
        r = R * grow * (1 + 0.10 * np.sin(3 * th + p[0] + tau * 2.2) + 0.06 * np.sin(7 * th + p[1] - tau * 3.1)
                        + 0.035 * np.sin(13 * th + p[2] + tau * 5.0))
        x = self.o[0] + r * np.cos(th)
        y = self.o[1] + r * np.sin(th) / self.sq
        path = skia.Path()
        path.addPoly([skia.Point(float(a), float(b)) for a, b in zip(x, y)], True)
        return path


# ------------------------------------------------------------------ tile ----
class Tile:
    def __init__(self, name, i, j, kind='tile', seed=1):
        self.name = name
        self.i = i
        self.j = j
        self.kind = kind
        self.X0 = i * PITCH
        self.Y0 = j * PITCH
        self.shapes = []
        self.groups = []
        self.rng = random.Random(seed * 7919 + 13)
        self.stage = 'struct'
        self.cur_group = None
        self.cur_wave = None
        self.start = 0.0          # set by the timeline
        self.ph_t = None          # when the pencil placeholder is drawn
        self.done = TILE_DONE
        self.rate = 1.0
        self.center = self.P(0.5, 0.5)
        self.sweep = np.array([0.0, 1.0])
        self.waves = {}
        self.placeholder = []
        self.hold = None          # optional tile-specific overrides
        self.instant_kw = {}
        self.finale = []          # groups the timeline fires together when the map stands complete
        self.finale2 = []         # ... and again on the closing wide shot
        self.marks = {'start': 0}  # named positions in the draw order, so later passes can slot detail in
        self._ins = None
        self.bob = None           # (amplitude px, period s, phase): the whole piece floats gently
        self.keel = []            # anim-lab: the rock hanging under the slab (shapes) ...
        self.keel_groups = []     # ... and the loose chunks drifting below it

    # ---- coordinates
    def P(self, u, v, z=0.0):
        return iso(self.X0 + u, self.Y0 + v, z)

    def P3(self, p):
        if len(p) == 2:
            return iso(self.X0 + p[0], self.Y0 + p[1], 0.0)
        return iso(self.X0 + p[0], self.Y0 + p[1], p[2])

    # ---- contexts
    @contextmanager
    def st(self, stage, wave=None):
        old = (self.stage, self.cur_wave)
        self.stage = stage
        if wave is not None:
            self.cur_wave = wave
        try:
            yield
        finally:
            self.stage, self.cur_wave = old

    @contextmanager
    def grp(self, kind=None, t0=None, dur=0.3, pivot=None, off=(0.0, 0.0), motion=None, stage=None,
            instant=True, ph=None, ink_now=False, under=None):
        g = Group(kind, t0, dur, tuple(pivot) if pivot is not None else (0.0, 0.0), off, motion,
                  stage or self.stage)
        g.ph = self.rng.uniform(0, 6.283) if ph is None else ph
        g.seed = self.rng.uniform(0, 100.0)
        if kind in ('drift', 'condense', 'drop'):
            g.reach = max(g.reach, 40.0)
        self.groups.append(g)
        old = (self.cur_group, self.instant_kw)
        self.cur_group = g
        self.instant_kw = {'instant': instant}
        if ink_now:
            self.instant_kw = {'instant': False, 'tk': -100.0, 'under': under}
        try:
            yield g
        finally:
            self.cur_group, self.instant_kw = old

    # ---- low level
    def _add(self, subs, closed, fill, ink, inkc=INK, wob=None, stage=None, tk=None, dk=None,
             wave=None, layer='ink', sky=False, alpha=1.0, instant=None, raw=False, at=None):
        out = []
        for sub in subs:
            sub = np.asarray(sub, float)
            if not raw:
                sub = resample(sub, closed)
                ext = max(np.ptp(sub[:, 0]), np.ptp(sub[:, 1]))
                amp = wob if wob is not None else min(0.26, 0.035 * ext)
                if amp > 0:
                    sub = wobble(sub, amp)
            elif closed:
                sub = np.vstack([sub, sub[:1]])[:-1]
            out.append(sub)
        sh = Shape(out, closed, vivid(fill), ink, vivid(inkc), stage or self.stage)
        sh.tk = tk
        sh.dk = dk
        sh.wave = wave if wave is not None else self.cur_wave
        sh.group = self.cur_group
        sh.layer = layer
        sh.sky = sky or (self.stage == 'sky')
        sh.alpha = alpha
        if instant is None:
            instant = self.instant_kw.get('instant', False) if self.cur_group is not None else False
        sh.instant = instant
        if self.cur_group is not None and 'tk' in self.instant_kw and layer != 'pencil':
            if sh.tk is None:
                sh.tk = self.instant_kw['tk']
                sh.dk = 0.01
            sh.under = self.instant_kw.get('under')
        sh.order = len(self.shapes)
        if at is None and self._ins is not None:
            at = self._ins
            self._ins += 1
        if at is None:
            self.shapes.append(sh)
        else:
            self.shapes.insert(at, sh)
        return sh

    def mark(self, name):
        self.marks[name] = len(self.shapes)

    @contextmanager
    def at(self, name):
        """Draw into the tile at a marked depth (so late detail still sits behind whatever was drawn after the mark)."""
        idx = self.marks.get(name, len(self.shapes))
        n0 = len(self.shapes)
        old = self._ins
        self._ins = idx
        try:
            yield
        finally:
            added = len(self.shapes) - n0
            self._ins = old
            for k, v in list(self.marks.items()):
                if v >= idx and k != 'start':
                    self.marks[k] = v + added

    def poly(self, pts, fill=None, ink=0.5, inkc=INK, closed=True, **kw):
        return self._add([[self.P3(p) for p in pts]], closed, fill, ink, inkc, **kw)

    def line(self, pts, w=0.5, c=INK, **kw):
        return self._add([[self.P3(p) for p in pts]], False, None, w, c, **kw)

    def lines(self, segs, w=0.4, c=INK, **kw):
        return self._add([[self.P3(p) for p in s] for s in segs], False, None, w, c, **kw)

    def poly2(self, at, pts, fill=None, ink=0.4, inkc=INK, closed=True, **kw):
        at = np.asarray(at, float)
        return self._add([[at + np.asarray(p, float) for p in pts]], closed, fill, ink, inkc, **kw)

    def line2(self, at, pts, w=0.4, c=INK, **kw):
        at = np.asarray(at, float)
        return self._add([[at + np.asarray(p, float) for p in pts]], False, None, w, c, **kw)

    def lines2(self, at, segs, w=0.35, c=INK, **kw):
        at = np.asarray(at, float)
        return self._add([[at + np.asarray(p, float) for p in s] for s in segs], False, None, w, c, **kw)

    def ell2(self, at, rx, ry=None, fill=None, ink=0.4, inkc=INK, n=None, a0=0.0, a1=2 * math.pi, closed=True,
             **kw):
        ry = rx if ry is None else ry
        n = n or max(10, int(4 + 2.2 * max(rx, ry)))
        th = np.linspace(a0, a1, n, endpoint=not closed)
        pts = np.stack([rx * np.cos(th), ry * np.sin(th)], 1)
        at = np.asarray(at, float)
        kw.setdefault('wob', min(0.2, 0.03 * max(rx, ry)))
        return self._add([at + pts], closed, fill, ink, inkc, raw=False, **kw)

    def ring(self, u, v, r, z=0.0, n=40, a0=0.0, a1=360.0, rv=None):
        """points of a ground-plane circle (as tile-space tuples)."""
        rv = r if rv is None else rv
        out = []
        for k in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * k / n)
            out.append((u + r * math.cos(a), v + rv * math.sin(a), z))
        return out

    def disk(self, u, v, r, z=0.0, fill=None, ink=0.5, rv=None, **kw):
        return self.poly(self.ring(u, v, r, z, rv=rv)[:-1], fill, ink, **kw)

    # ---- pencil construction
    def guide(self, segs, ticks=0, over=0.14, link=None, tp=None, te=None, w=0.48, tick_len=1.5, px=False):
        """Pencil construction lines: overshooting ends + measuring ticks."""
        subs = []
        for seg in segs:
            pts = [np.asarray(p if px else self.P3(p), float) for p in seg]
            a, b = pts[0], pts[-1]
            if len(pts) == 2:
                d = b - a
                L = np.hypot(*d) + 1e-9
                ex = d / L * max(2.2, L * over)
                pts = [a - ex, b + ex]
                subs.append(pts)
                if ticks:
                    nrm = np.array([-d[1], d[0]]) / L * tick_len
                    for k in range(ticks + 1):
                        c = a + d * k / ticks
                        subs.append([c - nrm, c + nrm])
            else:
                subs.append(pts)
        sh = self._add(subs, False, None, w, PENCIL, layer='pencil', wob=0.4, instant=False)
        # a second, lighter pass of the pencil that doesn't quite retrace the first: the hand going over a line
        p2 = skia.Path()
        for k, sub in enumerate(sh.subs):
            off = np.array([31.7 + 5.3 * k, 17.3 - 3.1 * k])
            s2 = wobble(sub + off, 0.38) - off
            if len(s2) > 2:
                n = len(s2)
                a0, a1 = int(n * 0.04), n - int(n * 0.07)          # the second stroke starts late and lifts early
                s2 = s2[a0:max(a0 + 2, a1)]
            p2.addPoly([skia.Point(float(x), float(y)) for x, y in s2], False)
        sh.path2 = p2
        sh.group = None
        sh.link = link
        sh.tp = tp
        sh.te = te
        return sh

    def guide_box(self, u0, v0, du, dv, h, z=0.0, link=None):
        u1, v1 = u0 + du, v0 + dv
        segs = [[(u0, v0, z), (u1, v0, z)], [(u1, v0, z), (u1, v1, z)], [(u1, v1, z), (u0, v1, z)],
                [(u0, v1, z), (u0, v0, z)], [(u0, v0, z), (u1, v1, z)]]
        g1 = self.guide(segs, link=link)
        g2 = self.guide([[(u1, v1, z), (u1, v1, z + h)]], ticks=max(2, min(6, int(h * 14))), link=link)
        return g1, g2

    def guide_axis(self, u, v, h, z=0.0, ticks=5, link=None, r=None):
        segs = [[(u, v, z), (u, v, z + h)]]
        g = self.guide(segs, ticks=ticks, link=link, over=0.1)
        if r:
            self.guide([[(u - r, v, z), (u + r, v, z)], [(u, v - r, z), (u, v + r, z)]], link=link)
            self.guide([self.ring(u, v, r, z, n=28)], link=link)
        return g

    # ---- solids
    def box(self, u0, v0, du, dv, h, z=0.0, c=STONE, top=None, left=None, right=None, ink=0.5,
            guide=None, **kw):
        u1, v1, z1 = u0 + du, v0 + dv, z + h
        top = top or c
        left = left or shade(c, 0.94)
        right = right or shade(c, 0.83)
        L = self.poly([(u0, v1, z), (u1, v1, z), (u1, v1, z1), (u0, v1, z1)], left, ink, **kw)
        R = self.poly([(u1, v0, z), (u1, v1, z), (u1, v1, z1), (u1, v0, z1)], right, ink, **kw)
        T = self.poly([(u0, v0, z1), (u1, v0, z1), (u1, v1, z1), (u0, v1, z1)], top, ink, **kw)
        if guide or (guide is None and self.cur_group is None and self.stage == 'struct'
                     and (du + dv) * W > 26 and h * ZS > 5):
            self.guide_box(u0, v0, du, dv, h, z, link=L)
        return L, R, T

    def gable(self, u0, v0, du, dv, h, z=0.0, c=TERRA, axis='u', wall=None, ink=0.5, over=0.0, **kw):
        """Gable roof. axis = direction of the ridge."""
        u1, v1 = u0 + du, v0 + dv
        lit = shade(c, 1.0)
        drk = shade(c, 0.84)
        if axis == 'u':
            vm = (v0 + v1) / 2
            self.poly([(u0 - over, v0, z), (u1 + over, v0, z), (u1 + over, vm, z + h), (u0 - over, vm, z + h)], drk, ink, **kw)
            if wall:
                self.poly([(u1, v0, z), (u1, v1, z), (u1, vm, z + h)], shade(wall, 0.83), ink, **kw)
            self.poly([(u0 - over, v1, z), (u1 + over, v1, z), (u1 + over, vm, z + h), (u0 - over, vm, z + h)], lit, ink, **kw)
        else:
            um = (u0 + u1) / 2
            self.poly([(u0, v0 - over, z), (u0, v1 + over, z), (um, v1 + over, z + h), (um, v0 - over, z + h)], lit, ink, **kw)
            if wall:
                self.poly([(u0, v1, z), (u1, v1, z), (um, v1, z + h)], shade(wall, 0.94), ink, **kw)
            self.poly([(u1, v0 - over, z), (u1, v1 + over, z), (um, v1 + over, z + h), (um, v0 - over, z + h)], drk, ink, **kw)

    def pyr(self, u0, v0, du, dv, h, z=0.0, c=SAND, left=None, right=None, ink=0.5, guide=None, apex=None, **kw):
        u1, v1 = u0 + du, v0 + dv
        ax = apex or ((u0 + u1) / 2, (v0 + v1) / 2)
        A = (ax[0], ax[1], z + h)
        left = left or shade(c, 1.0)
        right = right or shade(c, 0.84)
        self.poly([(u0, v0, z), (u1, v0, z), A], shade(c, 0.78), ink, **kw)
        self.poly([(u0, v0, z), (u0, v1, z), A], shade(c, 0.9), ink, **kw)
        L = self.poly([(u0, v1, z), (u1, v1, z), A], left, ink, **kw)
        R = self.poly([(u1, v0, z), (u1, v1, z), A], right, ink, **kw)
        if guide or (guide is None and self.cur_group is None and self.stage == 'struct' and du * W > 12):
            self.guide([[(u0, v0, z), (u1, v0, z)], [(u1, v0, z), (u1, v1, z)], [(u1, v1, z), (u0, v1, z)],
                        [(u0, v1, z), (u0, v0, z)], [(u0, v0, z), (u1, v1, z)], [(u1, v0, z), (u0, v1, z)]], link=L)
            self.guide([[(ax[0], ax[1], z), A]], ticks=4, link=L)
        return L, R

    def prism(self, prof, near, width, axis='v', c=STONE, top=None, lit=None, dark=None, ink=0.45, face=None, **kw):
        """Extrude a side profile.  axis='v': profile is [(u, z)...] on the plane v=near,
        extruded back to v=near-width (its flank is the lit face).  axis='u': profile is
        [(v, z)...] on the plane u=near, extruded back to u=near-width."""
        top = top or shade(c, 1.03)
        lit = lit or shade(c, 0.94)
        dark = dark or shade(c, 0.83)
        n = len(prof)
        area = sum(prof[k][0] * prof[(k + 1) % n][1] - prof[(k + 1) % n][0] * prof[k][1] for k in range(n))
        sgn = 1.0 if area > 0 else -1.0

        def pt(a, z, w):
            return (a, near - w, z) if axis == 'v' else (near - w, a, z)
        quads = []
        for k in range(n):
            a, b = prof[k], prof[(k + 1) % n]
            da, dz = b[0] - a[0], b[1] - a[1]
            na, nz = dz * sgn, -da * sgn          # outward normal in the profile plane
            if na + 0.816 * nz <= 1e-6:
                continue
            L = math.hypot(na, nz) + 1e-12
            up = nz / L
            col = top if up > 0.5 else (dark if axis == 'v' else lit)
            if 0.15 < up <= 0.5:
                col = mix(top, dark if axis == 'v' else lit, 0.5)
            quads.append(((a[0] + b[0]) / 2 + (a[1] + b[1]) * 0.5, [pt(a[0], a[1], 0), pt(b[0], b[1], 0), pt(b[0], b[1], width), pt(a[0], a[1], width)], col))
        quads.sort(key=lambda q: q[0])
        for _, q, col in quads:
            self.poly(q, col, ink * 0.85, **kw)
        return self.poly([pt(a, z, 0) for a, z in prof], face or (lit if axis == 'v' else dark), ink, **kw)

    # ---- things drawn on the two visible wall planes ('L' = +v face, 'R' = +u face)
    def fpt(self, face, a, plane, z):
        return (a, plane, z) if face == 'L' else (plane, a, z)

    def rects(self, face, a0, a1, plane, z0, z1, cols, rows, fill=DARK, fw=0.55, fh=0.6, ink=0.22, arch=False,
              stage='detail', **kw):
        subs = []
        cw = (a1 - a0) / cols
        ch = (z1 - z0) / rows
        for r in range(rows):
            for c in range(cols):
                ac = a0 + cw * (c + 0.5)
                zb = z0 + ch * (r + 0.5) - ch * fh / 2
                w2 = cw * fw / 2
                hh = ch * fh
                if arch:
                    pts = [(ac - w2, zb), (ac - w2, zb + hh * 0.62), (ac - w2 * 0.7, zb + hh * 0.9), (ac, zb + hh),
                           (ac + w2 * 0.7, zb + hh * 0.9), (ac + w2, zb + hh * 0.62), (ac + w2, zb)]
                else:
                    pts = [(ac - w2, zb), (ac - w2, zb + hh), (ac + w2, zb + hh), (ac + w2, zb)]
                subs.append([self.P3(self.fpt(face, a, plane, z)) for a, z in pts])
        return self._add(subs, True, fill, ink, stage=stage, **kw)

    def arch(self, face, ac, plane, z0, w, h, fill=DARK, ink=0.3, stage='detail', n=7, **kw):
        pts = [(ac - w / 2, z0), (ac - w / 2, z0 + h - w / 2)]
        for k in range(1, n):
            a = math.pi - math.pi * k / n
            pts.append((ac + w / 2 * math.cos(a), z0 + h - w / 2 + w / 2 * math.sin(a)))
        pts += [(ac + w / 2, z0 + h - w / 2), (ac + w / 2, z0)]
        return self.poly([self.fpt(face, a, plane, z) for a, z in pts], fill, ink, stage=stage, **kw)

    def house(self, u0, v0, du, dv, h, rh=0.03, wall=MARBLE, roof=TERRA, axis='u', ink=0.4, door=True, win=None, z=0.0, chimney=True, **kw):
        """A small house with a door, framed windows, a tiled roof and a chimney.  It rises out of the slab in the build."""
        if self.cur_group is None:
            with self.grp('rise', t0=0.46 + self.rng.uniform(0, 0.3), dur=0.3, pivot=self.P(u0 + du / 2, v0 + dv / 2, z), stage='struct',
                          ink_now=True, under=PAPER):
                self._house(u0, v0, du, dv, h, rh, wall, roof, axis, ink, door, win, z, chimney, **kw)
        else:
            self._house(u0, v0, du, dv, h, rh, wall, roof, axis, ink, door, win, z, chimney, **kw)

    def _house(self, u0, v0, du, dv, h, rh, wall, roof, axis, ink, door, win, z, chimney, **kw):
        self.box(u0, v0, du, dv, h, z, c=wall, ink=ink, guide=False, **kw)
        self.gable(u0, v0, du, dv, rh, z + h, c=roof, axis=axis, wall=wall, ink=ink, over=0.004, **kw)
        v1, u1 = v0 + dv, u0 + du
        big = du * W > 4.5
        # tile courses on the roof slope that faces us
        if big:
            if axis == 'u':
                vm = (v0 + v1) / 2
                self.lines([[(u0, v1 + (vm - v1) * q, z + h + rh * q), (u1, v1 + (vm - v1) * q, z + h + rh * q)] for q in (0.33, 0.66)], 0.2, shade(roof, 0.72), stage='detail', **kw)
            else:
                um = (u0 + u1) / 2
                self.lines([[(u1 + (um - u1) * q, v0, z + h + rh * q), (u1 + (um - u1) * q, v1, z + h + rh * q)] for q in (0.33, 0.66)], 0.2, shade(roof, 0.66), stage='detail', **kw)
        if door:
            self.poly([(u0 + du * 0.40, v1, z), (u0 + du * 0.40, v1, z + h * 0.62), (u0 + du * 0.60, v1, z + h * 0.62),
                       (u0 + du * 0.60, v1, z)], shade(roof, 0.7), 0.24, stage='detail', **kw)
            if big:
                self.poly([(u0 + du * 0.34, v1, z), (u0 + du * 0.66, v1, z), (u0 + du * 0.66, v1 + 0.006, z), (u0 + du * 0.34, v1 + 0.006, z)], STONE, 0.2, stage='detail', **kw)
                for q in (0.16, 0.84):          # windows either side of the door, with a sill
                    self.poly([(u0 + du * (q - 0.09), v1, z + h * 0.34), (u0 + du * (q - 0.09), v1, z + h * 0.72), (u0 + du * (q + 0.09), v1, z + h * 0.72),
                               (u0 + du * (q + 0.09), v1, z + h * 0.34)], (196, 222, 236), 0.2, stage='detail', **kw)
        if win:
            self.rects('R', v0 + dv * 0.1, v0 + dv * 0.9, u1, z + h * 0.35, z + h * 0.9, win, 1, fill=(176, 206, 226), **kw)
            if big:
                self.lines([[(u1, v0 + dv * 0.1, z + h * 0.33), (u1, v0 + dv * 0.9, z + h * 0.33)]], 0.2, shade(wall, 0.7), stage='detail', **kw)
        if chimney and big:
            cu, cv = (u0 + du * 0.72, v0 + dv * 0.5) if axis == 'u' else (u0 + du * 0.5, v0 + dv * 0.28)
            self.box(cu - 0.005, cv - 0.005, 0.01, 0.01, rh * 0.75, z=z + h + rh * 0.55, c=TERRA_D, ink=0.26, guide=False, **kw)

    def rev(self, u, v, prof, z=0.0, c=STONE, ink=0.5, shade_f=0.84, cap=None, guide=None, band=0.42, **kw):
        """Surface of revolution from a profile [(radius, height), ...] bottom to top.
        Drawn as its silhouette plus a shaded right flank and optional flat cap."""
        C = self.P(u, v, z)
        k = SQ2 * W
        left, right, mid = [], [], []
        for r, h in prof:
            y = -h * ZS
            left.append((-r * k, y))
            right.append((r * k, y))
            mid.append((r * k * band, y))
        r0 = prof[0][0]
        a, b = r0 * k, r0 * k * 0.5
        n = max(8, int(a * 0.9))
        th = np.linspace(0, math.pi, n)
        base = [(a * math.cos(t), b * math.sin(t) + left[0][1]) for t in th]      # right -> left along the front
        outline = left + right[::-1] + base[1:-1]
        rt, ht = prof[-1]
        f = self.poly2(C, outline, c, 0, **kw)
        # shaded flank: follows the base ellipse so it reads as a round body
        m = int(n * (1 - band) / 2) + 1
        fl = mid + right[::-1] + base[1:m]
        self.poly2(C, fl, shade(c, shade_f), 0, **kw)
        o = self.poly2(C, outline, None, ink, **kw)
        if rt > 0.002:
            at, bt = rt * k, rt * k * 0.5
            self.ell2(C + np.array([0, -ht * ZS]), at, bt, cap or shade(c, 1.04), ink, **kw)
        if guide or (guide is None and self.cur_group is None and self.stage == 'struct' and r0 * k > 9):
            hh = max(h for _, h in prof)
            self.guide_axis(u, v, hh, z, ticks=max(3, min(7, int(hh * 16))), link=f, r=r0)
        return o

    def cyl(self, u, v, r, h, z=0.0, c=STONE, **kw):
        return self.rev(u, v, [(r, 0), (r, h)], z, c, **kw)

    def cone(self, u, v, r, h, z=0.0, c=STONE, **kw):
        return self.rev(u, v, [(r, 0), (0, h)], z, c, **kw)

    def dome(self, u, v, r, h, z=0.0, c=MARBLE, onion=False, n=9, **kw):
        prof = []
        for k in range(n + 1):
            t = k / n
            if onion:
                rr = r * (1.0 + 0.22 * math.sin(math.pi * min(1, t * 1.9)) ** 1.0) * (math.cos(t * math.pi / 2) ** 0.75) \
                    if t < 0.999 else 0
                if t > 0.8:
                    rr = r * 0.34 * (1 - t) / 0.2 * (1.0)
                    rr = min(rr, prof[-1][0])
            else:
                rr = r * math.cos(t * math.pi / 2) ** 0.9 if t < 0.999 else 0
            prof.append((rr, h * (t if onion else math.sin(t * math.pi / 2))))
        return self.rev(u, v, prof, z, c, **kw)

    def hill(self, u, v, r, h, c=GRASS_D, n=10, **kw):
        """Soft bell-shaped hill (flared foot, rounded crown)."""
        prof = []
        for k in range(n + 1):
            d = 1 - k / n
            prof.append((r * d, h * (0.5 + 0.5 * math.cos(math.pi * d)) ** 0.8))
        prof[-1] = (0.0, h)
        return self.rev(u, v, prof, 0.0, c, **kw)

    @staticmethod
    def hill_z(u, v, cu, cv, r, h):
        d = math.hypot(u - cu, v - cv) / r
        return 0.0 if d >= 1 else h * (0.5 + 0.5 * math.cos(math.pi * d)) ** 0.8

    def mountain(self, peak, base, c=ROCK, cd=ROCK_D, snow=0.0, jag=1.2, sc=SNOW, scd=ICE, ink=0.5,
                 seed=None, ridge_ink=0.4, snow_grp=None, **kw):
        """Faceted peak. base = ground points ordered left -> front -> right."""
        r = random.Random(seed if seed is not None else self.rng.random())
        A = self.P3(peak)
        B = [self.P3(b) for b in base]
        ridges = []
        nseg = 7
        for b in B:
            pts = []
            d = b - A
            L = np.hypot(*d) + 1e-9
            nrm = np.array([-d[1], d[0]]) / L
            for k in range(nseg + 1):
                t = k / nseg
                off = 0 if k in (0, nseg) else r.uniform(-1, 1) * jag * math.sin(t * math.pi) ** 0.6 * (L / 40.0)
                bow = math.sin(t * math.pi) * L * 0.045      # slight concave slope
                pts.append(A + d * t + nrm * off + np.array([0, bow]))
            ridges.append(pts)
        out = []
        nf = len(B) - 1
        mids = []
        for k in range(nf):
            m = (B[k] + B[k + 1]) / 2
            mids.append(m[0])
        for k in range(nf):
            lit = mids[k] < A[0] + 0.5
            col = c if lit else cd
            if nf > 2:
                col = shade(col, 1.0 - 0.05 * abs(k - (nf - 1) / 2) + (0.03 if lit else 0))
            pts = ridges[k] + ridges[k + 1][::-1]
            out.append(self._add([pts], True, col, ink, raw=False, wob=0.15, **kw))
            # the rock itself: bedding that follows the face, a spur down its middle, scree at its foot
            ra, rb = ridges[k], ridges[k + 1]
            hat = []
            for q in range(1, nseg):
                if q < snow * nseg + 0.5:
                    continue
                pa, pb = ra[q], rb[q]
                for (f0, f1) in ((0.08, 0.36), (0.46, 0.66), (0.74, 0.93)):
                    if r.random() < 0.72:
                        g0, g1 = f0 + r.uniform(-0.04, 0.04), f1 + r.uniform(-0.04, 0.04)
                        sag = np.array([0, 0.8 + 1.4 * r.random()])
                        hat.append([pa + (pb - pa) * g0, pa + (pb - pa) * (g0 + g1) / 2 + sag, pa + (pb - pa) * g1])
            mid = [(ra[q] + rb[q]) / 2 + np.array([r.uniform(-1.5, 1.5) * q * 0.4, 0]) for q in range(1, nseg + 1)]
            if len(B) <= 4 and np.hypot(*(B[k] - B[k + 1])) > 16:
                hat.append(mid[int(snow * nseg):])
            if hat:
                self._add(hat, False, None, 0.22, shade(col, 0.74), raw=True, **kw)
            scr = []
            for q in range(7):
                f_ = r.uniform(0.05, 0.95)
                p_ = ra[nseg] + (rb[nseg] - ra[nseg]) * f_ + np.array([r.uniform(-1, 1), r.uniform(-3.5, 0.5)])
                scr.append([p_, p_ + np.array([r.uniform(0.5, 1.4), 0.2])])
            self._add(scr, False, None, 0.55, shade(col, 0.8), raw=True, **kw)
        snows = []
        if snow > 0:
            ks = max(1, int(round(snow * nseg)))
            for k in range(nf):
                lit = mids[k] < A[0] + 0.5
                a = ridges[k][:ks + 1]
                b = ridges[k + 1][:ks + 1]
                pa, pb = a[-1], b[-1]
                teeth = []
                nt = 3 + (k % 2)
                for q in range(1, nt * 2):
                    t = q / (nt * 2)
                    p = pa + (pb - pa) * t
                    dn = (A - p)
                    dn = dn / (np.hypot(*dn) + 1e-9)
                    amt = (r.uniform(2.0, 4.5) if q % 2 else -r.uniform(0.5, 2.0)) * snow * 2.2
                    teeth.append(p - dn * amt)
                pts = a + teeth + b[::-1]
                with (self.grp('wipe', **snow_grp) if snow_grp else _null()):
                    snows.append(self._add([pts], True, sc if lit else scd, ridge_ink, raw=False, wob=0.1, **kw))
                    # crevasses and wind-scour in the snow
                    cv_ = []
                    for q in range(1, ks):
                        if r.random() < 0.8:
                            f0 = r.uniform(0.15, 0.6)
                            cv_.append([a[q] + (b[q] - a[q]) * f0, a[q] + (b[q] - a[q]) * (f0 + r.uniform(0.12, 0.3)) + np.array([0, 0.7])])
                    if cv_:
                        self._add(cv_, False, None, 0.22, (150, 186, 214), raw=True, **kw)
        return out, snows

    # ---- slab / bases
    def slab(self, ground=GRASS, side=EARTH, thick=SLAB, strata=True, walls=True):
        wall_l = wall_r = None if walls else False
        self.thick = thick
        with self.st('slab'):
            sd = shade(side, 0.86)
            if wall_l is None:
                self.wallL = self.poly([(0, 1, 0), (1, 1, 0), (1, 1, -thick), (0, 1, -thick)], side, 0.6, wob=0.2)
            if wall_r is None:
                self.wallR = self.poly([(1, 0, 0), (1, 1, 0), (1, 1, -thick), (1, 0, -thick)], sd, 0.6, wob=0.2)
            if strata:
                if wall_l is None:
                    self.wall_detail('L', 0.0, 1.0, thick, side)
                if wall_r is None:
                    self.wall_detail('R', 0.0, 1.0, thick, sd)
            self.top = self.poly([(0, 0), (1, 0), (1, 1), (0, 1)], ground, 0.6, wob=0.2)
        return self.top

    def wall_detail(self, face, a0, a1, thick, side, top=0.0):
        """What a slab is made of: dark topsoil, earth with stones and roots, a band of bedrock, and now and then a fossil or a burrow."""
        r = self.rng

        def fp(a, z):
            return (a, 1, z) if face == 'L' else (1, a, z)
        n = 14
        zt = top - thick * 0.2
        zr = top - thick * 0.74
        wav1 = [zt + thick * 0.04 * math.sin(k * 1.7 + r.uniform(0, 0.6)) for k in range(n + 1)]
        wav2 = [zr + thick * 0.07 * math.sin(k * 1.1 + 2 + r.uniform(0, 0.8)) for k in range(n + 1)]
        aa = [a0 + (a1 - a0) * k / n for k in range(n + 1)]
        with self.st('detail'):
            self.poly([fp(a0, top)] + [fp(a, z) for a, z in zip(aa, wav1)] + [fp(a1, top)], shade(side, 0.74), 0.0, wave='g')
            self.poly([fp(a0, top - thick)] + [fp(a, z) for a, z in zip(aa, wav2)] + [fp(a1, top - thick)], mix(shade(side, 0.9), ROCK, 0.45), 0.0, wave='g')
            self.line([fp(a, z) for a, z in zip(aa, wav1)], 0.28, shade(side, 0.6), wave='g')
            self.line([fp(a, z) for a, z in zip(aa, wav2)], 0.28, shade(side, 0.62), wave='g')
            segs = []
            for k in range(int(9 * (a1 - a0)) + 1):            # bedding cracks in the rock
                a = r.uniform(a0 + 0.03, a1 - 0.08)
                zz = top - thick * r.uniform(0.82, 0.95)
                segs.append([fp(a, zz), fp(a + r.uniform(0.03, 0.07), zz + thick * r.uniform(-0.03, 0.03))])
            self.lines(segs, 0.24, shade(side, 0.6), wave='g')
            for k in range(int(7 * (a1 - a0)) + 1):            # stones
                a = r.uniform(a0 + 0.03, a1 - 0.03)
                zz = top - thick * r.uniform(0.3, 0.68)
                ra, rz = r.uniform(0.007, 0.016), thick * r.uniform(0.05, 0.09)
                self.poly([fp(a + ra * math.cos(q), zz + rz * math.sin(q)) for q in np.linspace(0, 2 * math.pi, 9)[:-1]], mix(STONE_D, side, 0.3), 0.22, wave='g', wob=0.12)
            segs = []
            for k in range(int(8 * (a1 - a0)) + 1):            # roots feeling their way down
                a = r.uniform(a0 + 0.02, a1 - 0.02)
                L = thick * r.uniform(0.25, 0.6)
                pts = [fp(a + 0.006 * math.sin(q * 2.6 + k), top - L * q / 4.0) for q in range(5)]
                segs.append(pts)
                if r.random() < 0.5:
                    segs.append([pts[2], fp(a + r.choice([-1, 1]) * 0.014, top - L * 0.75)])
            self.lines(segs, 0.26, shade(side, 0.5), wave='g')
            what = r.random()
            a = r.uniform(a0 + 0.12, a1 - 0.12)
            zz = top - thick * 0.5
            if what < 0.4:                                    # an ammonite
                sp = [fp(a + 0.0026 * q * math.cos(q * 1.5) / 2.2, zz + thick * 0.016 * q * math.sin(q * 1.5) / 2.2) for q in np.linspace(0.6, 9.5, 22)]
                self.line(sp, 0.3, MARBLE, wave='g', wob=0)
            elif what < 0.6:                                  # a bone
                self.lines([[fp(a - 0.016, zz), fp(a + 0.016, zz + thick * 0.04)]], 0.7, MARBLE, wave='g')
            elif what < 0.8:                                  # a burrow, somebody home
                self.poly([fp(a + 0.012 * math.cos(q), zz + thick * 0.07 * math.sin(q)) for q in np.linspace(0, 2 * math.pi, 9)[:-1]], shade(side, 0.42), 0.22, wave='g', wob=0.1)

    def underside(self, faces, thick=None, depth=30.0, chunks=3):
        """The slab floats: a rough keel of rock hangs beneath its outer faces, with roots dangling and loose chunks adrift below."""
        thick = self.thick if thick is None else thick
        r = random.Random(hash(self.name) % 977 + 5)
        both = len(faces) == 2
        UR = (150, 136, 126)
        n = 16
        deepest = None
        with self.at('start'), self.st('slab'):
            for face in faces:
                top, hang = [], []
                for k in range(n + 1):
                    a = k / n
                    p = self.P3((a, 1, -thick) if face == 'L' else (1, a, -thick))
                    env = (0.16 + 0.84 * a ** 0.75) if both else (math.sin(math.pi * min(1.0, a * 1.02)) ** 0.6)
                    d = depth * env * (1.0 if (both and k == n) else r.uniform(0.62, 1.05) * (1.0 if k % 2 else 0.74))
                    if not both and k in (0, n):
                        d = 0.0
                    top.append(p)
                    q = p + np.array([r.uniform(-1.2, 1.2) if 0 < k < n else 0.0, d])
                    hang.append(q)
                    if deepest is None or q[1] > deepest[1]:
                        deepest = q
                col = UR if face == 'L' else shade(UR, 0.84)
                self.keel.append(self._add([top + hang[::-1]], True, col, 0.5, wob=0.25))
                segs = []
                for k in range(2, n - 1, 2):
                    m = (top[k] + hang[k]) / 2
                    segs.append([top[k] + np.array([0, 1.5]), m + np.array([r.uniform(-1.5, 1.5), 0])])
                    if r.random() < 0.6:
                        segs.append([m + np.array([1.5, 1.0]), hang[k] + np.array([0.5, -2.0])])
                self.keel.append(self._add(segs, False, None, 0.26, shade(UR, 0.62), stage='detail', wave='g'))
                roots = []
                for k in range(1, n, 3):
                    L = r.uniform(4, 9)
                    b0 = hang[k]
                    roots.append([b0, b0 + np.array([r.uniform(-1, 1), L * 0.5]), b0 + np.array([r.uniform(-2, 2), L])])
                self.keel.append(self._add(roots, False, None, 0.26, (120, 92, 66), stage='detail', wave='g'))
        # loose chunks drift beneath, bobbing out of step
        if deepest is not None:
            for k in range(chunks):
                c = deepest + np.array([r.choice([-1, 1]) * r.uniform(12, 34), -r.uniform(0, 12) - 3 * k])
                sz = r.uniform(1.6, 3.6)
                per = r.uniform(4.5, 8.0)
                ph = r.uniform(0, 6.28)

                def mo(t, age, ph_, per=per, ph=ph):
                    return (0.0, 1.6 * math.sin(2 * math.pi * t / per + ph), 4.0 * math.sin(2 * math.pi * t / (per * 1.7) + ph), 1.0, 1.0)
                with self.at('start'), self.grp('drift', dur=0.5, pivot=c, off=(0, 14), motion=mo, stage='flora') as kg:
                    self.keel_groups.append(kg)
                    pts = [(sz * r.uniform(0.7, 1.2) * math.cos(q), sz * r.uniform(0.6, 1.0) * math.sin(q) * 0.8) for q in np.linspace(0, 2 * math.pi, 7)[:-1]]
                    self.poly2(c, pts, shade(UR, r.uniform(0.86, 1.05)), 0.36, wob=0)
                    self.poly2(c, [(-sz * 0.8, -sz * 0.35), (sz * 0.7, -sz * 0.4), (sz * 0.3, -sz * 0.75), (-sz * 0.4, -sz * 0.7)], GRASS_D, 0.26, wob=0)

    def wall_water(self, face, a, b, c=WATER_D, depth=0.8, fall=True):
        """Where a river meets the slab edge: a blue notch in the wall and a thread of falling water."""
        zb = -SLAB * depth
        with self.st('detail'):
            if face == 'L':
                self.poly([(a, 1, 0), (b, 1, 0), (b, 1, zb), (a, 1, zb)], c, 0.4, wave='g')
                segs = [[(a + (b - a) * k / 4.0, 1, -0.012), (a + (b - a) * k / 4.0, 1, zb + 0.012)] for k in (1, 2, 3)]
            else:
                self.poly([(1, a, 0), (1, b, 0), (1, b, zb), (1, a, zb)], shade(c, 0.9), 0.4, wave='g')
                segs = [[(1, a + (b - a) * k / 4.0, -0.012), (1, a + (b - a) * k / 4.0, zb + 0.012)] for k in (1, 2, 3)]
            if fall:
                self.lines(segs, 0.35, FOAM, stage='mark', wave='g')

    def blob(self, cu, cv, ru, rv, fill, ink=0.45, inkc=None, n=11, irr=0.22, seed=None, z=0.0, **kw):
        r = random.Random(seed if seed is not None else self.rng.random())
        pts = []
        for k in range(n):
            a = 2 * math.pi * k / n
            rr = 1 + r.uniform(-irr, irr)
            pts.append(np.array([cu + ru * rr * math.cos(a), cv + rv * rr * math.sin(a)]))
        pts = smooth_poly(pts, 3)
        self._last_blob = [(p[0], p[1]) for p in pts]
        return self.poly([(p[0], p[1], z) for p in pts], fill, ink, inkc if inkc is not None else INK, **kw)

    def custom(self, fn, bbox_pts, sky=False, stage=None):
        """A shape drawn by a callback fn(canvas, tau, t, alpha, renderer) each frame."""
        sh = self._add([[np.asarray(p, float) for p in bbox_pts]], False, None, 0, raw=True, stage=stage, sky=sky, instant=True)
        sh.draw = fn
        return sh

    # ---- scattering helpers
    def scatter(self, region, n, margin=0.0, seed=None, mind=0.0):
        """n random (u, v) points inside a uv polygon."""
        r = random.Random(seed if seed is not None else self.rng.random())
        us = [p[0] for p in region]
        vs = [p[1] for p in region]
        out = []
        tries = 0
        while len(out) < n and tries < n * 60:
            tries += 1
            u = r.uniform(min(us), max(us))
            v = r.uniform(min(vs), max(vs))
            if not pip(region, u, v):
                continue
            if mind and any((u - a) ** 2 + (v - b) ** 2 < mind * mind for a, b in out):
                continue
            out.append((u, v))
        return out

    def tufts(self, region, n, c=GRASS_D, seed=None, w=0.32, z=0.0, size=1.0):
        """tiny grass ticks - the reference's hatch texture"""
        segs = []
        r = self.rng
        for (u, v) in self.scatter(region, n, seed=seed):
            p = self.P(u, v, z)
            h = r.uniform(1.0, 1.9) * size
            lean = r.uniform(-0.6, 0.6)
            segs.append([p, p + np.array([lean, -h])])
            if r.random() < 0.6:
                segs.append([p + np.array([0.7, 0]), p + np.array([0.9 + lean, -h * 0.7])])
        if segs:
            return self._add(segs, False, None, w, c, stage='mark', raw=True)

    def speckle(self, region, n, c=SAND_D, seed=None, w=0.4, z=0.0):
        segs = []
        r = self.rng
        for (u, v) in self.scatter(region, n, seed=seed):
            p = self.P(u, v, z)
            l = r.uniform(0.3, 1.1)
            segs.append([p, p + np.array([l, l * 0.1])])
        if segs:
            return self._add(segs, False, None, w, c, stage='mark', raw=True)

    # ---- finishing: assign every default timing
    def finalize(self, world_center=(0.0, 50.0)):
        c = self.center
        d = c - np.asarray(world_center, float)
        L = np.hypot(*d)
        self.sweep = d / L if L > 1 else np.array([0.3, 0.95]) / np.hypot(0.3, 0.95)
        origin = c - self.sweep * 85.0
        r = random.Random(hash(self.name) % 9973)
        self.waves.setdefault('g', Wave(origin, 0.20, 0.44, 330.0, seed=r.random()))
        self.waves.setdefault('s', Wave(origin + np.array([0, -8.0]), 0.80, 0.40, 360.0, seed=r.random()))

        def rank(x, y):
            v = ((x - c[0]) * self.sweep[0] + (y - c[1]) * self.sweep[1]) / 110.0
            return min(1.0, max(0.0, 0.5 + 0.5 * v))

        for g in self.groups:
            if g.t0 is None and g.kind is not None:
                rk = rank(g.pivot[0], g.pivot[1])
                a, b = {'flora': FLORA_WIN, 'life': LIFE_WIN, 'sky': SKY_WIN}.get(g.stage, LIFE_WIN)
                g.t0 = a + (b - a) * rk * 0.8 + r.uniform(0, (b - a) * 0.2)
        for sh in self.shapes:
            if sh.layer == 'pencil':
                continue
            if sh.wave is None:
                sh.wave = self.waves['g'] if sh.stage in ('slab', 'ground') else self.waves['s']
            elif isinstance(sh.wave, str):
                sh.wave = self.waves[sh.wave]
            pts = np.vstack(sh.subs)
            dd = sh.wave.dist(pts)
            sh.wd0 = float(dd.min())
            sh.wd1 = float(dd.max())
            sh.tw1 = sh.wave.time_at(sh.wd1)
            if sh.instant:
                sh.tk = -1e9
                sh.dk = 0.01
                sh.tw1 = -1e9
                sh.wd1 = -1.0
                continue
            if sh.dk is None:
                sh.dk = min(0.30, max(0.07, sh.length / 300.0))
            if sh.tk is None:
                if sh.stage == 'mark':
                    sh.tk = sh.wave.time_at(float(dd.mean())) + 0.04 + r.uniform(0, 0.05)
                    sh.dk = 0.10
                else:
                    a, b = INK_WIN.get(sh.stage, INK_WIN['struct'])
                    sh.tk = a + max(0.0, (b - a - sh.dk)) * rank(sh.cx, sh.cy) + r.uniform(0, 0.03)
        for sh in self.shapes:
            if sh.layer != 'pencil':
                continue
            if sh.tp is None:
                if sh.link is not None and sh.link.tk is not None and sh.link.tk > -1e8:
                    sh.tp = max(0.02, sh.link.tk - 0.30)
                else:
                    sh.tp = 0.03 + 0.3 * rank(sh.cx, sh.cy)
            if sh.te is None:
                if sh.link is not None and sh.link.tk is not None and sh.link.tk > -1e8:
                    sh.te = max(sh.link.tk + sh.link.dk + 0.12, sh.tp + 0.42)
                else:
                    sh.te = sh.tp + 0.6
            sh.dp = min(0.24, max(0.10, sh.length / 420.0))
        for g in self.groups:
            xs = [s for s in self.shapes if s.group is g]
            if xs:
                g.bbox = (min(s.bbox[0] for s in xs), min(s.bbox[1] for s in xs),
                          max(s.bbox[2] for s in xs), max(s.bbox[3] for s in xs))
        return self


@contextmanager
def _null():
    yield None
