# v3: image-based light, scarf, sweat when caught, a burst of hay bits + dust as it bolts; no pixel glitch-out any more -
# it runs out of frame to the left and the chase continues in the next shot (it runs in from the left beside the shoes).
# HAY BALES (IMG_1596 src 8.6-10.6): a sixth, coral "bale" at the end of the row, squashed flat, eyes shut, stock-still.
# The pan passes; ONE eye opens... both pop wide (caught) ... it bolts left, outrunning the pan, and glitches out.  2.0 s / 4 beats.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v4/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, fx
from shotlib import wear_pose

NAME = 'bales'; CLIP = 'IMG_1596'
TR = json.load(open('/home/user/brain/everywhere-claude/v4/track/1596b.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 3; NF = 60
OUT = f'{shotlib.ROOT}/render/{NAME}'
ANCH = np.array([790.0, 1175.0])
UPX_REF = 5.4
CAM = rig.Cam(4.0, pitch=0.3)
T_WINK, T_BOTH, T_POP, T_RUN, T_GLITCH = 0.92, 1.12, 1.25, 1.33, 1.50

def scr(k, p=ANCH):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a

def build():
    recs = []; wear = Wear(); S = []; Rs = []
    xrun = 0.0; v = 0.0
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        sc = track2d.local_scale(HS[int(k)], ANCH); upx = UPX_REF * sc
        # run: ground-relative displacement to the left (frame-REF px), accelerating hard
        if t >= T_RUN:
            v = min(4200.0, max(1600.0, v + 16000.0 / 30.0)); xrun -= v / 30.0
        p = scr(k, ANCH + np.array([xrun, 0.0]))
        yaw = Track([(0, 0), (T_POP, 0), (T_RUN, -80, 'out'), (2, -80)])(t)
        twist = Track([(0, 0), (T_POP, 0), (T_RUN, 30, 'out'), (T_RUN + 0.1, 10), (2, 10)])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=yaw)
        Rb = body_R(rot[1])
        pose = dict(twist=twist)
        if t < T_POP:
            pose.update(eyes='open', mouth='none', blush=0.0, squash=0.22, arms=[{'hide': True}, {'hide': True}],
                        feet=[[-4.6, 0, -5.0], [4.6, 0, -5.0], [-4.6, 0, 5.0], [4.6, 0, 5.0]])
            pose['openL'] = 0.0 if t < T_WINK else (1.0 if t >= T_BOTH else 0.0)
            pose['openR'] = 0.0 if t < T_WINK else smooth(T_WINK, T_WINK + 0.05, t)
            if t >= T_BOTH: pose['eyes'] = 'wide'
            if t >= T_WINK: pose['look'] = [0.5 * smooth(T_WINK + 0.08, T_WINK + 0.14, t), 0]
        else:
            run = t >= T_RUN
            pose.update(eyes='wide', mouth='o' if not run else 'grit', squash=-0.18 if not run else 0.0)
            if run:
                d = -xrun / UPX_REF
                pose.update(step=float(d / 20.0), stepDir=[0, 1], stepAmp=3.5, stepLift=3.0)
                sw = math.sin(d / 20.0 * 2 * math.pi)
                pose['arms'] = [{'fist': [-BW / 2 - 1.3, 7.5, 1.0 + 3.5 * sw]}, {'fist': [BW / 2 + 1.3, 7.5, 1.0 - 3.5 * sw]}]
                pose['lean'] = [0, 3.0]
            else:
                pose['arms'] = [{'fist': [-BW / 2 - 2.0, 11, 1]}, {'fist': [BW / 2 + 2.0, 11, 1]}]
        if T_BOTH <= t < T_RUN + 0.4: pose['sweat'] = sweat(t, T_BOTH + 0.02, 0.45)
        recs.append(dict(t=t, k=k, p=p, upx=upx, root=P, R=Rb, pose=pose, xrun=xrun))
        S.append(np.array([xrun / UPX_REF, 0, 0])); Rs.append(body_R(-90 if t >= T_RUN else 0))
    lean, sq = body_dyn(np.array(S), Rs, k_lean=0.004, k_sq=0.0004, impulses=[(int(T_POP * 30), 0, 0, 2.5)])
    for i, r in enumerate(recs):
        p = r['pose']; L0 = p.get('lean', [0, 0])
        p['lean'] = [float(L0[0] + lean[i][0]), float(L0[1] + lean[i][1])]
        p['squash'] = float(np.clip(p.get('squash', 0) + sq[i], -0.25, 0.24))
        tl, scf = wear.step(r['t'], S[i], Rs[i], wind=np.array([4.0, 0, 0]), gust=0.4)
        if r['t'] < T_POP:   # limp, tucked against the back like bale wrap
            tl = [[[0.2 * q, -0.9 * q, -0.15 * q] for q in range(n + 1)] for n in (7, 6)]
        p['tails'] = tl; p['scarf'] = scf
    return recs

LIGHT = dict(sky='#d6dde6', ground='#7a8752', hemi=1.7, key=0.9, keyCol='#fff6ee', keyDir=[-0.35, 0.8, 0.9], amb=0.15, rim='#dfe6ee', rimK=0.25, emK=0.25)
GRADE = dict(exposure=1.14, sat=0.95, contrast=0.9, haze=0.12, haze_col=(0.80, 0.80, 0.78), blur=1.1, wrap=0.35, wrap_sigma=8, grain=0.011, grain_size=1.0, highlight=0.85,
             shadow_k=0.25, shadow_soft=5, ao_k=0.6, ao_soft=3, ao_col=(0.35, 0.33, 0.33))

GRADE.update(ca=1.1, exposure=1.08)

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=1.05, emK=0.1)
    jobs, frames, pts = [], [], []
    B = [fx.Burst(T_RUN, ANCH + np.array([10.0, -14]), 22, (60, 260), angle=(-175, -60), gravity=500, drag=3.0, life=(0.4, 0.9), size=(1.0, 1.8),
                  col=(0.42, 0.72, 0.78), kind='stick', seed=9, spin=10),
         fx.Burst(T_RUN, ANCH + np.array([20.0, -2]), 8, (20, 80), angle=(-170, -20), gravity=150, drag=4.0, life=(0.5, 0.9), size=(2.5, 4.0),
                  col=(0.66, 0.72, 0.72), kind='dot', seed=10, alpha=0.45, puff=0.3, puff_r=18)]
    for i, r in enumerate(recs):
        hide = r['p'][0] < -160
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], ground=dict(pos=[float(x) for x in r['root']]), extent=(-28, 28, -14, 34), hide=hide)
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.55)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 500 + i
        layers = [] if r['p'][0] < -160 else [(f'{OUT}/f{i:04d}', g, None)]
        Hk = HS[int(r['k'])]; t = r['t']
        row = scr(r['k'], np.array([640.0, 1130.0]))          # window locked to the row, the coral bale right of centre
        drift = (r['t'] - 1.0) * 120.0                          # a little residual pan so the plate still moves
        cx = row[0] + drift; cy = row[1]
        post = (lambda img, ii, Hk=Hk, t=t: (fx.draw_bursts(img, B, t, lambda P: track2d.apply(Hk, P), scale=track2d.local_scale(Hk, ANCH)), img)[1])
        frames.append(dict(src=[(r['k'], 1.0)], layers=layers, pre=post, reframe=(2.0, cx, cy, 0.0)))
    return jobs, frames

PIXS = [f'{shotlib.PIX}/bales_{i}.png' for i in range(3)]

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
