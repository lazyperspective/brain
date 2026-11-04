#!/usr/bin/env node
/* Production render: node render.js [--size 2160] [--crops] [--query "skip=print"]
   Writes ../../linework-output/03-the-bridge-keepers-light.png (2160x3840),
   03-the-bridge-keepers-light-1080.png (area-downsampled) and 1:1 review crops. */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const size = parseInt(arg('--size', '2160'), 10);
const extra = arg('--query', '');
const outName = arg('--out', '03-the-bridge-keepers-light');
const doCrops = args.includes('--crops') || size === 2160;

const OUT = path.resolve(__dirname, '../../linework-output');
const CROPS = path.join(OUT, 'crops-03');

const CROP_LIST = [
  ['sky-moon', 1000, 250, 700, 700],
  ['sky-milkyway', 700, 700, 800, 800],
  ['cliff-left-top', 250, 300, 800, 800],
  ['cliff-right', 1350, 900, 800, 800],
  ['gorge-far', 850, 1500, 700, 700],
  ['bridge', 700, 1700, 1100, 700],
  ['bridge-left-light', 600, 1900, 700, 700],
  ['hut', 50, 2150, 900, 800],
  ['lantern-boat', 650, 2450, 900, 800],
  ['water-mid', 1100, 2300, 900, 900],
  ['water-near', 1100, 3000, 1000, 840],
  ['foreground', 0, 3000, 1100, 840],
  ['tree', 500, 1200, 900, 900],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CROPS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  page.on('console', (m) => console.log('  ', m.text()));
  page.on('pageerror', (e) => console.log('PAGE ERROR', e));
  const url = 'file://' + path.join(__dirname, 'index.html') + `?size=${size}` + (extra ? '&' + extra : '');
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__drawing && window.__drawing.ready, null, { timeout: 15 * 60 * 1000, polling: 1000 });
  const info = await page.evaluate(() => window.__drawing);
  console.log('render ms', info.ms, 'wall', Date.now() - t0, info.error ? 'ERROR ' + info.error : '');

  const grab = async (expr) => {
    const b64 = await page.evaluate(expr);
    return Buffer.from(b64.split(',')[1], 'base64');
  };
  const suffix = size === 2160 ? '' : '-' + size;
  fs.writeFileSync(path.join(OUT, outName + suffix + '.png'), await grab(() => document.getElementById('c').toDataURL('image/png')));
  if (size === 2160) {
    // area-averaged downsample to 1080 for the phone version
    fs.writeFileSync(
      path.join(OUT, outName + '-1080.png'),
      await grab(() => {
        const src = document.getElementById('c');
        const c = document.createElement('canvas');
        c.width = 1080; c.height = 1920;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        x.drawImage(src, 0, 0, 1080, 1920);
        return c.toDataURL('image/png');
      })
    );
    // small thumbnail for phone-size check
    fs.writeFileSync(
      path.join(CROPS, 'thumb-540.png'),
      await grab(() => {
        const src = document.getElementById('c');
        const c = document.createElement('canvas');
        c.width = 540; c.height = 960;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(src, 0, 0, 540, 960);
        return c.toDataURL('image/png');
      })
    );
  }
  if (doCrops && size === 2160) {
    for (const [name, x, y, w, h] of CROP_LIST) {
      const buf = await grab(new Function(`
        const src = document.getElementById('c');
        const c = document.createElement('canvas');
        c.width = ${w}; c.height = ${h};
        c.getContext('2d').drawImage(src, ${x}, ${y}, ${w}, ${h}, 0, 0, ${w}, ${h});
        return c.toDataURL('image/png');`));
      fs.writeFileSync(path.join(CROPS, name + '.png'), buf);
    }
  }
  await browser.close();
  console.log('wrote', OUT);
})();
