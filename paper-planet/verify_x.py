"""Checks for the X cut.
   python verify_x.py video out/paper_planet_x.mp4   cuts vs the beat grid, loop seam, pop/glitch scan inside shots
   python verify_x.py audio out/paper_planet_x_audio.wav   loudness, true peak, seam continuity, hits on the grid
   python verify_x.py limb [fmt] [step]            limb occlusion over the cut (no rendering)"""
import sys, subprocess, re
import numpy as np
sys.path.insert(0, '.')
from pp import xcut

F = xcut.FPS


def planned_cuts():
    S = sorted([xcut.beat(b) for (_, b, *r) in xcut.SHOTS] + [xcut.beat(xcut.WHALE['beat']), xcut.beat(xcut.CROWN_BEAT), xcut.beat(3)])
    return [int(round(t * F)) for t in S]


def video(path):
    W, H = 480, 270
    p = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path],
                       capture_output=True, text=True).stdout.strip().split(',')
    w0, h0 = int(p[0]), int(p[1])
    W = 480 if w0 >= h0 else 270
    H = int(round(W * h0 / w0 / 15)) * 15
    W = W // 15 * 15
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-vf', 'scale=%d:%d:flags=area' % (W, H), '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
                         capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    n = len(f)
    print('%s: %d frames (%.3f s), %dx%d' % (path, n, n / F, w0, h0))
    d = np.abs(f[1:] - f[:-1])
    mean = d.mean((1, 2))
    # cuts: a frame pair whose difference stands far above both neighbours
    cuts = planned_cuts()
    det = [i + 1 for i in range(len(mean)) if mean[i] > 4.0 * max(np.median(mean[max(0, i - 4):i] if i > 0 else [1]), 0.5)
           and mean[i] > 3.0]
    beatf = lambda fi: (fi - int(round(xcut.G0 * F))) / (xcut.BEAT * F)
    print('planned cuts (frame: beats from the first downbeat):', ', '.join('%d:%g' % (c, beatf(c)) for c in cuts))
    miss = [c for c in cuts if c not in det]
    extra = [c for c in det if c not in cuts]
    print('detected %d cuts; planned cuts not detected: %s; detections that are not planned cuts: %s' % (len(det), miss, extra))
    off = [c for c in cuts if abs(beatf(c) * 2 - round(beatf(c) * 2)) > 1e-6]
    print('cuts off the half-beat grid: %s' % off)
    # loop seam: last -> first frame against ordinary steps
    seam = np.abs(f[0] - f[-1]).mean()
    steps = mean[[i for i in range(len(mean)) if i + 1 not in cuts]]
    near = np.r_[mean[:5], mean[-5:]]
    print('loop seam: |last - first| = %.3f; ordinary frame step median %.3f, p90 %.3f; steps around the seam %.3f' %
          (seam, np.median(steps), np.percentile(steps, 90), near.mean()))
    # pops inside shots: block-max difference against its own shot's neighbourhood
    B = 15
    blk = d.reshape(n - 1, H // B, B, W // B, B).mean((2, 4))
    bmax = blk.reshape(n - 1, -1).max(1)
    edges = [0] + cuts + [n]
    shot_of = np.zeros(n - 1, int)
    for k in range(len(edges) - 1):
        shot_of[edges[k]:edges[k + 1] - 1] = k
    ok = np.ones(n - 1, bool)
    for c in cuts:
        ok[c - 1] = False                 # the pair that straddles a cut
    ratio = np.zeros(n - 1)
    for i in range(n - 1):
        if not ok[i]:
            continue
        nb = [j for j in range(i - 6, i + 7) if 0 <= j < n - 1 and j != i and ok[j] and shot_of[j] == shot_of[i]]
        ratio[i] = bmax[i] / (np.median(bmax[nb]) + 0.5) if nb else 0
    names = ['snap'] + [s.name for s in sorted(X_SHOTS, key=lambda s: s.t0)][1:] if X_SHOTS else []
    print('block-max diff inside shots: median %.2f, p99 %.2f, max %.2f' % (np.median(bmax[ok]), np.percentile(bmax[ok], 99), bmax[ok].max()))
    print('largest pop ratios inside shots (pair: ratio, block-max, where):')
    for i in np.argsort(-ratio)[:12]:
        by, bx = np.unravel_index(blk[i].argmax(), blk[i].shape)
        print('  %4d->%d (t=%.2f, %s): %.2f  %.1f  at x=%.2f y=%.2f' % (i, i + 1, i / F, shot_name(i / F), ratio[i], bmax[i], (bx + 0.5) * B / W, (by + 0.5) * B / H))


X_SHOTS = None


def shot_name(t):
    for (name, b, nb, *r) in xcut.SHOTS:
        if xcut.beat(b) <= t < xcut.beat(b + nb):
            return name
    if xcut.beat(xcut.WHALE['beat']) <= t < xcut.beat(xcut.WHALE['beat'] + xcut.WHALE['len']):
        return 'whale'
    return 'snap' if t < xcut.beat(3) else 'crown'


def audio(path):
    import wave
    w = wave.open(path)
    sr, n = w.getframerate(), w.getnframes()
    x = np.frombuffer(w.readframes(n), '<i2').reshape(-1, 2).astype(np.float64) / 32768.0
    print('%s: %d samples, %.4f s (loop %.4f s)' % (path, n, n / sr, xcut.LOOP))
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    t = r[r.rindex('Summary:'):]
    print('EBU R128 (one pass of the file): I %s LUFS, LRA %s LU, true peak %s dBFS' % (re.search(r'I:\s+(-?[\d.]+)', t).group(1),
          re.search(r'LRA:\s+(-?[\d.]+)', t).group(1), re.search(r'Peak:\s+(-?[\d.]+)', t).group(1)))
    # as it plays on autoplay: three loops back to back
    import tempfile, os, wave as wv
    tmp = tempfile.mktemp(suffix='.wav')
    with wv.open(tmp, 'wb') as o:
        o.setnchannels(2); o.setsampwidth(2); o.setframerate(sr)
        o.writeframes((np.tile(x, (3, 1)) * 32767).astype('<i2').tobytes())
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    os.remove(tmp)
    t = r[r.rindex('Summary:'):]
    print('EBU R128 (three loops, as autoplay hears it): I %s LUFS, true peak %s dBFS' % (re.search(r'I:\s+(-?[\d.]+)', t).group(1), re.search(r'Peak:\s+(-?[\d.]+)', t).group(1)))
    st = np.abs(np.diff(x, axis=0)).max(1)
    seam = np.abs(x[0] - x[-1]).max()
    print('seam: |first - last sample| = %.5f; ordinary sample step median %.5f, p99 %.5f (the seam is %s)' %
          (seam, np.median(st), np.percentile(st, 99), 'continuous' if seam < np.percentile(st, 99) else 'A STEP'))
    # high-frequency click detector around the seam: energy above 8 kHz in 2 ms windows
    y = np.r_[x[-sr // 10:], x[:sr // 10]].mean(1)
    Y = np.fft.rfft(y); fr = np.fft.rfftfreq(len(y), 1 / sr); Y[fr < 8000] = 0
    hp = np.fft.irfft(Y, n=len(y))
    win = int(0.002 * sr)
    e = np.array([np.sqrt((hp[i:i + win] ** 2).mean()) for i in range(0, len(hp) - win, win)])
    mid = len(e) // 2
    print('  >8 kHz energy in 2 ms windows across the seam: at the seam %.5f, median of the surrounding 0.2 s %.5f' % (e[mid - 1:mid + 1].max(), np.median(e)))
    # transients on the grid: onset strength vs the half-beat grid
    m = x.mean(1)
    hop = 240
    env = np.sqrt(np.convolve(m ** 2, np.ones(hop) / hop, 'same')[::hop])
    on = np.maximum(0, np.diff(np.log(env + 1e-4)))
    tt = np.arange(len(on)) * hop / sr
    top = np.argsort(-on)[:30]
    grid = lambda t: (t - xcut.G0) / (xcut.BEAT / 4)
    dev = [abs(grid(tt[i]) - round(grid(tt[i]))) * xcut.BEAT / 4 * 1000 for i in top]
    print('  30 strongest onsets: median distance to the sixteenth-note grid %.0f ms (max %.0f ms); on cuts: %d of %d' %
          (np.median(dev), max(dev), sum(1 for i in top if min(abs(tt[i] - c / F) for c in planned_cuts() + [0]) < 0.03), len(top)))


def limb(fmt='x', step=3):
    from pp import scene, core
    from pp.core import Camera, globe_matrix
    sc = scene.Scene()
    X = xcut.XCut(sc, fmt)
    W, H = xcut.FMT[fmt]
    masks = {}
    g = (np.arange(16) + 0.5) / 16
    GU, GV = [a.ravel() for a in np.meshgrid(g, g)]
    tot = bad = 0
    worst = {}
    for fi in range(0, xcut.NF, step):
        t = X.apply(fi / F)
        cam = Camera(t, 1, W, H); G = globe_matrix(t)
        for c in sc.cards(t, G, cam):
            if c.emis:
                continue
            P = c.O[None] + np.outer(GU * c.w, c.X) + np.outer(GV * c.h, c.Y)
            sd = P @ cam.chat - cam.limb_k
            if sd.max() < 0:
                continue
            op = np.zeros(len(P), bool)
            for L in c.layers:
                spr, A = L[0], L[1]
                Mi = np.linalg.inv(np.array(A.get9()).reshape(3, 3))
                xl, yl = GU * c.w, GV * c.h
                px = Mi[0, 0] * xl + Mi[0, 1] * yl + Mi[0, 2]
                py = Mi[1, 0] * xl + Mi[1, 1] * yl + Mi[1, 2]
                if spr.name not in masks:
                    masks[spr.name] = spr.rgba[..., 3] > 90
                okk = (px >= 0) & (py >= 0) & (px < spr.pw) & (py < spr.ph)
                if len(L) > 3 and L[3] is not None:
                    okk &= (px >= L[3][0]) & (px < L[3][1])
                idx = np.nonzero(okk)[0]
                op[idx] |= masks[spr.name][py[idx].astype(int), px[idx].astype(int)]
            if c.clip:
                op &= (GV * c.h >= 0) & (GU * c.w >= 0)
            drawn = op & (sd >= 0)
            r = np.linalg.norm(P, axis=1)
            v = drawn & (r < 0.997)
            tot += drawn.sum(); bad += v.sum()
            if v.any():
                worst.setdefault(c.layers[0][0].name, []).append((fi, int(v.sum()), round(float(r[v].min()), 3)))
    X.release()
    print('limb occlusion (%s, every %d frames): %d opaque card points drawn over the globe, %d inside it (%.4f%%)' % (fmt, step, tot, bad, 100.0 * bad / max(1, tot)))
    for nm, l in sorted(worst.items(), key=lambda kv: -sum(x[1] for x in kv[1]))[:10]:
        print('  %-14s frames %d  points %d  deepest r=%.3f  e.g. %s' % (nm, len(l), sum(x[1] for x in l), min(x[2] for x in l), l[:4]))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'video':
        video(sys.argv[2])
    elif cmd == 'audio':
        audio(sys.argv[2])
    else:
        limb(sys.argv[2] if len(sys.argv) > 2 else 'x', int(sys.argv[3]) if len(sys.argv) > 3 else 3)
