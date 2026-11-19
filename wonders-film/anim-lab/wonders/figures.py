"""Figures that live: they walk paths with stepping legs, pause, turn round,
look about and wave.  Each figure is one custom-drawn shape (pre-built paths,
moved by the canvas), so a thousand of them stay cheap."""
import bisect
import math

import numpy as np
import skia

from . import ease
from .core import W, argb
from .pal import *  # noqa

TAU = 2 * math.pi
DENSITY = 2.3           # crowd() multiplies its head-count by this
# calmer crowds: a share of each crowd() stays home, walkers amble a little slower and pause more often.
# All three leave the random sequence untouched, so every other placement in the world stays where it was.
CALM_SKIP = 0.15        # fraction of crowd() figures not drawn
CALM_SPEED = 0.84       # default walking speed multiplier
CALM_PAUSE = 0.14       # added to every pause probability


def _poly(pts, closed=True):
    p = skia.Path()
    p.addPoly([skia.Point(float(x), float(y)) for x, y in pts], closed)
    return p


class Track:
    """Where a figure is at time t: a looped schedule of walks and pauses."""

    def __init__(self, pts, speed, rng, loop=False, pause=0.5, offset=None):
        pts = [np.asarray(p, float) for p in pts]
        order = list(range(len(pts))) + ([] if loop else list(range(len(pts) - 2, 0, -1)))
        seq = [pts[k] for k in order]
        n = len(seq)
        self.moves = []
        t = 0.0
        dist = 0.0
        facing = 1.0
        self.starts = []
        for k in range(n):
            a, b = seq[k], seq[(k + 1) % n]
            d = b - a
            L = float(np.hypot(*d))
            if L < 1e-6:
                continue
            f_prev = facing
            if abs(d[0]) > 0.12 * L:
                facing = 1.0 if d[0] > 0 else -1.0
            dur = L / speed
            self.starts.append(t)
            self.moves.append(('w', t, dur, a, d, dist, f_prev, facing, L))
            t += dur
            dist += L
            end_of_line = (not loop) and (order[(k + 1) % n] in (0, len(pts) - 1))
            pz = rng.uniform(0.9, 3.2) if (end_of_line or rng.random() < pause) else 0.0
            if pz > 0:
                self.starts.append(t)
                self.moves.append(('p', t, pz, b, None, dist, facing, facing, 0.0))
                t += pz
        self.total = max(t, 1e-3)
        self.off = rng.uniform(0, self.total) if offset is None else offset
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        self.bbox = (min(xs), min(ys), max(xs), max(ys))

    def at(self, t):
        tt = (t + self.off) % self.total
        k = bisect.bisect_right(self.starts, tt) - 1
        kind, t0, dur, a, d, dist, f0, f1, L = self.moves[k]
        if kind == 'p':
            return a, f1, dist, False, tt - t0
        x = (tt - t0) / dur
        turn = f1
        if f0 != f1 and (tt - t0) < 0.24:
            turn = f0 + (f1 - f0) * ease.smooth((tt - t0) / 0.24)
        return a + d * x, turn, dist + L * x, True, 0.0


class Fig:
    __slots__ = ('P', 's', 'c', 'body', 'head', 'hair', 'hat', 'bag', 'track', 'sync', 't0', 'ph', 'arms', 'bbox', 'kind')

    def __init__(self, P, s, shirt, skin, hair, hat, pants, arms, t0, ph, track=None, sync=None, bag=None, kind='pop'):
        self.P = np.asarray(P, float)
        self.s = s
        self.c = [vivid(pants), vivid(shirt), vivid(skin), vivid(hair), vivid(hat) if hat is not None else None,
                  vivid(bag) if bag is not None else None, vivid(shade(shirt, 0.82))]
        self.body = _poly([(-1.05 * s, -1.8 * s), (1.05 * s, -1.8 * s), (0.95 * s, -4.4 * s), (-0.95 * s, -4.4 * s)])
        self.head = skia.Path()
        self.head.addCircle(0.0, -5.5 * s, 1.18 * s)
        th = np.linspace(math.pi * 1.0, math.pi * 1.92, 9)
        self.hair = _poly([(-0.28 * s + 1.26 * s * math.cos(a), -5.62 * s + 1.12 * s * math.sin(a)) for a in th])
        self.hat = None
        if hat is not None:
            self.hat = _poly([(-1.9 * s, -6.0 * s), (1.9 * s, -6.0 * s), (0.9 * s, -6.5 * s), (0.6 * s, -7.4 * s), (-0.6 * s, -7.4 * s), (-0.9 * s, -6.5 * s)])
        self.bag = _poly([(-1.75 * s, -4.1 * s), (-0.95 * s, -4.1 * s), (-0.95 * s, -2.5 * s), (-1.75 * s, -2.5 * s)]) if bag is not None else None
        self.track = track
        self.sync = sync
        self.t0 = t0
        self.ph = ph
        self.arms = arms
        self.kind = kind

    def draw(self, c, tau, t, a, R):
        x = (tau - self.t0) / 0.22
        if x <= 0:
            return
        sx = sy = 1.0
        if x < 2.2:
            e = ease.spring(x * 0.55, 1.25, 4.6)
            sy = e
            sx = e ** 0.6 if e < 1 else 1 - 0.55 * (e - 1)
        s = self.s
        ph = self.ph
        step = 0.0
        moving = False
        face = 1.0
        if self.track is not None:
            pos, face, dist, moving, idle_t = self.track.at(t)
            step = dist * 2.3
        elif self.sync is not None:
            w = self.sync
            cyc = TAU * t / w.period + ph
            sp = 0.5 - 0.5 * math.cos(cyc)
            pos = self.P + w.d * sp
            vel = math.sin(cyc)
            moving = abs(vel) > 0.12
            dirx = w.d[0] if abs(w.d[0]) > 1e-6 else 1.0
            face = max(-1.0, min(1.0, vel * 7.0)) * (1.0 if dirx > 0 else -1.0)
            step = float(np.hypot(*w.d)) * sp * 2.3
        else:
            pos = self.P
            face = max(-1.0, min(1.0, math.sin(t * 0.41 + ph * 3.1) * 7.0))      # now and then, look the other way
        if abs(face) < 0.08:
            face = 0.08 if face >= 0 else -0.08
        bob = -0.34 * s * abs(math.sin(step)) if moving else 0.10 * s * math.sin(t * 1.9 + ph)
        c.save()
        c.translate(float(pos[0]), float(pos[1]))
        c.scale(sx * face, sy)
        col = self.c
        ps = R.ps
        # legs
        ps.setColor(argb(col[0], a))
        ps.setStrokeWidth(0.62 * s * R.INK_SCALE)
        if moving:
            f1 = 0.85 * s * math.sin(step)
            l1 = -0.5 * s * max(0.0, math.cos(step))
            l2 = -0.5 * s * max(0.0, -math.cos(step))
            c.drawLine(-0.3 * s, -2.0 * s + bob, -0.3 * s + f1, l1, ps)
            c.drawLine(0.3 * s, -2.0 * s + bob, 0.3 * s - f1, l2, ps)
        else:
            c.drawLine(-0.5 * s, -2.0 * s, -0.55 * s, 0.0, ps)
            c.drawLine(0.5 * s, -2.0 * s, 0.55 * s, 0.0, ps)
        c.translate(0.0, bob)
        if self.bag is not None:
            R.fill(c, self.bag, col[5], a)
            R.stroke(c, self.bag, INK, 0.26, a)
        R.fill(c, self.body, col[1], a)
        R.stroke(c, self.body, INK, 0.3, a)
        # arm(s)
        ps.setStrokeWidth(0.5 * s * R.INK_SCALE)
        if self.arms:
            wv = 0.5 * math.sin(t * 5.0 + ph)
            ps.setColor(argb(col[2], a))
            c.drawLine(-0.9 * s, -3.9 * s, (-2.1 - wv) * s, -5.7 * s, ps)
            c.drawLine(0.9 * s, -3.9 * s, (2.1 + wv) * s, -5.7 * s, ps)
        else:
            sw = 1.0 * s * math.sin(step + math.pi) if moving else 0.12 * s * math.sin(t * 1.3 + ph)
            ps.setColor(argb(col[6], a))
            c.drawLine(0.15 * s, -4.0 * s, 0.15 * s + sw, -2.5 * s, ps)
        R.fill(c, self.head, col[2], a)
        R.stroke(c, self.head, INK, 0.3, a)
        if self.hat is not None:
            R.fill(c, self.hat, col[4], a)
            R.stroke(c, self.hat, INK, 0.28, a)
        else:
            R.fill(c, self.hair, col[3], a)
        c.restore()


def person(T, u, v, z=0.0, shirt=None, skin=None, hair=None, hat=None, walk=None, s=1.0, pants=DARK,
           arms=False, t0=None, kind='pop', at=None, ph=None, path=None, speed=None, loop=False, bag=None, pause=0.5):
    """A figure.  path = [(u, v[, z]), ...] makes it walk that route (there and back, or looped)."""
    r = T.rng
    shirt = shirt or r.choice(CLOTH)
    skin = skin or r.choice(SKIN)
    hair = hair or r.choice(HAIR)
    if bag is None and hat is None and r.random() < 0.22:
        bag = r.choice([ACCENT, TERRA, ZINC, DARK, MARBLE])
    P = T.P(u, v, z) if at is None else np.asarray(at, float)
    ph = r.uniform(0, 6.283) if ph is None else ph
    if t0 is None:
        t0 = 1.10 + r.uniform(0.0, 0.3)
    track = None
    sync = None
    bb = [P + np.array([-3.0, -9.0]), P + np.array([3.0, 1.0])]
    if path is not None:
        pts = [T.P(p[0], p[1], p[2] if len(p) > 2 else z) for p in path]
        track = Track(pts, speed if speed else r.uniform(2.6, 4.2) * CALM_SPEED, r, loop=loop,
                      pause=min(0.9, pause + CALM_PAUSE))
        bb = [np.array([track.bbox[0] - 3, track.bbox[1] - 9]), np.array([track.bbox[2] + 3, track.bbox[3] + 1])]
    elif walk is not None:
        sync = walk
        bb += [P + walk.d + np.array([-3.0, -9.0]), P + walk.d + np.array([3.0, 1.0])]
    f = Fig(P, s, shirt, skin, hair, hat, pants, arms, t0, ph, track, sync, bag, kind)
    sh = T.custom(f.draw, bb, stage='life')
    T._last_fig = sh
    return P


def crowd(T, region, n, seed=None, walk_frac=0.62, z=0.0, hat=None, mind=0.03, dense=None):
    """People spread over a region: most wander between a few spots, the rest stand, look about and wave."""
    n = max(1, int(round(n * (DENSITY if dense is None else dense))))
    pts = T.scatter(region, n, seed=seed, mind=mind * 0.62)
    pts.sort(key=lambda p: p[0] + p[1])
    r = T.rng
    for (u, v) in pts:
        path = None
        if r.random() < walk_frac:
            path = [(u, v)]
            for _ in range(r.choice([1, 2, 2, 3])):
                for _try in range(8):
                    a = r.uniform(0, TAU)
                    d = r.uniform(0.04, 0.13)
                    q = (path[-1][0] + d * math.cos(a), path[-1][1] + d * math.sin(a))
                    if _inside(region, q):
                        path.append(q)
                        break
            if len(path) < 2:
                path = None
        person(T, u, v, z, path=path, loop=(path is not None and len(path) > 2 and r.random() < 0.5),
               hat=(hat if (hat and r.random() < 0.5) else None), arms=(path is None and r.random() < 0.12))
        # deterministic, position-based thinning (no draw from T.rng)
        hsh = (math.sin(u * 127.1 + v * 311.7) * 43758.5453) % 1.0
        if hsh < CALM_SKIP:
            T._last_fig.draw = _hidden



def _hidden(*a):
    return None


def _inside(poly, q):
    from .core import pip
    return pip(poly, q[0], q[1])


def stroll(T, pts, n, z=0.0, spread=0.012, speed=None, hat=None, s=1.0):
    """n walkers going up and down a route (a quay, a wall-walk, a bridge)."""
    r = T.rng
    for k in range(n):
        off = r.uniform(-spread, spread)
        path = []
        for i, p in enumerate(pts):
            a = pts[max(0, i - 1)]
            b = pts[min(len(pts) - 1, i + 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) + 1e-9
            zz = p[2] if len(p) > 2 else z
            path.append((p[0] - dy / L * off, p[1] + dx / L * off, zz))
        # start somewhere along the route, heading either way
        i0 = r.randrange(0, len(path) - 1)
        f = r.random()
        start = tuple(path[i0][q] + (path[i0 + 1][q] - path[i0][q]) * f for q in range(3))
        route = path if r.random() < 0.5 else path[::-1]
        person(T, start[0], start[1], start[2], path=route, speed=speed, s=s,
               hat=(hat if (hat and r.random() < 0.5) else None), pause=0.25)
