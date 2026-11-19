"""Feel 7 - TIMELAPSE GARDEN.  The world grows, like a garden filmed over a season.

Build: growth spreads out from the Pyramids slab by slab.  Roots come first - each slab's rock keel grows
down, roots and all - then the ground creeps across the slab as moss or lichen does, a cluster of growing
patches with a darker living edge.  Then the buildings sprout: thin shoots that swell as they rise, swaying
toward the light and straightening; trees unfurl from a curl.  Life runs on a timelapse clock - people,
boats and clouds stream about at six times speed while the light flickers through days - and the clock
slows to real time as we arrive in the close-up.  Life: the balloon breathes as it is heated, then drifts
up like a seed.  Transition: a slow spiral push, the shape of a growing shell.
"""
import math
import random

import numpy as np
import skia

from .. import ease
from ..core import ZS
from ..pal import GRASS_D, mix
from . import base as B

MOSS = (92, 128, 58)
SPEED = 6.0           # the timelapse
F_RAMP0, F_RAMP1 = 120, 208
SPIRAL = 40           # frames of spiral push


def growth(x):
    """sigmoid growth 0->1 over x in [0, 1]"""
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (6 * x - 15) + 10)


class Growth(B.Prebuilt):
    name = 'growth'
    title = 'Timelapse garden'
    pitch = 'the world grows like a garden in timelapse: roots, moss, sprouting stone; the clock slows as we land'
    transition_frames = SPIRAL

    def plan(self):
        r = random.Random(12)
        self.balloon = B.find_balloon(self.w)
        tiles = self.w.tiles
        for name, tile in tiles.items():
            if name == 'pyramids':
                tile.t_in = -99.0
                continue
            d = B.tile_dist(tile)
            if tile.kind == 'sky':
                tile.t_in = 3.6 + 0.5 * ['sky_lo', 'sky_mid', 'sky_hi'].index(name)
            else:
                tile.t_in = 0.3 + 0.0086 * max(0.0, d - 120.0) + r.uniform(-0.08, 0.08)
            # lichen seeds: along the edge facing the Pyramids, then a few inside
            c = np.asarray(tile.center)
            v = np.array([0.0, 50.0]) - c
            L = np.hypot(*v) + 1e-6
            v = v / L
            seeds = []
            if tile.kind == 'tile':
                for k in range(4):
                    side = (k - 1.5) / 1.5
                    p = c + v * 55.0 + np.array([-v[1], v[0]]) * side * 70.0 * np.array([1.0, 0.5])
                    seeds.append((p, 0.08 * k * r.uniform(0.5, 1.2), r.uniform(150, 175), r.uniform(0, 6)))
                for k in range(3):
                    p = c + np.array([r.uniform(-60, 60), r.uniform(-25, 25)])
                    seeds.append((p, 0.35 + 0.2 * k + r.uniform(0, 0.1), r.uniform(75, 100), r.uniform(0, 6)))
            else:
                seeds.append((c + v * 10.0, 0.0, 120.0, r.uniform(0, 6)))
                seeds.append((c - v * 10.0, 0.25, 80.0, r.uniform(0, 6)))
            tile.seeds = seeds
            tile.grow_dur = 1.25 if tile.kind == 'tile' else 0.9
            near = c + v * 80.0
            for g in tile.pieces:
                fx = g.fx
                bx, by = fx['base']
                rk = min(1.0, math.hypot(bx - near[0], (by - near[1]) * 1.7) / 220.0)
                if g.role == 'keel':
                    fx['t0'] = tile.t_in + 0.55
                    fx['kind'] = 'roots'
                elif g.role == 'board':
                    fx['t0'] = tile.t_in
                    fx['kind'] = 'moss'
                elif g.role == 'struct':
                    fx['t0'] = tile.t_in + 0.55 + 0.75 * rk + r.uniform(0, 0.1)
                    fx['kind'] = 'sprout'
                    fx['dur'] = 0.9 + min(0.9, fx['h'] / 90.0)
                elif g.role == 'tree':
                    fx['t0'] = tile.t_in + 0.6 + 0.8 * rk + r.uniform(0, 0.15)
                    fx['kind'] = 'unfurl'
                    fx['sg'] = r.choice([-1.0, 1.0])
                else:
                    fx['t0'] = tile.t_in + 1.0 + 0.7 * rk + r.uniform(0, 0.3)
                    fx['kind'] = 'appear'
                fx['ph'] = r.uniform(0, 6.28)
        # the timelapse clock: integrate the speed backwards from real time at F_RAMP1
        self._f = np.arange(0, B.END + 2, 0.25)
        sp = np.array([self._speed(f) for f in self._f])
        cum = np.concatenate([[0.0], np.cumsum((sp[1:] + sp[:-1]) / 2 * 0.25)])
        i1 = int(F_RAMP1 / 0.25)
        self._tl = (F_RAMP1 + (cum - cum[i1])) / B.FPS

    def _speed(self, f):
        k = ease.smooth((f - F_RAMP0) / (F_RAMP1 - F_RAMP0))
        return SPEED + (1.0 - SPEED) * k

    def clocks(self, f):
        return f / B.FPS, float(np.interp(f, self._f, self._tl))

    def ready(self, name):
        t = self.w.tiles.get(name)
        if t is None:
            return None
        tb = max(0.0, t.t_in + 1.2)
        return float(np.interp(tb * B.FPS, self._f, self._tl))       # links are timed on the life clock

    def _on(self, a, b, dt):
        ra, rb = self.ready(a), self.ready(b)
        if ra is None or rb is None:
            return None
        return max(ra, rb)

    # ---- moss
    def _blobs(self, tile, t, shrink=0.0):
        p = skia.Path()
        any_ = False
        for (c, d, rm, ph) in tile.seeds:
            x = (t - tile.t_in - d) / tile.grow_dur
            if x <= 0:
                continue
            rr = rm * (1 - (1 - min(1.0, x)) ** 2.2) - shrink
            if rr <= 0.5:
                continue
            any_ = True
            th = np.linspace(0, 2 * math.pi, 40, endpoint=False)
            rad = rr * (1 + 0.13 * np.sin(3 * th + ph) + 0.08 * np.sin(7 * th + 2 * ph) + 0.05 * np.sin(13 * th + ph + t * 0.7))
            p.addPoly([skia.Point(float(c[0] + a * math.cos(q)), float(c[1] + a * math.sin(q) / 1.75)) for a, q in zip(rad, th)], True)
        return p if any_ else None

    def arrive(self, g, tile, x, t, tl):
        fx = g.fx
        if g is self.balloon:
            return self._balloon(g, tl)
        kind = fx.get('kind')
        if tile.name == 'pyramids' or kind is None:
            return 'done'
        if x <= 0:
            return None
        b = g.bbox
        bx, by = fx['base']
        if kind == 'roots':
            k = ease.out_cubic(x / 0.9)
            if k >= 1:
                return 'done'
            clip = skia.Path()
            clip.addRect(skia.Rect.MakeLTRB(b[0] - 30, b[1] - 30, b[2] + 30, b[1] + (b[3] - b[1] + 12) * k))
            return (0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, clip, 1.0)
        if kind == 'moss':
            if x > tile.grow_dur + 0.7 + 0.5:
                return 'done'
            clip = self._blobs(tile, t)
            if clip is None:
                return None
            inner = self._blobs(tile, t, 3.2)
            rim = skia.Op(clip, inner, skia.PathOp.kDifference_PathOp) if inner is not None else clip
            fresh = 1.0 - B.clamp((x - tile.grow_dur) / 0.8)
            tints = [(rim, MOSS, 0.7 * fresh)] if rim is not None and fresh > 0.01 else []
            band = (skia.Rect.MakeLTRB(b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4), tints)
            return (0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, clip, 1.0, band)
        if kind == 'sprout':
            k = x / fx['dur']
            if k > 1.6:
                return 'done'
            sy = growth(k)
            sx = 0.42 + 0.58 * growth(k * 1.25 - 0.1)
            rot = 7.0 * math.sin(2 * math.pi * 0.7 * x + fx['ph']) * (1 - min(1.0, k)) ** 1.5
            if sy < 0.01:
                return None
            return (bx, by, 0.0, 0.0, rot, sx, sy, 0.0, None, 1.0)
        if kind == 'unfurl':
            k = x / 0.9
            if k > 1.6:
                return 'done'
            s = growth(k)
            rot = fx['sg'] * 32.0 * (1 - ease.out_cubic(min(1.0, k))) + 3.0 * B.damped(x - 0.9, 1.2, 3.0)
            if s < 0.01:
                return None
            return (bx, by, 0.0, 0.0, rot, s ** 0.8, s, 0.0, None, 1.0)
        k = x / 0.18
        if k >= 1:
            return 'done'
        return (bx, by, 0.0, 0.0, 0.0, k, k, 0.0, None, 1.0)

    def _balloon(self, g, tl):
        ev = B.EVF / B.FPS
        x = tl - (ev - 2.6)
        if x <= 0 or x > 5.0:
            return 'done'
        px, py = g.pivot
        heat = math.sin(math.pi * min(1.0, x / 1.6)) if x < 1.6 else 0.0
        br = 0.045 * heat * math.sin(2 * math.pi * 1.25 * x)
        drift = math.sin(math.pi * min(1.0, max(0.0, x - 1.3) / 3.4))
        rot = 4.5 * drift * math.sin(2 * math.pi * 0.42 * (x - 1.3))
        return (px, py + 9.0, 1.5 * drift * math.sin(2 * math.pi * 0.3 * x), 0.0, rot, 1 + br, 1 + br * 0.8, 0.0, None, 1.0)

    # ---- timelapse light
    def pre_paper(self, img, t, cam, R):
        f = t * B.FPS
        k = (self._speed(f) - 1.0) / (SPEED - 1.0)
        if k <= 0.01:
            return img
        _, tl = self.clocks(f)
        day = math.sin(2 * math.pi * tl / 6.0)
        a = 0.022 * k
        warm = np.array([1.0 + a * 0.7 * day, 1.0 + a * 0.45 * day, 1.0 + a * 1.0 * day], np.float32)
        return np.clip(img.astype(np.float32) * warm[None, None, :], 0, 255).astype(np.uint8)

    # ---- camera: an unhurried pull-back with a breath of sway; a spiral push in
    def cam(self, f):
        C = B.close_cam(max(f, B.CUT))
        if f >= B.CUT:
            return B.close_cam(f)
        t = f / B.FPS
        Wd = B.build_cam(t, 6.0, 2.6)
        sway = math.sin(t * 0.8) * 2.0
        Wd = (Wd[0] + sway, Wd[1] + 0.6 * math.sin(t * 0.55), Wd[2])
        n0 = B.CUT - SPIRAL
        if f > n0:
            t0 = n0 / B.FPS
            W0 = B.build_cam(t0, 6.0, 2.6)
            W0 = (W0[0] + math.sin(t0 * 0.8) * 2.0, W0[1] + 0.6 * math.sin(t0 * 0.55), W0[2])
            u = (f - n0) / SPIRAL
            e = ease.in_out(u, 2.4)
            # a shell spiral: the offset from the target turns and shrinks; it swings out a little on the way
            th = math.radians(115.0) * e
            dx, dy = (W0[0] - C[0]), (W0[1] - C[1]) * 2.0
            k = (1 - e) * (1 + 1.6 * math.sin(math.pi * e))
            rx = (dx * math.cos(th) - dy * math.sin(th)) * k
            ry = (dx * math.sin(th) + dy * math.cos(th)) * k / 2.0
            z = math.exp(math.log(W0[2]) + (math.log(C[2]) - math.log(W0[2])) * e)
            return (C[0] + rx, C[1] + ry, z)
        return Wd

    def render(self, n):
        if B.CUT - SPIRAL + 8 < n < B.CUT - 3:
            return self.blurred(n, shutter=0.5, subs=4, warps=3)
        return self.plain(n)
