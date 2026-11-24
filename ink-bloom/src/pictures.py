"""Target pictures for Ink Bloom, drawn procedurally as ink-density maps.

Every picture is returned as float32 array (3, H, W): indigo, vermilion, gold
density in domain coordinates (W=1440, H=1920).  Values ~0..1.3.
"""
import numpy as np
import cv2
from PIL import Image, ImageDraw

W, H = 1440, 1920
SS = 2  # supersample


class Canvas:
    def __init__(self):
        self.im = Image.new("F", (W * SS, H * SS), 0.0)
        self.d = ImageDraw.Draw(self.im)

    def poly(self, pts, v=1.0):
        self.d.polygon([(x * SS, y * SS) for x, y in pts], fill=float(v))

    def ellipse(self, cx, cy, rx, ry, v=1.0):
        self.d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=float(v))

    def line(self, pts, w, v=1.0):
        p = [(x * SS, y * SS) for x, y in pts]
        self.d.line(p, fill=float(v), width=int(round(w * SS)), joint="curve")
        r = w * SS / 2
        for x, y in (p[0], p[-1]):
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=float(v))

    def stroke(self, pts, w0, w1=None, v=1.0, wmid=None):
        """tapered stroke through pts (list), width from w0 to w1 (optional mid)."""
        pts = np.asarray(pts, np.float64)
        n = len(pts)
        if w1 is None:
            w1 = w0
        for i in range(n):
            t = i / max(n - 1, 1)
            if wmid is None:
                w = w0 + (w1 - w0) * t
            else:
                w = (w0 * (1 - t) ** 2 + 2 * wmid * t * (1 - t) + w1 * t * t) if False else \
                    (w0 + (wmid - w0) * (t * 2) if t < 0.5 else wmid + (w1 - wmid) * (t * 2 - 1))
            r = max(w, 0.3) * SS / 2
            x, y = pts[i] * SS
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=float(v))

    def arr(self, blur=0.0):
        a = np.asarray(self.im, np.float32)
        a = cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA)
        if blur > 0:
            a = cv2.GaussianBlur(a, (0, 0), blur)
        return a


def spline(pts, n=200, closed=False):
    """Catmull-Rom through pts."""
    P = np.asarray(pts, np.float64)
    if closed:
        P = np.vstack([P[-1], P, P[0], P[1]])
    else:
        P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    segs = len(P) - 3
    out = []
    per = max(2, n // segs)
    for i in range(segs):
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        t = np.linspace(0, 1, per, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(P[-2][None])
    return np.vstack(out)


def fbm(seed, scale, octaves=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp = 1.0
    tot = 0
    for o in range(octaves):
        s = scale / (2 ** o)
        h, w = int(H / s) + 3, int(W / s) + 3
        n = rng.standard_normal((h, w)).astype(np.float32)
        n = cv2.resize(n, (W, H), interpolation=cv2.INTER_CUBIC)
        out += amp * n
        tot += amp
        amp *= 0.5
    return out / tot


def wash(a, seed, lo=0.72, scale=160):
    """ink-wash density variation."""
    n = fbm(seed, scale)
    n = (n - n.min()) / (n.max() - n.min() + 1e-6)
    return a * (lo + (1 - lo) * n)


# ----------------------------------------------------------------------------
def forest():
    rng = np.random.default_rng(7)
    ground = 1440.0

    def pine(c, x, base, h, w, v=1.0, tiers=7):
        # trunk
        c.poly([(x - w * 0.035, base), (x + w * 0.035, base), (x + w * 0.02, base - h * 0.5), (x - w * 0.02, base - h * 0.5)], v)
        top = base - h
        for i in range(tiers):
            t0 = i / tiers
            t1 = (i + 1.55) / tiers
            y0 = top + (h * 0.93) * t0
            y1 = top + (h * 0.93) * min(t1, 1.02)
            ww = w * (0.16 + 0.84 * ((i + 1) / tiers) ** 0.9) * (0.92 + 0.16 * rng.random())
            sk = (rng.random() - 0.5) * 0.12 * ww
            pts = [(x + sk * 0.2, y0), (x + ww * 0.5 + sk, y1), (x + ww * 0.22, y1 - (y1 - y0) * 0.16),
                   (x, y1 - (y1 - y0) * 0.05), (x - ww * 0.22, y1 - (y1 - y0) * 0.16), (x - ww * 0.5 + sk, y1)]
            c.poly(pts, v)
        c.line([(x, top - h * 0.03), (x, top + h * 0.1)], max(3.0, w * 0.02), v)

    # far layer
    far = Canvas()
    for x, h, w in [(300, 300, 150), (395, 380, 170), (505, 330, 150), (640, 420, 180), (760, 300, 150),
                    (860, 360, 160), (965, 430, 180), (1075, 330, 160), (1150, 280, 140)]:
        pine(far, x, ground - 4, h, w, 1.0, tiers=6)
    far_a = far.arr(3.0) * 0.36
    near = Canvas()
    for x, h, w in [(350, 520, 230), (560, 690, 280), (820, 560, 240), (1040, 640, 270)]:
        pine(near, x, ground, h, w, 1.0, tiers=8)
    # small saplings
    for x, h, w in [(455, 210, 110), (700, 250, 120), (930, 190, 100), (1140, 220, 110), (262, 190, 100)]:
        pine(near, x, ground + 2, h, w, 1.0, tiers=5)
    # ground: soft mound
    xs = np.linspace(215, 1225, 80)
    top = ground - 16 - 10 * np.sin((xs - 215) / 1010 * np.pi) + 4 * np.sin(xs * 0.031)
    near.poly(list(zip(xs, top)) + [(1225, ground + 26), (215, ground + 26)], 1.0)
    near_a = near.arr(1.6)
    # mist / reflection fading below the ground
    refl = Canvas()
    ys = np.linspace(0, 1, 9)
    a_ref = np.zeros((H, W), np.float32)
    band = Canvas()
    band.poly([(235, ground + 22), (1205, ground + 22), (1120, ground + 150), (320, ground + 150)], 1.0)
    b = band.arr(26.0)
    yy = np.arange(H, dtype=np.float32)[:, None]
    fade = np.clip(1 - (yy - (ground + 10)) / 150.0, 0, 1) ** 1.6
    a_ref = b * fade * 0.40 * (0.6 + 0.4 * (fbm(3, 60, 3) > -0.1))
    ind = np.maximum(near_a, far_a) + a_ref
    ind = wash(ind, 11, 0.74)
    # sun
    sun = Canvas()
    sun.ellipse(742, 760, 104, 104, 1.0)
    ver = sun.arr(5.0) * 0.95
    ver = wash(ver, 12, 0.8, 80)
    return np.stack([ind, ver, np.zeros_like(ind)])


# ----------------------------------------------------------------------------
def whale():
    rng = np.random.default_rng(3)
    c = Canvas()
    # spine: head (left) to tail stock (right); gentle arch
    spine = spline([(292, 1128), (430, 1070), (610, 1040), (790, 1062), (940, 1108), (1050, 1120), (1120, 1076)], 400)
    n = len(spine)
    u = np.linspace(0, 1, n)
    # half thickness above (back) / below (belly)
    def prof(u, pk, wmax, head):
        a = np.where(u < pk, head + (1 - head) * np.sin(u / pk * np.pi / 2) ** 0.75, np.cos((u - pk) / (1 - pk) * np.pi / 2) ** 1.25)
        return wmax * a
    up = prof(u, 0.30, 112, 0.50) + 6
    dn = prof(u, 0.26, 150, 0.42) + 7
    tang = np.gradient(spine, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True)
    nrm = np.stack([tang[:, 1], -tang[:, 0]], 1)  # points up (negative y) for rightward tangent
    top = spine + nrm * up[:, None]
    bot = spine - nrm * dn[:, None]
    # round the snout
    body = np.vstack([top, bot[::-1]])
    c.poly([tuple(p) for p in body], 1.0)
    c.ellipse(spine[0, 0] + 26, spine[0, 1] + 8, 62, 0.5 * (up[0] + dn[0]) + 20, 1.0)
    # flukes
    tx, ty = spine[-1]
    fl = spline([(tx - 26, ty + 22), (tx + 10, ty - 12), (tx + 62, ty - 82), (tx + 150, ty - 142), (tx + 196, ty - 132),
                 (tx + 150, ty - 96), (tx + 104, ty - 52), (tx + 92, ty - 14), (tx + 128, ty + 26), (tx + 196, ty + 52),
                 (tx + 232, ty + 86), (tx + 176, ty + 92), (tx + 96, ty + 72), (tx + 32, ty + 42)], 300, closed=True)
    c.poly([tuple(p) for p in fl], 1.0)
    # dorsal fin
    i = int(n * 0.66)
    dx, dy = top[i]
    c.poly([(dx - 46, dy + 8), (dx + 2, dy - 36), (dx + 30, dy - 40), (dx + 38, dy + 10)], 1.0)
    # pectoral flipper (long humpback flipper)
    i = int(n * 0.27)
    px, py = bot[i]
    fp = spline([(px - 34, py - 46), (px + 24, py + 30), (px + 96, py + 132), (px + 178, py + 206), (px + 226, py + 214),
                 (px + 214, py + 172), (px + 150, py + 84), (px + 96, py - 8), (px + 60, py - 50)], 240, closed=True)
    c.poly([tuple(p) for p in fp], 1.0)
    a = c.arr(1.5)
    # belly: lighter with throat grooves
    g = Canvas()
    for k in range(7):
        f = 0.30 + 0.085 * k
        pts = [tuple(spine[j] - nrm[j] * dn[j] * (f + 0.05 * np.sin(j * 0.02 + k))) for j in range(int(n * 0.02), int(n * (0.50 - 0.02 * k)))]
        g.line(pts, 5.5, 1.0)
    grooves = g.arr(1.6)
    bm = Canvas()
    pts = [tuple(spine[j] - nrm[j] * dn[j] * 0.22) for j in range(0, int(n * 0.58))] + \
          [tuple(spine[j] - nrm[j] * (dn[j] + 30)) for j in range(int(n * 0.58), -1, -1)] + [(spine[0, 0] - 60, spine[0, 1] + 40)]
    bm.poly(pts, 1.0)
    belly = bm.arr(12.0)
    a = a * (1 - 0.34 * belly) * (1 - 0.6 * grooves * belly)
    # eye + mouth line
    e = Canvas()
    ex, ey = spine[int(n * 0.115)] + np.array([0, 14])
    e.ellipse(ex, ey, 10, 8, 1.0)
    mpts = spline([(spine[0, 0] - 30, spine[0, 1] + 40), (spine[0, 0] + 40, spine[0, 1] + 44), (ex - 10, ey + 34), (ex + 46, ey + 30)], 60)
    e.stroke(mpts, 5, 3)
    a = a * (1 - np.clip(e.arr(1.4), 0, 1) * 0.92)
    ind = wash(a, 21, 0.76)
    # a few rising bubbles (indigo, thin rings) trailing under the tail
    # spout: vermilion fan of droplets above the blowhole
    s = Canvas()
    bi = int(n * 0.17)
    bx, by = top[bi]
    by -= 6
    for ang, ln, wd in [(-0.62, 250, 30), (-0.33, 300, 36), (-0.05, 320, 40), (0.26, 300, 36), (0.56, 245, 30)]:
        ang = ang - 0.12
        pts = []
        for t in np.linspace(0, 1, 60):
            r = ln * t
            x = bx + np.sin(ang) * r * (1 + 0.55 * t * abs(np.sin(ang)) ) + 14 * np.sin(ang)
            y = by - np.cos(ang) * r + 105 * t ** 2.4 * abs(np.sin(ang)) ** 0.8
            pts.append((x, y))
        s.stroke(pts, 7, wd * 0.5, wmid=wd * 0.55)
        ex_, ey_ = pts[-1]
        s.ellipse(ex_, ey_, wd * 0.56, wd * 0.56, 1.0)
        # droplets
        for k in range(3):
            j = rng.integers(26, 58)
            ox, oy = (rng.random(2) - 0.5) * np.array([70, 60])
            rr = 7 + 8 * rng.random()
            s.ellipse(pts[j][0] + ox, pts[j][1] + oy, rr, rr * 1.15, 1.0)
    ver = wash(s.arr(2.2), 22, 0.8, 70) * 0.95
    out = np.stack([ind, ver, np.zeros_like(ind)])
    sc = 0.88
    M = np.float32([[sc, 0, 720 * (1 - sc) - 84], [0, sc, 1080 * (1 - sc) + 30]])
    return np.stack([cv2.warpAffine(o, M, (W, H), flags=cv2.INTER_LINEAR) for o in out])


# ----------------------------------------------------------------------------
def city():
    rng = np.random.default_rng(5)
    base = 1385.0
    c = Canvas()
    holes = Canvas()
    # (x0, x1, height, style)
    B = [(238, 300, 250, "flat"), (296, 372, 400, "step"), (368, 430, 300, "ant"), (426, 520, 520, "slant"),
         (516, 572, 350, "flat"), (568, 668, 760, "spire"), (664, 734, 470, "step"), (730, 800, 330, "dome"),
         (796, 900, 640, "crown"), (896, 962, 420, "ant"), (958, 1046, 540, "step"), (1042, 1110, 300, "flat"),
         (1106, 1164, 390, "slant2"), (1160, 1206, 230, "flat")]
    for x0, x1, h, st in B:
        top = base - h
        w = x1 - x0
        cx = (x0 + x1) / 2
        c.poly([(x0, base), (x1, base), (x1, top), (x0, top)])
        if st == "step":
            c.poly([(x0 + w * 0.18, top), (x1 - w * 0.18, top), (x1 - w * 0.18, top - 46), (x0 + w * 0.18, top - 46)])
            c.poly([(x0 + w * 0.36, top - 46), (x1 - w * 0.36, top - 46), (x1 - w * 0.36, top - 84), (x0 + w * 0.36, top - 84)])
        elif st == "ant":
            c.line([(cx, top), (cx, top - 110)], 6)
            c.poly([(cx - 14, top), (cx + 14, top), (cx + 14, top - 22), (cx - 14, top - 22)])
        elif st == "slant":
            c.poly([(x0, top), (x1, top), (x1, top - 92)])
        elif st == "slant2":
            c.poly([(x0, top), (x1, top), (x0, top - 64)])
        elif st == "spire":
            c.poly([(x0 + 10, top), (x1 - 10, top), (x1 - 24, top - 70), (x0 + 24, top - 70)])
            c.poly([(x0 + 24, top - 70), (x1 - 24, top - 70), (cx + 9, top - 150), (cx - 9, top - 150)])
            c.line([(cx, top - 150), (cx, top - 268)], 7)
        elif st == "dome":
            c.ellipse(cx, top, w * 0.44, 42)
            c.line([(cx, top - 40), (cx, top - 84)], 5)
        elif st == "crown":
            for k in range(3):
                xx = x0 + w * (0.2 + 0.3 * k)
                c.poly([(xx - 15, top), (xx + 15, top), (xx + 15, top - 40 - 22 * (k == 1)), (xx - 15, top - 40 - 22 * (k == 1))])
            c.line([(cx, top - 62), (cx, top - 140)], 5)
        # windows (clear holes)
        if w >= 56:
            cols = max(2, int(w // 26))
            pitch = (w - 16) / cols
            ny = int((h - 30) // 44)
            for iy in range(ny):
                for ix in range(cols):
                    if rng.random() < 0.52:
                        wx = x0 + 8 + ix * pitch + pitch * 0.2
                        wy = top + 20 + iy * 44
                        holes.poly([(wx, wy), (wx + pitch * 0.6, wy), (wx + pitch * 0.6, wy + 24), (wx, wy + 24)])
    # bridge / quay line
    c.poly([(210, base - 6), (1232, base - 6), (1232, base + 12), (210, base + 12)])
    a = c.arr(1.3)
    hm = holes.arr(1.6)
    a = a * (1 - 0.82 * np.clip(hm, 0, 1))
    # reflection: flipped, squashed, streaked
    refl = np.zeros((H, W), np.float32)
    span = 300
    src = a[int(base) - 760:int(base), :][::-1]  # flipped
    sq = cv2.resize(src, (W, span), interpolation=cv2.INTER_AREA)
    sq = cv2.GaussianBlur(sq, (0, 0), sigmaX=5, sigmaY=2)
    y0 = int(base) + 14
    yy = np.arange(span, dtype=np.float32)[:, None]
    streak = (np.sin(yy * 0.52 + 3 * np.sin(yy * 0.071)) > -0.25).astype(np.float32)
    streak = cv2.GaussianBlur(streak, (0, 0), 1.4)
    # horizontal wobble
    xx = np.arange(W, dtype=np.float32)[None, :].repeat(span, 0) + 7 * np.sin(yy * 0.2 + 1.0) * (yy / span)
    sq = cv2.remap(sq, xx.astype(np.float32), np.arange(span, dtype=np.float32)[:, None].repeat(W, 1), cv2.INTER_LINEAR)
    refl[y0:y0 + span] = sq * streak * (0.5 * (1 - yy / span) ** 1.3)
    ind = wash(a + refl, 31, 0.76)
    # sun behind the skyline
    s = Canvas()
    s.ellipse(872, 860, 168, 168, 1.0)
    sun = s.arr(4.0)
    # sun reflection streaks
    r = Canvas()
    for k in range(7):
        yk = base + 40 + k * 36
        wk = 150 - k * 15
        r.line([(872 - wk, yk), (872 + wk, yk)], 12 - k)
    sr = r.arr(3.0) * 0.5
    ver = wash(sun * 0.9 + sr, 32, 0.8, 90)
    return np.stack([ind, ver, np.zeros_like(ind)])


# ----------------------------------------------------------------------------
def face():
    cx, cy = 720.0, 1035.0
    # ---------------- hair mass
    hair = Canvas()
    outer = spline([(cx - 6, 646), (cx - 150, 668), (cx - 262, 760), (cx - 318, 900), (cx - 322, 1060), (cx - 330, 1200),
                    (cx - 372, 1330), (cx - 430, 1440), (cx - 400, 1520), (cx - 300, 1538), (cx - 205, 1500),
                    (cx - 150, 1440), (cx, 1440), (cx + 150, 1440),
                    (cx + 205, 1500), (cx + 300, 1538), (cx + 400, 1520), (cx + 430, 1440), (cx + 372, 1330),
                    (cx + 330, 1200), (cx + 322, 1060), (cx + 318, 900), (cx + 262, 760), (cx + 150, 668)], 600, closed=True)
    hair.poly([tuple(p) for p in outer])
    ha = hair.arr(2.0)
    # ---------------- face (clear) region: jaw outline + hairline with a side part
    fc = Canvas()
    part = (cx + 36, 772)
    faceo = spline([part, (cx - 60, 800), (cx - 150, 868), (cx - 196, 970), (cx - 200, 1070), (cx - 186, 1170),
                    (cx - 140, 1262), (cx - 70, 1322), (cx, 1340), (cx + 70, 1322), (cx + 140, 1262),
                    (cx + 186, 1170), (cx + 204, 1070), (cx + 206, 980), (cx + 180, 890), (cx + 110, 800)], 500, closed=True)
    fc.poly([tuple(p) for p in faceo])
    # neck + shoulders clear region
    fc.poly([(cx - 92, 1280), (cx + 92, 1280), (cx + 100, 1420), (cx + 150, 1470), (cx + 150, 1560), (cx - 150, 1560), (cx - 150, 1470), (cx - 100, 1420)])
    fa = fc.arr(1.8)
    ind = ha * (1 - np.clip(fa, 0, 1))
    # hair strand texture: flowing streaks (lighter filaments)
    n1 = fbm(41, 46, 3)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    flow = np.sin((np.abs(xx - cx) * 0.085) + (yy - 640) * 0.012 * (1 + np.abs(xx - cx) / 300) + n1 * 3.4)
    strands = 0.86 + 0.14 * np.clip(flow * 1.3, -1, 1)
    ind = ind * strands
    # ---------------- neck shadow under the jaw
    ns = Canvas()
    sh = spline([(cx - 96, 1296), (cx - 60, 1338), (cx, 1356), (cx + 60, 1338), (cx + 96, 1296), (cx + 98, 1400),
                 (cx + 40, 1385), (cx, 1392), (cx - 30, 1410), (cx - 98, 1420)], 200, closed=True)
    ns.poly([tuple(p) for p in sh])
    neck = ns.arr(5.0) * 0.5
    jaw = Canvas()
    jaw.poly([tuple(p) for p in spline([(cx - 150, 1244), (cx - 76, 1318), (cx, 1338), (cx + 76, 1318), (cx + 150, 1244),
                                        (cx + 150, 1500), (cx - 150, 1500)], 200, closed=True)])
    ja = jaw.arr(1.5)
    chin_mask = Canvas()
    chin_mask.poly([tuple(p) for p in faceo])
    cm = chin_mask.arr(1.5)
    neck = neck * (1 - np.clip(cm, 0, 1))
    # collar / shoulders line
    sl = Canvas()
    sl.stroke(spline([(cx - 150, 1474), (cx - 96, 1436), (cx - 40, 1462), (cx, 1470)], 80), 5, 9)
    sl.stroke(spline([(cx + 150, 1474), (cx + 96, 1436), (cx + 40, 1462), (cx, 1470)], 80), 5, 9)
    shoulders = sl.arr(2.0) * 0.55
    # ---------------- features
    f = Canvas()
    soft = Canvas()
    for s in (-1, 1):
        ex = cx + s * 98
        # eyebrow: arched, thick inner -> thin outer
        brow = spline([(ex - s * 62, 968), (ex - s * 22, 950), (ex + s * 30, 946), (ex + s * 78, 968)], 90)
        f.stroke(brow, 19, 6, wmid=17)
        # closed eye: lash line (downward arc), thicker toward outer corner + lashes
        lid = spline([(ex - s * 56, 1040), (ex - s * 22, 1055), (ex + s * 20, 1056), (ex + s * 62, 1034)], 90)
        f.stroke(lid, 9, 15, wmid=13)
        for k, (t, ln) in enumerate([(0.42, 15), (0.58, 19), (0.74, 23), (0.88, 25), (0.98, 24)]):
            p = lid[int(t * (len(lid) - 1))]
            ang = 0.15 + 0.62 * t
            q = (p[0] + s * np.sin(ang) * ln, p[1] + np.cos(ang) * ln)
            f.stroke([tuple(p + (np.array(q) - p) * u) for u in np.linspace(0, 1, 16)], 7, 2)
        # eyelid crease (thin)
        crease = spline([(ex - s * 50, 1014), (ex - s * 10, 1002), (ex + s * 34, 1004), (ex + s * 66, 1022)], 60)
        soft.stroke(crease, 4, 3)
        # socket shadow
        soft.ellipse(ex - s * 8, 992, 54, 18, 0.5)
    # nose: side shadow + base
    nose_side = spline([(cx - 30, 990), (cx - 22, 1060), (cx - 30, 1120), (cx - 40, 1148)], 80)
    soft.stroke(nose_side, 9, 12, v=0.75)
    f.stroke(spline([(cx - 44, 1150), (cx - 34, 1168), (cx - 14, 1164), (cx, 1174), (cx + 14, 1164), (cx + 34, 1168), (cx + 44, 1150)], 100), 8, 8, wmid=6)
    f.ellipse(cx - 21, 1163, 9, 6)
    f.ellipse(cx + 21, 1163, 9, 6)
    # mouth line (indigo, between the lips)
    f.stroke(spline([(cx - 68, 1238), (cx - 30, 1244), (cx, 1241), (cx + 30, 1244), (cx + 68, 1238)], 80), 5, 5, wmid=7)
    # chin shadow
    soft.stroke(spline([(cx - 34, 1296), (cx, 1304), (cx + 34, 1296)], 40), 9, 9, v=0.7)
    # cheek contour (shadow side)
    soft.stroke(spline([(cx + 168, 1070), (cx + 158, 1150), (cx + 124, 1230)], 60), 12, 6, v=0.45)
    feat = f.arr(1.2)
    sf = soft.arr(4.0) * 0.5
    ind = ind + (feat + sf + shoulders) * np.clip(fa + 0.0, 0, 1) + neck
    ind = wash(ind, 43, 0.8)
    # ---------------- lips (vermilion) + blush
    lp = Canvas()
    upper = spline([(cx - 70, 1238), (cx - 40, 1222), (cx - 14, 1210), (cx, 1217), (cx + 14, 1210), (cx + 40, 1222),
                    (cx + 70, 1238), (cx + 30, 1243), (cx, 1240), (cx - 30, 1243)], 200, closed=True)
    lower = spline([(cx - 68, 1239), (cx - 30, 1244), (cx, 1242), (cx + 30, 1244), (cx + 68, 1239), (cx + 42, 1268),
                    (cx, 1280), (cx - 42, 1268)], 200, closed=True)
    lp.poly([tuple(p) for p in upper])
    lp.poly([tuple(p) for p in lower])
    lips = lp.arr(1.5)
    bl = Canvas()
    bl.ellipse(cx - 122, 1150, 52, 36, 1.0)
    bl.ellipse(cx + 122, 1150, 52, 36, 1.0)
    blush = bl.arr(22.0) * 0.16
    # a flower tucked in the hair (vermilion) as accent
    fl = Canvas()
    fx, fy = cx - 212, 905
    for k in range(6):
        a = k * np.pi / 3 + 0.3
        fl.ellipse(fx + 34 * np.cos(a), fy + 34 * np.sin(a), 27, 27)
    flower = fl.arr(2.5)
    core = Canvas(); core.ellipse(fx, fy, 15, 15)
    flower = flower * (1 - 0.8 * core.arr(2.0))
    ver = lips * 1.05 + blush + flower * 0.9
    ver = wash(ver, 44, 0.85, 60)
    ind = ind * (1 - 0.85 * np.clip(flower, 0, 1))
    return np.stack([ind, ver, np.zeros_like(ind)])


PICTURES = [forest, whale, city, face]
NAMES = ["forest", "whale", "city", "face"]


def preview(P):
    """quick Beer-Lambert preview (RGB uint8)."""
    k = np.array([[1.9, 1.5, 0.55], [0.16, 1.25, 1.9], [0.1, 0.5, 1.8]], np.float32) * 1.5
    tau = np.tensordot(P.transpose(1, 2, 0), k, axes=([2], [0]))
    bg = np.array([1.0, 0.94, 0.84], np.float32)
    return (np.clip(bg * np.exp(-tau), 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)


if __name__ == "__main__":
    import sys, os
    out = os.path.join(os.path.dirname(__file__), "..", "tmp", "pics")
    os.makedirs(out, exist_ok=True)
    tiles = []
    for fn, nm in zip(PICTURES, NAMES):
        P = fn()
        np.save(os.path.join(out, nm + ".npy"), P.astype(np.float16))
        im = preview(P)[:, 180:1260]
        cv2.imwrite(os.path.join(out, nm + ".jpg"), im[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
        tiles.append(cv2.resize(im, (405, 720), interpolation=cv2.INTER_AREA))
        print(nm, P.sum(axis=(1, 2)))
    cv2.imwrite(os.path.join(out, "all.jpg"), np.hstack(tiles)[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
