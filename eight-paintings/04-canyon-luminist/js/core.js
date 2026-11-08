// Core utilities: seeded PRNG, gradient noise, fbm, small math helpers.
// Deterministic: everything derives from integer seeds; no Math.random, no Date.
(function (G) {
  'use strict';

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
  function makeRng(seed) {
    const r = sfc32(0x9e3779b9, 0x243f6a88 ^ seed, 0xb7e15162, seed * 2654435761);
    for (let i = 0; i < 24; i++) r();
    const rng = () => r();
    rng.range = (a, b) => a + (b - a) * r();
    rng.int = (a, b) => a + Math.floor((b - a + 1) * r());
    rng.gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = r();
      v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * v);
    };
    rng.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return rng;
  }

  // 2D gradient noise (Perlin style, quintic fade), seeded permutation.
  function makeNoise(seed) {
    const rng = makeRng(seed);
    const perm = new Uint16Array(512);
    const p = new Uint16Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const gx = new Float64Array(256), gy = new Float64Array(256);
    for (let i = 0; i < 256; i++) {
      const a = rng() * Math.PI * 2;
      gx[i] = Math.cos(a); gy[i] = Math.sin(a);
    }
    function n2(x, y) {
      const xf = Math.floor(x), yf = Math.floor(y);
      const X = xf & 255, Y = yf & 255;
      const fx = x - xf, fy = y - yf;
      const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const a = perm[X] + Y, b = perm[X + 1] + Y;
      const g00 = perm[a], g01 = perm[a + 1], g10 = perm[b], g11 = perm[b + 1];
      const d00 = gx[g00] * fx + gy[g00] * fy;
      const d10 = gx[g10] * (fx - 1) + gy[g10] * fy;
      const d01 = gx[g01] * fx + gy[g01] * (fy - 1);
      const d11 = gx[g11] * (fx - 1) + gy[g11] * (fy - 1);
      const x0 = d00 + u * (d10 - d00);
      const x1 = d01 + u * (d11 - d01);
      return (x0 + v * (x1 - x0)) * 1.42;
    }
    function fbm(x, y, oct, lac, gain) {
      lac = lac || 2.03; gain = gain || 0.5;
      let s = 0, a = 1, n = 0;
      for (let i = 0; i < oct; i++) {
        s += a * n2(x, y);
        n += a;
        a *= gain;
        // rotate slightly between octaves to hide grid alignment
        const nx = (x * 0.8 - y * 0.6) * lac + 13.7;
        const ny = (x * 0.6 + y * 0.8) * lac + 7.3;
        x = nx; y = ny;
      }
      return s / n;
    }
    function ridged(x, y, oct) {
      let s = 0, a = 1, n = 0, w = 1;
      for (let i = 0; i < oct; i++) {
        let v = 1 - Math.abs(n2(x, y));
        v *= v;
        s += a * v * w;
        w = Math.min(1, v * 1.6);
        n += a;
        a *= 0.5;
        const nx = (x * 0.8 - y * 0.6) * 2.03 + 3.1;
        const ny = (x * 0.6 + y * 0.8) * 2.03 + 11.9;
        x = nx; y = ny;
      }
      return s / n;
    }
    return { n2, fbm, ridged };
  }

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // separable box-blur approximation of gaussian on Float32 planes (n channels interleaved)
  function blurPlane(src, w, h, ch, radius, passes) {
    passes = passes || 3;
    const r = Math.max(1, Math.round(radius));
    let a = src, b = new Float32Array(src.length);
    const line = new Float32Array(Math.max(w, h) * ch);
    for (let p = 0; p < passes; p++) {
      // horizontal
      for (let y = 0; y < h; y++) {
        const off = y * w * ch;
        for (let c = 0; c < ch; c++) {
          let acc = 0;
          for (let i = -r; i <= r; i++) acc += a[off + clamp(i, 0, w - 1) * ch + c];
          for (let x = 0; x < w; x++) {
            line[x * ch + c] = acc / (2 * r + 1);
            acc += a[off + Math.min(w - 1, x + r + 1) * ch + c] - a[off + Math.max(0, x - r) * ch + c];
          }
        }
        for (let i = 0; i < w * ch; i++) b[off + i] = line[i];
      }
      // vertical
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < ch; c++) {
          let acc = 0;
          for (let i = -r; i <= r; i++) acc += b[clamp(i, 0, h - 1) * w * ch + x * ch + c];
          for (let y = 0; y < h; y++) {
            line[y] = acc / (2 * r + 1);
            acc += b[Math.min(h - 1, y + r + 1) * w * ch + x * ch + c] - b[Math.max(0, y - r) * w * ch + x * ch + c];
          }
          for (let y = 0; y < h; y++) a === src && p === 0 ? (b[y * w * ch + x * ch + c] = line[y]) : (b[y * w * ch + x * ch + c] = line[y]);
        }
      }
      if (p === 0 && a === src) { a = b; b = new Float32Array(src.length); }
      else { const t = a; a = b; b = t; }
    }
    return a;
  }

  G.CORE = { makeRng, makeNoise, clamp, mix, smooth, blurPlane };
})(typeof window !== 'undefined' ? window : globalThis);
