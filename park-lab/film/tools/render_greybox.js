// usage: node tools/render_greybox.js views.json outdir [w h]      (views: [{name, pos,target,fov,ortho,t} | {name, shotId, t}])
//    or: node tools/render_greybox.js --shot <id> out.mp4 [w h step]  (renders a shot's frames with handles via ffmpeg)
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.listen(0, async () => {
  const port = srv.address().port;
  const shotMode = args[0] === '--shot';
  const W = +(shotMode ? args[3] : args[2]) || 1600, H = +(shotMode ? args[4] : args[3]) || 900;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/tools/greybox.html?w=${W}&h=${H}`);
  await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.__err); if (err) { console.log('ERR', err); process.exit(1); }
  const grab = async v => Buffer.from((await page.evaluate(v => window.renderView(v), v)).split(',')[1], 'base64');
  if (!shotMode) {
    const views = JSON.parse(fs.readFileSync(args[0], 'utf8')); fs.mkdirSync(args[1], { recursive: true });
    for (const v of views) { const t0 = Date.now(); fs.writeFileSync(path.join(args[1], v.name + '.jpg'), await grab(v)); console.log(v.name, Date.now() - t0, 'ms'); }
  } else {
    const shots = JSON.parse(fs.readFileSync(path.join(root, 'plan/shots.json'), 'utf8'));
    const shot = shots.shots.find(s => s.id === args[1]); const step = +(args[5] || 1);
    const fps = shots.fps, n = shot.render.frames; const t0 = shot.render.t_start;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', String(fps), args[2]], { stdio: ['pipe', 'inherit', 'inherit'] });
    let last = null;
    for (let i = 0; i < n; i++) {
      if (i % step === 0) last = await grab({ shotId: shot.id, t: t0 + i / fps });
      ff.stdin.write(last);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote', args[2], n, 'frames');
  }
  await browser.close(); srv.close();
});
