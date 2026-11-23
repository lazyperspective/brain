"""Stills for the X cut: the plain first frame, the burst, close-ups at their hero moments, the whale at the top
of its leap, the crowned globe and the fold; 16:9 as 1080p PNG + 3840x2160 JPEG from the 2x render buffer
(no vignette), plus the hook, the whale and the crowned globe in the vertical format.
   python stills_x.py"""
import os, shutil, sys, cv2
sys.path.insert(0, '.')
from pp import render, scene, backdrop, xcut

PICKS = {
    'x': [('00_plain_frame0', 0.0), ('01_burst', 0.9), ('02_burst_crowning', 1.3), ('03_crowned_snap', 2.4)],
    'v': [('v00_plain_frame0', 0.0), ('v01_burst', 1.3), ('v20_whale_top', None), ('v30_crowned', 20.3)],
}
if __name__ == '__main__':
    out = 'out/stills_x'
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith('.png') or (f.endswith('.jpg') and not f.startswith(('hook_strip', 'contact_sheet'))):
            os.remove(os.path.join(out, f))
    for fmt in ('x', 'v'):
        w, h = xcut.FMT[fmt]
        sc = scene.Scene()
        X = xcut.XCut(sc, fmt)
        picks = list(PICKS[fmt])
        if fmt == 'x':
            k = 10
            for s in X.shots:
                if s.kind == 'close' and s.name in ('eiffel', 'greatwave', 'aurora', 'pyramids', 'liberty', 'taj', 'machu', 'kilimanjaro', 'opera', 'pagoda', 'torii'):
                    picks.append(('%02d_%s' % (k, s.name), min(s.t1 - 1.0 / 30, s.tref)))
                    k += 1
            picks += [('40_whale_leaving', xcut.beat(xcut.WHALE['beat']) + 0.3), ('41_whale_top', None),
                      ('50_crowned', 20.3), ('51_fold', 22.75)]
        R = render.Renderer(sc, backdrop.Backdrop(ss=2, w=w, h=h), ss=2, w=w, h=h)
        for name, tau in picks:
            if tau is None:
                tau = xcut.beat(xcut.WHALE['peak_beat'])
            fi = int(round(tau * xcut.FPS))
            t = X.apply(fi / xcut.FPS)
            img = R.render(fi, t=t)
            cv2.imwrite('%s/%s_f%03d.png' % (out, name, fi), img[..., ::-1])
            if fmt == 'x':
                cv2.imwrite('%s/%s_f%03d_4k.jpg' % (out, name, fi), R.buf[..., 2::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])
            print(fmt, name, fi, flush=True)
        X.release()
