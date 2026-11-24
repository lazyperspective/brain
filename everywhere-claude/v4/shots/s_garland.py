# GARLAND (IMG_1623 src 6.6-9.6, 6 beats). As the zoom settles it swings hand-over-hand along the top light string like
# monkey bars (the string sags and bounces under it); its leading fist touches a glowing dove -> ZAP: a brief pixel glitch,
# the fairy lights flicker. Caught -> it freezes as an "ornament" (eyes shut, glowing with the twinkles), peeks with one eye...
# its grip slips and it drops out of the bottom of frame (it lands on the lamp at the start of the pole shot).
# Lighting from the plate: environment + a warm fill sampled from the brightest bulbs around it. The crowd below is thrown
# out of focus (shallow depth of field on the garland), so no passer-by is recognisable.
import sys, json, math
sys.path[:0] = ['/home/user/brain/everywhere-claude/v4/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, fx, env
from shotlib import wear_pose

NAME = 'garland'; CLIP = 'IMG_1623'
TR = json.load(open('/home/user/brain/everywhere-claude/v4/track/1623.json'))
T0 = TR['T0']; NSRC = TR['N']; HS = [np.array(h) for h in TR['H']]; REF = TR['REF']
K0 = 6; NF = 90
OUT = f'{shotlib.ROOT}/render/{NAME}'
STR = np.array([(0, 534), (300, 533), (500, 526), (700, 513), (1000, 491)], float)     # top light string, ref (src 7.7)
UPX_REF = 6.0
CAM = rig.Cam(16.0, pitch=8.0)
GX0, STEP, NSTEP, T_STEP = 140.0, 106.0, 3, 0.37
T_ZAP, T_ZAP1, T_FREEZE, T_PEEK, T_SLIP = 1.12, 1.30, 1.46, 2.08, 2.36
GRIP_LOCAL = np.array([0, TOP + 5.6, 0.8])
FLICK = [0.25, 1.25, 0.45, 1.05, 0.3, 0.95, 1.15, 0.8, 1.05, 1.0]

def str_y(x): return float(np.interp(x, STR[:, 0], STR[:, 1]))
def scr(k, p):
    k0 = int(math.floor(k)); a = k - k0
    q0 = track2d.apply(HS[k0], [p])[0]; q1 = track2d.apply(HS[min(k0 + 1, NSRC - 1)], [p])[0]
    return q0 * (1 - a) + q1 * a

def grip_x(t):
    if t >= NSTEP * T_STEP: return GX0 + STEP * NSTEP
    n = int(t / T_STEP); f = (t - n * T_STEP) / T_STEP
    return GX0 + STEP * (n + EASE['io'](min(1, f / 0.75)))

def flicker(t):
    if T_ZAP <= t < T_ZAP + 0.05 * len(FLICK): return FLICK[int((t - T_ZAP) / 0.05)]
    return 1.0

def sag(t):
    """string sag (ref px) at the grip: weight + a bounce on every re-grip and on the freeze"""
    if t >= T_SLIP: d = t - T_SLIP; return 7.0 * math.exp(-5 * d) * math.cos(2 * math.pi * 3.2 * d)   # springs back up
    s = 7.0
    for n in range(NSTEP + 1):
        t0 = n * T_STEP + 0.75 * T_STEP if n < NSTEP else T_FREEZE
        if t >= t0: d = t - t0; s += 4.0 * math.exp(-6 * d) * math.sin(2 * math.pi * 3.0 * d)
    return s

def build():
    recs = []; wear = Wear(); S = []; Rs = []; fall_v = 0.0; fall_y = 0.0
    for i in range(NF):
        t = i / 30.0; k = K0 + i
        gx = grip_x(t); gref = np.array([gx, str_y(gx) + sag(t)])
        if t >= T_SLIP:
            d = t - T_SLIP; fall_y = 2600.0 * d * d * 0.5 + 60 * d        # ref px, gravity
        gref = gref + np.array([0, fall_y])
        g = scr(k, gref); upx = UPX_REF * track2d.local_scale(HS[int(k)], gref)
        G = CAM.unproject(g[0], g[1], CAM.dist_for(g[0], g[1], upx))
        h = -G.copy(); h[1] = 0; h /= np.linalg.norm(h); th0 = math.degrees(math.atan2(h[0], h[2]))
        travelling = t < NSTEP * T_STEP
        if travelling: sw = -15 * math.sin(2 * math.pi * t / (2 * T_STEP))
        elif t < T_FREEZE: sw = -15 * math.sin(2 * math.pi * NSTEP * T_STEP / (2 * T_STEP)) * math.exp(-(t - NSTEP * T_STEP) * 6) + 18 * math.sin(math.pi * smooth(T_ZAP, T_ZAP1, t))
        elif t < T_SLIP: sw = settle(t, T_FREEZE, 6, 3.0, 6)
        else: sw = 25 * smooth(T_SLIP, T_SLIP + 0.4, t)
        yaw = Track([(0, 55), (NSTEP * T_STEP, 55), (T_ZAP, 40), (T_FREEZE, 0, 'back'), (3, 0)])(t)
        R0 = rotY(th0 + yaw) @ rotX(-6)
        a = math.radians(sw); K = np.array([[0, -h[2], h[1]], [h[2], 0, -h[0]], [-h[1], h[0], 0]])
        Rb = (np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * K @ K) @ R0
        root = G - Rb @ GRIP_LOCAL
        pose = {}
        if travelling:
            n = int(t / T_STEP); f = (t - n * T_STEP) / T_STEP; reach = math.sin(math.pi * min(1, f / 0.75))
            lead, trail = (1, 0) if n % 2 == 0 else (0, 1)
            fists = [[-2.6, TOP + 5.0, 0.8], [2.6, TOP + 5.0, 0.8]]
            fists[lead] = [(-2.6 if lead == 0 else 2.6) + (3.5 * reach if lead == 1 else -1.0 * reach), TOP + 5.0 + 1.6 * reach, 0.8]
            pose['arms'] = [{'fist': fists[0]}, {'fist': fists[1]}]
            kick = math.sin(t * 2 * math.pi / 0.37)
            pose['feet'] = [[-4.2, -0.6 + max(0, kick) * 2, -4.6 + 2 * kick], [4.2, -0.6 + max(0, -kick) * 2, -4.6 - 2 * kick], [-4.2, -0.4 + max(0, -kick) * 2, 4.6 - 2 * kick], [4.2, -0.4 + max(0, kick) * 2, 4.6 + 2 * kick]]
            pose.update(eyes='fierce', mouth='grin', mouthOpen=0.8, blush=1.0)
        else:
            pose['arms'] = [{'fist': [-2.4, TOP + 5.0, 0.8]}, {'fist': [2.4 + (3.0 if t < T_ZAP1 else 0), TOP + 5.0, 0.8 + (1.5 if t < T_ZAP1 else 0)]}]
            pose['feet'] = [[-4.0, -0.9, -4.8], [4.0, -0.9, -4.8], [-4.0, -0.9, 4.8], [4.0, -0.9, 4.8]]
            if t < T_ZAP: pose.update(eyes='fierce', mouth='grin', mouthOpen=0.8)
            elif t < T_ZAP1: pose.update(eyes='x', mouth='grit', glow=1.0)
            elif t < T_FREEZE: pose.update(eyes='wide', mouth='wavy', look=[0, 0.2])
            elif t < T_SLIP:
                pose.update(eyes='closed', mouth='smile', blush=1.0 + 0.6 * glow(t))
                if t > T_PEEK: pose.update(eyes='open', openL=0.0, openR=1.0, look=[0.6, 0.2])
            else:
                pose.update(eyes='wide', mouth='o', mouthOpen=1.0)
                pose['arms'] = [{'fist': [-BW / 2 - 2, TOP + 6, 1.0]}, {'fist': [BW / 2 + 2, TOP + 6, 1.0]}]
                pose['feet'] = [[-4.2, 0.5, -4.0], [4.2, 0.5, -4.0], [-4.2, 0.8, 4.0], [4.2, 0.8, 4.0]]
        if T_ZAP1 <= t < T_FREEZE + 0.3: pose['sweat'] = sweat(t, T_ZAP1 + 0.02, 0.5)
        op = blinks(t, seed=23)
        if pose['eyes'] in ('fierce', 'wide', 'open'): pose['open'] = min(op, 1.0) if pose['eyes'] != 'open' else 1.0
        rec = dict(t=t, k=k, g=g, gref=gref, upx=upx, root=root, R=Rb, pose=pose, glow=glow(t) if T_FREEZE <= t < T_SLIP else 0.0)
        rec['zap'] = 1.0 if T_ZAP <= t < T_ZAP1 else 0.0
        recs.append(rec)
        S.append(np.array([gx / UPX_REF, -fall_y / UPX_REF, 0]) + (root - G) * 0.0); Rs.append(Rb)
    lean, sq = body_dyn(np.array(S), Rs, k_lean=0.004, k_sq=0.0004, impulses=[(int(T_ZAP * 30), 2.0, 0, -2.0), (int(T_FREEZE * 30), 1.5, 0, 0)])
    for i, r in enumerate(recs):
        p = r['pose']; p['lean'] = [float(lean[i][0]), float(lean[i][1])]; p['squash'] = float(np.clip(sq[i], -0.12, 0.12))
        if r['t'] >= T_SLIP: p['squash'] = -0.12 * smooth(T_SLIP, T_SLIP + 0.2, r['t'])     # stretched as it falls
        wear_pose(p, wear, r['t'], S[i], Rs[i], wind=np.array([2.0, 0, 0]), gust=0.6)
    return recs

def glow(t):   # twinkle pulses on the beat while frozen
    g = 0.0
    for t0 in (1.75, 2.0):
        g = max(g, math.exp(-((t - t0) / 0.06) ** 2))
    return g

GRADE = dict(exposure=0.98, sat=1.0, contrast=0.95, blur=1.0, wrap=0.45, wrap_sigma=8, grain=0.01, grain_size=1.0, highlight=0.85)

def lights_mask(img, y0, y1):
    """the fairy lights: very bright, saturated warm or white-hot pixels inside the garland band (not the yellow facades)"""
    b, g, r = img[..., 0], img[..., 1], img[..., 2]
    lum = 0.11 * b + 0.59 * g + 0.3 * r
    m = np.clip((lum - 0.68) / 0.15, 0, 1) * np.maximum(np.clip((r - b - 0.3) / 0.15, 0, 1), np.clip((lum - 0.85) / 0.1, 0, 1))
    yy = np.arange(img.shape[0], dtype=np.float32)[:, None]
    m = m * np.clip((yy - y0) / 40, 0, 1) * np.clip((y1 - yy) / 40, 0, 1)
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2.0)

def bulb_fill(px, r):
    """warm fill from the brightest bulbs within ~150 px of the character (sampled from the plate)"""
    f = px.get(T0 + r['k'] / 30.0); s = 0.5
    x, y = int(r['g'][0] * s), int(r['g'][1] * s); R = 75
    reg = f[max(0, y - R):y + R, max(0, x - R):x + R].reshape(-1, 3)
    lum = reg.mean(1); top = reg[lum >= np.quantile(lum, 0.9)].mean(0)       # BGR
    c = top / max(top.max(), 1e-6)
    return '#%02x%02x%02x' % tuple(int(v * 255) for v in c[::-1]), float(np.quantile(lum, 0.9))

def jobs_and_frames(recs, ss_scale=1.0):
    px = env.Proxy(CLIP)
    for r in recs:
        col, lv = bulb_fill(px, r)
        r['light_extra'] = dict(fill=0.35 + 0.5 * lv, fillCol=col, fillDir=[0.1, -0.2, 1.0], emK=0.12 + 0.9 * r['glow'] + 1.2 * r['zap'])
        if r['zap']: r['light_extra'].update(rim='#bfe0ff', rimK=1.2)
        r['envK_mul'] = flicker(r['t']) * 0.4 + 0.6
    shotlib.attach_env(recs, CLIP, lambda r: T0 + r['k'] / 30.0, lambda r: CAM, envK=1.0, emK=0.12)
    jobs, frames, pts = [], [], []
    for i, r in enumerate(recs):
        hide = r['g'][1] > 2300
        j = rig.job(f'{OUT}/f{i:04d}', CAM, r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], extent=(-24, 24, -26, 30), hide=hide)
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(CAM.project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    zt = [r for r in recs if r['t'] >= T_ZAP][0]
    zap_ref = zt['gref'] + np.array([30.0, 18.0])
    B = [fx.Burst(T_ZAP, zap_ref, 18, (150, 420), gravity=600, drag=3.5, life=(0.12, 0.3), size=(1.0, 1.6), col=(1.0, 0.95, 0.8), kind='spark', seed=12)]
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = 1300 + i
        if r['zap']: g['glitch'] = 1.0 if (i % 2 == 0) else 0.6
        t = r['t']; k = r['k']; Hk = HS[int(k)]; fl = flicker(t); sgx = r['gref'][0]; sg = sag(t) if t < T_SLIP + 0.6 else 0.0
        def pre(img, ii, t=t, k=k, Hk=Hk, fl=fl, sgx=sgx, sg=sg):
            # string sag: bend a narrow band around the light string near the grip
            if abs(sg) > 0.2:
                sc = track2d.local_scale(Hk, [sgx, str_y(sgx)])
                c = track2d.apply(Hk, [[sgx, str_y(sgx)]])[0]; x0, x1 = int(max(0, c[0] - 300)), int(min(1080, c[0] + 300)); y0, y1 = int(c[1] - 60), int(c[1] + 60)
                roi = img[y0:y1, x0:x1].copy(); yy, xx = np.mgrid[0:y1 - y0, 0:x1 - x0].astype(np.float32)
                w = np.clip(1 - np.abs(xx + x0 - c[0]) / 280.0, 0, 1) * np.clip(1 - np.abs(yy + y0 - c[1]) / 60.0, 0, 1) ** 1.5
                img[y0:y1, x0:x1] = cv2.remap(roi, xx, (yy - sg * sc * w).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            if fl != 1.0:      # fairy lights flicker after the zap
                ya = track2d.apply(Hk, [[540, 440]])[0][1]; yb2 = track2d.apply(Hk, [[540, 990]])[0][1]
                m = lights_mask(img, ya, yb2); img[:] = np.clip(img * (1 + (fl - 1) * 0.8 * m[..., None]), 0, 1)
            # shallow depth of field: the crowd below the garlands goes soft
            yb = track2d.apply(Hk, [[540, 960]])[0][1]
            band = img[int(yb):].copy()
            if len(band):
                bl = cv2.GaussianBlur(band, (0, 0), 7.0); w = np.clip((np.arange(len(band))[:, None, None]) / 120.0, 0, 1)
                img[int(yb):] = band * (1 - w) + bl * w
            return img
        post = (lambda img, ii, t=t, Hk=Hk: (fx.draw_bursts(img, B, t, lambda P: track2d.apply(Hk, P), scale=track2d.local_scale(Hk, zap_ref)), img)[1])
        zz = smooth(0.15, 0.95, t); z = 1.0 + 0.75 * zz; c = np.array([0.45 * r['g'][0] + 0.55 * 420.0, 690.0])
        frames.append(dict(src=[(r['k'], 1.0)], pre=pre, post=post, layers=[] if r['g'][1] > 2300 else [(f'{OUT}/f{i:04d}', g, None)],
                           reframe=(z, 540 * (1 - zz) + c[0] * zz, 960 * (1 - zz) + c[1] * zz, 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build(); jobs, frames = jobs_and_frames(recs, 0.6 if mode == 'preview' else 1.0)
    shotlib.render_jobs(NAME, jobs)
    shotlib.comp_shot(NAME, CLIP, T0, NSRC, frames, size='preview'); shotlib.preview_mp4(NAME)
