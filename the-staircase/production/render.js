// Render "The Staircase" through index.html?export and its render hook (window.__staircase), in the pre-installed
// Playwright Chromium (WebGL2 on SwiftShader).
//   node render.js video <out.mp4> [loops]     silent H.264, 1080 x 1350, 30 fps, loops x 20 s (default 1); CRF=n (default 17)
//   node render.js stills <dir> 0,4.5,13       PNGs of exported frames (1080 x 1350); CROP=x,y,w,h SCALE=2 for a crop
//   node render.js timing [step]               ms per frame in Chromium over one loop (render + readback)
//   SS=n overrides the internal supersampling (default 2: every frame is drawn at 2160 x 2700 and box-filtered).
// Frames are read back as raw RGB and piped to ffmpeg; audio is muxed separately (see build.sh).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const SS = process.env.SS ? '&ss=' + process.env.SS : '';
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export' + SS;
const [mode, out, arg] = process.argv.slice(2);
const FF = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1350'];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text().slice(0, 400)); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__staircase && window.__staircase.isReady(), null, { timeout: 300000 });
  const D = await page.evaluate(() => window.__staircase.duration);
  const grab = async (t, px) => page.evaluate(([t, px]) => { window.__staircase.renderAt(t); return { px: px ? window.__staircase.pixels() : null, ms: window.__staircase.lastMs }; }, [t, px]);

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    const shots = [];
    const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null, sc = +(process.env.SCALE || 1);
    const tag = process.env.TAG || 'staircase';
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(t, true);
      const p = path.join(out, tag + '-' + t.toFixed(2).padStart(5, '0') + (crop ? '-crop' : '') + '.png');
      const vf = crop ? ['-vf', `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},scale=iw*${sc}:ih*${sc}:flags=lanczos`] : [];
      await new Promise((res, rej) => {
        const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-i', '-', ...vf, '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
        ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
        ff.stdin.end(Buffer.from(r.px, 'base64'));
      });
      console.log(p, r.ms.toFixed(0) + ' ms');
      shots.push(p);
    }
    if (process.env.SHEET) {   // tile the stills into a contact sheet (COLS=n, default 4), each at 1/SHEETDIV size
      const { execFileSync } = require('child_process');
      execFileSync('python3', ['-c', `
import sys
from PIL import Image
out, cols, div = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]); fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = int(ims[0].size[0] / div), int(ims[0].size[1] / div); ims = [im.resize((w, h), Image.LANCZOS) for im in ims]
rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * w + (cols + 1) * 8, rows * h + (rows + 1) * 8), (14, 12, 24))
for k, im in enumerate(ims): s.paste(im, (8 + (k % cols) * (w + 8), 8 + (k // cols) * (h + 8)))
s.save(out)`, process.env.SHEET, process.env.COLS || '4', process.env.SHEETDIV || '3', ...shots]);
      console.log('sheet', process.env.SHEET);
    }
  } else if (mode === 'timing') {
    const step = +(out || 1 / 30), ms = [];
    for (let t = 0; t < D - 1e-9; t += step) ms.push([(await grab(t, false)).ms, t]);
    report(ms, 'timing');
  } else if (mode === 'video') {
    const loops = Math.max(1, parseInt(arg || '1', 10));
    const N = Math.round(D * 30);
    const F0 = +(process.env.F0 || 0), F1 = +(process.env.F1 || N * loops);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-r', '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(process.env.CRF || 17), '-pix_fmt', 'yuv420p', '-r', '30',
      '-movflags', '+faststart', '-frames:v', String(F1 - F0), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const t0 = Date.now();
    for (let f = F0; f < F1; f++) {
      const r = await grab((f % N) / 30, true);
      if (f < N) ms.push([r.ms, f / 30]);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 60 === 0) console.log('frame', f, '/', F1, ((Date.now() - t0) / 1000).toFixed(0) + 's', r.ms.toFixed(0) + 'ms');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    const wall = ((Date.now() - t0) / 1000).toFixed(0);
    fs.writeFileSync(out + '.timing.txt', report(ms, out) + `\n  wall clock: ${wall} s for ${F1 - F0} frames\n`);
  } else console.log('usage: node render.js video <out.mp4> [loops] | stills <dir> <t,...> | timing [step]');
  await browser.close();
})();
function report(ms, label) {
  if (!ms.length) return label + ': no frames';
  const v = ms.map((m) => m[0]).sort((a, b) => a - b), avg = v.reduce((a, b) => a + b, 0) / v.length;
  const worst = ms.slice().sort((a, b) => b[0] - a[0]).slice(0, 5).map((m) => m[1].toFixed(2) + 's:' + m[0].toFixed(0)).join(' ');
  const per = {}; for (const [m, t] of ms) { const k = Math.floor(t / 2) * 2; (per[k] = per[k] || []).push(m); }
  const bands = Object.keys(per).map((k) => k + 's ' + (per[k].reduce((a, b) => a + b, 0) / per[k].length).toFixed(0)).join(' | ');
  const s = `${label}: ${ms.length} frames; Chromium ms/frame (render) avg ${avg.toFixed(0)}, median ${v[v.length >> 1].toFixed(0)}, p95 ${v[Math.floor(v.length * 0.95)].toFixed(0)}, worst ${v[v.length - 1].toFixed(0)}\n  slowest: ${worst}\n  by 2 s: ${bands}`;
  console.log(s);
  return s;
}
