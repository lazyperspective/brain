// Dev helper: screenshot index.html?<query> canvas to a PNG.  node shot.js "<query>" out.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [, , query, out] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?' + (query || '');
  await page.goto(url);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 0, polling: 500 });
  const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  require('fs').writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await browser.close();
})();
