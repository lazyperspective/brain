"""Feel 4 - TIDE.  One ripple of reality spreads out from the Pyramids, like a drop of ink in water.

Build: a single wavefront leaves the Pyramids and rolls outward, slowing as it goes.  Nothing exists beyond
it - not even the pencil.  Exactly at the front the construction lines flash and vanish; just behind it the
ink traces; behind that the colour floods in (water pours, still with its foam); and things rise and pop
in its wake, each by its own nature, as the swell passes under them and lifts every slab a little.  Faint
echo rings follow.  The camera's pull-back is tied to the wave: it keeps the front in frame.
Life: the balloon's lift-off sends rings across the sand.  Transition: a ripple dissolve - the close-up
opens inside a refracting ring that spreads from the Pyramids.
"""
import math

import cv2
import numpy as np
import skia

from .. import ease
from ..core import Wave, ZS
from ..pal import PAPER, INK, WATER_D, FOAM, mix
from . import base as B

O = (0.0, 50.0)          # the Pyramids
SQ = 2.0                 # iso circles: half as tall as wide
T0, DUR, RMAX, KX = 0.25, 5.6, 620.0, 2.0
R0 = 92.0               # the wave leaves the Pyramids' own shore


def ring_r(t):
    p = (t - T0) / DUR
    if p <= 0:
        return 0.0
    if p >= 1:
        return RMAX
    return R0 * min(1.0, p / 0.02) + (RMAX - R0) * (1 - (1 - p) ** KX)


def ring_t(d):
    q = min(1.0, max(0.0, (d - R0) / (RMAX - R0)))
    return T0 + DUR * (1 - (1 - q) ** (1 / KX))


class RingWave(Wave):
    """the colour arrives a moment behind the front (lag seconds)"""
    def __init__(self, lag, foam=False, seed=0):
        super().__init__(O, 0.0, 1.0, RMAX, foam=foam, seed=seed, squash=SQ)
        self.lag = lag

    def radius(self, tau):
        r = ring_r(tau - self.lag)
        return 1e9 if r >= RMAX - 1e-6 else r

    def time_at(self, d):
        return ring_t(d) + self.lag


def dist(x, y):
    return math.hypot(x - O[0], (y - O[1]) * SQ)


LAG = {'slab': 0.02, 'ground': 0.10, 'mark': 0.22, 'struct': 0.16, 'detail': 0.30}


class Tide(B.Feel):
    name = 'tide'
    title = 'Tide'
    pitch = 'one ripple of reality rolls out from the Pyramids; the world forms in its wake'
    transition_frames = 0
    TR = 26

    def ready(self, name):
        t = self.w.tiles.get(name)
        if t is None:
            return None
        return 0.0 if name == 'pyramids' else ring_t(dist(*t.center) + 60.0) + 0.2

    def setup(self):
        w = self.w
        self.balloon = B.find_balloon(w)
        waves = {}

        def wave_for(sh):
            key = ('foam' if (sh.wave is not None and sh.wave.foam) else sh.stage in ('slab', 'ground', 'mark'))
            if key not in waves:
                lag = 0.16 if key == 'foam' else (0.12 if key is True else 0.34)
                waves[key] = RingWave(lag, foam=(key == 'foam'), seed=len(waves) + 3)
            return waves[key]

        for name, tile in w.tiles.items():
            pyr = name == 'pyramids'
            tile.placeholder = []
            if pyr:
                continue
            tile.start = 0.0
            tile.rate = 1.0
            sky = tile.kind == 'sky'
            for sh in tile.shapes:
                pts = np.vstack(sh.subs)
                dd = np.hypot(pts[:, 0] - O[0], (pts[:, 1] - O[1]) * SQ)
                dmin = float(dd.min())
                if sky:
                    dmin = 430.0 + 0.3 * dmin
                ta = ring_t(dmin)
                if sh.layer == 'pencil':
                    # the front flashes its construction lines and wipes them away
                    sh.tp = ta - 0.06
                    sh.dp = 0.16
                    sh.te = ta + 0.22
                    sh.de = 0.28
                    continue
                if sh.draw is not None:
                    sh.toff = ta - 0.25
                    fig = getattr(sh.draw, '__self__', None)
                    if type(fig).__name__ == 'Fig':
                        fig.t0 = ta + 0.45 + 0.1 * ((sh.cx * 0.13) % 1.0)
                        sh.toff = 0.0
                    continue
                if sh.instant:
                    continue
                if sh.tk is not None and sh.tk > -50:
                    sh.tk = ta + LAG.get(sh.stage, 0.2)
                    sh.dk = max(0.16, min(0.34, sh.length / 260.0))
                if sh.fill is not None:
                    wv = wave_for(sh)
                    sh.wave = wv
                    sh.wd0 = float(dd.min())
                    sh.wd1 = float(dd.max())
                    sh.tw1 = wv.time_at(sh.wd1)
            lagg = {'struct': 0.22, 'detail': 0.3, 'flora': 0.38, 'life': 0.55, 'sky': 0.5}
            for g in tile.groups:
                px, py = g.pivot
                d = dist(px, py) if not sky else 430.0 + 0.3 * dist(px, py)
                if g in tile.finale:
                    g.t0 = 5.95 + 0.0011 * d
                    continue
                if g in tile.finale2:
                    g.t0 = 99.0
                    continue
                if g.t0 is not None and g.kind is not None:
                    g.t0 = ring_t(d) + lagg.get(g.stage, 0.3)
                    g.dur *= 1.2
        w.under.append(self._under)

    # ---- the swell lifts each slab as the front passes beneath it
    def tile_begin(self, c, tile, t, tl, tau, sky, R):
        clip = None if tile.name == 'pyramids' else getattr(self, '_clip', None)
        R.pclip = R.gclip = clip
        if tile.name == 'pyramids' or tile.kind == 'sky':
            return None
        d = dist(*tile.center)
        R_ = ring_r(t)
        x = (R_ - d) / 90.0
        if -1.5 < x < 6:
            lift = -5.0 * math.exp(-x * x) + 2.2 * math.exp(-(x - 1.6) ** 2) * (1 if x > 0 else 0)
            c.translate(0.0, lift)
        return None

    def _ring(self, c, R, rad, t, w, col, a, wob=1.0):
        th = np.linspace(0, 2 * math.pi, 120, endpoint=False)
        r = rad * (1 + wob * (0.018 * np.sin(5 * th + t * 1.7) + 0.011 * np.sin(11 * th - t * 2.3 + 1.0)))
        x = O[0] + r * np.cos(th)
        y = O[1] + r * np.sin(th) / SQ
        p = skia.Path()
        p.addPoly([skia.Point(float(a_), float(b_)) for a_, b_ in zip(x, y)], True)
        R.stroke(c, p, col, w, a)

    def _under(self, c, t, R):
        """the ripple on the paper itself, between and beyond the slabs"""
        rad = ring_r(t)
        # pencil only exists inside the wave
        if 0 < rad < RMAX - 1:
            th = np.linspace(0, 2 * math.pi, 72, endpoint=False)
            r = rad + 6.0
            pc = skia.Path()
            pc.addPoly([skia.Point(float(O[0] + r * math.cos(q)), float(O[1] + r * math.sin(q) / SQ)) for q in th], True)
            self._clip = pc
        else:
            self._clip = None
        R.pclip = R.gclip = None
        if rad <= 2 or t > T0 + DUR + 0.6:
            return
        fade = 1.0 - B.clamp((t - (T0 + DUR - 1.4)) / 1.8)
        col = mix(WATER_D, INK, 0.25)
        self._ring(c, R, rad, t, 0.9, col, 0.55 * fade)
        self._ring(c, R, rad - 2.5, t + 0.4, 2.2, FOAM, 0.55 * fade)
        for k, (back, a) in enumerate(((34.0, 0.30), (74.0, 0.17), (122.0, 0.09))):
            if rad - back > 4:
                self._ring(c, R, rad - back, t + 1.3 * k, 0.6, col, a * fade, wob=1.4)

    def overlay(self, c, t, tl, R):
        rad = ring_r(t)
        if 2 < rad and t < T0 + DUR + 0.6:
            fade = 1.0 - B.clamp((t - (T0 + DUR - 1.4)) / 1.8)
            # a faint wet sheen at the front, over everything
            self._ring(c, R, rad, t, 3.0, (255, 255, 252), 0.22 * fade)
        # the balloon's lift-off rings out across the sand
        g = self.balloon
        ev = B.EVF / B.FPS
        bx, by = g.pivot
        gy = by + 0.36 * ZS - 1.0
        for k in range(4):
            x = (tl - (ev - 1.25 + 0.32 * k)) / 1.6
            if 0 < x < 1:
                rr = 4.0 + 26.0 * ease.out_cubic(x)
                a = 0.7 * (1 - x) ** 1.5
                th = np.linspace(0, 2 * math.pi, 48, endpoint=False)
                p = skia.Path()
                p.addPoly([skia.Point(float(bx + rr * math.cos(q)), float(gy + rr * math.sin(q) / SQ)) for q in th], True)
                R.stroke(c, p, mix(INK, PAPER, 0.25), 0.45, a)
                p2 = skia.Path()
                p2.addPoly([skia.Point(float(bx + (rr - 1.2) * math.cos(q)), float(gy + (rr - 1.2) * math.sin(q) / SQ)) for q in th], True)
                R.stroke(c, p2, (255, 252, 240), 0.7, a * 0.8)

    # ---- camera: the pull-back keeps the wavefront in frame
    def cam(self, f):
        if f >= B.CUT:
            return B.close_cam(f)
        t = f / B.FPS
        q = ring_r(t + 0.5) / RMAX
        e = ease.smooth(min(1.0, q * 1.08))
        cm = B.lerp_cam(B.CAM0, B.WIDE, e)
        n0 = B.CUT - self.TR
        if f > n0:
            # during the dissolve the wide drifts in towards the Pyramids
            u = ease.in_out((f - n0) / self.TR, 2.0)
            cm = B.lerp_cam(cm, (B.close_cam(B.CUT)[0], B.close_cam(B.CUT)[1], cm[2] * 1.35), u)
        return cm

    def render(self, n):
        n0 = B.CUT - self.TR
        if not (n0 <= n < B.CUT):
            return self.plain(n)
        A = self.plain(n)
        Bi = self.plain(n, cam=B.close_cam(B.CUT))
        return ripple_dissolve(A, Bi, (n - n0 + 0.5) / self.TR, n)


def ripple_dissolve(A, Bi, k, n):
    h, w = A.shape[:2]
    u = ease.in_out(k, 1.8)
    cx, cy = w * 0.5, h * 0.5
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = xx - cx, (yy - cy) * 1.6
    r = np.sqrt(dx * dx + dy * dy) + 1e-3
    th = np.arctan2(dy, dx)
    R_ = (math.hypot(cx, cy * 1.6) + 120) * u
    edge = R_ * (1 + 0.025 * np.sin(6 * th + n * 0.21) + 0.015 * np.sin(13 * th - n * 0.33))
    s = edge - r                                     # > 0 inside the ring
    # refraction: the incoming picture is pulled outward in a band just inside the rim
    band = np.exp(-((s - 18) / 26.0) ** 2) * (s > 0)
    off = 22.0 * band
    mx = (xx + dx / r * -off).astype(np.float32)
    my = (yy + dy / 1.6 / r * -off).astype(np.float32)
    Bw = cv2.remap(Bi, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    m = np.clip(s / 6.0 + 0.5, 0, 1)[:, :, None]
    out = A.astype(np.float32) * (1 - m) + Bw * m
    rim = np.exp(-(s / 3.2) ** 2)[:, :, None]
    out = out * (1 - 0.35 * rim) + np.array([60, 70, 80], np.float32) * 0.35 * rim
    sheen = (np.exp(-((s - 7) / 4.0) ** 2))[:, :, None]
    out = out * (1 - 0.45 * sheen) + 255 * 0.45 * sheen
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)
