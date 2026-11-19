"""Feel 5 - PLOTTER / 3D PRINT.  The world is printed: precise, mechanical, constant speed.

Build: the bed is printed in a serpentine raster - one slab job after another, back row to front, left-right
then right-left.  Each job first rules its footprint in blue (the slicer preview), then the slab is laid
down layer by layer from the bottom of its rock keel up through the topsoil, at a constant feed rate; then
everything on it extrudes from the ground up, one z-layer at a time.  The layer being laid glows saffron;
fresh layers show faint layer lines that cure away.  Tall things simply take longer: the Eiffel tower and
Everest are the last to finish.  Velocity profiles are trapezoids - accelerate, cruise, decelerate - never
springs.  Life: the balloon rises on a motion-control profile, perfectly plumb.  Transition: a motion-control
dolly - constant speed, no pull-out, no overshoot.
"""
import math

import numpy as np
import skia

from .. import ease
from ..core import ZS
from ..pal import ACCENT, ACCENT_L, PENCIL, INK
from . import base as B

ROWS = [['everest'], ['fuji', 'greatwall', 'eiffel', 'aurora', 'stonehenge'], ['niagara', 'colosseum', 'taj', 'halong', 'opera'],
        ['uluru', 'reef', 'rio', 'chichen'], ['moai', 'machu']]
ISLETS = ['islet_a', 'islet_b', 'islet_c', 'islet_d', 'islet_e']
SKY = ['sky_lo', 'sky_mid', 'sky_hi']
FEED_BED = 150.0     # map px / s: the slab rises at this rate
FEED_Z = 78.0        # map px / s: z-speed of the extrusion
JOB = 0.2           # s between job starts


def trap(u, a=0.22):
    """0->1 with a trapezoid velocity profile: accelerate for a, cruise, decelerate for a"""
    u = min(1.0, max(0.0, u))
    vmax = 1.0 / (1.0 - a)
    if u < a:
        return 0.5 * vmax / a * u * u
    if u > 1 - a:
        v = 1 - u
        return 1 - 0.5 * vmax / a * v * v
    return 0.5 * vmax * a + vmax * (u - a)


class Plotter(B.Prebuilt):
    name = 'plotter'
    title = 'Plotter / 3D print'
    pitch = 'printed layer by layer at constant feed: precise, mechanical, satisfying'
    transition_frames = 34

    def plan(self):
        tiles = self.w.tiles
        self.balloon = B.find_balloon(self.w)
        order = []
        for k, row in enumerate(ROWS):
            order += row if k % 2 == 0 else row[::-1]
        t = 0.35
        for name in order + ISLETS:
            if name not in tiles:
                continue
            tile = tiles[name]
            tile.t_in = t
            t += JOB if tile.kind == 'tile' else JOB * 0.5
        for k, name in enumerate(SKY):
            tiles[name].t_in = 2.4 + 0.4 * k          # a second head prints the sky
        tiles['pyramids'].t_in = -99.0
        for name, tile in tiles.items():
            if not hasattr(tile, 't_in') or tile.t_in is None:
                tile.t_in = -99.0
            b = tile.board.bbox
            kb = tile.keel_piece.bbox if tile.keel_piece is not None else None
            if b is None:
                tile.bed_end = tile.t_in
                for g in tile.pieces:
                    g.fx['t0'] = tile.t_in
                    g.fx['kind'] = 'z'
                    g.fx['dur'] = max(0.12, g.fx['h'] / FEED_Z)
                continue
            lo = max(b[3], kb[3]) if kb else b[3]
            tile.bed = (lo, b[1])
            tile.bed_end = tile.t_in + 0.25 + (lo - b[1]) / FEED_BED
            for g in tile.pieces:
                fx = g.fx
                if g.role in ('board', 'keel'):
                    fx['t0'] = tile.t_in + 0.25
                    fx['kind'] = 'bed'
                    continue
                fx['t0'] = tile.bed_end + 0.05
                fx['kind'] = 'z'
                fx['dur'] = max(0.12, fx['h'] / FEED_Z)
            # the slicer preview: the slab's pencil footprint, ruled as the job starts and erased as it prints
            for k, sh in enumerate(tile.placeholder_keep):
                sh.tp = 60.0 + tile.t_in - 0.3 + 0.04 * k
                sh.dp = 0.22
                sh.te = 60.0 + tile.bed_end - 0.2
                sh.de = 0.3
            tile.placeholder = tile.placeholder_keep
        self.done = max(t.bed_end for t in tiles.values()) + 2.5
        # the burner flame follows the balloon's own easing; remap its clock so it stays with the new profile
        self._remap_burner()

    def setup(self):
        for tile in self.w.tiles.values():
            tile.placeholder_keep = [s for s in tile.placeholder if s.stage != 'cross']
        super().setup()

    def ready(self, name):
        t = self.w.tiles.get(name)
        return max(0.0, t.bed_end + 0.3) if t is not None else None

    # ---- the print
    def _band(self, x0, x1, y_cut, y_lo, k_done, fresh):
        """layer bounds + tints: the hot layer at y_cut, layer lines on the fresh part"""
        rect = skia.Rect.MakeLTRB(x0 - 3, y_cut - 3, x1 + 3, y_lo + 3)
        tints = []
        if k_done < 1.0:
            tints.append((skia.Rect.MakeLTRB(x0 - 3, y_cut, x1 + 3, y_cut + 0.9), ACCENT, 0.95))
            tints.append((skia.Rect.MakeLTRB(x0 - 3, y_cut + 0.9, x1 + 3, y_cut + 2.6), ACCENT_L, 0.45))
        if fresh > 0.01:
            p = skia.Path()
            y = y_cut + 2.6
            while y < y_lo:
                p.addRect(skia.Rect.MakeLTRB(x0 - 3, y, x1 + 3, y + 0.32))
                y += 1.3
            tints.append((p, (255, 250, 236), 0.30 * fresh))
        return (rect, tints)

    def arrive(self, g, tile, x, t, tl):
        fx = g.fx
        if g is self.balloon:
            return self._balloon(g, tl)
        if tile.name == 'pyramids' or tile.t_in < -50:
            return 'done'
        if x <= 0:
            return None
        b = g.bbox
        if b is None:
            return 'done'
        if fx.get('kind') is None:
            return 'done'
        if fx['kind'] == 'bed':
            lo, hi = tile.bed
            span = lo - hi
            dur = span / FEED_BED
            k = x / dur
            if k >= 1.6:
                return 'done'
            y_cut = lo - span * min(1.0, k) - 0.5
            fresh = 1.0 - B.clamp((k - 1.0) / 0.6)
            clip = skia.Path()
            clip.addRect(skia.Rect.MakeLTRB(b[0] - 4, y_cut, b[2] + 4, lo + 6))
            band = self._band(b[0], b[2], y_cut, lo + 4, k, fresh)
            return (0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, clip, 1.0, band)
        dur = fx['dur']
        k = x / dur
        if k >= 1.0 + 0.8 / dur:
            return 'done'
        h = fx['h']
        lo = b[3]
        y_cut = lo - h * min(1.0, k) - 0.4
        fresh = 1.0 - B.clamp((x - dur) / 0.8)
        clip = skia.Path()
        clip.addRect(skia.Rect.MakeLTRB(b[0] - 40, y_cut, b[2] + 40, lo + 40))
        band = self._band(b[0] - 1, b[2] + 1, y_cut, lo + 1, k, fresh)
        return (0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, clip, 1.0, band)

    # ---- life: a motion-control balloon
    def _lift_f(self, tl):
        ev = B.EVF / B.FPS
        return trap((tl - (ev - 1.15)) / 2.7, 0.25)

    def _balloon(self, g, tl):
        ev = B.EVF / B.FPS
        H = 0.36 * ZS - 12.0
        f = self._lift_f(tl)
        # cancel the film's own lift (sway + ease) and apply a plumb, trapezoidal one
        m = g.motion(tl, 0.0, g.ph)
        px, py = g.pivot
        return (px, py, -m[0], -m[1] + H * (1 - f), 0.0, 1.0, 1.0, 0.0, None, 1.0)

    def _remap_burner(self):
        pyr = self.w.tiles['pyramids']
        ev = B.EVF / B.FPS
        us = np.linspace(0, 1, 401)
        film = np.array([ease.in_out(u, 2.2) for u in us])
        for sh in pyr.shapes:
            if sh.draw is not None and 'burner' in getattr(sh.draw, '__qualname__', ''):
                orig = sh.draw
                feel = self

                def draw(c, tau, t, a, R, orig=orig):
                    f = feel._lift_f(t)
                    # find the film time whose eased lift equals ours
                    u = float(np.interp(f, film, us))
                    tt = (ev - 1.3) + 3.0 * u if 0.0 < f < 1.0 else t
                    if f >= 1.0:
                        tt = max(t, ev + 1.7)
                    orig(c, tau, tt + (t - tt) * 0.0 if 0.0 < f < 1.0 else t, a, R)
                sh.draw = draw

    # ---- camera: motion control
    def cam(self, f):
        C = B.close_cam(max(f, B.CUT))
        if f >= B.CUT:
            return B.close_cam(f)
        t = f / B.FPS
        Wd = B.lerp_cam(B.CAM0, B.WIDE, trap(t / 5.4, 0.3))
        n0 = B.CUT - self.transition_frames
        if f > n0:
            W0 = B.lerp_cam(B.CAM0, B.WIDE, trap(n0 / B.FPS / 5.4, 0.3))
            return B.lerp_cam(W0, C, trap((f - n0) / self.transition_frames, 0.28))
        return Wd

    def render(self, n):
        if B.CUT - self.transition_frames < n < B.CUT:
            return self.blurred(n, shutter=0.5)
        return self.plain(n)
