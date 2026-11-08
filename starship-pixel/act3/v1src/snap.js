// Render review stills: node snap.js out_dir t1 t2 ... [--big] [--crop x,y,w,h (native px, saved x4)]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const args = process.argv.slice(2);
  const out = args.shift();
  const big = args.includes('--big');
  let crop = null;
  const ci = args.indexOf('--crop');
  if (ci >= 0) { crop = args[ci + 1].split(',').map(Number); args.splice(ci, 2); }
  const times = args.filter(a => !a.startsWith('--')).map(Number);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => console.log('page:', m.text()));
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?export');
  for (const t of times) {
    const data = await page.evaluate(([t, big, crop]) => {
      window.__act.renderAt(t);
      if (crop) {
        const c = document.createElement('canvas'); c.width = crop[2] * 4; c.height = crop[3] * 4;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(document.getElementById('big'), crop[0] * 4, crop[1] * 4, crop[2] * 4, crop[3] * 4, 0, 0, crop[2] * 4, crop[3] * 4);
        return c.toDataURL('image/png');
      }
      return big ? window.__act.bigPNG() : window.__act.nativePNG();
    }, [t, big, crop]);
    const f = path.join(out, `t${t.toFixed(2)}${crop ? '_crop' : ''}${big ? '_big' : ''}.png`);
    fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
    console.log(f);
  }
  await browser.close();
})();
