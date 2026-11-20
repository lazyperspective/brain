"""Camera, projection and plane-homography helpers (world units: 1.0 = one page width)."""
import numpy as np
import skia


def v3(*a):
    return np.array(a, dtype=np.float64)


def norm(v):
    v = np.asarray(v, dtype=np.float64)
    return v / (np.linalg.norm(v) + 1e-12)


class Camera:
    """Simple look-at pinhole camera that maps world -> supersampled pixel coordinates."""

    def __init__(self, eye, target, fov_deg, width, height, up=(0, 0, 1)):
        self.eye = np.asarray(eye, float)
        self.target = np.asarray(target, float)
        self.w, self.h = width, height
        f = norm(self.target - self.eye)
        r = norm(np.cross(f, up))
        u = np.cross(r, f)
        self.f, self.r, self.u = f, r, u
        focal = (height / 2) / np.tan(np.radians(fov_deg) / 2)
        R = np.stack([r, -u, f])  # rows: x right, y down, z forward
        t = -R @ self.eye
        K = np.array([[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1.0]])
        self.P = K @ np.hstack([R, t[:, None]])  # 3x4

    def project(self, pts):
        pts = np.atleast_2d(np.asarray(pts, float))
        h = np.hstack([pts, np.ones((len(pts), 1))]) @ self.P.T
        return h[:, :2] / h[:, 2:3], h[:, 2]

    def plane_h(self, O, ex, ey):
        """3x3 homography: local plane coords (a, b, 1) -> screen px (homogeneous)."""
        M = np.stack([np.append(ex, 0), np.append(ey, 0), np.append(O, 1)], axis=1)  # 4x3
        return self.P @ M

    def facing(self, O, n):
        """>0 when a plane through O with normal n shows its +n side to the camera."""
        return float(np.dot(self.eye - O, n))


def sk_matrix(H):
    H = np.asarray(H, float)
    H = H / H[2, 2]
    m = skia.Matrix()
    m.setAll(*[float(x) for x in H.reshape(-1)])
    return m


def tex_h(cam, O, ex, ey, u0, t1, tex):
    """Homography from texture pixels (x right, y down, origin = local (u0, t1)) to screen."""
    S = np.array([[1 / tex, 0, u0], [0, -1 / tex, t1], [0, 0, 1.0]])
    return cam.plane_h(O, ex, ey) @ S


def quad_h(src, dst):
    """Homography from 4 point correspondences (src Nx2 -> dst Nx2)."""
    import cv2
    return cv2.getPerspectiveTransform(np.asarray(src, np.float32), np.asarray(dst, np.float32)).astype(float)


def ray_plane(P, d, O, n):
    """Parameter tau so that P + tau*d lies on plane (O, n). Returns (tau, denom)."""
    den = float(np.dot(d, n))
    if abs(den) < 1e-9:
        return None, den
    return float(np.dot(O - P, n)) / den, den


# ---------------------------------------------------------------- easing
def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else float(x))


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def smoother(x):
    x = clamp01(x)
    return x * x * x * (x * (6 * x - 15) + 10)


def ramp(t, t0, t1):
    return clamp01((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t1)


def ease_io(x, p=2.2):
    x = clamp01(x)
    return 0.5 * (2 * x) ** p if x < 0.5 else 1 - 0.5 * (2 * (1 - x)) ** p


def ease_out(x, p=3.0):
    return 1 - (1 - clamp01(x)) ** p


def spring(t, freq=3.0, damp=5.0):
    """Damped spring step response 0 -> 1 with overshoot (t in seconds, t<0 -> 0)."""
    if t <= 0:
        return 0.0
    w = 2 * np.pi * freq
    return float(1 - np.exp(-damp * t) * (np.cos(w * t) + damp / w * np.sin(w * t)))
