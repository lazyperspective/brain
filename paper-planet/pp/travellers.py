"""Things that are always alive regardless of fold state: clouds, ships, whales, the moon and the paper plane."""
import math
import numpy as np
from .core import ll_frame, DUR, smooth, smoother, LON0
from .mech import stand_for, wing_pair, _basis
from .render import place

TAU = 2 * math.pi


def clouds(sc):
    S = sc.S
    rings = [  # (count, lat, altitude, drift direction, base lon, sizes)
        (3, 24.0, 0.20, +1, -25.0, [0.34, 0.28, 0.38]),
        (3, -31.0, 0.18, -1, 75.0, [0.31, 0.38, 0.27]),
        (2, 54.0, 0.16, +1, -160.0, [0.28, 0.33]),
    ]

    def emit(ctx):
        u = ctx.t / DUR
        for (n, lat0, alt, dirn, base, sizes) in rings:
            step = 360.0 / n
            for i in range(n):
                lon = base + i * step + dirn * step * u
                j = (i + dirn) % n
                size = sizes[i] * (1 - u) + sizes[j] * u
                lr = math.radians(lon)
                lat = lat0 + 3.0 * math.sin(2.0 * lr + TAU * u)
                p, e, nn = ll_frame(lat, lon)
                spr = S['cloud'] if (i % 2 == 0) else S['cloud']
                w = size
                h = w * spr.aspect
                c = p * (1.0 + alt + 0.006 * math.sin(TAU * 2 * u + 3.0 * lr))
                # two sheets hinged along the cloud's long axis like a shallow roof: reads from above and from the limb
                ang = math.radians(24.0 + 4.0 * math.sin(TAU * 3 * u + 2.0 * lr))
                for sgn in (1.0, -1.0):
                    Yv = math.cos(ang) * nn * sgn - math.sin(ang) * p
                    if sgn > 0:
                        ctx.emit(c - e * (w / 2), e, Yv, w, h * 0.5, [(spr, place(spr, 0, -h * 0.5, w), 1.0)], ao=False, both=True, clip=True)
                    else:
                        ctx.emit(c - e * (w / 2), e, Yv, w, h * 0.5, [(spr, place(spr, 0, 0, w, sy=-1.0), 1.0)], ao=False, both=True, clip=True)
    sc.extras.append(emit)


def ships(sc):
    S = sc.S
    fleet = [  # (sprite, width, lat, lon, half extent lat, half extent lon, direction, phase)
        ('tallship', 0.22, 36.0, -44.0, 3.5, 13.0, 1, 0.0),
        ('liner', 0.28, -10.0, -24.0, 3.0, 9.0, -1, 0.3),
        ('junk', 0.16, 15.0, 114.5, 2.5, 3.2, -1, 0.1),
        ('dhow', 0.16, 11.0, 63.0, 3.0, 7.0, 1, 0.45),
        ('liner', 0.24, -24.0, 80.0, 3.0, 10.0, 1, 0.8),
        ('canoe', 0.18, -13.0, -146.0, 3.0, 9.0, -1, 0.2),
        ('tallship', 0.20, 41.0, 156.0, 3.5, 11.0, -1, 0.55),
        ('sail_y', 0.10, -40.0, 161.0, 2.0, 5.0, 1, 0.0),
        ('sail_y', 0.095, 17.0, -66.0, 1.6, 4.0, -1, 0.35),
    ]

    def emit(ctx):
        for k, (name, w, lat0, lon0, dla, dlo, dirn, ph) in enumerate(fleet):
            spr = S[name]
            a = dirn * TAU * (ctx.t / DUR + ph)
            lat = lat0 + dla * math.sin(a)
            lon = lon0 + dlo * math.cos(a)
            cl = math.cos(math.radians(lat0))
            # heading from the derivative of the circuit
            dlat = dla * math.cos(a) * dirn
            dlon = -dlo * math.sin(a) * dirn * cl
            p, e, nn = ll_frame(lat, lon)
            fwd = e * dlon + nn * dlat
            fwd /= np.linalg.norm(fwd) + 1e-9
            # lean back towards the north as far as the heading allows; sailing due north/south the card stands upright
            Bn = nn - fwd * (fwd @ nn)
            th = math.radians(stand_for(lat) + 4.0 * math.sin(TAU * (ctx.t / 3.0 + k * 0.3)))
            Y = math.cos(th) * Bn + math.sin(th) * p
            Y /= np.linalg.norm(Y)
            rock = 3.5 * math.sin(TAU * (ctx.t / 4.0 + k * 0.21))
            h = w * spr.aspect
            O = p * (1.0025 + 0.002 * math.sin(TAU * (ctx.t / 2.5 + k * 0.4))) - fwd * (w / 2)
            ctx.emit(O, fwd, Y, w, h, [(spr, place(spr, 0, 0, w, rot=rock), 1.0)], both=True, contact=0.5)
            if name == 'liner':
                sm = S['smoke']
                for q in range(3):
                    uu = ((ctx.t / 3.0 + q / 3.0 + k * 0.17) % 1.0)
                    sw = w * (0.10 + 0.14 * uu)
                    x = w * (0.40 - 0.30 * uu)
                    y = h * (0.95 + 0.9 * uu)
                    ctx.emit(O + fwd * x + Y * y, fwd, Y, sw, sw * sm.aspect, [(sm, place(sm, 0, 0, sw), 1.0)],
                             both=True, ao=False, alpha=min(1.0, 4 * uu) * (1.0 - smooth((uu - 0.6) / 0.4)), cast=False)
    sc.extras.append(emit)


def whales(sc):
    S = sc.S
    pods = [  # (kind, lat, lon, period, phase, size, yaw)
        ('whale', 30.0, -168.0, 10.0, 0.13, 0.44, 0),
        ('whale', 6.0, -140.0, 10.0, 0.55, 0.32, 8),
        ('whale', -27.0, -19.0, 10.0, 0.58, 0.38, 10),
        ('whale', -26.0, 73.0, 12.0, 0.917, 0.38, -10),
        ('tail', -40.0, -128.0, 7.5, 0.0, 0.20, 0),
        ('tail', 47.0, -33.0, 7.5, 0.133, 0.18, 0),
        ('tail', -42.0, 96.0, 7.5, 0.0, 0.18, 0),
        ('orca', -58.0, -172.0, 10.0, 0.0, 0.30, 0),
    ]

    def emit(ctx):
        for (kind, lat, lon, per, ph, size, yaw) in pods:
            u = (ctx.t / per + ph) % 1.0
            hang = lat < -52
            p, X, B = _basis(lat, lon, yaw + (180.0 if hang else 0.0))
            st = 80.0 if hang else stand_for(lat)
            th = math.radians(st)
            Y = math.cos(th) * B + math.sin(th) * p
            sp = S['splash']
            if kind in ('whale', 'orca'):
                act = 0.52
                if u > act:
                    continue
                v = smooth(u / act)
                rot = 150.0 - 300.0 * v
                spr = S[kind]
                ws = size
                hs = ws * spr.aspect
                Wc, Hc = ws * 1.9, ws * 0.95
                O = p * 1.003 - X * (Wc / 2)
                A = place(spr, Wc / 2 - ws / 2, 0.02 * (ws / 0.26), ws, rot=rot, pivot=(0.5, -0.42))
                layers = [(spr, A, 1.0)]
                ctx.emit(O, X, Y, Wc, Hc, layers, clip=True, both=True, contact=0.0, ao=False)
                # splashes where it leaves and re-enters the water
                for (c0, c1, xs) in ((0.06, 0.34, -0.42), (0.66, 0.96, 0.42)):
                    if c0 < v < c1:
                        k = math.sin(math.pi * (v - c0) / (c1 - c0))
                        sw = ws * 0.42 * (0.5 + 0.5 * k)
                        Os = p * 1.004 + X * (xs * ws - sw / 2) - B * 0.004
                        ctx.emit(Os, X, Y, sw, sw * sp.aspect * k, [(sp, place(sp, 0, 0, sw, sy=k), 1.0)], both=True, ao=False, contact=0.0)
            else:
                act = 0.6
                if u > act:
                    continue
                v = u / act
                k = smooth(v / 0.3) * (1.0 - smooth((v - 0.7) / 0.3))
                spr = S['whale_tail']
                ws = size
                hs = ws * spr.aspect
                O = p * 1.003 - X * (ws * 0.75)
                rot = 9.0 * math.sin(v * 9.0)
                A = place(spr, ws * 0.25, -hs * (1.0 - k), ws, rot=rot, pivot=(0.5, 0.0))
                ctx.emit(O, X, Y, ws * 1.5, hs * 1.1, [(spr, A, 1.0)], clip=True, both=True, contact=0.0, ao=False)
                if 0.05 < v < 0.95:
                    sw = ws * 0.7 * (0.6 + 0.4 * k)
                    Os = p * 1.004 - X * (sw / 2) - B * 0.004
                    ctx.emit(Os, X, Y, sw, sw * sp.aspect * 0.7, [(sp, place(sp, 0, 0, sw, sy=0.7), 1.0)], both=True, ao=False, contact=0.0)
    sc.extras.append(emit)


def moon_pos(t):
    a = TAU * (t - 8.0) / DUR
    return np.array([1.9 * math.sin(a), 0.45 - 1.0 * math.cos(a), 1.9 * math.cos(a)])


def moon(sc):
    spr = sc.S['moon']

    def emit(ctx):
        c = moon_pos(ctx.t)
        cam = ctx.cam
        r = 0.13
        wob = 4.0 * math.sin(TAU * ctx.t / 30.0)
        ctx.emit_world(c - cam.right * r - cam.up * r, cam.right, cam.up, 2 * r, 2 * r,
                       [(spr, place(spr, 0, 0, 2 * r, rot=wob, pivot=(0.5, 0.5)), 1.0)], ao=False, both=True, tint=1.0, noshade=True)
    sc.extras.append(emit)


def plane_pos(t):
    b = -TAU * (2.0 * t / DUR) + 2.2
    n = np.array([0.42, 1.0, -0.30])
    n /= np.linalg.norm(n)
    u1 = np.cross(n, [0.0, 0.0, 1.0]); u1 /= np.linalg.norm(u1)
    u2 = np.cross(n, u1)
    r = 1.36 + 0.04 * math.sin(TAU * 3 * t / DUR)
    return r * (math.cos(b) * u1 + math.sin(b) * u2) + n * 0.10 * math.sin(TAU * 4 * t / DUR)


def plane(sc):
    spr = sc.S['plane_wing']
    dash = sc.S['dash']

    def emit(ctx):
        t = ctx.t
        pos = plane_pos(t)
        ahead = plane_pos(t + 0.05)
        fwd = ahead - pos
        fwd /= np.linalg.norm(fwd)
        up = pos / np.linalg.norm(pos)
        up = up - fwd * (up @ fwd)
        up /= np.linalg.norm(up)
        L = 0.22
        wing_pair(ctx, pos, fwd, up, spr, L, L * spr.aspect, math.radians(16.0 + 4.0 * math.sin(TAU * t / 5.0)), world=True)
        for k in range(1, 9):
            q = plane_pos(t - 0.42 * k - 0.1)
            q2 = plane_pos(t - 0.42 * k - 0.05)
            f2 = q2 - q
            f2 /= np.linalg.norm(f2)
            u2 = q / np.linalg.norm(q)
            side = np.cross(u2, f2)
            w = 0.045 * (1.0 - k / 11.0)
            ctx.emit_world(q - f2 * (w / 2) - side * (w * 0.17), f2, side, w, w * dash.aspect,
                           [(dash, place(dash, 0, 0, w), 1.0)], ao=False, both=True, alpha=1.0 - k / 9.5, cast=False)
    sc.extras.append(emit)


def build(sc):
    clouds(sc)
    ships(sc)
    whales(sc)
    moon(sc)
    plane(sc)
