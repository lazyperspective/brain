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
const dims = (page) => page.evaluate(() => [window.__piece.width, window.__piece.height, window.__piece.duration, window.__piece.buildMs]);

// A single GOP keeps static texture from pulsing at keyframes, but then the only keyframe is frame 0, which at CRF
// gets less fidelity than the P-frames build up: the step from the last frame back to frame 0 stands out. Zones:
// frame 0 at a high fixed quality and the last 40 frames ramped up to meet it (from ink-courtyard/production/render.js).
const ZONES = (n) => `zones=0,0,q=10/${n - 40},${n - 25},q=16/${n - 24},${n - 13},q=15/${n - 12},${n - 7},q=14/${n - 6},${n - 1},q=13`;
function encoder(out, nframes, W, H) {
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(process.env.CRF || 16),
    '-x264-params', `keyint=${nframes}:min-keyint=${nframes}:scenecut=0:${ZONES(nframes)}`,
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-movflags', '+faststart', '-frames:v', String(nframes), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
function savePng(rgb, W, H, p) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(rgb);
  });
}

(async () => {
  const [mode, out, arg, arg2] = process.argv.slice(2);
  const browser = await chromium.launch();
  const t0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser, arg2 === '4k');
    const [W, H, , bms] = await dims(page);
    console.log(`build ${bms.toFixed(0)} ms at ${W}x${H}`);
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, true);
      const p = path.join(out, 'frame-' + t.toFixed(2).padStart(5, '0') + '.png');
      await savePng(Buffer.from(r.px, 'base64'), W, H, p);
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
    const page = await openPage(browser, false);
    const [, , D] = await dims(page);
    const N = Math.round(D * FPS), fr = {};
    for (const f of [N - 3, N - 2, N - 1, N, 0, 1, 2]) fr[f] = Buffer.from((await grab(page, f / FPS, true)).px, 'base64');
    const st = (a, b) => { let s = 0, n4 = 0; for (let i = 0; i < a.length; i += 3) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); s += d; if (d >= 4) n4++; } return [s / (a.length / 3), n4 / (a.length / 3)]; };
    const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => st(fr[a], fr[b])), seam = st(fr[N - 1], fr[0]);
    const same = Buffer.compare(fr[N], fr[0]) === 0;
    const mx = Math.max(...ord.map((o) => o[0]));
    console.log(`frame at t = D (${D} s) identical to frame at t = 0: ${same ? 'yes, byte for byte' : 'NO'}`);
    console.log(`render-level seam: step ${N - 1} -> 0 mean ${seam[0].toFixed(3)} (share >= 4 levels ${(seam[1] * 100).toFixed(2)}%); neighbouring steps ${ord.map((o) => o[0].toFixed(3)).join(' ')}`);
    console.log(seam[0] <= mx * 1.25 && same ? 'PASS  the loop closes' : 'CHECK seam');
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
