# Viewing helpers for the critique: a downscaled overview and 100% crops.
#   python3 look.py overview <png> <out.jpg> [width]
#   python3 look.py crop <png> <out.png> x y w h
import sys
from PIL import Image
mode = sys.argv[1]
im = Image.open(sys.argv[2]).convert('RGB')
if mode == 'overview':
    w = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(sys.argv[3], quality=92)
elif mode == 'crop':
    x, y, w, h = map(int, sys.argv[4:8])
    im.crop((x, y, x + w, y + h)).save(sys.argv[3])
