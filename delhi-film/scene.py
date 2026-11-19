"""Scene container + geometry helpers for 'Dilli, Inlaid'.
Everything is a 'piece' (a polygon of one stone) in world units (slab = 1920 x 1080)."""
import math
import numpy as np
from scipy.interpolate import PchipInterpolator

WW, WH = 1920.0, 1080.0
PI = math.pi

# ----------------------------------------------------------------------------- materials
MATS = []
MAT = {}


def defmat(name, cols, a=.07, b=.12, c=0., jd=.36, bev=1., spec=0., jit=.06):
    MAT[name] = len(MATS)
    MATS.append(dict(name=name, cols=[(c_[2], c_[1], c_[0]) for c_ in cols],  # -> BGR
                     a=a, b=b, c=c, jd=jd, bev=bev, spec=spec, jit=jit))


defmat('GROUND', [(13, 14, 18)], a=0, b=0, jd=0, bev=0)
defmat('SOCKET', [(82, 77, 71)], a=.15, b=.12, jd=.55, bev=-1.5, jit=0)
defmat('RED', [(176, 64, 44), (158, 54, 38), (190, 78, 52), (166, 72, 50)], a=.09, b=.20)
defmat('RDK', [(128, 42, 32), (116, 36, 30), (138, 50, 36)], a=.09, b=.18)
defmat('BUF', [(224, 192, 142), (212, 178, 126), (232, 202, 156), (204, 170, 120)], a=.06, b=.12)
defmat('WHT', [(240, 236, 226), (230, 226, 216), (246, 243, 236)], a=.03, b=.07, spec=.12, jit=.03)
defmat('PRL', [(226, 232, 236), (236, 232, 238), (220, 234, 232)], a=.02, b=.05, spec=.45, jit=.03)
defmat('LAP', [(30, 66, 158), (24, 52, 134), (42, 88, 184), (22, 46, 118)], a=.12, b=.22, spec=.1)
defmat('TUR', [(52, 178, 174), (40, 160, 162), (84, 198, 188)], a=.08, b=.16)
defmat('MAL', [(24, 126, 88), (16, 104, 72), (44, 150, 100), (12, 90, 64)], a=.08, b=.10, c=.22)
defmat('JAD', [(126, 186, 100), (104, 168, 88), (150, 200, 112)], a=.06, b=.14)
defmat('GLD', [(238, 190, 88), (226, 174, 70), (246, 206, 108)], a=.05, b=.18, jd=.10, bev=.6, spec=1., jit=.04)
defmat('AMB', [(246, 192, 48), (238, 172, 36), (250, 208, 84)], a=.05, b=.16, spec=.15)
defmat('ONX', [(9, 9, 12), (15, 14, 17)], a=.02, b=.04, jd=.15, bev=.5, spec=.1, jit=0)
defmat('GRY', [(134, 138, 144), (120, 124, 132), (148, 150, 154)], a=.10, b=.14)
defmat('SLT', [(64, 68, 78), (56, 60, 70), (74, 78, 88)], a=.10, b=.14, jd=.25)
defmat('ROS', [(228, 158, 138), (216, 144, 126), (238, 174, 152)], a=.06, b=.14)
defmat('COR', [(240, 102, 92), (230, 86, 82)], a=.05, b=.12)
defmat('CAR', [(234, 100, 34), (222, 86, 28), (244, 122, 48)], a=.05, b=.18, spec=.1)
defmat('AME', [(130, 78, 162), (112, 66, 146), (152, 100, 180)], a=.06, b=.16)
defmat('BRN', [(124, 80, 48), (106, 66, 40), (142, 96, 60)], a=.10, b=.2)
defmat('SKN', [(182, 124, 86), (156, 102, 68), (200, 144, 104)], a=.03, b=.06, jit=.02)
defmat('PNK', [(232, 72, 132), (220, 60, 118)], a=.05, b=.12)
defmat('CRM', [(242, 228, 198), (234, 218, 184)], a=.04, b=.08)
defmat('BLK', [(17, 18, 25), (20, 20, 27), (15, 17, 24)], a=.03, b=.16, jd=.5, bev=.5, spec=.06, jit=.05)
defmat('STM', [(214, 220, 224)], a=0, b=0, jd=0, bev=0, spec=0, jit=0)  # steam (pearl wisps)
NMAT = len(MATS)


def stroke_poly(P, w):
    """polyline -> (L, R) offset rails. w scalar or per-point array."""
    P = np.asarray(P, np.float32)
    d = np.gradient(P, axis=0)
    ln = np.hypot(d[:, 0], d[:, 1]) + 1e-6
    n = np.stack([-d[:, 1] / ln, d[:, 0] / ln], 1)
    w = np.broadcast_to(np.asarray(w, np.float32).reshape(-1, 1), (len(P), 1))
    return P + n * w / 2, P - n * w / 2


def resample(P, step):
    P = np.asarray(P, np.float64)
    seg = np.hypot(*np.diff(P, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(math.ceil(s[-1] / step)) + 1)
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, P[:, 0]), np.interp(t, s, P[:, 1])], 1)


def spline(P, step=4.0):
    """smooth curve through control points (pchip in chord-length parameter)."""
    P = np.asarray(P, np.float64)
    seg = np.hypot(*np.diff(P, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    from scipy.interpolate import CubicSpline
    cs = CubicSpline(s, P, bc_type='natural')
    n = max(2, int(s[-1] / step) + 1)
    return cs(np.linspace(0, s[-1], n))


class Path:
    """arc-length parameterised polyline for things that travel."""

    def __init__(self, P, step=3.0, smooth=True, clip=None):
        self.P = spline(P, step) if smooth else resample(P, step)
        if clip:
            x0, y0, x1, y1 = clip
            k = (self.P[:, 0] >= x0) & (self.P[:, 0] <= x1) & (self.P[:, 1] >= y0) & (self.P[:, 1] <= y1)
            self.P = self.P[k]
        seg = np.hypot(*np.diff(self.P, axis=0).T)
        self.s = np.concatenate([[0], np.cumsum(seg)])
        self.L = float(self.s[-1])

    def at(self, s):
        s = np.clip(s, 0, self.L)
        x = np.interp(s, self.s, self.P[:, 0])
        y = np.interp(s, self.s, self.P[:, 1])
        x2 = np.interp(np.clip(s + 2, 0, self.L), self.s, self.P[:, 0])
        y2 = np.interp(np.clip(s + 2, 0, self.L), self.s, self.P[:, 1])
        x1 = np.interp(np.clip(s - 2, 0, self.L), self.s, self.P[:, 0])
        y1 = np.interp(np.clip(s - 2, 0, self.L), self.s, self.P[:, 1])
        return x, y, math.atan2(y2 - y1, x2 - x1)


def arch_pts(cx, by, w, h, kind='pt', n=9):
    hw = w / 2.0
    if kind == 'rd':
        rise = min(hw, h * .9)
        spring = by - (h - rise)
        a = np.linspace(PI, 0, 2 * n + 1)
        cur = np.stack([cx + hw * np.cos(a), spring - rise * np.sin(a)], 1)
    else:
        c = 0.6 * hw
        R = hw + c
        ha = math.sqrt(R * R - c * c)
        rise = min(ha, h * .62)
        spring = by - (h - rise)
        ph = np.linspace(0, math.acos(c / R), n + 1)
        xr = -c + R * np.cos(ph)
        yr = R * np.sin(ph) * rise / ha
        if kind == 'og':
            yr = yr + rise * .10 * np.exp(-(xr / (0.22 * hw)) ** 2)
        right = np.stack([cx + xr, spring - yr], 1)
        left = np.stack([cx - xr, spring - yr], 1)
        cur = np.concatenate([left, right[::-1][1:]], 0)
    return np.concatenate([[(cx - hw, by)], cur, [(cx + hw, by)]], 0)


def ell_pts(cx, cy, rx, ry, n=24, a0=0., a1=2 * PI):
    a = np.linspace(a0, a1, n, endpoint=(abs(a1 - a0) < 2 * PI - 1e-6))
    return np.stack([cx + rx * np.cos(a), cy + ry * np.sin(a)], 1)


def petal_pts(x, y, ang, ln, wd, n=9, p=.75, tipw=0.):
    t = np.linspace(0, 1, n)
    hw = wd / 2 * np.sin(PI * t ** p) ** .9 + tipw * 0
    ca, sa = math.cos(ang), math.sin(ang)
    lx, ly = t * ln, hw
    A = np.stack([x + lx * ca - ly * sa, y + lx * sa + ly * ca], 1)
    B = np.stack([x + lx * ca + ly * sa, y + lx * sa - ly * ca], 1)
    return np.concatenate([A, B[::-1][1:-1]], 0)


ONION = [(0, .78), (.1, .93), (.27, 1.0), (.45, .92), (.63, .68), (.78, .42), (.9, .18), (1, 0)]
HEMI = [(0, 1.0), (.2, .98), (.4, .92), (.6, .8), (.8, .6), (.92, .39), (1, 0)]
BULB = [(0, .9), (.14, .99), (.3, 1.0), (.5, .9), (.7, .68), (.86, .4), (.95, .2), (1, 0)]
SHIK = [(0, 1.0), (.12, .97), (.35, .8), (.6, .54), (.8, .3), (.93, .12), (1, 0)]
SAUCER = [(0, 1.0), (.3, .95), (.6, .8), (.85, .5), (1, 0)]


def figure(h, face=1, body='WHT', hat=None, veil=None, arm=None, skin='SKN', lift=0.):
    """A person the way a miniature painter cuts one: strict profile (brow, nose, chin), a flared jama
    nipped at the waist with a gold sash and hanging patka, one bent arm, and either a wrapped turban
    with a tail or a veil that sweeps down the back. Returns [(pts, material)], origin at the feet."""
    f = float(face)
    out = []

    def P(pts, m):
        p = np.asarray(pts, np.float32) * (h * f, h)
        p[:, 1] -= lift * h
        out.append((p, m))
    P([(-.20, 0), (.20, 0), (.125, -.36), (.105, -.63), (-.095, -.63), (-.12, -.36)], body)
    if veil:
        P([(-.20, 0), (.20, 0), (.19, -.045), (-.19, -.045)], veil)                        # hem border
    else:
        P([(-.125, -.385), (.13, -.385), (.125, -.34), (-.12, -.34)], 'GLD')               # sash
        P([(.03, -.34), (.085, -.34), (.075, -.15), (.045, -.15)], 'GLD')                  # patka
    if arm is None:
        P([(.06, -.6), (.105, -.58), (.12, -.44), (.20, -.47), (.21, -.435), (.085, -.39)], body)
        P([(.195, -.48), (.235, -.47), (.23, -.43), (.20, -.43)], skin)
    else:
        ax, ay = arm[0] * f, arm[1]
        ln = math.hypot(ax, ay) + 1e-6
        nx, ny = -ay / ln * .028, ax / ln * .028
        sx, sy = .07, -.58
        P([(sx + nx, sy + ny), (sx + ax * .8 + nx, sy + ay * .8 + ny), (sx + ax * .8 - nx, sy + ay * .8 - ny), (sx - nx, sy - ny)], body)
        P([(sx + ax * .8 + nx, sy + ay * .8 + ny), (sx + ax + nx * .7, sy + ay + ny * .7), (sx + ax - nx * .7, sy + ay - ny * .7),
           (sx + ax * .8 - nx, sy + ay * .8 - ny)], skin)
    r = .098
    cx, cy = .012, -.63 - r * .92
    prof = [(-.95, -.15), (-.8, -.75), (-.2, -1.02), (.5, -.9), (.88, -.42), (.98, -.12), (1.42, .12), (.98, .3), (.9, .62),
            (.55, .98), (-.1, 1.02), (-.7, .72)]
    P([(cx + px * r, cy + py * r) for px, py in prof], skin)
    if veil:
        P([(cx + px * r, cy + py * r) for px, py in ((.75, -1.0), (0, -1.38), (-.85, -1.05), (-1.3, -.2), (-1.55, 1.6), (-2.1, 4.4),
                                                       (-1.25, 4.7), (-.95, 1.5), (-.72, .1), (-.1, -.72), (.6, -.72))], veil)
    elif hat:
        P([(cx + px * r, cy + py * r) for px, py in ((-1.25, -.25), (-1.2, -1.2), (-.3, -1.8), (.75, -1.62), (1.3, -.95), (1.22, -.4),
                                                       (.4, -.72), (-.5, -.55))], hat)
        P([(cx + px * r, cy + py * r) for px, py in ((-1.15, -.6), (-1.9, -.1), (-1.75, .75), (-1.25, .1))], hat)   # shamla (turban tail)
    else:
        P([(cx + px * r, cy + py * r) for px, py in ((-1.05, .2), (-1.1, -.7), (-.3, -1.22), (.6, -1.05), (.9, -.5), (.2, -.72), (-.5, -.4))], 'ONX')
    return out


class Scene:
    def __init__(self, seed=11):
        self.rng = np.random.default_rng(seed)
        self.items = []
        self.g = dict(name='misc', start=20., span=60., ang=None, style='fly')
        self.river_idx = []

    # ---- grouping / timing
    def group(self, name, start, span, ang=None, style='fly'):
        self.g = dict(name=name, start=float(start), span=float(span), ang=ang, style=style)

    def add(self, pts, m, key=None, style=None, var=None, anchor=None, off=None, shade=1., tag=None):
        pts = np.asarray(pts, np.float32).reshape(-1, 2)
        if key is None:
            key = float(self.rng.random())
        it = dict(pts=pts, m=MAT[m], key=float(min(max(key, 0.), 1.)), style=style or self.g['style'], g=self.g,
                  var=var, anchor=anchor, off=off, shade=shade, tag=tag, nrail=0)
        self.items.append(it)
        return it

    # ---- primitives
    def rect(self, x, y, w, h, m, **k):
        return self.add([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], m, **k)

    def blocks(self, x, y, w, h, rows, cols, m, stag=.5, k0=0., k1=.7, m2=None, p2=0., **k):
        rh = h / rows
        cw = w / cols
        for r in range(rows):
            yy = y + h - (r + 1) * rh
            o = stag if r % 2 else 0.
            xs = [x] + [x + (j + o) * cw for j in range(0 if o else 1, cols)] + [x + w]
            xs = sorted(set(round(v, 3) for v in xs))
            for a, b in zip(xs[:-1], xs[1:]):
                if b - a < .3:
                    continue
                mm = m2 if (m2 and self.rng.random() < p2) else m
                kk = k0 + (k1 - k0) * (r + self.rng.random() * .9) / rows
                self.rect(a, yy, b - a, rh, mm, key=kk, **k)

    def mesh(self, fn, nu, nv, m, sub=3, jit=0., keyfn=None, mfn=None, **k):
        U, V = np.meshgrid(np.linspace(0, 1, nu + 1), np.linspace(0, 1, nv + 1))
        if jit:
            U[:, 1:-1] += (self.rng.random((nv + 1, nu - 1)) - .5) * jit / nu
            V[1:-1, :] += (self.rng.random((nv - 1, nu + 1)) - .5) * jit / nv
        t = np.linspace(0, 1, sub + 1)[:-1]
        key0 = k.pop('key', None)
        out = []
        for j in range(nv):
            for i in range(nu):
                c = [(U[j, i], V[j, i]), (U[j, i + 1], V[j, i + 1]), (U[j + 1, i + 1], V[j + 1, i + 1]), (U[j + 1, i], V[j + 1, i])]
                us, vs = [], []
                for e in range(4):
                    (u0, v0), (u1, v1) = c[e], c[(e + 1) % 4]
                    us.append(u0 + (u1 - u0) * t)
                    vs.append(v0 + (v1 - v0) * t)
                us = np.concatenate(us)
                vs = np.concatenate(vs)
                x, y = fn(us, vs)
                uc, vc = (i + .5) / nu, (j + .5) / nv
                mm = mfn(i, j) if mfn else m
                kk = keyfn(uc, vc) if keyfn else key0
                out.append(self.add(np.stack([x, y], 1), mm, key=kk, **k))
        return out

    def dome(self, cx, by, R, hgt, prof=ONION, gores=7, bands=3, m='WHT', m2=None, k0=.55, k1=.9, finial=0., **k):
        pr = PchipInterpolator(*zip(*prof))

        def fn(u, v):
            th = (u - .5) * PI
            return cx + np.sin(th) * R * pr(v), by - v * hgt

        mfn = (lambda i, j: (m2 if i % 2 else m)) if m2 else None
        self.mesh(fn, gores, bands, m, sub=4, mfn=mfn,
                  keyfn=lambda u, v: k0 + (k1 - k0) * (v * .6 + .4 * self.rng.random()), **k)
        if finial:
            self.line([(cx, by - hgt + 1), (cx, by - hgt - finial)], max(1.0, finial * .12), key=.97)
            self.add(ell_pts(cx, by - hgt - finial * .45, finial * .2, finial * .2, 8), 'GLD', key=.98, style='grow')

    def arch(self, cx, by, w, h, m='ONX', kind='pt', frame=0., fm='GLD', **k):
        p = arch_pts(cx, by, w, h, kind)
        it = self.add(p, m, **k)
        if frame:
            self.line(p, frame, fm, key=min(1., (k.get('key') or .8) + .1))
        return it

    def line(self, pts, w=1.4, m='GLD', key=None, closed=False, step=None, **k):
        P = np.asarray(pts, np.float32)
        if closed:
            P = np.concatenate([P, P[:1]], 0)
        if step:
            P = resample(P, step)
        L, R = stroke_poly(P, w)
        it = self.add(np.concatenate([L, R[::-1]], 0), m, key=key if key is not None else .8 + .2 * self.rng.random(),
                      style='trim', **k)
        it['nrail'] = len(L)
        return it

    def ell(self, cx, cy, rx, ry, m, n=20, **k):
        return self.add(ell_pts(cx, cy, rx, ry, n), m, **k)

    def petal(self, x, y, ang, ln, wd, m, **k):
        k.setdefault('anchor', (x, y))
        return self.add(petal_pts(x, y, ang, ln, wd), m, **k)

    def lawn(self, x, y, w, h, m='MAL', cell=13., jit=.7, **k):
        nu, nv = max(1, int(round(w / cell))), max(1, int(round(h / cell)))
        self.mesh(lambda u, v: (x + u * w, y + v * h), nu, nv, m, sub=1, jit=jit, **k)

    def disc(self, cx, cy, r0, r1, m, nseg, nring=1, a0=0., a1=2 * PI, jit=.0, **k):
        def fn(u, v):
            a = a0 + u * (a1 - a0)
            r = r0 + v * (r1 - r0)
            return cx + r * np.cos(a), cy + r * np.sin(a)
        self.mesh(fn, nseg, nring, m, sub=3, jit=jit, **k)

    # ---- compound motifs
    def chhatri(self, cx, by, w, h, dm='WHT', bm='WHT', prof=HEMI, key=.8, cols=2):
        ph = h * .42
        for i in range(cols):
            x = cx - w / 2 + w * .1 + i * (w * .8 - w * .12) / max(1, cols - 1)
            self.rect(x, by - ph, w * .12, ph, bm, key=key)
        self.rect(cx - w * .58, by - ph - h * .08, w * 1.16, h * .08, bm, key=key + .02)
        self.dome(cx, by - ph - h * .08, w * .46, h * .42, prof, gores=3, bands=1, m=dm, k0=key + .03, k1=key + .08,
                  finial=h * .16)

    def tree(self, x, y, s=14., kind='round', m='MAL', dot=None, key=None):
        k = key if key is not None else .45 + .45 * self.rng.random()
        s = s * 1.5
        m2 = 'JAD' if m == 'MAL' else 'MAL'
        if kind == 'round':
            self.add([(x - s * .07, y), (x + s * .07, y), (x + s * .04, y - s * .55), (x - s * .04, y - s * .55)], 'BRN', key=k - .05,
                     style='grow', anchor=(x, y))
            cy = y - s * .8
            a0 = self.rng.random() * 6
            for i in range(7):
                a = a0 + i * 2 * PI / 7
                self.petal(x, cy, a, s * .5, s * .42, m, key=k + i * .008, style='grow', anchor=(x, cy))
            for i in range(5):
                a = a0 + .4 + i * 2 * PI / 5
                self.petal(x, cy, a, s * .28, s * .24, m2, key=k + .06 + i * .008, style='grow', anchor=(x, cy))
            if dot:
                for i in range(7):
                    a = a0 + i * 2 * PI / 7 + .45
                    self.ell(x + s * .36 * math.cos(a), cy + s * .36 * math.sin(a), s * .06, s * .06, dot, n=6, key=k + .1, style='grow')
        elif kind == 'cyp':
            self.rect(x - s * .04, y - s * .2, s * .08, s * .2, 'BRN', key=k - .05, style='grow', anchor=(x, y))
            self.petal(x, y - s * .12, -PI / 2, s * 1.25, s * .36, m, key=k, style='grow', anchor=(x, y))
            self.petal(x, y - s * .2, -PI / 2, s * .8, s * .16, m2, key=k + .03, style='grow', anchor=(x, y))
        elif kind == 'palm':
            self.line([(x, y), (x + s * .05, y - s * .5), (x - s * .02, y - s)], s * .09, 'BRN', key=k - .05)
            for i, a in enumerate([-2.8, -2.2, -1.57, -.95, -.35, .15, -3.3]):
                self.petal(x - s * .02, y - s, a, s * .55, s * .16, m if i % 2 else m2, key=k + i * .01, style='grow', anchor=(x, y - s))
        elif kind == 'bush':
            for i in range(3):
                self.petal(x, y, -PI / 2 + (i - 1) * .7, s * .6, s * .4, m, key=k, style='grow', anchor=(x, y))

    def spray(self, x, y, s=80., pm='COR', lean=0., kind=0, key=None):
        """large pietra-dura flowering plant: gold stem, paired leaves, a side bud, one bloom."""
        k = key if key is not None else .45 + .3 * self.rng.random()
        top = (x + lean * s * .5, y - s)
        stem = spline([(x, y), (x - lean * s * .2 + .10 * s, y - s * .34), (x + lean * s * .45 - .08 * s, y - s * .7), top], 2.5)
        self.line(stem, s * .02 + .7, 'GLD', key=k)
        for j, t in enumerate((.14, .3, .46, .62)):
            p = stem[int(t * (len(stem) - 1))]
            sg = 1 if j % 2 else -1
            ang = -PI / 2 + sg * (1.1 - .1 * j) + lean * .3
            self.petal(p[0], p[1], ang, s * (.34 - .035 * j), s * .11, 'MAL' if j % 2 else 'JAD', key=k + .03 + j * .012, style='grow')
            self.petal(p[0], p[1], ang + sg * .16, s * (.2 - .02 * j), s * .045, 'JAD' if j % 2 else 'MAL', key=k + .05 + j * .012, style='grow')
        b0 = stem[int(.52 * (len(stem) - 1))]
        sg = -1 if lean > 0 else 1
        bt = (b0[0] + sg * s * .27, b0[1] - s * .2)
        self.line(spline([b0, ((b0[0] + bt[0]) / 2 + sg * s * .03, b0[1] - s * .03), bt], 2.5), s * .012 + .6, 'GLD', key=k + .06)
        for a in (-.9, .9):
            self.petal(bt[0], bt[1], -PI / 2 + sg * .5 + a, s * .09, s * .05, 'MAL', key=k + .1, style='grow')
        for a in (-.28, .28, 0):
            self.petal(bt[0], bt[1], -PI / 2 + sg * .5 + a, s * .15, s * .075, pm, key=k + .12, style='grow')
        tx, ty = top
        pm2 = {'COR': 'PNK', 'PNK': 'COR', 'AMB': 'CAR', 'AME': 'PNK', 'CAR': 'AMB'}.get(pm, 'AMB')
        ba = -PI / 2 + lean * .5
        for a in (-1.3, 1.3):
            self.petal(tx, ty, ba + PI + a * .5, s * .1, s * .06, 'MAL', key=k + .14, style='grow')
        if kind == 0:      # lily fan
            for i, a in enumerate((-1.25, 1.25, -.85, .85, -.42, .42, 0)):
                self.petal(tx, ty, ba + a, s * (.24 + .05 * (1 - abs(a))), s * .13, pm if i % 2 == 0 else pm2, key=k + .16 + i * .008, style='grow')
            for a in (-.3, 0, .3):
                ex, ey = tx + s * .2 * math.cos(ba + a), ty + s * .2 * math.sin(ba + a)
                self.line([(tx, ty), (ex, ey)], .7, 'GLD', key=k + .24)
                self.ell(ex, ey, s * .016 + .5, s * .016 + .5, 'AMB', n=6, key=k + .26, style='grow')
        elif kind == 1:    # open rosette
            cx_, cy_ = tx, ty - s * .04
            for i in range(8):
                self.petal(cx_, cy_, ba + i * PI / 4, s * .21, s * .15, pm if i % 2 else pm2, key=k + .16 + i * .008, style='grow')
            for i in range(6):
                self.petal(cx_, cy_, ba + .3 + i * PI / 3, s * .11, s * .08, 'AMB', key=k + .22 + i * .005, style='grow')
            self.ell(cx_, cy_, s * .03, s * .03, 'RDK', n=8, key=k + .27, style='grow')
        else:              # iris / tulip
            for a in (-2.1, 2.1):
                self.petal(tx, ty, ba + a, s * .2, s * .1, pm2, key=k + .16, style='grow')
            for a in (-.55, .55):
                self.petal(tx, ty, ba + a, s * .26, s * .13, pm, key=k + .18, style='grow')
            self.petal(tx, ty, ba, s * .3, s * .14, pm2, key=k + .2, style='grow')
            self.line([(tx, ty), (tx + s * .2 * math.cos(ba), ty + s * .2 * math.sin(ba))], .7, 'GLD', key=k + .25)

    def sprig(self, *a, **k):
        return

    def person(self, x, y, h=17., body='WHT', head=None, hat=None, face=1, arm=None, key=None, skin='SKN'):
        """profile figure in the miniature convention (see figure())."""
        k = key if key is not None else .8 + .15 * self.rng.random()
        for j, (pts, m) in enumerate(figure(h * 1.42, face, body, hat, head, arm, skin)):
            self.add(pts + (x, y), m, key=min(1., k + .006 * j), style='grow', anchor=(x, y))

    # ---- finalize
    def finalize(self):
        rng = np.random.default_rng(5)
        N = len(self.items)
        n = np.array([len(it['pts']) for it in self.items])
        off = np.concatenate([[0], np.cumsum(n)]).astype(np.int64)
        V = np.concatenate([it['pts'] for it in self.items], 0).astype(np.float32)
        cen = np.stack([it['pts'].mean(0) for it in self.items])
        bb = np.stack([np.concatenate([it['pts'].min(0), it['pts'].max(0)]) for it in self.items])
        mid = np.array([it['m'] for it in self.items], np.uint8)
        col = np.zeros((N, 3), np.float32)
        TL = np.zeros(N, np.float32)
        DUR = np.zeros(N, np.float32)
        OFF = np.zeros((N, 2), np.float32)
        ROT = np.zeros(N, np.float32)
        STY = np.zeros(N, np.uint8)
        ANC = cen.copy().astype(np.float32)
        NR = np.array([it['nrail'] for it in self.items], np.int32)
        for i, it in enumerate(self.items):
            M = MATS[it['m']]
            v = it['var'] if it['var'] is not None else rng.integers(len(M['cols']))
            c = np.array(M['cols'][v % len(M['cols'])], np.float32)
            c = c * (1 + (rng.random() - .5) * 2 * M['jit']) * it['shade']
            col[i] = np.clip(c, 0, 255)
            g = it['g']
            tl = g['start'] + g['span'] * it['key'] + rng.random() * 2
            sty = it['style']
            if sty == 'fly':
                STY[i] = 0
                if it['off'] is not None:
                    OFF[i] = it['off']
                else:
                    if g['ang'] is None:
                        ang = math.atan2(cen[i, 1] - WH / 2, cen[i, 0] - WW / 2) + (rng.random() - .5) * 1.6
                    else:
                        ang = g['ang'] + (rng.random() - .5) * .9
                    d = 620 + 520 * rng.random()
                    OFF[i] = (d * math.cos(ang), d * math.sin(ang))
                DUR[i] = 26 + 14 * rng.random()
                ROT[i] = (rng.random() - .5) * 6
            elif sty == 'grow':
                STY[i] = 1
                DUR[i] = 12 + 8 * rng.random()
                if it['anchor'] is not None:
                    ANC[i] = it['anchor']
            else:
                STY[i] = 2
                P = it['pts'][:it['nrail']]
                ln = float(np.hypot(*np.diff(P, axis=0).T).sum())
                DUR[i] = min(46, 12 + ln / 14)
            if 'dur' in it:
                DUR[i] = it['dur']
            if 'rot' in it:
                ROT[i] = it['rot']
            TL[i] = min(4. + 152. * (max(tl, 0.) / 149.) ** .8, 156.)
        self.N, self.V, self.off, self.cen, self.bb = N, V, off, cen.astype(np.float32), bb.astype(np.float32)
        self.mid, self.col, self.TL, self.DUR, self.OFF, self.ROT, self.STY, self.ANC, self.NR = mid, col, TL, DUR, OFF, ROT, STY, ANC, NR
        self.rid = rng.integers(2, 256, N).astype(np.uint8)
        # un-build: a wind from the left lifts everything away to the upper right
        u = .78 * cen[:, 0] / WW + .22 * cen[:, 1] / WH
        self.TLIFT = (748 + 50 * u + rng.random(N) * 6).astype(np.float32)
        a2 = -.45 + (rng.random(N) - .5) * .9
        d2 = 700 + 500 * rng.random(N)
        self.OFF2 = np.stack([d2 * np.cos(a2), d2 * np.sin(a2)], 1).astype(np.float32)
        self.DUR2 = (22 + 6 * rng.random(N)).astype(np.float32)
        self.tags = {}
        for i, it in enumerate(self.items):
            if it['tag'] is not None:
                self.tags.setdefault(it['tag'][0], []).append((i, it['tag'][1]))
        return self
