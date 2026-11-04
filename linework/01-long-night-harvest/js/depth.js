/* Depth: aerial perspective as flat, stepped plate shifts (never airbrushed).
 * A haze plate holds, for every pixel, the colour the air would have there (the sky ground above
 * the horizon, the horizon glow below it). Distant things are drawn into a scratch layer, then
 * pulled toward that plate by a quantised amount that grows with distance, and composited. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC;

  const D = (LW.depth = {});
  const DBG = new URLSearchParams(location.search).get('dbg') || '';
  const Q = 0.025; // haze quantum: every shift is a multiple of this, so plates stay stepped

  // haze amount for world distance Z (continuous in Z, quantised in value)
  D.k = function (Z) {
    const u = LW.clamp((Math.log(Z) - Math.log(3.5)) / (Math.log(235) - Math.log(3.5)), 0, 1);
    return D.q(0.42 * Math.pow(u, 1.25));
  };
  D.q = (k) => Math.round(k / Q) * Q;
  // line weight scale for distance Z: 1 at the camera, ~0.5 at the far hedge
  D.w = function (Z) {
    const u = LW.clamp((Math.log(Z) - Math.log(3)) / (Math.log(230) - Math.log(3)), 0, 1);
    return 1 - 0.5 * u;
  };

  // ---------------------------------------------------------------- canvases
  function mk(c) { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; return o; }
  D.init = function (canvas, hazeImg) {
    D.haze = mk(canvas);
    D.haze.getContext('2d').putImageData(hazeImg, 0, 0);
    D.hazeData = hazeImg.data;
    D.layer = mk(canvas);
    D.lctx = D.layer.getContext('2d');
    D.W = canvas.width; D.H = canvas.height;
  };
  // a scratch context with the scene transform, ready to draw into
  D.begin = function () {
    const c = D.lctx;
    c.setTransform(LW.S, 0, 0, LW.S, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.lineCap = 'round'; c.lineJoin = 'round';
    return c;
  };
  function devRect(y0, y1, x0, x1) {
    const S = LW.S;
    const px0 = Math.max(0, Math.floor((x0 === undefined ? 0 : x0) * S)), px1 = Math.min(D.W, Math.ceil((x1 === undefined ? SC.W : x1) * S));
    const py0 = Math.max(0, Math.floor(y0 * S)), py1 = Math.min(D.H, Math.ceil(y1 * S));
    return [px0, py0, Math.max(0, px1 - px0), Math.max(0, py1 - py0)];
  }
  // tint what is in the layer toward the haze plate by k (constant) inside a rect
  // col: a flat haze colour (objects), or omitted to use the plate (wide ground strips)
  D.tint = function (k, y0, y1, x0, x1, col) {
    if (k <= 0 || DBG.indexOf('notint') >= 0) return;
    const [px, py, pw, ph] = devRect(y0, y1, x0, x1);
    if (pw <= 0 || ph <= 0) return;
    const c = D.lctx;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.min(1, k);
    if (col) { c.fillStyle = col; c.fillRect(px, py, pw, ph); } else c.drawImage(D.haze, px, py, pw, ph, px, py, pw, ph);
    c.restore();
  };
  // the air colour at the horizon below screen x (flat colour for an object standing there)
  D.airAt = function (x, lift) {
    const o = (Math.min(D.H - 1, Math.round((SC.yh + 4) * LW.S)) * D.W + LW.clamp(Math.round(x * LW.S), 0, D.W - 1)) * 4;
    const h = D.hazeData, P = LW.hex(LW.P.sea), t = lift || 0;
    return LW.css([h[o] + (P[0] - h[o]) * t, h[o + 1] + (P[1] - h[o + 1]) * t, h[o + 2] + (P[2] - h[o + 2]) * t]);
  };
  // tint by horizontal strips, k a function of y (native units); equal-k strips are merged
  D.tintByY = function (kOfY, y0, y1) {
    const S = LW.S;
    const p0 = Math.max(0, Math.floor(y0 * S)), p1 = Math.min(D.H, Math.ceil(y1 * S));
    let start = p0, cur = D.q(kOfY((p0 + 0.5) / S));
    for (let p = p0 + 1; p <= p1; p++) {
      const k = p === p1 ? -1 : D.q(kOfY((p + 0.5) / S));
      if (k !== cur) { D.tint(cur, start / S, p / S); start = p; cur = k; }
    }
  };
  // move the layer onto the page and clear it
  D.commit = function (ctx, y0, y1, x0, x1) {
    const [px, py, pw, ph] = devRect(y0, y1, x0, x1);
    if (pw > 0 && ph > 0) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(D.layer, px, py, pw, ph, px, py, pw, ph);
      ctx.restore();
    }
    D.clear();
  };
  D.clear = function () { const c = D.lctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, D.W, D.H); c.restore(); };

  // a stepped halo of air around whatever is in the layer: the plate just behind the silhouette is
  // pulled toward a mist colour in flat steps (inner strong, outer weak), so the near form stands off
  // the far one. steps: [[radius, amount, colour]]; only applied above clipY (the sky and far land).
  D.halo = function (ctx, steps, clipY, box) {
    if (DBG.indexOf('nohalo') >= 0) return;
    const S = LW.S;
    const pad = Math.max(...steps.map((s) => s[0])) + 4;
    const [px, py, pw, ph] = devRect(box[1] - pad, Math.min(box[3], clipY) + pad, box[0] - pad, box[2] + pad);
    if (pw <= 0 || ph <= 0) return;
    const m = document.createElement('canvas'); m.width = pw; m.height = ph;
    const mc = m.getContext('2d');
    for (const [rad, alpha, col] of steps) {
      mc.globalCompositeOperation = 'source-over';
      mc.clearRect(0, 0, pw, ph);
      const n = 24, r = rad * S;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; mc.drawImage(D.layer, px, py, pw, ph, Math.cos(a) * r, Math.sin(a) * r, pw, ph); }
      for (let i = 0; i < n; i++) { const a = ((i + 0.5) / n) * Math.PI * 2; mc.drawImage(D.layer, px, py, pw, ph, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, pw, ph); }
      mc.globalCompositeOperation = 'source-in';
      if (col) { mc.fillStyle = col; mc.fillRect(0, 0, pw, ph); } else mc.drawImage(D.haze, px, py, pw, ph, 0, 0, pw, ph);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath(); ctx.rect(px, py, pw, Math.max(0, clipY * S - py)); ctx.clip();
      ctx.globalAlpha = alpha;
      ctx.drawImage(m, px, py);
      ctx.restore();
    }
  };

  // pixel pass: pull pixels toward the haze plate; kOf(x, y, lum) -> k (quantised by the caller or here)
  D.pixelHaze = function (ctx, y0, y1, kOf, plateY) {
    const S = LW.S;
    const py0 = Math.max(0, Math.floor(y0 * S)), py1 = Math.min(D.H, Math.ceil(y1 * S)), w = D.W;
    if (py1 <= py0) return;
    const img = ctx.getImageData(0, py0, w, py1 - py0), d = img.data, hz = D.hazeData;
    for (let py = py0; py < py1; py++) {
      const y = (py + 0.5) / S;
      for (let px = 0; px < w; px++) {
        const o = ((py - py0) * w + px) * 4;
        const lum = (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255;
        const k = kOf((px + 0.5) / S, y, lum);
        if (k <= 0) continue;
        const h = ((plateY !== undefined ? Math.min(D.H - 1, Math.round(plateY * S)) : py) * w + px) * 4;
        d[o] += (hz[h] - d[o]) * k; d[o + 1] += (hz[h + 1] - d[o + 1]) * k; d[o + 2] += (hz[h + 2] - d[o + 2]) * k;
      }
    }
    ctx.putImageData(img, 0, py0);
  };
})();
