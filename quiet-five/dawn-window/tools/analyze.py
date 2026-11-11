#!/usr/bin/env python3
"""Post-render checks for Dawn, a Window: contact sheet, seam strip, crops, verification numbers.
usage: python3 -I analyze.py <outdir> [raw frames file]
expects <outdir>/loop-4x5.mp4, <outdir>/loop-4x5.mp4.raw (exact rgb24 frames), <outdir>/still-4k.png
"""
import sys, os, subprocess, json
import numpy as np
from PIL import Image

out = sys.argv[1]
W, H, N = 1080, 1350, 300
rawp = sys.argv[2] if len(sys.argv) > 2 else os.path.join(out, 'loop-4x5.mp4.raw')
raw = np.memmap(rawp, dtype=np.uint8, mode='r', shape=(N, H, W, 3))

def frame(i):
    return np.asarray(raw[i % N])

# ---- contact sheet: 12 evenly spaced frames ----
idx = [round(k * N / 12) for k in range(12)]
tw, th = 360, 450
sheet = Image.new('RGB', (tw * 4 + 5 * 12, th * 3 + 4 * 12), (12, 12, 16))
for k, i in enumerate(idx):
    im = Image.fromarray(frame(i)).resize((tw, th), Image.LANCZOS)
    sheet.paste(im, (12 + (k % 4) * (tw + 12), 12 + (k // 4) * (th + 12)))
sheet.save(os.path.join(out, 'contact-sheet.png'))

# ---- seam: last 3 + first 3 frames, side by side (half size), plus a 100% strip of the moving curtain ----
seq = [N - 3, N - 2, N - 1, 0, 1, 2]
sw, sh = 540, 675
seam = Image.new('RGB', (sw * 6 + 7 * 6, sh + 12 + 400), (12, 12, 16))
for k, i in enumerate(seq):
    seam.paste(Image.fromarray(frame(i)).resize((sw, sh), Image.LANCZOS), (6 + k * (sw + 6), 6))
    crop = Image.fromarray(frame(i)[700:1100, 620:1160]).resize((sw, 400), Image.LANCZOS)
    seam.paste(crop, (6 + k * (sw + 6), sh + 12))
seam.save(os.path.join(out, 'seam.png'))

# ---- seam metrics ----
diffs = []
for i in range(N):
    a = frame(i).astype(np.float32); b = frame(i + 1).astype(np.float32)
    diffs.append(float(np.abs(a - b).mean()))
wrap = diffs[N - 1]
typical = float(np.median(diffs[:N - 1]))

# ---- darkest region before / after encode ----
def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
f0 = frame(0).astype(np.float32)
L0 = luma(f0)
B = 64
best = None
for y in range(0, H - B, 16):
    for x in range(0, W - B, 16):
        m = L0[y:y + B, x:x + B].mean()
        if best is None or m < best[0]:
            best = (m, x, y)
_, bx, by = best
dec = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', os.path.join(out, 'loop-4x5.mp4'), '-frames:v', '1',
                      '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgb24', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                     capture_output=True).stdout
d0 = np.frombuffer(dec, dtype=np.uint8).reshape(H, W, 3).astype(np.float32)
before = f0[by:by + B, bx:bx + B].reshape(-1, 3).mean(0)
after = d0[by:by + B, bx:bx + B].reshape(-1, 3).mean(0)
whole_err = float(np.abs(d0 - f0).mean())

probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                        'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space,color_transfer,color_primaries,color_range:format=duration,size,bit_rate',
                        '-of', 'default=nw=1', os.path.join(out, 'loop-4x5.mp4')], capture_output=True, text=True).stdout
probe3 = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,nb_frames:format=duration',
                         '-of', 'default=nw=1', os.path.join(out, 'loop-4x5-x3.mp4')], capture_output=True, text=True).stdout
timing = ''
tp = os.path.join(out, 'loop-4x5.mp4.timing.txt')
if os.path.exists(tp):
    timing = open(tp).read().strip()

rep = []
rep.append('Dawn, a Window, a Glass of Water — verification')
rep.append('')
rep.append('== ffprobe loop-4x5.mp4 ==')
rep.append(probe.strip())
rep.append('')
rep.append('== ffprobe loop-4x5-x3.mp4 ==')
rep.append(probe3.strip())
rep.append('')
rep.append(f'loop length: {N} frames at 30 fps = {N / 30:.3f} s (one loop, t = f/30, f = 0..299)')
rep.append(f'render: {timing}')
rep.append('')
rep.append('== seam (exact rendered rgb frames, mean abs pixel diff, 0-255 scale) ==')
rep.append(f'last -> first (frame 299 -> 0): {wrap:.4f}')
rep.append(f'typical frame -> frame (median of 299 pairs): {typical:.4f}')
rep.append(f'mean / max frame -> frame: {np.mean(diffs[:N-1]):.4f} / {np.max(diffs[:N-1]):.4f}')
rep.append(f'ratio wrap / typical: {wrap / max(typical, 1e-9):.3f}')
rep.append('')
rep.append('== darkest 64x64 region (frame 0) ==')
rep.append(f'position x={bx} y={by}')
rep.append(f'before encode (sRGB rgb mean): {before.round(2).tolist()}  luma {float(luma(before[None])[0]):.2f}')
rep.append(f'after encode  (decoded rgb mean): {after.round(2).tolist()}  luma {float(luma(after[None])[0]):.2f}')
rep.append(f'whole-frame mean abs error after encode: {whole_err:.3f}')
open(os.path.join(out, 'verification.txt'), 'w').write('\n'.join(rep) + '\n')
print('\n'.join(rep))
