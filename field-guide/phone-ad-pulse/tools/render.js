// node tools/render.js stills <t,t,..> <prefix> <w> <h> [query]     query e.g. "ui=lock:0.8,listen:2.1" for flat UI previews
// node tools/render.js video <from> <to> <out.mp4> <w> <h> [crf]
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const serve = require('./serve');
(async () => {
  const [mode, a, b, c, w, h, extra = ''] = process.argv.slice(2); const s = await serve(); const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', e => { console.error('PAGEERROR', e.message); process.exit(1); }); pg.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  const [W, H] = mode === 'stills' ? [c, w] : [w, h], qs = mode === 'stills' ? h || '' : '';
  await pg.goto(`http://localhost:${s.address().port}/index.html?export&w=${W}&h=${H}&${qs}`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const grab = async t => Buffer.from((await pg.evaluate(t => { window.__piece.renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t)).split(',')[1], 'base64');
  if (mode === 'stills') { for (const t of a.split(',').map(Number)) { const t0 = Date.now(); fs.writeFileSync(`${b}-${t.toFixed(2)}.png`, await grab(t)); console.log(t, ((Date.now() - t0) / 1000).toFixed(1) + 's'); } }
  else { const f0 = Math.round(+a * 30), f1 = Math.round(+b * 30), t0 = Date.now(), crf = extra || '16', tmp = c.replace(/\.mp4$/, '.part.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', tmp]);
    for (let f = f0; f < f1; f++) { const buf = await grab(f / 30); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.renameSync(tmp, c); console.log(c, 'frames', f1 - f0, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
  await br.close(); s.close();
})();
