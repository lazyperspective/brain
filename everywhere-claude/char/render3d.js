// node render3d.js jobs.json  -> renders each job with char3d.html (served over a local http server)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = __dirname;
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await b.newPage();
  p.on('pageerror', e => console.error('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await p.goto(`http://127.0.0.1:${port}/char3d.html`); await p.waitForFunction(() => window.ready);
  for (const j of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) {
    const r = await p.evaluate(o => window.renderChar(o), j.opts);
    fs.writeFileSync(j.out, Buffer.from(r.png.split(',')[1], 'base64')); delete r.png;
    fs.writeFileSync(j.out.replace('.png', '.json'), JSON.stringify(r)); console.log(j.out, JSON.stringify(r.foot), r.unitPx.toFixed(2));
  }
  await b.close(); srv.close();
});
