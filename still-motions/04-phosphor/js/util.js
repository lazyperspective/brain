// Phosphor: small deterministic helpers (seeded PRNG, value noise, splines). Classic script, global PH namespace.
(function () {
  const PH = (window.PH = window.PH || {});
  const TAU = Math.PI * 2;
  PH.TAU = TAU;

  // mulberry32: seeded PRNG, never Math.random
  PH.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // integer hash -> [0,1)
  function hash2(ix, iy, s) {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  PH.hash2 = hash2;

  // smooth 2D value noise in [-1,1]
  PH.vnoise = function (x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) * 2 - 1;
  };
  PH.fbm = function (x, y, s, oct, lac, gain) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * PH.vnoise(x, y, s + o * 101);
      norm += amp;
      amp *= gain || 0.5;
      x *= lac || 2.03;
      y *= lac || 2.03;
    }
    return sum / norm;
  };

  PH.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  PH.lerp = (a, b, t) => a + (b - a) * t;
  PH.smooth = (a, b, x) => {
    const t = PH.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // centripetal-ish Catmull-Rom through points [[x,y],...], n samples per span; returns flat array of [x,y]
  PH.catmull = function (pts, n, closed) {
    const out = [];
    const N = pts.length;
    const P = (i) => (closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
    const spans = closed ? N : N - 1;
    for (let i = 0; i < spans; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(closed ? [pts[0][0], pts[0][1]] : [pts[N - 1][0], pts[N - 1][1]]);
    return out;
  };

  // cubic bezier sampled with n segments
  PH.bezier = function (p0, p1, p2, p3, n) {
    const out = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  };
})();
