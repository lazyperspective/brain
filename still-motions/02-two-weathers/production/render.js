// Render "Two Weathers" through its page and export hook (window.__piece) in the pre-installed Playwright Chromium,
// over file:// (WebGL2 on SwiftShader).
//   node render.js still <out.png> <t> [w h ss]     one frame (default 2160x2700, scene supersampled ss x)
//   node render.js stills <dir> <t,t,...> [w h ss]  several frames
//   node render.js video <out.mp4> [workers] [loops] silent H.264 yuv420p 1080x1350 30 fps (scene 2160x2700 -> 2x area
//                                                  downscale in the resolve pass); one GOP with x264 zones at the seam
//   node render.js seam                             render-level seam check on exact frames
//   node render.js determinism                      same t twice -> identical pixels?
//   node render.js timing
// env RES=1080 builds the painting at half resolution (previews only).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const RES = process.env.RES ? '&res=' + process.env.RES : '';
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export' + RES;
const FPS = 30;

async function openPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 400, height: 500 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); process.exit(1); });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 600000, polling: 250 });
  return page;
}
const setOut = (page, w, h, ss) => page.evaluate(([w, h, ss]) => window.__piece.setOutput(w, h, ss), [w, h, ss]);
const grab = (page, t) => page.evaluate((t) => { const ms = window.__piece.renderAt(t); return { px: window.__piece.pixels(), ms }; }, t);
function toPng(rgb, w, h, file) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(rgb);
  });
}
// one GOP (keyframe at frame 0 only); zones give frame 0 a high fixed quality and ramp the last 40 frames up to
// meet it, so the encoded seam is an ordinary step (method from ink-courtyard/production/render.js)
const ZONES = (n) => `zones=0,0,q=10/${n - 40},${n - 25},q=15/${n - 24},${n - 13},q=14/${n - 12},${n - 7},q=13/${n - 6},${n - 1},q=12`;
function encoder(out, nframes, loopFrames, w, h) {
  const z = loopFrames === nframes ? ':' + ZONES(nframes) : '';
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-tune', 'grain', '-crf', String(process.env.CRF || 16),
    '-x264-params', `keyint=${nframes}:min-keyint=${nframes}:scenecut=0${z}`, '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-movflags', '+faststart', '-an', '-frames:v', String(nframes), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}

(async () => {
  const [mode, out, arg, a4, a5, a6] = process.argv.slice(2);
  // shared memory in /dev/shm (the default /tmp fallback breaks large WebGL uploads when the disk is short of space)
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--disable-dev-shm-usage'] });
  const t0 = Date.now();
  if (mode === 'still' || mode === 'stills') {
    const page = await openPage(browser);
    console.log('build', (await page.evaluate(() => window.__piece.buildMs)).toFixed(0), 'ms');
    const w = +(a4 || 2160), h = +(a5 || 2700), ss = +(a6 || 1);
    await setOut(page, w, h, ss);
    const ts = String(arg || '0').split(',').map(Number);
    if (mode === 'stills') fs.mkdirSync(out, { recursive: true });
    for (const t of ts) {
      const r = await grab(page, t);
      const p = mode === 'still' ? out : path.join(out, 'frame-' + t.toFixed(2).padStart(5, '0') + '.png');
      await toPng(Buffer.from(r.px, 'base64'), w, h, p);
      console.log(p, r.ms.toFixed(0) + ' ms');
    }
  } else if (mode === 'video') {
    const workers = Math.max(1, parseInt(arg || '3', 10)), loops = Math.max(1, parseInt(a4 || '1', 10));
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
    const D = await pages[0].evaluate(() => window.__piece.duration);
    const N = Math.round(D * FPS), W2 = 1080, H2 = 1350;
    for (const p of pages) await setOut(p, W2, H2, 1);
    // frames of one loop are rendered once and written loops times
    const ffs = [encoder(out, N * loops, N * loops === N ? N : -1, W2, H2)];
    if (process.env.ALSO2) ffs.push(encoder(process.env.ALSO2, 2 * N, -1, W2, H2));
    const done = ffs.map((ff) => new Promise((res) => ff.on('close', res)));
    const frames = [];
    const next = new Array(workers).fill(null);
    const start = (w, f) => (next[w] = f < N ? grab(pages[w], f / FPS) : null);
    for (let w = 0; w < workers; w++) start(w, w);
    const write = async (ff, buf) => { if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res)); };
    let ms = 0;
    for (let f = 0; f < N; f++) {
      const w = f % workers;
      const r = await next[w];
      start(w, f + workers);
      const buf = Buffer.from(r.px, 'base64');
      ms += r.ms;
      if (loops > 1 || ffs.length > 1) frames.push(buf);
      await write(ffs[0], buf);
      if (ffs[1]) await write(ffs[1], buf);
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s  avg ${(ms / (f + 1)).toFixed(0)} ms`);
    }
    for (let l = 1; l < loops; l++) for (const b of frames) await write(ffs[0], b);
    if (ffs[1]) for (const b of frames) await write(ffs[1], b);
    ffs.forEach((ff) => ff.stdin.end());
    await Promise.all(done);
    console.log(`wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else if (mode === 'seam') {
    const page = await openPage(browser);
    await setOut(page, 1080, 1350, 1);
    const D = await page.evaluate(() => window.__piece.duration);
    const N = Math.round(D * FPS), fr = {};
    for (const f of [N - 3, N - 2, N - 1, 0, 1, 2]) fr[f] = Buffer.from((await grab(page, f / FPS)).px, 'base64');
    const frD = Buffer.from((await grab(page, D)).px, 'base64');
    const st = (a, b) => { let s = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); s += d; if (d > mx) mx = d; } return [s / a.length, mx]; };
    const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => st(fr[a], fr[b])), seam = st(fr[N - 1], fr[0]), same = st(frD, fr[0]);
    const mx = Math.max(...ord.map((o) => o[0]));
    const msg = `render-level seam: step ${N - 1} -> 0 mean ${seam[0].toFixed(4)}; neighbouring steps ${ord.map((o) => o[0].toFixed(4)).join(' ')}; frame(t=D) vs frame(0): mean ${same[0].toFixed(4)} max ${same[1]}\n` +
      (seam[0] <= mx * 1.25 && same[1] <= 1 ? 'PASS  the loop closes: frame D is frame 0, and the seam step is an ordinary step' : 'FAIL  seam step stands out');
    console.log(msg);
  } else if (mode === 'determinism') {
    const pA = await openPage(browser);
    await setOut(pA, 1080, 1350, 1);
    const pB = await openPage(browser);
    await setOut(pB, 1080, 1350, 1);
    let worst = 0;
    for (const t of [0, 7.3, 15.95]) {
      const a = Buffer.from((await grab(pA, t)).px, 'base64');
      await grab(pA, 3.1);
      const b = Buffer.from((await grab(pA, t)).px, 'base64');
      const c = Buffer.from((await grab(pB, t)).px, 'base64');
      let d1 = 0, d2 = 0; for (let i = 0; i < a.length; i++) { d1 = Math.max(d1, Math.abs(a[i] - b[i])); d2 = Math.max(d2, Math.abs(a[i] - c[i])); }
      console.log(`t=${t}: same page max diff ${d1}, separate page (separate build) max diff ${d2}`);
      worst = Math.max(worst, d1, d2);
    }
    console.log(worst === 0 ? 'PASS  identical pixels' : 'FAIL  frames differ');
  } else if (mode === 'timing') {
    const page = await openPage(browser);
    console.log('build', (await page.evaluate(() => window.__piece.buildMs)).toFixed(0), 'ms');
    await setOut(page, 1080, 1350, 1);
    for (const t of [0, 1, 2]) console.log('frame', (await grab(page, t)).ms.toFixed(0), 'ms');
  } else console.log('usage: see header');
  await browser.close();
})();
