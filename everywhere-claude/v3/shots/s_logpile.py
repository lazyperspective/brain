# LOG PILE (IMG_1596 src 3.2-6.2, 6 beats). During the zoom it is a weightlifter on top of the log pile: clean (log at the
# chest, straining), anticipation dip, jerk overhead, wobbling hold, a sweat drop. The zoom jumps (lens switch at src 4.0) ->
# caught: eyes pop, freeze (music drop-out). The log slips... lands on its foot (thud on the beat, bark bits + dust) and it
# hops in pain holding its foot. Track: full-frame similarity through the zoom and the jump (0.2-0.6 px).
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, fx
from shotlib import wear_pose

NAME = 'logpile'; CLIP = 'IMG_1596'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1596a.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 9; NF = 90
OUT = f'{shotlib.ROOT}/render/{NAME}'
ANCH = np.array([482.0, 1410.0])      # on the top log, frame REF (src 4.4)
UPX_REF = 6.2
CAM = rig.Cam(4.0, pitch=0.5)
T_PRESS, T_CAUGHT, T_SLIP, T_THUD = 0.32, 0.90, 1.30, 1.50
FALL = T_THUD - (T_SLIP + 0.08)
LOG_UP = np.array([0, TOP + 7.6, 1.0])
LOG_CHEST = np.array([0, 9.0, 6.0])
LOG_REST = np.array([2.0, 2.4, 7.0])       # across the front-right foot (hero-local at the slip)

def scr(k, p=ANCH):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a
def scale_at(k): return track2d.local_scale(HS[int(k)], ANCH)

def hop_h(t):
    """pain hops after the thud: height (units)"""
    if t < T_THUD + 0.12: return 0.0
    d = t - (T_THUD + 0.12); ph = d / 0.32; n = int(ph); f = ph - n
    if f > 0.68: return 0.0                     # ground contact between hops
    return (3.6 - 0.35 * min(n, 4)) * math.sin(math.pi * f / 0.68)

def build():
    recs = []; wear = Wear(); S = []; Rs = []
    slip_state = {}
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        upx = UPX_REF * scale_at(k)
        drift = -9.0 * smooth(T_THUD + 0.1, 3.0, t)            # hops away from the log, to the left (units)
        hh = hop_h(t)
        p = scr(k, ANCH + np.array([drift * UPX_REF, 0]))
        yaw = Track([(0, -18), (T_CAUGHT, -18), (T_CAUGHT + 0.12, -6, 'out'), (T_THUD, -6), (T_THUD + 0.2, -30), (2.2, 10), (2.6, -25), (3.0, 5)])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=yaw)
        roll = 0.0
        if hh > 0: roll = 9 * math.sin((t - T_THUD) / 0.3 * math.pi)       # wobbly one-footed hops
        Rb = body_R(rot[1], 0, roll)
        root = P + Rb @ np.array([0, hh, 0])
        pose = {}
        shake = 0.5 * math.sin(t * 47) + 0.3 * math.sin(t * 31)
        if t < T_SLIP:
            if t < T_PRESS - 0.1:                    # clean: log at the chest, straining
                lp = LOG_CHEST + [shake * 0.3, 0, 0]; lr = [0, 0, 3 * shake]
                pose.update(eyes='squeeze', mouth='grit', blush=1.0)
            elif t < T_PRESS:                        # anticipation dip, then the jerk
                u = smooth(T_PRESS - 0.1, T_PRESS, t); lp = LOG_CHEST * (1 - u) + LOG_UP * u; lr = [0, 0, 0]
                pose.update(eyes='squeeze', mouth='grit', blush=1.0)
            else:
                frozen = t >= T_CAUGHT
                w = 0.0 if frozen else 1.0
                lp = LOG_UP + [shake * 0.8 * w + 0.6 * math.sin(t * 6) * w, 0.4 * math.sin(t * 9) * w, 0]
                lr = [0, 0, (5 * math.sin(t * 5.3) + 2 * shake) * w + (3 if frozen else 0)]
                if not frozen: pose.update(eyes='fierce', mouth='grit', blush=1.0)
                else: pose.update(eyes='wide', mouth='o', mouthOpen=0.7, blush=1.0, look=[0, 0.1])
                if t >= T_SLIP - 0.18:              # it wobbles... and the log starts to tip over
                    u = smooth(T_SLIP - 0.18, T_SLIP, t); lr = [0, 0, 3 + 22 * u]; lp = lp + [2.5 * u, -0.5 * u, 0]
                    pose['look'] = [0.5 * u, 0.6 * u]
            pose['log'] = dict(pos=[float(x) for x in lp], rot=[float(x) for x in lr])
            fy = lp[1] - 0.3; fz = lp[2]
            pose['arms'] = [{'fist': [-6.2 + lp[0], fy, fz]}, {'fist': [6.2 + lp[0], fy, fz]}]
            slip_state = dict(root=root.copy(), R=Rb.copy(), lp=np.array(lp), lr=lr, base0=rig.place(CAM, *scr(k, ANCH), upx)[0])
        else:
            # world-space log: falls from the hands onto the foot, small bounce, rests
            s0 = slip_state
            # the log lives on the tracked pile: offsets from the pile anchor (re-projected every frame, so it never slides)
            b_now, _ = rig.place(CAM, *scr(k, ANCH), upx); b_slip = s0['base0']
            Pw0 = s0['root'] + s0['R'] @ s0['lp'] - b_slip + b_now; Pw1 = s0['root'] + s0['R'] @ LOG_REST - b_slip + b_now
            u = (t - (T_SLIP)) / FALL
            if u < 1: Pw = Pw0 + (Pw1 - Pw0) * np.array([min(1, u), u * u, min(1, u)]) ; Pw = np.array([Pw0[0] + (Pw1[0] - Pw0[0]) * u, Pw0[1] + (Pw1[1] - Pw0[1]) * u * u, Pw0[2] + (Pw1[2] - Pw0[2]) * u])
            else:
                d = t - T_THUD; Pw = Pw1 + np.array([0, 1.4 * max(0, math.sin(math.pi * d / 0.16)) if d < 0.16 else 0, 0])
            yaw_w = math.degrees(math.atan2(s0['R'][0, 2], s0['R'][2, 2]))
            tilt = 25 * min(1, max(0, u)) if u < 1 else 25 - 22 * smooth(T_THUD, T_THUD + 0.12, t)
            pose['log'] = dict(pos=[float(x) for x in Pw], rot=[0, yaw_w + 15 * min(1, max(0, u)), tilt], world=True)
            if t < T_THUD:
                pose.update(eyes='wide', mouth='o', mouthOpen=1.0, look=[0.3, -0.9])
                pose['arms'] = [{'fist': [-BW / 2 - 2.5, TOP + 3, 1.0]}, {'fist': [BW / 2 + 2.5, TOP + 3, 1.0]}]
            else:   # OUCH: squeezed eyes, wavy open mouth, holding the right foot, other arm flailing
                pose.update(eyes='squeeze', mouth='ouch', mouthOpen=1.0, blush=1.0)
                fl = math.sin(t * 19)
                pose['arms'] = [{'fist': [-BW / 2 - 3.0 - 1.5 * fl, TOP + 3 + 2.5 * fl, 0]}, {'fist': [BW / 2 + 0.5, 4.5, 6.8]}]
                pose['feet'] = [[-4.4, 0, -5.4], [4.4, 3.6, 3.8], [-4.4, 0, 5.4], [4.4, 5.0, 6.6]]
                pose['footRot'] = [0, -20, 0, -35]
        if T_PRESS + 0.1 <= t < T_CAUGHT + 0.6: pose['sweat'] = sweat(t, T_PRESS + 0.1, 0.75)
        if t >= T_THUD + 0.05: pose['sweat'] = sweat(t, T_THUD + 0.05, 0.6)
        op = blinks(t, seed=5, extra=[2.3])
        if pose['eyes'] in ('fierce', 'wide', 'open'): pose['open'] = min(op, 1.0)
        if pose['eyes'] == 'wide' and t < T_CAUGHT + 0.06: pose['open'] = 0.35 + 0.65 * smooth(T_CAUGHT, T_CAUGHT + 0.05, t)
        sq = 0.0
        if T_PRESS - 0.1 <= t < T_PRESS: sq = 0.16 * math.sin(math.pi * smooth(T_PRESS - 0.1, T_PRESS, t))   # dip
        if T_PRESS <= t < T_PRESS + 0.12: sq = -0.14 * (1 - smooth(T_PRESS, T_PRESS + 0.12, t))            # drive up
        if 0.38 < t < T_CAUGHT: sq += 0.05 + 0.03 * math.sin(t * 23)                                       # knees buckling under the weight
        if hh > 0: sq += -0.12 * math.sin(math.pi * min(1, hh / 5)) if hop_h(t + 0.02) > hh else 0.0
        if T_THUD - 0.02 <= t < T_THUD + 0.1: sq += 0.16
        recs.append(dict(t=t, k=k, p=p, upx=upx, root=root, R=Rb, pose=pose, sq=sq, hh=hh, base=P))
        S.append(np.array([drift, hh, 0])); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, k_sq=0.0007, impulses=[(int(T_CAUGHT * 30), 0, -1.5, -2.0), (int(T_THUD * 30), 1.5, 0, 2.5)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]
        p['squash'] = float(np.clip(sq[i] + r['sq'], -0.25, 0.24))
        wear_pose(p, wear, r['t'], S[i], r['R'], wind=np.array([6.0, 0, 2.0]), gust=0.6)
    return recs

GRADE = dict(exposure=1.08, sat=0.95, contrast=0.9, haze=0.12, haze_col=(0.80, 0.80, 0.78), blur=1.15, wrap=0.35, wrap_sigma=8, grain=0.011, grain_size=1.0, highlight=0.85,
             shadow_k=0.25, shadow_soft=5, ao_k=0.55, ao_soft=3, ao_col=(0.35, 0.33, 0.33), ca=1.1)

def wire_matte(k):
    a, b = scr(k, np.array([100.0, 1397.0])), scr(k, np.array([760.0, 1391.0])); w = max(1.2, 2.2 * scale_at(k))
    def m(x0, y0, x1, y1):
        img = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.line(img, (int(a[0] - x0) * 4, int(a[1] - y0) * 4), (int(b[0] - x0) * 4, int(b[1] - y0) * 4), 0.5, max(1, int(round(w))), lineType=cv2.LINE_AA, shift=2)
        return cv2.GaussianBlur(img, (0, 0), 0.7)
    return m

def bursts(recs):
    r = [r for r in recs if r['t'] >= T_THUD][0]
    lw = r['pose']['log']['pos']; s = CAM.project(np.array(lw) - np.array([0, 2.0, 0]))
    ref = track2d.apply(np.linalg.inv(HS[int(r['k'])]), [s])[0]
    return [fx.Burst(T_THUD, ref, 14, (60, 200), angle=(-170, -10), gravity=900, drag=3.0, life=(0.3, 0.6), size=(1.0, 1.8), col=(0.30, 0.42, 0.55), kind='stick', seed=4, spin=8),
            fx.Burst(T_THUD, ref, 10, (30, 90), angle=(-170, -10), gravity=200, drag=4.0, life=(0.4, 0.8), size=(2.0, 3.5), col=(0.62, 0.66, 0.68), kind='dot', seed=5, alpha=0.5, puff=0.35, puff_r=22)]

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=1.05, emK=0.1)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], ground=dict(pos=[float(x) for x in r['base']]), extent=(-30, 30, -14, 44))
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    B = bursts(recs)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 300 + i
        g['ao_k'] *= math.exp(-r['hh'] / 3)
        zz = smooth(0.0, 1.0, r['t']); z = 1.25 + 0.3 * zz
        c = r['p'] + np.array([0, -70.0])
        Hk = HS[int(r['k'])]; t = r['t']
        post = (lambda img, ii, Hk=Hk, t=t: (fx.draw_bursts(img, B, t, lambda P: track2d.apply(Hk, P), scale=track2d.local_scale(Hk, ANCH)), img)[1])
        frames.append(dict(src=[(r['k'], 1.0)], layers=[(f'{OUT}/f{i:04d}', g, wire_matte(r['k']))], post=post, reframe=(z, c[0], c[1], 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
