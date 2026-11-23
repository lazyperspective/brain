// node rig_render.js jobs.jsonl [worker k of n]  -> for each job: <out>_c.png (RGBA char), <out>_s.png (R=shadow, G=AO), <out>.json (points)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = __dirname;
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); });
const k = +(process.argv[3] || 0), n = +(process.argv[4] || 1);
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await b.newPage();
  p.on('pageerror', e => console.error('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await p.goto(`http://127.0.0.1:${port}/rig.html`); await p.waitForFunction(() => window.ready);
  const jobs = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  let i = 0, t0 = Date.now(), done = 0;
  for (const j of jobs) {
    if ((i++) % n !== k) continue;
    if (j.skipIfExists && fs.existsSync(j.out + '.json')) continue;
    const r = await p.evaluate(o => window.renderFrame(o), j);
    fs.writeFileSync(j.out + '_c.png', Buffer.from(r.char.split(',')[1], 'base64'));
    if (r.shadow) fs.writeFileSync(j.out + '_s.png', Buffer.from(r.shadow.split(',')[1], 'base64'));
    fs.writeFileSync(j.out + '.json', JSON.stringify({ pts: r.pts, crop: j.crop, ss: j.ss || 2, shadow: !!r.shadow })); done++;
  }
  console.log(`worker ${k}/${n}: ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await b.close(); srv.close();
});
