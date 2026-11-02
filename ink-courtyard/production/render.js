// Render "The Moon Gate" through its page and render hook (window.__courtyard) in the pre-installed Playwright
// Chromium, over file://.
//   node render.js video <out.mp4> [workers]   silent H.264 yuv420p, 1080x1920, 30 fps, one loop; CRF=n (default 19);
//                                              -tune grain keeps the paper tooth steady between keyframes
//                                              frames are drawn by several pages (default 3) and encoded in order as
//                                              a single GOP (one keyframe, at frame 0)
//   node render.js stills <dir> 0,4.5,13       PNG frames at full resolution
//   node render.js timing [step]               ms per frame in Chromium (render only, no readback)
//   node render.js probe <out.json> [fps]      per-element visibility series for the pop check
//   node render.js seam                        render-level seam check (exact frames, before video coding)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export';
const FPS = 30, WD = 1080, HT = 1920;
const FF = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${WD}x${HT}`];

async function openPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__courtyard && window.__courtyard.isReady(), null, { timeout: 300000, polling: 200 });
  return page;
}
const grab = (page, t, px) => page.evaluate(([t, px]) => { window.__courtyard.renderAt(t); return { px: px ? window.__courtyard.pixels() : null, ms: window.__courtyard.lastMs }; }, [t, px]);

function encoder(out, nframes) {
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'grain', '-crf', String(process.env.CRF || 19), '-x264-params', `keyint=${nframes}:min-keyint=${nframes}:scenecut=0`, '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-movflags', '+faststart', '-frames:v', String(nframes), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}

(async () => {
  const [mode, out, arg] = process.argv.slice(2);
  const browser = await chromium.launch();
  const t0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser);
    console.log('build', (await page.evaluate(() => window.__courtyard.buildMs)).toFixed(0), 'ms');
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, true);
      const p = path.join(out, 'courtyard-' + t.toFixed(2).padStart(5, '0') + '.png');
      await new Promise((res, rej) => {
        const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...FF, '-i', '-', '-frames:v', '1', p], { stdio: ['pipe', 'inherit', 'inherit'] });
        ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
        ff.stdin.end(Buffer.from(r.px, 'base64'));
      });
      console.log(p, r.ms.toFixed(1) + ' ms');
    }
  } else if (mode === 'timing') {
    const page = await openPage(browser);
    const D = await page.evaluate(() => window.__courtyard.duration);
    const step = +(out || 1 / FPS), ms = [];
    for (let t = 0; t < D; t += step) ms.push([(await grab(page, t, false)).ms, t]);
    report(ms, 'timing');
  } else if (mode === 'probe') {
    const page = await openPage(browser);
    const fps = +(arg || FPS);
    const D = await page.evaluate(() => window.__courtyard.duration);
    const series = await page.evaluate(([D, fps]) => { const n = Math.round(D * fps), s = []; for (let f = 0; f <= n; f++) s.push(window.__courtyard.probe(f / fps)); return s; }, [D, fps]);
    fs.writeFileSync(out, JSON.stringify({ D, fps, series }));
    console.log('probe', out, series.length, 'samples');
  } else if (mode === 'video') {
    // Several pages render interleaved frames (worker w draws frames w, w+W, w+2W, ...) but ONE encoder takes them
    // in order, as a single GOP: the keyframe is frame 0 only, so every later frame inherits its coding of the
    // static paper grain and the step from the last frame back to the first is an ordinary step (no texture pulse
    // at keyframes or at the loop seam).
    const workers = Math.max(1, parseInt(arg || '3', 10));
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
    const D = await pages[0].evaluate(() => window.__courtyard.duration);
    const N = Math.round(D * FPS);
    const ff = encoder(out, N);
    const done = new Promise((res) => ff.on('close', res));
    const allMs = [];
    const next = new Array(workers).fill(null);
    const start = (w, f) => (next[w] = f < N ? grab(pages[w], f / FPS, true).then((r) => ({ f, r })) : null);
    for (let w = 0; w < workers; w++) start(w, w);
    for (let f = 0; f < N; f++) {
      const w = f % workers;
      const { r } = await next[w];
      start(w, f + workers);
      allMs.push([r.ms, f / FPS]);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 120 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    fs.writeFileSync(out + '.timing.txt', report(allMs, out) + `\nwall time ${((Date.now() - t0) / 1000).toFixed(0)} s with ${workers} workers\n`);
  } else if (mode === 'seam') {
    // render-level seam check: the step from the last frame (N-1) back to frame 0, against the steps around it,
    // on the exact frames the renderer makes (before any video coding)
    const page = await openPage(browser);
    const D = await page.evaluate(() => window.__courtyard.duration);
    const N = Math.round(D * FPS), fr = {};
    for (const f of [N - 3, N - 2, N - 1, 0, 1, 2]) fr[f] = Buffer.from((await grab(page, f / FPS, true)).px, 'base64');
    const st = (a, b) => { let s = 0, n4 = 0; for (let i = 0; i < a.length; i += 3) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); s += d; if (d >= 4) n4++; } return [s / (a.length / 3), n4 / (a.length / 3)]; };
    const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => st(fr[a], fr[b])), seam = st(fr[N - 1], fr[0]);
    const mx = Math.max(...ord.map((o) => o[0]));
    console.log(`render-level seam: step ${N - 1} -> 0 mean ${seam[0].toFixed(3)} (share >= 4 levels ${(seam[1] * 100).toFixed(2)}%); neighbouring steps ${ord.map((o) => o[0].toFixed(3)).join(' ')}`);
    console.log(seam[0] <= mx * 1.25 ? 'PASS  the loop closes: frame D is frame 0' : 'CHECK seam step stands out');
  } else console.log('usage: node render.js video <out.mp4> [workers] | stills <dir> <t,...> | timing [step] | probe <out.json> [fps]');
  await browser.close();
})();

function report(ms, label) {
  const v = ms.map((m) => m[0]).sort((a, b) => a - b), avg = v.reduce((a, b) => a + b, 0) / v.length;
  const worst = ms.slice().sort((a, b) => b[0] - a[0]).slice(0, 5).map((m) => m[1].toFixed(2) + 's:' + m[0].toFixed(1)).join(' ');
  const s = `${label}: ${ms.length} frames; Chromium ms/frame (draw only, 1080x1920) avg ${avg.toFixed(1)}, median ${v[v.length >> 1].toFixed(1)}, p95 ${v[Math.floor(v.length * 0.95)].toFixed(1)}, worst ${v[v.length - 1].toFixed(1)}\n  slowest: ${worst}`;
  console.log(s);
  return s;
}
