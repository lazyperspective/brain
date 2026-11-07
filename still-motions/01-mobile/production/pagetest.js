// Smoke test of the page: live mode with workers over file://, frozen frame, export hook.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const base = 'file://' + path.resolve(__dirname, '../index.html');
  const p = await (await b.newContext({ viewport: { width: 900, height: 1100 } })).newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message)); p.on('console', (m) => console.log('console', m.type(), m.text()));
  await p.goto(base); await p.waitForTimeout(12000);
  const out = process.argv[2];
  if (out) await p.screenshot({ path: out + '-live.png' });
  const fps = await p.evaluate(() => new Promise((res) => { const c = document.getElementById('art'); const g = c.getContext('2d'); let n = 0, last = g.getImageData(540, 400, 1, 1).data.join(); const t0 = performance.now(); const tick = () => { const v = g.getImageData(540, 400, 1, 1).data.join(); n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n); }; tick(); }));
  console.log('rAF ticks in 3 s', fps);
  await p.goto(base + '?export'); const r = await p.evaluate(() => { const r = window.__piece.renderAt(4); return [r, window.__piece.lastMs, window.__piece.duration]; }); console.log('export', JSON.stringify(r));
  await b.close();
})();
