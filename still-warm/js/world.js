// world.js -- where things are on the sheet (1600 x 900 units), the box of sticks, and the little signs.
//
// The whole picture is one shape and its echoes.  A great mound stands on the left; it is drawn as
// nested shells, like the rings of a tree, each ring a row of signs.  Its outer rings have been rubbed
// away.  The sky is made of the same outline, repeated outward to the edges of the paper.
(function (G) {
  'use strict';
  const A = G.ART, vn = A.vn, sstep = A.sstep, clamp = A.clamp, P = A.P;
  const Wd = A.Wd = {};

  Wd.IN = { x0: 46, y0: 46, x1: 1554, y1: 854 };          // the picture inside its frieze
  Wd.HAND = -1.04;                                         // the angle this hand hatches at (up and to the right)
  Wd.horizon = x => 652 + 4.5 * (vn(x / 240, 1.7, 5) - 0.5) * 2 + 2 * (vn(x / 60, 3.1, 6) - 0.5) * 2;

  // a mound, given as a radius for every direction above the ground
  function Mound(cx, tab, seed, wobAmp) {
    this.cx = cx; this.cy = Wd.horizon(cx); this.seed = seed; this.wa = wobAmp;
    const n = tab.length, T = this.T = new Float32Array(1025);
    for (let i = 0; i <= 1024; i++) {
      const deg = i / 1024 * 180; let k = 0; while (k < n - 2 && deg > tab[k + 1][0]) k++;
      const t = (deg - tab[k][0]) / (tab[k + 1][0] - tab[k][0]), p0 = tab[Math.max(0, k - 1)][1], p1 = tab[k][1], p2 = tab[k + 1][1], p3 = tab[Math.min(n - 1, k + 2)][1], t2 = t * t, t3 = t2 * t;
      const r = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      T[i] = r * (1 + 0.035 * (vn(deg / 19, 2.2, seed + 1) - 0.5) * 2);
    }
  }
  Mound.prototype.R = function (th) { let f = th / Math.PI; f = f < 0 ? 0 : f > 1 ? 1 : f; f *= 1024; const i = f | 0; return i >= 1024 ? this.T[1024] : this.T[i] + (this.T[i + 1] - this.T[i]) * (f - i); };
  Mound.prototype.N = function (th, q) { return (vn(th * 4.2 + q * 9, q * 23, this.seed) - 0.5) * 2; };
  Mound.prototype.amp = function (s) { return this.wa / (0.6 + 0.4 * s); };
  Mound.prototype.th = function (x, y) { let th = Math.atan2(this.cy - y, x - this.cx); if (th < 0) th = th < -Math.PI / 2 ? Math.PI : 0; return th; };
  Mound.prototype.sOf = function (x, y) { const th = this.th(x, y), q = Math.hypot(x - this.cx, this.cy - y) / this.R(th); return q / (1 + this.amp(q) * this.N(th, q)); };
  Mound.prototype.pt = function (s, th) { const r = this.R(th) * s * (1 + this.amp(s) * this.N(th, s)); return [this.cx + r * Math.cos(th), this.cy - r * Math.sin(th)]; };
  // a run of the shell s between two angles, as a path
  Mound.prototype.arc = function (s, th0, th1, step) {
    const r = this.R((th0 + th1) / 2) * s, n = Math.max(2, Math.ceil(Math.abs(th1 - th0) * r / (step || 4)) + 1), out = new Array(n * 2);
    for (let i = 0; i < n; i++) { const p = this.pt(s, th0 + (th1 - th0) * i / (n - 1)); out[i * 2] = p[0]; out[i * 2 + 1] = p[1]; }
    return out;
  };

  const MT = Wd.MT = new Mound(572, [[0, 566], [15, 508], [30, 460], [50, 432], [70, 452], [90, 486], [100, 498], [115, 474], [135, 426], [155, 412], [170, 438], [180, 470]], 41, 0.016);
  const HL = Wd.HL = new Mound(1346, [[0, 113], [30, 110], [60, 124], [85, 143], [105, 140], [135, 119], [160, 115], [180, 121]], 59, 0.02);

  // ring boundaries: inside the mound, then out across the sky
  (function () {
    const R = A.rng(808);
    const SM = [0.068]; while (SM[SM.length - 1] < 0.955) SM.push(SM[SM.length - 1] + 0.050 + R() * 0.013); SM[SM.length - 1] = 1; Wd.SM = SM;
    const SK = [1]; let j = 0; while (SK[SK.length - 1] < 3.0) { SK.push(SK[SK.length - 1] + 0.062 * Math.pow(1.03, j) * (0.82 + 0.36 * R())); j++; } Wd.SK = SK;
    Wd.HS = [0.2, 0.42, 0.63, 0.83, 1];
  })();
  Wd.bandOf = function (arr, s) { for (let j = 0; j < arr.length - 1; j++) if (s < arr[j + 1]) return s >= arr[j] ? j : -1; return -1; };

  // how far the morning has come at a point of the sky: 0 night ... 1 dawn
  Wd.dawn = (x, y) => sstep(790, 1470, x + 0.8 * (y - 400));
  // how thoroughly a point of the mound was rubbed out: 0 kept ... 1 gone
  Wd.gone = function (x, y) {
    const th = MT.th(x, y), s = MT.sOf(x, y);
    return sstep(0.265, 0.47, s + 0.05 * (vn(th * 2.6, 0.7, 47) - 0.5) * 2 + 0.018 * Math.cos(th - 2.3));
  };
  Wd.inSky = function (x, y, mg) {
    mg = mg || 0; const I = Wd.IN;
    return x > I.x0 + mg && x < I.x1 - mg && y > I.y0 + mg && y < Wd.horizon(x) - mg && MT.sOf(x, y) > 1 + mg * 0.002 && HL.sOf(x, y) > 1.05 + mg * 0.01;
  };

  // ---------- hatching: the same wrist, everywhere ----------
  // inside(x,y) -> bool.  emit(x0,y0,x1,y1) is called for every stroke.
  Wd.hatch = function (R, inside, bx0, by0, bx1, by1, ang, gap, o, emit) {
    o = o || {}; const ca = Math.cos(ang), sa = Math.sin(ang), cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, D = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 4, step = o.step || 2.5, len = o.len || 18, jit = o.jit === undefined ? 1.6 : o.jit, skip = o.skip || 0;
    for (let d = -D; d < D; d += gap * (0.55 + 0.9 * R())) {
      const ox = cx - sa * d, oy = cy + ca * d; let run = false, ts = 0;
      for (let t = -D; t <= D + step; t += step) {
        const x = ox + ca * t, y = oy + sa * t, inn = t <= D && x >= bx0 && x <= bx1 && y >= by0 && y <= by1 && inside(x, y);
        if (inn && !run) { run = true; ts = t; }
        else if (!inn && run) {
          run = false; let a = ts; const b = t - step;
          while (a < b - 1) {
            const l = Math.min(b - a, len * (0.6 + 0.8 * R())), a2 = a + l;
            if (!(skip && R() < skip)) { const j0 = (R() - 0.5) * 2 * jit, j1 = (R() - 0.5) * 2 * jit, sk = (R() - 0.5) * 0.9; emit(ox + ca * (a + j0) - sa * sk, oy + sa * (a + j0) + ca * sk, ox + ca * (a2 + j1) + sa * sk, oy + sa * (a2 + j1) - ca * sk); }
            a = a2 + (R() < 0.3 ? R() * 2 : -R() * 1.5);
          }
        }
      }
    }
  };

  // ---------- the box of sticks ----------
  Wd.PAL = {
    night: [[0.100, 0.110, 0.230], [0.200, 0.200, 0.410], [0.080, 0.195, 0.300], [0.270, 0.170, 0.330], [0.120, 0.125, 0.285], [0.200, 0.335, 0.395], [0.150, 0.160, 0.345], [0.065, 0.145, 0.250]],
    nightLight: [[0.52, 0.50, 0.70], [0.40, 0.52, 0.62], [0.62, 0.52, 0.70]],
    turn: [[0.50, 0.32, 0.48], [0.78, 0.45, 0.42], [0.40, 0.45, 0.64], [0.66, 0.43, 0.55], [0.70, 0.60, 0.79], [0.60, 0.36, 0.40]],
    dawn: [[0.93, 0.65, 0.65], [0.97, 0.895, 0.66], [0.71, 0.84, 0.72], [0.96, 0.74, 0.52], [0.96, 0.82, 0.82], [0.66, 0.84, 0.85], [0.95, 0.80, 0.60], [0.86, 0.72, 0.86]],
    sour: [0.80, 0.86, 0.34],
    shell: [[0.95, 0.72, 0.42], [0.74, 0.37, 0.25], [0.89, 0.77, 0.57], [0.83, 0.54, 0.54], [0.85, 0.69, 0.25], [0.28, 0.46, 0.46], [0.91, 0.70, 0.68], [0.46, 0.17, 0.17], [0.80, 0.59, 0.31], [0.88, 0.76, 0.57], [0.41, 0.29, 0.21], [0.82, 0.55, 0.53], [0.31, 0.47, 0.50], [0.80, 0.60, 0.32], [0.72, 0.40, 0.28], [0.90, 0.71, 0.68], [0.86, 0.75, 0.56], [0.84, 0.68, 0.27], [0.42, 0.30, 0.34], [0.78, 0.50, 0.44]],
    earthCold: [[0.285, 0.200, 0.165], [0.170, 0.120, 0.165], [0.195, 0.200, 0.290], [0.150, 0.280, 0.290], [0.235, 0.165, 0.200], [0.300, 0.150, 0.160], [0.250, 0.210, 0.250]],
    earthWarm: [[0.60, 0.345, 0.22], [0.58, 0.40, 0.38], [0.64, 0.46, 0.25], [0.42, 0.17, 0.16], [0.66, 0.42, 0.26], [0.33, 0.22, 0.17], [0.55, 0.30, 0.30]],
    hill: [[0.95, 0.76, 0.40], [0.93, 0.50, 0.58], [0.40, 0.70, 0.70], [0.97, 0.88, 0.60], [0.60, 0.74, 0.46]],
    gold: [0.86, 0.655, 0.215], bole: [0.40, 0.15, 0.13],
    soot: [0.105, 0.095, 0.10], chalk: [0.965, 0.955, 0.915], graphite: [0.33, 0.32, 0.33],
    indigoP: [0.14, 0.16, 0.36], vermP: [0.86, 0.24, 0.12], violetP: [0.38, 0.22, 0.52], tealP: [0.10, 0.42, 0.44], roseP: [0.80, 0.30, 0.42], greenP: [0.30, 0.52, 0.22], umberP: [0.34, 0.22, 0.14], ochreP: [0.72, 0.50, 0.12], lavP: [0.60, 0.58, 0.82],
  };

  // ---------- the signs ----------  (each is a few pen paths in a box from -0.5 to 0.5)
  function arc(cx, cy, r, a0, a1, n) { const o = []; n = n || 14; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
  function dot(x, y) { return arc(x, y, 0.055, 0, 8.2, 9); }
  const TAU = Math.PI * 2;
  Wd.SIGNS = [
    /* 0 coil      */ () => { const o = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = -1.2 + t * TAU * 1.8, r = 0.04 + 0.38 * t; o.push([Math.cos(a) * r, Math.sin(a) * r]); } return [o]; },
    /* 1 ring      */ () => [arc(0, 0, 0.36, 0.3, 0.3 + TAU * 1.04, 20), dot(0, 0)],
    /* 2 teeth     */ () => [[[-0.45, 0.2], [-0.27, -0.25], [-0.09, 0.2], [0.09, -0.25], [0.27, 0.2], [0.45, -0.25]]],
    /* 3 comb      */ () => [[[-0.42, -0.26], [0.42, -0.26]], [[-0.34, -0.26], [-0.34, 0.3]], [[-0.11, -0.26], [-0.11, 0.3]], [[0.12, -0.26], [0.12, 0.3]], [[0.35, -0.26], [0.35, 0.3]]],
    /* 4 ladder    */ () => [[[-0.2, -0.44], [-0.2, 0.44]], [[0.2, -0.44], [0.2, 0.44]], [[-0.2, -0.24], [0.2, -0.24]], [[-0.2, 0.02], [0.2, 0.02]], [[-0.2, 0.27], [0.2, 0.27]]],
    /* 5 horn      */ () => [arc(0, 0, 0.4, 1.0, 5.3, 16), arc(0.17, 0, 0.3, 1.45, 4.85, 12)],
    /* 6 tent      */ () => [[[-0.4, 0.32], [0, -0.4], [0.4, 0.32], [-0.4, 0.32]], dot(0, 0.08)],
    /* 7 water     */ () => [-0.25, 0, 0.25].map(y => { const o = []; for (let i = 0; i <= 12; i++) { const x = -0.42 + 0.84 * i / 12; o.push([x, y + 0.07 * Math.sin(i / 12 * TAU * 2)]); } return o; }),
    /* 8 door      */ () => [[[-0.3, 0.42]].concat(arc(0, -0.08, 0.3, Math.PI, TAU, 10), [[0.3, 0.42]]), [[0, 0.42], [0, 0.06]]],
    /* 9 roofs     */ () => [[[-0.38, 0.03], [0, -0.34], [0.38, 0.03]], [[-0.38, 0.38], [0, 0.02], [0.38, 0.38]]],
    /* 10 twig     */ () => [[[0, 0.44], [0, -0.42]], [[0, 0.12], [-0.28, -0.14]], [[0, -0.06], [0.28, -0.32]]],
    /* 11 fence    */ () => [[[-0.15, -0.42], [-0.15, 0.42]], [[0.15, -0.42], [0.15, 0.42]], [[-0.42, -0.15], [0.42, -0.15]], [[-0.42, 0.15], [0.42, 0.15]]],
    /* 12 bowl     */ () => [arc(0, -0.02, 0.38, 0, Math.PI, 12), [[0, -0.44], [0, 0.1]]],
    /* 13 crook    */ () => [[[0.12, -0.44], [0.12, 0.12]].concat(arc(-0.07, 0.12, 0.19, 0, Math.PI, 8))],
    /* 14 three    */ () => [dot(0, -0.24), dot(-0.25, 0.2), dot(0.25, 0.2)],
    /* 15 kite     */ () => [[[0, -0.44], [0.3, 0], [0, 0.44], [-0.3, 0], [0, -0.44]], [[-0.13, 0], [0.13, 0]]],
    /* 16 spark    */ () => [[[0, -0.4], [0, 0.4]], [[-0.35, -0.2], [0.35, 0.2]], [[-0.35, 0.2], [0.35, -0.2]]],
    /* 17 maze     */ () => [[[-0.4, 0.4], [-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.13, 0.4], [-0.13, -0.13], [0.14, -0.13], [0.14, 0.15]]],
    /* 18 arcs     */ () => [arc(0, 0.3, 0.42, Math.PI, TAU, 12), arc(0, 0.3, 0.27, Math.PI, TAU, 9), arc(0, 0.3, 0.12, Math.PI, TAU, 6)],
    /* 19 seed     */ () => [arc(0, 0.42, 0.6, -2.35, -0.79, 10), arc(0, -0.42, 0.6, 0.79, 2.35, 10), [[0, -0.12], [0, 0.12]]],
    /* 20 steps    */ () => [[[-0.42, 0.38], [-0.42, 0.12], [-0.14, 0.12], [-0.14, -0.14], [0.14, -0.14], [0.14, -0.4], [0.42, -0.4]]],
    /* 21 net      */ () => [[[-0.36, -0.36], [0.36, -0.36], [0.36, 0.36], [-0.36, 0.36], [-0.36, -0.36]], [[-0.36, -0.36], [0.36, 0.36]]],
    /* 22 rain     */ () => [[[-0.28, -0.4], [-0.36, -0.05]], [[0, -0.4], [-0.08, -0.05]], [[0.28, -0.4], [0.2, -0.05]], [[-0.14, 0.05], [-0.22, 0.4]], [[0.14, 0.05], [0.06, 0.4]]],
    /* 23 fork     */ () => [[[0, 0.44], [0, 0]], [[-0.3, -0.42], [-0.3, -0.1], [0, 0], [0.3, -0.1], [0.3, -0.42]]],
  ];
  Wd.OLD = [0, 8, 14, 2, 18];   // the oldest signs: the ones at the heart, the ones handed on

  // draw one sign.  st: { c, m, w, p }   o: { sloppy, part (0..1 how much of it is still remembered), R }
  Wd.sign = function (C, R, id, x, y, size, rot, st, o) {
    o = o || {}; const sl = o.sloppy === undefined ? 1 : o.sloppy, part = o.part === undefined ? 1 : o.part;
    const paths = Wd.SIGNS[id](), cr = Math.cos(rot), sr = Math.sin(rot), sx = 1 + (R() - 0.5) * 0.22 * sl, sy = 1 + (R() - 0.5) * 0.22 * sl, sh = (R() - 0.5) * 0.3 * sl, s0 = R() * 99;
    for (let q = 0; q < paths.length; q++) {
      if (part < 1 && R() > part + 0.15) continue;
      let ctrl = paths[q]; if (part < 1) { const keep = Math.max(2, Math.ceil(ctrl.length * (part + R() * 0.3))); if (keep < ctrl.length) ctrl = ctrl.slice(0, keep); }
      // straight-sided signs stay angular; arcs are already dense
      const dense = []; for (let i = 0; i < ctrl.length - 1; i++) { const a = ctrl[i], b = ctrl[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) * size, m = Math.max(1, Math.ceil(d / 2.2)); for (let j = 0; j < m; j++) dense.push([a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m]); } dense.push(ctrl[ctrl.length - 1]);
      const pts = new Array(dense.length * 2);
      for (let i = 0; i < dense.length; i++) {
        let lx = (dense[i][0] + sh * dense[i][1]) * sx, ly = dense[i][1] * sy;
        lx += 0.05 * sl * (vn(i * 0.33 + s0 + q * 7, 1.5, 83) - 0.5) * 2; ly += 0.05 * sl * (vn(i * 0.33 + s0 + q * 7, 6.5, 84) - 0.5) * 2;
        pts[i * 2] = x + (lx * cr - ly * sr) * size; pts[i * 2 + 1] = y + (lx * sr + ly * cr) * size;
      }
      C.stroke(pts, { w: st.w, c: st.c, m: st.m, p: st.p * (0.88 + 0.24 * R()), ti: 0.08, to: 0.12, pv: 0.2 });
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.Wd;
  // split a path into the stretches where pred(x,y) holds
  Wd.runs = function (pts, pred) {
    const out = []; let cur = null;
    for (let i = 0; i < pts.length; i += 2) { if (pred(pts[i], pts[i + 1])) { if (!cur) cur = []; cur.push(pts[i], pts[i + 1]); } else if (cur) { if (cur.length >= 4) out.push(cur); cur = null; } }
    if (cur && cur.length >= 4) out.push(cur);
    return out;
  };
  // cut a path short at the first point where pred fails
  Wd.until = function (pts, pred) { for (let i = 0; i < pts.length; i += 2) if (!pred(pts[i], pts[i + 1])) return pts.slice(0, i); return pts; };
  Wd.lumOf = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
})(typeof self !== 'undefined' ? self : globalThis);
