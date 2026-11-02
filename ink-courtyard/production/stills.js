// Stills, a contact sheet and full-resolution crops of "The Moon Gate".
//   node stills.js <dir> [n=9]          n frames spread evenly over the loop (plus the crops from one of them)
//   CROPT=9 node stills.js <dir>        which frame the crops come from (default 9 s)
// Writes <dir>/courtyard-TT.TT.png, <dir>/contact-sheet.png (3 columns, quarter size, time-stamped) and
// <dir>/crop-{door,flowers,plaster,roof,steps,moon}.png (1:1 pixels).
const path = require('path'), { execFileSync } = require('child_process');
const [dir, nArg] = process.argv.slice(2);
const n = +(nArg || 9), D = 28, cropT = +(process.env.CROPT || 9);
const ts = [];
for (let i = 0; i < n; i++) ts.push(+((i * D) / n).toFixed(2));
if (!ts.includes(cropT)) ts.push(cropT);
execFileSync('node', [path.join(__dirname, 'render.js'), 'stills', dir, ts.join(',')], { stdio: 'inherit' });
const name = (t) => path.join(dir, 'courtyard-' + t.toFixed(2).padStart(5, '0') + '.png');
const crops = { door: [380, 1000, 540, 540], flowers: [0, 420, 600, 600], plaster: [700, 780, 380, 560], roof: [500, 600, 580, 260], steps: [250, 1480, 720, 420], moon: [560, 200, 460, 400] };
execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
d, cropT, ts, crops = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4])
name = lambda t: '%s/courtyard-%05.2f.png' % (d, t)
ims = [Image.open(name(t)).convert('RGB').resize((270, 480), Image.LANCZOS) for t in ts[:${n}]]
cols = 3; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * 270 + (cols + 1) * 8, rows * 480 + (rows + 1) * 8 + rows * 18), (18, 16, 19))
dr = ImageDraw.Draw(s)
for k, (im, t) in enumerate(zip(ims, ts)):
    x, y = 8 + (k % cols) * 278, 8 + (k // cols) * 506
    s.paste(im, (x, y)); dr.text((x + 2, y + 484), 't = %.2f s' % t, fill=(200, 196, 190))
s.save(d + '/contact-sheet.png')
src = Image.open(name(float(cropT))).convert('RGB')
for k, (x, y, w, h) in crops.items(): src.crop((x, y, x + w, y + h)).save('%s/crop-%s.png' % (d, k))
print('contact sheet and crops in', d)
`, dir, String(cropT), JSON.stringify(ts), JSON.stringify(crops)], { stdio: 'inherit' });
