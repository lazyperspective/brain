// Renders the piece frame by frame with Playwright.
//   node render.js stills   -> still-t*.png + strip.png (every 3rd frame, contact sheet)
//   node render.js video    -> preview-3s.mp4 + preview-3s-loop3.mp4
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const OUT = '/home/user/brain/thousand-agents-video/styles/02-paper-cut';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?export';
const mode = process.argv[2] || 'stills';

function ff(args, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('close', (c) => c ? rej(new Error('ffmpeg ' + c)) : res());
    input(p.stdin);
  });
}
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  pg.on('pageerror', (e) => { console.error('PAGE ERROR', e); process.exit(1); });
  await pg.goto(URL);
  await pg.waitForFunction('window.__piece && window.__piece.isReady()');
  const shot = async (t) => { await pg.evaluate((t) => window.__piece.renderAt(t), t); return pg.screenshot({ type: 'png' }); };
  const fs = require('fs');
  if (mode === 'stills') {
    for (const t of [0, 1, 2, 3]) fs.writeFileSync(`${OUT}/still-t${t.toFixed(1)}.png`, await shot(t));
    await ff(['-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-vf', 'scale=640:-1,tile=6x5', '-frames:v', '1', `${OUT}/strip.png`], async (stdin) => {
      for (let f = 0; f < 90; f += 3) stdin.write(await shot(f / 30));
      stdin.end();
    });
  } else {
    await ff(['-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', '-frames:v', '90', '-an', '-c:v', 'libx264', '-profile:v', 'high',
      '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', '-r', '30', `${OUT}/preview-3s.mp4`], async (stdin) => {
      for (let f = 0; f < 90; f++) { const buf = await shot(f / 30); if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r)); }
      stdin.end();
    });
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-stream_loop', '2', '-i', `${OUT}/preview-3s.mp4`, '-an', '-c:v', 'libx264', '-profile:v', 'high',
      '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', '-r', '30', `${OUT}/preview-3s-loop3.mp4`]);
  }
  await b.close();
})();
