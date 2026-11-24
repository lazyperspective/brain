# PHOTO (IMG_1605 src 5.0-6.5, 3 beats): the reversal that replaces v2's phone mimic. On the wet paving of the square it is
# photographing the sights with a tiny camera, notices us, turns (overshoot), a sly look, raises the camera (anticipation dip)
# and photographs US: the flash bursts across the lens. Then it checks the shot and winks. Its mirror image lies in the wet
# paving. Track: ground-plane homography (~0.1 px). Only distant passers-by are in frame (push-in keeps the near edge out).
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, fx
from shotlib import wear_pose

NAME = 'photo'; CLIP = 'IMG_1605'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1605s.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 3; NF = 45
OUT = f'{shotlib.ROOT}/render/{NAME}'
GP = np.array([520.0, 1120.0])        # ground point (ref src 5.4)
UPX_REF = 9.5
T_NOTICE, T_TURN0, T_TURN1, T_RAISE, T_FLASH, T_CHECK, T_WINK = 0.28, 0.40, 0.62, 0.80, 1.00, 1.16, 1.34
CAM_EYE = [2.9, 11.3, BD / 2 + 2.0]      # over the screen-right eye: the other one squints shut
FLASH_K = {0: 0.8, 1: 0.42, 2: 0.17, 3: 0.07, 4: 0.025}

def scr(k, p=GP):
    return track2d.apply(HS[int(k)], [p])[0]

def cam_at(k):
    roll = track2d.local_rot(HS[int(k)], GP) - track2d.local_rot(HS[REF], GP)
    return rig.Cam(65.0, pitch=-11.0 + 4.0 * (k - K0) / (NF - 1), roll=roll)

def build():
    recs = []; wear = Wear(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        cam = cam_at(k); p = scr(k); upx = UPX_REF * track2d.local_scale(HS[k], GP)
        yaw = Track([(0, -78), (T_TURN0, -78), (T_TURN1, 0, 'back'), (T_FLASH, 0), (1.5, 6)])(t)
        twist = Track([(0, 0), (T_NOTICE, 0), (T_NOTICE + 0.08, 48, 'out'), (T_TURN0, 50), (T_TURN1, 0, 'io'), (1.5, 0)])(t)
        P, rot = rig.place(cam, p[0], p[1], upx, yaw_rel=yaw)
        Rb = body_R(rot[1])
        pose = dict(twist=twist)
        # camera prop: at the eye (shooting the sights) -> chest -> eye (at us) -> lowered to look at the screen
        lo = [0.6, 7.4, BD / 2 + 3.2]; chk = [0.0, 6.2, BD / 2 + 4.2]
        if t < T_NOTICE + 0.05: cp, cr = CAM_EYE, [0, 0, 0]
        elif t < T_RAISE:
            u = smooth(T_NOTICE + 0.05, T_TURN1, t); cp = list(np.array(CAM_EYE) * (1 - u) + np.array(lo) * u); cr = [0, 0, 0]
        elif t < T_FLASH:
            u = smooth(T_RAISE + 0.04, T_FLASH - 0.04, t); dip = anticip(t, T_RAISE + 0.06, 0.06)
            cp = list(np.array(lo) * (1 - u) + np.array(CAM_EYE) * u - np.array([0, 1.2 * dip, 0])); cr = [0, 0, 0]
        elif t < T_CHECK: cp, cr = CAM_EYE, [0, 0, 0]
        else:
            u = smooth(T_CHECK, T_CHECK + 0.12, t); cp = list(np.array(CAM_EYE) * (1 - u) + np.array(chk) * u); cr = [-70 * u, 180 * u, 0]
        pose['camera'] = dict(pos=[float(x) for x in cp], rot=cr)
        pose['flash'] = 1.0 if 0 <= i - int(T_FLASH * 30) < 2 else 0.0
        pose['arms'] = [{'fist': [cp[0] - 3.4, cp[1] - 0.8, cp[2] - 0.6]}, {'fist': [cp[0] + 3.4, cp[1] - 0.8, cp[2] - 0.6]}]
        # face
        if t < T_NOTICE: pose.update(eyes='open', openL=0.0, mouth='smile')             # squinting through the viewfinder
        elif t < T_TURN1: pose.update(eyes='wide', mouth='o', mouthOpen=0.6, look=[0.6, 0.1])
        elif t < T_RAISE: pose.update(eyes='squint', mouth='smirk', blush=1.0)            # sly
        elif t < T_CHECK: pose.update(eyes='open', openL=0.0, mouth='grin', mouthOpen=0.7)          # one eye shut, aiming
        elif t < T_WINK: pose.update(eyes='happy', mouth='grin', mouthOpen=1.0, look=[0, -0.8], blush=1.0)
        else: pose.update(eyes='open', openR=0.0, mouth='smirk', blush=1.0)
        op = blinks(t, seed=41)
        if pose['eyes'] in ('open', 'wide'): pose['open'] = op
        sq = 0.0
        if T_RAISE <= t < T_RAISE + 0.1: sq = 0.08 * math.sin(math.pi * (t - T_RAISE) / 0.1)
        if T_FLASH <= t < T_FLASH + 0.1: sq = -0.07
        recs.append(dict(t=t, k=k, p=p, cam=cam, upx=upx, root=P, R=Rb, pose=pose, sq=sq))
        S.append(np.zeros(3)); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, impulses=[(int(T_NOTICE * 30), 0, -1.0, -1.2), (int(T_FLASH * 30), 0, -1.6, -1.0)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]
        p['squash'] = float(np.clip(sq[i] + r['sq'], -0.2, 0.2))
        wear_pose(p, wear, r['t'], S[i], r['R'], wind=np.array([2.5, 0, 0]), gust=0.6)
    return recs

GRADE = dict(exposure=0.98, sat=0.9, contrast=0.95, blur=0.7, wrap=0.25, wrap_sigma=6, grain=0.012, grain_size=0.9, highlight=0.9,
             shadow_k=0.14, shadow_soft=8, ao_k=0.45, ao_soft=3, ao_col=(0.3, 0.3, 0.32), refl_k=0.5, refl_blur=2.2, refl_ripple=1.8, refl_fade=110.0, refl_dark=0.25)

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: r['cam'], envK=1.0, emK=0.08)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        gp, _ = rig.place(r['cam'], r['p'][0], r['p'][1], r['upx'])
        j = rig.job(f'{OUT}/f{i:04d}', r['cam'], r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], ground=dict(pos=[float(x) for x in gp]),
                    reflect=dict(pos=[float(x) for x in gp], normal=[0, 1, 0]), extent=(-30, 30, -30, 32))
        j['ss'] = round(min(2.5, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(r['cam'].project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
        r['flash_at'] = r['cam'].project(r['root'] + r['R'] @ (np.array(CAM_EYE) + np.array([-2.0, 1.2, 1.3])))
    mv = shotlib.motion_vectors(pts, 0.5)
    fi0 = int(T_FLASH * 30)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 1500 + i
        fk = FLASH_K.get(i - fi0, 0.0); at = r['flash_at']
        post = (lambda img, ii, fk=fk, at=at: fx.flash(img, at, fk, radius=300.0))
        c = r['p'] + np.array([0, -90.0])
        frames.append(dict(src=[(r['k'], 1.0)], layers=[(f'{OUT}/f{i:04d}', g, None)], post=post, reframe=(1.35, c[0], c[1], 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
