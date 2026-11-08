// Render Marsh Nocturne through its page in the pre-installed Playwright Chromium, over file://.
//   node render.js <out.png> [scale] [view] [layers]
// Writes a PNG (RGB) via python/PIL. Prints timing and stroke counts.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
(async () => {
  const [out, scale = '1', view = '', layers = ''] = process.argv.slice(2);
  const qs = new URLSearchParams({ export: '1', scale });
  if (view) qs.set('view', view);
  if (layers) qs.set('layers', layers);
  const url = 'file://' + path.resolve(__dirname, '../index.html') + '?' + qs.toString();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 675 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  const t0 = Date.now();
  await page.goto(url);
  for (;;) {
    const st = await page.evaluate(() => [window.__piece && window.__piece.isReady(), window.__piece && window.__piece.error()]);
    if (st[1]) { console.error(st[1].slice(0, 4000)); process.exit(1); }
    if (st[0]) break;
    if (Date.now() - t0 > 1800000) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 500));
  }
  const stats = await page.evaluate(() => window.__piece.stats());
  const [w, h] = await page.evaluate(() => window.__piece.size());
  console.log('rendered in', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(stats));
  const b64 = await page.evaluate(() => window.__piece.pixelsB64());
  await browser.close();
  const raw = out + '.rgb';
  fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.frombytes('RGB', (${w}, ${h}), open(sys.argv[1], 'rb').read())
im.save(sys.argv[2], optimize=False, compress_level=6)
`, raw, out]);
  fs.unlinkSync(raw);
  console.log('wrote', out, w + 'x' + h);
})();
