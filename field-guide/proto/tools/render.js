// node tools/render.js <styleIndex|all> [still t] -> renders 3 s @30fps to field-guide-video/proto/
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs');
const OUT = path.resolve(__dirname, '../../../field-guide-video/proto'); fs.mkdirSync(OUT, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const arg = process.argv[2] || 'all', still = process.argv[3];
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 1400 } });
  await pg.goto(url + '?export&style=0'); const n = await pg.evaluate(() => window.__piece.count);
  const list = arg === 'all' ? [...Array(n).keys()] : arg.split(',').map(Number);
  for (const si of list) {
    await pg.goto(url + '?export&style=' + si);
    const grab = async t => Buffer.from((await pg.evaluate(t => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t)).split(',')[1], 'base64');
    const tag = String(si + 1).padStart(2, '0');
    if (still !== undefined) { const ts = still.split(',').map(Number); for (const t of ts) fs.writeFileSync(`${OUT}/s${tag}-t${t}.png`, await grab(t)); console.log('stills', si); continue; }
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', `${OUT}/style-${tag}.mp4`]);
    const t0 = Date.now();
    for (let f = 0; f < 90; f++) { const buf = await grab(f / 30); if (f === 66) fs.writeFileSync(`${OUT}/style-${tag}.png`, buf); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('style', si + 1, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await b.close();
})();
