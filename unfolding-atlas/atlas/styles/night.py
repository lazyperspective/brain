"""Option 4 - NIGHT LANTERN ATLAS.

Luminous inks on deep indigo paper.  The pieces are dark silhouettes edged with gel-pen rim
light; the moon, the water and the lanterns are real light sources (additive plates + bloom).
The moon is already glowing as the book opens; then the light runs down the waterfall into
the river and the lanterns catch one by one.  Motion: slow, floaty, weightless.
"""
import numpy as np
import cv2
import skia

from .base import Style, Plate, Baked, surf, snap, to_image, to_a8, rgb2sk, shift, fbm, grain, hex2rgb, mix
from ..scene import W, H
from ..geom import smooth, ramp, ease_io

EMI_M = ('disc', 'disc_ring')
EMI_W = ('water', 'water_lt', 'water_dp', 'foam')
EMI_F = ('glow', 'flower_a', 'flower_b', 'flower_c', 'lily')
BRIGHT = dict(disc='#F4D58E', disc_ring='#FFC861', water='#1FE3F5', water_lt='#C9FFFF', water_dp='#12A6F0', foam='#FFFFFF',
              glow='#FFC04A', flower_a='#FF4FB8', flower_b='#FFD23F', flower_c='#B98CFF', lily='#3CFFB0')
RIM = dict(foliage='#63FFD2', rock='#FF7ADB', peak='#9DB4FF', stone='#FFC773', trunk='#FFB48A', water='#B8FFFF', ground='#5C8FE8')


class Night(Style):
    name = 'night'
    title = 'Night Lantern Atlas'
    fonts = dict(title=('Caladea', 'bolditalic'), italic=('Caladea', 'italic'), caps=('Inter', 'semibold'), serif=('Caladea', 'normal'))
    palette = dict(
        disc='#8C7F5C', disc_ring='#3A3B66', disc_mark='#E8C26A',
        peak_far='#2A3C9C', peak_hi='#4A62C9', peak_mid='#1C2A7A', peak_mid_hi='#3348A8', cloud='#5A6CC0',
        water='#0E5F8A', water_lt='#1B86A8', water_dp='#0A4A78', foam='#3AA6C2',
        canopy_a='#06343F', canopy_b='#0B5A57', canopy_c='#17966F', canopy_d='#0A2E52', canopy_d2='#0E4868', canopy_d3='#1B7A8C',
        trunk='#3A1F45', trunk_lt='#6B3A6A', leaf_a='#0A5C52', leaf_b='#129072', fern='#0A4A50',
        cliff='#5E2060', cliff_lt='#96327E', cliff_dk='#3B1448', stone='#5A4690', stone_lt='#8E76C8', stone_dk='#3A2C68',
        door='#120A24', cave='#120A24', glow='#7A4A1E', flower_a='#8A2A6C', flower_b='#8A6A20', flower_c='#5A3E9C',
        figure_a='#B02C5C', figure_b='#2C58C8', figure_c='#C06A20', skin='#C9A0A8', hat='#D8C48A',
        bird='#E8F6FF', macaw='#FF6FB0', heron='#DCEBFF', heron_dk='#8FA6D8', heron_leg='#7C8CC8', monkey='#2A1638', bird_dk='#150E2A',
        canoe='#B02C5C', rope='#8A6AA0', lily='#0E6A5E', ground='#101C4A', bank='#0F3050', sand='#27336E', ink='#FFDF9A')
    paper_rgb = (0.075, 0.085, 0.22)
    back_rgb = (0.1, 0.11, 0.27)
    ink_rgb = (1.0, 0.87, 0.6)
    cover_rgb = (0.05, 0.06, 0.2)
    table_rgb = (0.022, 0.025, 0.06)
    edge_rgb = (0.5, 0.55, 0.78)
    light = dict(pos=(-1.2, -2.6, 3.2), ambient=(0.62, 0.66, 0.85), key=(0.42, 0.42, 0.5), shadow=(0.0, 0.0, 0.06),
                 shadow_a=0.5, ao_a=0.3, floor_a=0.45, leaf_a=0.5)
    anim = dict(Style.anim, rest=0.6, leaf=1.9, beat=0.4, open=2.85, open_pow=1.75, bounce=0.0, lean=13.0, lean_v=3.0, spring_f=1.25, spring_d=2.9,
                stagger=1.25, lock_lead=0.2, wobble=0.6, life=0.5, total=9.9, leaf_pow=1.7, cam_az=2.2, cam_e1=27.0)
    ambience = 'night'
    snap_pitch = 0.8
    has_unlit_overlay = True

    # ---------------------------------------------------------------- medium
    def rim_col(self, sh):
        for k, v in RIM.items():
            if k in sh.tags:
                return hex2rgb(v)
        r = sh.role
        if r.startswith(('canopy', 'leaf', 'fern', 'lily', 'bank')):
            return hex2rgb(RIM['foliage'])
        if r.startswith(('cliff',)):
            return hex2rgb(RIM['rock'])
        if r.startswith(('stone',)):
            return hex2rgb(RIM['stone'])
        if r.startswith(('trunk', 'monkey', 'rope')):
            return hex2rgb(RIM['trunk'])
        if r.startswith(('water', 'foam')):
            return hex2rgb(RIM['water'])
        return hex2rgb('#A9C4FF')

    def fill(self, c, path, sh, ctx):
        tex = ctx['tex']
        col = self.col(sh.role, sh.tone)
        c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col)))
        if 'small' in sh.tags:
            return
        b = path.getBounds()
        c.save()
        c.clipPath(path, True)
        # moon-wash: lighter towards the top of each shape
        shd = skia.GradientShader.MakeLinear([skia.Point(0, b.top()), skia.Point(0, b.bottom())],
                                             [skia.Color4f(0.55, 0.7, 1.0, 0.2).toColor(), skia.Color4f(0.0, 0.0, 0.1, 0.22).toColor()])
        c.drawPaint(skia.Paint(Shader=shd))
        if 'hi' not in sh.tags and 'moonmark' not in sh.tags and 'ground' not in sh.tags:
            d = 0.0017 * tex
            rc = self.rim_col(sh)
            c.save(); c.translate(d, d)
            c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0026 * tex, Color4f=rgb2sk(rc, 0.78)))
            c.restore()
        c.restore()

    def line(self, c, path, sh, ctx):
        tex = ctx['tex']
        if sh.role == 'ink' or 'label' in sh.tags or 'frame' in sh.tags or 'contour' in sh.tags:
            col, a = np.asarray(self.ink_rgb), (0.35 if 'textbar' in sh.tags else 0.85)
        elif 'detail' in sh.tags:
            col, a = self.rim_col(sh), 0.5
        else:
            col, a = shift(self.col(sh.role, sh.tone), 1, 0.45), 1.0
        c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * tex * (0.6 if 'detail' in sh.tags else 1.0), 1.3),
                                    StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(col, a)))

    def emission(self, shapes, ctx, roles):
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        c.clipRect(ctx['clip'])
        M = ctx['M']
        any_ = False
        for sh in shapes:
            if sh.kind != 'fill':
                continue
            p = skia.Path(sh.path)
            p.transform(M)
            if sh.role in roles:
                col = hex2rgb(BRIGHT[sh.role])
                c.drawPath(p, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col, 1.0)))
                if sh.role == 'disc':
                    b = p.getBounds()
                    shd = skia.GradientShader.MakeRadial(skia.Point(b.centerX() - b.width() * 0.12, b.centerY() - b.height() * 0.15), b.width() * 0.62,
                                                         [skia.Color4f(1, 1, 1, 0.3).toColor(), skia.Color4f(1, 0.7, 0.3, 0.22).toColor()])
                    c.save(); c.clipPath(p, True); c.drawPaint(skia.Paint(Shader=shd)); c.restore()
                any_ = True
            elif any_ and sh.role == 'disc_mark' and 'disc' in roles:
                c.drawPath(p, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.62, 0.36, 0.16, 0.85)))
            elif any_:
                # later, non-emissive shapes sit in front of the light
                c.drawPath(p, skia.Paint(AntiAlias=True, BlendMode=skia.BlendMode.kClear))
        if not any_:
            return None
        arr = snap(s)
        if arr[..., 3].max() < 0.02:
            return None
        soft = cv2.GaussianBlur(arr, (0, 0), 0.0022 * ctx['tex'])
        arr = np.clip(arr * 0.85 + soft * 0.3, 0, 1)
        return arr

    def bake_card(self, card):
        ctx = self.card_ctx(card)
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        c.clipRect(ctx['clip'])
        self.draw_shapes(c, card.shapes, ctx)
        arr = snap(s)
        seed = sum(map(ord, card.id))
        h, w = arr.shape[:2]
        a = arr[..., 3:4]
        arr[..., :3] *= (0.93 + 0.14 * fbm(h, w, 70, 3, seed)[..., None] + 0.02 * grain(h, w, seed + 1, 0.7)[..., None])
        # paper edge catching the moon
        al = arr[..., 3]
        rim = np.clip(al - np.roll(al, (3, 2), (0, 1)), 0, 1)[..., None]
        arr[..., :3] = np.clip(arr[..., :3] + np.array([0.5, 0.36, 0.3], np.float32) * 0.5 * rim * a, 0, 1)
        arr[..., :3] = np.minimum(arr[..., :3], a)
        bk = Baked(ctx['w'], ctx['h'], ctx['u0'], ctx['t1'], ctx['tex'])
        bk.plates.append(Plate(to_image(arr)))
        for nm, roles in (('emi_m', EMI_M), ('emi_w', EMI_W), ('emi_f', EMI_F)):
            e = self.emission(card.shapes, ctx, roles)
            if e is not None:
                bk.plates.append(Plate(to_image(e), nm, skia.BlendMode.kPlus, lit=False))
        bk.set_alpha(al, 0.008, 0.03)
        bk.back = self.back_rgb
        return bk

    def paper(self, w, h, seed=0, kind='page'):
        base = np.ones((h, w, 4), np.float32)
        n = fbm(h, w, 160, 4, seed)
        g = grain(h, w, seed + 1, 0.8)
        for k in range(3):
            base[..., k] = self.paper_rgb[2 - k] * (0.86 + 0.28 * n + 0.03 * g)
        # a dusting of printed stars
        rng = np.random.default_rng(seed + 77)
        s = surf(w, h)
        c = s.getCanvas()
        c.drawImage(to_image(np.clip(base, 0, 1), False), 0, 0)
        for _ in range(int(w * h / 9000)):
            x, y = rng.uniform(0, w), rng.uniform(0, h)
            r = rng.uniform(0.6, 2.0) * self.PTEX / 1150
            c.drawCircle(x, y, r, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.75, 0.82, 1.0, rng.uniform(0.15, 0.6))))
        return snap(s)

    def bake_page(self, name, shapes, side, x_off=0.0, seed=0, gutter=True):
        bk = super().bake_page(name, shapes, side, x_off, seed, gutter)
        if name in ('floorL', 'floorR'):
            ctx = self.page_ctx(name, x_off)
            for nm, roles in (('emi_w', EMI_W), ('emi_f', EMI_F)):
                e = self.emission(shapes, ctx, roles)
                if e is not None:
                    bk.plates.append(Plate(to_image(e), nm, skia.BlendMode.kPlus, lit=True))
            # light runs downstream: far (top of texture) first
            hh, ww = 64, 40
            yy = np.linspace(0, 1, hh, dtype=np.float32)[:, None] * np.ones((1, ww), np.float32)
            bk.extra['flowfield'] = np.clip((yy - 0.66) / 0.34, 0, 1)
        return bk

    def gutter_shade(self, arr, side, strength=0.5, width=0.1):
        return super().gutter_shade(arr, side, 0.5, 0.1)

    # ---------------------------------------------------------------- book + table
    def table_detail(self, arr, tex):
        h, w = arr.shape[:2]
        s = surf(w, h)
        c = s.getCanvas()
        c.drawImage(to_image(np.clip(arr, 0, 1), False), 0, 0)
        rng = np.random.default_rng(5)
        ln = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=1.2, Color4f=skia.Color4f(0.3, 0.38, 0.75, 0.3))
        for _ in range(26):                           # a star chart printed on the dark cloth
            x, y = rng.uniform(0.2, 9.8) * tex, rng.uniform(3.6, 8.9) * tex
            pts = [(x, y)]
            for k in range(rng.integers(2, 5)):
                a = rng.uniform(0, 6.28)
                L = rng.uniform(0.15, 0.45) * tex
                pts.append((pts[-1][0] + L * np.cos(a), pts[-1][1] + L * np.sin(a) * 0.8))
            for a_, b_ in zip(pts[:-1], pts[1:]):
                c.drawLine(*a_, *b_, ln)
            for q in pts:
                c.drawCircle(*q, rng.uniform(1.5, 3.2), skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.6, 0.7, 1.0, 0.6)))
        for r in (2.6, 3.3, 4.1):
            c.drawOval(skia.Rect.MakeLTRB((5 - r) * tex, (6.4 - r * 0.8) * tex, (5 + r) * tex, (6.4 + r * 0.8) * tex), ln)
        return snap(s)

    def table_shadow(self, ms, mt):
        return (1 - 0.75 * ms[..., None]) * (1 - 0.4 * mt[..., None])

    def cover_detail(self, arr, tex):
        h, w = arr.shape[:2]
        s = surf(w, h)
        c = s.getCanvas()
        c.drawImage(to_image(np.clip(arr, 0, 1), False), 0, 0)
        silver = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.005 * tex, Color4f=skia.Color4f(0.75, 0.8, 1.0, 0.85))
        c.drawRect(skia.Rect.MakeLTRB(0.02 * tex, 0.02 * tex, w - 0.02 * tex, h - 0.02 * tex), silver)
        return snap(s)

    def edge_detail(self, e):
        e[..., :3] *= np.array([1.0, 0.75, 0.62], np.float32)
        return np.clip(e, 0, 1)

    def board_edge_rgb(self):
        return (0.16, 0.18, 0.4)

    def tab_rgb(self):
        return hex2rgb('#FFC04A')

    def tab_paper(self):
        return (0.13, 0.15, 0.34)

    def bake_tab(self):
        keep = self.ink_rgb
        self.ink_rgb = (0.1, 0.08, 0.2)
        super().bake_tab()
        self.ink_rgb = keep

    # ---------------------------------------------------------------- light choreography
    def bake_extra(self):
        ids = sorted(self.scene.cards, key=lambda cd: -self.scene.mech.key(cd))
        self.order = {cd.id: i for i, cd in enumerate(ids)}
        self.glow_pts = self.glow_points()
        self.glow_order = {}
        k = 0
        for cid in ('temple', 'court', 'cliffL', 'cliffR', 'canoe'):
            for j in range(len(self.glow_pts.get(cid, []))):
                self.glow_order[(cid, j)] = k
                k += 1
        self._grain = [grain(1080, 1920, 700 + i, 0.7) for i in range(5)]
        yy, xx = np.mgrid[0:1080, 0:1920].astype(np.float32)
        d = np.sqrt(((xx - 960) / 1300) ** 2 + ((yy - 520) / 820) ** 2)
        self._vig = np.clip(1.08 - 0.6 * d ** 2.0, 0.3, 1.08)[..., None]
        rng = np.random.default_rng(9)
        self.fireflies = [dict(pos=np.array([rng.uniform(-0.8, 0.8), rng.uniform(0.05, 0.6), rng.uniform(0.05, 0.5)]), phase=rng.uniform(0, 6.28),
                               sp=rng.uniform(0.5, 1.2)) for _ in range(46)]

    def plate_state(self, bk, plate, cid, st):
        nm = plate.name
        af = st['after']
        if nm == 'emi_m':
            return 0.3 + 0.42 * smooth(ramp(st['open'], 0.15, 0.95)), 0, 0, None
        if nm == 'emi_w':
            if cid.startswith('moon'):
                return smooth(ramp(af, 0.15, 0.75)), 0, 0, None
            if cid.startswith('cliff'):
                return smooth(ramp(af, 0.55, 1.15)), 0, 0, None
            q = ramp(af, 0.95, 2.3)
            if q <= 0:
                return 0.0, 0, 0, None
            if q >= 1:
                return 1.0, 0, 0, None
            f = bk.extra['flowfield']
            m = np.clip((q * 1.25 - f) / 0.25, 0, 1)
            return 1.0, 0, 0, to_a8(m)
        if nm == 'emi_f':
            return smooth(ramp(af, 1.3 + 0.12 * self.order.get(cid, 0), 2.1 + 0.12 * self.order.get(cid, 0))), 0, 0, None
        return 1.0, 0.0, 0.0, None

    def overlay(self, c, cid, bk, st, lit=True):
        tex = bk.tex
        floor = cid in ('floorL', 'floorR')
        if lit and not floor:
            return
        af = st['after']
        add = skia.BlendMode.kPlus
        wa = st.get('water', 0)
        if floor:
            x_off = W if cid == 'floorL' else 0.0
            # moonlight pooling on the ground in front of the fall
            g = 0.2 * smooth(ramp(st['open'], 0.3, 1.0))
            shd = skia.GradientShader.MakeRadial(skia.Point(x_off * tex, (H - 0.5) * tex), 0.75 * tex,
                                                 [skia.Color4f(0.4, 0.75, 1.0, g).toColor(), skia.Color4f(0.2, 0.4, 1.0, 0.0).toColor()])
            c.drawPaint(skia.Paint(Shader=shd, BlendMode=add))
            if wa > 0.02 and af > 1.0:
                wv = wa * smooth(ramp(af, 1.2, 2.4))
                c.save()
                c.clipPath(self.river_clip(cid), True)
                for pts, fade, i in self.river_streaks(st, x_off, 34):
                    path = skia.Path()
                    path.moveTo(*pts[0])
                    for q in pts[1:]:
                        path.lineTo(*q)
                    c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap, StrokeWidth=0.0042 * tex,
                                                Color4f=skia.Color4f(0.75, 1.0, 1.0, 0.75 * wv * fade), BlendMode=add))
                for j in range(3):
                    ph = (st['flow'] * 0.3 + j / 3) % 1.0
                    r = 0.05 * (0.5 + 1.7 * ph)
                    c.drawOval(skia.Rect.MakeLTRB((x_off - r) * tex, (H - 0.445 - r * 0.5) * tex, (x_off + r) * tex, (H - 0.445 + r * 0.5) * tex),
                               skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.004 * tex, Color4f=skia.Color4f(0.8, 1, 1, 0.7 * wv * (1 - ph)), BlendMode=add))
                # the canoe lantern and the temple lamps lay gold on the water
                cp = np.array(self.scene.life['canoe_path'])
                f = st['canoe'] * (len(cp) - 1)
                k = min(int(f), len(cp) - 2)
                cpos = cp[k] * (1 - (f - k)) + cp[k + 1] * (f - k)
                on = smooth(ramp(af, 2.4, 3.0))
                for (rx, ry, wd, ln_) in ((cpos[0] + 0.07, cpos[1] - 0.05, 0.02, 0.07), (0.2, 0.16, 0.03, 0.06)):
                    for j in range(5):
                        yy_ = ry - ln_ * j / 5
                        wob = 0.006 * np.sin(st['t'] * 3 + j * 1.7)
                        c.drawOval(skia.Rect.MakeLTRB((rx + wob + x_off - wd * (1 - j * 0.12)) * tex, (H - yy_ - 0.004) * tex,
                                                      (rx + wob + x_off + wd * (1 - j * 0.12)) * tex, (H - yy_ + 0.004) * tex),
                                   skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1.0, 0.7, 0.25, 0.5 * on * (1 - j / 6)), BlendMode=add))
                c.restore()
            return
        # --- cards, additive pass
        if wa > 0.02:
            base_on = smooth(ramp(af, 0.15, 0.75)) if cid.startswith('moon') else smooth(ramp(af, 0.55, 1.15))
            for (xa, ya, xb, yb, fade, i) in self.fall_streaks(cid, bk, st, 12):
                c.drawLine(xa, ya, xb, yb, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap,
                                                     StrokeWidth=(0.004 + 0.003 * (i % 2)) * tex, Color4f=skia.Color4f(0.85, 1, 1, 0.8 * wa * fade * base_on), BlendMode=add))
        if cid in self.glow_pts:
            for j, (gx, gy, gr) in enumerate(self.glow_pts[cid]):
                t_on = 1.5 + 0.14 * self.glow_order.get((cid, j), j)
                on = ramp(af, t_on, t_on + 0.25)
                if on <= 0:
                    continue
                on = on * (1 + 0.5 * np.exp(-6 * max(af - t_on - 0.25, 0)))          # catch-flare
                fl = 0.86 + 0.14 * np.sin(st['t'] * 9 + j * 2.1) * np.sin(st['t'] * 5.3 + j)
                r = gr * 5.5
                c.drawCircle(gx, gy, r, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1.0, 0.6, 0.15, min(0.55 * on * fl, 1)),
                                                   MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, r * 0.5), BlendMode=add))
                c.drawCircle(gx, gy, gr * 1.05, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1.0, 0.9, 0.6, min(on * fl, 1)), BlendMode=add))

    def extra_sprites(self, st):
        lf = st.get('life', 0)
        if lf <= 0:
            return []
        out = []
        t = st['t']
        for i, f in enumerate(self.fireflies):
            on = smooth(ramp(st['life_t'], 0.1 * (i % 12), 0.1 * (i % 12) + 0.8))
            if on <= 0:
                continue
            P = f['pos'] + np.array([0.04 * np.sin(0.5 * f['sp'] * t + f['phase']), 0.02 * np.sin(0.4 * t + 2 * f['phase']),
                                     0.05 * np.sin(0.7 * f['sp'] * t + 1.3 * f['phase']) + 0.03 * on])
            out.append(('fly', dict(phase=f['phase'], size=0.012, a=on, role='flower_b', flap=0), P))
        return out

    def sprite(self, c, kind, item, xy, scale, st):
        x, y = float(xy[0]), float(xy[1])
        add = skia.BlendMode.kPlus
        if kind in ('bird', 'macaw'):
            s = item['size'] * scale
            a = min(item['age'] * 2.0, 1.0)
            path = self.bird_path(x, y, s, item['flap'])
            col = (1.0, 0.78, 0.9) if kind == 'macaw' else (0.82, 0.95, 1.0)
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(*col, 0.5 * a), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, s * 0.22), BlendMode=add))
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(*col, 0.95 * a)))
        elif kind == 'mist':
            r = item['r'] * scale
            c.drawOval(skia.Rect.MakeLTRB(x - r, y - r * 0.4, x + r, y + r * 0.4),
                       skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.35, 0.8, 1.0, 0.16 * item['a']), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, r * 0.3), BlendMode=add))
        elif kind == 'fly':
            s = item['size'] * scale * 0.5
            pulse = 0.5 + 0.5 * np.sin(st['t'] * 2.4 + item['phase'] * 3)
            a = item['a'] * (0.25 + 0.75 * pulse)
            c.drawCircle(x, y, s * 2.6, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.75, 1.0, 0.3, 0.5 * a), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, s * 1.2), BlendMode=add))
            c.drawCircle(x, y, s * 0.55, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.95, 1.0, 0.7, a), BlendMode=add))

    def post(self, img, st):
        # bloom: everything bright breathes light into the dark
        small = cv2.resize(img, (480, 270), interpolation=cv2.INTER_AREA)
        br = np.clip(small - 0.58, 0, 1) * 1.7
        b1 = cv2.GaussianBlur(br, (0, 0), 4)
        b2 = cv2.GaussianBlur(br, (0, 0), 16)
        bl = cv2.resize(b1 * 0.5 + b2 * 0.6, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
        img = 1 - (1 - np.clip(img, 0, 1)) * (1 - np.clip(bl, 0, 1))
        img = img * self._vig
        g = self._grain[int(st['t'] * 30) % len(self._grain)]
        return img + 0.008 * g[..., None]


STYLE = Night
