// Pop / glitch check on a rendered video: flags frame-to-frame changes that jump out of their neighbourhood
// (something appearing or vanishing at once, a camera snap, a single-frame glitch) anywhere except at the
// intentional cuts.  node motioncheck.js <video.mp4>   (CUTS=a,b,... in seconds; RATIO, MIN thresholds)
// The picture is split into a 6 x 6 grid of cells (each 1/36 of the frame, on a 360 x 450 downscale). For every cell
// and frame step we take the mean absolute difference; a pop is a step that is >= MIN (default 9 grey levels) and
// >= RATIO (default 3.5) x the larger of the 80th-percentile step in the 0.5 s before and after it in that cell. Single-frame
// glitches (a frame unlike both its neighbours) are flagged separately.
const { execFileSync } = require('child_process');
const W = 360, H = 450, G = 6, file = process.argv[2];
const MIN = +(process.env.MIN || 9), RATIO = +(process.env.RATIO || 3.5);
const cuts = (process.env.CUTS || '').split(',').filter(Boolean).map((c) => Math.round(+c * 30));
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const S = W * H, N = raw.length / S, cw = W / G, ch = H / G;
const cell = (a, b) => { const out = new Float32Array(G * G); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = Math.floor(y / ch) * G + Math.floor(x / cw); out[k] += Math.abs(raw[a * S + y * W + x] - raw[b * S + y * W + x]); } for (let k = 0; k < G * G; k++) out[k] /= cw * ch; return out; };
const steps = []; for (let f = 0; f < N; f++) steps.push(cell(f, (f + 1) % N));   // step f: frame f -> f+1 (the last wraps to 0)
const nearCut = (f) => cuts.some((c) => Math.abs(f + 1 - c) <= 1 || (c === 0 && (f === N - 1 || f === 0)));
const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length * 0.8)]; };   // 80th pct: the ink boils every 3rd frame
const pops = [];
for (let f = 0; f < N; f++) {
  if (nearCut(f)) continue;
  for (let k = 0; k < G * G; k++) {
    const v = steps[f][k]; if (v < MIN) continue;
    const before = [], after = [];
    for (let j = 1; j <= 15; j++) { before.push(steps[(f - j + N) % N][k]); after.push(steps[(f + j) % N][k]); }
    const ref = Math.max(med(before), med(after), 0.5);
    if (v >= RATIO * ref) pops.push({ f, k, v, ref });
  }
}
const byF = {}; for (const p of pops) (byF[p.f] = byF[p.f] || []).push(p);
for (const f of Object.keys(byF).map(Number).sort((a, b) => a - b)) {
  const ps = byF[f]; console.log(`t=${((f + 1) / 30).toFixed(3)}s  ${ps.length} cell(s), worst step ${Math.max(...ps.map((p) => p.v)).toFixed(1)} vs local ${ps[0].ref.toFixed(1)}  cells ${ps.map((p) => p.k).join(',')}`);
}
// one-frame glitches: frame f differs from both neighbours much more than they differ from each other
let gl = 0;
for (let f = 1; f < N - 1; f++) {
  if (nearCut(f) || nearCut(f - 1)) continue;
  let a = 0, b = 0, c = 0; const sa = steps[f - 1], sb = steps[f];
  for (let k = 0; k < G * G; k++) { a += sa[k]; b += sb[k]; }
  const skip = cell(f - 1, f + 1); for (let k = 0; k < G * G; k++) c += skip[k];
  if (a / 36 > 6 && b / 36 > 6 && c < 0.35 * Math.min(a, b)) { gl++; console.log(`single-frame glitch at t=${(f / 30).toFixed(3)}s`); }
}
console.log(`${file}: ${N} frames; ${Object.keys(byF).length} popping step(s) outside the ${cuts.length} cuts (MIN ${MIN}, RATIO ${RATIO}); ${gl} single-frame glitch(es)`);
