// "Develop" the baked latent image into what the 1840s lens would have laid on the plate, and store it for the piece.
//   node develop.js <in.u16> <W> <H> [preview.png]
// in.u16: Uint16 pairs from bake.js (log2 actinic exposure, depth in 0.01 cm), rows bottom-up.
// 1. Depth of field by gathering: every pixel spreads over its circle of confusion; the circle grows off-axis (a
//    Petzval portrait lens has a strongly curved field) and is clipped into a cat's-eye by the lens barrel, so
//    out-of-focus highlights swirl gently around the centre. Pixels behind a sharper pixel cannot spill over it.
// 2. Spherical-aberration halation: a faint wide glow around the brightest passages.
// 3. Natural vignetting.
// Writes js/photo-data.js: window.PHOTO = { w, h, data: base64(deflate(Uint16 log2 exposure)) }.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const [inFile, Ws, Hs, prevFile] = process.argv.slice(2);
const W = +Ws, H = +Hs, N = W * H;
const u = new Uint16Array(fs.readFileSync(inFile).buffer.slice(0));
const E = new Float32Array(N), D = new Float32Array(N);
for (let i = 0; i < N; i++) { E[i] = Math.pow(2, u[i * 2] / 65535 * 18 - 14); D[i] = u[i * 2 + 1] / 100; }

// camera, as in js/stilllife.js
const CAM = [1.4, 19.0, 36.0], TGT = [0.8, 2.6, -5.0], FOC = [-0.4, 0.6, -2.9], TANH = 0.30, APER = 0.95;
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fw = sub(TGT, CAM); const fl = Math.hypot(...fw); fw.forEach((v, i) => (fw[i] = v / fl));
const focusD = dot(sub(FOC, CAM), fw);
const kpx = APER * W / (2 * TANH * focusD); // CoC radius in px = kpx * |d - f| / d * f... (thin lens, measured at the focal plane)
const coc = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, sx = (x - W / 2) / (W / 2), sy = (y - H / 2) / (W / 2), r2 = sx * sx + sy * sy;
  const f = focusD * (1 - 0.03 * r2); // the curved field: sharp focus bows toward the lens off-axis
  const d = Math.min(D[i], 150);
  coc[i] = Math.min(30, kpx * f * Math.abs(d - f) / (d * f) + 2.2 * r2 * r2 + 0.35);
}
// gather
const out = new Float32Array(N);
const T = 16, tw = Math.ceil(W / T), th = Math.ceil(H / T), tmax = new Float32Array(tw * th);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = ((y / T) | 0) * tw + ((x / T) | 0); tmax[t] = Math.max(tmax[t], coc[y * W + x]); }
const tdil = new Float32Array(tw * th);
for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
  let m = 0; const rr = 2;
  for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) { const a = tx + i, b = ty + j; if (a >= 0 && b >= 0 && a < tw && b < th) m = Math.max(m, tmax[b * tw + a]); }
  tdil[ty * tw + tx] = m;
}
const BARREL = 0.42;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, R = Math.ceil(Math.min(30, tdil[((y / T) | 0) * tw + ((x / T) | 0)]));
  const ci = coc[i], di = D[i];
  let s = 0, ws = 0;
  for (let j = -R; j <= R; j++) {
    const yy = y + j; if (yy < 0 || yy >= H) continue;
    for (let k = -R; k <= R; k++) {
      const xx = x + k; if (xx < 0 || xx >= W) continue;
      const n = yy * W + xx;
      let c = coc[n];
      if (D[n] > di + 0.3) c = Math.min(c, Math.max(ci, 0.5)); // a farther pixel cannot blur over a nearer, sharper one
      const dist = Math.hypot(k, j);
      if (dist > c + 0.5) continue;
      // cat's eye: the disc intersected with a disc displaced toward the field centre
      const sx = (xx - W / 2) / (W / 2), sy = (yy - H / 2) / (W / 2);
      const ox = k / Math.max(c, 0.5) + sx * BARREL, oy = j / Math.max(c, 0.5) + sy * BARREL;
      const cat = Math.min(1, Math.max(0, (1.0 - Math.hypot(ox, oy)) * c + 0.5));
      const w = Math.min(1, c + 0.5 - dist) * cat / (c * c + 0.25);
      s += E[n] * w; ws += w;
    }
  }
  out[i] = ws > 0 ? s / ws : E[i];
}
// halation: wide soft glow of the brightest passages (separable gaussian, sigma ~ 1.2% of width)
const glow = new Float32Array(N), tmp = new Float32Array(N);
const thr = 0.55;
for (let i = 0; i < N; i++) glow[i] = Math.max(0, out[i] - thr);
const sig = W * 0.012, rad = Math.ceil(sig * 3), ker = [];
for (let k = -rad; k <= rad; k++) ker.push(Math.exp(-(k * k) / (2 * sig * sig)));
const ks = ker.reduce((a, b) => a + b, 0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -rad; k <= rad; k++) { const xx = Math.min(W - 1, Math.max(0, x + k)); s += glow[y * W + xx] * ker[k + rad]; } tmp[y * W + x] = s / ks; }
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -rad; k <= rad; k++) { const yy = Math.min(H - 1, Math.max(0, y + k)); s += tmp[yy * W + x] * ker[k + rad]; } glow[y * W + x] = s / ks; }
const res = new Uint16Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, sx = (x - W / 2) / (W / 2), sy = (y - H / 2) / (W / 2), r2 = sx * sx + sy * sy;
  const v = (out[i] + 0.10 * glow[i]) * (1 - 0.22 * r2) ;
  res[i] = Math.round(Math.min(1, Math.max(0, (Math.log2(Math.max(v, 1e-7)) + 14) / 18)) * 65535);
}
const b64 = zlib.deflateSync(Buffer.from(res.buffer), { level: 9 }).toString('base64');
const js = `// The developed latent image of the still life (see production/bake.js and develop.js): ${W} x ${H}, Uint16 log2 actinic\n// exposure (range 2^-14 .. 2^4), rows bottom-up, deflated and base64-encoded.\nwindow.PHOTO = { w: ${W}, h: ${H}, data: '${b64}' };\n`;
fs.writeFileSync(process.env.OUT || path.join(__dirname, '../js/photo-data.js'), js);
console.log('photo-data.js', (js.length / 1e6).toFixed(2), 'MB; focus depth', focusD.toFixed(2), 'kpx', kpx.toFixed(1));
if (prevFile) {
  const g = Buffer.alloc(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.pow(2, res[(H - 1 - y) * W + x] / 65535 * 18 - 14) * 1.6; g[y * W + x] = Math.round(255 * Math.min(1, Math.pow(v / (1 + 0.6 * v), 1 / 2.2))); }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-i', '-', prevFile], { input: g });
}
