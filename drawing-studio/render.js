// node render.js <width> <out.png> [--stop stageName] [--crop x,y,w,h,file]...
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const { createEngine } = require('./engine.js');
const { createScene } = require('./scene.js');
const { createPainter } = require('./paint.js');

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
let CT = null;
function crcFast(buf) {
  if (!CT) { CT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CT[n] = c >>> 0; } }
  let crc = ~0; for (let i = 0; i < buf.length; i++) crc = CT[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8); return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crcFast(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, rgba, W, H, x0, y0, w, h) {
  x0 = x0 || 0; y0 = y0 || 0; w = w || W; h = h || H;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = ((y + y0) * W + x + x0) * 4, d = y * (w * 3 + 1) + 1 + x * 3;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

const args = process.argv.slice(2);
const Wpx = parseInt(args[0] || '1600', 10), out = args[1] || 'out.png';
let stop = null, half = null; const crops = [];
for (let i = 2; i < args.length; i++) { if (args[i] === '--stop') stop = args[++i]; else if (args[i] === '--crop') crops.push(args[++i].split(',')); else if (args[i] === '--half') half = args[++i]; }
const t0 = Date.now();
const E = createEngine(Wpx);
const Sc = createScene(E);
const P = createPainter(E, Sc);
let last = Date.now();
for (const name of P.stages()) {
  const now = Date.now(); process.stderr.write(`  ${name}  (${((now - last) / 1000).toFixed(1)}s)\n`); last = now;
  if (stop && name === stop) break;
}
const rgba = E.toRGBA();
writePNG(out, rgba, E.W, E.H);
for (const c of crops) {
  const S = E.S, x = Math.round(c[0] * S), y = Math.round(c[1] * S), w = Math.min(E.W - x, Math.round(c[2] * S)), h = Math.min(E.H - y, Math.round(c[3] * S));
  writePNG(c[4], rgba, E.W, E.H, x, y, w, h);
}
if (half) {
  const w = E.W >> 1, h = E.H >> 1, o = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const i = ((y * 2) * E.W + x * 2) * 4 + c;
    o[(y * w + x) * 4 + c] = (rgba[i] + rgba[i + 4] + rgba[i + E.W * 4] + rgba[i + E.W * 4 + 4] + 2) >> 2;
  }
  writePNG(half, o, w, h);
}
process.stderr.write(`done ${E.W}x${E.H} in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}\n`);
