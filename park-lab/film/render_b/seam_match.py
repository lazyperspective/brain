#!/usr/bin/env python3
"""Loop-seam colour match for shot 16 (polish pass).

Shot 16 ends on the same closed ticket, from the same camera pose, as shot 01's first frame, but the two renderers
light and grade the table differently. This fits a colour transform from 16's LOOP frame (frame 126, t = 44.0) to
01's LOOP frame (frame 6, t = 0.0) by exact pixel correspondence (the framing is identical), then applies it to
16 with a weight that ramps 0 -> 1 over t = 43.5 .. 44.0 (frames 111..126) and stays at 1 for the handles.

Transform: per output channel, a least-squares fit on [1, r, g, b, r^2, g^2, b^2, rg, rb, gb] x [1, x, y, x^2, y^2, xy]
(colour terms times smooth screen-position terms, so vignette / lamp-glare differences are absorbed).

usage: python3 seam_match.py in16.mp4 shot01.mp4 out16.mp4
"""
import subprocess, sys
import numpy as np

W, H, FPS = 1920, 1080, 30
T_START = 39.8
RAMP0, RAMP1 = 43.5, 44.0


def read_frame(path, idx):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'select=eq(n\\,{idx})', '-frames:v', '1',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0


def features(img, step=1, row0=0, full_h=None):
    im = img[::step, ::step]
    h, w = im.shape[:2]
    full_h = full_h or h
    y, x = np.mgrid[row0:row0 + h, 0:w].astype(np.float32)
    x = x / (w - 1) * 2 - 1; y = y / (full_h - 1) * 2 - 1
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    col = [np.ones_like(r), r, g, b, r * r, g * g, b * b, r * g, r * b, g * b]
    sp = [np.ones_like(x), x, y, x * x, y * y, x * y]
    return np.stack([c * s for c in col for s in sp], -1).reshape(-1, len(col) * len(sp))


def apply(img, coef, rows=120):
    out = np.empty_like(img)
    for r0 in range(0, H, rows):
        out[r0:r0 + rows] = np.clip(features(img[r0:r0 + rows], 1, r0, H) @ coef, 0, 1).reshape(-1, W, 3)
    return out


def main():
    src, ref, dst = sys.argv[1:4]
    a = read_frame(src, 126)            # 16 @ t = 44.0
    b = read_frame(ref, 6)              # 01 @ t = 0.0
    F = features(a, 3); Y = b[::3, ::3].reshape(-1, 3)
    coef, *_ = np.linalg.lstsq(F, Y, rcond=None)
    pred = apply(a, coef)
    print('seam mean abs diff before %.4f after %.4f (0..1 scale)' % (np.abs(a - b).mean(), np.abs(pred - b).mean()))
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-framerate', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-threads', '2',
                            '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    n = 0
    while True:
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        t = T_START + n / FPS
        u = min(1.0, max(0.0, (t - RAMP0) / (RAMP1 - RAMP0)))
        wgt = u * u * (3 - 2 * u)
        if wgt > 0:
            img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0
            m = apply(img, coef)
            img = img * (1 - wgt) + m * wgt
            buf = (img * 255 + 0.5).astype(np.uint8).tobytes()
        enc.stdin.write(buf); n += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    print('wrote', dst, n, 'frames')


if __name__ == '__main__':
    main()
