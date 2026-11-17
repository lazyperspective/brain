// node tools/sheet.js <fmt v|p> <scale> <out.png> <cols> <spec,spec,...> [--only a,b] [--shrink k]
//   spec: 1234 (frame) | s33.5 (film seconds) | d5.62 (film-days) | h5@19.5 (day 5 at clock 19:30)
'use strict';
const { createFilm } = require('../film.js'), { writePNG, shrink } = require('../png.js'), { at } = require('../clock.js');
const a = process.argv.slice(2), fmt = a[0], scale = +a[1], out = a[2], cols = +a[3];
let only = null, sk = 1; for (let i = 5; i < a.length; i++) { if (a[i] === '--only') only = a[++i].split(','); if (a[i] === '--shrink') sk = +a[++i]; }
const t0 = Date.now();
const film = createFilm(fmt, scale, { only, log: s => process.stderr.write('  ' + s + '\n') });
const K = film.K;
const frames = a[4].split(',').map(s => {
  if (s[0] === 's') return Math.round(parseFloat(s.slice(1)) * K.FPS) % K.F;
  if (s[0] === 'd') return Math.round(K.tauAtD(parseFloat(s.slice(1))) * K.FPS) % K.F;
  if (s[0] === 'h') { const [d, h] = s.slice(1).split('@').map(Number); return Math.round(K.tauAtD(at(d, h)) * K.FPS) % K.F; }
  return parseInt(s, 10);
});
const w0 = film.W, h0 = film.H, w = Math.floor(w0 / sk), h = Math.floor(h0 / sk), rows = Math.ceil(frames.length / cols), gap = 4;
const SW = cols * w + (cols + 1) * gap, SH = rows * h + (rows + 1) * gap, sheet = Buffer.alloc(SW * SH * 3, 30);
const tm = {}; let tt = 0;
frames.forEach((f, i) => {
  const t1 = Date.now(); film.renderFrame(f, tm); tt += Date.now() - t1;
  let rgb = film.E.toRGB(); if (sk > 1) rgb = shrink(rgb, w0, h0, sk).rgb;
  const cx = gap + (i % cols) * (w + gap), cy = gap + Math.floor(i / cols) * (h + gap);
  for (let y = 0; y < h; y++) rgb.copy(sheet, ((cy + y) * SW + cx) * 3, y * w * 3, (y + 1) * w * 3);
});
writePNG(out, sheet, SW, SH);
process.stderr.write(`sheet ${SW}x${SH}, ${frames.length} frames [${frames.join(',')}], ${(tt / frames.length).toFixed(0)} ms/frame (last: ${JSON.stringify(tm)}), total ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
