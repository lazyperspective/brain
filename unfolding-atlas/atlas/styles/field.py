"""Option 3 - THE NATURALIST'S FIELD ATLAS.

Pen-and-watercolour on cold-pressed paper with the pencil construction still showing.
The pop-up stands up as a pen drawing on white hand-cut paper; then the washes arrive wet -
each piece floods from a few brush touches outward, far to near, pooling at its edges.
Motion: slow, soft, ASMR; everything eases, nothing snaps.
"""
import numpy as np
import cv2
import skia

from .base import Style, Plate, Baked, surf, snap, to_image, to_a8, rgb2sk, shift, fbm, grain, hex2rgb, mix
from ..scene import W, H
from ..geom import smooth, ramp, ease_io


class Field(Style):
    name = 'field'
    title = "Naturalist's Field Atlas"
    rim = 0.0075
    fonts = dict(title=('FreeSerif', 'bolditalic'), italic=('FreeSerif', 'italic'), caps=('FreeSerif', 'normal'), serif=('FreeSerif', 'normal'))
    palette = dict(Style.palette,
                   disc='#FFC93C', disc_ring='#FFE9A0', disc_mark='#F59E2B',
                   peak_far='#7C9BEA', peak_hi='#B4C8F7', peak_mid='#4169D1', peak_mid_hi='#6E92E6', cloud='#E9EEF8',
                   water='#1FB6DA', water_lt='#C9F0F5', water_dp='#1180C9', foam='#FFFFFF',
                   canopy_a='#0E7A52', canopy_b='#2DAE55', canopy_c='#B6DD3C', canopy_d='#1B8A86', canopy_d2='#39B39C', canopy_d3='#93DDB6',
                   trunk='#8A5330', trunk_lt='#C98B52', leaf_a='#1B9C5C', leaf_b='#6CCB45', fern='#0E8563',
                   cliff='#E0683C', cliff_lt='#F79A5E', cliff_dk='#B2433C', stone='#F2B950', stone_lt='#FFE08F', stone_dk='#CC8A3D',
                   door='#4A2A3A', cave='#4A2A3A', glow='#FFAE1F', flower_a='#FF3F7A', flower_b='#FFC21F', flower_c='#9C5BF0',
                   ground='#E3EFB4', bank='#9AD36A', sand='#F7E6AE', lily='#48BE6E', canoe='#E2472E', heron='#FFFFFF', heron_dk='#D5DEE8')
    paper_rgb = (0.985, 0.975, 0.95)
    back_rgb = (0.97, 0.96, 0.935)
    ink_rgb = (0.2, 0.13, 0.11)
    cover_rgb = (0.86, 0.6, 0.16)
    table_rgb = (0.80, 0.74, 0.64)
    edge_rgb = (0.97, 0.955, 0.92)
    light = dict(pos=(-3.0, -1.6, 3.4), ambient=(0.84, 0.86, 0.9), key=(0.22, 0.2, 0.16), shadow=(0.2, 0.2, 0.38),
                 shadow_a=0.32, ao_a=0.16, floor_a=0.3, leaf_a=0.34)
    anim = dict(Style.anim, rest=0.6, leaf=1.85, beat=0.35, open=2.65, open_pow=1.9, bounce=0.0, lean=12.0, lean_v=2.5, spring_f=1.5, spring_d=5.0,
                stagger=1.3, lock_lead=0.3, wobble=0.55, life=0.9, total=9.9, leaf_pow=1.8, cam_az=1.5)
    BLOOM0, BLOOM_DUR, BLOOM_STEP = -0.35, 1.45, 0.105

    # ---------------------------------------------------------------- three passes
    def wash_fill(self, c, path, sh, ctx):
        tex = ctx['tex']
        rng = ctx['rng']
        col = self.col(sh.role, sh.tone)
        c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col, 0.95)))
        if 'small' in sh.tags:
            return
        c.save()
        c.clipPath(path, True)
        g = col.mean()
        pool = np.clip(g + (col - g) * 1.35, 0, 1) * 0.84
        c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.008 * tex, Color4f=rgb2sk(pool, 0.6),
                                    MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 0.0022 * tex)))
        b = path.getBounds()
        if b.width() > 0.03 * tex:
            cx, cy = b.left() + rng.uniform(0.25, 0.75) * b.width(), b.top() + rng.uniform(0.2, 0.6) * b.height()
            r = max(b.width(), b.height()) * rng.uniform(0.35, 0.6)
            shd = skia.GradientShader.MakeRadial(skia.Point(cx, cy), r, [skia.Color4f(1, 1, 1, 0.3).toColor(), skia.Color4f(1, 1, 1, 0.0).toColor()])
            c.drawPaint(skia.Paint(Shader=shd))
            # a darker bleed low in the shape, like pigment settling
            shd2 = skia.GradientShader.MakeLinear([skia.Point(0, b.top()), skia.Point(0, b.bottom())],
                                                  [rgb2sk(pool, 0.0).toColor(), rgb2sk(pool, 0.22).toColor()])
            c.drawPaint(skia.Paint(Shader=shd2))
        c.restore()

    def pen(self, c, path, wd, seed, col, alpha, dev=1.0, seg=14.0):
        p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wd, StrokeCap=skia.Paint.kRound_Cap,
                       StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(col, alpha))
        p.setPathEffect(skia.DiscretePathEffect.Make(seg, dev, seed))
        c.drawPath(path, p)

    def draw_passes(self, shapes, ctx, base_canvas, wash_canvas):
        """Pencil + ink go to base_canvas; washes go to wash_canvas."""
        tex = ctx['tex']
        M = ctx['M']
        k = tex / 1400.0
        rng = np.random.default_rng(sum(map(ord, ctx['id'])))
        ctx['rng'] = rng
        graphite = (0.42, 0.42, 0.47)
        paths = []
        for sh in shapes:
            if sh.kind == 'text':
                continue
            p = skia.Path(sh.path)
            p.transform(M)
            paths.append((sh, p))
        # 1. pencil under-drawing + construction lines
        for i, (sh, p) in enumerate(paths):
            if sh.kind != 'fill' or 'small' in sh.tags or 'hi' in sh.tags or 'inner' in sh.tags:
                continue
            b = p.getBounds()
            self.pen(base_canvas, p, 1.3 * k, i * 3 + 1, graphite, 0.42, 2.6 * k, 22 * k)
            if b.width() > 0.07 * tex and rng.random() < 0.6:
                cx = b.centerX()
                gp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=1.0 * k, Color4f=rgb2sk(graphite, 0.3))
                base_canvas.drawLine(cx, b.top() - 0.02 * tex, cx, b.bottom() + 0.012 * tex, gp)
                base_canvas.drawLine(b.left() - 0.015 * tex, b.centerY(), b.right() + 0.015 * tex, b.centerY(), gp)
                if rng.random() < 0.5:
                    base_canvas.drawOval(skia.Rect.MakeLTRB(b.left() - 0.006 * tex, b.top() - 0.006 * tex, b.right() + 0.006 * tex, b.bottom() + 0.006 * tex), gp)
        # 2. washes
        for sh, p in paths:
            if sh.kind == 'fill':
                self.wash_fill(wash_canvas, p, sh, ctx)
        # 3. pen: loose double outline, lighter on small things
        ink = np.asarray(self.ink_rgb)
        for i, (sh, p) in enumerate(paths):
            if sh.kind == 'fill':
                if 'hi' in sh.tags or 'moonmark' in sh.tags or 'halo' in sh.tags or 'inner' in sh.tags or 'facet' in sh.tags:
                    continue
                small = 'small' in sh.tags
                self.pen(base_canvas, p, (1.5 if small else 2.3) * k, i * 5 + 2, ink, 0.9, (0.7 if small else 1.3) * k, 13 * k)
                if not small and i % 2 == 0:
                    self.pen(base_canvas, p, 1.0 * k, i * 5 + 3, ink, 0.4, 2.0 * k, 17 * k)
            else:
                if 'textbar' in sh.tags:
                    self.pen(base_canvas, p, max(sh.w * tex * 0.55, 1.2), i, ink, 0.55, 1.2 * k, 9 * k)
                elif 'flow' in sh.tags:
                    self.pen(wash_canvas, p, max(sh.w * tex, 1.4), i, (1, 1, 1), 0.0, 1.0, 12)
                else:
                    wd = max(sh.w * tex * (0.5 if 'detail' in sh.tags else 0.75), 1.4 * k)
                    if sh.role not in ('ink',) and 'detail' not in sh.tags:
                        # coloured strokes (vines, ropes, stems) are brush lines in the wash
                        wp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * tex, 1.6), StrokeCap=skia.Paint.kRound_Cap,
                                        Color4f=rgb2sk(self.col(sh.role, sh.tone), 0.95))
                        wash_canvas.drawPath(p, wp)
                        self.pen(base_canvas, p, 1.2 * k, i, ink, 0.6, 1.0 * k, 12 * k)
                    else:
                        self.pen(base_canvas, p, wd, i, ink, 0.85, 0.9 * k, 11 * k)
        for sh in shapes:
            if sh.kind == 'text':
                self.text(base_canvas, sh, ctx, color=self.ink_rgb)

    def finish_wash(self, arr, seed, tex):
        """Wobble the wet edges, add granulation and back-runs. arr premul BGRA."""
        h, w = arr.shape[:2]
        amp = 0.0022 * tex
        nx = (fbm(h, w, 0.03 * tex, 2, seed) - 0.5) * 2 * amp
        ny = (fbm(h, w, 0.03 * tex, 2, seed + 1) - 0.5) * 2 * amp
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        arr = cv2.remap(arr, xx + nx, yy + ny, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        tooth = grain(h, w, seed + 2, 1.1)
        runs = fbm(h, w, 0.09 * tex, 3, seed + 3)
        dens = np.clip(0.93 + 0.045 * tooth + 0.16 * (runs - 0.5), 0.6, 1.1)[..., None]
        a = arr[..., 3:4]
        out = arr.copy()
        # pigment density: scale alpha, keep hue
        na = np.clip(a * dens, 0, 1)
        col = arr[..., :3] / np.maximum(a, 1e-4)
        out[..., :3] = col * na
        out[..., 3:4] = na
        return out

    def paper_tex(self, h, w, seed):
        t = 0.985 + 0.02 * fbm(h, w, 26, 3, seed) + 0.014 * grain(h, w, seed + 1, 1.0)
        return t.astype(np.float32)

    def bloom_field(self, alpha, seed, n_seeds=3):
        """Low-res field: where the wash arrives first (small) to last (large)."""
        ds = 6
        small = cv2.resize(alpha, (max(alpha.shape[1] // ds, 4), max(alpha.shape[0] // ds, 4)), interpolation=cv2.INTER_AREA)
        h, w = small.shape
        rng = np.random.default_rng(seed)
        ys, xs = np.nonzero(small > 0.5)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        f = np.full((h, w), 1e9, np.float32)
        if len(xs) == 0:
            return np.zeros((h, w), np.float32)
        for _ in range(n_seeds):
            j = rng.integers(0, len(xs))
            f = np.minimum(f, np.hypot(xx - xs[j], yy - ys[j]))
        f /= max(f[small > 0.5].max(), 1.0)
        f = 0.72 * f + 0.28 * fbm(h, w, max(w / 6, 3), 3, seed + 5)
        return f.astype(np.float32)

    def bake_card(self, card):
        ctx = self.card_ctx(card)
        w, h, tex = ctx['w'], ctx['h'], ctx['tex']
        sil = self.silhouette(card.shapes, ctx, w, h)
        r = ctx['clip']
        clipm = np.zeros_like(sil)
        clipm[:, int(r.left()):int(np.ceil(r.right()))] = 1
        sil *= clipm
        seed = sum(map(ord, card.id))
        sb, sw = surf(w, h), surf(w, h)
        for s_ in (sb, sw):
            s_.getCanvas().clipRect(ctx['clip'])
        # paper first
        pt = self.paper_tex(h, w, seed)
        paper = np.zeros((h, w, 4), np.float32)
        for k in range(3):
            paper[..., k] = self.paper_rgb[2 - k] * pt * sil
        paper[..., 3] = sil
        sb.getCanvas().drawImage(to_image(np.clip(paper, 0, 1), False), 0, 0)
        self.draw_passes(card.shapes, ctx, sb.getCanvas(), sw.getCanvas())
        base = snap(sb)
        base *= sil[..., None] / np.maximum(base[..., 3:4], 1e-4) * (base[..., 3:4] > 0)
        wash = self.finish_wash(snap(sw), seed, tex)
        wash *= sil[..., None]
        bk = Baked(w, h, ctx['u0'], ctx['t1'], tex)
        bk.plates.append(Plate(to_image(np.clip(base, 0, 1)), 'base'))
        bk.plates.append(Plate(to_image(np.clip(wash, 0, 1)), 'wash', skia.BlendMode.kMultiply))
        bk.set_alpha(sil, 0.008, 0.03)
        bk.back = self.back_rgb
        bk.extra['bloom'] = self.bloom_field(wash[..., 3], seed, 3)
        bk.extra['wash_u8'] = np.clip(wash * 255 + 0.5, 0, 255).astype(np.uint8)
        return bk

    def paper(self, w, h, seed=0, kind='page'):
        base = np.ones((h, w, 4), np.float32)
        pt = self.paper_tex(h, w, seed)
        for k in range(3):
            base[..., k] = self.paper_rgb[2 - k] * pt
        return np.clip(base, 0, 1)

    def bake_page(self, name, shapes, side, x_off=0.0, seed=0, gutter=True):
        ctx = self.page_ctx(name, x_off)
        w, h, tex = ctx['w'], ctx['h'], ctx['tex']
        paper = self.paper(w, h, seed)
        if gutter:
            paper = self.gutter_shade(paper, side, 0.28)
        sb, sw = surf(w, h), surf(w, h)
        sb.getCanvas().drawImage(to_image(paper, False), 0, 0)
        self.draw_passes(shapes, ctx, sb.getCanvas(), sw.getCanvas())
        base = snap(sb)
        wash = self.finish_wash(snap(sw), seed + 9, tex)
        bk = Baked(w, h, 0.0, H, tex)
        if name in ('floorL', 'floorR'):
            bk.plates.append(Plate(to_image(base), 'base'))
            bk.plates.append(Plate(to_image(np.clip(wash, 0, 1)), 'wash', skia.BlendMode.kMultiply))
            bk.extra['bloom'] = self.bloom_field(wash[..., 3], seed, 4)
            bk.extra['wash_u8'] = np.clip(wash * 255 + 0.5, 0, 255).astype(np.uint8)
            return bk
        a = wash[..., 3:4]
        col = wash[..., :3] / np.maximum(a, 1e-4)
        base[..., :3] *= (1 - a) + a * col
        bk.plates.append(Plate(to_image(np.clip(base, 0, 1)), 'comp'))
        return bk

    # ---------------------------------------------------------------- book + table
    def table_detail(self, arr, tex):
        h, w = arr.shape[:2]
        streak = cv2.resize(fbm(h // 8, 48, 4, 3, 9), (w, h), interpolation=cv2.INTER_CUBIC)
        arr[..., :3] *= (0.93 + 0.14 * streak[..., None])
        s = surf(w, h)
        c = s.getCanvas()
        c.drawImage(to_image(np.clip(arr, 0, 1), False), 0, 0)
        # dried colour rings and test dabs left on the desk
        for (x, y, r, col) in ((3.2, 5.85, 0.26, '#1FB6DA'), (6.85, 6.95, 0.2, '#FF3F7A'), (6.8, 5.2, 0.3, '#2DAE55'), (3.35, 7.35, 0.22, '#FFC21F'), (2.6, 6.7, 0.12, '#9C5BF0')):
            cc = hex2rgb(col)
            c.drawCircle(x * tex, y * tex, r * tex, skia.Paint(AntiAlias=True, Color4f=rgb2sk(cc, 0.16)))
            c.drawCircle(x * tex, y * tex, r * tex, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.02 * tex, Color4f=rgb2sk(cc, 0.3),
                                                               MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 0.006 * tex)))
        return snap(s)

    def table_shadow(self, ms, mt):
        return (1 - 0.34 * ms[..., None]) * (1 - 0.3 * mt[..., None])

    def cover_detail(self, arr, tex):
        h, w = arr.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        weave = 0.5 + 0.25 * np.sin(xx * 1.7) + 0.25 * np.sin(yy * 1.7)
        arr[..., :3] *= (0.88 + 0.18 * weave[..., None]).astype(np.float32)
        return np.clip(arr, 0, 1)

    def tab_rgb(self):
        return hex2rgb('#FF3F7A')

    def tab_paper(self):
        return (0.9, 0.89, 0.87)

    # ---------------------------------------------------------------- the wash arrives
    def bake_extra(self):
        ids = sorted(self.scene.cards, key=lambda cd: -self.scene.mech.key(cd))
        self.order = {cd.id: i + 2 for i, cd in enumerate(ids)}
        self.order.update(floorL=0, floorR=0.6)
        self.glow_pts = self.glow_points()
        self._grain = [grain(1080, 1920, 500 + i, 0.8) for i in range(5)]

    def bloom_prog(self, cid, st):
        t0 = self.BLOOM0 + self.BLOOM_STEP * self.order.get(cid, 0)
        return ramp(st['after'], t0, t0 + self.BLOOM_DUR)

    def plate_state(self, bk, plate, cid, st):
        if plate.name != 'wash':
            return 1.0, 0.0, 0.0, None
        q = self.bloom_prog(cid, st)
        if q <= 0:
            return 0.0, 0, 0, None
        if q >= 1:
            return 1.0, 0, 0, None
        f = bk.extra['bloom']
        e = ease_io(q, 1.35)
        soft = 0.16
        m = np.clip((e * (1 + soft) - f) / soft, 0, 1)
        # wet front: a little extra pigment right behind the advancing edge
        m = (np.clip(m * m * (3 - 2 * m), 0, 1) * 255).astype(np.uint8)
        wu = bk.extra['wash_u8']
        mf = cv2.resize(m, (wu.shape[1], wu.shape[0]), interpolation=cv2.INTER_LINEAR)
        out = cv2.multiply(wu, cv2.merge([mf, mf, mf, mf]), scale=1 / 255.0)
        img = skia.Image.fromarray(out, colorType=skia.kBGRA_8888_ColorType, alphaType=skia.kPremul_AlphaType, copy=False)
        bk.extra['_keep'] = out
        return 1.0, 0.0, 0.0, None, img

    def overlay(self, c, cid, bk, st, lit=True):
        if not lit:
            return
        wa = st.get('water', 0) * self.bloom_prog(cid, st)
        tex = bk.tex
        if wa > 0.02:
            if cid in ('floorL', 'floorR'):
                x_off = W if cid == 'floorL' else 0.0
                c.save()
                c.clipPath(self.river_clip(cid), True)
                for pts, fade, i in self.river_streaks(st, x_off, 30):
                    path = skia.Path()
                    path.moveTo(*pts[0])
                    for q in pts[1:]:
                        path.lineTo(*q)
                    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap, StrokeWidth=(0.0042 + 0.002 * (i % 3)) * tex,
                                   Color4f=skia.Color4f(1, 1, 1, 0.8 * wa * fade) if i % 4 else skia.Color4f(0.05, 0.36, 0.7, 0.5 * wa * fade))
                    p.setPathEffect(skia.DiscretePathEffect.Make(8, 1.2, i))
                    c.drawPath(path, p)
                for j in range(3):
                    ph = (st['flow'] * 0.3 + j / 3) % 1.0
                    r = 0.05 * (0.5 + 1.7 * ph)
                    c.drawOval(skia.Rect.MakeLTRB((x_off - r) * tex, (H - 0.445 - r * 0.5) * tex, (x_off + r) * tex, (H - 0.445 + r * 0.5) * tex),
                               skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0035 * tex, Color4f=skia.Color4f(1, 1, 1, 0.7 * wa * (1 - ph))))
                c.restore()
            else:
                for (xa, ya, xb, yb, fade, i) in self.fall_streaks(cid, bk, st, 12):
                    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap, StrokeWidth=(0.0045 + 0.003 * (i % 2)) * tex,
                                   Color4f=skia.Color4f(1, 1, 1, 0.85 * wa * fade))
                    c.drawLine(xa, ya, xb, yb, p)
        lf = st.get('life', 0) * self.bloom_prog(cid, st)
        if lf > 0 and cid in self.glow_pts:
            for j, (gx, gy, gr) in enumerate(self.glow_pts[cid]):
                pulse = 0.7 + 0.3 * np.sin(2 * np.pi * 0.6 * st['t'] + j * 1.3)
                r = gr * 3.4 * pulse
                c.drawCircle(gx, gy, r, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1.0, 0.75, 0.15, 0.4 * lf), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, r * 0.5)))

    def sprite(self, c, kind, item, xy, scale, st):
        x, y = float(xy[0]), float(xy[1])
        ink = np.asarray(self.ink_rgb)
        if kind in ('bird', 'macaw'):
            s = item['size'] * scale
            a = min(item['age'] * 2.5, 1.0)
            if kind == 'macaw':
                path = self.bird_path(x, y, s, item['flap'])
                c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col('macaw'), 0.9 * a)))
                c.drawPath(self.bird_path(x, y, s * 0.5, item['flap']), skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col('flower_b'), 0.9 * a)))
                self.pen(c, path, 1.6 * st['ss'], item['seed'], ink, 0.85 * a, 0.8 * st['ss'], 9 * st['ss'])
            else:
                # a quick two-stroke gull, the way a field sketcher flicks them in
                f = 0.6 + 0.5 * item['flap']
                p = skia.Path()
                p.moveTo(x - s, y - s * 0.38 * f)
                p.quadTo(x - s * 0.45, y - s * 0.55 * f - s * 0.1, x, y)
                p.quadTo(x + s * 0.45, y - s * 0.55 * f - s * 0.1, x + s, y - s * 0.38 * f)
                c.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=s * 0.13, StrokeCap=skia.Paint.kRound_Cap, Color4f=rgb2sk(ink, 0.9 * a)))
        elif kind == 'mist':
            r = item['r'] * scale
            c.drawOval(skia.Rect.MakeLTRB(x - r, y - r * 0.4, x + r, y + r * 0.4),
                       skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1, 1, 1, 0.3 * item['a']), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, r * 0.3)))
        elif kind == 'fly':
            s = item['size'] * scale
            col = self.col(item['role'])
            a = 0.3 + 0.7 * abs(item['flap'])
            for sg in (-1, 1):
                p = skia.Path()
                p.moveTo(x, y); p.quadTo(x + sg * s * a * 1.2, y - s * 1.0, x + sg * s * a, y - s * 0.1); p.quadTo(x + sg * s * a * 0.9, y + s * 0.6, x, y); p.close()
                c.drawPath(p, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col, 0.85 * item['a'])))
            c.drawLine(x, y - s * 0.4, x, y + s * 0.4, skia.Paint(AntiAlias=True, StrokeWidth=1.2 * st['ss'], Color4f=rgb2sk(ink, item['a'])))

    def post(self, img, st):
        g = self._grain[int(st['t'] * 30) % len(self._grain)]
        return img * (1 + 0.01 * g[..., None])


STYLE = Field
