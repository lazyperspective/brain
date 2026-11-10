// node render.js stills|strip|video   — frame-by-frame capture with Playwright, frames piped into ffmpeg
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const OUT = '/home/user/brain/thousand-agents-video/styles/05-vector-wireframe';
const URL = 'file://' + path.join(__dirname, 'index.html') + '?export';
(async () => {
  const mode = process.argv[2] || 'stills';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => { console.error('PAGE ERROR', e); process.exit(1); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady());
  const grab = async (t) => {
    const d = await page.evaluate((t) => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t);
    return Buffer.from(d.slice(22), 'base64');
  };
  if (mode === 'stills') {
    const ts = process.argv.length > 3 ? process.argv.slice(3).map(Number) : [0, 1, 2, 3];
    for (const t of ts) fs.writeFileSync(path.join(OUT, 'still-t' + t.toFixed(process.argv.length > 3 ? 2 : 1) + '.png'), await grab(t));
  } else {
    const strip = mode === 'strip';
    const args = strip
      ? ['-y', '-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-vf', 'scale=480:270,tile=6x5', '-frames:v', '1', process.argv[3]]
      : ['-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', '30', '-i', '-', '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-r', '30', '-frames:v', '90', '-movflags', '+faststart', path.join(OUT, 'preview-3s.mp4')];
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
    const t0 = Date.now();
    for (let f = 0; f < 90; f += strip ? 3 : 1) {
      const buf = await grab(f / 30);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log('rendered in', ((Date.now() - t0) / 1000).toFixed(1), 's');
    if (!strip) execFileSync('ffmpeg', ['-y', '-stream_loop', '2', '-i', path.join(OUT, 'preview-3s.mp4'), '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'preview-3s-loop3.mp4')], { stdio: 'ignore' });
  }
  await browser.close();
})();
