// Render the piece through its page in the pre-installed Playwright Chromium and save a PNG.
//   node render.js <out.png> [query, e.g. "scale=0.5&plan"]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], qs = process.argv[3] || '';
  const url = 'file://' + path.resolve(__dirname, '../index.html') + (qs ? '?' + qs : '');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 540, height: 675 } })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => console.error('[console]', m.text()));
  await page.goto(url);
  const t0 = Date.now();
  while (!(await page.evaluate(() => !!(window.__piece && window.__piece.isReady()) || !!window.__error))) {
    if (Date.now() - t0 > 1200000) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 300));
  }
  const err = await page.evaluate(() => window.__error);
  if (err) { console.error(err); process.exit(1); }
  const b64 = await page.evaluate(() => document.getElementById('art').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('wrote', out, JSON.stringify(await page.evaluate(() => window.__stats)), ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await browser.close();
})();
