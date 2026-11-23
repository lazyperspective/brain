# ENDING (IMG_1631): music stops; the x15 zoom (1.5x speed) pushes in on the blue-hour summit; the coral block stands on
# top looking straight back at us through binoculars. Hold. Lowers them, happy eyes, waves. Fight-style fist pump + boop. Cut.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v2/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d

NAME = 'summit'; CLIP = 'IMG_1631'
TR = json.load(open('/home/user/brain/everywhere-claude/v2/track/1631.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
NF = 180
OUT = f'{shotlib.ROOT}/render/{NAME}'
ANCH = np.array([560.0, 1049.0])
UPX_REF = 5.6
CAM = rig.Cam(4.5, pitch=1.0)
T_LAND, T_LOWER, T_WAVE, T_PUMP = 2.8, 3.45, 3.9, 5.15

def src_t(t): return 0.8 + 1.5 * t if t < T_LAND else 5.0 + (t - T_LAND)
def kf(t): return (src_t(t) - T0) * 30.0
def scr(k, p=ANCH):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a

def build():
    recs = []; tails = Tails(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = kf(t)
        sc = track2d.local_scale(HS[int(k)], ANCH); upx = UPX_REF * sc
        def bounce(t0, h, d=0.3): return h * max(0, math.sin(math.pi * (t - t0) / d)) if t0 <= t <= t0 + d else 0.0
        hop = bounce(T_PUMP + 0.04, 3.5) + bounce(T_PUMP + 0.42, 1.6, 0.22)
        p = scr(k) + np.array([0, -hop * upx])
        yaw = Track([(0, 0), (T_WAVE, 0), (T_WAVE + 0.3, 8), (5.0, 8), (T_PUMP, 0)])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=yaw)
        Rb = body_R(rot[1])
        pose = dict()
        # binoculars at the eyes -> lowered to the chest -> held at the side
        lw = smooth(T_LOWER, T_LOWER + 0.35, t)
        eye_y = FOOT + BH * 0.56
        bpos = [0, eye_y - 3.6 * lw, BD / 2 + 2.3 + 0.6 * lw]
        if t < T_WAVE + 0.1:
            pose['binoc'] = dict(pos=bpos, pitch=10 * lw)
            pose['arms'] = [{'fist': [-3.6, bpos[1] - 1.2, bpos[2] - 0.6]}, {'fist': [3.6, bpos[1] - 1.2, bpos[2] - 0.6]}]
        else:   # binoculars dangle from the left fist
            pose['binoc'] = dict(pos=[-BW / 2 - 1.6, 3.6, 3.0], pitch=70)
            pose['arms'] = [{'fist': [-BW / 2 - 1.6, 6.2, 2.0]}, None]
            if t < T_PUMP - 0.2:     # wave: forearm swings from the elbow
                w = math.sin((t - T_WAVE) * 2 * math.pi * 2.6)
                pose['arms'][1] = {'fist': [BW / 2 + 3.2 + 2.2 * w, TOP + 6.5 - 0.8 * abs(w), 2.0], 'rot': [0, 0, -25 * w]}
            else:                   # fist pump: wind down, then punch up with a squash-bounce
                u = smooth(T_PUMP - 0.2, T_PUMP - 0.08, t) * (1 - smooth(T_PUMP - 0.08, T_PUMP, t))
                up = smooth(T_PUMP - 0.04, T_PUMP + 0.06, t)
                pose['arms'][1] = {'fist': [BW / 2 + 1.6 + 1.2 * up, 6.2 - 2.5 * u + up * 19, 1.8 + 1.0 * up], 'rot': [0, 0, -12 * up]}
            pose['arms'] = [a or {} for a in pose['arms']]
        if t < T_LOWER + 0.15:
            pose.update(eyes='open', mouth='line', blush=0.6)
        elif t < T_PUMP - 0.2:
            pose.update(eyes='happy', mouth='smile', blush=1.0)
        else:
            pose.update(eyes='happy', mouth='grin', mouthOpen=1.0, blush=1.0)
        op = blink_open(t, seed=21, period=(30, 31), extra=[T_LOWER + 0.3])
        if pose['eyes'] == 'open': pose['open'] = op
        sq = 0.0
        if T_PUMP - 0.2 < t < T_PUMP - 0.04: sq = 0.16 * smooth(T_PUMP - 0.2, T_PUMP - 0.1, t)
        if T_PUMP - 0.04 <= t < T_PUMP + 0.1: sq = -0.18
        if T_PUMP + 0.3 < t < T_PUMP + 0.42: sq = 0.15 * math.sin(math.pi * (t - T_PUMP - 0.3) / 0.12)
        recs.append(dict(t=t, k=k, p=p, upx=upx, root=P, R=Rb, pose=pose, sq=sq, hop=hop))
        S.append(np.array([0, hop, 0])); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, k_sq=0.0008)
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]
        p['squash'] = float(np.clip(sq[i] + r['sq'], -0.25, 0.24))
        p['tails'] = tails.step(r['t'], S[i], Rs[i], wind=np.array([14.0, 2.0, -3.0]), gust=0.8)   # summit breeze
    return recs

LIGHT = dict(sky='#a9bce2', ground='#c3cde3', hemi=1.55, key=0.25, keyCol='#c9d6f5', keyDir=[0.3, 1.0, 0.2], amb=0.16, ambCol='#b8c8ee', rim='#a9bce2', rimK=0.3, emK=0.34)
GRADE = dict(exposure=1.02, sat=0.92, contrast=0.88, haze=0.10, haze_col=(0.86, 0.72, 0.62), blur=1.5, wrap=0.4, wrap_sigma=10, grain=0.004, grain_size=1.2,
             highlight=0.85, shadow_k=0.15, shadow_soft=6, ao_k=0.55, ao_soft=4, ao_col=(0.55, 0.45, 0.4))

def jobs_and_frames(recs, ss_scale=1.0):
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        gp = rig.place(CAM, *scr(r['k'])[:2], r['upx'])[0]
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], LIGHT, r['upx'], ground=dict(pos=[float(x) for x in gp]), extent=(-26, 26, -12, 42))
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, [0.9 if r['t'] < T_LAND else 0.5 for r in recs])
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 900 + i
        sp = 1.5 if r['t'] < T_LAND else 1.0
        zz = smooth(T_LAND - 0.2, T_LAND + 0.9, r['t']); z = 1.0 + 0.55 * zz
        c = scr(r['k']) + np.array([0, 20.0])
        frames.append(dict(src=shotlib.src_weights(r['k'], n_blend=sp if sp > 1.2 else 1), layers=[(f'{OUT}/f{i:04d}', g, None)],
                           reframe=(z, 540 * (1 - zz) + c[0] * zz, 960 * (1 - zz) + c[1] * zz, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
