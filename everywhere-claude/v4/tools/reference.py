# Character reference renders from the film rig (char/rig4.html): a hero image and a turnaround / expression sheet on a plain
# warm-grey studio background, soft even light from a synthetic studio environment, soft contact shadow. No text.
import sys, os, math, json, base64
sys.path.insert(0, '/home/user/brain/everywhere-claude/v4/tools')
import numpy as np, cv2
import rig, env
from anim import *

OUT = '/home/user/brain/everywhere-claude/out/reference'
TMP = '/home/user/brain/everywhere-claude/v4/tmp/ref'
BG = np.array([0xE4, 0xE9, 0xEC], np.float32) / 255.0          # #ECE9E4 in BGR
CAM = rig.Cam(18.0, pitch=-9.0)
UPX = 22.0


def studio_env():
    d = env.DIRS; up = d[..., 1]
    warm = np.array([1.0, 0.975, 0.94])
    L = (0.70 + 0.30 * np.clip(up, 0, 1)) * (up > -0.05) + (0.50 + 0.08 * up) * (up <= -0.05)         # bright soft top, floor bounce below
    key = np.exp(-(((d[..., 0] + 0.45) ** 2 + (d[..., 1] - 0.62) ** 2 + (d[..., 2] - 0.64) ** 2) / 0.18))  # big soft box front-left-top
    E = L[..., None] * warm * 0.92 + key[..., None] * warm * 0.55
    img = (np.clip(env.l2s(E), 0, 1) * 255).astype(np.uint8)[..., ::-1]
    ok, png = cv2.imencode('.png', img)
    return 'data:image/png;base64,' + base64.b64encode(png.tobytes()).decode()


def settle_wear(R, wind=np.zeros(3), n=45, vel=np.zeros(3)):
    w = Wear(); S = np.zeros(3); out = None
    for i in range(n):
        S = S + vel / 30.0
        out = w.step(i / 30.0, S, R, wind=wind, gust=0.35 if not vel.any() else 1.0)
    return out


RP = 40.0          # render px per unit
EXT = 44.0        # rendered square: EXT units across, root at the centre-bottom third


def job_for(name, yaw, pose, cx=540.0, cy=1100.0, lift=0.0, wind=np.zeros(3), vel=np.zeros(3)):
    P, rot = rig.place(CAM, cx, cy, UPX, yaw_rel=yaw)
    R = body_R(rot[1])
    t, s = settle_wear(R, wind, vel=vel)
    pose = dict(pose); pose.setdefault('tails', t); pose.setdefault('scarf', s)
    root = P + np.array([0, lift, 0])
    S = EXT * UPX; crop = [int(round(cx - S / 2)), int(round(cy - S * 0.70)), int(round(S)), int(round(S))]
    j = rig.job(f'{TMP}/{name}', CAM, root, R, pose, dict(envK=1.0, key=0.55, keyDir=[-0.45, 0.7, 0.6], keyCol='#fff6ea', rimK=0.0, emK=0.06),
                UPX, ground=dict(pos=[float(x) for x in P]), crop=crop, env=STUDIO)
    j['ss'] = round(EXT * RP / S, 5)
    return j


def load(name):
    """premultiplied RGBA + shadow terms at RP px/unit; anchor = the root (feet) pixel"""
    c = cv2.imread(f'{TMP}/{name}_c.png', cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
    s = cv2.imread(f'{TMP}/{name}_s.png').astype(np.float32) / 255
    meta = json.load(open(f'{TMP}/{name}.json')); x0, y0, w, h = meta['crop']; k = c.shape[1] / w
    ax, ay = (meta['pts']['root'][0] - x0) * k, (meta['pts']['root'][1] - y0) * k
    a = c[..., 3:4]; ys, xs = np.nonzero(a[..., 0] > 0.02)
    return dict(c=np.concatenate([c[..., :3] * a, a], 2), s=s, anchor=(ax, ay), bbox=(xs.min(), ys.min(), xs.max(), ys.max()))


def place_into(canvas, L, scale, at):
    """draw layer L scaled by `scale` with its anchor at canvas point `at` (shadow first, then the character)"""
    H, W = canvas.shape[:2]
    M = np.float32([[scale, 0, at[0] - L['anchor'][0] * scale], [0, scale, at[1] - L['anchor'][1] * scale]])
    s = cv2.warpAffine(L['s'], M, (W, H), flags=cv2.INTER_AREA, borderValue=0)
    c = cv2.warpAffine(L['c'], M, (W, H), flags=cv2.INTER_AREA, borderValue=0)
    sh = cv2.GaussianBlur(s[..., 2], (0, 0), 9 * scale * RP / 40) * 0.24; ao = cv2.GaussianBlur(s[..., 1], (0, 0), 4 * scale * RP / 40) * 0.45
    canvas *= (1 - sh[..., None] * 0.15) * (1 - ao[..., None] * 0.55)
    canvas[:] = canvas * (1 - c[..., 3:4]) + c[..., :3]


def fit_scale(Ls, cell_w, cell_h, frac):
    """one scale for a row: the widest/tallest extent around the anchor fits `frac` of the cell"""
    need_w = max(2 * max(L['anchor'][0] - L['bbox'][0], L['bbox'][2] - L['anchor'][0]) for L in Ls)
    need_up = max(L['anchor'][1] - L['bbox'][1] for L in Ls); need_dn = max(L['bbox'][3] - L['anchor'][1] for L in Ls)
    return min(cell_w * frac / need_w, cell_h * frac / (need_up + need_dn)), need_up, need_dn


STUDIO = studio_env()

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
    neutral = dict(eyes='open', mouth='smile', blush=1.0, feet=[[-4.4, 0, -5.4], [4.4, 0, -5.4], [-4.4, 0, 5.4], [4.4, 0, 5.4]],
                   arms=[{'fist': [-BW / 2 - 1.2, 6.6, 1.6]}, {'fist': [BW / 2 + 1.2, 6.6, 1.6]}])
    wave = dict(neutral, eyes='happy', mouth='grin', mouthOpen=0.9, arms=[{'fist': [-BW / 2 - 1.2, 6.6, 1.6]}, {'fist': [BW / 2 + 3.4, TOP + 6.2, 2.4], 'rot': [0, 0, -20]}])
    surprised = dict(neutral, eyes='wide', mouth='o', mouthOpen=1.0, sweat=0.35, squash=-0.06, arms=[{'fist': [-BW / 2 - 2.6, 10.5, 2.0]}, {'fist': [BW / 2 + 2.6, 10.5, 2.0]}])
    run = dict(eyes='fierce', mouth='grit', blush=0.8, step=0.3, stepDir=[0, 1], stepAmp=3.4, stepLift=3.0, lean=[0, 3.0],
               arms=[{'fist': [-BW / 2 - 1.3, 7.4, 1.0 + 3.4]}, {'fist': [BW / 2 + 1.3, 7.4, 1.0 - 3.4]}])
    ouch = dict(eyes='squeeze', mouth='ouch', mouthOpen=1.0, blush=1.0, sweat=0.5, feet=[[-4.4, 0, -5.4], [4.4, 3.6, 3.8], [-4.4, 0, 5.4], [4.4, 5.0, 6.6]],
                footRot=[0, -20, 0, -35], arms=[{'fist': [-BW / 2 - 3.5, TOP + 3, 0]}, {'fist': [BW / 2 + 0.5, 4.5, 6.8]}])
    jump = dict(eyes='happy', mouth='grin', mouthOpen=1.0, blush=1.0, squash=0.22, feet=[[-4.6, 0, -5.0], [4.6, 0, -5.0], [-4.6, 0, 5.0], [4.6, 0, 5.0]],
                arms=[{'fist': [-BW / 2 - 4.0, TOP + 4.0, 1]}, {'fist': [BW / 2 + 4.0, TOP + 4.0, 1]}])
    TOPR = (('front', 0, neutral, {}), ('q34', -35, neutral, {}), ('side', -90, neutral, {}), ('back', 180, neutral, {}))
    BOTR = (('e_wave', -20, wave, {}), ('e_surprised', -10, surprised, {}), ('e_run', 60, run, dict(vel=np.array([0, 0, 24.0]))),
            ('e_ouch', -25, ouch, {}), ('e_jump', -15, jump, {}))
    jobs = [job_for('hero', -32, neutral)] + [job_for(n, y, p, **kw) for n, y, p, kw in TOPR + BOTR]
    rig.render(jobs, f'{TMP}/jobs.jsonl', workers=2)
    # a) hero: 2048 x 2048, the character's larger dimension = 60 % of the frame, centred
    L = load('hero'); x0, y0, x1, y1 = L['bbox']; sc = 2048 * 0.60 / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    canvas = np.ones((2048, 2048, 3), np.float32) * BG
    place_into(canvas, L, sc, (1024 + (L['anchor'][0] - cx) * sc, 1024 + (L['anchor'][1] - cy) * sc))
    cv2.imwrite(f'{OUT}/character_ref.png', (np.clip(canvas, 0, 1) * 255 + 0.5).astype(np.uint8))
    # b) sheet 3072 x 2048: top row 4 cells of 768, bottom row 5 cells of 614.4; one scale per row, shared ground line
    sheet = np.ones((2048, 3072, 3), np.float32) * BG
    for row, items, cw in ((0, TOPR, 768.0), (1, BOTR, 3072 / 5)):
        Ls = [load(n) for n, *_ in items]
        sc, up, dn = fit_scale(Ls, cw, 1024, 0.84)
        ground = row * 1024 + 512 + (up - dn) * sc / 2
        for i, Lr in enumerate(Ls):
            place_into(sheet, Lr, sc, (cw * (i + 0.5), ground))
    cv2.imwrite(f'{OUT}/character_sheet.png', (np.clip(sheet, 0, 1) * 255 + 0.5).astype(np.uint8))
    print('done')
