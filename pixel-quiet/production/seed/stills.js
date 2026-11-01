// Look-development stills of "The Seed and the Stone" straight from the piece's core (no browser).
//   node stills.js <out-%t.png> t1,t2,...        frames at 3× nearest-neighbour (SCALE=n to change)
//   CROP=x,y,w,h SCALE=6 node stills.js ...       a crop of the 360 × 450 art, scaled
//   SHEET=out.png node stills.js ...              also tile the frames into a contact sheet
// Prints the core's ms per frame (Node, not the browser; see render.js for Chromium timings).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [out, tArg] = process.argv.slice(2);
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/06-the-seed-and-the-stone.js'), 'utf8'));
const E = window.__seedCore;
let t0 = Date.now(); E.build(); console.log('build', Date.now() - t0, 'ms');
const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null, sc = +(process.env.SCALE || 3);
const outs = [];
for (const t of String(tArg || '0').split(',').map(Number)) {
  t0 = process.hrtime.bigint(); E.render(t); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const o = out.replace('%t', t.toFixed(2).padStart(5, '0')), raw = o + '.rgb';
  const buf = Buffer.alloc(E.W * E.H * 3);
  for (let i = 0; i < E.W * E.H; i++) { const p = E.PAL[E.OUT[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
  fs.writeFileSync(raw, buf);
  const vf = (crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : '') + `scale=iw*${sc}:ih*${sc}:flags=neighbor`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${E.W}x${E.H}`, '-i', raw, '-vf', vf, o]);
  fs.unlinkSync(raw); outs.push(o);
  console.log(o, 't=' + t, ms.toFixed(1) + 'ms');
}
if (process.env.SHEET) {
  const cols = +(process.env.COLS || 4);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[3:]; cols = int(sys.argv[2])
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * h + (rows + 1) * 6), (14, 14, 18))
for k, im in enumerate(ims): s.paste(im, (6 + (k % cols) * (w + 6), 6 + (k // cols) * (h + 6)))
s.save(sys.argv[1])`, process.env.SHEET, String(cols), ...outs]);
  console.log('sheet', process.env.SHEET);
}
