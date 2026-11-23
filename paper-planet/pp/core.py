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
R_SCREEN = 0.315       # silhouette radius as a fraction of frame height at zoom 1

LIGHT = np.array([-0.50, 0.30, 0.81])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
RIM = np.array([0.80, 0.25, -0.55])
RIM = RIM / np.linalg.norm(RIM)

KEY_COL = np.array([0.72, 0.63, 0.47], np.float32)
AMB_COL = np.array([0.35, 0.36, 0.53], np.float32)
BOUNCE_COL = np.array([0.16, 0.07, 0.05], np.float32)   # warm glow from the low dusk sheets
RIM_COL = np.array([0.45, 0.70, 1.00], np.float32)

# camera keyframes: (time s, zoom, pan_x, pan_y (globe radii, screen right/up), elevation deg)
CAM_KEYS = [
    (0.0, 1.10, 0.00, 0.10, 1.0),      # Europe + Africa
    (7.0, 1.05, 0.00, 0.05, -2.0),     # Atlantic, Greenland aurora
    (13.5, 1.11, 0.00, 0.00, -8.0),    # South America
    (20.0, 1.11, 0.00, 0.09, 3.0),     # North America
    (26.0, 1.04, 0.00, 0.03, -3.0),
    (31.5, 1.03, 0.00, -0.02, -11.0),  # Pacific + Antarctica, whole planet
    (36.5, 1.05, 0.00, -0.05, -17.0),
    (41.0, 1.12, 0.00, -0.05, -19.0),  # Oceania (+ Japan on the rim)
    (46.5, 1.12, 0.00, 0.04, -7.0),    # China
    (51.5, 1.12, 0.00, 0.09, 1.0),     # India / Himalaya
    (56.0, 1.10, 0.00, 0.10, 2.0),
]


def _periodic(keys, col):
    t = np.array([k[0] for k in keys] + [keys[0][0] + DUR])
    v = np.array([k[col] for k in keys] + [keys[0][col]])
    return CubicSpline(t, v, bc_type='periodic')


_SPL = [_periodic(CAM_KEYS, i) for i in (1, 2, 3, 4)]


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
        zoom, panx, pany, elev = [float(s(tt)) for s in _SPL]
        self.zoom = zoom
        self.elev = elev
        e = math.radians(elev)
        self.back = np.array([0.0, math.sin(e), math.cos(e)])
        self.right = np.array([1.0, 0.0, 0.0])
        self.up = np.array([0.0, math.cos(e), -math.sin(e)])
        self.T = self.right * panx + self.up * pany
        self.C = self.T + self.back * CAM_D
        self.Wp, self.Hp = w * ss, h * ss
        self.f = R_SCREEN * h * ss * math.sqrt(CAM_D ** 2 - 1.0) * zoom
        self.cx, self.cy = self.Wp / 2.0, self.Hp / 2.0
        self.ss = ss
        dc = np.linalg.norm(self.C)
        self.chat = self.C / dc
        self.dc = dc
        self.limb_k = 1.0 / dc           # plane p.chat = 1/dc contains the silhouette circle
        self.pan = (panx, pany)

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
