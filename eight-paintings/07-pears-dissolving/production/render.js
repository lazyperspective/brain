// Usage: node render.js <out.png> [scale] [view] [extra query]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2];
  const scale = process.argv[3] || '1';
  const view = process.argv[4] || 'paint';
  const extra = process.argv[5] || '';
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html') + `?scale=${scale}&view=${view}${extra ? '&' + extra : ''}`;
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('console', m => console.log('[page]', m.text()));
  p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__done === true, null, { timeout: 0, polling: 500 });
  const ms = await p.evaluate(() => window.__ms);
  const data = await p.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', out, (ms / 1000).toFixed(1) + 's');
  await b.close();
})();
