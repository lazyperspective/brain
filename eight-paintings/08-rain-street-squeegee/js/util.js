// util.js — seeded PRNG, gradient noise, blurs, colour helpers. No Math.random anywhere.
var P8 = window.P8 || (window.P8 = {});
(function () {
  'use strict';
  P8.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function hash2(ix, iy, s) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  P8.hash2 = hash2;
  P8.hashf = function (ix, iy, s) { return hash2(ix, iy, s) / 4294967296; };
  // 2D gradient noise, range ~[-1,1]
  P8.noise = function (x, y, s) {
    s = s | 0;
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    function g(cx, cy, dx, dy) {
      const h = hash2(cx, cy, s) & 7;
      switch (h) {
        case 0: return dx + dy; case 1: return -dx + dy; case 2: return dx - dy; case 3: return -dx - dy;
        case 4: return 1.4142 * dx; case 5: return -1.4142 * dx; case 6: return 1.4142 * dy; default: return -1.4142 * dy;
      }
    }
    const a = g(ix, iy, fx, fy), b = g(ix + 1, iy, fx - 1, fy), c = g(ix, iy + 1, fx, fy - 1), d = g(ix + 1, iy + 1, fx - 1, fy - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
  };
  P8.fbm = function (x, y, oct, s, lac, gain) {
    lac = lac || 2.03; gain = gain || 0.5;
    let sum = 0, amp = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * P8.noise(x, y, s + i * 101);
      norm += amp; amp *= gain; x *= lac; y *= lac;
    }
    return sum / norm;
  };
  P8.smooth = function (a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  P8.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };

  // box blur (in place) on a single-channel float array, horizontal then vertical; r integer
  function boxH(src, dst, W, H, r) {
    const inv = 1 / (2 * r + 1);
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[o + Math.min(W - 1, Math.max(0, i))];
      for (let x = 0; x < W; x++) {
        dst[o + x] = acc * inv;
        const a = Math.min(W - 1, x + r + 1), b = Math.max(0, x - r);
        acc += src[o + a] - src[o + b];
      }
    }
  }
  function boxV(src, dst, W, H, r) {
    const inv = 1 / (2 * r + 1);
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[Math.min(H - 1, Math.max(0, i)) * W + x];
      for (let y = 0; y < H; y++) {
        dst[y * W + x] = acc * inv;
        const a = Math.min(H - 1, y + r + 1), b = Math.max(0, y - r);
        acc += src[a * W + x] - src[b * W + x];
      }
    }
  }
  // approx gaussian with sigma via 3 box passes; separate sigmas for x and y
  P8.blur = function (arr, W, H, sx, sy) {
    const tmp = new Float32Array(W * H);
    const rx = Math.max(0, Math.round(Math.sqrt(12 * sx * sx / 3 + 1) / 2 - 0.5));
    const ry = Math.max(0, Math.round(Math.sqrt(12 * sy * sy / 3 + 1) / 2 - 0.5));
    for (let k = 0; k < 3; k++) {
      if (rx > 0) { boxH(arr, tmp, W, H, rx); arr.set(tmp); }
      if (ry > 0) { boxV(arr, tmp, W, H, ry); arr.set(tmp); }
    }
    return arr;
  };
  // planar RGB helpers: images stored as {W,H,r,g,b} Float32Arrays
  P8.img = function (W, H) { return { W: W, H: H, r: new Float32Array(W * H), g: new Float32Array(W * H), b: new Float32Array(W * H) }; };
  P8.blurImg = function (im, sx, sy) { P8.blur(im.r, im.W, im.H, sx, sy); P8.blur(im.g, im.W, im.H, sx, sy); P8.blur(im.b, im.W, im.H, sx, sy); return im; };
  P8.copyImg = function (im) { return { W: im.W, H: im.H, r: im.r.slice(), g: im.g.slice(), b: im.b.slice() }; };
  P8.lin2s = function (c) { c = c <= 0 ? 0 : c >= 1 ? 1 : c; return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  P8.s2lin = function (c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  // Kubelka–Munk style single-channel mix of reflectances (pigment-like, darker & richer than RGB lerp)
  P8.ks = function (R) { R = R < 0.001 ? 0.001 : R > 0.999 ? 0.999 : R; return (1 - R) * (1 - R) / (2 * R); };
  P8.rk = function (k) { return 1 + k - Math.sqrt(k * k + 2 * k); };
  P8.mixKM = function (a, b, t) { return P8.rk(P8.ks(a) * (1 - t) + P8.ks(b) * t); };
})();
