// node flashcheck.js built.js t0 t1 : frame-to-frame mean-luminance jumps over 60/255 (flash edges); reports the worst count of
// flashes (a rise and its fall count once) in any one-second window, and any bright frame held longer than one frame after a jump of 120+
const fs = require('fs');
global.window = { PIECES: [] }; eval(fs.readFileSync(require('path').resolve(process.argv[2]), 'utf8'));
const c = window.__hollow_core, L = [];
const f0 = Math.round(+process.argv[3] * 30), f1 = Math.round(+process.argv[4] * 30);
for (let f = f0; f < f1; f++) { c.render(f / 30); let s = 0, n = 0; const R = c.RGB; for (let i = 0; i < R.length; i += 21) { s += R[i] * 0.3 + R[i + 1] * 0.59 + R[i + 2] * 0.11; n++; } L.push(s / n); }
const ev = [];
for (let i = 1; i < L.length; i++) { const d = L[i] - L[i - 1]; if (Math.abs(d) > 60) { console.log(((f0 + i) / 30).toFixed(3), 'f' + (f0 + i), L[i - 1].toFixed(0), '->', L[i].toFixed(0)); ev.push([f0 + i, d]); } }
// pair a rise with the fall that follows within 3 frames (one flash); unpaired edges are cuts between a dark and a bright picture
const fl = []; for (let k = 0; k < ev.length; k++) { if (k + 1 < ev.length && ev[k + 1][0] - ev[k][0] <= 3 && Math.sign(ev[k + 1][1]) !== Math.sign(ev[k][1])) { fl.push(ev[k][0]); k++; } else fl.push(ev[k][0]); }
let worst = 0, at = 0; for (let k = 0; k < fl.length; k++) { let n = 0; for (let j = k; j < fl.length && fl[j] - fl[k] < 30; j++) n++; if (n > worst) { worst = n; at = fl[k]; } }
console.log(JSON.stringify({ frames: L.length, edges: ev.length, flashes: fl.length, worstPerSecond: worst, at: (at / 30).toFixed(2), verdict: worst <= 3 ? 'PASS' : 'FAIL' }));
