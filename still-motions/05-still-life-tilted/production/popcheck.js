// Pop check: does anything appear or vanish at once instead of moving in, growing or fading?
//   node popcheck.js <video.mp4> [probe.json]
// 1. Model check (probe.json from `node render.js probe`): every moving element's visible weight (alpha x area) per
//    frame; a pop is a jump of more than a quarter of the element's peak weight between two frames (the seam,
//    last -> first, included).
// 2. Picture check (the video): the frame is cut into 36 x 45 blocks (30 x 30 px at full size); for each block, the
//    change from frame f to f+1 is compared with its own change in the neighbouring steps. A pop is an isolated
//    spike: a step at least 6x the larger of the steps either side of it and above an absolute floor. Real motion
//    (a petal crossing, a wing beat) changes a block over several steps, not one.
const fs = require('fs'), { execFileSync } = require('child_process');
const [file, probeFile] = process.argv.slice(2);
let bad = 0;
if (probeFile && fs.existsSync(probeFile)) {
  const { series } = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
  const keys = Object.keys(series[0]), n = series.length - 1; // last sample is t = D (== t = 0)
  let worst = { r: 0 };
  for (const k of keys) {
    const peak = Math.max(...series.map((s) => s[k])) || 1;
    for (let f = 0; f < n; f++) {
      const a = series[f][k], b = series[(f + 1) % n][k], r = Math.abs(b - a) / peak;
      if (r > worst.r) worst = { r, k, f };
      if (r > 0.25) { bad++; console.log(`model: ${k} jumps ${a.toFixed(1)} -> ${b.toFixed(1)} at frame ${f} (${(r * 100).toFixed(0)}% of its peak)`); }
    }
    if (Math.abs(series[n][k] - series[0][k]) > 1e-6 * peak + 1e-9) { bad++; console.log(`model: ${k} differs at t=D vs t=0`); }
  }
  console.log(`model check: ${keys.length} elements, largest frame-to-frame step ${(worst.r * 100).toFixed(1)}% of peak (${worst.k}, frame ${worst.f})`);
}
if (file) {
  const W = 216, H = 270, B = 6;
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
  const S = W * H, N = raw.length / S, bw = W / B, bh = H / B;
  const d = new Float32Array(N * bw * bh); // d[f][b] = mean |frame f+1 - frame f| in block b (wraps at the seam)
  for (let f = 0; f < N; f++) {
    const o0 = f * S, o1 = ((f + 1) % N) * S;
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let s = 0;
      for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) s += Math.abs(raw[o1 + y * W + x] - raw[o0 + y * W + x]);
      d[f * bw * bh + by * bw + bx] = s / (B * B);
    }
  }
  const FLOOR = +(process.env.FLOOR || 6);
  let spikes = 0, worst = { k: 0 };
  for (let f = 0; f < N; f++) for (let b = 0; b < bw * bh; b++) {
    const v = d[f * bw * bh + b];
    if (v < FLOOR) continue;
    const nb = Math.max(d[((f - 1 + N) % N) * bw * bh + b], d[((f + 1) % N) * bw * bh + b], 0.4);
    const k = v / nb;
    if (k > worst.k) worst = { k, f, b, v };
    if (k >= 6) { spikes++; if (spikes <= 20) console.log(`picture: block (${b % bw},${(b / bw) | 0}) spikes ${v.toFixed(1)} at step ${f}->${(f + 1) % N} (${k.toFixed(1)}x its neighbours)`); }
  }
  console.log(`picture check: ${N} frames, ${bw}x${bh} blocks; isolated spikes >= ${FLOOR} levels and >= 6x neighbours: ${spikes}; most isolated step ${worst.k.toFixed(1)}x (${worst.v ? worst.v.toFixed(1) : 0} levels, step ${worst.f})`);
  bad += spikes;
}
console.log(bad ? 'CHECK  pops found' : 'PASS  nothing pops in or out');
