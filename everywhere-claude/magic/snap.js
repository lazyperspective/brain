// node snap.js <framesDir> <outDir> scene[:progress] ...  -> <outDir>/<scene>[_p].png
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [framesDir, outDir, ...specs] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(__dirname, 'patterns.html'));
  for (const s of specs) {
    const [scene, prog = '1'] = s.split(':');
    const url = 'data:image/png;base64,' + fs.readFileSync(path.join(framesDir, 'f_' + scene + '.png')).toString('base64');
    await p.evaluate(([sc, u, pr]) => window.render(sc, u, pr), [scene, url, +prog]);
    await (await p.$('#c')).screenshot({ path: path.join(outDir, scene + (prog === '1' ? '' : '_' + prog) + '.png') });
  }
  await b.close();
})();
