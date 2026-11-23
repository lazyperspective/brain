"""Loop + pop verification on an encoded film.  python verify.py out/paper_planet_60s.mp4"""
import sys, subprocess, numpy as np
v = sys.argv[1]
W, H = 480, 270
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', v, '-vf', 'scale=%d:%d:flags=area' % (W, H), '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
                     capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
n = len(f)
nxt = np.roll(f, -1, axis=0)              # pair i -> i+1, the last pair is the loop seam (last -> first)
d = np.abs(nxt - f)
mean = d.mean((1, 2))
B = 15
blk = d.reshape(n, H // B, B, W // B, B).mean((2, 4))
bmax = blk.reshape(n, -1).max(1)
print('frames', n)
print('mean abs diff per frame pair: median %.3f  p99 %.3f  max %.3f (pair %d)' % (np.median(mean), np.percentile(mean, 99), mean.max(), mean.argmax()))
print('loop seam pair (last->first): mean %.3f  | neighbours: %.3f (prev) %.3f (next)' % (mean[-1], mean[-2], mean[0]))
print('block-max diff: median %.2f  p99 %.2f  max %.2f (pair %d) | seam %.2f' % (np.median(bmax), np.percentile(bmax, 99), bmax.max(), bmax.argmax(), bmax[-1]))
# pops: a pair whose block-max sticks out of its temporal neighbourhood
k = 6
pad = np.concatenate([bmax[-k:], bmax, bmax[:k]])
loc = np.array([np.median(np.delete(pad[i:i + 2 * k + 1], k)) for i in range(n)])
ratio = bmax / (loc + 0.5)
order = np.argsort(-ratio)[:12]
print('largest local pop ratios (pair: ratio, blockmax, where):')
for i in order:
    by, bx = np.unravel_index(blk[i].argmax(), blk[i].shape)
    print('  %4d: %.2f  %.1f  at x=%d y=%d (1080p)' % (i, ratio[i], bmax[i], bx * B * 4 + 30, by * B * 4 + 30))
