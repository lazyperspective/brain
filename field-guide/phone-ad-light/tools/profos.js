const { chromium } = require('playwright'); const serve = require('./serve');
(async () => { const s = await serve(); const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] }); const pg = await br.newPage();
  pg.on('pageerror', e => console.error('PAGEERROR', e.message));
  await pg.goto(`http://localhost:${s.address().port}/index.html?export&w=320&h=180`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  console.log(await pg.evaluate(ts => { const P = window.__piece; const oc = P.os.canvas.getContext('2d'); const out = [];
    for (const t of ts) { P.os.draw(t, {}); const a = performance.now(); P.os.draw(t + 0.033, {}); oc.getImageData(0, 0, 1, 1); out.push(t + ':' + ((performance.now() - a) | 0)); } return out.join('  '); }, process.argv.slice(2).map(Number)));
  await br.close(); s.close(); })();
