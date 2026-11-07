// Stills across the loop, a contact sheet, and 100% crops for review.
//   node stills.js <dir> [n=6] [scale=1] [ss=1]
// Writes <dir>/still-TT.TT.jpg (q95), <dir>/contact-sheet.png (3 columns, time-stamped) and, from the first frame,
// <dir>/crop-*.png at 1:1 (only when scale = 1).
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const [dir, nArg, scArg, ssArg] = process.argv.slice(2);
const n = +(nArg || 6), D = 20, scale = +(scArg || 1), ss = +(ssArg || 1);
const ts = []; for (let i = 0; i < n; i++) ts.push(+((i * D) / n).toFixed(2));
const tmp = path.join(dir, '_png');
execFileSync('node', [path.join(__dirname, 'render.js'), 'stills', tmp, ts.join(','), String(scale), String(ss)], { stdio: 'inherit' });
fs.mkdirSync(dir, { recursive: true });
execFileSync('python3', ['-c', `
import sys, json, os
from PIL import Image, ImageDraw
d, tmp, ts, scale = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), float(sys.argv[4])
ims = []
for t in ts:
    p = '%s/still-%05.2f.png' % (tmp, t)
    im = Image.open(p).convert('RGB')
    im.save('%s/still-%05.2f.jpg' % (d, t), quality=95, subsampling=0)
    ims.append(im)
tw, th = 432, 540
cols = 3; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * tw + (cols + 1) * 10, rows * (th + 22) + 10), (14, 12, 11))
dr = ImageDraw.Draw(s)
for k, (im, t) in enumerate(zip(ims, ts)):
    x, y = 10 + (k % cols) * (tw + 10), 10 + (k // cols) * (th + 22)
    s.paste(im.resize((tw, th), Image.LANCZOS), (x, y)); dr.text((x + 2, y + th + 4), 't = %.2f s' % t, fill=(200, 196, 190))
s.save(d + '/contact-sheet.png')
if scale == 1:
    src = ims[0]
    crops = {'plate-centre': (700, 1350, 760, 620), 'peony': (420, 1180, 640, 540), 'mat-corner': (180, 1060, 520, 520), 'velvet': (700, 100, 760, 560), 'case-corner': (0, 2280, 520, 420), 'moth-edge': (560, 1750, 600, 420)}
    for k, (x, y, w, h) in crops.items(): src.crop((x, y, x + w, y + h)).save('%s/crop-%s.png' % (d, k))
for t in ts: os.remove('%s/still-%05.2f.png' % (tmp, t))
os.rmdir(tmp)
print('stills, contact sheet' + (' and crops' if scale == 1 else '') + ' in', d)
`, dir, tmp, JSON.stringify(ts), String(scale)], { stdio: 'inherit' });
