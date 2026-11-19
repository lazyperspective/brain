"""Tiles: the centre (Pyramids of Giza) and the four inner slabs."""
import math

import numpy as np

from .core import W, ZS, SLAB, smooth_poly, Wave
from .pal import *  # noqa
from . import props as pr
from .props import person, tree, crowd, grove, water, walker, bobber, cruise, runner, stroll

LIME = (228, 205, 154)       # pyramid limestone
LIME_D = (198, 172, 124)


def lerp3(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def sm(pts, it=2):
    return [(p[0], p[1]) for p in smooth_poly([np.array(p, float) for p in pts], it, closed=False)]


def dune(T, u, v, s=1.0, t0=None, lit=(245, 234, 204), dark=SAND_D):
    P = T.P(u, v)
    with T.grp('drift', t0=t0, dur=0.55, pivot=P, off=(-22 * s, -5 * s), stage='flora'):
        top = smooth_poly([(-11 * s, 0.5 * s), (-6 * s, -2.6 * s), (0, -4.2 * s), (6 * s, -2.9 * s), (11 * s, 0.8 * s)], 2, closed=False)
        crest = smooth_poly([(11 * s, 0.8 * s), (5 * s, -0.4 * s), (0, -0.9 * s), (-5 * s, -0.6 * s), (-11 * s, 0.5 * s)], 2, closed=False)
        bot = smooth_poly([(-11 * s, 0.5 * s), (-5 * s, 2.2 * s), (1 * s, 2.9 * s), (7 * s, 2.3 * s), (11 * s, 0.8 * s)], 2, closed=False)
        T.poly2(P, list(top) + list(crest), lit, 0, wob=0)
        T.poly2(P, list(bot) + list(crest), dark, 0, wob=0)
        T.line2(P, top, 0.36, shade(dark, 0.78), wob=0)
        T.line2(P, crest[::-1], 0.36, shade(dark, 0.7), wob=0)
        T.lines2(P, [[(-6 * s, 1.2 * s), (-1 * s, 1.7 * s)], [(1 * s, 0.9 * s), (6 * s, 1.2 * s)]], 0.26, shade(dark, 0.86), wob=0)


def courses(T, base_a, base_b, apex, n, c, t_from=0.0, t_to=0.92):
    segs = []
    for k in range(1, n + 1):
        t = t_from + (t_to - t_from) * k / (n + 1)
        segs.append([lerp3(base_a, apex, t), lerp3(base_b, apex, t)])
    T.lines(segs, 0.26, c, stage='detail')


def giza_pyramid(T, u0, v0, b, h, cap=None, courses_n=6):
    u1, v1 = u0 + b, v0 + b
    A = (u0 + b / 2, v0 + b / 2, h)
    T.pyr(u0, v0, b, b, h, c=LIME, left=LIME, right=LIME_D)
    courses(T, (u0, v1, 0), (u1, v1, 0), A, courses_n, shade(LIME, 0.84))
    courses(T, (u1, v0, 0), (u1, v1, 0), A, courses_n, shade(LIME_D, 0.86))
    if cap:
        col, f = cap
        a = lerp3((u0, v1, 0), A, 1 - f)
        m = lerp3((u1, v1, 0), A, 1 - f)
        b_ = lerp3((u1, v0, 0), A, 1 - f)
        T.poly([a, m, A], col, 0.36, stage='detail')
        T.poly([b_, m, A], shade(col, 0.86), 0.36, stage='detail')


def pyramids(T):
    T.slab(SAND, EARTH)
    r = T.rng
    inner = sm([(0, 0.55), (0.16, 0.59), (0.32, 0.72), (0.43, 0.90), (0.45, 1.0)])
    outer = sm([(0, 0.69), (0.12, 0.73), (0.22, 0.83), (0.29, 0.93), (0.31, 1.0)])
    green = sm([(0, 0.455), (0.20, 0.495), (0.41, 0.655), (0.53, 0.88), (0.545, 1.0)])
    plateau = [(0, 0), (1, 0), (1, 1), (0.56, 1)] + green[::-1]
    with T.st('ground'):
        T.poly(green + inner[::-1], GRASS, 0.42)
        T.poly(outer + [(0, 1)], GRASS, 0.42)
        # causeway from the pyramids down to the river
        T.poly([(0.47, 0.44), (0.49, 0.44), (0.405, 0.665), (0.39, 0.655)], SAND_D, 0.3)
        T.poly([(0.60, 0.50), (0.615, 0.50), (0.615, 0.33), (0.60, 0.33)], SAND_D, 0.3)
    T.speckle(plateau, 150)
    T.tufts(green + inner[::-1], 34)
    T.tufts(outer + [(0, 1)], 26)
    with T.st('ground'):
        # field rows on the far bank
        T.lines([[(0.03, 0.80 + k * 0.035), (0.03 + 0.11 - k * 0.012, 0.86 + k * 0.035)] for k in range(5)], 0.3, GRASS_D)
    water(T, inner + outer[::-1], src=(0.0, 0.62), marks=20, t0=0.3, flow=(1, 1))
    T.wall_water('L', 0.31, 0.45)

    T.mark('ground')
    # ---- the three pyramids (back to front)
    giza_pyramid(T, 0.115, 0.335, 0.155, 0.098, courses_n=4)
    for k in range(3):   # queens' pyramids
        T.pyr(0.075 + k * 0.047, 0.515 - k * 0.004, 0.036, 0.036, 0.024, c=LIME, left=LIME, right=LIME_D, ink=0.36, guide=False)
    giza_pyramid(T, 0.285, 0.165, 0.275, 0.182, cap=((246, 239, 221), 0.24), courses_n=7)
    giza_pyramid(T, 0.565, 0.045, 0.30, 0.196, cap=(ACCENT, 0.13), courses_n=8)
    # mastaba field
    for (a, b) in ((0.60, 0.385), (0.66, 0.385), (0.72, 0.385), (0.78, 0.385), (0.63, 0.435), (0.69, 0.435), (0.75, 0.435)):
        T.box(a, b, 0.038, 0.026, 0.011, c=LIME, ink=0.32, guide=False)

    T.mark('pyr')
    # ---- obelisk
    T.box(0.50, 0.625, 0.016, 0.016, 0.012, c=STONE, ink=0.3, guide=False)
    T.box(0.503, 0.628, 0.010, 0.010, 0.125, z=0.012, c=(238, 218, 196), ink=0.36, guide=True)
    T.pyr(0.503, 0.628, 0.010, 0.010, 0.018, z=0.137, c=ACCENT, left=ACCENT, right=ACCENT_D, ink=0.3, guide=False)

    # ---- the Sphinx: a lion couchant - rounded haunch, long swayed back, deep chest, forelegs laid out
    #      toward the river - with a human head under the striped, flaring nemes
    sx = (228, 190, 128)
    sxd = shade(sx, 0.86)
    su, sv, sw = 0.575, 0.652, 0.07

    def sp(pts, it=2):
        return [(float(p[0]), float(p[1])) for p in smooth_poly([np.array(p, float) for p in pts], it)]
    T.box(su - 0.014, sv - 0.014, 0.31, sw + 0.028, 0.008, c=(238, 212, 160), ink=0.36, guide=True)             # plinth
    z0 = 0.008
    # far foreleg, then the body, then the near foreleg and hind paw
    T.prism([(su + a_, z0 + z_) for a_, z_ in sp([(0.15, 0), (0.15, 0.022), (0.20, 0.026), (0.268, 0.022), (0.28, 0.012), (0.278, 0)])], sv + 0.022, 0.02, 'v', c=sx, ink=0.36)
    body = sp([(0.0, 0.0), (-0.004, 0.03), (0.004, 0.058), (0.03, 0.074), (0.062, 0.07), (0.092, 0.058), (0.122, 0.06), (0.146, 0.078), (0.172, 0.086),
               (0.186, 0.07), (0.188, 0.03), (0.182, 0.0)], 2)
    T.prism([(su + a_, z0 + z_) for a_, z_ in body], sv + sw - 0.006, sw - 0.012, 'v', c=sx, ink=0.42)
    T.prism([(su + a_, z0 + z_) for a_, z_ in sp([(0.15, 0), (0.15, 0.024), (0.20, 0.028), (0.27, 0.024), (0.284, 0.012), (0.282, 0)])], sv + sw, 0.022, 'v', c=sx, ink=0.38)
    T.prism([(su + a_, z0 + z_) for a_, z_ in sp([(0.03, 0), (0.028, 0.014), (0.06, 0.02), (0.098, 0.014), (0.102, 0)])], sv + sw, 0.016, 'v', c=sx, ink=0.34)
    fv = sv + sw - 0.006
    # haunch, ribs, tail curled along the flank, toes
    T.lines([[(su + 0.012 + 0.034 * math.cos(q), fv, z0 + 0.03 + 0.036 * math.sin(q)) for q in np.linspace(-0.3, 2.6, 10)],
             [(su + 0.10, fv, z0 + 0.018), (su + 0.103, fv, z0 + 0.05)], [(su + 0.116, fv, z0 + 0.016), (su + 0.119, fv, z0 + 0.05)],
             [(su + 0.002, fv, z0 + 0.012), (su + 0.03, fv + 0.004, z0 + 0.006), (su + 0.074, fv + 0.004, z0 + 0.01)]], 0.26, shade(sx, 0.6), stage='detail')
    T.lines([[(su + 0.262 + k * 0.006, sv + sw, z0 + 0.004), (su + 0.262 + k * 0.006, sv + sw, z0 + 0.016)] for k in range(3)], 0.22, shade(sx, 0.6), stage='detail')
    # the head: nemes flaring to the shoulders, face looking out along the paws
    hz_ = z0 + 0.078
    NEM = (242, 206, 132)
    nem = sp([(0.118, -0.012), (0.126, 0.03), (0.138, 0.062), (0.156, 0.07), (0.178, 0.066), (0.19, 0.05), (0.192, 0.012), (0.196, -0.012)], 1)
    T.prism([(su + a_, hz_ + z_) for a_, z_ in nem], sv + sw - 0.004, sw - 0.016, 'v', c=NEM, ink=0.42)
    T.lines([[(su + 0.126 + k * 0.011, sv + sw - 0.004, hz_ - 0.008), (su + 0.134 + k * 0.009, sv + sw - 0.004, hz_ + 0.05 + 0.004 * k)] for k in range(1, 6)] +
            [[(su + 0.13, sv + sw - 0.004, hz_ + 0.03), (su + 0.19, sv + sw - 0.004, hz_ + 0.03)]], 0.24, shade(NEM, 0.62), stage='detail')
    fu = su + 0.1935
    T.poly([(fu, sv + 0.02, hz_ + 0.0), (fu, sv + sw - 0.022, hz_ + 0.0), (fu, sv + sw - 0.024, hz_ + 0.05), (fu, sv + 0.022, hz_ + 0.05)], (246, 216, 160), 0.34, stage='detail')
    cv_ = sv + sw / 2 - 0.001
    T.lines([[(fu, cv_ - 0.013, hz_ + 0.036), (fu, cv_ - 0.005, hz_ + 0.036)], [(fu, cv_ + 0.005, hz_ + 0.036), (fu, cv_ + 0.013, hz_ + 0.036)],
             [(fu, cv_, hz_ + 0.034), (fu, cv_ - 0.003, hz_ + 0.02), (fu, cv_ + 0.003, hz_ + 0.02)], [(fu, cv_ - 0.007, hz_ + 0.012), (fu, cv_ + 0.007, hz_ + 0.012)],
             [(fu, cv_, hz_ + 0.004), (fu, cv_, hz_ - 0.016)]], 0.26, stage='detail')
    T.poly([(fu, cv_ - 0.004, hz_ + 0.05), (fu, cv_ + 0.004, hz_ + 0.05), (fu + 0.008, cv_, hz_ + 0.062)], ACCENT, 0.26, stage='detail')        # the uraeus
    T.guide([[(su + 0.16, sv + sw / 2, 0), (su + 0.16, sv + sw / 2, 0.19)], [(su, sv + sw, 0), (su + 0.29, sv + sw, 0)]], ticks=5)

    # ---- village on the far bank
    for (a, b, hh) in ((0.05, 0.90, 0.03), (0.105, 0.925, 0.024), (0.02, 0.945, 0.022), (0.16, 0.95, 0.028)):
        T.box(a, b, 0.045, 0.036, hh, c=(232, 208, 172), ink=0.36, guide=False)
        T.poly([(a + 0.012, b + 0.036, 0), (a + 0.022, b + 0.036, 0), (a + 0.022, b + 0.036, 0.015), (a + 0.012, b + 0.036, 0.015)], DARK, 0.2, stage='detail')
    # bedouin tent + market awning on the plateau
    T.box(0.86, 0.565, 0.07, 0.055, 0.004, c=(226, 190, 150), ink=0.3, guide=False)
    T.gable(0.865, 0.57, 0.06, 0.045, 0.034, z=0.004, c=MARBLE, axis='u', wall=MARBLE, ink=0.36)
    T.lines([[(0.88, 0.615, 0.004), (0.88, 0.5925, 0.038)], [(0.90, 0.615, 0.004), (0.90, 0.5925, 0.038)]], 0.5, ACCENT, stage='detail')
    # excavation pit with a solar boat
    with T.st('ground'):
        T.poly([(0.87, 0.40), (0.95, 0.40), (0.95, 0.455), (0.87, 0.455)], SAND_D, 0.36)
    T.poly([(0.885, 0.427), (0.91, 0.415), (0.935, 0.427), (0.91, 0.44)], WOOD, 0.3, stage='detail')

    # ---- dunes drifting in on the right
    for (a, b, s) in ((0.905, 0.52, 0.8), (0.94, 0.68, 1.0), (0.965, 0.81, 0.6), (0.05, 0.30, 0.8),
                      (0.20, 0.075, 0.85), (0.42, 0.055, 0.6), (0.94, 0.30, 0.55)):
        dune(T, a, b, s)

    # ---- palms along the Nile
    for (a, b) in ((0.03, 0.50), (0.10, 0.505), (0.185, 0.535), (0.27, 0.59), (0.335, 0.635), (0.42, 0.72), (0.455, 0.80), (0.50, 0.90), (0.515, 0.965),
                   (0.035, 0.74), (0.10, 0.775), (0.19, 0.86), (0.245, 0.955), (0.01, 0.87), (0.145, 0.90)):
        tree(T, a, b, r.uniform(0.8, 1.05), FOREST, 'palm')
    for (a, b) in ((0.075, 0.48), (0.225, 0.545), (0.38, 0.68), (0.485, 0.85)):
        tree(T, a, b, 0.8, GRASS_D, 'bush')

    # ---- life
    pr.felucca(T, 0.085, 0.645, 'u', motion=cruise(0.06, 0.015, 1.0), s=0.95)
    pr.felucca(T, 0.31, 0.845, 'v', motion=cruise(0.03, 0.07, 0.8), s=0.85, sail=(250, 226, 170))
    pr.rowboat(T, 0.215, 0.725, 'u', c=TERRA, crew=2)
    # camel caravan heading for the pyramids
    wk = walker(0.045, -0.012, 7.5, 0.5)
    for k in range(4):
        pr.camel(T, 0.60 + k * 0.075, 0.865 + k * 0.012, blanket=ACCENT if k % 2 == 0 else TERRA,
                 rider=CLOTH[(k * 3) % 8] if k != 2 else None, walk=wk, ph=1.0, s=0.92)
    person(T, 0.905, 0.915, shirt=MARBLE, hat=MARBLE, walk=wk, ph=1.0)
    pr.camel(T, 0.955, 0.60, flip=True, blanket=TERRA, s=0.9)
    pr.camel(T, 0.46, 0.50, blanket=ACCENT, rider=MARBLE, s=0.85, walk=walker(0.03, 0.03, 9))
    # visitors
    crowd(T, [(0.84, 0.66), (0.93, 0.66), (0.93, 0.76), (0.84, 0.76)], 5, hat=MARBLE)
    crowd(T, [(0.50, 0.68), (0.555, 0.68), (0.555, 0.76), (0.50, 0.76)], 2, hat=MARBLE)
    crowd(T, [(0.88, 0.46), (0.97, 0.46), (0.97, 0.56), (0.88, 0.56)], 3, hat=MARBLE)
    crowd(T, [(0.36, 0.46), (0.44, 0.46), (0.52, 0.58), (0.44, 0.60)], 4)
    crowd(T, [(0.875, 0.455), (0.955, 0.455), (0.955, 0.49), (0.875, 0.49)], 3, walk_frac=0)
    person(T, 0.90, 0.428, shirt=MARBLE, hat=(226, 200, 150))
    person(T, 0.86, 0.775, shirt=ACCENT, hat=MARBLE, arms=True)      # guide
    person(T, 0.07, 0.83, shirt=MARBLE, walk=walker(0.04, 0.03, 8))
    person(T, 0.13, 0.985, shirt=ROSE)
    person(T, 0.50, 0.70, shirt=CLOTH[0], walk=walker(0.02, -0.04, 7))
    pr.car(T, 0.97, 0.965, 'u', c=MARBLE, motion=runner(-0.42, 0.0, 13.0))
    # more life: strollers on the causeway and round the Sphinx, villagers, smoke, ibis over the Nile
    stroll(T, [(0.485, 0.45), (0.40, 0.655)], 4, hat=MARBLE)
    stroll(T, [(0.555, 0.80), (0.90, 0.80)], 7, hat=MARBLE, spread=0.012)
    stroll(T, [(0.05, 0.47), (0.22, 0.52), (0.40, 0.665), (0.515, 0.90)], 6, spread=0.008)
    stroll(T, [(0.03, 0.80), (0.15, 0.885), (0.23, 0.975)], 4)
    stroll(T, [(0.30, 0.52), (0.42, 0.50), (0.56, 0.46)], 4, hat=MARBLE)
    pr.smoke(T, T.P(0.07, 0.915, 0.032), 0.8)
    pr.smoke(T, T.P(0.885, 0.595, 0.04), 0.7, lean=6)
    pr.flock(T, 0.20, 0.76, 0.17, 7, orbit=(16, 6))
    # sky
    pr.glint(T, T.P(0.715, 0.195, 0.2), 1.1)
    pr.balloon(T, 1.0, 0.16, 0.40, 1.05)
    pr.balloon(T, 0.14, 0.14, 0.30, 0.7, c=MARBLE, c2=ACCENT)
    pr.bird(T, 0.20, 0.78, 0.16, 0.8, orbit=(7, 2.5))
    pr.bird(T, 0.27, 0.74, 0.19, 0.7, orbit=(6, 2.0))
    pr.bird(T, 0.12, 0.70, 0.14, 0.7, orbit=(5, 2.2))


# =========================================================== COLOSSEUM ====
TRAV = (236, 224, 200)
TRAV_D = (210, 196, 168)
ARCH_DK = (104, 90, 84)


def colosseum(T):
    T.slab(GRASS, EARTH)
    r = T.rng
    inner = sm([(0.65, 0), (0.65, 0.27), (0.71, 0.54), (0.86, 0.69), (1, 0.69)])
    outer = sm([(0.79, 0), (0.79, 0.23), (0.85, 0.42), (0.94, 0.55), (1, 0.55)])
    cu, cv, ru, rv = 0.335, 0.50, 0.265, 0.225
    piazza = [(p[0], p[1]) for p in T.ring(cu, cv, ru * 1.27, rv=rv * 1.3, n=40)[:-1]]
    with T.st('ground'):
        T.poly(piazza, (238, 231, 216), 0.36)
        T.poly([(0.56, 0.355), (0.64, 0.355), (0.64, 0.405), (0.56, 0.42)], (238, 231, 216), 0.3)
        T.poly([(0.80, 0.355), (0.99, 0.355), (0.99, 0.405), (0.83, 0.405)], (238, 231, 216), 0.3)
    T.speckle(piazza, 90, c=STONE_D)
    lawn = [(0, 0), (0.64, 0), (0.64, 0.25), (0.69, 0.5), (0.85, 0.7), (1, 0.7), (1, 1), (0, 1)]
    T.tufts(lawn, 70)
    T.tufts([(0.8, 0), (1, 0), (1, 0.54), (0.94, 0.52), (0.86, 0.40), (0.8, 0.2)], 14)
    water(T, inner + outer[::-1], src=(0.72, 0.0), marks=16, t0=0.30, flow=(0.5, 1))
    T.wall_water('R', 0.55, 0.69)

    T.mark('ground')
    # ---- Trastevere roofs on the far bank
    for (a, b, du, dv, hh, ax) in ((0.83, 0.04, 0.07, 0.06, 0.04, 'u'), (0.92, 0.06, 0.06, 0.08, 0.05, 'v'), (0.84, 0.15, 0.06, 0.07, 0.035, 'v'),
                                   (0.915, 0.19, 0.07, 0.06, 0.045, 'u'), (0.88, 0.29, 0.06, 0.05, 0.035, 'u')):
        T.house(a, b, du, dv, hh, 0.022, wall=(244, 226, 200), roof=TERRA, axis=ax, win=2)
    # a church dome among them
    T.cyl(0.955, 0.40, 0.03, 0.045, c=MARBLE, guide=False, ink=0.36)
    T.dome(0.955, 0.40, 0.03, 0.034, z=0.045, c=ZINC, guide=False, ink=0.36)

    # ---- bridge over the Tiber
    T.poly([(0.615, 0.405, 0), (0.83, 0.405, 0), (0.83, 0.405, 0.032), (0.615, 0.405, 0.032)], TRAV, 0.4)
    for ac in (0.675, 0.725, 0.775):
        T.arch('L', ac, 0.405, 0.0, 0.04, 0.026, fill=DEEP)
    T.box(0.60, 0.355, 0.245, 0.05, 0.008, z=0.032, c=TRAV, ink=0.4, guide=True)
    T.lines([[(0.60 + k * 0.035, 0.405, 0.04), (0.60 + k * 0.035, 0.405, 0.052)] for k in range(8)], 0.4, stage='detail')

    # ---- behind the amphitheatre: forum columns, pines, strollers
    for k in range(3):
        T.cyl(0.055 + k * 0.03, 0.17, 0.008, 0.085, c=MARBLE, guide=False, ink=0.32)
    T.box(0.043, 0.158, 0.085, 0.024, 0.012, z=0.085, c=MARBLE, ink=0.34, guide=False)
    T.box(0.16, 0.16, 0.02, 0.02, 0.03, c=MARBLE_D, ink=0.3, guide=False)
    T.cyl(0.20, 0.13, 0.008, 0.045, c=MARBLE, guide=False, ink=0.3)

    for (a, b) in ((0.04, 0.36), (0.12, 0.05), (0.30, 0.05), (0.52, 0.10), (0.59, 0.24)):
        tree(T, a, b, r.uniform(0.9, 1.15), FOREST, 'stonepine')
    for (a, b) in ((0.22, 0.05), (0.44, 0.045), (0.58, 0.16)):
        tree(T, a, b, r.uniform(0.75, 0.95), JUNGLE, 'cypress')
    crowd(T, [(0.02, 0.20), (0.26, 0.10), (0.30, 0.20), (0.06, 0.34)], 4)

    # ---- the amphitheatre
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
    TL_, TR_ = 140.0, -40.0
    T.guide([[rp(th, 1.0, 0) for th in range(0, 361, 8)], [rp(th, 0.5, 0) for th in range(0, 361, 12)]])
    T.guide([[rp(180, 1.15), rp(0, 1.15)], [rp(90, 1.15), rp(270, 1.15)]], ticks=8, over=0.02)
    T.guide([[rp(TL_, 1.0, 0), rp(TL_, 1.0, HF)], [rp(TR_, 1.0, 0), rp(TR_, 1.0, HF)]], ticks=5)
    # far wall, inner face
    far = [rp(th, 0.92, H(th)) for th in range(140, 321, 4)] + [rp(th, 0.86, 0.112) for th in range(320, 139, -4)]
    T.poly(far, TRAV_D, 0.36)
    # cavea + arena
    T.poly([rp(th, 0.86, 0.112) for th in range(0, 360, 5)], (242, 233, 214), 0.36)
    T.lines([[rp(th, 0.74, 0.082) for th in range(0, 361, 6)], [rp(th, 0.62, 0.05) for th in range(0, 361, 6)]], 0.28, TRAV_D, stage='detail')
    T.lines([[rp(th, 0.52, 0.026), rp(th, 0.86, 0.112)] for th in range(150, 400, 22)], 0.26, TRAV_D, stage='detail')
    T.poly([rp(th, 0.5, 0.02) for th in range(0, 360, 6)], SAND, 0.36)
    T.lines([[rp(180, 0.4, 0.02), rp(0, 0.4, 0.02)], [rp(160, 0.36, 0.02), rp(20, 0.36, 0.02)], [rp(200, 0.36, 0.02), rp(340, 0.36, 0.02)],
             [rp(140, 0.3, 0.02), rp(40, 0.3, 0.02)], [rp(220, 0.3, 0.02), rp(320, 0.3, 0.02)]], 0.28, SAND_D, stage='detail')
    # rim (top of the wall)
    rim_o = [T.P3(rp(th, 1.0, H(th))) for th in range(0, 360, 4)]
    rim_i = [T.P3(rp(th, 0.92, H(th))) for th in range(356, -1, -4)]
    T._add([rim_o, rim_i], True, (244, 236, 216), 0.34)
    # front wall: lit left, shaded right
    lit = [rp(th, 1, 0) for th in range(140, 39, -4)] + [rp(th, 1, H(th)) for th in range(40, 141, 2)]
    drk = [rp(th, 1, 0) for th in range(40, -41, -4)] + [rp(th, 1, H(th)) for th in range(-40, 41, 2)]
    T.poly(lit, TRAV, 0)
    T.poly(drk, TRAV_D, 0)
    T.poly([rp(th, 1, 0) for th in range(140, -41, -4)] + [rp(th, 1, H(th)) for th in range(-40, 141, 2)], None, 0.5)
    T.lines([[rp(th, 1, z) for th in range(140, -41, -5)] for z in (0.044, 0.085)], 0.3, stage='detail')
    T.lines([[rp(th, 1, HL) for th in range(140, 49, -5)]], 0.3, stage='detail')
    for lev in range(3):
        z0 = 0.008 + lev * 0.041
        subs = []
        for th in np.arange(134, -36, -8.4):
            if H(th) < z0 + 0.034:
                continue
            d = 2.5
            subs.append([T.P3(rp(th + d, 1, z0)), T.P3(rp(th + d, 1, z0 + 0.019)), T.P3(rp(th + d * 0.6, 1, z0 + 0.027)), T.P3(rp(th, 1, z0 + 0.03)),
                         T.P3(rp(th - d * 0.6, 1, z0 + 0.027)), T.P3(rp(th - d, 1, z0 + 0.019)), T.P3(rp(th - d, 1, z0))])
        T._add(subs, True, ARCH_DK, 0.2, stage='detail')
    subs = []
    for th in np.arange(134, 62, -8.4):
        subs.append([T.P3(rp(th + 1.3, 1, 0.152)), T.P3(rp(th + 1.3, 1, 0.176)), T.P3(rp(th - 1.3, 1, 0.176)), T.P3(rp(th - 1.3, 1, 0.152))])
    T._add(subs, True, ARCH_DK, 0.2, stage='detail')

    T.mark('arena')
    # ---- triumphal arch + forum columns
    T.box(0.105, 0.84, 0.10, 0.035, 0.075, c=TRAV, ink=0.42)
    T.arch('L', 0.155, 0.875, 0.0, 0.03, 0.055, fill=ARCH_DK)
    T.arch('L', 0.123, 0.875, 0.0, 0.016, 0.034, fill=ARCH_DK)
    T.arch('L', 0.187, 0.875, 0.0, 0.016, 0.034, fill=ARCH_DK)
    T.lines([[(0.105, 0.875, 0.06), (0.205, 0.875, 0.06)]], 0.26, stage='detail')
    # ---- trees
    for (a, b) in ((0.03, 0.62), (0.05, 0.93), (0.42, 0.93), (0.60, 0.80), (0.64, 0.62), (0.74, 0.80), (0.94, 0.72)):
        tree(T, a, b, r.uniform(0.9, 1.15), FOREST, 'stonepine')
    for (a, b) in ((0.68, 0.92), (0.985, 0.48)):
        tree(T, a, b, r.uniform(0.75, 0.95), JUNGLE, 'cypress')
    for (a, b) in ((0.30, 0.93), (0.84, 0.74)):
        tree(T, a, b, 0.8, GRASS_D, 'bush')

    # ---- life
    pr.rowboat(T, 0.715, 0.20, 'v', c=WOOD, crew=2, motion=cruise(0.0, 0.07, 0.9))
    pr.rowboat(T, 0.80, 0.62, 'u', c=TERRA, crew=1, motion=cruise(0.07, 0.0, 0.8))
    # vespas circling the piazza
    for k, (a, b, c_, mo) in enumerate(((0.06, 0.90, ACCENT, runner(0.52, 0.04, 9.0)), (0.12, 0.965, ACCENT, runner(0.50, 0.0, 7.5)),
                                        (0.02, 0.955, ZINC, runner(0.58, 0.01, 11.0)))):
        P = T.P(a, b)
        with T.grp('pop', pivot=P, motion=mo, stage='life', dur=0.22):
            T.lines2(P, [[(-1.6, 0), (1.6, 0.6)]], 1.5, c_)
            T.ell2(P + np.array([-1.9, 0.5]), 0.8, fill=DARK, ink=0.2, n=8, wob=0)
            T.ell2(P + np.array([1.9, 1.1]), 0.8, fill=DARK, ink=0.2, n=8, wob=0)
            T.poly2(P, [(-0.8, -0.6), (0.8, -0.6), (0.7, -3.0), (-0.7, -3.0)], CLOTH[k * 2], 0.26, wob=0)
            T.ell2(P + np.array([0, -4.0]), 1.05, fill=SKIN[k], ink=0.26, n=9, wob=0)
    # gelato cart with a saffron umbrella
    T.box(0.445, 0.845, 0.03, 0.02, 0.016, c=MARBLE, ink=0.3, guide=False)
    U = T.P(0.46, 0.855, 0.016)
    T.line2(U, [(0, 0), (0, -5.5)], 0.3)
    T.poly2(U, [(-4.2, -4.6), (0, -7.4), (4.2, -4.6), (0, -3.6)], ACCENT, 0.3, wob=0)
    crowd(T, [(0.03, 0.70), (0.30, 0.78), (0.60, 0.70), (0.58, 0.86), (0.30, 0.95), (0.03, 0.86)], 15, hat=MARBLE)
    stroll(T, [(0.605, 0.38), (0.84, 0.38)], 6, z=0.04, spread=0.012)
    crowd(T, [(0.26, 0.47), (0.42, 0.47), (0.42, 0.53), (0.26, 0.53)], 4, z=0.02, walk_frac=0)
    person(T, 0.215, 0.905, shirt=TERRA, hat=ACCENT, arms=True)       # a centurion, plumed
    stroll(T, [rp(th, 1.2) for th in range(150, -31, -20)], 12, spread=0.014, hat=MARBLE)
    stroll(T, [(0.60, 0.42), (0.56, 0.60), (0.62, 0.74), (0.80, 0.84)], 5)
    stroll(T, [(0.86, 0.38), (0.97, 0.38)], 3)
    pr.smoke(T, T.P(0.865, 0.07, 0.062), 0.8)
    pr.smoke(T, T.P(0.945, 0.22, 0.066), 0.7)
    pr.flock(T, 0.34, 0.46, 0.34, 10, s=0.6, orbit=(24, 8), speed=0.9)       # starlings wheeling over the arena
    pr.cloud(T, 0.20, 0.30, 0.34, 0.9)
    pr.glint(T, T.P3(rp(120, 1.0, HF)), 0.9)


# =========================================================== GREAT WALL ====
def greatwall(T):
    T.slab(GRASS, EARTH)
    r = T.rng
    inner = sm([(0.62, 0), (0.63, 0.16), (0.70, 0.36), (0.84, 0.50), (1, 0.52)])
    outer = sm([(0.74, 0), (0.75, 0.13), (0.81, 0.28), (0.90, 0.38), (1, 0.40)])
    T.tufts([(0, 0), (0.6, 0), (0.68, 0.4), (0.84, 0.54), (1, 0.56), (1, 1), (0, 1)], 90)
    # rice paddies at the front
    pad = [(0.70, 0.62), (0.97, 0.62), (0.97, 0.97), (0.40, 0.97), (0.40, 0.90), (0.70, 0.86)]
    with T.st('ground'):
        for (a, b, du, dv) in ((0.72, 0.63, 0.115, 0.10), (0.85, 0.63, 0.115, 0.10), (0.72, 0.745, 0.115, 0.10), (0.85, 0.745, 0.115, 0.10),
                               (0.60, 0.875, 0.115, 0.09), (0.73, 0.86, 0.115, 0.105), (0.86, 0.86, 0.105, 0.105), (0.47, 0.895, 0.115, 0.07)):
            T.poly([(a, b), (a + du, b), (a + du, b + dv), (a, b + dv)], WATER_L, 0.34)
            T.lines([[(a + du * q, b + 0.01), (a + du * q, b + dv - 0.01)] for q in (0.2, 0.4, 0.6, 0.8)], 0.3, GRASS_D)
    water(T, inner + outer[::-1], src=(0.68, 0.0), marks=14, t0=0.30, flow=(0.6, 1))
    T.wall_water('R', 0.40, 0.52)

    T.mark('ground')
    hills = [  # cu, cv, r, h, colour
        (0.19, 0.19, 0.24, 0.25, FOREST), (0.92, 0.14, 0.14, 0.11, GRASS_D), (0.45, 0.30, 0.20, 0.16, (160, 192, 132)),
        (0.30, 0.55, 0.22, 0.18, GRASS_D), (0.14, 0.79, 0.16, 0.12, (160, 192, 132))]

    def hz1(hh, u, v):
        cu, cv, rr, h, _ = hh
        return T.hill_z(u, v, cu, cv, rr, h)

    def hz(u, v):
        best, bi = 0.0, -1
        for k, hh in enumerate(hills):
            z = hz1(hh, u, v)
            if z > best:
                best, bi = z, k
        return best, bi
    # wall path over the crests
    path = [(0.0, 0.855), (0.08, 0.815), (0.14, 0.785), (0.21, 0.68), (0.30, 0.555), (0.36, 0.44), (0.445, 0.305), (0.53, 0.235), (0.615, 0.175)]
    path2 = [(0.765, 0.135), (0.86, 0.14), (0.92, 0.135), (1.0, 0.11)]

    def sample(pp):
        out = []
        for k in range(len(pp) - 1):
            a, b = pp[k], pp[k + 1]
            n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.011))
            for q in range(n):
                u = a[0] + (b[0] - a[0]) * q / n
                v = a[1] + (b[1] - a[1]) * q / n
                z, hi = hz(u, v)
                out.append((u, v, z, hi))
        z, hi = hz(*pp[-1])
        out.append((pp[-1][0], pp[-1][1], z, hi))
        return out
    S = sample(path) + [None] + sample(path2)
    runs = {}
    cur = None
    for q in S:
        if q is None:
            cur = None
            continue
        u, v, z, hi = q
        vis = True
        if hi >= 0:
            cu, cv, rr = hills[hi][:3]
            vis = (u - cu) + (v - cv) > -0.30 * rr
        if not vis:
            cur = None
            continue
        if cur is None or cur[0] != hi:
            cur = (hi, [])
            runs.setdefault(hi, []).append(cur[1])
        cur[1].append((u, v, z))
    WH = 0.046
    WALL = (226, 218, 204)

    def wall_run(pts):
        if len(pts) < 2:
            return
        lo = [T.P3(p) for p in pts]
        hi_ = [T.P3((p[0], p[1], p[2] + WH)) for p in pts]
        off = np.array([3.6, -2.2])          # the wall-walk is broad enough for five abreast
        far = [h + off for h in hi_]
        with T.st('detail'):
            T._add([far + hi_[::-1]], True, (246, 240, 226), 0.34, wob=0.1)
            T._add([lo + hi_[::-1]], True, WALL, 0.5, wob=0.1)
            T._add([[p + np.array([0, -WH * ZS * f_]) for p in lo] for f_ in (0.25, 0.5, 0.75)], False, None, 0.2, shade(WALL, 0.74), wob=0.1)
            if len(lo) > 2:
                T._add([[lo[k] + np.array([0, -WH * ZS * (0.25 * (k % 3))]), lo[k] + np.array([0, -WH * ZS * (0.25 * (k % 3) + 0.25)])] for k in range(1, len(lo) - 1)], False, None, 0.2, shade(WALL, 0.74), raw=True)
            teeth, teeth2 = [], []
            for k in range(0, len(hi_) - 1, 2):
                teeth.append([hi_[k], hi_[k] + np.array([0, -1.5]), hi_[k + 1] + np.array([0, -1.5]), hi_[k + 1]])
                teeth2.append([far[k], far[k] + np.array([0, -1.3]), far[k + 1] + np.array([0, -1.3]), far[k + 1]])
            T._add(teeth2, True, shade(WALL, 0.9), 0.26, raw=True)
            T._add(teeth, True, WALL, 0.3, raw=True)

    towers = {4: [(0.14, 0.785, 1)], 3: [(0.30, 0.555, 0), (0.215, 0.675, 0)], 2: [(0.445, 0.305, 1)], -1: [(0.615, 0.175, 0), (0.765, 0.135, 0)],
              1: [(0.92, 0.135, 1)]}

    def tower(u, v, flagged):
        z, _ = hz(u, v)
        z = max(0.0, z - 0.012)
        with T.st('detail'):
            T.box(u - 0.025, v - 0.025, 0.05, 0.05, 0.076, z=z, c=WALL, ink=0.44, guide=False)
            T.box(u - 0.03, v - 0.03, 0.06, 0.06, 0.014, z=z + 0.076, c=(240, 233, 218), ink=0.38, guide=False)
            T.arch('L', u, v + 0.025, z + 0.014, 0.016, 0.036, fill=ARCH_DK, ink=0.2)
            T.rects('R', v - 0.019, v + 0.019, u + 0.025, z + 0.038, z + 0.064, 2, 1, fill=ARCH_DK)
        if flagged:
            pr.flag(T, T.P(u, v, z + 0.09), ACCENT, 1.0, 7.0)

    order = sorted(range(len(hills)), key=lambda k: hills[k][0] + hills[k][1])
    for rr_ in runs.get(-1, []):
        wall_run(rr_)
    for (u, v, f) in towers.get(-1, []):
        tower(u, v, f)
    for n_, k in enumerate(order):
        cu, cv, rr, h, col = hills[k]
        t0 = 0.24 + 0.05 * n_
        T.guide_axis(cu, cv, h, ticks=4, r=rr).tp = t0 - 0.2
        with T.grp('rise', t0=t0, dur=0.46, pivot=T.P(cu, cv), stage='struct', ink_now=True, under=PAPER):
            T.hill(cu, cv, rr, h, c=col, guide=False, ink=0.5)
        for rr_ in runs.get(k, []):
            wall_run(rr_)
        for (u, v, f) in towers.get(k, []):
            tower(u, v, f)
        # trees standing on this hill
        n_tr = {0: 18, 1: 5, 2: 8, 3: 9, 4: 6, 5: 0}[k]
        pts = []
        tries = 0
        while len(pts) < n_tr and tries < 400:
            tries += 1
            a = r.uniform(0, 6.283)
            d = rr * r.uniform(0.25, 0.95)
            u, v = cu + d * math.cos(a), cv + d * math.sin(a)
            if (u - cu) + (v - cv) < -0.3 * rr or not (0.02 < u < 0.98 and 0.02 < v < 0.98):
                continue
            if any(math.hypot(u - S_[0], v - S_[1]) < 0.035 for S_ in S if S_):
                continue
            if any(math.hypot(u - a_, v - b_) < 0.04 for a_, b_ in pts):
                continue
            pts.append((u, v))
        pts.sort(key=lambda p_: p_[0] + p_[1])
        for (u, v) in pts:
            z, _ = hz(u, v)
            kind = r.choice(['fir', 'round', 'round', 'fir'] if k == 0 else ['round', 'round', 'fir'])
            col_t = ACCENT if r.random() < 0.10 else r.choice([FOREST, JUNGLE, FOREST])
            tree(T, u, v, r.uniform(0.7, 0.95), col_t, kind, z=z)

    # ---- pavilion + village by the paddies
    def pavilion(u, v, s=1.0):
        T.box(u - 0.035 * s, v - 0.03 * s, 0.07 * s, 0.06 * s, 0.01, c=STONE, ink=0.34, guide=False)
        for (a, b) in ((-0.026, -0.022), (0.026, -0.022), (-0.026, 0.022), (0.026, 0.022)):
            T.box(u + a * s - 0.004, v + b * s - 0.004, 0.008, 0.008, 0.04, z=0.01, c=TERRA, ink=0.28, guide=False)
        z = 0.05
        a, b = 0.048 * s, 0.042 * s
        ap = (u, v, z + 0.04)
        T.poly([(u - a, v - b, z), (u - a, v + b, z + 0.004), ap], shade(ZINC, 0.95), 0.36)
        T.poly([(u - a, v + b, z), (u + a, v + b, z), ap], ZINC, 0.36)
        T.poly([(u + a, v - b, z), (u + a, v + b, z), ap], shade(ZINC, 0.84), 0.36)
        T.poly2(T.P(u, v, z + 0.04), [(-0.7, 0), (0.7, 0), (0, -2.6)], ACCENT, 0.26, wob=0)
    pavilion(0.86, 0.565)
    T.house(0.42, 0.80, 0.07, 0.05, 0.03, 0.022, wall=MARBLE, roof=ZINC, axis='u', win=2)
    T.house(0.31, 0.84, 0.06, 0.05, 0.028, 0.02, wall=MARBLE, roof=ZINC, axis='v', win=2)
    for (a, b) in ((0.50, 0.86), (0.36, 0.93), (0.27, 0.93), (0.66, 0.60), (0.95, 0.585), (0.78, 0.585), (0.985, 0.30), (0.83, 0.05), (0.97, 0.03), (0.56, 0.05),
                   (0.52, 0.52), (0.60, 0.44), (0.46, 0.62), (0.02, 0.96), (0.03, 0.42)):
        tree(T, a, b, r.uniform(0.75, 1.0), r.choice([FOREST, JUNGLE, ACCENT]) if (a + b) > 1.2 else FOREST, r.choice(['round', 'fir']))

    # ---- life
    # farmers in the paddies, conical hats
    for (a, b) in ((0.73, 0.71), (0.87, 0.74), (0.75, 0.86), (0.95, 0.80), (0.63, 0.90), (0.84, 0.95)):
        person(T, a, b, shirt=r.choice([ZINC, MARBLE, TERRA]), hat=(232, 210, 160), path=[(a, b), (a + 0.03, b + 0.02)], speed=1.4)
    quad_ = pr.quad(T, 0.86, 0.815, 6.0, 3.2, 1.8, (1.2, 0.0), (1.9, 1.4), (120, 108, 104), horns=True, walk=walker(0.07, 0.0, 12))     # water buffalo
    # walkers all along the wall
    for hi_k, rr_list in runs.items():
        for run in rr_list:
            if len(run) < 6:
                continue
            route = [(p_[0] + 0.012, p_[1] - 0.012, p_[2] + WH) for p_ in run[1:-1:3]]
            if len(route) >= 2:
                stroll(T, route, max(2, len(run) // 6), spread=0.004, s=0.88, hat=(232, 210, 160))
    for (a, b, c_, d_) in ((0.76, 0.66, 0.80, 0.70), (0.90, 0.68, 0.93, 0.72), (0.78, 0.80, 0.82, 0.83), (0.92, 0.89, 0.89, 0.93), (0.66, 0.92, 0.70, 0.95)):
        person(T, a, b, shirt=r.choice([ZINC, MARBLE, TERRA]), hat=(232, 210, 160), path=[(a, b), (c_, d_)], speed=1.6)      # more hands in the paddies
    stroll(T, [(0.40, 0.87), (0.58, 0.88), (0.66, 0.66), (0.80, 0.60)], 6, hat=(232, 210, 160))
    stroll(T, [(0.50, 0.50), (0.60, 0.58), (0.72, 0.60)], 3)
    pr.smoke(T, T.P(0.455, 0.825, 0.056), 0.8)
    pr.smoke(T, T.P(0.34, 0.865, 0.05), 0.7)
    pr.flock(T, 0.30, 0.30, 0.42, 7, orbit=(22, 8), speed=0.7)
    crowd(T, [(0.52, 0.70), (0.64, 0.70), (0.64, 0.80), (0.52, 0.80)], 3)
    # bamboo raft with a cormorant fisherman
    P = T.P(0.72, 0.30)
    with T.grp('pop', pivot=P, motion=cruise(0.03, 0.05, 0.8), stage='life', dur=0.24):
        T.poly([(0.69, 0.285), (0.75, 0.285), (0.75, 0.315), (0.69, 0.315)], (226, 204, 150), 0.3, wob=0)
        T.poly2(P, [(-0.8, 0), (0.8, 0), (0.7, -2.4), (-0.7, -2.4)], ZINC, 0.26, wob=0)
        T.ell2(P + np.array([0, -3.3]), 1.0, fill=SKIN[1], ink=0.26, n=9, wob=0)
        T.poly2(P + np.array([0, -3.9]), [(-2.0, 0.2), (2.0, 0.2), (0, -1.5)], (232, 210, 160), 0.26, wob=0)
        T.line2(P, [(1.0, -2.0), (5.5, -4.6)], 0.3)
    # dragon kite
    K = T.P(0.86, 0.80, 0.36)
    with T.st('sky'):
        from .timeline import EV as _EV
        _fl = pr.floaty(5.0, 2.6, 1.6)

        def kite_m(t, age, ph, ev=_EV['greatwall']):
            # on camera, the dragon kite throws two loops
            from . import ease as _e
            a = 4 * math.pi * _e.in_out((t - (ev - 1.2)) / 2.4, 2.0)
            b = _fl(t, age, ph)
            return (b[0] + 8.0 * math.sin(a), b[1] - 8.0 * (1 - math.cos(a)), 14 * math.sin(a), 1.0, 1.0)
        kite_m.reach = 50
        with T.grp('drift', dur=0.6, pivot=K, off=(-8, 22), motion=kite_m, stage='sky'):
            T.line2(K, [(0, 0), (-6, 38)], 0.22, STONE_D, sky=True)
            T.line2(K, smooth_poly([(0, 0), (4, 3), (7, 1), (10, 4), (13, 2), (16, 5)], 2, closed=False), 1.1, ACCENT, sky=True, wob=0)
            T.poly2(K, [(-3.2, 0), (0, -3.6), (3.2, 0), (0, 3.2)], ACCENT, 0.34, wob=0, sky=True)
            T.lines2(K, [[(-3.2, 0), (3.2, 0)], [(0, -3.6), (0, 3.2)]], 0.22, sky=True)
    person(T, 0.775, 0.975, shirt=ROSE, arms=True, s=0.85)
    pr.cloud(T, 0.10, 0.14, 0.33, 0.9)
    pr.cloud(T, 0.50, 0.12, 0.30, 0.7)
    pr.glint(T, T.P(0.445, 0.305, 0.16 + 0.11), 0.8)

# ============================================================ TAJ MAHAL ====
SANDSTONE = (206, 128, 100)
WHITE_D = (222, 224, 228)


def taj(T):
    T.slab(GRASS, EARTH)
    r = T.rng
    inner = sm([(0.72, 0), (0.74, 0.12), (0.82, 0.24), (0.92, 0.36), (1, 0.40)])
    outer = sm([(0.84, 0), (0.86, 0.08), (0.91, 0.16), (0.96, 0.22), (1, 0.26)])
    PATH = (240, 232, 216)
    with T.st('ground'):
        T.poly([(0.0, 0.935), (1.0, 0.935), (1.0, 1.0), (0.0, 1.0)], (232, 222, 204), 0.34)          # street
        T.poly([(0.355, 0.42), (0.465, 0.42), (0.465, 0.875), (0.355, 0.875)], PATH, 0.34)           # axis walk
        T.poly([(0.05, 0.615), (0.77, 0.615), (0.77, 0.665), (0.05, 0.665)], PATH, 0.34)             # cross walk
        T.poly([(0.05, 0.42), (0.77, 0.42), (0.77, 0.445), (0.05, 0.445)], PATH, 0.3)
        for (a, b, c_, d_) in ((0.09, 0.475, 0.32, 0.585), (0.50, 0.475, 0.73, 0.585), (0.09, 0.695, 0.32, 0.845), (0.50, 0.695, 0.73, 0.845)):
            T.poly([(a, b), (c_, b), (c_, d_), (a, d_)], (190, 212, 160), 0.3)
            T.poly([((a + c_) / 2 - 0.022, (b + d_) / 2), ((a + c_) / 2, (b + d_) / 2 - 0.022), ((a + c_) / 2 + 0.022, (b + d_) / 2),
                    ((a + c_) / 2, (b + d_) / 2 + 0.022)], BLOSSOM, 0.3)
            T.speckle([(a + 0.01, b + 0.01), (c_ - 0.01, b + 0.01), (c_ - 0.01, b + 0.022), (a + 0.01, b + 0.022)], 9, c=ACCENT, w=0.7)
            T.speckle([(a + 0.01, d_ - 0.022), (c_ - 0.01, d_ - 0.022), (c_ - 0.01, d_ - 0.01), (a + 0.01, d_ - 0.01)], 9, c=ROSE, w=0.7)
    T.tufts([(0, 0), (0.7, 0), (0.73, 0.14), (0.82, 0.28), (0.95, 0.42), (1, 0.44), (1, 0.93), (0, 0.93)], 60)
    water(T, inner + outer[::-1], src=(0.78, 0.0), marks=11, t0=0.30, flow=(0.7, 1))
    T.wall_water('R', 0.26, 0.40)
    # reflecting pools
    for (b, d_) in ((0.452, 0.602), (0.678, 0.862)):
        water(T, [(0.392, b), (0.428, b), (0.428, d_), (0.392, d_)], src=(0.41, b), c=WATER_L, marks=3, t0=0.42, dur=0.3, shore=0.34, mark_c=(FOAM, WATER))
    # far bank: moonlight garden
    for (a, b) in ((0.90, 0.03), (0.96, 0.08), (0.985, 0.17)):
        tree(T, a, b, 0.85, FOREST, 'round')

    T.mark('ground')
    # ---- mosque (left) and guest house (right), red sandstone
    def side_hall(u0, v0, du, dv):
        T.box(u0, v0, du, dv, 0.062, c=SANDSTONE, ink=0.42)
        T.rects('L', u0, u0 + du, v0 + dv, 0.006, 0.052, 3 if du > 0.08 else 2, 1, fill=MARBLE, arch=True, fw=0.6, fh=1.0)
        T.rects('R', v0, v0 + dv, u0 + du, 0.006, 0.052, 3, 1, fill=MARBLE_D, arch=True, fw=0.6, fh=1.0)
        for q in (0.2, 0.5, 0.8):
            T.dome(u0 + du / 2, v0 + dv * q, 0.02 if q == 0.5 else 0.015, 0.026 if q == 0.5 else 0.018, z=0.062, c=MARBLE, guide=False, ink=0.34)
    side_hall(0.05, 0.13, 0.10, 0.17)
    side_hall(0.635, 0.15, 0.065, 0.14)

    # ---- plinth
    T.box(0.215, 0.055, 0.39, 0.35, 0.03, c=MARBLE, right=WHITE_D, ink=0.46)
    T.rects('L', 0.215, 0.605, 0.405, 0.004, 0.027, 16, 1, fill=WHITE_D, arch=True, fh=1.0, fw=0.6)
    T.rects('R', 0.055, 0.405, 0.605, 0.004, 0.027, 14, 1, fill=(204, 207, 214), arch=True, fh=1.0, fw=0.6)

    def minaret(u, v):
        prof = [(0.0135, 0), (0.0115, 0.066), (0.0155, 0.068), (0.0155, 0.074), (0.0105, 0.076), (0.0095, 0.132), (0.0135, 0.134), (0.0135, 0.14),
                (0.009, 0.142), (0.0082, 0.186), (0.012, 0.188), (0.012, 0.193)]
        T.rev(u, v, prof, 0.03, c=MARBLE, ink=0.38, guide=False)
        T.dome(u, v, 0.0095, 0.016, z=0.223, c=MARBLE, guide=False, ink=0.32)
        T.line([(u, v, 0.239), (u, v, 0.252)], 0.3, ACCENT_D, stage='detail')
        T.guide_axis(u, v, 0.25, ticks=6)
    minaret(0.24, 0.08)
    minaret(0.58, 0.08)
    minaret(0.24, 0.38)

    # ---- the mausoleum
    Z0, Z1 = 0.03, 0.168
    T.box(0.31, 0.13, 0.20, 0.20, Z1 - Z0, z=Z0, c=MARBLE, right=WHITE_D, ink=0.48)
    T.box(0.372, 0.33, 0.076, 0.007, 0.152, z=Z0, c=MARBLE, ink=0.4, guide=False)       # pishtaq frames
    T.box(0.51, 0.192, 0.007, 0.076, 0.152, z=Z0, c=MARBLE, right=WHITE_D, ink=0.4, guide=False)
    T.arch('L', 0.41, 0.337, Z0 + 0.004, 0.05, 0.12, fill=(206, 210, 220), ink=0.34)
    T.arch('R', 0.23, 0.517, Z0 + 0.004, 0.05, 0.12, fill=(190, 195, 206), ink=0.34)
    T.arch('L', 0.41, 0.337, Z0 + 0.004, 0.022, 0.05, fill=DARK, ink=0.24)
    T.arch('R', 0.23, 0.517, Z0 + 0.004, 0.022, 0.05, fill=DARK, ink=0.24)
    for (a0, a1) in ((0.316, 0.368), (0.452, 0.504)):
        T.rects('L', a0, a1, 0.33, Z0 + 0.008, Z1 - 0.012, 1, 2, fill=(206, 210, 220), arch=True, fw=0.56, fh=0.8)
    for (a0, a1) in ((0.136, 0.188), (0.272, 0.324)):
        T.rects('R', a0, a1, 0.51, Z0 + 0.008, Z1 - 0.012, 1, 2, fill=(190, 195, 206), arch=True, fw=0.56, fh=0.8)

    def chhatri(u, v):
        T.cyl(u, v, 0.016, 0.018, z=Z1, c=MARBLE, guide=False, ink=0.32)
        T.rects('L', u - 0.012, u + 0.012, v + 0.011, Z1 + 0.003, Z1 + 0.016, 2, 1, fill=WHITE_D, arch=True, fw=0.5, fh=1.0)
        T.dome(u, v, 0.02, 0.022, z=Z1 + 0.018, c=MARBLE, guide=False, ink=0.34)
    chhatri(0.342, 0.162)
    chhatri(0.478, 0.162)
    chhatri(0.342, 0.298)
    # drum + onion dome + finial
    T.cyl(0.41, 0.23, 0.058, 0.038, z=Z1, c=MARBLE, ink=0.44, guide=False)
    onion = [(0.058, 0), (0.067, 0.018), (0.072, 0.045), (0.069, 0.07), (0.058, 0.092), (0.04, 0.112), (0.022, 0.126), (0.009, 0.136), (0.0, 0.146)]
    T.rev(0.41, 0.23, onion, Z1 + 0.038, c=MARBLE, ink=0.48, guide=False, shade_f=0.94)
    T.guide_axis(0.41, 0.23, 0.38, ticks=9, r=0.072)
    T.guide([[(0.31, 0.33, 0), (0.51, 0.33, 0)], [(0.51, 0.13, 0), (0.51, 0.33, 0)], [(0.31, 0.33, Z1), (0.51, 0.33, Z1)]], ticks=4)
    F = T.P(0.41, 0.23, Z1 + 0.038 + 0.146)
    T.line2(F, [(0, 0), (0, -5.0)], 0.5, ACCENT_D, stage='detail')
    T.ell2(F + np.array([0, -2.0]), 0.9, fill=ACCENT, ink=0.24, n=8, wob=0, stage='detail')
    chhatri(0.478, 0.298)
    minaret(0.58, 0.38)
    T.mark('tomb')
    T.box(0.385, 0.405, 0.05, 0.02, 0.012, c=MARBLE, ink=0.3, guide=False)       # steps

    # ---- garden furniture: marble tank, cypress avenue
    T.box(0.382, 0.612, 0.056, 0.056, 0.009, c=MARBLE, ink=0.36, guide=False)
    T.poly([(0.392, 0.622, 0.009), (0.428, 0.622, 0.009), (0.428, 0.658, 0.009), (0.392, 0.658, 0.009)], WATER_L, 0.28, stage='detail')
    vs = [0.47, 0.515, 0.56, 0.70, 0.745, 0.79, 0.835]
    for v in vs:
        tree(T, 0.342, v, 0.72, JUNGLE, 'cypress')
        tree(T, 0.478, v, 0.72, JUNGLE, 'cypress')
    for (a, b) in ((0.07, 0.46), (0.07, 0.60), (0.07, 0.68), (0.07, 0.86), (0.75, 0.46), (0.75, 0.60), (0.75, 0.68), (0.75, 0.86), (0.20, 0.87), (0.62, 0.87),
                   (0.03, 0.06), (0.12, 0.05), (0.19, 0.36), (0.66, 0.36), (0.86, 0.50), (0.93, 0.62), (0.88, 0.78), (0.95, 0.88)):
        tree(T, a, b, r.uniform(0.75, 0.95), FOREST, 'round')

    # ---- great gate + wall
    T.box(0.04, 0.89, 0.30, 0.013, 0.03, c=SANDSTONE, ink=0.36, guide=False)
    T.box(0.48, 0.89, 0.33, 0.013, 0.03, c=SANDSTONE, ink=0.36, guide=False)
    T.box(0.335, 0.872, 0.15, 0.056, 0.10, c=SANDSTONE, ink=0.46)
    T.poly([(0.372, 0.928, 0.006), (0.448, 0.928, 0.006), (0.448, 0.928, 0.092), (0.372, 0.928, 0.092)], MARBLE, 0.3, stage='detail')
    T.arch('L', 0.41, 0.928, 0.006, 0.046, 0.076, fill=ARCH_DK, ink=0.3)
    T.rects('R', 0.878, 0.922, 0.485, 0.012, 0.085, 1, 2, fill=MARBLE, arch=True, fw=0.5, fh=0.7)
    for k in range(5):
        T.dome(0.352 + k * 0.029, 0.915, 0.0085, 0.012, z=0.10, c=MARBLE, guide=False, ink=0.28)
    for (a, b) in ((0.338, 0.925), (0.482, 0.925)):
        T.cyl(a, b, 0.011, 0.112, c=SANDSTONE, guide=False, ink=0.34)
        T.dome(a, b, 0.013, 0.016, z=0.112, c=MARBLE, guide=False, ink=0.3)

    # ---- life
    pr.rowboat(T, 0.83, 0.12, 'v', c=WOOD, crew=2, motion=cruise(0.02, 0.05, 0.8))
    pr.rowboat(T, 0.90, 0.30, 'u', c=ACCENT, crew=1, motion=cruise(0.04, 0.03, 0.7))
    crowd(T, [(0.36, 0.425), (0.46, 0.425), (0.46, 0.60), (0.36, 0.60)], 6, walk_frac=0.5, mind=0.02)
    crowd(T, [(0.36, 0.67), (0.46, 0.67), (0.46, 0.87), (0.36, 0.87)], 7, walk_frac=0.5, mind=0.02)
    crowd(T, [(0.06, 0.62), (0.34, 0.62), (0.34, 0.66), (0.06, 0.66)], 4)
    crowd(T, [(0.48, 0.62), (0.76, 0.62), (0.76, 0.66), (0.48, 0.66)], 4)
    crowd(T, [(0.23, 0.345), (0.58, 0.345), (0.58, 0.395), (0.23, 0.395)], 6, z=0.03, walk_frac=0.3, mind=0.02)
    for (a, b, c_) in ((0.12, 0.52, ACCENT), (0.26, 0.55, ROSE), (0.60, 0.53, ACCENT), (0.16, 0.77, (178, 160, 200)), (0.66, 0.78, ROSE)):
        person(T, a, b, shirt=c_, pants=c_)          # saris
    # the street: tuk-tuks, a cow, flower sellers
    pr.tuktuk(T, 0.03, 0.955, 'u', ACCENT, motion=runner(0.94, 0.0, 10.0))
    pr.tuktuk(T, 0.97, 0.982, 'u', (112, 158, 108), motion=runner(-0.94, 0.0, 12.5))
    pr.tuktuk(T, 0.03, 0.958, 'u', ACCENT, motion=runner(0.94, 0.0, 14.0))
    pr.car(T, 0.97, 0.985, 'u', c=MARBLE, s=0.9, motion=runner(-0.94, 0.0, 9.0))
    pr.quad(T, 0.30, 0.975, 5.2, 2.8, 2.0, (1.2, -0.6), (1.7, 1.2), MARBLE, horns=True, s=0.9)
    T.box(0.50, 0.945, 0.03, 0.02, 0.014, c=WOOD, ink=0.28, guide=False)
    T.speckle([(0.50, 0.945), (0.53, 0.945), (0.53, 0.965), (0.50, 0.965)], 8, c=ACCENT, w=0.8, z=0.016)
    crowd(T, [(0.40, 0.94), (0.72, 0.94), (0.72, 0.99), (0.40, 0.99)], 5, mind=0.03)
    pr.bird(T, 0.40, 0.22, 0.46, 0.8, c=JUNGLE, orbit=(12, 3))
    pr.bird(T, 0.46, 0.26, 0.42, 0.7, c=JUNGLE, orbit=(10, 3))
    pr.cloud(T, 0.08, 0.02, 0.26, 0.85)
    pr.glint(T, F + np.array([0, -4.0]), 1.0)


# ====================================================== RIO DE JANEIRO ====
GRANITE = (196, 186, 178)


def sea_wall(T, face, thick, t0=0.34, bed=0.26):
    """Cut-away wall of a sea tile: water that rises in section and finds its level."""
    from . import ease
    zb = -thick
    zs = -thick * (1 - bed)

    def fp(a, z):
        return (a, 1, z) if face == 'L' else (1, a, z)
    col = WATER_D if face == 'L' else shade(WATER_D, 0.9)
    with T.st('slab'):
        frame = T.poly([fp(0, 0), fp(1, 0), fp(1, zb), fp(0, zb)], None, 0.6, wob=0.2)
        bedpts = [fp(0, zb)] + [fp(k / 12.0, zs + thick * 0.05 * math.sin(k * 1.9 + (0 if face == 'L' else 2))) for k in range(13)] + [fp(1, zb)]
    A0, A1 = T.P3(fp(0, 0)), T.P3(fp(1, 0))
    B0 = T.P3(fp(0, zb))
    dz = B0 - A0                    # full depth vector (map px)

    def draw(c, tau, t, a, R):
        x = (tau - t0) / 0.6
        if x <= 0:
            return
        lvl = min(1.04, ease.spring(x, 1.5, 3.4)) if x < 1.6 else 1.0
        amp = 1.6 * math.exp(-3.2 * max(0.0, x)) + 0.22
        pts = []
        n = 18
        for k in range(n + 1):
            q = k / n
            top = A0 + (A1 - A0) * q + dz * (1 - lvl)
            top = top + np.array([0, amp * math.sin(q * 11 + t * 4.2 + (0 if face == 'L' else 1.3))])
            pts.append(top)
        poly = pts + [T.P3(fp(1, zb)), T.P3(fp(0, zb))]
        R.poly(c, poly, fill=col, a=a)
        R.poly(c, pts, ink=FOAM, w=0.7, a=a, closed=False)
    T.custom(draw, [A0, A1, B0], stage='slab')
    with T.st('slab'):
        T.poly(bedpts, SAND_D if face == 'L' else shade(SAND_D, 0.9), 0.36, wave='g')
        T.poly([fp(0, 0), fp(1, 0), fp(1, zb), fp(0, zb)], None, 0.6, wob=0.2)
    return frame


def rio(T):
    """Rio de Janeiro.  Corcovado stands in the middle of the slab (so Christ is seen against Rio's own
    forest and sky, not against a neighbour), Copacabana curves round the bay below it, Sugarloaf guards the mouth."""
    from . import extras as ex
    from .timeline import EV
    ev = EV['rio']
    sea_wall(T, 'L', 0.11)
    sea_wall(T, 'R', 0.11)
    T.slab(SAND, EARTH, walls=False)
    r = T.rng
    coast = sm([(0.30, 0.0), (0.33, 0.10), (0.46, 0.18), (0.60, 0.28), (0.635, 0.40), (0.59, 0.52), (0.555, 0.63), (0.575, 0.72), (0.64, 0.78),
                (0.72, 0.82), (0.745, 0.90), (0.69, 0.97), (0.61, 1.0)], 2)
    sea = coast + [(1, 1), (1, 0)]
    land = coast + [(0, 1), (0, 0)]
    water(T, sea, src=(0.38, 0.0), marks=30, t0=0.26, dur=0.55, shore=0.0, flow=(1, 0.2),
          region=[(0.5, 0.02), (0.98, 0.02), (0.98, 0.98), (0.80, 0.98), (0.78, 0.80), (0.66, 0.70), (0.68, 0.30)])
    beach = sm([(0.635, 0.40), (0.59, 0.52), (0.555, 0.63), (0.575, 0.72)], 2)
    back = sm([(0.535, 0.725), (0.515, 0.63), (0.55, 0.52), (0.595, 0.40)], 2)
    with T.st('ground'):
        T.poly(land, GRASS, 0.42)
        T.poly(beach + back, SAND, 0.36)
        T.line(back, 0.55, (240, 234, 222))                                           # the promenade, with its wave mosaic
        T.lines([[(p[0] - 0.006, p[1]), (p[0] - 0.012, p[1] + 0.008)] for p in back[::2]], 0.24, DARK)
        T.line(sm([(0.30, 0.02), (0.36, 0.16), (0.52, 0.26), (0.585, 0.36)], 2), 0.5, (236, 228, 212))      # the coast road
        T.line(sm([(0.50, 0.74), (0.40, 0.80), (0.31, 0.80), (0.24, 0.90), (0.33, 1.0)], 2), 0.5, (236, 228, 212))
        T.line(coast[2:-1], 0.45, FOAM)                                              # surf along the shore
    water(T, [(0.15, 0.26), (0.21, 0.24), (0.26, 0.28), (0.25, 0.34), (0.19, 0.36), (0.15, 0.32)], src=(0.2, 0.3), c=WATER, marks=2, t0=0.45, dur=0.3, shore=0.36, smooth=2)
    T.tufts(land, 70)
    ex.flowers(T, [(0.02, 0.02), (0.28, 0.02), (0.3, 0.22), (0.12, 0.36), (0.02, 0.3)], 22)
    T.mark('ground')
    ex.rock_in_water(T, 0.80, 0.30, 1.2)
    ex.rock_in_water(T, 0.86, 0.36, 0.8)
    ex.rock_in_water(T, 0.52, 0.10, 0.7)

    # ---- hills behind, then Corcovado
    hills = ((0.10, 0.13, 0.10, 0.10, JUNGLE), (0.08, 0.50, 0.11, 0.11, JUNGLE), (0.10, 0.67, 0.10, 0.09, FOREST), (0.23, 0.72, 0.085, 0.075, JUNGLE))
    for k, (a, b, r_, h_, c_) in enumerate(hills):
        with T.grp('rise', t0=0.34 + 0.03 * k, dur=0.45, pivot=T.P(a, b), stage='struct', ink_now=True, under=PAPER):
            T.hill(a, b, r_, h_, c=c_, guide=False)
    cu, cv, rr, hh = 0.36, 0.44, 0.145, 0.20
    T.guide_axis(cu, cv, hh + 0.2, ticks=8, r=rr).tp = 0.05
    C = T.P(cu, cv)
    with T.grp('rise', t0=0.30, dur=0.5, pivot=C, stage='struct', ink_now=True, under=PAPER):
        prof = [(rr, 0), (rr * 0.88, hh * 0.14), (rr * 0.7, hh * 0.4), (rr * 0.5, hh * 0.66), (rr * 0.32, hh * 0.85), (rr * 0.17, hh * 0.96), (0.026, hh)]
        T.rev(cu, cv, prof, c=FOREST, ink=0.5, guide=False, cap=GRANITE)
        T.poly2(C, smooth_poly([(-2, -hh * ZS + 1), (9, -hh * ZS * 0.84), (12, -hh * ZS * 0.6), (4, -hh * ZS * 0.46), (-1, -hh * ZS * 0.7)], 2), GRANITE, 0.34)
        T.lines2(C, [[(3, -hh * ZS * 0.8), (5, -hh * ZS * 0.58)], [(7, -hh * ZS * 0.78), (8.5, -hh * ZS * 0.62)], [(1, -hh * ZS * 0.7), (2, -hh * ZS * 0.52)]], 0.26, STONE_D)
        # the rack railway winding up through the forest, and the summit terrace
        T.line2(C, smooth_poly([(-17, -3), (-9, -7), (-13, -12), (-5, -15), (-8, -19), (-2, -22)], 2, closed=False), 0.5, (236, 228, 212))
        T.lines2(C, [[(-12 + k * 2.0, -5.0 - k * 2.2), (-11 + k * 2.0, -6.2 - k * 2.2)] for k in range(7)], 0.2, DARK)
        T.poly2(C, [(-4.2, -hh * ZS + 0.4), (4.2, -hh * ZS + 0.4), (3.6, -hh * ZS - 1.6), (-3.6, -hh * ZS - 1.6)], MARBLE_D, 0.3, wob=0)
    S = T.P(cu, cv, hh) + np.array([0, -1.2])
    with T.grp('drop', t0=0.86, dur=0.42, pivot=S, off=(0, 26), stage='struct'):
        q = 1.25
        T.poly2(S, [(-2.4 * q, 0), (2.4 * q, 0), (1.9 * q, -3.2 * q), (-1.9 * q, -3.2 * q)], STONE, 0.36, wob=0)
        T.poly2(S, [(x * q, y * q) for x, y in [(-1.6, -3.2), (1.6, -3.2), (1.3, -9.4), (7.8, -10.1), (7.8, -11.6), (1.1, -11.8), (0.9, -12.5), (-0.9, -12.5),
                    (-1.1, -11.8), (-7.8, -11.6), (-7.8, -10.1), (-1.3, -9.4)]], MARBLE, 0.42, wob=0)
        T.ell2(S + np.array([0, -13.7 * q]), 1.3 * q, 1.4 * q, fill=MARBLE, ink=0.38, n=10, wob=0)
        T.lines2(S, [[(-0.5 * q, -4 * q), (-0.3 * q, -9 * q)], [(0.6 * q, -4 * q), (0.4 * q, -9 * q)], [(-6.5 * q, -10.4 * q), (-2 * q, -9.9 * q)],
                     [(2 * q, -9.9 * q), (6.5 * q, -10.4 * q)], [(-0.9 * q, -11.9 * q), (0.9 * q, -11.9 * q)]], 0.22, MARBLE_D, wob=0)
    crowd(T, [(cu - 0.02, cv + 0.012), (cu + 0.02, cv + 0.012), (cu + 0.02, cv + 0.03), (cu - 0.02, cv + 0.03)], 2, z=hh - 0.012, walk_frac=0, dense=1.0)

    # ---- the city along Copacabana
    towers = ((0.535, 0.345, 0.06), (0.55, 0.40, 0.085), (0.535, 0.455, 0.05), (0.515, 0.51, 0.075), (0.495, 0.565, 0.055), (0.48, 0.62, 0.09),
              (0.485, 0.675, 0.05), (0.425, 0.64, 0.04), (0.415, 0.70, 0.055))
    for k, (a, b, hgt) in enumerate(towers):
        col = [MARBLE, (244, 226, 200), ROSE, MARBLE, WATER_L, MARBLE, ACCENT_L, ROSE, MARBLE][k]
        with T.grp('rise', t0=0.5 + 0.03 * k, dur=0.3, pivot=T.P(a + 0.02, b + 0.018), stage='struct', ink_now=True, under=PAPER):
            T.box(a, b, 0.04, 0.036, hgt, c=col, ink=0.38, guide=False)
            fl = max(2, int(hgt / 0.013))
            T.rects('L', a, a + 0.04, b + 0.036, 0.006, hgt - 0.004, 3, fl, fill=(170, 200, 224), ink=0.12, fw=0.5, fh=0.5)
            T.rects('R', b, b + 0.036, a + 0.04, 0.006, hgt - 0.004, 2, fl, fill=(144, 178, 204), ink=0.12, fw=0.5, fh=0.5)
            T.lines([[(a, b + 0.036, 0.006 + (hgt - 0.01) * q / fl), (a + 0.04, b + 0.036, 0.006 + (hgt - 0.01) * q / fl)] for q in range(1, fl)], 0.16, shade(col, 0.78), stage='detail')
            T.box(a + 0.012, b + 0.01, 0.012, 0.012, 0.008, z=hgt, c=STONE, ink=0.24, guide=False)        # lift housing / water tank
    # favela climbing the western hill: boxes of colour, washing lines between them
    for k in range(18):
        a = 0.05 + (k % 6) * 0.03 + r.uniform(-0.005, 0.005)
        b = 0.80 + (k // 6) * 0.042 + r.uniform(-0.005, 0.005)
        hgt = r.uniform(0.016, 0.03)
        T.box(a, b, 0.024, 0.022, hgt, c=r.choice([ROSE, ACCENT_L, WATER_L, MARBLE, TERRA, (190, 226, 150)]), ink=0.3, guide=False)
        T.rects('L', a, a + 0.024, b + 0.022, 0.004, hgt - 0.003, 2, 1, fill=DARK, ink=0.1, fw=0.36, fh=0.6)
    ex.laundry(T, (0.062, 0.84, 0.03), (0.125, 0.84, 0.026))
    ex.laundry(T, (0.15, 0.885, 0.03), (0.21, 0.885, 0.028))
    # the stadium
    T.rev(0.33, 0.885, [(0.058, 0), (0.062, 0.022), (0.05, 0.022)], c=MARBLE, ink=0.38, guide=False, cap=GRASS_D)
    T.disk(0.33, 0.885, 0.03, 0.022, fill=(140, 214, 120), ink=0.26, stage='detail')
    T.lines([[(0.33, 0.857, 0.022), (0.33, 0.913, 0.022)], T.ring(0.33, 0.885, 0.008, 0.022, n=10)], 0.2, MARBLE, stage='detail')
    T.lines([[(0.33 + 0.06 * math.cos(q), 0.885 + 0.06 * math.sin(q), 0.004), (0.33 + 0.06 * math.cos(q), 0.885 + 0.06 * math.sin(q), 0.021)]
             for q in np.linspace(0.5, 3.4, 9)], 0.22, STONE_D, stage='detail')

    # ---- Sugarloaf and Urca, joined by the cable car
    ua, ub = (0.60, 0.86), (0.69, 0.905)
    T.guide_axis(ub[0], ub[1], 0.25, ticks=5, r=0.07).tp = 0.12
    with T.grp('rise', t0=0.42, dur=0.45, pivot=T.P(*ua), stage='struct', ink_now=True, under=PAPER):
        T.hill(ua[0], ua[1], 0.07, 0.085, c=FOREST, guide=False)
    with T.grp('rise', t0=0.48, dur=0.5, pivot=T.P(*ub), stage='struct', ink_now=True, under=PAPER):
        sl = [(0.074, 0), (0.07, 0.05), (0.062, 0.11), (0.05, 0.16), (0.034, 0.20), (0.016, 0.224), (0.0, 0.23)]
        T.rev(ub[0], ub[1], sl, c=GRANITE, ink=0.5, guide=False)
        T.rev(ub[0], ub[1], [(0.076, 0), (0.073, 0.035), (0.0, 0.035)], c=FOREST, ink=0.4, guide=False)
        Cs = T.P(*ub)
        T.lines2(Cs, [[(-5, -20), (-6.4, -9)], [(-1, -24), (-1.6, -11)], [(3, -22), (4.4, -10)], [(-3, -14), (-3.8, -6)]], 0.24, STONE_D)
    A, B = T.P(ua[0], ua[1], 0.085), T.P(ub[0], ub[1], 0.23)
    T.box(ua[0] - 0.01, ua[1] - 0.01, 0.02, 0.02, 0.012, z=0.08, c=MARBLE, ink=0.28, guide=False)
    T.line2((0, 0), [A + np.array([0, -1.5]), B], 0.3, stage='detail')
    T.line2((0, 0), [A + np.array([0, -1.5]), T.P(0.505, 0.775, 0.0)], 0.3, stage='detail')

    def car_m(t, age, ph):
        s_ = 0.5 - 0.5 * math.cos((t - ev) * 1.1 + math.pi * 0.5 + ph * 0.0)
        d = (B - A) * (0.12 + 0.76 * s_)
        return (d[0], d[1])
    car_m.reach = 40
    with T.grp('pop', pivot=A, motion=car_m, stage='life', dur=0.2):
        T.poly2(A, [(-1.8, 0.2), (1.8, 0.2), (1.8, 2.8), (-1.8, 2.8)], ACCENT, 0.3, wob=0)
        T.poly2(A, [(-1.3, 0.7), (1.3, 0.7), (1.3, 1.7), (-1.3, 1.7)], WATER_L, 0.16, wob=0)
        T.line2(A, [(0, -1.4), (0, 0.2)], 0.3)

    # ---- forest
    jung = [(0.02, 0.02), (0.27, 0.02), (0.32, 0.14), (0.50, 0.24), (0.56, 0.32), (0.46, 0.60), (0.38, 0.62), (0.34, 0.78), (0.02, 0.78)]
    pts = [p_ for p_ in T.scatter(jung, 46, mind=0.045)
           if not (0.13 < p_[0] < 0.28 and 0.22 < p_[1] < 0.38) and (math.hypot(p_[0] - cu, p_[1] - cv) > 0.075 or (p_[0] + p_[1]) > cu + cv + 0.05)]
    pts.sort(key=lambda p_: p_[0] + p_[1])
    for (a, b) in pts:
        z = max(T.hill_z(a, b, hl[0], hl[1], hl[2], hl[3]) for hl in hills)
        d = math.hypot(a - cu, b - cv) / rr
        if d < 1:
            z = max(z, hh * (1 - d) ** 1.2 * 0.92)
        tree(T, a, b, r.uniform(0.7, 0.95), r.choice([JUNGLE, FOREST, FOREST, (120, 190, 110)]), r.choice(['jungle', 'round', 'jungle', 'palm']), z=z)
    for (a, b) in ((0.36, 0.95), (0.44, 0.93), (0.52, 0.96), (0.40, 0.76), (0.27, 0.96)):
        tree(T, a, b, 0.8, FOREST, r.choice(['round', 'palm']))
    for (a, b) in ((0.60, 0.385), (0.585, 0.44), (0.57, 0.50), (0.552, 0.56), (0.535, 0.62), (0.53, 0.69)):
        tree(T, a, b, 0.7, FOREST, 'palm')
    ex.jetty(T, 0.64, 0.765, 'u', 0.07)
    ex.buoy(T, 0.78, 0.74)
    ex.buoy(T, 0.86, 0.50, MARBLE)
    for (a, b) in ((0.70, 0.735), (0.735, 0.76)):                                      # yachts on their moorings
        pr.sailboat(T, a, b, 'u', s=0.6, jib=False)

    # ---- life
    for k, (a, b) in enumerate(((0.615, 0.41), (0.60, 0.455), (0.585, 0.50), (0.572, 0.545), (0.56, 0.59), (0.552, 0.635), (0.553, 0.68))):
        U = T.P(a, b)
        with T.grp('pop', pivot=U, stage='life', dur=0.2):
            T.poly2(U, [(-2.2, 0.6), (0.6, 0.0), (2.4, 1.0), (-0.4, 1.6)], [ROSE, WATER_L, MARBLE][k % 3], 0.2, wob=0)     # towel
            T.line2(U, [(0, 0), (0, -3.6)], 0.26)
            T.poly2(U, [(-2.6, -3.0), (0, -4.8), (2.6, -3.0), (0, -2.4)], ACCENT if k % 2 == 0 else MARBLE, 0.26, wob=0)
    crowd(T, [(0.60, 0.40), (0.63, 0.41), (0.57, 0.71), (0.545, 0.70)], 8, mind=0.02, walk_frac=0.3)
    for (a, b) in ((0.66, 0.44), (0.635, 0.52), (0.60, 0.62), (0.62, 0.70), (0.69, 0.50)):            # swimmers
        W_ = T.P(a, b)
        with T.grp('pop', pivot=W_, motion=bobber(0.3, 0, 1.0, (0.02, 0.01), 6), stage='life', dur=0.2):
            T.ell2(W_ + np.array([0, -0.8]), 1.0, fill=r.choice(SKIN), ink=0.26, n=9, wob=0)
            T.line2(W_, [(-2.2, 0.3), (2.2, 0.3)], 0.36, FOAM, wob=0)
    # beach football
    Bp = T.P(0.575, 0.585)
    for k_, (a, b) in enumerate(((0.582, 0.56), (0.563, 0.60), (0.59, 0.595), (0.568, 0.57))):
        person(T, a, b, shirt=ACCENT if k_ % 2 else MARBLE, path=[(a, b), (a + 0.01, b + 0.018), (a - 0.008, b + 0.006)], loop=True, speed=5.0, pause=0.1, s=0.9)
    with T.grp('pop', pivot=Bp, stage='life', dur=0.2,
               motion=lambda t, age, ph: (4.0 * math.sin(t * 2.3), 2.0 * math.sin(t * 1.7) - 3.0 * abs(math.sin(t * 4.6)), 0.0, 1.0, 1.0)):
        T.ell2(Bp, 0.7, fill=MARBLE, ink=0.24, n=8, wob=0)
    stroll(T, [(0.595, 0.40), (0.55, 0.52), (0.515, 0.63), (0.535, 0.725)], 8, spread=0.005)
    stroll(T, [(0.07, 0.79), (0.24, 0.79)], 3)
    stroll(T, [(0.50, 0.74), (0.40, 0.80), (0.31, 0.80)], 4)
    stroll(T, [(0.30, 0.02), (0.36, 0.16), (0.52, 0.26)], 3)
    pr.rowboat(T, 0.185, 0.30, 'u', c=ACCENT, crew=2, motion=cruise(0.02, 0.01, 0.6))
    pr.smoke(T, T.P(0.10, 0.86, 0.03), 0.7)
    pr.smoke(T, T.P(0.17, 0.90, 0.03), 0.6)

    # ---- on camera: the samba school comes down the promenade, drums and plumes and a storm of confetti
    dvec = pr.uvd(-0.07, 0.25)
    wk = pr.Walk(dvec, 11.0, 0.9)
    php = math.pi / 2 - 2 * math.pi * ev / 11.0
    for k in range(11):
        f = k / 10.0
        a, b = 0.60 - 0.02 * f - 0.012 * (k % 2), 0.36 + 0.105 * f
        col = [ACCENT, ROSE, (120, 200, 120), ACCENT_L, (178, 150, 220)][k % 5]
        Q = person(T, a, b, shirt=col, pants=col, hat=[ACCENT, MARBLE, ROSE][k % 3], arms=True, walk=wk, ph=php, s=0.95)
        with T.grp('pop', pivot=Q, motion=wk, stage='life', dur=0.2, ph=php):
            T.lines2(Q, [[(0, -7.2), (-1.6, -10.2)], [(0, -7.2), (0, -10.8)], [(0, -7.2), (1.6, -10.2)]], 0.6, [ACCENT, ROSE, MARBLE][(k + 1) % 3], wob=0)   # plumes
    cc = T.P(0.56, 0.52)
    seeds = [(r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(0, 1), r.choice([ACCENT, ROSE, MARBLE, (120, 200, 120), ACCENT_L, WATER_L])) for _ in range(70)]

    def confetti(c, tau, t, a, R):
        x = t - ev + 1.3
        if x <= 0 or x > 4.2:
            return
        for (sx, sy, ph, col) in seeds:
            f = (x * 0.45 + ph) % 1.0
            al = a * min(1.0, x * 2) * min(1.0, (4.2 - x) * 1.5) * math.sin(math.pi * f) ** 0.5
            px = cc[0] + sx * 20 + dvec[0] * (x / 4.2 - 0.5) + 2 * math.sin(f * 12 + ph * 20)
            py = cc[1] + sy * 9 - 20 + 22 * f + dvec[1] * (x / 4.2 - 0.5)
            R.pf.setColor(argb(vivid(col), al))
            c.drawRect(skia.Rect.MakeXYWH(float(px), float(py), 0.9, 0.6), R.pf)
    import skia
    from .core import argb
    T.custom(confetti, [cc + np.array([-50, -40]), cc + np.array([50, 40])], stage='sky', sky=True)

    pr.sailboat(T, 0.70, 0.14, 'u', motion=cruise(0.11, 0.03, 0.8))
    pr.sailboat(T, 0.88, 0.62, 'v', sail=ACCENT_L, motion=cruise(-0.01, 0.10, 0.7), s=0.9)
    pr.sailboat(T, 0.74, 0.40, 'u', s=0.8, motion=cruise(0.08, -0.02, 0.6))
    pr.steamer(T, 0.80, 0.92, 'u', L=0.15, motion=cruise(0.07, -0.01, 0.5, 0.2, 0.4))
    pr.rowboat(T, 0.42, 0.06, 'v', c=TERRA, crew=1)
    G = T.P(0.60, 0.20, 0.30)
    with T.st('sky'):
        with T.grp('drift', dur=0.6, pivot=G, off=(-30, -14), motion=pr.floaty(11.0, 4.0, 0.9), stage='sky'):
            T.poly2(G, [(-6, 1.2), (0, -2.2), (6, 1.2), (0, 0.2)], ACCENT, 0.34, wob=0, sky=True)
            T.lines2(G, [[(0, 0), (0, 3.4)]], 0.24, sky=True)
            T.ell2(G + np.array([0, 3.9]), 0.8, fill=DARK, ink=0, n=8, wob=0, sky=True)
    pr.flock(T, 0.78, 0.50, 0.22, 8, orbit=(26, 9), c=(90, 90, 100))
    pr.sparkles(T, [T.P(0.72 + 0.2 * math.sin(k * 2.4), 0.2 + 0.07 * k) for k in range(10)], t0=1.2, s=0.6, rate=0.8)
    ex.motes(T, S + np.array([0, -8]), 9, 12, 26)
    pr.glint(T, S + np.array([0, -20.0]), 0.9)
    pr.cloud(T, 0.04, 0.30, 0.16, 0.8)
    pr.cloud(T, 0.50, 0.50, 0.26, 0.75)


BUILDERS = {'pyramids': pyramids, 'colosseum': colosseum, 'greatwall': greatwall, 'taj': taj, 'rio': rio}
