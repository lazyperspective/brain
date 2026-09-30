/* WORLD 7 — THE CHLOROPLAST.
   A green lens inside the guard cell: two envelopes, a pale stroma thick with enzymes, coins of thylakoid membrane
   stacked into grana and joined by long flat lamellae, starch laid down in rings, droplets of oil. We dive onto one
   lamella where it runs flat, and its membrane starts to show the machines embedded in it. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#0f2a10';

  const CH = Z.lib.chloro = (() => {
    const C = [800, 500], RX = 648, RY = 378, rr = L.rng(3131);
    const inside = (x, y, m = 0) => ((x - C[0]) / (RX - m)) ** 2 + ((y - C[1]) / (RY - m)) ** 2 < 1;
    // lamellae: long flat sacs; the one through (1000, 560) is flat there, and that is where we go in
    const lam = [{ y0: 560, x0: 1000, k: 22, s: 0 }, { y0: 330, x0: 700, k: -60, s: 0.8 }, { y0: 430, x0: 800, k: 30, s: 1.7 }, { y0: 680, x0: 650, k: -30, s: 2.4 }, { y0: 770, x0: 900, k: -70, s: 3.1 }, { y0: 230, x0: 900, k: 80, s: 3.9 }];
    lam.forEach(l => { l.y = x => l.y0 + l.k * ((x - l.x0) / 500) ** 2 + (l.s ? 10 * Math.sin(x / 140 + l.s) : 0); });
    const grana = []; const tryG = (x, y, h) => { if (!inside(x, y, 90)) return; if (Math.hypot(x - 1000, y - 560) < 150) return; if (grana.some(g => Math.abs(g.x - x) < 130 && Math.abs(g.y - y) < (g.h + h) / 2 + 20)) return; grana.push({ x, y, h, w: 96 + rr() * 30, n: Math.max(4, Math.round(h / 14)) }); };
    lam.forEach(l => { for (let x = 250; x < 1400; x += 150 + rr() * 60) tryG(x + rr() * 40, l.y(x), 90 + rr() * 110); });
    const starch = [[480, 390, 120, 70, 0.2], [700, 700, 150, 82, -0.1], [1250, 400, 110, 64, 0.3]];
    const globuli = []; for (let i = 0; i < 26; i++) { const x = lerp(220, 1380, rr()), y = lerp(160, 840, rr()); if (inside(x, y, 60) && Math.hypot(x - 1000, y - 560) > 120) globuli.push([x, y, 7 + rr() * 11]); }
    return { C, RX, RY, lam, grana, starch, globuli, inside, P: [1000, 560] };
  })();

  Z.world({
    name: 'A chloroplast', scale: '5 µm', seed: 7707, ink: K,
    portal: { cx: CH.P[0], cy: CH.P[1], w: 80, rot: 0, feather: 260 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.2 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], chance = p => P.R() < p;
      const { C, RX, RY } = CH, env = L.ell(C[0], C[1], RX, RY, 120), inner = L.ell(C[0], C[1], RX - 14, RY - 14, 120);

      /* ================================ the guard cell around it ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#78b064'); k.rad(L.rect(-40, -40, 1640, 1040), 300, 200, 1400, '#c8f0a8', 0.5, '#3a7a3a', 0.4);
      { const d1 = [], d2 = []; for (let i = 0; i < 9000; i++) { const x = R(-20, 1620), y = R(-20, 1020); if (CH.inside(x, y, -20)) continue; (chance(0.5) ? d1 : d2).push([x, y, R(0.8, 2)]); } k.dots(d1, '#2a5a20', 0.35); k.dots(d2, '#eaffd8', 0.3); }
      for (let i = 0; i < 14; i++) { let x = R(0, 1600), y = chance(0.5) ? R(0, 130) : R(870, 1000), a = R(0, TAU); const pts = []; for (let q = 0; q < 40; q++) { pts.push([x, y]); a += R(-0.3, 0.3); x += Math.cos(a) * 14; y += Math.sin(a) * 14; } k.ink(pts, 8, '#a8c890', 0.35); k.ink(pts, 2, '#e8f8d8', 0.5); pts.forEach((p, q) => { if (q % 2) k.dot(p[0] + R(-5, 5), p[1] + R(-5, 5), 2.2, '#3a6a2a', 0.8); }); }
      for (let i = 0; i < 8; i++) { const x = R(0, 1600), y = R(0, 1000), a = R(0, Math.PI); if (CH.inside(x, y, -60)) continue; k.line([x - Math.cos(a) * 300, y - Math.sin(a) * 300], [x + Math.cos(a) * 300, y + Math.sin(a) * 300], 2.6, '#d8f0c8', 0.35); }
      { const mx = 150, my = 90, a = 0.4, m = L.ell(mx, my, 150, 70, 40, a); k.fill(m, '#d8b070'); k.rad(m, mx - 40, my - 30, 170, '#fff0c0', 0.6, '#8a6a30', 0.5); for (let q = -5; q <= 5; q++) { const p = [mx + Math.cos(a) * q * 24, my + Math.sin(a) * q * 24]; k.curve([[p[0] - Math.sin(a) * 50, p[1] + Math.cos(a) * 50], [p[0] + Math.cos(a) * 10, p[1] + Math.sin(a) * 10], [p[0] + Math.sin(a) * 50, p[1] - Math.cos(a) * 50]], 2, '#8a6a30', 0.8); } k.outline(m, 2.4, '#6a4a18'); k.outline(L.ell(mx, my, 142, 62, 40, a), 1, '#6a4a18', 0.7); }
      { const px = 1480, py = 900, pe = L.ell(px, py, 90, 80, 40); k.fill(pe, '#c8d8a8'); k.outline(pe, 2, '#5a6a3a'); const cr = [[px - 30, py - 20], [px + 30, py - 30], [px + 36, py + 20], [px - 24, py + 30]]; k.fill(cr, '#a8b880'); k.outline(cr, 1, '#5a6a3a'); for (let i = 0; i < 6; i++) k.line([px - 26 + i * 10, py - 24 + i], [px - 20 + i * 10, py + 26], 0.6, '#5a6a3a', 0.8); }

      /* ================================ the chloroplast ================================ */
      k.fill(env.map(([x, y]) => [x + 18, y + 24]), '#0a2008', 0.3);
      k.fill(env, '#3f8a38'); k.fill(inner, '#d4eaa4'); k.rad(inner, C[0] - 240, C[1] - 150, 900, '#f4ffd8', 0.5, '#8ab860', 0.45);
      // stroma: crowded with enzymes too small to draw one by one
      { const d1 = [], d2 = [], d3 = []; for (let i = 0; i < 26000; i++) { const x = R(150, 1450), y = R(120, 880); if (!CH.inside(x, y, 16)) continue; (i % 3 === 0 ? d1 : i % 3 === 1 ? d2 : d3).push([x, y, R(0.8, 2.2)]); } k.dots(d1, '#6a9a40', 0.45); k.dots(d2, '#f8ffe0', 0.4); k.dots(d3, '#3a6a2a', 0.3); }
      // DNA, in pale tangles
      for (let i = 0; i < 5; i++) { let x = R(350, 1250), y = R(250, 750), a = R(0, TAU); const pts = []; for (let q = 0; q < 70; q++) { pts.push([x, y]); a += R(-0.9, 0.9); x += Math.cos(a) * 5; y += Math.sin(a) * 5; } if (pts.every(p => CH.inside(p[0], p[1], 40))) k.ink(pts, 1, '#7a9a6a', 0.55); }
      // the lamellae: flat sacs, membrane either side of a thin lumen
      const lamella = (l, x0, x1, th = 16) => { const top = [], bot = []; for (let x = x0; x <= x1; x += 8) { if (!CH.inside(x, l.y(x), 26)) continue; top.push([x, l.y(x) - th / 2]); bot.push([x, l.y(x) + th / 2]); } if (top.length < 3) return; const sac = top.concat(bot.slice().reverse()); k.fill(sac, '#6fb052'); k.ink(top, 3.6, '#1f5a1a', 0.9); k.ink(bot, 3.6, '#1f5a1a', 0.9); k.ink(top.map(([x, y]) => [x, y + 2.4]), 0.8, '#d8f0b0', 0.6); };
      CH.lam.forEach((l, i) => lamella(l, 170, 1430, i ? 14 : 18));
      // grana: stacks of thylakoid coins
      CH.grana.forEach(g => { const top = g.y - g.h / 2; k.fill(L.rect(g.x - g.w / 2 + 10, top + 12, g.x + g.w / 2 + 12, top + g.h + 14), '#0a2008', 0.2); for (let d = 0; d < g.n; d++) { const y = top + d * g.h / g.n, h = g.h / g.n - 2, w = g.w * (1 - 0.1 * Math.abs(d - g.n / 2) / g.n) + R(-4, 4), x0 = g.x - w / 2 + R(-3, 3), disc = [[x0 + 6, y], [x0 + w - 6, y], [x0 + w, y + h / 2], [x0 + w - 6, y + h], [x0 + 6, y + h], [x0, y + h / 2]]; k.fill(disc, '#2f7a2a'); k.fill([[x0 + 7, y + h * 0.35], [x0 + w - 7, y + h * 0.35], [x0 + w - 7, y + h * 0.65], [x0 + 7, y + h * 0.65]], '#7ac05a', 0.9); k.outline(disc, 1.1, '#0f3a10'); } k.lin(L.rect(g.x - g.w / 2, top, g.x + g.w / 2, top + g.h), '#ffffff', 0.18, '#ffffff', 0, g.x - g.w / 2, 0, g.x + g.w / 2, 0); });
      // starch, laid down in rings
      CH.starch.forEach(([x, y, rx, ry, a]) => { const e = L.ell(x, y, rx, ry, 48, a); k.fill(e.map(([p, q]) => [p + 8, q + 10]), '#3a5a20', 0.25); k.fill(e, '#f4f2e0'); for (let r = 0.2; r < 1; r += 0.12) k.outline(L.ell(x + rx * 0.08 * (1 - r), y, rx * r, ry * r, 36, a), 0.8, '#c8c4a0', 0.8); k.rad(e, x - rx * 0.3, y - ry * 0.4, rx * 1.2, '#ffffff', 0.5, '#b8b490', 0.3); k.outline(e, 1.4, '#8a8a60'); });
      // plastoglobuli: droplets of oil
      CH.globuli.forEach(([x, y, r]) => { const e = L.ell(x, y, r, r, 20); k.fill(e, '#5a5a20'); k.rad(e, x - r * 0.3, y - r * 0.35, r * 1.2, '#c8c880', 0.7, '#2a2a08', 0.6); k.dot(x - r * 0.35, y - r * 0.4, r * 0.22, '#ffffff', 0.7); });
      // ribosomes, the ones big enough to count
      { const rb = []; for (let i = 0; i < 700; i++) { const x = R(160, 1440), y = R(130, 870); if (CH.inside(x, y, 24)) rb.push([x, y, R(2.4, 3.6)]); } k.dots(rb, '#4a3a6a', 0.7); }
      // the envelope, two membranes with a gap
      k.outline(env, 4.6, '#1f5a1a'); k.outline(L.ell(C[0], C[1], RX - 3, RY - 3, 120), 1.2, '#b8e090', 0.7); k.outline(inner, 3.4, '#2f6a22'); k.outline(L.ell(C[0], C[1], RX - 8, RY - 8, 120), 1, '#e8ffc8', 0.5);
      for (let i = 0; i < 60; i++) { const a = i * TAU / 60 + R(-0.02, 0.02); k.fill(L.ell(C[0] + Math.cos(a) * (RX - 7), C[1] + Math.sin(a) * (RY - 7), 4, 3, 8, a), '#5a9a3a', 0.9); }

      /* ================================ closer in: the lamella we are heading for, and what sits in its membranes ================================ */
      { const M = Z.lib.membrane; if (M) { const fc = p => cx.fromChild(p), s = 1 / 20;
          M.proteins.forEach(pr => { const c = fc(pr.c), d = Math.hypot(c[0] - CH.P[0], c[1] - CH.P[1]); if (d > 160) return; const a = Math.max(0, Math.min(1, (160 - d) / 80)); k.fill(L.ell(c[0], c[1], pr.rx * s, pr.ry * s, 16), pr.col, 0.85 * a); k.outline(L.ell(c[0], c[1], pr.rx * s, pr.ry * s, 16), 0.5, '#1f3a1a', 0.7 * a); });
          M.stroma.forEach(m => { const c = fc(m.c), d = Math.hypot(c[0] - CH.P[0], c[1] - CH.P[1]); if (d > 130) return; const a = Math.max(0, Math.min(1, (130 - d) / 70)); k.dot(c[0], c[1], Math.max(0.6, m.r * s), m.col, 0.8 * a); }); } }
    }
  });
})();
