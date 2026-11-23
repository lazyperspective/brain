"""Parallel film renderer. Frames are rendered by worker processes and piped straight into one ffmpeg.
   python render.py --out out/video.mp4 [--start 0 --end 1800 --step 1 --crf 16 --workers 4 --scale 1.0]"""
import argparse, os, subprocess, sys, time
import multiprocessing as mp

R = None


def init(ss):
    global R
    import cv2
    cv2.setNumThreads(1)
    from pp import render, scene, backdrop
    R = render.Renderer(scene.Scene(), backdrop.Backdrop(ss=ss), ss=ss)


def work(fi):
    return fi, R.render(fi).tobytes()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--start', type=int, default=0)
    ap.add_argument('--end', type=int, default=1800)
    ap.add_argument('--step', type=int, default=1)
    ap.add_argument('--crf', type=int, default=16)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--ss', type=int, default=2)
    ap.add_argument('--fps', type=float, default=None)
    ap.add_argument('--preset', default='slow')
    ap.add_argument('--vf', default=None)
    a = ap.parse_args()
    from pp import world
    world.bake()
    frames = list(range(a.start, a.end, a.step))
    fps = a.fps or 30.0 / a.step
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x1080', '-r', str(fps), '-i', '-']
    if a.vf:
        cmd += ['-vf', a.vf]
    cmd += ['-c:v', 'libx264', '-preset', a.preset, '-crf', str(a.crf), '-pix_fmt', 'yuv420p', '-threads', '2',
            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', a.out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with mp.Pool(a.workers, initializer=init, initargs=(a.ss,)) as pool:
        for k, (fi, data) in enumerate(pool.imap(work, frames, chunksize=2)):
            ff.stdin.write(data)
            if k % 50 == 0:
                el = time.time() - t0
                print('frame %d (%d/%d) %.0fs elapsed, eta %.0fs' % (fi, k + 1, len(frames), el, el / (k + 1) * (len(frames) - k - 1)), flush=True)
    ff.stdin.close()
    ff.wait()
    print('done in %.0fs' % (time.time() - t0))
