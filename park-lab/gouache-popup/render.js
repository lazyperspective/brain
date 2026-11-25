// Usage: node render.js page.html out.mp4 [frames]        -> encodes video (frames piped to ffmpeg, never written to disk)
//        node render.js page.html still.png --still N      -> single frame
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [page_, out, a3, a4] = process.argv.slice(2);
  const still = a3 === '--still' ? parseInt(a4) : null;
  const frames = still === null ? parseInt(a3 || '90') : 0;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(page_));
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const grab = async (i) => {
    const url = await page.evaluate(async (i) => { await window.renderFrame(i); return document.querySelector('canvas#out').toDataURL('image/png'); }, i);
    return Buffer.from(url.split(',')[1], 'base64');
  };
  if (still !== null) {
    fs.writeFileSync(out, await grab(still));
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '2', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      const buf = await grab(i);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 10 === 0) console.log('frame', i, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
