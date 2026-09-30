/* core.js — small math toolkit: seeded random, noise, vectors, curves, rotations. */
(function () {
  'use strict';
  const HS = (window.HS = window.HS || {});
  const PI = Math.PI;
  HS.PI = PI;
  HS.TAU = PI * 2;

  HS.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  HS.lerp = (a, b, t) => a + (b - a) * t;
  HS.smooth = (a, b, x) => {
    let t = (x - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  };
  HS.sgnpow = (x, p) => (x < 0 ? -Math.pow(-x, p) : Math.pow(x, p));
  HS.gauss = (x, s) => Math.exp(-(x * x) / (s * s));

  /* mulberry32 */
  HS.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.norm = () => (f() + f() + f() + f() - 2) * 1.732; // ≈ N(0,1)
    f.int = (n) => Math.floor(f() * n);
    return f;
  };

  /* smooth value noise in 3D, returns roughly [-1, 1] */
  HS.makeNoise = function (seed) {
    const r = HS.rng(seed);
    const perm = new Uint8Array(512);
    const val = new Float32Array(256);
    const p = [];
    for (let i = 0; i < 256; i++) { p.push(i); val[i] = r() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    return function (x, y, z) {
      y = y || 0; z = z || 0;
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const X = xi & 255, Y = yi & 255, Z = zi & 255;
      const u = fade(xf), v = fade(yf), w = fade(zf);
      const h = (a, b, c) => val[perm[perm[perm[X + a] + Y + b] + Z + c]];
      const x00 = h(0, 0, 0) + (h(1, 0, 0) - h(0, 0, 0)) * u;
      const x10 = h(0, 1, 0) + (h(1, 1, 0) - h(0, 1, 0)) * u;
      const x01 = h(0, 0, 1) + (h(1, 0, 1) - h(0, 0, 1)) * u;
      const x11 = h(0, 1, 1) + (h(1, 1, 1) - h(0, 1, 1)) * u;
      const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
      return y0 + (y1 - y0) * w;
    };
  };

  /* vec3 helpers on plain arrays */
  const V = (HS.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s], // a + b*s
  });

  /* smooth 1D curve through knots (cubic Hermite, finite-difference tangents, clamped ends) */
  HS.curve1 = function (xs, ys) {
    const n = xs.length;
    const m = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) m[i] = (ys[1] - ys[0]) / (xs[1] - xs[0]);
      else if (i === n - 1) m[i] = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
      else m[i] = (ys[i + 1] - ys[i - 1]) / (xs[i + 1] - xs[i - 1]);
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i];
      const t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] +
             (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  };

  /* Catmull–Rom through 3D/2D points, returns dense polyline */
  HS.catmull = function (pts, per) {
    per = per || 10;
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      for (let s = 0; s < per; s++) {
        const t = s / per, t2 = t * t, t3 = t2 * t;
        out.push(p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(pts[n - 1].slice());
    return out;
  };

  /* 3x3 rotation, row-major array of 9. R = Rz(roll) * Rx(pitch) * Ry(yaw) */
  HS.viewMatrix = function (yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    const Rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
    const mm = (A, B) => {
      const o = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
        o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
      return o;
    };
    return mm(Rz, mm(Rx, Ry));
  };
  HS.applyM = (R, p) => [
    R[0] * p[0] + R[1] * p[1] + R[2] * p[2],
    R[3] * p[0] + R[4] * p[1] + R[5] * p[2],
    R[6] * p[0] + R[7] * p[1] + R[8] * p[2],
  ];
})();
