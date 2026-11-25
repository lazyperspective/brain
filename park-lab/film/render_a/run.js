// Render agent A harness. Serves park-lab/film over http, drives render_a/page.html in headless Chromium,
// pipes frames straight into ffmpeg (no PNG sequences on disk).
//   node run.js --shot <id> [--out file.mp4]                       full shot (render.frames frames)
//   node run.js --shot <id> --stills 0,40,80 [--outdir dir] [--w 960 --h 540]   stills (jpg) for review
//   node run.js --shot <id> --range a:b                            partial mp4 (debug)
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const A = {}; { const a = process.argv.slice(2); for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { A[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const shots = JSON.parse(fs.readFileSync(path.join(root, 'plan/shots.json'), 'utf8'));
const shot = shots.shots.find(s => s.id === A.shot || s.id.startsWith(A.shot + '_'));
if (!shot) { console.error('no shot', A.shot); process.exit(1); }
const style = shot.style === 'pixel' ? 'pixel' : 'gouache';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.listen(0, async () => {
  const port = srv.address().port;
  const W = +(A.w || 1920), H = +(A.h || 1080);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || t.startsWith('[a]')) console.log('[page]', t); });
  const T0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/render_a/page.html?shot=${shot.id}&style=${style}&w=${W}&h=${H}${A.raw ? '&raw=1' : ''}${A.hide ? '&hide=' + A.hide : ''}${A.ns ? '&ns=1' : ''}${A.prof ? '&prof=1' : ''}`);
  await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 900000 });
  const err = await page.evaluate(() => window.__err); if (err) { console.log('ERR', err); process.exit(1); }
  console.log('setup', ((Date.now() - T0) / 1000).toFixed(1) + 's');
  const fps = shots.fps, n = shot.render.frames, t0 = shot.render.t_start;
  const grab = async (i, still) => Buffer.from((await page.evaluate(([t, st]) => window.renderFrame(t, st), [t0 + i / fps, !!still])).split(',')[1], 'base64');
  if (A.stills) {
    const dir = path.resolve(A.outdir || path.join(__dirname, 'stills')); fs.mkdirSync(dir, { recursive: true });
    for (const s of String(A.stills).split(',')) {
      const i = s === 'last' ? n - 1 : +s; const t1 = Date.now(); const buf = await grab(i, true);
      const f = path.join(dir, `${shot.id.slice(0, 2)}_${String(i).padStart(3, '0')}.${style === 'pixel' ? 'png' : 'jpg'}`); fs.writeFileSync(f, buf);
      console.log('still', f, Date.now() - t1, 'ms');
    }
  } else {
    let [a, b] = A.range ? A.range.split(':').map(Number) : [0, n];
    const out = path.resolve(A.out || path.join(root, 'shots', shot.id + '.mp4'));
    const vf = style === 'pixel' ? ['-vf', 'scale=1920:1080:flags=neighbor'] : [];
    const ff = spawn('nice', ['-n', '5', 'ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...vf,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-threads', '2', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const tS = Date.now();
    for (let i = a; i < b; i++) {
      const buf = await grab(i, false);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - a) % 10 === 0) console.log('frame', i, ((Date.now() - tS) / 1000).toFixed(1) + 's');
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log('wrote', out, b - a, 'frames in', ((Date.now() - tS) / 1000).toFixed(0) + 's');
  }
  await browser.close(); srv.close();
});
