"""Scene model: 'Rio de la Luna' - a rainforest river valley whose waterfall pours out of the moon.

The scene is authored ONCE as semantic shapes (role + geometry in paper units) laid out on
pop-up cards.  Every style renderer re-draws the same shapes in its own medium.

Units: 1.0 = one page width.  Card art coords: u = screen-right, t = up from the hinge.
Floor / page art coords: x across the spread (-W..W), y from the near edge (0) to the far edge (H).
"""
from dataclasses import dataclass, field
import numpy as np
import skia
from .popup import Card, Mechanism

W, H = 1.0, 1.55


@dataclass
class Shape:
    kind: str                 # 'fill' | 'line' | 'text'
    role: str                 # palette key
    path: object = None       # skia.Path in units
    tone: float = 0.0         # -1..1 variation hint (darker..lighter)
    w: float = 0.004          # line width (units)
    tags: tuple = ()
    text: str = ''
    pos: tuple = (0.0, 0.0)
    size: float = 0.03
    font: str = 'serif'
    rot: float = 0.0


# ------------------------------------------------------------------ path helpers
def poly(pts, closed=True):
    p = skia.Path()
    p.moveTo(*map(float, pts[0]))
    for q in pts[1:]:
        p.lineTo(*map(float, q))
    if closed:
        p.close()
    return p


def spline(pts, closed=True, k=0.5):
    """Catmull-Rom spline through pts as cubic beziers."""
    pts = [np.asarray(q, float) for q in pts]
    n = len(pts)
    p = skia.Path()
    p.moveTo(*pts[0])
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        if closed:
            p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        else:
            p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        c1 = p1 + (p2 - p0) * k / 3
        c2 = p2 - (p3 - p1) * k / 3
        p.cubicTo(*c1, *c2, *p2)
    if closed:
        p.close()
    return p


def blob(rng, cx, cy, rx, ry, n=9, j=0.16, rot=0.0):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False) + rng.uniform(0, 6.28)
    r = 1 + rng.uniform(-j, j, n)
    x, y = np.cos(a) * rx * r, np.sin(a) * ry * r
    cr, sr = np.cos(rot), np.sin(rot)
    return spline(np.stack([cx + x * cr - y * sr, cy + x * sr + y * cr], 1), True, 0.9)


def ellipse(cx, cy, rx, ry):
    p = skia.Path()
    p.addOval(skia.Rect.MakeLTRB(cx - rx, cy - ry, cx + rx, cy + ry))
    return p


def ribbon(pts, w0, w1=None, closed_spline=False):
    """Tapered stroke as a filled polygon."""
    pts = np.asarray(pts, float)
    if w1 is None:
        w1 = w0
    d = np.gradient(pts, axis=0)
    d /= (np.linalg.norm(d, axis=1, keepdims=True) + 1e-9)
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    ws = np.linspace(w0, w1, len(pts))[:, None] / 2
    out = np.vstack([pts + nrm * ws, (pts - nrm * ws)[::-1]])
    return poly(out)


def curve(p0, p1, bend=0.0, n=9):
    """Points along a bent segment (bend = sideways bulge as fraction of length)."""
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    nrm = np.array([-d[1], d[0]])
    s = np.linspace(0, 1, n)[:, None]
    return p0 + d * s + nrm * bend * 4 * s * (1 - s)


def leaf(x, y, ang, L, wd, bend=0.0):
    """Pointed leaf from base (x,y) heading ang (radians, 0 = +u)."""
    c, s = np.cos(ang), np.sin(ang)
    def T(a, b):
        return (x + a * c - b * s, y + a * s + b * c)
    p = skia.Path()
    p.moveTo(*T(0, 0))
    p.cubicTo(*T(L * 0.25, wd * (0.9 + bend)), *T(L * 0.7, wd * (0.7 + bend)), *T(L, bend * wd * 0.5))
    p.cubicTo(*T(L * 0.7, -wd * (0.7 - bend)), *T(L * 0.25, -wd * (0.9 - bend)), *T(0, 0))
    p.close()
    return p


def union(paths):
    out = paths[0]
    for q in paths[1:]:
        r = skia.Op(out, q, skia.PathOp.kUnion_PathOp)
        out = r if r is not None else out
    return out


def F(role, path, tone=0.0, *tags):
    return Shape('fill', role, path, tone, tags=tuple(tags))


def Ln(role, path, w=0.004, tone=0.0, *tags):
    return Shape('line', role, path, tone, w=w, tags=tuple(tags))


def Tx(text, x, y, size, font='serif', role='ink', rot=0.0, *tags):
    return Shape('text', role, None, 0.0, text=text, pos=(x, y), size=size, font=font, rot=rot, tags=tuple(tags))


def path_pts(path, n=40):
    """Sample points along a path (for validation)."""
    pm = skia.PathMeasure(path, False)
    out = []
    while True:
        L = pm.getLength()
        for i in range(n):
            r = pm.getPosTan(L * i / n)
            if r:
                out.append((r[0].x(), r[0].y()))
        if not pm.nextContour():
            break
    return out


# ------------------------------------------------------------------ motifs
def clump(rng, cx, cy, r, roles=('canopy_a', 'canopy_b', 'canopy_c'), squash=0.8, tone=0.0):
    """One foliage clump: dark body, mid body, light cap (upper-left), a few leaf ticks."""
    out = [F(roles[0], blob(rng, cx, cy, r, r * squash, 9, 0.14), tone, 'foliage')]
    out.append(F(roles[1], blob(rng, cx - r * 0.12, cy + r * 0.14, r * 0.74, r * squash * 0.72, 8, 0.16), tone, 'foliage', 'inner'))
    out.append(F(roles[2], blob(rng, cx - r * 0.28, cy + r * 0.32, r * 0.38, r * squash * 0.34, 7, 0.2), tone, 'foliage', 'hi'))
    for _ in range(3):
        a = rng.uniform(-0.6, 0.6)
        lx, ly = cx + rng.uniform(-0.5, 0.5) * r, cy + rng.uniform(-0.45, 0.2) * r * squash
        out.append(Ln(roles[0], poly(curve((lx, ly), (lx + r * 0.22 * np.cos(a), ly + r * 0.1 * np.sin(a)), 0.25, 5), False),
                      0.0028, tone, 'detail'))
    return out


def canopy(rng, u0, u1, base, top, n, r0, r1, roles=('canopy_a', 'canopy_b', 'canopy_c'), prof=None):
    """A band of clumps between u0..u1; prof(f) scales the height along the band."""
    out = []
    us = np.linspace(u0, u1, n) + rng.uniform(-0.3, 0.3, n) * (u1 - u0) / n
    order = rng.permutation(n)
    for i in order:
        f = (us[i] - u0) / (u1 - u0 + 1e-9)
        h = base + (top - base) * (prof(f) if prof else 1.0) * rng.uniform(0.72, 1.0)
        r = rng.uniform(r0, r1)
        out += clump(rng, us[i], h - r * 0.8, r, roles, 0.8, rng.uniform(-0.5, 0.5))
    return out


def ground_strip(u0, u1, h, role='bank', rng=None):
    rng = rng or np.random.default_rng(1)
    n = 9
    xs = np.linspace(u0, u1, n)
    ys = h * (0.75 + 0.35 * rng.random(n))
    ys[0] = ys[-1] = h * 0.5
    pts = [(u0, 0)] + list(zip(xs, ys)) + [(u1, 0)]
    return F(role, poly(pts), 0.0, 'base')


def emergent(rng, u, base, h, r, lean=0.0, roles=('canopy_a', 'canopy_b', 'canopy_c')):
    """Tall umbrella tree."""
    top = (u + lean, base + h)
    out = [F('trunk', ribbon(curve((u, base), top, 0.04 * np.sign(lean or 1), 7), 0.014, 0.007), 0.0, 'trunk')]
    for dx, dy, s in ((-0.55, -0.05, 0.62), (0.5, -0.1, 0.6), (0.0, 0.1, 0.8)):
        out += clump(rng, top[0] + dx * r, top[1] + dy * r, r * s, roles, 0.5, rng.uniform(-0.3, 0.4))
    return out


def palm(rng, u, base, h, lean=0.03, size=0.1, n=8):
    top = np.array([u + lean, base + h])
    out = [F('trunk', ribbon(curve((u, base), top, 0.08 * np.sign(lean), 9), 0.013, 0.007), 0.3, 'trunk')]
    for i in range(4):
        f = 0.25 + 0.18 * i
        q = np.array([u, base]) + (top - np.array([u, base])) * f
        out.append(Ln('trunk', poly([(q[0] - 0.006, q[1]), (q[0] + 0.006, q[1] + 0.002)], False), 0.002, -0.5, 'detail'))
    angs = np.linspace(np.radians(-25), np.radians(205), n)
    fr = []
    for i, a in enumerate(angs):
        L = size * rng.uniform(0.85, 1.1)
        droop = -0.55 * np.cos(a) * np.sign(np.cos(a)) if abs(np.cos(a)) > 0.3 else 0
        role = ('leaf_a', 'leaf_b')[i % 2]
        fr.append(F(role, leaf(top[0], top[1], a, L, L * 0.2, -0.5 * np.cos(a)), rng.uniform(-0.4, 0.4), 'foliage', 'frond'))
    out += fr
    out.append(F('flower_b', ellipse(top[0] - 0.006, top[1] - 0.008, 0.006, 0.006), 0.0, 'small'))
    out.append(F('flower_b', ellipse(top[0] + 0.007, top[1] - 0.01, 0.006, 0.006), 0.0, 'small'))
    return out


def bigleaf(rng, x, y, ang, L, role='leaf_a', wide=0.42):
    out = [F(role, leaf(x, y, ang, L, L * wide, rng.uniform(-0.2, 0.2)), rng.uniform(-0.4, 0.4), 'foliage', 'leaf')]
    c, s = np.cos(ang), np.sin(ang)
    out.append(Ln(role, poly([(x + 0.08 * L * c, y + 0.08 * L * s), (x + 0.9 * L * c, y + 0.9 * L * s)], False), 0.003, 0.0, 'detail', 'vein'))
    for f in (0.3, 0.5, 0.7):
        bx, by = x + f * L * c, y + f * L * s
        for sg in (-1, 1):
            a2 = ang + sg * 0.9
            out.append(Ln(role, poly([(bx, by), (bx + 0.2 * L * (1 - f * 0.5) * np.cos(a2), by + 0.2 * L * (1 - f * 0.5) * np.sin(a2))], False),
                          0.002, 0.0, 'detail', 'vein'))
    return out


def fern(rng, x, y, ang, L, role='fern'):
    pts = curve((x, y), (x + L * np.cos(ang), y + L * np.sin(ang)), 0.12 * np.sign(np.cos(ang) or 1), 12)
    out = [Ln(role, poly(pts, False), 0.004, -0.3, 'stem')]
    for i in range(1, 11):
        q = pts[i]
        d = pts[min(i + 1, 11)] - pts[i - 1]
        a = np.arctan2(d[1], d[0])
        l = L * 0.2 * (1 - i / 13)
        for sg in (-1, 1):
            out.append(F(role, leaf(q[0], q[1], a + sg * 1.05, l, l * 0.3), rng.uniform(-0.3, 0.3), 'foliage', 'pinna'))
    return out


def heliconia(rng, x, y, h, role='flower_a'):
    out = [Ln('fern', poly(curve((x, y), (x + 0.01, y + h), 0.05, 6), False), 0.004, -0.3, 'stem')]
    for i in range(5):
        yy = y + h * (0.45 + 0.12 * i)
        sg = 1 if i % 2 else -1
        out.append(F(role, poly([(x + 0.008, yy), (x + 0.008 + sg * 0.028, yy + 0.02), (x + 0.008, yy + 0.022)]), 0.3 * (i % 2), 'flower'))
        out.append(F('flower_b', poly([(x + 0.008 + sg * 0.012, yy + 0.012), (x + 0.008 + sg * 0.028, yy + 0.02), (x + 0.008, yy + 0.022)]), 0.0, 'flower', 'small'))
    return out


def lotus(x, y, r, role='flower_a'):
    out = []
    for a in (150, 30, 120, 60, 90):
        out.append(F(role, leaf(x, y, np.radians(a), r, r * 0.34), (a - 90) / 120, 'flower'))
    out.append(F('flower_b', ellipse(x, y + r * 0.12, r * 0.14, r * 0.1), 0, 'flower', 'small'))
    return out


def figure(x, y, h, body='figure_a', hat=True, lantern=False, lean=0.0):
    """Tiny person: robe, head, wide hat; h = total height."""
    out = [F(body, poly([(x - 0.3 * h, y), (x + 0.3 * h, y), (x + 0.16 * h + lean, y + 0.66 * h), (x - 0.16 * h + lean, y + 0.66 * h)]), 0.0, 'figure')]
    out.append(F('skin', ellipse(x + lean, y + 0.76 * h, 0.13 * h, 0.13 * h), 0.0, 'figure', 'small'))
    if hat:
        out.append(F('hat', poly([(x - 0.34 * h + lean, y + 0.8 * h), (x + 0.34 * h + lean, y + 0.8 * h), (x + lean, y + 1.02 * h)]), 0.0, 'figure', 'small'))
    if lantern:
        out.append(Ln('rope', poly([(x + 0.18 * h, y + 0.5 * h), (x + 0.48 * h, y + 0.62 * h)], False), 0.0015, 0, 'detail'))
        out.append(F('glow', ellipse(x + 0.5 * h, y + 0.5 * h, 0.12 * h, 0.14 * h), 0.0, 'glow', 'lantern'))
    return out


def heron(x, y, h, flip=1):
    s = flip
    out = [Ln('heron_leg', poly([(x - 0.02 * h * s, y), (x - 0.01 * h * s, y + 0.42 * h)], False), 0.0028, 0, 'detail'),
           Ln('heron_leg', poly([(x + 0.06 * h * s, y), (x + 0.04 * h * s, y + 0.42 * h)], False), 0.0028, 0, 'detail')]
    out.append(F('heron', blob(np.random.default_rng(3), x, y + 0.52 * h, 0.2 * h, 0.12 * h, 8, 0.05, rot=0.25 * s), 0.0, 'animal'))
    neck = [(x + 0.14 * h * s, y + 0.56 * h), (x + 0.24 * h * s, y + 0.72 * h), (x + 0.16 * h * s, y + 0.86 * h), (x + 0.22 * h * s, y + 0.97 * h)]
    out.append(F('heron', ribbon(np.array(spline_pts(neck, 14)), 0.05 * h, 0.035 * h), 0.2, 'animal'))
    out.append(F('heron', ellipse(x + 0.23 * h * s, y + 0.98 * h, 0.045 * h, 0.035 * h), 0.2, 'animal', 'small'))
    out.append(F('flower_b', poly([(x + 0.26 * h * s, y + 1.0 * h), (x + 0.26 * h * s, y + 0.96 * h), (x + 0.46 * h * s, y + 0.95 * h)]), 0.0, 'animal', 'small'))
    out.append(F('heron_dk', leaf(x - 0.02 * h * s, y + 0.5 * h, np.radians(180 if s > 0 else 0) + 0.25 * s, 0.26 * h, 0.07 * h), -0.3, 'animal', 'small'))
    return out


def spline_pts(pts, n=20):
    pts = np.asarray(pts, float)
    out = []
    m = len(pts)
    for i in range(m - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, m - 1)]
        for s in np.linspace(0, 1, n // (m - 1) + 1, endpoint=(i == m - 2)):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s ** 3))
    return out


def monkey(x, y, s=0.03, flip=1):
    out = [F('monkey', blob(np.random.default_rng(5), x, y, 0.42 * s, 0.5 * s, 8, 0.06), 0.0, 'animal')]
    out.append(F('monkey', ellipse(x + 0.25 * s * flip, y + 0.62 * s, 0.26 * s, 0.24 * s), 0.0, 'animal', 'small'))
    out.append(F('skin', ellipse(x + 0.31 * s * flip, y + 0.6 * s, 0.14 * s, 0.13 * s), 0.0, 'animal', 'small'))
    tail = spline_pts([(x - 0.3 * s * flip, y - 0.3 * s), (x - 0.6 * s * flip, y - 0.9 * s), (x - 0.35 * s * flip, y - 1.3 * s), (x - 0.55 * s * flip, y - 1.5 * s)], 12)
    out.append(Ln('monkey', poly(tail, False), 0.004, 0, 'animal'))
    out.append(Ln('monkey', poly([(x + 0.1 * s * flip, y + 0.3 * s), (x + 0.2 * s * flip, y + 1.25 * s)], False), 0.004, 0, 'animal'))
    return out


def toucan(x, y, s=0.03, flip=1):
    out = [F('bird_dk', blob(np.random.default_rng(8), x, y, 0.3 * s, 0.45 * s, 8, 0.05, rot=-0.3 * flip), 0.0, 'animal')]
    out.append(F('flower_b', leaf(x + 0.12 * s * flip, y + 0.42 * s, np.radians(0 if flip > 0 else 180) - 0.2 * flip, 0.7 * s, 0.16 * s, 0.4 * flip), 0.0, 'animal', 'small'))
    out.append(F('cloud', ellipse(x + 0.1 * s * flip, y + 0.26 * s, 0.14 * s, 0.16 * s), 0.0, 'animal', 'small'))
    out.append(F('bird_dk', leaf(x - 0.08 * s * flip, y - 0.3 * s, np.radians(-110 if flip > 0 else -70), 0.6 * s, 0.1 * s), 0.0, 'animal', 'small'))
    return out


# ------------------------------------------------------------------ the levels
def level_backdrop(rng):
    """Sky wall: karst towers, the pouring moon, cloud bars."""
    S = []
    def tower(u, w, h, role, tone, skew=0.0):
        pts = [(u - w, 0), (u - w * 0.96, h * 0.45), (u - w * 0.72, h * 0.8), (u - w * 0.3 + skew, h * 0.97), (u + skew, h),
               (u + w * 0.34 + skew, h * 0.93), (u + w * 0.74, h * 0.72), (u + w * 0.95, h * 0.4), (u + w, 0)]
        sp = spline_pts(pts, 40)
        return F(role, poly([(u - w, 0)] + [tuple(q) for q in sp] + [(u + w, 0)]), tone, 'peak')

    far = [(-0.47, 0.17, 0.985, 0.02), (0.43, 0.16, 0.92, -0.02), (-0.72, 0.15, 0.62, 0.0), (0.7, 0.14, 0.66, 0.0),
           (-0.26, 0.12, 0.64, 0.02), (0.25, 0.11, 0.56, -0.01), (-0.9, 0.09, 0.3, 0), (0.88, 0.1, 0.34, 0), (-0.07, 0.1, 0.42, 0.01), (0.08, 0.1, 0.38, 0.0)]
    for i, (u, w, h, sk) in enumerate(far):
        S.append(tower(u, w, h, 'peak_far', (i % 3 - 1) * 0.4, sk))
    # light facets on the far towers
    for (u, w, h, sk) in far[:6]:
        S.append(F('peak_hi', poly([(u - w * 0.62, h * 0.5), (u - w * 0.3 + sk, h * 0.95), (u + sk - w * 0.02, h * 0.985), (u - w * 0.18, h * 0.5)]), 0.0, 'peak', 'hi'))
    mid = [(-0.6, 0.13, 0.5, 0.01), (0.57, 0.14, 0.47, 0.0), (-0.34, 0.11, 0.4, 0.0), (0.31, 0.1, 0.36, 0.01), (-0.82, 0.1, 0.27, 0),
           (0.8, 0.1, 0.28, 0), (-0.14, 0.08, 0.3, 0.0), (0.13, 0.075, 0.27, 0.0)]
    for i, (u, w, h, sk) in enumerate(mid):
        S.append(tower(u, w, h, 'peak_mid', (i % 3 - 1) * 0.4, sk))
        S.append(F('peak_mid_hi', poly([(u - w * 0.6, h * 0.5), (u - w * 0.3 + sk, h * 0.95), (u + sk, h * 0.98), (u - w * 0.2, h * 0.5)]), 0.0, 'peak', 'hi'))
    # strata ticks
    for (u, w, h, sk) in far[:6] + mid[:4]:
        for k in range(4):
            x = u + rng.uniform(-0.5, 0.6) * w
            y = h * rng.uniform(0.3, 0.8)
            S.append(Ln('peak_far', poly([(x, y), (x + 0.004, y - 0.07 * h)], False), 0.0025, -0.6, 'detail', 'strata'))
    # cloud bars
    def cloud(cx, cy, w, hgt, seed):
        r = np.random.default_rng(seed)
        parts = [ellipse(cx + (i - 2) * w * 0.22, cy + r.uniform(-0.2, 0.5) * hgt, w * r.uniform(0.2, 0.3), hgt * r.uniform(0.7, 1.1)) for i in range(5)]
        parts.append(poly([(cx - w * 0.6, cy - hgt * 0.5), (cx + w * 0.6, cy - hgt * 0.5), (cx + w * 0.5, cy + hgt * 0.2), (cx - w * 0.5, cy + hgt * 0.2)]))
        return union(parts)
    for (cx, cy, w, hg, sd) in ((-0.5, 0.6, 0.3, 0.04, 1), (0.52, 0.5, 0.28, 0.036, 2), (-0.2, 0.34, 0.22, 0.03, 3), (0.28, 0.31, 0.2, 0.028, 4), (-0.74, 0.3, 0.2, 0.03, 6)):
        S.append(F('cloud', cloud(cx, cy, w, hg, sd), 0.0, 'cloud'))
        S.append(Ln('cloud', poly([(cx - w * 0.38, cy - hg * 0.2), (cx + w * 0.3, cy - hg * 0.2)], False), 0.0025, -0.5, 'detail'))
    # low jungle fringe glued to the foot of the wall
    S += canopy(rng, -0.93, -0.06, 0.02, 0.2, 13, 0.05, 0.075, ('canopy_d', 'canopy_d2', 'canopy_d3'), prof=lambda f: 0.6 + 0.4 * np.sin(f * 3.1))
    S += canopy(rng, 0.06, 0.92, 0.02, 0.19, 13, 0.05, 0.075, ('canopy_d', 'canopy_d2', 'canopy_d3'), prof=lambda f: 0.6 + 0.4 * np.sin(f * 3.1))
    S.append(ground_strip(-0.95, 0.95, 0.03, 'canopy_d'))
    return S


def level_moon(rng):
    """The moon: a flat bridge across the backdrop V-fold; the river pours out of it."""
    S = [F('disc_ring', ellipse(0, 0.555, 0.262, 0.262), 0.0, 'glow', 'halo'),
         F('disc', ellipse(0, 0.555, 0.222, 0.222), 0.0, 'glow', 'moon')]
    for (cx, cy, r) in ((-0.085, 0.63, 0.045), (0.1, 0.61, 0.028), (0.03, 0.7, 0.02), (-0.13, 0.5, 0.018), (0.12, 0.49, 0.035), (-0.02, 0.56, 0.014)):
        S.append(F('disc_mark', ellipse(cx, cy, r, r * 0.92), 0.0, 'moonmark'))
    fall = [(-0.03, 0.47), (-0.03, 0.3), (-0.04, 0.1), (0.04, 0.1), (0.03, 0.3), (0.03, 0.47)]
    S.append(F('water', poly(fall), 0.3, 'water', 'skyfall'))
    S.append(F('foam', ellipse(0, 0.47, 0.052, 0.022), 0.0, 'water', 'small'))
    for dx in (-0.015, 0.0, 0.015):
        S.append(Ln('water_lt', poly([(dx, 0.45), (dx * 1.3, 0.12)], False), 0.0035, 0.0, 'flow'))
    return S


def level_jungle(rng, side):
    """Far jungle tier (one card per page) with emergent trees and palms."""
    s = -1 if side == 'L' else 1
    u0, u1 = (0.07, 0.84) if s > 0 else (-0.86, -0.07)
    S = [ground_strip(u0, u1, 0.05, 'canopy_a', rng)]
    for (f, h, r, ln) in ((0.2, 0.36, 0.07, 0.02), (0.52, 0.43, 0.085, -0.02), (0.8, 0.3, 0.06, 0.015)):
        S += emergent(rng, u0 + f * (u1 - u0), 0.1, h, r, ln * s)
    S += palm(rng, u0 + 0.36 * (u1 - u0), 0.12, 0.26, 0.03 * s, 0.085)
    S += palm(rng, u0 + 0.67 * (u1 - u0), 0.1, 0.22, -0.025 * s, 0.075)
    prof = (lambda f: 0.75 + 0.25 * np.sin(f * 6.3 + 1)) if s > 0 else (lambda f: 0.75 + 0.25 * np.cos(f * 5.1))
    S += canopy(rng, u0 + 0.03, u1 - 0.03, 0.05, 0.25, 12, 0.055, 0.085, prof=prof)
    S += canopy(rng, u0 + 0.03, u1 - 0.03, 0.02, 0.13, 10, 0.04, 0.06, ('canopy_a', 'canopy_b', 'canopy_c'))
    # a few blossoms in the canopy
    for _ in range(7):
        x, y = rng.uniform(u0 + 0.05, u1 - 0.05), rng.uniform(0.07, 0.2)
        S.append(F(('flower_a', 'flower_b', 'flower_c')[_ % 3], ellipse(x, y, 0.008, 0.008), 0.0, 'flower', 'small'))
    return S


def level_cliffs(rng):
    """Gorge V-fold: the waterfall drops down the crease, a rope bridge spans it."""
    S = []
    for s in (-1, 1):
        top = [(0.06, 0.25), (0.1, 0.3), (0.2, 0.315), (0.3, 0.35), (0.4, 0.33), (0.47, 0.27), (0.55, 0.24), (0.6, 0.15)]
        pts = [(0.045 * s, 0)] + [(u * s, t) for u, t in top] + [(0.61 * s, 0)]
        S.append(F('cliff', poly(pts), 0.0, 'rock'))
        # facets
        for (a, b, c_, d, role, tone) in (
                ((0.1, 0.3), (0.2, 0.315), (0.17, 0.1), (0.09, 0.07), 'cliff_lt', 0.0),
                ((0.3, 0.35), (0.4, 0.33), (0.38, 0.12), (0.27, 0.16), 'cliff_lt', 0.3),
                ((0.2, 0.315), (0.3, 0.35), (0.27, 0.16), (0.17, 0.1), 'cliff_dk', 0.0),
                ((0.4, 0.33), (0.47, 0.27), (0.5, 0.05), (0.38, 0.12), 'cliff_dk', 0.3),
                ((0.47, 0.27), (0.55, 0.24), (0.57, 0.04), (0.5, 0.05), 'cliff_lt', -0.3)):
            S.append(F(role, poly([(a[0] * s, a[1]), (b[0] * s, b[1]), (c_[0] * s, c_[1]), (d[0] * s, d[1])]), tone, 'rock', 'facet'))
        for k in range(9):
            x = rng.uniform(0.09, 0.56)
            y = rng.uniform(0.05, 0.24)
            S.append(Ln('cliff', poly([(x * s, y), ((x + 0.03) * s, y + 0.004), ((x + 0.05) * s, y - 0.006)], False), 0.0028, -0.6, 'detail', 'strata'))
        # hanging vines
        for x in (0.13, 0.24, 0.34, 0.44, 0.52):
            L = rng.uniform(0.06, 0.13)
            ytop = np.interp(x, [u for u, _ in top], [t for _, t in top]) - 0.01
            S.append(Ln('fern', poly(curve((x * s, ytop), ((x + 0.008) * s, ytop - L), 0.06, 7), False), 0.0035, -0.2, 'vine'))
            for j in range(3):
                S.append(F('leaf_b', leaf(x * s, ytop - L * (0.3 + 0.3 * j), np.radians(-60 if j % 2 else -120), 0.022, 0.008), 0.2, 'foliage', 'small'))
        # jungle on the rim
        S += canopy(rng, 0.1 * s, 0.58 * s, 0.27, 0.45, 7, 0.045, 0.07, prof=lambda f: 0.7 + 0.3 * np.sin(f * 3.1))
        S += palm(rng, 0.36 * s, 0.33, 0.14, 0.02 * s, 0.06, 7)
        S.append(F('cave', blob(rng, 0.44 * s, 0.07, 0.035, 0.05, 8, 0.1), 0.0, 'dark')) if s < 0 else None
    # water: lip, fall, foam
    S.append(F('water', poly([(-0.06, 0.262), (0.06, 0.262), (0.075, 0.0), (-0.075, 0.0)]), 0.0, 'water', 'fall'))
    S.append(F('water_lt', poly([(-0.06, 0.262), (0.06, 0.262), (0.055, 0.235), (-0.055, 0.235)]), 0.0, 'water', 'lip'))
    for dx in (-0.04, -0.02, 0.0, 0.02, 0.04):
        S.append(Ln('water_lt', poly([(dx, 0.235), (dx * 1.25, 0.03)], False), 0.004, 0.0, 'flow'))
    for i in range(6):
        S.append(F('foam', ellipse(-0.075 + 0.03 * i, 0.012 + 0.008 * (i % 2), 0.026, 0.02), 0.0, 'water', 'foam'))
    # rope bridge with travellers
    bx = np.linspace(-0.27, 0.27, 25)
    sag = 0.335 - 0.055 * (1 - (bx / 0.27) ** 2)
    S.append(Ln('rope', poly(list(zip(bx, sag)), False), 0.006, 0.0, 'bridge'))
    S.append(Ln('rope', poly(list(zip(bx, sag + 0.03)), False), 0.0022, 0.0, 'bridge'))
    for i in range(0, 25, 2):
        S.append(Ln('rope', poly([(bx[i], sag[i]), (bx[i], sag[i] + 0.03)], False), 0.0016, 0.0, 'bridge', 'detail'))
    for (i, body, lan) in ((6, 'figure_a', False), (10, 'figure_b', True), (17, 'figure_c', False)):
        S += figure(bx[i], sag[i] + 0.002, 0.034, body, True, lan)
    S.append(ground_strip(-0.6, 0.6, 0.02, 'bank'))
    return S


def level_temple(rng):
    """Right page: the ruin, strangled by a fig, pilgrims on its stair."""
    S = []
    uc = 0.41
    tiers = [(0.215, 0.0, 0.058), (0.18, 0.058, 0.118), (0.142, 0.118, 0.174), (0.104, 0.174, 0.226)]
    for i, (hw, y0, y1) in enumerate(tiers):
        S.append(F('stone', poly([(uc - hw, y0), (uc + hw, y0), (uc + hw - 0.008, y1), (uc - hw + 0.008, y1)]), (i % 2) * 0.5 - 0.2, 'stone'))
        S.append(F('stone_lt', poly([(uc - hw + 0.008, y1 - 0.009), (uc + hw - 0.008, y1 - 0.009), (uc + hw - 0.008, y1), (uc - hw + 0.008, y1)]), 0.0, 'stone', 'hi'))
        S.append(F('stone_dk', poly([(uc + hw * 0.55, y0), (uc + hw, y0), (uc + hw - 0.008, y1 - 0.009), (uc + hw * 0.55, y1 - 0.009)]), 0.0, 'stone', 'shade'))
        for k in range(3):                       # niches
            x = uc - hw * 0.78 + k * hw * 0.26
            if abs(x - uc) > 0.05:
                S.append(F('stone_dk', poly([(x, y0 + 0.012), (x + 0.016, y0 + 0.012), (x + 0.016, y0 + 0.036), (x + 0.008, y0 + 0.042), (x, y0 + 0.036)]), 0.2, 'stone', 'small'))
        for k in range(4):
            x = uc - hw + rng.uniform(0.02, 2 * hw - 0.04)
            S.append(Ln('stone', poly([(x, y0 + rng.uniform(0.012, 0.04)), (x + rng.uniform(0.015, 0.04), y0 + rng.uniform(0.012, 0.04))], False), 0.0022, -0.6, 'detail'))
    # shrine + door + roof comb
    S.append(F('stone', poly([(uc - 0.066, 0.226), (uc + 0.066, 0.226), (uc + 0.06, 0.3), (uc - 0.06, 0.3)]), 0.3, 'stone'))
    S.append(F('stone_dk', poly([(uc + 0.03, 0.226), (uc + 0.066, 0.226), (uc + 0.06, 0.3), (uc + 0.03, 0.3)]), 0.0, 'stone', 'shade'))
    S.append(F('stone_lt', poly([(uc - 0.078, 0.3), (uc + 0.078, 0.3), (uc + 0.072, 0.315), (uc - 0.072, 0.315)]), 0.0, 'stone', 'hi'))
    for k, (hw, y0, y1) in enumerate(((0.05, 0.315, 0.335), (0.034, 0.335, 0.355), (0.018, 0.355, 0.378))):
        S.append(F('stone', poly([(uc - hw, y0), (uc + hw, y0), (uc + hw - 0.004, y1), (uc - hw + 0.004, y1)]), 0.2 - 0.3 * k, 'stone'))
    door = skia.Path()
    door.moveTo(uc - 0.02, 0.226); door.lineTo(uc - 0.02, 0.268); door.cubicTo(uc - 0.02, 0.29, uc + 0.02, 0.29, uc + 0.02, 0.268); door.lineTo(uc + 0.02, 0.226); door.close()
    S.append(F('door', door, 0.0, 'dark'))
    d2 = skia.Path()
    d2.moveTo(uc - 0.012, 0.226); d2.lineTo(uc - 0.012, 0.264); d2.cubicTo(uc - 0.012, 0.279, uc + 0.012, 0.279, uc + 0.012, 0.264); d2.lineTo(uc + 0.012, 0.226); d2.close()
    S.append(F('glow', d2, 0.0, 'glow', 'door'))
    # stair
    S.append(F('stone_lt', poly([(uc - 0.05, 0.0), (uc + 0.05, 0.0), (uc + 0.024, 0.226), (uc - 0.024, 0.226)]), 0.2, 'stone', 'stair'))
    for k in range(1, 12):
        y = 0.226 * k / 12
        hw = 0.05 - 0.026 * k / 12
        S.append(Ln('stone', poly([(uc - hw, y), (uc + hw, y)], False), 0.002, -0.5, 'detail'))
    # carved eyes: the temple is quietly watching
    for sx in (-1, 1):
        ex = uc + sx * 0.105
        S.append(Ln('stone', poly(curve((ex - 0.022, 0.148), (ex + 0.022, 0.148), -0.16, 7), False), 0.0035, -0.8, 'detail', 'eye'))
    # strangler fig on the right shoulder
    trunk = curve((uc + 0.165, 0.118), (uc + 0.14, 0.31), -0.05, 8)
    S.append(F('trunk', ribbon(trunk, 0.03, 0.016), 0.0, 'trunk'))
    for (x0, y0, x1, y1, bd) in ((uc + 0.17, 0.2, uc + 0.2, 0.0, 0.05), (uc + 0.15, 0.17, uc + 0.11, 0.058, -0.06), (uc + 0.16, 0.14, uc + 0.185, 0.058, 0.03),
                                 (uc + 0.14, 0.22, uc + 0.075, 0.174, 0.08), (uc - 0.19, 0.118, uc - 0.2, 0.0, 0.04)):
        S.append(F('trunk', ribbon(curve((x0, y0), (x1, y1), bd, 8), 0.011, 0.004), 0.3, 'trunk', 'root'))
    for (dx, dy, r) in ((0.1, 0.33, 0.06), (0.19, 0.36, 0.055), (0.15, 0.41, 0.058), (0.22, 0.28, 0.04)):
        S += clump(rng, uc + dx, dy, r, tone=rng.uniform(-0.3, 0.3))
    # moss + offerings + lanterns + pilgrims
    for (x, y, r) in ((uc - 0.2, 0.062, 0.03), (uc - 0.13, 0.122, 0.024), (uc + 0.07, 0.178, 0.02), (uc - 0.09, 0.23, 0.018), (uc - 0.17, 0.008, 0.035)):
        S.append(F('canopy_b', blob(rng, x, y, r, r * 0.45, 8, 0.2), 0.2, 'foliage', 'moss'))
        S.append(F('canopy_c', blob(rng, x - r * 0.2, y + r * 0.12, r * 0.5, r * 0.2, 7, 0.2), 0.2, 'foliage', 'moss', 'hi'))
    for (x, y) in ((uc - 0.165, 0.118), (uc + 0.165 - 0.06, 0.118), (uc - 0.128, 0.174), (uc + 0.09, 0.174), (uc - 0.06, 0.0), (uc + 0.06, 0.0)):
        S.append(Ln('stone_dk', poly([(x, y), (x, y + 0.016)], False), 0.003, 0, 'detail'))
        S.append(F('glow', ellipse(x, y + 0.023, 0.0075, 0.009), 0.0, 'glow', 'lantern'))
    S += figure(uc - 0.012, 0.075, 0.03, 'figure_b', True, True)
    S += figure(uc + 0.012, 0.15, 0.027, 'figure_a', True, False)
    S += figure(uc - 0.09, 0.118, 0.028, 'figure_c', True, False)
    S += figure(uc + 0.045, 0.3 + 0.015, 0.024, 'figure_a', False, False)
    S.append(ground_strip(0.17, 0.66, 0.018, 'bank'))
    return S


def level_tree(rng):
    """Left page: the great kapok with monkeys, a toucan, lianas and orchids."""
    S = []
    S += palm(rng, -0.57, 0.02, 0.27, -0.03, 0.09)
    trunk = [(-0.47, 0.0), (-0.41, 0.04), (-0.385, 0.12), (-0.38, 0.3), (-0.33, 0.3), (-0.325, 0.12), (-0.3, 0.05), (-0.22, 0.0)]
    S.append(F('trunk', spline(trunk[:4] + trunk[4:], True, 0.6), 0.0, 'trunk'))
    S.append(F('trunk_lt', poly([(-0.372, 0.03), (-0.36, 0.12), (-0.358, 0.3), (-0.345, 0.3), (-0.347, 0.12), (-0.352, 0.02)]), 0.0, 'trunk', 'hi'))
    for (x0, x1) in ((-0.44, -0.39), (-0.27, -0.325), (-0.34, -0.352)):
        S.append(Ln('trunk', poly(curve((x0, 0.0), (x1, 0.14), 0.08, 6), False), 0.003, -0.6, 'detail'))
    limbs = [((-0.36, 0.28), (-0.52, 0.42), 0.06), ((-0.355, 0.29), (-0.33, 0.47), -0.03), ((-0.345, 0.28), (-0.2, 0.4), -0.06)]
    for a, b, bd in limbs:
        S.append(F('trunk', ribbon(curve(a, b, bd, 8), 0.03, 0.012), 0.2, 'trunk'))
    for (x, y, r) in ((-0.53, 0.43, 0.075), (-0.43, 0.5, 0.08), (-0.31, 0.52, 0.085), (-0.2, 0.44, 0.07), (-0.38, 0.41, 0.07), (-0.26, 0.4, 0.06), (-0.47, 0.37, 0.05)):
        S += clump(rng, x, y, r, tone=rng.uniform(-0.4, 0.4))
    for (x, y, L) in ((-0.5, 0.36, 0.2), (-0.44, 0.38, 0.13), (-0.27, 0.36, 0.17), (-0.2, 0.39, 0.12), (-0.3, 0.37, 0.08)):
        S.append(Ln('fern', poly(curve((x, y), (x + 0.01, y - L), 0.07, 8), False), 0.0035, -0.2, 'vine'))
        for j in range(3):
            S.append(F('leaf_b', leaf(x + 0.004, y - L * (0.35 + 0.28 * j), np.radians(-50 if j % 2 else -130), 0.024, 0.009), 0.2, 'foliage', 'small'))
    S += monkey(-0.5, 0.2, 0.034, 1)
    S += monkey(-0.262, 0.215, 0.03, -1)
    S += toucan(-0.24, 0.415, 0.036, 1)
    for (x, y) in ((-0.39, 0.2), (-0.34, 0.15), (-0.375, 0.09), (-0.335, 0.24)):
        S.append(F('flower_c', ellipse(x, y, 0.009, 0.009), 0.0, 'flower', 'small'))
        S.append(F('flower_b', ellipse(x, y, 0.0035, 0.0035), 0.0, 'flower', 'small'))
    for (x, a, L) in ((-0.56, 100, 0.12), (-0.5, 60, 0.1), (-0.2, 120, 0.1), (-0.17, 70, 0.12)):
        S += bigleaf(rng, x, 0.01, np.radians(a), L, 'leaf_a' if L > 0.1 else 'leaf_b')
    S.append(ground_strip(-0.62, -0.15, 0.022, 'bank'))
    return S


def level_court(rng):
    """Temple forecourt: gate posts, stone lanterns, two pilgrims."""
    S = [F('stone', poly([(0.23, 0), (0.5, 0), (0.5, 0.03), (0.23, 0.03)]), -0.2, 'stone')]
    S.append(F('stone_lt', poly([(0.23, 0.03), (0.5, 0.03), (0.5, 0.038), (0.23, 0.038)]), 0, 'stone', 'hi'))
    for x in (0.25, 0.47):
        S.append(F('stone', poly([(x - 0.014, 0.03), (x + 0.014, 0.03), (x + 0.011, 0.1), (x - 0.011, 0.1)]), 0.2, 'stone'))
        S.append(F('stone_lt', poly([(x - 0.02, 0.1), (x + 0.02, 0.1), (x + 0.014, 0.112), (x - 0.014, 0.112)]), 0, 'stone', 'hi'))
        S.append(F('glow', ellipse(x, 0.072, 0.007, 0.011), 0.0, 'glow', 'lantern'))
    S.append(F('door', poly([(0.335, 0.0), (0.395, 0.0), (0.395, 0.03), (0.335, 0.03)]), 0, 'dark'))
    S += figure(0.31, 0.038, 0.03, 'figure_a', True, True)
    S += figure(0.425, 0.038, 0.028, 'figure_c', True, False)
    for (x, a, L) in ((0.235, 110, 0.07), (0.5, 60, 0.08), (0.49, 95, 0.06)):
        S += bigleaf(rng, x, 0.0, np.radians(a), L, 'leaf_b')
    S += fern(rng, 0.26, 0.0, np.radians(75), 0.09)
    return S


def level_fernsL(rng):
    S = [ground_strip(-0.5, -0.2, 0.02, 'bank')]
    for (x, a, L) in ((-0.47, 110, 0.17), (-0.42, 75, 0.2), (-0.36, 100, 0.15), (-0.3, 60, 0.18), (-0.25, 95, 0.14)):
        S += fern(rng, x, 0.0, np.radians(a), L)
    for (x, a, L, role) in ((-0.45, 60, 0.11, 'leaf_a'), (-0.33, 120, 0.12, 'leaf_b'), (-0.23, 70, 0.1, 'leaf_a')):
        S += bigleaf(rng, x, 0.0, np.radians(a), L, role)
    S += heliconia(rng, -0.39, 0.0, 0.2)
    S += heliconia(rng, -0.27, 0.0, 0.16, 'flower_c')
    return S


def level_frontL(rng):
    """Nearest left card: giant leaves, lotus, a heron fishing."""
    S = [ground_strip(-0.36, -0.05, 0.016, 'bank')]
    for (x, a, L, role) in ((-0.33, 105, 0.15, 'leaf_a'), (-0.29, 70, 0.17, 'leaf_b'), (-0.24, 115, 0.13, 'leaf_b'), (-0.2, 80, 0.16, 'leaf_a'), (-0.31, 140, 0.1, 'leaf_b')):
        S += bigleaf(rng, x, 0.0, np.radians(a), L, role, 0.5)
    S += heliconia(rng, -0.26, 0.0, 0.17)
    S += lotus(-0.17, 0.035, 0.035, 'flower_a')
    S.append(Ln('fern', poly([(-0.17, 0.0), (-0.17, 0.035)], False), 0.0035, 0, 'stem'))
    S += heron(-0.105, 0.0, 0.15, 1)
    for x in (-0.345, -0.15, -0.07):
        S += fern(rng, x, 0.0, np.radians(rng.uniform(70, 110)), 0.06)
    return S


def level_frontR(rng):
    S = [ground_strip(0.2, 0.345, 0.014, 'bank')]
    for x in np.linspace(0.21, 0.335, 9):
        h = rng.uniform(0.06, 0.125)
        S.append(F('fern', ribbon(curve((x, 0), (x + rng.uniform(-0.012, 0.012), h), rng.uniform(-0.1, 0.1), 6), 0.007, 0.002), rng.uniform(-0.4, 0.4), 'foliage', 'reed'))
        if rng.random() < 0.45:
            S.append(F('trunk', ellipse(x, h * 0.92, 0.0045, 0.013), 0.0, 'small'))
    S += lotus(0.245, 0.03, 0.03, 'flower_a')
    S += lotus(0.305, 0.045, 0.026, 'flower_c')
    for x in (0.245, 0.305):
        S.append(Ln('fern', poly([(x, 0.0), (x, 0.035)], False), 0.003, 0, 'stem'))
    return S


def level_canoe(rng):
    """Slider piece: canoe with two paddlers and a prow lantern (card coords centred on u=0)."""
    hull = skia.Path()
    hull.moveTo(-0.085, 0.03); hull.cubicTo(-0.06, 0.0, 0.06, 0.0, 0.085, 0.03)
    hull.cubicTo(0.06, 0.018, -0.06, 0.018, -0.085, 0.03); hull.close()
    S = [F('canoe', hull, 0.0, 'canoe')]
    S.append(Ln('canoe', poly(curve((-0.07, 0.015), (0.07, 0.015), 0.03, 7), False), 0.002, 0.6, 'detail'))
    S += figure(-0.03, 0.016, 0.034, 'figure_b', True, False, 0.002)
    S += figure(0.028, 0.016, 0.032, 'figure_a', True, False, 0.002)
    S.append(Ln('rope', poly([(0.074, 0.026), (0.078, 0.052)], False), 0.002, 0, 'detail'))
    S.append(F('glow', ellipse(0.078, 0.058, 0.008, 0.01), 0.0, 'glow', 'lantern'))
    return S


# ------------------------------------------------------------------ floor and flat pages
RIVER_C = [(0.0, 0.47), (0.03, 0.4), (0.06, 0.32), (0.08, 0.24), (0.075, 0.16), (0.04, 0.08), (0.0, 0.0), (-0.02, -0.03)]
RIVER_W = [0.3, 0.2, 0.15, 0.17, 0.24, 0.36, 0.5, 0.55]
CANOE_PATH = [(0.082, 0.325), (0.092, 0.25), (0.094, 0.18), (0.088, 0.12)]


def river_path():
    c = np.array(spline_pts(RIVER_C, 40))
    w = np.interp(np.linspace(0, 1, len(c)), np.linspace(0, 1, len(RIVER_W)), RIVER_W)
    return ribbon_var(c, w), c, w


def ribbon_var(pts, ws):
    d = np.gradient(pts, axis=0)
    d /= (np.linalg.norm(d, axis=1, keepdims=True) + 1e-9)
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    out = np.vstack([pts + nrm * ws[:, None] / 2, (pts - nrm * ws[:, None] / 2)[::-1]])
    return spline(out[::3], True, 0.8)


def floor_shapes(rng):
    """Printed ground of the pop-up spread, in spread coords (x, y)."""
    S = []
    isl = [(-0.93, 0.5), (-0.9, 0.9), (-0.6, 1.16), (-0.2, 1.27), (0.25, 1.26), (0.66, 1.14), (0.93, 0.86), (0.94, 0.45), (0.86, 0.16), (0.62, 0.035),
           (0.3, -0.04), (-0.3, -0.04), (-0.5, 0.17), (-0.88, 0.24)]
    S.append(F('ground', spline(isl, True, 0.9), 0.0, 'ground'))
    for (cx, cy, rx, ry, role, tn) in ((-0.5, 0.42, 0.3, 0.2, 'bank', 0.2), (0.52, 0.4, 0.3, 0.2, 'bank', -0.1), (-0.25, 0.75, 0.42, 0.22, 'bank', -0.3), (0.3, 0.78, 0.4, 0.2, 'bank', 0.3),
                                       (-0.6, 0.85, 0.2, 0.16, 'canopy_a', 0), (0.62, 0.8, 0.2, 0.16, 'canopy_a', 0.3), (-0.34, 0.16, 0.2, 0.09, 'bank', 0.4), (0.44, 0.12, 0.18, 0.07, 'bank', 0.2)):
        S.append(F(role, blob(rng, cx, cy, rx, ry, 11, 0.14), tn, 'ground'))
    rp, c, w = river_path()
    sand = ribbon_var(c, w + 0.07)
    S.append(F('sand', sand, 0.0, 'ground'))
    S.append(F('water', rp, 0.0, 'water', 'river'))
    S.append(F('water', ellipse(0.0, 0.455, 0.17, 0.085), 0.0, 'water', 'pool'))
    S.append(F('water_dp', ribbon_var(c, w * 0.5), 0.0, 'water', 'deep'))
    S.append(F('foam', ellipse(0.0, 0.49, 0.1, 0.03), 0.0, 'water', 'foam'))
    # path from the temple to a jetty
    for q in spline_pts([(0.36, 0.3), (0.33, 0.22), (0.26, 0.15), (0.2, 0.12)], 14):
        S.append(F('sand', ellipse(q[0], q[1], 0.014, 0.009), 0.3, 'ground', 'small'))
    S.append(F('trunk', poly([(0.13, 0.108), (0.215, 0.118), (0.213, 0.134), (0.128, 0.124)]), 0.2, 'jetty'))
    for k in range(5):
        x = 0.14 + 0.017 * k
        S.append(Ln('trunk', poly([(x, 0.11 + 0.002 * k), (x - 0.002, 0.126 + 0.002 * k)], False), 0.002, -0.6, 'detail'))
    S.append(Ln('ink', poly(spline_pts(CANOE_PATH, 16), False), 0.0035, 0, 'slot'))
    # stepping stones, lily pads
    for (x, y, r) in ((-0.15, 0.115, 0.022), (-0.09, 0.1, 0.019), (-0.03, 0.105, 0.02), (0.02, 0.09, 0.016)):
        S.append(F('stone', blob(rng, x, y, r, r * 0.62, 7, 0.12), 0.3, 'stone'))
        S.append(F('stone_lt', blob(rng, x - r * 0.15, y + r * 0.12, r * 0.6, r * 0.3, 7, 0.12), 0.0, 'stone', 'hi'))
    for (x, y, r) in ((-0.1, 0.045, 0.024), (-0.05, 0.02, 0.018), (0.12, 0.045, 0.022), (0.17, 0.07, 0.016), (-0.17, 0.02, 0.016), (0.05, 0.19, 0.014), (0.13, 0.3, 0.013)):
        lp = skia.Path()
        lp.addArc(skia.Rect.MakeLTRB(x - r, y - r * 0.62, x + r, y + r * 0.62), 25, 320)
        lp.lineTo(x, y); lp.close()
        S.append(F('lily', lp, rng.uniform(-0.4, 0.4), 'lily'))
    for (x, y) in ((-0.1, 0.05), (0.12, 0.05)):
        S.append(F('flower_a', ellipse(x + 0.004, y + 0.004, 0.007, 0.006), 0.0, 'flower', 'small'))
    # grass tufts
    for _ in range(46):
        x, y = rng.uniform(-0.85, 0.85), rng.uniform(0.05, 0.75)
        if (abs(x) < 0.26 and y < 0.55) or (x < -0.45 and y < 0.2):
            continue
        for k in (-1, 0, 1):
            S.append(Ln('canopy_a', poly([(x + k * 0.006, y), (x + k * 0.011, y + 0.02 - abs(k) * 0.005)], False), 0.0026, 0.0, 'detail', 'grass'))
    # hinge lines of the cards are printed/glued here: small tick marks (paper engineering honesty)
    # annotations of a plate
    S.append(Tx('Río de la Luna', -0.7, 0.085, 0.04, 'title', 'ink', 0.0, 'label'))
    S.append(Tx('PLATE VII', -0.7, 0.14, 0.017, 'caps', 'ink', 0.0, 'label'))
    S.append(Tx('the river that falls from the moon', -0.7, 0.05, 0.019, 'italic', 'ink', 0.0, 'label'))
    return S


def compass(cx, cy, r):
    S = [Ln('ink', ellipse(cx, cy, r, r), 0.0025, 0, 'label'), Ln('ink', ellipse(cx, cy, r * 0.72, r * 0.72), 0.0015, 0, 'label')]
    for k in range(8):
        a = k * np.pi / 4
        L = r * (1.25 if k % 2 == 0 else 0.7)
        wv = r * 0.14
        c, s = np.cos(a), np.sin(a)
        S.append(F('ink' if k % 2 == 0 else 'flower_a', poly([(cx + L * c, cy + L * s), (cx - wv * s, cy + wv * c), (cx + wv * s, cy - wv * c)]), 0, 'label'))
    S.append(Tx('N', cx, cy + r * 1.36, r * 0.5, 'caps', 'ink', 0, 'label'))
    return S


def map_plate(rng):
    """Previous page (recto of the thin leaf): the same valley as a flat map. Page coords px 0..W, py 0..H."""
    S = []
    S.append(Ln('ink', poly([(0.07, 0.09), (0.93, 0.09), (0.93, 1.46), (0.07, 1.46)]), 0.004, 0, 'frame'))
    S.append(Ln('ink', poly([(0.085, 0.105), (0.915, 0.105), (0.915, 1.445), (0.085, 1.445)]), 0.0015, 0, 'frame'))
    # land mass + contour rings
    land = blob(rng, 0.5, 0.78, 0.36, 0.5, 13, 0.1)
    S.append(F('ground', land, 0.0, 'ground'))
    for i, sc in enumerate((0.84, 0.66, 0.5, 0.34)):
        S.append(F(('bank', 'canopy_b', 'canopy_a', 'peak_mid')[i], blob(rng, 0.5 + 0.02 * i, 0.82 + 0.05 * i, 0.36 * sc, 0.5 * sc, 12, 0.12), 0.0, 'ground'))
    for i, sc in enumerate((0.92, 0.75, 0.58, 0.42, 0.26)):
        S.append(Ln('ink', blob(rng, 0.5 + 0.02 * i, 0.82 + 0.04 * i, 0.36 * sc, 0.5 * sc, 12, 0.1), 0.0018, 0, 'contour'))
    riv = spline_pts([(0.54, 1.18), (0.5, 1.0), (0.56, 0.84), (0.48, 0.66), (0.55, 0.5), (0.5, 0.32), (0.56, 0.16)], 40)
    S.append(F('water', ribbon_var(np.array(riv), np.linspace(0.02, 0.07, len(riv))), 0.0, 'water'))
    S.append(F('disc', ellipse(0.54, 1.2, 0.05, 0.05), 0.0, 'glow'))
    S.append(Ln('ink', ellipse(0.54, 1.2, 0.065, 0.065), 0.0015, 0, 'label'))
    # dotted canoe route + temple mark + trees
    for q in riv[10::3]:
        S.append(F('flower_a', ellipse(q[0] + 0.012, q[1], 0.005, 0.005), 0.0, 'small'))
    S.append(F('stone', poly([(0.66, 0.6), (0.74, 0.6), (0.72, 0.64), (0.68, 0.64)]), 0, 'stone'))
    S.append(F('stone', poly([(0.68, 0.64), (0.72, 0.64), (0.71, 0.67), (0.69, 0.67)]), 0.3, 'stone'))
    for _ in range(26):
        x, y = rng.uniform(0.22, 0.8), rng.uniform(0.45, 1.15)
        if abs(x - 0.52) < 0.07:
            continue
        S.append(F('canopy_a', ellipse(x, y, 0.014, 0.012), rng.uniform(-0.4, 0.4), 'small'))
        S.append(F('canopy_c', ellipse(x - 0.003, y + 0.003, 0.007, 0.006), 0, 'small'))
    S += compass(0.2, 1.3, 0.055)
    S.append(Tx('PLATE VI', 0.5, 1.385, 0.022, 'caps', 'ink', 0, 'label'))
    S.append(Tx('Map of the Moon River', 0.5, 0.2, 0.04, 'title', 'ink', 0, 'label'))
    S.append(Tx('turn the leaf to enter', 0.5, 0.145, 0.02, 'italic', 'ink', 0, 'label'))
    S.append(Ln('ink', poly([(0.68, 0.35), (0.86, 0.35)], False), 0.003, 0, 'label'))
    for k in range(4):
        S.append(Ln('ink', poly([(0.68 + 0.06 * k, 0.343), (0.68 + 0.06 * k, 0.357)], False), 0.002, 0, 'label'))
    return S


def legend_page(rng):
    """Left page of the previous spread: a field-note page (text as bars, little specimens)."""
    S = [Tx('THE UNFOLDING ATLAS', 0.5, 1.36, 0.042, 'title', 'ink', 0, 'label'),
         Tx('book of small worlds', 0.5, 1.3, 0.022, 'italic', 'ink', 0, 'label')]
    S.append(Ln('ink', poly([(0.2, 1.26), (0.8, 1.26)], False), 0.002, 0, 'label'))
    y = 1.18
    for para in range(3):
        for k in range(6):
            wline = 0.7 if k < 5 else rng.uniform(0.3, 0.55)
            S.append(Ln('ink', poly([(0.15, y), (0.15 + wline, y)], False), 0.006, 0.6, 'textbar'))
            y -= 0.03
        y -= 0.035
    # specimens
    S += bigleaf(rng, 0.25, 0.3, np.radians(70), 0.17, 'leaf_a')
    S += bigleaf(rng, 0.33, 0.28, np.radians(40), 0.12, 'leaf_b')
    S += heliconia(rng, 0.5, 0.26, 0.2)
    S += lotus(0.72, 0.33, 0.06, 'flower_a')
    S += fern(rng, 0.64, 0.24, np.radians(60), 0.16)
    for (x, lab) in ((0.27, 'fig. 1'), (0.5, 'fig. 2'), (0.72, 'fig. 3')):
        S.append(Tx(lab, x, 0.2, 0.017, 'italic', 'ink', 0, 'label'))
    return S


def leaf_verso(rng):
    S = [Tx('VII', 0.5, 0.86, 0.09, 'title', 'ink', 0, 'label'),
         Tx('Río de la Luna', 0.5, 0.76, 0.032, 'italic', 'ink', 0, 'label'),
         Ln('ink', poly([(0.38, 0.72), (0.62, 0.72)], False), 0.002, 0, 'label')]
    S.append(F('disc', ellipse(0.5, 1.02, 0.045, 0.045), 0.0, 'glow'))
    S.append(Ln('ink', ellipse(0.5, 1.02, 0.06, 0.06), 0.0015, 0, 'label'))
    return S


def title_plate(rng):
    """Recto of the pop-up board: what you see before it opens."""
    S = [Ln('ink', poly([(0.1, 0.12), (0.9, 0.12), (0.9, 1.43), (0.1, 1.43)]), 0.005, 0, 'frame'),
         Ln('ink', poly([(0.125, 0.145), (0.875, 0.145), (0.875, 1.405), (0.125, 1.405)]), 0.002, 0, 'frame')]
    S.append(F('disc_ring', ellipse(0.5, 0.86, 0.25, 0.25), 0.0, 'glow'))
    S.append(F('disc', ellipse(0.5, 0.86, 0.21, 0.21), 0.0, 'glow'))
    S.append(F('water', poly([(0.475, 0.8), (0.525, 0.8), (0.55, 0.42), (0.45, 0.42)]), 0.0, 'water'))
    S.append(F('foam', ellipse(0.5, 0.42, 0.08, 0.025), 0.0, 'water'))
    r2 = np.random.default_rng(11)
    S += canopy(r2, 0.2, 0.44, 0.36, 0.56, 4, 0.05, 0.075)
    S += canopy(r2, 0.56, 0.8, 0.36, 0.56, 4, 0.05, 0.075)
    S.append(Tx('PLATE VII', 0.5, 1.28, 0.03, 'caps', 'ink', 0, 'label'))
    S.append(Tx('Río de la Luna', 0.5, 1.2, 0.06, 'title', 'ink', 0, 'label'))
    S.append(Tx('lift here', 0.83, 0.2, 0.018, 'italic', 'ink', 0, 'label'))
    return S


# ------------------------------------------------------------------ assembly
@dataclass
class Scene:
    mech: Mechanism
    cards: list
    floor: list
    pages: dict
    life: dict
    W: float = W
    H: float = H


def build_scene(seed=7):
    mech = Mechanism(W, H, 62.0)
    rng = np.random.default_rng(seed)
    cards = []

    def add(id_, side, y0, u0, u1, t1, shapes, **kw):
        cd = Card(id=id_, side=side, y0=y0, u0=u0, u1=u1, t1=t1, shapes=shapes, **kw)
        cards.append(cd)
        return cd

    back = level_backdrop(np.random.default_rng(seed + 1))
    add('backL', 'L', 0.80, -0.98, 0.0, 1.0, back, vfold=True, level='back', lock=0.0, sway=0.15)
    add('backR', 'R', 0.80, 0.0, 0.98, 1.0, back, vfold=True, level='back', lock=0.0, sway=0.15)
    moon = level_moon(np.random.default_rng(seed + 12))
    for sd, (ua, ub) in (('L', (-0.27, 0.0)), ('R', (0.0, 0.27))):
        cd = add('moon' + sd, sd, 0.80, ua, ub, 0.83, moon, vfold=True, level='moon', lock=0.02, sway=0.0)
        cd.extra.update(bridge=True, R=0.262, s_att=0.262 / mech.sa, key=0.80 * mech.sa - 0.02)
    jl = level_jungle(np.random.default_rng(seed + 2), 'L')
    jr = level_jungle(np.random.default_rng(seed + 3), 'R')
    tl = (0.80 - 0.67) * mech.sa
    add('jungleL', 'L', 0.67, -0.9, -0.05, 0.6, jl, level='jungle', lock=0.16, sway=0.6, tabs=[(-0.3, 0.12, 0.05), (-0.66, 0.1, 0.05)], tab_len=tl)
    add('jungleR', 'R', 0.67, 0.05, 0.88, 0.6, jr, level='jungle', lock=0.22, sway=0.6, tabs=[(0.3, 0.12, 0.05), (0.64, 0.1, 0.05)], tab_len=tl)
    cl = level_cliffs(np.random.default_rng(seed + 4))
    add('cliffL', 'L', 0.52, -0.64, 0.0, 0.52, cl, vfold=True, level='cliff', lock=0.08, sway=0.25)
    add('cliffR', 'R', 0.52, 0.0, 0.64, 0.52, cl, vfold=True, level='cliff', lock=0.08, sway=0.25)
    tl2 = (0.52 - 0.37) * mech.sa
    add('tree', 'L', 0.37, -0.68, -0.12, 0.62, level_tree(np.random.default_rng(seed + 5)), level='tree', lock=0.34, sway=0.9,
        tabs=[(-0.36, 0.1, 0.03), (-0.53, 0.06, 0.03)], tab_len=tl2)
    add('temple', 'R', 0.37, 0.15, 0.68, 0.5, level_temple(np.random.default_rng(seed + 6)), level='temple', lock=0.42, sway=0.3,
        tabs=[(0.3, 0.07, 0.03), (0.52, 0.06, 0.03)], tab_len=tl2)
    tl3 = (0.37 - 0.29) * mech.sa
    add('fernsL', 'L', 0.29, -0.52, -0.18, 0.26, level_fernsL(np.random.default_rng(seed + 7)), level='ferns', lock=0.55, sway=1.6,
        tabs=[(-0.36, 0.03, 0.04)], tab_len=tl3)
    add('court', 'R', 0.29, 0.21, 0.53, 0.14, level_court(np.random.default_rng(seed + 8)), level='court', lock=0.6, sway=0.5,
        tabs=[(0.37, 0.022, 0.04)], tab_len=tl3)
    tl4 = (0.29 - 0.20) * mech.sa
    add('frontL', 'L', 0.20, -0.38, -0.035, 0.2, level_frontL(np.random.default_rng(seed + 9)), level='front', lock=0.72, sway=1.8,
        tabs=[(-0.27, 0.02, 0.035)], tab_len=tl4)
    add('frontR', 'R', 0.19, 0.19, 0.355, 0.15, level_frontR(np.random.default_rng(seed + 10)), level='front', lock=0.8, sway=2.0,
        tabs=[(0.27, 0.012, 0.03)], tab_len=(0.29 - 0.19) * mech.sa)
    cn = add('canoe', 'R', CANOE_PATH[0][1], -0.1, 0.1, 0.085, level_canoe(rng), level='canoe', lock=0.9, sway=1.0)
    cn.a0 = CANOE_PATH[0][0]
    cn.extra['slider'] = True

    for cd in cards:
        pts = []
        for sh in cd.shapes:
            if sh.kind == 'fill':
                for (u, t) in path_pts(sh.path, 24):
                    if cd.u0 - 1e-6 <= u <= cd.u1 + 1e-6:
                        pts.append((u, t))
        cd.extra['outline'] = pts

    life = dict(
        canoe_path=CANOE_PATH,
        river=dict(c=np.array(spline_pts(RIVER_C, 40)), w=RIVER_W),
        falls=[dict(card='cliff', u=0.0, t0=0.255, t1=0.01, w0=0.1, w1=0.14),
               dict(card='moon', u=0.0, t0=0.46, t1=0.11, w0=0.05, w1=0.07)],
        glows=[(cd.id, sh) for cd in cards for sh in cd.shapes if 'lantern' in sh.tags or 'door' in sh.tags],
        birds=_birds(np.random.default_rng(seed + 20)),
        mist=_mist(np.random.default_rng(seed + 21)),
        flies=_flies(np.random.default_rng(seed + 22)),
    )
    pages = dict(
        legend=legend_page(np.random.default_rng(seed + 30)),
        map=map_plate(np.random.default_rng(seed + 31)),
        verso=leaf_verso(rng),
        plate=title_plate(rng),
    )
    return Scene(mech=mech, cards=cards, floor=floor_shapes(np.random.default_rng(seed + 40)), pages=pages, life=life)


def _birds(rng):
    """Flock that lifts out of the left canopy and wheels across the moon (spread coords, seconds from lift-off)."""
    out = []
    for i in range(13):
        big = i >= 11
        out.append(dict(
            start=np.array([-0.5 + rng.uniform(-0.2, 0.2), 0.62 + rng.uniform(-0.06, 0.06), 0.3 + rng.uniform(0, 0.08)]) if not big
            else np.array([0.45, 0.3, 0.38]) + rng.uniform(-0.05, 0.05, 3),
            delay=rng.uniform(0, 0.9) if not big else 0.5 + 0.5 * (i - 11),
            phase=rng.uniform(0, 6.28), size=rng.uniform(0.034, 0.052) if not big else 0.07,
            rad=rng.uniform(0.22, 0.4), hgt=rng.uniform(0.55, 0.85) if not big else 0.5 + 0.1 * (i - 11),
            speed=rng.uniform(0.75, 1.1), kind='macaw' if big else 'bird', seed=i))
    return out


def _mist(rng):
    out = []
    for i in range(9):
        out.append(dict(pos=np.array([rng.uniform(-0.2, 0.2), 0.45 + rng.uniform(-0.05, 0.06), rng.uniform(0.02, 0.1)]),
                        r=rng.uniform(0.07, 0.13), phase=rng.uniform(0, 6.28), drift=rng.uniform(-0.02, 0.02)))
    for i in range(6):
        s = -1 if i % 2 else 1
        out.append(dict(pos=np.array([s * rng.uniform(0.25, 0.7), 0.6 + rng.uniform(-0.03, 0.03), rng.uniform(0.2, 0.3)]),
                        r=rng.uniform(0.1, 0.16), phase=rng.uniform(0, 6.28), drift=rng.uniform(-0.03, 0.03)))
    return out


def _flies(rng):
    """Butterflies / fireflies near the foreground plants."""
    out = []
    for i in range(10):
        s = -1 if i % 3 else 1
        out.append(dict(pos=np.array([s * rng.uniform(0.12, 0.45), rng.uniform(0.08, 0.3), rng.uniform(0.08, 0.26)]),
                        phase=rng.uniform(0, 6.28), size=rng.uniform(0.012, 0.018), role=('flower_a', 'flower_b', 'flower_c')[i % 3]))
    return out
