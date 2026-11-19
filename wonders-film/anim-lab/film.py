#!/usr/bin/env python3
"""Wonders of the World - the film.  (anim-lab copy: adds `clip --feel NAME`, `stills`, `strips`)

  film.py clip --feel NAME          the 10.8 s comparison clip for one animation feel -> out/feel_<n>_<name>.mp4
  film.py stills --feel NAME --frames F [F ...]   full-res review frames -> out/review/<name>/
  film.py strips                    out/feels_strips.jpg: one labelled row of 8 frames per feel clip

  film.py film                      render every frame -> out/wonders_full_1080p.mp4 (+ soundtrack if present)
  film.py film --frames 0 150 -o out/wonders_5s.mp4     any frame range
  film.py share                     out/wonders_full_share.mp4 from the master
  film.py still T [T ...] [--zoom Z --at=X,Y]            full-res stills at given times (film camera by default)
  film.py shots                     one full-res still from the middle of every shot
  film.py sheet                     contact sheet: the build sequence + one tile per shot
  film.py tile NAME [--t T]         debug: one tile, finished (or at tile-time T)
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
OUT = os.path.join(HERE, 'out')
SIZE = (1920, 1080)

_R = None
_TL = None


def setup(only=None, ss=2, starts=None, size=SIZE, tpx=2.6):
    global _R, _TL
    from wonders.world import build_world
    from wonders.timeline import Timeline
    from wonders.render import Renderer
    w = build_world(only)
    _TL = Timeline(starts)
    _TL.apply(w)
    _R = Renderer(w, size=size, ss=ss, tpx=tpx)
    return w


_RB = None          # a second, un-supersampled renderer for the sub-frames of motion blur
BLUR_N = 5          # sub-frame renders averaged per frame while the camera is in flight
SHUTTER = 0.62      # fraction of the frame interval the "shutter" stays open


def _init():
    setup()


def blurred(n):
    """A frame in fast flight: average BLUR_N sub-frame renders across the shutter, each smeared along
    the camera's travel by exactly the gap to the next sub-frame, so the blur is continuous."""
    global _RB
    import cv2
    from wonders import timeline as TL
    from wonders.render import Renderer
    if _RB is None:
        _RB = Renderer(_R.world, size=SIZE, ss=1, grain=False)
    acc = np.zeros((SIZE[1], SIZE[0], 3), np.float32)
    step = SHUTTER / BLUR_N
    w, h = SIZE
    WARPS = 4
    for j in range(BLUR_N):
        f = n + (j + 0.5) * step - SHUTTER / 2
        cj = TL.camera_at(f)
        img = _RB.frame(f / TL.FPS, cj)
        # between renders, the picture is re-projected to four more instants (pan AND zoom), so the
        # smear is continuous right out to the corners of the frame
        for m in range(WARPS):
            fm = f + ((m + 0.5) / WARPS - 0.5) * step
            cm = TL.camera_at(fm)
            sc = cm[2] / cj[2]
            M = np.array([[sc, 0, w / 2 * (1 - sc) + (cj[0] - cm[0]) * cm[2]], [0, sc, h / 2 * (1 - sc) + (cj[1] - cm[1]) * cm[2]]], np.float32)
            acc += cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    img = np.clip(acc / (BLUR_N * WARPS) + 0.5, 0, 255).astype(np.uint8)
    cam = TL.camera_at(n)
    _R.set_grain(cam[2])
    return np.ascontiguousarray(_R.paper.apply(img, cam, SIZE))


def render_frame(n):
    from wonders import timeline as TL
    if TL.is_move(n):
        return blurred(n)
    return _R.frame(n / TL.FPS, TL.camera_at(n))


def _frame(n):
    return n, render_frame(n).tobytes()


def save_png(path, img):
    import cv2
    cv2.imwrite(path, img[:, :, ::-1])


_F = None
WAV = os.path.join(os.path.dirname(HERE), 'out', 'soundtrack.wav')      # the main film's soundtrack (read only)


def setup_feel(name):
    global _F
    from wonders.feels import get
    from wonders.render import Renderer
    w = setup()
    F = get(name)(w)
    F.R = _R
    _R.feel = F
    F.RB = Renderer(w, size=SIZE, ss=1, grain=False)
    F.RB.feel = F
    _F = F
    return F


def _init_feel(name):
    setup_feel(name)


def _feel_frame(n):
    return n, _F.render(n).tobytes()


def _feel_png(args):
    n, d = args
    p = os.path.join(d, 'f%04d.png' % n)
    save_png(p, _F.render(n))
    return p


def cmd_clip(a):
    from wonders.feels import get, number
    from wonders.feels import base as B
    cls = get(a.feel)
    name = cls.name
    f0, f1 = a.frames if a.frames else (0, B.END)
    out = a.out or os.path.join(OUT, 'feel_%d_%s.mp4' % (number(name), name))
    dur = (f1 - f0) / 30.0
    audio = os.path.exists(WAV) and not a.silent and not getattr(cls, 'silent', False)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % SIZE, '-r', '30', '-i', '-']
    if audio:
        cmd += ['-ss', '%.4f' % (B.AUDIO_OFFSET + f0 / 30.0), '-t', '%.4f' % dur, '-i', WAV]
    cmd += ['-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf),
            '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-g', '60']
    if f0 < B.CUT < f1:
        cmd += ['-force_key_frames', '%.5f' % ((B.CUT - f0) / 30.0)]
    if audio:
        cmd += ['-af', 'afade=t=in:d=0.35,afade=t=out:st=%.3f:d=0.6' % max(0.0, dur - 0.6), '-c:a', 'aac', '-b:a', '192k', '-shortest']
    cmd += ['-movflags', '+faststart', out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(a.jobs, initializer=_init_feel, initargs=(a.feel,)) as pool:
        for k, buf in pool.imap(_feel_frame, range(f0, f1), chunksize=1):
            ff.stdin.write(buf)
            if (k - f0) % 50 == 0:
                print('%s frame %4d/%d  %.0fs' % (name, k, f1, time.time() - t0), flush=True)
    ff.stdin.close()
    ff.wait()
    print('wrote', out, '%.0fs' % (time.time() - t0), flush=True)


def cmd_stills(a):
    from wonders.feels import get
    name = get(a.feel).name
    d = os.path.join(OUT, 'review', name)
    os.makedirs(d, exist_ok=True)
    if a.jobs > 1 and len(a.frames) > 1:
        with Pool(a.jobs, initializer=_init_feel, initargs=(a.feel,)) as pool:
            for p in pool.imap(_feel_png, [(n, d) for n in a.frames]):
                print(p, flush=True)
    else:
        setup_feel(a.feel)
        for n in a.frames:
            print(_feel_png((n, d)), flush=True)


def cmd_strips(a):
    """one row per feel clip, 8 frames across, labelled"""
    import cv2
    import glob
    from wonders.feels import base as B
    clips = sorted(glob.glob(os.path.join(OUT, 'feel_*.mp4')), key=lambda p: int(os.path.basename(p).split('_')[1]))
    # build x4, the finished map, mid-transition, the close-up before and during the balloon's lift
    picks = [15, 50, 95, 140, 190, 218, 250, 300]
    from wonders.feels import get
    tw, th = 480, 270
    lab = 300
    rows = []
    for p in clips:
        cap = cv2.VideoCapture(p)
        frames = {}
        k = 0
        while True:
            ok, im = cap.read()
            if not ok:
                break
            if k in picks:
                frames[k] = cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)
            k += 1
        row = np.full((th, lab + tw * len(picks), 3), (224, 236, 241), np.uint8)
        nm = os.path.basename(p)[:-4]
        parts = nm.split('_', 2)
        try:
            title = get(parts[2]).title if parts[2] != 'current' else 'Current (baseline)'
        except SystemExit:
            title = parts[2]
        cv2.putText(row, 'feel %s  %s' % (parts[1], parts[2]), (16, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (40, 45, 50), 2, cv2.LINE_AA)
        words = title.split()
        lines, cur = [], ''
        for wd in words:
            if len(cur) + len(wd) > 16:
                lines.append(cur)
                cur = wd
            else:
                cur = (cur + ' ' + wd).strip()
        lines.append(cur)
        for i, ln in enumerate(lines):
            cv2.putText(row, ln, (16, 120 + 40 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (30, 110, 200), 2, cv2.LINE_AA)
        for i, n in enumerate(picks):
            if n in frames:
                im = frames[n]
                cv2.rectangle(im, (0, th - 30), (92, th), (241, 236, 224), -1)
                cv2.putText(im, '%.1fs' % (n / 30.0), (8, th - 9), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (50, 45, 40), 2, cv2.LINE_AA)
                row[:, lab + i * tw: lab + (i + 1) * tw] = im
        rows.append(row)
        rows.append(np.full((6, row.shape[1], 3), 200, np.uint8))
    sheet = np.vstack(rows[:-1])
    out = os.path.join(OUT, 'feels_strips.jpg')
    cv2.imwrite(out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(out, sheet.shape)


def cmd_film(a):
    from wonders import timeline as TL
    f0, f1 = a.frames if a.frames else (0, TL.TOTAL_FRAMES)
    out = a.out or os.path.join(OUT, 'wonders_full_1080p.mp4')
    wav = os.path.join(OUT, 'soundtrack.wav')
    audio = (not a.frames) and os.path.exists(wav) and not a.silent
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % SIZE, '-r', '30', '-i', '-']
    if audio:
        cmd += ['-i', wav]
    # ONE x264 encoder; the renderer's four workers feed it in order
    cmd += ['-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf),
            '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-g', '50']
    # a keyframe as each swoop lands
    cuts = [c for c in TL.CUTS if f0 < c < f1]
    if cuts:
        cmd += ['-force_key_frames', ','.join('%.5f' % ((c - f0) / 30.0) for c in cuts)]
    if audio:
        cmd += ['-c:a', 'aac', '-b:a', '256k', '-shortest']
    cmd += ['-movflags', '+faststart', out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(a.jobs, initializer=_init) as pool:
        for k, buf in pool.imap(_frame, range(f0, f1), chunksize=2):
            ff.stdin.write(buf)
            if (k - f0) % 100 == 0:
                print('frame %4d/%d  %.0fs' % (k, f1, time.time() - t0), flush=True)
    ff.stdin.close()
    ff.wait()
    print('wrote', out, '%.0fs' % (time.time() - t0))


def cmd_share(a):
    src = os.path.join(OUT, 'wonders_full_1080p.mp4')
    out = os.path.join(OUT, 'wonders_full_share.mp4')
    subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p',
                           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                           '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out])
    print('wrote', out, '%.1f MB' % (os.path.getsize(out) / 1e6))


def cmd_still(a):
    if a.original_palette:
        from wonders import pal
        pal.VIVID = 1.0
        pal.ACCENT, pal.ACCENT_D, pal.ACCENT_L = (243, 158, 30), (214, 126, 22), (250, 198, 104)
    setup()
    for t in a.times:
        cam = _TL.camera(t)
        if a.zoom:
            cam = (cam[0], cam[1], a.zoom)
        if a.at:
            x, y = map(float, a.at.split(','))
            cam = (x, y, cam[2])
        img = _R.frame(t, cam) if (a.zoom or a.at) else render_frame(int(round(t * 30)))
        p = os.path.join(OUT, (a.name % t if '%' in a.name else a.name) if a.name else 'still_%05.2fs.png' % t)
        save_png(p, img)
        print(p)


def _shot_times():
    from wonders import timeline as TL
    out = [('00_build_hold', (TL.CUTS[0] - 50) / 30.0)]
    for k, (name, _, _) in enumerate(TL.SHOTS):
        out.append(('%02d_%s' % (k + 1, name), (TL.CUTS[k] + TL.EV_FRAME + 6) / 30.0))       # just after the shot's event peaks
    out.append(('%02d_final_wide' % (len(TL.SHOTS) + 1), (TL.CUTS[-1] + 75) / 30.0))
    return out


def cmd_shots(a):
    setup()
    os.makedirs(os.path.join(OUT, 'shots'), exist_ok=True)
    for name, t in _shot_times():
        p = os.path.join(OUT, 'shots', 'shot_%s_%05.2fs.png' % (name, t))
        save_png(p, render_frame(int(round(t * 30))))
        print(p)
    for t in (0.5, 1.5, 2.5):
        p = os.path.join(OUT, 'build_%.1fs.png' % t)
        save_png(p, render_frame(int(round(t * 30))))
        print(p)


def cmd_sheet(a):
    import cv2
    from wonders import timeline as TL
    setup()
    cols = 6
    tw, th = 640, 360
    build = [k * (4.5 / 11) for k in range(12)]
    trans = [('swoop into shot %d, mid-flight' % (k + 1), (TL.CUTS[k] - TL.MOVE // 2) / 30.0) for k in (1, 5, 9)]
    tiles = [('build %.2fs' % t, t) for t in build] + [('%s  %.1fs' % (n, t), t) for n, t in _shot_times()] + trans
    rows = (len(tiles) + cols - 1) // cols
    sheet = np.full((rows * th, cols * tw, 3), 236, np.uint8)
    for k, (label, t) in enumerate(tiles):
        img = render_frame(int(round(t * 30)))
        im = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
        cv2.rectangle(im, (0, 0), (len(label) * 13 + 16, 34), (241, 236, 224), -1)
        cv2.putText(im, label, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (50, 45, 40), 2, cv2.LINE_AA)
        r, c = divmod(k, cols)
        sheet[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = im
    p = os.path.join(OUT, 'contact_sheet.jpg')
    cv2.imwrite(p, sheet[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(p)


def cmd_tile(a):
    names = a.name.split(',')
    w = setup(only=names, starts={n: (-10.0 if a.t is None else 0.0) for n in names}, tpx=5.8)
    x0, y0, x1, y1 = w.bounds()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    z = a.zoom or min(SIZE[0] / (x1 - x0 + 24), SIZE[1] / (y1 - y0 + 24))
    for t in ([None] if a.t is None else a.t):
        img = _R.frame(0.0 if t is None else t, (cx, cy, z))
        p = os.path.join(OUT, 'tile_%s%s.png' % (names[0], '' if t is None else '_%.2f' % t))
        save_png(p, img)
        print(p)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd')
    f = sub.add_parser('film'); f.add_argument('-o', '--out'); f.add_argument('-j', '--jobs', type=int, default=4)
    f.add_argument('--frames', type=int, nargs=2); f.add_argument('--crf', type=int, default=15); f.add_argument('--silent', action='store_true')
    sub.add_parser('share')
    cl = sub.add_parser('clip'); cl.add_argument('--feel', required=True); cl.add_argument('-o', '--out'); cl.add_argument('-j', '--jobs', type=int, default=2)
    cl.add_argument('--frames', type=int, nargs=2); cl.add_argument('--crf', type=int, default=20); cl.add_argument('--silent', action='store_true')
    stl = sub.add_parser('stills'); stl.add_argument('--feel', required=True); stl.add_argument('--frames', type=int, nargs='+', required=True)
    stl.add_argument('-j', '--jobs', type=int, default=1)
    sub.add_parser('strips')
    s = sub.add_parser('still'); s.add_argument('times', type=float, nargs='+'); s.add_argument('--zoom', type=float); s.add_argument('--at'); s.add_argument('--name')
    s.add_argument('--original-palette', action='store_true', help='render with the muted palette of the first 5 s test (for before/after)')
    sub.add_parser('shots')
    sub.add_parser('sheet')
    t = sub.add_parser('tile'); t.add_argument('name'); t.add_argument('--t', type=float, nargs='*'); t.add_argument('--zoom', type=float)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    {'clip': cmd_clip, 'stills': cmd_stills, 'strips': cmd_strips, 'film': cmd_film, 'share': cmd_share, 'still': cmd_still, 'shots': cmd_shots, 'sheet': cmd_sheet, 'tile': cmd_tile}[a.cmd](a)
