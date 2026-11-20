"""Option 5 - THE GILDED ENGRAVER'S ATLAS.

A hand-coloured copperplate: every tone is cut as swelling engraved lines (direction follows
the material - foliage, rock, water, masonry), tinted with jewel washes on ivory laid paper,
and the moon, lamps and edges are laid in gold leaf whose sheen moves with the light.
Oxblood leather, gilt page edges, green baize.  Motion: stately, mechanical, exact.
"""
import numpy as np
import cv2
import skia

from .base import Style, Plate, Baked, surf, snap, to_image, to_a8, rgb2sk, shift, fbm, grain, hex2rgb, mix
from ..scene import W, H
from ..geom import smooth, ramp

TONE = dict(disc=.04, disc_ring=.0, disc_mark=.34, peak_far=.3, peak_hi=.1, peak_mid=.52, peak_mid_hi=.26, cloud=.05, water=.32, water_lt=.05,
            water_dp=.52, foam=0, canopy_a=.8, canopy_b=.52, canopy_c=.2, canopy_d=.7, canopy_d2=.46, canopy_d3=.2, trunk=.72, trunk_lt=.36,
            leaf_a=.62, leaf_b=.36, fern=.66, cliff=.5, cliff_lt=.22, cliff_dk=.76, stone=.3, stone_lt=.08, stone_dk=.56, door=.97, cave=.97, glow=0,
            flower_a=.25, flower_b=.1, flower_c=.35, figure_a=.4, figure_b=.52, figure_c=.3, skin=.08, hat=.05, bird=.9, macaw=.4, heron=.0, heron_dk=.2,
            heron_leg=.8, monkey=.82, bird_dk=.9, canoe=.5, rope=.6, lily=.4, ground=.06, bank=.26, sand=.07, ink=.9)
# hatch classes: (angle deg, wavy, cross angle)
CLASSES = [(35, 0.0, 100), (-62, 0.0, 20), (80, 0.0, 20), (0, 1.0, 62), (0, 0.0, 90), (86, 0.0, 30), (10, 0.0, 75)]
GOLD_ROLES = ('disc', 'disc_ring', 'glow')


def klass(role):
    if role.startswith(('canopy', 'leaf', 'fern', 'lily', 'bank', 'flower')):
        return 0
    if role.startswith(('cliff', 'cave')):
        return 1
    if role.startswith('peak') or role == 'cloud':
        return 2
    if role.startswith(('water', 'foam')):
        return 3
    if role.startswith(('stone', 'door', 'hat', 'figure')):
        return 4
    if role.startswith(('trunk', 'monkey', 'rope', 'canoe', 'bird', 'heron')):
        return 5
    return 6


class Gilded(Style):
    name = 'gilded'
    title = "Gilded Engraver's Atlas"
    rim = 0.006
    fonts = dict(title=('Caladea', 'bold'), italic=('Caladea', 'italic'), caps=('Caladea', 'normal'), serif=('Caladea', 'normal'))
    palette = dict(Style.palette,
                   disc='#F2C14E', disc_ring='#F7DD8A', disc_mark='#D9902B',
                   peak_far='#5E7BE0', peak_hi='#A9BCF5', peak_mid='#2F4FC4', peak_mid_hi='#5F7FE0', cloud='#F6F0DE',
                   water='#17B6C9', water_lt='#B9EEF0', water_dp='#0B86B8', foam='#FFFFFF',
                   canopy_a='#0A8552', canopy_b='#25B866', canopy_c='#BEE04A', canopy_d='#0F8C86', canopy_d2='#2BB5A0', canopy_d3='#8FDDB8',
                   trunk='#A65B2C', trunk_lt='#D99A5B', leaf_a='#12A05E', leaf_b='#63CC45', fern='#0C8A66',
                   cliff='#E0452F', cliff_lt='#F58A4E', cliff_dk='#B82A3C', stone='#F5B62F', stone_lt='#FFE089', stone_dk='#D98A2B',
                   door='#5A2038', cave='#5A2038', glow='#F2C14E', flower_a='#F03A78', flower_b='#FFC21F', flower_c='#8E4FE8',
                   ground='#E2EBA6', bank='#8FD060', sand='#F5E2A0', lily='#3DBE74', canoe='#D9342B', heron='#FFFFFF')
    paper_rgb = (0.955, 0.915, 0.80)
    back_rgb = (0.93, 0.885, 0.77)
    ink_rgb = (0.12, 0.08, 0.06)
    cover_rgb = (0.42, 0.06, 0.08)
    table_rgb = (0.05, 0.2, 0.15)
    edge_rgb = (0.9, 0.68, 0.24)
    light = dict(pos=(-2.4, -2.8, 2.6), ambient=(0.8, 0.78, 0.76), key=(0.34, 0.32, 0.27), shadow=(0.2, 0.1, 0.05),
                 shadow_a=0.42, ao_a=0.2, floor_a=0.4, leaf_a=0.42)
    anim = dict(Style.anim, rest=0.7, leaf=1.7, beat=0.5, open=2.6, open_pow=1.5, bounce=0.0, lean=7.0, lean_v=0.0, spring_f=2.0, spring_d=11.0,
                stagger=1.2, lock_lead=0.1, wobble=0.3, life=0.35, total=9.7, leaf_pow=2.0, cam_az=-1.8)
    snap_pitch = 0.7

    # ---------------------------------------------------------------- engraving
    def engrave(self, tone, cls, seed, tex):
        """tone 0..1 (darkness), cls int map. Returns ink density 0..1 from swelling parallel cuts."""
        h, w = tone.shape
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        period = 0.0058 * tex
        warp = (fbm(h, w, 0.05 * tex, 2, seed) - 0.5) * 1.4
        ink = np.zeros((h, w), np.float32)
        t = np.clip(tone, 0, 1)
        for k, (ang, wavy, cross) in enumerate(CLASSES):
            m = cls == k
            if not m.any():
                continue
            def lines(a_deg, tt, ph=0.0, wav=0.0):
                a = np.radians(a_deg)
                u = (-xx * np.sin(a) + yy * np.cos(a)) / period
                if wav:
                    u = u + 0.32 * np.sin((xx * np.cos(a) + yy * np.sin(a)) / (period * 2.6) + warp * 3)
                s = 0.5 + 0.5 * np.cos(2 * np.pi * (u + warp * 0.35 + ph))
                wdt = np.clip(tt, 0, 1) ** 0.85 * 0.86            # line width fraction
                return np.clip((s - (1 - wdt)) * 6.0, 0, 1)
            a1 = lines(ang, np.minimum(t * 1.25, 0.72), 0.0, wavy)
            a2 = lines(ang + cross, np.clip((t - 0.46) * 1.7, 0, 0.75), 0.37, 0.0)
            ink = np.where(m, np.maximum(a1, a2), ink)
        ink = np.where(t > 0.93, 1.0, ink)
        return cv2.GaussianBlur(ink.astype(np.float32), (0, 0), 0.6)

    def passes(self, shapes, ctx):
        """Draw tone, hatch-class, tint, outline and gold masks."""
        w, h, tex, M = ctx['w'], ctx['h'], ctx['tex'], ctx['M']
        s_tone, s_cls, s_tint, s_line, s_gold = surf(w, h), surf(w, h), surf(w, h), surf(w, h), surf(w, h)
        for s_ in (s_tone, s_cls, s_tint, s_line, s_gold):
            s_.getCanvas().clipRect(ctx['clip'])
        ct, cc, cti, cl, cg = [s_.getCanvas() for s_ in (s_tone, s_cls, s_tint, s_line, s_gold)]
        ink = np.asarray(self.ink_rgb)
        k = tex / 1400.0
        for sh in shapes:
            if sh.kind == 'text':
                self.text(cl, sh, ctx, color=self.ink_rgb)
                continue
            p = skia.Path(sh.path)
            p.transform(M)
            if sh.kind == 'fill':
                gold = sh.role in GOLD_ROLES
                tn = TONE.get(sh.role, TONE.get(self.fallback(sh.role), 0.4))
                tn = float(np.clip((tn if tn > 0.9 else tn * 0.74) - 0.06 * sh.tone, 0, 1))
                ct.drawPath(p, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(tn, tn, tn, 1)))
                if 'small' not in sh.tags and tn < 0.9 and not gold:
                    b = p.getBounds()
                    ct.save(); ct.clipPath(p, True)
                    shd = skia.GradientShader.MakeLinear([skia.Point(b.left(), b.top()), skia.Point(b.right(), b.bottom())],
                                                         [skia.Color4f(0, 0, 0, 0.0).toColor(), skia.Color4f(1, 1, 1, 0.3).toColor()])
                    ct.drawPaint(skia.Paint(Shader=shd, BlendMode=skia.BlendMode.kPlus))
                    ct.restore()
                v = (klass(sh.role) + 1) * 30 / 255.0
                cc.drawPath(p, skia.Paint(AntiAlias=False, Color4f=skia.Color4f(v, v, v, 1)))
                cti.drawPath(p, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col(sh.role, sh.tone), 1.0)))
                if gold:
                    cg.drawPath(p, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1, 1, 1, 1.0 if sh.role != 'disc_ring' else 0.75)))
                else:
                    cg.drawPath(p, skia.Paint(AntiAlias=True, BlendMode=skia.BlendMode.kClear))
                if 'hi' in sh.tags or 'halo' in sh.tags:
                    continue
                small = 'small' in sh.tags
                cl.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=(1.3 if small else 2.1) * k,
                                          StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(ink, 0.95)))
            else:
                if 'textbar' in sh.tags:
                    cl.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * tex * 0.5, 1.2), Color4f=rgb2sk(ink, 0.45)))
                    continue
                goldline = 'frame' in sh.tags
                wd = max(sh.w * tex * (0.55 if 'detail' in sh.tags else 0.8), 1.3 * k)
                cl.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wd, StrokeCap=skia.Paint.kRound_Cap,
                                          StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(ink, 0.92)))
                if goldline:
                    cg.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wd * 2.2, Color4f=skia.Color4f(1, 1, 1, 1)))
                elif sh.role not in ('ink',) and 'detail' not in sh.tags:
                    cti.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * tex, 1.6), StrokeCap=skia.Paint.kRound_Cap,
                                               Color4f=rgb2sk(self.col(sh.role, sh.tone), 1.0)))
        return snap(s_tone), snap(s_cls), snap(s_tint), snap(s_line), snap(s_gold)

    def laid_paper(self, h, w, seed, tex):
        n = fbm(h, w, 200, 4, seed)
        g = grain(h, w, seed + 1, 0.7)
        xx = np.arange(w, dtype=np.float32)[None, :]
        yy = np.arange(h, dtype=np.float32)[:, None]
        chain = 1 - 0.035 * np.exp(-((xx % (0.045 * tex)) - 2) ** 2 / 3.0)
        laid = 1 - 0.012 * (0.5 + 0.5 * np.sin(yy * 2 * np.pi / (0.0028 * tex)))
        fox = np.clip(fbm(h, w, 40, 2, seed + 4) - 0.72, 0, 1) * 0.5
        p = (0.95 + 0.07 * n + 0.012 * g) * chain * laid
        out = np.ones((h, w, 4), np.float32)
        for k in range(3):
            out[..., k] = self.paper_rgb[2 - k] * p * (1 - fox * (0.25, 0.14, 0.06)[k])
        return np.clip(out, 0, 1)

    def compose(self, shapes, ctx, paper, seed):
        """paper: float BGRA (premul, alpha = silhouette). Returns (comp, gold_mask)."""
        tone, cls, tint, line, gold = self.passes(shapes, ctx)
        tex = ctx['tex']
        h, w = paper.shape[:2]
        a = np.maximum(tone[..., 3], 1e-4)
        tn = np.clip(tone[..., 2] / a, 0, 1) * (tone[..., 3] > 0.5)
        ci = np.rint(cls[..., 2] * 255 / 30).astype(np.int32) - 1
        ink = self.engrave(tn, ci, seed, tex) * tone[..., 3]
        # hand colouring: slightly uneven, slightly off the lines
        ta = tint[..., 3:4]
        tcol = tint[..., :3] / np.maximum(ta, 1e-4)
        dx = (fbm(h, w, 0.04 * tex, 2, seed + 7) - 0.5) * 0.004 * tex
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        tcol = cv2.remap(tcol, xx + dx, yy + dx * 0.6, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        ta = cv2.remap(ta[..., 0], xx + dx, yy + dx * 0.6, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)[..., None]
        dens = np.clip(0.86 + 0.14 * fbm(h, w, 0.08 * tex, 3, seed + 8), 0, 1)[..., None] * 0.97
        out = paper.copy()
        pa = paper[..., 3:4]
        out[..., :3] *= (1 - ta * dens) + ta * dens * tcol
        inkc = np.asarray(self.ink_rgb, np.float32)[::-1]
        la = np.clip(line[..., 3:4], 0, 1)
        dk = np.clip(ink[..., None] * 0.8 + la, 0, 1) * (0.9 + 0.1 * fbm(h, w, 12, 2, seed + 9)[..., None])
        out[..., :3] = out[..., :3] * (1 - dk) + inkc * dk * pa
        return np.clip(out, 0, 1), np.clip(gold[..., 3] * pa[..., 0], 0, 1)

    def bake_card(self, card):
        ctx = self.card_ctx(card)
        w, h, tex = ctx['w'], ctx['h'], ctx['tex']
        sil = self.silhouette(card.shapes, ctx, w, h)
        r = ctx['clip']
        clipm = np.zeros_like(sil)
        clipm[:, int(r.left()):int(np.ceil(r.right()))] = 1
        sil *= clipm
        seed = sum(map(ord, card.id))
        paper = self.laid_paper(h, w, seed, tex) * sil[..., None]
        comp, gold = self.compose(card.shapes, ctx, paper, seed)
        bk = Baked(w, h, ctx['u0'], ctx['t1'], tex)
        bk.plates.append(Plate(to_image(comp), 'comp'))
        if gold.max() > 0.05:
            gold = gold * (0.9 + 0.1 * grain(h, w, seed + 3, 0.8))
            bk.plates.append(Plate(to_a8(np.clip(gold, 0, 1)), 'gold'))
        bk.set_alpha(sil, 0.007, 0.03)
        bk.back = self.back_rgb
        return bk

    def bake_page(self, name, shapes, side, x_off=0.0, seed=0, gutter=True):
        ctx = self.page_ctx(name, x_off)
        w, h, tex = ctx['w'], ctx['h'], ctx['tex']
        paper = self.laid_paper(h, w, seed, tex)
        comp, gold = self.compose(shapes, ctx, paper, seed + 20)
        if gutter:
            comp = self.gutter_shade(comp, side, 0.34)
        bk = Baked(w, h, 0.0, H, tex)
        if name in ('map', 'verso'):
            # the curling leaf uses one texture: lay the gold in flat
            g = gold[..., None]
            comp[..., :3] = comp[..., :3] * (1 - g) + np.array([0.3, 0.68, 0.92], np.float32) * g
            bk.plates.append(Plate(to_image(comp), 'comp'))
            return bk
        bk.plates.append(Plate(to_image(comp), 'comp'))
        if gold.max() > 0.05:
            bk.plates.append(Plate(to_a8(np.clip(gold * (0.9 + 0.1 * grain(h, w, seed + 3, 0.8)), 0, 1)), 'gold'))
        return bk

    # ---------------------------------------------------------------- book + table
    def table_detail(self, arr, tex):
        h, w = arr.shape[:2]
        n = fbm(h, w, 5, 2, 12)
        arr[..., :3] *= (0.9 + 0.2 * n[..., None])
        return arr

    def cover_detail(self, arr, tex):
        h, w = arr.shape[:2]
        n = fbm(h, w, 14, 3, 6)
        arr[..., :3] *= (0.8 + 0.4 * n[..., None])
        s = surf(w, h)
        c = s.getCanvas()
        c.drawImage(to_image(np.clip(arr, 0, 1), False), 0, 0)
        gold = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.007 * tex, Color4f=skia.Color4f(0.95, 0.74, 0.3, 0.95))
        c.drawRect(skia.Rect.MakeLTRB(0.02 * tex, 0.02 * tex, w - 0.02 * tex, h - 0.02 * tex), gold)
        gold.setStrokeWidth(0.0025 * tex)
        c.drawRect(skia.Rect.MakeLTRB(0.034 * tex, 0.034 * tex, w - 0.034 * tex, h - 0.034 * tex), gold)
        return snap(s)

    def edge_detail(self, e):
        # gilt edges: bright where the leaf catches
        h, w = e.shape[:2]
        sheen = 0.75 + 0.5 * np.exp(-((np.arange(w) / w - 0.3) / 0.18) ** 2)
        e[..., :3] *= sheen[None, :, None].astype(np.float32)
        return np.clip(e, 0, 1)

    def board_edge_rgb(self):
        return (0.8, 0.6, 0.22)

    def tab_rgb(self):
        return hex2rgb('#D9342B')

    def tab_paper(self):
        return (0.82, 0.77, 0.66)

    def bake_tab(self):
        keep = self.ink_rgb
        self.ink_rgb = (0.98, 0.85, 0.5)
        super().bake_tab()
        self.ink_rgb = keep

    # ---------------------------------------------------------------- gold that moves with the light
    def bake_extra(self):
        self.glow_pts = self.glow_points()
        self._grain = [grain(1080, 1920, 900 + i, 0.7) for i in range(5)]
        yy, xx = np.mgrid[0:1080, 0:1920].astype(np.float32)
        d = np.sqrt(((xx - 960) / 1300) ** 2 + ((yy - 540) / 820) ** 2)
        self._vig = np.clip(1.1 - 0.5 * d ** 2.2, 0.35, 1.1)[..., None]

    def plate_paint(self, bk, plate, cid, st):
        if plate.name != 'gold':
            return None
        # the sheen position follows the opening angle and the camera, so the leaf "turns" in the light
        cam = st['cam']
        ph = 0.9 * st['theta'] / np.pi + 0.035 * cam['elev'] + 0.1 * cam['az'] + 0.16 * st['t'] + (sum(map(ord, cid)) % 7) * 0.11
        span = 1.5 * max(bk.w, bk.h)
        x0 = ((ph % 1.0) * 2.0 - 0.5) * span - span * 0.5
        cols = [(0.62, 0.42, 0.1), (0.86, 0.62, 0.18), (1.0, 0.86, 0.42), (1.0, 0.98, 0.82), (1.0, 0.86, 0.42), (0.86, 0.62, 0.18), (0.62, 0.42, 0.1)]
        shd = skia.GradientShader.MakeLinear([skia.Point(x0, 0), skia.Point(x0 + span, span * 0.45)],
                                             [rgb2sk(c_).toColor() for c_ in cols], [0.0, 0.25, 0.42, 0.5, 0.58, 0.75, 1.0], skia.TileMode.kMirror)
        return skia.Paint(AntiAlias=True, Shader=shd)

    def overlay(self, c, cid, bk, st, lit=True):
        if not lit:
            return
        wa = st.get('water', 0)
        tex = bk.tex
        ink = np.asarray(self.ink_rgb)
        if wa > 0.02:
            if cid in ('floorL', 'floorR'):
                x_off = W if cid == 'floorL' else 0.0
                c.save()
                c.clipPath(self.river_clip(cid), True)
                for pts, fade, i in self.river_streaks(st, x_off, 34):
                    path = skia.Path()
                    path.moveTo(*pts[0])
                    for q in pts[1:]:
                        path.lineTo(*q)
                    col = skia.Color4f(1, 1, 0.96, 0.85 * wa * fade) if i % 3 else skia.Color4f(1.0, 0.82, 0.35, 0.95 * wa * fade)
                    c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap, StrokeWidth=0.0034 * tex, Color4f=col))
                for j in range(3):
                    ph = (st['flow'] * 0.3 + j / 3) % 1.0
                    r = 0.05 * (0.5 + 1.7 * ph)
                    c.drawOval(skia.Rect.MakeLTRB((x_off - r) * tex, (H - 0.445 - r * 0.5) * tex, (x_off + r) * tex, (H - 0.445 + r * 0.5) * tex),
                               skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0028 * tex, Color4f=rgb2sk(ink, 0.6 * wa * (1 - ph))))
                c.restore()
            else:
                for (xa, ya, xb, yb, fade, i) in self.fall_streaks(cid, bk, st, 13):
                    col = skia.Color4f(1, 1, 0.97, 0.9 * wa * fade) if i % 3 else skia.Color4f(1.0, 0.82, 0.35, 0.95 * wa * fade)
                    c.drawLine(xa, ya, xb, yb, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kRound_Cap,
                                                         StrokeWidth=(0.0034 + 0.002 * (i % 2)) * tex, Color4f=col))
        lf = st.get('life', 0)
        if lf > 0 and cid in self.glow_pts:
            for j, (gx, gy, gr) in enumerate(self.glow_pts[cid]):
                # four-point glints on the gilded lamps
                tw = max(0.0, np.sin(1.7 * st['t'] + j * 2.4)) ** 6
                L = gr * (1.5 + 3.5 * tw)
                p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0016 * tex, StrokeCap=skia.Paint.kRound_Cap,
                               Color4f=skia.Color4f(1, 0.97, 0.8, lf * (0.35 + 0.65 * tw)))
                c.drawLine(gx - L, gy, gx + L, gy, p)
                c.drawLine(gx, gy - L, gx, gy + L, p)

    def sprite(self, c, kind, item, xy, scale, st):
        x, y = float(xy[0]), float(xy[1])
        ink = np.asarray(self.ink_rgb)
        if kind in ('bird', 'macaw'):
            s = item['size'] * scale
            a = min(item['age'] * 2.5, 1.0)
            path = self.bird_path(x, y, s, item['flap'])
            if kind == 'macaw':
                c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col('canoe'), a)))
                c.drawPath(self.bird_path(x, y, s * 0.5, item['flap']), skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.98, 0.8, 0.3, a)))
                c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=1.3 * st['ss'], Color4f=rgb2sk(ink, a)))
            else:
                c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(ink, 0.95 * a)))
                c.drawPath(self.bird_path(x, y - s * 0.03, s * 0.5, item['flap']), skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.98, 0.8, 0.3, a)))
        elif kind == 'mist':
            # stippled, the way an engraver renders vapour
            r = item['r'] * scale
            rng = np.random.default_rng(int(item['phase'] * 1000))
            p = skia.Paint(AntiAlias=True, Color4f=skia.Color4f(1, 1, 0.97, 0.75 * item['a']))
            for _ in range(60):
                rr = r * np.sqrt(rng.random())
                th = rng.uniform(0, 6.28)
                c.drawCircle(x + rr * np.cos(th), y + rr * 0.4 * np.sin(th), r * 0.035 * (1.2 - rr / r), p)
        elif kind == 'fly':
            s = item['size'] * scale
            tw = max(0.0, np.sin(2.2 * st['t'] + item['phase'] * 3)) ** 3
            p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=1.3 * st['ss'], StrokeCap=skia.Paint.kRound_Cap,
                           Color4f=skia.Color4f(1.0, 0.86, 0.4, item['a'] * (0.4 + 0.6 * tw)))
            L = s * (0.4 + 0.8 * tw)
            c.drawLine(x - L, y, x + L, y, p)
            c.drawLine(x, y - L, x, y + L, p)

    def post(self, img, st):
        img = img * self._vig
        img[..., 2] *= 1.02
        img[..., 0] *= 0.97
        g = self._grain[int(st['t'] * 30) % len(self._grain)]
        return img + 0.008 * g[..., None]


STYLE = Gilded
