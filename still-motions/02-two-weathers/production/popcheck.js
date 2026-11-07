// Pop check (picture): does anything jump in a single frame instead of changing smoothly?
//   node popcheck.js <video.mp4>
// The frame is cut into 36 x 45 blocks (6 x 6 px on a 216 x 270 downscale); for each block the change from frame f
// to f+1 is compared with its own change in the neighbouring steps (the seam included). A pop is an isolated spike:
// a step more than 1.5x the larger of the steps either side of it and above an absolute floor (in grey levels).
// Also reports the global frame-step series: no step more than 1.5x both neighbours.
// (adapted from ink-courtyard/production/popcheck.js)
const { execFileSync } = require('child_process');
const file = process.argv[2];
const W = 216, H = 270, B = 6;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const S = W * H, N = raw.length / S, bw = W / B, bh = H / B;
const d = new Float32Array(N * bw * bh), g = new Float32Array(N);
for (let f = 0; f < N; f++) {
  const o0 = f * S, o1 = ((f + 1) % N) * S;
  let tot = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let s = 0;
    for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) s += Math.abs(raw[o1 + y * W + x] - raw[o0 + y * W + x]);
    d[f * bw * bh + by * bw + bx] = s / (B * B); tot += s;
  }
  g[f] = tot / S;
}
const FLOOR = +(process.env.FLOOR || 1.5);
let spikes = 0, worst = { k: 0 };
for (let f = 0; f < N; f++) for (let b = 0; b < bw * bh; b++) {
  const v = d[f * bw * bh + b];
  if (v < FLOOR) continue;
  const nb = Math.max(d[((f - 1 + N) % N) * bw * bh + b], d[((f + 1) % N) * bw * bh + b], 0.2);
  const k = v / nb;
  if (k > worst.k) worst = { k, f, b, v };
  if (k > 1.5) { spikes++; if (spikes <= 10) console.log(`block (${b % bw},${(b / bw) | 0}) jumps ${v.toFixed(2)} at step ${f}->${(f + 1) % N} (${k.toFixed(2)}x its neighbours)`); }
}
let gw = { k: 0 };
for (let f = 0; f < N; f++) { const nb = Math.max(g[(f - 1 + N) % N], g[(f + 1) % N], 1e-6); const k = g[f] / nb; if (k > gw.k) gw = { k, f }; }
console.log(`picture check: ${N} frames, ${bw}x${bh} blocks; block steps >= ${FLOOR} levels that are > 1.5x both neighbours: ${spikes}; most isolated block step ${worst.k.toFixed(2)}x (${worst.v ? worst.v.toFixed(2) : 0} levels)`);
console.log(`global frame steps: mean ${(g.reduce((a, b) => a + b, 0) / N).toFixed(4)}, most isolated step ${gw.k.toFixed(2)}x its larger neighbour (step ${gw.f}->${(gw.f + 1) % N})`);
console.log(spikes === 0 && gw.k <= 1.5 ? 'PASS  no single-frame jumps' : 'FAIL  pops found');
