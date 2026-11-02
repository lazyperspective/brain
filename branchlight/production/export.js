#!/usr/bin/env node
/* Branchlight — export every slide at exactly 1080×1920 plus a contact sheet.
 *   node branchlight/production/export.js [--only 1,3] [--out DIR] [--no-sheet]
 * Loads index.html over file:// in headless Chromium and calls window.__branchlight.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(__dirname, '..');
const out = path.resolve(opt('--out', path.join(root, '..', 'branchlight-output')));
const only = opt('--only', null);
const sheet = !args.includes('--no-sheet');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto('file://' + path.join(root, 'index.html') + '?norender&bare');
  await page.waitForFunction(() => window.__branchlight);
  const { count, ids } = await page.evaluate(() => ({ count: __branchlight.count, ids: __branchlight.ids }));
  const want = only ? only.split(',').map((n) => parseInt(n, 10) - 1) : [...Array(count).keys()];
  for (const i of want) {
    const r = await page.evaluate((k) => __branchlight.png(k), i);
    const buf = Buffer.from(r.data.split(',')[1], 'base64');
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== 1080 || h !== 1920) throw new Error(`${ids[i]} is ${w}×${h}`);
    const file = path.join(out, ids[i] + '.png');
    fs.writeFileSync(file, buf);
    console.log(`${ids[i]}  ${w}×${h}  ${r.colours} colours  ${r.ms.toFixed(0)} ms  -> ${file}`);
  }
  if (sheet && !only) {
    const data = await page.evaluate(() => __branchlight.sheet());
    const file = path.join(out, 'carousel-sheet.png');
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log('contact sheet -> ' + file);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
