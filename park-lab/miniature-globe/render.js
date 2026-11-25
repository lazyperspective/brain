// usage: node render.js <mode> <outdir> [frames: "all" | comma list of times in seconds]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/www/index.html';
  if (!p.startsWith('/node_modules/')) p = p.startsWith('/www/') ? p : '/www' + p;
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  const [mode, outdir, spec = 'all'] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/www/index.html?mode=${mode}`);
  await page.waitForFunction(() => window.ready || window.err, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.err); if (err) { console.log('ERR', err); process.exit(1); }
  const jobs = spec === 'all' ? Array.from({ length: 90 }, (_, i) => ({ t: i / 30, i, name: `f${String(i).padStart(3, '0')}.png` }))
    : spec.split(',').map((s) => ({ t: +s, i: Math.round(+s * 30), name: `t${(+s).toFixed(2)}.png` }));
  const t0 = Date.now();
  for (const j of jobs) {
    const url = await page.evaluate(([t, i]) => window.renderTime(t, i), [j.t, j.i]);
    fs.writeFileSync(path.join(outdir, j.name), Buffer.from(url.split(',')[1], 'base64'));
    console.log(j.name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await browser.close(); srv.close();
})();
