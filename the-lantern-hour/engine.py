"""
Dry-media engine for THE LANTERN HOUR.

Four things are imitated here and nothing else:
  a stick of soft pastel (broad, chalky, skips over the tooth of the paper),
  a stick of charcoal (lines that thicken and starve with pressure),
  a wax pencil (thin, hard, patient),
  and a fingertip / kneaded eraser (which only ever move or lift what is there).
Pigment lands only where the paper's tooth rises to meet the stick.
"""
import math
import numpy as np
import cv2

F32 = np.float32
W, H = 1920, 1080
cv2.setNumThreads(1)


# ------------------------------------------------------------------ helpers
def gnoise(rng, h, w, sigma):
    if sigma > 4:
        f = max(1, int(sigma / 2.5))
        hh, ww = h // f + 3, w // f + 3
        n = rng.standard_normal((hh, ww), dtype=F32)
        n = cv2.GaussianBlur(n, (0, 0), sigma / f)
        n = cv2.resize(n, (ww * f, hh * f), interpolation=cv2.INTER_CUBIC)[:h, :w]
    elif sigma <= 0:
        n = rng.standard_normal((h, w), dtype=F32)
    else:
        n = cv2.GaussianBlur(rng.standard_normal((h, w), dtype=F32), (0, 0), sigma)
    return n / (n.std() + 1e-9)


def uniformize(z):
    """rank-transform to a flat [0,1] distribution (cheaply, via the normal cdf)"""
    z = (z - z.mean()) / (z.std() + 1e-9)
    return (0.5 * (1 + np.tanh(z * 0.85))).astype(F32)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def ease_in(u, p=2.0):
    return clamp(u) ** p


def ease_out(u, p=2.0):
    return 1 - (1 - clamp(u)) ** p


def lerp(a, b, u):
    return a + (b - a) * u


def smooth1d(rng, n, wl, amp=1.0):
    k = max(2, int(n / max(1.0, wl)) + 3)
    ctrl = rng.standard_normal(k)
    x = np.linspace(0, k - 1, n)
    i = np.clip(x.astype(int), 0, k - 2)
    f = x - i
    f = f * f * (3 - 2 * f)
    return (ctrl[i] * (1 - f) + ctrl[i + 1] * f) * amp


def catmull(pts, spacing=3.0):
    pts = np.asarray(pts, np.float64)
    if len(pts) < 3:
        return resample(pts, spacing)
    P = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(3, int(np.hypot(*(p2 - p1)) / spacing))
        t = np.linspace(0, 1, n, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1][None])
    return np.vstack(out)


def resample(q, spacing=3.0):
    q = np.asarray(q, np.float64)
    if len(q) < 2:
        return q
    d = np.hypot(*np.diff(q, axis=0).T)
    s = np.concatenate([[0], np.cumsum(d)])
    if s[-1] < 1e-6:
        return q[:1]
    n = max(2, int(s[-1] / spacing) + 1)
    u = np.linspace(0, s[-1], n)
    return np.stack([np.interp(u, s, q[:, 0]), np.interp(u, s, q[:, 1])], 1)


def hand(pts, rng, wobble=1.5, wl=60.0, spacing=3.0, smooth=True):
    """the curve a hand actually makes when it means to make this one"""
    q = catmull(pts, spacing) if smooth else resample(pts, spacing)
    n = len(q)
    if n < 3 or wobble <= 0:
        return q
    d = np.gradient(q, axis=0)
    L = np.hypot(d[:, 0], d[:, 1]) + 1e-9
    nrm = np.stack([-d[:, 1] / L, d[:, 0] / L], 1)
    off = smooth1d(rng, n, wl / spacing, wobble) + smooth1d(rng, n, 9 / spacing, wobble * 0.22)
    return q + nrm * off[:, None]


def _fix(P):
    return np.round(np.asarray(P) * 16.0).astype(np.int32).reshape(-1, 1, 2)


# ------------------------------------------------------------------ paper
class Paper:
    def __init__(self, seed, tone, h=H, w=W, mottle=0.02, relief=0.035, laid=0.22, speck=0.03, k=1.2):
        rng = np.random.default_rng(seed)
        z = (1.0 * gnoise(rng, h, w, 0.75 * k) + 0.7 * gnoise(rng, h, w, 1.6 * k)
             + 0.28 * gnoise(rng, h, w, 4.0 * k) + 0.14 * gnoise(rng, h, w, 14))
        # the faint regular weave that pastel paper is moulded with
        yy, xx = np.mgrid[0:h, 0:w].astype(F32)
        wav = gnoise(rng, h, w, 40) * 1.3
        z += laid * (np.sin((yy + wav) * (2 * math.pi / 4.6)) + 0.7 * np.sin((xx * 0.5 + yy * 0.87 + wav) * (2 * math.pi / 5.3))
                     + 0.7 * np.sin((xx * 0.5 - yy * 0.87 - wav) * (2 * math.pi / 5.3)))
        # stray fibres
        fl = np.zeros((h, w), F32)
        n = int(h * w / 2600)
        xs = rng.uniform(0, w, n); ys = rng.uniform(0, h, n)
        an = rng.uniform(0, math.pi, n); ln = rng.uniform(8, 40, n)
        vv = rng.normal(0, 1, n)
        for i in range(n):
            m = 6
            a = an[i] + np.cumsum(rng.normal(0, 0.2, m))
            px = xs[i] + np.cumsum(np.cos(a)) * ln[i] / m
            py = ys[i] + np.cumsum(np.sin(a)) * ln[i] / m
            cv2.polylines(fl, [np.stack([px, py], 1).astype(np.int32)], False, float(vv[i]), 1)
        fl = cv2.GaussianBlur(fl, (0, 0), 0.6)
        z += 0.8 * fl
        self.T = uniformize(z)
        tone = np.array(tone, F32)
        big = gnoise(rng, h, w, 180) * mottle * 0.6 + gnoise(rng, h, w, 35) * mottle * 0.4
        base = tone[None, None, :] * (1 + big[..., None])
        warm = gnoise(rng, h, w, 70) * mottle * 0.3
        base[..., 0] += warm; base[..., 2] -= warm
        Hs = cv2.GaussianBlur(self.T, (0, 0), 0.8)
        gx = cv2.Sobel(Hs, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(Hs, cv2.CV_32F, 0, 1, ksize=3)
        base *= (1 + relief * (gx + gy) + relief * 0.5 * (self.T - 0.5))[..., None]
        base += (fl * speck)[..., None] * np.array([1.0, 0.9, 0.75], F32)
        self.base = np.clip(base, 0, 1).astype(F32)
        self.h, self.w = h, w
        self.rng = rng
        self._streaks = {}
        self._alt = None

    def streak(self, angle_deg, length=14.0):
        """noise combed along one direction: the drag marks inside a broad stroke"""
        key = (int(round(angle_deg / 15.0)) % 12, int(length))
        if key not in self._streaks:
            a = key[0] * 15.0
            rng = np.random.default_rng(1000 + key[0] * 7 + key[1])
            S = int(math.hypot(self.w, self.h)) + 8
            n = rng.standard_normal((S, S), dtype=F32)
            n = cv2.GaussianBlur(n, (0, 0), sigmaX=length, sigmaY=0.9)
            n += 0.5 * cv2.GaussianBlur(rng.standard_normal((S, S), dtype=F32), (0, 0), sigmaX=length * 3, sigmaY=2.5) * 3
            M = cv2.getRotationMatrix2D((S / 2, S / 2), -a, 1.0)
            M[0, 2] += self.w / 2 - S / 2; M[1, 2] += self.h / 2 - S / 2
            r = cv2.warpAffine(n, M, (self.w, self.h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            self._streaks[key] = uniformize(r)
        return self._streaks[key]

    def tooth_alt(self, k):
        """the same tooth caught slightly differently each time something is redrawn"""
        if self._alt is None:
            rng = np.random.default_rng(77)
            self._alt = [np.clip(self.T + 0.16 * gnoise(rng, self.h, self.w, 0.8), 0, 1).astype(F32) for _ in range(4)]
        return self._alt[k % 4]


# ------------------------------------------------------------------ canvas
class Canvas:
    def __init__(self, paper, C=None, alpha=False):
        self.p = paper
        self.h, self.w = paper.h, paper.w
        self.C = paper.base.copy() if C is None else C
        self.T = paper.T
        self.A = np.zeros((self.h, self.w), F32) if alpha else None

    def copy(self):
        c = Canvas(self.p, self.C.copy())
        c.T = self.T
        if self.A is not None:
            c.A = self.A.copy()
        return c

    def roi(self, x0, y0, x1, y1, pad=0):
        x0 = max(0, int(math.floor(x0 - pad))); y0 = max(0, int(math.floor(y0 - pad)))
        x1 = min(self.w, int(math.ceil(x1 + pad)) + 1); y1 = min(self.h, int(math.ceil(y1 + pad)) + 1)
        return x0, y0, x1, y1

    def deposit(self, m, col, x0=0, y0=0, grain=0.75, soft=0.16, op=1.0, streak=None, tint=None):
        """m: float mask [0,1] (pressure). pigment lands where pressure beats the tooth."""
        h, w = m.shape
        if h == 0 or w == 0:
            return
        t = self.T[y0:y0 + h, x0:x0 + w]
        if streak is not None:
            ang, amt = streak[0], streak[1]
            ln = streak[2] if len(streak) > 2 else 14.0
            s = self.p.streak(ang, ln)[y0:y0 + h, x0:x0 + w]
            m = m * (1 - amt + amt * 1.6 * s)
        a = np.clip((m - t * grain) * (1.0 / soft), 0, 1)
        if op != 1.0:
            a *= op
        Cr = self.C[y0:y0 + h, x0:x0 + w]
        col = np.asarray(col, F32)
        if tint is not None:
            # multiply-like (charcoal veil / transparent wax)
            Cr *= (1 - a[..., None] * (1 - col[None, None, :]))
        else:
            Cr += (col[None, None, :] - Cr) * a[..., None]
        if self.A is not None and tint is None:
            Ar = self.A[y0:y0 + h, x0:x0 + w]
            Ar += (1 - Ar) * a

    def smudge(self, m, x0, y0, sigma=4.0, strength=0.8, drag=None):
        h, w = m.shape
        Cr = self.C[y0:y0 + h, x0:x0 + w]
        if drag is not None:
            k = max(3, int(sigma * 3) | 1)
            ker = np.zeros((k, k), F32)
            c = k // 2
            dx, dy = math.cos(drag), math.sin(drag)
            for i in range(-c, c + 1):
                xx = int(round(c + dx * i)); yy = int(round(c + dy * i))
                ker[yy, xx] += 1
            ker /= ker.sum()
            B = cv2.filter2D(Cr, -1, ker, borderType=cv2.BORDER_REFLECT)
            B = cv2.GaussianBlur(B, (0, 0), max(0.6, sigma * 0.25))
        else:
            B = cv2.GaussianBlur(Cr, (0, 0), sigma)
        Cr += (B - Cr) * (m * strength)[..., None]

    def lift(self, m, x0, y0, strength=0.8, grain=0.35, toward=None):
        """kneaded eraser: takes pigment back toward the paper, never all the way"""
        h, w = m.shape
        t = self.T[y0:y0 + h, x0:x0 + w]
        a = np.clip((m - (1 - t) * grain) * 4.0, 0, 1) * strength
        Cr = self.C[y0:y0 + h, x0:x0 + w]
        tgt = self.p.base[y0:y0 + h, x0:x0 + w] if toward is None else np.asarray(toward, F32)[None, None, :]
        Cr += (tgt - Cr) * a[..., None]


class Batch:
    """many strokes of one stick, pressed into the paper together"""

    def __init__(self, cv_, x0=0, y0=0, x1=None, y1=None):
        self.cv = cv_
        x1 = cv_.w if x1 is None else x1
        y1 = cv_.h if y1 is None else y1
        self.x0, self.y0, self.x1, self.y1 = cv_.roi(x0, y0, x1 - 1, y1 - 1)
        self.items = []
        self.off = np.array([self.x0, self.y0], np.float64)

    def line(self, pts, width, v=1.0, taper=None, pp=None):
        """polyline; taper=(w_start_frac, w_end_frac); pp = per-point pressure array"""
        pts = np.asarray(pts, np.float64)
        n = len(pts)
        if n < 2:
            return
        if taper is None and pp is None:
            self.items.append((v, 0, pts, width))
            return
        nseg = int(min(8, max(2, n // 3)))
        idx = np.linspace(0, n - 1, nseg + 1).astype(int)
        for k in range(nseg):
            a, b = idx[k], idx[k + 1] + 1
            if b - a < 2:
                continue
            u = (k + 0.5) / nseg
            wk = width * (lerp(taper[0], taper[1], u) if taper is not None else 1.0)
            vk = v * (float(pp[a:b].mean()) if pp is not None else 1.0)
            if wk < 1.0:
                vk *= max(0.25, wk); wk = 1.0
            self.items.append((vk, 0, pts[a:b], wk))

    def poly(self, pts, v=1.0):
        self.items.append((v, 1, np.asarray(pts, np.float64), 0))

    def dot(self, x, y, r, v=1.0):
        self.items.append((v, 2, np.array([[x, y]], np.float64), r))

    def mask(self, blur=0.0):
        h, w = self.y1 - self.y0, self.x1 - self.x0
        m = np.zeros((max(1, h), max(1, w)), np.uint8)
        if h <= 0 or w <= 0:
            return m.astype(F32)
        self.items.sort(key=lambda it: it[0])
        for v, kind, pts, wd in self.items:
            val = int(255 * clamp(v))
            if val <= 0:
                continue
            P = pts - self.off
            if kind == 0:
                cv2.polylines(m, [_fix(P)], False, val, max(1, int(round(wd))), cv2.LINE_AA, 4)
            elif kind == 1:
                cv2.fillPoly(m, [_fix(P)], val, cv2.LINE_AA, 4)
            else:
                cv2.circle(m, (int(round(P[0, 0] * 16)), int(round(P[0, 1] * 16))), int(round(wd * 16)), val, -1, cv2.LINE_AA, 4)
        mf = m.astype(F32) * (1 / 255.0)
        if blur > 0:
            mf = cv2.GaussianBlur(mf, (0, 0), blur)
        return mf

    def commit(self, col, grain=0.75, soft=0.16, op=1.0, streak=None, blur=0.0, tint=None, clip=None, gain=1.0):
        if not self.items:
            return None
        mf = self.mask(blur)
        if gain != 1.0:
            mf = np.clip(mf * gain, 0, 1)
        if clip is not None:
            mf = mf * clip[self.y0:self.y1, self.x0:self.x1]
        self.cv.deposit(mf, col, self.x0, self.y0, grain, soft, op, streak, tint)
        self.items = []
        return mf


def polymask(h, w, pts, blur=0.0):
    if h <= 0 or w <= 0:
        return np.zeros((max(0, h), max(0, w)), F32)
    m = np.zeros((h, w), np.uint8)
    cv2.fillPoly(m, [_fix(pts)], 255, cv2.LINE_AA, 4)
    mf = m.astype(F32) * (1 / 255.0)
    if blur > 0:
        mf = cv2.GaussianBlur(mf, (0, 0), blur)
    return mf


# ------------------------------------------------------------------ the rostrum camera
_vig = None


def shoot(C, rng, weave=0.45, flick=0.008, zoom=1.0, cx=W / 2, cy=H / 2, soft=0.72, grain=0.010, expo=1.0, tintc=None, panx=0.0, pany=0.0):
    """photograph the sheet: a little gate weave, a breath of flicker, lens softness"""
    global _vig
    h, w = C.shape[:2]
    if _vig is None or _vig.shape[:2] != (H, W):
        yy, xx = np.mgrid[0:H, 0:W].astype(F32)
        r2 = ((xx - W / 2) / (W * 0.72)) ** 2 + ((yy - H / 2) / (H * 0.78)) ** 2
        _vig = (1 - 0.20 * np.clip(r2, 0, 1.5) ** 1.3)[..., None].astype(F32)
    dx, dy = rng.normal(0, weave, 2)
    M = np.array([[zoom, 0, cx * (1 - zoom) + dx + panx], [0, zoom, cy * (1 - zoom) + dy + pany]], np.float64)
    out = cv2.warpAffine(C, M, (W, H), flags=cv2.INTER_LINEAR if zoom < 1.5 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    if soft > 0:
        out = cv2.GaussianBlur(out, (0, 0), soft)
    out = out * (_vig * (expo * (1 + rng.normal(0, flick))))
    if tintc is not None:
        out = out * np.asarray(tintc, F32)[None, None, :]
    if grain > 0:
        g = rng.standard_normal((H, W), dtype=F32) * grain
        out += g[..., None]
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


def save(path, C):
    if C.dtype != np.uint8:
        C = (np.clip(C, 0, 1) * 255 + 0.5).astype(np.uint8)
    cv2.imwrite(path, C[..., ::-1])


# ------------------------------------------------------------------ layers (a second sheet laid over the first)
class Layer(Canvas):
    """premultiplied pigment on nothing; keeps a dirty rectangle"""

    def __init__(self, paper, tooth=None):
        self.p = paper
        self.h, self.w = paper.h, paper.w
        self.C = np.zeros((self.h, self.w, 3), F32)
        self.A = np.zeros((self.h, self.w), F32)
        self.T = paper.T if tooth is None else tooth
        self.d = [self.w, self.h, 0, 0]

    def deposit(self, m, col, x0=0, y0=0, grain=0.75, soft=0.16, op=1.0, streak=None, tint=None):
        h, w = m.shape
        d = self.d
        d[0] = min(d[0], x0); d[1] = min(d[1], y0); d[2] = max(d[2], x0 + w); d[3] = max(d[3], y0 + h)
        Canvas.deposit(self, m, col, x0, y0, grain, soft, op, streak, tint)

    def clear(self):
        x0, y0, x1, y1 = self.d
        if x1 > x0 and y1 > y0:
            self.C[y0:y1, x0:x1] = 0; self.A[y0:y1, x0:x1] = 0
        self.d = [self.w, self.h, 0, 0]

    def onto(self, dst, light=None, op=1.0):
        """lay this layer over dst (HxWx3). light: None | rgb triple | HxWx3 field"""
        x0, y0, x1, y1 = self.d
        if x1 <= x0 or y1 <= y0:
            return
        A = self.A[y0:y1, x0:x1, None]
        Cc = self.C[y0:y1, x0:x1]
        if light is not None:
            if isinstance(light, np.ndarray) and light.ndim == 3:
                Cc = Cc * light[y0:y1, x0:x1]
            else:
                Cc = Cc * np.asarray(light, F32)[None, None, :]
        D = dst[y0:y1, x0:x1]
        if op != 1.0:
            D *= (1 - A * op); D += Cc * op
        else:
            D *= (1 - A); D += Cc


class Xf:
    """local (x right, y up, unit = body length) -> sheet pixels"""

    def __init__(self, x, y, s, face=1, rot=0.0, pivot=(0.0, 0.0)):
        self.x, self.y, self.s, self.face, self.rot, self.pivot = x, y, s, face, rot, pivot
        self.c, self.sn = math.cos(rot), math.sin(rot)

    def __call__(self, P):
        P = np.asarray(P, np.float64)
        px = P[..., 0] - self.pivot[0]; py = P[..., 1] - self.pivot[1]
        rx = px * self.c - py * self.sn + self.pivot[0]
        ry = px * self.sn + py * self.c + self.pivot[1]
        return np.stack([self.x + self.face * rx * self.s, self.y - ry * self.s], -1)

    def pt(self, x, y):
        q = self(np.array([x, y]))
        return float(q[0]), float(q[1])
