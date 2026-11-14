"""Things that grow, for THE LANTERN HOUR."""
from engine import *
from creatures import fillp, oline, mix, mul, CHAR

VERM = (0.93, 0.34, 0.07)       # the one stick of vermilion; nothing else in the film may use it
VERM_L = (1.0, 0.60, 0.16)
VERM_D = (0.58, 0.15, 0.07)
VERM_GLOW = (1.0, 0.50, 0.14)
STRAW = (0.84, 0.74, 0.50)


class View:
    """world -> sheet. k: scale, (ox, oy): world point at sheet origin"""

    def __init__(self, k=1.0, ox=0.0, oy=0.0):
        self.k, self.ox, self.oy = k, ox, oy

    def P(self, pts):
        pts = np.asarray(pts, np.float64)
        return (pts - np.array([self.ox, self.oy])) * self.k

    def pt(self, x, y):
        return (x - self.ox) * self.k, (y - self.oy) * self.k

    def inv(self, x, y):
        return x / self.k + self.ox, y / self.k + self.oy


V1 = View()


# ------------------------------------------------------------------ the lantern plant
def stalk_curve(x, y, hgt, bend, sway=0.0, n=40, face=1):
    t = np.linspace(0, 1, n)
    # curvature gathers low on the stalk when it is pressed, spreads when it only sways
    phi = math.pi / 2 - face * (0.10 + sway * t ** 1.5 + bend * 2.25 * (1 - np.exp(-t * 2.6)) / (1 - math.exp(-2.6)))
    dx = np.cos(phi); dy = np.sin(phi)
    px = x + np.concatenate([[0], np.cumsum(dx[:-1])]) * hgt / (n - 1)
    py = y - np.concatenate([[0], np.cumsum(dy[:-1])]) * hgt / (n - 1)
    return np.stack([px, py], 1), phi


LANT_T = [0.40, 0.54, 0.67, 0.79, 0.90]
LANT_S = [1.0, 0.92, 0.78, 0.62, 0.46]
LANT_RIPE = [1.0, 1.0, 0.85, 0.45, 0.1]


def lantern_shape(cx, cy, w, hgt, ang=0.0, n=14):
    """outline hanging from (cx, cy), tip down. returns polygon and three rib lines"""
    t = np.linspace(0, 1, n)
    hw = w * 0.5 * np.sin(math.pi * t ** 0.60) ** 0.85 * (1 - 0.10 * t)
    hw[0] = w * 0.10
    ys = t * hgt
    ca, sa = math.cos(ang), math.sin(ang)

    def R(px, py):
        return np.stack([cx + px * ca - py * sa, cy + px * sa + py * ca], 1)

    poly = np.vstack([R(-hw, ys), R(hw[::-1], ys[::-1])])
    ribs = [R(hw * f, ys) for f in (-0.52, 0.05, 0.60)]
    return poly, ribs, R


def draw_lantern(L, rng, cx, cy, w, ripe=1.0, lit=0.0, ang=0.0, detail=True, dim=1.0):
    hgt = w * 1.18
    poly, ribs, R = lantern_shape(cx, cy, w, hgt, ang)
    green = (0.55, 0.66, 0.25)
    body = mix(green, VERM, ripe)
    lite = mix((0.80, 0.86, 0.45), VERM_L, ripe)
    dark = mix((0.30, 0.42, 0.18), VERM_D, ripe)
    if dim < 1:
        body = mul(body, dim); lite = mul(lite, dim); dark = mul(dark, dim)
    fillp(L, poly, body, rng, ang=1.1 + ang, w=max(1.5, w * 0.10), solid=0.85, grain=0.55, edge=max(0.6, w * 0.02))
    if w > 9:
        t = np.linspace(0.08, 0.80, 8)
        hw = w * 0.5 * np.sin(math.pi * t ** 0.60) ** 0.85
        lpoly = np.vstack([R(-hw * 0.88, t * hgt), R(-hw[::-1] * 0.10, t[::-1] * hgt)])
        fillp(L, lpoly, lite, rng, ang=1.3 + ang, w=max(1.2, w * 0.07), grain=0.95, v=(0.3 + 0.3 * lit, 0.7 + 0.3 * lit), edge=max(0.8, w * 0.04))
        dpoly = np.vstack([R(hw * 0.35, t * hgt), R(hw[::-1] * 0.98, t[::-1] * hgt)])
        fillp(L, dpoly, dark, rng, ang=1.0 + ang, w=max(1.2, w * 0.07), grain=0.95, v=(0.25, 0.65 - 0.3 * lit), edge=max(0.8, w * 0.04))
        if lit > 0.05:
            hpoly = np.vstack([R(-hw[:5] * 0.75, t[:5] * hgt), R(-hw[:5][::-1] * 0.25, t[:5][::-1] * hgt)])
            fillp(L, hpoly, (1.0, 0.86, 0.50), rng, ang=1.3, w=max(1.2, w * 0.06), grain=1.0, v=(0.2 * lit, 0.8 * lit), edge=max(0.8, w * 0.04))
        if detail:
            for rb in ribs:
                oline(L, rb, dark if lit < 0.5 else VERM_D, max(1.0, w * 0.028), rng, wob=w * 0.01, v=0.7, taper=(0.6, 1.0))
            oline(L, np.vstack([poly, poly[:1]]), mul(dark, 0.7), max(1.0, w * 0.03), rng, wob=w * 0.008, v=0.65, taper=(1, 1))
    return R(np.array([0.0]), np.array([hgt * 0.55]))[0], R(np.array([0.0]), np.array([hgt]))[0]


def lantern_plant(L, rng, x, y, hgt=300.0, bend=0.0, sway=0.0, lit=0.0, taken=(), swing=0.0, face=1, k=1.0,
                  green=(0.26, 0.42, 0.22), green_l=(0.52, 0.66, 0.30), ripe_scale=1.0, lanterns=True, dim=1.0, lw=1.0):
    """returns {'lanterns': [(cx, cy_top, w, centre, tip)], 'curve': pts}"""
    cur, phi = stalk_curve(x, y, hgt, bend, sway, face=face)
    n = len(cur)
    out = {'curve': cur, 'lanterns': []}
    # leaves behind the stalk
    leaf_t = [0.22, 0.33, 0.47, 0.60, 0.73, 0.85, 0.96]
    for i, t in enumerate(leaf_t):
        j = int(t * (n - 1))
        side = 1 if i % 2 == 0 else -1
        base = cur[j]
        ln = hgt * lerp(0.26, 0.13, t) * (1 + 0.1 * math.sin(i * 2.1))
        a = phi[j] - face * 0 + side * (1.15 + 0.15 * math.sin(i)) + sway * 0.4
        # leaves droop under their own weight
        d0 = np.array([math.cos(a), -math.sin(a)])
        tip = base + d0 * ln + np.array([0, ln * 0.28])
        mid = base + d0 * ln * 0.5 + np.array([0, ln * 0.02])
        nrm = np.array([-(tip - base)[1], (tip - base)[0]]); nrm /= (np.hypot(*nrm) + 1e-9)
        wdt = ln * 0.24
        poly = np.array([base, base * 0.6 + mid * 0.4 + nrm * wdt * 0.8, mid + nrm * wdt, tip * 0.7 + mid * 0.3 + nrm * wdt * 0.55, tip,
                         tip * 0.7 + mid * 0.3 - nrm * wdt * 0.55, mid - nrm * wdt, base * 0.6 + mid * 0.4 - nrm * wdt * 0.8])
        poly = catmull(np.vstack([poly, poly[:1]]), 4)
        fillp(L, poly, mul(green, dim), rng, ang=math.atan2(tip[1] - base[1], tip[0] - base[0]) + 0.5, w=max(1.5, 4 * k), solid=0.7, grain=0.75, edge=0.8 * k)
        hp = np.array([base, base * 0.6 + mid * 0.4 + nrm * wdt * 0.7, mid + nrm * wdt * 0.85, tip * 0.7 + mid * 0.3 + nrm * wdt * 0.4, tip, mid])
        fillp(L, hp, mul(green_l, dim), rng, ang=math.atan2(tip[1] - base[1], tip[0] - base[0]) + 0.3, w=max(1.2, 3 * k), grain=0.98, v=(0.2 + 0.3 * lit, 0.6 + 0.3 * lit), edge=1.2 * k)
        oline(L, [base, mid, tip], mul(green, 0.5 * dim), max(1.0, 1.3 * k * lw), rng, wob=0.6 * k, v=0.6, taper=(1.0, 0.4))
    # the stalk
    oline(L, cur, mul(green, 0.9 * dim), max(1.5, 5.0 * k), rng, wob=0.8 * k, v=0.95, taper=(1.0, 0.45), var=0.15, grain=0.6)
    oline(L, cur + np.array([-1.2 * k, 0]), mul(green_l, dim), max(1.0, 1.6 * k), rng, wob=0.8 * k, v=0.5 + 0.3 * lit, taper=(1.0, 0.4))
    # lanterns: they hang, whatever the stalk is doing
    if lanterns:
        for i, t in enumerate(LANT_T):
            j = int(t * (n - 1))
            side = -1 if i % 2 == 0 else 1
            node = cur[j]
            w = hgt * 0.165 * LANT_S[i]
            ped = w * 0.55
            sw = swing * math.sin(i * 1.7 + 0.6) * 0.5
            top = node + np.array([side * face * ped * 0.75 + math.sin(sw) * ped, ped * 0.8])
            if i in taken:
                oline(L, [node, node * 0.5 + top * 0.5 + np.array([side * face * ped * 0.3, -ped * 0.1])], mul(green, 0.8 * dim), max(1.0, 1.4 * k), rng, wob=0, v=0.7)
                out['lanterns'].append(None)
                continue
            oline(L, [node, node * 0.5 + top * 0.5 + np.array([side * face * ped * 0.25, -ped * 0.25]), top], mul(green, 0.8 * dim), max(1.0, 1.5 * k), rng, wob=0, v=0.8, taper=(1, 0.8))
            c, tip = draw_lantern(L, rng, top[0], top[1], w, ripe=min(1.0, LANT_RIPE[i] * ripe_scale), lit=lit, ang=sw * 0.6, dim=dim)
            out['lanterns'].append((top[0], top[1], w, c, tip))
    return out


def lantern_glow(cv_, rng, cx, cy, r, strength=1.0, col=VERM_GLOW):
    """scumble of orange dust on the dark around a lit lantern"""
    if strength <= 0.02:
        return
    x0, y0, x1, y1 = cv_.roi(cx - r * 1.3, cy - r * 1.3, cx + r * 1.3, cy + r * 1.3)
    b = Batch(cv_, x0, y0, x1, y1)
    for rr, v in [(1.0, 0.10), (0.62, 0.20), (0.36, 0.34)]:
        b.dot(cx + rng.normal(0, r * 0.03), cy + rng.normal(0, r * 0.03), r * rr, v * strength)
    items = list(b.items)
    b.commit(col, grain=0.25, soft=1.0, blur=r * 0.22, op=0.55, gain=2.2)
    b.items = items
    b.commit(col, grain=1.0, soft=0.12, blur=r * 0.16, gain=0.8)


def husk_skeleton(L, rng, cx, cy, w, ang=0.0, berry=True, lit=0.0, col=STRAW, k=1.0, veil=0.0):
    """a lantern after a winter: only its veins, and what it was keeping"""
    hgt = w * 1.18
    poly, _, R = lantern_shape(cx, cy, w, hgt, ang, n=22)
    t = np.linspace(0, 1, 22)
    hw = w * 0.5 * np.sin(math.pi * t ** 0.60) ** 0.85 * (1 - 0.10 * t); hw[0] = w * 0.10
    fr = [-1.0, -0.62, -0.2, 0.25, 0.66, 1.0]
    if veil > 0:
        fillp(L, poly, col, rng, ang=1.2, w=max(1.5, w * 0.05), grain=1.0, v=(0.05, 0.25 * veil), edge=1.0)
    if berry:
        bc = R(np.array([w * 0.02]), np.array([hgt * 0.50]))[0]
        br = w * 0.20
        fillp(L, np.stack([bc[0] + br * np.cos(np.linspace(0, 6.28, 18)), bc[1] + br * np.sin(np.linspace(0, 6.28, 18))], 1), VERM, rng, ang=1.0, w=max(1.2, br * 0.3), solid=0.9, grain=0.4, edge=max(0.6, br * 0.08))
        if br > 4:
            a = np.linspace(2.4, 5.0, 10)
            cres = np.vstack([np.stack([bc[0] + br * 0.9 * np.cos(a), bc[1] + br * 0.9 * np.sin(a)], 1), np.stack([bc[0] - br * 0.15 + br * 0.55 * np.cos(a[::-1]), bc[1] - br * 0.1 + br * 0.55 * np.sin(a[::-1])], 1)])
            fillp(L, cres, VERM_L, rng, ang=1.3, w=max(1.0, br * 0.2), grain=0.9, v=(0.4, 0.9), edge=max(0.6, br * 0.1))
            a = np.linspace(-0.6, 1.9, 10)
            cres = np.vstack([np.stack([bc[0] + br * 0.95 * np.cos(a), bc[1] + br * 0.95 * np.sin(a)], 1), np.stack([bc[0] + br * 0.12 + br * 0.6 * np.cos(a[::-1]), bc[1] + br * 0.1 + br * 0.6 * np.sin(a[::-1])], 1)])
            fillp(L, cres, VERM_D, rng, ang=1.0, w=max(1.0, br * 0.2), grain=0.9, v=(0.3, 0.8), edge=max(0.6, br * 0.1))
            if lit > 0:
                b = Batch(L, *L.roi(bc[0] - br, bc[1] - br, bc[0] + br, bc[1] + br))
                b.dot(bc[0] - br * 0.35, bc[1] - br * 0.38, br * 0.2, lit)
                b.commit((1.0, 0.95, 0.75), grain=0.5, soft=0.3)
    lwd = max(1.0, w * 0.012)
    ribs = [R(hw * f, t * hgt) for f in fr]
    for i, rb in enumerate(ribs):
        oline(L, rb, col, lwd * (1.5 if i in (0, 5) else 1.15), rng, wob=w * 0.006, v=0.9, taper=(0.8, 1.0), var=0.3, grain=0.6)
    if w > 30:
        # the net between the ribs
        for i in range(len(ribs) - 1):
            a, b_ = ribs[i], ribs[i + 1]
            nn = int(clamp(w / 9, 5, 26))
            for j in range(nn):
                u = (j + rng.uniform(0.1, 0.9)) / nn
                ia = int(u * 21); ib = int(clamp(u + rng.normal(0, 0.035)) * 21)
                p0 = a[ia]; p1 = b_[ib]
                mid = (p0 + p1) / 2 + rng.normal(0, w * 0.012, 2)
                oline(L, [p0, mid, p1], col, max(1.0, lwd * 0.7), rng, wob=0, v=rng.uniform(0.35, 0.8), taper=(1, 1), grain=0.7)
                if rng.random() < 0.5 and w > 80:
                    q = a[min(21, ia + 1)] * rng.uniform(0.3, 0.7) + b_[min(21, ib + 1)] * rng.uniform(0.3, 0.7)
                    q = q / (np.linalg.norm(q) + 1e-9) * np.linalg.norm(q)
                    p2 = (a[min(21, ia + 1)] + b_[min(21, ib + 1)]) / 2 + rng.normal(0, w * 0.01, 2)
                    oline(L, [mid, p2], col, max(1.0, lwd * 0.55), rng, wob=0, v=rng.uniform(0.3, 0.6), taper=(1, 1), grain=0.75)
    return R(np.array([0.0]), np.array([hgt * 0.5]))[0]


# ------------------------------------------------------------------ ferns, grass, small things
def fern(b_dark, b_light, rng, x, y, ln, ang, curl=0.6, k=1.0, pinn=1.0):
    """one frond into two batches (dark body, lit upper pinnae)"""
    n = 16
    t = np.linspace(0, 1, n)
    a = ang + curl * t ** 1.4 * (1 if math.cos(ang) > 0 else -1)
    px = x + np.cumsum(np.cos(a)) * ln / n
    py = y - np.cumsum(np.sin(a) * (1 - 0.9 * t ** 2)) * ln / n + np.cumsum(t) * ln / n * 0.25
    b_dark.line(np.stack([px, py], 1), max(1.0, 1.8 * k), 0.8)
    for i in range(1, n):
        pl = ln * 0.24 * math.sin(math.pi * (i / n) ** 0.7) * pinn * (0.9 + 0.2 * rng.random())
        d = np.array([px[i] - px[i - 1], py[i] - py[i - 1]]); d /= (np.hypot(*d) + 1e-9)
        nr = np.array([-d[1], d[0]])
        for sgn, bb in ((1, b_dark), (-1, b_light if b_light is not None else b_dark)):
            e = np.array([px[i], py[i]]) + (nr * sgn * 0.92 + d * 0.38) * pl + np.array([0, pl * 0.18])
            bb.line(np.array([[px[i], py[i]], (np.array([px[i], py[i]]) + e) / 2 + nr * sgn * pl * 0.06, e]), max(1.0, 3.2 * k * (1 - 0.5 * i / n)), rng.uniform(0.5, 0.95), taper=(1.0, 0.35))


def blade(b, rng, x, y, ln, lean, w, v=0.8, curve=0.3):
    tip = np.array([x + ln * math.sin(lean), y - ln * math.cos(lean) * (1 - 0.25 * abs(lean))])
    mid = np.array([x + ln * 0.5 * math.sin(lean * (1 - curve)), y - ln * 0.55])
    b.line(np.array([[x, y], mid, tip]), w, v, taper=(1.0, 0.3))
    return tip
