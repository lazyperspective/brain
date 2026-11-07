// Bake the still-life photograph (the latent image) with the path tracer in js/stilllife.js.
//   node bake.js <W> <H> <spp> <out.u16> [per] [tile]
// Writes <out.u16>: Uint16 pairs (log2 actinic exposure, depth), rows bottom-up, plus <out>.png, a quick preview.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
(async () => {
  const [W, H, spp, out, per, tile] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-gpu-watchdog', '--disable-hang-monitor'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'bake.html'));
  const t0 = Date.now();
  const b64 = await page.evaluate(([W, H, spp, per, tile, defs, extra]) => window.__bake(W, H, spp, per, tile, defs, extra), [+W, +H, +spp, +(per || 4), +(tile || 128), (process.env.DEFS || '').split(';').filter(Boolean).map((d) => '#define ' + d + '\n').join(''), JSON.parse(process.env.OPTS || '{}')]);
  await browser.close();
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(out, buf);
  console.log('baked', W, H, spp, 'spp in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  preview(out, +W, +H);
})();
function preview(file, W, H) {
  const u = new Uint16Array(fs.readFileSync(file).buffer.slice(0));
  const act = Buffer.alloc(W * H);
  const tm = (x) => { x = Math.max(0, x); const y = x / (1 + x * 0.6); return Math.round(255 * Math.min(1, Math.pow(y, 1 / 2.2))); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) act[y * W + x] = tm(1.6 * Math.pow(2, u[((H - 1 - y) * W + x) * 2] / 65535 * 18 - 14));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-i', '-', file.replace(/\.u16$/, '') + '.png'], { input: act });
}
module.exports = { preview };
