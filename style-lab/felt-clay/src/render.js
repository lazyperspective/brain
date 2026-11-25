// usage: node render.js <felt|clay> <frames: all | 0,10,20> <outDir> [scale]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const [style, framesArg, outDir, scaleArg] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.route('http://local/**', route => {
    const url = new URL(route.request().url());
    const p = path.join(ROOT, decodeURIComponent(url.pathname));
    const ct = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream';
    route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(p) });
  });
  await page.goto('http://local/src/index.html');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  await page.evaluate(([s, sc]) => window.setup(s, sc), [style, parseFloat(scaleArg || '1')]);
  const frames = framesArg === 'all' ? [...Array(45).keys()] : framesArg.split(',').map(Number);
  for (const k of frames) {
    const t0 = Date.now();
    const data = await page.evaluate(k => window.renderFrame(k), k);
    fs.writeFileSync(path.join(outDir, `${style}_${String(k).padStart(3, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('frame', k, Date.now() - t0, 'ms');
  }
  await browser.close();
})();
