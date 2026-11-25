// Usage: node render.cjs <style> <outdir> <startFrame> <endFrame> [step]
// Serves this folder over http, opens park.html?style=..., renders frames at 30fps timing.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const [style = 'tin', outdir = 'frames', s = '0', e = '0', step = '1'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', m => console.log('[pageerror]', m.message));
  await page.goto(`http://localhost:${port}/park.html?style=${style}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 300000 });
  fs.mkdirSync(path.join(ROOT, outdir), { recursive: true });
  for (let f = +s; f <= +e; f += +step) {
    const t0 = Date.now();
    const data = await page.evaluate(f => window.renderAt(f / 30), f);
    fs.writeFileSync(path.join(ROOT, outdir, `f${String(f).padStart(4, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`frame ${f} ${Date.now() - t0}ms`);
  }
  await browser.close();
  server.close();
});
