// Opens the live page (index.html) from file:// at several film times, collects page errors, saves a sheet of screenshots.
//   node tools/livecheck.js <out.png>
const path = require('path');
const { chromium } = require('playwright');
const L = require('./lib');
(async () => {
  const b = await chromium.launch();
  const errors = [], shots = [];
  for (const t of [1.5, 5.0, 8, 13, 16.0, 19, 22.0, 24.6, 29, 32.0, 39]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', (e) => errors.push(t + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(t + ': console ' + m.text()); });
    await p.goto('file://' + path.join(L.FILM_DIR, 'index.html') + '?t=' + t);
    await p.waitForTimeout(t > 29 ? 9000 : 3500);
    shots.push(await p.screenshot());
    await p.close();
  }
  await b.close();
  // tile the screenshots with ffmpeg
  const fs = require('fs'), os = require('path'), dir = path.dirname(process.argv[2]);
  shots.forEach((s, i) => fs.writeFileSync(path.join(dir, 'live' + i + '.png'), s));
  require('child_process').execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(dir, 'live%d.png'), '-vf', 'scale=480:-1,tile=4x3:padding=4', '-frames:v', '1', process.argv[2]]);
  shots.forEach((s, i) => fs.unlinkSync(path.join(dir, 'live' + i + '.png')));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
