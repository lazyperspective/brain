// Render the painting with Playwright.
//   node render.js                 -> render only, print stats
//   node render.js --round N       -> also save snapshots/roundN.png
//   node render.js --final         -> write first-snow-4k.png, first-snow-x.jpg and crops/
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const CODE = '/home/user/brain/first-snow/haiku';
const OUT = '/home/user/brain/first-snow-output/haiku';
const W = 2160, H = 2700;

const args = process.argv.slice(2);
const roundIdx = args.indexOf('--round');
const round = roundIdx >= 0 ? args[roundIdx + 1] : null;
const final = args.includes('--final');

const dataUrlToBuf = (u) => Buffer.from(u.split(',')[1], 'base64');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  page.setDefaultTimeout(900000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(CODE, 'index.html'));
  await page.waitForFunction(() => window.__done === true, null, { timeout: 900000, polling: 500 });
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); }
  const strokes = await page.evaluate(() => window.__strokes);
  console.log('strokes:', strokes);

  const png = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  if (round) {
    fs.mkdirSync(path.join(OUT, 'snapshots'), { recursive: true });
    const p = path.join(OUT, 'snapshots', `round${round}.png`);
    fs.writeFileSync(p, dataUrlToBuf(png));
    console.log('snapshot:', p);
  }

  if (final) {
    fs.mkdirSync(path.join(OUT, 'crops'), { recursive: true });
    const p4k = path.join(OUT, 'first-snow-4k.png');
    fs.writeFileSync(p4k, dataUrlToBuf(png));
    console.log('png:', p4k, fs.statSync(p4k).size);

    const jpg = await page.evaluate(() => document.getElementById('c').toDataURL('image/jpeg', 0.93));
    const pjpg = path.join(OUT, 'first-snow-x.jpg');
    fs.writeFileSync(pjpg, dataUrlToBuf(jpg));
    console.log('jpg:', pjpg, fs.statSync(pjpg).size);

    // Find darkest and busiest-texture 1000x1000 regions, then crop four 100% views.
    const crops = await page.evaluate(() => {
      const src = document.getElementById('c');
      const ctx = src.getContext('2d');
      const w = src.width, h = src.height;
      const d = ctx.getImageData(0, 0, w, h).data;
      const lum = (x, y) => { const o = (y * w + x) * 4; return 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; };
      const S = 1000, step = 100;
      let best = { dark: [Infinity, 0, 0], busy: [-Infinity, 0, 0] };
      for (let y0 = 0; y0 + S <= h; y0 += step) {
        for (let x0 = 0; x0 + S <= w; x0 += step) {
          let sum = 0, grad = 0, n = 0;
          for (let y = y0; y < y0 + S; y += 4) {
            for (let x = x0; x < x0 + S - 1; x += 4) {
              const L = lum(x, y);
              sum += L; n++;
              grad += Math.abs(lum(x + 1, y) - L) + Math.abs(lum(x, Math.min(h - 1, y + 1)) - L);
            }
          }
          const mean = sum / n, g = grad / n;
          if (mean < best.dark[0]) best.dark = [mean, x0, y0];
          if (g > best.busy[0]) best.busy = [g, x0, y0];
        }
      }
      const crop = (x, y, cw, ch) => {
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(src, x, y, cw, ch, 0, 0, cw, ch);
        return c.toDataURL('image/png');
      };
      return {
        focal: crop(1040, 920, 1000, 1000),
        dark: crop(best.dark[1], best.dark[2], 1000, 1000),
        busy: crop(best.busy[1], best.busy[2], 1000, 1000),
        corner: crop(src.width - 1000, src.height - 1000, 1000, 1000),
        info: { dark: best.dark, busy: best.busy },
      };
    });
    const names = { focal: 'focal-point', dark: 'darkest-area', busy: 'busiest-texture', corner: 'corner-bottom-right' };
    for (const k of Object.keys(names)) {
      if (k === 'info') continue;
      const p = path.join(OUT, 'crops', names[k] + '.png');
      fs.writeFileSync(p, dataUrlToBuf(crops[k]));
      console.log('crop:', p);
    }
    console.log('crop info:', JSON.stringify(crops.info));
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
