// Render "Phosphor" through its page (window.__piece) in the pre-installed Playwright Chromium, over file://.
//   node render.js stills <dir> 0,4.5,13 [prefix]   PNG frames at 2160x2700
//   node render.js video <out.mp4> [workers]         1080x1350 H.264 High yuv420p 30 fps, one loop; frames are rendered
//                                                    at 2160x2700 and box-downsampled 2x in the page (supersampling)
//                                                    MASTER=1: near-lossless master instead (for the seam check)
//   node render.js seam                              render-level seam check (exact frames, before video coding)
//   node render.js determinism                       renders the same t twice (and in a fresh page) and compares
//   node render.js timing [n]                        ms per frame
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export' + (process.env.PW ? '&w=' + process.env.PW : '');
const FPS = 30;

async function openPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 600, height: 750 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || process.env.VERBOSE) console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 600000, polling: 250 });
  return page;
}
const grab = (page, t, down) => page.evaluate(([t, down]) => { window.__piece.renderAt(t); return { px: down ? window.__piece.pixels(down) : null, ms: window.__piece.lastMs, timing: window.__piece.timing }; }, [t, down]);
const dims = (page) => page.evaluate(() => [window.__piece.width, window.__piece.height, window.__piece.duration]);

const ZONES = (n) => `zones=0,0,q=8/${n - 40},${n - 25},q=14/${n - 24},${n - 13},q=13/${n - 12},${n - 7},q=12/${n - 6},${n - 1},q=11`;
function encoder(out, nframes, w, h) {
  const master = !!process.env.MASTER;
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', ...(master ? ['-preset', 'veryfast', '-crf', '4'] : ['-preset', 'slow', '-crf', String(process.env.CRF || 16)]),
    '-x264-params', `keyint=${nframes}:min-keyint=${nframes}:scenecut=0${master ? '' : ':' + ZONES(nframes)}`,
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', '-frames:v', String(nframes), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
function savePng(file, buf, w, h) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(buf);
  });
}
const st = (a, b) => { let s = 0, n4 = 0; for (let i = 0; i < a.length; i += 3) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); s += d; if (d >= 4) n4++; } return [s / (a.length / 3), n4 / (a.length / 3)]; };

(async () => {
  const [mode, out, arg, arg2] = process.argv.slice(2);
  const browser = await chromium.launch();
  const t0 = Date.now();
  if (mode === 'stills') {
    const page = await openPage(browser);
    const [w, h] = await dims(page);
    console.log('build', (await page.evaluate(() => window.__piece && 0)) || '', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(page, t, 1);
      const p = path.join(out, (arg2 || 'phosphor') + '-' + t.toFixed(2).padStart(5, '0') + '.png');
      await savePng(p, Buffer.from(r.px, 'base64'), w, h);
      console.log(p, r.ms.toFixed(0) + ' ms', JSON.stringify(r.timing));
    }
  } else if (mode === 'timing') {
    const page = await openPage(browser);
    const n = +(out || 10);
    for (let i = 0; i < n; i++) { const r = await grab(page, i * 1.7, 0); console.log(r.ms.toFixed(0), JSON.stringify(r.timing)); }
  } else if (mode === 'video') {
    const workers = Math.max(1, parseInt(arg || '3', 10));
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
    const [w, h, D] = await dims(pages[0]);
    const N = Math.round(D * FPS);
    const ff = encoder(out, N, w / 2, h / 2);
    const done = new Promise((res) => ff.on('close', res));
    const next = new Array(workers).fill(null);
    const start = (wk, f) => (next[wk] = f < N ? grab(pages[wk], f / FPS, 2).then((r) => ({ f, r })) : null);
    for (let k = 0; k < workers; k++) start(k, k);
    let ms = 0;
    for (let f = 0; f < N; f++) {
      const k = f % workers;
      const { r } = await next[k];
      start(k, f + workers);
      ms += r.ms;
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    console.log(`video ${out}: ${N} frames, avg ${(ms / N).toFixed(0)} ms/frame in page, wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else if (mode === 'seam') {
    const page = await openPage(browser);
    const [, , D] = await dims(page);
    const N = Math.round(D * FPS), fr = {};
    for (const f of [N - 3, N - 2, N - 1, 0, 1, 2]) fr[f] = Buffer.from((await grab(page, f / FPS, 2)).px, 'base64');
    const frD = Buffer.from((await grab(page, D, 2)).px, 'base64');
    const ord = [[N - 3, N - 2], [N - 2, N - 1], [0, 1], [1, 2]].map(([a, b]) => st(fr[a], fr[b])), seam = st(fr[N - 1], fr[0]);
    const same = st(frD, fr[0]);
    const mx = Math.max(...ord.map((o) => o[0]));
    const line1 = `render-level seam: step ${N - 1} -> 0 mean ${seam[0].toFixed(3)} (share >= 4 levels ${(seam[1] * 100).toFixed(2)}%); neighbouring steps ${ord.map((o) => o[0].toFixed(3)).join(' ')}`;
    const line2 = `frame at t = D vs frame at t = 0: mean abs diff ${same[0].toFixed(4)}`;
    console.log(line1); console.log(line2);
    console.log(seam[0] <= mx * 1.25 && same[0] < 0.01 ? 'PASS  the loop closes: frame D is frame 0 and the seam is an ordinary step' : 'CHECK seam step stands out');
  } else if (mode === 'determinism') {
    const page = await openPage(browser);
    const ts = [0, 3.7, 11.25];
    let worst = 0;
    const first = {};
    for (const t of ts) first[t] = Buffer.from((await grab(page, t, 1)).px, 'base64');
    for (const t of ts.slice().reverse()) { const b = Buffer.from((await grab(page, t, 1)).px, 'base64'); worst = Math.max(worst, Buffer.compare(b, first[t]) === 0 ? 0 : st(b, first[t])[0] || 1e-9); }
    const page2 = await openPage(browser);
    for (const t of ts) { const b = Buffer.from((await grab(page2, t, 1)).px, 'base64'); worst = Math.max(worst, Buffer.compare(b, first[t]) === 0 ? 0 : st(b, first[t])[0] || 1e-9); }
    console.log(`determinism: t = ${ts.join(', ')} rendered twice in one page (other frames in between, reverse order) and once in a fresh page: ${worst === 0 ? 'byte-identical' : 'DIFFER, mean ' + worst}`);
    console.log(worst === 0 ? 'PASS' : 'FAIL');
  } else console.log('usage: node render.js stills|video|seam|determinism|timing');
  await browser.close();
})();
