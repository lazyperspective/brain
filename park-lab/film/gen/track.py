"""Turtle-style track builder for coasters, flumes and railways.

World frame: x east, y up, z south (metres).  Heading psi is measured in the
x-z plane from +x toward +z, so psi=0 -> east, psi=pi/2 -> south,
psi=-pi/2 -> north, psi=pi -> west.

A track is a dense list of samples (ds ~ 0.5 m) each carrying
position p, unit tangent T, unit up U (track normal, points from rail
to rider head) and a segment tag.
"""
import math
import numpy as np

G = 9.81
DS = 0.5


def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def euler_T(psi, phi):
    return np.array([math.cos(phi) * math.cos(psi), math.sin(phi), math.cos(phi) * math.sin(psi)])


def euler_U(psi, phi, roll):
    T = euler_T(psi, phi)
    U0 = np.array([-math.sin(phi) * math.cos(psi), math.cos(phi), -math.sin(phi) * math.sin(psi)])
    # right-hand vector (rider's right when U0 up): R0 = T x U0 ... rider faces T,
    # up U0 -> right = T x U0
    R0 = np.cross(T, U0)
    # positive roll = bank to the right side down? We define positive roll as
    # rotating the up vector toward the rider's right (track banks right-side-down,
    # i.e. a right-hand turn banks with positive roll).
    return U0 * math.cos(roll) + R0 * math.sin(roll)


class Track:
    def __init__(self, start, psi, phi=0.0, roll=0.0):
        self.p = np.array(start, dtype=float)
        self.psi = psi
        self.phi = phi
        self.roll = roll
        self.P = []      # positions
        self.T = []
        self.U = []
        self.tag = []
        self.rollmode = []   # 'auto' | 'fixed' | 'explicit'
        self.rollval = []
        self.psis = []
        self.phis = []
        self._emit(self.p.copy(), euler_T(psi, phi), None, 'start', 'fixed', roll)

    def _emit(self, p, T, U, tag, mode, rollv):
        self.P.append(np.array(p, float))
        self.T.append(np.array(T, float))
        self.U.append(None if U is None else np.array(U, float))
        self.tag.append(tag)
        self.rollmode.append(mode)
        self.rollval.append(rollv)
        self.psis.append(self.psi)
        self.phis.append(self.phi)

    # generic smooth element ------------------------------------------------
    def seg(self, L, dpsi=0.0, phi_to=None, roll_to=None, tag='track', auto_roll=False, climb=None):
        """Advance by arc length L.  dpsi (deg) heading change, phi_to (deg) final pitch,
        roll_to (deg) final roll (explicit), or auto_roll for physics banking.
        climb: if given (metres), pitch is shaped as a hill so that the element
        changes height by ~climb (used for simple hills)."""
        n = max(2, int(round(L / DS)))
        ds = L / n
        psi0, phi0, roll0 = self.psi, self.phi, self.roll
        dpsi = math.radians(dpsi)
        phi1 = phi0 if phi_to is None else math.radians(phi_to)
        roll1 = roll0 if roll_to is None else math.radians(roll_to)
        for i in range(1, n + 1):
            u0 = (i - 0.5) / n
            u = i / n
            psi_m = psi0 + dpsi * smooth(u0)
            phi_m = phi0 + (phi1 - phi0) * smooth(u0)
            self.p = self.p + euler_T(psi_m, phi_m) * ds
            self.psi = psi0 + dpsi * smooth(u)
            self.phi = phi0 + (phi1 - phi0) * smooth(u)
            self.roll = roll0 + (roll1 - roll0) * smooth(u)
            mode = 'auto' if auto_roll else 'fixed'
            self._emit(self.p.copy(), euler_T(self.psi, self.phi), None, tag, mode, self.roll)
        return self

    def ramp(self, y_target, angle, trans=10.0, tag='track', end_phi=0.0):
        """Pitch from the current pitch (assumed ~0) to +-angle, hold, then back to end_phi so
        that the height ends at y_target (approximately exact)."""
        dy = y_target - self.p[1]
        a = math.radians(abs(angle)) * (1 if dy >= 0 else -1)
        us = (np.arange(200) + 0.5) / 200
        sm = us * us * (3 - 2 * us)
        rise_in = trans * np.mean(np.sin(self.phi + (a - self.phi) * sm))
        rise_out = trans * np.mean(np.sin(a + (math.radians(end_phi) - a) * sm))
        k = (dy - rise_in - rise_out) / math.sin(a)
        if k < 0.5:
            k = 0.5
        self.seg(trans, phi_to=math.degrees(a), tag=tag)
        self.seg(k, tag=tag)
        self.seg(trans, phi_to=end_phi, tag=tag)
        return self

    def straight(self, L, tag='track'):
        return self.seg(L, tag=tag)

    def turn(self, deg, radius, tag='turn', phi_to=None, roll_to=None, auto_roll=True):
        L = abs(math.radians(deg)) * radius * 1.25   # smoothstep spends extra length
        return self.seg(L, dpsi=deg, phi_to=phi_to, roll_to=roll_to, tag=tag, auto_roll=auto_roll)

    # vertical loop (teardrop-ish) --------------------------------------------
    def loop(self, L, lateral=4.0, tag='loop'):
        n = int(round(L / DS))
        ds = L / n
        psi = self.psi
        p0 = self.p.copy()
        right_h = np.array([-math.sin(psi), 0, math.cos(psi)])  # horizontal right (heading psi rotated +90)
        phi = 0.0
        acc = p0.copy()
        for i in range(1, n + 1):
            u0 = (i - 0.5) / n
            u = i / n
            phim = 2 * math.pi * (u0 - math.sin(2 * math.pi * u0) / (2 * math.pi))
            acc = acc + euler_T(psi, phim) * ds
            lat = lateral * smooth(u)
            p = acc + right_h * lat
            phi = 2 * math.pi * (u - math.sin(2 * math.pi * u) / (2 * math.pi))
            T = euler_T(psi, phi)
            # include the lateral drift derivative in T
            dlat = lateral * 6 * u * (1 - u) / L
            T = T + right_h * dlat
            T /= np.linalg.norm(T)
            U = euler_U(psi, phi, 0.0)
            U = U - T * np.dot(U, T)
            U /= np.linalg.norm(U)
            self.phi = phi
            self._emit(p, T, U, tag, 'explicit', 0.0)
        self.p = self.P[-1].copy()
        self.phi = 0.0
        return self

    # corkscrew: rotate track around a horizontal axis r above the entry point --
    def corkscrew(self, length_axis, radius, right_hand=True, tag='corkscrew'):
        psi = self.psi
        d = euler_T(psi, 0.0)
        up = np.array([0.0, 1.0, 0.0])
        side = np.array([-math.sin(psi), 0, math.cos(psi)])  # right
        if not right_hand:
            side = -side
        p0 = self.p.copy()
        axis0 = p0 + up * radius
        # approx arc length to choose sample count
        L = math.hypot(length_axis, 2 * math.pi * radius)
        n = int(round(L / DS))
        pts = []
        for i in range(1, n + 1):
            u = i / n
            th = 2 * math.pi * smooth(u) * 1.0
            # blend so ends are tangent: use smoothstep for angle, linear for axis
            a = axis0 + d * (length_axis * u)
            radial = -up * math.cos(th) + side * math.sin(th)  # from axis to track
            p = a + radial * radius
            pts.append((p, -radial))
        for i, (p, Uin) in enumerate(pts):
            pa = pts[max(i - 1, 0)][0] if i > 0 else p0
            pb = pts[min(i + 1, n - 1)][0]
            T = pb - pa
            T /= np.linalg.norm(T)
            U = Uin - T * np.dot(Uin, T)
            U /= np.linalg.norm(U)
            self._emit(p, T, U, tag, 'explicit', 0.0)
        self.p = self.P[-1].copy()
        self.phi = 0.0
        self.roll = 0.0
        return self

    def close_to(self, target, psi_target, tag='track', handle=None, phi_end=0.0):
        """Cubic Bezier from current pose to target pose (both horizontal-ish)."""
        p0 = self.p.copy()
        p3 = np.array(target, float)
        t0 = euler_T(self.psi, self.phi)
        t3 = euler_T(psi_target, math.radians(phi_end))
        dist = np.linalg.norm(p3 - p0)
        h = handle or dist / 3
        p1 = p0 + t0 * h
        p2 = p3 - t3 * h
        # resample uniformly
        us = np.linspace(0, 1, 2000)
        B = ((1 - us) ** 3)[:, None] * p0 + (3 * (1 - us) ** 2 * us)[:, None] * p1 + \
            (3 * (1 - us) * us ** 2)[:, None] * p2 + (us ** 3)[:, None] * p3
        seglen = np.linalg.norm(np.diff(B, axis=0), axis=1)
        cum = np.concatenate([[0], np.cumsum(seglen)])
        L = cum[-1]
        n = max(2, int(round(L / DS)))
        for i in range(1, n + 1):
            s = L * i / n
            j = min(np.searchsorted(cum, s), len(B) - 1)
            p = B[j]
            jn = min(j + 1, len(B) - 1)
            jp = max(j - 1, 0)
            T = B[jn] - B[jp]
            T /= np.linalg.norm(T)
            self.psi = math.atan2(T[2], T[0])
            self.phi = math.asin(max(-1, min(1, T[1])))
            self._emit(p.copy(), T, None, tag, 'auto', 0.0)
        self.p = self.P[-1].copy()
        self.psi = psi_target
        self.phi = math.radians(phi_end)
        return self

    # ------------------------------------------------------------------------
    def finish(self, closed=True, v_profile=None, bank_scale=1.0, max_bank=75.0, smooth_sigma=4.0):
        P = np.array(self.P)
        T = np.array(self.T)
        n = len(P)
        seglen = np.linalg.norm(np.diff(P, axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seglen)])
        self.s = s
        self.Parr = P
        self.Tarr = T
        tags = np.array(self.tag)
        tags[0] = tags[1]
        self.tags = tags
        # speed
        v = v_profile(self) if v_profile else np.full(n, 10.0)
        self.v = v
        # auto roll from horizontal curvature
        psis = np.unwrap(np.array([math.atan2(t[2], t[0]) for t in T]))
        dpsi = np.gradient(psis, s)
        dpsi = gaussian_1d(dpsi, int(3 / DS))
        roll = np.array(self.rollval, float)
        mode = np.array(self.rollmode)
        horiz = np.sqrt(T[:, 0] ** 2 + T[:, 2] ** 2)
        auto = np.arctan(bank_scale * v ** 2 * dpsi * horiz / G)
        auto = np.clip(auto, -math.radians(max_bank), math.radians(max_bank))
        target = np.where(mode == 'auto', auto, roll)
        # smooth roll except inside explicit elements
        sig = int(smooth_sigma / DS)
        rs = gaussian_1d(target, sig)
        U = np.zeros_like(T)
        for i in range(n):
            if mode[i] == 'explicit' and self.U[i] is not None:
                U[i] = self.U[i]
            else:
                psi = math.atan2(T[i, 2], T[i, 0])
                phi = math.asin(max(-1, min(1, T[i, 1])))
                U[i] = euler_U(psi, phi, rs[i])
        # blend U across explicit boundaries to avoid kinks
        U = blend_frames(U, T, mode, int(3 / DS))
        self.Uarr = U
        self.rollarr = rs
        return self

    def length(self):
        return self.s[-1]


def gaussian_1d(a, sig):
    if sig <= 0:
        return a.copy()
    k = np.arange(-3 * sig, 3 * sig + 1)
    w = np.exp(-0.5 * (k / sig) ** 2)
    w /= w.sum()
    pad = np.concatenate([np.full(3 * sig, a[0]), a, np.full(3 * sig, a[-1])])
    return np.convolve(pad, w, mode='valid')


def blend_frames(U, T, mode, win):
    U = U.copy()
    n = len(U)
    for i in range(n):
        U[i] = U[i] - T[i] * np.dot(U[i], T[i])
        nn = np.linalg.norm(U[i])
        U[i] = U[i] / nn if nn > 1e-6 else np.array([0, 1, 0])
    return U


def energy_speed(track, segs_speed, mu=0.018, drag=0.00035, v_station=1.5):
    """segs_speed: dict tag -> ('fixed', v) for powered sections or ('brake', vtarget, decel)."""
    P = track.Parr
    s = track.s
    n = len(P)
    v = np.zeros(n)
    tags = track.tags
    cur = v_station
    for i in range(n):
        tg = tags[i]
        rule = segs_speed.get(tg)
        if i == 0:
            v[i] = cur
            continue
        ds = s[i] - s[i - 1]
        dh = P[i, 1] - P[i - 1, 1]
        if rule and rule[0] == 'fixed':
            target = rule[1]
            # accelerate/decelerate gently toward target
            if cur < target:
                cur = min(target, math.sqrt(cur ** 2 + 2 * 1.5 * ds))
            else:
                cur = max(target, math.sqrt(max(cur ** 2 - 2 * 3.0 * ds, 0)))
        else:
            e = cur ** 2 - 2 * G * dh - 2 * (mu * G + drag * cur ** 2) * ds
            cur = math.sqrt(max(e, 0.04))
            if rule and rule[0] == 'brake':
                vt, dec = rule[1], rule[2]
                if cur > vt:
                    cur = max(vt, math.sqrt(max(cur ** 2 - 2 * dec * ds, 0)))
        v[i] = cur
    return v
