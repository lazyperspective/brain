"""Feel 1 - POP-UP BOOK.  The world is a folded paper map that opens itself.

Build: the Pyramids panel is the cover.  Every other slab is a panel folded underneath its neighbour; it
swings out on its crease (a true 3D hinge, projected), showing its blank card back while it is upside down,
and lands flat with a soft paper flap.  As each panel opens, the architecture on it rises with it, linked
like the V-folds of a pop-up page (nearest the crease first); then trees, people and boats flick up as
little tabs.  Satellites and sky pieces hinge up on their own tabs.  Everything is printed: no pencil, no wash.
Life: stand-ups flutter; the balloon swings on its tab as it rises.   Transition: a page turn.
"""
import math

import numpy as np
import skia

from .. import ease
from ..core import PITCH, GAP, W, ZS, iso, argb
from ..pal import PAPER, INK, ACCENT, mix, shade, vivid
from . import base as B

PARENT = {
    'colosseum': 'pyramids', 'greatwall': 'pyramids', 'taj': 'pyramids', 'rio': 'pyramids',
    'eiffel': 'colosseum', 'niagara': 'colosseum', 'everest': 'greatwall', 'fuji': 'greatwall',
    'halong': 'taj', 'reef': 'taj', 'machu': 'rio', 'chichen': 'rio',
}
T_IN = {
    'colosseum': 0.25, 'greatwall': 0.62, 'taj': 0.99, 'rio': 1.36,
    'reef': 2.05, 'halong': 2.33, 'machu': 2.61, 'fuji': 2.89, 'chichen': 3.17, 'everest': 3.45, 'niagara': 3.73, 'eiffel': 4.01,
    'stonehenge': 4.55, 'aurora': 4.68, 'opera': 4.81, 'uluru': 4.94, 'moai': 5.07,
    'sky_lo': 3.6, 'sky_mid': 4.3, 'sky_hi': 4.9,
    'islet_a': 4.75, 'islet_b': 4.9, 'islet_c': 5.05, 'islet_d': 5.2, 'islet_e': 5.35,
}
UNF = 1.0          # seconds a panel takes to swing open
BACK = (232, 222, 200)
TURN = 26          # frames of page turn, ending on the cut


def _M(a, b, c, d, e, f):
    m = skia.Matrix()
    m.setAll(a, b, c, d, e, f, 0.0, 0.0, 1.0)
    return m


class PopUp(B.Prebuilt):
    name = 'popup'
    title = 'Pop-up book'
    pitch = 'the world is a folded paper map that opens itself; buildings rise with the page'
    transition_frames = 0

    def ready(self, name):
        t = self.w.tiles.get(name)
        return max(0.0, t.t_in + UNF) if t is not None else None

    def plan(self):
        self.balloon = B.find_balloon(self.w)
        for name, tile in self.w.tiles.items():
            tile.t_in = T_IN.get(name, -99.0)
            if name in PARENT:
                p = self.w.tiles[PARENT[name]]
                di, dj = p.i - tile.i, p.j - tile.j
                tile.hinge = (di, dj)
            else:
                tile.hinge = None
            # pieces: lag behind the page by their distance from the crease
            for g in tile.pieces:
                fx = g.fx
                bx, by = fx['base']
                if tile.hinge is not None:
                    hx, hy = self._hinge_mid(tile)
                    d = math.hypot(bx - hx, (by - hy) * 1.7) / 230.0
                else:
                    d = 0.5
                fx['lag'] = min(1.0, d)
                fx['ph'] = (bx * 0.37 + by * 0.11) % 6.28

    def _hinge_mid(self, tile):
        di, dj = tile.hinge
        u = 0.5 + 0.5 * di + (GAP / 2) * di
        v = 0.5 + 0.5 * dj + (GAP / 2) * dj
        return tuple(tile.P(u, v))

    # ---- the panel's angle: -pi = folded under its neighbour, 0 = open flat
    def phi(self, tile, t):
        u = (t - tile.t_in) / UNF
        if u <= 0:
            return -math.pi
        if u >= 1:
            # the panel lands on a cushion of air: one soft flap
            return 0.07 * abs(B.damped(t - tile.t_in - UNF, 1.7, 5.5))
        e = ease.in_out(u, 2.4)
        return -math.pi * (1 - e)

    def opening(self, tile, t):
        if tile.hinge is None:
            # free-standing tabs (satellites, islets, sky): hinge straight up
            return B.clamp((t - tile.t_in) / 0.55)
        return (self.phi(tile, t) + math.pi) / math.pi if t < tile.t_in + UNF else 1.0

    def affine(self, tile, phi):
        """the 2D map of the slab's ground plane rotated by phi about its crease"""
        di, dj = tile.hinge
        X0, Y0 = tile.X0, tile.Y0
        # hinge coordinate along the axis that crosses the crease
        if di != 0:
            h = X0 + (1.0 + GAP / 2 if di > 0 else -GAP / 2)
        else:
            h = Y0 + (1.0 + GAP / 2 if dj > 0 else -GAP / 2)
        sgn = (di if di != 0 else dj)
        cp, sp = math.cos(phi), math.sin(phi)

        def M3(X, Y):
            # rotate the point (X, Y, 0) about the crease; phi<0 swings the panel under (the far side goes down)
            if di != 0:
                x = X - h
                xn, z = x * cp, -x * sp * sgn * -1.0
                return iso(h + xn, Y, z)
            y = Y - h
            yn, z = y * cp, -y * sp * sgn * -1.0
            return iso(X, h + yn, z)

        # three points of the plane -> affine
        src = np.array([iso(X0, Y0), iso(X0 + 1, Y0), iso(X0, Y0 + 1)], float)
        dst = np.array([M3(X0, Y0), M3(X0 + 1, Y0), M3(X0, Y0 + 1)], float)
        S = np.hstack([src, np.ones((3, 1))])
        sol = np.linalg.solve(S, dst)          # [a c; b d; e f]
        a, c_ = sol[0, 0], sol[0, 1]
        b, d = sol[1, 0], sol[1, 1]
        e, f = sol[2, 0], sol[2, 1]
        return _M(a, b, e, c_, d, f), a * d - b * c_

    def tile_order(self, t, order):
        under = [tl for tl in order if tl.hinge is not None and tl.t_in <= t < tl.t_in + UNF and self.phi(tl, t) < -math.pi / 2]
        if not under:
            return None
        return under + [tl for tl in order if tl not in under]

    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        if t < tile.t_in:
            return False
        R.nocull = t < 6.6
        if tile.hinge is not None:
            if t < tile.t_in + UNF + 1.0:
                ph = self.phi(tile, t)
                if abs(ph) > 1e-4:
                    m, det = self.affine(tile, ph)
                    c.concat(m)
                    if det < 0:
                        if not sky:
                            self._back(c, tile, R)
                        return False
            return None
        # a free-standing piece hinges up from its lowest edge on a paper tab
        x = t - tile.t_in
        if x < 1.4:
            th = (math.pi / 2) * B.spring01(x, 1.5, 5.0)
            sy = max(0.0, math.sin(min(th, math.pi - 0.05)))
            if sy < 0.02:
                return False
            kx = 0.35 * math.cos(th)
            bx, by = self._foot(tile)
            c.translate(bx, by)
            c.skew(kx, 0.0)
            c.scale(1.0, sy)
            c.translate(-bx, -by)
        return None

    def _foot(self, tile):
        b = tile.board.bbox if tile.board.bbox is not None else None
        if b is None:
            xs = [s.bbox for s in tile.shapes]
            b = (min(x[0] for x in xs), min(x[1] for x in xs), max(x[2] for x in xs), max(x[3] for x in xs))
        return ((b[0] + b[2]) / 2, b[3] if tile.kind != 'sky' else (b[1] + b[3]) / 2)

    def _back(self, c, tile, R):
        """the panel's blank card back, as printed on the reverse of a map"""
        pts = [tile.P(0, 0), tile.P(1, 0), tile.P(1, 1), tile.P(0, 1)]
        R.poly(c, pts, fill=BACK, ink=INK, w=0.6)
        ins = [tile.P(0.07, 0.07), tile.P(0.93, 0.07), tile.P(0.93, 0.93), tile.P(0.07, 0.93)]
        R.poly(c, ins, fill=None, ink=mix(ACCENT, BACK, 0.45), w=0.9)
        ins2 = [tile.P(0.1, 0.1), tile.P(0.9, 0.1), tile.P(0.9, 0.9), tile.P(0.1, 0.9)]
        R.poly(c, ins2, fill=None, ink=mix(ACCENT, BACK, 0.65), w=0.4)
        # a printed compass star in the middle
        cx, cy = tile.P(0.5, 0.5)
        star = []
        for k in range(8):
            r = 9.0 if k % 2 == 0 else 2.6
            a = k * math.pi / 4
            star.append((cx + r * math.cos(a) * 1.4, cy + r * math.sin(a) * 0.7))
        R.poly(c, star, fill=mix(ACCENT, BACK, 0.35), ink=mix(INK, BACK, 0.3), w=0.35)

    # ---- pieces
    def arrive(self, g, tile, x, t, tl):
        role = g.role
        fx = g.fx
        if tile.name == 'pyramids':
            return self._life(g, tile, t, tl)
        o = self.opening(tile, t)
        if role == 'board':
            return 'done'
        if role == 'keel':
            # the rock under the slab is a pull-down flap: it drops once the panel lies flat
            k = B.clamp((t - tile.t_in - UNF * 0.92) / 0.45)
            if k <= 0:
                return None
            sy = ease.out_back(k, 1.6)
            b = g.bbox
            px, py = (b[0] + b[2]) / 2, b[1]
            return (px, py, 0.0, 0.0, 0.0, 1.0, max(0.01, sy), 0.0, None, 1.0)
        bx, by = fx['base']
        if role == 'struct' or (role == 'sky' and tile.hinge is not None):
            # V-fold linkage: rises with the page, nearest the crease first; a little paper spring at the top
            lag = 0.18 + 0.42 * fx['lag']
            k = B.clamp((o - lag) / (1.0 - lag))
            th = (math.pi / 2) * ease.smooth(k)
            land = tile.t_in + UNF
            if t > land:
                th += 0.16 * B.damped(t - land, 2.6, 5.0)
        else:
            # tabs (trees, people, boats, animals, sky bits): flick up after the panel lands, rippling outward
            t0 = tile.t_in + (UNF * 0.88 if tile.hinge is not None else 0.25) + 0.45 * fx['lag'] + 0.03 * (fx['ph'] % 1.0)
            xx = t - t0
            if xx <= 0:
                return None
            th = (math.pi / 2) * B.spring01(xx, 2.2, 6.5)
        if th <= 0.02:
            return None
        if th >= math.pi / 2 - 1e-3 and t > tile.t_in + UNF + 1.6:
            return self._life(g, tile, t, tl)
        sy = math.sin(min(th, math.pi - 0.05))
        kx = 0.55 * math.cos(th)
        return (bx, by, 0.0, 0.0, 0.0, 1.0, max(0.02, sy), kx, None, 1.0)

    def _life(self, g, tile, t, tl):
        """at rest the stand-ups are still paper: trees flutter, the balloon swings on its tab"""
        if g is self.balloon:
            ev = B.EVF / B.FPS
            f = (tl - (ev - 1.3)) / 3.0
            if 0 < f < 1.3:
                sw = 6.0 * math.sin(2 * math.pi * 0.62 * (tl - ev + 1.3)) * math.sin(math.pi * min(1.0, f)) ** 0.7
                px, py = g.pivot
                return (px, py - 9.0, 0.0, 0.0, sw, 1.0, 1.0, 0.0, None, 1.0)
            return 'done'
        if g.role == 'tree':
            bx, by = g.fx['base']
            return (bx, by, 0.0, 0.0, 1.6 * math.sin(tl * 1.9 + g.fx['ph']), 1.0, 1.0, 0.0, None, 1.0)
        return 'done'

    # ---- camera + page turn
    def cam(self, f):
        if f >= B.CUT:
            return B.close_cam(f)
        return B.build_cam(f / B.FPS, 5.9)

    def render(self, n):
        n0 = B.CUT - TURN
        if not (n0 <= n < B.CUT):
            return self.plain(n)
        A = self.plain(n)
        Bi = self.plain(n, cam=B.close_cam(B.CUT))
        return page_turn(A, Bi, (n - n0 + 0.5) / TURN)


def page_turn(A, Bi, k):
    """A (the outgoing page) turns over from the bottom-right corner, revealing Bi beneath"""
    import cv2
    h, w = A.shape[:2]
    u = ease.in_out(k, 2.2)
    ang = math.radians(32.0 - 16.0 * u)
    n = np.array([math.cos(ang), math.sin(ang)])
    C = np.array([w, h], float)
    span = abs(C @ n)
    d = (span + 40.0) * u
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    s = (xx - C[0]) * n[0] + (yy - C[1]) * n[1] + d          # > 0: lifted (revealed) side
    # reflection of every pixel across the fold
    rx = xx - 2 * s * n[0]
    ry = yy - 2 * s * n[1]
    inside = (rx >= 0) & (rx < w - 1) & (ry >= 0) & (ry < h - 1)
    flap = (s < 0) & inside
    out = A.astype(np.float32)
    rev = s >= 0
    Bf = Bi.astype(np.float32)
    shade_b = 1.0 - 0.30 * np.exp(-np.maximum(s, 0) / 38.0)
    out[rev] = (Bf * shade_b[:, :, None])[rev]
    # under the flap's far edge the outgoing page darkens a touch (the flap's shadow)
    show = cv2.remap(A, rx.astype(np.float32), ry.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    back = np.array(BACK, np.float32)
    dist = -s
    curl = 0.86 + 0.14 * (1 - np.exp(-dist / 70.0))
    hl = 1.0 + 0.10 * np.exp(-((dist - 10.0) / 12.0) ** 2)
    flapcol = (back[None, None, :] * 0.90 + show * 0.10) * (curl * hl)[:, :, None]
    out[flap] = flapcol[flap]
    # a thin pencil edge where the flap ends
    edge = flap & ~((rx >= 1.5) & (rx < w - 2.5) & (ry >= 1.5) & (ry < h - 2.5))
    out[edge] = out[edge] * 0.55
    # soft shadow of the flap on the page beneath it
    m = (~flap) & (~rev)
    if m.any():
        sx_ = xx + 14 * n[0]
        sy_ = yy + 14 * n[1]
        sh = (flap.astype(np.float32))
        sh = cv2.GaussianBlur(sh, (0, 0), 9)
        out[m] = (out * (1 - 0.22 * sh[:, :, None]))[m]
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)
