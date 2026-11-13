// node tools/eval.js "<js expression using P = window.__piece>"
const { chromium } = require('playwright'); const serve = require('./serve');
(async () => { const s = await serve(); const br = await chromium.launch(); const pg = await br.newPage();
  pg.on('pageerror', e => console.error('PAGEERROR', e.message));
  await pg.goto(`http://localhost:${s.address().port}/index.html?export&w=320&h=180`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  console.log(await pg.evaluate(new Function('const P = window.__piece; return (' + process.argv[2] + ');')));
  await br.close(); s.close(); })();
