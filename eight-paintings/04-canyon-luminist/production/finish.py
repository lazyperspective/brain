# python3 production/finish.py <outdir> [name]
# From <outdir>/<name>-4k.png: the X JPEG (q93, 4:4:4) and four 100% crops (1080x1080).
import sys, os
from PIL import Image
out = sys.argv[1]
name = sys.argv[2] if len(sys.argv) > 2 else '04-canyon-luminist'
im = Image.open(os.path.join(out, name + '-4k.png')).convert('RGB')
assert im.size == (2160, 2700), im.size
jp = os.path.join(out, name + '-x.jpg')
q = 94
while True:
    im.save(jp, 'JPEG', quality=q, subsampling=0, optimize=True)
    if os.path.getsize(jp) < 4.8e6 or q <= 92:
        break
    q -= 1
print('jpg q', q, 'MB', round(os.path.getsize(jp) / 1e6, 2))
os.makedirs(os.path.join(out, 'crops'), exist_ok=True)
CROPS = {
    'focal': (520, 980),     # sunbeams across the lit temple, ravens
    'darkest': (0, 1620),    # shadowed shoulder and the misted chasm
    'busiest': (1080, 1620), # juniper trunk, slabs, figure at the brink
    'edge': (1080, 0),       # top-right corner: storm deck
}
for lab, (x, y) in CROPS.items():
    im.crop((x, y, x + 1080, y + 1080)).save(os.path.join(out, 'crops', f'{name}-crop-{lab}.png'))
print('crops done')
