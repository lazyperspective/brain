# SET PIECE (IMG_1661): hang from the lamp -> caught -> pump-swing -> release leap -> strap onto the wire -> zip down
# with the tilt -> over the car -> land on the far pole -> fist pump.  Film length 7.0 s (14 beats).
import sys, json, math, os
sys.path[:0] = ['/home/user/brain/everywhere-claude/v2/tools', '/home/user/brain/everywhere-claude/v2/track']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp
from post_helpers import curve_pts, curve_at

NAME = 'pole'
TR = json.load(open('/home/user/brain/everywhere-claude/v2/track/1661.json'))
T0 = TR['T0']; NSRC = TR['N']
NF = 210
OUT = f'{shotlib.ROOT}/render/{NAME}'

# ---------------- time warp: 1x (lamp) -> smooth ramp up to ~3.2x (tilt down the wires) -> 1x (car, pole) ----------------
TA, TB, EXTRA = 2.30, 4.30, 2.4
A_ = 2 * EXTRA / (TB - TA)
def speed(t): return 1 + (A_ * math.sin(math.pi * (t - TA) / (TB - TA)) ** 2 if TA < t < TB else 0)
def src_k(t):
    if t <= TA: e = 0
    elif t >= TB: e = EXTRA
    else: u = (t - TA) / (TB - TA); e = EXTRA * (u - math.sin(2 * math.pi * u) / (2 * math.pi))
    return (t + e) * 30.0

# ---------------- track access (fractional k) ----------------
def lerp_tr(fn, k):
    k0 = int(math.floor(k)); a = k - k0
    p0 = fn(k0); p1 = fn(min(k0 + 1, NSRC - 1))
    if p0 is None or p1 is None: return p0 if p1 is None else p1
    return p0 * (1 - a) + p1 * a

LAMP_TIP = np.linalg.inv(np.array(TR['lamp'][12])) @ np.array([692.0, 1352.0, 1.0])   # measured at src 0.4 s (k=12)
def lamp_T(k):
    T = TR['lamp'][k] if 0 <= k < NSRC else None
    return None if T is None else np.array(T)
LAST_LAMP = max(i for i, T in enumerate(TR['lamp']) if T is not None)
def lamp_pt(k, p=LAMP_TIP):
    def f(kk):
        kk = min(kk, LAST_LAMP); T = lamp_T(kk)
        if T is None: return None
        if kk == LAST_LAMP and kk < k:   # extrapolate with the last velocity
            T2 = lamp_T(kk - 1); v = (T @ p - T2 @ p)[:2]; return (T @ p)[:2] + v * (k - kk)
        return (T @ p)[:2]
    return lerp_tr(f, k)

def wire_at_y(k, y):
    def f(kk):
        w = TR['ours'][kk]
        if w is None: return None
        P = curve_pts(w, 400); i = np.argmin(np.abs(P[:, 1] - y)); return P[i]
    return lerp_tr(f, k)

def pole_tip(k):
    def f(kk):
        q = TR['klt'][kk] if 0 <= kk < NSRC else None
        return None if q is None else np.array(q[:2])
    return lerp_tr(f, k)

PITCH_KEYS = [(k + 12, p) for k, p in [(0, 65), (75, 65), (90, 63), (105, 60), (120, 55), (135, 48), (150, 40), (165, 33), (180, 25), (195, 20), (210, 16), (232, 12.7), (269, 8.5)]]
def pitch_at(k): return float(np.interp(k, [a for a, b in PITCH_KEYS], [b for a, b in PITCH_KEYS]))
FOV = 65.0

def rodrigues(axis, deg):
    a = np.asarray(axis, float); a = a / np.linalg.norm(a); th = math.radians(deg)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K

# ---------------- choreography (film time t) ----------------
T_NOTICE, T_TURN0, T_TURN1, T_PUMP0, T_REL, T_CATCH = 0.95, 1.0, 1.38, 1.45, 2.0, 2.3
T_RELEASE_WIRE, T_LAND = 5.30, 5.58
UNIT = Track([(0, 6.8), (T_CATCH, 6.4), (3.0, 5.7), (3.6, 4.8), (4.2, 4.1), (4.8, 3.7), (T_LAND, 3.5), (7.0, 3.5)])
# swing angle (deg) about the view axis: idle sway, freeze, pump
def swing(t):
    if t < T_NOTICE: return 9 * math.sin(2 * math.pi * t / 1.25 + 0.4)
    if t < T_PUMP0:
        s0 = 9 * math.sin(2 * math.pi * T_NOTICE / 1.25 + 0.4); return s0 * math.exp(-(t - T_NOTICE) * 9) * math.cos((t - T_NOTICE) * 14)
    u = (t - T_PUMP0) / (T_REL - T_PUMP0)          # growing pump: ends going left at -42 deg (release)
    amp = 12 + 30 * u ** 1.3
    return -amp * math.sin(2 * math.pi * (u * 1.25))   # 1.25 cycles
YAWOFF = Track([(0, 55), (T_TURN0, 55), (T_TURN1, 4, 'io'), (T_PUMP0, 0), (T_REL, -10), (T_CATCH, -30), (3.4, -38), (4.6, -30), (T_RELEASE_WIRE, -10), (T_LAND, 0), (7.0, 8)])
TWIST = Track([(0, 0), (T_TURN0, 0), (T_TURN0 + 0.12, -20, 'out'), (T_TURN1, 0, 'io'), (7, 0)])   # head leads the turn

def eyes_at(t):
    if t < T_NOTICE: return dict(eyes='closed', mouth='smile', blush=1.0)
    if t < T_NOTICE + 0.06: return dict(eyes='open', open=0.3, mouth='line')
    if t < T_PUMP0: return dict(eyes='wide', mouth='o', mouthOpen=0.5 + 0.5 * smooth(T_NOTICE, T_TURN1, t), blush=1.0)
    if t < T_REL: return dict(eyes='fierce', mouth='grit')
    if t < T_CATCH: return dict(eyes='wide', mouth='grin', mouthOpen=1.0)
    if t < 4.55: return dict(eyes='happy', mouth='grin', mouthOpen=0.9)
    if t < 5.05: return dict(eyes='wide', mouth='o', mouthOpen=1.0, look=[0, -0.9])      # looks down at the car
    if t < T_LAND + 0.05: return dict(eyes='wide', mouth='grin', mouthOpen=0.8)
    if t < 5.95: return dict(eyes='open', mouth='smile')
    return dict(eyes='happy', mouth='grin', mouthOpen=1.0)

HANG_FISTS = [[-2.6, TOP + 5.0, 0.8], [2.6, TOP + 5.0, 0.8]]
GRIP_LOCAL = np.array([0, TOP + 5.6, 0.8])
STRAP_APEX = np.array([0, TOP + 10.5, 0.4])
STRAP_FISTS = [[-2.4, TOP + 6.4, 0.6], [2.4, TOP + 6.4, 0.6]]

def zip_screen(t, k):
    """screen point of the strap/wire contact during the zip, plus the parameterisation"""
    # screen y of the contact: keyed, then converging onto the pole tip
    Y = Track([(T_CATCH, 700), (2.75, 760), (3.1, 900), (3.6, 1000), (4.1, 1060), (4.4, 1080)])
    B = pole_tip(k)
    if t <= 4.4 or B is None:
        y = Y(t)
    else:
        # height above the pole tip shrinks to ~0.5 body heights at the release
        y_free = 1080 + (t - 4.4) * 0
        hB = Track([(4.4, B[1] - 1080), (4.75, 260), (5.05, 150), (T_RELEASE_WIRE, 70)])(t) if t < T_RELEASE_WIRE else 70
        y = B[1] - hB
        if t < 4.75:   # blend from the keyed y
            u = smooth(4.4, 4.75, t); y = (1 - u) * 1080 + u * y
    p = wire_at_y(k, y)
    return p, y

def build():
    frames = []; recs = []
    S_hist = []; R_hist = []; tails = Tails(); Rs = []
    blink_extra = [T_NOTICE + 0.52, T_NOTICE + 0.66, 3.3, 6.75]
    for i in range(NF):
        t = i / 30.0; k = src_k(t); sp = speed(t)
        cam = rig.Cam(FOV, pitch=pitch_at(k)); upx = UNIT(t)
        rec = dict(t=t, k=k, cam=cam, upx=upx)
        # camera-facing horizontal direction helper at a world point
        def facing(Pw, yaw_off=0.0):
            h = -Pw.copy(); h[1] = 0; h /= np.linalg.norm(h)
            th0 = math.degrees(math.atan2(h[0], h[2]))
            return th0 + yaw_off, h
        pose = dict(); arms = None; strap = None; matte = False
        if t < T_REL:      # ---------------- hanging from the lamp ----------------
            gs = lamp_pt(k)
            G = cam.unproject(gs[0], gs[1], cam.dist_for(gs[0], gs[1], upx))
            yaw, h = facing(G, YAWOFF(t))
            phi = 38.0                          # lean back so the face looks down at the camera
            Rb = rotY(yaw) @ rotX(phi)
            Rb = rodrigues(h, swing(t)) @ Rb
            root = G - Rb @ GRIP_LOCAL
            arms = [{'fist': HANG_FISTS[0]}, {'fist': HANG_FISTS[1]}]
            # dangling feet: kick alternately while idle, pinned together when frozen, tucked in the pump
            kick = math.sin(t * 2 * math.pi / 0.62) if t < T_NOTICE else 0.0
            tuck = 0.0
            if t >= T_PUMP0:
                u = (t - T_PUMP0) / (T_REL - T_PUMP0); tuck = math.sin(2 * math.pi * u * 1.25) * 1.0
            pose['feet'] = [[-4.2, -0.8 + max(0, kick) * 1.5, -5.0 + kick * 1.2 + tuck * 2], [4.2, -0.8 + max(0, -kick) * 1.5, -5.0 - kick * 1.2 + tuck * 2],
                            [-4.2, -0.6 + max(0, -kick) * 1.5, 5.0 - kick * 1.2 + tuck * 2], [4.2, -0.6 + max(0, kick) * 1.5, 5.0 + kick * 1.2 + tuck * 2]]
            pose['footRot'] = [20 + kick * 15, 20 - kick * 15, 20 - kick * 15, 20 + kick * 15]
            rec['anchor'] = gs
        elif t < T_CATCH:   # ---------------- flight: release -> wire ----------------
            u = (t - T_REL) / (T_CATCH - T_REL)
            # release point follows the lamp, catch point follows the wire; blend in screen space with an arc
            gs = lamp_pt(min(k, src_k(T_REL)) if False else src_k(T_REL))
            gs_now = lamp_pt(k) if k <= LAST_LAMP + 6 else None
            cs, _ = zip_screen(T_CATCH, k)
            a = gs if gs_now is None else gs_now
            ue = EASE['out'](u)
            p = a * (1 - ue) + cs * ue
            # arc bulge (perpendicular, toward the upper side) + overshoot above the wire then settle
            d = cs - a; nrm = np.array([d[1], -d[0]]) / (np.linalg.norm(d) + 1e-6)
            if nrm[1] > 0: nrm = -nrm
            p = p + nrm * 80 * math.sin(math.pi * u)
            Pc = cam.unproject(p[0], p[1], cam.dist_for(p[0], p[1], upx))
            yaw, h = facing(Pc, YAWOFF(t))
            spin = -360 * EASE['io'](min(1, u * 1.15))          # a full cartwheel in the image plane
            Rb = rodrigues(h, spin + swing(T_REL) * (1 - u)) @ rotY(yaw) @ rotX(30)
            root = Pc - Rb @ STRAP_APEX
            arms = [{'fist': STRAP_FISTS[0]}, {'fist': STRAP_FISTS[1]}]
            strap = [STRAP_FISTS[0], [0, TOP + 9.0 + 1.5 * u, 0.4], STRAP_APEX.tolist(), [0.4, TOP + 9.0 + 1.5 * u, 0.4], STRAP_FISTS[1]] if u > 0.25 else None
            pose['feet'] = [[-4.2, 0.5, -4.0], [4.2, 0.5, -4.0], [-4.2, 0.8, 4.0], [4.2, 0.8, 4.0]]
            pose['squash'] = -0.18 * math.sin(math.pi * u)
            rec['anchor'] = p
        elif t < T_RELEASE_WIRE:   # ---------------- zip ----------------
            cs, y = zip_screen(t, k)
            W_ = cam.unproject(cs[0], cs[1], cam.dist_for(cs[0], cs[1], upx))
            yaw, h = facing(W_, YAWOFF(t))
            # pendulum after the catch (decaying), plus a little tuck lift over the car
            pend = 26 * math.exp(-(t - T_CATCH) * 3.2) * math.cos((t - T_CATCH) * 9)
            phi = 0.45 * pitch_at(k) + 6
            Rb = rodrigues(h, pend) @ rotY(yaw) @ rotX(phi)
            root = W_ - Rb @ STRAP_APEX
            arms = [{'fist': STRAP_FISTS[0]}, {'fist': STRAP_FISTS[1]}]
            strap = [STRAP_FISTS[0], [-0.6, TOP + 8.6, 0.5], STRAP_APEX.tolist(), [0.6, TOP + 8.6, 0.5], STRAP_FISTS[1]]
            car = smooth(4.5, 4.62, t) * (1 - smooth(5.0, 5.15, t))
            pose['feet'] = [[-4.2, 0.4 + 3.2 * car, -4.6 + 2.5 * car], [4.2, 0.4 + 3.2 * car, -4.6 + 2.5 * car], [-4.2, 0.6 + 3.2 * car, 4.6 - 1.0 * car], [4.2, 0.6 + 3.2 * car, 4.6 - 1.0 * car]]
            pose['squash'] = 0.1 * car
            rec['anchor'] = cs
        else:   # ---------------- release, hop, land on the pole tip, fist pump ----------------
            B = pole_tip(k)
            if t < T_LAND:
                u = (t - T_RELEASE_WIRE) / (T_LAND - T_RELEASE_WIRE)
                c0, _ = zip_screen(T_RELEASE_WIRE - 1e-3, src_k(T_RELEASE_WIRE - 1e-3))
                c0 = c0 + (B - pole_tip(src_k(T_RELEASE_WIRE))) if B is not None else c0
                # from hanging (root below the contact) to standing on B: root path in screen with a hop
                start = c0 + np.array([0, 17 * upx * 0.9]); p = start * (1 - u) + B * u + np.array([0, -55 * math.sin(math.pi * u)])
            else:
                p = B.copy()
            p = p + np.array([0, 6.0 * smooth(T_RELEASE_WIRE, T_LAND, t)])   # feet straddle the thin tip
            hop = 0.0
            # fist-pump bounces
            def bounce(t0, h, d=0.32): return h * max(0, math.sin(math.pi * (t - t0) / d)) if t0 <= t <= t0 + d else 0.0
            hop = bounce(6.02, 7) + bounce(6.42, 5) + bounce(6.78, 3, 0.2)
            P, rot = rig.place(cam, p[0], p[1], upx, yaw_rel=YAWOFF(t))
            Rb = body_R(rot[1], 0, 0)
            if t < T_LAND:
                u = (t - T_RELEASE_WIRE) / (T_LAND - T_RELEASE_WIRE)
                Rb = rodrigues(-P / np.linalg.norm(P), -200 * (1 - EASE['out'](u)) * 0 + 25 * math.sin(math.pi * u)) @ Rb
            up_w = np.array([0, 1.0, 0])
            root = P + up_w * hop * (cam.dist_for(p[0], p[1], upx) / cam.dist_for(p[0], p[1], upx))
            # arms: landing -> anticipation -> pump x2 -> hold
            pump = 0.0
            for t0 in (6.0, 6.4):
                if t0 - 0.12 <= t <= t0 + 0.3: pump = max(pump, smooth(t0 - 0.12, t0, t) * (1 - smooth(t0 + 0.18, t0 + 0.3, t)))
            hold = smooth(6.72, 6.85, t)
            up = max(pump, hold)
            antic = smooth(5.8, 5.95, t) * (1 - smooth(5.95, 6.02, t))
            arms = [{'fist': [-BW / 2 - 1.3, 6.4 - 1.2 * antic, 2.0]}, {'fist': [BW / 2 + 1.0 + 1.5 * up, 6.6 + up * 17.5 - antic * 1.5, 1.6 + 1.5 * up], 'rot': [0, 0, -15 * up]}]
            if t < T_LAND:
                arms = [{'fist': STRAP_FISTS[0]}, {'fist': STRAP_FISTS[1]}]
            pose['feet'] = None
            pose['squash'] = 0.0
            pose['lean'] = [0, 0]
            rec['anchor'] = p
            rec['hop'] = hop
        pose.update(eyes_at(t))
        op = blink_open(t, seed=11, extra=blink_extra)
        if pose.get('eyes') in ('open', 'wide', 'fierce'): pose['open'] = min(pose.get('open', 1.0), op)
        pose['twist'] = TWIST(t)
        if arms: pose['arms'] = arms
        if strap: pose['strap'] = strap
        if pose.get('feet') is None: pose.pop('feet', None)
        rec.update(root=root, R=Rb, pose=pose)
        recs.append(rec)
    # ---------------- dynamics: body spring + tails (in an anchor-stabilised space) ----------------
    # S: positions in a world-stabilised space. Camera drift is removed with the lamp's own (fixed) world point.
    S = []; last = np.zeros(3)
    def grip_world(r):
        g = lamp_pt(min(r['k'], LAST_LAMP + 8)); c = r['cam']; return c.unproject(g[0], g[1], c.dist_for(g[0], g[1], r['upx']))
    for i, r in enumerate(recs):
        t = r['t']
        if i == 0: S.append(r['root'] - grip_world(r)); last = S[0]; continue
        if t < T_CATCH:
            d = (r['root'] - recs[i - 1]['root']) - (grip_world(r) - grip_world(recs[i - 1]))
            last = last + d
        elif t < T_RELEASE_WIRE:
            v = 90.0 * (1 - smooth(4.9, T_RELEASE_WIRE, t)) + 20
            h = -r['root'] / np.linalg.norm(r['root']); h[1] = 0; h /= np.linalg.norm(h)
            last = last + (-h * v + np.array([0, -8.0, 0])) / 30.0
        else:
            last = last + np.array([0, r.get('hop', 0) - recs[i - 1].get('hop', 0), 0])
        S.append(last.copy())
    S = np.array(S)
    from scipy.ndimage import gaussian_filter1d
    S = gaussian_filter1d(S, 1.0, axis=0)
    lean, sq = body_dyn(S, [r['R'] for r in recs], k_lean=0.006, k_sq=0.0004,
                        impulses=[(int(T_CATCH * 30), 0, 3.0, -2.5), (int(T_LAND * 30), 0, 0, -3.2), (int(6.0 * 30) + 2, 0, 0, 2.0), (int(6.4 * 30) + 2, 0, 0, 1.6)])
    for i, r in enumerate(recs):
        p = r['pose']
        p['lean'] = [float(lean[i][0] + (p.get('lean') or [0, 0])[0]), float(lean[i][1] + (p.get('lean') or [0, 0])[1])]
        p['squash'] = float(np.clip(sq[i] + p.get('squash', 0), -0.26, 0.24))
        wind = np.array([0, 0, 0.0])
        if r['t'] >= T_CATCH and r['t'] < T_RELEASE_WIRE: wind = np.array([0, 6.0, 0])
        p['tails'] = tails.step(r['t'], S[i], r['R'], wind=wind, gust=1.0 if r['t'] > T_REL else 0.55)
    return recs

LIGHT = dict(sky='#d3e0f7', ground='#73766a', hemi=1.75, key=0.55, keyCol='#fff6ec', keyDir=[0.15, 1.0, 0.25], amb=0.12, rim='#cfe0ff', rimK=0.55, emK=0.2)
GRADE = dict(exposure=1.0, tint=(1.0, 1.0, 1.0), sat=0.95, haze=0.03, blur=0.55, wrap=0.35, wrap_sigma=12, grain=0.004, grain_size=0.8, highlight=0.9)

def jobs_and_frames(recs, ss_scale=1.0):
    jobs, frames = [], []
    pts = []
    for i, r in enumerate(recs):
        out = f'{OUT}/f{i:04d}'
        j = rig.job(out, r['cam'], r['root'], r['R'], r['pose'], LIGHT, r['upx'], extent=(-30, 30, -30, 34))
        j['ss'] = round(j['ss'] * ss_scale, 3)
        jobs.append(j)
        pts.append(r['cam'].project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
    sh = [0.45 if speed(r['t']) < 1.3 else 0.45 + (speed(r['t']) - 1) * 0.6 for r in recs]
    mv = shotlib.motion_vectors(pts, sh)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = i; g['blur'] = 0.35 + 0.3 * smooth(3.5, 4.5, r['t']); g['haze'] = 0.02 + 0.06 * smooth(3.5, 4.8, r['t'])
        # 3x part: plate frames are blended -> soften the character a touch more
        sp = speed(r['t'])
        src = shotlib.src_weights(r['k'], n_blend=sp if sp > 1.3 else 1)
        z = 1.0; c = (540, 960)
        if r['t'] > 4.95:
            zz = smooth(4.95, 5.9, r['t']); z = 1.0 + 0.85 * zz
            B = pole_tip(r['k']); c = (B[0] * zz + 540 * (1 - zz), (B[1] + 60) * zz + 960 * (1 - zz))
        frames.append(dict(src=src, layers=[(f'{OUT}/f{i:04d}', g, None)], reframe=(z, c[0], c[1], 0.0)))
    return jobs, frames

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    recs = build()
    jobs, frames = jobs_and_frames(recs, ss_scale=0.6 if mode == 'preview' else 1.0)
    sel = None
    if len(sys.argv) > 2:
        a, b = map(int, sys.argv[2].split(':')); sel = range(a, b)
    if sel is not None:
        jobs = [jobs[i] for i in sel]
    shotlib.render_jobs(NAME, jobs)
    if mode == 'preview':
        fr = frames if sel is None else frames
        shotlib.comp_shot(NAME, 'IMG_1661', T0, NSRC, fr, size='preview')
        shotlib.preview_mp4(NAME)
