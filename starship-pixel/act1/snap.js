// snap.js — render chosen times to PNGs for review.
// usage: node snap.js <outdir> <scale:1|4> t1 t2 ...
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [outdir, scale, ...ts] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => console.log('page:', m.text()));
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?export');
  for (const t of ts) {
    const fn = scale === '4' ? 'bigPNG' : 'nativePNG';
    const url = await page.evaluate(([f, t]) => window.__act[f](t), [fn, +t]);
    const file = path.join(outdir, `s${scale}_${(+t).toFixed(2)}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file);
  }
  await browser.close();
})();
