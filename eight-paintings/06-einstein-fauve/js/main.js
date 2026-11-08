(function (G) {
  'use strict';
  const q = new URLSearchParams(location.search);
  const cv = document.getElementById('c');
  const msg = document.getElementById('msg');
  if (q.has('preview')) {
    const k = +(q.get('k') || 0.8);
    cv.width = 1000 * k; cv.height = 1250 * k;
    G.drawPreview(cv.getContext('2d'), k);
    msg.textContent = ''; G.__done = true;
    return;
  }
  if (q.has('plan')) {
    cv.width = 1000; cv.height = 1250;
    G.drawPlan(cv.getContext('2d'), 1);
    msg.textContent = ''; G.__done = true;
    return;
  }
  if (q.has('test')) {
    const W = 800, H = 500; cv.width = W; cv.height = H;
    const P = new G.Painter(W, H, 1, 7);
    const mk = (x0, y0, x1, y1, w, n) => { const xs = [], ys = [], ws = []; for (let i = 0; i <= n; i++) { const t = i / n; xs.push(x0 + (x1 - x0) * t); ys.push(y0 + (y1 - y0) * t + 30 * Math.sin(t * 3)); ws.push(w * (t < 0.9 ? 1 : 1 - (t - 0.9) * 4)); } return [xs, ys, ws]; };
    let a = mk(50, 80, 750, 120, 40, 60); P.stroke(a[0], a[1], a[2], { col: [0.9, 0.3, 0.1], imp: 1 });
    a = mk(50, 220, 750, 240, 14, 120); P.stroke(a[0], a[1], a[2], { col: [0.95, 0.95, 0.9], imp: 1 });
    a = mk(100, 380, 700, 300, 60, 30); P.stroke(a[0], a[1], a[2], { col: [0.1, 0.3, 0.8], imp: 1 });
    const out = G.lightSurface(P, { weaveAmp: 0.9, paintAmp: 2.6, gradScale: 0.7, diffuse: 0.62, specPow: 20, gloss: 0.2, shadowScale: 0.5 });
    cv.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0); G.__done = true; msg.textContent = ''; return;
  }
  // Full painting. ?scale=1 renders the 2160 x 2700 master; smaller scales are quick proofs.
  const scale = +(q.get('scale') || (q.has('export') ? 1 : 0.5));
  const seed = +(q.get('seed') || 1905);
  const W = Math.round(2160 * scale), H = Math.round(2700 * scale);
  cv.width = W; cv.height = H;
  const t0 = performance.now();
  const log = (s) => { const m = s + ' ' + ((performance.now() - t0) / 1000).toFixed(1) + 's'; console.log(m); msg.textContent = m; };
  setTimeout(() => {
    const plan = G.buildPlan();
    log('plan');
    const P = new G.Painter(W, H, scale, seed);
    log('canvas');
    G.paintPortrait(P, plan, seed, log);
    const out = G.lightSurface(P, { weaveAmp: 0.9, paintAmp: 2.6, gradScale: 0.7, diffuse: 0.62, specPow: 20, gloss: 0.2, shadowScale: 0.5 });
    const img = new ImageData(out, W, H);
    cv.getContext('2d').putImageData(img, 0, 0);
    log('done');
    msg.textContent = '';
    G.__done = true;
  }, 30);
})(window);
