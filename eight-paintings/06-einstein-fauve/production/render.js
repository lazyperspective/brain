// Render the master and its deliverables.
//   node render.js                -> 4K PNG master + X JPEG + crops
//   node render.js --snapshot N   -> also copies the master to snapshots/roundN.png
// Needs Playwright (pre-installed) and Python 3 with Pillow for the JPEG (4:4:4) and crops.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const OUT = path.resolve(__dirname, '../../../eight-paintings-output/06-einstein-fauve');
const SLUG = '06-einstein-fauve';
(async () => {
  const args = process.argv.slice(2);
  const snap = args.indexOf('--snapshot') >= 0 ? args[args.indexOf('--snapshot') + 1] : null;
  fs.mkdirSync(path.join(OUT, 'crops'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'snapshots'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?export&scale=1');
  await page.waitForFunction(() => window.__done === true, null, { timeout: 0, polling: 500 });
  const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  await browser.close();
  const png = path.join(OUT, SLUG + '-4k.png');
  fs.writeFileSync(png, Buffer.from(data.split(',')[1], 'base64'));
  execFileSync('python3', ['-I', path.join(__dirname, 'finish.py'), png, OUT, SLUG], { stdio: 'inherit' });
  if (snap) fs.copyFileSync(png, path.join(OUT, 'snapshots', 'round' + snap + '.png'));
  console.log('ok', png);
})();
