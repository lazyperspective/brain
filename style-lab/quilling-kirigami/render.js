// usage: node render.js <page.html relative to this dir> <outdir> <firstFrame> <lastFrame> [w] [h]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const [page_, outdir, f0s, f1s, ws, hs] = process.argv.slice(2);
const f0 = +f0s, f1 = +f1s, w = +(ws || 1080), h = +(hs || 1080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
server.listen(0, async () => {
  const port = server.address().port;
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/${page_}?w=${w}&h=${h}`);
  await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
  for (let i = f0; i <= f1; i++) {
    const t0 = Date.now();
    const url = await page.evaluate((i) => window.renderFrame(i), i);
    fs.writeFileSync(path.join(outdir, `f_${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`frame ${i} ${(Date.now() - t0)}ms`);
  }
  await browser.close(); server.close();
});
