"""Timeline, camera, globe orientation, geometry helpers."""
import math
import numpy as np
from scipy.interpolate import CubicSpline

FPS = 30
DUR = 60.0
NF = int(FPS * DUR)
W, H = 1920, 1080

LON0 = 20.0            # longitude facing the camera at t=0
ROLL = 11.0            # axis tilt (deg), north pole leans to screen-right
CAM_D = 7.0            # camera distance in globe radii
R_SCREEN = 0.70        # silhouette radius as a fraction of frame height at zoom 1 (the globe overflows the frame)

LIGHT = np.array([-0.50, 0.30, 0.81])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
RIM = np.array([0.80, 0.25, -0.55])
RIM = RIM / np.linalg.norm(RIM)

KEY_COL = np.array([0.72, 0.63, 0.47], np.float32)
AMB_COL = np.array([0.35, 0.36, 0.53], np.float32)
BOUNCE_COL = np.array([0.16, 0.07, 0.05], np.float32)   # warm glow from the low dusk sheets
RIM_COL = np.array([0.45, 0.70, 1.00], np.float32)

# ---------------------------------------------------------------------------- camera
# The camera visits each region in turn. Every key says when a region is the hero, which latitude the
# camera orbits to (so the region sits a little north of the point nearest the lens, where standing cards
# face it), which point of the globe it looks at, where that point lands on screen, and a slight zoom.
# (time s, region, elev deg, zoom, look lat, look dlon (deg east of the centre meridian), screen x, screen y)
HERO = [
    (4.0, 'europe', 22.0, 1.05, 48.0, 16.0, 0.50, 0.56),
    (8.5, 'arctic', 4.0, 1.00, 47.0, -6.0, 0.50, 0.60),
    (13.8, 'samerica', -24.0, 1.05, -10.0, -2.0, 0.50, 0.56),
    (19.5, 'namerica', 14.0, 1.05, 42.0, -3.0, 0.50, 0.56),
    (25.0, 'whale', -10.0, 1.00, 27.0, -8.0, 0.50, 0.80),
    (30.3, 'pacific', -32.0, 1.04, -9.0, 0.0, 0.50, 0.56),
    (35.6, 'antarctica', -64.0, 1.04, -56.0, -2.0, 0.50, 0.50),
    (40.5, 'oceania', -44.0, 1.05, -29.0, 6.0, 0.50, 0.56),
    (48.3, 'eastasia', 6.0, 1.05, 37.0, 21.0, 0.50, 0.56),
    (52.8, 'southasia', -2.0, 1.04, 24.0, 6.0, 0.50, 0.56),
    (57.4, 'africa', -20.0, 1.05, -2.0, -14.0, 0.50, 0.56),
]
HERO_T = {k[1]: k[0] for k in HERO}
HERO_T['ocean'] = None


_DT = 0.02
_TS = np.arange(0.0, DUR, _DT)


def _channel(keys, col, sigma=1.4):
    """Eased moves between keys, then a circular Gaussian so the camera never stops dead or overshoots."""
    ks = sorted(keys, key=lambda k: k[0])
    t = np.array([k[0] for k in ks] + [ks[0][0] + DUR])
    v = np.array([k[col] for k in ks] + [ks[0][col]], float)
    tt = (_TS - t[0]) % DUR + t[0]
    i = np.clip(np.searchsorted(t, tt, side='right') - 1, 0, len(ks) - 1)
    u = (tt - t[i]) / (t[i + 1] - t[i])
    e = 0.5 - 0.5 * np.cos(np.pi * u)
    y = v[i] + (v[i + 1] - v[i]) * e
    n = len(y)
    fr = np.fft.rfftfreq(n, _DT)
    y = np.fft.irfft(np.fft.rfft(y) * np.exp(-0.5 * (2 * np.pi * fr * sigma) ** 2), n=n)
    return y


_CH = np.stack([_channel(HERO, i) for i in (2, 3, 4, 5, 6, 7)], 1)


def cam_keys(t):
    """(elev, zoom, look_lat, look_dlon, sx, sy) at loop time t: a smooth periodic function of t
    (cubic interpolation of a periodic table, so frame 1800 is frame 0 exactly)."""
    x = (t % DUR) / _DT
    i = int(math.floor(x))
    f = x - i
    n = len(_TS)
    p0, p1, p2, p3 = _CH[(i - 1) % n], _CH[i % n], _CH[(i + 1) % n], _CH[(i + 2) % n]
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
    return LON0 - 360.0 * t / DUR


def globe_matrix(t):
    """3x3 matrix taking globe-local unit vectors to world."""
    lc = math.radians(center_lon(t))
    return rot_z(-math.radians(ROLL)) @ BASE @ rot_z(-lc)


def wrap180(a):
    return (a + 180.0) % 360.0 - 180.0


class Camera:
    def __init__(self, t, ss=2, w=W, h=H):
        tt = t % DUR
        elev, zoom, llat, ldlon, sx, sy = cam_keys(tt)
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
        p, _, _ = ll_frame(llat, center_lon(tt) + ldlon)
        P = globe_matrix(tt) @ p
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


def smoother(u):
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)
