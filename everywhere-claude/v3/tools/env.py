# Image-based lighting from the plate itself. For each frame we build a small equirectangular environment (world coords of
# the plate camera, three.js convention) from the tone-mapped plate: directions inside the frame sample the (blurred) plate,
# directions outside it come from the plate's colour-vs-elevation profile (sky above, ground below), with the photographer's
# side slightly desaturated. A key light (direction, colour, strength) is derived from the environment's dominant lobe.
import numpy as np, cv2, math, base64, os

PROXY = '/home/user/brain/everywhere-claude/work/proxy'
EW, EH = 64, 32


def s2l(x): return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
def l2s(x): x = np.maximum(x, 0); return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def env_dirs():
    j, i = np.meshgrid(np.arange(EW), np.arange(EH))
    u = (j + 0.5) / EW; v = 1 - (i + 0.5) / EH
    phi = (u - 0.5) * 2 * np.pi; lat = (v - 0.5) * np.pi
    d = np.stack([np.cos(lat) * np.cos(phi), np.sin(lat), np.cos(lat) * np.sin(phi)], -1)
    return d, np.cos(lat)


DIRS, SOLID = env_dirs()


def build(plate, cam, mods=None, min_fov=60.0):
    """plate: BGR float 0..1 (any size, 9:16), cam: rig.Cam. Returns dict(url, key, keyDir, keyCol, rim, mean).
    Telephoto plates see only a sliver of the world; they are spread over at least min_fov (vertical) so the character is
    lit by surroundings that look like what the lens shows around it."""
    if cam.fov < min_fov:
        import rig; cam = rig.Cam(min_fov, pitch=cam.pitch, roll=cam.roll, yaw=cam.yaw)
    sm = cv2.resize(plate.astype(np.float32), (90, 160), interpolation=cv2.INTER_AREA)
    sm = cv2.GaussianBlur(sm, (0, 0), 2.0)
    lin = s2l(np.clip(sm[..., ::-1], 0, 1)).astype(np.float32)          # RGB linear
    h, w = lin.shape[:2]; W, H = 1080, 1920
    # world direction of every plate sample -> elevation profile
    us = (np.arange(w) + 0.5) / w * W; vs = (np.arange(h) + 0.5) / h * H
    U, V = np.meshgrid(us, vs)
    dc = np.stack([(U - W / 2) / cam.f, -(V - H / 2) / cam.f, -np.ones_like(U)], -1)
    dw = dc @ cam.R.T; dw /= np.linalg.norm(dw, axis=-1, keepdims=True)
    el = np.degrees(np.arcsin(np.clip(dw[..., 1], -1, 1)))
    nb = 36; edges = np.linspace(-90, 90, nb + 1); idx = np.clip(np.digitize(el, edges) - 1, 0, nb - 1)
    prof = np.zeros((nb, 3)); cnt = np.zeros(nb)
    np.add.at(prof, idx.ravel(), lin.reshape(-1, 3)); np.add.at(cnt, idx.ravel(), 1)
    ok = cnt > 3
    prof[ok] /= cnt[ok, None]
    okI = np.nonzero(ok)[0]
    top, bot = okI.max(), okI.min()
    for b in range(nb):
        if ok[b]: continue
        if b > top: prof[b] = prof[top]                     # above everything seen: the sky
        elif b < bot: prof[b] = prof[bot] * 0.85            # below: the ground, a little darker
        else:
            lo = okI[okI < b].max(); hi = okI[okI > b].min(); a = (b - lo) / (hi - lo); prof[b] = prof[lo] * (1 - a) + prof[hi] * a
    ctr = (edges[:-1] + edges[1:]) / 2
    del_el = np.degrees(np.arcsin(DIRS[..., 1]))
    env = np.stack([np.interp(del_el, ctr, prof[:, c]) for c in range(3)], -1)
    # photographer's side: desaturate a little
    fwd = cam.R @ np.array([0, 0, -1.0])
    back = np.clip(-(DIRS @ fwd), 0, 1)[..., None]
    lum = (env * [0.2126, 0.7152, 0.0722]).sum(-1, keepdims=True)
    env = env * (1 - 0.3 * back) + lum * 0.3 * back
    # inside the frame: the plate itself
    c = DIRS @ cam.R                                       # world -> camera
    front = c[..., 2] < -1e-3
    pu = W / 2 + cam.f * c[..., 0] / np.maximum(-c[..., 2], 1e-3)
    pv = H / 2 - cam.f * c[..., 1] / np.maximum(-c[..., 2], 1e-3)
    inside = front & (pu >= 0) & (pu < W) & (pv >= 0) & (pv < H)
    wgt = np.clip(np.minimum.reduce([pu, W - pu, pv * 0.5625, (H - pv) * 0.5625]) / (0.15 * W), 0, 1) * inside
    mx = (pu / W * w - 0.5).astype(np.float32); my = (pv / H * h - 0.5).astype(np.float32)
    samp = cv2.remap(lin, np.where(inside, mx, 0).astype(np.float32), np.where(inside, my, 0).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    env = env * (1 - wgt[..., None]) + samp * wgt[..., None]
    if mods: env = mods(env, DIRS)
    # soft blur with horizontal wrap
    pad = np.concatenate([env[:, -8:], env, env[:, :8]], 1).astype(np.float32)
    pad = cv2.GaussianBlur(pad, (0, 0), 1.2); env = pad[:, 8:-8]
    # dominant lobe -> key light
    L = (env * [0.2126, 0.7152, 0.0722]).sum(-1) * SOLID
    vec = (L[..., None] * DIRS).sum((0, 1)); tot = L.sum() + 1e-9
    dom = float(np.linalg.norm(vec) / tot); kd = vec / (np.linalg.norm(vec) + 1e-9)
    # colour of the brightest region (top 6% of texels by luminance)
    Lp = (env * [0.2126, 0.7152, 0.0722]).sum(-1); thr = np.quantile(Lp, 0.94)
    kc = env[Lp >= thr].mean(0); kc = kc / max(kc.max(), 1e-6)
    mean = (env * SOLID[..., None]).sum((0, 1)) / SOLID.sum()
    img = (np.clip(l2s(env), 0, 1) * 255 + 0.5).astype(np.uint8)[..., ::-1]
    ok, png = cv2.imencode('.png', img)
    url = 'data:image/png;base64,' + base64.b64encode(png.tobytes()).decode()
    hexc = lambda c: '#%02x%02x%02x' % tuple(int(x) for x in np.clip(l2s(np.asarray(c)), 0, 1) * 255)
    return dict(url=url, dom=dom, keyDir=[float(x) for x in kd], keyCol=hexc(kc), rim=hexc(mean / max(mean.max(), 1e-6) * 0.9), mean=mean.tolist(), env=env)


class Proxy:
    """sequential/random access to the 540x960 tone-mapped proxy frames (BGR float)"""
    def __init__(self, clip):
        self.cap = cv2.VideoCapture(f'{PROXY}/{clip}.mp4'); self.cache = {}

    def get(self, t):
        k = int(round(t * 30))
        if k not in self.cache:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, k); ok, f = self.cap.read()
            if not ok:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, k - 2); ok, f = self.cap.read()
            self.cache[k] = f.astype(np.float32) / 255.0
            if len(self.cache) > 40: self.cache.pop(next(iter(self.cache)))
        return self.cache[k]


def light(e, envK=1.0, keyK=1.1, emK=0.12, rimK=0.22, extra=None):
    """rig light dict from an env result"""
    L = dict(envK=envK, key=float(keyK * e['dom']), keyDir=e['keyDir'], keyCol=e['keyCol'], rim=e['rim'], rimK=rimK, emK=emK)
    if extra: L.update(extra)
    return L


class EnvSeq:
    """per-film-frame env for a shot: src_time(i) -> source time, cam(i) -> rig.Cam; recomputed every `every` frames"""
    def __init__(self, clip, every=2):
        self.px = Proxy(clip); self.every = every; self.last = None; self.lastk = None

    def at(self, i, src_t, cam, mods=None, force=False):
        if force or self.last is None or i - self.lastk >= self.every:
            self.last = build(self.px.get(src_t), cam, mods); self.lastk = i
        return self.last


def preview_env(e, path):
    img = (np.clip(l2s(e['env']), 0, 1) * 255).astype(np.uint8)[..., ::-1]
    cv2.imwrite(path, cv2.resize(img, (512, 256), interpolation=cv2.INTER_NEAREST))
