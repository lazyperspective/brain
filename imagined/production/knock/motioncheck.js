// Motion / pop check on a rendered one-loop video of "The Knock". The piece is drawn in two media (pixels and a canvas
// ink layer), so this works on the output frames rather than on the piece's internals.
//   node motioncheck.js <video.mp4> [timeline.json]
// Decodes every frame at 180 × 225 (grey), and measures the mean absolute change from each frame to the next over the
// whole frame and over a 4 × 4 grid of cells (the loop seam, last frame -> frame 0, included). A step is a "pop" when it
// is at least 3× the median of its neighbours (±8 frames, the step itself excluded) and above 4 grey levels (whole frame)
// or 14 (a cell), and it does not land on a designed cut (the shot list) or a designed hit (the knocks: the door and the
// camera are meant to jump). Pops are listed with their time; the ink boils at 10 fps by design, so a cell's ordinary
// steps include that shimmer.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const file = process.argv[2], tlf = process.argv[3] || path.join(__dirname, 'music/timeline.json');
const EV = JSON.parse(fs.readFileSync(tlf, 'utf8'));
const W = 180, H = 225, G = 4;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const S = W * H, N = raw.length / S;
const cuts = new Set(EV.shots.map((t) => Math.round(t * 30) % N));
const hits = new Set(); for (const k of EV.knocks) for (let d = 0; d < 4; d++) hits.add((Math.round(k * 30) + d) % N);
const whole = new Float64Array(N), cell = Array.from({ length: G * G }, () => new Float64Array(N));
for (let f = 0; f < N; f++) {
  const a = f * S, b = ((f + 1) % N) * S;
  let s = 0; const cs = new Float64Array(G * G);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.abs(raw[a + y * W + x] - raw[b + y * W + x]); s += d; cs[Math.min(G - 1, (y * G / H) | 0) * G + Math.min(G - 1, (x * G / W) | 0)] += d; }
  whole[f] = s / S; for (let c = 0; c < G * G; c++) cell[c][f] = cs[c] / (S / (G * G));
}
const med = (arr, f) => { const v = []; for (let d = -8; d <= 8; d++) if (d) v.push(arr[(f + d + N) % N]); v.sort((p, q) => p - q); return v[v.length >> 1]; };
// designed motion: the lightning's swell, the door swinging open and shut, the eyes snapping shut and open, the dog
// handed over out of frame, and the ink's 10 fps boil while the fear is at its height (the tunnel and the walk)
const designed = [[EV.lightning - 0.4, EV.lightning + 0.4], [EV.open[0] - 0.1, EV.open[1] + 0.2], [EV.close[0] - 0.1, EV.close[1] + 0.2],
  [EV.eyesShut - 0.1, EV.eyesShut + 0.1], [EV.eyesOpen - 0.1, EV.eyesOpen + 0.15], [25.7, 26.4], [EV.wash[0], EV.wash[1] + 0.3]];
const fearAt = (t) => EV.fear[Math.min(EV.fear.length - 1, Math.floor(t * 10))];
const isDesigned = (f) => { const t = f / 30; if (designed.some(([a, b]) => t >= a && t <= b)) return 'designed motion';
  if (fearAt(t) > 0.75 && Math.floor(t * 10) !== Math.floor((f - 1) / 30 * 10)) return 'ink boil (10 fps) at high fear'; return null; };
const pops = [], ok = [];
for (let f = 0; f < N; f++) {
  const nxt = (f + 1) % N;
  if (cuts.has(nxt) || hits.has(nxt) || hits.has(f)) continue;
  const m = med(whole, f);
  const why = isDesigned(nxt), P = why ? { push: (x) => ok.push(x + '  [' + why + ']') } : pops;
  if (whole[f] > 4 && whole[f] > 3 * Math.max(m, 0.5)) P.push(`t=${(nxt / 30).toFixed(2)} whole frame ${whole[f].toFixed(1)} (neighbours ${m.toFixed(1)})`);
  for (let c = 0; c < G * G; c++) { const mc = med(cell[c], f); if (cell[c][f] > 14 && cell[c][f] > 3 * Math.max(mc, 1)) P.push(`t=${(nxt / 30).toFixed(2)} cell ${c % G},${(c / G) | 0} ${cell[c][f].toFixed(1)} (neighbours ${mc.toFixed(1)})`); }
}
const sorted = Array.from(whole).sort((a, b) => a - b);
console.log(`${file}: ${N} frames; whole-frame step median ${sorted[N >> 1].toFixed(2)}, 95th pct ${sorted[Math.floor(N * 0.95)].toFixed(2)}, max ${sorted[N - 1].toFixed(2)} (grey levels)`);
console.log(`designed cuts at ${[...cuts].sort((a, b) => a - b).map((f) => (f / 30).toFixed(2)).join(' ')} s; knock hits excluded`);
console.log(`${ok.length} large step(s) at designed motion (listed by second): ` + [...new Set(ok.map((x) => x.split(' ')[0] + ' ' + x.split('[')[1]))].map((x) => x.replace(']', '')).join('; '));
console.log(pops.length ? pops.join('\n') : 'no unexplained pops');
console.log(`${pops.length} pop(s) outside designed cuts, hits and motion`);
