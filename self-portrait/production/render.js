// render.js — frame-by-frame render with Playwright, piped straight into ffmpeg (no frame dumps).
// node render.js out.mp4 [--loops 1] [--stats stats.json] [--nostream]
//  - native 480x270 RGBA frames are read from the page and scaled x4 nearest-neighbour by ffmpeg
//  - per-frame stats (sha1, mean luma, change measures) are written for the verification checks
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const crypto = require('crypto'), fs = require('fs'), path = require('path');
(async () => {
  const a = process.argv.slice(2), out = a[0];
  const opt = k => { const i = a.indexOf('--' + k); return i < 0 ? null : (a[i + 1] || true); };
  const loops = +(opt('loops') || 1), statsPath = opt('stats'), nostream = a.includes('--nostream');
  const NP = 4, W = 480, H = 270;
  const browser = await chromium.launch();
  const pages = [];
  for (let i = 0; i < NP; i++) {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.error('PAGEERROR', e.message); process.exit(1); });
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?export' + (opt('cut') ? '&cut=' + opt('cut') : ''));
    await p.waitForFunction('window.__piece && window.__piece.isReady()');
    pages.push(p);
  }
  const { duration, fps } = await pages[0].evaluate(() => ({ duration: window.__piece.duration, fps: window.__piece.fps }));
  const N = Math.round(duration * fps);
  let ff = null;
  if (!nostream) {
    ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(fps), '-i', '-',
      '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-tune', 'animation',
      '-preset', 'slow', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  }
  const stats = [];
  let prev = null, prev2 = null, first = null;
  const lum = new Float32Array(W * H), lum2 = new Float32Array(W * H);
  const t0 = Date.now();
  for (let l = 0; l < loops; l++) {
    for (let f0 = 0; f0 < N; f0 += NP) {
      const batch = [];
      for (let k = 0; k < NP && f0 + k < N; k++) batch.push(pages[k].evaluate(t => { window.__piece.renderAt(t); return window.__piece.raw(); }, (f0 + k) / fps));
      const res = await Promise.all(batch);
      for (let k = 0; k < res.length; k++) {
        const buf = Buffer.from(res[k], 'base64');
        if (ff && !ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (l === 0) {
          // stats: hash, mean luma, mean abs diff, fraction of pixels with a big luminance step up / down
          let sum = 0, diff = 0, up = 0, dn = 0, chg = 0, d2 = 0, cz = 0;
          for (let i = 0, j = 0; i < W * H; i++, j += 4) {
            const y = (0.2126 * buf[j] + 0.7152 * buf[j + 1] + 0.0722 * buf[j + 2]) / 255;
            sum += y;
            if (prev2) d2 += Math.abs(y - lum2[i]);
            if (prev) { const d = y - lum[i]; diff += Math.abs(d); if (d >= 0.1) up++; else if (d <= -0.1) dn++; if (Math.abs(d) >= 0.1) { const px = i % W, py = (i / W) | 0; if (px >= 204 && px < 276 && py >= 40 && py < 196) cz++; } if (buf[j] !== prev[j] || buf[j + 1] !== prev[j + 1] || buf[j + 2] !== prev[j + 2]) chg++; }
            lum2[i] = lum[i]; lum[i] = y;
          }
          stats.push({ f: f0 + k, sha: crypto.createHash('sha1').update(buf).digest('hex'), mean: sum / (W * H), diff: diff / (W * H), up: up / (W * H), dn: dn / (W * H), chg: chg / (W * H), d2: d2 / (W * H), cz: cz / (W * H) });
          prev2 = prev; prev = buf; if (!first) first = Float32Array.from(lum);
        }
      }
      if (f0 % 120 === 0) process.stderr.write(`  frame ${f0}/${N} loop ${l + 1}/${loops}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
    }
  }
  if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
  if (statsPath) { let sd = 0, su = 0, sdn = 0; for (let i = 0; i < W * H; i++) { const d = first[i] - lum[i]; sd += Math.abs(d); if (d >= 0.1) su++; else if (d <= -0.1) sdn++; } stats[0].diff = sd / (W * H); stats[0].up = su / (W * H); stats[0].dn = sdn / (W * H); stats[0].seam = true; fs.writeFileSync(statsPath, JSON.stringify(stats)); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
