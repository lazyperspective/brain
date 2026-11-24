# 2D effects that interact with the plate: particle bursts (snow puffs, hay bits, sparks, dust), the camera flash, light
# flicker. Particles live in a stable "surface" coordinate frame (usually the shot's track reference frame) and are mapped to
# the screen per frame, so they stick to the world like the character does.
import numpy as np, cv2, math
SIZE_MUL = 2.3      # v4: particles read at phone size


class Burst:
    def __init__(self, t0, origin, n, speed, angle=(-180, 180), up=0.0, gravity=900.0, drag=2.0, life=(0.3, 0.7), size=(1.5, 3.5),
                 col=(1, 1, 1), kind='dot', seed=0, alpha=0.9, puff=0.0, puff_r=30.0, spin=0.0):
        rng = np.random.default_rng(seed)
        self.t0, self.kind, self.col, self.alpha, self.g, self.drag = t0, kind, np.array(col, np.float32), alpha, gravity, drag
        a = np.radians(rng.uniform(angle[0], angle[1], n)); s = rng.uniform(speed[0], speed[1], n)
        self.v0 = np.stack([np.cos(a) * s, np.sin(a) * s - up], 1)
        self.p0 = np.array(origin, float)[None] + rng.normal(0, 2.0, (n, 2))
        self.life = rng.uniform(life[0], life[1], n); self.size = rng.uniform(size[0], size[1], n)
        self.rot0 = rng.uniform(0, 2 * np.pi, n); self.spin = rng.normal(0, spin, n) if spin else np.zeros(n)
        self.puff, self.puff_r, self.origin = puff, puff_r, np.array(origin, float)

    def state(self, t):
        """positions (n,2), velocities (n,2), age fraction (n,), alive mask"""
        dt = t - self.t0
        if dt < 0: return None
        k = self.drag
        e = math.exp(-k * dt)
        # v' = -k v + g  ->  closed form
        g = np.array([0, self.g])
        v = self.v0 * e + g / k * (1 - e)
        p = self.p0 + self.v0 * (1 - e) / k + g / k * dt - g / k ** 2 * (1 - e)
        age = dt / self.life
        return p, v, age, age < 1


def draw_bursts(img, bursts, t, to_screen, scale=1.0, shutter=0.5):
    """to_screen(points (n,2) in surface coords) -> screen (n,2). scale: px multiplier for sizes (e.g. push-in)."""
    H, W = img.shape[:2]
    for b in bursts:
        st = b.state(t)
        if st is None: continue
        p, v, age, alive = st
        if b.puff > 0 and t - b.t0 < 0.6:      # soft cloud at the origin
            u = (t - b.t0) / 0.6; c = to_screen(b.origin[None])[0]; r = b.puff_r * (0.5 + 1.2 * u) * scale * 1.5
            x0, y0, x1, y1 = int(max(0, c[0] - 3 * r)), int(max(0, c[1] - 3 * r)), int(min(W, c[0] + 3 * r)), int(min(H, c[1] + 3 * r))
            if x1 > x0 and y1 > y0:
                yy, xx = np.mgrid[y0:y1, x0:x1]; m = np.exp(-(((xx - c[0]) ** 2 + ((yy - c[1]) * 1.6) ** 2) / (r * r))) * b.puff * (1 - u) ** 1.5
                img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - m[..., None]) + b.col * m[..., None]
        if not alive.any(): continue
        P = to_screen(p[alive]); P2 = to_screen(p[alive] + v[alive] / 30.0 * shutter)
        a = (1 - age[alive]) ** 1.2 * b.alpha; sz = b.size[alive] * scale * SIZE_MUL
        for i in range(len(P)):
            r = max(0.6, sz[i]); x, y = P[i]; x2, y2 = P2[i]
            if not (-20 < x < W + 20 and -20 < y < H + 20): continue
            pad = int(r * 3 + abs(x2 - x) + abs(y2 - y) + 3)
            X0, Y0 = int(min(x, x2)) - pad, int(min(y, y2)) - pad; X1, Y1 = int(max(x, x2)) + pad, int(max(y, y2)) + pad
            X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
            if X1 <= X0 or Y1 <= Y0: continue
            m = np.zeros((Y1 - Y0, X1 - X0), np.float32)
            if b.kind == 'stick':     # hay bits: short tumbling segments
                th = b.rot0[alive][i] + b.spin[alive][i] * (t - b.t0); L = r * 2.2
                dx, dy = math.cos(th) * L, math.sin(th) * L
                cv2.line(m, (int((x - dx - X0) * 16), int((y - dy - Y0) * 16)), (int((x + dx - X0) * 16), int((y + dy - Y0) * 16)), 1.0, max(1, int(r * 0.55)), cv2.LINE_AA, 4)
            else:
                cv2.line(m, (int((x - X0) * 16), int((y - Y0) * 16)), (int((x2 - X0) * 16), int((y2 - Y0) * 16)), 1.0, max(1, int(round(r))), cv2.LINE_AA, 4)
                if b.kind == 'dot': m = cv2.GaussianBlur(m, (0, 0), max(0.5, r * 0.35))
            m = np.clip(m, 0, 1) * a[i]
            reg = img[Y0:Y1, X0:X1]
            if b.kind == 'spark':     # additive, hot core
                glow = cv2.GaussianBlur(m, (0, 0), 2.5)
                reg += b.col * m[..., None] * 1.2 + np.array([0.35, 0.75, 1.0], np.float32) * glow[..., None] * 0.6
                np.clip(reg, 0, 1, out=reg)
            else:
                reg[:] = reg * (1 - m[..., None]) + b.col * m[..., None]


def flash(img, at, k, radius=260.0):
    """camera flash fired toward us from plate point `at`: k 0..1 (1 = the burst frame). A hot core + a broad bloom that
    washes the frame, a short horizontal streak, all in linear light."""
    if k <= 0.002: return img
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = xx - at[0], yy - at[1]
    r2 = dx * dx + dy * dy
    core = np.exp(-r2 / (radius * 0.18) ** 2)
    bloom = np.exp(-r2 / (radius * 1.6) ** 2)
    streak = np.exp(-(dy / (radius * 0.035)) ** 2) * np.exp(-np.abs(dx) / (radius * 2.2))
    lin = np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)
    add = (core * 6 + bloom * 1.4 + streak * 1.5) * k + 0.9 * k ** 1.5
    tint = np.array([1.0, 0.98, 0.95], np.float32)      # BGR: a touch cool-white
    lin = lin * (1 + 0.6 * k) + add[..., None] * tint
    lin = lin / (1 + lin * 0.25 * k)                   # soft shoulder so the burst blooms rather than clips flat
    out = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.maximum(lin, 0) ** (1 / 2.4) - 0.055)
    img[:] = np.clip(out, 0, 1)
    return img
