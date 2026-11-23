// node render_pixel.js out.png '{"k":1.4,"face":"x","st":{...},"scale":3}'
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.error('PAGEERR', e.message));
  await p.goto('file://' + path.resolve(__dirname, 'pixel.html'));
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  for (const j of jobs) {
    const r = await p.evaluate(o => window.renderPixel(o), j.opts);
    fs.writeFileSync(j.out, Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(j.out.replace('.png', '.json'), JSON.stringify({ foot: r.foot, head: r.head }));
    console.log(j.out, r.foot);
  }
  await b.close();
})();
