// Render "Still Life, Tilted" through its export hook (window.__piece) in the pre-installed Playwright Chromium, over
// file://.
//   node render.js stills <dir> 0,4.5,13 [scale] [ss]   PNG frames (scale 1 = 2160 x 2700; ss = 2 for 2x2 supersampling)
//   node render.js video <out.mp4> [workers] [loops]     H.264 1080 x 1350, 30 fps, rendered at 2160 x 2700 and
//                                                        downscaled (lanczos); one GOP with x264 zones at the seam
//   node render.js seam                                  render-level seam check (exact frames before coding)
//   node render.js determinism                           the same t twice -> identical pixels?
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const FPS = 30;
const page0 = (scale) => 'file://' + path.resolve(__dirname, '../index.html') + '?export&scale=' + scale;

async function openPage(browser, scale) {
  const page = await (await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(page0(scale));
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 1800000, polling: 500 });
  return page;
}
const grab = (page, t, ss) => page.evaluate(([t, ss]) => { window.__piece.renderAt(t, ss); return { px: window.__piece.pixels(), ms: window.__piece.lastMs, w: window.__piece.width, h: window.__piece.height }; }, [t, ss || 1]);
const toPng = (buf, w, h, p) => new Promise((res, rej) => {
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())); ff.stdin.end(buf);
});
// one GOP (keyframe only at frame 0), frame 0 at a high fixed quality and the last 40 frames ramped up to meet it,
// so the encoded loop seam is an ordinary step (the approach proven in ink-courtyard/production/render.js)
const ZONES = (n) => `zones=0,0,q=10/${n - 40},${n - 25},q=17/${n - 24},${n - 13},q=16/${n - 12},${n - 7},q=15/${n - 6},${n - 1},q=14`;
function encoder(out, n, loops, w, h) {
  const total = n * loops;
  const zones = loops === 1 ? ':' + ZONES(n) : '';
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=1080:1350:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-tune', 'grain', '-crf', String(process.env.CRF || 16),
    '-x264-params', `keyint=${loops === 1 ? n : n}:min-keyint=${n}:scenecut=0${zones}`, '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an',
    '-movflags', '+faststart', '-frames:v', String(total), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}

(async () => {
  const [mode, out, arg, a4, a5] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-gpu-watchdog'] });
  const t0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser, +(a4 || 1));
    console.log('build', (await page.evaluate(() => window.__piece.buildMs)).toFixed(0), 'ms');
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, +(a5 || 1));
      const p = path.join(out, 'still-' + t.toFixed(2).padStart(5, '0') + '.png');
      await toPng(Buffer.from(r.px, 'base64'), r.w, r.h, p);
      console.log(p, r.ms.toFixed(0) + ' ms');
    }
  } else if (mode === 'video') {
    const workers = Math.max(1, parseInt(arg || '2', 10)), loops = +(a4 || 1);
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, 1)));
    const { D, w, h } = await pages[0].evaluate(() => ({ D: window.__piece.duration, w: window.__piece.width, h: window.__piece.height }));
    const N = Math.round(D * FPS);
    const ff = encoder(out, N, loops, w, h);
    const done = new Promise((res) => ff.on('close', res));
    const next = new Array(workers).fill(null);
    // frames of the first loop are cached as deflated raw buffers in RAM for the second loop (no disk dumps)
    const zlib = require('zlib'); const cache = loops > 1 ? [] : null;
    const start = (wk, f) => (next[wk] = f < N ? grab(pages[wk], f / FPS, 1).then((r) => ({ f, r })) : null);
    for (let wk = 0; wk < workers; wk++) start(wk, wk);
    for (let f = 0; f < N; f++) {
      const wk = f % workers;
      const { r } = await next[wk];
      start(wk, f + workers);
      const buf = Buffer.from(r.px, 'base64');
      if (cache) cache.push(zlib.deflateSync(buf, { level: 1 }));
      if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 30 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s  ${r.ms.toFixed(0)} ms`);
    }
    if (cache) for (let l = 1; l < loops; l++) for (const c of cache) { const buf = zlib.inflateSync(c); if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res)); }
    ff.stdin.end();
    await done;
    console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
  } else if (mode === 'seam' || mode === 'determinism') {
    const page = await openPage(browser, +(out || 0.5));
    const D = await page.evaluate(() => window.__piece.duration);
    const N = Math.round(D * FPS), fr = {};
    const get = async (f) => Buffer.from((await grab(page, f / FPS, 1)).px, 'base64');
    const st = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    if (mode === 'seam') {
      for (const f of [N - 3, N - 2, N - 1, 0, 1, 2]) fr[f] = await get(f);
      const fD = Buffer.from((await grab(page, D, 1)).px, 'base64');
      const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => st(fr[a], fr[b])), seam = st(fr[N - 1], fr[0]);
      const mx = Math.max(...ord), same = st(fD, fr[0]);
      const line = `render-level seam: step ${N - 1} -> 0 mean ${seam.toFixed(4)}; neighbouring steps ${ord.map((o) => o.toFixed(4)).join(' ')}; frame(t=D) vs frame(0) diff ${same.toFixed(5)}`;
      console.log(line);
      console.log(seam <= mx * 1.25 && same === 0 ? 'PASS  the loop closes: frame D is frame 0' : 'CHECK seam step stands out');
    } else {
      const ts = [0, 3.7, 11.3];
      let ok = true;
      for (const t of ts) { const a = Buffer.from((await grab(page, t, 1)).px, 'base64'); await grab(page, t + 5, 1); const b = Buffer.from((await grab(page, t, 1)).px, 'base64'); const d = st(a, b); console.log(`t=${t}: re-render diff ${d}`); if (d !== 0) ok = false; }
      console.log(ok ? 'PASS  deterministic: identical pixels' : 'FAIL  nondeterministic');
    }
  } else console.log('usage: see header');
  await browser.close();
})();
