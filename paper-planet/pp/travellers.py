"""Things that are always alive regardless of fold state: clouds, ships, whales, the moon and the paper plane."""
import math
import numpy as np
from .core import ll_frame, DUR, smooth, smoother, LON0
from .mech import stand_for, stand_cam, wing_pair, _basis
from .render import place

TAU = 2 * math.pi
# widest on-globe size each traveller sprite is drawn at (globe radii), for rasterisation density
TRAVELLER_W = {'cloud': 0.40, 'tallship': 0.24, 'liner': 0.30, 'junk': 0.18, 'dhow': 0.18, 'canoe': 0.20, 'sail_y': 0.12,
               'smoke': 0.08, 'whale': 0.45, 'orca': 0.32, 'whale_tail': 0.22, 'splash': 0.25, 'moon': 0.30,
               'plane_wing': 0.24, 'dash': 0.05, 'bluewhale': 0.66, 'spray': 0.52, 'drop': 0.03, 'ring': 0.8, 'spout': 0.16}


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
            th = math.radians(stand_cam(ctx, lat, lon) + 4.0 * math.sin(TAU * (ctx.t / 3.0 + k * 0.3)))
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
        ('whale', -27.0, -19.0, 10.0, 0.58, 0.38, 10),
        ('whale', -26.0, 73.0, 12.0, 0.917, 0.38, -10),
        ('tail', 47.0, -33.0, 7.5, 0.133, 0.18, 0),
        ('tail', -42.0, 96.0, 7.5, 0.0, 0.18, 0),
        ('orca', -61.0, -178.0, 10.0, 0.0, 0.30, 0),
    ]

    def emit(ctx):
        for (kind, lat, lon, per, ph, size, yaw) in pods:
            u = (ctx.t / per + ph) % 1.0
            p, X, B = _basis(lat, lon, yaw)
            st = stand_cam(ctx, lat, lon)
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
    breach(sc)
    clouds(sc)
    ships(sc)
    whales(sc)
    moon(sc)
    plane(sc)


# ------------------------------------------------------------------------------------------- the breach
BREACH_LAT, BREACH_LON = 30.0, -141.0
BREACH_T = 25.0          # top of the leap (s); the camera's 'whale' close-up is keyed to the same moment
BREACH_AIR = 3.6         # seconds out of the water
BREACH_H = 0.62          # height of the arc's top above the sea (globe radii)


def breach_times():
    """(blow, leave the water, re-enter) in loop seconds, for the soundtrack."""
    return ((BREACH_T - 5.2) % DUR, (BREACH_T - BREACH_AIR / 2) % DUR, (BREACH_T + BREACH_AIR / 2) % DUR)


def breach(sc):
    """A blue whale leaps high off the globe in the South Pacific, with paper spray, drops and rings."""
    from .core import Camera, globe_matrix
    from .mech import face_angle
    S = sc.S
    whale, spray, drop, ring, spout = S['bluewhale'], S['spray'], S['drop'], S['ring'], S['spout']
    T = BREACH_T
    fa = face_angle(Camera(T, 1), globe_matrix(T), BREACH_LAT, BREACH_LON)
    th = math.radians(min(78.0, max(60.0, fa + 26.0)))
    p, X, B = _basis(BREACH_LAT, BREACH_LON, 0.0)
    Y = math.cos(th) * B + math.sin(th) * p
    Nf = np.cross(X, Y)                       # card normal; flipped toward the lens below
    rng = np.random.default_rng(11)
    drops = [(rng.uniform(-0.25, 0.25), rng.uniform(0.55, 1.0), rng.uniform(0.6, 1.0), rng.uniform(0.5, 1.0)) for _ in range(14)]
    WL = 0.66                                 # whale length
    WC, HC = 1.5, 1.05                        # clip card: the sea surface is its bottom edge

    def emit(ctx):
        dt = (ctx.t - T + DUR / 2) % DUR - DUR / 2
        cam_local = ctx.G.T @ ctx.cam.C
        nf = Nf if (Nf @ (cam_local - p)) > 0 else -Nf
        O = p * 1.002 - X * (WC / 2)
        # blow: a spout a few seconds before the leap
        if -5.6 < dt < -3.6:
            k = math.sin(math.pi * (dt + 5.6) / 2.0)
            sw = 0.16 * (0.6 + 0.4 * k)
            Os = p * 1.003 + X * (-0.05 - sw / 2) + nf * 0.004
            ctx.emit(Os, X, Y, sw, sw * spout.aspect * k, [(spout, place(spout, 0, 0, sw, sy=k), 0.95)], both=True, ao=False, cast=False)
        u = (dt + BREACH_AIR / 2) / BREACH_AIR
        if -0.35 < u < 1.0:
            uu = min(max(u, -0.35), 1.0)
            x = -0.24 + 0.48 * uu
            c = -0.30 + (BREACH_H + 0.30) * 4.0 * uu * (1.0 - uu)
            dxdu = 0.48
            dcdu = (BREACH_H + 0.30) * 4.0 * (1.0 - 2.0 * uu)
            rot = math.degrees(math.atan2(dcdu, dxdu))
            # a slow quarter roll as it falls, so it lands on its side like a real breach
            sy = 1.0 - 0.35 * smooth((uu - 0.45) / 0.5)
            hs = WL * whale.aspect
            A = place(whale, WC / 2 + x - WL / 2, c - hs / 2, WL, rot=rot, pivot=(0.5, 0.5), sy=sy)
            ctx.emit(O, X, Y, WC, HC, [(whale, A, 1.0)], clip=True, both=True, contact=0.0, ao=False, tint=1.3)
        # spray crowns where it leaves and re-enters the water
        for (u0, u1, xs, wmax) in ((-0.12, 0.42, -0.24, 0.36), (0.80, 1.45, 0.24, 0.48)):
            if u0 < u < u1:
                v = (u - u0) / (u1 - u0)
                k = math.sin(math.pi * v) ** 0.8
                sw = wmax * (0.55 + 0.45 * smooth(v * 1.6))
                Os = p * 1.003 + X * (xs - sw / 2) + nf * 0.006
                ctx.emit(Os, X, Y, sw, sw * spray.aspect * k, [(spray, place(spray, 0, 0, sw, sy=k), 1.0)],
                         both=True, ao=False, contact=0.0, sortz=-0.02)
        # paper drops thrown up by the splash-down
        if 0.90 < u < 1.9:
            g = (u - 0.90) * BREACH_AIR
            for i, (vx, vy, sz, ph) in enumerate(drops):
                xx = 0.24 + vx * g
                yy = vy * 0.9 * g - 1.15 * g * g * (0.8 + 0.2 * ph)
                if yy < 0:
                    continue
                dw = 0.030 * sz
                Od = p * 1.003 + X * (xx - dw / 2) + Y * yy + nf * 0.008
                ctx.emit(Od, X, Y, dw, dw * drop.aspect, [(drop, place(drop, 0, 0, dw, rot=40 * vx * g), 1.0)],
                         both=True, ao=False, cast=False, sortz=-0.03)
        # rings spreading on the sea afterwards
        for j, (s0, xs) in enumerate(((0.95, 0.24), (1.25, 0.21), (-0.05, -0.24))):
            v = (u - s0) / 1.3
            if 0.0 < v < 1.0:
                rr = 0.05 + 0.12 * smooth(v * 1.2)
                al = (1.0 - smooth(v)) * smooth(v * 6.0) * 0.7
                pc, ec, nc = ll_frame(BREACH_LAT + 0.0, BREACH_LON + math.degrees(xs) / math.cos(math.radians(BREACH_LAT)))
                Or = pc * 1.0026 - ec * rr - nc * rr
                ctx.emit(Or, ec, nc, 2 * rr, 2 * rr, [(ring, place(ring, 0, 0, 2 * rr), 1.0)], ao=False, cast=False, alpha=al)
    sc.extras.append(emit)
