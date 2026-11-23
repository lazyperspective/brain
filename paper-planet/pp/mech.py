"""Pop-up mechanics. Every piece's fold state is a pure function of film time: it lies folded (and hidden in
the map) until its bloom time t_open, then springs open and stays open."""
import math
import numpy as np
from .core import ll_frame, wrap180, spring, smooth, smoother, DUR, DEG_PER_S
from .render import Card, place

BETA0 = 4.0     # pleat angle of a closed concertina
NEVER = 1e9
SKIN_S = (0.03, 0.34)   # a lifting piece wears the map print it lay on, and its art shows through over this range
RESTAND = 1.8           # seconds to settle from the hero hinge angle to the crown angle in the finale


def appear(s):
    """Opacity of a piece that has only just started to lift (folded flat it is part of the plain map)."""
    return smooth(s / 0.06)


def skin_amt(s):
    return 1.0 - smooth((s - SKIN_S[0]) / (SKIN_S[1] - SKIN_S[0]))


def stand_for(lat):
    if lat >= 0:
        return float(min(86.0, 50.0 + 0.85 * lat))
    return float(max(30.0, 50.0 + 0.40 * lat))


def stand_cam(ctx, lat, lon, extra=40.0, lo=50.0, hi=86.0):
    """Hinge angle for always-alive things (ships, whales): lean so they present themselves to the lens."""
    return float(min(hi, max(lo, face_angle(ctx.cam, ctx.G, lat, lon) + extra)))


def face_angle(cam, G, lat, lon, yaw=0.0):
    """Hinge angle (deg from the surface, leaning away from the card's face) at which a card at lat/lon
    (turned by yaw) faces this camera."""
    p, X, B = _basis(lat, lon, yaw)
    v = G.T @ (cam.C - G @ p)
    # past the horizon (v.p < 0) keep it continuous instead of wrapping through +-180
    return math.degrees(math.atan2(-(v @ B), max(v @ p, 0.05 * np.linalg.norm(v))))


def face_yaw(cam, G, lat, lon):
    """(yaw that turns a card to face this camera, how far from overhead the camera is: sin of the angle)."""
    p, e, n = ll_frame(lat, lon)
    v = G.T @ (cam.C - G @ p)
    vt = v - p * (v @ p)
    sa = float(np.linalg.norm(vt) / np.linalg.norm(v))
    X = np.cross(p, vt / (np.linalg.norm(vt) + 1e-12))
    return math.degrees(math.atan2(X @ n, X @ e)), sa


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
    dur_in = 13.0         # unfold time in degrees of v2's turn (6 deg/s); see din()
    tempo = 1.0           # per-stop unfold speed (later stops are snappier)
    quiet = False
    t_open = NEVER        # film time the unfold starts (set by Scene.assign_heroes)
    hero_w = 0.0          # 0..1, how central the piece is in the camera's close-up
    stand_crown = None    # hinge angle for the final wide shot
    t_crown = NEVER
    dyaw_crown = 0.0      # turn about its own axis to face the lens in the final wide shot
    gk = 1.0              # hero growth already applied to the piece's size
    t_shrink = NEVER      # the camera leaves the piece's stop: it settles back from its hero size
    s_post = 1.0          # size (relative to the grown size) while it is only passing
    t_fold = NEVER        # the X cut only: the bloom runs backwards from here, straight back into the map
    d_fold = 0.5          # ... taking this long (s)
    xyaw = 0.0            # the X cut's crowned globe only: an extra turn to face the lens at the rim
    xk = 1.0              # the X cut's crowned globe only: an extra scale (small animals read better)

    def din(self):
        return self.dur_in / DEG_PER_S * self.tempo

    def ueff(self, t):
        """Unfold clock in units of din (0 folded, >=1 settled open); the fold plays the bloom in reverse."""
        u = (t - self.t_open) / self.din()
        if t > self.t_fold:
            u = min(u, 1.0) * max(0.0, 1.0 - (t - self.t_fold) / self.d_fold)
        return u

    def state(self, ctx):
        """-> (s open amount with spring, tau life clock seconds, act 0..1 life activity)"""
        dt = ctx.t - self.t_open
        if dt <= 0.0:
            return 0.0, 0.0, 0.0
        u = self.ueff(ctx.t)
        if u <= 0.0:
            return 0.0, 0.0, 0.0
        return spring(u), dt, smooth((u - 0.55) / 0.6)

    def cur_stand(self, t):
        if self.stand_crown is None or t <= self.t_crown:
            return self.stand
        return self.stand + (self.stand_crown - self.stand) * smoother((t - self.t_crown) / RESTAND)

    def cur_scale(self, t):
        sc = self.xk
        if t > self.t_shrink:
            sc += (self.s_post - 1.0) * smoother((t - self.t_shrink) / 1.4)
        if t > self.t_crown:
            sc += (self.xk / self.gk - sc) * smoother((t - self.t_crown) / RESTAND)
        return sc

    def cur_dyaw(self, t):
        if not self.dyaw_crown or t <= self.t_crown:
            return 0.0
        return self.dyaw_crown * smoother((t - self.t_crown) / RESTAND)

    def events(self):
        """Foley events: (time_open_start, time_lock, size, lat, lon)."""
        return self.t_open, self.t_open + 0.46 * self.din(), self.size, self.lat, self.lon

    def grow(self, k):
        pass

    def sprite_widths(self):
        return []


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
            hang = False
        self.hang = hang
        self.stand_fixed = stand is not None
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

    def grow(self, k):
        self.w *= k
        self.size *= k

    def sprite_widths(self):
        out = [(self.spr.name, self.w)]
        for pt in self.parts + self.emis_parts:
            out.append((pt['spr'].name, pt['w'] * self.w))
        return out

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        if s <= 0.0:
            return                         # folded flat: part of the plain map
        lat, lon, yaw = self.lat, self.lon, self.yaw
        flip = False
        bob = 0.0
        rot = 0.0
        if self.mover is not None:
            lat, lon, flip, bob, rot, yaw2 = self.mover(tau, act, ctx.t)
            yaw += yaw2
        else:
            yaw += self.cur_dyaw(ctx.t)
        yaw += self.xyaw
        if self.hang:
            yaw += 180.0
        p, X, B = _basis(lat, lon, yaw)
        w = self.w * self.cur_scale(ctx.t)
        h = w * self.spr.aspect
        # folded flat, the card rests tangent to the globe at its middle so it hugs the curve
        half = min(0.5 * h, 0.35)
        stand = self.cur_stand(ctx.t)

        def pose(s_):
            k0 = 1.0 - min(1.0, max(0.0, s_))
            th_ = math.radians(s_ * stand) - 0.95 * half * k0
            Y_ = math.cos(th_) * B + math.sin(th_) * p
            lift_ = self.lift + (1.0 / math.cos(half) - 1.0) * k0
            return th_, Y_, p * (1.0 + lift_ + bob) - X * (w * self.anchor)

        th, Y, O = pose(s)
        al = appear(s)
        m = skin_amt(s)
        skin = None
        if m > 0.0:
            _, Y0, O0 = pose(0.0)
            skin = (m, O0, X, Y0)
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
        if self.strut and s > 0.12:
            # easel-back prop: a paper strip hinged to the back of the card, its foot sliding on the surface
            hs = 0.45 * h
            Ls = hs * math.sin(math.radians(stand)) / math.sin(math.radians(75.0))
            D = hs * math.cos(th) + math.sqrt(max(Ls * Ls - (hs * math.sin(th)) ** 2, 1e-9))
            ws = max(0.012, min(0.03, 0.14 * w))
            top = O + X * (w * 0.5) + Y * hs
            foot = (p * math.cos(D) + B * math.sin(D)) * (1.0 + self.lift)   # the foot slides along the globe
            Ys = top - foot
            ln = np.linalg.norm(Ys)
            ss_ = self.strut_spr
            ctx.emit(foot - X * (ws / 2), X, Ys / ln, ws, ln, [(ss_, place(ss_, 0, 0, ws, sy=ln / (ws * ss_.aspect)), 1.0)],
                     contact=0.3 * s, tint=0.9, both=True, ao=False, alpha=smooth((s - 0.12) / 0.3))
        ctx.emit(O, X, Y, w, h, layers, contact=min(1.0, stand_amt) * min(1.0, 0.35 + w * 5), cast=self.cast and al > 0.6,
                 tint=self.tint, both=self.both, alpha=al, skin=skin)
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
        self.stand_fixed = stand is not None
        self.stand = stand if stand is not None else max(40.0, stand_for(lat) - 8.0)
        self.back_ratio = back_ratio
        self.region = region
        self.back_spr = back_spr or spr
        self.size = w * max(0.8, spr.aspect)
        self.dur_in = 12.0
        self.lift = lift

    def grow(self, k):
        self.w *= k
        self.size *= k

    def sprite_widths(self):
        return [(self.spr.name, self.w), (self.back_spr.name, self.w)]

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        if s <= 0.0:
            return
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
    """Four triangular faces hinged to a square base. Folded, they lie inward on the base like the flaps of
    an envelope (top flap last folded, first to rise); unfolding, they rise one after another and meet at
    the apex."""

    def __init__(self, lat, lon, spr, base, order=1, yaw=20.0, region='', slant=0.9):
        self.lat, self.lon, self.spr, self.base = lat, lon, spr, base
        self.order, self.yaw, self.region = order, yaw, region
        self.slant = slant * base
        self.size = base * 1.4
        self.dur_in = 14.0

    def grow(self, k):
        self.base *= k
        self.slant *= k
        self.size *= k

    def sprite_widths(self):
        return [(self.spr.name, self.base)]

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        if s <= 0.0:
            return
        s = min(s, 1.02)
        p, X0, B0 = _basis(self.lat, self.lon, self.yaw)
        k_ = self.cur_scale(ctx.t)
        b = self.base * k_
        slant = self.slant * k_
        psi_in = math.acos((b / 2) / slant)
        stack = (1, 3, 0, 2)              # stacking height of each face when folded (3 = on top)
        for k in range(4):
            a = k * math.pi / 2
            kk = stack[k]
            lag = 0.30 * (3 - kk) / 3.0
            sk = s if s >= 1.0 else max(0.0, (s - lag) / (1.0 - lag))
            outd = math.cos(a) * (-B0) + math.sin(a) * X0      # outward dir of this face (k=0 faces south)
            edge = -np.cross(outd, p)                          # along the base edge, left->right seen from outside
            if sk <= 0.0:
                continue

            def face(sk_):
                ang = math.pi - 0.010 - sk_ * (psi_in - 0.010)
                Y_ = math.cos(ang) * outd + math.sin(ang) * p
                lift = 0.003 + (0.0016 * (kk + 1)) * max(0.0, 1.0 - sk_ * 3.0)
                return Y_, p * (1.0 + lift) + outd * (b / 2) - edge * (b / 2)

            Y, O = face(sk)
            m = skin_amt(sk)
            skin = None
            if m > 0.0:
                Y0, O0 = face(0.0)
                skin = (m, O0, edge, Y0)
            ctx.emit(O, edge, Y, b, slant, [(self.spr, place(self.spr, 0, 0, b), 1.0)],
                     contact=0.8 * s, ao=False, both=True, alpha=appear(sk), cast=sk > 0.05, skin=skin)


class Zigzag(Piece):
    """Accordion strip: swings up as a closed stack, then concertinas open along its length."""

    def __init__(self, lat, lon, spr, n, total_w, order=1, yaw=0.0, beta=60.0, stand=None, region='', shimmer=0.0, follow=True, fade=False, glow=False):
        self.lat, self.lon, self.spr, self.n = lat, lon, spr, n
        self.pw = total_w / n / math.sin(math.radians(beta))
        self.order, self.yaw, self.beta, self.region = order, yaw, beta, region
        self.stand_fixed = stand is not None
        self.stand = stand if stand is not None else stand_for(lat)
        self.size = total_w
        self.dur_in = 24.0
        self.dur_out = 20.0
        self.shimmer = shimmer
        self.follow = follow
        self.fade = fade
        self.glow = glow

    def grow(self, k):
        self.pw *= k
        self.size *= k

    def sprite_widths(self):
        return [(self.spr.name, self.pw * self.n)]

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        if s <= 0.0:
            return
        u = self.ueff(ctx.t)
        s1 = smooth(u * 1.6)
        s2 = spring((u - 0.42) / 0.58)
        stand = self.cur_stand(ctx.t)
        k_ = self.cur_scale(ctx.t)
        panels, lift, ph, s1c = self._panels(s1, s2, act, tau, stand, k_)
        al = appear(s1c * 1.2)
        m = 0.0 if self.glow else skin_amt(s1c * 1.2)
        rest = None
        if m > 0.0:
            rest = self._panels(0.0, 0.0, 0.0, 0.0, stand, k_)
        pw, n = self.pw * k_, self.n
        for i, (a, b, up) in enumerate(panels):
            Xp = (b - a)
            Xp = Xp / np.linalg.norm(Xp)
            A = place(self.spr, -i * pw, 0, pw * n)
            u0 = self.spr.pw * i / n
            u1 = self.spr.pw * (i + 1) / n
            if self.glow:
                ctx.emit(a + lift, Xp, up, pw, ph, [(self.spr, A, 1.0, (u0, u1))], emis=True, cast=False, ao=False,
                         alpha=(0.55 + 0.35 * s1c) * smooth(s1c / 0.15))
            else:
                skin = None
                if rest is not None:
                    ra, rb, rup = rest[0][i]
                    rX = (rb - ra) / np.linalg.norm(rb - ra)
                    skin = (m, ra + rest[1], rX, rup)
                ctx.emit(a + lift, Xp, up, pw, ph, [(self.spr, A, 1.0, (u0, u1))], contact=0.6 * s1c,
                         tint=1.0 if i % 2 == 0 else 0.90, alpha=al, cast=al > 0.6, skin=skin, both=self.fade)

    def _panels(self, s1, s2, act, tau, stand, k_=1.0):
        p0, X, B = _basis(self.lat, self.lon, self.yaw)
        # closed, the pack lies flat with its pages on the map: a neat pleated strip. Opening, it rolls up
        # onto its edge (a quarter turn about its long axis), swings up on its hinge, then fans open.
        s1c = min(1.0, max(0.0, s1))
        phi = math.radians(90.0 * (1.0 - smooth(s1c / 0.55)))
        th = math.radians(stand * smooth((s1c - 0.2) / 0.8))

        def rot(v):     # rotation about the local north axis by phi, taking east -> up
            ve, vn, vp = v @ X, v @ B, v @ p0
            return X * (ve * math.cos(phi) - vp * math.sin(phi)) + B * vn + p0 * (vp * math.cos(phi) + ve * math.sin(phi))

        Xf = rot(X)
        Yv = rot(math.cos(th) * B + math.sin(th) * p0)
        Zd = np.cross(Xf, Yv)
        beta = math.radians(BETA0 + (self.beta - BETA0) * s2 + self.shimmer * act * 6.0 * math.sin(tau * 1.3))
        n, pw = self.n, self.pw * k_
        ph = pw * n * self.spr.aspect
        L = n * pw * math.sin(beta)
        amp = pw * math.cos(beta)
        pts = []
        for i in range(n + 1):
            pts.append(p0 - Xf * (L / 2) + Xf * (i * pw * math.sin(beta)) + Zd * (amp * (0.5 if i % 2 else -0.5)))
        panels = []
        for i in range(n):
            a, b = pts[i], pts[i + 1]
            up = Yv
            if self.follow:
                # long strips settle onto the curve of the globe as they stand up
                wf = smooth((s1c - 0.5) / 0.5)
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
            panels.append((a, b, up))
        # keep every corner on or above the paper of the globe
        low = min(min(np.linalg.norm(q) for q in (a, b, a + up * ph, b + up * ph)) for a, b, up in panels) - 1.0
        lift = p0 * max(0.0, 0.003 - low)
        return panels, lift, ph, s1c


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

    def grow(self, k):
        self.span *= k
        self.alt *= k
        self.size *= k

    def sprite_widths(self):
        return [(self.spr.name, self.span * 0.5 / self.spr.aspect)]

    def emit(self, ctx):
        s, tau, act = self.state(ctx)
        if s <= 0.02:
            return
        k_ = self.cur_scale(ctx.t)
        a = self.ccw * (2 * math.pi * tau / self.period) + self.phase
        r = self.radius * (0.25 + 0.75 * s)
        lat = self.lat + r * math.sin(a)
        lon = self.lon + r * math.cos(a) / max(0.3, math.cos(math.radians(self.lat)))
        p, e, n = ll_frame(lat, lon)
        fwd = (-math.sin(a) * e + math.cos(a) * n) * self.ccw
        side = np.cross(p, fwd)
        alt = self.alt * k_ * math.sqrt(min(1.0, s)) * (1.0 + 0.08 * math.sin(tau * 2.1 + self.phase))
        wing = math.radians(18.0 + 34.0 * math.sin(tau * self.flap * 2 + self.phase * 3))
        L = self.span * k_ * 0.5 / self.spr.aspect       # body length (sprite width)
        hw = self.span * k_ * 0.5
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
