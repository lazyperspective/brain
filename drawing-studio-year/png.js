// the smallest PNG writer/reader that will do (RGB, 8 bit)
'use strict';
const fs = require('fs'), zlib = require('zlib');
let CT = null;
function crc(buf) {
  if (!CT) { CT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CT[n] = c >>> 0; } }
  let c = ~0; for (let i = 0; i < buf.length; i++) c = CT[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function writePNG(file, rgb, w, h, level) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: level === undefined ? 4 : level })), chunk('IEND', Buffer.alloc(0))]));
}
// box-filter an RGB buffer down by an integer factor
function shrink(rgb, w, h, k) {
  const W = Math.floor(w / k), H = Math.floor(h / k), o = Buffer.alloc(W * H * 3), n = k * k;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < k; j++) { let i = ((y * k + j) * w + x * k) * 3; for (let q = 0; q < k; q++, i += 3) { r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; } }
    const i = (y * W + x) * 3; o[i] = (r / n + 0.5) | 0; o[i + 1] = (g / n + 0.5) | 0; o[i + 2] = (b / n + 0.5) | 0;
  }
  return { rgb: o, w: W, h: H };
}
module.exports = { writePNG, shrink };
