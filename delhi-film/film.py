"""Timeline, camera and frame renderer for 'Dilli, Inlaid'.
usage:
  python3 film.py still  <frame> [scale] [out.png]
  python3 film.py chunk  <index>            # render frames of chunk -> chunks/cNNN.mp4 (resumable)
  python3 film.py all                       # all missing chunks (use several processes via build.sh)
"""
import math
import os
import subprocess
import sys
import numpy as np
import cv2

from scene import WW, WH
import engine
from engine import Renderer, F_END
import city
import life

FPS = 30
BAR = 80                      # frames per bar at 90 BPM
F_HOLD = 2 * BAR              # 160
F_TOUR = 3 * BAR              # 240
SHOTS = [                     # (start frame, cx, cy, zoom, drift dx, dy, dz, name)
    (240, 792, 252, 2.16, 26, 0, .08, 'Old Delhi: Jama Masjid & Chandni Chowk'),
    (320, 1330, 250, 2.28, 22, 0, .08, 'Red Fort'),
    (400, 1016, 560, 2.48, -14, -6, .10, 'India Gate'),
    (480, 512, 500, 2.26, -24, 0, .08, 'Connaught Place'),
    (560, 452, 838, 2.18, 26, 0, .08, 'Qutub Minar'),
    (640, 1286, 838, 2.18, 24, 0, .08, 'Humayun & Lotus'),
]
F_OUT = 720                   # ending begins
GLIDE = 11
CHUNK = 40
WIDE0 = (960., 540., 1.14)
WIDE1 = (960., 540., 1.0)


def smooth(t):
    t = min(1., max(0., t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = min(1., max(0., t))
    return t * t * t * (t * (6 * t - 15) + 10)


def clamp_cam(c):
    cx, cy, z = c
    z = max(z, 1.0)
    hx, hy = WW / (2 * z), WH / (2 * z)
    return (min(max(cx, hx), WW - hx), min(max(cy, hy), WH - hy), z)


def mix(a, b, e, hop=0.):
    z = math.exp(math.log(a[2]) * (1 - e) + math.log(b[2]) * e) * (1 - hop * math.sin(math.pi * e))
    return (a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, z)


def shot_pose(i, f):
    s0, cx, cy, z, dx, dy, dz, _ = SHOTS[i]
    t = (f - s0) / BAR
    e = t - .5
    return (cx + dx * e, cy + dy * e, z * (1 + dz * (t - .0)))


def camera(f):
    f = float(f)
    if f < F_HOLD:
        return mix(WIDE0, WIDE1, smoother(f / F_HOLD))
    if f < F_TOUR:
        t = (f - F_HOLD) / BAR
        base = (960., 540., 1.0 + .035 * t)
        if f > F_TOUR - GLIDE:
            return clamp_cam(mix(base, shot_pose(0, F_TOUR), smoother((f - (F_TOUR - GLIDE)) / GLIDE), hop=.0))
        return base
    if f < F_OUT - 4:
        i = min(len(SHOTS) - 1, int((f - F_TOUR) // BAR))
        p = shot_pose(i, f)
        nxt = SHOTS[i + 1][0] if i + 1 < len(SHOTS) else None
        if nxt is not None and f > nxt - GLIDE:
            e = smoother((f - (nxt - GLIDE)) / GLIDE)
            p = mix(p, shot_pose(i + 1, nxt), e, hop=.16)
        return clamp_cam(p)
    # ending: pull back, then drift in to the opening framing
    a = shot_pose(len(SHOTS) - 1, F_OUT - 4)
    if f < 762:
        return clamp_cam(mix(a, WIDE1, smoother((f - (F_OUT - 4)) / (762 - (F_OUT - 4)))))
    return mix(WIDE1, WIDE0, smoother((f - 762) / (F_END - 762)))


def sweep_for(f):
    """raking light band: crosses the screen once per bar, strongest on the hold."""
    t = (f % BAR) / BAR
    amp = .55
    if F_HOLD <= f < F_TOUR:
        amp = 1.25
    elif f < F_HOLD:
        amp = .35 + .3 * f / F_HOLD
    elif f >= 762:
        amp = .55 * (1 - smooth((f - 762) / 60)) + .2
    return (-.25 + 1.7 * t, amp, .32)


_R = {}
SS = int(os.environ.get('SS', '1'))     # geometry supersampling factor (2 for the final render)


def get_renderer(scale=1.0):
    if scale not in _R:
        sc = city.build_city().finalize()
        life.attach(sc)
        _R[scale] = Renderer(sc, int(1920 * scale), int(1080 * scale))
    return _R[scale]


def render_frame(f, scale=1.0, blur=True):
    R = get_renderer(scale * SS)
    cam = camera(f)
    items, steam = life.life(f, cam)
    glow = .0
    if F_HOLD - 6 <= f < F_HOLD + 40:
        glow = .5 * math.exp(-max(0, f - F_HOLD) / 14.) * smooth((f - (F_HOLD - 6)) / 6)
    for s in SHOTS:
        if s[0] <= f < s[0] + 20:
            glow = max(glow, .22 * math.exp(-(f - s[0]) / 7.))
    out = R.render(f, cam, items, steam, sweep_for(f), glow)
    OW, OH = int(1920 * scale), int(1080 * scale)
    if SS > 1:
        out = cv2.resize(out, (OW, OH), interpolation=cv2.INTER_AREA)
    opx = OW / 1920.
    if blur:
        c0, c1 = camera(f - .3), camera(f + .3)
        z = cam[2] * opx
        d = math.hypot((c1[0] - c0[0]) * z, (c1[1] - c0[1]) * z) + abs(math.log(c1[2] / c0[2])) * OW * .5
        if d > 3.:
            n = int(min(48, max(6, d / 2.5)))
            acc = np.zeros_like(out)
            for k in range(n):
                tau = -.3 + .6 * (k + .5) / n
                cs = camera(f + tau)
                # frame at camera cs expressed as warp of frame at camera cam
                sc_ = cs[2] / cam[2]
                tx = OW / 2 - sc_ * OW / 2 + (cam[0] - cs[0]) * cs[2] * opx
                ty = OH / 2 - sc_ * OH / 2 + (cam[1] - cs[1]) * cs[2] * opx
                M = np.float32([[sc_, 0, tx], [0, sc_, ty]])
                acc += cv2.warpAffine(out, M, (OW, OH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            out = acc / n
    return R.finish(out, f)


CHUNKDIR = os.environ.get('CHUNKDIR', 'chunks')
SCALE = float(os.environ.get('SCALE', '1'))


def chunk_path(i):
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), CHUNKDIR, 'c%03d.mp4' % i)


def render_chunk(i, scale=None):
    scale = scale or SCALE
    out = chunk_path(i)
    if os.path.exists(out):
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + '.part.mp4'
    W, H = int(1920 * scale), int(1080 * scale)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-threads', '2',
           '-x264-params', 'keyint=40:min-keyint=40:scenecut=0', tmp]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(i * CHUNK, min(F_END, (i + 1) * CHUNK)):
        p.stdin.write(render_frame(f, scale).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit('ffmpeg failed on chunk %d' % i)
    os.replace(tmp, out)
    print('chunk', i, 'done', flush=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'still':
        f = float(sys.argv[2])
        scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
        out = sys.argv[4] if len(sys.argv) > 4 else 'stills/f%04d.png' % int(f)
        os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
        cv2.imwrite(out, render_frame(f, scale))
    elif mode == 'chunk':
        for a in sys.argv[2:]:
            render_chunk(int(a))
    elif mode == 'all':
        n = (F_END + CHUNK - 1) // CHUNK
        k, m = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (0, 1)
        for i in range(n):
            if i % m == k:
                render_chunk(i)
