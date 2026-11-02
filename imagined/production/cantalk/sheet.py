#!/usr/bin/env python3
"""Tile PNG frames into a labelled contact sheet.
    python3 sheet.py <out.png> <cols> <scale> <frame.png ...>
Each tile is the frame scaled by <scale> (e.g. 0.25), labelled with the time parsed from its file name."""
import re
import sys
from PIL import Image, ImageDraw

out, cols, sc = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = int(ims[0].width * sc), int(ims[0].height * sc)
rows = (len(ims) + cols - 1) // cols
pad, lab = 6, 16
s = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * (h + lab) + (rows + 1) * pad), (14, 14, 18))
d = ImageDraw.Draw(s)
for k, (im, f) in enumerate(zip(ims, fs)):
    x, y = pad + (k % cols) * (w + pad), pad + (k // cols) * (h + lab + pad)
    s.paste(im.resize((w, h), Image.LANCZOS if sc < 1 else Image.NEAREST), (x, y + lab))
    m = re.search(r'(\d+\.\d+)\.png$', f) or re.search(r'(\d+)\.png$', f)
    d.text((x + 2, y + 2), ('t=' + m.group(1)) if m else f, fill=(220, 210, 190))
s.save(out)
print(out, s.size)
