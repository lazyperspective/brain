# v3: it DROPS IN from the top of frame (carried over from the garland) and catches the lamp head (stretch, big decaying
# swing); sparks fly off the strap on the zip-line; the wire sags under it and bounces on the catch (the plate's wire is bent
# with a displacement field around the detected wire); on the far pole a near-fall arm-windmill before the fist pumps.
# Hand-drawn string-art parabolas stitch themselves between the three converging wires (mirrored) during the zip, with a
# starburst at the far pole tip on the landing (wires = detected angles through the KLT-tracked pole tip, every frame).
# Image-based light from the plate, scarf, sweat on the caught beat.
# SET PIECE (IMG_1661): hang from the lamp -> caught -> pump-swing -> release leap -> strap onto the wire -> zip down
# with the tilt -> over the car -> land on the far pole -> fist pump.  Film length 7.0 s (14 beats).
import sys, json, math, os
sys.path[:0] = ['/home/user/brain/everywhere-claude/v3/tools', '/home/user/brain/everywhere-claude/v3/track']
import numpy as np, cv2
from anim import *
import rig, shotlib, comp, fx, magic, env
from shotlib import wear_pose
from post_helpers import curve_pts, curve_at

NAME = 'pole'
TR = json.load(open('/home/user/brain/everywhere-claude/v3/track/1661.json'))
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
T_RELEASE_WIRE, T_LAND = 5.22, 5.48
T_GRAB = 0.36
T_WM0, T_WM1, T_PUMP1, T_PUMP2, T_HOLD = 5.56, 5.94, 6.06, 6.46, 6.78
UNIT = Track([(0, 6.8), (T_CATCH, 6.4), (3.0, 5.7), (3.6, 4.8), (4.2, 4.1), (4.8, 3.7), (T_LAND, 3.5), (7.0, 3.5)])
# swing angle (deg) about the view axis: idle sway, freeze, pump
def swing(t):
    if t < T_GRAB: return 0.0
    if t < T_NOTICE: return -34 * math.exp(-(t - T_GRAB) * 1.6) * math.sin(2 * math.pi * (t - T_GRAB) / 1.05)
    if t < T_PUMP0:
        s0 = swing(T_NOTICE - 1e-4); return s0 * math.exp(-(t - T_NOTICE) * 9) * math.cos((t - T_NOTICE) * 14)
    u = (t - T_PUMP0) / (T_REL - T_PUMP0)          # growing pump: ends going left at -42 deg (release)
    amp = 12 + 30 * u ** 1.3
    return -amp * math.sin(2 * math.pi * (u * 1.25))   # 1.25 cycles
YAWOFF = Track([(0, 55), (T_TURN0, 55), (T_TURN1, 4, 'io'), (T_PUMP0, 0), (T_REL, -10), (T_CATCH, -30), (3.4, -38), (4.6, -30), (T_RELEASE_WIRE, -10), (T_LAND, 0), (7.0, 8)])
TWIST = Track([(0, 0), (T_TURN0, 0), (T_TURN0 + 0.12, -20, 'out'), (T_TURN1, 0, 'io'), (7, 0)])   # head leads the turn

def eyes_at(t):
    if t < T_GRAB: return dict(eyes='wide', mouth='o', mouthOpen=1.0)
    if t < T_GRAB + 0.2: return dict(eyes='squeeze', mouth='grit')
    if t < T_NOTICE: return dict(eyes='happy', mouth='grin', mouthOpen=0.7, blush=1.0)          # phew
    if t < T_NOTICE + 0.06: return dict(eyes='open', open=0.3, mouth='line')
    if t < T_PUMP0: return dict(eyes='wide', mouth='o', mouthOpen=0.5 + 0.5 * smooth(T_NOTICE, T_TURN1, t), blush=1.0)
    if t < T_REL: return dict(eyes='fierce', mouth='grit')
    if t < T_CATCH: return dict(eyes='wide', mouth='grin', mouthOpen=1.0)
    if t < 4.55: return dict(eyes='happy', mouth='grin', mouthOpen=0.9)
    if t < 5.05: return dict(eyes='wide', mouth='o', mouthOpen=1.0, look=[0, -0.9])      # looks down at the car
    if t < T_LAND + 0.05: return dict(eyes='wide', mouth='grin', mouthOpen=0.8)
    if t < T_WM1: return dict(eyes='wide', mouth='o', mouthOpen=1.0, sweat=sweat(t, T_WM0, 0.45))     # whoa-whoa-whoa
    if t < T_PUMP1 - 0.05: return dict(eyes='open', mouth='smile')
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

def wire_normal(k, cs):
    """unit normal of 'our' wire at the contact, pointing down-screen"""
    w = TR['ours'][int(min(max(round(k), 0), NSRC - 1))]
    if w is None: return np.array([0, 1.0])
    P = curve_pts(w, 200); i = int(np.argmin(np.linalg.norm(P - cs, axis=1))); i = min(max(i, 1), len(P) - 2)
    d = P[i + 1] - P[i - 1]; n = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
    return n if n[1] > 0 else -n

def wire_sag(t, upx):
    """sag of the wire at the contact (px): its weight + a bounce on the catch"""
    if t < T_CATCH: return 0.0
    d = t - T_CATCH; s = upx / 6.4
    return s * (6.0 + 16.0 * math.exp(-3.4 * d) * math.cos(2 * math.pi * 2.6 * d))

def build():
    frames = []; recs = []
    S_hist = []; R_hist = []; wear = Wear(); Rs = []
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
            if t < T_GRAB:                      # dropping in from the top of frame (from the garland shot)
                u = t / T_GRAB; gs = gs + np.array([60 * (1 - u), -900 * (1 - u) ** 2])
            G = cam.unproject(gs[0], gs[1], cam.dist_for(gs[0], gs[1], upx))
            yaw, h = facing(G, YAWOFF(t))
            phi = 38.0                          # lean back so the face looks down at the camera
            Rb = rotY(yaw) @ rotX(phi)
            Rb = rodrigues(h, swing(t) + (70 * (1 - t / T_GRAB) ** 2 if t < T_GRAB else 0)) @ Rb
            root = G - Rb @ GRIP_LOCAL
            arms = [{'fist': HANG_FISTS[0]}, {'fist': HANG_FISTS[1]}]
            # dangling feet: kick alternately while idle, pinned together when frozen, tucked in the pump
            kick = math.sin(t * 2 * math.pi / 0.62) if T_GRAB < t < T_NOTICE else 0.0
            if t < T_GRAB: pose['squash'] = -0.16 * t / T_GRAB             # stretched, reaching for the lamp
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
            nd = wire_normal(k, cs); A = wire_sag(t, upx)
            rec['sag'] = (A, cs.copy(), nd)
            cs = cs + nd * A                                                  # the wire sags under it (and bounces on the catch)
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
            hop = bounce(T_PUMP1 + 0.02, 7) + bounce(T_PUMP2 + 0.02, 5) + bounce(T_HOLD + 0.06, 3, 0.2)
            P, rot = rig.place(cam, p[0], p[1], upx, yaw_rel=YAWOFF(t))
            teeter = 0.0
            if T_WM0 <= t < T_WM1 + 0.1: teeter = 17 * math.sin(2 * math.pi * (t - T_WM0) / 0.36) * (1 - smooth(T_WM1 - 0.1, T_WM1 + 0.1, t)) + 8 * (1 - smooth(T_WM0, T_WM0 + 0.12, t))
            Rb = body_R(rot[1], teeter, 0)
            if t < T_LAND:
                u = (t - T_RELEASE_WIRE) / (T_LAND - T_RELEASE_WIRE)
                Rb = rodrigues(-P / np.linalg.norm(P), -200 * (1 - EASE['out'](u)) * 0 + 25 * math.sin(math.pi * u)) @ Rb
            up_w = np.array([0, 1.0, 0])
            root = P + up_w * hop * (cam.dist_for(p[0], p[1], upx) / cam.dist_for(p[0], p[1], upx))
            # arms: landing -> anticipation -> pump x2 -> hold
            pump = 0.0
            for t0 in (T_PUMP1, T_PUMP2):
                if t0 - 0.12 <= t <= t0 + 0.3: pump = max(pump, smooth(t0 - 0.12, t0, t) * (1 - smooth(t0 + 0.18, t0 + 0.3, t)))
            hold = smooth(T_HOLD - 0.06, T_HOLD + 0.07, t)
            up = max(pump, hold)
            antic = smooth(T_PUMP1 - 0.2, T_PUMP1 - 0.08, t) * (1 - smooth(T_PUMP1 - 0.08, T_PUMP1 - 0.02, t))
            arms = [{'fist': [-BW / 2 - 1.3, 6.4 - 1.2 * antic, 2.0]}, {'fist': [BW / 2 + 1.0 + 1.5 * up, 6.6 + up * 17.5 - antic * 1.5, 1.6 + 1.5 * up], 'rot': [0, 0, -15 * up]}]
            if T_WM0 <= t < T_WM1:              # near-fall: both arms windmill
                w = 2 * math.pi * (t - T_WM0) * 3.4
                arms = [{'fist': [-BW / 2 - 2.5, 9 + 6 * math.cos(w), 1 + 6 * math.sin(w)]}, {'fist': [BW / 2 + 2.5, 9 + 6 * math.cos(w + math.pi * 0.7), 1 + 6 * math.sin(w + math.pi * 0.7)]}]
            if t < T_LAND:
                arms = [{'fist': STRAP_FISTS[0]}, {'fist': STRAP_FISTS[1]}]
            pose['feet'] = None
            pose['squash'] = 0.0
            pose['lean'] = [0, 0]
            rec['anchor'] = p
            rec['hop'] = hop
        pose.update(eyes_at(t))
        op = blinks(t, seed=11, extra=blink_extra)
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
                        impulses=[(int(T_GRAB * 30), 0, 2.5, -3.0), (int(T_NOTICE * 30), 0, -1.2, -1.5), (int(T_CATCH * 30), 0, 3.0, -2.5), (int(T_LAND * 30), 0, 0, -3.2),
                                  (int(T_PUMP1 * 30) + 2, 0, 0, 2.0), (int(T_PUMP2 * 30) + 2, 0, 0, 1.6)])
    for i, r in enumerate(recs):
        p = r['pose']
        p['lean'] = [float(lean[i][0] + (p.get('lean') or [0, 0])[0]), float(lean[i][1] + (p.get('lean') or [0, 0])[1])]
        p['squash'] = float(np.clip(sq[i] + p.get('squash', 0), -0.26, 0.24))
        wind = np.array([0, 0, 0.0])
        if r['t'] >= T_CATCH and r['t'] < T_RELEASE_WIRE: wind = np.array([0, 6.0, 0])
        wear_pose(p, wear, r['t'], S[i], r['R'], wind=wind, gust=1.0 if r['t'] > T_REL else 0.55)
        if T_NOTICE <= r['t'] < T_PUMP0 + 0.2: p['sweat'] = sweat(r['t'], T_NOTICE + 0.05, 0.6)
    return recs

GRADE = dict(exposure=1.0, tint=(1.0, 1.0, 1.0), sat=0.95, haze=0.03, blur=0.55, wrap=0.35, wrap_sigma=12, grain=0.004, grain_size=0.8, highlight=0.9)

RAW = json.load(open('/home/user/brain/everywhere-claude/v3/track/1661_raw.json'))['wires']
P_ON, P_FULL, S_ON, S_FULL, P_OFF0, P_OFF1 = 4.1, 5.0, T_LAND - 0.06, T_LAND + 0.12, 5.6, 6.1

def wire_angles():
    """per source frame: angles of the three converging wires (left, middle, right), held when detection drops out"""
    out = {}; last = None
    for k in range(NSRC):
        ws = [w for w in RAW[k] if w['npts'] >= 25 and 75 < w['ang'] < 105]
        if len(ws) == 3:
            xs = []
            for w in ws:
                P = curve_pts(w, 60); i = int(np.argmin(np.abs(P[:, 1] - 300))); xs.append(P[i, 0])
            last = [ws[j]['ang'] for j in np.argsort(xs)]
        out[k] = last
    return out
ANG = wire_angles()

def wire_lines(k):
    """three wires as straight lines from the far pole tip up to the top edge: list of (top point, tip)"""
    B = pole_tip(k); a = ANG.get(int(round(k)))
    if B is None or a is None: return None
    L = []
    for ang in a:
        d = np.array([math.cos(math.radians(ang)), math.sin(math.radians(ang))])
        if d[1] > 0: d = -d
        s = (-80 - B[1]) / d[1]; L.append((B + d * s, B.copy()))
    return L

def strings_pattern(k):
    L = wire_lines(k)
    if L is None: return None, None
    at = lambda l, u: l[0] + (l[1] - l[0]) * u
    A, Bm, C = L
    pat = magic.Pattern(7); n = 15; stl = magic.st(color=(255, 226, 165), glow=(255, 200, 110), gk=0.35, width=1.4, alpha=0.4, blur=8)
    for i in range(1, n):
        u = i / n * 0.92
        w1 = magic.wobble([at(A, u), at(Bm, 0.92 - u)], 0.7, pat.rng); w2 = magic.wobble([at(C, u), at(Bm, 0.92 - u)], 0.7, pat.rng)
        pat.items.append(dict(g=[('line', w1, stl), ('line', w2, stl)], amp=0.7, raw=None))
    star = magic.Pattern(11); P = A[1]
    star.star(P[0], P[1] - 4, 60, 12, style=magic.st(color=(255, 226, 160), width=2.6))
    return pat, star

# privacy: the passing car's licence plate and driver's window are blurred (hand keyframed on full-res frames, src index)
PLATE_K = [(204, 140, 1904), (208, 360, 1876), (212, 600, 1836), (216, 860, 1820), (220, 1120, 1800)]
DRIVER_K = [(202, 0, 1780), (204, 40, 1760), (208, 150, 1720), (212, 360, 1660), (216, 500, 1640), (220, 720, 1610), (224, 960, 1560), (228, 1020, 1520), (232, 1180, 1500)]
def privacy_blur(img, k):
    for keys, (w, h) in ((PLATE_K, (120, 80)), (DRIVER_K, (300, 240))):
        ks = [a for a, _, _ in keys]
        if not (ks[0] - 2 <= k <= ks[-1] + 2): continue
        x = float(np.interp(k, ks, [b for _, b, _ in keys])); y = float(np.interp(k, ks, [c for _, _, c in keys]))
        x0, y0, x1, y1 = int(max(0, x - w)), int(max(0, y - h)), int(min(1080, x + w)), int(min(1920, y + h))
        if x1 <= x0 or y1 <= y0: continue
        reg = img[y0:y1, x0:x1]; bl = cv2.GaussianBlur(reg, (0, 0), 14)
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        m = np.clip((1 - np.maximum(np.abs(xx - x) / w, np.abs(yy - y) / h)) / 0.3, 0, 1)[..., None]
        reg[:] = reg * (1 - m) + bl * m
    return img

def jobs_and_frames(recs, ss_scale=1.0):
    shotlib.attach_env(recs, 'IMG_1661', lambda r: T0 + r['k'] / 30.0, lambda r: r['cam'], envK=1.0, emK=0.1)
    jobs, frames = [], []
    pts = []
    for i, r in enumerate(recs):
        out = f'{OUT}/f{i:04d}'
        j = rig.job(out, r['cam'], r['root'], r['R'], r['pose'], r['light'], r['upx'], env=r['env'], extent=(-30, 30, -30, 34))
        j['ss'] = round(j['ss'] * ss_scale, 3)
        jobs.append(j)
        pts.append(r['cam'].project(r['root'] + r['R'] @ np.array([0, 9.0, 0])))
        r['contact'] = r['cam'].project(r['root'] + r['R'] @ STRAP_APEX)
    sh = [0.45 if speed(r['t']) < 1.3 else 0.45 + (speed(r['t']) - 1) * 0.6 for r in recs]
    mv = shotlib.motion_vectors(pts, sh)
    # sparks off the strap: a little burst every other frame while it zips, riding half with the contact point
    bursts = []
    for i, r in enumerate(recs):
        if T_CATCH + 0.1 <= r['t'] < T_RELEASE_WIRE - 0.05 and i % 2 == 0:
            sc = r['upx'] / 6.4
            b = fx.Burst(r['t'], r['contact'], 8, (250 * sc, 650 * sc), angle=(-150, -30), gravity=1800 * sc, drag=2.5, life=(0.12, 0.28),
                         size=(1.6 * max(sc, 0.7), 2.6 * max(sc, 0.7)), col=(0.75, 0.93, 1.0), kind='spark', seed=100 + i)
            b.anchor = r['contact'].copy(); bursts.append(b)
    for i, r in enumerate(recs):
        g = dict(GRADE); g['mblur'] = mv[i]; g['seed'] = i; g['blur'] = 0.35 + 0.3 * smooth(3.5, 4.5, r['t']); g['haze'] = 0.02 + 0.06 * smooth(3.5, 4.8, r['t'])
        sp = speed(r['t'])
        src = shotlib.src_weights(r['k'], n_blend=sp if sp > 1.3 else 1)
        z = 1.0; c = (540, 960)
        if r['t'] > 4.95:
            zz = smooth(4.95, 5.9, r['t']); z = 1.0 + 0.85 * zz
            B = pole_tip(r['k']); c = (B[0] * zz + 540 * (1 - zz), (B[1] + 60) * zz + 960 * (1 - zz))
        t = r['t']; k = r['k']
        prog = smooth(P_ON, P_FULL, t); sprog = smooth(S_ON, S_FULL, t); al = 1 - smooth(P_OFF0, P_OFF1, t)
        pats = strings_pattern(k) if (prog > 0 and al > 0) else (None, None)
        sag = r.get('sag')
        def pre(img, ii, sag=sag, pats=pats, prog=prog, sprog=sprog, al=al, t=t, k=k):
            privacy_blur(img, k)
            if sag is not None and abs(sag[0]) > 0.3:          # bend the plate's wire around the contact
                A, cs, nd = sag; td = np.array([nd[1], -nd[0]]); L = 340.0
                x0, x1 = int(max(0, cs[0] - L)), int(min(1080, cs[0] + L)); y0, y1 = int(max(0, cs[1] - L)), int(min(1920, cs[1] + L))
                if x1 > x0 and y1 > y0:
                    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
                    al_ = (xx - cs[0]) * td[0] + (yy - cs[1]) * td[1]; pe = (xx - cs[0]) * nd[0] + (yy - cs[1]) * nd[1]
                    w = np.exp(-((pe - A * np.clip(1 - np.abs(al_) / L, 0, 1) ** 1.5) / 16.0) ** 2) * np.clip(1 - np.abs(al_) / L, 0, 1) ** 1.5
                    d = A * w
                    img[y0:y1, x0:x1] = cv2.remap(img[y0:y1, x0:x1].copy(), (xx - x0 - d * nd[0]).astype(np.float32), (yy - y0 - d * nd[1]).astype(np.float32),
                                                  cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            if pats[0] is not None:
                pats[0].render(img, prog, lambda P: P, alpha=al, boil=int(t * 30) // 3)
                if sprog > 0: pats[1].render(img, sprog, lambda P: P, alpha=al, boil=int(t * 30) // 3)
            return img
        def post(img, ii, t=t, c=r.get('contact')):
            for b in bursts:
                if 0 <= t - b.t0 < 0.3:
                    off = (c - b.anchor) * 0.5 if c is not None else 0
                    fx.draw_bursts(img, [b], t, lambda P, off=off: P + off, shutter=0.8)
            return img
        frames.append(dict(src=src, pre=pre, post=post, layers=[(f'{OUT}/f{i:04d}', g, None)], reframe=(z, c[0], c[1], 0.0)))
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
