"""Option 2 - RISO FIELD PRESS.

A three-drum risograph pop-up: Yellow, Fluorescent Pink and Blue spot inks, halftone screens
at different angles, true overprint (multiply) and a little misregistration.  Pieces are
die-cut with a white margin.  The scene is literally printed while you watch: the pop-up
unfolds carrying only its yellow pass, then the pink and blue drums hit and jog into register.
Motion: stop-motion on twos, snappy, with print 'boil'.
"""
import numpy as np
import cv2
import skia

from .base import Style, Plate, Baked, surf, snap, to_image, rgb2sk, fbm, grain, hex2rgb, unit_matrix
from ..scene import W, H

INKS = dict(Y=hex2rgb('#FFE100'), P=hex2rgb('#FF3FA4'), B=hex2rgb('#1583E2'))
ANGLES = dict(Y=0.0, P=75.0, B=15.0)

COV = dict(  # role -> (yellow, pink, blue) coverage
    disc=(1, .10, 0), disc_ring=(.5, 0, 0), disc_mark=(1, .42, 0),
    peak_far=(0, .16, .5), peak_hi=(0, .05, .2), peak_mid=(0, .3, .85), peak_mid_hi=(0, .14, .55), cloud=(0, .05, .04),
    water=(.1, 0, .62), water_lt=(0, 0, .14), water_dp=(0, .12, .9), foam=(0, 0, 0),
    canopy_a=(1, 0, 1), canopy_b=(1, 0, .55), canopy_c=(1, 0, .16), canopy_d=(.55, .1, .9), canopy_d2=(.6, 0, .5), canopy_d3=(.5, 0, .2),
    trunk=(.8, .75, .65), trunk_lt=(.8, .5, .2), leaf_a=(1, 0, .78), leaf_b=(1, 0, .36), fern=(.9, .2, 1),
    cliff=(.9, .7, 0), cliff_lt=(.9, .36, 0), cliff_dk=(.75, 1, .3), stone=(1, .16, 0), stone_lt=(.55, .04, 0), stone_dk=(1, .45, .1),
    door=(.2, 1, 1), cave=(.2, 1, 1), glow=(1, .0, 0), flower_a=(0, 1, 0), flower_b=(1, .32, 0), flower_c=(0, .8, .55),
    figure_a=(.3, 1, 0), figure_b=(0, .3, 1), figure_c=(1, .6, 0), skin=(.25, .2, 0), hat=(.6, 0, 0),
    bird=(0, .6, 1), macaw=(.4, 1, 0), heron=(0, 0, 0), heron_dk=(0, .05, .22), heron_leg=(.2, .7, 1), monkey=(.7, .85, .7), bird_dk=(.2, .8, 1),
    canoe=(.2, 1, .1), rope=(.5, .7, .85), lily=(.9, 0, .42), ground=(.3, 0, .05), bank=(.85, 0, .3), sand=(.38, .1, 0), ink=(0, .75, 1))


class Riso(Style):
    name = 'riso'
    title = 'Riso Field Press'
    rim = 0.0065
    fonts = dict(title=('Inter Display', 'black'), italic=('Inter', 'semibold'), caps=('Inter', 'semibold'), serif=('Inter', 'normal'))
    paper_rgb = (0.985, 0.972, 0.94)
    back_rgb = (0.97, 0.955, 0.92)
    ink_rgb = (0.0, 0.75, 1.0)          # in coverage space (Y, P, B)
    cover_rgb = (1.0, 0.25, 0.64)
    table_rgb = (0.93, 0.9, 0.84)
    edge_rgb = (0.98, 0.96, 0.92)
    light = dict(pos=(-2.2, -3.2, 3.4), ambient=(0.9, 0.9, 0.93), key=(0.14, 0.13, 0.1), shadow=(0.1, 0.16, 0.6),
                 shadow_a=0.3, ao_a=0.0, floor_a=0.3, leaf_a=0.3)
    anim = dict(Style.anim, twos=True, spring_f=3.4, spring_d=7.5, lean=11.0, lean_v=2.0, stagger=0.9, wobble=0.5, open=2.3, open_pow=2.3,
                bounce=0.0, leaf=1.6, leaf_pow=2.1, cam_az=1.2)
    snap_pitch = 1.25
    PASS = dict(P=0.14, B=0.56)        # seconds after landing when each drum prints

    # ---------------------------------------------------------------- coverage drawing
    def cov(self, role, tone=0.0):
        c = COV.get(role)
        if c is None:
            c = COV.get(self.fallback(role), (0, .75, 1))
        y, p, b = c
        k = 1 - 0.22 * tone
        return (min(y, 1), float(np.clip(p * k, 0, 1)), float(np.clip(b * k, 0, 1)))

    def fill(self, c, path, sh, ctx):
        y, p, b = self.cov(sh.role, sh.tone)
        c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(y, p, b, 1.0)))

    def line(self, c, path, sh, ctx):
        tex = ctx['tex']
        if 'textbar' in sh.tags:
            y, p, b = (0, 0.0, 0.5)
        elif sh.role == 'ink' or 'detail' in sh.tags:
            y, p, b = (0, 0.75, 1.0)
        else:
            y, p, b = self.cov(sh.role, sh.tone)
        c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * tex * 1.15, 1.6),
                                    StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join, Color4f=skia.Color4f(y, p, b, 1.0)))

    def text(self, c, sh, ctx, color=None, spacing=0.0):
        super().text(c, sh, ctx, color=(0.0, 0.75, 1.0))

    # ---------------------------------------------------------------- halftone separations
    def screen(self, h, w, angle, period, ox=0.0):
        key = (h, w, angle)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        a = np.radians(angle)
        u = (xx * np.cos(a) + yy * np.sin(a)) * (2 * np.pi / period)
        v = (-xx * np.sin(a) + yy * np.cos(a)) * (2 * np.pi / period)
        return 0.5 + 0.25 * (np.cos(u + ox) + np.cos(v))

    def separate(self, arr, seed, tex):
        """arr: premul BGRA coverage image (R=Y, G=P, B=B). Returns dict ink -> density map."""
        h, w = arr.shape[:2]
        a = np.maximum(arr[..., 3], 1e-4)
        out = {}
        period = 0.0072 * tex
        for i, (ink, ch) in enumerate((('Y', 2), ('P', 1), ('B', 0))):
            cov = np.clip(arr[..., ch] / a, 0, 1)
            scr = self.screen(h, w, ANGLES[ink], period, i * 1.3)
            # threshold with a soft edge; push the tone curve so mid-tones stay open and solids stay solid
            t = np.clip((cov * 1.16 - 0.06 - scr) * 5.5 + 0.5, 0, 1)
            dens = np.where(cov > 0.93, 1.0, np.where(cov < 0.03, 0.0, t)).astype(np.float32)
            dens = cv2.GaussianBlur(dens, (0, 0), 0.7)
            # ink texture: roller mottle + pinholes
            n = fbm(h, w, 60, 3, seed * 7 + i)
            sp = grain(h, w, seed * 11 + i, 0.9)
            dens *= (0.86 + 0.14 * n) * np.clip(1.06 - 0.2 * np.clip(sp - 0.9, 0, 3), 0.25, 1)
            out[ink] = np.clip(dens * arr[..., 3], 0, 1)
        return out

    def ink_plate(self, dens, ink):
        h, w = dens.shape
        rgb = INKS[ink]
        arr = np.zeros((h, w, 4), np.float32)
        d = dens * (0.94 if ink != 'Y' else 1.0)
        # premultiplied "multiply" source: colour = ink * a
        arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3] = rgb[2] * d, rgb[1] * d, rgb[0] * d, d
        return to_image(arr)

    def bake_card(self, card):
        ctx = self.card_ctx(card)
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        c.clipRect(ctx['clip'])
        self.draw_shapes(c, card.shapes, ctx)
        cov = snap(s)
        sil = self.silhouette(card.shapes, ctx, ctx['w'], ctx['h'])
        # keep the die-cut inside the card's own half of a V-fold
        clipm = np.zeros_like(sil)
        r = ctx['clip']
        clipm[:, int(r.left()):int(np.ceil(r.right()))] = 1
        sil *= clipm
        seed = sum(map(ord, card.id))
        paper = np.zeros((ctx['h'], ctx['w'], 4), np.float32)
        g = 0.975 + 0.035 * fbm(ctx['h'], ctx['w'], 30, 3, seed) + 0.012 * grain(ctx['h'], ctx['w'], seed + 1, 0.6)
        for k in range(3):
            paper[..., k] = self.paper_rgb[2 - k] * g * sil
        paper[..., 3] = sil
        bk = Baked(ctx['w'], ctx['h'], ctx['u0'], ctx['t1'], ctx['tex'])
        bk.plates.append(Plate(to_image(np.clip(paper, 0, 1)), 'paper'))
        for ink, d in self.separate(cov, seed, ctx['tex']).items():
            bk.plates.append(Plate(self.ink_plate(d, ink), ink, skia.BlendMode.kMultiply))
        bk.set_alpha(sil, 0.004, 0.018)
        bk.back = self.back_rgb
        return bk

    def paper(self, w, h, seed=0, kind='page'):
        base = np.ones((h, w, 4), np.float32)
        g = 0.975 + 0.035 * fbm(h, w, 30, 3, seed) + 0.012 * grain(h, w, seed + 1, 0.6)
        for k in range(3):
            base[..., k] = self.paper_rgb[2 - k] * g
        return np.clip(base, 0, 1)

    def bake_page(self, name, shapes, side, x_off=0.0, seed=0, gutter=True):
        ctx = self.page_ctx(name, x_off)
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        self.draw_shapes(c, shapes, ctx)
        # press furniture: crop marks + a colour bar
        tex = ctx['tex']
        mk = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0022 * tex, Color4f=skia.Color4f(0, .75, 1, 1))
        for (x, y) in ((0.045, 0.04), (W - 0.045, 0.04), (0.045, H - 0.04), (W - 0.045, H - 0.04)):
            c.drawLine((x - 0.02) * tex, y * tex, (x + 0.02) * tex, y * tex, mk)
            c.drawLine(x * tex, (y - 0.02) * tex, x * tex, (y + 0.02) * tex, mk)
            c.drawCircle(x * tex, y * tex, 0.009 * tex, mk)
        if name in ('legend', 'plate'):
            for i, cc in enumerate(((1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 0), (0, 1, 1), (1, 0, 1), (.5, 0, 0), (0, .5, 0), (0, 0, .5))):
                c.drawRect(skia.Rect.MakeXYWH((0.2 + 0.035 * i) * tex, (H - 0.075) * tex, 0.03 * tex, 0.022 * tex), skia.Paint(Color4f=skia.Color4f(*cc, 1)))
        cov = snap(s)
        paper = self.paper(ctx['w'], ctx['h'], seed)
        if gutter:
            paper = self.gutter_shade(paper, side, 0.26)
        bk = Baked(ctx['w'], ctx['h'], 0.0, H, ctx['tex'])
        seps = self.separate(cov, seed + 3, ctx['tex'])
        if name in ('map', 'verso'):
            # the thin leaf is drawn by the curl mesh from a single texture: pre-compose it
            comp = paper.copy()
            offs = dict(Y=(2, -1), P=(-2, 2), B=(0, 0))
            for ink, d in seps.items():
                d = np.roll(d, offs[ink], (1, 0))[..., None]
                comp[..., :3] *= (1 - d) + d * INKS[ink][::-1]
            bk.plates.append(Plate(to_image(np.clip(comp, 0, 1)), 'comp'))
            return bk
        bk.plates.append(Plate(to_image(paper), 'paper'))
        for ink, d in seps.items():
            bk.plates.append(Plate(self.ink_plate(d, ink), ink, skia.BlendMode.kMultiply))
        return bk

    # ---------------------------------------------------------------- book + table
    def table_detail(self, arr, tex):
        h, w = arr.shape[:2]
        # big soft halftone fields in pink and blue, like a mis-fed test sheet under the book
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        out = arr.copy()
        for (ink, cx, cy, rad, ang) in (('P', 0.3 * w, 0.45 * h, 0.4 * w, 30), ('B', 0.72 * w, 0.95 * h, 0.4 * w, 60), ('Y', 0.72 * w, 0.42 * h, 0.3 * w, 0)):
            d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rad
            cov = np.clip(0.8 - d, 0, 1) * 0.5
            scr = self.screen(h, w, ang, 5.0)
            dens = np.clip((cov - scr) * 3 + 0.5, 0, 1)[..., None] * 0.6
            out[..., :3] *= (1 - dens) + dens * INKS[ink][::-1]
        return out

    def table_shadow(self, ms, mt):
        # the book's shadow is itself a blue halftone
        h, w = ms.shape
        scr = self.screen(h, w, 15, 4.2)
        dens = np.clip((ms * 0.95 - scr) * 3 + 0.5, 0, 1)[..., None] * 0.9
        return ((1 - dens) + dens * INKS['B'][::-1]) * (1 - 0.3 * mt[..., None])

    def cover_detail(self, arr, tex):
        h, w = arr.shape[:2]
        scr = self.screen(h, w, 45, 9.0)
        yy = np.mgrid[0:h, 0:w][0].astype(np.float32) / h
        dens = np.clip((0.2 + 0.6 * yy - scr) * 4 + 0.5, 0, 1)[..., None] * 0.9
        arr[..., :3] *= (1 - dens) + dens * INKS['B'][::-1]
        return np.clip(arr, 0, 1)

    def edge_detail(self, e):
        e[18:26, :, :3] = np.asarray(INKS['P'][::-1], np.float32)
        return np.clip(e, 0, 1)

    def board_edge_rgb(self):
        return (0.86, 0.84, 0.8)

    def tab_rgb(self):
        return INKS['P']

    def tab_paper(self):
        return (0.9, 0.89, 0.88)

    def bake_tab(self):
        self.ink_rgb_save = self.ink_rgb
        self.ink_rgb = (0.08, 0.2, 0.6)
        super().bake_tab()
        self.ink_rgb = self.ink_rgb_save

    # ---------------------------------------------------------------- printing while you watch
    def plate_state(self, bk, plate, cid, st):
        if plate.name in ('paper', 'comp'):
            return 1.0, 0.0, 0.0, None
        k = bk.tex / 1400.0
        base = dict(Y=(2.0, -1.2), P=(-2.2, 1.8), B=(0.4, 0.3))[plate.name]
        step = int(st['tm'] * 15 + 1e-6)
        h = (step * 7919 + sum(map(ord, cid)) * 104729 + ord(plate.name) * 31) % 1000
        jx, jy = ((h % 31) / 30.0 - 0.5) * 1.3, ((h // 31 % 31) / 30.0 - 0.5) * 1.3
        dx, dy = (base[0] + jx) * k, (base[1] + jy) * k
        if cid in ('legend', 'plate') or plate.name == 'Y':
            return 1.0, dx, dy, None
        t = st['after'] - self.PASS[plate.name]
        if cid in self.order:
            t -= 0.035 * self.order[cid]
        if t < 0:
            return 0.0, 0, 0, None
        # the drum hits off-register, then jogs home on twos
        n = int(t * 15)
        jog = (0.55 ** n) * 16.0 * k if n < 7 else 0.0
        sgn = 1 if plate.name == 'P' else -1
        return (0.82 if n == 0 else 1.0), dx + sgn * jog, dy - sgn * jog * 0.45, None

    def bake_extra(self):
        ids = sorted(self.scene.cards, key=lambda cd: -self.scene.mech.key(cd))
        self.order = {cd.id: i for i, cd in enumerate(ids)}
        self.glow_pts = self.glow_points()
        self._grain = [grain(1080, 1920, 300 + i, 0.5) for i in range(4)]

    def overlay(self, c, cid, bk, st, lit=True):
        if not lit:
            return
        wa = st.get('water', 0)
        tex = bk.tex
        blue = rgb2sk(INKS['B'])
        if wa > 0.05:
            if cid in ('floorL', 'floorR'):
                x_off = W if cid == 'floorL' else 0.0
                c.save()
                c.clipPath(self.river_clip(cid), True)
                for pts, fade, i in self.river_streaks(st, x_off, 34):
                    if fade < 0.25:
                        continue
                    path = skia.Path()
                    path.moveTo(*pts[0])
                    for q in pts[1:]:
                        path.lineTo(*q)
                    col = skia.Color4f(0.99, 0.98, 0.95, 1.0) if i % 3 else skia.Color4f(0.08, 0.51, 0.89, 1.0)
                    c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kSquare_Cap,
                                                StrokeWidth=0.006 * tex, Color4f=col))
                for j in range(3):
                    ph = (st['flow'] * 0.4 + j / 3) % 1.0
                    r = 0.05 * (0.5 + 1.6 * ph)
                    if ph < 0.8:
                        c.drawOval(skia.Rect.MakeLTRB((x_off - r) * tex, (H - 0.445 - r * 0.5) * tex, (x_off + r) * tex, (H - 0.445 + r * 0.5) * tex),
                                   skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0045 * tex, Color4f=skia.Color4f(0.99, 0.98, 0.95, 1)))
                c.restore()
            else:
                for (xa, ya, xb, yb, fade, i) in self.fall_streaks(cid, bk, st, 11):
                    if fade < 0.3:
                        continue
                    col = skia.Color4f(0.99, 0.98, 0.95, 1.0) if i % 3 else skia.Color4f(0.08, 0.51, 0.89, 1.0)
                    c.drawLine(xa, ya, xb, yb, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeCap=skia.Paint.kSquare_Cap,
                                                         StrokeWidth=0.0075 * tex, Color4f=col))
        lf = st.get('life', 0)
        if lf > 0.3 and cid in self.glow_pts:
            step = int(st['tm'] * 15)
            for j, (gx, gy, gr) in enumerate(self.glow_pts[cid]):
                if (step // 4 + j) % 3 == 0:
                    continue
                # little printed rays
                p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=0.0028 * tex, StrokeCap=skia.Paint.kRound_Cap, Color4f=rgb2sk(INKS['P']))
                for a in range(0, 360, 45):
                    ca, sa = np.cos(np.radians(a + 22 * (step // 2 % 2))), np.sin(np.radians(a + 22 * (step // 2 % 2)))
                    c.drawLine(gx + ca * gr * 1.6, gy + sa * gr * 1.6, gx + ca * gr * 2.5, gy + sa * gr * 2.5, p)

    def sprite(self, c, kind, item, xy, scale, st):
        step = int(st['tm'] * 15)
        x, y = float(xy[0]), float(xy[1])
        if kind in ('bird', 'macaw'):
            s = item['size'] * scale
            flap = 1.0 if int(item['age'] * 7.5 + item['seed']) % 2 else -0.5      # two wing poses, on twos
            path = self.bird_path(x, y, s, flap)
            c.save(); c.translate(s * 0.07, -s * 0.05)
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(INKS['P'] if kind == 'bird' else INKS['Y'])))
            c.restore()
            c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(INKS['B'] if kind == 'bird' else INKS['P']), BlendMode=skia.BlendMode.kMultiply))
        elif kind == 'mist':
            r = item['r'] * scale
            pitch = 0.012 * scale
            p = skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.99, 0.98, 0.95, 0.95 * item['a']))
            nx = int(r / pitch)
            ox = (step // 3 % 2) * pitch * 0.5
            for i in range(-nx, nx + 1):
                for j in range(-int(nx * 0.45), int(nx * 0.45) + 1):
                    d = np.hypot(i / max(nx, 1), j / max(nx * 0.45, 1))
                    if d < 1:
                        c.drawCircle(x + i * pitch + (j % 2) * pitch * 0.5 + ox, y + j * pitch, pitch * 0.46 * (1 - d) ** 0.7, p)
        elif kind == 'fly':
            s = item['size'] * scale
            col = dict(flower_a=INKS['P'], flower_b=INKS['Y'], flower_c=INKS['B'])[item['role']]
            a = 1.0 if (step // 2 + int(item['phase'] * 10)) % 2 else 0.35
            for sg in (-1, 1):
                p = skia.Path()
                p.moveTo(x, y); p.lineTo(x + sg * s * a, y - s * 0.7); p.lineTo(x + sg * s * a * 0.8, y + s * 0.5); p.close()
                c.drawPath(p, skia.Paint(AntiAlias=True, Color4f=rgb2sk(col, 1.0), BlendMode=skia.BlendMode.kMultiply))

    def post(self, img, st):
        g = self._grain[int(st['tm'] * 15) % len(self._grain)]
        return img * (1 + 0.012 * g[..., None])


STYLE = Riso
