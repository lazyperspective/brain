// chalk.js -- what two children did to the inside of it one summer, with a stick of yellow chalk and a stick
// of pink: joined the holes up into things, and kept score of a game nobody else knew the rules of.
// Then the last small lights, and two moths that have come in out of the rain.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, fbm = A.fbm, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c, N = Wd.N;
  const o3 = [0, 0, 0], t3 = [0, 0, 0], col3 = [0, 0, 0];
  const lum = v => 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];
  const Y = 0, K = 1;      // the yellow hand, the pink hand
  const chalkOf = h => (h === Y ? c.chalkY : c.chalkP);

  // a chalk line the way an eight-year-old draws one: pressed hard, a little past where it was going, sometimes twice
  function ln(C, R, h, x0, y0, x1, y1, o) {
    o = o || {}; const len = Math.hypot(x1 - x0, y1 - y0), ov = o.ov === undefined ? R.r(0, 5) : o.ov, ux = (x1 - x0) / (len || 1), uy = (y1 - y0) / (len || 1);
    const pts = P.line(R, x0 - ux * R.r(0, 2), y0 - uy * R.r(0, 2), x1 + ux * ov, y1 + uy * ov, 1.3, 0.035, 4);
    C.stroke(pts, { w: (o.w || R.r(2.3, 3.2)) * 1.42, c: chalkOf(h), m: M.chalk, p: (o.p || 0.76) * R.r(0.78, 0.94), k: o.k || 0.8, ti: 0.06, to: 0.18, pv: 0.26, wv: 0.3, cj: 0.03 });
    if (R.chance(o.twice === undefined ? 0.25 : o.twice)) C.stroke(P.line(R, x0 + R.g() * 1.5, y0 + R.g() * 1.5, x1 + R.g() * 2, y1 + R.g() * 2, 1.3, 0.04, 4), { w: R.r(1.6, 2.6), c: chalkOf(h), m: M.chalk, p: (o.p || 0.62) * 0.6, ti: 0.2, to: 0.3, pv: 0.4, nodust: true });
  }
  function curve(C, R, h, ctrl, o) {
    o = o || {};
    const sp = P.spline(ctrl, 3, o.closed);
    C.stroke(P.wob(R, sp, 1.0, 22), { w: (o.w || R.r(2.3, 3.1)) * 1.42, c: chalkOf(h), m: M.chalk, p: (o.p || 0.76) * R.r(0.78, 0.94), k: o.k || 0.8, ti: 0.05, to: 0.14, pv: 0.24, wv: 0.3, cj: 0.03 });
    if (sp.length > 60) C.stroke(P.wob(R, sp, 1.6, 30), { w: 1.8, c: chalkOf(h), m: M.chalk, p: (o.p || 0.66) * 0.55, ti: 0.1, to: 0.2, pv: 0.3, nodust: true });
  }
  function ring(C, R, h, x, y, r, o) { o = o || {}; C.stroke(P.circle(R, x, y, r, o.turns || R.r(1.05, 1.3), 0.09), { w: (o.w || R.r(2.0, 2.8)) * 1.35, c: chalkOf(h), m: M.chalk, p: (o.p || 0.66) * R.r(0.85, 1.05), k: 0.8, ti: 0.1, to: 0.25, pv: 0.3, wv: 0.25, cj: 0.03 }); }
  // the hole a figure is hung on
  function star(C, R, x, y, r) { if (!Wd.at(x, y, o3)) return; const a = Wd.starLight(x, y, col3); C.pin(x, y, r || R.r(1.3, 2.1), col3, { a: Math.max(a, 0.8), halo: 6 }); }
  // join the dots: pts [[x,y],...], each a hole; idx pairs to join
  function figure(C, R, h, pts, joins, o) {
    o = o || {};
    for (const j of joins) ln(C, R, h, pts[j[0]][0], pts[j[0]][1], pts[j[1]][0], pts[j[1]][1], o);
    for (const p of pts) if (p[2] !== 0) star(C, R, p[0], p[1], p[2]);
  }
  Wd.FLARES = [];

  S.chalk = function (C, R) {
    C.stencil(Wd.stencil(C), 1);
    // ---- a ladder, leaned against the moon (pink)
    {
      const a0 = [984, 470], a1 = [1104, 356], b0 = [1010, 492], b1 = [1126, 380];
      ln(C, R, K, a0[0], a0[1], a1[0], a1[1], { twice: 1 }); ln(C, R, K, b0[0], b0[1], b1[0], b1[1], { twice: 0.6 });
      for (let i = 0; i < 6; i++) { const t = 0.1 + i * 0.155 + R.g() * 0.012; ln(C, R, K, a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t, b0[0] + (b1[0] - b0[0]) * (t + R.g() * 0.02), b0[1] + (b1[1] - b0[1]) * (t + R.g() * 0.02), { ov: 2, twice: 0.1, w: 2.2 }); }
      star(C, R, a0[0], a0[1], 1.8); star(C, R, b0[0], b0[1], 1.5); star(C, R, a1[0], a1[1], 1.6); star(C, R, b1[0], b1[1], 2.0);
    }
    // ---- a crown (yellow)
    {
      const p = [[1160, 120, 1.6], [1178, 54, 2.0], [1206, 96, 1.3], [1233, 40, 2.4], [1259, 93, 1.3], [1288, 50, 1.9], [1305, 116, 1.6]];
      figure(C, R, Y, p, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]]);
      for (const i of [1, 3, 5]) ring(C, R, Y, p[i][0], p[i][1], 6.5, { w: 1.8, p: 0.5 });
      Wd.FLARES.push([1233, 40, 26]);
    }
    // ---- a key (pink)
    {
      ring(C, R, K, 726, 150, 19, { turns: 1.2 }); ring(C, R, K, 726, 150, 8, { w: 1.8, p: 0.5 });
      ln(C, R, K, 740, 137, 842, 58, { twice: 1 });
      ln(C, R, K, 812, 81, 826, 100, { ov: 1 }); ln(C, R, K, 829, 68, 844, 86, { ov: 1 });
      star(C, R, 842, 58, 2.0); star(C, R, 707, 146, 1.4); star(C, R, 826, 100, 1.2); star(C, R, 844, 86, 1.3);
    }
    // ---- a boat, with a sail (yellow)
    {
      const p = [[1262, 286, 1.6], [1284, 304, 1.2], [1352, 296, 1.3], [1378, 268, 1.8], [1318, 290, 0], [1316, 214, 2.2], [1364, 262, 1.3]];
      figure(C, R, Y, p, [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 4]]);
      curve(C, R, Y, [[1250, 318], [1270, 312], [1290, 320], [1312, 312], [1334, 320], [1356, 312], [1380, 318]], { w: 1.9, p: 0.45 });   // the sea it is on
    }
    // ---- a snail (yellow), going somewhere slowly
    {
      const cx = 918, cy = 682, sp = []; for (let i = 0; i <= 44; i++) { const t = i / 44, a = 3.4 + t * 13.2, r = 3 + t * 27; sp.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92]); }
      curve(C, R, Y, sp);
      curve(C, R, Y, [[958, 710], [920, 716], [880, 716], [852, 712], [838, 700], [836, 684], [846, 676]]);
      ln(C, R, Y, 840, 682, 826, 656, { ov: 0 }); ln(C, R, Y, 848, 678, 846, 650, { ov: 0 });
      star(C, R, 826, 656, 1.5); star(C, R, 846, 650, 1.7); star(C, R, cx, cy, 2.2); star(C, R, 958, 710, 1.3);
      for (let i = 0; i < 4; i++) ln(C, R, Y, 972 + i * 15, 716 + R.g(), 980 + i * 15, 716 + R.g(), { ov: 0, twice: 0, w: 1.8, p: 0.4 });      // where it has been
    }
    // ---- a whale, spouting (yellow), under the blue-green light
    {
      curve(C, R, Y, [[142, 614], [166, 590], [208, 577], [258, 580], [292, 598], [305, 622], [292, 643], [250, 653], [200, 648], [162, 634], [142, 614]]);
      curve(C, R, Y, [[142, 614], [122, 602], [110, 584], [104, 572]], { p: 0.9 }); curve(C, R, Y, [[142, 614], [120, 622], [106, 634], [98, 646]], { p: 0.9 });
      curve(C, R, Y, [[252, 583], [250, 561], [240, 547], [226, 549]], { w: 2.0 }); curve(C, R, Y, [[252, 583], [258, 560], [272, 548], [284, 553]], { w: 2.0 });
      star(C, R, 268, 613, 2.1); star(C, R, 104, 572, 1.5); star(C, R, 98, 646, 1.4); star(C, R, 226, 549, 1.2); star(C, R, 284, 553, 1.3);
      curve(C, R, Y, [[282, 632], [266, 639], [250, 638]], { w: 1.8, p: 0.5 });                                                                 // it is smiling
    }
    // ---- two birds, one by each hand
    {
      const bird = (h, x, y, s) => { curve(C, R, h, [[x - 26 * s, y - 2 * s], [x - 14 * s, y - 14 * s], [x, y]]); curve(C, R, h, [[x, y], [x + 13 * s, y - 15 * s], [x + 27 * s, y - 5 * s]]); star(C, R, x, y, 1.7); star(C, R, x - 26 * s, y - 2 * s, 1.1); star(C, R, x + 27 * s, y - 5 * s, 1.1); };
      bird(Y, 262, 398, 1.05); bird(K, 334, 380, 0.9);
    }
    // ---- a caterpillar, where the cloth turns away (yellow and pink, turn about)
    {
      const xs = [70, 104, 136, 166, 194]; xs.forEach((x, i) => { ring(C, R, i % 2 ? K : Y, x, 150 - i * 3, 13 - i * 0.8, { w: 2 }); star(C, R, x, 150 - i * 3, 1.3); });
      ln(C, R, Y, 60, 140, 50, 122, { ov: 0 }); ln(C, R, Y, 72, 137, 70, 118, { ov: 0 });
    }
    // ---- the one they both liked best: ringed by both hands
    {
      const x = 1150, y = 556; star(C, R, x, y, 3.0); ring(C, R, Y, x, y, 15, { turns: 2.1 }); ring(C, R, K, x + 1, y - 1, 21, { turns: 1.6 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.2, h = i % 2 ? K : Y; ln(C, R, h, x + Math.cos(a) * 28, y + Math.sin(a) * 28, x + Math.cos(a) * R.r(37, 44), y + Math.sin(a) * R.r(37, 44), { ov: 0, twice: 0, w: 2.1 }); }
      Wd.FLARES.push([x, y, 30]);
    }
    // ---- the game. Nobody else ever knew the rules. Yellow goes in rings, pink in crosses.
    {
      const bx = 520, by = 600;
      const cells = [[0, 0], [40, -8], [82, -2], [14, 36], [58, 34], [100, 42], [36, 72], [80, 76]];
      const P2 = cells.map(q => [bx + q[0] + R.g() * 2, by + q[1] + R.g() * 2]);
      // the board: a crooked honeycomb of lines
      const edges = [[0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4], [2, 5], [3, 4], [4, 5], [3, 6], [4, 6], [4, 7], [5, 7], [6, 7]];
      for (const e of edges) ln(C, R, e[0] % 2 ? K : Y, P2[e[0]][0], P2[e[0]][1], P2[e[1]][0], P2[e[1]][1], { ov: 3, twice: 0.15, w: 2.0, p: 0.5 });
      // moves made
      const cen = (a, b, d) => [(P2[a][0] + P2[b][0] + P2[d][0]) / 3, (P2[a][1] + P2[b][1] + P2[d][1]) / 3];
      const yel = [cen(0, 1, 3), cen(2, 4, 5), cen(3, 4, 6)], pnk = [cen(1, 3, 4), cen(1, 2, 4), cen(4, 5, 7)];
      for (const q of yel) ring(C, R, Y, q[0], q[1], 6.5, { w: 2.0 });
      for (const q of pnk) { ln(C, R, K, q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5, { ov: 0, twice: 0, w: 2.0 }); ln(C, R, K, q[0] + 5, q[1] - 5, q[0] - 5, q[1] + 5, { ov: 0, twice: 0, w: 2.0 }); }
      // the cell nobody has taken yet
      for (const i of [0, 2, 5, 6, 7]) star(C, R, P2[i][0], P2[i][1], 1.3);
      // an arrow in from outside: whose turn it is
      ln(C, R, K, bx + 132, by + 92, bx + 96, by + 66, { ov: 0 }); ln(C, R, K, bx + 96, by + 66, bx + 110, by + 68, { ov: 0, twice: 0 }); ln(C, R, K, bx + 96, by + 66, bx + 100, by + 80, { ov: 0, twice: 0 });
    }
    // ---- the score: bundles of five, a row to each hand. It was level.
    {
      const tally = (h, x, y, n) => { for (let i = 0; i < n; i++) { const g = Math.floor(i / 5), k = i % 5, gx = x + g * 30; if (k < 4) ln(C, R, h, gx + k * 5.2 + R.g() * 0.6, y - 9 + R.g(), gx + k * 5.2 + R.g() * 0.8 + 1.5, y + 9 + R.g(), { ov: 0, twice: 0, w: 2.0, p: 0.66 }); else ln(C, R, h, gx - 4, y + 5 + R.g(), gx + 20, y - 6 + R.g(), { ov: 0, twice: 0, w: 2.0, p: 0.66 }); } };
      tally(Y, 706, 716, 12); tally(K, 716, 744, 12);
      ring(C, R, Y, 694, 716, 4, { w: 1.8 }); ln(C, R, K, 700, 740, 708, 748, { ov: 0, twice: 0, w: 1.8 }); ln(C, R, K, 708, 740, 700, 748, { ov: 0, twice: 0, w: 1.8 });
    }
    // ---- and small things between: a spiral, a row of dots, a zigzag
    {
      const sp = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * 11, r = 2 + t * 15; sp.push([1420 + Math.cos(a) * r, 180 + Math.sin(a) * r * 0.8]); } curve(C, R, K, sp, { w: 2.0 });
      star(C, R, 1420, 180, 1.6);
      curve(C, R, Y, [[420, 78], [440, 58], [458, 80], [478, 56], [496, 78], [516, 54]], { w: 2.0 });
      for (let i = 0; i < 7; i++) C.dab(1050 + i * 13, 228 + Math.sin(i) * 3, 1.7, c.chalkP, M.chalk, 0.7);
    }
    C.stencil();
  };

  // ------------------------------------------------------------------ two moths, come in out of the rain, as near the moon as they can get
  S.moths = function (C, R) {
    const moth = (x, y, a, s) => {
      const ca = Math.cos(a), sa = Math.sin(a), X = (u, v) => [x + (ca * u - sa * v) * s, y + (sa * u + ca * v) * s];
      C.stencil(Wd.stencil(C), 1);
      for (const sg of [-1, 1]) {
        // the shadow it lays on the cloth, then the wing: a few strokes of a pale stick
        const s0 = X(0, 1.5), s1 = X(sg * 10, -4 + 1.5), s2 = X(sg * 9, 6 + 1.5);
        C.stroke([s0[0] + 1.5, s0[1] + 2, (s1[0] + s2[0]) / 2 + 1.5, (s1[1] + s2[1]) / 2 + 2], { w: 9 * s, c: c.ink, m: M.pastel, p: 0.3, ti: 0.1, to: 0.4, nodust: true });
        for (let i = 0; i < 5; i++) { const t = i / 4, e = X(sg * (10.5 - t * 2), -5 + t * 11), b = X(sg * 0.8, -1 + t * 2); C.stroke([b[0], b[1], e[0], e[1]], { w: 3.4 * s, c: mix(hx('#f3e6c8'), hx('#cdbfd8'), t * 0.8 + R() * 0.2), m: M.pastel, p: R.r(0.6, 0.82), ti: 0.05, to: 0.35, nodust: true }); }
        const m0 = X(sg * 5.5, -2.5), m1 = X(sg * 7, 3); C.stroke([m0[0], m0[1], m1[0], m1[1]], { w: 1.0, c: hx('#8a7a8c'), m: M.pencil, p: 0.6, ti: 0, to: 0 });
        C.dab(X(sg * 6.5, 0)[0], X(sg * 6.5, 0)[1], 0.9 * s, hx('#6d5c78'), M.pencil, 0.8);
        const an0 = X(sg * 0.6, -3), an1 = X(sg * 4, -9); C.stroke([an0[0], an0[1], an1[0], an1[1]], { w: 0.7, c: hx('#e9dcc8'), m: M.wax, p: 0.6, ti: 0, to: 0.4 });
      }
      const b0 = X(0, -3), b1 = X(0, 5); C.stroke([b0[0], b0[1], b1[0], b1[1]], { w: 2.6 * s, c: hx('#b9a48e'), m: M.pastel, p: 0.85, ti: 0.1, to: 0.3, nodust: true });
      C.stroke([b0[0], b0[1], X(0, 0)[0], X(0, 0)[1]], { w: 1.4 * s, c: hx('#fff3da'), m: M.wax, p: 0.7, ti: 0, to: 0.3 });
      C.stencil();
    };
    moth(1064, 244, 0.5, 1.45); moth(1096, 264, 0.95, 1.2);
  };

  // ------------------------------------------------------------------ the hard little lights a cel painter would add last: four points to each
  function flare(C, R, x, y, L, col) {
    C.glow(x, y, L * 0.75, col, 0.34, { pow: 3 });
    for (const [dx, dy, k] of [[1, 0, 1], [0, 1, 0.8], [0.7, 0.7, 0.3], [0.7, -0.7, 0.3]]) {
      const l = L * k * R.r(0.9, 1.1), w = P.line(R, x - dx * l, y - dy * l, x + dx * l, y + dy * l, 0.25, 0.006, 3);
      C.stroke(w, { w: k > 0.5 ? 1.25 : 0.9, c: mix(col, c.white, 0.6), m: M.wax, p: k > 0.5 ? 0.78 : 0.5, ti: 0.5, to: 0.5, pv: 0.05, cj: 0 });
    }
    C.pin(x, y, 1.1, mix(col, c.white, 0.5), { a: 1, halo: 5 });
  }
  S.flares = function (C, R) {
    const st = Wd.placeStars().filter(s => s.r > 1.25 && s.x > 30 && s.x < 1570 && s.y > 30 && s.y < 860).map(s => ({ s, a: Wd.starLight(s.x, s.y, [0, 0, 0]) })).sort((a, b) => b.a * b.s.r - a.a * a.s.r);
    const used = [];
    for (const q of st) {
      if (used.length >= 13) break;
      if (used.some(u => Math.hypot(u[0] - q.s.x, u[1] - q.s.y) < 150)) continue;
      // only where the cloth, not the iron, is on top
      Wd.starLight(q.s.x, q.s.y, col3); flare(C, R, q.s.x, q.s.y, R.r(12, 26) * (0.7 + 0.3 * q.a), [col3[0], col3[1], col3[2]]); used.push([q.s.x, q.s.y]);
    }
    for (const f of Wd.FLARES) { Wd.starLight(f[0], f[1], col3); flare(C, R, f[0], f[1], f[2], [col3[0], col3[1], col3[2]]); }
    // one on the press-stud, one on a drop that is about to fall
    if (Wd.STRAP) flare(C, R, Wd.STRAP[0] - Wd.down(Wd.STRAP[0], Wd.STRAP[1])[0] * 8 - 1.8, Wd.STRAP[1] - Wd.down(Wd.STRAP[0], Wd.STRAP[1])[1] * 8 - 2.0, 13, c.lemon);
    const tp = (Wd.TIPS || []).filter(t => t[0] > 20 && t[0] < 1580 && t[1] < 880);
    for (const t of tp) { Wd.behind(t[0], t[1], t3); flare(C, R, t[0] - t[2] * 0.3, t[1] - t[2] * 0.35, 9 + t[2] * 1.2, mix(t3, c.white, 0.4)); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
