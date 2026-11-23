"""Pop-up mechanics. Every piece's fold state is a pure function of how far its longitude faces the camera."""
import math
import numpy as np
from .core import ll_frame, wrap180, spring, smooth, smoother, DUR, LON0
from .render import Card, place

D_IN = -50.0     # facing angle (deg, negative = still left of centre) where unfolding starts
D_OUT = 34.0     # facing angle where folding away starts
STEP_IN = 2.4
STEP_OUT = 1.8
SUBCAM = -6.0
DEG_PER_S = 360.0 / DUR


def stand_for(lat):
    if lat >= 0:
        return float(min(86.0, 50.0 + 0.85 * lat))
    return float(max(30.0, 50.0 + 0.40 * lat))


def vis_scale(lat):
    a = (0.143 - math.sin(math.radians(lat)) * math.sin(math.radians(SUBCAM))) / \
        max(1e-3, math.cos(math.radians(lat)) * math.cos(math.radians(SUBCAM)))
    dv = math.degrees(math.acos(max(-1.0, min(1.0, a))))
    return min(1.0, dv / 78.0)


class Ctx:
    __slots__ = ('t', 'G', 'cam', 'lonc', 'out')

    def __init__(self, t, G, cam, lonc):
        self.t, self.G, self.cam, self.lonc = t, G, cam, lonc
        self.out = []

    def emit(self, O, X, Y, w, h, layers, **kw):
        G = self.G
        self.out.append(Card(G @ O, G @ X, G @ Y, w, h, layers, **kw))

    def emit_world(self, O, X, Y, w, h, layers, **kw):
        self.out.append(Card(O, X, Y, w, h, layers, **kw))


class Piece:
    region = ''
    lat = 0.0
    lon = 0.0
    order = 1
    size = 0.1
    dur_in = 13.0
    dur_out = 13.0
    quiet = False

    def window(self):
        vs = vis_scale(self.lat)
        d_in = (D_IN + STEP_IN * self.order) * vs
        d_out = (D_OUT + STEP_OUT * (6 - min(self.order, 6))) * vs
        return d_in, d_out

    def state(self, ctx):
        """-> (s open amount with spring, tau life clock seconds, act 0..1 life activity)"""
        d = wrap180(self.lon - ctx.lonc)
        d_in, d_out = self.window()
        tau = (d - d_in) / DEG_PER_S
        if d <= d_in:
            return 0.0, tau, 0.0
        if d < d_out:
            u = (d - d_in) / self.dur_in
            s = spring(u)
            act = smooth((u - 0.55) / 0.6) * (1.0 - smooth((d - (d_out - 4.0)) / 4.0))
            return s, tau, act
        u = (d - d_out) / self.dur_out
        return 1.0 - smoother(u), tau, 0.0

    def events(self):
        """Foley events: (time_open_start, time_lock, time_close_start, size, lat, lon)."""
        d_in, d_out = self.window()
        t_open = ((d_in - (self.lon - LON0)) / DEG_PER_S) % DUR
        t_lock = (t_open + 0.46 * self.dur_in / DEG_PER_S) % DUR
        t_close = ((d_out - (self.lon - LON0)) / DEG_PER_S) % DUR
        return t_open, t_lock, t_close, self.size, self.lat, self.lon


def _basis(lat, lon, yaw):
    p, e, n = ll_frame(lat, lon)
    if yaw:
        y = math.radians(yaw)
        X = e * math.cos(y) + n * math.sin(y)
    else:
        X = e
    B = np.cross(p, X)
    return p, X, B


class Flap(Piece):
    """A hinged card. Lies on its back when folded, swings up to `stand` degrees from the surface."""

    def __init__(self, lat, lon, spr, w, order=1, yaw=0.0, stand=None, parts=None, mover=None, region='',
                 lift=0.0025, quiet=False, cast=True, dur_in=None, tint=1.0, anchor=0.5, hang=None, emis_parts=None,
                 strut=None, strut_spr=None, both=False):
        self.lat, self.lon, self.spr, self.w = lat, lon, spr, w
        self.order, self.yaw = order, yaw
        if hang is None:
            hang = lat < -52
        self.hang = hang
        if stand is None:
            stand = 80.0 if hang else stand_for(lat)
        self.stand = stand
        self.parts = parts or []
        self.mover = mover
        self.region = region
        self.lift = lift
        self.size = w * max(1.0, spr.aspect)
        self.quiet = quiet
        self.cast = cast
        self.tint = tint
        self.anchor = anchor
        self.emis_parts = emis_parts or []
        self.both = both
        if strut is None:
            strut = (mover is None) and (w * spr.aspect >= 0.12)
        self.strut = strut and strut_spr is not None
        self.strut_spr = strut_spr
        if dur_in is not None:
            self.dur_in = dur_in
        elif self.size < 0.12:
            self.dur_in = 10.0

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        lat, lon, yaw = self.lat, self.lon, self.yaw
        flip = False
        bob = 0.0
        rot = 0.0
        if self.mover is not None:
            lat, lon, flip, bob, rot, yaw2 = self.mover(tau, act, ctx.t)
            yaw += yaw2
        if self.hang:
            yaw += 180.0
        p, X, B = _basis(lat, lon, yaw)
        w = self.w
        h = w * self.spr.aspect
        # folded flat, the card rests tangent to the globe at its middle so it hugs the curve
        half = min(0.5 * h, 0.35)
        k0 = 1.0 - min(1.0, max(0.0, s))
        th = math.radians(s * self.stand) - 0.95 * half * k0
        Y = math.cos(th) * B + math.sin(th) * p
        lift = self.lift + (1.0 / math.cos(half) - 1.0) * k0
        O = p * (1.0 + lift + bob) - X * (w * self.anchor)
        layers = [(self.spr, place(self.spr, 0, 0, w, rot=rot, flip=flip), 1.0)]
        for pt in self.parts:
            dx, dy, r = pt['anim'](tau, act) if pt.get('anim') else (0.0, 0.0, 0.0)
            sp = pt['spr']
            A = place(sp, pt['x'] * w + dx * w, pt['y'] * w + dy * w, pt['w'] * w, rot=r, pivot=pt.get('pivot', (0.5, 0.0)))
            if pt.get('under'):
                layers.insert(0, (sp, A, 1.0))
            else:
                layers.append((sp, A, 1.0))
        stand_amt = s * math.sin(th)
        if self.strut:
            # easel-back prop: a paper strip hinged to the back of the card, its foot sliding on the surface
            hs = 0.45 * h
            Ls = hs * math.sin(math.radians(self.stand)) / math.sin(math.radians(75.0))
            D = hs * math.cos(th) + math.sqrt(max(Ls * Ls - (hs * math.sin(th)) ** 2, 1e-9))
            ws = max(0.012, min(0.03, 0.14 * w))
            top = O + X * (w * 0.5) + Y * hs
            foot = (p * math.cos(D) + B * math.sin(D)) * (1.0 + self.lift)   # the foot slides along the globe
            Ys = top - foot
            ln = np.linalg.norm(Ys)
            ss_ = self.strut_spr
            ctx.emit(foot - X * (ws / 2), X, Ys / ln, ws, ln, [(ss_, place(ss_, 0, 0, ws, sy=ln / (ws * ss_.aspect)), 1.0)],
                     contact=0.3 * s, tint=0.9, both=True, ao=False)
        ctx.emit(O, X, Y, w, h, layers, contact=min(1.0, stand_amt) * min(1.0, 0.35 + w * 5), cast=self.cast, tint=self.tint, both=self.both)
        for ep in self.emis_parts:
            if s < 0.5:
                continue
            sp = ep['spr']
            ew = ep['w'] * w
            fl = ep['flick'](tau, ctx.t) if ep.get('flick') else 1.0
            ex, ey = ep['x'] * w, ep['y'] * w
            Oe = O + X * (ex - ew / 2) + Y * (ey - ew / 2) - np.cross(X, Y) * (-0.004)
            ctx.emit(Oe, X, Y, ew, ew, [(sp, place(sp, 0, 0, ew), fl * min(1.0, (s - 0.5) * 3))], emis=True, cast=False, ao=False, sortz=-0.01)


class Tent(Piece):
    """V-fold: a front face and a back face meeting at a ridge; both bases stay on the surface."""

    def __init__(self, lat, lon, spr, w, order=0, yaw=0.0, stand=None, back_ratio=0.85, region='', back_spr=None, lift=0.002):
        self.lat, self.lon, self.spr, self.w = lat, lon, spr, w
        self.order, self.yaw = order, yaw
        self.stand = stand if stand is not None else max(40.0, stand_for(lat) - 8.0)
        self.back_ratio = back_ratio
        self.region = region
        self.back_spr = back_spr or spr
        self.size = w * max(0.8, spr.aspect)
        self.dur_in = 12.0
        self.lift = lift

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        p, X, B = _basis(self.lat, self.lon, self.yaw)
        w = self.w
        h = w * self.spr.aspect
        hb = h * self.back_ratio
        th = math.radians(max(0.7, s * self.stand))
        Y = math.cos(th) * B + math.sin(th) * p
        O = p * (1.0 + self.lift) - X * w / 2
        ridge_h = h * math.sin(th)
        D = h * math.cos(th) + math.sqrt(max(hb * hb - ridge_h * ridge_h, 1e-9))
        Ob = O + B * D
        Yb = (O + Y * h) - Ob
        Yb = Yb / np.linalg.norm(Yb)
        # back face first (it is hidden from the front); mirrored so the silhouettes agree
        sb = self.back_spr
        A = place(sb, 0, 0, w, sy=self.back_ratio)
        ctx.emit(Ob, X, Yb, w, hb, [(sb, A, 1.0)], contact=0.5 * s, tint=0.80, both=True)
        ctx.emit(O, X, Y, w, h, [(self.spr, place(self.spr, 0, 0, w), 1.0)], contact=min(1.0, s * math.sin(th)))


class Pyramid(Piece):
    """Four triangular faces hinged to a square base: a flat star that folds up to a point."""

    def __init__(self, lat, lon, spr, base, order=1, yaw=20.0, region='', slant=0.9):
        self.lat, self.lon, self.spr, self.base = lat, lon, spr, base
        self.order, self.yaw, self.region = order, yaw, region
        self.slant = slant * base
        self.size = base * 1.4
        self.dur_in = 14.0

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        s = min(s, 1.02)
        p, X0, B0 = _basis(self.lat, self.lon, self.yaw)
        b = self.base
        psi_in = math.acos((b / 2) / self.slant)
        ang = max(0.012, s) * (math.pi - psi_in)
        for k in range(4):
            a = k * math.pi / 2
            outd = math.cos(a) * (-B0) + math.sin(a) * X0      # outward dir of this face (k=0 faces south)
            edge = np.cross(outd, p)                           # along the base edge, left->right seen from outside
            edge = -edge
            Y = math.cos(ang) * outd + math.sin(ang) * p
            O = p * 1.003 + outd * (b / 2) - edge * (b / 2)
            ctx.emit(O, edge, Y, b, self.slant, [(self.spr, place(self.spr, 0, 0, b), 1.0)],
                     contact=0.8 * s, ao=False, both=True)


class Zigzag(Piece):
    """Accordion strip: swings up as a closed stack, then concertinas open along its length."""

    def __init__(self, lat, lon, spr, n, total_w, order=1, yaw=0.0, beta=60.0, stand=None, region='', shimmer=0.0, follow=True, fade=False):
        self.lat, self.lon, self.spr, self.n = lat, lon, spr, n
        self.pw = total_w / n / math.sin(math.radians(beta))
        self.order, self.yaw, self.beta, self.region = order, yaw, beta, region
        self.stand = stand if stand is not None else stand_for(lat)
        self.size = total_w
        self.dur_in = 16.0
        self.shimmer = shimmer
        self.follow = follow
        self.fade = fade

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        d_in, d_out = self.window()
        d = wrap180(self.lon - ctx.lonc)
        u = (d - d_in) / self.dur_in
        if d >= d_out:
            u = (1.0 - smoother((d - d_out) / self.dur_out))
            s1 = smooth(u * 1.6)
            s2 = smooth(u * 1.6 - 0.6)
        else:
            s1 = smooth(u * 2.2)
            s2 = spring((u - 0.32) / 0.68)
        p0, X, B = _basis(self.lat, self.lon, self.yaw)
        ph0 = self.pw * self.n * self.spr.aspect
        half = min(0.5 * ph0, 0.35)
        k0 = 1.0 - min(1.0, max(0.0, s1))
        th = math.radians(s1 * self.stand) - 0.95 * half * k0
        Yv = math.cos(th) * B + math.sin(th) * p0
        Zd = np.cross(X, Yv)
        p = p0 * (1.0 + (1.0 / math.cos(half) - 1.0) * k0)
        beta = math.radians(5.0 + (self.beta - 5.0) * s2 + self.shimmer * act * 6.0 * math.sin(tau * 1.3))
        n, pw = self.n, self.pw
        ph = pw * n * self.spr.aspect
        L = n * pw * math.sin(beta)
        amp = pw * math.cos(beta)
        pts = []
        for i in range(n + 1):
            q = p - X * (L / 2) + X * (i * pw * math.sin(beta)) + Zd * (amp * (0.5 if i % 2 else -0.5))
            pts.append(q)
        for i in range(n):
            a, b = pts[i], pts[i + 1]
            up = Yv
            if self.follow:
                # long strips settle onto the curve of the globe as they stand up
                wf = smooth((s1 - 0.5) / 0.5)
                an = a / np.linalg.norm(a)
                bn = b / np.linalg.norm(b)
                a = a + (an - a) * wf
                b = b + (bn - b) * wf
                mid = (an + bn) / 2
                upl = mid / np.linalg.norm(mid)
                upl = upl * math.sin(th) + B * math.cos(th)
                upl /= np.linalg.norm(upl)
                up = Yv + (upl - Yv) * wf
                up /= np.linalg.norm(up)
            Xp = (b - a)
            lw = np.linalg.norm(Xp)
            Xp = Xp / lw
            A = place(self.spr, -i * pw, 0, pw * n)
            u0 = self.spr.pw * i / n
            u1 = self.spr.pw * (i + 1) / n
            ctx.emit(a * 1.003, Xp, up, pw, ph, [(self.spr, A, 1.0, (u0, u1))], contact=0.6 * s1,
                     alpha=(0.18 + 0.82 * min(1.0, s1)) if self.fade else 1.0,
                     tint=1.0 if i % 2 == 0 else 0.93)


class Bird(Piece):
    """Two-wing paper bird circling above a point while its region is open."""

    def __init__(self, lat, lon, spr, span, radius=3.0, alt=0.12, period=6.0, phase=0.0, order=5, region='', flap=3.2, ccw=True, body=None):
        self.lat, self.lon, self.spr, self.span = lat, lon, spr, span
        self.radius, self.alt, self.period, self.phase = radius, alt, period, phase
        self.order, self.region, self.flap = order, region, flap
        self.ccw = 1.0 if ccw else -1.0
        self.size = span * 0.6
        self.quiet = True
        self.dur_in = 9.0

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        if s <= 0.02:
            return
        a = self.ccw * (2 * math.pi * tau / self.period) + self.phase
        r = self.radius * (0.25 + 0.75 * s)
        lat = self.lat + r * math.sin(a)
        lon = self.lon + r * math.cos(a) / max(0.3, math.cos(math.radians(self.lat)))
        p, e, n = ll_frame(lat, lon)
        fwd = (-math.sin(a) * e + math.cos(a) * n) * self.ccw
        side = np.cross(p, fwd)
        alt = self.alt * s * (1.0 + 0.08 * math.sin(tau * 2.1 + self.phase))
        wing = math.radians(18.0 + 34.0 * math.sin(tau * self.flap * 2 + self.phase * 3))
        L = self.span * 0.5 / self.spr.aspect       # body length (sprite width)
        hw = self.span * 0.5
        pos = p * (1.0 + alt)
        O = pos - fwd * (L / 2)
        sc = min(1.0, s * 1.5)
        for sgn in (1.0, -1.0):
            Y = math.cos(wing) * side * sgn + math.sin(wing) * p
            if sgn > 0:
                ctx.emit(O, fwd, Y, L * sc, hw * sc, [(self.spr, place(self.spr, 0, 0, L * sc), 1.0)], ao=False)
            else:
                ctx.emit(O + fwd * L * sc, -fwd, Y, L * sc, hw * sc, [(self.spr, place(self.spr, 0, 0, L * sc, flip=True), 1.0)], ao=False)


def ping(tau, period):
    """0..1..0 triangle wave, eased at the ends."""
    u = (tau / period) % 1.0
    u = 2 * u if u < 0.5 else 2 - 2 * u
    return smooth(u), (1 if (tau / period) % 1.0 < 0.5 else -1)


def walker(lat0, lon0, lat1, lon1, period=14.0, phase=0.0, bob=0.0018, step=0.45, hop=0.0, face=1):
    """Mover: walks back and forth between two points. Sprites are drawn facing right (east)."""
    def fn(tau, act, t):
        u, dirn = ping(tau + phase * period, period)
        lat = lat0 + (lat1 - lat0) * u
        lon = lon0 + (lon1 - lon0) * u
        going_east = (lon1 - lon0) * dirn >= 0
        flip = (not going_east) if face > 0 else going_east
        ph = (tau + phase) / step * math.pi
        b = abs(math.sin(ph)) * (bob + hop) * act
        rot = math.sin(ph) * 3.0 * act if hop == 0 else (math.cos(ph) * 7.0 * act * (1 if not flip else -1))
        return lat, lon, flip, b, rot, 0.0
    return fn


def sway(amp=3.0, period=3.0, phase=0.0):
    def fn(tau, act):
        return 0.0, 0.0, amp * act * math.sin(2 * math.pi * tau / period + phase)
    return fn


def spin(period=4.0, phase=0.0):
    def fn(tau, act):
        return 0.0, 0.0, (360.0 * tau / period + phase) * 1.0 if act > 0 else phase + 360.0 * tau / period
    return fn


def nod(amp=22.0, period=5.0, phase=0.0):
    """Graze: head dips down and comes back."""
    def fn(tau, act):
        u = (tau / period + phase) % 1.0
        k = smooth(min(1.0, u * 3.0)) * (1.0 - smooth((u - 0.6) / 0.3))
        return 0.0, 0.0, -amp * k * act
    return fn


def wing_pair(ctx, pos, fwd, up, spr, L, half_span, angle, world=False, **kw):
    """Two mirrored wing cards sharing a keel along fwd (used by birds and the paper plane)."""
    side = np.cross(up, fwd)
    O = pos - fwd * (L / 2)
    em = ctx.emit_world if world else ctx.emit
    for sgn in (1.0, -1.0):
        Y = math.cos(angle) * side * sgn + math.sin(angle) * up
        if sgn > 0:
            em(O, fwd, Y, L, half_span, [(spr, place(spr, 0, 0, L), 1.0)], ao=False, **kw)
        else:
            em(O + fwd * L, -fwd, Y, L, half_span, [(spr, place(spr, 0, 0, L, flip=True), 1.0)], ao=False, **kw)


def bob(amp=0.03, period=2.5, phase=0.0):
    def fn(tau, act):
        return 0.0, amp * act * (0.5 + 0.5 * math.sin(2 * math.pi * tau / period + phase)), 0.0
    return fn
