"""Stills for v3: the plain opening, each stop's hero moment, the whale at the top of its leap, a swoop, the
final wave and the bloomed wide shot (1080p PNG + 4K JPEG from the 2x render buffer; motion-blurred frames
are rendered sharp)."""
import cv2, os, shutil
from pp import render, scene, backdrop, core
S = [('00_plain_opening', 2.0)]
for k, s in enumerate(core.STOPS):
    if s[0] == 'whale':
        continue
    S.append(('%02d_%s' % (k + 1, s[0]), core.stop_face_time(s[0]) + 0.9))
S.append(('05_whale_breach', core.BREACH_PEAK))
S.append(('11_final_wave', core.FINAL_WAVE[0] + 1.6))
S.append(('12_bloomed_wide', core.WIDE_IN + 3.5))
S.sort()
if os.path.isdir('out/stills'):
    shutil.rmtree('out/stills')
os.makedirs('out/stills')
R = render.Renderer(scene.Scene(), backdrop.Backdrop())
for name, t in S:
    fi = int(round(t * core.FPS))
    img = R.render(fi)
    cv2.imwrite('out/stills/%s_f%04d.png' % (name, fi), img[..., ::-1])
    cv2.imwrite('out/stills/%s_f%04d_4k.jpg' % (name, fi), R.buf[..., 2::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(name, fi, flush=True)
