// The Observatory: hand-made texture marks. A general hatcher whose lines follow a mapped
// coordinate system with non-uniform spacing (strata, fall lines, contours) and can be dry and
// broken; fracture networks; dots; flicks; small ledges with black undercuts.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, lerp, mix, css } = OB;
  const BR16 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];

  OB.dot = (P, x, y, r) => { P.moveTo(x + r, y); P.arc(x, y, r, 0, OB.TAU); };

  // Lines of constant `b`, sampled along `t`; o.map(b, t) -> [x, y]. Each line has a threshold
  // level, so the number of lines at a point follows darkness o.D(x, y, b), as in OB.engrave.
  // o.brk (0..0.5) breaks lines into dry, ink-starved dashes.
  OB.hatch = (ctx, o) => {
    const R = OB.rng(o.seed || 1), N = OB.N;
    const lv = o.levels || 8, fade = o.fade || 0.22, thr0 = o.thr0 || 0, thrR = o.thrRange === undefined ? 1 : o.thrRange;
    const jit = o.jit === undefined ? 0.3 : o.jit, wob = o.wob === undefined ? 0.6 : o.wob, wmin = o.wmin || 0.3;
    const B = new OB.Batch();
    const seedPh = (o.seed || 1) * 0.731;
    const flush = (pts, ws) => {
      const n = pts.length;
      if (n < (o.minRun || 3)) return;
      for (let k = 0; k < n; k++) ws[k] *= Math.sqrt(Math.min(1, (k + 1) / 3, (n - k) / 3));
      const m = pts[n >> 1];
      OB.ribbon(B.get(o.colAt ? o.colAt(m[0], m[1]) : o.col), pts, ws);
    };
    let i = 0;
    for (let b = o.b0; b < o.b1; i++) {
      b += o.spAt(b) * (1 + (R() - 0.5) * jit);
      const lvl = BR16[i % lv] / (16 / lv);
      const thr = thr0 + ((lvl + 0.5) / lv) * thrR + (R() - 0.5) * 0.05;
      const ph = i * 7.13 + seedPh;
      const st = o.stepAt ? o.stepAt(b) : o.step || 3;
      let pts = null, ws = null;
      for (let t = o.t0; t <= o.t1 + st; t += st) {
        const bb = b + wob * N(t * 0.021 + ph, ph);
        const q = o.map(bb, t);
        const x = q[0], y = q[1];
        let on = false, ww = 0;
        if (o.inside(x, y)) {
          const e = o.D(x, y, b) - thr + 0.06 * (OB.vnoise(t + ph * 50, b, 23) - 0.5);
          if (e > 0 && !(o.brk && OB.vnoise(t + ph * 91, i * 13.7, o.brkS || 11) < o.brk)) {
            on = true;
            ww = Math.max(wmin, o.w(x, y) * Math.min(1, e / fade));
          }
        }
        if (on) {
          if (!pts) { pts = []; ws = []; }
          pts.push([x, y]); ws.push(ww * (1 + 0.22 * N(t * 0.05, ph + 3)));
        } else if (pts) { flush(pts, ws); pts = null; }
      }
      if (pts) flush(pts, ws);
    }
    B.fill(ctx);
  };

  // A jagged fracture: an angular random walk that keeps returning to its general heading and
  // now and then throws a thinner branch.
  OB.crack = (P, x, y, a, L, w, R, depth = 0, Phi) => {
    const pts = [[x, y]];
    const st = Math.max(2.5, L / 12);
    let ang = a;
    for (let d = 0; d < L; d += st) {
      ang += (R() - 0.5) * 1.0;
      ang = ang * 0.7 + a * 0.3;
      x += Math.cos(ang) * st; y += Math.sin(ang) * st;
      pts.push([x, y]);
      if (depth < 2 && R() < 0.12) OB.crack(P, x, y, ang + R.sign() * (0.5 + 0.7 * R()), (L - d) * (0.25 + 0.4 * R()), w * 0.62, R, depth + 1, Phi);
    }
    OB.ink(P, pts, w, { t0: 0.08, t1: 0.65, wn: 0.6, ph: x * 0.1 + y * 0.01 });
    // a pale lit lip on the upper side of the bigger fractures (incised look)
    if (Phi && depth === 0 && w > 1) OB.runs(Phi, pts.map((q) => [q[0] - 0.9 * w, q[1] - 1.2 * w]), () => w * 0.45, (k) => k > 0 && k < pts.length - 2 && OB.hash(k, Math.round(x)) > 0.35, 2);
    return pts;
  };

  // short tapered flick (grass blade, rain streak, chisel stroke)
  OB.flick = (P, x, y, a, L, w) => {
    OB.ribbon(P, [[x, y], [x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5], [x + Math.cos(a) * L, y + Math.sin(a) * L]], [w, w * 0.65, 0.12]);
  };

  // A little rock step: a broken pale lip, a heavy black undercut, and a hatched shadow face
  // hanging under it (vertical strokes, then a diagonal set over them).
  // Pk: ink; Ph: pale lip; Psh: shadow fill.
  OB.ledge = (Pk, Ph, Psh, x, y, L, slope, p, R) => {
    const n = Math.max(4, Math.round(L / (2.6 * p)));
    const lip = [], bot = [], und = [], uw = [];
    const hmax = L * (0.1 + 0.1 * R());
    const sk = 0.6 + 0.8 * R();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const xx = x - L / 2 + L * t;
      const yy = y + (xx - x) * slope + 1.6 * p * OB.N(t * 3 + x * 0.01, y * 0.01) + 1.2 * p * OB.N(t * 14, x);
      const e = Math.pow(Math.sin(Math.PI * Math.pow(t, sk)), 0.55) * (0.7 + 0.3 * OB.N(t * 6, x));
      const h = hmax * Math.max(0, e) * (0.85 + 0.3 * OB.hash(i, Math.round(y)));
      lip.push([xx, yy]);
      bot.push([xx + h * 0.15, yy + h]);
      und.push([xx, yy + h * 0.16]);
      uw.push(Math.max(0.3, h * 0.3));
    }
    OB.path(lip.concat(bot.slice().reverse()), true, Psh);
    OB.ink(Pk, lip, 1.4 * p, { t0: 0.15, t1: 0.15, wn: 0.6, ph: x });
    OB.ribbon(Pk, und, uw);
    OB.runs(Ph, lip.map((q) => [q[0], q[1] - 1.6 * p]), () => 0.75 * p, (k) => OB.hash(k, Math.round(x)) > 0.3, 2);
    for (let i = 1; i < n; i++) {
      const a = lip[i], b = bot[i];
      const h = b[1] - a[1];
      if (h < 2) continue;
      OB.ribbon(Pk, [[a[0], a[1] + 0.5], [b[0], b[1] + h * 0.15]], [0.5 * p + 0.2, 0.1]);
      if (i % 2 === 0 && h > 4) OB.ribbon(Pk, [[a[0] - h * 0.2, a[1] + h * 0.3], [a[0] + h * 0.35, a[1] + h * 0.95]], [0.35 * p + 0.15, 0.1]);
    }
  };

  // a cached, bilinear version of an expensive scalar field
  OB.fieldCache = (fn, bbox, st) => {
    const [x0, y0, x1, y1] = bbox;
    const gw = Math.ceil((x1 - x0) / st) + 2, gh = Math.ceil((y1 - y0) / st) + 2;
    const G = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) G[j * gw + i] = fn(x0 + i * st, y0 + j * st);
    return (x, y) => {
      let gx = (x - x0) / st, gy = (y - y0) / st;
      gx = gx < 0 ? 0 : gx > gw - 1.001 ? gw - 1.001 : gx;
      gy = gy < 0 ? 0 : gy > gh - 1.001 ? gh - 1.001 : gy;
      const ix = gx | 0, iy = gy | 0, tx = gx - ix, ty = gy - iy, k = iy * gw + ix;
      const a = G[k], b = G[k + 1], c = G[k + gw], d = G[k + gw + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  };
})();
