const { chromium } = require('playwright'); const serve = require('./serve');
(async () => { const s = await serve(); const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] }); const pg = await br.newPage();
  pg.on('pageerror', e => console.error('PAGEERROR', e.message));
  await pg.goto(`http://localhost:${s.address().port}/index.html?export&w=320&h=180`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  console.log(await pg.evaluate(t => { const P = window.__piece; P.os.draw(t, {}); window.__pr = {}; const a = performance.now(); P.os.draw(t + 0.033, {}); P.os.canvas.getContext('2d').getImageData(0, 0, 1, 1); return JSON.stringify(window.__pr) + ' total ' + ((performance.now() - a) | 0); }, +process.argv[2]));
  await br.close(); s.close(); })();
