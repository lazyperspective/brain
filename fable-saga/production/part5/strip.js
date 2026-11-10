// node strip.js built.js out.png t0 n step [cols] [scale] -> n frames from t0, every `step` frames, tiled (each labelled by position: row-major)
const fs = require('fs'), { execFileSync } = require('child_process');
const [piece, out, t0s, ns, steps, colsS, scS] = process.argv.slice(2);
global.window = { PIECES: [] }; eval(fs.readFileSync(piece, 'utf8'));
const E = window.__hollow_core, { W, H } = E, t0 = +t0s, n = +ns, step = +(steps || 2);
const cols = +(colsS || 5), rows = Math.ceil(n / cols), big = Buffer.alloc(W * cols * H * rows * 3);
const f0 = Math.round(t0 * 30);
for (let k = 0; k < n; k++) {
  E.render((f0 + k * step) / 30);
  const cx = (k % cols) * W, cy = Math.floor(k / cols) * H, R = E.RGB;
  for (let y = 0; y < H; y++) R.subarray(y * W * 3, (y + 1) * W * 3).forEach((v, i) => { big[((cy + y) * W * cols + cx) * 3 + i] = v; });
}
fs.writeFileSync(out + '.rgb', big);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W * cols}x${H * rows}`, '-i', out + '.rgb', '-vf', `scale=iw*${scS || 0.8}:ih*${scS || 0.8}:flags=neighbor`, out]); fs.unlinkSync(out + '.rgb');
