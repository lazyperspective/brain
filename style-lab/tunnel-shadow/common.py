"""Shared procedural helpers: noise, hand-cut outlines, paint and paper textures, affines."""
import numpy as np
import cv2

F32 = np.float32


def rng(seed):
    return np.random.default_rng(seed)


def fbm(h, w, seed, scale=64.0, octaves=5, persistence=0.55):
    """Smooth fractal noise in roughly [-1, 1]."""
    r = rng(seed)
    out = np.zeros((h, w), F32)
    amp, total, s = 1.0, 0.0, float(scale)
    for _ in range(octaves):
        gh, gw = max(2, int(h / s) + 3), max(2, int(w / s) + 3)
        g = r.standard_normal((gh, gw)).astype(F32)
        up = cv2.resize(g, (int(gw * s), int(gh * s)), interpolation=cv2.INTER_CUBIC)
        oy, ox = r.integers(0, max(1, up.shape[0] - h)), r.integers(0, max(1, up.shape[1] - w))
        out += amp * up[oy:oy + h, ox:ox + w]
        total += amp
        amp *= persistence
        s /= 2.0
        if s < 1.5:
            break
    out /= total
    return out / (np.abs(out).max() + 1e-6)


def line_kernel(length, angle_deg):
    k = np.zeros((length, length), F32)
    c = length // 2
    a = np.deg2rad(angle_deg)
    dx, dy = np.cos(a) * c, np.sin(a) * c
    cv2.line(k, (int(c - dx), int(c - dy)), (int(c + dx), int(c + dy)), 1.0, 1, cv2.LINE_AA)
    return k / k.sum()


def strokes(h, w, seed, length=31, angle=0.0, jitter=25.0, cells=6):
    """Brush-stroke streak texture: noise smeared along locally varying directions."""
    r = rng(seed)
    base = r.standard_normal((h, w)).astype(F32)
    base = cv2.GaussianBlur(base, (0, 0), 1.2)
    out = np.zeros((h, w), F32)
    angles = angle + np.linspace(-jitter, jitter, 3)
    field = fbm(h, w, seed + 1, scale=max(h, w) / cells, octaves=2)
    weights = []
    for i, a in enumerate(angles):
        wgt = np.clip(1.0 - np.abs(field * 1.5 - (i - 1)), 0, 1)
        weights.append(wgt)
        out += wgt * cv2.filter2D(base, -1, line_kernel(length, a))
    out /= (sum(weights) + 1e-4)
    return out / (np.abs(out).std() * 3 + 1e-6)


def paper_height(h, w, seed):
    """Height field for paper fibre / tooth."""
    r = rng(seed)
    tooth = cv2.GaussianBlur(r.standard_normal((h, w)).astype(F32), (0, 0), 0.9)
    fib = np.zeros((h, w), F32)
    n = int(h * w / 2500)
    for _ in range(n):
        x, y = r.integers(0, w), r.integers(0, h)
        a = r.uniform(0, np.pi)
        L = r.uniform(6, 30)
        x2, y2 = int(x + np.cos(a) * L), int(y + np.sin(a) * L)
        cv2.line(fib, (int(x), int(y)), (x2, y2), float(r.uniform(0.3, 1.0)), 1, cv2.LINE_AA)
    fib = cv2.GaussianBlur(fib, (0, 0), 0.7)
    low = fbm(h, w, seed + 7, scale=max(h, w) / 5, octaves=3)
    return tooth * 0.3 + fib * 0.5 + low * 1.5


def bump_shade(height, light_dir=(-0.5, -0.7), strength=0.12):
    gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3)
    s = 1.0 + strength * (-(gx * light_dir[0] + gy * light_dir[1]))
    return np.clip(s, 0.6, 1.4)


def densify(pts, step):
    pts = np.asarray(pts, F32)
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        seg = np.linalg.norm(b - a)
        k = max(1, int(seg / step))
        for j in range(k):
            out.append(a + (b - a) * (j / k))
    return np.array(out, F32)


def handcut(pts, seed, amp, step, closed=True):
    """Make a polygon look scissor-cut: densify, then jitter along the normal with smooth + fine noise."""
    p = densify(pts, step)
    n = len(p)
    r = rng(seed)
    smooth = np.convolve(np.r_[r.standard_normal(n), r.standard_normal(n)[:8]], np.ones(8) / 8, 'same')[:n]
    fine = r.standard_normal(n) * 0.25
    off = (smooth * 0.9 + fine) * amp
    tang = np.roll(p, -1, 0) - np.roll(p, 1, 0)
    nrm = np.stack([tang[:, 1], -tang[:, 0]], 1)
    nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6)
    return p + nrm * off[:, None]


class Canvas:
    """A painted flat in world units (x right, y up) rasterised at ppu pixels per unit."""

    def __init__(self, x0, x1, y0, y1, ppu):
        self.x0, self.x1, self.y0, self.y1, self.ppu = x0, x1, y0, y1, ppu
        self.w = int(round((x1 - x0) * ppu))
        self.h = int(round((y1 - y0) * ppu))
        self.color = np.zeros((self.h, self.w, 3), F32)
        self.alpha = np.zeros((self.h, self.w), F32)
        self.emit = None
        ys, xs = np.mgrid[0:self.h, 0:self.w].astype(F32)
        self.X = x0 + (xs + 0.5) / ppu
        self.Y = y1 - (ys + 0.5) / ppu

    def to_px(self, pts):
        pts = np.asarray(pts, F32)
        return np.stack([(pts[:, 0] - self.x0) * self.ppu, (self.y1 - pts[:, 1]) * self.ppu], 1)

    def mask(self, pts, cut_seed=None, cut_amp=0.004, blur=0.0):
        """Rasterise a world-space polygon (optionally hand-cut) into an AA mask."""
        if cut_seed is not None:
            pts = handcut(pts, cut_seed, cut_amp, step=0.01)
        px = self.to_px(pts)
        m = np.zeros((self.h, self.w), np.uint8)
        cv2.fillPoly(m, [np.round(px * 16).astype(np.int32)], 255, cv2.LINE_AA, shift=4)
        m = m.astype(F32) / 255.0
        if blur > 0:
            m = cv2.GaussianBlur(m, (0, 0), blur)
        return m

    def circle_mask(self, cx, cy, r, cut_seed=None, cut_amp=0.004, n=180):
        a = np.linspace(0, 2 * np.pi, n, endpoint=False)
        pts = np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], 1)
        return self.mask(pts, cut_seed, cut_amp)

    def tex_matrix(self):
        """3x3 affine mapping texture pixel -> world (x, y)."""
        s = 1.0 / self.ppu
        return np.array([[s, 0, self.x0 + 0.5 * s], [0, -s, self.y1 - 0.5 * s], [0, 0, 1]], np.float64)


def paint(cv, region, rgb, seed, style='gouache', strength=1.0, angle=0.0, vary=0.08, edge_dark=0.25):
    """Lay a pigment over the canvas within region (0..1 mask)."""
    h, w = cv.h, cv.w
    rgb = np.asarray(rgb, F32)
    lowf = fbm(h, w, seed, scale=max(40, cv.ppu * 0.25), octaves=4)
    col = rgb[None, None, :] * (1.0 + vary * lowf[..., None])
    if style == 'gouache':
        st = strokes(h, w, seed + 3, length=max(9, int(cv.ppu * 0.05) | 1), angle=angle)
        col = col * (1.0 + 0.12 * st[..., None])
        cover = region * strength
    else:  # watercolour: granulation, blooms, pooled edges
        gran = cv2.GaussianBlur(rng(seed + 5).standard_normal((h, w)).astype(F32), (0, 0), 1.0)
        bloom = fbm(h, w, seed + 9, scale=max(30, cv.ppu * 0.15), octaves=3)
        dens = 0.85 + 0.12 * bloom + 0.06 * gran
        rb = cv2.GaussianBlur(region, (0, 0), max(1.5, cv.ppu * 0.006))
        pool = np.clip(region - rb, 0, 1) * 4.0
        dens = dens * (1.0 + edge_dark * pool)
        col = rgb[None, None, :] ** np.clip(dens, 0.6, 1.6)[..., None]
        cover = region * strength * np.clip(0.8 + 0.25 * bloom, 0, 1)
    cv.color = cv.color * (1 - cover[..., None]) + col * cover[..., None]


def finish_flat(cv, seed, paper_rgb=(0.93, 0.89, 0.80), rim=True, bump=0.06, light_dir=(-0.55, -0.65)):
    """Paper tooth, bump shading and the white cut-paper rim on edges facing the lamp."""
    h, w = cv.h, cv.w
    height = paper_height(h, w, seed)
    sh = bump_shade(height, light_dir, bump)
    cv.color *= sh[..., None]
    if rim:
        a = cv.alpha
        k = max(1.0, cv.ppu * 0.0035)
        er = cv2.GaussianBlur(a, (0, 0), k)
        band = np.clip((a - er) * 2.2, 0, 1)
        gx = cv2.Sobel(er, cv2.CV_32F, 1, 0, ksize=5)
        gy = cv2.Sobel(er, cv2.CV_32F, 0, 1, ksize=5)
        g = np.sqrt(gx * gx + gy * gy) + 1e-6
        # inward normal = gradient direction; edge faces lamp when outward normal points to lamp
        facing = -(gx * light_dir[0] + gy * light_dir[1]) / g
        paper = np.asarray(paper_rgb, F32)
        lit = np.clip(0.55 + 0.45 * facing, 0, 1)
        cv.color = cv.color * (1 - band[..., None] * lit[..., None] * 0.75) + \
            paper * band[..., None] * lit[..., None] * 0.75
        dark = np.clip(-facing, 0, 1) * band
        cv.color *= (1 - 0.35 * dark)[..., None]
    np.clip(cv.color, 0, 1.2, out=cv.color)


def T(dx, dy):
    return np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1]], np.float64)


def S(sx, sy=None):
    sy = sx if sy is None else sy
    return np.array([[sx, 0, 0], [0, sy, 0], [0, 0, 1]], np.float64)


def R(deg):
    a = np.deg2rad(deg)
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], np.float64)


def rot_about(deg, px, py):
    return T(px, py) @ R(deg) @ T(-px, -py)


def warp(img, M, size, border=0.0, interp=cv2.INTER_LINEAR):
    return cv2.warpAffine(img, M[:2].astype(np.float32), size, flags=interp,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=border)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def ease(t):
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(t, 0, 1))


def chaikin(pts, iters=3):
    p = np.asarray(pts, np.float64)
    for _ in range(iters):
        q = np.roll(p, -1, 0)
        p = np.stack([0.75 * p + 0.25 * q, 0.25 * p + 0.75 * q], 1).reshape(-1, 2)
    return p


def big_blur(img, sigma):
    """Gaussian blur; large sigmas are done at reduced resolution (same look, far cheaper)."""
    if sigma < 6:
        return cv2.GaussianBlur(img, (0, 0), sigma)
    f = int(min(8, sigma // 3))
    h, w = img.shape[:2]
    small = cv2.resize(img, (w // f, h // f), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), sigma / f)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
