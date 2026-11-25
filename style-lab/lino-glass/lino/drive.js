// usage: node drive.js stills s=2 t1,t2,...   |  node drive.js video s=6 out.mp4
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
(async () => {
  const [mode, sArg, arg] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto('file://' + path.join(__dirname, 'index.html') + '#' + sArg);
  await page.evaluate(() => window.init());
  const grab = async t => { const u = await page.evaluate(t => window.frame(t), t); return Buffer.from(u.split(',')[1], 'base64'); };
  if (mode === 'stills') {
    for (const t of arg.split(',').map(Number)) { const t0 = Date.now(); fs.writeFileSync(path.join(__dirname, '..', 'frames', `lino_${t.toFixed(2)}.png`), await grab(t)); console.log('t', t, (Date.now() - t0) / 1000 + 's'); }
  } else if (mode === 'pic') {
    const u = await page.evaluate(t => window.picture(t), Number(arg)); fs.writeFileSync(path.join(__dirname, '..', 'frames', 'pic.png'), Buffer.from(u.split(',')[1], 'base64'));
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '2', arg], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < 90; f++) { const t0 = Date.now(); const b = await grab(f / 30); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r)); if (f % 10 === 0) console.log('frame', f, (Date.now() - t0) / 1000 + 's'); if (process.env.KEEP && process.env.KEEP.split(',').includes(String(f))) fs.writeFileSync(path.join(__dirname, '..', 'frames', `keep_${f}.png`), b); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
