// crop a region out of an existing PNG written by engine.js (filter 0 rows only)
const zlib = require('zlib'), fs = require('fs'); const { writePNG } = require('./engine');
const [src, dst, x0, y0, w, h] = process.argv.slice(2); const b = fs.readFileSync(src);
let p = 8, W = 0, H = 0; const idat = [];
while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8); if (type === 'IHDR') { W = b.readUInt32BE(p + 8); H = b.readUInt32BE(p + 12); } if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; }
const raw = zlib.inflateSync(Buffer.concat(idat)); const X = +x0, Y = +y0, CW = +w, CH = +h, out = Buffer.alloc(CW * CH * 3);
for (let y = 0; y < CH; y++) raw.copy(out, y * CW * 3, (Y + y) * (W * 3 + 1) + 1 + X * 3, (Y + y) * (W * 3 + 1) + 1 + (X + CW) * 3);
writePNG(dst, out, CW, CH);
