// Render "The Still Point" through the gallery page and its render hook (window.__stillpoint).
//   node render.js video <out.mp4> [loops]        silent H.264, 1080 × 1350, 30 fps, loops × 24 s (default 1)
//   node render.js stills <dir> 0,4.5,13          PNGs of the exported frame (1080 × 1350)
// Uses the pre-installed Playwright Chromium. Each frame is the piece's own composite: the 360 × 450 pixel layer
// scaled exactly 3× nearest-neighbour (every art pixel a crisp 3 × 3 block) with the soft light layer screen-blended
// over it, read back from the page as raw RGB. Audio is muxed separately (see build-video.sh).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?solo&export#1';
const [mode, out, arg] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__stillpoint && window.__stillpoint.isReady(), null, { timeout: 60000 });
  const D = await page.evaluate(() => window.__stillpoint.duration);
  const grab = async (t) => page.evaluate(async (t) => { await window.__stillpoint.renderAt(t); return { px: window.__stillpoint.pixels(), ms: window.__stillpoint.lastMs }; }, t);

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(t);
      const p = path.join(out, 'still-point-' + t.toFixed(2).padStart(5, '0') + '.png');
      await new Promise((res, rej) => {
        const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1350', '-i', '-', '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
        ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
        ff.stdin.end(Buffer.from(r.px, 'base64'));
      });
      console.log(p, r.ms.toFixed(1) + ' ms');
    }
  } else if (mode === 'video') {
    const loops = Math.max(1, parseInt(arg || '1', 10));
    const N = Math.round(D * 30);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1350', '-r', '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', '30',
      '-movflags', '+faststart', '-frames:v', String(N * loops), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const t0 = Date.now();
    for (let f = 0; f < N * loops; f++) {
      const r = await grab((f % N) / 30);
      if (f < N) ms.push(r.ms);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 120 === 0) console.log('frame', f, '/', N * loops, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    ms.sort((a, b) => a - b);
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const report = `${out}: ${N * loops} frames; render ms/frame in Chromium avg ${avg.toFixed(2)}, median ${ms[ms.length >> 1].toFixed(2)}, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, worst ${ms[ms.length - 1].toFixed(2)}`;
    console.log(report);
    fs.writeFileSync(out + '.timing.txt', report + '\n');
  } else {
    console.log('usage: node render.js video <out.mp4> [loops] | stills <dir> <t,t,...>');
  }
  await browser.close();
})();
