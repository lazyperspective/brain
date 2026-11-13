// node tools/swatch.js  -- a test sheet for the five tools (writes ../still-warm-output/work/swatch.png)
const fs = require('fs'), path = require('path');
require('../js/engine.js');
const { png } = require('../render.js');
const A = globalThis.ART, P = A.P, M = A.MED;
const W = 1920, H = 1080, C = new A.Sheet(W, H, 7), R = A.rng(3);
const t0 = Date.now();
const cols = [[0.11, 0.12, 0.24], [0.72, 0.40, 0.28], [0.96, 0.74, 0.52], [0.80, 0.85, 0.35], [0.93, 0.66, 0.66]];
// rows of pastel sweeps at rising pressure
for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) C.stroke(P.line(R, 40 + q * 150, 40 + r * 34, 170 + q * 150, 44 + r * 34, 1.2), { w: 22, c: cols[r], m: M.pastel, p: 0.3 + q * 0.13 });
// pencil hatching
for (let q = 0; q < 6; q++) for (let i = 0; i < 40; i++) { const x = 40 + q * 150 + i * 3.2; C.stroke(P.line(R, x, 260, x + 16, 225, 0.4), { w: 1.1, c: [0.15, 0.17, 0.35], m: M.pencil, p: 0.35 + q * 0.12 }); }
for (let q = 0; q < 6; q++) for (let i = 0; i < 40; i++) { const x = 40 + q * 150 + i * 3.2; C.stroke(P.line(R, x, 310, x + 16, 275, 0.4), { w: 1.1, c: [0.85, 0.25, 0.12], m: M.pencil, p: 0.35 + q * 0.12 }); }
// charcoal + chalk lines
for (let q = 0; q < 6; q++) { C.stroke(P.line(R, 40 + q * 150, 340, 170 + q * 150, 350, 1), { w: 1.2 + q * 0.6, c: [0.1, 0.09, 0.09], m: M.char, p: 0.75 }); C.stroke(P.line(R, 40 + q * 150, 365, 170 + q * 150, 372, 1), { w: 1.2 + q * 0.6, c: [0.97, 0.96, 0.92], m: M.chalk, p: 0.75 }); }
// a dark field, chalk + gold on it, then smudge and erase
for (let i = 0; i < 30; i++) C.stroke(P.line(R, 40 + R() * 20, 400 + i * 9, 900 + R() * 30, 400 + i * 9 + R() * 6, 1.5), { w: 18, c: R.pick([[0.11, 0.12, 0.24], [0.25, 0.22, 0.42], [0.09, 0.20, 0.30]]), m: M.pastel, p: 0.6 + R() * 0.3 });
for (let i = 0; i < 12; i++) C.stroke(P.circle(R, 120 + i * 60, 470, 16), { w: 1.3, c: [0.97, 0.96, 0.92], m: M.chalk, p: 0.8 });
C.stroke(P.spline([[60, 560], [200, 520], [330, 590], [520, 540], [700, 600], [880, 550]], 4), { w: 5, c: [0.42, 0.17, 0.16], m: M.conte, p: 0.9 });
C.stroke(P.spline([[60, 560], [200, 520], [330, 590], [520, 540], [700, 600], [880, 550]], 4), { w: 3, c: [0.86, 0.66, 0.22], m: M.gold, p: 0.95 });
for (let i = 0; i < 8; i++) C.smudge(P.line(R, 500 + i * 30, 640, 560 + i * 30, 420, 2), 14, 0.14);
for (let i = 0; i < 8; i++) C.erase(P.line(R, 720 + i * 22, 650, 790 + i * 22, 410, 2), { w: 24, p: 0.7, s: 0.6 });
console.log('ms', Date.now() - t0, 'strokes', C.count);
fs.mkdirSync(path.resolve(__dirname, '../../still-warm-output/work'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, '../../still-warm-output/work/swatch.png'), png(W, H, C.finish()));
