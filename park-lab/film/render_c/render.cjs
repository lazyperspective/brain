// Render agent C harness.
//   node render_c/render.cjs <shotId> --stills t1,t2,... [--scale 0.5] [--outdir render_c/scratch/stills]
//   node render_c/render.cjs <shotId> --video [--out film/shots/<id>.mp4] [--from i0 --to i1]
// Serves film/ over http, opens render_c/page.html, pipes PNG frames into ffmpeg (no frames on disk).
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const shotId = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const log = (...a) => { const s = a.join(' '); console.log(s); try { fs.appendFileSync(path.join(__dirname, 'logs', shotId + '.log'), s + '\n'); } catch (e) {} };
fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
srv.listen(0, async () => {
  const port = srv.address().port;
  const shots = JSON.parse(fs.readFileSync(path.join(root, 'plan/shots.json'), 'utf8'));
  const shot = shots.shots.find(s => s.id === shotId); if (!shot) { console.log('no shot', shotId); process.exit(1); }
  const scale = +opt('scale', 1); const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=6000'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => log('[pageerror]', e.message));
  page.on('console', m => { const t = m.text(); if (!/GPU stall|THREE.WebGLRenderer: Context|THREE.WebGLProgram/.test(t)) log('[page]', t.slice(0, 600)); });
  const extra = opt('q', '');
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/render_c/page.html?shot=${shotId}&w=${W}&h=${H}&${extra}`, { waitUntil: 'commit' }); log('goto done', ((Date.now() - t0) / 1000).toFixed(1));
  await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 1800000, polling: 1000 });
  const err = await page.evaluate(() => window.__err); if (err) { log('ERR', err); await browser.close(); srv.close(); process.exit(1); }
  log(`[${shotId}] scene built in ${((Date.now() - t0) / 1000).toFixed(1)} s (${W}x${H})`);
  const grab = async t => Buffer.from((await page.evaluate(t => window.renderAt(t), t)).split(',')[1], 'base64');
  if (flag('stills')) {
    const outdir = path.resolve(opt('outdir', path.join(__dirname, 'scratch/stills'))); fs.mkdirSync(outdir, { recursive: true });
    for (const ts of opt('stills').split(',')) {
      const t = +ts; const a = Date.now(); const b = await grab(t);
      const f = path.join(outdir, `${shotId.slice(0, 2)}_${t.toFixed(3)}.png`); fs.writeFileSync(f, b); log('still', t, ((Date.now() - a) / 1000).toFixed(1) + 's', f);
    }
  } else {
    const n = shot.render.frames, fps = shots.fps, twos = !!shot.render.on_twos;
    const out = path.resolve(root, opt('out', shot.render.output.replace(/^film\//, '')));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn('nice', ['-n', '5', 'ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-threads', '2', '-r', String(fps), '-frames:v', String(n), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const write = async b => { if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r)); };
    let last = null; const ts = Date.now();
    for (let i = 0; i < n; i++) {
      const t = shot.render.t_start + i / fps;
      if (!twos || i % 2 === 0) { const a = Date.now(); last = await grab(t); log(`frame ${i}/${n} t=${t.toFixed(3)} ${((Date.now() - a) / 1000).toFixed(1)}s elapsed ${((Date.now() - ts) / 60000).toFixed(1)}min`); }
      await write(last);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    log(`wrote ${out} ${n} frames in ${((Date.now() - ts) / 60000).toFixed(1)} min`);
  }
  await browser.close(); srv.close();
});
