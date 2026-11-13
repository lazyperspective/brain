// engine.js -- a small dry-media simulator. Pure JavaScript, no canvas API, no libraries.
// A sheet of toothed, toned paper (a height field) receives pigment from sticks and pencils:
// the pigment catches on the peaks of the tooth first and only reaches the valleys under
// pressure, by layering, or when it is rubbed in with a finger.
(function (G) {
  'use strict';
  const A = (G.ART = G.ART || {});

  // ---------------------------------------------------------------- random / noise
  A.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.r = (lo, hi) => lo + (hi - lo) * f();
    f.i = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.g = () => (f() + f() + f() + f() - 2) * 1.732;
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.fork = () => A.rng(Math.floor(f() * 4294967296));
    return f;
  };
  function ih(x, y, s) {
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  A.ih = ih;
  A.vn = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  A.fbm = function (x, y, oct, s) {
    let v = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < oct; o++) { v += amp * A.vn(x, y, s + o * 17); tot += amp; x = x * 2.03 + 11.7; y = y * 2.03 + 5.3; amp *= 0.5; }
    return v / tot;
  };
  const clamp = A.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  A.mix = (a, b, t) => a + (b - a) * t;
  A.ss = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  A.mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---------------------------------------------------------------- colour
  A.hex = function (s) {
    const n = parseInt(s.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  A.lab = function (c) {
    const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  // a box of sticks: you can only draw with the colours you own
  A.Sticks = function (hexes) {
    this.c = hexes.map(A.hex);
    this.l = this.c.map(A.lab);
  };
  A.Sticks.prototype.near = function (col, rng, spread) {
    const L = A.lab(col), l = this.l;
    let b0 = -1, d0 = 1e9, b1 = -1, d1 = 1e9, b2 = -1, d2 = 1e9;
    for (let i = 0; i < l.length; i++) {
      const dl = (l[i][0] - L[0]) * 1.0, da = l[i][1] - L[1], db = l[i][2] - L[2];
      const d = dl * dl + da * da + db * db;
      if (d < d0) { b2 = b1; d2 = d1; b1 = b0; d1 = d0; b0 = i; d0 = d; }
      else if (d < d1) { b2 = b1; d2 = d1; b1 = i; d1 = d; }
      else if (d < d2) { b2 = i; d2 = d; }
    }
    if (!rng || !spread) return this.c[b0];
    const k = 1 / (spread * spread);
    const w0 = 1, w1 = Math.exp(-(d1 - d0) * k), w2 = Math.exp(-(d2 - d0) * k) * 0.6;
    const u = rng() * (w0 + w1 + w2);
    return this.c[u < w0 ? b0 : u < w0 + w1 ? b1 : b2];
  };

  // ---------------------------------------------------------------- the sheet
  const TS = 32;
  A.Canvas = function (W, H, paperHex, seed) {
    this.W = W; this.H = H; this.S = W / 1600;
    const N = W * H;
    this.pig = new Float32Array(N * 4);   // premultiplied pigment r,g,b + coverage
    this.tooth = new Float32Array(N);     // paper height 0..1
    this.mask = new Float32Array(N);      // scratch: pressure of the stroke in progress
    this.thk = new Float32Array(N);       // waxy build-up (for a little relief)
    this.tw = Math.ceil(W / TS); this.th = Math.ceil(H / TS);
    this.tflag = new Uint8Array(this.tw * this.th);
    this.tlist = new Int32Array(this.tw * this.th);
    this.tn = 0;
    this.paper = A.hex(paperHex);
    this.seed = seed | 0;
    this._st = new Float32Array(32);
    this._rs = A.rng(seed ^ 0x5bd1e995);
    this.count = 0;
    this.makePaper();
  };
  const P = A.Canvas.prototype;

  P.makePaper = function () {
    const W = this.W, H = this.H, S = this.S, t = this.tooth, sd = this.seed;
    const k = 2 * Math.PI / 2.3;
    for (let y = 0; y < H; y++) {
      const v = y / S;
      for (let x = 0; x < W; x++) {
        const u = x / S;
        let n = 0.40 * A.vn(u / 0.95, v / 0.95, sd) + 0.34 * A.vn(u / 2.3, v / 2.3, sd + 7) + 0.26 * A.vn(u / 6.5, v / 6.5, sd + 13);
        // the faint regular "screen" of pastel paper
        const m = (Math.cos(k * u) + Math.cos(k * (0.5 * u + 0.866 * v)) + Math.cos(k * (0.5 * u - 0.866 * v))) / 3;
        n = (n - 0.5) * 1.75 + 0.5 + 0.075 * m;
        t[y * W + x] = n < 0 ? 0 : n > 1 ? 1 : n;
      }
    }
  };

  // A stroke. pts = flat [x, y, pressure, widthScale, ...] in design units (1600 x 900).
  P.stroke = function (pts, med, col, wdu, press) {
    const S = this.S, W = this.W, H = this.H, mask = this.mask;
    const n = (pts.length / 4) | 0;
    if (n < 1) return;
    this.count++;
    const K = 24, st = this._st, rs = this._rs;
    if (med.stri > 0) {
      for (let k = 0; k < K; k++) { let v = 1 - med.stri * rs(); if (rs() < med.gap) v *= 0.3; st[k] = v; }
      let prev = st[0];
      for (let k = 0; k < K - 1; k++) { const cur = st[k]; st[k] = 0.25 * prev + 0.5 * cur + 0.25 * st[k + 1]; prev = cur; }
    } else for (let k = 0; k < K; k++) st[k] = 1;
    const edge = med.edge, round = med.round, tw = this.tw, tflag = this.tflag, tlist = this.tlist;
    const hw = 0.5 * wdu * S;
    const segs = n === 1 ? 1 : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = i * 4, b = (n === 1 ? i : i + 1) * 4;
      const ax = pts[a] * S, ay = pts[a + 1] * S, bx = pts[b] * S, by = pts[b + 1] * S;
      let ra = hw * pts[a + 3], rb = hw * pts[b + 3];
      if (ra < 0.4) ra = 0.4; if (rb < 0.4) rb = 0.4;
      const pa = press * pts[a + 2], pb = press * pts[b + 2];
      const rm = (ra > rb ? ra : rb) + 1;
      let x0 = Math.floor(Math.min(ax, bx) - rm), x1 = Math.ceil(Math.max(ax, bx) + rm);
      let y0 = Math.floor(Math.min(ay, by) - rm), y1 = Math.ceil(Math.max(ay, by) + rm);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
      if (x0 > x1 || y0 > y1) continue;
      const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
      const iL2 = L2 > 1e-9 ? 1 / L2 : 0, iL = Math.sqrt(iL2);
      for (let py = y0; py <= y1; py++) {
        const dy = py + 0.5 - ay, row = py * W;
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - ax;
          let t = (dx * ex + dy * ey) * iL2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = dx - ex * t, cy = dy - ey * t, d2 = cx * cx + cy * cy;
          const r = ra + (rb - ra) * t;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          let e = (r - d) / (edge * r + 0.7); if (e > 1) e = 1;
          let s = (dx * ey - dy * ex) * iL / r; s = s < -1 ? -1 : s > 1 ? 1 : s;
          let p = (pa + (pb - pa) * t) * e * st[((s * 0.5 + 0.5) * (K - 1) + 0.5) | 0];
          if (round > 0) p *= 1 - round + round * Math.sqrt(1 - d2 / (r * r));
          const idx = row + px;
          if (p > mask[idx]) mask[idx] = p;
        }
      }
      const tx0 = x0 >> 5, tx1 = x1 >> 5, ty0 = y0 >> 5, ty1 = y1 >> 5;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const ti = ty * tw + tx;
        if (!tflag[ti]) { tflag[ti] = 1; tlist[this.tn++] = ti; }
      }
    }
    // pick-up: a waxy stick drags a little of what it crosses along with it
    let cr = col[0], cg = col[1], cb = col[2];
    if (med.pick > 0) {
      const mi = ((n >> 1) * 4), sx = clamp(Math.round(pts[mi] * S), 0, W - 1), sy = clamp(Math.round(pts[mi + 1] * S), 0, H - 1);
      const j = (sy * W + sx) * 4, a0 = this.pig[j + 3];
      if (a0 > 0.25) { const k = med.pick * a0; cr += (this.pig[j] / a0 - cr) * k; cg += (this.pig[j + 1] / a0 - cg) * k; cb += (this.pig[j + 2] / a0 - cb) * k; }
    }
    this._deposit(med, cr, cg, cb);
  };

  P._deposit = function (med, cr, cg, cb) {
    const W = this.W, H = this.H, mask = this.mask, tooth = this.tooth, pig = this.pig, thk = this.thk;
    const tw = this.tw, tflag = this.tflag, tlist = this.tlist;
    const rough = med.rough, soft = med.soft, opac = med.opac, fill = med.fill, mul = med.mul || 0, speck = med.speck, body = med.body;
    const i2s = 1 / (2 * soft), sd = this.count;
    const pr = this.paper[0], pg = this.paper[1], pb = this.paper[2];
    for (let q = 0; q < this.tn; q++) {
      const ti = tlist[q]; tflag[ti] = 0;
      const tx = ti % tw, ty = (ti / tw) | 0;
      const x0 = tx * TS, y0 = ty * TS, x1 = Math.min(W, x0 + TS), y1 = Math.min(H, y0 + TS);
      for (let y = y0; y < y1; y++) {
        let i = y * W + x0;
        for (let x = x0; x < x1; x++, i++) {
          const m = mask[i];
          if (m <= 0) continue;
          mask[i] = 0;
          const j = i * 4, A0 = pig[j + 3];
          const pe = m * (1 + fill * A0);
          const thr = (1 - tooth[i]) * rough + (ih(x, y, sd) - 0.5) * speck;
          let a = (pe - thr + soft) * i2s;
          if (a <= 0) continue;
          a = a >= 1 ? opac : a * a * (3 - 2 * a) * opac;
          if (a < 0.004) continue;
          let sr = cr, sg = cg, sb = cb;
          if (mul > 0) {
            const ur = pr * (1 - A0) + pig[j], ug = pg * (1 - A0) + pig[j + 1], ub = pb * (1 - A0) + pig[j + 2];
            sr = cr * (1 - mul) + cr * (0.25 + ur) * mul; sg = cg * (1 - mul) + cg * (0.25 + ug) * mul; sb = cb * (1 - mul) + cb * (0.25 + ub) * mul;
          }
          const ia = 1 - a;
          pig[j] = pig[j] * ia + sr * a; pig[j + 1] = pig[j + 1] * ia + sg * a; pig[j + 2] = pig[j + 2] * ia + sb * a;
          pig[j + 3] = A0 + (1 - A0) * a;
          thk[i] = thk[i] * (1 - 0.5 * a) + a * body;
        }
      }
    }
    this.tn = 0;
  };

  // Rub with a fingertip / paper stump along a path: pigment is carried, mixed and pushed into the tooth.
  // pts = flat [x, y, ...] in design units.
  P.rub = function (pts, rdu, strength, carry) {
    const S = this.S, W = this.W, H = this.H, pig = this.pig, tooth = this.tooth, thk = this.thk;
    const r = rdu * S, n = pts.length >> 1;
    const stride = Math.max(1, Math.floor(r / 9));
    let kr = 0, kg = 0, kb = 0, ka = 0, have = false;
    carry = carry === undefined ? 0.55 : carry;
    let lastx = -1e9, lasty = -1e9;
    for (let i = 0; i < n; i++) {
      const cx = pts[i * 2] * S, cy = pts[i * 2 + 1] * S;
      if (Math.hypot(cx - lastx, cy - lasty) < r * 0.3 && i < n - 1) continue;
      lastx = cx; lasty = cy;
      let x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
      if (x0 > x1 || y0 > y1) continue;
      let sr = 0, sg = 0, sb = 0, sa = 0, sw = 0;
      const r2 = r * r;
      for (let y = y0; y <= y1; y += stride) for (let x = x0; x <= x1; x += stride) {
        const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r2) continue;
        const j = (y * W + x) * 4; sr += pig[j]; sg += pig[j + 1]; sb += pig[j + 2]; sa += pig[j + 3]; sw++;
      }
      if (!sw) continue;
      sr /= sw; sg /= sw; sb /= sw; sa /= sw;
      if (!have) { kr = sr; kg = sg; kb = sb; ka = sa; have = true; }
      else { kr += (sr - kr) * (1 - carry); kg += (sg - kg) * (1 - carry); kb += (sb - kb) * (1 - carry); ka += (sa - ka) * (1 - carry); }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, d2 = (dx * dx + dy * dy) / r2; if (d2 >= 1) continue;
        const i2 = y * W + x, j = i2 * 4;
        let f = 1 - d2; f = f * Math.sqrt(f) * strength * (0.62 + 0.38 * tooth[i2]);
        pig[j] += (kr - pig[j]) * f; pig[j + 1] += (kg - pig[j + 1]) * f; pig[j + 2] += (kb - pig[j + 2]) * f; pig[j + 3] += (ka - pig[j + 3]) * f;
        thk[i2] *= 1 - 0.6 * f;
      }
    }
  };

  // Final: look at the sheet under a raking light. Returns RGB bytes.
  P.finish = function () {
    const W = this.W, H = this.H, pig = this.pig, tooth = this.tooth, thk = this.thk, S = this.S;
    const out = new Uint8Array(W * H * 3);
    const pr = this.paper[0], pg = this.paper[1], pb = this.paper[2], sd = this.seed;
    for (let y = 0; y < H; y++) {
      const ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y;
      for (let x = 0; x < W; x++) {
        const xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x;
        const i = y * W + x, j = i * 4, a = pig[j + 3];
        // paper: a little mottled, a few fibres
        const u = x / S, v = y / S;
        const mott = (A.vn(u / 90, v / 90, sd + 31) - 0.5) * 0.10 + (A.vn(u / 17, v / 17, sd + 37) - 0.5) * 0.05;
        const fib = A.vn(u / 0.8, v / 14, sd + 41) > 0.93 ? 0.05 : 0;
        const pm = 1 + mott + fib + (tooth[i] - 0.5) * 0.16;
        let r = pr * pm * (1 - a) + pig[j], g = pg * pm * (1 - a) + pig[j + 1], b = pb * pm * (1 - a) + pig[j + 2];
        // relief from tooth + wax
        const kT = 0.10, kB = 0.17;
        const hl = tooth[y * W + xm] * kT + thk[y * W + xm] * kB, hr = tooth[y * W + xp] * kT + thk[y * W + xp] * kB;
        const hu = tooth[ym * W + x] * kT + thk[ym * W + x] * kB, hd = tooth[yp * W + x] * kT + thk[yp * W + x] * kB;
        let sh = 1 + ((hr - hl) * -0.55 + (hd - hu) * -0.75) * (0.35 + 0.65 * a);
        sh *= 1 + (ih(x, y, sd + 99) - 0.5) * 0.035;
        r *= sh; g *= sh; b *= sh;
        const o = i * 3;
        out[o] = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0;
        out[o + 1] = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0;
        out[o + 2] = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0;
      }
    }
    return out;
  };

  // ---------------------------------------------------------------- the tools
  // rough: how much the tooth resists; soft: softness of that threshold; opac: covering power;
  // fill: how much earlier layers help later ones reach the valleys; stri/gap: streaks from the
  // uneven face of the stick; round: point (1) or flat face (0); body: waxy thickness.
  A.MED = {
    pastel:    { rough: 1.00, soft: 0.22, opac: 0.95, fill: 0.22, stri: 0.55, gap: 0.10, edge: 0.55, round: 0.0, speck: 0.26, body: 0.03, pick: 0.0 },
    pastelTip: { rough: 0.92, soft: 0.22, opac: 0.95, fill: 0.22, stri: 0.30, gap: 0.04, edge: 0.50, round: 0.35, speck: 0.24, body: 0.04, pick: 0.0 },
    oil:       { rough: 0.72, soft: 0.18, opac: 0.97, fill: 0.50, stri: 0.35, gap: 0.05, edge: 0.30, round: 0.25, speck: 0.12, body: 0.60, pick: 0.16 },
    pencil:    { rough: 1.05, soft: 0.30, opac: 0.72, fill: 0.25, stri: 0.0, gap: 0, edge: 0.45, round: 0.85, speck: 0.30, body: 0.04, pick: 0.0, mul: 0.0 },
    conte:     { rough: 0.95, soft: 0.20, opac: 0.92, fill: 0.25, stri: 0.45, gap: 0.08, edge: 0.40, round: 0.15, speck: 0.26, body: 0.03, pick: 0.0 },
  };

  // ---------------------------------------------------------------- the hand
  // Turn a polyline (flat [x,y,...]) into a hand-drawn path: resampled, wobbling, with pressure that
  // swells and fades. Returns flat [x,y,p,w,...].
  A.hand = function (rng, xy, o) {
    o = o || {};
    const step = o.step || 5, wob = o.wob === undefined ? 0.7 : o.wob, wl = o.wl || 55;
    const t0 = o.t0 === undefined ? 0.14 : o.t0, t1 = o.t1 === undefined ? 0.18 : o.t1;
    const pj = o.pj === undefined ? 0.22 : o.pj, wj = o.wj === undefined ? 0.12 : o.wj;
    const pe = o.pe === undefined ? 0.35 : o.pe; // pressure at the very ends
    const n = xy.length >> 1;
    const s1 = Math.floor(rng() * 1e6), ph = rng() * 1000;
    let tot = 0;
    for (let i = 1; i < n; i++) tot += Math.hypot(xy[i * 2] - xy[i * 2 - 2], xy[i * 2 + 1] - xy[i * 2 - 1]);
    const out = [];
    if (tot < 1e-6) { out.push(xy[0], xy[1], 1, 1); return out; }
    const m = Math.max(2, Math.ceil(tot / step) + 1);
    let seg = 1, acc = 0, sl = Math.hypot(xy[2] - xy[0], xy[3] - xy[1]);
    for (let k = 0; k < m; k++) {
      const s = tot * k / (m - 1);
      while (seg < n - 1 && s > acc + sl) { acc += sl; seg++; sl = Math.hypot(xy[seg * 2] - xy[seg * 2 - 2], xy[seg * 2 + 1] - xy[seg * 2 - 1]); }
      const f = sl > 1e-9 ? clamp((s - acc) / sl, 0, 1) : 0;
      const ax = xy[seg * 2 - 2], ay = xy[seg * 2 - 1], bx = xy[seg * 2], by = xy[seg * 2 + 1];
      let x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
      const nx = -(by - ay) / (sl || 1), ny = (bx - ax) / (sl || 1);
      const w = wob * ((A.vn(s / wl + ph, 3.1, s1) - 0.5) * 2 + (A.vn(s / (wl * 0.22) + ph, 7.7, s1) - 0.5) * 0.7);
      x += nx * w; y += ny * w;
      const u = k / (m - 1);
      let env = 1;
      if (u < t0) env = pe + (1 - pe) * (u / t0); else if (u > 1 - t1) env = pe + (1 - pe) * ((1 - u) / t1);
      const p = env * (1 + pj * (A.vn(s / 23 + ph, 1.3, s1) - 0.5) * 2);
      const ww = (0.75 + 0.25 * env) * (1 + wj * (A.vn(s / 31 + ph, 5.9, s1) - 0.5) * 2);
      out.push(x, y, p, ww);
    }
    return out;
  };

  // Catmull-Rom through control points -> dense polyline
  A.curve = function (xy, per) {
    const n = xy.length >> 1, out = [];
    per = per || 12;
    const P = i => { i = i < 0 ? 0 : i > n - 1 ? n - 1 : i; return [xy[i * 2], xy[i * 2 + 1]]; };
    for (let i = 0; i < n - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push(0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3));
      }
    }
    out.push(xy[n * 2 - 2], xy[n * 2 - 1]);
    return out;
  };

  // A drawn line (optionally gone over twice, the way a hand restates a line)
  A.line = function (C, rng, xy, med, col, w, p, o) {
    o = o || {};
    const reps = o.reps || 1;
    for (let k = 0; k < reps; k++) {
      const pts = A.hand(rng, xy, o);
      if (k > 0) { const ox = rng.g() * (o.off || 0.5), oy = rng.g() * (o.off || 0.5); for (let i = 0; i < pts.length; i += 4) { pts[i] += ox; pts[i + 1] += oy; } }
      C.stroke(pts, med, col, w, p * (k > 0 ? 0.75 : 1));
    }
  };

  // Hatch a polygon (flat [x,y,...]) with parallel strokes. col may be a function (x,y)->rgb.
  A.hatch = function (C, rng, poly, o) {
    const ang = o.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang);
    const n = poly.length >> 1;
    let vmin = 1e9, vmax = -1e9;
    const U = new Array(n), V = new Array(n);
    for (let i = 0; i < n; i++) { const x = poly[i * 2], y = poly[i * 2 + 1]; U[i] = x * ca + y * sa; V[i] = -x * sa + y * ca; if (V[i] < vmin) vmin = V[i]; if (V[i] > vmax) vmax = V[i]; }
    const gap = o.gap || 3, over = o.over === undefined ? 1.2 : o.over, skip = o.skip || 0;
    let flip = false;
    const hopt = { step: o.step || 6, wob: o.wob === undefined ? 0.5 : o.wob, wl: o.wl || 50, t0: o.t0, t1: o.t1, pj: o.pj, pe: o.pe };
    for (let v = vmin + gap * rng(); v < vmax; v += gap * (0.72 + 0.56 * rng())) {
      const xs = [];
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n, v0 = V[i], v1 = V[k];
        if ((v0 <= v && v1 > v) || (v1 <= v && v0 > v)) xs.push(U[i] + (U[k] - U[i]) * (v - v0) / (v1 - v0));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        if (rng() < skip) continue;
        let u0 = xs[q] - Math.abs(rng.g()) * over * (rng() < 0.25 ? -0.8 : 1), u1 = xs[q + 1] + Math.abs(rng.g()) * over * (rng() < 0.25 ? -0.8 : 1);
        if (u1 - u0 < 0.6) continue;
        if (flip) { const t = u0; u0 = u1; u1 = t; }
        flip = !flip;
        const vv = v + rng.g() * gap * 0.12, tilt = rng.g() * 0.02 * (u1 - u0);
        const x0 = u0 * ca - (vv - tilt) * sa, y0 = u0 * sa + (vv - tilt) * ca, x1 = u1 * ca - (vv + tilt) * sa, y1 = u1 * sa + (vv + tilt) * ca;
        let c = o.col;
        if (typeof c === 'function') c = c((x0 + x1) / 2, (y0 + y1) / 2, rng);
        if (!c) continue;
        const w = (o.w || 1.4) * (0.85 + 0.3 * rng()), p = (o.p || 0.6) * (0.8 + 0.4 * rng());
        C.stroke(A.hand(rng, [x0, y0, x1, y1], hopt), o.med, c, w, p);
      }
    }
  };

  // Strokes scattered over a region, each following a direction field; the colour of each stroke is
  // the nearest stick to what the eye wants at that spot.
  A.field = function (C, rng, o) {
    const [bx0, by0, bx1, by1] = o.box, sp = o.sp;
    const pts = [];
    for (let y = by0; y < by1; y += sp) for (let x = bx0; x < bx1; x += sp) pts.push([x + (rng() - 0.5) * sp * 1.2, y + (rng() - 0.5) * sp * 1.2, rng()]);
    if (o.order === 'scan') pts.sort((a, b) => (a[1] + a[2] * sp * 3) - (b[1] + b[2] * sp * 3));
    else pts.sort((a, b) => a[2] - b[2]);
    const stepL = o.stepL || 5, hopt = { step: o.step || 6, wob: o.wob === undefined ? 0.8 : o.wob, wl: o.wl || 45, pj: o.pj, t0: o.t0, t1: o.t1, pe: o.pe };
    for (let q = 0; q < pts.length; q++) {
      const x = pts[q][0], y = pts[q][1];
      if (o.begin) o.begin(x, y);
      if (o.mask && !(o.mask(x, y) > 0.5)) continue;
      if (o.prob && rng() > o.prob(x, y)) continue;
      let col = o.col(x, y, rng);
      if (!col) continue;
      if (o.sticks) col = o.sticks.near(col, rng, o.spread === undefined ? 0.05 : o.spread);
      const len = o.len[0] + (o.len[1] - o.len[0]) * rng();
      let a0 = o.dir(x, y) + rng.g() * (o.dj === undefined ? 0.12 : o.dj);
      const fw = [], bw = [];
      for (let side = 0; side < 2; side++) {
        let cx = x, cy = y, a = a0 + (side ? Math.PI : 0);
        const arr = side ? bw : fw;
        const ns = Math.max(1, Math.round(len * 0.5 / stepL));
        for (let k = 0; k < ns; k++) {
          cx += Math.cos(a) * stepL; cy += Math.sin(a) * stepL;
          if (o.clip && o.mask && !(o.mask(cx, cy) > 0.5)) { if (rng() < (o.overP || 0.2)) arr.push(cx, cy); break; }
          arr.push(cx, cy);
          if (o.follow) { let na = o.dir(cx, cy) + (side ? Math.PI : 0); let da = na - a; while (da > Math.PI / 2) { na -= Math.PI; da -= Math.PI; } while (da < -Math.PI / 2) { na += Math.PI; da += Math.PI; } a += da * 0.6; }
          else if (o.bend) a += o.bend * (side ? -1 : 1);
        }
      }
      const xy = [];
      for (let k = bw.length - 2; k >= 0; k -= 2) xy.push(bw[k], bw[k + 1]);
      xy.push(x, y);
      for (let k = 0; k < fw.length; k += 2) xy.push(fw[k], fw[k + 1]);
      if (xy.length < 4) { if (o.dots) C.stroke([x, y, 1, 1, x + rng.g(), y + rng.g(), 0.9, 0.9], o.med, col, (o.w[0] + o.w[1]) * 0.5, o.p[1]); continue; }
      const w = o.w[0] + (o.w[1] - o.w[0]) * rng(), p = o.p[0] + (o.p[1] - o.p[0]) * rng();
      C.stroke(A.hand(rng, xy, hopt), o.med, col, w, p);
    }
  };

  // small helpers
  A.rev = function (xy) { const o = []; for (let i = xy.length - 2; i >= 0; i -= 2) o.push(xy[i], xy[i + 1]); return o; };
  A.dot = function (C, rng, x, y, med, col, w, p) {
    const dx = rng.g() * w * 0.12, dy = rng.g() * w * 0.12;
    C.stroke([x, y, 1, 1, x + dx, y + dy, 0.9, 0.9], med, col, w, p);
  };
})(typeof self !== 'undefined' ? self : globalThis);
