// node production/render.js <out.png> [w] [stage]  — renders index.html headless and saves the canvas
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], w = process.argv[3] || '2160', stage = process.argv[4] || 'full';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exit(1); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + `?w=${w}&stage=${stage}`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForFunction(() => window.__done === true, null, { timeout: 900000, polling: 1000 });
  const d = await page.evaluate(() => window.exportPNG());
  fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
  await browser.close();
})();
