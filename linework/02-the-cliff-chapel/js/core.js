// core.js - PRNG, noise, math, layers, ink ribbons, masks.
(function () {
  'use strict';
  const LW = (window.LW = {});
  const params = new URLSearchParams(location.search);
  LW.W = 2160;
  LW.H = 3840;
  LW.SIZE = parseInt(params.get('size') || '2160', 10);
  LW.S = LW.SIZE / LW.W; // device px per native unit
  LW.SEED = parseInt(params.get('seed') || '20261104', 10);
  LW.params = params;

  // ---------------------------------------------------------------- PRNG
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
  LW.rng = function (seed) {
    if (typeof seed === 'string') seed = hashStr(seed) ^ LW.SEED;
    const r = sfc32(0x9e3779b9, seed | 0, (seed * 7919) | 0, 0x85ebca6b ^ seed);
    for (let i = 0; i < 15; i++) r();
    const o = () => r();
    o.range = (a, b) => a + (b - a) * r();
    o.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    o.pick = (arr) => arr[Math.floor(r() * arr.length)];
    o.chance = (p) => r() < p;
    o.sign = () => (r() < 0.5 ? -1 : 1);
    o.gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = r();
      v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return o;
  };

  // ---------------------------------------------------------------- simplex noise 2D
  function makeNoise(seed) {
    const rnd = LW.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const g = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      let n0 = 0, n1 = 0, n2 = 0;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const gi = pm12[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const gi = pm12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const gi = pm12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2 = t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2); }
      return 70 * (n0 + n1 + n2);
    };
  }
  LW.makeNoise = makeNoise;
  const N1 = makeNoise('n1'), N2 = makeNoise('n2'), N3 = makeNoise('n3');
  LW.noise = N1;
  LW.noise2 = N2;
  LW.noise3 = N3;
  LW.fbm = function (x, y, oct = 4, lac = 2.0, gain = 0.5, nf = N1) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * nf(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  };
  LW.ridge = function (x, y, oct = 4) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(N2(x * f, y * f))); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };

  // ---------------------------------------------------------------- math
  LW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  LW.lerp = (a, b, t) => a + (b - a) * t;
  LW.smooth = (a, b, v) => { const t = LW.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  LW.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  LW.TAU = Math.PI * 2;
  // light direction in screen space (pointing TOWARD the light): upper-left
  LW.LIGHT2 = (() => { const x = -0.55, y = -0.83; const l = Math.hypot(x, y); return [x / l, y / l]; })();

  // Catmull-Rom resampling of a polyline -> dense polyline with spacing ~step
  LW.spline = function (pts, step = 4, closed = false) {
    const out = [];
    const n = pts.length;
    if (n < 2) return pts.slice();
    const get = (i) => {
      if (closed) return pts[((i % n) + n) % n];
      return pts[Math.max(0, Math.min(n - 1, i))];
    };
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.max(1, Math.ceil(len / step));
      for (let j = 0; j < k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  };
  LW.resample = function (pts, step) {
    const out = [pts[0].slice()];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      let seg = Math.hypot(bx - ax, by - ay);
      while (acc + seg >= step) {
        const t = (step - acc) / seg;
        ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t;
        out.push([ax, ay]);
        seg = Math.hypot(bx - ax, by - ay);
        acc = 0;
      }
      acc += seg;
    }
    const last = pts[pts.length - 1];
    if (Math.hypot(out[out.length - 1][0] - last[0], out[out.length - 1][1] - last[1]) > step * 0.3) out.push(last.slice());
    return out;
  };
  LW.polyLen = function (pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  };
  // jitter a polyline perpendicular with noise (hand wobble)
  LW.wobble = function (pts, amp = 1.2, freq = 0.02, seed = 0) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const n = N3(pts[i][0] * freq + seed * 13.1, pts[i][1] * freq - seed * 7.7) * amp;
      out.push([pts[i][0] - dy * n, pts[i][1] + dx * n]);
    }
    return out;
  };
  LW.pointInPoly = function (x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  LW.polyPath = function (pts, closed = true, path = new Path2D()) {
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
    if (closed) path.closePath();
    return path;
  };
  LW.bbox = function (pts, pad = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  };
  // organic closed outline: base polygon -> spline -> noise roughened
  LW.organic = function (pts, { step = 5, amp = 3, freq = 0.03, seed = 0 } = {}) {
    return LW.wobble(LW.spline(pts, step, true), amp, freq, seed);
  };

  // ---------------------------------------------------------------- canvases / layers
  LW.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };
  LW.initLayers = function () {
    const S = LW.S;
    const mk = () => {
      const c = LW.canvas(LW.W * S, LW.H * S);
      const g = c.getContext('2d');
      g.setTransform(S, 0, 0, S, 0, 0);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      return g;
    };
    LW.fill = mk(); // flat colour plates
    LW.ink = mk(); // key line plate
  };

  // ---------------------------------------------------------------- palette
  LW.C = {
    paper: '#efe4c4',
    cream: '#ece0bb',
    creamLit: '#f3ead0',
    creamShade: '#d8c79c',
    stone: '#e4d4a8',
    stoneShade: '#c9b27f',
    ochre: '#b98b4e',
    ochreLight: '#cfa565',
    umber: '#7d5533',
    wood: '#8e5a32',
    woodDark: '#5e3a22',
    sky: '#2c7884',
    skyDeep: '#22636f',
    skyHaze: '#4f9396',
    teal: '#2f7f86',
    tealDark: '#1d5a62',
    tealDeep: '#144a52',
    tealLight: '#5aa29f',
    tealPale: '#8fbcb2',
    sea: '#2a727d',
    seaDeep: '#1f5f6a',
    seaLight: '#4f9298',
    bronze: '#8a6a2c',
    patina: '#5f9b85',
    terracotta: '#b5643a',
    moss: '#5e8a5a',
    ink: '#2a1e18',
    inkSoft: '#3a2b22',
  };

  // ---------------------------------------------------------------- ink ribbons
  // A Pen accumulates filled ribbons (tapered strokes) in one Path2D.
  // All sub-shapes have the same winding so overlaps stay solid with 'nonzero'.
  class Pen {
    constructor() { this.p = new Path2D(); this.n = 0; }
    // pts: [[x,y],...]; w: number | array | fn(t,i) giving half-width... we take FULL width
    line(pts, w = 2, taper = 0.25, minW = 0.15) {
      const n = pts.length;
      if (n < 2) return;
      let L = 0;
      const cum = [0];
      for (let i = 1; i < n; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(L); }
      if (L < 0.5) return;
      const left = [], right = [];
      const tl = Math.min(0.5, taper);
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
        const t = cum[i] / L;
        let ww = typeof w === 'number' ? w : typeof w === 'function' ? w(t, i) : w[i];
        if (tl > 0) {
          const e = Math.min(t, 1 - t) / tl;
          if (e < 1) ww *= minW + (1 - minW) * Math.sin(Math.min(1, e) * Math.PI * 0.5);
        }
        const hw = Math.max(0.12, ww * 0.5);
        left.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
        right.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
      }
      const p = this.p;
      p.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < n; i++) p.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
      p.closePath();
      this.n++;
    }
    seg(x0, y0, x1, y1, w = 2, taper = 0.3) {
      this.line([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]], w, taper);
    }
    dot(x, y, r) {
      this.p.moveTo(x + r, y);
      this.p.arc(x, y, r, 0, Math.PI * 2, true);
      this.n++;
    }
    poly(pts) { // filled polygon (any orientation -> force negative area)
      let a = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      // a is the standard shoelace sum; ribbons/dots use negative orientation
      const r = a < 0 ? pts : pts.slice().reverse();
      this.p.moveTo(r[0][0], r[0][1]);
      for (let i = 1; i < r.length; i++) this.p.lineTo(r[i][0], r[i][1]);
      this.p.closePath();
      this.n++;
    }
    draw(ctx = LW.ink, color = LW.C.ink, alpha = 1) {
      if (!this.n) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill(this.p, 'nonzero');
      ctx.restore();
      this.p = new Path2D();
      this.n = 0;
    }
  }
  LW.Pen = Pen;

  // closed outline ink with heavier weight on the shadow side
  // pts: closed polygon (dense). w: base width, k: extra factor on shadow side
  LW.outline = function (pen, pts, w = 3, k = 1.2, opts = {}) {
    const n = pts.length;
    if (n < 3) return;
    const [lx, ly] = opts.light || LW.LIGHT2;
    // orientation sign
    let a = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
    const sgn = a > 0 ? 1 : -1;
    const closed = opts.closed !== false;
    const P = closed ? pts.concat([pts[0], pts[1]]) : pts;
    const ws = [];
    const seed = opts.seed || 0;
    for (let i = 0; i < P.length; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(P.length - 1, i + 1)];
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const l = Math.hypot(dx, dy) || 1;
      // outward normal (depends on orientation)
      const nx = (sgn * dy) / l, ny = (-sgn * dx) / l;
      const sh = Math.max(0, -(nx * lx + ny * ly)); // 0 lit side, 1 shadow side
      const nz = 1 + 0.25 * N3(P[i][0] * 0.05 + seed, P[i][1] * 0.05);
      ws.push(w * (1 + k * sh * sh) * nz);
    }
    pen.line(P, ws, closed ? 0 : opts.taper ?? 0.12);
  };

  // Generic contour with per-vertex weight; weight <= 0 creates a gap.
  // pts closed (unless closed:false). wfn(nx, ny, x, y, i) -> width, given outward normal.
  LW.inkContour = function (pen, pts, wfn, opts = {}) {
    const n = pts.length;
    if (n < 2) return;
    const closed = opts.closed !== false;
    let a = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
    const sgn = a > 0 ? 1 : -1;
    const cnt = closed ? n + 1 : n;
    let run = [], ws = [];
    const flush = () => {
      if (run.length > 1) pen.line(run, ws, opts.taper ?? 0.15, 0.2);
      run = []; ws = [];
    };
    for (let k = 0; k < cnt; k++) {
      const i = k % n;
      const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const l = Math.hypot(dx, dy) || 1;
      const nx = (sgn * dy) / l, ny = (-sgn * dx) / l;
      const w = wfn(nx, ny, pts[i][0], pts[i][1], i);
      if (w <= 0.05) { flush(); continue; }
      run.push(pts[i]); ws.push(w);
    }
    flush();
  };
  // shadow-side factor of an outward normal: 0 (facing light) .. 1 (facing away)
  LW.shadowSide = (nx, ny) => LW.clamp(0.5 - 0.5 * (nx * LW.LIGHT2[0] + ny * LW.LIGHT2[1]), 0, 1);

  // ---------------------------------------------------------------- masks
  class Mask {
    constructor(x0, y0, w, h, res = 0.5) {
      this.x0 = Math.floor(x0); this.y0 = Math.floor(y0);
      this.res = res;
      this.cw = Math.max(1, Math.ceil(w * res));
      this.ch = Math.max(1, Math.ceil(h * res));
      this.data = null;
    }
    static fromPath(path, bb, res = 0.5) {
      const bw = bb.w ?? bb.x1 - bb.x0, bh = bb.h ?? bb.y1 - bb.y0;
      const m = new Mask(bb.x0 - 2, bb.y0 - 2, bw + 4, bh + 4, res);
      return m.paint((g) => { g.fillStyle = '#fff'; g.fill(path); });
    }
    paint(fn) {
      const c = LW.canvas(this.cw, this.ch);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(this.res, 0, 0, this.res, -this.x0 * this.res, -this.y0 * this.res);
      fn(g);
      const id = g.getImageData(0, 0, this.cw, this.ch).data;
      const d = (this.data = new Uint8Array(this.cw * this.ch));
      for (let i = 0, j = 3; i < d.length; i++, j += 4) d[i] = id[j];
      return this;
    }
    at(x, y) {
      const i = ((x - this.x0) * this.res) | 0, j = ((y - this.y0) * this.res) | 0;
      if (i < 0 || j < 0 || i >= this.cw || j >= this.ch) return 0;
      return this.data[j * this.cw + i];
    }
    in(x, y) { return this.at(x, y) > 127; }
    // approximate euclidean distance to the outside (in native units), chamfer 3-4
    distance() {
      const w = this.cw, h = this.ch, d = new Float32Array(w * h), BIG = 1e9;
      for (let i = 0; i < d.length; i++) d[i] = this.data[i] > 127 ? BIG : 0;
      const a = 1, b = Math.SQRT2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!d[i]) continue;
        let v = d[i];
        if (x > 0) v = Math.min(v, d[i - 1] + a); else v = Math.min(v, a);
        if (y > 0) { v = Math.min(v, d[i - w] + a); if (x > 0) v = Math.min(v, d[i - w - 1] + b); if (x < w - 1) v = Math.min(v, d[i - w + 1] + b); } else v = Math.min(v, a);
        d[i] = v;
      }
      for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x; if (!d[i]) continue;
        let v = d[i];
        if (x < w - 1) v = Math.min(v, d[i + 1] + a); else v = Math.min(v, a);
        if (y < h - 1) { v = Math.min(v, d[i + w] + a); if (x < w - 1) v = Math.min(v, d[i + w + 1] + b); if (x > 0) v = Math.min(v, d[i + w - 1] + b); } else v = Math.min(v, a);
        d[i] = v;
      }
      const inv = 1 / this.res;
      for (let i = 0; i < d.length; i++) d[i] *= inv;
      this.dist = d;
      return this;
    }
    dAt(x, y) {
      const i = ((x - this.x0) * this.res) | 0, j = ((y - this.y0) * this.res) | 0;
      if (i < 0 || j < 0 || i >= this.cw || j >= this.ch) return 0;
      return this.dist[j * this.cw + i];
    }
  }
  LW.Mask = Mask;

  // erase key-line plate under a shape (occlusion), and paint a flat fill
  LW.occlude = function (path) {
    const g = LW.ink;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.fill(path);
    g.restore();
  };
  LW.flat = function (path, color, ctx = LW.fill) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
  };
  LW.clipDo = function (ctx, path, fn) {
    ctx.save();
    ctx.clip(path);
    fn();
    ctx.restore();
  };

  LW.tick = () => new Promise((r) => setTimeout(r, 0));
  LW.log = (...a) => console.log(...a);
})();
