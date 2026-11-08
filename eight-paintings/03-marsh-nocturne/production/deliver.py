# Make the deliverables from a rendered master PNG.
#   python3 deliver.py <master.png> [snapshot N]
# -> 03-marsh-nocturne-4k.png, 03-marsh-nocturne-x.jpg (q94, 4:4:4), crops/*.png; with "snapshot N", only
#    copies the master to snapshots/roundN.png
import os, sys, shutil
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../eight-paintings-output/03-marsh-nocturne')
OUT = os.path.normpath(OUT)
src = sys.argv[1]
os.makedirs(os.path.join(OUT, 'crops'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'snapshots'), exist_ok=True)
if len(sys.argv) > 3 and sys.argv[2] == 'snapshot':
    shutil.copyfile(src, os.path.join(OUT, 'snapshots', 'round%s.png' % sys.argv[3]))
    print('snapshot', sys.argv[3]); sys.exit()
im = Image.open(src).convert('RGB')
assert im.size == (2160, 2700), im.size
im.save(os.path.join(OUT, '03-marsh-nocturne-4k.png'), compress_level=6)
q = 94
while True:
    p = os.path.join(OUT, '03-marsh-nocturne-x.jpg')
    im.save(p, quality=q, subsampling=0, optimize=True)
    if os.path.getsize(p) < 4.8e6 or q <= 92: break
    q -= 1
print('jpg quality', q, '%.2f MB' % (os.path.getsize(p) / 1e6))
# 100% crops: focal point, darkest area, busiest texture, an edge/corner
CROPS = {
    'focal-afterglow-and-cedars': (1000, 1350, 1000, 800),
    'darkest-foreground-marsh': (0, 2100, 900, 600),
    'busiest-skiff-and-creek': (950, 1800, 900, 700),
    'corner-top-left-sky-and-moon': (0, 0, 1000, 800),
}
for k, (x, y, w, h) in CROPS.items():
    im.crop((x, y, x + w, y + h)).save(os.path.join(OUT, 'crops', k + '.png'))
print('crops', len(CROPS))
