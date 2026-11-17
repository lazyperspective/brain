// node tools/chart.js out.png  — draws the year's curves so the model can be read at a glance
'use strict';
const { buildClock } = require('../clock.js'), { writePNG } = require('../png.js');
const K = buildClock(), C = K.C, F = K.F;
const rows = [['alt', -70, 75], ['ovc', 0, 1], ['rain', 0, 1], ['snowf', 0, 1], ['wind', -1.6, 1.8], ['fog', 0, 1], ['T', -10, 32], ['sun', 0, 1], ['M', 0, 1], ['wet', 0, 1], ['puddle', 0, 1.25],
  ['snow', 0, 2.5], ['snowB', 0, 1], ['SP', 0, 1.4], ['AP', 0, 1.5], ['D', 0, 6], ['G', 0, 1], ['Hg', 0, 1], ['dry', 0, 1], ['sen', 0, 1], ['frost', 0, 1], ['dew', 0, 1], ['glow', 0, 1.1], ['moonAlt', -5, 70], ['warm', 0, 1], ['dSpeed', 0, 0.02]];
const W = 1440, RH = 46, H = rows.length * RH, img = Buffer.alloc(W * H * 3, 255);
const px = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; img[i] = r; img[i + 1] = g; img[i + 2] = b; };
rows.forEach((row, ri) => {
  const y0 = ri * RH;
  for (let x = 0; x < W; x++) { px(x, y0, 200, 200, 200); const f = Math.floor(x / W * F); const dd = C.d[f]; if (Math.floor(dd) !== Math.floor(C.d[Math.max(0, Math.floor((x - 1) / W * F))])) for (let y = 0; y < RH; y++) px(x, y0 + y, 225, 225, 240); }
  const a = C[row[0]];
  for (let x = 0; x < W; x++) { const f = Math.floor(x / W * F), v = (a[f] - row[1]) / (row[2] - row[1]), y = y0 + RH - 2 - Math.round(Math.max(0, Math.min(1, v)) * (RH - 4)); for (let yy = y; yy < y0 + RH - 1; yy++) px(x, yy, yy === y ? 20 : 150, yy === y ? 40 : 170, yy === y ? 120 : 220); }
});
writePNG(process.argv[2] || 'chart.png', img, W, H);
const stat = n => { let mn = 1e9, mx = -1e9; for (let f = 0; f < F; f++) { mn = Math.min(mn, C[n][f]); mx = Math.max(mx, C[n][f]); } return n + ':' + mn.toFixed(2) + '..' + mx.toFixed(2); };
console.log(rows.map(r => stat(r[0])).join('  '));
for (let day = 0; day < K.ND; day++) { const f0 = Math.round(K.tauAtD(day) * 30), f1 = Math.round(K.tauAtD(day + 0.999) * 30); let ns = 0; for (let f = f0; f < f1; f++) if (C.alt[f] < -6) ns++; console.log('day', day, 'starts', (f0 / 30).toFixed(2) + 's', 'len', ((f1 - f0) / 30).toFixed(2) + 's', 'night', (ns / 30).toFixed(2) + 's', 'SP', C.SP[f0].toFixed(2), 'AP', C.AP[f0].toFixed(2), 'D', C.D[f0].toFixed(2), 'snow', C.snow[f0].toFixed(2), 'G', C.G[f0].toFixed(2), 'T', C.T[f0].toFixed(1), 'moon', C.moonPhase[Math.min(F-1,f0 + 60)].toFixed(2)); }
