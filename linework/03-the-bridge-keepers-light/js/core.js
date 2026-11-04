/* core.js: seeded randomness, noise, colour and geometry helpers.
   Everything hangs off the global LW namespace (classic scripts so the page
   also works from file://). */
(function () {
  'use strict';
  const LW = (window.LW = window.LW || {});

  // ---------------------------------------------------------------- RNG
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  class RNG {
    constructor(seed) {
      this.r = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed >>> 0);
    }
    next() { return this.r(); }
    range(a, b) { return a + (b - a) * this.r(); }
    int(a, b) { return Math.floor(a + (b - a + 1) * this.r()); }
    chance(p) { return this.r() < p; }
    pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
    gauss() {
      let u = 0, v = 0;
      while (u === 0) u = this.r();
      while (v === 0) v = this.r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    sign() { return this.r() < 0.5 ? -1 : 1; }
  }
  LW.RNG = RNG;
  LW.hashStr = hashStr;

  // ---------------------------------------------------------------- Simplex noise 2D
  function makeSimplex(seed) {
    const rng = new RNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512);
    const pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const gx = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
    const gy = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1];
    // use 12 gradients but with 2D components adapted
    const GX = new Float32Array(12), GY = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      GX[i] = Math.cos(a); GY[i] = Math.sin(a);
    }
    void gx; void gy;
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
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
      if (t0 > 0) { const g = pm12[ii + perm[jj]]; t0 *= t0; n0 = t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = pm12[ii + i1 + perm[jj + j1]]; t1 *= t1; n1 = t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = pm12[ii + 1 + perm[jj + 1]]; t2 *= t2; n2 = t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
      return 70 * (n0 + n1 + n2);
    };
  }
  LW.makeSimplex = makeSimplex;

  class Noise {
    constructor(seed) {
      this.n = makeSimplex(seed);
    }
    n2(x, y) { return this.n(x, y); }
    fbm(x, y, oct = 4, lac = 2.03, gain = 0.5) {
      let a = 1, f = 1, s = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        s += a * this.n(x * f + i * 17.13, y * f - i * 9.71);
        norm += a; a *= gain; f *= lac;
      }
      return s / norm;
    }
    ridged(x, y, oct = 4, lac = 2.1, gain = 0.55) {
      let a = 1, f = 1, s = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        const v = 1 - Math.abs(this.n(x * f + i * 31.7, y * f + i * 7.3));
        s += a * v * v;
        norm += a; a *= gain; f *= lac;
      }
      return s / norm;
    }
  }
  LW.Noise = Noise;

  // ---------------------------------------------------------------- math
  LW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  LW.lerp = (a, b, t) => a + (b - a) * t;
  LW.smooth = (e0, e1, x) => {
    const t = LW.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  LW.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // ---------------------------------------------------------------- colour
  function hex(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  LW.hex = hex;
  LW.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  LW.rgb = (c, a) =>
    a === undefined
      ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
      : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // ---------------------------------------------------------------- geometry
  // Catmull-Rom through control points (array of [x,y]); returns flat-ish array of [x,y]
  LW.spline = function (pts, seg = 12, closed = false) {
    const out = [];
    const n = pts.length;
    const get = (i) => {
      if (closed) return pts[(i + n) % n];
      return pts[LW.clamp(i, 0, n - 1)];
    };
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x, y]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  };

  // resample a polyline (array of [x,y]) at roughly uniform spacing
  LW.resample = function (pts, step) {
    const out = [pts[0].slice()];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][1];
      const bx = pts[i][0], by = pts[i][1];
      const L = Math.hypot(bx - ax, by - ay);
      if (L === 0) continue;
      let d = step - acc;
      while (d <= L) {
        const t = d / L;
        out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
        d += step;
      }
      acc = L - (d - step);
    }
    const lp = pts[pts.length - 1];
    const lo = out[out.length - 1];
    if (Math.hypot(lp[0] - lo[0], lp[1] - lo[1]) > step * 0.3) out.push(lp.slice());
    return out;
  };

  // displace a polyline along its normals with fractal noise (rocky edges)
  LW.roughen = function (pts, noise, amp, freq, oct = 5, seed = 0) {
    const n = pts.length;
    const out = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const L = Math.hypot(tx, ty) || 1;
      tx /= L; ty /= L;
      if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const d = noise.fbm(s * freq + seed, seed * 0.37 + 3.1, oct, 2.2, 0.55) * amp;
      out.push([pts[i][0] - ty * d, pts[i][1] + tx * d]);
    }
    return out;
  };

  LW.polyPath = function (pts, closed = true) {
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (closed) p.closePath();
    return p;
  };
  LW.bbox = function (pts, pad = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[0] > x1) x1 = p[0];
      if (p[1] > y1) y1 = p[1];
    }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  };
  LW.pointInPoly = function (x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // y of a polyline (monotone-ish in x) at given x
  LW.yAt = function (pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= x) {
        const a = pts[i - 1], b = pts[i];
        const t = (x - a[0]) / (b[0] - a[0] || 1);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  };
  LW.xAt = function (pts, y) {
    // pts monotone in y
    if (y <= pts[0][1]) return pts[0][0];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][1] >= y) {
        const a = pts[i - 1], b = pts[i];
        const t = (y - a[1]) / (b[1] - a[1] || 1);
        return a[0] + (b[0] - a[0]) * t;
      }
    }
    return pts[pts.length - 1][0];
  };

  LW.sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  LW.log = function (...a) {
    if (window.__drawLog) window.__drawLog.push(a.join(' '));
    console.log('[03]', ...a);
  };
})();
