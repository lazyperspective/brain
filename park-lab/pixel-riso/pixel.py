"""Isometric pixel-art tycoon park, 'build mode' transformation.
Renders at 360x360 internal, nearest-neighbour x3 -> 1080."""
import math, random, sys, os
import numpy as np
from PIL import Image, ImageDraw

W = H = 270
_oe = ImageDraw.ImageDraw.ellipse; _or = ImageDraw.ImageDraw.rectangle
def _fix(xy):
    x0, y0, x1, y1 = [float(v) for v in (xy if len(xy) == 4 else (*xy[0], *xy[1]))]
    return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]
def _safe_e(self, xy, *a, **k):
    b = _fix(xy)
    if b[2] - b[0] < 0.5 or b[3] - b[1] < 0.5: return
    return _oe(self, b, *a, **k)
def _safe_r(self, xy, *a, **k):
    return _or(self, _fix(xy), *a, **k)
ImageDraw.ImageDraw.ellipse = _safe_e; ImageDraw.ImageDraw.rectangle = _safe_r
SCALE = 4
FPS = 30
DUR = 3.0
TW, TH = 6, 3          # half tile width / height in px
BUILD_END = 1.55

# ---------------------------------------------------------------- palette
def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))
C = {k: hx(v) for k, v in dict(
    g0='#2f7d3a', g1='#3f9a43', g2='#56b04a', g3='#78c656', g4='#1f5a34', gout='#3a8a3c', gout2='#2c6f37',
    p0='#e8c690', p1='#d3a86c', p2='#b4844e', pz0='#f4dcb4', pz1='#e7a6a0',
    w0='#2a6fc9', w1='#3f8fe6', w2='#9fd8ff', w3='#1d4f99',
    dirt='#a8784a', dirt2='#8a5d38',
    red='#e43b44', red2='#a22633', white='#f4f4f4', lgray='#c0cbdc', gray='#8b9bb4', dgray='#5a6988',
    ink='#262b44', yel='#feae34', yel2='#f77622', pink='#ff6fa8', pink2='#c23f7d',
    blue='#3a6ee8', blue2='#26419c', teal='#2ce8d0', teal2='#1b9e8f', purple='#9a4fd8', purple2='#5f2f96',
    wood='#9e5b30', wood2='#6b3b22', skin='#f2c39a', skin2='#b9774f', hair='#3b2416',
    leaf0='#1f6b3a', leaf1='#2f8f45', leaf2='#5cbf4e', leaf3='#9be05c', trunk='#6b3b22',
    gold='#ffd541', orange='#ff8a2a', cream='#fff1d6', mint='#8cf2b0',
).items()}

def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

SHIRTS = [C['red'], C['yel'], C['blue'], C['pink'], C['teal'], C['white'], C['purple'], C['orange'],
          C['mint'], C['gold'], hx('#5ad1ff'), hx('#ff4d6d')]
BALLOONS = [C['red'], C['yel'], C['pink'], C['teal'], C['blue'], C['purple'], C['gold']]

CAM = [132.0, 46.0]
LTK = 0.76
def LT(x, y):
    u = (x - y) * LTK + 0.5; v = x + y
    return ((v + u) / 2, (v - u) / 2)
def LTL(pl):
    return [LT(*p) for p in pl]


def P(x, y, z=0.0):
    return (CAM[0] + (x - y) * TW, CAM[1] + (x + y) * TH - z)

def Pi(x, y, z=0.0):
    a, b = P(x, y, z); return (int(round(a)), int(round(b)))

# ---------------------------------------------------------------- easing
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def smooth(t): t = clamp(t); return t * t * (3 - 2 * t)

def pop_scale(tau):
    """squash/stretch bounce after pop at tau=0. returns (hs, vs) or None if not yet."""
    if tau < 0: return None
    if tau > 0.45: return (1.0, 1.0)
    # damped spring overshoot
    k = 1 - math.exp(-tau * 14) * math.cos(tau * 26)
    hs = clamp(k, 0, 1.4)
    vs = clamp(1 - math.exp(-tau * 14) * math.cos(tau * 26 + 0.6), 0, 1.5)
    return (max(0.05, hs), max(0.05, vs))

# ---------------------------------------------------------------- layout
GATE = (34.0, 34.0)  # on the x=y axis, unchanged by LT
B_RING = [(20, 20), (24.5, 20), (29, 15.5), (29, 9), (26, 6), (13, 6.2), (6, 6.2), (3.8, 9), (3.8, 22), (3.6, 23.5)]
C_LEFT = [(20, 20), (20, 25), (15, 31), (10, 31.5)]
E_SIDE = [(27, 27), (30.5, 23.5), (31, 19), (29, 15.5)]
MAIN = [(60, 60), (34, 34), (20, 20)]
B_RING = [(20, 20), (23.5, 20.8), (27.5, 19.5), (27.5, 9.5), (24.5, 8.4), (13, 8.4), (6, 8.4), (4.5, 10), (4.5, 22.5)]
MAIN = [(42, 42), (34, 34), (20, 20)]
E_SIDE = [(27, 27), (30.5, 25.5), (29.5, 21), (27.5, 19.5)]
B_RING, C_LEFT, E_SIDE, MAIN = LTL(B_RING), LTL(C_LEFT), LTL(E_SIDE), LTL(MAIN)
PATHS = [(MAIN, 2.4), (B_RING, 1.5), (C_LEFT, 1.5), (E_SIDE, 1.3)]
PLAZAS = [(LT(20, 20), 2.8), (LT(34.5, 34.5), 2.0)]

def oab(*parts):
    pts = []
    for p in parts: pts += [q for q in p if not pts or q != pts[-1]]
    return pts + pts[::-1][1:]
ROUTES = [
    oab(MAIN, B_RING),
    oab(MAIN, C_LEFT),
    LTL([(42, 42), (34, 34), (27, 27), (30.5, 25.5), (29.5, 21), (27.5, 19.5), (23.5, 20.8), (20, 20), (34, 34), (42, 42)]),
    oab(MAIN, B_RING[:7]),
    oab(MAIN, B_RING[:4]),
]
RIDE = dict(ferris=(20.5, 3.4), drop=(3.0, 7.0), carousel=(24.0, 16.8), swing=(31.6, 13.0),
            pirate=(22.0, 30.5), teacups=(33.2, 22.6), fountain=(20, 20))
RIDE = {k: LT(*v) for k, v in RIDE.items()}

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / max(L2, 1e-9), 0, 1)
    qx, qy = ax + t * dx, ay + t * dy
    return np.hypot(px - qx, py - qy)

# ---------------------------------------------------------------- world raster
RES = 6
WX0, WX1 = -40, 80
gx = np.arange(WX0 * RES, WX1 * RES) / RES
GX, GY = np.meshgrid(gx, gx, indexing='xy')  # GX[j,i]=x, GY=y
pathd = np.full(GX.shape, 99.0)
for pl, w in PATHS:
    for a, b in zip(pl[:-1], pl[1:]):
        pathd = np.minimum(pathd, seg_dist(GX, GY, a, b) - w / 2)
for (c, r) in PLAZAS:
    pathd = np.minimum(pathd, np.hypot(GX - c[0], GY - c[1]) - r)
inpark = (GX > 0.5) & (GX < 36.5) & (GY > 0.5) & (GY < 36.5)
# parking / approach outside gate
outside_plaza = (GX > 36) & (GY > 36) & (np.abs(GX - GY) < 3.2)
# lake bottom-left outside park & pond
lake = ((GX + 6) ** 2 / 90 + (GY - 30) ** 2 / 200) < 1
lake |= ((GX - 6) ** 2 + (GY - 44) ** 2) < 40
parking = (GX > 17.5) & (GX < 31.5) & (GY > 38.0) & (GY < 47.0)
lake |= ((GX - 44) ** 2 / 30 + (GY - 24) ** 2 / 60) < 1
# pads (ride footprints) - circles
PADS = []

def world_to_screen_grid():
    pass

# ---------------------------------------------------------------- coaster track
class Track:
    def __init__(self):
        self.pts = []   # (x,y,z)
        self.loopc = [] # screen-space loop center info or None
        self.lift = []
        self.x, self.y, self.z, self.h = 0, 0, 0, 0
    def start(self, x, y, z, h):
        self.x, self.y, self.z, self.h = x, y, z, h
        self.add(None)
    def add(self, lc, lift=False):
        self.pts.append((self.x, self.y, self.z)); self.loopc.append(lc); self.lift.append(lift)
    def straight(self, L, z1=None, ease=True, lift=False):
        z0 = self.z; z1 = z0 if z1 is None else z1
        n = max(2, int(L / 0.18))
        x0, y0 = self.x, self.y
        for i in range(1, n + 1):
            t = i / n
            self.x = x0 + math.cos(self.h) * L * t
            self.y = y0 + math.sin(self.h) * L * t
            self.z = z0 + (z1 - z0) * (smooth(t) if ease else t)
            self.add(None, lift)
    def turn(self, R, ang, z1=None):
        z0 = self.z; z1 = z0 if z1 is None else z1
        n = max(3, int(abs(ang) * R / 0.18))
        sgn = 1 if ang > 0 else -1
        cx = self.x + math.cos(self.h + sgn * math.pi / 2) * R
        cy = self.y + math.sin(self.h + sgn * math.pi / 2) * R
        a0 = math.atan2(self.y - cy, self.x - cx)
        h0 = self.h
        for i in range(1, n + 1):
            t = i / n
            a = a0 + ang * t
            self.x = cx + math.cos(a) * R; self.y = cy + math.sin(a) * R
            self.z = z0 + (z1 - z0) * smooth(t)
            self.h = h0 + ang * t
            self.add(None)
    def loop(self, Rz, Ru, shift):
        n = 90
        bx, by, bz = self.x, self.y, self.z
        dx, dy = math.cos(self.h), math.sin(self.h)
        lx, ly = -dy, dx
        for i in range(1, n + 1):
            th = 2 * math.pi * i / n
            f = (th - math.sin(th)) / (2 * math.pi)
            self.x = bx + dx * Ru * math.sin(th) + lx * shift * f
            self.y = by + dy * Ru * math.sin(th) + ly * shift * f
            self.z = bz + Rz * (1 - math.cos(th))
            cxw = bx + lx * shift * f; cyw = by + ly * shift * f
            self.add((cxw, cyw, bz + Rz))
    def close(self):
        # cubic hermite back to start
        x0, y0, z0 = self.pts[0]
        p0 = np.array([self.x, self.y, self.z]); p1 = np.array([x0, y0, z0])
        d = np.linalg.norm(p0[:2] - p1[:2])
        t0 = np.array([math.cos(self.h), math.sin(self.h), 0]) * d * 1.2
        t1 = np.array([math.cos(self.h0), math.sin(self.h0), 0]) * d * 1.2
        n = int(d / 0.16)
        for i in range(1, n):
            s = i / n
            h00 = 2*s**3 - 3*s**2 + 1; h10 = s**3 - 2*s**2 + s; h01 = -2*s**3 + 3*s**2; h11 = s**3 - s**2
            p = h00*p0 + h10*t0 + h01*p1 + h11*t1
            self.x, self.y, self.z = p
            self.add(None)

def build_track():
    T = Track()
    T.h0 = 0.0
    T.start(18.0, 12.6, 5, T.h0)
    T.straight(3.5, 5)                       # station
    T.turn(1.15, -math.pi, 7)                # u-turn, heading -x
    T.straight(8.6, 80, ease=False, lift=True)
    T.straight(0.8, 82)
    T.turn(2.0, -math.pi / 2, 80)            # crest -> heading +y
    T.straight(7.6, 6)                       # first drop
    T.straight(1.2, 6)
    T.loop(42, 4.4, 2.5)                     # vertical loop
    T.straight(1.0, 8)
    T.turn(3.2, -math.pi / 2, 30)            # heading +x
    T.straight(1.5, 30)
    T.turn(2.8, -math.pi / 2, 16)            # heading -y
    T.straight(4.0, 36)                      # camelback
    T.straight(3.6, 12)
    T.close()
    pts = np.array(T.pts, dtype=float)
    pts[:, 0], pts[:, 1] = LT(pts[:, 0], pts[:, 1])
    T.loopc = [None if c is None else (*LT(c[0], c[1]), c[2]) for c in T.loopc]
    seg = np.linalg.norm(np.diff(pts[:, :2], axis=0), axis=1) + np.abs(np.diff(pts[:, 2])) / 6.7
    s = np.concatenate([[0], np.cumsum(seg)])
    return pts, T.loopc, np.array(T.lift), s

TRK, TRK_LOOPC, TRK_LIFT, TRK_S = build_track()
TRK_L = TRK_S[-1]

def trk_at(s):
    s = s % TRK_L
    i = int(np.searchsorted(TRK_S, s) - 1); i = max(0, min(i, len(TRK) - 2))
    f = (s - TRK_S[i]) / max(TRK_S[i + 1] - TRK_S[i], 1e-9)
    p = TRK[i] * (1 - f) + TRK[i + 1] * f
    return p, i

# coaster motion: integrate speed
ZMAX = TRK[:, 2].max()
def phys_v(s):
    p, i = trk_at(s)
    if TRK_LIFT[i]: return 7.0
    if i < 30: return 9.0
    return max(7.0, math.sqrt(2 * 9.0 * max(0, ZMAX + 6 - p[2])) * 0.55)

BUILD_T0 = 0.08
BUILD_SPEED = TRK_L / (BUILD_END - BUILD_T0)
def build_head(t):
    return clamp((t - BUILD_T0) * BUILD_SPEED, 0, TRK_L + 1)

def precompute_train(n_frames, sub=8):
    """train head position per frame for two trains."""
    out = []
    s = -2.0; dt = 1.0 / FPS / sub
    for f in range(n_frames):
        out.append(s)
        for k in range(sub):
            t = (f * sub + k) * dt
            bh = build_head(t)
            if t < BUILD_END:
                s = max(s, bh - 1.6)   # chase right behind the head
            else:
                s += phys_v(s) * dt
    return out

# ---------------------------------------------------------------- drawing helpers
class Canvas:
    def __init__(self, img):
        self.img = img; self.d = ImageDraw.Draw(img)
        self.ops = []
    def add(self, depth, fn):
        self.ops.append((depth, len(self.ops), fn))
    def flush(self):
        for _, _, fn in sorted(self.ops, key=lambda o: (o[0], o[1])):
            fn(self.d)
        self.ops = []

def dither_px(d, x, y, c1, c2):
    d.point((x, y), fill=c1 if (x + y) % 2 == 0 else c2)

def ell(d, cx, cy, rx, ry, fill, outline=None):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill, outline=outline)

# tree sprites
def make_tree(r, seed, conifer=False):
    rng = random.Random(seed)
    w = 2 * r + 3; h = 2 * r + 7 + (r if conifer else 0)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    a = np.zeros((h, w, 4), np.uint8)
    cx = w // 2
    # trunk
    for yy in range(h - 4, h):
        a[yy, cx] = (*C['trunk'], 255); a[yy, cx - 1] = (*C['wood2'], 255)
    if conifer:
        top = 1
        for yy in range(top, h - 3):
            hw = int((yy - top) / (h - 3 - top) * (r + 0.5)) + (1 if yy > top else 0)
            for xx in range(cx - hw, cx + hw + 1):
                lx = (xx - cx) / max(hw, 1)
                band = (yy - top) % 4 == 3
                if lx < -0.3: col = C['leaf2']
                elif lx > 0.4 or band: col = C['leaf0']
                else: col = C['leaf1'] if (xx + yy) % 2 else C['leaf2'] if lx < 0 else C['leaf1']
                a[yy, xx] = (*col, 255)
    else:
        cy = r + 1
        for yy in range(h):
            for xx in range(w):
                dx, dy = xx - cx, yy - cy
                bump = 0.6 * math.sin(math.atan2(dy, dx) * 5 + seed)
                if dx * dx + dy * dy <= (r + bump) ** 2:
                    l = (-dx - dy * 1.2) / (r + 0.01)
                    if l > 1.0: col = C['leaf3'] if (xx + yy) % 2 == 0 else C['leaf2']
                    elif l > 0.35: col = C['leaf2']
                    elif l > -0.2: col = C['leaf2'] if (xx + yy) % 2 == 0 else C['leaf1']
                    elif l > -0.8: col = C['leaf1']
                    else: col = C['leaf1'] if (xx + yy) % 2 == 0 else C['leaf0']
                    a[yy, xx] = (*col, 255)
        # dark outline bottom edge
        for xx in range(w):
            col = a[:, xx, 3].nonzero()[0]
            col = [c for c in col if c < h - 4]
            if col:
                b = max(col)
                a[b, xx, :3] = C['leaf0']
    return Image.fromarray(a, 'RGBA')

TREE_SPR = [make_tree(r, s, c) for r, s, c in
            [(4, 1, False), (5, 2, False), (3, 3, False), (6, 4, False), (3, 5, True), (4, 6, True), (5, 7, False)]]

# ---------------------------------------------------------------- scene objects
random.seed(7)
TREES = []
def tree_ok(x, y):
    x, y = LT(x, y) if False else (x, y)
    i = int((x - WX0) * RES); j = int((y - WX0) * RES)
    if 0 <= i < pathd.shape[1] and 0 <= j < pathd.shape[0]:
        if pathd[j, i] < 0.6 or lake[j, i]: return False
    for (cx, cy, r) in KEEP_OUT:
        if (x - cx) ** 2 + (y - cy) ** 2 < (r + 1.1) ** 2: return False
    return True

KEEP_OUT = [(RIDE['ferris'][0], RIDE['ferris'][1], 3.6), (RIDE['drop'][0], RIDE['drop'][1], 1.8),
            (RIDE['carousel'][0], RIDE['carousel'][1], 3.0), (RIDE['swing'][0], RIDE['swing'][1], 3.4),
            (RIDE['pirate'][0], RIDE['pirate'][1], 3.2), (RIDE['teacups'][0], RIDE['teacups'][1], 2.6),
            *[(*LT(a, b), r) for a, b, r in [(12.5, 34.0, 2.2), (15.0, 35.6, 1.8), (2.5, 31.0, 1.8), (19.5, 11.5, 2.5)]]]

def add_tree_rect(n, x0, x1, y0, y1, inpark_only=None):
    k = 0; tries = 0
    while k < n and tries < n * 30:
        tries += 1
        x = random.uniform(x0, x1); y = random.uniform(y0, y1)
        if inpark_only is True and not (1 < x < 36 and 1 < y < 36): continue
        if inpark_only is False and (0 < x < 37 and 0 < y < 37): continue
        if 17 < x < 32 and 37.5 < y < 47.5: continue
        if not tree_ok(x, y): continue
        if any((x - a) ** 2 + (y - b) ** 2 < 1.4 for a, b, _ in TREES): continue
        TREES.append((x, y, random.randrange(len(TREE_SPR)))); k += 1

# coaster footprint keep-out sampled
for p in TRK[::6]:
    KEEP_OUT.append((p[0], p[1], 1.1))
# flume keep-out added later

# ---------------------------------------------------------------- flume
def build_flume():
    T = Track()
    T.h0 = math.pi / 2
    T.start(5.0, 25.6, 2, T.h0)
    T.straight(2.0, 2)
    T.straight(4.0, 26, ease=True, lift=True)
    T.straight(1.4, 26)
    T.turn(1.4, -math.pi, 24)
    T.straight(3.6, 2, ease=True)
    T.straight(4.3, 2)
    T.turn(1.4, -math.pi, 2)
    T.close()
    pts = np.array(T.pts, float)
    pts[:, 0], pts[:, 1] = LT(pts[:, 0], pts[:, 1])
    seg = np.linalg.norm(np.diff(pts[:, :2], axis=0), axis=1) + np.abs(np.diff(pts[:, 2])) / 6.7
    s = np.concatenate([[0], np.cumsum(seg)])
    return pts, s

FL, FL_S = build_flume()
FL_L = FL_S[-1]
for p in FL[::4]:
    KEEP_OUT.append((p[0], p[1], 1.0))

def fl_at(s):
    s = s % FL_L
    i = int(np.searchsorted(FL_S, s) - 1); i = max(0, min(i, len(FL) - 2))
    f = (s - FL_S[i]) / max(FL_S[i + 1] - FL_S[i], 1e-9)
    return FL[i] * (1 - f) + FL[i + 1] * f, i

add_tree_rect(70, 1, 36, 1, 36, True)
add_tree_rect(260, -30, 70, -30, 70, False)

STALLS = [(23.0, 27.6, 'red'), (27.6, 23.0, 'blue'), (28.6, 31.9, 'yel'), (31.9, 28.6, 'pink'),
          (16.6, 22.8, 'teal'), (22.6, 22.9, 'purple'), (12.0, 6.9, 'orange'), (16.5, 5.6, 'red'),
          (29.4, 8.0, 'teal'), (2.6, 15.0, 'yel')]
STALLS = [(*LT(x, y), c) for x, y, c in STALLS]
TENTS = [(12.5, 34.0, 'red', 2.0), (15.0, 35.6, 'blue', 1.4), (6.0, 33.6, 'purple', 1.6)]
TENTS = [(*LT(x, y), c, r) for x, y, c, r in TENTS]

# pop schedule (seconds)
POP = dict(ferris=0.30, drop=0.42, carousel=0.55, swing=0.68, pirate=0.80, teacups=0.92, flume=0.62,
           tents=1.05, stalls=0.75, gate=0.12, fountain=0.2)

# ---------------------------------------------------------------- guests
random.seed(11)
CARS = []
for i in range(18, 31):
    for j in (38.5, 40.5, 44.5, 46.5):
        if random.random() < 0.72:
            CARS.append((i + 0.5, j, random.choice([C['red'], C['blue'], C['yel'], C['white'], C['teal'], C['purple'], C['orange'], C['lgray']])))
SWANS = [(44 + 3 * math.cos(a), 24 + 5 * math.sin(a), a) for a in (0.3, 2.0, 3.6, 5.0)]
def route_build(r):
    pts = np.array(r, float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    return pts, np.concatenate([[0], np.cumsum(seg)])
RT = [route_build(r) for r in ROUTES]

GUESTS = []
for k in range(450):
    ri = random.randrange(len(RT))
    L = RT[ri][1][-1]
    GUESTS.append(dict(
        r=ri, off=random.uniform(0, L * 0.95), v=random.uniform(1.0, 1.7),
        lat=random.gauss(0, 0.42), shirt=random.choice(SHIRTS),
        pants=random.choice([C['blue2'], C['ink'], C['wood2'], C['dgray'], C['purple2']]),
        skin=random.choice([C['skin'], C['skin'], C['skin2']]),
        hair=random.choice([C['hair'], C['hair'], C['yel'], C['ink'], C['wood']]),
        balloon=random.choice(BALLOONS) if random.random() < 0.09 else None,
        phase=random.uniform(0, 6.28), kid=random.random() < 0.25,
        rev=random.random() < 0.5))

# idle guests standing at stalls / queues
IDLE = []
for (x, y, c) in STALLS:
    for k in range(4):
        IDLE.append((x + random.uniform(0.6, 1.6), y + random.uniform(0.6, 1.6), random.choice(SHIRTS),
                     random.uniform(0, 6)))

def warp(t):
    """warped time: fast-forward during build, easing to real time."""
    # integral of w'(t) = 1 + 30*(1-smooth((t-0.9)/0.8))
    n = 200; acc = 0.0; dt = t / n if t > 0 else 0
    for k in range(n):
        tt = (k + 0.5) * dt
        acc += (1 + 55 * (1 - smooth((tt - 1.0) / 0.75))) * dt
    return acc

for g in GUESTS:
    g['te'] = random.uniform(0.12, 1.45)
    g['wte'] = None

def guest_d(t, wt, g):
    if g['wte'] is None: g['wte'] = warp(g['te'])
    if t < g['te']:
        # waiting in the entrance crowd, shuffling forward
        return -(g['te'] - t) * 9.0 - 0.3
    return (wt - g['wte']) * g['v'] * 1.1

def _queue(d, pts, dv):
    # crowd bunched just outside the gate: map d<0 to positions on approach path before the gate
    gate_d = np.linalg.norm(np.array(GATE) - pts[0]) - 1.2
    return pts[0] + dv * max(0.0, gate_d + d * 0.35)

def route_pos(ri, d):
    pts, s = RT[ri]
    L = s[-1]
    if d < 0:
        dv = pts[1] - pts[0]; n = np.linalg.norm(dv); dv = dv / n
        return _queue(d, pts, dv), dv
    d = d % L
    i = int(np.searchsorted(s, d) - 1); i = max(0, min(i, len(pts) - 2))
    f = (d - s[i]) / max(s[i + 1] - s[i], 1e-9)
    p = pts[i] * (1 - f) + pts[i + 1] * f
    dvec = pts[i + 1] - pts[i]; n = np.linalg.norm(dvec)
    return p, dvec / max(n, 1e-9)

# released balloons
BAL_FLY = [(random.uniform(-5, 40), random.uniform(-5, 40), random.uniform(-1.5, 3.0), random.choice(BALLOONS),
            random.uniform(0.6, 1.0)) for _ in range(14)]

# ================================================================ rendering
def hash2(a, b, c=0):
    h = (a * 374761393 + b * 668265263 + c * 2147483647) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return h ^ (h >> 16)

_sx, _sy = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
_noise = np.random.RandomState(3).rand(W * 2, H * 2)

def render_ground(t, f):
    u = (_sx - CAM[0]) / TW; v = (_sy - CAM[1]) / TH
    x = (u + v) / 2; y = (v - u) / 2
    ix = np.clip(((x - WX0) * RES).astype(int), 0, pathd.shape[1] - 1)
    iy = np.clip(((y - WX0) * RES).astype(int), 0, pathd.shape[0] - 1)
    pd = pathd[iy, ix]; ip = inpark[iy, ix]; lk = lake[iy, ix]
    img = np.zeros((H, W, 3), np.uint8)
    chk = ((np.arange(W)[None, :] + np.arange(H)[:, None]) % 2 == 0)
    sxi = (_sx - CAM[0]).astype(int) % (2 * W); syi = (_sy - CAM[1]).astype(int) % (2 * H)
    nz = _noise[sxi, syi]
    # outside grass
    img[:] = C['gout']
    img[(nz < 0.18) & chk] = C['gout2']
    img[(nz > 0.93)] = C['g2']
    # park grass with mowing stripes (per tile along x+y diagonal bands)
    band = (np.floor(x) + np.floor(y)).astype(int) % 2 == 0
    gp = np.where(band[..., None], np.array(C['g2'], np.uint8), np.array(C['g1'], np.uint8))
    img = np.where(ip[..., None], gp, img)
    m = ip & (nz > 0.9) & chk
    img[m] = C['g3']
    # fence hedge border
    edge = ip & ((x < 1.0) | (y < 1.0) | (x > 36.0) | (y > 36.0))
    img[edge] = C['g4']
    img[edge & chk] = C['leaf1']
    # paths
    fx = x - np.floor(x); fy = y - np.floor(y)
    onp = pd < 0
    pc = np.empty_like(img); pc[:] = C['p0']
    grid = (fx < 0.1) | (fy < 0.1)
    pc[grid] = C['p1']
    pc[(pd > -0.22)] = C['p2']
    img = np.where(onp[..., None], pc, img)
    # plazas checker
    for (c, r) in PLAZAS:
        d = np.hypot(x - c[0], y - c[1])
        m = d < r - 0.25
        chq = ((np.floor(x * 1.0) + np.floor(y * 1.0)) % 2 == 0)
        img[m & chq] = C['pz0']; img[m & ~chq] = C['pz1']
        ring = (d < r) & (d >= r - 0.25)
        img[ring] = C['p2']
    # parking lot
    pk = parking[iy, ix]
    pkc = np.empty_like(img); pkc[:] = hx('#5d6680')
    pkc[(np.abs(fy - 0.5) < 0.06) & (((x * 1.0) % 2.0) < 1.2)] = C['white']
    pkc[(fx < 0.08)] = hx('#6f7894')
    pkc[(nz > 0.92) & chk] = hx('#525a72')
    img = np.where(pk[..., None], pkc, img)
    # lake
    shore = lake[np.clip(iy + 3, 0, pathd.shape[0] - 1), np.clip(ix + 3, 0, pathd.shape[1] - 1)]
    wc = np.empty_like(img); wc[:] = C['w0']
    wave = np.sin(x * 2.3 + y * 1.1 + t * 3.0) + np.sin(y * 3.1 - t * 2.2)
    wc[(wave > 1.2) & chk] = C['w1']
    wc[(nz > 0.985) & ((f // 3 + (nz * 1000).astype(int)) % 4 == 0)] = C['w2']
    img = np.where(lk[..., None], wc, img)
    img[lk & ~shore] = C['p0']
    return img

def draw_pad(cv, x, y, r, col, col2, depth=-1e9):
    cx, cy = P(x, y)
    rx, ry = r * TW * 1.414, r * TH * 1.414
    def fn(d):
        ell(d, cx, cy + 1, rx, ry, fill=col2)
        ell(d, cx, cy, rx, ry, fill=col)
    cv.add(depth, fn)

def dust(cv, x, y, tau, r=2.0):
    """expanding dust puff after a pop"""
    if tau < 0 or tau > 0.5: return
    cx, cy = P(x, y)
    rng = random.Random(int(x * 100 + y))
    def fn(d):
        k = tau / 0.5
        for i in range(14):
            a = i / 14 * 6.283 + rng.uniform(-0.2, 0.2)
            rr = (r * 8 + 6) * (0.4 + k * 0.9) * rng.uniform(0.7, 1.1)
            px = cx + math.cos(a) * rr; py = cy + math.sin(a) * rr * 0.5 - k * 6
            s = max(0, int(3 * (1 - k)) + (1 if i % 2 else 0))
            col = C['cream'] if i % 3 else C['lgray']
            if s > 0: ell(d, px, py, s, s * 0.8, fill=col)
    cv.add(x + y + 3, fn)

# ---------------------------------------------------------------- rides
def ride_ferris(cv, t, hs, vs):
    x, y = RIDE['ferris']
    R = 38 * hs; zc = 46 * vs
    cx, cy = P(x, y, zc)
    gx_, gy_ = P(x, y)
    ang = t * 0.45
    n = 14
    dep = x + y
    def back(d):
        # back A-frame
        for sgn in (-1, 1):
            d.line([gx_ + sgn * 20 * hs - 3, gy_ - 3, cx - 3, cy - 2], fill=C['dgray'], width=2)
    def wheel(d):
        rims = []
        for i in range(n):
            a = ang + i / n * 6.2832
            rims.append((cx + math.cos(a) * R, cy + math.sin(a) * R))
        # spokes
        for i, (px, py) in enumerate(rims):
            d.line([cx, cy, px, py], fill=C['lgray'] if i % 2 else C['white'])
        # rim (double)
        d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=C['white'])
        d.ellipse([cx - R + 2, cy - R + 2, cx + R - 2, cy + R - 2], outline=C['red'])
        d.ellipse([cx - R * 0.45, cy - R * 0.45, cx + R * 0.45, cy + R * 0.45], outline=C['red2'])
        # chasing lights
        for i in range(28):
            a = ang + i / 28 * 6.2832
            on = (i + int(t * 12)) % 4 == 0
            d.point((cx + math.cos(a) * R, cy + math.sin(a) * R), fill=C['gold'] if on else C['white'])
        # hub
        ell(d, cx, cy, 3, 3, fill=C['gold'], outline=C['wood2'])
    def front(d):
        for sgn in (-1, 1):
            d.line([gx_ + sgn * 22 * hs, gy_, cx, cy], fill=C['gray'], width=2)
            d.line([gx_ + sgn * 22 * hs + 1, gy_, cx + 1, cy], fill=C['lgray'])
        d.line([gx_ - 14 * hs, gy_ - zc * 0.35, gx_ + 14 * hs, gy_ - zc * 0.35], fill=C['gray'])
        # gondolas
        cols = [C['yel'], C['teal'], C['pink'], C['blue'], C['orange'], C['purple'], C['mint']]
        for i in range(n):
            a = ang + i / n * 6.2832
            px = cx + math.cos(a) * R; py = cy + math.sin(a) * R
            sw = math.sin(t * 2 + i) * 0.8
            gx2 = int(round(px + sw)); gy2 = int(round(py))
            c = cols[i % len(cols)]
            d.line([px, py, gx2, gy2 + 2], fill=C['dgray'])
            d.rectangle([gx2 - 3, gy2 + 2, gx2 + 3, gy2 + 3], fill=mix(c, C['white'], 0.35))
            d.rectangle([gx2 - 3, gy2 + 4, gx2 + 3, gy2 + 7], fill=c)
            d.line([gx2 - 3, gy2 + 7, gx2 + 3, gy2 + 7], fill=mix(c, C['ink'], 0.45))
            d.point((gx2 - 1, gy2 + 4), fill=C['skin']); d.point((gx2 + 1, gy2 + 4), fill=C['hair'])
        # ticket box
        d.rectangle([gx_ - 4, gy_ - 6, gx_ + 4, gy_], fill=C['white'], outline=C['red2'])
        d.rectangle([gx_ - 5, gy_ - 8, gx_ + 5, gy_ - 6], fill=C['red'])
    cv.add(dep - 1.0, back)
    cv.add(dep - 0.5, wheel)
    cv.add(dep + 0.2, front)

def ride_drop(cv, t, hs, vs):
    x, y = RIDE['drop']
    Ht = 68 * vs
    bx, by = Pi(x, y)
    # gondola height cycle (period 3.0s): rise slow, hold, drop
    ph = (t * 1.0 + 0.55) % 3.0
    if ph < 1.5: z = 14 + (Ht - 30) * smooth(ph / 1.5)
    elif ph < 2.0: z = Ht - 16
    elif ph < 2.35: z = Ht - 16 - (Ht - 30) * ((ph - 2.0) / 0.35) ** 2
    else: z = 14 + 4 * abs(math.sin((ph - 2.35) * 14)) * math.exp(-(ph - 2.35) * 6)
    z *= 1
    def fn(d):
        # base
        ell(d, bx, by, 9 * hs, 4.5 * hs, fill=C['dgray'])
        ell(d, bx, by - 1, 9 * hs, 4.5 * hs, fill=C['lgray'])
        # tower with stripes and dithered shading
        top = int(by - Ht)
        for yy in range(top, by):
            band = ((yy - top) // 6) % 2 == 0
            c1 = C['white'] if band else C['purple']
            c2 = C['lgray'] if band else C['purple2']
            for xx in range(int(bx - 2 * hs), int(bx + 3 * hs)):
                c = c1 if xx < bx + 1 else (c2 if (xx + yy) % 2 else c1)
                if xx >= bx + 2: c = c2
                d.point((xx, yy), fill=c)
        # top cap
        d.polygon([(bx - 5, top), (bx + 6, top), (bx + 1, top - 7)], fill=C['red'])
        d.line([(bx + 1, top - 7), (bx + 1, top - 12)], fill=C['dgray'])
        fl = int(2 * math.sin(t * 9))
        d.polygon([(bx + 2, top - 12), (bx + 8, top - 11 + fl), (bx + 2, top - 9)], fill=C['yel'])
        d.point((bx + 1, top - 2), fill=C['gold'] if int(t * 4) % 2 else C['white'])
        # ring car
        cyy = int(by - z)
        d.rectangle([bx - 8, cyy - 2, bx + 9, cyy + 2], fill=C['gold'])
        d.line([bx - 8, cyy + 2, bx + 9, cyy + 2], fill=C['yel2'])
        for k in range(-7, 9, 2):
            d.point((bx + k, cyy - 3), fill=C['skin'] if k % 4 else C['hair'])
            # dangling legs
            d.point((bx + k, cyy + 3), fill=C['blue2'])
            if ph >= 2.0 and ph < 2.4:
                d.point((bx + k, cyy - 5), fill=C['yel'])  # hands up
    cv.add(x + y, fn)

def ride_carousel(cv, t, hs, vs):
    x, y = RIDE['carousel']
    R = 2.4 * hs
    rx, ry = R * TW * 1.414, R * TH * 1.414
    bx, by = P(x, y)
    rot = t * 1.3
    zroof = 22 * vs
    def horses(d, front):
        n = 10
        for i in range(n):
            a = rot + i / n * 6.283
            s = math.sin(a)
            if (s > 0) != front: continue
            px = bx + math.cos(a) * rx * 0.78; py = by + s * ry * 0.78 - 3
            bob = int(round(2 * math.sin(t * 5 + i * 1.7)))
            d.line([px, py - zroof + 3, px, py], fill=C['gold'])
            hc = [C['white'], C['cream'], C['yel'], C['pink']][i % 4]
            hy = py - 6 + bob
            d.rectangle([px - 2, hy, px + 2, hy + 2], fill=hc)
            d.point((px + 3 * (1 if math.cos(a) < 0 else -1), hy - 1), fill=hc)
            d.point((px, hy - 1), fill=SHIRTS[i % len(SHIRTS)])
            d.point((px, hy - 2), fill=C['skin'])
    def base(d):
        # platform
        ell(d, bx, by + 2, rx + 2, ry + 1, fill=C['wood2'])
        ell(d, bx, by, rx + 2, ry + 1, fill=C['red2'])
        ell(d, bx, by - 1, rx, ry, fill=C['cream'])
        horses(d, False)
        # central column
        d.rectangle([bx - 2, by - zroof, bx + 2, by - 2], fill=C['gold'])
        d.line([bx + 1, by - zroof, bx + 1, by - 2], fill=C['yel2'])
    def front(d):
        horses(d, True)
        # roof: striped cone with scalloped valance
        ry2 = ry + 2; rx2 = rx + 3
        top = (bx, by - zroof - 13 * vs)
        n = 16
        segs = []
        for i in range(n):
            a0 = rot * 0.999 + i / n * 6.283; a1 = a0 + 6.283 / n
            p0 = (bx + math.cos(a0) * rx2, by - zroof + math.sin(a0) * ry2)
            p1 = (bx + math.cos(a1) * rx2, by - zroof + math.sin(a1) * ry2)
            segs.append((math.sin((a0 + a1) / 2), i, p0, p1))
        for s, i, p0, p1 in sorted(segs):
            c = C['red'] if i % 2 == 0 else C['white']
            if s < -0.2: c = mix(c, C['ink'], 0.15)
            d.polygon([top, p0, p1], fill=c)
        # valance
        for i in range(24):
            a = i / 24 * 6.283
            if math.sin(a) < -0.1: continue
            px = bx + math.cos(a) * rx2; py = by - zroof + math.sin(a) * ry2
            d.rectangle([px - 1, py, px + 1, py + 2], fill=C['gold'] if i % 2 else C['red2'])
        d.line([top[0], top[1], top[0], top[1] - 6], fill=C['dgray'])
        fl = int(round(2 * math.sin(t * 8)))
        d.polygon([(top[0], top[1] - 6), (top[0] + 6, top[1] - 5 + fl), (top[0], top[1] - 3)], fill=C['teal'])
    cv.add(x + y - 1.0, base)
    cv.add(x + y + 1.0, front)

def ride_swing(cv, t, hs, vs):
    x, y = RIDE['swing']
    bx, by = P(x, y)
    rot = t * 2.2
    ztop = 46 * vs
    spread = 0.75 + 0.25 * min(1, t / 0.5 + 0.5)
    rx = 3.1 * TW * 1.414 * hs * spread; ry = 3.1 * TH * 1.414 * hs * spread
    tilt = 0.18
    def seat_list(front):
        n = 14; out = []
        for i in range(n):
            a = rot + i / n * 6.283
            s = math.sin(a)
            if (s > 0) != front: continue
            sx = bx + math.cos(a) * rx; sy = by + s * ry - 22 * vs + math.cos(a) * 6 * tilt * 10 / 3
            tx = bx + math.cos(a) * rx * 0.42; ty = by + s * ry * 0.42 - ztop + 4 + math.cos(a) * 2
            out.append((i, sx, sy, tx, ty))
        return out
    def chains(d, front):
        for i, sx, sy, tx, ty in seat_list(front):
            d.line([tx, ty, sx, sy], fill=C['lgray'])
            d.rectangle([sx - 1, sy, sx + 1, sy + 1], fill=SHIRTS[i % len(SHIRTS)])
            d.point((sx, sy - 1), fill=C['skin'])
            d.point((sx, sy + 2), fill=C['blue2'])
    def back(d):
        ell(d, bx, by + 1, 6 * hs, 3 * hs, fill=C['dgray'])
        ell(d, bx, by, 6 * hs, 3 * hs, fill=C['lgray'])
        chains(d, False)
        d.rectangle([bx - 1, by - ztop, bx + 2, by - 1], fill=C['teal2'])
        d.line([bx, by - ztop, bx, by - 1], fill=C['teal'])
    def front(d):
        chains(d, True)
        # canopy: tilted disc with scallops
        crx, cry = rx * 0.48, ry * 0.48
        cy = by - ztop
        ell(d, bx, cy + 2, crx, cry, fill=C['teal2'])
        n = 12
        for i in range(n):
            a0 = rot + i / n * 6.283; a1 = a0 + 6.283 / n
            c = C['teal'] if i % 2 else C['white']
            d.polygon([(bx, cy - 6), (bx + math.cos(a0) * crx, cy + math.sin(a0) * cry),
                       (bx + math.cos(a1) * crx, cy + math.sin(a1) * cry)], fill=c)
        ell(d, bx, cy - 6, 2, 1, fill=C['gold'])
        for i in range(16):
            a = rot + i / 16 * 6.283
            if math.sin(a) < 0: continue
            d.point((bx + math.cos(a) * crx, cy + math.sin(a) * cry + 1),
                    fill=C['gold'] if (i + int(t * 10)) % 3 == 0 else C['pink'])
    cv.add(x + y - 1.5, back)
    cv.add(x + y + 1.5, front)

def ride_pirate(cv, t, hs, vs):
    x, y = RIDE['pirate']
    bx, by = P(x, y)
    zp = 40 * vs
    px, py = bx, by - zp
    ang = 0.9 * math.sin(t * 2.1 + 0.4)
    L = 27 * vs
    def rot(dx, dy):
        c, s = math.cos(ang), math.sin(ang)
        return (px + (dx * c - dy * s) * hs, py + (dx * s + dy * c))
    def back(d):
        for sg in (-1, 1):
            d.line([bx + sg * 20 * hs - 3, by - 3, px - 3, py - 1], fill=C['gray'])
    def ship(d):
        d.line([px, py, *rot(-12, L - 2)], fill=C['dgray'])
        d.line([px, py, *rot(12, L - 2)], fill=C['dgray'])
        hull = [rot(-26, L - 7), rot(-17, L + 7), rot(17, L + 7), rot(26, L - 7), rot(14, L - 2), rot(-14, L - 2)]
        d.polygon(hull, fill=C['wood'])
        d.polygon([rot(-17, L + 7), rot(17, L + 7), rot(20, L + 3), rot(-20, L + 3)], fill=C['wood2'])
        d.line([rot(-23, L - 4), rot(23, L - 4)], fill=C['gold'])
        d.line([rot(-21, L), rot(21, L)], fill=C['red2'])
        for k in range(-15, 16, 6):
            d.point(rot(k, L + 1), fill=C['ink'])
        for k in range(-13, 14, 2):
            d.point(rot(k, L - 4), fill=C['skin'] if k % 4 == 1 else C['hair'])
            d.point(rot(k, L - 3), fill=SHIRTS[(k + 13) % len(SHIRTS)])
            if abs(ang) > 0.7: d.point(rot(k, L - 6), fill=C['skin'])
        d.line([rot(0, L - 2), rot(0, L - 20)], fill=C['wood2'])
        d.polygon([rot(1, L - 19), rot(11, L - 12), rot(1, L - 5)], fill=C['white'])
        d.polygon([rot(-1, L - 17), rot(-8, L - 11), rot(-1, L - 6)], fill=C['cream'])
        fl = math.sin(t * 9)
        d.polygon([rot(0, L - 20), rot(-6, L - 19 + fl), rot(0, L - 17)], fill=C['ink'])
        ell(d, px, py, 2, 2, fill=C['gold'])
    def front(d):
        for sg in (-1, 1):
            d.line([bx + sg * 22 * hs, by, px, py], fill=C['lgray'])
            d.line([bx + sg * 22 * hs + 1, by, px + 1, py], fill=C['white'])
    cv.add(x + y - 1.2, back)
    cv.add(x + y, ship)
    cv.add(x + y + 1.2, front)

def ride_teacups(cv, t, hs, vs):
    x, y = RIDE['teacups']
    bx, by = P(x, y)
    R = 2.0 * hs
    rx, ry = R * TW * 1.414, R * TH * 1.414
    rot = -t * 0.9
    def fn(d):
        ell(d, bx, by + 2, rx + 3, ry + 2, fill=C['pink2'])
        ell(d, bx, by, rx + 3, ry + 2, fill=C['cream'])
        ell(d, bx, by, rx * 0.6, ry * 0.6, fill=C['pz1'])
        cups = []
        cols = [C['pink'], C['teal'], C['yel'], C['purple'], C['blue'], C['orange']]
        for i in range(6):
            a = rot + i / 6 * 6.283
            cups.append((math.sin(a), i, bx + math.cos(a) * rx * 0.72, by + math.sin(a) * ry * 0.72))
        for s, i, cx, cy in sorted(cups):
            c = cols[i]
            sp = t * 5 + i
            cvs = int(vs * 4)
            ell(d, cx, cy, 4 * hs, 2, fill=mix(c, C['ink'], 0.35))
            d.rectangle([cx - 4 * hs, cy - cvs, cx + 4 * hs, cy], fill=c)
            ell(d, cx, cy - cvs, 4 * hs, 2, fill=mix(c, C['white'], 0.5))
            # handle + spinning dot
            d.point((cx + 4 * math.cos(sp), cy - cvs + 1.5 * math.sin(sp)), fill=C['white'])
            d.point((cx - 1, cy - cvs - 1), fill=C['skin'])
            d.point((cx + 1, cy - cvs - 1), fill=C['hair'])
        # center teapot
        d.rectangle([bx - 3, by - 7 * vs, bx + 3, by], fill=C['white'])
        ell(d, bx, by - 7 * vs, 3, 2, fill=C['pink'])
        d.point((bx, by - 7 * vs - 3), fill=C['gold'])
    cv.add(x + y, fn)

def stall(cv, x, y, col, hs, vs):
    bx, by = Pi(x, y)
    c = C[col]
    def fn(d):
        w = max(1, int(7 * hs)); h = max(1, int(7 * vs))
        # body box (iso) left face/right face
        d.polygon([(bx - w, by - 3), (bx, by), (bx, by - h), (bx - w, by - h - 3)], fill=C['cream'])
        d.polygon([(bx, by), (bx + w, by - 3), (bx + w, by - h - 3), (bx, by - h)], fill=C['pz0'])
        d.line([(bx - w + 1, by - 6), (bx - 1, by - 3)], fill=C['wood'])
        # striped awning
        for k in range(-w, w + 1):
            cc = c if (k // 2) % 2 == 0 else C['white']
            yy = by - h - 3 + abs(k) * 3 // w
            d.line([(bx + k, yy - 3), (bx + k, yy + 1)], fill=cc)
        d.line([(bx - w, by - h - 6), (bx, by - h - 3), (bx + w, by - h - 6)], fill=mix(c, C['ink'], 0.4))
        # goods/balloons on top
        d.point((bx, by - h - 8), fill=C['gold'])
        d.point((bx - 2, by - h - 7), fill=C['pink']); d.point((bx + 2, by - h - 7), fill=C['teal'])
    cv.add(x + y, fn)

def tent(cv, x, y, col, r, t, hs, vs):
    bx, by = P(x, y)
    c = C[col]
    rx, ry = r * TW * 1.414 * hs, r * TH * 1.414 * hs
    hwall = 9 * vs; hroof = 16 * vs * r / 2
    def fn(d):
        # wall cylinder (front half) with stripes
        n = 18
        for i in range(n):
            a0 = i / n * 3.1416; a1 = (i + 1) / n * 3.1416
            x0 = bx + math.cos(a0) * rx; x1 = bx + math.cos(a1) * rx
            y0 = by + math.sin(a0) * ry; y1 = by + math.sin(a1) * ry
            cc = c if i % 2 == 0 else C['white']
            if i > n * 0.5: cc = mix(cc, C['ink'], 0.12)
            d.polygon([(x0, y0), (x1, y1), (x1, y1 - hwall), (x0, y0 - hwall)], fill=cc)
        ell(d, bx, by - hwall, rx, ry, fill=mix(c, C['ink'], 0.3))
        top = (bx, by - hwall - hroof)
        segs = []
        for i in range(n):
            a0 = i / n * 6.283; a1 = a0 + 6.283 / n
            segs.append((math.sin(a0 + 0.17), i, (bx + math.cos(a0) * rx, by - hwall + math.sin(a0) * ry),
                         (bx + math.cos(a1) * rx, by - hwall + math.sin(a1) * ry)))
        for s, i, p0, p1 in sorted(segs):
            cc = c if i % 2 == 0 else C['white']
            if math.cos(i / n * 6.283) > 0.3: cc = mix(cc, C['ink'], 0.18)
            d.polygon([top, p0, p1], fill=cc)
        # door
        d.polygon([(bx - 2, by + ry), (bx + 2, by + ry), (bx, by + ry - hwall + 2)], fill=C['ink'])
        d.line([top[0], top[1], top[0], top[1] - 7], fill=C['dgray'])
        fl = int(round(2 * math.sin(t * 8 + x)))
        d.polygon([(top[0], top[1] - 7), (top[0] + 6, top[1] - 6 + fl), (top[0], top[1] - 4)], fill=C['yel'])
    cv.add(x + y, fn)

def gate(cv, t, hs, vs):
    x, y = GATE
    def tower(x0, y0, col):
        bx, by = Pi(x0, y0)
        def fn(d):
            h = int(26 * vs)
            d.rectangle([bx - 4, by - h, bx + 4, by], fill=C['cream'])
            d.rectangle([bx + 1, by - h, bx + 4, by], fill=C['pz0'])
            d.rectangle([bx - 4, by - h, bx + 4, by - h + 2], fill=C['gold'])
            d.polygon([(bx - 6, by - h), (bx + 6, by - h), (bx, by - h - 14 * vs)], fill=C[col])
            d.polygon([(bx, by - h), (bx + 6, by - h), (bx, by - h - 14 * vs)], fill=mix(C[col], C['ink'], 0.25))
            d.line([bx, by - h - 14 * vs, bx, by - h - 20 * vs], fill=C['dgray'])
            fl = int(round(2 * math.sin(t * 9 + x0)))
            d.polygon([(bx, by - h - 20 * vs), (bx + 7, by - h - 19 * vs + fl), (bx, by - h - 16 * vs)], fill=C['yel'])
            d.rectangle([bx - 2, by - 10, bx + 1, by - 6], fill=C['ink'])
        cv.add(x0 + y0, fn)
    tower(x + 2.6, y - 2.6, 'red')
    tower(x - 2.6, y + 2.6, 'blue')
    # arch
    a0 = P(x + 2.6, y - 2.6, 24 * vs); a1 = P(x - 2.6, y + 2.6, 24 * vs)
    def arch(d):
        pts = []
        for i in range(21):
            k = i / 20
            px = a0[0] + (a1[0] - a0[0]) * k
            py = a0[1] + (a1[1] - a0[1]) * k - math.sin(k * 3.1416) * 10 * vs
            pts.append((px, py))
        d.line(pts, fill=C['red'], width=4)
        d.line([(p[0], p[1] - 1) for p in pts], fill=C['gold'], width=1)
        for i, (px, py) in enumerate(pts[1:-1:2]):
            on = (i + int(t * 8)) % 3 == 0
            d.point((px, py + 1), fill=C['white'] if on else C['pink'])
        # bunting
        for i in range(12):
            k = (i + 0.5) / 12
            px = a0[0] + (a1[0] - a0[0]) * k
            py = a0[1] + (a1[1] - a0[1]) * k + 6 + math.sin(k * 3.1416) * 3
            cc = BALLOONS[i % len(BALLOONS)]
            sw = math.sin(t * 6 + i) * 0.7
            d.polygon([(px - 1, py), (px + 2, py), (px + sw, py + 3)], fill=cc)
    cv.add(x + y + 0.3, arch)

def tree(cv, x, y, k):
    spr = TREE_SPR[k]
    bx, by = Pi(x, y)
    def fn(d):
        cv.img.paste(spr, (bx - spr.width // 2, by - spr.height + 1), spr)
    cv.add(x + y, fn)

def lamp(cv, x, y, t):
    bx, by = Pi(x, y)
    def fn(d):
        d.line([bx, by, bx, by - 9], fill=C['ink'])
        d.point((bx, by - 10), fill=C['gold'])
        d.point((bx - 1, by - 10), fill=C['cream'])
    cv.add(x + y, fn)

def fountain(cv, t, hs, vs):
    x, y = RIDE['fountain']
    bx, by = P(x, y)
    def fn(d):
        ell(d, bx, by + 1, 10 * hs, 5 * hs, fill=C['p2'])
        ell(d, bx, by, 10 * hs, 5 * hs, fill=C['lgray'])
        ell(d, bx, by, 8 * hs, 4 * hs, fill=C['w1'])
        if hs > 0.5:
            rng = random.Random(int(t * 15))
            for i in range(26):
                a = rng.uniform(0, 6.28); ph = (t * 1.6 + i / 26) % 1.0
                r = ph * 7
                h = 4 * ph * (1 - ph) * 16
                d.point((bx + math.cos(a) * r, by + math.sin(a) * r * 0.5 - h), fill=C['w2'] if i % 3 else C['white'])
            d.rectangle([bx - 1, by - 5, bx + 1, by], fill=C['white'])
    cv.add(x + y, fn)

# ---------------------------------------------------------------- coaster
TRAIN_POS = None

def draw_track(cv, t):
    bh = build_head(t)
    n = len(TRK)
    lat = 0.27
    for i in range(n - 1):
        s0 = TRK_S[i]
        if s0 > bh: break
        p = TRK[i]; q = TRK[i + 1]
        # piece-wise drop-in near build head
        piece = int(s0 / 2.2)
        piece_end = (piece + 1) * 2.2
        drop = 0.0
        if t < BUILD_END + 0.2:
            age = (bh - piece * 2.2) / BUILD_SPEED  # seconds since piece started placing
            drop = max(0.0, 1 - age / 0.12) * 14
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy)
        if TRK_LOOPC[i] is not None:
            # in loop: lateral = perpendicular of loop plane heading
            j = i
            while TRK_LOOPC[j] is not None and j > 0: j -= 1
            hx_ = TRK[j + 1][0] - TRK[j][0]; hy_ = TRK[j + 1][1] - TRK[j][1]
            Lh = math.hypot(hx_, hy_); lx, ly = -hy_ / Lh, hx_ / Lh
        else:
            lx, ly = -dy / max(L, 1e-6), dx / max(L, 1e-6)
        z0 = p[2] + drop; z1 = q[2] + drop
        a0 = P(p[0] + lx * lat, p[1] + ly * lat, z0); a1 = P(q[0] + lx * lat, q[1] + ly * lat, z1)
        b0 = P(p[0] - lx * lat, p[1] - ly * lat, z0); b1 = P(q[0] - lx * lat, q[1] - ly * lat, z1)
        dep = (p[0] + p[1]) / 1 + 0.4
        inloop = TRK_LOOPC[i] is not None
        lift = TRK_LIFT[i]
        def fn(d, a0=a0, a1=a1, b0=b0, b1=b1, p=p, i=i, inloop=inloop, lift=lift, z0=z0):
            # supports
            if i % 5 == 0 and p[2] > 7 and not (inloop and p[2] > 12):
                g = P(p[0], p[1], 0); top = P(p[0], p[1], z0 - 1)
                d.line([g, top], fill=C['white'])
                if i % 10 == 0:
                    g2 = P(p[0] + 0.35, p[1] + 0.35, 0)
                    d.line([g2, top], fill=C['lgray'])
                if p[2] > 30 and i % 10 == 5:
                    m = P(p[0], p[1], z0 * 0.5)
                    d.line([(m[0] - 2, m[1]), (m[0] + 2, m[1])], fill=C['lgray'])
            # ties
            if i % 2 == 0:
                d.line([a0, b0], fill=C['dgray'] if not lift else C['ink'])
            d.line([b0, b1], fill=C['red2'])
            d.line([a0, a1], fill=C['red'])
            if lift and i % 3 == 0:
                d.point(((a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2), fill=C['gold'])
        cv.add(dep, fn)
    # build head sparkle
    if 0 < bh < TRK_L:
        p, _ = trk_at(bh)
        hp = P(p[0], p[1], p[2])
        def spark(d):
            for k in range(6):
                a = t * 40 + k
                r = 3 + (k % 3)
                d.point((hp[0] + math.cos(a) * r, hp[1] + math.sin(a) * r * 0.7), fill=C['gold'] if k % 2 else C['white'])
            ell(d, hp[0], hp[1], 2, 2, fill=C['white'])
        cv.add(p[0] + p[1] + 5, spark)

def track_up_screen(i, pos):
    lc = TRK_LOOPC[i]
    if lc is None: return (0, -1)
    c = P(*lc); q = P(*pos)
    vx, vy = c[0] - q[0], c[1] - q[1]; n = math.hypot(vx, vy) or 1
    return (vx / n, vy / n)

def draw_train(cv, t, s_head):
    cars = 6; gap = 1.05
    cols = [C['yel'], C['blue'], C['yel'], C['blue'], C['yel'], C['blue']]
    for k in range(cars):
        s = s_head - k * gap
        if s < 0: continue
        p, i = trk_at(s)
        p2, _ = trk_at(s + 0.3)
        a = P(*p); b = P(*p2)
        vx, vy = b[0] - a[0], b[1] - a[1]; n = math.hypot(vx, vy) or 1
        vx, vy = vx / n, vy / n
        ux, uy = track_up_screen(i, p)
        c = cols[k]
        def fn(d, a=a, vx=vx, vy=vy, ux=ux, uy=uy, c=c, k=k):
            L = 3.2
            p0 = (a[0] - vx * L + ux * 1.5, a[1] - vy * L + uy * 1.5)
            p1 = (a[0] + vx * L + ux * 1.5, a[1] + vy * L + uy * 1.5)
            d.line([p0, p1], fill=mix(c, C['ink'], 0.5), width=4)
            d.line([(p0[0] + ux, p0[1] + uy), (p1[0] + ux, p1[1] + uy)], fill=c, width=2)
            d.line([(p0[0] + ux * 2, p0[1] + uy * 2), (p1[0] + ux * 2, p1[1] + uy * 2)], fill=mix(c, C['white'], 0.5), width=1)
            for j, off in enumerate((-1.4, 1.4)):
                h = (a[0] + vx * off + ux * 4.2, a[1] + vy * off + uy * 4.2)
                d.point(h, fill=C['skin'])
                d.point((h[0] + ux, h[1] + uy), fill=[C['hair'], C['yel'], C['ink'], C['wood']][(k + j) % 4])
            if k == 0:
                d.point((p1[0] + vx, p1[1] + vy), fill=C['red'])
                d.point((p1[0] + vx + ux, p1[1] + vy + uy), fill=C['red'])
        cv.add(p[0] + p[1] + 0.6, fn)

# ---------------------------------------------------------------- flume draw
def draw_flume(cv, t, hs, vs, built):
    if not built: return
    n = len(FL)
    for i in range(n - 1):
        p = FL[i]; q = FL[i + 1]
        dx, dy = q[0] - p[0], q[1] - p[1]; L = math.hypot(dx, dy) or 1
        lx, ly = -dy / L * 0.5, dx / L * 0.5
        z0 = p[2] * vs + 1; z1 = q[2] * vs + 1
        poly = [P(p[0] + lx, p[1] + ly, z0), P(q[0] + lx, q[1] + ly, z1), P(q[0] - lx, q[1] - ly, z1), P(p[0] - lx, p[1] - ly, z0)]
        def fn(d, poly=poly, p=p, i=i, z0=z0):
            if p[2] > 4 and i % 4 == 0:
                d.line([P(p[0], p[1], 0), P(p[0], p[1], z0)], fill=C['wood2'])
            d.polygon([(x_, y_ + 2) for x_, y_ in poly], fill=C['wood2'])
            d.polygon(poly, fill=C['w1'] if (i + int(t * 20)) % 6 else C['w2'])
            d.line([poly[0], poly[1]], fill=C['wood'])
            d.line([poly[3], poly[2]], fill=C['wood'])
        cv.add(p[0] + p[1] + 0.2, fn)
    # logs
    for k in range(4):
        s = (t * 4.2 + k * FL_L / 4) % FL_L
        p, i = fl_at(s)
        p2, _ = fl_at(s + 0.4)
        a = P(p[0], p[1], p[2] * vs + 2); b = P(p2[0], p2[1], p2[2] * vs + 2)
        vx, vy = b[0] - a[0], b[1] - a[1]; nn = math.hypot(vx, vy) or 1; vx, vy = vx / nn, vy / nn
        def fn(d, a=a, vx=vx, vy=vy, k=k):
            d.line([(a[0] - vx * 4, a[1] - vy * 4), (a[0] + vx * 4, a[1] + vy * 4)], fill=C['wood2'], width=3)
            d.line([(a[0] - vx * 4, a[1] - vy * 4 - 1), (a[0] + vx * 4, a[1] + vy * 4 - 1)], fill=C['wood'], width=1)
            d.point((a[0] - vx, a[1] - vy - 2), fill=C['skin']); d.point((a[0] + vx * 2, a[1] + vy * 2 - 2), fill=SHIRTS[k])
        cv.add(p[0] + p[1] + 0.5, fn)
        # splash at bottom of drop
        if FL_S[i] > 0 and p[2] < 3 and i > 0 and FL[max(0, i - 25)][2] > 10:
            sp = P(p[0], p[1], 2)
            def sfn(d, sp=sp, s=s):
                rng = random.Random(int(t * 30))
                for j in range(22):
                    a = rng.uniform(3.4, 6.0); r = rng.uniform(2, 9)
                    d.point((sp[0] + math.cos(a) * r, sp[1] + math.sin(a) * r * 0.9 - 2), fill=C['white'] if j % 2 else C['w2'])
            cv.add(p[0] + p[1] + 1, sfn)

# ---------------------------------------------------------------- guests
def draw_guests(cv, t, f):
    wt = warp(t)
    for g in GUESTS:
        d0 = guest_d(t, wt, g)
        if d0 is None: continue
        pts, s = RT[g['r']]
        L = s[-1]
        dd = d0 % L if d0 >= 0 else d0
        p, dv = route_pos(g['r'], dd)
        x = p[0] - dv[1] * g['lat']; y = p[1] + dv[0] * g['lat']
        bx, by = Pi(x, y)
        if not (-4 < bx < W + 4 and -10 < by < H + 4): continue
        walk = int((wt * 6 * g['v'] + g['phase'])) % 2
        kid = g['kid']
        def fn(d, bx=bx, by=by, g=g, walk=walk, kid=kid):
            h = 0 if kid else 1
            d.point((bx, by - 2 - h), fill=g['shirt'])
            if h: d.point((bx, by - 2), fill=g['shirt'])
            d.point((bx, by - 3 - h), fill=g['skin'])
            d.point((bx, by - 4 - h), fill=g['hair']) if not kid else None
            d.point((bx - walk, by - 1), fill=g['pants'])
            d.point((bx + 1 - walk, by), fill=C['ink']) if walk else d.point((bx, by), fill=C['ink'])
            if g['balloon']:
                d.line([bx + 1, by - 3 - h, bx + 1, by - 8 - h], fill=C['lgray'])
                d.rectangle([bx, by - 11 - h, bx + 2, by - 9 - h], fill=g['balloon'])
                d.point((bx, by - 11 - h), fill=C['white'])
        cv.add(x + y + 0.1, fn)
    # idle guests at stalls
    if t > POP['stalls'] + 0.2:
        for (x, y, c, ph) in IDLE:
            bx, by = Pi(x, y)
            bob = int(math.sin(t * 4 + ph) > 0.7)
            def fn(d, bx=bx, by=by, c=c, bob=bob):
                d.point((bx, by - 2 - bob), fill=c); d.point((bx, by - 1), fill=c)
                d.point((bx, by - 3 - bob), fill=C['skin']); d.point((bx, by), fill=C['ink'])
            cv.add(x + y + 0.1, fn)

def draw_balloons_fly(cv, t):
    for (x, y, ph, c, sp) in BAL_FLY:
        tt = t + ph
        if tt < 0: continue
        z = tt * 26 * sp
        bx, by = P(x, y, z)
        bx += math.sin(tt * 2 + x) * 3
        if by < -12: continue
        def fn(d, bx=bx, by=by, c=c):
            d.rectangle([bx - 1, by - 3, bx + 1, by], fill=c)
            d.point((bx - 1, by - 3), fill=C['white'])
            d.line([bx, by + 1, bx + (1 if int(t * 6) % 2 else 0), by + 5], fill=C['lgray'])
        cv.add(1000 + y, fn)

def car(cv, x, y, col, along_y=False):
    bx, by = Pi(x, y)
    def fn(d):
        if along_y:
            d.polygon([(bx - 4, by - 1), (bx, by + 1), (bx + 2, by), (bx - 2, by - 2)], fill=mix(col, C['ink'], 0.5))
        d.rectangle([bx - 3, by - 3, bx + 3, by], fill=col)
        d.line([bx - 3, by, bx + 3, by], fill=mix(col, C['ink'], 0.45))
        d.rectangle([bx - 1, by - 4, bx + 2, by - 3], fill=hx('#9fd8ff'))
        d.point((bx - 3, by + 1), fill=C['ink']); d.point((bx + 3, by + 1), fill=C['ink'])
    cv.add(x + y, fn)

def draw_lot(cv, t):
    for (x, y, c) in CARS:
        car(cv, x, y, c)
    # cars driving down the aisle and along approach road
    for k in range(4):
        u = (t * 3.2 + k * 3.6) % 14.0
        car(cv, 31.5 - u, 42.5, [C['pink'], C['gold'], C['teal'], C['blue']][k])
    for (x, y, a) in SWANS:
        aa = a + t * 0.35
        sx, sy = 44 + 3.2 * math.cos(aa), 24 + 5.2 * math.sin(aa)
        bx, by = Pi(sx, sy)
        def fn(d, bx=bx, by=by):
            d.rectangle([bx - 2, by - 2, bx + 2, by], fill=C['white'])
            d.line([bx + 2, by - 2, bx + 2, by - 5], fill=C['white'])
            d.point((bx + 3, by - 5), fill=C['orange'])
            d.line([bx - 3, by + 1, bx - 6, by + 2], fill=C['w2'])
        cv.add(sx + sy, fn)

# ---------------------------------------------------------------- frame
TRAIN = precompute_train(int(DUR * FPS) + 2)
TRAIN2_START = BUILD_END + 0.15

def render(f):
    t = f / FPS
    # camera: gentle drift
    CAM[0] = 132.0 + round(-3 + 6 * smooth(t / DUR))
    CAM[1] = 46.0 + round(2 - 4 * smooth(t / DUR))
    g = render_ground(t, f)
    img = Image.fromarray(g, 'RGB')
    cv = Canvas(img)
    # pads
    pads = [('ferris', 3.3), ('carousel', 2.9), ('swing', 3.4), ('pirate', 2.8), ('teacups', 2.7), ('drop', 1.6)]
    for name, r in pads:
        x, y = RIDE[name]
        if t < POP[name]:
            draw_pad(cv, x, y, r, C['dirt'], C['dirt2'])
        else:
            draw_pad(cv, x, y, r, C['pz0'], C['p2'])
    # station platform
    for (x, y, k) in TREES:
        tree(cv, x, y, k)
    # lamps along main path
    for k in range(6):
        a = 22 + k * 2.2
        lamp(cv, *LT(a + 1.6, a - 1.6), t); lamp(cv, *LT(a - 1.6, a + 1.6), t)
    # fence posts along perimeter
    def fence(d):
        for k in range(0, 73):
            u = k * 0.5
            for (x, y) in ((u, 0.5), (0.5, u), (u, 36.5), (36.5, u)):
                if 31.5 < x < 37.5 and 31.5 < y < 37.5: continue
                a = P(x, y); d.line([a, (a[0], a[1] - 3)], fill=C['wood2'])
    cv.add(-1e8, fence)
    # rides
    def popped(name):
        return pop_scale(t - POP[name])
    for name, fn in (('ferris', ride_ferris), ('drop', ride_drop), ('carousel', ride_carousel),
                     ('swing', ride_swing), ('pirate', ride_pirate), ('teacups', ride_teacups),
                     ('fountain', fountain)):
        sc = popped(name)
        if sc: fn(cv, t, *sc)
        x, y = RIDE[name]
        dust(cv, x, y, t - POP[name], 2.5)
    sc = popped('gate')
    if sc: gate(cv, t, *sc)
    dust(cv, *GATE, t - POP['gate'], 3)
    for idx, (x, y, col) in enumerate(STALLS):
        tp = POP['stalls'] + idx * 0.06
        sc = pop_scale(t - tp)
        if sc: stall(cv, x, y, col, *sc)
        dust(cv, x, y, t - tp, 1.0)
    for idx, (x, y, col, r) in enumerate(TENTS):
        tp = POP['tents'] + idx * 0.08
        sc = pop_scale(t - tp)
        if sc: tent(cv, x, y, col, r, t, *sc)
        dust(cv, x, y, t - tp, r)
    sc = popped('flume')
    draw_flume(cv, t, 1.0, sc[1] if sc else 1.0, sc is not None)
    if sc: dust(cv, *LT(6.5, 30), t - POP['flume'], 3)
    # coaster
    draw_track(cv, t)
    # station building
    sx0 = pop_scale(t - 0.1)
    if sx0:
        def station(d, vs=sx0[1]):
            a = P(*LT(18.0, 12.0), 0); b = P(*LT(21.5, 12.0), 0); c = P(*LT(21.5, 13.3), 0); e = P(*LT(18.0, 13.3), 0)
            h = 12 * vs
            roof = [(a[0], a[1] - h), (b[0], b[1] - h), (c[0], c[1] - h), (e[0], e[1] - h)]
            for k in range(4):
                p0 = roof[k]
                d.line([p0, (p0[0], p0[1] + h)], fill=C['white'])
            d.polygon(roof, fill=C['teal2'])
            for k in range(6):
                u = k / 6
                p0 = (roof[0][0] + (roof[1][0] - roof[0][0]) * u, roof[0][1] + (roof[1][1] - roof[0][1]) * u)
                p1 = (roof[3][0] + (roof[2][0] - roof[3][0]) * u, roof[3][1] + (roof[2][1] - roof[3][1]) * u)
                d.line([p0, p1], fill=C['teal'])
            d.line([roof[3], roof[2]], fill=C['white'])
        cv.add(18.0 + 13.3 + 1.5, station)
    # trains
    draw_train(cv, t, TRAIN[f])
    if t > TRAIN2_START:
        s2 = TRAIN[f] - TRK_L * 0.5
        if s2 > 0: draw_train(cv, t, s2)
    draw_guests(cv, t, f)
    draw_balloons_fly(cv, t)
    draw_lot(cv, t)
    cv.flush()
    return img

if __name__ == '__main__':
    import time
    mode = sys.argv[1] if len(sys.argv) > 1 else 'test'
    if mode == 'test':
        for fr in [int(x) for x in sys.argv[2:]] or [70]:
            t0 = time.time(); im = render(fr)
            im.resize((W * SCALE, H * SCALE), Image.NEAREST).save(f'work/px_{fr:03d}.png')
            print(fr, time.time() - t0)
    else:
        os.makedirs('work/frames_px', exist_ok=True)
        for fr in range(int(DUR * FPS)):
            render(fr).resize((W * SCALE, H * SCALE), Image.NEAREST).save(f'work/frames_px/{fr:04d}.png')
