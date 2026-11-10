// usage: node render.js out.png [scale] [stage] [jpgOut]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2] || 'out.png';
  const scale = process.argv[3] || '1';
  const stage = process.argv[4] || 'all';
  const jpg = process.argv[5];
  const t0 = Date.now();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  p.on('console', m => console.log('[page]', m.text()));
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, 'index.html') + `?scale=${scale}&stage=${stage}`);
  await p.waitForFunction(() => window.__done || window.__err, null, { timeout: 0, polling: 1000 });
  const err = await p.evaluate(() => window.__err);
  if (err) { console.log('ERROR', err); await b.close(); process.exit(1); }
  const data = await p.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  if (jpg) {
    const q = parseFloat(process.env.JPGQ || '0.93');
    const d2 = await p.evaluate((q) => document.getElementById('c').toDataURL('image/jpeg', q), q);
    fs.writeFileSync(jpg, Buffer.from(d2.split(',')[1], 'base64'));
  }
  console.log('rendered in', ((Date.now() - t0) / 1000).toFixed(1), 's ->', out);
  await b.close();
})();
