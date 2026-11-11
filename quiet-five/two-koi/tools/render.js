// Usage:
//   node render.js still <t> <out.png> [w h ss]
//   node render.js frames <out_dir> <t1,t2,...> [w h ss]
//   node render.js video <outdir>       (1080x1350, ss2, 360 frames -> loop-4x5.mp4 + stats)
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const INDEX = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?export';

async function open(w, h, ss) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 500 } });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(INDEX);
  await page.evaluate(([w, h, ss]) => window.__piece.init({ width: w, height: h, ss }), [w, h, ss]);
  return { browser, page };
}
async function grab(page, t) {
  await page.evaluate((t) => window.__piece.renderAt(t), t);
  const b = await page.evaluate(() => window.__piece.pixels());
  return Buffer.from(b, 'base64');
}
function savePNG(buf, w, h, out) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', out], { input: buf, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
}
function mad(a, b) { // mean abs diff over RGB
  let s = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3; }
  return s / n;
}

(async () => {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'still') {
    const [t, out, w = 2160, h = 2700, ss = 1] = args;
    const t0 = Date.now();
    const { browser, page } = await open(+w, +h, +ss);
    const buf = await grab(page, +t);
    savePNG(buf, +w, +h, out);
    console.log('still', out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    await browser.close();
  } else if (mode === 'frames') {
    const [dir, ts, w = 1080, h = 1350, ss = 1] = args;
    fs.mkdirSync(dir, { recursive: true });
    const { browser, page } = await open(+w, +h, +ss);
    for (const t of ts.split(',')) {
      const buf = await grab(page, +t);
      savePNG(buf, +w, +h, path.join(dir, `f_${(+t).toFixed(3)}.png`));
    }
    await browser.close();
  } else if (mode === 'video') {
    const [outdir, nfArg] = args;
    const W = 1080, H = 1350, FPS = 30, N = nfArg ? +nfArg : 12 * FPS;
    fs.mkdirSync(path.join(outdir, 'frames'), { recursive: true });
    const t0 = Date.now();
    const { browser, page } = await open(W, H, 2);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', '12', '-tune', 'grain', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', '-an', path.join(outdir, 'loop-4x5.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const keep = new Set([0, 1, 2, N - 3, N - 2, N - 1]);
    for (let k = 0; k < 12; k++) keep.add(Math.round(k * N / 12));
    let prev = null, first = null; const diffs = [];
    for (let i = 0; i < N; i++) {
      const buf = await grab(page, i / FPS);
      if (prev) diffs.push(mad(prev, buf)); else first = buf;
      if (keep.has(i)) savePNG(buf, W, H, path.join(outdir, 'frames', `f${String(i).padStart(3, '0')}.png`));
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      prev = buf;
      if (i % 30 === 0) console.log(`frame ${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    const seam = mad(prev, first);
    const endBuf = await grab(page, 12.0);
    const exact = mad(endBuf, first);
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    const sorted = diffs.slice().sort((a, b) => a - b);
    const stats = { frames: N, renderSeconds: (Date.now() - t0) / 1000, seamLastToFirst: seam, typicalMedian: sorted[sorted.length >> 1], typicalMean: diffs.reduce((a, b) => a + b, 0) / diffs.length, maxStep: sorted[sorted.length - 1], minStep: sorted[0], renderAt12_vs_renderAt0: exact, diffs };
    fs.writeFileSync(path.join(outdir, 'stats.json'), JSON.stringify(stats, null, 1));
    console.log(JSON.stringify({ ...stats, diffs: undefined }));
    await browser.close();
  }
})();
