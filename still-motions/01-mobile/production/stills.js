// Stills across the loop and a contact sheet.   node stills.js <dir> [n=6]
// Writes <dir>/01-mobile-tTT.TT.png (1080x1350, supersampled) and <dir>/contact-sheet.png (3 x 2, time-stamped).
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const [dir, nArg] = process.argv.slice(2);
const n = +(nArg || 6), D = 20, ts = [];
for (let i = 0; i < n; i++) ts.push(+((i * D) / n).toFixed(2));
execFileSync('node', [path.join(__dirname, 'render.js'), 'stills', dir, ts.join(','), '1'], { stdio: 'inherit' });
for (const t of ts) { const a = path.join(dir, `mobile-hd-t${t.toFixed(2).padStart(5, '0')}.png`); fs.renameSync(a, path.join(dir, `01-mobile-t${t.toFixed(2).padStart(5, '0')}.png`)); }
execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
d, ts = sys.argv[1], json.loads(sys.argv[2])
ims = [Image.open('%s/01-mobile-t%05.2f.png' % (d, t)).convert('RGB').resize((360, 450), Image.LANCZOS) for t in ts]
cols = 3; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * 360 + (cols + 1) * 10, rows * 450 + (rows + 1) * 10 + rows * 18), (27, 26, 28))
dr = ImageDraw.Draw(s)
for k, (im, t) in enumerate(zip(ims, ts)):
    x, y = 10 + (k % cols) * 370, 10 + (k // cols) * 478
    s.paste(im, (x, y)); dr.text((x + 2, y + 453), 't = %.2f s' % t, fill=(200, 196, 190))
s.save(d + '/contact-sheet.png')
print('contact sheet', d + '/contact-sheet.png')
`, dir, JSON.stringify(ts)], { stdio: 'inherit' });
