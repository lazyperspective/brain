// Render "3 a.m." (In Imagination, piece 02) through the gallery page and its render hook (window.__threeam), in the
// pre-installed Playwright Chromium. Every frame is the piece's full 1080 x 1350 canvas (pixels at 3x + the ink layer),
// read back as raw RGB.
//   node render.js video <out.mp4> [loops]   silent H.264, 1080 x 1350, 30 fps, -tune animation; CRF=n (default 21)
//   node render.js stills <dir> 0,4.5,13      PNGs of exported frames (PREFIX=name, default "threeam")
//   node render.js sheet <out.png> 0,1,2,...  a contact sheet of frames (COLS=n, default 4; SCALE=0.25)
//   node render.js timing [step]              ms per frame in Chromium over one loop (render + ink + present)
//   node render.js raw <out.rgb> [t0] [t1]    raw RGB24 frames t0..t1 at 30 fps (for the checks)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../../index.html') + '?solo&export#2';
const [mode, out, arg, arg2] = process.argv.slice(2);
const FW = 1080, FH = 1350;
const FF = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${FW}x${FH}`];

(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: FW, height: FH }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__threeam && window.__threeam.isReady(), null, { timeout: 180000 });
  const D = await page.evaluate(() => window.__threeam.duration);
  const grab = async (t, px) => page.evaluate(async ([t, px]) => { await window.__threeam.renderAt(t); return { px: px ? window.__threeam.pixels() : null, ms: window.__threeam.lastMs }; }, [t, px]);
  const png = (buf, p, vf) => new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-i', '-', ...(vf ? ['-vf', vf] : []), '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())); ff.stdin.end(buf);
  });

  if (mode === 'stills' || mode === 'sheet') {
    const ts = String(arg || '0').split(',').map(Number);
    const dir = mode === 'stills' ? out : path.join(path.dirname(out), '.sheet-' + path.basename(out));
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    for (const t of ts) {
      const r = await grab(t, true);
      const p = path.join(dir, (process.env.PREFIX || 'threeam') + '-' + t.toFixed(2).padStart(5, '0') + '.png');
      await png(Buffer.from(r.px, 'base64'), p, mode === 'sheet' ? `scale=iw*${process.env.SCALE || 0.25}:-1:flags=area` : null);
      files.push(p);
      console.log(p, r.ms.toFixed(1) + ' ms');
    }
    if (mode === 'sheet') {
      execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
out, cols = sys.argv[1], int(sys.argv[2]); fs = sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * (h + 18) + (rows + 1) * 6), (14, 14, 18))
d = ImageDraw.Draw(s)
for k, (im, f) in enumerate(zip(ims, fs)):
    x, y = 6 + (k % cols) * (w + 6), 6 + (k // cols) * (h + 24)
    s.paste(im, (x, y)); d.text((x + 2, y + h + 3), f.rsplit('-', 1)[1][:-4] + ' s', fill=(220, 210, 190))
s.save(out)`, out, String(process.env.COLS || 4), ...files]);
      for (const f of files) fs.unlinkSync(f);
      fs.rmdirSync(dir);
      console.log('sheet', out);
    }
  } else if (mode === 'timing') {
    const step = +(out || 1 / 30), ms = [];
    for (let t = 0; t < D; t += step) ms.push([(await grab(t, false)).ms, t]);
    report(ms, 'timing');
  } else if (mode === 'raw') {
    const t0 = +(arg || 0), t1 = +(arg2 || D), fd = fs.openSync(out, 'w');
    for (let f = Math.round(t0 * 30); f < Math.round(t1 * 30); f++) { const r = await grab(f / 30, true); fs.writeSync(fd, Buffer.from(r.px, 'base64')); }
    fs.closeSync(fd);
  } else if (mode === 'video') {
    const loops = Math.max(1, parseInt(arg || '1', 10));
    const N = Math.round(D * 30);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-r', '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(process.env.CRF || 21), '-pix_fmt', 'yuv420p', '-r', '30',
      '-movflags', '+faststart', '-frames:v', String(N * loops), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const tStart = Date.now();
    for (let f = 0; f < N * loops; f++) {
      const r = await grab((f % N) / 30, true);
      if (f < N) ms.push([r.ms, f / 30]);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 150 === 0) console.log('frame', f, '/', N * loops, ((Date.now() - tStart) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    fs.writeFileSync(out + '.timing.txt', report(ms, out) + '\n');
  } else console.log('usage: node render.js video <out.mp4> [loops] | stills <dir> <t,...> | sheet <out.png> <t,...> | timing [step] | raw <out.rgb> [t0] [t1]');
  await browser.close();
})();
function report(ms, label) {
  const v = ms.map((m) => m[0]).sort((a, b) => a - b), avg = v.reduce((a, b) => a + b, 0) / v.length;
  const worst = ms.slice().sort((a, b) => b[0] - a[0]).slice(0, 5).map((m) => m[1].toFixed(2) + 's:' + m[0].toFixed(1)).join(' ');
  const per = {}; for (const [m, t] of ms) { const k = Math.floor(t / 2) * 2; (per[k] = per[k] || []).push(m); }
  const bands = Object.keys(per).map((k) => k + 's ' + (per[k].reduce((a, b) => a + b, 0) / per[k].length).toFixed(1)).join(' | ');
  const s = `${label}: ${ms.length} frames; Chromium ms/frame (pixels + ink + present) avg ${avg.toFixed(2)}, median ${v[v.length >> 1].toFixed(2)}, p95 ${v[Math.floor(v.length * 0.95)].toFixed(2)}, worst ${v[v.length - 1].toFixed(2)}\n  slowest: ${worst}\n  by 2 s: ${bands}`;
  console.log(s);
  return s;
}
