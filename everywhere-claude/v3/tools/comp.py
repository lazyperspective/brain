# Compositor: puts a rendered character layer into a plate frame. Works in a region of interest for speed.
import numpy as np, cv2, math

DEF = dict(exposure=1.0, tint=(1, 1, 1), sat=1.0, contrast=1.0, lift=0.0, haze=0.0, haze_col=None, blur=0.0, mblur=(0.0, 0.0),
           wrap=0.2, wrap_sigma=10, grain=0.0, grain_size=0.8, chroma_grain=0.35, shadow_k=0.0, shadow_soft=4.0,
           shadow_col=(0.55, 0.55, 0.6), ao_k=0.0, ao_soft=3.0, ao_col=(0.5, 0.5, 0.55), opacity=1.0, seed=0, edge_soft=0.0,
           sharpen=0.0, highlight=1.0, ca=0.0, glitch=0.0, refl_k=0.0, refl_blur=2.5, refl_ripple=2.0, refl_fade=60.0, refl_dark=0.15)


def line_kernel(dx, dy):
    L = math.hypot(dx, dy)
    if L < 0.75: return None
    n = int(math.ceil(L)) | 1
    k = np.zeros((n + 2, n + 2), np.float32); c = (n + 1) / 2
    for i in range(4 * n + 1):
        t = i / (4 * n) - 0.5
        x, y = c + dx * t, c + dy * t
        x0, y0 = int(math.floor(x)), int(math.floor(y)); fx, fy = x - x0, y - y0
        for (xx, yy, w) in ((x0, y0, (1 - fx) * (1 - fy)), (x0 + 1, y0, fx * (1 - fy)), (x0, y0 + 1, (1 - fx) * fy), (x0 + 1, y0 + 1, fx * fy)):
            if 0 <= xx < n + 2 and 0 <= yy < n + 2: k[yy, xx] += w
    return k / k.sum()


def s2l(x): return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
def l2s(x): x = np.maximum(x, 0); return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def composite(out, layer, p, matte=None, extra_alpha=None):
    """out: float32 BGR plate (H,W,3) 0..1, modified in place. layer from rig.load_layer. p: grade params (DEF overrides).
    matte: optional function(x0,y0,x1,y1)->(h,w) float occluder (1 = plate in front)."""
    q = dict(DEF); q.update(p or {})
    H, W = out.shape[:2]
    x0, y0, w, h = layer['crop']
    mb = q['mblur']; marg = int(abs(mb[0]) + abs(mb[1]) + 4 * max(q['blur'], q['shadow_soft'], q['ao_soft'], 1) + q['wrap_sigma'] * 2 + 6)
    X0, Y0, X1, Y1 = max(0, x0 - marg), max(0, y0 - marg), min(W, x0 + w + marg), min(H, y0 + h + marg)
    if X1 <= X0 or Y1 <= Y0: return
    rw, rh = X1 - X0, Y1 - Y0
    # layer into ROI
    pm = np.zeros((rh, rw, 4), np.float32); sh = np.zeros((rh, rw, 2), np.float32)
    lx0, ly0 = max(x0, X0), max(y0, Y0); lx1, ly1 = min(x0 + w, X1), min(y0 + h, Y1)
    if lx1 <= lx0 or ly1 <= ly0: return
    pm[ly0 - Y0:ly1 - Y0, lx0 - X0:lx1 - X0] = layer['pm'][ly0 - y0:ly1 - y0, lx0 - x0:lx1 - x0]
    if layer['shadow'] is not None:
        sh[ly0 - Y0:ly1 - Y0, lx0 - X0:lx1 - X0] = layer['shadow'][ly0 - y0:ly1 - y0, lx0 - x0:lx1 - x0]
    roi = out[Y0:Y1, X0:X1]
    plate0 = roi.copy()
    # 1) ground shadow + contact AO (multiplied into the plate)
    smask = q.get('shadow_mask')
    smask = smask(X0, Y0, X1, Y1) if smask is not None else None
    if q['shadow_k'] > 0 and sh[..., 0].max() > 0:
        s = cv2.GaussianBlur(sh[..., 0], (0, 0), q['shadow_soft']) * q['shadow_k']
        if smask is not None: s = s * smask
        roi *= (1 - s[..., None] + s[..., None] * np.array(q['shadow_col'], np.float32))
    if q['ao_k'] > 0 and sh[..., 1].max() > 0:
        a = cv2.GaussianBlur(sh[..., 1], (0, 0), q['ao_soft']) * q['ao_k']
        if smask is not None: a = a * smask
        roi *= (1 - a[..., None] + a[..., None] * np.array(q['ao_col'], np.float32))
    # 1b) wet-ground reflection (rendered mirror pass): blurred, rippled, fading away from the contact line, replaces the plate's own
    if q['refl_k'] > 0 and layer.get('refl') is not None:
        rf = np.zeros((rh, rw, 4), np.float32); rf[ly0 - Y0:ly1 - Y0, lx0 - X0:lx1 - X0] = layer['refl'][ly0 - y0:ly1 - y0, lx0 - x0:lx1 - x0]
        rng0 = np.random.default_rng(q['seed'] + 77)
        nz = cv2.GaussianBlur(rng0.normal(0, 1, (rh, rw)).astype(np.float32), (0, 0), 3.0); nz /= max(nz.std(), 1e-4)
        xx, yy = np.meshgrid(np.arange(rw, dtype=np.float32), np.arange(rh, dtype=np.float32))
        rf = cv2.remap(rf, xx + nz * q['refl_ripple'], yy + nz * q['refl_ripple'] * 0.4, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        rf = cv2.GaussianBlur(rf, (0, 0), q['refl_blur'])
        top = layer['pts'].get('root', [0, 0])[1] - Y0 if layer.get('pts') else 0
        fade = np.clip(1 - (np.arange(rh, dtype=np.float32) - top) / q['refl_fade'], 0, 1)[:, None] ** 1.5
        ra = rf[..., 3] * fade * q['refl_k']
        rcol = rf[..., :3] / np.maximum(rf[..., 3:4], 1e-5)
        rcol = s2l(np.clip(rcol, 0, 1)) * q['exposure'] * np.array(q['tint'], np.float32) * (1 - q['refl_dark']); rcol = l2s(rcol)
        if smask is not None: ra = ra * smask
        roi[:] = roi * (1 - ra[..., None]) + np.clip(rcol, 0, 1) * ra[..., None]
    # 2) grade the character (unpremultiplied, in linear light)
    A = pm[..., 3]
    rgb = pm[..., :3] / np.maximum(A[..., None], 1e-5)
    L = s2l(np.clip(rgb, 0, 1)) * q['exposure'] * np.array(q['tint'], np.float32)
    lum = (L * np.array([0.0722, 0.7152, 0.2126], np.float32)).sum(2, keepdims=True)
    L = lum + (L - lum) * q['sat']
    if q['contrast'] != 1.0:
        piv = 0.18; L = piv * (np.maximum(L, 0) / piv) ** q['contrast']
    if q['highlight'] != 1.0:   # soft shoulder like the plates' tone-mapping
        k = q['highlight']; L = L / (1 + np.maximum(L - 0.6, 0) * (1 - k) * 2)
    rgb = l2s(L)
    if q['haze'] > 0:
        hc = np.array(q['haze_col'], np.float32) if q['haze_col'] is not None else plate0.reshape(-1, 3).mean(0)
        rgb = rgb * (1 - q['haze']) + hc * q['haze']
    if q['lift'] > 0: rgb = q['lift'] + rgb * (1 - q['lift'])
    rgb = np.clip(rgb, 0, 1)
    A = A * q['opacity']
    if extra_alpha is not None: A = A * extra_alpha[Y0:Y1, X0:X1]
    # 3) optics: motion blur along the screen velocity, then defocus to match the plate's softness
    P = np.concatenate([rgb * A[..., None], A[..., None]], 2)
    k = line_kernel(*mb)
    if k is not None: P = cv2.filter2D(P, -1, k, borderType=cv2.BORDER_CONSTANT)
    if q['blur'] > 0.05: P = cv2.GaussianBlur(P, (0, 0), q['blur'])
    if q['sharpen'] > 0:
        b = cv2.GaussianBlur(P, (0, 0), 1.2); P = P + (P - b) * q['sharpen']; P = np.clip(P, 0, None); P[..., 3] = np.clip(P[..., 3], 0, 1)
    A = P[..., 3]; rgb = P[..., :3] / np.maximum(A[..., None], 1e-5)
    # 4) occlusion by foreground plate objects
    if matte is not None:
        m = matte(X0, Y0, X1, Y1)
        A = A * (1 - m)
    # 5) light wrap: the blurred plate bleeds onto the silhouette edge
    if q['wrap'] > 0:
        pb = cv2.GaussianBlur(plate0, (0, 0), q['wrap_sigma'])
        er = cv2.GaussianBlur(cv2.erode(A, np.ones((5, 5), np.uint8)), (0, 0), 3)
        edge = np.clip(A - er, 0, 1)[..., None] * q['wrap']
        rgb = rgb * (1 - edge) + pb * edge
    # 6) grain matched to the plate
    if q['grain'] > 0:
        rng = np.random.default_rng(q['seed'])
        n = rng.normal(0, 1, (rh, rw, 1)).astype(np.float32)
        c = rng.normal(0, 1, (rh, rw, 3)).astype(np.float32)
        nz = n + c * q['chroma_grain']
        if q['grain_size'] > 0.3: nz = cv2.GaussianBlur(nz, (0, 0), q['grain_size']); nz /= max(nz.std(), 1e-4)
        rgb = rgb + nz * q['grain']
    rgb = np.clip(rgb, 0, 1)
    # 7) digital glitch (zap): horizontal band tears + RGB split, on the character only
    if q['glitch'] > 0:
        g = q['glitch']; rng = np.random.default_rng(q['seed'] + 999)
        P2 = np.concatenate([rgb * A[..., None], A[..., None]], 2); out2 = P2.copy(); y = 0
        while y < rh:
            hb = int(rng.integers(3, 14)); dx = int(rng.normal(0, 9 * g)) if rng.random() < 0.6 else 0
            out2[y:y + hb] = np.roll(P2[y:y + hb], dx, axis=1); y += hb
        sh = int(round(4 * g)) + 1
        out2[..., 2] = np.roll(out2[..., 2], sh, 1); out2[..., 0] = np.roll(out2[..., 0], -sh, 1)
        out2[..., :3] = np.round(out2[..., :3] * 6) / 6          # crushed colour depth
        A = np.clip(out2[..., 3], 0, 1); rgb = np.clip(out2[..., :3] / np.maximum(A[..., None], 1e-4), 0, 1)
        A = np.maximum(A, np.clip(out2[..., :3].max(2), 0, 1) * 0.9)
    # 8) lens: lateral chromatic aberration (telephoto): R and B images shifted apart along the radial direction
    if q['ca'] > 0:
        cx, cy = (X0 + X1) / 2 - W / 2, (Y0 + Y1) / 2 - H / 2; L = math.hypot(cx, cy) + 1e-6
        d = np.array([cx / L, cy / L]) * q['ca'] * (0.35 + 0.65 * min(1.0, L / 900))
        out = roi * 0
        for c, sgn in ((2, 1.0), (1, 0.0), (0, -1.0)):
            M = np.float32([[1, 0, sgn * d[0]], [0, 1, sgn * d[1]]])
            Ac = cv2.warpAffine(A, M, (rw, rh), flags=cv2.INTER_LINEAR) if sgn else A
            Cc = cv2.warpAffine(rgb[..., c] * A, M, (rw, rh), flags=cv2.INTER_LINEAR) if sgn else rgb[..., c] * A
            roi[..., c] = roi[..., c] * (1 - Ac) + Cc
        return
    roi[:] = roi * (1 - A[..., None]) + rgb * A[..., None]


def noise_sigma(img, box=None):
    """robust estimate of the plate's per-pixel noise (0..1 units) from a flat-ish region"""
    g = img.astype(np.float32)
    if g.max() > 1.5: g = g / 255.0
    if box: x0, y0, x1, y1 = box; g = g[y0:y1, x0:x1]
    g = g.mean(2) if g.ndim == 3 else g
    hp = g - cv2.GaussianBlur(g, (0, 0), 1.5)
    return float(np.median(np.abs(hp)) * 1.4826)
