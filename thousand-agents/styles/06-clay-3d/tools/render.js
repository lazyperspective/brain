// Frame-by-frame renderer (Playwright + ffmpeg, frames piped, nothing dumped to disk).
//   node render.js stills [w] [ss] [t,t,...]   -> OUT/still-t*.png (or test stills when w != 1920)
//   node render.js strip  [w] [ss]             -> OUT/strip-every-3rd-frame.png
//   node render.js video  [ss] [from] [to]     -> OUT/part-<from>.mp4 (or preview-3s.mp4 for the full range)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');

const SLOT = '06-clay-3d';
const SRC = path.resolve(__dirname, '..', 'index.html');
const OUT = path.resolve(__dirname, '..', '..', '..', '..', 'thousand-agents-video', 'styles', SLOT);
const mode = process.argv[2] || 'stills';

async function open(w, ss) {
  const browser = await chromium.launch();
  const h = Math.round(w * 1080 / 1920);
  const page = await browser.newPage({ viewport: { width: Math.min(w, 1920), height: Math.min(h, 1080) } });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + SRC + '?export&w=' + w + '&ss=' + ss);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 600000 });
  return { browser, page, w, h };
}
async function frame(page, t) {
  const b64 = await page.evaluate(tt => { window.__piece.renderAt(tt); return window.__piece.readPixels(); }, t);
  return Buffer.from(b64, 'base64');
}
function ff(args, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    if (input) p.stdin.end(input);
    else res(p);
  });
}
const raw = (w, h) => ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', w + 'x' + h];

(async () => {
  if (mode === 'stills') {
    const w = parseInt(process.argv[3] || '1920', 10), ss = process.argv[4] || '2';
    const ts = (process.argv[5] || '0,1,2,3').split(',').map(Number);
    const { browser, page, h } = await open(w, ss);
    for (const t of ts) {
      const t0 = Date.now();
      const buf = await frame(page, t);
      const name = (w === 1920 && ss === '2' ? 'still-t' : 'test-t') + t.toFixed(Number.isInteger(t * 10) ? 1 : 2) + '.png';
      await ff([...raw(w, h), '-i', '-', '-vf', 'vflip', '-frames:v', '1', path.join(OUT, name)], buf);
      console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    await browser.close();
  } else if (mode === 'strip') {
    const w = parseInt(process.argv[3] || '480', 10), ss = process.argv[4] || '1';
    const { browser, page, h } = await open(w, ss);
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...raw(w, h), '-r', '30', '-i', '-',
      '-vf', 'vflip,tile=6x5:padding=2:color=0x333344', '-frames:v', '1', path.join(OUT, 'strip-every-3rd-frame.png')], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < 90; i += 3) p.stdin.write(await frame(page, i / 30));
    p.stdin.end();
    await new Promise(r => p.on('close', r));
    await browser.close();
    console.log('strip done');
  } else if (mode === 'video') {
    const ss = process.argv[3] || '2';
    const from = parseInt(process.argv[4] || '0', 10), to = parseInt(process.argv[5] || '90', 10);
    const { browser, page, w, h } = await open(1920, ss);
    const name = (from === 0 && to === 90) ? 'preview-3s.mp4' : 'part-' + String(from).padStart(2, '0') + '.mp4';
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...raw(w, h), '-r', '30', '-i', '-',
      '-vf', 'vflip', '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
      '-movflags', '+faststart', path.join(OUT, name)], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = from; i < to; i++) {
      const buf = await frame(page, i / 30);
      if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r));
      console.log('frame', i, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    p.stdin.end();
    await new Promise(r => p.on('close', r));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
