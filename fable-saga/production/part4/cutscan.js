// node cutscan.js BUILT t0 t1 : real cuts — frames whose colour histogram jumps (camera moves and shake keep the
// histogram; a cut, or a flash, changes it). One-frame flashes (the histogram returns next frame) are reported apart.
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] }; eval(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
const E = window.__sunderer_core, { BUF, W, H } = E, t0 = +process.argv[3], t1 = +process.argv[4];
const hist = () => { const h = new Float32Array(256); let n = 0; for (let y = 30; y < H - 30; y += 2) for (let x = 0; x < W; x += 2) { h[BUF[y * W + x]]++; n++; } for (let i = 0; i < 256; i++) h[i] /= n; return h; };
const d = (a, b) => { let s = 0; for (let i = 0; i < 256; i++) s += Math.abs(a[i] - b[i]); return s / 2; };
const HS = [];
for (let f = Math.round(t0 * 30); f < Math.round(t1 * 30); f++) { E.render(f / 30); HS.push([f / 30, hist()]); }
const cuts = [], flashes = [];
for (let i = 1; i < HS.length - 1; i++) {
  const a = d(HS[i - 1][1], HS[i][1]); if (a < 0.45) continue;
  // a flash: the frame after looks like the frame before again
  if (d(HS[i - 1][1], HS[i + 1][1]) < 0.3 || (i + 2 < HS.length && d(HS[i - 1][1], HS[i + 2][1]) < 0.3)) { flashes.push(+HS[i][0].toFixed(2)); continue; }
  if (i > 1 && cuts.length && HS[i][0] - cuts[cuts.length - 1] < 0.05) continue;
  cuts.push(+HS[i][0].toFixed(2));
}
console.log(JSON.stringify({ cuts }));
