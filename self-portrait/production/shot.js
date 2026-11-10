// shot.js — render frames to PNG (single, grid, or crop) for review.
// node shot.js out.png --t 1,2.5,8 [--s 3] [--cols 2] [--crop x,y,w,h] [--dump glyphs]
const { chromium } = require('playwright');
const zlib = require('zlib'), fs = require('fs'), path = require('path');
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = y * (w * 3 + 1) + 1 + x * 3; raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; } }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { png };
if (require.main === module) (async () => {
  const a = process.argv.slice(2), out = a[0];
  const opt = k => { const i = a.indexOf('--' + k); return i < 0 ? null : a[i + 1]; };
  const ts = (opt('t') || '0').split(',').map(Number), S = +(opt('s') || 2), cols = +(opt('cols') || Math.min(ts.length, 2));
  const crop = opt('crop') ? opt('crop').split(',').map(Number) : [0, 0, 480, 270];
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => { console.error('PAGEERROR', e.message, e.stack); });
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?export' + (opt('cut') ? '&cut=' + opt('cut') : ''));
  await page.waitForFunction('window.__piece && window.__piece.isReady()', null, { timeout: 30000 });
  const [cx, cy, cw, ch] = crop, rows = Math.ceil(ts.length / cols), gap = ts.length > 1 ? 4 : 0;
  const OW = cols * cw * S + (cols - 1) * gap, OH = rows * ch * S + (rows - 1) * gap, o = Buffer.alloc(OW * OH * 4, 40);
  for (let i = 0; i < ts.length; i++) {
    const t0 = Date.now();
    const b64 = await page.evaluate(t => { window.__piece.renderAt(t); return window.__piece.raw(); }, ts[i]);
    const f = Buffer.from(b64, 'base64'), ox = (i % cols) * (cw * S + gap), oy = Math.floor(i / cols) * (ch * S + gap);
    for (let y = 0; y < ch * S; y++) for (let x = 0; x < cw * S; x++) { const s = ((cy + Math.floor(y / S)) * 480 + cx + Math.floor(x / S)) * 4, d = ((oy + y) * OW + ox + x) * 4; o[d] = f[s]; o[d + 1] = f[s + 1]; o[d + 2] = f[s + 2]; o[d + 3] = 255; }
    if (opt('time')) console.log(ts[i], Date.now() - t0, 'ms');
  }
  fs.writeFileSync(out, png(OW, OH, o));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
