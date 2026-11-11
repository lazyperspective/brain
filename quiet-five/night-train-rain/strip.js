// Motion check: consecutive frames of one region side by side.
// usage: node strip.js out.png t0 n stepFrames x y w h [W H]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const [out, t0, n, step, x, y, w, h, WA, HA] = process.argv.slice(2);
  const W = +(WA || 1080), H = +(HA || 1350);
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto('file://' + path.join(__dirname, 'index.html') + `?export&w=${W}&h=${H}`);
  await p.waitForFunction(() => window.__piece && window.__piece.ready, null, { timeout: 600000 });
  const N = +n, bufs = [];
  for (let i = 0; i < N; i++) bufs.push(Buffer.from(await p.evaluate(t => __piece.frame(t), +t0 + i * (+step) / 30), 'base64'));
  await b.close();
  const cols = Math.min(N, 6), rows = Math.ceil(N / cols);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-',
    '-vf', `crop=${w}:${h}:${x}:${y},tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const bb of bufs) ff.stdin.write(bb);
  ff.stdin.end();
})();
