/* Still Life with Lemon — core: seeded PRNG, hashing, gradient noise, small math. */
(function (G) {
  'use strict';
  const Q = (G.Q = G.Q || {});

  Q.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // integer hash -> [0,1)
  Q.hash2i = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  Q.hash3i = function (x, y, z, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // Improved Perlin noise with a seeded permutation
  Q.makeNoise = function (seed) {
    const rnd = Q.mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    function grad3(h, x, y, z) {
      const hh = h & 15;
      const u = hh < 8 ? x : y;
      const v = hh < 4 ? y : (hh === 12 || hh === 14 ? x : z);
      return ((hh & 1) ? -u : u) + ((hh & 2) ? -v : v);
    }
    function grad2(h, x, y) {
      switch (h & 7) {
        case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
        case 4: return x; case 5: return -x; case 6: return y; default: return -y;
      }
    }
    function n3(x, y, z) {
      let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
      x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
      const u = fade(x), v = fade(y), w = fade(z);
      const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      const l = (a, b, t) => a + t * (b - a);
      return l(
        l(l(grad3(perm[AA], x, y, z), grad3(perm[BA], x - 1, y, z), u),
          l(grad3(perm[AB], x, y - 1, z), grad3(perm[BB], x - 1, y - 1, z), u), v),
        l(l(grad3(perm[AA + 1], x, y, z - 1), grad3(perm[BA + 1], x - 1, y, z - 1), u),
          l(grad3(perm[AB + 1], x, y - 1, z - 1), grad3(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    }
    function n2(x, y) {
      let X = Math.floor(x), Y = Math.floor(y);
      x -= X; y -= Y; X &= 255; Y &= 255;
      const u = fade(x), v = fade(y);
      const a = perm[perm[X] + Y], b = perm[perm[X + 1] + Y], c = perm[perm[X] + Y + 1], d = perm[perm[X + 1] + Y + 1];
      const g1 = grad2(a, x, y), g2 = grad2(b, x - 1, y), g3 = grad2(c, x, y - 1), g4 = grad2(d, x - 1, y - 1);
      const l1 = g1 + u * (g2 - g1), l2 = g3 + u * (g4 - g3);
      return (l1 + v * (l2 - l1)) * 0.7;
    }
    function fbm2(x, y, oct, lac, gain) {
      lac = lac || 2.0; gain = gain || 0.5;
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += a * n2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= gain; f *= lac; }
      return s / n;
    }
    function fbm3(x, y, z, oct, lac, gain) {
      lac = lac || 2.0; gain = gain || 0.5;
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += a * n3(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 5.7); n += a; a *= gain; f *= lac; }
      return s / n;
    }
    return { n2, n3, fbm2, fbm3 };
  };

  Q.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  Q.smooth = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  Q.mix = (a, b, t) => a + (b - a) * t;

  // periodic smooth noise over a loop of length L: sum of integer harmonics
  Q.loopNoise = function (seed, kmin, kmax, slope) {
    const r = Q.mulberry32(seed);
    const comps = [];
    let ss = 0;
    for (let k = kmin; k <= kmax; k++) {
      const a = Math.pow(k, -slope) * (0.6 + 0.8 * r());
      comps.push([k, a, r() * Math.PI * 2]);
      ss += a * a * 0.5;
    }
    const norm = 1 / Math.sqrt(ss);
    return function (phase) { // phase in [0,1)
      let s = 0;
      for (let i = 0; i < comps.length; i++) { const c = comps[i]; s += c[1] * Math.sin(2 * Math.PI * c[0] * phase + c[2]); }
      return s * norm; // unit std
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
