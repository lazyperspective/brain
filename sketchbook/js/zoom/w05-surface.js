/* WORLD 5 — THE SURFACE OF THE LEAF.
   Closer than any eye: pavement cells locked together like a jigsaw, each one a waxed pillow; stomata breathing
   between them; a hair lying across the landscape; a pollen grain as big as a planet; a fungal thread that has found
   a stoma and is swelling to break in; a colony of bacteria in a groove; and a tardigrade, out for a walk. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#10261a';

  /* the mosaic, in this world's coordinates; the leaf above draws it faintly, the stoma below draws it huge */
  const SURF = Z.lib.surface = (() => {
    const PC = [800, 520], PROT = -20 * Math.PI / 180, rr = L.rng(611);
    const cells = L.gridVoronoi(-2200, -2400, 3800, 3400, 150, 0.95, 5151, null, seeds => { let best = null, bd = 1e9; seeds.forEach(s => { const d = Math.hypot(s[0] - PC[0], s[1] - PC[1]); if (d < bd) { bd = d; best = s; } }); best[0] = PC[0]; best[1] = PC[1]; best[2] = 0.5; best.portal = true; });
    const J = L.jigsaw(cells, 0.13, 919), stomata = [];
    cells.forEach((c, i) => { c.poly2 = J.polys[i]; const [x, y] = c.seed; if (c.seed.portal) stomata.push({ c: PC.slice(), ang: PROT, rx: 68, ry: 50, portal: true, cell: i }); else if (c.r < 0.1 && Math.hypot(x - PC[0], y - PC[1]) > 260) stomata.push({ c: [x, y], ang: rr() * Math.PI, rx: 56 + rr() * 14, ry: 41 + rr() * 9, cell: i }); });
    return { PC, PROT, cells, walls: J.edges, stomata };
  })();

  /* a spider mite, legs like a harvestman's, picking its way on the spot */
  const mite = (P, k, ph) => { const R = (a, b) => (a + b) / 2, shadowOf = (poly, dx, dy, a) => k.fill(poly.map(([x, y]) => [x + dx, y + dy]), '#050d08', a), mx = 1470, my = 590, ang = -2.4 + Math.sin(TAU * ph) * 0.03, T = (u, v) => [mx + Math.cos(ang) * u - Math.sin(ang) * v, my + Math.sin(ang) * u + Math.cos(ang) * v];
        shadowOf(L.ell(...T(0, 0), 46, 32, 30, ang), 22, 30, 0.3);
        [[30, 1], [14, 1], [-6, 1], [-22, 1]].forEach(([u], i) => [-1, 1].forEach(sd => { const g = Math.sin(TAU * ph + i * 1.6 + (sd > 0 ? Math.PI : 0)) * 7, b = T(u, sd * 22), kn = T(u + (i < 2 ? 20 : -14) + g * 0.5, sd * (58 + Math.max(0, g) * 0.6)), ft = T(u + (i < 2 ? 44 : -38) + g, sd * 72); k.ink([b, kn, ft], 2.2, '#8a2a14'); k.ink([b, kn, ft].map(([x, y]) => [x - 0.8, y - 0.8]), 0.7, '#ffb08a', 0.7); for (let h = 0; h < 3; h++) { const p = [lerp(kn[0], ft[0], h / 3), lerp(kn[1], ft[1], h / 3)]; k.line(p, [p[0] + 4 * Math.cos(h * 2 + i), p[1] - 4], 0.4, '#5a1a0a'); } }));
        const body = L.ell(...T(0, 0), 46, 32, 36, ang); k.fill(body, '#e0582a'); k.rad(body, ...T(12, -12), 60, '#ffb070', 0.8, '#8a2a10', 0.6); [[-6, -12], [-10, 12], [10, 0]].forEach(([u, v]) => k.fill(L.ell(...T(u, v), 10, 7, 14, ang), '#5a2008', 0.55)); for (let i = 0; i < 16; i++) { const p = T(lerp(-40, 40, L.hash(i, 1)), lerp(-26, 26, L.hash(i, 2))); k.line(p, [p[0] + lerp(-9, 9, L.hash(i, 3)), p[1] - lerp(4, 12, L.hash(i, 4))], 0.5, '#fff0e0', 0.8); } k.outline(body, 1, '#4a1406'); [-1, 1].forEach(sd => k.dot(...T(34, sd * 14), 3, '#c01010')); L.blend(P, 'screen', () => k.fill(L.ell(...T(16, -14), 12, 5, 12, ang), '#ffffff', 0.45)); };
  /* the tardigrade, which does not know it is being watched: paddling its eight stubby legs, breathing, looking about */
  const tardigrade = (P, k, ph) => { const R = (a, b) => (a + b) / 2, shadowOf = (poly, dx, dy, a) => k.fill(poly.map(([x, y]) => [x + dx, y + dy]), '#050d08', a), tx = 300, ty = 790, ang = -0.12 + Math.sin(TAU * ph / 2) * 0.02, T = (u, v) => [tx + Math.cos(ang) * u - Math.sin(ang) * v, ty + Math.sin(ang) * u + Math.cos(ang) * v];
        const hw = t => 84 * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.42) * (1 + 0.05 * Math.cos(t * TAU * 5 - TAU * ph * 2)), body = [];
        for (let i = 0; i <= 64; i++) { const t = i / 64; body.push(T(lerp(-195, 195, t), -hw(t))); } for (let i = 64; i >= 0; i--) { const t = i / 64; body.push(T(lerp(-195, 195, t), hw(t))); }
        shadowOf(body, 24, 34, 0.35);
        const leg = (u, sd, du, dv, j) => { du += Math.sin(TAU * ph + j * 1.3 + (sd > 0 ? Math.PI : 0)) * 14; dv += Math.cos(TAU * ph + j * 1.3 + (sd > 0 ? Math.PI : 0)) * 5; const t = (u + 195) / 390, b = T(u, sd * (hw(t) - 16)), e = T(u + du, sd * (hw(t) + dv)), d = Math.atan2(e[1] - b[1], e[0] - b[0]), m = [(b[0] + e[0]) / 2, (b[1] + e[1]) / 2], len = Math.hypot(e[0] - b[0], e[1] - b[1]), lg = L.ell(m[0], m[1], len * 0.62, 19, 24, d);
          k.fill(lg.map(([x, y]) => [x + 12, y + 18]), '#061004', 0.25); k.fill(lg, '#eab88c'); k.rad(lg, m[0] - 6, m[1] - 8, len * 0.8, '#fff2de', 0.6, '#a8683a', 0.35); k.outline(lg, 1.1, '#7a4a28');
          for (let c = -1.5; c <= 1.5; c++) { const dd = d + c * 0.3, tip = [e[0] + Math.cos(d) * 4, e[1] + Math.sin(d) * 4]; k.curve([tip, [tip[0] + Math.cos(dd) * 10, tip[1] + Math.sin(dd) * 10], [tip[0] + Math.cos(dd + 1.1 * sd) * 15, tip[1] + Math.sin(dd + 1.1 * sd) * 15]], 1.7, '#3a1a08'); } };
        [[118, 10, 38], [40, 0, 42], [-40, -8, 40]].forEach(([u, du, dv], j) => [-1, 1].forEach(sd => leg(u, sd, du, dv, j))); [-1, 1].forEach(sd => leg(-170, sd, -44, 8, 3));
        k.fill(body, '#f0c49c', 0.96); k.rad(body, ...T(-40, -44), 260, '#fff6e8', 0.85, '#a86a3c', 0.55);
        const gut = []; for (let i = 0; i <= 40; i++) { const t = i / 40; gut.push(T(lerp(-150, 110, t), Math.sin(t * 8) * 10)); } const g = L.ribbon(gut, 30, 20); k.fill(g, '#9a6a3a', 0.4); k.stip(g, 120, '#5a3010', 0.45, 1.1);
        const bulb = L.ell(...T(138, 0), 20, 16, 20, ang); k.fill(bulb, '#b8805a', 0.6); k.outline(bulb, 0.8, '#7a4a28', 0.8); [-1, 1].forEach(sd => k.line(T(192, sd * 2), T(146, sd * 7), 1, '#6a3a1a', 0.8));
        for (let i = 1; i < 7; i++) { const t = i / 7, u = lerp(-195, 195, t), w = hw(t); k.curve([T(u + 5, -w + 3), T(u - 8, 0), T(u + 5, w - 3)], 1.3, '#b8784a', 0.5); }
        for (let i = 0; i < 260; i++) { const p = T(lerp(-185, 185, L.hash(i, 5)), lerp(-80, 80, L.hash(i, 6))); if (!L.pip(body, p[0], p[1])) continue; k.dot(p[0], p[1], 1 + L.hash(i, 7) * 1.2, '#fff6ea', 0.4); k.dot(p[0] + 1, p[1] + 1.2, 0.8 + L.hash(i, 8) * 0.8, '#9a5a2a', 0.18); }
        const mouth = L.ell(...T(194, 0), 9, 8 + Math.max(0, Math.sin(TAU * ph * 2)) * 2, 16, ang); k.fill(mouth, '#e0a070'); k.outline(mouth, 1, '#7a4a28'); k.fill(L.ell(...T(197, 0), 3.6, 3, 10, ang), '#3a1a08');
        [-1, 1].forEach(sd => { k.fill(L.ell(...T(160, sd * 30), 5, 5.5, 12, ang), '#1a0a04'); k.dot(...T(158, sd * 30 - 2), 1.7, '#ffffff', 0.85); });
        k.outline(body, 1.8, '#7a4a28'); L.blend(P, 'screen', () => { k.fill(L.ell(...T(-50, -48), 100, 14, 28, ang), '#ffffff', 0.32); k.fill(L.ell(...T(70, -44), 46, 9, 18, ang), '#ffffff', 0.4); }); };
  Z.world({
    name: 'The surface of the leaf', scale: '1 mm', seed: 9203, ink: K,
    portal: { cx: 800, cy: 520, w: 200, rot: -20, feather: 90 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.25 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], chance = p => P.R() < p;
      const S = SURF, inView = (poly, m = 60) => poly.some(([x, y]) => x > -m && x < 1600 + m && y > -m && y < 1000 + m), stomaAt = new Map(S.stomata.map(s => [s.cell, s]));
      const shadowOf = (poly, dx = 18, dy = 24, a = 0.32) => k.fill(poly.map(([x, y]) => [x + dx, y + dy]), '#050d08', a);

      /* ================================ the pavement: waxed pillows locked into each other ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#1d3a16');
      S.cells.forEach((c, i) => { const poly = c.poly2; if (!inView(poly)) return; const [x, y] = L.centroid(c.poly), st = stomaAt.get(i);
        k.fill(poly, st ? '#4f8f3c' : L.mix('#5a9842', '#78b050', c.r)); k.rad(poly, x - 34, y - 38, 128, '#e4ffb8', 0.5, '#1c4212', 0.42);
        k.stip(poly, 46, '#f4ffe0', 0.4, 0.9, (px, py) => Math.max(0, 1 - Math.hypot(px - x + 30, py - y + 30) / 110)); k.stip(poly, 28, '#153a10', 0.3, 0.8); });
      S.walls.forEach(e => { if (!inView(e, 20)) return; k.ink(e.map(([x, y]) => [x + 2, y + 2.4]), 2.4, '#061004', 0.4); k.ink(e, 3, '#12260e', 0.8); k.ink(e.map(([x, y]) => [x - 2.2, y - 2.4]), 1.1, '#eaffd0', 0.38); });

      /* ================================ stomata: little mouths, open ================================ */
      const ST6 = Z.lib.stoma;
      const stoma = st => { const [x, y] = st.c, a = st.ang, T = (u, v) => [x + Math.cos(a) * u - Math.sin(a) * v, y + Math.sin(a) * u + Math.cos(a) * v];
        k.fill(L.ell(x, y, st.rx * 1.2, st.ry * 1.3, 36, a), '#5f9e66', 0.45);
        [-1, 1].forEach(sd => { const pts = []; for (let i = 0; i <= 24; i++) { const t = Math.PI * i / 24; pts.push(T(-Math.cos(t) * st.rx, sd * Math.sin(t) * st.ry)); } for (let i = 24; i >= 0; i--) { const t = Math.PI * i / 24; pts.push(T(-Math.cos(t) * st.rx * 0.8, sd * Math.sin(t) * st.ry * 0.15)); }
          shadowOf(pts, 5, 6, 0.3); k.fill(pts, '#4f9450'); k.rad(pts, ...T(-st.rx * 0.25, sd * st.ry * 0.55 - st.ry * 0.25), st.rx * 1.1, '#d0f4b0', 0.7, '#1f4a26', 0.5);
          if (!st.portal || !ST6) for (let j = 0; j < 7; j++) { const t = Math.PI * (j + 0.5) / 7, p = T(-Math.cos(t) * st.rx * 0.9, sd * Math.sin(t) * st.ry * 0.58); k.fill(L.ell(p[0], p[1], st.rx * 0.1, st.ry * 0.12, 10, a + t), '#2f7a2a', 0.8); k.dot(p[0] - 1, p[1] - 1, st.rx * 0.03, '#b8f090', 0.7); }
          k.outline(pts, 1.1, '#0c1e12', 0.85); });
        if (st.portal && ST6) ST6.chloros.forEach(ch => { const c = cx.fromChild(ch.c), s = Math.hypot(cx.portal.a[0], cx.portal.a[1]), e = L.ell(c[0], c[1], ch.rx * s, ch.ry * s, 16, ch.a + cx.portal.th); k.fill(e, '#2f7a2a', 0.85); k.fill(L.ell(c[0] - 1, c[1] - 1, ch.rx * s * 0.5, ch.ry * s * 0.4, 10, ch.a + cx.portal.th), '#8ad060', 0.5); });
        const pore = L.ell(x, y, st.rx * 0.76, st.ry * 0.13, 28, a); k.fill(pore, '#040a06'); k.fill(L.ell(...T(st.rx * 0.1, st.ry * 0.03), st.rx * 0.4, st.ry * 0.05, 16, a), '#1f3a24', 0.8);
        [-1, 1].forEach(sd => k.ink([T(-st.rx * 0.74, sd * st.ry * 0.06), T(0, sd * st.ry * 0.16), T(st.rx * 0.74, sd * st.ry * 0.06)], 1, '#e8ffe0', 0.45)); };
      S.stomata.forEach(st => { if (inView([st.c], 120)) stoma(st); });

      /* ================================ things on the surface ================================ */
      // a hair, lying across the landscape, casting a long shadow
      const trichome = (bx, by, ang, len, w0) => { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([bx + Math.cos(ang) * len * t + Math.sin(t * 3 + bx) * 8, by + Math.sin(ang) * len * t - Math.sin(Math.PI * t) * len * 0.08]); }
        k.fill(L.ribbon(pts.map(([x, y], i) => [x + 24 + i * 1.6, y + 34 + i * 1.2]), w0 * 0.5, 2), '#050d08', 0.3);
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8, p = [bx + Math.cos(a) * w0 * 1.1, by + Math.sin(a) * w0 * 0.9], c = L.ell(p[0], p[1], w0 * 0.62, w0 * 0.44, 16, a); k.fill(c, '#bce6aa'); k.rad(c, p[0] - 5, p[1] - 6, w0 * 0.7, '#ffffff', 0.5, '#4a7a4a', 0.3); k.outline(c, 0.9, '#0f2418', 0.7); }
        const rib = L.ribbon(pts, w0 * 0.5, 1.8), n = pts.length; k.fill(rib, '#e6f6de', 0.95); k.fill(L.ribbon(pts.map(([x, y]) => [x + w0 * 0.12, y + w0 * 0.14]), w0 * 0.22, 0.8), '#9ac8a0', 0.45);
        for (let q = 1; q < 4; q++) { const i = Math.floor(n * q / 4), p = pts[i], d = Math.atan2(pts[i + 1][1] - p[1], pts[i + 1][0] - p[0]), w = lerp(w0 * 0.5, 1.8, i / n); k.curve([[p[0] - Math.sin(d) * w, p[1] + Math.cos(d) * w], [p[0] + Math.cos(d) * 4, p[1] + Math.sin(d) * 4], [p[0] + Math.sin(d) * w, p[1] - Math.cos(d) * w]], 0.9, '#5a8a5a', 0.8); }
        k.ink(pts.map(([x, y], i) => { const d = i < n - 1 ? Math.atan2(pts[i + 1][1] - y, pts[i + 1][0] - x) : 0, w = lerp(w0 * 0.5, 1.8, i / n) * 0.55; return [x + Math.sin(d) * w, y - Math.cos(d) * w]; }), 1.6, '#ffffff', 0.7); k.ink(rib.slice(0, n), 0.8, '#2a4a30', 0.8); k.ink(rib.slice(n), 1.2, '#10261a', 0.8); };
      trichome(170, 230, 0.35, 420, 30); trichome(1440, 880, -2.6, 360, 26);
      // a pollen grain, spiked like a sea urchin, sitting in a dip
      { const px = 1230, py = 250, r = 74; shadowOf(L.ell(px, py, r, r * 0.9, 40), 26, 34, 0.38); const body = L.ell(px, py, r, r, 64); k.fill(body, '#e8b030'); k.rad(body, px - r * 0.35, py - r * 0.4, r * 1.55, '#fff2a8', 0.95, '#7a4a08', 0.95);
        for (let i = 0; i < 110; i++) { const a = R(0, TAU), d = Math.sqrt(P.R()) * r * 0.93, x = px + Math.cos(a) * d, y = py + Math.sin(a) * d, lt = Math.max(0, 1 - Math.hypot(x - px + r * 0.35, y - py + r * 0.4) / (r * 1.6)); k.dot(x + 1.6, y + 1.8, 2.6, '#5a3006', 0.45); k.dot(x, y, 2.3, L.mix('#c88a20', '#fff4c0', lt), 0.95); }
        for (let i = 0; i < 40; i++) { const a = i * TAU / 40 + R(-0.03, 0.03), b = [px + Math.cos(a) * r, py + Math.sin(a) * r], t = [px + Math.cos(a) * (r + 12), py + Math.sin(a) * (r + 12)], n = [-Math.sin(a) * 3.4, Math.cos(a) * 3.4], sp = [[b[0] + n[0], b[1] + n[1]], t, [b[0] - n[0], b[1] - n[1]]]; k.fill(sp, a > 3.4 && a < 5.8 ? '#f8d060' : '#b87a18'); k.outline(sp, 0.5, '#5a3006', 0.7); }
        [0.5, 2.6, 4.7].forEach(a => { const c = [px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.55]; k.fill(L.ell(c[0], c[1], r * 0.09, r * 0.24, 14, a), '#7a4a08', 0.85); });
        k.outline(body, 1.1, '#5a3006', 0.85); L.blend(P, 'screen', () => k.fill(L.ell(px - r * 0.38, py - r * 0.44, r * 0.32, r * 0.14, 18, -0.6), '#ffffff', 0.5)); }
      // a fungal thread that has found a stoma and is swelling to break in
      { const tgt = S.stomata.filter(s => !s.portal && inView([s.c], -80)).sort((a, b) => Math.hypot(a.c[0] - 1080, a.c[1] - 460) - Math.hypot(b.c[0] - 1080, b.c[1] - 460))[0];
        if (tgt) { const end = tgt.c, path = P.sample([[1620, 40], [1500, 120], [1420, 90], [1330, 200], [1250, 380], [1180, 360], [(1180 + end[0]) / 2, (360 + end[1]) / 2 - 30], end], false, 4);
          const hy = (pts, w) => { k.ink(pts.map(([x, y]) => [x + 10, y + 13]), w + 1, '#050d08', 0.28); k.ink(pts, w + 1.4, '#6a7a6a', 0.9); k.ink(pts, w, '#f4f4e8', 0.95); k.ink(pts.map(([x, y]) => [x - w * 0.18, y - w * 0.2]), w * 0.3, '#ffffff', 0.8); for (let i = 8; i < pts.length - 4; i += 12) { const d = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); k.line([pts[i][0] - Math.sin(d) * w * 0.5, pts[i][1] + Math.cos(d) * w * 0.5], [pts[i][0] + Math.sin(d) * w * 0.5, pts[i][1] - Math.cos(d) * w * 0.5], 0.8, '#8a9a8a', 0.9); } };
          hy(path, 9); [[1420, 90, -0.9, 180], [1300, 250, 2.6, 150], [1250, 380, 1.4, 120]].forEach(([x, y, a, l]) => { const br = P.sample([[x, y], [x + Math.cos(a) * l * 0.5 + 20, y + Math.sin(a) * l * 0.5], [x + Math.cos(a) * l, y + Math.sin(a) * l]], false, 4); hy(br, 7); });
          const ap = L.ell(end[0], end[1], 22, 17, 24, tgt.ang); k.fill(ap.map(([x, y]) => [x + 8, y + 10]), '#050d08', 0.3); k.fill(ap, '#f4f0e0'); k.rad(ap, end[0] - 8, end[1] - 8, 26, '#ffffff', 0.7, '#b8b0a0', 0.5); k.outline(ap, 1.2, '#6a7a6a');
          const sp = L.ell(1560, 60, 40, 22, 30, 0.6); k.fill(sp, '#d8d0b0'); k.rad(sp, 1550, 50, 44, '#fffbe8', 0.8, '#8a8060', 0.5); k.outline(sp, 1.2, '#5a5a4a'); for (let i = 1; i < 4; i++) { const p = [1560 + Math.cos(0.6) * (i * 20 - 40), 60 + Math.sin(0.6) * (i * 20 - 40)]; k.line([p[0] - 12, p[1] + 16], [p[0] + 12, p[1] - 16], 0.8, '#8a8060'); } } }
      // a colony of bacteria asleep in a groove, a few of them arranged, by accident, into a number
      { const col = [640, 930]; for (let q = 0; q < 70; q++) { const a = R(0, Math.PI), r = Math.sqrt(P.R()) * 60, c = [col[0] + Math.cos(q * 2.4) * r, col[1] + Math.sin(q * 2.4) * r * 0.55], rod = [[c[0] - Math.cos(a) * 9, c[1] - Math.sin(a) * 9], [c[0] + Math.cos(a) * 9, c[1] + Math.sin(a) * 9]]; k.line([rod[0][0] + 3, rod[0][1] + 4], [rod[1][0] + 3, rod[1][1] + 4], 6.4, '#050d08', 0.25); k.line(rod[0], rod[1], 6.4, '#3a1450', 0.6); k.line(rod[0], rod[1], 5, '#9a4ac8', 0.95); k.line([rod[0][0] - 1, rod[0][1] - 1.4], [rod[1][0] - 1, rod[1][1] - 1.4], 1.2, '#e8c0ff', 0.7); }
        const two = [[0, 0], [8, -6], [16, 0], [12, 10], [4, 20], [0, 28], [16, 28]], one = [[28, 4], [34, -2], [34, 12], [34, 28]]; two.concat(one).forEach(([dx, dy]) => { const c = [700 + dx * 1.3, 890 + dy * 1.3]; k.fill(L.ell(c[0], c[1], 4.4, 4.4, 12), '#b84a9a'); k.dot(c[0] - 1.2, c[1] - 1.2, 1.2, '#ffd0f0', 0.8); }); }
      // a water droplet: a lens that magnifies the jigsaw under it
      { const dc = [540, 170], rx = 130, ry = 86, drop = L.ell(dc[0], dc[1], rx, ry, 64); k.fill(drop.map(([x, y]) => [x + 10, y + 14]), '#050d08', 0.2); k.fill(drop, '#b8e8c8', 0.55);
        const M = p => [dc[0] + (p[0] - dc[0]) * 1.45, dc[1] + (p[1] - dc[1]) * 1.45], inE = ([x, y]) => ((x - dc[0]) / (rx * 0.94)) ** 2 + ((y - dc[1]) / (ry * 0.94)) ** 2 < 1;
        S.walls.forEach(e => { if (!e.some(p => Math.hypot(p[0] - dc[0], p[1] - dc[1]) < 150)) return; const pts = e.map(M); for (let i = 0; i + 1 < pts.length; i++) if (inE(pts[i]) && inE(pts[i + 1])) k.line(pts[i], pts[i + 1], 3.6, '#10261a', 0.6); });
        k.rad(drop, dc[0], dc[1], rx, '#ffffff', 0, '#1f5a3a', 0.5); k.outline(drop, 2.6, '#0f3a24', 0.6); k.outline(L.ell(dc[0], dc[1], rx - 6, ry - 6, 60), 1.2, '#f0fff4', 0.5); L.blend(P, 'screen', () => { k.fill(L.ell(dc[0] - rx * 0.4, dc[1] - ry * 0.45, rx * 0.28, ry * 0.12, 20, -0.35), '#ffffff', 0.75); k.fill(L.ell(dc[0] + rx * 0.45, dc[1] + ry * 0.4, rx * 0.12, ry * 0.06, 12, -0.35), '#ffffff', 0.5); }); }
      // the light: low, from the upper left, raking across the relief
      L.blend(P, 'screen', () => k.rad(L.rect(-40, -40, 1640, 1040), 200, 120, 900, '#fff8d8', 0.08, '#fff8d8', 0));
    }
    ,
    /* ================================ the surface, alive ================================ */
    live: [(Q, t) => {
      const k = L.kit(Q, K, { rough: 0.15 }), H = L.hash, cyc = (per, ph = 0) => (L.cyc(t, per) + ph) % 1, osc = (per, ph = 0) => L.osc(t, per, ph);
      // every open stoma breathes out a thread of vapour
      SURF.stomata.forEach((st, j) => { if (st.portal) return; const [x0, y0] = st.c; if (x0 < -80 || x0 > 1680 || y0 < -80 || y0 > 1080) return; for (let i = 0; i < 5; i++) { const u = cyc(3.4 + H(j, 1), i / 5), x = x0 + u * 70 + Math.sin(u * 8 + i + j) * 10, y = y0 - u * 110, r = 6 + u * 26; L.blend(Q, 'lighter', () => k.rad(L.ell(x, y, r, r * 0.7, 18), x, y, r, '#e8fff0', 0.16 * (1 - u) * Math.min(1, u * 5), '#e8fff0', 0)); } });
      // the tardigrade paddles; the mite picks its feet up
      tardigrade(Q, k, cyc(1.9)); mite(Q, k, cyc(1.1));
      // bacteria leaving the colony, wriggling across the grooves
      for (let i = 0; i < 9; i++) { const u = cyc(57 / 2, H(i, 2)), a0 = H(i, 3) * TAU, d = u * 520, x = 640 + Math.cos(a0) * d * 1.3 + Math.sin(u * 20 + i) * 10, y = 930 + Math.sin(a0) * d * 0.5 - u * 120, a = a0 + Math.sin(t * 6 + i) * 0.4; if (Math.hypot(x - 800, y - 520) < 170) continue; const al = Math.min(1, u * 8) * Math.min(1, (1 - u) * 8), r0 = [x - Math.cos(a) * 9, y - Math.sin(a) * 9], r1 = [x + Math.cos(a) * 9, y + Math.sin(a) * 9];
        k.line(r0, r1, 7, '#7a2aa0', al); k.line(r0, r1, 5, '#c070f0', al); const fl = []; for (let q = 0; q <= 10; q++) { const tt = q / 10; fl.push([r0[0] - Math.cos(a) * tt * 26 + Math.sin(a) * Math.sin(tt * 9 - t * 25) * 4, r0[1] - Math.sin(a) * tt * 26 - Math.cos(a) * Math.sin(tt * 9 - t * 25) * 4]); } k.ink(fl, 0.6, '#9a4ac0', 0.8 * al); }
      // the water droplet: light sliding round its rim
      { const x = 540, y = 170, a = TAU * cyc(6); L.blend(Q, 'lighter', () => { k.glow(x + Math.cos(a) * 100, y + Math.sin(a) * 60, 14, '#ffffff', 0.35); k.fill(L.ell(x - 40 + osc(5) * 10, y - 40, 34, 8, 16, -0.2), '#ffffff', 0.12); }); }
      // the fungal thread's tip pushing on, a bead of sap growing at it
      { const p = [1268, 494], g = cyc(5.2); k.fill(L.ell(p[0], p[1] + g * 8, 5 + g * 3, 7 + g * 4, 14), '#f4f4ec', 0.9); k.outline(L.ell(p[0], p[1] + g * 8, 5 + g * 3, 7 + g * 4, 14), 0.6, '#8a9a8a', 0.8); }
      // light, low and moving, as a cloud passes the sun
      L.blend(Q, 'lighter', () => { const x = lerp(-400, 2000, cyc(57 / 2)); k.lin([[x - 300, -40], [x + 300, -40], [x + 100, 1040], [x - 500, 1040]], '#f0ffd0', 0, '#f0ffd0', 0.06, x - 300, 0, x, 0); });
    }]
  });
})();
