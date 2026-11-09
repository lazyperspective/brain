// Render the piece through its page and render hook (window.__piece) in the pre-installed Playwright Chromium,
// over file://. Every frame is a pure function of t.
//   node render.js video <out.mp4> [workers]     silent H.264 High yuv420p, 1920x1080, 30 fps, exactly one loop;
//                                                CRF=n (default 16). Frames are drawn by several pages (default 2)
//                                                and encoded in order by one ffmpeg, as a single GOP.
//   node render.js stills <dir> 0,4.5,13 [4k]    PNG frames (4k: 3840x2160)
//   node render.js seam                          render-level seam check (exact frames, before video coding)
//   node render.js determinism                   the same frames from two fresh pages, byte for byte
//   node render.js timing                        ms per frame
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const FPS = 30;
const pageUrl = (k4) => 'file://' + path.resolve(__dirname, '../index.html') + '?export' + (k4 ? '&res=4k' : '') + (process.env.SS ? '&ss=' + process.env.SS : '') + (process.env.LOOK ? '&look=' + process.env.LOOK : '');

async function openPage(browser, k4) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(pageUrl(k4));
  await page.waitForFunction(() => window.__piece && (window.__piece.isReady() || window.__piece.error), null, { timeout: 1800000, polling: 500 });
  const err = await page.evaluate(() => window.__piece.error);
  if (err) throw new Error(err);
  return page;
}
const grab = (page, t, px) => page.evaluate(([t, px]) => { window.__piece.renderAt(t); return { px: px ? window.__piece.pixels() : null, ms: window.__piece.lastMs }; }, [t, px]);
const dims = (page) => page.evaluate(() => [window.__piece.native[0], window.__piece.native[1], window.__piece.duration, window.__piece.buildMs]);

// A single GOP keeps static texture from pulsing at keyframes, but then the only keyframe is frame 0, which at CRF
// gets less fidelity than the P-frames build up: the step from the last frame back to frame 0 stands out. Zones:
// frame 0 at a high fixed quality and the last 40 frames ramped up to meet it (from ink-courtyard/production/render.js).
const ZONES = (n) => `zones=0,0,q=10/${n - 40},${n - 25},q=16/${n - 24},${n - 13},q=15/${n - 12},${n - 7},q=14/${n - 6},${n - 1},q=13`;
function encoder(out, nframes, W, H) {
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=iw*4:ih*4:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(process.env.CRF || 16),
    '-x264-params', `keyint=${nframes}:min-keyint=${nframes}:scenecut=0:${ZONES(nframes)}`,
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-movflags', '+faststart', '-frames:v', String(nframes), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
function savePng(rgb, W, H, p, scale) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-vf', `scale=iw*${scale}:ih*${scale}:flags=neighbor`, '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(rgb);
  });
}

(async () => {
  const [mode, out, arg, arg2] = process.argv.slice(2);
  const browser = await chromium.launch();
  const t0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser, false);
    const [W, H, , bms] = await dims(page);
    console.log(`build ${bms.toFixed(0)} ms at ${W}x${H}`);
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, true);
      const p = path.join(out, 'frame-' + t.toFixed(2).padStart(5, '0') + '.png');
      await savePng(Buffer.from(r.px, 'base64'), W, H, p, arg2 === '4k' ? 8 : arg2 === '1x' ? 1 : 4);
      console.log(p, r.ms.toFixed(0) + ' ms');
    }
  } else if (mode === 'timing') {
    const page = await openPage(browser, false);
    const ms = [];
    for (let t = 0; t < 2; t += 1 / FPS) ms.push((await grab(page, t, false)).ms);
    console.log('ms/frame avg', (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1));
  } else if (mode === 'video') {
    const workers = Math.max(1, parseInt(arg || '2', 10));
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, false)));
    const [W, H, D] = await dims(pages[0]);
    const N = Math.round(D * FPS);
    const ff = encoder(out, N, W, H);
    const done = new Promise((res) => ff.on('close', res));
    const next = new Array(workers).fill(null);
    const start = (w, f) => (next[w] = f < N ? grab(pages[w], f / FPS, true).then((r) => ({ f, r })) : null);
    for (let w = 0; w < workers; w++) start(w, w);
    for (let f = 0; f < N; f++) {
      const w = f % workers;
      const { r } = await next[w];
      start(w, f + workers);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    console.log(`wall time ${((Date.now() - t0) / 1000).toFixed(0)} s with ${workers} workers`);
  } else if (mode === 'seam') {
    // render-level seam check on the exact native frames: the frame at t = D must be the frame at t = 0, and the step
    // from the last frame back to the first must be an ordinary step. The wet roof's shimmer advances every 4th
    // frame, so steps alternate between "within a block" and "across a block boundary" (479 -> 0 is a boundary):
    // the seam is compared with all steps and with the boundary steps.
    const page = await openPage(browser, false);
    const [, , D] = await dims(page);
    const N = Math.round(D * FPS);
    const st = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const first = Buffer.from((await grab(page, 0, true)).px, 'base64');
    let prev = first; const steps = [];
    for (let f = 1; f <= N; f++) { const cur = Buffer.from((await grab(page, f / FPS, true)).px, 'base64'); steps.push([f - 1, st(prev, cur)]); if (f === N) { const same = Buffer.compare(cur, first) === 0; console.log(`frame at t = D (${D} s) identical to frame at t = 0: ${same ? 'yes, byte for byte' : 'NO'}`); } prev = cur; }
    const seam = steps[N - 1][1];
    const all = steps.slice(0, N - 1).map((x) => x[1]).sort((a, b) => a - b), bnd = steps.slice(0, N - 1).filter((x) => (x[0] + 1) % 4 === 0).map((x) => x[1]).sort((a, b) => a - b);
    const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))];
    console.log(`render-level seam step ${N - 1} -> 0 (= ${N - 1} -> ${N}): mean abs difference ${seam.toFixed(3)} (0-255 per channel)`);
    console.log(`all ${all.length} other steps: median ${q(all, 0.5).toFixed(3)}, 95th pct ${q(all, 0.95).toFixed(3)}, max ${all[all.length - 1].toFixed(3)}`);
    console.log(`the ${bnd.length} other block-boundary steps: median ${q(bnd, 0.5).toFixed(3)}, 95th pct ${q(bnd, 0.95).toFixed(3)}, max ${bnd[bnd.length - 1].toFixed(3)}`);
    console.log(seam <= q(bnd, 0.95) ? 'PASS  the seam step is an ordinary (block-boundary) step' : 'CHECK seam step stands out');
  } else if (mode === 'determinism') {
    const ts = [0, 2.6, 7.1, 10.4, 13.3];
    const a = await openPage(browser, false), b = await openPage(browser, false);
    let ok = true;
    for (const t of ts) {
      const pa = (await grab(a, t, true)).px, pb = (await grab(b, t, true)).px;
      // also render out of order on page a and come back
      await grab(a, 15.9, false);
      const pa2 = (await grab(a, t, true)).px;
      const s = pa === pb && pa === pa2;
      ok = ok && s;
      console.log(`t=${t}: two pages ${pa === pb ? 'identical' : 'DIFFER'}, re-render after another t ${pa === pa2 ? 'identical' : 'DIFFERS'}`);
    }
    console.log(ok ? 'PASS  deterministic' : 'FAIL');
  } else console.log('usage: node render.js video <out.mp4> [workers] | stills <dir> <t,...> [4k] | seam | determinism | timing');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
