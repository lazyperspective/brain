// Orchestration: build the plan, paint it, light it, show it. ?scale=0.5 for a fast half-size pass,
// ?plan shows the flat plan, ?nocells the plan before fracturing.
(function (G) {
  'use strict';
  const q = new URLSearchParams(location.search);
  const scale = +(q.get('scale') || 1);
  const W = Math.round(2160 * scale), H = Math.round(2700 * scale);
  const cv = document.getElementById('art');
  cv.width = W; cv.height = H;
  const msg = document.getElementById('msg');
  let ready = false;
  function run() {
    const t0 = performance.now();
    const plan = G.PLAN.build(W, H, scale, { noCells: q.has('nocells') });
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    if (q.has('plan') || q.has('nocells')) {
      const P = new G.Painter(W, H, scale);
      P.renderFlat(img.data, plan.tgt);
    } else {
      const P = G.PAINTING.paint(plan, W, H, scale, q);
      P.render(img.data, G.PAINTING.light);
    }
    ctx.putImageData(img, 0, 0);
    G.__stats = { ms: Math.round(performance.now() - t0) };
    if (msg) msg.remove();
    ready = true;
  }
  G.__piece = { isReady: () => ready, width: W, height: H };
  setTimeout(() => { try { run(); } catch (e) { console.error(e && e.stack || e); G.__error = String(e && e.stack || e); } }, 30);
})(window);
