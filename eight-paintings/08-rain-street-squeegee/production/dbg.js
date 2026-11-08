const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?w=' + (process.argv[2]||'1080') + '&stage=full&dbg=1', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__done === true, null, { timeout: 900000, polling: 1000 });
  const r = await p.evaluate(process.argv[3]);
  console.log(JSON.stringify(r));
  await b.close();
})();
