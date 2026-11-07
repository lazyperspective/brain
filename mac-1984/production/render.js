// Render the Macintosh 1984 film through index.html?export (window.__video) in the pre-installed Playwright Chromium.
//   node render.js stills <dir> 0,4.5,13      full 1440x1080 PNGs; TAG=name prefix; CROP=x,y,w,h SCALE=n crop of the frame;
//                                              SCREEN=n dumps the raw 512x342 screen at n x nearest instead (CROP applies to it)
//   node render.js video <out.mp4> [F0 F1]     silent H.264 1440x1080 30 fps (CRF env, default 15), frame range optional
//   node render.js cues <out.json>              sound cue list from the same timeline
//   node render.js timing                      ms per frame sample
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export';
const [mode, out, a3, a4] = process.argv.slice(2);
const FPS = 30;
const FF = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1440x1080'];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || process.env.LOG) console.error('[console]', m.text().slice(0, 400)); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__video && window.__video.isReady(), null, { timeout: 120000 });
  const D = await page.evaluate(() => window.__video.duration);
  const grab = async (t) => page.evaluate((t) => { window.__video.renderAt(t); return { px: window.__video.pixels(), ms: window.__video.lastMs }; }, t);
  const enc = (args, buf) => new Promise((res, rej) => { const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] }); ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())); ff.stdin.end(buf); });

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null, sc = +(process.env.SCALE || 1);
    const tag = process.env.TAG || 'f';
    const shots = [];
    for (const t of String(a3 || '0').split(',').map(Number)) {
      const p = path.join(out, tag + '-' + t.toFixed(2).padStart(6, '0') + (crop ? '-crop' : '') + '.png');
      if (process.env.SCREEN) {
        const n = +process.env.SCREEN;
        const b64 = await page.evaluate((t) => { window.__video.renderAt(t); return window.__video.screenPixels(); }, t);
        const vf = (crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : '') + `scale=iw*${n}:ih*${n}:flags=neighbor`;
        await enc(['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '512x342', '-i', '-', '-vf', vf, '-frames:v', '1', p], Buffer.from(b64, 'base64'));
      } else {
        const r = await grab(t);
        const vf = crop ? ['-vf', `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},scale=iw*${sc}:ih*${sc}:flags=neighbor`] : [];
        await enc(['-loglevel', 'error', '-y', ...FF, '-i', '-', ...vf, '-frames:v', '1', p], Buffer.from(r.px, 'base64'));
      }
      console.log(p); shots.push(p);
    }
    if (process.env.SHEET) sheet(process.env.SHEET, shots, +(process.env.COLS || 4), +(process.env.SHEETDIV || 3));
  } else if (mode === 'cues') {
    const cues = await page.evaluate(() => window.__video.cues());
    fs.writeFileSync(out, JSON.stringify({ duration: D, cues }, null, 0));
    console.log('cues', cues.length, 'duration', D);
  } else if (mode === 'timing') {
    const ms = []; for (let t = 0; t < D; t += 1.0) { const r = await page.evaluate((t) => { window.__video.renderAt(t); window.__video.pixels(); return window.__video.lastMs; }, t); ms.push(r.toFixed(0)); }
    console.log(ms.join(' '));
  } else if (mode === 'video') {
    const N = Math.round(D * FPS);
    const F0 = a3 ? +a3 : 0, F1 = a4 ? Math.min(+a4, N) : N;
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', process.env.PRESET || 'slow', '-tune', 'animation', '-crf', String(process.env.CRF || 15), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-x264-params', 'keyint=60:min-keyint=30', '-r', String(FPS), '-frames:v', String(F1 - F0), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = F0; f < F1; f++) {
      const r = await grab(f / FPS);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if ((f - F0) % 150 === 0) console.log('frame', f, '/', F1, ((Date.now() - t0) / 1000).toFixed(0) + 's', r.ms.toFixed(0) + 'ms');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
})();

function sheet(outp, files, cols, div) {
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
out, cols, div = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]); fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = int(ims[0].size[0] / div), int(ims[0].size[1] / div); ims = [im.resize((w, h), Image.LANCZOS) for im in ims]
rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * (h + 14) + (rows + 1) * 6), (20, 20, 24))
d = ImageDraw.Draw(s)
for k, im in enumerate(ims):
    x, y = 6 + (k % cols) * (w + 6), 6 + (k // cols) * (h + 20)
    s.paste(im, (x, y)); d.text((x + 2, y + h + 1), fs[k].split('/')[-1].split('-')[-1].replace('.png',''), fill=(200, 200, 200))
s.save(out)`, outp, String(cols), String(div), ...files]);
  console.log('sheet', outp);
}
