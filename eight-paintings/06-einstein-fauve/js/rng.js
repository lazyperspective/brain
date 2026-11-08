// Seeded randomness and noise. No Math.random anywhere in this piece.
(function (G) {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function RNG(seed) {
    const r = mulberry32(seed >>> 0);
    const o = {
      next: r,
      range: (a, b) => a + (b - a) * r(),
      int: (a, b) => a + Math.floor((b - a + 1) * r()),
      chance: (p) => r() < p,
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      gauss: () => {
        let u = 0, v = 0;
        while (u === 0) u = r();
        v = r();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v);
      },
      fork: (k) => RNG(((r() * 4294967296) >>> 0) ^ (k * 2654435761 >>> 0)),
    };
    return o;
  }

  // 2D gradient noise (Perlin-style) with seeded permutation.
  function Noise(seed) {
    const rng = RNG(seed);
    const p = new Uint8Array(512);
    const perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const gx = new Float32Array(256), gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const a = rng.next() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = p[p[X] + Y], b = p[p[X + 1] + Y], c = p[p[X] + Y + 1], d = p[p[X + 1] + Y + 1];
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      const va = gx[a] * xf + gy[a] * yf;
      const vb = gx[b] * (xf - 1) + gy[b] * yf;
      const vc = gx[c] * xf + gy[c] * (yf - 1);
      const vd = gx[d] * (xf - 1) + gy[d] * (yf - 1);
      const x1 = va + (vb - va) * u, x2 = vc + (vd - vc) * u;
      return (x1 + (x2 - x1) * v) * 1.41;
    }
    function fbm(x, y, oct, lac, gain) {
      oct = oct || 4; lac = lac || 2; gain = gain || 0.5;
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); n += a; a *= gain; f *= lac; }
      return s / n;
    }
    function n1(x) { return n2(x, 0.37); }
    return { n2, n1, fbm };
  }

  G.RNG = RNG;
  G.Noise = Noise;
})(window);
