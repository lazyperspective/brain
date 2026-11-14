"""The old forest: the dark sheet."""
from engine import *
from creatures import fillp, oline, mix, mul, CHAR
from flora import *

FOREST_TONE = (0.068, 0.078, 0.108)
PLANT_X, PLANT_Y = 1175.0, 868.0          # where the lantern plant stands
HOLLOW = (150.0, 560.0, 700.0, 935.0)     # mouth of the root-house (x0, x1, top, floor)


def ground_y(x):
    """the forest floor under the walking line"""
    x = np.asarray(x, np.float64)
    return 905 - 34 * np.exp(-((x - 1175) / 420.0) ** 2) + 10 * np.sin(x / 140.0) + 20 * np.exp(-((x - 350) / 200.0) ** 2)


def root_arch():
    """upper edge of the great root that roofs the hollow, as world points"""
    return np.array([(-40, 520), (60, 548), (170, 610), (300, 668), (430, 690), (540, 705), (610, 760), (655, 840), (690, 915), (735, 960)], np.float64)


def forest_plate(paper, view=V1, seed=11, night=False):
    rng = np.random.default_rng(seed)
    c = Canvas(paper)
    k = view.k
    VP = view.P
    Wd, Hd = paper.w, paper.h

    def wl(batch, pts, w, v, **kw):
        batch.line(VP(pts), max(1.0, w * k), v, **kw)

    # ---- 1. the depth between the trunks: air made of teal dust
    for col, n, wv, pv, ylo, yhi, xc, xs in [((0.09, 0.19, 0.23), 260, 46, (0.10, 0.35), 0, 760, 1100, 900),
                                             ((0.13, 0.28, 0.27), 160, 40, (0.08, 0.30), 60, 700, 1250, 520),
                                             ((0.22, 0.40, 0.34), 80, 34, (0.06, 0.25), 120, 600, 1380, 300),
                                             ((0.40, 0.56, 0.42), 26, 26, (0.05, 0.20), 150, 470, 1440, 150)]:
        b = Batch(c)
        for i in range(n):
            x = rng.normal(xc, xs); y0 = rng.uniform(ylo, yhi - 100); ln = rng.uniform(90, 300)
            wl(b, [(x, y0), (x + rng.normal(0, 8), y0 + ln)], wv * rng.uniform(0.6, 1.3), rng.uniform(*pv))
        b.commit(col, grain=1.0, soft=0.14, streak=(90, 0.5), blur=3 * k)
    c.smudge(np.ones((Hd, Wd), F32), 0, 0, sigma=5 * k, strength=0.55)

    # ---- 2. far trunks
    b = Batch(c); b2 = Batch(c)
    for i in range(17):
        x = rng.uniform(380, 1950); w = rng.uniform(14, 40)
        if abs(x - 1420) < 70:
            continue
        lean = rng.normal(0, 0.02)
        pts = [(x - lean * 700, -10), (x + rng.normal(0, 3), 380), (x + lean * 300, 745)]
        wl(b, pts, w, rng.uniform(0.75, 0.95))
        wl(b2, [(p[0] + w * 0.38, p[1]) for p in pts], max(2, w * 0.14), rng.uniform(0.15, 0.4))
    b.commit((0.075, 0.125, 0.155), grain=0.5, soft=0.2, blur=1.5 * k)
    b2.commit((0.20, 0.34, 0.31), grain=1.0, soft=0.15)

    # ---- 3. ground, far to near
    def litter(n, ylo, yhi, cols, wr, lr, pv, xlo=-20, xhi=1940, gr=0.9):
        bs = [Batch(c) for _ in cols]
        for i in range(n):
            x = rng.uniform(xlo, xhi); u = rng.random() ** 0.8
            y = lerp(ylo, yhi, u)
            sc = lerp(0.45, 1.0, (y - 700) / 380.0)
            a = rng.normal(0, 0.35)
            ln = rng.uniform(*lr) * sc
            j = rng.integers(0, len(cols))
            wl(bs[j], [(x - math.cos(a) * ln, y - math.sin(a) * ln * 0.4), (x + math.cos(a) * ln, y + math.sin(a) * ln * 0.4)], rng.uniform(*wr) * sc, rng.uniform(*pv))
        for bb, col in zip(bs, cols):
            bb.commit(col, grain=gr, soft=0.15, streak=(0, 0.35))

    # base
    b = Batch(c)
    for i in range(240):
        y = rng.uniform(712, 1090); x = rng.uniform(-50, 1900)
        wl(b, [(x, y), (x + rng.uniform(150, 420), y + rng.normal(0, 6))], rng.uniform(18, 40), rng.uniform(0.35, 0.8))
    b.commit((0.085, 0.075, 0.09), grain=0.8, soft=0.2, streak=(0, 0.5))
    litter(2600, 716, 1085, [(0.17, 0.11, 0.10), (0.15, 0.10, 0.15), (0.10, 0.14, 0.12), (0.21, 0.15, 0.10)], (3, 9), (5, 16), (0.3, 0.8))
    litter(700, 730, 1085, [(0.27, 0.19, 0.12), (0.20, 0.14, 0.20), (0.12, 0.21, 0.15)], (2, 6), (4, 11), (0.3, 0.75))
    litter(160, 760, 1085, [(0.40, 0.31, 0.17), (0.30, 0.22, 0.28)], (2, 4), (3, 8), (0.3, 0.7))
    # moss cushions
    for i in range(22):
        x = rng.uniform(560, 1900); y = rng.uniform(740, 1040)
        r = rng.uniform(26, 80) * lerp(0.5, 1.0, (y - 700) / 380)
        b = Batch(c); b2 = Batch(c)
        for j in range(int(r * 1.3)):
            a = rng.uniform(0, 6.28); d = r * rng.random() ** 0.6
            px, py = x + math.cos(a) * d, y + math.sin(a) * d * 0.32
            wl(b, [(px, py), (px + rng.normal(0, 2), py - rng.uniform(3, 8))], 3, rng.uniform(0.4, 0.9))
            if math.sin(a) < 0 and rng.random() < 0.5:
                wl(b2, [(px, py - 3), (px + rng.normal(0, 2), py - rng.uniform(6, 11))], 2, rng.uniform(0.3, 0.8))
        b.commit((0.09, 0.20, 0.13), grain=0.8, soft=0.18)
        b2.commit((0.17, 0.33, 0.18), grain=0.9, soft=0.16)

    # ---- 4. middle trunks, with their feet in the litter
    trunks = [(900, 92, 752, 0.01), (1640, 120, 770, -0.015), (1860, 150, 800, 0.02), (720, 60, 742, -0.01), (1320, 54, 738, 0.012)]
    for (x, w, yb, lean) in trunks:
        pl = np.array([(x - w / 2 - lean * 800, -10), (x - w / 2, 420), (x - w * 0.55, yb - 60), (x - w * 0.95, yb), (x - w * 1.45, yb + 26),
                       (x + w * 1.5, yb + 30), (x + w * 0.95, yb), (x + w * 0.56, yb - 60), (x + w / 2, 420), (x + w / 2 - lean * 800, -10)])
        pp = VP(catmull(pl, 8))
        fillp(c, pp, (0.050, 0.060, 0.075), rng, ang=math.pi / 2, w=7 * k, solid=0.8, grain=0.55, edge=1.2 * k, wob=3)
        b = Batch(c); b2 = Batch(c); b3 = Batch(c)
        for j in range(int(w * 1.6)):
            u = rng.uniform(-0.45, 0.48); y0 = rng.uniform(-10, yb - 20); ln = rng.uniform(40, 160)
            xx = x + u * w - lean * (800 - y0) * 0
            if u > 0.18:
                wl(b2, [(xx, y0), (xx + rng.normal(0, 3), y0 + ln)], rng.uniform(2, 5), rng.uniform(0.15, 0.5) * (u + 0.3))
            else:
                wl(b, [(xx, y0), (xx + rng.normal(0, 3), y0 + ln)], rng.uniform(2, 6), rng.uniform(0.2, 0.6))
            if rng.random() < 0.10:
                wl(b3, [(xx, y0), (xx + rng.normal(0, 4), y0 + rng.uniform(10, 40))], rng.uniform(3, 8), rng.uniform(0.3, 0.7))
        b.commit((0.085, 0.095, 0.11), grain=0.9, soft=0.16)
        b2.commit((0.19, 0.30, 0.27), grain=1.0, soft=0.14)
        b3.commit((0.10, 0.22, 0.14), grain=0.9, soft=0.16)

    # ---- 5. the great tree and its root-house
    arch = root_arch()
    trunk = np.array([(-40, -20), (470, -20), (455, 180), (470, 380), (520, 520), (600, 640), (640, 730), (690, 860), (735, 960), (760, 1010), (-40, 1010)], np.float64)
    fillp(c, VP(catmull(trunk, 8)), (0.045, 0.048, 0.058), rng, ang=math.pi / 2 - 0.1, w=9 * k, solid=0.85, grain=0.5, edge=1.5 * k, wob=3)
    # bark: long strokes following the flare
    b = Batch(c); b2 = Batch(c); b3 = Batch(c); b4 = Batch(c)
    for j in range(520):
        u = rng.random(); y0 = rng.uniform(-10, 640)
        xtop = lerp(-30, 455, u)
        flare = (max(0, y0 - 250) / 400.0) ** 2 * 190 * (u - 0.25)
        x0 = xtop + flare + 10 * math.sin(y0 / 90 + u * 5)
        ln = rng.uniform(40, 170)
        y1 = y0 + ln
        flare1 = (max(0, y1 - 250) / 400.0) ** 2 * 190 * (u - 0.25)
        x1 = xtop + flare1 + 10 * math.sin(y1 / 90 + u * 5)
        tgt = b2 if u > 0.72 else b
        wl(tgt, [(x0, y0), ((x0 + x1) / 2 + rng.normal(0, 2), (y0 + y1) / 2), (x1, y1)], rng.uniform(2.5, 7), rng.uniform(0.2, 0.6) * (0.5 + u * 0.6))
        if rng.random() < 0.12:
            wl(b3, [(x0, y0), (x0 + rng.normal(0, 5), y0 + rng.uniform(15, 50))], rng.uniform(4, 10), rng.uniform(0.25, 0.6))
        if u > 0.9 and rng.random() < 0.5:
            wl(b4, [(x0 + 6, y0), (x1 + 6, y1)], rng.uniform(1.5, 3), rng.uniform(0.2, 0.5))
    b.commit((0.095, 0.092, 0.10), grain=0.95, soft=0.15)
    b2.commit((0.15, 0.19, 0.19), grain=1.0, soft=0.14)
    b3.commit((0.085, 0.19, 0.125), grain=0.92, soft=0.15)
    b4.commit((0.27, 0.40, 0.34), grain=1.0, soft=0.14)
    # the hollow: the blackest thing on the sheet
    hx0, hx1, htop, hfl = HOLLOW
    hol = np.array([(hx0, hfl + 8), (hx0 + 12, 820), (hx0 + 55, 742), (hx0 + 140, 706), (hx0 + 260, 712), (hx0 + 350, 752), (hx1 - 22, 826), (hx1 + 6, hfl + 14)], np.float64)
    fillp(c, VP(catmull(hol, 6)), (0.018, 0.018, 0.026), rng, ang=1.2, w=8 * k, solid=0.95, grain=0.3, edge=2.5 * k)
    # the root that roofs it, lit faintly along its back
    b = Batch(c); b2 = Batch(c); b3 = Batch(c)
    ar = catmull(arch, 6)
    for j in range(300):
        i = rng.integers(0, len(ar) - 6)
        seg = ar[i:i + rng.integers(4, 12)]
        off = rng.uniform(0, 34)
        d = np.gradient(seg, axis=0); d /= (np.hypot(d[:, 0], d[:, 1])[:, None] + 1e-9)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        pts = seg + nrm * off * (1 if nrm[0, 1] > 0 else -1)
        tgt = b2 if off < 9 else b
        wl(tgt, pts, rng.uniform(2.5, 6), rng.uniform(0.25, 0.7) * (1.0 if off < 9 else 0.7))
        if off < 14 and rng.random() < 0.35:
            wl(b3, pts[:4], rng.uniform(3, 7), rng.uniform(0.3, 0.7))
    b.commit((0.10, 0.095, 0.10), grain=0.95, soft=0.15)
    b2.commit((0.20, 0.24, 0.23), grain=1.0, soft=0.14)
    b3.commit((0.10, 0.23, 0.14), grain=0.9, soft=0.15)
    oline(c, VP(ar), (0.02, 0.02, 0.03), 3.0 * k, rng, wob=1.5 * k, v=0.7)
    # lesser roots, crawling out along the ground
    for pts, w0 in [([(700, 930), (820, 955), (960, 948), (1120, 972), (1300, 962), (1480, 990), (1700, 985), (1940, 1012)], 30),
                    ([(600, 990), (700, 1030), (860, 1050), (1000, 1084)], 36),
                    ([(120, 960), (60, 1000), (-20, 1030)], 40)]:
        q = catmull(np.array(pts, np.float64), 6)
        b = Batch(c); b2 = Batch(c); b3 = Batch(c)
        n = len(q)
        for j in range(n - 1):
            wj = w0 * (1 - 0.6 * j / n)
            wl(b, q[j:j + 2], wj, 0.95)
        b.commit((0.05, 0.05, 0.06), grain=0.45, soft=0.2)
        for j in range(0, n - 5, 2):
            wj = w0 * (1 - 0.6 * j / n)
            wl(b2, q[j:j + 6] + np.array([0, -wj * 0.34]), max(2, wj * 0.2), rng.uniform(0.25, 0.7))
            if rng.random() < 0.3:
                wl(b3, q[j:j + 4] + np.array([0, -wj * 0.42]), max(2, wj * 0.22), rng.uniform(0.3, 0.7))
        b2.commit((0.19, 0.21, 0.20), grain=1.0, soft=0.14)
        b3.commit((0.10, 0.24, 0.14), grain=0.92, soft=0.15)

    # ---- 6. ferns and small company
    def fern_clump(x, y, n, lmin, lmax, cd, cl, kk=1.0, spread=(0.35, 2.8)):
        bd = Batch(c); bl = Batch(c)
        px, py = view.pt(x, y)
        for i in range(n):
            fern(bd, bl, rng, px + rng.normal(0, 6 * k), py + rng.normal(0, 3 * k), rng.uniform(lmin, lmax) * k, rng.uniform(*spread), curl=rng.uniform(0.4, 0.9), k=k * kk)
        bd.commit(cd, grain=0.8, soft=0.16)
        bl.commit(cl, grain=0.92, soft=0.15)

    fern_clump(742, 905, 6, 80, 150, (0.07, 0.17, 0.12), (0.13, 0.30, 0.19), 0.8)
    fern_clump(1560, 800, 7, 60, 120, (0.07, 0.16, 0.13), (0.12, 0.27, 0.20), 0.7)
    fern_clump(1010, 790, 5, 50, 90, (0.07, 0.15, 0.13), (0.11, 0.24, 0.19), 0.6)
    fern_clump(1790, 900, 8, 100, 190, (0.07, 0.18, 0.12), (0.14, 0.33, 0.20), 1.0)
    fern_clump(90, 985, 6, 90, 170, (0.06, 0.15, 0.11), (0.12, 0.28, 0.18), 1.0)
    fern_clump(1420, 950, 5, 60, 110, (0.07, 0.17, 0.12), (0.13, 0.30, 0.19), 0.8, spread=(0.2, 1.3))
    # mushrooms: a few pale buttons
    for (mx, my, ms) in [(840, 928, 1.0), (862, 934, 0.7), (1515, 962, 0.9), (640, 968, 0.8), (1690, 870, 0.6), (1702, 874, 0.45), (985, 1010, 1.1)]:
        px, py = view.pt(mx, my)
        r = 8 * ms * k
        oline(c, [(px, py), (px + 1, py - r * 1.5)], (0.42, 0.40, 0.36), max(1.5, r * 0.4), rng, wob=0, v=0.8, taper=(1, 0.8))
        cap = np.stack([px + r * 1.25 * np.cos(np.linspace(math.pi, 2 * math.pi, 9)), py - r * 1.4 + r * 0.9 * np.sin(np.linspace(math.pi, 2 * math.pi, 9))], 1)
        fillp(c, cap, (0.50, 0.47, 0.42), rng, ang=0.2, w=max(1.2, r * 0.3), solid=0.8, grain=0.6, edge=0.7)
    # ---- 7. the canopy's underside, and the dark foreground that the eye looks past
    b = Batch(c); b2 = Batch(c); b3 = Batch(c)
    for i in range(70):
        x = rng.uniform(380, 1940); y = rng.uniform(-30, 70) * (1 + 0.5 * math.sin(x / 210.0))
        if abs(x - 1520) < 110:
            continue
        droop = rng.uniform(40, 150)
        a0 = rng.uniform(1.1, 2.0)
        q = np.array([(x, y), (x + math.cos(a0) * droop * 0.5, y + droop * 0.55), (x + math.cos(a0) * droop * 0.8, y + droop)])
        wl(b, q, 2.5, 0.9)
        qq = catmull(q, 10)
        for p in qq:
            for sgn in (-1, 1):
                a = a0 + sgn * rng.uniform(0.5, 1.2)
                ln = rng.uniform(12, 26)
                e2 = (p[0] + math.cos(a) * ln, p[1] + abs(math.sin(a)) * ln * 0.8)
                wl(b, [p, e2], rng.uniform(5, 9), rng.uniform(0.7, 1.0), taper=(1.0, 0.25))
                if rng.random() < 0.25:
                    wl(b2, [p, e2], rng.uniform(2, 4), rng.uniform(0.2, 0.5), taper=(1.0, 0.25))
    for i in range(200):
        x = rng.uniform(380, 1940); y = rng.uniform(-20, 40)
        wl(b3, [(x, y), (x + rng.normal(0, 30), y + rng.uniform(10, 50))], rng.uniform(20, 40), rng.uniform(0.5, 1.0))
    b3.commit((0.03, 0.04, 0.05), grain=0.6, soft=0.2, blur=2 * k)
    b.commit((0.032, 0.048, 0.056), grain=0.45, soft=0.2)
    b2.commit((0.10, 0.22, 0.17), grain=1.0, soft=0.14)
    return c


def forest_fg(paper, view=V1, seed=5):
    """near ferns, on their own sheet so that things can pass behind them"""
    rng = np.random.default_rng(seed)
    L = Layer(paper)
    k = view.k
    for (x, y, n, l0, l1, sp) in [(1905, 1120, 8, 240, 400, (1.6, 2.9)), (1500, 1130, 5, 130, 220, (0.9, 2.3)), (300, 1125, 6, 160, 280, (0.4, 1.8)), (-10, 1100, 6, 200, 330, (0.2, 1.2))]:
        bd = Batch(L); bl = Batch(L)
        px, py = view.pt(x, y)
        for i in range(n):
            fern(bd, bl, rng, px + rng.normal(0, 14 * k), py, rng.uniform(l0, l1) * k, rng.uniform(*sp), curl=rng.uniform(0.3, 0.8), k=k * 1.7)
        bd.commit((0.030, 0.045, 0.050), grain=0.45, soft=0.25)
        bl.commit((0.050, 0.095, 0.085), grain=0.8, soft=0.2)
    return L


# ------------------------------------------------------------------ the fleck
def fleck_geometry(u):
    """u: 0 before it arrives .. 1 as it leaves. the patch slides along the floor like the hand of a clock.
    returns (cx, cy, rx, ry, strength)"""
    cx = lerp(PLANT_X + 250, PLANT_X - 210, u)
    cy = float(ground_y(cx)) + 8
    st = sstep(0.0, 0.10, u) * (1 - sstep(0.90, 1.0, u))
    return cx, cy, 235.0, 56.0, st


def fleck_field(paper, view, cx, cy, rx, ry, st, soft=0.55):
    """a light field 0..1 over the sheet for one position of the fleck (for lighting the creatures):
    the lit pool on the floor and the column of lit air above it"""
    yy, xx = np.mgrid[0:paper.h, 0:paper.w].astype(F32)
    px, py = view.pt(cx, cy)
    k = view.k
    # the shaft comes down from upper right
    sx = px + (py - yy) * 0.36
    col = np.exp(-((xx - sx) / (rx * k * 0.80)) ** 2) * (yy < py + ry * k)
    pool = np.exp(-(((xx - px) / (rx * k)) ** 2 + ((yy - py) / (ry * k)) ** 2) * 1.2)
    f = np.clip(np.maximum(col * 0.9, pool), 0, 1) * st
    return f.astype(F32)


def draw_fleck(c, rng, view, cx, cy, rx, ry, st, flick=1.0):
    """the light itself, drawn onto the dark with the side of a pale stick, again each time it moves"""
    if st <= 0.01:
        return
    k = view.k
    px, py = view.pt(cx, cy)
    top_y = -20.0
    # the shaft: long faint strokes; the tooth of the paper is the dust in it
    b = Batch(c); b2 = Batch(c)
    for i in range(46):
        u = rng.normal(0, 0.42)
        if abs(u) > 1:
            continue
        x_b = px + u * rx * k * 0.95
        y_b = py + rng.normal(0, ry * k * 0.3)
        y_t = top_y + rng.uniform(0, 260 * k) * rng.random()
        x_t = x_b + (y_b - y_t) * 0.36 + rng.normal(0, 14 * k)
        v = rng.uniform(0.05, 0.19) * (1 - abs(u) * 0.6) * st * flick
        b.line(np.array([(x_t, y_t), (x_b, y_b)]), rng.uniform(14, 34) * k, v)
        if rng.random() < 0.3:
            b2.line(np.array([(x_t, y_t), ((x_t + x_b) / 2, (y_t + y_b) / 2)]), rng.uniform(5, 12) * k, v * 0.9)
    items = list(b.items)
    b.commit((0.50, 0.62, 0.46), grain=0.30, soft=0.9, streak=(105, 0.75, 30), blur=5.0 * k, op=0.75, gain=2.6)
    b.items = items
    b.commit((0.66, 0.74, 0.50), grain=1.0, soft=0.10, streak=(105, 0.65, 30), blur=2.0 * k, gain=0.85)
    b2.commit((0.84, 0.86, 0.58), grain=1.0, soft=0.10, streak=(105, 0.65, 30), blur=1.5 * k)
    # the pool on the floor
    bs = [Batch(c) for _ in range(4)]
    cols = [(0.36, 0.44, 0.16), (0.62, 0.66, 0.26), (0.88, 0.82, 0.44), (0.99, 0.95, 0.70)]
    for i in range(int(330 * st)):
        a = rng.uniform(0, 6.283); d = rng.random() ** 0.75
        x = px + math.cos(a) * d * rx * k * 1.05; y = py + math.sin(a) * d * ry * k * 1.05
        j = 0 if d > 0.78 else (1 if d > 0.5 else (2 if (d > 0.22 or rng.random() < 0.6) else 3))
        ln = rng.uniform(5, 15) * k; an = rng.normal(0, 0.3)
        bs[j].line(np.array([(x - math.cos(an) * ln, y - math.sin(an) * ln * 0.4), (x + math.cos(an) * ln, y + math.sin(an) * ln * 0.4)]),
                   rng.uniform(3, 8) * k, rng.uniform(0.25, 0.8) * st * flick * (1.15 - d * 0.6))
    for bb, col in zip(bs, cols):
        bb.commit(col, grain=0.95, soft=0.15, streak=(0, 0.3))
    # motes
    b = Batch(c)
    for i in range(int(24 * st)):
        u = rng.normal(0, 0.4); t = rng.random()
        y = lerp(py - 20 * k, py - 560 * k, t)
        x = px + u * rx * k * 0.8 + (py - y) * 0.36
        b.dot(x, y, rng.uniform(0.8, 1.9) * k, rng.uniform(0.3, 0.9) * st)
    b.commit((0.98, 0.95, 0.72), grain=0.5, soft=0.3)


# ------------------------------------------------------------------ the edge of the forest, from inside
def edge_ground(x):
    x = np.asarray(x, np.float64)
    return 905 + 8 * np.sin(x / 170.0) - 10 * (x / 1920.0)


def edge_plate(paper, seed=31):
    rng = np.random.default_rng(seed)
    c = Canvas(paper)
    # the brightness beyond: laid on in upright strokes, thicker toward the way out
    for col, x0, sp, n, pv in [((0.16, 0.34, 0.33), 900, 700, 320, (0.15, 0.5)), ((0.42, 0.62, 0.48), 1350, 480, 300, (0.2, 0.7)),
                               ((0.78, 0.88, 0.62), 1650, 330, 300, (0.3, 0.9)), ((0.97, 0.98, 0.84), 1820, 240, 260, (0.4, 1.0))]:
        b = Batch(c)
        for i in range(n):
            x = rng.normal(x0, sp)
            if x < 250:
                continue
            y0 = rng.uniform(-20, 640); ln = rng.uniform(120, 360)
            b.line(np.array([(x, y0), (x + rng.normal(0, 6), min(800.0, y0 + ln))]), rng.uniform(18, 44), rng.uniform(*pv))
        b.commit(col, grain=0.9, soft=0.16, streak=(90, 0.45, 20), blur=1.5)
    c.smudge(np.ones((820, paper.w), F32), 0, 0, sigma=4, strength=0.4)
    # far trunks against it
    b = Batch(c)
    for i in range(24):
        x = rng.uniform(300, 1900)
        w = rng.uniform(10, 34) * (1.2 - 0.5 * x / 1900)
        b.line(np.array([(x + rng.normal(0, 8), -10), (x, 400), (x + rng.normal(0, 4), 790)]), w, 0.9)
    b.commit((0.07, 0.13, 0.15), grain=0.45, soft=0.2, blur=1.0)
    # the floor: dark, then long tongues of light reaching in between the shadows
    b = Batch(c)
    for i in range(260):
        y = rng.uniform(770, 1090); x = rng.uniform(-50, 1900)
        b.line(np.array([(x, y), (x + rng.uniform(150, 420), y + rng.normal(0, 5))]), rng.uniform(18, 40), rng.uniform(0.4, 0.85))
    b.commit((0.075, 0.075, 0.09), grain=0.75, soft=0.2, streak=(0, 0.5))
    bs = [Batch(c) for _ in range(4)]
    cols = [(0.16, 0.11, 0.11), (0.12, 0.17, 0.13), (0.17, 0.12, 0.17), (0.25, 0.19, 0.12)]
    for i in range(2600):
        x = rng.uniform(-20, 1940); y = rng.uniform(780, 1085); a = rng.normal(0, 0.3); ln = rng.uniform(5, 15)
        bs[rng.integers(0, 4)].line(np.array([(x - ln, y - math.sin(a) * ln * 0.4), (x + ln, y + math.sin(a) * ln * 0.4)]), rng.uniform(3, 8), rng.uniform(0.3, 0.8))
    for bb, col in zip(bs, cols):
        bb.commit(col, grain=0.9, soft=0.15)
    bs = [Batch(c) for _ in range(3)]
    cols = [(0.30, 0.42, 0.20), (0.62, 0.70, 0.32), (0.93, 0.92, 0.62)]
    for i in range(900):
        x = rng.normal(1650, 520); y = rng.uniform(800, 1080)
        lane = math.sin(y / 23.0 + 1.0) + 0.6 * math.sin(y / 9.0)
        if x < 420 or lane < -0.2:
            continue
        j = 0 if x < 1150 else (1 if x < 1560 or rng.random() < 0.5 else 2)
        ln = rng.uniform(20, 90)
        bs[j].line(np.array([(x - ln, y), (x + ln, y + rng.normal(0, 2))]), rng.uniform(3, 8), rng.uniform(0.3, 0.9) * clamp((x - 420) / 700.0 + 0.25))
    for bb, col in zip(bs, cols):
        bb.commit(col, grain=0.95, soft=0.15, streak=(0, 0.4))
    # near trunks, almost black, rimmed on the side that faces the day
    for (x, w, yb) in [(110, 250, 880), (610, 120, 850), (1010, 78, 826), (1500, 54, 812)]:
        pl = np.array([(x - w / 2, -10), (x - w / 2, 420), (x - w * 0.56, yb - 70), (x - w * 0.9, yb), (x - w * 1.4, yb + 30),
                       (x + w * 1.5, yb + 34), (x + w * 0.95, yb), (x + w * 0.56, yb - 70), (x + w / 2, 420), (x + w / 2, -10)])
        fillp(c, catmull(pl, 8), (0.035, 0.04, 0.05), rng, ang=math.pi / 2, w=8, solid=0.9, grain=0.45, edge=1.3, wob=3)
        b = Batch(c); b2 = Batch(c)
        for j in range(int(w * 1.3)):
            u = rng.uniform(-0.46, 0.5); y0 = rng.uniform(-10, yb - 30); ln = rng.uniform(40, 170)
            xx = x + u * w
            if u > 0.30:
                b2.line(np.array([(xx, y0), (xx + rng.normal(0, 3), y0 + ln)]), rng.uniform(2, 5), rng.uniform(0.3, 0.9) * (u + 0.3) * clamp(x / 900.0 + 0.3))
            else:
                b.line(np.array([(xx, y0), (xx + rng.normal(0, 3), y0 + ln)]), rng.uniform(2, 6), rng.uniform(0.2, 0.5))
        b.commit((0.08, 0.09, 0.10), grain=0.95, soft=0.15)
        b2.commit((0.62, 0.74, 0.46), grain=1.0, soft=0.14)
    # ferns, and the leaves overhead with the day coming through them
    for (x, y, n, l0, l1) in [(330, 915, 6, 70, 140), (820, 880, 6, 60, 110), (1280, 870, 6, 50, 100), (1700, 930, 7, 80, 160)]:
        bd = Batch(c); bl = Batch(c)
        for i in range(n):
            fern(bd, bl, rng, x + rng.normal(0, 8), y, rng.uniform(l0, l1), rng.uniform(0.4, 2.7), curl=rng.uniform(0.4, 0.9), k=0.9)
        bd.commit((0.06, 0.15, 0.11), grain=0.8, soft=0.16)
        bl.commit(mix((0.12, 0.28, 0.18), (0.50, 0.66, 0.30), x / 1900.0), grain=0.92, soft=0.15)
    b = Batch(c); b2 = Batch(c); b3 = Batch(c)
    for i in range(1300):
        x = rng.uniform(-20, 1940); y = abs(rng.normal(0, 95)) * (1 + 0.5 * math.sin(x / 230.0))
        a = rng.uniform(0, 3.14); ln = rng.uniform(6, 16)
        p = np.array([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln * 0.7)])
        b.line(p, rng.uniform(6, 12), rng.uniform(0.6, 1.0), taper=(1.0, 0.4))
        if x > 900 and rng.random() < 0.35 * (x - 900) / 1000.0 + 0.05:
            (b3 if rng.random() < 0.4 else b2).line(p + np.array([4, 6]), rng.uniform(4, 9), rng.uniform(0.4, 1.0), taper=(1.0, 0.4))
    b.commit((0.03, 0.045, 0.05), grain=0.5, soft=0.2)
    b2.commit((0.36, 0.56, 0.22), grain=0.85, soft=0.16)
    b3.commit((0.78, 0.86, 0.36), grain=0.85, soft=0.16)
    return c


def light_plate(paper, seed=32):
    """nothing but brightness: what the eye sees when it walks out of the dark"""
    rng = np.random.default_rng(seed)
    c = Canvas(paper)
    for col, n, pv in [((0.90, 0.93, 0.74), 900, (0.5, 1.0)), ((0.98, 0.975, 0.86), 900, (0.5, 1.0)), ((1.0, 0.995, 0.93), 500, (0.4, 1.0))]:
        b = Batch(c)
        for i in range(n):
            x = rng.uniform(-200, 1900); y = rng.uniform(-30, 1100); a = rng.normal(0.25, 0.2); ln = rng.uniform(120, 420)
            b.line(np.array([(x, y), (x + math.cos(a) * ln, y - math.sin(a) * ln)]), rng.uniform(22, 50), rng.uniform(*pv))
        b.commit(col, grain=0.8, soft=0.18, streak=(-15, 0.35, 20))
    return c
