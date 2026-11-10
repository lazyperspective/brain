// node strip.js built.js out.png t0 n step  -> n frames rendered sequentially from t0 (life needs consecutive frames), tiled 5 wide
const fs = require('fs'), { execFileSync } = require('child_process');
const [piece, out, t0s, ns, steps] = process.argv.slice(2);
global.window = { PIECES: [] }; eval(fs.readFileSync(piece, 'utf8'));
const E = window.__sunderer_core, { BUF, PAL, W, H } = E, t0 = +t0s, n = +ns, step = +(steps || 2);
const cols = 5, rows = Math.ceil(n / cols), big = Buffer.alloc(W * cols * H * rows * 3);
let f0 = Math.round(t0 * 30) - 12, k = 0;
for (let f = f0; k < n; f++) {
  E.render(f / 30); if (f < Math.round(t0 * 30) || (f - Math.round(t0 * 30)) % step) continue;
  const [sx, sy] = E.SHAKE(), cx = (k % cols) * W, cy = fl(k / cols) * H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = PAL[BUF[Math.min(H - 1, Math.max(0, y - sy)) * W + Math.min(W - 1, Math.max(0, x - sx))]], i = ((cy + y) * W * cols + cx + x) * 3; big[i] = p[0]; big[i + 1] = p[1]; big[i + 2] = p[2]; }
  k++;
}
function fl(v) { return Math.floor(v); }
fs.writeFileSync(out + '.rgb', big);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W * cols}x${H * rows}`, '-i', out + '.rgb', '-vf', 'scale=iw*0.8:ih*0.8:flags=neighbor', out]); fs.unlinkSync(out + '.rgb');
