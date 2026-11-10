// Renders the piece frame by frame with Playwright.
//   node render.js stills <outdir> t1 t2 ...      -> still-tX.X.png
//   node render.js strip <out.png> [step]         -> contact sheet of every Nth frame (via ffmpeg tile)
//   node render.js video <out.mp4>                -> 90 frames, piped into ffmpeg
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const URL_ = 'file://' + path.join(__dirname, 'index.html') + '?export';
const FPS = 30, N = 90;

async function main() {
  const [mode, out, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__piece && window.__piece.isReady());
  console.log(JSON.stringify(await page.evaluate(() => window.__piece.info)));
  const frame = async (t) => {
    const b64 = await page.evaluate((t) => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png').slice(22); }, t);
    return Buffer.from(b64, 'base64');
  };
  if (mode === 'stills') {
    for (const ts of rest) { const t0 = Date.now(); fs.writeFileSync(path.join(out, `still-t${(+ts).toFixed(ts.length > 3 ? 2 : 1)}.png`), await frame(Math.min(+ts, 3))); console.log(ts, Date.now() - t0, 'ms'); }
  } else {
    const step = mode === 'strip' ? +(rest[0] || 3) : 1;
    const args = mode === 'strip'
      ? ['-y', '-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-vf', 'scale=640:360:flags=lanczos,tile=6x5:padding=4:color=0x333344', '-frames:v', '1', out]
      : ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
        '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-r', String(FPS), '-an', '-movflags', '+faststart', out];
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
    const done = new Promise((res) => ff.on('close', res));
    for (let i = 0; i < N; i += step) {
      const buf = await frame(i / FPS);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 10 === 0) console.log('frame', i);
    }
    ff.stdin.end(); await done;
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
