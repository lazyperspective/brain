// Development preview: node tools/dev.js [scale] [t] [outPrefix] [crop specs...]
// writes <outPrefix>.png (full frame) and optional 100% crops "name:x:y:w:h" (scene px)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const S = parseFloat(process.argv[2] || '0.5');
const T = parseFloat(process.argv[3] || '5.85');
const OUTP = process.argv[4] || path.join(ROOT, '..', '..', 'quiet-five-output', 'still-life-lemon-v2', '_work', 'dev');
const crops = process.argv.slice(5);
(async () => {
  const t0 = Date.now();
  fs.mkdirSync(path.dirname(OUTP), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[error]', e.message, e.stack));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?export&s=' + S);
  await page.waitForFunction(() => !!window.__piece);
  await page.evaluate(() => window.__piece.init());
  console.log('init', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const t1 = Date.now();
  const dim = await page.evaluate(t => window.__piece.renderAt(t, { scale: 1 }), T);
  console.log('frame', ((Date.now() - t1) / 1000).toFixed(2), 's', dim);
  const b64 = await page.evaluate(() => window.__piece.rgbaBase64());
  const buf = Buffer.from(b64, 'base64');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${dim.w}x${dim.h}`, '-i', '-', '-frames:v', '1', OUTP + '.png'], { input: buf, maxBuffer: 1 << 30 });
  for (const c of crops) {
    const [name, x, y, w, h] = c.split(':');
    const k = dim.w / 2160;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUTP + '.png', '-vf', `crop=${Math.round(w * k)}:${Math.round(h * k)}:${Math.round(x * k)}:${Math.round(y * k)}`, OUTP + '-' + name + '.png']);
  }
  await browser.close();
  console.log('done', ((Date.now() - t0) / 1000).toFixed(1), 's');
})().catch(e => { console.error(e); process.exit(1); });
