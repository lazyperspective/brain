#!/usr/bin/env python3
"""Assemble deliverables from a finished video render.
usage: finish.py <render_dir (has loop-4x5.mp4, frames/, stats.json)> <out_dir> <still_4k.png> <crops json>
crops json: {"focal":[x,y], "darkest":[x,y], "texture":[x,y], "corner":[x,y]} (top-left, 4K px)
"""
import json, os, subprocess, sys, shutil
import numpy as np
from PIL import Image

rd, od, still, crops = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
os.makedirs(os.path.join(od, 'crops'), exist_ok=True)

def run(*a, **k):
    return subprocess.run(a, check=True, capture_output=True, text=True, **k).stdout

shutil.copy(os.path.join(rd, 'loop-4x5.mp4'), os.path.join(od, 'loop-4x5.mp4'))
# x3: stream copy of the same encoded loop, concatenated
lst = os.path.join(rd, 'concat.txt')
with open(lst, 'w') as f:
    for _ in range(3):
        f.write("file '%s'\n" % os.path.abspath(os.path.join(od, 'loop-4x5.mp4')))
run('ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', os.path.join(od, 'loop-4x5-x3.mp4'))

# still
shutil.copy(still, os.path.join(od, 'still-4k.png'))
im = Image.open(still).convert('RGB')
assert im.size == (2160, 2700), im.size
im.save(os.path.join(od, 'still-x.jpg'), quality=94, subsampling=0, optimize=True)

# crops (100%, 900x900)
C = 900
for name, (x, y) in crops.items():
    x = max(0, min(2160 - C, x)); y = max(0, min(2700 - C, y))
    im.crop((x, y, x + C, y + C)).save(os.path.join(od, 'crops', f'{name}.png'))

# contact sheet: 12 evenly spaced frames, 4 x 3
fr = os.path.join(rd, 'frames')
stats = json.load(open(os.path.join(rd, 'stats.json')))
N = stats['frames']
idx = [round(k * N / 12) for k in range(12)]
tw, th = 360, 450
sheet = Image.new('RGB', (tw * 4 + 5 * 12, th * 3 + 4 * 12), (24, 23, 21))
for k, i in enumerate(idx):
    t = Image.open(os.path.join(fr, f'f{i:03d}.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
    sheet.paste(t, (12 + (k % 4) * (tw + 12), 12 + (k // 4) * (th + 12)))
sheet.save(os.path.join(od, 'contact-sheet.png'))

# seam: last 3 + first 3 frames side by side (half size), plus a 100% strip of the busiest moving area
seq = [N - 3, N - 2, N - 1, 0, 1, 2]
sw, sh = 540, 675
seam = Image.new('RGB', (sw * 6 + 7 * 8, sh + 2 * 8), (24, 23, 21))
for k, i in enumerate(seq):
    t = Image.open(os.path.join(fr, f'f{i:03d}.png')).convert('RGB').resize((sw, sh), Image.LANCZOS)
    seam.paste(t, (8 + k * (sw + 8), 8))
seam.save(os.path.join(od, 'seam.png'))

# darkest region before / after encode (frame 0)
def lum(a):
    a = a.astype(np.float64)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
src = np.asarray(Image.open(os.path.join(fr, 'f000.png')).convert('RGB'))
dec_path = os.path.join(rd, 'dec0.png')
run('ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(od, 'loop-4x5.mp4'), '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgb24', '-frames:v', '1', dec_path)
dec = np.asarray(Image.open(dec_path).convert('RGB'))
L = lum(src)
B = 16
h, w = L.shape
blocks = L[:h // B * B, :w // B * B].reshape(h // B, B, w // B, B).mean((1, 3))
by, bx = np.unravel_index(blocks.argmin(), blocks.shape)
ys, xs = by * B, bx * B
before = L[ys:ys + B, xs:xs + B].mean()
after = lum(dec)[ys:ys + B, xs:xs + B].mean()
psnr_mse = ((src.astype(float) - dec.astype(float)) ** 2).mean()
psnr = 10 * np.log10(255 ** 2 / psnr_mse)

probe = run('ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space,color_transfer,color_primaries,color_range:format=duration,size,bit_rate', '-of', 'default=nw=1', os.path.join(od, 'loop-4x5.mp4'))
probe3 = run('ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'stream=nb_read_frames:format=duration', '-of', 'default=nw=1', os.path.join(od, 'loop-4x5-x3.mp4'))
jpg_mb = os.path.getsize(os.path.join(od, 'still-x.jpg')) / 1e6

with open(os.path.join(od, 'verification.txt'), 'w') as f:
    f.write('Two Koi, Ink on Rice Paper  (quiet-five #2, two-koi)\n\n')
    f.write('== loop-4x5.mp4 (ffprobe) ==\n' + probe + '\n')
    f.write('encode: libx264 -preset slow -profile:v high -crf 12 -tune grain, yuv420p, bt709 matrix/primaries/trc, tv range, +faststart, no audio\n\n')
    f.write('== loop-4x5-x3.mp4 ==\n' + probe3 + '\n')
    f.write(f"== loop ==\nlength: 12.000 s = {N} frames @ 30 fps (frame i rendered at t = i/30; t=12 wraps to t=0)\n")
    f.write(f"render time (360 frames, 2160x2700 internal, 2x2 supersampled to 1080x1350, SwiftShader): {stats['renderSeconds']:.0f} s\n\n")
    f.write('== seam check (mean abs RGB difference, 0-255, on the 8-bit frames before encode) ==\n')
    f.write(f"last frame (359) -> first frame (0): {stats['seamLastToFirst']:.3f}\n")
    f.write(f"typical consecutive step: median {stats['typicalMedian']:.3f}, mean {stats['typicalMean']:.3f}, min {stats['minStep']:.3f}, max {stats['maxStep']:.3f}\n")
    f.write(f"renderAt(12.0) vs renderAt(0.0): {stats['renderAt12_vs_renderAt0']:.4f} (identical pixels => exactly periodic)\n\n")
    f.write('== darks through the encode (frame 0) ==\n')
    f.write(f"darkest 16x16 region at ({xs},{ys}) in 1080x1350: Rec.709 luma {before:.2f} before encode, {after:.2f} after encode+decode\n")
    f.write(f"frame 0 PSNR after encode: {psnr:.2f} dB\n\n")
    f.write(f"== still ==\nstill-4k.png 2160x2700 rendered natively; still-x.jpg q94 4:4:4, {jpg_mb:.2f} MB\n")
print(open(os.path.join(od, 'verification.txt')).read())
