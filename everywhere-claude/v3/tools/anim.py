# Animation helpers: easing, keyframe tracks, body spring (bodyDyn), tail cloth sim, blinks, stepping.
import numpy as np, math

FPS = 30.0
BW, BH, BD, FOOT = 14, 13, 16, 3
TOP = FOOT + BH
KNOT = np.array([-BW / 2 + 1.0, TOP - 2.1, -BD / 2 - 0.5])


def clamp(x, a, b): return max(a, min(b, x))
def smooth(a, b, x):
    t = clamp((x - a) / (b - a), 0, 1) if b != a else float(x >= a)
    return t * t * (3 - 2 * t)
EASE = {
    'lin': lambda u: u,
    'io': lambda u: u * u * (3 - 2 * u),
    'in': lambda u: u ** 2.2,
    'out': lambda u: 1 - (1 - u) ** 2.6,
    'out3': lambda u: 1 - (1 - u) ** 3,
    'back': lambda u: 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,     # overshoot
    'hold': lambda u: 0.0,
    'snap': lambda u: 1.0 if u > 0 else 0.0,
    'elastic': lambda u: 1 - math.exp(-6 * u) * math.cos(10 * u) if u < 1 else 1.0,
}


class Track:
    """keys: [(t, value, ease_into_this_key)] ; value scalar or list"""
    def __init__(self, keys):
        self.k = sorted(keys, key=lambda k: k[0])

    def __call__(self, t):
        k = self.k
        if t <= k[0][0]: return np.array(k[0][1], float) if isinstance(k[0][1], (list, tuple)) else k[0][1]
        for a, b in zip(k, k[1:]):
            if t <= b[0]:
                u = (t - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 1
                e = EASE[b[2] if len(b) > 2 else 'io'](u)
                va, vb = np.array(a[1], float), np.array(b[1], float)
                r = va + (vb - va) * e
                return r if r.shape else float(r)
        v = k[-1][1]
        return np.array(v, float) if isinstance(v, (list, tuple)) else v


def step_track(keys):
    """discrete values: [(t, value)] -> value of the last key <= t"""
    ks = sorted(keys, key=lambda k: k[0])
    def f(t):
        v = ks[0][1]
        for tk, vk in ks:
            if t >= tk: v = vk
        return v
    return f


def blink_open(t, seed=0, period=(1.6, 3.2), dur=0.16, extra=()):
    """eyelid open 0..1 with random natural blinks + forced blinks at times in extra"""
    rng = np.random.default_rng(seed)
    times, x = [], -rng.uniform(0, 1.5)
    while x < 60:
        times.append(x); x += rng.uniform(*period)
    times += list(extra)
    o = 1.0
    for b in times:
        d = t - b
        if 0 <= d <= dur:
            o = min(o, abs(d / dur * 2 - 1) ** 0.7)
    return o


def rotY(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rotX(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rotZ(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def body_R(yaw, pitch=0, roll=0):
    """same as three.js Euler YXZ"""
    return rotY(yaw) @ rotX(pitch) @ rotZ(roll)


def body_dyn(pos, yaw, extra_lean=None, k_lean=0.028, k_sq=0.0016, f_lean=3.2, z_lean=0.32, f_sq=4.5, z_sq=0.3,
             impulses=(), dt=1 / FPS):
    """damped springs driven by the root acceleration (in 'surface space', char units). pos: (N,3), yaw: (N,) deg.
    returns lean (N,2) [x,z local], squash (N,). impulses: [(frame, dlean_x, dlean_z, dsquash_vel)]"""
    N = len(pos); pos = np.asarray(pos, float)
    vel = np.gradient(pos, dt, axis=0); acc = np.gradient(vel, dt, axis=0)
    # smooth acceleration a bit (finite differences of keyed motion are spiky)
    from scipy.ndimage import gaussian_filter1d
    acc = gaussian_filter1d(acc, 1.0, axis=0)
    lean = np.zeros((N, 2)); sq = np.zeros(N)
    L = np.zeros(2); Lv = np.zeros(2); S = 0.0; Sv = 0.0
    wl, ws = 2 * math.pi * f_lean, 2 * math.pi * f_sq
    imp = {}
    for f, a, b, c in impulses: imp.setdefault(int(f), []).append((a, b, c))
    for i in range(N):
        R = yaw[i] if np.ndim(yaw[i]) == 2 else rotY(yaw[i]); al = R.T @ acc[i]
        tgt = -np.array([al[0], al[2]]) * k_lean
        tS = -al[1] * k_sq   # upward accel (landing) -> squash
        for a, b, c in imp.get(i, []):
            Lv += [a, b]; Sv += c
        for _ in range(4):
            h = dt / 4
            Lv += (-wl * wl * (L - tgt) - 2 * z_lean * wl * Lv) * h; L += Lv * h
            Sv += (-ws * ws * (S - tS) - 2 * z_sq * ws * Sv) * h; S += Sv * h
        ln = L + (extra_lean[i] if extra_lean is not None else 0)
        ln = np.clip(ln, -4.2, 4.2)
        lean[i] = ln; sq[i] = clamp(S, -0.26, 0.24)
    return lean, sq


class Tails:
    """two headband tails (7 and 6 segments) as verlet chains in surface space. Shape springs keep the designed
    'stream back and droop' look; air drag from the relative wind makes them react to motion; flutter noise."""
    def __init__(self, seg=1.85, n=(7, 6), anchor=None, rest=None, push='back'):
        self.seg, self.n = seg, n
        self.p = None; self.anchor = KNOT if anchor is None else np.asarray(anchor, float); self.rest = rest; self.push = push

    def rest_dirs(self, j):
        if self.rest is not None:
            d = np.asarray(self.rest[j], float); return d / np.linalg.norm(d)
        # local rest direction for chain j: back (-z), slightly outward, drooping
        out = -0.35 if j == 0 else 0.45
        d = np.array([out * 0.35 - 0.25, -0.55, -1.0])
        return d / np.linalg.norm(d)

    def step(self, t, root, R, wind=np.zeros(3), dt=1 / FPS, sub=6, gust=1.0, gravity=40.0, k_shape=55.0, drag=3.2, D=None):
        """root: surface position of the hero root (3,), R: 3x3 local->surface rotation. returns local tail points (rel. to knot)."""
        knot = root + R @ self.anchor
        if self.p is None:
            self.p = []
            for j, n in enumerate(self.n):
                d = R @ self.rest_dirs(j)
                pts = np.array([knot + d * self.seg * i for i in range(n + 1)])
                self.p.append([pts.copy(), pts.copy()])
        out = []
        for j, n in enumerate(self.n):
            P, Pp = self.p[j]
            for s in range(sub):
                h = dt / sub; tt = t + s * h
                P[0] = knot
                vel = (P - Pp) / h
                rest = R @ self.rest_dirs(j)
                acc = np.zeros_like(P)
                acc[:, 1] -= gravity
                # flutter: travelling wave along the chain, perpendicular-ish
                ph = np.arange(n + 1)
                flut = np.stack([np.sin(tt * 17 - ph * 0.85 + j * 1.9) * 0.6, np.sin(tt * 13 - ph + j) * 0.45, np.cos(tt * 11 - ph * 0.7 + j) * 0.3], 1) * gust
                w = wind[None, :] + flut * (6 + 0.35 * np.linalg.norm(wind))
                acc += drag * (w - vel)
                for i in range(1, n + 1):
                    tgt = P[i - 1] + rest * self.seg
                    acc[i] += k_shape * (tgt - P[i]) * (1.0 - 0.05 * i)
                Pn = P + (P - Pp) * 0.985 + acc * h * h
                Pn[0] = knot
                for _ in range(6):
                    for i in range(1, n + 1):
                        d = Pn[i] - Pn[i - 1]; L = np.linalg.norm(d) + 1e-9
                        Pn[i] = Pn[i - 1] + d / L * self.seg
                # keep out of the body (local box)
                loc = (Pn - root) @ R
                inside = (np.abs(loc[:, 0]) < BW / 2 + 0.6) & (loc[:, 1] > FOOT - 0.5) & (loc[:, 1] < TOP + 0.6) & (np.abs(loc[:, 2]) < BD / 2 + 0.6)
                inside[0] = False
                if inside.any():
                    if self.push == 'back': loc[inside, 2] = np.minimum(loc[inside, 2], -BD / 2 - 0.6)
                    else:   # nearest face (x or z)
                        px = BW / 2 + 0.6 - np.abs(loc[inside, 0]); pz = BD / 2 + 0.6 - np.abs(loc[inside, 2])
                        lx = loc[inside, 0].copy(); lz = loc[inside, 2].copy()
                        lx = np.where(px < pz, np.sign(lx) * (BW / 2 + 0.6), lx); lz = np.where(px >= pz, np.sign(lz) * (BD / 2 + 0.6), lz)
                        loc[inside, 0] = lx; loc[inside, 2] = lz
                    Pn = root + loc @ R.T
                Pp[:] = P; P[:] = Pn
            loc = (P - root) @ R - self.anchor
            out.append([[round(float(x), 3) for x in q] for q in loc])
        return out


def step_phase(dist, stride=7.0):
    return dist / stride


SCARF_KNOT = np.array([BW / 2 + 0.2, FOOT + 2.1, BD / 2 + 0.2])


def Scarf():
    """the two short ends of the red winter scarf, hanging from the knot on the front-right corner"""
    return Tails(seg=1.3, n=(3, 2), anchor=SCARF_KNOT, rest=[(0.35, -1.0, 0.45), (0.75, -1.0, 0.15)], push='near')


class Wear:
    """headband tails + scarf ends driven together (same surface motion / wind)"""
    def __init__(self):
        self.tails = Tails(); self.scarf = Scarf()

    def step(self, t, root, R, wind=np.zeros(3), gust=1.0, **kw):
        a = self.tails.step(t, root, R, wind=wind, gust=gust, **kw)
        b = self.scarf.step(t, root, R, wind=wind * 0.8, gust=gust * 0.7, k_shape=kw.get('k_shape', 55.0) * 0.8)
        return a, b


def blinks(t, seed=0, base=(1.4, 3.0), double=0.3, extra=(), dur=0.14):
    """livelier natural blinks: random intervals, some double-blinks, plus forced ones"""
    rng = np.random.default_rng(seed); times = []; x = -rng.uniform(0, 1.2)
    while x < 60:
        times.append(x)
        if rng.uniform() < double: times.append(x + dur + 0.07)
        x += rng.uniform(*base)
    return blink_open(t, seed, extra=list(times) + list(extra), period=(1e6, 1e6 + 1), dur=dur) if False else _bo(t, times + list(extra), dur)


def _bo(t, times, dur):
    o = 1.0
    for b in times:
        d = t - b
        if 0 <= d <= dur: o = min(o, abs(d / dur * 2 - 1) ** 0.7)
    return o


def sweat(t, t0, dur=0.7):
    """sweat drop life 0..1 starting at t0"""
    if t < t0 or t > t0 + dur: return 0.0
    return (t - t0) / dur


def anticip(t, t0, d=0.12):
    """anticipation dip before an action at t0 (0..1..0 bump ending at t0)"""
    if t0 - d <= t <= t0: return math.sin(math.pi * (t - (t0 - d)) / d)
    return 0.0


def settle(t, t0, amp=1.0, f=7.0, z=5.0):
    """overshoot-and-settle oscillation after a stop at t0"""
    if t < t0: return 0.0
    d = t - t0; return amp * math.exp(-z * d) * math.sin(2 * math.pi * f * d)
