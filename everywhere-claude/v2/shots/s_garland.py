# GARLAND (IMG_1623 src 6.6-8.1): as the zoom settles it is hanging from a light string among the glowing doves, legs
# swinging; the frame stops -> it freezes, eyes shut, and pretends to be an ornament, glowing in time with the twinkle.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v2/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d

NAME = 'garland'; CLIP = 'IMG_1623'
TR = json.load(open('/home/user/brain/everywhere-claude/v2/track/1623.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 6; NF = 45
OUT = f'{shotlib.ROOT}/render/{NAME}'
GRIP = np.array([700.0, 513.0])      # on the top light string (ref frame src 7.7)
UPX_REF = 5.0
CAM = rig.Cam(16.0, pitch=8.0)
T_FREEZE = 0.82
GRIP_LOCAL = np.array([0, TOP + 5.6, 0.8])
FISTS = [[-2.4, TOP + 5.0, 0.8], [2.4, TOP + 5.0, 0.8]]

def scr(k, p=GRIP):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a

def glow(t):   # twinkle pulses on the beat after the freeze
    g = 0.0
    for t0 in (1.0, 1.25):
        g = max(g, math.exp(-((t - t0) / 0.06) ** 2))
    return g

def build():
    recs = []; tails = Tails(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        g = scr(k); upx = UPX_REF * track2d.local_scale(HS[int(k)], GRIP)
        G = CAM.unproject(g[0], g[1], CAM.dist_for(g[0], g[1], upx))
        h = -G.copy(); h[1] = 0; h /= np.linalg.norm(h); th0 = math.degrees(math.atan2(h[0], h[2]))
        sw = 16 * math.sin(t * 2 * math.pi / 0.9) if t < T_FREEZE else 16 * math.sin(T_FREEZE * 2 * math.pi / 0.9) * math.exp(-(t - T_FREEZE) * 14)
        yaw = Track([(0, 30), (T_FREEZE, 30), (T_FREEZE + 0.1, 0, 'out'), (2, 0)])(t)
        R0 = rotY(th0 + yaw) @ rotX(-6)
        a = math.radians(sw); K = np.array([[0, -h[2], h[1]], [h[2], 0, -h[0]], [-h[1], h[0], 0]])
        Rb = (np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * K @ K) @ R0
        root = G - Rb @ GRIP_LOCAL
        kick = math.sin(t * 2 * math.pi / 0.45) if t < T_FREEZE else 0.0
        frozen = t >= T_FREEZE
        pose = dict(arms=[{'fist': FISTS[0]}, {'fist': FISTS[1]}])
        if not frozen:
            pose['feet'] = [[-4.2, -0.6 + max(0, kick) * 2, -4.6 + 2 * kick], [4.2, -0.6 + max(0, -kick) * 2, -4.6 - 2 * kick], [-4.2, -0.4 + max(0, -kick) * 2, 4.6 - 2 * kick], [4.2, -0.4 + max(0, kick) * 2, 4.6 + 2 * kick]]
            pose.update(eyes='happy', mouth='grin', mouthOpen=0.8, blush=1.0)
        else:
            pose['feet'] = [[-4.0, -0.9, -4.8], [4.0, -0.9, -4.8], [-4.0, -0.9, 4.8], [4.0, -0.9, 4.8]]
            pose.update(eyes='closed', mouth='smile', blush=1.0 + 0.6 * glow(t))
            if t > 1.36: pose.update(eyes='open', openL=0.0, openR=1.0, look=[0.6, 0.2])   # peeks with one eye: still being watched?
        recs.append(dict(t=t, k=k, g=g, upx=upx, root=root, R=Rb, pose=pose, glow=glow(t) if frozen else 0.0))
        S.append(root - G); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, k_lean=0.004, k_sq=0.0003, impulses=[(int(T_FREEZE * 30), 1.5, 0, 0)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]; p['squash'] = float(np.clip(sq[i], -0.1, 0.1))
        p['tails'] = tails.step(r['t'], S[i], Rs[i], wind=np.array([2.0, 0, 0]), gust=0.6)
    return recs

def light_for(r):
    gl = r['glow']
    return dict(sky='#aeb9cc', ground='#7d6a58', hemi=1.25, key=0.9, keyCol='#ffbf73', keyDir=[0.5, 0.2, 0.8], fill=0.45, fillCol='#ffd29a', fillDir=[-0.7, -0.1, 0.5],
                amb=0.1, ambCol='#ffe0b8', rim='#ffb45e', rimK=0.6, emK=0.22 + 0.9 * gl)
GRADE = dict(exposure=1.0, sat=1.0, contrast=0.95, blur=1.0, wrap=0.45, wrap_sigma=8, grain=0.01, grain_size=1.0, highlight=0.85)

def jobs_and_frames(recs, ss_scale=1.0):
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], light_for(r), r['upx'], extent=(-24, 24, -26, 30))
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 1300 + i
        zz = smooth(0.4, 1.0, r['t']); z = 1.0 + 0.4 * zz; c = r['g'] + np.array([0, 60.0])
        frames.append(dict(src=[(r['k'], 1.0)], layers=[(f'{OUT}/f{i:04d}', g, None)], reframe=(z, 540 * (1 - zz) + c[0] * zz, 960 * (1 - zz) + c[1] * zz, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
