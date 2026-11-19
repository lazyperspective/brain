"""Tiles: the top and right of the outer ring - Eiffel, Everest, Fuji, Ha Long."""
import math

import numpy as np

from .core import W, ZS, SLAB, smooth_poly, Wave
from .pal import *  # noqa
from . import props as pr
from .props import person, tree, crowd, grove, water, walker, bobber, cruise, runner, stroll
from .tiles_a import sm, sea_wall, ARCH_DK, lerp3


# ============================================================== EIFFEL ====
def eiffel(T):
    T.slab(GRASS, EARTH)
    r = T.rng
    PAVE = (238, 231, 216)
    with T.st('ground'):
        T.poly([(0.0, 0.25), (0.65, 0.25), (0.65, 0.61), (0.0, 0.61)], PAVE, 0.34)          # esplanade
        T.poly([(0.56, 0.0), (0.65, 0.0), (0.65, 1.0), (0.56, 1.0)], PAVE, 0.34)            # quay
        T.poly([(0.79, 0.0), (0.84, 0.0), (0.84, 1.0), (0.79, 1.0)], PAVE, 0.34)
        T.poly([(0.0, 0.82), (0.56, 0.82), (0.56, 0.90), (0.0, 0.90)], (226, 220, 208), 0.34)  # street
        for (a, b, c_, d_) in ((0.02, 0.29, 0.10, 0.40), (0.13, 0.29, 0.21, 0.40), (0.02, 0.46, 0.10, 0.57), (0.13, 0.46, 0.21, 0.57)):
            T.poly([(a, b), (c_, b), (c_, d_), (a, d_)], GRASS, 0.3)
    T.tufts([(0, 0), (0.55, 0), (0.55, 0.24), (0, 0.24)], 26)
    T.tufts([(0.85, 0), (1, 0), (1, 1), (0.85, 1)], 20)
    water(T, [(0.65, 0), (0.79, 0), (0.79, 1), (0.65, 1)], src=(0.72, 0.0), marks=18, t0=0.28, flow=(0, 1))
    T.wall_water('L', 0.65, 0.79)

    T.mark('ground')
    # ---- far bank: Haussmann blocks under zinc roofs, Trocadero pool
    def haussmann(u0, v0, du, dv, h, axis='v'):
        with T.grp('rise', t0=0.44 + 0.3 * r.random(), dur=0.32, pivot=T.P(u0 + du / 2, v0 + dv / 2), stage='struct', ink_now=True, under=PAPER):
            STN = (246, 236, 214)
            T.box(u0, v0, du, dv, h, c=STN, ink=0.42, guide=False)
            nu, nv = max(2, int(du / 0.02)), max(2, int(dv / 0.02))
            gf = h * 0.26                                           # ground floor: shopfronts under awnings
            T.rects('L', u0, u0 + du, v0 + dv, 0.004, gf - 0.004, nu, 1, fill=(92, 110, 140), ink=0.14, fw=0.62, fh=1.0, arch=True)
            T.rects('R', v0, v0 + dv, u0 + du, 0.004, gf - 0.004, nv, 1, fill=(76, 94, 124), ink=0.14, fw=0.62, fh=1.0, arch=True)
            T.rects('L', u0, u0 + du, v0 + dv, gf + 0.004, h - 0.004, nu, 3, fill=(150, 176, 210), ink=0.14, fw=0.46, fh=0.68)
            T.rects('R', v0, v0 + dv, u0 + du, gf + 0.004, h - 0.004, nv, 3, fill=(128, 154, 190), ink=0.14, fw=0.46, fh=0.68)
            fl = (h - gf) / 3.0
            lines = []
            for q in range(3):                                     # string courses and wrought-iron balconies
                zz = gf + fl * q
                lines.append([(u0, v0 + dv, zz), (u0 + du, v0 + dv, zz)])
                lines.append([(u0 + du, v0, zz), (u0 + du, v0 + dv, zz)])
            lines.append([(u0, v0 + dv, h - 0.003), (u0 + du, v0 + dv, h - 0.003)])
            T.lines(lines, 0.22, shade(STN, 0.7), stage='detail')
            T.lines([[(u0 + du * (k + 0.5) / nu - 0.004, v0 + dv, gf + fl + 0.006), (u0 + du * (k + 0.5) / nu + 0.004, v0 + dv, gf + fl + 0.006)] for k in range(nu)] +
                    [[(u0 + du, v0 + dv * (k + 0.5) / nv - 0.004, gf + fl + 0.006), (u0 + du, v0 + dv * (k + 0.5) / nv + 0.004, gf + fl + 0.006)] for k in range(nv)], 0.5, DARK, stage='detail')
            m = 0.012
            z = h
            T.poly([(u0, v0 + dv, z), (u0 + du, v0 + dv, z), (u0 + du - m, v0 + dv - m, z + 0.022), (u0 + m, v0 + dv - m, z + 0.022)], ZINC, 0.38)
            T.poly([(u0 + du, v0, z), (u0 + du, v0 + dv, z), (u0 + du - m, v0 + dv - m, z + 0.022), (u0 + du - m, v0 + m, z + 0.022)], shade(ZINC, 0.84), 0.38)
            T.poly([(u0 + m, v0 + m, z + 0.022), (u0 + du - m, v0 + m, z + 0.022), (u0 + du - m, v0 + dv - m, z + 0.022), (u0 + m, v0 + dv - m, z + 0.022)],
                   shade(ZINC, 1.1), 0.34)
            for k in range(nu):                                    # dormers in the mansard
                a_ = u0 + du * (k + 0.5) / nu
                T.poly([(a_ - 0.004, v0 + dv - m * 0.45, z + 0.006), (a_ + 0.004, v0 + dv - m * 0.45, z + 0.006), (a_ + 0.004, v0 + dv - m * 0.45, z + 0.017), (a_ - 0.004, v0 + dv - m * 0.45, z + 0.017)],
                       MARBLE, 0.18, stage='detail')
            for q in (0.25, 0.75):
                T.box(u0 + du * q - 0.006, v0 + dv * 0.5 - 0.006, 0.012, 0.012, 0.016, z=z + 0.022, c=TERRA, ink=0.26, guide=False)
                T.lines([[(u0 + du * q - 0.003, v0 + dv * 0.5 + 0.006, z + 0.038), (u0 + du * q - 0.003, v0 + dv * 0.5 + 0.006, z + 0.044)],
                         [(u0 + du * q + 0.003, v0 + dv * 0.5 + 0.006, z + 0.038), (u0 + du * q + 0.003, v0 + dv * 0.5 + 0.006, z + 0.044)]], 0.5, TERRA_D, stage='detail')
    haussmann(0.86, 0.03, 0.11, 0.13, 0.085)
    haussmann(0.86, 0.19, 0.11, 0.12, 0.07)
    with T.st('ground'):
        T.poly([(0.86, 0.36), (0.97, 0.36), (0.97, 0.50), (0.86, 0.50)], PAVE, 0.3)
    water(T, [(0.875, 0.375), (0.955, 0.375), (0.955, 0.485), (0.875, 0.485)], src=(0.915, 0.43), c=WATER_L, marks=3, t0=0.5, dur=0.3, shore=0.34)

    # ---- back row behind the tower
    haussmann(0.04, 0.03, 0.14, 0.10, 0.075)
    haussmann(0.22, 0.03, 0.13, 0.10, 0.09)
    haussmann(0.39, 0.03, 0.13, 0.10, 0.07)
    for (a, b) in ((0.03, 0.19), (0.12, 0.19), (0.21, 0.19), (0.50, 0.19), (0.30, 0.19), (0.40, 0.19)):
        tree(T, a, b, 0.9, FOREST, 'round')

    # ---- bridge
    T.poly([(0.635, 0.455, 0), (0.805, 0.455, 0), (0.805, 0.455, 0.028), (0.635, 0.455, 0.028)], (236, 226, 206), 0.4)
    for ac in (0.685, 0.72, 0.755):
        T.arch('L', ac, 0.455, 0.0, 0.03, 0.022, fill=DEEP)
    T.box(0.625, 0.395, 0.19, 0.06, 0.008, z=0.028, c=(240, 232, 214), ink=0.4, guide=True)

    # ---- THE TOWER
    cu, cv = 0.40, 0.43
    ctrl = [(0.0, 0.135), (0.07, 0.108), (0.14, 0.082), (0.155, 0.08), (0.22, 0.060), (0.29, 0.044), (0.31, 0.042), (0.42, 0.027), (0.55, 0.017),
            (0.68, 0.010), (0.76, 0.0075)]

    def hw(z):
        for k in range(len(ctrl) - 1):
            if ctrl[k][0] <= z <= ctrl[k + 1][0]:
                t_ = (z - ctrl[k][0]) / (ctrl[k + 1][0] - ctrl[k][0])
                return ctrl[k][1] + (ctrl[k + 1][1] - ctrl[k][1]) * t_
        return ctrl[-1][1]

    def fpt(face, a, z):
        """a in -1..1 across the face at height z"""
        w = hw(z)
        if face == 'L':
            return (cu + a * w, cv + w, z)
        if face == 'R':
            return (cu + w, cv + a * w, z)
        if face == 'BL':
            return (cu - w, cv + a * w, z)
        return (cu + a * w, cv - w, z)

    def section(face, z0, z1, col, leg=None, arch_h=None, ink=0.42, lattice=True):
        zs = np.linspace(z0, z1, 7)
        left = [fpt(face, -1, z) for z in zs]
        right = [fpt(face, 1, z) for z in zs]
        if leg:
            inner = []
            for k in range(11):
                a = -1 + leg + (2 - 2 * leg) * k / 10
                zz = z0 + (arch_h - z0) * math.sin(math.pi * k / 10) ** 0.75
                inner.append(fpt(face, a * (hw(z0) / hw(zz)) if False else a, zz))
            pts = left + right[::-1] + [fpt(face, 1 - leg * 0.0, z0)] + inner[::-1]
            pts = left + right[::-1] + inner[::-1]
        else:
            pts = left + right[::-1]
        T.poly(pts, col, ink)
        if lattice:
            segs = []
            n = max(2, int((z1 - z0) / 0.045))
            for k in range(n):
                za, zb = z0 + (z1 - z0) * k / n, z0 + (z1 - z0) * (k + 1) / n
                if leg and zb < arch_h + 0.01:
                    for sgn in (-1, 1):
                        segs.append([fpt(face, sgn * 1.0, za), fpt(face, sgn * (1 - leg), zb)])
                        segs.append([fpt(face, sgn * (1 - leg), za), fpt(face, sgn * 1.0, zb)])
                    continue
                segs.append([fpt(face, -1, za), fpt(face, 1, zb)])
                segs.append([fpt(face, 1, za), fpt(face, -1, zb)])
                segs.append([fpt(face, -1, zb), fpt(face, 1, zb)])
            T.lines(segs, 0.2, shade(col, 0.72), stage='detail')

    A0, A1, A2 = ACCENT, ACCENT_D, shade(ACCENT_D, 0.86)
    # pencil: axis with ticks, footprint, the taper envelope
    T.guide_axis(cu, cv, 0.86, ticks=12, r=None).tp = 0.04
    g = T.guide([[fpt('L', -1, 0), fpt('L', 1, 0)], [fpt('R', -1, 0), fpt('R', 1, 0)], [fpt('BL', -1, 0), fpt('BL', 1, 0)], [fpt('BR', -1, 0), fpt('BR', 1, 0)],
                 [fpt('L', -1, 0), (cu, cv, 0.80)], [fpt('L', 1, 0), (cu, cv, 0.80)], [fpt('R', -1, 0), (cu, cv, 0.80)]], ticks=4, over=0.05)
    g.tp = 0.10
    g.te = 0.95
    with T.grp('tower', t0=0.40, dur=0.36, pivot=T.P(cu, cv), stage='struct', ink_now=True, under=None):
        section('BL', 0.0, 0.14, A2, leg=0.36, arch_h=0.105, lattice=False)
        section('BR', 0.0, 0.14, A2, leg=0.36, arch_h=0.105, lattice=False)
        section('L', 0.0, 0.14, A0, leg=0.36, arch_h=0.105)
        section('R', 0.0, 0.14, A1, leg=0.36, arch_h=0.105)
        w1 = 0.092
        T.box(cu - w1, cv - w1, 2 * w1, 2 * w1, 0.016, z=0.14, c=A0, right=A1, top=ACCENT_L, ink=0.42, guide=False)
        section('L', 0.156, 0.29, A0, leg=0.42, arch_h=0.20)
        section('R', 0.156, 0.29, A1, leg=0.42, arch_h=0.20)
        w2 = 0.05
        T.box(cu - w2, cv - w2, 2 * w2, 2 * w2, 0.012, z=0.29, c=A0, right=A1, top=ACCENT_L, ink=0.4, guide=False)
        section('L', 0.302, 0.76, A0)
        section('R', 0.302, 0.76, A1)
        T.box(cu - 0.012, cv - 0.012, 0.024, 0.024, 0.018, z=0.76, c=A0, right=A1, top=ACCENT_L, ink=0.36, guide=False)
        T.rev(cu, cv, [(0.007, 0), (0.005, 0.02), (0.0, 0.03)], z=0.778, c=A0, ink=0.3, guide=False)
        T.line([(cu, cv, 0.80), (cu, cv, 0.86)], 0.4)
    T.mark('tower')
    # lights come on up the tower
    for k, z in enumerate((0.148, 0.296, 0.45, 0.60, 0.775)):
        for sgn in ((-1, 1) if z < 0.3 else (0,)):
            pr.lamp(T, T.P3(fpt('L', sgn * 0.8, z)), 0.8 if z < 0.7 else 1.1, MARBLE, t0=1.24 + 0.05 * k, halo=(z > 0.7 or sgn == 1), stage='sky', sky=True)

    # ---- front row of houses with cafe awnings
    haussmann(0.03, 0.66, 0.15, 0.10, 0.075)
    haussmann(0.20, 0.66, 0.13, 0.10, 0.09)
    haussmann(0.35, 0.66, 0.15, 0.10, 0.07)
    for k, a in enumerate((0.05, 0.11, 0.22, 0.28, 0.37, 0.44)):
        T.poly([(a, 0.76, 0.03), (a + 0.04, 0.76, 0.03), (a + 0.04, 0.785, 0.018), (a, 0.785, 0.018)], ACCENT if k % 2 == 0 else MARBLE, 0.3, stage='detail')
        Q = T.P(a + 0.02, 0.80)
        T.ell2(Q + np.array([0, -1.6]), 1.5, 0.75, fill=MARBLE, ink=0.24, n=9, wob=0, stage='detail')
        T.line2(Q, [(0, 0), (0, -1.6)], 0.26, stage='detail')
    # carousel
    T.cyl(0.595, 0.70, 0.035, 0.008, c=MARBLE, guide=False, ink=0.34)
    for k in range(6):
        a = k * math.pi / 3
        T.line([(0.595 + 0.028 * math.cos(a), 0.70 + 0.028 * math.sin(a), 0.008), (0.595 + 0.028 * math.cos(a), 0.70 + 0.028 * math.sin(a), 0.04)], 0.3, ACCENT_D, stage='detail')
    T.rev(0.595, 0.70, [(0.04, 0), (0.0, 0.03)], z=0.04, c=ROSE, ink=0.36, guide=False)
    T.ell2(T.P(0.595, 0.70, 0.073), 0.8, fill=ACCENT, ink=0.22, n=8, wob=0, stage='detail')
    # trees on the quays
    for v in (0.06, 0.16, 0.26, 0.64, 0.80, 0.90, 0.97):
        tree(T, 0.615, v, 0.8, FOREST, 'round')
    for v in (0.58, 0.68, 0.78, 0.88, 0.96):
        tree(T, 0.815, v, 0.8, FOREST, 'round')
    for (a, b) in ((0.90, 0.60), (0.95, 0.70), (0.89, 0.80), (0.95, 0.90), (0.06, 0.95), (0.20, 0.955), (0.34, 0.95), (0.48, 0.955)):
        tree(T, a, b, 0.9, r.choice([FOREST, JUNGLE]), 'round')
    # lamp posts along the river
    for k, v in enumerate((0.11, 0.31, 0.56, 0.74, 0.93)):
        Q = T.P(0.645, v)
        T.line2(Q, [(0, 0), (0, -5.0)], 0.3, stage='detail')
        pr.lamp(T, Q + np.array([0, -5.6]), 0.9, ACCENT_L, t0=1.2 + 0.04 * k)

    # ---- life
    pr.steamer(T, 0.72, 0.90, 'v', L=0.17, c=MARBLE, trim=ZINC, motion=cruise(0.0, -0.36, 0.8, 0.15, 0.3), decks=1)
    pr.rowboat(T, 0.70, 0.20, 'v', c=TERRA, crew=2)
    pr.car(T, 0.03, 0.875, 'u', c=ZINC, motion=runner(0.50, 0.0, 8.0))
    pr.car(T, 0.03, 0.878, 'u', c=MARBLE, motion=runner(0.50, 0.0, 13.0), s=0.9)
    pr.car(T, 0.53, 0.845, 'u', c=ROSE, motion=runner(-0.50, 0.0, 9.5), s=0.9)
    pr.car(T, 0.53, 0.848, 'u', c=ACCENT, motion=runner(-0.50, 0.0, 15.0), s=0.85)
    crowd(T, [(0.24, 0.47), (0.56, 0.47), (0.56, 0.60), (0.24, 0.60)], 9, mind=0.025)
    crowd(T, [(0.02, 0.41), (0.22, 0.41), (0.22, 0.45), (0.02, 0.45)], 4)
    crowd(T, [(0.03, 0.775), (0.52, 0.775), (0.52, 0.815), (0.03, 0.815)], 8, walk_frac=0.3, mind=0.025)
    crowd(T, [(0.57, 0.50), (0.64, 0.50), (0.64, 0.62), (0.57, 0.62)], 3)
    crowd(T, [(0.63, 0.40), (0.81, 0.40), (0.81, 0.445), (0.63, 0.445)], 4, z=0.036, walk_frac=0)
    # a painter at an easel + balloon seller
    E = T.P(0.565, 0.34)
    T.lines2(E, [[(-1.4, 0), (0, -4.4)], [(1.4, 0), (0, -4.4)], [(0, -4.4), (0.4, 0.4)]], 0.3, WOOD, stage='detail')
    T.poly2(E, [(-1.5, -2.2), (1.5, -2.2), (1.5, -5.4), (-1.5, -5.4)], MARBLE, 0.26, wob=0, stage='detail')
    person(T, 0.585, 0.355, shirt=ZINC, hat=DARK)
    B_ = person(T, 0.50, 0.585, shirt=MARBLE)
    with T.grp('pop', pivot=B_, motion=pr.sway(4.0, 1.5), stage='life', dur=0.25):
        for k, (dx, dy, c_) in enumerate(((-1.6, -11.0, ACCENT), (0.8, -12.4, ROSE), (2.4, -10.4, WATER_D))):
            T.line2(B_, [(1.2, -4.0), (dx, dy)], 0.18)
            T.ell2(B_ + np.array([dx, dy - 1.2]), 1.2, 1.4, fill=c_, ink=0.24, n=9, wob=0)
    pr.cloud(T, 0.10, 0.36, 0.62, 0.95)
    pr.cloud(T, 0.62, 0.20, 0.50, 0.75)
    pr.glint(T, T.P(cu, cv, 0.80), 1.3)


# ============================================================= EVEREST ====
def everest(T):
    T.slab((228, 228, 224), (190, 180, 170))
    r = T.rng
    with T.st('ground'):
        T.poly(sm([(0.0, 0.80), (0.20, 0.86), (0.44, 0.80), (0.60, 0.88), (0.60, 1.0)]) + [(0, 1)], GRASS, 0.36)
        T.poly(sm([(0.76, 1.0), (0.78, 0.86), (0.90, 0.76), (1.0, 0.72)]) + [(1, 1)], GRASS, 0.36)
    T.tufts([(0.0, 0.84), (0.2, 0.9), (0.44, 0.84), (0.58, 0.92), (0.58, 1.0), (0, 1)], 26)
    T.tufts([(0.8, 1.0), (0.82, 0.86), (1.0, 0.76), (1, 1)], 14)
    T.speckle([(0, 0), (1, 0), (1, 0.7), (0.6, 0.85), (0, 0.78)], 60, c=ROCK)

    T.mark('ground')
    def peak(pk, base, snow, t0, seed, jag=1.3, c=ROCK, cd=ROCK_D):
        g = T.guide_axis(pk[0], pk[1], pk[2], ticks=max(4, int(pk[2] * 10)))
        g.tp = max(0.02, t0 - 0.24)
        g.te = t0 + 0.5
        g2 = T.guide([[base[0], pk], [base[-1], pk], [base[0], base[-1]]], over=0.04)
        g2.tp = max(0.04, t0 - 0.2)
        g2.te = t0 + 0.5
        with T.grp('rise', t0=t0, dur=0.52, pivot=T.P(pk[0], pk[1]), stage='struct', ink_now=True, under=PAPER):
            T.mountain(pk, base, c=c, cd=cd, snow=snow, jag=jag, seed=seed, snow_grp=dict(t0=t0 + 0.62, dur=0.42, pivot=T.P3(pk), instant=True))
    # far range
    peak((0.10, 0.10, 0.46), [(0.0, 0.34), (0.10, 0.36), (0.26, 0.22), (0.30, 0.0)], 0.42, 0.22, 3, c=shade(ROCK, 1.06), cd=shade(ROCK_D, 1.06))
    peak((0.62, 0.05, 0.40), [(0.40, 0.14), (0.56, 0.24), (0.78, 0.16), (0.86, 0.0)], 0.4, 0.26, 4, c=shade(ROCK, 1.06), cd=shade(ROCK_D, 1.06))
    # Everest itself
    EV = (0.34, 0.33, 0.84)
    peak(EV, [(0.02, 0.52), (0.20, 0.70), (0.46, 0.67), (0.66, 0.44), (0.62, 0.14)], 0.5, 0.32, 11, jag=1.5)
    # Lhotse and Nuptse
    peak((0.82, 0.24, 0.58), [(0.56, 0.36), (0.72, 0.52), (0.94, 0.46), (1.0, 0.16)], 0.42, 0.38, 7)
    peak((0.13, 0.63, 0.36), [(0.0, 0.74), (0.10, 0.84), (0.30, 0.79), (0.33, 0.62)], 0.36, 0.44, 9)

    T.mark('peaks')
    # ---- Khumbu glacier and its melt-water river
    gl = [(0.50, 0.58), (0.62, 0.56), (0.72, 0.70), (0.745, 0.88), (0.615, 0.88), (0.58, 0.80), (0.50, 0.74), (0.44, 0.66)]
    with T.st('detail'):
        T.poly(smooth_poly([np.array(p) for p in gl], 2), ICE, 0.4, wave='s')
        T.lines([[(0.50, 0.66), (0.56, 0.665)], [(0.54, 0.705), (0.62, 0.71)], [(0.58, 0.755), (0.66, 0.76)], [(0.61, 0.80), (0.70, 0.805)], [(0.63, 0.845), (0.72, 0.85)]],
                0.3, WATER_D, wave='s')
    water(T, [(0.62, 0.87), (0.74, 0.87), (0.74, 1.0), (0.62, 1.0)], src=(0.68, 0.87), marks=4, t0=0.95, dur=0.3)
    T.wall_water('L', 0.62, 0.74)

    # moraine boulders, a higher camp, trekkers coming up the valley
    for (a, b, q) in ((0.80, 0.60, 1.0), (0.90, 0.66, 0.8), (0.52, 0.80, 0.7), (0.78, 0.72, 0.6), (0.94, 0.56, 0.7), (0.46, 0.76, 0.6), (0.84, 0.50, 0.5)):
        T.blob(a, b, 0.022 * q, 0.016 * q, ROCK, 0.34, seed=int(a * 97), stage='detail')
        T.blob(a + 0.004, b + 0.002, 0.012 * q, 0.008 * q, ROCK_D, 0.0, seed=int(a * 31), stage='detail')
    for k, (a, b) in enumerate(((0.84, 0.62), (0.90, 0.60))):
        with T.grp('pop', pivot=T.P(a, b), stage='life', dur=0.25):
            T.dome(a, b, 0.02, 0.02, c=ACCENT if k == 0 else TERRA, guide=False, ink=0.34)
    for k in range(4):
        person(T, 0.80 + k * 0.03, 0.74 + k * 0.012, shirt=[ACCENT, ZINC, TERRA, MARBLE][k], s=0.85, walk=walker(-0.07, -0.05, 12), ph=0.8, bag=TERRA)

    # ---- climbers roped up the west ridge
    A = np.array(T.P3((0.02, 0.52, 0.0)))
    B = np.array(T.P3(EV))
    rope = [A + (B - A) * q for q in (0.36, 0.44, 0.52, 0.60)]
    for k, p in enumerate(rope):
        person(T, 0, 0, at=p, shirt=ACCENT if k % 2 == 0 else TERRA, s=0.72, walk=pr.walker_px((B - A) * 0.07, 11.0), ph=0.5)

    # ---- base camp
    for k, (a, b) in enumerate(((0.30, 0.88), (0.38, 0.86), (0.46, 0.90), (0.35, 0.94), (0.44, 0.96), (0.52, 0.95))):
        with T.grp('pop', pivot=T.P(a, b), stage='life', dur=0.25):
            T.dome(a, b, 0.022, 0.022, c=ACCENT if k % 3 != 2 else MARBLE, guide=False, ink=0.34)
            T.arch('L', a, b + 0.016, 0.0, 0.012, 0.014, fill=DARK, ink=0.2)
    # stupa with prayer flags
    T.box(0.86, 0.84, 0.06, 0.06, 0.016, c=MARBLE, ink=0.36, guide=False)
    T.dome(0.89, 0.87, 0.024, 0.026, z=0.016, c=MARBLE, guide=False, ink=0.36)
    T.box(0.884, 0.864, 0.012, 0.012, 0.012, z=0.042, c=ACCENT, ink=0.28, guide=False)
    T.rev(0.89, 0.87, [(0.007, 0), (0.0, 0.03)], z=0.054, c=ACCENT, ink=0.28, guide=False)
    top = T.P(0.89, 0.87, 0.08)
    cols = [WATER_D, MARBLE, ACCENT, GRASS_D, TERRA]
    for (tu, tv) in ((0.74, 0.96), (0.99, 0.80), (0.80, 0.80), (0.98, 0.96)):
        end = T.P(tu, tv, 0.004)
        pts = [top + (end - top) * q + np.array([0, 5.0 * math.sin(math.pi * q)]) for q in np.linspace(0, 1, 12)]
        T.line2((0, 0), pts, 0.2, stage='detail')
        for k in range(1, 11):
            p = pts[k]
            with T.grp('grow', pivot=p, stage='life', dur=0.2, motion=lambda t, age, ph: (0.0, 0.0, 6 * math.sin(t * 7 + ph), 1.0, 1.0)):
                T.poly2(p, [(-0.7, 0), (0.7, 0), (0.7, 1.9), (-0.7, 1.9)], cols[k % 5], 0.16, wob=0)
    pr.yak(T, 0.20, 0.93, s=0.9, blanket=ACCENT, walk=walker(0.04, 0.0, 9))
    pr.yak(T, 0.11, 0.95, s=0.85, blanket=TERRA, walk=walker(0.04, 0.0, 9))
    pr.yak(T, 0.94, 0.90, flip=True, s=0.85)
    crowd(T, [(0.28, 0.90), (0.56, 0.90), (0.56, 0.99), (0.28, 0.99)], 6, mind=0.03, hat=ACCENT)
    crowd(T, [(0.80, 0.90), (0.98, 0.86), (0.98, 0.99), (0.80, 0.99)], 3, hat=TERRA)
    for (a, b) in ((0.05, 0.86), (0.02, 0.93), (0.57, 0.985), (0.86, 0.975)):
        tree(T, a, b, 0.75, JUNGLE, 'fir')
    # clouds condensing round the summit, banner cloud streaming off it
    pr.cloud(T, 0.42, 0.28, 0.80, 0.9, drift=4.0)
    pr.cloud(T, 0.14, 0.46, 0.50, 1.0)
    pr.cloud(T, 0.74, 0.36, 0.42, 0.9)
    pr.cloud(T, 0.56, 0.10, 0.40, 0.7)
    pr.glint(T, B + np.array([0, -4.0]), 1.0)


# ================================================================ FUJI ====
FUJI = (150, 166, 198)


def fuji(T):
    T.slab(GRASS, EARTH)
    r = T.rng
    north = sm([(0.0, 0.40), (0.10, 0.42), (0.24, 0.47), (0.42, 0.52), (0.58, 0.60), (0.70, 0.72), (0.80, 0.86), (0.84, 1.0)])
    south = sm([(0.72, 1.0), (0.68, 0.90), (0.56, 0.84), (0.42, 0.82), (0.28, 0.74), (0.14, 0.60), (0.0, 0.52)])
    T.tufts([(0, 0), (1, 0), (1, 1), (0.86, 1), (0.6, 0.58), (0.25, 0.45), (0, 0.38)], 60)
    T.tufts(south[::-1] + [(0, 1)], 30)
    with T.st('ground'):
        # tea rows on the right
        for k in range(7):
            v = 0.66 + k * 0.045
            T.poly([(0.80 + 0.012 * k, v), (0.985, v), (0.985, v + 0.02), (0.80 + 0.012 * k + 0.01, v + 0.02)], GRASS_D, 0.28)
    water(T, north + south, src=(0.0, 0.46), marks=24, t0=0.30, dur=0.5, flow=(1, 0.6))
    T.wall_water('L', 0.72, 0.84)

    T.mark('ground')
    # ---- Fuji: rises, then the snow settles on it
    cu, cv = 0.645, 0.245
    prof = [(0.228, 0), (0.178, 0.075), (0.132, 0.167), (0.091, 0.264), (0.06, 0.352), (0.04, 0.414), (0.03, 0.445)]
    T.guide_axis(cu, cv, 0.49, ticks=9, r=0.228).tp = 0.04
    g = T.guide([[(cu - 0.228, cv + 0.228, 0), (cu, cv, 0.5)], [(cu + 0.228, cv - 0.228, 0), (cu, cv, 0.5)]], over=0.03)
    g.tp = 0.1
    g.te = 0.9
    C = T.P(cu, cv)
    k_ = math.sqrt(2) * W
    with T.grp('rise', t0=0.32, dur=0.55, pivot=C, stage='struct', ink_now=True, under=PAPER):
        T.rev(cu, cv, prof, c=FUJI, ink=0.5, guide=False, cap=SNOW, band=0.3)
        T.lines2(C, [[(-0.12 * k_, -0.17 * ZS), (-0.16 * k_, -0.05 * ZS)], [(0.04 * k_, -0.2 * ZS), (0.065 * k_, -0.07 * ZS)], [(-0.03 * k_, -0.18 * ZS), (-0.05 * k_, -0.09 * ZS)]],
                 0.26, shade(FUJI, 0.8))
    with T.grp('wipe', t0=0.98, dur=0.45, pivot=T.P(cu, cv, 0.445), stage='struct'):
        up = [(rr, hh) for rr, hh in prof if hh >= 0.26]
        left = [(-rr * k_, -hh * ZS) for rr, hh in up]
        right = [(rr * k_, -hh * ZS) for rr, hh in up][::-1]
        x0, x1, yb = left[0][0], right[-1][0], left[0][1]
        teeth = []
        n = 9
        for q in range(1, n):
            x = x1 + (x0 - x1) * q / n
            teeth.append((x, yb + (r.uniform(5.5, 9.5) if q % 2 else r.uniform(-1.0, 2.0)) + 2.5 * math.sin(math.pi * q / n)))
        T.poly2(C, left + right + teeth, SNOW, 0.4, wob=0.12)
        T.ell2(C + np.array([0, -0.445 * ZS]), 0.03 * k_, 0.015 * k_, fill=(236, 240, 244), ink=0.34, wob=0)

    T.mark('cone')
    # ---- shinkansen on its viaduct
    for v in (0.06, 0.2, 0.34, 0.48, 0.62):
        T.box(0.895, v, 0.012, 0.012, 0.035, c=STONE, ink=0.28, guide=False)
    T.box(0.885, 0.0, 0.032, 0.70, 0.008, z=0.035, c=STONE, ink=0.38, guide=True)

    def train_m(t, age, ph):
        from .timeline import EV as _EV
        s_ = (((t - _EV['fuji']) / 3.4 + 0.5) % 1.0)
        d = pr.uvd(0, -0.25 + 0.75 * s_)
        return (d[0], d[1])
    with T.grp('fade', pivot=T.P(0.9, 0.1), motion=train_m, stage='life', dur=0.15):
        for k in range(3):
            v0 = 0.02 + k * 0.105
            T.box(0.889, v0, 0.024, 0.10, 0.02, z=0.043, c=MARBLE, ink=0.32, guide=False)
            T.poly([(0.913, v0 + 0.005, 0.052), (0.913, v0 + 0.095, 0.052), (0.913, v0 + 0.095, 0.057), (0.913, v0 + 0.005, 0.057)], ZINC, 0.0)
        T.poly([(0.889, 0.335, 0.043), (0.913, 0.335, 0.043), (0.905, 0.375, 0.043), (0.897, 0.375, 0.043)], MARBLE, 0.32, wob=0)
        T.poly([(0.889, 0.335, 0.063), (0.913, 0.335, 0.063), (0.905, 0.375, 0.046), (0.897, 0.375, 0.046)], WATER_L, 0.32, wob=0)

    # ---- village
    for (a, b, ax) in ((0.66, 0.535, 'u'), (0.74, 0.60, 'v'), (0.80, 0.52, 'u'), (0.04, 0.26, 'u'), (0.11, 0.32, 'v'), (0.20, 0.18, 'u')):
        T.house(a, b, 0.055, 0.045, 0.026, 0.02, wall=MARBLE, roof=DARK, axis=ax, win=2)
    for (a, b) in ((0.02, 0.12), (0.10, 0.20), (0.18, 0.36), (0.62, 0.62), (0.86, 0.60), (0.97, 0.05), (0.95, 0.60), (0.20, 0.06), (0.30, 0.14), (0.36, 0.30), (0.26, 0.26)):
        tree(T, a, b, r.uniform(0.75, 0.95), r.choice([FOREST, JUNGLE]), r.choice(['fir', 'round']))

    # ---- torii standing in the lake
    tv, ta, tb = 0.66, 0.335, 0.405
    T.guide([[(ta, tv, 0), (ta, tv, 0.10)], [(tb, tv, 0), (tb, tv, 0.10)], [(ta - 0.03, tv, 0.085), (tb + 0.03, tv, 0.085)]], ticks=3)
    for a in (ta, tb):
        T.poly([(a - 0.007, tv, 0), (a + 0.007, tv, 0), (a + 0.005, tv, 0.092), (a - 0.005, tv, 0.092)], ACCENT, 0.36)
    T.poly([(ta - 0.006, tv, 0.062), (tb + 0.006, tv, 0.062), (tb + 0.006, tv, 0.072), (ta - 0.006, tv, 0.072)], ACCENT, 0.34)
    T.poly([(ta - 0.03, tv, 0.092), (ta - 0.022, tv, 0.084), (tb + 0.022, tv, 0.084), (tb + 0.03, tv, 0.092), (tb + 0.034, tv, 0.106),
            ((ta + tb) / 2, tv, 0.097), (ta - 0.034, tv, 0.106)], ACCENT_D, 0.36)

    # ---- five-storey pagoda among the cherry trees
    pu, pv = 0.40, 0.915
    T.guide_axis(pu, pv, 0.26, ticks=5, r=0.045)
    T.box(pu - 0.045, pv - 0.045, 0.09, 0.09, 0.008, c=STONE, ink=0.34, guide=False)
    for k in range(5):
        w = 0.030 - k * 0.0035
        z = 0.008 + k * 0.042
        T.box(pu - w, pv - w, 2 * w, 2 * w, 0.024, z=z, c=ACCENT, right=ACCENT_D, ink=0.34, guide=False)
        e = w + 0.022
        zz = z + 0.024
        ap = (pu, pv, zz + 0.022)
        T.poly([(pu - e, pv - e, zz), (pu - e, pv + e, zz), ap], shade(DARK, 1.25), 0.32)
        T.poly([(pu - e, pv + e, zz), (pu + e, pv + e, zz), (pu + w * 0.8, pv + w * 0.8, zz + 0.018), (pu - w * 0.8, pv + w * 0.8, zz + 0.018)], shade(DARK, 1.15), 0.34)
        T.poly([(pu + e, pv - e, zz), (pu + e, pv + e, zz), (pu + w * 0.8, pv + w * 0.8, zz + 0.018), (pu + w * 0.8, pv - w * 0.8, zz + 0.018)], DARK, 0.34)
    T.line([(pu, pv, 0.222), (pu, pv, 0.275)], 0.5, ACCENT_D, stage='detail')
    for (a, b) in ((0.05, 0.66), (0.12, 0.74), (0.04, 0.80), (0.11, 0.90), (0.24, 0.82), (0.29, 0.93), (0.20, 0.88), (0.52, 0.95), (0.04, 0.96), (0.60, 0.90),
                   (0.22, 0.975), (0.66, 0.975)):
        tree(T, a, b, r.uniform(0.8, 1.05), BLOSSOM, 'cherry')

    # ---- life
    pr.rowboat(T, 0.20, 0.56, 'u', c=MARBLE, crew=2, motion=cruise(0.06, 0.02, 0.8))
    pr.rowboat(T, 0.50, 0.70, 'u', c=TERRA, crew=1, motion=cruise(0.05, 0.03, 0.6))
    pr.sailboat(T, 0.74, 0.86, 'v', s=0.7, motion=cruise(0.01, 0.05, 0.6))
    crowd(T, [(0.10, 0.78), (0.30, 0.90), (0.42, 0.96), (0.14, 0.97)], 7, mind=0.03, walk_frac=0.3)
    for (a, b) in ((0.27, 0.875), (0.50, 0.90)):                 # parasols
        Q = person(T, a, b, shirt=ROSE, pants=ROSE)
        with T.grp('pop', pivot=Q, stage='life', dur=0.2):
            T.line2(Q, [(1.2, -3.0), (1.2, -8.2)], 0.24)
            T.poly2(Q + np.array([1.2, -8.2]), [(-3.0, 1.0), (0, -1.0), (3.0, 1.0), (0, 1.6)], ACCENT, 0.26, wob=0)
    crowd(T, [(0.62, 0.50), (0.84, 0.48), (0.86, 0.60), (0.66, 0.62)], 4)
    for (a, b) in ((0.84, 0.69), (0.90, 0.78), (0.87, 0.875), (0.95, 0.92)):
        person(T, a, b, shirt=ZINC, hat=(232, 210, 160))
    pr.cloud(T, 0.50, 0.36, 0.26, 1.0)
    pr.cloud(T, 0.84, 0.22, 0.30, 0.9)
    pr.cloud(T, 0.20, 0.10, 0.22, 0.7)
    pr.glint(T, T.P((ta + tb) / 2, tv, 0.11), 0.9)
    pr.glint(T, T.P(pu, pv, 0.28), 0.7)


# ============================================================= HA LONG ====
KARST = (190, 186, 176)


def halong(T):
    TH = 0.16
    sea_wall(T, 'L', TH, t0=0.36)
    sea_wall(T, 'R', TH, t0=0.42)
    T.slab(SAND, EARTH, walls=False, thick=TH)
    r = T.rng
    water(T, [(0, 0), (1, 0), (1, 1), (0, 1)], src=(0.0, 0.33), marks=40, t0=0.24, dur=0.6, shore=0.0, c=(150, 214, 216), flow=(1, 0.4))

    T.mark('ground')
    def karst(u, v, rr, h, t0, seed, cave=False):
        q = __import__('random').Random(seed)
        prof = [(rr, 0)]
        n = 6
        for k in range(1, n):
            t_ = k / n
            prof.append((rr * (1 - 0.55 * t_ ** 1.6) * q.uniform(0.86, 1.1), h * t_))
        prof.append((rr * 0.32, h))
        with T.grp('rise', t0=t0, dur=0.5, pivot=T.P(u, v), stage='struct', ink_now=True, under=PAPER):
            T.rev(u, v, prof, c=KARST, ink=0.48, guide=False, cap=FOREST)
            C = T.P(u, v)
            k_ = math.sqrt(2) * W
            # green crown spilling over the top
            top = [(-prof[-1][0] * k_ - 1.0, -h * ZS + 1.5), (-prof[-2][0] * k_ * 0.9, -h * ZS * 0.80), (-prof[-2][0] * k_ * 0.3, -h * ZS * 0.86),
                   (prof[-2][0] * k_ * 0.2, -h * ZS * 0.76), (prof[-2][0] * k_ * 0.85, -h * ZS * 0.84), (prof[-1][0] * k_ + 1.0, -h * ZS + 1.0),
                   (prof[-1][0] * k_ * 0.6, -h * ZS - 3.2), (-prof[-1][0] * k_ * 0.5, -h * ZS - 3.6)]
            T.poly2(C, smooth_poly(top, 2), FOREST, 0.4, wob=0.1)
            T.lines2(C, [[(-rr * k_ * 0.5, -h * ZS * 0.5), (-rr * k_ * 0.55, -h * ZS * 0.2)], [(rr * k_ * 0.1, -h * ZS * 0.6), (rr * k_ * 0.14, -h * ZS * 0.25)],
                         [(-rr * k_ * 0.15, -h * ZS * 0.4), (-rr * k_ * 0.18, -h * ZS * 0.1)]], 0.26, STONE_D)
            if cave:
                T.ell2(C + np.array([-rr * k_ * 0.25, rr * k_ * 0.36]), rr * k_ * 0.26, rr * k_ * 0.3, fill=DARK, ink=0.3, a0=math.pi, a1=2 * math.pi, wob=0)
            T.ell2(C + np.array([0, rr * k_ * 0.05]), rr * k_ * 1.04, rr * k_ * 0.54, fill=None, ink=0.34, inkc=FOAM, a0=0.15, a1=math.pi - 0.15, closed=False, wob=0)
        g = T.guide_axis(u, v, h, ticks=4, r=rr)
        g.tp = max(0.02, t0 - 0.22)
        g.te = t0 + 0.45
    ks = [(0.17, 0.21, 0.065, 0.19, 1, False), (0.43, 0.15, 0.055, 0.17, 2, False), (0.71, 0.19, 0.07, 0.21, 3, False), (0.93, 0.36, 0.05, 0.17, 4, False),
          (0.13, 0.50, 0.06, 0.17, 5, True), (0.52, 0.43, 0.085, 0.40, 6, False), (0.30, 0.66, 0.05, 0.22, 7, False), (0.79, 0.64, 0.07, 0.34, 8, True),
          (0.15, 0.86, 0.07, 0.19, 9, False), (0.90, 0.90, 0.045, 0.13, 10, False)]
    boats_mid = False
    for n_, (u, v, rr, h, sd, cave) in enumerate(ks):
        if u + v > 0.75 and not boats_mid:
            boats_mid = True
            pr.junk(T, 0.30, 0.32, 'u', motion=cruise(0.07, 0.0, 0.5), s=1.1)
            pr.rowboat(T, 0.70, 0.38, 'u', c=TERRA, crew=1, motion=cruise(0.08, 0.0, 0.7))
        karst(u, v, rr, h, 0.30 + 0.045 * n_, sd, cave)
    # floating village
    for (a, b, c_) in ((0.40, 0.80, ACCENT_L), (0.46, 0.76, WATER_L), (0.45, 0.85, ROSE), (0.52, 0.80, MARBLE)):
        T.box(a, b, 0.045, 0.04, 0.004, c=WOOD, ink=0.28, guide=False)
        T.house(a + 0.006, b + 0.006, 0.032, 0.028, 0.016, 0.012, wall=c_, roof=TERRA, axis='u', ink=0.3)
    # ---- life
    pr.junk(T, 0.70, 0.87, 'u', motion=cruise(0.09, 0.0, 0.45), s=1.35)
    pr.junk(T, 0.34, 0.96, 'v', motion=cruise(0.0, -0.08, 0.5), s=0.8, sail=MARBLE)
    pr.rowboat(T, 0.62, 0.66, 'v', c=ACCENT, crew=2, motion=cruise(0.03, 0.04, 0.9))
    pr.rowboat(T, 0.93, 0.80, 'u', c=MARBLE, crew=1, motion=cruise(-0.04, 0.02, 0.8))
    pr.rowboat(T, 0.24, 0.70, 'u', c=TERRA, crew=1)
    crowd(T, [(0.40, 0.82), (0.44, 0.82), (0.44, 0.84), (0.40, 0.84)], 1, z=0.004)
    pr.cloud(T, 0.40, 0.18, 0.34, 0.9, alpha=0.95)
    pr.cloud(T, 0.86, 0.26, 0.30, 0.8)
    pr.glint(T, T.P(0.52, 0.43, 0.42), 0.9)
    # under the surface
    fish_wall(T, 'L', TH, 5, corals=3)
    fish_wall(T, 'R', TH, 4, corals=2)


def fish(T, at, s=1.0, c=ACCENT, flip=False, stripes=False, motion=None):
    f = -1 if flip else 1
    with T.grp('pop', pivot=at, motion=motion, stage='life', dur=0.22):
        T.poly2(at, [(-2.0 * f * s, 0), (-3.6 * f * s, -1.3 * s), (-3.6 * f * s, 1.3 * s)], c, 0.24, wob=0)
        T.ell2(at, 2.3 * s, 1.25 * s, fill=c, ink=0.26, n=10, wob=0)
        if stripes:
            T.lines2(at, [[(-0.5 * f * s, -1.1 * s), (-0.5 * f * s, 1.1 * s)], [(0.8 * f * s, -0.9 * s), (0.8 * f * s, 0.9 * s)]], 0.5 * s, MARBLE, wob=0)
        T.ell2(at + np.array([1.4 * f * s, -0.3 * s]), 0.22 * s, fill=INK, ink=0, n=6, wob=0)


def fish_wall(T, face, thick, n=6, corals=4, seed=None, cols=None):
    """Life in the cut-away sea wall: corals on the bed, weed that sways, fish that patrol."""
    r = T.rng
    cols = cols or [ACCENT, ZINC, ROSE, ACCENT_L, MARBLE]

    def fp(a, z):
        return np.array(T.P3((a, 1, z) if face == 'L' else (1, a, z)))
    ax = fp(1, 0) - fp(0, 0)
    zb = -thick * 0.76
    for k in range(corals):
        a = (k + 0.5) / corals + r.uniform(-0.3, 0.3) / corals
        base = fp(a, zb + thick * r.uniform(-0.04, 0.03))
        kind = r.choice(['fan', 'branch', 'brain', 'weed', 'branch', 'weed', 'branch'])
        col = r.choice([ROSE, ACCENT_L, BLOSSOM, TERRA, ACCENT])
        s = (thick / 0.11) ** 0.6 * r.uniform(0.8, 1.15)
        if kind == 'weed':
            with T.grp('pop', pivot=base, motion=pr.sway(7.0, 1.6), stage='flora', dur=0.25):
                T.lines2(base, [[(q * 1.1, 0), (q * 1.1 + 0.8 * math.sin(q * 2.0), -5.0 * s), (q * 1.1 - 0.5, -9.0 * s - q)] for q in (-1, 0, 1)], 0.6, FOREST, wob=0)
        elif kind == 'fan':
            with T.grp('pop', pivot=base, motion=pr.sway(3.0, 1.2), stage='flora', dur=0.25):
                T.ell2(base + np.array([0, -2.6 * s]), 2.5 * s, 2.3 * s, fill=col, ink=0.3, wob=0, a0=math.pi, a1=2 * math.pi)
                T.lines2(base, [[(0, 0), (-1.7 * s, -3.6 * s)], [(0, 0), (0, -4.6 * s)], [(0, 0), (1.7 * s, -3.6 * s)], [(0, 0), (0, -2.6 * s)]], 0.22, shade(col, 0.7), wob=0)
        elif kind == 'brain':
            with T.grp('pop', pivot=base, stage='flora', dur=0.25):
                T.ell2(base + np.array([0, -0.9 * s]), 2.6 * s, 1.7 * s, fill=col, ink=0.3, wob=0)
                T.lines2(base, [[(-1.5 * s, -1.3 * s), (-0.5 * s, -0.7 * s), (0.5 * s, -1.4 * s), (1.5 * s, -0.9 * s)]], 0.22, shade(col, 0.7), wob=0)
        else:
            with T.grp('pop', pivot=base, motion=pr.sway(2.0, 1.0), stage='flora', dur=0.25):
                T.lines2(base, [[(0, 0), (0, -4.5 * s)], [(0, -2.2 * s), (-2.4 * s, -5.2 * s)], [(0, -2.8 * s), (2.2 * s, -5.6 * s)], [(-1.2 * s, -3.8 * s), (-1.0 * s, -6.4 * s)],
                                   [(1.2 * s, -4.2 * s), (2.6 * s, -7.0 * s)], [(0, -4.5 * s), (0.4 * s, -7.4 * s)]], 1.1 * s, col, wob=0)
    for k in range(n):
        a = r.uniform(0.08, 0.86)
        z = -thick * r.uniform(0.16, 0.62)
        flip = (r.random() < 0.5)
        dirn = ax * (0.11 if not ((face == 'L') ^ (not flip)) else -0.11)
        # fish face the way they swim along the wall
        sgn = 1 if (ax[0] * dirn[0] > 0) else -1
        fl = (sgn * ax[0] < 0)

        def mo(t, age, ph, d=dirn, sp=r.uniform(0.5, 0.9)):
            s_ = (t * 0.12 * sp + ph / 6.283) % 1.0
            al = min(1.0, min(s_, 1.0 - s_) / 0.07)
            return (d[0] * 2.4 * (s_ - 0.5), d[1] * 2.4 * (s_ - 0.5) + 0.5 * math.sin(t * 3 + ph * 9), 4.0 * math.sin(t * 9 + ph * 5), 1.0, 1.0, al)
        c_ = cols[k % len(cols)]
        fish(T, fp(a, z), r.uniform(0.75, 1.1) * (thick / 0.16) ** 0.4, c_, flip=fl, stripes=(c_ == ACCENT), motion=mo)


BUILDERS = {'eiffel': eiffel, 'everest': everest, 'fuji': fuji, 'halong': halong}
