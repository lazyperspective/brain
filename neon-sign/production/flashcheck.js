// Photosensitivity check over a rendered video (WCAG 2.3.1-style general-flash test), 16:9.
//   node flashcheck.js <video.mp4>
// Decodes every frame at 384x216, converts to relative luminance (linear sRGB) and follows the mean luminance of
//   - the whole frame,
//   - the sign region (the lit letters, emblem and their glow: x 20-80 %, y 10-38 % of the frame),
//   - nine overlapping quarter-frame windows (each 25 % of the picture).
// A transition is a swing between turning points of >= 0.10 relative luminance with the darker side below 0.80;
// a flash is a pair of opposing transitions. Reports, per window, the worst frame-to-frame jump, the largest swing
// and the flashes in any 1 s; and, for the sign region, also swings of >= 0.05 (half the threshold) as a margin.
const { execFileSync } = require('child_process');
const file = process.argv[2];
const W = 384, H = 216, FPS = 30;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
const N = raw.length / (W * H * 3);
const lin = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const wins = [['whole frame', 0, 0, W, H], ['sign region', Math.round(0.2 * W), Math.round(0.10 * H), Math.round(0.6 * W), Math.round(0.28 * H)]];
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) wins.push([`quarter ${i}${j}`, Math.round(i * W / 4), Math.round(j * H / 4), Math.round(W / 2), Math.round(H / 2)]);
const series = wins.map(() => new Float32Array(N));
for (let f = 0; f < N; f++) {
  const o = f * W * H * 3;
  const Y = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) Y[p] = 0.2126 * lin[raw[o + p * 3]] + 0.7152 * lin[raw[o + p * 3 + 1]] + 0.0722 * lin[raw[o + p * 3 + 2]];
  wins.forEach((w, k) => { let s = 0; for (let y = w[2]; y < w[2] + w[4]; y++) for (let x = w[1]; x < w[1] + w[3]; x++) s += Y[y * W + x]; series[k][f] = s / (w[3] * w[4]); });
}
function analyse(L, thr) {
  const h = 0.004, turns = [{ f: 0, v: L[0] }];
  let dir = 0, ef = 0, ev = L[0];
  for (let f = 1; f < N; f++) {
    const v = L[f];
    if (dir === 0) { if (Math.abs(v - L[0]) > h) { dir = v > L[0] ? 1 : -1; ef = f; ev = v; } continue; }
    if (dir > 0) { if (v >= ev) { ef = f; ev = v; } else if (ev - v > h) { turns.push({ f: ef, v: ev }); dir = -1; ef = f; ev = v; } }
    else { if (v <= ev) { ef = f; ev = v; } else if (v - ev > h) { turns.push({ f: ef, v: ev }); dir = 1; ef = f; ev = v; } }
  }
  turns.push({ f: ef, v: ev });
  let swing = { d: 0 };
  const trans = [];
  for (let i = 1; i < turns.length; i++) {
    const d = Math.abs(turns[i].v - turns[i - 1].v), dark = Math.min(turns[i].v, turns[i - 1].v);
    if (d > swing.d) swing = { d, from: turns[i - 1].f, to: turns[i].f };
    if (d >= thr && dark < 0.8) trans.push({ f: turns[i].f, s: Math.sign(turns[i].v - turns[i - 1].v) });
  }
  let opp = { n: 0 };
  for (let i = 0; i < trans.length; i++) {
    let n = 0, k = i;
    while (k + 1 < trans.length && trans[k + 1].f - trans[i].f < FPS) { if (trans[k + 1].s !== trans[k].s) { n++; k += 2; } else k++; }
    if (n > opp.n) opp = { n, at: trans[i].f };
  }
  let jump = { d: 0 };
  for (let f = 0; f < N; f++) { const d = Math.abs(L[(f + 1) % N] - L[f]); if (d > jump.d) jump = { d, f }; }
  return { swing, trans: trans.length, opp, jump };
}
const out = [];
out.push(`${file}: ${N} frames at ${FPS} fps; luminance as linear relative luminance 0..1`);
let pass = true;
wins.forEach((w, k) => {
  const L = series[k];
  let mn = 1, mx = 0, mean = 0; for (const v of L) { mn = Math.min(mn, v); mx = Math.max(mx, v); mean += v; } mean /= N;
  const a = analyse(L, 0.1);
  if (a.opp.n > 3) pass = false;
  const show = k < 2 || a.trans > 0;
  if (show) out.push(`${w[0].padEnd(12)} mean ${mean.toFixed(4)} range ${mn.toFixed(4)}-${mx.toFixed(4)}; largest swing ${a.swing.d.toFixed(4)} (frames ${a.swing.from}-${a.swing.to}, ${((a.swing.to - a.swing.from) / FPS).toFixed(2)} s); worst frame step ${a.jump.d.toFixed(4)} (frame ${a.jump.f}); transitions >= 0.10: ${a.trans}; flashes in any 1 s: ${a.opp.n} (limit 3)`);
  if (k === 1) {
    const b = analyse(L, 0.05);
    out.push(`${''.padEnd(12)} margin test at half the threshold (swings >= 0.05): ${b.trans} transitions, ${b.opp.n} opposing pairs in any 1 s`);
  }
});
out.push(`quarter windows not listed had no transition >= 0.10.`);
out.push(pass ? 'PASS  no window exceeds 3 flashes in any second' : 'FAIL');
console.log(out.join('\n'));
