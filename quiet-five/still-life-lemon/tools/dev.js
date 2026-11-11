// Dev harness: render the piece in Node (same code as the browser) and write PNGs via ffmpeg.
// usage: node tools/dev.js <mode> <width> <out.png> [t]
//   mode: raw (scene layers only) | final (full painting at time t)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
globalThis.window = undefined;
for (const f of ['core.js', 'scene.js', 'peel.js', 'paint.js', 'piece.js']) {
  const p = path.join(root, 'js', f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}
const Q = globalThis.Q;
function writePng(rgba, W, H, out) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-frames:v', '1', out], { input: Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), maxBuffer: 1 << 30 });
}
Q.writePng = writePng;
const mode = process.argv[2] || 'raw';
const W = parseInt(process.argv[3] || '432', 10);
const H = Math.round(W * 1.25);
const out = process.argv[4] || '/tmp/x.png';
const t = parseFloat(process.argv[5] || '0');
const t0 = Date.now();
if (mode === 'raw') {
  Q.buildCaustics(W >= 1000 ? 3000000 : 600000);
  console.log('caustics', Date.now() - t0);
  const st = Q.createStatic(W, H, { gloss: 6 });
  let cx0 = 0, cy0 = 0, cw = W, ch = H;
  if (process.env.CROP) { [cx0, cy0, cw, ch] = process.env.CROP.split(',').map(Number); }
  Q.renderRows(st, cy0, cy0 + ch, cx0, cx0 + cw);
  console.log('primary', Date.now() - t0);
  if (process.argv.includes('--aa')) { Q.aaRows(st, 0, H); console.log('aa', Date.now() - t0); }
  const rgba = new Uint8ClampedArray(W * H * 4);
  const L = st.layers;
  const exp = parseFloat(process.env.EXP || '1.0');
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) {
      let v = (L[i * 12 + c] + L[i * 12 + 3 + c] + 0.5 * (L[i * 12 + 6 + c] + L[i * 12 + 9 + c])) * exp;
      v = v / (1 + v / 6);
      v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      rgba[i * 4 + c] = Math.max(0, Math.min(255, v * 255));
    }
    rgba[i * 4 + 3] = 255;
  }
  if (process.env.CROP) {
    const c = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) c.set(rgba.subarray(((y + cy0) * W + cx0) * 4, ((y + cy0) * W + cx0 + cw) * 4), y * cw * 4);
    writePng(c, cw, ch, out);
  } else writePng(rgba, W, H, out);
  if (process.env.IDS) {
    const r2 = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { const id = st.id[i]; r2[i * 4] = (id * 53) % 255; r2[i * 4 + 1] = (id * 97) % 255; r2[i * 4 + 2] = (id * 151) % 255; r2[i * 4 + 3] = 255; }
    writePng(r2, W, H, out.replace('.png', '-ids.png'));
  }
} else if (mode === 'final') {
  const piece = Q.makePiece({ W, H });
  piece.initSync((m) => console.log(m, Date.now() - t0));
  console.log('init', Date.now() - t0);
  const rgba = piece.renderRGBA(t);
  writePng(rgba, piece.outW, piece.outH, out);
}
console.log('done', Date.now() - t0, 'ms');
// strip mode: node tools/dev.js strip <W> <out.png> <x,y,w,h> <t1,t2,...>
if (mode === 'strip') {
  const piece = Q.makePiece({ W, H });
  piece.initSync();
  const [cx, cy, cw, ch] = process.argv[5].split(',').map(Number);
  const ts = process.argv[6].split(',').map(Number);
  const strip = new Uint8ClampedArray(cw * ts.length * ch * 4);
  ts.forEach((tt, k) => {
    const rgba = piece.renderRGBA(tt);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let c = 0; c < 4; c++) strip[(y * cw * ts.length + k * cw + x) * 4 + c] = rgba[((y + cy) * W + x + cx) * 4 + c];
  });
  writePng(strip, cw * ts.length, ch, process.argv[4]);
}
