"""Sprite sheet preview: python sheet.py [prefix...]"""
import sys, numpy as np, cv2
from pp import sprites
S = sprites.build()
names = [n for n in S if (len(sys.argv) < 2 or any(n.startswith(p) for p in sys.argv[1:]))]
cell = 230
cols = 8
rows = (len(names) + cols - 1) // cols
img = np.zeros((rows * cell, cols * cell, 3), np.float32)
img[:] = (70, 45, 60)
labels = []
for i, n in enumerate(names):
    s = S[n]
    sc = min((cell - 30) / s.pw, (cell - 40) / s.ph)
    rg = cv2.resize(s.rgba, (max(1, int(s.pw * sc)), max(1, int(s.ph * sc))), interpolation=cv2.INTER_AREA).astype(np.float32)
    y0 = (i // cols) * cell + (cell - 20 - rg.shape[0]) // 2
    x0 = (i % cols) * cell + (cell - rg.shape[1]) // 2
    a = rg[..., 3:4] / 255
    img[y0:y0 + rg.shape[0], x0:x0 + rg.shape[1]] = img[y0:y0 + rg.shape[0], x0:x0 + rg.shape[1]] * (1 - a) + rg[..., 2::-1]
    labels.append((n, i))
    #cv2.putText(img, n, ((i % cols) * cell + 6, (i // cols + 1) * cell - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (230, 230, 230), 1, cv2.LINE_AA)
img = np.clip(img, 0, 255).astype(np.uint8)
for n, i in labels:
    cv2.putText(img, n, ((i % cols) * cell + 6, (i // cols + 1) * cell - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (230, 230, 230), 1, cv2.LINE_AA)
cv2.imwrite('tmp/sheet.png', img)
print(len(names), 'sprites')
