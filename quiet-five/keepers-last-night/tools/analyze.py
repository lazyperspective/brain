"""Build contact sheet, seam strip, crops, jpeg and verification from the rendered loop.
usage: python3 analyze.py <outDir> <rawFramesFile> <stillT> <round-note>"""
import sys, os, json, subprocess
import numpy as np
from PIL import Image

out_dir, raw_file, still_t = sys.argv[1], sys.argv[2], float(sys.argv[3])
W, H, FPS, LOOP = 216, 270, 30, 8
N = FPS * LOOP
scratch = os.path.dirname(raw_file)

frames = np.fromfile(raw_file, dtype=np.uint8).reshape(N, H, W, 3)

def up(a, s):
    return np.repeat(np.repeat(a, s, 0), s, 1)

def luma(a):
    a = a.astype(np.float64)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

# ---- contact sheet: 12 evenly spaced frames, 4 x 3, each at x2
idx = [round(k * N / 12) for k in range(12)]
cw, ch = W * 2, H * 2
gap = 8
sheet = Image.new('RGB', (4 * cw + 5 * gap, 3 * ch + 4 * gap), (4, 6, 11))
for k, f in enumerate(idx):
    im = Image.fromarray(up(frames[f], 2))
    sheet.paste(im, (gap + (k % 4) * (cw + gap), gap + (k // 4) * (ch + gap)))
sheet.save(os.path.join(out_dir, 'contact-sheet.png'))

# ---- seam: last 3 then first 3 frames side by side
seq = [N - 3, N - 2, N - 1, 0, 1, 2]
seam = Image.new('RGB', (6 * cw + 7 * gap, ch + 2 * gap), (4, 6, 11))
for k, f in enumerate(seq):
    seam.paste(Image.fromarray(up(frames[f], 2)), (gap + k * (cw + gap), gap))
seam.save(os.path.join(out_dir, 'seam.png'))

# ---- seam metric
d = lambda a, b: float(np.mean(np.abs(a.astype(np.int16) - b.astype(np.int16))))
consec = [d(frames[i], frames[i + 1]) for i in range(N - 1)]
wrap = d(frames[N - 1], frames[0])
# also: rendering t = LOOP must equal t = 0 is checked in the page; compare frame N (re-rendered) if present

# ---- still, jpeg, crops
still = Image.open(os.path.join(out_dir, 'still-4k.png')).convert('RGB')
assert still.size == (2160, 2700), still.size
nat = np.fromfile(os.path.join(scratch, 'still_native.rgb'), dtype=np.uint8).reshape(H, W, 3)
exact = bool(np.array_equal(np.asarray(still), up(nat, 10)))
still.save(os.path.join(out_dir, 'still-x.jpg'), quality=94, subsampling=0, optimize=True)
jpg_size = os.path.getsize(os.path.join(out_dir, 'still-x.jpg'))

S = np.asarray(still)
L = luma(S)
cs = 640
def crop(name, cx, cy):
    x0 = int(min(max(cx - cs // 2, 0), 2160 - cs)); y0 = int(min(max(cy - cs // 2, 0), 2700 - cs))
    Image.fromarray(S[y0:y0 + cs, x0:x0 + cs]).save(os.path.join(out_dir, 'crops', name))
    return [x0, y0]
os.makedirs(os.path.join(out_dir, 'crops'), exist_ok=True)
crops = {}
crops['crop-1-focal-lantern.png'] = crop('crop-1-focal-lantern.png', 1400, 760)
# darkest block
best = (1e9, 0, 0)
for y in range(0, 2700 - cs, 40):
    for x in range(0, 2160 - cs, 40):
        m = L[y:y + cs, x:x + cs].mean()
        if m < best[0]: best = (m, x, y)
crops['crop-2-darkest.png'] = crop('crop-2-darkest.png', best[1] + cs // 2, best[2] + cs // 2)
# busiest: highest count of colour changes between neighbouring native pixels
nl = luma(nat)
edges = (np.abs(np.diff(nl, axis=1))[:-1, :] > 2) | (np.abs(np.diff(nl, axis=0))[:, :-1] > 2)
bb = (-1, 0, 0)
for y in range(0, H - 64, 4):
    for x in range(0, W - 64, 4):
        c = edges[y:y + 64, x:x + 64].sum()
        if c > bb[0]: bb = (c, x, y)
crops['crop-3-busiest.png'] = crop('crop-3-busiest.png', bb[1] * 10 + 320, bb[2] * 10 + 320)
crops['crop-4-corner.png'] = crop('crop-4-corner.png', cs // 2, 2700 - cs // 2)

# ---- darks before / after encode
def decode_frame(path, n):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-vf',
                        f'select=eq(n\\,{n}),scale=in_color_matrix=bt709:in_range=tv:flags=neighbor,format=rgb24',
                        '-vframes', '1', '-f', 'rawvideo', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.uint8).reshape(1350, 1080, 3)
src0 = up(frames[0], 5)
dec0 = decode_frame(os.path.join(out_dir, 'loop-4x5.mp4'), 0)
Ls, Ld = luma(src0), luma(dec0)
bs = (1e9, 0, 0); b = 100
for y in range(0, 1350 - b, 25):
    for x in range(0, 1080 - b, 25):
        m = Ls[y:y + b, x:x + b].mean()
        if m < bs[0]: bs = (m, x, y)
dx, dy = bs[1], bs[2]
dark_before = float(Ls[dy:dy + b, dx:dx + b].mean()); dark_after = float(Ld[dy:dy + b, dx:dx + b].mean())
min_before = float(Ls.min()); min_after = float(np.percentile(Ld, 0.1))
psnr_mse = float(np.mean((src0.astype(np.float64) - dec0.astype(np.float64)) ** 2))
psnr = 10 * np.log10(255 ** 2 / max(psnr_mse, 1e-9))
# seam on the encoded video too
decL = decode_frame(os.path.join(out_dir, 'loop-4x5.mp4'), N - 1)
dec1 = decode_frame(os.path.join(out_dir, 'loop-4x5.mp4'), 1)
enc_wrap = d(decL, dec0); enc_consec = d(dec0, dec1)

probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                        'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space,color_transfer,color_primaries,color_range:format=duration,size,bit_rate',
                        '-of', 'default=noprint_wrappers=1', os.path.join(out_dir, 'loop-4x5.mp4')], capture_output=True, text=True).stdout
probe3 = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=nb_frames:format=duration',
                         '-of', 'default=noprint_wrappers=1', os.path.join(out_dir, 'loop-4x5-x3.mp4')], capture_output=True, text=True).stdout
pal = set(map(tuple, frames.reshape(-1, 3)[::7].tolist()))
render_ms = open(os.path.join(scratch, 'render_ms.txt')).read().strip()

txt = f"""The Keeper's Last Night - verification
=========================================
ffprobe loop-4x5.mp4:
{probe}
ffprobe loop-4x5-x3.mp4:
{probe3}
Loop length: {N} frames at {FPS} fps = {N / FPS:.3f} s (t = 0 .. {LOOP} s, frame k at t = k/{FPS})
Render time (Playwright render of {N} native frames + x264 encode): {int(render_ms) / 1000:.1f} s
Colours used across the loop (sampled): {len(pal)} (palette is 16)

Seam check (native 216x270 frames, mean abs RGB difference, 0-255):
  last -> first (frame {N - 1} -> 0): {wrap:.3f}
  typical frame -> frame: mean {np.mean(consec):.3f}, median {np.median(consec):.3f}, min {np.min(consec):.3f}, max {np.max(consec):.3f}
  ratio wrap / median: {wrap / np.median(consec):.2f}
  encoded video: last -> first {enc_wrap:.3f}, frame 0 -> 1 {enc_consec:.3f}

Darks (luma, 0-255 full-range RGB, BT.709 weights), darkest 100x100 block at ({dx},{dy}) of frame 0 at 1080x1350:
  before encode: {dark_before:.2f}   after encode (decoded, BT.709 limited -> full): {dark_after:.2f}
  darkest pixel before: {min_before:.2f}   0.1th percentile after: {min_after:.2f}
  frame 0 PSNR source vs decoded: {psnr:.2f} dB

Still: still-4k.png 2160x2700 at t = {still_t} s, rendered by the page at scale 10;
  identical to x10 nearest-neighbour of the native frame: {exact}
  still-x.jpg: {jpg_size / 1e6:.2f} MB (quality 94, 4:4:4)
Crops (640x640 at 100% of the 4K still), top-left corners: {json.dumps(crops)}
"""
open(os.path.join(out_dir, 'verification.txt'), 'w').write(txt)
print(txt)
