// node tools/shot.js out.png t [ss] [camJSON]  : renders one frame through Playwright, prints timing
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const [out, t, ss, cam] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?export&ss=' + (ss || 2));
  await p.waitForFunction(() => window.__piece && window.__piece.ready, null, { timeout: 120000 });
  if (cam) await p.evaluate((c) => { const C = JSON.parse(c); FG.__camOverride = () => C; }, cam);
  const t0 = Date.now(); const info = await p.evaluate((t) => window.__piece.renderAt(t), +t); const t1 = Date.now();
  await p.evaluate((t) => window.__piece.renderAt(t), +t); const t2 = Date.now();
  const b64 = await p.evaluate(() => window.__piece.grab()); const t3 = Date.now();
  const W = info.W, H = info.H; const raw = out + '.rgba'; fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  require('child_process').execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-i', raw, out]); fs.unlinkSync(raw);
  console.log(JSON.stringify(info), 'first', t1 - t0, 'ms; second', t2 - t1, 'ms; grab', t3 - t2, 'ms');
  await b.close();
})();
