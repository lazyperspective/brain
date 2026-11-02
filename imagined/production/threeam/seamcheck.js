// Loop-seam check on a rendered one-loop video: is the step from the last frame back to the first frame any bigger
// than an ordinary frame-to-frame step nearby?  node seamcheck.js <video.mp4>
// Mean absolute pixel difference (0-255) on a 360 x 450 area downscale of every consecutive pair. Intentional cuts
// (window.__threeam.cuts, passed as CUTS=a,b,c) are listed separately, not counted as ordinary steps.
const { execFileSync } = require('child_process');
const W = 360, H = 450, file = process.argv[2];
const cuts = (process.env.CUTS || '').split(',').filter(Boolean).map((c) => Math.round(+c * 30));
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
const S = W * H * 3, N = raw.length / S;
const diff = (a, b) => { let s = 0; for (let i = 0; i < S; i++) s += Math.abs(raw[a * S + i] - raw[b * S + i]); return s / S; };
const d = []; for (let f = 0; f < N - 1; f++) d.push(diff(f, f + 1));
const isCut = (f) => cuts.some((c) => c > 0 && f + 1 === c);
const ord = d.filter((_, f) => !isCut(f)), sorted = ord.slice().sort((a, b) => a - b);
const seam = diff(N - 1, 0);
const near = d.slice(0, 15).concat(d.slice(N - 16));
console.log(`${file}: ${N} frames`);
console.log(`seam step (last frame -> first frame): ${seam.toFixed(3)}`);
console.log(`ordinary steps: median ${sorted[sorted.length >> 1].toFixed(3)}, 95th pct ${sorted[Math.floor(sorted.length * 0.95)].toFixed(3)}, max ${sorted[sorted.length - 1].toFixed(3)}; within 0.5 s of the seam: median ${near.slice().sort((a, b) => a - b)[near.length >> 1].toFixed(3)}, max ${Math.max(...near).toFixed(3)}`);
console.log('intentional cuts: ' + cuts.filter((c) => c > 0).map((c) => `${(c / 30).toFixed(2)}s ${d[c - 1].toFixed(2)}`).join(', '));
console.log(seam <= Math.max(...near) * 1.25 ? 'PASS  seam step is an ordinary step' : 'CHECK seam step stands out');
