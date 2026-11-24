# Shared plate reader: HLG/BT.2020 iPhone clip -> tone-mapped SDR BT.709 (zscale + hable, npl=100, desat=0), conformed to 30 fps CFR.
import subprocess, numpy as np
CLIPS = '/home/user/brain/everywhere-claude/clips'
TM = ('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,'
      'zscale=t=bt709:m=bt709:r=tv,format=gbrp')

def frames(clip, t0, n, size=(1080, 1920), gray=False):
    """yield n frames (BGR uint8 or gray) starting at source time t0 (s), 30 fps CFR."""
    W, H = size
    vf = f'fps=30,{TM},scale={W}:{H}:flags=lanczos,format=bgr24' if (W, H) != (1080, 1920) else f'fps=30,{TM},format=bgr24'
    # seek a little early and drop, so the fps conform grid is the same regardless of t0
    pre = min(t0, 1.0)
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{t0 - pre:.4f}', '-i', f'{CLIPS}/{clip}.mov', '-map', '0:v:0', '-vf', vf,
           '-frames:v', str(n + int(round(pre * 30))), '-f', 'rawvideo', '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=W * H * 3 * 2)
    skip = int(round(pre * 30)); k = 0
    try:
        while True:
            b = p.stdout.read(W * H * 3)
            if len(b) < W * H * 3: break
            if k >= skip:
                f = np.frombuffer(b, np.uint8).reshape(H, W, 3)
                yield (f[..., 1].copy() if gray else f.copy())   # gray: G channel approximates luma well enough for tracking
            k += 1
            if k >= skip + n: break
    finally:
        p.stdout.close(); p.kill(); p.wait()
