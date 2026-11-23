"""python popview.py video out.jpg pair:x:y ...  (x,y 1080p coords) -> rows of [frame i-1, i, i+1, i+2] crops"""
import sys, subprocess, numpy as np, cv2
v, out = sys.argv[1], sys.argv[2]
W, H = [int(q) for q in subprocess.check_output(['ffprobe', '-v', '0', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', v]).decode().strip().split(',')]
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', v, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
k = W / 1920.0
cw, chh = int(400 * k), int(300 * k)
rows = []
for a in sys.argv[3:]:
    i, x, y = [int(q) for q in a.split(':')]
    x, y = int(x * k), int(y * k)
    x0, y0 = max(0, min(W - cw, x - cw // 2)), max(0, min(H - chh, y - chh // 2))
    tiles = []
    for d in (-1, 0, 1, 2):
        f = F[min(len(F) - 1, max(0, i + d))][y0:y0 + chh, x0:x0 + cw].copy()
        f = cv2.resize(f, (400, 300), interpolation=cv2.INTER_NEAREST)
        cv2.putText(f, str(i + d), (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        tiles.append(f)
    rows.append(np.concatenate(tiles, 1))
cv2.imwrite(out, np.concatenate(rows, 0))
