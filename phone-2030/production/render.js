// Render "2030: My Phone Has AGI" through index.html?export (window.__video) in the pre-installed Playwright Chromium.
// Viewport 360x640 CSS px at deviceScaleFactor 3 -> 1080x1920 frames, captured over CDP and piped into ffmpeg.
//   node render.js stills <dir> 0,4.5,13       full-res PNGs (TAG=prefix; CROP=x,y,w,h in output px; SCALE=n)
//   node render.js video <out.mp4> [F0 F1]      silent H.264 1080x1920 60 fps (CRF env, default 16), optional frame range
//   node render.js cues <out.json>              sound cue list from the same timeline
//   node render.js timing                       ms per frame sample
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export';
const [mode, out, a3, a4] = process.argv.slice(2);
const FPS = +(process.env.FPS || 60);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || process.env.LOG) console.error('[console]', m.text().slice(0, 400)); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__video && window.__video.isReady(), null, { timeout: 120000 });
  const D = await page.evaluate(() => window.__video.duration);
  const cdp = await ctx.newCDPSession(page);
  const shot = async (t) => {
    await page.evaluate((t) => window.__video.renderAt(t), t);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 360, height: 640, scale: 3 } });
    return Buffer.from(r.data, 'base64');
  };
  const ff = (args, buf) => new Promise((res, rej) => { const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] }); p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())); p.stdin.end(buf); });

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null, sc = +(process.env.SCALE || 1);
    const tag = process.env.TAG || 'f';
    for (const t of String(a3 || '0').split(',').map(Number)) {
      const p = path.join(out, tag + '-' + t.toFixed(2).padStart(6, '0') + (crop ? '-crop' : '') + '.png');
      const png = await shot(t);
      if (crop || sc !== 1) await ff(['-loglevel', 'error', '-y', '-f', 'png_pipe', '-i', '-', '-vf', (crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : '') + `scale=iw*${sc}:ih*${sc}:flags=lanczos`, '-frames:v', '1', p], png);
      else fs.writeFileSync(p, png);
      console.log(p);
    }
  } else if (mode === 'cues') {
    const cues = await page.evaluate(() => window.__video.cues());
    const T = await page.evaluate(() => { const o = {}; for (const [k, v] of Object.entries(window.__video.T)) if (typeof v === 'number' || Array.isArray(v) && typeof v[0] === 'number') o[k] = v; return o; });
    fs.writeFileSync(out, JSON.stringify({ duration: D, cues, T }, null, 0));
    console.log('cues', cues.length, 'duration', D);
  } else if (mode === 'timing') {
    const ms = []; const t0 = Date.now();
    for (let t = 0; t < D; t += 2.0) { const a = Date.now(); await shot(t); ms.push(Date.now() - a); }
    console.log(ms.join(' '), 'avg', (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0), 'ms; duration', D);
  } else if (mode === 'video') {
    const N = Math.round(D * FPS);
    const F0 = a3 ? +a3 : 0, F1 = a4 ? Math.min(+a4, N) : N;
    const enc = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', process.env.PRESET || 'slow', '-crf', String(process.env.CRF || 16), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-x264-params', `keyint=${FPS * 2}:min-keyint=${FPS}:aq-mode=3`, '-r', String(FPS), '-frames:v', String(F1 - F0), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = F0; f < F1; f++) {
      const png = await shot(f / FPS);
      if (!enc.stdin.write(png)) await new Promise((res) => enc.stdin.once('drain', res));
      if ((f - F0) % 300 === 0) console.log('frame', f, '/', F1, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    enc.stdin.end();
    await new Promise((res) => enc.on('close', res));
    console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
})();
