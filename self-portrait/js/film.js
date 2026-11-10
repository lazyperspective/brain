// film.js — timeline + transitions. renderAt(t) is a pure function of t.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, TL = g.TL;
  const W = 480, H = 270;
  const A = P.mk(W, H, 0), B = P.mk(W, H, 0);
  // copy the inside of a rectangle from src into dst (a window onto another shot)
  function win(dst, src, x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    for (let y = y0; y < y1; y++) dst.d.set(src.d.subarray(y * W + x0, y * W + x1), y * W + x0);
  }
  // ordered-dither dissolve that opens outward from a point (k: 0 = all dst, 1 = all src)
  function radial(dst, src, k, cx, cy) {
    const dd = dst.d, sd = src.d;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const dx = x - cx, dy = (y - cy) * 1.25, d = Math.sqrt(dx * dx + dy * dy) / 300;
      if ((P.bay(x, y) + 0.5) / 16 < k * 1.9 - d * 0.9) dd[i] = sd[i];
    }
  }
  function frame(t) {
    t = ((t % TL.D) + TL.D) % TL.D;
    const S1 = g.S1, S2 = g.S2, S3 = g.S3, S4 = g.S4, S5 = g.S5;
    if (t < TL.door[1]) {                       // 1. cursor -> doorway
      S1.render(A, t);
      const d = S1.door(t);
      if (d) {
        if (d.x1 - d.x0 > 6) { S2.render(B, t); win(A, B, d.x0, d.y0, d.x1, d.y1); }
        S1.doorFrame(A, d);
      }
      return A;
    }
    if (t < TL.s23[0]) { S2.render(A, t); return A; }
    if (t < TL.mIris[1]) {                      // 2->3 dissolve, 3, 3->4 through the mirror
      S3.render(A, t);
      if (t < TL.s23[1]) { S2.render(B, t); const tmp = A.d; A.d = B.d; B.d = tmp; radial(A, B, P.prog(t, TL.s23[0], TL.s23[1]), 240, 150); }
      return A;
    }
    if (t < TL.pan0) {                          // 4. city wide, then into a window
      S4.render(A, t);
      if (t >= TL.wIris[0]) S5.irisIn(A, B, t);
      return A;
    }
    if (t < TL.toWide[1]) {                     // rooms; the last one goes dark; dissolve back to the city
      S5.render(A, t);
      if (t >= TL.toWide[0]) { S4.render(B, t); radial(A, B, P.prog(t, TL.toWide[0], TL.toWide[1]), 240, 135); }
      return A;
    }
    S4.render(A, t);                            // 5. hold on the dark window; black opens; loop
    return A;
  }
  let cv, ctx, small, sctx, img, u32;
  function setup() {
    cv = document.getElementById('c'); ctx = cv.getContext('2d');
    small = document.createElement('canvas'); small.width = W; small.height = H; sctx = small.getContext('2d');
    img = sctx.createImageData(W, H); u32 = new Uint32Array(img.data.buffer);
  }
  function renderAt(t) {
    const b = frame(t);
    P.toRGBA(b, u32);
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, cv.width, cv.height);
    return true;
  }
  function raw() { // native 480x270 RGBA as base64 (used by the renderer; identical to the x4 canvas)
    const u8 = img.data; let s = ''; const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function boot() {
    setup();
    ['S2', 'S3', 'S4', 'S5'].forEach(k => g[k] && g[k].init && g[k].init());
    const q = new URLSearchParams(location.search);
    g.__piece = { renderAt, duration: TL.D, fps: TL.FPS, isReady: () => true, raw, frame, palette: P.RGB, names: P.NAMES };
    if (q.has('export')) { renderAt(0); return; }
    if (q.has('t')) { renderAt(parseFloat(q.get('t'))); return; }
    const t0 = performance.now();
    (function loop() { renderAt(((performance.now() - t0) / 1000) % TL.D); requestAnimationFrame(loop); })();
  }
  g.FILM = { frame, boot };
  if (typeof document !== 'undefined') { if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot); }
})(typeof window !== 'undefined' ? window : globalThis);
