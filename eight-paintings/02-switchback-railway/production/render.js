// node production/render.js <outdir> [name]
// -> <name>-4k.png (2160x2700, exact x5 nearest-neighbour) and <name>-native.png (432x540)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], name = process.argv[3] || '02-switchback-railway';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.__done === true, null, { timeout: 120000 });
  const r = await page.evaluate(() => window.exportMaster());
  const w = (f, d) => fs.writeFileSync(path.join(out, f), Buffer.from(d.split(',')[1], 'base64'));
  w(name + '-4k.png', r.master);
  w(name + '-native.png', r.native);
  console.log('colours used:', r.colours);
  await browser.close();
})();
