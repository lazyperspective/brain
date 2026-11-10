// node render.js <scale> <outPng> [targetPng]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const scale = parseFloat(process.argv[2] || '0.5');
  const out = process.argv[3];
  const tgtOut = process.argv[4];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('page:', m.text()));
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?scale=' + scale, { timeout: 0 });
  await page.waitForFunction(() => window.__done === true, null, { timeout: 0, polling: 1000 });
  const png = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  if (tgtOut) {
    const t = await page.evaluate(() => window.__scene.sceneCanvas.toDataURL('image/png'));
    fs.writeFileSync(tgtOut, Buffer.from(t.split(',')[1], 'base64'));
  }
  await browser.close();
})();
