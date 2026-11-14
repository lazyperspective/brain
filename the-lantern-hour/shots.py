"""The shots, in running order."""
from rig import *
from timeline import *

OLD_S = 290.0
YNG_S = 105.0
PLANT_H = 380.0
F_SHADE = np.array([0.56, 0.64, 0.82], F32)
F_LIT = np.array([1.08, 1.02, 0.86], F32)
DROP = (0.60, 0.70, 0.80)


def bump(t, t0, dur):
    u = (t - t0) / dur
    return math.sin(math.pi * u) if 0 < u < 1 else 0.0


def held_lantern(L, rng, mouth, w, age_u, face=1):
    """what is left of a lantern while it is being eaten. age_u 0..1"""
    if age_u >= 1:
        return
    if age_u < 0.55:
        ww = w * (1 - 0.5 * age_u / 0.55)
        draw_lantern(L, rng, mouth[0] + face * ww * 0.25, mouth[1] - ww * 0.35, ww, ripe=1.0, lit=0.3, ang=face * (0.5 + 2.0 * age_u))
    else:
        r = w * 0.2 * (1 - (age_u - 0.55) / 0.45 * 0.6)
        a = np.linspace(0, 6.283, 14)
        fillp(L, np.stack([mouth[0] + face * r * 0.6 + r * np.cos(a), mouth[1] + r * np.sin(a)], 1), VERM, rng, ang=1.0, w=max(1.2, r * 0.4), solid=0.9, grain=0.4, edge=0.8)


def find_bend(px, py, hgt, target_h, face=1):
    best = (1e9, 0.5, px)
    for b in np.linspace(0.15, 0.95, 60):
        top, w = lantern_tops(px, py, hgt, b, face=face)[0]
        h = py - (top[1] + w * 1.18 * 0.62)
        if abs(h - target_h) < best[0]:
            best = (abs(h - target_h), float(b), float(top[0]))
    return best[1], best[2]


def drip(c, rng, t, td, x, y0, y1, k=1.0):
    u = (t - td) / 0.26
    if 0 <= u < 1:
        y = y0 + (y1 - y0) * u * u
        ln = (10 + 26 * u) * k
        b = Batch(c, *c.roi(x - 4, y - ln - 3, x + 4, y + 3))
        b.line(np.array([(x, y - ln), (x + rng.normal(0, 0.5), y)]), max(1.0, 1.8 * k), 0.75, taper=(0.3, 1.0))
        b.commit(DROP, grain=0.5, soft=0.25)
    elif 1 <= u < 1.9:
        v = u - 1
        b = Batch(c, *c.roi(x - 30 * k, y1 - 24 * k, x + 30 * k, y1 + 6 * k))
        for sgn in (-1, 1):
            for j in range(2):
                a = 0.5 + 0.5 * j
                p0 = np.array([x + sgn * (3 + 9 * v) * k, y1 - 2 * k])
                p1 = p0 + np.array([sgn * math.cos(a), -math.sin(a)]) * (5 + 9 * v) * k
                b.line(np.array([p0, p1]), max(1.0, 1.4 * k), 0.8 * (1 - v))
        b.commit(DROP, grain=0.5, soft=0.25)


# =============================================================================================
#  1. THE HOUR
# =============================================================================================
@shot('forest', DUR['forest'])
def sh_forest():
    P = Paper(5, FO.FOREST_TONE)
    plate = cached('forest', lambda: FO.forest_plate(P).C)
    fg = cached_layer(P, 'forest_fg', lambda: FO.forest_fg(P))
    L = Layer(P)
    gy = lambda x: float(FO.ground_y(x))
    PX = FO.PLANT_X; PY = gy(PX)
    B, LX = find_bend(PX, PY, PLANT_H, 44)
    BITE_X = LX + 84
    KNOCK_X = 1012 + OLD_S * 0.5 + YNG_S * 0.70
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    hollow_dim = (0.50 + 0.50 * sstep(455, 590, xx))[..., None]
    PI = math.pi

    def fleck_u(t):
        return K(t, [(F_FLECK_IN[0], 0.0), (F_FLECK_IN[1], 0.40, 'out'), (F_FLECK_OUT[0], 0.60, 'lin'), (F_FLECK_OUT[1], 1.0, 'in')])

    def yx(t):
        return K(t, [(5.2, 505), (6.1, 790, 'out'), (6.35, 800, 'lin'), (7.4, 1090), (8.5, 1090), (9.2, 1046, 'in'), (11.55, 1046), (12.1, 1088, 'out'),
                     (12.2, 1090), (13.5, BITE_X), (F_GO_KNOCK[0], BITE_X), (F_GO_KNOCK[1], KNOCK_X)])

    def ox(t):
        return K(t, [(F_OLD_WALK1[0], 385), (F_OLD_WALK1[1], 792), (F_OLD_WALK2[0], 792), (F_OLD_WALK2[1], 1053), (F_BACK[0], 1053), (F_BACK[1], 1012)])

    bend_at_spring = [0.0]

    def bend_of(t):
        if t < F_SPRING:
            b = B * clamp((ox(t) + OLD_S * 0.5 - 1158) / 38.0)
            bend_at_spring[0] = b
            return b, 0.0
        tau = t - F_SPRING
        b0 = B * clamp((ox(F_SPRING) + OLD_S * 0.5 - 1158) / 38.0)
        return b0 * math.exp(-tau * 3.2) * math.cos(tau * 11.0), 0.9 * math.exp(-tau * 1.7) * math.sin(tau * 13.0)

    def draw(t, d):
        c = Canvas(P, plate.copy())
        # ---------------- light
        u = fleck_u(t)
        cx, cy, rx, ry, st = FO.fleck_geometry(u)
        flick = 1 + 0.10 * math.sin(t * 5.3) * math.sin(t * 1.9) + 0.05 * math.sin(t * 17.0)
        if st > 0.01:
            FO.draw_fleck(c, R('fleck', d // 2), FO.V1, cx, cy, rx, ry, st, flick)
            F = FO.fleck_field(P, FO.V1, cx, cy, rx, ry, st)[..., None]
            light = (F_SHADE[None, None, :] * (1 - F) + F_LIT[None, None, :] * F) * hollow_dim
        else:
            light = F_SHADE[None, None, :] * hollow_dim
        lit = clamp(1.25 - abs(cx - PX + 20) / 150.0) * st
        lit = ease(lit) * flick
        # ---------------- drips from the root over the door
        for td in F_DRIPS:
            drip(c, R('drip', d), t, td, 588, 772, 938)
        # ---------------- the old one
        o_x = ox(t)
        o_walk = walk_of(ox, t, OLD_S)
        o_ext = K(t, [(F_OLD_OUT, 0.0), (8.0, 1.0), (13.9, 1.0), (14.6, 0.28), (15.9, 0.28), (16.4, 0.55), (16.6, 0.55), (17.25, 0.0), (F_HEAD_OUT[0], 0.0), (F_HEAD_OUT[1], 0.6)])
        o_tuck = K(t, [(7.6, 1.0), (8.25, 0.0), (F_TUCK[0], 0.0), (F_TUCK[1], 1.0, 'in')])
        o_look = K(t, [(11.3, 0.0), (11.62, -0.55), (11.9, 0.20), (12.15, 0.0), (F_HEAD_OUT[0], -0.05), (F_HEAD_OUT[1], -0.12)])
        o_blink = 0.4 if 14.3 < t < 16.4 else blink_of(t, 'old')
        o_moving = o_walk > 0.05 or (F_OLD_OUT < t < 8.3) or (F_TUCK[0] < t < F_TUCK[1]) or (F_HEAD_OUT[0] < t < F_HEAD_OUT[1]) or (11.3 < t < 12.2)
        o_seed = d if o_moving else d // 3
        ground_shadow(c, R('osh', o_seed), o_x, gy(o_x) + 4, OLD_S * 0.95, 0.5, col=(0.20, 0.20, 0.30))
        L.clear()
        draw_tortoise(L, R('old', o_seed), o_x, gy(o_x), OLD_S, age=1.0, ext=o_ext, look=o_look, tuck=o_tuck, phase=o_x / (STRIDE * OLD_S), walk=o_walk,
                      blink=o_blink, breath=math.sin(t * 1.3))
        L.onto(c.C, light=light)
        # ---------------- the lantern plant
        bend, swing = bend_of(t)
        taken = (0,) if t >= F_BITE else ()
        p_moving = (13.6 < t < 14.9) or (F_SPRING - 0.2 < t < F_SPRING + 2.2)
        tops = lantern_tops(PX, PY, PLANT_H, bend, 0.0, swing=swing)
        if lit > 0.03:
            for i, (top, w) in enumerate(tops):
                if i in taken:
                    continue
                lantern_glow(c, R('glow', d // 2, i), top[0], top[1] + w * 0.6, w * 2.1, lit * (0.95 if i < 3 else 0.5))
        L.clear()
        lantern_plant(L, R('plant', d if p_moving else d // 3), PX, PY, PLANT_H, bend=bend, lit=lit, taken=taken, swing=swing, dim=lerp(0.34, 1.0, lit))
        L.onto(c.C)
        # ---------------- the young one
        y_x = yx(t)
        y_walk = walk_of(yx, t, YNG_S)
        if t > 4.3:
            y_face = K(t, [(13.05, 1.0), (13.35, -1.0, 'lin')])
            y_ext = K(t, [(4.35, 0.0), (4.8, 1.0)])
            on_back = F_TIP[1] <= t < F_NUDGE[0] + 0.1
            y_rot = K(t, [(7.4, 0.0), (7.75, 0.30), (7.95, 0.18), (8.15, 0.36), (8.5, 0.42), (F_TIP[1], PI, 'in'), (F_NUDGE[0] + 0.1, PI), (F_NUDGE[1], 0.0, 'out')])
            if on_back:
                y_rot += 0.16 * math.exp(-(t - F_TIP[1]) * 1.2) * math.sin((t - F_TIP[1]) * 8.5)
            elif F_NUDGE[1] <= t < F_NUDGE[1] + 0.6:
                y_rot += 0.10 * math.exp(-(t - F_NUDGE[1]) * 6) * math.sin((t - F_NUDGE[1]) * 22)
            y_wave = (t * 1.9) if (F_TIP[1] - 0.2 <= t < F_NUDGE[0] + 0.3) else 0.0
            y_reach = K(t, [(7.4, 0.0), (7.7, 0.9), (8.5, 1.0), (8.9, 0.2), (14.5, 0.0), (15.0, 0.55), (15.5, 0.15), (18.3, 0.1), (18.5, 0.9), (F_HEAD_OUT[0], 0.9), (F_HEAD_OUT[1], 0.6)])
            y_look = K(t, [(4.8, 0.25), (5.2, 0.1), (7.4, 0.1), (7.7, 0.55), (8.5, 0.6), (9.0, 0.0), (12.2, 0.0), (13.6, 0.35), (15.0, 0.30), (15.4, 0.0), (17.4, 0.0), (18.3, 0.15),
                           (18.5, 0.4), (F_HEAD_OUT[0], 0.4), (F_HEAD_OUT[1], 0.2)])
            y_yoff = 10 * (bump(t, F_HOPS[0], 0.24) + bump(t, F_HOPS[1], 0.24)) + 5 * bump(t, 6.1, 0.3)
            paw = K(t, [(18.3, 0.0), (18.5, 1.0), (19.0, 1.0), (19.2, 0.0), (19.4, 0.0), (19.56, 1.0), (21.7, 1.0), (22.5, 0.0)])
            tap = sum(bump(t, tk - 0.07, 0.15) for tk in F_KNOCK1 + F_KNOCK2)
            chew = (0.5 + 0.5 * math.sin(t * 21)) if F_BITE < t < F_BITE + 2.3 else 0.0
            y_moving = y_walk > 0.05 or (7.4 < t < 13.6) or (14.4 < t < F_GO_KNOCK[0]) or (18.2 < t < 20.3) or t < 5.3 or (21.6 < t < 22.6)
            y_seed = d if y_moving else d // 2
            if not (F_TIP[0] < t < F_NUDGE[1]):
                ground_shadow(c, R('ysh', y_seed), y_x, gy(y_x) + 2, YNG_S * 0.95, 0.4, col=(0.20, 0.20, 0.30))
            L.clear()
            info = draw_tortoise(L, R('yng', y_seed), y_x, gy(y_x), YNG_S, age=0.0, face=y_face, ext=y_ext, look=y_look, reach=y_reach, phase=y_x / (STRIDE * YNG_S),
                                 walk=y_walk, rot=y_rot, wave=y_wave, yoff=y_yoff, paw=paw, tap=tap, chew=chew, rest=(y_rot > 0.5),
                                 blink=0.0 if (t < 5.3 or 7.4 < t < 9.2 or 19.5 < t < 22) else blink_of(t, 'yng', 0.4), pivot=(-0.30, 0.0) if y_rot <= 0.5 else None)
            if F_BITE <= t < F_BITE + 2.3:
                held_lantern(L, R('held', d), info['mouth'], PLANT_H * 0.165, (t - F_BITE) / 2.3, face=-1)
            L.onto(c.C, light=light)
        fg.onto(c.C)
        return c.C, dict(zoomf=lambda tt: (1.0 + 0.05 * ease(tt / DUR['forest']), 1010.0, 700.0),
                         expof=lambda tt: 1.12 * ease(tt / 1.6) * (1 - 0.9 * ease((tt - 22.5) / 1.0)))

    yield draw


# =============================================================================================
#  2. THE ROOT-HOUSE AT NIGHT
# =============================================================================================
@shot('night', DUR['night'])
def sh_night():
    P = Paper(6, FO.FOREST_TONE)
    V = View(2.4, 40.0, 520.0)
    plate = cached('forest_close', lambda: FO.forest_plate(P, V, seed=11).C)
    L = Layer(P)
    k = V.k
    gy = lambda x: float(FO.ground_y(x)) + 14
    DX = 478.0
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    base_light = np.array([0.26, 0.36, 0.66], F32)[None, None, :] * (0.55 + 0.75 * sstep(200, 1700, xx))[..., None]

    def fly(i, t):
        ph = i * 2.1
        x = 640 + 70 * i + 60 * math.sin(t * 0.5 + ph) + 26 * math.sin(t * 1.3 + ph * 2)
        y = 800 - 40 * i + 34 * math.sin(t * 0.7 + ph * 1.7) + 12 * math.sin(t * 2.1 + ph)
        on = 0.5 + 0.5 * math.sin(t * 1.9 + ph * 3)
        return x, y, max(0.0, on) ** 1.5

    def draw(t, d):
        c = Canvas(P, plate.copy())
        light = base_light.copy()
        flies = [fly(i, t) for i in range(3)]
        for (fx, fy, on) in flies:
            px, py = V.pt(fx, fy)
            g = np.exp(-(((xx - px) / 300.0) ** 2 + ((yy - py) / 260.0) ** 2))[..., None] * on
            light += g * np.array([0.50, 0.62, 0.22], F32)[None, None, :]
        o_x = K(t, [(N_SHUFFLE[0], 322.0), (N_SHUFFLE[1], 368.0)])
        o_moving = N_SHUFFLE[0] < t < N_SHUFFLE[1] + 0.2
        o_breath = math.sin(t * 1.25) * (1.0 + 1.2 * bump(t, N_KICK + 0.25, 1.6))
        y_x = 512.0 + 5 * bump(t, N_KICK, 0.22) - 3 * bump(t, N_KICK + 0.3, 0.2)
        y_ext = 0.42 * bump(t, N_DRIPS_YOUNG[0] + 0.24, 1.7) ** 0.6
        y_moving = (N_DRIPS_YOUNG[0] + 0.2 < t < N_DRIPS_YOUNG[0] + 2.0) or (N_KICK - 0.1 < t < N_KICK + 0.6)
        L.clear()
        px, py = V.pt(y_x, gy(y_x) - 4 * bump(t, N_DRIPS_YOUNG[0] + 0.26, 0.2))
        draw_tortoise(L, R('ny', d if y_moving else d // 4), px, py, YNG_S * k, age=0.0, face=-1, ext=y_ext, tuck=1.0, breath=math.sin(t * 1.9 + 1),
                      blink=0.0 if y_ext > 0.2 else 1.0, look=0.3, paw=0.0)
        L.onto(c.C, light=light)
        L.clear()
        px, py = V.pt(o_x, gy(o_x) - (3 * abs(math.sin((t - N_SHUFFLE[0]) * 9)) if o_moving else 0))
        info = draw_tortoise(L, R('no', d if o_moving else d // 4), px, py, OLD_S * k, age=1.0, face=1, ext=0.0, tuck=1.0, breath=o_breath)
        L.onto(c.C, light=light)
        # the drips: on the small shell, then, once the big one has moved over, on the big one
        dx, _ = V.pt(DX, 0)
        y_top = V.pt(0, 772)[1]
        yy_y = V.pt(0, gy(512) - YNG_S * 0.70)[1]
        yy_o = V.pt(0, gy(368) - OLD_S * 0.50)[1]
        for td in N_DRIPS_YOUNG:
            drip(c, R('nd', d), t, td, dx, y_top, yy_y, k=2.0)
        for td in N_DRIPS_OLD:
            drip(c, R('nd', d), t, td, dx, y_top, yy_o, k=2.0)
        # fireflies passing the door
        for i, (fx, fy, on) in enumerate(flies):
            if on > 0.05:
                px, py = V.pt(fx, fy)
                lantern_glow(c, R('ff', d // 2, i), px, py, 46 * on + 10, on, col=(0.72, 0.90, 0.35))
                b = Batch(c, *c.roi(px - 6, py - 6, px + 6, py + 6)); b.dot(px, py, 3.2, on); b.commit((0.97, 1.0, 0.70), grain=0.2, soft=0.3)
        return c.C, dict(expof=lambda tt: 1.3 * ease(tt / 1.0) * (1 - ease((tt - DUR['night'] + 0.8) / 0.8)), zoomf=lambda tt: (1.0 + 0.03 * tt / DUR['night'], 900.0, 700.0))

    yield draw


# =============================================================================================
#  3. LEAVING
# =============================================================================================
@shot('edge', DUR['edge'])
def sh_edge():
    P = Paper(7, FO.FOREST_TONE)
    plate = cached('edge', lambda: FO.edge_plate(P).C)
    lightp = cached('lightp', lambda: FO.light_plate(P).C)
    M = cached('edge_M', lambda: stroke_order(P, 3, ang=-0.25, ln=140, wd=34, n=2200, bias=lambda x, y: 1 - x / W))
    L = Layer(P)
    gy = lambda x: float(FO.edge_ground(x))
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    lt = sstep(300, 1700, xx)[..., None]
    light = np.array([0.42, 0.50, 0.60], F32)[None, None, :] * (1 - lt) + np.array([1.05, 1.03, 0.90], F32)[None, None, :] * lt

    def ox(t):
        return 700 + 132 * t

    def yx(t):
        return K(t, [(0.0, 330), (E_TURN[0], 575, 'out'), (E_TURN[1] + 0.2, 575), (DUR['edge'], 1170, 'in')])

    def draw(t, d):
        c = Canvas(P, plate.copy())
        o_x = ox(t)
        ground_shadow(c, R('es', d), o_x - 60, gy(o_x) + 4, OLD_S * 1.3, 0.5, col=(0.2, 0.2, 0.28))
        L.clear()
        draw_tortoise(L, R('eo', d), o_x, gy(o_x), OLD_S * 0.9, age=1.0, ext=1.0, phase=o_x / (STRIDE * OLD_S * 0.9), walk=1.0, blink=blink_of(t, 'eo'))
        y_x = yx(t)
        y_face = K(t, [(E_TURN[0], 1.0), (E_TURN[0] + 0.22, -1.0, 'lin'), (E_TURN[1], -1.0), (E_TURN[1] + 0.2, 1.0, 'lin')])
        y_walk = walk_of(yx, t, YNG_S)
        draw_tortoise(L, R('ey', d if (y_walk > 0.05 or E_TURN[0] - 0.1 < t < E_TURN[1] + 0.3) else d // 2), y_x, gy(y_x) + 12, YNG_S * 0.95, age=0.0, face=y_face, ext=1.0,
                      look=K(t, [(E_TURN[0], 0.1), (E_TURN[0] + 0.4, 0.35), (E_TURN[1], 0.35), (E_TURN[1] + 0.3, 0.1)]),
                      phase=y_x / (STRIDE * YNG_S), walk=y_walk, blink=0.0)
        L.onto(c.C, light=light)
        u = ease_in(clamp((t - E_WHITE[0]) / (E_WHITE[1] - E_WHITE[0])), 1.6)
        out = wipe(c.C, lightp, M, u, soft=0.06)
        return out, dict(expof=lambda tt: 0.6 + 0.5 * ease(tt / 0.7), zoomf=lambda tt: (1.0 + 0.07 * ease(tt / DUR['edge']), 1500.0, 640.0))

    yield draw


# =============================================================================================
#  the slope: shared furniture
# =============================================================================================
OLD_M = 240.0
YNG_M = 90.0
ML = {'after': (1.04, 0.99, 0.88), 'day': (1.0, 1.0, 1.0), 'gold': (1.06, 0.98, 0.84), 'dusk': (0.66, 0.60, 0.80), 'night': (0.46, 0.56, 0.86),
      'autumn': (1.0, 0.97, 0.9), 'winter': (0.92, 0.94, 1.0), 'spring': (1.0, 1.0, 0.98)}


def mplate(name, tree_g=0.04, season=None, **kw):
    pal = ME.PAL[name]
    P = Paper(8, pal['paper'])
    key = f'meadow_{name}_{tree_g:.2f}' + ''.join(f'_{a}{b}' for a, b in sorted(kw.items()))
    return P, pal, cached(key, lambda: ME.meadow_plate(P, pal, tree_g=tree_g, season=season or name, **kw).C)


def others(L, rng, t, pal_light=None):
    """the ones who were already here, down by the water"""
    for i, (x, y, f) in enumerate([(1490, 590, 1), (1640, 612, -1), (1790, 584, -1)]):
        s = OLD_M * ME.depth_scale(y) * (0.75 + 0.15 * (i % 2))
        draw_tortoise(L, R('oth', i, int(t * 2)), x + 6 * math.sin(t * 0.3 + i), y, s, age=0.8, face=f, ext=0.8, look=0.1 * math.sin(t * 0.7 + i * 2))


# =============================================================================================
#  4. THE OPEN SLOPE
# =============================================================================================
@shot('reveal', DUR['reveal'])
def sh_reveal():
    P, pal, plate = mplate('day')
    M = cached('reveal_M', lambda: stroke_order(P, 5, ang=0.03, ln=170, wd=30, n=2600, bias=lambda x, y: y / H))
    L = Layer(P)
    blank = P.base

    def path(sv):
        x = lerp(300, 900, sv); y = lerp(float(ME.gtop(300)) + 10, 820, sv ** 1.15)
        return x, y

    def draw(t, d):
        u = clamp((t - R_DRAWN[0]) / (R_DRAWN[1] - R_DRAWN[0]))
        c = Canvas(P, plate.copy())
        if u > 0.75:
            ME.meadow_live(c, R('ml', d), ME.V1, pal, t)
            for i in range(4):
                bx = 900 + 160 * i + 40 * t + 30 * math.sin(t * 0.6 + i); by = 250 + 40 * i + 18 * math.sin(t * 0.9 + i * 2)
                ME.bird(c, R('b', d, i), bx, by, t, i * 1.7, s=0.9 + 0.15 * i)
            so = K(t, [(1.9, 0.0), (DUR['reveal'], 0.50, 'lin')])
            sy = K(t, [(2.4, 0.0), (DUR['reveal'], 0.95, 'lin')])
            L.clear()
            for (sv, age, base_s, nm, wig) in [(so, 1.0, OLD_M, 'ro', 0.0), (sy, 0.0, YNG_M, 'ry', 1.0)]:
                if (nm == 'ro' and t < 1.9) or (nm == 'ry' and t < 2.4):
                    continue
                x, y = path(sv)
                x += wig * 34 * math.sin(t * 2.6) * sv
                s = base_s * ME.depth_scale(y)
                ph = (sv * 900) / (STRIDE * base_s * 0.5)
                draw_tortoise(L, R(nm, d), x, y - wig * 3 * s / 30 * abs(math.sin(t * 9)), max(9.0, s), age=age, ext=1.0, phase=ph, walk=1.0, look=0.3 * wig)
            L.onto(c.C)
            L.clear()
            ME.fg_grass(L, R('fg', d // 2), ME.V1, pal, wind=t * 2.2)
            L.onto(c.C)
        out = wipe(blank, c.C, M, ease(u) if u < 1 else 1.0, soft=0.06)
        return out, dict(zoomf=lambda tt: (1.07 - 0.07 * ease(tt / DUR['reveal']), 960.0, 430.0))

    yield draw


# =============================================================================================
#  5. PLENTY
# =============================================================================================
GROUND_LANTERNS = [(700, 1.3), (934, -1.2), (1110, 1.4), (1262, -1.35), (1395, 1.2), (520, -1.3)]


@shot('plenty', DUR['plenty'])
def sh_plenty():
    P, pal, plate = mplate('day')
    L = Layer(P)
    ny = lambda x: float(ME.near_y(x))
    flies = [(300 + 95 * i + 30 * math.sin(i * 7.1), [(1, 1, 0.97), (0.99, 0.90, 0.35), (0.75, 0.82, 0.98)][i % 3], i * 1.3) for i in range(7)]

    def yx(t):
        return K(t, [(0.0, 130), (2.55, 880, 'out')])

    def ox(t):
        return 600 + 112 * t

    def draw(t, d):
        c = Canvas(P, plate.copy())
        ME.meadow_live(c, R('ml', d), ME.V1, pal, t + 7)
        y_x = yx(t)
        # the old one, already on its way down to the water
        o_x = ox(t); o_y = 700 - 12 * t
        o_s = OLD_M * ME.depth_scale(o_y)
        L.clear()
        others(L, None, t)
        draw_tortoise(L, R('po', d), o_x, o_y, o_s, age=1.0, ext=1.0, phase=o_x / (STRIDE * o_s), walk=1.0)
        # the tall stalk, and what has fallen from all the others
        lantern_plant(L, R('pp', d // 2), ME.STALK_X, ny(ME.STALK_X) - 8, 330, sway=0.10 * math.sin(t * 2.2), lit=0.3, swing=0.4 * math.sin(t * 2.6))
        eaten = t >= P_BITE
        for i, (gx, ga) in enumerate(GROUND_LANTERNS):
            if i == 1 and eaten:
                continue
            ME.lying_lantern(L, R('gl', i, d // 3), gx, ny(gx) + 6, 30, ang=ga)
        L.onto(c.C)
        # butterflies go up as it comes through
        for (bx, col, ph) in flies:
            rise = clamp((y_x - bx + 40) / 60.0)
            ty = t - (bx - 130) / 300.0
            by = ny(bx) - 26 - rise * (40 + 90 * ease(clamp(ty * 0.5)) + 22 * math.sin(t * 3 + ph))
            ME.butterfly(c, R('bf', d, ph), bx + rise * 40 * math.sin(t * 1.7 + ph), by, t, ph, col, s=1.2)
        y_walk = walk_of(yx, t, YNG_M)
        y_yoff = 7 * abs(math.sin(t * 8.5)) * y_walk
        chew = (0.5 + 0.5 * math.sin(t * 21)) if P_BITE < t < P_BITE + 1.9 else 0.0
        y_look = K(t, [(2.5, 0.1), (2.8, -0.35), (P_BITE + 0.1, -0.3), (P_BITE + 0.5, 0.1), (4.9, 0.1), (5.3, 0.45)])
        ground_shadow(c, R('ps', d), y_x, ny(y_x) + 3, YNG_M, 0.4, col=mul(pal['grass'][0], 0.7))
        L.clear()
        info = draw_tortoise(L, R('py', d if (y_walk > 0.05 or t < P_BITE + 2.2) else d // 2), y_x, ny(y_x), YNG_M, age=0.0, ext=1.0, look=y_look, phase=y_x / (STRIDE * YNG_M),
                             walk=y_walk, yoff=y_yoff, chew=chew, blink=blink_of(t, 'py', 0.3), reach=K(t, [(4.9, 0.0), (5.4, 0.5)]))
        if P_BITE <= t < P_BITE + 1.9:
            held_lantern(L, R('ph', d), info['mouth'], 30, (t - P_BITE) / 1.9, face=1)
        ME.fg_grass(L, R('fg', d // 2), ME.V1, pal, wind=t * 2.2 + 3)
        L.onto(c.C)
        return c.C, dict(zoomf=lambda tt: (1.10, 900.0 + 16 * tt, 1000.0))

    yield draw


# =============================================================================================
#  6. THE HOUR COMES ROUND
# =============================================================================================
@shot('late', DUR['late'])
def sh_late():
    P, pal_g, plate_g = mplate('gold')
    P2, pal_d, plate_d = mplate('dusk')
    M = cached('late_M', lambda: stroke_order(P, 9, ang=0.05, ln=160, wd=30, n=2600, bias=lambda x, y: 1 - y / H))
    L = Layer(P)
    ny = lambda x: float(ME.near_y(x))
    SX = ME.STALK_X; SY = ny(SX) - 8
    HW = OLD_M * 0.5

    def opos(t):
        if t < 5.0:
            u = ease(clamp(t / 5.0)) * 0.9 + 0.1 * t / 5.0
            return lerp(1760, 1300, u), lerp(598, ny(1300) - 8, u ** 1.2)
        x = K(t, [(5.0, 1300), (L_CONTACT, 1145, 'lin'), (L_RELEASE, 885, 'lin'), (DUR['late'], 610, 'lin')])
        return x, ny(x) - 8

    def draw(t, d):
        u = clamp((t - L_DUSK[0]) / (L_DUSK[1] - L_DUSK[0]))
        pal = pal_g if u < 0.5 else pal_d
        base = wipe(plate_g, plate_d, M, ease(u), soft=0.06)
        c = Canvas(P, base.copy() if u in (0.0, 1.0) else base)
        ME.meadow_live(c, R('ml', d), ME.V1, pal, t + 3, wind=0.7, glitter=0.8)
        light = np.array(mix(ML['gold'], ML['dusk'], ease(u)), F32)
        o_x, o_y = opos(t)
        o_s = OLD_M * ME.depth_scale(o_y + 8)
        front = o_x - HW
        if t < L_RELEASE:
            bend = clamp((SX + 18 - front) / 46.0) * 1.0
            swing = 0.0
        else:
            tau = t - L_RELEASE
            bend = 1.0 * math.exp(-tau * 2.6) * math.cos(tau * 9.5)
            swing = 1.0 * math.exp(-tau * 1.5) * math.sin(tau * 12)
        taken = (0, 1) if t >= L_RELEASE else ()
        L.clear()
        others(L, None, t)
        L.onto(c.C, light=light)

        def plant():
            L.clear()
            lantern_plant(L, R('lp', d if 5.5 < t < 8.4 else d // 2), SX, SY, 330, bend=bend, face=-1, sway=0.06 * math.sin(t * 2.0), lit=0.25, taken=taken, swing=swing + 0.3 * math.sin(t * 2.4))
            L.onto(c.C, light=light)

        def old():
            ground_shadow(c, R('ls', d), o_x + 30, o_y + 4, o_s * 1.1, 0.45, col=mul(pal['grass'][0], 0.6))
            L.clear()
            draw_tortoise(L, R('lo', d), o_x, o_y, o_s, age=1.0, face=-1, ext=1.0, phase=o_x / (STRIDE * o_s), walk=1.0, look=-0.05, blink=blink_of(t, 'lo', 0.2))
            L.onto(c.C, light=light)

        if t < L_RELEASE - 0.5 and front < SX + 10:
            plant(); old()
        elif o_y < SY - 20:
            old(); plant()
        else:
            old(); plant()
        if t >= L_RELEASE:
            fall = clamp((t - L_RELEASE) / 0.25)
            L.clear()
            for i, (gx, ga) in enumerate([(SX - 150, 1.3), (SX - 212, -1.25)]):
                bo = 8 * abs(math.sin(clamp((t - L_RELEASE - 0.25) / 0.5) * math.pi * 2)) * (1 - clamp((t - L_RELEASE - 0.25) / 0.5))
                ME.lying_lantern(L, R('ll', i, d // 3), gx, ny(gx) + 20 - (1 - fall) * 30 - bo, 34, ang=ga)
            L.onto(c.C, light=light)
        # the young one, waiting where the stalk is
        y_x = 782.0
        y_face = K(t, [(7.35, 1.0), (7.6, -1.0, 'lin'), (8.05, -1.0), (8.25, 1.0, 'lin')])
        y_look = K(t, [(0.0, 0.55), (0.9, 0.55), (1.4, 0.15), (4.4, 0.15), (5.0, 0.3), (6.2, 0.45), (7.3, 0.3), (8.05, 0.2), (8.4, -0.4)])
        y_reach = K(t, [(0.0, 0.5), (0.9, 0.5), (1.4, 0.0), (5.0, 0.0), (5.4, 0.35), (7.3, 0.2), (8.2, 0.0)])
        y_ext = K(t, [(1.6, 1.0), (2.6, 0.7), (4.6, 0.7), (5.0, 1.0)])
        y_tuck = K(t, [(1.8, 0.0), (2.8, 0.7), (4.6, 0.7), (5.0, 0.0)])
        y_mov = t < 1.5 or (4.5 < t)
        ground_shadow(c, R('lys', d // 2), y_x, ny(y_x) + 20, YNG_M, 0.4, col=mul(pal['grass'][0], 0.6))
        L.clear()
        draw_tortoise(L, R('ly', d if y_mov else d // 3), y_x, ny(y_x) + 18, YNG_M, age=0.0, face=y_face, ext=y_ext, tuck=y_tuck, look=y_look, reach=y_reach,
                      blink=blink_of(t, 'ly', 0.35), yoff=5 * bump(t, 5.0, 0.25))
        L.onto(c.C, light=light)
        L.clear()
        ME.fg_grass(L, R('fg', d // 2), ME.V1, pal, wind=t * 1.6)
        L.onto(c.C)
        return c.C, dict(zoomf=lambda tt: (1.10 + 0.03 * ease(tt / DUR['late']), 900.0, 1000.0))

    yield draw


# =============================================================================================
#  7. FIRST NIGHT OUT
# =============================================================================================
@shot('stars', DUR['stars'])
def sh_stars():
    P, pal, plate = mplate('night')
    L = Layer(P)
    ny = lambda x: float(ME.near_y(x))
    light = np.array(ML['night'], F32)
    OX = 470.0
    stars = [(R('st', i).uniform(40, 1880), R('sty', i).uniform(20, 380)) for i in range(40)]

    def draw(t, d):
        c = Canvas(P, plate.copy())
        b = Batch(c)
        r = R('tw', d // 3)
        for i in r.choice(40, 9, replace=False):
            sx, sy = stars[i]
            b.dot(sx, sy, r.uniform(1.6, 2.8), 1.0)
            b.line(np.array([(sx - 5, sy), (sx + 5, sy)]), 1, 0.6); b.line(np.array([(sx, sy - 5), (sx, sy + 5)]), 1, 0.6)
        b.commit((1.0, 0.98, 0.92), grain=0.2, soft=0.3)
        ME.meadow_live(c, R('ml', d), ME.V1, pal, t * 0.5 + 3, wind=0.35, glitter=0.5)
        L.clear()
        lantern_plant(L, R('sp', d // 3), ME.STALK_X, ny(ME.STALK_X) - 8, 330, face=-1, sway=0.05 * math.sin(t * 1.4), taken=(0, 1), swing=0.2 * math.sin(t * 1.8), dim=0.42)
        ME.lying_lantern(L, R('sl', d // 4), ME.STALK_X - 212, ny(ME.STALK_X - 212) + 20, 34, ang=-1.25, dim=0.55, lit=0)
        L.onto(c.C)
        L.clear()
        draw_tortoise(L, R('so', d // 4), OX, ny(OX) - 8, OLD_M, age=1.0, face=-1, ext=0.0, tuck=1.0, breath=math.sin(t * 1.25))
        y_look = K(t, [(0.0, 0.2), (0.7, 0.8), (2.2, 0.8), (2.7, 0.2)])
        y_reach = K(t, [(0.3, 0.0), (0.9, 0.6), (2.2, 0.6), (2.7, 0.0)])
        y_face = K(t, [(2.75, 1.0), (3.0, -1.0, 'lin')])
        draw_tortoise(L, R('sy', d if (t < 1.0 or t > 2.1) else d // 3), 782, ny(782) + 16, YNG_M, age=0.0, face=y_face, ext=1.0, look=y_look, reach=y_reach, blink=0.0)
        L.onto(c.C, light=light)
        L.clear()
        ME.fg_grass(L, R('fg', d // 3), ME.V1, pal, wind=t * 1.0)
        L.onto(c.C)
        return c.C, dict(zoomf=lambda tt: (1.12 - 0.12 * ease(tt / DUR['stars']), 700.0, 980.0), expof=lambda tt: 1.12 * ease(tt / 0.7 + 0.2))

    yield draw


@shot('unknock', DUR['unknock'])
def sh_unknock():
    pal = ME.PAL['night']
    P = Paper(8, pal['paper'])
    V = View(2.3, 225.0, 566.0)
    k = V.k
    plate = cached('meadow_night_close', lambda: ME.meadow_plate(P, pal, view=V, tree_g=0.04).C)
    L = Layer(P)
    ny = lambda x: float(ME.near_y(x))
    light = np.array(ML['night'], F32) * 1.12
    OX = 470.0
    TGT = OX + OLD_M * 0.5 + YNG_M * 0.72

    def yx(t):
        return K(t, [(U_WALK[0], 780), (U_WALK[1], TGT)])

    def draw(t, d):
        c = Canvas(P, plate.copy())
        L.clear()
        px, py = V.pt(OX, ny(OX) - 8)
        ground_shadow(c, R('us', d // 4), px, py + 6, OLD_M * k, 0.5, col=(0.3, 0.35, 0.5))
        draw_tortoise(L, R('uo', d // 4), px, py, OLD_M * k, age=1.0, face=-1, ext=0.0, tuck=1.0, breath=math.sin(t * 1.25))
        L.onto(c.C, light=light)
        y_x = yx(t)
        y_walk = walk_of(yx, t, YNG_M)
        paw = K(t, [(U_PAW[0], 0.0), (U_PAW[1], 1.0), (U_PAW[2], 1.0), (U_PAW[3], 0.0)])
        trem = 0.06 * math.sin(t * 29) if U_PAW[1] < t < U_PAW[2] else 0.0
        y_look = K(t, [(0.0, 0.15), (U_PAW[0], 0.15), (U_PAW[1], 0.38), (U_PAW[2], 0.38), (U_PAW[3], -0.15)])
        y_reach = K(t, [(U_PAW[0], 0.0), (U_PAW[1], 0.9), (U_PAW[2], 0.9), (U_PAW[3], 0.0)])
        y_tuck = K(t, [(U_PAW[3], 0.0), (U_PAW[3] + 0.6, 1.0)])
        y_ext = K(t, [(U_PAW[3] + 0.05, 1.0), (U_PAW[3] + 0.65, 0.5)])
        mov = y_walk > 0.05 or (U_PAW[0] - 0.1 < t < U_PAW[3] + 0.7)
        px, py = V.pt(y_x, ny(y_x) + 6)
        ground_shadow(c, R('uys', d // 2), px, py + 4, YNG_M * k, 0.4, col=(0.3, 0.35, 0.5))
        L.clear()
        draw_tortoise(L, R('uy', d if mov else d // 3), px, py, YNG_M * k, age=0.0, face=-1, ext=y_ext, look=y_look, reach=y_reach, tuck=y_tuck,
                      phase=y_x / (STRIDE * YNG_M), walk=y_walk, paw=paw, tap=trem, blink=(1.0 if t > U_PAW[3] + 0.5 else 0.0))
        L.onto(c.C, light=light * 1.1)
        L.clear()
        ME.fg_grass(L, R('fg', d // 3), V, pal, wind=t * 1.0, y_base=1062.0, dens=0.7)
        L.onto(c.C)
        return c.C, dict(zoomf=lambda tt: (1.0 + 0.05 * ease(tt / DUR['unknock']), 900.0, 640.0),
                         expof=lambda tt: 1.15 * (1 - 0.75 * ease((tt - DUR['unknock'] + 0.6) / 0.6)))

    yield draw


# =============================================================================================
#  8. YEARS
# =============================================================================================
SEASONS = ['day', 'autumn', 'winter', 'spring']
HOME = (1210.0, 800.0)
SAPLINGS = [(700.0, 640.0, 4.0), (1060.0, 600.0, 8.0), (250.0, 610.0, 6.0), (1750.0, 705.0, 11.0)]
FIN_EXTRA = [(x, y, 0.6 * clamp((YEARS - st) / 14.0)) for (x, y, st) in SAPLINGS]
N_YEARS_D = int(DUR['years'] * 12)


def year_of(t):
    return YEARS * clamp(t / (DUR['years'] - 1.0)) ** 2.0


def years_state(d):
    """where each of them is in drawing d of the years"""
    t = d / 12.0
    Y = year_of(t)
    si = int(Y * 4) % 4
    fr = (Y * 4) % 1.0
    r = R('yr', d)
    st = {'Y': Y, 'si': si, 'fr': fr}
    ys = lerp(YNG_M, 225.0, clamp(Y / 13.0) ** 0.8)
    st['ys'] = ys; st['yage'] = 0.75 * clamp(Y / 15.0)
    if Y >= YEARS - 0.01:
        st['old'] = (760.0, 800.0, 1, 1.0, 0.0); st['yng'] = (1380.0, float(ME.near_y(1380)), -1, 0.0, 1.0)
        return st
    if si == 2:
        st['old'] = (HOME[0], HOME[1], 1, 0.0, 1.0)
        if Y < 1:
            p = (HOME[0] + 150, HOME[1] + 16)
        elif Y < 2:
            p = (HOME[0] + 290, HOME[1] + 30)
        elif Y < 3:
            p = (640.0, 850.0)
        else:
            p = (430.0, 862.0)
        st['yng'] = (p[0], p[1], -1 if Y < 2 else 1, 0.0, 1.0)
    else:
        st['old'] = (HOME[0] + r.normal(0, 75), HOME[1] + r.normal(0, 26), 1 if r.random() < 0.6 else -1, 1.0, 0.0)
        if si == 3 and fr > 0.72 and Y < 12:
            st['yng'] = (st['old'][0] + 150 + ys * 0.3, st['old'][1] + 12, -1, 1.0, 0.0)
        else:
            Rr = 170 + 1700 * clamp(Y / 7.0)
            x = HOME[0] - 150 + r.uniform(-Rr, Rr * 0.7)
            st['yng'] = (x, r.uniform(730, 890), 1 if r.random() < 0.5 else -1, 1.0, 0.0)
    return st


_pm = {'d': -1, 'm': None}


def path_mask(d):
    """the lines their habits wear into the slope, up to drawing d"""
    if _pm['m'] is None or d < _pm['d']:
        _pm['m'] = np.zeros((H, W), F32); _pm['d'] = -1; _pm['po'] = None; _pm['py'] = None
    for dd in range(_pm['d'] + 1, d + 1):
        st = years_state(dd)
        for key, memo, wd in (('old', 'po', 7), ('yng', 'py', 5)):
            p = st[key]
            q = _pm.get(memo)
            if q is not None and st['si'] != 2:
                r = R('pth', dd, key)
                mid = ((p[0] + q[0]) / 2 + r.normal(0, 30), (p[1] + q[1]) / 2 + r.normal(0, 10))
                pts = catmull(np.array([q[:2], mid, p[:2]], np.float64), 12)
                tmp = np.zeros((H, W), np.uint8)
                cv2.polylines(tmp, [_fix_i(pts)], False, 255, int(max(2, wd * ME.depth_scale((p[1] + q[1]) / 2))), cv2.LINE_AA)
                _pm['m'] += tmp.astype(F32) * (0.30 / 255.0)
            _pm[memo] = p
        _pm['d'] = dd
    return np.clip(_pm['m'], 0, 1)


def _fix_i(P):
    return np.round(np.asarray(P)).astype(np.int32).reshape(-1, 1, 2)


def final_paths():
    return cached('paths_final', lambda: path_mask(N_YEARS_D - 1))


def fin_plate(view=None, tag='wide'):
    pal = ME.PAL['after']
    P = Paper(8, pal['paper'])
    view = view or ME.V1

    def wear(c, rng, v):
        m = final_paths()
        Mx = np.array([[v.k, 0, -v.ox * v.k], [0, v.k, -v.oy * v.k]], np.float64)
        mm = cv2.warpAffine(m, Mx, (W, H), flags=cv2.INTER_LINEAR)
        mm = cv2.GaussianBlur(mm, (0, 0), 1.5 * v.k)
        c.deposit(mm * 0.85, mix(pal['grass'][3], STRAW, 0.5), grain=0.8, soft=0.2, streak=(0, 0.3))

    plate = cached(f'fin_{tag}', lambda: ME.meadow_plate(P, pal, view=view, tree_g=1.0, season='after', wear=wear, cseed=909, extra=FIN_EXTRA).C)
    return P, pal, plate


def snowcap(L, rng, x, y, s):
    b = Batch(L, *L.roi(x - s * 0.5, y - s * 0.85, x + s * 0.5, y - s * 0.3))
    for i in range(int(max(4, s / 9))):
        u = rng.uniform(0.2, 0.8)
        hx = x + (u - 0.5) * s * 0.9; hy = y - s * (0.085 + 0.52 * math.sin(math.pi * u) ** 0.7 + 0.12)
        b.line(np.array([(hx - s * 0.07, hy + rng.normal(0, 1)), (hx + s * 0.07, hy + rng.normal(0, 1))]), max(2.0, s * 0.045), rng.uniform(0.6, 1.0))
    b.commit((1.0, 1.0, 1.0), grain=0.6, soft=0.2)


@shot('years', DUR['years'])
def sh_years():
    plates = {}
    for nm in SEASONS:
        P, pal, pl = mplate(nm, tree_g=0.0)
        plates[nm] = (P, pal, pl)
    Pf, palf, platef = fin_plate()
    P = plates['day'][0]
    Ms = [cached(f'years_M{i}', lambda i=i: stroke_order(P, 20 + i, ang=0.05 + 0.2 * i, ln=150, wd=30, n=2400)) for i in range(4)]
    L = Layer(P)

    def draw(t, d):
        st = years_state(d)
        Y, si, fr = st['Y'], st['si'], st['fr']
        final = Y >= YEARS - 0.01
        nm = SEASONS[si]
        Pp, pal, pl = plates[nm]
        dY = year_of(t + 1 / 12.0) - Y                     # years per drawing
        slow = dY * 4 < 0.30                               # a season lasts more than ~3 drawings
        if final:
            tf = (t - (DUR['years'] - 1.0))
            base = wipe(pl, platef, Ms[0], ease(clamp(tf / 0.5 + 0.3)), soft=0.08) if tf < 0.4 else platef
            pal = palf; nm = 'after'
            c = Canvas(P, base.copy())
        else:
            if slow and fr > 0.6:
                nxt = plates[SEASONS[(si + 1) % 4]][2]
                base = wipe(pl, nxt, Ms[si], ease((fr - 0.6) / 0.4), soft=0.07)
                c = Canvas(P, base)
            else:
                c = Canvas(P, pl.copy())
            # paths, trees: these belong to the years, not to the season
            m = path_mask(d)
            c.deposit(cv2.GaussianBlur(m, (0, 0), 1.5) * 0.85, mix(pal['grass'][3], STRAW, 0.5) if nm != 'winter' else pal['grass'][0], grain=0.8, soft=0.2)
            r = R('yt', d)
            for (sx, sy, s0) in SAPLINGS:
                ME.draw_tree(c, r, ME.V1, sx, sy, 0.6 * clamp((Y - s0) / 14.0), pal, nm)
            ME.draw_tree(c, r, ME.V1, ME.TREE_X, ME.TREE_Y, clamp(0.03 + 0.97 * (Y / YEARS) ** 0.85), pal, nm)
        light = np.array(ML[nm], F32)
        L.clear()
        ox_, oy_, of, oe, otk = st['old']
        os_ = OLD_M * ME.depth_scale(oy_)
        draw_tortoise(L, R('yo', d), ox_, oy_, os_, age=1.0 + 0.3 * clamp(Y / YEARS), face=of, ext=oe, tuck=otk, phase=R('yop', d).random(), walk=1.0 - otk)
        if nm == 'winter':
            snowcap(L, R('sc', d), ox_, oy_, os_)
        yx_, yy_, yf, ye, ytk = st['yng']
        if -150 < yx_ < 2070:
            ys_ = st['ys'] * ME.depth_scale(yy_)
            draw_tortoise(L, R('yy', d), yx_, yy_, ys_, age=st['yage'], face=yf, ext=ye, tuck=ytk, phase=R('yyp', d).random(), walk=1.0 - ytk)
            if nm == 'winter':
                snowcap(L, R('sc2', d), yx_, yy_, ys_)
        L.onto(c.C, light=light)
        if not final or True:
            L.clear()
            ME.fg_grass(L, R('fg', d), ME.V1, pal, wind=t * 9.0)
            L.onto(c.C)
        return c.C, dict(flick=0.02 if not final else 0.008)

    yield draw


# =============================================================================================
#  9. WHAT THE LEAF-LITTER KEPT
# =============================================================================================
@shot('husk', DUR['husk'])
def sh_husk():
    pal = ME.PAL['after']
    P = Paper(12, pal['paper'])
    plate = cached('litter', lambda: ME.litter_plate(P, pal).C)
    L = Layer(P)
    HX, HY, HW = 1100.0, 560.0, 330.0
    leaves = [(1050, 660, 190, 0.4, (0.50, 0.39, 0.20)), (1190, 600, 170, 2.2, (0.36, 0.24, 0.16)), (1120, 750, 180, 5.6, (0.40, 0.22, 0.25)), (1010, 560, 150, 1.3, (0.60, 0.52, 0.29)), (1250, 720, 150, 3.9, (0.30, 0.26, 0.20))]
    shade = np.array([0.74, 0.80, 0.72], F32)

    def ox(t):
        return K(t, [(0.0, -330), (1.5, -95), (H_NUDGE[0] + 0.45, 30, 'out'), (H_NUDGE[1] + 0.3, -60), (4.3, -60), (DUR['husk'], 10)])

    def draw(t, d):
        c = Canvas(P, plate.copy())
        glow = ease(clamp((t - H_GLOW[0]) / (H_GLOW[1] - H_GLOW[0])))
        if glow > 0:
            # a coin of sun finds it
            bs = [Batch(c), Batch(c)]
            r = R('hg', d // 2)
            cx_ = HX + 60 - (1 - glow) * 260; cy_ = HY + 70
            for i in range(int(190 * glow)):
                a = r.uniform(0, 6.283); dd = 150 * r.random() ** 0.7
                x = cx_ + math.cos(a) * dd * 1.5; y = cy_ + math.sin(a) * dd * 0.62
                blade(bs[0 if dd > 80 else 1], r, x, y, r.uniform(30, 90), r.normal(0.25, 0.4), r.uniform(4, 8), r.uniform(0.3, 0.9))
            bs[0].commit(pal['grass'][3], grain=0.9, soft=0.17)
            bs[1].commit(pal['grass'][4], grain=0.9, soft=0.17)
        L.clear()
        hr = R('hk', d // 4)
        husk_skeleton(L, hr, HX - 70, HY + 20, HW, ang=-1.12, lit=glow, veil=0.5 + 0.5 * glow)
        if glow > 0.05:
            lantern_glow(c, R('hgl', d // 2), HX + 80, HY + 100, 190, glow * 0.8)
        L.onto(c.C, light=shade + (1.0 - shade) * glow)
        # the leaves that were over it
        nud = ease(clamp((t - H_NUDGE[0]) / (H_NUDGE[1] - H_NUDGE[0])))
        for i, (lx, ly, ln, la, col) in enumerate(leaves):
            dx = nud * (230 + 60 * i) * (1 if i % 2 == 0 else 0.8); dy = nud * (-150 + 90 * i)
            ME.fallen_leaf(c, R('hl', i, d // 3 if nud in (0.0, 1.0) else d), lx + dx, ly + dy, ln, la + nud * (0.8 + 0.3 * i), col, light=0.8)
        # the old one's head
        o_x = ox(t)
        look = K(t, [(0.0, -0.2), (1.4, -0.75), (H_NUDGE[1], -0.7), (3.0, -0.55), (4.4, -0.55), (DUR['husk'], -0.8)])
        L.clear()
        draw_tortoise(L, R('ho', d if (t < H_NUDGE[1] + 0.4 or t > 4.3) else d // 3), o_x, 800.0, 1150.0, age=1.3, ext=1.0, look=look, reach=-0.38,
                      blink=1.0 if 3.75 < t < 4.0 else 0.0, phase=0.1, walk=0.0)
        L.onto(c.C, light=shade * 1.05)
        return c.C, dict(zoomf=lambda tt: (1.0 + 0.06 * ease(tt / DUR['husk']), 1090.0, 640.0))

    yield draw


# =============================================================================================
#  10. THE OLD ONE BRINGS IT
# =============================================================================================
def mouth_husk(L, rng, mouth, w, face=1, lit=0.6):
    husk_skeleton(L, rng, mouth[0] + face * w * 0.15, mouth[1] + w * 0.05, w, ang=face * 0.25, lit=lit, veil=0.5)


@shot('carry', DUR['carry'])
def sh_carry():
    P, pal, plate = fin_plate()
    L = Layer(P)
    light = np.array(ML['after'], F32)
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    GX = 1380.0

    def draw(t, d):
        c = Canvas(P, plate.copy())
        ME.meadow_live(c, R('ml', d), ME.V1, pal, t + 11, wind=0.8)
        for i in range(3):
            ME.bird(c, R('b', d, i), 500 + 200 * i + 50 * t, 210 + 50 * i + 14 * math.sin(t + i), t, i * 2.0)
        o_x = 760 + 44 * t; o_y = 800 + 8 * t
        o_s = OLD_M * ME.depth_scale(o_y)
        L.clear()
        ground_shadow(c, R('cs', d), o_x, o_y + 3, o_s, 0.45, col=mul(pal['grass'][0], 0.7))
        info = draw_tortoise(L, R('co', d), o_x, o_y, o_s, age=1.3, ext=1.0, phase=o_x / (STRIDE * o_s), walk=1.0, look=0.05, blink=blink_of(t, 'co', 0.2))
        mouth_husk(L, R('ch', d // 2), info['mouth'], 30 * ME.depth_scale(o_y) / 0.8)
        gy_ = float(ME.near_y(GX))
        ground_shadow(c, R('cs2', d // 4), GX, gy_ + 4, 225, 0.45, col=mul(pal['grass'][0], 0.7))
        draw_tortoise(L, R('cg', d // 4), GX, gy_, 225.0, age=0.75, face=-1, ext=0.0, tuck=1.0, breath=math.sin(t * 1.3))
        L.onto(c.C, light=light)
        L.clear()
        ME.fg_grass(L, R('fg', d // 2), ME.V1, pal, wind=t * 2.0 + 1)
        L.onto(c.C)
        # the shadow of a cloud crossing
        cxs = -300 + 620 * t
        sh = 1 - 0.20 * np.exp(-((xx - cxs - (yy - 500) * 0.8) / 420.0) ** 2) * (yy > ME.HORIZON)
        return c.C * sh[..., None], dict(zoomf=lambda tt: (1.02 + 0.05 * ease(tt / DUR['carry']), 1200.0, 800.0))

    yield draw


# =============================================================================================
#  11-13. TOK, TOK / THE DARK SHEET / THE FOOT, RAISED
# =============================================================================================
VC = View(1.9, 735.0, 498.0)
GX_C = 1380.0
OX_C = 925.0           # where the old one waits
OX_K = 1108.0          # where it stands to knock
HUSK_X = 1150.0


def two_shot_setup():
    P, pal, plate = fin_plate(VC, 'close')
    return P, pal, plate, Layer(P), np.array(ML['after'], F32)


def draw_two(c, L, pal, light, t, d, old, grown, husk, wind_t):
    """old/grown: dicts of pose args. husk: None | ('ground', state) | ('mouth',)"""
    k = VC.k
    ny = lambda x: float(ME.near_y(x))
    gx, gy_ = VC.pt(GX_C, ny(GX_C))
    gs = 225.0 * k
    ground_shadow(c, R('ts2', grown.get('seed', d)), gx, gy_ + 5, gs, 0.5, col=mul(pal['grass'][0], 0.65))
    ox_ = old.pop('x'); px, py = VC.pt(ox_, ny(ox_) - 4)
    os_ = OLD_M * k
    ground_shadow(c, R('ts1', old.get('seed', d)), px, py + 5, os_, 0.5, col=mul(pal['grass'][0], 0.65))
    L.clear()
    gseed = grown.pop('seed', d)
    ginfo = draw_tortoise(L, R('tg', gseed), gx, gy_, gs, age=0.75, face=-1, **grown)
    L.onto(c.C, light=light)
    L.clear()
    oseed = old.pop('seed', d)
    oinfo = draw_tortoise(L, R('to', oseed), px, py, os_, age=1.3, face=1, phase=ox_ / (STRIDE * OLD_M), **old)
    if husk is not None and husk[0] == 'mouth':
        mouth_husk(L, R('th', d // 2), oinfo['mouth'], 62)
    L.onto(c.C, light=light)
    if husk is not None and husk[0] == 'ground':
        hx, hy = VC.pt(HUSK_X, ny(HUSK_X) + 22)
        state = husk[1]
        L.clear()
        if state < 1:
            husk_skeleton(L, R('th2', d // 4), hx - 24, hy - 54, 66, ang=-1.05, lit=0.7, veil=0.5, berry=True)
        else:
            # crushed: a few bent ribs
            r = R('crush', 1)
            for i in range(6):
                a = r.uniform(-0.5, 0.5); ln = r.uniform(12, 28)
                oline(L, [(hx - 14 + i * 6, hy - 4), (hx - 14 + i * 6 + math.cos(a) * ln, hy - 6 - abs(math.sin(a + 0.6)) * 9)], STRAW, 1.6, R('cr', i, d // 4), wob=0.5, v=0.85)
        L.onto(c.C, light=light)
    L.clear()
    ME.fg_grass(L, R('fg', d // 2), VC, pal, wind=wind_t, y_base=1098.0, dens=0.6)
    L.onto(c.C)
    return oinfo, ginfo


@shot('knock', DUR['knock'])
def sh_knock():
    P, pal, plate, L, light = two_shot_setup()

    def ox(t):
        return K(t, [(0.0, 690), (2.5, OX_C, 'out'), (3.45, OX_C), (4.3, OX_K), (K_TAPS[1] + 0.9, OX_K), (K_TAPS[1] + 2.0, OX_C)])

    def draw(t, d):
        c = Canvas(P, plate.copy())
        ME.meadow_live(c, R('ml', d), VC, pal, t + 5, wind=0.5, glitter=0.6)
        o_walk = walk_of(ox, t, OLD_M)
        setting = K(t, [(2.4, 0.0), (K_SET, 1.0), (K_SET + 0.25, 1.0), (3.6, 0.0)])
        paw = K(t, [(4.25, 0.0), (4.55, 1.0), (K_TAPS[1] + 0.3, 1.0), (K_TAPS[1] + 0.8, 0.0)])
        tap = sum(bump(t, tk - 0.09, 0.2) for tk in K_TAPS)
        old = dict(x=ox(t), ext=K(t, [(3.6, 1.0), (4.2, 0.55), (K_TAPS[1] + 0.8, 0.55), (K_TAPS[1] + 1.6, 1.0)]), walk=o_walk,
                   look=-0.75 * setting + K(t, [(3.6, 0.0), (4.3, -0.15), (K_TAPS[1] + 0.8, -0.15), (K_TAPS[1] + 1.6, 0.12)]),
                   reach=-0.42 * setting + K(t, [(K_TAPS[1] + 0.8, 0.0), (K_TAPS[1] + 1.6, 0.25)]), paw=paw, tap=tap,
                   blink=blink_of(t, 'ko', 0.25), seed=d if (t < K_TAPS[1] + 1.7) else d // 3)
        wake = ease(clamp((t - K_WAKE[0]) / (K_WAKE[1] - K_WAKE[0])))
        g_look = K(t, [(K_WAKE[1], 0.25), (K_WAKE[1] + 0.2, 0.25), (DUR['knock'], -0.5)])
        g_blink = 1.0 if t < K_WAKE[0] + 0.5 else (0.4 if t < K_WAKE[0] + 0.9 else (1.0 if K_WAKE[1] - 0.25 < t < K_WAKE[1] - 0.05 else 0.0))
        grown = dict(ext=0.86 * wake, tuck=1.0 - 0.55 * wake, look=g_look, blink=g_blink, breath=math.sin(t * 1.3),
                     seed=d if (K_WAKE[0] - 0.1 < t) else d // 4, yoff=2.5 * (bump(t, K_TAPS[0], 0.12) + bump(t, K_TAPS[1], 0.12)))
        husk = ('mouth',) if t < K_SET else ('ground', 0)
        draw_two(c, L, pal, light, t, d, old, grown, husk, t * 1.6)
        return c.C, dict(zoomf=lambda tt: (1.0 + 0.04 * ease(tt / DUR['knock']), 1000.0, 620.0))

    yield draw


@shot('flash', DUR['flash'])
def sh_flash():
    fdraw = next(sh_forest())
    P = Paper(5, FO.FOREST_TONE)
    M = cached('flash_M', lambda: stroke_order(P, 41, ang=1.0, ln=120, wd=34, n=2600, bias=lambda x, y: clamp(math.hypot(x - 1250, y - 760) / 1300.0)))

    def draw(t, d):
        tf = 14.55 + 0.42 * t
        C, _ = fdraw(tf, int(tf * 12) + (d % 2) * 1000)
        u = K(t, [(0.0, 0.0), (0.45, 0.80, 'out'), (1.5, 0.86, 'lin'), (DUR['flash'], 0.0, 'in')])
        out = wipe(P.base, C, M, u, soft=0.08)
        return out, dict(zoomf=lambda tt: (1.22 + 0.06 * tt / DUR['flash'], 1240.0, 790.0), expof=lambda tt: 1.15)

    yield draw


@shot('end', DUR['end'])
def sh_end():
    P, pal, plate, L, light = two_shot_setup()

    def draw(t, d):
        c = Canvas(P, plate.copy())
        ME.meadow_live(c, R('ml', d), VC, pal, t + 15, wind=0.5 + 0.9 * bump(t, 5.6, 2.2), glitter=0.6)
        doze = ease(clamp((t - X_DOZE[0]) / (X_DOZE[1] - X_DOZE[0])))
        old = dict(x=OX_C, ext=1.0 - 0.72 * doze, tuck=doze, look=K(t, [(0.0, 0.12), (2.6, 0.12), (3.2, 0.2), (X_DOZE[0], 0.2), (X_DOZE[1], -0.1)]),
                   reach=K(t, [(0.0, 0.25), (X_DOZE[0], 0.25), (X_DOZE[1], 0.0)]),
                   blink=(1.0 if (doze > 0.45 or 3.55 < t < 3.85) else (0.4 if doze > 0.15 else blink_of(t, 'xo', 0.2))), breath=math.sin(t * 1.2),
                   seed=d if (X_DOZE[0] - 0.1 < t < X_DOZE[1] + 0.2) else d // 3)
        eat = X_BITE <= t
        chew = (0.5 + 0.5 * math.sin(t * 17)) if X_BITE < t < X_BITE + 1.7 else 0.0
        paw = K(t, [(X_PAW[0], 0.0), (X_PAW[1], 1.0)])
        trem = 0.05 * math.sin(t * 27) if t > X_PAW[1] else 0.0
        g_look = K(t, [(0.0, -0.5), (0.5, -0.5), (X_BITE - 0.1, -0.85), (X_BITE + 0.3, -0.6), (2.7, -0.3), (3.3, 0.22), (X_PAW[0], 0.22), (X_PAW[1], 0.3)])
        g_reach = K(t, [(0.5, 0.0), (X_BITE - 0.1, -0.35), (X_BITE + 0.4, -0.2), (3.2, 0.1), (X_PAW[0], 0.1), (X_PAW[1], 0.55)])
        grown = dict(ext=K(t, [(0.0, 0.86), (X_BITE - 0.1, 1.0)]), tuck=K(t, [(0.0, 0.45), (0.8, 0.25), (5.0, 0.25)]), look=g_look, reach=g_reach, chew=chew, paw=paw, tap=trem,
                     blink=0.0 if (X_BITE - 0.6 < t < X_BITE + 0.3 or t > X_DOZE[0]) else blink_of(t, 'xg', 0.3),
                     seed=d if (t < 3.6 or X_PAW[0] - 0.1 < t) else d // 3)
        oinfo, ginfo = draw_two(c, L, pal, light, t, d, old, grown, ('ground', 1 if eat else 0), t * 1.6 + 2)
        return c.C, dict(zoomf=lambda tt: (1.04 + 0.06 * ease(tt / DUR['end']), 1000.0, 640.0))

    yield draw


@shot('tail', DUR['tail'])
def sh_tail():
    Z = np.zeros((H, W, 3), F32)

    def draw(t, d):
        return Z, dict(grain=0.0, flick=0.0, weave=0.0)

    yield draw
