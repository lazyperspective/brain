#!/usr/bin/env python3
"""The montage: three ways of building the world (current, tide, pop-up), cut together as one edit to the
film's own soundtrack, ending on the current animation completing the world.  No text.

    ../.venv/bin/python montage.py preview          out/montage/preview.jpg: first / middle / last frame of every shot (1x)
    ../.venv/bin/python montage.py render [-j 4]    renders every shot -> out/montage/shots/NN.mp4
    ../.venv/bin/python montage.py assemble         joins the shots (cuts, page turn, ripple, fade) + soundtrack
                                                    -> out/wonders_montage.mp4 (+ _share.mp4)

Time is music time: 72 BPM, one beat = 0.8333 s, one bar = 3.3333 s; the whole edit is the film's 58.33 s score.
Each shot names its feel, its build clock (tb0 -> tb1, eased or linear), and its camera (a -> b).  The life clock
runs in real time from the shot's build clock, so people and water keep moving at their own pace even when the
construction is slowed down.
"""
import argparse
import math
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'montage')
WAV = os.path.join(os.path.dirname(HERE), 'out', 'soundtrack.wav')
SIZE = (1920, 1080)
FPS = 30
BEAT = 60.0 / 72.0
BAR = 4 * BEAT
TOTAL = 1750                      # = the film's score, 58.33 s


def fr(sec):
    return int(round(sec * FPS))


def B(n):
    """beat n (0-based) -> seconds"""
    return n * BEAT


# --------------------------------------------------------------- cameras ----
# landmark centres (map px) - the film's own close-up framings, plus a few closer looks
WIDE = (0.0, 33.0, 2.2)
P = {
    'colosseum': (-98.0, 6.0), 'eiffel': (-32.0, -89.0), 'everest': (172.0, -106.0), 'greatwall': (118.0, -8.0),
    'fuji': (236.0, 46.0), 'halong': (262.0, 148.0), 'taj': (104.0, 100.0), 'reef': (40.0, 180.0),
    'rio': (-106.0, 102.0), 'machu': (-262.0, 140.0), 'chichen': (-214.0, 50.0), 'niagara': (-236.0, -24.0),
    'pyramids': (4.0, 46.0),
}


def C(name, z, dx=0.0, dy=0.0):
    x, y = P[name]
    return (x + dx, y + dy, z)


# ------------------------------------------------------------------ shots ----
# feel, start (s), end (s), build clock tb0 -> tb1, camera a -> b, [ease], [transition in], [tail frames]
# ease: 'lin' | 'io' (in-out) | 'out';  transition 'page' / 'ripple' blends from the previous shot's tail.
SHOTS = []


def shot(feel, t0, t1, tb, cam, ease='lin', cam_ease='io', tin=None, whip_out=None, whip_in=None, note=''):
    SHOTS.append(dict(feel=feel, t0=t0, t1=t1, tb=tb, cam=cam, ease=ease, cam_ease=cam_ease, tin=tin,
                      whip_out=whip_out, whip_in=whip_in, note=note))


# ---- I. the blank page (bars 1-3, 0-10 s): quiet, close, unhurried --------------------------------
shot('current', B(0), B(4), (0.22, 1.20), ((-104, 2, 9.0), (-100, 4, 10.2)),
     note='pencil and ink trace the Colosseum, very close')
shot('tide', B(4), B(7), (0.20, 1.10), ((64, 78, 6.0), (78, 84, 6.6)),
     note='the wave front reaches the Taj')
shot('popup', B(7), B(10), (0.80, 2.05), ((94, 100, 5.2), (98, 96, 5.6)),
     note='the Taj panel swings open on its crease')
shot('current', B(10), B(12), (2.62, 3.45), ((158, -88, 5.4), (158, -96, 5.0)),
     note='Everest pushes up out of the slab')

# ---- II. the world assembles (bars 4-11, 10-36.7 s): the theme; cuts on bars and half-bars ---------
EIF = ((2, -96, 4.0), (2, -104, 3.85))
FUJ = ((222, 20, 5.0), (222, 16, 5.3))
EVE = ((206, -112, 4.2), (206, -118, 4.0))
shot('tide', B(12), B(16), (0.25, 3.60), ((4.0, 40.0, 3.6), (0.0, 34.0, 2.25)), cam_ease='out',
     note='establishing: one ripple of reality rolls out across the world')
shot('popup', B(16), B(18), (3.88, 5.00), EIF, note='the Paris page flips open, the tower rises with it')
shot('current', B(18), B(20), (3.05, 4.15), EIF, note='match: the tower shoots up, drawn in pencil and ink')
shot('tide', B(20), B(22), (1.30, 2.40), EIF, whip_out=(-1, 0), note='match: the tide reaches Paris')
shot('current', B(22), B(24), (2.86, 3.75), ((-212, -52, 5.0), (-216, -58, 5.3)), whip_in=(-1, 0),
     note='Niagara fills its gorge and spills off the edge')
shot('popup', B(24), B(28), (1.10, 3.70), ((0, 45, 3.0), (0, 38, 2.45)), cam_ease='out',
     note='wide: the folded world opens page by page')
shot('tide', B(28), B(30), (0.95, 2.15), ((100, 140, 4.0), (120, 136, 4.3)), tin='page', note='the oceans flood in')
shot('current', B(30), B(32), (2.55, 3.40), FUJ, note='Fuji: snow settles down the cone')
shot('popup', B(32), B(34), (2.80, 3.95), FUJ, note='match: the Fuji page opens')
shot('tide', B(34), B(36), (0.80, 1.90), ((-200, 60, 4.4), (-215, 130, 4.2)), note='the wave crosses the Americas')
shot('current', B(36), B(40), (0.90, 2.60), ((88, 2, 3.8), (158, -26, 3.8)),
     note='a slow dolly along the build front: cranes, pencil, ink, wash')
shot('popup', B(40), B(42), (3.40, 4.55), EVE, note='the Himalaya page opens')
shot('tide', B(42), B(44), (1.70, 2.90), EVE, tin='ripple', note='match: the tide reaches Everest')

# ---- III. crescendo (bars 12-15, 36.7-50 s): on the beat ------------------------------------------
RIO = ((-110, 80, 5.0), (-110, 78, 5.2))
CHI = ((-220, 35, 5.0), (-220, 33, 5.2))
HAL = ((215, 140, 4.6), (215, 138, 4.8))
COL = ((-110, -20, 4.6), (-110, -22, 4.8))
shot('current', B(44), B(45), (1.30, 1.85), RIO, note='Rio: ink')
shot('tide', B(45), B(46), (0.60, 1.10), RIO, note='Rio: tide')
shot('popup', B(46), B(47), (1.80, 2.40), RIO, note='Rio: page')
shot('current', B(47), B(48), (2.60, 3.05), CHI, note='Chichen: ink')
shot('tide', B(48), B(50), (0.30, 1.70), ((2.0, 42.0, 3.0), (0.0, 36.0, 2.5)), note='wide tide')
shot('popup', B(50), B(51), (2.80, 3.40), HAL, note='Ha Long page')
shot('current', B(51), B(52), (2.25, 2.85), HAL, note='Ha Long: rocks rise')
shot('tide', B(52), B(53), (0.45, 0.95), COL, note='Colosseum: tide')
shot('popup', B(53), B(54), (0.60, 1.30), COL, note='Colosseum: page')
shot('current', B(54), B(56), (1.80, 2.60), ((40.0, 60.0, 3.2), (30.0, 50.0, 2.9)), note='medium: the spiral builds')
shot('popup', B(56), B(57), (4.70, 5.30), ((300, 110, 3.8), (305, 108, 4.0)), note='Opera tab')
shot('tide', B(57), B(58), (1.50, 2.00), ((-225, 140, 4.4), (-225, 138, 4.6)), note='Machu')
shot('popup', B(58), B(59), (4.00, 4.65), ((-215, -70, 4.0), (-215, -72, 3.8)), note='Niagara page')

# ---- IV. the current animation completes the world (bar 16 -> end) ---------------------------------
shot('current', B(59), B(62), (3.00, 4.05), ((0, -80, 3.6), (0, -90, 3.1)), ease='lin',
     note='slow: the Eiffel Tower, the last slab, rises')
shot('current', B(62), TOTAL / FPS, (4.05, 7.10), ((-4.0, 30.0, 3.05), (0.0, 33.0, 2.12)), ease='finale',
     cam_ease='out', note='the world completes; glints ripple on the last chord; hold')

TAIL = {'page': 26, 'ripple': 24}       # frames the outgoing shot runs on under a transition


def _check():
    t = 0.0
    for k, s in enumerate(SHOTS):
        assert abs(s['t0'] - t) < 1e-6, (k, s['t0'], t)
        t = s['t1']
    assert abs(t - TOTAL / FPS) < 1e-6, t


_check()


def shot_frames(k):
    s = SHOTS[k]
    f0, f1 = fr(s['t0']), fr(s['t1'])
    nxt = SHOTS[k + 1] if k + 1 < len(SHOTS) else None
    tail = TAIL.get(nxt['tin'], 0) if nxt else 0
    return f0, f1, tail


# ----------------------------------------------------------------- clocks ----
def _ease(kind, u):
    from wonders import ease
    if kind == 'lin':
        return u
    if kind == 'io':
        return ease.in_out(u, 2.0)
    if kind == 'out':
        return 1 - (1 - u) ** 2.2
    raise ValueError(kind)


def build_clock(s, f):
    """build time at (fractional) frame f of the edit"""
    f0, f1 = fr(s['t0']), fr(s['t1'])
    u = (f - f0) / float(f1 - f0)
    a, b = s['tb']
    if s['ease'] == 'finale':
        # glide in, and land the glints (timeline FINALE) exactly on the final chord at bar 17 (53.33 s)
        from wonders import timeline as TL
        t_chord = 16 * BAR
        uc = (t_chord * FPS - f0) / float(f1 - f0)
        if u <= uc:
            x = u / uc
            return a + (TL.FINALE - a) * x
        x = (u - uc) / (1 - uc)
        return TL.FINALE + (b - TL.FINALE) * (1 - (1 - x) ** 1.6)
    return a + (b - a) * _ease(s['ease'], u) if u <= 1 else b + (b - a) / (f1 - f0) * (f - f1)


def life_clock(s, f):
    """life runs in real time, anchored to the shot's build clock at its start"""
    return s['tb'][0] + (f - fr(s['t0'])) / FPS


def camera(s, f):
    f0, f1 = fr(s['t0']), fr(s['t1'])
    u = min(1.0, max(0.0, (f - f0) / float(f1 - f0)))
    e = _ease(s['cam_ease'], u)
    a, b = s['cam']
    cam = (a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * e))
    # whip pans: the last / first few frames sling sideways, so the cut hides in the smear
    W = 7
    if s['whip_out'] and f > f1 - W:
        x = (f - (f1 - W)) / W
        d = 260.0 / cam[2] * x ** 2.4
        cam = (cam[0] + s['whip_out'][0] * d, cam[1] + s['whip_out'][1] * d, cam[2])
    if s['whip_in'] and f < f0 + W:
        x = 1 - (f - f0) / W
        d = 260.0 / cam[2] * x ** 2.4
        cam = (cam[0] - s['whip_in'][0] * d, cam[1] - s['whip_in'][1] * d, cam[2])
    return cam


def in_whip(s, f):
    f0, f1 = fr(s['t0']), fr(s['t1'])
    return (s['whip_out'] and f > f1 - 7) or (s['whip_in'] and f < f0 + 7)


# --------------------------------------------------------------- renderer ----
_F = None


def _init(feel, ss):
    global _F
    sys.path.insert(0, HERE)
    import film
    from wonders.feels import get
    from wonders.render import Renderer
    w = film.setup(ss=ss)
    F = get(feel)(w)
    F.R = film._R
    film._R.feel = F
    F.RB = Renderer(w, size=SIZE, ss=1, grain=False)
    F.RB.feel = F
    _F = F


def _render(job):
    k, f = job
    s = SHOTS[k]
    if in_whip(s, f):
        acc = np.zeros((SIZE[1], SIZE[0], 3), np.float32)
        n = 5
        for j in range(n):
            ff = f + (j + 0.5) / n * 0.9 - 0.45
            acc += _F.R.frame(build_clock(s, ff), camera(s, ff), life_clock(s, ff)).astype(np.float32)
        img = (acc / n + 0.5).astype(np.uint8)
    else:
        img = _F.R.frame(build_clock(s, f), camera(s, f), life_clock(s, f))
    return k, f, np.ascontiguousarray(img).tobytes()


def _enc(path, crf=10, preset='veryfast'):
    return subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                             '-s', '%dx%d' % SIZE, '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', preset,
                             '-crf', str(crf), '-pix_fmt', 'yuv444p', path], stdin=subprocess.PIPE)


def cmd_render(a):
    d = os.path.join(OUT, 'shots')
    os.makedirs(d, exist_ok=True)
    only = set(a.shots) if a.shots else None
    t0 = time.time()
    for feel in ('current', 'tide', 'popup'):
        ks = [k for k, s in enumerate(SHOTS) if s['feel'] == feel and (only is None or k in only)]
        if not ks:
            continue
        with Pool(a.jobs, initializer=_init, initargs=(feel, 2)) as pool:
            for k in ks:
                f0, f1, tail = shot_frames(k)
                ff = _enc(os.path.join(d, '%02d.mp4' % k))
                for _, f, buf in pool.imap(_render, [(k, f) for f in range(f0, f1 + tail)], chunksize=1):
                    ff.stdin.write(buf)
                ff.stdin.close()
                ff.wait()
                print('shot %02d %-8s %4d frames  %.0fs  %s' % (k, feel, f1 + tail - f0, time.time() - t0, SHOTS[k]['note']), flush=True)


def _preview_job(job):
    k, f = job
    s = SHOTS[k]
    img = _F.R.frame(build_clock(s, f), camera(s, f), life_clock(s, f))
    import cv2
    return k, f, cv2.resize(img, (480, 270), interpolation=cv2.INTER_AREA)


def cmd_preview(a):
    import cv2
    os.makedirs(OUT, exist_ok=True)
    tiles = {}
    for feel in ('current', 'tide', 'popup'):
        jobs = []
        for k, s in enumerate(SHOTS):
            if s['feel'] != feel or (a.shots and k not in a.shots):
                continue
            f0, f1, _ = shot_frames(k)
            jobs += [(k, f0), (k, (f0 + f1) // 2), (k, f1 - 1)]
        if not jobs:
            continue
        with Pool(a.jobs, initializer=_init, initargs=(feel, 1)) as pool:
            for k, f, img in pool.imap(_preview_job, jobs):
                tiles[(k, f)] = img
    rows = []
    for k, s in enumerate(SHOTS):
        if a.shots and k not in a.shots:
            continue
        fs = sorted(f for (kk, f) in tiles if kk == k)
        row = np.hstack([tiles[(k, f)] for f in fs])
        lab = np.full((270, 300, 3), 245, np.uint8)
        cv2.putText(lab, '%02d %s' % (k, s['feel']), (8, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (30, 30, 30), 2)
        cv2.putText(lab, '%.2f-%.2fs' % (s['t0'], s['t1']), (8, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (30, 30, 30), 1)
        words = s['note'].split()
        line, y = '', 120
        for w_ in words:
            if len(line) + len(w_) > 24:
                cv2.putText(lab, line, (8, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (60, 60, 60), 1)
                line, y = '', y + 24
            line += w_ + ' '
        cv2.putText(lab, line, (8, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (60, 60, 60), 1)
        rows.append(np.hstack([lab, row]))
    out = os.path.join(OUT, a.name)
    cv2.imwrite(out, cv2.cvtColor(np.vstack(rows), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(out)


# --------------------------------------------------------------- assemble ----
def _reader(path):
    p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         stdout=subprocess.PIPE)
    n = SIZE[0] * SIZE[1] * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(SIZE[1], SIZE[0], 3)
    p.wait()


def cmd_assemble(a):
    sys.path.insert(0, HERE)
    from wonders.feels.popup import page_turn
    from wonders.feels.tide import ripple_dissolve
    from wonders.pal import PAPER
    d = os.path.join(OUT, 'shots')
    out = os.path.join(os.path.dirname(OUT), 'wonders_montage.mp4')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % SIZE,
           '-r', str(FPS), '-i', '-', '-i', WAV, '-t', '%.4f' % (TOTAL / FPS),
           '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15',
           '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
           '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    paper = np.array(PAPER, np.float32)
    carry = []          # the previous shot's tail frames, for a transition into this one
    n = 0
    for k, s in enumerate(SHOTS):
        f0, f1, tail = shot_frames(k)
        frames = _reader(os.path.join(d, '%02d.mp4' % k))
        for i, img in enumerate(frames):
            f = f0 + i
            if f >= f1:
                carry.append(img)
                continue
            if s['tin'] and i < len(carry):
                A = carry[i]
                m = len(carry)
                if s['tin'] == 'page':
                    img = page_turn(A, img, (i + 0.5) / m)
                else:
                    img = ripple_dissolve(A, img, (i + 0.5) / m, f)
            # the last second and a half dissolves into the paper
            fade0 = TOTAL - 45
            if f >= fade0:
                x = (f - fade0) / 45.0
                x = x * x * (3 - 2 * x)
                img = (img.astype(np.float32) * (1 - x) + paper * x + 0.5).astype(np.uint8)
            ff.stdin.write(np.ascontiguousarray(img).tobytes())
            n += 1
        if s['tin']:
            pass
        carry = [] if not tail else carry[-tail:]
    ff.stdin.close()
    ff.wait()
    print('wrote', out, n, 'frames')
    share = out.replace('.mp4', '_share.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', out, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
                    '-x264-params', 'rc-lookahead=20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', share], check=True)
    print('wrote', share, '%.1f MB' % (os.path.getsize(share) / 1e6))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('preview'); p.add_argument('-j', '--jobs', type=int, default=4); p.add_argument('--shots', type=int, nargs='*')
    p.add_argument('--name', default='preview.jpg')
    r = sub.add_parser('render'); r.add_argument('-j', '--jobs', type=int, default=4); r.add_argument('--shots', type=int, nargs='*')
    sub.add_parser('assemble')
    a = ap.parse_args()
    {'preview': cmd_preview, 'render': cmd_render, 'assemble': cmd_assemble}[a.cmd](a)
