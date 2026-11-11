// The poster: the film's final frame (T = 40.0, the clay DESKTOP hold) rendered natively at 3840x2160, graded like the film,
// with the HUD drawn at 2x. Writes poster.png and poster.jpg (quality 95, 4:4:4) to the video folder.
const path = require('path');
const fs = require('fs');
const L = require('./lib');
const F = L.F;
(async () => {
  const W = 3840, H = 2160, T = 40.0, slot = '06-clay-3d';
  const sec = await L.openSection(slot, { w: W, ss: process.argv[2] || 1 });
  const t0 = Date.now();
  const buf = await sec.frame(T);
  console.log('rendered in', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await L.closeBrowser();
  const G = JSON.parse(fs.readFileSync(path.join(L.FILM_DIR, 'grade.json'), 'utf8'))[slot] || { gain: [1, 1, 1], lift: [0, 0, 0] };
  const a = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length);
  for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) a[i + c] = Math.round(a[i + c] * G.gain[c] + G.lift[c] * (1 - a[i + c] / 255));
  F.hud(T, (x, y, w, h, rgb, al) => {
    const x0 = Math.round(x * 2), y0 = Math.round(y * 2), x1 = Math.round((x + w) * 2), y1 = Math.round((y + h) * 2);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * W + xx) * 4; for (let c = 0; c < 3; c++) a[i + c] += (rgb[c] - a[i + c]) * al; }
  });
  L.ensureDir(L.OUT_DIR);
  await L.png(buf, path.join(L.OUT_DIR, 'poster.png'), W, H);
  require('child_process').execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(L.OUT_DIR, 'poster.png'), '-pix_fmt', 'yuvj444p', '-q:v', '1', '-qmin', '1', path.join(L.OUT_DIR, 'poster.jpg')]);
  console.log('poster written');
})().catch((e) => { console.error(e); process.exit(1); });
