# v3: the chase continues from the bales - it runs in from the right edge (screen direction kept: it left the bales
# running left), swerves in beside the shoes and falls into step; then turns, looks up, waves. Image-based light, scarf.
# SHOES (IMG_1606 src 0.8-2.3): walking right beside the user's feet, step for step; turns, walks backwards looking up into
# the lens, cheery wave.  1.5 s / 3 beats.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v4/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d
from shotlib import wear_pose

NAME = 'shoes'; CLIP = 'IMG_1606'
TR = json.load(open('/home/user/brain/everywhere-claude/v4/track/1606.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 3; NF = 45
OUT = f'{shotlib.ROOT}/render/{NAME}'
UPX = 9.8
P_SCR = np.array([352.0, 1170.0])
T_IN, T_TURN0, T_TURN1, T_WAVE = 0.42, 0.70, 0.92, 0.96
START = np.array([1150.0, 1000.0])

def ground_vel(k, p):
    """screen velocity (px/frame) of the ground point under screen point p at frame k"""
    k0 = int(k); g = track2d.apply(np.linalg.inv(HS[k0]), [p])[0]
    return track2d.apply(HS[min(k0 + 1, NSRC - 1)], [g])[0] - p

def build():
    recs = []; wear = Wear(); S = []; Rs = []; dist = 0.0; prev_off = None
    rot_ref = track2d.local_rot(HS[REF], P_SCR)
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        u_in = min(1.0, t / T_IN); off = (START - P_SCR) * (1 - u_in) ** 1.6
        p = P_SCR + np.array([6 * math.sin(t * 3), 0]) + off
        v = ground_vel(k, p); dist += np.linalg.norm(v) / UPX
        if prev_off is not None: dist += np.linalg.norm(off - prev_off) / UPX
        prev_off = off
        roll = track2d.local_rot(HS[k], track2d.apply(np.linalg.inv(HS[k]), [p])[0]) - rot_ref
        cam = rig.Cam(65.0, pitch=-68.0, roll=roll)
        yaw = Track([(0, -96), (T_IN - 0.08, -96), (T_IN + 0.12, -180, 'io'), (T_TURN0, -180), (T_TURN1, -352, 'io'), (1.5, -360)])(t)
        P, rot = rig.place(cam, p[0], p[1], UPX, yaw_rel=yaw)
        bp = -18 * smooth(T_TURN1 - 0.1, T_TURN1 + 0.12, t)        # lean back to look up into the lens
        Rb = body_R(rot[1], bp, 0)
        stepd = dist / 18.0
        if T_TURN0 < t < T_TURN1: stepd = dist / 18.0 + 0.5 * smooth(T_TURN0, T_TURN1, t)
        pose = dict(step=float(stepd), stepDir=[0, 1 if t < T_TURN0 else -1], stepAmp=2.4, stepLift=2.2)
        sw = math.sin(stepd * 2 * math.pi)
        if t < T_WAVE:
            pose['arms'] = [{'fist': [-BW / 2 - 1.3, 6.8, 1.5 + 2.5 * sw]}, {'fist': [BW / 2 + 1.3, 6.8, 1.5 - 2.5 * sw]}]
            pose.update(eyes='open', mouth='smile', look=[0, 0])
        else:
            w = math.sin((t - T_WAVE) * 2 * math.pi * 2.8)
            pose['arms'] = [{'fist': [-BW / 2 - 1.3, 6.8, 1.5 + 2.5 * sw]}, {'fist': [BW / 2 + 3.0 + 2.0 * w, TOP + 6.0 - 0.6 * abs(w), 3.0], 'rot': [0, 0, -22 * w]}]
            pose.update(eyes='happy', mouth='grin', mouthOpen=0.9, look=[0, -0.6], blush=1.0)
        op = blinks(t, seed=13, extra=[0.62])
        if pose['eyes'] == 'open': pose['open'] = op
        bob = 0.04 * abs(math.sin(stepd * 2 * math.pi))
        recs.append(dict(t=t, k=k, p=p, cam=cam, root=P, R=Rb, pose=pose, bob=bob, yaw=yaw))
        # sim space: walking forward along -z' (screen up) at the ground speed
        S.append(np.array([off[0] / UPX, 0.0, -dist])); Rs.append(rotY(yaw) @ rotX(bp))
    lean, sq = body_dyn(np.array(S), Rs, k_lean=0.01, k_sq=0.0006)
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1] + (3.2 if r['t'] < T_IN else (1.6 if r['t'] < T_TURN0 else 0)))]
        p['squash'] = float(np.clip(sq[i] + r['bob'], -0.2, 0.2))
        wear_pose(p, wear, r['t'], S[i], Rs[i], wind=np.array([0, 0, 0.0]), gust=0.8)
    return recs

LIGHT = dict(sky='#e3e7ee', ground='#8a8a8a', hemi=1.6, key=0.6, keyCol='#fff7ef', keyDir=[-0.3, 1.0, 0.3], amb=0.12, rim='#e3e7ee', rimK=0.25, emK=0.2)
GRADE = dict(exposure=1.02, sat=0.95, contrast=0.95, blur=0.55, wrap=0.2, wrap_sigma=6, grain=0.014, grain_size=0.8, highlight=0.9,
             shadow_k=0.22, shadow_soft=8, shadow_col=(0.5, 0.5, 0.55), ao_k=0.5, ao_soft=3, ao_col=(0.3, 0.3, 0.32))

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: r['cam'], envK=1.0, emK=0.08)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        gp, _ = rig.place(r['cam'], r['p'][0], r['p'][1], UPX)
        j = rig.job(f'{OUT}/f{i:04d}', r['cam'], r['root'], r['R'], r['pose'], r['light'], UPX, env=r['env'], ground=dict(pos=[float(x) for x in gp]), extent=(-30, 30, -30, 30))
        j['ss'] = round(min(2.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(r['cam'].project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 1100 + i
        frames.append(dict(src=[(r['k'], 1.0)], layers=[(f'{OUT}/f{i:04d}', g, None)], reframe=(1.12, 470, 1150, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
