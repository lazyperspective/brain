// Render "The Portrait" through the gallery page and its render hook (window.__portrait).
//   node render-portrait.js video <out.mp4>            one seamless loop, 1080x1350, 30 fps, H.264 yuv420p
//   node render-portrait.js stills <dir> 0,4.5,26      PNG screenshots of the page canvas (1080x1350)
// Uses the pre-installed Playwright Chromium. Frames come from the 216x270 art buffer and are scaled 5x
// nearest-neighbour by ffmpeg, so every art pixel is an exact 5x5 block before encoding.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?solo&export&seed=7#2';
const [mode, out, arg] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__portrait && window.__portrait.isReady(), null, { timeout: 60000 });
  const D = await page.evaluate(() => window.__portrait.duration);

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      await page.evaluate((t) => window.__portrait.renderAt(t), t);
      const p = path.join(out, 'portrait-' + t.toFixed(2).padStart(5, '0') + '.png');
      await page.screenshot({ path: p, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
      console.log(p);
    }
  } else if (mode === 'video') {
    const N = Math.round(D * 30);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '216x270', '-r', '30', '-i', '-',
      '-vf', 'scale=1080:1350:flags=neighbor', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '16',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-frames:v', String(N), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    for (let f = 0; f < N; f++) {
      const r = await page.evaluate(async (t) => { await window.__portrait.renderAt(t); return { px: window.__portrait.pixels(), ms: window.__portrait.lastMs }; }, f / 30);
      ms.push(r.ms);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 120 === 0) console.log('frame', f, '/', N);
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    ms.sort((a, b) => a - b);
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    console.log(out, N, 'frames;', 'render ms/frame avg', avg.toFixed(2), 'p95', ms[Math.floor(ms.length * 0.95)].toFixed(2), 'worst', ms[ms.length - 1].toFixed(2));
  } else {
    console.log('usage: node render-portrait.js video <out.mp4> | stills <dir> <t,t,...>');
  }
  await browser.close();
})();
