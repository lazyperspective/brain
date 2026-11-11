// node tools/render.js <silent.mp4> [cache.mkv] [f0] [f1] [workers] [ss]
// Renders frames f0..f1 (default 0..1199) with several Playwright pages, streams them IN ORDER to ffmpeg:
// the delivery encode (H.264 High, yuv420p, CRF 14, BT.709 tagged, +faststart) and a near-lossless RGB cache that the
// stills, strips, contact sheet and flash check are cut from. Writes <silent.mp4>.render.json with the timing.
const L = require('./lib');
const fs = require('fs');
(async () => {
  const a = process.argv.slice(2);
  const out = a[0], cache = a[1] && a[1] !== '-' ? a[1] : null;
  const f0 = +(a[2] || 0), f1 = +(a[3] || 1199), nw = +(a[4] || 3), ss = +(a[5] || 2);
  const W = 1080, H = 1350;
  const browser = await L.chromium.launch();
  const pages = [];
  for (let i = 0; i < nw; i++) pages.push(await L.openPage(browser, { ss, scale: 1 }));
  const args = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', '30', '-i', '-',
    '-map', '0:v', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '14', '-tune', 'animation',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', out];
  if (cache) args.push('-map', '0:v', '-c:v', 'libx264rgb', '-preset', 'veryfast', '-crf', '4', cache);
  const ff = L.ff(args);
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  const got = new Map();
  let next = f0, write = f0, waiting = null;
  async function writer() {
    while (write <= f1) {
      while (!got.has(write)) await new Promise((r) => { waiting = r; });
      const buf = got.get(write); got.delete(write);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      write++;
      if (write % 30 === 0) {
        const el = (Date.now() - t0) / 1000, per = el / (write - f0);
        console.log('frame', write, '/', f1 + 1, (per).toFixed(2) + ' s/frame, eta ' + Math.round(per * (f1 + 1 - write)) + ' s');
      }
    }
    ff.stdin.end();
  }
  const w = writer();
  await Promise.all(pages.map(async (pg) => {
    while (next <= f1) {
      while (next - write > nw * 4) await new Promise((r) => setTimeout(r, 20));    // bound memory
      const f = next++;
      const buf = await pg.frame(f / 30);
      got.set(f, buf);
      if (waiting) { const r = waiting; waiting = null; r(); }
    }
  }));
  await w; await done;
  const sec = (Date.now() - t0) / 1000;
  await browser.close();
  const info = { frames: f1 - f0 + 1, workers: nw, ss, wallSeconds: Math.round(sec), secondsPerFrame: +(sec / (f1 - f0 + 1)).toFixed(3) };
  fs.writeFileSync(out + '.render.json', JSON.stringify(info, null, 1));
  console.log('rendered', JSON.stringify(info));
})().catch((e) => { console.error(e); process.exit(1); });
