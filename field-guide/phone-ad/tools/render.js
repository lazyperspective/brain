// node tools/render.js <dir> stills <t,t,..> <prefix> [w h]   |   node tools/render.js <dir> video <from> <to> <out.mp4> [w h]
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const serve = require('./serve');
(async () => {
  const [dir, mode, a, b, ...rest] = process.argv.slice(2), c = mode === 'video' ? rest.shift() : null, [w = 1920, h = 1080] = rest; const s = await serve(); const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', e => { console.error('PAGEERROR', e.message); process.exit(1); }); pg.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  await pg.goto(`http://localhost:${s.address().port}/index.html?dir=${dir}&export&w=${w}&h=${h}`); await pg.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const grab = async t => Buffer.from((await pg.evaluate(t => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t)).split(',')[1], 'base64');
  if (mode === 'stills') { for (const t of a.split(',').map(Number)) fs.writeFileSync(`${b}-${t.toFixed(2)}.png`, await grab(t)); }
  else { const f0 = Math.round(+a * 30), f1 = Math.round(+b * 30), t0 = Date.now();
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', c]);
    for (let f = f0; f < f1; f++) { const buf = await grab(f / 30); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('frames', f1 - f0, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
  await br.close(); s.close();
})();
