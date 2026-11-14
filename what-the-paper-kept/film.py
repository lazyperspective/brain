#!/usr/bin/env python3
"""
WHAT THE PAPER KEPT
an animated short drawn with soft pastel, compressed charcoal, wax pencil,
a fingertip, and one stick of sepia conte held on its side.

    act one    a small toned off-cut, worked until there is no room left on it
    act two    a large good sheet is laid over it
    act three  somebody rubs the large sheet with the side of a stick

usage:
    film.py a            render 0 .. T_COVER        (writes checkpoint for b)
    film.py b            render T_COVER .. T_RUB    (writes checkpoint for c)
    film.py c            render T_RUB .. end
    film.py stills a 5,12,20     full quality stills at those times
"""
import sys, os, json, math, time, subprocess
import numpy as np
import cv2
from engine import *

FPS = 24
W, H = 1920, 1080
SW, SH = 2112, 1188            # the small sheet (seen 1:1, the frame sits inside it)
OX, OY = 96, 54
BW, BH = 3840, 2160            # the big sheet
GC = (1050.0, 1570.0)          # where the small sheet lies beneath the big one
GA = -2.5
GS = 0.5

T_SHEET = 26.3                 # the big sheet begins to arrive
T_COVER = 29.4                 # nothing of the small sheet is visible any more
T_RUB = 64.0
T_PUSH = 65.5
T_CUT = 92.9
T_END = 94.4

WORK = os.environ.get('WPK_WORK', '/tmp/claude-0/-home-user-brain/f1f7475c-3827-5141-bc67-2671553b043a/scratchpad/wk')

# ------------------------------------------------------------------ pigments
A_BODY = [(0.56, 0.10, 0.19), (0.72, 0.20, 0.26), (0.45, 0.13, 0.30), (0.66, 0.15, 0.20), (0.80, 0.33, 0.33)]
A_LITE = [(0.90, 0.30, 0.34), (0.93, 0.45, 0.32), (0.86, 0.22, 0.36), (0.95, 0.56, 0.46)]
B_BODY = [(0.11, 0.15, 0.42), (0.19, 0.30, 0.62), (0.16, 0.20, 0.50), (0.24, 0.22, 0.48), (0.30, 0.44, 0.70)]
B_LITE = [(0.30, 0.52, 0.88), (0.22, 0.60, 0.80), (0.44, 0.42, 0.84), (0.62, 0.76, 0.93)]
GOLD = (0.97, 0.84, 0.50)
CREAM = (0.99, 0.94, 0.76)
VERM = (0.93, 0.27, 0.12)
YEL = (0.98, 0.78, 0.20)
BLACK = (0.07, 0.06, 0.065)
SVIO = (0.21, 0.12, 0.29)
VERD = (0.47, 0.82, 0.70)
VERD_W = (0.20, 0.66, 0.55)     # the same stick, on white
SEPIA = (0.50, 0.41, 0.35)
GRAPH = (0.30, 0.30, 0.32)

EASE = {
    'lin': lambda u: min(1.0, max(0.0, u)),
    'ease': ease,
    'out': ease_out,
    'in': ease_in,
}


# ------------------------------------------------------------------ scene kernel
class Mark:
    """one stroke. while the hand is still travelling it is redrawn each exposure up to
    wherever the stick has got to; when the hand lifts, it becomes part of the sheet."""

    def __init__(self, t0, dur, path, width, color, pp=None, prof=None, easing='lin',
                 dust_n=0, dust_col=None, seed=0, **kw):
        self.t0, self.dur = t0, dur
        self.path, self.width, self.color = path, width, color
        self.pp, self.prof, self.easing = pp, prof, easing
        self.dust_n, self.dust_col, self.seed = dust_n, dust_col, seed
        self.kw = kw
        self.done = False

    def draw(self, cv, C, t):
        u = (t - self.t0) / max(self.dur, 1e-6)
        i1 = max(2, int(len(self.path) * EASE[self.easing](u)))
        stroke(cv, C, self.path, self.width, self.color, pp=self.pp, prof=self.prof, i1=i1, commit=False, **self.kw)

    def commit(self, cv):
        stroke(cv, cv.C, self.path, self.width, self.color, pp=self.pp, prof=self.prof, commit=True, **self.kw)
        if self.dust_n:
            dust(cv, cv.C, self.path, self.width, self.dust_col or self.color, self.dust_n,
                 np.random.default_rng(self.seed))
        self.done = True


class Smudge:
    def __init__(self, t0, dur, path, radius, strength=0.55, soften=0.5):
        self.t0, self.dur, self.path, self.radius = t0, dur, path, radius
        self.strength, self.soften = strength, soften
        self.state = {}
        self.done = False

    def advance(self, cv, t):
        if self.done or t < self.t0:
            return
        u = min(1.0, (t - self.t0) / max(self.dur, 1e-6))
        i1 = int(len(self.path) * ease(u))
        smudge(cv, cv.C, self.path, self.radius, self.strength, self.soften, i1=i1, state=self.state)
        if u >= 1.0:
            self.done = True


class Erase:
    def __init__(self, t0, dur, path, width, residue=0.0, easing='lin'):
        self.t0, self.dur, self.path, self.width, self.residue = t0, dur, path, width, residue
        self.i = 0
        self.done = False
        self.easing = easing

    def advance(self, cv, t):
        if self.done or t < self.t0:
            return
        u = min(1.0, (t - self.t0) / max(self.dur, 1e-6))
        i1 = max(2, int(len(self.path) * EASE[self.easing](u)))
        if i1 > self.i + 1:
            erase(cv, cv.C, self.path, self.width, self.residue, i0=max(0, self.i - 2), i1=i1)
            self.i = i1
        if u >= 1.0:
            self.done = True


class Scene:
    def __init__(self, cv, seed, pan_w):
        self.cv = cv
        self.rng = np.random.default_rng(seed)
        self.marks, self.actions, self.lives = [], [], []
        self.snd, self.bumps = [], []
        self.pan_w = pan_w
        self.nseed = seed * 1000

    def r(self):
        self.nseed += 1
        return np.random.default_rng(self.nseed)

    def pan(self, path):
        return float(np.clip((path[:, 0].mean() / self.pan_w - 0.5) * 1.5, -1, 1))

    def sound(self, kind, t, dur, path=None, amp=1.0, **kw):
        e = dict(kind=kind, t=round(float(t), 4), dur=round(float(dur), 4), amp=round(float(amp), 3))
        if path is not None:
            e['pan'] = round(self.pan(path), 3)
            e['pan1'] = round(float(np.clip((path[-1, 0] / self.pan_w - 0.5) * 1.5, -1, 1)), 3)
            e['pan0'] = round(float(np.clip((path[0, 0] / self.pan_w - 0.5) * 1.5, -1, 1)), 3)
        e.update(kw)
        self.snd.append(e)

    # --- the tools -------------------------------------------------------------
    def pastel(self, t0, dur, ctrl, width, col, press=0.75, var=0.3, rough=0.5, point=0.4, tin=0.10,
               tout=0.16, f_in=0.2, f_out=0.1, wobble=4.0, wl=220, path=None, easing='lin', dust_n=None,
               snd='pastel', amp=None, pwl=90, **kw):
        rng = self.r()
        fam = kw.pop('fam', None)
        p = path if path is not None else hand(ctrl, rng, wobble=wobble, wl=wl)
        pp = pressure_profile(len(p), rng, tin, tout, var, pwl, f_in=f_in, f_out=f_out)
        prof = stick_profile(rng, max(4, width / 1.35), rough, point=point)
        kw.setdefault('soft', 0.2); kw.setdefault('haze', 0.06)
        m = Mark(t0, dur, p, width, col, pp, prof, easing, dust_n=(int(len(p) * width / 260) if dust_n is None else dust_n),
                 seed=self.nseed, press=press, **kw)
        self.marks.append(m)
        if snd:
            self.sound(snd, t0, dur, p, amp=(amp if amp is not None else press * min(1.6, 0.4 + width / 40)), fam=fam,
                       width=round(float(width), 1))
        return m

    def pencil(self, t0, dur, path, width, col, press=0.92, var=0.35, easing='lin', snd='pencil', amp=1.0,
               rate=0, **kw):
        rng = self.r()
        pp = pressure_profile(len(path), rng, 0.02, 0.05, var, 12, base=0.8)
        kw.setdefault('soft', 0.35); kw.setdefault('haze', 0.12)
        m = Mark(t0, dur, path, width, col, pp, None, easing, seed=self.nseed, press=press, **kw)
        self.marks.append(m)
        if snd:
            self.sound(snd, t0, dur, path, amp=amp, rate=rate)
        return m

    def charcoal(self, t0, dur, ctrl, width, col=BLACK, press=1.05, path=None, easing='lin', snd='charcoal',
                 amp=1.0, tout=0.08, base=0.85, wobble=3.0, wl=50, **kw):
        rng = self.r()
        p = path if path is not None else hand(ctrl, rng, wobble=wobble, wl=wl, tremor=0.8)
        pp = pressure_profile(len(p), rng, 0.03, tout, 0.35, 25, base=base)
        prof = stick_profile(rng, max(5, width / 1.3), 0.4, point=0.75)
        kw.setdefault('soft', 0.3); kw.setdefault('haze', 0.1)
        m = Mark(t0, dur, p, width, col, pp, prof, easing, dust_n=int(len(p) * 0.35), seed=self.nseed, press=press, **kw)
        self.marks.append(m)
        if snd:
            self.sound(snd, t0, dur, p, amp=amp)
        return m

    def step(self, t, render=True):
        cv = self.cv
        for m in self.marks:
            if not m.done and t >= m.t0 + m.dur:
                m.commit(cv)
        for a in self.actions:
            a.advance(cv, t)
        if not render:
            return None
        img = cv.live()
        for m in self.marks:
            if not m.done and t >= m.t0:
                m.draw(cv, img, t)
        for fn in self.lives:
            fn(cv, img, t)
        return img

    def finalize(self):
        self.marks.sort(key=lambda m: (m.t0 + m.dur, m.t0))


# ------------------------------------------------------------------ little path shapes
def zigzag(p0, p1, amp, n, rng, jit=0.22, spacing=1.5):
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d = p1 - p0; L = np.hypot(*d) + 1e-9
    nr = np.array([-d[1], d[0]]) / L
    pts = []
    for k in range(n + 1):
        u = k / n
        a = amp * (1 if k % 2 else -1) * (1 + rng.normal(0, jit))
        pts.append(p0 + d * (u + rng.normal(0, jit * 0.4 / n)) + nr * a)
    return hand(pts, rng, wobble=1.2, wl=28, spacing=spacing)


def loops(p0, p1, r, n, rng, spacing=1.5, grow=0.0):
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d = p1 - p0
    th = np.linspace(0, 2 * math.pi * n, n * 26)
    u = th / th[-1]
    rr = r * (1 + grow * u) * (1 + 0.18 * np.sin(th * 0.37 + rng.uniform(0, 6)))
    L = np.hypot(*d) + 1e-9
    ex = d / L; ey = np.array([-ex[1], ex[0]])
    q = p0[None] + d[None] * u[:, None] + ex[None] * (rr * np.sin(th))[:, None] + ey[None] * (rr * (1 - np.cos(th)) - rr)[:, None]
    q += rng.normal(0, 0.8, q.shape).cumsum(0) * 0.12
    return resample(q, spacing)


def scrawl(p0, p1, amp, cycles, rng, loop=0.0, sharp=0.7, spacing=1.5, wild=0.38):
    """a quick impatient line working its way from p0 to p1: zigzag when loop=0, curlicues when loop~1.
    nothing about it is even: the teeth change size, the pace changes, the whole thing drifts."""
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d = p1 - p0; L = np.hypot(*d) + 1e-9
    ex = d / L; ey = np.array([-ex[1], ex[0]])
    n = max(24, int(cycles * 44))
    u = np.linspace(0, 1, n)
    sp = np.clip(1 + smooth1d(rng, n, max(4, n / (cycles * 0.7 + 1)), 0.4), 0.3, 2.2)
    ph = np.cumsum(sp); ph = ph / ph[-1] * 2 * math.pi * cycles + rng.uniform(0, 6.28)
    am = amp * np.clip(1 + smooth1d(rng, n, 50, wild) + smooth1d(rng, n, 13, wild * 0.4), 0.25, 2.0)
    drift = smooth1d(rng, n, n / 2.5, amp * 0.35)
    tri = (2 / math.pi) * np.arcsin(np.sin(ph) * 0.985)
    lat = am * (sharp * tri + (1 - sharp) * np.sin(ph)) + drift
    lon = loop * am * np.cos(ph) * 0.95 + smooth1d(rng, n, n / 3, amp * 0.18)
    uu = u + smooth1d(rng, n, n / 3, 0.04) * (u * (1 - u) * 4)
    q = p0[None] + d[None] * uu[:, None] + ex[None] * lon[:, None] + ey[None] * lat[:, None]
    if sharp > 0.5 and loop < 0.3:
        return resample(q, spacing)
    return resample(catmull(q[::3], spacing), spacing)


def spiral(c, r, turns, rng, spacing=1.2, inward=False):
    th = np.linspace(0, 2 * math.pi * turns, int(40 * turns))
    u = th / th[-1]
    rr = r * (u if not inward else 1 - u * 0.9) * (1 + 0.12 * np.sin(th * 1.7 + rng.uniform(0, 6)))
    a0 = rng.uniform(0, 6.28)
    q = np.stack([c[0] + rr * np.cos(th + a0), c[1] + rr * np.sin(th + a0) * 0.9], 1)
    return resample(q, spacing)


def blot(c, rng, r=2.6):
    th = np.linspace(0, 5.0, 9)
    q = np.stack([c[0] + r * np.cos(th + rng.uniform(0, 6)) * rng.uniform(0.4, 1, 9),
                  c[1] + r * np.sin(th) * rng.uniform(0.4, 1, 9)], 1)
    return resample(q, 0.8)


def fr(pts):
    return [(x + OX, y + OY) for x, y in pts]


def small_to_big():
    """affine taking small-sheet canvas coordinates to big-sheet canvas coordinates"""
    a = math.radians(GA)
    c, s = math.cos(a) * GS, math.sin(a) * GS
    return np.array([[c, -s, GC[0] - c * SW / 2 + s * SH / 2], [s, c, GC[1] - s * SW / 2 - c * SH / 2]], np.float64)


def s2b(pts):
    M = small_to_big()
    p = np.asarray(pts, float)
    return p @ M[:, :2].T + M[:, 2]


# ================================================================== ACT ONE
# two families of long strokes, leaning across each other
A_BANDS = [dict(y=432 + i * 68, tilt=150 + (i % 3) * 14, xa=-90, xb=xb, bow=-26 + i * 3)
           for i, xb in enumerate([1990, 1760, 2000, 1650, 1930, 1560])]
B_BANDS = [dict(y=486 + j * 74, tilt=-172 + (j % 2) * 16, xa=xa, xb=2015, bow=30 - j * 3)
           for j, xa in enumerate([300, 120, 400, 210, 520])]
A_T = [2.2, 3.0, 4.4, 5.7, 7.1, 8.5]
B_T = [3.6, 5.0, 6.4, 7.8, 9.2]
PER_A, PER_B = 4.4, 5.3
PH_A, PH_B = 2.2, 3.6

TICK_X = [120 + 62 * k for k in range(6)]
RITUALS = [
    (4.6, [(900, 990), (1100, 1022), (760, 1010)]),
    (10.5, [(1180, 968), (990, 1030), (820, 978)]),
    (16.4, [(1270, 1004), (1090, 968), (700, 1024)]),
    (22.3, [(1040, 996), (1210, 1034), (860, 962)]),
    (28.2, [(950, 1018), (1130, 980), (780, 1030)]),
]
FENCE = [[(1396, 60), (1388, 330)], [(1404, 296), (1399, 585)], [(1389, 548), (1401, 820)], [(1409, 790), (1403, 1040)]]
GLOW_C = (610, 178)


def band_ctrl(b, dy=0.0, rng=None, xs=None, xe=None, jit=5.0):
    xa = b['xa'] if xs is None else xs
    xb = b['xb'] if xe is None else xe
    full = b['xb'] - b['xa']

    def yat(x):
        u = (x - b['xa']) / full
        return b['y'] + b['tilt'] * (2 * u - 1) - b['bow'] * math.sin(math.pi * u) + dy
    pts = []
    for x in np.linspace(xa, xb, 5):
        j = 0 if rng is None else rng.normal(0, jit)
        pts.append((x, yat(x) + j))
    return fr(pts)


def glow_strokes(rng, n=30):
    out = []
    for i in range(n):
        u = i / (n - 1) - 0.5
        cx = GLOW_C[0] + u * 330 + rng.normal(0, 6)
        hgt = 150 + 26 * math.sin(i * 0.9) + rng.normal(0, 14) - 60 * abs(u) ** 2
        cy = GLOW_C[1] + rng.normal(0, 10) + 16 * u
        out.append(dict(ctrl=fr([(cx + 36, cy - hgt / 2), (cx + rng.normal(0, 6), cy), (cx - 36, cy + hgt / 2)]),
                        width=rng.uniform(10, 21), cream=(rng.uniform() < 0.3),
                        press=rng.uniform(0.6, 0.9), seed=int(rng.integers(1, 1 << 30))))
    return out


def build_act1():
    base, Hh, crease = make_scrap(SW, SH, 11)
    # a place where nothing takes properly: an old greasy drag across the upper sheet
    yy, xx = np.mgrid[0:SH, 0:SW].astype(F32)
    rr = np.random.default_rng(77)
    gx, gy = GLOW_C[0] + OX + 62, GLOW_C[1] + OY
    along = (xx - gx) * 0.42 + (yy - gy) * 0.91
    across = (xx - gx) * 0.91 - (yy - gy) * 0.42
    wob = cv2.resize(gnoise(rr, SH // 8, SW // 8, 3), (SW, SH))
    dd = np.abs(across + wob * 12) + np.clip(np.abs(along) - 120, 0, None) * 0.5
    resist = (1.0 - 0.88 * (1 - sstep(16, 36, dd))).astype(F32)
    cv = Canvas(base, Hh, resist=resist)
    sc = Scene(cv, 101, SW)
    sc.crease = crease
    rng = sc.rng

    # ---- the unreliable gold patch: rubbed in first, never holds
    gs = glow_strokes(np.random.default_rng(5))
    for k, g in enumerate(gs):
        sc.pastel(0.7 + k * 0.036, 0.10, g['ctrl'], g['width'], CREAM if g['cream'] else GOLD, press=g['press'] * 0.9,
                  opacity=0.5, wobble=2, wl=60, tin=0.15, tout=0.2, snd=None, thick=1.7)
    sc.sound('hatch', 0.7, 1.15, np.array(fr([(450, 180), (770, 180)]), F32), amp=0.8, rate=26)
    fl_rng = np.random.default_rng(909)
    ndraw = int(31 * 12)
    level = np.ones(ndraw, F32)
    k = 0
    while k < ndraw:
        if fl_rng.uniform() < 0.10:
            L = fl_rng.choice([1, 1, 2, 3])
            level[k:k + L] = fl_rng.uniform(0.08, 0.5)
            k += L + int(fl_rng.integers(1, 4))
        else:
            level[k] = fl_rng.uniform(0.82, 1.0)
            k += 1
    for k in range(ndraw):          # authored: the opening stutter, and the re-rub
        t = k / 12
        if t < 1.9:
            level[k] = 0
        if 1.9 <= t < 3.2:
            level[k] = [1, 0.25, 1, 1, 0.1, 0.15, 1, 0.9, 0.3, 1, 1, 1, 0.2, 1, 1, 1][int((t - 1.9) * 12) % 16]
        if 19.0 <= t < 20.4:
            level[k] = max(level[k], 1.55 - (t - 19.0) * 0.4)
    sc.flicker = level
    sc.snd.append(dict(kind='flicker', t=0, dur=31, track=[round(float(v), 2) for v in level]))
    rr2 = np.random.default_rng(55)
    for k in range(12):
        g = gs[int(rr2.integers(4, len(gs) - 4))]
        sc.pastel(19.0 + k * 0.05, 0.10, g['ctrl'], g['width'] + 3, CREAM if k % 3 == 0 else GOLD, press=0.95,
                  opacity=0.5, wobble=3, wl=60, tin=0.15, tout=0.2, snd=None, thick=0.8)
    sc.sound('hatch', 19.0, 0.7, np.array(fr([(450, 180), (770, 180)]), F32), amp=1.0, rate=24)

    def live_glow(cv, img, t):
        k = min(ndraw - 1, int(t * 12 + 1e-6))
        lv = level[k]
        if lv <= 0.02:
            return
        r = np.random.default_rng(4000 + k // 2)
        nshow = int(round(len(gs) * min(1.0, lv)))
        idx = r.permutation(len(gs))[:nshow]
        for i in sorted(idx):
            g = gs[i]
            rg = np.random.default_rng(g['seed'] + (k // 2) * 7)
            p = hand(g['ctrl'], rg, wobble=2.4, wl=60)
            stroke(cv, img, p, g['width'], CREAM if g['cream'] else GOLD,
                   pp=pressure_profile(len(p), rg, 0.15, 0.2), prof=stick_profile(rg, 12, 0.5, point=0.3),
                   press=g['press'] * min(1.25, 0.55 + 0.5 * lv), opacity=min(1.0, 0.45 + 0.5 * lv), soft=0.2, haze=0.05)
    sc.lives.append(live_glow)

    # ---- the long strokes: two families that lean across each other
    def lay_band(b, T, body, fam):
        w = rng.uniform(48, 66)
        m = sc.pastel(T, 0.75, band_ctrl(b, rng=rng), w, body[int(rng.integers(0, len(body)))], press=0.50, var=0.25,
                      rough=0.6, point=0.0, tin=0.16, tout=0.22, f_in=0.0, f_out=0.0, wobble=6, wl=300, thick=0.5,
                      pwl=140, easing='ease', amp=0.9, fam=fam)
        # a palm follows, pressing the colour into the paper
        sc.actions.append(Smudge(T + 0.8, 0.7, m.path[int(len(m.path) * 0.06):int(len(m.path) * 0.94)], 30, 0.36, 0.5))
        for j in range(4):
            xs = b['xa'] + rng.uniform(-20, 170); xe = b['xb'] - rng.uniform(-20, 220)
            sc.pastel(T + 1.0 + 0.27 * j, 0.5, band_ctrl(b, dy=(j - 1.5) * 14 + rng.normal(0, 3), rng=rng, xs=xs, xe=xe),
                      rng.uniform(9, 22), body[int(rng.integers(0, len(body)))], press=rng.uniform(0.62, 0.9),
                      tin=0.12, f_in=0.05, tout=0.3, f_out=0.0, var=0.4, easing='ease', amp=0.6, fam=fam)

    for b, T in zip(A_BANDS, A_T):
        lay_band(b, T, A_BODY, 'A')
    for b, T in zip(B_BANDS, B_T):
        lay_band(b, T, B_BODY, 'B')
    # more threads through the rest of the act: the weave thickens
    t = 10.6
    k = 0
    while t < 24.6:
        fam = 'A' if k % 2 == 0 else 'B'
        bands = A_BANDS if fam == 'A' else B_BANDS
        b = bands[int(rng.integers(0, len(bands)))]
        cols = (A_BODY + A_LITE[:2]) if fam == 'A' else (B_BODY + B_LITE[:2])
        xs = b['xa'] + rng.uniform(0, 500); xe = b['xb'] - rng.uniform(0, 500)
        if not (16.2 < t < 18.2 or 22.1 < t < 24.0):
            sc.pastel(t, 0.55, band_ctrl(b, dy=rng.normal(0, 22), rng=rng, xs=xs, xe=xe), rng.uniform(8, 22),
                      cols[int(rng.integers(0, len(cols)))], press=rng.uniform(0.6, 0.88), tin=0.12, f_in=0.05,
                      tout=0.3, f_out=0.0, var=0.4, easing='ease', amp=0.5, fam=fam)
        t += rng.uniform(0.7, 1.4)
        k += 1

    # ---- breath: a bright thread travels each band, and leaves a little of itself behind
    breaths = []
    for fam, bands, Ts, per, ph, lite in (('A', A_BANDS, A_T, PER_A, PH_A, A_LITE), ('B', B_BANDS, B_T, PER_B, PH_B, B_LITE)):
        c = 0
        while ph + c * per < 31:
            tc = ph + c * per
            if tc < T_COVER + 1:
                sc.snd.append(dict(kind='breath' + fam, t=round(tc, 3), dur=per))
            for bi, (b, Tb) in enumerate(zip(bands, Ts)):
                if tc < Tb + 2.1:
                    continue
                rg = np.random.default_rng((1 if fam == 'A' else 2) * 100000 + bi * 1000 + c)
                for h in range(2):
                    p = hand(band_ctrl(b, dy=rg.normal(0, 16), rng=rg, jit=4), rg, wobble=5, wl=260)
                    if fam == 'B':
                        p = p[::-1].copy()
                    wd = rg.uniform(6, 13)
                    br = dict(t0=tc + 0.06 * bi + 0.12 * h, per=per, path=p, width=wd,
                              col=lite[int(rg.integers(0, len(lite)))],
                              pp=pressure_profile(len(p), rg, 0.1, 0.1, 0.45, 70),
                              prof=stick_profile(rg, wd / 1.3, 0.55, point=0.5), press=rg.uniform(0.62, 0.84))
                    breaths.append(br)
                    if tc + per < T_COVER and h == 0:
                        sc.marks.append(Mark(br['t0'] + per, 0.0, p, wd, br['col'], br['pp'], br['prof'],
                                             press=br['press'] * 0.66, opacity=0.2, soft=0.2, haze=0.02, thick=0.3))
            c += 1

    def live_breath(cv, img, t):
        for br in breaths:
            ph = (t - br['t0']) / br['per']
            if ph < 0 or ph >= 1:
                continue
            n = len(br['path'])
            i1 = int(n * ease(ph / 0.46))
            i0 = int(n * ease((ph - 0.36) / 0.64))
            if i1 - i0 < 3:
                continue
            swell = 0.75 + 0.25 * math.sin(math.pi * min(1.0, ph / 0.8))
            stroke(cv, img, br['path'], br['width'], br['col'], pp=br['pp'], prof=br['prof'], press=br['press'] * swell,
                   i0=i0, i1=i1, soft=0.2, haze=0.04)
    sc.lives.append(live_breath)

    # ---- the small quick line
    def kick(t, p0, p1, amp, n, dur=0.5, col=VERM, width=4.0, a=1.0, loop=0.0, sharp=0.75):
        p = scrawl(fr([p0])[0], fr([p1])[0], amp, n, sc.r(), loop=loop, sharp=sharp)
        sc.pencil(t, dur, p, width, col, indent=0.7, thick=0.15, amp=a, rate=n * 2 / dur)
        return p

    def ritual(k, T, taps):
        for j, (x, y) in enumerate(taps):
            p = blot(fr([(x, y)])[0], sc.r(), r=3.2)
            m = Mark(T + 0.4 * j, 0.04, p, 12, VERM, pressure_profile(len(p), sc.r(), 0, 0, 0.1, 5),
                     stick_profile(sc.r(), 9, 0.3, point=0.6), dust_n=12, seed=sc.nseed, press=1.25, soft=0.3, haze=0.2,
                     indent=0.95, thick=0.2)
            sc.marks.append(m)
            sc.sound('tap', T + 0.4 * j, 0.1, p, amp=1.0, idx=j, rit=k)
            sc.bumps.append((T + 0.4 * j, 0.5))
        if T + 1.4 > T_COVER:
            for _ in range(5):          # (keep the scene's dice exactly as they fell)
                sc.r()
            rng.normal(0, 14); rng.normal(0, 8)
            return          # the fifth time happens under the big sheet. the touches come; nothing answers them
        tx = TICK_X[k]
        p = hand(fr([(tx + 12, 968), (tx + 5, 1004), (tx, 1040)]), sc.r(), wobble=0.9, wl=30, spacing=1.0)
        m = Mark(T + 1.4, 0.16, p, 9.5, VERD, pressure_profile(len(p), sc.r(), 0.08, 0.2, 0.12, 12),
                 stick_profile(sc.r(), 8, 0.3, point=0.2), dust_n=16, seed=sc.nseed, press=1.08, soft=0.24, haze=0.2,
                 indent=1.0, thick=0.3)
        sc.marks.append(m)
        sc.sound('tick', T + 1.4, 0.16, p, amp=1.0, rit=k)
        sc.bumps.append((T + 1.4, 1.6))
        # and the small line cannot keep still about it
        lx, ly = taps[-1]
        kick(T + 1.78, (lx + 26, ly - 8), (lx + 120 + rng.normal(0, 14), ly - 30 + rng.normal(0, 8)), 15, 3.2, 0.4,
             col=YEL if k % 2 == 0 else VERM, width=3.4, a=0.75, loop=1.0, sharp=0.0)

    for k, (T, taps) in enumerate(RITUALS):
        ritual(k, T, taps)

    # kicking up into the long strokes, and being smoothed over
    kick(7.6, (1000, 930), (1150, 905), 26, 6, 0.5)
    kick(8.5, (1075, 905), (1110, 770), 30, 5.5, 0.5)
    sp = hand(band_ctrl(B_BANDS[3], dy=8, xs=880, xe=1330), sc.r(), wobble=6)
    sc.pastel(9.15, 0.8, None, 30, B_BODY[1], press=0.6, path=sp, easing='ease', amp=0.7, fam='B')
    sc.actions.append(Smudge(9.7, 0.9, hand(fr([(930, 850), (1080, 815), (1240, 780)]), sc.r(), wobble=6), 30, 0.5))
    sc.sound('smudge', 9.7, 0.9, sp, amp=0.8)

    # ---- the hard black line arrives and marks out its own side
    fence = [fr(seg) for seg in FENCE]
    for i, seg in enumerate(fence):
        sc.charcoal(12.6 + 0.2 * i, 0.17, seg, 8, indent=0.8, thick=0.3, amp=1.15, base=0.85, wobble=2.2, wl=120,
                    snd='slash')
        sc.bumps.append((12.6 + 0.2 * i, 1.6))

    def thicket(t, cx, cy, n, length, ang, col=BLACK, gap=13):
        r = sc.r()
        ca, sa = math.cos(ang), math.sin(ang)
        t0 = t
        pall = []
        for i in range(n):
            o = (i - (n - 1) / 2) * gap + r.normal(0, 3)
            c = np.array([cx + o * sa * 1.0 + r.normal(0, 5), cy - o * ca + r.normal(0, 5)])
            ln = length * r.uniform(0.6, 1.15)
            p0 = c - np.array([ca, sa]) * ln / 2; p1 = c + np.array([ca, sa]) * ln / 2
            if i % 2:
                p0, p1 = p1, p0
            m = sc.charcoal(t0, 0.055, fr([tuple(p0), tuple((p0 + p1) / 2 + r.normal(0, 3, 2)), tuple(p1)]), 6, col,
                            press=r.uniform(0.85, 1.05), snd=None, indent=0.6, thick=0.25, base=0.8, tout=0.3, wobble=1.5)
            pall.append(m.path)
            t0 += 0.062
        sc.sound('charhatch', t, n * 0.062, np.vstack(pall), amp=0.8, rate=1 / 0.062)

    for (t, cx, cy, n, ln, ang, col) in [
        (13.5, 1640, 150, 9, 150, 1.25, BLACK), (14.55, 1720, 230, 8, 140, 0.35, SVIO), (16.0, 1590, 250, 7, 130, 1.9, BLACK),
        (17.3, 1760, 140, 7, 120, 1.0, SVIO), (18.95, 1660, 210, 10, 170, 2.5, BLACK), (20.2, 1570, 130, 6, 120, 0.6, SVIO),
        (21.35, 1730, 190, 9, 160, 1.5, BLACK), (22.0, 1700, 120, 6, 130, 2.1, BLACK), (24.2, 1630, 270, 7, 150, 0.2, SVIO)]:
        thicket(t, cx, cy, n, ln, ang, col)

    def slash(t, y, x1, drop, press=1.05, w=7.5):
        p0 = (1452 + rng.normal(0, 8), y)
        p1 = (x1, y + drop)
        sc.charcoal(t, 0.17, fr([p0, ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + rng.normal(0, 12)), p1]), w, press=press,
                    indent=0.85, thick=0.3, tout=0.4, snd='slash', amp=press, wobble=2, base=0.82)
        sc.bumps.append((t, 2.4))

    def poke(t, y, reach, n, amp=22, dur=0.6, col=VERM, rise=-30):
        return kick(t, (1270, y), (1270 + reach, y + rise), amp, n, dur, col=col, loop=1.0, sharp=0.0, a=0.9)

    poke(13.9, 840, 210, 3)
    slash(14.35, 760, 1110, 150); slash(14.55, 820, 1170, 100)
    poke(14.95, 700, 380, 6, amp=28, dur=0.85, rise=-90)            # more and more ridiculous
    kick(15.3, (1480, 560), (1590, 500), 15, 4, 0.3, col=YEL, width=3.4, a=0.7)
    slash(15.62, 600, 1030, 200, 1.12, 8.5); slash(15.8, 660, 1090, 180, 1.12, 8.5); slash(15.98, 730, 1160, 120, 1.08)
    for i in (1, 2):
        sc.charcoal(16.05 + 0.14 * (i - 1), 0.14, fence[i], 9, indent=0.8, thick=0.3, amp=1.2, press=1.1, wobble=2.2,
                    wl=120, snd='slash')
    kick(18.3, (860, 925), (990, 880), 28, 5, 0.45)
    sc.actions.append(Smudge(18.75, 0.8, hand(fr([(800, 880), (950, 868), (1100, 846)]), sc.r(), wobble=6), 28, 0.45))
    sc.sound('smudge', 18.75, 0.8, np.array(fr([(800, 880), (1100, 846)]), F32), amp=0.7)
    poke(19.45, 900, 280, 5, amp=24, dur=0.7, rise=-50)
    slash(19.9, 840, 1150, 130, 1.1, 8.5); slash(20.06, 880, 1210, 90)
    kick(21.0, (1150, 935), (1270, 950), 24, 4.5, 0.4)
    kick(21.5, (560, 960), (700, 935), 20, 4, 0.4, col=YEL, width=3.4, a=0.7)
    poke(24.4, 560, 230, 4, amp=20, dur=0.5)
    slash(24.8, 520, 1140, 120, 1.02)
    # a turning-over: the red family shifts all at once, a rag passes
    for j in range(5):
        b = A_BANDS[1 + j]
        sc.pastel(20.45 + j * 0.11, 0.55, band_ctrl(dict(b, tilt=b['tilt'] + 26), dy=rng.normal(0, 8), rng=rng,
                                                    xs=b['xa'] + rng.uniform(100, 500), xe=b['xb'] - rng.uniform(0, 300)),
                  rng.uniform(14, 26), A_BODY[int(rng.integers(0, 5))], press=0.8, tout=0.3, f_out=0.0, easing='ease',
                  amp=0.7, fam='A')
    rp = hand(fr([(240, 470), (700, 610), (1150, 700), (1580, 830)]), sc.r(), wobble=14, wl=300)
    sc.actions.append(Smudge(20.7, 1.25, rp, 42, 0.42, 0.4))
    sc.sound('smudge', 20.7, 1.25, rp, amp=1.2)
    for j in range(3):
        b = B_BANDS[1 + j]
        sc.pastel(21.75 + j * 0.12, 0.5, band_ctrl(dict(b, tilt=b['tilt'] - 22), dy=rng.normal(0, 8), rng=rng,
                                                   xs=b['xa'] + rng.uniform(200, 500), xe=b['xb'] - rng.uniform(100, 400)),
                  rng.uniform(12, 22), B_BODY[int(rng.integers(0, 5))], press=0.78, tout=0.3, f_out=0.0, easing='ease',
                  amp=0.6, fam='B')

    # the black line never sits still: it is retraced, impatiently, every other exposure
    def live_fence(cv, img, t):
        if t < 13.45:
            return
        k = int(t * 12 + 1e-6) // 2
        rg = np.random.default_rng(7000 + k)
        calm = 1.0 if not (16.3 < t < 18.3 or 22.2 < t < 24.2) else 0.4
        for seg in fence:
            q = [(x + rg.normal(0, 3.0), y + rg.normal(0, 7)) for x, y in seg]
            p = hand(q, rg, wobble=2.4, wl=120, tremor=0.9)
            stroke(cv, img, p, 7, BLACK, pp=pressure_profile(len(p), rg, 0.03, 0.08, 0.45, 25, base=0.78),
                   prof=stick_profile(rg, 6, 0.4, point=0.75), press=0.98, opacity=0.6 * calm, soft=0.3, haze=0.05)
    sc.lives.append(live_fence)
    sc.finalize()
    return sc


# ================================================================== rendering
class Writer:
    def __init__(self, path, crf=16):
        self.p = subprocess.Popen(
            ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
             '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p',
             '-g', '24', '-bf', '2', '-movflags', '+faststart', '-colorspace', 'bt709', '-color_primaries', 'bt709',
             '-color_trc', 'bt709', path], stdin=subprocess.PIPE)

    def write(self, frame):
        self.p.stdin.write(frame.tobytes())

    def close(self):
        self.p.stdin.close()
        self.p.wait()


def bump_at(sc, t):
    b = 0.0
    for (tb, a) in sc.bumps:
        if tb <= t < tb + 0.17:
            b = max(b, a * (1 - (t - tb) / 0.17))
    return b


def big_sheet():
    f = os.path.join(WORK, 'sheet.npz')
    if os.path.exists(f):
        z = np.load(f)
        return z['base'], z['H']
    base, Hh = make_sheet(BW, BH, 21)
    np.savez(f, base=base, H=Hh)
    return base, Hh


def slide_state(t):
    """the big sheet being pushed into place: three pushes of a hand"""
    s = 0.40 * ease((t - T_SHEET) / 0.95) + 0.37 * ease((t - T_SHEET - 1.08) / 0.85) + 0.23 * ease((t - T_SHEET - 2.05) / 0.95)
    c0 = np.array([2130.0, -230.0]); c1 = np.array([-760.0, 1560.0])
    c = c0 + (c1 - c0) * s
    th = math.radians(5.5) * (1 - s) ** 1.5
    return s, c, th


def grade_act1(t):
    return dict(warmth=0.55, exposure=1.0, lamp=1.0)


def render_a(stills=None, start=0.0):
    sc = build_act1()
    cam = Rostrum(W, H, seed=5)
    tex_close, _ = make_sheet(2304, 1296, 22)
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    n_frames = int(round(T_COVER * FPS))
    wr = None if stills else Writer(os.path.join(WORK, 'seg_a.mp4' if start == 0 else 'seg_a2.mp4'))
    img = None
    t_start = time.time()
    last_small = None
    for f in range(n_frames):
        t = f / FPS
        want = ((stills is None) or any(abs(t - s) < 0.5 / FPS for s in stills)) and t >= start - 1e-6
        if f % 2 == 0:
            vis = t < T_COVER - 0.05
            if want:
                img = sc.step(t, render=True)
                last_small = img
            else:
                sc.step(t, render=False)
            cam.new_exposure(weave=0.7, flicker=0.013, bump=bump_at(sc, t))
        if not want:
            continue
        shot = cam.shoot(img, SW / 2, SH / 2, 1.0)
        g = grade_act1(t)
        if t >= T_SHEET:
            s, c, th = slide_state(t)
            n1 = np.array([math.cos(th), math.sin(th)]); nu = np.array([math.sin(th), -math.cos(th)])
            d1 = (xx - c[0]) * n1[0] + (yy - c[1]) * n1[1]
            d2 = (xx - c[0]) * nu[0] + (yy - c[1]) * nu[1]
            d = np.minimum(d1, d2)
            cover = np.clip(d + 0.5, 0, 1)
            lift = 1 - s
            cs = c + np.array([7.0, 13.0]) * (0.35 + lift)
            db = (xx - cs[0]) * nu[0] + (yy - cs[1]) * nu[1]          # below the bottom edge: the cast shadow
            dl = (xx - cs[0]) * n1[0] + (yy - cs[1]) * n1[1]
            shadow = 1 - 0.52 * np.exp(np.minimum(db, 0) / (12 + 36 * lift)) * (db < 0) * sstep(-30, 10, dl) * (0.5 + 0.5 * lift)
            shadow = shadow * (1 - 0.22 * np.exp(np.minimum(d1, 0) / 5.0) * (d1 < 0) * (d2 > 0))
            off = c - np.array([-760.0, 1560.0])
            tex = cam.shoot(tex_close, 1152, 648, 1.0, shift=(off[0], off[1]), border=cv2.BORDER_REFLECT)
            under = cv2.GaussianBlur(shot, (0, 0), 7)
            k = 0.13 + 0.11 * s
            sheet = tex * ((1 - k) + k * under * 1.9)
            sheet = np.minimum(sheet, tex)
            edge = np.exp(-((d - 1.5) / 1.6) ** 2) * 0.10
            comp = shot * shadow[..., None] * (1 - cover[..., None]) + (sheet - edge[..., None]) * cover[..., None]
            # exposure follows what the lens is filled with
            wmix = ease((t - T_SHEET - 0.3) / 2.6)
            out = cam.develop(comp, warmth=0.55 - 0.70 * wmix, exposure=1.0 + 0.02 * wmix, lamp=1.0 - 0.5 * wmix)
        else:
            out = cam.develop(shot, **g)
        if stills:
            cv2.imwrite(os.path.join(WORK, f'still_a_{t:06.2f}.png'), out[..., ::-1])
        else:
            wr.write(out)
            if f % 48 == 0:
                print(f'a {t:6.2f}s  {time.time() - t_start:6.1f}s elapsed', flush=True)
    if wr:
        wr.close()
    # what the big sheet now lies on
    if start == 0:
        np.savez(os.path.join(WORK, 'ckpt_a.npz'), C=last_small if last_small is not None else sc.cv.C, Tp=sc.cv.Tp,
                 Tn=sc.cv.Tn, H=sc.cv.H, crease=sc.crease)
    print('act one done', time.time() - t_start)


# ================================================================== ACTS TWO AND THREE
def bg(pts):
    return [(2.0 * x, 2.0 * y) for x, y in pts]


ARC = {
    'A': ([(110, 345), (430, 232), (850, 205), (1250, 292)], [(205, 478), (360, 418), (520, 408), (650, 446)]),
    'B': ([(1385, 565), (1500, 452), (1640, 340), (1765, 248)], [(470, 528), (640, 462), (790, 452), (905, 506)]),
}
PAPER_W = (0.95, 0.94, 0.91)
S_NEW = (0.36, 0.24, 0.62)        # the black line, when it comes back, has changed its colour
GROWN = (0.66, 0.23, 0.15)        # the quick line, behaving itself
T_YEARS = 53.4
YEAR = 0.72


def mixc(c, f, to=PAPER_W):
    return tuple(c[i] * (1 - f) + to[i] * f for i in range(3))


def arc_ctrl(kind, s, dy=0.0, rng=None, jit=3.0):
    p0, p1 = ARC[kind]
    out = []
    for (x0, y0), (x1, y1) in zip(p0, p1):
        j = 0 if rng is None else rng.normal(0, jit)
        out.append((x0 + (x1 - x0) * s, y0 + (y1 - y0) * s + dy + j))
    return bg(out)


def build_act23():
    sbase, sH = big_sheet()
    z = np.load(os.path.join(WORK, 'ckpt_a.npz'))
    scrap = Canvas(z['C'], z['H'])
    scrap.Tp = z['Tp']; scrap.Tn = z['Tn']
    em = torn_mask(SW, SH, 5)
    rel, foot, M = build_relief(scrap, z['crease'], em, GS, BW, BH, GC[0], GC[1], GA)
    big = Canvas(sbase, sH, relief=rel)
    sc = Scene(big, 202, BW)
    rng = sc.rng
    # what shows through the sheet from below
    U = cv2.GaussianBlur(z['C'], (0, 0), 7)
    Ub = cv2.warpAffine(U, M, (BW, BH), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=(1, 1, 1))
    ys, xs = np.where(foot > 0.001)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    sc.under = ((slice(y0, y1), slice(x0, x1)), Ub[y0:y1, x0:x1].copy(),
                cv2.GaussianBlur(foot, (0, 0), 3)[y0:y1, x0:x1, None].copy())
    del Ub

    arcs = {'A': [], 'B': []}       # (t_from, t_to, main path)

    def draw_arc(T, kind, s, n=5, pale=0.0, dur=1.5, thin=1.0, amp=0.9, graphite=False, stag=0.3):
        body = A_BODY if kind == 'A' else B_BODY
        lite = A_LITE if kind == 'A' else B_LITE
        cols = [body[1], body[0], lite[3], body[4], lite[0]]
        widths = [34, 20, 14, 12, 9]
        offs = [0, 19, -17, 31, -29]
        paths = []
        if graphite:
            g = sc.pencil(T - 0.9, 1.1, hand(arc_ctrl(kind, s, dy=-27, rng=rng), sc.r(), wobble=3, wl=500, spacing=2.0), 3.2,
                          GRAPH, press=0.62, var=0.25, amp=0.35, rate=0, easing='ease', mode='multiply')
            paths.append(g.path)
        for j in range(n):
            m = sc.pastel(T + j * dur * stag, dur, arc_ctrl(kind, s, dy=offs[j] * 0.5, rng=rng), widths[j] * thin,
                          mixc(cols[j], pale), press=0.86 - 0.3 * pale, var=0.22, wobble=5, wl=420, tin=0.1, tout=0.22,
                          f_in=0.1, f_out=0.0, easing='ease', amp=amp * (1 - 0.5 * pale), fam=kind, pwl=200,
                          thick=0, snd='arc')
            paths.append(m.path)
        if arcs[kind]:
            arcs[kind][-1][1] = T
        arcs[kind].append([T + dur * 0.8, 1e9, paths[1 if graphite else 0], pale])
        return paths

    def erase_paths(T, paths, dur=0.22, width=44, snd=True):
        for p in paths:
            sc.actions.append(Erase(T, dur, p, width))
        if snd:
            sc.sound('erase', T, dur, paths[0], amp=0.6)

    # ---- the first marks on the good sheet: long, sure, unhurried
    pa = draw_arc(32.9, 'A', 0.0, graphite=True)
    pb = draw_arc(34.5, 'B', 0.0, graphite=True)
    # a tint rubbed under each, as light as breath on glass
    for k, (cx, cy, col, hw) in enumerate([(680, 300, (0.985, 0.93, 0.70), 330), (1640, 470, (0.80, 0.88, 0.965), 150)]):
        T = 36.2 + 0.7 * k
        for j in range(2):
            c = bg([(cx - hw, cy + 26 * j - 6), (cx, cy + 26 * j - 22), (cx + hw, cy + 26 * j + 10)])
            m = sc.pastel(T + 0.3 * j, 0.5, c, 150, col, press=0.44, var=0.2, rough=0.6, point=0.0, tin=0.25, tout=0.25,
                          f_in=0, f_out=0, wobble=10, wl=500, opacity=0.85, haze=0.03, thick=0, pwl=300, easing='ease',
                          amp=0.35, snd='veil')
            sc.actions.append(Smudge(T + 0.3 * j + 0.55, 0.7, m.path[20:-20], 66, 0.5, 0.6))
        sc.sound('smudge', T + 0.6, 1.0, m.path, amp=0.5)
    # the black line: fine now, a long way off to the right
    s_main = []
    for i, seg in enumerate([[(1861, 470), (1857, 670)], [(1863, 650), (1859, 866)]]):
        m = sc.charcoal(37.6 + 0.3 * i, 0.26, bg(seg), 6.5, BLACK, press=0.95, wobble=2.5, wl=200, amp=0.6, snd='slash', base=0.8)
        s_main.append(m.path)

    # ---- the quick line finds it has all this room
    lp1 = scrawl(bg([(1110, 835)])[0], bg([(1545, 765)])[0], 180, 4.2, sc.r(), loop=1.0, sharp=0.0, spacing=2.0, wild=0.3)
    sc.pencil(38.4, 1.8, lp1, 6.5, VERM, press=0.95, amp=1.0, rate=5, easing='ease')
    lp2 = scrawl(bg([(1530, 800)])[0], bg([(1180, 905)])[0], 110, 3.0, sc.r(), loop=1.0, sharp=0.0, spacing=2.0, wild=0.3)
    sc.pencil(40.3, 0.8, lp2, 6, YEL, press=0.95, amp=0.9, rate=8)
    # it kicks, the way it used to. nothing is there to kick
    k1 = scrawl(bg([(1120, 640)])[0], bg([(1165, 520)])[0], 56, 5, sc.r(), spacing=2.0)
    sc.pencil(41.5, 0.45, k1, 6, VERM, press=0.95, amp=1.0, rate=22)
    k2 = scrawl(bg([(1190, 630)])[0], bg([(1210, 560)])[0], 36, 3.5, sc.r(), spacing=2.0)
    sc.pencil(42.5, 0.35, k2, 6, VERM, press=0.8, amp=0.7, rate=20)
    # ---- the three touches... and nothing
    tap2 = [(905, 880), (985, 948), (860, 960)]
    for j, (x, y) in enumerate(tap2):
        p = blot(bg([(x, y)])[0], sc.r(), r=4.5)
        sc.marks.append(Mark(43.6 + 0.4 * j, 0.04, p, 18, VERM, pressure_profile(len(p), sc.r(), 0, 0, 0.1, 5),
                             stick_profile(sc.r(), 10, 0.3, point=0.6), dust_n=10, seed=sc.nseed, press=1.25, soft=0.3, haze=0.15))
        sc.sound('tap', 43.6 + 0.4 * j, 0.1, p, amp=1.0, idx=j, rit=6)
        sc.bumps.append((43.6 + 0.4 * j, 0.5))
    # (the tick is due at 45.0. it does not come.)
    erase_paths(46.3, [k1], 0.35, 150)
    erase_paths(46.75, [k2], 0.3, 110)
    # late, and twice, and too much
    for j, (x, y) in enumerate([(1180, 400), (1222, 410)]):
        p = hand(bg([(x + 9, y - 30), (x + 3, y), (x, y + 30)]), sc.r(), wobble=1.2, wl=50, spacing=1.0)
        sc.marks.append(Mark(48.0 + 0.13 * j, 0.14, p, 15, VERD_W, pressure_profile(len(p), sc.r(), 0.08, 0.2, 0.1, 15),
                             stick_profile(sc.r(), 11, 0.3, point=0.2), dust_n=20, seed=sc.nseed, press=1.3, soft=0.22, haze=0.2))
        sc.sound('tick2', 48.0 + 0.13 * j, 0.14, p, amp=1.0, idx=j)
        sc.bumps.append((48.0 + 0.13 * j, 2.2))
    # the quick line starts toward them, gets a third of the way, and leaves a full stop
    pl = hand(bg([(952, 902), (1004, 850), (1040, 792)]), sc.r(), wobble=1.5, wl=80, spacing=2.0)
    sc.pencil(49.1, 0.6, pl, 5.5, VERM, press=0.8, amp=0.5, rate=0, easing='out')

    # ---- it tidies itself away
    erase_paths(50.3, [lp1], 0.9, 34)
    erase_paths(50.7, [lp2], 0.6, 34)
    blocks = []

    def block(T, cx, cy, rows, cols, cw, ch, col=GROWN, step=0.036, width=4.5, busy=0.0, snd=True):
        r = sc.r()
        strokes = []
        t = T
        for i in range(rows):
            for j in range(cols):
                x = cx + (j - (cols - 1) / 2) * cw + r.normal(0, cw * 0.06)
                y = cy + (i - (rows - 1) / 2) * ch * 1.5 + r.normal(0, ch * 0.04)
                p = hand(bg([(x + 1.5, y - ch / 2), (x, y + ch / 2)]), r, wobble=0.8, wl=60, spacing=1.5)
                m = sc.pencil(t, step * 0.9, p, width, col, press=0.9, snd=None, var=0.2)
                strokes.append(m.path)
                t += step
        if snd:
            sc.sound('neat', T, t - T, np.vstack(strokes), amp=0.7, rate=1 / step)
        # the lines an eraser would follow to take the whole block away
        rowsp = [np.array(bg([(cx - cols * cw / 2 - 6, cy + (i - (rows - 1) / 2) * ch * 1.5),
                              (cx + cols * cw / 2 + 6, cy + (i - (rows - 1) / 2) * ch * 1.5)]), F32) for i in range(rows)]
        rowsp = [resample(q, 4) for q in rowsp]
        blk = dict(t0=t, t1=1e9, strokes=strokes, rows=rowsp, ch=ch, busy=busy, col=col, width=width, cx=cx, cy=cy)
        blocks.append(blk)
        return blk, t

    blk, tb = block(51.0, 1400, 720, 3, 10, 22, 30)
    # the black line asks, in its way. no answer
    spur = sc.charcoal(51.7, 0.4, bg([(1856, 700), (1812, 712), (1772, 728)]), 5.5, BLACK, press=0.8, wobble=2, wl=100,
                       amp=0.4, snd='slash', base=0.7, easing='out')
    # ---- and then it goes
    erase_paths(52.9, s_main + [spur.path], 0.2, 30)
    q = []
    for i, seg in enumerate([[(1897, 480), (1893, 860)]]):
        m = sc.charcoal(53.15, 0.2, bg(seg), 6, BLACK, press=0.9, wobble=2.5, wl=200, amp=0.5, snd='slash', base=0.8)
        q.append(m.path)
    erase_paths(53.7, q, 0.2, 30)
    m = sc.charcoal(53.9, 0.2, bg([(1921, 490), (1918, 860)]), 6, BLACK, press=0.85, wobble=2.5, wl=200, amp=0.35, snd='slash', base=0.8)
    erase_paths(54.4, [m.path], 0.2, 30)

    # ---- years. everything is redrawn a little further off, a little paler
    cur = {'A': pa, 'B': pb}
    NY = 10
    blk_pos = {1: (1470, 600, 3, 9, 20, 27), 3: (1570, 440, 3, 8, 17, 23), 5: (1650, 290, 4, 8, 14, 18), 7: (1695, 190, 4, 9, 12, 15)}
    for y in range(NY):
        T = T_YEARS + 1.4 + YEAR * y
        s_ = ease_out((y + 1) / NY, 1.6)
        pale = 0.5 * (y + 1) / NY
        for kind, dT in (('A', 0.0), ('B', 0.38)):
            erase_paths(T + dT, cur[kind], 0.2, 56, snd=(y % 2 == 0))
            cur[kind] = draw_arc(T + dT + 0.16, kind, s_, n=max(2, 5 - (y + 1) // 2), pale=pale, dur=0.3, stag=0.1,
                                 thin=1.0 - 0.3 * (y + 1) / NY, amp=0.5)
        if y in blk_pos:
            cx, cy, rw, cl, cw, ch = blk_pos[y]
            for rp in blk['rows']:
                sc.actions.append(Erase(T + 0.1, 0.18, rp, blk['ch'] * 2 + 16))
            blk['t1'] = T + 0.1
            sc.sound('erase', T + 0.1, 0.18, blk['rows'][0], amp=0.4)
            blk, tb = block(T + 0.3, cx, cy, rw, cl, cw, ch, step=0.012, width=4.0, busy=0.15 + 0.07 * y)
    blk_final = blk

    def visit(T, reach, y, stay, answer=True):
        p = scrawl(bg([(1935, y)])[0], bg([(1935 - reach, y - 14)])[0], 34, max(1.5, reach / 70), sc.r(), loop=1.0, sharp=0.0, spacing=2.0)
        sc.pencil(T, 0.42, p, 5, S_NEW, press=0.95, amp=0.8, rate=10, easing='out')
        ps = [p]
        if answer:
            bx, by = blk_at(T)
            q = hand(bg([(bx + 30, by + 60), ((bx + 1935 - reach) / 2, (by + 60 + y + 40) / 2 + 8), (1935 - reach - 20, y + 44)]), sc.r(), wobble=2, wl=100, spacing=2.0)
            sc.pencil(T + 0.3, 0.3, q, 4.5, GROWN, press=0.9, amp=0.7, rate=0, easing='out')
            # they run side by side for a little way, not touching
            q2 = hand(bg([(1935 - reach - 14, y + 46), (1935 - reach * 0.45, y + 40)]), sc.r(), wobble=1.5, wl=100, spacing=2.0)
            sc.pencil(T + 0.62, 0.22, q2, 4.5, GROWN, press=0.85, amp=0.5, rate=0)
            ps += [q, q2]
        erase_paths(T + stay, ps, 0.25, 90)

    def blk_at(T):
        b = [bb for bb in blocks if bb['t0'] <= T + 0.5]
        return (b[-1]['cx'], b[-1]['cy'])

    visit(T_YEARS + 1.4 + YEAR * 2.2, 240, 560, 1.15)
    visit(T_YEARS + 1.4 + YEAR * 5.4, 150, 470, 0.85)
    visit(T_YEARS + 1.4 + YEAR * 8.3, 70, 380, 0.6, answer=False)

    def dots(T, p0, p1, n, col, back=0):
        r = sc.r()
        ps = []
        for i in range(n):
            u = (i + 0.5) / n
            x = p0[0] + (p1[0] - p0[0]) * u + r.normal(0, 3); y = p0[1] + (p1[1] - p0[1]) * u + r.normal(0, 3) - 40 * math.sin(math.pi * u)
            p = blot(bg([(x, y)])[0], r, r=2.5)
            sc.marks.append(Mark(T + 0.07 * i, 0.03, p, 8, col, pressure_profile(len(p), r, 0, 0, 0.1, 5),
                                 stick_profile(r, 6, 0.3, point=0.6), seed=sc.nseed, press=1.1, soft=0.3, haze=0.1))
            ps.append(p)
        sc.sound('dots', T, 0.07 * n, np.vstack(ps), amp=0.5, n=n)
        line = resample(np.vstack([q.mean(0, keepdims=True) for q in ps]), 4)
        sc.actions.append(Erase(T + 0.07 * n + 0.55, 0.25, line, 26))

    dots(T_YEARS + 1.4 + YEAR * 3.6, (1540, 430), (900, 420), 9, GROWN)
    dots(T_YEARS + 1.4 + YEAR * 4.3, (860, 440), (1180, 430), 4, mixc(A_BODY[1], 0.25))
    dots(T_YEARS + 1.4 + YEAR * 6.7, (1610, 300), (900, 440), 8, GROWN)
    dots(T_YEARS + 1.4 + YEAR * 9.0, (1660, 210), (1100, 400), 5, GROWN)

    # ---- the long strokes still breathe, each on its own now
    def live_arcs(cv, img, t):
        for kind, per, lite in (('A', PER_A, A_LITE), ('B', PER_B, B_LITE)):
            cur_ = None
            for a_ in arcs[kind]:
                if a_[0] <= t < a_[1] - 0.05:
                    cur_ = a_
            if cur_ is None:
                continue
            pale = cur_[3]
            per2 = per * (1.0 + 1.6 * pale)
            c = int((t - 30.0) / per2)
            ph = (t - 30.0) / per2 - c
            path = cur_[2]
            n = len(path)
            i1 = int(n * ease(ph / 0.46)); i0 = int(n * ease((ph - 0.36) / 0.64))
            if i1 - i0 < 4:
                continue
            rg = np.random.default_rng((3 if kind == 'A' else 4) * 100000 + c)
            off = rg.normal(0, 7)
            p = (path + np.array([0, off], F32)).astype(F32)
            if kind == 'B':
                p = p[::-1].copy(); 
            stroke(cv, img, p, 10, mixc(lite[3], 0.15 + pale * 0.6), pp=pressure_profile(n, rg, 0.1, 0.1, 0.35, 120),
                   prof=stick_profile(rg, 8, 0.5, point=0.5), press=0.72 - 0.2 * pale, i0=i0, i1=i1, soft=0.2, haze=0.03)
    sc.lives.append(live_arcs)
    for kind, per in (('A', PER_A), ('B', PER_B)):
        t = 30.0
        while t < T_CUT:
            pale = 0.0 if t < T_YEARS + 1.4 else min(0.5, 0.5 * (t - T_YEARS - 1.4) / (YEAR * NY))
            per2 = per * (1.0 + 1.6 * pale)
            if t > 34.5:
                sc.snd.append(dict(kind='arc' + kind, t=round(t, 3), dur=round(per2, 3), pale=round(pale, 2)))
            t += per2

    # the tidy block is always busy
    def live_block(cv, img, t):
        k = int(t * 12 + 1e-6)
        for b in blocks:
            if b['busy'] <= 0 or not (b['t0'] <= t < b['t1']):
                continue
            rg = np.random.default_rng(31000 + k)
            n = len(b['strokes'])
            for i in rg.permutation(n)[:max(1, int(n * b['busy']))]:
                p = b['strokes'][i] + rg.normal(0, 1.2, 2).astype(F32)
                stroke(cv, img, p, b['width'], b['col'], pp=np.ones(len(p), F32) * 0.9, press=0.95, soft=0.35, haze=0.1)
    sc.lives.append(live_block)

    # ================================================= ACT THREE: the rubbing
    def rub(T, dur, a, b_, press=0.5, width=112, opacity=0.5, small=True, amp=1.0, easing='ease'):
        r = sc.r()
        if small:
            a = tuple(s2b([fr([a])[0]])[0]); b_ = tuple(s2b([fr([b_])[0]])[0])
        mid = ((a[0] + b_[0]) / 2 + r.normal(0, 8), (a[1] + b_[1]) / 2 + r.normal(0, 8))
        p = hand([a, mid, b_], r, wobble=7, wl=300)
        pp = pressure_profile(len(p), r, 0.14, 0.14, 0.2, 150, f_in=0.3, f_out=0.3)
        m = Mark(T, dur, p, width, SEPIA, pp, stick_profile(r, 72, 0.3, edge=0.5), easing, seed=sc.nseed, press=press,
                 opacity=opacity, soft=0.2, haze=0.015, mode='multiply', rub=True, rub_mix=0.72, thick=0, load=0.15)
        sc.marks.append(m)
        sc.sound('rub', T, dur, p, amp=amp * press / 0.5)
        return m

    # idle at first: a hand with time on it, under the two pale strokes
    t = T_RUB
    x = -140
    k = 0
    idle = [0.44, 0.40, 0.38, 0.36, 0.34, 0.34, 0.38]
    for d in idle:                               # entirely on bare paper, above the small sheet's edge
        a_, b_ = (x + 170, -380 + rng.normal(0, 14)), (x, -90 + rng.normal(0, 14))
        if k % 2:
            a_, b_ = b_, a_
        rub(t, d * 0.82, a_, b_, press=0.54, amp=0.8)
        t += d; x += 96; k += 1
    # it wanders lower. something catches
    t += 0.25
    x = 80
    for d in (0.42, 0.44, 0.5):
        a_, b_ = (x + 170, -200 + rng.normal(0, 14)), (x, 190 + rng.normal(0, 14))
        if k % 2:
            a_, b_ = b_, a_
        rub(t, d * 0.82, a_, b_, press=0.54, amp=0.9)
        t += d; x += 88; k += 1
    sc.t_catch = t
    # ... (it stops) ...
    t += 1.4
    # and now it means it: top band, left to right
    x = -230
    n1 = 25
    for i in range(n1):
        d = 0.185 + 0.03 * math.sin(i * 0.8) + (0.12 if i in (0, 1) else 0)
        a_, b_ = (x + 190, -130 + rng.normal(0, 22)), (x - 40, 610 + rng.normal(0, 16))
        if k % 2:
            a_, b_ = b_, a_
        rub(t, d * 0.86, a_, b_, press=0.52)
        t += d; x += 72; k += 1
    t += 0.7
    # lower band, right to left, slowing
    n2 = 25
    x = 1520
    found = set()
    for i in range(n2):
        slow = ease((i - (n2 - 9)) / 7.0)
        d = 0.185 + 0.22 * slow
        a_, b_ = (x + 170, 540 + rng.normal(0, 16)), (x - 30, 1235 + rng.normal(0, 24))
        if k % 2:
            a_, b_ = b_, a_
        rub(t, d * 0.86, a_, b_, press=0.52 + 0.04 * slow, amp=1.0 - 0.3 * slow)
        for kk in range(4):                      # each old tick, as the stick first passes over it
            if kk not in found and x - 10 <= TICK_X[kk] + 6:
                found.add(kk)
                sc.snd.append(dict(kind='ghostnote', t=round(t + d * 0.62, 3), dur=0.2, idx=kk, pan=-0.3))
        t += d; x -= 72; k += 1
    sc.t_rub_end = t

    # ---- the quick line comes back. it has to come a long way
    T = t + 1.5
    bx, by = blk_final['cx'], blk_final['cy']
    end = s2b([fr([(1640, 150)])[0]])[0]
    q = hand([(2 * bx - 40, 2 * by + 70), (2 * bx - 500, 2 * by + 330), ((2 * bx + end[0]) / 2 - 80, (2 * by + end[1]) / 2 + 60),
              (end[0] + 240, end[1] - 110), tuple(end)], sc.r(), wobble=16, wl=520, spacing=2.0)
    sc.pencil(T, 2.0, q, 5, VERM, press=0.9, amp=0.8, rate=0, easing='out')
    # the three touches, where they always went
    T2 = T + 2.5
    for j, (x_, y_) in enumerate(RITUALS[0][1]):
        p = blot(s2b([fr([(x_, y_)])[0]])[0], sc.r(), r=3.3)
        sc.marks.append(Mark(T2 + 0.5 * j, 0.04, p, 12, VERM, pressure_profile(len(p), sc.r(), 0, 0, 0.1, 5),
                             stick_profile(sc.r(), 7, 0.3, point=0.6), dust_n=8, seed=sc.nseed, press=1.25, soft=0.3, haze=0.15))
        sc.sound('tap', T2 + 0.5 * j, 0.1, p, amp=0.9, idx=j, rit=9)
        sc.bumps.append((T2 + 0.5 * j, 0.5))
    # and one more, set down past the gap where the fifth never came
    T3 = T2 + 1.8
    tx = TICK_X[5]
    p = hand([tuple(v) for v in s2b(fr([(tx + 12, 968), (tx + 5, 1004), (tx, 1040)]))], sc.r(), wobble=0.5, wl=30, spacing=0.8)
    sc.marks.append(Mark(T3, 0.16, p, 6.5, VERD_W, pressure_profile(len(p), sc.r(), 0.08, 0.2, 0.1, 12),
                         stick_profile(sc.r(), 5, 0.3, point=0.2), dust_n=8, seed=sc.nseed, press=1.15, soft=0.24, haze=0.2))
    sc.sound('tick', T3, 0.16, p, amp=0.8, rit=9)
    sc.bumps.append((T3, 1.4))
    # it starts to say something, the old way
    T4 = T3 + 1.15
    full = scrawl(s2b([fr([(800, 985)])[0]])[0], s2b([fr([(1392, 800)])[0]])[0], 36, 5.2, sc.r(), loop=1.0, sharp=0.0, spacing=1.5, wild=0.3)
    n = int(len(full) * 0.86)
    part = full[:n].copy()
    pp = pressure_profile(n, sc.r(), 0.02, 0.0, 0.3, 14, base=0.85)
    fade = 1 - 0.80 * sstep(0.30, 1.0, np.linspace(0, 1, n))
    m = Mark(T4, 2.1, part, 4.5, VERM, (pp * fade).astype(F32), None, 'out', seed=sc.nseed, press=0.95, soft=0.35, haze=0.1)
    sc.marks.append(m)
    sc.sound('pencil', T4, 2.1, part, amp=0.8, rate=4, fade=1)
    sc.t_last = T4 + 2.1
    sc.finalize()
    return sc


def cam_big(t):
    z0, z1 = 2.0, 0.5
    if t < T_PUSH:
        u = ease((t - T_COVER - 0.1) / 4.2)
        z = z0 * (z1 / z0) ** u
        w = (1 / z - 1 / z0) / (1 / z1 - 1 / z0)
        return GC[0] + (BW / 2 - GC[0]) * w, GC[1] + (BH / 2 - GC[1]) * w, z, math.radians(-GA) * (1 - u)
    u = ease((t - T_PUSH) / 18.5)
    zf = 1.0
    z = 0.5 * (zf / 0.5) ** u
    w = (1 / z - 2.0) / (1 / zf - 2.0)
    F = (1300.0, 1465.0)
    z2 = z * (1 + 0.035 * ease((t - T_PUSH - 17.0) / 10.0))
    return BW / 2 + (F[0] - BW / 2) * w, BH / 2 + (F[1] - BH / 2) * w, z2, 0.0


def under_k(t):
    return 0.016 + 0.224 * (1 - ease((t - T_COVER - 0.4) / 5.8))


def grade_big(t):
    years = ease((t - T_YEARS) / 8.0)
    return dict(warmth=-0.15 + 0.27 * years, exposure=1.02, lamp=0.5 - 0.15 * ease((t - T_COVER) / 4))


def exposure_big(t):
    """(weave, flicker): the camera holds its breath when the drawing does"""
    if T_YEARS + 1.2 < t < T_YEARS + 1.6 + YEAR * 10:
        return 1.1, 0.026
    if T_RUB - 1.8 < t < T_RUB or t > T_CUT - 3.4:
        return 0.35, 0.007
    return 0.6, 0.011


def render_bc(seg, stills=None):
    sc = build_act23()
    cam = Rostrum(W, H, seed=6 if seg == 'b' else 7)
    tex_close, _ = make_sheet(2304, 1296, 22)
    t_lo, t_hi = (T_COVER, T_RUB) if seg == 'b' else (T_RUB, T_END)
    if seg == 'c':
        z = np.load(os.path.join(WORK, 'ckpt_b.npz'))
        sc.cv.C[:] = z['C']; sc.cv.L[:] = z['L']
        for m in sc.marks:
            if m.t0 + m.dur <= T_RUB:
                m.done = True
        for a in sc.actions:
            if a.t0 + a.dur <= T_RUB:
                a.done = True
    f_lo, f_hi = int(round(t_lo * FPS)), int(round(t_hi * FPS))
    wr = None if stills else Writer(os.path.join(WORK, f'seg_{seg}.mp4'))
    roi, U, foot = sc.under
    img = None
    t_start = time.time()
    for f in range(f_lo, f_hi):
        t = f / FPS
        if t >= T_CUT:
            if wr:
                wr.write(np.zeros((H, W, 3), np.uint8))
            continue
        want = (stills is None) or any(abs(t - s) < 0.5 / FPS for s in stills)
        if f % 2 == 0 or img is None:
            if want:
                img = sc.step(t, render=True)
                k = under_k(t)
                img[roi] *= 1 - foot * (1 - np.minimum(1.0, (1 - k) + k * U * 1.9))
            else:
                sc.step(t, render=False)
            wv, fl = exposure_big(t)
            cam.new_exposure(weave=wv, flicker=fl, bump=bump_at(sc, t))
        if not want:
            continue
        cx, cy, zm, rot = cam_big(t)
        shot = cam.shoot(img, cx, cy, zm, rot)
        if zm > 1.05:
            wgt = float(sstep(1.05, 1.7, zm))
            close = cam.shoot(tex_close, 1152, 648, zm / 2.0, rot - math.radians(-GA))
            kk = under_k(t)
            uu = cam.shoot(U, (GC[0] - roi[1].start), (GC[1] - roi[0].start), zm, rot, border=cv2.BORDER_CONSTANT, border_value=(1, 1, 1))
            close = close * np.minimum(1.0, (1 - kk) + kk * uu * 1.9)
            shot = shot + (close - shot) * wgt
        out = cam.develop(shot, **grade_big(t))
        if stills:
            cv2.imwrite(os.path.join(WORK, f'still_{seg}_{t:06.2f}.png'), out[..., ::-1])
        else:
            wr.write(out)
            if f % 48 == 0:
                print(f'{seg} {t:6.2f}s  {time.time() - t_start:6.1f}s elapsed', flush=True)
    if wr:
        wr.close()
    if seg == 'b':
        np.savez(os.path.join(WORK, 'ckpt_b.npz'), C=sc.cv.C, L=sc.cv.L)
    print(seg, 'done', time.time() - t_start, 'catch', sc.t_catch, 'rub_end', sc.t_rub_end, 'last', sc.t_last)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'stills':
        seg = sys.argv[2]
        ts = [float(x) for x in sys.argv[3].split(',')]
        ts = [round(t * FPS / 2) * 2 / FPS for t in ts]
        if seg == 'a':
            render_a(stills=ts)
        else:
            render_bc(seg, stills=ts)
    elif mode == 'events':
        sc = build_act1()
        json.dump(sc.snd, open(os.path.join(WORK, 'snd_a.json'), 'w'))
        sc = build_act23()
        json.dump(sc.snd, open(os.path.join(WORK, 'snd_b.json'), 'w'))
        json.dump(dict(t_catch=sc.t_catch, t_rub_end=sc.t_rub_end, t_last=sc.t_last, T_SHEET=T_SHEET, T_COVER=T_COVER,
                       T_RUB=T_RUB, T_CUT=T_CUT, T_END=T_END, T_YEARS=T_YEARS, YEAR=YEAR, PER_A=PER_A, PER_B=PER_B,
                       A_T=A_T, B_T=B_T), open(os.path.join(WORK, 'times.json'), 'w'))
        print('events written', len(sc.snd))
    elif mode == 'a':
        render_a()
    elif mode == 'a2':
        render_a(start=26.0)
    else:
        render_bc(mode)
