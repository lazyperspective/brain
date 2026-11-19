"""Feel 2 - STOP-MOTION ON TWOS.  A cut-out set, animated by hand under a rostrum camera.

Everything (the world, its life and the camera) is shot on twos: 15 drawings a second, each held for
two frames.  The slabs are cut-out pieces laid down by an unseen hand - you see its shadow reach in -
each one arriving lifted and tilted, pressed down, then nudged true.  The buildings follow, set down
back-to-front; the small things (trees, people, boats) appear by replacement, a few per exposure, with a
one-exposure squash.  The lines boil gently (three cycling drawings), the exposure flickers by a hair.
Transition: two stepped camera nudges in, a hard cut, and the close-up bumps into place.
"""
import math
import random

import cv2
import numpy as np
import skia

from .. import ease
from . import base as B

STEP = 2                     # frames per exposure (on twos at 30 fps)
ORDER = ['colosseum', 'greatwall', 'taj', 'rio', 'reef', 'halong', 'machu', 'fuji', 'chichen', 'everest', 'niagara', 'eiffel']
EXTRA = ['sky_lo', 'stonehenge', 'aurora', 'opera', 'uluru', 'moai', 'sky_mid', 'islet_a', 'islet_b', 'islet_c', 'islet_d', 'islet_e', 'sky_hi']

# placement: (dy in units of the lift, rotation factor, squash) per exposure after the hand arrives
PLACE = [(1.0, 1.0, 1.0), (0.42, 0.45, 1.0), (-0.05, 0.0, 0.965), (0.0, -0.18, 1.0)]


class StopMotion(B.Prebuilt):
    name = 'stopmo'
    title = 'Stop-motion on twos'
    pitch = 'a cut-out set laid down by an unseen hand, shot on twos'
    transition_frames = 0

    def ready(self, name):
        t = self.w.tiles.get(name)
        return max(0.0, t.t_in + 0.4) if t is not None else None

    def plan(self):
        r = random.Random(5)
        self.balloon = B.find_balloon(self.w)
        t = 0.30
        self.hand = []           # (time, map point) of every slab placement - the hand's shadow visits them
        tiles = self.w.tiles
        for tile in tiles.values():
            tile.nudge = (0.0, 0.0)
            tile.lift = 0.0
            tile.rot = 0.0
        for name in ORDER + EXTRA:
            if name not in tiles:
                continue
            tile = tiles[name]
            tile.t_in = round(t * 15) / 15.0
            tile.lift = 34.0 if tile.kind == 'tile' else 22.0
            tile.rot = r.uniform(-5.0, 5.0)
            tile.nudge = (r.uniform(-1.4, 1.4), r.uniform(-0.6, 0.6))
            self.hand.append((tile.t_in, tuple(tile.center)))
            t += 0.30 if tile.kind == 'tile' else 0.13
        for name, tile in tiles.items():
            if name == 'pyramids':
                tile.t_in = -99.0
            big = [g for g in tile.pieces if g.role == 'struct']
            big.sort(key=lambda g: g.fx['base'][1])
            dt = min(0.0667 * 1.5, 0.95 / max(1, len(big)))
            for k, g in enumerate(big):
                g.fx['t0'] = round((tile.t_in + 0.34 + dt * k) * 15) / 15.0
                g.fx['rot'] = r.uniform(-7, 7)
                g.fx['lift'] = min(16.0, 5.0 + g.fx['h'] * 0.35)
                g.fx['kind'] = 'place'
            for g in tile.pieces:
                if g.role in ('board', 'keel') or g.role == 'struct':
                    g.fx['t0'] = tile.t_in
                    g.fx.setdefault('kind', 'tile')
                    continue
                # replacement: a handful per exposure, spread over a second
                g.fx['t0'] = round((tile.t_in + 0.55 + r.random() * 0.9) * 15) / 15.0
                g.fx['kind'] = 'pop'
        self._fields = None

    # ---- clocks: everything on twos
    def q(self, f):
        return math.floor(f / STEP) * STEP

    def clocks(self, f):
        fq = self.q(f)
        return fq / B.FPS, fq / B.FPS

    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        x = t - tile.t_in
        if x < -1e-6:
            return False
        R.nocull = t < 6.6
        k = int(round(x * 15))
        if k < len(PLACE):
            dyf, rf, sq = PLACE[k]
            bx, by = tile.center
            if k == len(PLACE) - 1:
                c.translate(tile.nudge[0], tile.nudge[1])
            c.translate(bx, by - tile.lift * dyf)
            c.rotate(tile.rot * rf)
            sc = 1.0 + 0.04 * max(0.0, dyf)
            c.scale(sc * (2 - sq), sc * sq)
            c.translate(-bx, -by)
        elif k < 40:
            c.translate(tile.nudge[0], tile.nudge[1])
        else:
            c.translate(tile.nudge[0], tile.nudge[1])
        return None

    def arrive(self, g, tile, x, t, tl):
        fx = g.fx
        kind = fx.get('kind')
        if g is self.balloon:
            return self._balloon(g, tl)
        if kind == 'tile' or tile.name == 'pyramids':
            return 'done'
        if x < -1e-6:
            return None
        k = int(round(x * 15))
        bx, by = fx['base']
        if kind == 'place':
            if k >= len(PLACE):
                return 'done'
            dyf, rf, sq = PLACE[k]
            return (bx, by, 0.0, -fx['lift'] * dyf, fx['rot'] * rf, 2 - sq, sq, 0.0, None, 1.0)
        # replacement pop: one squashed exposure, one stretched, then itself
        if k == 0:
            return (bx, by, 0.0, 0.0, 0.0, 1.18, 0.72, 0.0, None, 1.0)
        if k == 1:
            return (bx, by, 0.0, 0.0, 0.0, 0.94, 1.08, 0.0, None, 1.0)
        return 'done'

    def _balloon(self, g, tl):
        """the puppet balloon is moved a hair each exposure: it never travels quite smoothly"""
        ev = B.EVF / B.FPS
        f = (tl - (ev - 1.3)) / 3.0
        if 0.0 < f < 1.15:
            s = int(round(tl * 15))
            rr = random.Random(s)
            px, py = g.pivot
            return (px, py, rr.uniform(-0.35, 0.35), rr.uniform(-0.3, 0.3), rr.uniform(-2.0, 2.0), 1.0, 1.0, 0.0, None, 1.0)
        return 'done'

    # ---- the unseen hand
    def overlay(self, c, t, tl, R):
        if t > 6.4:
            return
        for (th, p) in self.hand:
            x = t - th
            if -0.30 < x < 0.24:
                # reach in from top-right, hover, set down, withdraw (on twos)
                if x < 0:
                    e = 1 - ease.out_cubic(-x / 0.30)
                else:
                    e = 1 - ease.in_cubic(x / 0.24)
                far = np.array([340.0, -260.0])
                tip = np.asarray(p) + np.array([18.0, -22.0]) + far * (1 - e)
                a = 0.13 * min(1.0, e * 1.6)
                pnt = skia.Paint(AntiAlias=True, Color=skia.ColorSetARGB(int(255 * a), 50, 40, 32),
                                 MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 9.0))
                c.drawOval(skia.Rect.MakeXYWH(tip[0] - 22, tip[1] - 14, 50, 30), pnt)
                pa = skia.Paint(AntiAlias=True, Color=skia.ColorSetARGB(int(255 * a), 50, 40, 32), Style=skia.Paint.kStroke_Style,
                                StrokeWidth=30.0, StrokeCap=skia.Paint.kRound_Cap,
                                MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 11.0))
                c.drawLine(tip[0] + 14, tip[1] - 6, tip[0] + 400, tip[1] - 330, pa)

    # ---- boil + exposure flicker (before the paper grain, so the paper itself stays put)
    def _boil_fields(self, w, h):
        if self._fields is None:
            rng = np.random.default_rng(3)
            fields = []
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
            for k in range(3):
                small = rng.standard_normal((2, h // 24 + 2, w // 24 + 2)).astype(np.float32)
                dx = cv2.resize(cv2.GaussianBlur(small[0], (0, 0), 1.2), (w, h), interpolation=cv2.INTER_CUBIC)
                dy = cv2.resize(cv2.GaussianBlur(small[1], (0, 0), 1.2), (w, h), interpolation=cv2.INTER_CUBIC)
                s = 0.95 / (np.std(dx) + 1e-6)
                fields.append((xx + dx * s, yy + dy * s))
            self._fields = fields
        return self._fields

    def pre_paper(self, img, t, cam, R):
        h, w = img.shape[:2]
        k = int(round(t * 15))
        fx, fy = self._boil_fields(w, h)[k % 3]
        out = cv2.remap(img, fx, fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        fl = 1.0 + 0.009 * random.Random(k * 7 + 1).uniform(-1, 1)
        if abs(fl - 1.0) > 1e-4:
            out = np.clip(out.astype(np.float32) * fl, 0, 255).astype(np.uint8)
        return out

    # ---- camera: on twos; nudge, nudge, cut, bump
    def cam(self, f):
        fq = self.q(f)
        C = B.close_cam(B.CUT)
        if fq >= B.CUT:
            k = (fq - B.CUT) // STEP
            base = B.close_cam(fq)
            bump = [(5.0, -3.0, 0.965), (1.8, -1.0, 0.988), (-0.5, 0.3, 1.003)]
            if k < len(bump):
                dx, dy, z = bump[k]
                return (base[0] + dx, base[1] + dy, base[2] * z)
            return base
        Wd = B.build_cam(fq / B.FPS, 5.6)
        k = (fq - (B.CUT - 3 * STEP)) // STEP
        if k >= 0:
            fr = [0.10, 0.22, 0.36][int(k)]
            return B.lerp_cam(Wd, (C[0], C[1], Wd[2] * 1.9), fr)
        return Wd

    def render(self, n):
        return self.plain(n)
