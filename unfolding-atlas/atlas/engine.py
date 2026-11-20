"""Frame renderer: book + thin leaf + board + pop-up cards, painter-sorted, with cast shadows.

All pieces are planar textured cards drawn through exact plane->screen homographies, so
the vector/texture work of a style stays crisp while the mechanics stay truly 3D.
"""
import numpy as np
import cv2
import skia

from .geom import Camera, v3, norm, sk_matrix, tex_h, quad_h, ray_plane, smooth, ramp, ease_out, clamp01
from .book import leaf_surface, STACK_T, COVER_T, BOARD_T, COVER_M
from .timeline import state
from .styles.base import SAMPLING, rgb2sk
from .scene import W, H

UP = v3(0, 0, 1)


def shade_filter(rgb):
    r, g, b = [float(x) for x in rgb]
    return skia.ColorFilters.Matrix([r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0])


class Engine:
    def __init__(self, scene, style, out_w=1920, out_h=1080, ss=1.5):
        self.sc, self.sty = scene, style
        self.ow, self.oh, self.ss = out_w, out_h, ss
        self.w, self.h = int(out_w * ss), int(out_h * ss)
        self.mech = scene.mech
        self.Lp = np.asarray(style.light['pos'], float)
        self.amb = np.asarray(style.light['ambient'], float)
        self.key = np.asarray(style.light['key'], float)
        lam_up = max(0.0, float(np.dot(UP, norm(self.Lp - v3(0, 0.6, 0)))))
        self.ref = self.amb + self.key * lam_up
        self.cards = {cd.id: cd for cd in scene.cards}

    # ------------------------------------------------------------ helpers
    def shade(self, O, n):
        lam = max(0.0, float(np.dot(n, norm(self.Lp - O))))
        return np.clip((self.amb + self.key * lam) / self.ref, 0, 1.25), lam

    def camera(self, st):
        cm = st['cam']
        e, az = np.radians(cm['elev']), np.radians(cm['az'])
        tgt = np.asarray(cm['target'], float)
        eye = tgt + cm['dist'] * v3(np.sin(az) * np.cos(e), -np.cos(az) * np.cos(e), np.sin(e))
        return Camera(eye, tgt, cm['fov'], self.w, self.h)

    def quad(self, c, cam, img, O, ex, ey, wu, hu, paint=None, sampling=SAMPLING):
        """Draw img on the parallelogram O + a ex + b ey (a in 0..wu, b in 0..hu), image top = far side."""
        S = np.array([[wu / img.width(), 0, 0], [0, -hu / img.height(), hu], [0, 0, 1.0]])
        Hm = cam.plane_h(O, ex, ey) @ S
        c.save()
        c.concat(sk_matrix(Hm))
        c.drawImage(img, 0, 0, sampling, paint or skia.Paint(AntiAlias=True))
        c.restore()

    def poly_path(self, cam, pts):
        xy, _ = cam.project(np.asarray(pts))
        p = skia.Path()
        p.moveTo(float(xy[0, 0]), float(xy[0, 1]))
        for q in xy[1:]:
            p.lineTo(float(q[0]), float(q[1]))
        p.close()
        return p, xy

    def page(self, c, cam, name, O, ex, shade=None, extra=None, st=None):
        bk = self.sty.pages[name]
        Hm = cam.plane_h(O, ex, v3(0, 1, 0)) @ np.array([[1 / bk.tex, 0, 0], [0, -1 / bk.tex, H], [0, 0, 1.0]])
        M = sk_matrix(Hm)
        c.save()
        c.concat(M)
        multi = len(bk.plates) > 1
        if shade is not None or multi:
            lp = skia.Paint()
            if shade is not None:
                lp.setColorFilter(shade_filter(shade))
            c.saveLayer(skia.Rect.MakeWH(bk.w, bk.h), lp)
        self.draw_plates(c, bk, name, st or self._st, True)
        if extra:
            extra(c, bk)
        if shade is not None or multi:
            c.restore()
        c.restore()
        return Hm

    # ------------------------------------------------------------ shadows
    def shadow_h(self, cam, occ_frame, occ_bk, recv_O, recv_n, mode='key', soft=False):
        """Homography that paints the occluder's blurred silhouette onto the receiver plane.
        Returns (matrix, image, weight) or None."""
        O, eu, et, n = occ_frame
        img, stex, pad, shp = occ_bk.shadow_soft if soft else occ_bk.shadow
        hh, ww = shp
        u0, t1 = occ_bk.u0 - pad, occ_bk.t1 + pad
        uw, th_ = ww / stex, hh / stex
        corners_u = [(u0, t1), (u0 + uw, t1), (u0 + uw, t1 - th_), (u0, t1 - th_)]
        dst = []
        taus = []
        for (u, t) in corners_u:
            P = O + u * eu + t * et
            d = -recv_n if mode == 'ao' else norm(P - self.Lp)
            tau, den = ray_plane(P, d, recv_O, recv_n)
            if tau is None or abs(den) < 0.06:
                return None
            taus.append(tau)
            dst.append(P + tau * d)
        # use the body of the card (not the padded corners) to decide in front / behind
        Pc = O + 0.5 * (occ_bk.u0 * 2 + occ_bk.w / occ_bk.tex) * eu + 0.4 * occ_bk.t1 * et
        dc = -recv_n if mode == 'ao' else norm(Pc - self.Lp)
        tc, den = ray_plane(Pc, dc, recv_O, recv_n)
        if tc is None or tc < 0.004:
            return None
        if min(taus) < -0.35:
            return None
        xy, dep = cam.project(np.array(dst))
        if dep.min() < 0.2:
            return None
        src = [(0, 0), (ww, 0), (ww, hh), (0, hh)]
        try:
            Hs = quad_h(src, xy)
        except cv2.error:
            return None
        wgt = smooth(ramp(abs(den), 0.06, 0.3)) * smooth(ramp(tc, 0.004, 0.03))
        return Hs, img, wgt, tc

    def draw_shadows(self, c, cam, occluders, recv_O, recv_n, strength, bounds=None, clip_atop=True, ao=False):
        """occluders: list of (frame, baked). Draw combined soft shadows on the current target."""
        if strength <= 0.01:
            return
        lam = max(0.0, float(np.dot(recv_n, norm(self.Lp - recv_O))))
        kfac = smooth(ramp(lam, 0.02, 0.2))
        items = []
        for fr, bk in occluders:
            if kfac > 0:
                r = self.shadow_h(cam, fr, bk, recv_O, recv_n, 'key', soft=False)
                if r:
                    items.append((r[0], r[1], r[2] * kfac, r[3]))
            if ao:
                r = self.shadow_h(cam, fr, bk, recv_O, recv_n, 'ao', soft=True)
                if r and r[3] < 0.3:
                    items.append((r[0], r[1], 0.55 * r[2] * (1 - r[3] / 0.3), r[3]))
        if not items:
            return
        lp = skia.Paint(Alphaf=float(strength))
        if clip_atop:
            lp.setBlendMode(skia.BlendMode.kSrcATop)
        c.saveLayer(bounds, lp)
        col = self.sty.light['shadow']
        for Hs, img, wgt, _ in items:
            c.save()
            c.concat(sk_matrix(Hs))
            c.drawImage(img, 0, 0, skia.SamplingOptions(skia.FilterMode.kLinear), skia.Paint(Color4f=rgb2sk(col, wgt), AntiAlias=True))
            c.restore()
        c.restore()

    # ------------------------------------------------------------ pieces
    def card_bounds(self, cam, fr, bk):
        O, eu, et, n = fr
        pts = [O + (bk.u0 + a * bk.w / bk.tex) * eu + (bk.t1 - b * bk.h / bk.tex) * et for a in (0, 1) for b in (0, 1)]
        xy, _ = cam.project(np.array(pts))
        x0, y0 = xy.min(0) - 6
        x1, y1 = xy.max(0) + 6
        return skia.Rect.MakeLTRB(float(max(x0, 0)), float(max(y0, 0)), float(min(x1, self.w)), float(min(y1, self.h)))

    def draw_card(self, c, cam, cd, fr, st, occluders):
        sty = self.sty
        bk = sty.cards[cd.id]
        O, eu, et, n = fr
        front = cam.facing(O + eu * (bk.u0 + 0.5 * bk.w / bk.tex) + et * 0.3 * bk.t1, n) > 0
        Hm = tex_h(cam, O, eu, et, bk.u0, bk.t1, bk.tex)
        M = sk_matrix(Hm)
        if not front:
            sh, _ = self.shade(O, -n)
            c.save()
            c.concat(M)
            c.drawImage(bk.sil, 0, 0, SAMPLING, skia.Paint(AntiAlias=True, Color4f=rgb2sk(np.asarray(bk.back) * np.minimum(sh, 1.0))))
            c.restore()
            return
        sh, lam = self.shade(O, n)
        bounds = self.card_bounds(cam, fr, bk)
        if bounds.width() < 2 or bounds.height() < 2:
            return
        c.saveLayer(bounds, skia.Paint(ColorFilter=shade_filter(sh)))
        c.save()
        c.concat(M)
        self.draw_plates(c, bk, cd.id, st, True)
        sty.overlay(c, cd.id, bk, st, True)
        c.restore()
        L = sty.light
        self.draw_shadows(c, cam, occluders, O, n, L['shadow_a'], bounds, True, ao=L['ao_a'] > 0)
        c.restore()
        if any(not pl.lit for pl in bk.plates) or getattr(sty, 'has_unlit_overlay', False):
            c.save()
            c.concat(M)
            self.draw_plates(c, bk, cd.id, st, False)
            sty.overlay(c, cd.id, bk, st, False)
            c.restore()

    def draw_plates(self, c, bk, cid, st, lit):
        for pl in bk.plates:
            if pl.lit != lit:
                continue
            res = self.sty.plate_state(bk, pl, cid, st)
            a, dx, dy, mask = res[:4]
            img = res[4] if len(res) > 4 else pl.img       # optional per-frame replacement texture
            if a <= 0.003:
                continue
            p = skia.Paint(AntiAlias=True, Alphaf=float(min(a, 1.0)))
            if pl.blend is not None:
                p.setBlendMode(pl.blend)
            cp = self.sty.plate_paint(bk, pl, cid, st)
            if cp is not None:
                c.drawImage(img, dx, dy, skia.SamplingOptions(skia.FilterMode.kLinear), cp)
            elif mask is None:
                c.drawImage(img, dx, dy, SAMPLING, p)
            else:
                # reveal mask (low-res alpha image): draw the mask itself, coloured by the plate as a shader
                sx, sy = bk.w / mask.width(), bk.h / mask.height()
                lm = skia.Matrix()
                lm.setScale(1.0 / sx, 1.0 / sy)
                p.setShader(pl.img.makeShader(skia.TileMode.kClamp, skia.TileMode.kClamp, skia.SamplingOptions(skia.FilterMode.kLinear), lm))
                c.save()
                c.scale(sx, sy)
                c.drawImage(mask, 0, 0, skia.SamplingOptions(skia.FilterMode.kLinear), p)
                c.restore()

    def draw_tab(self, c, cam, cd, fr, sfr, back_shade):
        """Floor-parallel paper tabs tying a layer to the piece behind it."""
        O, eu, et, n = fr
        back = sfr['back']
        col = np.asarray(self.sty.tab_paper()) * np.minimum(back_shade, 1.0)
        for (u, t, wd) in cd.tabs:
            a = O + (u - wd / 2) * eu + t * et
            b = O + (u + wd / 2) * eu + t * et
            path, xy = self.poly_path(cam, [a, b, b + back * cd.tab_len, a + back * cd.tab_len])
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col)))
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col * 0.72, 0.6), Style=skia.Paint.kStroke_Style, StrokeWidth=1.2 * self.ss))

    def draw_leaf(self, c, cam, p):
        sty = self.sty
        V, N, ss, ys = leaf_surface(p, W, H, ns=56, ny=5, zoff=BOARD_T * (1 - smooth(p)))
        ny, ns = V.shape[0] - 1, V.shape[1] - 1
        xy, dep = cam.project(V.reshape(-1, 3))
        xy = xy.reshape(ny + 1, ns + 1, 2)
        # --- shadow on the spread
        Ld = norm(self.Lp - v3(0, 0.7, 0.3))
        shp = skia.Path()
        for i in range(ns):
            quad = [V[0, i], V[0, i + 1], V[ny, i + 1], V[ny, i]]
            pr = [q - Ld * (q[2] / Ld[2]) for q in quad]
            pth, _ = self.poly_path(cam, pr)
            shp.addPath(pth)
        shp.setFillType(skia.PathFillType.kWinding)
        zmean = float(V[..., 2].mean())
        clip, _ = self.poly_path(cam, [v3(-W, 0, 0), v3(W, 0, 0), v3(W, H, 0), v3(-W, H, 0)])
        c.save()
        c.clipPath(clip, True)
        sig = (6 + 60 * zmean) * self.ss
        lp = skia.Paint(Alphaf=float(sty.light['leaf_a'] * (0.55 + 0.45 * np.exp(-3 * zmean))), ImageFilter=skia.ImageFilters.Blur(sig, sig))
        c.saveLayer(None, lp)
        c.drawPath(shp, skia.Paint(AntiAlias=True, Color4f=rgb2sk(sty.light['shadow'])))
        c.restore()
        c.restore()
        # --- the sheet itself: small patches, each through its own homography, far to near
        rec, ver = sty.pages['map'].plates[0].img, sty.pages['verso'].plates[0].img
        tw, th = rec.width(), rec.height()
        dgrid = dep.reshape(ny + 1, ns + 1)
        patches = []
        for i in range(ns):
            for j in range(ny):
                d = 0.25 * (dgrid[j, i] + dgrid[j, i + 1] + dgrid[j + 1, i] + dgrid[j + 1, i + 1])
                patches.append((d, i, j))
        patches.sort(reverse=True)
        for d, i, j in patches:
            mid = 0.25 * (V[j, i] + V[j, i + 1] + V[j + 1, i] + V[j + 1, i + 1])
            nr = norm(N[j, i] + N[j, i + 1] + N[j + 1, i] + N[j + 1, i + 1])
            recto = float(np.dot(cam.eye - mid, nr)) > 0
            nn = nr if recto else -nr
            shd, lam = self.shade(mid, nn)
            back = max(0.0, float(np.dot(-nn, norm(self.Lp - mid))))   # a touch of translucency
            shd = np.clip(shd * (0.97 + 0.0 * lam) + 0.1 * back, 0, 1.1)
            s0, s1 = ss[i] / W, ss[i + 1] / W
            if not recto:
                s0, s1 = 1 - s0, 1 - s1
            x0, x1 = s0 * tw, s1 * tw
            y0, y1 = (1 - ys[j] / H) * th, (1 - ys[j + 1] / H) * th
            src = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            dst = np.array([xy[j, i], xy[j, i + 1], xy[j + 1, i + 1], xy[j + 1, i]])
            # skip slivers seen edge-on: their homography is degenerate
            area = 0.5 * abs(np.sum(dst[:, 0] * np.roll(dst[:, 1], -1) - np.roll(dst[:, 0], -1) * dst[:, 1]))
            long_ = max(np.linalg.norm(dst[3] - dst[0]), np.linalg.norm(dst[2] - dst[1]), 1e-6)
            if area / long_ < 0.9:
                p0, p1 = 0.5 * (dst[0] + dst[1]), 0.5 * (dst[2] + dst[3])
                c.drawLine(float(p0[0]), float(p0[1]), float(p1[0]), float(p1[1]),
                           skia.Paint(AntiAlias=True, StrokeWidth=max(area / long_, 0.6), Color4f=rgb2sk(np.asarray(sty.paper_rgb) * np.minimum(shd, 1.0) * 0.92)))
                continue
            Hq = quad_h(src, dst)
            r = skia.Rect.MakeLTRB(min(x0, x1) - 0.8, min(y0, y1) - 0.8, max(x0, x1) + 0.8, max(y0, y1) + 0.8)
            c.save()
            c.concat(sk_matrix(Hq))
            c.drawImageRect(rec if recto else ver, r, r, SAMPLING, skia.Paint(AntiAlias=False, ColorFilter=shade_filter(shd)))
            c.restore()
        # crisp edge of the sheet
        edge = skia.Path()
        ring = [xy[j, ns] for j in range(ny + 1)]
        edge.moveTo(*map(float, ring[0]))
        for q in ring[1:]:
            edge.lineTo(*map(float, q))
        c.drawPath(edge, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=1.0 * self.ss, Color4f=rgb2sk(np.asarray(sty.paper_rgb) * 0.8, 0.8)))

    def draw_board(self, c, cam, fr, st, verso_occluders, closed=False):
        """The stiff pop-up page. Returns nothing; draws edges + the visible face."""
        sty = self.sty
        pL, pn = fr['L']['p'], fr['L']['pn']
        nr = -pn
        Y = v3(0, 1, 0)
        Or = nr * BOARD_T
        vis_recto = cam.facing(Or + pL * 0.5 + Y * 0.7, nr) > 0
        ecol = np.asarray(sty.board_edge_rgb())
        # edges: near (y=0) and outer (a=W)
        for (a, b, cc, d, n_) in (
                (v3(0, 0, 0), pL * W, pL * W + Or, Or, v3(0, -1, 0)),
                (pL * W, pL * W + Y * H, pL * W + Y * H + Or, pL * W + Or, pL)):
            if cam.facing(a, n_) > 0:
                shd, _ = self.shade(a, n_)
                path, _ = self.poly_path(cam, [a, b, cc, d])
                c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(ecol * np.minimum(shd, 1) * 0.92)))
        if vis_recto:
            shd, _ = self.shade(Or + pL * 0.5 + Y * 0.7, nr)
            self.page(c, cam, 'plate', Or, pL, shd)
        else:
            O = pL * W
            shd, lam = self.shade(pL * 0.5 + Y * 0.6, pn)
            path, xy = self.poly_path(cam, [v3(0, 0, 0), pL * W, pL * W + Y * H, Y * H])
            self.page(c, cam, 'floorL', O, -pL, shd, extra=lambda cc_, bk: sty.overlay(cc_, 'floorL', bk, st, True))
            c.save()
            c.clipPath(path, True)
            self.draw_shadows(c, cam, verso_occluders, pL * 0.5 + Y * 0.5, pn, sty.light['floor_a'], None, False)
            c.restore()

    # ------------------------------------------------------------ living things
    def sprites(self, cam, st):
        """Free-flying things in world space -> list of (side, key, draw_fn)."""
        out = []
        m = self.mech
        life = self.sc.life
        if st['after'] < 0.0:
            return out

        def add(kind, item, P):
            xy, dep = cam.project(P)
            scale = float(np.linalg.norm(cam.project(P + cam.r)[0][0] - xy[0]))
            key = abs(P[0]) * m.ca + P[1] * m.sa
            out.append(('L' if P[0] < 0 else 'R', key, lambda c, kind=kind, item=item, xy=xy[0], scale=scale: self.sty.sprite(c, kind, item, xy, scale, st)))

        for (kind_, item_, P_) in getattr(self.sty, 'extra_sprites', lambda st_: [])(st):
            add(kind_, item_, P_)
        tb = st['birds_t']
        for bd in life['birds']:
            t = tb - bd['delay']
            if t <= 0:
                continue
            s = t * bd['speed']
            big = bd['kind'] == 'macaw'
            if not big:
                x = bd['start'][0] + 0.24 * s + 0.05 * np.sin(1.3 * s + bd['phase'])
                z = bd['start'][2] + (bd['hgt'] - bd['start'][2]) * ease_out(s / 2.6, 2.2) + 0.02 * np.sin(2.2 * s + bd['phase'])
                y = 0.742 - 0.532 * abs(x) + 0.02 * np.sin(0.9 * s + bd['phase'])
                flap = np.sin(2 * np.pi * 2.6 * t + bd['phase']) * (0.55 + 0.45 * np.sin(0.8 * t + bd['phase']) ** 2)
            else:
                x = bd['start'][0] - 0.2 * s + 0.03 * np.sin(1.1 * s)
                z = bd['start'][2] + 0.1 * ease_out(s / 2.5, 2) + 0.02 * np.sin(2 * s + bd['phase'])
                y = 0.47 - 0.532 * abs(x)
                flap = np.sin(2 * np.pi * 2.0 * t + bd['phase'])
            it = dict(bd, flap=float(flap), age=t, dir=-1 if big else 1)
            add(bd['kind'], it, v3(x, y, z))
        if st['mist'] > 0:
            for ms in life['mist']:
                P = ms['pos'] + v3(ms['drift'] * st['life_t'], 0, 0.012 * np.sin(0.6 * st['t'] + ms['phase']) + 0.015 * st['mist'])
                add('mist', dict(ms, a=st['mist'] * (0.75 + 0.25 * np.sin(0.5 * st['t'] + ms['phase']))), P)
        if st['life'] > 0:
            for fl in life['flies']:
                tt = st['t']
                P = fl['pos'] + v3(0.03 * np.sin(0.9 * tt + fl['phase']), 0.01 * np.sin(0.7 * tt + 2 * fl['phase']),
                                   0.025 * np.sin(1.3 * tt + fl['phase'] * 1.7))
                add('fly', dict(fl, a=st['life'], flap=np.sin(2 * np.pi * 4.5 * tt + fl['phase'])), P)
        return out

    # ------------------------------------------------------------ the frame
    def render(self, t):
        sty, sc, m = self.sty, self.sc, self.mech
        st = state(t, sty.anim, sc)
        cam = self.camera(st)
        st['cam_obj'] = cam
        self._st = st
        st['ss'] = self.ss
        surface = skia.Surface(self.w, self.h)
        c = surface.getCanvas()
        c.clear(skia.Color4f(*[float(x) for x in sty.table_rgb], 1.0))
        X, Y = v3(1, 0, 0), v3(0, 1, 0)

        # table
        img, tex, (tx0, ty1) = sty.img['table']
        self.quad(c, cam, img, v3(tx0, ty1 - img.height() / tex, -STACK_T - COVER_T), X, Y, img.width() / tex, img.height() / tex)
        # cover (top face + near edge)
        cimg, ctex, cw, ch = sty.img['cover']
        zc = -STACK_T
        path, _ = self.poly_path(cam, [v3(-cw / 2, -COVER_M, zc), v3(cw / 2, -COVER_M, zc), v3(cw / 2, -COVER_M, zc - COVER_T), v3(-cw / 2, -COVER_M, zc - COVER_T)])
        c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(np.asarray(sty.cover_rgb) * 0.55)))
        self.quad(c, cam, cimg, v3(-cw / 2, -COVER_M, zc), X, Y, cw, ch)
        # page blocks: near faces
        eimg = sty.img['edge']
        for x0 in (-W, 0.0):
            S = np.array([[W / eimg.width(), 0, 0], [0, -STACK_T / eimg.height(), STACK_T], [0, 0, 1.0]])
            Hm = cam.plane_h(v3(x0, 0, -STACK_T), X, UP) @ S
            c.save(); c.concat(sk_matrix(Hm)); c.drawImage(eimg, 0, 0, SAMPLING, skia.Paint(AntiAlias=True)); c.restore()
        # a soft dark line where the two blocks meet the cover at the spine
        gp, _ = self.poly_path(cam, [v3(-0.004, 0, 0), v3(0.004, 0, 0), v3(0.004, 0, -STACK_T), v3(-0.004, 0, -STACK_T)])
        c.drawPath(gp, skia.Paint(AntiAlias=True, Color4f=rgb2sk((0.1, 0.08, 0.07), 0.55)))

        theta, p = st['theta'], st['leaf']
        fr = m.solve(theta)
        # left page under everything
        self.page(c, cam, 'legend', v3(-W, 0, 0), X)

        if theta <= 1e-6:
            self.pull_tab(c, cam, st)
            self.draw_board(c, cam, fr, st, [])
            if p <= 0:
                self.page(c, cam, 'map', v3(0, 0, BOARD_T + 0.0005), X)
            elif p >= 1:
                self.page(c, cam, 'verso', v3(-W, 0, 0.0005), X)
            else:
                self.draw_leaf(c, cam, p)
        else:
            self.page(c, cam, 'verso', v3(-W, 0, 0.0005), X)
            self.draw_open(c, cam, fr, st)

        img = surface.makeImageSnapshot().toarray()[..., :3]
        out = cv2.resize(img, (self.ow, self.oh), interpolation=cv2.INTER_AREA) if self.ss != 1 else img
        out = sty.post(out.astype(np.float32) / 255.0, st)
        return np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8)

    def draw_open(self, c, cam, fr, st):
        sty, sc, m = self.sty, self.sc, self.mech
        X, Y = v3(1, 0, 0), v3(0, 1, 0)
        theta = st['theta']
        # canoe slider position
        cn = self.cards['canoe']
        cp = np.array(sc.life['canoe_path'])
        f = st['canoe'] * (len(cp) - 1)
        k = min(int(f), len(cp) - 2)
        cn.a0, cn.y0 = (cp[k] * (1 - (f - k)) + cp[k + 1] * (f - k)).tolist()

        frames = {cd.id: m.card_frame(fr, cd, st['lean'].get(cd.id, 0.0)) for cd in sc.cards}
        occ = {s: [(frames[cd.id], sty.cards[cd.id]) for cd in sc.cards if cd.side == s] for s in 'LR'}
        # the board itself shadows the right floor while it is in the air
        board_occ = self.board_occluder(fr)

        # right floor
        shd, _ = self.shade(v3(0.5, 0.6, 0), UP)
        self.page(c, cam, 'floorR', v3(0, 0, 0), X, None, extra=lambda cc_, bk: sty.overlay(cc_, 'floorR', bk, st, True))
        clip, _ = self.poly_path(cam, [v3(0, 0, 0), v3(W, 0, 0), v3(W, H, 0), v3(0, H, 0)])
        c.save()
        c.clipPath(clip, True)
        self.draw_shadows(c, cam, occ['R'] + occ['L'] + board_occ, v3(0.5, 0.5, 0), UP, sty.light['floor_a'], None, False)
        c.restore()
        self.pull_tab(c, cam, st)

        is_open = theta > np.pi - np.radians(0.6)
        spr = self.sprites(cam, st)

        def items(side):
            its = []
            sfr = fr[side]
            for cd in sc.cards:
                if cd.side != side:
                    continue
                k_ = m.key(cd)
                frm = frames[cd.id]
                others = [(frames[o.id], sty.cards[o.id]) for o in sc.cards if o.side == side and o.id != cd.id and abs(m.key(o) - k_) < 0.3]
                its.append((k_, 1, lambda cd=cd, frm=frm, others=others: self.draw_card(c, cam, cd, frm, st, others)))
                if cd.tabs:
                    bs, _ = self.shade(frm[0], sfr['pn'])
                    its.append((k_ + 1e-4, 0, lambda cd=cd, frm=frm, sfr=sfr, bs=bs: self.draw_tab(c, cam, cd, frm, sfr, bs)))
            for (sd, k_, fn) in spr:
                if sd == side:
                    its.append((k_, 2, lambda fn=fn: fn(c)))
            return its

        def run(its, reverse=False):
            for it in sorted(its, key=lambda a: (-a[0], a[1]) if not reverse else (a[0], -a[1])):
                it[2]()

        if is_open:
            self.draw_board(c, cam, fr, st, occ['L'] + occ['R'])
            run(items('R') + items('L'))
        else:
            # right half first; the turning board and its pieces are nearer to the camera
            nR = fr['R']['n']
            run(items('R'), reverse=cam.facing(v3(0.3, 0.5, 0.1), nR) < 0)
            pn = fr['L']['pn']
            sees_verso = cam.facing(fr['L']['p'] * 0.5 + Y * 0.7, pn) > 0
            nL = fr['L']['n']
            rev = cam.facing(fr['L']['p'] * 0.3 + Y * 0.5, nL) < 0
            if sees_verso:
                self.draw_board(c, cam, fr, st, occ['L'])
                run(items('L'), reverse=rev)
            else:
                run(items('L'), reverse=rev)
                self.draw_board(c, cam, fr, st, occ['L'])

    def pull_tab(self, c, cam, st):
        """Paper tab of the canoe slider, poking out from under the right page."""
        timg, tw, th_ = self.sty.img['tab']
        ty = -0.012 - 0.05 * st['canoe']
        self.quad(c, cam, timg, v3(0.66, ty - 0.06, 0.001), v3(1, 0, 0), v3(0, 1, 0), 0.1, 0.11)

    def board_occluder(self, fr):
        """Treat the flying board as a shadow caster for the right floor."""
        bk = getattr(self, '_board_bk', None)
        if bk is None:
            from .styles.base import Baked
            tex = 200
            bk = Baked(int(W * tex), int(H * tex), 0.0, H, tex)
            bk.set_alpha(np.ones((bk.h, bk.w), np.float32), 0.02, 0.05)
            self._board_bk = bk
        pL = fr['L']['p']
        return [((v3(0, 0, 0), pL, v3(0, 1, 0), fr['L']['pn']), bk)]
