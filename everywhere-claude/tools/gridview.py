import cv2, sys
im = cv2.imread(sys.argv[1]); x0, y0, x1, y1 = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else (0, 0, im.shape[1], im.shape[0])
im = im[y0:y1, x0:x1].copy(); step = int(sys.argv[4]) if len(sys.argv) > 4 else 100
for x in range((x0 // step + 1) * step, x1, step): cv2.line(im, (x - x0, 0), (x - x0, im.shape[0]), (0, 255, 255), 1); cv2.putText(im, str(x), (x - x0 + 2, 14), 0, 0.45, (0, 255, 255), 1)
for y in range((y0 // step + 1) * step, y1, step): cv2.line(im, (0, y - y0), (im.shape[1], y - y0), (0, 255, 255), 1); cv2.putText(im, str(y), (2, y - y0 - 2), 0, 0.45, (0, 255, 255), 1)
s = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5
cv2.imwrite(sys.argv[2], cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA))
