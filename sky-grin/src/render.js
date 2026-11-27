// Usage:
//   node render.js still <frame> <out.png>
//   node render.js strip <out.png> <cols> <f0,f1,...> [scale] [crop w:h:x:y]
//   node render.js video <out.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const W = 1080, H = 2160, FRAMES = 75;

async function open() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => { console.error('[pageerror]', e); process.exit(1); });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.renderFrame);
  return { browser, page };
}
async function grab(page, f) {
  await page.evaluate((f) => window.renderFrame(f), f);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
}
function ff(args) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r, j) => p.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  return { p, done };
}
async function write(stream, buf) { if (!stream.write(buf)) await new Promise((r) => stream.once('drain', r)); }

(async () => {
  const [mode, ...a] = process.argv.slice(2);
  const { browser, page } = await open();
  const t0 = Date.now();
  if (mode === 'still') {
    require('fs').writeFileSync(a[1], await grab(page, +a[0]));
  } else if (mode === 'strip') {
    const out = a[0], cols = +a[1], frames = a[2].split(',').map(Number), sc = +(a[3] || 0.25);
    const crop = a[4] ? `crop=${a[4]},` : '';
    const cw = a[4] ? +a[4].split(':')[0] : W;
    const rows = Math.ceil(frames.length / cols);
    const { p, done } = ff(['-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-vf',
      `${crop}scale=${Math.round(cw * sc)}:-1,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', out]);
    for (const f of frames) await write(p.stdin, await grab(page, f));
    p.stdin.end(); await done;
  } else if (mode === 'video') {
    const { p, done } = ff(['-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a[0]]);
    let last = null, lastD = -1;
    for (let f = 0; f < FRAMES; f++) {
      const d = Math.floor(f / 2);              // animate on twos: one drawing per 2 frames
      if (d !== lastD) { last = await grab(page, f); lastD = d; }
      await write(p.stdin, last);
    }
    p.stdin.end(); await done;
  }
  console.log(mode, 'done in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await browser.close();
})();
