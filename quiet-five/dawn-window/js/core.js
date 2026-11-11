// Dawn, a Window, a Glass of Water — core utilities (seeded randomness, noise, colour).
// Everything is deterministic: no Math.random, no clocks in the render path.
(function () {
  'use strict';
  const DW = (window.DW = window.DW || {});

  // ---------- seeded randomness ----------
  DW.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function hash2(i, j, s) {
    let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  DW.hash2 = hash2;

  // smooth value noise in [0,1]
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  DW.vnoise = vnoise;

  DW.fbm = function (x, y, s, oct) {
    let a = 0.5, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      // rotate each octave a little to hide the lattice
      const rx = x * f * 0.8 - y * f * 0.6, ry = x * f * 0.6 + y * f * 0.8;
      sum += a * vnoise(rx + o * 31.7, ry - o * 17.3, s + o * 101);
      norm += a;
      a *= 0.5;
      f *= 2.07;
    }
    return sum / norm;
  };

  // 1D smooth noise
  DW.noise1 = function (x, s) {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = hash2(i, 7, s), b = hash2(i + 1, 7, s);
    return a + (b - a) * u;
  };

  DW.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  DW.smooth = function (e0, e1, x) {
    let t = (x - e0) / (e1 - e0);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  };
  DW.mix = (a, b, t) => a + (b - a) * t;

  // ---------- colour ----------
  DW.s2l = function (c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  DW.srgb = (r, g, b) => [DW.s2l(r), DW.s2l(g), DW.s2l(b)];
  DW.l2s = function (c) {
    c = c < 0 ? 0 : c;
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  // OKLab
  DW.lin2ok = function (r, g, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  DW.ok2lin = function (L, a, b) {
    let l = L + 0.3963377774 * a + 0.2158037573 * b;
    let m = L - 0.1055613458 * a - 0.0638541728 * b;
    let s = L - 0.0894841775 * a - 1.291485548 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };

  // Gradient through sRGB key colours, interpolated in OKLab (smooth, no muddy midpoints).
  // keys: [[pos, r, g, b], ...] sorted by pos. Returns a lookup function pos -> linear rgb (writes into out).
  DW.gradient = function (keys) {
    const ks = keys.map((k) => ({ p: k[0], ok: DW.lin2ok(DW.s2l(k[1]), DW.s2l(k[2]), DW.s2l(k[3])) }));
    return function (p, out) {
      let i = 0;
      while (i < ks.length - 2 && p > ks[i + 1].p) i++;
      const A = ks[i], B = ks[i + 1];
      let t = (p - A.p) / (B.p - A.p);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      t = t * t * (3 - 2 * t) * 0.5 + t * 0.5; // gentle ease keeps C1-ish continuity across keys
      const c = DW.ok2lin(A.ok[0] + (B.ok[0] - A.ok[0]) * t, A.ok[1] + (B.ok[1] - A.ok[1]) * t, A.ok[2] + (B.ok[2] - A.ok[2]) * t);
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
      return out;
    };
  };

  // ---------- image helpers ----------
  // separable box blur on a Float32Array with `ch` interleaved channels, repeated `passes` times (≈ gaussian)
  DW.boxBlur = function (src, w, h, ch, r, passes) {
    if (r < 1) return src.slice();
    let a = src.slice(), b = new Float32Array(src.length);
    const tmp = new Float32Array(Math.max(w, h) * ch);
    for (let p = 0; p < passes; p++) {
      // horizontal
      for (let y = 0; y < h; y++) {
        const row = y * w * ch;
        for (let c = 0; c < ch; c++) {
          let acc = 0;
          for (let k = -r; k <= r; k++) acc += a[row + DW.clamp(k, 0, w - 1) * ch + c];
          for (let x = 0; x < w; x++) {
            tmp[x * ch + c] = acc / (2 * r + 1);
            const xo = DW.clamp(x - r, 0, w - 1), xi = DW.clamp(x + r + 1, 0, w - 1);
            acc += a[row + xi * ch + c] - a[row + xo * ch + c];
          }
        }
        for (let i = 0; i < w * ch; i++) b[row + i] = tmp[i];
      }
      // vertical
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < ch; c++) {
          let acc = 0;
          for (let k = -r; k <= r; k++) acc += b[DW.clamp(k, 0, h - 1) * w * ch + x * ch + c];
          for (let y = 0; y < h; y++) {
            tmp[y * ch + c] = acc / (2 * r + 1);
            const yo = DW.clamp(y - r, 0, h - 1), yi = DW.clamp(y + r + 1, 0, h - 1);
            acc += b[yi * w * ch + x * ch + c] - b[yo * w * ch + x * ch + c];
          }
        }
        for (let y = 0; y < h; y++) for (let c = 0; c < ch; c++) a[y * w * ch + x * ch + c] = tmp[y * ch + c];
      }
    }
    return a;
  };

  // downsample by integer factor (box)
  DW.downsample = function (src, w, h, ch, f) {
    const w2 = Math.floor(w / f), h2 = Math.floor(h / f);
    const out = new Float32Array(w2 * h2 * ch);
    const inv = 1 / (f * f);
    for (let y = 0; y < h2; y++)
      for (let x = 0; x < w2; x++)
        for (let c = 0; c < ch; c++) {
          let acc = 0;
          for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) acc += src[((y * f + j) * w + x * f + i) * ch + c];
          out[(y * w2 + x) * ch + c] = acc * inv;
        }
    return { data: out, w: w2, h: h2 };
  };

  // bilinear sample of an interleaved float image at pixel coords (x,y), into out
  DW.bilinear = function (img, w, h, ch, x, y, out) {
    x -= 0.5; y -= 0.5;
    if (x < 0) x = 0; if (y < 0) y = 0;
    if (x > w - 1.001) x = w - 1.001; if (y > h - 1.001) y = h - 1.001;
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
    const i00 = (yi * w + xi) * ch, i10 = i00 + ch, i01 = i00 + w * ch, i11 = i01 + ch;
    for (let c = 0; c < ch; c++) {
      const a = img[i00 + c] + (img[i10 + c] - img[i00 + c]) * fx;
      const b = img[i01 + c] + (img[i11 + c] - img[i01 + c]) * fx;
      out[c] = a + (b - a) * fy;
    }
    return out;
  };
})();
