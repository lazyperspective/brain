// Seeded randomness, smooth noise and colour conversion. Nothing in the piece uses Math.random or Date.
(function (G) {
  'use strict';
  function rng(seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + (b - a) * f();
    f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
    f.gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += f(); return (s - 2) * 1.732; };
    return f;
  }
  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1013, 0x85ebca6b)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct) {
    oct = oct || 4;
    let f = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) { f += a * vnoise(x, y, s + i * 17); n += a; x = x * 2.03 + 11.3; y = y * 1.97 + 7.1; a *= 0.5; }
    return f / n;
  }
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055);
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [toLin(((n >> 16) & 255) / 255), toLin(((n >> 8) & 255) / 255), toLin((n & 255) / 255)];
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  G.R = { rng, hash2, vnoise, fbm, toLin, toSrgb, hex, clamp, mix, sstep, mix3, mul3, lum };
})(typeof window !== 'undefined' ? window : globalThis);
