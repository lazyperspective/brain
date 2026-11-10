// Renders the piece frame by frame with Playwright.
//   node render.js stills   -> still-t*.png + strip.png (every 3rd frame) in the output folder
//   node render.js video    -> preview-3s.mp4 and preview-3s-loop3.mp4
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const OUT = '/home/user/brain/thousand-agents-video/styles/01-iso-pixel';
const URL = 'file://' + path.join(__dirname, 'index.html') + '?export';
const mode = process.argv[2] || 'stills';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady());
  const frame = async (t) => Buffer.from((await page.evaluate((t) => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t)).split(',')[1], 'base64');
  if (mode === 'stills') {
    for (const t of [0, 1, 2, 3]) fs.writeFileSync(path.join(OUT, `still-t${t.toFixed(1)}.png`), await frame(t));
    for (const t of (process.argv[3] || '').split(',').filter(Boolean)) fs.writeFileSync(path.join(OUT, `x-t${t}.png`), await frame(+t));
    // strip of every 3rd frame, 6 x 5 tiles of 640x360 (nearest neighbour would alias at 1/3: use area averaging)
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-vf', 'scale=640:360:flags=area,tile=6x5', '-frames:v', '1', path.join(OUT, 'strip-every-3rd-frame.png')], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < 90; f += 3) ff.stdin.write(await frame(f / 30));
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  } else {
    const mp4 = path.join(OUT, 'preview-3s.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-frames:v', '90', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < 90; f++) ff.stdin.write(await frame(f / 30));
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '2', '-i', mp4, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'preview-3s-loop3.mp4')]);
  }
  await browser.close();
})();
