"""contact sheet of stills: python3 sheet.py film.mp4 out.jpg [every_n_frames]"""
import subprocess
import sys
import numpy as np
import cv2

src, dst = sys.argv[1], sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 28
cap = cv2.VideoCapture(src)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
frames = []
for f in list(range(0, n, step)):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f)
    ok, im = cap.read()
    if not ok:
        break
    im = cv2.resize(im, (480, 270), interpolation=cv2.INTER_AREA)
    cv2.rectangle(im, (0, 0), (92, 20), (0, 0, 0), -1)
    cv2.putText(im, '%5.2fs' % (f / 30.), (4, 15), cv2.FONT_HERSHEY_SIMPLEX, .5, (140, 200, 240), 1, cv2.LINE_AA)   # sheet annotation only (not in the film)
    frames.append(im)
cols = 5
rows = (len(frames) + cols - 1) // cols
sheet = np.zeros((rows * 270, cols * 480, 3), np.uint8)
for i, im in enumerate(frames):
    sheet[(i // cols) * 270:(i // cols + 1) * 270, (i % cols) * 480:(i % cols + 1) * 480] = im
cv2.imwrite(dst, sheet, [cv2.IMWRITE_JPEG_QUALITY, 90])
print('wrote', dst, len(frames), 'stills')
