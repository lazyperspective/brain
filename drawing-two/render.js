'use strict';
// node render.js [--scale 0.25] [--out file.png] [--crop x0,y0,x1,y1 (full units)] [--bands 8] [--half file.png]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const { Engine, encodePNG, half } = require('./engine.js');

const W = 3840, H = 2160;

if (!isMainThread) {
  const { scale, rect, only } = workerData;
  const t0 = Date.now();
  const E = new Engine({ W, H, scale, rect, paper: require('./scene.js').PAPER });
  require('./scene.js').draw(E, only);
  const rgb = E.toRGB8();
  parentPort.postMessage({ rgb, rect, ms: Date.now() - t0, strokes: E.nStrokes }, [rgb.buffer]);
} else {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const scale = parseFloat(opt('scale', '0.25'));
  const out = opt('out', path.join(__dirname, 'preview.png'));
  const crop = opt('crop', null);
  const only = opt('only', null);
  let X0 = 0, Y0 = 0, X1 = Math.round(W * scale), Y1 = Math.round(H * scale);
  if (crop) { const c = crop.split(',').map(Number); X0 = Math.round(c[0] * scale); Y0 = Math.round(c[1] * scale); X1 = Math.round(c[2] * scale); Y1 = Math.round(c[3] * scale); }
  const ow = X1 - X0, oh = Y1 - Y0;
  const nb = Math.min(parseInt(opt('bands', '8'), 10), oh);
  const jobs = [];
  for (let i = 0; i < nb; i++) jobs.push([X0, Y0 + Math.floor(oh * i / nb), X1, Y0 + Math.floor(oh * (i + 1) / nb)]);
  // start the heavy lower bands first
  jobs.reverse();
  const img = new Uint8Array(ow * oh * 3);
  let running = 0, done = 0; const t0 = Date.now(); let strokes = 0;
  const next = () => {
    while (running < 4 && jobs.length) {
      const rect = jobs.shift(); running++;
      const w = new Worker(__filename, { workerData: { scale, rect, only } });
      w.on('message', (m) => {
        const bw = m.rect[2] - m.rect[0], bh = m.rect[3] - m.rect[1];
        for (let y = 0; y < bh; y++) img.set(m.rgb.subarray(y * bw * 3, (y + 1) * bw * 3), ((m.rect[1] - Y0 + y) * ow) * 3);
        running--; done++; strokes = Math.max(strokes, m.strokes);
        process.stdout.write(`band ${done}/${nb} ${(m.ms / 1000).toFixed(1)}s strokes ${m.strokes}\n`);
        if (done === nb) finish(); else next();
      });
      w.on('error', (e) => { console.error(e); process.exit(1); });
    }
  };
  const finish = () => {
    fs.writeFileSync(out, encodePNG(img, ow, oh));
    const h = opt('half', null);
    if (h) fs.writeFileSync(h, encodePNG(half(img, ow, oh), ow >> 1, oh >> 1));
    console.log(`wrote ${out} ${ow}x${oh} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  };
  next();
}
