/* WORLD 6 — A STOMA.
   One of the leaf's mouths, eight times closer: two guard cells swollen with water, packed with chloroplasts, their
   inner walls thickened into lips around the pore; cellulose fibres fanning through them; through the pore, a
   glimpse down into the dark wet rooms inside the leaf. Water vapour leaves, a bacterium swims in. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#0e2412';

  /* the guard cells and their chloroplasts, shared with the surface above */
  const ST = Z.lib.stoma = (() => {
    const C = [800, 500], RX = 544, RY = 400, PORE = 0.15, rr = L.rng(777), chloros = [];
    const at = (t, sd, f) => { const ro = [C[0] - Math.cos(t) * RX, C[1] + sd * Math.sin(t) * RY], ri = [C[0] - Math.cos(t) * RX * 0.8, C[1] + sd * Math.sin(t) * RY * PORE]; return [lerp(ri[0], ro[0], f), lerp(ri[1], ro[1], f)]; };
    const width = t => Math.hypot(at(t, 1, 1)[0] - at(t, 1, 0)[0], at(t, 1, 1)[1] - at(t, 1, 0)[1]);
    [-1, 1].forEach(sd => [[0.3, 5, 0.2, 0.8], [0.72, 7, 0.14, 0.86]].forEach(([f, n, t0, t1], row) => { for (let j = 0; j < n; j++) { const t = Math.PI * lerp(t0, t1, (j + 0.5) / n + (rr() - 0.5) * 0.03), p = at(t, sd, f), q = at(t + 0.01, sd, f), a = Math.atan2(q[1] - p[1], q[0] - p[0]), w = width(t), sc = Math.min(1, w / 300); chloros.push({ c: p, a, rx: (58 + rr() * 8) * sc, ry: (34 + rr() * 5) * sc, sd, row, j, n }); } }));
    const pc = chloros.find(c => c.sd === 1 && c.row === 1 && c.j === 3); pc.portal = true; pc.c = [800, 500 + RY * lerp(PORE, 1, 0.7)]; pc.a = 0; pc.rx = 72; pc.ry = 42;
    return { C, RX, RY, PORE, at, chloros, pc };
  })();

  Z.world({
    name: 'A stoma', scale: '40 µm', seed: 9811, ink: K,
    portal: { cx: ST.pc.c[0], cy: ST.pc.c[1], w: 1600 / 9, rot: 0, feather: 120 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.25 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], chance = p => P.R() < p;
      const S = Z.lib.surface, fp = z => cx.fromParent(z), SC = 1 / Math.hypot(cx.parent.a[0], cx.parent.a[1]), inView = (poly, m = 80) => poly.some(([x, y]) => x > -m && x < 1600 + m && y > -m && y < 1000 + m);
      const { C, RX, RY, PORE } = ST;
      const cyto = (poly, n, cols) => { k.stip(poly, n, cols[0], 0.35, 1.6); k.stip(poly, Math.round(n * 0.6), cols[1], 0.3, 1.2); };
      const organelles = (poly, [x0, y0, x1, y1], o = {}) => { for (let i = 0; i < (o.mito ?? 3); i++) { const x = R(x0, x1), y = R(y0, y1); if (!L.pip(poly, x, y)) continue; const a = R(0, TAU), m = L.ell(x, y, 22, 10, 18, a); k.fill(m, '#c8a868', 0.9); k.outline(m, 0.9, '#6a5020', 0.9); for (let q = -2; q <= 2; q++) { const p = [x + Math.cos(a) * q * 7, y + Math.sin(a) * q * 7]; k.line([p[0] - Math.sin(a) * 6, p[1] + Math.cos(a) * 6], [p[0] + Math.sin(a) * 6, p[1] - Math.cos(a) * 6], 0.7, '#8a6a30', 0.8); } }
        for (let i = 0; i < (o.er ?? 4); i++) { let x = R(x0, x1), y = R(y0, y1), a = R(0, TAU); const pts = []; for (let q = 0; q < 14; q++) { if (L.pip(poly, x, y)) pts.push([x, y]); a += R(-0.5, 0.5); x += Math.cos(a) * 9; y += Math.sin(a) * 9; } if (pts.length > 3) { k.ink(pts, 2.4, '#9ab080', 0.45); k.ink(pts, 0.7, '#e8f4d0', 0.5); } }
        for (let i = 0; i < (o.ves ?? 6); i++) { const x = R(x0, x1), y = R(y0, y1); if (!L.pip(poly, x, y)) continue; const r = R(4, 11); k.fill(L.ell(x, y, r, r, 12), '#e8f0d0', 0.6); k.outline(L.ell(x, y, r, r, 12), 0.6, '#6a8a5a', 0.7); } };
      const chloroplast = (c, a, rx, ry, o = {}) => { const e = L.ell(c[0], c[1], rx, ry, 40, a), T2 = (u, v) => [c[0] + Math.cos(a) * u - Math.sin(a) * v, c[1] + Math.sin(a) * u + Math.cos(a) * v]; k.fill(e.map(([x, y]) => [x + 5, y + 7]), '#061004', 0.25); k.fill(e, '#7ab85a'); k.rad(e, ...T2(-rx * 0.3, -ry * 0.4), rx * 1.3, '#d8f8b0', 0.5, '#2f6a28', 0.45);
        for (let q = -2; q <= 2; q++) k.ink([T2(-rx * 0.85, q * ry * 0.3 + R(-2, 2)), T2(0, q * ry * 0.32), T2(rx * 0.85, q * ry * 0.3 + R(-2, 2))], 0.7, '#2f7a2a', 0.5);
        const ng = Math.max(4, Math.round(rx / 11)); for (let g = 0; g < ng; g++) { const u = lerp(-0.7, 0.7, (g + 0.5) / ng) * rx + R(-2, 2), vlim = ry * Math.sqrt(Math.max(0, 1 - (u / rx) ** 2)) * 0.8, gv = R(-0.3, 0.3) * vlim, gh = Math.min(vlim * 0.9, R(0.4, 0.75) * ry), gw = rx * 0.12; for (let d = 0; d < 6; d++) { const v = gv - gh / 2 + d * gh / 5; const disc = [T2(u - gw, v - 1.2), T2(u + gw, v - 1.2), T2(u + gw, v + 1.2), T2(u - gw, v + 1.2)]; k.fill(disc, '#1f6a22', 0.85); } }
        k.fill(L.ell(...T2(rx * 0.35, ry * 0.2), rx * 0.14, ry * 0.2, 14, a), '#f6f4e0', 0.85); k.outline(L.ell(...T2(rx * 0.35, ry * 0.2), rx * 0.14, ry * 0.2, 14, a), 0.5, '#9a9a70', 0.7); for (let q = 0; q < 3; q++) k.dot(...T2(R(-0.6, 0.6) * rx, R(-0.5, 0.5) * ry), ry * 0.07, '#2a3a10', 0.8);
        k.outline(e, 1.6, '#0c3010', 0.9); k.outline(L.ell(c[0], c[1], rx - 3, ry - 3, 40, a), 0.7, '#e8ffd0', 0.55); };

      /* ================================ the neighbours: pavement cells, seen into ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#1d3a16');
      S.cells.forEach((c, i) => { const poly = c.poly2.map(fp); if (!inView(poly)) return; const [x, y] = fp(L.centroid(c.poly));
        k.fill(poly, c.seed.portal ? '#4f8f3c' : L.mix('#5a9842', '#78b050', c.r)); k.rad(poly, x - 34 * SC, y - 38 * SC, 128 * SC, '#e4ffb8', 0.5, '#1c4212', 0.42);
        if (!c.seed.portal) { const b = L.bbox(poly); cyto(poly, 700, ['#2a5a1a', '#e8ffd0']); organelles(poly, b, { mito: 4, er: 5, ves: 6 }); for (let q = 0; q < 3; q++) { const x2 = R(b[0], b[2]), y2 = R(b[1], b[3]); if (L.pip(poly, x2, y2)) chloroplast([x2, y2], R(0, TAU), R(46, 60), R(26, 32)); } } });
      S.walls.forEach(e => { const pts = e.map(fp); if (!inView(pts, 40)) return; k.ink(pts.map(([x, y]) => [x + 2 * SC * 0.6, y + 2.4 * SC * 0.6]), 2.4 * SC * 0.6, '#061004', 0.4); k.ink(pts, 3 * SC * 0.8, '#12260e', 0.85); k.ink(pts, 3, '#c8d8a0', 0.5); k.ink(pts.map(([x, y]) => [x - 2.2 * SC * 0.6, y - 2.4 * SC * 0.6]), 1.1 * SC * 0.6, '#eaffd0', 0.3); });

      /* ================================ the stoma ================================ */
      const T = (u, v) => [C[0] + u, C[1] + v];
      k.fill(L.ell(C[0], C[1], RX * 1.2, RY * 1.3, 72), '#5f9e66', 0.45);
      // down through the pore: the dark wet air space, mesophyll cells dim below
      const pore = L.ell(C[0], C[1], RX * 0.8, RY * PORE, 60);
      [-1, 1].forEach(sd => { const pts = []; for (let i = 0; i <= 48; i++) { const t = Math.PI * i / 48; pts.push(T(-Math.cos(t) * RX, sd * Math.sin(t) * RY)); } for (let i = 48; i >= 0; i--) { const t = Math.PI * i / 48; pts.push(T(-Math.cos(t) * RX * 0.8, sd * Math.sin(t) * RY * PORE)); }
        k.fill(pts.map(([x, y]) => [x + 16, y + 20]), '#061004', 0.3); k.fill(pts, '#6aa860'); k.rad(pts, ...T(-RX * 0.25, sd * RY * 0.55 - RY * 0.25), RX * 1.1, '#e0f8c0', 0.55, '#1f4a26', 0.4);
        const crest = []; for (let i = 4; i <= 44; i++) { const t = Math.PI * i / 48; crest.push(ST.at(t, sd, 0.62 + (sd < 0 ? 0.1 : -0.1))); } k.ink(crest, 34, '#f4ffe0', 0.12); k.ink(crest, 12, '#ffffff', 0.12);
        // cellulose microfibrils fanning out from the pore
        for (let q = 1; q < 40; q++) { const t = Math.PI * q / 40, a = T(-Math.cos(t) * RX * 0.8, sd * Math.sin(t) * RY * PORE), b = T(-Math.cos(t) * RX * 0.99, sd * Math.sin(t) * RY * 0.97); k.line(a, b, 0.8, '#e8ffd8', 0.22); }
        cyto(pts, 900, ['#1f4a18', '#f0ffe0']);
        // the thick inner wall, the lip over the pore
        const lip = []; for (let i = 0; i <= 48; i++) { const t = Math.PI * i / 48; lip.push(T(-Math.cos(t) * RX * 0.8, sd * Math.sin(t) * RY * PORE)); } for (let i = 48; i >= 0; i--) { const t = Math.PI * i / 48; lip.push(T(-Math.cos(t) * RX * 0.84, sd * Math.sin(t) * RY * (PORE + 0.12))); }
        k.fill(lip, '#d8ecb8', 0.6); k.lin(lip, '#ffffff', 0.5, '#9ac080', 0.3, ...T(0, sd * RY * PORE), ...T(0, sd * RY * (PORE + 0.12)));
        // a nucleus in each guard cell
        const nt = sd < 0 ? 0.62 * Math.PI : 0.3 * Math.PI, nc = ST.at(nt, sd, 0.55), nu = L.ell(nc[0], nc[1], 78, 50, 36, Math.atan2(sd, 1) * 0.4); k.fill(nu, '#7a90b8'); k.rad(nu, nc[0] - 20, nc[1] - 16, 90, '#d8e0f8', 0.6, '#3a4a78', 0.5); k.stip(nu, 160, '#2a3a68', 0.45, 1.3); k.fill(L.ell(nc[0] + 10, nc[1] - 4, 20, 16, 16), '#3a3a78'); k.outline(nu, 1.6, '#2a3a60'); for (let q = 0; q < 10; q++) { const a = q * TAU / 10; k.dot(nc[0] + Math.cos(a) * 76, nc[1] + Math.sin(a) * 48, 1.8, '#e8f0ff', 0.7); }
        organelles(pts, L.bbox(pts), { mito: 5, er: 5, ves: 8 });
        k.outline(pts, 2.4, '#0c1e12', 0.9); });
      // chloroplasts: fifteen in each guard cell; the middle one below is the next world
      ST.chloros.forEach(ch => { if (!ch.portal) chloroplast(ch.c, ch.a, ch.rx, ch.ry); });
      { const pc = ST.pc; k.fill(L.ell(pc.c[0], pc.c[1], pc.rx * 1.25, pc.ry * 1.35, 30), '#3a6a2a', 0.45); chloroplast(pc.c, pc.a, pc.rx, pc.ry); }
      // the pore itself
      k.fill(pore, '#030805'); k.rad(pore, C[0], C[1], RX * 0.8, '#1f3a22', 0.9, '#030805', 0);
      for (let i = 0; i < 9; i++) { const u = lerp(-0.62, 0.62, i / 8) * RX, e = L.ell(C[0] + u + R(-10, 10), C[1] + R(-8, 8), R(22, 36), R(9, 13), 16); k.fill(e, '#2a5a2a', 0.5); k.outline(e, 0.8, '#4a8a4a', 0.4); }
      [-1, 1].forEach(sd => { const edge = []; for (let i = 0; i <= 48; i++) { const t = Math.PI * i / 48; edge.push(T(-Math.cos(t) * RX * 0.8, sd * Math.sin(t) * RY * PORE)); } k.ink(edge, 2, '#f4ffe8', 0.7); k.ink(edge.map(([x, y]) => [x, y + sd * 3]), 1, '#0c1e12', 0.7); });
      // breath: water vapour leaving the pore, lit from the left
      for (let i = 0; i < 7; i++) { const x0 = C[0] + lerp(-300, 300, i / 6) + R(-20, 20), pts = []; for (let q = 0; q <= 16; q++) { const t = q / 16; pts.push([x0 + Math.sin(t * 5 + i) * 26 + t * 60, C[1] - t * 260 - 20]); } k.ink(pts, R(6, 14), '#ffffff', 0.08); k.ink(pts, 1.4, '#ffffff', 0.18); }
      // (the bacterium swims: it is drawn by the live layer)
      // wax on the cuticle: tiny platelets everywhere
      { const w = []; for (let i = 0; i < 2600; i++) w.push([R(-20, 1620), R(-20, 1020), R(0.6, 1.6)]); k.dots(w, '#f4ffe8', 0.25); }
      L.blend(P, 'screen', () => k.rad(L.rect(-40, -40, 1640, 1040), 200, 120, 900, '#fff8d8', 0.08, '#fff8d8', 0));
    }
    ,
    /* ================================ the stoma, alive ================================ */
    live: [(Q, t) => {
      const k = L.kit(Q, K, { rough: 0.15 }), H = L.hash, cyc = (per, ph = 0) => (L.cyc(t, per) + ph) % 1, osc = (per, ph = 0) => L.osc(t, per, ph), { C, RX, RY, PORE } = ST, PCc = ST.pc.c;
      // cytoplasm streaming round each guard cell: a slow river of granules
      L.blend(Q, 'lighter', () => { for (let i = 0; i < 260; i++) { const sd = i % 2 ? 1 : -1, f = lerp(0.2, 0.95, H(i, 1)), u = cyc(16 + H(i, 2) * 8, H(i, 3)), th = Math.PI * (0.06 + 0.88 * u), p = ST.at(sd > 0 ? th : Math.PI - th, sd, f); if (Math.hypot(p[0] - PCc[0], p[1] - PCc[1]) < 120) continue; k.dot(p[0] + Math.sin(t * 3 + i) * 1.5, p[1] + Math.cos(t * 2.6 + i) * 1.5, 1 + H(i, 4) * 1.6, i % 5 ? '#e8ffd0' : '#ffe8b0', 0.35 + 0.3 * H(i, 5)); } });
      // breath: water vapour rising out of the pore in slow curls
      for (let i = 0; i < 14; i++) { const u = cyc(5 + H(i, 6) * 2, H(i, 7)), x0 = C[0] + lerp(-320, 320, H(i, 8)), x = x0 + Math.sin(u * 5 + i) * 26 + u * 60, y = C[1] - 20 - u * 300, r = 10 + u * 34, al = Math.min(1, u * 6) * (1 - u); L.blend(Q, 'lighter', () => k.rad(L.blob(x, y, r, 12, 0.25, () => H(i, 9), 0.8), x, y, r, '#ffffff', 0.12 * al, '#ffffff', 0)); }
      // a bacterium swimming in circles over the guard cell, flagella whipping behind it
      { const th = TAU * cyc(57 / 3), bx = 1160 + Math.cos(th) * 180, by = 300 + Math.sin(th) * 110, a = Math.atan2(Math.cos(th) * 110, -Math.sin(th) * 180), rod = [[bx - Math.cos(a) * 34, by - Math.sin(a) * 34], [bx + Math.cos(a) * 34, by + Math.sin(a) * 34]];
        k.line([rod[0][0] + 10, rod[0][1] + 14], [rod[1][0] + 10, rod[1][1] + 14], 24, '#061004', 0.25); k.line(rod[0], rod[1], 24, '#5a2a78'); k.line(rod[0], rod[1], 20, '#a458d0'); k.line([rod[0][0] - 3, rod[0][1] - 4], [rod[1][0] - 3, rod[1][1] - 4], 5, '#f0d0ff', 0.6);
        for (let f = 0; f < 4; f++) { const pts = []; for (let q = 0; q <= 30; q++) { const tt = q / 30, d = 34 + tt * 150, w = Math.sin(tt * 12 + f - t * 18) * 12 * (0.4 + tt); pts.push([bx - Math.cos(a) * d + Math.sin(a) * w + (f - 1.5) * 5 * Math.sin(a), by - Math.sin(a) * d - Math.cos(a) * w - (f - 1.5) * 5 * Math.cos(a)]); } k.ink(pts, 1.2, '#7a3aa0', 0.8); } }
      // the pore's lips catch the light as the cells swell and ease
      { const sw = osc(9); L.blend(Q, 'lighter', () => { const lip = []; for (let i = 0; i <= 40; i++) { const tt = Math.PI * (0.1 + 0.8 * i / 40); lip.push([C[0] - Math.cos(tt) * RX * 0.8, C[1] - Math.sin(tt) * RY * PORE - 6]); } k.ink(lip, 3, '#ffffff', 0.12 + 0.08 * sw); }); }
    }]
  });
})();
