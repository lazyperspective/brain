// usage: node render.js <mode> <outdir> <times(comma) | all> [size]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = __dirname;
const [mode, outdir, timesArg, sizeArg] = process.argv.slice(2);
const size = +(sizeArg || 1080);
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
});
srv.listen(0, async () => {
  const port = srv.address().port;
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/src/index.html?mode=${mode}&size=${size}`);
  await page.waitForFunction(() => window.__ready === true || window.__err, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__err);
  if (err) { console.log('ERR', err); process.exit(1); }
  let frames;
  if (timesArg === 'all') frames = [...Array(90).keys()].map(i => [i, i / 30]);
  else frames = timesArg.split(',').map((t, i) => [i, +t]);
  for (const [i, t] of frames) {
    const t0 = Date.now();
    const data = await page.evaluate(t => window.renderFrame(t), t);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    const name = timesArg === 'all' ? `f${String(i).padStart(4, '0')}.png` : `t${t.toFixed(2)}.png`;
    fs.writeFileSync(path.join(outdir, name), buf);
    console.log(name, (Date.now() - t0) + 'ms');
  }
  await browser.close(); srv.close();
});
