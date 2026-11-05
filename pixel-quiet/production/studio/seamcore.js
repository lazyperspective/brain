// The loop seam measured on the picture itself (the core's exact palette pixels, no video codec): is the step from the
// last frame back to frame 0 any bigger than an ordinary frame-to-frame step? Same metric as seamcheck.js (mean
// absolute RGB difference, 0-255), at 30 fps.   node seamcore.js
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/07-the-little-studio.js'), 'utf8'));
const E = window.__studioCore; E.build();
const N = Math.round(E.D * 30), S = E.W * E.H;
const frame = (f) => { E.render(f / 30); const o = new Uint8Array(S * 3); for (let i = 0; i < S; i++) { const p = E.PAL[E.OUT[i]]; o[i * 3] = p[0]; o[i * 3 + 1] = p[1]; o[i * 3 + 2] = p[2]; } return o; };
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const first = frame(0); let prev = first; const d = [];
for (let f = 1; f < N; f++) { const cur = frame(f); d.push(diff(prev, cur)); prev = cur; }
const seam = diff(prev, first), sorted = d.slice().sort((a, b) => a - b);
const near = d.slice(0, 15).concat(d.slice(d.length - 15));
console.log(`core: ${N} frames; seam step ${seam.toFixed(3)}; ordinary steps median ${sorted[sorted.length >> 1].toFixed(3)}, 95th pct ${sorted[Math.floor(sorted.length * 0.95)].toFixed(3)}, max ${sorted[sorted.length - 1].toFixed(3)}; within 0.5 s of the seam: max ${Math.max(...near).toFixed(3)}`);
console.log(seam <= Math.max(...near) * 1.25 ? 'PASS  seam step is an ordinary step (exact pixels)' : 'CHECK seam step stands out');
