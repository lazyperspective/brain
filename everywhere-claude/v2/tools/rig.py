# Python side of the rig: plate camera math, job building, render dispatch, layer loading.
import numpy as np, json, os, subprocess, math, cv2

CHAR = '/home/user/brain/everywhere-claude/char'
W, H = 1080, 1920
BW, BH, BD, FOOT = 14, 13, 16, 3
TOP = FOOT + BH


def rot_yxz(pitch, yaw, roll):
    """three.js Euler 'YXZ' (degrees): R = Ry(yaw) Rx(pitch) Rz(roll)"""
    p, y, r = np.radians([pitch, yaw, roll])
    Rx = np.array([[1, 0, 0], [0, np.cos(p), -np.sin(p)], [0, np.sin(p), np.cos(p)]])
    Ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
    Rz = np.array([[np.cos(r), -np.sin(r), 0], [np.sin(r), np.cos(r), 0], [0, 0, 1]])
    return Ry @ Rx @ Rz


class Cam:
    """plate camera at the origin looking down -z (three.js), pitch>0 looks up, roll>0 rotates the view counter-clockwise."""
    def __init__(self, fov, pitch=0.0, roll=0.0, yaw=0.0):
        self.fov, self.pitch, self.roll, self.yaw = fov, pitch, roll, yaw
        self.f = (H / 2) / math.tan(math.radians(fov) / 2)
        self.R = rot_yxz(pitch, yaw, roll)          # camera -> world

    def ray(self, u, v):
        d = np.array([(u - W / 2) / self.f, -(v - H / 2) / self.f, -1.0])
        d = self.R @ d
        return d / np.linalg.norm(d)

    def unproject(self, u, v, dist):
        return self.ray(u, v) * dist

    def project(self, P):
        c = self.R.T @ np.asarray(P, float)
        return np.array([W / 2 + self.f * c[0] / -c[2], H / 2 - self.f * c[1] / -c[2]])

    def dist_for(self, u, v, unit_px):
        """distance so that 1 character unit spans unit_px pixels at screen point (u,v)"""
        d = np.array([(u - W / 2) / self.f, -(v - H / 2) / self.f, -1.0])
        return self.f * np.linalg.norm(d) / unit_px

    def as_json(self):
        return dict(fov=self.fov, pitch=self.pitch, roll=self.roll, yaw=self.yaw)


def place(cam, u, v, unit_px, yaw_rel=0.0, body_rot=(0, 0), up=None):
    """world position for the root at screen (u,v) with the given scale; yaw_rel 0 = facing the camera,
    +90 = facing screen-right (camera roll aware). Returns (pos, rot[pitch,yaw,roll]) for the job."""
    dist = cam.dist_for(u, v, unit_px)
    P = cam.unproject(u, v, dist)
    # yaw that faces the camera: char +z points toward -P (horizontal)
    th0 = math.degrees(math.atan2(-P[0], -P[2]))
    return P, [body_rot[0], th0 + yaw_rel, body_rot[1]]


def crop_for(cam, P, unit_px, extent=(-26, 26, -12, 36), pts=None, pad=8):
    """crop window in plate px around the character. extent in units (screen x-, x+, below root, above root) unrotated."""
    u, v = cam.project(P)
    x0, x1, yb, yt = extent
    r = max(abs(x0), abs(x1), abs(yb), abs(yt))
    # roll-safe: use a square around the root that covers the rotated extent
    cx, cy = u, v
    half = r * unit_px + pad
    X0, Y0 = int(math.floor(cx - half)), int(math.floor(cy - half))
    S = int(math.ceil(2 * half))
    return [X0, Y0, S, S]


def job(out, cam, P, rot, pose, light, unit_px, scale=1.0, ground=None, extent=None, ss=None, crop=None, hide=False):
    if crop is None:
        crop = crop_for(cam, P, unit_px * scale, extent or (-26, 26, -12, 36))
    if ss is None:
        ss = float(np.clip(900 / max(crop[2], crop[3]), 1.0, 3.0))
    rot = np.asarray(rot, float)
    root = dict(pos=[float(x) for x in P], scale=scale)
    if rot.shape == (3, 3): root['mat'] = rot.tolist(); root['rot'] = [0, 0, 0]
    else: root['rot'] = [float(x) for x in rot]
    j = dict(out=out, cam=cam.as_json(), root=root,
             pose=pose, light=light, crop=crop, ss=round(ss, 3))
    if ground is not None:
        j['ground'] = ground
    if hide:
        j['hide'] = True
    return j


def render(jobs, path, workers=2, quiet=False):
    with open(path, 'w') as f:
        for j in jobs:
            f.write(json.dumps(j) + '\n')
    ps = [subprocess.Popen(['node', f'{CHAR}/rig_render.js', path, str(k), str(workers)], stdout=None if not quiet else subprocess.DEVNULL)
          for k in range(workers)]
    for p in ps:
        p.wait()


def load_layer(out):
    """-> dict(crop, ss, rgba float32 at plate res (h,w,4), shadow (h,w,2) or None)"""
    meta = json.load(open(out + '.json'))
    x0, y0, w, h = meta['crop']
    c = cv2.imread(out + '_c.png', cv2.IMREAD_UNCHANGED).astype(np.float32) / 255.0
    # premultiply before resampling to avoid dark fringes
    a = c[..., 3:4]
    pm = np.concatenate([c[..., :3] * a, a], 2)
    pm = cv2.resize(pm, (w, h), interpolation=cv2.INTER_AREA)
    sh = None
    if meta.get('shadow') and os.path.exists(out + '_s.png'):
        s = cv2.imread(out + '_s.png').astype(np.float32) / 255.0
        sh = cv2.resize(s[..., [2, 1]], (w, h), interpolation=cv2.INTER_AREA)   # BGR: R=shadow -> idx2, G=AO -> idx1
    return dict(crop=meta['crop'], pm=pm, shadow=sh, pts=meta['pts'])
