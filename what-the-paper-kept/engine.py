"""
Dry-media engine for "What the Paper Kept".

Everything here imitates the physics of sticks of pigment dragged over a
toothed sheet: pigment only lands where the paper's tooth rises to meet the
stick, broad sticks leave streaks along their travel, fingers carry pigment
with them, and a hard point leaves a groove that a later rubbing can find.
"""
import math
import numpy as np
import cv2
from scipy.special import ndtr

F32 = np.float32
cv2.setNumThreads(2)


# ----------------------------------------------------------------- noise
def gnoise(rng, h, w, sigma):
    if sigma <= 0:
        n = rng.standard_normal((h, w), dtype=F32)
    elif sigma > 5:
        f = max(1, int(sigma / 2.5))
        hh, ww = h // f + 3, w // f + 3
        n = rng.standard_normal((hh, ww), dtype=F32)
        n = cv2.GaussianBlur(n, (0, 0), sigma / f)
        n = cv2.resize(n, (ww * f, hh * f), interpolation=cv2.INTER_CUBIC)[:h, :w]
    else:
        n = cv2.GaussianBlur(rng.standard_normal((h, w), dtype=F32), (0, 0), sigma)
    return n / (n.std() + 1e-9)


def to_uniform(z):
    return ndtr(z / (z.std() + 1e-9)).astype(F32)


def smooth1d(rng, n, wavelength, amp=1.0):
    """smooth random 1-D signal, unit-ish variance * amp"""
    k = max(2, int(n / max(1.0, wavelength)) + 3)
    ctrl = rng.standard_normal(k)
    x = np.linspace(0, k - 1, n)
    i = np.clip(x.astype(int), 0, k - 2)
    f = x - i
    f = f * f * (3 - 2 * f)
    return (ctrl[i] * (1 - f) + ctrl[i + 1] * f) * amp


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x, p=2.2):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** p


def ease_in(x, p=2.2):
    x = min(1.0, max(0.0, x))
    return x ** p


# ----------------------------------------------------------------- paper
def make_tooth(h, w, rng, scale=1.0, fibres=1.0):
    z = (0.95 * gnoise(rng, h, w, 0.62 * scale) + 0.55 * gnoise(rng, h, w, 1.35 * scale)
         + 0.20 * gnoise(rng, h, w, 3.2 * scale) + 0.10 * gnoise(rng, h, w, 9 * scale))
    if fibres > 0:
        fl = np.zeros((h, w), F32)
        n = int(h * w / 1500 * fibres)
        xs = rng.uniform(0, w, n); ys = rng.uniform(0, h, n)
        ang = rng.uniform(0, math.pi, n) + rng.normal(0, .25, n)
        ln = rng.uniform(10, 46, n) * scale
        cur = rng.normal(0, 0.012, n) / scale
        val = rng.normal(0, 1.0, n)
        for i in range(n):
            m = 7
            s = np.linspace(-.5, .5, m) * ln[i]
            a = ang[i] + cur[i] * s
            px = xs[i] + np.cumsum(np.cos(a)) * ln[i] / m
            py = ys[i] + np.cumsum(np.sin(a)) * ln[i] / m
            pts = np.stack([px, py], 1).astype(np.int32)
            cv2.polylines(fl, [pts], False, float(val[i]), 1)
        fl = cv2.GaussianBlur(fl, (0, 0), 0.6 * scale)
        z += 0.9 * fl
    return to_uniform(z), z


def make_scrap(w, h, seed):
    """a cheap, toned, fibrous off-cut: the small sheet"""
    rng = np.random.default_rng(seed)
    H, z = make_tooth(h, w, rng, 1.0, fibres=1.4)
    tone = np.array([0.435, 0.360, 0.292], F32)
    big = gnoise(rng, h, w, 120) * 0.018 + gnoise(rng, h, w, 30) * 0.008
    base = tone[None, None, :] * (1 + big[..., None])
    # warm / cool mottling
    mot = gnoise(rng, h, w, 60) * 0.006
    base[..., 0] += mot; base[..., 2] -= mot
    # tooth shading (light from upper left)
    Hs = cv2.GaussianBlur(H, (0, 0), 0.8)
    gx = cv2.Sobel(Hs, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(Hs, cv2.CV_32F, 0, 1, ksize=3)
    base *= (1 + 0.050 * (gx + gy))[..., None]
    base *= (1 + 0.030 * (H - 0.5))[..., None]
    # flecks
    n = int(w * h / 420)
    fx = rng.integers(0, w, n); fy = rng.integers(0, h, n)
    fv = rng.normal(0, 0.055, n).astype(F32)
    base[fy, fx] += fv[:, None]
    # a few long pale and dark fibres embedded in the pulp
    fl = np.zeros((h, w), F32)
    for i in range(int(w * h / 9000)):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a = rng.uniform(0, 2 * math.pi); ln = rng.uniform(14, 70)
        m = 9; aa = a + np.cumsum(rng.normal(0, 0.22, m))
        px = x + np.cumsum(np.cos(aa)) * ln / m; py = y + np.cumsum(np.sin(aa)) * ln / m
        cv2.polylines(fl, [np.stack([px, py], 1).astype(np.int32)], False,
                      float(rng.choice([-1, 1]) * rng.uniform(.4, 1)), 1)
    fl = cv2.GaussianBlur(fl, (0, 0), 0.55)
    base += fl[..., None] * np.array([0.085, 0.075, 0.06], F32)
    # an old fold running across, slightly off horizontal
    yy, xx = np.mgrid[0:h, 0:w].astype(F32)
    fold_y = h * 0.69 + (xx - w / 2) * 0.021 + 3 * np.sin(xx / 170.0)
    dfold = yy - fold_y
    crease = np.exp(-(dfold / 1.6) ** 2)
    base *= (1 + 0.10 * np.exp(-((dfold + 2.2) / 1.8) ** 2) - 0.13 * np.exp(-((dfold - 1.6) / 2.0) ** 2))[..., None]
    H2 = np.clip(H + 0.30 * np.exp(-((dfold + 2.0) / 2.2) ** 2) - 0.35 * np.exp(-((dfold - 2.0) / 2.2) ** 2), 0, 1)
    return np.clip(base, 0, 1).astype(F32), H2.astype(F32), crease.astype(F32)


def make_sheet(w, h, seed):
    """the big, bright, well-made sheet"""
    rng = np.random.default_rng(seed)
    H, z = make_tooth(h, w, rng, 1.5, fibres=0.25)
    tone = np.array([0.956, 0.946, 0.918], F32)
    big = gnoise(rng, h, w, 260) * 0.006 + gnoise(rng, h, w, 50) * 0.004
    base = tone[None, None, :] * (1 + big[..., None])
    Hs = cv2.GaussianBlur(H, (0, 0), 1.2)
    gx = cv2.Sobel(Hs, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(Hs, cv2.CV_32F, 0, 1, ksize=3)
    base *= (1 + 0.015 * (gx + gy))[..., None]
    base *= (1 + 0.012 * (H - 0.5))[..., None]
    return np.clip(base, 0, 1).astype(F32), H


# ----------------------------------------------------------------- paths
def catmull(pts, spacing=2.0):
    pts = np.asarray(pts, np.float64)
    if len(pts) < 2:
        return pts.astype(F32)
    if len(pts) == 2:
        n = max(2, int(np.hypot(*(pts[1] - pts[0])) / spacing))
        t = np.linspace(0, 1, n)[:, None]
        return (pts[0] * (1 - t) + pts[1] * t).astype(F32)
    P = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(4, int(np.hypot(*(p2 - p1)) / 3))
        t = np.linspace(0, 1, n, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1][None])
    q = np.vstack(out)
    return resample(q, spacing)


def resample(q, spacing=2.0):
    q = np.asarray(q, np.float64)
    d = np.hypot(*np.diff(q, axis=0).T)
    s = np.concatenate([[0], np.cumsum(d)])
    if s[-1] < 1e-6:
        return q[:1].astype(F32)
    n = max(2, int(s[-1] / spacing) + 1)
    u = np.linspace(0, s[-1], n)
    return np.stack([np.interp(u, s, q[:, 0]), np.interp(u, s, q[:, 1])], 1).astype(F32)


def hand(pts, rng, wobble=2.0, wl=90.0, tremor=0.35, spacing=2.0):
    """a spline through pts as a hand would draw it: never quite the curve intended"""
    q = catmull(pts, spacing).astype(np.float64)
    n = len(q)
    if n < 3:
        return q.astype(F32)
    d = np.gradient(q, axis=0)
    L = np.hypot(d[:, 0], d[:, 1]) + 1e-9
    nrm = np.stack([-d[:, 1] / L, d[:, 0] / L], 1)
    off = smooth1d(rng, n, wl / spacing, wobble) + smooth1d(rng, n, 14 / spacing, tremor)
    along = smooth1d(rng, n, wl * 1.3 / spacing, wobble * 0.5)
    q = q + nrm * off[:, None] + (d / L[:, None]) * along[:, None]
    return q.astype(F32)


def pressure_profile(n, rng, taper_in=0.08, taper_out=0.14, var=0.18, wl=60, base=1.0, f_in=0.25, f_out=0.12):
    t = np.linspace(0, 1, n)
    p = np.ones(n) * base
    p *= 1 + smooth1d(rng, n, wl, var)
    if taper_in > 0:
        p *= f_in + (1 - f_in) * sstep(0, taper_in, t)
    if taper_out > 0:
        p *= f_out + (1 - f_out) * (1 - sstep(1 - taper_out, 1, t))
    return np.clip(p, 0, 1.6).astype(F32)


def stick_profile(rng, k, rough=0.35, edge=0.25, point=0.0):
    """the worn face of a stick: where it bites and where it skips.
    point>0 gives a rounded tip (charcoal, conte corner) whose line narrows as pressure drops"""
    k = max(3, int(k))
    x = np.linspace(-1, 1, k)
    p = 1 + smooth1d(rng, k, max(2.0, k / 6), rough) + rng.normal(0, rough * 0.45, k)
    p *= 1 - edge * np.abs(x) ** 3
    if point > 0:
        p *= 1 - point * np.abs(x) ** 1.6
    return np.clip(p, 0.0, 1.25).astype(F32)


def _fix(P):
    return np.round(P * 16.0).astype(np.int32).reshape(-1, 1, 2)


# ----------------------------------------------------------------- canvas
class Canvas:
    def __init__(self, base, H, resist=None, relief=None):
        self.h, self.w = H.shape
        self.base = base
        self.C = base.copy()
        self.H = H
        self.L = np.zeros_like(H)        # how much pigment already fills the tooth
        self.Tp = np.zeros_like(H)       # raised pigment (for the rubbing later)
        self.Tn = np.zeros_like(H)       # grooves pressed by hard points
        self.resist = resist             # a place where pigment will not take
        self.relief = relief             # what lies underneath this sheet

    def live(self):
        return self.C.copy()


def _roi(path, pad, w, h):
    x0 = int(math.floor(path[:, 0].min() - pad)); x1 = int(math.ceil(path[:, 0].max() + pad)) + 1
    y0 = int(math.floor(path[:, 1].min() - pad)); y1 = int(math.ceil(path[:, 1].max() + pad)) + 1
    x0 = max(0, x0); y0 = max(0, y0); x1 = min(w, x1); y1 = min(h, y1)
    return x0, y0, x1, y1


def build_mask(path, pp, width, prof, x0, y0, w, h, pm_sigma=None, ragged=(True, True)):
    P = path.astype(np.float64) - np.array([x0, y0])
    n = len(P)
    m = np.zeros((h, w), np.uint8)
    if width <= 5.5 or prof is None:
        step = 4
        for a in range(0, n - 1, step):
            b = min(n, a + step + 1)
            pv = float(pp[a:b].mean())
            v = int(255 * min(1.0, 0.35 + 0.65 * pv))
            th = max(1, int(round(width * (0.45 + 0.6 * min(1.2, pv)))))
            if pv > 0.02:
                cv2.polylines(m, [_fix(P[a:b])], False, v, th, cv2.LINE_AA, 4)
        mf = m.astype(F32) * (1 / 255.0)
        mf = cv2.GaussianBlur(mf, (0, 0), 0.55)
        if width < 2.0:
            mf *= width / 2.0 + 0.25
        return mf
    d = np.gradient(P, axis=0)
    L = np.hypot(d[:, 0], d[:, 1]) + 1e-9
    nrm = np.stack([-d[:, 1] / L, d[:, 0] / L], 1)
    K = len(prof)
    offs = np.linspace(-0.5, 0.5, K) * width
    th = 2 if width / K < 1.7 else 3
    rag = int(min(n * 0.25, width * 0.22 + 2))
    h1 = (np.sin(np.arange(K) * 12.9898 + width * 3.1) * 43758.5453) % 1.0
    h2 = (np.sin(np.arange(K) * 78.233 + width * 1.7) * 12543.123) % 1.0
    for k in range(K):
        v = int(255 * min(1.0, float(prof[k])))
        if v < 6:
            continue
        a = int(h1[k] * rag) if ragged[0] else 0
        b = n - (int(h2[k] * rag) if ragged[1] else 0)
        if b - a < 2:
            continue
        cv2.polylines(m, [_fix(P[a:b] + nrm[a:b] * offs[k])], False, v, th, cv2.LINE_AA, 4)
    mf = m.astype(F32) * (1 / 255.0)
    pm = np.zeros((h, w), np.uint8)
    step = 7
    th2 = int(width + 6)
    Pi = np.round(P).astype(np.int32)
    for a in range(0, n - 1, step):
        b = min(n, a + step + 1)
        v = int(255 * min(1.0, float(pp[a:b].mean()) / 1.3))
        if v > 0:
            cv2.polylines(pm, [Pi[a:b].reshape(-1, 1, 2)], False, v, th2, cv2.LINE_8)
    sg = pm_sigma if pm_sigma else max(1.5, width * 0.16)
    pmf = cv2.GaussianBlur(pm.astype(F32) * (1.3 / 255.0), (0, 0), sg)
    return mf * pmf


def stroke(cv, C, path, width, color, pp=None, prof=None, press=1.0, opacity=1.0, soft=0.2,
           haze=0.08, fill=0.5, mode='opaque', commit=False, thick=1.0, indent=0.0, load=0.5,
           i0=0, i1=None, rub=False, rub_mix=0.5, edge_soft=0.0):
    """drag a stick along path[i0:i1] depositing pigment onto C through the paper's tooth"""
    n = len(path)
    if i1 is None:
        i1 = n
    i0 = max(0, i0); i1 = min(n, i1)
    if i1 - i0 < 2:
        return None
    sub = path[i0:i1]
    if pp is None:
        pp_sub = np.ones(len(sub), F32)
    else:
        pp_sub = pp[i0:i1]
    if (i1 < n or i0 > 0) and width > 5.5:
        # a stick still travelling: its leading and trailing ends are not yet pressed home
        pp_sub = pp_sub.copy()
        k = int(min(len(sub) // 2, 6 + width * 0.9))
        if k > 1:
            ramp = np.linspace(0.15, 1.0, k, dtype=F32) ** 1.5
            if i1 < n:
                pp_sub[-k:] *= ramp[::-1]
            if i0 > 0:
                pp_sub[:k] *= ramp
    pad = width * 0.5 + 8
    x0, y0, x1, y1 = _roi(sub, pad, cv.w, cv.h)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    mf = build_mask(sub, pp_sub, width, prof, x0, y0, x1 - x0, y1 - y0, ragged=(True, True))
    if edge_soft > 0:
        mf = cv2.GaussianBlur(mf, (0, 0), edge_soft)
    Hr = cv.H[y0:y1, x0:x1]
    if rub and cv.relief is not None:
        Hl = (1 - rub_mix) * Hr + rub_mix * cv.relief[y0:y1, x0:x1]
    else:
        Hl = np.minimum(1.0, Hr + fill * cv.L[y0:y1, x0:x1])
    p = mf * press
    a = np.clip((Hl - (1.0 - p)) / soft + 0.5, 0, 1) * np.clip(p * 10.0, 0, 1)
    a = a * opacity
    if haze > 0:
        a = a + haze * np.clip(p, 0, 1) * (1 - a)
    if cv.resist is not None:
        a = a * cv.resist[y0:y1, x0:x1]
    Cr = C[y0:y1, x0:x1]
    col = np.asarray(color, F32)
    if mode == 'opaque':
        Cr += (col[None, None, :] - Cr) * a[..., None]
    else:  # multiply: graphite / thin wax on bright paper
        Cr *= 1.0 - a[..., None] * (1.0 - col[None, None, :])
    if commit:
        cv.L[y0:y1, x0:x1] = np.minimum(1.0, cv.L[y0:y1, x0:x1] + a * load)
        if thick > 0:
            cv.Tp[y0:y1, x0:x1] += a * thick
        if indent > 0:
            cv.Tn[y0:y1, x0:x1] = np.maximum(cv.Tn[y0:y1, x0:x1], np.clip(mf * press, 0, 1) * indent)
    return (x0, y0, x1, y1)


def dust(cv, C, path, width, color, n, rng, spread=1.0, alpha=0.75):
    """crumbs of pigment that fall off the stick and stay"""
    if len(path) < 2 or n <= 0:
        return
    idx = rng.integers(0, len(path), n)
    off = rng.normal(0, width * 0.45 * spread + 3, (n, 2))
    xy = np.round(path[idx] + off).astype(int)
    ok = (xy[:, 0] >= 1) & (xy[:, 0] < cv.w - 1) & (xy[:, 1] >= 1) & (xy[:, 1] < cv.h - 1)
    xy = xy[ok]
    if len(xy) == 0:
        return
    al = (rng.uniform(0.25, 1.0, len(xy)) * alpha).astype(F32)[:, None]
    col = np.asarray(color, F32)[None, :]
    C[xy[:, 1], xy[:, 0]] += (col - C[xy[:, 1], xy[:, 0]]) * al
    big = rng.uniform(0, 1, len(xy)) < 0.22
    xb = xy[big]
    if len(xb):
        ab = al[big] * 0.7
        C[xb[:, 1], xb[:, 0] + 1] += (col - C[xb[:, 1], xb[:, 0] + 1]) * ab
        C[xb[:, 1] + 1, xb[:, 0]] += (col - C[xb[:, 1] + 1, xb[:, 0]]) * ab * 0.8


_stamp_cache = {}


def _stamp(r):
    if r not in _stamp_cache:
        y, x = np.mgrid[-r:r + 1, -r:r + 1].astype(F32)
        d = np.sqrt(x * x + y * y) / r
        _stamp_cache[r] = np.clip(1 - d, 0, 1) ** 1.3
    return _stamp_cache[r]


def smudge(cv, C, path, radius, strength=0.6, soften=0.5, commit=True, i0=0, i1=None, state=None):
    """a fingertip or rag dragged along path: it carries what it touches"""
    r = int(radius)
    if state is not None and 'st' in state:
        st = state['st']
    else:
        tex = gnoise(np.random.default_rng(int(path[0, 0] * 7 + path[0, 1] * 13 + r)), 2 * r + 1, 2 * r + 1, 1.6)
        st = (_stamp(r) * np.clip(0.75 + 0.42 * tex, 0.15, 1.3)).astype(F32)
    n = len(path)
    if i1 is None:
        i1 = n
    step = max(1, int(r / 3.2 / 2.0))
    if state is None:
        state = {}
    carried = state.get('carried')
    k0 = state.get('next', i0)
    k = max(k0, i0)
    while k < i1:
        x, y = int(round(path[k, 0])), int(round(path[k, 1]))
        k += step
        if x - r < 0 or y - r < 0 or x + r + 1 > cv.w or y + r + 1 > cv.h:
            continue
        sl = (slice(y - r, y + r + 1), slice(x - r, x + r + 1))
        patch = C[sl]
        if carried is None:
            carried = patch.copy()
            continue
        m = (st * strength)[..., None]
        new = patch + (carried - patch) * m
        if soften > 0:
            bl = cv2.GaussianBlur(new, (0, 0), 1.0)
            new = new + (bl - new) * (m * soften)
        carried = carried * 0.62 + new * 0.38
        C[sl] = new
        if commit:
            tp = cv.Tp[sl]
            cv.Tp[sl] = tp + (cv2.GaussianBlur(tp, (0, 0), 2.0) - tp) * (st * strength * 0.5)
            cv.L[sl] = np.minimum(1.0, cv.L[sl] + st * strength * 0.10)
    state['carried'] = carried
    state['next'] = k
    state['st'] = st
    return state


def erase(cv, C, path, width, residue=0.0, i0=0, i1=None, soft=2.0):
    """lift pigment back off; on good paper nothing at all remains"""
    n = len(path)
    if i1 is None:
        i1 = n
    i0 = max(0, i0); i1 = min(n, i1)
    if i1 - i0 < 2:
        return
    sub = path[i0:i1]
    x0, y0, x1, y1 = _roi(sub, width * 0.5 + 8, cv.w, cv.h)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    P = np.round(sub - np.array([x0, y0])).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(m, [P], False, 255, int(width), cv2.LINE_8)
    mf = cv2.GaussianBlur(m.astype(F32) / 255.0, (0, 0), soft)
    mf = np.clip(mf * 1.25, 0, 1)
    Cr = C[y0:y1, x0:x1]
    tgt = cv.base[y0:y1, x0:x1]
    if residue > 0:
        g = residue * (1.25 - cv.H[y0:y1, x0:x1])[..., None]
        tgt = tgt * (1 - g) + Cr * g
    Cr += (tgt - Cr) * mf[..., None]
    cv.L[y0:y1, x0:x1] *= (1 - mf * (1 - residue))


# ----------------------------------------------------------------- the camera
class Rostrum:
    """drawings photographed one at a time under a lamp, by hand"""

    def __init__(self, W=1920, H=1080, seed=5):
        self.W, self.H = W, H
        self.rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:H, 0:W].astype(F32)
        d = np.sqrt(((xx - W * 0.30) / W) ** 2 + ((yy - H * 0.22) / W) ** 2)
        self.lamp = (1.045 - 0.26 * d ** 1.5).astype(F32)       # lamp up and to the left
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        self.vig = (1 - 0.10 * np.clip(r - 0.55, 0, 2) ** 2).astype(F32)
        self.jit = (0.0, 0.0, 0.0)
        self.flick = 1.0
        self.hair = None

    def new_exposure(self, weave=0.7, flicker=0.012, bump=0.0):
        r = self.rng
        w = weave + bump
        self.jit = (r.normal(0, w), r.normal(0, w), r.normal(0, 0.00030 * w))
        self.flick = 1.0 + r.normal(0, flicker)
        self.hair = None
        if r.uniform() < 0.045:
            self.hair = (r.uniform(0, self.W), r.uniform(0, self.H), r.uniform(0, 6.28), r.uniform(8, 40))

    def matrix(self, cx, cy, zoom, rot=0.0):
        """canvas -> screen affine: camera centred on (cx,cy), zoom = screen px per canvas px"""
        jx, jy, ja = self.jit
        a = ja + rot
        c, s = math.cos(a) * zoom, math.sin(a) * zoom
        return np.array([[c, -s, self.W / 2 - c * cx + s * cy + jx],
                         [s, c, self.H / 2 - s * cx - c * cy + jy]], np.float64)

    def shoot(self, img, cx, cy, zoom, rot=0.0, border=cv2.BORDER_REPLICATE, shift=(0.0, 0.0), border_value=0):
        M = self.matrix(cx, cy, zoom, rot)
        M[0, 2] += shift[0]; M[1, 2] += shift[1]
        z = zoom
        while z <= 0.62:
            img = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2), interpolation=cv2.INTER_AREA)
            z *= 2
            M[:, :2] *= 2
        if 0.62 < z < 0.97:
            # crop to what the lens sees, soften just enough not to alias
            inv = cv2.invertAffineTransform(M)
            cs = np.array([[0, 0, 1], [self.W, 0, 1], [0, self.H, 1], [self.W, self.H, 1]], np.float64) @ inv.T
            x0 = max(0, int(cs[:, 0].min()) - 8); x1 = min(img.shape[1], int(cs[:, 0].max()) + 9)
            y0 = max(0, int(cs[:, 1].min()) - 8); y1 = min(img.shape[0], int(cs[:, 1].max()) + 9)
            if x1 - x0 > 8 and y1 - y0 > 8:
                img = cv2.GaussianBlur(img[y0:y1, x0:x1], (0, 0), 0.42 / z - 0.25)
                M[0, 2] += M[0, 0] * x0 + M[0, 1] * y0
                M[1, 2] += M[1, 0] * x0 + M[1, 1] * y0
        return cv2.warpAffine(img, M, (self.W, self.H), flags=cv2.INTER_LINEAR, borderMode=border, borderValue=border_value)

    def develop(self, img, warmth=0.0, exposure=1.0, grain=0.011, soft=0.30, lamp=1.0, tint=None):
        r = self.rng
        light = (1 + lamp * (self.lamp - 1)) * self.vig * (self.flick * exposure)
        x = img * light[..., None]
        if soft > 0:
            bl = cv2.GaussianBlur(x, (0, 0), 1.0)
            x = x + (bl - x) * soft
            hl = cv2.GaussianBlur(np.clip(x - 0.74, 0, 1), (0, 0), 6)     # a breath of halation
            x = x + hl * 0.08
        if warmth != 0:
            x = x * np.array([1 + 0.06 * warmth, 1 + 0.008 * warmth, 1 - 0.085 * warmth], F32)
        if tint is not None:
            x = x * np.asarray(tint, F32)
        x = np.where(x > 0.86, 0.86 + (1 - np.exp(-(x - 0.86) / 0.14)) * 0.14, x)   # soft shoulder
        h, w = x.shape[:2]
        g = r.standard_normal((h // 2 + 1, w // 2 + 1), dtype=F32)
        g = cv2.resize(g, (w + 2, h + 2), interpolation=cv2.INTER_LINEAR)[:h, :w, None] * 0.6
        g2 = r.standard_normal((h, w, 3), dtype=F32) * 0.55
        x = x + (g + g2) * grain * (0.55 + 0.6 * (1 - np.abs(x - 0.45)))
        if self.hair is not None:
            hx, hy, ha, hl_ = self.hair
            m = 8
            aa = ha + np.cumsum(r.normal(0, 0.35, m))
            px = hx + np.cumsum(np.cos(aa)) * hl_ / m; py = hy + np.cumsum(np.sin(aa)) * hl_ / m
            ov = np.zeros((h, w), np.uint8)
            cv2.polylines(ov, [np.stack([px, py], 1).astype(np.int32)], False, 255, 1, cv2.LINE_AA)
            x = x * (1 - 0.30 * (ov.astype(F32) / 255.0))[..., None]
        x = np.clip(x, 0, 1)
        d = r.uniform(-0.5, 0.5, x.shape).astype(F32)
        return np.clip(x * 255.0 + 0.5 + d, 0, 255).astype(np.uint8)


# ----------------------------------------------------------------- what lies underneath
def torn_mask(w, h, seed, inset=10):
    """the outline of the small sheet: three torn sides and one cut"""
    rng = np.random.default_rng(seed)
    m = np.ones((h, w), F32)
    xs = np.arange(w); ys = np.arange(h)
    top = inset + 5 + smooth1d(rng, w, 90, 5) + smooth1d(rng, w, 9, 2.2)
    bot = h - inset - 3 - np.abs(smooth1d(rng, w, 400, 1.2))          # the cut side: almost straight
    lef = inset + 6 + smooth1d(rng, h, 70, 6) + smooth1d(rng, h, 8, 2.5)
    rig = w - inset - 8 - smooth1d(rng, h, 110, 7) - smooth1d(rng, h, 10, 2.5)
    yy, xx = np.mgrid[0:h, 0:w]
    m[(yy < top[None, :]) | (yy > bot[None, :]) | (xx < lef[:, None]) | (xx > rig[:, None])] = 0
    return m


def build_relief(scrap, crease, edge_mask, scale, canvas_w, canvas_h, cx, cy, angle_deg):
    """press the small sheet's surface into a map the big sheet can be rubbed over.
    returns relief (0..1, 0.5 = nothing there), footprint mask and the affine used"""
    h, w = scrap.H.shape
    tp = np.clip(cv2.GaussianBlur(scrap.Tp, (0, 0), 1.0), 0, 2.2) / 2.2
    tn = np.clip(cv2.GaussianBlur(scrap.Tn, (0, 0), 1.2) * 1.5, 0, 1)
    raw = 0.30 * edge_mask + 0.55 * tp * edge_mask - 1.25 * tn * edge_mask \
        + 0.10 * (scrap.H - 0.5) * edge_mask + 0.25 * crease * edge_mask
    a = math.radians(angle_deg)
    c, s = math.cos(a) * scale, math.sin(a) * scale
    M = np.array([[c, -s, cx - c * w / 2 + s * h / 2], [s, c, cy - s * w / 2 - c * h / 2]], np.float64)
    rawb = cv2.warpAffine(raw.astype(F32), M, (canvas_w, canvas_h), flags=cv2.INTER_AREA)
    foot = cv2.warpAffine(edge_mask, M, (canvas_w, canvas_h), flags=cv2.INTER_AREA)
    loc = rawb - cv2.GaussianBlur(rawb, (0, 0), 18)
    rel = np.clip(0.5 + 0.13 * foot + 1.25 * loc + 0.30 * (rawb - 0.30 * foot), 0, 1).astype(F32)
    return rel, foot, M
