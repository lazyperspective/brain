"""Parallel film renderer. Frames are rendered by worker processes and piped straight into one ffmpeg.
Fast camera moves get motion blur: those frames are averaged from several sub-frames across a 180 degree
shutter (the number follows the camera's on-screen speed); every other frame is a single render.
   python render.py --out out/video.mp4 [--start 0 --end NF --step 1 --crf 16 --workers 4 --ss 2 --w 1920]"""
import argparse, math, os, subprocess, sys, time
import multiprocessing as mp
import numpy as np

R = None
SHUTTER = 0.5          # fraction of a frame the shutter is open
BLUR_PX = 2.2          # at most this many px of travel between sub-frames


def camera_speed():
    """1080p px/frame of the globe surface around frame centre, per frame (the same measure as check_motion)."""
    from pp.core import Camera, globe_matrix, NF, FPS, W, H
    r = np.random.default_rng(0)
    la = np.radians(r.uniform(-89, 89, 1200)); lo = r.uniform(-np.pi, np.pi, 1200)
    Pl = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], 1)
    sp = np.zeros(NF)
    prev = None
    for fi in range(NF + 1):
        t = fi / FPS
        cam = Camera(t, 1)
        P = Pl @ globe_matrix(t).T
        s, _ = cam.project(P)
        vis = P @ cam.chat > 1 / cam.dc + 0.05
        if prev is not None:
            s0, v0 = prev
            m = v0 & vis & (np.abs(s0[:, 0] - W / 2) < 600) & (np.abs(s0[:, 1] - H / 2) < 400)
            if m.sum() > 5:
                sp[fi - 1] = np.percentile(np.linalg.norm(s - s0, axis=1)[m], 90)
        prev = (s, vis)
    return sp


def subframes(speed):
    return int(min(6, max(1, math.ceil(speed * SHUTTER / BLUR_PX - 0.25))))


def fade(t):
    from pp.core import FADE_IN, FADE_OUT
    a = min(1.0, t / FADE_IN) if FADE_IN > 0 else 1.0
    b = 1.0 - min(1.0, max(0.0, (t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0])))
    u = a * b
    return u * u * (3 - 2 * u)


def init(ss, w, h, lock=None):
    global R
    import cv2
    cv2.setNumThreads(1)
    from pp import render, scene, backdrop
    R = render.Renderer(scene.Scene(), backdrop.Backdrop(ss=ss, w=w, h=h), ss=ss, w=w, h=h)
    R.sphere_lock = lock


def work(job):
    fi, n = job
    from pp.core import FPS
    t = fi / FPS
    if n <= 1:
        img = R.render(fi, t=t).astype(np.float32)
    else:
        acc = None
        for k in range(n):
            tk = t + (((k + 0.5) / n) - 0.5) * SHUTTER / FPS
            im = R.render(fi, t=tk).astype(np.float32)
            acc = im if acc is None else acc + im
        img = acc / n
    img *= fade(t)
    return fi, np.clip(img + 0.5, 0, 255).astype(np.uint8).tobytes()


if __name__ == '__main__':
    from pp.core import NF, FPS
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--start', type=int, default=0)
    ap.add_argument('--end', type=int, default=NF)
    ap.add_argument('--step', type=int, default=1)
    ap.add_argument('--crf', type=int, default=16)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--ss', type=int, default=2)
    ap.add_argument('--w', type=int, default=1920)
    ap.add_argument('--preset', default='slow')
    ap.add_argument('--noblur', action='store_true')
    ap.add_argument('--sphere_slots', type=int, default=2)
    a = ap.parse_args()
    w, h = a.w, a.w * 9 // 16
    from pp import world
    world.bake()
    sp = camera_speed()
    frames = list(range(a.start, a.end, a.step))
    jobs = [(fi, 1 if a.noblur else subframes(sp[fi])) for fi in frames]
    nsub = sum(n for _, n in jobs)
    print('%d frames, %d renders (%d blurred frames)' % (len(jobs), nsub, sum(1 for _, n in jobs if n > 1)), flush=True)
    fps = FPS / a.step
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (w, h), '-r', str(fps), '-i', '-',
           '-c:v', 'libx264', '-preset', a.preset, '-crf', str(a.crf), '-pix_fmt', 'yuv420p', '-threads', '2',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', a.out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    done = 0
    from collections import deque
    lock = mp.Semaphore(a.sphere_slots)
    with mp.Pool(a.workers, initializer=init, initargs=(a.ss, w, h, lock)) as pool:
        # a bounded window of frames in flight, written in order: the parent never buffers more than WINDOW frames
        pending = deque()
        it = iter(enumerate(jobs))
        WINDOW = 2 * a.workers + 2
        k = 0
        while True:
            while len(pending) < WINDOW:
                nxt = next(it, None)
                if nxt is None:
                    break
                pending.append((nxt[0], pool.apply_async(work, (nxt[1],))))
            if not pending:
                break
            kk, res = pending.popleft()
            fi, data = res.get(timeout=1800)
            ff.stdin.write(data)
            done += jobs[kk][1]
            if kk % 50 == 0:
                el = time.time() - t0
                print('frame %d (%d/%d) %.0fs elapsed, eta %.0fs' % (fi, kk + 1, len(jobs), el, el / done * (nsub - done)), flush=True)
    ff.stdin.close()
    ff.wait()
    print('done in %.0fs' % (time.time() - t0))
