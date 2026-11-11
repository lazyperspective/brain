// Render "Dawn, a Window, a Glass of Water" through index.html?export with the pre-installed Playwright Chromium.
//   node render.js still <out.png> <t> [size=2160] [res=2160]
//   node render.js frames <dir> <t,t,...> [size] [res]       PNG per t
//   node render.js video <out.mp4> [loops=1] [res=2160]        1080x1350 30fps H.264 (frames = 2x2 downsample of 2160 render)
//   node render.js rawframes <dir> <f0> <f1> [res]             1080 PNGs for frames f0..f1 (frame f = t f/30)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const [mode, out, a1, a2, a3] = process.argv.slice(2);

function ffpng(buf, w, h, file) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
    ff.stdin.end(buf);
  });
}

(async () => {
  const res = parseInt((mode === 'video' ? a2 : mode === 'rawframes' ? a3 : a3) || '2160', 10);
  const PAGE = 'file://' + path.resolve(__dirname, '../index.html') + '?export&res=' + res + (process.env.DETAIL ? '&detail' : '');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 } })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => console.log('[page]', m.text()));
  await page.goto(PAGE);
  await page.waitForFunction(() => !!window.__piece, null, { timeout: 60000 });
  const tb = Date.now();
  const bm = await page.evaluate(() => window.__piece.build());
  console.log('build', ((Date.now() - tb) / 1000).toFixed(1) + 's', JSON.stringify(bm));
  const grab = async (t, size) => {
    const r = await page.evaluate(([t, size]) => { const r = window.__piece.renderAt(t, { size, noBlit: true }); r.px = window.__piece.pixels(); return r; }, [t, size]);
    return { buf: Buffer.from(r.px, 'base64'), w: r.w, h: r.h, ms: r.ms };
  };
  if (mode === 'still') {
    const size = parseInt(a2 || '2160', 10);
    const r = await grab(parseFloat(a1 || '0'), size);
    await ffpng(r.buf, r.w, r.h, out);
    console.log(out, r.w + 'x' + r.h, r.ms.toFixed(0) + 'ms');
  } else if (mode === 'frames') {
    const size = parseInt(a2 || '1080', 10);
    fs.mkdirSync(out, { recursive: true });
    for (const t of a1.split(',').map(Number)) {
      const r = await grab(t, size);
      const f = path.join(out, 't' + t.toFixed(3).padStart(6, '0') + '.png');
      await ffpng(r.buf, r.w, r.h, f);
      console.log(f, r.ms.toFixed(0) + 'ms');
    }
  } else if (mode === 'rawframes') {
    fs.mkdirSync(out, { recursive: true });
    for (let f = parseInt(a1, 10); f <= parseInt(a2, 10); f++) {
      const r = await grab(f / 30, 1080);
      await ffpng(r.buf, r.w, r.h, path.join(out, 'f' + String(f).padStart(3, '0') + '.png'));
    }
  } else if (mode === 'video') {
    const loops = Math.max(1, parseInt(a1 || '1', 10));
    const N = 300;
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1350', '-r', '30', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', '14', '-tune', 'grain',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-r', '30', '-an', '-movflags', '+faststart', '-frames:v', String(N * loops), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ms = [];
    const t0 = Date.now();
    const RAW = process.env.RAW || out + '.raw';
    const raw = fs.openSync(RAW, 'w'); // keep the exact rgb frames for verification
    for (let f = 0; f < N; f++) {
      const r = await grab(f / 30, 1080);
      ms.push(r.ms);
      fs.writeSync(raw, r.buf);
      if (!ff.stdin.write(r.buf)) await new Promise((res) => ff.stdin.once('drain', res));
      if (f % 30 === 0) console.log('frame', f, '/', N, ((Date.now() - t0) / 1000).toFixed(0) + 's', r.ms.toFixed(0) + 'ms');
    }
    fs.closeSync(raw);
    // further loops come from the saved raw frames (identical pixels)
    for (let l = 1; l < loops; l++) {
      const fd = fs.openSync(RAW, 'r');
      const fb = Buffer.alloc(1080 * 1350 * 3);
      for (let f = 0; f < N; f++) {
        fs.readSync(fd, fb, 0, fb.length, f * fb.length);
        if (!ff.stdin.write(Buffer.from(fb))) await new Promise((res) => ff.stdin.once('drain', res));
      }
      fs.closeSync(fd);
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const rep = `frames ${N}, avg render ${avg.toFixed(0)} ms/frame in Chromium, total wall ${((Date.now() - t0) / 1000).toFixed(0)} s`;
    console.log(rep);
    fs.writeFileSync(out + '.timing.txt', rep + '\n');
  }
  await browser.close();
})();
