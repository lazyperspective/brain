"""Feel 8 - SAND DREAM.  Every wonder condenses out of drifting sand, like a dream remembering itself.

Build: the Pyramids' desert is the source.  Ribbons of grains lift off its dunes and drift out on slow,
curling winds to where each slab will be; there they settle and the slab condenses grain by grain - first
a faint mist of itself, then thickening into solid colour, in soft clumps.  Long, overlapping, unhurried
in-out easing; nothing snaps or bounces.  The camera floats.  Life: as the balloon lifts, sand trickles
from its basket; motes drift through the close-up.  Transition: a grain dissolve - the close-up condenses
over the wide while both drift gently in.
"""
import math
import random

import cv2
import numpy as np
import skia

from .. import ease
from ..core import ZS
from ..pal import SAND, SAND_D, vivid
from . import base as B

ORDER = ['colosseum', 'greatwall', 'taj', 'rio', 'reef', 'halong', 'machu', 'fuji', 'chichen', 'everest', 'niagara', 'eiffel']
EXTRA = ['stonehenge', 'aurora', 'opera', 'uluru', 'moai', 'islet_a', 'islet_b', 'islet_c', 'islet_d', 'islet_e']
SKY = ['sky_lo', 'sky_mid', 'sky_hi']
FORM = 1.55            # seconds a slab takes to condense
NPART = 700            # grains per slab
DISSOLVE = 30          # frames of the grain dissolve


def _noise(n=768, seed=21):
    rng = np.random.default_rng(seed)

    def wblur(a, s):
        pad = int(4 * s) + 2
        b = cv2.GaussianBlur(np.pad(a, pad, mode='wrap'), (0, 0), s)
        return b[pad:-pad, pad:-pad]
    fine = wblur(rng.standard_normal((n, n)).astype(np.float32), 0.8)
    clump = wblur(rng.standard_normal((n, n)).astype(np.float32), 9.0)
    a = fine / fine.std() * 0.55 + clump / clump.std() * 1.0
    # rank -> uniform 0..1, so "progress" is the fraction of grains settled
    r = np.empty(a.size, np.float32)
    r[np.argsort(a.ravel())] = np.linspace(0, 1, a.size, dtype=np.float32)
    return r.reshape(n, n)


class Sand(B.Prebuilt):
    name = 'sand'
    title = 'Sand dream'
    pitch = 'each wonder condenses out of drifting sand blown from the Pyramids, like a dream remembering'
    transition_frames = 0

    def plan(self):
        r = random.Random(17)
        self.balloon = B.find_balloon(self.w)
        tiles = self.w.tiles
        t = 0.55
        for name in ORDER:
            tiles[name].t_in = t
            t += 0.31
        for name in EXTRA:
            if name in tiles:
                tiles[name].t_in = t - 0.2
                t += 0.12
        for k, name in enumerate(SKY):
            tiles[name].t_in = 3.4 + 0.6 * k
        tiles['pyramids'].t_in = -99.0
        for tile in tiles.values():
            if not hasattr(tile, 't_in'):
                tile.t_in = -99.0
            xs = [s_.bbox for s_ in tile.shapes]
            # generous bounds: life wanders, groups move
            tile.sbox = skia.Rect.MakeLTRB(min(b[0] for b in xs) - 40, min(b[1] for b in xs) - 40,
                                           max(b[2] for b in xs) + 40, max(b[3] for b in xs) + 40)
            for g in tile.pieces:
                g.fx['t0'] = -99.0
        # the mask: map-anchored, rank-uniform grain noise
        nz = _noise()
        u8 = (nz * 255).astype(np.uint8)
        rgba = np.dstack([u8, u8, u8, np.full_like(u8, 255)])
        self.nimg = skia.Image.fromarray(np.ascontiguousarray(rgba), colorType=skia.kRGBA_8888_ColorType)
        self.nshader = self.nimg.makeShader(skia.TileMode.kRepeat, skia.TileMode.kRepeat,
                                            skia.SamplingOptions(skia.FilterMode.kLinear), skia.Matrix.Scale(0.32, 0.32))
        # grains: from the dunes round the Pyramids to points on each slab
        pyr = tiles['pyramids']
        self.parts = []
        rng = np.random.default_rng(5)
        for name in ORDER + EXTRA:
            tile = tiles.get(name)
            if tile is None:
                continue
            n = NPART if tile.kind == 'tile' else NPART // 3
            if tile.kind == 'tile':
                uv = rng.uniform(0.03, 0.97, (n, 2))
                tgt = np.array([tile.P(u, v) for u, v in uv])
            else:
                c = np.asarray(tile.center)
                tgt = c + rng.normal(0, 1, (n, 2)) * np.array([16.0, 7.0])
            suv = rng.uniform(0.15, 0.95, (n, 2))
            src = np.array([pyr.P(u, v) for u, v in suv]) + np.array([0.0, -4.0])
            mid = (src + tgt) / 2
            d = tgt - src
            perp = np.stack([-d[:, 1], d[:, 0]], 1) / (np.hypot(d[:, 0], d[:, 1])[:, None] + 1e-6)
            side = rng.choice([-1.0, 1.0]) * rng.uniform(0.3, 0.6, (n, 1)) * np.hypot(d[:, 0], d[:, 1])[:, None]
            ctrl = mid + perp * side + np.array([0.0, -60.0]) * rng.uniform(0.6, 1.4, (n, 1))
            launch = tile.t_in - 1.3 + rng.uniform(-0.25, 0.55, n)
            fly = rng.uniform(1.1, 1.6, n)
            hue = rng.uniform(0, 1, n)
            self.parts.append((src, ctrl, tgt, launch, fly, hue, rng.uniform(0, 6.28, n)))
        self.sand_cols = [vivid(SAND), vivid(SAND_D), vivid((236, 214, 170)), vivid((214, 176, 120))]

    def ready(self, name):
        t = self.w.tiles.get(name)
        return max(0.0, t.t_in + FORM * 0.8) if t is not None else None

    # ---- condensing: each slab is drawn into a layer and masked by settled grains
    def _p(self, tile, t):
        x = (t - tile.t_in) / FORM
        return ease.in_out(min(1.0, max(0.0, x)), 1.7) * 1.25

    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        if tile.t_in < -50:
            return None
        R.nocull = t < 6.6
        p = self._p(tile, t)
        if p <= 0.0:
            return False
        if p >= 1.249:
            return None
        c.saveLayer(tile.sbox, None)
        tile._sand_layer = p
        return None

    def tile_end(self, c, tile, t, tl, tau, sky, R):
        p = getattr(tile, '_sand_layer', None)
        if p is None:
            return
        tile._sand_layer = None
        gain = 7.0
        # alpha = gain * (p - grain): a ghost first, then solid
        cf = skia.ColorFilters.Matrix([0, 0, 0, 0, 0.94, 0, 0, 0, 0, 0.92, 0, 0, 0, 0, 0.86,
                                       -gain, 0, 0, 0, gain * (p - 0.12)])
        paint = skia.Paint(Shader=self.nshader, ColorFilter=cf, BlendMode=skia.BlendMode.kDstIn)
        c.drawRect(tile.sbox, paint)
        c.restore()

    def arrive(self, g, tile, x, t, tl):
        if g is self.balloon:
            return 'done'
        return 'done'

    # ---- the grains in flight
    def overlay(self, c, t, tl, R):
        if t < 6.8:
            self._grains(c, t, R)
        self._trickle(c, tl, R)

    def _grains(self, c, t, R):
        buckets = [[] for _ in self.sand_cols]
        for (src, ctrl, tgt, launch, fly, hue, ph) in self.parts:
            u = (t - launch) / fly
            m = (u > 0) & (u < 1)
            if not m.any():
                continue
            uu = u[m]
            e = uu * uu * (3 - 2 * uu)
            e = e[:, None]
            pos = (1 - e) ** 2 * src[m] + 2 * (1 - e) * e * ctrl[m] + e * e * tgt[m]
            # a little turbulence along the way
            sw = np.sin(np.pi * uu)[:, None]
            pos = pos + sw * np.stack([np.sin(t * 2.1 + ph[m]) * 3.0, np.cos(t * 1.7 + ph[m]) * 1.8], 1)
            k = (hue[m] * len(self.sand_cols)).astype(int)
            for j in range(len(self.sand_cols)):
                sel = pos[k == j]
                if len(sel):
                    buckets[j].append(sel)
        for j, col in enumerate(self.sand_cols):
            if not buckets[j]:
                continue
            P = np.vstack(buckets[j])
            pts = [skia.Point(float(x), float(y)) for x, y in P]
            pnt = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap,
                             StrokeWidth=1.35, Color=skia.ColorSetARGB(230, int(col[0]), int(col[1]), int(col[2])))
            c.drawPoints(skia.Canvas.kPoints_PointMode, pts, pnt)

    def _trickle(self, c, tl, R):
        """sand trickling from the basket as the balloon lifts; motes in the air"""
        g = self.balloon
        ev = B.EVF / B.FPS
        if tl < ev - 1.6 or tl > ev + 2.4:
            return
        st = g.state(99.0, tl)
        px, py = g.pivot
        bx, by = px + st[0], py + st[1] + 11.5
        pts = []
        for k in range(36):
            t0 = ev - 1.4 + k * 0.08
            x = tl - t0
            if 0 < x < 1.4:
                st0 = g.state(99.0, t0)
                x0, y0 = px + st0[0] + math.sin(k * 2.3) * 1.2, py + st0[1] + 11.5
                pts.append(skia.Point(x0 + 2.0 * math.sin(k * 1.7 + x * 3), y0 + 14.0 * x * x + 2.0 * x))
        if pts:
            col = vivid(SAND_D)
            pnt = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap,
                             StrokeWidth=0.7, Color=skia.ColorSetARGB(220, int(col[0]), int(col[1]), int(col[2])))
            c.drawPoints(skia.Canvas.kPoints_PointMode, pts, pnt)

    # ---- camera: floating
    def _float(self, t):
        return (2.5 * math.sin(t * 0.47), 1.4 * math.sin(t * 0.83 + 1.0))

    def cam(self, f):
        t = f / B.FPS
        if f >= B.CUT:
            C = B.close_cam(f)
            dx, dy = self._float(t)
            k = math.exp(-(f - B.CUT) / 40.0)
            return (C[0] + dx * 0.3 * k, C[1] + dy * 0.3 * k, C[2] * (1 + 0.06 * k * k))
        Wd = B.build_cam(t, 6.0, 2.2)
        dx, dy = self._float(t)
        return (Wd[0] + dx, Wd[1] + dy, Wd[2])

    def render(self, n):
        n0 = B.CUT - DISSOLVE
        if not (n0 <= n < B.CUT):
            return self.plain(n)
        u = (n - n0 + 0.5) / DISSOLVE
        e = ease.in_out(u, 2.0)
        Wc = self.cam(n)
        C = B.close_cam(B.CUT)
        A = self.plain(n, cam=(Wc[0] + (C[0] - Wc[0]) * 0.3 * e, Wc[1] + (C[1] - Wc[1]) * 0.3 * e, Wc[2] * (1 + 0.25 * e)))
        Bi = self.plain(n, cam=(C[0], C[1], C[2] * (1.06 + 0.0 * e)))
        return grain_dissolve(A, Bi, e, self)


_NZ = None


def grain_dissolve(A, Bi, e, feel):
    global _NZ
    h, w = A.shape[:2]
    if _NZ is None:
        nz = _noise(768, 33)
        _NZ = np.tile(nz, (h // 768 + 1, w // 768 + 1))[:h, :w]
    m = np.clip((e * 1.3 - 0.15 - _NZ) * 6.0 + 0.0, 0, 1)
    soft = cv2.GaussianBlur(A, (0, 0), 1.2 + 3.0 * e)
    Af = A.astype(np.float32) * (1 - e * 0.6) + soft.astype(np.float32) * (e * 0.6)
    out = Af * (1 - m[:, :, None]) + Bi.astype(np.float32) * m[:, :, None]
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)
