// cam.js - tiny pinhole camera + 3D helpers for architecture.
(function () {
  'use strict';
  const LW = window.LW;
  const cam = (LW.cam = { f: 2600, cx: 1080, hy: 2200 });
  LW.HORIZON = cam.hy;
  LW.proj = (p) => [cam.cx + (cam.f * p[0]) / p[2], cam.hy - (cam.f * p[1]) / p[2]];
  const V = (LW.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    // a + u*x + v*y
    comb: (o, x, u, y, v) => [o[0] + x[0] * u + y[0] * v, o[1] + x[1] * u + y[1] * v, o[2] + x[2] * u + y[2] * v],
  });
  // direction TOWARD the sun: upper left, slightly from behind the viewer
  LW.L3 = V.norm([-0.35, 0.6, -0.72]);
  LW.lambert = (n) => Math.max(0, V.dot(V.norm(n), LW.L3));
  LW.facing = (n, p) => V.dot(n, V.mul(p, -1)) > 0;

  // A planar frame: origin o, axes ax (u) and ay (v) in world units.
  LW.Frame = class {
    constructor(o, ax, ay) {
      this.o = o; this.ax = ax; this.ay = ay;
      this.n = V.norm(V.cross(ay, ax)); // normal; caller checks sign
    }
    w(u, v) { return V.comb(this.o, this.ax, u, this.ay, v); }
    p(u, v) { return LW.proj(this.w(u, v)); }
    // project a polyline given in frame coords
    poly(pts) { return pts.map((q) => this.p(q[0], q[1])); }
    // screen-space direction of axis u at (u,v)
    dirU(u, v) { const a = this.p(u, v), b = this.p(u + 0.05, v); const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
    dirV(u, v) { const a = this.p(u, v), b = this.p(u, v + 0.05); const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
    // pixels per world unit at (u,v)
    scale(u, v) { return LW.cam.f / this.w(u, v)[2]; }
  };
})();
