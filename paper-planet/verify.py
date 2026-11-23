"""Pop / glitch scan on an encoded film.  python verify.py video.mp4 [n]
Frame-to-frame luma differences on a 480x270 grid of 15 px blocks. A swoop raises every block together;
a pop is one block that jumps far above its own neighbourhood in time, so the score is the block-max
difference divided by the median of the same measure over the surrounding +-6 frames."""
import sys, subprocess, numpy as np
v = sys.argv[1]
top = int(sys.argv[2]) if len(sys.argv) > 2 else 15
W, H = 480, 270
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', v, '-vf', 'scale=%d:%d:flags=area' % (W, H), '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
                     capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
n = len(f) - 1
d = np.abs(f[1:] - f[:-1])
mean = d.mean((1, 2))
B = 15
blk = d.reshape(n, H // B, B, W // B, B).mean((2, 4))
bmax = blk.reshape(n, -1).max(1)
print('frames', len(f))
print('mean abs diff per frame pair: median %.3f  p99 %.3f  max %.3f (pair %d)' % (np.median(mean), np.percentile(mean, 99), mean.max(), mean.argmax()))
print('block-max diff: median %.2f  p99 %.2f  max %.2f (pair %d)' % (np.median(bmax), np.percentile(bmax, 99), bmax.max(), bmax.argmax()))
k = 6
pad = np.concatenate([bmax[k:0:-1], bmax, bmax[-2:-k - 2:-1]])
loc = np.array([np.median(np.delete(pad[i:i + 2 * k + 1], k)) for i in range(n)])
ratio = bmax / (loc + 0.5)
order = np.argsort(-ratio)[:top]
print('largest local pop ratios (pair: ratio, blockmax, where):')
for i in order:
    by, bx = np.unravel_index(blk[i].argmax(), blk[i].shape)
    print('  %4d (t=%.2f): %.2f  %.1f  at x=%d y=%d (1080p)' % (i, i / 30, ratio[i], bmax[i], bx * B * 4 + 30, by * B * 4 + 30))
