// usage: node preview.js outdir t1 t2 ...   -> writes native RGB frames as PNG (via ffmpeg) scaled x5
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const [outdir, ...ts] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => console.log('page:', m.text()));
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?export');
  for (const t of ts) {
    const t0 = Date.now();
    const b64 = await page.evaluate(([t,nb]) => { window.__piece.DBG.noBeam = nb; return window.__piece.frameRGB(t); }, [parseFloat(t), !!process.env.NOBEAM]);
    const raw = path.join(outdir, `f_${t}.rgb`);
    fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '216x270', '-i', raw,
      '-vf', 'scale=1080:1350:flags=neighbor', path.join(outdir, `t_${t}.png`)]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '216x270', '-i', raw,
      path.join(outdir, `n_${t}.png`)]);
    console.log('t', t, Date.now() - t0, 'ms');
  }
  await browser.close();
})();
