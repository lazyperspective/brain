// Quick stills straight from the piece's canvas-free core (no browser), for look-development.
//   node stills.js <out-%t.png> t1,t2,...            full 1080 × 1350 composite (pixels 3× + soft light)
//   MODE=art SCALE=6 CROP=x,y,w,h node stills.js ...   the quantised pixel layer only, cropped (art px), nearest ×SCALE
//   MODE=light node stills.js ...                       the soft light layer only (360 × 450, ×3 bilinear)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [out, tArg] = process.argv.slice(2);
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../js/pieces/01-still-point.js'), 'utf8'));
const E = window.__stillpointCore;
let t0 = Date.now(); E.build(); console.log('build', Date.now() - t0, 'ms');
const mode = process.env.MODE || 'full';
for (const t of String(tArg || '0').split(',').map(Number)) {
  t0 = Date.now(); E.render(t); const ms = Date.now() - t0;
  const o = out.replace('%t', t.toFixed(2).padStart(5, '0')), raw = o + '.rgb';
  let w, h, buf, vf = null;
  if (mode === 'art') {
    w = E.W; h = E.H; buf = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) { const p = E.PAL[E.OUT[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
    const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null, sc = +(process.env.SCALE || 3);
    vf = (crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : '') + `scale=iw*${sc}:ih*${sc}:flags=neighbor`;
  } else if (mode === 'light') {
    w = E.W; h = E.H; buf = Buffer.from(E.LOUT); vf = 'scale=iw*3:ih*3:flags=bilinear';
  } else {
    w = E.W * 3; h = E.H * 3; buf = Buffer.alloc(w * h * 3);
    const t1 = Date.now(); E.composite(3, buf); console.log('composite', Date.now() - t1, 'ms');
  }
  fs.writeFileSync(raw, buf);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', raw, ...(vf ? ['-vf', vf] : []), o]);
  fs.unlinkSync(raw);
  console.log(o, 'frame', ms + 'ms');
}
