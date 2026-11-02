// Motion / pop check on a rendered one-loop video of "Can we talk later?".
//   node motioncheck.js <video.mp4> [threshold=4]
// The video is decoded at 180 × 225 and cut into a 9 × 12 grid of cells. For every cell, the mean absolute
// change between consecutive frames is compared with that cell's own typical change in the surrounding second
// (the 80th percentile over ±15 frames: the ink boils at 10 fps, so a real change lands on every third frame and
// that steady redraw is the baseline, not a pop). A "pop" is a frame
// where some cell jumps by more than max(14, threshold × its baseline) of 255 while the steps either side stay under a
// third of that — something appearing, vanishing or teleporting in one frame — anywhere except the film's intentional cuts (listed below, ±1 frame) and the loop seam
// (checked too, as the step from the last frame to the first). It reports each pop with its time and cell.
const { execFileSync } = require('child_process');
const file = process.argv[2], K = +(process.argv[3] || 4);
const W = 180, H = 225, GX = 9, GY = 12, CW = W / GX, CH = Math.floor(H / GY);
const CUTS = [2.3, 3.6, 7.2, 10.6, 19.4, 21.6, 25.6];       // shot changes (s), see SHOTS in the piece
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const S = W * H, N = raw.length / S;
const boil = (f) => { const t0 = f / 30, t1 = (f + 1) / 30, r = t1 > 19.7 && t1 < 21.4 ? 4 : 10; return Math.floor(t1 * r + 1e-6) !== Math.floor(t0 * r + 1e-6); };
const cut = (f) => CUTS.some((c) => Math.abs(f - c * 30) <= 1.01);
const d = [];   // d[f][cell] change from f to f+1 (wrapping)
for (let f = 0; f < N; f++) {
  const a = f * S, b = ((f + 1) % N) * S, row = new Float32Array(GX * GY);
  for (let cy = 0; cy < GY; cy++) for (let cx = 0; cx < GX; cx++) {
    let s = 0;
    for (let y = cy * CH; y < (cy + 1) * CH; y++) for (let x = cx * CW; x < (cx + 1) * CW; x++) s += Math.abs(raw[a + y * W + x] - raw[b + y * W + x]);
    row[cy * GX + cx] = s / (CW * CH);
  }
  d.push(row);
}
let pops = 0, worst = { r: 0 };
const med = (arr) => { const v = arr.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
const p80 = (arr) => { const v = arr.slice().sort((x, y) => x - y); return v[Math.floor(v.length * 0.8)]; };
const events = [];
let camFrames = 0;
for (let f = 0; f < N; f++) {
  if (cut(f + 1)) continue;   // the change from f to f+1 is a cut
  // a camera move changes most of the frame at once: that is motion, not a pop
  let moving = 0; for (let c = 0; c < GX * GY; c++) if (d[f][c] > 6) moving++;
  if (moving > GX * GY * 0.6) { camFrames++; continue; }
  const hit = [];
  for (let c = 0; c < GX * GY; c++) {
    // compare like with like: steps on which the ink redraws (10 a second; 4 a second during the breath) against
    // other redraw steps, the steps between redraws against each other
    const win = []; for (let k = -15; k <= 15; k++) if (k && boil((f + k + N) % N) === boil(f)) win.push(d[(f + k + N) % N][c]);
    const base = p80(win), v = d[f][c], lim = Math.max(14, K * base);
    if (v / Math.max(base, 3.5) > worst.r) worst = { r: v / Math.max(base, 3.5), f, c, v, base };
    // a pop is an isolated jump: the steps either side are small (a moving front, a slide or a dissolve spreads
    // its change over neighbouring frames; the 10 fps boil stays under the local baseline)
    const nb = Math.max(d[(f - 1 + N) % N][c], d[(f + 1) % N][c]);
    if (v > lim && nb < v / 3) hit.push([c, v, base]);
  }
  if (hit.length) { pops++; events.push([f, hit]); }
}
let onBoil = 0;
for (const [f, hit] of events) {
  const big = hit.sort((a, b) => b[1] - a[1])[0], b = boil(f);
  if (b) onBoil++;
  console.log(`pop t=${((f + 1) / 30).toFixed(3)}s (frame ${f}->${(f + 1) % N})${b ? ' [ink redraw step]' : ''}: ${hit.length} cell(s), largest ${big[0] % GX},${Math.floor(big[0] / GX)} change ${big[1].toFixed(1)} vs typical ${big[2].toFixed(1)}`);
}
console.log(`${pops - onBoil} pop(s) between ink redraws (pixel layer / UI), ${onBoil} on ink redraw steps (the ink animates on threes: a drawing that changes, opens or appears does so on a redraw)`);
console.log(`${camFrames} frame step(s) skipped as camera motion (more than 60% of the frame moving)`);
const all = d.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
console.log(`${file}: ${N} frames; whole-frame change median ${med(all).toFixed(2)}, seam step ${all[N - 1].toFixed(2)}`);
console.log(`largest jump relative to its cell's own motion: ${worst.r.toFixed(2)}x at t=${((worst.f + 1) / 30).toFixed(3)}s cell ${worst.c % GX},${Math.floor(worst.c / GX)} (${worst.v.toFixed(1)} vs ${worst.base.toFixed(1)})`);
console.log(`${pops} frame(s) with a pop outside the ${CUTS.length} intentional cuts (threshold max(14, ${K}x local))`);
console.log(pops - onBoil === 0 ? 'PASS  no pops between ink redraws' : 'CHECK');
