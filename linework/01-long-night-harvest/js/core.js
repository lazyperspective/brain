/* Long Night Harvest — core: PRNG, noise, colour, stroke primitives, scene constants.
 * Everything is authored in native 2160x3840 units; the context carries a scale S. */
(function () {
  'use strict';
  const LW = (window.LW = window.LW || {});

  // ---------------------------------------------------------------- PRNG
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  class RNG {
    constructor(seed) { this.f = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed >>> 0); }
    next() { return this.f(); }
    range(a, b) { return a + (b - a) * this.f(); }
    int(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
    chance(p) { return this.f() < p; }
    sign() { return this.f() < 0.5 ? -1 : 1; }
    normal() { const u = 1 - this.f(), v = this.f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); }
    pick(a) { return a[Math.floor(this.f() * a.length)]; }
  }
  LW.RNG = RNG;
  LW.hashStr = hashStr;

  // integer hash -> [0,1)
  LW.hash2 = function (x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------- simplex noise
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  LW.makeNoise = function (seed) {
    const r = new RNG(seed);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = base[i]; base[i] = base[j]; base[j] = t; }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { g = p[ii + p[jj]] & 7; tt *= tt; n += tt * tt * (GX[g] * x0 + GY[g] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { g = p[ii + i1 + p[jj + j1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x1 + GY[g] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { g = p[ii + 1 + p[jj + 1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x2 + GY[g] * y2); }
      return 70 * n;
    };
  };
  LW.fbm = function (n, x, y, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2.03; gain = gain || 0.5;
    let a = 1, f = 1, s = 0, norm = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f + o * 17.13, y * f - o * 9.71); norm += a; a *= gain; f *= lac; }
    return s / norm;
  };
  LW.N1 = LW.makeNoise('long-night-1');
  LW.N2 = LW.makeNoise('long-night-2');
  LW.N3 = LW.makeNoise('long-night-3');
  LW.N4 = LW.makeNoise('long-night-4');

  // ---------------------------------------------------------------- math
  LW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  LW.lerp = (a, b, t) => a + (b - a) * t;
  LW.smooth = function (a, b, v) { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  LW.taper = function (t, a, b) {
    const v = Math.min(1, t / (a || 0.2), (1 - t) / (b || 0.2));
    return v <= 0 ? 0 : Math.sqrt(v);
  };

  // ---------------------------------------------------------------- colour
  LW.hex = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  LW.css = function (c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; };
  LW.mix = function (a, b, t) {
    const A = typeof a === 'string' ? LW.hex(a) : a, B = typeof b === 'string' ? LW.hex(b) : b;
    return LW.css([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  };

  // The whole print uses these inks. Teal family + warm family + ink + paper.
  LW.P = {
    ink: '#0c131d', night: '#0a1220', navy: '#122033', dusk: '#182a3d',
    deep: '#1d3d49', teal: '#2c5f66', sea: '#4a8783', pale: '#8fbcae', mist: '#c3dacb',
    paper: '#f3e7c4', cream: '#fbeec8', straw: '#f5ca72', amber: '#eb9b39', orange: '#d4652b',
    rust: '#9c4529', ember: '#5e2a22', soil: '#24323b',
  };

  // misregistration: each colour plate is offset a little from the key (ink) plate
  LW.REG = { cool: [1.4, 0.9], warm: [-1.1, 1.3], light: [0.8, -1.2] };
  LW.offset = function (ctx, off, fn) { ctx.save(); ctx.translate(off[0], off[1]); fn(); ctx.restore(); };

  // ---------------------------------------------------------------- batches
  class FillBatch {
    constructor() { this.m = new Map(); }
    p(key) { let q = this.m.get(key); if (!q) { q = new Path2D(); this.m.set(key, q); } return q; }
    flush(ctx, order) {
      const keys = order ? order.filter((k) => this.m.has(k)).concat([...this.m.keys()].filter((k) => order.indexOf(k) < 0)) : [...this.m.keys()];
      for (const k of keys) { ctx.fillStyle = k; ctx.fill(this.m.get(k)); }
      this.m.clear();
    }
  }
  class StrokeBatch {
    constructor() { this.m = new Map(); }
    p(color, width) {
      const w = Math.max(0.25, Math.round(width * 4) / 4);
      const key = color + '|' + w;
      let q = this.m.get(key);
      if (!q) { q = { path: new Path2D(), color, w }; this.m.set(key, q); }
      return q.path;
    }
    flush(ctx) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const q of this.m.values()) { ctx.strokeStyle = q.color; ctx.lineWidth = q.w; ctx.stroke(q.path); }
      this.m.clear();
    }
  }
  LW.FillBatch = FillBatch;
  LW.StrokeBatch = StrokeBatch;

  // ---------------------------------------------------------------- polylines
  // pts: flat [x0,y0,x1,y1,...]; hwf(t, i, x, y) -> half width
  LW.ribbon = function (path, pts, hwf) {
    const n = pts.length >> 1;
    if (n < 2) return;
    const cum = new Float64Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
    const total = cum[n - 1] || 1;
    const lx = new Float64Array(n), ly = new Float64Array(n), rx = new Float64Array(n), ry = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
      let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const hw = hwf(cum[i] / total, i, pts[2 * i], pts[2 * i + 1]);
      lx[i] = pts[2 * i] - ty * hw; ly[i] = pts[2 * i + 1] + tx * hw;
      rx[i] = pts[2 * i] + ty * hw; ry[i] = pts[2 * i + 1] - tx * hw;
    }
    path.moveTo(lx[0], ly[0]);
    for (let i = 1; i < n; i++) path.lineTo(lx[i], ly[i]);
    for (let i = n - 1; i >= 0; i--) path.lineTo(rx[i], ry[i]);
    path.closePath();
  };
  // closed outline ribbon (two loops of opposite winding)
  LW.ribbonClosed = function (path, pts, hwf) {
    const n = pts.length >> 1;
    if (n < 3) return;
    const lx = new Float64Array(n), ly = new Float64Array(n), rx = new Float64Array(n), ry = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const hw = hwf(i / n, i, pts[2 * i], pts[2 * i + 1], -ty, tx);
      lx[i] = pts[2 * i] - ty * hw; ly[i] = pts[2 * i + 1] + tx * hw;
      rx[i] = pts[2 * i] + ty * hw; ry[i] = pts[2 * i + 1] - tx * hw;
    }
    path.moveTo(lx[0], ly[0]);
    for (let i = 1; i < n; i++) path.lineTo(lx[i], ly[i]);
    path.closePath();
    path.moveTo(rx[n - 1], ry[n - 1]);
    for (let i = n - 2; i >= 0; i--) path.lineTo(rx[i], ry[i]);
    path.closePath();
  };
  LW.polyPath = function (path, pts, close) {
    path.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
    if (close) path.closePath();
  };
  // Catmull-Rom through control points [[x,y],...] -> flat array
  LW.spline = function (ctrl, per, closed) {
    const out = [];
    const n = ctrl.length;
    const get = (i) => closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        for (let d = 0; d < 2; d++) {
          out.push(0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3));
        }
      }
    }
    if (!closed) { out.push(ctrl[n - 1][0], ctrl[n - 1][1]); }
    return out;
  };
  // resample polyline at roughly even spacing
  LW.resample = function (pts, step) {
    const out = [pts[0], pts[1]];
    let carry = 0;
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0);
      let d = step - carry;
      while (d <= L) { const t = d / L; out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); d += step; }
      carry = L - (d - step);
    }
    const n = pts.length;
    if (out[out.length - 2] !== pts[n - 2] || out[out.length - 1] !== pts[n - 1]) out.push(pts[n - 2], pts[n - 1]);
    return out;
  };
  // displace along normals by noise for a hand-drawn wobble
  LW.wobble = function (pts, amp, freq, seed, closed) {
    const n = pts.length >> 1, out = new Array(pts.length);
    const nz = LW.N4;
    for (let i = 0; i < n; i++) {
      const a = closed ? (i - 1 + n) % n : Math.max(0, i - 1), b = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const x = pts[2 * i], y = pts[2 * i + 1];
      const d = amp * nz(x * freq + seed * 3.1, y * freq - seed * 1.7);
      out[2 * i] = x - ty * d; out[2 * i + 1] = y + tx * d;
    }
    return out;
  };
  // split polyline into dashes; cb(sub, t0, t1)
  LW.dashes = function (pts, rng, lenA, lenB, gapA, gapB, cb) {
    const n = pts.length >> 1;
    if (n < 2) return;
    let i = 0, acc = 0;
    let cur = [pts[0], pts[1]];
    let target = rng.range(lenA, lenB) * (rng.next() < 0.5 ? rng.range(0.25, 1) : 1);
    let drawing = true;
    for (i = 1; i < n; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1];
      acc += Math.hypot(x - pts[2 * i - 2], y - pts[2 * i - 1]);
      if (drawing) cur.push(x, y);
      if (acc >= target) {
        if (drawing) { if (cur.length >= 4) cb(cur); cur = []; drawing = false; target = rng.range(gapA, gapB); }
        else { drawing = true; cur = [x, y]; target = rng.range(lenA, lenB) * (rng.next() < 0.3 ? rng.range(0.2, 1) : 1); }
        acc = 0;
      }
    }
    if (drawing && cur.length >= 4) cb(cur);
  };

  // blob: closed scalloped outline around (cx,cy)
  LW.scallop = function (cx, cy, r, rng, opts) {
    opts = opts || {};
    const bumps = opts.bumps || Math.max(5, Math.round(r / (opts.bumpSize || 14)));
    const sq = opts.squash || 1;
    const out = [];
    const phase = rng.range(0, 6.28);
    const rr = [];
    for (let k = 0; k < bumps; k++) rr.push(1 + rng.range(-0.12, 0.12));
    const per = opts.per || 7;
    for (let k = 0; k < bumps; k++) {
      for (let s = 0; s < per; s++) {
        const u = s / per;
        const a = phase + ((k + u) / bumps) * Math.PI * 2;
        const bump = Math.sin(u * Math.PI);
        const rad = r * (rr[k] * (1 - (opts.depth || 0.1)) + (opts.depth || 0.1) * bump * 1.6) * (1 + 0.08 * LW.N3(cx * 0.01 + Math.cos(a), cy * 0.01 + Math.sin(a)));
        out.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * sq);
      }
    }
    return out;
  };

  // ---------------------------------------------------------------- scene constants
  const SC = (LW.SC = {
    W: 2160, H: 3840,
    yh: 2290, f: 2000, cx: 1080, camH: 3.2,
    sun: { x: 880, y: 2292 },
    planet: { x: 1340, y: 1700, R: 560, theta: (10 * Math.PI) / 180, sphi: 0.3 },
  });
  const P = SC.planet;
  P.ct = Math.cos(P.theta); P.st = Math.sin(P.theta); P.cphi = Math.sqrt(1 - P.sphi * P.sphi);
  P.E1 = [P.ct, P.st, 0];
  P.E2 = [-P.sphi * P.st, P.sphi * P.ct, P.cphi];
  P.N = [P.cphi * P.st, -P.cphi * P.ct, P.sphi];
  (function () { const L = [-0.62, 0.42, 0.66]; const l = Math.hypot(L[0], L[1], L[2]); P.L = [L[0] / l, L[1] / l, L[2] / l]; })();

  SC.glow = function (x, y) {
    const dx = x - SC.sun.x, dy = y - SC.sun.y;
    const a = (dx / 540) ** 2 + (dy / 170) ** 2;
    const b = (dx / 1250) ** 2 + (dy / 430) ** 2;
    const c = (dy / 115) ** 2 + (dx / 2400) ** 2;
    return Math.exp(-a) * 0.75 + Math.exp(-b) * 0.5 + Math.exp(-c) * 0.2;
  };
  // vortex frame
  SC.kOf = function (d) { return 0.3 + 0.24 * LW.smooth(P.R * 1.0, P.R * 3.6, d); };
  SC.ell = function (x, y) {
    const dx = x - P.x, dy = y - P.y;
    const u = dx * P.ct + dy * P.st, v = -dx * P.st + dy * P.ct;
    const d = Math.hypot(dx, dy);
    const k = SC.kOf(d);
    return { u, v, d, k, re: Math.hypot(u, v / k) };
  };
  SC.vortexLight = function (x, y) {
    const e = SC.ell(x, y);
    const radial = Math.exp(-(((e.re - 1.65 * P.R) / (1.6 * P.R)) ** 2));
    const dx = x - P.x, dy = y - P.y, l = Math.hypot(dx, dy) || 1;
    const sx = SC.sun.x - P.x, sy = SC.sun.y - P.y, sl = Math.hypot(sx, sy);
    const c = (dx * sx + dy * sy) / (l * sl);
    return radial * (0.62 + 0.38 * c);
  };
  // vortex existence (dissolve into stars toward the top)
  SC.vortexFade = function (x, y) {
    const e = SC.ell(x, y);
    const n = LW.fbm(LW.N2, x * 0.0009, y * 0.0011, 4);
    return 1 - LW.smooth(1750, 2900, e.re + 520 * n);
  };

  // distant land
  SC.ridgeFar = function (x) {
    return 2290 - (64 * Math.exp(-(((x - 1480) / 720) ** 2)) + 42 * Math.exp(-(((x - 240) / 520) ** 2)))
      - 7 * LW.fbm(LW.N1, x * 0.004, 3.3, 3) - 2.2 * LW.N2(x * 0.03, 1.1) - 6;
  };
  SC.ridgeNear = function (x) {
    return 2294 - (130 * Math.exp(-(((x - 1840) / 440) ** 2)) + 40 * Math.exp(-(((x - 1240) / 240) ** 2)) + 70 * Math.exp(-(((x - 100) / 300) ** 2)))
      - 6 * LW.fbm(LW.N1, x * 0.006, 7.7, 3) - 1.6 * LW.N3(x * 0.04, 2.2);
  };
  SC.landTop = function (x) { return Math.min(SC.ridgeFar(x), SC.ridgeNear(x)); };

  // field perspective
  SC.terrain = function (X, Z) {
    const k = LW.smooth(9, 40, Z) * (1 - LW.smooth(150, 210, Z));
    return k * (0.9 * Math.sin(Z * 0.05 + 1.1) + 0.8 * LW.fbm(LW.N1, X * 0.011 + 3, Z * 0.013, 3));
  };
  SC.screenX = (X, Z) => SC.cx + (SC.f * X) / Z;
  SC.worldX = (x, Z) => ((x - SC.cx) * Z) / SC.f;
  SC.groundY = (X, Z) => SC.yh + (SC.f * (SC.camH - SC.terrain(X, Z))) / Z;
  // cart path centre (world X as a function of Z): screen control points
  (function () {
    const ctrl = [[2.4, 1230], [3.5, 1170], [5, 1080], [7, 980], [10, 905], [14, 930], [20, 1010], [30, 1100], [45, 1110], [70, 1075], [110, 1045], [160, 1033], [230, 1030]];
    const lz = ctrl.map((c) => [Math.log(c[0]), ((c[1] - SC.cx) * c[0]) / SC.f]);
    SC.pathX = function (Z) {
      const l = Math.log(Z);
      if (l <= lz[0][0]) return lz[0][1];
      if (l >= lz[lz.length - 1][0]) return lz[lz.length - 1][1] + (Z - ctrl[ctrl.length - 1][0]) * ((1030 - SC.cx) / SC.f);
      let i = 0;
      while (i < lz.length - 2 && lz[i + 1][0] < l) i++;
      const p0 = lz[Math.max(0, i - 1)], p1 = lz[i], p2 = lz[i + 1], p3 = lz[Math.min(lz.length - 1, i + 2)];
      const t = (l - p1[0]) / (p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
      return 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    };
  })();
  SC.pathHalf = function (Z) { return 0.64 + 0.05 * LW.N2(Z * 0.08, 4.4); };
  // right-hand hedgerow line (world)
  SC.hedgeX = function (Z) { return 13.4 + ((42 - 13.4) * (Z - 24)) / 176; };
  SC.farHedgeZ = 205;
  SC.oak = { X: -16.6, Z: 46 };
})();
