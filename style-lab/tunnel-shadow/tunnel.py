"""Tunnel book / Victorian toy theatre: 14 painted paper flats, exact planar projection,
point-area lamp with cast shadows between flats, camera dolly + thin-lens depth of field."""
import sys, os, time
import numpy as np
import cv2
from common import *

W = H = 1080
FOCAL = 1296.0
FPS, DUR = 30, 3.0
NF = int(FPS * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, 'frames_tb')

LAMP = np.array([-1.15, 1.35, -3.5])      # front, above, left
LAMP_R = 0.12                            # lamp radius (penumbra)
KEY = np.array([1.0, 0.86, 0.66], F32) * 1.25
AMB = np.array([0.30, 0.30, 0.42], F32) * 0.5
PAPER = (0.93, 0.89, 0.80)
SH_DS = 4                                # shadow-map downscale


def cam(t):
    u = ease(t / DUR)
    return np.array([0.05 - 0.12 * u, 0.22 - 0.05 * u, 0.0 + 0.88 * u])


def ink_outline(cv, mask, seed, width=2.2, color=(0.12, 0.08, 0.07), strength=0.75):
    m8 = (mask > 0.5).astype(np.uint8)
    d = cv2.distanceTransform(m8, cv2.DIST_L2, 5).astype(F32)
    wv = width * (1 + 0.35 * fbm(cv.h, cv.w, seed, scale=60, octaves=2))
    band = np.clip(1.0 - np.abs(d - wv) / (wv * 0.7), 0, 1) * mask
    band *= np.clip(0.75 + 0.5 * fbm(cv.h, cv.w, seed + 1, scale=25, octaves=2), 0, 1)
    c = np.asarray(color, F32)
    cv.color = cv.color * (1 - strength * band[..., None]) + c * strength * band[..., None]


def hatch(cv, mask, seed, spacing=0.018, angle=-30, color=(0.1, 0.12, 0.16), strength=0.25):
    """Engraved-print style hatching, as on Victorian toy theatre sheets."""
    a = np.deg2rad(angle)
    u = cv.X * np.cos(a) + cv.Y * np.sin(a)
    wob = 0.004 * fbm(cv.h, cv.w, seed, scale=80, octaves=2)
    ph = ((u + wob) / spacing) % 1.0
    lines = np.clip(1 - np.abs(ph - 0.5) * 2 / 0.28, 0, 1)
    br = np.clip(0.5 + 0.6 * fbm(cv.h, cv.w, seed + 2, scale=40, octaves=2), 0, 1)
    band = lines * mask * br * strength
    c = np.asarray(color, F32)
    cv.color = cv.color * (1 - band[..., None]) + c * band[..., None]


class Layer:
    def __init__(self, name, z, ext, opacity=1.0, motion=None, extra_ppu=1.0):
        self.name, self.z, self.opacity = name, z, opacity
        ppu = min(640.0, FOCAL / (z - 0.88) * extra_ppu)
        self.cv = Canvas(*ext, ppu)
        self.motion = motion or (lambda t: np.eye(3))

    def bake(self):
        cv = self.cv
        self.color = np.ascontiguousarray(cv.color.astype(F32))
        self.alpha = np.ascontiguousarray(cv.alpha.astype(F32))
        self.emit = None if cv.emit is None else np.ascontiguousarray(cv.emit.astype(F32))
        sw, shh = max(4, cv.w // SH_DS), max(4, cv.h // SH_DS)
        self.alpha_s = cv2.resize(self.alpha, (sw, shh), interpolation=cv2.INTER_AREA)
        self.small = (sw, shh)
        self.tex = cv.tex_matrix()
        self.tex_s = self.tex @ S(cv.w / sw, cv.h / shh)
        ys, xs = np.mgrid[0:shh, 0:sw].astype(np.float64)
        self.grid_s = (xs, ys)


def ext_for(z, margin=0.35, extra=0.0):
    half = 0.4167 * z + margin + extra
    return (-half - 0.1, half + 0.1, 0.2 - half, 0.2 + half)


# ----------------------------------------------------------------------------- flats

def wave_crest(x, base, amp, k, phase):
    s = np.abs(np.sin(k * x + phase))
    return base + amp * (1 - s) ** 1.6 - amp * 0.3


def make_wave(name, z, base, amp, k, phase, rgb, seed, slide_amp, slide_ph, foam=0.8):
    e = ext_for(z, extra=0.25)
    L = Layer(name, z, (e[0], e[1], e[2], base + amp + 0.05),
              motion=lambda t: T(slide_amp * np.sin(2 * np.pi * t / 2.6 + slide_ph), 0))
    cv = L.cv
    xs = np.linspace(e[0], e[1], 600)
    crest = wave_crest(xs, base, amp, k, phase)
    pts = np.concatenate([np.stack([xs, crest], 1), [[e[1], e[2]], [e[0], e[2]]]])
    m = cv.mask(pts, cut_seed=seed, cut_amp=0.0025)
    cv.alpha = m
    cv.color[:] = PAPER
    # sea body gets darker with depth below the crest
    yc = np.interp(cv.X[0], xs, crest)[None, :]
    depth = np.clip((yc - cv.Y) / 0.5, 0, 1)
    paint(cv, m, rgb, seed + 1, style='gouache', angle=8)
    deep = np.asarray(rgb, F32) * 0.55
    cv.color = cv.color * (1 - 0.6 * depth[..., None]) + deep * 0.6 * depth[..., None]
    # paler wash under the crest
    band = np.clip(1 - (yc - cv.Y) / 0.09, 0, 1) * m
    paint(cv, band * 0.6, np.asarray(rgb) * 0.6 + 0.4 * np.array([0.75, 0.88, 0.85]), seed + 2,
          style='watercolour')
    hatch(cv, m * depth, seed + 3, spacing=0.02, angle=-12, strength=0.22)
    # foam: broken gouache dabs hugging the crest
    fn = fbm(cv.h, cv.w, seed + 4, scale=18, octaves=3)
    fb = np.clip(1 - (yc - cv.Y) / 0.035, 0, 1) * m
    foam_m = np.clip((fb - 0.25 + 0.5 * fn) * 3.0, 0, 1) * fb * foam
    paint(cv, foam_m, (0.96, 0.94, 0.86), seed + 5, style='gouache', angle=0)
    ink_outline(cv, m, seed + 6, width=2.0, color=(0.05, 0.1, 0.14), strength=0.6)
    finish_flat(cv, seed + 7)
    return L


def make_proscenium():
    z = 3.0
    L = Layer('proscenium', z, (-1.55, 1.55, -1.3, 1.6))
    cv = L.cv
    outer = cv.mask([(-1.5, -1.25), (1.5, -1.25), (1.5, 1.55), (-1.5, 1.55)], cut_seed=11, cut_amp=0.003)
    # arch opening with rounded shoulders
    a = np.linspace(0, np.pi, 80)
    top = np.stack([0.98 * np.cos(a), 0.62 + 0.36 * np.sin(a)], 1)
    opening = np.concatenate([[[0.98, -0.82]], top, [[-0.98, -0.82]]])
    hole = cv.mask(opening, cut_seed=12, cut_amp=0.003)
    # painted drapes hanging inside the arch (part of the same card)
    yy = np.linspace(0.95, -0.82, 60)
    lx = -0.98 + 0.28 * np.clip((yy - 0.15) / 0.8, 0, 1) ** 1.3 + 0.03 * np.sin(yy * 25)
    drapeL = np.concatenate([np.stack([lx, yy], 1), [[-1.1, -0.82], [-1.1, 0.95]]])
    drapeR = drapeL * np.array([-1, 1])
    xs = np.linspace(-1.0, 1.0, 200)
    sc = 0.86 - 0.07 * np.abs(np.sin(xs * np.pi * 2.5)) ** 0.7
    valance = np.concatenate([np.stack([xs, sc], 1), [[1.0, 1.1], [-1.0, 1.1]]])
    mD = np.maximum(cv.mask(drapeL, 13, 0.003), cv.mask(drapeR[::-1], 14, 0.003))
    mV = cv.mask(valance, 15, 0.003)
    body = np.clip(outer - hole, 0, 1)
    cv.alpha = np.clip(body + (mD + mV) * outer, 0, 1)
    cv.color[:] = PAPER
    paint(cv, body, (0.44, 0.11, 0.10), 21, angle=90)
    # gilded moulding around arch
    ring_out = cv.mask(np.concatenate([[[1.1, -0.95]], np.stack([1.1 * np.cos(a), 0.62 + 0.48 * np.sin(a)], 1),
                                       [[-1.1, -0.95]]]), 16, 0.002)
    gold = np.clip(ring_out - hole, 0, 1) * body
    paint(cv, gold, (0.78, 0.58, 0.24), 22, angle=0, vary=0.15)
    hatch(cv, gold, 23, spacing=0.012, angle=60, color=(0.35, 0.2, 0.05), strength=0.35)
    # pilasters
    for sx in (-1, 1):
        pil = cv.mask([(sx * 1.18, -1.25), (sx * 1.38, -1.25), (sx * 1.38, 1.1), (sx * 1.18, 1.1)], 30 + sx, 0.002)
        paint(cv, pil * body, (0.83, 0.70, 0.45), 31 + sx, angle=90)
        hatch(cv, pil * body, 32 + sx, spacing=0.014, angle=90, color=(0.4, 0.25, 0.1), strength=0.4)
        ink_outline(cv, pil * body, 33 + sx, width=2.0)
    # drapes: deep crimson with fold shading
    dr = (mD + mV) * outer
    paint(cv, dr, (0.55, 0.13, 0.13), 24, angle=90)
    folds = 0.5 + 0.5 * np.sin(cv.X * 38 + 3 * np.sin(cv.Y * 4))
    cv.color *= (1 - 0.35 * (folds * mD)[..., None])
    vf = 0.5 + 0.5 * np.sin(cv.X * 30)
    cv.color *= (1 - 0.3 * (vf * mV)[..., None])
    # gold fringe on valance
    fr = np.clip(1 - np.abs(cv.Y - (np.interp(cv.X[0], xs, sc)[None, :] + 0.02)) / 0.02, 0, 1) * mV
    paint(cv, fr, (0.85, 0.65, 0.25), 25, vary=0.2)
    ink_outline(cv, cv.alpha, 26, width=2.6)
    ink_outline(cv, mD, 27, width=2.0, strength=0.5)
    ink_outline(cv, mV, 28, width=2.0, strength=0.5)
    # lettered cartouche
    cart = cv.mask([(-0.32, 1.12), (0.32, 1.12), (0.36, 1.27), (0.32, 1.42), (-0.32, 1.42), (-0.36, 1.27)], 29, 0.002)
    paint(cv, cart * body, (0.88, 0.78, 0.55), 34)
    ink_outline(cv, cart * body, 35, width=2.0)
    txt = np.zeros((cv.h, cv.w), np.uint8)
    p0 = cv.to_px([(0.0, 1.22)])[0]
    fs, th = cv.ppu * 0.0026, max(1, int(cv.ppu * 0.006))
    (tw, _), _ = cv2.getTextSize('THEATRE ROYAL', cv2.FONT_HERSHEY_TRIPLEX, fs, th)
    cv2.putText(txt, 'THEATRE ROYAL', (int(p0[0] - tw / 2), int(p0[1])), cv2.FONT_HERSHEY_TRIPLEX,
                fs, 255, th, cv2.LINE_AA)
    tm = cv2.GaussianBlur(txt.astype(F32) / 255, (0, 0), 0.8) * body
    paint(cv, tm, (0.35, 0.08, 0.06), 37)
    finish_flat(cv, 36)
    return L


def make_cloud_border():
    z = 3.25
    e = ext_for(z, extra=0.1)
    L = Layer('clouds', z, (e[0], e[1], 0.55, e[3]))
    cv = L.cv
    xs = np.linspace(e[0], e[1], 400)
    bottom = 0.87 - 0.07 * np.abs(np.sin(xs * 4.2 + 0.5)) ** 0.6 - 0.04 * np.abs(np.sin(xs * 9.1 + 1.3)) ** 0.5
    bottom += 0.10 * np.clip(np.abs(xs) - 0.6, 0, None)
    m = cv.mask(np.concatenate([np.stack([xs, bottom], 1), [[e[1], e[3]], [e[0], e[3]]]]), 41, 0.003)
    cv.alpha = m
    cv.color[:] = PAPER
    paint(cv, m, (0.36, 0.30, 0.44), 42, style='watercolour', edge_dark=0.5)
    yb = np.interp(cv.X[0], xs, bottom)[None, :]
    rim = np.clip(1 - (cv.Y - yb) / 0.06, 0, 1) * m
    paint(cv, rim * 0.8, (0.92, 0.58, 0.52), 43, style='watercolour')
    hatch(cv, m * np.clip((cv.Y - yb) / 0.3, 0, 1), 44, spacing=0.016, angle=20, strength=0.25)
    ink_outline(cv, m, 45, width=2.0, color=(0.15, 0.1, 0.18))
    finish_flat(cv, 46)
    return L


def make_cliff():
    z = 3.95
    e = ext_for(z)
    L = Layer('cliff', z, (e[0], 0.0, e[2], 1.05))
    cv = L.cv
    prof = [(e[0], -1.5), (e[0], 0.08), (-1.3, 0.1), (-1.05, 0.04), (-0.62, 0.02), (-0.55, -0.05),
            (-0.48, -0.08), (-0.42, -0.2), (-0.36, -0.24), (-0.33, -0.38), (-0.25, -0.45), (-0.2, -1.5)]
    cliff = cv.mask(prof, 51, 0.006)
    # lighthouse tower + gallery + lantern + cap
    lx = -0.82
    tower = cv.mask([(lx - 0.085, 0.0), (lx + 0.085, 0.0), (lx + 0.058, 0.66), (lx - 0.058, 0.66)], 52, 0.0015)
    gallery = cv.mask([(lx - 0.085, 0.66), (lx + 0.085, 0.66), (lx + 0.085, 0.69), (lx - 0.085, 0.69)], 53, 0.001)
    lantern = cv.mask([(lx - 0.045, 0.69), (lx + 0.045, 0.69), (lx + 0.045, 0.8), (lx - 0.045, 0.8)], 54, 0.001)
    cap = cv.mask([(lx - 0.065, 0.8), (lx + 0.065, 0.8), (lx, 0.9)], 55, 0.001)
    keeper = cv.mask([(lx + 0.06, 0.0), (lx + 0.26, 0.0), (lx + 0.26, 0.11), (lx + 0.16, 0.18),
                      (lx + 0.06, 0.11)], 56, 0.0015)
    house = np.maximum.reduce([tower, gallery, lantern, cap, keeper])
    cv.alpha = np.maximum(cliff, house)
    cv.color[:] = PAPER
    paint(cv, cliff, (0.42, 0.30, 0.24), 57, angle=70)
    strata = 0.5 + 0.5 * np.sin(cv.Y * 60 + 6 * fbm(cv.h, cv.w, 58, scale=90, octaves=2))
    cv.color *= (1 - 0.18 * (strata * cliff)[..., None])
    grass = cliff * np.clip(1 - (0.1 - cv.Y) / 0.06, 0, 1) * (cv.X < -0.5)
    paint(cv, grass, (0.32, 0.42, 0.24), 59, angle=0)
    hatch(cv, cliff, 60, spacing=0.016, angle=-55, color=(0.12, 0.07, 0.06), strength=0.35)
    # stripes on the tower
    stripes = tower * ((np.floor(cv.Y / 0.11) % 2) == 1)
    paint(cv, tower, (0.92, 0.88, 0.78), 61, angle=90)
    paint(cv, stripes.astype(F32), (0.70, 0.14, 0.12), 62, angle=0)
    shade = np.clip((cv.X - lx) / 0.08, 0, 1) * tower
    cv.color *= (1 - 0.35 * shade[..., None])
    paint(cv, np.maximum(gallery, cap), (0.16, 0.14, 0.14), 63)
    paint(cv, keeper, (0.86, 0.80, 0.68), 64)
    roof = keeper * (cv.Y > 0.11)
    paint(cv, roof, (0.45, 0.18, 0.14), 65)
    # lantern glass glows (pierced + tissue backed)
    paint(cv, lantern, (1.0, 0.86, 0.5), 66)
    for m_ in (tower, keeper, cliff, lantern, gallery, cap):
        ink_outline(cv, m_, 67, width=1.8, strength=0.7)
    em = np.zeros((cv.h, cv.w, 3), F32)
    em += lantern[..., None] * np.array([1.4, 1.05, 0.55], F32)
    win = cv.mask([(lx + 0.10, 0.03), (lx + 0.14, 0.03), (lx + 0.14, 0.08), (lx + 0.10, 0.08)], 68, 0.001)
    em += win[..., None] * np.array([0.9, 0.6, 0.3], F32)
    paint(cv, win, (1.0, 0.8, 0.45), 69)
    cv.emit = em
    finish_flat(cv, 70)
    return L


LAMP_PIV = (-0.82, 0.745)


def make_beam():
    z = 4.02
    L = Layer('beam', z, (-0.9, 2.4, -0.3, 1.5), opacity=0.22,
              motion=lambda t: rot_about(16 - 30 * ease(t / DUR), *LAMP_PIV))
    cv = L.cv
    px, py = LAMP_PIV
    ang = np.deg2rad(4.0)
    Ln = 2.6
    pts = [(px, py - 0.02), (px + Ln * np.cos(ang), py - Ln * np.sin(ang) * 0.9 - 0.0),
           (px + Ln * np.cos(-ang * 3), py + Ln * np.sin(ang * 3)), (px, py + 0.02)]
    pts = [(px, py - 0.025), (px + Ln, py - 0.17), (px + Ln, py + 0.23), (px, py + 0.025)]
    m = cv.mask(pts, 71, 0.002)
    dist = np.clip((cv.X - px) / Ln, 0, 1)
    fade = (1 - dist) ** 1.3
    cv.alpha = m * (0.42 * fade + 0.04)
    cv.color[:] = (1.0, 0.92, 0.66)
    paint(cv, m, (1.0, 0.90, 0.62), 72, style='watercolour', vary=0.2)
    cv.emit = (m * fade ** 1.2)[..., None] * np.array([1.6, 1.2, 0.6], F32)
    finish_flat(cv, 73, rim=False, bump=0.2)
    return L


BOAT_C = (0.42, -0.5)


def make_boat():
    z = 3.6
    bx, by = BOAT_C
    def mot(t):
        ph = 2 * np.pi * t / 1.45
        return T(0.015 * np.sin(ph * 0.5), 0.022 * np.sin(ph)) @ rot_about(5.5 * np.sin(ph + 1.1), bx, by - 0.05)
    L = Layer('boat', z, (bx - 0.3, bx + 0.3, -1.6, by + 0.45), motion=mot)
    cv = L.cv
    hull = cv.mask([(bx - 0.2, by + 0.04), (bx + 0.21, by + 0.05), (bx + 0.15, by - 0.06), (bx - 0.14, by - 0.06)], 81, 0.0015)
    stripe = hull * (np.abs(cv.Y - (by + 0.02)) < 0.008)
    mast = cv.mask([(bx - 0.006, by + 0.03), (bx + 0.006, by + 0.03), (bx + 0.004, by + 0.36), (bx - 0.004, by + 0.36)], 82, 0.0005)
    sail = cv.mask([(bx + 0.012, by + 0.34), (bx + 0.012, by + 0.07), (bx + 0.19, by + 0.07)], 83, 0.0015)
    jib = cv.mask([(bx - 0.012, by + 0.31), (bx - 0.012, by + 0.08), (bx - 0.15, by + 0.08)], 84, 0.0015)
    flag = cv.mask([(bx, by + 0.36), (bx + 0.06, by + 0.345), (bx, by + 0.33)], 85, 0.001)
    stick = cv.mask([(bx - 0.012, by - 0.05), (bx + 0.012, by - 0.05), (bx + 0.01, -1.6), (bx - 0.01, -1.6)], 86, 0.0008)
    cv.alpha = np.maximum.reduce([hull, mast, sail, jib, flag, stick])
    cv.color[:] = PAPER
    paint(cv, hull, (0.55, 0.16, 0.10), 87, angle=0)
    paint(cv, stripe.astype(F32), (0.9, 0.82, 0.55), 88)
    paint(cv, np.maximum(sail, jib), (0.94, 0.90, 0.80), 89, angle=80, vary=0.05)
    cv.color *= (1 - 0.15 * (np.clip((cv.Y - by - 0.07) / 0.27, 0, 1) * sail)[..., None])
    paint(cv, mast, (0.3, 0.2, 0.12), 90)
    paint(cv, flag, (0.75, 0.2, 0.15), 91)
    paint(cv, stick, (0.62, 0.48, 0.30), 92, angle=90)
    for m_ in (hull, sail, jib):
        ink_outline(cv, m_, 93, width=1.6)
    finish_flat(cv, 94)
    return L


WH_C = (0.55, -0.62)


def make_whale():
    z = 4.3
    cx, cy = WH_C
    def mot(t):
        u = ease((t - 0.25) / 2.35)
        return T(0.06 * u, 0.40 * u) @ rot_about(-7 + 10 * u, cx, cy)
    L = Layer('whale', z, (cx - 0.75, cx + 0.75, -1.9, cy + 0.55), motion=mot)
    cv = L.cv
    rel = [(-0.58, -0.12), (-0.52, -0.02), (-0.38, 0.06), (-0.15, 0.10), (0.08, 0.08), (0.25, 0.04),
           (0.36, 0.06), (0.43, 0.13), (0.46, 0.21), (0.38, 0.29), (0.31, 0.37), (0.44, 0.34), (0.52, 0.29),
           (0.60, 0.34), (0.74, 0.37), (0.67, 0.28), (0.57, 0.21), (0.53, 0.10), (0.46, -0.02), (0.38, -0.12),
           (0.20, -0.20), (-0.10, -0.24), (-0.40, -0.22), (-0.55, -0.17)]
    body_pts = chaikin(np.array(rel) + np.array([cx, cy]), 3)
    body = cv.mask(body_pts, 101, 0.002)
    back_x = np.linspace(cx - 0.6, cx + 0.8, 50)
    back_y = np.interp(back_x, [cx - 0.58, cx - 0.38, cx - 0.15, cx + 0.08, cx + 0.25, cx + 0.8],
                       [cy - 0.1, cy + 0.06, cy + 0.10, cy + 0.08, cy + 0.04, cy + 0.04])
    fin = cv.mask([(cx - 0.28, cy - 0.12), (cx - 0.16, cy - 0.2), (cx - 0.22, cy - 0.1)], 102, 0.0015)
    stick = cv.mask([(cx - 0.11, cy - 0.15), (cx - 0.085, cy - 0.15), (cx - 0.09, -1.9), (cx - 0.11, -1.9)], 103, 0.0008)
    cv.alpha = np.maximum.reduce([body, fin, stick])
    cv.color[:] = PAPER
    paint(cv, body, (0.25, 0.30, 0.38), 104, angle=10)
    back_line = np.interp(cv.X[0], back_x, back_y)[None, :]
    belly = body * np.clip((back_line - cv.Y - 0.2) / 0.06, 0, 1) * (cv.X < cx + 0.3)
    paint(cv, belly, (0.78, 0.76, 0.70), 105, style='watercolour')
    hatch(cv, body * np.clip((back_line - cv.Y) / 0.15, 0, 1), 106, spacing=0.012, angle=25, strength=0.3)
    paint(cv, fin, (0.2, 0.24, 0.3), 107)
    # barnacle dabs
    bn = np.clip((fbm(cv.h, cv.w, 108, scale=8, octaves=2) - 0.55) * 6, 0, 1) * body
    paint(cv, bn * 0.6, (0.85, 0.82, 0.75), 109)
    eye = cv.circle_mask(cx - 0.45, cy - 0.08, 0.012)
    paint(cv, eye, (0.08, 0.06, 0.06), 110)
    paint(cv, stick, (0.6, 0.47, 0.30), 111, angle=90)
    ink_outline(cv, body, 112, width=1.8)
    finish_flat(cv, 113)
    return L


def make_far_sea():
    z = 4.55
    e = ext_for(z)
    L = Layer('farsea', z, (e[0], e[1], e[2], -0.05), motion=lambda t: T(0.03 * np.sin(2 * np.pi * t / 2.6 + 2.0), 0))
    cv = L.cv
    xs = np.linspace(e[0], e[1], 500)
    crest = -0.20 + 0.025 * (1 - np.abs(np.sin(xs * 7 + 1))) ** 1.5
    m = cv.mask(np.concatenate([np.stack([xs, crest], 1), [[e[1], e[2]], [e[0], e[2]]]]), 121, 0.002)
    cv.alpha = m
    cv.color[:] = PAPER
    paint(cv, m, (0.30, 0.36, 0.52), 122, style='watercolour')
    glint = m * np.clip(1 - np.abs(cv.X - 0.9) / 0.5, 0, 1) * (0.5 + 0.5 * np.sin(cv.Y * 260))
    paint(cv, glint * 0.5, (0.9, 0.75, 0.62), 123, style='gouache', angle=0)
    ink_outline(cv, m, 124, width=1.6, strength=0.45, color=(0.1, 0.1, 0.2))
    finish_flat(cv, 125)
    return L


def make_horizon():
    z = 4.7
    e = ext_for(z)
    L = Layer('horizon', z, (e[0], e[1], e[2], 0.25))
    cv = L.cv
    hz = -0.12
    sea = cv.mask([(e[0], hz), (e[1], hz), (e[1], e[2]), (e[0], e[2])], 131, 0.0015)
    isle = cv.mask([(1.05, hz), (1.25, -0.02), (1.42, 0.03), (1.6, 0.0), (1.85, -0.06), (2.0, hz)], 132, 0.004)
    cv.alpha = np.maximum(sea, isle)
    cv.color[:] = PAPER
    paint(cv, sea, (0.44, 0.40, 0.56), 133, style='watercolour')
    refl = sea * np.clip(1 - np.abs(cv.X - 0.95) / 0.35, 0, 1) * np.clip(1 - (hz - cv.Y) / 0.3, 0, 1)
    paint(cv, refl * 0.7, (0.95, 0.80, 0.62), 134, style='watercolour')
    paint(cv, isle, (0.30, 0.25, 0.38), 135, style='watercolour')
    ink_outline(cv, isle, 136, width=1.5, strength=0.4)
    finish_flat(cv, 137)
    return L


MOON = (0.95, 0.70, 0.18)


def make_moon():
    z = 4.8
    mx, my, r = MOON
    L = Layer('moon', z, (mx - 0.3, mx + 0.3, my - 0.3, my + 0.75),
              motion=lambda t: rot_about(1.2 * np.sin(2 * np.pi * t / 3.0), mx, my + 0.7))
    cv = L.cv
    disc = cv.circle_mask(mx, my, r, cut_seed=141, cut_amp=0.002)
    wire = cv.mask([(mx - 0.002, my + r - 0.01), (mx + 0.002, my + r - 0.01), (mx + 0.002, my + 0.75), (mx - 0.002, my + 0.75)])
    cv.alpha = np.maximum(disc, wire * 0.9)
    cv.color[:] = PAPER
    paint(cv, disc, (0.97, 0.92, 0.76), 142, style='watercolour')
    mare = np.clip(fbm(cv.h, cv.w, 143, scale=22, octaves=3) * 1.4 - 0.2, 0, 1) * disc
    paint(cv, mare * 0.6, (0.80, 0.74, 0.62), 144, style='watercolour', edge_dark=0.6)
    paint(cv, wire, (0.35, 0.33, 0.3), 145)
    cv.emit = disc[..., None] * np.array([0.75, 0.68, 0.52], F32) * \
        (0.85 + 0.15 * fbm(cv.h, cv.w, 146, scale=30, octaves=2))[..., None]
    finish_flat(cv, 147, bump=0.15)
    return L


def make_sky():
    z = 4.95
    e = ext_for(z, extra=0.2)
    L = Layer('sky', z, e)
    cv = L.cv
    full = np.ones((cv.h, cv.w), F32)
    cv.alpha = full
    cv.color[:] = PAPER
    y = cv.Y
    stops = [(-0.2, (0.99, 0.80, 0.56)), (0.05, (0.95, 0.62, 0.50)), (0.35, (0.62, 0.42, 0.55)),
             (0.8, (0.32, 0.27, 0.48)), (1.6, (0.14, 0.15, 0.32))]
    ys = np.array([s[0] for s in stops])
    col = np.stack([np.interp(y, ys, [s[1][c] for s in stops]) for c in range(3)], -1).astype(F32)
    wob = fbm(cv.h, cv.w, 151, scale=120, octaves=4)
    col *= (1 + 0.06 * wob[..., None])
    cv.color = col
    # watercolour cloud streaks
    streak = np.clip(fbm(cv.h, cv.w, 152, scale=160, octaves=4) * 1.5 - 0.1, 0, 1)
    streak *= np.clip(1 - np.abs(cv.Y - 0.35) / 0.35, 0, 1)
    streak = cv2.resize(cv2.resize(streak, (cv.w, cv.h // 6)), (cv.w, cv.h))
    paint(cv, streak * 0.7, (0.78, 0.48, 0.55), 153, style='watercolour', edge_dark=0.6)
    # pin-pricked stars, backlit
    r = rng(154)
    em = np.zeros((cv.h, cv.w, 3), F32)
    for _ in range(70):
        sx, sy = r.uniform(e[0], e[1]), r.uniform(0.45, e[3])
        px = cv.to_px([(sx, sy)])[0]
        s = r.uniform(0.5, 1.0) * np.clip((sy - 0.45) / 0.5, 0.2, 1)
        cv2.circle(em, (int(px[0]), int(px[1])), int(r.integers(1, 3)), (s, s * 0.95, s * 0.8), -1, cv2.LINE_AA)
    cv.emit = cv2.GaussianBlur(em, (0, 0), 0.6) * 1.6
    finish_flat(cv, 155, rim=False, bump=0.14)
    return L


def build():
    t0 = time.time()
    layers = [
        make_proscenium(),
        make_cloud_border(),
        make_wave('waveA', 3.45, -0.58, 0.07, 3.1, 0.2, (0.10, 0.24, 0.33), 201, 0.09, 0.0),
        make_boat(),
        make_wave('waveB', 3.75, -0.47, 0.06, 3.8, 1.3, (0.13, 0.31, 0.40), 211, 0.08, np.pi),
        make_cliff(),
        make_beam(),
        make_wave('waveC', 4.15, -0.38, 0.05, 4.6, 2.1, (0.17, 0.36, 0.46), 221, 0.07, 0.6),
        make_whale(),
        make_wave('waveD', 4.42, -0.29, 0.04, 5.5, 0.7, (0.22, 0.40, 0.52), 231, 0.06, np.pi + 0.6, foam=0.6),
        make_far_sea(),
        make_horizon(),
        make_moon(),
        make_sky(),
    ]
    for L in layers:
        L.bake()
    print(f'built {len(layers)} flats in {time.time() - t0:.1f}s', flush=True)
    return layers


# ----------------------------------------------------------------------------- render

def cam_matrix(z, c):
    s = FOCAL / (z - c[2])
    return np.array([[s, 0, W / 2 - s * c[0]], [0, -s, H / 2 + s * c[1]], [0, 0, 1]])


def light_proj(zi, zj):
    k = (zj - LAMP[2]) / (zi - LAMP[2])
    return np.array([[k, 0, LAMP[0] * (1 - k)], [0, k, LAMP[1] * (1 - k)], [0, 0, 1]])


def irradiance(layers, j, t, mot):
    Lj = layers[j]
    sw, shh = Lj.small
    Tm = np.ones((shh, sw), F32)
    inv_j = np.linalg.inv(mot[j] @ Lj.tex_s)
    for i in range(j):
        Li = layers[i]
        if Li.z >= Lj.z - 1e-6:
            continue
        M = inv_j @ light_proj(Li.z, Lj.z) @ mot[i] @ Li.tex_s
        a = warp(Li.alpha_s, M, (sw, shh))
        pen = LAMP_R * (Lj.z - Li.z) / (Li.z - LAMP[2])          # world units
        sig = pen * Lj.cv.ppu / (Lj.cv.w / sw) * 0.5
        if sig > 0.3:
            a = cv2.GaussianBlur(a, (0, 0), sig)
        Tm *= (1 - Li.opacity * a)
    xs, ys = Lj.grid_s
    Mw = mot[j] @ Lj.tex_s
    wx = Mw[0, 0] * xs + Mw[0, 1] * ys + Mw[0, 2]
    wy = Mw[1, 0] * xs + Mw[1, 1] * ys + Mw[1, 2]
    dx, dy, dz = wx - LAMP[0], wy - LAMP[1], Lj.z - LAMP[2]
    r2 = dx * dx + dy * dy + dz * dz
    cosv = dz / np.sqrt(r2)
    # spot cone aimed at stage centre + mild distance falloff
    aim = np.array([0.0, 0.0, 4.0]) - LAMP
    aim /= np.linalg.norm(aim)
    cang = (dx * aim[0] + dy * aim[1] + dz * aim[2]) / np.sqrt(r2)
    spot = smoothstep(0.93, 0.995, cang) * 0.75 + 0.25
    fall = (6.5 ** 2 / r2) ** 0.5
    key = (Tm * cosv * spot * fall).astype(F32)
    E = AMB[None, None, :] + KEY[None, None, :] * key[..., None]
    return E


def render(layers, t):
    c = cam(t)
    mot = [L.motion(t) for L in layers]
    focus = 4.1 - c[2]
    out = np.zeros((H, W, 3), F32)
    glow = np.zeros((H, W, 3), F32)
    for j in range(len(layers) - 1, -1, -1):
        L = layers[j]
        Mtex = cam_matrix(L.z, c) @ mot[j] @ L.tex
        col = warp(L.color, Mtex, (W, H))
        a = warp(L.alpha, Mtex, (W, H))
        E = irradiance(layers, j, t, mot)
        Es = warp(E, cam_matrix(L.z, c) @ mot[j] @ L.tex_s, (W, H))
        lit = col * Es
        if L.emit is not None:
            em = warp(L.emit, Mtex, (W, H))
            lit += em
            glow = glow * (1 - a[..., None]) + em * a[..., None]
        else:
            glow *= (1 - a[..., None])
        pm = lit * a[..., None]
        d = L.z - c[2]
        sig = 0.05 * FOCAL * abs(1 / d - 1 / focus)
        if sig > 0.4:
            pm = cv2.GaussianBlur(pm, (0, 0), sig)
            a = cv2.GaussianBlur(a, (0, 0), sig)
        out = out * (1 - a[..., None]) + pm
    return post(out, glow, t)


def post(img, glow, t):
    # halation / bloom from backlit pieces and highlights
    hi = np.clip(img - 0.85, 0, None) + glow * 0.6
    bloom = cv2.GaussianBlur(hi, (0, 0), 18) * 0.6 + cv2.GaussianBlur(hi, (0, 0), 5) * 0.4
    img = img + bloom * 0.9
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    r = np.sqrt((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / (W * 0.72)
    img *= (1 - 0.38 * r ** 2.2)[..., None]
    # filmic tone + warm grade
    img = img * np.array([1.03, 1.0, 0.94], F32)
    img = 1 - np.exp(-img * 1.35)
    img = img / (1 - np.exp(-1.35 * 1.15))
    g = rng(int(t * 1000) + 7).standard_normal((H, W)).astype(F32)
    g = cv2.GaussianBlur(g, (0, 0), 0.7)
    img += g[..., None] * 0.018
    return np.clip(img, 0, 1)


def save(img, path):
    cv2.imwrite(path, (img[..., ::-1] * 255 + 0.5).astype(np.uint8))


if __name__ == '__main__':
    os.makedirs(FR, exist_ok=True)
    layers = build()
    frames = range(NF) if sys.argv[1] == 'all' else [int(a) for a in sys.argv[2:]]
    for f in frames:
        t0 = time.time()
        img = render(layers, f / FPS)
        save(img, os.path.join(FR, f'f{f:03d}.png'))
        print(f'frame {f} {time.time() - t0:.2f}s', flush=True)
