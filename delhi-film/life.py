"""Everything that moves once the stones are set: traffic, metro, birds, kites, flags, steam...
All of it is drawn as loose inlay pieces sliding over the slab (with small cast shadows)."""
import math
import numpy as np
from scene import MATS, MAT, PI, WW, WH, stroke_poly, petal_pts, ell_pts, figure
import city

P_ON, P_OFF = 132., 728.


def sm(t):
    t = min(1., max(0., t))
    return t * t * (3 - 2 * t)


def env(f, d=0., d2=0.):
    return sm((f - P_ON - d) / 12.) * (1 - sm((f - P_OFF - d2) / 12.))


def col(m, var=0, shade=1.):
    c = MATS[MAT[m]]['cols']
    c = c[var % len(c)]
    return (min(255., c[0] * shade), min(255., c[1] * shade), min(255., c[2] * shade))


CIRC8 = ell_pts(0, 0, 1, 1, 8)
CIRC12 = ell_pts(0, 0, 1, 1, 12)


class Out:
    def __init__(self, cam):
        self.items = []
        self.steam = []
        cx, cy, z = cam
        self.x0, self.x1 = cx - WW / (2 * z) - 90, cx + WW / (2 * z) + 90
        self.y0, self.y1 = cy - WH / (2 * z) - 90, cy + WH / (2 * z) + 90

    def vis(self, x, y, r=0.):
        return self.x0 - r < x < self.x1 + r and self.y0 - r < y < self.y1 + r

    def poly(self, pts, m, var=0, h=0., shade=1.):
        self.items.append((np.asarray(pts, np.float32), MAT[m], col(m, var, shade), h))

    def tf(self, pts, x, y, s=1., rot=0., flip=1., m='WHT', var=0, h=0., shade=1.):
        p = np.asarray(pts, np.float32) * (s * flip, s)
        if rot:
            c, sn = math.cos(rot), math.sin(rot)
            p = np.stack([p[:, 0] * c - p[:, 1] * sn, p[:, 0] * sn + p[:, 1] * c], 1)
        self.items.append((p + (x, y), MAT[m], col(m, var, shade), h))

    def dot(self, x, y, r, m, var=0, h=0., shade=1., ry=None):
        self.items.append((CIRC8 * (r, ry or r) + (x, y), MAT[m], col(m, var, shade), h))

    def line(self, pts, w, m, var=0, h=0., shade=1.):
        L, R = stroke_poly(pts, w)
        self.items.append((np.concatenate([L, R[::-1]], 0), MAT[m], col(m, var, shade), h))


# ----------------------------------------------------------------------------- vehicles (side view, facing +x, origin = road contact)
def auto(o, x, y, rot, flip, s, var=0):
    k = dict(x=x, y=y, s=s, rot=rot, flip=flip, h=.1)
    o.tf([(-8.5, -2), (7.5, -2), (9, -5.2), (6.5, -6.6), (-8.5, -6.6)], m='JAD' if var % 3 else 'MAL', var=var, **k)
    o.tf([(-8.5, -6.6), (-8.5, -10.4), (-6.8, -13), (1.5, -13), (4.6, -11.4), (6.5, -6.6)], m='AMB', var=var, **k)
    o.tf([(-2.6, -11), (1.6, -11), (4.2, -7.2), (-2.6, -7.2)], m='ONX', **k)
    o.tf(CIRC8 * 2.3 + (-5, -1.6), m='ONX', **k)
    o.tf(CIRC8 * 2.3 + (5.6, -1.6), m='ONX', **k)
    o.tf(CIRC8 * .9 + (-5, -1.6), m='GRY', **k)
    o.tf(CIRC8 * .9 + (5.6, -1.6), m='GRY', **k)


def bus(o, x, y, rot, flip, s, var=0):
    k = dict(x=x, y=y, s=s, rot=rot, flip=flip, h=.1)
    o.tf([(-19, -2.2), (19, -2.2), (19, -8), (-19, -8)], m='RED' if var % 2 else 'MAL', var=2, **k)
    o.tf([(-19, -8), (19, -8), (18.2, -13.6), (-18.6, -13.6)], m='CRM', **k)
    for i in range(6):
        o.tf([(-16.5 + i * 5.6, -8.8), (-12.3 + i * 5.6, -8.8), (-12.3 + i * 5.6, -12.4), (-16.5 + i * 5.6, -12.4)], m='SLT', var=1, **k)
    o.tf([(-19, -5.6), (19, -5.6), (19, -4.6), (-19, -4.6)], m='AMB', **k)
    for wx in (-11.5, 11.5):
        o.tf(CIRC8 * 2.6 + (wx, -1.8), m='ONX', **k)
        o.tf(CIRC8 * 1. + (wx, -1.8), m='GRY', **k)


def car(o, x, y, rot, flip, s, var=0):
    k = dict(x=x, y=y, s=s, rot=rot, flip=flip, h=.1)
    m = ['WHT', 'SLT', 'COR', 'CRM', 'LAP'][var % 5]
    o.tf([(-10, -2), (10, -2), (10.4, -5.6), (6.5, -6.4), (4.5, -9.8), (-4.8, -9.8), (-7, -6.4), (-10.2, -5.8)], m=m, var=var, **k)
    o.tf([(-4.2, -9), (-.4, -9), (-.4, -6.5), (-5.8, -6.5)], m='ONX', **k)
    o.tf([(.6, -9), (4, -9), (5.6, -6.5), (.6, -6.5)], m='ONX', **k)
    if var % 5 == 0:
        o.tf(CIRC8 * 1.1 + (0, -10.6), m='COR', **k)      # lal batti
    for wx in (-5.6, 5.8):
        o.tf(CIRC8 * 2.2 + (wx, -1.6), m='ONX', **k)
        o.tf(CIRC8 * .9 + (wx, -1.6), m='GRY', **k)


def rick(o, x, y, rot, flip, s, f, var=0):
    k = dict(x=x, y=y, s=s, rot=rot, flip=flip, h=.1)
    for wx in (-6, 6.5):
        o.tf(CIRC12 * 3.6 + (wx, -3.2), m='ONX', **k)
        o.tf(CIRC12 * 2.5 + (wx, -3.2), m='SLT', var=2, **k)
        a = f * .5
        o.tf([(wx - 2.4 * math.cos(a), -3.2 - 2.4 * math.sin(a)), (wx + 2.4 * math.cos(a), -3.2 + 2.4 * math.sin(a)),
              (wx + 2.4 * math.cos(a) + .5, -3.2 + 2.4 * math.sin(a) + .5), (wx - 2.4 * math.cos(a) + .5, -3.2 - 2.4 * math.sin(a) + .5)], m='GLD', **k)
    o.tf([(-9, -5.5), (-2, -5.5), (-1.5, -8), (-9.5, -8)], m=['COR', 'LAP', 'PNK'][var % 3], **k)       # seat
    o.tf([(-10, -8), (-10.5, -14), (-7, -16.5), (-2, -15.5), (-2.4, -14.4), (-6.8, -15), (-9, -13.4), (-8.8, -8)], m=['AMB', 'CAR', 'TUR'][var % 3], **k)  # hood
    o.tf([(-7.5, -8), (-4, -8), (-4.4, -13), (-7, -13)], m=['PNK', 'TUR', 'WHT'][var % 3], **k)        # passenger
    o.tf(CIRC8 * 1.5 + (-5.6, -14.3), m='SKN', **k)
    o.tf([(1.5, -6.5), (5, -6.5), (5.5, -13), (2.6, -13)], m='WHT', var=1, **k)       # puller
    o.tf(CIRC8 * 1.5 + (4.6, -14.4), m='SKN', var=1, **k)
    o.tf([(3., -16.4), (6.2, -16.4), (6.2, -15.2), (3., -15.2)], m='CAR', **k)
    o.tf([(-2, -5.2), (6.5, -3.4), (6.5, -2.6), (-2, -4.4)], m='GLD', **k)


VEH = []   # (path, dir, speed, s0, type, var, lane)


def _init_traffic():
    rg = np.random.default_rng(21)
    spec = {'r1': ['auto', 'bus', 'rick', 'auto', 'car', 'rick', 'auto', 'bus', 'auto', 'car', 'rick', 'auto', 'auto', 'car', 'bus', 'auto'],
            'r2': ['car', 'auto', 'auto', 'bus', 'car', 'auto', 'car', 'auto', 'auto'],
            'r3': ['auto', 'car', 'bus', 'auto', 'auto', 'car', 'auto']}
    for name, types in spec.items():
        L = city.PATHS[name].L
        n = len(types)
        for i, t in enumerate(types):
            d = 1 if i % 2 == 0 else -1
            sp = {'auto': 2.3, 'bus': 1.7, 'car': 2.7, 'rick': .9}[t] * (.85 + .3 * rg.random())
            VEH.append((name, d, sp, (i + .2 + .6 * rg.random()) / n * L, t, int(rg.integers(0, 60)), i))


def traffic(o, f):
    if not VEH:
        _init_traffic()
    for k, (name, d, sp, s0, t, var, i) in enumerate(VEH):
        P = city.PATHS[name]
        e = env(f, (k * 7) % 22)
        if e <= 0:
            continue
        s = (s0 + d * sp * (f + 9 * math.sin(f / 31. + k))) % P.L
        edge = min(1., s / 30., (P.L - s) / 30.)
        x, y, a = P.at(s)
        if not o.vis(x, y):
            continue
        lane = 4.6 if d > 0 else .2
        sc = e * edge * (1.0 if t != 'rick' else .95)
        if sc < .05:
            continue
        nx, ny = -math.sin(a), math.cos(a)
        fn = {'auto': auto, 'bus': bus, 'car': car}.get(t)
        if t == 'rick':
            rick(o, x + nx * lane, y + ny * lane, a, d, sc, f * sp, var)
        else:
            fn(o, x + nx * lane, y + ny * lane, a, d, sc, var)


def metro_trains(o, f):
    P = city.PATHS['metro']
    x0, x1 = P.P[0, 0], P.P[-1, 0]
    span = x1 - x0
    for (dirn, head_x, stripe) in ((1, x0 + ((800 - x0 + 7.5 * (f - 280)) % 2100.), 'LAP'),
                                   (-1, x1 - ((6. * (f - 150)) % 2300.), 'AME')):
        e = env(f, 0, 6)
        if e <= 0:
            continue
        for c in range(6):
            x = head_x - dirn * c * 25.
            if x < x0 + 6 or x > x1 - 6:
                continue
            edge = min(1., (x - x0) / 26., (x1 - x) / 26.)
            s = np.interp(x, P.P[:, 0], P.s)
            px, py, a = P.at(s)
            if not o.vis(px, py):
                continue
            k = dict(x=px, y=py - 2.8, s=e * edge, rot=a, flip=dirn, h=.08)
            nose = 3.5 if c == 0 else 0
            o.tf([(-11.6, 0), (11.6 - nose * .2, 0), (11.6, -4), (11.6 - nose, -9), (-11.6, -9)], m='PRL', var=c, **k)
            o.tf([(-11.6, -2.2), (11.6, -2.2), (11.6, -3.8), (-11.6, -3.8)], m=stripe, **k)
            for wv in range(3):
                o.tf([(-9.2 + wv * 6.6, -4.8), (-4.4 + wv * 6.6, -4.8), (-4.4 + wv * 6.6, -7.8), (-9.2 + wv * 6.6, -7.8)], m='SLT', var=1, **k)
            if c == 0:
                o.tf(CIRC8 * 1.1 + (10.4, -1.4), m='AMB', var=2, shade=1.1, **k)


def cp_traffic(o, f):
    cx, cy = city.ANCH['cp']
    if not o.vis(cx, cy, 120):
        return
    car_ = np.array([(-3.6, -2), (3., -2), (4., 0), (3., 2), (-3.6, 2)], np.float32)
    mats = ['WHT', 'AMB', 'COR', 'TUR', 'CRM', 'JAD', 'PRL', 'LAP', 'JAD']
    k = 0
    for r, n, d in ((40.5, 6, 1), (75., 11, -1), (107., 15, 1)):
        for i in range(n):
            k += 1
            e = env(f, (k * 5) % 20)
            if e <= 0:
                continue
            a = i * 2 * PI / n + d * (1.5 / r) * (f + 8 * math.sin(f / 23. + k)) + k
            x, y = cx + r * math.cos(a), cy + r * math.sin(a)
            m = mats[k % len(mats)]
            o.tf(car_, x, y, e, a + d * PI / 2, 1, m=m, var=k, h=.08)
            if m == 'JAD':
                o.tf(car_ * .55, x, y, e, a + d * PI / 2, 1, m='AMB', h=.08)
            else:
                o.tf(car_ * (.4, .7), x, y, e, a + d * PI / 2, 1, m='ONX', h=.08)


# ----------------------------------------------------------------------------- birds
def bird(o, x, y, hd, flap, s, m, var=0, shade=1., h=.5, tail=0., beak=None):
    c, sn = math.cos(hd), math.sin(hd)
    w = (1.2 + 4.6 * abs(math.cos(flap))) * s
    b = 3.4 * s

    def P(lx, ly):
        return (x + lx * c - ly * sn, y + lx * sn + ly * c)
    if tail:
        o.poly([P(-b * .6, -.7 * s), P(-b * .6, .7 * s), P(-b - tail * s, 0)], m, var + 1, h, shade * .85)
    o.poly([P(b, 0), P(0, -1.3 * s), P(-b, 0), P(0, 1.3 * s)], m, var, h, shade)
    sw = -1.8 * s * math.sin(flap)
    o.poly([P(1.3 * s, 0), P(-1.2 * s, 0), P(-1.6 * s + sw, -w), P(.4 * s + sw, -w * .8)], m, var + 1, h, shade * 1.08)
    o.poly([P(1.3 * s, 0), P(-1.2 * s, 0), P(-1.6 * s + sw, w), P(.4 * s + sw, w * .8)], m, var + 2, h, shade * .92)
    if beak:
        o.poly([P(b * .8, -.6 * s), P(b * 1.35, 0), P(b * .8, .6 * s)], beak, 0, h)


_PIG = None


def pigeons(o, f):
    global _PIG
    if _PIG is None:
        rg = np.random.default_rng(8)
        _PIG = [(rg.normal() * .22, rg.normal() * 20, rg.normal() * 9, rg.random() * 6.28, .8 + .5 * rg.random(), int(rg.integers(0, 9))) for _ in range(40)]
    flocks = ((city.ANCH['jama'][0], 128., 150., 34., 150., 0, 28), (566., 122., 96., 20., 118., 28, 12))
    for (cx, cy, rx, ry, per, i0, n) in flocks:
        if not o.vis(cx, cy, 190):
            continue
        for i in range(i0, i0 + n):
            lag, dx, dy, ph, sz, v = _PIG[i]
            e = env(f, (i * 3) % 24)
            if e <= 0:
                continue
            a = 2 * PI * f / per + lag
            x = cx + rx * math.cos(a) * (1 + .12 * math.sin(a * 2 + 1)) + dx
            y = cy + ry * math.sin(a) + dy + 5 * math.sin(a * 3 + ph)
            hd = math.atan2(ry * math.cos(a), -rx * math.sin(a))
            flash = 1. + .35 * math.cos(a - .8)
            m = 'GRY' if v % 4 else 'PRL'
            bird(o, x, y, hd, f * .9 + ph, sz * e, m, v, flash, h=.55)


def parakeets(o, f):
    for (t0, sp, per, x00, y00, slope, n) in ((552., 7., 1820., -60., 808., -.055, 6), (130., 6., 2100., 1900., 440., .05, 4)):
        d = 1 if sp > 0 and x00 < 0 else -1
        xl = x00 + d * ((sp * (f - t0)) % per)
        e = env(f)
        if e <= 0:
            continue
        for i in range(n):
            x = xl - d * (i + 1) // 2 * 15.
            y = y00 + slope * (x - 100) + 12 * math.sin(x / 85.) + ((i % 2) * 2 - 1) * ((i + 1) // 2) * 8.
            if not o.vis(x, y) or x < 80 or x > WW - 80:
                continue
            hd = (0 if d > 0 else PI) + .14 * math.cos(x / 85.) * d
            bird(o, x, y, hd, f * 1.3 + i, 1.25 * e, 'JAD', i, 1.05, h=.6, tail=7.5, beak='COR')


def gulls(o, f):
    bx, by = boat_pos(f)
    for i in range(6):
        e = env(f, i * 4)
        if e <= 0:
            continue
        a = 2 * PI * f / (96. + i * 9) + i * 1.1
        x = bx + (38 + i * 5) * math.cos(a)
        y = by - 10 + (17 + i * 2) * math.sin(a)
        if not o.vis(x, y):
            continue
        hd = math.atan2(17 * math.cos(a), -38 * math.sin(a))
        bird(o, x, y, hd, f * .55 + i, 1.15 * e, 'WHT', i, 1., h=.5)


def boat_pos(f):
    P = city.PATHS['river']
    x, y, a = P.at(330 + .55 * f)
    return x - 6, y


def boats(o, f):
    x, y = boat_pos(f)
    e = env(f)
    if e > 0 and o.vis(x, y):
        bob = math.sin(f / 9.) * .8
        k = dict(x=x, y=y + bob, s=e, rot=.04 * math.sin(f / 13.), h=.06)
        o.tf([(-13, -3), (13, -3), (9, 2.4), (-9, 2.4)], m='BRN', var=1, **k)
        o.tf([(-13, -3), (13, -3), (12, -1.6), (-12, -1.6)], m='AMB', **k)
        o.tf([(-2, -3), (2, -3), (1.3, -11), (-1.3, -11)], m='WHT', **k)
        o.tf(CIRC8 * 1.9 + (0, -12.6), m='SKN', **k)
        o.tf([(-1, -8), (10, 3), (9.2, 3.6), (-1.6, -7.4)], m='GLD', **k)
        for j in range(3):   # wake
            w = 10 + j * 7 + (f % 20) * .35
            o.line([(x - w, y + 5 + j * 2.2), (x + w, y + 5 + j * 2.2)], .7, 'PRL', shade=.9)
    lx, ly = city.ANCH['boat_lake']
    if e > 0 and o.vis(lx, ly):
        a = f / 60.
        x, y = lx + 24 * math.cos(a), ly + 5 * math.sin(a)
        k = dict(x=x, y=y, s=e, flip=1 if math.sin(a) < 0 else -1, h=.05)
        o.tf([(-7, -2.5), (7, -2.5), (5.5, 1.5), (-5.5, 1.5)], m='COR', **k)
        o.tf([(-3, -2.5), (-3, -7), (4, -7), (5, -2.5)], m='AMB', **k)


# ----------------------------------------------------------------------------- kites
KITES = None


def kites(o, f):
    global KITES
    if KITES is None:
        fl = city.ANCH['flyers']
        KITES = [  # anchor, offset, colours, phase
            (fl[0], (96, -70), ('CAR', 'AMB'), 0.),
            (fl[1], (-70, -120), ('TUR', 'WHT'), 1.7),
            (fl[2], (60, -52), ('PNK', 'AMB'), 3.1),
            ((1180, 236), (60, -112), ('AME', 'COR'), 4.2),
            ((1420, 236), (-40, -128), ('AMB', 'JAD'), 2.2),
            ((1811, 172), (-70, -70), ('COR', 'WHT'), 5.),
            ((246.6, 978), (150, -150), ('TUR', 'AMB'), .9),
            ((660, 868), (60, -66), ('CAR', 'WHT'), 2.8),
            ((1716, 650), (-20, -64), ('PNK', 'TUR'), 3.9),
            ((700, 180), (30, -78), ('LAP', 'AMB'), 5.6),
        ]
    for i, ((ax, ay), (dx, dy), (m1, m2), ph) in enumerate(KITES):
        e = env(f, i * 3, 0)
        if e <= 0.01:
            continue
        t = f / 30.
        kx = ax + e * (dx + 16 * math.sin(t * 1.1 + ph) + 6 * math.sin(t * 2.7 + ph * 2))
        ky = ay + e * (dy + 9 * math.sin(t * 1.7 + ph * 1.3) + 4 * math.cos(t * 3.1 + ph))
        if not (o.vis(kx, ky, 40) or o.vis(ax, ay)):
            continue
        tt = np.linspace(0, 1, 9)[:, None]
        mid = ((ax + kx) / 2 + 4 * math.sin(t * 1.3 + ph), (ay + ky) / 2 + 14 * e)
        S = (1 - tt) ** 2 * (ax, ay) + 2 * tt * (1 - tt) * mid + tt ** 2 * (kx, ky)
        o.line(S, .55, 'PRL', shade=.8)
        rot = .35 * math.sin(t * 1.1 + ph + .8) + (0.25 if dx > 0 else -.25)
        s = e * 1.0
        k = dict(x=kx, y=ky, s=s, rot=rot, h=.55)
        o.tf([(0, -8.5), (7, 0), (0, 0), (-7, 0)], m=m1, var=i, **k)
        o.tf([(-7, 0), (0, 0), (7, 0), (0, 9.5)], m=m2, var=i, **k)
        o.tf([(-.4, -8.5), (.4, -8.5), (.4, 9.5), (-.4, 9.5)], m='GLD', **k)
        o.tf([(-2.2, 9.5), (2.2, 9.5), (0, 14 + 1.5 * math.sin(t * 6 + ph))], m=m1, var=i + 1, **k)


# ----------------------------------------------------------------------------- flags, fountains, balloons, steam
def flag(o, x, y, w, hgt, f, mats, e, chakra=False, tri=False, dirn=1):
    n = 6
    nb = len(mats)
    t = f * .28
    xs = np.linspace(0, 1, n + 1)
    wave = np.sin(xs * 5.5 - t) * hgt * .16 * xs + np.sin(xs * 2.3 - t * .6) * hgt * .1 * xs
    top = y + (hgt * .5 * xs if tri else 0 * xs) + wave
    bot = y + hgt - (hgt * .5 * xs if tri else 0 * xs) + wave
    for b in range(nb):
        q0, q1 = b / nb, (b + 1) / nb
        for i in range(n):
            xa, xb = x + dirn * xs[i] * w * e, x + dirn * xs[i + 1] * w * e
            o.poly([(xa, top[i] + q0 * (bot[i] - top[i])), (xb, top[i + 1] + q0 * (bot[i + 1] - top[i + 1])),
                    (xb, top[i + 1] + q1 * (bot[i + 1] - top[i + 1])), (xa, top[i] + q1 * (bot[i] - top[i]))],
                   mats[b], i, .25, 1. + .12 * math.sin(xs[i] * 5.5 - t + 1))
    if chakra:
        o.dot(x + dirn * .5 * w * e, y + hgt * .5 + wave[n // 2], hgt * .11, 'LAP', h=.25)


def flags(o, f):
    e = env(f, 4)
    if e <= 0:
        return
    x, y = city.ANCH['flag_rf']
    if o.vis(x, y):
        flag(o, x + .6, y, 31, 19, f, ('CAR', 'WHT', 'MAL'), e, chakra=True)
    x, y = city.ANCH['flag_cp']
    if o.vis(x, y):
        flag(o, x + .5, y, 25, 15, f + 9, ('CAR', 'WHT', 'MAL'), e, chakra=True)
    x, y = city.ANCH['nishan']
    if o.vis(x, y):
        flag(o, x + .9, y, 19, 13, f + 4, ('AMB',), e, tri=True)
    x, y = city.ANCH['flag_ak']
    if o.vis(x, y):
        flag(o, x + .5, y, 13, 7, f + 2, ('COR', 'WHT'), e)


def fountains(o, f):
    pts = list(city.ANCH['fountains']) + [city.ANCH['cp'], (179, 418)]
    for j, (fx, fy) in enumerate(pts):
        if not o.vis(fx, fy):
            continue
        e = env(f, j * 5)
        if e <= 0:
            continue
        for arc, (dx, hh) in enumerate(((-9, 13), (-4, 19), (0, 23), (4, 19), (9, 13))):
            for d in range(4):
                a = ((f * .045 + d / 4. + arc * .13) % 1.)
                o.dot(fx + dx * a, fy - hh * 4 * a * (1 - a) * e, (.9 + .5 * (1 - a)) * e, 'PRL', arc + d, 0., 1.05)


def balloons(o, f):
    x, y = city.ANCH['balloons']
    if not o.vis(x, y):
        return
    e = env(f, 10)
    if e <= 0:
        return
    ms = ['COR', 'AMB', 'TUR', 'PNK', 'AME', 'JAD', 'WHT', 'CAR']
    for i in range(8):
        a = -PI / 2 + (i - 3.5) * .24
        r = 17 + (i % 3) * 5
        bx = x + e * (r * math.cos(a) + 2 * math.sin(f / 14. + i))
        by = y + e * (r * math.sin(a) + 1.3 * math.sin(f / 9. + i * 2))
        o.line([(x, y), ((x + bx) / 2 + 1, (y + by) / 2), (bx, by + 4.5)], .4, 'GLD', shade=.9)
        o.items.append((CIRC12 * (3.6 * e, 4.4 * e) + (bx, by), MAT[ms[i]], col(ms[i], i), .3))
        o.dot(bx - 1.1, by - 1.6, .8 * e, 'PRL', h=.3)


def steam(o, f):
    for (key, n, rise, spread, rate, size, alpha) in (('chai', 7, 46, 5, .011, 5., .8), ('kebab', 12, 70, 9, .008, 6.5, .5)):
        x, y = city.ANCH[key]
        if not o.vis(x, y, 60):
            continue
        e = env(f, 8)
        for i in range(n):
            a = (f * rate + i / n) % 1.
            px = x + spread * math.sin(a * 5 + i * 2.1) * (.3 + a) + 10 * a * a
            py = y - rise * a
            r = (1.6 + size * a ** .8)
            al = e * alpha * (1 - a) ** 1.1 * min(1., a * 7)
            ang = np.linspace(0, 2 * PI, 16, endpoint=False)
            rr = r * (1 + .28 * np.sin(ang * 3 + i + f * .05))
            o.steam.append((np.stack([px + rr * np.cos(ang), py + rr * .8 * np.sin(ang)], 1).astype(np.float32), al))


# ----------------------------------------------------------------------------- creatures & small things
def plane(o, f):
    for (f0, f1, xa, ya, vx, vy) in ((150., 222., 1240., 396., -7., .1), (548., 680., 980., 694., -7., .12)):
        if not (f0 < f < f1):
            continue
        x, y = xa + vx * (f - f0), ya + vy * (f - f0)
        if not o.vis(x, y, 40):
            continue
        e = sm((f - f0) / 10.) * (1 - sm((f - f1 + 10) / 10.)) * env(f)
        k = dict(x=x, y=y, s=1.25 * e, rot=PI + .08, h=1.5)
        o.tf(petal_pts(-17, 0, 0, 36, 5.6), m='PRL', **k)
        o.tf([(2, 0), (-5, -15), (-9, -15), (-5, 0)], m='PRL', var=1, **k)
        o.tf([(2, 0), (-5, 15), (-9, 15), (-5, 0)], m='PRL', var=2, **k)
        o.tf([(-14, 0), (-18, -6), (-20, -6), (-17.5, 0)], m='PRL', var=1, **k)
        o.tf([(-14, 0), (-18, 6), (-20, 6), (-17.5, 0)], m='PRL', var=2, **k)
        o.tf([(-15, -.6), (-19.5, -.6), (-19.5, .6), (-15, .6)], m='COR', **k)


def deer(o, f):
    for i, (x, y) in enumerate(city.ANCH['deer']):
        if not o.vis(x, y):
            continue
        e = env(f, 6 + i * 5)
        if e <= 0:
            continue
        fl = 1 if i == 0 else -1
        nod = .5 + .5 * math.sin(f / 17. + i * 2)
        k = dict(x=x, y=y, s=e * (1.1 - .15 * i), flip=fl, h=.05)
        for lx in (-5.5, -3.5, 3.5, 5.5):
            o.tf([(lx - .6, -6), (lx + .6, -6), (lx + .4, 0), (lx - .4, 0)], m='BRN', var=1, **k)
        o.tf(ell_pts(0, -9, 7.6, 3.9, 12), m='BRN', var=2, **k)
        for (dx, dy) in ((-3, -10), (0, -8.4), (3, -10.4), (-1, -11)):
            o.tf(CIRC8 * .7 + (dx, dy), m='WHT', **k)
        hx, hy = 9.5 + 2.5 * nod, -17 + 9 * nod
        o.tf([(4.5, -11), (7, -8.5), (hx + 1, hy + 1), (hx - 1.4, hy)], m='BRN', var=2, **k)
        o.tf(petal_pts(hx - 1.5, hy, .25, 6.2, 3.), m='BRN', var=0, **k)
        o.tf([(hx - .6, hy - 1), (hx - 2.4, hy - 6.5), (hx - 1.7, hy - 6.5), (hx + .2, hy - 1)], m='GLD', **k)
        o.tf([(hx + .2, hy - 1), (hx + 1.2, hy - 6), (hx + 1.9, hy - 6), (hx + 1, hy - 1)], m='GLD', **k)


def flamingos(o, f):
    for i, (x, y) in enumerate(city.ANCH['flamingos']):
        if not o.vis(x, y):
            continue
        e = env(f, 4 + i * 4)
        if e <= 0:
            continue
        fl = 1 if i % 2 else -1
        dip = .5 + .5 * math.sin(f / 21. + i * 1.7)
        s = e * (1. + .12 * (i % 3))
        k = dict(x=x, y=y, s=s, flip=fl, h=.05)
        for lx in (-.8, 1.2):
            o.tf([(lx - .35, -9), (lx + .35, -9), (lx + .35, 0), (lx - .35, 0)], m='COR', **k)
        o.tf(ell_pts(0, -11.5, 5.2, 3.3, 12), m='ROS' if i % 2 else 'COR', var=i, **k)
        o.tf(petal_pts(-2, -12, PI + .3, 6, 3.4), m='PNK', **k)
        t = np.linspace(0, 1, 8)
        hx, hy = 5.5 + 2 * dip, -24 + 13 * dip
        nx_ = 3.5 + (hx - 3.5) * t + 2.6 * np.sin(t * PI) * (1 - dip * .5)
        ny_ = -13 + (hy + 13) * t
        L, R = stroke_poly(np.stack([nx_, ny_], 1), 1.3)
        o.tf(np.concatenate([L, R[::-1]], 0), m='ROS', var=1, **k)
        o.tf(CIRC8 * 1.5 + (hx, hy), m='ROS', var=2, **k)
        o.tf([(hx + 1, hy - .6), (hx + 3.6, hy + 1.6), (hx + 1, hy + .8)], m='ONX', **k)


def peacock(o, f):
    x, y = city.ANCH['peacock']
    if not o.vis(x, y, 30):
        return
    e = env(f, 8)
    if e <= 0:
        return
    op = sm((f - 640) / 34.) * (1 - sm((f - 716) / 10.)) + .9 * sm((f - 176) / 20.) * (1 - sm((f - 226) / 10.))
    k = dict(x=x, y=y, s=e * 1.15, h=.05)
    n = 9
    for i in range(n):
        a = -PI / 2 + (i - (n - 1) / 2) * (.05 + .30 * op) - (1 - op) * 1.25
        ln = 15 + 3 * op
        o.tf(petal_pts(-1, -7, a, ln, 4.4), m='MAL' if i % 2 else 'TUR', var=i, **k)
        o.tf(CIRC8 * 1.2 + (-1 + (ln - 3.2) * math.cos(a), -7 + (ln - 3.2) * math.sin(a)), m='LAP', **k)
        o.tf(CIRC8 * .5 + (-1 + (ln - 3.2) * math.cos(a), -7 + (ln - 3.2) * math.sin(a)), m='GLD', **k)
    o.tf(petal_pts(-4.5, -5.5, -.25, 10, 5.5), m='LAP', var=2, **k)
    o.tf([(3, -8), (4.6, -8), (5.6, -15), (4.6, -15)], m='LAP', var=0, **k)
    o.tf(CIRC8 * 1.5 + (5.4, -16), m='LAP', var=2, **k)
    o.tf([(6.6, -16.3), (8.4, -15.7), (6.6, -15.3)], m='AMB', **k)
    for dx in (-.9, 0, .9):
        o.tf([(5.3 + dx * .3, -17.3), (5.5 + dx, -20), (5.9 + dx, -20), (5.7 + dx * .3, -17.3)], m='GLD', **k)
    for lx in (-1, 1.2):
        o.tf([(lx - .3, -3.2), (lx + .3, -3.2), (lx + .3, 0), (lx - .3, 0)], m='GLD', **k)


def monkeys(o, f):
    for i, (x, y) in enumerate(city.ANCH['monkeys']):
        if not o.vis(x, y):
            continue
        e = env(f, 10 + i * 6)
        if e <= 0:
            continue
        hop = abs(math.sin(f / 7. + i * 2)) * 3.2 if (f // 40 + i) % 3 == 0 else 0
        dx = 12 * math.sin(f / 50. + i * 2.4)
        fl = 1 if math.cos(f / 50. + i * 2.4) > 0 else -1
        k = dict(x=x + dx, y=y - hop, s=e * .95, flip=fl, h=.05)
        o.tf(ell_pts(0, -3.6, 4.2, 3.2, 10), m='BRN', var=i, **k)
        o.tf(CIRC8 * 2.2 + (4.2, -7.6), m='BRN', var=i + 1, **k)
        o.tf(CIRC8 * 1.1 + (5.2, -7.2), m='SKN', var=2, **k)
        t = np.linspace(0, 1, 8)
        L, R = stroke_poly(np.stack([-4 - 5 * t, -3 - 7 * t + 3 * np.sin(t * 3.4)], 1), .9)
        o.tf(np.concatenate([L, R[::-1]], 0), m='BRN', var=i, **k)


def koi(o, f):
    cx, cy = city.ANCH['sarovar']
    if not o.vis(cx, cy):
        return
    e = env(f, 12)
    if e <= 0:
        return
    for i in range(5):
        a = f / (38. + i * 7) * (1 if i % 2 else -1) + i * 1.3
        x, y = cx + (30 - i * 3) * math.cos(a), cy + 3.6 * math.sin(a * 1.0)
        hd = math.atan2(3.6 * math.cos(a), -(30 - i * 3) * math.sin(a)) + (0 if i % 2 else PI)
        o.tf(petal_pts(-3, 0, 0, 6.4, 2.3), x, y, e, hd, 1, m='AMB' if i % 2 else 'COR', var=i)
        o.tf([(-2.6, 0), (-4.8, -1.3), (-4.8, 1.3)], x, y, e, hd, 1, m='WHT')


def walkers(o, f):
    specs = [(430., 960., 655.5, .42, 'PNK', 'AMB', None), (500., 940., 655.5, -.36, 'WHT', None, 'CAR'), (600., 950., 681., .5, 'TUR', None, None),
             (640., 945., 655.5, .3, 'AMB', 'COR', None), (700., 930., 960., 1.25, 'COR', None, None), (880., 705., 961., -1.1, 'WHT', None, 'LAP'),
             (1104., 1280., 304.5, .4, 'AME', 'PNK', None), (345., 760., 303.5, .5, 'WHT', None, 'PNK'), (760., 350., 304.5, -.45, 'AMB', 'TUR', None),
             (1050., 1270., 1000., .35, 'CRM', None, 'CAR'), (540., 420., 303.5, -.4, 'TUR', 'AMB', None)]
    for i, (xa, xb, y, sp, body, head, hat) in enumerate(specs):
        e = env(f, (i * 5) % 20)
        if e <= 0:
            continue
        L = abs(xb - xa)
        ph = (abs(sp) * f + i * 53.) % (2 * L)
        u = ph if ph < L else 2 * L - ph
        d = (1 if ph < L else -1) * (1 if xb > xa else -1)
        x = xa + (xb - xa) * u / L
        if not o.vis(x, y):
            continue
        hgt = 20.
        fast = abs(sp) >= 1
        bob = abs(math.sin(f * (.45 if not fast else .8) + i)) * (1.0 if not fast else 1.8)
        lean = .16 * d if fast else 0.
        k = dict(x=x, y=y - bob, s=e, rot=lean, h=.06)
        st = math.sin(f * (.45 if not fast else .8) + i) * hgt * .1
        o.tf([(-hgt * .05 - st, 0), (hgt * .05 - st, 0), (hgt * .04, -hgt * .2), (-hgt * .06, -hgt * .2)], m='SLT', var=1, **k)
        o.tf([(-hgt * .05 + st, 0), (hgt * .05 + st, 0), (hgt * .06, -hgt * .2), (-hgt * .04, -hgt * .2)], m='SLT', var=2, **k)
        sw = (.16 + .05 * math.sin(f * .45 + i), -.14 + .04 * math.cos(f * .45 + i)) if not fast else (.15, -.2)
        for pts, m in figure(hgt * .92, d, body, hat, head, sw if (i % 2 or fast) else None, lift=.09):
            o.tf(pts, m=m, var=i, **k)


def lights(o, f):
    (xa, ya), (xb, yb) = city.ANCH['lights']
    if not o.vis(xa, ya, 80):
        return
    e = env(f, 14)
    if e <= 0:
        return
    for j in range(2):
        for i in range(10):
            t = i / 9.
            x = xa + (xb - xa) * t
            y = ya + (yb - ya) * t + (9 + j * 7) * 4 * t * (1 - t) - j * 3 + math.sin(f / 20. + t * 3) * .8
            tw = .75 + .45 * math.sin(f * .21 + i * 2.1 + j)
            o.dot(x, y, 1.25 * e, 'AMB', i, 0., tw)


# ----------------------------------------------------------------------------- water shimmer (recolours set stones)
def attach(sc):
    riv = sc.tags.get('river', [])
    pond = sc.tags.get('pond', [])
    ri = np.array([i for i, _ in riv], np.int64)
    rs = np.array([p[0] for _, p in riv], np.float32)
    rv = np.array([p[1] for _, p in riv], np.float32)
    pi_ = np.array([i for i, _ in pond], np.int64)
    pxy = np.array([p for _, p in pond], np.float32).reshape(-1, 2)

    def dyn_color(f, C):
        C = C.copy()
        on = sm((f - 100) / 50.) * (1 - sm((f - 740) / 20.))
        if len(ri):
            w = np.sin(rs * .060 - f * .20 + np.sin(rv * 9.) * 1.3) * .5 + .5
            w2 = np.sin(rs * .021 - f * .07 + rv * 4.)
            g = 1 + on * (.42 * w ** 3 + .12 * w2)
            C[ri] = np.minimum(C[ri] * g[:, None] + (on * 34 * w ** 6)[:, None], 255)
        if len(pi_):
            w = np.sin(pxy[:, 0] * .15 + pxy[:, 1] * .23 - f * .13) * .5 + .5
            C[pi_] = np.minimum(C[pi_] * (1 + on * .3 * w ** 2)[:, None], 255)
        return C
    sc.dyn_color = dyn_color


def life(f, cam):
    o = Out(cam)
    if f < P_ON or f > P_OFF + 40:
        return o.items, o.steam
    lights(o, f)
    koi(o, f)
    fountains(o, f)
    boats(o, f)
    deer(o, f)
    flamingos(o, f)
    peacock(o, f)
    monkeys(o, f)
    walkers(o, f)
    traffic(o, f)
    cp_traffic(o, f)
    metro_trains(o, f)
    flags(o, f)
    balloons(o, f)
    kites(o, f)
    parakeets(o, f)
    gulls(o, f)
    pigeons(o, f)
    plane(o, f)
    steam(o, f)
    nameplate(o, f, cam)
    return o.items, o.steam


# ----------------------------------------------------------------------------- nameplate (own stroke lettering, set in gold)
def _arc(cx, cy, rx, ry, a0, a1, n=10):
    a = np.radians(np.linspace(a0, a1, n))
    return [(cx + rx * math.cos(v), cy + ry * math.sin(v)) for v in a]


FONT = {   # cap height 6, y up.  glyph: (advance width, [polylines])
    'A': (4.2, [[(0, 0), (2.1, 6), (4.2, 0)], [(.8, 2.1), (3.4, 2.1)]]),
    'B': (3.9, [[(0, 0), (0, 6), (2.1, 6)] + _arc(2.1, 4.55, 1.5, 1.45, 90, -90) + [(0, 3.1)],
                [(2.1, 3.1)] + _arc(2.2, 1.55, 1.7, 1.55, 90, -90) + [(0, 0)]]),
    'C': (4.2, [_arc(2.4, 3, 2.4, 3, 48, 312, 16)]),
    'D': (4.3, [[(0, 0), (0, 6), (1.7, 6)] + _arc(1.7, 3, 2.5, 3, 90, -90, 14) + [(0, 0)]]),
    'E': (3.5, [[(3.5, 6), (0, 6), (0, 0), (3.5, 0)], [(0, 3.1), (2.8, 3.1)]]),
    'F': (3.4, [[(3.4, 6), (0, 6), (0, 0)], [(0, 3.1), (2.7, 3.1)]]),
    'G': (4.6, [_arc(2.4, 3, 2.4, 3, 48, 335, 16) + [(4.6, 2.9), (2.7, 2.9)]]),
    'H': (4.2, [[(0, 0), (0, 6)], [(4.2, 0), (4.2, 6)], [(0, 3.1), (4.2, 3.1)]]),
    'I': (0., [[(0, 0), (0, 6)]]),
    'J': (3., [[(3, 6), (3, 1.6)] + _arc(1.5, 1.6, 1.5, 1.6, 0, -170)]),
    'K': (4., [[(0, 0), (0, 6)], [(3.8, 6), (0, 2.5)], [(1.5, 3.9), (4, 0)]]),
    'L': (3.3, [[(0, 6), (0, 0), (3.3, 0)]]),
    'M': (5.2, [[(0, 0), (0, 6), (2.6, 1.4), (5.2, 6), (5.2, 0)]]),
    'N': (4.3, [[(0, 0), (0, 6), (4.3, 0), (4.3, 6)]]),
    'O': (4.8, [_arc(2.4, 3, 2.4, 3, 90, 450, 22)]),
    'P': (3.8, [[(0, 0), (0, 6), (2.1, 6)] + _arc(2.1, 4.4, 1.7, 1.6, 90, -90) + [(0, 2.8)]]),
    'Q': (4.8, [_arc(2.4, 3, 2.4, 3, 90, 450, 22), [(2.9, 1.5), (4.9, -.6)]]),
    'R': (4., [[(0, 0), (0, 6), (2.1, 6)] + _arc(2.1, 4.4, 1.7, 1.6, 90, -90) + [(0, 2.8)], [(1.9, 2.8), (4, 0)]]),
    'S': (3.8, [_arc(1.95, 4.5, 1.75, 1.5, 25, 270, 10) + _arc(1.95, 1.5, 1.95, 1.5, 90, -155, 10)]),
    'T': (4.2, [[(0, 6), (4.2, 6)], [(2.1, 6), (2.1, 0)]]),
    'U': (4.2, [[(0, 6), (0, 2.1)] + _arc(2.1, 2.1, 2.1, 2.1, 180, 360, 12) + [(4.2, 6)]]),
    'V': (4.2, [[(0, 6), (2.1, 0), (4.2, 6)]]),
    'W': (5.8, [[(0, 6), (1.4, 0), (2.9, 4.8), (4.4, 0), (5.8, 6)]]),
    'X': (4., [[(0, 0), (4, 6)], [(0, 6), (4, 0)]]),
    'Y': (4.2, [[(0, 6), (2.1, 3), (4.2, 6)], [(2.1, 3), (2.1, 0)]]),
    'Z': (3.9, [[(0, 6), (3.9, 6), (0, 0), (3.9, 0)]]),
    "'": (.4, [[(.4, 6.2), (0, 4.6)]]),
    ' ': (2.6, []),
    '.': (3.2, []),          # centred diamond, drawn separately
}
NAMES = ['JAMA MASJID . CHANDNI CHOWK', 'LAL QILA . RED FORT', 'INDIA GATE', 'CONNAUGHT PLACE', 'QUTUB MINAR . HAUZ KHAS',
         "HUMAYUN'S TOMB . LOTUS TEMPLE"]
SHOT0, BARF, GLIDEF = 240, 80, 11


def _text(s, hgt, track):
    """-> (width, [polylines in px, y down, origin at left baseline], [diamond centres])"""
    u = hgt / 6.
    x = 0.
    lines, dias = [], []
    for ch in s:
        adv, pl = FONT[ch]
        for p in pl:
            lines.append([(x + px_ * u, -py * u) for px_, py in p])
        if ch == '.':
            dias.append((x + 1.6 * u, -3 * u))
        x += adv * u + track
    return x - track, lines, dias


def nameplate(o, f, cam):
    i = int((f - SHOT0) // BARF)
    if f < SHOT0 or i >= len(NAMES):
        return
    t = f - (SHOT0 + i * BARF)
    a = sm((t - 4) / 9.) * (1 - sm((t - (BARF - GLIDEF - 12)) / 8.))
    if a <= .01:
        return
    cx, cy, z = cam
    hgt, track, sw = 22., 7.5, 3.0
    W_, lines, dias = _text(NAMES[i], hgt, track)
    pw, ph = W_ + 230, 58.
    X0, Y0 = 960., 1080 - 62.
    sx = .25 + .75 * a      # the plate unrolls from its centre

    def S(P):
        P = np.asarray(P, np.float32)
        P = np.stack([X0 + (P[:, 0]) * sx, Y0 + P[:, 1] * (.6 + .4 * a)], 1)
        return (P - (960., 540.)) / z + (cx, cy)

    def add(P, m, var=0, rid=7, shade=1.):
        o.items.append((S(P), MAT[m], col(m, var, shade), 0., rid))

    def stroke(P, w, m='GLD', rid=9, var=0):
        P = np.asarray(P, np.float32)
        for q in range(len(P) - 1):
            L, R = stroke_poly(P[q:q + 2], w)
            add(np.concatenate([L, R[::-1]], 0), m, var, rid)
        for q in range(len(P)):
            add(CIRC8 * (w / 2) + P[q], m, var, rid)

    h2 = ph / 2
    plate = [(-pw / 2 + 22, -h2), (pw / 2 - 22, -h2), (pw / 2, 0), (pw / 2 - 22, h2), (-pw / 2 + 22, h2), (-pw / 2, 0)]
    o.items.append((S(np.array(plate) * 1.0 + (5, 7)), MAT['ONX'], col('ONX'), 0., 5))     # soft seat
    add(plate, 'BLK', 1, 6)
    stroke(plate + plate[:1], 2.4, 'GLD', 8)
    inner = [(-pw / 2 + 25, -h2 + 6), (pw / 2 - 25, -h2 + 6), (pw / 2 - 9, 0), (pw / 2 - 25, h2 - 6), (-pw / 2 + 25, h2 - 6), (-pw / 2 + 9, 0)]
    stroke(inner + inner[:1], 1., 'GLD', 8, 1)
    if a > .55:
        x0 = -W_ / 2
        for ln in lines:
            stroke([(x0 + px_, hgt / 2 + py) for px_, py in ln], sw, 'GLD', 9, 2)
        for (dx, dy) in dias:
            c = (x0 + dx, hgt / 2 + dy)
            add([(c[0], c[1] - 6.5), (c[0] + 5.2, c[1]), (c[0], c[1] + 6.5), (c[0] - 5.2, c[1])], 'CAR', 2, 10, 1.1)
        # where we are on the slab: a tiny map with a bead
        mw, mh = 46., 26.
        mx = -pw / 2 + 64
        r = [(mx - mw / 2, -mh / 2), (mx + mw / 2, -mh / 2), (mx + mw / 2, mh / 2), (mx - mw / 2, mh / 2)]
        stroke(r + r[:1], 1.5, 'GLD', 11, 1)
        riv = [(mx - mw / 2 + mw * px_ / WW, -mh / 2 + mh * py / WH) for px_, py in city.RIVER_CTRL[1:-1]]
        stroke(riv, 2., 'LAP', 12, 2)
        bx, by = mx - mw / 2 + mw * cx / WW, -mh / 2 + mh * cy / WH
        add(CIRC12 * 4.2 + (bx, by), 'AMB', 2, 13, 1.1)
        # ornament on the other side
        ox = pw / 2 - 60
        for a0 in (0, PI / 4):
            add(ell_pts(ox, 0, 11, 11, 4, a0, a0 + 2 * PI), 'TUR' if a0 else 'LAP', 0, 14 + int(a0 > 0))
        add(CIRC12 * 4 + (ox, 0), 'GLD', 0, 16)
