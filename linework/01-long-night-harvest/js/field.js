/* The field: cart path with ruts and puddles, wheat rows in perspective at three levels of
 * detail, tramlines, the right-hand hedgerow and the oak, interleaved by depth. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC, P = LW.P;
  const f = SC.f, H = SC.camH, yh = SC.yh;
  const CANOPY = 0.95;

  // ---------------------------------------------------------------- light & colour
  function fieldLight(x, y, X, Z) {
    const d = LW.smooth(3, 50, Z);
    const az = Math.exp(-(((x - SC.sun.x - 60) / (230 + 0.75 * (y - yh))) ** 2));
    const sheen = LW.fbm(LW.N2, X * 0.04 + Z * 0.012, Z * 0.05, 3);
    const slope = (SC.terrain(X, Z + 1.5) - SC.terrain(X, Z - 1.5)) / 3;
    const wave = Math.sin(Z * 0.62 + X * 0.03 + 2.2 * LW.N1(X * 0.012, Z * 0.02)) * (1 - LW.smooth(60, 140, Z));
    let v = 0.42 + 0.34 * d + 0.4 * az * (0.1 + 0.9 * d) + 0.13 * sheen + 0.17 * wave - 5 * slope;
    v *= 0.6 + 0.4 * LW.smooth(3.5, 18, Z);
    v *= 1 - 0.3 * LW.smooth(3150, 3840, y);
    return v;
  }
  LW.fieldLight = fieldLight;
  const RAMP = [
    [0.93, P.cream], [0.72, P.straw], [0.59, P.amber], [0.47, P.orange], [0.38, P.rust],
    [0.29, P.sea], [0.2, P.teal], [-9, '#204550'],
  ];
  function rampIdx(v) { for (let i = 0; i < RAMP.length; i++) if (v > RAMP[i][0]) return i; return RAMP.length - 1; }
  const ORDER = RAMP.map((r) => r[1]).reverse();

  function inPath(X, Z, pad) {
    const c = SC.pathX(Z);
    const hw = SC.pathHalf(Z) + (pad || 0) + 0.06 * LW.N1(Z * 0.7, 2.2);
    return Math.abs(X - c) < hw;
  }
  function inTram(X, Z) {
    const m = X - 0.15 * Z - 6;
    const k = ((m % 24) + 24) % 24;
    const d = Math.min(k, 24 - k);
    return Math.abs(d - 0.95) < 0.24 && Z > 6;
  }
  function beyondHedge(X, Z) { return Z > 20 && Z < SC.farHedgeZ && X > SC.hedgeX(Z) - 0.4; }

  // ---------------------------------------------------------------- the cart path
  function drawPath(ctx) {
    const rng = new LW.RNG('path');
    const Zs = [];
    for (let l = Math.log(240); l > Math.log(2.1); l -= 0.004) Zs.push(Math.exp(l));
    const edge = (Z, side) => {
      const c = SC.pathX(Z), hw = SC.pathHalf(Z) * (1 + 0.07 * LW.N3(Z * 0.9, side * 5));
      const X = c + side * hw;
      return [SC.screenX(X, Z), SC.groundY(c, Z)];
    };
    // soil, posterised by distance and sun
    const soil = new LW.FillBatch();
    for (let i = 0; i < Zs.length - 1; i++) {
      const Za = Zs[i], Zb = Zs[i + 1];
      const a0 = edge(Za, -1), a1 = edge(Za, 1), b0 = edge(Zb, -1), b1 = edge(Zb, 1);
      const x = (a0[0] + a1[0]) / 2;
      const az = Math.exp(-(((x - SC.sun.x) / (260 + 0.6 * (a0[1] - yh))) ** 2));
      const v = 0.2 + 0.5 * LW.smooth(15, 120, Za) * az + 0.15 * LW.smooth(5, 40, Za);
      const col = v > 0.55 ? '#6a5a4c' : v > 0.4 ? '#46565a' : v > 0.28 ? '#30434a' : '#1d2d35';
      const q = soil.p(col);
      q.moveTo(a0[0], a0[1] - 0.3); q.lineTo(a1[0], a1[1] - 0.3); q.lineTo(b1[0], b1[1] + 0.3); q.lineTo(b0[0], b0[1] + 0.3); q.closePath();
    }
    LW.offset(ctx, LW.REG.cool, () => soil.flush(ctx));
    // cross-hatching of the soil
    const hatch = new LW.FillBatch();
    let lastY = 1e9;
    for (let i = Zs.length - 1; i >= 0; i--) {
      const Z = Zs[i];
      const a = edge(Z, -1), b = edge(Z, 1);
      const gap = Math.max(2.4, 1.2 + (a[1] - yh) * 0.004);
      if (lastY - a[1] < gap) continue;
      lastY = a[1];
      const w = b[0] - a[0];
      const pts = [];
      const segs = Math.max(2, Math.round(w / 6));
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        pts.push(a[0] + w * t, a[1] + (b[1] - a[1]) * t + 1.2 * LW.N2(t * 4, Z) * Math.min(3, w / 200));
      }
      LW.dashes(pts, rng, 10, 90, 3, 16, (sub) => {
        const near = LW.smooth(yh, 3800, a[1]);
        LW.ribbon(hatch.p(rng.next() < 0.75 ? '#101b23' : '#3c5054'), sub, (t) => (0.35 + 0.9 * near) * LW.taper(t, 0.2, 0.2));
      });
    }
    hatch.flush(ctx);
    // ruts (with tyre-groove lines), then puddles that mirror the glow
    const ruts = new LW.FillBatch(), grooves = new LW.FillBatch();
    const rutC = (Z, side) => SC.pathX(Z) + side * 0.33 + 0.03 * LW.N1(Z * 0.4, side);
    for (const side of [-1, 1]) {
      const left = [], right = [];
      for (const Z of Zs) {
        const c = rutC(Z, side), y = SC.groundY(c, Z);
        const hw = 0.1 * (1 + 0.25 * LW.N2(Z * 0.6, side * 3));
        left.push(SC.screenX(c - hw, Z), y); right.push(SC.screenX(c + hw, Z), y);
      }
      const poly = left.slice();
      for (let i = right.length - 2; i >= 0; i -= 2) poly.push(right[i], right[i + 1]);
      LW.polyPath(ruts.p('#111c24'), LW.wobble(poly, 0.8, 0.05, side * 7, true), true);
      for (const o of [-0.06, 0, 0.06]) {
        const g = [];
        for (const Z of Zs) { const c = rutC(Z, side) + o; g.push(SC.screenX(c, Z), SC.groundY(c, Z)); }
        LW.dashes(g, rng, 20, 160, 6, 30, (sub) => LW.ribbon(grooves.p(o === 0 ? '#2e434a' : '#22333b'), sub, (t, i, x, y) => (0.3 + 0.9 * LW.smooth(yh, 3800, y)) * LW.taper(t, 0.2, 0.2)));
      }
    }
    ruts.flush(ctx);
    grooves.flush(ctx);
    // puddles: few, long, flat water lying in the ruts, plus one thin sliver across the track.
    // Engraved-water convention: horizontal lines only; far bank reflected as a dark band,
    // a thin amber band where the horizon glow reflects, teal sky below it, navy at the near edge.
    const S = LW.S;
    const puddles = [];
    const taperEnds = (t) => Math.pow(Math.max(0, Math.min(1, t / 0.18, (1 - t) / 0.18)), 0.65);
    const rutPool = (side, Za, Zb, seed) => {
      const pl = [], pr = [];
      const zs = Zs.filter((Z) => Z <= Zb && Z >= Za); // Zs runs far -> near, so pl[0] is the far tip
      for (let k = 0; k < zs.length; k++) {
        const Z = zs[k], t = k / (zs.length - 1);
        const c = rutC(Z, side), y = SC.groundY(c, Z);
        const w = 0.085 * taperEnds(t) * (1 + 0.08 * LW.N3(Z * 1.7, seed)) + 0.002;
        pl.push(SC.screenX(c - w, Z), y); pr.push(SC.screenX(c + w, Z), y);
      }
      puddles.push({ pl, pr, seed, kind: 'rut' });
    };
    rutPool(-1, 11.5, 19, 1);
    rutPool(1, 8.3, 10.9, 2);
    rutPool(1, 26, 38, 3);
    {
      // the cross-track sliver: wide, very shallow in depth, its far edge following the far rut line
      const Zc = 6.85, dz = 0.27, Xa = SC.pathX(Zc) - 0.5, Xb = SC.pathX(Zc) + 0.46;
      const top = [], bot = [];
      for (let k = 0; k <= 60; k++) {
        const u = k / 60, X = Xa + (Xb - Xa) * u;
        const th = dz * taperEnds(u) * (1 + 0.15 * LW.N2(u * 6, 4)) + 0.004;
        const Zf = Zc + th * 0.65, Zn = Zc - th * 0.35;
        top.push(SC.screenX(X, Zf), SC.groundY(X, Zf));
        bot.push(SC.screenX(X, Zn), SC.groundY(X, Zn));
      }
      puddles.push({ pl: top, pr: bot, seed: 9, kind: 'cross' });
    }
    const water = new LW.FillBatch(), lines = new LW.FillBatch(), pudInk = new LW.FillBatch();
    const sunX = SC.sun.x;
    for (const pd of puddles) {
      const { pl, pr } = pd;
      const poly = pl.slice();
      for (let k = pr.length - 2; k >= 0; k -= 2) poly.push(pr[k], pr[k + 1]);
      const path = new Path2D(); LW.polyPath(path, poly, true);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let k = 0; k < poly.length; k += 2) { x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]); y0 = Math.min(y0, poly[k + 1]); y1 = Math.max(y1, poly[k + 1]); }
      const near = LW.smooth(yh, 3500, y1);
      ctx.fillStyle = '#0a1219'; ctx.fill(path);
      ctx.save(); ctx.clip(path);
      const hgt = Math.max(1, y1 - y0);
      // band profile measured from the far edge, in px (so long rut pools keep the bands near their far end)
      const bank = Math.max(1.5, Math.min(hgt * 0.2, 3 + 5 * near));
      const amberH = Math.max(1.6, Math.min(hgt * 0.25, 3 + 9 * near));
      const tealH = Math.min(hgt * 0.45, 10 + 40 * near);
      const step = 1.5 + 2.3 * near;
      const glowK = Math.exp(-((((x0 + x1) / 2 - sunX) / 700) ** 2));
      for (let yy = y0 + bank; yy < y1; yy += step * rng.range(0.85, 1.15)) {
        const d = yy - y0 - bank;
        let col, w, gapMul;
        if (d < amberH) { col = glowK > 0.5 && d < amberH * 0.5 ? P.straw : P.amber; w = 0.55 + 0.9 * near; gapMul = 0.25; }
        else if (d < amberH + tealH) { const k = (d - amberH) / tealH; col = k < 0.35 ? P.sea : k < 0.7 ? P.teal : '#1d3d49'; w = 0.45 + 0.8 * near; gapMul = 0.5 + k; }
        else { col = '#16303b'; w = 0.4 + 0.7 * near; gapMul = 1.8; }
        let xx = x0 - 3 + rng.range(0, 6);
        while (xx < x1 + 3) {
          const ww = rng.range(8, 46) * (0.4 + 1.2 * near);
          LW.ribbon(lines.p(col), [xx, yy, xx + ww * 0.25, yy, xx + ww * 0.5, yy + 0.15, xx + ww * 0.75, yy, xx + ww, yy], (t) => w * LW.taper(t, 0.12, 0.12));
          xx += ww + rng.range(1.5, 8) * gapMul * (0.5 + near);
        }
        // broken white glints in the bright band
        if (d < amberH && rng.next() < 0.6) {
          const gx = rng.range(x0, x1), gw = rng.range(2, 9) * (0.5 + near);
          LW.ribbon(lines.p('#fff6dc'), [gx, yy, gx + gw * 0.5, yy, gx + gw, yy], (t) => (0.5 + 0.6 * near) * LW.taper(t, 0.3, 0.3));
        }
      }
      lines.flush(ctx, ['#16303b', '#1d3d49', P.teal, P.sea, P.amber, P.straw, '#fff6dc']);
      ctx.restore();
      // banks: heavy shadowed far bank, fine broken near edge
      const top = pd.kind === 'cross' ? pl : null;
      if (top) {
        LW.ribbon(pudInk.p(P.ink), top, (t) => (1.2 + 2.2 * near) * LW.taper(t, 0.06, 0.06));
        LW.dashes(pr, rng, 30, 120, 6, 18, (sub) => LW.ribbon(pudInk.p(P.ink), sub, (t) => (0.4 + 0.6 * near) * LW.taper(t, 0.2, 0.2)));
      } else {
        // rut pools: the rut walls are the sides; far tip heavy, sides thin
        LW.ribbonClosed(pudInk.p(P.ink), LW.resample(poly, 3), (t, k, x, y) => (0.35 + 0.6 * near) * (0.6 + 1.6 * LW.smooth(y0 + hgt * 0.12, y0, y)));
      }
    }
    void water;
    pudInk.flush(ctx);
    LW.puddlePaths = puddles.map((pd) => { const q = new Path2D(); const poly = pd.pl.slice(); for (let k = pd.pr.length - 2; k >= 0; k -= 2) poly.push(pd.pr[k], pd.pr[k + 1]); LW.polyPath(q, poly, true); return q; });
    const inWater = (x, y) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(S, S); let r = false; for (const q of LW.puddlePaths) if (ctx.isPointInPath(q, x * S, y * S)) { r = true; break; } ctx.restore(); return r; };
    // walls of stalks either side of the slot, far to near
    const wall = new LW.FillBatch();
    for (let i = 0; i < Zs.length - 1; i++) {
      const Za = Zs[i], Zb = Zs[i + 1];
      for (const side of [-1, 1]) {
        const Xa = SC.pathX(Za) + side * (SC.pathHalf(Za) + 0.03), Xb = SC.pathX(Zb) + side * (SC.pathHalf(Zb) + 0.03);
        const xa = SC.screenX(Xa, Za), xb = SC.screenX(Xb, Zb);
        const ga = SC.groundY(Xa, Za), gb = SC.groundY(Xb, Zb);
        const ha = 0.6 + 0.1 * LW.N1(Za * 1.7, side), hb = 0.6 + 0.1 * LW.N1(Zb * 1.7, side);
        const ca = ga - (f * ha) / Za, cb = gb - (f * hb) / Zb;
        const q = wall.p(Za > 70 ? '#2c3e45' : Za > 32 ? '#1f323c' : Za > 14 ? '#15262f' : Za > 7 ? '#0f1c25' : '#0b141c');
        q.moveTo(xa, ga + 0.5); q.lineTo(xb, gb + 0.5); q.lineTo(xb, cb); q.lineTo(xa, ca); q.closePath();
      }
      if (i % 40 === 39) wall.flush(ctx);
    }
    wall.flush(ctx);
    // path edge ink lines (broken)
    const ink = new LW.FillBatch();
    for (const side of [-1, 1]) {
      const pts = [];
      for (const Z of Zs) { const e = edge(Z, side); pts.push(e[0], e[1]); }
      LW.dashes(pts, rng, 40, 200, 5, 25, (sub) => LW.ribbon(ink.p(P.ink), sub, (t, i, x, y) => (0.5 + 1.6 * LW.smooth(yh, 3800, y)) * LW.taper(t, 0.2, 0.2)));
    }
    ink.flush(ctx);
    // median and edge grass tufts
    const grass = new LW.FillBatch();
    for (let i = Zs.length - 1; i >= 0; i -= 2) {
      const Z = Zs[i];
      if (Z > 70) continue;
      const sc = f / Z;
      const n = Math.max(1, Math.round(6 * 4 / Z));
      for (let k = 0; k < n; k++) {
        const pick = rng.next();
        const X = SC.pathX(Z) + (pick < 0.5 ? rng.range(-0.14, 0.14) : rng.sign() * rng.range(0.7, 0.86));
        const x = SC.screenX(X, Z), y = SC.groundY(X, Z) + rng.range(-0.5, 0.5) * sc * 0.02;
        if (inWater(x, y) || inWater(x, y - 6)) continue;
        const h = rng.range(0.08, 0.2) * sc;
        const blades = rng.int(2, 4);
        for (let b = 0; b < blades; b++) {
          const a = rng.range(-0.6, 0.6);
          const tipx = x + Math.sin(a) * h, tipy = y - Math.cos(a) * h;
          const mx = x + Math.sin(a * 0.5) * h * 0.5, my = y - h * 0.55;
          const g = SC.glow(x, yh - 20);
          const col = rng.next() < 0.12 ? (g > 0.3 ? P.amber : P.sea) : rng.next() < 0.5 ? P.teal : '#2a4f5a';
          LW.ribbon(grass.p(col), [x, y, mx, my, tipx, tipy], (t) => Math.max(0.4, h * 0.035) * (1 - t));
        }
      }
    }
    grass.flush(ctx);
  }

  // ---------------------------------------------------------------- an ear of wheat (near LOD)
  function earDetailed(B, x, y, len, ang, v, rng) {
    const ci = Math.max(1, rampIdx(v));
    const col = RAMP[ci][1];
    const lite = RAMP[Math.max(1, ci - 1)][1];
    const dark = RAMP[Math.min(RAMP.length - 1, ci + 2)][1];
    const bend = rng.range(-0.25, 0.25);
    const n = LW.clamp(Math.round(len / 4.2), 6, 15);
    const rach = [];
    let a = ang, px = x, py = y;
    const st = len / 10;
    rach.push(px, py);
    for (let i = 0; i < 10; i++) { a += bend * 0.1; px += Math.sin(a) * st; py -= Math.cos(a) * st; rach.push(px, py); }
    const gl = (len / n) * 2.1, gw = len * 0.075;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.6) / (n + 0.4);
      const k = Math.min(9, Math.floor(s * 10));
      const fx = s * 10 - k;
      const cx = rach[2 * k] + (rach[2 * k + 2] - rach[2 * k]) * fx, cy = rach[2 * k + 1] + (rach[2 * k + 3] - rach[2 * k + 1]) * fx;
      const side = i % 2 ? 1 : -1;
      const ra = ang + bend * s;
      const ga = ra + side * 0.42;
      const taper = 1 - 0.35 * Math.pow(s, 2);
      const L = gl * taper, Wd = gw * taper;
      const ox = cx + Math.cos(ra) * side * Wd * 0.55, oy = cy + Math.sin(ra) * side * Wd * 0.55;
      const dx = Math.sin(ga), dy = -Math.cos(ga);
      const nx = -dy, ny = dx;
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.2) {
        const w = Math.sin(Math.PI * t) * Wd * 0.5;
        pts.push(ox + dx * L * (t - 0.4) + nx * w, oy + dy * L * (t - 0.4) + ny * w);
      }
      for (let t = 0.8; t > 0.0001; t -= 0.2) {
        const w = Math.sin(Math.PI * t) * Wd * 0.5;
        pts.push(ox + dx * L * (t - 0.4) - nx * w, oy + dy * L * (t - 0.4) - ny * w);
      }
      LW.polyPath(B.ink, pts, true);
      LW.polyPath(B.fill.p(side > 0 ? col : (ci < RAMP.length - 2 ? RAMP[ci + 1][1] : col)), pts, true);
      // awn
      const tipx = ox + dx * L * 0.6, tipy = oy + dy * L * 0.6;
      const al = len * rng.range(0.55, 1.05);
      const aa = ga - side * 0.25 + rng.range(-0.1, 0.1);
      LW.ribbon(B.awn.p(lite), [tipx, tipy, tipx + Math.sin(aa) * al * 0.5, tipy - Math.cos(aa) * al * 0.5, tipx + Math.sin(aa + side * 0.08) * al, tipy - Math.cos(aa + side * 0.08) * al], (t) => Math.max(0.3, len * 0.012) * (1 - t * 0.8));
    }
    return dark;
  }

  // ---------------------------------------------------------------- one depth row of wheat
  function drawRow(ctx, Z, dZ, rng) {
    const earPx = (0.085 * f) / Z;
    const lod = earPx < 4.5 ? 0 : earPx < 15 ? 1 : 2;
    const sx = Math.max(1.9, earPx * (lod === 2 ? 0.55 : 0.42));
    const B = { ink: new Path2D(), fill: new LW.FillBatch(), awn: new LW.FillBatch(), stem: new LW.FillBatch(), tick: new LW.FillBatch() };
    let any = false;
    let nextStep = 1;
    for (let x = -30 + rng.next() * sx; x < SC.W + 30; x += sx * rng.range(0.6, 1.4) * nextStep) {
      const Zi = Z + rng.range(-0.5, 0.5) * dZ;
      const X = SC.worldX(x, Zi);
      const dPath = Math.abs(X - SC.pathX(Zi)) - SC.pathHalf(Zi);
      const nearPath = dPath < 0.5;
      nextStep = nearPath ? 0.7 : 1;
      const edge = nearPath && dPath < 0.14;
      const sunWall = X > SC.pathX(Zi);
      if (inPath(X, Zi, 0.02)) continue;
      if (inTram(X, Zi)) continue;
      const g = SC.terrain(X, Zi);
      const pasture = beyondHedge(X, Zi);
      const c = pasture ? 0.25 : CANOPY + 0.09 * LW.N3(X * 0.25, Zi * 0.25) + (nearPath ? rng.range(-0.16, 0.08) + 0.08 * LW.N2(Zi * 2.3, X) : rng.range(-0.04, 0.04));
      const yb = yh + (f * (H - g - c)) / Zi;
      if (yb > 3920 + earPx) continue;
      let lean = 0.22 * LW.N1(X * 0.04 + Zi * 0.02, Zi * 0.04) + 0.1 * rng.normal() + 0.08;
      if (edge && rng.next() < 0.07) lean += rng.sign() * rng.range(0.4, 0.8); // a lodged stalk
      let v = fieldLight(x, yb, X, Zi) + rng.range(-0.06, 0.06);
      any = true;
      if (pasture) {
        const h = earPx * 0.6;
        const col = v > 0.5 ? P.sea : v > 0.3 ? P.teal : '#1d3c47';
        LW.ribbon(B.tick.p(col), [x, yb, x + Math.sin(lean) * h, yb - h], (t) => Math.max(0.45, earPx * 0.08) * (1 - t * 0.7));
        continue;
      }
      if (lod === 0) {
        const h = earPx * rng.range(0.9, 1.3);
        const ri = rampIdx(v);
        let col = ri <= 1 && rng.next() < 0.5 ? (rng.next() < 0.6 ? P.orange : P.rust) : RAMP[Math.max(1, ri)][1];
        if (Zi > 140) col = rng.next() < 0.55 ? P.straw : rng.next() < 0.6 ? P.amber : P.orange;
        const w = 0.3 + earPx * 0.1; // finer toward the horizon, continuous with distance
        LW.ribbon(B.tick.p(col), [x, yb, x + Math.sin(lean) * h * 0.5, yb - h * 0.5, x + Math.sin(lean * 1.2) * h, yb - h], (t) => w * LW.taper(t, 0.3, 0.25));
        if (nearPath && dPath < 0.3) {
          const ground = yh + (f * (H - g)) / Zi;
          LW.ribbon(B.stem.p(edge ? (sunWall ? (rng.next() < 0.6 ? P.rust : P.amber) : (rng.next() < 0.2 ? P.rust : '#2b4f59')) : '#17303a'), [x, yb, x - Math.sin(lean) * (ground - yb) * 0.3, ground], (t) => Math.max(0.35, earPx * 0.06));
        }
        if (earPx > 2.5 && rng.next() < 0.5 * LW.smooth(2.5, 4.5, earPx)) {
          // the shadow side of the ear: a dark sliver
          LW.ribbon(B.stem.p('#0f1d26'), [x + w * 1.4, yb + 1, x + w * 1.4 + Math.sin(lean) * h * 0.8, yb - h * 0.8], (t) => w * 0.6 * LW.taper(t, 0.3, 0.3));
        }
      } else if (lod === 1) {
        const h = earPx * rng.range(0.9, 1.2);
        const ci = Math.max(1, rampIdx(v));
        const col = RAMP[ci][1], lite = RAMP[Math.max(1, ci - 1)][1];
        const ax = Math.sin(lean), ay = -Math.cos(lean);
        const w = earPx * 0.13;
        // stem
        const sl = nearPath ? (f * c) / Zi : Math.min(earPx * 3.2, (f * c) / Zi);
        const sp = [x, yb, x - ax * sl * 0.5 + rng.range(-1, 1), yb + sl * 0.5, x - ax * sl * 0.2, yb + sl];
        if (nearPath) {
          // wall of stalks: front stalks lit and outlined, deeper ones fall into shadow
          const sw = Math.max(0.45, w * 0.32);
          if (edge) {
            LW.ribbon(B.stem.p(P.ink), sp, () => sw + 0.7);
            LW.ribbon(B.stem.p(sunWall ? (rng.next() < 0.45 ? P.rust : rng.next() < 0.5 ? '#7a3a26' : '#2f5962') : (rng.next() < 0.5 ? '#21424b' : '#1a353e')), sp, () => sw);
            if ((sunWall || v > 0.45) && rng.next() < (sunWall ? 0.85 : 0.4)) {
              const sgn = SC.sun.x < x ? -1 : 1;
              LW.ribbon(B.stem.p(sunWall ? (v > 0.5 ? P.straw : P.amber) : P.rust), [sp[0] + sgn * sw * 0.6, sp[1], sp[2] + sgn * sw * 0.6, sp[3]], (t) => sw * 0.5 * LW.taper(t, 0.05, sunWall ? 0.35 : 0.6));
            }
            // a leaf flag on some front stalks
            if (rng.next() < 0.18) {
              const lyy = yb + sl * rng.range(0.2, 0.6), lxx = x - ax * sl * 0.2, sd = rng.sign(), ll = earPx * rng.range(0.8, 1.8);
              LW.ribbon(B.stem.p(P.ink), [lxx, lyy, lxx + sd * ll * 0.5, lyy - ll * 0.2, lxx + sd * ll, lyy + ll * rng.range(0, 0.5)], (t) => (w * 0.35 + 0.6) * LW.taper(t, 0.05, 0.9));
              LW.ribbon(B.stem.p('#2c5560'), [lxx, lyy, lxx + sd * ll * 0.5, lyy - ll * 0.2, lxx + sd * ll, lyy + ll * rng.range(0, 0.5)], (t) => w * 0.35 * LW.taper(t, 0.05, 0.9));
            }
          } else {
            LW.ribbon(B.stem.p(dPath < 0.3 ? '#1a3640' : '#122630'), sp, () => sw * 0.85);
          }
        } else LW.ribbon(B.stem.p(v > 0.45 ? '#2a3f45' : '#132530'), sp, (t) => Math.max(0.35, w * 0.3));
        // spindle
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.25) { const ww = Math.sin(Math.PI * Math.pow(t, 0.8)) * w; pts.push(x + ax * h * t - ay * ww, yb + ay * h * t + ax * ww); }
        for (let t = 0.75; t > 0.0001; t -= 0.25) { const ww = Math.sin(Math.PI * Math.pow(t, 0.8)) * w; pts.push(x + ax * h * t + ay * ww, yb + ay * h * t - ax * ww); }
        LW.polyPath(B.ink, pts, true);
        LW.polyPath(B.fill.p(col), pts, true);
        if (edge && (v > 0.4 || sunWall)) {
          const rimc = v > 0.6 ? P.straw : P.amber;
          LW.ribbon(B.awn.p(rimc), [x + ax * h * 0.15 - ay * w * 0.5, yb + ay * h * 0.15 + ax * w * 0.5, x + ax * h * 0.85 - ay * w * 0.35, yb + ay * h * 0.85 + ax * w * 0.35], (t) => w * 0.35 * LW.taper(t, 0.2, 0.2) + 0.2);
        }
        const na = rng.int(2, 4);
        for (let k = 0; k < na; k++) {
          const s = 0.55 + 0.45 * (k / na);
          const bx = x + ax * h * s, by = yb + ay * h * s;
          const aa = lean + rng.range(-0.35, 0.35);
          const al = h * rng.range(0.5, 0.95);
          LW.ribbon(B.awn.p(lite), [bx, by, bx + Math.sin(aa) * al, by - Math.cos(aa) * al], (t) => Math.max(0.28, earPx * 0.025) * (1 - 0.7 * t));
        }
      } else {
        // stem + leaf down toward the ground
        const ground = yh + (f * (H - g)) / Zi;
        const ax = Math.sin(lean);
        const sl = ground - yb;
        const wstem = Math.max(0.6, earPx * 0.05);
        const bow = rng.range(-1, 1) * earPx * 0.4;
        const stem = [x, yb, x - ax * sl * 0.15 + bow * 0.5, yb + sl * 0.35, x - ax * sl * 0.3 + bow, yb + sl * 0.7, x - ax * sl * 0.38 + bow, ground];
        const ink = edge ? (sunWall ? (rng.next() < 0.5 ? P.rust : '#2f5962') : (rng.next() < 0.5 ? '#26474f' : '#1d3a43')) : nearPath ? '#16303a' : v > 0.45 ? '#33474b' : '#122430';
        LW.ribbon(B.stem.p(P.ink), stem, (t) => wstem + 0.8);
        LW.ribbon(B.stem.p(ink), stem, (t) => wstem);
        if (rng.next() < (nearPath ? 0.22 : 0.5)) {
          const ly = yb + sl * rng.range(0.15, 0.6), lx = x - ax * sl * 0.12 + bow * 0.4;
          const side = rng.sign();
          const ll = earPx * rng.range(1.1, 2.8);
          const lift = rng.range(0.05, 0.45), fall = rng.range(-0.1, 0.5);
          const leaf = [lx, ly, lx + side * ll * 0.45, ly - ll * lift, lx + side * ll * 0.85, ly - ll * lift * 0.3, lx + side * ll, ly + ll * fall];
          LW.ribbon(B.stem.p(P.ink), leaf, (t) => (earPx * 0.07 + 0.8) * LW.taper(t, 0.05, 0.9));
          LW.ribbon(B.stem.p(v > 0.4 ? P.teal : '#1d3c47'), leaf, (t) => earPx * 0.07 * LW.taper(t, 0.05, 0.9));
        }
        earDetailed(B, x, yb, earPx * rng.range(0.9, 1.2), lean, v, rng);
      }
    }
    if (!any) return;
    B.stem.flush(ctx);
    B.tick.flush(ctx, ORDER);
    if (lod > 0) {
      // outline weight grows continuously toward the camera (no step at the LOD switches)
      ctx.strokeStyle = P.ink; ctx.lineWidth = LW.clamp(0.5 + 0.075 * earPx, 0.8, 2.3); ctx.lineJoin = 'round';
      ctx.stroke(B.ink);
      B.fill.flush(ctx, ORDER);
      B.awn.flush(ctx, ORDER);
    }
  }

  // ---------------------------------------------------------------- objects that stand in the field
  function objects() {
    const objs = [];
    const oak = SC.oak;
    const obx = SC.screenX(oak.X, oak.Z), oby = SC.groundY(oak.X, oak.Z);
    const os = f / oak.Z;
    objs.push({
      Z: oak.Z, box: [obx - 0.75 * 18.6 * os - 160, oby - 21 * os * 1.15 - 120, obx + 0.75 * 18.6 * os + 200, oby + 0.6 * os + 60],
      x: obx, k: 0.15, cool: 0.6, haloClip: SC.landTop(obx) - 6,
      halo: [[5, 0.46, P.sea], [13, 0.22, P.sea]],
      draw: (ctx) => {
        const s = f / oak.Z;
        const t = LW.makeTree('oak-long-night', { bx: obx, by: oby, H: 21 * s, spread: 18.6 * s, trunkW: 2.3 * s, clumpR: 1.5 * s, lean: 0.25, canopyDx: 0.6 * s, canopyY: 0.67, canopyRy: 0.32, trunkFrac: 0.36, roots: 7, limbs: 7, holes: 0.13 });
        LW.drawTree(ctx, t, { seed: 'oak', ink: 1.2, rimW: 2.0, fillCol: '#1a3945', backCol: '#142a35', masses: 16, backFrac: 0.22 });
        // grass and nettles at the foot
        const rng = new LW.RNG('oak-foot');
        const fb = new LW.FillBatch();
        for (let i = 0; i < 160; i++) {
          const x = obx + rng.range(-1, 1) * 4 * s, y = oby + rng.range(-0.2, 0.6) * 0.5 * s;
          const h = rng.range(0.2, 0.6) * s;
          const a = rng.range(-0.5, 0.5);
          LW.ribbon(fb.p(rng.next() < 0.25 ? P.sea : P.teal), [x, y, x + Math.sin(a) * h * 0.5, y - h * 0.5, x + Math.sin(a) * h, y - h], (tt) => 1.2 * (1 - tt));
        }
        fb.flush(ctx);
      },
    });
    // right-hand hedgerow
    const rng = new LW.RNG('hedge');
    for (let Z = 200; Z > 21; Z -= 1.1 + rng.next() * 0.9) {
      const X = SC.hedgeX(Z) + rng.range(-0.3, 0.3);
      const x = SC.screenX(X, Z), gy = SC.groundY(X, Z);
      if (x > SC.W + 160) continue;
      const s = f / Z;
      const zz = Z;
      const hh = 2.3 + 0.5 * LW.N1(Z * 0.08, 3);
      const r = 1.15 * s;
      objs.push({ Z: zz, x, cool: 0.4, box: [x - 2.2 * r - 30, gy - hh * s - 2.2 * r - 30, x + 2.2 * r + 30, gy + 14],
        draw: (ctx) => LW.drawHedgeClump(ctx, x, gy, r, hh * s, rng, { seed: 'h', ink: Math.min(1.5, 0.4 + s * 0.011), bump: 0.32, markScale: Math.min(1, 0.4 + s / 150), rimW: Math.min(2, 0.5 + s / 80) }) });
    }
    const hedgeTree = (Z, h, sp, seed) => {
      const X = SC.hedgeX(Z);
      const x = SC.screenX(X, Z), gy = SC.groundY(X, Z), s = f / Z;
      objs.push({ Z: Z + 0.5, x, cool: 0.5, box: [x - sp * s - 60, gy - h * s * 1.25 - 60, x + sp * s + 60, gy + 24],
        halo: [[4, 0.22, P.sea]], haloClip: SC.landTop(x) - 4,
        draw: (ctx) => {
        const t = LW.makeTree(seed, { bx: x, by: gy, H: h * s, spread: sp * s, trunkW: 0.8 * s, clumpR: 1.6 * s, lean: -0.1, roots: 2, limbs: 4, holes: 0.34, maxClumps: 70 });
        LW.drawTree(ctx, t, { seed, ink: 0.45 + 40 / Z, markScale: 0.8, rimW: 1.2 + 25 / Z });
      } });
    };
    hedgeTree(82, 13.5, 10, 'ash-a');
    hedgeTree(142, 11, 8, 'ash-b');
    hedgeTree(58, 9, 7, 'thorn');
    objs.push({ Z: SC.farHedgeZ, k: 0.3, cool: 0.3, box: [-40, 2120, SC.W + 40, 2345], draw: (ctx) => LW.drawFarHedge(ctx) });
    objs.sort((a, b) => b.Z - a.Z);
    return objs;
  }

  const PLATE = {};
  PLATE[P.cream] = P.straw; PLATE[P.straw] = P.amber; PLATE[P.amber] = P.orange; PLATE[P.orange] = P.rust;
  PLATE[P.rust] = '#5a2b25'; PLATE[P.sea] = '#24474f'; PLATE[P.teal] = '#1b3742'; PLATE['#204550'] = '#142a35';
  function fieldPlate(ctx) {
    const S = LW.S;
    const py0 = Math.floor((yh + 3) * S), py1 = ctx.canvas.height, w = ctx.canvas.width;
    const img = ctx.getImageData(0, py0, w, py1 - py0);
    const d = img.data;
    const cache = new Map();
    const rgb = (h) => { let c = cache.get(h); if (!c) { c = LW.hex(h); cache.set(h, c); } return c; };
    const hz = LW.depth.hazeData;
    for (let py = py0; py < py1; py++) {
      const y = (py + 0.5) / S;
      const Z = (f * (H - CANOPY)) / Math.max(0.5, y - yh);
      const kz = LW.depth.k(Z);
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / S;
        const X = SC.worldX(x, Z);
        const v = fieldLight(x, y, X, Z) + 0.05 * LW.N3(x * 0.03, y * 0.06) + 0.03 * LW.N4(x * 0.2, y * 0.2);
        const c = rgb(PLATE[RAMP[rampIdx(v)][1]]);
        const o = ((py - py0) * w + px) * 4, ho = (py * w + px) * 4;
        d[o] = c[0] + (hz[ho] - c[0]) * kz; d[o + 1] = c[1] + (hz[ho + 1] - c[1]) * kz; d[o + 2] = c[2] + (hz[ho + 2] - c[2]) * kz; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, py0);
  }

  // engraver's vignette: diagonal ink hatch thickening toward the frame edges and the bottom
  LW.drawEdgeShade = function (ctx) {
    const rng = new LW.RNG('edge-shade');
    const fb = new LW.FillBatch();
    const e = (x, y) => {
      const side = Math.max(LW.smooth(600, 0, x), LW.smooth(1560, 2160, x));
      const low = LW.smooth(3000, 3840, y) * 0.6;
      return Math.min(1, side * LW.smooth(yh + 120, yh + 700, y) + low * (0.4 + 0.6 * side));
    };
    const ang = -1.05, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let k = -4000; k < 4000; k += 5.5) {
      // line: p = o + s*(ca,sa), o on the perpendicular through (1080, 3000)
      const ox = 1080 - sa * k, oy = 3000 + ca * k;
      const pts = [];
      for (let s = -2600; s <= 2600; s += 6) {
        const x = ox + ca * s, y = oy + sa * s;
        if (x < -10 || x > SC.W + 10 || y < yh + 40 || y > SC.H + 10) continue;
        pts.push(x, y);
      }
      if (pts.length < 4) continue;
      let run = [];
      const flush = () => { if (run.length >= 4) LW.ribbon(fb.p('#081018'), run, (t, i, x, y) => Math.max(0, 2.3 * e(x, y) - 0.15) * LW.taper(t, 0.05, 0.05)); run = []; };
      for (let i = 0; i < pts.length; i += 2) { if (e(pts[i], pts[i + 1]) > 0.1 && rng.next() > 0.015) run.push(pts[i], pts[i + 1]); else flush(); }
      flush();
    }
    fb.flush(ctx);
  };

  LW.drawField = function (ctx) {
    // base (shadowed canopy) fill
    const base = [];
    for (let x = -20; x <= SC.W + 20; x += 8) base.push(x, SC.yh + 26);
    base.push(SC.W + 20, SC.H + 20, -20, SC.H + 20);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    fieldPlate(ctx);
    ctx.restore();
    // track continuing up the hill to the farmhouse
    const track = [];
    for (let t = 0; t <= 1; t += 0.05) {
      const x = 1030 + 32 * t + 6 * Math.sin(t * 5), y = 2316 - (2316 - (SC.ridgeNear(1062) + 9)) * t;
      track.push(x, y);
    }
    const tp = new Path2D(); LW.ribbon(tp, track, (t) => 1.6 - t);
    ctx.fillStyle = P.straw; ctx.fill(tp);
    const D = LW.depth;
    const kCanopy = (y) => D.k((f * (H - CANOPY)) / Math.max(0.3, y - yh));
    const kGround = (y) => D.k((f * H) / Math.max(0.3, y - yh));
    // the cart path, hazed by its own ground distance
    drawPath(D.begin());
    D.tintByY(kGround, yh - 10, 3300);
    D.commit(ctx, yh - 40, SC.H);
    const objs = objects();
    const rng = new LW.RNG('rows');
    // rows accumulate in the layer; before anything that stands in the field is drawn they are hazed
    // strip by strip (their y gives their distance) and moved onto the page
    let ry0 = 1e9, ry1 = -1e9;
    const flushRows = () => {
      if (ry1 < ry0) return;
      D.tintByY(kCanopy, ry0, Math.min(ry1, 3300));
      D.commit(ctx, ry0, ry1);
      ry0 = 1e9; ry1 = -1e9;
    };
    const drawObj = (o) => {
      flushRows();
      const [x0, y0, x1, y1] = o.box;
      const c = D.begin();
      c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
      o.draw(c);
      c.restore();
      D.tint(o.k !== undefined ? o.k : D.k(o.Z), y0, y1, x0, x1, D.airAt(o.x !== undefined ? o.x : (x0 + x1) / 2, o.cool || 0));
      if (o.halo) D.halo(ctx, o.halo, o.haloClip || yh, o.box);
      D.commit(ctx, y0, y1, x0, x1);
    };
    let Z = 232, oi = 0, rows = 0;
    while (Z > 2.25) {
      while (oi < objs.length && objs[oi].Z >= Z) { drawObj(objs[oi]); oi++; }
      const earPx = (0.085 * f) / Z;
      const dy = Math.max(1.05, earPx * 0.34);
      const dZ = (dy * Z * Z) / (f * (H - CANOPY));
      drawRow(D.begin(), Z, dZ, rng);
      ry0 = Math.min(ry0, yh + (f * (H - 3.1)) / Z - 3.2 * earPx - 30);
      ry1 = Math.max(ry1, yh + (f * (H + 1.9)) / Z + 40);
      Z -= dZ; rows++;
    }
    flushRows();
    while (oi < objs.length) { drawObj(objs[oi]); oi++; }
    LW.log('field rows: ' + rows);
  };
})();
