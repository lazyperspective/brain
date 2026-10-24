// Render the panorama and slice it into four carousel slides.
//   node render.mjs [--w=2160] [--preview]
// --w is the width of ONE slide in pixels (the panorama is four slides wide).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const w = +(args.find((a) => a.startsWith('--w=')) || '--w=1080').slice(4);
const preview = args.includes('--preview');
const outDir = path.join(here, preview ? 'preview' : 'output');
fs.mkdirSync(outDir, { recursive: true });
const names = ['01-the-design', '02-the-ascent', '03-the-sun', '04-the-sea'];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (!m.text().includes('willReadFrequently')) console.log('[page]', m.text()); });
const t0 = Date.now();
await page.goto(`file://${path.join(here, 'src', 'index.html')}?w=${w}`, { waitUntil: 'commit', timeout: 0 });
await page.waitForFunction(() => window.__done, null, { timeout: 0, polling: 500 });
const status = await page.evaluate(() => window.__done);
if (status !== 'ok') { console.error(status); process.exit(1); }

// crop (x in slide units 0..4) and optionally scale, returned as a data URL
const grab = (x0, x1, width, type, q) => page.evaluate(([x0, x1, width, type, q]) => {
  const c = document.getElementById('out'), sw = c.width / 4;
  const sx = Math.round(x0 * sw), ex = Math.round(x1 * sw);
  const p = document.createElement('canvas');
  p.width = width; p.height = Math.round(width * c.height / (ex - sx));
  const x = p.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(c, sx, 0, ex - sx, c.height, 0, 0, p.width, p.height);
  return p.toDataURL(type, q);
}, [x0, x1, width, type, q]);
const save = (file, url) => fs.writeFileSync(path.join(outDir, file), Buffer.from(url.split(',')[1], 'base64'));

if (preview) {
  save('panorama.jpg', await grab(0, 4, Math.min(4 * w, 3600), 'image/jpeg', 0.9));
} else {
  save('00-panorama.jpg', await grab(0, 4, Math.min(4 * w, 6000), 'image/jpeg', 0.92));
  for (let i = 0; i < 4; i++) {
    save(`${names[i]}.png`, await grab(i, i + 1, w, 'image/png'));
    if (w > 1080) save(`${names[i]}-1080x1920.png`, await grab(i, i + 1, 1080, 'image/png'));
  }
}
console.log(`panorama rendered at ${w}px per slide in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
