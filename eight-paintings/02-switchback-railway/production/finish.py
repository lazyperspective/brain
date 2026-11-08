# python3 production/finish.py <outdir>
# From <outdir>/02-switchback-railway-4k.png make the X jpeg (q94, 4:4:4) and four 100% crops.
import sys, os
from PIL import Image

out = sys.argv[1]
name = '02-switchback-railway'
master = Image.open(os.path.join(out, name + '-4k.png')).convert('RGB')
assert master.size == (2160, 2700), master.size

jpg = os.path.join(out, name + '-x.jpg')
for q in (95, 94, 93, 92):
    master.save(jpg, 'JPEG', quality=q, subsampling=0, optimize=True)
    if os.path.getsize(jpg) < 4.8e6:
        break
print('jpeg', q, os.path.getsize(jpg))

# 100% crops (native pixel = 5x5 block in the master)
os.makedirs(os.path.join(out, 'crops'), exist_ok=True)
crops = {
    'focal-train-and-plume': (560, 1080, 1100, 1100),   # loco, plume, falls bridge
    'darkest-gorge-and-mist': (0, 1650, 1100, 1050),     # shadowed slope, fog ranks, foreground spruce
    'busiest-station-and-slope': (1260, 900, 900, 900),  # station, stationmaster, lamp, forest
    'edge-corner-sky-and-peaks': (0, 0, 1100, 950),      # top-left corner: moon, glow, backlit peaks
}
for k, (x, y, w, h) in crops.items():
    master.crop((x, y, x + w, y + h)).save(os.path.join(out, 'crops', k + '.png'))
print('crops', list(crops))
