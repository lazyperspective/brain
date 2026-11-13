// Render the painting headlessly: node tools/render.js [size] [outPng] [seed]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const size = +(process.argv[2] || 4000);
  const out = process.argv[3] || path.resolve(__dirname, '../../../../field-guide-video/x-slats/phoenix-unfolds/master.png');
  const seed = +(process.argv[4] || 1789);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('  page:', m.text()));
  page.on('pageerror', (e) => console.error('  PAGE ERROR:', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?noauto');
  const t = Date.now();
  const b64 = await page.evaluate(async ({ size, seed }) => {
    const c = document.getElementById('c');
    await PU.render(c, { seed, size });
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { size, seed });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`wrote ${out} (${size}px) in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  await browser.close();
})();
