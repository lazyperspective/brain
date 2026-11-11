// Render the loop with Playwright and pipe it into ffmpeg.
// usage: node export.js <outDir> <rawFramesFile> [stillT]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { spawn, execFileSync } = require('child_process');

const W = 216, H = 270, FPS = 30, LOOP = 8, N = FPS * LOOP;

function ffmpegEncode(outFile, args) {
  const p = spawn('ffmpeg', args.concat([outFile]), { stdio: ['pipe', 'inherit', 'inherit'] });
  return p;
}

(async () => {
  const outDir = process.argv[2];
  const rawFile = process.argv[3];
  const stillT = process.argv[4] !== undefined ? parseFloat(process.argv[4]) : null;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?export');

  const vf = 'scale=1080:1350:flags=neighbor+full_chroma_int+accurate_rnd:out_color_matrix=bt709:out_range=tv,format=yuv420p';
  const enc = ffmpegEncode(path.join(outDir, 'loop-4x5.mp4'), [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', vf,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '12', '-tune', 'animation',
    '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-frames:v', String(N), '-an', '-movflags', '+faststart',
  ]);
  const raw = fs.openSync(rawFile, 'w');
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const b64 = await page.evaluate(t => window.__piece.frameRGB(t), f / FPS);
    const buf = Buffer.from(b64, 'base64');
    fs.writeSync(raw, buf);
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
  }
  fs.closeSync(raw);
  enc.stdin.end();
  await new Promise(r => enc.on('close', r));
  const renderMs = Date.now() - t0;
  console.log('render+encode ms', renderMs);
  fs.writeFileSync(path.join(path.dirname(rawFile), 'render_ms.txt'), String(renderMs));

  // the same loop three times, for posting
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '2', '-i', path.join(outDir, 'loop-4x5.mp4'),
    '-c', 'copy', '-movflags', '+faststart', path.join(outDir, 'loop-4x5-x3.mp4')]);

  if (stillT !== null) {
    // still rendered by the page itself at 2160x2700 (x10 nearest-neighbour of the native grid)
    const dataUrl = await page.evaluate(t => window.__piece.renderAt(t, { scale: 10 }).toDataURL('image/png'), stillT);
    fs.writeFileSync(path.join(outDir, 'still-4k.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const nat = await page.evaluate(t => window.__piece.frameRGB(t), stillT);
    fs.writeFileSync(path.join(path.dirname(rawFile), 'still_native.rgb'), Buffer.from(nat, 'base64'));
  }
  await browser.close();
})();
