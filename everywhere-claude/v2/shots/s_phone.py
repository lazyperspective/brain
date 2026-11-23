# PHONE MIMICRY (IMG_1605 src 0.2-1.2): beside a stranger's boots (legs only; push-in keeps her face out of frame),
# the block is ALSO hunched over a tiny glowing phone. The tilt up reveals it; it looks up, caught, hides the phone.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v2/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d

NAME = 'phone'; CLIP = 'IMG_1605'
TR = json.load(open('/home/user/brain/everywhere-claude/v2/track/1605p.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 3; NF = 30
OUT = f'{shotlib.ROOT}/render/{NAME}'
GP = np.array([575.0, 364.0])        # ground point beside her left boot (ref src 0.8)
UPX_REF = 7.6
T_LOOK, T_HIDE = 0.55, 0.72

def scr(k, p=GP):
    k0 = int(math.floor(k)); return track2d.apply(HS[k0], [p])[0]

def build():
    recs = []; tails = Tails(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        p = scr(k); upx = UPX_REF * track2d.local_scale(HS[k], GP)
        cam = rig.Cam(65.0, pitch=-58 + 26 * (k - K0) / (NF - 1))
        yaw = Track([(0, -12), (T_LOOK, -12), (T_LOOK + 0.12, -4, 'out'), (1, -4)])(t)
        P, rot = rig.place(cam, p[0], p[1], upx, yaw_rel=yaw)
        Rb = body_R(rot[1])
        pose = dict()
        if t < T_LOOK:
            # hunched over the phone like everyone else: phone in both fists at chest height, screen glow on the face
            pose.update(eyes='open', look=[0, -1.1], mouth='line', glow=1.0, lean=[0, 2.2], blush=0.5)
            ph = [0, 7.8, BD / 2 + 4.4]; pose['phone'] = dict(pos=ph, rot=[80, 180, 0])
            thumb = 0.5 * math.sin(t * 40) if t < T_LOOK - 0.1 else 0
            pose['arms'] = [{'fist': [-2.2, ph[1] - 1.6, ph[2] - 0.4]}, {'fist': [2.2, ph[1] - 1.6 + thumb, ph[2] - 0.4]}]
        else:
            u = smooth(T_HIDE, T_HIDE + 0.1, t)
            pose.update(eyes='wide', look=[0, 0.5] if t < 0.85 else [-0.9, 0.2], mouth='o' if t < 0.85 else 'wavy', mouthOpen=0.5, glow=1.0 - u, lean=[0, 2.2 * (1 - smooth(T_LOOK, T_LOOK + 0.1, t)) - 1.0 * u], blush=1.0)
            ph = [0, 7.8 - 1.6 * u, BD / 2 + 4.4 - (BD + 9) * u]
            pose['phone'] = dict(pos=ph, rot=[80, 180, 0])
            pose['arms'] = [{'fist': [-2.2 - 7 * u, ph[1] - 1.6, ph[2] - 0.4]}, {'fist': [2.2 + 7 * u, ph[1] - 1.6, ph[2] - 0.4]}]
            if u > 0.95: pose['phone'] = None; pose['arms'] = [{'fist': [-BW / 2 - 0.5, 7.0, -BD / 2 - 0.5]}, {'fist': [BW / 2 + 0.5, 7.0, -BD / 2 - 0.5]}]
        if pose.get('phone') is None: pose.pop('phone', None)
        op = blink_open(t, seed=17, period=(30, 31), extra=[0.92])
        pose['open'] = op
        recs.append(dict(t=t, k=k, p=p, cam=cam, upx=upx, root=P, R=Rb, pose=pose))
        S.append(np.zeros(3)); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, impulses=[(int(T_LOOK * 30), 0, -1.5, -1.8)])
    for i, r in enumerate(recs):
        p = r['pose']; L0 = p.get('lean', [0, 0]); p['lean'] = [float(L0[0] + lean[i][0]), float(L0[1] + lean[i][1])]
        p['squash'] = float(np.clip(sq[i], -0.2, 0.2)); p['tails'] = tails.step(r['t'], S[i], Rs[i], gust=0.5)
    return recs

LIGHT = dict(sky='#e2e6ec', ground='#8f9196', hemi=1.55, key=0.45, keyCol='#fff7ef', keyDir=[-0.2, 1.0, 0.3], amb=0.12, rim='#e2e6ec', rimK=0.25, emK=0.2)
GRADE = dict(exposure=1.0, sat=0.95, contrast=0.95, blur=0.75, wrap=0.2, wrap_sigma=6, grain=0.012, grain_size=0.9, highlight=0.9,
             shadow_k=0.2, shadow_soft=9, ao_k=0.55, ao_soft=3, ao_col=(0.3, 0.3, 0.32))

def jobs_and_frames(recs, ss_scale=1.0):
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        gp, _ = rig.place(r['cam'], r['p'][0], r['p'][1], r['upx'])
        j = rig.job(f'{OUT}/f{i:04d}', r['cam'], r['root'], r['R'], r['pose'], LIGHT, r['upx'], ground=dict(pos=[float(x) for x in gp]), extent=(-30, 30, -24, 32))
        j['ss'] = round(min(2.5, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(r['cam'].project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 1500 + i
        # push-in framed on the boots + the block, low enough that the stranger is only ever legs
        z = 1.8; cx = 660; cy = r["p"][1] + 20
        frames.append(dict(src=[(r['k'], 1.0)], layers=[(f'{OUT}/f{i:04d}', g, None)], reframe=(z, cx, cy, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
