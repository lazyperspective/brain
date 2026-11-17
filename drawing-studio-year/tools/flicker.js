// node tools/flicker.js <fmt> <scale> <from> <to> <out.csv>
// Draws a run of frames small and measures how much each differs from the one before:
// a pop, a flicker or a seam shows up as a spike. (The last frame is also compared with frame 0 when to == F.)
'use strict';
const fs = require('fs'), { createFilm } = require('../film.js');
const [fmt, sc, a, b, out] = process.argv.slice(2);
const film = createFilm(fmt, +sc, { log: () => {} }), F = film.F, from = +a, to = +b;
const N = film.W * film.H * 3; let prev = null; const rows = [];
const bands = 6, bh = Math.ceil(film.H / bands);
for (let f = from; f <= to; f++) {
  film.renderFrame(f % F); const cur = Buffer.from(film.E.toRGB());
  if (prev) { const s = new Float64Array(bands); let mx = 0; for (let y = 0; y < film.H; y++) { let r = 0; const o = y * film.W * 3; for (let i = 0; i < film.W * 3; i++) { const d = Math.abs(cur[o + i] - prev[o + i]); r += d; } s[(y / bh) | 0] += r; }
    let tot = 0; for (let k = 0; k < bands; k++) tot += s[k];
    rows.push([f % F, (tot / N).toFixed(3)].concat(Array.from(s, v => (v / (bh * film.W * 3)).toFixed(3))).join(',')); }
  prev = cur;
}
fs.writeFileSync(out, rows.join('\n') + '\n');
