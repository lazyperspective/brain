/* WORLD 9 — CHLOROPHYLL A.
   The pigment itself, atom by atom: a chlorin ring of carbon and nitrogen with the five-membered ring E folded onto
   one side, a vinyl, an ethyl, a keto oxygen, a methyl ester, and the long phytol tail that anchors it in the
   membrane, all floating in its own electron density. At the centre, magnesium, drawn as a glass ball. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#0f2a1a', SC = 56, ROT = -15 * Math.PI / 180, C0 = [800, 500];
  const CPK = { C: '#8e949a', N: '#3a5ad8', O: '#e03a2a', H: '#f4f4f0', Mg: '#2a8a3a' }, RAD = { C: 20, N: 22, O: 22, H: 11, Mg: 64 };

  const MOL = Z.lib.molecule = (() => {
    const A = [], B = [], add = (el, x, y) => (A.push({ el, x, y }), A.length - 1), bond = (i, j, o = 1) => B.push([i, j, o]);
    const out = (i, from, len, off = 0) => { const a = A[i], d = Math.atan2(a.y - from[1], a.x - from[0]) + off; return [a.x + Math.cos(d) * len, a.y + Math.sin(d) * len]; };
    const Hs = (i, from, n, len = 1.05) => { for (let q = 0; q < n; q++) { const h = add('H', ...out(i, from, len, n === 1 ? 0 : (q - (n - 1) / 2) * 1.1)); bond(i, h); } };
    const mg = add('Mg', 0, 0), rings = { A: [0, -1], B: [1, 0], C: [0, 1], D: [-1, 0] }, Rg = {}, cen = nm => [rings[nm][0] * 3.5, rings[nm][1] * 3.5];
    Object.entries(rings).forEach(([nm, u]) => { const v = [-u[1], u[0]], P = (a, b) => [a * u[0] + b * v[0], a * u[1] + b * v[1]];
      const N = add('N', ...P(2.05, 0)), ap = add('C', ...P(2.87, 1.1)), am = add('C', ...P(2.87, -1.1)), bp = add('C', ...P(4.24, 0.68)), bm = add('C', ...P(4.24, -0.68));
      bond(N, ap, nm === 'A' || nm === 'C' ? 2 : 1); bond(N, am); bond(ap, bp); bond(am, bm, nm === 'B' ? 2 : 1); bond(bp, bm, nm === 'D' ? 1 : 2); bond(mg, N, 0); Rg[nm] = { N, ap, am, bp, bm }; });
    const order = ['A', 'B', 'C', 'D'], meso = {}; order.forEach((X, i) => { const Y = order[(i + 1) % 4], m = add('C', 2.43 * (rings[X][0] + rings[Y][0]), 2.43 * (rings[X][1] + rings[Y][1])); bond(Rg[X].ap, m, i % 2 ? 1 : 2); bond(m, Rg[Y].am, i % 2 ? 2 : 1); meso[X + Y] = m; if (X + Y !== 'CD') Hs(m, [0, 0], 1); });
    // ring A: methyl and vinyl
    { const m = add('C', ...out(Rg.A.bm, cen('A'), 1.5)); bond(Rg.A.bm, m); Hs(m, [A[Rg.A.bm].x, A[Rg.A.bm].y], 3); const v1 = add('C', ...out(Rg.A.bp, cen('A'), 1.45)); bond(Rg.A.bp, v1); Hs(v1, [A[Rg.A.bp].x, A[Rg.A.bp].y], 1, 1.0); const v2 = add('C', ...out(v1, [A[Rg.A.bp].x, A[Rg.A.bp].y], 1.34, 1.05)); bond(v1, v2, 2); Hs(v2, [A[v1].x, A[v1].y], 2); }
    // ring B: methyl and ethyl
    { const m = add('C', ...out(Rg.B.bm, cen('B'), 1.5)); bond(Rg.B.bm, m); Hs(m, [A[Rg.B.bm].x, A[Rg.B.bm].y], 3); const e1 = add('C', ...out(Rg.B.bp, cen('B'), 1.52)); bond(Rg.B.bp, e1); const e2 = add('C', ...out(e1, [A[Rg.B.bp].x, A[Rg.B.bp].y], 1.52, -1.05)); bond(e1, e2); Hs(e2, [A[e1].x, A[e1].y], 3); }
    // ring C: methyl; ring E: keto, and a methyl ester
    { const m = add('C', ...out(Rg.C.bm, cen('C'), 1.5)); bond(Rg.C.bm, m); Hs(m, [A[Rg.C.bm].x, A[Rg.C.bm].y], 3); const c131 = add('C', -1.75, 5.25), c132 = add('C', -2.85, 4.05); bond(Rg.C.bp, c131); bond(c131, c132); bond(c132, meso.CD); const o = add('O', -1.95, 6.47); bond(c131, o, 2); Hs(c132, [-1.9, 3.7], 1);
      const cc = add('C', -3.9, 5.0); bond(c132, cc); const o1 = add('O', -3.6, 6.2); bond(cc, o1, 2); const o2 = add('O', -5.15, 4.7); bond(cc, o2); const me = add('C', -6.15, 5.6); bond(o2, me); Hs(me, [-5.15, 4.7], 3); }
    // ring D, reduced: a methyl, and the propionate that becomes the phytol tail
    { const c18 = Rg.D.bp, c17 = Rg.D.bm, m = add('C', ...out(c18, cen('D'), 1.52, -0.5)); bond(c18, m); Hs(m, [A[c18].x, A[c18].y], 3); Hs(c18, cen('D'), 1); const h17 = add('H', ...out(c17, cen('D'), 1.05, -0.9)); bond(c17, h17);
      const p1 = add('C', ...out(c17, cen('D'), 1.52, 0.55)); bond(c17, p1); const p2 = add('C', ...out(p1, [A[c17].x, A[c17].y], 1.52, 1.05)); bond(p1, p2); const p3 = add('C', ...out(p2, [A[p1].x, A[p1].y], 1.5, -1.05)); bond(p2, p3); const po = add('O', ...out(p3, [A[p2].x, A[p2].y], 1.22, -1.05)); bond(p3, po, 2); const pe = add('O', ...out(p3, [A[p2].x, A[p2].y], 1.34, 1.05)); bond(p3, pe);
      let prev = pe, pp = p3, sgn = -1; for (let i = 0; i < 20; i++) { const c = add('C', ...out(prev, [A[pp].x, A[pp].y], 1.52, sgn * 1.05)); bond(prev, c); if ([2, 6, 10, 14].includes(i)) { const br = add('C', ...out(c, [A[prev].x, A[prev].y], 1.52, -sgn * 1.05)); bond(c, br); Hs(br, [A[c].x, A[c].y], 3); } if (i === 1) { const cc2 = A[c]; void cc2; } pp = prev; prev = c; sgn = -sgn; } }
    const W = A.map(a => { const x = a.x * Math.cos(ROT) - a.y * Math.sin(ROT), y = a.x * Math.sin(ROT) + a.y * Math.cos(ROT); return [C0[0] + x * SC, C0[1] + y * SC]; });
    return { A, B, W, mg };
  })();

  Z.world({
    name: 'Chlorophyll a', scale: '2 nm', seed: 9909, ink: K,
    portal: { cx: C0[0], cy: C0[1], w: 100, rot: 0, feather: 60 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)];
      const { A, B, W } = MOL, onF = ([x, y], m = 0) => x > -m && x < 1600 + m && y > -m && y < 1000 + m;
      /* ================================ the membrane's green, paling into the density map ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#8ac85a'); k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 820, '#f2f8e4', 1, '#f2f8e4', 0);
      for (let x = 0; x <= 1600; x += 35) k.line([x, 0], [x, 1000], 0.5, '#8aa870', 0.18); for (let y = 0; y <= 1000; y += 35) k.line([0, y], [1600, y], 0.5, '#8aa870', 0.18);
      // neighbouring chlorophylls, out of focus at the edges
      [[-160, 140, 0.6], [1760, 220, -0.4], [1720, 1080, 1.2], [200, 1120, 2.1]].forEach(([x, y, a]) => { for (let i = 0; i < 4; i++) { const u = [Math.cos(a + i * Math.PI / 2), Math.sin(a + i * Math.PI / 2)], v = [-u[1], u[0]], P2 = (p, q) => [x + (p * u[0] + q * v[0]) * SC, y + (p * u[1] + q * v[1]) * SC], ring = [P2(2.05, 0), P2(2.87, 1.1), P2(4.24, 0.68), P2(4.24, -0.68), P2(2.87, -1.1)]; k.ink(ring.concat([ring[0]]), 8, '#4a8a3a', 0.25); ring.forEach(p => k.dot(p[0], p[1], 18, '#4a8a3a', 0.18)); } });
      // electron density: contours of a sum of gaussians, laid on a grid
      { const st = 6, x0 = -12, y0 = -12, nx = Math.ceil(1624 / st) + 1, ny = Math.ceil(1024 / st) + 1, g1 = new Float32Array(nx * ny), g2 = new Float32Array(nx * ny), wEl = { C: 1, N: 1.1, O: 1.2, H: 0.4, Mg: 1.5 };
        W.forEach(([ax, ay], i) => { const w = wEl[A[i].el], s1 = 30, s2 = 64; const i0 = Math.max(0, Math.floor((ax - 4 * s2 - x0) / st)), i1 = Math.min(nx - 1, Math.ceil((ax + 4 * s2 - x0) / st)), j0 = Math.max(0, Math.floor((ay - 4 * s2 - y0) / st)), j1 = Math.min(ny - 1, Math.ceil((ay + 4 * s2 - y0) / st)); for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) { const dx = x0 + ii * st - ax, dy = y0 + j * st - ay, d2 = dx * dx + dy * dy; g1[j * nx + ii] += w * Math.exp(-d2 / (2 * s1 * s1)); g2[j * nx + ii] += w * Math.exp(-d2 / (2 * s2 * s2)); } });
        const look = g => (x, y) => g[Math.round((y - y0) / st) * nx + Math.round((x - x0) / st)];
        L.contours(look(g2), x0, y0, 1612, 1012, st, [0.3, 0.55, 0.85, 1.2]).forEach((lines, li) => lines.forEach(l => { if (l.length > 4) k.ink(l, 1.4 - li * 0.2, '#3a8aa0', 0.32 + li * 0.05); }));
        L.contours(look(g1), x0, y0, 1612, 1012, st, [0.35, 0.7]).forEach((lines, li) => lines.forEach(l => { if (l.length > 4) k.ink(l, 1, li ? '#2a5ab0' : '#4a9ac0', 0.45); })); }
      /* ================================ sticks, then balls ================================ */
      const stick = (a, b, w, col, al = 1) => { k.line(a, b, w + 3, '#1a2a2a', 0.5 * al); k.line(a, b, w, col, al); k.line([a[0] - w * 0.18, a[1] - w * 0.22], [b[0] - w * 0.18, b[1] - w * 0.22], w * 0.3, '#ffffff', 0.45 * al); };
      B.forEach(([i, j, o]) => { const a = W[i], b = W[j]; if (!onF(a, 200) && !onF(b, 200)) return; if (o === 0) { for (let q = 0; q < 8; q++) { const t0 = q / 8, t1 = t0 + 0.06; if (t0 > 0.12 && t1 < 0.72) k.line([lerp(a[0], b[0], t0), lerp(a[1], b[1], t0)], [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1)], 3, '#2a8a3a', 0.8); } return; }
        const ca = CPK[A[i].el], cb = CPK[A[j].el], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w = A[i].el === 'H' || A[j].el === 'H' ? 7 : 11;
        if (o === 2) { const d = Math.atan2(b[1] - a[1], b[0] - a[0]), n = [-Math.sin(d) * 7, Math.cos(d) * 7]; [1, -1].forEach(sg => { const a2 = [a[0] + n[0] * sg, a[1] + n[1] * sg], b2 = [b[0] + n[0] * sg, b[1] + n[1] * sg], m2 = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]; stick(a2, m2, 7, ca); stick(m2, b2, 7, cb); }); }
        else { stick(a, m, w, ca); stick(m, b, w, cb); } });
      const ball = (p, el) => { const r = RAD[el], e = L.ell(p[0], p[1], r, r, 32); k.fill(L.ell(p[0] + r * 0.2, p[1] + r * 0.3, r, r, 24), '#0a1a10', 0.2); k.fill(e, CPK[el]); k.rad(e, p[0] - r * 0.35, p[1] - r * 0.4, r * 1.5, '#ffffff', el === 'H' ? 0.5 : 0.65, L.shade(CPK[el], -0.55), 0.85); k.outline(e, 1, L.shade(CPK[el], -0.6), 0.8); L.blend(P, 'screen', () => k.fill(L.ell(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.28, r * 0.18, 12, -0.6), '#ffffff', 0.7)); };
      A.forEach((a, i) => { if (a.el === 'Mg' || !onF(W[i], 40)) return; ball(W[i], a.el); });
      // the magnesium, a glass ball with another world in it
      { const [x, y] = W[MOL.mg], r = RAD.Mg, e = L.ell(x, y, r, r, 64); k.fill(L.ell(x + 12, y + 16, r, r, 48), '#0a1a10', 0.25); k.fill(e, '#060a1c'); k.rad(e, x, y, r, '#0c1430', 0.9, '#1a4a3a', 0.9); }
      /* ================================ what the textbook margin says ================================ */
      k.text('CHLOROPHYLL A', 90, 90, 22, '#2a4a3a', { a: 0.8 }); k.text('C55 H72 MG N4 O5', 92, 122, 13, '#2a4a3a', { a: 0.65 }); k.text('ONE OF 14 IN ITS LIGHT-HARVESTING COMPLEX', 92, 146, 9, '#2a4a3a', { a: 0.55 });
      ['A', 'B', 'C', 'D'].forEach((nm, i) => { const u = [[0, -1], [1, 0], [0, 1], [-1, 0]][i], x = u[0] * 3.55, y = u[1] * 3.55, p = [C0[0] + (x * Math.cos(ROT) - y * Math.sin(ROT)) * SC, C0[1] + (x * Math.sin(ROT) + y * Math.cos(ROT)) * SC]; P.label(nm, p[0] - 6, p[1] + 6, { size: 20, c: '#6a8a6a', a: 0.7 }); });
      { const x = -2.0, y = 4.9, p = [C0[0] + (x * Math.cos(ROT) - y * Math.sin(ROT)) * SC, C0[1] + (x * Math.sin(ROT) + y * Math.cos(ROT)) * SC]; P.label('E', p[0] - 6, p[1] + 6, { size: 20, c: '#6a8a6a', a: 0.7 }); }
      P.label('MG2+ HOLDS THE LIGHT', 930, 330, { size: 14, c: '#2a4a3a', a: 0.75 }); k.curve([[940, 336], [900, 380], [858, 450]], 1, '#2a4a3a', 0.7); k.line([858, 450], [862, 438], 1, '#2a4a3a', 0.7); k.line([858, 450], [868, 444], 1, '#2a4a3a', 0.7);
      P.label('PHYTOL TAIL, INTO THE MEMBRANE', 110, 900, { size: 12, c: '#2a4a3a', a: 0.6 });
      k.line([1380, 940], [1450, 940], 2, '#2a4a3a', 0.7); k.text('1 A', 1415, 930, 10, '#2a4a3a', { align: 'center', a: 0.7 });
    },
    over(P, cx) {
      // glass: the reflections that make the magnesium a lens
      const k = L.kit(P, K, { rough: 0.1 }), [x, y] = MOL.W[MOL.mg], r = RAD.Mg;
      k.outline(L.ell(x, y, r, r, 64), 3, '#1a4a3a', 0.9); k.outline(L.ell(x, y, r - 3, r - 3, 64), 1.2, '#8ae0a0', 0.6);
      L.blend(P, 'screen', () => { k.fill(L.ell(x - r * 0.38, y - r * 0.45, r * 0.34, r * 0.16, 24, -0.7), '#ffffff', 0.35); k.fill(L.ell(x + r * 0.5, y + r * 0.5, r * 0.16, r * 0.06, 16, -0.7), '#b8ffd0', 0.25); const arc = []; for (let i = 0; i <= 20; i++) { const a = Math.PI * 0.15 + i / 20 * Math.PI * 0.6; arc.push([x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86]); } k.ink(arc, 3, '#6affb0', 0.35); });
      k.dot(x - r * 0.5, y - r * 0.55, 2.4, '#ffffff', 0.9);
    }
  });
})();
