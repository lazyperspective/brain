// usage: node still.js out.png t [w h]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const [out, tArg, wA, hA] = process.argv.slice(2);
  const w = parseInt(wA || '1080'), h = parseInt(hA || '1350'), t = parseFloat(tArg || '7');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 800, height: 1000 } });
  p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.log('[err]', e.message));
  const t0 = Date.now();
  await p.goto('file://' + path.join(__dirname, 'index.html') + `?export&w=${w}&h=${h}`);
  await p.waitForFunction(() => window.__piece && window.__piece.ready, null, { timeout: 600000 });
  console.log('init ms', Date.now() - t0, await p.evaluate(() => JSON.stringify([__piece.periodic, __piece.info])));
  const t1 = Date.now();
  const b64 = await p.evaluate(([t, o]) => __piece.frame(t, o), [t, JSON.parse(process.env.OPTS || "{}")]);
  console.log('frame ms', Date.now() - t1);
  const buf = Buffer.from(b64, 'base64');
  await new Promise(res => { const f = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', out]); f.on('close', res); f.stdin.end(buf); });
  await b.close();
})();
