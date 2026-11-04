#!/usr/bin/env node
// Production renderer for "02 - The Cliff Chapel".
// Usage:
//   node render.js                 -> full 2160x3840 + 1080x1920 downscale + review crops
//   node render.js --size 1080     -> quick half-size preview only (preview-1080.png)
//   node render.js --nocrops
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes('--' + name);

const SIZE = parseInt(opt('size', '2160'), 10);
const OUT_DIR = path.resolve(__dirname, '../../linework-output');
const CROP_DIR = path.join(OUT_DIR, 'crops-02');
const NAME = '02-the-cliff-chapel';

// Review crops in native (2160x3840) coordinates: [name, x, y, w, h]
const CROPS = [
  ['chapel', 1060, 60, 1100, 1000],
  ['bell', 1350, 60, 600, 560],
  ['upper-stairs', 1150, 700, 1010, 900],
  ['mid-stairs', 1150, 1400, 1010, 900],
  ['clouds', 300, 900, 1000, 1000],
  ['cloud-base', 300, 1700, 1000, 700],
  ['sea', 300, 2150, 1000, 900],
  ['canopy', 0, 0, 1200, 1000],
  ['trunk', 0, 1000, 900, 1300],
  ['roots', 0, 2600, 1000, 1240],
  ['foreground-stairs', 1000, 2700, 1160, 1140],
  ['landing', 400, 2900, 1200, 940],
  ['edge-top', 0, 0, 2160, 300],
];

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  const url = 'file://' + path.join(__dirname, 'index.html') + '?size=' + SIZE + '&noscale=1';
  await page.goto(url);
  await page.waitForFunction(() => window.__drawing && window.__drawing.ready === true, null, {
    timeout: 15 * 60 * 1000,
    polling: 500,
  });
  const ms = await page.evaluate(() => window.__drawing.ms);
  console.log(`rendered in-page in ${(ms / 1000).toFixed(1)}s`);

  const grab = async (sx, sy, sw, sh, dw, dh) =>
    page.evaluate(
      ([sx, sy, sw, sh, dw, dh]) => {
        const src = document.querySelector('canvas');
        const c = document.createElement('canvas');
        c.width = dw;
        c.height = dh;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
        return c.toDataURL('image/png').split(',')[1];
      },
      [sx, sy, sw, sh, dw, dh]
    );
  const save = (file, b64) => fs.writeFileSync(file, Buffer.from(b64, 'base64'));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const W = SIZE, H = Math.round(SIZE * 16 / 9);
  if (SIZE === 2160) {
    save(path.join(OUT_DIR, NAME + '.png'), await grab(0, 0, W, H, W, H));
    // high quality downscale in two halvings is overkill; one step with 'high' quality is fine
    save(path.join(OUT_DIR, NAME + '-1080.png'), await grab(0, 0, W, H, 1080, 1920));
    if (!flag('nocrops')) {
      fs.mkdirSync(CROP_DIR, { recursive: true });
      for (const [n, x, y, w, h] of CROPS) save(path.join(CROP_DIR, n + '.png'), await grab(x, y, w, h, w, h));
    }
    console.log('wrote', path.join(OUT_DIR, NAME + '.png'));
  } else {
    save(path.join(OUT_DIR, `preview-02-${SIZE}.png`), await grab(0, 0, W, H, W, H));
    console.log('wrote preview', SIZE);
  }
  await browser.close();
  console.log(`total ${(Date.now() - t0) / 1000}s`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
