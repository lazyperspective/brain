# v3: + image-based light from the plate, scarf, livelier blinks, a sweat drop when caught.
# MANHOLE (IMG_1605 src 3.2-4.7): the lid rattles, lifts on its head; shifty eyes; caught; ducks; the lid slams (clank).
# The lid is the real plate texture warped as a hinged disc; under it a dark shaft.  1.5 s / 3 beats.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d
from shotlib import wear_pose

NAME = 'manhole'; CLIP = 'IMG_1605'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1605m.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 3; NF = 45
OUT = f'{shotlib.ROOT}/render/{NAME}'
C0 = np.array([479.0, 1200.0]); A_LID, B_LID = 150.0, 56.0      # lid ellipse (ref frame)
A_RING, B_RING = 165.0, 62.0
UPX_REF = 13.5
CAM = rig.Cam(65.0, pitch=-13.0)
T_RATTLE, T_LIFT, T_UP, T_LOOK, T_DUCK, T_SLAM = 0.05, 0.22, 0.40, 0.74, 1.00, 1.10

def H(k): return HS[int(min(max(k, 0), NSRC - 1))]
def theta(t):
    if t < T_RATTLE: return 0.0
    if t < T_LIFT: return 2.2 * abs(math.sin((t - T_RATTLE) * 55))
    if t < T_DUCK: return 24.0 * EASE['back'](min(1, (t - T_LIFT) / (T_UP - T_LIFT))) if t < T_UP else 24.0 + 1.2 * math.sin((t - T_UP) * 9)
    if t < T_SLAM: return 24.0 * (1 - EASE['in']((t - T_DUCK) / (T_SLAM - T_DUCK)))
    d = t - T_SLAM
    return max(0.0, 5.0 * math.exp(-d * 14) * abs(math.sin(d * 30)))
def depth(t):   # root height below ground (units, negative)
    return Track([(0, -20), (T_LIFT, -20), (T_UP, -7.6, 'back'), (T_DUCK, -7.6), (T_DUCK + 0.09, -22, 'in'), (2, -22)])(t)

def lift_pts(th_deg, n=32, lift_px=0.0):
    """lid circle points (ref) and their lifted positions: raised flat by lift_px (riding on the head) and tilted by th_deg
    with the FAR edge up (hinge near), so the lid face turns toward the camera"""
    th = math.radians(th_deg); src, dst = [], []
    for a in np.linspace(0, 2 * np.pi, n, endpoint=False):
        x, y = C0[0] + A_LID * math.cos(a), C0[1] + B_LID * math.sin(a)
        w = (y - C0[1]) / B_LID
        far = (1 - w) / 2 * 2 * A_LID          # distance from the near edge along the ground (px of a)
        y2 = y - lift_px - far * math.sin(th) * 0.93 + far * (1 - math.cos(th)) * (B_LID / A_LID)
        src.append([x, y]); dst.append([x, y2])
    return np.array(src), np.array(dst)

def ellipse_mask(k, a, b, shape=(1920, 1080)):
    pts = np.array([[C0[0] + a * math.cos(q), C0[1] + b * math.sin(q)] for q in np.linspace(0, 2 * np.pi, 64, endpoint=False)])
    P = track2d.apply(H(k), pts).astype(np.int32)
    m = np.zeros(shape, np.uint8); cv2.fillPoly(m, [P], 255, lineType=cv2.LINE_AA)
    return m.astype(np.float32) / 255.0

def build():
    recs = []; wear = Wear(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        c = track2d.apply(H(k), [C0])[0]; sc = track2d.local_scale(H(k), C0); upx = UPX_REF * sc
        d = depth(t)
        p = c + np.array([0, -d * upx * 0.93])
        lk = Track([(0, [0, 0]), (T_UP, [0, 0]), (T_UP + 0.06, [-1.0, 0.2]), (0.56, [-1.0, 0.2]), (0.6, [1.0, 0.2]), (T_LOOK - 0.04, [1.0, 0.2]), (T_LOOK, [0, -0.3], 'out'), (2, [0, -0.3])])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=Track([(0, 0), (0.5, -10), (0.62, 10), (T_LOOK, 0), (2, 0)])(t))
        Rb = body_R(rot[1])
        caught = t >= T_LOOK
        pose = dict(eyes='wide' if caught else 'open', mouth='none', look=[float(lk[0]), float(lk[1])], blush=0.8,
                    arms=[{'fist': [-BW / 2 - 0.6, TOP + 0.6, 1.0]}, {'fist': [BW / 2 + 0.6, TOP + 0.6, 1.0]}])
        op = blinks(t, seed=7, extra=[0.9])
        if T_LOOK <= t < T_DUCK + 0.1: pose['sweat'] = sweat(t, T_LOOK + 0.03, 0.4)
        pose['open'] = op if t < T_DUCK else 1.0
        if t >= T_DUCK: pose['eyes'] = 'closed'
        pose['squash'] = 0.0
        recs.append(dict(t=t, k=k, p=p, c=c, upx=upx, root=P, R=Rb, pose=pose, th=theta(t), d=d))
        S.append(np.array([0, d, 0])); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, impulses=[(int(T_UP * 30), 0, 0, -2.0)])
    for i, r in enumerate(recs):
        r['pose']['lean'] = [float(lean[i][0]), float(lean[i][1])]; r['pose']['squash'] = float(np.clip(sq[i], -0.2, 0.2))
        wear_pose(r['pose'], wear, r['t'], S[i], Rs[i], gust=0.3)
    return recs

LIGHT = dict(sky='#dfe3ea', ground='#8c8c8a', hemi=1.3, key=0.35, keyCol='#fff6ee', keyDir=[-0.3, 1.0, 0.4], amb=0.08, rim='#dfe3ea', rimK=0.15, emK=0.12)
GRADE = dict(exposure=0.95, sat=0.92, contrast=0.92, blur=0.7, wrap=0.15, wrap_sigma=6, grain=0.01, grain_size=0.9, highlight=0.9)

def make_ops(r):
    k = r['k']; state = {}
    def pre(img, i):
        state['plate'] = img.copy()
        if r['th'] > 0.05 or r['d'] > -19.5:
            hole = ellipse_mask(k, A_LID, B_LID)
            # shaft: dark, the far inner wall a little lighter
            yy = np.arange(1920, dtype=np.float32)[:, None]; c = r['c']; b = B_LID * track2d.local_scale(H(k), C0)
            g = np.clip((yy - (c[1] - b)) / (2 * b), 0, 1)
            col = (0.16 * (1 - g) + 0.03 * g)[..., None] * np.array([0.92, 0.95, 1.0], np.float32)
            img[:] = img * (1 - hole[..., None]) + col * hole[..., None]
        return img
    def post(img, i):
        if r['th'] <= 0.05 and r['d'] <= -16.6: return img
        lift = max(0.0, (r['d'] + 16.6)) * UPX_REF * 0.93 if r['d'] > -16.6 else 0.0
        src, dst = lift_pts(r['th'] * 0.45, lift_px=lift)
        Hk = H(k); S2 = track2d.apply(Hk, src); D2 = track2d.apply(Hk, dst)
        M, _ = cv2.findHomography(S2.astype(np.float32), D2.astype(np.float32))
        lid = cv2.warpPerspective(state['plate'], M, (1080, 1920), flags=cv2.INTER_LINEAR)
        m = cv2.warpPerspective(ellipse_mask(k, A_LID, B_LID), M, (1080, 1920), flags=cv2.INTER_LINEAR)
        # lid thickness: a dark rim under the lifted edge, and a soft shadow of the lid into the shaft/ground
        rim = np.roll(m, 7, axis=0) * (1 - m)
        img[:] = img * (1 - 0.85 * rim[..., None]) + 0.04 * rim[..., None] * 0.85
        img[:] = img * (1 - m[..., None]) + lid * 0.97 * m[..., None]
        return img
    return pre, post

def matte_fn(r):
    k = r['k']
    def m(x0, y0, x1, y1):
        c = r['c']; sc = track2d.local_scale(H(k), C0); a, b = A_LID * sc * 0.97, B_LID * sc * 0.97
        X = np.arange(x0, x1, dtype=np.float32)[None, :]; Y = np.arange(y0, y1, dtype=np.float32)[:, None]
        dx = np.clip((X - c[0]) / a, -1, 1); near = c[1] + b * np.sqrt(1 - dx ** 2)
        inside = ((X - c[0]) / a) ** 2 + ((Y - c[1]) / b) ** 2 <= 1
        occ = np.where(np.abs(X - c[0]) < a, Y > near, Y > c[1]).astype(np.float32)
        occ[inside] = 0
        return cv2.GaussianBlur(occ, (0, 0), 0.8)
    return m

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=0.85, emK=0.06)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        hide = r['d'] <= -19.5
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], extent=(-22, 22, -4, 30), hide=hide)
        j['ss'] = round(min(2.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 12.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 700 + i
        g['exposure'] = 0.98 - 0.12 * (r['th'] / 24.0)     # shadowed under the lid
        pre, post = make_ops(r)
        frames.append(dict(src=[(r['k'], 1.0)], layers=[] if r['d'] <= -19.5 else [(f'{OUT}/f{i:04d}', g, matte_fn(r))], pre=pre, post=post,
                           reframe=(1.18, 540, 1150, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
