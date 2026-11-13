// node render.js [width=1600] [name=draft] [--crop x,y,w,h ...]      (node render.js 3840 final  -> the finished sheet)
// Draws the picture in plain Node (no browser, no canvas library, no image library) and writes a PNG.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
for (const f of ['engine', 'world', 'mound', 'sky', 'earth', 'last', 'main']) { const p = path.join(__dirname, 'js', f + '.js'); if (fs.existsSync(p)) require(p); }
const A = globalThis.ART;

function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, (w * 3 + 1) * y + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
function crop(rgb, W, x, y, w, h) {
  const o = new Uint8Array(w * h * 3);
  for (let r = 0; r < h; r++) o.set(rgb.subarray(((y + r) * W + x) * 3, ((y + r) * W + x + w) * 3), r * w * 3);
  return o;
}
function shrink(rgb, W, H, f) { // box filter, integer factor
  const w = Math.floor(W / f), h = Math.floor(H / f), o = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += rgb[((y * f + j) * W + x * f + i) * 3 + c];
    o[(y * w + x) * 3 + c] = Math.round(s / (f * f));
  }
  return [o, w, h];
}
module.exports = { png, crop, shrink };
if (require.main !== module) return;

const W = parseInt(process.argv[2] || '1600', 10), H = Math.round(W * 9 / 16);
const name = process.argv[3] || 'draft';
const OUT = path.resolve(__dirname, '../still-warm-output');
const WORK = path.join(OUT, 'work');
fs.mkdirSync(WORK, { recursive: true });
const t0 = Date.now();
const stage = process.env.STAGE ? parseInt(process.env.STAGE, 10) : 999;
const C = A.draw(W, H, { stage, log: m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m) });
const rgb = C.finish();
console.log('strokes', C.count, 'draw ms', Date.now() - t0);
const fin = name === 'final';
fs.writeFileSync(path.join(fin ? OUT : WORK, (fin ? 'still-warm-' + (W >= 3840 ? '4k' : W) : name) + '.png'), png(W, H, rgb));
if (W >= 3200) { const [o, w, h] = shrink(rgb, W, H, 2); fs.writeFileSync(fin ? path.join(OUT, 'still-warm-' + h + '.png') : path.join(WORK, name + '-small.png'), png(w, h, o)); }
// crops are given in design units (the 1600 x 900 space):  --crop x,y,w,h
const S = W / 1600;
process.argv.forEach((a, i) => {
  if (a === '--crop') {
    const [x, y, w, h] = process.argv[i + 1].split(',').map(Number);
    const px = Math.round(x * S), py = Math.round(y * S), pw = Math.min(W - px, Math.round(w * S)), ph = Math.min(H - py, Math.round(h * S));
    fs.writeFileSync(path.join(WORK, `${name}-crop-${x}-${y}.png`), png(pw, ph, crop(rgb, W, px, py, pw, ph)));
  }
});
console.log('total ms', Date.now() - t0);
