"""Fourth pass, per wonder: architectural fidelity, street furniture and ground detail that reward the
2.5x close-ups, the dream connections between slabs, and each close-up's signature on-camera event."""
import math
import random

import numpy as np
import skia

from . import ease
from .core import W, ZS, SLAB, argb, smooth_poly
from .pal import *  # noqa
from . import props as pr
from . import extras as ex
from .props import person, crowd, stroll, tree, walker, cruise, bobber
from .timeline import EV, STARTS
from .tiles_a import lerp3, LIME, LIME_D

TAU = 2 * math.pi
HAT = (232, 214, 170)


def _on(a, b, dt=1.0):
    return max(STARTS[a], STARTS[b]) + dt


def _path(pts, closed=True):
    p = skia.Path()
    p.addPoly([skia.Point(float(x), float(y)) for x, y in pts], closed)
    return p


def fountain(T, u, v, z=0.0, h=9.0, n=5, t_on=None, spread=3.0):
    """jets of water: on from the build, or switched on at a global time"""
    P = np.array(T.P(u, v, z))
    ph0 = T.rng.uniform(0, 6.28)
    foam = vivid(FOAM)
    wd = vivid(WATER_D)

    def draw(c, tau, t, a, R):
        if tau < 1.2:
            return
        k = 1.0 if t_on is None else ease.out_back(min(1.0, max(0.0, (t - t_on) / 0.7)), 1.6)
        if k <= 0:
            return
        hh = h * k * (0.92 + 0.08 * math.sin(t * 5 + ph0))
        for j in range(n):
            dx = (j - (n - 1) / 2.0) / max(1, (n - 1) / 2.0) * spread
            pts = [P + np.array([dx * q, -hh * 4 * q * (1 - q) * (1.0 if j != n // 2 else 1.2)]) for q in np.linspace(0, 1, 9)]
            R.poly(c, pts, ink=foam, w=0.55, a=a, closed=False)
            R.poly(c, pts, ink=wd, w=0.16, a=a * 0.7, closed=False)
            f = (t * 1.3 + j * 0.37 + ph0) % 1.0
            d = P + np.array([dx * f, -hh * 4 * f * (1 - f)])
            R.pf.setColor(argb(foam, a))
            c.drawCircle(float(d[0]), float(d[1]), 0.45, R.pf)
    T.custom(draw, [P + np.array([-spread - 3, -h * 1.4]), P + np.array([spread + 3, 3])], stage='life')


def echo_rings(T, at, t_ev, n=3, r0=6.0, r1=34.0, c=INK):
    at = np.asarray(at, float)

    def draw(c_, tau, t, a, R):
        for k in range(n):
            x = (t - t_ev - 0.16 * k) / 1.1
            if 0 < x < 1:
                rr = r0 + (r1 - r0) * ease.out_cubic(x)
                R.ps.setColor(argb(c, a * (1 - x) * 0.8))
                R.ps.setStrokeWidth(0.45)
                c_.drawArc(skia.Rect.MakeLTRB(at[0] - rr, at[1] - rr * 0.5, at[0] + rr, at[1] + rr * 0.5), 200, 140, False, R.ps)
    T.custom(draw, [at + np.array([-r1 - 2, -r1]), at + np.array([r1 + 2, r1])], stage='sky', sky=True)


def lotus(T, pts):
    for (u, v) in pts:
        Q = T.P(u, v)
        with T.grp('pop', pivot=Q, motion=bobber(0.2, 3, 0.6), stage='flora', dur=0.2):
            T.ell2(Q, 1.5, 0.8, fill=(120, 196, 120), ink=0.2, n=8, wob=0)
            T.ell2(Q + np.array([0.4, -0.4]), 0.5, fill=BLOSSOM, ink=0.14, n=6, wob=0)


def path_line(T, pts, w=0.9, c=(238, 228, 204), z=0.0):
    """a footpath with ruled edges"""
    T.line([(p[0], p[1], z) for p in pts], w, c, stage='ground')
    T.line([(p[0], p[1], z) for p in pts], 0.16, shade(c, 0.74), stage='detail')


# ================================================================ PYRAMIDS ====
def pyramids(T):
    ev = EV['pyramids']
    r = T.rng
    with T.at('pyr'):
        # every course is laid in blocks
        for (u0, v0, b, h, n) in ((0.115, 0.335, 0.155, 0.098, 4), (0.285, 0.165, 0.275, 0.182, 7), (0.565, 0.045, 0.30, 0.196, 8)):
            A = (u0 + b / 2, v0 + b / 2, h)
            for (pa, pb, col) in (((u0, v0 + b, 0), (u0 + b, v0 + b, 0), shade(LIME, 0.82)), ((u0 + b, v0, 0), (u0 + b, v0 + b, 0), shade(LIME_D, 0.84))):
                segs = []
                for k in range(n + 1):
                    t0, t1 = 0.92 * k / (n + 1), 0.92 * (k + 1) / (n + 1)
                    m = max(2, int((n + 1 - k) * 1.7))
                    for q in range(m + 1):
                        f = (q + (0.5 if k % 2 else 0.0)) / (m + 0.5)
                        if 0.04 < f < 0.96:
                            base = lerp3(pa, pb, f)
                            segs.append([lerp3(base, A, t0), lerp3(base, A, t1)])
                T.lines(segs, 0.17, col, stage='detail')
        # the entrance on the Great Pyramid, and scaffolding against the smallest
        T.poly([(0.705, 0.345, 0.03), (0.725, 0.345, 0.03), (0.722, 0.3, 0.052), (0.708, 0.3, 0.052)], DARK, 0.26, stage='detail')
        T.lines([[(0.13 + 0.02 * k, 0.49, 0.0), (0.145 + 0.014 * k, 0.455, 0.04)] for k in range(5)] +
                [[(0.13, 0.49 - 0.012 * k, 0.012 * k * 1.2), (0.21, 0.49 - 0.012 * k, 0.012 * k * 1.2)] for k in range(1, 4)], 0.26, WOOD, stage='detail')
    with T.at('ground'):
        # excavation trenches, cart tracks, strewn blocks
        for (a, b) in ((0.30, 0.47), (0.335, 0.50), (0.90, 0.10), (0.935, 0.14)):
            T.poly([(a, b), (a + 0.04, b), (a + 0.04, b + 0.022), (a, b + 0.022)], (214, 186, 132), 0.3, stage='ground')
            T.lines([[(a + 0.008 * k, b), (a + 0.008 * k, b + 0.022)] for k in range(1, 5)], 0.18, shade(SAND_D, 0.8), stage='detail')
        T.lines([[(0.52 + 0.05 * k, 0.905 + 0.004 * k), (0.545 + 0.05 * k, 0.907 + 0.004 * k)] for k in range(9)] +
                [[(0.52 + 0.05 * k, 0.925 + 0.004 * k), (0.545 + 0.05 * k, 0.927 + 0.004 * k)] for k in range(9)], 0.24, shade(SAND_D, 0.84), stage='detail')
        ex.flowers(T, [(0.02, 0.48), (0.2, 0.52), (0.4, 0.68), (0.52, 0.9), (0.5, 0.98), (0.44, 0.9), (0.33, 0.72), (0.16, 0.6), (0.02, 0.56)], 26, cols=[MARBLE, ROSE, ACCENT_L])
    ex.rocks(T, [(0.25, 0.42), (0.44, 0.36), (0.955, 0.36), (0.50, 0.975), (0.86, 0.95)], 0.7, c=LIME_D)
    for k, (a, b) in enumerate(((0.78, 0.60), (0.81, 0.655), (0.955, 0.70))):
        ex.stall(T, a, b, [ACCENT, MARBLE, TERRA][k], goods=[TERRA, ACCENT_L, MARBLE, (120, 150, 200)])
    ex.jetty(T, 0.115, 0.70, 'v', 0.05)
    ex.jetty(T, 0.395, 0.71, 'u', 0.05)
    ex.buoy(T, 0.27, 0.80)
    ex.rock_in_water(T, 0.335, 0.79, 0.7)
    ex.rock_in_water(T, 0.05, 0.635, 0.6)
    for (a, b) in ((0.04, 0.565), (0.20, 0.585), (0.33, 0.69), (0.44, 0.86), (0.075, 0.70), (0.21, 0.80)):
        pr.reeds(T, a, b, 3)
    ex.fence(T, [(0.865, 0.395), (0.955, 0.395), (0.955, 0.46)], h=0.012, c=WOOD)
    ex.laundry(T, (0.055, 0.905, 0.03), (0.11, 0.93, 0.028))
    ex.potted(T, 0.845, 0.625)
    ex.water_arc(T, 'u', 0.55, 0.69, _on('colosseum', 'pyramids', 1.0))
    ex.motes(T, T.P(0.715, 0.195, 0.2), 9, 16, 30)
    # ---- on camera: a third balloon is let go and lifts off over the plateau
    bu, bv, bz = 0.925, 0.29, 0.36
    pr.balloon(T, bu, bv, bz, 1.2, c=ACCENT, c2=MARBLE)
    g = T.groups[-1]
    H = bz * ZS - 12.0

    def lift(t, age, ph):
        f = ease.in_out((t - (ev - 1.3)) / 3.0, 2.2)
        return (5.0 * math.sin(t * 0.4) * f, H * (1 - f) + 1.2 * math.sin(t * 1.1) * f + (0.5 * math.sin(t * 9) * (1 - f) if t > ev - 1.8 else 0.0))
    lift.reach = 60
    g.motion = lift
    g.reach = 60
    for (a, b) in ((0.895, 0.31), (0.955, 0.305), (0.925, 0.335)):
        person(T, a, b, shirt=MARBLE, hat=MARBLE, arms=True)
    Bp = T.P(bu, bv, 0.0)
    fl = vivid(ACCENT)

    def burner(c, tau, t, a, R):
        x = t - (ev - 1.9)
        if 0 < x < 2.4:
            f = ease.in_out((t - (ev - 1.3)) / 3.0, 2.2)
            p = Bp + np.array([0, -8.0 - (H - (H * (1 - f))) + 0.0])
            k = 0.6 + 0.4 * math.sin(t * 23)
            R.poly(c, [p + np.array([-0.9, 0]), p + np.array([0, -3.6 * k]), p + np.array([0.9, 0])], fill=fl, a=a * min(1.0, x * 3) * min(1.0, (2.4 - x) * 2))
    T.custom(burner, [Bp + np.array([-4, -H - 20]), Bp + np.array([4, 2])], stage='sky', sky=True)


# =============================================================== COLOSSEUM ====
def colosseum(T):
    ev = EV['colosseum']
    r = T.rng
    cu, cv, ru, rv = 0.335, 0.50, 0.265, 0.225
    HF, HL = 0.205, 0.128

    def rp(th, s_=1.0, z=0.0):
        a = math.radians(th)
        return (cu + ru * s_ * math.cos(a), cv + rv * s_ * math.sin(a), z)

    def H(th):
        th %= 360
        if 64 <= th <= 250:
            return HF
        if 50 <= th < 64:
            return HL + (HF - HL) * (th - 50) / 14.0
        if 250 < th <= 262:
            return HF - (HF - HL) * (th - 250) / 12.0
        return HL
    with T.at('arena'):
        # engaged columns between the arches of every tier, doubled cornices, the mast corbels of the attic
        segs = []
        for th in np.arange(134 - 4.2, -38, -8.4):
            top = H(th) - 0.004
            for (z0, z1) in ((0.006, 0.041), (0.047, 0.082), (0.088, min(top, 0.124))):
                if z1 > z0:
                    segs.append([rp(th, 1, z0), rp(th, 1, z1)])
            if top > 0.15:
                segs.append([rp(th, 1, 0.13), rp(th, 1, top)])
        T.lines(segs, 0.2, shade((236, 224, 200), 0.66), stage='detail')
        T.lines([[rp(th, 1, z) for th in range(140, -41, -5)] for z in (0.041, 0.047, 0.082, 0.088)], 0.18, shade((236, 224, 200), 0.7), stage='detail')
        T.lines([[rp(th, 1.0, HF), rp(th, 1.0, HF + 0.022)] for th in range(132, 64, -9)], 0.34, WOOD, stage='detail')
        # the hypogeum: cells under the arena floor
        T.lines([[rp(180, 0.42 * q, 0.02), rp(0, 0.42 * q, 0.02)] for q in (-0.5, 0.5)] + [[rp(90, 0.3, 0.02), rp(270, 0.3, 0.02)]], 0.2, SAND_D, stage='detail')
        # ---- on camera: the whole cavea does the wave
        seats = []
        rr_ = random.Random(4)
        for th in range(156, 386, 7):
            for (s_, z) in ((0.60, 0.05), (0.72, 0.082), (0.83, 0.108)):
                if rr_.random() < 0.82:
                    seats.append((th + rr_.uniform(-2, 2), np.array(T.P3(rp(th, s_, z))), vivid(rr_.choice(CLOTH + [ACCENT, ROSE])), vivid(rr_.choice(SKIN)), rr_.uniform(0, 6.28)))

        def wave(c, tau, t, a, R):
            if tau < 1.25:
                return
            env = 0.25 + 0.75 * math.exp(-((t - ev) / 1.5) ** 2)
            on = min(1.0, (tau - 1.25) / 0.3) * a
            for (th, p, col, skin, ph) in seats:
                d = (math.radians(th) - (t - ev) * 2.6) % TAU
                up = max(0.0, math.cos(d)) ** 8 * env
                y = p[1] - 1.6 * up - 0.2 * math.sin(t * 3 + ph)
                R.pf.setColor(argb(col, on))
                c.drawRect(skia.Rect.MakeLTRB(p[0] - 0.75, y - 2.4, p[0] + 0.75, y), R.pf)
                R.pf.setColor(argb(skin, on))
                c.drawCircle(float(p[0]), float(y - 3.1), 0.82, R.pf)
                if up > 0.3:
                    R.ps.setColor(argb(skin, on))
                    R.ps.setStrokeWidth(0.36)
                    c.drawLine(float(p[0] - 0.7), float(y - 2.2), float(p[0] - 1.5), float(y - 4.2 - up), R.ps)
                    c.drawLine(float(p[0] + 0.7), float(y - 2.2), float(p[0] + 1.5), float(y - 4.2 - up), R.ps)
        C = np.array(T.P(cu, cv))
        T.custom(wave, [C + np.array([-40, -30]), C + np.array([40, 16])], stage='life')
    with T.at('ground'):
        # cobbles laid in rings round the amphitheatre; a lawn full of poppies
        T.lines([[rp(th, q, 0) for th in range(a0, a0 + 26, 5)] for q in (1.08, 1.16, 1.24) for a0 in range(-30, 150, 34)], 0.18, STONE_D, stage='detail')
        ex.flowers(T, [(0.02, 0.02), (0.6, 0.02), (0.62, 0.22), (0.5, 0.2), (0.08, 0.22), (0.02, 0.34)], 24, cols=[TERRA, MARBLE, ACCENT_L])
        ex.flowers(T, [(0.6, 0.72), (0.84, 0.72), (0.98, 0.76), (0.98, 0.98), (0.6, 0.98)], 22, cols=[TERRA, MARBLE, BLOSSOM])
    for th in (148, 118, 88, 58, 28, -2):
        p = rp(th, 1.3)
        ex.lamp_post(T, p[0], p[1])
    for (a, b, d) in ((0.10, 0.74, 'u'), (0.50, 0.90, 'u'), (0.62, 0.60, 'v'), (0.04, 0.50, 'v')):
        ex.bench(T, a, b, d)
    T.cyl(0.14, 0.925, 0.03, 0.01, c=MARBLE, guide=False, ink=0.32)
    T.disk(0.14, 0.925, 0.024, 0.01, fill=WATER, ink=0.2, stage='detail')
    fountain(T, 0.14, 0.925, 0.012, h=7.0, n=3, spread=2.4)
    for k, (a, b) in enumerate(((0.63, 0.68), (0.68, 0.705), (0.60, 0.735))):                     # cafe tables under parasols
        U = T.P(a, b)
        T.ell2(U + np.array([0, -1.4]), 1.5, 0.75, fill=MARBLE, ink=0.24, n=9, wob=0, stage='detail')
        T.line2(U, [(0, 0), (0, -5.4)], 0.26, stage='detail')
        T.poly2(U, [(-3.6, -4.4), (0, -6.8), (3.6, -4.4), (0, -3.4)], [ACCENT, MARBLE, TERRA][k], 0.28, wob=0, stage='detail')
    ex.stall(T, 0.02, 0.80, TERRA)
    ex.laundry(T, (0.865, 0.105, 0.05), (0.925, 0.105, 0.055))
    ex.laundry(T, (0.875, 0.2, 0.04), (0.92, 0.245, 0.05))
    ex.potted(T, 0.845, 0.115)
    ex.potted(T, 0.905, 0.355)
    ex.jetty(T, 0.625, 0.20, 'u', 0.04)
    ex.buoy(T, 0.735, 0.30)
    ex.rock_in_water(T, 0.76, 0.48, 0.7)
    ex.water_arc(T, 'v', 0.65, 0.79, _on('eiffel', 'colosseum', 1.0))
    ex.motes(T, T.P(cu, cv, 0.2), 9, 26, 26)
    # pigeons everywhere on the piazza - and then, all at once, not
    perches = [T.P(0.14 + 0.44 * rr_.random(), 0.80 + 0.12 * rr_.random()) for _ in range(22)] + [T.P3(rp(th, 1.0, H(th))) for th in range(126, 60, -11)]
    ex.burst_flock(T, perches, ev - 0.1, c=(190, 194, 206), up=34, spread=30)


# ============================================================== GREAT WALL ====
def greatwall(T):
    ev = EV['greatwall']
    with T.at('ground'):
        path_line(T, [(0.40, 0.875), (0.56, 0.885), (0.66, 0.70), (0.66, 0.60), (0.80, 0.585)])
        ex.flowers(T, [(0.36, 0.60), (0.66, 0.58), (0.68, 0.86), (0.38, 0.98), (0.2, 0.98)], 30, cols=[BLOSSOM, MARBLE, ACCENT_L, (178, 150, 220)])
        ex.flowers(T, [(0.56, 0.02), (0.6, 0.02), (0.66, 0.36), (0.58, 0.44)], 10)
    for (a, b, k) in ((0.60, 0.10, 'willow'), (0.635, 0.30, 'willow'), (0.86, 0.33, 'bamboo'), (0.93, 0.44, 'bamboo'), (0.70, 0.50, 'bamboo'), (0.585, 0.60, 'willow')):
        tree(T, a, b, 0.85, FOREST if k != 'bamboo' else (120, 190, 110), k)
    ex.rocks(T, [(0.60, 0.50), (0.36, 0.98), (0.98, 0.60), (0.55, 0.93)], 0.7)
    ex.jetty(T, 0.80, 0.455, 'u', 0.04)
    ex.rock_in_water(T, 0.70, 0.12, 0.7)
    ex.rock_in_water(T, 0.88, 0.44, 0.6)
    ex.fence(T, [(0.30, 0.905), (0.30, 0.80), (0.40, 0.79)], h=0.012, c=WOOD)
    ex.stall(T, 0.50, 0.80, ACCENT)
    ex.stall(T, 0.555, 0.82, MARBLE)
    ex.lamp_post(T, 0.80, 0.60, h=0.04)
    # a string of red lanterns across the pavilion court
    a, b = np.array(T.P(0.80, 0.60, 0.04)), np.array(T.P(0.86, 0.565, 0.085))
    pts = [a + (b - a) * q + np.array([0, 1.4 * math.sin(math.pi * q)]) for q in np.linspace(0, 1, 7)]
    T.line2((0, 0), pts, 0.2, DARK, stage='detail')
    for p in pts[1:-1]:
        T.ell2(p + np.array([0, 1.0]), 0.75, 0.95, fill=ACCENT, ink=0.2, n=8, wob=0, stage='detail')
    pr.smoke(T, T.P(0.445, 0.305, 0.27), 1.0, lean=9, rise=22)                     # the beacon is lit
    ex.water_arc(T, 'v', 0.62, 0.74, _on('everest', 'greatwall', 1.0))
    ex.motes(T, T.P(0.30, 0.55, 0.2), 8, 28, 26)
    # ---- on camera: lanterns are released from the pavilion (the kite loops; see the builder)
    ex.lanterns(T, T.P(0.84, 0.62, 0.02), n=9, spread=24, rise=86, t_ev=ev - 0.5)
    ex.lanterns(T, T.P(0.30, 0.86, 0.03), n=3, spread=14, rise=70, period=15.0)


# ===================================================================== TAJ ====
def taj(T):
    ev = EV['taj']
    Z0, Z1 = 0.03, 0.168
    INL = (150, 170, 200)
    with T.at('tomb'):
        seg = []
        # pietra-dura frames round each great arch, with a band of script along the top
        for inset in (0.004, 0.009):
            seg.append([(0.372 + inset, 0.3375, Z0 + 0.004), (0.372 + inset, 0.3375, Z0 + 0.15 - inset), (0.448 - inset, 0.3375, Z0 + 0.15 - inset), (0.448 - inset, 0.3375, Z0 + 0.004)])
            seg.append([(0.5175, 0.192 + inset, Z0 + 0.004), (0.5175, 0.192 + inset, Z0 + 0.15 - inset), (0.5175, 0.268 - inset, Z0 + 0.15 - inset), (0.5175, 0.268 - inset, Z0 + 0.004)])
        T.lines(seg, 0.2, INL, stage='detail')
        T.lines([[(0.384 + 0.0068 * k, 0.3375, Z0 + 0.1435), (0.387 + 0.0068 * k, 0.3375, Z0 + 0.1435)] for k in range(9)] +
                [[(0.5175, 0.204 + 0.0068 * k, Z0 + 0.1435), (0.5175, 0.207 + 0.0068 * k, Z0 + 0.1435)] for k in range(9)], 0.42, DARK, stage='detail')
        # flowers in the spandrels, a dado of blossoms, jali screens in the side niches
        for (a, z) in ((0.383, 0.125), (0.437, 0.125)):
            T.ell2(T.P(a, 0.3375, Z0 + z), 0.8, fill=ROSE, ink=0.14, n=6, wob=0, stage='detail')
            T.ell2(T.P(0.5175, a - 0.18, Z0 + z), 0.8, fill=ROSE, ink=0.14, n=6, wob=0, stage='detail')
        T.lines([[(0.314 + 0.0125 * k, 0.33, Z0 + 0.006), (0.318 + 0.0125 * k, 0.33, Z0 + 0.006)] for k in range(16) if not 4 < k < 11] +
                [[(0.51, 0.134 + 0.0125 * k, Z0 + 0.006), (0.51, 0.138 + 0.0125 * k, Z0 + 0.006)] for k in range(16) if not 4 < k < 11], 0.5, (120, 190, 120), stage='detail')
        T.lines([[(0.31, 0.33, Z1 - 0.006), (0.51, 0.33, Z1 - 0.006)], [(0.51, 0.13, Z1 - 0.006), (0.51, 0.33, Z1 - 0.006)],
                 [(0.31, 0.33, Z0 + 0.074), (0.372, 0.33, Z0 + 0.074)], [(0.448, 0.33, Z0 + 0.074), (0.51, 0.33, Z0 + 0.074)],
                 [(0.51, 0.13, Z0 + 0.074), (0.51, 0.192, Z0 + 0.074)], [(0.51, 0.268, Z0 + 0.074), (0.51, 0.33, Z0 + 0.074)]], 0.2, INL, stage='detail')
        # the dome: a collar of lotus petals, faint ribs
        zb = Z1 + 0.038
        k_ = math.sqrt(2) * W
        C = np.array(T.P(0.41, 0.23, zb))
        R_ = 0.058 * k_
        scal = []
        for x in np.arange(-R_ * 0.92, R_ * 0.9, 3.0):
            ys = [0.5 * math.sqrt(max(0.0, R_ ** 2 - q * q)) for q in (x, x + 1.5, x + 3.0)]
            scal.append([(x, ys[0]), (x + 1.5, ys[1] - 2.2), (x + 3.0, ys[2])])
        T.lines2(C, scal, 0.2, INL, wob=0, stage='detail')
        onion = [(0.058, 0), (0.067, 0.018), (0.072, 0.045), (0.069, 0.07), (0.058, 0.092), (0.04, 0.112), (0.022, 0.126), (0.009, 0.136), (0.0, 0.146)]
        for f in (-0.55, 0.0, 0.5):
            T.line2(C, [(rr * k_ * f, -hh * ZS + 0.5 * rr * k_ * math.sqrt(max(0.0, 1 - f * f))) for rr, hh in onion], 0.16, (196, 204, 220), wob=0, stage='detail')
        # minarets: banded masonry
        for (mu, mv) in ((0.24, 0.08), (0.58, 0.08), (0.24, 0.38), (0.58, 0.38)):
            M = np.array(T.P(mu, mv, Z0))
            T.lines2(M, [[(-0.0125 * k_ * (1 - 0.2 * q / 9.0), -q * 0.0205 * ZS), (0.0125 * k_ * (1 - 0.2 * q / 9.0), -q * 0.0205 * ZS)] for q in range(1, 9) if q not in (3, 6)], 0.16, (196, 204, 220), wob=0, stage='detail')
    with T.at('ground'):
        # paving joints on the walks, clipped borders round every lawn
        T.lines([[(0.355, 0.44 + 0.03 * k), (0.392, 0.44 + 0.03 * k)] for k in range(15)] + [[(0.428, 0.44 + 0.03 * k), (0.465, 0.44 + 0.03 * k)] for k in range(15)] +
                [[(0.06 + 0.035 * k, 0.615), (0.06 + 0.035 * k, 0.665)] for k in range(21)], 0.16, STONE_D, stage='detail')
        for (a, b, c_, d_) in ((0.09, 0.475, 0.32, 0.585), (0.50, 0.475, 0.73, 0.585), (0.09, 0.695, 0.32, 0.845), (0.50, 0.695, 0.73, 0.845)):
            T.lines([[(a + 0.012, b + 0.012), (c_ - 0.012, b + 0.012), (c_ - 0.012, d_ - 0.012), (a + 0.012, d_ - 0.012), (a + 0.012, b + 0.012)]], 0.5, (120, 190, 110), stage='detail')
            ex.flowers(T, [(a + 0.02, b + 0.02), (c_ - 0.02, b + 0.02), (c_ - 0.02, d_ - 0.02), (a + 0.02, d_ - 0.02)], 12, cols=[ROSE, MARBLE, BLOSSOM, (178, 150, 220)])
        ex.flowers(T, [(0.78, 0.44), (0.98, 0.5), (0.98, 0.9), (0.78, 0.9)], 16)
    for v in (0.46, 0.56, 0.70, 0.80):
        ex.lamp_post(T, 0.35, v, h=0.036)
        ex.lamp_post(T, 0.47, v, h=0.036)
    for (a, b, d) in ((0.30, 0.628, 'u'), (0.50, 0.628, 'u'), (0.20, 0.652, 'u'), (0.62, 0.652, 'u')):
        ex.bench(T, a, b, d)
    for k, a in enumerate((0.06, 0.19, 0.60, 0.70, 0.90)):
        ex.stall(T, a, 0.94, [ACCENT, ROSE, MARBLE, ACCENT, TERRA][k], goods=[ACCENT, ROSE, MARBLE, ACCENT_L])
    ex.jetty(T, 0.775, 0.20, 'u', 0.04)
    ex.rock_in_water(T, 0.90, 0.20, 0.6)
    ex.gap_bridge(T, 'u', 0.775, _on('pyramids', 'taj', 1.1), kind='stone', n_walk=3)
    ex.water_arc(T, 'v', 0.72, 0.84, _on('fuji', 'taj', 1.0))
    ex.motes(T, T.P(0.41, 0.23, 0.34), 10, 18, 30, c=(255, 244, 214))
    # ---- on camera: the fountains are switched on down the length of the pools, and the doves go up
    for k, v in enumerate((0.47, 0.50, 0.53, 0.56, 0.59)):
        fountain(T, 0.41, v, 0.0, h=6.5, n=3, spread=1.6, t_on=ev - 1.3 + 0.13 * k)
    for k, v in enumerate((0.70, 0.74, 0.78, 0.82, 0.85)):
        fountain(T, 0.41, v, 0.0, h=6.5, n=3, spread=1.6, t_on=ev - 0.6 + 0.13 * k)
    rr_ = random.Random(8)
    perches = [T.P(0.23 + 0.36 * rr_.random(), 0.35 + 0.05 * rr_.random(), 0.03) for _ in range(16)] + \
              [T.P(0.12 + 0.18 * rr_.random(), 0.50 + 0.06 * rr_.random()) for _ in range(7)] + [T.P(0.52 + 0.18 * rr_.random(), 0.50 + 0.06 * rr_.random()) for _ in range(7)]
    ex.burst_flock(T, perches, ev, c=MARBLE, up=38, spread=34)


# ================================================================== EIFFEL ====
def eiffel(T):
    ev = EV['eiffel_stonehenge']
    cu, cv = 0.40, 0.43
    ctrl = [(0.0, 0.135), (0.07, 0.108), (0.14, 0.082), (0.155, 0.08), (0.22, 0.060), (0.29, 0.044), (0.31, 0.042), (0.42, 0.027), (0.55, 0.017), (0.68, 0.010), (0.76, 0.0075)]

    def hw(z):
        for k in range(len(ctrl) - 1):
            if ctrl[k][0] <= z <= ctrl[k + 1][0]:
                t_ = (z - ctrl[k][0]) / (ctrl[k + 1][0] - ctrl[k][0])
                return ctrl[k][1] + (ctrl[k + 1][1] - ctrl[k][1]) * t_
        return ctrl[-1][1]

    def fpt(face, a, z):
        w = hw(z)
        return (cu + a * w, cv + w, z) if face == 'L' else (cu + w, cv + a * w, z)
    with T.at('tower'):
        with T.grp('tower', t0=0.40, dur=0.36, pivot=T.P(cu, cv), stage='struct', ink_now=True):
            dk = shade(ACCENT_D, 0.62)
            for face in ('L', 'R'):
                segs = []
                # the iron lattice: a second, finer web of diagonals, and the verticals of the upper shaft
                for k in range(23):
                    za, zb = 0.305 + 0.0198 * k, 0.305 + 0.0198 * (k + 1)
                    segs.append([fpt(face, -1 if k % 2 else 1, za), fpt(face, 1 if k % 2 else -1, zb)])
                    segs.append([fpt(face, -1, zb), fpt(face, 1, zb)])
                for a in (-0.34, 0.34):
                    segs.append([fpt(face, a, z) for z in np.linspace(0.305, 0.75, 10)])
                for (z0, z1, leg) in ((0.0, 0.135, 0.36), (0.16, 0.285, 0.42)):
                    for sg in (-1, 1):
                        for k in range(6):
                            za, zb = z0 + (z1 - z0) * k / 6.0, z0 + (z1 - z0) * (k + 1) / 6.0
                            segs.append([fpt(face, sg * (1.0 if k % 2 else 1 - leg), za), fpt(face, sg * (1 - leg if k % 2 else 1.0), zb)])
                            segs.append([fpt(face, sg * 1.0, zb), fpt(face, sg * (1 - leg), zb)])
                T.lines(segs, 0.16, dk, stage='detail')
                # railings round the platforms
                for (zz, wq) in ((0.156, 0.092), (0.302, 0.05)):
                    pts = [(cu - wq + 2 * wq * q / 10.0, cv + wq, zz) for q in range(11)] if face == 'L' else [(cu + wq, cv - wq + 2 * wq * q / 10.0, zz) for q in range(11)]
                    T.lines([[p, (p[0], p[1], zz + 0.008)] for p in pts] + [[(p[0], p[1], zz + 0.008) for p in pts]], 0.18, dk, stage='detail')
        # ---- on camera: the lift climbs the shaft, and at the top the whole tower bursts into sparkle
        A_, B_ = np.array(T.P3(fpt('L', 0.0, 0.31))), np.array(T.P3(fpt('L', 0.0, 0.74)))
        AL = vivid(ACCENT_L)

        def lift(c, tau, t, a, R):
            if tau < 1.3:
                return
            f = ease.in_out((t - (ev - 1.5)) / 2.2, 2.0)
            p = A_ + (B_ - A_) * f
            R.pf.setColor(argb(vivid(MARBLE), a))
            c.drawRect(skia.Rect.MakeLTRB(p[0] - 1.1, p[1] - 2.6, p[0] + 1.1, p[1]), R.pf)
            R.pf.setColor(argb(AL, a * (0.7 + 0.3 * math.sin(t * 9))))
            c.drawRect(skia.Rect.MakeLTRB(p[0] - 0.7, p[1] - 2.1, p[0] + 0.7, p[1] - 0.9), R.pf)
            R.ps.setColor(argb(INK, a))
            R.ps.setStrokeWidth(0.24)
            c.drawRect(skia.Rect.MakeLTRB(p[0] - 1.1, p[1] - 2.6, p[0] + 1.1, p[1]), R.ps)
        T.custom(lift, [B_ + np.array([-3, -4]), A_ + np.array([3, 2])], stage='life')
    rr_ = random.Random(2)
    pts = []
    for k in range(60):
        z = 0.03 + 0.74 * rr_.random()
        a = rr_.uniform(-1, 1)
        pts.append(np.array(T.P3(fpt('L' if k % 2 else 'R', a, z))))

    def burst(c, tau, t, a, R):
        env = math.exp(-((t - ev - 0.5) / 0.9) ** 2)
        if env < 0.03:
            return
        for k, p in enumerate(pts):
            f = (t * 2.3 + k * 0.618) % 1.0
            if f > 0.35:
                continue
            q = 2.6 * env * math.sin(math.pi * f / 0.35)
            star = [p + np.array([0, -q]), p + np.array([q * 0.2, -q * 0.2]), p + np.array([q, 0]), p + np.array([q * 0.2, q * 0.2]),
                    p + np.array([0, q]), p + np.array([-q * 0.2, q * 0.2]), p + np.array([-q, 0]), p + np.array([-q * 0.2, -q * 0.2])]
            R.poly(c, star, fill=MARBLE, ink=ACCENT_D, w=0.16, a=a * env)
    T.custom(burst, [np.array(T.P(cu - 0.15, cv + 0.15, 0.8)), np.array(T.P(cu + 0.15, cv - 0.15, 0.0)), np.array(T.P(cu - 0.15, cv + 0.15, 0.0))], stage='sky', sky=True)
    with T.at('ground'):
        for (a, b, c_, d_) in ((0.02, 0.29, 0.10, 0.40), (0.13, 0.29, 0.21, 0.40), (0.02, 0.46, 0.10, 0.57), (0.13, 0.46, 0.21, 0.57)):
            ex.flowers(T, [(a + 0.008, b + 0.008), (c_ - 0.008, b + 0.008), (c_ - 0.008, d_ - 0.008), (a + 0.008, d_ - 0.008)], 9, cols=[TERRA, MARBLE, ACCENT_L, BLOSSOM])
            T.lines([[(a + 0.04, b), (a + 0.04, d_)], [(a, (b + d_) / 2), (c_, (b + d_) / 2)]], 0.3, (238, 231, 216), stage='detail')
        T.lines([[(0.56, 0.05 * k), (0.65, 0.05 * k)] for k in range(1, 20)] + [[(0.79, 0.05 * k), (0.84, 0.05 * k)] for k in range(1, 20)] +
                [[(0.03 + 0.045 * k, 0.25), (0.03 + 0.045 * k, 0.61)] for k in range(5, 12)], 0.14, STONE_D, stage='detail')
    # bouquinistes' green boxes along the quay wall, benches, a Morris column, a metro entrance
    for v in (0.05, 0.10, 0.20, 0.30, 0.55, 0.66, 0.86, 0.93):
        T.box(0.636, v, 0.012, 0.03, 0.012, c=(70, 130, 96), ink=0.24, guide=False, stage='detail')
    for (a, b, d) in ((0.26, 0.615, 'u'), (0.44, 0.615, 'u'), (0.575, 0.30, 'v'), (0.575, 0.84, 'v'), (0.80, 0.70, 'v')):
        ex.bench(T, a, b, d)
    T.cyl(0.535, 0.60, 0.011, 0.04, c=(70, 130, 96), guide=False, ink=0.3)
    T.dome(0.535, 0.60, 0.013, 0.012, z=0.04, c=(70, 130, 96), guide=False, ink=0.28)
    T.poly2(T.P(0.535, 0.60, 0.014), [(-1.2, 0), (1.2, 0.6), (1.2, -2.0), (-1.2, -2.6)], ACCENT_L, 0.16, wob=0, stage='detail')
    ex.fence(T, [(0.02, 0.805), (0.05, 0.805)], h=0.016, c=(70, 130, 96))
    ex.jetty(T, 0.652, 0.60, 'v', 0.07)
    ex.buoy(T, 0.70, 0.34)
    ex.buoy(T, 0.75, 0.88, MARBLE)
    for (a, b) in ((0.045, 0.775), (0.125, 0.775), (0.235, 0.775), (0.365, 0.775), (0.455, 0.775)):
        ex.potted(T, a, b)
    for (a, b) in ((0.985, 0.34), (0.985, 0.52), (0.86, 0.54), (0.03, 0.22), (0.53, 0.22)):
        tree(T, a, b, 0.8, FOREST, 'poplar')


# ================================================================= EVEREST ====
def everest(T):
    ev = EV['aurora_everest']
    A = np.array(T.P3((0.02, 0.52, 0.0)))
    B = np.array(T.P3((0.34, 0.33, 0.84)))
    with T.at('peaks'):
        # the route: a trail switching back up the lower face to the ridge, fixed ropes on the crest
        base = np.array(T.P(0.36, 0.80))
        zz = [base + np.array([-8.0 * (k % 2) - 2.0 * k, -5.0 * k]) for k in range(9)]
        T._add([[zz[k] + (zz[k + 1] - zz[k]) * q, zz[k] + (zz[k + 1] - zz[k]) * (q + 0.22)] for k in range(8) for q in (0.05, 0.38, 0.7)], False, None, 0.3, (236, 228, 212), stage='detail', raw=True)
        T.line2((0, 0), [A + (B - A) * q + np.array([0, -1.0]) for q in np.linspace(0.3, 1.0, 9)], 0.18, DARK, stage='detail')
        T.lines2((0, 0), [[A + (B - A) * q, A + (B - A) * q + np.array([0, -2.0])] for q in np.linspace(0.3, 0.96, 8)], 0.22, DARK, stage='detail')
        # cornices of blown snow on the summit ridges
        T.lines2((0, 0), [[B + np.array([1.5 + 2 * k, 3.0 + 6.5 * k]), B + np.array([5.5 + 2.4 * k, 3.4 + 6.5 * k]), B + np.array([4.5 + 2.4 * k, 5.4 + 6.5 * k])] for k in range(5)], 0.22, (150, 186, 214), stage='detail')
    # the Khumbu icefall: seracs, crevasses bridged by ladders, Camp I above it
    for k, (a, b) in enumerate(((0.52, 0.64), (0.57, 0.67), (0.61, 0.72), (0.65, 0.78), (0.67, 0.84), (0.55, 0.71))):
        T.box(a, b, 0.016, 0.014, 0.008 + 0.004 * (k % 3), c=ICE, top=SNOW, ink=0.26, guide=False, stage='detail')
    T.lines([[(0.585, 0.695), (0.615, 0.70)], [(0.59, 0.70), (0.62, 0.705)]] + [[(0.59 + 0.006 * k, 0.6955 + 0.001 * k), (0.591 + 0.006 * k, 0.7005 + 0.001 * k)] for k in range(5)], 0.2, WOOD, stage='detail')
    for k, (a, b) in enumerate(((0.56, 0.60), (0.60, 0.585))):
        with T.grp('pop', pivot=T.P(a, b), stage='life', dur=0.25):
            T.dome(a, b, 0.016, 0.016, c=ACCENT if k else MARBLE, guide=False, ink=0.3)
    ex.rocks(T, [(0.30, 0.82), (0.24, 0.86), (0.70, 0.94), (0.96, 0.70), (0.62, 0.93), (0.48, 0.84)], 0.7, c=ROCK)
    for (a, b) in ((0.26, 0.835), (0.73, 0.83), (0.955, 0.62)):                                 # cairns
        for q in range(3):
            T.ell2(T.P(a, b, 0.006 * q) + np.array([0, -0.6]), 1.5 - 0.4 * q, 0.8 - 0.15 * q, fill=ROCK, ink=0.22, n=8, wob=0, stage='detail')
    # more prayer flags, strung from the chorten to a cairn
    top, end = np.array(T.P(0.89, 0.87, 0.08)), np.array(T.P(0.73, 0.83, 0.02))
    pts = [top + (end - top) * q + np.array([0, 5.0 * math.sin(math.pi * q)]) for q in np.linspace(0, 1, 14)]
    T.line2((0, 0), pts, 0.2, stage='detail')
    cols = [WATER_D, MARBLE, ACCENT, GRASS_D, TERRA]
    for k in range(1, 13):
        with T.grp('grow', pivot=pts[k], stage='life', dur=0.2, motion=lambda t, age, ph: (0.0, 0.0, 6 * math.sin(t * 7 + ph), 1.0, 1.0)):
            T.poly2(pts[k], [(-0.7, 0), (0.7, 0), (0.7, 1.9), (-0.7, 1.9)], cols[k % 5], 0.16, wob=0)
    ex.flowers(T, [(0.02, 0.84), (0.2, 0.9), (0.44, 0.84), (0.56, 0.92), (0.56, 0.99), (0.02, 0.99)], 18, cols=[(178, 150, 220), MARBLE, BLOSSOM])
    ex.motes(T, B + np.array([0, -4]), 9, 14, 30, c=(255, 250, 230))
    # ---- on camera: the summit team climbs the last of the ridge, and plants its flag
    def climb(t, age, ph):
        f = ease.in_out((t - (ev - 2.5)) / 2.3, 2.0)
        d = (B - A) * (0.74 + 0.25 * f) - (B - A) * 0.74
        st = abs(math.sin(t * 7)) * 0.5 * (1 if 0 < f < 1 else 0)
        return (d[0], d[1] - st)
    climb.reach = 60
    S0 = A + (B - A) * 0.74
    with T.grp('pop', pivot=S0, motion=climb, stage='life', dur=0.2):
        T.line2(S0, [(-9.0, 12.0), (0.0, -2.2)], 0.18, DARK)
        for k, col in enumerate((TERRA, MARBLE, ACCENT)):
            p = S0 + np.array([-9.0 + 4.5 * k, 12.0 - 6.0 * k])
            T.lines2(p, [[(-0.45, 0), (-0.4, -1.5)], [(0.45, 0), (0.4, -1.5)]], 0.45, DARK, wob=0)
            T.poly2(p, [(-0.8, -1.3), (0.8, -1.3), (0.7, -3.3), (-0.7, -3.3)], col, 0.24, wob=0)
            T.ell2(p + np.array([0, -4.1]), 0.9, fill=SKIN[k], ink=0.24, n=9, wob=0)
            T.poly2(p, [(-1.4, -3.2), (-0.7, -3.2), (-0.7, -1.6), (-1.4, -1.6)], DARK, 0.2, wob=0)
    with T.st('sky'):
        with T.grp(None, pivot=B, motion=ex.appear(ev - 0.05, 0.4), stage='sky'):
            pr.flag(T, B, ACCENT, 1.15, 6.5, sky=True)
    echo_rings(T, B + np.array([0, -3]), ev, n=3, r0=3, r1=20, c=ACCENT)


def aurora(T):
    ev = EV['aurora_everest']
    # ice-fishing, a snowman, the dog team, cracks in the floe
    T.lines([[(0.36, 0.72), (0.42, 0.78), (0.40, 0.84)], [(0.66, 0.66), (0.72, 0.70)], [(0.30, 0.42), (0.26, 0.36)]], 0.24, (150, 186, 214), stage='detail')
    T.disk(0.66, 0.74, 0.016, fill=DEEP, ink=0.26, stage='detail')
    Q = person(T, 0.70, 0.76, shirt=TERRA, hat=ACCENT)
    T.line2(Q, [(-1.2, -4.0), (-5.0, -6.5), (-5.6, 1.4)], 0.2, DARK, stage='detail')
    Sn = T.P(0.36, 0.44)
    T.ell2(Sn + np.array([0, -1.6]), 1.8, 1.6, fill=SNOW, ink=0.3, n=10, wob=0, stage='detail')
    T.ell2(Sn + np.array([0, -4.2]), 1.2, 1.1, fill=SNOW, ink=0.3, n=9, wob=0, stage='detail')
    T.poly2(Sn + np.array([0, -4.2]), [(0.2, -0.2), (1.8, 0.1), (0.2, 0.3)], ACCENT, 0.16, wob=0, stage='detail')
    for k in range(3):
        pr.quad(T, 0.20 + 0.035 * k, 0.60 - 0.012 * k, 3.4, 1.7, 1.3, (0.8, -0.8), (1.2, 0.85), (150, 150, 156) if k % 2 else MARBLE, s=0.75, walk=walker(0.06, -0.02, 7), ph=0.4)
    ex.motes(T, T.P(0.5, 0.5, 0.2), 8, 24, 34, c=(170, 255, 214))


# ==================================================================== FUJI ====
def fuji(T):
    ev = EV['fuji']
    cu, cv = 0.645, 0.245
    C = np.array(T.P(cu, cv))
    with T.at('cone'):
        # the pilgrims' trail zig-zagging up through the stations
        zz = [C + np.array([-22.0 + 5.0 * k + 6.0 * (k % 2), -5.0 - 4.6 * k]) for k in range(9)]
        T._add([[zz[k] + (zz[k + 1] - zz[k]) * q, zz[k] + (zz[k + 1] - zz[k]) * (q + 0.24)] for k in range(8) for q in (0.04, 0.38, 0.72)], False, None, 0.3, (236, 228, 212), stage='detail', raw=True)
        for k in (2, 4, 6):
            T.poly2(zz[k], [(-1.3, 0), (1.3, 0), (1.3, -1.5), (0, -2.4), (-1.3, -1.5)], MARBLE, 0.2, wob=0, stage='detail')
        # scoria gullies and the dark belt of forest round its foot
        T.lines2(C, [[(x, -6.0 - 0.3 * abs(x)), (x * 0.8 + 1.0, -17.0 + 0.1 * abs(x))] for x in (-24, -15, -7, 2, 10, 18, 25)], 0.2, shade((150, 166, 198), 0.76), stage='detail')
    for k in range(13):
        a = math.radians(-34 + 13.5 * k)
        tree(T, cu + 0.236 * math.cos(a), cv + 0.236 * math.sin(a), 0.62, JUNGLE if k % 2 else FOREST, 'fir')
    with T.at('ground'):
        path_line(T, [(0.04, 0.70), (0.16, 0.80), (0.30, 0.86), (0.52, 0.915), (0.66, 0.93)])
        path_line(T, [(0.60, 0.50), (0.76, 0.50), (0.86, 0.47)])
        ex.flowers(T, [(0.02, 0.62), (0.2, 0.74), (0.5, 0.86), (0.66, 0.92), (0.66, 0.99), (0.02, 0.99)], 36, cols=[BLOSSOM, MARBLE, ROSE])
        ex.flowers(T, [(0.02, 0.02), (0.36, 0.02), (0.4, 0.34), (0.02, 0.36)], 18)
    lotus(T, [(0.10, 0.50), (0.14, 0.53), (0.24, 0.60), (0.44, 0.74), (0.48, 0.70), (0.60, 0.80), (0.20, 0.54), (0.36, 0.60)])
    ex.jetty(T, 0.245, 0.705, 'v', 0.05)
    ex.jetty(T, 0.60, 0.585, 'v', 0.045)
    ex.buoy(T, 0.46, 0.62)
    ex.rock_in_water(T, 0.30, 0.56, 0.7)
    ex.rock_in_water(T, 0.66, 0.76, 0.6)
    for (a, b) in ((0.30, 0.70), (0.455, 0.755)):                                               # stone lanterns
        T.box(a, b, 0.012, 0.012, 0.03, c=STONE, ink=0.26, guide=False)
        T.pyr(a - 0.006, b - 0.006, 0.024, 0.024, 0.012, z=0.03, c=STONE_D, ink=0.26, guide=False)
        pr.lamp(T, T.P(a + 0.012, b + 0.012, 0.022), 0.6, ACCENT_L, halo=False)
    for (a, b) in ((0.56, 0.66), (0.20, 0.42), (0.34, 0.47)):
        tree(T, a, b, 0.8, (120, 190, 110), 'bamboo')
    tree(T, 0.50, 0.59, 0.9, FOREST, 'willow')
    ex.fence(T, [(0.79, 0.655), (0.79, 0.99)], h=0.012, c=WOOD)
    ex.gap_bridge(T, 'u', 0.092, _on('greatwall', 'fuji', 1.1), w=0.04, kind='wall', n_walk=2)
    T.box(0.012, 0.085, 0.05, 0.05, 0.07, c=(226, 218, 204), ink=0.4, guide=False)                # the Wall's last tower stands on Fuji's shore
    T.box(0.006, 0.079, 0.062, 0.062, 0.013, z=0.07, c=(240, 233, 218), ink=0.36, guide=False)
    T.arch('L', 0.037, 0.135, 0.012, 0.016, 0.034, fill=(104, 90, 84), ink=0.2)
    pr.flag(T, T.P(0.037, 0.11, 0.083), ACCENT, 1.0, 7.0)
    ex.water_arc(T, 'u', 0.40, 0.52, _on('greatwall', 'fuji', 1.0))
    ex.motes(T, T.P(0.37, 0.66, 0.1), 8, 16, 26)
    # ---- on camera: as the shinkansen streaks through, a gust takes the blossom off the trees
    G = np.array(T.P(0.26, 0.84, 0.05))
    rr_ = random.Random(3)
    seeds = [(rr_.uniform(0, TAU), rr_.uniform(0.3, 1.0), rr_.uniform(0, 1), rr_.uniform(0.6, 1.4)) for _ in range(90)]
    bl = vivid(BLOSSOM)

    def gust(c, tau, t, a, R):
        x = t - (ev - 1.0)
        if x <= 0 or x > 4.0:
            return
        env = min(1.0, x * 1.5) * min(1.0, (4.0 - x) / 1.2)
        for (ang, rad, ph, sp) in seeds:
            th = ang + x * 1.5 * sp
            rr = (10 + 34 * rad) * (0.4 + 0.6 * min(1.0, x * 0.7))
            px = G[0] + rr * math.cos(th) + 16 * x * sp
            py = G[1] + rr * 0.42 * math.sin(th) - 7 * x + 4 * math.sin(x * 3 + ph * 9)
            R.pf.setColor(argb(bl, a * env * (0.6 + 0.4 * math.sin(x * 5 + ph * 20))))
            c.drawOval(skia.Rect.MakeXYWH(float(px), float(py), 1.3, 0.8), R.pf)
    T.custom(gust, [G + np.array([-60, -60]), G + np.array([130, 40])], stage='sky', sky=True)


# ================================================================= HA LONG ====
def halong(T):
    ev = EV['opera_halong']
    ks = [(0.17, 0.21, 0.065), (0.43, 0.15, 0.055), (0.71, 0.19, 0.07), (0.93, 0.36, 0.05), (0.13, 0.50, 0.06), (0.52, 0.43, 0.085), (0.30, 0.66, 0.05), (0.79, 0.64, 0.07), (0.15, 0.86, 0.07), (0.90, 0.90, 0.045)]
    wd = vivid(WATER_D)
    k_ = math.sqrt(2) * W
    with T.at('ground'):
        # each tower stands on its own reflection: a few strokes of darker water under its foot
        for (u, v, rr) in ks:
            Cc = np.array(T.P(u, v))
            T.lines2(Cc, [[(-rr * k_ * (0.9 - 0.22 * q), rr * k_ * 0.5 + 1.4 + 1.5 * q), (rr * k_ * (0.9 - 0.22 * q), rr * k_ * 0.5 + 1.4 + 1.5 * q)] for q in range(3)], 0.4, WATER_D, wob=0.1, stage='mark')
    # a floating fish farm, nets and all
    fu, fv = 0.60, 0.74
    T.poly([(fu, fv, 0.003), (fu + 0.10, fv, 0.003), (fu + 0.10, fv + 0.07, 0.003), (fu, fv + 0.07, 0.003)], None, 0.5, inkc=WOOD, stage='detail')
    T.lines([[(fu + 0.033 * k, fv, 0.003), (fu + 0.033 * k, fv + 0.07, 0.003)] for k in (1, 2)] + [[(fu, fv + 0.035, 0.003), (fu + 0.10, fv + 0.035, 0.003)]], 0.5, WOOD, stage='detail')
    T.house(fu + 0.07, fv + 0.004, 0.026, 0.024, 0.014, 0.01, wall=WATER_L, roof=TERRA, axis='u', ink=0.3, z=0.003, chimney=False)
    for (a, b) in ((0.36, 0.40), (0.66, 0.50), (0.88, 0.74), (0.44, 0.92), (0.24, 0.36)):
        ex.buoy(T, a, b, ACCENT if (a + b) % 0.2 > 0.1 else MARBLE)
    ex.jetty(T, 0.38, 0.86, 'u', 0.04)
    pr.rowboat(T, 0.86, 0.50, 'u', c=ACCENT, crew=1, motion=cruise(-0.05, 0.03, 0.7))
    pr.rowboat(T, 0.58, 0.60, 'v', c=MARBLE, crew=2, motion=cruise(0.04, 0.05, 0.6))
    ex.spill(T, 'R', 0.70, 0.80, 0.0, length=46.0, t0=1.1)
    ex.water_arc(T, 'u', 0.26, 0.40, _on('taj', 'halong', 1.0), c=(150, 214, 216))
    ex.motes(T, T.P(0.52, 0.43, 0.44), 8, 20, 26)
    # ---- on camera: a whale breaches between the karsts
    ex.breach(T, 0.47, 0.76, ev, 1.25)


def opera(T):
    ev = EV['opera_halong']
    # steps down to the forecourt, ribs on the shells, harbour furniture
    T.lines([[(0.24, 0.67 + 0.006 * k, 0.03 - 0.008 * k), (0.68, 0.67 + 0.006 * k, 0.03 - 0.008 * k)] for k in range(1, 4)], 0.2, STONE_D, stage='detail')
    ex.jetty(T, 0.70, 0.56, 'u', 0.07)
    ex.buoy(T, 0.86, 0.70)
    ex.buoy(T, 0.30, 0.90, MARBLE)
    for (a, b) in ((0.27, 0.69), (0.40, 0.69), (0.53, 0.69), (0.66, 0.69)):
        ex.lamp_post(T, a, b, z=0.0, h=0.03)
    # ---- on camera: the sails light up from within, one after another
    for k, (u, v, s) in enumerate(((0.33, 0.45, 0.50), (0.42, 0.45, 0.72), (0.53, 0.45, 0.95), (0.31, 0.60, 0.55), (0.40, 0.60, 0.8), (0.51, 0.60, 1.08))):
        P = T.P(u, v, 0.03)
        with T.grp(None, pivot=P + np.array([4.6 * s, -8.0 * s]), motion=ex.appear(ev - 0.7 + 0.16 * k, 0.4), stage='life'):
            T.poly2(P, [(6.2 * s, -18.4 * s), (6.3 * s, -12.0 * s), (5.4 * s, -4.0 * s), (4.0 * s, 2.4 * s), (2.0 * s, 1.6 * s), (3.0 * s, -5.0 * s), (4.8 * s, -13.0 * s)], ACCENT_L, 0.2, wob=0)
            T.lines2(P, [[(3.4 * s, -4 * s), (5.2 * s, -4.4 * s)], [(4.0 * s, -9 * s), (5.9 * s, -9.6 * s)], [(4.9 * s, -14 * s), (6.1 * s, -14.4 * s)]], 0.18, ACCENT, wob=0)
        echo_rings(T, P + np.array([4.6 * s, -8.0 * s]), ev - 0.7 + 0.16 * k, n=1, r0=2, r1=12, c=ACCENT)
    ex.motes(T, T.P(0.45, 0.52, 0.2), 9, 26, 28)


# ==================================================================== REEF ====
def reef(T):
    ev = EV['reef_uluru']
    TH = 0.25
    # a dive pontoon moored over the reef, with a ladder and a line of marker buoys
    pu, pv = 0.13, 0.50
    T.box(pu, pv, 0.085, 0.06, 0.006, c=(226, 196, 150), ink=0.3, guide=False)
    T.lines([[(pu + 0.0142 * k, pv, 0.006), (pu + 0.0142 * k, pv + 0.06, 0.006)] for k in range(1, 6)], 0.18, WOOD, stage='detail')
    T.poly([(pu, pv - 0.004, 0.03), (pu + 0.05, pv - 0.004, 0.03), (pu + 0.05, pv + 0.03, 0.036), (pu, pv + 0.03, 0.036)], ACCENT, 0.28, stage='detail')
    T.lines([[(pu, pv, 0.006), (pu, pv - 0.004, 0.03)], [(pu + 0.05, pv, 0.006), (pu + 0.05, pv - 0.004, 0.03)]], 0.26, DARK, stage='detail')
    crowd(T, [(pu + 0.05, pv + 0.01), (pu + 0.08, pv + 0.01), (pu + 0.08, pv + 0.05), (pu + 0.05, pv + 0.05)], 2, z=0.006, walk_frac=0, dense=1.0)
    for k in range(6):
        ex.buoy(T, 0.06 + 0.03 * k, 0.62 + 0.035 * k, ACCENT if k % 2 else MARBLE)
    for (a, b) in ((0.90, 0.46), (0.52, 0.94), (0.94, 0.80)):
        ex.buoy(T, a, b)
    ex.rock_in_water(T, 0.44, 0.10, 0.8)
    ex.motes(T, T.P(0.47, 0.585, 0.05), 8, 30, 26, c=(214, 255, 240))
    # ---- on camera: a turtle comes up for air among the snorkellers, the whale blows, a diver drops off the pontoon
    Q = np.array(T.P(0.36, 0.83))
    with T.grp(None, pivot=Q, stage='life', motion=lambda t, age, ph: (2.0 * math.sin(t * 0.6), 0.6 * math.sin(t * 1.3), 3 * math.sin(t * 0.8), min(1.0, max(0.0, (t - ev + 0.9) / 0.5)) ** 0.5,
                                                                    min(1.0, max(0.0, (t - ev + 0.9) / 0.5)) ** 0.5, min(1.0, max(0.0, (t - ev + 0.9) / 0.4)))):
        T.lines2(Q, [[(-3.6, -2.0), (3.6, 2.0)], [(-3.6, 2.0), (3.6, -2.0)]], 1.3, (150, 200, 140), wob=0)
        T.ell2(Q, 3.4, 2.4, fill=(120, 176, 120), ink=0.32, n=12, wob=0)
        T.lines2(Q, [[(-1.8, -1.4), (-0.6, 1.6)], [(0.4, -2.0), (1.0, 1.6)], [(-2.6, 0.2), (2.6, 0.0)]], 0.22, FOREST, wob=0)
        T.ell2(Q + np.array([4.2, 0.8]), 1.3, 1.0, fill=(150, 200, 140), ink=0.28, n=8, wob=0)
        T.ell2(Q + np.array([4.7, 0.6]), 0.2, fill=INK, ink=0, n=5, wob=0)
    foam = vivid(FOAM)

    def rings(c, tau, t, a, R):
        for k in range(3):
            x = (t - ev + 0.9 - 0.35 * k) / 1.4
            if 0 < x < 1:
                rr = 4 + 14 * x
                R.ps.setColor(argb(foam, a * (1 - x)))
                R.ps.setStrokeWidth(0.6)
                c.drawOval(skia.Rect.MakeLTRB(Q[0] - rr, Q[1] - rr * 0.45, Q[0] + rr, Q[1] + rr * 0.45), R.ps)
    T.custom(rings, [Q + np.array([-20, -10]), Q + np.array([20, 10])], stage='life')
    Wp = np.array(T.P(0.80, 0.63)) + np.array([5.5, -2.5])

    def blow(c, tau, t, a, R):
        x = (t - ev + 0.2) / 1.6
        if not 0 < x < 1:
            return
        k = math.sin(math.pi * x) ** 0.6
        R.ps.setStrokeWidth(0.7)
        for j in range(9):
            ang = -math.pi / 2 + (j - 4) * 0.16
            L = 16 * k * (1 - 0.06 * abs(j - 4))
            R.ps.setColor(argb(foam, a * k))
            c.drawLine(float(Wp[0]), float(Wp[1]), float(Wp[0] + L * math.cos(ang)), float(Wp[1] + L * math.sin(ang)), R.ps)
            f = (x * 2 + j * 0.3) % 1.0
            R.pf.setColor(argb(foam, a * k))
            c.drawCircle(float(Wp[0] + (L + 3 * f) * math.cos(ang) + 2 * (j - 4) * f), float(Wp[1] + (L + 3 * f) * math.sin(ang) + 9 * f * f), 0.5, R.pf)
    T.custom(blow, [Wp + np.array([-16, -22]), Wp + np.array([16, 6])], stage='sky', sky=True)
    # a second diver, with a torch, working along the right-hand wall
    def fp(a, z):
        return np.array(T.P3((1, a, z)))
    D0 = fp(0.2, -TH * 0.5)
    ax = fp(0.62, -TH * 0.44) - D0
    AL = vivid(ACCENT_L)

    def diver(c, tau, t, a, R):
        if tau < 1.3:
            return
        f = 0.5 - 0.5 * math.cos((t - ev) * 0.55 + 1.2)
        p = D0 + ax * f + np.array([0, 1.2 * math.sin(t * 1.7)])
        d = ax / np.hypot(*ax)
        R.poly(c, [p + d * 3.2, p + d * 17 + np.array([0, -4.5]), p + d * 17 + np.array([0, 5.0])], fill=AL, a=a * 0.32)
        R.poly(c, [p - d * 5.5 + np.array([0, -1.4]), p - d * 3.0, p - d * 5.5 + np.array([0, 1.6])], fill=vivid(ACCENT), ink=INK, w=0.2, a=a)
        R.poly(c, [p - d * 3.0 + np.array([0, -1.0]), p + d * 2.0 + np.array([0, -1.1]), p + d * 2.0 + np.array([0, 1.1]), p - d * 3.0 + np.array([0, 1.2])], fill=vivid(DARK), ink=INK, w=0.22, a=a)
        R.pf.setColor(argb(vivid(SKIN[1]), a))
        c.drawCircle(float(p[0] + d[0] * 3.0), float(p[1] + d[1] * 3.0), 1.1, R.pf)
        for k in range(4):
            s_ = (t * 0.5 + k * 0.25) % 1.0
            R.ps.setColor(argb(foam, a * (1 - s_)))
            R.ps.setStrokeWidth(0.24)
            c.drawCircle(float(p[0] + 1.2 * math.sin(s_ * 9)), float(p[1] - 2 - 15 * s_), 0.5 + 0.5 * s_, R.ps)
    T.custom(diver, [D0 + np.array([-8, -24]), D0 + ax + np.array([20, 10])], stage='life')


def uluru(T):
    # the track in, clumps of spinifex, desert oaks, a waterhole at the foot of the rock
    T.line([(0.86, 0.60), (0.70, 0.66), (0.56, 0.66), (0.44, 0.74)], 0.7, (236, 196, 160), stage='ground')
    T.tufts([(0.2, 0.3), (0.8, 0.3), (0.84, 0.66), (0.5, 0.74), (0.18, 0.64)], 30, c=(196, 190, 110), size=1.2)
    T.blob(0.36, 0.56, 0.03, 0.02, WATER_D, 0.3, seed=4, stage='detail')
    for (a, b) in ((0.14, 0.42), (0.88, 0.44), (0.60, 0.74)):
        tree(T, a, b, 0.7, (130, 160, 110), 'acacia')
    ex.rocks(T, [(0.26, 0.50), (0.76, 0.58), (0.46, 0.70)], 0.7, c=(204, 118, 80))
    ex.motes(T, T.P(0.5, 0.44, 0.16), 8, 24, 26)


# ============================================================ MACHU PICCHU ====
def machu(T):
    ev = EV['machu_moai']
    Z = 6 * 0.019
    with T.at('terraces'):
        # stairs stitching the terraces together, and the channel that waters them
        T.lines([[(0.70 + 0.048 * k, 0.46, (5 - k) * 0.019 + 0.019), (0.70 + 0.048 * (k + 1), 0.46, (5 - k) * 0.019)] for k in range(5)] +
                [[(0.70 + 0.048 * k, 0.475, (5 - k) * 0.019 + 0.019), (0.70 + 0.048 * (k + 1), 0.475, (5 - k) * 0.019)] for k in range(5)], 0.26, MARBLE_D, stage='detail')
        T.lines([[(0.50, 0.76 + 0.038 * k, (5 - k) * 0.019 + 0.019), (0.50, 0.76 + 0.038 * k, (5 - k) * 0.019), (0.50, 0.76 + 0.038 * (k + 1), (5 - k) * 0.019)] for k in range(6)], 0.5, WATER, stage='detail')
        T.lines([[(0.44 + 0.02 * k, 0.52, Z), (0.44 + 0.02 * k, 0.70, Z)] for k in range(1, 9)], 0.14, GRASS_D, stage='detail')
    # the railway along the lowest terrace, with its little blue train
    zr = 0.019
    T.lines([[(0.30, 0.965, zr), (0.975, 0.965, zr)], [(0.30, 0.978, zr), (0.975, 0.978, zr)]], 0.22, DARK, stage='detail')
    T.lines([[(0.30 + 0.0225 * k, 0.962, zr), (0.30 + 0.0225 * k, 0.981, zr)] for k in range(31)], 0.3, WOOD, stage='detail')

    def train(t, age, ph):
        s = ((t - ev) / 6.5 + 0.5) % 1.0
        d = pr.uvd(0.58 * s, 0.0)
        k = ease.smooth(min(s, 1.0 - s) / 0.05)
        return (d[0], d[1], 0.0, 1.0, k, k)
    train.reach = 70
    with T.grp('pop', pivot=T.P(0.32, 0.97, zr), motion=train, stage='life', dur=0.2):
        for k in range(3):
            u0 = 0.30 + k * 0.034
            T.box(u0, 0.963, 0.03, 0.016, 0.013, z=zr + 0.002, c=(70, 120, 196) if k < 2 else ACCENT, ink=0.28, guide=False)
            T.poly([(u0 + 0.003, 0.979, zr + 0.008), (u0 + 0.027, 0.979, zr + 0.008), (u0 + 0.027, 0.979, zr + 0.013), (u0 + 0.003, 0.979, zr + 0.013)], ACCENT_L, 0.0)
    pr.smoke(T, T.P(0.385, 0.971, zr + 0.016), 0.5, lean=-6)
    T.box(0.60, 0.94, 0.05, 0.012, 0.012, z=zr, c=MARBLE, ink=0.26, guide=False)           # the halt
    ex.rocks(T, [(0.30, 0.10), (0.26, 0.90), (0.96, 0.06)], 0.8)
    ex.flowers(T, [(0.3, 0.02), (0.98, 0.02), (0.98, 0.3), (0.4, 0.3)], 22, cols=[(178, 150, 220), MARBLE, ACCENT_L])
    ex.gap_bridge(T, 'v', 0.31, _on('rio', 'machu', 1.1), kind='rope', n_walk=2)
    ex.spill(T, 'L', 0.47, 0.53, 0.0, length=46.0, t0=1.1)
    ex.motes(T, T.P(0.52, 0.6, Z + 0.03), 9, 28, 28)
    # a condor comes down across the terraces as the train goes by
    C0 = np.array(T.P(0.30, 0.30, 0.5))

    def swoop(t, age, ph):
        x = (t - (ev - 1.6)) / 3.4
        if not 0 < x < 1:
            return (0.0, 0.0, 0.0, 1.0, 1.0, 0.0)
        return (110 * x, 44 * x - 26 * math.sin(math.pi * x), 14 - 28 * x, 1.0 + 0.5 * x, 1.0 + 0.5 * x, math.sin(math.pi * x) ** 0.4)
    swoop.reach = 140
    with T.st('sky'):
        with T.grp(None, pivot=C0, motion=swoop, stage='sky'):
            T.poly2(C0, smooth_poly([(-8, -1.2), (-3.4, -0.2), (0, 0.7), (3.4, -0.2), (8, -1.2), (3.8, 1.0), (0, 1.7), (-3.8, 1.0)], 1), DARK, 0.26, wob=0, sky=True)
            T.ell2(C0 + np.array([0, 0.3]), 0.8, fill=MARBLE, ink=0.2, n=7, wob=0, sky=True)
            T.lines2(C0, [[(-8, -1.2), (-9.4, -2.2)], [(-7.4, -1.0), (-8.6, -0.2)], [(8, -1.2), (9.4, -2.2)], [(7.4, -1.0), (8.6, -0.2)]], 0.3, DARK, wob=0, sky=True)


def moai(T):
    ev = EV['machu_moai']
    ex.flowers(T, [(0.25, 0.5), (0.75, 0.5), (0.72, 0.7), (0.3, 0.72)], 16, cols=[MARBLE, ACCENT_L, ROSE])
    ex.rocks(T, [(0.22, 0.56), (0.74, 0.66), (0.50, 0.74)], 0.8, c=(150, 144, 140))
    path_line(T, [(0.22, 0.47), (0.50, 0.485), (0.78, 0.47)], w=0.7)
    # ---- on camera: one by one the statues open their eyes
    for k, (u, s) in enumerate(((0.27, 0.95), (0.38, 1.1), (0.49, 1.0), (0.60, 1.15), (0.70, 0.9))):
        P = T.P(u, 0.385, 0.022)
        with T.grp(None, pivot=P + np.array([0, -11.4 * s]), motion=ex.appear(ev - 0.8 + 0.3 * k, 0.3), stage='life'):
            for sg in (-1, 1):
                T.ell2(P + np.array([sg * 1.0 * s, -11.5 * s]), 0.55 * s, 0.42 * s, fill=ACCENT_L, ink=0.16, inkc=ACCENT, n=7, wob=0)
        echo_rings(T, P + np.array([0, -11.4 * s]), ev - 0.8 + 0.3 * k, n=1, r0=1.5, r1=9, c=ACCENT)
    ex.motes(T, T.P(0.5, 0.385, 0.16), 9, 26, 24)


# ============================================================ CHICHEN ITZA ====
def chichen(T):
    ev = EV['chichen']
    cu, cv = 0.46, 0.50
    s0, dz = 0.36, 0.022
    H = 9 * dz
    sw = 0.034
    LS = (230, 220, 198)
    with T.at('castillo'):
        # balustrades down both stairways, ending in the plumed serpents' heads
        for (a0, a1) in (((cu - sw, cv + s0 / 2 + 0.03, 0), (cu - sw, cv + 0.075, H)), ((cu + sw, cv + s0 / 2 + 0.03, 0), (cu + sw, cv + 0.075, H))):
            T.lines([[a0, a1], [(a0[0] + 0.006, a0[1], 0.0), (a1[0] + 0.006, a1[1], H)]], 0.3, STONE_D, stage='detail')
        for (a0, a1) in (((cu + s0 / 2 + 0.03, cv - sw, 0), (cu + 0.075, cv - sw, H)), ((cu + s0 / 2 + 0.03, cv + sw, 0), (cu + 0.075, cv + sw, H))):
            T.lines([[a0, a1], [(a0[0], a0[1] + 0.006, 0.0), (a1[0], a1[1] + 0.006, H)]], 0.3, STONE_D, stage='detail')
        for (hu, hv) in ((cu - sw - 0.004, cv + s0 / 2 + 0.036), (cu + sw + 0.004, cv + s0 / 2 + 0.036)):
            P = np.array(T.P(hu, hv))
            T.poly2(P, smooth_poly([(-2.2, 0.6), (-2.6, -1.6), (-0.6, -2.8), (1.6, -2.2), (2.6, -0.6), (1.0, 0.0), (2.2, 1.2), (-0.4, 1.6)], 1), (170, 206, 150), 0.3, wob=0, stage='detail')
            T.ell2(P + np.array([-0.4, -1.4]), 0.36, fill=INK, ink=0, n=6, wob=0, stage='detail')
            T.lines2(P, [[(1.0, 0.0), (2.4, 0.2)], [(-2.4, -1.8), (-3.6, -3.2)], [(-1.6, -2.4), (-2.2, -4.0)]], 0.28, ACCENT, wob=0, stage='detail')
        # the temple's frieze and roof comb
        T.lines([[(cu - 0.055, cv + 0.055, H + 0.036), (cu + 0.055, cv + 0.055, H + 0.036)], [(cu + 0.055, cv - 0.055, H + 0.036), (cu + 0.055, cv + 0.055, H + 0.036)]], 0.22, STONE_D, stage='detail')
        T.lines([[(cu - 0.05 + 0.0125 * k, cv + 0.055, H + 0.038), (cu - 0.05 + 0.0125 * k, cv + 0.055, H + 0.044)] for k in range(9)], 0.4, TERRA, stage='detail')
    with T.at('ground'):
        T.lines([[(0.20 + 0.05 * k, 0.70 + 0.012 * (k % 2)), (0.235 + 0.05 * k, 0.70 + 0.012 * (k % 2))] for k in range(10)] +
                [[(0.66 + 0.03 * k, 0.33 + 0.03 * (k % 3)), (0.685 + 0.03 * k, 0.33 + 0.03 * (k % 3))] for k in range(8)] +
                [[(0.16 + 0.045 * k, 0.30), (0.19 + 0.045 * k, 0.30)] for k in range(4)], 0.16, SAND_D, stage='detail')
        ex.flowers(T, [(0.02, 0.84), (0.3, 0.9), (0.6, 0.9), (0.7, 0.99), (0.02, 0.99)], 20, cols=[TERRA, ACCENT_L, (178, 150, 220)])
    # a chacmool before the Warriors' temple, stelae, blankets of wares on the plaza
    T.box(0.785, 0.31, 0.03, 0.018, 0.01, c=LS, ink=0.26, guide=False)
    T.box(0.79, 0.312, 0.008, 0.014, 0.012, z=0.01, c=LS, ink=0.24, guide=False)
    for (a, b) in ((0.24, 0.50), (0.26, 0.64), (0.70, 0.66)):
        T.box(a, b, 0.012, 0.008, 0.034, c=LS, ink=0.28, guide=False)
        T.lines([[(a + 0.003, b + 0.008, 0.008 + 0.006 * k), (a + 0.009, b + 0.008, 0.008 + 0.006 * k)] for k in range(4)], 0.16, STONE_D, stage='detail')
    for k, (a, b) in enumerate(((0.56, 0.82), (0.62, 0.80), (0.20, 0.80))):
        T.poly([(a, b), (a + 0.04, b), (a + 0.04, b + 0.026), (a, b + 0.026)], [ROSE, ACCENT_L, WATER_L][k], 0.24, stage='detail')
        T.lines([[(a + 0.01 * q, b), (a + 0.01 * q, b + 0.026)] for q in (1, 2, 3)], 0.4, [TERRA, MARBLE, ACCENT][k], stage='detail')
    ex.stall(T, 0.52, 0.845, TERRA)
    ex.rocks(T, [(0.16, 0.86), (0.90, 0.64), (0.64, 0.96)], 0.8, c=LS)
    ex.fence(T, [(0.72, 0.80), (0.74, 0.75), (0.80, 0.725)], h=0.012, c=WOOD)
    ex.gap_bridge(T, 'v', 0.50, _on('colosseum', 'chichen', 1.1), kind='stone', n_walk=2)
    ex.spill(T, 'L', 0.78, 0.88, -0.04, length=40.0, t0=1.2)                              # the cenote drains out through the cliff
    ex.motes(T, T.P(cu, cv, H + 0.06), 9, 22, 28)
    # ---- on camera: a guide claps at the foot of the stair; the echo comes back as a quetzal's chirp, and the birds go up
    person(T, cu, cv + s0 / 2 + 0.075, shirt=ACCENT, hat=MARBLE, arms=True)
    echo_rings(T, T.P(cu, cv + s0 / 2 + 0.06, 0.03), ev - 0.5, n=3, r0=4, r1=30)
    echo_rings(T, T.P(cu, cv, H + 0.03), ev - 0.1, n=3, r0=4, r1=30, c=(60, 150, 90))
    rr_ = random.Random(6)
    perches = [T.P(cu - 0.055 + 0.11 * rr_.random(), cv - 0.055 + 0.11 * rr_.random(), H + 0.056) for _ in range(12)] + \
              [T.P(cu - 0.1 + 0.2 * rr_.random(), cv + 0.14, (6 + k % 2) * dz) for k in range(8)]
    ex.burst_flock(T, perches, ev, c=(70, 190, 130), up=40, spread=32, edge=(40, 110, 80))


# ================================================================= NIAGARA ====
def niagara(T):
    ev = EV['niagara']
    for v in (0.55, 0.65, 0.75, 0.85):
        ex.lamp_post(T, 0.805, v)
    for (a, b, d) in ((0.775, 0.60, 'v'), (0.775, 0.72, 'v'), (0.20, 0.815, 'u')):
        ex.bench(T, a, b, d)
    # the floral clock, parked cars, a hot-dog stand
    T.disk(0.92, 0.66, 0.045, fill=(120, 196, 110), ink=0.36, stage='detail')
    ex.flowers(T, T.ring(0.92, 0.66, 0.04, n=14)[:-1], 26, cols=[ACCENT_L, ROSE, MARBLE, TERRA])
    Cc = T.P(0.92, 0.66)
    hands = vivid(MARBLE)

    def clock(c, tau, t, a, R):
        if tau < 1.2:
            return
        for (L, sp) in ((3.6, 0.5), (2.4, 0.08)):
            R.ps.setColor(argb(hands, a))
            R.ps.setStrokeWidth(0.5)
            c.drawLine(float(Cc[0]), float(Cc[1]), float(Cc[0] + L * math.cos(t * sp)), float(Cc[1] + L * 0.5 * math.sin(t * sp)), R.ps)
    T.custom(clock, [Cc + np.array([-5, -4]), Cc + np.array([5, 4])], stage='life')
    pr.car(T, 0.90, 0.80, 'u', c=ZINC)
    pr.car(T, 0.90, 0.85, 'u', c=ROSE, s=0.9)
    pr.car(T, 0.90, 0.90, 'u', c=MARBLE)
    ex.stall(T, 0.74, 0.50, ACCENT)
    ex.flowers(T, [(0.02, 0.02), (0.2, 0.02), (0.1, 0.4), (0.1, 0.7), (0.3, 0.84), (0.3, 0.98), (0.02, 0.98)], 30, cols=[MARBLE, ACCENT_L, (178, 150, 220)])
    ex.rock_in_water(T, 0.34, 0.26, 0.7)
    ex.rock_in_water(T, 0.72, 0.20, 0.7)
    ex.rocks(T, [(0.14, 0.30), (0.10, 0.92), (0.84, 0.70)], 0.8)
    ex.jetty(T, 0.72, 0.04, 'u', 0.05)
    ex.motes(T, T.P(0.52, 0.45, -0.02), 10, 30, 30, c=(230, 250, 255))


def stonehenge(T):
    # the avenue, barrows on the skyline, a fence and a signpost
    path_line(T, [(0.86, 0.62), (0.70, 0.60), (0.58, 0.72)], w=0.7)
    for (a, b) in ((0.24, 0.30), (0.78, 0.36)):
        with T.grp('rise', t0=0.5, dur=0.4, pivot=T.P(a, b), stage='struct', ink_now=True, under=PAPER):
            T.hill(a, b, 0.05, 0.022, c=GRASS_D, guide=False)
    ex.fence(T, [(0.78, 0.70), (0.84, 0.64)], h=0.012, c=WOOD)
    ex.flowers(T, [(0.2, 0.4), (0.8, 0.4), (0.8, 0.76), (0.3, 0.8)], 22, cols=[MARBLE, ACCENT_L, (178, 150, 220)])
    ex.rocks(T, [(0.30, 0.80), (0.66, 0.84)], 0.7, c=(200, 198, 192))
    ex.motes(T, T.P(0.5, 0.5, 0.1), 9, 26, 28, c=(255, 250, 230))


EXTRA = {'pyramids': pyramids, 'colosseum': colosseum, 'greatwall': greatwall, 'taj': taj, 'eiffel': eiffel, 'everest': everest,
         'aurora': aurora, 'fuji': fuji, 'halong': halong, 'opera': opera, 'reef': reef, 'uluru': uluru, 'machu': machu, 'moai': moai,
         'chichen': chichen, 'niagara': niagara, 'stonehenge': stonehenge}
