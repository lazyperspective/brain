# SPRUCE (IMG_1584 src 10.9-12.4, 3 beats): carried over from the roof dive - it boings up from BEHIND the spruce top
# (occluded by the dark crown), arcs over and lands on the very tip, which sways under it. Arms out, it is the tree-topper.
# The hand-drawn spruce pattern (mirrored drooping branch lines on the trunk axis, a star behind it, twinkle dots) draws on in
# one beat, holds, fades. Tracked with a homography on the tree (sky masked), residual ~0.1 px.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, magic
from shotlib import wear_pose

NAME = 'spruce'; CLIP = 'IMG_1584'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1584s.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 9; NF = 45
OUT = f'{shotlib.ROOT}/render/{NAME}'
TIP = np.array([556.0, 506.0])          # tree tip in the ref frame (src 11.6)
UPX_REF = 6.0
CAM = rig.Cam(65.0, pitch=10.0)
T_UP0, T_APEX, T_LAND, T_WINK = 0.12, 0.42, 0.60, 1.12
P_ON, P_FULL, P_OFF0, P_OFF1 = 0.55, 1.02, 1.22, 1.48

def scr(k, p=TIP):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a
def sc_at(k): return track2d.local_scale(HS[int(k)], TIP)

def sway(t):   # tip sway (ref px) after the landing: a damped bend
    if t < T_LAND: return 0.0
    d = t - T_LAND; return 10.0 * math.exp(-3.6 * d) * math.sin(2 * math.pi * 2.1 * d + 0.3)

def build():
    recs = []; wear = Wear(); S = []; Rs = []
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        sc = sc_at(k); upx = UPX_REF * sc
        # path in ref px relative to the tip: behind the crown -> apex above -> the tip
        if t < T_APEX:
            u = smooth(T_UP0, T_APEX, t); off = np.array([-60 + 30 * u, 260 - 380 * EASE['out'](u)])
        elif t < T_LAND:
            u = (t - T_APEX) / (T_LAND - T_APEX); off = np.array([-30 + 30 * u, -120 + 120 * EASE['in'](u)])
        else:
            off = np.array([sway(t), 0.0])
        off = off + np.array([0, 16.0])      # feet nestle into the top of the crown
        p = track2d.apply(HS[int(k)], [TIP + off])[0]
        yaw = Track([(0, -30), (T_LAND, -10), (T_LAND + 0.2, 6, 'back'), (1.5, 4)])(t)
        P, rot = rig.place(CAM, p[0], p[1], upx, yaw_rel=yaw)
        Rb = body_R(rot[1], 0, 0)
        if t < T_LAND:   # spin a little in the air
            Rb = body_R(rot[1] + 200 * (1 - smooth(T_UP0, T_LAND, t)), 0, 0)
        pose = dict()
        air = t < T_LAND
        if air:
            up = smooth(T_UP0, T_UP0 + 0.1, t)
            pose['arms'] = [{'fist': [-BW / 2 - 1.5, TOP + 5 * up, 1]}, {'fist': [BW / 2 + 1.5, TOP + 5 * up, 1]}]
            pose['feet'] = [[-4.0, -1.0, -4.0], [4.0, -1.0, -4.0], [-4.0, -1.0, 4.0], [4.0, -1.0, 4.0]]
            pose.update(eyes='fierce', mouth='grin', mouthOpen=0.8)
        else:
            star = smooth(T_LAND + 0.08, T_LAND + 0.22, t)
            pose['arms'] = [{'fist': [-BW / 2 - 1.3 - 4.7 * star, 6.6 + 5.4 * star, 1]}, {'fist': [BW / 2 + 1.3 + 4.7 * star, 6.6 + 5.4 * star, 1]}]
            pose['feet'] = [[-2.0, 0, -2.4], [2.0, 0, -2.4], [-2.0, 0, 2.4], [2.0, 0, 2.4]]     # tip-toe on the leader
            pose.update(eyes='happy', mouth='grin', mouthOpen=0.9, blush=1.0)
            if T_WINK <= t < T_WINK + 0.3: pose.update(eyes='open', openR=0.0, openL=1.0, mouth='smirk')
        op = blinks(t, seed=31)
        if pose['eyes'] == 'fierce': pose['open'] = op
        sq = 0.0
        if T_UP0 <= t < T_APEX: sq = -0.2 * math.sin(math.pi * smooth(T_UP0, T_APEX, t))       # stretch on the launch
        if T_LAND - 0.06 <= t < T_LAND: sq = -0.12
        recs.append(dict(t=t, k=k, p=p, upx=upx, root=P, R=Rb, pose=pose, sq=sq, off=off))
        S.append(np.array([off[0] / UPX_REF, -off[1] / UPX_REF, 0])); Rs.append(Rb)
    S = np.array(S)
    lean, sq = body_dyn(S, Rs, k_lean=0.006, k_sq=0.0007, impulses=[(int(T_LAND * 30), 0, 0, -3.4)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]
        p['squash'] = float(np.clip(sq[i] + r['sq'], -0.25, 0.24))
        wear_pose(p, wear, r['t'], S[i], r['R'], wind=np.array([3.0, 0, 0]), gust=0.8)
    return recs

GRADE = dict(exposure=1.0, sat=0.92, contrast=0.95, blur=0.75, wrap=0.35, wrap_sigma=8, grain=0.006, grain_size=0.9, highlight=0.9, haze=0.02)

def pattern():
    sa = (TIP[0], TIP[1] - 40)
    return magic.spruce(TIP[0], TIP[1], 1880.0, star_at=sa, star_r=150, tiers=7, garland=True)

def ops(r, pat, state):
    k, t = r['k'], r['t']; Hk = HS[int(k)]
    prog = smooth(P_ON, P_FULL, t); al = 1 - smooth(P_OFF0, P_OFF1, t)
    def twinkle(i):     # dots twinkle
        it = pat.items[i]
        if it['g'][0][0] != 'dot': return 1.0
        return 0.55 + 0.45 * math.sin(t * 13 + i * 2.1)
    def pre(img, i):
        # tip sway: bend the top of the crown with the character's weight
        a = sway(t) * sc_at(k)
        if abs(a) > 0.05:
            c = scr(k); x0, x1, y0, y1 = int(c[0] - 170), int(c[0] + 170), int(max(0, c[1] - 60)), int(c[1] + 320)
            roi = img[y0:y1, x0:x1].copy(); yy, xx = np.mgrid[0:y1 - y0, 0:x1 - x0].astype(np.float32)
            wy = np.clip(1 - (yy + y0 - c[1]) / 320.0, 0, 1) ** 2; wx = np.clip(1 - np.abs(xx + x0 - c[0]) / 170.0, 0, 1)
            img[y0:y1, x0:x1] = cv2.remap(roi, (xx - a * wy * wx).astype(np.float32), yy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        state['plate'] = img.copy()
        if prog > 0 and al > 0:
            pat.render(img, prog, lambda P: track2d.apply(Hk, P), alpha=al, boil=int(t * 30) // 3, fade_items=twinkle)
        return img
    def matte(x0, y0, x1, y1):    # behind the crown while rising: the dark tree occludes it
        g = state['plate'][y0:y1, x0:x1].mean(2)
        m = np.clip((0.42 - g) / 0.12, 0, 1)
        if t >= T_APEX - 0.05:    # landed: only the needles around its feet overlap it
            yy = np.arange(y0, y1, dtype=np.float32)[:, None]; m = m * np.clip((yy - (r['p'][1] - 2.2 * r['upx'])) / (1.5 * r['upx']), 0, 1)
        return cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.0)
    return pre, matte

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=1.05, emK=0.1)
    jobs, frames, pts = [], [], []
    pat = pattern()
    for i, r in enumerate(recs):
        hide = r['t'] < T_UP0
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], extent=(-28, 28, -16, 34), hide=hide)
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 3100 + i
        state = {}; pre, matte = ops(r, pat, state)
        c = scr(r['k'])
        frames.append(dict(src=[(r['k'], 1.0)], pre=pre, layers=[] if r['t'] < T_UP0 else [(f'{OUT}/f{i:04d}', g, matte)],
                           reframe=(1.12, c[0], 880, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
