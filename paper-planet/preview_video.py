"""Low-res motion preview: python preview_video.py out.mp4 [w] [step]"""
import sys, subprocess, multiprocessing as mp
sys.path.insert(0, '.')
W = int(sys.argv[2]) if len(sys.argv) > 2 else 480
STEP = int(sys.argv[3]) if len(sys.argv) > 3 else 2
H = W * 9 // 16
R = None
def init():
    global R
    import cv2; cv2.setNumThreads(1)
    from pp import render, scene, backdrop
    R = render.Renderer(scene.Scene(), backdrop.Backdrop(ss=1, w=W, h=H), ss=1, w=W, h=H)
def work(fi):
    return R.render(fi).tobytes()
if __name__ == '__main__':
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(30 / STEP), '-i', '-',
                           '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-threads', '1', sys.argv[1]], stdin=subprocess.PIPE)
    with mp.Pool(4, initializer=init) as pool:
        for d in pool.imap(work, range(0, 1800, STEP), chunksize=4):
            ff.stdin.write(d)
    ff.stdin.close(); ff.wait()
