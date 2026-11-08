// Dev tool: render act-2 frames in Node (same JS as the browser) to PNGs.
// usage: node tools/still.js out.png t [scale]   |  node tools/still.js --sheet out.png t0 t1 step cols
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..');
const ctx = { console, Math, Uint8Array, Float32Array, Map, Array, Object, Number, JSON };
vm.createContext(ctx);
const files = JSON.parse(fs.readFileSync(path.join(root, 'js', 'files.json'), 'utf8'));
let src = files.map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n;\n');
src += '\n;globalThis.__api = { renderAt, FB, PAL, W, H };';
vm.runInContext(src, ctx);
const api = ctx.__api;

function frameRGB(t) {
  api.renderAt(t);
  const buf = Buffer.alloc(api.W * api.H * 3);
  for (let i = 0; i < api.W * api.H; i++) { const p = api.PAL[api.FB[i]]; buf[i * 3] = p[0]; buf[i * 3 + 1] = p[1]; buf[i * 3 + 2] = p[2]; }
  return buf;
}
function writePng(out, rgb, w, h, scale) {
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-',
    '-vf', `scale=${w * scale}:${h * scale}:flags=neighbor`, '-frames:v', '1', out], { input: rgb });
}
const a = process.argv.slice(2);
if (a[0] === '--sheet') {
  const out = a[1], t0 = +a[2], t1 = +a[3], step = +a[4], cols = +a[5] || 6;
  const ts = []; for (let t = t0; t <= t1 + 1e-6; t += step) ts.push(+t.toFixed(4));
  const rows = Math.ceil(ts.length / cols);
  const W = api.W, H = api.H, SW = W * cols, SH = H * rows;
  const sheet = Buffer.alloc(SW * SH * 3);
  ts.forEach((t, k) => {
    const f = frameRGB(t), cx = (k % cols) * W, cy = Math.floor(k / cols) * H;
    for (let y = 0; y < H; y++) f.copy(sheet, ((cy + y) * SW + cx) * 3, y * W * 3, (y + 1) * W * 3);
  });
  writePng(out, sheet, SW, SH, 1);
} else {
  const out = a[0], t = +a[1], sc = +(a[2] || 1);
  const t0 = Date.now();
  const f = frameRGB(t);
  writePng(out, f, api.W, api.H, sc);
  console.log('rendered', t, 'in', Date.now() - t0, 'ms');
}
