"""Timeline, camera, globe orientation, geometry helpers."""
import math
import numpy as np
from scipy.interpolate import CubicSpline

FPS = 30
BPM = 96.0
BEAT = 60.0 / BPM              # 0.625 s
BAR = 3 * BEAT                 # 1.875 s, waltz time
DUR = 72.5                     # the film: 38 bars of music plus a short fade
NF = int(round(FPS * DUR))     # 2175 frames
W, H = 1920, 1080

ROLL = 11.0            # axis tilt (deg), north pole leans to screen-right
CAM_D = 7.0            # camera distance in globe radii
R_SCREEN = 0.70        # silhouette radius as a fraction of frame height at zoom 1 (the globe overflows the frame)
Z_WIDE = 0.47          # wide shots: the whole globe in frame at v1's size (radius ~0.33 of frame height)
DEG_PER_S = 6.0        # unit for durations still written in degrees of turn (v2 spun at 6 deg/s)

LIGHT = np.array([-0.50, 0.30, 0.81])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
RIM = np.array([0.80, 0.25, -0.55])
RIM = RIM / np.linalg.norm(RIM)

KEY_COL = np.array([0.72, 0.63, 0.47], np.float32)
AMB_COL = np.array([0.35, 0.36, 0.53], np.float32)
BOUNCE_COL = np.array([0.16, 0.07, 0.05], np.float32)   # warm glow from the low dusk sheets
RIM_COL = np.array([0.45, 0.70, 1.00], np.float32)


def bar(b):
    return b * BAR


# ---------------------------------------------------------------------------- the story
# Opening: a wide, plain globe. Montage: the camera swoops from place to place; each place blooms as the
# camera lands. Finale: pull back to the wide shot of the fully bloomed planet.
# Each stop: (name, arrive s, depart s, camera elev deg, zoom, look lat, look lon (absolute, deg east),
#             dlon (where the look point sits relative to the facing meridian), screen x, screen y)
# The look point is fixed on the globe during a stop; the globe keeps turning slowly underneath, so the
# camera orbits the place a little (the pieces show parallax) while it stays put on screen.
OPEN_END = 3.30                     # the plain wide hold ends, the first push-in begins
STOPS = [
    ('europe',     bar(4),  bar(4) + 4.05,   22.0, 1.30,  48.0,   12.0,   5.0, 0.50, 0.56),
    ('arctic',     bar(7),  bar(7) + 4.05,    4.0, 1.12,  47.0,  -37.0,  -6.0, 0.50, 0.60),
    ('samerica',   bar(10), bar(10) + 3.95,  -24.0, 1.20, -10.0,  -64.8,  -2.0, 0.50, 0.56),
    ('namerica',   bar(13), bar(13) + 3.95,   14.0, 1.20,  42.0, -100.0,  -3.0, 0.50, 0.56),
    ('whale',      bar(16), bar(16) + 7.80,  -10.0, 1.00,  27.0, -138.0,  -8.0, 0.50, 0.80),
    ('pacific',    bar(21), bar(21) + 3.90,  -32.0, 1.16,  -9.0, -161.8,   0.0, 0.50, 0.56),
    ('antarctica', bar(24), bar(24) + 3.90,  -64.0, 1.12, -56.0, -195.6,  -2.0, 0.50, 0.50),
    ('oceania',    bar(27), bar(27) + 2.30,  -44.0, 1.20, -29.0, -217.0,   3.0, 0.50, 0.56),
    ('eastasia',   bar(29), bar(29) + 2.45,    8.0, 1.34,  35.0, -241.0,   3.0, 0.50, 0.56),
    ('southasia',  bar(31), bar(32),          -2.0, 1.22,  24.0, -291.0,   3.0, 0.50, 0.56),
]
WIDE_IN = bar(34)                   # the camera settles on the final wide shot on the tonic
BREACH_PEAK = bar(18)               # the whale's leap tops out on a downbeat
WIDE_OPEN = (-10.0, 34.0)             # opening wide: camera elevation, facing longitude at t=0
WIDE_END = (-10.0, 25.0 - 360.0)     # final wide: camera elevation, facing longitude on arrival
SPIN_HOLD = 1.4                     # deg/s the globe turns during a stop
SPIN_WIDE = 2.2                     # deg/s during the wide shots
FINAL_WAVE = (bar(32) + 0.9, 2.8)   # start, spread (s): everything not yet open blooms during the pull-back
FADE_IN = 0.6
FADE_OUT = (DUR - 2.2, DUR)

STOP = {s[0]: s for s in STOPS}
HERO_T = {s[0]: s[1] for s in STOPS}        # arrival times (the soundtrack keys its ambience to them)
HERO_T['whale'] = BREACH_PEAK
HERO_T['ocean'] = None


def stop_face_time(name):
    """When a stop's pieces are staged to face the lens: a little after the camera lands."""
    s = STOP[name]
    return s[1] + min(1.6, 0.45 * (s[2] - s[1]))


_DT = 0.01
_T0 = -2.0
_TS = np.arange(_T0, DUR + 2.0, _DT)
CH_NAMES = ('elev', 'zoom', 'llat', 'llon', 'sx', 'sy', 'kw', 'lonc')




def smoother(u):
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)


def _raw(t):
    """Piecewise camera (before smoothing): holds drift linearly, moves are quintic eases with a zoom dip."""
    def hold_state(s, tt):
        name, ta, td, el, z, la, lo, dl, sx, sy = s
        tm = 0.5 * (ta + td)
        lonc = (lo - dl) - SPIN_HOLD * (tt - tm)
        zz = z * (1.0 + 0.035 * (tt - ta) / max(0.1, td - ta))     # a slow creep in while we look
        return np.array([el, zz, la, lo, sx, sy, 0.0, lonc])

    a = STOPS[0]
    # the plain opening: wide, centred on the globe, already looking at Europe's latitude for the push-in
    def wide_open(tt):
        return np.array([WIDE_OPEN[0], Z_WIDE, a[5], a[6], 0.5, 0.5, 1.0, WIDE_OPEN[1] - SPIN_WIDE * tt])

    def wide_end(tt):
        return np.array([WIDE_END[0], Z_WIDE * (1.0 - 0.025 * (tt - WIDE_IN) / (DUR - WIDE_IN)), 5.0, WIDE_END[1] + 0.0, 0.5, 0.5, 1.0,
                         WIDE_END[1] - SPIN_WIDE * (tt - WIDE_IN)])

    if t <= OPEN_END:
        return wide_open(t)
    if t < a[1]:
        A = wide_open(OPEN_END)
        B = hold_state(a, a[1])
        u = (t - OPEN_END) / (a[1] - OPEN_END)
        # the first push-in: the look blend leads, the zoom follows, so we glide toward Europe and then dive
        e = smoother(u)
        ez = smoother(min(1.0, u * 1.08))
        ek = smoother(min(1.0, u * 1.25))
        v = A + (B - A) * e
        v[1] = A[1] + (B[1] - A[1]) * ez ** 1.3
        v[6] = A[6] + (B[6] - A[6]) * ek
        return v
    for i, s in enumerate(STOPS):
        if t <= s[2]:
            return hold_state(s, t)
        nxt = STOPS[i + 1] if i + 1 < len(STOPS) else None
        if nxt is not None and t < nxt[1]:
            A = hold_state(s, s[2])
            B = hold_state(nxt, nxt[1])
            u = (t - s[2]) / (nxt[1] - s[2])
            e = smoother(u)
            v = A + (B - A) * e
            # swoop: pull back a little on the way, more for longer trips
            dist = math.degrees(math.acos(max(-1.0, min(1.0,
                math.sin(math.radians(s[5])) * math.sin(math.radians(nxt[5])) +
                math.cos(math.radians(s[5])) * math.cos(math.radians(nxt[5])) * math.cos(math.radians(s[6] - nxt[6]))))))
            dip = min(0.50, 0.10 + dist / 160.0)
            v[1] *= 1.0 - dip * math.sin(math.pi * u) ** 2
            return v
        if nxt is None and t < WIDE_IN:
            # finale: pull back to the whole globe while it turns on to Africa and Europe
            A = hold_state(s, s[2])
            B = wide_end(WIDE_IN)
            u = (t - s[2]) / (WIDE_IN - s[2])
            e = smoother(u)
            v = A + (B - A) * e
            ez = smoother(min(1.0, u * 1.12))
            v[1] = math.exp(math.log(A[1]) + (math.log(B[1]) - math.log(A[1])) * ez)
            ek = smoother((u - 0.10) / 0.90)
            v[6] = ek
            # the look point travels from South Asia to Africa while it blends out to the globe centre
            return v
    return wide_end(t)


def _build():
    raw = np.array([_raw(t) for t in _TS])
    out = np.empty_like(raw)
    n = len(_TS)
    from scipy.ndimage import gaussian_filter1d
    for c in range(raw.shape[1]):
        out[:, c] = gaussian_filter1d(raw[:, c], 0.14 / _DT, mode='nearest')
    return out


_CH = _build()
LON0 = WIDE_OPEN[1]    # facing longitude at t=0


def cam_keys(t):
    """Camera channels at film time t: a smooth function (cubic interpolation of a finely sampled table)."""
    x = (t - _T0) / _DT
    n = len(_TS)
    x = min(max(x, 1.0), n - 3.0)
    i = int(math.floor(x))
    f = x - i
    p0, p1, p2, p3 = _CH[i - 1], _CH[i], _CH[i + 1], _CH[i + 2]
    y = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)))
    return [float(v) for v in y]


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


BASE = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)  # local (x,y,z=north) -> world (x right, y up, z to camera)


def center_lon(t):
    return cam_keys(t)[7]


def globe_matrix(t):
    """3x3 matrix taking globe-local unit vectors to world."""
    lc = math.radians(center_lon(t))
    return rot_z(-math.radians(ROLL)) @ BASE @ rot_z(-lc)


def wrap180(a):
    return (a + 180.0) % 360.0 - 180.0


class Camera:
    def __init__(self, t, ss=2, w=W, h=H):
        tt = t
        elev, zoom, llat, llon, sx, sy, kw, lonc = cam_keys(tt)
        self.kw = kw
        self.zoom = zoom
        self.elev = elev
        e = math.radians(elev)
        self.back = np.array([0.0, math.sin(e), math.cos(e)])
        self.right = np.array([1.0, 0.0, 0.0])
        self.up = np.array([0.0, math.cos(e), -math.sin(e)])
        self.Wp, self.Hp = w * ss, h * ss
        self.f = R_SCREEN * h * ss * math.sqrt(CAM_D ** 2 - 1.0) * zoom
        self.cx, self.cy = self.Wp / 2.0, self.Hp / 2.0
        self.ss = ss
        # pan so the look point lands at (sx, sy) on screen
        p, _, _ = ll_frame(llat, llon)
        P = globe_matrix(tt) @ p * (1.0 - kw)        # wide shots look at the globe's centre
        zP = CAM_D - P @ self.back
        panx = P @ self.right - (sx * self.Wp - self.cx) * zP / self.f
        pany = P @ self.up - (self.cy - sy * self.Hp) * zP / self.f
        self.T = self.right * panx + self.up * pany
        self.C = self.T + self.back * CAM_D
        dc = np.linalg.norm(self.C)
        self.chat = self.C / dc
        self.dc = dc
        self.limb_k = 1.0 / dc           # plane p.chat = 1/dc contains the silhouette circle
        self.pan = (panx, pany)
        self.look = P

    def project(self, P):
        """P (...,3) world -> (...,2) screen px and depth (distance along view)."""
        d = P - self.C
        x = d @ self.right
        y = d @ self.up
        z = -(d @ self.back)
        z = np.maximum(z, 1e-3)
        return np.stack([self.cx + self.f * x / z, self.cy - self.f * y / z], -1), z

    def globe_disc(self):
        """Screen centre and radius of globe silhouette (approx circle)."""
        c, z = self.project(np.zeros(3))
        r = self.f / math.sqrt(self.dc ** 2 - 1.0)
        return c, r


def ll_frame(lat, lon):
    """Globe-local position (unit), east, north for lat/lon in degrees."""
    la, lo = math.radians(lat), math.radians(lon)
    cl, sl = math.cos(la), math.sin(la)
    co, so = math.cos(lo), math.sin(lo)
    p = np.array([cl * co, cl * so, sl])
    e = np.array([-so, co, 0.0])
    n = np.array([-sl * co, -sl * so, cl])
    return p, e, n


def spring(u, k=4.6, w=6.6):
    """Soft damped spring 0->1 with ~11% overshoot at u~0.48, settled at u=1."""
    if u <= 0:
        return 0.0
    if u >= 1:
        return 1.0
    win = (1 - u) ** 2 * (1 + 2 * u)  # smooth window to land exactly on 1
    return 1.0 - math.exp(-k * u) * (math.cos(w * u) + (k / w) * math.sin(w * u)) * (0.15 + 0.85 * win)


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


