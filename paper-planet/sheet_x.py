"""Contact sheet and hook strip for the X cut, from an encoded video.
   python sheet_x.py video.mp4 sheet.jpg [strip.jpg]
Sheet: one frame from each shot (labelled cut time and shot), plus the plain first frame and the fold.
Strip: frame 0 and the first second (every 3rd frame) at feed-thumbnail size (240 px wide), to check the hook."""
import sys, subprocess, numpy as np, cv2
sys.path.insert(0, '.')
from pp import xcut

def frames(video, idx, w):
    p = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video],
                       capture_output=True, text=True).stdout.strip().split(',')
    W, H = int(p[0]), int(p[1])
    h = int(round(w * H / W / 2)) * 2
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', video, '-vf', 'scale=%d:%d:flags=area' % (w, h), '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'],
                         capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    return [f[min(i, len(f) - 1)].copy() for i in idx], f

def label(img, txt, sc=0.45):
    cv2.putText(img, txt, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, sc, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(img, txt, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, sc, (255, 255, 255), 1, cv2.LINE_AA)
    return img

def tile(imgs, cols):
    while len(imgs) % cols:
        imgs.append(np.zeros_like(imgs[0]))
    return np.concatenate([np.concatenate(imgs[i:i + cols], 1) for i in range(0, len(imgs), cols)], 0)

if __name__ == '__main__':
    video, out = sys.argv[1], sys.argv[2]
    F = xcut.FPS
    picks = [(0, 'plain f0'), (int(0.9 * F), 'burst'), (int(1.5 * F), 'burst')]
    for (name, b, nb, *r) in xcut.SHOTS:
        t0, t1 = xcut.beat(b), xcut.beat(b + nb)
        picks.append((int(round((t0 + 0.7 * (t1 - t0)) * F)), name))
    wb = xcut.WHALE
    picks.append((int(round((xcut.beat(wb['beat']) + 0.4) * F)), 'whale'))
    picks.append((int(round(xcut.beat(wb['peak_beat']) * F)), 'whale top'))
    picks.append((int(round((xcut.beat(xcut.CROWN_BEAT) + 1.5) * F)), 'crowned'))
    picks.append((int(round(22.8 * F)), 'fold'))
    picks.append((xcut.NF - 1, 'last frame'))
    picks.sort()
    imgs, allf = frames(video, [p[0] for p in picks], 384)
    imgs = [label(im, '%.2fs %s' % (fi / F, nm)) for im, (fi, nm) in zip(imgs, picks)]
    cv2.imwrite(out, tile(imgs, 7 if allf.shape[1] < allf.shape[2] else 10), [cv2.IMWRITE_JPEG_QUALITY, 90])
    if len(sys.argv) > 3:
        idx = list(range(0, 31, 3))
        th, _ = frames(video, idx, 240)
        th = [label(im, '%.1fs' % (i / F), 0.4) for im, i in zip(th, idx)]
        cv2.imwrite(sys.argv[3], tile(th, 6 if allf.shape[1] < allf.shape[2] else 11), [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(len(picks), 'tiles')
