"""Shadow theatre: card / leather / gel puppets between a flickering lamp and a washi screen.
Every puppet is a plane at distance d behind the screen; its shadow is the exact point-lamp
projection (scale S/(S-d)) with penumbra blur lamp_r*d/(S-d).  The screen sits at the back
of a wooden box; the camera looks into the box (perspective walls) and pushes in slowly."""
import sys, os, time
import numpy as np
import cv2
from common import *

W = H = 1080
FPS, DUR = 30, 3.0
NF = int(FPS * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, 'frames_st')

FOC = 1100.0
S_L = 3.0                                   # lamp distance behind the screen
LAMP0 = np.array([0.05, 0.30])
LAMP_R = 0.14
LAMP_COL = np.array([1.0, 0.80, 0.50], F32)
OPEN = 1.12                                 # half size of screen opening
BOX = 0.6                                   # depth of the viewing box (frame in front of screen)
PPU = 460.0


def cam(t):
    u = ease(t / DUR)
    return np.array([0.13 - 0.22 * u, -0.06 + 0.03 * u, -3.2 + 0.5 * u])


def cam_matrix(z, c):
    s = FOC / (z - c[2])
    return np.array([[s, 0, W / 2 - s * c[0]], [0, -s, H / 2 + s * c[1]], [0, 0, 1]])


def lamp(t):
    r = rng(int(t * 1000) + 3)
    j = np.array([0.006 * np.sin(t * 23.0) + 0.004 * r.standard_normal(),
                  0.004 * np.sin(t * 17.0 + 1) + 0.003 * r.standard_normal()])
    return LAMP0 + j


def flicker(t):
    r = rng(int(t * 1000) + 11)
    return 1.0 + 0.035 * np.sin(2 * np.pi * 6.1 * t) + 0.02 * np.sin(2 * np.pi * 2.3 * t + 1) + 0.02 * r.standard_normal()


def proj(d, L):
    """Plane at distance d behind screen -> screen plane, from point lamp L."""
    k = S_L / (S_L - d)
    return np.array([[k, 0, L[0] * (1 - k)], [0, k, L[1] * (1 - k)], [0, 0, 1]])


def unproj(d, L=LAMP0):
    return np.linalg.inv(proj(d, L))


class Puppet:
    """A transmission layer: absorb = 1 - transmittance (rgb), painted in screen-target coords."""

    def __init__(self, name, ext, d_rest, ppu=PPU):
        self.name, self.d_rest = name, d_rest
        self.cv = Canvas(*ext, ppu)
        self.absorb = np.zeros((self.cv.h, self.cv.w, 3), F32)
        self.place = lambda t: (d_rest, np.eye(3))     # (d, plane-space motion)

    def add(self, mask, trans_rgb, seed=None, var=0.0):
        """Union a material: trans_rgb = colour of light that passes (0 = opaque card)."""
        a = 1.0 - np.asarray(trans_rgb, F32)
        if seed is not None and var > 0:
            n = fbm(self.cv.h, self.cv.w, seed, scale=50, octaves=4)
            a = a[None, None, :] * (1 + var * n[..., None])
        self.absorb = self.absorb * (1 - mask[..., None]) + np.clip(a, 0, 1) * mask[..., None]

    def cut(self, mask):
        self.absorb *= (1 - mask[..., None])

    def matrix(self, t, L):
        d, M = self.place(t)
        # texture px -> screen-target coords -> physical plane (rest lamp) -> motion -> screen
        return d, proj(d, L) @ M @ unproj(self.d_rest) @ self.cv.tex_matrix()


# ----------------------------------------------------------------------------- puppets

def wavy(xs, base, amp, k, ph):
    return base + amp * np.sin(k * xs + ph) + 0.4 * amp * np.sin(2.3 * k * xs + 2 * ph)


def gel_strip(name, d, bottom_fn, trans, seed, holes=(), tapes=()):
    P = Puppet(name, (-1.6, 1.6, -0.6, 1.6), d)
    cv = P.cv
    xs = np.linspace(-1.6, 1.6, 300)
    m = cv.mask(np.concatenate([np.stack([xs, bottom_fn(xs)], 1), [[1.6, 1.6], [-1.6, 1.6]]]), seed, 0.003)
    P.add(m, trans, seed + 1, var=0.12)
    # scratches / creases in the acetate
    r = rng(seed + 2)
    scr = np.zeros((cv.h, cv.w), F32)
    for _ in range(14):
        p0 = r.uniform([0, 0], [cv.w, cv.h])
        a = r.uniform(0, np.pi)
        L = r.uniform(30, 260)
        cv2.line(scr, tuple(int(v) for v in p0), (int(p0[0] + np.cos(a) * L), int(p0[1] + np.sin(a) * L)),
                 float(r.uniform(0.2, 0.6)), 1, cv2.LINE_AA)
    P.absorb *= (1 - 0.6 * scr * m)[..., None]
    for (hx, hy, hr) in holes:
        P.cut(cv.circle_mask(hx, hy, hr, cut_seed=seed + 5, cut_amp=0.002))
    for i, (tx, ty, ang) in enumerate(tapes):
        c, s = np.cos(np.deg2rad(ang)), np.sin(np.deg2rad(ang))
        q = np.array([[-0.09, -0.03], [0.09, -0.03], [0.09, 0.03], [-0.09, 0.03]])
        q = q @ np.array([[c, s], [-s, c]]) + [tx, ty]
        tm = cv.mask(q, seed + 10 + i, 0.002)
        P.absorb = 1 - (1 - P.absorb) * (1 - tm[..., None] * np.array([0.22, 0.25, 0.32], F32))
    return P


def make_sky():
    moon = (0.62, 0.62, 0.16)
    out = []
    # holes registered so they project onto the same moon (slightly off -> fringes, like the real thing)
    for name, d, fn, tr, sd in [
        ('gel_rose', 0.26, lambda x: wavy(x, -0.50, 0.012, 3, 0.3), (1.0, 0.72, 0.58), 301),
        ('gel_violet', 0.18, lambda x: wavy(x, -0.06, 0.03, 4.2, 1.0), (0.78, 0.58, 0.86), 311),
        ('gel_blue', 0.11, lambda x: wavy(x, 0.42, 0.04, 3.4, 2.1), (0.36, 0.46, 0.88), 321),
    ]:
        tapes = [(-1.02, fn(np.array([-1.02]))[0] + 0.02, 8), (0.98, fn(np.array([0.98]))[0] + 0.02, -12)]
        P = gel_strip(name, d, fn, tr, sd, holes=[moon], tapes=tapes)
        out.append(P)
    return out


def make_sea_gel():
    P = Puppet('gel_sea', (-1.6, 1.6, -1.6, 0.0), 0.22)
    cv = P.cv
    xs = np.linspace(-1.6, 1.6, 300)
    m = cv.mask(np.concatenate([np.stack([xs, wavy(xs, -0.31, 0.006, 5, 0)], 1), [[1.6, -1.6], [-1.6, -1.6]]]), 331, 0.002)
    P.add(m, (0.40, 0.78, 0.80), 332, var=0.12)
    m2 = cv.mask(np.concatenate([np.stack([xs, wavy(xs, -0.55, 0.02, 4, 1)], 1), [[1.6, -1.6], [-1.6, -1.6]]]), 333, 0.003)
    P.absorb = 1 - (1 - P.absorb) * (1 - m2[..., None] * np.array([0.45, 0.25, 0.1], F32))
    return P


def card_waves(name, d, base, amp, k, ph, seed, slide, sph, curls=True, trans=(0, 0, 0)):
    P = Puppet(name, (-1.9, 1.9, -1.6, base + amp + 0.12), d)
    cv = P.cv
    xs = np.linspace(-1.9, 1.9, 900)
    s = np.abs(np.sin(k * xs + ph))
    crest = base + amp * (1 - s) ** 2.2
    m = cv.mask(np.concatenate([np.stack([xs, crest], 1), [[1.9, -1.6], [-1.9, -1.6]]]), seed, 0.0015)
    if curls:  # curling crest tips (Hokusai-ish) cut as hooks
        peaks = (np.arange(-6, 7) * np.pi - ph) / k
        for i, px in enumerate(peaks):
            if -1.8 < px < 1.8:
                a = np.linspace(0.2, 1.75 * np.pi, 40)
                r_ = 0.05 * amp / 0.07
                cx_, cy_ = px + r_ * 0.9, base + amp - r_ * 0.2
                outer = np.stack([cx_ - r_ * np.cos(a), cy_ + r_ * np.sin(a)], 1)
                inner = np.stack([cx_ - 0.55 * r_ * np.cos(a[::-1]), cy_ + 0.55 * r_ * np.sin(a[::-1])], 1)
                m = np.maximum(m, cv.mask(np.concatenate([outer, inner]), seed + i, 0.001))
                m = np.clip(m - cv.circle_mask(cx_ - 0.1 * r_, cy_ + 0.05 * r_, 0.32 * r_), 0, 1)
    # lacework: small foam holes punched under the crest
    yc = np.interp(cv.X[0], xs, crest)[None, :]
    r = rng(seed + 50)
    holes = np.zeros((cv.h, cv.w), F32)
    for _ in range(int(90 * 3.8)):
        hx = r.uniform(-1.8, 1.8)
        hy = np.interp(hx, xs, crest) - r.uniform(0.04, 0.16)
        p = cv.to_px([(hx, hy)])[0]
        cv2.circle(holes, (int(p[0]), int(p[1])), max(1, int(r.uniform(0.006, 0.012) * cv.ppu)), 1.0, -1, cv2.LINE_AA)
    m = np.clip(m - holes, 0, 1)
    P.add(m, trans, seed + 60, var=0.2 if trans[0] > 0 else 0.0)
    P.place = lambda t: (d, T(slide * np.sin(2 * np.pi * t / 2.4 + sph), 0))
    return P


def make_cliff():
    P = Puppet('cliff', (-1.6, 0.0, -1.6, 1.0), 0.03)
    cv = P.cv
    prof = [(-1.6, -1.6), (-1.6, -0.02), (-1.25, 0.0), (-1.0, -0.04), (-0.62, -0.05), (-0.56, -0.12),
            (-0.5, -0.16), (-0.46, -0.28), (-0.40, -0.33), (-0.37, -0.45), (-0.30, -0.52), (-0.26, -1.6)]
    cliff = cv.mask(chaikin(prof, 1), 401, 0.006)
    lx = -0.86
    tower = cv.mask([(lx - 0.075, -0.05), (lx + 0.075, -0.05), (lx + 0.05, 0.55), (lx - 0.05, 0.55)], 402, 0.0015)
    gal = cv.mask([(lx - 0.08, 0.55), (lx + 0.08, 0.55), (lx + 0.08, 0.58), (lx - 0.08, 0.58)], 403, 0.001)
    lant = cv.mask([(lx - 0.042, 0.58), (lx + 0.042, 0.58), (lx + 0.042, 0.68), (lx - 0.042, 0.68)], 404, 0.001)
    cap = cv.mask([(lx - 0.06, 0.68), (lx + 0.06, 0.68), (lx, 0.77)], 405, 0.001)
    rail = cv.mask([(lx - 0.08, 0.6), (lx + 0.08, 0.6), (lx + 0.08, 0.61), (lx - 0.08, 0.61)])
    house = cv.mask([(lx + 0.05, -0.05), (lx + 0.24, -0.05), (lx + 0.24, 0.06), (lx + 0.145, 0.13), (lx + 0.05, 0.06)], 406, 0.0015)
    m = np.maximum.reduce([cliff, tower, gal, cap, house, rail])
    # lantern frame: glazing bars stay, panes become amber gel
    P.add(m, (0, 0, 0))
    panes = lant.copy()
    bars = (np.abs(cv.X - lx) < 0.006) | (np.abs(cv.X - lx - 0.028) < 0.005) | (np.abs(cv.X - lx + 0.028) < 0.005)
    P.add(lant * (1 - bars), (1.0, 0.72, 0.25))
    P.add(lant * bars, (0, 0, 0))
    # stripes cut as slits (lit through to the sky gels behind)
    for i in range(4):
        y0 = 0.05 + i * 0.13
        w0 = 0.075 - 0.025 * (y0 + 0.05) / 0.6 - 0.018
        P.cut(cv.mask([(lx - w0, y0), (lx + w0, y0), (lx + w0, y0 + 0.022), (lx - w0, y0 + 0.022)], 410 + i, 0.001))
    win = cv.mask([(lx + 0.15, -0.02), (lx + 0.19, -0.02), (lx + 0.19, 0.03), (lx + 0.15, 0.03)])
    P.add(win, (1.0, 0.75, 0.3))
    # lacework carved into the cliff: rows of leaves and dots (wayang-style)
    lace = np.zeros((cv.h, cv.w), F32)
    for row, yy in enumerate(np.arange(-0.2, -1.2, -0.11)):
        for xx in np.arange(-1.5, -0.3, 0.085) + (row % 2) * 0.042:
            p = cv.to_px([(xx, yy)])[0]
            if cliff[min(cv.h - 1, int(p[1])), min(cv.w - 1, int(p[0]))] > 0.99:
                pc = cv.to_px([(xx, yy)])[0]
                inside = cv2.pointPolygonTest(cv.to_px(chaikin(prof, 1)).astype(np.float32), (float(pc[0]), float(pc[1])), True)
                if inside > 0.07 * cv.ppu:
                    ax = (int(0.018 * cv.ppu), int(0.008 * cv.ppu))
                    cv2.ellipse(lace, (int(pc[0]), int(pc[1])), ax, 35 if row % 2 else -35, 0, 360, 1.0, -1, cv2.LINE_AA)
    P.cut(lace)
    # grass tufts on top
    r = rng(420)
    for gx in np.arange(-1.55, -0.6, 0.03):
        h_ = r.uniform(0.02, 0.05)
        top = np.interp(gx, [-1.6, -1.25, -1.0, -0.62], [-0.02, 0.0, -0.04, -0.05])
        P.add(cv.mask([(gx - 0.006, top - 0.01), (gx + 0.006, top - 0.01), (gx + r.uniform(-0.02, 0.02), top + h_)]), (0, 0, 0))
    P.lantern = (lx, 0.63)
    return P


def make_moon():
    mx, my, r = 0.62, 0.62, 0.16
    P = Puppet('moon_tissue', (mx - 0.25, mx + 0.25, my - 0.25, my + 0.25), 0.04)
    cv = P.cv
    disc = cv.circle_mask(mx, my, r + 0.01, cut_seed=441, cut_amp=0.002)
    P.add(disc, (0.97, 0.93, 0.84), 442, var=0.9)
    mare = np.clip(fbm(cv.h, cv.w, 443, scale=26, octaves=3) * 1.6 - 0.15, 0, 1) * disc
    P.absorb = 1 - (1 - P.absorb) * (1 - mare[..., None] * np.array([0.18, 0.2, 0.24], F32))
    return P


def make_island():
    P = Puppet('island', (0.6, 1.6, -0.5, 0.0), 0.05)
    cv = P.cv
    m = cv.mask(chaikin([(0.72, -0.32), (0.85, -0.24), (0.98, -0.21), (1.1, -0.16), (1.22, -0.19), (1.4, -0.26), (1.55, -0.34)], 2), 431, 0.003)
    P.add(m, (0.15, 0.12, 0.2))
    return P


BOAT = (-0.06, -0.68)


def make_boat():
    bx, by = BOAT
    P = Puppet('boat', (bx - 0.3, bx + 0.3, by - 0.2, by + 0.48), 0.07)
    cv = P.cv
    hull = cv.mask(chaikin([(bx - 0.21, by + 0.06), (bx + 0.22, by + 0.07), (bx + 0.15, by - 0.05), (bx - 0.14, by - 0.05)], 1), 501, 0.0012)
    mast = cv.mask([(bx - 0.006, by + 0.05), (bx + 0.006, by + 0.05), (bx + 0.004, by + 0.42), (bx - 0.004, by + 0.42)])
    sail = cv.mask([(bx + 0.014, by + 0.40), (bx + 0.014, by + 0.09), (bx + 0.2, by + 0.09)], 502, 0.0012)
    jib = cv.mask([(bx - 0.014, by + 0.36), (bx - 0.014, by + 0.10), (bx - 0.16, by + 0.10)], 503, 0.0012)
    flag = cv.mask([(bx, by + 0.42), (bx + 0.07, by + 0.405), (bx, by + 0.39)])
    P.add(np.maximum.reduce([hull, mast, flag]), (0, 0, 0))
    # dyed, oiled leather sails: translucent red and ochre, with the cut veins of the hide
    P.add(sail, (0.95, 0.30, 0.12), 504, var=0.25)
    P.add(jib, (0.95, 0.68, 0.22), 505, var=0.25)
    seams = sail * (np.abs(((cv.Y - by) / 0.06) % 1 - 0.5) < 0.06)
    P.add(seams, (0.35, 0.08, 0.04))
    for k in range(3):
        P.cut(cv.circle_mask(bx - 0.08 + k * 0.08, by + 0.01, 0.012))
    # rivet where the sail is pinned to the mast
    P.add(cv.circle_mask(bx + 0.02, by + 0.24, 0.01), (0, 0, 0))
    def place(t):
        ph = 2 * np.pi * t / 1.5
        return 0.07, T(0.01 * np.sin(ph * 0.5), 0.022 * np.sin(ph)) @ rot_about(6.0 * np.sin(ph + 1.2), bx, by - 0.02)
    P.place = place
    P.rods = [((bx, by - 0.03), (bx + 0.15, -2.2), 0.55)]
    return P


WC = (0.0, 0.0)   # whale designed around origin, then placed
WS = 0.74


def whale_shapes(cv):
    body_rel = [(-0.56, -0.06), (-0.50, 0.04), (-0.36, 0.11), (-0.12, 0.15), (0.10, 0.13), (0.26, 0.08),
                (0.36, 0.06), (0.40, 0.0), (0.38, -0.08), (0.20, -0.15), (-0.10, -0.19), (-0.40, -0.17), (-0.54, -0.12)]
    body = cv.mask(chaikin(body_rel, 3), 601, 0.0015)
    tail_rel = [(0.30, 0.04), (0.42, 0.10), (0.50, 0.20), (0.44, 0.30), (0.38, 0.38), (0.50, 0.35), (0.56, 0.30),
                (0.63, 0.35), (0.76, 0.38), (0.68, 0.28), (0.60, 0.19), (0.54, 0.06), (0.44, -0.04), (0.32, -0.06)]
    tail = cv.mask(chaikin(tail_rel, 3), 602, 0.0015)
    fin = cv.mask(chaikin([(-0.26, -0.10), (-0.10, -0.12), (-0.18, -0.25), (-0.26, -0.22)], 2), 603, 0.0015)
    return body, tail, fin


def make_whale():
    """Two-piece jointed whale of dark oiled leather: body + hinged tail, pinned at a rivet."""
    ext = (-0.7, 0.9, -0.45, 0.5)
    body = Puppet('whale_body', ext, 0.07)
    tail = Puppet('whale_tail', ext, 0.071)
    cv = body.cv
    mb, mt, mf = whale_shapes(cv)
    leather = (0.05, 0.09, 0.12)
    body.add(np.maximum(mb, mf), leather, 611, var=0.35)
    tail.add(mt * (1 - mb * 0.0), leather, 612, var=0.35)
    # carved detail: eye, lateral-line dots, ventral pleats as slits, blowhole
    body.cut(cv.circle_mask(-0.43, 0.0, 0.016))
    body.cut(cv.circle_mask(-0.43, 0.0, 0.016))
    for i, x in enumerate(np.linspace(-0.3, 0.22, 9)):
        body.cut(cv.circle_mask(x, 0.04 - 0.08 * ((x + 0.3) / 0.52) ** 2, 0.011))
    for i, x in enumerate(np.linspace(-0.48, -0.05, 9)):
        y0 = -0.09 - 0.05 * np.sin(np.pi * (x + 0.5) / 0.6)
        body.cut(cv.mask([(x, y0), (x + 0.035, y0 - 0.004), (x + 0.035, y0 - 0.012), (x, y0 - 0.008)]))
    for i, a in enumerate(np.linspace(0.2, 1.3, 5)):
        tail.cut(cv.circle_mask(0.56 + 0.1 * np.cos(a + 1.2), 0.18 + 0.1 * np.sin(a + 1.2) * 0.6, 0.008))
    hinge = (0.36, 0.0)
    rivet = cv.circle_mask(hinge[0], hinge[1], 0.014)
    tail.add(rivet, (0, 0, 0))
    # the articulation reads as a hairline gap where the two leather pieces meet, plus a ring round the pin
    a = np.linspace(-1.2, 1.3, 60)
    arc_o = np.stack([hinge[0] - 0.035 + 0.11 * np.cos(a), hinge[1] + 0.11 * np.sin(a)], 1)
    arc_i = np.stack([hinge[0] - 0.035 + 0.102 * np.cos(a[::-1]), hinge[1] + 0.102 * np.sin(a[::-1])], 1)
    gap = cv.mask(np.concatenate([arc_o, arc_i]))
    body.cut(gap * mb)
    ring = np.clip(cv.circle_mask(hinge[0], hinge[1], 0.026) - cv.circle_mask(hinge[0], hinge[1], 0.019), 0, 1)
    body.cut(ring)
    tail.cut(ring)

    d0, d1 = 1.25, 0.07
    rest_scale = 1.0
    p0, p1 = np.array([0.16, -0.24]), np.array([0.55, -0.62])

    def depth(t):
        return d0 + (d1 - d0) * ease(t / 2.3)

    def body_m(t):
        d = depth(t)
        u = ease(t / 2.3)
        target = p0 + (p1 - p0) * u + np.array([0, 0.03 * np.sin(np.pi * u)])
        # physical centre in plane d that projects onto target
        k = (S_L - d) / S_L
        c = LAMP0 + (target - LAMP0) * k
        rest = LAMP0 + (np.array([0.0, 0.0]) - LAMP0) * ((S_L - 0.07) / S_L)
        tilt = -6 + 9 * u
        rise = 0.05 * ease((t - 2.1) / 0.8)
        sc = WS * rest_scale
        return d, T(c[0] - rest[0], c[1] - rest[1] + rise) @ rot_about(tilt, rest[0], rest[1]) @ \
            T(rest[0], rest[1]) @ S(sc) @ T(-rest[0], -rest[1])

    def tail_m(t):
        d, M = body_m(t)
        flick = 12 * ease((t - 1.9) / 0.8) - 8 * ease((t - 2.55) / 0.45) - 6
        hp = unproj(0.07) @ np.array([hinge[0], hinge[1], 1.0])
        return d + 0.001, M @ rot_about(flick, hp[0], hp[1])

    body.place, tail.place = body_m, tail_m
    body.rods = [((-0.05, -0.08), None, 0.5)]
    tail.rods = [((0.55, 0.12), None, 0.45)]
    return body, tail


def build():
    t0 = time.time()
    ps = make_sky() + [make_sea_gel(), make_moon(),
                       card_waves('wave_far', 0.42, -0.50, 0.04, 6.0, 0.5, 701, 0.05, 0.0, curls=False, trans=(0.25, 0.35, 0.45)),
                       *make_whale(), make_boat(),
                       card_waves('wave_mid', 0.10, -0.66, 0.06, 5.0, 1.7, 711, 0.07, np.pi, curls=False, trans=(0.08, 0.30, 0.40)),
                       card_waves('wave_front', 0.02, -0.84, 0.075, 4.0, 0.3, 721, 0.09, 0.4, curls=False),
                       make_cliff()]
    for P in ps:
        P.absorb = np.ascontiguousarray(np.clip(P.absorb, 0, 1).astype(F32))
    print(f'built {len(ps)} puppets in {time.time() - t0:.1f}s', flush=True)
    return ps


# ----------------------------------------------------------------------------- viewer side

def make_screen_tex():
    """Washi transmission texture in screen coords (±1.3)."""
    cv = Canvas(-1.3, 1.3, -1.3, 1.3, 430)
    h, w = cv.h, cv.w
    low = fbm(h, w, 801, scale=180, octaves=4)
    cloud = fbm(h, w, 802, scale=35, octaves=4)
    r = rng(803)
    fib = np.zeros((h, w), F32)
    for _ in range(2600):
        x, y = r.uniform(0, w), r.uniform(0, h)
        a = r.uniform(0, 2 * np.pi)
        pts = [(x, y)]
        L = r.uniform(15, 90)
        for k in range(6):
            a += r.normal(0, 0.35)
            x, y = x + np.cos(a) * L / 6, y + np.sin(a) * L / 6
            pts.append((x, y))
        cv2.polylines(fib, [np.array(pts, np.int32)], False, float(r.uniform(0.3, 1.0)), 1, cv2.LINE_AA)
    fib = cv2.GaussianBlur(fib, (0, 0), 0.8)
    seam = np.clip(1 - np.abs(cv.X - 0.33 - 0.004 * np.sin(cv.Y * 9)) / 0.025, 0, 1)
    tr = 0.92 + 0.05 * low + 0.04 * cloud - 0.10 * fib - 0.12 * (cv.X > 0.33) * 0 - 0.14 * seam
    # faint creases
    crease = np.clip(1 - np.abs(cv.Y + 0.35 * cv.X - 0.55) / 0.006, 0, 1) * 0.05
    tr -= crease
    return cv, np.clip(tr, 0.4, 1.1).astype(F32)


def make_frame_tex():
    """Front face of the wooden box (plane z=-BOX) with an opening."""
    cv = Canvas(-2.4, 2.4, -2.4, 2.4, 220)
    h, w = cv.h, cv.w
    grain = np.sin(cv.Y * 90 + 8 * fbm(h, w, 811, scale=120, octaves=3) + 3 * fbm(h, w, 812, scale=25, octaves=2))
    horiz = (np.abs(cv.Y) > np.abs(cv.X))
    grain_v = np.sin(cv.X * 90 + 8 * fbm(h, w, 813, scale=120, octaves=3))
    g = np.where(horiz, grain, grain_v)
    base = np.array([0.30, 0.17, 0.09], F32)
    col = base[None, None, :] * (0.85 + 0.12 * g[..., None] + 0.08 * fbm(h, w, 814, scale=60, octaves=3)[..., None])
    hole = (np.abs(cv.X) < OPEN) & (np.abs(cv.Y) < OPEN)
    # painted gold beading round the opening + ochre border
    dist = np.maximum(np.abs(cv.X), np.abs(cv.Y)) - OPEN
    bead = np.clip(1 - np.abs(dist - 0.05) / 0.018, 0, 1)
    col = col * (1 - 0.8 * bead[..., None]) + np.array([0.62, 0.45, 0.18], F32) * 0.8 * bead[..., None]
    band = np.clip(1 - np.abs(dist - 0.13) / 0.03, 0, 1)
    col = col * (1 - 0.5 * band[..., None]) + np.array([0.45, 0.12, 0.08], F32) * 0.5 * band[..., None]
    alpha = (~hole).astype(F32)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
    # glow from the screen spilling onto the face near the opening
    spill = np.exp(-np.clip(dist, 0, None) / 0.22) * 0.8 + 0.12
    return cv, col.astype(F32), alpha, spill.astype(F32)


def wood_wall_tex(seed, n=512):
    h, w = n, n
    v = np.linspace(0, 1, w, dtype=F32)[None, :].repeat(h, 0)
    grain = np.sin(np.linspace(0, 60, h)[:, None] + 6 * fbm(h, w, seed, scale=90, octaves=3))
    col = np.array([0.34, 0.20, 0.11], F32)[None, None, :] * (0.85 + 0.12 * grain[..., None])
    return col.astype(F32), v   # v=0 at front edge, 1 at screen


def render(ps, aux, t):
    (scr_cv, scr_tr), frame, walls = aux
    c = cam(t)
    L = lamp(t)
    fl = flicker(t)
    C0 = cam_matrix(0.0, c)
    sc = C0[0, 0]
    trans = np.ones((H, W, 3), F32)
    near = np.ones((H, W), F32)
    rods = []
    for P in ps:
        d, M = P.matrix(t, L)
        a = warp(P.absorb, C0 @ M, (W, H))
        pen = LAMP_R * d / (S_L - d)
        sig = 0.55 * pen * sc
        if sig > 0.35:
            a = big_blur(a, sig)
        trans *= (1 - a)
        if d < 0.09:
            near *= 1 - a.max(-1)
        for (ap, hand, back) in getattr(P, 'rods', []):
            rods.append((P, d, ap, hand, back))
    # rods: thin bamboo sticks running from the puppet back and down to the puppeteer's hand
    for (P, d, ap, hand, back) in rods:
        dd, Mpl = P.place(t)
        A = Mpl @ unproj(P.d_rest) @ np.array([ap[0], ap[1], 1.0])
        if hand is None:
            hand = (ap[0] + 0.25, -2.2)
        B = unproj(P.d_rest) @ np.array([hand[0], hand[1], 1.0])
        B = Mpl @ B
        for s0 in np.linspace(0, 1, 7)[:-1]:
            s1 = s0 + 1 / 6
            pts, dm = [], None
            for s in (s0, s1):
                pw = A[:2] + (B[:2] - A[:2]) * s
                ds = dd + back * s
                k = S_L / (S_L - ds)
                p = L + (pw - L) * k
                pts.append(C0 @ np.array([p[0], p[1], 1.0]))
            dm = dd + back * (s0 + s1) / 2
            m = np.zeros((H, W), F32)
            th = max(1, int(round(0.011 * S_L / (S_L - dm) * sc)))
            cv2.line(m, (int(pts[0][0] * 4), int(pts[0][1] * 4)), (int(pts[1][0] * 4), int(pts[1][1] * 4)),
                     1.0, th, cv2.LINE_AA, shift=2)
            sig = 0.55 * LAMP_R * dm / (S_L - dm) * sc
            if sig > 0.35:
                m = cv2.GaussianBlur(m, (0, 0), sig)
            trans *= (1 - 0.92 * m)[..., None]
    # lamp: hot spot with reflector, falloff over the screen
    ys, xs = np.mgrid[0:H, 0:W].astype(F32)
    Ci = np.linalg.inv(C0)
    sx = Ci[0, 0] * xs + Ci[0, 2]
    sy = Ci[1, 1] * ys + Ci[1, 2]
    r2 = (sx - L[0]) ** 2 + (sy - L[1]) ** 2
    hot = (S_L ** 2 / (S_L ** 2 + r2)) ** 2.0 * (0.75 + 0.25 * np.exp(-r2 / 0.5))
    E = LAMP_COL[None, None, :] * (hot * fl * 1.9)[..., None] * trans
    # lighthouse beam: a small lantern just behind the screen, light through a swinging yellow-gel slot
    lx, ly = ps[-1].lantern
    th = np.deg2rad(14 - 26 * ease(t / DUR))
    dx, dy = sx - lx, sy - ly
    rr = np.sqrt(dx * dx + dy * dy) + 1e-4
    ang = np.arctan2(dy, dx) - th
    ang = (ang + np.pi) % (2 * np.pi) - np.pi
    half = np.deg2rad(6.5)
    wedge = smoothstep(half + np.deg2rad(2.5), half - np.deg2rad(1.0), np.abs(ang)) * (dx > 0)
    beam = wedge * np.exp(-rr / 1.4) * smoothstep(0.0, 0.06, rr) * (0.9 + 0.1 * fl)
    glow = np.exp(-rr / 0.06) * 0.8
    E += (beam * 1.1 + glow)[..., None] * np.array([1.0, 0.86, 0.42], F32) * near[..., None]
    # screen paper
    Mtex = C0 @ scr_cv.tex_matrix()
    st = warp(scr_tr, Mtex, (W, H), border=0.9)
    img = E * st[..., None]
    # scatter in the paper: the screen softens the image very slightly and glows
    img = 0.85 * img + 0.15 * cv2.GaussianBlur(img, (0, 0), 3.0)
    scr_mask = np.zeros((H, W), F32)
    q = [C0 @ np.array([x, y, 1]) for x, y in [(-OPEN, -OPEN), (OPEN, -OPEN), (OPEN, OPEN), (-OPEN, OPEN)]]
    cv2.fillPoly(scr_mask, [np.round(np.array([p[:2] for p in q]) * 16).astype(np.int32)], 1.0, cv2.LINE_AA, shift=4)
    img *= scr_mask[..., None]
    lum = float(img.mean()) * 1.0
    # inner walls of the box, lit by the screen's glow (brighter next to the screen)
    out = img.copy()
    Cf = cam_matrix(-BOX, c)
    wall_glow = LAMP_COL * fl * 0.9
    for (name, corners) in walls['quads']:
        tex, v = walls[name]
        src = np.float32([[0, 0], [tex.shape[1] - 1, 0], [tex.shape[1] - 1, tex.shape[0] - 1], [0, tex.shape[0] - 1]])
        dst = []
        for (x, y, z) in corners:
            Mz = cam_matrix(z, c)
            p = Mz @ np.array([x, y, 1.0])
            dst.append(p[:2])
        Hm = cv2.getPerspectiveTransform(src, np.float32(dst))
        shade = (0.10 + 0.9 * v ** 1.6)[..., None] * wall_glow[None, None, :]
        layer = cv2.warpPerspective(np.ascontiguousarray(tex * shade), Hm, (W, H), flags=cv2.INTER_LINEAR)
        mk = cv2.warpPerspective(np.ones(tex.shape[:2], F32), Hm, (W, H), flags=cv2.INTER_LINEAR)
        out = out * (1 - mk[..., None]) + layer
    # front face of the box, slightly defocused (focus is on the screen)
    fcv, fcol, falpha, fspill = frame
    Mf = Cf @ fcv.tex_matrix()
    col = warp(fcol * (fspill * fl * 0.9)[..., None], Mf, (W, H))
    a = warp(falpha, Mf, (W, H))
    sig = 0.6 * FOC * abs(1 / (-BOX - c[2]) - 1 / (0 - c[2])) * 1.2
    pm = big_blur(col * a[..., None], sig)
    a = big_blur(a, sig)
    out = out * (1 - a[..., None]) + pm
    return post(out, t)


def post(img, t):
    hi = np.clip(img - 0.7, 0, None)
    bloom = big_blur(hi, 22) * 0.7 + big_blur(hi, 6) * 0.5
    img = img + bloom
    # faint haze in the room in front of the screen
    img += big_blur(img, 60) * 0.08
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    r = np.sqrt((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / (W * 0.72)
    img *= (1 - 0.35 * r ** 2.2)[..., None]
    img = 1 - np.exp(-img * 1.5)
    img = img / (1 - np.exp(-1.5 * 1.2))
    g = cv2.GaussianBlur(rng(int(t * 1000) + 5).standard_normal((H, W)).astype(F32), (0, 0), 0.7)
    img += g[..., None] * 0.016
    return np.clip(img, 0, 1)


def build_aux():
    scr = make_screen_tex()
    frame = make_frame_tex()
    walls = {}
    for nm, sd in (('L', 901), ('R', 902), ('T', 903), ('B', 904)):
        walls[nm] = wood_wall_tex(sd)
    o, z0, z1 = OPEN, -BOX, 0.0
    # texture: x-axis = along the edge, y-axis = depth (row 0 at front, last row at screen)
    walls['quads'] = [
        ('L', [(-o, o, z0), (-o, -o, z0), (-o, -o, z1), (-o, o, z1)]),
        ('R', [(o, -o, z0), (o, o, z0), (o, o, z1), (o, -o, z1)]),
        ('T', [(o, o, z0), (-o, o, z0), (-o, o, z1), (o, o, z1)]),
        ('B', [(-o, -o, z0), (o, -o, z0), (o, -o, z1), (-o, -o, z1)]),
    ]
    # v should run along depth: rows of the texture
    for nm in 'LRTB':
        tex, _ = walls[nm]
        v = np.linspace(0, 1, tex.shape[0], dtype=F32)[:, None].repeat(tex.shape[1], 1)
        walls[nm] = (tex, v)
    return scr, frame, walls


def save(img, path):
    cv2.imwrite(path, (img[..., ::-1] * 255 + 0.5).astype(np.uint8))


if __name__ == '__main__':
    os.makedirs(FR, exist_ok=True)
    ps = build()
    aux = build_aux()
    frames = range(NF) if sys.argv[1] == 'all' else [int(a) for a in sys.argv[2:]]
    for f in frames:
        t0 = time.time()
        img = render(ps, aux, f / FPS)
        save(img, os.path.join(FR, f'f{f:03d}.png'))
        print(f'frame {f} {time.time() - t0:.2f}s', flush=True)
