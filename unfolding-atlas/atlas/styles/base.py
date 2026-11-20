"""Style base class: baking semantic shapes into textured paper pieces.

A style turns the shared scene model into *plates* (textures) per pop-up card and per
page, plus the book, the table, sprites for the living things and a post-process.
Subclasses override the medium (fill / line / text / finishing) and the feel parameters.
"""
import numpy as np
import cv2
import skia

from ..scene import W, H

SAMPLING = skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear)
NEAREST_MIP = skia.SamplingOptions(skia.FilterMode.kLinear)


# ------------------------------------------------------------------ small utilities
def hex2rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


def rgb2sk(c, a=1.0):
    c = np.clip(np.asarray(c, float), 0, 1)
    return skia.Color4f(float(c[0]), float(c[1]), float(c[2]), float(a))


def shift(c, tone, amt=0.12, sat=0.0):
    """Lighten/darken a colour in a hue-preserving way (tone -1..1)."""
    c = np.asarray(c, float)
    if tone >= 0:
        out = c + (1 - c) * amt * tone
    else:
        out = c * (1 + amt * 1.4 * tone)
    if sat:
        g = out.mean()
        out = g + (out - g) * (1 + sat)
    return np.clip(out, 0, 1)


def mix(a, b, f):
    return np.asarray(a, float) * (1 - f) + np.asarray(b, float) * f


def fbm(h, w, cell, octaves=4, seed=0, gain=0.5):
    """Value-noise fBm in 0..1 (float32)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = max(cell / (2 ** o), 1.5)
        gh, gw = int(h / c) + 3, int(w / c) + 3
        g = rng.random((gh, gw)).astype(np.float32)
        big = cv2.resize(g, (int(gw * c), int(gh * c)), interpolation=cv2.INTER_CUBIC)
        out += amp * big[:h, :w]
        tot += amp
        amp *= gain
    out /= tot
    return np.clip(out, 0, 1)


def grain(h, w, seed=0, sigma=0.6):
    rng = np.random.default_rng(seed)
    g = rng.standard_normal((h, w)).astype(np.float32)
    if sigma > 0:
        g = cv2.GaussianBlur(g, (0, 0), sigma)
        g /= g.std() + 1e-6
    return g


def fibres(h, w, n, seed=0, length=40, color=(255, 255, 255, 255), width=1.0):
    """Paper fibres: short curved hairlines. Returns float32 alpha map 0..1."""
    rng = np.random.default_rng(seed)
    s = skia.Surface(w, h)
    c = s.getCanvas()
    c.clear(0)
    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=width, Color=skia.ColorWHITE)
    for _ in range(n):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a = rng.uniform(0, 6.28)
        L = length * rng.uniform(0.4, 1.3)
        path = skia.Path()
        path.moveTo(x, y)
        path.quadTo(x + L * 0.5 * np.cos(a) + rng.uniform(-6, 6), y + L * 0.5 * np.sin(a) + rng.uniform(-6, 6), x + L * np.cos(a), y + L * np.sin(a))
        p.setAlphaf(float(rng.uniform(0.25, 1.0)))
        c.drawPath(path, p)
    return s.makeImageSnapshot().toarray()[..., 3].astype(np.float32) / 255.0


def surf(w, h):
    s = skia.Surface(int(w), int(h))
    s.getCanvas().clear(0)
    return s


def snap(s):
    """Surface -> float32 premultiplied BGRA array 0..1."""
    return s.makeImageSnapshot().toarray().astype(np.float32) / 255.0


def to_image(arr, mip=True):
    """float premul BGRA (0..1) or uint8 -> skia.Image."""
    if arr.dtype != np.uint8:
        arr = np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    img = skia.Image.fromarray(np.ascontiguousarray(arr), colorType=skia.kBGRA_8888_ColorType, alphaType=skia.kPremul_AlphaType)
    return img.withDefaultMipmaps() if mip else img


def to_a8(a, mip=False):
    if a.dtype != np.uint8:
        a = np.clip(a * 255.0 + 0.5, 0, 255).astype(np.uint8)
    img = skia.Image.fromarray(np.ascontiguousarray(a), colorType=skia.kAlpha_8_ColorType)
    return img


def unit_matrix(u0, t1, tex):
    """Units (u right, t up) -> texture px (x right, y down)."""
    m = skia.Matrix()
    m.setAll(tex, 0, -u0 * tex, 0, -tex, t1 * tex, 0, 0, 1)
    return m


class Plate:
    def __init__(self, img, name='base', blend=None, lit=True):
        self.img, self.name, self.blend, self.lit = img, name, blend, lit


class Baked:
    """A baked paper piece: plates + silhouette + soft shadow mask."""

    def __init__(self, w, h, u0, t1, tex):
        self.w, self.h, self.u0, self.t1, self.tex = w, h, u0, t1, tex
        self.plates = []
        self.sil = None
        self.shadow = None      # (a8 image, px-per-unit, pad_units)
        self.shadow_soft = None
        self.back = (0.9, 0.88, 0.82)
        self.extra = {}

    def set_alpha(self, alpha, shadow_blur=0.008, soft_blur=0.03):
        """alpha: float32 HxW silhouette. Builds the back-face mask and blurred shadow masks."""
        self.sil = to_a8(alpha)
        self.alpha = alpha
        ds = 4
        pad_u = 0.09
        pad = int(pad_u * self.tex / ds)
        small = cv2.resize(alpha, (max(self.w // ds, 2), max(self.h // ds, 2)), interpolation=cv2.INTER_AREA)
        small = cv2.copyMakeBorder(small, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
        s1 = cv2.GaussianBlur(small, (0, 0), max(shadow_blur * self.tex / ds, 0.6))
        s2 = cv2.GaussianBlur(small, (0, 0), max(soft_blur * self.tex / ds, 0.6))
        self.shadow = (to_a8(s1), self.tex / ds, pad_u, s1.shape)
        self.shadow_soft = (to_a8(s2), self.tex / ds, pad_u, s2.shape)


# ------------------------------------------------------------------ the base style
class Style:
    name = 'base'
    title = 'Base'
    TEX = 1400            # px per unit for cards
    PTEX = 1150           # px per unit for pages
    rim = 0.0             # paper margin left around the art when a card is cut out (units)
    fonts = dict(title=('Caladea', 'bold'), italic=('FreeSerif', 'italic'), caps=('Inter', 'semibold'), serif=('Caladea', 'normal'))

    palette = dict(
        disc='#FFD76A', disc_ring='#FFE9A8', disc_mark='#F5C24F',
        peak_far='#8FB7E8', peak_hi='#B9D6F5', peak_mid='#3F86B8', peak_mid_hi='#6FAEDB', cloud='#FFF6E6',
        water='#19B5D8', water_lt='#BDF0F7', water_dp='#0E8FC0', foam='#FFFFFF',
        canopy_a='#0F6B4F', canopy_b='#1FA35C', canopy_c='#9BD64A', canopy_d='#1D7F7A', canopy_d2='#2FA596', canopy_d3='#7FD4B0',
        trunk='#7A4A2E', trunk_lt='#B67A4B', leaf_a='#14915A', leaf_b='#5DC24B', fern='#0E7A5A',
        cliff='#C9704F', cliff_lt='#E89A6C', cliff_dk='#9A4B3C', stone='#E3B76F', stone_lt='#F6D996', stone_dk='#B5814E',
        door='#3A1F2B', cave='#3A1F2B', glow='#FFB02E', flower_a='#FF4F6D', flower_b='#FFC531', flower_c='#B05CFF',
        figure_a='#E8402F', figure_b='#2F5CE8', figure_c='#F28C1E', skin='#F2C7A0', hat='#F7E3A1',
        bird='#2B2B3A', macaw='#E8402F', heron='#FFFFFF', heron_dk='#C9D5E0', heron_leg='#3A2A20', monkey='#5A3A2A', bird_dk='#20202C',
        canoe='#D9452B', rope='#6B4A32', lily='#3FB76B', ground='#CFE6A8', bank='#8CCB6A', sand='#F3E2A9', ink='#2A2422')
    paper_rgb = (0.96, 0.93, 0.86)
    back_rgb = (0.93, 0.9, 0.83)
    ink_rgb = (0.15, 0.12, 0.1)

    # light: point lamp (world units), colours as rgb multipliers
    light = dict(pos=(-2.6, -2.2, 2.3), ambient=(0.74, 0.74, 0.78), key=(0.36, 0.34, 0.3), shadow=(0.1, 0.07, 0.16),
                 shadow_a=0.42, ao_a=0.22, floor_a=0.4, leaf_a=0.45)

    # animation feel (seconds)
    anim = dict(rest=0.7, leaf=1.75, beat=0.45, open=2.5, open_pow=2.0, bounce=1.2, lean=14.0, lean_v=3.0,
                spring_f=2.6, spring_d=5.5, stagger=1.0, twos=False, life=0.25, total=9.6,
                wobble=0.6, cam_e0=46.0, cam_e1=29.0, cam_d0=4.05, cam_d1=3.3, cam_az=1.8, birds_delay=-0.3)

    def __init__(self, scene):
        self.scene = scene
        self.cards = {}
        self.pages = {}
        self.img = {}

    # ---- palette helpers
    def col(self, role, tone=0.0):
        c = self.palette.get(role)
        if c is None:
            c = self.palette.get(self.fallback(role), '#888888')
        c = hex2rgb(c) if isinstance(c, str) else np.asarray(c, float)
        return shift(c, tone, 0.14)

    @staticmethod
    def fallback(role):
        fb = dict(disc_ring='disc', disc_mark='disc', peak_hi='peak_far', peak_mid_hi='peak_mid', canopy_d2='canopy_b', canopy_d3='canopy_c',
                  canopy_d='canopy_a', water_lt='foam', water_dp='water', trunk_lt='trunk', cliff_lt='cliff', cliff_dk='cliff', stone_lt='stone',
                  stone_dk='stone', door='ink', cave='ink', figure_c='figure_a', heron_dk='heron', heron_leg='ink', bird_dk='ink', monkey='trunk',
                  lily='canopy_b', sand='ground', rope='trunk', hat='flower_b', macaw='flower_a', bird='ink')
        return fb.get(role, 'ink')

    def typeface(self, key):
        fam, st = self.fonts.get(key, self.fonts['serif'])
        style = {'bold': skia.FontStyle.Bold(), 'italic': skia.FontStyle.Italic(), 'normal': skia.FontStyle.Normal(),
                 'semibold': skia.FontStyle(600, 5, skia.FontStyle.kUpright_Slant), 'bolditalic': skia.FontStyle.BoldItalic(),
                 'black': skia.FontStyle(900, 5, skia.FontStyle.kUpright_Slant), 'light': skia.FontStyle(300, 5, skia.FontStyle.kUpright_Slant)}[st]
        return skia.Typeface(fam, style)

    # ---- medium (override these)
    def fill(self, c, path, sh, ctx):
        c.drawPath(path, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.col(sh.role, sh.tone))))

    def line(self, c, path, sh, ctx):
        col = shift(self.col(sh.role, 0), -1.0, 0.35) if 'detail' in sh.tags else self.col(sh.role, sh.tone)
        c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(sh.w * ctx['tex'], 1.0),
                                    StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join, Color4f=rgb2sk(col)))

    def text(self, c, sh, ctx, color=None, spacing=0.0):
        tex = ctx['tex']
        font = skia.Font(self.typeface(sh.font), sh.size * tex)
        font.setSubpixel(True)
        font.setEdging(skia.Font.Edging.kAntiAlias)
        x, y = ctx['M'].mapXY(sh.pos[0], sh.pos[1])
        txt = sh.text
        if sh.font == 'caps' or spacing:
            sp = spacing or 0.18
            widths = font.getWidths(font.textToGlyphs(txt))
            tw = sum(widths) + sp * sh.size * tex * (len(txt) - 1)
        else:
            tw = font.measureText(txt)
        c.save()
        c.translate(x, y)
        c.rotate(-sh.rot)
        p = skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.ink_rgb if color is None else color))
        if sh.font == 'caps' or spacing:
            sp = spacing or 0.18
            xx = -tw / 2
            for ch, wd in zip(txt, widths):
                c.drawString(ch, xx, 0, font, p)
                xx += wd + sp * sh.size * tex
        else:
            c.drawString(txt, -tw / 2, 0, font, p)
        c.restore()

    def draw_shapes(self, c, shapes, ctx, kinds=('fill', 'line', 'text'), skip_tags=()):
        M = ctx['M']
        for sh in shapes:
            if sh.kind not in kinds or any(t in sh.tags for t in skip_tags):
                continue
            if sh.kind == 'text':
                self.text(c, sh, ctx)
                continue
            path = skia.Path(sh.path)
            path.transform(M)
            if sh.kind == 'fill':
                self.fill(c, path, sh, ctx)
            else:
                self.line(c, path, sh, ctx)

    # ---- silhouettes
    def silhouette(self, shapes, ctx, w, h, rim_units=None):
        """Union of all shapes (plus an optional paper rim) as float alpha."""
        rim = self.rim if rim_units is None else rim_units
        s = surf(w, h)
        c = s.getCanvas()
        M = ctx['M']
        pf = skia.Paint(AntiAlias=True, Color=skia.ColorWHITE)
        ps = skia.Paint(AntiAlias=True, Color=skia.ColorWHITE, Style=skia.Paint.kStroke_Style, StrokeJoin=skia.Paint.kRound_Join, StrokeCap=skia.Paint.kRound_Cap)
        for sh in shapes:
            if sh.kind == 'text':
                continue
            path = skia.Path(sh.path)
            path.transform(M)
            if sh.kind == 'fill':
                c.drawPath(path, pf)
                if rim > 0:
                    ps.setStrokeWidth(2 * rim * ctx['tex'])
                    c.drawPath(path, ps)
            else:
                ps.setStrokeWidth(max(sh.w * ctx['tex'], 1.5) + 2 * rim * ctx['tex'])
                c.drawPath(path, ps)
        return snap(s)[..., 3]

    # ---- baking
    def card_ctx(self, card):
        tex = self.TEX
        pad = max(self.rim, 0.004)
        u0, u1 = card.u0 - (0 if (card.vfold and card.side == 'R') else pad), card.u1 + (0 if (card.vfold and card.side == 'L') else pad)
        t1 = card.t1 + pad
        w, h = int(np.ceil((u1 - u0) * tex)), int(np.ceil(t1 * tex))
        M = unit_matrix(u0, t1, tex)
        return dict(M=M, tex=tex, w=w, h=h, u0=u0, t1=t1, kind='card', id=card.id, card=card,
                    clip=skia.Rect.MakeLTRB(max((card.u0 - u0) * tex if card.vfold and card.side == 'R' else 0, 0), 0,
                                            ((card.u1 - u0) * tex if card.vfold and card.side == 'L' else w), h))

    def page_ctx(self, name, x_off=0.0):
        tex = self.PTEX
        w, h = int(W * tex), int(H * tex)
        M = unit_matrix(-x_off, H, tex)
        return dict(M=M, tex=tex, w=w, h=h, u0=-x_off, t1=H, kind='page', id=name, clip=skia.Rect.MakeWH(w, h))

    def bake_card(self, card):
        """Default: one flat plate. Returns Baked."""
        ctx = self.card_ctx(card)
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        c.clipRect(ctx['clip'])
        self.draw_shapes(c, card.shapes, ctx)
        arr = snap(s)
        bk = Baked(ctx['w'], ctx['h'], ctx['u0'], ctx['t1'], ctx['tex'])
        bk.plates.append(Plate(to_image(arr)))
        bk.set_alpha(arr[..., 3])
        bk.back = self.back_rgb
        return bk

    def paper(self, w, h, seed=0, kind='page'):
        """Paper background as float BGRA premul."""
        base = np.ones((h, w, 4), np.float32)
        base[..., :3] = np.asarray(self.paper_rgb, np.float32)[::-1]
        n = fbm(h, w, 220, 4, seed)
        g = grain(h, w, seed + 1, 0.7)
        base[..., :3] *= (0.965 + 0.05 * n[..., None] + 0.012 * g[..., None])
        return np.clip(base, 0, 1)

    def gutter_shade(self, arr, side, strength=0.33, width=0.11):
        """Darken a page texture towards the spine. side: 'L' (spine at right edge) or 'R'."""
        h, w = arr.shape[:2]
        x = np.arange(w, dtype=np.float32) / self.PTEX
        d = (W - x) if side == 'L' else x
        g = 1 - strength * np.exp(-(d / width) ** 1.3) - 0.25 * strength * np.exp(-(d / 0.012))
        arr[..., :3] *= g[None, :, None]
        return arr

    def bake_page(self, name, shapes, side, x_off=0.0, seed=0, gutter=True):
        ctx = self.page_ctx(name, x_off)
        arr = self.paper(ctx['w'], ctx['h'], seed)
        s = surf(ctx['w'], ctx['h'])
        c = s.getCanvas()
        c.drawImage(to_image(arr, False), 0, 0)
        self.draw_shapes(c, shapes, ctx)
        arr = snap(s)
        arr = self.finish_page(arr, ctx)
        if gutter:
            arr = self.gutter_shade(arr, side)
        bk = Baked(ctx['w'], ctx['h'], 0.0, H, ctx['tex'])
        bk.plates.append(Plate(to_image(arr)))
        return bk

    def finish_page(self, arr, ctx):
        return arr

    # ---- book + table (override for character)
    cover_rgb = (0.1, 0.32, 0.34)
    table_rgb = (0.3, 0.2, 0.14)
    edge_rgb = (0.93, 0.9, 0.82)

    def bake_table(self):
        """World-space table texture (6 x 5 units at low res) with the book's contact shadow."""
        tex = 280
        tw, th, ytop = 10.0, 9.0, 7.2          # world extent of the table texture; ytop = far edge
        w, h = int(tw * tex), int(th * tex)
        n = fbm(h, w, 500, 5, 3)
        arr = np.ones((h, w, 4), np.float32)
        arr[..., :3] = np.asarray(self.table_rgb, np.float32)[::-1] * (0.85 + 0.3 * n[..., None])
        arr = self.table_detail(arr, tex)
        # contact shadow of the book
        m = np.zeros((h, w), np.float32)
        x0, x1 = int((tw / 2 - 1.08) * tex), int((tw / 2 + 1.08) * tex)
        y0, y1 = int((ytop - H - 0.08) * tex), int((ytop + 0.08) * tex)
        m[y0:y1, x0:x1] = 1
        ms = cv2.GaussianBlur(np.roll(m, (int(-0.035 * tex), int(0.05 * tex)), (0, 1)), (0, 0), 0.075 * tex)
        mt = cv2.GaussianBlur(m, (0, 0), 0.014 * tex)
        arr[..., :3] *= self.table_shadow(ms, mt)
        self.img['table'] = (to_image(np.clip(arr, 0, 1)), tex, (-tw / 2, ytop))   # world x of left edge, world y of top edge

    def table_shadow(self, ms, mt):
        return (1 - 0.55 * ms[..., None]) * (1 - 0.35 * mt[..., None])

    def table_detail(self, arr, tex):
        return arr

    def bake_book(self):
        tex = 500
        cw, ch = 2 * W + 0.13, H + 0.13
        w, h = int(cw * tex), int(ch * tex)
        n = fbm(h, w, 6, 2, 5)
        arr = np.ones((h, w, 4), np.float32)
        arr[..., :3] = np.asarray(self.cover_rgb, np.float32)[::-1] * (0.9 + 0.2 * n[..., None])
        self.img['cover'] = (to_image(self.cover_detail(arr, tex)), tex, cw, ch)
        # page-block edge (near face): fine striations
        ew, eh = int(W * 600), 48
        rng = np.random.default_rng(4)
        rows = rng.uniform(0.82, 1.0, (eh, 1)).astype(np.float32)
        rows = np.repeat(rows, ew, 1) * (0.97 + 0.06 * rng.random((eh, ew)).astype(np.float32))
        e = np.ones((eh, ew, 4), np.float32)
        e[..., :3] = np.asarray(self.edge_rgb, np.float32)[::-1] * rows[..., None]
        self.img['edge'] = to_image(self.edge_detail(e))
        b = np.ones((8, 64, 4), np.float32)
        b[..., :3] = np.asarray(self.board_edge_rgb(), np.float32)[::-1]
        self.img['board_edge'] = to_image(b, False)

    def board_edge_rgb(self):
        return shift(np.asarray(self.paper_rgb), -1, 0.2)

    def cover_detail(self, arr, tex):
        return np.clip(arr, 0, 1)

    def edge_detail(self, e):
        return np.clip(e, 0, 1)

    def bake_tab(self):
        """The pull-tab that drives the canoe slider."""
        tex = self.PTEX
        w, h = int(0.1 * tex), int(0.11 * tex)
        s = surf(w, h)
        c = s.getCanvas()
        rr = skia.RRect.MakeRectXY(skia.Rect.MakeLTRB(2, -20, w - 2, h - 2), 0.02 * tex, 0.02 * tex)
        c.drawRRect(rr, skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.tab_rgb())))
        p = skia.Paint(AntiAlias=True, Color4f=rgb2sk(self.ink_rgb), Style=skia.Paint.kStroke_Style, StrokeWidth=0.004 * tex, StrokeCap=skia.Paint.kRound_Cap)
        cx, cy = w / 2, h * 0.62
        c.drawLine(cx, cy - 0.02 * tex, cx, cy + 0.02 * tex, p)
        c.drawLine(cx, cy + 0.02 * tex, cx - 0.012 * tex, cy + 0.008 * tex, p)
        c.drawLine(cx, cy + 0.02 * tex, cx + 0.012 * tex, cy + 0.008 * tex, p)
        self.img['tab'] = (to_image(snap(s)), w, h)

    def tab_rgb(self):
        return self.col('flower_b')

    def tab_paper(self):
        return mix(self.back_rgb, self.light['shadow'], 0.3)

    def bake(self, log=print):
        sc = self.scene
        for cd in sc.cards:
            self.cards[cd.id] = self.bake_card(cd)
            log(f'  baked card {cd.id}')
        self.pages['legend'] = self.bake_page('legend', sc.pages['legend'], 'L', 0.0, 1)
        self.pages['map'] = self.bake_page('map', sc.pages['map'], 'R', 0.0, 2)
        self.pages['verso'] = self.bake_page('verso', sc.pages['verso'], 'L', 0.0, 3)
        self.pages['plate'] = self.bake_page('plate', sc.pages['plate'], 'R', 0.0, 4)
        self.pages['floorL'] = self.bake_page('floorL', sc.floor, 'L', W, 5)
        self.pages['floorR'] = self.bake_page('floorR', sc.floor, 'R', 0.0, 6)
        log('  baked pages')
        self.bake_table()
        self.bake_book()
        self.bake_tab()
        self.bake_extra()

    def bake_extra(self):
        pass

    def river_clip(self, cid):
        """River + pool outline in page texture px (for clipping water overlays)."""
        key = 'rclip_' + cid
        if key not in self.img:
            x_off = W if cid == 'floorL' else 0.0
            M = unit_matrix(-x_off, H, self.PTEX)
            p = skia.Path()
            for sh in self.scene.floor:
                if sh.kind == 'fill' and ('river' in sh.tags or 'pool' in sh.tags):
                    q = skia.Path(sh.path)
                    q.transform(M)
                    p.addPath(q)
            p.setFillType(skia.PathFillType.kWinding)
            r = skia.Path()
            r.addRect(skia.Rect.MakeWH(W * self.PTEX, H * self.PTEX))
            self.img[key] = skia.Op(p, r, skia.PathOp.kIntersect_PathOp) or p
        return self.img[key]

    def glow_points(self):
        out = {}
        for cid, sh in self.scene.life['glows']:
            bk = self.cards[cid]
            b = sh.path.getBounds()
            out.setdefault(cid, []).append(((b.centerX() - bk.u0) * bk.tex, (bk.t1 - b.centerY()) * bk.tex, max(b.width(), b.height()) * 0.5 * bk.tex))
        return out

    # ---- per-frame hooks
    def plate_state(self, bk, plate, cid, st):
        """Return (alpha, dx, dy, mask_image_or_None) for a plate this frame."""
        return 1.0, 0.0, 0.0, None

    def plate_paint(self, bk, plate, cid, st):
        """Optional custom paint for a plate (e.g. a moving gold sheen on an alpha mask)."""
        return None

    def overlay(self, c, cid, bk, st, lit=True):
        """Vector overlay in the piece's texture pixel space (water, twinkles...)."""
        pass

    def sprite(self, c, kind, item, xy, scale, st):
        """Draw a free-flying thing (bird / mist / fly) in screen space. scale = px per unit."""
        pass

    def post(self, img, st):
        """img: float32 BGR 0..1 at output resolution."""
        return img

    # ---- shared sprite helpers
    def bird_path(self, x, y, s, flap, heading=1.0):
        """Paper bird: two wing blades hinged on a body. flap in -1..1."""
        a = 0.25 + 0.75 * flap
        p = skia.Path()
        for sg in (-1, 1):
            p.moveTo(x, y)
            p.quadTo(x + sg * s * 0.45, y - s * 0.5 * a - s * 0.08, x + sg * s, y - s * 0.38 * a)
            p.quadTo(x + sg * s * 0.5, y - s * 0.22 * a + s * 0.1, x, y + s * 0.12)
            p.close()
        return p

    # flowing-water streaks along a straight fall (texture px coords)
    def fall_streaks(self, cid, bk, st, n=11):
        out = []
        for fl in self.scene.life['falls']:
            if not cid.startswith(fl['card']):
                continue
            for i in range(n):
                f = (i + 0.5) / n - 0.5
                ph = (st['flow'] * (0.55 + 0.25 * ((i * 7) % 5) / 5) + i * 0.37) % 1.0
                L = 0.16 + 0.1 * ((i * 3) % 4) / 4
                ta = fl['t0'] + (fl['t1'] - fl['t0']) * ph
                tb = max(ta - L * abs(fl['t0'] - fl['t1']), fl['t1'])
                wa = fl['w0'] + (fl['w1'] - fl['w0']) * ph
                wb = fl['w0'] + (fl['w1'] - fl['w0']) * min(ph + L, 1)
                xa, ya = (fl['u'] + f * wa * 0.86 - bk.u0) * bk.tex, (bk.t1 - ta) * bk.tex
                xb, yb = (fl['u'] + f * wb * 0.86 - bk.u0) * bk.tex, (bk.t1 - tb) * bk.tex
                fade = min(ph * 5, 1.0) * min((1 - ph) * 4, 1.0)
                out.append((xa, ya, xb, yb, fade, i))
        return out

    def river_streaks(self, st, x_off, n=26):
        """Streak segments along the river in page texture px. Returns list of (pts Nx2, fade, i)."""
        rv = self.scene.life['river']
        c = rv['c']
        w = np.interp(np.linspace(0, 1, len(c)), np.linspace(0, 1, len(rv['w'])), rv['w'])
        d = np.gradient(c, axis=0)
        d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        nr = np.stack([-d[:, 1], d[:, 0]], 1)
        out = []
        m = len(c)
        for i in range(n):
            lane = ((i * 0.618) % 1.0) - 0.5
            ph = (st['flow'] * (0.22 + 0.1 * ((i * 5) % 7) / 7) + i * 0.173) % 1.0
            L = 0.07 + 0.05 * ((i * 3) % 5) / 5
            ks = np.clip((np.linspace(ph, ph + L, 6)) * (m - 1), 0, m - 1)
            pts = []
            for k in ks:
                k0 = int(k)
                k1 = min(k0 + 1, m - 1)
                f = k - k0
                q = c[k0] * (1 - f) + c[k1] * f + (nr[k0] * (1 - f) + nr[k1] * f) * lane * 0.7 * (w[k0] * (1 - f) + w[k1] * f)
                pts.append(((q[0] + x_off) * self.PTEX, (H - q[1]) * self.PTEX))
            fade = min(ph * 6, 1.0) * min((1 - ph - L) * 6, 1.0)
            if fade > 0:
                out.append((np.array(pts), fade, i))
        return out
