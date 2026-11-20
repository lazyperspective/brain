"""Option 1 - LAMPLIT PAPER THEATRE.

Cut-paper diorama under one warm desk lamp: every shape is its own sheet of dyed, fibred
paper stacked on the one below (soft contact shadow, lit cut edge), long soft cast shadows,
a dark walnut table falling away into vignette.  Motion: springy, soft overshoot, paper wobble.
"""
import numpy as np
import cv2
import skia

from .base import Style, Plate, Baked, surf, snap, to_image, rgb2sk, shift, fbm, grain, fibres, hex2rgb, mix
from ..scene import W, H


class Lamplit(Style):
    name = 'lamplit'
    title = 'Lamplit Paper Theatre'
    palette = dict(Style.palette,
                   disc='#FFC94D', disc_ring='#FFE08A', disc_mark='#F2A93B',
                   peak_far='#7FA4F0', peak_hi='#A9C6FF', peak_mid='#3D6FD9', peak_mid_hi='#5E8FF0', cloud='#FFF4E2',
                   water='#12B5D6', water_lt='#C8F4F6', water_dp='#0A8EC2', foam='#FFFFFF',
                   canopy_a='#0C6A4C', canopy_b='#17A05A', canopy_c='#A5DB3F', canopy_d='#127A80', canopy_d2='#1FA69A', canopy_d3='#7CD9B4',
                   cliff='#D9623F', cliff_lt='#F58C57', cliff_dk='#A63F3A', stone='#F0B85C', stone_lt='#FFDD8C', stone_dk='#C7823F',
                   ground='#D8EBA0', bank='#86CC5E', sand='#F6E3A0', flower_a='#FF4A6B', flower_c='#A557F5')
    paper_rgb = (0.975, 0.94, 0.85)
    back_rgb = (0.95, 0.91, 0.82)
    ink_rgb = (0.2, 0.13, 0.12)
    cover_rgb = (0.07, 0.3, 0.33)
    table_rgb = (0.27, 0.16, 0.1)
    edge_rgb = (0.96, 0.9, 0.78)
    light = dict(pos=(-2.7, -2.5, 2.0), ambient=(0.60, 0.62, 0.74), key=(0.62, 0.55, 0.42), shadow=(0.16, 0.07, 0.2),
                 shadow_a=0.5, ao_a=0.25, floor_a=0.46, leaf_a=0.5)
    anim = dict(Style.anim, spring_f=2.3, spring_d=3.9, lean=17.0, lean_v=4.0, stagger=1.15, wobble=0.75, open=2.5, bounce=1.3)

    # ---------------------------------------------------------------- medium
    def fill(self, c, path, sh, ctx):
        tex = ctx['tex']
        k = 0.55 if ctx['kind'] == 'page' else 1.0
        small = 'small' in sh.tags
        col = self.col(sh.role, sh.tone)
        if not small:
            sp = skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.13, 0.05, 0.14, 0.42 * (0.8 if k < 1 else 1)),
                            MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 0.003 * tex * k), BlendMode=skia.BlendMode.kSrcATop)
            c.save()
            c.translate(0.0026 * tex * k, 0.0034 * tex * k)
            c.drawPath(path, sp)
            c.restore()
        c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col)))
        if small:
            return
        c.save()
        c.clipPath(path, True)
        d = 0.0016 * tex
        hl = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.003 * tex, Color4f=skia.Color4f(1, 0.98, 0.9, 0.34))
        c.save(); c.translate(d, d); c.drawPath(path, hl); c.restore()
        dk = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0036 * tex, Color4f=rgb2sk(shift(col, -1, 0.3), 0.4))
        c.save(); c.translate(-d, -d); c.drawPath(path, dk); c.restore()
        c.restore()

    def line(self, c, path, sh, ctx):
        tex = ctx['tex']
        if 'detail' in sh.tags or 'contour' in sh.tags or 'label' in sh.tags or 'frame' in sh.tags or 'textbar' in sh.tags or 'slot' in sh.tags:
            base = self.col(sh.role, 0)
            col = self.ink_rgb if sh.role == 'ink' else shift(base, -1, 0.34)
            a = 0.5 if 'textbar' in sh.tags else 0.85
            c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * tex, 1.2),
                                        StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(col, a)))
            return
        col = self.col(sh.role, sh.tone)
        wd = max(sh.w * tex, 1.5)
        sp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wd, StrokeCap=skia.Paint.kRound_Cap,
                        Color4f=skia.Color4f(0.13, 0.05, 0.14, 0.35), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 0.002 * tex),
                        BlendMode=skia.BlendMode.kSrcATop)
        c.save(); c.translate(0.002 * tex, 0.0026 * tex); c.drawPath(path, sp); c.restore()
        c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wd, StrokeCap=skia.Paint.kRound_Cap,
                                    StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(col)))

    def fibre_finish(self, arr, seed, strength=1.0):
        h, w = arr.shape[:2]
        n = fbm(h, w, 90, 3, seed)
        g = grain(h, w, seed + 1, 0.8)
        fb = fibres(h, w, int(h * w / 5200), seed + 2, 34, width=1.1)
        fd = fibres(h, w, int(h * w / 9000), seed + 3, 26, width=1.0)
        a = arr[..., 3:4]
        rgb = arr[..., :3]
        rgb = rgb * (1 + strength * (0.07 * (n[..., None] - 0.5) + 0.022 * g[..., None]))
        rgb = rgb + strength * 0.075 * fb[..., None] * a - strength * 0.06 * fd[..., None] * a
        arr[..., :3] = np.clip(rgb, 0, 1) * np.where(a > 0, 1, 0)
        arr[..., :3] = np.minimum(arr[..., :3], a)
        return arr

    def bake_card(self, card):
        ctx = self.card_ctx(card)
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        c.clipRect(ctx['clip'])
        # backing sheet so stacked papers have something to cast on
        self.draw_shapes(c, card.shapes, ctx)
        arr = snap(s)
        arr = self.fibre_finish(arr, hash(card.id) % 1000)
        # lit cut edge (paper thickness) on the upper-left rim
        a = arr[..., 3]
        rim = np.clip(a - np.roll(a, (3, 3), (0, 1)), 0, 1)[..., None]
        arr[..., :3] = np.clip(arr[..., :3] + 0.22 * rim * a[..., None], 0, 1)
        arr[..., :3] = np.minimum(arr[..., :3], a[..., None])
        bk = Baked(ctx['w'], ctx['h'], ctx['u0'], ctx['t1'], ctx['tex'])
        bk.plates.append(Plate(to_image(arr)))
        bk.set_alpha(a, 0.007, 0.03)
        bk.back = self.back_rgb
        return bk

    def paper(self, w, h, seed=0, kind='page'):
        base = np.ones((h, w, 4), np.float32)
        base[..., :3] = np.asarray(self.paper_rgb, np.float32)[::-1]
        return self.fibre_finish(base, seed + 50, 0.8)

    def finish_page(self, arr, ctx):
        return arr

    def text(self, c, sh, ctx, color=None, spacing=0.0):
        super().text(c, sh, ctx, color=self.ink_rgb)

    # ---------------------------------------------------------------- book + table
    def table_detail(self, arr, tex):
        h, w = arr.shape[:2]
        n = fbm(h, w * 1, 9, 2, 8)
        streak = cv2.resize(fbm(h // 6, 64, 5, 3, 9), (w, h), interpolation=cv2.INTER_CUBIC)   # long wood grain along x
        streak = cv2.GaussianBlur(streak, (0, 0), 1.2)
        arr[..., :3] *= (0.78 + 0.5 * streak[..., None]) * (0.96 + 0.08 * n[..., None])
        return arr

    def cover_detail(self, arr, tex):
        h, w = arr.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        weave = 0.5 + 0.25 * np.sin(xx * 2.1) + 0.25 * np.sin(yy * 2.1)
        arr[..., :3] *= (0.86 + 0.2 * weave[..., None]).astype(np.float32)
        s = surf(w, h)
        c = s.getCanvas()
        c.drawImage(to_image(np.clip(arr, 0, 1), False), 0, 0)
        gold = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.006 * tex, Color4f=skia.Color4f(0.95, 0.72, 0.3, 0.9))
        c.drawRect(skia.Rect.MakeLTRB(0.022 * tex, 0.022 * tex, w - 0.022 * tex, h - 0.022 * tex), gold)
        return snap(s)

    def tab_rgb(self):
        return hex2rgb('#FFC531')

    # ---------------------------------------------------------------- life
    def overlay(self, c, cid, bk, st, lit=True):
        if not lit:
            return
        wa = st.get('water', 0)
        tex = bk.tex
        if wa > 0:
            if cid in ('floorL', 'floorR'):
                x_off = W if cid == 'floorL' else 0.0
                c.save()
                c.clipPath(self.river_clip(cid), True)
                for pts, fade, i in self.river_streaks(st, x_off, 30):
                    path = skia.Path()
                    path.moveTo(*pts[0])
                    for q in pts[1:]:
                        path.lineTo(*q)
                    sp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap, StrokeWidth=0.0055 * tex,
                                    Color4f=skia.Color4f(0.02, 0.2, 0.35, 0.3 * wa * fade))
                    c.save(); c.translate(0.002 * tex, 0.003 * tex); c.drawPath(path, sp); c.restore()
                    sp.setColor4f(skia.Color4f(0.92, 1.0, 1.0, 0.9 * wa * fade) if i % 3 else skia.Color4f(0.6, 0.93, 0.98, 0.9 * wa * fade))
                    c.drawPath(path, sp)
                # ripple rings where the fall lands and round the canoe
                cp = np.array(self.scene.life['canoe_path'])
                f = st['canoe'] * (len(cp) - 1)
                k = min(int(f), len(cp) - 2)
                cpos = cp[k] * (1 - (f - k)) + cp[k + 1] * (f - k)
                for (cx, cy, base, n) in ((0.0, 0.445, 0.05, 3), (cpos[0] + 0.01, cpos[1] - 0.012, 0.03, 2)):
                    for j in range(n):
                        ph = (st['flow'] * 0.35 + j / n) % 1.0
                        r = base * (0.5 + 1.6 * ph)
                        rp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.004 * tex * (1 - 0.5 * ph),
                                        Color4f=skia.Color4f(1, 1, 1, 0.75 * wa * (1 - ph)))
                        c.drawOval(skia.Rect.MakeLTRB((cx + x_off - r) * tex, (H - cy - r * 0.5) * tex, (cx + x_off + r) * tex, (H - cy + r * 0.5) * tex), rp)
                c.restore()
            else:
                for (xa, ya, xb, yb, fade, i) in self.fall_streaks(cid, bk, st, 13):
                    sp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap,
                                    StrokeWidth=(0.0075 if i % 2 else 0.005) * tex, Color4f=skia.Color4f(1, 1, 1, 0.92 * wa * fade))
                    c.drawLine(xa, ya, xb, yb, sp)
        # lantern halos breathe once life is on
        lf = st.get('life', 0)
        if lf > 0 and cid in self.glow_pts:
            for j, (gx, gy, gr) in enumerate(self.glow_pts[cid]):
                pulse = 0.75 + 0.25 * np.sin(2 * np.pi * 0.8 * st['t'] + j * 1.3)
                r = gr * 3.2 * pulse
                p = skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1.0, 0.72, 0.2, 0.5 * lf), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, r * 0.45))
                c.drawCircle(gx, gy, r, p)
                c.drawCircle(gx, gy, gr * 0.8, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1.0, 0.95, 0.7, 0.9 * lf)))

    def bake_extra(self):
        self.glow_pts = self.glow_points()
        self._grain = [grain(1080, 1920, 100 + i, 0.6) for i in range(6)]
        yy, xx = np.mgrid[0:1080, 0:1920].astype(np.float32)
        d = np.sqrt(((xx - 960) / 1250) ** 2 + ((yy - 560) / 800) ** 2)
        self._vig = np.clip(1.12 - 0.72 * d ** 2.2, 0.25, 1.12)[..., None]

    def sprite(self, c, kind, item, xy, scale, st):
        x, y = float(xy[0]), float(xy[1])
        if kind in ('bird', 'macaw'):
            s = item['size'] * scale
            a = min(item['age'] * 3, 1.0)
            path = self.bird_path(x, y, s, item['flap'])
            sh = skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.1, 0.05, 0.15, 0.25 * a), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, s * 0.12))
            c.save(); c.translate(s * 0.25, s * 0.3); c.drawPath(path, sh); c.restore()
            col = self.col('macaw') if kind == 'macaw' else np.array([0.13, 0.16, 0.42])
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col, a)))
            if kind == 'macaw':
                tip = self.bird_path(x, y, s * 0.55, item['flap'])
                c.drawPath(tip, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col('flower_b'), a)))
                c.drawCircle(x, y, s * 0.12, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col('figure_b'), a)))
            else:
                tip = self.bird_path(x, y - s * 0.02, s * 0.5, item['flap'])
                c.drawPath(tip, skia.Paint(AntiAlias=True, Color4f=rgb2sk((0.36, 0.45, 0.85), a)))
        elif kind == 'mist':
            r = item['r'] * scale
            p = skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1, 1, 1, 0.3 * item['a']), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, r * 0.35))
            c.drawOval(skia.Rect.MakeLTRB(x - r, y - r * 0.42, x + r, y + r * 0.42), p)
        elif kind == 'fly':
            s = item['size'] * scale
            col = self.col(item['role'])
            a = 0.3 + 0.7 * abs(item['flap'])
            for sg in (-1, 1):
                p = skia.Path()
                p.moveTo(x, y); p.lineTo(x + sg * s * a, y - s * 0.7); p.lineTo(x + sg * s * a * 0.8, y + s * 0.5); p.close()
                c.drawPath(p, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col, item['a'])))

    def post(self, img, st):
        # warm lamp pool + vignette + a breath of grain
        img = img * self._vig
        img[..., 2] *= 1.035
        img[..., 0] *= 0.955
        img = np.clip(img, 0, 1)
        img = img * img * (3 - 2 * img) * 0.35 + img * 0.65          # gentle contrast
        g = self._grain[int(st['t'] * 30) % len(self._grain)]
        return img + 0.012 * g[..., None]


STYLE = Lamplit
