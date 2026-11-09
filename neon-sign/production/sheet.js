// Contact sheet across the loop, and 100 % crops of a 4K frame.
//   node sheet.js sheet <out.png> [n=12]       n frames spread over the loop (1080p), 4 columns, time-stamped,
//                                              plus a strip of the sign's brightness per source
//   node sheet.js crops <frame-4k.png> <dir>   crops: sign, scaffold, facade, darkest area, reflections, roof
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const [mode, a, b] = process.argv.slice(2);
const SP = process.env.TMPDIR_SHEET || path.join(path.dirname(path.resolve(mode === 'sheet' ? a : b)), '.sheet-frames');
if (mode === 'sheet') {
  const n = +(b || 12), D = 16;
  const ts = []; for (let i = 0; i < n; i++) ts.push(+((i * D) / n).toFixed(2));
  fs.mkdirSync(SP, { recursive: true });
  execFileSync('node', [path.join(__dirname, 'render.js'), 'stills', SP, ts.join(',')], { stdio: 'inherit' });
  global.window = {}; require('../js/flicker.js'); const F = window.NS.FLICKER;
  const curves = []; for (let i = 0; i <= 480; i++) curves.push(Array.from(F.sources(i / 30)));
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
d, out, ts, curves = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4])
cols, w, h, g = 4, 480, 270, 8
rows = (len(ts) + cols - 1)//cols
S = Image.new('RGB', (cols*w + (cols+1)*g, rows*(h+18) + (rows+1)*g + 150), (12, 13, 16))
dr = ImageDraw.Draw(S)
for k, t in enumerate(ts):
    im = Image.open('%s/frame-%05.2f.png' % (d, t)).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = g + (k % cols)*(w + g), g + (k//cols)*(h + 18 + g)
    S.paste(im, (x, y)); dr.text((x + 3, y + h + 3), 't = %.2f s' % t, fill=(190, 196, 200))
# brightness of the 8 sources over the loop
names = ['N','V','I','D','I','A','eye-o','eye-i']
y0 = S.size[1] - 140; W = S.size[0] - 2*g - 50
for k in range(8):
    yy = y0 + k*17
    dr.text((g, yy), names[k], fill=(150, 160, 150))
    pts = [(g + 50 + W*i/480, yy + 14 - 13*min(1.2, c[k])/1.2) for i, c in enumerate(curves)]
    dr.line(pts, fill=(118, 185, 0), width=1)
    for tt in ts: xx = g + 50 + W*tt/16; dr.line([(xx, yy), (xx, yy + 14)], fill=(60, 60, 70))
S.save(out)
print('contact sheet', out)
`, SP, a, JSON.stringify(ts), JSON.stringify(curves)], { stdio: 'inherit' });
  for (const t of ts) fs.unlinkSync(path.join(SP, 'frame-' + t.toFixed(2).padStart(5, '0') + '.png'));
  fs.rmdirSync(SP);
} else if (mode === 'crops') {
  fs.mkdirSync(b, { recursive: true });
  // regions in 3840x2160 pixels: [x, y, w, h]
  const crops = { sign: [1240, 380, 1400, 480], scaffold: [2150, 560, 1100, 520], facade: [1500, 950, 1000, 620],
    darkest: [0, 1250, 900, 700], reflections: [3200, 300, 640, 900], roof: [1000, 1700, 1600, 460], eye: [880, 380, 760, 520] };
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
src, d, crops = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
im = Image.open(src).convert('RGB')
for k, (x, y, w, h) in crops.items(): im.crop((x, y, x + w, y + h)).save('%s/crop-%s.png' % (d, k))
print('crops in', d)
`, a, b, JSON.stringify(crops)], { stdio: 'inherit' });
} else console.log('usage: node sheet.js sheet <out.png> [n] | crops <frame-4k.png> <dir>');
