"""The slab: every stone of 'Dilli, Inlaid'. World = 1920 x 1080, y down."""
import math
import numpy as np
from scene import (Scene, Path, spline, resample, arch_pts, ell_pts, petal_pts, stroke_poly,
                   ONION, HEMI, BULB, SHIK, SAUCER, PI, WW, WH, MAT)

UP, DOWN, LEFT, RIGHT = -PI / 2, PI / 2, PI, 0.
PATHS = {}
ANCH = {}

RIVER_CTRL = [(1566, -30), (1556, 120), (1534, 250), (1568, 372), (1604, 470), (1580, 590), (1524, 700),
              (1510, 792), (1560, 900), (1628, 1000), (1650, 1110)]
R1_CTRL = [(60, 323), (500, 323), (1000, 323), (1440, 322), (1500, 300), (1540, 262), (1600, 256), (1700, 262), (1860, 258)]
R2_CTRL = [(400, 664), (700, 664), (1000, 664), (1160, 664), (1300, 656), (1420, 664), (1500, 676)]
R3_CTRL = [(60, 782), (330, 768), (640, 748), (860, 712), (980, 692), (1060, 690)]
METRO_CTRL = [(60, 352), (400, 353), (760, 347), (1100, 353), (1420, 357), (1580, 350), (1740, 352), (1860, 353)]


# ============================================================================ border
def border(s):
    s.group('border', 0, 138)
    per = 2 * (WW - 88) + 2 * (WH - 88)

    def chase(x, y):  # perimeter fraction clockwise from top-left
        if y < 100 and x < WW - 60:
            d = x
        elif x > WW - 100:
            d = WW + y
        elif y > WH - 100:
            d = WW + WH + (WW - x)
        else:
            d = 2 * WW + WH + (WH - y)
        return (d / (2 * WW + 2 * WH)) % 1.0

    # margin slabs: the river and roads run out underneath them
    nb = 30
    for i in range(nb):
        x0, x1 = 66 + i * (WW - 132) / nb, 66 + (i + 1) * (WW - 132) / nb
        s.rect(x0, 0, x1 - x0, 66, 'BLK', key=chase((x0 + x1) / 2, 30) * .9, style='fly')
        s.rect(x0, WH - 66, x1 - x0, 66, 'BLK', key=chase((x0 + x1) / 2, WH - 30) * .9, style='fly')
    nb = 16
    for i in range(nb):
        y0, y1 = 66 + i * (WH - 132) / nb, 66 + (i + 1) * (WH - 132) / nb
        s.rect(0, y0, 66, y1 - y0, 'BLK', key=chase(30, (y0 + y1) / 2) * .9, style='fly')
        s.rect(WW - 66, y0, 66, y1 - y0, 'BLK', key=chase(WW - 30, (y0 + y1) / 2) * .9, style='fly')
    for (x, y, k) in ((0, 0, 0.), (WW - 66, 0, .25), (WW - 66, WH - 66, .5), (0, WH - 66, .75)):
        s.rect(x, y, 66, 66, 'BLK', key=k * .9, style='fly', var=1)
    for ins, w in ((22, 2.6), (66, 2.4), (72, .9)):
        a, b = ins, WW - ins
        c, d = ins, WH - ins
        m = 'GLD'
        s.line([(a, c), (b, c)], w, m, key=.02, step=20)
        s.line([(b, c), (b, d)], w, m, key=.27, step=20)
        s.line([(b, d), (a, d)], w, m, key=.52, step=20)
        s.line([(a, d), (a, c)], w, m, key=.77, step=20)
    # band motifs
    def motif(x, y, ang, i):
        k = chase(x, y) * .92 + .03
        ca, sa = math.cos(ang), math.sin(ang)   # 'outward' direction
        if i % 2 == 0:
            for j, a in enumerate((-.75, 0, .75)):
                s.petal(x - ca * 9, y - sa * 9, ang + a, 20 if j == 1 else 16, 10, 'CAR' if j == 1 else 'COR', key=k, style='fly')
            for sg in (-1, 1):
                s.petal(x - ca * 9, y - sa * 9, ang + sg * 1.9, 14, 7, 'MAL', key=k + .01, style='fly')
        else:
            px, py = -sa, ca
            d = [(x + ca * 11, y + sa * 11), (x + px * 8, y + py * 8), (x - ca * 11, y - sa * 11), (x - px * 8, y - py * 8)]
            s.add(d, 'LAP', key=k, style='fly')
            s.ell(x, y, 3, 3, 'GLD', n=8, key=k + .02, style='grow')
            for sg in (-1, 1):
                s.ell(x + sg * (-sa) * 17, y + sg * ca * 17, 3, 3, 'TUR', n=8, key=k + .01, style='grow')
    nx, ny = 30, 16
    for i in range(nx):
        x = 104 + i * (WW - 208) / (nx - 1)
        motif(x, 44, UP, i)
        motif(x, WH - 44, DOWN, i + 1)
    for i in range(ny):
        y = 100 + i * (WH - 200) / (ny - 1)
        motif(44, y, LEFT, i + 1)
        motif(WW - 44, y, RIGHT, i)
    # vine
    for (x0, y0, x1, y1, k) in ((80, 44, WW - 80, 44, .02), (WW - 44, 80, WW - 44, WH - 80, .27),
                                (WW - 80, WH - 44, 80, WH - 44, .52), (44, WH - 80, 44, 80, .77)):
        L = math.hypot(x1 - x0, y1 - y0)
        n = int(L / 4)
        t = np.linspace(0, 1, n)
        dx, dy = (x1 - x0) / L, (y1 - y0) / L
        wv = 8 * np.sin(t * L * 2 * PI / 116.4)
        P = np.stack([x0 + (x1 - x0) * t - dy * wv, y0 + (y1 - y0) * t + dx * wv], 1)
        nseg = 6
        for j in range(nseg):
            a, b = j * n // nseg, min(n, (j + 1) * n // nseg + 1)
            s.line(P[a:b], 1.4, 'GLD', key=k + .23 * j / nseg)
    # corner stars
    for (x, y, k) in ((44, 44, .0), (WW - 44, 44, .25), (WW - 44, WH - 44, .5), (44, WH - 44, .75)):
        for r, m, a0 in ((17, 'LAP', 0), (17, 'TUR', PI / 4)):
            s.add(ell_pts(x, y, r, r, 4, a0, a0 + 2 * PI), m, key=k, style='fly')
        s.ell(x, y, 7.5, 7.5, 'PRL', n=14, key=k + .02, style='grow')
        s.line(ell_pts(x, y, 11, 11, 20), 1.2, 'GLD', key=k + .03, closed=True)


# ============================================================================ water, roads, metro
def river(s):
    s.group('river', 2, 104)
    P = Path(RIVER_CTRL, 4., clip=(0, 30, 1920, 1050))
    PATHS['river'] = P
    L = P.L

    def width(u):
        return 72 + 9 * np.sin(u * 9.) + 5 * np.sin(u * 23.)

    def fn(u, v):
        sv = u * L
        x = np.interp(sv, P.s, P.P[:, 0])
        y = np.interp(sv, P.s, P.P[:, 1])
        x2 = np.interp(np.clip(sv + 4, 0, L), P.s, P.P[:, 0]) - np.interp(np.clip(sv - 4, 0, L), P.s, P.P[:, 0])
        y2 = np.interp(np.clip(sv + 4, 0, L), P.s, P.P[:, 1]) - np.interp(np.clip(sv - 4, 0, L), P.s, P.P[:, 1])
        ln = np.hypot(x2, y2) + 1e-6
        w = width(u)
        return x - y2 / ln * (v - .5) * w, y + x2 / ln * (v - .5) * w

    nu = 104
    its = s.mesh(fn, nu, 5, 'LAP', sub=2, jit=.75, keyfn=lambda u, v: u * .93 + .04 * s.rng.random())
    k = 0
    for j in range(5):
        for i in range(nu):
            it = its[k]
            k += 1
            c = it['pts'].mean(0)
            it['tag'] = ('river', ((i + .5) / nu * L, (j + .5) / 5))
            it['off'] = (1566 - c[0] + s.rng.normal() * 40, -120 - c[1] + s.rng.normal() * 30)
            it['dur'] = 22 + 26 * (i / nu)
            it['rot'] = s.rng.normal() * .6
    u = np.linspace(0, 1, 260)
    for sgn in (0., 1.):
        x, y = fn(u, np.full_like(u, sgn))
        Pb = np.stack([x, y], 1)
        for j in range(6):
            a, b = j * 260 // 6, min(260, (j + 1) * 260 // 6 + 1)
            s.line(Pb[a:b], 1.3, 'GLD', key=.12 + .14 * j)


def road(s, name, ctrl, w=13., m='SLT', dash=True, k0=0., k1=.8):
    P = Path(ctrl, 3., clip=(44, 0, 1876, 1080))
    PATHS[name] = P
    L = P.L
    n = int(L / 20)
    for i in range(n):
        a, b = i * L / n, (i + 1) * L / n
        ss = np.linspace(a, b, 5)
        x = np.interp(ss, P.s, P.P[:, 0])
        y = np.interp(ss, P.s, P.P[:, 1])
        Lr, Rr = stroke_poly(np.stack([x, y], 1), w)
        s.add(np.concatenate([Lr, Rr[::-1]], 0), m, key=k0 + (k1 - k0) * i / n, style='fly')
        if dash and i % 2 == 0:
            xm, ym = x[1:4], y[1:4]
            s.line(np.stack([xm, ym], 1), .9, 'PRL', key=min(1., k0 + (k1 - k0) * i / n + .15))


def roads(s):
    s.group('roads', 6, 96, ang=LEFT)
    road(s, 'r1', R1_CTRL)
    s.group('roads2', 20, 80, ang=RIGHT)
    road(s, 'r3', R3_CTRL, w=11)


def metro(s):
    s.group('metro', 26, 92, ang=UP)
    P = Path(METRO_CTRL, 3., clip=(44, 0, 1876, 1080))
    PATHS['metro'] = P
    L = P.L
    npier = int(L / 46)
    for i in range(npier + 1):
        sv = i * L / npier
        x, y, _ = P.at(sv)
        over_river = 1500 < x < 1640
        h = 22 if over_river else 15
        s.add([(x - 2.2, y + 2), (x + 2.2, y + 2), (x + 1.6, y + h), (x - 1.6, y + h)], 'GRY', key=.05 + .7 * i / npier, var=1)
        s.rect(x - 5, y + 1.5, 10, 2.6, 'GRY', key=.07 + .7 * i / npier, var=2)
    n = int(L / 26)
    for i in range(n):
        ss = np.linspace(i * L / n, (i + 1) * L / n, 4)
        x = np.interp(ss, P.s, P.P[:, 0])
        y = np.interp(ss, P.s, P.P[:, 1])
        Lr, Rr = stroke_poly(np.stack([x, y], 1), 4.6)
        s.add(np.concatenate([Lr, Rr[::-1]], 0), 'GRY', key=.12 + .7 * i / n, off=(-700 - 300 * s.rng.random(), -60 * s.rng.random()))
    s.line(P.P[::3] + (0, -2.6), .8, 'PRL', key=.93)
    for cx in (640, 1750):  # stations
        x, y, _ = P.at(cx - 60)
        s.add(arch_pts(cx, y - 2, 78, 13, 'rd'), 'GRY', key=.86, var=2)
        s.line(arch_pts(cx, y - 2, 78, 13, 'rd')[1:-1], 1.1, 'GLD', key=.95)
        for dx in (-30, -15, 0, 15, 30):
            s.rect(cx + dx - .6, y - 11, 1.2, 9, 'SLT', key=.9)


# ============================================================================ Old Delhi
def chandni(s):
    s.group('chandni', 4, 118, ang=UP - .5)
    B = 300.
    ws = [44, 38, 52, 40, 56, 36, 48, 42, 40, 32]
    hs = [96, 128, 104, 150, 112, 138, 96, 124, 108, 86]
    ms = ['CRM', 'ROS', 'BUF', 'TUR', 'WHT', 'RED', 'WHT', 'CRM', 'ROS', 'BUF']
    aw = ['CAR', 'LAP', 'COR', 'AMB', 'MAL', 'TUR', 'AMB', 'PNK', 'LAP', 'CAR']
    x = 336.
    s.blocks(330, B, 440, 7, 1, 30, 'GRY', k0=0, k1=.2)          # pavement
    roofs = []
    for i, (w, h, m) in enumerate(zip(ws, hs, ms)):
        rows = int(round(h / 11))
        s.blocks(x, B - h, w, h, rows, max(2, int(w / 13)), m, k0=.05, k1=.6)
        s.rect(x - 1.5, B - h - 4, w + 3, 4, 'RDK' if m != 'RED' else 'BUF', key=.62)   # parapet
        roofs.append((x + w / 2, B - h - 4, w))
        # shop
        s.rect(x + 4, B - 21, w - 8, 21, 'ONX', key=.5)
        n = 6
        for j in range(n):
            xa, xb = x + 2 + (w - 4) * j / n, x + 2 + (w - 4) * (j + 1) / n
            s.add([(xa, B - 28), (xb, B - 28), (xb + (j + 1 - n / 2) * .9, B - 20), (xa + (j - n / 2) * .9, B - 20)],
                  aw[i] if j % 2 == 0 else 'WHT', key=.66 + .01 * j)
        # signboard
        s.rect(x + 4, B - 38, w - 8, 8, ['LAP', 'WHT', 'PNK', 'AMB', 'RDK', 'TUR', 'LAP', 'MAL', 'AMB', 'AME'][i], key=.7)
        if i == 1:   # the jalebi-wala
            t = np.linspace(0, 5.2 * PI, 40)
            s.line(np.stack([x + w / 2 + (.25 + t * .19) * np.cos(t), B - 34 + (.25 + t * .19) * np.sin(t) * .95], 1), .8, 'CAR', key=.9)
        else:
            t = np.linspace(0, 1, 12)
            s.line(np.stack([x + 7 + (w - 14) * t, B - 34 + 1.6 * np.sin(t * 14 + i)], 1), .8, 'GLD' if i != 1 else 'CAR', key=.9)
        # goods
        if i in (0, 4, 7):   # Khari Baoli spice heaps
            for j, gm in enumerate(('AMB', 'CAR', 'JAD', 'RDK')[:int((w - 8) / 9)]):
                gx = x + 9 + j * 9
                s.add([(gx - 4, B - 1), (gx + 4, B - 1), (gx, B - 9)], gm, key=.72, style='grow', anchor=(gx, B))
        elif i in (2, 5, 8):   # bolts of cloth
            for j in range(int((w - 10) / 5)):
                s.rect(x + 6 + j * 5, B - 18, 4, 12, ['PNK', 'TUR', 'AMB', 'AME', 'COR', 'JAD', 'LAP', 'WHT'][j % 8], key=.72, style='grow')
        else:
            s.person(x + w / 2, B - 1, 15, ['WHT', 'AMB', 'TUR', 'PNK'][i % 4], hat=['CAR', None, 'PNK', None][i % 4],
                     head=[None, 'COR', None, 'AMB'][i % 4], face=1 if i % 2 else -1, key=.78)
        # windows
        fl = 0
        yy = B - 46
        while yy - 20 > B - h:
            nw = 2 if w >= 40 else 1
            for j in range(nw):
                wx = x + w * (j + 1) / (nw + 1)
                if i in (3, 5) and fl == 1 and j == 0:   # jharokha
                    s.rect(wx - 8, yy - 2, 16, 4, 'BRN', key=.7)
                    s.arch(wx, yy - 2, 10, 15, 'ONX', key=.68, frame=.8)
                    s.dome(wx, yy - 19, 8, 7, HEMI, gores=3, bands=1, m='TUR', k0=.72, k1=.76, finial=3)
                else:
                    s.arch(wx, yy, 9, 15, 'ONX' if (i + j + fl) % 3 else 'LAP', key=.66, frame=.7)
                    s.rect(wx - 6, yy, 12, 1.6, 'BRN', key=.7)
            yy -= 27
            fl += 1
        x += w
    ANCH['roofs'] = roofs
    # rooftop life: tanks, washing line, kabootar-baz frame, Sis Ganj dome
    rx, ry, rw = roofs[0]
    s.rect(rx - 12, ry - 12, 10, 12, 'SLT', key=.74)
    s.ell(rx - 7, ry - 12, 5, 2, 'SLT', n=10, key=.75, var=2)
    rx, ry, rw = roofs[4]
    for j, cm in enumerate(('PNK', 'TUR', 'AMB', 'WHT', 'COR')):
        s.rect(rx - 22 + j * 9, ry - 15, 7, 10 + (j % 2) * 2, cm, key=.8, style='grow', anchor=(rx - 18 + j * 9, ry - 15))
    s.line([(rx - 26, ry), (rx - 26, ry - 17)], 1.2, 'BRN', key=.76)
    s.line([(rx + 26, ry), (rx + 26, ry - 17)], 1.2, 'BRN', key=.76)
    s.line([(rx - 26, ry - 16), (rx + 26, ry - 16)], .6, 'GLD', key=.78)
    rx, ry, rw = roofs[7]     # pigeon-keeper's frame
    for j in range(5):
        s.line([(rx - 12 + j * 6, ry), (rx - 12 + j * 6, ry - 20)], .8, 'GLD', key=.84)
    for j in range(4):
        s.line([(rx - 12, ry - 5 - j * 5), (rx + 12, ry - 5 - j * 5)], .8, 'GLD', key=.86)
    ANCH['kabootar'] = (rx, ry - 20)
    rx, ry, rw = roofs[6]     # Gurdwara Sis Ganj
    s.rect(rx - 13, ry - 8, 26, 8, 'WHT', key=.7)
    s.dome(rx, ry - 8, 12, 19, ONION, gores=5, bands=2, m='GLD', k0=.78, k1=.88, finial=6)
    for dx in (-18, 18):
        s.dome(rx + dx, ry, 5, 8, ONION, gores=3, bands=1, m='GLD', k0=.8, k1=.86, finial=3)
    # kite flyers
    for idx, fc in ((3, 1), (9, -1), (1, 1)):
        rx, ry, rw = roofs[idx]
        s.person(rx + 6 * fc, ry, 15, ['WHT', 'AMB', 'TUR'][idx % 3], hat='CAR' if idx == 3 else None, face=fc, arm=(.35 * fc, -.5), key=.82)
        ANCH.setdefault('flyers', []).append((rx + 6 * fc + fc * 15 * .43, ry - 15 * 1.05))
    # poles + the tangle of wires
    poles = [352, 470, 596, 700, 760]
    for px_ in poles:
        s.line([(px_, B), (px_, B - 78)], 1.6, 'BRN', key=.6)
        s.line([(px_ - 7, B - 72), (px_ + 7, B - 72)], 1.2, 'BRN', key=.62)
    t = np.linspace(0, 1, 14)
    rg = np.random.default_rng(4)
    for a, b in zip(poles[:-1], poles[1:]):
        for j in range(4):
            y0 = B - 76 + j * 3 + rg.random() * 4
            y1 = B - 76 + ((j + 1 + int(rg.random() * 3)) % 4) * 3
            sag = 6 + rg.random() * 12
            s.line(np.stack([a + (b - a) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)], 1), .7, 'ONX' if j % 2 else 'SLT', key=.9)
    # marigold garlands across shopfronts
    for a, b in ((338, 378), (420, 468), (512, 566), (604, 648), (692, 730)):
        for j in range(11):
            tt = j / 10
            s.ell(a + (b - a) * tt, B - 29 + 5 * 4 * tt * (1 - tt), 1.3, 1.3, 'AMB' if j % 2 else 'CAR', n=6, key=.93, style='grow')
    # chai stall
    cx = 782.
    s.rect(cx - 9, B - 9, 18, 9, 'BRN', key=.7)
    s.rect(cx - 10, B - 11, 20, 2.4, 'BUF', key=.72)
    s.add([(cx - 4, B - 11), (cx + 2, B - 11), (cx + 1, B - 17), (cx - 3, B - 17)], 'GRY', key=.8, style='grow')
    s.person(cx + 13, B, 15, 'LAP', hat=None, head=None, face=-1, key=.84)
    ANCH['chai'] = (cx - 1, B - 18)


def jama(s):
    s.group('jama', 10, 124, ang=UP)
    cx, B = 940., 300.
    for i, (w, y) in enumerate(((250, 300), (238, 295), (226, 290))):
        s.blocks(cx - w / 2, y - 5, w, 5, 1, 16, 'RED', k0=.0 + i * .03, k1=.1 + i * .03)
    s.blocks(cx - 108, 262, 216, 23, 2, 16, 'RED', k0=.1, k1=.25)
    # domes behind
    s.rect(cx - 21, 176, 42, 12, 'WHT', key=.5)
    s.dome(cx, 178, 27, 50, ONION, gores=9, bands=4, m='WHT', m2='ONX', k0=.58, k1=.88, finial=12)
    for sg in (-1, 1):
        s.rect(cx + sg * 60 - 15, 190, 30, 10, 'WHT', key=.5)
        s.dome(cx + sg * 60, 192, 19, 35, ONION, gores=7, bands=3, m='WHT', m2='ONX', k0=.56, k1=.86, finial=9)
    # facade
    s.blocks(cx - 98, 200, 196, 62, 5, 14, 'RED', k0=.22, k1=.55)
    s.line([(cx - 98, 200), (cx + 98, 200)], 1.6, 'WHT', key=.7)
    for sg in (-1, 1):
        for j in range(5):
            ax = cx + sg * (38 + j * 13.5)
            s.rect(ax - 5.6, 210, 11.2, 50, 'WHT', key=.6, var=1)
            s.arch(ax, 260, 9, 36, 'ONX', key=.64)
            s.rect(ax - 3.5, 213, 7, 5, 'RDK', key=.66)
    # pishtaq
    s.blocks(cx - 30, 172, 60, 90, 7, 4, 'RED', k0=.3, k1=.62)
    s.arch(cx, 262, 44, 78, 'WHT', key=.66)
    s.arch(cx, 262, 36, 70, 'ONX', key=.7, frame=1.)
    s.arch(cx, 262, 16, 30, 'RDK', key=.74, frame=.8)
    for sg in (-1, 1):
        s.rect(cx + sg * 30 - 2.5, 160, 5, 102, 'WHT', key=.6)
        s.dome(cx + sg * 30, 160, 4, 7, ONION, gores=3, bands=1, m='WHT', k0=.8, k1=.85, finial=3)
    # minarets
    for sg in (-1, 1):
        mx = cx + sg * 116
        for j in range(3):
            y1, y0 = 285 - j * 46, 285 - (j + 1) * 46 + 4
            for q in range(5):
                s.rect(mx - 7 + q * 2.8, y0, 2.8, y1 - y0, 'RED' if q % 2 == 0 else 'WHT', key=.25 + j * .15 + q * .01, var=q % 3)
            s.rect(mx - 9.5, y0 - 4, 19, 4, 'WHT', key=.4 + j * .15)
        s.chhatri(mx, 147, 15, 24, 'WHT', 'WHT', ONION, key=.82, cols=3)
    # worshippers on the steps
    for j, (dx, bm, ht) in enumerate(((-70, 'WHT', 'WHT'), (-52, 'CRM', None), (48, 'WHT', 'WHT'), (66, 'TUR', None), (84, 'WHT', 'GRY'))):
        s.person(cx + dx, 300 - (j % 3) * 4, 13, bm, hat=ht, head='PNK' if ht is None else None, face=1 if dx < 0 else -1, key=.9)
    # kebab stall (Matia Mahal side)
    kx = 1078.
    s.rect(kx - 10, B - 8, 20, 8, 'RDK', key=.7)
    for j in range(4):
        s.line([(kx - 8 + j * 5, B - 9), (kx - 6 + j * 5, B - 14)], .9, 'BRN', key=.85)
    s.person(kx - 16, B, 14, 'WHT', hat='WHT', face=1, key=.86)
    ANCH['kebab'] = (kx, B - 15)
    ANCH['jama'] = (cx, 150)


def redfort(s):
    s.group('redfort', 18, 124, ang=UP + .6)
    cx, B = 1290., 300.
    s.lawn(1102, 300, 376, 9, 'MAL', cell=12, key=None)
    # marble pavilions peeking over the wall
    for dx in (86, 108, 130):
        s.dome(cx + dx, 232, 8.5, 14, ONION, gores=5, bands=2, m='WHT', k0=.6, k1=.8, finial=5)
    s.rect(cx + 72, 230, 72, 8, 'WHT', key=.5)
    s.rect(cx - 150, 226, 40, 12, 'WHT', key=.5)
    s.dome(cx - 130, 226, 10, 9, SAUCER, gores=5, bands=1, m='WHT', k0=.6, k1=.8, finial=4)
    # curtain wall
    s.blocks(1104, 240, 372, 60, 5, 26, 'RED', k0=.05, k1=.5, m2='RDK', p2=.12)
    n = 46
    for i in range(n):
        x = 1104 + i * 372 / n
        s.add([(x + 1, 240), (x + 1, 233), (x + 372 / n / 2, 229.5), (x + 372 / n - 1, 233), (x + 372 / n - 1, 240)], 'RED', key=.52 + .1 * s.rng.random())
    s.line([(1104, 262), (1476, 262)], 1.0, 'RDK', key=.8)
    for i in range(18):
        x = 1116 + i * 20.5
        if abs(x - cx) > 60:
            s.arch(x, 284, 4, 11, 'ONX', key=.6)
    # bastions
    for bx, big in ((1110, 1), (1196, 0), (1384, 0), (1470, 1)):
        w = 28 if big else 22
        s.blocks(bx - w / 2, 224, w, 76, 6, 2, 'RED', k0=.1, k1=.55)
        s.rect(bx - w / 2 - 2, 219, w + 4, 5, 'RDK', key=.56)
        if big:
            s.chhatri(bx, 219, 20, 26, 'WHT', 'RED', ONION, key=.8, cols=3)
        else:
            s.dome(bx, 219, w / 2, 9, SAUCER, gores=4, bands=1, m='RED', k0=.6, k1=.7)
    # Lahori gate
    s.blocks(cx - 44, 188, 88, 112, 9, 6, 'RED', k0=.15, k1=.6)
    s.arch(cx, 300, 46, 84, 'WHT', key=.62, var=1)
    s.arch(cx, 300, 40, 78, 'RED', key=.64)
    s.arch(cx, 300, 28, 60, 'ONX', key=.7, frame=1.)
    for dx in (-30, 30):
        for yy in (224, 252, 280):
            s.arch(cx + dx, yy, 7, 13, 'ONX', key=.66, frame=.6)
    for sg in (-1, 1):
        tx = cx + sg * 55
        s.blocks(tx - 11, 176, 22, 124, 10, 2, 'RED', k0=.15, k1=.6, m2='RDK', p2=.2)
        for yy in (206, 240, 274):
            s.line([(tx - 11, yy), (tx + 11, yy)], 1.2, 'WHT', key=.75)
        s.chhatri(tx, 176, 21, 28, 'WHT', 'WHT', ONION, key=.82, cols=3)
        s.line([(tx + sg * 15, 188), (tx + sg * 15, 150)], 1.6, 'RED', key=.7)     # slender flanking minaret
        s.dome(tx + sg * 15, 150, 3, 6, ONION, gores=3, bands=1, m='WHT', k0=.85, k1=.9, finial=3)
    for j in range(7):          # the seven little chhatris
        x = cx - 33 + j * 11
        s.chhatri(x, 188, 8.5, 13, 'WHT', 'WHT', ONION, key=.84 + j * .01, cols=2)
    s.line([(cx, 176), (cx, 116)], 1.2, 'GLD', key=.9)
    ANCH['flag_rf'] = (cx, 118)
    # tourists
    for j, (dx, bm, hd, ht) in enumerate(((-96, 'PNK', 'AMB', None), (-84, 'WHT', None, 'AME'), (88, 'TUR', 'COR', None), (120, 'AMB', None, None))):
        s.person(cx + dx, 308, 13, bm, head=hd, hat=ht, face=1 if dx < 0 else -1, key=.92)


def old_bridges(s):
    s.group('bridges', 40, 100, ang=RIGHT)
    # Loha Pul: the double-decker iron truss, carries road r1 across
    P = PATHS['r1']
    xs = np.linspace(1512, 1640, 9)
    top, bot = [], []
    for x in xs:
        sv = np.interp(x, P.P[:, 0][P.P[:, 0].argsort()], P.s[P.P[:, 0].argsort()])
        _, y, _ = P.at(sv)
        top.append((x, y - 20))
        bot.append((x, y - 7))
    s.line(top, 1.5, 'GRY', key=.7)
    for i in range(len(xs) - 1):
        s.line([bot[i], top[i]], 1.1, 'GRY', key=.72 + i * .01)
        s.line([bot[i], top[i + 1]] if i % 2 == 0 else [top[i], bot[i + 1]], .9, 'GRY', key=.74 + i * .01)
    s.line([bot[-1], top[-1]], 1.1, 'GRY', key=.8)
    for x, (bx, by) in zip(xs[1:-1:2], bot[1:-1:2]):
        s.rect(x - 2.5, by + 13, 5, 16, 'SLT', key=.5)
    # Signature Bridge (north): leaning pylon + cable fan
    dx, dy = 1600., 132.
    s.line([(1486, dy), (1650, dy)], 2.2, 'GRY', key=.6)
    py = [(dx - 30, dy), (dx - 14, dy - 28), (dx + 12, dy - 52), (dx + 16, dy - 54), (dx - 6, dy - 26), (dx - 18, dy)]
    s.add(py, 'PRL', key=.7)
    s.add([(dx + 12, dy - 52), (dx + 16, dy - 54), (dx + 22, dy - 44), (dx + 8, dy)], 'WHT', key=.72, var=1)
    for j in range(7):
        s.line([(dx + 13, dy - 51 + j * 1.5), (dx - 42 - j * 10, dy - 1)], .5, 'GLD', key=.86 + j * .01)


# ============================================================================ Lutyens' Delhi
def kartavya(s):
    s.group('kartavya', 12, 100, ang=DOWN)
    road(s, 'r2', R2_CTRL, w=13, k0=0, k1=.5)
    s.rect(396, 657, 10, 14, 'SLT', key=.1)
    s.lawn(412, 646, 560, 10, 'MAL', cell=12)
    s.lawn(1052, 646, 104, 10, 'MAL', cell=12)
    s.lawn(412, 672, 744, 10, 'MAL', cell=12)
    for i in range(9):
        s.rect(430 + i * 62, 685, 50, 4.5, 'LAP', key=.4 + .04 * i)
        s.line([(434 + i * 62, 687.2), (476 + i * 62, 687.2)], .6, 'PRL', key=.9)
    for i in range(21):
        x = 560 + i * 26.
        if 955 < x < 1066:
            continue
        s.tree(x, 649, 12, 'round', 'MAL' if i % 3 else 'JAD')
    for i in range(27):
        x = 424 + i * 27.
        s.tree(x, 684, 11, 'round', 'MAL', dot='AMB' if i % 7 == 3 else None)


def indiagate(s):
    s.group('indiagate', 26, 122)
    cx, B = 1010., 648.
    # hexagon plaza
    s.blocks(cx - 72, B - 2, 144, 8, 1, 12, 'ROS', k0=0, k1=.15)
    # canopy behind
    kx = 1122.
    s.rect(kx - 16, B - 6, 32, 6, 'BUF', key=.3)
    for dx in (-12, -4.5, 4.5, 12):
        s.rect(kx + dx - 1.4, B - 46, 2.8, 40, 'BUF', key=.4)
    s.rect(kx - 17, B - 50, 34, 5, 'BUF', key=.6)
    s.dome(kx, B - 50, 15, 16, HEMI, gores=5, bands=2, m='BUF', k0=.7, k1=.85, finial=6)
    s.add([(kx - 2.6, B - 6), (kx + 2.6, B - 6), (kx + 2, B - 26), (kx - 2, B - 26)], 'SLT', key=.8, style='grow', anchor=(kx, B - 6))
    s.ell(kx, B - 29, 2.6, 2.8, 'SLT', n=8, key=.82, style='grow')
    # the Gate
    s.blocks(cx - 66, B - 12, 132, 12, 2, 12, 'BUF', k0=.05, k1=.2)
    s.blocks(cx - 60, B - 128, 120, 116, 10, 9, 'BUF', k0=.15, k1=.62, m2='CRM', p2=.15)
    s.arch(cx, B - 6, 46, 108, 'ONX', kind='rd', key=.7, frame=1.2)
    for sg in (-1, 1):
        px_ = cx + sg * 41.5
        s.arch(px_, B - 12, 13, 34, 'ONX', kind='rd', key=.72, frame=.8)
        s.line(ell_pts(px_, B - 62, 5.5, 5.5, 14), 1., 'GLD', key=.9, closed=True)
        s.ell(px_, B - 62, 3.2, 3.2, 'RED', n=10, key=.86, style='grow')
        s.rect(px_ - 9, B - 96, 18, 2, 'RED', key=.8)
    s.blocks(cx - 67, B - 136, 134, 8, 1, 10, 'BUF', k0=.6, k1=.68)
    s.line([(cx - 67, B - 128), (cx + 67, B - 128)], 1., 'GLD', key=.9)
    s.blocks(cx - 54, B - 158, 108, 22, 2, 7, 'BUF', k0=.66, k1=.76)
    s.line([(cx - 46, B - 147), (cx + 46, B - 147)], 1.2, 'GLD', key=.92)
    s.blocks(cx - 40, B - 170, 80, 12, 1, 5, 'BUF', k0=.74, k1=.82)
    s.dome(cx, B - 170, 25, 9, SAUCER, gores=6, bands=1, m='BUF', k0=.82, k1=.9)
    # fountains
    for sg in (-1, 1):
        fx = cx + sg * 104
        s.ell(fx, B + 2, 15, 4.5, 'LAP', n=18, key=.5)
        s.line(ell_pts(fx, B + 2, 15, 4.5, 22), .8, 'GLD', key=.9, closed=True)
        ANCH.setdefault('fountains', []).append((fx, B + 1))
    # people: balloon seller, family, ice-cream cart
    s.person(cx - 146, B + 8, 15, 'TUR', hat='AMB', face=1, arm=(.25, -.55), key=.9)
    ANCH['balloons'] = (cx - 146 + 15 * 1.25 * .33, B + 8 - 15 * 1.25 * 1.1)
    s.person(cx - 30, B + 8, 14, 'PNK', head='AMB', face=1, key=.9)
    s.person(cx - 20, B + 8, 10, 'AMB', face=-1, key=.9)
    s.person(cx + 34, B + 8, 14, 'WHT', hat='LAP', face=-1, key=.9)
    s.person(cx + 150, B + 8, 14, 'AME', head='PNK', face=-1, key=.9)
    ix = cx + 62.
    s.rect(ix - 8, B + 0, 16, 7, 'WHT', key=.8)
    s.rect(ix - 8, B + 0, 16, 2.4, 'COR', key=.82)
    s.add(arch_pts(ix, B, 20, 9, 'rd'), 'LAP', key=.84)
    for dx in (-5, 5):
        s.ell(ix + dx, B + 8, 2.2, 2.2, 'SLT', n=8, key=.85, style='grow')
    s.person(ix + 14, B + 8, 14, 'CRM', hat=None, face=-1, key=.9)


def rashtrapati(s):
    s.group('rb', 14, 124, ang=LEFT)
    cx, B = 250., 622.
    s.blocks(92, B - 18, 316, 18, 2, 22, 'RED', k0=0, k1=.2, m2='RDK', p2=.1)
    s.blocks(108, B - 66, 284, 48, 4, 20, 'BUF', k0=.15, k1=.5)
    s.rect(146, B - 58, 208, 36, 'ONX', key=.5)
    for i in range(20):
        s.rect(149 + i * 10.6, B - 58, 3.6, 36, 'BUF', key=.55 + .012 * i, var=i % 3)
    s.line([(104, B - 66), (396, B - 66)], 2.2, 'RED', key=.7)
    for sg in (-1, 1):       # end pavilions
        s.blocks(cx + sg * 127 - 17, B - 76, 34, 58, 5, 3, 'BUF', k0=.2, k1=.55)
        s.arch(cx + sg * 127, B - 20, 12, 30, 'ONX', kind='rd', key=.6, frame=.8)
        s.dome(cx + sg * 127, B - 76, 9, 5, SAUCER, gores=3, bands=1, m='RED', k0=.7, k1=.8)
    s.blocks(cx - 82, B - 80, 164, 14, 1, 11, 'BUF', k0=.5, k1=.6)
    for dx in (-64, -40, 40, 64):
        s.chhatri(cx + dx, B - 80, 12, 14, 'RED', 'BUF', SAUCER, key=.78, cols=2)
    # drum + dome
    s.blocks(cx - 32, B - 106, 64, 26, 2, 6, 'BUF', k0=.55, k1=.68)
    for i in range(9):
        s.rect(cx - 28 + i * 6.6, B - 102, 2.4, 18, 'RED', key=.7)
    s.line([(cx - 36, B - 106), (cx + 36, B - 106)], 2., 'RED', key=.8)
    s.dome(cx, B - 106, 34, 40, HEMI, gores=9, bands=4, m='SLT', k0=.66, k1=.92, finial=8)
    s.line([(cx - 33, B - 110), (cx + 33, B - 110)], 1.2, 'GLD', key=.95)
    # Jaipur Column
    jx = 420.
    s.rect(jx - 5, B - 8, 10, 8, 'RED', key=.3)
    s.add([(jx - 2.4, B - 8), (jx + 2.4, B - 8), (jx + 1.5, B - 78), (jx - 1.5, B - 78)], 'BUF', key=.6)
    s.petal(jx, B - 78, UP, 7, 6, 'GLD', key=.9, style='grow')
    a = np.linspace(0, 2 * PI, 13)[:-1]
    r = np.where(np.arange(12) % 2 == 0, 5.0, 2.2)
    s.add(np.stack([jx + r * np.cos(a - PI / 2), B - 88 + r * np.sin(a - PI / 2)], 1), 'PRL', key=.94, style='grow')
    # Amrit Udyan flower beds
    s.lawn(96, 390, 166, 58, 'MAL', cell=14)
    for r_ in range(4):
        for c_ in range(13):
            x, y = 104 + c_ * 12.5, 398 + r_ * 13
            if (c_ in (6,)):
                continue
            s.ell(x, y, 3.4, 3.4, ['COR', 'AMB', 'PNK', 'AME', 'CAR', 'WHT'][(r_ * 2 + c_) % 6], n=7, key=.5 + .4 * s.rng.random(), style='grow')
    s.rect(100, 452, 158, 3.5, 'MAL', key=.4)
    s.ell(179, 418, 7, 7, 'LAP', n=14, key=.5)
    s.line(ell_pts(179, 418, 7, 7, 16), .8, 'GLD', key=.9, closed=True)
    for x in (112, 132, 152, 206, 226, 246):
        s.tree(x, 480, 14, 'cyp', 'MAL')
    for x in (290, 318, 346, 374):
        s.tree(x, 470 + (x % 3) * 4, 16, 'round', 'MAL', dot='COR' if x == 318 else None)
    s.tree(100, 596, 15, 'round')
    ANCH['monkeys'] = [(140, B - 66), (352, B - 66), (cx + 70, B - 80)]


def cp(s):
    s.group('cp', 8, 122)
    cx, cy = 640., 486.
    ANCH['cp'] = (cx, cy)
    for r0, r1 in ((35, 46), (70, 80), (102, 112)):
        s.disc(cx, cy, r0, r1, 'SLT', 28, 1, key=None)
    for i in range(8):
        a = i * PI / 4 + PI / 8
        ca, sa = math.cos(a), math.sin(a)
        s.add([(cx + 46 * ca - 4.5 * sa, cy + 46 * sa + 4.5 * ca), (cx + 104 * ca - 4.5 * sa, cy + 104 * sa + 4.5 * ca),
               (cx + 104 * ca + 4.5 * sa, cy + 104 * sa - 4.5 * ca), (cx + 46 * ca + 4.5 * sa, cy + 46 * sa - 4.5 * ca)], 'SLT', key=.3)
    s.disc(cx, cy, 8, 35, 'MAL', 12, 2, jit=.6)
    s.ell(cx, cy, 8, 8, 'LAP', n=16, key=.5)
    s.line(ell_pts(cx, cy, 8, 8, 18), .9, 'GLD', key=.9, closed=True)
    for i in range(6):
        a = i * PI / 3
        s.line([(cx + 9 * math.cos(a), cy + 9 * math.sin(a)), (cx + 34 * math.cos(a), cy + 34 * math.sin(a))], 1.6, 'BUF', key=.7)
    for i in range(8):
        g = .085
        a0, a1 = i * PI / 4 + PI / 8 + g, (i + 1) * PI / 4 + PI / 8 - g
        for (r0, r1, ns) in ((46.5, 69.5, 4), (80.5, 101.5, 6)):
            gg = g * 46 / r0
            s.disc(cx, cy, r0, r1, 'WHT', ns, 2, a0=i * PI / 4 + PI / 8 + gg, a1=(i + 1) * PI / 4 + PI / 8 - gg,
                   keyfn=None, key=None)
            s.line(ell_pts(cx, cy, r0 + 2.6, r0 + 2.6, 12, i * PI / 4 + PI / 8 + gg + .02, (i + 1) * PI / 4 + PI / 8 - gg - .02), 2.2, 'ONX', key=.82)
            nc = int((r0 + 2.6) * (PI / 4 - 2 * gg) / 4.2)
            for j in range(nc + 1):
                a = i * PI / 4 + PI / 8 + gg + .02 + j * (PI / 4 - 2 * gg - .04) / nc
                s.line([(cx + (r0 + 1.2) * math.cos(a), cy + (r0 + 1.2) * math.sin(a)), (cx + (r0 + 4.) * math.cos(a), cy + (r0 + 4.) * math.sin(a))],
                       1.0, 'WHT', key=.9)
            s.line(ell_pts(cx, cy, r1 - 3, r1 - 3, 12, i * PI / 4 + PI / 8 + gg + .03, (i + 1) * PI / 4 + PI / 8 - gg - .03), .7, 'GLD', key=.92)
    for i in range(10):
        a = i * 2 * PI / 10 + .3
        s.tree(cx + 25 * math.cos(a), cy + 25 * math.sin(a) + 6, 9, 'round', 'JAD' if i % 2 else 'MAL')
    s.line([(cx + 14, cy + 2), (cx + 14, cy - 40)], 1.1, 'GLD', key=.9)
    ANCH['flag_cp'] = (cx + 14, cy - 39)


def bangla(s):
    s.group('bangla', 36, 104, ang=LEFT)
    cx, B = 470., 628.
    s.blocks(cx - 40, B - 46, 80, 46, 4, 7, 'WHT', k0=.05, k1=.5)
    for i in range(5):
        s.arch(cx - 28 + i * 14, B, 8, 22, 'ONX', key=.6, frame=.7)
    for i in range(5):
        s.arch(cx - 28 + i * 14, B - 28, 6, 11, 'LAP', key=.62, frame=.6)
    s.line([(cx - 42, B - 46), (cx + 42, B - 46)], 1.6, 'GLD', key=.8)
    s.rect(cx - 14, B - 58, 28, 12, 'WHT', key=.55)
    s.dome(cx, B - 58, 16, 27, ONION, gores=7, bands=3, m='GLD', k0=.7, k1=.92, finial=8)
    for sg in (-1, 1):
        s.chhatri(cx + sg * 32, B - 46, 13, 18, 'GLD', 'WHT', ONION, key=.8, cols=2)
    # sarovar with koi
    s.blocks(cx - 46, B + 4, 92, 13, 2, 9, 'LAP', k0=.1, k1=.4)
    s.line([(cx - 46, B + 4), (cx + 46, B + 4), (cx + 46, B + 17), (cx - 46, B + 17)], 1., 'WHT', key=.9, closed=True)
    ANCH['sarovar'] = (cx, B + 10.5)
    # Nishan Sahib
    nx = cx + 52.
    s.line([(nx, B + 2), (nx, B - 96)], 1.8, 'CAR', key=.85)
    s.ell(nx, B - 98, 2.2, 2.2, 'GLD', n=8, key=.95, style='grow')
    ANCH['nishan'] = (nx, B - 92)
    s.person(cx - 54, B + 2, 14, 'LAP', hat='CAR', face=1, key=.9)
    s.person(cx + 38, B + 2, 13, 'WHT', head='AMB', face=-1, key=.9)


def middle_misc(s):
    # Agrasen ki Baoli
    s.group('baoli', 40, 100, ang=UP)
    x, y, w, h = 792., 436., 50., 116.
    s.blocks(x, y, w, h, 12, 3, 'RDK', k0=0, k1=.4, m2='BRN', p2=.3)
    n = 11
    for i in range(n):
        yy = y + 8 + i * (h - 14) / n
        s.rect(x + 9, yy, w - 18, (h - 14) / n, 'BUF', key=.4 + .04 * i, shade=.42 + .58 * i / (n - 1))
    for i in range(6):
        for sx in (x + 4.5, x + w - 4.5):
            s.arch(sx, y + 22 + i * 17, 5, 11, 'ONX', key=.7)
    s.arch(x + w / 2, y + 22, 18, 16, 'ONX', key=.72, frame=.8)
    # Jantar Mantar
    s.group('jantar', 50, 90, ang=DOWN)
    jx, jy = 808., 638.
    for r in (30, 22):
        s.line(ell_pts(jx, jy - 30, r + 6, r, 16, PI * .5, PI * .97), 2.6, 'ROS', key=.6)
        s.line(ell_pts(jx, jy - 30, r + 6, r, 16, PI * .03, PI * .5), 2.6, 'ROS', key=.6)
    s.add([(jx - 24, jy), (jx + 20, jy), (jx + 20, jy - 46)], 'RED', key=.3)
    for i in range(6):
        s.line([(jx - 17 + i * 6.4, jy - 1), (jx - 17 + i * 6.4, jy - 5 - i * 6.8)], .8, 'RDK', key=.8)
    s.tree(770, 420, 13, 'round')
    s.tree(868, 440, 14, 'round', 'JAD')
    # cricket ground (Kotla)
    s.group('kotla', 46, 96, ang=RIGHT)
    cx, cy = 1396., 452.

    def fn(u, v):
        a = u * 2 * PI
        r = v
        return cx + 52 * r * np.cos(a), cy + 36 * r * np.sin(a)
    s.mesh(fn, 16, 3, 'MAL', sub=3, jit=.5, mfn=lambda i, j: 'JAD' if (i + j) % 2 else 'MAL')
    s.rect(cx - 3, cy - 10, 6, 20, 'BUF', key=.7)
    s.line(ell_pts(cx, cy, 56, 40, 40), 2.4, 'GRY', key=.8, closed=True)
    for a in (.7, 2.44, 3.84, 5.58):
        fx, fy = cx + 62 * math.cos(a), cy + 44 * math.sin(a)
        s.line([(fx, fy + 4), (fx, fy - 20)], 1., 'GRY', key=.85)
        s.rect(fx - 4, fy - 25, 8, 5, 'AMB', key=.95, style='grow')
    # Purana Qila gate + boating lake
    s.group('purana', 38, 104, ang=RIGHT)
    px_, B = 1300., 618.
    s.blocks(px_ - 80, B - 40, 160, 40, 4, 12, 'RED', k0=0, k1=.4, m2='RDK', p2=.25)
    for i in range(20):
        s.rect(px_ - 80 + i * 8 + 1, B - 45, 6, 5, 'RED', key=.45)
    s.blocks(px_ - 20, B - 64, 40, 64, 6, 3, 'RED', k0=.1, k1=.5)
    s.arch(px_, B, 18, 40, 'ONX', key=.6, frame=1.)
    s.line([(px_ - 20, B - 52), (px_ + 20, B - 52)], 1.2, 'WHT', key=.8)
    for sg in (-1, 1):
        s.blocks(px_ + sg * 30 - 10, B - 58, 20, 58, 5, 2, 'RED', k0=.1, k1=.5, m2='RDK', p2=.3)
        s.chhatri(px_ + sg * 30, B - 58, 14, 17, 'WHT', 'RED', HEMI, key=.8, cols=2)
        s.rect(px_ + sg * 30 - 3.5, B - 44, 7, 2.5, 'TUR', key=.85)
    s.ell(px_ + 130, B - 6, 44, 13, 'LAP', n=26, key=.5)
    s.line(ell_pts(px_ + 130, B - 6, 44, 13, 30), .9, 'GLD', key=.9, closed=True)
    ANCH['boat_lake'] = (px_ + 130, B - 6)
    for x, y, k in ((1250, 440, 'round'), (1296, 500, 'cyp'), (1318, 506, 'cyp'), (1240, 520, 'round'), (1160, 430, 'round'),
                    (1486, 640, 'palm')):
        s.tree(x, y, 15, k, 'MAL', dot='CAR' if x == 1240 else ('AMB' if x == 1160 else None))


# ============================================================================ South Delhi
def qutub(s):
    s.group('qutub', 6, 138, ang=LEFT + .5)
    cx, B = 190., 986.
    s.lawn(92, B, 250, 10, 'MAL', cell=12)
    hs = [96, 60, 48, 36, 34]
    y = B
    H = sum(hs)

    def hw(yy):
        return 23 - 15.5 * (B - yy) / H
    k = 0.
    for si, h in enumerate(hs):
        y0, y1 = y - h, y
        ng = 7
        rows = max(2, int(h / 12))
        for r in range(rows):
            ya, yb = y1 - (r + 1) * (h - 5) / rows, y1 - r * (h - 5) / rows
            for g in range(ng):
                ta, tb = math.sin((g / ng - .5) * PI), math.sin(((g + 1) / ng - .5) * PI)
                if si < 3:
                    m = 'RED' if g % 2 == 0 else 'RDK'
                elif si == 3:
                    m = 'WHT' if r != rows // 2 else 'RED'
                else:
                    m = 'WHT' if r % 2 == 0 else 'RED'
                s.add([(cx + ta * hw(yb), yb), (cx + tb * hw(yb), yb), (cx + tb * hw(ya), ya), (cx + ta * hw(ya), ya)], m,
                      key=(k + (r + s.rng.random()) / rows * h / H) * .82)
        # balcony
        bw = hw(y0) + 5.5
        s.add([(cx - bw + 2.5, y0 + 5), (cx + bw - 2.5, y0 + 5), (cx + bw, y0 + 1), (cx - bw, y0 + 1)], 'BUF', key=(k + h / H) * .82)
        s.rect(cx - bw, y0 - 1, 2 * bw, 2.2, 'RDK' if si < 3 else 'WHT', key=(k + h / H) * .82 + .01)
        if si < 3:
            for q in (.3, .62):
                yy = y1 - h * q
                s.line([(cx - hw(yy), yy), (cx + hw(yy), yy)], 1.8, 'BUF', key=.84 + si * .02)
                t = np.linspace(-1, 1, 15)
                s.line(np.stack([cx + t * hw(yy) * .92, yy + .9 * np.sign(np.sin(t * 20))], 1), .5, 'RDK', key=.9)
        k += h / H
        y = y0
    s.rect(cx - 4, y - 7, 8, 7, 'WHT', key=.85)
    s.dome(cx, y - 7, 4.5, 5, HEMI, gores=3, bands=1, m='WHT', k0=.88, k1=.92, finial=5)
    ANCH['qutub_top'] = (cx, y - 14)
    # Quwwat-ul-Islam screen (ruined) + Iron Pillar
    ax = 286.
    rows, cols = 9, 8
    for r in range(rows):
        for c in range(cols):
            if r >= 6 and c >= 5 + (8 - r):      # broken corner
                continue
            if r == 8 and c < 1:
                continue
            x0 = ax - 44 + c * 11 + (5.5 if r % 2 else 0)
            s.rect(x0, B - (r + 1) * 11, 11, 11, 'RED' if (r + c) % 4 else 'RDK', key=.1 + .06 * r + .02 * s.rng.random())
    s.arch(ax - 4, B, 40, 84, 'ONX', kind='og', key=.6, frame=1.2)
    s.arch(ax + 34, B, 13, 38, 'ONX', kind='og', key=.62, frame=.8)
    s.line(arch_pts(ax - 4, B, 48, 91, 'og')[1:-1], .8, 'BUF', key=.9)
    ix = ax - 4.
    s.add([(ix - 2.2, B), (ix + 2.2, B), (ix + 1.5, B - 44), (ix - 1.5, B - 44)], 'SLT', key=.8, var=2)
    s.rect(ix - 3, B - 48, 6, 4, 'SLT', key=.86)
    s.ell(ix, B - 50, 2.2, 1.6, 'GRY', n=8, key=.9, style='grow')
    # Alai Darwaza
    dx = 122.
    s.blocks(dx - 24, B - 38, 48, 38, 4, 4, 'RED', k0=.1, k1=.4)
    s.line([(dx - 24, B - 30), (dx + 24, B - 30)], 1.4, 'WHT', key=.8)
    s.line([(dx - 24, B - 12), (dx + 24, B - 12)], 1.0, 'WHT', key=.8)
    s.arch(dx, B, 16, 28, 'ONX', key=.6, frame=1.)
    for sg in (-1, 1):
        s.arch(dx + sg * 16, B - 12, 6, 12, 'WHT', key=.65)
    s.dome(dx, B - 38, 18, 12, SAUCER, gores=5, bands=2, m='GRY', k0=.6, k1=.8, finial=3)
    for x, k_ in ((104, 'round'), (240, 'round'), (340, 'round'), (352, 'cyp'), (150, 'cyp')):
        s.tree(x, B + 2, 16, k_)
    s.person(232, B + 6, 14, 'AMB', head='PNK', face=1, arm=(.3, -.45), key=.9)
    s.person(246, B + 6, 14, 'WHT', hat='TUR', face=-1, key=.9)
    s.sprig(110, 900, 26, 'COR', UP + .3)
    s.sprig(120, 820, 22, 'AMB', UP - .2)
    s.sprig(290, 850, 24, 'PNK', UP + .2)


def hauz(s):
    s.group('hauz', 32, 108, ang=DOWN)
    cx, cy = 492., 952.

    def fn(u, v):
        a = u * 2 * PI
        return cx + 104 * v * np.cos(a) * (1 + .08 * np.cos(3 * a)), cy + 36 * v * np.sin(a)
    its = s.mesh(fn, 18, 3, 'LAP', sub=3, jit=.5)
    for it in its:
        c = it['pts'].mean(0)
        it['tag'] = ('pond', (c[0], c[1]))
    u = np.linspace(0, 1, 60)
    x, y = fn(u, np.ones_like(u))
    s.line(np.stack([x, y], 1), 1., 'GLD', key=.9, closed=True)
    # madrasa ruins
    B = 916.
    s.blocks(400, B - 40, 170, 40, 4, 14, 'GRY', k0=.05, k1=.45, m2='BUF', p2=.25)
    for i in range(10):
        s.arch(411 + i * 16.5, B, 9, 15, 'ONX', key=.6)
        s.arch(411 + i * 16.5, B - 20, 8, 14, 'ONX', key=.62)
    s.blocks(556, B - 62, 44, 62, 6, 3, 'GRY', k0=.1, k1=.5, m2='BUF', p2=.25)
    s.arch(578, B, 16, 34, 'ONX', key=.6, frame=.8)
    s.dome(578, B - 62, 21, 20, HEMI, gores=7, bands=3, m='GRY', k0=.6, k1=.85, finial=5)
    for dx in (416, 486):
        s.dome(dx, B - 40, 11, 10, HEMI, gores=5, bands=2, m='GRY', k0=.6, k1=.8)
    # the village: cafes + fairy lights
    for i, (m, h) in enumerate((('CRM', 30), ('TUR', 40), ('ROS', 34))):
        x0 = 610 + i * 20
        s.blocks(x0, 902 - h, 19, h, 3, 2, m, k0=.2, k1=.5)
        s.rect(x0 + 4, 902 - 12, 11, 12, 'ONX', key=.6)
        s.rect(x0 + 5, 902 - h + 6, 9, 8, 'AMB', key=.8)
    ANCH['lights'] = [(608, 868), (672, 874)]
    # deer park
    ANCH['deer'] = [(384, 968), (402, 986)]
    for x, y, k_ in ((372, 936, 'round'), (390, 912, 'round'), (356, 990, 'cyp'), (628, 960, 'round'), (648, 990, 'round'), (604, 996, 'bush'),
                     (440, 876, 'round'), (520, 874, 'round')):
        s.tree(x, y, 15, k_, 'MAL' if (x % 3) else 'JAD')
    s.sprig(420, 800, 24, 'AME', UP + .1)
    s.sprig(560, 810, 26, 'COR', UP - .3)


def lodhi(s):
    s.group('lodhi', 22, 118, ang=DOWN)
    B = 944.
    s.lawn(690, B, 256, 22, 'MAL', cell=13, mfn=lambda i, j: 'JAD' if (i * 3 + j) % 5 == 0 else 'MAL')
    # Bara Gumbad
    cx = 800.
    s.blocks(cx - 42, B - 62, 84, 62, 5, 6, 'GRY', k0=.05, k1=.5, m2='BUF', p2=.3)
    s.arch(cx, B, 34, 54, 'RED', key=.58)
    s.arch(cx, B, 26, 46, 'ONX', key=.62, frame=1.)
    for sg in (-1, 1):
        for yy in (B - 4, B - 34):
            s.arch(cx + sg * 30, yy, 9, 22, 'ONX', key=.6, frame=.6)
    s.rect(cx - 44, B - 66, 88, 4, 'BUF', key=.6)
    s.blocks(cx - 30, B - 76, 60, 10, 1, 6, 'GRY', k0=.55, k1=.62)
    s.dome(cx, B - 76, 31, 33, HEMI, gores=9, bands=4, m='GRY', k0=.62, k1=.9, finial=7)
    # Sheesh Gumbad with its turquoise tile band
    sx = 902.
    s.blocks(sx - 27, B - 40, 54, 40, 4, 4, 'GRY', k0=.1, k1=.5, m2='BUF', p2=.3)
    for j in range(9):
        s.rect(sx - 27 + j * 6, B - 30, 6, 4.5, 'TUR' if j % 2 == 0 else 'LAP', key=.7 + .01 * j)
    s.arch(sx, B, 14, 26, 'ONX', key=.6, frame=.8)
    s.dome(sx, B - 40, 21, 20, HEMI, gores=7, bands=3, m='GRY', k0=.6, k1=.85, finial=5)
    # Athpula bridge over the lake strip
    s.blocks(690, B + 26, 150, 9, 1, 10, 'LAP', k0=.2, k1=.45)
    s.rect(716, B + 20, 82, 6, 'BUF', key=.6)
    for i in range(7):
        s.arch(724 + i * 11, B + 34, 8, 9, 'ONX', kind='rd', key=.7)
    ANCH['lodhi'] = (800, B)
    trees = [(700, B + 2, 20, 'round', None), (724, B - 6, 17, 'round', 'AMB'), (742, B + 3, 14, 'palm', None), (862, B + 2, 15, 'round', None),
             (950, B + 4, 17, 'round', 'COR'), (688, B - 40, 18, 'round', None), (716, B - 60, 15, 'cyp', None),
             (742, B - 84, 16, 'round', 'PNK'), (858, B - 96, 17, 'round', None), (892, B - 78, 14, 'palm', None), (940, B - 70, 16, 'round', None),
             (784, B - 128, 15, 'round', None), (826, B - 138, 13, 'cyp', None), (676, B - 106, 16, 'round', None),
             ]
    for x, y, sz, k_, d in trees:
        s.tree(x, y, sz, k_, 'MAL' if int(x) % 3 else 'JAD', dot=d)
    # joggers / walkers / yoga
    s.person(760, B + 16, 13, 'PNK', head=None, hat=None, face=1, arm=(.3, .1), key=.9)
    s.person(852, B + 17, 13, 'TUR', head='AMB', face=1, key=.9)
    s.person(930, B + 16, 13, 'WHT', hat='GRY', face=-1, key=.9)
    ANCH['peacock'] = (884, B + 18)


def humayun(s):
    s.group('humayun', 12, 134, ang=DOWN + .3)
    cx, B = 1164., 898.
    # charbagh (plan view, miniature-style)
    gx0, gy0, gw, gh = 1040., 906., 248., 86.
    for i in range(4):
        for j in range(2):
            s.lawn(gx0 + i * gw / 4 + 3.5, gy0 + j * gh / 2 + 3.5, gw / 4 - 7, gh / 2 - 7, 'MAL', cell=12,
                   mfn=lambda a, b: 'JAD' if (a + b) % 4 == 0 else 'MAL')
    for i in range(5):
        s.rect(gx0 + i * gw / 4 - 3, gy0, 6, gh, 'ROS', key=.2 + .05 * i)
        s.rect(gx0 + i * gw / 4 - 1, gy0 + 2, 2, gh - 4, 'LAP', key=.6 + .03 * i)
    for j in range(3):
        s.rect(gx0, gy0 + j * gh / 2 - 3, gw, 6, 'ROS', key=.25 + .05 * j)
        s.rect(gx0 + 2, gy0 + j * gh / 2 - 1, gw - 4, 2, 'LAP', key=.65 + .03 * j)
    s.add(ell_pts(cx, gy0 + gh / 2, 8, 8, 4, PI / 4, PI / 4 + 2 * PI), 'LAP', key=.7)
    s.line(ell_pts(cx, gy0 + gh / 2, 8, 8, 4, PI / 4, PI / 4 + 2 * PI), .8, 'GLD', key=.9, closed=True)
    # plinth with arcade
    s.blocks(cx - 124, B - 24, 248, 24, 2, 20, 'RED', k0=.0, k1=.2, m2='RDK', p2=.15)
    for i in range(17):
        s.arch(cx - 112 + i * 14, B - 2, 8.5, 16, 'ONX', key=.4, frame=.6, fm='WHT')
    s.line([(cx - 126, B - 24), (cx + 126, B - 24)], 1.6, 'WHT', key=.6)
    # dome (behind)
    s.blocks(cx - 38, B - 128, 76, 22, 2, 8, 'WHT', k0=.5, k1=.6, m2='RED', p2=.3)
    s.dome(cx, B - 126, 46, 62, BULB, gores=11, bands=5, m='WHT', k0=.6, k1=.93, finial=14)
    # body
    s.blocks(cx - 88, B - 100, 176, 76, 6, 14, 'RED', k0=.18, k1=.55)
    for sg in (-1, 1):
        bx = cx + sg * 58
        s.rect(bx - 20, B - 96, 40, 70, 'WHT', key=.56, var=1)
        s.rect(bx - 18, B - 94, 36, 66, 'RED', key=.58)
        s.arch(bx, B - 26, 22, 30, 'ONX', key=.64, frame=.9, fm='WHT')
        s.arch(bx, B - 60, 22, 30, 'ONX', key=.64, frame=.9, fm='WHT')
        s.rect(bx - 6, B - 52, 12, 10, 'WHT', key=.7)
        # corner chamfer
        s.add([(cx + sg * 88, B - 100), (cx + sg * 100, B - 92), (cx + sg * 100, B - 24), (cx + sg * 88, B - 24)], 'RDK', key=.4)
        s.arch(cx + sg * 94, B - 30, 7, 24, 'ONX', key=.6)
        s.arch(cx + sg * 94, B - 62, 7, 22, 'ONX', key=.6)
    # central iwan
    s.blocks(cx - 32, B - 112, 64, 88, 7, 4, 'RED', k0=.25, k1=.6)
    s.arch(cx, B - 24, 52, 82, 'WHT', key=.62)
    s.arch(cx, B - 24, 44, 75, 'RED', key=.64)
    s.arch(cx, B - 24, 34, 64, 'ONX', key=.7, frame=1.1, fm='WHT')
    s.arch(cx, B - 24, 14, 26, 'RDK', key=.74, frame=.8)
    a = np.linspace(0, 2 * PI, 13)[:-1]
    for sg in (-1, 1):     # six-pointed stars in the spandrels
        r = np.where(np.arange(12) % 2 == 0, 4.2, 2.1)
        s.add(np.stack([cx + sg * 20 + r * np.cos(a), B - 98 + r * np.sin(a)], 1), 'WHT', key=.9, style='grow')
    # chhatris with turquoise tile
    for sg in (-1, 1):
        s.chhatri(cx + sg * 62, B - 100, 26, 32, 'TUR', 'RED', HEMI, key=.8, cols=3)
        s.chhatri(cx + sg * 40, B - 112, 13, 17, 'WHT', 'RED', HEMI, key=.84, cols=2)
        s.line([(cx + sg * 32, B - 112), (cx + sg * 32, B - 126)], 1.3, 'WHT', key=.86)
        s.line([(cx + sg * 88, B - 100), (cx + sg * 88, B - 112)], 1.3, 'WHT', key=.86)
    for x, y, k_ in ((1030, 902, 'palm'), (1298, 902, 'palm'), (1024, 990, 'round'), (1304, 990, 'round'), (1010, 940, 'cyp'), (1318, 946, 'cyp')):
        s.tree(x, y, 18, k_)
    s.person(1096, 1000, 13, 'AMB', head='COR', face=1, key=.9)
    s.person(1232, 1000, 13, 'WHT', hat='PNK', face=-1, key=.9)
    ANCH['humayun'] = (cx, B)
    s.sprig(1030, 800, 26, 'COR', UP - .25)
    s.sprig(1310, 790, 26, 'AMB', UP + .25)
    s.sprig(1056, 742, 20, 'PNK', UP + .1)
    s.sprig(1290, 730, 20, 'AME', UP - .1)


def lotus(s):
    s.group('lotus', 40, 108, ang=DOWN - .4)
    cx, B = 1410., 984.
    # pools
    for i in range(5):
        s.ell(cx + (i - 2) * 44, B + 13, 18, 5, 'TUR', n=16, key=.3 + .03 * i)
    s.blocks(cx - 104, B, 208, 5, 1, 16, 'ROS', k0=.0, k1=.2)

    def pet(x, y, ang, ln, wd, k, bend=0., nseg=4):
        """marble petal split into panels along its length; bend curves the spine."""
        t = np.linspace(0, 1, 13)
        hw = wd / 2 * np.sin(PI * (.12 + .88 * t) ** .8) ** .85
        hw[-1] = 0
        sp_a = ang + bend * t
        sx = x + np.concatenate([[0], np.cumsum(np.cos(sp_a[:-1]) * ln / 12)])
        sy = y + np.concatenate([[0], np.cumsum(np.sin(sp_a[:-1]) * ln / 12)])
        nx_, ny_ = -np.sin(sp_a), np.cos(sp_a)
        Lx, Ly, Rx, Ry = sx + nx_ * hw, sy + ny_ * hw, sx - nx_ * hw, sy - ny_ * hw
        for q in range(nseg):
            a_, b_ = q * 12 // nseg, (q + 1) * 12 // nseg + 1
            P = np.concatenate([np.stack([Lx[a_:b_], Ly[a_:b_]], 1), np.stack([Rx[a_:b_], Ry[a_:b_]], 1)[::-1]], 0)
            s.add(P, 'PRL', key=k + .05 * q, var=(q + int(x)) % 3, style='fly')
        s.line(np.stack([sx, sy], 1)[1:-1], .6, 'GLD', key=min(1, k + .3))
    # outer leaning petals (back)
    for sg in (-1, 1):
        pet(cx + sg * 52, B, UP + sg * .62, 78, 44, .30, bend=-sg * .5)
        pet(cx + sg * 26, B - 2, UP + sg * .34, 92, 42, .36, bend=-sg * .3)
    # inner bud
    for sg in (-1, 1):
        pet(cx + sg * 15, B - 4, UP + sg * .16, 112, 36, .46, bend=-sg * .28)
    pet(cx, B - 2, UP, 120, 40, .54, nseg=5)
    # entrance petals (front, low)
    for i in range(5):
        x = cx - 80 + i * 40
        pet(x, B, UP + (i - 2) * .12, 40, 40, .62 + .03 * i, nseg=2)
        s.arch(x, B, 9, 11, 'ONX', kind='rd', key=.8)
    ANCH['lotus'] = (cx, B)
    for x, k_ in ((1310, 'round'), (1326, 'cyp'), (1500, 'round'), (1488, 'cyp')):
        s.tree(x, B + 6, 15, k_)
    s.person(1352, B + 14, 12, 'WHT', head='TUR', face=1, key=.9)
    s.person(1462, B + 14, 12, 'COR', hat=None, head='AMB', face=-1, key=.9)
    s.sprig(1432, 800, 24, 'COR', UP + .2)
    s.sprig(1470, 880, 20, 'PNK', UP - .3)


# ============================================================================ East bank
def akshardham(s):
    s.group('aksh', 30, 112, ang=RIGHT)
    cx, B = 1752., 566.
    s.blocks(cx - 88, B + 2, 176, 8, 1, 14, 'LAP', k0=.0, k1=.2)
    s.blocks(cx - 92, B - 16, 184, 16, 2, 16, 'RED', k0=.05, k1=.25, m2='ROS', p2=.4)
    t = np.linspace(0, 1, 47)
    s.line(np.stack([cx - 90 + 180 * t, B - 8 + 2.4 * np.sign(np.sin(t * 46 * PI))], 1), .7, 'GLD', key=.9)
    s.blocks(cx - 70, B - 54, 140, 38, 3, 12, 'ROS', k0=.2, k1=.5)
    for i in range(11):
        s.arch(cx - 60 + i * 12, B - 16, 7, 26, 'ONX', key=.56, frame=.5)
    s.line([(cx - 74, B - 54), (cx + 74, B - 54)], 2., 'WHT', key=.7)
    for dx, R, h, by in ((-74, 12, 24, B - 50), (74, 12, 24, B - 50), (-44, 19, 40, B - 56), (44, 19, 40, B - 56), (0, 31, 66, B - 56)):
        s.dome(cx + dx, by, R, h, SHIK, gores=7, bands=6, m='ROS', k0=.5, k1=.92, finial=h * .16)
        for q in (.34, .62):
            s.line([(cx + dx - R * .78 * (1 - q * .72), by - h * q), (cx + dx + R * .78 * (1 - q * .72), by - h * q)], 1., 'WHT', key=.9)
    ANCH['flag_ak'] = (cx, B - 56 - 66 - 9)
    for x, k_ in ((1664, 'round'), (1840, 'round'), (1682, 'cyp'), (1826, 'cyp')):
        s.tree(x, B - 14, 15, k_)


def eastbank(s):
    s.group('east', 30, 112, ang=RIGHT)
    # Yamuna khadar fields (plan view furrows)
    rg = np.random.default_rng(9)
    for (x0, y0, w, h, ang) in ((1668, 96, 150, 54, .08), (1660, 168, 130, 56, -.05), (1690, 276, 150, 40, .04)):
        n = 7
        for i in range(n):
            ya, yb = y0 + i * h / n, y0 + (i + 1) * h / n - 1.5
            sk = ang * w
            s.add([(x0, ya), (x0 + w, ya + sk), (x0 + w, yb + sk), (x0, yb)], ['MAL', 'JAD', 'MAL', 'AMB', 'MAL', 'JAD', 'BRN'][(i + int(x0)) % 7],
                  key=.2 + .5 * rg.random())
    s.rect(1800, 180, 22, 14, 'CRM', key=.5)
    s.add([(1797, 180), (1825, 180), (1811, 170)], 'RDK', key=.6)
    for x, y in ((1650, 150), (1806, 238), (1836, 160), (1672, 250)):
        s.tree(x, y, 15, 'round')
    # apartment towers (trans-Yamuna)
    for i, (x, h, m) in enumerate(((1716, 92, 'CRM'), (1746, 118, 'GRY'), (1778, 84, 'WHT'), (1808, 104, 'ROS'))):
        B = 742.
        s.blocks(x, B - h, 24, h, int(h / 9), 2, m, k0=.1, k1=.7)
        for r in range(int(h / 13)):
            for c in range(2):
                lit = (r * 3 + c + i) % 4 == 0
                s.rect(x + 3.5 + c * 10.5, B - h + 6 + r * 13, 6.5, 7, 'AMB' if lit else 'SLT', key=.8)
        s.rect(x + 7, B - h - 5, 9, 5, 'SLT', key=.75)
    for x, y in ((1700, 748), (1836, 748), (1764, 752)):
        s.tree(x, y, 14, 'round')
    # Okhla wetland with flamingos
    cx, cy = 1770., 900.

    def fn(u, v):
        a = u * 2 * PI
        return cx + 74 * v * np.cos(a) * (1 + .12 * np.sin(2 * a + 1)), cy + 40 * v * np.sin(a)
    its = s.mesh(fn, 16, 3, 'TUR', sub=3, jit=.5, mfn=lambda i, j: 'LAP' if (i + j) % 3 == 0 else 'TUR')
    for it in its:
        c = it['pts'].mean(0)
        it['tag'] = ('pond', (c[0], c[1]))
    for i in range(9):   # reeds
        x = 1700 + i * 17 + rg.random() * 6
        y = 934 + 10 * math.sin(i * 1.3) + (0 if 2 < i < 7 else -12)
        for d in (-.25, 0, .25):
            s.petal(x, y, UP + d, 15, 2.6, 'JAD' if d else 'MAL', key=.7 + .2 * rg.random(), style='grow')
    ANCH['flamingos'] = [(1742, 902), (1762, 894), (1784, 906), (1804, 896), (1774, 918)]
    s.sprig(1716, 990, 22, 'COR', UP + .2)
    s.sprig(1830, 820, 24, 'AMB', UP - .2)
    s.sprig(1690, 640, 22, 'PNK', UP + .2)
    s.sprig(1836, 450, 22, 'AME', UP - .2)
    s.sprig(1668, 420, 20, 'COR', UP + .3)


def flora(s):
    s.group('flora', 40, 104)
    for (x, y, sz, pm, lean, kind) in ((468, 518, 96, 'COR', .15, 0), (902, 640, 124, 'PNK', -.1, 1), (1190, 636, 124, 'AMB', .14, 2),
                                       (1462, 590, 96, 'COR', -.22, 0), (106, 752, 86, 'AMB', .12, 1), (318, 754, 104, 'PNK', -.15, 0),
                                       (1002, 894, 132, 'COR', -.1, 2), (1404, 858, 112, 'PNK', .12, 1), (1728, 1000, 62, 'COR', .1, 0),
                                       (1836, 470, 60, 'AME', -.1, 2), (700, 742, 64, 'AMB', -.2, 1), (1668, 660, 70, 'AME', .2, 0)):
        s.spray(x, y, sz, pm, lean, kind)
    for x, y in ((98, 364), (140, 372), (330, 376), (900, 372), (1190, 378), (1452, 388)):
        s.tree(x, y + 14, 12, 'round', 'MAL' if int(x) % 2 else 'JAD')


def build_city():
    s = Scene()
    river(s)
    roads(s)
    eastbank(s)
    old_bridges(s)
    metro(s)
    border(s)
    kartavya(s)
    chandni(s)
    jama(s)
    redfort(s)
    rashtrapati(s)
    cp(s)
    bangla(s)
    middle_misc(s)
    indiagate(s)
    akshardham(s)
    qutub(s)
    hauz(s)
    lodhi(s)
    humayun(s)
    lotus(s)
    flora(s)
    return s


if __name__ == '__main__':
    s = build_city().finalize()
    print('pieces', s.N, 'verts', len(s.V))
