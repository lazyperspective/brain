"""Mid-century risograph poster park, 'print run' transformation.
Four spot-ink separations drawn as tone maps, halftoned, grained, misregistered and
multiplied onto paper."""
import math, random, sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

S = 1080
FPS = 30
DUR = 3.0
M = 46  # paper margin

INKS = ['Y', 'P', 'T', 'N']
INK_RGB = dict(Y=(255, 226, 0), P=(255, 72, 168), T=(0, 136, 150), N=(36, 46, 104))
ANG = dict(Y=0.0, P=75.0, T=15.0, N=45.0)
PERIOD = 8.5
FINAL_OFF = dict(Y=(0, 0), P=(5, -3), T=(-4, 4), N=(2, 3))
STAMP_T = dict(Y=0.12, P=0.47, T=0.82, N=1.17)
ALIVE_T = 1.42

rs = np.random.RandomState(5)
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)

def screen(angle):
    a = math.radians(angle)
    u = (xx * math.cos(a) + yy * math.sin(a)) / PERIOD
    v = (-xx * math.sin(a) + yy * math.cos(a)) / PERIOD
    return (0.5 + 0.25 * (np.cos(2 * np.pi * u) + np.cos(2 * np.pi * v))).astype(np.float32)

SCR = {k: screen(ANG[k]) for k in INKS}

def blurnoise(sig, seed):
    r = np.random.RandomState(seed).randn(S, S).astype(np.float32)
    r = ndimage.gaussian_filter(r, sig)
    return (r - r.mean()) / (r.std() + 1e-6)

FINE = {k: blurnoise(0.7, 10 + i) for i, k in enumerate(INKS)}
GRAINV = {}
for i, k in enumerate(INKS):
    n = blurnoise(1.1, 30 + i)
    voids = np.clip((n - 1.85) * 2.0, 0, 1)             # ink-starved speckles
    low = blurnoise(60, 50 + i) * 0.06 + blurnoise(9, 70 + i) * 0.04
    GRAINV[k] = np.clip((1 - 0.85 * voids) * (0.93 + low), 0, 1).astype(np.float32)

# paper
paper = np.ones((S, S, 3), np.float32) * np.array([244, 236, 219], np.float32) / 255
pf = blurnoise(1.0, 90) * 0.012 + blurnoise(18, 91) * 0.015
fib = np.clip(blurnoise(0.6, 92) - 2.6, 0, 1) * 0.08
paper = paper * (1 + pf[..., None]) - fib[..., None] * np.array([0.6, 0.6, 0.5])
PAPER = np.clip(paper, 0, 1).astype(np.float32)

# ---------------------------------------------------------------- drawing into separations
class Sep:
    def __init__(self):
        self.im = {k: Image.new('L', (S, S), 0) for k in INKS}
        self.d = {k: ImageDraw.Draw(self.im[k]) for k in INKS}
    def _v(self, spec, k):
        return int(round(255 * spec.get(k, 0)))
    def poly(self, pts, spec):
        for k in INKS: self.d[k].polygon(pts, fill=self._v(spec, k))
    def ellipse(self, box, spec):
        x0, y0, x1, y1 = box
        if x1 - x0 < 1 or y1 - y0 < 1: return
        for k in INKS: self.d[k].ellipse(box, fill=self._v(spec, k))
    def circle(self, cx, cy, r, spec):
        self.ellipse((cx - r, cy - r, cx + r, cy + r), spec)
    def line(self, pts, spec, w):
        for k in INKS: self.d[k].line(pts, fill=self._v(spec, k), width=int(w), joint='curve')
    def rect(self, box, spec):
        for k in INKS: self.d[k].rectangle(box, fill=self._v(spec, k))
    def ring(self, cx, cy, r, spec, w):
        for k in INKS: self.d[k].ellipse((cx - r, cy - r, cx + r, cy + r), outline=self._v(spec, k), width=int(w))
    def overprint(self, k, fn):
        """draw on a single separation only (overprint, no knockout)."""
        fn(self.d[k])

# colour specs (ink tints)
NAVY = dict(N=1)
PINK = dict(P=1)
YEL = dict(Y=1)
TEAL = dict(T=1)
RED = dict(Y=1, P=1)
ORANGE = dict(Y=1, P=0.55)
GREEN = dict(Y=1, T=0.55)
DKGREEN = dict(Y=1, T=1)
LAWN = dict(T=0.82, Y=0.12)
LAWN2 = dict(T=1.0, Y=0.12)
CREAM = dict(Y=0.22)
PAPERW = dict()
PURPLE = dict(P=1, N=0.55)
SKYP = dict(P=0.3, Y=0.4)
WATER = dict(T=1.0, N=0.45)
SHADOW = dict(N=0.35)
LILAC = dict(P=0.45, T=0.35)

def ease(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

# ---------------------------------------------------------------- coaster geometry (screen 2.5D: x, ground y, height)
K = [(170, 690, 24), (300, 680, 24), (380, 650, 80), (470, 612, 200), (555, 575, 318), (612, 562, 352),
     (680, 575, 322), (742, 622, 200), (792, 690, 70), (850, 760, 30), (884, 818, 30), (842, 864, 28),
     (760, 874, 26), (660, 876, 26),   # loop between 13 and 14
     (560, 882, 26), (440, 892, 30), (320, 884, 40), (225, 846, 50), (150, 776, 40)]
LOOP_AT = 13
LOOP_R = 150; LOOP_SHIFT = 64

def cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)

def build_coaster():
    P = [np.array(k, float) for k in K]
    n = len(P); out = []; loopflag = []
    for i in range(n):
        p0, p1, p2, p3 = P[(i - 1) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]
        if i == LOOP_AT:
            xs, yg, h0 = p1
            m = 140
            for j in range(m):
                th = 2 * math.pi * j / m
                f = (th - math.sin(th)) / (2 * math.pi)
                out.append(np.array([xs - LOOP_R * math.sin(th) - LOOP_SHIFT * f, yg + 6 * f, h0 + LOOP_R * (1 - math.cos(th))]))
                loopflag.append(True)
            # bridge to next point
            a = np.array([xs - LOOP_SHIFT, yg + 6, h0])
            for j in range(1, 10):
                out.append(a + (p2 - a) * j / 10); loopflag.append(False)
            continue
        seg = np.linalg.norm(p2[:2] - p1[:2]) + abs(p2[2] - p1[2])
        m = max(4, int(seg / 6))
        for j in range(m):
            out.append(cr(p0, p1, p2, p3, j / m)); loopflag.append(False)
    pts = np.array(out)
    scr = np.stack([pts[:, 0], pts[:, 1] - pts[:, 2]], 1)
    d = np.linalg.norm(np.diff(np.vstack([scr, scr[:1]]), axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(d)])
    return pts, scr, np.array(loopflag), s

CPTS, CSCR, CLOOP, CS = build_coaster()
CL = CS[-1]
START_S = CS[[i for i in range(len(CPTS)) if abs(CPTS[i][0] - 612) < 8 and CPTS[i][2] > 340][0]]

def c_at(s):
    s = s % CL
    i = int(np.searchsorted(CS, s) - 1); i = max(0, min(i, len(CSCR) - 1))
    j = (i + 1) % len(CSCR)
    f = (s - CS[i]) / max(CS[i + 1] - CS[i], 1e-9)
    p = CSCR[i] * (1 - f) + CSCR[j] * f
    tan = CSCR[j] - CSCR[i]; tan = tan / (np.linalg.norm(tan) + 1e-9)
    h = CPTS[i][2] * (1 - f) + CPTS[j][2] * f
    return p, tan, h, CLOOP[i]

HMAX = CPTS[:, 2].max()
def train_s(tau):
    s = START_S; dt = 1 / 240.0
    v = 60.0
    n = int(tau / dt)
    for k in range(n):
        p, tan, h, lp = c_at(s)
        vt = math.sqrt(max(0, 2 * 900 * (HMAX + 25 - h)))
        if 0 < (s - CS[2]) % CL < (CS[25] - CS[2]):  # lift section approx
            vt = 140
        v += (vt - v) * min(1, dt * 6)
        s += v * dt
    return s

# ---------------------------------------------------------------- scene pieces
rng = random.Random(4)
TREES = []
for _ in range(80):
    x = rng.uniform(M + 20, S - M - 20); y = rng.uniform(520, S - M - 20)
    TREES.append((x, y, rng.uniform(14, 26), rng.random()))
TREES.sort(key=lambda t: t[1])

CLOUDS = [(150, 150, 1.0), (760, 110, 1.25), (980, 260, 0.8), (520, 230, 0.7)]

# paths as polylines (screen)
PATHS = [
    [(540, 1040), (540, 960), (520, 900), (470, 830), (400, 760), (330, 720), (240, 720), (120, 760)],
    [(520, 900), (640, 820), (760, 760), (820, 700), (840, 620), (800, 560), (700, 520), (560, 520), (420, 540), (300, 580), (200, 600)],
    [(470, 830), (330, 900), (200, 960), (90, 990)],
    [(640, 820), (760, 900), (880, 960), (1000, 980)],
]

def path_len(pl):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pl[:-1], pl[1:]))

def path_pos(pl, d):
    L = path_len(pl); d = d % (2 * L)
    if d > L: d = 2 * L - d
    for a, b in zip(pl[:-1], pl[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        if d <= l:
            f = d / l; return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        d -= l
    return pl[-1]

GUESTS = [(rng.randrange(len(PATHS)), rng.uniform(0, 3000), rng.uniform(18, 34) * rng.choice([1, 1]),
           rng.gauss(0, 7), rng.choice([NAVY, PINK, RED, NAVY, PURPLE, TEAL])) for _ in range(230)]

BALLOONS = [(rng.uniform(100, 980), rng.uniform(300, 1000), rng.choice([PINK, TEAL, RED, YEL, PURPLE]),
             rng.uniform(0, 6), rng.uniform(50, 90)) for _ in range(16)]

def draw_scene(sp, tau, t):
    """tau: animation time (0 = frozen print)."""
    # --- sky
    for y in range(M, 600, 6):
        k = min(1.0, (y - M) / (560 - M))
        spec = dict(Y=0.35 + 0.6 * k, P=0.55 * (1 - k) ** 1.4)
        sp.rect((M, y, S - M, y + 6), spec)
    # sun with rays
    sx, sy = 262, 300
    for i in range(16):
        a0 = i / 16 * 2 * math.pi + tau * 0.05; a1 = a0 + math.pi / 32
        sp.poly([(sx, sy), (sx + 900 * math.cos(a0), sy + 900 * math.sin(a0)), (sx + 900 * math.cos(a1), sy + 900 * math.sin(a1))],
                dict(Y=0.95, P=0.18 if i % 2 == 0 else 0.0))
    sp.circle(sx, sy, 210, dict(Y=1, P=0.35))
    sp.circle(sx, sy, 178, PINK)
    # clouds (paper knockout with teal shadow)
    for (cx, cy, k) in CLOUDS:
        cx = cx + tau * 12 * k
        for (dx, dy, r) in [(-60, 10, 34), (-20, -12, 46), (30, -2, 40), (70, 14, 28), (0, 18, 30)]:
            sp.circle(cx + dx * k, cy + dy * k + 6, r * k, dict(T=0.3, Y=0.2))
        for (dx, dy, r) in [(-60, 10, 34), (-20, -12, 46), (30, -2, 40), (70, 14, 28), (0, 18, 30)]:
            sp.circle(cx + dx * k, cy + dy * k, r * k, PAPERW)
    # --- distant hills
    pts = [(M, 600)] + [(x, 470 + 40 * math.sin(x / 120) + 22 * math.sin(x / 47 + 1)) for x in range(M, S - M + 1, 10)] + [(S - M, 600)]
    sp.poly(pts, dict(Y=0.9, T=0.75, P=0.15))
    pts = [(M, 620)] + [(x, 520 + 26 * math.sin(x / 90 + 2) + 10 * math.sin(x / 31)) for x in range(M, S - M + 1, 10)] + [(S - M, 620)]
    sp.poly(pts, dict(Y=1, T=0.95))
    # --- ground lawn with mown stripes
    sp.rect((M, 560, S - M, S - M), LAWN)
    for i in range(-10, 30):
        x0 = i * 90
        sp.poly([(x0, 560), (x0 + 45, 560), (x0 + 45 - 260, S - M), (x0 - 260, S - M)], LAWN2)
    sp.rect((0, 0, M, S), PAPERW)  # keep margin clean (re-done at end)
    # pond
    sp.ellipse((70, 900, 330, 1010), WATER)
    for i in range(4):
        y = 925 + i * 20; ph = tau * 40 + i * 30
        sp.line([(110 + (ph % 40), y), (150 + (ph % 40), y)], PAPERW, 3)
    # paths (cream with paper centre line)
    for pl in PATHS:
        sp.line(pl, dict(Y=0.2, P=0.12), 34)
    for pl in PATHS:
        sp.line(pl, CREAM, 26)
    # plaza
    sp.ellipse((440, 860, 620, 940), dict(Y=0.2, P=0.12))
    sp.ellipse((452, 866, 608, 934), CREAM)
    for i in range(12):
        a = i / 12 * 2 * math.pi
        sp.line([(530, 900), (530 + 78 * math.cos(a), 900 + 34 * math.sin(a))], dict(Y=0.4, P=0.3), 3)

    ferris(sp, tau)
    drop_tower(sp, tau)
    tents(sp, tau)
    swing(sp, tau)
    trees(sp, [tr for tr in TREES if tr[1] < 700])
    coaster(sp, tau)
    flume(sp, tau)
    carousel(sp, tau)
    pirate(sp, tau)
    stalls(sp, tau)
    trees(sp, [tr for tr in TREES if tr[1] >= 700])
    guests(sp, tau)
    gate(sp, tau)
    balloons(sp, tau)
    # paper margin knock-out
    sp.rect((0, 0, S, M), PAPERW); sp.rect((0, S - M, S, S), PAPERW)
    sp.rect((0, 0, M, S), PAPERW); sp.rect((S - M, 0, S, S), PAPERW)

def flag(sp, x, y, tau, spec, size=22, ph=0):
    sp.line([(x, y), (x, y - size * 1.6)], NAVY, 4)
    w = math.sin(tau * 9 + ph) * 5
    sp.poly([(x, y - size * 1.6), (x + size + w * 0.5, y - size * 1.25 + w), (x, y - size * 0.9)], spec)

def ferris(sp, tau):
    cx, cy, R = 262, 300, 205
    ang = tau * 0.38
    # legs
    for dx in (-150, 150):
        sp.line([(cx + dx, 592), (cx, cy)], NAVY, 12)
    sp.line([(cx - 90, 470), (cx + 90, 470)], NAVY, 6)
    n = 16
    for i in range(n):
        a = ang + i / n * 2 * math.pi
        sp.line([(cx, cy), (cx + R * math.cos(a), cy + R * math.sin(a))], NAVY, 4)
    sp.ring(cx, cy, R, NAVY, 9)
    sp.ring(cx, cy, R - 26, NAVY, 3)
    sp.ring(cx, cy, 60, NAVY, 5)
    sp.circle(cx, cy, 18, YEL); sp.ring(cx, cy, 18, NAVY, 4)
    cols = [TEAL, RED, YEL, PURPLE]
    for i in range(n):
        a = ang + i / n * 2 * math.pi
        px, py = cx + R * math.cos(a), cy + R * math.sin(a)
        sw = math.sin(tau * 2.2 + i) * 3
        sp.line([(px, py), (px + sw, py + 14)], NAVY, 3)
        gx, gy = px + sw, py + 14
        sp.poly([(gx - 16, gy), (gx + 16, gy), (gx + 13, gy + 24), (gx - 13, gy + 24)], cols[i % 4])
        sp.rect((gx - 18, gy - 3, gx + 18, gy + 3), NAVY)
        sp.rect((gx - 10, gy + 6, gx + 10, gy + 13), dict(Y=0.2))
    # ticket hut
    sp.rect((cx - 40, 560, cx + 40, 600), RED)
    sp.poly([(cx - 52, 560), (cx + 52, 560), (cx, 528)], NAVY)

def drop_tower(sp, tau):
    x, base, top = 930, 600, 92
    sp.rect((x - 14, top, x + 14, base), TEAL)
    for y in range(top, base, 40):
        sp.rect((x - 14, y, x + 14, y + 16), dict(T=1, N=0.6))
    sp.poly([(x - 30, top + 6), (x + 30, top + 6), (x, top - 40)], RED)
    flag(sp, x, top - 40, tau, YEL, 18, 1)
    ph = (tau * 0.9 + 0.25) % 2.4
    if ph < 1.0: z = ease(ph)
    elif ph < 1.5: z = 1.0
    elif ph < 1.8: z = 1 - ((ph - 1.5) / 0.3) ** 2
    else: z = 0.03 * abs(math.sin((ph - 1.8) * 12))
    cy = base - 60 - z * (base - top - 120)
    sp.rect((x - 46, cy - 14, x + 46, cy + 14), PINK)
    sp.rect((x - 46, cy + 8, x + 46, cy + 14), NAVY)
    for k in range(-36, 40, 12):
        sp.circle(x + k, cy - 18, 5, NAVY)
        sp.line([(x + k, cy + 14), (x + k, cy + 28)], NAVY, 4)

def tents(sp, tau):
    for (x, y, w, h, spec) in [(470, 548, 120, 120, PINK), (360, 568, 80, 80, TEAL), (690, 520, 90, 90, RED)]:
        n = 8
        for i in range(n):
            x0 = x - w / 2 + i * w / n; x1 = x0 + w / n
            sp.rect((x0, y - h * 0.35, x1, y), spec if i % 2 == 0 else PAPERW)
        for i in range(n):
            x0 = x - w / 2 - 6 + i * (w + 12) / n; x1 = x0 + (w + 12) / n
            sp.poly([(x, y - h), (x0, y - h * 0.35), (x1, y - h * 0.35)], spec if i % 2 == 0 else CREAM)
        sp.poly([(x - 10, y), (x + 10, y), (x, y - h * 0.28)], NAVY)
        flag(sp, x, y - h, tau, YEL, 18, x)

def swing(sp, tau):
    x, base = 790, 610
    top = 360
    rot = tau * 1.6
    sp.rect((x - 9, top, x + 9, base), NAVY)
    rx, ry = 120, 28
    seats = []
    for i in range(12):
        a = rot + i / 12 * 2 * math.pi
        seats.append((math.sin(a), a, i))
    def draw_seat(a, i):
        sx = x + math.cos(a) * rx; sy = top + 120 + math.sin(a) * ry
        tx = x + math.cos(a) * 52; ty = top + 22 + math.sin(a) * 12
        sp.line([(tx, ty), (sx, sy)], NAVY, 2)
        sp.rect((sx - 7, sy, sx + 7, sy + 8), [PINK, YEL, TEAL, RED][i % 4])
        sp.circle(sx, sy - 5, 4, NAVY)
    for s, a, i in sorted(seats):
        if s < 0: draw_seat(a, i)
    # canopy
    sp.ellipse((x - 64, top + 4, x + 64, top + 36), NAVY)
    for i in range(12):
        a0 = rot + i / 12 * 2 * math.pi; a1 = a0 + 2 * math.pi / 12
        sp.poly([(x, top - 26), (x + 62 * math.cos(a0), top + 18 + 14 * math.sin(a0)),
                 (x + 62 * math.cos(a1), top + 18 + 14 * math.sin(a1))], YEL if i % 2 else PINK)
    flag(sp, x, top - 26, tau, TEAL, 16, 3)
    for s, a, i in sorted(seats):
        if s >= 0: draw_seat(a, i)

def coaster(sp, tau):
    # supports
    for i in range(0, len(CPTS), 5):
        x, yg, h = CPTS[i]
        if CLOOP[i] and h > 40: continue
        if h < 20: continue
        sp.line([(x, yg), (x, yg - h)], PINK, 5 if i % 10 == 0 else 3)
    # shadow
    sp.line([(p[0], p[1] + 10) for p in CSCR[::2]], SHADOW, 6)
    # track: draw as segments, thick navy with yellow ties
    pts = [tuple(p) for p in CSCR]
    sp.line(pts + [pts[0]], NAVY, 13)
    sp.line(pts + [pts[0]], dict(N=0.55, T=0.4), 4)
    for i in range(0, len(pts), 4):
        p = CSCR[i]; q = CSCR[(i + 1) % len(pts)]
        tn = q - p; n = np.linalg.norm(tn) + 1e-9; nx, ny = -tn[1] / n, tn[0] / n
        sp.line([(p[0] - nx * 9, p[1] - ny * 9), (p[0] + nx * 9, p[1] + ny * 9)], YEL, 3)
    # station
    sp.rect((150, 640, 330, 690), dict(Y=0.2))
    sp.poly([(130, 640), (350, 640), (320, 610), (160, 610)], RED)
    for x in range(160, 330, 34):
        sp.rect((x, 650, x + 18, 676), NAVY)
    # train
    s0 = train_s(tau)
    for k in range(6):
        p, tan, h, lp = c_at(s0 - k * 36)
        nx, ny = tan[1], -tan[0]
        if lp:
            # normal points toward loop centre (inside)
            pass
        if ny > 0 and not lp: nx, ny = -nx, -ny
        c = [RED, YEL, RED, YEL, RED, YEL][k]
        a = p - tan * 15 + np.array([nx, ny]) * 9
        b = p + tan * 15 + np.array([nx, ny]) * 9
        sp.line([tuple(a), tuple(b)], NAVY, 28)
        sp.line([tuple(a + np.array([nx, ny]) * 3), tuple(b + np.array([nx, ny]) * 3)], c, 18)
        for j in (-6, 6):
            hp = p + tan * j + np.array([nx, ny]) * 25
            sp.circle(hp[0], hp[1], 5, NAVY)
            # raised arms when high speed in the drop
            if h < 200 and k % 2 == 0:
                sp.line([tuple(hp), tuple(hp + np.array([nx, ny]) * 10)], NAVY, 3)

def flume(sp, tau):
    # channel down the right side with a drop
    pl = [(1000, 640), (990, 700), (950, 760), (968, 820), (1010, 880), (990, 950), (930, 990), (840, 1000)]
    sp.line([(x + 4, y + 8) for x, y in pl], NAVY, 34)
    sp.line(pl, WATER, 26)
    # lift ramp / chute coming down from the hill
    sp.poly([(985, 470), (1020, 470), (1012, 640), (982, 640)], dict(T=0.6, N=0.5))
    sp.poly([(990, 470), (1015, 470), (1008, 640), (987, 640)], WATER)
    for k in range(5):
        u = (tau * 0.22 + k / 5) % 1.0
        d = path_len(pl) * u
        x, y = path_pos(pl, d)
        sp.ellipse((x - 20, y - 9, x + 20, y + 9), dict(Y=1, P=0.5, N=0.35))
        sp.circle(x - 6, y - 10, 5, NAVY); sp.circle(x + 6, y - 10, 5, NAVY)
    # log coming down the chute
    u = (tau * 0.5) % 1.0
    y = 470 + 170 * u
    sp.ellipse((990, y - 14, 1012, y + 14), dict(Y=1, P=0.5, N=0.35))
    # splash
    sp_k = (tau * 0.5) % 1.0
    for i in range(9):
        a = math.pi + i / 8 * math.pi
        r = 26 + 20 * math.sin(tau * 7 + i) ** 2
        sp.circle(1000 + math.cos(a) * r, 650 + math.sin(a) * r * 0.8, 8 - i % 3, PAPERW)
        sp.circle(1000 + math.cos(a) * r * 0.6, 650 + math.sin(a) * r * 0.5, 5, dict(T=0.35))

def carousel(sp, tau):
    x, y = 210, 820
    rot = tau * 1.5
    sp.ellipse((x - 120, y + 10, x + 120, y + 56), NAVY)
    sp.ellipse((x - 120, y, x + 120, y + 46), dict(Y=1, P=0.25))
    # horses (back half then front)
    items = []
    for i in range(10):
        a = rot + i / 10 * 2 * math.pi
        items.append((math.sin(a), a, i))
    def horse(a, i):
        hx = x + math.cos(a) * 96; hy = y + 18 + math.sin(a) * 18
        bob = math.sin(tau * 5 + i * 1.3) * 7
        sp.line([(hx, y - 90), (hx, hy)], dict(Y=1, P=0.3, N=0.2), 4)
        c = [PAPERW, PINK, TEAL][i % 3]
        sp.ellipse((hx - 16, hy - 40 + bob, hx + 16, hy - 26 + bob), c)
        sp.circle(hx + (12 if math.cos(a) < 0 else -12), hy - 46 + bob, 7, c)
    for s, a, i in sorted(items):
        if s < 0: horse(a, i)
    sp.rect((x - 16, y - 100, x + 16, y + 20), YEL)
    for s, a, i in sorted(items):
        if s >= 0: horse(a, i)
    # roof cone
    sp.ellipse((x - 128, y - 118, x + 128, y - 82), NAVY)
    for i in range(14):
        a0 = rot * 0.5 + i / 14 * 2 * math.pi; a1 = a0 + 2 * math.pi / 14
        p0 = (x + 128 * math.cos(a0), y - 100 + 18 * math.sin(a0))
        p1 = (x + 128 * math.cos(a1), y - 100 + 18 * math.sin(a1))
        if math.sin((a0 + a1) / 2) < -0.2: continue
        sp.poly([(x, y - 190), p0, p1], RED if i % 2 == 0 else PAPERW)
    for i in range(18):
        a = i / 18 * math.pi
        sp.circle(x + 126 * math.cos(a), y - 94 + 18 * math.sin(a), 9, YEL if i % 2 else PINK)
    flag(sp, x, y - 190, tau, TEAL, 22, 2)

def pirate(sp, tau):
    x, y = 780, 960
    px, py = x, 790
    ang = 0.75 * math.sin(tau * 2.0 + 0.6)
    def rot(dx, dy):
        c, s = math.cos(ang), math.sin(ang)
        return (px + dx * c - dy * s, py + dx * s + dy * c)
    for dx in (-110, 110):
        sp.line([(x + dx, y), (px, py)], NAVY, 10)
    sp.line([(px, py), rot(-60, 120)], NAVY, 6)
    sp.line([(px, py), rot(60, 120)], NAVY, 6)
    hull = [rot(-130, 92), rot(-90, 160), rot(90, 160), rot(130, 92), rot(70, 118), rot(-70, 118)]
    sp.poly(hull, RED)
    sp.poly([rot(-90, 160), rot(90, 160), rot(104, 140), rot(-104, 140)], NAVY)
    for k in range(-60, 61, 30):
        sp.circle(*rot(k, 136), 6, YEL)
    sp.line([rot(0, 118), rot(0, 30)], NAVY, 6)
    sp.poly([rot(4, 36), rot(66, 70), rot(4, 108)], PAPERW)
    w = math.sin(tau * 8) * 6
    sp.poly([rot(0, 30), rot(-34, 36 + w), rot(0, 46)], NAVY)
    for k in range(-64, 66, 16):
        sp.circle(*rot(k, 112), 6, NAVY)
    sp.circle(px, py, 12, YEL)

def stalls(sp, tau):
    for (x, y, spec) in [(390, 990, PINK), (680, 1000, TEAL), (110, 870, RED), (640, 690, YEL), (880, 700, PINK)]:
        sp.rect((x - 34, y - 34, x + 34, y), CREAM)
        sp.rect((x - 24, y - 26, x + 24, y - 14), NAVY)
        for i in range(6):
            x0 = x - 42 + i * 14
            sp.poly([(x0, y - 52), (x0 + 14, y - 52), (x0 + 14, y - 34), (x0 + 7, y - 28), (x0, y - 34)],
                    spec if i % 2 == 0 else PAPERW)

def trees(sp, lst):
    for (x, y, r, k) in lst:
        if 120 < y - 0 < 0: continue
        # skip trees on top of big rides/paths approx
        if (x - 210) ** 2 / 150 ** 2 + (y - 800) ** 2 / 80 ** 2 < 1: continue
        if (x - 780) ** 2 / 160 ** 2 + (y - 940) ** 2 / 80 ** 2 < 1: continue
        if (x - 530) ** 2 / 110 ** 2 + (y - 900) ** 2 / 60 ** 2 < 1: continue
        if x > 900 and y > 600: continue
        if (x - 200) ** 2 / 140 ** 2 + (y - 955) ** 2 / 60 ** 2 < 1: continue
        sp.line([(x, y), (x, y - r * 1.2)], NAVY, 5)
        sp.ellipse((x - r, y - r * 2.6, x + r, y - r * 0.6), DKGREEN if k > 0.4 else dict(Y=1, T=0.7, N=0.25))
        sp.ellipse((x - r * 0.55, y - r * 2.3, x + r * 0.1, y - r * 1.4), dict(Y=1, T=0.35))

def guests(sp, tau):
    for (pi, off, v, lat, spec) in GUESTS:
        pl = PATHS[pi]
        x, y = path_pos(pl, off + tau * v)
        x += lat; y += lat * 0.3
        step = math.sin((off + tau * v) * 0.5) * 2
        sp.circle(x, y - 14, 4, NAVY)
        sp.rect((x - 3, y - 10, x + 3, y - 1), spec)
        sp.line([(x - 1, y - 1), (x - 1 - step, y + 4)], NAVY, 2)

def gate(sp, tau):
    x, y = 540, 1032
    for dx in (-130, 130):
        sp.rect((x + dx - 22, y - 150, x + dx + 22, y), RED)
        sp.rect((x + dx - 22, y - 150, x + dx + 22, y - 130), NAVY)
        sp.poly([(x + dx - 32, y - 150), (x + dx + 32, y - 150), (x + dx, y - 210)], PINK if dx < 0 else TEAL)
        flag(sp, x + dx, y - 210, tau, YEL, 20, dx)
    pts = [(x - 130 + 260 * k / 20, y - 160 - 60 * math.sin(math.pi * k / 20)) for k in range(21)]
    sp.line(pts, NAVY, 24)
    sp.line([(a, b) for a, b in pts], YEL, 8)
    for i in range(10):
        k = (i + 0.5) / 10
        bx = x - 120 + 240 * k; by = y - 130 - 40 * math.sin(math.pi * k)
        w = math.sin(tau * 7 + i) * 4
        sp.poly([(bx - 10, by), (bx + 10, by), (bx + w, by + 24)], [PINK, TEAL, YEL, RED][i % 4])

def balloons(sp, tau):
    for (x, y, spec, ph, v) in BALLOONS:
        yy_ = y - tau * v
        xx_ = x + math.sin(tau * 1.5 + ph) * 10
        sp.line([(xx_, yy_ + 18), (xx_ + math.sin(tau * 3 + ph) * 4, yy_ + 46)], NAVY, 2)
        sp.ellipse((xx_ - 13, yy_ - 16, xx_ + 13, yy_ + 18), spec)
        sp.ellipse((xx_ - 7, yy_ - 10, xx_ - 2, yy_ - 2), PAPERW)

# ---------------------------------------------------------------- printing
def ink_cov(tone_img, k, off):
    t = np.asarray(tone_img, np.float32) / 255.0
    t = ndimage.gaussian_filter(t, 0.9)
    cov = np.clip((t + 0.13 * FINE[k] * (t > 0.02) - SCR[k]) * 3.2 + 0.5, 0, 1)
    cov[t < 0.02] = 0
    cov *= GRAINV[k]
    dx, dy = off
    if dx or dy:
        cov = ndimage.shift(cov, (dy, dx), order=1, mode='constant', cval=0)
    return cov

def composite(covs):
    out = PAPER.copy()
    for k in INKS:
        c = covs.get(k)
        if c is None: continue
        ink = np.array(INK_RGB[k], np.float32) / 255
        out *= 1 - c[..., None] * (1 - ink)
    return out

def stamp_state(t, k):
    """returns (visible_fraction_rows, offset) for layer k at time t."""
    t0 = STAMP_T[k]
    if t < t0: return 0.0, None
    a = t - t0
    wipe = min(1.0, a / 0.1)
    r = random.Random(hash(k) % 1000)
    ang = r.uniform(0, 2 * math.pi)
    amp = 16 * math.exp(-a * 9) * math.cos(a * 30)
    fo = FINAL_OFF[k]
    return wipe, (fo[0] + amp * math.cos(ang), fo[1] + amp * math.sin(ang))

def sheet_jolt(t):
    j = 0.0
    for k in INKS:
        a = t - STAMP_T[k]
        if 0 <= a < 0.5:
            j += 9 * math.exp(-a * 11) * math.sin(a * 42 + 0.4)
    return j

def tau_of(t):
    a = t - ALIVE_T
    if a <= 0: return 0.0
    r = 0.35
    return a * a / (2 * r) if a < r else a - r / 2

def render(f):
    t = f / FPS
    tau = tau_of(t)
    sp = Sep()
    draw_scene(sp, tau, t)
    covs = {}
    for k in INKS:
        wipe, off = stamp_state(t, k)
        if off is None: continue
        c = ink_cov(sp.im[k], k, (int(round(off[0])), int(round(off[1]))))
        if wipe < 1:
            cut = int(S * wipe)
            c[cut:] = 0
            # wet-ink smear line at the drum edge
            if 0 < cut < S - 3: c[cut - 3:cut] *= 1.0
        covs[k] = c
    img = composite(covs)
    img = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    im = Image.fromarray(img, 'RGB')
    # camera: jolt during stamps, slow push-in once alive
    j = sheet_jolt(t)
    push = 1.0 + 0.045 * ease((t - ALIVE_T) / (DUR - ALIVE_T))
    cx, cy = 560, 640
    a = 1 / push
    im = im.transform((S, S), Image.AFFINE, (a, 0, cx - a * cx, 0, a, cy - a * cy - j * a), resample=Image.BICUBIC,
                      fillcolor=(214, 206, 192))
    return im

if __name__ == '__main__':
    import time
    mode = sys.argv[1] if len(sys.argv) > 1 else 'test'
    os.makedirs('work', exist_ok=True)
    if mode == 'test':
        for fr in [int(x) for x in sys.argv[2:]] or [75]:
            t0 = time.time(); render(fr).save(f'work/riso_{fr:03d}.png'); print(fr, time.time() - t0)
    else:
        os.makedirs('work/frames_riso', exist_ok=True)
        a, b = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (0, int(DUR * FPS))
        for fr in range(a, b):
            render(fr).save(f'work/frames_riso/{fr:04d}.png')
