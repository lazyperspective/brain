# FLURRY: four quick glimpses (1, 1, 1/2, 1/2 beat) - tree-topper star on the spruce / sitting on the palace lamp /
# marching with the crowd / on the pylon top, glitching out. Each is a short whole-frame track (similarity or ground homography).
import sys, json, math, os
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, track2d, plates

ROOT = shotlib.ROOT
GL = [  # name, clip, src start, frames, ref src time, anchor at ref, unitPx at ref, fov, pitch, model, mask band, light
    dict(name='fl1', clip='IMG_1584', t0=11.05, n=15, tref=11.3, anch=[626, 447], upx=6.2, fov=65, pitch=12, model='similarity', band=(0, 1900),
         light=dict(sky='#dfe6ef', ground='#6d7060', hemi=1.7, key=0.7, keyDir=[-0.4, 1, 0.5], amb=0.12, rim='#e8eef7', rimK=0.4, emK=0.22),
         grade=dict(exposure=1.0, sat=0.95, blur=0.8, wrap=0.35, grain=0.006)),
    dict(name='fl2', clip='IMG_1605', t0=13.05, n=15, tref=13.3, anch=[514, 437], upx=6.0, fov=65, pitch=10, model='similarity', band=(0, 1300),
         light=dict(sky='#e9edf3', ground='#8e8e8c', hemi=1.6, key=0.7, keyDir=[-0.3, 1, 0.6], amb=0.12, rim='#eef2f8', rimK=0.35, emK=0.22),
         grade=dict(exposure=1.0, sat=0.95, blur=0.7, wrap=0.3, grain=0.008)),
    dict(name='fl3', clip='IMG_1623', t0=9.3, n=8, tref=9.4, anch=[600, 1660], upx=7.2, fov=65, pitch=-4, model='homography', band=(1500, 1910),
         light=dict(sky='#b9c4d6', ground='#8d8275', hemi=1.35, key=0.8, keyCol='#ffc98a', keyDir=[0.2, 0.4, 0.9], amb=0.1, rim='#ffbf70', rimK=0.5, emK=0.24),
         grade=dict(exposure=1.0, sat=1.0, blur=0.9, wrap=0.3, grain=0.01, shadow_k=0.2, shadow_soft=8, ao_k=0.55, ao_soft=3)),
    dict(name='fl4', clip='IMG_1596', t0=12.75, n=8, tref=12.9, anch=[513, 434], upx=4.6, fov=4, pitch=0.5, model='similarity', band=(0, 1900),
         light=dict(sky='#d6dde6', ground='#7a8752', hemi=1.7, key=0.9, keyDir=[-0.35, 0.8, 0.9], amb=0.15, rim='#dfe6ee', rimK=0.25, emK=0.25),
         grade=dict(exposure=1.14, sat=0.95, contrast=0.9, haze=0.12, haze_col=(0.80, 0.80, 0.78), blur=1.2, wrap=0.35, grain=0.011)),
]
G_BASE = dict(wrap_sigma=8, grain_size=0.9, highlight=0.9)

def track(g):
    p = f'{ROOT}/track/{g["name"]}.json'
    if os.path.exists(p): return json.load(open(p))
    fr = list(plates.frames(g['clip'], g['t0'], g['n'], gray=True))
    ref = int(round((g['tref'] - g['t0']) * 30))
    def mask(k, f):
        m = np.zeros_like(f); m[g['band'][0]:g['band'][1], 10:-10] = 255; return m
    Hf, sf = track2d.track(fr[ref:], mask, model=g['model'], maxc=500, scale=0.5)
    Hb, sb = track2d.track(fr[:ref + 1][::-1], mask, model=g['model'], maxc=500, scale=0.5)
    Hs = [None] * g['n']
    for i, H in enumerate(Hb): Hs[ref - i] = H
    for i, H in enumerate(Hf): Hs[ref + i] = H
    print(g['name'], 'track err', [round(s['err'], 2) for s in sf + sb])
    track2d.save(p, H=Hs, ref=ref)
    return json.load(open(p))

def pose_for(g, t, i, n):
    nm = g['name']; P = {}
    if nm == 'fl1':     # tree-topper: star pose, then a wave
        P.update(eyes='happy', mouth='grin', mouthOpen=0.9, blush=1.0, feet=[[-2.0, 0, -2.0], [2.0, 0, -2.0], [-2.0, 0, 2.0], [2.0, 0, 2.0]])
        if i < 9: P['arms'] = [{'fist': [-BW / 2 - 6, TOP + 6, 1]}, {'fist': [BW / 2 + 6, TOP + 6, 1]}]
        else:
            w = math.sin((i - 9) * 1.3); P['arms'] = [{'fist': [-BW / 2 - 6, TOP + 6, 1]}, {'fist': [BW / 2 + 3 + 2 * w, TOP + 7, 2], 'rot': [0, 0, -20 * w]}]
        return P, 0, 0.0
    if nm == 'fl2':     # sitting on the lamp, legs dangling and kicking, wink at the camera
        k = math.sin(i * 0.9)
        P.update(eyes='open', mouth='smirk', blush=1.0, feet=[[-4.2, -0.4 + max(0, k), 7.2 + 1.5 * k], [4.2, -0.4 + max(0, -k), 7.2 - 1.5 * k], [-4.2, 0.0, -4.0], [4.2, 0.0, -4.0]],
                 footRot=[60 + 25 * k, 60 - 25 * k, 0, 0])
        if i >= 8: P['openR'] = 0.0
        P['arms'] = [{'fist': [-BW / 2 - 1.0, 4.0, 4.0]}, {'fist': [BW / 2 + 1.0, 4.0, 4.0]}]
        return P, -20 if i < 6 else 0, 0.0
    if nm == 'fl3':     # marching toward us with the crowd
        P.update(eyes='fierce', mouth='smile', step=i / 7.0, stepDir=[0, 1], stepAmp=2.4, stepLift=2.4, lean=[0, 1.0])
        sw = math.sin(i / 7.0 * 2 * math.pi)
        P['arms'] = [{'fist': [-BW / 2 - 1.3, 7, 1.5 + 2.5 * sw]}, {'fist': [BW / 2 + 1.3, 7, 1.5 - 2.5 * sw]}]
        return P, 10, -0.6
    if nm == 'fl4':     # on the pylon top, kicking feet
        k = math.sin(i * 1.1)
        P.update(eyes='happy', mouth='smile', blush=1.0, feet=[[-4.2, max(0, k), -4.4], [4.2, max(0, -k), -4.4], [-4.2, max(0, -k), 4.4], [4.2, max(0, k), 4.4]])
        P['arms'] = [{'fist': [-BW / 2 - 1.2, 6.6, 2]}, {'fist': [BW / 2 + 1.2, 6.6, 2]}]
        return P, -15, 0.0

def build(g):
    T = track(g); Hs = [np.array(h) for h in T['H']]; ref = T['ref']
    recs = []; tails = Tails(); cam = rig.Cam(g['fov'], pitch=g['pitch'])
    for i in range(g['n']):
        t = i / 30.0
        a = np.array(g['anch'], float)
        if g['name'] == 'fl3':   # walking toward the camera: ground point slides down/forward
            a = a + np.array([0, 0.0])
        p = track2d.apply(Hs[i], [a])[0]; upx = g['upx'] * track2d.local_scale(Hs[i], a)
        pose, yaw, walk = pose_for(g, t, i, g['n'])
        if g['name'] == 'fl3': p = p + np.array([0, i * 6.0]); upx *= 1 + i * 0.01
        P, rot = rig.place(cam, p[0], p[1], upx, yaw_rel=yaw)
        R = body_R(rot[1])
        pose['tails'] = tails.step(t, np.array([0, 0, i * walk * 6.0]), R, wind=np.array([5.0, 0, 0]), gust=0.8)
        op = blink_open(t, seed=i, period=(30, 31))
        recs.append(dict(i=i, p=p, upx=upx, root=P, R=R, pose=pose, cam=cam))
    return recs, ref

def jobs_and_frames(g, recs, ss_scale=1.0):
    out = f'{ROOT}/render/{g["name"]}'; jobs, frames, pts = [], [], []
    for r in recs:
        gp, _ = rig.place(r['cam'], r['p'][0], r['p'][1], r['upx'])
        j = rig.job(f'{out}/f{r["i"]:04d}', r['cam'], r['root'], r['R'], r['pose'], g['light'], r['upx'],
                    ground=dict(pos=[float(x) for x in gp]) if g['name'] == 'fl3' else None, extent=(-28, 28, -16, 34))
        j['ss'] = round(min(3.0, j['ss']) * ss_scale, 3); jobs.append(j)
        pts.append(r['cam'].project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    mv = shotlib.motion_vectors(pts, 0.5)
    pix = [f'{shotlib.PIX}/fl4_{i}.png' for i in range(3)]
    for r in recs:
        gr = dict(G_BASE); gr.update(g['grade']); gr['mblur'] = mv[r['i']]; gr['seed'] = 2000 + r['i']
        layers = [(f'{out}/f{r["i"]:04d}', gr, None)]
        if g['name'] == 'fl4' and r['i'] >= g['n'] - 3:      # glitch-out into the silence
            gi = r['i'] - (g['n'] - 3)
            layers = [(shotlib.pixel_layer(pix[gi], r['p'] + np.array([8.0 * gi, 0])), shotlib.PIX_GRADE, None)]
        z = dict(fl1=(1.25, 600, 760), fl2=(1.25, 520, 720), fl3=(1.1, 560, 1300), fl4=(1.35, 520, 700))[g['name']]
        frames.append(dict(src=[(r['i'], 1.0)], layers=layers, reframe=(z[0], z[1], z[2], 0.0)))
    return jobs, frames

def get(name):
    return [g for g in GL if g['name'] == name][0]

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    shotlib.make_pixel_sprites('fl4', face='x', k=0.5, scale=3, mouth='smile', eyes='closed')
    for g in GL:
        recs, ref = build(g); jobs, frames = jobs_and_frames(g, recs, 0.6 if mode == 'preview' else 1.0)
        shotlib.render_jobs(g['name'], jobs)
        shotlib.comp_shot(g['name'], g['clip'], g['t0'], g['n'], frames, size='preview')
