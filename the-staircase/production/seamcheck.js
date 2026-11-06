// Loop-seam check on a rendered one-loop video (mirrors pixel-quiet/production/seed): is the step from the last frame back to the first frame
// any bigger than an ordinary frame-to-frame step?  node seamcheck.js <video.mp4>
// Compares mean absolute pixel difference (0-255, on a 360 x 450 downscale) of every consecutive pair.
const { execFileSync } = require('child_process');
const W = 360, H = 450, file = process.argv[2];
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
const S = W * H * 3, N = raw.length / S;
const diff = (a, b) => { let s = 0; for (let i = 0; i < S; i += 3) s += Math.abs(raw[a * S + i] - raw[b * S + i]) + Math.abs(raw[a * S + i + 1] - raw[b * S + i + 1]) + Math.abs(raw[a * S + i + 2] - raw[b * S + i + 2]); return s / S; };
const d = []; for (let f = 0; f < N - 1; f++) d.push(diff(f, f + 1));
const seam = diff(N - 1, 0), sorted = d.slice().sort((a, b) => a - b);
const near = d.slice(0, 15).concat(d.slice(N - 16));
const nearMed = near.slice().sort((a, b) => a - b)[near.length >> 1];
console.log(`${file}: ${N} frames`);
console.log(`seam step (last frame -> first frame): ${seam.toFixed(3)}`);
console.log(`ordinary steps: median ${sorted[sorted.length >> 1].toFixed(3)}, 95th pct ${sorted[Math.floor(sorted.length * 0.95)].toFixed(3)}, max ${sorted[sorted.length - 1].toFixed(3)}; within 0.5 s of the seam: median ${nearMed.toFixed(3)}, max ${Math.max(...near).toFixed(3)}`);
// pop hunt: the largest frame-to-frame steps anywhere in the loop (a pop shows up as an outlier against its neighbours)
const all = d.map((v, f) => [v, f]).concat([[seam, N - 1]]);
const local = (f) => { const w = []; for (let k = -8; k <= 8; k++) if (k) w.push(d[(f + k + N - 1) % (N - 1)] || 0); w.sort((a, b) => a - b); return w[w.length >> 1]; };
const pops = all.map(([v, f]) => [v / Math.max(local(f), 1e-3), v, f]).sort((a, b) => b[0] - a[0]).slice(0, 6);
console.log('largest steps relative to their local median (ratio, step, frame -> frame+1, time):');
for (const [r, v, f] of pops) console.log(`  x${r.toFixed(2)}  ${v.toFixed(3)}  ${f} -> ${(f + 1) % N}  (${(f / 30).toFixed(2)} s)`);
console.log(seam <= Math.max(...near) * 1.25 ? 'PASS  seam step is an ordinary step' : 'CHECK seam step stands out');
