// Export Act 2 through the browser page (Playwright): video, stills, contact sheet, snapshot.
// usage: node render.js [--video] [--stills] [--sheet] [--snapshot N] [--check]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const OUT = '/home/user/brain/starship-pixel-video/act2';
const W = 480, H = 270, FPS = 30, START = 30.1, END = 60.3;
const NF = Math.round((END - START) * FPS);   // 906
const args = process.argv.slice(2);
const has = (a) => args.includes(a);
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'snapshots'), { recursive: true });

function png(file, rgb, w, h, scale) {
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-',
    '-vf', `scale=${w * scale}:${h * scale}:flags=neighbor`, '-frames:v', '1', file], { input: rgb, maxBuffer: 1 << 28 });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?export');
  await page.waitForFunction(() => window.__act && window.__act.isReady());
  const grab = async (t) => Buffer.from(await page.evaluate((t) => window.__act.nativeRGB(t), t), 'base64');

  if (has('--check')) {
    // the native buffer scaled x4 nearest must equal the page canvas exactly
    const t = 50;
    await page.evaluate((t) => window.__act.renderAt(t), t);
    const big = Buffer.from(await page.evaluate(() => window.__act.canvasRGB()), 'base64');
    const nat = await grab(t);
    let diff = 0;
    for (let y = 0; y < 1080; y++) for (let x = 0; x < 1920; x++) {
      const a = (y * 1920 + x) * 3, b = ((y >> 2) * W + (x >> 2)) * 3;
      if (big[a] !== nat[b] || big[a + 1] !== nat[b + 1] || big[a + 2] !== nat[b + 2]) diff++;
    }
    console.log('canvas vs native x4 differing pixels:', diff);
  }

  if (has('--video')) {
    const file = path.join(OUT, 'act2.mp4');
    const ff = cp.spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', '-',
      '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-tune', 'animation',
      '-r', String(FPS), '-frames:v', String(NF), '-an', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < NF; i++) {
      const buf = await grab(START + i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 90 === 0) console.log('frame', i, '/', NF, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('video done', file);
  }

  if (has('--stills')) {
    const best = { '6a': 33.4, '6b': 42.6, '6c': 57.5 };
    for (const [k, t] of Object.entries(best)) {
      const f = await grab(t);
      png(path.join(OUT, 'stills', `shot${k}_native.png`), f, W, H, 1);
      png(path.join(OUT, 'stills', `shot${k}_1080p.png`), f, W, H, 4);
    }
    console.log('stills done');
  }

  const sheet = async (file) => {
    const ts = []; for (let k = 0; k <= 30; k++) ts.push(START + k);
    const cols = 6, rows = Math.ceil(ts.length / cols), SW = W * cols, SH = H * rows;
    const out = Buffer.alloc(SW * SH * 3);
    for (let k = 0; k < ts.length; k++) {
      const f = await grab(ts[k]);
      const cx = (k % cols) * W, cy = Math.floor(k / cols) * H;
      for (let y = 0; y < H; y++) f.copy(out, ((cy + y) * SW + cx) * 3, y * W * 3, (y + 1) * W * 3);
    }
    png(file, out, SW, SH, 1);
    console.log('sheet', file);
  };
  if (has('--sheet')) await sheet(path.join(OUT, 'contact_sheet.png'));
  const si = args.indexOf('--snapshot');
  if (si >= 0) await sheet(path.join(OUT, 'snapshots', `${/^\d+$/.test(args[si + 1]) ? 'round' : ''}${args[si + 1]}.png`));
  await browser.close();
})();
