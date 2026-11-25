// render.js: Playwright driver.
//   node render.js <shotId> stills <t1,t2,...> <outdir> [w h]        -> JPEG stills
//   node render.js <shotId> video [w h] [--from i --to j]              -> film/shots/<id>.mp4 (frames piped into ffmpeg)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { start } = require('./serve.js');
const FILM = path.resolve(__dirname, '..');
(async () => {
  const [shotId, mode, ...rest] = process.argv.slice(2);
  const shots = JSON.parse(fs.readFileSync(path.join(FILM, 'plan/shots.json'), 'utf8'));
  const shot = shots.shots.find(s => s.id === shotId); if (!shot) throw new Error('no shot ' + shotId);
  let W = 1920, H = 1080, times = [], outdir = null;
  if (mode === 'stills') { times = rest[0].split(',').map(Number); outdir = rest[1]; if (rest[2]) { W = +rest[2]; H = +rest[3]; } }
  else if (rest[0] && !rest[0].startsWith('--')) { W = +rest[0]; H = +rest[1]; }
  const srv = await start(); const port = srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !t.includes('GPU stall') && !t.includes('GL Driver')) console.log('[page]', t.slice(0, 400)); });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/rb/app.html?shot=${shotId}&w=${W}&h=${H}${process.env.QS || ''}`);
  await page.waitForFunction(() => window.__ready || window.__err, null, { timeout: 900000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) { console.log('ERR', err); await browser.close(); srv.close(); process.exit(1); }
  console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(await page.evaluate(() => window.info)));
  const grab = async (t, i) => Buffer.from((await page.evaluate(([t, i]) => window.renderAt(t, i), [t, i])).split(',')[1], 'base64');
  if (mode === 'stills') {
    fs.mkdirSync(outdir, { recursive: true });
    for (const t of times) { const a = Date.now(); const i = Math.round((t - shot.render.t_start) * 30); fs.writeFileSync(path.join(outdir, `${shotId.slice(0, 2)}_${t.toFixed(2)}.jpg`), await grab(t, i)); console.log('still', t, ((Date.now() - a) / 1000).toFixed(1), 's'); }
  } else {
    const n = shot.render.frames, ts = shot.render.t_start;
    const out = path.join(FILM, 'shots', shotId + '.mp4'); const tmp = out.replace('.mp4', '.part.mp4');
    const ff = spawn('nice', ['-n', '5', 'ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', '-', '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30', '-threads', '2', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < n; i++) {
      const a = Date.now(); const buf = await grab(ts + i / 30, i);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 6 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n} t=${(ts + i / 30).toFixed(3)} ${((Date.now() - a) / 1000).toFixed(1)}s elapsed ${((Date.now() - t0) / 60000).toFixed(1)}min`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.renameSync(tmp, out); console.log('wrote', out, n, 'frames in', ((Date.now() - t0) / 60000).toFixed(1), 'min');
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
