# motion/flash analysis of the act video: per-frame mean luminance and frame-to-frame change
import subprocess, sys, numpy as np
f = sys.argv[1] if len(sys.argv) > 1 else '/home/user/brain/starship-pixel-video/act3/act3.mp4'
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', 'scale=480:270:flags=neighbor,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 270, 480).astype(np.float32)
lum = fr.mean(axis=(1, 2)); d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
cuts = [65.8, 71.2, 78.6]
print('frames', len(fr))
for i in range(len(d)):
    t = 60.3 + (i + 1) / 30
    flag = any(abs(t - c) < 0.02 for c in cuts)
    if d[i] > 4 and not flag: print(f'spike t={t:.2f} diff={d[i]:.1f}')
# flash count: luminance swings > 20 (of 255) over large area within 1 s windows
big = [i for i in range(len(d)) if abs(lum[i + 1] - lum[i]) > 20]
print('large lum jumps at', [round(60.3 + (i + 1) / 30, 2) for i in big])
print('mean diff per shot:', [round(float(d[a:b].mean()), 2) for a, b in [(0, 164), (165, 326), (327, 548), (549, 950)]])
