"""contact sheet helper: python sheet.py <framesdir> <out.jpg> <cols> <tile_w> idx idx ...  (crops the vertical framing)"""
import sys, os, cv2, numpy as np
d, out, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
ids = [int(a) for a in sys.argv[5:]]
tiles = []
for i in ids:
    im = cv2.imread(os.path.join(d, f"{i:04d}.jpg"))
    if im is None:
        continue
    h, w = im.shape[:2]
    x0 = int(w * 180 / 1440); x1 = int(w * 1260 / 1440)
    im = im[:, x0:x1]
    th = int(tw * im.shape[0] / im.shape[1])
    im = cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)
    cv2.putText(im, str(i), (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    tiles.append(im)
rows = []
for r in range(0, len(tiles), cols):
    row = tiles[r:r + cols]
    while len(row) < cols:
        row.append(np.full_like(tiles[0], 255))
    rows.append(np.hstack(row))
cv2.imwrite(out, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
