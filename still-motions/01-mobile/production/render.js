// Render "Mobile" through its page (index.html?export, window.__piece) in the pre-installed Playwright Chromium.
//   node render.js video <out.mp4> [pages=3]     one loop, 1080x1350, 30 fps, H.264 High yuv420p CRF 16 (seam zones)
//                                                LOSSLESS=1: exact RGB master (libx264rgb qp 0) instead
//   node render.js encode <master.mkv> <out.mp4>  delivery encode of a LOSSLESS master
//                                                frames rendered at 2160x2700 and box-filtered in linear light
//   node render.js stills <dir> <t,t,...> [s=1]   PNG frames: s=1 -> 1080x1350, s=2 -> 2160x2700 (from 4320x5400)
//   node render.js seam                           render-level seam check on the exact frames (before video coding)
//   node render.js determinism                    the same t rendered twice (and in another page) is identical
//   node render.js timing                         ms per frame
// env: CRF (default 16), MASTER=1 (near-lossless CRF 4 for checks)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export';
const FPS = 30;

async function openPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 600, height: 760 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 120000 });
  return page;
}
const grab = (page, t, s, down) => page.evaluate(([t, s, down]) => { const r = window.__piece.renderAt(t, s, down); return { w: r.w, h: r.h, px: window.__piece.pixels(), ms: window.__piece.lastMs }; }, [t, s || 1, down || 2]);

// One GOP (keyframe at frame 0 only); frame 0 coded near-losslessly and the last 60 frames ramped up to meet it
// (tuned on an exact RGB master: frame 0 q4, frames N-60..N-31 q8, N-30..N-1 q4), so the step from the last frame back to the first is an ordinary step (see ink-courtyard/production/render.js).
const ZONES = (n) => process.env.ZONES ? process.env.ZONES.replace(/N(-?\d+)/g, (_, d) => String(n + +d)) : `zones=0,0,q=4/${n - 60},${n - 31},q=8/${n - 30},${n - 1},q=4`;
function encoder(out, n, W, H) {
  const master = !!process.env.MASTER;
  if (process.env.LOSSLESS) // exact RGB intermediate for re-encoding (render once, tune the delivery encode from it)
    return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'rgb24', '-r', String(FPS), '-frames:v', String(n), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', master ? 'veryfast' : 'slow', ...(master ? [] : ['-tune', 'grain']), '-crf', master ? '4' : String(process.env.CRF || 16),
    '-x264-params', `keyint=${n}:min-keyint=${n}:scenecut=0` + (master ? '' : ':' + ZONES(n)),
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', '-frames:v', String(n), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
function savePng(file, r) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${r.w}x${r.h}`, '-i', '-', '-frames:v', '1', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(Buffer.from(r.px, 'base64'));
  });
}
const step = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

(async () => {
  const [mode, out, arg, arg2] = process.argv.slice(2);
  const browser = await chromium.launch();
  const T0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser), s = +(arg2 || 1);
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, s, 2);
      const f = path.join(out, `mobile-${s === 2 ? '4k' : 'hd'}-t${t.toFixed(2).padStart(5, '0')}.png`);
      await savePng(f, r);
      console.log(f, r.w + 'x' + r.h, r.ms.toFixed(0) + ' ms');
    }
  } else if (mode === 'video') {
    const nPages = Math.max(1, parseInt(arg || '3', 10));
    const pages = await Promise.all(Array.from({ length: nPages }, () => openPage(browser)));
    const D = await pages[0].evaluate(() => window.__piece.duration), N = Math.round(D * FPS);
    const ff = encoder(out, N, 1080, 1350), done = new Promise((r) => ff.on('close', r));
    const next = new Array(nPages).fill(null), ms = [];
    const start = (w, f) => (next[w] = f < N ? grab(pages[w], f / FPS).then((r) => ({ f, r })) : null);
    for (let w = 0; w < nPages; w++) start(w, w);
    for (let f = 0; f < N; f++) {
      const w = f % nPages, { r } = await next[w];
      start(w, f + nPages);
      ms.push(r.ms);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - T0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end(); await done;
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    console.log(`${out}: ${N} frames, ${avg.toFixed(0)} ms/frame in page, wall ${((Date.now() - T0) / 1000).toFixed(0)} s`);
  } else if (mode === 'seam') {
    const page = await openPage(browser);
    const D = await page.evaluate(() => window.__piece.duration), N = Math.round(D * FPS), fr = {};
    for (const f of [N - 3, N - 2, N - 1, N, 0, 1, 2]) fr[f] = Buffer.from((await grab(page, f / FPS)).px, 'base64');
    const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => step(fr[a], fr[b]));
    const seam = step(fr[N - 1], fr[0]), same = step(fr[N], fr[0]);
    const line = `render-level seam: frame(t=D) vs frame(0) mean abs diff ${same.toFixed(4)}; step ${N - 1} -> 0 ${seam.toFixed(3)}; neighbouring steps ${ord.map((o) => o.toFixed(3)).join(' ')}`;
    console.log(line);
    console.log(same === 0 && seam <= Math.max(...ord) * 1.25 ? 'PASS  frame D == frame 0 and the seam step is an ordinary step' : 'FAIL');
  } else if (mode === 'determinism') {
    const a = await openPage(browser), b = await openPage(browser);
    let worst = 0;
    for (const t of [0, 3.7, 11.2, 19.9]) {
      const r1 = Buffer.from((await grab(a, t)).px, 'base64');
      await grab(a, t + 5); // something else in between
      const r2 = Buffer.from((await grab(a, t)).px, 'base64'), r3 = Buffer.from((await grab(b, t)).px, 'base64');
      let d = 0; for (let i = 0; i < r1.length; i++) d = Math.max(d, Math.abs(r1[i] - r2[i]), Math.abs(r1[i] - r3[i]));
      worst = Math.max(worst, d);
      console.log(`t=${t}: max channel difference, same page ${'and'} a second page: ${d}`);
    }
    console.log(worst === 0 ? 'PASS  identical pixels' : 'FAIL');
  } else if (mode === 'encode') {
    // re-encode a near-lossless master (MASTER=1 video) with the delivery settings: node render.js encode <master> <out>
    const N = 600, ff = encoder(arg, N, 1080, 1350), done = new Promise((r) => ff.on('close', r));
    const dec = spawn('ffmpeg', ['-loglevel', 'error', '-i', out, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
    dec.stdout.pipe(ff.stdin);
    await done;
    console.log('encoded', arg);
  } else if (mode === 'steps') {
    // Whole-loop check in memory (nothing written): every frame at 540x675 (rendered 1080x1350, box-filtered).
    // Frame-to-frame mean abs step (pop: a step > 1.5x both neighbours and above a floor), and the mean relative
    // luminance of the whole frame and of 9 quarter windows (flash: any frame-to-frame change >= 0.10).
    const page = await openPage(browser);
    const res = await page.evaluate(() => {
      const P = window.__piece, N = Math.round(P.duration * 30), W = 540, H = 675;
      const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
      let prev = null, first = null; const steps = [], lum = [];
      const core = P; const out = [];
      for (let f = 0; f <= N; f++) {
        P.renderAt(f / 30, 0.5, 2);
        const d = P._last().data;
        const Y = new Float32Array(W * H);
        for (let i = 0, p = 0; p < W * H; i += 4, p++) Y[p] = 0.2126 * lin[d[i]] + 0.7152 * lin[d[i + 1]] + 0.0722 * lin[d[i + 2]];
        const wins = [[0, 0, W, H]]; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) wins.push([Math.round(i * W / 4), Math.round(j * H / 4), W >> 1, H >> 1]);
        lum.push(wins.map(([x0, y0, w, h]) => { let s = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) s += Y[y * W + x]; return s / (w * h); }));
        const cur = new Uint8Array(d);
        if (prev) { let s = 0; for (let i = 0; i < cur.length; i += 4) s += Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2]); steps.push(s / (W * H * 3)); }
        else first = cur;
        if (f === N) { let s = 0; for (let i = 0; i < cur.length; i++) s = Math.max(s, Math.abs(cur[i] - first[i])); out.push(s); }
        prev = cur;
      }
      return { steps, lum, endVsStart: out[0] };
    });
    const st = res.steps, n = st.length; let pops = 0, worst = 0;
    for (let i = 0; i < n; i++) { const a = st[(i - 1 + n) % n], b = st[(i + 1) % n], r = st[i] / Math.max(a, b, 0.01); worst = Math.max(worst, r); if (r > 1.5 && st[i] > 0.05) pops++; }
    let flash = 0; for (let w = 0; w < 10; w++) for (let f = 0; f < res.lum.length - 1; f++) flash = Math.max(flash, Math.abs(res.lum[f + 1][w] - res.lum[f][w]));
    const srt = st.slice().sort((a, b) => a - b);
    console.log(`render-level whole loop (${n} steps at 540x675): step median ${srt[n >> 1].toFixed(3)}, max ${srt[n - 1].toFixed(3)}; most isolated step ${worst.toFixed(2)}x its larger neighbour; pops (>1.5x both neighbours) ${pops}`);
    console.log(`largest frame-to-frame change of mean relative luminance (whole frame and 9 quarter windows): ${flash.toFixed(5)} (flash threshold 0.10); frame N vs frame 0 max channel difference ${res.endVsStart}`);
    console.log(pops === 0 && flash < 0.1 && res.endVsStart === 0 ? 'PASS' : 'FAIL');
  } else if (mode === 'timing') {
    const page = await openPage(browser);
    const v = []; for (let t = 0; t < 20; t += 2.5) v.push((await grab(page, t)).ms);
    console.log('ms per frame (2160x2700 -> 1080x1350):', v.map((x) => x.toFixed(0)).join(' '));
  }
  await browser.close();
})();
