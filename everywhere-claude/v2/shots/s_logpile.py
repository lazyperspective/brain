# LOG PILE (IMG_1596 src 3.0-5.5): the zoom lands on it mid-yawn-stretch on top of the log pile; eyes pop (caught),
# freeze, arms come down veeery slowly as if that makes it invisible.  2.5 s / 5 beats.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v2/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d

NAME = 'logpile'; CLIP = 'IMG_1596'
TR = json.load(open('/home/user/brain/everywhere-claude/v2/track/1596a.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 3; NF = 75
OUT = f'{shotlib.ROOT}/render/{NAME}'
ANCH = np.array([482.0, 1410.0])      # on the top log, frame REF (src 4.4)
UPX_REF = 6.2
CAM = rig.Cam(4.0, pitch=0.5)
T_OPEN, T_BIP = 1.38, 1.5

def scr(k, p=ANCH):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a
def scale_at(k): return track2d.local_scale(HS[int(k)], ANCH)

def build():
    recs = []; tails = Tails(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        p = scr(k); upx = UPX_REF * scale_at(k)
        yaw = Track([(0, -24), (T_OPEN, -24), (T_OPEN + 0.25, -12, 'out'), (2.5, -10)])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=yaw)
        Rb = body_R(rot[1])
        pose = {}
        sway = math.sin(t * 2 * math.pi / 1.6)
        if t < T_OPEN:      # big lazy stretch + yawn
            up = 1.0
            pose.update(eyes='closed', mouth='yawn', mouthOpen=0.75 + 0.25 * math.sin(min(1, t / 1.2) * math.pi), blush=1.0)
            pose['lean'] = [0.0 + 0.6 * sway, -1.2]
            pose['squash'] = -0.13
        else:
            # caught: mouth stuck open, then slowly closes; arms come down veeery slowly
            u = smooth(T_OPEN + 0.35, 2.5, t)
            up = 1.0 - 0.75 * u
            mo = 1.0 - smooth(T_OPEN + 0.15, T_OPEN + 0.9, t) * 0.75
            pose.update(eyes='wide', mouth='yawn' if mo > 0.45 else 'o', mouthOpen=mo if mo > 0.45 else 0.6, blush=1.0)
            lk = Track([(T_OPEN, [0, 0]), (1.95, [0, 0]), (2.02, [-0.9, 0]), (2.16, [-0.9, 0]), (2.22, [0.9, 0]), (2.36, [0.9, 0]), (2.42, [0, 0])])(t)
            pose['look'] = [float(lk[0]), float(lk[1])]
            pose['lean'] = [0.0, -1.2 * (1 - u)]
            pose['squash'] = -0.13 * (1 - smooth(T_OPEN, T_OPEN + 0.12, t)) + 0.06 * smooth(T_OPEN, T_OPEN + 0.12, t) * (1 - u * 0.5)
        # arms: straight up (stretch) -> lowering; fists swing out a bit on the way down
        top = TOP + 9.0
        fy = 6.6 + (top - 6.6) * up
        fx = BW / 2 + 1.3 + 2.5 * math.sin(math.pi * (1 - up)) if up < 1 else 2.6
        fz = 1.0
        stretch = 1.0 if t < T_OPEN else 0.0
        wig = 0.5 * math.sin(t * 7) * stretch
        pose['arms'] = [{'fist': [-fx, fy + wig, fz]}, {'fist': [fx, fy - wig, fz]}]
        op = blink_open(t, seed=5, period=(9, 10), extra=[2.3])
        if pose['eyes'] == 'wide':
            pose['open'] = min(op, 0.35 + 0.65 * smooth(T_OPEN, T_OPEN + 0.05, t))
        pose['feet'] = [[-4.4, 0, -5.4], [4.4, 0, -5.4], [-4.4, 0, 5.4], [4.4, 0, 5.4]]
        recs.append(dict(t=t, k=k, p=p, upx=upx, root=P, R=Rb, pose=pose))
        S.append(np.zeros(3)); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, impulses=[(int(T_OPEN * 30), 0, -1.5, -2.0)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(p['lean'][0] + lean[i][0]), float(p['lean'][1] + lean[i][1])]
        p['squash'] = float(np.clip(p['squash'] + sq[i], -0.25, 0.24))
        p['tails'] = tails.step(r['t'], S[i], Rs[i], wind=np.array([6.0, 0, 2.0]), gust=0.6)
    return recs

LIGHT = dict(sky='#d6dde6', ground='#7a8752', hemi=1.6, key=0.7, keyCol='#fff6ee', keyDir=[-0.4, 1.0, 0.5], amb=0.12, rim='#dfe6ee', rimK=0.25, emK=0.2)
GRADE = dict(exposure=1.14, sat=0.95, contrast=0.9, haze=0.12, haze_col=(0.80, 0.80, 0.78), blur=1.15, wrap=0.35, wrap_sigma=8, grain=0.011, grain_size=1.0, highlight=0.85,
             shadow_k=0.25, shadow_soft=5, ao_k=0.55, ao_soft=3, ao_col=(0.35, 0.33, 0.33))

def wire_matte(k):
    a, b = scr(k, np.array([100.0, 1397.0])), scr(k, np.array([760.0, 1391.0])); w = max(1.2, 2.2 * scale_at(k))
    def m(x0, y0, x1, y1):
        img = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.line(img, (int(a[0] - x0) * 4, int(a[1] - y0) * 4), (int(b[0] - x0) * 4, int(b[1] - y0) * 4), 0.5, max(1, int(round(w))), lineType=cv2.LINE_AA, shift=2)
        return cv2.GaussianBlur(img, (0, 0), 0.7)
    return m

def jobs_and_frames(recs, ss_scale=1.0):
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], LIGHT, r['upx'], ground=dict(pos=[float(x) for x in r['root']]), extent=(-26, 26, -14, 40))
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 300 + i
        zz = smooth(0.9, 1.7, r['t']); z = 1.0 + 0.45 * zz
        c = r['p'] + np.array([0, -70.0])
        frames.append(dict(src=[(r['k'], 1.0)], layers=[(f'{OUT}/f{i:04d}', g, wire_matte(r['k']))], reframe=(z, 540 * (1 - zz) + c[0] * zz, 960 * (1 - zz) + c[1] * zz, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
