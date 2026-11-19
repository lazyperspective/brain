"""Five art directions for the same film (style-lab).

Every style gets two rasters of the identical frame (see look.py):
    A  the COLOUR pass: fills and coloured lines, already mapped through style.cmap(); no ink, no pencil
    B  the ROLE pass:   R = ink line-art coverage, G = construction pencil, B = wetness of the colour wash
and composes them in its own medium in post().  Textures are anchored to the map (like the film's paper
grain), so they travel with the camera and a close-up is a true crop of the same sheet.

    current     the film as it is (no look layer at all)
    riso        "Spot-Ink Atlas"     - three riso drums + a midnight key, halftone, overprint, misregistration
    watercolour "Field Journal"      - sepia pen, transparent washes that bloom past the line, granulating
    blueprint   "Patent & Gilt"      - cyanotype: white ruling-pen lines, chalk construction, gold leaf
    papercut    "Paper Theatre"      - no outlines: deckle-cut card stocks stacked with real cast shadows
    cloisonne   "Enamel & Gold"      - gold wire cloisons, jewel enamels fired in, on black lacquer
"""
import colorsys
import math
import os

import cv2
import numpy as np
import skia

from . import look

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(HERE, 'cache')
N = 2048

# ----------------------------------------------------------------- helpers ---
_TEX = {}


def tex(name, parts, seed, aniso=(1.0, 1.0)):
    """Tileable N x N noise: sum of gaussian-filtered white noise, unit std.  parts = [(sigma_px, weight)]."""
    key = (name, seed)
    if key in _TEX:
        return _TEX[key]
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, '%s_%d.npy' % (name, seed))
    if os.path.exists(fn):
        a = np.load(fn)
    else:
        rng = np.random.default_rng(seed)
        fy = np.fft.fftfreq(N)[:, None]
        fx = np.fft.rfftfreq(N)[None, :]
        acc = np.zeros((N, N), np.float32)
        for sig, wgt in parts:
            sx, sy = sig * aniso[0], sig * aniso[1]
            k = np.exp(-2 * (np.pi ** 2) * ((sx * fx) ** 2 + (sy * fy) ** 2))
            n = np.fft.irfft2(np.fft.rfft2(rng.standard_normal((N, N)).astype(np.float32)) * k, s=(N, N))
            acc += (wgt * n / n.std()).astype(np.float32)
        a = (acc / acc.std()).astype(np.float32)
        np.save(fn, a)
    _TEX[key] = a
    return a


def tpx_for(zoom):
    """texture px per map px: two densities, like the film's own paper (switches only inside swoops)"""
    return 2.6 if zoom < 4.0 else 5.8


def sample(t, cam, size, tpx=None):
    w, h = size
    cx, cy, zoom = cam
    tpx = tpx or tpx_for(zoom)
    s = tpx / zoom
    M = np.array([[s, 0, (cx - w / 2 / zoom) * tpx + 4096], [0, s, (cy - h / 2 / zoom) * tpx + 4096]], np.float32)
    return cv2.warpAffine(t, M, (w, h), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_WRAP)


def mapxy(cam, size):
    w, h = size
    cx, cy, zoom = cam
    x = ((np.arange(w, dtype=np.float32) - w / 2) / zoom + cx)[None, :]
    y = ((np.arange(h, dtype=np.float32) - h / 2) / zoom + cy)[:, None]
    return x, y


def shift(img, dx, dy):
    if abs(dx) < 1e-3 and abs(dy) < 1e-3:
        return img
    M = np.array([[1, 0, dx], [0, 1, dy]], np.float32)
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def blur(img, sig):
    if sig < 0.3:
        return img
    if sig > 6:                       # big blurs on a quarter-size copy
        h, w = img.shape[:2]
        sm = cv2.resize(img, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
        sm = cv2.GaussianBlur(sm, (0, 0), sig / 4)
        return cv2.resize(sm, (w, h), interpolation=cv2.INTER_LINEAR)
    return cv2.GaussianBlur(img, (0, 0), sig)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lum(c):
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255.0


def ramp(stops, t):
    """piecewise-linear colour ramp; stops = [(t, (r,g,b)), ...]; t scalar or array"""
    ts = np.array([s[0] for s in stops], np.float32)
    cs = np.array([s[1] for s in stops], np.float32)
    t = np.asarray(t, np.float32)
    return np.stack([np.interp(t, ts, cs[:, k]) for k in range(3)], -1)


def is_accent(c):
    h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    return 0.066 < h < 0.115 and s > 0.60 and v > 0.84


def screen_vignette(size, strength, power=2.2):
    w, h = size
    x = (np.arange(w, dtype=np.float32) - w / 2) / (w / 2)
    y = (np.arange(h, dtype=np.float32) - h / 2) / (h / 2)
    r = np.sqrt(x[None, :] ** 2 * 0.8 + y[:, None] ** 2 * 1.0) / 1.25
    return (1.0 - strength * np.clip(r, 0, 1.3) ** power).astype(np.float32)


def to8(img):
    return np.clip(img + 0.5, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------- base ----
class Style:
    name = 'base'
    title = ''
    line_w = 1.0           # ink line width factor (role pass)
    pencil_w = 1.0
    colour_line_w = 1.0
    pencil_fx = None       # skia path effect for construction lines
    shadow = None          # optional callable(R, c, path, col, a) drawn before every fill in the colour pass

    def setup_paints(self, R):
        pass

    def cmap(self, c):
        return c

    def ground_rgb(self):
        return self.cmap(look.PAPERI)

    def post(self, A, B, cam, t, size):
        return A


class Current(Style):
    name = 'current'
    title = 'Current (reference-derived)'


# ================================================================= 1  RISO ===
class Riso(Style):
    """Three riso drums (yellow, fluorescent pink, teal) + a midnight key.  Colour is solved into ink densities
    per colour, printed through rotated halftone screens with ink grain, overprinted and slightly out of register."""
    name = 'riso'
    title = 'Riso "Spot-Ink Atlas"'
    PAPER = np.array((248, 246, 239), np.float32)
    INKS = [('Y', (255, 226, 0), 0.0, (0.00, 0.00)),       # name, colour, screen angle, misregistration (map px)
            ('P', (255, 72, 168), 75.0, (0.42, -0.22)),
            ('B', (0, 120, 191), 15.0, (-0.30, 0.34))]
    KEY = (38, 46, 96)
    KEY_OFF = (0.16, 0.26)
    line_w = 1.05
    pencil_w = 1.15

    def __init__(self):
        self.pencil_fx = None
        grid = np.linspace(0, 1, 21, dtype=np.float32)
        d = np.stack(np.meshgrid(grid, grid, grid, indexing='ij'), -1).reshape(-1, 3)
        out = np.ones((d.shape[0], 3), np.float32) * self.PAPER
        for k, (_, col, _, _) in enumerate(self.INKS):
            tr = np.array(col, np.float32) / 255.0
            out *= 1.0 - d[:, k:k + 1] * (1.0 - tr)
        self.grid_d = d
        self.grid_lab = cv2.cvtColor((out / 255.0).reshape(-1, 1, 3), cv2.COLOR_RGB2LAB).reshape(-1, 3)
        # ink economy: prefer fewer drums at equal colour
        self.grid_cost = d.sum(1) * 1.2

    def cmap(self, c):
        if c == look.PAPERI:
            return (0, 0, 0)
        h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
        if is_accent(c):                    # the hero colour is a pure overprint: full yellow + full pink
            return (255, 235, 0)
        # riso direction: lighter, poster-clean tints; warm earths lean to the pink drum and every
        # shadow is an overprint of pink + blue (purple), never a black
        v = min(1.0, v * 1.04 + 0.02)
        if (h < 0.11 or h > 0.92) and s > 0.25:
            h = (h - 0.015) % 1.0
            s = min(1.0, s * 1.12)
        r, g, b = colorsys.hsv_to_rgb(h, s, v)
        if v < 0.72:
            k = min(1.0, (0.72 - v) * 1.3)
            r, g, b = r + (0.42 - r) * k, g + (0.26 - g) * k, b + (0.62 - b) * k
        lab = cv2.cvtColor(np.array([[[r, g, b]]], np.float32), cv2.COLOR_RGB2LAB).reshape(3)
        dl = self.grid_lab - lab
        err = dl[:, 0] ** 2 * 0.6 + dl[:, 1] ** 2 + dl[:, 2] ** 2 + self.grid_cost
        d = self.grid_d[int(np.argmin(err))]
        return tuple(float(x) * 255 for x in d)

    def post(self, A, B, cam, t, size):
        w, h = size
        zoom = cam[2]
        tpx = tpx_for(zoom)
        D = A.astype(np.float32) / 255.0
        M = B.astype(np.float32) / 255.0
        L, G, Wt = M[..., 0], M[..., 1], M[..., 2]
        X, Y = mapxy(cam, size)
        pitch = 4.6 / tpx                    # halftone pitch in map px (about 4-6 output px)
        ppx = pitch * zoom
        out = np.empty((h, w, 3), np.float32)
        out[:] = self.PAPER
        # the colour arrives drum by drum: yellow lands first, pink registers next, teal last
        gates = [np.ones_like(Wt), sstep(0.62, 0.42, Wt), sstep(0.30, 0.12, Wt)]
        for k, (nm, col, ang, off) in enumerate(self.INKS):
            d = D[..., k] * gates[k]
            if nm == 'P':
                d = np.maximum(d, 0.0)
            # each drum's ink lays down a little unevenly
            lo = sample(tex('riso_lo', [(60, 1.0), (14, 0.5)], 11 + k), cam, size, tpx)
            d = np.clip(d * (1.0 + 0.07 * lo), 0, 1)
            d = shift(d, off[0] * zoom, off[1] * zoom)
            a = math.radians(ang)
            u = (X * math.cos(a) + Y * math.sin(a)) / pitch
            v = (-X * math.sin(a) + Y * math.cos(a)) / pitch
            spot = 0.5 + 0.25 * (np.cos(2 * np.pi * u) + np.cos(2 * np.pi * v))
            grain = sample(tex('riso_gr', [(0.8, 1.0), (2.0, 0.6)], 21 + k), cam, size, tpx)
            spot = spot + 0.07 * grain
            fw = 2.4 / max(ppx, 1.0)
            cov = np.clip((d - spot) / fw + 0.5, 0.0, 1.0)
            cov = np.where(d > 0.93, np.maximum(cov, d), cov)       # solids print solid
            cov = cov * sstep(0.004, 0.05, d)                          # bare paper stays bare
            if nm == 'P':
                g = shift(G, off[0] * zoom, off[1] * zoom)
                cov = np.maximum(cov, 0.85 * g)                        # construction marks: printed by the pink drum
            # starved ink: a scatter of tiny voids, stronger in solids
            voids = np.clip((grain - 1.35) * 1.4, 0, 0.55)
            cov = cov * (1.0 - voids)
            tr = np.array(col, np.float32) / 255.0
            out *= 1.0 - cov[..., None] * (1.0 - tr)
        # the key drum: midnight line-work, its own slight offset
        Lk = shift(L, self.KEY_OFF[0] * zoom, self.KEY_OFF[1] * zoom)
        kg = sample(tex('riso_kg', [(0.9, 1.0), (3.0, 0.5)], 31), cam, size, tpx)
        Lk = Lk * np.clip(0.97 - 0.10 * np.clip(kg - 0.8, 0, 3), 0.6, 1.0)
        out *= 1.0 - Lk[..., None] * (1.0 - np.array(self.KEY, np.float32) / 255.0)
        # uncoated stock
        mo = sample(tex('paper_mo', [(30, 0.6), (6, 0.4), (1.2, 0.3)], 41), cam, size, tpx)
        out *= (1.0 + 0.011 * mo)[..., None]
        return to8(out)


# ========================================================= 2  WATERCOLOUR ===
class Watercolour(Style):
    """Sepia pen and transparent washes on cold-press paper.  Colour is pigment density: it drifts off the
    line, blooms while wet, dries with a dark tide-line at its edges and granulates in the paper's tooth."""
    name = 'watercolour'
    title = 'Watercolour "Field Journal"'
    PAPER = np.array((251, 248, 240), np.float32)
    SEPIA = np.array((78, 50, 36), np.float32)
    GRAPHITE = np.array((96, 96, 104), np.float32)
    line_w = 0.68
    pencil_w = 1.1

    def cmap(self, c):
        if c == look.PAPERI:
            return tuple(self.PAPER)
        h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
        # a naturalist's box of pigments: greens toward sap / olive, blues toward cerulean-ultramarine,
        # reds toward a warm alizarin; everything a touch more transparent than the print
        hd = h * 360
        if 70 < hd < 160:
            hd = hd + (95 - hd) * 0.25
        elif 180 < hd < 250:
            hd = hd + (210 - hd) * 0.25
        s = s * 0.74
        v = min(1.0, 0.10 + v * 0.95)
        r, g, b = colorsys.hsv_to_rgb((hd / 360) % 1, s, v)
        out = np.array((r * 255, g * 255, b * 255))
        out = out + (self.PAPER - out) * 0.10
        return tuple(out)

    def post(self, A, B, cam, t, size):
        zoom = cam[2]
        tpx = tpx_for(zoom)
        Af = A.astype(np.float32)
        M = B.astype(np.float32) / 255.0
        L, G, Wt = M[..., 0], M[..., 1], M[..., 2]
        P = self.PAPER
        Dn = -np.log(np.clip(Af / P, 0.03, 1.0))                     # pigment density per channel
        # where the pen ran over the colour, the colour pass shows the colour underneath: fine
        # the brush is loose: the colour field wanders off the pen line (a slow, map-anchored displacement)
        h_, w_ = Dn.shape[:2]
        wx = sample(tex('wc_wx', [(26, 1.0), (9, 0.5)], 55), cam, size, tpx)
        wy = sample(tex('wc_wy', [(26, 1.0), (9, 0.5)], 56), cam, size, tpx)
        amp = 0.36 * zoom
        gx_, gy_ = np.meshgrid(np.arange(w_, dtype=np.float32), np.arange(h_, dtype=np.float32))
        Dn = cv2.remap(Dn, gx_ - 0.24 * zoom + amp * wx, gy_ - 0.14 * zoom + amp * wy, cv2.INTER_LINEAR,
                       borderMode=cv2.BORDER_REPLICATE)
        Dn = blur(Dn, 0.22 * zoom)
        # while wet, the pigment blooms outward and pales
        if Wt.max() > 0.01:
            Wb = np.clip(blur(Wt, 0.9 * zoom) * 1.4, 0, 1)
            Db = blur(Dn, 1.5 * zoom)
            Dn = Dn * (1 - Wb[..., None]) + Db * 0.78 * Wb[..., None]
        lo = sample(tex('wc_lo', [(70, 1.0), (22, 0.7), (7, 0.35)], 51), cam, size, tpx)
        Dn = Dn * (0.86 + 0.24 * lo)[..., None]                          # uneven, hand-laid washes
        # dry-brush: here and there the brush skipped and the paper shows through
        sk = sample(tex('wc_skip', [(3.0, 1.0), (1.0, 0.4)], 57, aniso=(3.0, 0.7)), cam, size, tpx)
        Dn = Dn * (1.0 - 0.55 * np.clip((sk - 2.0) * 1.2, 0, 1) * np.clip(lo + 0.3, 0, 1))[..., None]
        # drying: pigment migrates to the rim of each wash -> dark tide-lines
        E = np.clip(Dn - blur(Dn, 0.85 * zoom), 0, None)
        Dn = Dn + 2.2 * E
        # granulation: pigment settles into the valleys of the paper
        tooth = sample(tex('wc_tooth', [(1.1, 1.0), (2.6, 0.7), (6.0, 0.3)], 52), cam, size, tpx)
        valley = np.clip(-tooth * 0.5 + 0.15, 0, 1)
        gr = sample(tex('wc_gran', [(0.7, 1.0), (1.6, 0.5)], 53), cam, size, tpx)
        Dn = Dn * (1.0 + (0.26 * valley + 0.10 * np.clip(gr, -1, 2)))[..., None]
        out = P * np.exp(-Dn)
        # cold-press relief, lit from the upper left
        gx = cv2.Sobel(tooth, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(tooth, cv2.CV_32F, 0, 1, ksize=3)
        relief = np.clip(-(gx + gy) * 0.5 * min(1.0, 2.4 / zoom * 1.3), -1.5, 1.5)
        out *= (1.0 + 0.020 * relief + 0.006 * sample(tex('paper_mo', [(30, 0.6), (6, 0.4), (1.2, 0.3)], 41), cam, size, tpx))[..., None]
        # graphite under-drawing catches on the tooth's peaks
        peak = np.clip(0.75 + 0.45 * tooth, 0.2, 1.0)
        g = (G * peak * 0.62)[..., None]
        out *= 1.0 - g * (1.0 - self.GRAPHITE / 255.0)
        # the pen: sepia, pressure that swells and lifts along the line, tinted by the wash it crosses
        pr = sample(tex('wc_pr', [(5.0, 1.0), (1.4, 0.5)], 54), cam, size, tpx)
        p = np.clip(0.70 + 0.40 * pr, 0.25, 1.0)
        Lc = (L * p)[..., None]
        local = P * np.exp(-blur(Dn, 0.6 * zoom) * 2.6)
        lc = self.SEPIA * 0.55 + local * 0.45
        out *= 1.0 - Lc * 0.86 * (1.0 - lc / 255.0)
        return to8(out)


# =========================================================== 3  BLUEPRINT ===
class Blueprint(Style):
    """A cyanotype on heavy rag paper: chalk construction lines (dash-dot centre lines), white ruling-pen
    line-work, colour as a tonal print in Prussian blues with tinted glazes - and gold leaf for the heroes.
    The wash arrives as the yellow-green sensitizer, which develops into blue."""
    name = 'blueprint'
    title = 'Cyanotype "Patent & Gilt"'
    GROUND = (20, 55, 112)
    KEY = (255, 150, 0)
    WHITE = np.array((240, 245, 250), np.float32)
    CHALK = np.array((205, 226, 246), np.float32)
    line_w = 0.92
    pencil_w = 1.5

    def ground_rgb(self):
        return self.GROUND

    def setup_paints(self, R):
        self.pencil_fx = skia.DashPathEffect.Make([3.2, 1.1, 0.5, 1.1], 0.0)

    def cmap(self, c):
        if c == look.PAPERI:
            return (34, 76, 138)               # an empty cell: paper not yet printed
        if is_accent(c):
            return self.KEY
        Y = lum(c)
        t = 0.10 + 0.80 * Y ** 1.15
        base = ramp([(0.0, (6, 22, 58)), (0.35, (24, 70, 138)), (0.62, (62, 122, 186)),
                     (0.85, (150, 196, 228)), (1.0, (226, 238, 246))], t)
        gray = (c[0] + c[1] + c[2]) / 3.0
        chroma = np.array(c, np.float32) - gray
        out = base + chroma * 0.36                                    # a tinted glaze over the tone
        if out[0] > out[2]:                                           # nothing but gold may run warm
            out[0] = out[2]
        return tuple(np.clip(out, 0, 255))

    def post(self, A, B, cam, t, size):
        zoom = cam[2]
        tpx = tpx_for(zoom)
        out = A.astype(np.float32)
        M = B.astype(np.float32) / 255.0
        L, G, Wt = M[..., 0], M[..., 1], M[..., 2]
        # gold leaf: recover the key's coverage and lift it out of the colour
        K = np.clip((out[..., 0] - out[..., 2]) / 255.0, 0, 1)
        key = np.array(self.KEY, np.float32)
        base = out - K[..., None] * key
        # the cyanotype's uneven coating: brushed streaks + mottling
        lo = sample(tex('bp_lo', [(80, 1.0), (24, 0.6)], 61), cam, size, tpx)
        st = sample(tex('bp_st', [(10, 1.0), (3, 0.4)], 62, aniso=(9.0, 0.6)), cam, size, tpx)
        fib = sample(tex('bp_fib', [(0.8, 1.0), (2.0, 0.6)], 63), cam, size, tpx)
        base *= (1.0 + 0.075 * lo + 0.035 * st + 0.018 * fib)[..., None]
        # the wash: sensitizer yellow-green that develops to the print's blue
        if Wt.max() > 0.01:
            wv = blur(Wt, 0.35 * zoom)[..., None]
            sens = np.array((214, 224, 120), np.float32) * (0.90 + 0.08 * lo[..., None])
            base = base * (1 - 0.62 * wv) + sens * 0.62 * wv
        # gold leaf: square sheets with faint seams, a beaten surface and a slow travelling glint
        X, Y = mapxy(cam, size)
        beat = sample(tex('bp_gold', [(1.2, 1.0), (4.0, 0.8)], 64), cam, size, tpx)
        sq = 5.0
        seam = np.exp(-(np.minimum(X % sq, sq - X % sq) / 0.16) ** 2) * 0.5 + np.exp(-(np.minimum(Y % sq, sq - Y % sq) / 0.16) ** 2) * 0.5
        glint = np.exp(-(((X + Y * 1.4) - ((t * 260.0) % 1400.0 - 700.0)) / 46.0) ** 2)
        gt = np.clip(0.52 + 0.16 * beat - 0.16 * seam + 0.45 * glint, 0, 1)
        gold = ramp([(0.0, (92, 60, 18)), (0.4, (184, 136, 52)), (0.7, (232, 192, 102)), (1.0, (255, 244, 196))], gt)
        out = base + K[..., None] * gold
        # chalk: grainy, broken, wider and softer
        ch = sample(tex('bp_chalk', [(0.6, 1.0), (1.5, 0.6)], 65), cam, size, tpx)
        gch = (G * np.clip(0.55 + 0.55 * ch, 0, 1) * 0.85)[..., None]
        out = out + (self.CHALK - out) * gch
        # white ruling pen, with the faint halo of a sun-printed line
        halo = blur(L, 0.9 + 0.12 * zoom)[..., None]
        out = out + (self.WHITE - out) * np.clip(halo * 0.16, 0, 1)
        out = out + (self.WHITE - out) * (L * 0.95)[..., None]
        out *= screen_vignette(size, 0.16)[..., None]
        return to8(out)


# ============================================================ 4  PAPERCUT ===
class Papercut(Style):
    """Paper theatre: no outlines.  Every shape is a piece of coloured card with a deckled edge, stacked in
    painter's order, each casting a soft shadow on what lies beneath.  The pen's line-work becomes knife
    scoring, the construction lines become dashed cutting guides, and colour pieces are laid in from above
    (wet = still held up, so their shadow is longer and softer) before settling flat."""
    name = 'papercut'
    title = 'Cut-paper "Paper Theatre"'
    GROUND = (234, 227, 214)
    line_w = 1.0
    pencil_w = 1.05

    def setup_paints(self, R):
        self.pencil_fx = skia.DashPathEffect.Make([2.2, 1.3], 0.0)
        R.pf.setPathEffect(skia.DiscretePathEffect.Make(0.85, 0.16, 7))
        self.sp = skia.Paint(AntiAlias=True, Style=skia.Paint.kFill_Style)
        self.sp.setPathEffect(skia.DiscretePathEffect.Make(0.85, 0.16, 7))
        self._mf = {}

    def _maskf(self, sig):
        q = round(sig * 8) / 8.0
        m = self._mf.get(q)
        if m is None:
            m = skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, q, True)
            self._mf[q] = m
        return m

    def shadow(self, R, c, path, col, a):
        if a < 0.05:
            return
        wet = look.WET
        sig = 0.62 + 1.3 * wet
        off = 0.88 + 2.0 * wet
        self.sp.setMaskFilter(self._maskf(sig))
        self.sp.setColor(skia.ColorSetARGB(int(255 * min(1.0, a) * (0.50 - 0.16 * wet)), 40, 26, 22))
        c.save()
        c.translate(off * 0.45, off)
        c.drawPath(path, self.sp)
        c.restore()

    def cmap(self, c):
        if c == look.PAPERI:
            return self.GROUND
        h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
        # dyed card stocks: matte, slightly dusty, deep shades lifted
        hd = h * 360
        anch = [10, 30, 44, 96, 168, 200, 222, 330]       # brick, marigold, mustard, moss, teal, cerulean, slate, rose
        near = min(anch, key=lambda a_: min(abs(a_ - hd), 360 - abs(a_ - hd)))
        hd = hd + (((near - hd + 180) % 360) - 180) * 0.6
        s = min(1.0, s * 0.62)
        v = 0.16 + 0.74 * v
        if s < 0.12:                             # whites become an ivory stock
            r, g, b = colorsys.hsv_to_rgb(0.11, 0.05 + s * 0.6, min(1.0, v * 0.99))
        else:
            r, g, b = colorsys.hsv_to_rgb((hd / 360) % 1, s, v)
        return (r * 255, g * 255, b * 255)

    def post(self, A, B, cam, t, size):
        zoom = cam[2]
        tpx = tpx_for(zoom)
        out = A.astype(np.float32)
        M = B.astype(np.float32) / 255.0
        L, G, Wt = M[..., 0], M[..., 1], M[..., 2]
        # the stocks: felted fibre, a scatter of pale flecks in every dyed sheet
        fib = sample(tex('pc_fib', [(0.9, 1.0), (2.5, 0.7)], 71, aniso=(2.2, 0.8)), cam, size, tpx)
        mo = sample(tex('pc_mo', [(40, 1.0), (10, 0.5)], 72), cam, size, tpx)
        fl = sample(tex('pc_fl', [(0.7, 1.0)], 73, aniso=(2.5, 0.7)), cam, size, tpx)
        out *= (1.0 + 0.028 * fib + 0.010 * mo)[..., None]
        fleck = np.clip((fl - 2.1) * 1.2, 0, 0.6)[..., None]
        out += (250.0 - out) * fleck * 0.55
        # knife scoring: a crease in the card - shadow on one lip, light on the other
        o = 0.20 * zoom
        Ld = shift(L, o * 0.5, o)
        Ll = shift(L, -o * 0.5, -o)
        out *= (1.0 - 0.26 * Ld * (1 - 0.7 * L) - 0.07 * L)[..., None]
        out += (255.0 - out) * (0.34 * Ll * (1 - L))[..., None]
        # dashed cutting guides in soft graphite
        out *= (1.0 - 0.55 * G)[..., None] + (G * 0.55)[..., None] * (np.array((92, 86, 84), np.float32) / 255.0)
        # a lit diorama, photographed: a warm key light from the upper left, cool fall-off to the edges
        w_, h_ = size
        gx_ = np.linspace(0, 1, w_, dtype=np.float32)[None, :]
        gy_ = np.linspace(0, 1, h_, dtype=np.float32)[:, None]
        key = np.clip(1.06 - 0.16 * (gx_ * 0.6 + gy_ * 0.8), 0, 2)
        out *= key[..., None] * np.array((1.02, 1.0, 0.96), np.float32)
        out *= screen_vignette(size, 0.15, 2.0)[..., None]
        return to8(out)


# =========================================================== 5  CLOISONNE ===
class Cloisonne(Style):
    """Enamel and gold.  The construction lines are scribed into a copper plate, the line-work is laid in
    as gold wire (bevelled, catching a slow sweep of light), and each cell is filled with enamel that
    arrives as matte powder, flashes in the kiln, and sets into glossy jewel colour.  Black lacquer ground."""
    name = 'cloisonne'
    title = 'Cloisonne "Enamel & Gold"'
    GROUND = (13, 16, 26)
    KEY = (255, 0, 255)
    COPPER = np.array((222, 138, 92), np.float32)
    line_w = 1.32
    pencil_w = 0.9

    def ground_rgb(self):
        return self.GROUND

    def cmap(self, c):
        if c == look.PAPERI:
            return (118, 66, 40)               # an empty cloison: bare copper awaiting enamel
        if is_accent(c):
            return self.KEY
        h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
        hd = h * 360
        if s < 0.14:                                       # whites/greys: ivory and pearl enamels
            r, g, b = colorsys.hsv_to_rgb(0.11, 0.08 + s * 0.8, 0.20 + 0.72 * v ** 1.3)
        elif 28 <= hd < 66 and s < 0.8:                    # sands, stone, earth: honey-ivory and amber
            r, g, b = colorsys.hsv_to_rgb(0.10, 0.20 + 0.42 * s, 0.26 + 0.70 * v ** 1.6)
        elif 66 <= hd < 172:                               # every green: emerald / jade
            r, g, b = colorsys.hsv_to_rgb((150 + (hd - 110) * 0.25) / 360, min(1, 0.62 + 0.35 * s), 0.14 + 0.62 * v ** 2.0)
        elif 172 <= hd < 262:                              # water and sky: turquoise -> lapis
            r, g, b = colorsys.hsv_to_rgb((196 + (hd - 205) * 0.7) / 360, min(1, 0.55 + 0.45 * s), 0.18 + 0.72 * v ** 1.8)
        elif 262 <= hd < 320:                              # amethyst
            r, g, b = colorsys.hsv_to_rgb(hd / 360, min(1, 0.4 + 0.6 * s), 0.16 + 0.66 * v ** 1.6)
        else:                                              # reds, roofs, oranges: cinnabar and coral
            hh = hd if hd < 66 else hd - 360
            r, g, b = colorsys.hsv_to_rgb((6 + hh * 0.35) % 360 / 360, min(1, 0.55 + 0.45 * s), 0.22 + 0.68 * v ** 1.5)
        out = [r * 255, g * 255, b * 255]
        m = min(out[0], out[2])
        if m > out[1]:                                    # keep magenta free for the gold key
            out[1] = m
        return tuple(out)

    def post(self, A, B, cam, t, size):
        zoom = cam[2]
        tpx = tpx_for(zoom)
        Af = A.astype(np.float32)
        M = B.astype(np.float32) / 255.0
        L, G, Wt = M[..., 0], M[..., 1], M[..., 2]
        K = np.clip((np.minimum(Af[..., 0], Af[..., 2]) - Af[..., 1]) / 255.0, 0, 1)
        out = Af - K[..., None] * np.array(self.KEY, np.float32)
        X, Y = mapxy(cam, size)
        lo = sample(tex('cl_lo', [(30, 1.0), (8, 0.6)], 81), cam, size, tpx)
        hi = sample(tex('cl_hi', [(0.7, 1.0)], 82), cam, size, tpx)
        # enamel: the glass pools - a little deeper in the middle of a cell, lighter where it climbs the wire
        near = np.clip(blur(L, 0.55 * zoom) * 2.2, 0, 1) * (1 - L)
        out *= (1.0 + 0.06 * lo + 0.16 * near)[..., None]
        bub = np.clip((hi - 2.35) * 2.0, 0, 1)[..., None] * 0.35
        out += (255.0 - out) * bub
        # the wash: matte unfired powder -> a kiln flash -> glossy glass
        if Wt.max() > 0.01:
            wv = blur(Wt, 0.3 * zoom)[..., None]
            lum_ = out.mean(-1, keepdims=True)
            powder = (lum_ * 0.45 + out * 0.55 + 46.0) * (0.95 + 0.05 * np.clip(hi, -2, 2)[..., None])
            out = out * (1 - wv) + powder * wv
            ember = (4.0 * wv * (1 - wv)) ** 1.5
            out += np.array((255, 118, 34), np.float32) * 0.55 * ember
        # gold, shared by wire and gilded hero pieces: a slow sweep of light crosses the piece
        sweep = np.exp(-(((X * 0.8 + Y * 1.2) - ((t * 300.0 + 600.0) % 1600.0 - 800.0)) / 46.0) ** 2)
        brush = sample(tex('cl_brush', [(1.0, 1.0), (3.0, 0.5)], 83, aniso=(6.0, 0.5)), cam, size, tpx)
        gtf = np.clip(0.48 + 0.13 * brush + 0.22 * sweep, 0, 1)
        GOLD = [(0.0, (58, 32, 6)), (0.3, (142, 92, 22)), (0.55, (214, 158, 46)), (0.78, (246, 206, 104)), (1.0, (255, 246, 200))]
        out += K[..., None] * ramp(GOLD, gtf)
        # scribed copper construction lines, with a faint warm glow
        gl = blur(G, 0.5 * zoom)[..., None]
        out += self.COPPER * 0.20 * gl
        out = out + (self.COPPER - out) * (G * 0.8)[..., None]
        # the wire: a dark seat in the enamel, then a bevelled gold cloison lit from the upper left
        seat = np.clip(blur(L, 0.22 * zoom) * 1.3 - L, 0, 1)[..., None]
        out *= 1.0 - 0.55 * seat
        Lb = blur(L, 0.14 * zoom + 0.5)
        gx = cv2.Sobel(Lb, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(Lb, cv2.CV_32F, 0, 1, ksize=3)
        lit = np.clip(0.56 + 0.30 * np.tanh(1.2 * (gx * 0.55 + gy * 0.85)) + 0.26 * sweep + 0.04 * brush, 0, 1)
        wire = ramp(GOLD, lit)
        out = out * (1 - L[..., None]) + wire * L[..., None]
        # lacquer ground: a faint warm pool of light and a dust of gold
        dust = np.clip((hi - 2.9) * 3.0, 0, 1)
        isg = np.clip(1.0 - np.abs(Af - np.array(self.GROUND, np.float32)).sum(-1) / 30.0, 0, 1) * (1 - L)
        out += (np.array((200, 160, 80), np.float32) * 0.6 * (dust * isg)[..., None])
        out *= screen_vignette(size, 0.30, 1.8)[..., None]
        return to8(out)


STYLES = {s.name: s for s in (Current, Riso, Watercolour, Blueprint, Papercut, Cloisonne)}
ORDER = ['current', 'riso', 'watercolour', 'blueprint', 'papercut', 'cloisonne']


def get(name):
    return STYLES[name]()
