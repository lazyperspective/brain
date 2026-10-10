/* Ten Hands — 08 · Garden Room, Fragment with a Jay
 *
 * Two hands at once. A Roman garden painter of the first century BC, working fast in wet lime,
 * and the two thousand years that took most of it away — with a conservator who would not
 * invent what was lost. The painting is built as a layered object: arriccio with its red sinopia
 * underdrawing, a painted intonaco with brush relief, losses, cracks, neutral fills and Brandi-style
 * tratteggio. A height map of all of it is lit once by a soft gallery light from above.
 */
(function () {
  'use strict';

  /* ================================================================== basics */
  const TAU = Math.PI * 2;
  const ROOM = '#3b3732';
  const CANCEL = { cancelled: true };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  function sstep(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function RNG(seed, name) {
    const r = mulberry32((seed ^ hashStr(name)) >>> 0);
    const f = () => r();
    f.r = (a, b) => a + (b - a) * r();
    f.n = () => (r() + r() + r() + r() - 2) * 1.732;
    f.pick = (a) => a[(r() * a.length) | 0];
    return f;
  }
  function ih(x, y, s) {
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((y | 0) + 0x3c6ef372, 0x165667b1) ^ Math.imul(s + 0x6a09e667, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function Noise(seed) {
    const r = mulberry32(seed >>> 0), p = new Uint16Array(512), v = new Float32Array(256);
    for (let i = 0; i < 256; i++) { p[i] = i; v[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    function n(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
      const a = v[p[p[X] + Y]], b = v[p[p[X + 1] + Y]], c = v[p[p[X] + Y + 1]], d = v[p[p[X + 1] + Y + 1]];
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    }
    n.fbm = function (x, y, o) {
      let s = 0, a = 1, t = 0;
      for (let i = 0; i < o; i++) { s += a * n(x, y); t += a; a *= 0.5; x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; }
      return s / t;
    };
    return n;
  }

  /* ----------------------------------------------------------------- colour */
  function css(c, a) {
    return 'rgba(' + clamp(c[0] | 0, 0, 255) + ',' + clamp(c[1] | 0, 0, 255) + ',' + clamp(c[2] | 0, 0, 255) + ',' +
      (a === undefined ? 1 : Math.round(clamp(a, 0, 1) * 1000) / 1000) + ')';
  }
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function jit(c, rng, a) {
    const l = (rng() - 0.5) * a;
    return [c[0] + l + (rng() - 0.5) * a * 0.55, c[1] + l + (rng() - 0.5) * a * 0.55, c[2] + l + (rng() - 0.5) * a * 0.55];
  }
  function ramp(stops, t) {
    t = clamp(t, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    return mixc(stops[i], stops[i + 1], t - i);
  }

  /* --------------------------------------------------------------- geometry */
  function spline(pts, seg) {
    const out = [], n = pts.length;
    if (n < 3) {
      for (let k = 0; k <= seg; k++) { const t = k / seg; out.push([lerp(pts[0][0], pts[n - 1][0], t), lerp(pts[0][1], pts[n - 1][1], t)]); }
      return out;
    }
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  function strokePath(pts, w0, w1, ti, to) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const t = n > 1 ? i / (n - 1) : 0;
      let w = (w0 + (w1 - w0) * t) * 0.5;
      if (ti) w *= 0.18 + 0.82 * sstep(0, ti, t);
      if (to) w *= 0.12 + 0.88 * sstep(1, 1 - to, t);
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
      R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const p = new Path2D();
    p.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
    p.closePath();
    return p;
  }
  function leafPath(x, y, ang, len, wid, bend, asym) {
    const ca = Math.cos(ang), sa = Math.sin(ang), p = new Path2D();
    const X = (lx, ly) => x + lx * ca - ly * sa, Y = (lx, ly) => y + lx * sa + ly * ca;
    const ty = bend * len * 0.3, w1 = wid * (1 + asym), w2 = wid * (1 - asym), bb = bend * len;
    p.moveTo(X(0, -wid * 0.2), Y(0, -wid * 0.2));
    p.bezierCurveTo(X(len * 0.22, -w1 * 1.05 + bb * 0.06), Y(len * 0.22, -w1 * 1.05 + bb * 0.06),
      X(len * 0.66, -w1 * 0.72 + bb * 0.24), Y(len * 0.66, -w1 * 0.72 + bb * 0.24), X(len, ty), Y(len, ty));
    p.bezierCurveTo(X(len * 0.66, w2 * 0.72 + bb * 0.24), Y(len * 0.66, w2 * 0.72 + bb * 0.24),
      X(len * 0.22, w2 * 1.05 + bb * 0.06), Y(len * 0.22, w2 * 1.05 + bb * 0.06), X(0, wid * 0.2), Y(0, wid * 0.2));
    p.quadraticCurveTo(X(-wid * 0.35, 0), Y(-wid * 0.35, 0), X(0, -wid * 0.2), Y(0, -wid * 0.2));
    return p;
  }
  function fractalPoly(rng, pts, levels, rough, minLen) {
    let P = pts.slice();
    for (let l = 0; l < levels; l++) {
      const Q = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        Q.push(a);
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        if (d < minLen) continue;
        const t = 0.5 + (rng() - 0.5) * 0.35, off = (rng() - 0.5) * 2 * rough * d;
        Q.push([a[0] + dx * t - (dy / d) * off, a[1] + dy * t + (dx / d) * off]);
      }
      P = Q;
    }
    return P;
  }
  function blobPoly(rng, cx, cy, rx, ry, n, irr, rot) {
    const pts = [], ph = rng() * TAU, cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (let k = 0; k < n; k++) {
      const a = ph + (k / n) * TAU + (rng() - 0.5) * (TAU / n) * 0.5;
      const r = 1 + (rng() - 0.5) * 2 * irr;
      const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
      pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return pts;
  }
  function polyPath(P) {
    const p = new Path2D();
    p.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) p.lineTo(P[i][0], P[i][1]);
    p.closePath();
    return p;
  }
  function inPoly(P, x, y) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
    }
    return c;
  }

  /* ================================================================ painter */
  function Painter(c, seed) { this.c = c; this.r = mulberry32(seed >>> 0); }
  Painter.prototype.fill = function (path, col, a) { this.c.fillStyle = css(col, a); this.c.fill(path); };
  // a loaded brush: a translucent body and a few bristle tracks that run out at different points
  Painter.prototype.brush = function (ctrl, w0, w1, col, a, nb, dense) {
    const pts = dense ? ctrl : spline(ctrl, 7), n = pts.length, R = this.r;
    if (n < 2) return;
    this.fill(strokePath(pts, w0, w1, 0.25, 0.4), col, a * 0.62);
    const N = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const d = Math.hypot(dx, dy) || 1;
      N.push([-dy / d, dx / d]);
    }
    nb = nb || 4;
    for (let b = 0; b < nb; b++) {
      const off = (R() - 0.5) * 0.85, wb = 0.14 + R() * 0.2;
      const i0 = Math.floor(R() * 0.2 * (n - 1)), i1 = Math.max(i0 + 1, Math.floor((1 - R() * 0.35) * (n - 1)));
      const sub = [];
      for (let i = i0; i <= i1; i++) { const w = lerp(w0, w1, i / (n - 1)) * 0.5 * off; sub.push([pts[i][0] + N[i][0] * w, pts[i][1] + N[i][1] * w]); }
      const l = (R() - 0.5) * 34;
      this.fill(strokePath(sub, w0 * wb, w1 * wb, 0.2, 0.5), [col[0] + l, col[1] + l, col[2] + l * 0.9], a * (0.3 + R() * 0.4));
    }
  };
  Painter.prototype.line = function (pts, w0, w1, col, a, imp, ti, to) {
    this.fill(strokePath(pts, w0, w1, ti === undefined ? 0.3 : ti, to === undefined ? 0.45 : to), col, a);
  };
  Painter.prototype.curve = function (ctrl, w0, w1, col, a, imp, ti, to) { this.line(spline(ctrl, 7), w0, w1, col, a, imp, ti, to); };
  Painter.prototype.leaf = function (x, y, ang, len, wid, bend, asym, col, a) { this.fill(leafPath(x, y, ang, len, wid, bend, asym), col, a); };
  Painter.prototype.dot = function (x, y, rx, ry, rot, col, a) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); this.fill(p, col, a); };

  /* ================================================================== scene
   * Garden coordinates: v runs 0 (top of the fragment) to 1 (bottom); u is horizontal, same unit.
   * The fragment is a window [u0, u0 + A] onto an endless painted garden. */
  const SKY = [[56, 106, 152], [78, 130, 168], [110, 154, 176], [130, 168, 172]];
  const skyAt = (v) => ramp(SKY, clamp(v / 0.6, 0, 1));
  const FT = 0.668, FBOT = 0.886, DADO = 0.912;

  const SPECIES = {
    quince: { len: 0.0205, wid: 0.0078, bend: 0.25, per: [3, 6], twig: 1.35, droop: 0.12,
      pal: [[30, 42, 34], [52, 68, 50], [76, 92, 62], [108, 120, 80], [144, 148, 98], [190, 186, 136]], silver: [140, 148, 128], hi: [234, 226, 178] },
    pomegranate: { len: 0.0178, wid: 0.0041, bend: 0.22, per: [5, 9], twig: 1.7, droop: 0.08,
      pal: [[24, 38, 28], [40, 62, 40], [60, 84, 50], [94, 116, 60], [130, 142, 76], [182, 184, 112]], hi: [228, 222, 156] },
    laurel: { len: 0.023, wid: 0.0058, bend: 0.16, per: [4, 7], twig: 1.3, droop: 0.18,
      pal: [[18, 28, 25], [30, 44, 37], [44, 60, 48], [66, 82, 60], [92, 104, 74], [146, 152, 112]], hi: [200, 204, 154] },
    oleander: { len: 0.032, wid: 0.0039, bend: 0.32, per: [5, 8], twig: 0.9, droop: 0.32, whorl: true,
      pal: [[34, 46, 40], [54, 68, 58], [74, 88, 72], [100, 114, 90], [128, 138, 108], [178, 182, 148]], hi: [218, 218, 184] },
    myrtle: { len: 0.0125, wid: 0.0045, bend: 0.12, per: [6, 10], twig: 2.0, droop: 0.06,
      pal: [[20, 32, 30], [32, 48, 42], [46, 64, 54], [70, 88, 68], [98, 110, 82], [156, 162, 124]], hi: [210, 212, 170] },
  };

  for (const k in SPECIES) { const pl = SPECIES[k].pal; pl[0] = pl[0].map((v) => v * 0.7); pl[1] = pl[1].map((v) => v * 0.84); pl[2] = pl[2].map((v) => v * 0.94); }

  const TREES = [
    { id: 'myrW', sp: 'laurel', trunks: [[[-0.24, 0.62], [-0.245, 0.45], [-0.24, 0.36]]],
      lobes: [[-0.36, 0.16, 0.1, 0.1], [-0.24, 0.07, 0.11, 0.1], [-0.12, 0.17, 0.09, 0.09], [-0.27, 0.26, 0.1, 0.08], [-0.15, 0.3, 0.07, 0.06]] },
    { id: 'pom', sp: 'pomegranate',
      trunks: [[[0.31, 0.62], [0.305, 0.52], [0.29, 0.45], [0.30, 0.40]], [[0.325, 0.62], [0.34, 0.52], [0.36, 0.44], [0.37, 0.38]]],
      branches: [[[0.30, 0.40], [0.22, 0.30], [0.15, 0.22], [0.10, 0.18]], [[0.30, 0.40], [0.27, 0.26], [0.25, 0.12], [0.23, 0.02]],
        [[0.37, 0.38], [0.40, 0.25], [0.42, 0.12], [0.40, 0.0]], [[0.37, 0.38], [0.45, 0.30], [0.51, 0.22]], [[0.30, 0.42], [0.20, 0.40], [0.12, 0.38]]],
      lobes: [[0.12, 0.27, 0.09, 0.085], [0.20, 0.14, 0.11, 0.1], [0.33, 0.05, 0.12, 0.1], [0.45, 0.15, 0.1, 0.1], [0.27, 0.28, 0.11, 0.09],
        [0.42, 0.32, 0.09, 0.075], [0.14, 0.38, 0.07, 0.055], [0.51, 0.27, 0.06, 0.07], [0.19, 0.45, 0.08, 0.06], [0.31, 0.42, 0.1, 0.08],
        [0.43, 0.45, 0.08, 0.06], [0.525, 0.39, 0.05, 0.065]],
      fruit: 'pomegranate', nFruit: 12, flowers: 'pomflower', nFlower: 7 },
    { id: 'quince', sp: 'quince', trunks: [[[1.09, 0.62], [1.08, 0.52], [1.065, 0.46], [1.06, 0.415]]],
      branches: [[[1.06, 0.415], [1.03, 0.33], [0.98, 0.24], [0.92, 0.14]], [[1.06, 0.415], [1.07, 0.30], [1.09, 0.18], [1.08, 0.04]],
        [[1.06, 0.415], [1.12, 0.36], [1.2, 0.28], [1.29, 0.22]], [[1.09, 0.25], [1.16, 0.14], [1.22, 0.06]], [[1.03, 0.33], [0.94, 0.30], [0.86, 0.27]]],
      perch: [[1.064, 0.418], [1.0, 0.428], [0.94, 0.432], [0.885, 0.42], [0.83, 0.398], [0.78, 0.372]],
      lobes: [[0.86, 0.21, 0.09, 0.08], [0.95, 0.11, 0.11, 0.1], [1.08, 0.06, 0.12, 0.1], [1.21, 0.11, 0.11, 0.1], [1.30, 0.21, 0.08, 0.08],
        [0.98, 0.245, 0.09, 0.07], [1.12, 0.23, 0.1, 0.08], [1.22, 0.29, 0.07, 0.055], [0.765, 0.352, 0.04, 0.03],
        [1.165, 0.39, 0.075, 0.08], [1.26, 0.41, 0.075, 0.08], [1.15, 0.5, 0.06, 0.05], [1.33, 0.33, 0.06, 0.07]],
      fruit: 'quince', nFruit: 10 },
    { id: 'oleT', sp: 'oleander', trunks: [[[1.62, 0.62], [1.62, 0.47], [1.615, 0.38]]],
      lobes: [[1.50, 0.26, 0.07, 0.07], [1.58, 0.17, 0.09, 0.085], [1.68, 0.22, 0.09, 0.09], [1.62, 0.33, 0.1, 0.07], [1.75, 0.32, 0.07, 0.06], [1.52, 0.36, 0.06, 0.05],
        [1.56, 0.45, 0.08, 0.07], [1.69, 0.44, 0.08, 0.07]],
      flowers: 'oleander', nFlower: 16 },
  ];

  const LP = (() => { const l = Math.hypot(-0.55, -0.7, 0.45); return [-0.55 / l, -0.7 / l, 0.45 / l]; })();

  function buildScene(seed, A, u0) {
    const sc = { A, u0, uL: u0 - 0.1, uR: u0 + A + 0.1, seed };
    sc.inWin = (u, pad) => u > u0 - (pad || 0.12) && u < u0 + A + (pad || 0.12);
    const vis = (lobes) => {
      let a = 9, b = -9;
      for (const l of lobes) { a = Math.min(a, l[0] - l[2]); b = Math.max(b, l[0] + l[2]); }
      return !(b < u0 - 0.05 || a > u0 + A + 0.05);
    };
    sc.trees = TREES.filter((d) => vis(d.lobes)).map((d) => growPlant(RNG(seed, 'tree' + d.id), d));
    // a continuous row of shrubs behind the fence
    sc.shrubs = [];
    const shr = RNG(seed, 'shrubs');
    const kinds = ['laurel', 'myrtle', 'oleander', 'myrtle', 'laurel', 'oleander', 'myrtle'];
    let ki = (shr() * kinds.length) | 0;
    for (let u = sc.uL - 0.08; u < sc.uR + 0.08;) {
      const w = shr.r(0.075, 0.115);
      let sp = kinds[ki++ % kinds.length];
      if (u > 0.47 && u < 0.75) sp = 'laurel';
      const top = shr.r(0.475, 0.54) + (u > 0.47 && u < 0.75 ? -0.03 : 0);
      const lobes = [[u, top + 0.05, w * 0.75, 0.05]];
      const nl = 3 + ((shr() * 2) | 0);
      for (let k = 0; k < nl; k++) lobes.push([u + shr.r(-w * 0.85, w * 0.85), top + 0.07 + k * 0.035 + shr.r(-0.01, 0.01), w * shr.r(0.6, 0.9), shr.r(0.045, 0.06)]);
      if (vis(lobes)) {
        sc.shrubs.push(growPlant(RNG(seed, 'shrub' + sc.shrubs.length), {
          id: 'shrub', sp, trunks: [], lobes, flowers: sp === 'oleander' ? 'oleander' : sp === 'myrtle' ? 'myrtle' : null, nFlower: sp === 'oleander' ? 5 : 9,
        }));
      }
      u += w * shr.r(1.25, 1.6);
    }
    sc.jay = { x: 0.844, y: 0.315, s: 0.215 };
    sc.basin = { x: 0.60, y: 0.585, rx: 0.095, ry: 0.016 };
    sc.dove = { x: 0.6007, y: 0.5047, s: 0.15 };
    sc.finch = { x: 0.80, y: 0.624, s: 0.06 };
    sc.warbler = { x: 1.455, y: 0.322, s: 0.07 };
    const w1 = clamp(0.33 * A, 0.18, 0.55);
    sc.w1 = w1;
    sc.lost = { x: u0 + 0.42 * w1, y: 0.115, s: 0.1 };
    const sr = RNG(seed, 'swallow');
    sc.swallow = A >= 1 ? { x: 0.625 + sr.r(-0.015, 0.015), y: 0.1 + sr.r(0, 0.03), s: 0.1, tilt: sr.r(-0.2, 0.1) }
      : { x: u0 + A * 0.1, y: 0.4 + sr.r(-0.02, 0.02), s: 0.08, tilt: sr.r(-0.15, 0.05) };
    sc.flowers = growFlowers(RNG(seed, 'flowers'), sc);
    sc.posts = [];
    const pr = RNG(seed, 'posts');
    for (let u = -0.47; u < 2.3; u += 0.31 + pr.r(-0.02, 0.02)) sc.posts.push(u);
    return sc;
  }

  function growPlant(rng, def) {
    const sp = SPECIES[def.sp], P = { def, sp, sprays: [], under: [], fruits: [], flowers: [], branches: [] };
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const l of def.lobes) { x0 = Math.min(x0, l[0] - l[2]); x1 = Math.max(x1, l[0] + l[2]); y0 = Math.min(y0, l[1] - l[3]); y1 = Math.max(y1, l[1] + l[3]); }
    const ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2, crx = (x1 - x0) / 2, cry = (y1 - y0) / 2;
    P.bbox = [x0, y0, x1, y1];
    const depthAt = (x, y) => {
      let best = -9, bl = def.lobes[0];
      for (const l of def.lobes) {
        const dx = (x - l[0]) / l[2], dy = (y - l[1]) / l[3], d = 1 - (dx * dx + dy * dy);
        if (d > best) { best = d; bl = l; }
      }
      return [best, bl];
    };
    const br = def.branches ? def.branches.slice() : [];
    if (!def.branches && def.trunks.length) {
      const t0 = def.trunks[0][def.trunks[0].length - 1];
      for (const l of def.lobes) br.push([t0, [lerp(t0[0], l[0], 0.5) + rng.r(-0.01, 0.01), lerp(t0[1], l[1], 0.6)], [l[0] + rng.r(-0.02, 0.02), l[1] + rng.r(-0.02, 0.01)]]);
    }
    P.branches = br;
    for (const l of def.lobes) {
      const n = Math.round((Math.PI * l[2] * l[3]) / 0.00045);
      for (let k = 0; k < n; k++) {
        const a = rng() * TAU, r = Math.sqrt(rng()) * 0.86;
        const x = l[0] + Math.cos(a) * l[2] * r, y = l[1] + Math.sin(a) * l[3] * r;
        P.under.push({ x, y, a: rng() * TAU, l: rng.r(0.028, 0.05), w: rng.r(0.009, 0.017), t: rng() });
      }
    }
    const area = (x1 - x0) * (y1 - y0), N = Math.round(area / 0.00032);
    for (let k = 0; k < N; k++) {
      const x = rng.r(x0, x1), y = rng.r(y0, y1);
      const [d, l] = depthAt(x, y);
      if (d < -0.08) continue;
      if (d > 0.4 && rng() < 0.3) continue;
      const dx = (x - l[0]) / l[2], dy = (y - l[1]) / l[3], nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      const lfL = dx * LP[0] + dy * LP[1] + nz * LP[2];
      const gx = (x - ccx) / crx, gy = (y - ccy) / cry, gz = Math.sqrt(Math.max(0, 1 - gx * gx - gy * gy));
      const lfC = gx * LP[0] + gy * LP[1] + gz * LP[2];
      const tone = clamp(0.3 + 0.46 * lfL + 0.32 * lfC + rng.n() * 0.13 - (d > 0.5 ? 0.18 : 0), 0, 1);
      let ang = Math.atan2(dy * l[3], dx * l[2]);
      if (d > 0.6) ang = rng() * TAU;
      ang += rng.n() * 0.45;
      ang += Math.cos(ang) > 0 ? sp.droop : -sp.droop;
      P.sprays.push({ x, y, ang, tone, d, n: Math.round(rng.r(sp.per[0], sp.per[1] + 0.99)), seed: (rng() * 1e9) | 0 });
    }
    P.sprays.sort((a, b) => a.tone - b.tone);
    const pickOuter = (n, minTone) => {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < 5000) {
        const x = rng.r(x0, x1), y = rng.r(y0, y1);
        const [d] = depthAt(x, y);
        if (d < 0.05 || d > 0.6) continue;
        if (out.some((o) => Math.hypot(o[0] - x, o[1] - y) < 0.032)) continue;
        const gx = (x - ccx) / crx, gy = (y - ccy) / cry;
        if (gx * LP[0] + gy * LP[1] < minTone) continue;
        out.push([x, y, rng()]);
      }
      return out;
    };
    if (def.fruit) P.fruits = pickOuter(def.nFruit, -0.55);
    if (def.flowers) P.flowers = pickOuter(def.nFlower, -0.75);
    return P;
  }

  function growFlowers(rng, sc) {
    const F = { poppies: [], cham: [], grass: [], blue: [] };
    // poppies come up in clumps, with bare stretches between them
    for (let u = sc.uL + rng.r(0, 0.1); u < sc.uR; u += rng.r(0.13, 0.3)) {
      const n = 2 + ((rng() * 4) | 0);
      for (let k = 0; k < n; k++) F.poppies.push({ x: u + rng.n() * 0.02, h: rng.r(0.05, 0.17) * (k === 0 ? 1.15 : 1), lean: rng.r(-0.28, 0.28), bud: rng() < 0.22, size: rng.r(0.85, 1.35), seed: (rng() * 1e9) | 0 });
    }
    // chamomile in drifts
    for (let u = sc.uL; u < sc.uR; u += rng.r(0.05, 0.15)) {
      const n = 2 + ((rng() * 7) | 0);
      for (let k = 0; k < n; k++) F.cham.push({ x: u + rng.n() * 0.02, y: rng.r(0.858, 0.902), r: rng.r(0.0042, 0.0068), seed: (rng() * 1e9) | 0 });
    }
    for (let u = sc.uL; u < sc.uR; u += rng.r(0.002, 0.009)) F.grass.push({ x: u, h: rng.r(0.014, 0.055), lean: rng.r(-0.55, 0.55), t: rng() });
    for (let u = sc.uL; u < sc.uR; u += rng.r(0.1, 0.3)) {
      F.blue.push({ x: u, y: rng.r(0.862, 0.892), seed: (rng() * 1e9) | 0 });
      if (rng() < 0.5) F.blue.push({ x: u + rng.r(0.008, 0.016), y: rng.r(0.862, 0.892), seed: (rng() * 1e9) | 0 });
    }
    return F;
  }

  /* ================================================================ painting */
  function paintSky(P, sc, rng) {
    const c = P.c;
    const g = c.createLinearGradient(0, 0, 0, 0.62);
    SKY.forEach((col, k) => g.addColorStop(k / (SKY.length - 1), css(col)));
    c.fillStyle = g;
    c.fillRect(sc.uL - 0.1, -0.05, sc.uR - sc.uL + 0.2, 1.1);
    // the ground coat: many broad, quick, overlapping sweeps of one blue
    const n = Math.round((sc.uR - sc.uL) * 420);
    for (let k = 0; k < n; k++) {
      const u = rng.r(sc.uL, sc.uR), v = rng.r(-0.02, 0.66);
      const len = rng.r(0.05, 0.14), w = rng.r(0.014, 0.03), a = rng.r(-0.8, 0.8) + (rng() < 0.3 ? 1.2 : 0), bend = rng.r(-0.03, 0.03);
      const base = skyAt(v);
      const tint = rng() < 0.5 ? [50, 98, 160] : rng() < 0.6 ? [124, 166, 184] : [96, 144, 176];
      const col = jit(mixc(base, tint, rng.r(0.05, 0.3)), rng, 7);
      const ca = Math.cos(a), sa = Math.sin(a), pts = [];
      for (let t = 0; t <= 5; t++) { const s = (t / 5 - 0.5) * len, o = bend * Math.sin((t / 5) * Math.PI); pts.push([u + ca * s - sa * o, v + sa * s + ca * o]); }
      P.brush(pts, w, w * 0.7, col, rng.r(0.07, 0.15), 3, true);
    }
  }

  function paintGround(P, sc, rng) {
    // the grass walk behind the fence, dark under the shrubs
    const c = P.c, g = c.createLinearGradient(0, 0.6, 0, FBOT);
    g.addColorStop(0, css([44, 58, 42])); g.addColorStop(0.5, css([48, 62, 44])); g.addColorStop(1, css([32, 42, 30]));
    c.fillStyle = g;
    c.fillRect(sc.uL - 0.1, 0.62, sc.uR - sc.uL + 0.2, FBOT - 0.62 + 0.01);
    const N = Math.round((sc.uR - sc.uL) * 900);
    for (let k = 0; k < N; k++) {
      const u = rng.r(sc.uL, sc.uR), v = rng.r(0.6, FBOT);
      const t = (v - 0.6) / (FBOT - 0.6);
      const col = jit(mixc([72, 92, 62], [30, 42, 30], t * 0.8 + rng() * 0.3), rng, 10);
      P.leaf(u, v, -Math.PI / 2 + rng.n() * 0.35, rng.r(0.012, 0.028), rng.r(0.0018, 0.0034), rng.r(-0.3, 0.3), 0, col, rng.r(0.5, 0.85));
    }
  }

  function paintTrunks(P, pl) {
    const bark = [[74, 60, 50], [100, 84, 66], [146, 128, 102], [44, 36, 32]];
    for (const t of pl.def.trunks) {
      const pts = spline(t, 8);
      const w = pl.def.sp === 'oleander' ? 0.008 : pl.def.sp === 'laurel' ? 0.011 : 0.02;
      P.line(pts, w, w * 0.6, bark[3], 0.95, 0, 0, 0.1);
      P.brush(pts.map((p) => [p[0] - w * 0.18, p[1]]), w * 0.6, w * 0.32, bark[1], 0.9, 5, true);
      P.brush(pts.map((p) => [p[0] - w * 0.3, p[1]]), w * 0.2, w * 0.1, bark[2], 0.8, 2, true);
    }
  }
  function paintBranches(P, pl, only) {
    const bark = [[56, 44, 38], [98, 82, 64], [148, 130, 104]];
    const list = only ? [only] : pl.branches;
    for (const b of list) {
      const pts = spline(b, 8);
      const w = pl.def.sp === 'oleander' || pl.def.sp === 'laurel' ? 0.005 : 0.0105;
      P.line(pts, w, w * 0.3, bark[0], 0.92, 0, 0, 0.6);
      P.brush(pts.map((p) => [p[0] - w * 0.12, p[1] - w * 0.14]), w * 0.5, w * 0.12, bark[1], 0.85, 3, true);
      P.line(pts.map((p) => [p[0] - w * 0.22, p[1] - w * 0.26]), w * 0.16, w * 0.05, bark[2], 0.65, 0, 0.3, 0.6);
    }
  }
  function paintUnder(P, pl, rng) {
    const pal = pl.sp.pal;
    for (const u of pl.under) {
      const col = jit(mixc(pal[0], pal[1], u.t * 0.7), rng, 6);
      P.leaf(u.x - Math.cos(u.a) * u.l * 0.5, u.y - Math.sin(u.a) * u.l * 0.5, u.a, u.l, u.w, rng.r(-0.3, 0.3), 0, col, 0.82);
    }
  }
  function paintSprays(P, pl, from, to) {
    const sp = pl.sp, pal = sp.pal;
    for (let k = from; k < to && k < pl.sprays.length; k++) {
      const s = pl.sprays[k], R = mulberry32(s.seed);
      const base = ramp(pal.slice(0, 5), s.tone);
      const tw = sp.len * sp.twig, ca = Math.cos(s.ang), sa = Math.sin(s.ang);
      const tx = s.x + ca * tw, ty = s.y + sa * tw;
      if (s.tone < 0.7 && R() < 0.5) P.line([[s.x, s.y], [lerp(s.x, tx, 0.5) + (R() - 0.5) * 0.003, lerp(s.y, ty, 0.5) + (R() - 0.5) * 0.003], [tx, ty]], 0.0018, 0.0007, mixc(base, [70, 56, 44], 0.6), 0.6, 0, 0, 0.5);
      for (let j = 0; j < s.n; j++) {
        if (R() < 0.08) continue;
        const t = s.n === 1 ? 1 : j / (s.n - 1), side = j % 2 ? 1 : -1;
        let la = s.ang + side * (sp.whorl ? 0.55 + R() * 0.5 : 0.45 + R() * 0.6) * (1 - t * 0.6);
        if (j === s.n - 1) la = s.ang + (R() - 0.5) * 0.4;
        la += (Math.cos(la) > 0 ? 1 : -1) * sp.droop * 0.5;
        const px = lerp(s.x, tx, t * 0.95) + (R() - 0.5) * sp.wid * 0.6, py = lerp(s.y, ty, t * 0.95) + (R() - 0.5) * sp.wid * 0.6;
        let L = sp.len * (0.7 + R() * 0.6) * (j === s.n - 1 ? 1.08 : 1), W = sp.wid * (0.75 + R() * 0.55);
        let bend = (R() - 0.5) * 1.1 + sp.bend * side, asym = (R() - 0.5) * 1.2;
        if (R() < 0.18) { L *= 1.15; W *= 0.55; bend *= 1.8; }
        let col = jit(base, R, 18);
        if (sp.silver && R() < 0.18) col = mixc(col, sp.silver, 0.55);
        P.leaf(px, py, la, L, W, bend, asym, col, 0.62 + R() * 0.33);
        if (R() < 0.25) {
          const off = -side * W * 0.35;
          P.leaf(px + Math.cos(la + 1.57) * off, py + Math.sin(la + 1.57) * off, la, L * 0.85, W * 0.45, bend, 0, mixc(col, [16, 22, 18], 0.25), 0.45);
        }
        if (s.tone > 0.5 && R() < 0.55) {
          const c2 = jit(ramp(pal, Math.min(1, s.tone + 0.24)), R, 12);
          P.leaf(px + Math.cos(la - 1.2) * W * 0.25, py + Math.sin(la - 1.2) * W * 0.25, la + (R() - 0.5) * 0.2, L * (0.55 + R() * 0.3), W * 0.45, bend, 0, c2, 0.72);
        }
        if (s.tone > 0.78 && R() < 0.32) P.leaf(px + Math.cos(la) * L * 0.2, py + Math.sin(la) * L * 0.2, la + (R() - 0.5) * 0.4, L * 0.45, W * 0.3, bend * 0.5, 0, jit(sp.hi, R, 10), 0.85);
      }
    }
  }
  function blobPath(x, y, rx, ry, rot, irr, R) {
    const n = 9, pts = [], cr = Math.cos(rot), sr = Math.sin(rot);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, r = 1 + (R() - 0.5) * 2 * irr, px = Math.cos(a) * rx * r, py = Math.sin(a) * ry * r;
      pts.push([x + px * cr - py * sr, y + px * sr + py * cr]);
    }
    const p = new Path2D(), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m = mid(pts[n - 1], pts[0]);
    p.moveTo(m[0], m[1]);
    for (let k = 0; k < n; k++) { const q = pts[k], m2 = mid(q, pts[(k + 1) % n]); p.quadraticCurveTo(q[0], q[1], m2[0], m2[1]); }
    p.closePath();
    return p;
  }
  function paintFruit(P, pl, rng) {
    // a fruit is five quick touches: a shadow, the body, the turning edge, the light, one flick of lime white
    for (const [x, y, r0] of pl.fruits) {
      const q = pl.def.fruit === 'quince';
      const r = q ? 0.0128 + r0 * 0.0035 : 0.0118 + r0 * 0.0035, rot = q ? (r0 - 0.5) * 0.8 : 0;
      const C = q ? { sh: [92, 62, 28], body: [198, 154, 56], turn: [146, 98, 38], lit: [234, 200, 108], hi: [250, 238, 196] }
        : { sh: [60, 22, 20], body: [158, 48, 34], turn: [104, 30, 26], lit: [204, 102, 70], hi: [242, 198, 160] };
      P.fill(blobPath(x + r * 0.2, y + r * 0.24, r * 1.05, r * (q ? 1.16 : 1.02), rot, 0.08, rng), C.sh, 0.5);
      P.fill(blobPath(x, y, r, r * (q ? 1.12 : 0.97), rot, 0.07, rng), C.body, 0.95);
      P.brush([[x + r * 0.62, y - r * 0.5], [x + r * 0.78, y + r * 0.15], [x + r * 0.2, y + r * 0.86]], r * 0.55, r * 0.3, C.turn, 0.6, 3);
      P.brush([[x - r * 0.62, y + r * 0.12], [x - r * 0.48, y - r * 0.5], [x + r * 0.05, y - r * 0.76]], r * 0.42, r * 0.2, C.lit, 0.8, 3);
      P.brush([[x - r * 0.46, y - r * 0.3], [x - r * 0.33, y - r * 0.52], [x - r * 0.16, y - r * 0.62]], r * 0.17, r * 0.06, C.hi, 0.9, 2);
      if (q) {
        P.line([[x + r * 0.08, y + r * 1.0], [x + r * 0.14, y + r * 1.18]], r * 0.3, r * 0.14, [86, 58, 34], 0.8, 0, 0, 0);
        P.line([[x, y - r * 1.05], [x - r * 0.15, y - r * 1.55]], r * 0.16, r * 0.1, [80, 64, 44], 0.85, 0, 0, 0);
        if (r0 > 0.45) P.leaf(x + r * 0.35, y - r * 1.15, -0.6 + r0, 0.02, 0.0072, 0.2, 0.3, jit(pl.sp.pal[2], rng, 10), 0.85);
      } else {
        for (let k = -1; k <= 1; k++) P.leaf(x + k * r * 0.22, y - r * 0.82, -Math.PI / 2 + k * 0.55 + (rng() - 0.5) * 0.3, r * (0.45 + rng() * 0.2), r * 0.17, 0.2, 0, [118, 34, 26], 0.95);
        if (r0 > 0.5) P.leaf(x - r * 0.9, y - r * 0.6, 2.4 + r0, 0.018, 0.0042, 0.3, 0.3, jit(pl.sp.pal[2], rng, 10), 0.85);
      }
    }
  }
  function paintFlowers(P, pl, rng) {
    for (const [x, y, r0] of pl.flowers) {
      if (pl.def.flowers === 'oleander') {
        const n = 3 + ((r0 * 4) | 0);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + r0 * 3, d = 0.009 + rng() * 0.005, fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.8;
          const col = jit(mixc([204, 112, 124], [240, 196, 196], rng() * 0.6), rng, 10);
          for (let p = 0; p < 5; p++) P.leaf(fx, fy, (p / 5) * TAU + rng() * 0.4, 0.0066, 0.0036, 0.1, 0.2, col, 0.86);
          P.dot(fx, fy, 0.0015, 0.0015, 0, [146, 58, 68], 0.8);
        }
      } else if (pl.def.flowers === 'pomflower') {
        const r = 0.007, a = -Math.PI / 2 + (r0 - 0.5);
        P.leaf(x, y, a, r * 2.0, r * 0.7, 0, 0, [192, 72, 40], 0.95);
        P.leaf(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4, a - 0.6, r * 1.5, r * 0.7, 0, 0, [222, 56, 32], 0.95);
        P.leaf(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4, a + 0.6, r * 1.5, r * 0.7, 0, 0, [212, 48, 30], 0.95);
        P.leaf(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, a, r * 1.2, r * 0.5, 0, 0, [242, 112, 72], 0.9);
      } else if (pl.def.flowers === 'myrtle') {
        for (let k = 0; k < 3; k++) {
          const fx = x + rng.r(-0.012, 0.012), fy = y + rng.r(-0.01, 0.01);
          for (let p = 0; p < 5; p++) P.leaf(fx, fy, (p / 5) * TAU + rng(), 0.0038, 0.0019, 0, 0, jit([240, 236, 222], rng, 8), 0.9);
          P.dot(fx, fy, 0.0013, 0.0013, 0, [226, 210, 150], 0.9);
        }
      }
    }
  }

  /* ---- birds: local frames, length ~1, facing left unless flipped ---- */
  function withFrame(P, x, y, s, flip, rot, fn) {
    const c = P.c;
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(flip ? -s : s, s);
    fn();
    c.restore();
  }
  function bz(p, pts) { p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 6) p.bezierCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]); p.closePath(); return p; }

  const JAY = {
    body: [0.06, 0.196, 0.064, 0.15, 0.088, 0.108, 0.126, 0.092, 0.16, 0.072, 0.206, 0.078, 0.232, 0.128, 0.30, 0.158, 0.42, 0.196, 0.52, 0.268,
      0.57, 0.304, 0.612, 0.34, 0.627, 0.38, 0.636, 0.42, 0.6, 0.456, 0.555, 0.466, 0.48, 0.502, 0.38, 0.512, 0.31, 0.487,
      0.23, 0.458, 0.168, 0.392, 0.138, 0.332, 0.114, 0.286, 0.084, 0.256, 0.06, 0.238],
    tail: [0.555, 0.37, 0.65, 0.44, 0.76, 0.53, 0.875, 0.615, 0.895, 0.635, 0.885, 0.668, 0.86, 0.688, 0.75, 0.62, 0.66, 0.54, 0.565, 0.455],
    wing: [0.235, 0.205, 0.33, 0.202, 0.45, 0.24, 0.55, 0.31, 0.615, 0.36, 0.672, 0.43, 0.712, 0.49, 0.63, 0.466, 0.55, 0.436, 0.48, 0.40,
      0.40, 0.372, 0.31, 0.348, 0.255, 0.31, 0.225, 0.285, 0.212, 0.235, 0.235, 0.205],
    patch: [0.258, 0.236, 0.29, 0.224, 0.335, 0.23, 0.37, 0.252, 0.386, 0.27, 0.386, 0.292, 0.37, 0.303, 0.335, 0.299, 0.29, 0.29, 0.266, 0.276, 0.25, 0.258, 0.25, 0.245, 0.258, 0.236],
  };
  const jayPaths = () => ({ body: bz(new Path2D(), JAY.body), tail: bz(new Path2D(), JAY.tail), wing: bz(new Path2D(), JAY.wing), patch: bz(new Path2D(), JAY.patch) });

  function paintJay(P, b) {
    withFrame(P, b.x, b.y, b.s, false, 0, () => {
      const c = P.c, J = jayPaths(), R = mulberry32(4242);
      // tail: black, a little blue in the barring near its root
      P.fill(J.tail, [30, 28, 34], 0.97);
      for (let k = 0; k < 4; k++) P.brush([[0.6, 0.41 + k * 0.012], [0.72, 0.5 + k * 0.014], [0.86, 0.615 + k * 0.016]], 0.008, 0.004, [70, 74, 92], 0.45, 2);
      for (let k = 0; k < 4; k++) P.line([[0.585 + k * 0.022, 0.395 + k * 0.022], [0.615 + k * 0.022, 0.43 + k * 0.022]], 0.006, 0.006, [60, 92, 150], 0.5, 0, 0.2, 0.2);
      // body
      P.fill(J.body, [188, 144, 126], 1);
      c.save(); c.clip(J.body);
      P.brush([[0.2, 0.14], [0.33, 0.175], [0.46, 0.235], [0.62, 0.35]], 0.085, 0.05, [152, 114, 106], 0.85, 6);
      P.brush([[0.25, 0.155], [0.4, 0.2], [0.56, 0.29]], 0.03, 0.02, [132, 100, 94], 0.6, 3);
      P.brush([[0.11, 0.30], [0.18, 0.385], [0.28, 0.45], [0.42, 0.49]], 0.09, 0.06, [214, 174, 150], 0.75, 6);
      P.brush([[0.3, 0.485], [0.44, 0.505], [0.57, 0.462]], 0.05, 0.03, [160, 112, 98], 0.6, 4);
      P.brush([[0.16, 0.33], [0.23, 0.395], [0.32, 0.44]], 0.03, 0.02, [236, 210, 188], 0.7, 3);
      // feathering: short touches along the body, lighter and darker by turns
      for (let k = 0; k < 26; k++) {
        const t = R(), x = lerp(0.18, 0.58, t), y = lerp(0.2, 0.32, t) + R() * 0.17;
        const l = (R() - 0.5) * 40, base = y > 0.36 ? [210, 168, 146] : [170, 128, 116];
        P.brush([[x, y], [x + 0.03, y + 0.012 + R() * 0.008]], 0.014, 0.006, [base[0] + l, base[1] + l, base[2] + l], 0.35, 2);
      }
      P.brush([[0.52, 0.448], [0.585, 0.43], [0.625, 0.39]], 0.055, 0.03, [240, 236, 228], 0.92, 4);
      P.brush([[0.062, 0.244], [0.1, 0.282], [0.15, 0.318]], 0.058, 0.035, [238, 232, 222], 0.94, 4);
      P.brush([[0.076, 0.148], [0.13, 0.1], [0.215, 0.12]], 0.044, 0.026, [226, 216, 206], 0.92, 4);
      for (let k = 0; k < 7; k++) {
        const x = 0.088 + k * 0.019, y = 0.108 - Math.min(k, 3) * 0.005 + Math.max(0, k - 3) * 0.008;
        P.line([[x, y], [x + 0.019, y + 0.009]], 0.009, 0.002, [34, 28, 28], 0.85, 0, 0.1, 0.6);
      }
      c.restore();
      for (let k = 0; k < 4; k++) P.line([[0.13 + k * 0.022, 0.088 + k * 0.002], [0.18 + k * 0.024, 0.068 + k * 0.012]], 0.012, 0.003, [212, 198, 186], 0.8, 0, 0.1, 0.6);
      // wing: black flight feathers, the scapulars over them, the barred blue, the white panel
      P.fill(J.wing, [28, 26, 32], 0.97);
      c.save(); c.clip(J.wing);
      P.brush([[0.21, 0.212], [0.34, 0.214], [0.47, 0.258], [0.57, 0.32]], 0.048, 0.02, [150, 112, 102], 0.95, 5);
      P.fill(J.patch, [52, 112, 200], 1);
      P.brush([[0.27, 0.262], [0.32, 0.256], [0.375, 0.276]], 0.026, 0.016, [96, 160, 226], 0.85, 3);
      for (let k = 0; k < 6; k++) {
        const t = k / 5, x = lerp(0.268, 0.375, t), y = lerp(0.236, 0.278, t);
        P.line([[x - 0.005, y - 0.016], [x + 0.003, y + 0.006], [x + 0.009, y + 0.026]], 0.0045, 0.003, [16, 18, 30], 0.92, 0, 0.1, 0.2);
        if (k < 5) P.line([[x + 0.008, y - 0.013], [x + 0.014, y + 0.007], [x + 0.019, y + 0.024]], 0.003, 0.002, [176, 216, 244], 0.8, 0, 0.1, 0.2);
      }
      P.brush([[0.4, 0.322], [0.432, 0.35], [0.468, 0.384]], 0.044, 0.032, [240, 238, 232], 0.96, 4);
      P.brush([[0.45, 0.296], [0.51, 0.328], [0.565, 0.37]], 0.018, 0.01, [106, 60, 44], 0.8, 3);
      for (let k = 0; k < 4; k++) P.line([[0.5 + k * 0.03, 0.39 + k * 0.01], [0.6 + k * 0.025, 0.43 + k * 0.014], [0.69, 0.478]], 0.0045, 0.002, [96, 96, 112], 0.55, 0, 0.1, 0.5);
      c.restore();
      // the black moustache, the stout bill, the pale eye
      P.brush([[0.062, 0.228], [0.098, 0.254], [0.148, 0.292]], 0.028, 0.012, [22, 18, 18], 0.97, 3);
      const bill = new Path2D();
      bill.moveTo(0.0, 0.214); bill.bezierCurveTo(0.02, 0.197, 0.04, 0.186, 0.068, 0.183);
      bill.lineTo(0.068, 0.236); bill.bezierCurveTo(0.04, 0.234, 0.02, 0.227, 0.0, 0.214); bill.closePath();
      P.fill(bill, [52, 48, 50], 1);
      P.line([[0.008, 0.208], [0.03, 0.196], [0.06, 0.189]], 0.0045, 0.002, [158, 154, 152], 0.8, 0, 0.1, 0.2);
      P.dot(0.114, 0.174, 0.022, 0.021, 0, [36, 28, 26], 0.95);
      P.dot(0.114, 0.174, 0.0165, 0.016, 0, [198, 208, 216], 1);
      P.dot(0.112, 0.174, 0.0088, 0.0088, 0, [16, 14, 14], 1);
      P.dot(0.108, 0.169, 0.0038, 0.0038, 0, [252, 250, 242], 1);
      P.brush([[0.09, 0.124], [0.13, 0.096], [0.185, 0.09]], 0.01, 0.003, [248, 242, 230], 0.72, 2);
      P.brush([[0.25, 0.158], [0.34, 0.172], [0.44, 0.205]], 0.01, 0.003, [226, 198, 186], 0.6, 2);
      // legs, short, gripping
      P.line([[0.37, 0.49], [0.368, 0.515], [0.364, 0.535]], 0.016, 0.01, [146, 106, 96], 0.95, 0, 0, 0);
      P.line([[0.43, 0.494], [0.432, 0.516], [0.434, 0.535]], 0.015, 0.009, [128, 92, 84], 0.95, 0, 0, 0);
      for (const fx of [0.364, 0.434]) {
        P.line([[fx, 0.535], [fx - 0.03, 0.541], [fx - 0.046, 0.556]], 0.01, 0.004, [118, 84, 76], 0.95, 0, 0, 0.5);
        P.line([[fx, 0.535], [fx + 0.022, 0.546], [fx + 0.03, 0.561]], 0.009, 0.004, [108, 78, 70], 0.9, 0, 0, 0.5);
      }
      P.brush([[0.29, 0.478], [0.38, 0.505], [0.48, 0.5]], 0.008, 0.003, [86, 56, 52], 0.5, 2);
      P.brush([[0.6, 0.45], [0.63, 0.42], [0.638, 0.39]], 0.007, 0.003, [120, 90, 84], 0.4, 1);
    });
  }

  const DOVE = {
    body: [0.09, 0.425, 0.1, 0.39, 0.12, 0.37, 0.15, 0.368, 0.19, 0.366, 0.22, 0.38, 0.235, 0.36, 0.26, 0.31, 0.3, 0.25, 0.36, 0.2,
      0.42, 0.14, 0.52, 0.1, 0.64, 0.1, 0.74, 0.1, 0.8, 0.13, 0.84, 0.18, 0.87, 0.23, 0.83, 0.29, 0.77, 0.33, 0.7, 0.4, 0.6, 0.47, 0.5, 0.47,
      0.42, 0.47, 0.34, 0.45, 0.29, 0.46, 0.24, 0.48, 0.2, 0.53, 0.15, 0.53, 0.11, 0.53, 0.09, 0.505, 0.085, 0.48],
    tail: [0.79, 0.15, 0.86, 0.13, 0.94, 0.1, 1.0, 0.095, 1.03, 0.11, 1.03, 0.17, 1.0, 0.195, 0.94, 0.21, 0.88, 0.24, 0.82, 0.28],
    wing: [0.4, 0.2, 0.5, 0.15, 0.66, 0.13, 0.78, 0.15, 0.86, 0.16, 0.92, 0.17, 0.95, 0.18, 0.86, 0.22, 0.78, 0.27, 0.68, 0.3,
      0.56, 0.33, 0.46, 0.31, 0.41, 0.27, 0.39, 0.25, 0.39, 0.22, 0.4, 0.2],
  };
  function paintDove(P, b) {
    // a rock dove on the end of the rim, leaning in to drink
    withFrame(P, b.x, b.y, b.s, false, 0, () => {
      const c = P.c, body = bz(new Path2D(), DOVE.body), tail = bz(new Path2D(), DOVE.tail), wing = bz(new Path2D(), DOVE.wing);
      P.fill(tail, [118, 120, 136], 0.97);
      P.brush([[0.96, 0.1], [1.01, 0.12], [1.02, 0.16], [0.99, 0.19]], 0.03, 0.024, [44, 44, 52], 0.9, 3);
      P.fill(body, [150, 152, 168], 1);
      c.save(); c.clip(body);
      P.brush([[0.42, 0.15], [0.6, 0.11], [0.82, 0.16]], 0.09, 0.06, [168, 170, 184], 0.8, 5);
      P.brush([[0.38, 0.43], [0.52, 0.46], [0.72, 0.37]], 0.08, 0.05, [162, 150, 164], 0.75, 5);
      P.brush([[0.21, 0.42], [0.26, 0.34], [0.33, 0.26]], 0.1, 0.06, [92, 132, 108], 0.75, 5);
      P.brush([[0.24, 0.47], [0.3, 0.41], [0.36, 0.36]], 0.07, 0.05, [140, 96, 140], 0.7, 4);
      P.brush([[0.12, 0.39], [0.17, 0.375], [0.22, 0.39]], 0.04, 0.03, [178, 180, 196], 0.6, 2);
      P.brush([[0.46, 0.46], [0.6, 0.47], [0.74, 0.37]], 0.02, 0.012, [96, 96, 112], 0.6, 2);
      c.restore();
      P.fill(wing, [180, 182, 194], 0.96);
      c.save(); c.clip(wing);
      P.brush([[0.6, 0.13], [0.63, 0.22], [0.62, 0.32]], 0.032, 0.026, [40, 40, 48], 0.92, 3);
      P.brush([[0.69, 0.13], [0.72, 0.21], [0.71, 0.3]], 0.032, 0.026, [40, 40, 48], 0.92, 3);
      P.brush([[0.8, 0.16], [0.88, 0.17], [0.95, 0.18]], 0.04, 0.02, [92, 94, 106], 0.85, 3);
      P.brush([[0.43, 0.2], [0.55, 0.16], [0.7, 0.15]], 0.016, 0.008, [222, 222, 230], 0.7, 2);
      c.restore();
      // bill and eye
      P.line([[0.092, 0.47], [0.06, 0.502], [0.03, 0.532]], 0.024, 0.008, [62, 54, 54], 0.95, 0, 0, 0.3);
      P.dot(0.092, 0.462, 0.011, 0.008, 0.7, [236, 232, 226], 0.92);
      P.dot(0.15, 0.428, 0.013, 0.013, 0, [206, 118, 42], 1);
      P.dot(0.15, 0.428, 0.006, 0.006, 0, [20, 18, 18], 1);
      P.line([[-0.02, 0.546], [0.03, 0.552], [0.085, 0.545]], 0.006, 0.006, [236, 244, 244], 0.65, 0, 0.3, 0.3);
      // legs on the rim
      P.line([[0.52, 0.455], [0.525, 0.5], [0.53, 0.535]], 0.02, 0.013, [186, 86, 84], 0.95, 0, 0, 0);
      P.line([[0.6, 0.45], [0.605, 0.5], [0.61, 0.535]], 0.018, 0.013, [170, 78, 78], 0.95, 0, 0, 0);
      for (const fx of [0.53, 0.61]) P.line([[fx - 0.035, 0.537], [fx + 0.035, 0.54]], 0.011, 0.009, [160, 76, 76], 0.9, 0, 0.3, 0.3);
    });
  }

  const SMALL = {
    body: [0.06, 0.30, 0.08, 0.24, 0.12, 0.19, 0.18, 0.185, 0.23, 0.18, 0.27, 0.21, 0.3, 0.25, 0.42, 0.28, 0.54, 0.34, 0.63, 0.43,
      0.64, 0.49, 0.6, 0.53, 0.52, 0.56, 0.42, 0.6, 0.3, 0.58, 0.2, 0.52, 0.12, 0.45, 0.08, 0.38, 0.06, 0.34],
    tail: [0.58, 0.42, 0.68, 0.48, 0.78, 0.56, 0.86, 0.62, 0.885, 0.65, 0.865, 0.685, 0.84, 0.695, 0.75, 0.64, 0.66, 0.58, 0.57, 0.54],
    wing: [0.24, 0.3, 0.36, 0.28, 0.48, 0.32, 0.57, 0.39, 0.63, 0.44, 0.67, 0.49, 0.7, 0.54, 0.6, 0.52, 0.5, 0.48, 0.4, 0.45, 0.3, 0.42, 0.24, 0.38, 0.24, 0.3],
  };
  function paintSmallBird(P, b, pal, flip) {
    withFrame(P, b.x, b.y, b.s, flip, b.rot || 0, () => {
      const c = P.c;
      const tail = bz(new Path2D(), SMALL.tail), body = bz(new Path2D(), SMALL.body), wing = bz(new Path2D(), SMALL.wing);
      P.fill(tail, pal.tail, 0.95);
      if (pal.tailSpot) for (let k = 0; k < 2; k++) P.dot(0.82 - k * 0.04, 0.645 - k * 0.025, 0.012, 0.007, 0.5, pal.tailSpot, 0.9);
      P.fill(body, pal.body, 1);
      c.save(); c.clip(body);
      P.curve([[0.15, 0.2], [0.35, 0.25], [0.6, 0.4]], 0.09, 0.06, pal.back, 0.85);
      P.curve([[0.1, 0.4], [0.25, 0.53], [0.5, 0.58]], 0.12, 0.08, pal.belly, 0.85);
      if (pal.face) P.dot(0.1, 0.3, 0.07, 0.065, 0, pal.face, 0.95);
      if (pal.cap) P.curve([[0.15, 0.17], [0.24, 0.19], [0.3, 0.26]], 0.06, 0.06, pal.cap, 0.95);
      if (pal.cheek) P.dot(0.2, 0.34, 0.045, 0.05, 0, pal.cheek, 0.9);
      P.curve([[0.15, 0.36], [0.24, 0.48], [0.38, 0.55]], 0.03, 0.02, mixc(pal.belly, [255, 255, 245], 0.4), 0.7);
      c.restore();
      P.fill(wing, pal.wing, 0.97);
      if (pal.bar) P.curve([[0.34, 0.33], [0.44, 0.41], [0.52, 0.47]], 0.05, 0.04, pal.bar, 0.95);
      if (pal.wingEdge) for (let k = 0; k < 3; k++) P.line([[0.42 + k * 0.05, 0.41 + k * 0.025], [0.66, 0.52]], 0.006, 0.003, pal.wingEdge, 0.7);
      const bill = new Path2D();
      bill.moveTo(0.0, 0.33); bill.lineTo(0.075, 0.29); bill.lineTo(0.075, 0.355); bill.closePath();
      P.fill(bill, pal.bill, 1);
      P.dot(0.15, 0.27, 0.022, 0.022, 0, [20, 18, 18], 1);
      P.dot(0.144, 0.263, 0.007, 0.007, 0, [250, 248, 238], 0.95);
      P.line([[0.38, 0.58], [0.385, 0.64], [0.39, 0.7]], 0.018, 0.012, pal.leg, 0.95, 0, 0, 0);
      P.line([[0.45, 0.58], [0.45, 0.64], [0.45, 0.7]], 0.016, 0.012, pal.leg, 0.9, 0, 0, 0);
      P.curve([[0.12, 0.17], [0.2, 0.17], [0.3, 0.22]], 0.015, 0.006, [250, 246, 232], 0.5, 0, 0.3, 0.5);
    });
  }
  const PAL_FINCH = { body: [178, 146, 112], back: [160, 124, 88], belly: [232, 222, 202], wing: [32, 28, 28], bar: [236, 196, 44], tail: [30, 28, 28], tailSpot: [240, 236, 228],
    face: [204, 46, 36], cap: [26, 24, 24], cheek: [240, 236, 228], bill: [210, 190, 170], leg: [170, 136, 120], wingEdge: [230, 226, 214] };
  const PAL_WARBLER = { body: [134, 120, 90], back: [112, 98, 72], belly: [214, 200, 168], wing: [96, 82, 62], tail: [92, 78, 60], bill: [60, 52, 46], leg: [120, 96, 84], wingEdge: [168, 150, 116] };
  const PAL_ORIOLE = { body: [222, 176, 38], back: [210, 160, 30], belly: [236, 200, 70], wing: [34, 30, 28], bar: [226, 200, 90], tail: [34, 30, 28], tailSpot: [228, 190, 60], bill: [170, 80, 70], leg: [90, 80, 80], wingEdge: [200, 180, 120] };

  function paintSwallow(P, b) {
    withFrame(P, b.x, b.y, b.s, false, b.tilt, () => {
      const dark = [28, 36, 60], blue = [62, 84, 128];
      P.curve([[0.46, 0.46], [0.36, 0.36], [0.2, 0.25], [0.02, 0.2]], 0.1, 0.012, dark, 0.95, 0, 0.1, 0.6);
      P.curve([[0.44, 0.43], [0.32, 0.33], [0.12, 0.23]], 0.025, 0.006, blue, 0.6, 0, 0.2, 0.6);
      P.curve([[0.5, 0.5], [0.58, 0.42], [0.74, 0.26], [0.92, 0.12]], 0.1, 0.012, dark, 0.95, 0, 0.1, 0.6);
      P.curve([[0.53, 0.46], [0.66, 0.33], [0.84, 0.17]], 0.024, 0.006, blue, 0.6, 0, 0.2, 0.6);
      P.curve([[0.34, 0.5], [0.45, 0.5], [0.58, 0.55], [0.66, 0.6]], 0.075, 0.03, dark, 1, 0, 0.3, 0.3);
      P.curve([[0.4, 0.53], [0.5, 0.545], [0.6, 0.575]], 0.03, 0.015, [228, 220, 204], 0.85, 0, 0.3, 0.4);
      P.dot(0.355, 0.505, 0.022, 0.018, 0.2, [150, 62, 42], 0.9);
      P.curve([[0.64, 0.59], [0.74, 0.66], [0.86, 0.76], [0.94, 0.82]], 0.02, 0.003, dark, 0.95, 0, 0, 0.7);
      P.curve([[0.64, 0.6], [0.72, 0.68], [0.78, 0.79], [0.8, 0.87]], 0.02, 0.003, dark, 0.95, 0, 0, 0.7);
      P.dot(0.33, 0.49, 0.006, 0.006, 0, [10, 10, 12], 1);
    });
  }

  function paintBasin(P, b) {
    // a marble labrum on a short baluster: gadrooned bowl, a thick lip, water holding the sky
    const { x, y, rx, ry } = b;
    const marble = [226, 220, 206], shade = [150, 144, 150], deep = [112, 106, 116], hi = [248, 246, 238];
    // baluster
    const st = new Path2D();
    st.moveTo(x - 0.014, y + 0.052); st.bezierCurveTo(x - 0.03, y + 0.075, x - 0.03, y + 0.095, x - 0.012, y + 0.11);
    st.bezierCurveTo(x - 0.016, y + 0.15, x - 0.02, y + 0.18, x - 0.03, y + 0.2); st.lineTo(x + 0.03, y + 0.2);
    st.bezierCurveTo(x + 0.02, y + 0.18, x + 0.016, y + 0.15, x + 0.012, y + 0.11);
    st.bezierCurveTo(x + 0.03, y + 0.095, x + 0.03, y + 0.075, x + 0.014, y + 0.052); st.closePath();
    P.fill(st, [204, 198, 188], 1);
    P.brush([[x + 0.006, y + 0.06], [x + 0.016, y + 0.085], [x + 0.008, y + 0.12], [x + 0.016, y + 0.195]], 0.016, 0.018, shade, 0.85, 3);
    P.brush([[x - 0.01, y + 0.065], [x - 0.017, y + 0.085], [x - 0.008, y + 0.12], [x - 0.014, y + 0.19]], 0.006, 0.007, hi, 0.8, 2);
    P.brush([[x - 0.024, y + 0.1], [x, y + 0.104], [x + 0.024, y + 0.1]], 0.004, 0.004, deep, 0.6, 1);
    P.fill(polyPath([[x - 0.042, y + 0.196], [x + 0.042, y + 0.196], [x + 0.046, y + 0.222], [x - 0.046, y + 0.222]]), [212, 206, 196], 1);
    P.brush([[x - 0.044, y + 0.205], [x + 0.044, y + 0.205]], 0.006, 0.006, shade, 0.7, 2);
    // bowl
    const bowl = new Path2D();
    bowl.moveTo(x - rx, y + 0.004); bowl.bezierCurveTo(x - rx * 0.96, y + 0.034, x - rx * 0.5, y + 0.052, x - 0.016, y + 0.056);
    bowl.lineTo(x + 0.016, y + 0.056); bowl.bezierCurveTo(x + rx * 0.5, y + 0.052, x + rx * 0.96, y + 0.034, x + rx, y + 0.004); bowl.closePath();
    P.fill(bowl, marble, 1);
    P.c.save(); P.c.clip(bowl);
    // gadroons, converging on the foot, lit from the left
    for (let k = -8; k <= 8; k++) {
      const t = k / 8, x0 = x + t * rx * 0.98, x1 = x + t * 0.014;
      const lit = clamp(0.55 - t * 0.6 + (k % 2 ? 0.12 : -0.08), 0, 1);
      P.brush([[x0, y + 0.006], [lerp(x0, x1, 0.45) + t * 0.006, y + 0.034], [x1, y + 0.056]], 0.012 * (1 - Math.abs(t) * 0.4), 0.004, mixc(shade, hi, lit), 0.75, 2);
    }
    P.brush([[x + rx * 0.2, y + 0.012], [x + rx * 0.6, y + 0.026], [x + rx * 0.9, y + 0.016]], 0.04, 0.028, deep, 0.45, 4);
    P.c.restore();
    // lip and water
    P.dot(x, y, rx, ry, 0, [214, 208, 198], 1);
    P.dot(x, y - ry * 0.06, rx * 0.9, ry * 0.66, 0, [136, 174, 186], 1);
    P.brush([[x - rx * 0.86, y - ry * 0.1], [x - rx * 0.3, y - ry * 0.55], [x + rx * 0.4, y - ry * 0.5], [x + rx * 0.85, y - ry * 0.12]], 0.006, 0.005, [104, 132, 146], 0.6, 2);
    P.brush([[x - rx * 0.62, y - ry * 0.05], [x - rx * 0.05, y - ry * 0.3], [x + rx * 0.45, y - ry * 0.1]], 0.0026, 0.0022, [228, 240, 238], 0.85, 1);
    P.brush([[x - rx * 0.86, y + ry * 0.28], [x - rx * 0.3, y + ry * 0.72], [x + rx * 0.3, y + ry * 0.72], [x + rx * 0.86, y + ry * 0.28]], 0.0055, 0.004, hi, 0.9, 2);
    P.brush([[x + rx * 0.35, y + ry * 0.66], [x + rx * 0.8, y + ry * 0.34]], 0.004, 0.003, shade, 0.7, 1);
    P.brush([[x - rx * 0.98, y + 0.004], [x - rx * 0.92, y + 0.012]], 0.004, 0.003, deep, 0.6, 1);
  }

  function paintFence(P, sc, rng) {
    // the reed lattice, painted freehand: no two canes quite parallel
    const H = FBOT - FT, reed = [206, 190, 142], dark = [52, 52, 38], light = [242, 234, 204];
    const span = 0.078, slope = 0.62;
    const draw = (dir) => {
      for (let u = sc.uL - 0.3; u < sc.uR + 0.2; u += span * rng.r(0.86, 1.14)) {
        const k = rng() * 10, sl = slope * rng.r(0.92, 1.08), amp = rng.r(0.0006, 0.0018), w = rng.r(0.0052, 0.0068), pts = [];
        for (let t = 0; t <= 7; t++) { const v = FBOT - (t / 7) * H; pts.push([u + dir * (t / 7) * H * sl + Math.sin(v * 60 + k) * amp, v]); }
        P.line(pts.map((p) => [p[0] + 0.0021, p[1] + 0.0016]), w * 1.15, w, dark, 0.66, 0, 0.05, 0.05);
        const rc = jit(reed, rng, 18);
        P.line(pts, w * 0.9, w * 0.8, rc, 0.9, 0, 0.04, 0.04);
        P.brush(pts, w, w * 0.88, rc, 0.8, 3, true);
        P.line(pts.map((p) => [p[0] - w * 0.25, p[1] - w * 0.18]), w * 0.3, w * 0.24, light, 0.8, 0, 0.15, 0.2);
      }
    };
    draw(-1); draw(1);
    for (const v of [FT, FBOT]) {
      const pts = [];
      for (let u = sc.uL - 0.1; u <= sc.uR + 0.1; u += 0.04) pts.push([u, v + Math.sin(u * 9.5 + v * 7) * 0.0013 + rng.r(-0.0006, 0.0006)]);
      P.line(pts.map((p) => [p[0], p[1] + 0.0038]), 0.0078, 0.0078, dark, 0.66, 0, 0, 0);
      P.line(pts, 0.0076, 0.0076, jit(reed, rng, 10), 0.92, 0, 0, 0);
      P.brush(pts, 0.008, 0.008, jit(reed, rng, 10), 0.8, 3, true);
      P.line(pts.map((p) => [p[0], p[1] - 0.002]), 0.0016, 0.0016, light, 0.8, 0, 0, 0);
    }
    for (const u of sc.posts) {
      if (!sc.inWin(u, 0.05)) continue;
      const lean = rng.r(-0.004, 0.004);
      const pts = [[u + lean, FT - 0.019], [u + lean * 0.4, (FT + FBOT) / 2], [u - 0.0005, FBOT + 0.009]];
      P.line(pts.map((p) => [p[0] + 0.0032, p[1]]), 0.0105, 0.0105, dark, 0.7, 0, 0, 0);
      P.brush(pts, 0.0098, 0.0098, jit([190, 168, 116], rng, 8), 1, 3, false);
      P.line(pts.map((p) => [p[0] - 0.0026, p[1]]), 0.0022, 0.0022, light, 0.8, 0, 0, 0);
      P.dot(u + lean, FT - 0.02, 0.0068, 0.005, 0, [210, 190, 134], 1);
      P.dot(u + lean - 0.0018, FT - 0.0218, 0.0029, 0.0019, 0, light, 0.9);
    }
  }

  function paintFlowerBed(P, sc, rng) {
    const F = sc.flowers;
    P.c.fillStyle = css([60, 64, 42]);
    P.c.fillRect(sc.uL - 0.1, FBOT - 0.006, sc.uR - sc.uL + 0.2, DADO - FBOT + 0.008);
    for (const g of F.grass) {
      const col = jit(mixc([50, 74, 44], [122, 142, 82], g.t), rng, 10);
      P.line([[g.x, DADO - 0.002], [g.x + g.lean * g.h * 0.3, DADO - 0.002 - g.h * 0.5], [g.x + g.lean * g.h, DADO - 0.002 - g.h]], 0.003, 0.0007, col, 0.85, 0, 0, 0.6);
    }
    for (const p of F.poppies) {
      const r = mulberry32(p.seed);
      for (let k = 0; k < 4; k++) P.leaf(p.x + (r() - 0.5) * 0.01, DADO - 0.008, -Math.PI / 2 + (r() - 0.5) * 2.4, r() * 0.014 + 0.024, 0.0055, 0.5, 0.3, jit([92, 116, 94], r, 12), 0.85);
      for (let k = 0; k < 2; k++) { const t = 0.3 + r() * 0.4, lx = p.x + p.lean * p.h * t * 0.6, ly = DADO - 0.006 - p.h * t; P.leaf(lx, ly, (r() < 0.5 ? -0.6 : -2.5) + (r() - 0.5) * 0.4, 0.014, 0.0035, 0.5, 0.4, jit([100, 124, 98], r, 10), 0.85); }
    }
    for (const ch of F.cham) {
      const r = mulberry32(ch.seed);
      P.line([[ch.x, DADO - 0.004], [ch.x + (r() - 0.5) * 0.007, ch.y]], 0.0014, 0.0009, [90, 110, 70], 0.8, 0, 0, 0);
      for (let k = 0; k < 9; k++) P.leaf(ch.x, ch.y, (k / 9) * TAU + r(), ch.r, ch.r * 0.32, 0, 0, jit([242, 238, 226], r, 8), 0.92);
      P.dot(ch.x, ch.y, ch.r * 0.36, ch.r * 0.32, 0, [214, 164, 46], 1);
    }
    for (const bl of F.blue) {
      const r = mulberry32(bl.seed);
      for (let k = 0; k < 6; k++) P.leaf(bl.x, bl.y, (k / 6) * TAU + r(), 0.0064, 0.0025, 0, 0, jit([64, 96, 172], r, 10), 0.9);
      P.dot(bl.x, bl.y, 0.0018, 0.0018, 0, [40, 40, 80], 0.9);
    }
    for (const p of F.poppies) {
      const r = mulberry32(p.seed + 7);
      const base = DADO - 0.006, tx = p.x + p.lean * p.h, ty = base - p.h;
      P.curve([[p.x, base], [p.x + p.lean * p.h * 0.4, base - p.h * 0.55], [tx, ty]], 0.0026, 0.0018, [96, 118, 84], 0.9, 0, 0, 0);
      if (p.bud) {
        const bx = tx + 0.005, by = ty + 0.007;
        P.curve([[tx, ty], [tx + 0.006, ty - 0.002], [bx, by]], 0.0019, 0.0016, [96, 118, 84], 0.9, 0, 0, 0);
        P.dot(bx, by + 0.005, 0.0042, 0.0065, 0.3, [110, 130, 90], 0.95);
        P.line([[bx - 0.001, by + 0.007], [bx + 0.001, by + 0.012]], 0.003, 0.0012, [200, 60, 40], 0.9, 0, 0, 0.5);
        continue;
      }
      const s = (0.0135 + r() * 0.005) * (p.size || 1), tilt = (r() - 0.5) * 0.6;
      P.leaf(tx - s * 0.1, ty, -Math.PI / 2 - 0.9 + tilt, s * 1.25, s * 0.75, 0.2, 0.2, [146, 32, 22], 0.95);
      P.leaf(tx + s * 0.1, ty, -Math.PI / 2 + 0.9 + tilt, s * 1.25, s * 0.75, -0.2, -0.2, [174, 42, 26], 0.95);
      P.dot(tx, ty - s * 0.38, s * 0.62, s * 0.5, tilt, [210, 56, 32], 0.95);
      P.leaf(tx - s * 0.05, ty + s * 0.15, -Math.PI / 2 - 0.25 + tilt, s * 1.05, s * 0.62, 0.1, 0.2, [222, 70, 40], 0.9);
      P.dot(tx + s * 0.05, ty - s * 0.15, s * 0.2, s * 0.16, 0, [36, 26, 26], 0.9);
      P.curve([[tx - s * 0.5, ty - s * 0.6], [tx - s * 0.1, ty - s * 0.85], [tx + s * 0.3, ty - s * 0.75]], s * 0.14, s * 0.06, [246, 150, 110], 0.7, 0, 0.2, 0.5);
    }
  }

  function paintDado(P, sc, rng) {
    const c = P.c, x0 = sc.uL - 0.1, w = sc.uR - sc.uL + 0.2;
    c.fillStyle = css([232, 224, 206]); c.fillRect(x0, DADO, w, 0.005);
    c.fillStyle = css([34, 30, 28]); c.fillRect(x0, DADO + 0.0045, w, 0.0095);
    c.fillStyle = css([148, 60, 40]); c.fillRect(x0, DADO + 0.014, w, 0.1);
    const n = Math.round(w * 170);
    for (let k = 0; k < n; k++) {
      const u = rng.r(x0, x0 + w), v = rng.r(DADO + 0.015, 1.0), len = rng.r(0.06, 0.18);
      const col = jit(rng() < 0.5 ? [128, 48, 32] : [168, 74, 46], rng, 10);
      P.brush([[u, v], [u + len * 0.5, v + rng.r(-0.004, 0.004)], [u + len, v + rng.r(-0.006, 0.006)]], rng.r(0.008, 0.02), 0.008, col, rng.r(0.14, 0.32), 3);
    }
    const line = (v, wd, col, a) => {
      const pts = [];
      for (let u = x0; u <= x0 + w; u += 0.06) pts.push([u, v + rng.r(-0.0006, 0.0006)]);
      P.line(pts, wd, wd, col, a, 0, 0, 0);
    };
    line(DADO + 0.0265, 0.0028, [228, 218, 196], 0.85);
    line(0.99, 0.012, [40, 30, 26], 0.9);
  }

  /* ---------------------------------------------------------------- sinopia */
  function sinopia(c, sc, rng) {
    const col = 'rgba(150,56,36,';
    const SP = new Painter(c, sc.seed ^ 0x51a0);
    const ln = (pts, w, a) => {
      if (pts.length === 2) pts = [pts[0], [lerp(pts[0][0], pts[1][0], 0.5), lerp(pts[0][1], pts[1][1], 0.5)], pts[1]];
      SP.brush(pts, w * rng.r(1.1, 1.5), w * rng.r(0.5, 0.9), [150, 56, 36], a, 3, true);
    };
    const jitter = (pts, a) => pts.map((p) => [p[0] + rng.n() * a, p[1] + rng.n() * a]);
    for (const v of [FT, FBOT, DADO + 0.0045]) ln([[sc.uL - 0.1, v + rng.r(-0.001, 0.001)], [sc.uR + 0.1, v + rng.r(-0.001, 0.001)]], 0.0012, 0.85);
    ln([[sc.u0 + sc.A * 0.5 + 0.03, -0.02], [sc.u0 + sc.A * 0.5 + 0.035, 1.02]], 0.001, 0.6);
    for (const pl of sc.trees.concat(sc.shrubs)) {
      for (const t of pl.def.trunks) ln(spline(jitter(t, 0.004), 6), 0.009, 0.75);
      for (const b of pl.branches) { ln(spline(jitter(b, 0.005), 6), 0.006, 0.72); if (rng() < 0.4) ln(spline(jitter(b, 0.01), 6), 0.004, 0.4); }
      for (const l of pl.def.lobes) {
        const pts = [], a0 = rng() * TAU, span = TAU * rng.r(0.55, 0.9);
        for (let k = 0; k <= 26; k++) {
          const a = a0 + (k / 26) * span, s2 = 1 + Math.sin(k * 1.9) * 0.08 + rng.n() * 0.03;
          pts.push([l[0] + Math.cos(a) * l[2] * 0.95 * s2, l[1] + Math.sin(a) * l[3] * 0.95 * s2]);
        }
        ln(pts, 0.005, 0.7);
        for (let k = 0; k < 7; k++) {
          const a = rng() * TAU, r = rng.r(0.3, 0.85), x = l[0] + Math.cos(a) * l[2] * r, y = l[1] + Math.sin(a) * l[3] * r;
          ln([[x, y], [x + rng.r(-0.016, 0.016), y + rng.r(-0.016, 0.006)]], 0.0042, 0.55);
        }
      }
      for (const f of pl.fruits) if (rng() < 0.6) { c.strokeStyle = col + '0.6)'; c.lineWidth = 0.0024; c.beginPath(); c.ellipse(f[0], f[1], 0.012, 0.013, 0, 0, TAU); c.stroke(); }
    }
    const birdSin = (b, paths, flip, rot, extra) => {
      for (let k = 0; k < 2; k++) {
        c.save(); c.translate(b.x + (k ? rng.r(-0.008, 0.008) : 0), b.y + (k ? rng.r(-0.01, 0.005) : 0)); c.rotate((rot || 0) + (k ? rng.r(-0.12, 0.12) : 0));
        c.scale(flip ? -b.s : b.s, b.s);
        c.strokeStyle = col + (k ? 0.45 : 0.82) + ')'; c.lineWidth = 0.04; c.lineJoin = 'round'; c.lineCap = 'round';
        for (const p of paths) c.stroke(p);
        if (extra) extra(c);
        c.restore();
      }
    };
    const J = jayPaths();
    birdSin(sc.jay, [J.body, J.tail, J.wing]);
    const sm = [bz(new Path2D(), SMALL.body), bz(new Path2D(), SMALL.tail), bz(new Path2D(), SMALL.wing)];
    birdSin(sc.finch, sm, true);
    birdSin(sc.warbler, sm, false);
    birdSin(sc.lost, sm, true, 0.15, (cc) => { cc.beginPath(); cc.arc(0.15, 0.27, 0.03, 0, TAU); cc.stroke(); cc.beginPath(); cc.moveTo(0.38, 0.6); cc.lineTo(0.39, 0.75); cc.moveTo(0.45, 0.6); cc.lineTo(0.47, 0.75); cc.stroke(); });
    const dl = new Path2D(); dl.moveTo(0.53, 0.46); dl.lineTo(0.53, 0.54); dl.moveTo(0.61, 0.45); dl.lineTo(0.61, 0.54);
    birdSin(sc.dove, [bz(new Path2D(), DOVE.body), bz(new Path2D(), DOVE.tail), bz(new Path2D(), DOVE.wing), dl]);
    const b = sc.basin;
    c.strokeStyle = col + '0.75)'; c.lineWidth = 0.0026;
    c.beginPath(); c.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(b.x - b.rx, b.y); c.quadraticCurveTo(b.x - b.rx * 0.6, b.y + 0.06, b.x, b.y + 0.053); c.quadraticCurveTo(b.x + b.rx * 0.6, b.y + 0.06, b.x + b.rx, b.y); c.stroke();
    ln([[b.x - 0.013, b.y + 0.055], [b.x - 0.022, b.y + 0.21]], 0.0024, 0.6); ln([[b.x + 0.013, b.y + 0.055], [b.x + 0.022, b.y + 0.21]], 0.0024, 0.6);
    for (const u of sc.posts) if (sc.inWin(u, 0.05)) ln([[u, FT - 0.02], [u + rng.r(-0.003, 0.003), FBOT + 0.01]], 0.003, 0.7);
    for (let u = sc.uL - 0.2; u < sc.uR; u += 0.156) { ln([[u, FBOT], [u + 0.218 * 0.62, FT]], 0.0022, 0.5); ln([[u + 0.12, FBOT], [u + 0.12 - 0.218 * 0.62, FT]], 0.0022, 0.5); }
    for (const p of sc.flowers.poppies) if (rng() < 0.5) ln([[p.x, DADO], [p.x + p.lean * p.h, DADO - 0.006 - p.h]], 0.0022, 0.5);
    const s = sc.swallow;
    c.save(); c.translate(s.x, s.y); c.rotate(s.tilt); c.scale(s.s, s.s);
    c.strokeStyle = col + '0.7)'; c.lineWidth = 0.028;
    c.beginPath(); c.moveTo(0.02, 0.2); c.quadraticCurveTo(0.3, 0.3, 0.5, 0.5); c.quadraticCurveTo(0.7, 0.3, 0.92, 0.12); c.moveTo(0.34, 0.5); c.lineTo(0.66, 0.6); c.lineTo(0.94, 0.82); c.moveTo(0.66, 0.6); c.lineTo(0.8, 0.87); c.stroke();
    c.restore();
  }

  /* ================================================================== damage */
  const GLYPHS = {
    A: { w: 0.62, s: [[[0, 1], [0.3, 0], [0.62, 1]], [[0.16, 0.6], [0.46, 0.58]]] },
    C: { w: 0.5, s: [[[0.5, 0.08], [0.25, 0], [0.04, 0.25], [0.02, 0.7], [0.22, 1], [0.52, 0.92]]] },
    D: { w: 0.55, s: [[[0, 0], [0, 1]], [[0, 0], [0.32, 0.06], [0.55, 0.45], [0.38, 0.92], [0, 1]]] },
    E: { w: 0.45, s: [[[0.45, 0], [0, 0], [0, 1], [0.46, 1]], [[0, 0.5], [0.38, 0.5]]] },
    E2: { w: 0.26, s: [[[0, 0.02], [0.02, 1]], [[0.24, 0.0], [0.25, 0.98]]] },
    F: { w: 0.45, s: [[[0.45, 0], [0, 0], [0, 1]], [[0, 0.46], [0.36, 0.46]]] },
    H: { w: 0.55, s: [[[0, 0], [0, 1]], [[0.55, 0], [0.55, 1]], [[0, 0.5], [0.55, 0.48]]] },
    I: { w: 0.08, s: [[[0.04, 0], [0.04, 1]]] },
    L: { w: 0.42, s: [[[0, 0], [0, 1], [0.42, 1]]] },
    M: { w: 0.75, s: [[[0, 1], [0.08, 0], [0.37, 0.75], [0.66, 0], [0.75, 1]]] },
    N: { w: 0.56, s: [[[0, 1], [0, 0], [0.56, 1], [0.56, 0]]] },
    P: { w: 0.48, s: [[[0, 1], [0, 0], [0.4, 0.04], [0.46, 0.26], [0.02, 0.48]]] },
    R: { w: 0.5, s: [[[0, 1], [0, 0], [0.4, 0.04], [0.46, 0.26], [0.02, 0.48]], [[0.18, 0.48], [0.5, 1]]] },
    S: { w: 0.46, s: [[[0.46, 0.08], [0.2, 0], [0.02, 0.2], [0.42, 0.62], [0.36, 0.95], [0.0, 0.92]]] },
    T: { w: 0.56, s: [[[0, 0], [0.56, 0]], [[0.28, 0], [0.28, 1]]] },
    V: { w: 0.58, s: [[[0, 0], [0.3, 1], [0.58, 0]]] },
    X: { w: 0.55, s: [[[0, 0], [0.55, 1]], [[0.55, 0], [0, 1]]] },
  };

  function buildDamage(seed, sc) {
    const rng = RNG(seed, 'damage');
    const { A, u0 } = sc, uR0 = u0 + A, s2 = clamp(A / 1.68, 0.45, 1.15), w1 = sc.w1;
    const D = { losses: [], islands: [], neutral: [], trat: [], cracks: [], fine: [], incisions: [], graffito: [], neutralStrokes: [] };
    const k = clamp(A / 1.2, 0.5, 1);
    const OUT = [
      [0, 0.17, 0.012], [0.3, 0, 0.0], [0.47, 0, 0.014], [0.63, 0, 0.002], [0.8, 0, 0.01], [1, -0.07, 0.0],
      [1, -0.012, 0.035], [1, 0, 0.22], [1, -0.01, 0.45], [1, 0.0, 0.62], [1, -0.014, 0.74],
      [1, -0.05, 0.80], [1, -0.08, 0.89], [1, -0.12, 0.955], [1, -0.16, 1.0],
      [0.70, 0, 0.99], [0.52, 0, 1.0], [0.33, 0, 0.986], [0.16, 0, 1.0], [0, 0.05, 0.992],
      [0, 0.0, 0.93], [0, 0.012, 0.74], [0, 0.0, 0.55], [0, 0.008, 0.38],
      [0, 0.03, 0.30], [0, 0.055, 0.21], [0, 0.09, 0.12], [0, 0.125, 0.05],
    ].map(([fx, ax, y]) => [u0 + fx * A + ax * k + rng.r(-0.004, 0.004), clamp(y + rng.r(-0.004, 0.004), 0.0, 1.0)]);
    D.outline = fractalPoly(rng, OUT, 6, 0.14, 0.003);
    const j = sc.jay;
    D.avoid = [[j.x + 0.1 * j.s * 5, j.y + 0.075, 0.118, 0.08], [0.63, 0.575, 0.06, 0.035], [0.785, 0.64, 0.035, 0.035], [sc.swallow.x + 0.5 * sc.swallow.s, sc.swallow.y + 0.5 * sc.swallow.s, 0.05, 0.04]];
    const avoided = (x, y, m) => D.avoid.some((a) => ((x - a[0]) / (a[2] + m)) ** 2 + ((y - a[1]) / (a[3] + m)) ** 2 < 1);

    const L1 = [[-0.06, -0.06], [w1 + 0.02, -0.06], [w1 * 0.97, 0.02], [w1 * 0.84, 0.06], [w1 * 0.74, 0.11], [w1 * 0.62, 0.135], [w1 * 0.52, 0.2],
      [w1 * 0.40, 0.245], [w1 * 0.30, 0.30], [w1 * 0.20, 0.335], [w1 * 0.10, 0.39], [-0.06, 0.43]].map(([x, y]) => [u0 + x, y]);
    D.losses.push(fractalPoly(rng, L1, 6, 0.2, 0.0025));
    for (let n = 0; n < 4; n++) {
      const x = u0 + rng.r(0.1, 0.85) * w1, y = rng.r(0.05, 0.25);
      if (!inPoly(L1, x, y)) continue;
      D.islands.push(fractalPoly(rng, blobPoly(rng, x, y, rng.r(0.006, 0.016), rng.r(0.005, 0.012), 7, 0.3, rng() * 3), 3, 0.2, 0.002));
    }
    { const b = sc.lost, tx = b.x - 0.86 * b.s, ty = b.y + 0.66 * b.s;
      D.islands.push(fractalPoly(rng, blobPoly(rng, tx, ty, 0.015, 0.012, 8, 0.25, 0.4), 3, 0.2, 0.002)); }
    const L2 = [[-0.30 * s2, 1.06], [-0.27 * s2, 0.95], [-0.215 * s2, 0.885], [-0.18 * s2, 0.80], [-0.11 * s2, 0.765], [-0.05 * s2, 0.69], [0.06, 0.665], [0.06, 1.06]]
      .map(([x, y]) => [uR0 + x, y]);
    D.losses.push(fractalPoly(rng, L2, 6, 0.22, 0.0025));
    { const b = sc.dove, cx = b.x + 0.84 * b.s, cy = b.y + 0.2 * b.s;
      D.losses.push(fractalPoly(rng, blobPoly(rng, cx, cy, 0.042, 0.034, 9, 0.22, -0.3), 4, 0.18, 0.002)); }
    // composed lacunae, nudged off the things that must survive
    const nudge = (x, y, rx, ry, dx, dy) => {
      for (let k = 0; k < 12 && avoided(x, y, Math.max(rx, ry) * 0.9); k++) { x += dx; y += dy; }
      return [x, y];
    };
    { const [x, y] = nudge(uR0 - 0.30 * s2, 0.075, 0.058, 0.042, 0.02, 0);
      const p = fractalPoly(rng, blobPoly(rng, x, y, 0.058, 0.042, 9, 0.2, 0.2), 4, 0.16, 0.002);
      D.losses.push(p); D.trat.push({ poly: p, mode: 'sky' }); }
    { const [x, y] = nudge(u0 + 0.26 * A, 0.775, 0.066, 0.048, -0.02, 0.01);
      const p = fractalPoly(rng, blobPoly(rng, x, y, 0.066, 0.048, 9, 0.18, -0.1), 4, 0.16, 0.002);
      D.losses.push(p); D.trat.push({ poly: p, mode: 'form' }); }
    { const p = fractalPoly(rng, blobPoly(rng, u0 + 0.62 * A + 0.03, 0.962, 0.042, 0.03, 8, 0.2, 0), 4, 0.16, 0.002); D.losses.push(p); D.neutral.push(p); }
    { const [x, y] = nudge(u0 + 0.05 * A + 0.045, 0.565, 0.032, 0.04, -0.015, 0.03);
      const p = fractalPoly(rng, blobPoly(rng, x, y, 0.032, 0.04, 8, 0.25, 0.4), 4, 0.16, 0.002); D.losses.push(p); D.neutral.push(p); }

    const walk = (x, y, dir, len, w, rr) => {
      const pts = [[x, y]];
      let a = dir;
      for (let d = 0; d < len; d += 0.0035) {
        a += rr.n() * 0.42;
        a = a * 0.8 + dir * 0.2;
        for (const z of D.avoid) {
          const dx = (x - z[0]) / (z[2] + 0.03), dy = (y - z[1]) / (z[3] + 0.03), q = dx * dx + dy * dy;
          if (q < 2.2) { const away = Math.atan2(dy, dx); let da = away - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; a += da * 0.25 * (2.2 - q); }
        }
        x += Math.cos(a) * 0.0035; y += Math.sin(a) * 0.0035;
        pts.push([x, y]);
      }
      return { pts, w };
    };
    const cr = RNG(seed, 'cracks');
    const C1 = walk(u0 + 0.66 * A, -0.02, Math.PI / 2 + 0.1, 1.1, 0.002, cr);
    const C2 = walk(u0 - 0.02, 0.555, 0.22, 0.42 * Math.max(A, 0.8), 0.0017, cr);
    const C3 = walk(uR0 - 0.2 * s2, 0.79, -2.6, 0.3, 0.0015, cr);
    const C4 = walk(u0 + 0.3 * w1, 0.31, 1.35, 0.32, 0.0014, cr);
    D.cracks.push(C1, C2, C3, C4);
    for (const C of [C1, C2, C3, C4]) {
      const nb = 1 + ((cr() * 3) | 0);
      for (let b = 0; b < nb; b++) {
        const p = C.pts[(cr() * C.pts.length) | 0], last = C.pts[C.pts.length - 1];
        D.cracks.push(walk(p[0], p[1], Math.atan2(last[1] - C.pts[0][1], last[0] - C.pts[0][0]) + (cr() < 0.5 ? -1 : 1) * cr.r(0.6, 1.3), cr.r(0.04, 0.14), C.w * 0.55, cr));
      }
    }
    for (const C of D.cracks) {
      for (let i = 2; i < C.pts.length - 2; i++) {
        if (cr() < 0.06) {
          const [x, y] = C.pts[i];
          if (avoided(x, y, 0.01)) continue;
          D.losses.push(fractalPoly(cr, blobPoly(cr, x, y, cr.r(0.003, 0.009), cr.r(0.002, 0.006), 6, 0.3, cr() * 3), 3, 0.25, 0.0015));
        }
      }
    }
    { const n = C2.pts.length; D.neutralStrokes.push(C2.pts.slice(Math.floor(n * 0.15), Math.floor(n * 0.55))); }

    const fr = RNG(seed, 'flakes');
    let made = 0, guard = 0;
    while (made < 26 && guard++ < 600) {
      let x, y;
      const t = fr();
      if (t < 0.45) { x = fr.r(u0, uR0); y = fr.r(0.74, 0.99); }
      else if (t < 0.7) { x = u0 + fr.r(0, w1 * 1.3); y = fr.r(0.0, 0.5); }
      else { x = fr.r(u0, uR0); y = fr.r(0.03, 0.97); }
      if (avoided(x, y, 0.015)) continue;
      const r = fr.r(0.003, 0.016) * (t < 0.45 ? 0.8 : 1);
      D.losses.push(fractalPoly(fr, blobPoly(fr, x, y, r, r * fr.r(0.6, 1), 7, 0.3, fr() * 3), 3, 0.22, 0.0015));
      made++;
    }
    // fine shrinkage cracks: short straight runs that turn sharply, here and there
    const fn = new Noise(seed ^ 0x77aa), fc = RNG(seed, 'fine');
    const nf = Math.round(200 * A);
    for (let n = 0; n < nf; n++) {
      let x = fc.r(u0, uR0), y = fc.r(0, 1);
      if (fn.fbm(x * 3, y * 3, 3) < 0.48) continue;
      let a = fc() * TAU;
      const pts = [[x, y]], segs = 2 + ((fc() * 5) | 0);
      for (let s = 0; s < segs; s++) {
        const L = fc.r(0.006, 0.02);
        a += fc.r(-1.1, 1.1);
        x += Math.cos(a) * L; y += Math.sin(a) * L;
        pts.push([x, y]);
        if (fc() < 0.25) D.fine.push([[x, y], [x + Math.cos(a + 1.4) * L * 0.6, y + Math.sin(a + 1.4) * L * 0.6]]);
      }
      D.fine.push(pts);
    }
    D.incisions.push([[sc.uL, FT - 0.0002], [sc.uR, FT + 0.0002]], [[sc.uL, FBOT - 0.0003], [sc.uR, FBOT + 0.0002]], [[sc.uL, DADO + 0.0046], [sc.uR, DADO + 0.0043]]);
    { const b = sc.basin, pts = []; for (let q = 0; q <= 48; q++) { const a = (q / 48) * TAU; pts.push([b.x + Math.cos(a) * b.rx * 1.002, b.y + Math.sin(a) * b.ry * 1.03]); } D.incisions.push(pts); }

    const gr = RNG(seed, 'graffito');
    const name = gr.pick(['FELIX', 'SECVNDVS', 'CELADVS', 'PRIMA', 'CRESCENS', 'AMIANTHVS', 'HELPIS']);
    const gx0 = u0 + 0.28 * A + gr.r(-0.03, 0.03), gy0 = 0.946 + gr.r(-0.004, 0.004), hgt = 0.0165, slant = 0.22, cursiveE = gr() < 0.6;
    let cx = gx0;
    for (const ch of name) {
      const g = ch === 'E' && cursiveE ? GLYPHS.E2 : GLYPHS[ch];
      if (!g) { cx += hgt * 0.5; continue; }
      const rot = gr.r(-0.08, 0.08), sz = hgt * gr.r(0.88, 1.12), dy = gr.r(-0.0025, 0.0025);
      for (const st of g.s) {
        D.graffito.push(st.map(([x, y]) => {
          const xx = (x + (1 - y) * slant) * sz, yy = y * sz;
          return [cx + xx * Math.cos(rot) - yy * Math.sin(rot) + gr.n() * 0.00035, gy0 + dy + xx * Math.sin(rot) + yy * Math.cos(rot) + gr.n() * 0.00035];
        }));
        if (gr() < 0.3) D.graffito.push(st.slice(0, 2).map(([x, y]) => [cx + (x + (1 - y) * slant) * sz + 0.0006, gy0 + dy + y * sz + 0.0005]));
      }
      cx += (g.w + 0.26) * hgt * gr.r(0.9, 1.2);
    }
    { const bx = cx + 0.022, by = gy0 + 0.002, s = 0.026, P = (x, y) => [bx + x * s, by + y * s];
      D.graffito.push([P(0, 0.3), P(0.15, 0.1), P(0.45, 0.15), P(0.75, 0.45), P(1.1, 0.4)], [P(0.15, 0.1), P(0.1, 0.45), P(0.4, 0.62), P(0.75, 0.45)],
        [P(0, 0.3), P(-0.14, 0.34)], [P(0.4, 0.62), P(0.38, 0.86)], [P(0.5, 0.6), P(0.52, 0.86)], [P(0.75, 0.45), P(1.06, 0.64)], [P(0.4, 0.3), P(0.7, 0.42)]); }
    return D;
  }

  /* ============================================================ tratteggio
   * Brandi's tratteggio: vertical strokes of pure watercolour, laid row by row, that mix in the eye
   * to the tone around the lacuna — and fall apart into honest hatching up close. */
  const TPAL = [[46, 92, 172], [84, 150, 196], [38, 122, 98], [204, 158, 66], [176, 116, 58], [160, 70, 44], [44, 40, 38]];
  const TGROUND = [233, 226, 211];
  function tratteggio(T, sc, D, S, lowA, lowB, seed) {
    const rng = RNG(seed, 'trat');
    const pal = TPAL.concat([TGROUND]), combos = [];
    for (let a = 0; a < pal.length; a++) for (let b = a; b < pal.length; b++) for (let c = b; c < pal.length; c++) combos.push([a, b, c]);
    const cover = 0.62;
    const cm = combos.map((cb) => [0, 1, 2].map((ch) => TGROUND[ch] * (1 - cover) + cover * (pal[cb[0]][ch] + pal[cb[1]][ch] + pal[cb[2]][ch]) / 3));
    const sample = (img, f, x, y) => {
      const w = img.w, h = img.h;
      const fx = clamp(x / f - 0.5, 0, w - 1.001), fy = clamp(y / f - 0.5, 0, h - 1.001), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, o = [0, 0, 0];
      for (let ch = 0; ch < 3; ch++) {
        const a = img.d[(iy * w + ix) * 4 + ch], b = img.d[(iy * w + ix + 1) * 4 + ch], c = img.d[((iy + 1) * w + ix) * 4 + ch], d = img.d[((iy + 1) * w + ix + 1) * 4 + ch];
        o[ch] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      }
      return o;
    };
    const rowH = 0.0105 * S, gap = 0.0011 * S, sp = Math.max(1.5, 0.0024 * S), lw = Math.max(0.9, sp * 0.62);
    for (const t of D.trat) {
      const pts = t.poly.map(([u, v]) => [(u - sc.u0) * S, v * S]);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const path = polyPath(pts.map((p) => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [p[0] + (dx / d) * 0.0012 * S, p[1] + (dy / d) * 0.0012 * S]; }));
      T.save();
      T.fillStyle = css(TGROUND); T.fill(path);
      T.clip(path);
      T.lineCap = 'round';
      const wF = t.mode === 'form' ? 0.85 : 0.25;
      for (let ry = y0 - rng() * rowH; ry < y1; ry += rowH + gap) {
        let col = 0, cb = null;
        for (let x = x0 - rng() * sp; x < x1; x += sp, col++) {
          if (col % 3 === 0) {
            const yc = ry + rowH / 2;
            let tg = mixc(sample(lowB, 8 * lowB.f, x + sp, yc), sample(lowA, 2 * lowA.f, x + sp, yc), wF);
            const lum = tg[0] * 0.3 + tg[1] * 0.55 + tg[2] * 0.15;
            tg = mixc(tg, [lum + 6, lum + 8, lum + 2], 0.28).map((v) => v * 0.94 + 18);
            let best = 0, be = 1e9;
            for (let q = 0; q < cm.length; q++) {
              const m = cm[q], cbq = combos[q];
              let spread = 0;
              for (let z = 0; z < 3; z++) { const pz = pal[cbq[z]]; spread += (pz[0] - tg[0]) ** 2 + (pz[1] - tg[1]) ** 2 + (pz[2] - tg[2]) ** 2; }
              const e = (m[0] - tg[0]) ** 2 * 0.8 + (m[1] - tg[1]) ** 2 + (m[2] - tg[2]) ** 2 * 0.7 + spread * 0.05;
              if (e < be) { be = e; best = q; }
            }
            cb = combos[best].slice();
            for (let i = 2; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const tmp = cb[i]; cb[i] = cb[j]; cb[j] = tmp; }
          }
          const ci = cb[col % 3];
          if (ci === pal.length - 1) continue;
          const pc = pal[ci];
          const ya = ry + rng.r(-0.08, 0.12) * rowH, yb = ry + rowH * rng.r(0.86, 1.02);
          const xa = x + rng.r(-0.1, 0.1) * sp, xb = xa + rng.r(-0.06, 0.06) * sp;
          T.strokeStyle = css(jit(pc, rng, 8), rng.r(0.72, 0.92));
          T.lineWidth = lw * rng.r(0.85, 1.12);
          T.beginPath(); T.moveTo(xa, ya); T.lineTo(xb, yb); T.stroke();
          T.fillStyle = css(mixc(pc, [20, 20, 20], 0.15), 0.35);
          T.beginPath(); T.arc(xb, yb - lw * 0.3, lw * 0.5, 0, TAU); T.fill();
        }
      }
      T.restore();
    }
  }

  /* ================================================================ shaders */
  const VS = '#version 300 es\nin vec2 aP;\nvoid main(){ gl_Position = vec4(aP, 0.0, 1.0); }';
  const GLSL_COMMON = `#version 300 es
precision highp float;
precision highp int;
uint hu(uvec2 q) { q *= uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y) * 1597334673u; return n ^ (n >> 16); }
float h12(vec2 p) { uvec2 q = uvec2(ivec2(floor(p)) + ivec2(131072)); return float(hu(q)) * 2.3283064e-10; }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = h12(i), b = h12(i + vec2(1.0, 0.0)), c = h12(i + vec2(0.0, 1.0)), d = h12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int o) {
  float s = 0.0, a = 1.0, t = 0.0;
  for (int i = 0; i < 5; i++) { if (i >= o) break; s += a * vn(p); t += a; a *= 0.5; p = p * 2.03 + vec2(17.1, -9.7); }
  return s / t;
}
uniform float uHMax;
vec4 packH(float h) { float v = floor(clamp(h / uHMax, 0.0, 1.0) * 65535.0 + 0.5); float hi = floor(v / 256.0); return vec4(hi / 255.0, (v - hi * 256.0) / 255.0, 0.0, 1.0); }
float unpackH(vec4 t) { return (t.r * 65280.0 + t.g * 255.0) / 65535.0 * uHMax; }
`;

  // pass 1: the object — albedo and height of plaster, paint, fills and damage
  const FS_SURFACE = GLSL_COMMON + `
uniform sampler2D tPaint, tTrat, tSin, tLines, tMS, tMM, tMB, tFA, tFB;
uniform vec2 uRes, uSd;
uniform float uS, uU0, uSlabH, uThick, uGAmp, uImp, uCell;
layout(location = 0) out vec4 oAlb;
layout(location = 1) out vec4 oH;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y), uv = p / uRes;
  vec2 U = vec2(uU0 + p.x / uS, p.y / uS);
  vec4 mm = texture(tMM, uv);
  float sl = mm.b;
  if (sl < 0.02) { oAlb = vec4(0.0); oH = packH(0.0); return; }
  vec4 ms = texture(tMS, uv), mb = texture(tMB, uv), fa = texture(tFA, uv), fb = texture(tFB, uv);
  float fade = fa.r, salt = fa.g, dirt = fa.b, abrM = fa.a, mot = fb.r, halo = fb.g, chalk = fb.b, tide = fb.a;
  float eN = fbm(U * 48.0 + uSd, 3), eH = fbm(U * 120.0 + uSd.yx, 2);
  float g = h12(p + uSd * 97.0), g2 = h12(floor(p * 0.5) + uSd * 31.0);
  float gs = vn(p * 0.6 + uSd * 7.0);

  // the slab: crumbled edge, a bevel of broken mortar
  float e = sl + (eN - 0.5) * 0.5 + (g - 0.5) * 0.05;
  float alpha = smoothstep(0.30, 0.36, e), bev = smoothstep(0.31, 0.95, e);
  float hBase = uSlabH * (0.3 + 0.7 * pow(bev, 0.7)) + (eN - 0.5) * uSlabH * 0.35 * (1.0 - bev);
  float iB = mm.r, iS = ms.r, nf = ms.g;
  vec4 tr = texture(tTrat, uv);
  float ii = iS + (eH - 0.5) * 0.55 + (g - 0.5) * 0.06;
  ii = min(ii, (mb.b - (0.6 + (eN - 0.5) * 0.7)) * 5.0 + 0.5);
  float ip = smoothstep(0.47, 0.53, ii) * (1.0 - max(nf, tr.a));

  vec3 col = vec3(0.0);
  float h = hBase;
  if (ip < 0.999) {
    // arriccio: coarse lime and sand, once hidden
    float m2 = fbm(U * 26.0 + uSd * 2.0, 2);
    float crust = smoothstep(0.55, 0.7, m2 + (mot - 0.5) * 0.4);
    vec2 cid = floor(p / uCell);
    float hh = h12(cid + 7.0);
    vec2 gc = (cid + 0.25 + 0.5 * vec2(h12(cid + 11.0), h12(cid + 13.0))) * uCell;
    float gr = uCell * (0.18 + 0.3 * hh);
    vec2 dd = p - gc;
    float d2 = dot(dd, dd) / (gr * gr);
    float grain = (d2 < 1.0 && hh > 0.3) ? sqrt(1.0 - d2) * (1.0 - crust * 0.7) : 0.0;
    vec3 ac = vec3(164.0, 153.0, 132.0) * (0.86 + mot * 0.2 + (m2 - 0.5) * 0.16);
    ac = mix(ac, vec3(196.0, 188.0, 170.0), crust * 0.6);
    h += (m2 - 0.5) * uGAmp * 1.6;
    if (grain > 0.0) {
      float ty = h12(cid + 17.0);
      if (ty < 0.55) ac += (ty - 0.27) * 40.0 * grain;
      else if (ty < 0.7) ac = mix(ac, vec3(98.0, 94.0, 90.0), grain * 0.8);
      else if (ty < 0.82) ac = mix(ac, vec3(146.0, 100.0, 74.0), grain * 0.7);
      else ac = mix(ac, vec3(224.0, 218.0, 202.0), grain * 0.75);
      h += grain * uGAmp * (hh < 0.36 ? -1.4 : 0.75);
    }
    vec2 cid2 = floor(p / (uCell * 3.4));
    if (h12(cid2 + 23.0) < 0.06) {
      vec2 gc2 = (cid2 + 0.3 + 0.4 * vec2(h12(cid2 + 29.0), h12(cid2 + 31.0))) * uCell * 3.4;
      float r2 = uCell * 3.4 * (0.18 + 0.2 * h12(cid2 + 37.0));
      vec2 q2 = p - gc2;
      float e2 = dot(q2, q2) / (r2 * r2);
      if (e2 < 1.0) {
        float gg = sqrt(1.0 - e2), t2 = h12(cid2 + 41.0);
        vec3 pc = t2 < 0.4 ? vec3(120.0, 112.0, 104.0) : t2 < 0.7 ? vec3(190.0, 180.0, 160.0) : vec3(112.0, 78.0, 62.0);
        ac = mix(ac, pc, gg * 0.8);
        h += gg * uGAmp * (t2 < 0.2 ? -2.2 : 1.4);
      }
    }
    h += (gs - 0.5) * uGAmp * 0.5;
    // sinopia: red earth brushed onto the arriccio, rubbed where the sand stands proud
    float sa = texture(tSin, uv).a * (0.6 + 0.4 * (1.0 - grain)) * (0.72 + 0.28 * gs);
    ac = mix(ac, vec3(158.0, 62.0, 40.0), sa * 0.86);
    ac = mix(ac, vec3(206.0, 198.0, 180.0), smoothstep(0.06, 0.5, iB) * 0.45);
    ac *= 1.0 - (1.0 - bev) * 0.14;
    col = ac;
    // the conservators' fills
    col = mix(col, vec3(196.0, 185.0, 162.0) * (0.95 + mot * 0.1 + (gs - 0.5) * 0.05), nf);
    h = mix(h, uSlabH + uThick * 0.72 + (gs - 0.5) * uGAmp * 0.2, nf);
    col = mix(col, tr.rgb * 255.0, tr.a);
    h = mix(h, uSlabH + uThick * 0.82 + (gs - 0.5) * uGAmp * 0.1, tr.a);
  }

  if (ip > 0.001) {
    // intonaco: the painted skin
    vec2 wq = U * 120.0 + uSd * 3.3;
    vec2 wv = vec2(vn(wq) + 0.5 * vn(wq * 2.1 + 7.7), vn(wq + 19.3) + 0.5 * vn(wq * 2.1 - 4.1)) / 1.5 - 0.5;
    vec2 uvw = uv + wv * (0.0024 * uS) / uRes;
    vec3 c0 = textureLod(tPaint, uvw, 0.0).rgb * 255.0;
    vec3 c = mix(c0, textureLod(tPaint, uvw, 1.3).rgb * 255.0, 0.3);
    float relief = dot(c0 - textureLod(tPaint, uv, 3.2).rgb * 255.0, vec3(0.3, 0.55, 0.15)) / 255.0;
    float blu = clamp((c.b - c.r) / 70.0, 0.0, 1.0) * clamp((c.b - c.g + 40.0) / 50.0, 0.0, 1.0);
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    c = mix(c, vec3(lum * 0.97 + 18.0, lum * 1.02 + 16.0, lum * 0.9 + 8.0), fade * blu * 0.62);
    c *= 1.0 - tide * 0.07 * blu;
    float gq = h12(floor(p * 0.7) + uSd * 3.0);
    if (gq < 0.04 * blu) c = c * vec3(0.72, 0.82, 0.96) + vec3(0.0, 0.0, 10.0);
    else if (gq > 1.0 - 0.02 * blu) c += vec3(22.0, 26.0, 24.0);
    c = mix(c, vec3(234.0, 228.0, 212.0), 0.08 + chalk * 0.12);
    if (abrM > 0.01) {
      float abS = fbm(U * vec2(22.0, 70.0) + uSd * 0.3, 2);
      c = mix(c, vec3(214.0, 204.0, 184.0), abrM * smoothstep(0.6, 0.78, abS) * 0.35);
    }
    float pp = 1.0 - halo * (1.0 - smoothstep(0.42, 0.62, iB + (eH - 0.5) * 0.3));
    c = mix(vec3(208.0, 200.0, 182.0), c, pp);
    c *= 1.0 + (gs - 0.5) * 0.06 + (g - 0.5) * 0.025;
    c = c * vec3(1.0, 0.985, 0.94) + vec3(5.0, 3.0, 0.0);
    col = mix(col, c, ip);
    h = mix(h, uSlabH + uThick * (0.74 + 0.26 * pp) + relief * uImp + (mot - 0.5) * uThick * 0.3 + (gs - 0.5) * uGAmp * 0.18, ip);
  }

  // cracks, incisions, the graffito
  vec4 ln = texture(tLines, uv);
  float crk = ln.r * (1.0 - nf);
  col = mix(col, col * vec3(0.7, 0.66, 0.62), crk); h -= crk * uThick * 1.5;
  float fcr = ln.g * ip; col *= 1.0 - 0.26 * fcr; h -= fcr * uThick * 0.3;
  float gf = ln.b * ip; col = mix(col, vec3(230.0, 214.0, 198.0), gf * 0.78); h -= gf * uThick * 0.3;

  // salt and grime
  float s2 = salt * (0.45 + 0.55 * g2) + (1.0 - iB) * ip * 0.1;
  col = mix(col, vec3(240.0, 238.0, 230.0), s2 * 0.3);
  col = col * (1.0 - dirt * 0.2) + vec3(4.0, 2.0, 0.0);
  oAlb = vec4(clamp(col / 255.0, 0.0, 1.0), alpha);
  oH = packH(h);
}`;

  // pass 2: blurred height (half resolution) for ambient occlusion
  const FS_BLUR = GLSL_COMMON + `
uniform sampler2D tSrc;
uniform ivec2 iDir, iSrcMax;
uniform int iR, iDown;
out vec4 o;
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy) * (iDown == 1 ? 2 : 1);
  float s = 0.0;
  for (int k = -iR; k <= iR; k++) s += unpackH(texelFetch(tSrc, clamp(q + iDir * k, ivec2(0), iSrcMax), 0));
  o = packH(s / float(2 * iR + 1));
}`;

  // pass 3: one soft gallery light from above
  const FS_LIGHT = GLSL_COMMON + `
uniform sampler2D tAlb, tH, tHb;
uniform vec2 uRes, uSdir;
uniform vec3 uL;
uniform float uRise, uK, uStride, uThick, uAmb, uDif, uFlat, uGal, uStride2;
uniform vec4 uPool, uTorch;
uniform vec3 uAim;
out vec4 o;
float Hat(ivec2 q) { return unpackH(texelFetch(tH, clamp(q, ivec2(0), ivec2(uRes) - 1), 0)); }
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec4 al = texelFetch(tAlb, q, 0);
  if (al.a <= 0.0) { o = vec4(0.0); return; }
  float h0 = Hat(q);
  float hl = Hat(q + ivec2(-1, 0)), hr = Hat(q + ivec2(1, 0)), hu = Hat(q + ivec2(0, 1)), hd = Hat(q + ivec2(0, -1));
  vec3 n = normalize(vec3(-(hr - hl) * 0.5, -(hd - hu) * 0.5, 1.0));
  float ndl = dot(n, uL);
  float occ = 0.0;
  vec2 sd = vec2(uSdir.x, -uSdir.y);
  int K = int(uK);
  for (int k = 1; k <= K; k++) {
    float fk = float(k) * uStride;
    float dh = Hat(q + ivec2(round(sd * fk))) - (h0 + fk * uRise);
    if (dh > 0.0) occ = max(occ, dh / (0.7 + 0.45 * fk));
  }
  float vis = 1.0 - min(1.0, occ);
  float hb = unpackH(texelFetch(tHb, q / 2, 0));
  float ao = 1.0 - clamp((hb - h0) / (uThick * 2.2), 0.0, 0.42);
  vec2 pc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 dd = (pc - uPool.xy) / uPool.zw;
  float pool = 1.06 - 0.2 * dot(dd, dd);
  float shade = (uAmb * ao + uDif * max(0.0, ndl) * vis) / uFlat * pool;
  vec3 c = al.rgb * shade * vec3(1.0, 0.995, 0.975) * uGal;
  if (uTorch.w > 0.002) {
    // a conservator's lamp held low at the side: raking light that finds every ridge and step
    vec2 da = (pc - uAim.xy) / uAim.z;
    float spot = exp(-dot(da, da) * 1.6);
    if (spot > 0.01) {
      vec3 dv = vec3(uTorch.xy - pc, uTorch.z - h0);
      vec3 Lt = normalize(dv);
      float ndt = max(0.0, dot(n, Lt));
      vec2 d2 = normalize(dv.xy + vec2(1e-4));
      float rise2 = Lt.z / max(0.06, length(Lt.xy));
      vec2 sd2 = vec2(d2.x, -d2.y);
      float occ2 = 0.0;
      for (int k = 1; k <= 11; k++) {
        float fk = float(k) * uStride2;
        float dh = Hat(q + ivec2(round(sd2 * fk))) - (h0 + fk * rise2);
        if (dh > 0.0) occ2 = max(occ2, dh / (0.6 + 0.3 * fk));
      }
      float vis2 = 1.0 - min(1.0, occ2);
      c += al.rgb * vec3(1.0, 0.9, 0.74) * (ndt * vis2 * 2.0 + 0.08) * spot * uTorch.w;
    }
  }
  c = clamp(c, 0.0, 1.0);
  o = vec4(c * al.a, al.a);
}`;

  function glSurface(Wp, Hp, inp, prm) {
    const cv = cnv(Wp, Hp);
    let gl = null;
    try { gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    const lose = () => { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); };
    try {
      if (Math.max(Wp, Hp) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) { lose(); return null; }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const mkProg = (fs) => {
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
        const p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        return p;
      };
      const tex = (src, w, h, mip, data) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        if (data !== undefined) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
        if (mip) gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : data === null ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, data === null ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      const target = (w, h, n) => {
        const ts = []; for (let i = 0; i < n; i++) ts.push(tex(null, w, h, false, null));
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
        gl.drawBuffers(ts.map((t, i) => gl.COLOR_ATTACHMENT0 + i));
        return { fb, ts, w, h };
      };
      const run = (prog, tgt, w, h, texs, uni) => {
        gl.useProgram(prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.fb : null);
        gl.viewport(0, 0, w, h);
        let unit = 0;
        for (const name in texs) {
          gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texs[name]);
          gl.uniform1i(gl.getUniformLocation(prog, name), unit++);
        }
        for (const name in uni) {
          const v = uni[name], loc = gl.getUniformLocation(prog, name);
          if (loc === null) continue;
          if (name[0] === 'i') { Array.isArray(v) ? gl.uniform2i(loc, v[0], v[1]) : gl.uniform1i(loc, v); continue; }
          if (!Array.isArray(v)) gl.uniform1f(loc, v);
          else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
          else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
          else gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const T = {
        tPaint: tex(inp.paint, 0, 0, true), tTrat: tex(inp.trat), tSin: tex(inp.sin), tLines: tex(inp.lines),
        tMS: tex(inp.ms), tMM: tex(inp.mm), tMB: tex(inp.mb),
        tFA: tex(null, inp.fw, inp.fh, false, inp.fa), tFB: tex(null, inp.fw, inp.fh, false, inp.fb),
      };
      const pS = mkProg(FS_SURFACE), pB = mkProg(FS_BLUR), pL = mkProg(FS_LIGHT);
      const px1 = new Uint8Array(4), tick = prm.log ? (n) => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); prm.log('  gl ' + n, Math.round(performance.now())); } : () => {};
      tick('upload+compile');
      const t1 = target(Wp, Hp, 2);
      run(pS, t1, Wp, Hp, T, { uRes: [Wp, Hp], uSd: prm.sd, uS: prm.S, uU0: prm.u0, uSlabH: prm.slabH, uThick: prm.thick, uGAmp: prm.gAmp, uImp: prm.imp, uCell: prm.cell, uHMax: prm.hmax });
      tick('surface');
      const hw = Math.ceil(Wp / 2), hh = Math.ceil(Hp / 2), R = Math.max(2, Math.min(24, Math.round(0.002 * prm.S)));
      const t2 = target(hw, hh, 1), t3 = target(hw, hh, 1);
      run(pB, t2, hw, hh, { tSrc: t1.ts[1] }, { iDir: [1, 0], iSrcMax: [Wp - 1, Hp - 1], iR: R * 2 > 24 ? 24 : R * 2, iDown: 1, uHMax: prm.hmax });
      run(pB, t3, hw, hh, { tSrc: t2.ts[0] }, { iDir: [0, 1], iSrcMax: [hw - 1, hh - 1], iR: R, iDown: 0, uHMax: prm.hmax });
      const LT = { tAlb: t1.ts[0], tH: t1.ts[1], tHb: t3.ts[0] };
      const LU = { uRes: [Wp, Hp], uSdir: prm.sdir, uL: prm.L, uRise: prm.rise, uK: prm.K, uStride: prm.stride, uThick: prm.thick, uAmb: prm.amb, uDif: prm.dif,
        uFlat: prm.flat, uPool: prm.pool, uHMax: prm.hmax, uGal: 1, uTorch: [0, 0, 1, 0], uAim: [0, 0, 1], uStride2: Math.max(1, (0.045 * prm.S) / 11) };
      run(pL, null, Wp, Hp, LT, LU);
      tick('light');
      const still = cnv(Wp, Hp);
      still.getContext('2d').drawImage(cv, 0, 0);
      // only what the light needs stays on the card
      for (const k in T) gl.deleteTexture(T[k]);
      gl.deleteTexture(t2.ts[0]); gl.deleteFramebuffer(t2.fb);
      gl.deleteProgram(pS); gl.deleteProgram(pB);
      let dead = false, sync = null;
      return {
        canvas: cv, still,
        // never queue more light than the card has finished: one frame in flight at a time
        busy() {
          if (!sync || dead) return false;
          if (gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED) return true;
          gl.deleteSync(sync); sync = null;
          return false;
        },
        relight(o, rect) {
          if (dead || gl.isContextLost()) return;
          LU.uGal = o.gal; LU.uTorch = o.torch; LU.uAim = o.aim;
          if (rect) {
            const x0 = clamp(Math.floor(rect[0]), 0, Wp), y0 = clamp(Math.floor(rect[1]), 0, Hp), x1 = clamp(Math.ceil(rect[2]), 0, Wp), y1 = clamp(Math.ceil(rect[3]), 0, Hp);
            if (x1 <= x0 || y1 <= y0) return;
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(x0, Hp - y1, x1 - x0, y1 - y0);
          }
          run(pL, null, Wp, Hp, LT, LU);
          gl.disable(gl.SCISSOR_TEST);
          sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
        },
        lose() { if (!dead) { dead = true; if (sync) gl.deleteSync(sync); lose(); } },
      };
    } catch (e) {
      console.error(e);
      lose();
      return null;
    }
  }

  /* ============================================================== pipeline */
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function c2d(c) { return c.getContext('2d', { willReadFrequently: true }); }
  const hasFilter = (() => { try { return typeof cnv(2, 2).getContext('2d').filter === 'string'; } catch (e) { return false; } })();

  function boxBlur(src, w, h, r) {
    r = Math.max(1, Math.round(r));
    const a = Float32Array.from(src), b = new Float32Array(src.length), inv = 1 / (2 * r + 1);
    for (let p = 0; p < 3; p++) {
      for (let y = 0; y < h; y++) {
        const o = y * w;
        let s = 0;
        for (let k = -r; k <= r; k++) s += a[o + clamp(k, 0, w - 1)];
        for (let x = 0; x < w; x++) { b[o + x] = s * inv; const ad = x + r + 1, rm = x - r; s += a[o + (ad < w ? ad : w - 1)] - a[o + (rm > 0 ? rm : 0)]; }
      }
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += b[clamp(k, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) { a[y * w + x] = s * inv; const ad = y + r + 1, rm = y - r; s += b[(ad < h ? ad : h - 1) * w + x] - b[(rm > 0 ? rm : 0) * w + x]; }
      }
    }
    return a;
  }
  // a blurred copy of a mask canvas, at a fraction of its resolution
  function blurred(src, r, scale) {
    const w = Math.max(2, Math.round(src.width * scale)), h = Math.max(2, Math.round(src.height * scale));
    const d = cnv(w, h), x = c2d(d);
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    if (hasFilter) {
      x.filter = 'blur(' + Math.max(0.3, r * scale).toFixed(2) + 'px)';
      x.drawImage(src, 0, 0, w, h);
      return d;
    }
    x.drawImage(src, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    for (let ch = 0; ch < 3; ch++) {
      const f = new Float32Array(w * h);
      for (let i = 0; i < f.length; i++) f[i] = id.data[i * 4 + ch];
      const bl = boxBlur(f, w, h, r * scale * 0.58);
      for (let i = 0; i < f.length; i++) id.data[i * 4 + ch] = bl[i];
    }
    x.putImageData(id, 0, 0);
    return d;
  }

  function layout(W, H) {
    const portrait = W / H < 0.85;
    const mx = Math.max(16, W * (portrait ? 0.05 : 0.1));
    const topM = H * (portrait ? 0.075 : 0.085), botM = H * 0.15;
    const aw = W - 2 * mx, ah = H - topM - botM;
    const A = clamp(aw / ah, 0.55, 1.9);
    let fw, fh;
    if (aw / ah > A) { fh = ah; fw = fh * A; } else { fw = aw; fh = fw / A; }
    const fx = (W - fw) / 2, fy = topM + (ah - fh) * 0.42;
    const t = clamp((A - 0.55) / (1.2 - 0.55), 0, 1);
    const u0 = 0.95 - lerp(0.68, 0.58, t) * A;
    return { fx, fy, fw, fh, A, u0 };
  }

  async function render(job) {
    const { W, H, dpr, seed, step } = job;
    const L = layout(W, H), { A, u0 } = L;
    let s = dpr;
    if (L.fw * L.fh * s * s > 3.4e6) s = Math.sqrt(3.4e6 / (L.fw * L.fh));
    const Wp = Math.max(8, Math.round(L.fw * s)), Hp = Math.max(8, Math.round(L.fh * s)), S = Hp;
    const kp = s > 1.3 ? 1.3 / s : 1;                       // the painting itself is soft; paint it a little smaller
    const Pw = Math.round(Wp * kp), Ph = Math.round(Hp * kp), Sp = Ph;
    const T0 = performance.now(), mark = (n) => job.log && job.log(n, Math.round(performance.now() - T0));

    const sc = buildScene(seed, A, u0);
    const D = buildDamage(seed, sc);
    await step();

    /* ---- the painter's day: paint into wet lime ---- */
    const pc = cnv(Pw, Ph), px = c2d(pc);
    px.setTransform(Sp, 0, 0, Sp, -u0 * Sp, 0);
    const P = new Painter(px, seed ^ 0x5bd1);
    const flush = () => px.getImageData(0, 0, 1, 1);
    const prng = RNG(seed, 'paint');
    paintSky(P, sc, prng); flush(); await step();
    const order = ['myrW', 'oleT', 'pom', 'quince'];
    const trees = sc.trees.slice().sort((a, b) => order.indexOf(a.def.id) - order.indexOf(b.def.id));
    const paintPlant = async (pl, r) => {
      if (pl.def.trunks.length) paintTrunks(P, pl);
      paintUnder(P, pl, r);
      if (pl.def.trunks.length) paintBranches(P, pl);
      flush(); await step();
      for (let k = 0; k < pl.sprays.length; k += 300) { paintSprays(P, pl, k, k + 300); flush(); await step(); }
      if (pl.def.fruit) paintFruit(P, pl, r);
      if (pl.def.flowers) paintFlowers(P, pl, r);
    };
    for (const pl of trees) {
      const r = RNG(seed, 'pp' + pl.def.id);
      await paintPlant(pl, r);
      if (pl.def.id === 'pom') paintSmallBird(P, sc.lost, PAL_ORIOLE, true);
      if (pl.def.id === 'oleT') paintSmallBird(P, sc.warbler, PAL_WARBLER, false);
      if (pl.def.perch) paintBranches(P, pl, pl.def.perch);
      flush(); await step();
    }
    paintGround(P, sc, RNG(seed, 'ground')); flush(); await step();
    for (let i = 0; i < sc.shrubs.length; i++) await paintPlant(sc.shrubs[i], RNG(seed, 'sh' + i));
    paintBasin(P, sc.basin);
    paintDove(P, sc.dove);
    paintJay(P, sc.jay);
    paintSwallow(P, sc.swallow);
    flush(); await step();
    paintFence(P, sc, prng);
    paintSmallBird(P, sc.finch, PAL_FINCH, true);
    flush(); await step();
    paintFlowerBed(P, sc, prng); flush(); await step();
    paintDado(P, sc, prng); flush(); await step();
    mark('painting');

    /* ---- sinopia, on the arriccio beneath ---- */
    const sc2 = cnv(Pw, Ph), sx = c2d(sc2);
    sx.setTransform(Sp, 0, 0, Sp, -u0 * Sp, 0);
    sinopia(sx, sc, RNG(seed, 'sinopia'));
    await step();

    /* ---- the conservator's tratteggio ---- */
    const la = cnv(Math.ceil(Pw / 2), Math.ceil(Ph / 2)), lax = c2d(la);
    lax.drawImage(pc, 0, 0, la.width, la.height);
    const lb = cnv(Math.ceil(Pw / 8), Math.ceil(Ph / 8)), lbx = c2d(lb);
    lbx.drawImage(la, 0, 0, lb.width, lb.height);
    const lowA = { d: lax.getImageData(0, 0, la.width, la.height).data, w: la.width, h: la.height, f: 1 / kp };
    const lowB = { d: lbx.getImageData(0, 0, lb.width, lb.height).data, w: lb.width, h: lb.height, f: 1 / kp };
    const tc = cnv(Wp, Hp), tx = c2d(tc);
    tratteggio(tx, sc, D, S, lowA, lowB, seed);
    await step();
    mark('trat');

    /* ---- masks: what survives, what was filled, where it cracked ---- */
    const mc = cnv(Wp, Hp), mx = c2d(mc);
    mx.fillStyle = '#000'; mx.fillRect(0, 0, Wp, Hp);
    mx.setTransform(S, 0, 0, S, -u0 * S, 0);
    mx.lineCap = 'round'; mx.lineJoin = 'round';
    const outline = polyPath(D.outline);
    const strokeList = (ctx, list, w, style) => { ctx.strokeStyle = style; ctx.lineWidth = w; for (const st of list) { ctx.beginPath(); st.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); } };
    mx.fillStyle = '#f00'; mx.fill(outline);
    mx.fillStyle = '#000';
    for (const l of D.losses) mx.fill(polyPath(l));
    strokeList(mx, D.neutralStrokes, 0.007, '#000');
    mx.fillStyle = '#f00';
    for (const l of D.islands) mx.fill(polyPath(l));
    mx.globalCompositeOperation = 'lighter';
    mx.fillStyle = '#0f0';
    for (const l of D.neutral) mx.fill(polyPath(l));
    strokeList(mx, D.neutralStrokes, 0.0085, '#0f0');
    mx.fillStyle = '#00f'; mx.fill(outline);
    mx.globalCompositeOperation = 'source-over';
    await step();
    const ms = blurred(mc, Math.max(0.6, 0.0011 * S), 1);
    const mm = blurred(mc, 0.0065 * S, 0.5);
    const mb = blurred(mc, 0.022 * S, 0.25);
    await step();
    const lc = cnv(Wp, Hp), lx = c2d(lc);
    lx.fillStyle = '#000'; lx.fillRect(0, 0, Wp, Hp);
    lx.setTransform(S, 0, 0, S, -u0 * S, 0);
    lx.globalCompositeOperation = 'lighter';
    lx.lineCap = 'round'; lx.lineJoin = 'round';
    lx.fillStyle = 'rgb(255,0,0)';
    for (const C of D.cracks) lx.fill(strokePath(C.pts, Math.max(C.w, 1.5 / S), Math.max(C.w * 0.4, 0.9 / S), 0.08, 0.3));
    strokeList(lx, D.fine, Math.max(0.9 / S, 0.0008), 'rgb(0,190,0)');
    strokeList(lx, D.incisions, Math.max(0.8 / S, 0.0007), 'rgb(0,120,0)');
    strokeList(lx, D.graffito, Math.max(1.0 / S, 0.0011), 'rgb(0,0,255)');
    lx.globalCompositeOperation = 'source-over';
    await step();
    mark('masks');

    /* ---- slow fields of time: fading, salts, grime, wear ---- */
    const nz = [];
    for (let k = 0; k < 8; k++) nz.push(new Noise((seed * 31 + k * 7919) >>> 0));
    const st = Math.max(4, Math.round(0.007 * S));
    const fw = Math.ceil(Wp / st) + 1, fh = Math.ceil(Hp / st) + 1, FA = new Uint8Array(fw * fh * 4), FB = new Uint8Array(fw * fh * 4);
    for (let j = 0; j < fh; j++) {
      for (let i = 0; i < fw; i++) {
        const u = u0 + ((i + 0.5) * Wp) / fw / S, v = ((j + 0.5) * Hp) / fh / S, o = (j * fw + i) * 4;
        const jd = ((u - 0.95) / 0.26) ** 2 + ((v - 0.4) / 0.16) ** 2;
        const f0 = nz[0].fbm(u * 2.2 + 3, v * 2.2, 4) - Math.max(0, 1 - jd) * 0.2;
        FA[o] = 255 * (sstep(0.525, 0.575, f0) * 0.85 + 0.12 * sstep(0.4, 0.8, nz[0].fbm(u * 9, v * 9, 2)) * Math.min(1, jd));
        FA[o + 1] = 255 * sstep(0.56, 0.84, nz[1].fbm(u * 4, v * 4, 4) + (v - 0.6) * 0.4);
        FA[o + 2] = 255 * sstep(0.3, 0.95, nz[2].fbm(u * 2.2, v * 2.2, 4) * 0.75 + v * 0.32);
        FA[o + 3] = 255 * sstep(0.52, 0.72, nz[3].fbm(u * 3.5, v * 3.5, 3));
        FB[o] = 255 * nz[4].fbm(u * 14, v * 14, 3);
        FB[o + 1] = 255 * sstep(0.45, 0.68, nz[5].fbm(u * 5, v * 5, 3));
        FB[o + 2] = 255 * nz[6].fbm(u * 6, v * 6, 3);
        FB[o + 3] = 255 * Math.max(0, 1 - Math.abs(f0 - 0.522) / 0.01);
      }
    }
    await step();
    mark('fields');

    /* ---- build and light the object ---- */
    let lx0 = -0.3, ly0 = -0.62, lz0 = 0.72;
    const ll = Math.hypot(lx0, ly0, lz0); lx0 /= ll; ly0 /= ll; lz0 /= ll;
    const lxy = Math.hypot(lx0, ly0);
    const slabH = 0.035 * S, thick = 0.0045 * S;
    const prm = {
      S, u0, sd: [(seed % 997) * 0.37 + 11.3, ((seed >>> 10) % 991) * 0.41 + 5.7],
      slabH, thick, gAmp: 0.0012 * S, imp: 0.0035 * S, cell: Math.max(2.2, 0.0028 * S), hmax: 0.05 * S,
      L: [lx0, ly0, lz0], sdir: [lx0 / lxy, ly0 / lxy], rise: lz0 / lxy, K: 9, stride: Math.max(1, (thick * 2.4) / 9),
      amb: 0.42, dif: 0.7, flat: 0.42 + 0.7 * lz0, pool: [Wp * 0.5, Hp * 0.3, Wp * 0.9, Hp * 1.1], log: job.log,
    };
    const gls = glSurface(Wp, Hp, { paint: pc, trat: tc, sin: sc2, lines: lc, ms, mm, mb, fa: FA, fb: FB, fw, fh }, prm);
    mark('gl');
    let still = gls && gls.still;
    if (!still) {
      // no WebGL2: show the painting alone, cut to the fragment's outline
      still = cnv(Wp, Hp);
      const c = still.getContext('2d');
      c.setTransform(S, 0, 0, S, -u0 * S, 0); c.clip(outline);
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(pc, 0, 0, Wp, Hp);
    }
    for (const c of [pc, sc2, tc, mc, lc, ms, mm, mb, la, lb]) { c.width = c.height = 1; }
    return { L, gl: gls, still, Wp, Hp, S, slabH };
  }

  /* ================================================================== room */
  function drawRoom(ctx, W, H, dpr, L, fc, seed) {
    const w = W * dpr, h = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = ROOM; ctx.fillRect(0, 0, w, h);
    const cx = (L.fx + L.fw / 2) * dpr, cy = (L.fy + L.fh * 0.28) * dpr, R = Math.max(w, h) * 0.85;
    const g = ctx.createRadialGradient(cx, cy - L.fh * 0.3 * dpr, R * 0.05, cx, cy, R);
    g.addColorStop(0, '#8b857b'); g.addColorStop(0.35, '#716b62'); g.addColorStop(0.7, '#4b4640'); g.addColorStop(1, '#33302c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const tc = cnv(160, 160), tx = tc.getContext('2d'), id = tx.createImageData(160, 160), r = mulberry32(seed ^ 0xbeef);
    for (let i = 0; i < id.data.length; i += 4) { const v = 110 + r() * 40; id.data[i] = v; id.data[i + 1] = v * 0.98; id.data[i + 2] = v * 0.94; id.data[i + 3] = 255; }
    tx.putImageData(id, 0, 0);
    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(tc, 'repeat'); ctx.fillRect(0, 0, w, h); ctx.restore();
    const S = L.fh * dpr, X = L.fx * dpr, Y = L.fy * dpr, FW = L.fw * dpr, FH = L.fh * dpr;
    const shadow = (blur, dx, dy, col) => {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetX = dx + 30000; ctx.shadowOffsetY = dy;
      ctx.drawImage(fc, X - 30000, Y, FW, FH); ctx.restore();
    };
    shadow(0.05 * S, 0.012 * S, 0.042 * S, 'rgba(20,14,10,0.55)');
    shadow(0.012 * S, 0.004 * S, 0.012 * S, 'rgba(16,12,8,0.55)');
  }

  /* ================================================================= mount */
  function mount(el, api) {
    const wall = document.createElement('canvas');
    wall.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.style.background = ROOM;
    el.style.touchAction = 'none';
    el.appendChild(wall);
    let gen = 0, readyCalled = false, lastW = 0, lastH = 0, timer = 0, dead = false, lastYield = performance.now();
    let frag = null;
    const mc = new MessageChannel(), q = [];
    mc.port1.onmessage = () => { const f = q.shift(); if (f) f(); };
    const yieldNow = () => new Promise((r) => { q.push(r); mc.port2.postMessage(0); });
    const log = /[?&]debug/.test(location.search) ? (n, t) => console.warn('[fresco]', n, t) : null;

    function place(node, L) {
      node.style.cssText = 'position:absolute;display:block;pointer-events:none;left:' + L.fx + 'px;top:' + L.fy + 'px;width:' + L.fw + 'px;height:' + L.fh + 'px';
    }
    function dropFrag() {
      if (!frag) return;
      if (frag.node.parentNode) frag.node.parentNode.removeChild(frag.node);
      if (frag.gl) frag.gl.lose();
      frag = null;
    }
    async function start(W, H) {
      const my = ++gen;
      const alive = () => !dead && my === gen && api.isCurrent();
      const step = async () => {
        if (!alive()) throw CANCEL;
        if (performance.now() - lastYield > 28) { await yieldNow(); lastYield = performance.now(); if (!alive()) throw CANCEL; }
      };
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      try {
        const res = await render({ W, H, dpr, seed: api.seed >>> 0, step, log });
        if (!alive()) { if (res.gl) res.gl.lose(); return; }
        wall.width = Math.round(W * dpr); wall.height = Math.round(H * dpr);
        drawRoom(wall.getContext('2d'), W, H, dpr, res.L, res.still, api.seed >>> 0);
        dropFrag();
        const node = res.gl ? res.gl.canvas : res.still;
        place(node, res.L);
        el.appendChild(node);
        frag = { node, gl: res.gl, still: res.still, L: res.L, Wp: res.Wp, Hp: res.Hp, S: res.S, slabH: res.slabH };
        if (res.gl) {
          const f = frag;
          node.addEventListener('webglcontextlost', () => {
            if (frag !== f) return;
            place(f.still, f.L);
            if (node.parentNode) node.parentNode.replaceChild(f.still, node);
            f.node = f.still; f.gl = null;
            torch.t = 0; wall.style.filter = '';
          });
        }
        torch.t = 0; torch.want = 0; torch.shownT = 0; torch.last = 0; wall.style.filter = '';
        if (!readyCalled) { readyCalled = true; api.ready(); }
      } catch (e) {
        if (e !== CANCEL) { console.error(e); if (!readyCalled) { readyCalled = true; api.ready(); } }
      }
    }
    function schedule() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      const first = !lastW;
      lastW = w; lastH = h;
      clearTimeout(timer);
      timer = setTimeout(() => start(w, h), first ? 0 : 300);
    }

    /* the raking lamp */
    const torch = { x: 0, y: 0, tx: 0, ty: 0, t: 0, want: 0, raf: 0, lastMove: 0, upTimer: 0, last: 0, shownT: -1, sx: 0, sy: 0 };
    function aimAt(e) {
      if (!frag || !frag.gl) return false;
      const r = el.getBoundingClientRect(), L = frag.L;
      const cx = e.clientX - r.left, cy = e.clientY - r.top, m = 24;
      torch.tx = ((cx - L.fx) / L.fw) * frag.Wp; torch.ty = ((cy - L.fy) / L.fh) * frag.Hp;
      if (torch.t < 0.02) { torch.x = torch.tx; torch.y = torch.ty; }
      torch.lastMove = performance.now();
      return cx > L.fx - m && cx < L.fx + L.fw + m && cy > L.fy - m && cy < L.fy + L.fh + m;
    }
    function onMove(e) {
      const inside = aimAt(e);
      if (e.pointerType === 'touch' && e.type === 'pointermove' && e.buttons === 0) return;
      clearTimeout(torch.upTimer);
      torch.want = inside ? 1 : 0;
      kick();
    }
    function onUp(e) {
      if (e.pointerType !== 'mouse') { clearTimeout(torch.upTimer); torch.upTimer = setTimeout(() => { torch.want = 0; kick(); }, 1400); }
    }
    function onLeave() { torch.want = 0; kick(); }
    function kick() { if (!torch.raf && !dead) torch.raf = requestAnimationFrame(frame); }
    function frame(now) {
      torch.raf = 0;
      if (!frag || !frag.gl || dead) return;
      const g = frag.gl;
      if (g.busy()) { kick(); return; }
      const dt = torch.last ? Math.min(0.25, (now - torch.last) / 1000) : 0.016;
      torch.last = now;
      if (torch.want && now - torch.lastMove > 12000) torch.want = 0;
      const rate = dt / (torch.want ? 0.45 : 0.7);
      torch.t = torch.want > torch.t ? Math.min(torch.want, torch.t + rate) : Math.max(torch.want, torch.t - rate);
      const k = 1 - Math.exp(-dt * 16), px = torch.x, py = torch.y;
      torch.x += (torch.tx - torch.x) * k; torch.y += (torch.ty - torch.y) * k;
      const moving = Math.abs(torch.tx - torch.x) + Math.abs(torch.ty - torch.y) > 0.5;
      const e = torch.t * torch.t * (3 - 2 * torch.t), S = frag.S;
      const changedT = e !== torch.shownT;
      if (!changedT && Math.abs(px - torch.x) + Math.abs(py - torch.y) < 0.25 && !moving) { torch.last = 0; return; }
      const R = 0.44 * S;
      const rect = changedT ? null : [Math.min(torch.sx, torch.x) - R, Math.min(torch.sy, torch.y) - R, Math.max(torch.sx, torch.x) + R, Math.max(torch.sy, torch.y) + R];
      g.relight({ torch: [torch.x - 0.17 * S, torch.y - 0.07 * S, frag.slabH + 0.05 * S, e], aim: [torch.x, torch.y, 0.25 * S], gal: 1 - 0.58 * e }, rect);
      torch.shownT = e; torch.sx = torch.x; torch.sy = torch.y;
      wall.style.filter = e > 0.002 ? 'brightness(' + (1 - 0.52 * e).toFixed(3) + ')' : '';
      if (torch.t !== torch.want || moving) kick(); else torch.last = 0;
    }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);

    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    schedule();
    return {
      destroy() {
        dead = true; gen++;
        clearTimeout(timer); clearTimeout(torch.upTimer);
        if (torch.raf) cancelAnimationFrame(torch.raf);
        ro.disconnect();
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerdown', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointerleave', onLeave);
        el.removeEventListener('pointercancel', onLeave);
        mc.port1.onmessage = null; q.length = 0;
        dropFrag();
      },
    };
  }

  if (typeof window.__frescoTest === 'function') window.__frescoTest({ Painter, paintJay, paintDove, paintSmallBird, paintSwallow, paintBasin, PAL_FINCH, PAL_WARBLER, PAL_ORIOLE, css });

  (window.PIECES = window.PIECES || []).push({
    id: 'fresco',
    title: 'Garden Room, Fragment with a Jay',
    medium: 'True fresco on lime plaster, with losses; restored in tratteggio',
    note: 'Hold a light to it: look closely at what was lost.',
    about: 'A fragment cut from the garden room of a buried villa: a painter racing the drying lime, then two thousand years of salt, damp and collapse, then a conservator who would only hatch in what was certain. Every loss is built as plaster with depth — the red sinopia underdrawing waits in the arriccio — and the whole is lit once, from above.',
    tone: 'dark',
    room: ROOM,
    mount,
  });
})();
