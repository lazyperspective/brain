// Photosensitivity check over a rendered video (WCAG 2.3.1-style general-flash test).
//   node flashcheck.js <video.mp4>
// Decodes every frame at the 216x270 art resolution, converts to relative luminance (linear sRGB), and
// tracks the mean over the whole frame and over 9 overlapping quarter-frame windows (each 25% of the
// picture, i.e. far larger than WCAG's "25% of a 10-degree field"). A transition is a swing between
// turning points of >= 0.10 relative luminance with the darker side below 0.80; a flash is a pair of
// opposing transitions. Reports the worst frame-to-frame jump, the largest swing, and flashes per second.
const { execFileSync } = require('child_process');
const file = process.argv[2];
const W = 216, H = 270;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
const N = raw.length / (W * H * 3);
const lin = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const wins = [['whole', 0, 0, W, H]];
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) wins.push([`q${i}${j}`, Math.round(i * W / 4), Math.round(j * H / 4), Math.round(W / 2), Math.round(H / 2)]);
const series = wins.map(() => new Float32Array(N));
for (let f = 0; f < N; f++) {
  const o = f * W * H * 3;
  const Y = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) Y[p] = 0.2126 * lin[raw[o + p * 3]] + 0.7152 * lin[raw[o + p * 3 + 1]] + 0.0722 * lin[raw[o + p * 3 + 2]];
  wins.forEach((w, k) => { let s = 0; for (let y = w[2]; y < w[2] + w[4]; y++) for (let x = w[1]; x < w[1] + w[3]; x++) s += Y[y * W + x]; series[k][f] = s / (w[3] * w[4]); });
}
let worstJump = { d: 0 }, worstSwing = { d: 0 }, worstRate = { n: 0 };
wins.forEach((w, k) => {
  const L = series[k];
  for (let f = 0; f < N; f++) { const d = Math.abs(L[(f + 1) % N] - L[f]); if (d > worstJump.d) worstJump = { d, win: w[0], frame: f }; } // includes the loop seam
  // turning points (local extremes) with a small hysteresis so noise is not counted as reversals
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
  for (let i = 1; i < turns.length; i++) {
    const d = Math.abs(turns[i].v - turns[i - 1].v), dark = Math.min(turns[i].v, turns[i - 1].v);
    if (d > worstSwing.d) worstSwing = { d, win: w[0], from: turns[i - 1].f, to: turns[i].f };
    if (d >= 0.1 && dark < 0.8) trans.push(turns[i].f);
  }
  for (let i = 0; i < trans.length; i++) { let n = 0; for (let j = i; j < trans.length && trans[j] - trans[i] < 30; j++) n++; const flashes = Math.floor(n / 2); if (flashes > worstRate.n) worstRate = { n: flashes, win: w[0], at: trans[i] }; }
});
const mean = series[0].reduce((a, b) => a + b, 0) / N;
console.log(`${file}: ${N} frames, mean relative luminance ${mean.toFixed(4)}`);
console.log(`worst frame-to-frame change of a large-area mean: ${worstJump.d.toFixed(4)} (${worstJump.win}, frame ${worstJump.frame})`);
console.log(`largest single swing between turning points: ${worstSwing.d.toFixed(4)} (${worstSwing.win}, frames ${worstSwing.from}-${worstSwing.to}, ${((worstSwing.to - worstSwing.from) / 30).toFixed(2)} s)`);
console.log(`general flashes (>=0.10 swing pairs) in any 1 s: ${worstRate.n} (limit 3)` + (worstRate.n ? ` at frame ${worstRate.at} (${worstRate.win})` : ''));
console.log(worstRate.n <= 3 ? 'PASS' : 'FAIL');
