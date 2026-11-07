// Pop check: does anything appear, vanish or jump at once instead of easing?   node popcheck.js <video.mp4>
// The frame is cut into 36 x 45 blocks (30 x 30 px at 1080 x 1350); for each block, the change from frame f to f+1
// is compared with its own change in the steps either side. A pop is an isolated spike: a step at least 1.5x the
// larger of its neighbouring steps AND clearly above the encoder's noise floor. Real motion (a shimmer cross-fade,
// a sway) changes a block over many steps, so its steps rise and fall smoothly. Also reports, for the whole frame,
// the largest ratio of a step to its neighbours (the seam included).
const { execFileSync } = require('child_process');
const file = process.argv[2];
const W = 216, H = 270, B = 6;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const S = W * H, N = raw.length / S, bw = W / B, bh = H / B;
const d = new Float32Array(N * bw * bh);
const whole = new Float32Array(N);
for (let f = 0; f < N; f++) {
  const o0 = f * S, o1 = ((f + 1) % N) * S;
  let tot = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let s = 0;
    for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) s += Math.abs(raw[o1 + y * W + x] - raw[o0 + y * W + x]);
    d[f * bw * bh + by * bw + bx] = s / (B * B); tot += s;
  }
  whole[f] = tot / S;
}
const FLOOR = +(process.env.FLOOR || 3);
let spikes = 0, worst = { k: 0 };
for (let f = 0; f < N; f++) for (let b = 0; b < bw * bh; b++) {
  const v = d[f * bw * bh + b];
  if (v < FLOOR) continue;
  const nb = Math.max(d[((f - 1 + N) % N) * bw * bh + b], d[((f + 1) % N) * bw * bh + b], 0.5);
  const k = v / nb;
  if (k > worst.k) worst = { k, f, b, v };
  if (k >= 1.5) { spikes++; if (spikes <= 12) console.log(`block (${b % bw},${(b / bw) | 0}) jumps ${v.toFixed(2)} at step ${f}->${(f + 1) % N} (${k.toFixed(2)}x its neighbouring steps)`); }
}
let wk = { k: 0 };
for (let f = 0; f < N; f++) { const nb = Math.max(whole[(f - 1 + N) % N], whole[(f + 1) % N], 1e-6); const k = whole[f] / nb; if (k > wk.k) wk = { k, f }; }
console.log(`${file}: ${N} frames, ${bw}x${bh} blocks`);
console.log(`whole frame: largest step / neighbouring steps ${wk.k.toFixed(2)} (step ${wk.f}->${(wk.f + 1) % N})`);
console.log(`blocks: isolated steps >= ${FLOOR} grey levels and >= 1.5x both neighbours: ${spikes}; most isolated ${worst.k.toFixed(2)}x (${worst.v ? worst.v.toFixed(2) : 0} levels, step ${worst.f})`);
console.log(spikes === 0 && wk.k < 1.5 ? 'PASS  nothing pops' : 'CHECK  pops found');
