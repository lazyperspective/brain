// Render "The Red Gathers" through its page and the render hook (window.__keyframes).
//   node render.js video <out.mp4>                 silent H.264, 1080 x 1920, 30 fps, every frame of the film
//   node render.js stills <dir> 0,1.5,3            PNGs of single frames
//   node render.js check                           bookend pixel-diffs (frame 0 vs keyframe 1, last frame vs keyframe 2)
//   node render.js debug <seg1|seg2> <out.png>     the segmentation of a keyframe
//   node render.js info                            build stats and the traveller's path
// The page reads the keyframes' pixels, which Chromium forbids on file://, so this serves the folder on a local port.
// Uses the pre-installed Playwright Chromium.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const [mode, out, arg] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
function png(rgbB64, file, w = 1080, h = 1920) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(Buffer.from(rgbB64, 'base64'));
  });
}
function diff(a, b) {
  let max = 0, sum = 0, n = 0, over2 = 0;
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; sum += d; if (d > 2) over2++; n++; }
  return { max, mean: sum / n, over2 };
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html?export`;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__keyframes && window.__keyframes.isReady(), null, { timeout: 180000 });
  const info = await page.evaluate(() => window.__keyframes.info());
  console.log('build', Math.round(info.buildMs), 'ms;', info.particles, 'particles');
  const frames = await page.evaluate(() => window.__keyframes.frames);
  if (process.env.ONLY) await page.evaluate((o) => { window.KEYFRAMES.only = o.split(','); }, process.env.ONLY);
  const grab = (t) => page.evaluate((t) => { const ms = window.__keyframes.renderAt(t); return { px: window.__keyframes.pixels(), ms }; }, t);

  if (mode === 'info') {
    console.log(JSON.stringify(info, null, 1));
  } else if (mode === 'debug') {
    await page.evaluate((w) => window.__keyframes.debug(w), out);
    const px = await page.evaluate(() => window.__keyframes.pixels());
    await png(px, arg);
    console.log(arg);
  } else if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of String(arg || '0').split(',').map(Number)) {
      const r = await grab(t);
      const p = path.join(out, 'kf-' + t.toFixed(2).padStart(5, '0') + '.png');
      await png(r.px, p);
      console.log(p, r.ms.toFixed(1) + ' ms');
    }
  } else if (mode === 'check') {
    const lines = [];
    const k1 = Buffer.from(await page.evaluate(() => window.__keyframes.keyframe(1)), 'base64');
    const k2 = Buffer.from(await page.evaluate(() => window.__keyframes.keyframe(2)), 'base64');
    for (const [label, t, k] of [['frame 0 (t=0.000) vs keyframe 1', 0, k1], ['frame 30 (t=1.000, first computed frame) vs keyframe 1', 1.0, k1],
      ['frame 31 (t=1.033) vs keyframe 1', 31 / 30, k1],
      [`frame 479 (t=15.967, last computed frame) vs keyframe 2`, 479 / 30, k2],
      ['frame 480 (t=16.000) vs keyframe 2', 16.0, k2], [`frame ${frames - 1} (last) vs keyframe 2`, (frames - 1) / 30, k2]]) {
      const r = await grab(t);
      const d = diff(Buffer.from(r.px, 'base64'), k);
      lines.push(`${label}: max |diff| ${d.max}, mean ${d.mean.toFixed(4)}, channel values off by >2: ${d.over2}`);
    }
    // the procedural layers alone, without the last half-second's settle onto the keyframe
    await page.evaluate(() => { window.KEYFRAMES.noSettle = true; });
    for (const t of [15.0, 15.35, 15.967]) {
      const r = await grab(t);
      const a = Buffer.from(r.px, 'base64');
      const d = diff(a, k2);
      let px8 = 0; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - k2[i]) > 8 || Math.abs(a[i + 1] - k2[i + 1]) > 8 || Math.abs(a[i + 2] - k2[i + 2]) > 8) px8++;
      lines.push(`procedural layers only (no settle) at t=${t} vs keyframe 2: mean |diff| ${d.mean.toFixed(4)}, max ${d.max}, pixels off by >8: ${px8} of ${1080 * 1920} (${(100 * px8 / (1080 * 1920)).toFixed(3)}%)`);
    }
    await page.evaluate(() => { window.KEYFRAMES.noSettle = false; });
    console.log(lines.join('\n'));
    if (out) fs.writeFileSync(out, lines.join('\n') + '\n');
  } else if (mode === 'video') {
    const N = frames;
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920', '-r', '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', '30',
      '-movflags', '+faststart', '-frames:v', String(N), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const t0 = Date.now();
    for (let f = 0; f < N; f++) {
      const r = await grab(f / 30);
      if (f >= 30 && f < 480) ms.push(r.ms);
      if (!ff.stdin.write(Buffer.from(r.px, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 60 === 0) console.log('frame', f, '/', N, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    ms.sort((a, b) => a - b);
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const report = `${out}: ${N} frames; computed frames (t 1.0-16.0) render ms/frame in Chromium avg ${avg.toFixed(1)}, median ${ms[ms.length >> 1].toFixed(1)}, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(1)}, worst ${ms[ms.length - 1].toFixed(1)}; build ${Math.round(info.buildMs)} ms`;
    console.log(report);
    fs.writeFileSync(out + '.timing.txt', report + '\n');
  } else {
    console.log('usage: node render.js video <out.mp4> | stills <dir> <t,...> | check [out.txt] | debug <seg1|seg2> <out.png> | info');
  }
  await browser.close();
  srv.close();
})();
