// Export Act 3: node export.js [--round N] [--no-video] [--stills]
// Renders every frame (t = 60.3 + i/30) in Chromium via Playwright, pipes native RGB frames
// into ffmpeg (exact x4 nearest-neighbour upscale to 1920x1080), H.264 High yuv420p CRF 14.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = '/home/user/brain/starship-pixel-video/act3';
const args = process.argv.slice(2);
const round = args.includes('--round') ? args[args.indexOf('--round') + 1] : null;
const doVideo = !args.includes('--no-video');
const doStills = args.includes('--stills');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?export');
  await page.waitForFunction(() => window.__act && window.__act.isReady());
  const { start, end } = await page.evaluate(() => ({ start: window.__act.start, end: window.__act.end }));
  const N = Math.round((end - start) * 30); // 951 frames for 31.7 s

  if (doVideo) {
    const mp4 = path.join(OUT, 'act3.mp4');
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '480x270', '-framerate', '30', '-i', '-',
      '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14',
      '-tune', 'animation', '-r', '30', '-an', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const t = start + i / 30;
      const b64 = await page.evaluate(t => window.__act.frameRGB64(t), t);
      const buf = Buffer.from(b64, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 120 === 0) console.log(`frame ${i}/${N} t=${t.toFixed(2)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('wrote', mp4);
    // contact sheet: one frame per second (t = 60.8, 61.8, ... 91.8 relative to film time), 8x4 grid of native frames
    const sheet = round ? path.join(OUT, 'snapshots', `round${round}.png`) : path.join(OUT, 'contact_sheet.png');
    fs.mkdirSync(path.dirname(sheet), { recursive: true });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.5', '-i', mp4, '-vf', 'fps=1,scale=480:270:flags=neighbor,tile=8x4', '-frames:v', '1', sheet]);
    if (round) fs.copyFileSync(sheet, path.join(OUT, 'contact_sheet.png'));
    console.log('wrote', sheet);
  }
  if (doStills) {
    const best = { shot7: 65.3, shot8: 70.55, shot9: 74.5, shot10: 83.5 };
    fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
    for (const [name, t] of Object.entries(best)) {
      const [n, b] = await page.evaluate(t => { window.__act.renderAt(t); return [window.__act.nativePNG(), window.__act.bigPNG()]; }, t);
      fs.writeFileSync(path.join(OUT, 'stills', `${name}_native.png`), Buffer.from(n.split(',')[1], 'base64'));
      fs.writeFileSync(path.join(OUT, 'stills', `${name}_1080p.png`), Buffer.from(b.split(',')[1], 'base64'));
      console.log('still', name, t);
    }
  }
  await browser.close();
})();
