// Loop-seam check on a rendered one-loop video: is the step from the last frame back to the first frame any bigger
// than an ordinary frame-to-frame step?   node seamcheck.js <video.mp4>
// Mean absolute pixel difference (0-255, RGB) on a 270 x 338 downscale, for every consecutive pair.
// (adapted from ink-courtyard/production/seamcheck.js for a 4:5 frame)
const { execFileSync } = require('child_process');
const W = 270, H = 338, file = process.argv[2];
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
const S = W * H * 3, N = raw.length / S;
const diff = (a, b) => { let s = 0; for (let i = 0; i < S; i++) s += Math.abs(raw[a * S + i] - raw[b * S + i]); return s / S; };
const d = []; for (let f = 0; f < N - 1; f++) d.push(diff(f, f + 1));
const seam = diff(N - 1, 0), sorted = d.slice().sort((a, b) => a - b);
const near = d.slice(0, 15).concat(d.slice(N - 16));
console.log(`${file}: ${N} frames`);
console.log(`seam step (last frame -> first frame): ${seam.toFixed(4)}`);
console.log(`ordinary steps: median ${sorted[sorted.length >> 1].toFixed(4)}, 95th pct ${sorted[Math.floor(sorted.length * 0.95)].toFixed(4)}, max ${sorted[sorted.length - 1].toFixed(4)}; within 0.5 s of the seam: max ${Math.max(...near).toFixed(4)}`);
console.log(seam <= Math.max(...near) * 1.25 ? 'PASS  seam step is an ordinary step' : `FAIL  encoded seam step is ${(seam / Math.max(...near)).toFixed(2)}x the largest nearby step`);
