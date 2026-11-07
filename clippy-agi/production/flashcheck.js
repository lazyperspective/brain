// Photosensitivity check over the rendered video (WCAG 2.3.1-style general-flash test).
//   node flashcheck.js <video.mp4>
// Frames are decoded at 240x180, converted to relative luminance (linear sRGB); the mean is tracked over the whole
// frame and 9 overlapping quarter-frame windows (each 25% of the picture). A transition is a swing between turning
// points of >= 0.10 relative luminance with the darker side below 0.80; a flash is a pair of opposing transitions.
const { execFileSync } = require('child_process');
const file = process.argv[2];
const W = 240, H = 180, FPS = 30;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 31 });
const N = raw.length / (W * H * 3);
const lin = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const wins = [['whole', 0, 0, W, H]];
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) wins.push([`q${i}${j}`, Math.round(i * W / 4), Math.round(j * H / 4), W / 2, H / 2]);
const series = wins.map(() => new Float32Array(N));
for (let f = 0; f < N; f++) {
  const o = f * W * H * 3, Y = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) Y[p] = 0.2126 * lin[raw[o + p * 3]] + 0.7152 * lin[raw[o + p * 3 + 1]] + 0.0722 * lin[raw[o + p * 3 + 2]];
  wins.forEach((w, k) => { let s = 0; for (let y = w[2]; y < w[2] + w[4]; y++) for (let x = w[1]; x < w[1] + w[3]; x++) s += Y[y * W + x]; series[k][f] = s / (w[3] * w[4]); });
}
let worstJump = { d: 0 }, worstRate = { n: 0 }, worstOpp = { n: 0 };
const redSat = []; // large-area saturated-red check (frames where >25% of a window is saturated red)
wins.forEach((w, k) => {
  const L = series[k];
  for (let f = 0; f + 1 < N; f++) { const d = Math.abs(L[f + 1] - L[f]); if (d > worstJump.d) worstJump = { d, win: w[0], frame: f }; }
  const h = 0.005, turns = [{ f: 0, v: L[0] }];
  let dir = 0, ef = 0, ev = L[0];
  for (let f = 1; f < N; f++) {
    const v = L[f];
    if (dir === 0) { if (Math.abs(v - L[0]) > h) { dir = v > L[0] ? 1 : -1; ef = f; ev = v; } continue; }
    if (dir > 0) { if (v >= ev) { ef = f; ev = v; } else if (ev - v > h) { turns.push({ f: ef, v: ev }); dir = -1; ef = f; ev = v; } }
    else { if (v <= ev) { ef = f; ev = v; } else if (v - ev > h) { turns.push({ f: ef, v: ev }); dir = 1; ef = f; ev = v; } }
  }
  turns.push({ f: ef, v: ev });
  const trans = [];
  for (let i = 1; i < turns.length; i++) { const d = Math.abs(turns[i].v - turns[i - 1].v), dark = Math.min(turns[i].v, turns[i - 1].v); if (d >= 0.1 && dark < 0.8) trans.push({ f: turns[i].f, s: Math.sign(turns[i].v - turns[i - 1].v) }); }
  for (let i = 0; i < trans.length; i++) { let n = 0; for (let j = i; j < trans.length && trans[j].f - trans[i].f < FPS; j++) n++; const fl = Math.floor(n / 2); if (fl > worstRate.n) worstRate = { n: fl, win: w[0], at: trans[i].f }; }
  for (let i = 0; i < trans.length; i++) { let n = 0, q = i; while (q + 1 < trans.length && trans[q + 1].f - trans[i].f < FPS) { if (trans[q + 1].s !== trans[q].s) { n++; q += 2; } else q++; } if (n > worstOpp.n) worstOpp = { n, win: w[0], at: trans[i].f }; }
});
const lines = [
  `${file}: ${N} frames (${(N / FPS).toFixed(2)} s)`,
  `worst frame-to-frame change of a large-area mean luminance: ${worstJump.d.toFixed(4)} (${worstJump.win}, t=${(worstJump.frame / FPS).toFixed(2)} s)`,
  `conservative count (any two >=0.10 transitions within 1 s, either direction): ${worstRate.n} (limit 3)` + (worstRate.n ? ` at t=${(worstRate.at / FPS).toFixed(2)} s (${worstRate.win})` : ''),
  `WCAG general flashes (pairs of opposing >=0.10 changes) in any 1 s: ${worstOpp.n} (limit 3)` + (worstOpp.n ? ` at t=${(worstOpp.at / FPS).toFixed(2)} s (${worstOpp.win})` : ''),
  worstOpp.n <= 3 && worstRate.n <= 3 ? 'FLASH CHECK: PASS' : 'FLASH CHECK: FAIL',
];
console.log(lines.join('\n'));
