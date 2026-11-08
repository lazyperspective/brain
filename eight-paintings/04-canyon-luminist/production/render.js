// node production/render.js <outfile.png> [query]   e.g. "scale=0.5&stage=study"
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], q = process.argv[3] || '';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + (q ? '?' + q : ''));
  await page.waitForFunction(() => window.__done === true, null, { timeout: 1800000, polling: 1000 });
  const r = await page.evaluate(() => window.exportMaster());
  fs.writeFileSync(out, Buffer.from(r.master.split(',')[1], 'base64'));
  await browser.close();
})();
