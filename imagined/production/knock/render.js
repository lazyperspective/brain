// Render "The Knock" (In Imagination, piece 03) through the gallery page and its render hook (window.__knock), in the
// pre-installed Playwright Chromium. Each frame is the piece's own composited 1080 × 1350 canvas: the 360 × 450 pixel
// world at exactly 3× with the ink layer drawn over it at full resolution, read back as raw RGB.
//   node render.js video <out.mp4> [loops]       silent H.264, 1080 × 1350, 30 fps, loops × 39 s; CRF=n (default 21)
//   node render.js stills <dir> 0,4.5,13          PNGs (1080 × 1350)
//   node render.js sheet <out.png> 0,4.5,13 [cols] contact sheet of those frames (each scaled to SCALE, default 0.3)
//   node render.js timing [step]                  ms per frame in Chromium over one loop (draw + present)
//   node render.js frames <dir> t0 t1 [fps]       numbered PNGs over a span (for strips)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../../index.html') + '?solo&export#the-knock';
const [mode, out, arg, arg2] = process.argv.slice(2);
const FW = 1080, FH = 1350;
const FF = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${FW}x${FH}`];

(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync'] });
  const page = await (await browser.newContext({ viewport: { width: FW, height: FH }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/01-can-we-talk|02-three-am|fonts\.g/.test(m.text())) console.error('[console]', m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__knock && window.__knock.isReady(), null, { timeout: 120000 });
  if (process.env.NOINK) await page.evaluate(() => { window.__knockNoInk = true; });
  const D = await page.evaluate(() => window.__knock.duration);
  const grab = async (t, px) => page.evaluate(async ([t, px]) => { await window.__knock.renderAt(t); return { px: px ? window.__knock.pixels() : null, ms: window.__knock.lastMs }; }, [t, px]);
  const png = (buf, p, vf) => new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-i', '-', ...(vf ? ['-vf', vf] : []), '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(buf);
  });
  const times = (s) => String(s || '0').split(',').map(Number);

  if (mode === 'stills' || mode === 'sheet') {
    const dir = mode === 'stills' ? out : fs.mkdtempSync(path.join(path.dirname(out), 'sheet-'));
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    for (const t of times(arg)) {
      const r = await grab(t, true);
      const p = path.join(dir, 'knock-' + t.toFixed(2).padStart(5, '0') + '.png');
      await png(Buffer.from(r.px, 'base64'), p);
      files.push(p);
      console.log(p, r.ms.toFixed(1) + ' ms');
    }
    if (mode === 'sheet') {
      const cols = +(arg2 || 4), sc = +(process.env.SCALE || 0.3);
      execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
out, cols, sc = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]); fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = int(ims[0].size[0] * sc), int(ims[0].size[1] * sc)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w + (cols + 1) * 8, rows * (h + 22) + (rows + 1) * 8), (14, 13, 16))
d = ImageDraw.Draw(S)
for k, (im, f) in enumerate(zip(ims, fs)):
    x, y = 8 + (k % cols) * (w + 8), 8 + (k // cols) * (h + 30)
    S.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    d.text((x + 4, y + h + 4), 't = ' + f.split('knock-')[1][:-4] + ' s', fill=(220, 210, 190))
S.save(out)`, out, String(cols), String(sc), ...files]);
      for (const f of files) fs.unlinkSync(f);
      fs.rmdirSync(dir);
      console.log('sheet', out);
    }
  } else if (mode === 'frames') {
    fs.mkdirSync(out, { recursive: true });
    const t0 = +arg, t1 = +arg2, fps = +(process.argv[6] || 30);
    let k = 0;
    for (let t = t0; t < t1 - 1e-6; t += 1 / fps, k++) {
      const r = await grab(t, true);
      await png(Buffer.from(r.px, 'base64'), path.join(out, 'f' + String(k).padStart(4, '0') + '.png'));
    }
    console.log(k, 'frames to', out);
  } else if (mode === 'timing') {
    const step = +(out || 1 / 30), ms = [];
    for (let t = 0; t < D; t += step) ms.push([(await grab(t, false)).ms, t]);
    report(ms, 'timing');
  } else if (mode === 'prof') {
    await page.evaluate(() => window.__knock.prof(true));
    let n = 0; for (let t = 0; t < D; t += 0.25, n++) await grab(t, false);
    const P = await page.evaluate(() => window.__knockCore.PROF);
    console.log(Object.entries(P).map(([k, v]) => k + ' ' + (v / n).toFixed(2)).join(' | '));
  } else if (mode === 'video') {
    const loops = Math.max(1, parseInt(arg || '1', 10));
    const N = Math.round(D * 30);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-r', '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(process.env.CRF || 21), '-pix_fmt', 'yuv420p', '-r', '30',
      '-movflags', '+faststart', '-frames:v', String(N * loops), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const t0 = Date.now();
    for (let f = 0; f < N * loops; f++) {
      const r = await grab((f % N) / 30, true);
      if (f < N) ms.push([r.ms, f / 30]);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 150 === 0) console.log('frame', f, '/', N * loops, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    fs.writeFileSync(out + '.timing.txt', report(ms, out) + '\n');
  } else console.log('usage: node render.js video <out.mp4> [loops] | stills <dir> <t,...> | sheet <out.png> <t,...> [cols] | frames <dir> t0 t1 [fps] | timing [step] | prof');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
function report(ms, label) {
  const v = ms.map((m) => m[0]).sort((a, b) => a - b), avg = v.reduce((a, b) => a + b, 0) / v.length;
  const worst = ms.slice().sort((a, b) => b[0] - a[0]).slice(0, 5).map((m) => m[1].toFixed(2) + 's:' + m[0].toFixed(1)).join(' ');
  const per = {}; for (const [m, t] of ms) { const k = Math.floor(t / 3) * 3; (per[k] = per[k] || []).push(m); }
  const bands = Object.keys(per).map((k) => k + 's ' + (per[k].reduce((a, b) => a + b, 0) / per[k].length).toFixed(1)).join(' | ');
  const s = `${label}: ${ms.length} frames; Chromium ms/frame (render + present) avg ${avg.toFixed(2)}, median ${v[v.length >> 1].toFixed(2)}, p95 ${v[Math.floor(v.length * 0.95)].toFixed(2)}, worst ${v[v.length - 1].toFixed(2)}\n  slowest: ${worst}\n  by 3 s: ${bands}`;
  console.log(s);
  return s;
}
