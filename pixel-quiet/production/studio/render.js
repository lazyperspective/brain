// Render "The Little Studio" through the gallery page and its render hook (window.__studio), in the pre-installed
// Playwright Chromium.
//   node render.js video <out.mp4> [loops]     silent H.264, 1080 × 1350, 30 fps, loops × 40 s (default 1); CRF=n (default 18)
//   node render.js stills <dir> 0,4.5,13       PNGs of exported frames (1080 × 1350)
//   node render.js timing [step]               ms per frame in Chromium over one loop (draw + present to canvas)
// Each frame is the piece's own 360 × 450 palette image read back as raw RGB and scaled exactly 3× nearest-
// neighbour by ffmpeg (every art pixel a crisp 3 × 3 block). Audio is muxed separately (see build.sh).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../../index.html') + '?solo&export#7';
const [mode, out, arg] = process.argv.slice(2);
const FF = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '360x450'];
const UP = ['-vf', 'scale=1080:1350:flags=neighbor'];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__studio && window.__studio.isReady(), null, { timeout: 120000 });
  const D = await page.evaluate(() => window.__studio.duration);
  const grab = async (t, px) => page.evaluate(async ([t, px]) => { await window.__studio.renderAt(t); return { px: px ? window.__studio.pixels() : null, ms: window.__studio.lastMs }; }, [t, px]);

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(t, true);
      const p = path.join(out, 'studio-' + t.toFixed(2).padStart(5, '0') + '.png');
      await new Promise((res, rej) => {
        const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-i', '-', ...UP, '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
        ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
        ff.stdin.end(Buffer.from(r.px, 'base64'));
      });
      console.log(p, r.ms.toFixed(1) + ' ms');
    }
  } else if (mode === 'timing') {
    const step = +(out || 1 / 30), ms = [];
    for (let t = 0; t < D; t += step) ms.push([(await grab(t, false)).ms, t]);
    report(ms, 'timing');
  } else if (mode === 'video') {
    const loops = Math.max(1, parseInt(arg || '1', 10));
    const N = Math.round(D * 30);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-r', '30', '-i', '-', ...UP,
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(process.env.CRF || 18), '-pix_fmt', 'yuv420p', '-r', '30',
      '-movflags', '+faststart', '-frames:v', String(N * loops), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const t0 = Date.now();
    for (let f = 0; f < N * loops; f++) {
      const r = await grab((f % N) / 30, true);
      if (f < N) ms.push([r.ms, f / 30]);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 150 === 0) console.log('frame', f, '/', N * loops, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    fs.writeFileSync(out + '.timing.txt', report(ms, out) + '\n');
  } else console.log('usage: node render.js video <out.mp4> [loops] | stills <dir> <t,...> | timing [step]');
  await browser.close();
})();
function report(ms, label) {
  const v = ms.map((m) => m[0]).sort((a, b) => a - b), avg = v.reduce((a, b) => a + b, 0) / v.length;
  const worst = ms.slice().sort((a, b) => b[0] - a[0]).slice(0, 5).map((m) => m[1].toFixed(2) + 's:' + m[0].toFixed(1)).join(' ');
  const per = {}; for (const [m, t] of ms) { const k = Math.floor(t / 2) * 2; (per[k] = per[k] || []).push(m); }
  const bands = Object.keys(per).map((k) => k + 's ' + (per[k].reduce((a, b) => a + b, 0) / per[k].length).toFixed(1)).join(' | ');
  const s = `${label}: ${ms.length} frames; Chromium ms/frame (render + present) avg ${avg.toFixed(2)}, median ${v[v.length >> 1].toFixed(2)}, p95 ${v[Math.floor(v.length * 0.95)].toFixed(2)}, worst ${v[v.length - 1].toFixed(2)}\n  slowest: ${worst}\n  by 2 s: ${bands}`;
  console.log(s);
  return s;
}
