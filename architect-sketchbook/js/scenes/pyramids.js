/* SHEET 6 — The Giza pyramids (coloured: pencil + sand watercolour) */
(window.SCENES = window.SCENES || []).push({
  name: 'Pyramids', seed: 67, ink: '#2e2a26',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp, lp = S.lerpP;
    P.frame('THE PYRAMIDS OF GIZA', 'KHUFU - KHAFRE - MENKAURE', n, t, { scale: 'VARIOUS', note: 'pencil + sand watercolour' });
    const HZ = 468;
    const cap = (x, y, a, b) => { P.label(a, x, y, { size: 18 }); if (b) P.text(b, x + P.measure(a, 18) + 12, y, { size: 15 }); };

    /* ---------- sky, sun, desert plane ---------- */
    P.wash([[48, 48], [1552, 48], [1552, HZ + 4], [48, HZ + 4]], '#f4d7a6', 0.4, { grad: { x0: 0, y0: 48, x1: 0, y1: HZ, c0: '#9cc4dc', c1: '#f8dcae', a0: 0.5, a1: 0.55 }, jit: 0.5, edge: 0 });
    P.circle(1420, 158, 40, { w: 1.3, passes: 2 });
    for (let a = 0; a < 32; a++) { const an = a * TAU / 32, r0 = 48, r1 = a % 2 ? 60 : 74; P.line(1420 + Math.cos(an) * r0, 158 + Math.sin(an) * r0, 1420 + Math.cos(an) * r1, 158 + Math.sin(an) * r1, { w: 0.6, a: 0.6, passes: 1, over: 0, rough: 0.4, c: '#b96a1a' }); }
    P.wash(P.sample([[1380, 158], [1420, 118], [1460, 158], [1420, 198]], true, 5), '#ffcf5f', 0.9, { edge: 0.4 });
    for (let i = 0; i < 7; i++) { const y = 96 + i * 34 + P.r(0, 10), x = P.r(80, 900), l = P.r(80, 240); P.curve([[x, y], [x + l * 0.5, y - 3], [x + l, y + 1]], { w: 0.5, a: 0.3, rough: 0.9 }); }
    P.wash([[48, HZ - 2], [1552, HZ - 2], [1552, 596], [48, 596]], '#ecd09a', 0.55, { grad: { x0: 0, y0: HZ, x1: 0, y1: 596, c0: '#f1dbaa', c1: '#d9a95e', a0: 0.5, a1: 0.7 }, jit: 0.5, edge: 0 });
    for (let i = 0; i < 9; i++) P.line(60 + P.r(0, 200), HZ + 1 + i * 1.6, 1540 - P.r(0, 200), HZ + 1 + i * 1.6, { w: 0.4, a: 0.28, passes: 1, rough: 0.7 });
    // far dunes on the horizon
    P.curve([[48, HZ], [200, HZ - 10], [330, HZ - 3], [460, HZ - 12], [560, HZ]], { w: 0.9, a: 0.6, rough: 0.9 }); P.curve([[1000, HZ], [1160, HZ - 8], [1300, HZ - 2], [1440, HZ - 11], [1552, HZ - 3]], { w: 0.9, a: 0.6, rough: 0.9 });

    /* ---------- pyramid builder ---------- */
    const courses = (A, B0, B1, N, skip, blocks) => {
      for (let j = 1; j < N; j++) {
        const s = j / N; if (s < skip) continue;
        const p0 = lp(A, B0, s), p1 = lp(A, B1, s), q0 = lp(A, B0, (j - 1) / N), q1 = lp(A, B1, (j - 1) / N);
        if (P.R() > 0.08) P.line(p0[0], p0[1], p1[0], p1[1], { w: 0.5, a: 0.55, rough: 0.5, passes: 1, over: 0.3 });
        const cnt = Math.max(2, Math.round(s * blocks)), off = j % 2 ? 0.5 : 0;
        for (let k = 0; k <= cnt; k++) { const u = (k + off) / cnt; if (u <= 0.02 || u >= 0.98 || P.R() < 0.1) continue; const a = lp(q0, q1, u), b = lp(p0, p1, u); P.line(a[0], a[1], b[0], b[1], { w: 0.4, a: 0.42, passes: 1, over: 0, rough: 0.3 }); }
      }
    };
    const pyr = (A, L, F, R, N, blocks, o = {}) => {
      P.erase([L, A, R, F]);
      courses(A, L, F, N, o.skip || 0, blocks); courses(A, F, R, N, o.skip || 0, blocks);
      const left = [A, L, F], right = [A, F, R];
      P.wash(left, '#efcf8c', 0.62, { grad: { x0: 0, y0: A[1], x1: 0, y1: F[1], c0: '#f4dba4', c1: '#e3b46a', a0: 0.6, a1: 0.7 }, jit: 0.8 });
      P.wash(right, '#b9885a', 0.62, { grad: { x0: 0, y0: A[1], x1: 0, y1: F[1], c0: '#c69863', c1: '#9a6a3c', a0: 0.6, a1: 0.75 }, jit: 0.8 });
      if (o.skip) { P.wash([A, lp(A, L, o.skip), lp(A, F, o.skip)], '#fff1cf', 0.7, { edge: 0.3, jit: 0.4 }); P.wash([A, lp(A, F, o.skip), lp(A, R, o.skip)], '#e6cba0', 0.55, { edge: 0.3, jit: 0.4 }); const a = lp(A, L, o.skip), b = lp(A, F, o.skip), c = lp(A, R, o.skip); P.curve([a, lp(a, b, 0.5), b], { w: 0.8, rough: 0.6 }); P.curve([b, lp(b, c, 0.5), c], { w: 0.8, rough: 0.6 }); }
      P.hatch(right, { ang: 72, gap: o.gap ?? 2.8, a: 0.42, w: 0.5, fade: () => 0.85, piece: 14 });
      P.hatch(left, { ang: -62, gap: (o.gap ?? 2.8) * 2.4, a: 0.22, w: 0.45, fade: (x, y) => Math.max(0, (x - L[0]) / (F[0] - L[0]) - 0.35), piece: 12 });
      P.line(A[0], A[1], L[0], L[1], { w: 1.6, rough: 0.6 }); P.line(A[0], A[1], R[0], R[1], { w: 1.6, rough: 0.6 }); P.line(A[0], A[1], F[0], F[1], { w: 1.8, rough: 0.5 });
      P.line(L[0], L[1], F[0], F[1], { w: 1.6, rough: 0.5 }); P.line(F[0], F[1], R[0], R[1], { w: 1.6, rough: 0.5 });
      // cast shadow on the sand, and stones tumbled off the corners
      const sh = [F, R, [R[0] + o.shadow, R[1] + 10], [F[0] + o.shadow * 0.8, F[1] + 22]];
      P.wash(sh, '#7a5a3a', 0.28, { edge: 0, jit: 1 }); P.hatch(sh, { ang: 2, gap: 3.2, a: 0.28, w: 0.45, piece: 30 });
      for (let i = 0; i < Math.round(o.rocks || 6); i++) { const x = P.r(L[0] - 30, R[0] + 40), y = Math.max(L[1], R[1]) + P.r(2, 14) + (x > F[0] ? 4 : 0), w = P.r(3, 8); P.poly([[x, y], [x + w, y - w * 0.5], [x + w * 1.4, y + 1], [x + w * 0.4, y + 3]], { w: 0.7, rough: 0.3, passes: 1, over: 0 }); }
    };
    /* ---------- the three pyramids (far to near) ---------- */
    pyr([1362, 372], [1288, 470], [1356, 480], [1436, 468], 16, 12, { shadow: 60, rocks: 4, gap: 2.6 });
    pyr([1086, 262], [928, 471], [1074, 490], [1240, 470], 32, 24, { skip: 0.24, shadow: 130, rocks: 7 });
    // the three queens' pyramids
    [[1010, 508, 46], [1058, 510, 40], [1104, 512, 34]].forEach(([x, y, h]) => pyr([x + 6, y - h], [x - 24, y - 2], [x + 4, y + 6], [x + 34, y - 3], 7, 6, { shadow: 16, rocks: 1, gap: 2.2 }));
    pyr([650, 146], [312, 480], [642, 514], [988, 470], 46, 28, { shadow: 240, rocks: 12 });
    // entrance of the Great Pyramid (gabled lintel)
    { const b = lp(lp([650, 146], [312, 480], 0.28), lp([650, 146], [642, 514], 0.28), 0.55); P.poly([[b[0] - 8, b[1] + 8], [b[0], b[1] - 5], [b[0] + 8, b[1] + 8]], { w: 1.1, rough: 0.2 }); P.wash([[b[0] - 6, b[1] + 8], [b[0], b[1] - 3], [b[0] + 6, b[1] + 8]], '#2b2118', 0.85, { edge: 0, steps: 3, jit: 0.2 }); }
    // wobbly weathering marks
    for (let i = 0; i < 9; i++) { const s = P.r(0.3, 0.9), u = P.r(0.1, 0.8), a = lp(lp([650, 146], [312, 480], s), lp([650, 146], [642, 514], s), u); P.curve([[a[0], a[1]], [a[0] + P.r(3, 9), a[1] + P.r(4, 8)], [a[0] + P.r(-2, 6), a[1] + P.r(9, 16)]], { w: 0.5, a: 0.6, rough: 0.8 }); }

    /* ---------- Great Sphinx (foreground left) ---------- */
    { const sp = [[112, 550], [128, 532], [150, 519], [182, 511], [216, 508], [248, 503], [266, 492], [272, 474], [276, 456], [288, 441], [306, 434], [322, 440], [331, 456], [329, 474], [326, 488], [329, 500], [352, 506], [384, 514], [392, 532], [380, 550]];
      P.erase(P.sample(sp, true, 6));
      P.curve(sp, { closed: true, w: 1.7, rough: 0.7, passes: 2 });
      P.line(112, 550, 380, 550, { w: 1.4, rough: 0.5 });
      // nemes headdress, face & broken nose
      P.curve([[288, 441], [284, 462], [286, 484], [292, 500]], { w: 1, rough: 0.4 }); P.curve([[306, 434], [312, 444], [326, 452]], { w: 0.8, rough: 0.3 });
      P.circle(316, 456, 2, { w: 0.9, passes: 1 }); P.line(310, 452, 320, 451, { w: 0.9, passes: 1, over: 0, rough: 0.1 });
      P.pl([[329, 462], [324, 468], [327, 472]], { w: 0.8, rough: 0.2 }); P.curve([[322, 478], [326, 480], [328, 478]], { w: 0.7, rough: 0.2 });
      for (let i = 0; i < 6; i++) P.line(292 + i * 1.2, 446 + i * 8, 284 + i * 0.6, 452 + i * 8, { w: 0.5, a: 0.6, passes: 1, over: 0, rough: 0.2 });
      // paws & haunch
      P.line(340, 528, 392, 528, { w: 0.9, rough: 0.3 }); P.curve([[340, 510], [346, 528], [344, 550]], { w: 0.7, rough: 0.3 }); P.curve([[150, 530], [180, 520], [204, 532], [200, 550]], { w: 0.8, rough: 0.4 });
      for (let x = 166; x < 330; x += 22) P.curve([[x, 512], [x + 4, 528], [x + 2, 548]], { w: 0.4, a: 0.5, rough: 0.6, passes: 1 });
      P.wash(P.sample(sp, true, 6), '#e6c284', 0.66, { grad: { x0: 0, y0: 434, x1: 0, y1: 550, c0: '#f0d59c', c1: '#c99a5c', a0: 0.6, a1: 0.7 }, jit: 0.7 });
      P.hatch(P.sample(sp, true, 6), { ang: -60, gap: 3, a: 0.4, w: 0.45, fade: (x, y) => Math.max(0, (y - 470) / 80) * 0.7 + (x < 220 ? 0.15 : 0), piece: 9 });
      P.stipple([[112, 552], [380, 552], [396, 562], [100, 562]], 50, { a: 0.5, r: 0.9 });
    }

    /* ---------- camel caravan (foreground right) ---------- */
    const camel = (x, y, s, dir) => {
      const T = (px, py) => [x + px * s * dir, y + py * s];
      const body = [[-34, -30], [-30, -38], [-18, -46], [-8, -40], [0, -32], [14, -31], [24, -33], [32, -46], [40, -60], [50, -66], [58, -62], [57, -56], [48, -54], [40, -48], [36, -36], [32, -22]];
      const pts = body.map(p => T(...p));
      P.curve(pts, { w: 1.4, rough: 0.5 });
      P.curve([T(-34, -30), T(-36, -22), T(-30, -20)], { w: 1.2, rough: 0.4 }); P.curve([T(-30, -20), T(0, -17), T(32, -22)], { w: 1.2, rough: 0.4 });
      [[[28, -22], [26, -11], [28, 0]], [[20, -20], [18, -10], [20, 0]], [[-28, -21], [-33, -10], [-30, 0]], [[-18, -19], [-20, -9], [-18, 0]]].forEach(l => P.curve(l.map(p => T(...p)), { w: 1.1, rough: 0.35, passes: 1 }));
      [[28, 0], [20, 0], [-30, 0], [-18, 0]].forEach(([px, py]) => { const a = T(px - 3, py), b = T(px + 3, py); P.line(a[0], a[1], b[0], b[1], { w: 1.1, passes: 1, over: 0, rough: 0.1 }); });
      P.line(...T(-35, -28), ...T(-42, -14), { w: 0.9, passes: 1, over: 0, rough: 0.3 });
      P.circle(...T(52, -59), 0.9, { w: 0.8, passes: 1 }); P.line(...T(58, -57), ...T(60, -56), { w: 0.8, passes: 1, over: 0 });
      const bl = [T(-20, -42), T(2, -38), T(0, -24), T(-22, -26)]; P.poly(bl, { w: 0.9, rough: 0.25, passes: 1 }); P.wash(bl, '#b3463a', 0.7, { edge: 0.3, jit: 0.3, steps: 3 });
      const rd = [T(-14, -48), T(-9, -50), T(-6, -66), T(-16, -66)]; P.poly(rd, { w: 0.9, rough: 0.25, passes: 1 }); P.wash(rd, '#f2ead8', 0.8, { edge: 0.3, jit: 0.3, steps: 2 });
      P.circle(...T(-11, -71), 3.6 * s, { w: 0.9, passes: 1 }); P.wash(P.sample([T(-14, -71), T(-11, -75), T(-8, -71), T(-11, -67)], true, 2), '#c88a5c', 0.7, { edge: 0, steps: 2, jit: 0.2 });
      const wash = P.sample(pts.concat([T(30, -20), T(0, -17), T(-30, -20)]), true, 4);
      P.wash(wash, '#c79b63', 0.68, { edge: 0.5, jit: 0.6 });
      P.hatch(wash, { ang: -55, gap: 2.2, a: 0.42, w: 0.4, fade: (px, py) => (py > y - 30 ? 0.9 : 0.25), piece: 6 });
      return T(-40, -10);
    };
    { const cs = [[1140, 548, 0.95], [1252, 540, 0.9], [1362, 546, 1], [1470, 538, 0.88]];
      cs.forEach(([x, y, s]) => camel(x, y, s, -1));
      for (let i = 0; i + 1 < cs.length; i++) P.curve([[cs[i][0] + 38 * cs[i][2], cs[i][1] - 26], [(cs[i][0] + cs[i + 1][0]) / 2 + 28, cs[i][1] - 20], [cs[i + 1][0] - 58 * cs[i + 1][2] * 0.5, cs[i + 1][1] - 30]], { w: 0.5, a: 0.6, rough: 0.6, passes: 1 });
      cs.forEach(([x, y, s]) => P.wash(P.sample([[x - 30, y + 2], [x + 38, y + 2], [x + 30, y + 6], [x - 40, y + 5]], true, 4), '#7a5a3a', 0.2, { edge: 0, jit: 0.4 }));
    }
    // dunes
    [[[48, 574], [190, 556], [360, 570], [520, 560], [700, 574]], [[640, 590], [800, 566], [980, 580], [1120, 570]], [[1000, 590], [1200, 570], [1380, 586], [1552, 574]]].forEach((d, i) => { P.curve(d, { w: 1.2, a: 0.8, rough: 0.9 }); const poly = P.sample(d, false, 8).concat([[d[d.length - 1][0], 596], [d[0][0], 596]]); P.wash(poly, '#d9a95e', 0.45, { grad: { x0: 0, y0: 556, x1: 0, y1: 596, c0: '#e9c581', c1: '#c98f4a', a0: 0.4, a1: 0.65 }, jit: 1 }); P.hatch(poly, { ang: 12, gap: 3.4, a: 0.28, w: 0.45, fade: (x, y) => Math.min(1, (y - 560) / 26), piece: 24 }); P.stipple(poly, 40, { a: 0.5, r: 0.9 }); });
    for (let i = 0; i < 22; i++) { const x = P.r(60, 1540), y = P.r(560, 592), l = P.r(16, 44); P.curve([[x, y], [x + l / 2, y - 2], [x + l, y]], { w: 0.4, a: 0.5, rough: 0.6 }); }
    // birds, palm
    [[770, 100], [796, 112], [746, 116], [520, 210], [548, 224]].forEach(([x, y]) => { P.curve([[x - 8, y - 3], [x - 3, y - 7], [x, y]], { w: 0.9, rough: 0.2 }); P.curve([[x, y], [x + 3, y - 7], [x + 8, y - 3]], { w: 0.9, rough: 0.2 }); });
    { const px = 90, py = 578;
      P.curve([[px, py], [px - 4, py - 40], [px + 4, py - 70], [px + 2, py - 90]], { w: 1.6, rough: 0.5 });
      for (let a = 0; a < 7; a++) { const an = -Math.PI * (0.05 + a * 0.15), l = 34; P.curve([[px + 2, py - 90], [px + 2 + Math.cos(an) * l * 0.5, py - 90 + Math.sin(an) * l * 0.5 - 6], [px + 2 + Math.cos(an) * l, py - 90 + Math.sin(an) * l * 0.4 + 18]], { w: 1, rough: 0.4 }); }
      const fr = []; for (let a = 0; a < 7; a++) { const an = -Math.PI * (0.05 + a * 0.15); fr.push([px + 2 + Math.cos(an) * 34, py - 90 + Math.sin(an) * 14 + 16]); }
      P.wash([[px - 30, py - 86], [px + 2, py - 100], [px + 36, py - 86], [px + 34, py - 74], [px + 2, py - 84], [px - 30, py - 74]], '#4c7a3a', 0.6, { edge: 0.4, jit: 0.8 });
      for (let y = py - 4; y > py - 90; y -= 8) P.curve([[px - 4 + (py - y) * 0.02, y], [px + 1, y - 3], [px + 4, y]], { w: 0.5, a: 0.6, rough: 0.2, passes: 1 });
    }

    /* ---------- banner annotations ---------- */
    P.note('KHUFU  (CHEOPS)  146.6 m', 350, 116, 640, 150, { size: 20 });
    P.note('KHAFRE  143.5 m - LOOKS TALLER,', 780, 150, 1082, 264, { size: 18 });
    P.text('IT STANDS ON HIGHER GROUND', 780, 172, { size: 18, a: 0.85 });
    P.note('MENKAURE  65 m', 1280, 330, 1360, 376, { size: 18 });
    P.note('POLISHED CASING STONE', 1130, 218, 1094, 274, { size: 17 });
    P.text('STILL ON THE CAP', 1130, 238, { size: 17, a: 0.85 });
    P.note('3 QUEENS\' PYRAMIDS', 900, 582, 1050, 508, { size: 17 });
    P.note('GREAT SPHINX  73 m LONG', 130, 592, 210, 550, { size: 18 });
    P.note('CARAVAN', 1240, 592, 1260, 550, { size: 18 });
    P.note('ENTRANCE', 470, 250, 616, 300, { size: 17 });
    P.text('2.3 MILLION BLOCKS  x  2.5 TONNES', 470, 272, { size: 17, a: 0.85 });
    P.note('COURSES  -  210 IN ALL', 430, 400, 470, 340, { size: 17 });
    P.line(46, 598, 1554, 598, { w: 0.8, a: 0.6, rough: 0.7, passes: 1 });

    /* ---------- SECTION through the Great Pyramid ---------- */
    { const cx = 290, base = 900, K = 260 / 146.6, top = base - 146.6 * K, hb = 204.6;
      const Aa = [cx, top], Bl = [cx - hb, base], Br = [cx + hb, base];
      const tri = [Aa, Br, Bl];
      const spanAt = y => { const f = (y - top) / (base - top); return [cx - hb * f, cx + hb * f]; };
      // masonry courses
      for (let y = top + 8; y < base - 2; y += 6.4) { const [a, b] = spanAt(y); P.line(a + 1, y, b - 1, y, { w: 0.45, a: 0.55, rough: 0.4, passes: 1, over: 0 }); const cnt = Math.round((b - a) / 20), off = Math.floor(y / 6.4) % 2 ? 0.5 : 0; for (let k = 0; k <= cnt; k++) { const x = a + (k + off) * (b - a) / cnt; if (x > a + 2 && x < b - 2 && P.R() > 0.15) P.line(x, y, x + P.r(-1, 1), y + 6.4, { w: 0.35, a: 0.4, passes: 1, over: 0, rough: 0.2 }); } }
      P.wash(tri, '#e8c78a', 0.55, { grad: { x0: 0, y0: top, x1: 0, y1: base, c0: '#f4e0b0', c1: '#dcae66', a0: 0.5, a1: 0.65 }, jit: 0.6 });
      P.poly(tri, { w: 2, rough: 0.5 });
      // bedrock
      P.line(60, base, 520, base, { w: 1.8, rough: 0.5 });
      for (let x = 62; x < 516; x += 8) P.line(x, base + 2, x - 8, base + 12 + P.r(0, 4), { w: 0.5, a: 0.55, passes: 1, over: 0, rough: 0.3 });
      // passages (dark hatch), all drawn from computed geometry
      const E = [106.8, 872.3], Sub = [250, 943.9], J = [161.1, 899.5], G0 = [238, 861], G1 = [312, 824];
      const pass = (a, b, w = 4) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w; const poly = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]; P.erase(poly); P.poly(poly, { w: 1.1, rough: 0.2 }); P.hatch(poly, { ang: Math.atan2(dy, dx) * 180 / Math.PI + 90, gap: 1.8, a: 0.5, w: 0.4, inset: 0.4 }); };
      pass(E, Sub, 4); pass(J, G0, 4); pass(G0, [G0[0] + 52, G0[1]], 3.4);
      // grand gallery (wider, corbelled)
      { const gal = [[G0[0], G0[1] + 5], [G1[0], G1[1] + 5], [G1[0], G1[1] - 11], [G0[0], G0[1] - 11]]; P.erase(gal); P.poly(gal, { w: 1.2, rough: 0.2 }); for (let i = 1; i < 7; i++) { const f = i / 7; P.line(lerp(G0[0], G1[0], f), lerp(G0[1], G1[1], f) + 5, lerp(G0[0], G1[0], f), lerp(G0[1], G1[1], f) - 11, { w: 0.5, a: 0.7, passes: 1, over: 0 }); } P.hatch(gal, { ang: 80, gap: 2.6, a: 0.35, w: 0.4 }); }
      pass(G1, [G1[0] + 18, G1[1]], 3.4);
      // subterranean chamber
      P.erase([[212, 934], [290, 934], [290, 954], [212, 954]]); P.rect(212, 934, 78, 20, { w: 1.3, rough: 0.3 }); P.hatch([[212, 934], [290, 934], [290, 954], [212, 954]], { ang: 40, gap: 3.4, a: 0.3, w: 0.4 });
      P.line(250, 944 - 2, 250 + 8, 940, { w: 0.5, passes: 1, over: 0 });
      // queen's chamber with gabled roof
      P.erase([[262, 838], [318, 838], [318, 862], [262, 862]]); P.pl([[262, 862], [262, 842], [290, 826], [318, 842], [318, 862], [262, 862]], { w: 1.3, rough: 0.3 }); P.hatch([[262, 862], [262, 842], [290, 826], [318, 842], [318, 862]], { ang: 50, gap: 3.4, a: 0.3, w: 0.4 });
      P.rect(273, 848, 34, 14, { w: 0.6, rough: 0.2, a: 0.7 });
      // king's chamber + five relieving chambers + gabled roof
      P.erase([[326, 778], [376, 778], [376, 826], [326, 826]]);
      P.rect(326, 802, 50, 22, { w: 1.4, rough: 0.3 }); P.hatch([[326, 802], [376, 802], [376, 824], [326, 824]], { ang: 30, gap: 4, a: 0.28, w: 0.4 });
      for (let i = 0; i < 5; i++) P.rect(328, 796 - i * 5.5, 46, 5.5, { w: 0.8, rough: 0.2 });
      P.pl([[326, 770], [351, 758], [376, 770]], { w: 1.1, rough: 0.2 });
      P.rect(338, 812, 24, 8, { w: 0.9, rough: 0.2, a: 0.9 }); 
      // air shafts
      P.dashed(376, 812, 402, 786, [6, 4], { w: 0.8, a: 0.9 }); P.dashed(326, 812, 300, 780, [6, 4], { w: 0.8, a: 0.9 });
      P.dashed(318, 850, 372, 792, [6, 4], { w: 0.7, a: 0.7 });
      // axis, dimensions & angle
      P.dashed(cx, top - 18, cx, base + 30, [22, 5, 3, 5], { w: 0.6, a: 0.5 });
      P.dim(Bl[0], base + 26, Br[0], base + 26, 'BASE 230.3 m', 4, { size: 16 });
      P.dim(Br[0] + 6, top, Br[0] + 6, base, 'H 146.6 m', -28, { size: 16 });
      P.arc(Bl[0], base, 58, 58, -Math.atan2(base - top, hb), 0, { w: 0.9, passes: 1 }); P.text("51 DEG 50'", Bl[0] + 64, base - 14, { size: 13 });
      cap(70, 632, 'SECTION A-A', 'GREAT PYRAMID OF KHUFU');
      P.note('KING\'S CHAMBER', 405, 776, 372, 808, { size: 15 });
      P.note('RELIEVING CHAMBERS', 405, 754, 380, 790, { size: 15 });
      P.note('GRAND GALLERY', 70, 800, 258, 846, { size: 15 });
      P.note('QUEEN\'S CHAMBER', 372, 860, 320, 852, { size: 15 });
      P.note('ENTRANCE', 62, 848, 106, 870, { size: 15 });
      P.note('DESCENDING PASSAGE', 60, 930, 170, 916, { size: 15 });
      P.note('UNFINISHED CHAMBER', 300, 956, 288, 948, { size: 15 });
      P.text('CHAMBERS DRAWN 2.5 x OVERSIZE', 350, 690, { size: 13, a: 0.7 });
    }

    /* ---------- PLAN: square base, four faces to the compass ---------- */
    { const cx = 676, cy = 726, h = 60;
      cap(584, 632, 'PLAN', '');
      P.rect(cx - h, cy - h, h * 2, h * 2, { w: 1.7, rough: 0.4 });
      P.rect(cx - h + 5, cy - h + 5, h * 2 - 10, h * 2 - 10, { w: 0.6, a: 0.6, rough: 0.3, passes: 1 });
      P.line(cx - h, cy - h, cx + h, cy + h, { w: 0.9, rough: 0.3 }); P.line(cx + h, cy - h, cx - h, cy + h, { w: 0.9, rough: 0.3 });
      P.line(cx, cy - h, cx, cy + h, { w: 0.5, a: 0.55, passes: 1 }); P.line(cx - h, cy, cx + h, cy, { w: 0.5, a: 0.55, passes: 1 });
      for (let i = 1; i < 6; i++) { const q = h - i * 10; P.rect(cx - q, cy - q, q * 2, q * 2, { w: 0.4, a: 0.4, rough: 0.2, passes: 1 }); }
      P.wash([[cx - h, cy - h], [cx + h, cy - h], [cx, cy]], '#efcf8c', 0.6, { jit: 0.4 }); P.wash([[cx - h, cy + h], [cx + h, cy + h], [cx, cy]], '#a97a4a', 0.6, { jit: 0.4 }); P.wash([[cx + h, cy - h], [cx + h, cy + h], [cx, cy]], '#b9885a', 0.6, { jit: 0.4 }); P.wash([[cx - h, cy - h], [cx - h, cy + h], [cx, cy]], '#e5c184', 0.55, { jit: 0.4 });
      P.hatch([[cx + h, cy - h], [cx + h, cy + h], [cx, cy]], { ang: 80, gap: 2.8, a: 0.4, w: 0.45 }); P.hatch([[cx - h, cy + h], [cx + h, cy + h], [cx, cy]], { ang: 10, gap: 2.8, a: 0.4, w: 0.45 });
      // north arrow
      P.circle(cx + h + 46, cy - h + 12, 20, { w: 1, passes: 1 }); P.line(cx + h + 46, cy - h + 32, cx + h + 46, cy - h - 10, { w: 1.1, passes: 1, over: 0 }); P.pl([[cx + h + 40, cy - h + 0], [cx + h + 46, cy - h - 12], [cx + h + 52, cy - h + 0]], { w: 1, over: 0 }); P.text('N', cx + h + 46, cy - h - 16, { size: 15, align: 'center', font: S.HAND });
      P.text('N', cx, cy - h - 8, { size: 11, align: 'center', a: 0.6 }); P.text('S', cx, cy + h + 16, { size: 11, align: 'center', a: 0.6 }); P.text('E', cx + h + 8, cy + 4, { size: 11, a: 0.6 }); P.text('W', cx - h - 16, cy + 4, { size: 11, a: 0.6 });
      P.text('FACES TRUE NORTH', 596, 808, { size: 15 }); P.text('TO WITHIN 1/15 DEGREE', 596, 828, { size: 14, a: 0.85 });
      // Giza layout sketch (not to spacing)
      const pts = [[650, 908, 28, 'MEN.'], [712, 878, 58, 'KHAFRE'], [780, 836, 64, 'KHUFU']];
      P.dashed(614, 930, 830, 800, [16, 5, 3, 5], { w: 0.6, a: 0.5 });
      pts.forEach(([x, y, s, l]) => { P.rect(x - s / 2, y - s / 2, s, s, { w: 1.2, rough: 0.3 }); P.line(x - s / 2, y - s / 2, x + s / 2, y + s / 2, { w: 0.5, a: 0.7, passes: 1 }); P.line(x + s / 2, y - s / 2, x - s / 2, y + s / 2, { w: 0.5, a: 0.7, passes: 1 }); P.wash([[x - s / 2, y - s / 2], [x + s / 2, y - s / 2], [x + s / 2, y + s / 2], [x - s / 2, y + s / 2]], '#e5c184', 0.5, { jit: 0.4 }); });
      [[822, 866, 13], [838, 856, 13], [854, 846, 13]].forEach(([x, y, s]) => { P.rect(x - s / 2, y - s / 2, s, s, { w: 0.8, rough: 0.2, passes: 1 }); P.wash([[x - s / 2, y - s / 2], [x + s / 2, y - s / 2], [x + s / 2, y + s / 2], [x - s / 2, y + s / 2]], '#e5c184', 0.5, { jit: 0.2, steps: 3 }); });
      P.text('KHUFU', 756, 796, { size: 13, a: 0.85 }); P.text('KHAFRE', 682, 846, { size: 13, a: 0.85 }); P.text('MENKAURE', 616, 934, { size: 13, a: 0.85 });
      P.text('LAYOUT ON THE PLATEAU', 720, 946, { size: 14 });
    }

    /* ---------- RAMP diagram: how the blocks went up ---------- */
    { const bx0 = 900, bx1 = 1128, by = 900, apx = 1014, apy = 752;
      cap(880, 632, 'BUILDING IT', '');
      P.text('THE STRAIGHT-RAMP THEORY', 880, 654, { size: 15 });
      const tri = [[apx, apy], [bx1, by], [bx0, by]];
      const spanAt = y => { const f = (y - apy) / (by - apy); return [apx - (apx - bx0) * f, apx + (bx1 - apx) * f]; };
      const ramp = [[820, by], [982, by], [982, 803]];
      for (let y = apy + 6; y < by - 2; y += 6) { const [a, b] = spanAt(y); P.line(a + 1, y, b - 1, y, { w: 0.45, a: 0.55, rough: 0.35, passes: 1, over: 0 }); const cnt = Math.round((b - a) / 16); for (let k = 0; k <= cnt; k++) if (P.R() > 0.2) { const x = a + (k + (Math.floor(y / 6) % 2) * 0.5) * (b - a) / cnt; if (x > a + 2 && x < b - 2) P.line(x, y, x, y + 6, { w: 0.35, a: 0.4, passes: 1, over: 0 }); } }
      P.wash(tri, '#e8c78a', 0.5, { jit: 0.5 }); P.poly(tri, { w: 1.7, rough: 0.4 });
      P.line(780, by, 1150, by, { w: 1.6, rough: 0.5 });
      P.erase(ramp); P.poly(ramp, { w: 1.5, rough: 0.4 });
      P.wash(ramp, '#c9a274', 0.55, { jit: 0.5 }); P.hatch(ramp, { ang: -30, gap: 3, a: 0.4, w: 0.45, piece: 30 });
      for (let i = 1; i < 8; i++) P.line(lerp(820, 982, i / 8), by, lerp(820, 982, i / 8), lerp(by, 803, Math.pow(i / 8, 1)) , { w: 0.35, a: 0.4, passes: 1, over: 0 });
      // block on a sledge & workers hauling (stick figures)
      const bx = 900, byy = lerp(by, 803, (bx - 820) / 162) ;
      P.poly([[bx - 14, byy - 2], [bx + 14, byy - 12], [bx + 14, byy - 26], [bx - 14, byy - 16]], { w: 1.1, rough: 0.2 }); P.wash([[bx - 14, byy - 2], [bx + 14, byy - 12], [bx + 14, byy - 26], [bx - 14, byy - 16]], '#d8b170', 0.7, { steps: 3, jit: 0.3 });
      P.line(bx - 16, byy, bx + 16, byy - 10, { w: 1.4, passes: 1, over: 0 });
      const man = (x, y, k) => { P.circle(x, y - 17, 2.4, { w: 0.8, passes: 1 }); P.line(x, y - 14, x + 3, y - 6, { w: 0.9, passes: 1, over: 0 }); P.line(x + 3, y - 6, x - 1, y, { w: 0.9, passes: 1, over: 0 }); P.line(x + 3, y - 6, x + 6, y, { w: 0.9, passes: 1, over: 0 }); P.line(x, y - 13, x - 8, y - 12 - k, { w: 0.8, passes: 1, over: 0 }); };
      [[934, 0], [946, 2], [958, 4], [968, 6]].forEach(([x, k], i) => { const yy = lerp(by, 803, (x - 820) / 162); man(x, yy - 1, k); });
      P.curve([[bx + 14, byy - 14], [925, lerp(by, 803, 0.7) - 22], [934, lerp(by, 803, 0.71) - 14]], { w: 0.7, rough: 0.5, passes: 1 });
      // wet-sand boy
      P.circle(866, by - 44, 2.4, { w: 0.8, passes: 1 }); P.line(866, by - 41, 866, by - 32, { w: 0.9, passes: 1, over: 0 });
      // internal ramp theory (dashed inside)
      P.dashed(920, by - 6, 1088, by - 40, [5, 4], { w: 0.7, a: 0.85 }); P.dashed(1088, by - 40, 940, by - 74, [5, 4], { w: 0.7, a: 0.85 }); P.dashed(940, by - 74, 1076, by - 106, [5, 4], { w: 0.7, a: 0.85 });
      // callouts
      P.note('STRAIGHT RAMP, MUD BRICK', 796, 756, 900, 830, { size: 14 });
      P.note('SLEDGE + WET SAND', 796, 786, 892, 852, { size: 14, align: 'left' });
      P.note('INTERNAL RAMP (THEORY)', 1000, 690, 1030, 790, { size: 14 });
      P.text('20,000 WORKERS  -  ~20 YEARS', 880, 936, { size: 14 });
      P.text('ONE BLOCK EVERY 10 SECONDS', 880, 954, { size: 13, a: 0.8 });
    }
  }
});
