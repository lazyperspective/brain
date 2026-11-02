// Seeded randomness and noise for "The Blue House". Nothing here calls Math.random: every value is a pure
// function of a seed (and, for animation, of the loop time t).
(function () {
  const CY = (window.CY = window.CY || {});
  CY.W = 1080;
  CY.H = 1920;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // a small PRNG object: f() in [0,1), r(a,b), i(a,b) inclusive, g() ~N(0,1)-ish, pick(arr), sign()
  CY.rng = function (seed) {
    const f = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
    for (let k = 0; k < 4; k++) f();
    return {
      f,
      r: (a, b) => a + (b - a) * f(),
      i: (a, b) => Math.floor(a + (b - a + 1) * f()),
      g: () => (f() + f() + f() + f() - 2) * 1.732,
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      sign: () => (f() < 0.5 ? -1 : 1),
    };
  };

  function hash(ix, iy, s) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  CY.hash = hash;
  CY.vnoise = function (x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  CY.fbm = function (x, y, s, oct) {
    oct = oct || 4;
    let v = 0, a = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { v += a * CY.vnoise(x, y, s + o * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
    return v / n;
  };
  CY.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  CY.sm = (a, b, x) => { const u = CY.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  CY.lerp = (a, b, u) => a + (b - a) * u;

  // A smooth periodic signal in about [-1, 1] with period D: a sum of sines whose frequencies are whole
  // multiples of 1/D, so f(t + D) == f(t) exactly. kmin..kmax pick the harmonics (higher = quicker).
  CY.loopFn = function (D, seed, kmin, kmax, tilt) {
    const R = CY.rng(seed), A = [], P = [], K = [];
    let n = 0;
    tilt = tilt == null ? 0.9 : tilt;
    for (let k = kmin; k <= kmax; k++) { const a = (0.6 + 0.8 * R.f()) / Math.pow(k, tilt); K.push(k); A.push(a); P.push(R.f() * 6.2832); n += (a * a) / 2; }
    const norm = 1 / (2.2 * Math.sqrt(n));
    return function (t) {
      let v = 0;
      for (let i = 0; i < K.length; i++) v += A[i] * Math.sin((6.2832 * K[i] * t) / D + P[i]);
      return v * norm * 2.2 * 0.45;
    };
  };
  // shortest signed distance on a circle of length D
  CY.wrapd = (t, c, D) => { let d = (((t - c) % D) + D) % D; if (d > D / 2) d -= D; return d; };
  CY.mod = (t, D) => ((t % D) + D) % D;

  // Full-frame texture fields, shared by every painted layer so pigment, paper tooth and grain agree:
  //   grain - fine paper tooth (1-3 px), mot - broad mottling (~90 px), edge - mid noise for ragged edges (~14 px)
  CY.makeFields = function () {
    const W = CY.W, H = CY.H, N = W * H;
    const grain = new Float32Array(N), mot = new Float32Array(N), edge = new Float32Array(N);
    // coarse lattices evaluated once, then bilinear sampled: far cheaper than per-pixel fbm
    function lattice(step, seed, oct) {
      const lw = Math.ceil(W / step) + 2, lh = Math.ceil(H / step) + 2, L = new Float32Array(lw * lh);
      for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) L[y * lw + x] = CY.fbm(x * 0.5, y * 0.5, seed, oct);
      return { L, lw, step };
    }
    function sample(lt, x, y) {
      const fx = x / lt.step, fy = y / lt.step, ix = fx | 0, iy = fy | 0, u = fx - ix, v = fy - iy, w = lt.lw, L = lt.L;
      const a = L[iy * w + ix], b = L[iy * w + ix + 1], c = L[(iy + 1) * w + ix], d = L[(iy + 1) * w + ix + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    const lm = lattice(45, 301, 5), le = lattice(7, 302, 3), lf = lattice(3, 303, 2);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        mot[i] = sample(lm, x, y);
        edge[i] = sample(le, x, y);
        // tooth: white noise + a slightly stretched fine noise, like the fibres of a rice paper
        grain[i] = 0.45 * hash(x, y, 77) + 0.35 * sample(lf, x, y) + 0.2 * CY.vnoise(x * 0.09, y * 0.5, 78);
      }
    }
    // re-centre each field to about [0,1]
    for (const f of [mot, edge, grain]) {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < N; i += 7) { if (f[i] < lo) lo = f[i]; if (f[i] > hi) hi = f[i]; }
      const k = 1 / (hi - lo);
      for (let i = 0; i < N; i++) f[i] = CY.clamp((f[i] - lo) * k, 0, 1);
    }
    CY.F = { grain, mot, edge };
  };
})();
