// node sheet.js built.js out.png [t0] [t1] [fps=2] [cols=10] [scale=0.5] : a contact sheet of the film (each cell labelled with its time)
const fs = require('fs'), { execFileSync } = require('child_process');
const [piece, out, t0s, t1s, fpsS, colsS, scS] = process.argv.slice(2);
global.window = { PIECES: [] }; eval(fs.readFileSync(piece, 'utf8'));
const E = window.__hollow_core, { W, H } = E, t0 = +(t0s || 0), t1 = +(t1s || E.D), fps = +(fpsS || 2), cols = +(colsS || 10), sc = +(scS || 0.5);
const n = Math.round((t1 - t0) * fps), rows = Math.ceil(n / cols), big = Buffer.alloc(W * cols * H * rows * 3), lab = [];
for (let k = 0; k < n; k++) {
  const t = Math.round((t0 + k / fps) * 30) / 30; E.render(t);
  const cx = (k % cols) * W, cy = Math.floor(k / cols) * H, R = E.RGB;
  for (let y = 0; y < H; y++) Buffer.from(R.buffer, y * W * 3, W * 3).copy(big, ((cy + y) * W * cols + cx) * 3);
  lab.push(`drawtext=text='${t.toFixed(2)}':x=${Math.round((cx + 4) * sc)}:y=${Math.round((cy + 4) * sc)}:fontsize=${Math.max(9, Math.round(22 * sc))}:fontcolor=yellow`);
}
fs.writeFileSync(out + '.rgb', big);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W * cols}x${H * rows}`, '-i', out + '.rgb', '-vf', `scale=iw*${sc}:ih*${sc}:flags=neighbor,` + lab.join(','), out]); fs.unlinkSync(out + '.rgb');
