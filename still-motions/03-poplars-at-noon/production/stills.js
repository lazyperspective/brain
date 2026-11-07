// Stills across the loop and a contact sheet, plus the 4K master and the X-ready JPEG.
//   node stills.js <outdir> [masterT]
// Writes <outdir>/stills/poplars-TT.TT.png (6 frames over the 20 s loop, full 2160x2700), stills/contact-sheet.png,
// <outdir>/03-poplars-at-noon-4k.png (at masterT) and <outdir>/03-poplars-at-noon-x.jpg (q94, 4:4:4).
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const [out, mt] = process.argv.slice(2);
const D = 20, masterT = +(mt || 0);
const ts = [0, 10 / 3, 20 / 3, 10, 40 / 3, 50 / 3].map((t) => +t.toFixed(2));
const sdir = path.join(out, 'stills');
fs.mkdirSync(sdir, { recursive: true });
const all = ts.includes(masterT) ? ts : ts.concat([masterT]);
execFileSync('node', [path.join(__dirname, 'render.js'), 'stills', sdir, all.join(',')], { stdio: 'inherit' });
const name = (t) => path.join(sdir, 'poplars-' + t.toFixed(2).padStart(5, '0') + '.png');
execFileSync('python3', ['-c', `
import sys, json, shutil
from PIL import Image, ImageDraw
sdir, out, ts, mt = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), float(sys.argv[4])
name = lambda t: '%s/poplars-%05.2f.png' % (sdir, t)
tw, th = 540, 675
ims = [Image.open(name(t)).convert('RGB').resize((tw, th), Image.LANCZOS) for t in ts]
cols = 3; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * tw + (cols + 1) * 10, rows * (th + 22) + 10), (20, 18, 16))
dr = ImageDraw.Draw(s)
for k, (im, t) in enumerate(zip(ims, ts)):
    x, y = 10 + (k % cols) * (tw + 10), 10 + (k // cols) * (th + 22)
    s.paste(im, (x, y)); dr.text((x + 2, y + th + 4), 't = %.2f s' % t, fill=(200, 196, 190))
s.save(sdir + '/contact-sheet.png')
m = Image.open(name(mt)).convert('RGB')
m.save(out + '/03-poplars-at-noon-4k.png')
m.save(out + '/03-poplars-at-noon-x.jpg', quality=94, subsampling=0, optimize=True)
print('contact sheet, 4k master and x jpeg in', out)
`, sdir, out, JSON.stringify(ts), String(masterT)], { stdio: 'inherit' });
if (!ts.includes(masterT)) fs.unlinkSync(name(masterT));
