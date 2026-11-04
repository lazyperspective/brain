/* Distant land: two ridges, patchwork farmland on the near hill, the farmhouse, the far hedge. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC, P = LW.P;

  function profile(fn, x0, x1, step) {
    const pts = [];
    for (let x = x0; x <= x1; x += step) pts.push(x, fn(x));
    return pts;
  }

  // rim light along a silhouette top: amber near the sun, cool elsewhere
  function rimLine(ctx, fn, x0, x1, opts) {
    opts = opts || {};
    const warm = new Path2D(), cool = new Path2D(), ink = new Path2D();
    const top = LW.wobble(profile(fn, x0, x1, 3), 0.5, 0.05, opts.seed || 1);
    LW.ribbon(ink, top, (t, i, x) => (opts.ink || 0.9) * (0.8 + 0.4 * LW.N1(x * 0.03, 5)));
    const off = [];
    for (let i = 0; i < top.length; i += 2) off.push(top[i], top[i + 1] + (opts.drop || 2.2));
    // split by warmth
    let run = [], runWarm = null;
    const flush = () => {
      if (run.length >= 4) LW.ribbon(runWarm ? warm : cool, run, (t, i, x, y) => {
        const g = SC.glow(x, y - 10);
        return runWarm ? (0.5 + 1.6 * LW.smooth(0.3, 0.95, g)) * LW.taper(t, 0.05, 0.05) : 0.45 * LW.taper(t, 0.05, 0.05);
      });
      run = [];
    };
    for (let i = 0; i < off.length; i += 2) {
      const w = SC.glow(off[i], off[i + 1] - 10) > (opts.warmAt || 0.3);
      if (runWarm !== null && w !== runWarm) { run.push(off[i], off[i + 1]); flush(); }
      runWarm = w;
      run.push(off[i], off[i + 1]);
    }
    flush();
    ctx.fillStyle = opts.coolCol || P.teal; ctx.fill(cool);
    ctx.fillStyle = opts.warmCol || P.amber; ctx.fill(warm);
    ctx.fillStyle = P.ink; ctx.fill(ink);
  }
  LW.rimLine = rimLine;

  // contour hatching below a silhouette, denser with depth below the top
  function contourHatch(ctx, fn, x0, x1, depth, opts) {
    const rng = new LW.RNG(opts.seed || 'hatch');
    const fill = new LW.FillBatch();
    let y = opts.start || 4;
    let k = 0;
    while (y < depth) {
      const pts = [];
      for (let x = x0; x <= x1; x += 4) pts.push(x, fn(x) + y + 1.5 * LW.N2(x * 0.01, y * 0.3 + k));
      const wp = LW.wobble(pts, 0.6, 0.04, k + 3);
      LW.dashes(wp, rng, 30, 220, 3, 14, (sub) => {
        const mx = sub[(sub.length >> 2) * 2], my = sub[(sub.length >> 2) * 2 + 1];
        const g = SC.glow(mx, my - y);
        const col = opts.colFn ? opts.colFn(mx, my, y, g, rng.next()) : P.deep;
        if (!col) return;
        LW.ribbon(fill.p(col), sub, (t) => (opts.w || 0.6) * (0.6 + 0.8 * (y / depth)) * LW.taper(t, 0.1, 0.1));
      });
      y += (opts.gap || 4) * (1.25 - 0.45 * (y / depth)) + rng.range(-0.4, 0.4);
      k++;
    }
    fill.flush(ctx);
  }

  function fillUnder(ctx, fn, x0, x1, yb, color, off) {
    const pts = profile(fn, x0, x1, 3);
    pts.push(x1, yb, x0, yb);
    const path = new Path2D();
    LW.polyPath(path, pts, true);
    ctx.fillStyle = color;
    if (off) LW.offset(ctx, off, () => ctx.fill(path)); else ctx.fill(path);
    return path;
  }

  // ---------------------------------------------------------------- the farmhouse
  function farmhouse(ctx) {
    const fx0 = 1062, base0 = SC.ridgeNear(fx0) + 7;
    ctx.save();
    ctx.translate(fx0, base0); ctx.scale(1.35, 1.35); ctx.translate(-fx0, -base0);
    const fx = fx0, base = base0;
    const ink = P.ink, sil = '#121e2a';
    const rng = new LW.RNG('farm');
    const parts = [];
    // barn (left): gambrel roof
    const bL = fx - 104, bR = fx - 22, bT = base - 40;
    parts.push([bL, base, bL, bT, bL + 12, bT - 16, (bL + bR) / 2, bT - 26, bR - 12, bT - 16, bR, bT, bR, base]);
    // lean-to on barn
    parts.push([bL - 26, base, bL - 26, base - 20, bL, base - 30, bL, base]);
    // house (right): gable + chimney
    const hL = fx - 14, hR = fx + 58, hT = base - 36;
    parts.push([hL, base, hL, hT, (hL + hR) / 2, hT - 30, hR, hT, hR, base]);
    parts.push([hR - 18, hT - 11, hR - 18, hT - 34, hR - 9, hT - 34, hR - 9, hT - 4]);
    // porch
    parts.push([hL + 8, base, hL + 8, base - 14, hL + 30, base - 18, hL + 30, base]);
    const sp = new Path2D();
    for (const p of parts) LW.polyPath(sp, LW.wobble(LW.resample(p, 2), 0.35, 0.2, 7, true), true);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.stroke(sp);
    ctx.fillStyle = sil; ctx.fill(sp);
    // board / shingle hatching inside the silhouette
    ctx.save(); ctx.clip(sp);
    const h = new LW.StrokeBatch();
    for (let y = bT - 26; y < base; y += 3.2) { const q = h.p('#1f3a46', 0.7); q.moveTo(bL - 30, y + rng.range(-0.4, 0.4)); q.lineTo(bL + 6, y); }
    for (let x = bL + 3; x < bR; x += 3.4) { const q = h.p('#1f3a46', 0.7); q.moveTo(x, bT + 2); q.lineTo(x + rng.range(-0.5, 0.5), base); }
    for (let x = hL + 2; x < hR; x += 4) { const q = h.p('#1d3540', 0.6); q.moveTo(x, hT + 1); q.lineTo(x, base); }
    for (let y = hT - 28; y < hT; y += 3) { const q = h.p('#24414c', 0.7); q.moveTo(hL - 4, y); q.lineTo(hR + 4, y + 1); }
    h.flush(ctx);
    {
      // surface marks: roof tiles, stone courses with pitting, barn planks with knots, door, loft hatch
      const trng = new LW.RNG('farm-tex');
      const tx = new LW.FillBatch();
      const INK = '#0a131b', MID = '#2a4853', LO = '#1a303b';
      // house roof: staggered tile joints between the courses
      for (let y = hT - 27, row = 0; y < hT - 0.5; y += 3, row++) {
        const half = ((y - (hT - 30)) / 30) * (hR - hL) / 2;
        const cx0 = (hL + hR) / 2 - half, cx1 = (hL + hR) / 2 + half;
        for (let x = cx0 + (row % 2) * 1.6; x < cx1; x += 3.2 + trng.range(-0.3, 0.3)) {
          LW.ribbon(tx.p(INK), [x, y + 0.3, x - 0.2, y + 2.6], () => 0.32);
          if (trng.next() < 0.35) LW.dot(tx.p(MID), x + 1.5, y + 1.2, 0.35);
        }
      }
      // house walls: stone courses, broken mortar lines, staggered joints, pitting
      for (let y = hT + 2, row = 0; y < base - 0.5; y += 2.7, row++) {
        let x = hL + 0.5 + (row % 2) * 2;
        while (x < hR) {
          const L = trng.range(3, 7);
          LW.ribbon(tx.p(row % 3 ? LO : MID), [x + 0.4, y, x + L - 0.4, y + trng.range(-0.15, 0.15)], () => 0.32);
          LW.ribbon(tx.p(INK), [x + L, y - 1.2, x + L, y + 1.2], () => 0.3);
          if (trng.next() < 0.3) LW.dot(tx.p(INK), x + trng.range(0.5, L), y + trng.range(-1, 1), 0.3);
          x += L;
        }
      }
      // second, unlit window and a door on the house
      ctx.fillStyle = '#081018'; ctx.fillRect(hL + 13, hT + 13, 8, 10); ctx.fillRect(hL + 20, base - 19, 9, 19);
      LW.ribbon(tx.p(MID), [hL + 12.5, hT + 13, hL + 21.5, hT + 13], () => 0.45);
      LW.ribbon(tx.p(MID), [hL + 17, hT + 13, hL + 17, hT + 23], () => 0.3);
      // barn: plank knots and nail rows, a braced double door, a loft hatch
      for (let k = 0; k < 26; k++) { const x = trng.range(bL + 2, bR - 2), y = trng.range(bT, base - 2); LW.dot(tx.p(INK), x, y, trng.range(0.3, 0.6)); }
      for (const y of [bT + 6, base - 12]) for (let x = bL + 2; x < bR; x += 3.4) LW.dot(tx.p(MID), x + 0.6, y, 0.3);
      const dL = bL + 28, dR = bL + 54, dT = base - 26;
      ctx.fillStyle = '#0d1820'; ctx.fillRect(dL, dT, dR - dL, base - dT);
      for (const pts of [[dL, dT, dR, base], [dL, base, dR, dT], [(dL + dR) / 2, dT, (dL + dR) / 2, base], [dL, dT, dR, dT], [dL, (dT + base) / 2, dR, (dT + base) / 2]]) LW.ribbon(tx.p(MID), pts, () => 0.45);
      ctx.fillStyle = '#081018'; ctx.fillRect((bL + bR) / 2 - 5, bT - 14, 10, 9);
      LW.ribbon(tx.p(MID), [(bL + bR) / 2 - 5.5, bT - 14.5, (bL + bR) / 2 + 5.5, bT - 14.5], () => 0.4);
      // lean-to: corrugated roof
      for (let x = bL - 25; x < bL; x += 2.2) { const t = (x - (bL - 26)) / 26; LW.ribbon(tx.p(INK), [x, base - 20 - 10 * t + 0.8, x + 0.1, base - 20 - 10 * t + 4], () => 0.3); }
      tx.flush(ctx, [LO, MID, INK]);
    }
    ctx.restore();
    // chimney cap
    {
      const cap = new Path2D();
      LW.ribbon(cap, [hR - 19.5, hT - 34.5, hR - 7.5, hT - 34.5], () => 1.3);
      ctx.fillStyle = P.ink; ctx.fill(cap);
    }
    // a fence running off from the house, a two-wheeled cart by the barn
    {
      const fz = new LW.FillBatch(), rimz = new LW.FillBatch();
      const fr = new LW.RNG('farm-fence');
      for (let x = hR + 6; x < hR + 92; x += fr.range(6.5, 9)) {
        const y = base + 1 + (x - hR) * 0.02;
        LW.ribbon(fz.p(P.ink), [x, y + 1, x + fr.range(-0.4, 0.4), y - 7.5], () => 0.75);
      }
      for (const dy of [-6, -3]) LW.ribbon(fz.p(P.ink), LW.wobble([hR + 5, base + dy + 1, hR + 50, base + dy + 1.8, hR + 92, base + dy + 2.8], 0.3, 0.1, dy), () => 0.4);
      for (let x = bL - 130; x < bL - 60; x += fr.range(6.5, 9)) LW.ribbon(fz.p(P.ink), [x, base + 2, x + fr.range(-0.4, 0.4), base - 5.5], () => 0.7);
      LW.ribbon(fz.p(P.ink), [bL - 130, base - 3.5, bL - 95, base - 3, bL - 60, base - 3.4], () => 0.4);
      // cart
      const cx = bL - 82, cy = base - 5;
      const body = new Path2D(); body.rect(cx - 11, cy - 9, 22, 6);
      ctx.fillStyle = '#121e2a'; ctx.fill(body); ctx.strokeStyle = P.ink; ctx.lineWidth = 0.9; ctx.stroke(body);
      for (let x = cx - 9; x < cx + 11; x += 2.6) LW.ribbon(fz.p('#24414c'), [x, cy - 8.4, x, cy - 3.6], () => 0.3);
      LW.ribbon(fz.p(P.ink), [cx + 11, cy - 5, cx + 26, base + 1], () => 0.6);
      const wr = 5.6;
      const wheel = new Path2D(); wheel.arc(cx - 2, cy, wr, 0, 6.2832);
      ctx.lineWidth = 1.1; ctx.stroke(wheel);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; LW.ribbon(fz.p(P.ink), [cx - 2, cy, cx - 2 + Math.cos(a) * wr, cy + Math.sin(a) * wr], () => 0.32); }
      const arc = []; for (let a = 2.2; a <= 4.2; a += 0.2) arc.push(cx - 2 + Math.cos(a) * (wr + 0.6), cy + Math.sin(a) * (wr + 0.6));
      LW.ribbon(rimz.p(P.amber), arc, (t) => 0.55 * LW.taper(t, 0.2, 0.2));
      LW.ribbon(rimz.p(P.amber), [cx - 11, cy - 9.4, cx + 4, cy - 9.4], (t) => 0.5 * LW.taper(t, 0.1, 0.4));
      fz.flush(ctx); rimz.flush(ctx);
    }
    // rim light on the sun-facing (left) roof slopes and walls
    const rim = new Path2D();
    LW.ribbon(rim, [bL + 1.5, bT + 2, bL + 13, bT - 14, (bL + bR) / 2, bT - 24], (t) => 1.3 * LW.taper(t, 0.1, 0.2));
    LW.ribbon(rim, [hL + 1.5, hT + 3, (hL + hR) / 2, hT - 27], (t) => 1.2 * LW.taper(t, 0.1, 0.2));
    LW.ribbon(rim, [bL - 25, base - 18, bL - 1, base - 28], (t) => 0.9 * LW.taper(t, 0.1, 0.1));
    LW.ribbon(rim, [hR - 17, hT - 33, hR - 17, hT - 14], (t) => 0.8 * LW.taper(t, 0.1, 0.1));
    ctx.fillStyle = P.amber; ctx.fill(rim);
    // the one lit window, with a posterised halo
    const wx = hL + 42, wy = hT + 12, ww = 11, wh = 13;
    // light leaking round the window: short engraved rays on the dark wall
    ctx.save(); ctx.clip(sp);
    const rays = new LW.FillBatch();
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * 6.283 + rng.range(-0.08, 0.08);
      const r0 = 9.5, r1 = r0 + rng.range(5, 13);
      const cx = wx + ww / 2, cy = wy + wh / 2;
      LW.ribbon(rays.p(k % 3 ? P.rust : P.orange), [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], (t) => 0.75 * (1 - t));
    }
    rays.flush(ctx);
    ctx.restore();
    ctx.fillStyle = P.amber; ctx.fillRect(wx - 2.5, wy - 2.5, ww + 5, wh + 5);
    ctx.fillStyle = P.cream; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#fff8e0'; ctx.fillRect(wx + 1.5, wy + 1.5, ww - 3, wh - 3);
    ctx.fillStyle = ink; ctx.fillRect(wx + ww / 2 - 0.9, wy, 1.8, wh); ctx.fillRect(wx, wy + wh / 2 - 0.9, ww, 1.8);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.strokeRect(wx, wy, ww, wh);
    // light spill on the ground
    const spill = new LW.FillBatch();
    for (let k = 0; k < 7; k++) {
      const y = base + 3 + k * 2.6, half = 10 + k * 5;
      LW.ribbon(spill.p(k < 3 ? P.straw : k < 5 ? P.amber : P.orange), [wx + ww / 2 - half, y, wx + ww / 2 + half, y + 0.6], (t) => (1.1 - k * 0.1) * LW.taper(t, 0.25, 0.25));
    }
    spill.flush(ctx);
    // a small tree beside the house
    LW.miniTree(ctx, hR + 22, base, 46, 20, rng, true);
    LW.miniTree(ctx, bL - 40, base + 2, 30, 14, rng, true);
    ctx.restore();
  }

  // tiny distant tree: trunk + scalloped blob
  LW.miniTree = function (ctx, x, y, h, r, rng, rim) {
    const ink = new Path2D();
    LW.ribbon(ink, [x, y, x + rng.range(-1, 1), y - h * 0.55], (t) => 1.6 * (1 - t * 0.5));
    ctx.fillStyle = P.ink; ctx.fill(ink);
    const pts = LW.scallop(x, y - h + r * 0.9, r, rng, { bumpSize: Math.max(4, r * 0.35), depth: 0.12, per: 5, squash: 1.05 });
    const p = new Path2D(); LW.polyPath(p, pts, true);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke(p);
    ctx.fillStyle = '#132430'; ctx.fill(p);
    if (rim) {
      const g = SC.glow(x, y - h);
      const side = SC.sun.x < x ? -1 : 1;
      const arc = [];
      for (let a = -0.5; a <= 0.9; a += 0.1) { const ang = (side < 0 ? Math.PI : 0) + side * -a; arc.push(x + Math.cos(ang) * (r - 2), y - h + r * 0.9 + Math.sin(ang) * (r - 2) * 1.05); }
      const rp = new Path2D(); LW.ribbon(rp, arc, (t) => (0.6 + 1.2 * g) * LW.taper(t, 0.2, 0.2));
      ctx.fillStyle = g > 0.3 ? P.amber : P.teal; ctx.fill(rp);
    }
  };

  // ---------------------------------------------------------------- patchwork on the near hill
  function patchwork(ctx) {
    const rng = new LW.RNG('patch');
    const trng = new LW.RNG('patch-tex');
    const yb = 2334;
    const top = (x) => SC.ridgeNear(x);
    const sOf = (x, s) => top(x) + (yb - top(x)) * s;
    const bands = [0, 0.16 + 0.03 * rng.next(), 0.38, 0.62, 0.86, 1.0];
    const contour = (b, x) => sOf(x, bands[b] + (b > 0 && b < bands.length - 1 ? 0.035 * LW.N1(x * 0.004, b * 3) : 0));
    const hatchCols = [P.deep, P.teal, '#1a3440', P.teal, P.sea];
    for (let b = 0; b < bands.length - 1; b++) {
      let x = -20;
      while (x < SC.W + 20) {
        const wdt = rng.range(110, 320);
        const xa = x, xb = Math.min(SC.W + 30, x + wdt);
        const slantA = (xa - SC.sun.x) * 0.05, slantB = (xb - SC.sun.x) * 0.05;
        const pts = [];
        for (let xx = xa; xx <= xb; xx += 5) pts.push(xx + slantA * 0 + (slantB - slantA) * 0, contour(b, xx));
        for (let xx = xb; xx >= xa; xx -= 5) pts.push(xx + ((xx - xa) / Math.max(1, xb - xa)) * 0, contour(b + 1, xx));
        const path = new Path2D(); LW.polyPath(path, pts, true);
        const kind = rng.int(0, 3);
        const kind2 = trng.next();
        const g = SC.glow((xa + xb) / 2, top((xa + xb) / 2) - 20);
        ctx.save(); ctx.clip(path);
        const fill = new LW.FillBatch();
        const col = g > 0.45 && rng.next() < 0.6 ? P.rust : rng.pick(hatchCols);
        if (kind === 0 || kind === 3) {
          // rows along the contour
          const y0 = contour(b, xa) - 10, y1 = contour(b + 1, xb) + 10;
          const gap = kind === 0 ? 3.0 : 4.6;
          for (let off = 0; off < (y1 - y0) + 40; off += gap) {
            const line = [];
            for (let xx = xa - 5; xx <= xb + 5; xx += 6) line.push(xx, contour(b, xx) - 6 + off + 0.5 * LW.N2(xx * 0.05, off));
            LW.ribbon(fill.p(col), line, (t) => (kind === 0 ? 0.45 : 0.7) * LW.taper(t, 0.02, 0.02));
          }
        } else if (kind === 1) {
          // furrows converging toward a point beyond the hill
          const vx = (xa + xb) / 2 + rng.range(-300, 300), vy = top((xa + xb) / 2) - 400;
          for (let xx = xa - 60; xx <= xb + 60; xx += 4.2) {
            const yB = contour(b + 1, xx) + 6;
            const t = 0.6;
            LW.ribbon(fill.p(col), [xx, yB, xx + (vx - xx) * t * 0.25, yB + (vy - yB) * t * 0.25], (tt) => 0.55 * LW.taper(tt, 0.05, 0.05));
          }
        } else {
          // pasture: stipple
          const y0 = Math.min(contour(b, xa), contour(b, xb)) - 4, y1 = Math.max(contour(b + 1, xa), contour(b + 1, xb)) + 4;
          for (let i = 0; i < (xb - xa) * (y1 - y0) * 0.06; i++) {
            const px = rng.range(xa, xb), py = rng.range(y0, y1);
            const q = fill.p(col); q.moveTo(px + 0.8, py); q.arc(px, py, rng.range(0.5, 1.0), 0, 6.283);
          }
        }
        {
          // texture over every patch: a second hatch direction in some, stooks in others, grain in all
          const y0 = Math.min(contour(b, xa), contour(b, xb)) - 4, y1 = Math.max(contour(b + 1, xa), contour(b + 1, xb)) + 4;
          const dk = LW.darker(col);
          if (kind2 < 0.3) {
            const a = trng.sign() * trng.range(0.35, 0.7), gap = trng.range(3.2, 4.6);
            for (let o = xa - (y1 - y0) * 2; o < xb + (y1 - y0) * 2; o += gap) {
              const yA = y0, yB = y1;
              LW.ribbon(fill.p(dk), LW.wobble([o, yA, o + (yB - yA) * a * 0.5, (yA + yB) / 2, o + (yB - yA) * a, yB], 0.4, 0.1, o), (t) => 0.45 * LW.taper(t, 0.05, 0.05));
            }
          } else if (kind2 < 0.5 && b > 0) {
            // stooks: rows of little tents of sheaves
            for (let yy = y0 + 5; yy < y1; yy += trng.range(5, 8)) {
              for (let xx = xa + trng.range(0, 6); xx < xb; xx += trng.range(6, 10)) {
                const sc = 0.6 + 0.6 * ((yy - 2160) / 170);
                const hh = 4.5 * sc, ww = 2.3 * sc;
                LW.ribbon(fill.p('#0f1923'), [xx - ww, yy, xx, yy - hh, xx + ww, yy], () => 0.55 * sc + 0.15);
                if (g > 0.3) LW.ribbon(fill.p(P.amber), [xx - ww * 0.8, yy - 0.5, xx - 0.2, yy - hh + 0.4], () => 0.35);
              }
            }
          }
          for (let i = 0; i < (xb - xa) * (y1 - y0) * 0.035; i++) {
            const px = trng.range(xa, xb), py = trng.range(y0, y1);
            LW.dot(fill.p(trng.next() < 0.7 ? '#0f1923' : dk), px, py, trng.range(0.35, 0.75));
          }
        }
        fill.flush(ctx);
        ctx.restore();
        x = xb;
        // field boundary hedge between patches (vertical-ish)
        if (b > 0 && rng.next() < 0.6) {
          const hp = [xb, contour(b, xb), xb + rng.range(-6, 6), contour(b + 1, xb)];
          const hp2 = LW.resample(hp, 3);
          const ink = new Path2D();
          LW.ribbon(ink, LW.wobble(hp2, 1.2, 0.2, b * 10 + xb), (t) => 1.2 * LW.taper(t, 0.1, 0.1));
          ctx.fillStyle = '#0f1923'; ctx.fill(ink);
        }
      }
      // contour hedgerow at the band's upper boundary
      if (b > 0) {
        const fill = new LW.FillBatch();
        let xx = -10;
        while (xx < SC.W + 10) {
          const y = contour(b, xx);
          if (y > yb - 4) { xx += 6; continue; }
          const scale = 0.6 + 0.6 * ((y - 2160) / 170);
          const r = rng.range(2.2, 4.2) * scale * (rng.next() < 0.06 ? 2.4 : 1);
          if (rng.next() < 0.12) { xx += rng.range(8, 30); continue; }
          const pts = LW.scallop(xx, y - r * 0.6, r, rng, { bumps: 5, depth: 0.12, per: 4 });
          LW.polyPath(fill.p('#0f1923'), pts, true);
          if (SC.glow(xx, y - 20) > 0.35 && rng.next() < 0.7) {
            LW.ribbon(fill.p(P.amber), [xx - r * 0.6, y - r * 1.2, xx + r * 0.3, y - r * 1.5], (t) => 0.5 * LW.taper(t, 0.3, 0.3));
          }
          xx += r * rng.range(1.2, 1.9);
        }
        fill.flush(ctx, ['#0f1923', P.amber]);
      }
    }
    // post-and-wire fences along a few field boundaries
    {
      const fz = new LW.FillBatch();
      for (const [b, xa, xb] of [[2, 1240, 1700], [3, 1780, 2160], [1, 0, 330], [3, 60, 420]]) {
        const wire = [];
        for (let x = xa; x <= xb; x += trng.range(7, 11)) {
          const y = contour(b, x) + 2;
          if (y > yb - 2) continue;
          const sc = 0.6 + 0.6 * ((y - 2160) / 170);
          LW.ribbon(fz.p('#0f1923'), [x, y + 1, x + trng.range(-0.3, 0.3), y - 6 * sc], () => 0.4 + 0.3 * sc);
          wire.push(x, y - 4.2 * sc);
        }
        if (wire.length >= 4) LW.ribbon(fz.p('#0f1923'), LW.wobble(wire, 0.25, 0.1, b), () => 0.35);
      }
      // haystacks: domed ricks with thatch lines and a rim of glow
      for (const [hx, s0] of [[1330, 0.45], [1352, 0.5], [1410, 0.3], [250, 0.55]]) {
        const hy = sOf(hx, s0), sc = 0.6 + 0.6 * ((hy - 2160) / 170);
        const w = 10 * sc, hh = 12.5 * sc;
        const pts = [];
        for (let a = 0; a <= Math.PI; a += 0.15) pts.push(hx - Math.cos(a) * w, hy - Math.sin(a) * hh);
        const hp = new Path2D(); LW.polyPath(hp, pts, true);
        ctx.fillStyle = '#1a2a33'; ctx.fill(hp); ctx.strokeStyle = P.ink; ctx.lineWidth = 0.9; ctx.stroke(hp);
        const g = SC.glow(hx, hy - 20);
        for (let k = 1; k < 5; k++) { const yy = hy - hh * k / 5; const ww = w * Math.sqrt(1 - (k / 5) ** 2); LW.ribbon(fz.p(k % 2 ? '#3a3a33' : '#0a131b'), [hx - ww, yy, hx + ww * 0.2, yy + 0.4], () => 0.35); }
        const arc = []; for (let a = 0.1; a <= 1.6; a += 0.1) arc.push(hx - Math.cos(a) * (w - 0.8), hy - Math.sin(a) * (hh - 0.8));
        const rp = new Path2D(); LW.ribbon(rp, arc, (t) => 1.1 * LW.taper(t, 0.2, 0.2));
        ctx.fillStyle = g > 0.12 ? P.amber : P.sea; ctx.fill(rp);
      }
      fz.flush(ctx);
    }
    // scattered trees on the hill
    for (let i = 0; i < 26; i++) {
      const x = rng.range(1150, SC.W), s = rng.range(0.1, 0.8);
      const y = sOf(x, s);
      if (Math.abs(x - 1062) < 140) continue;
      const sc = 0.7 + 0.8 * ((y - 2160) / 170);
      LW.miniTree(ctx, x, y, rng.range(14, 24) * sc, rng.range(6, 10) * sc, rng, SC.glow(x, y) > 0.3);
    }
  }

  // ---------------------------------------------------------------- far hedge across the field
  LW.drawFarHedge = function (ctx) {
    const rng = new LW.RNG('far-hedge');
    const Z = SC.farHedgeZ;
    const gateX = SC.screenX(SC.pathX(Z), Z);
    const gyAt = (x) => SC.groundY(SC.worldX(x, Z), Z);
    // dark base band so the hedge stands on the ground, no gaps of field showing through
    const base = [];
    for (let xx = -20; xx <= SC.W + 20; xx += 4) base.push(xx, gyAt(xx) - 7 + 2 * LW.N2(xx * 0.05, 1));
    for (let xx = SC.W + 20; xx >= -20; xx -= 8) base.push(xx, gyAt(xx) + 1.5);
    const bp = new Path2D(); LW.polyPath(bp, base, true);
    ctx.fillStyle = '#0f1922'; ctx.fill(bp);
    const opts = { seed: 'fh', ink: 0.8, bump: 0.3, markScale: 0.45, markDensity: 140, rimW: 1.5, fillCol: '#142a33', backCol: '#10202a', capCol: '#21454f' };
    const trees = [];
    let x = -16;
    while (x < SC.W + 16) {
      if (Math.abs(x - gateX) < 13) { x += 26; continue; }
      const swell = 0.75 + 0.5 * (0.5 + 0.5 * LW.N1(x * 0.006, 3));
      const nearFarm = Math.abs(x - 1062) < 260;
      const tall = rng.next() < 0.045 && !nearFarm;
      if (tall) {
        const gy = gyAt(x);
        const sc = rng.range(0.8, 1.2);
        trees.push([x, gy, sc]);
        x += 30 * sc;
        continue;
      }
      const r = rng.range(9, 14) * swell * (nearFarm ? 0.7 : 1);
      LW.drawHedgeClump(ctx, x, gyAt(x) + 2, r, r * rng.range(1.9, 2.5), rng, opts);
      x += r * rng.range(1.2, 1.8);
    }
    for (const [tx, gy, sc] of trees) {
      const t = LW.makeTree('fh-tree-' + Math.round(tx), { bx: tx, by: gy, H: 84 * sc, spread: 62 * sc, trunkW: 5 * sc, clumpR: 10 * sc, roots: 0, limbs: 3, holes: 0.35, maxClumps: 40 });
      LW.drawTree(ctx, t, Object.assign({}, opts, { seed: 'fht' + Math.round(tx), masses: 5, backFrac: 0.2, ink: 0.9 }));
    }
  };

  // ---------------------------------------------------------------- main
  LW.drawLand = function (ctx) {
    const x0 = -20, x1 = SC.W + 20;
    // far ridge
    fillUnder(ctx, SC.ridgeFar, x0, x1, 2400, '#22414d', LW.REG.cool);
    contourHatch(ctx, SC.ridgeFar, x0, x1, 70, {
      seed: 'far', gap: 4.2, w: 0.75,
      colFn: (x, y, d, g, r) => (g > 0.55 ? (r < 0.5 ? P.rust : '#5a2b25') : r < 0.75 ? P.deep : '#173039'),
    });
    farRidgeTexture(ctx);
    rimLine(ctx, SC.ridgeFar, x0, x1, { seed: 2, warmAt: 0.32, coolCol: P.sea, drop: 2.4 });
    // near ridge
    fillUnder(ctx, SC.ridgeNear, x0, x1, 2400, '#162a36', LW.REG.cool);
    patchwork(ctx);
    rimLine(ctx, SC.ridgeNear, x0, x1, { seed: 5, warmAt: 0.3, coolCol: P.teal, drop: 2.0, ink: 1.1 });
    telegraph(ctx);
    farmhouse(ctx);
  };

  // far ridge: field boundaries, patches hatched across the contour, tiny trees and hedge dots, grain
  function farRidgeTexture(ctx) {
    const rng = new LW.RNG('far-tex');
    const clip = new Path2D(); LW.polyPath(clip, profile(SC.ridgeFar, -20, SC.W + 20, 3).concat([SC.W + 20, 2400, -20, 2400]), true);
    ctx.save(); ctx.clip(clip);
    const fb = new LW.FillBatch();
    let x = -20;
    while (x < SC.W) {
      const w = rng.range(70, 210), xa = x, xb = x + w;
      const top = SC.ridgeFar((xa + xb) / 2);
      const g = SC.glow((xa + xb) / 2, top - 15);
      const col = g > 0.55 ? (rng.next() < 0.5 ? '#5a2b25' : P.rust) : rng.next() < 0.5 ? '#173039' : '#0f1923';
      const u = rng.next();
      if (u < 0.4) {
        const a = rng.sign() * rng.range(0.4, 1.1), gap = rng.range(3.4, 5);
        for (let o = xa; o < xb; o += gap) LW.ribbon(fb.p(col), [o, SC.ridgeFar(o) + 3, o + 70 * a, SC.ridgeFar(o) + 73], (t) => 0.5 * LW.taper(t, 0.05, 0.3));
      } else if (u < 0.6) {
        for (let i = 0; i < w * 6; i++) { const px = rng.range(xa, xb), py = SC.ridgeFar(px) + rng.range(3, 70); LW.dot(fb.p(col), px, py, rng.range(0.4, 0.8)); }
      }
      // boundary hedge running down the slope
      if (rng.next() < 0.7) {
        const hp = LW.resample([xb, SC.ridgeFar(xb) + 2, xb + rng.range(-14, 14), SC.ridgeFar(xb) + 70], 2.5);
        LW.ribbon(fb.p('#0b141c'), LW.wobble(hp, 0.9, 0.25, xb), (t) => 0.9 * LW.taper(t, 0.05, 0.05));
        for (let k = 0; k < hp.length; k += 4) if (rng.next() < 0.5) LW.dot(fb.p('#0b141c'), hp[k] + rng.range(-1, 1), hp[k + 1], rng.range(0.8, 1.6));
      }
      x = xb;
    }
    // plate grain over the whole ridge
    for (let i = 0; i < 9000; i++) { const px = rng.range(-20, SC.W + 20), py = SC.ridgeFar(px) + rng.range(2, 80); LW.dot(fb.p(rng.next() < 0.75 ? '#0f1923' : '#2c4c57'), px, py, rng.range(0.35, 0.7)); }
    fb.flush(ctx, ['#2c4c57', '#173039', '#5a2b25', P.rust, '#0f1923', '#0b141c']);
    ctx.restore();
    // tiny trees standing on the far skyline
    const tr = new LW.FillBatch(), rim = new LW.FillBatch();
    for (let i = 0; i < 70; i++) {
      const tx = rng.range(0, SC.W), ty = SC.ridgeFar(tx) + 1.5;
      if (Math.abs(tx - 1062) < 170) continue;
      const r = rng.range(1.6, 3.8);
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const ox = tx + k * r * 1.5;
        LW.ribbon(tr.p(P.ink), [ox, ty + 1, ox, ty - r * 1.2], () => 0.5);
        LW.polyPath(tr.p(P.ink), LW.scallop(ox, ty - r * 1.6, r, rng, { bumps: 5, depth: 0.15, per: 3 }), true);
        if (SC.glow(ox, ty - 10) > 0.35) LW.ribbon(rim.p(P.amber), [ox - r * 0.9, ty - r * 1.5, ox - r * 0.2, ty - r * 2.4], () => 0.45);
      }
    }
    tr.flush(ctx); rim.flush(ctx);
  }

  // a line of telegraph poles on the left ridge, wires sagging against the glow
  function telegraph(ctx) {
    const rng = new LW.RNG('poles');
    const xs = [70, 205, 330, 448, 556, 655];
    const tops = [];
    const fb = new LW.FillBatch(), rim = new LW.FillBatch();
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] + rng.range(-6, 6);
      const base = SC.landTop(x) + 6 + i * 1.2;
      const hgt = 40 - i * 3.3;
      const lean = rng.range(-0.02, 0.02);
      const tx = x + hgt * lean, ty = base - hgt;
      LW.ribbon(fb.p(P.ink), [x, base, tx, ty], (t) => 1.25 - 0.4 * t - i * 0.06);
      const cw = 7 - i * 0.6;
      LW.ribbon(fb.p(P.ink), [tx - cw, ty + 3, tx + cw, ty + 2.6], () => 0.75 - i * 0.04);
      for (const sx of [-cw * 0.8, cw * 0.8]) LW.dot(fb.p(P.ink), tx + sx, ty + 1.8, 0.9 - i * 0.05);
      if (SC.glow(x, ty) > 0.3) LW.ribbon(rim.p(P.amber), [x - 0.8, base - 2, tx - 0.8, ty + 4], (t) => 0.45 * LW.taper(t, 0.1, 0.1));
      tops.push([tx, ty + 2, cw]);
    }
    for (let i = 0; i < tops.length - 1; i++) {
      const [ax, ay, aw] = tops[i], [bx, by, bw] = tops[i + 1];
      for (const sgn of [-1, 1]) {
        const x0 = ax + sgn * aw * 0.8, x1 = bx + sgn * bw * 0.8;
        const pts = [];
        for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(x0 + (x1 - x0) * t, ay + (by - ay) * t + 9 * 4 * t * (1 - t)); }
        LW.ribbon(fb.p(P.ink), pts, () => 0.42);
      }
    }
    fb.flush(ctx); rim.flush(ctx);
  }
})();
