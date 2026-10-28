// Render frames of one Fable Quest piece through its export hook.
//   node capture.mjs --id small-world --hook __smallworld --times 0,2.5,5 --dir out      (stills, PNG)
//   node capture.mjs --id small-world --hook __smallworld --from 0 --to 449 --fps 30 --dir frames   (video frames, JPEG q95)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { o[a[i].slice(2)] = a[i + 1]; i++; }
const W = +(o.w || 1080), H = +(o.h || 1350), dir = o.dir || 'out', hook = o.hook, fps = +(o.fps || 30);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
await page.goto(`file:///home/user/brain/unforgotten/index.html?solo&seed=${o.seed || 7}&export#${o.id}`);
await page.waitForFunction((h) => window[h] && window[h].isReady && window[h].isReady(), hook, { timeout: 120000, polling: 100 });
const clip = { x: 0, y: 0, width: W, height: H };
const shoot = async (t, p, type) => {
  await page.evaluate(async ([h, t]) => { await window[h].renderAt(t); }, [hook, t]);
  await page.screenshot({ path: p, clip, timeout: 0, ...(type === 'jpeg' ? { type: 'jpeg', quality: 95 } : {}) });
};
if (o.times) {
  for (const t of String(o.times).split(',').map(Number)) await shoot(t, `${dir}/t${t.toFixed(2).padStart(5, '0')}.png`, 'png');
} else {
  for (let f = +o.from; f <= +o.to; f++) {
    const p = `${dir}/f${String(f).padStart(4, '0')}.jpg`;
    if (fs.existsSync(p)) continue;
    await shoot(f / fps, p, 'jpeg');
    if (f % 60 === 0) console.log('frame', f);
  }
}
await browser.close(); console.log('done');
