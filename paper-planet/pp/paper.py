"""Paper material helpers: fibre texture, cut-paper sprite drawing (Art), sprite finishing."""
import math
import numpy as np
import cv2
import skia

RGBA = skia.ColorType.kRGBA_8888_ColorType
PREMUL = skia.AlphaType.kPremul_AlphaType


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def col(h, a=1.0):
    if isinstance(h, skia.Color4f):
        return h
    if isinstance(h, str):
        r, g, b = hexrgb(h)
    else:
        r, g, b = h[:3]
    return skia.Color4f(float(r), float(g), float(b), float(a))


def mixc(a, b, t):
    a = hexrgb(a) if isinstance(a, str) else np.asarray(a, np.float32)
    b = hexrgb(b) if isinstance(b, str) else np.asarray(b, np.float32)
    return a * (1 - t) + b * t


def lighten(c, t):
    return mixc(c, '#ffffff', t)


def darken(c, t):
    return mixc(c, '#1a1033', t)


def make_surface(w, h):
    info = skia.ImageInfo.Make(int(w), int(h), RGBA, PREMUL)
    return skia.Surface.MakeRaster(info)


# --------------------------------------------------------------------------- fibre texture
_FIB = {}


def fibre(size=1024, seed=7):
    """Tileable paper fibre/tooth texture, float32, mean ~0.5."""
    key = (size, seed)
    if key in _FIB:
        return _FIB[key]
    rng = np.random.default_rng(seed)

    def bw(sig):
        n = rng.standard_normal((size, size)).astype(np.float32)
        pad = int(sig * 4) + 2
        n = np.pad(n, pad, mode='wrap')
        n = cv2.GaussianBlur(n, (0, 0), sig)[pad:-pad, pad:-pad]
        return n / (n.std() + 1e-6)

    mott = 0.55 * bw(22) + 0.35 * bw(7) + 0.30 * bw(2.2) + 0.25 * bw(0.8)
    surf = make_surface(size, size)
    c = surf.getCanvas()
    c.clear(skia.Color4f(0.5, 0.5, 0.5, 1))
    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style)
    p.setStrokeCap(skia.Paint.kRound_Cap)
    for i in range(3400):
        x, y = rng.uniform(0, size, 2)
        L = rng.uniform(10, 46)
        a = rng.uniform(0, math.pi)
        dx, dy = math.cos(a) * L, math.sin(a) * L
        bx, by = rng.normal(0, L * 0.18, 2)
        light = rng.random() < 0.6
        p.setColor4f(skia.Color4f(1, 1, 1, rng.uniform(0.05, 0.2)) if light
                     else skia.Color4f(0, 0, 0, rng.uniform(0.04, 0.14)))
        p.setStrokeWidth(float(rng.uniform(0.5, 1.3)))
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                if not (-60 < x + ox < size + 60 and -60 < y + oy < size + 60):
                    continue
                path = skia.Path()
                path.moveTo(x + ox, y + oy)
                path.quadTo(x + ox + dx / 2 + bx, y + oy + dy / 2 + by, x + ox + dx, y + oy + dy)
                c.drawPath(path, p)
    f = surf.toarray()[..., 0].astype(np.float32) / 255.0
    t = 0.5 + (f - 0.5) * 1.1 + 0.05 * mott
    t = np.clip(t, 0.0, 1.0)
    t += 0.5 - t.mean()
    _FIB[key] = t.astype(np.float32)
    return _FIB[key]


def fibre_crop(h, w, seed):
    f = fibre()
    S = f.shape[0]
    rng = np.random.default_rng(seed)
    oy, ox = rng.integers(0, S, 2)
    ys = (np.arange(h) + oy) % S
    xs = (np.arange(w) + ox) % S
    return f[np.ix_(ys, xs)]


# --------------------------------------------------------------------------- path helpers
def poly_path(pts, closed=True):
    p = skia.Path()
    p.moveTo(float(pts[0][0]), float(pts[0][1]))
    for x, y in pts[1:]:
        p.lineTo(float(x), float(y))
    if closed:
        p.close()
    return p


def smooth_path(pts, closed=True, tension=0.5):
    """Catmull-Rom through pts -> cubic Beziers."""
    pts = [(float(x), float(y)) for x, y in pts]
    n = len(pts)
    p = skia.Path()
    p.moveTo(*pts[0])
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        if closed:
            p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        else:
            p0 = pts[max(i - 1, 0)]
            p1, p2 = pts[i], pts[i + 1]
            p3 = pts[min(i + 2, n - 1)]
        k = tension / 3.0 * 2
        c1 = (p1[0] + (p2[0] - p0[0]) * k / 2, p1[1] + (p2[1] - p0[1]) * k / 2)
        c2 = (p2[0] - (p3[0] - p1[0]) * k / 2, p2[1] - (p3[1] - p1[1]) * k / 2)
        p.cubicTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    if closed:
        p.close()
    return p


def mir(pts, cx):
    """Mirror half outline around x=cx, returning a closed symmetric outline."""
    return list(pts) + [(2 * cx - x, y) for x, y in reversed(pts)]


# --------------------------------------------------------------------------- sprites
class Sprite:
    __slots__ = ('rgba', 'img', 'back', 'mask', 'pw', 'ph', 'W', 'H', 'name', 'aspect')

    def __init__(self, rgba, back_rgba, W, H, name=''):
        self.rgba = rgba
        self.ph, self.pw = rgba.shape[:2]
        self.W, self.H = W, H
        self.aspect = H / W
        self.name = name
        self.img = skia.Image.fromarray(np.ascontiguousarray(rgba), colorType=RGBA, alphaType=PREMUL).withDefaultMipmaps()
        self.back = skia.Image.fromarray(np.ascontiguousarray(back_rgba), colorType=RGBA, alphaType=PREMUL).withDefaultMipmaps()
        m = np.ascontiguousarray((rgba[..., 3] > 90).astype(np.uint8) * 255)
        self.mask = skia.Image.fromarray(m, colorType=skia.ColorType.kAlpha_8_ColorType)


class Art:
    """Cut-paper drawing surface. Design coords: x right, y UP, origin bottom-left, size W x H."""

    def __init__(self, W, H, px_w, seed=0, back='#efe4cf'):
        px_w = max(40.0, float(px_w))
        self.W, self.H = float(W), float(H)
        self.k = px_w / W
        self.pw = int(math.ceil(px_w))
        self.ph = int(math.ceil(H * self.k))
        self.surf = make_surface(self.pw, self.ph)
        self.c = self.surf.getCanvas()
        self.c.clear(skia.Color4f(0, 0, 0, 0))
        self.c.translate(0, self.ph)
        self.c.scale(self.k, -self.k)
        self.seed = seed
        self.back = back
        self.sh_alpha = 0.30
        self.px = 1.0 / self.k  # one pixel in design units

    # -- core
    def _fill_paint(self, color, grad=None):
        p = skia.Paint(AntiAlias=True)
        if grad is not None:
            (x0, y0, x1, y1, cols) = grad
            p.setShader(skia.GradientShader.MakeLinear(
                [skia.Point(x0, y0), skia.Point(x1, y1)], [col(c_) for c_ in cols]))
        else:
            p.setColor4f(col(color))
        return p

    def path(self, path, color, sh=True, rim=True, grad=None, stroke=None, alpha=1.0):
        c = self.c
        style_stroke = stroke is not None
        if sh:
            sp = skia.Paint(AntiAlias=True)
            sp.setColor4f(skia.Color4f(0.08, 0.04, 0.16, self.sh_alpha))
            sig = max(1.2, min(self.pw, self.ph) * 0.012) * self.px
            sp.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, sig))
            sp.setBlendMode(skia.BlendMode.kSrcATop)
            if style_stroke:
                sp.setStyle(skia.Paint.kStroke_Style)
                sp.setStrokeWidth(stroke)
                sp.setStrokeCap(skia.Paint.kRound_Cap)
                sp.setStrokeJoin(skia.Paint.kRound_Join)
            c.save()
            c.translate(1.3 * self.px, -1.8 * self.px)
            c.drawPath(path, sp)
            c.restore()
        p = self._fill_paint(color, grad)
        if alpha < 1:
            p.setAlphaf(alpha)
        if style_stroke:
            p.setStyle(skia.Paint.kStroke_Style)
            p.setStrokeWidth(stroke)
            p.setStrokeCap(skia.Paint.kRound_Cap)
            p.setStrokeJoin(skia.Paint.kRound_Join)
        c.drawPath(path, p)
        if rim and not style_stroke and grad is None and color is not None:
            rp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style)
            rp.setStrokeWidth(2.2 * self.px)
            lc = lighten(color, 0.32)
            rp.setColor4f(skia.Color4f(float(lc[0]), float(lc[1]), float(lc[2]), 0.55))
            c.save()
            c.clipPath(path, True)
            c.drawPath(path, rp)
            c.restore()
        return path

    def poly(self, pts, color, smooth=False, **kw):
        path = smooth_path(pts) if smooth else poly_path(pts)
        return self.path(path, color, **kw)

    def line(self, pts, color, width, smooth=False, sh=False, **kw):
        path = smooth_path(pts, closed=False) if smooth else poly_path(pts, closed=False)
        return self.path(path, color, sh=sh, rim=False, stroke=width, **kw)

    def circ(self, x, y, r, color, **kw):
        path = skia.Path()
        path.addCircle(x, y, r)
        return self.path(path, color, **kw)

    def oval(self, x, y, rx, ry, color, rot=0, **kw):
        path = skia.Path()
        path.addOval(skia.Rect(x - rx, y - ry, x + rx, y + ry))
        if rot:
            m = skia.Matrix()
            m.setRotate(rot, x, y)
            path.transform(m)
        return self.path(path, color, **kw)

    def rect(self, x, y, w, h, color, r=0, **kw):
        path = skia.Path()
        if r:
            path.addRoundRect(skia.Rect(x, y, x + w, y + h), r, r)
        else:
            path.addRect(skia.Rect(x, y, x + w, y + h))
        return self.path(path, color, **kw)

    def hole(self, path):
        if not isinstance(path, skia.Path):
            path = poly_path(path)
        p = skia.Paint(AntiAlias=True)
        p.setBlendMode(skia.BlendMode.kClear)
        self.c.drawPath(path, p)

    def hole_circ(self, x, y, r):
        p = skia.Path()
        p.addCircle(x, y, r)
        self.hole(p)

    def clip(self, path):
        self.c.save()
        self.c.clipPath(path, True)

    def unclip(self):
        self.c.restore()

    # -- finish
    def done(self, name='', fib=0.20, bevel=0.22, emissive=False, ground=True):
        a = self.surf.toarray().astype(np.float32) / 255.0  # premul RGBA
        al = a[..., 3:4]
        rgb = a[..., :3]
        h, w = al.shape[:2]
        if not emissive:
            f = fibre_crop(h, w, self.seed * 7919 + 13)[..., None]
            rgb = rgb * (1.0 + fib * (f - 0.5) * 2.0)
            b = max(1.0, min(2.2, min(h, w) / 90.0))
            M1 = np.float32([[1, 0, b], [0, 1, b]])
            M2 = np.float32([[1, 0, -b], [0, 1, -b]])
            a2 = al[..., 0]
            hi = np.clip(a2 - cv2.warpAffine(a2, M1, (w, h)), 0, 1)[..., None]
            lo = np.clip(a2 - cv2.warpAffine(a2, M2, (w, h)), 0, 1)[..., None]
            rgb = rgb + bevel * hi * al * 1.0 - bevel * 1.3 * lo * rgb
        if ground and not emissive:
            yy = (h - 1 - np.arange(h, dtype=np.float32))[:, None, None]
            rgb = rgb * (1.0 - 0.30 * np.exp(-yy / max(3.0, 0.07 * h)))
        rgb = np.clip(rgb, 0, al)
        out = np.concatenate([rgb, al], -1)
        rgba = (out * 255.0 + 0.5).astype(np.uint8)
        bc = hexrgb(self.back)
        fb = fibre_crop(h, w, self.seed * 31 + 5)[..., None]
        brgb = bc[None, None, :] * (1.0 + 0.22 * (fb - 0.5) * 2.0) * al
        brgb = np.clip(brgb, 0, al)
        back = (np.concatenate([brgb, al], -1) * 255.0 + 0.5).astype(np.uint8)
        return Sprite(rgba, back, self.W, self.H, name)
