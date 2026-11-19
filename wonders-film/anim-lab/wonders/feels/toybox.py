"""Feel 3 - TOY BOX.  The world is a set of painted wooden toys, dropped into place.

Every slab falls out of the sky under real gravity - its shadow gathering on the paper beneath it - lands
with a squash, one short heavy hop and a puff of dust, and the camera takes the thud.  Then the buildings
drop onto it back-to-front (lighter: a squash and a click), then a patter of trees, people and boats, tossed
in and bouncing twice.  Weight is the whole idea: fall time grows with the square root of the drop.
Life: the balloon squats before it lets go and kicks up dust.  Transition: the camera itself drops into the
close-up - accelerating, overshooting on landing, a thud, a settle.
"""
import math
import random

import numpy as np
import skia

from .. import ease
from ..pal import PAPER, INK, mix, vivid
from ..core import argb
from . import base as B

ORDER = ['colosseum', 'greatwall', 'taj', 'rio', 'reef', 'halong', 'machu', 'fuji', 'chichen', 'everest', 'niagara', 'eiffel']
EXTRA = ['stonehenge', 'aurora', 'opera', 'uluru', 'moai', 'islet_a', 'islet_b', 'islet_c', 'islet_d', 'islet_e']
SKY = ['sky_lo', 'sky_mid', 'sky_hi']
G = 1400.0           # map px / s^2 - toy-table gravity
DUST = (226, 214, 190)


def fall_time(h):
    return math.sqrt(2 * h / G)


def drop(x, h, squash=0.16, hop=0.06, k_land=1.0):
    """-> (dy, sx, sy) for a piece dropped from h map px, x seconds after release"""
    tf = fall_time(h)
    if x < tf:
        u = x / tf
        st = 0.05 * u * u * k_land                # it stretches a touch as it speeds up
        return (-h * (1 - u * u), 1 - st * 0.5, 1 + st)
    y = x - tf
    # one heavy hop: a small parabola, then squash on each contact
    th = math.sqrt(2 * hop * h / G) * 2
    dy = 0.0
    if y < th:
        v = y / th
        dy = -hop * h * 4 * v * (1 - v)
    sq = squash * math.exp(-y / 0.055) * math.cos(min(math.pi, y / 0.09 * math.pi * 0.5)) if y < 0.25 else 0.0
    if th <= y < th + 0.2:
        sq += squash * 0.35 * math.exp(-(y - th) / 0.04)
    return (dy, 1 + sq * 0.8, 1 - sq)


class ToyBox(B.Prebuilt):
    name = 'toybox'
    title = 'Toy box'
    pitch = 'painted wooden toys dropped into place: gravity, a squash, a hop, a puff of dust'
    transition_frames = 16

    def ready(self, name):
        t = self.w.tiles.get(name)
        return max(0.0, t.land + 0.5) if t is not None else None

    def plan(self):
        r = random.Random(9)
        self.balloon = B.find_balloon(self.w)
        self.puffs = []          # (t, x, y, size, n, spread)
        self.thuds = []          # (t, strength)
        tiles = self.w.tiles
        t = 0.30
        seq = []
        for name in ORDER:
            seq.append((name, t))
            t += 0.31
        t += 0.05
        for name in EXTRA:
            seq.append((name, t))
            t += 0.11
        for k, name in enumerate(SKY):
            seq.append((name, 4.0 + 0.45 * k))
        for name, t0 in seq:
            if name not in tiles:
                continue
            tile = tiles[name]
            tile.t_in = t0
            tile.h = 300.0 if tile.kind == 'tile' else 180.0
            if tile.kind == 'sky':
                tile.h = 120.0
            land = t0 + fall_time(tile.h)
            tile.land = land
            if tile.kind in ('tile', 'sat', 'islet'):
                b = tile.board.bbox or (tile.center[0] - 100, tile.center[1] - 50, tile.center[0] + 100, tile.center[1] + 50)
                big = tile.kind == 'tile'
                for (u, v) in ((0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.5, 1.0), (1.0, 0.5)) if big else ((0.5, 0.5),):
                    p = tile.P(u, v, -0.11) if big else (tile.center[0], b[3] - 6)
                    self.puffs.append((land, float(p[0]), float(p[1]), 7.0 if big else 4.5, 7 if big else 5, 24.0 if big else 14.0))
                self.thuds.append((land, 1.0 if big else 0.35))
        tiles['pyramids'].t_in = -99.0
        tiles['pyramids'].land = -99.0
        for name, tile in tiles.items():
            if not hasattr(tile, 'land'):
                tile.t_in = tile.land = -99.0
            big = sorted([g for g in tile.pieces if g.role == 'struct'], key=lambda g: g.fx['base'][1])
            dt = min(0.12, 0.7 / max(1, len(big)))
            for k, g in enumerate(big):
                g.fx['t0'] = tile.land + 0.12 + dt * k
                g.fx['drop'] = min(140.0, 60.0 + g.fx['h'] * 1.2)
                g.fx['kind'] = 'heavy'
                land = g.fx['t0'] + fall_time(g.fx['drop'])
                if g.fx['w'] > 10 and tile.name != 'pyramids':
                    bx, by = g.fx['base']
                    self.puffs.append((land, bx, by, 2.6 + min(3.0, g.fx['w'] * 0.04), 5, 4.0 + g.fx['w'] * 0.4))
            for g in tile.pieces:
                if g.role in ('board', 'keel'):
                    g.fx['t0'] = -99.0
                    g.fx['kind'] = 'tile'
                elif 'kind' not in g.fx:
                    g.fx['t0'] = tile.land + 0.35 + r.random() * 0.85 + (0.3 if g.role == 'fig' else 0.0)
                    g.fx['drop'] = r.uniform(34.0, 60.0)
                    g.fx['kind'] = 'light'
        ev = B.EVF / B.FPS
        bx, by = self.balloon.pivot
        self.puffs.append((ev - 1.22, bx, by + 13.0, 2.2, 6, 5.0))

    # ---- whole slabs
    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        if t < tile.t_in:
            return False
        R.nocull = t < 6.6
        x = t - tile.t_in
        if x < 1.5:
            dy, sx, sy = drop(x, tile.h, squash=0.10 if tile.kind == 'tile' else 0.14, hop=0.03)
            bx, by = tile.center
            by += 40.0
            c.translate(bx, by + dy)
            c.scale(sx, sy)
            c.translate(-bx, -by)
        return None

    def arrive(self, g, tile, x, t, tl):
        fx = g.fx
        kind = fx.get('kind')
        if g is self.balloon:
            return self._balloon(g, tl)
        if kind == 'tile' or tile.name == 'pyramids':
            return 'done'
        if x < 0:
            return None
        if x > 1.6:
            return 'done'
        bx, by = fx['base']
        if kind == 'heavy':
            dy, sx, sy = drop(x, fx['drop'], squash=0.16, hop=0.05)
        else:
            dy, sx, sy = drop(x, fx['drop'], squash=0.30, hop=0.22)
            # the light ones hop twice
            tf = fall_time(fx['drop'])
            th1 = math.sqrt(2 * 0.22 * fx['drop'] / G) * 2
            y = x - tf - th1
            th2 = th1 * 0.45
            if 0 < y < th2:
                v = y / th2
                dy = -0.22 * 0.2 * fx['drop'] * 4 * v * (1 - v)
        return (bx, by, 0.0, dy, 0.0, sx, sy, 0.0, None, 1.0)

    def _balloon(self, g, tl):
        ev = B.EVF / B.FPS
        x = tl - (ev - 1.65)
        if 0 < x < 0.5:
            # the squat before it lets go
            k = math.sin(math.pi * min(1.0, x / 0.4)) if x < 0.4 else 0.0
            px, py = g.pivot
            return (px, py + 10.0, 0.0, 1.6 * k, 0.0, 1 + 0.08 * k, 1 - 0.10 * k, 0.0, None, 1.0)
        return 'done'

    # ---- shadows of falling things, and dust
    def overlay(self, c, t, tl, R):
        for tile in self.w.tiles.values():
            if tile.t_in <= t < tile.land + 0.05 and tile.kind != 'sky':
                k = (t - tile.t_in) / (tile.land - tile.t_in)
                cx, cy = tile.center
                big = tile.kind == 'tile'
                rx = (95.0 if big else 30.0) * (0.55 + 0.45 * k)
                B.shadow(c, R, cx, cy + (36.0 if big else 6.0), rx, rx * 0.45, 0.15 * k * k)
        for (t0, x, y, s, n, spread) in self.puffs:
            u = (tl - t0) / 0.75
            if 0 < u < 1:
                e = ease.out_cubic(u)
                a = (1 - u) ** 1.6
                for k in range(n):
                    side = (k / (n - 1) - 0.5) * 2 if n > 1 else 0.0
                    px = x + side * spread * (0.6 + 0.9 * e)
                    py = y - 1.0 - (2.0 + 6.0 * (1 - abs(side))) * e * s / 6.0
                    rr = s * (0.55 + 0.6 * e) * (0.8 + 0.3 * math.sin(k * 2.3))
                    p = skia.Path()
                    p.addCircle(px, py, rr)
                    R.fill(c, p, DUST, 0.9 * a)
                    R.stroke(c, p, mix(INK, PAPER, 0.35), 0.3, 0.8 * a)

    def _shake(self, t):
        dx = dy = 0.0
        for (t0, s) in self.thuds:
            x = t - t0
            if 0 < x < 0.6:
                dy += 3.2 * s * B.damped(x, 11.0, 9.0)
                dx += 1.2 * s * B.damped(x + 0.02, 7.0, 9.0)
        return dx, dy

    # ---- camera: ease out + thuds; then it drops into the close-up
    def cam(self, f):
        C = B.close_cam(max(f, B.CUT))
        if f >= B.CUT:
            x = (f - B.CUT) / B.FPS
            # overshoot on landing and settle back - the camera has weight too
            z = 1.0 + 0.055 * B.damped(x + 0.06, 1.7, 6.0) / 0.84
            dy = 3.0 * B.damped(x, 8.0, 10.0)
            return (C[0], C[1] + dy / C[2], C[2] * z)
        t = f / B.FPS
        Wd = B.build_cam(t, 5.4)
        dx, dy = self._shake(t)
        Wd = (Wd[0] + dx / Wd[2], Wd[1] + dy / Wd[2], Wd[2])
        n0 = B.CUT - self.transition_frames
        if f > n0:
            u = (f - n0) / self.transition_frames
            e = u ** 2.2                               # falling: all acceleration, no ease in to the landing
            W0 = B.build_cam(n0 / B.FPS, 5.4)
            return B.lerp_cam(W0, C, e)
        return Wd

    def render(self, n):
        if B.CUT - self.transition_frames < n < B.CUT:
            return self.blurred(n, shutter=0.8)
        return self.plain(n)
