const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright'); const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); const t0 = Date.now();
  page.on('console', m => console.log(((Date.now() - t0) / 1000).toFixed(1), '[page]', m.text().slice(0, 120)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/render_c/page.html?shot=10_pov_crest_paper&w=960&h=540`, { waitUntil: 'commit' });
  for (let i = 0; i < 200; i++) { const a = Date.now(); const r = await page.evaluate(() => [!!window.__ready, performance.now()]); console.log(((Date.now() - t0) / 1000).toFixed(1), 'eval took', Date.now() - a, 'ms', r); if (r[0]) break; await new Promise(r => setTimeout(r, 5000)); }
  await browser.close(); srv.close();
});
