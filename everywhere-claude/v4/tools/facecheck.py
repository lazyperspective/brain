# Face check: every frame of a video through OpenCV Haar detectors (frontal + profile, both directions). Writes a list of
# hits and a sheet of crops around every hit (and the size of each face in px) for manual inspection.
import sys, cv2, numpy as np, json
C = '/home/user/brain/everywhere-claude/v4/check/cascades'
fr = cv2.CascadeClassifier(f'{C}/haarcascade_frontalface_alt2.xml'); pr = cv2.CascadeClassifier(f'{C}/haarcascade_profileface.xml')

def detect(img, min_px=14):
    g = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)); out = []
    for c, flip in ((fr, False), (pr, False), (pr, True)):
        gg = cv2.flip(g, 1) if flip else g
        for x, y, w, h in c.detectMultiScale(gg, 1.08, 4, minSize=(min_px, min_px)):
            if flip: x = g.shape[1] - x - w
            out.append([int(x), int(y), int(w), int(h)])
    return out

if __name__ == '__main__':
    src, outp = sys.argv[1], sys.argv[2]
    rng = [tuple(map(int, r.split(':'))) for r in sys.argv[3:]]          # optional frame ranges a:b (shots with people)
    cap = cv2.VideoCapture(src); i = 0; hits = []; crops = []
    while True:
        ok, f = cap.read()
        if not ok: break
        if rng and not any(a <= i < b for a, b in rng): i += 1; continue
        for b in detect(f):
            hits.append(dict(frame=i, t=round(i / 30, 2), box=b))
            x, y, w, h = b; c = f[max(0, y - h):y + 2 * h, max(0, x - w):x + 2 * w]
            if c.size and len(crops) < 120:
                c = cv2.resize(c, (120, 120)); cv2.putText(c, f'{i} {w}px', (2, 12), 0, 0.4, (0, 255, 255), 1); crops.append(c)
        i += 1
    json.dump(dict(frames=i, hits=hits), open(outp + '.json', 'w'))
    if crops:
        rows = [np.hstack(crops[r:r + 12] + [np.zeros_like(crops[0])] * (12 - len(crops[r:r + 12]))) for r in range(0, len(crops), 12)]
        cv2.imwrite(outp + '.jpg', np.vstack(rows))
    print('frames', i, 'hits', len(hits), sorted(set(h['frame'] for h in hits))[:200])
