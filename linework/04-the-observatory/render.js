// Production render for "The Observatory".
//   node render.js                 -> linework-output/04-the-observatory.png (2160x3840),
//                                     04-the-observatory-1080.png (1080x1920) and 1:1 crops in crops-04/
//   node render.js --skip=a,b      -> skip layers (debug)
//   node render.js --out=file.png  -> alternative output path for the full-size image
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2]] : [a, '']; }));
const outDir = path.resolve(__dirname, '../../linework-output');
const full = args.out ? path.resolve(args.out) : path.join(outDir, '04-the-observatory.png');
const half = path.join(outDir, '04-the-observatory-1080.png');
const cropDir = path.join(outDir, 'crops-04');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(cropDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const url = 'file://' + path.join(__dirname, 'index.html') + (args.skip ? '?skip=' + args.skip : '');
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__drawing && window.__drawing.ready, null, { timeout: 15 * 60 * 1000, polling: 500 });
  const info = await page.evaluate(() => window.__drawing);
  if (info.error) { console.error(info.error); await browser.close(); process.exit(1); }
  console.log('render ms', info.ms, 'wall', Date.now() - t0, JSON.stringify(info.log), JSON.stringify(info.stats || {}));
  const b64 = await page.evaluate(() => document.getElementById('c').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(full, Buffer.from(b64, 'base64'));
  await browser.close();
  if (!args.out) {
    const crops = {
      sky_pole: [960, 200, 700, 700],
      sky_mw: [100, 700, 800, 800],
      observatory: [1150, 1050, 640, 820],
      slit: [1330, 1100, 300, 360],
      ridge_path: [800, 1850, 760, 760],
      lower_path: [800, 2500, 900, 700],
      trees_left: [0, 1550, 800, 800],
      valley_mist: [0, 2300, 900, 700],
      massif_right: [1500, 1900, 660, 900],
      fg_left: [0, 3000, 900, 840],
      fg_right: [1250, 3100, 910, 740],
      edge_top: [1700, 0, 460, 460],
    };
    execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
full, half, cdir, crops = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
im = Image.open(full).convert('RGB')
im.resize((1080, 1920), Image.LANCZOS).save(half)
im.resize((540, 960), Image.LANCZOS).save(cdir + '/thumb-540.png')
for k, (x, y, w, h) in crops.items(): im.crop((x, y, x + w, y + h)).save('%s/%s.png' % (cdir, k))
print('wrote', half, 'and', len(crops), 'crops')
`, full, half, cropDir, JSON.stringify(crops)], { stdio: 'inherit' });
  }
  console.log('done', full);
})();
