// node render.js [scale] [mode]
//   mode "draft": writes preview + crops into /tmp-like work dir inside output/work
//   mode "final": writes the deliverables
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const S = parseFloat(process.argv[2] || '1');
const mode = process.argv[3] || 'draft';
const stage = process.argv[4] || '99';
const OUT = path.resolve(__dirname, '../../first-snow-output/fable');
const WORK = path.join(OUT, 'work');

// 100% crops: [name, x, y, w, h] in full-res coordinates
const CROPS = [
  ['focal', 892, 814, 900, 900],
  ['darkest', 0, 1640, 900, 900],
  ['busiest', 380, 560, 900, 900],
  ['corner', 1260, 1800, 900, 900],
];

function save(file, dataUrl) {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[error]', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?s=' + S + '&stage=' + stage);
  await page.waitForFunction('window.__done === true', null, { timeout: 0 });
  console.log('strokes', await page.evaluate('window.__strokes'), 'ms', Date.now() - t0);
  const grab = (x, y, w, h, ow, oh, type, q) => page.evaluate(([x, y, w, h, ow, oh, type, q]) => {
    const c = document.getElementById('c');
    const o = document.createElement('canvas'); o.width = ow; o.height = oh;
    const g = o.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(c, x, y, w, h, 0, 0, ow, oh);
    return o.toDataURL(type, q);
  }, [x, y, w, h, ow, oh, type, q]);
  const W = Math.round(2160 * S), H = Math.round(2700 * S);
  if (mode === 'final') {
    fs.mkdirSync(path.join(OUT, 'crops'), { recursive: true });
    save(path.join(OUT, 'first-snow-4k.png'), await page.evaluate(() => document.getElementById('c').toDataURL('image/png')));
    let q = 0.95, jpg;
    for (;;) {
      jpg = await page.evaluate(q => document.getElementById('c').toDataURL('image/jpeg', q), q);
      const bytes = Math.floor((jpg.length - 23) * 0.75);
      console.log('jpeg q', q, 'bytes', bytes);
      if (bytes < 4.8e6 || q <= 0.92) break;
      q = Math.round((q - 0.01) * 100) / 100;
    }
    save(path.join(OUT, 'first-snow-x.jpg'), jpg);
    for (const [n, x, y, w, h] of CROPS) save(path.join(OUT, 'crops', n + '.png'), await grab(x, y, w, h, w, h, 'image/png'));
  }
  fs.mkdirSync(WORK, { recursive: true });
  save(path.join(WORK, 'preview.jpg'), await grab(0, 0, W, H, 1080, 1350, 'image/jpeg', 0.92));
  if (S === 1) {
    for (const [n, x, y, w, h] of CROPS.concat([['sky', 1200, 60, 900, 900], ['mid', 300, 1100, 900, 900], ['bl', 0, 1800, 900, 900]])) save(path.join(WORK, n + '.jpg'), await grab(x, y, w, h, w, h, 'image/jpeg', 0.93));
  }
  if (process.argv[5]) save(process.argv[5], await page.evaluate(() => document.getElementById('c').toDataURL('image/png')));
  await browser.close();
  console.log('done', Date.now() - t0, 'ms');
})();
