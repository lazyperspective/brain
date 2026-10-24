// Render paintings headlessly: node render.mjs <name...> [--w=1080] [--preview]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith('--'));
const w = +(args.find((a) => a.startsWith('--w=')) || '--w=1080').slice(4);
const previewOnly = args.includes('--preview');
const outDir = path.join(here, previewOnly ? 'preview' : 'output');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
await Promise.all(names.map(async (name) => {
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[${name}]`, m.text()));
  const t0 = Date.now();
  await page.goto(`file://${path.join(here, 'src', 'index.html')}?p=${name}&w=${w}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 0, polling: 500 });
  const status = await page.evaluate(() => window.__done);
  if (status !== 'ok') { console.error(name, status); return; }
  const save = async (file, width, type, q) => {
    const url = await page.evaluate(([width, type, q]) => {
      const c = document.getElementById('out');
      if (width === c.width) return c.toDataURL(type, q);
      const p = document.createElement('canvas');
      p.width = width; p.height = Math.round(width * c.height / c.width);
      const x = p.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(c, 0, 0, p.width, p.height);
      return p.toDataURL(type, q);
    }, [width, type, q]);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  };
  if (previewOnly) await save(path.join(outDir, `${name}.jpg`), Math.min(w, 900), 'image/jpeg', 0.9);
  else {
    await save(path.join(outDir, `${name}.png`), w, 'image/png');
    if (w > 1080) await save(path.join(outDir, `${name}-1080x1920.png`), 1080, 'image/png');
  }
  console.log(`${name} rendered at ${w}px in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.close();
}));
await browser.close();
