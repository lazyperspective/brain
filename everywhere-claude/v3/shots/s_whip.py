# WHIP CHASE (IMG_1633 src 2.4-3.9, 3 beats): the x16 zoom settles on a snowy ridge where it is already sprinting right
# along the skyline; the whip pan starts and seems to CHASE it - it holds its place in frame while the mountains streak past,
# kicking up snow - then it pulls away out of the right edge: the transition into the summit ending.
# Tracking: the skyline is detected in every frame (sky-referenced colour edge), the feet ride it; the plate's own pan is
# measured by phase correlation (used for the snow puffs and to match the camera's smear on the character).
import sys, json, math, os
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, fx, magic, plates
from shotlib import wear_pose

NAME = 'whip'; CLIP = 'IMG_1633'
T0 = 2.4; NSRC = 46; NF = 45
OUT = f'{shotlib.ROOT}/render/{NAME}'
TRK = f'{shotlib.ROOT}/track/1633.json'
UPX = 8.0
CAM = rig.Cam(4.5, pitch=1.0)
T_WHIP, T_AWAY = 0.6, 1.08
XK = Track([(0, 300), (T_WHIP, 520), (T_WHIP + 0.15, 600, 'out'), (T_AWAY, 640), (1.42, 1300, 'in')])

def track():
    if os.path.exists(TRK): return json.load(open(TRK))
    fr = list(plates.frames(CLIP, T0, NSRC))
    sky = [magic.ridge_sky(f).tolist() for f in fr]
    g = [cv2.resize(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (270, 480)).astype(np.float32) for f in fr]
    shift = [[0.0, 0.0]]
    win = cv2.createHanningWindow((270, 200), cv2.CV_32F)
    for a, b in zip(g, g[1:]):
        (dx, dy), resp = cv2.phaseCorrelate(a[200:400], b[200:400], win)
        shift.append([shift[-1][0] + dx * 4, shift[-1][1] + dy * 4])
    T = dict(T0=T0, N=NSRC, sky=sky, shift=shift)
    json.dump(T, open(TRK, 'w')); return T
TR = track()

def sky_y(k, x):
    s = np.array(TR['sky'][int(min(k, NSRC - 1))]); return float(np.interp(x, s[:, 0], s[:, 1]))

def build():
    recs = []; wear = Wear(); S = []; Rs = []; dist = 0.0; prevx = None
    sh = np.array(TR['shift'])
    for i in range(NF):
        t = i / 30.0; k = i
        x = XK(t); y = sky_y(k, x) + 3.0
        # ground speed (units/s) = its own screen motion + the world sliding past (plate shift)
        dplate = -(sh[min(k + 1, NSRC - 1), 0] - sh[k, 0])
        dx = (x - prevx) if prevx is not None else 0.0; prevx = x
        dist += abs(dx + dplate) / UPX
        p = np.array([x, y])
        P, rot = rig.place(CAM, p[0], p[1], UPX, yaw_rel=88)
        Rb = body_R(rot[1])
        st = dist / 26.0
        pose = dict(step=float(st), stepDir=[0, 1], stepAmp=3.6, stepLift=3.2, eyes='fierce', mouth='grit', twist=-25 if t < T_AWAY else 0)
        sw = math.sin(st * 2 * math.pi)
        pose['arms'] = [{'fist': [-BW / 2 - 1.3, 7.5, 1.0 + 3.6 * sw]}, {'fist': [BW / 2 + 1.3, 7.5, 1.0 - 3.6 * sw]}]
        if t < T_WHIP - 0.1: pose.update(eyes='open', mouth='smile', look=[-0.7, 0], twist=-40)         # glance back at us
        if T_AWAY - 0.1 < t: pose.update(eyes='fierce', mouth='grin', mouthOpen=1.0)
        pose['open'] = blinks(t, seed=51)
        recs.append(dict(t=t, k=k, p=p, root=P, R=Rb, pose=pose, st=st, dplate=dplate))
        S.append(np.array([0, 0, dist])); Rs.append(rotY(0))
    lean, sq = body_dyn(np.array(S), Rs, k_lean=0.004, k_sq=0.0004)
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(np.clip(lean[i][1] + 3.2, -4, 4))]
        p['squash'] = float(np.clip(sq[i] + 0.05 * abs(math.sin(r['st'] * 2 * math.pi)), -0.2, 0.2))
        v = abs(r['dplate']) * 30 / UPX
        wear_pose(p, wear, r['t'], S[i], Rs[i], wind=np.array([0, 0, -min(60, 8 + v * 0.15)]), gust=1.0)
    return recs

GRADE = dict(exposure=1.02, sat=0.9, contrast=0.9, haze=0.08, haze_col=(0.9, 0.78, 0.7), blur=1.5, wrap=0.4, wrap_sigma=10, grain=0.005, grain_size=1.2,
             highlight=0.85, shadow_k=0.12, shadow_soft=6, ao_k=0.5, ao_soft=4, ao_col=(0.6, 0.5, 0.45), ca=1.4)

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=1.0, emK=0.16)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        hide = r['p'][0] > 1240
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], UPX, env=r['env'], ground=dict(pos=[float(x) for x in r['root']]), extent=(-30, 30, -14, 34), hide=hide)
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    sh = np.array(TR['shift'])
    # snow kicked up at its footfalls (world-anchored: they slide with the plate's pan)
    B = []
    for i, r in enumerate(recs):
        if i and int(r['st'] * 2) != int(recs[i - 1]['st'] * 2) and r['p'][0] < 1100:
            o = r['p'] + np.array([-10.0, 0]); b = fx.Burst(r['t'], o, 7, (40, 160), angle=(-170, -100), gravity=500, drag=3.0, life=(0.25, 0.5),
                                                          size=(1.6, 2.8), col=(0.97, 0.95, 0.93), kind='dot', seed=200 + i, alpha=0.8, puff=0.35, puff_r=16)
            b.k0 = r['k']; B.append(b)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['seed'] = 5100 + i
        # the camera's smear: during the whip the character's blur follows the plate's own streak direction, partly
        pv = -(sh[min(r['k'] + 1, NSRC - 1)] - sh[max(r['k'] - 1, 0)]) / 2
        g['mblur'] = (mv[i][0] + 0.25 * pv[0] * 0.5, mv[i][1] + 0.25 * pv[1] * 0.5)
        k = r['k']; t = r['t']
        def pre(img, ii, k=k, t=t):
            for b in B:
                if 0 <= t - b.t0 < 0.6:
                    off = np.array(sh[k]) - np.array(sh[b.k0])
                    fx.draw_bursts(img, [b], t, lambda P, off=off: P + off, shutter=0.6)
            return img
        frames.append(dict(src=[(k, 1.0)], pre=pre, layers=[] if r['p'][0] > 1240 else [(f'{OUT}/f{i:04d}', g, None)], reframe=(1.0, 540, 960, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
