"""Kirigami lightbox renderer: layered cut paper, back-lit, light transport between layers.
usage: python3 kirigami.py <outdir> <f0> <f1>
"""
import sys, os, math
import numpy as np
import cv2

W = H = 1080
FPS = 30
rng = np.random.default_rng(7)
C = np.array([W / 2, H / 2])


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def spring(t):
    if t <= 0: return 0.0
    if t >= 1.6: return 1.0
    return 1 - math.exp(-5 * t) * math.cos(6 * t)


def blur(img, s):
    if s <= 0.3: return img
    k = int(s * 3) * 2 + 1
    return cv2.GaussianBlur(img, (k, k), s, borderType=cv2.BORDER_REFLECT)


# ---------------- paper textures (backlit formation 'flocs' + fibres) ----------------
TS = 1400
def paper_tex(seed, strength=1.0):
    r = np.random.default_rng(seed)
    t = np.zeros((TS, TS), np.float32)
    for s, a in [(1.2, 0.10), (4, 0.16), (12, 0.22), (35, 0.18), (90, 0.10)]:
        n = r.standard_normal((TS, TS)).astype(np.float32)
        n = blur(n, s); n /= (n.std() + 1e-6)
        t += a * n
    # fibres: thin bright/dark curved strokes
    f = np.zeros((TS, TS), np.float32)
    for _ in range(2600):
        x, y = r.uniform(0, TS, 2); a = r.uniform(0, 2 * np.pi); L = r.uniform(10, 60)
        bend = r.uniform(-0.03, 0.03)
        pts = []
        for k in range(8):
            aa = a + bend * k * 8
            pts.append([x + math.cos(aa) * L * k / 7, y + math.sin(aa) * L * k / 7])
        cv2.polylines(f, [np.int32(np.array(pts) * 16)], False, float(r.choice([1.0, -0.7])) * r.uniform(0.3, 1.0), 1, cv2.LINE_AA, 4)
    f = blur(f, 0.6)
    t = t + 0.35 * f
    return 1 + strength * 0.13 * t  # around 1


# ---------------- shape helpers ----------------
def circle(cx, cy, r, n=None):
    n = n or max(16, int(r * 1.5))
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.stack([cx + np.cos(a) * r, cy + np.sin(a) * r], 1)


def hand(poly, amp=0.7, seed=0):
    """hand-cut irregularity: resample and jitter slightly along normals"""
    p = np.asarray(poly, np.float64)
    out = []
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        d = np.linalg.norm(b - a); n = max(1, int(d / 6))
        for k in range(n): out.append(a + (b - a) * k / n)
    out = np.array(out)
    r = np.random.default_rng(seed)
    noise = blur(r.standard_normal((len(out), 1)).astype(np.float32), 3)[:, 0] * amp * 2.5
    tang = np.roll(out, -1, 0) - np.roll(out, 1, 0)
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1); nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    return out + nrm * noise[:, None]


def euler_curl(x0, y0, th0, L, kend, w0, w1, sign=-1, c=1.0, p=1.7):
    """paper wave curl: Euler-spiral centreline offset into a tapering band polygon (screen y down)"""
    n = 120; ds = L / n; x, y, th = x0, y0, th0
    kend = kend * (p + 1) / L  # kend given as total turning (rad)
    cl = [[x, y]]; ths = [th]
    for i in range(n):
        s = (i + 0.5) * ds
        th += sign * kend * (s / L) ** p * ds * c
        x += math.cos(th) * ds; y -= math.sin(th) * ds
        cl.append([x, y]); ths.append(th)
    cl = np.array(cl); ths = np.array(ths)
    w = np.linspace(w0, w1, len(cl))
    nx, ny = -np.sin(ths), -np.cos(ths)
    left = cl + np.stack([nx, ny], 1) * w[:, None] / 2
    right = cl - np.stack([nx, ny], 1) * w[:, None] / 2
    return np.concatenate([left, right[::-1]], 0)


FLUKE = np.array([[-0.38, -1.2], [-0.3, 0.6], [-0.42, 1.3], [-0.9, 1.75], [-1.75, 2.35], [-1.55, 2.6], [-0.75, 2.38], [-0.1, 2.15], [0.0, 2.05],
                  [0.1, 2.15], [0.75, 2.38], [1.55, 2.6], [1.75, 2.35], [0.9, 1.75], [0.42, 1.3], [0.3, 0.6], [0.38, -1.2]])


def catmull(ctrl, per=12, closed=True):
    ctrl = np.asarray(ctrl, float); n = len(ctrl); out = []
    segs = n if closed else n - 1
    for i in range(segs):
        p0, p1, p2, p3 = [ctrl[(j) % n] if closed else ctrl[min(max(j, 0), n - 1)] for j in (i - 1, i, i + 1, i + 2)]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


FLUKE_S = catmull(FLUKE, 10)

# ---------------- scene: layers (back -> front) ----------------
HORIZON = 600
MOON = (285, 245)
LH_X, LH_BASE, LH_TOP = 838, 560, 300
LAMP = (LH_X, LH_TOP - 32)

stars = []
while len(stars) < 70:
    x, y = rng.uniform(40, 1040), rng.uniform(40, 500)
    if math.hypot(x - MOON[0], y - MOON[1]) < 130: continue
    stars.append((x, y, rng.uniform(1.8, 3.6) if rng.random() < 0.8 else rng.uniform(3.8, 5.5)))


def sky_layer(t):
    paper = [np.array([[-300, -300], [1380, -300], [1380, 1380], [-300, 1380]], float)]
    holes = [circle(*MOON, 74, 120)]
    # broken halo ring of thin slits around the moon
    for k in range(10):
        a0 = k * 2 * np.pi / 10 + 0.12; a = np.linspace(a0, a0 + 0.42, 14)
        r1, r2 = 100, 104.5
        holes.append(np.concatenate([np.stack([MOON[0] + np.cos(a) * r1, MOON[1] + np.sin(a) * r1], 1), np.stack([MOON[0] + np.cos(a[::-1]) * r2, MOON[1] + np.sin(a[::-1]) * r2], 1)]))
    for (x, y, r) in stars:
        if r > 3.4:  # four-point star cut
            pts = []
            for k in range(8):
                rr_ = r * 2.2 if k % 2 == 0 else r * 0.55
                a = k * np.pi / 4 + 0.2
                pts.append([x + math.cos(a) * rr_, y + math.sin(a) * rr_])
            holes.append(np.array(pts))
        else:
            holes.append(circle(x, y, r, 10))
    return paper, holes


CLOUDS = [(520, 200, 1.0), (150, 420, 0.8), (690, 470, 0.65), (980, 160, 0.7)]


def cloud_poly(cx, cy, s):
    m = np.zeros((1, 1))
    lobes = [(-90, 0, 40), (-45, -22, 50), (10, -38, 58), (65, -18, 46), (105, 2, 34)]
    pts = []
    # build outline as union by sampling circles' upper arcs + flat-ish bottom
    xs = np.linspace(-130, 140, 90)
    for x in xs:
        top = 0
        for (lx, ly, lr) in lobes:
            d = x - lx
            if abs(d) < lr: top = min(top, ly - math.sqrt(lr * lr - d * d))
        pts.append([cx + x * s, cy + (top + 18) * s])
    for x in xs[::-1]:
        pts.append([cx + x * s, cy + (24 + 6 * math.sin(x * 0.05)) * s])
    return np.array(pts)


def clouds_layer(t):
    paper = []
    for i, (x, y, s) in enumerate(CLOUDS):
        paper.append(hand(cloud_poly(x + (8 + 4 * i) * t, y, s), 0.6, 10 + i))
    # distant headland on the left horizon
    xs = np.linspace(-300, 470, 60)
    top = [[x, HORIZON - 30 - 38 * math.exp(-((x - 60) / 160) ** 2) - 10 * math.sin(x * 0.02)] for x in xs]
    paper.append(np.array(top + [[470, HORIZON + 40], [-300, HORIZON + 40]]))
    return paper, []


def cliff_layer(t):
    # cliff body on the right
    ctrl = [[600, 1400], [612, 900], [650, 780], [640, 700], [690, 640], [700, 590], [740, 560], [1000, 548], [1400, 545], [1400, 1400]]
    cliff = catmull(ctrl, 8, closed=True)
    paper = [hand(cliff, 1.0, 3)]
    # grass tufts along the top
    for k in range(26):
        x = 730 + k * 14 + rng.uniform(-3, 3) if False else 730 + k * 14
        h = 10 + 7 * math.sin(k * 1.7)
        paper.append(np.array([[x - 5, 560], [x + 1, 556 - h], [x + 5, 560]]))
    x, yb, yt = LH_X, LH_BASE, LH_TOP
    wb, wt = 46, 32
    tower = np.array([[x - wb, yb + 8], [x - wt, yt], [x + wt, yt], [x + wb, yb + 8]])
    gallery = np.array([[x - 46, yt + 2], [x - 46, yt - 12], [x + 46, yt - 12], [x + 46, yt + 2]])
    room = np.array([[x - 26, yt - 10], [x - 26, yt - 56], [x + 26, yt - 56], [x + 26, yt - 10]])
    roof = np.array([[x - 36, yt - 54], [x, yt - 94], [x + 36, yt - 54]])
    knob = circle(x, yt - 98, 6)
    paper += [tower, gallery, room, roof, knob]
    holes = []
    # lamp window (the light)
    holes.append(np.array([[x - 18, yt - 16], [x - 18, yt - 50], [x + 18, yt - 50], [x + 18, yt - 16]]))
    # stripe slots and arched windows
    for f in (0.3, 0.62):
        yy = yb + (yt - yb) * f; w = wb + (wt - wb) * f - 5
        holes.append(np.array([[x - w, yy - 2.5], [x + w, yy - 2.5 - 1], [x + w, yy + 2.5 - 1], [x - w, yy + 2.5]]))
    for f in (0.15, 0.46, 0.78):
        yy = yb + (yt - yb) * f
        holes.append(np.concatenate([circle(x, yy - 9, 6, 16)[8:], np.array([[x - 6, yy + 6], [x + 6, yy + 6]])[::-1]]))
    holes.append(np.array([[x - 9, yb + 8], [x - 9, yb - 12], [x, yb - 20], [x + 9, yb - 12], [x + 9, yb + 8]]))
    # a cottage window glowing in the cliff side
    holes.append(np.array([[950, 520 + 40], [950, 502 + 40], [962, 502 + 40], [962, 520 + 40]]) + [0, 0])
    # cracks/strata as thin slit holes in the cliff face
    for k in range(5):
        y0 = 640 + k * 75
        xs = np.linspace(700 + k * 6, 1000 - k * 20, 30)
        top = np.stack([xs, y0 + 10 * np.sin(xs * 0.02 + k)], 1)
        holes.append(np.concatenate([top, (top + [0, 2.2])[::-1]]))
    return paper, holes


BOAT = (255, HORIZON + 12)


def far_sea_layer(t):
    xs = np.linspace(-300, 1400, 200)
    edge = [[x, HORIZON + 10 + 4 * math.sin(x * 0.03 + 0.8 * t) + 3 * math.sin(x * 0.071)] for x in xs]
    paper = [np.array(edge + [[1400, 1400], [-300, 1400]])]
    # boat (bobbing cut-out element on this layer)
    bob = 3.5 * math.sin(t * 2.3); rot = 0.045 * math.sin(t * 2.3 + 1.0)
    bx, by = BOAT[0], BOAT[1] + bob
    def xf(pts):
        pts = np.asarray(pts, float); c, s = math.cos(rot), math.sin(rot)
        return np.stack([bx + pts[:, 0] * c - pts[:, 1] * s, by + pts[:, 0] * s + pts[:, 1] * c], 1)
    hull = xf([[-60, -12], [62, -12], [44, 8], [-44, 8]])
    mast = xf([[-2, -12], [-2, -92], [2, -92], [2, -12]])
    sail1 = xf([[6, -18], [6, -86], [52, -18]])
    sail2 = xf([[-6, -22], [-6, -76], [-42, -22]])
    flag = xf([[2, -92], [20, -88], [2, -84]])
    paper += [hull, mast, sail1, sail2, flag]
    holes = [xf(circle(-30, -3, 3.2, 10)), xf(circle(-10, -3, 3.2, 10)), xf(circle(10, -3, 3.2, 10)),
             xf(np.array([[14, -28], [14, -60], [36, -28]]) * [1, 1])]  # cut window inside the main sail
    # moon-glitter: short horizontal slits cut in the far sea under the moon and lamp
    r = np.random.default_rng(3)
    for k in range(26):
        yy = HORIZON + 30 + (k / 26) ** 1.3 * 140
        xc = MOON[0] + r.normal(0, 22 + k * 3) + 15 * math.sin(t * 1.5 + k)
        w = r.uniform(10, 34) * (1 - k / 40)
        holes.append(np.array([[xc - w, yy - 1.4], [xc + w, yy - 1.4], [xc + w, yy + 1.4], [xc - w, yy + 1.4]]))
    # lantern on the boat (tiny hole)
    holes.append(xf(circle(40, -20, 2.6, 10)))
    return paper, holes


def whale_layer(t):
    rise = smooth(0.5, 2.3, t)
    sc = 62
    tilt = 0.25 * (1 - rise) + 0.04 * math.sin(t * 2.2)
    cx, cy = 545, 770 + (1 - rise) * 230 - 18 * math.sin(np.pi * rise) * 0  # base of stalk
    p = FLUKE_S * [sc, -sc]
    c, s = math.cos(tilt), math.sin(tilt)
    pts = np.stack([cx + p[:, 0] * c - p[:, 1] * s, cy + p[:, 0] * s + p[:, 1] * c], 1)
    paper = [hand(pts, 0.5, 21)]
    holes = []
    # water streaming off the flukes: drops on the same layer, falling
    if rise > 0.6:
        for k in range(9):
            ph = (t * 0.9 + k * 0.37) % 1.0
            side = -1 if k % 2 else 1
            x0 = cx + side * (40 + 50 * ((k * 0.61) % 1)) * 1.0
            y0 = cy - 140 + ph * 150 + 10 * math.sin(k)
            r = 3.2 * (1 - ph * 0.5)
            if ph < 0.9: paper.append(circle(x0, y0, r, 10))
    # slit lines on the fluke (kirigami detail)
    for sgn in (-1, 1):
        q = np.array([[sgn * 0.35, 1.75], [sgn * 0.8, 2.1], [sgn * 1.3, 2.35]]) * [sc, -sc]
        q = np.stack([cx + q[:, 0] * c - q[:, 1] * s, cy + q[:, 0] * s + q[:, 1] * c], 1)
        holes.append(np.concatenate([q, (q + [0, 2.4])[::-1]]))
    return paper, holes


def _foam(xs, y0, spread, seed):
    r = np.random.default_rng(seed); out = []
    for x in xs:
        for k in range(r.integers(3, 7)):
            out.append((x + r.normal(0, 28), y0 + abs(r.normal(0, spread)) + 12, r.uniform(1.8, 5.5)))
    return out
FOAM_MID = _foam([120, 330, 520, 760, 960], 800, 22, 5)
FOAM_FRONT = _foam([90, 480, 850], 935, 30, 6)


def wave_sheet(y0, amp, freq, ph, curls, foam, t, drift, seed):
    xs = np.linspace(-300, 1400, 260)
    edge = [[x, y0 + amp * math.sin(x * freq + ph + 1.4 * t) + amp * 0.5 * math.sin(x * freq * 2.3 + ph)] for x in xs]
    paper = [np.array(edge + [[1400, 1500], [-300, 1500]]) + [drift, 0]]
    for (x, L, k, w, c0) in curls:
        cc = min(1.05, c0 + spring(t * 1.2 - 0.1) * (1 - c0))
        yy = y0 + amp * math.sin(x * freq + ph + 1.4 * t) + 10
        paper.append(euler_curl(x + drift, yy, 1.05, L, k, w, 3, -1, cc))
    holes = []
    r = np.random.default_rng(seed)
    for (fx, fy, fr) in foam:
        holes.append(circle(fx + drift, fy, fr, 12))
    return paper, holes


def mid_sea_layer(t):
    curls = [(40, 150, 10.0, 26, 0.35), (250, 130, 10.5, 22, 0.3), (640, 160, 10.0, 26, 0.3), (860, 120, 10.5, 22, 0.3)]
    foam = FOAM_MID
    return wave_sheet(780, 9, 0.018, 0.5, curls, foam, t, -6 * math.sin(t * 1.1), 31)


def front_sea_layer(t):
    curls = [(-40, 230, 10.0, 44, 0.25), (370, 250, 10.5, 46, 0.25), (760, 220, 10.0, 42, 0.25)]
    foam = FOAM_FRONT
    return wave_sheet(905, 13, 0.012, 2.0, curls, foam, t, 8 * math.sin(t * 0.9 + 0.5), 41)


def frame_layer(t):
    m = 58
    outer = np.array([[-400, -400], [1480, -400], [1480, 1480], [-400, 1480]], float)
    # rounded window
    r = 26; pts = []
    for (cx, cy, a0) in [(W - m - r, m + r, -np.pi / 2), (W - m - r, H - m - r, 0), (m + r, H - m - r, np.pi / 2), (m + r, m + r, np.pi)]:
        for a in np.linspace(a0, a0 + np.pi / 2, 8): pts.append([cx + math.cos(a) * r, cy + math.sin(a) * r])
    return [outer], [np.array(pts)]


# depth (distance behind the front frame, arbitrary units), transmission, gap-light gain, dof
LAYERS = [
    dict(name='sky', fn=sky_layer, d=9.0, tau=0.42, gap=0.0, tex=1),
    dict(name='clouds', fn=clouds_layer, d=7.6, tau=0.40, gap=0.03, tex=2),
    dict(name='cliff', fn=cliff_layer, d=6.0, tau=0.34, gap=0.05, tex=3),
    dict(name='farsea', fn=far_sea_layer, d=4.8, tau=0.36, gap=0.10, tex=4),
    dict(name='whale', fn=whale_layer, d=3.7, tau=0.58, gap=0.16, tex=5),
    dict(name='midsea', fn=mid_sea_layer, d=2.7, tau=0.55, gap=0.30, tex=6),
    dict(name='frontsea', fn=front_sea_layer, d=1.4, tau=0.62, gap=0.42, tex=7),
    dict(name='frame', fn=frame_layer, d=0.0, tau=0.0, gap=0.0, tex=8),
]
CAMD = 14.0
FOCUS_D = 4.3

print('building textures...', flush=True)
TEX = {L['tex']: paper_tex(100 + L['tex']) for L in LAYERS}

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def emitter(t, flick):
    """warm back panel: gold at the horizon, rose, then violet-blue high up; light does the colour"""
    v = yy / H
    stops = [(0.0, (0.22, 0.12, 0.45)), (0.22, (0.55, 0.20, 0.52)), (0.40, (1.05, 0.38, 0.32)), (0.53, (1.45, 0.78, 0.30)),
             (0.575, (1.25, 0.70, 0.38)), (0.63, (0.85, 0.62, 0.55)), (0.70, (0.35, 0.62, 0.92)), (1.0, (0.22, 0.38, 0.72))]
    img = np.zeros((H, W, 3), np.float32)
    for c in range(3):
        img[..., c] = np.interp(v, [s[0] for s in stops], [s[1][c] for s in stops])
    # hot spot behind the moon and a broad glow near the horizon
    dm = np.hypot(xx - MOON[0], yy - MOON[1])
    img += np.exp(-(dm / 140) ** 2)[..., None] * np.array([1.4, 1.25, 0.95], np.float32)
    img *= (1.0 - 0.25 * ((xx - W / 2) / W) ** 2)[..., None]
    return img * 2.4 * flick


def gap_light(level, y_mid):
    """light from LED strips between layers: warm on top, cooler/teal across the sea area"""
    v = yy / H
    warm = np.array([1.0, 0.80, 0.55], np.float32)
    cool = np.array([0.30, 0.68, 1.0], np.float32)
    k = smooth(0.56, 0.66, v)[..., None]
    g = warm * (1 - k) + cool * k
    side = 0.75 + 0.25 * np.exp(-((xx - W / 2) / (W * 0.45)) ** 2)
    return g * (side * (0.8 + 0.4 * (1 - v)))[..., None] * level


def layer_xform(d, cam):
    par = CAMD / (CAMD + d) - CAMD / (CAMD + FOCUS_D)  # camera pans to hold the focus plane
    s = 1 + cam['zoom'] * (par + 0.25)
    sh = np.array([cam['x'], cam['y']]) * par * 2.6
    return s, sh


def raster(paper, holes, s, sh):
    m = np.zeros((H, W), np.uint8)
    def tp(p): return np.int32(np.round(((np.asarray(p) - C) * s + C + sh) * 16))
    for p in paper: cv2.fillPoly(m, [tp(p)], 255, cv2.LINE_AA, 4)
    for p in holes: cv2.fillPoly(m, [tp(p)], 0, cv2.LINE_AA, 4)
    return m.astype(np.float32) / 255


def tex_warp(tex, s, sh):
    M = np.array([[s, 0, (1 - s) * C[0] + sh[0] - (TS - W) / 2 * s], [0, s, (1 - s) * C[1] + sh[1] - (TS - H) / 2 * s]], np.float32)
    return cv2.warpAffine(tex, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def render(i):
    t = i / FPS
    u = smooth(0, 3, t) * 0.7 + t / 3 * 0.3
    cam = dict(x=-38 + 76 * u, y=10 - 16 * u, zoom=0.035 * u)
    flick = 1 + 0.035 * math.sin(t * 23) + 0.025 * math.sin(t * 37.1 + 1) + 0.02 * math.sin(t * 5.3)
    tauc = np.array([1.0, 0.92, 0.80], np.float32)  # paper eats a little blue each pass

    light = emitter(t, flick)                 # light travelling forward (diffuse)
    view = light.copy()                       # what the eye sees looking into the box
    for li, L in enumerate(LAYERS):
        s, sh = layer_xform(L['d'], cam)
        paper, holes = L['fn'](t)
        M = raster(paper, holes, s, sh)
        if L['name'] == 'frame':
            # opaque box frame, softly front-lit; casts shadow into the box
            shadow = blur(np.roll(np.roll(M, 10, 0), 8, 1), 16)
            view *= (1 - 0.75 * shadow)[..., None]
            tex = tex_warp(TEX[L['tex']], s, sh)
            fr = np.array([0.07, 0.048, 0.036], np.float32) * tex[..., None]
            # inner bevel catching the light
            edge = blur(M, 2.5) * (1 - M)
            inner = np.clip(M - cv2.erode(M, np.ones((7, 7), np.uint8)), 0, 1)
            fr = fr + inner[..., None] * np.array([0.35, 0.24, 0.15], np.float32) * blur(light, 30) * 0.12
            view = view * (1 - M[..., None]) + fr * M[..., None]
            continue
        # light arriving at the back of this layer: diffused previous light + gap LEDs
        dgap = (LAYERS[li - 1]['d'] - L['d']) if li > 0 else 1.0
        illum = blur(light, 6 + 7 * dgap) + gap_light(L['gap'], 0)
        if L['name'] in ('clouds', 'sky'):
            # lighthouse beam sweeping across the sky layers
            phi = math.pi + math.radians(16 - 24 * smooth(0, 3, t))
            lx, ly = (np.array(LAMP) - C) * s + C + sh
            dx, dy = xx - lx, yy - ly
            a = np.arctan2(dy, dx)
            da = np.angle(np.exp(1j * (a - phi)))
            dist = np.hypot(dx, dy)
            wedge = np.exp(-(da / 0.09) ** 2) * smooth(20, 80, dist) * np.exp(-dist / 900)
            illum = illum + wedge[..., None] * np.array([1.6, 1.25, 0.75], np.float32) * 1.4 * flick
        tex = tex_warp(TEX[L['tex']], s, sh)
        T = L['tau'] * tex[..., None] * tauc
        # paper as seen from the front: transmitted glow + a hint of front light + bright cut edges
        er = cv2.erode(M, np.ones((3, 3), np.uint8))
        rim = blur(np.clip(M - er, 0, 1), 1.0)
        paperview = illum * T * (1 + 0.35 * rim[..., None]) + 0.015
        # this layer's shadow on whatever lies behind it (light comes from the gap above-left)
        so = 4 + 3.0 * dgap
        shadow = blur(np.roll(np.roll(M, int(so * 1.4), 0), int(so * 0.6), 1), 3 + 2.5 * dgap)
        view = view * (1 - 0.68 * shadow)[..., None]
        # depth of field: soften each layer according to its distance from focus
        r = 0.36 * abs(L['d'] - FOCUS_D)
        Mb = blur(M, r); Pb = blur(paperview * M[..., None], r)
        view = view * (1 - Mb[..., None]) + Pb
        # light going further forward through this layer
        light = illum * (M[..., None] * T + (1 - M[..., None]))
        if L['name'] == 'cliff':
            # the lamp itself: a bright source inside the lamp-room window
            lx, ly = (np.array(LAMP) - C) * s + C + sh
            g = np.exp(-((xx - lx) ** 2 + (yy - ly) ** 2) / (2 * 14 ** 2))
            add = g[..., None] * np.array([3.5, 2.6, 1.3], np.float32) * (1 + 0.15 * math.sin(t * 19)) * flick
            view += add * (1 - M[..., None])
            light += add * 0.6

    # bloom
    hi = np.clip(view - 0.9, 0, None)
    view = view + 0.35 * blur(hi, 8) + 0.25 * blur(hi, 30)
    # filmic tonemap
    x = view * 1.0
    a, b, c_, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    out = np.clip((x * (a * x + b)) / (x * (c_ * x + d) + e), 0, 1)
    out = out ** (1 / 2.2)
    lum = out.mean(-1, keepdims=True)
    out = np.clip(lum + (out - lum) * 1.18, 0, 1)
    out = out * out * (3 - 2 * out) * 0.35 + out * 0.65  # gentle S-curve
    # lens vignette + grain
    vig = 1 - 0.28 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2.2
    out = out * vig[..., None]
    out += (np.random.default_rng(i).standard_normal((H, W, 1)).astype(np.float32)) * 0.012
    return np.clip(out * 255, 0, 255).astype(np.uint8)[..., ::-1]


if __name__ == '__main__':
    outdir, f0, f1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    os.makedirs(outdir, exist_ok=True)
    import time
    for i in range(f0, f1 + 1):
        t0 = time.time()
        cv2.imwrite(os.path.join(outdir, f'f_{i:04d}.png'), render(i))
        print('frame', i, round(time.time() - t0, 2), flush=True)
