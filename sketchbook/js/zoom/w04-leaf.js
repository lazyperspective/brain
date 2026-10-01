/* WORLD 4 — THE LEAF, UP CLOSE.
   The painted beech leaf, nine times larger, turns out to be real: raised veins with silky hairs, a network of finer
   veins between them, a ladybird polished like lacquer, a dew drop that turns the veins upside down, aphids being
   milked by an ant, rust spots, and a hole where a caterpillar ate through to the paper underneath. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#12240f';
  /* the two that move, drawn by the live layer every frame */
  const ant = (P, k, ax, ay, ang, ph) => { const T = (u, v) => [ax + Math.cos(ang) * u - Math.sin(ang) * v, ay + Math.sin(ang) * u + Math.cos(ang) * v];
    k.fill(L.ell(...T(-6, 6), 40, 12, 20, ang), '#1f4a22', 0.22);
    for (let i = 0; i < 3; i++) [-1, 1].forEach(sd => { const g = Math.sin(TAU * ph + (i % 2 === (sd > 0 ? 0 : 1) ? 0 : Math.PI)) * 7, b = T(-2 + i * 6, sd * 4), kn = T(-10 + i * 14 + g * 0.5, sd * 16), ft = T(-18 + i * 24 + g, sd * (26 - Math.abs(g) * 0.3)); k.ink([b, kn, ft], 1.2, '#1a0f0a'); k.dot(ft[0], ft[1], 1.2, '#1a0f0a'); });
    const gaster = L.ell(...T(-24, 0), 15, 11, 20, ang), thorax = L.ell(...T(0, 0), 11, 5.5, 16, ang), head = L.ell(...T(18, 0), 8, 7, 16, ang); [gaster, thorax, head].forEach((b, i) => { k.fill(b, ['#2a1a14', '#6a2a14', '#2a1a14'][i]); k.lin(b, '#c89070', 0.45, '#2a1a14', 0, ...T(-24 + i * 20, -8), ...T(-24 + i * 20, 6)); k.outline(b, 0.5, '#0a0505'); });
    k.dot(...T(-10, 0), 2.6, '#4a1a0a'); k.fill(L.ell(...T(-28, -4), 4, 1.8, 10, ang), '#ffffff', 0.4); k.dot(...T(21, -3.6), 1.4, '#050505'); k.dot(...T(21, 3.6), 1.4, '#050505'); [-1, 1].forEach(sd => { const w = Math.sin(TAU * ph * 2 + sd) * 3; k.ink([T(22, sd * 3), T(32, sd * 10 + w * 0.4), T(44 + w * 0.5, sd * (6 + w))], 0.9, '#1a0f0a'); }); k.ink([T(26, 1), T(32, 0)], 0.8, '#6a2a14'); }
  const ladybird = (P, k, ph) => { const LF = Z.lib.leaf, R = (a, b) => a, [bx, by] = LF.bug, ang = -0.62 + Math.sin(TAU * ph) * 0.03, s = 1, T = (u, v) => [bx + Math.cos(ang) * u * s - Math.sin(ang) * v * s, by + Math.sin(ang) * u * s + Math.cos(ang) * v * s];
        k.fill(L.ell(...T(-8, 10), 78, 64, 40, ang), '#0f2a12', 0.3); k.fill(L.ell(...T(-12, 16), 70, 54, 40, ang), '#0f2a12', 0.2);
        for (let i = 0; i < 3; i++) [-1, 1].forEach(sd => { const g = Math.sin(TAU * ph + (i % 2 === (sd > 0 ? 0 : 1) ? 0 : Math.PI)) * 3.5, lift = Math.max(0, Math.cos(TAU * ph + (i % 2 === (sd > 0 ? 0 : 1) ? 0 : Math.PI))) * 3, b = T(-20 + i * 26, sd * 36), kn = T(-30 + i * 34 + g * 0.5, sd * (66 + lift)), ft = T(-40 + i * 44 + g, sd * (78 - lift)); k.ink([b, kn], 4, '#0a0a0a'); k.ink([kn, ft], 3, '#0a0a0a'); k.line(ft, T(-44 + i * 46 + g, sd * (84 - lift)), 1.4, '#0a0a0a'); });
        const ely = L.ell(...T(-10, 0), 70, 60, 64, ang); k.fill(ely, '#d8261e'); k.rad(ely, ...T(-40, -30), 120, '#ff6a4a', 0.9, '#8a0a0a', 0.9); k.rad(ely, ...T(-10, 0), 72, '#d8261e', 0, '#5a0505', 0.6);
        [[-10, 0, 13], [-50, -30, 11], [-50, 30, 11], [-10, -40, 10], [-10, 40, 10], [30, -28, 9], [30, 28, 9]].forEach(([u, v, r]) => { const sp = L.ell(...T(u, v), r, r * 0.9, 20, ang); k.fill(sp, '#120808'); k.fill(L.ell(...T(u - r * 0.3, v - r * 0.3), r * 0.35, r * 0.2, 10, ang), '#6a5a5a', 0.6); });
        k.line(T(40, 0), T(-78, 0), 1.2, '#3a0505'); for (let i = 0; i < 70; i++) { const u = lerp(-70, 45, L.hash(i, 1)), v = lerp(-55, 55, L.hash(i, 2)); if (((u + 10) / 70) ** 2 + (v / 60) ** 2 > 0.9) continue; k.dot(...T(u, v), 0.6, '#7a0a0a', 0.5); }
        k.outline(ely, 1.2, '#2a0505'); L.blend(P, 'screen', () => { k.fill(L.ell(...T(-36, -26), 22, 8, 20, ang - 0.5), '#ffffff', 0.55); k.fill(L.ell(...T(-18, -38), 6, 3, 12, ang - 0.4), '#ffffff', 0.7); k.fill(L.ell(...T(-34, 30), 16, 5, 16, ang + 0.6), '#ffd0c0', 0.25); const win = [T(-54, -12), T(-44, -18), T(-40, -8), T(-50, -2)]; k.fill(win, '#ffffff', 0.55); });
        const pro = P.sample([T(34, -40), T(56, -26), T(62, 0), T(56, 26), T(34, 40)], false, 2); k.fill(pro.concat([T(30, 0)]), '#141010'); k.fill(L.ell(...T(46, -24), 9, 7, 14, ang), '#f6f0e4'); k.fill(L.ell(...T(46, 24), 9, 7, 14, ang), '#f6f0e4'); k.fill(L.ell(...T(58, 0), 4, 5, 12, ang), '#f6f0e4', 0.8);
        const hd = L.ell(...T(66, 0), 12, 16, 20, ang); k.fill(hd, '#0e0a0a'); [-1, 1].forEach(sd => { k.fill(L.ell(...T(70, sd * 11), 4, 5, 12, ang), '#2a2a3a'); k.dot(...T(69, sd * 10), 1.2, '#ffffff', 0.7); const w = Math.sin(TAU * ph + sd * 1.3) * 3; k.ink([T(74, sd * 8), T(84, sd * (12 + w * 0.5)), T(88 + w * 0.4, sd * (16 + w))], 1, '#0a0a0a'); k.fill(L.ell(...T(89 + w * 0.4, sd * (17 + w)), 2.8, 2, 8, ang), '#0a0a0a'); }); L.blend(P, 'screen', () => k.fill(L.ell(...T(50, -10), 10, 3, 10, ang - 0.4), '#ffffff', 0.35)); }

  Z.world({
    name: 'The leaf', scale: '5 cm', seed: 8117, ink: K,
    portal: { cx: 960, cy: 650, w: 200, rot: 15, feather: 140 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.3 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], chance = p => P.R() < p;
      const LF = Z.lib.leaf, fp = z => cx.fromParent(z), SC = 1 / Math.hypot(cx.parent.a[0], cx.parent.a[1]);
      const W3 = (s, v) => fp(LF.toW(s, v));
      const inPortal = (x, y, m = 0) => { const q = cx.toChild([x, y]); return q[0] > -m && q[0] < 1600 + m && q[1] > -m && q[1] < 1000 + m; };

      /* ================================ the leaf's colour, continued exactly from the painting ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), LF.base);
      LF.blot.forEach(b => { const c = W3(b.s, b.v), r = b.r * SC; k.rad(L.ell(c[0], c[1], r, r, 64), c[0], c[1], r, b.c, b.a, b.c, 0); });
      { const a = W3(0, 100), b = W3(0, -100); k.lin(L.rect(-40, -40, 1640, 1040), '#ffffff', 0.16, '#1f4a2a', 0.2, a[0], a[1], b[0], b[1]); }
      // cells too small to draw, felt as a grain
      { const g1 = [], g2 = []; for (let i = 0; i < 16000; i++) { const x = R(-20, 1620), y = R(-20, 1020); (L.noise(x / 40, y / 40, 3) > 0.5 ? g1 : g2).push([x, y, R(0.4, 1.1)]); } k.dots(g1, '#d8f0a0', 0.12); k.dots(g2, '#0f3a18', 0.12); }

      /* ================================ the finest veins: a net of little fields ================================ */
      { const pc = cx.fromChild([800, 500]), cells = L.gridVoronoi(-80, -80, 1680, 1080, 74, 0.95, 4401, s => Math.hypot(s[0] - pc[0], s[1] - pc[1]) > 150);
        cells.forEach(c => { if (chance(0.5)) k.fill(c.poly, chance(0.5) ? '#6aa84a' : '#4f8f3e', R(0.06, 0.14)); });
        const net = L.jigsaw(cells, 0.05, 71); net.edges.forEach(e => { if (e.some(([x, y]) => inPortal(x, y, 60))) return; k.ink(e.map(([x, y]) => [x + 1.4, y + 1.6]), 1.6, '#1f4a22', 0.18); k.ink(e, 1.9, LF.vein, 0.42); k.ink(e, 0.5, '#f0f8c8', 0.35); }); }

      /* ================================ the secondary veins and the midrib, from the painting's own numbers ================================ */
      const hair = (p, a, l, al = 0.75) => k.curve([p, [p[0] + Math.cos(a) * l * 0.5, p[1] + Math.sin(a) * l * 0.5 - l * 0.08], [p[0] + Math.cos(a + 0.25) * l, p[1] + Math.sin(a + 0.25) * l - l * 0.15]], 0.7, '#f8fff0', al);
      LF.veins.forEach(v => { const pts = P.sample(v.pts.map(([s, t]) => W3(s, t)), false, 6), sh = P.sample(v.pts.map(([s, t]) => { const q = LF.toW(s, t); return fp([q[0] + 0.9, q[1] + 0.9]); }), false, 6);
        k.ink(sh, 5, '#1f4a22', 0.3); const rib = L.ribbon(pts, 7.4, 5.2); k.fill(rib, LF.vein, 0.9); k.lin(rib, '#f8ffd8', 0.5, LF.vein, 0, ...pts[0], ...pts[pts.length - 1]);
        for (let j = -2; j <= 2; j++) k.ink(pts.map(([x, y], i, A) => { const q = A[Math.min(A.length - 1, i + 1)], o = A[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; return [x - dy / l * j * 2.2, y + dx / l * j * 2.2]; }), 0.4, j ? '#9ab860' : '#f8ffe0', j ? 0.4 : 0.6);
        k.ink(rib.slice(0, pts.length), 0.6, '#3a6a2a', 0.5); k.ink(rib.slice(pts.length), 0.9, '#1f4a22', 0.45);
        for (let i = 2; i < pts.length - 1; i += 2) { const d = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); if (chance(0.7)) hair(pts[i], d + (chance(0.5) ? 1.1 : -1.1) + R(-0.3, 0.3), R(10, 22)); } });
      { const mid = []; for (let i = 0; i <= 60; i++) mid.push(LF.toW(i / 60 * LF.len * 0.99, 0)); const rib = L.ribbon(mid, 2.4, 0.4).map(fp), n = mid.length, top = rib.slice(0, n), bot = rib.slice(n).reverse(), cen = mid.map(fp);
        k.ink(mid.map(p => fp([p[0] + 1.2, p[1] + 1.2])), 10, '#1f4a22', 0.3); k.fill(rib, LF.mid, 0.95); k.lin(rib, '#ffffff', 0.35, LF.mid, 0, ...fp(LF.toW(170, -3)), ...fp(LF.toW(170, 3)));
        for (let j = 1; j < 7; j++) { const f = j / 7; k.ink(top.map((p, i) => [lerp(p[0], bot[i][0], f), lerp(p[1], bot[i][1], f)]), 0.5, j % 2 ? '#a8c070' : '#fbffe8', 0.5); }
        k.ink(top, 0.8, '#4a7a32', 0.6); k.ink(bot, 1.2, '#1f4a22', 0.5); for (let i = 1; i < cen.length - 1; i++) if (chance(0.8)) hair(chance(0.5) ? top[i] : bot[i], R(0, TAU), R(12, 26), 0.7); }

      /* ================================ the small nations of the leaf ================================ */
      // rust: orange pustules in yellow haloes
      [[240, 240, 10], [300, 830, 7], [1450, 170, 12], [140, 560, 6], [700, 900, 8], [1540, 880, 9]].forEach(([x, y, r]) => { k.rad(L.ell(x, y, r * 2.8, r * 2.6, 30), x, y, r * 2.8, '#e8e060', 0.55, '#e8e060', 0); const sp = L.blob(x, y, r, 12, 0.3, P.R); k.fill(sp, '#b8601a'); k.rad(sp, x - r * 0.3, y - r * 0.3, r * 1.2, '#f0a040', 0.8, '#7a3a0a', 0.6); for (let i = 0; i < r * 3; i++) k.dot(x + R(-r, r) * 0.8, y + R(-r, r) * 0.8, R(0.6, 1.4), pick(['#f0b050', '#8a4a10', '#e07a20']), 0.9); k.outline(sp, 0.6, '#5a2a0a', 0.6); });
      // a caterpillar's bite, right through to the paper this leaf was painted on
      { const bc = LF.bite, hole = L.blob(bc[0], bc[1], 42, 22, 0.28, P.R, 0.62), rim = L.blob(bc[0], bc[1], 50, 22, 0.24, P.R, 0.66); k.fill(rim, '#c8b040'); k.rad(rim, bc[0], bc[1], 52, '#8a6a20', 0.8, '#c8b040', 0); k.fill(hole, '#f3ead6');
        const hp = []; for (let i = 0; i < 400; i++) { const a = R(0, TAU), r = Math.sqrt(P.R()) * 40; hp.push([bc[0] + Math.cos(a) * r, bc[1] + Math.sin(a) * r * 0.6, R(0.3, 0.8)]); } k.dots(hp, '#8a7a5a', 0.14);
        [[[bc[0] - 40, bc[1] + 4], [bc[0] + 38, bc[1] - 10]], [[bc[0] - 30, bc[1] + 14], [bc[0] + 20, bc[1] + 8]]].forEach(([a, b]) => { const cs = L.clipSeg(a, b, bc, 34); if (cs) k.line(cs[0], cs[1], 1.4, '#2a211a', 0.8); }); k.text('FAG', bc[0] - 16, bc[1] + 2, 12, '#4a3a2a', { a: 0.7 });
        k.outline(hole, 1.2, '#5a4a10', 0.8); for (let i = 0; i < hole.length; i += 2) k.line(hole[i], [hole[i][0] + R(-3, 3), hole[i][1] + R(-3, 3)], 0.5, '#7a5a10', 0.7); k.fill(hole.map(([x, y]) => [x + 4, y + 5]), '#2a3a14', 0.12); }
      // aphids along the midrib, and the ant that keeps them
      const aphid = (x, y, s, ang, wing = false) => { const T = (u, v) => [x + Math.cos(ang) * u * s - Math.sin(ang) * v * s, y + Math.sin(ang) * u * s + Math.cos(ang) * v * s];
        k.fill(L.ell(...T(-1, 3), 13 * s, 8 * s, 18, ang), '#1f4a22', 0.25);
        for (let i = 0; i < 3; i++) [-1, 1].forEach(sd => { const b = T(-3 + i * 5, sd * 5), kn = T(-6 + i * 7, sd * 11), ft = T(-10 + i * 9, sd * 15); k.ink([b, kn, ft], 0.55 * s + 0.2, '#3a5a1a', 0.85); });
        const body = P.sample([T(-12, 0), T(-8, -7), T(2, -7.5), T(8, -4), T(10, 0), T(8, 4), T(2, 7.5), T(-8, 7)], true, 1.5); k.fill(body, '#9ad060'); k.lin(body, '#e8ffb8', 0.7, '#5a9a30', 0.4, ...T(0, -8), ...T(2, 8)); k.outline(body, 0.5, '#3a6a1a', 0.8);
        [-1, 1].forEach(sd => k.line(T(-9, sd * 3), T(-15, sd * 5), 1 * s + 0.3, '#4a7a2a')); k.fill(L.ell(...T(10.5, 0), 3.6 * s, 3.2 * s, 10), '#8ac050'); [-1, 1].forEach(sd => { k.dot(...T(12, sd * 2.4), 1.1 * s, '#c0241a'); });
        for (let i = 0; i < 4; i++) k.line(T(-6 + i * 3.4, -5), T(-6 + i * 3.4, 5), 0.25, '#5a8a30', 0.4);
        if (wing) [-1, 1].forEach(sd => { const wgs = [T(4, sd * 2), T(-10, sd * 16), T(-26, sd * 12), T(-14, sd * 4)]; k.fill(wgs, '#ffffff', 0.25); k.ink(wgs.concat([wgs[0]]), 0.35, '#5a7a5a', 0.7); k.line(T(0, sd * 4), T(-20, sd * 11), 0.3, '#5a7a5a', 0.6); });
        k.fill(L.ell(...T(2, -3), 3 * s, 1.4 * s, 8, ang), '#ffffff', 0.5); };
      [[640, 488, 1.2, 0.2], [680, 512, 1.5, -0.1], [722, 486, 1.0, 0.4], [758, 508, 1.8, 0.1, true], [800, 492, 0.8, -0.3], [600, 514, 0.7, 0.6], [830, 512, 1.1, 0.2]].forEach(([x, y, s, a, w]) => aphid(x, y, s, a, w));
      // the ladybird, lacquered, walking towards the edge of the leaf
      // (the ladybird and the ant move: they are drawn by the live layer)
      // a dew drop: a lens with the veins turned upside down inside it, and the studio window caught in its shine
      { const dc = LF.dew, dr = 58, drop = L.ell(dc[0], dc[1], dr, dr * 0.94, 60);
        k.fill(L.ell(dc[0] + 16, dc[1] + 20, dr, dr * 0.9, 50), '#0f3a18', 0.3); k.rad(L.ell(dc[0] + 26, dc[1] + 30, dr * 0.5, dr * 0.4, 30), dc[0] + 26, dc[1] + 30, dr * 0.5, '#f8ffb0', 0.8, '#f8ffb0', 0);
        k.fill(drop, '#8ad060'); k.rad(drop, dc[0] + 10, dc[1] + 14, dr, '#c8f090', 0.8, '#4a8a3a', 0.6);
        const M = p => [dc[0] - (p[0] - dc[0]) * 1.9, dc[1] - (p[1] - dc[1]) * 1.9];
        LF.veins.forEach(v => { const pts = v.pts.map(([s, t]) => M(W3(s, t))); for (let i = 0; i + 1 < pts.length; i++) { const cs = L.clipSeg(pts[i], pts[i + 1], dc, dr * 0.9); if (cs) k.line(cs[0], cs[1], 16, LF.vein, 0.75); } });
        { const mid = []; for (let i = 0; i <= 40; i++) mid.push(M(W3(i / 40 * LF.len, 0))); for (let i = 0; i + 1 < mid.length; i++) { const cs = L.clipSeg(mid[i], mid[i + 1], dc, dr * 0.9); if (cs) k.line(cs[0], cs[1], 30, LF.mid, 0.8); } }
        k.rad(drop, dc[0], dc[1], dr, '#ffffff', 0, '#1f5a2a', 0.55); k.outline(drop, 2.4, '#1f4a22', 0.6); k.outline(L.ell(dc[0], dc[1], dr - 4, dr * 0.94 - 4, 60), 1, '#f0ffe0', 0.35);
        L.blend(P, 'screen', () => { const wx = dc[0] - 24, wy = dc[1] - 30, win = [[wx - 12, wy - 9], [wx + 10, wy - 12], [wx + 12, wy + 8], [wx - 10, wy + 11]]; k.fill(win, '#ffffff', 0.85); k.fill(L.ell(dc[0] + 26, dc[1] + 22, 8, 4, 12, -0.6), '#ffffff', 0.5); k.fill(L.ell(dc[0] - 30, dc[1] + 18, 4, 10, 12, 0.4), '#ffffff', 0.25); }); k.line([dc[0] - 36, dc[1] - 30], [dc[0] - 12, dc[1] - 33], 1.2, '#4a6a3a', 0.8); k.line([dc[0] - 24, dc[1] - 42], [dc[0] - 23, dc[1] - 20], 1.2, '#4a6a3a', 0.8); }
      // a red velvet mite, pollen dust near where we are going
      { const mx = 1068, my = 604; k.fill(L.ell(mx + 2, my + 3, 7, 5, 12), '#0f2a12', 0.25); for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => k.ink([[mx - 3 + i * 2.4, my + sd * 3], [mx - 6 + i * 4, my + sd * 8], [mx - 8 + i * 5, my + sd * 10]], 0.5, '#8a1a0a')); const b = L.ell(mx, my, 6.4, 4.6, 16); k.fill(b, '#d0281a'); for (let i = 0; i < 20; i++) k.dot(mx + R(-5, 5), my + R(-3.4, 3.4), 0.5, '#ff8a6a', 0.8); k.outline(b, 0.4, '#5a0a05'); }
      [[890, 700, 4.2], [912, 716, 3.6], [1004, 760, 4.6], [860, 760, 3.2], [1040, 690, 3.8]].forEach(([x, y, r]) => { k.fill(L.ell(x + 1.4, y + 1.8, r, r, 16), '#0f2a12', 0.25); k.fill(L.ell(x, y, r, r, 16), '#f0c030'); k.rad(L.ell(x, y, r, r, 16), x - r * 0.3, y - r * 0.3, r * 1.2, '#fff0a0', 0.9, '#c89010', 0.8); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; k.line([x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1)], 0.4, '#8a6010'); } });

      /* ================================ the next world shows through: a jigsaw of cells around the way in ================================ */
      if (Z.lib.surface) { const S = Z.lib.surface, pc = cx.fromChild([800, 500]); S.walls.forEach(e => { const pts = e.map(p => cx.fromChild(p)), m = pts[Math.floor(pts.length / 2)], d = Math.hypot(m[0] - pc[0], m[1] - pc[1]); if (d > 270) return; const a = Math.max(0, Math.min(1, (270 - d) / 170)) ** 1.5; k.ink(pts, 0.5, '#12260e', 0.4 * a); k.ink(pts.map(([x, y]) => [x - 0.4, y - 0.45]), 0.3, '#eaffd0', 0.35 * a); });
        S.stomata.forEach(st => { const c = cx.fromChild(st.c), d = Math.hypot(c[0] - pc[0], c[1] - pc[1]); if (d > 270) return; const a = Math.max(0, Math.min(1, (270 - d) / 170)) ** 1.5, sc2 = Math.hypot(cx.portal.a[0], cx.portal.a[1]), ang = st.ang + cx.portal.th; k.fill(L.ell(c[0], c[1], st.rx * sc2, st.ry * sc2, 16, ang), '#3a7a3a', 0.5 * a); k.fill(L.ell(c[0], c[1], st.rx * sc2 * 0.8, st.ry * sc2 * 0.18, 12, ang), '#0f2a12', 0.6 * a); }); }
    }    ,
    /* ================================ the leaf, moving ================================ */
    live: [(Q, t, cx) => {
      const k = L.kit(Q, K, { rough: 0.15 }), H = L.hash, cyc = (per, ph = 0) => (L.cyc(t, per) + ph) % 1, osc = (per, ph = 0) => L.osc(t, per, ph);
      // light through the canopy above: soft flecks of sun and leaf-shadow sliding over the blade
      for (let i = 0; i < 16; i++) { const u = cyc(57 / 2, H(i, 1)), x = lerp(-300, 1900, u) + Math.sin(u * 9 + i) * 40, y = H(i, 2) * 1000 + osc(9, H(i, 3)) * 30, r = 60 + H(i, 4) * 120, sun = i % 3 !== 0;
        if (Math.hypot(x - 960, y - 650) < 170) continue; const b = L.blob(x, y, r, 14, 0.25, () => H(i, 5 + Math.floor(u * 4)), 0.7);
        if (sun) L.blend(Q, 'lighter', () => k.rad(b, x, y, r, '#f4ffb0', 0.13, '#f4ffb0', 0)); else L.blend(Q, 'multiply', () => k.rad(b, x, y, r, '#2a4a1a', 0.22, '#2a4a1a', 0)); }
      // the ladybird, at rest, testing the leaf with its feet and antennae
      ladybird(Q, k, cyc(3.1));
      // the ant, doing the rounds of its aphids
      { const u = cyc(57 / 4), th = u * TAU, x = 735 + Math.cos(th) * 175, y = 532 + Math.sin(th) * 22, ang = th + Math.PI / 2 + Math.atan2(22 * Math.cos(th), -175 * Math.sin(th)) - (th + Math.PI / 2); ant(Q, k, x, y, ang, cyc(0.42)); }
      // the dew drop's sparkle, the light turning in it
      { const dx = 430, dy = 610, a = osc(4.3) * 0.5; L.blend(Q, 'lighter', () => { k.fill(L.ell(dx - 22 + a * 8, dy - 26, 9, 4, 14, -0.5), '#ffffff', 0.25 + 0.2 * osc(2.1)); k.glow(dx + 18 - a * 6, dy - 30 + a * 4, 8, '#ffffff', 0.35 + 0.3 * Math.max(0, osc(3.3))); }); }
      // rust pustules letting go of their spores
      [[240, 238], [1450, 168], [140, 560], [300, 830], [700, 900], [1540, 880]].forEach(([x0, y0], j) => { for (let i = 0; i < 7; i++) { const u = cyc(3.6, i / 7 + H(j, 7)), a = H(i * 13 + j, 8) * TAU, d = u * 40; k.dot(x0 + Math.cos(a) * d + u * 14, y0 + Math.sin(a) * d - u * 18, 1.4 - u, '#e88a2a', 0.8 * (1 - u)); } });
      // the aphids' antennae and the winged one fanning its wings
      { const L2 = [[640, 488, 1.2, 0.2], [680, 512, 1.5, -0.1], [722, 486, 1.0, 0.4], [758, 508, 1.8, 0.1], [800, 492, 0.8, -0.3], [600, 514, 0.7, 0.6], [830, 512, 1.1, 0.2]];
        L2.forEach(([x, y, s, ang], i) => { const T = (u, v) => [x + Math.cos(ang) * u * s - Math.sin(ang) * v * s, y + Math.sin(ang) * u * s + Math.cos(ang) * v * s]; [-1, 1].forEach(sd => { const w = osc(1.3 + H(i, 9), H(i, 10) + sd * 0.2) * 3; k.curve([T(13, sd * 1.4), T(20, sd * (6 + w * 0.5)), T(28 + w * 0.3, sd * (6 + w))], 0.45, '#3a5a1a', 0.9); }); }); }
    }]
  });
})();