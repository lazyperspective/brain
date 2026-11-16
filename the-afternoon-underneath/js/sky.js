// sky.js -- tonight: the sky after the sun has gone, the thunderhead keeping the last of it, a thin moon.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, fbm = A.fbm, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c;
  const YH = Wd.YH;
  const o8 = new Float32Array(8), tc = [0, 0, 0];

  // ------------------------------------------------------------------ shared habits
  // scatter strokes over a region, each one the colour the picture wants there
  //  o: { n, box:[x0,y0,x1,y1], col(x,y,R) -> [r,g,b] | null, m, w:[lo,hi], len:[lo,hi], ang(x,y) , p:[lo,hi], wob }
  S.hatch = function (C, R, o) {
    const b = o.box;
    for (let i = 0; i < o.n; i++) {
      const x = R.r(b[0], b[2]), y = R.r(b[1], b[3]), col = o.col(x, y, R); if (!col) continue;
      const a = (o.ang ? o.ang(x, y, R) : 0) + R.g() * (o.spread === undefined ? 0.06 : o.spread), L = R.r(o.len[0], o.len[1]) * 0.5, dx = Math.cos(a) * L, dy = Math.sin(a) * L;
      C.stroke(P.line(R, x - dx, y - dy, x + dx, y + dy, o.wob === undefined ? 1.2 : o.wob, 0.03, 5), { w: R.r(o.w[0], o.w[1]), c: col, m: o.m || M.pastel, p: R.r(o.p[0], o.p[1]), ti: 0.2, to: 0.3, cj: o.cj === undefined ? 0.03 : o.cj, nodust: o.nodust });
    }
  };
  // strokes that run round a cloud's lobes: across the direction the surface faces
  S.formHatch = function (C, R, o) {
    const b = o.box, f8 = new Float32Array(8);
    for (let i = 0; i < o.n; i++) {
      const x = R.r(b[0], b[2]), y = R.r(b[1], b[3]), v = o.at(x, y, f8); if (v <= 0) continue;
      const col = o.col(x, y, v, f8, R); if (!col) continue;
      const nl = Math.hypot(f8[1], f8[2]); let a = nl > 0.08 ? Math.atan2(f8[2], f8[1]) + Math.PI / 2 : R() * 3.14; a += R.g() * 0.18;
      const L = R.r(o.len[0], o.len[1]) * 0.5, bend = R.r(0.1, 0.3) * (nl > 0.08 ? 1 : 0), nx = Math.cos(a - Math.PI / 2), ny = Math.sin(a - Math.PI / 2), dx = Math.cos(a) * L, dy = Math.sin(a) * L;
      let pts = P.spline([[x - dx - nx * L * bend, y - dy - ny * L * bend], [x + nx * L * bend * 0.4, y + ny * L * bend * 0.4], [x + dx - nx * L * bend, y + dy - ny * L * bend]], 3);
      if (o.map) { pts = o.map(pts); if (!pts) continue; }
      C.stroke(pts, { w: R.r(o.w[0], o.w[1]), c: col, m: o.m || M.pastel, p: R.r(o.p[0], o.p[1]), ti: 0.3, to: 0.35, cj: 0.025, nodust: true });
    }
  };
  const lampXY = () => { const L = Wd.LAMP, p = Wd.pr(L.X - L.arm, L.head - 0.12, L.Z); return p; };
  Wd.lampXY = lampXY;
  // how much of tonight's cloud light a point of the cloud catches (-1 .. 1)
  function duskLit(x, y, o) {
    // the light comes up from under the horizon, on the left
    return 0.68 * (o[1] * -0.63 + o[2] * 0.70 + o[3] * 0.33) + 0.32 * (o[5] * -0.63 + o[6] * 0.70 + o[7] * 0.33) + 0.08 * (vn(x / 13, y / 13, 81) - 0.5);
  }
  const DK = { deep0: hx('#1d2562'), deep1: hx('#27357c'), mid0: hx('#3f2c78'), mid1: hx('#3a418e'), half0: hx('#7c3a8a'), half1: hx('#8a5fae'), rim0: hx('#d9528a'), rim1: hx('#ff9d80'), rim2: hx('#ffc9a0') };
  function duskCloudCol(x, y, o, out) {
    const t = duskLit(x, y, o), alt = ss(410, 40, y), near = ss(1500, 700, x);
    const deep = mix(DK.deep0, DK.deep1, alt), mid = mix(DK.mid0, DK.mid1, alt), half = mix(DK.half0, DK.half1, alt * 0.8);
    let rim = mix(DK.rim0, DK.rim1, ss(0.1, 0.75, alt)); rim = mix(rim, DK.rim2, ss(0.7, 1, alt) * 0.6);
    let col;
    if (t < 0.12) col = mix(deep, mid, ss(-0.24, -0.16, t));
    else if (t < 0.5) col = mix(mid, half, ss(0.26, 0.33, t) * (0.5 + 0.5 * near));
    else col = mix(half, rim, ss(0.58, 0.64, t) * (0.4 + 0.6 * near));
    // the foot of the cloud sinks into the haze of the afterglow
    const hz = ss(330, 408, y) * 0.5; Wd.dusk(x, 400, tc);
    out[0] = col[0] + (tc[0] * 0.8 - col[0]) * hz; out[1] = col[1] + (tc[1] * 0.62 - col[1]) * hz; out[2] = col[2] + (tc[2] * 0.8 - col[2]) * hz;
    return t;
  }
  Wd.duskCloudCol = duskCloudCol; Wd.duskLit = duskLit;

  // ------------------------------------------------------------------ the plan, in graphite
  S.under = function (C, R) {
    const g = { c: c.graphite, m: M.pencil, w: 1.0, p: 0.34, cj: 0.01 };
    C.stroke(P.line(R, -6, YH + 0.5, 1606, YH - 0.5, 0.7, 0.002, 6), g);
    C.stroke(P.line(R, -6, YH + 1.6, 900, YH + 1.2, 0.7, 0.002, 6), Object.assign({}, g, { p: 0.22 }));
    // the big shapes of the cloud, and the same shapes folded under the horizon
    for (const p of Wd.CB.puffsBig) {
      C.stroke(P.circle(R, p[0], p[1], p[2] * 0.96, 1.12, 0.05), Object.assign({}, g, { p: 0.2, w: 0.9 }));
      C.stroke(P.circle(R, p[0], 2 * YH - p[1], p[2] * 0.96, 1.1, 0.07), Object.assign({}, g, { p: 0.13, w: 0.9 }));
    }
    // lines to the place the poles walk toward
    const vp = [470, YH];
    for (const y0 of [40, 300, 520, 760]) C.stroke(P.line(R, -4, y0, vp[0], vp[1], 0.6, 0.004, 6), Object.assign({}, g, { p: 0.15, w: 0.8 }));
    // the fold
    for (const x of [800]) C.stroke(P.line(R, x, 120, x + 2, 880, 0.6, 0.004, 6), Object.assign({}, g, { p: 0.10, w: 0.8 }));
    const m = Wd.MOON; C.stroke(P.circle(R, m[0], m[1], 17, 1.15, 0.04), Object.assign({}, g, { p: 0.2 })); C.stroke(P.circle(R, m[0], 2 * YH - m[1], 20, 1.15, 0.05), Object.assign({}, g, { p: 0.2 }));
  };

  // ------------------------------------------------------------------ tonight's sky, in two glazes of watercolour
  S.duskWash = function (C, R, pass) {
    const sd = 500 + pass * 37, lp = lampXY(), mo = Wd.MOON;
    C.wash(0, 0, 1600, YH + 6, function (x, y, pig) {
      const edge = YH + 1.5 + 2.5 * (vn(x / 23, pass * 3.1, sd) - 0.5) - y; if (edge <= 0) return 0;
      const wx = 46 * (fbm(x / 210, y / 150, sd + 1, 3) - 0.5), wy = 34 * (fbm(x / 260 + 7, y / 110, sd + 2, 3) - 0.5);
      Wd.dusk(x + wx, clamp(y + wy, -30, YH), pig);
      let w = (pass === 0 ? 0.60 : 0.50) * (1 + 0.24 * (vn(x / 250 + pass * 9, y / (9 + pass * 5), sd + 3) - 0.5) * 2 + 0.20 * (fbm(x / 80, y / 80, sd + 4, 3) - 0.5) * 2);
      w *= A.wc(edge, 1.6, 0.25) / 1.0;
      // leave the paper for the lamp and the moon to shine from
      const dl = Math.hypot(x - lp[0], y - lp[1]); w *= 1 - 0.80 * Math.exp(-dl * dl / 2100) - 0.15 * Math.exp(-dl / 90);
      const dm = Math.hypot(x - mo[0], y - mo[1]); w *= 1 - 0.55 * Math.exp(-dm * dm / 1500);
      // the glow where the sun went under
      const ds = Math.hypot((x - Wd.SUNSET[0]) / 2.6, y - YH); w *= 1 - 0.35 * Math.exp(-ds * ds / 2400);
      return w;
    }, { gran: 0.42 });
    if (pass === 1) {
      for (let i = 0; i < 8; i++) C.bloom(R.r(60, 1540), R.r(110, 310), R.r(12, 28), { lift: R.r(0.07, 0.14), dark: R.r(0.07, 0.13), sq: R.r(0.9, 1.5) });
    }
  };

  // ------------------------------------------------------------------ the thunderhead tonight
  S.duskCloud = function (C, R) {
    // a glaze of watercolour first: the body of the cloud stains down into the sky
    C.wash(0, -2, 1600, YH, function (x, y, pig) {
      const v = Wd.cloud(x, y, o8); if (v <= 0) return 0;
      const t = duskCloudCol(x, y, o8, pig);
      pig[0] = 0.45 + 0.55 * pig[0]; pig[1] = 0.45 + 0.55 * pig[1]; pig[2] = 0.55 + 0.45 * pig[2];
      return A.wc(v, 2.2, 0.5) * (t > 0.5 ? 0.15 : 0.85);
    }, { gran: 0.5 });
    // then pastel, rubbed in with the side of the hand: four tones, cut like cel shadows
    C.veil(0, -2, 1600, YH, function (x, y, col) {
      const v = Wd.cloud(x, y, o8); if (v <= 0) return 0;
      duskCloudCol(x, y, o8, col);
      return ss(0, 2.4, v) * 0.80;
    }, { g: 0.55 });
  };
  // strokes that follow the cloud's own roundness
  S.cloudArcs = function (C, R, puffs, o) {
    for (const p of puffs) {
      const r = p[2]; if (r < (o.rmin || 5) || R() > (o.keep || 0.8)) continue;
      const L = o.light(p[0], p[1]), a0 = Math.atan2(L[1], L[0]);
      const n = r > 40 ? 3 : r > 16 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sp = R.r(0.3, 0.8), ac = a0 + R.g() * 0.35, rr = r * (0.9 - i * 0.14 - R() * 0.06);
        const pts = P.arc(R, p[0], p[1], rr, ac - sp, ac + sp, 0.05);
        // only where the cloud is really lit there (another puff may be in front)
        const mx = p[0] + Math.cos(ac) * rr, my = p[1] + Math.sin(ac) * rr;
        if (o.fld) { o.fld.at(mx, my, o8); if (o8[4] > (p[4] || 0) + Math.sqrt(Math.max(0, r * r - rr * rr)) + 2) continue; }
        const col = o.col(mx, my, i, R); if (!col) continue;
        const q = o.map ? o.map(pts) : pts; if (!q) continue;
        C.stroke(q, { w: Math.max(1.6, r * R.r(0.10, 0.22)) * (o.wk || 1), c: col, m: o.m || M.pastel, p: R.r(o.p ? o.p[0] : 0.5, o.p ? o.p[1] : 0.75), ti: 0.3, to: 0.35, cj: 0.03 });
      }
    }
  };
  S.duskCloudStrokes = function (C, R) {
    C.clip(0, 0, 1600, YH + 1);
    const light = (x, y) => [Wd.SUNSET[0] - 120 - x, Wd.SUNSET[1] + 150 - y];
    // lit rims
    S.cloudArcs(C, R, Wd.CB.puffs, {
      light, keep: 0.9, rmin: 4, p: [0.45, 0.8], fld: Wd.CB,
      col: (x, y, i) => { const v = Wd.cloud(x, y, o8); if (v < -3 || v > 26) return null; const t = duskCloudCol(x, y, o8, tc); if (t < 0.36) return null; const alt = ss(410, 40, y), near = ss(1560, 800, x); if (near < 0.25 && i > 0) return null; let col = mix(DK.rim0, DK.rim1, ss(0.05, 0.7, alt)); col = mix(col, DK.rim2, ss(0.6, 1, alt) * 0.75 + (i === 0 ? 0.1 : 0)); return mix(DK.half1, col, 0.35 + 0.65 * near); },
    });
    // short strokes that go round the lobes, the way the hand models a round thing
    S.formHatch(C, R, {
      n: 2600, box: [820, 0, 1600, 410], at: Wd.cloud, w: [2.5, 6], len: [10, 34], p: [0.3, 0.55],
      col: (x, y, v, o, R) => { if (v < 2) return null; const t = duskCloudCol(x, y, o, tc); const j = R.g() * 0.035; return [tc[0] + j + (t > 0.3 ? 0.03 : 0), tc[1] + j, tc[2] + j + (t < 0 ? 0.03 : 0)]; },
    });
    S.cloudContours(C, R, Wd.CB, Wd.cloud, { p: [0.3, 0.5], m: M.wax, col: (x, y, a) => { if (y > 404) return null; const f = Math.cos(a) * -0.63 + Math.sin(a) * 0.70; return f > 0.2 ? (ss(410, 40, y) > 0.45 ? hx('#ffc6a6') : hx('#f47f9c')) : hx('#5a5ab0'); } });
    // pencil: slanting hatch in the shadow side, the way a hand fills a dark
    S.hatch(C, R, {
      n: 1500, box: [820, 0, 1600, 410], m: M.pencil, w: [0.9, 1.5], len: [14, 40], p: [0.35, 0.6], ang: () => -0.95, spread: 0.1, wob: 0.5,
      col: (x, y) => { const v = Wd.cloud(x, y, o8); if (v < 2) return null; const t = duskCloudCol(x, y, o8, tc); if (t > 0.25) return null; return t < -0.2 ? hx('#141a4e') : hx('#2a2670'); },
    });
    S.hatch(C, R, {
      n: 420, box: [820, 0, 1600, 410], m: M.wax, w: [0.9, 1.4], len: [8, 20], p: [0.4, 0.6], ang: () => -0.95, spread: 0.12, wob: 0.4,
      col: (x, y) => { const v = Wd.cloud(x, y, o8); if (v < 1) return null; const t = duskCloudCol(x, y, o8, tc); if (t < 0.62 || R() > ss(1560, 900, x)) return null; return ss(410, 40, y) > 0.5 ? hx('#ffd9b4') : hx('#ff9aa8'); },
    });
    // the far line of cumulus on the left: just their lit shoulders
    S.hatch(C, R, {
      n: 260, box: [0, 350, 800, 420], m: M.pastel, w: [1.6, 3.2], len: [6, 16], p: [0.5, 0.8], ang: () => 0.5, spread: 0.5, wob: 0.3,
      col: (x, y) => { const v = Wd.cloud(x, y, o8); if (v < 0.5 || v > 9) return null; const t = duskCloudCol(x, y, o8, tc); if (t < 0.3) return null; return mix(hx('#ff8f86'), hx('#ffc08e'), ss(600, 300, Math.abs(x - 470))); },
    });
    C.clip();
  };

  // ------------------------------------------------------------------ pastel over the wash: the sky is hatched, not sprayed
  S.duskHatch = function (C, R) {
    C.clip(0, 0, 1600, YH + 1);
    const ang = (x, y) => { const dx = (x - Wd.SUNSET[0]) / 3.2, dy = y - (YH + 60); return Math.atan2(dy, dx) + Math.PI / 2; };
    S.hatch(C, R, {
      n: 1300, box: [-40, -10, 1640, YH - 6], w: [7, 17], len: [70, 230], p: [0.26, 0.44], ang, spread: 0.05, wob: 1.6,
      col: (x, y, R) => { if (Wd.cloud(x, y, o8) > -3) return null; const lp = lampXY(); if (Math.hypot(x - lp[0], y - lp[1]) < 46) return null; if (Math.hypot(x - Wd.MOON[0], y - Wd.MOON[1]) < 30) return null; const o = Wd.dusk(x + R.g() * 30, clamp(y + R.g() * 16, 0, YH), [0, 0, 0]); return o; },
    });
    // coloured pencil: long slanted hatching to deepen the top of the sky
    S.hatch(C, R, {
      n: 1100, box: [-20, -10, 1620, 250], m: M.pencil, w: [0.9, 1.6], len: [40, 120], p: [0.28, 0.5], ang: () => -0.62, spread: 0.07, wob: 0.8,
      col: (x, y) => { if (R() > ss(260, 20, y) * 0.9 + 0.1) return null; if (Wd.cloud(x, y, o8) > -2) return null; if (Math.hypot(x - Wd.MOON[0], y - Wd.MOON[1]) < 40) return null; return y < 120 ? hx('#141a56') : hx('#3a2a86'); },
    });
    // and a few strokes of rose and peach laid along the horizon's glow
    S.hatch(C, R, {
      n: 260, box: [-20, 330, 1620, YH - 3], w: [3, 8], len: [60, 260], p: [0.3, 0.5], ang: () => 0, spread: 0.02, wob: 1.0,
      col: (x, y, R) => { if (Wd.cloud(x, y, o8) > -2) return null; return Wd.dusk(x, clamp(y + R.r(4, 26), 0, YH), [0, 0, 0]); },
    });
    C.clip();
  };

  // thin bars of cloud lying across the afterglow, and the high wisps that are still pink
  S.duskBars = function (C, R) {
    C.clip(0, 0, 1600, YH + 1);
    const bars = [[250, 388, 330, 5], [520, 374, 420, 6], [130, 356, 260, 4.5], [700, 396, 300, 4], [420, 344, 230, 3.2], [610, 330, 300, 3.6], [90, 318, 200, 3], [330, 404, 180, 3], [760, 362, 160, 3]];
    for (const b of bars) {
      const n = 3 + R.i(0, 2);
      for (let i = 0; i < n; i++) {
        const x0 = b[0] - b[2] / 2 + R.g() * 26, x1 = b[0] + b[2] / 2 + R.g() * 26, y = b[1] + R.g() * 2.2;
        const ctrl = [[x0, y + 1], [x0 + (x1 - x0) * 0.3, y - 2 + R.g()], [x0 + (x1 - x0) * 0.62, y + R.g() * 1.5], [x1, y - 1.5]];
        const alt = ss(410, 300, y);
        C.stroke(P.spline(ctrl, 5), { w: b[3] * R.r(0.7, 1.25), c: mix(hx('#6a2f86'), hx('#4a2f8c'), alt), m: M.pastel, p: R.r(0.5, 0.72), ti: 0.4, to: 0.45, cj: 0.025 });
      }
      // lit from underneath
      for (let i = 0; i < 2; i++) {
        const x0 = b[0] - b[2] * R.r(0.3, 0.46), x1 = b[0] + b[2] * R.r(0.2, 0.44), y = b[1] + b[3] * 0.55 + R.g() * 0.6;
        C.stroke(P.line(R, x0, y + 0.8, x1, y - 0.6, 0.8, 0.01, 5), { w: R.r(1.2, 2.0), c: mix(hx('#ff7f86'), hx('#ffc48a'), ss(500, 100, Math.abs(b[0] - 470))), m: M.pastel, p: R.r(0.5, 0.7), ti: 0.4, to: 0.5 });
      }
    }
    // high wisps
    for (let i = 0; i < 26; i++) {
      const x = R.r(40, 1000), y = R.r(40, 235), L = R.r(60, 200), a = -0.20 + R.g() * 0.05;
      const ctrl = [[x, y], [x + L * 0.35, y + L * 0.35 * a - R.r(1, 5)], [x + L * 0.7, y + L * 0.7 * a - R.r(0, 4)], [x + L, y + L * a + R.r(0, 5)]];
      const col = mix(hx('#b46ab8'), hx('#ff9aae'), ss(40, 240, y) * R.r(0.5, 1));
      C.stroke(P.spline(ctrl, 5), { w: R.r(1.0, 2.6), c: col, m: M.pastel, p: R.r(0.26, 0.46), ti: 0.5, to: 0.6 });
      if (R.chance(0.6)) C.stroke(P.spline(ctrl.map(p => [p[0] + R.r(4, 12), p[1] + R.r(1.5, 3.5)]), 5), { w: R.r(0.8, 1.2), c: col, m: M.wax, p: R.r(0.3, 0.5), ti: 0.5, to: 0.6 });
    }
    C.clip();
  };

  // ------------------------------------------------------------------ stars, and the thin moon
  S.stars = function (C, R) {
    const mo = Wd.MOON, lp = lampXY();
    const tints = [c.white, c.white, hx('#e6ecff'), hx('#ffeedd'), hx('#fff6c8'), hx('#ffdff0')];
    let n = 0;
    for (let i = 0; i < 2600 && n < 210; i++) {
      const x = R.r(0, 1600), y = R.r(0, 330) * R.r(0.3, 1);
      if (R() > ss(330, 60, y) * 0.92 + 0.02) continue;
      if (Wd.cloud(x, y, o8) > -4) continue;
      if (Math.hypot(x - mo[0], y - mo[1]) < 34 || Math.hypot(x - lp[0], y - lp[1]) < 60) continue;
      const big = R() < 0.07, r = big ? R.r(1.3, 2.0) : R.r(0.35, 0.8) * (R() < 0.2 ? 1.6 : 1), t = R.pick(tints);
      C.dab(x, y, r, t, M.chalk, big ? 0.95 : R.r(0.35, 0.95));
      if (big) { // the cross of light that old lenses gave every bright thing
        const L = R.r(5, 10), a = R.r(-0.08, 0.08);
        C.stroke(P.line(R, x - L * Math.cos(a), y - L * Math.sin(a), x + L * Math.cos(a), y + L * Math.sin(a), 0.1, 0, 2), { w: 0.8, c: t, m: M.wax, p: 0.55, ti: 0.5, to: 0.5 });
        C.stroke(P.line(R, x + L * Math.sin(a), y - L * Math.cos(a), x - L * Math.sin(a), y + L * Math.cos(a), 0.1, 0, 2), { w: 0.8, c: t, m: M.wax, p: 0.55, ti: 0.5, to: 0.5 });
        C.dab(x, y, r * 0.8, c.white, M.glow, 0.95);
      }
      n++;
    }
    // the evening star, low over where the sun went
    const ex = 610, ey = 236;
    C.veil(ex - 30, ey - 30, ex + 30, ey + 30, (x, y, col) => { const d = Math.hypot(x - ex, y - ey); col[0] = 1; col[1] = 0.96; col[2] = 0.86; return 0.34 * Math.exp(-d / 6.5); }, { g: 0.5, mode: 'lend' });
    C.dab(ex, ey, 2.3, c.white, M.glow, 1);
    for (const a of [0.03, 1.6]) C.stroke(P.line(R, ex - 15 * Math.cos(a), ey - 15 * Math.sin(a), ex + 15 * Math.cos(a), ey + 15 * Math.sin(a), 0.1, 0, 2), { w: 0.9, c: c.white, m: M.wax, p: 0.6, ti: 0.5, to: 0.5 });
  };
  S.moon = function (C, R) {
    const mo = Wd.MOON, r = 17;
    // halo
    C.veil(mo[0] - 120, mo[1] - 120, mo[0] + 120, mo[1] + 120, (x, y, col) => { const d = Math.hypot(x - mo[0], y - mo[1]); col[0] = 0.93; col[1] = 0.80; col[2] = 0.98; return 0.26 * Math.exp(-d / 26) + 0.10 * Math.exp(-d / 70); }, { g: 0.6, mode: 'lend' });
    // the old moon in the new moon's arms
    C.veil(mo[0] - r - 2, mo[1] - r - 2, mo[0] + r + 2, mo[1] + r + 2, (x, y, col) => { const d = Math.hypot(x - mo[0], y - mo[1]); col[0] = 0.47; col[1] = 0.40; col[2] = 0.72; return 0.5 * ss(r, r - 1.4, d); }, { g: 0.5 });
    // the lit limb faces the place the sun went: down and to the right
    const a0 = Math.atan2(Wd.SUNSET[1] + 240 - mo[1], Wd.SUNSET[0] - mo[0]);
    const ox = -Math.cos(a0) * 7.2, oy = -Math.sin(a0) * 7.2;
    C.veil(mo[0] - r - 2, mo[1] - r - 2, mo[0] + r + 2, mo[1] + r + 2, (x, y, col) => {
      const d = Math.hypot(x - mo[0], y - mo[1]), d2 = Math.hypot(x - mo[0] - ox, y - mo[1] - oy);
      col[0] = 1; col[1] = 0.985; col[2] = 0.90; return ss(r, r - 1.2, d) * ss(r + 0.4, r + 1.8, d2) * 1.0;
    }, { g: 0.25, mode: 'lend' });
    for (let i = 0; i < 5; i++) C.stroke(P.arc(R, mo[0], mo[1], r - 1.6 - i * 0.5, a0 - 1.25 + i * 0.1, a0 + 1.25 - i * 0.1, 0.02), { w: 1.6, c: c.white, m: M.glow, p: 0.8, ti: 0.5, to: 0.5 });
    C.stroke(P.circle(R, mo[0], mo[1], r, 1.05, 0.02), { w: 0.8, c: hx('#8a78c8'), m: M.wax, p: 0.3 });
  };
})(typeof self !== 'undefined' ? self : globalThis);
