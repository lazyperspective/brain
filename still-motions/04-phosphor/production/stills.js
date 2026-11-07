// Stills across the loop and a contact sheet.   node stills.js <dir> [n=6]
// Writes <dir>/phosphor-TT.TT.png (2160x2700) and <dir>/contact-sheet.png (3 columns, time-stamped).
const path = require('path'), { execFileSync } = require('child_process');
const [dir, nArg] = process.argv.slice(2);
const n = +(nArg || 6), D = 18;
const ts = [];
for (let i = 0; i < n; i++) ts.push(+((i * D) / n + 0.5).toFixed(2));
execFileSync('node', [path.join(__dirname, 'render.js'), 'stills', dir, ts.join(',')], { stdio: 'inherit' });
execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
d, ts = sys.argv[1], json.loads(sys.argv[2])
ims = [Image.open('%s/phosphor-%05.2f.png' % (d, t)).convert('RGB').resize((540, 675), Image.LANCZOS) for t in ts]
cols = 3; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * 540 + (cols + 1) * 10, rows * 675 + (rows + 1) * 10 + rows * 20), (12, 14, 13))
dr = ImageDraw.Draw(s)
for k, (im, t) in enumerate(zip(ims, ts)):
    x, y = 10 + (k % cols) * 550, 10 + (k // cols) * 705
    s.paste(im, (x, y)); dr.text((x + 2, y + 679), 't = %.2f s' % t, fill=(190, 200, 192))
s.save(d + '/contact-sheet.png')
print('contact sheet in', d)
`, dir, JSON.stringify(ts)], { stdio: 'inherit' });
