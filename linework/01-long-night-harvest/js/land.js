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
    ctx.restore();
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
    const blobs = [];
    let x = -20;
    const gateX = SC.screenX(SC.pathX(Z), Z);
    while (x < SC.W + 20) {
      const gy = SC.groundY(SC.worldX(x, Z), Z);
      if (Math.abs(x - gateX) < 14) { x += 28; continue; }
      const roll = rng.next();
      const tall = roll < 0.07, gap = roll > 0.96;
      if (gap) { x += rng.range(10, 30); continue; }
      const swell = 0.75 + 0.5 * (0.5 + 0.5 * LW.N1(x * 0.006, 3));
      const r = (tall ? rng.range(12, 20) : rng.range(4.5, 10)) * swell;
      const hgt = (tall ? rng.range(30, 50) : rng.range(10, 20)) * swell;
      blobs.push({ x, y: gy - hgt + r, r, tall, gy });
      if (tall) for (let k = 0; k < 3; k++) blobs.push({ x: x + rng.range(-r * 0.8, r * 0.8), y: gy - hgt * rng.range(0.35, 0.7), r: r * rng.range(0.45, 0.7), gy });
      x += r * rng.range(0.6, 1.3);
    }
    const union = new Path2D();
    const base = [];
    for (let xx = -20; xx <= SC.W + 20; xx += 4) base.push(xx, SC.groundY(SC.worldX(xx, Z), Z) - 6 + 2 * LW.N2(xx * 0.05, 1));
    for (let xx = SC.W + 20; xx >= -20; xx -= 8) base.push(xx, SC.groundY(SC.worldX(xx, Z), Z) + 1.5);
    LW.polyPath(union, base, true);
    const shapes = [];
    for (const b of blobs) {
      const pts = LW.wobble(LW.scallop(b.x, b.y, b.r, rng, { bumpSize: 3.6, depth: 0.16, per: 4 }), 0.4, 0.2, b.x, true);
      shapes.push(pts);
      LW.polyPath(union, pts, true);
    }
    const trunks = new Path2D();
    for (const b of blobs) if (b.tall) LW.ribbon(trunks, [b.x, b.gy, b.x + rng.range(-2, 2), b.y], (t) => 1.6 - t);
    ctx.fillStyle = P.ink; ctx.fill(trunks);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(union);
    ctx.fillStyle = '#101b26'; ctx.fill(union);
    // inner texture: tiny arcs
    const tex = new LW.FillBatch();
    for (const b of blobs) {
      for (let k = 0; k < b.r * 0.5; k++) {
        const a = rng.range(0, 6.28), d = rng.next() * b.r * 0.8;
        const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
        const arc = [];
        for (let t = 3.4; t <= 6.0; t += 0.4) arc.push(px + Math.cos(t) * 2.4, py + Math.sin(t) * 1.8);
        LW.ribbon(tex.p('#1d3a46'), arc, () => 0.45);
      }
    }
    tex.flush(ctx);
    // rim only along the topmost silhouette, broken, warm near the sun
    const rim = new LW.FillBatch();
    const covered = (px, py) => { for (const b of blobs) if ((b.x - px) ** 2 + (b.y - py) ** 2 < (b.r * 0.92) ** 2) return true; return false; };
    for (let si = 0; si < blobs.length; si++) {
      const b = blobs[si], pts = shapes[si];
      const g = SC.glow(b.x, SC.yh - 40);
      if (rng.next() < 0.35) continue;
      let run = [];
      const flush = () => {
        if (run.length >= 6) {
          const col = g > 0.75 ? P.straw : g > 0.42 ? P.amber : g > 0.27 ? P.orange : '#3a6a6c';
          LW.ribbon(rim.p(col), run, (t) => (0.35 + 0.9 * LW.smooth(0.2, 0.9, g)) * LW.taper(t, 0.25, 0.25));
        }
        run = [];
      };
      for (let i = 0; i < pts.length; i += 2) {
        const nx = pts[i] - b.x, ny = pts[i + 1] - b.y, l = Math.hypot(nx, ny) || 1;
        const sx = SC.sun.x - b.x;
        const facing = -ny / l > 0.35 && (nx / l) * Math.sign(sx) > -0.2;
        if (facing && !covered(pts[i] + (nx / l) * 4, pts[i + 1] + (ny / l) * 4)) run.push(pts[i] - (nx / l) * 1.3, pts[i + 1] - (ny / l) * 1.3);
        else flush();
      }
      flush();
    }
    rim.flush(ctx);
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
    rimLine(ctx, SC.ridgeNear, x0, x1, { seed: 5, warmAt: 0.3, coolCol: P.teal, drop: 2.0, ink: 1.1 });
    farmhouse(ctx);
  };
})();
