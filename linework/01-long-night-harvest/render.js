#!/usr/bin/env node
/* Long Night Harvest — production render.
 *   node linework/01-long-night-harvest/render.js [--size 2160] [--no-crops] [--name 01-long-night-harvest]
 * Loads index.html over file:// in headless Chromium, waits for window.__drawing.ready,
 * writes the 2160x3840 master, a 1080x1920 downscale, a phone thumbnail and 1:1 review crops. */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const size = parseInt(opt('--size', '2160'), 10);
const name = opt('--name', '01-long-night-harvest');
const only = opt('--only', null);
const doCrops = !args.includes('--no-crops');
const root = __dirname;
const outDir = path.resolve(root, '..', '..', 'linework-output');
const cropDir = path.join(outDir, 'crops-01');

// review crops in native (2160) coordinates: [name, x, y, w, h]
const CROPS = [
  ['a-sky-top', 560, 60, 1000, 1000],
  ['b-vortex-left', 0, 900, 1000, 1000],
  ['c-planet', 860, 1120, 1100, 1100],
  ['d-slot-focal', 420, 1900, 1000, 760],
  ['e-oak', 0, 1450, 1000, 1100],
  ['f-midfield', 560, 2280, 1100, 700],
  ['g-right-hedge', 1300, 1900, 860, 900],
  ['h-fore-left', 0, 2780, 1080, 1060],
  ['i-fore-right', 1080, 2780, 1080, 1060],
  ['j-path-mid', 700, 2500, 800, 900],
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(cropDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /ERROR|streamlines|ms$|total/.test(t)) console.log('  ' + t); });
  const url = 'file://' + path.join(root, 'index.html') + '?size=' + size + (only ? '&only=' + only : '');
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__drawing && window.__drawing.ready, null, { timeout: 0, polling: 1000 });
  const ms = await page.evaluate(() => window.__drawing.ms);
  console.log(`rendered in ${(ms / 1000).toFixed(1)} s (wall ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  const save = (file, dataUrl) => { fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log(' -> ' + file); };
  const suffix = size === 2160 ? '' : '-s' + size;
  save(path.join(outDir, name + suffix + '.png'), await page.evaluate(() => document.getElementById('c').toDataURL('image/png')));
  // half-size and phone thumbnail, downscaled in steps for quality
  const scaled = await page.evaluate(() => {
    const src = document.getElementById('c');
    function down(c, w, h) {
      const o = document.createElement('canvas'); o.width = w; o.height = h;
      const x = o.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(c, 0, 0, w, h); return o;
    }
    const half = down(src, 1080, 1920);
    const thumb = down(half, 540, 960);
    return { half: half.toDataURL('image/png'), thumb: thumb.toDataURL('image/png') };
  });
  if (size === 2160) save(path.join(outDir, name + '-1080.png'), scaled.half);
  save(path.join(cropDir, '00-thumb-540.png'), scaled.thumb);
  if (doCrops) {
    for (const [cn, x, y, w, h] of CROPS) {
      const k = size / 2160;
      const data = await page.evaluate(([x, y, w, h]) => {
        const src = document.getElementById('c');
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        o.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
        return o.toDataURL('image/png');
      }, [Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k)]);
      save(path.join(cropDir, cn + '.png'), data);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
