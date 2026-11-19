#!/usr/bin/env python3
"""Wonders of the World - opening 5 seconds.

  film.py film  [-o out/wonders_5s.mp4]        render all frames -> ffmpeg
  film.py still T [T ...] [--zoom Z --at X,Y]  full-res stills at given times
  film.py sheet                                contact sheet of the 5 s
  film.py tile NAME [--t T] [--zoom Z]         debug: one tile, finished (or at tile-time T)
"""
import argparse
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


def _init():
    setup()


def _frame(n):
    t = n / _TL.fps
    return n, _R.frame(t, _TL.camera(t)).tobytes()


def save_png(path, img):
    import cv2
    cv2.imwrite(path, img[:, :, ::-1])


def cmd_film(a):
    n = int(round(5.0 * 30))
    out = a.out or os.path.join(OUT, 'wonders_5s.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % SIZE,
                           '-r', '30', '-i', '-', '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '13',
                           '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                           '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    t0 = time.time()
    frames_dir = os.path.join(OUT, 'frames')
    os.makedirs(frames_dir, exist_ok=True)
    with Pool(a.jobs, initializer=_init) as pool:
        for k, buf in pool.imap(_frame, range(n), chunksize=2):
            ff.stdin.write(buf)
            if a.keep:
                save_png(os.path.join(frames_dir, 'f%03d.png' % k), np.frombuffer(buf, np.uint8).reshape(SIZE[1], SIZE[0], 3))
            if k % 15 == 0:
                print('frame %3d/%d  %.1fs' % (k, n, time.time() - t0), flush=True)
    ff.stdin.close()
    ff.wait()
    print('wrote', out, '%.1fs' % (time.time() - t0))


def cmd_still(a):
    # paper grain is generated at a resolution that suits the zoom of the shot
    setup(tpx=max(2.6, (a.zoom or 0) * 1.1))
    for t in a.times:
        cam = _TL.camera(t)
        if a.zoom:
            cam = (cam[0], cam[1], a.zoom)
        if a.at:
            x, y = map(float, a.at.split(','))
            cam = (x, y, cam[2])
        img = _R.frame(t, cam)
        p = os.path.join(OUT, a.name % t if a.name else 'still_%05.2fs.png' % t)
        save_png(p, img)
        print(p)


def cmd_sheet(a):
    import cv2
    setup(ss=1, size=SIZE)
    times = [k * (5.0 / 30) for k in range(29)] + [149 / 30.0]
    cols, rows = 6, 5
    tw, th = 640, 360
    sheet = np.zeros((rows * th, cols * tw, 3), np.uint8)
    for k, t in enumerate(times):
        img = _R.frame(t, _TL.camera(t))
        im = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
        cv2.putText(im, '%.2fs' % t, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (60, 55, 50), 2, cv2.LINE_AA)
        r, c = divmod(k, cols)
        sheet[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = im
    p = os.path.join(OUT, 'contact_sheet.jpg')
    cv2.imwrite(p, sheet[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(p)


def cmd_tile(a):
    names = a.name.split(',')
    w = setup(only=names, starts={n: (-10.0 if a.t is None else 0.0) for n in names}, tpx=max(2.6, (a.zoom or 5) * 1.1))
    x0, y0, x1, y1 = w.bounds()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    z = a.zoom or min(SIZE[0] / (x1 - x0 + 24), SIZE[1] / (y1 - y0 + 24))
    for t in ([None] if a.t is None else a.t):
        img = _R.frame(0.0 if t is None else t, (cx, cy, z))
        p = os.path.join(OUT, 'tile_%s%s.png' % (names[0], '' if t is None else '_%.2f' % t))
        save_png(p, img)
        print(p, len(sum([list(tt.shapes) for tt in w.tiles.values()], [])), 'shapes')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd')
    f = sub.add_parser('film'); f.add_argument('-o', '--out'); f.add_argument('-j', '--jobs', type=int, default=4); f.add_argument('--keep', action='store_true')
    s = sub.add_parser('still'); s.add_argument('times', type=float, nargs='+'); s.add_argument('--zoom', type=float); s.add_argument('--at'); s.add_argument('--name')
    sub.add_parser('sheet')
    t = sub.add_parser('tile'); t.add_argument('name'); t.add_argument('--t', type=float, nargs='*'); t.add_argument('--zoom', type=float)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    {'film': cmd_film, 'still': cmd_still, 'sheet': cmd_sheet, 'tile': cmd_tile}[a.cmd](a)
