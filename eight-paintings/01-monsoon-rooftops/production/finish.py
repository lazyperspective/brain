# python3 finish.py <outdir> <name> : JPEG (q93, 4:4:4) + four 100% crops from the 4K master
import sys, os
from PIL import Image
out, name = sys.argv[1], sys.argv[2]
crops = [tuple(map(int, c.split(','))) for c in sys.argv[3:]]  # label:x,y pairs given as x,y (top-left, 4K px)
im = Image.open(os.path.join(out, name + '-4k.png')).convert('RGB')
assert im.size == (2160, 2700), im.size
jp = os.path.join(out, name + '-x.jpg')
im.save(jp, 'JPEG', quality=93, subsampling=0, optimize=True)
print('jpg MB', round(os.path.getsize(jp) / 1e6, 2))
os.makedirs(os.path.join(out, 'crops'), exist_ok=True)
labels = ['focal', 'darkest', 'busiest', 'edge']
for lab, (x, y) in zip(labels, crops):
    im.crop((x, y, x + 1080, y + 1080)).save(os.path.join(out, 'crops', f'{name}-crop-{lab}.png'))
