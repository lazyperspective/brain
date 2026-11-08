// render.js — export Act 1.
//   node render.js video            -> act1.mp4 (1920x1080, 30 fps, H.264 High, CRF 14, tune animation, silent)
//   node render.js sheet <file.png> -> contact sheet, one frame per second
//   node render.js stills           -> stills/ (native + 1920x1080 per shot)
// Frames are piped straight into ffmpeg (native 480x270 RGBA, scaled x4 nearest-neighbour by ffmpeg);
// nothing is written to disk except the outputs.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const OUT = '/home/user/brain/starship-pixel-video/act1';
const FPS = 30;
const STILLS = [ // best moment per shot (film seconds)
  ['shot1_sky_contrail', 2.6], ['shot2_ring', 9.4], ['shot3_tower_low', 14.4], ['shot4_tower_high', 17.6], ['shot5_golden_aerial', 20.6]];

async function page() {
  const browser = await chromium.launch(); const pg = await browser.newPage();
  pg.on('pageerror', e => console.error('pageerror:', e.message));
  await pg.goto('file://' + path.join(__dirname, 'index.html') + '?export');
  await pg.waitForFunction(() => window.__act && window.__act.isReady());
  return { browser, pg };
}
const savePNG = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  const mode = process.argv[2] || 'video';
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, pg } = await page();
  const { start, end } = await pg.evaluate(() => ({ start: window.__act.start, end: window.__act.end }));
  if (mode === 'video') {
    const n = Math.round((end - start) * FPS);
    const out = path.join(OUT, 'act1.mp4');
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '480x270', '-r', String(FPS), '-i', '-',
      '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-tune', 'animation', '-crf', '14',
      '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const b64 = await pg.evaluate(t => window.__act.nativeB64(t), start + i / FPS);
      const buf = Buffer.from(b64, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log('wrote', out, n, 'frames');
  } else if (mode === 'sheet') {
    const file = process.argv[3] || path.join(OUT, 'contact_sheet.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const url = await pg.evaluate(({ start, end }) => {
      const cols = 6, cw = 320, ch = 180, ts = []; for (let t = start; t < end; t += 1) ts.push(t);
      const rows = Math.ceil(ts.length / cols); const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * (ch + 14);
      const x = c.getContext('2d'); x.fillStyle = '#050608'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
      const big = document.getElementById('c');
      ts.forEach((t, i) => { window.__act.renderAt(t); x.drawImage(big, (i % cols) * cw, Math.floor(i / cols) * (ch + 14), cw, ch); x.fillStyle = '#86b0d8'; x.font = '11px monospace'; x.fillText('t=' + t.toFixed(0) + 's', (i % cols) * cw + 4, Math.floor(i / cols) * (ch + 14) + ch + 11); });
      return c.toDataURL('image/png');
    }, { start, end });
    savePNG(file, url); console.log('wrote', file);
  } else if (mode === 'stills') {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const [name, t] of STILLS) {
      savePNG(path.join(dir, name + '_480x270.png'), await pg.evaluate(t => window.__act.nativePNG(t), t));
      savePNG(path.join(dir, name + '_1920x1080.png'), await pg.evaluate(t => window.__act.bigPNG(t), t));
      console.log('still', name, t);
    }
  }
  await browser.close();
})();
