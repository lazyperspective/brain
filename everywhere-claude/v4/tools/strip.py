# quick look: python3 strip.py CLIP out.jpg t1 t2 ... (proxy frames, labelled)
import sys, cv2, numpy as np
clip, out, ts = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3:]]
cap = cv2.VideoCapture(f'/home/user/brain/everywhere-claude/work/proxy/{clip}.mp4'); ims = []
for t in ts:
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * 30))); ok, f = cap.read()
    f = cv2.resize(f, (270, 480)); cv2.putText(f, f'{t:.2f}', (5, 22), 0, 0.7, (0, 0, 0), 3); cv2.putText(f, f'{t:.2f}', (5, 22), 0, 0.7, (255, 255, 255), 1); ims.append(f)
rows = [np.hstack(ims[i:i + 8] + [np.zeros_like(ims[0])] * (8 - len(ims[i:i + 8]))) for i in range(0, len(ims), 8)]
cv2.imwrite(out, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
