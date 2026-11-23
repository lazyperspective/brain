"""python popview.py video out.jpg pair:x:y ...  (x,y 1080p coords) -> rows of [frame i, i+1, i+2] crops"""
import sys, subprocess, numpy as np, cv2
v, out = sys.argv[1], sys.argv[2]
W, H = 960, 540
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', v, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
rows = []
for a in sys.argv[3:]:
    i, x, y = [int(q) for q in a.split(':')]
    x, y = x // 2, y // 2
    x0, y0 = max(0, min(W - 200, x - 100)), max(0, min(H - 150, y - 75))
    tiles = []
    for k in (-1, 0, 1, 2):
        f = F[(i + k) % len(F)][y0:y0 + 150, x0:x0 + 200].copy()
        cv2.putText(f, str((i + k) % len(F)), (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        tiles.append(cv2.resize(f, (400, 300), interpolation=cv2.INTER_NEAREST))
    rows.append(np.concatenate(tiles, 1))
cv2.imwrite(out, np.concatenate(rows, 0))
