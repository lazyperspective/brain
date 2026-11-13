#!/usr/bin/env node
// Render the painting headlessly and save it as PNG.
// usage: node tools/render.js [--scale 1] [--seed 7] [--out path/master.png]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const scale = parseFloat(args.scale || '1');
const seed = parseInt(args.seed || '7', 10);
const stopAfter = args.stop || null;
const debugDensity = !!args.density;
const out = path.resolve(args.out || path.join(__dirname, '../../../../field-guide-video/x-slats/firestorm-timeline/master.png'));

(async () => {
  const browser = await chromium.launch({ args: ['--js-flags=--max-old-space-size=8192'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  const url = 'file://' + path.resolve(__dirname, '../index.html') + '?norender=1';
  await page.goto(url);
  const t0 = Date.now();
  const b64 = await page.evaluate(
    async ({ scale, seed, stopAfter, debugDensity }) => {
      const c = document.getElementById('c');
      FS.debugDensity = debugDensity;
      await FS.render(c, { scale, seed, stopAfter, log: (m) => console.log(m) });
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
      return btoa(s);
    },
    { scale, seed, stopAfter, debugDensity }
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`wrote ${out} (${(Date.now() - t0) / 1000}s)`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
