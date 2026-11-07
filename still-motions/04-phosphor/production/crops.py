# crops.py <png> <outprefix> name:x,y,w,h ...   (1:1 crops of a 2160x2700 render)
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
for spec in sys.argv[3:]:
    name, box = spec.split(':')
    x, y, w, h = map(int, box.split(','))
    im.crop((x, y, x + w, y + h)).save('%s-%s.png' % (sys.argv[2], name))
