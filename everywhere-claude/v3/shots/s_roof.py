# v3: + image-based light, scarf, livelier blinks, sweat drop on the double-take, stretch/squash on the chimney hop,
# hand-drawn cloud streamlines (tracked with the roof homography: pure camera rotation) on the first beat.
# COLD OPEN (IMG_1584 src 4.0-7.0): already sprinting along the roof ridge at the pan speed (locked in frame), hops the
# chimney, glances at the camera, double-take, skids, drops flat behind the ridge, eyes peek over it, ducks.  3.0 s / 6 beats.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, magic, plates

NAME = 'roof'; CLIP = 'IMG_1584'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1584.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; RID = TR['ridge0']
K0 = 3                       # film frame 0 = source k 3 (4.0 s)
NF = 75
OUT = f'{shotlib.ROOT}/render/{NAME}'
UPX = 7.6
X_LOCK = 600.0
CHIM = (917, 1010)           # chimney x-range on the ridge in frame-0 coords

def ridge_y0(x): return RID[0] * x + RID[1]
def to_screen(k, s, lift_px=0.0):
    """roof frame-0 ridge coordinate s -> screen point at source frame k (fractional ok)"""
    k0 = int(math.floor(k)); a = k - k0
    p0 = track2d.apply(HS[k0], [[s, ridge_y0(s)]])[0]; p1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [[s, ridge_y0(s)]])[0]
    return p0 * (1 - a) + p1 * a + np.array([0, -lift_px])
def from_screen_x(k, X):
    """frame-0 ridge coordinate whose screen x is X at frame k"""
    lo, hi = -2000.0, 6000.0
    for _ in range(50):
        m = (lo + hi) / 2
        if to_screen(k, m)[0] < X: lo = m
        else: hi = m
    return (lo + hi) / 2

T_GLANCE, T_DOUBLE, T_SKID, T_DROP, T_PEEK, T_DUCK = 0.98, 1.40, 1.50, 1.70, 1.92, 2.36
CAM = rig.Cam(65.0, pitch=-3.0)

def build():
    # ridge coordinate s(t): locked to the screen while sprinting, then decelerates (skid) and stays planted
    s_lock = [from_screen_x(K0 + i, X_LOCK) for i in range(NF)]
    v_lock = np.gradient(s_lock) * 30.0
    s = []; cur = None
    for i in range(NF):
        t = i / 30.0
        if t < T_SKID: cur = s_lock[i]
        else:
            u = (t - T_SKID) / (T_DROP - T_SKID)
            v = v_lock[int(T_SKID * 30)] * max(0.0, 1 - u) ** 1.6
            cur = cur + v / 30.0
        s.append(cur)
    s = np.array(s); v_rel = np.gradient(s) * 30.0 / UPX         # units / s relative to the roof
    dist = np.cumsum(v_rel) / 30.0
    recs = []; wear = Wear(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        # hop over the chimney: by ridge coordinate
        a0, a1 = CHIM[0] - 9 * UPX, CHIM[1] + 9 * UPX
        hop = 0.0
        if a0 < s[i] < a1: u = (s[i] - a0) / (a1 - a0); hop = 15.0 * math.sin(math.pi * u) ** 0.85
        # behind-the-ridge drop: move back (away) and down
        drop = 0.0
        if t >= T_DROP:
            drop = Track([(T_DROP, 0), (T_DROP + 0.05, 1.5, 'out'), (T_DROP + 0.18, -23.5, 'in')])(t)
        p = to_screen(k, s[i], lift_px=(hop + drop) * UPX)
        yaw = Track([(0, 52), (T_SKID, 52), (T_SKID + 0.15, 35, 'out'), (T_DROP, 22), (2.6, 18)])(t)
        twist = Track([(0, 0), (T_GLANCE, 0), (T_GLANCE + 0.08, -55, 'out'), (T_GLANCE + 0.2, -55), (T_GLANCE + 0.28, 0, 'io'),
                       (T_DOUBLE, 0), (T_DOUBLE + 0.06, -62, 'out'), (T_SKID + 0.15, -20), (T_DROP, 0), (3, 0)])(t)
        P, rot = rig.place(CAM, p[0], p[1], UPX, yaw_rel=yaw)
        Rb = body_R(rot[1])
        pose = dict(twist=twist)
        running = t < T_SKID + 0.05
        if running:
            pose.update(step=float(dist[i] / 20.0), stepDir=[0, 1], stepAmp=3.2, stepLift=2.8)
            if hop > 0.5: pose.update(step=None, feet=[[-4.4, 2.0, -3.5], [4.4, 2.0, -3.5], [-4.4, 2.6, 3.0], [4.4, 2.6, 3.0]])
            sw = math.sin(dist[i] / 20.0 * 2 * math.pi)
            pose['arms'] = [{'fist': [-BW / 2 - 1.3, 6.8, 1.6 + 3.2 * sw]}, {'fist': [BW / 2 + 1.3, 6.8, 1.6 - 3.2 * sw]}]
        elif t < T_DROP:
            pose['feet'] = [[-4.4, 0, -4.0], [4.4, 0, -4.0], [-4.4, 0, 7.0], [4.4, 0, 7.0]]   # front feet braced forward
            pose['arms'] = [{'fist': [-BW / 2 - 2.5, 9.5, -2.0]}, {'fist': [BW / 2 + 2.5, 9.5, -2.0]}]
        else:
            pose['arms'] = [{'fist': [-BW / 2 + 1.0, 13.0, 9.0]}, {'fist': [BW / 2 - 1.0, 13.0, 9.0]}]   # hands on the ridge edge
        # face
        if t < T_GLANCE: pose.update(eyes='fierce', mouth='smile')
        elif t < T_GLANCE + 0.28: pose.update(eyes='open', mouth='line', look=[-0.6, 0])
        elif t < T_DOUBLE: pose.update(eyes='fierce', mouth='smile')
        elif t < T_DROP: pose.update(eyes='wide', mouth='o', mouthOpen=1.0)
        elif t < T_DUCK: pose.update(eyes='wide', mouth='none', look=[0, 0.4] if t < 2.15 else [-0.8, 0.3], blush=0.6)
        else: pose.update(eyes='closed', mouth='none')
        if T_DOUBLE + 0.04 <= t < T_DROP + 0.2: pose['sweat'] = sweat(t, T_DOUBLE + 0.04, 0.55)
        op = blinks(t, seed=3, extra=[2.05, 2.16])
        if pose['eyes'] in ('open', 'wide', 'fierce'): pose['open'] = op
        # body: running lean forward, skid lean back, squash on the drop
        lean_d = [0, 2.6] if running else ([0, -3.0] if t < T_DROP else [0, 0])
        sq = 0.0
        if t >= T_DROP: sq = 0.2 * smooth(T_DROP, T_DROP + 0.1, t) * (1 - smooth(T_PEEK - 0.1, T_PEEK, t))
        if running and hop <= 0.5: sq += 0.05 * abs(math.sin(dist[i] / 20.0 * 2 * math.pi))
        if hop > 0.5: sq -= 0.12 * math.sin(math.pi * min(1, hop / 15.0)) ** 0.5      # stretch in the air
        rec = dict(t=t, k=k, p=p, root=P, R=Rb, pose=pose, lean_d=lean_d, sq_d=sq, hop=hop, s=s[i])
        recs.append(rec)
        S.append(np.array([s[i] / UPX, hop + drop, 0.0])); Rs.append(rotY(90 - (52 - yaw)))
    S = np.array(S)
    lean, sq = body_dyn(S, Rs, k_lean=0.010, k_sq=0.0006, impulses=[(int(T_SKID * 30), 0, -2.0, 0), (int(T_DROP * 30), 0, 0, -2.0)])
    for i, r in enumerate(recs):
        p = r['pose']
        p['lean'] = [float(lean[i][0] + r['lean_d'][0]), float(lean[i][1] + r['lean_d'][1])]
        p['squash'] = float(np.clip(sq[i] + r['sq_d'], -0.25, 0.24))
        tt = r['t']; up = smooth(T_DROP + 0.05, T_DROP + 0.2, tt) * (1 - smooth(T_DUCK, T_DUCK + 0.08, tt))
        sim, sc = wear.step(tt, S[i], Rs[i], wind=np.zeros(3), gust=1.0); p['scarf'] = sc
        if up > 0:   # hidden behind the ridge: the tails flutter straight up above it (procedural), then get yanked down
            proc = []
            for j, n in enumerate((7, 6)):
                proc.append([[0.6 * math.sin(tt * 15 - q * 0.9 + j * 2) * q * 0.35 + (j - 0.5) * 0.6 * q, 2.9 * q * (1 - 0.03 * q), 0.5 * q] for q in range(n + 1)])
            sim = [[list(np.array(a) * (1 - up) + np.array(b) * up) for a, b in zip(sa, pa)] for sa, pa in zip(sim, proc)]
        p['tails'] = sim
    return recs

LIGHT = dict(sky='#e2e8f0', ground='#6f6a64', hemi=1.7, key=0.75, keyCol='#fff4e8', keyDir=[-0.35, 1.0, 0.45], amb=0.12, rim='#e6ecf5', rimK=0.35, emK=0.2)
GRADE = dict(exposure=0.97, sat=0.92, haze=0.04, blur=0.5, wrap=0.3, wrap_sigma=10, grain=0.006, grain_size=0.8, highlight=0.9,
             shadow_k=0.35, shadow_soft=5, shadow_col=(0.5, 0.5, 0.55), ao_k=0.6, ao_soft=3.0, ao_col=(0.35, 0.35, 0.38))

def roof_matte(k, margin=0.0):
    """1 where the roof (in front of the ridge line) covers; margin (px) lowers the line (feet standing on the near cap)"""
    def m(x0, y0, x1, y1):
        xs = np.arange(x0, x1); a = to_screen(k, -500)[None]; b = to_screen(k, 3000)[None]
        p = track2d.apply(HS[int(k)], [[-500, ridge_y0(-500)], [3000, ridge_y0(3000)]])
        yy = p[0, 1] + (xs - p[0, 0]) * (p[1, 1] - p[0, 1]) / (p[1, 0] - p[0, 0])
        Y = np.arange(y0, y1)[:, None]
        return np.clip((Y - yy[None, :] - 1.0 - margin) / 1.5, 0, 1).astype(np.float32)
    return m

GRADE.update(exposure=1.0)

def clouds_pattern():
    f = next(plates.frames(CLIP, T0 + CL_REF / 30.0, 1)).astype(np.float32) / 255
    return magic.clouds(f, y_max=1100, max_lines=30, style=magic.st(color=(255, 250, 240), glow=(255, 255, 255), gk=0.6, width=2.4, alpha=0.62, blur=8))
CL_REF = K0 + 15                       # pattern reference frame (film 0.5 s)
CL_ON, CL_FULL, CL_OFF0, CL_OFF1 = 0.08, 0.62, 1.0, 1.38

def cloud_pre(pat, k, t):
    Hk = HS[int(k)] @ np.linalg.inv(HS[CL_REF])
    prog = smooth(CL_ON, CL_FULL, t); al = 1 - smooth(CL_OFF0, CL_OFF1, t)
    def pre(img, i):
        if prog > 0 and al > 0: pat.render(img, prog, lambda P: track2d.apply(Hk, P), alpha=al, boil=int(t * 30) // 3)
        return img
    return pre

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=1.05, emK=0.1)
    pat = clouds_pattern()
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        out = f'{OUT}/f{i:04d}'
        j = rig.job(out, CAM, r['root'], r['R'], r['pose'], r['light'], UPX, env=r['env'], ground=dict(pos=[float(x) for x in (r['root'] - np.array([0, r['hop'] * 1.0, 0]) * 0)]), extent=(-30, 30, -24, 34))
        # ground plane at the ridge height (not lifted with the hop)
        P0, _ = rig.place(CAM, *to_screen(r['k'], 0)[:2], UPX)
        gp, _ = rig.place(CAM, *to_screen(r['k'], r['s'])[:2], UPX)          # ridge level under the character
        j['ground'] = dict(pos=[float(x) for x in gp], normal=[0, 1, 0])
        j['ss'] = round(j['ss'] * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 100 + i; g['shadow_mask'] = roof_matte(r['k'])
        fade = 1 - smooth(T_DROP, T_DROP + 0.12, r['t']); g['shadow_k'] *= fade; g['ao_k'] *= fade
        frames.append(dict(src=[(r['k'], 1.0)], pre=cloud_pre(pat, r['k'], r['t']), layers=[(f'{OUT}/f{i:04d}', g, roof_matte(r['k'], 16.0 * (1 - smooth(T_DROP - 0.05, T_DROP + 0.05, r['t']))))], reframe=(1.28, 540, 1300, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, 'IMG_1584', T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
