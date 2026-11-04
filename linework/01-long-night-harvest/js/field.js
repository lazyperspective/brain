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
    const pud = new LW.FillBatch(), rip = new LW.FillBatch(), glint = new LW.FillBatch(), pudInk = new LW.FillBatch();
    for (const side of [-1, 1]) {
      let i = 0;
      const pn = (Z) => LW.N4(Z * 0.16 + side * 11, 0.5 + side) + 0.22 * Math.exp(-(((Z - 28) / 22) ** 2)) - 0.1 * LW.smooth(70, 130, Z);
      while (i < Zs.length) {
        const Z = Zs[i];
        if (pn(Z) > 0.42 && Z < 170) {
          let j = i;
          while (j < Zs.length && pn(Zs[j]) > 0.42) j++;
          if (j - i > 3) {
            const pl = [], pr = [];
            for (let k = i; k < j; k++) {
              const Zk = Zs[k];
              const t = (k - i) / (j - i - 1);
              const bulge = Math.pow(Math.sin(Math.PI * t), 0.55) * (1 + 0.25 * LW.N3(Zk * 2, side));
              const c = rutC(Zk, side);
              const hw = 0.1 * bulge + 0.004;
              const y = SC.groundY(c, Zk);
              pl.push(SC.screenX(c - hw, Zk), y); pr.push(SC.screenX(c + hw * 1.15, Zk), y);
            }
            const poly2 = pl.slice();
            for (let k = pr.length - 2; k >= 0; k -= 2) poly2.push(pr[k], pr[k + 1]);
            const wp = LW.wobble(poly2, 1.2, 0.06, i + side, true);
            const mx = pl[(pl.length >> 2) * 2], my = pl[(pl.length >> 2) * 2 + 1];
            const g = SC.glow(mx, yh - 40 - (my - yh) * 0.18);
            const ci = Math.min(4, (g > 0.95 ? 0 : g > 0.7 ? 1 : g > 0.5 ? 2 : g > 0.36 ? 3 : 4) + (my > 2700 ? 1 : 0));
            const col = [P.cream, P.straw, P.amber, P.orange, P.sea][ci];
            const rcol = [P.amber, P.orange, P.rust, P.ember, P.deep][ci];
            LW.polyPath(pud.p('#0d171f'), wp, true);
            LW.dashes(wp.concat(wp.slice(0, 4)), rng, 20, 120, 3, 12, (sub) => LW.ribbon(pudInk.p(P.ink), sub, (t, k, x, y) => (0.45 + 0.9 * LW.smooth(yh, 3600, y)) * LW.taper(t, 0.2, 0.2)));
            // engraved ripples: horizontal hatch, denser toward the far edge
            const y0 = Math.min(pl[1], pl[pl.length - 1]), y1 = Math.max(pl[1], pl[pl.length - 1]);
            const hgt = y1 - y0;
            const step = Math.max(1.6, hgt / 16);
            for (let yy = y0 + step * 0.4; yy < y1; yy += step * rng.range(0.8, 1.2)) {
              let k = 0;
              while (k < pl.length - 2 && pl[k + 1] < yy) k += 2;
              const xa = Math.min(pl[k], pr[k]), xb = Math.max(pl[k], pr[k]);
              if (xb - xa < 2.5) continue;
              let xx = xa + rng.range(0.02, 0.12) * (xb - xa);
              while (xx < xb) {
                const ww = (xb - xa) * rng.range(0.45, 1.0);
                const x2 = Math.min(xb - 0.5, xx + ww);
                if (x2 - xx > 1.5) LW.ribbon(rip.p(rng.next() < 0.75 ? col : rcol), [xx, yy, (xx + x2) / 2, yy + 0.3, x2, yy], (t) => Math.min(step * 0.42, 0.5 + 1.1 * LW.smooth(yh, 3600, yy)) * LW.taper(t, 0.3, 0.3));
                xx = x2 + (xb - xa) * rng.range(0.05, 0.25);
              }
              if (rng.next() < 0.18) {
                const gx = xa + rng.range(0.1, 0.8) * (xb - xa);
                LW.ribbon(glint.p('#fff6dc'), [gx, yy - step * 0.5, gx + (xb - xa) * 0.12, yy - step * 0.5], (t) => 0.6 * LW.taper(t, 0.3, 0.3));
              }
            }
          }
          i = j + 1;
        } else i++;
      }
    }
    LW.offset(ctx, LW.REG.warm, () => pud.flush(ctx));
    rip.flush(ctx);
    glint.flush(ctx);
    pudInk.flush(ctx);
    // walls of stalks either side of the slot, far to near
    const wall = new LW.FillBatch();
    for (let i = 0; i < Zs.length - 1; i++) {
      const Za = Zs[i], Zb = Zs[i + 1];
      for (const side of [-1, 1]) {
        const Xa = SC.pathX(Za) + side * (SC.pathHalf(Za) + 0.03), Xb = SC.pathX(Zb) + side * (SC.pathHalf(Zb) + 0.03);
        const xa = SC.screenX(Xa, Za), xb = SC.screenX(Xb, Zb);
        const ga = SC.groundY(Xa, Za), gb = SC.groundY(Xb, Zb);
        const ca = ga - (f * 0.8) / Za, cb = gb - (f * 0.8) / Zb;
        const q = wall.p(Za > 60 ? '#1a2f3a' : Za > 9 ? '#15262f' : '#101d26');
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
      nextStep = nearPath ? 0.6 : 1;
      if (inPath(X, Zi, 0.02)) continue;
      if (inTram(X, Zi)) continue;
      const g = SC.terrain(X, Zi);
      const pasture = beyondHedge(X, Zi);
      const c = pasture ? 0.25 : CANOPY + 0.09 * LW.N3(X * 0.25, Zi * 0.25) + rng.range(-0.04, 0.04);
      const yb = yh + (f * (H - g - c)) / Zi;
      if (yb > 3920 + earPx) continue;
      const lean = 0.22 * LW.N1(X * 0.04 + Zi * 0.02, Zi * 0.04) + 0.1 * rng.normal() + 0.08;
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
        const col = ri <= 1 && rng.next() < 0.5 ? (rng.next() < 0.6 ? P.orange : P.rust) : RAMP[Math.max(1, ri)][1];
        const w = Math.max(0.5, earPx * 0.13);
        LW.ribbon(B.tick.p(col), [x, yb, x + Math.sin(lean) * h * 0.5, yb - h * 0.5, x + Math.sin(lean * 1.2) * h, yb - h], (t) => w * LW.taper(t, 0.3, 0.25));
        if (earPx > 2.5 && rng.next() < 0.5) {
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
        LW.ribbon(B.stem.p(nearPath ? (rng.next() < 0.35 ? (v > 0.55 ? P.rust : P.teal) : '#24434e') : v > 0.45 ? '#2a3f45' : '#132530'), [x, yb, x - ax * sl * 0.5 + rng.range(-1, 1), yb + sl * 0.5, x - ax * sl * 0.2, yb + sl], (t) => Math.max(0.35, w * 0.3));
        // spindle
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.25) { const ww = Math.sin(Math.PI * Math.pow(t, 0.8)) * w; pts.push(x + ax * h * t - ay * ww, yb + ay * h * t + ax * ww); }
        for (let t = 0.75; t > 0.0001; t -= 0.25) { const ww = Math.sin(Math.PI * Math.pow(t, 0.8)) * w; pts.push(x + ax * h * t + ay * ww, yb + ay * h * t - ax * ww); }
        LW.polyPath(B.ink, pts, true);
        LW.polyPath(B.fill.p(col), pts, true);
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
        const ink = nearPath ? (v > 0.42 ? P.sea : P.teal) : v > 0.45 ? '#33474b' : '#122430';
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
      ctx.strokeStyle = P.ink; ctx.lineWidth = lod === 2 ? 1.6 : 1.1; ctx.lineJoin = 'round';
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
    objs.push({
      Z: oak.Z, draw: (ctx) => {
        const s = f / oak.Z;
        const t = LW.makeTree('oak-long-night', { bx: obx, by: oby, H: 21 * s, spread: 18.6 * s, trunkW: 2.3 * s, clumpR: 1.5 * s, lean: 0.25, canopyDx: 0.6 * s, canopyY: 0.67, canopyRy: 0.32, trunkFrac: 0.36, roots: 7, limbs: 7, holes: 0.13 });
        LW.drawTree(ctx, t, { seed: 'oak', ink: 1.5, rimW: 2.2, fillCol: '#1a3945', backCol: '#142a35', masses: 16, backFrac: 0.22 });
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
      objs.push({ Z: zz, draw: (ctx) => LW.drawHedgeClump(ctx, x, gy, 1.15 * s, hh * s, rng, { seed: 'h', ink: Math.min(1.6, 0.6 + s * 0.012), bump: 0.32, markScale: Math.min(1, 0.4 + s / 150), rimW: Math.min(2, 0.6 + s / 80) }) });
    }
    const hedgeTree = (Z, h, sp, seed) => {
      const X = SC.hedgeX(Z);
      const x = SC.screenX(X, Z), gy = SC.groundY(X, Z), s = f / Z;
      objs.push({ Z: Z + 0.5, draw: (ctx) => {
        const t = LW.makeTree(seed, { bx: x, by: gy, H: h * s, spread: sp * s, trunkW: 0.8 * s, clumpR: 1.6 * s, lean: -0.1, roots: 2, limbs: 4, holes: 0.34, maxClumps: 70 });
        LW.drawTree(ctx, t, { seed, ink: 1.2, markScale: 0.8, rimW: 1.6 });
      } });
    };
    hedgeTree(82, 13.5, 10, 'ash-a');
    hedgeTree(142, 11, 8, 'ash-b');
    hedgeTree(58, 9, 7, 'thorn');
    objs.push({ Z: SC.farHedgeZ, draw: (ctx) => LW.drawFarHedge(ctx) });
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
    for (let py = py0; py < py1; py++) {
      const y = (py + 0.5) / S;
      const Z = (f * (H - CANOPY)) / Math.max(0.5, y - yh);
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / S;
        const X = SC.worldX(x, Z);
        const v = fieldLight(x, y, X, Z) + 0.05 * LW.N3(x * 0.03, y * 0.06) + 0.03 * LW.N4(x * 0.2, y * 0.2);
        const c = rgb(PLATE[RAMP[rampIdx(v)][1]]);
        const o = ((py - py0) * w + px) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, py0);
  }

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
    drawPath(ctx);
    const objs = objects();
    const rng = new LW.RNG('rows');
    let Z = 232, oi = 0, rows = 0;
    while (Z > 2.25) {
      while (oi < objs.length && objs[oi].Z >= Z) { objs[oi].draw(ctx); oi++; }
      const earPx = (0.085 * f) / Z;
      const dy = Math.max(1.05, earPx * 0.34);
      const dZ = (dy * Z * Z) / (f * (H - CANOPY));
      drawRow(ctx, Z, dZ, rng);
      Z -= dZ; rows++;
    }
    while (oi < objs.length) { objs[oi].draw(ctx); oi++; }
    LW.log('field rows: ' + rows);
  };
})();
