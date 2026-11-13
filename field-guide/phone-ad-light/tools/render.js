// node tools/render.js stills <t,t,..> <prefix> [w h] [query]
// node tools/render.js video <from> <to> <out.mp4> [w h] [query]   (frames [from*30, to*30) → H.264 CRF 12 intermediate)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const serve = require('./serve');
(async () => {
  const [mode, a, b, ...rest] = process.argv.slice(2), c = mode === 'video' ? rest.shift() : null, [w = 1920, h = 1080, extra = ''] = rest;
  const s = await serve(); const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.ACC ? [] : ['--disable-accelerated-2d-canvas'])] }); const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', e => { console.error('PAGEERROR', e.message); process.exit(1); }); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console', m.text().slice(0, 300)); });
  await pg.goto(`http://localhost:${s.address().port}/index.html?export&w=${w}&h=${h}${extra ? '&' + extra : ''}`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const grab = async t => Buffer.from((await pg.evaluate(t => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t)).split(',')[1], 'base64');
  if (mode === 'stills') { for (const t of a.split(',').map(Number)) { const t0 = Date.now(); fs.writeFileSync(`${b}-${t.toFixed(2)}.png`, await grab(t)); console.log(t.toFixed(2), ((Date.now() - t0) / 1000).toFixed(2) + 's'); } }
  else { const f0 = Math.round(+a * 30), f1 = Math.round(+b * 30), t0 = Date.now(); const tmp = c + '.part.mp4';
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', tmp]);
    for (let f = f0; f < f1; f++) { const buf = await grab(f / 30); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.renameSync(tmp, c); console.log(c, 'frames', f1 - f0, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
  await br.close(); s.close();
})();
