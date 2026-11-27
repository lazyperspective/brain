// node lib/render.js <animal> [fps=30] [still_t]
//   -> out/<animal>.mp4 (one seamless loop, 1080x1530, H.264 CRF 16) and out/<animal>.png (still at still_t)
// node lib/render.js <animal> stills t1,t2,...  -> out/check/<animal>_<t>.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');

(async () => {
  const name = process.argv[2] || 'demo';
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1530 } });
  await page.goto('file://' + path.join(root, 'lib', 'page.html') + '?a=' + name);
  await page.waitForFunction(() => window.ready === true);
  const grab = async (t) => {
    const b64 = await page.evaluate((t) => { renderFrame(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);
    return Buffer.from(b64, 'base64');
  };
  fs.mkdirSync(path.join(root, 'out', 'check'), { recursive: true });

  if (process.argv[3] === 'stills') {
    for (const t of process.argv[4].split(',').map(Number)) {
      fs.writeFileSync(path.join(root, 'out', 'check', `${name}_${t}.png`), await grab(t));
    }
    await browser.close();
    return;
  }

  const fps = Number(process.argv[3] || 30);
  const loop = await page.evaluate(() => window.ANIMAL.loop);
  const n = Math.round(loop * fps);
  const still = process.argv[4] !== undefined ? Number(process.argv[4]) : 0;
  fs.writeFileSync(path.join(root, 'out', `${name}.png`), await grab(still));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart',
    path.join(root, 'out', `${name}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const buf = await grab(i / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`${name}: ${n} frames, ${loop}s loop`);
})();
