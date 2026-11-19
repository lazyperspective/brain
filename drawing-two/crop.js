// node crop.js in.png x0 y0 w h out.png  -- cut a piece out of a PNG we wrote ourselves (filter 0 only)
const fs = require('fs'), zlib = require('zlib');
const { encodePNG } = require('./engine.js');
const [inp, x0, y0, w, h, out] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6], process.argv[7]];
const b = fs.readFileSync(inp); let p = 8, W = 0, H = 0; const idat = [];
while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8); if (type === 'IHDR') { W = b.readUInt32BE(p + 8); H = b.readUInt32BE(p + 12); } if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; }
const raw = zlib.inflateSync(Buffer.concat(idat)); const o = new Uint8Array(w * h * 3);
for (let y = 0; y < h; y++) raw.copy(o, y * w * 3, (y0 + y) * (W * 3 + 1) + 1 + x0 * 3, (y0 + y) * (W * 3 + 1) + 1 + (x0 + w) * 3);
fs.writeFileSync(out, encodePNG(o, w, h));
