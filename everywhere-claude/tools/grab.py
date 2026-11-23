# grab.py clip t1,t2,... out.jpg [width]  -> horizontal strip of proxy frames
import cv2, numpy as np, sys
clip, ts, out = sys.argv[1], [float(x) for x in sys.argv[2].split(',')], sys.argv[3]
w = int(sys.argv[4]) if len(sys.argv) > 4 else 360
cap = cv2.VideoCapture(f'/home/user/brain/everywhere-claude/work/proxy/{clip}.mp4'); fps = cap.get(cv2.CAP_PROP_FPS); ims = []
for t in ts:
    cap.set(cv2.CAP_PROP_POS_FRAMES, round(t * fps)); ok, f = cap.read()
    f = cv2.resize(f, (w, int(w * 16 / 9)), interpolation=cv2.INTER_AREA)
    cv2.putText(f, f'{t:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3); cv2.putText(f, f'{t:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    ims.append(f)
cv2.imwrite(out, np.hstack(ims), [cv2.IMWRITE_JPEG_QUALITY, 88])
