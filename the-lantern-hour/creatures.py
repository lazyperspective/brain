"""
The two tortoises of THE LANTERN HOUR.
Drawn the way a child would build one (a dome, four stumps, a head on a stalk)
by someone who has looked at tortoises for sixty years.
"""
from engine import *


def mix(c1, c2, u):
    u = clamp(u)
    return tuple(a + (b - a) * u for a, b in zip(c1, c2))


def mul(c, k):
    return tuple(min(1.0, a * k) for a in c)


CHAR = (0.09, 0.07, 0.075)


def fillp(L, poly, col, rng, ang=0.6, w=4.0, dens=1.0, v=(0.45, 0.95), grain=0.8, soft=0.16, edge=0.9,
          solid=0.0, streak=None, op=1.0, tint=None, wob=1.2):
    """fill a polygon with hatching from one stick"""
    poly = np.asarray(poly, np.float64)
    x0, y0, x1, y1 = L.roi(poly[:, 0].min(), poly[:, 1].min(), poly[:, 0].max(), poly[:, 1].max(), pad=3)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    b = Batch(L, x0, y0, x1, y1)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    R = math.hypot(x1 - x0, y1 - y0) / 2 + 2
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    step = max(1.0, w * 0.85 / dens)
    n = int(2 * R / step) + 1
    offs = -R + (np.arange(n) + rng.uniform(-0.35, 0.35, n)) * step
    vv = rng.uniform(v[0], v[1], n)
    for o, val in zip(offs, vv):
        a = (cx + nx * o - dx * R, cy + ny * o - dy * R)
        c = (cx + nx * o + dx * R, cy + ny * o + dy * R)
        m_ = (cx + nx * (o + rng.normal(0, wob)), cy + ny * (o + rng.normal(0, wob)))
        b.line(np.array([a, m_, c]), w, val)
    if solid > 0:
        b.poly(poly, solid)
    mf = b.mask()
    mf *= polymask(y1 - y0, x1 - x0, poly - np.array([x0, y0]), blur=edge)
    L.deposit(mf, col, x0, y0, grain, soft, op, streak, tint)


def oline(L, pts, col, w, rng, v=0.95, wob=1.0, wl=40, taper=(0.6, 1.0), grain=0.78, soft=0.2, var=0.42, smooth=True, op=1.0):
    """a single charcoal / pencil line with a living pressure"""
    q = hand(pts, rng, wob, wl, spacing=2.5, smooth=smooth)
    if len(q) < 2:
        return
    pp = np.clip(1 + smooth1d(rng, len(q), 14, var), 0.25, 1.3)
    x0, y0, x1, y1 = L.roi(q[:, 0].min(), q[:, 1].min(), q[:, 0].max(), q[:, 1].max(), pad=w + 3)
    b = Batch(L, x0, y0, x1, y1)
    b.line(q, w, v, taper=taper, pp=pp)
    b.commit(col, grain=grain, soft=soft, op=op)


# ------------------------------------------------------------------ appearance
def look_for(age):
    a = age
    lk = {}
    lk['hd'] = lerp(0.60, 0.50, clamp(a))                 # dome height / length
    lk['hs'] = lerp(1.75, 1.0, clamp(a) ** 0.8)           # head size
    lk['neck'] = lerp(0.20, 0.34, clamp(a))
    lk['legl'] = lerp(0.115, 0.12, clamp(a))
    lk['legw'] = lerp(0.175, 0.135, clamp(a))
    lk['eye'] = lerp(0.030, 0.0135, clamp(a) ** 0.7)
    lk['brow'] = clamp((a - 0.5) / 0.3)
    old2 = clamp((a - 1.0) / 0.3)
    lk['base'] = mix(mix((0.40, 0.25, 0.11), (0.19, 0.17, 0.12), a), (0.30, 0.28, 0.24), old2)
    lk['mid'] = mix(mix((0.62, 0.42, 0.17), (0.34, 0.30, 0.19), a), (0.44, 0.41, 0.34), old2)
    lk['areola'] = mix(mix((0.97, 0.78, 0.36), (0.66, 0.56, 0.30), a), (0.70, 0.66, 0.52), old2)
    lk['hi'] = mix(mix((1.0, 0.93, 0.66), (0.80, 0.76, 0.56), a), (0.86, 0.84, 0.74), old2)
    lk['skin'] = mix(mix((0.60, 0.58, 0.38), (0.42, 0.40, 0.30), a), (0.50, 0.48, 0.42), old2)
    lk['skin_d'] = mul(lk['skin'], 0.55)
    lk['skin_l'] = mix(lk['skin'], (0.95, 0.9, 0.7), 0.45)
    lk['moss'] = clamp((a - 0.75) / 0.3)
    lk['rings'] = 1 + int(3.5 * clamp(a))
    lk['notch'] = a > 0.8
    return lk


def shell_fn(hd, stand):
    """P(u, v): u 0 rear .. 1 front along the rim, v 0 rim .. 1 crown"""

    def P(u, v):
        u = np.asarray(u, np.float64); v = np.asarray(v, np.float64)
        xr = (u - 0.5) * 1.02
        yr = stand + 0.085 + 0.06 * (2 * u - 1) ** 4 + 0.012 * np.sin(u * 3.1)
        th = math.pi * (1 - u)
        xd = 0.5 * np.cos(th) * (1 - 0.0 * np.sin(th))
        yd = yr + hd * np.sin(th) ** 0.70 * (1 - 0.10 * np.cos(th)) - 0.06 * (2 * u - 1) ** 4 * np.sin(th)
        # bulge: the side of a dome is not a straight ruling
        bul = np.sin(v * math.pi) * 0.035 * np.cos(th)
        return np.stack([xr + (xd - xr) * v + bul, yr + (yd - yr) * np.sign(v) * np.abs(v) ** 0.92], -1)

    return P


STRIDE = 0.30


def draw_tortoise(L, rng, x, y, s, age=1.0, face=1, ext=1.0, look=0.0, reach=0.0, tuck=0.0, phase=0.0,
                  walk=0.0, rot=0.0, pivot=None, blink=0.0, breath=0.0, wave=0.0, chew=0.0, paw=0.0, tap=0.0, yoff=0.0, rest=False):
    """returns dict of landmark sheet positions (head, mouth, crown, front)"""
    lk = look_for(age)
    stand = lk['legl'] * (1 - tuck)
    bob = 0.010 * math.sin(4 * math.pi * phase) * walk
    rock = 0.022 * math.sin(2 * math.pi * phase) * walk
    if pivot is None:
        pivot = (0.0, stand + 0.25)
    fsgn = 1 if face >= 0 else -1
    X = Xf(x, y - bob * s - yoff, s, face, (rot + rock) * fsgn, pivot)
    if rest:
        # let it lie on the ground whatever its attitude
        uu_ = np.linspace(0, 1, 24)
        P_ = shell_fn(lk['hd'], stand)
        cand = np.vstack([P_(uu_, np.ones_like(uu_)), P_(uu_, np.zeros_like(uu_)), [(-0.3, 0.0), (0.3, 0.0)]])
        low = X(cand)[:, 1].max()
        X = Xf(x, y - bob * s - yoff - (low - y), s, face, (rot + rock) * fsgn, pivot)
    big = s > 70
    lw = max(1.0, s * 0.0085)            # outline weight
    hd = lk['hd'] * (1 + 0.025 * breath)
    P = shell_fn(hd, stand)
    hatch_a = (0.9 if face > 0 else math.pi - 0.9) - rot * fsgn

    # ---------------- legs
    def leg(hx, off, far, o_phase):
        legl = lk['legl'] * (1 - tuck) + 0.05
        if legl < 0.06:
            return
        p = (phase + o_phase) % 1.0
        A = 0.09 * walk
        if p < 0.6:
            fo = lerp(A, -A, p / 0.6); lift = 0.0
        else:
            q = (p - 0.6) / 0.4
            fo = lerp(-A, A, ease(q)); lift = math.sin(math.pi * q) * 0.045 * walk
        if wave:
            fo += 0.07 * math.sin(wave * 2 * math.pi + o_phase * 9); lift += 0.0
        w = lk['legw'] * (0.9 if far else 1.0)
        hy = stand + 0.07
        fx, fy = hx + fo + off, lift
        if paw and not far and hx > 0:
            fx += (0.30 + 0.06 * tap) * paw; fy += (0.125 - 0.02 * tap) * paw
        if wave:
            fy = stand - legl + 0.02
        knee = 0.02 if hx > 0 else -0.015
        A_ = np.array([hx, hy]); B_ = np.array([fx, fy])
        dd = B_ - A_; dl = np.hypot(*dd) + 1e-9; dd = dd / dl
        nn = np.array([-dd[1], dd[0]])
        if nn[0] < 0 and abs(dd[1]) > 0.7:
            nn = -nn
        M_ = (A_ + B_) / 2 + np.array([knee, 0.0])
        poly = np.array([A_ - nn * w / 2, M_ - nn * w * 0.48, B_ - nn * w * 0.45 - dd * 0.004, B_ - nn * w * 0.40 + dd * 0.012,
                         B_ + nn * w * 0.50 + dd * 0.012, B_ + nn * w * 0.56 - dd * 0.012, M_ + nn * w * 0.52, A_ + nn * w / 2])
        pp = X(poly)
        col = lk['skin_d'] if far else lk['skin']
        fillp(L, pp, col, rng, ang=hatch_a + 0.5, w=max(1.5, s * 0.018), solid=0.72, grain=0.7, edge=max(0.6, s * 0.004))
        if big:
            # scales: little stacked dabs
            b = Batch(L, *L.roi(pp[:, 0].min(), pp[:, 1].min(), pp[:, 0].max(), pp[:, 1].max(), 2))
            for k in range(int(9 if not far else 4)):
                u, v = rng.uniform(0.15, 0.85), rng.uniform(0.1, 0.8)
                c = X(np.array([lerp(hx, fx, v) + (u - 0.5) * w * 0.8, lerp(hy, fy, v)]))
                b.dot(c[0], c[1], s * 0.011, rng.uniform(0.5, 0.9))
            b.commit(lk['skin_l'] if not far else lk['skin'], grain=0.8, soft=0.2)
        oline(L, pp[[0, 1, 2, 3, 4, 5, 6, 7]], CHAR, lw * (0.8 if far else 1.0), rng, wob=s * 0.003, v=0.85 if not far else 0.6)
        if big and not far and not wave:
            raised = abs(dd[1]) < 0.7
            for k in range(3):
                if raised:
                    q0 = B_ + nn * w * (0.34 - 0.30 * k) + dd * 0.004
                    c0 = X(q0); c1 = X(q0 + dd * 0.030)
                else:
                    cx_ = fx + w * (0.52 - 0.2 * k)
                    c0 = X(np.array([cx_, fy + 0.022])); c1 = X(np.array([cx_ + 0.022, fy - 0.004]))
                oline(L, [c0, c1], CHAR, lw * 0.9, rng, wob=0, taper=(1, 0.5))

    fr_x, hi_x = 0.26, -0.29
    leg(fr_x + 0.05, 0.0, True, 0.5)
    leg(hi_x + 0.05, 0.0, True, 0.05)

    # ---------------- tail
    t0 = X(np.array([-0.455, stand + 0.085])); t1 = X(np.array([-0.555 + 0.03 * tuck, stand + 0.03 + 0.02 * tuck]))
    oline(L, [t0, t1], lk['skin'], max(1.5, s * 0.03), rng, wob=0, taper=(1.0, 0.3), v=0.9)
    oline(L, [t0, t1], CHAR, lw * 0.7, rng, wob=0, taper=(1.0, 0.4), v=0.6)

    # ---------------- neck and head
    hs = lk['hs']
    rx, ry = 0.078 * hs, 0.058 * hs
    root = np.array([0.37, stand + 0.115])
    na = 0.12 + reach * 1.05 + look * 0.35
    nl = lk['neck'] * (0.25 + 0.75 * ext) * (1 + 0.25 * reach)
    out_pos = root + np.array([0.06 + math.cos(na) * nl, math.sin(na) * nl + 0.01])
    hid_pos = np.array([0.5 - rx - 0.05, stand + 0.115])
    e = ease(ext)
    hc = hid_pos + (out_pos - hid_pos) * e
    ha = (na * 0.55 + look) * e
    info = {}
    if ext > 0.04:
        # neck: a sagging tube
        ctrl = (root + hc) / 2 + np.array([0.0, -0.035 * e - 0.03 * reach])
        tt = np.linspace(0, 1, 9)[:, None]
        cl = (1 - tt) ** 2 * root + 2 * (1 - tt) * tt * ctrl + tt ** 2 * hc
        d = np.gradient(cl, axis=0); d /= (np.hypot(d[:, 0], d[:, 1])[:, None] + 1e-9)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        wn = np.linspace(0.14, 0.10 * (0.75 + 0.25 * hs), 9)[:, None] * (0.9 + 0.1 * hs)
        up = cl + nrm * wn / 2; dn = cl - nrm * wn / 2
        npoly = X(np.vstack([up, dn[::-1]]))
        fillp(L, npoly, lk['skin'], rng, ang=hatch_a + 0.3, w=max(1.5, s * 0.016), solid=0.75, grain=0.7, edge=max(0.6, s * 0.004))
        if big:
            # folds of the neck
            nf = 2 + int(3 * lk['brow'])
            for k in range(nf):
                u = 0.2 + 0.6 * (k + rng.uniform(0, 0.5)) / nf
                i = int(u * 8)
                a_ = X(up[i] * 0.92 + dn[i] * 0.08); b_ = X(up[i] * 0.25 + dn[i] * 0.75 + d[i] * 0.012)
                oline(L, [a_, b_], lk['skin_d'], lw * 0.7, rng, wob=s * 0.002, v=0.6, taper=(1, 0.4))
        oline(L, X(up), CHAR, lw * 0.85, rng, wob=s * 0.002, v=0.8)
        oline(L, X(dn), CHAR, lw * 0.95, rng, wob=s * 0.002, v=0.85)
        # underside shadow of neck
        fillp(L, X(np.vstack([cl, dn[::-1]])), (0.25, 0.22, 0.25), rng, ang=hatch_a, w=max(1.2, s * 0.012), grain=0.9, tint=True, op=0.55, v=(0.3, 0.7))
    # head
    ph = np.linspace(0, 2 * math.pi, 26, endpoint=False)
    hx_ = rx * np.cos(ph) * (1 + 0.16 * np.clip(np.cos(ph), 0, 1) ** 2)
    hy_ = ry * np.sin(ph) * (1 - 0.10 * np.clip(np.cos(ph), 0, 1))
    hy_ = np.where(np.sin(ph) < 0, hy_ * 0.86, hy_)
    ca, sa = math.cos(ha), math.sin(ha)

    def HP(px, py):
        return np.stack([hc[0] + px * ca - py * sa, hc[1] + px * sa + py * ca], -1)

    hpoly = X(HP(hx_, hy_))
    if ext > 0.04:
        fillp(L, hpoly, lk['skin'], rng, ang=hatch_a + 0.2, w=max(1.5, s * 0.015), solid=0.8, grain=0.65, edge=max(0.6, s * 0.004))
        # light on the top of the skull
        top = X(HP(hx_[1:12] * 0.86, hy_[1:12] * 0.86 + 0.004))
        low = X(HP(hx_[1:12][::-1] * 0.8, hy_[1:12][::-1] * 0.25))
        fillp(L, np.vstack([top, low]), lk['skin_l'], rng, ang=hatch_a, w=max(1.2, s * 0.012), grain=0.95, v=(0.3, 0.75), edge=1.0)
        oline(L, np.vstack([hpoly, hpoly[:2]]), CHAR, lw * 0.95, rng, wob=s * 0.0015, v=0.9, taper=(1, 1))
        # mouth
        mo = 0.012 * chew
        m0 = X(HP(rx * 1.13, -ry * 0.24 - mo)); m1 = X(HP(rx * 0.60, -ry * (0.30 - 0.06 * lk['brow']) - mo)); m2 = X(HP(rx * 0.12, -ry * (0.26 + 0.10 * lk['brow'])))
        oline(L, [m0, m1, m2], CHAR, lw * 0.75, rng, wob=0, v=0.8, taper=(0.7, 1.0))
        # eye
        ex, ey = rx * 0.34, ry * 0.26
        er = lk['eye'] * s
        ec = X(HP(ex, ey))
        if er > 0.9:
            b = Batch(L, *L.roi(ec[0] - er * 3, ec[1] - er * 3, ec[0] + er * 3, ec[1] + er * 3))
            if blink < 0.6:
                b.dot(ec[0], ec[1], er * 1.25, 1.0)
                b.commit(lk['skin_l'], grain=0.3, soft=0.3, op=0.55)
                b.dot(ec[0], ec[1], er, 1.0)
                b.commit((0.03, 0.03, 0.035), grain=0.15, soft=0.3)
                if er > 2.0:
                    b.dot(ec[0] - er * 0.32, ec[1] - er * 0.36, max(0.8, er * 0.30), 1.0)
                    b.commit((1.0, 0.98, 0.9), grain=0.1, soft=0.3)
            else:
                l0 = X(HP(ex - er / s * 1.2, ey)); l1 = X(HP(ex, ey - er / s * 0.5)); l2 = X(HP(ex + er / s * 1.2, ey))
                oline(L, [l0, l1, l2], CHAR, max(1.0, lw * 0.8), rng, wob=0, v=0.9, taper=(1, 1))
            if blink >= 0.25 and blink < 0.6:
                # half lid
                l0 = X(HP(ex - er / s * 1.3, ey + er / s * 0.5)); l2 = X(HP(ex + er / s * 1.3, ey + er / s * 0.4))
                oline(L, [l0, l2], lk['skin'], max(1.5, er * 0.9), rng, wob=0, v=1.0, taper=(1, 1), grain=0.3)
                oline(L, [l0 + (0, er * 0.4), l2 + (0, er * 0.4)], CHAR, max(1.0, lw * 0.7), rng, wob=0, v=0.8, taper=(1, 1))
        if lk['brow'] > 0.1 and big:
            b0 = X(HP(ex - rx * 0.42, ey + ry * 0.62)); b1 = X(HP(ex + rx * 0.5, ey + ry * (0.62 - 0.30 * lk['brow'])))
            oline(L, [b0, b1], CHAR, lw * 1.2, rng, wob=0, v=0.85, taper=(1.0, 0.5))
        if big:
            n0 = X(HP(rx * 1.02, ry * 0.18))
            b = Batch(L, *L.roi(n0[0] - 3, n0[1] - 3, n0[0] + 3, n0[1] + 3)); b.dot(n0[0], n0[1], max(0.8, lw * 0.5), 0.8); b.commit(CHAR, grain=0.3)
    info['head'] = tuple(X(hc))
    info['mouth'] = tuple(X(HP(rx * 1.15, -ry * 0.2)))
    info['eye'] = tuple(X(HP(rx * 0.34, ry * 0.26)))

    # ---------------- near legs
    leg(fr_x, 0.0, False, 0.0)
    leg(hi_x, 0.0, False, 0.55)

    # ---------------- the shell
    uu = np.linspace(0, 1, 40)
    dome = P(uu, np.ones_like(uu))
    rim = P(uu, np.zeros_like(uu))
    belly = rim.copy(); belly[:, 1] -= 0.035 * np.sin(uu * math.pi) ** 0.5
    outline_l = np.vstack([dome, belly[::-1]])
    if lk['notch']:
        pass
    spoly = X(outline_l)
    fillp(L, spoly, lk['base'], rng, ang=hatch_a, w=max(2.0, s * 0.030), solid=0.74, grain=0.7, edge=max(0.7, s * 0.004))
    # second colour, laid along the curve of the dome, leaving the first showing
    x0, y0, x1, y1 = L.roi(spoly[:, 0].min(), spoly[:, 1].min(), spoly[:, 0].max(), spoly[:, 1].max(), 3)
    if x1 - x0 < 3 or y1 - y0 < 3:
        info['bbox'] = (0, 0, 0, 0); info['X'] = X; info['stand'] = stand
        return info
    clipm = polymask(y1 - y0, x1 - x0, spoly - np.array([x0, y0]), blur=max(0.7, s * 0.004))
    b = Batch(L, x0, y0, x1, y1)
    nv = int(clamp(s / 14, 5, 22))
    for k in range(nv):
        v = (k + rng.uniform(0.1, 0.9)) / nv
        u0 = rng.uniform(0.0, 0.25); u1 = rng.uniform(0.75, 1.0)
        us = np.linspace(u0, u1, 14)
        b.line(X(P(us, np.full_like(us, v))), max(2.0, s * 0.028), rng.uniform(0.25, 0.7))
    mf = b.mask() * clipm
    L.deposit(mf, lk['mid'], x0, y0, grain=0.92, soft=0.15, streak=(0, 0.4))
    b.items = []

    # scutes
    cu = [0.045, 0.265, 0.50, 0.735, 0.955]      # costal boundaries
    vm, vc = 0.20, 0.74

    def seam_top(u):
        return vc + 0.045 * np.abs(((u * 4 + 0.5) % 1.0) - 0.5) * 2 - 0.02

    if big:
        for k in range(4):
            ua, ub = cu[k], cu[k + 1]
            uc = (ua + ub) / 2; vcn = (vm + vc) / 2 + 0.02
            # scute polygon (local uv)
            pu = np.concatenate([np.linspace(ua, ub, 6), np.full(5, ub), np.linspace(ub, ua, 6), np.full(5, ua)])
            pv = np.concatenate([np.full(6, vm), np.linspace(vm, seam_top(np.array(ub)), 5), seam_top(np.linspace(ub, ua, 6)), np.linspace(seam_top(np.array(ua)), vm, 5)])
            for ring, (sh, colr, pr) in enumerate([(0.62, lk['mid'], 0.55), (0.40, lk['areola'], 0.8)]):
                qu = uc + (pu - uc) * sh; qv = vcn + (pv - vcn) * sh
                poly = X(P(qu, qv))
                fillp(L, poly, colr, rng, ang=hatch_a + rng.normal(0, 0.3), w=max(1.6, s * 0.016), grain=0.95, v=(pr * 0.5, pr), edge=max(1.0, s * 0.008), solid=pr * 0.25)
            # growth rings in pencil
            for r in range(lk['rings']):
                sh = 0.50 + 0.42 * (r + 0.5) / lk['rings']
                qu = uc + (pu - uc) * sh; qv = vcn + (pv - vcn) * sh
                poly = X(P(qu, qv))
                i0 = rng.integers(0, len(poly)); nn = rng.integers(len(poly) // 2, len(poly))
                idx = (i0 + np.arange(nn)) % len(poly)
                oline(L, poly[idx], mul(lk['base'], 0.55), max(1.0, lw * 0.6), rng, wob=s * 0.0015, v=0.55, smooth=False, taper=(1, 1), var=0.45)
        # vertebral scutes glimpsed along the crown
        vu = [0.10, 0.30, 0.50, 0.70, 0.90]
        for k in range(4):
            ua, ub = vu[k] + 0.03, vu[k + 1] - 0.03
            us = np.linspace(ua, ub, 6)
            poly = X(np.vstack([P(us, seam_top(us) + 0.06), P(us[::-1], np.full(6, 0.965))]))
            fillp(L, poly, lk['areola'], rng, ang=hatch_a, w=max(1.5, s * 0.014), grain=0.97, v=(0.25, 0.6), edge=max(1.0, s * 0.007))
    # light falling on the crown, shadow gathering under the rear
    us = np.linspace(0.30, 0.93, 16)
    hi_poly = X(np.vstack([P(us, np.full(16, 0.99)), P(us[::-1], np.linspace(0.60, 0.80, 16))]))
    fillp(L, hi_poly, lk['hi'], rng, ang=hatch_a - 0.25, w=max(1.6, s * 0.02), grain=1.0, v=(0.12, 0.42), edge=max(1.5, s * 0.02))
    us = np.linspace(0.0, 0.62, 16)
    sh_poly = X(np.vstack([P(us, np.linspace(0.75, 0.25, 16)), belly[0:26][::-1] if False else P(us[::-1], np.full(16, -0.25))]))
    fillp(L, sh_poly, (0.30, 0.28, 0.40), rng, ang=hatch_a, w=max(1.6, s * 0.02), grain=0.9, v=(0.2, 0.6), edge=max(1.5, s * 0.02), tint=True, op=0.6)
    if lk['moss'] > 0 and big:
        b = Batch(L, x0, y0, x1, y1)
        for k in range(int(26 * lk['moss'])):
            u = rng.uniform(0.2, 0.8); v = rng.uniform(0.82, 1.0)
            c = X(P(np.array(u), np.array(v)))
            b.dot(c[0], c[1], rng.uniform(0.006, 0.013) * s, rng.uniform(0.3, 0.8))
        mf = b.mask() * clipm
        L.deposit(mf, (0.38, 0.50, 0.24), x0, y0, grain=0.9, soft=0.2)
    # seams
    if big:
        us = np.linspace(0.015, 0.985, 30)
        oline(L, X(P(us, np.full(30, vm))), CHAR, lw * 0.9, rng, wob=s * 0.002, v=0.75)
        us = np.linspace(cu[0], cu[-1], 33)
        oline(L, X(P(us, seam_top(us))), CHAR, lw * 0.9, rng, wob=s * 0.002, v=0.75, smooth=False)
        for u in cu:
            vs = np.linspace(vm, float(seam_top(np.array(u))), 6)
            oline(L, X(P(np.full(6, u) + 0.012 * np.sin(vs * 5), vs)), CHAR, lw * 0.85, rng, wob=s * 0.002, v=0.75)
        for u in vu:
            vs = np.linspace(float(seam_top(np.array(u))), 0.995, 4)
            oline(L, X(P(np.full(4, u), vs)), CHAR, lw * 0.7, rng, wob=s * 0.001, v=0.6)
        for k in range(1, 11):
            u = k / 11 + rng.normal(0, 0.004)
            vs = np.linspace(0.0, vm, 4)
            oline(L, X(P(np.full(4, u), vs)), CHAR, lw * 0.7, rng, wob=s * 0.001, v=0.65)
    else:
        us = np.linspace(0.02, 0.98, 12)
        oline(L, X(P(us, np.full(12, vm))), CHAR, max(1.0, lw * 0.8), rng, wob=0, v=0.6)
        for u in cu[1:-1]:
            vs = np.linspace(vm, 0.8, 4)
            oline(L, X(P(np.full(4, u), vs)), CHAR, max(1.0, lw * 0.7), rng, wob=0, v=0.5)
    # outline: heavier underneath, where the weight is
    oline(L, X(dome), CHAR, lw * 1.25, rng, wob=s * 0.0025, v=0.92, wl=60)
    oline(L, X(belly), CHAR, lw * 1.7, rng, wob=s * 0.002, v=0.95, wl=60, taper=(1, 1))
    info['crown'] = tuple(X(P(np.array(0.5), np.array(1.0))))
    info['rear'] = tuple(X(np.array([-0.5, stand + 0.2])))
    info['front'] = tuple(X(np.array([0.5, stand + 0.2])))
    info['bbox'] = (spoly[:, 0].min(), spoly[:, 1].min(), spoly[:, 0].max(), spoly[:, 1].max())
    info['X'] = X
    info['stand'] = stand
    return info


def ground_shadow(cv_, rng, x, y, w, strength=0.5, col=(0.25, 0.22, 0.35), h=None):
    """the pool of charcoal under something heavy"""
    h = w * 0.11 if h is None else h
    b = Batch(cv_, *cv_.roi(x - w * 0.6, y - h * 2, x + w * 0.6, y + h * 2, 4))
    n = max(4, int(h * 1.2))
    for k in range(n):
        yy = y + (k / (n - 1) - 0.45) * h * 1.6
        hw = w * 0.5 * math.sqrt(max(0.05, 1 - ((k / (n - 1) - 0.45) * 1.8) ** 2))
        b.line(np.array([(x - hw + rng.normal(0, 3), yy), (x + hw + rng.normal(0, 3), yy + rng.normal(0, 1))]), 3, rng.uniform(0.4, 0.9))
    b.commit(col, grain=0.85, soft=0.2, op=strength, tint=True, blur=1.2)
