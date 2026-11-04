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
  function farmhouse(ctx, part) {
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
    const wx = hL + 42, wy = hT + 12, ww = 11, wh = 13;
    const tf = (x, y) => [fx0 + (x - fx0) * 1.35, base0 + (y - base0) * 1.35];
    { const a = tf(wx, wy), b = tf(wx + ww, wy + wh); LW.farmWindow = { x0: a[0], y0: a[1], x1: b[0], y1: b[1] }; }
    if (part === 'window') { farmWindow(ctx, sp, wx, wy, ww, wh, base, rng); ctx.restore(); return; }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = 1.7; ctx.stroke(sp); // finer key line: the farthest built thing
    ctx.fillStyle = sil; ctx.fill(sp);
    // board / shingle hatching inside the silhouette
    ctx.save(); ctx.clip(sp);
    const h = new LW.StrokeBatch();
    for (let y = bT - 26; y < base; y += 3.2) { const q = h.p('#1f3a46', 0.7); q.moveTo(bL - 30, y + rng.range(-0.4, 0.4)); q.lineTo(bL + 6, y); }
    for (let x = bL + 3; x < bR; x += 3.4) { const q = h.p('#1f3a46', 0.7); q.moveTo(x, bT + 2); q.lineTo(x + rng.range(-0.5, 0.5), base); }
    for (let x = hL + 2; x < hR; x += 4) { const q = h.p('#1d3540', 0.6); q.moveTo(x, hT + 1); q.lineTo(x, base); }
    for (let y = hT - 28; y < hT; y += 3) { const q = h.p('#24414c', 0.7); q.moveTo(hL - 4, y); q.lineTo(hR + 4, y + 1); }
    h.flush(ctx);
    ctx.restore();
    // rim light on the sun-facing (left) roof slopes and walls
    const rim = new Path2D();
    LW.ribbon(rim, [bL + 1.5, bT + 2, bL + 13, bT - 14, (bL + bR) / 2, bT - 24], (t) => 1.3 * LW.taper(t, 0.1, 0.2));
    LW.ribbon(rim, [hL + 1.5, hT + 3, (hL + hR) / 2, hT - 27], (t) => 1.2 * LW.taper(t, 0.1, 0.2));
    LW.ribbon(rim, [bL - 25, base - 18, bL - 1, base - 28], (t) => 0.9 * LW.taper(t, 0.1, 0.1));
    LW.ribbon(rim, [hR - 17, hT - 33, hR - 17, hT - 14], (t) => 0.8 * LW.taper(t, 0.1, 0.1));
    ctx.fillStyle = P.amber; ctx.fill(rim);
    // a small tree beside the house
    LW.miniTree(ctx, hR + 22, base, 46, 20, rng, true);
    LW.miniTree(ctx, bL - 40, base + 2, 30, 14, rng, true);
    ctx.restore();
  }
  // the lit window is drawn after the haze, so it stays the one unveiled warm accent
  function farmWindow(ctx, sp, wx, wy, ww, wh, base, rng) {
    const ink = P.ink;
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
  }

  // tiny distant tree: trunk + scalloped blob
  LW.miniTree = function (ctx, x, y, h, r, rng, rim) {
    const ink = new Path2D();
    LW.ribbon(ink, [x, y, x + rng.range(-1, 1), y - h * 0.55], (t) => 1.6 * (1 - t * 0.5));
    ctx.fillStyle = P.ink; ctx.fill(ink);
    const pts = LW.scallop(x, y - h + r * 0.9, r, rng, { bumpSize: Math.max(4, r * 0.35), depth: 0.12, per: 5, squash: 1.05 });
    const p = new Path2D(); LW.polyPath(p, pts, true);
    ctx.strokeStyle = P.ink; ctx.lineWidth = Math.min(2, 0.9 + r * 0.06); ctx.stroke(p);
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
    const opts = { seed: 'fh', ink: 0.5, bump: 0.3, markScale: 0.4, markDensity: 170, rimW: 1.1, fillCol: '#142a33', backCol: '#10202a', capCol: '#21454f' };
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
      LW.drawTree(ctx, t, Object.assign({}, opts, { seed: 'fht' + Math.round(tx), masses: 5, backFrac: 0.2, ink: 0.6 }));
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
    rimLine(ctx, SC.ridgeFar, x0, x1, { seed: 2, warmAt: 0.32, coolCol: P.sea, drop: 2.4 });
    // near ridge
    fillUnder(ctx, SC.ridgeNear, x0, x1, 2400, '#162a36', LW.REG.cool);
    patchwork(ctx);
    rimLine(ctx, SC.ridgeNear, x0, x1, { seed: 5, warmAt: 0.3, coolCol: P.teal, drop: 2.0, ink: 0.9 });
    const D = LW.depth;
    // aerial perspective: the far ridge sits deepest in the air, the near hill a step less; the lowest
    // bands (where mist lies) take extra flat steps. Every shift is quantised, so the plates stay flat.
    D.pixelHaze(ctx, 2060, 2300, (x, y) => {
      const top = SC.landTop(x);
      if (y < top - 3) return 0;
      let k = y >= SC.ridgeNear(x) - 1 ? HAZE.near : HAZE.far;
      // mist steps with ragged, terrain-following edges (not ruled straight across)
      const m = 6 * LW.N1(x * 0.005, 3.1) + 2.5 * LW.N2(x * 0.03, 1.7);
      if (y > 2258 + m) k += HAZE.low; if (y > 2274 + 0.6 * m) k += HAZE.low;
      return k;
    }, SC.yh - 8);
    // farm: drawn on its own, pulled back one step less than the hill it stands on
    const c = D.begin();
    farmhouse(c, 'body');
    D.tint(HAZE.farm, 2120, 2300, 780, 1260, D.airAt(1062));
    D.commit(ctx, 2120, 2300, 780, 1260);
    hazeRules(ctx);
    farmhouse(ctx, 'window');
  };
  const HAZE = { far: 0.52, near: 0.36, low: 0.06, farm: 0.22 };
  LW.HAZE = HAZE;

  // horizon mist in line work: fine horizontal rules in the glow colour, dense at the foot of the hills
  // and thinning upward; they skip the lit window so it stays the clear focal accent
  function hazeRules(ctx) {
    const rng = new LW.RNG('haze-rules');
    const D = LW.depth, S = LW.S, hz = D.hazeData;
    const fb = new LW.FillBatch();
    const win = LW.farmWindow;
    // posterise the rule ink to the sky's own plate steps, so the mist is drawn in the glow's inks
    const STEPS = [P.cream, P.straw, P.amber, P.orange, P.rust].map((h) => [h, LW.hex(h)]);
    const colAt = (x) => {
      const o = (Math.min(D.H - 1, Math.round((SC.yh - 8) * S)) * D.W + LW.clamp(Math.round(x * S), 0, D.W - 1)) * 4;
      let best = null, bd = 1e9;
      let bi = 0;
      STEPS.forEach(([h, c], i) => { const d = (c[0] - hz[o]) ** 2 + (c[1] - hz[o + 1]) ** 2 + (c[2] - hz[o + 2]) ** 2; if (d < bd) { bd = d; bi = i; } });
      best = STEPS[Math.min(STEPS.length - 1, bi + 1)][0]; // one ink step below the glow: mist, not light
      return best;
    };
    for (let y = 2150; y < 2296; y += rng.range(3.0, 4.2)) {
      const dens = Math.pow(LW.smooth(2195, 2292, y), 1.4);
      if (dens < 0.03) continue;
      let x = -20 + rng.range(0, 40);
      while (x < SC.W + 20) {
        const len = rng.range(20, 200) * (0.3 + dens);
        const gap = rng.range(14, 110) * (1.7 - dens);
        if (rng.next() < 0.15 + 0.6 * dens) {
          // split the dash wherever it would leave the land or cross the window
          let run = [];
          const flush = () => {
            if (run.length >= 4) {
              const mx = run[(run.length >> 2) * 2], my = run[(run.length >> 2) * 2 + 1];
              LW.ribbon(fb.p(colAt(mx)), run, (t) => (0.22 + 0.26 * dens) * LW.taper(t, 0.15, 0.15));
            }
            run = [];
          };
          for (let xx = x; xx <= x + len; xx += 4) {
            const yy = y + 0.25 * LW.N2(xx * 0.004, y * 0.2);
            const inWin = win && xx > win.x0 - 7 && xx < win.x1 + 7 && yy > win.y0 - 7 && yy < win.y1 + 7;
            if (yy > SC.landTop(xx) + 2.5 && !inWin) run.push(xx, yy); else flush();
          }
          flush();
        }
        x += len + gap;
      }
    }
    fb.flush(ctx);
  }
})();
