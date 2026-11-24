# ENDING (IMG_1631 src 1.0-8.3, 13 beats). The music has stopped. The x15 zoom (1.25x speed) pushes in on the blue-hour summit;
# it runs in from the left along the ridge (the whip-pan chase continues), skids to a stop on the top and plants a tiny
# coral flag in the snow (anticipation, thump, snow puff; the flag flutters from then on). The real ridge is traced in gold
# from the image and its mirror floats upside down in the sky as a ghost mountain, a star at the mirror point - it looks up
# at it. Then it turns, looks straight back at us through binoculars (the reversal), lowers them, happy eyes, waves, fist
# pump with squash-bounce and the boop. Hard cut to black.  Track: CLAHE + similarity through the zoom (0.2-0.6 px).
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, fx, magic
from shotlib import wear_pose

NAME = 'summit'; CLIP = 'IMG_1631'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1631.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
NF = 195
OUT = f'{shotlib.ROOT}/render/{NAME}'
RIDGE = np.load('/home/user/brain/everywhere-claude/v3/track/ridge1631.npy')       # skyline traced from the ref frame (src 6.0)
ANCH = np.array([560.0, float(np.interp(560, RIDGE[:, 0], RIDGE[:, 1])) + 4.0])
UPX_REF = 5.6
CAM = rig.Cam(4.5, pitch=1.0)
T_ZOOM = 3.2                                    # zoom lands (src 5.0)
T_RUN0, T_ARRIVE = 0.0, 2.45
T_RAISE, T_PLANT = 2.62, 2.95
T_P0, T_P1, T_G0, T_G1, T_STAR, T_F0, T_F1 = 3.25, 3.75, 3.45, 4.0, 3.95, 4.45, 4.85
T_LOOKUP0, T_LOOKUP1 = 3.5, 4.3
T_BINO, T_LOWER, T_WAVE, T_PUMP = 4.42, 5.05, 5.3, 6.05
MIRROR_DY = 260.0

def src_t(t): return 1.0 + 1.25 * t if t < T_ZOOM else 5.0 + (t - T_ZOOM)
def kf(t): return (src_t(t) - T0) * 30.0
def scr(k, p=ANCH):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a
def ridge_y(x): return float(np.interp(x, RIDGE[:, 0], RIDGE[:, 1]))

def run_x(t):
    """ref-frame x along the ridge: runs in from the left, skids to a stop on the top with a little overshoot"""
    if t < T_RUN0: return 300.0
    if t < T_ARRIVE: return 150 + (ANCH[0] + 14 - 150) * EASE['out'](smooth(T_RUN0, T_ARRIVE, t) ** 0.8)
    return ANCH[0] + 14 * math.exp(-(t - T_ARRIVE) * 9) * math.cos((t - T_ARRIVE) * 14)

def build():
    recs = []; wear = Wear(); S = []; Rs = []; dist = 0.0; prev = None; planted = None
    for i in range(NF):
        t = i / 30.0; k = kf(t)
        x = run_x(t); gref = np.array([x, ridge_y(x) + 4.0])
        sc = track2d.local_scale(HS[int(k)], gref); upx = UPX_REF * sc
        def bounce(t0, h, d=0.3): return h * max(0, math.sin(math.pi * (t - t0) / d)) if t0 <= t <= t0 + d else 0.0
        hop = bounce(T_PUMP + 0.04, 3.5) + bounce(T_PUMP + 0.42, 1.6, 0.22)
        if prev is not None: dist += abs(x - prev) / UPX_REF
        prev = x
        p = scr(k, gref) + np.array([0, -hop * upx])
        running = T_RUN0 <= t < T_ARRIVE + 0.05
        yaw = Track([(0, 80), (T_ARRIVE, 80), (T_ARRIVE + 0.2, 25, 'back'), (T_RAISE, 30), (T_PLANT + 0.2, 20), (T_LOOKUP0, 10), (T_BINO - 0.12, 10), (T_BINO, 0, 'out'),
                     (T_WAVE, 0), (T_WAVE + 0.3, 8), (5.9, 8), (T_PUMP, 0)])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=yaw)
        tilt = -9 * smooth(T_LOOKUP0, T_LOOKUP0 + 0.15, t) * (1 - smooth(T_LOOKUP1, T_LOOKUP1 + 0.15, t))     # leans back looking up
        Rb = body_R(rot[1], tilt, 0)
        pose = dict()
        if running:
            st = dist / 22.0; sw = math.sin(st * 2 * math.pi)
            pose.update(step=float(st), stepDir=[0, 1], stepAmp=3.2, stepLift=2.8)
            pose['arms'] = [{'fist': [-BW / 2 - 1.3, 7.2, 1.0 + 3.2 * sw]}, {'fist': [BW / 2 + 1.4, 7.4, 1.0]}]
        # the flag: carried over the shoulder -> raised -> planted (then world-fixed, fluttering)
        if t < T_RAISE:
            fp = [BW / 2 + 1.4, 3.0, -1.5]; fr = [-32, 0, 0]
            if not running: pose['arms'] = [{'fist': [-BW / 2 - 1.3, 6.6, 2.0]}, {'fist': [BW / 2 + 1.4, 7.4, 1.0]}]
            pose['flag'] = dict(pos=fp, rot=fr, h=21, w=7.0, hh=4.4, phase=t * 14, amp=1.1 if running else 0.6)
        elif t < T_PLANT:
            u = smooth(T_RAISE, T_RAISE + 0.15, t); d = smooth(T_PLANT - 0.08, T_PLANT, t)
            fp = [BW / 2 + 5.0, 3.0 + 7.0 * u - 10.0 * d, 3.0]
            pose['flag'] = dict(pos=fp, rot=[0, 0, -8 * u], h=21, w=7.0, hh=4.4, phase=t * 10, amp=0.6)
            pose['arms'] = [{'fist': [-BW / 2 - 1.3, 6.6, 2.0]}, {'fist': [fp[0] - 0.4, fp[1] + 4.5, fp[2]]}]
            planted = (P, Rb, fp)
        else:
            P0, R0, fp = planted
            fx_ = ANCH[0] + 66.0; fref = np.array([fx_, ridge_y(fx_) + 2.0])      # planted: anchored to the tracked ridge
            fs = scr(k, fref); fw, _ = rig.place(CAM, fs[0], fs[1], upx)
            wpos = fw + np.array([0, -0.6, 0])
            yaw_w = math.degrees(math.atan2(R0[0, 2], R0[2, 2]))
            pose['flag'] = dict(pos=[float(v) for v in wpos], rot=[0, yaw_w - 60, 0], world=True, h=21, w=7.0, hh=4.4, phase=t * 9, amp=0.9)
        # binoculars, wave, pump (as v2, retimed)
        if T_BINO - 0.15 <= t < T_WAVE:
            lw = smooth(T_LOWER, T_LOWER + 0.3, t); rz = smooth(T_BINO - 0.15, T_BINO, t)
            eye_y = FOOT + BH * 0.56
            bpos = [0, eye_y - 6 * (1 - rz) - 3.6 * lw, BD / 2 + 2.3 + 0.6 * lw]
            pose['binoc'] = dict(pos=bpos, pitch=10 * lw)
            pose['arms'] = [{'fist': [-3.6, bpos[1] - 1.2, bpos[2] - 0.6]}, {'fist': [3.6, bpos[1] - 1.2, bpos[2] - 0.6]}]
        elif t >= T_WAVE:
            pose['binoc'] = dict(pos=[-BW / 2 - 1.6, 3.6, 3.0], pitch=70)
            pose['arms'] = [{'fist': [-BW / 2 - 1.6, 6.2, 2.0]}, None]
            if t < T_PUMP - 0.2:
                w = math.sin((t - T_WAVE) * 2 * math.pi * 2.6)
                pose['arms'][1] = {'fist': [BW / 2 + 3.2 + 2.2 * w, TOP + 6.5 - 0.8 * abs(w), 2.0], 'rot': [0, 0, -25 * w]}
            else:
                u = smooth(T_PUMP - 0.2, T_PUMP - 0.08, t) * (1 - smooth(T_PUMP - 0.08, T_PUMP, t))
                up = smooth(T_PUMP - 0.04, T_PUMP + 0.06, t)
                pose['arms'][1] = {'fist': [BW / 2 + 1.6 + 1.2 * up, 6.2 - 2.5 * u + up * 19, 1.8 + 1.0 * up], 'rot': [0, 0, -12 * up]}
            pose['arms'] = [a or {} for a in pose['arms']]
        elif t >= T_PLANT and 'arms' not in pose:
            pose['arms'] = [{'fist': [-BW / 2 - 1.3, 6.6, 2.0]}, {'fist': [BW / 2 + 1.3, 6.6, 2.0]}]
        # face
        if t < T_ARRIVE: pose.update(eyes='fierce', mouth='grin', mouthOpen=0.8)
        elif t < T_PLANT + 0.1: pose.update(eyes='fierce', mouth='grit')
        elif t < T_LOOKUP0: pose.update(eyes='happy', mouth='smile', blush=1.0)
        elif t < T_LOOKUP1: pose.update(eyes='wide', mouth='o', mouthOpen=0.6 + 0.4 * smooth(T_LOOKUP0, T_LOOKUP0 + 0.2, t), look=[-0.3, 1.0])
        elif t < T_LOWER + 0.15: pose.update(eyes='open', mouth='line', blush=0.6)
        elif t < T_PUMP - 0.2: pose.update(eyes='happy', mouth='smile', blush=1.0)
        else: pose.update(eyes='happy', mouth='grin', mouthOpen=1.0, blush=1.0)
        op = blinks(t, seed=21, extra=[T_LOWER + 0.3, T_LOOKUP1 + 0.02])
        if pose['eyes'] in ('open', 'fierce'): pose['open'] = op
        sq = 0.0
        if T_RAISE + 0.12 <= t < T_PLANT - 0.06: sq = -0.1                            # stretched, flag up high
        if T_PLANT - 0.06 <= t < T_PLANT + 0.08: sq = 0.16                            # THUMP
        if T_PUMP - 0.2 < t < T_PUMP - 0.04: sq = 0.16 * smooth(T_PUMP - 0.2, T_PUMP - 0.1, t)
        if T_PUMP - 0.04 <= t < T_PUMP + 0.1: sq = -0.18
        if T_PUMP + 0.3 < t < T_PUMP + 0.42: sq = 0.15 * math.sin(math.pi * (t - T_PUMP - 0.3) / 0.12)
        recs.append(dict(t=t, k=k, p=p, upx=upx, root=P, R=Rb, pose=pose, sq=sq, hop=hop, gref=gref))
        S.append(np.array([x / UPX_REF, hop, 0])); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, k_lean=0.008, k_sq=0.0008, impulses=[(int(T_ARRIVE * 30), 2.5, 0, 1.0), (int(T_PLANT * 30), 0, 0, 1.5)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]
        p['squash'] = float(np.clip(sq[i] + r['sq'], -0.25, 0.24))
        wear_pose(p, wear, r['t'], S[i], Rs[i], wind=np.array([14.0, 2.0, -3.0]), gust=0.8)   # summit breeze
    return recs

GRADE = dict(exposure=1.02, sat=0.92, contrast=0.88, haze=0.10, haze_col=(0.86, 0.72, 0.62), blur=1.5, wrap=0.4, wrap_sigma=10, grain=0.004, grain_size=1.2,
             highlight=0.85, shadow_k=0.15, shadow_soft=6, ao_k=0.55, ao_soft=4, ao_col=(0.55, 0.45, 0.4), ca=1.2)

def ghost_pattern():
    """the real ridge in gold, its mirror upside down in the sky (ghost mountain), a star at the mirror point"""
    pts = RIDGE[::2]
    px_, py_ = ANCH[0], ridge_y(ANCH[0]); my = py_ - MIRROR_DY
    ridge = magic.Pattern(7); ridge.line(pts, amp=1.2, style=magic.st(color=(255, 224, 160), width=3.4))
    ghost = magic.Pattern(8); ghost.line(np.stack([pts[:, 0], 2 * my - pts[:, 1]], 1), amp=1.6, style=magic.st(width=2.2, alpha=0.6))
    star = magic.Pattern(9)
    star.star(px_, my, 48, 8, style=magic.st(color=(255, 224, 160)))
    star.circle(px_, my, 110, style=magic.st(width=1.8, alpha=0.65))
    for _ in range(16):
        a = star.rng.uniform(0, 6.283); d = 160 + star.rng.uniform(0, 260); star.dot(px_ + math.cos(a) * d * 1.3, my + math.sin(a) * d * 0.7, 1.5 + star.rng.uniform(0, 2.5))
    star.line([(px_, py_ - 70), (px_, my + 120)], amp=0.6, style=magic.st(width=1.4, alpha=0.5))
    return ridge, ghost, star

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: src_t(r['t']), lambda r: CAM, envK=1.0, emK=0.18)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        gp = rig.place(CAM, *scr(r['k'], r['gref'])[:2], r['upx'])[0]
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], ground=dict(pos=[float(x) for x in gp]), extent=(-30, 30, -12, 44))
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, [0.9 if r['t'] < T_ZOOM else 0.5 for r in recs])
    ridge, ghost, star = ghost_pattern()
    pl = [r for r in recs if r['t'] >= T_PLANT][0]
    fl = ANCH + np.array([40.0, -2])
    B = [fx.Burst(T_PLANT, fl, 16, (40, 180), angle=(-175, -5), gravity=500, drag=3.0, life=(0.3, 0.7), size=(1.4, 2.6), col=(0.98, 0.97, 0.96), kind='dot', seed=31, alpha=0.85, puff=0.45, puff_r=22),
         fx.Burst(T_ARRIVE, ANCH + np.array([-10.0, -2]), 14, (60, 200), angle=(-175, -120), gravity=500, drag=3.0, life=(0.3, 0.6), size=(1.4, 2.4), col=(0.98, 0.97, 0.96), kind='dot', seed=32, alpha=0.8, puff=0.35, puff_r=18),
         fx.Burst(T_PUMP + 0.04, ANCH, 8, (30, 100), angle=(-170, -10), gravity=400, drag=3.0, life=(0.2, 0.45), size=(1.2, 2.0), col=(0.98, 0.97, 0.96), kind='dot', seed=33, alpha=0.7, puff=0.2, puff_r=16)]
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 900 + i
        sp = 1.25 if r['t'] < T_ZOOM else 1.0
        t = r['t']; k = r['k']; Hk = HS[int(k)] if abs(k - round(k)) < 0.02 else None
        # framing: modest push while the ghost mountain is up (it floats high), then push in for the binoculars
        zz = smooth(T_ZOOM - 0.4, T_ZOOM + 0.3, t); zz2 = smooth(T_F0 - 0.1, T_BINO + 0.2, t)
        z = 1.0 + 0.2 * zz + 0.38 * zz2
        c = scr(k) + np.array([0, -260 * (1 - zz2) + 20 * zz2])
        rp, gp_, sp_ = smooth(T_P0, T_P1, t), smooth(T_G0, T_G1, t), smooth(T_STAR, T_STAR + 0.25, t)
        al = 1 - smooth(T_F0, T_F1, t)
        def pre(img, ii, k=k, t=t, rp=rp, gp_=gp_, sp_=sp_, al=al):
            k0 = int(math.floor(k)); a = k - k0
            ts = lambda P: track2d.apply(HS[k0], P) * (1 - a) + track2d.apply(HS[min(k0 + 1, NSRC - 1)], P) * a
            sc = track2d.local_scale(HS[k0], ANCH)
            if al > 0:
                bo = int(t * 30) // 3
                if rp > 0: ridge.render(img, rp, ts, alpha=al, scale=sc, boil=bo)
                if gp_ > 0: ghost.render(img, gp_, ts, alpha=al, scale=sc, boil=bo)
                if sp_ > 0: star.render(img, sp_, ts, alpha=al, scale=sc, boil=bo, fade_items=lambda j: (0.6 + 0.4 * math.sin(t * 11 + j * 1.7)) if star.items[j]['g'][0][0] == 'dot' else 1.0)
            fx.draw_bursts(img, B, t, ts, scale=sc)
            return img
        frames.append(dict(src=shotlib.src_weights(r['k'], n_blend=sp if sp > 1.2 else 1), pre=pre, layers=[(f'{OUT}/f{i:04d}', g, None)],
                           reframe=(z, 540 * (1 - zz) + c[0] * zz, 960 * (1 - zz) + c[1] * zz, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
