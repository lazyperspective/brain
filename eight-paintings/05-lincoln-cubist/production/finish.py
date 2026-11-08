# From the 4K master: the X jpeg (q93, 4:4:4) and four 100% crops; optional snapshot copy.
#   python3 finish.py <master.png> <outdir> [snapshotN]
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
assert im.size == (2160, 2700), im.size
slug = '05-lincoln-cubist'
if os.path.abspath(src) != os.path.abspath(os.path.join(out, slug + '-4k.png')):
    im.save(os.path.join(out, slug + '-4k.png'), optimize=True)
q = 94
while True:
    jp = os.path.join(out, slug + '-x.jpg')
    im.save(jp, quality=q, subsampling=0, optimize=True)
    if os.path.getsize(jp) < 4.8e6 or q <= 92: break
    q -= 1
print('jpg q', q, os.path.getsize(jp))
os.makedirs(os.path.join(out, 'crops'), exist_ok=True)
crops = {'focal-eyes-mole': (760, 820, 760, 760), 'darkest-coat-tie': (820, 1700, 760, 760), 'busiest-newsprint-hair': (200, 200, 760, 760), 'edge-corner-bottom-right': (1400, 1940, 760, 760)}
for k, (x, y, w, h) in crops.items():
    im.crop((x, y, x + w, y + h)).save(os.path.join(out, 'crops', k + '.png'))
if len(sys.argv) > 3:
    os.makedirs(os.path.join(out, 'snapshots'), exist_ok=True)
    im.save(os.path.join(out, 'snapshots', sys.argv[3] + '.png'), optimize=True)
print('done')
