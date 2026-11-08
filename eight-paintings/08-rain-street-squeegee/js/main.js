// main.js — orchestrates: reference scene -> oil painting -> squeegee passes -> raking-light finish.
// URL params (optional): ?w=1080 (working width; default 2160), &stage=ref|paint|full
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const W = parseInt(q.get('w') || '2160', 10), H = Math.round(W * 1.25);
  const stage = q.get('stage') || 'full';
  const SEED = 80808;
  const cv = document.getElementById('c'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const T0 = performance.now();
  function log(m) { console.log(((performance.now() - T0) / 1000).toFixed(1) + 's ' + m); }
  function show(im) {
    const d = ctx.createImageData(W, H), a = d.data;
    for (let i = 0; i < W * H; i++) {
      a[i * 4] = Math.round(255 * P8.lin2s(im.r[i])); a[i * 4 + 1] = Math.round(255 * P8.lin2s(im.g[i])); a[i * 4 + 2] = Math.round(255 * P8.lin2s(im.b[i])); a[i * 4 + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
  }
  if (q.get('dbgy')) P8.DBG = { y: parseInt(q.get('dbgy'), 10), out: [] };
  const sc = P8.buildScene(W, H, SEED); log('scene');
  window.__scene = sc;
  if (stage === 'ref') { show(sc.ref); }
  else {
    const pt = P8.paint(sc, W, H, SEED + 1, log); log('paint');
    if (stage !== 'paint') { P8.squeegee(pt, sc, W, H, SEED + 2, log); log('squeegee'); }
    const fin = P8.finish(pt, W, H, SEED + 3); log('finish');
    show(fin);
    if (q.get('dbg')) window.__paint = pt;
  }
  window.exportPNG = function () { return cv.toDataURL('image/png'); };
  window.__done = true;
})();
