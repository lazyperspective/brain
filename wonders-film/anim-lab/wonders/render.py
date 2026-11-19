"""Renderer: draws any part of the world, at any zoom, at any time.

frame(t, cam) -> HxWx3 uint8.  cam = (map_x, map_y, zoom) where zoom is
output px per map px.  Supersampled with Skia, then grained with a paper
texture that is anchored to the map (so it travels with the camera).
"""
import math

import cv2
import numpy as np
import skia

from . import ease
from .core import argb
from .pal import PAPER, PENCIL, mix, shade, vivid

SETTLE = 0.34      # seconds for a wash to settle into its flat colour


TOOTH = 0.034      # strength of the pigment texture on coloured surfaces (0 = flat fills, as before)


class Paper:
    """Tileable paper grain + dry-brush flecks, in map space."""
    N = 2048

    def __init__(self, seed=7, tpx=2.6):
        self.TPX = tpx     # texture px per map px
        rng = np.random.default_rng(seed)
        n = self.N

        fy = np.fft.fftfreq(n)[:, None]
        fx = np.fft.rfftfreq(n)[None, :]

        def blur(a, sx, sy=None):
            sy = sx if sy is None else sy
            k = np.exp(-2 * (np.pi ** 2) * ((sx * fx) ** 2 + (sy * fy) ** 2))
            return np.fft.irfft2(np.fft.rfft2(a) * k, s=(n, n)).astype(np.float32)

        def noise(sx, sy=None):
            a = blur(rng.standard_normal((n, n)).astype(np.float32), sx, sy)
            return a / a.std()

        mott = 0.55 * noise(26) + 0.45 * noise(7) + 0.35 * noise(1.6) + 0.30 * noise(0.7)
        self.mottle = (mott * 0.0105).astype(np.float32)          # multiplicative luminance
        # dry-brush flecks: slightly elongated, like bristle marks
        fl = noise(1.3, 0.6) * 0.9 + noise(2.6, 1.3) * 0.5
        fl = fl / fl.std()
        fleck = np.clip((fl - 1.7) * 1.5, 0, 1)
        self.fleck = blur(fleck, 0.6).astype(np.float32)
        # pigment tooth: fine grain + soft crayon drag, felt only on coloured surfaces (not on bare paper or ink)
        tooth = 0.62 * noise(0.75) + 0.45 * noise(2.4, 0.7) + 0.25 * noise(6.0)
        self.tooth = (tooth / tooth.std() * TOOTH).astype(np.float32)
        self.paper = np.array(PAPER, np.float32)

    def apply(self, img, cam, size):
        w, h = size
        cx, cy, zoom = cam
        s = self.TPX / zoom
        M = np.array([[s, 0, (cx - w / 2 / zoom) * self.TPX + 4096],
                      [0, s, (cy - h / 2 / zoom) * self.TPX + 4096]], np.float32)
        flags = cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP
        mo = cv2.warpAffine(self.mottle, M, (w, h), flags=flags, borderMode=cv2.BORDER_WRAP)
        fk = cv2.warpAffine(self.fleck, M, (w, h), flags=flags, borderMode=cv2.BORDER_WRAP)
        f = img.astype(np.float32)
        f += (self.paper - f) * (fk * 0.42)[:, :, None]
        if TOOTH > 0:
            th = cv2.warpAffine(self.tooth, M, (w, h), flags=flags, borderMode=cv2.BORDER_WRAP)
            chroma = f.max(2) - f.min(2)
            m = np.clip((chroma - 14.0) / 36.0, 0.0, 1.0) * np.clip((f.mean(2) - 50.0) / 60.0, 0.0, 1.0)
            mo = mo + th * m
        f *= (1.0 + mo)[:, :, None]
        return np.clip(f + 0.5, 0, 255).astype(np.uint8)


class Renderer:
    INK_SCALE = 0.86

    def __init__(self, world, size=(1920, 1080), ss=2, grain=True, tpx=2.6):
        self.world = world
        self.size = size
        self.ss = ss
        self.surface = skia.Surface(size[0] * ss, size[1] * ss)
        self.paper = Paper(tpx=tpx) if grain else None
        self.pf = skia.Paint(AntiAlias=True, Style=skia.Paint.kFill_Style)
        self.ps = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style,
                             StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join)
        self.pt = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style,
                             StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join)
        self._blob = {}
        self._papers = {}
        if self.paper is not None:
            self._papers[tpx] = self.paper
        self.view = None
        self.feel = None        # anim-lab: the animation feel driving arrivals / transforms (None = the film as is)
        self.tl = 0.0           # life clock (the build clock is the t passed to frame)
        self.nocull = False
        self.pclip = None       # anim-lab: optional clip (map space) for pencil lines
        self.gclip = None       # anim-lab: optional clip for loose ground-level shapes (slab / ground / mark)

    # -- helpers usable by custom draw callbacks
    def fill(self, c, path, col, a=1.0):
        self.pf.setColor(argb(col, a))
        c.drawPath(path, self.pf)

    def stroke(self, c, path, col, w, a=1.0, trim=None):
        p = self.ps
        if trim is not None:
            if trim[1] - trim[0] <= 1e-4:
                return
            fx = skia.TrimPathEffect.Make(max(0.0, trim[0]), min(1.0, trim[1]))
            if fx is not None:
                p = self.pt
                p.setPathEffect(fx)
        p.setColor(argb(col, a))
        p.setStrokeWidth(w * self.INK_SCALE)
        c.drawPath(path, p)

    def poly(self, c, pts, fill=None, ink=None, w=0.4, a=1.0, closed=True):
        path = skia.Path()
        path.addPoly([skia.Point(float(x), float(y)) for x, y in pts], closed)
        if fill is not None:
            self.fill(c, path, vivid(fill), a)
        if ink is not None:
            self.stroke(c, path, vivid(ink), w, a)

    # -- one shape
    def _shape(self, c, sh, tau, t, ga):
        if sh.draw is not None:
            if self.gclip is not None and sh.stage in ('slab', 'ground', 'mark') and sh.group is None:
                c.save()
                c.clipPath(self.gclip, skia.ClipOp.kIntersect, True)
                sh.draw(c, tau - sh.toff, t, ga, self)
                c.restore()
                return
            sh.draw(c, tau - sh.toff, t, ga, self)
            return
        if sh.clip is not None:
            c.save()
            c.clipPath(sh.clip, skia.ClipOp.kIntersect, True)
            self._shape2(c, sh, tau, t, ga)
            c.restore()
            return
        self._shape2(c, sh, tau, t, ga)

    def _shape2(self, c, sh, tau, t, ga):
        a = ga * sh.alpha
        if sh.layer == 'pencil':
            pd = (tau - sh.tp) / sh.dp
            if pd <= 0:
                return
            pe = (tau - sh.te) / sh.de
            if pe >= 1:
                return
            if self.pclip is not None:
                c.save()
                c.clipPath(self.pclip, skia.ClipOp.kIntersect, True)
                try:
                    self._pencil(c, sh, tau, a, pd, pe)
                finally:
                    c.restore()
                return
            self._pencil(c, sh, tau, a, pd, pe)
            return
        if self.gclip is not None and sh.stage in ('slab', 'ground', 'mark') and sh.group is None:
            c.save()
            c.clipPath(self.gclip, skia.ClipOp.kIntersect, True)
            try:
                self._body(c, sh, tau, t, a)
            finally:
                c.restore()
            return
        self._body(c, sh, tau, t, a)

    def _pencil(self, c, sh, tau, a, pd, pe):
        if True:
            e1 = ease.out_cubic(pd)
            e0 = ease.in_out(pe, 2.0) if pe > 0 else 0.0
            al = 0.86 * (1 - 0.5 * max(0.0, pe))
            tr = None if (e1 >= 1 and e0 <= 0) else (e0, max(e0 + 1e-3, e1))
            self.stroke(c, sh.path, sh.inkc, sh.ink, al * a, tr)
            if sh.path2 is not None:
                # the second pass trails the first a moment behind, as a hand would
                e2 = ease.out_cubic(max(0.0, (tau - sh.tp - 0.05) / sh.dp))
                if e2 > e0:
                    self.stroke(c, sh.path2, sh.inkc, sh.ink * 0.7, al * 0.42 * a, (e0, max(e0 + 1e-3, e2)))
            else:
                c.save()
                c.translate(0.45, 0.3)
                self.stroke(c, sh.path, sh.inkc, sh.ink * 0.8, al * 0.38 * a, tr)
                c.restore()
            return

    def _body(self, c, sh, tau, t, a):
        if sh.fill is not None:
            if sh.instant or tau >= sh.tw1 + SETTLE:
                self.fill(c, sh.path, sh.fill, a)
            else:
                wv = sh.wave
                R = wv.radius(tau)
                if sh.under is not None and R < sh.wd1:
                    self.fill(c, sh.path, sh.under, a)
                if R > sh.wd0:
                    wet = mix(sh.fill, PAPER, 0.42)
                    if R >= sh.wd1:
                        k = ease.smooth((tau - sh.tw1) / SETTLE)
                        self.fill(c, sh.path, mix(wet, sh.fill, k), a)
                    else:
                        key = (id(wv), 0)
                        b = self._blob.get(key)
                        if b is None:
                            b = wv.blob(R, tau)
                            b2 = wv.blob(R, tau, 0.80)
                            self._blob[key] = b
                            self._blob[(id(wv), 1)] = b2
                        b2 = self._blob[(id(wv), 1)]
                        c.save()
                        c.clipPath(sh.path, skia.ClipOp.kIntersect, True)
                        # leading watery tint, pigment following behind it
                        self.fill(c, b, wet, a)
                        self.fill(c, b2, mix(wet, sh.fill, 0.55), a)
                        if wv.foam:
                            self.stroke(c, b, (252, 252, 250), 2.2, 0.9 * a)
                        else:
                            self.stroke(c, b, shade(sh.fill, 0.86), 1.1, 0.55 * a)
                        c.restore()
        if sh.ink > 0:
            if sh.instant:
                self.stroke(c, sh.path, sh.inkc, sh.ink, a)
            else:
                p = (tau - sh.tk) / sh.dk
                if p >= 1:
                    self.stroke(c, sh.path, sh.inkc, sh.ink, a)
                elif p > 0:
                    self.stroke(c, sh.path, sh.inkc, sh.ink, a, (0.0, max(1e-3, ease.out_cubic(p))))

    def _tile(self, c, tile, t, sky):
        tau = (t - tile.start) * tile.rate
        F = self.feel
        if F is not None:
            tau = F.tile_tau(tile, t, tau)
        c.save()
        try:
            if tile.bob is not None:
                amp, per, ph = tile.bob
                c.translate(0.0, amp * math.sin(2 * math.pi * self.tl / per + ph))
            if F is not None and F.tile_begin(c, tile, t, self.tl, tau, sky, self) is False:
                return
            self._tile2(c, tile, t, sky, tau)
            if F is not None:
                F.tile_end(c, tile, t, self.tl, tau, sky, self)
        finally:
            c.restore()

    def _tile2(self, c, tile, t, sky, tau):
        vb = self.view
        F = self.feel
        tl = self.tl
        if not sky:
            for sh in tile.placeholder:
                self._shape(c, sh, tau, tl, 1.0)
        if tau <= 0:
            return
        cur = None
        saved = False
        hidden = False
        band = None
        ga = 1.0
        for sh in (tile.sky_shapes if sky else tile.ground_shapes):
            g = sh.group
            if g is not cur:
                if band is not None:
                    self._band(c, band)
                    band = None
                if saved:
                    c.restore()
                    saved = False
                cur = g
                hidden = False
                ga = 1.0
                if g is not None:
                    gb = g.bbox
                    rc = g.reach
                    if gb is not None and not self.nocull and (gb[2] + rc < vb[0] or gb[0] - rc > vb[2] or gb[3] + rc < vb[1] or gb[1] - rc > vb[3]):
                        hidden = True
                        continue
                    st = F.gstate(g, tile, tau, t, tl) if F is not None else g.state(tau, tl)
                    if st is None:
                        hidden = True
                    else:
                        dx, dy, rot, sx, sy, ga, wipe = st[:7]
                        pre = st[7] if len(st) > 7 else None
                        if pre is not None:
                            # anim-lab: an outer arrival transform about its own pivot (px, py, dx, dy, rot, sx, sy, kx[, clip])
                            c.save()
                            saved = True
                            qx, qy, qdx, qdy, qrot, qsx, qsy, qkx = pre[:8]
                            c.translate(qx + qdx, qy + qdy)
                            if qrot:
                                c.rotate(qrot)
                            if qkx:
                                c.skew(qkx, 0.0)
                            if qsx != 1.0 or qsy != 1.0:
                                c.scale(qsx, qsy)
                            c.translate(-qx, -qy)
                            if len(pre) > 8 and pre[8] is not None:
                                c.clipPath(pre[8], skia.ClipOp.kIntersect, True)
                            if len(pre) > 10 and pre[10] is not None:
                                # anim-lab: draw the piece into a layer, then tint a band of it (SrcATop) at group end
                                band = pre[10]
                                c.saveLayer(band[0], None)
                        if dx or dy or rot or sx != 1.0 or sy != 1.0 or wipe is not None:
                            if not saved:
                                c.save()
                            saved = True
                            px, py = g.pivot
                            c.translate(px + dx, py + dy)
                            if rot:
                                c.rotate(rot)
                            if sx != 1.0 or sy != 1.0:
                                c.scale(sx, sy)
                            c.translate(-px, -py)
                            if wipe is not None and g.bbox is not None:
                                # snow settles behind a ragged, drifting edge - never a ruled line
                                x0, y0, x1, y1 = g.bbox
                                yc = y0 - 3 + (y1 - y0 + 9) * wipe
                                n = max(6, int((x1 - x0 + 4) / 2.2))
                                pts = [skia.Point(x0 - 3, y0 - 6), skia.Point(x1 + 3, y0 - 6)]
                                for k in range(n, -1, -1):
                                    xx = x0 - 3 + (x1 - x0 + 6) * k / n
                                    zz = math.sin(k * 2.399 + g.seed) * 2.2 + math.sin(k * 0.71 + g.seed * 1.7 + tau * 5.0) * 1.5
                                    pts.append(skia.Point(xx, yc + zz * (1.25 - wipe)))
                                cp = skia.Path()
                                cp.addPoly(pts, True)
                                c.clipPath(cp, skia.ClipOp.kIntersect, True)
            if hidden:
                continue
            b = sh.bbox
            if g is None and not self.nocull and (b[2] < vb[0] or b[0] > vb[2] or b[3] < vb[1] or b[1] > vb[3]):
                continue
            self._shape(c, sh, tau, tl, ga)
        if band is not None:
            self._band(c, band)
        if saved:
            c.restore()

    def _band(self, c, band):
        """band = (layer bounds Rect, [(Rect, rgb, alpha), ...]): tint parts of what was just drawn, then close the layer"""
        for rect, col, al in band[1]:
            p = skia.Paint(AntiAlias=True, Color=argb(col, al), BlendMode=skia.BlendMode.kSrcATop)
            if isinstance(rect, skia.Path):
                c.drawPath(rect, p)
            else:
                c.drawRect(rect, p)
        c.restore()

    def set_grain(self, zoom):
        """Paper grain is generated at a density that suits the zoom of the shot."""
        tpx = 2.6 if zoom < 4.0 else 5.8
        if self.paper is not None and abs(self.paper.TPX - tpx) > 1e-6:
            self.paper = self._papers.setdefault(tpx, None) or Paper(tpx=tpx)
            self._papers[tpx] = self.paper

    def frame(self, t, cam, tl=None, paper=True):
        self.tl = t if tl is None else tl
        w, h = self.size
        ss = self.ss
        cx, cy, zoom = cam
        if self.paper is not None:
            self.set_grain(zoom)
        c = self.surface.getCanvas()
        c.resetMatrix()
        c.clear(argb(PAPER))
        c.translate(w * ss / 2, h * ss / 2)
        c.scale(zoom * ss, zoom * ss)
        c.translate(-cx, -cy)
        m = 40.0
        self.view = (cx - w / 2 / zoom - m, cy - h / 2 / zoom - m, cx + w / 2 / zoom + m, cy + h / 2 / zoom + m)
        self._blob.clear()
        for hook in self.world.under:
            hook(c, t, self)
        order = self.world.order
        if self.feel is not None:
            order = self.feel.tile_order(t, order) or order
        for tile in order:
            self._tile(c, tile, t, False)
        for tile in order:
            self._tile(c, tile, t, True)
        if self.feel is not None:
            self.feel.overlay(c, t, self.tl, self)
        img = self.surface.toarray(colorType=skia.kRGBA_8888_ColorType)[:, :, :3]
        if ss != 1:
            img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
        if self.feel is not None:
            img = self.feel.pre_paper(img, t, cam, self)
        if self.paper is not None and paper:
            img = self.paper.apply(img, cam, (w, h))
        return np.ascontiguousarray(img)
