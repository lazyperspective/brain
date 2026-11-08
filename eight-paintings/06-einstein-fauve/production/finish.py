# JPEG for X (4:4:4, q93-95, < 4.8 MB) and four 100% crops from the master.
import sys, os
from PIL import Image
png, out, slug = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(png).convert('RGB')
assert im.size == (2160, 2700), im.size
jpg = os.path.join(out, slug + '-x.jpg')
for q in (95, 94, 93):
    im.save(jpg, 'JPEG', quality=q, subsampling=0, optimize=True)
    if os.path.getsize(jpg) < 4.8e6:
        break
print('jpeg', q, os.path.getsize(jpg))
crops = {
    'focal-eyes': (700, 960, 1500, 1460),       # the eyes, brows and nose bridge
    'darkest-jacket': (60, 2150, 860, 2650),     # deepest blues of the coat
    'busiest-hair': (180, 560, 980, 1060),        # the lit hair mass
    'edge-corner': (1560, 0, 2160, 500),           # top-right corner, background at the edge
}
for name, box in crops.items():
    im.crop(box).save(os.path.join(out, 'crops', name + '.png'))
