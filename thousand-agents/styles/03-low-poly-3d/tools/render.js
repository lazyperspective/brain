// Renders the piece with Playwright.
//   node render.js stills [t,t,...] [outDir] [ss]   -> still-tX.X.png files
//   node render.js strip  outFile [ss]              -> every 3rd frame contact sheet
//   node render.js video  outDir                    -> preview-3s.mp4, loop3, 4 stills
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.resolve(ROOT, '../../../thousand-agents-video/styles/03-low-poly-3d');

async function open(ss) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?export' + (ss ? '&ss=' + ss : ''));
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 120000 });
  return { browser, page };
}
async function frame(page, t) {
  const url = await page.evaluate(t => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

(async () => {
  const mode = process.argv[2] || 'stills';
  if (mode === 'stills') {
    const ts = (process.argv[3] || '0,1,2,3').split(',').map(Number);
    const out = process.argv[4] || DEFAULT_OUT;
    const { browser, page } = await open(process.argv[5]);
    for (const t of ts) {
      const t0 = Date.now();
      fs.writeFileSync(path.join(out, 'still-t' + t.toFixed(t * 10 % 1 ? 2 : 1) + '.png'), await frame(page, t));
      console.log('still', t, (Date.now() - t0) + 'ms');
    }
    await browser.close();
  } else if (mode === 'strip') {
    const out = process.argv[3];
    const { browser, page } = await open(process.argv[4] || 1);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
      '-vf', 'scale=480:270:flags=lanczos,tile=6x5', '-frames:v', '1', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < 90; i += 3) ff.stdin.write(await frame(page, i / 30));
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    await browser.close();
  } else if (mode === 'video') {
    const out = process.argv[3] || DEFAULT_OUT;
    const { browser, page } = await open();
    const mp4 = path.join(out, 'preview-3s.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
      '-frames:v', '90', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-an', mp4],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < 90; i++) {
      const buf = await frame(page, i / 30);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 30 === 0) fs.writeFileSync(path.join(out, 'still-t' + (i / 30).toFixed(1) + '.png'), buf);
      if (i % 10 === 0) console.log('frame', i, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    fs.writeFileSync(path.join(out, 'still-t3.0.png'), await frame(page, 3.0));
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    await browser.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '2', '-i', mp4, '-c', 'copy', '-movflags', '+faststart', '-an',
      path.join(out, 'preview-3s-loop3.mp4')]);
    console.log('done');
  }
})().catch(e => { console.error(e); process.exit(1); });
