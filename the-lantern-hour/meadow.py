"""The open slope above the lake: the bright sheets."""
from engine import *
from creatures import fillp, oline, mix, mul, CHAR
from flora import *

HORIZON = 462.0
TREE_X, TREE_Y = 1500.0, 742.0
STALK_X = 1010.0


def gtop(x):
    """skyline of the meadow"""
    x = np.asarray(x, np.float64)
    return 512 - 185 * np.exp(-(x / 560.0) ** 2) + 9 * np.sin(x / 170.0 + 1) - 26 * np.exp(-((x - 1960) / 420.0) ** 2)


def near_y(x):
    """the line the tortoises walk in the foreground"""
    x = np.asarray(x, np.float64)
    return 884 + 9 * np.sin(x / 260.0 + 0.5) - 14 * np.exp(-((x - 300) / 300.0) ** 2)


def depth_scale(y):
    return clamp((y - 400.0) / (884.0 - 400.0), 0.08, 1.4)


PAL = {
    'day': dict(paper=(0.895, 0.86, 0.775), sky=[(0.13, 0.36, 0.78), (0.26, 0.55, 0.90), (0.55, 0.79, 0.94), (0.86, 0.93, 0.90)],
                cl=(1.0, 0.995, 0.96), cm=(0.84, 0.88, 0.95), cs=(0.56, 0.64, 0.86), cloud=1.0,
                lake=[(0.20, 0.50, 0.78), (0.40, 0.70, 0.88), (0.98, 0.99, 0.97)], hill=[(0.50, 0.64, 0.82), (0.36, 0.54, 0.66)],
                grass=[(0.13, 0.33, 0.20), (0.24, 0.50, 0.22), (0.46, 0.68, 0.25), (0.74, 0.84, 0.36), (0.94, 0.94, 0.58)],
                forest=[(0.05, 0.11, 0.11), (0.09, 0.21, 0.15), (0.19, 0.36, 0.19), (0.38, 0.55, 0.24)],
                flowers=[(1.0, 1.0, 0.97), (0.99, 0.90, 0.30), (0.93, 0.55, 0.72), (0.58, 0.50, 0.90)], fl=1.0, stars=0, snow=0),
    'gold': dict(paper=(0.895, 0.86, 0.775), sky=[(0.26, 0.44, 0.76), (0.50, 0.68, 0.86), (0.84, 0.86, 0.80), (0.99, 0.93, 0.70)],
                 cl=(1.0, 0.95, 0.78), cm=(0.92, 0.80, 0.76), cs=(0.62, 0.56, 0.74), cloud=1.0,
                 lake=[(0.36, 0.52, 0.72), (0.70, 0.76, 0.80), (1.0, 0.96, 0.78)], hill=[(0.56, 0.60, 0.76), (0.42, 0.50, 0.60)],
                 grass=[(0.15, 0.28, 0.16), (0.30, 0.44, 0.16), (0.58, 0.62, 0.20), (0.90, 0.82, 0.36), (1.0, 0.95, 0.62)],
                 forest=[(0.05, 0.09, 0.10), (0.11, 0.18, 0.13), (0.26, 0.32, 0.16), (0.62, 0.60, 0.26)],
                 flowers=[(1.0, 0.97, 0.86), (1.0, 0.88, 0.34), (0.93, 0.56, 0.66), (0.60, 0.48, 0.80)], fl=0.9, stars=0, snow=0),
    'dusk': dict(paper=(0.50, 0.42, 0.47), sky=[(0.20, 0.22, 0.48), (0.42, 0.36, 0.62), (0.78, 0.52, 0.64), (0.98, 0.80, 0.66)],
                 cl=(1.0, 0.78, 0.74), cm=(0.70, 0.50, 0.66), cs=(0.36, 0.30, 0.54), cloud=0.9,
                 lake=[(0.30, 0.30, 0.54), (0.62, 0.48, 0.64), (1.0, 0.84, 0.76)], hill=[(0.34, 0.32, 0.54), (0.26, 0.28, 0.44)],
                 grass=[(0.07, 0.15, 0.17), (0.12, 0.25, 0.22), (0.22, 0.36, 0.26), (0.44, 0.46, 0.36), (0.80, 0.62, 0.56)],
                 forest=[(0.03, 0.05, 0.08), (0.06, 0.11, 0.12), (0.12, 0.19, 0.17), (0.30, 0.28, 0.30)],
                 flowers=[(0.80, 0.76, 0.84), (0.80, 0.70, 0.46), (0.70, 0.44, 0.62), (0.46, 0.40, 0.72)], fl=0.6, stars=0.15, snow=0),
    'night': dict(paper=(0.066, 0.082, 0.150), sky=[(0.035, 0.055, 0.16), (0.06, 0.10, 0.24), (0.10, 0.17, 0.33), (0.16, 0.26, 0.40)],
                  cl=(0.30, 0.36, 0.52), cm=(0.16, 0.20, 0.36), cs=(0.08, 0.11, 0.24), cloud=0.0,
                  lake=[(0.06, 0.10, 0.24), (0.14, 0.22, 0.40), (0.70, 0.78, 0.90)], hill=[(0.06, 0.10, 0.22), (0.05, 0.08, 0.17)],
                  grass=[(0.035, 0.07, 0.11), (0.055, 0.12, 0.15), (0.09, 0.18, 0.19), (0.16, 0.27, 0.27), (0.36, 0.48, 0.48)],
                  forest=[(0.015, 0.02, 0.045), (0.03, 0.05, 0.08), (0.05, 0.09, 0.11), (0.10, 0.16, 0.18)],
                  flowers=[(0.42, 0.48, 0.60), (0.36, 0.40, 0.42), (0.30, 0.28, 0.46), (0.24, 0.26, 0.50)], fl=0.5, stars=1.0, snow=0),
    'autumn': dict(paper=(0.80, 0.72, 0.60), sky=[(0.40, 0.54, 0.74), (0.62, 0.72, 0.82), (0.82, 0.86, 0.86), (0.95, 0.92, 0.82)],
                   cl=(1.0, 0.98, 0.92), cm=(0.84, 0.84, 0.88), cs=(0.62, 0.64, 0.78), cloud=0.5,
                   lake=[(0.34, 0.48, 0.66), (0.60, 0.70, 0.78), (0.97, 0.96, 0.90)], hill=[(0.58, 0.60, 0.70), (0.50, 0.46, 0.50)],
                   grass=[(0.30, 0.20, 0.12), (0.52, 0.38, 0.16), (0.72, 0.58, 0.24), (0.90, 0.78, 0.40), (0.98, 0.92, 0.64)],
                   forest=[(0.10, 0.06, 0.07), (0.30, 0.12, 0.10), (0.62, 0.42, 0.14), (0.88, 0.72, 0.26)],
                   flowers=[(0.95, 0.92, 0.80), (0.86, 0.74, 0.36), (0.56, 0.24, 0.30), (0.50, 0.36, 0.50)], fl=0.25, stars=0, snow=0),
    'winter': dict(paper=(0.80, 0.80, 0.84), sky=[(0.56, 0.62, 0.76), (0.72, 0.76, 0.85), (0.86, 0.87, 0.90), (0.95, 0.93, 0.90)],
                   cl=(0.98, 0.98, 0.99), cm=(0.84, 0.85, 0.90), cs=(0.68, 0.70, 0.82), cloud=0.3,
                   lake=[(0.66, 0.72, 0.84), (0.80, 0.84, 0.91), (0.98, 0.98, 1.0)], hill=[(0.74, 0.77, 0.87), (0.66, 0.69, 0.80)],
                   grass=[(0.60, 0.65, 0.84), (0.78, 0.81, 0.93), (0.92, 0.93, 0.99), (0.985, 0.985, 1.0), (1.0, 1.0, 1.0)],
                   forest=[(0.10, 0.10, 0.14), (0.22, 0.22, 0.28), (0.50, 0.52, 0.62), (0.95, 0.96, 1.0)],
                   flowers=[(0.46, 0.38, 0.32), (0.56, 0.48, 0.38), (0.40, 0.32, 0.30), (0.50, 0.44, 0.40)], fl=0.3, stars=0, snow=1.0),
    'spring': dict(paper=(0.895, 0.86, 0.775), sky=[(0.26, 0.52, 0.84), (0.48, 0.72, 0.92), (0.72, 0.88, 0.94), (0.93, 0.95, 0.88)],
                   cl=(1.0, 1.0, 0.97), cm=(0.86, 0.90, 0.95), cs=(0.64, 0.72, 0.88), cloud=0.6,
                   lake=[(0.28, 0.58, 0.80), (0.52, 0.76, 0.88), (0.98, 0.99, 0.97)], hill=[(0.56, 0.70, 0.84), (0.42, 0.62, 0.66)],
                   grass=[(0.20, 0.40, 0.22), (0.36, 0.60, 0.26), (0.58, 0.78, 0.32), (0.80, 0.90, 0.46), (0.96, 0.97, 0.68)],
                   forest=[(0.06, 0.13, 0.12), (0.14, 0.28, 0.16), (0.36, 0.56, 0.26), (0.70, 0.84, 0.44)],
                   flowers=[(1.0, 1.0, 0.98), (1.0, 0.93, 0.42), (0.98, 0.70, 0.82), (0.70, 0.62, 0.95)], fl=1.3, stars=0, snow=0),
}


def cumulus(c, rng, view, cx, base, wd, ht, pal, n=46, strength=1.0):
    """a summer cloud: piled, flat-bottomed, lit from the upper left"""
    k = view.k
    blobs = []
    for i in range(n):
        u = rng.uniform(-1, 1)
        lvl = rng.random() ** 1.3
        top = (1 - abs(u) ** 1.7) * ht
        y = base - lvl * top
        r = wd * rng.uniform(0.07, 0.15) * (1 - 0.45 * lvl) * (0.6 + 0.4 * (1 - abs(u)))
        blobs.append((cx + u * wd * 0.5 * (1 - 0.3 * lvl), y - r * 0.5, r))
    blobs.sort(key=lambda b: -b[1])
    P = view.pt
    # body
    b = Batch(c)
    for (x, y, r) in blobs:
        px, py = P(x, y); b.dot(px, py, r * k, 0.95)
    y_base = P(0, base)[1]
    m = b.mask(blur=1.0 * k)
    yy = np.arange(c.h, dtype=F32)[b.y0:b.y1, None]
    fade = np.clip((y_base - yy) / (ht * 0.10 * k) + 0.2, 0, 1)
    m = m * fade
    c.deposit(m * strength, pal['cm'], b.x0, b.y0, grain=0.55, soft=0.25, streak=(0, 0.25))
    b.items = []
    # shadows: undersides and the lee side of each heap
    b = Batch(c); b1 = Batch(c)
    for (x, y, r) in blobs:
        px, py = P(x + r * 0.22, y + r * 0.30)
        for j in range(int(5 + r * k / 9)):
            a = rng.uniform(0.0, 2.6); d = r * k * rng.uniform(0.25, 0.85)
            qx, qy = px + math.cos(a) * d, py + math.sin(a) * d * 0.8
            ln = r * k * rng.uniform(0.15, 0.4)
            b.line(np.array([(qx - ln, qy + rng.normal(0, 2)), (qx + ln, qy + rng.normal(0, 2))]), max(2, r * k * 0.18), rng.uniform(0.2, 0.7))
    mm = b.mask(blur=2.5 * k) * np.clip(m * 1.5, 0, 1)
    c.deposit(mm * strength, pal['cs'], b.x0, b.y0, grain=0.9, soft=0.2, streak=(0, 0.4))
    b.items = []
    # light: the crowns, crisp against the blue
    for (x, y, r) in blobs:
        px, py = P(x - r * 0.16, y - r * 0.20)
        for j in range(int(6 + r * k / 7)):
            a = rng.uniform(2.6, 5.6); d = r * k * rng.uniform(0.15, 0.80)
            qx, qy = px + math.cos(a) * d, py + math.sin(a) * d
            ln = r * k * rng.uniform(0.12, 0.35)
            aa = a + math.pi / 2
            b1.line(np.array([(qx - math.cos(aa) * ln, qy - math.sin(aa) * ln), (qx + math.cos(aa) * ln, qy + math.sin(aa) * ln)]), max(2, r * k * 0.22), rng.uniform(0.35, 1.0))
    mm = b1.mask(blur=0.8 * k) * np.clip(m * 1.6, 0, 1)
    c.deposit(mm * strength, pal['cl'], b1.x0, b1.y0, grain=0.85, soft=0.18)


def draw_sky(c, rng, view, pal, clouds=True, cloud_shift=0.0):
    k = view.k
    Wd, Hd = c.w, c.h
    sk = pal['sky']
    bs = [Batch(c) for _ in sk]
    y_h = HORIZON + 60
    for ps in range(2):
        for i in range(1500):
            y = rng.uniform(-30, y_h); x = rng.uniform(-160, 1920)
            t = clamp((max(0.0, y) / y_h) ** 1.25 * 3 + rng.normal(0, 0.42), 0, 2.999)
            j = int(t)
            if rng.random() < (t - j):
                j = min(len(sk) - 1, j + 1)
            ln = rng.uniform(120, 420)
            q = hand([(x, y), (x + ln / 2, y + rng.normal(0, 5)), (x + ln, y + rng.normal(0, 8))], rng, 2.0, spacing=12)
            pp = np.clip(np.sin(np.linspace(0.15, 2.99, len(q))) * 1.25, 0.15, 1.0)
            bs[j].line(view.P(q), rng.uniform(12, 30) * k, rng.uniform(0.55, 1.0), pp=pp)
        for bb, col in zip(bs, sk):
            bb.commit(col, grain=0.80 if ps == 0 else 0.92, soft=0.2, streak=(0, 0.30, 22))
    # the hand goes over it once, lightly
    y1 = int(min(Hd, view.pt(0, y_h)[1]))
    if y1 > 4:
        c.smudge(np.ones((y1, Wd), F32), 0, 0, sigma=7 * k, strength=0.45, drag=0.0)
    if pal['stars'] > 0:
        # the river of stars, then the stars
        b = Batch(c)
        for i in range(int(260 * pal['stars'])):
            t = rng.uniform(-0.1, 1.1)
            x = lerp(200, 1800, t) + rng.normal(0, 60); y = lerp(380, -40, t) + rng.normal(0, 55)
            b.line(view.P([(x - 40, y + 12), (x + 40, y - 12)]), rng.uniform(20, 46) * k, rng.uniform(0.05, 0.22))
        b.commit((0.34, 0.42, 0.66), grain=1.0, soft=0.1, blur=6 * k)
        b = Batch(c); b2 = Batch(c)
        for i in range(int(900 * pal['stars'])):
            x = rng.uniform(0, 1920); y = rng.uniform(0, HORIZON - 6)
            if rng.random() < 0.55:
                t = rng.uniform(-0.1, 1.1)
                x = lerp(200, 1800, t) + rng.normal(0, 110); y = lerp(380, -40, t) + rng.normal(0, 80)
            if y > HORIZON - 4 or y > float(gtop(x)) - 4:
                continue
            px, py = view.pt(x, y)
            r = rng.random()
            if r < 0.86:
                b.dot(px, py, rng.uniform(0.6, 1.3) * k, rng.uniform(0.3, 0.9))
            else:
                b2.dot(px, py, rng.uniform(1.3, 2.4) * k, rng.uniform(0.7, 1.0))
        b.commit((0.80, 0.86, 0.98), grain=0.35, soft=0.3)
        b2.commit((1.0, 0.98, 0.90), grain=0.2, soft=0.3)
    if clouds and pal['cloud'] > 0:
        cs = pal['cloud']
        # far, flat clouds lying on the horizon
        b = Batch(c); b2 = Batch(c)
        for i in range(34):
            x = rng.uniform(300, 2000) + cloud_shift * 0.3; y = HORIZON - rng.uniform(26, 130)
            ln = rng.uniform(60, 240)
            b.line(view.P([(x, y), (x + ln, y + rng.normal(0, 2))]), rng.uniform(6, 16) * k, rng.uniform(0.3, 0.8) * cs)
            b2.line(view.P([(x + 10, y + 7), (x + ln - 10, y + 8)]), rng.uniform(4, 9) * k, rng.uniform(0.2, 0.6) * cs)
        b2.commit(pal['cs'], grain=0.9, soft=0.18)
        b.commit(pal['cl'], grain=0.8, soft=0.18, streak=(0, 0.3))
        r2 = np.random.default_rng(404)
        if cs > 0.45:
            cumulus(c, r2, view, 1500 + cloud_shift, HORIZON - 30, 760, 372, pal, n=64, strength=min(1.0, cs))
            cumulus(c, r2, view, 1070 + cloud_shift * 0.8, HORIZON - 36, 330, 150, pal, n=22, strength=min(1.0, cs))
        if cs > 0.8:
            cumulus(c, r2, view, 640 + cloud_shift * 0.6, HORIZON - 150, 260, 84, pal, n=14, strength=cs * 0.9)
            cumulus(c, r2, view, 880 + cloud_shift * 0.5, 120, 210, 56, pal, n=10, strength=cs * 0.8)


def draw_far(c, rng, view, pal):
    """hills beyond the water, the water, the far shore"""
    k = view.k
    xs = np.linspace(380, 1960, 60)
    hy = HORIZON - 16 - 26 * np.abs(np.sin(xs / 260.0 + 2)) - 14 * np.sin(xs / 90.0) ** 2
    poly = np.vstack([np.stack([xs, hy], 1), [(1960, HORIZON + 4), (380, HORIZON + 4)]])
    fillp(c, view.P(poly), pal['hill'][0], rng, ang=0.5, w=6 * k, solid=0.55, grain=0.85, edge=1.0 * k)
    xs2 = np.linspace(380, 1500, 40)
    hy2 = HORIZON - 5 - 15 * np.abs(np.sin(xs2 / 180.0 + 0.5)) * np.exp(-((xs2 - 620) / 520.0) ** 2)
    poly = np.vstack([np.stack([xs2, hy2], 1), [(1500, HORIZON + 4), (380, HORIZON + 4)]])
    fillp(c, view.P(poly), pal['hill'][1], rng, ang=0.4, w=5 * k, solid=0.6, grain=0.8, edge=1.0 * k)
    # water
    bs = [Batch(c) for _ in range(3)]
    for i in range(520):
        y = rng.uniform(HORIZON + 1, 560); x = rng.uniform(380, 1960)
        j = 0 if rng.random() < 0.55 else 1
        ln = rng.uniform(30, 190) * (0.4 + (y - HORIZON) / 80.0)
        bs[j].line(view.P([(x, y), (x + ln, y + rng.normal(0, 1))]), rng.uniform(3, 9) * k, rng.uniform(0.5, 1.0))
    for i in range(170):
        y = HORIZON + 2 + rng.random() ** 1.6 * 80; x = rng.normal(1180, 300)
        ln = rng.uniform(4, 26)
        bs[2].line(view.P([(x, y), (x + ln, y)]), rng.uniform(1.5, 3) * k, rng.uniform(0.4, 1.0))
    for bb, col, g in zip(bs, pal['lake'], (0.7, 0.8, 0.75)):
        bb.commit(col, grain=g, soft=0.18, streak=(0, 0.35))


def draw_ground(c, rng, view, pal, wear=None, flowers=True, n_scale=1.0):
    """the slope: laid in broad, then blade by blade from the far edge toward the hand"""
    k = view.k
    g = pal['grass']
    snow = pal['snow']
    xs = np.linspace(-30, 1950, 80)
    top = gtop(xs)
    poly = np.vstack([np.stack([xs, top], 1), [(1950, 1100), (-30, 1100)]])
    fillp(c, view.P(poly), g[1], rng, ang=0.12, w=26 * k, solid=0.78, grain=0.7, edge=1.2 * k, streak=(8, 0.3, 20), wob=6)
    # broad swells of colour following the lie of the land
    bs = [Batch(c) for _ in range(4)]
    for i in range(int(520 * n_scale)):
        x = rng.uniform(-60, 1900); t = rng.random()
        y0 = float(gtop(x)) + 6 + t ** 1.5 * (1090 - float(gtop(x)))
        sc = depth_scale(y0)
        ln = rng.uniform(80, 300) * (0.4 + sc)
        slope = (float(gtop(x + 40)) - float(gtop(x - 40))) / 80.0 * (1 - t)
        j = rng.choice(4, p=[0.26, 0.26, 0.30, 0.18])
        bs[j].line(view.P([(x, y0), (x + ln / 2, y0 + slope * ln / 2 + rng.normal(0, 3)), (x + ln, y0 + slope * ln + rng.normal(0, 4))]),
                   rng.uniform(8, 26) * (0.35 + sc) * k, rng.uniform(0.3, 0.85))
    for bb, col in zip(bs, g[:4]):
        bb.commit(col, grain=0.9, soft=0.16, streak=(5, 0.45, 18))
    # blades
    layers = [(0, 6, int(2600 * n_scale)), (1, 10, int(3400 * n_scale)), (2, 12, int(3400 * n_scale)), (3, 12, int(1900 * n_scale)), (4, 10, int(520 * n_scale))]
    if snow > 0:
        layers = [(0, 5, 900), (1, 6, 500)]
    for (j, ln0, n) in layers:
        b = Batch(c)
        for i in range(n):
            x = rng.uniform(-20, 1940); t = rng.random()
            yt = float(gtop(x))
            y = yt + 3 + t ** 1.7 * (1085 - yt)
            sc = depth_scale(y)
            ln = ln0 * rng.uniform(0.6, 1.7) * (0.25 + 2.2 * sc ** 1.3)
            px, py = view.pt(x, y)
            blade(b, rng, px, py, ln * k, rng.normal(0.18, 0.28), max(1.0, (1.0 + 2.6 * sc) * k), rng.uniform(0.4, 0.95))
        b.commit(g[j] if snow == 0 else pal['flowers'][j], grain=0.72 if j < 3 else 0.85, soft=0.18)
    if wear is not None:
        wear(c, rng, view)
    if flowers and pal['fl'] > 0:
        fcols = pal['flowers']
        bs = [Batch(c) for _ in fcols]
        nf = int(820 * pal['fl'] * n_scale)
        cl_x = rng.uniform(0, 1920, 26); cl_y = rng.uniform(0.15, 1.0, 26); cl_c = rng.integers(0, len(fcols), 26)
        for i in range(nf):
            q = rng.integers(0, 26)
            x = cl_x[q] + rng.normal(0, 150); t = clamp(cl_y[q] + rng.normal(0, 0.10), 0.02, 1)
            if t < 0.3 and rng.random() < 0.6:
                continue
            yt = float(gtop(x))
            y = yt + 6 + t ** 1.6 * (1070 - yt)
            sc = depth_scale(y)
            j = cl_c[q] if rng.random() < 0.75 else rng.integers(0, len(fcols))
            px, py = view.pt(x, y - 8 * sc)
            r = rng.uniform(1.2, 2.6) * (0.3 + 1.5 * sc) * k
            if snow > 0:
                bs[j].line(np.array([(px, py), (px + rng.normal(0, 3 * k), py - rng.uniform(6, 26) * sc * k)]), max(1.0, 1.2 * k), rng.uniform(0.4, 0.9))
            else:
                bs[j].dot(px, py, r, rng.uniform(0.6, 1.0))
                if sc > 0.6 and rng.random() < 0.5:
                    bs[j].dot(px + rng.normal(0, r), py + rng.normal(0, r * 0.7), r * 0.7, rng.uniform(0.5, 0.9))
        for bb, col in zip(bs, fcols):
            bb.commit(col, grain=0.55, soft=0.22)


def draw_forest_edge(c, rng, view, pal, bare=0.0):
    """the old forest, seen from outside: a dark wall with one darker door in it"""
    k = view.k
    f = pal['forest']
    # trunk shadows first
    xs = np.linspace(-40, 420, 30)
    base = gtop(xs) + 8
    crown = 60 + 150 * (np.maximum(xs, 0) / 420.0) ** 2.2 + 24 * np.sin(xs / 37.0) + 12 * np.sin(xs / 13.0)
    poly = np.vstack([np.stack([xs, crown], 1), [(430, float(gtop(430)) + 4)], np.stack([xs[::-1], base[::-1]], 1)])
    fillp(c, view.P(poly), f[0], rng, ang=1.3, w=9 * k, solid=0.9, grain=0.45, edge=2 * k, wob=3)
    b1 = Batch(c); b2 = Batch(c); b3 = Batch(c); bt = Batch(c)
    for i in range(1500):
        x = rng.uniform(-30, 430)
        cr = 60 + 150 * (max(0, x) / 420.0) ** 2.2 + 24 * math.sin(x / 37.0)
        y = rng.uniform(cr - 14, float(gtop(x)) - 30)
        cl_ = math.sin(x / 31.0 + y / 47.0) + math.sin(x / 17.0 - y / 29.0) * 0.6
        a = rng.uniform(0, 3.14); ln = rng.uniform(5, 14)
        p = view.P([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln * 0.6)])
        if bare > 0.5:
            if rng.random() < 0.3:
                b3.line(p, rng.uniform(2, 4) * k, rng.uniform(0.3, 0.8))
            continue
        b1.line(p, rng.uniform(6, 13) * k, rng.uniform(0.5, 1.0))
        if cl_ > 0.1:
            b2.line(p + np.array([-3, -4]) * k, rng.uniform(5, 10) * k, rng.uniform(0.3, 0.9))
        if cl_ > 0.9 and rng.random() < 0.7:
            b3.line(p + np.array([-5, -7]) * k, rng.uniform(3, 7) * k, rng.uniform(0.3, 0.9))
    for x in [70, 150, 215, 290, 345, 392, 425]:
        yb = float(gtop(x)) + 6
        bt.line(view.P([(x, yb - rng.uniform(90, 170)), (x + rng.normal(0, 3), yb)]), rng.uniform(5, 11) * k, 0.9)
    bt.commit(mul(f[0], 0.7), grain=0.4, soft=0.2)
    b1.commit(f[1], grain=0.75, soft=0.16)
    b2.commit(f[2], grain=0.85, soft=0.16)
    b3.commit(f[3], grain=0.9, soft=0.16)
    # the door they came out of
    x0 = 300
    yb = float(gtop(x0)) + 4
    door = np.array([(x0 - 38, yb + 4), (x0 - 34, yb - 60), (x0 - 14, yb - 92), (x0 + 14, yb - 90), (x0 + 34, yb - 56), (x0 + 40, yb + 6)])
    fillp(c, view.P(catmull(door, 5)), mul(f[0], 0.45), rng, ang=1.4, w=5 * k, solid=0.95, grain=0.3, edge=2.5 * k)


def draw_tree(c, rng, view, x, y, g, pal, season='day'):
    """the tree that was a stick when they came. g: 0..1"""
    if g <= 0.01:
        return
    k = view.k
    sc = depth_scale(y)
    hgt = (18 + 330 * g ** 1.15) * sc * 1.25
    tw = (2 + 22 * g ** 1.3) * sc
    f = pal['forest']
    trunk_c = mul(f[0], 1.6) if pal['snow'] == 0 else (0.20, 0.18, 0.22)
    px, py = view.pt(x, y)
    top = (px + 0.05 * hgt * k, py - hgt * k)
    # trunk and boughs
    b = Batch(c)
    b.line(np.array([(px, py), (px + 0.02 * hgt * k, py - hgt * 0.5 * k), top]), max(1.5, tw * k), 0.95, taper=(1.0, 0.25))
    nb = int(2 + 7 * g)
    tips = []
    for i in range(nb):
        t = 0.32 + 0.6 * (i + 0.5) / nb
        sgn = -1 if i % 2 == 0 else 1
        bl = hgt * (0.20 + 0.25 * (1 - t)) * (0.7 + 0.5 * g)
        p0 = np.array([px + 0.03 * hgt * k * t, py - hgt * t * k])
        p1 = p0 + np.array([sgn * bl * 0.8, -bl * 0.42]) * k
        b.line(np.array([p0, (p0 + p1) / 2 + np.array([0, bl * 0.08 * k]), p1]), max(1.0, tw * 0.45 * (1 - t * 0.6) * k), 0.9, taper=(1.0, 0.3))
        tips.append(p1); tips.append((p0 + p1) / 2 + np.array([0, -bl * 0.1 * k]))
    tips.append(np.array(top))
    b.commit(trunk_c, grain=0.5, soft=0.2)
    if pal['snow'] > 0:
        b = Batch(c)
        for p in tips:
            b.line(np.array([p + np.array([-6, -2]) * k * g, p + np.array([6, -2]) * k * g]), max(1.0, 2.5 * k * g), 0.8)
        b.commit((1, 1, 1), grain=0.6, soft=0.2)
        return
    # foliage: three sticks, dark then middle then the lit one
    R = hgt * (0.20 + 0.10 * g)
    cols = [f[1], f[2], f[3]]
    if season == 'spring':
        cols = [f[2], f[3], (1.0, 0.90, 0.94)]
    bs = [Batch(c) for _ in range(3)]
    dens = int(40 + 500 * g)
    for i in range(dens):
        p = tips[rng.integers(0, len(tips))]
        a = rng.uniform(0, 6.283); d = R * k * rng.random() ** 0.6
        qx, qy = p[0] + math.cos(a) * d, p[1] + math.sin(a) * d * 0.72
        j = 0
        lit = -math.cos(a - 0.9) * 0.5 + 0.5 + rng.normal(0, 0.2)
        if lit > 0.45:
            j = 1
        if lit > 0.80:
            j = 2
        ln = rng.uniform(3, 8) * (0.5 + g) * sc * k; aa = rng.uniform(0, 3.14)
        bs[j].line(np.array([(qx, qy), (qx + math.cos(aa) * ln, qy + math.sin(aa) * ln * 0.6)]), rng.uniform(4, 9) * (0.5 + g * 0.7) * sc * k, rng.uniform(0.45, 1.0))
    for bb, col, gr in zip(bs, cols, (0.7, 0.82, 0.88)):
        bb.commit(col, grain=gr, soft=0.17)
    # its shadow on the grass
    if g > 0.15:
        b = Batch(c)
        for i in range(int(30 + 60 * g)):
            xx = px + rng.normal(0.5, 0.45) * R * 2.2 * k; yy = py + rng.uniform(2, 14) * k * (0.5 + g)
            b.line(np.array([(xx - 14 * k, yy), (xx + 14 * k, yy)]), rng.uniform(3, 6) * k, rng.uniform(0.3, 0.8))
        b.commit(mul(pal['grass'][0], 0.8), grain=0.85, soft=0.18, op=0.8)


def meadow_plate(paper, pal, view=V1, seed=21, tree_g=0.03, season='day', wear=None, cloud_shift=0.0, sky_only=False, n_scale=1.0, flowers=True):
    rng = np.random.default_rng(seed)
    c = Canvas(paper)
    draw_sky(c, rng, view, pal, cloud_shift=cloud_shift)
    if sky_only:
        return c
    draw_far(c, rng, view, pal)
    rng = np.random.default_rng(seed + 1)
    draw_ground(c, rng, view, pal, wear=wear, n_scale=n_scale, flowers=flowers)
    rng = np.random.default_rng(seed + 2)
    draw_forest_edge(c, rng, view, pal, bare=1.0 if pal['snow'] > 0 else 0.0)
    rng = np.random.default_rng(seed + 3)
    draw_tree(c, rng, view, TREE_X, TREE_Y, tree_g, pal, season)
    return c


def fg_grass(L, rng, view, pal, wind=0.0, gust=None, seed=77, y_base=1090.0, dens=1.0):
    """the tall grass nearest the eye, redrawn each time the wind changes its mind"""
    k = view.k
    g = pal['grass']
    r0 = np.random.default_rng(seed)
    n = int(210 * dens)
    xs = r0.uniform(-20, 1940, n); hs = r0.uniform(70, 190, n) * (1 + 0.3 * np.sin(xs / 200.0)); ci = r0.integers(0, 4, n); lean0 = r0.normal(0.1, 0.16, n)
    ys = y_base - r0.uniform(0, 30, n)
    bs = [Batch(L) for _ in range(4)]
    for i in range(n):
        gph = wind * 1.0 - xs[i] / 420.0
        lean = lean0[i] + 0.16 * math.sin(gph) + 0.07 * math.sin(gph * 2.3 + i) + (gust(xs[i]) if gust else 0.0)
        px, py = view.pt(xs[i], ys[i])
        blade(bs[ci[i]], rng, px, py, hs[i] * k, lean, max(1.5, 4.5 * k), rng.uniform(0.7, 1.0), curve=0.5)
    cols = [mul(g[0], 0.8), g[0], g[1], g[2]]
    if pal['snow'] > 0:
        cols = [pal['flowers'][0], pal['flowers'][1], pal['flowers'][2], pal['flowers'][3]]
    for bb, col in zip(bs, cols):
        bb.commit(col, grain=0.6, soft=0.2)
