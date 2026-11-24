# Hand-drawn "natural symmetry" overlays, ported from magic/patterns.html to Python so they can be TRACKED: every stroke is
# built once in a reference frame (wobbly double-pass ink, exact mirror copies on an axis), then mapped through the shot's
# track to each frame. progress 0..1 reveals the strokes in order (draw-on), alpha fades them, and a gentle per-frame boil
# re-jitters the wobble every few frames.
import numpy as np, cv2, math

STYLE = dict(color=(255, 243, 214), glow=(255, 214, 140), gk=0.85, width=3.2, alpha=0.92, blur=14)   # RGB like the canvas version


def st(**kw):
    s = dict(STYLE); s.update(kw); return s


def resample(pts, step=5.0):
    out = []
    pts = np.asarray(pts, float)
    for a, b in zip(pts[:-1], pts[1:]):
        d = np.linalg.norm(b - a); k = max(1, int(math.ceil(d / step)))
        for j in range(k): out.append(a + (b - a) * j / k)
    out.append(pts[-1]); return np.array(out)


def wobble(pts, amp, rng, step=5.0):
    P = resample(pts, step)
    p1, p2 = rng.uniform(0, 6.28), rng.uniform(0, 6.28); f1 = 0.02 + rng.uniform(0, 0.02); f2 = 0.07 + rng.uniform(0, 0.05)
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    nx = np.gradient(P[:, 1]) * -1; ny = np.gradient(P[:, 0]); L = np.hypot(nx, ny) + 1e-9
    w = amp * (np.sin(seg * f1 + p1) * 0.7 + np.sin(seg * f2 + p2) * 0.3)
    return P + np.stack([nx / L * w, ny / L * w], 1)


class Pattern:
    def __init__(self, seed=7):
        self.rng = np.random.default_rng(seed); self.items = []    # each item: list of (kind, pts, style) drawn together

    def line(self, pts, ax=None, amp=1.6, style=None, mirror_y=None):
        s = style or STYLE; w = wobble(pts, amp, self.rng)
        grp = [('line', w, s)]
        if ax is not None: grp.append(('line', np.stack([2 * ax - w[:, 0], w[:, 1]], 1), s))
        if mirror_y is not None: grp.append(('line', np.stack([w[:, 0], 2 * mirror_y - w[:, 1]], 1), s))
        self.items.append(dict(g=grp, amp=amp, raw=np.asarray(pts, float), ax=ax))

    def curve(self, fn, t0, t1, n, **kw): self.line([fn(t0 + (t1 - t0) * i / n) for i in range(n + 1)], **kw)

    def circle(self, cx, cy, r, **kw): self.curve(lambda t: (cx + r * math.cos(t), cy + r * math.sin(t)), -math.pi / 2, 1.5 * math.pi + 0.12, 90, **kw)

    def dot(self, x, y, r, ax=None, style=None):
        s = style or STYLE; grp = [('dot', np.array([[x, y]]), dict(s, r=r))]
        if ax is not None: grp.append(('dot', np.array([[2 * ax - x, y]]), dict(s, r=r)))
        self.items.append(dict(g=grp, amp=0, raw=None))

    def star(self, x, y, r, pts=8, **kw):
        for i in range(pts):
            a = i / pts * 6.283 - math.pi / 2; rr = r * 0.55 if i % 2 else r
            self.line([(x + math.cos(a) * r * 0.12, y + math.sin(a) * r * 0.12), (x + math.cos(a) * rr, y + math.sin(a) * rr)], amp=0.6, **kw)
        self.dot(x, y, r * 0.09, style=kw.get('style'))

    def spiral(self, cx, cy, r0, turns, d, **kw):
        self.curve(lambda t: (cx + d * r0 * (1 - t / (turns * 6.283)) * math.cos(t), cy + r0 * (1 - t / (turns * 6.283)) * math.sin(t)), 0, turns * 6.283 * 0.92, 80, **kw)

    # ------------------------------------------------------------------
    def render(self, img, progress, to_screen, alpha=1.0, scale=1.0, boil=0, boil_amp=0.45, order=None, fade_items=None):
        """img: BGR float (modified). to_screen: (n,2) ref -> (n,2) screen. scale: screen px per ref px (for widths).
        boil: integer that changes every few frames. order: optional item order. fade_items(i)->extra alpha per item."""
        if alpha <= 0.003 or progress <= 0: return img
        H, W = img.shape[:2]; n = len(self.items); upto = progress * n
        idx = order if order is not None else range(n)
        strokes = []
        for rank, i in enumerate(idx):
            f = min(1.0, max(0.0, upto - rank))
            if f <= 0: continue
            it = self.items[i]; ea = fade_items(i) if fade_items else 1.0
            for kind, pts, s in it['g']:
                P = pts
                if kind == 'line' and boil_amp > 0 and len(P) > 2:
                    r = np.random.default_rng(1000 * i + boil * 7919 + 13)
                    ph = r.uniform(0, 6.28); fr = 0.03 + r.uniform(0, 0.03)
                    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
                    nx = -np.gradient(P[:, 1]); ny = np.gradient(P[:, 0]); L = np.hypot(nx, ny) + 1e-9
                    w = boil_amp * np.sin(seg * fr + ph)
                    P = P + np.stack([nx / L * w, ny / L * w], 1)
                if kind == 'line':
                    m = max(2, int(len(P) * f)); P = P[:m]
                S = to_screen(P)
                strokes.append((kind, S, s, f if kind == 'dot' else 1.0, ea))
        if not strokes: return img
        allp = np.vstack([s[1] for s in strokes])
        pad = int(STYLE['blur'] * scale * 2 + 20)
        X0, Y0 = max(0, int(allp[:, 0].min()) - pad), max(0, int(allp[:, 1].min()) - pad)
        X1, Y1 = min(W, int(allp[:, 0].max()) + pad), min(H, int(allp[:, 1].max()) + pad)
        if X1 <= X0 or Y1 <= Y0: return img
        rw, rh = X1 - X0, Y1 - Y0; SS = 2
        core = np.zeros((rh, rw, 3), np.float32); ca = np.zeros((rh, rw), np.float32)
        glows = {}
        for kind, S, s, f, ea in strokes:
            m = np.zeros((rh * SS, rw * SS), np.float32)
            if kind == 'line':
                q = ((S - [X0, Y0]) * SS * 16).astype(np.int32)
                th = max(1, int(round(s['width'] * scale * SS)))
                cv2.polylines(m, [q.reshape(-1, 1, 2)], False, 1.0, th, cv2.LINE_AA, 4)
                m2 = np.zeros_like(m); q2 = ((S + 0.9 * scale - [X0, Y0]) * SS * 16).astype(np.int32)
                cv2.polylines(m2, [q2.reshape(-1, 1, 2)], False, 1.0, max(1, int(round(s['width'] * 0.45 * scale * SS))), cv2.LINE_AA, 4)
            else:
                c = ((S[0] - [X0, Y0]) * SS * 16).astype(np.int32)
                cv2.circle(m, (int(c[0]), int(c[1])), max(16, int(s['r'] * scale * SS * 16)), 1.0, -1, cv2.LINE_AA, 4); m2 = None
            m = cv2.resize(m, (rw, rh), interpolation=cv2.INTER_AREA)
            a = np.clip(m, 0, 1) * s['alpha'] * alpha * f * ea
            col = np.array(s['color'][::-1], np.float32) / 255
            core = core * (1 - a[..., None]) + col * a[..., None]; ca = ca + a * (1 - ca)
            if m2 is not None:
                a2 = np.clip(cv2.resize(m2, (rw, rh), interpolation=cv2.INTER_AREA), 0, 1) * s['alpha'] * 0.55 * alpha * ea
                core = core * (1 - a2[..., None]) + col * a2[..., None]; ca = ca + a2 * (1 - ca)
            key = (tuple(s['glow']), s['blur'], s.get('gk', 0.85))
            glows.setdefault(key, np.zeros((rh, rw), np.float32))
            glows[key] = np.maximum(glows[key], a)
        reg = img[Y0:Y1, X0:X1]
        for (gc, bl, gk), gm in glows.items():
            g = cv2.GaussianBlur(gm, (0, 0), max(0.6, bl * scale / 2.2)) * gk * 1.6
            gcol = np.array(gc[::-1], np.float32) / 255
            reg[:] = 1 - (1 - reg) * (1 - np.clip(g[..., None] * gcol, 0, 1))
        cs = core / np.maximum(ca[..., None], 1e-5)
        reg[:] = reg * (1 - ca[..., None]) + cs * ca[..., None]
        return img


# ---------------------------------------------------------------- image-derived scenes
def luma(img_bgr, sc=4):
    g = cv2.resize(img_bgr.astype(np.float32), (img_bgr.shape[1] // sc, img_bgr.shape[0] // sc), interpolation=cv2.INTER_AREA)
    if g.max() > 1.5: g = g / 255
    return (0.3 * g[..., 2] + 0.59 * g[..., 1] + 0.11 * g[..., 0]).astype(np.float32)


def clouds(img, y_max=1330, x_range=(0, 1080), seed=7, max_lines=46, style=None, sky_mask=None):
    """contour streamlines following the clouds' own light (isophotes), with small curls (as in patterns.html)"""
    pat = Pattern(seed); rng = pat.rng; sc = 4
    L = luma(img, sc)
    for _ in range(4): L = cv2.blur(L, (5, 5))
    gy, gx = np.gradient(L)
    h, w = L.shape
    occ = np.zeros((1920 // 12 + 1, 1080 // 12 + 1), np.uint8)
    s = style or st(color=(255, 250, 240), glow=(255, 255, 255), gk=0.7, width=2.4, alpha=0.72, blur=8)
    seeds = [(x + rng.uniform(0, 40), y + rng.uniform(0, 40)) for y in range(40, y_max - 40, 70) for x in range(x_range[0] + 30, x_range[1] - 30, 70)]
    rng.shuffle(seeds); made = 0
    def grad(x, y):
        xi = int(min(max(1, x / sc), w - 2)); yi = int(min(max(1, y / sc), h - 2)); return gx[yi, xi], gy[yi, xi]
    def free(x, y): return occ[int(y / 12), int(x / 12)] == 0
    for sx, sy in seeds:
        if made > max_lines or not free(sx, sy): continue
        if sky_mask is not None and not sky_mask(sx, sy): continue
        def trace(d):
            p = []; x, y = sx, sy; pd = None
            for k in range(120):
                ggx, ggy = grad(x, y); m = math.hypot(ggx, ggy)
                if m < 0.0009 / 4: break
                dx, dy = -ggy / m * d, ggx / m * d
                if pd is not None and dx * pd[0] + dy * pd[1] < 0: dx, dy = -dx, -dy
                x += dx * 6; y += dy * 6; pd = (dx, dy)
                if x < x_range[0] + 5 or x > x_range[1] - 5 or y < 5 or y > y_max or (k > 3 and not free(x, y)): break
                if sky_mask is not None and not sky_mask(x, y): break
                p.append((x, y))
            return p
        a = trace(1); b = trace(-1); pts = b[::-1] + [(sx, sy)] + a
        if len(pts) < 22: continue
        for x, y in pts: occ[int(y / 12), int(x / 12)] = 1
        made += 1
        pat.line(pts[::2], amp=1.0, style=s)
        if rng.uniform() < 0.35:
            ex, ey = pts[-1]; pat.spiral(ex, ey + 18, 18, 1.3, 1 if rng.uniform() < 0.5 else -1, style=s)
    return pat


def ridge(img, x0=0, x1=1080, y_lo=160, y_hi=1900, thr=55):
    """trace the snow ridge against the sky: per column, first row (top-down) whose colour departs from the sky above it"""
    sm = cv2.resize(img.astype(np.float32), (270, 480), interpolation=cv2.INTER_AREA)
    if sm.max() > 1.5: sm = sm / 255
    h, w = sm.shape[:2]; ys = []
    for x in range(w):
        yy = h - 1
        for y in range(max(13, y_lo // 4), min(h - 8, y_hi // 4)):
            ref = sm[y - 12, x]; ok = True
            for k in range(8):
                if np.abs(sm[y + k, x] - ref).sum() * 255 < thr: ok = False; break
            if ok: yy = y; break
        ys.append(yy * 4)
    ys = np.array(ys, float)
    from scipy.ndimage import median_filter, uniform_filter1d
    for _ in range(2): ys = median_filter(ys, 13, mode='nearest')
    ys = uniform_filter1d(ys, 7, mode='nearest')
    return np.stack([np.arange(w) * 4 + 2.0, ys], 1)


def spruce(ax, top, bot, star_at=None, star_r=70, tiers=8, garland=True, seed=7):
    """tiered drooping branch lines mirrored on the trunk axis, a star on the tip, twinkle dots (patterns.html 'spruce')"""
    pat = Pattern(seed)
    hw = lambda y: 20 + (y - top) / (bot - top) * 330
    sa = star_at or (ax, top - 40)
    pat.star(sa[0], sa[1], star_r, 8, style=st(color=(255, 226, 160), width=3.6))
    for i in range(tiers):
        y0 = top + 60 + i * (bot - top - 120) / tiers; L = hw(y0) * 0.92
        pts = [(ax + k / 12 * L, y0 + 95 * (k / 12) ** 2 - 30 * (k / 12) ** 5) for k in range(13)]
        pat.line(pts, ax=ax)
        k = 3.0
        while k <= 10:
            t = k / 12; x = ax + t * L; y = y0 + 95 * t * t - 30 * t ** 5
            pat.line([(x, y), (x + 14, y + 22)], ax=ax, amp=0.4, style=st(width=2)); k += 1.5
        pat.dot(ax + L + 8, y0 + 72, 4.5, ax=ax, style=st(color=(255, 217, 138)))
    if garland:
        for g in range(2):
            for i in range(26):
                t = i / 25; y = top + 140 + t * (bot - top - 220); x = ax + math.sin(t * 9.4 + g * math.pi) * hw(y) * 0.78
                pat.dot(x, y, 3.2, style=st(color=(255, 231, 176), blur=18))
    return pat


def ridge_sky(img, y0=300, y1=1800, thr=28.0, ref_band=(150, 420)):
    """skyline: per column, first row below the sky whose colour departs from that column's own sky colour"""
    sm = cv2.resize(img.astype(np.float32), (270, 480), interpolation=cv2.INTER_AREA)
    if sm.max() <= 1.5: sm = sm * 255
    sm = cv2.GaussianBlur(sm, (0, 0), 1.2)
    sky = np.median(sm[ref_band[0] // 4:ref_band[1] // 4], axis=0)            # (270,3)
    d = np.abs(sm - sky[None]).sum(2)
    ys = []
    for x in range(sm.shape[1]):
        col = d[y0 // 4:y1 // 4, x]; idx = np.nonzero(col > thr)[0]
        ys.append((idx[0] + y0 // 4) * 4 if len(idx) else y1)
    ys = np.array(ys, float)
    from scipy.ndimage import median_filter, uniform_filter1d
    ys = median_filter(ys, 9, mode='nearest'); ys = uniform_filter1d(ys, 5, mode='nearest')
    return np.stack([np.arange(len(ys)) * 4 + 2.0, ys], 1)
