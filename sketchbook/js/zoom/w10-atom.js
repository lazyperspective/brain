/* WORLD 10 — MAGNESIUM.
   Inside the glass ball: one atom of magnesium, drawn as a physicist would if a physicist had coloured pencils.
   Twelve electrons as clouds of probability: the tight violet 1s, the blue 2s with its hollow node, the six 2p in
   their dumbbells, and the wide golden 3s, the two electrons magnesium lends to the ring. At the centre, the
   nucleus, and inside the nucleus, everything else. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#c8d8ff', C0 = [800, 500], NR = 100;

  Z.world({
    name: 'A magnesium atom', scale: '0.3 nm', seed: 1010, ink: K,
    portal: { cx: C0[0], cy: C0[1], w: 120, rot: 25, feather: 70 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b);
      // exactly the inside of the glass ball this world sits in, so its edges disappear
      k.fill(L.rect(-40, -40, 1640, 1040), '#060a1c'); k.rad(L.rect(-40, -40, 1640, 1040), C0[0], C0[1], 1024, '#0c1430', 0.9, '#1a4a3a', 0.9);
      L.blend(P, 'lighter', () => { k.rad(L.ell(C0[0], C0[1], 760, 715, 90), C0[0], C0[1], 760, '#ffc860', 0.08, '#ffc860', 0, 380); k.rad(L.ell(C0[0], C0[1], 700, 660, 90), C0[0], C0[1], 700, '#ffb040', 0, '#ffb040', 0); });
      { const st = []; for (let i = 0; i < 700; i++) { const a = R(0, TAU), r = Math.sqrt(P.R()) * 620; st.push([C0[0] + Math.cos(a) * r, C0[1] + Math.sin(a) * r * 0.94, R(0.4, 1.2)]); } k.dots(st, '#8aa0d0', 0.25); }
      /* radial probability, sampled: P(r) = r^2 |R(r)|^2 */
      const sampler = (pdf, rmax) => { let pm = 0; for (let r = 0; r <= rmax; r += rmax / 400) pm = Math.max(pm, pdf(r)); return () => { for (let t = 0; t < 200; t++) { const r = R(0, rmax); if (P.R() * pm < pdf(r)) return r; } return rmax / 2; }; };
      const cloud = (n, rOf, angW, col, a, s0, s1, sq = 0.94) => { const pts = []; let tries = 0; while (pts.length < n && tries++ < n * 8) { const r = rOf(), t = R(0, TAU); if (angW && P.R() > angW(t)) continue; pts.push([C0[0] + Math.cos(t) * r, C0[1] + Math.sin(t) * r * sq, R(s0, s1)]); } L.blend(P, 'lighter', () => k.dots(pts, col, a)); };
      const a1 = 70, a2 = 58, ap = 62, a3 = 44;
      L.blend(P, 'lighter', () => { const ring = (r0, r1, col, a) => { const e = L.ell(C0[0], C0[1], r1, r1 * 0.94, 90); k.rad(e, C0[0], C0[1], r1, col, 0, col, 0, r0); k.rad(e, C0[0], C0[1], r1, col, a, col, 0, (r0 + r1) / 2); };
        ring(0, 600, '#ffc860', 0.1); k.rad(L.ell(C0[0], C0[1], 210, 200, 60), C0[0], C0[1], 210, '#b090ff', 0.5, '#b090ff', 0); ring(140, 420, '#5a8aff', 0.18);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ux, uy]) => { const c = [C0[0] + ux * 250, C0[1] + uy * 235], e = L.ell(c[0], c[1], ux ? 200 : 120, uy ? 190 : 110, 48); k.rad(e, c[0], c[1], 200, '#40e0d0', 0.32, '#40e0d0', 0); }); });
      cloud(22000, sampler(r => r * r * Math.pow(0.2 + (27 - 18 * r / a3 + 2 * (r / a3) ** 2) ** 2 / 729, 1) * Math.exp(-2 * r / (3 * a3)), 640), null, '#ffc860', 0.28, 0.5, 1.5);
      cloud(11000, sampler(r => r ** 4 * Math.exp(-r / ap), 520), t => Math.cos(t) ** 4, '#60f0e0', 0.34, 0.5, 1.5); cloud(11000, sampler(r => r ** 4 * Math.exp(-r / ap), 520), t => Math.sin(t) ** 4, '#60d8f0', 0.34, 0.5, 1.5); cloud(6000, sampler(r => r ** 4 * Math.exp(-r / ap), 520), null, '#50a8e0', 0.12, 0.6, 1.4);
      cloud(9000, sampler(r => r * r * (2 - r / a2) ** 2 * Math.exp(-r / a2), 460), null, '#7aa0ff', 0.34, 0.5, 1.5);
      cloud(8000, sampler(r => r * r * Math.exp(-2 * r / a1), 320), null, '#c8a8ff', 0.4, 0.5, 1.5);
      // nodes, where the electron never is
      [[2 * a2, '2S NODE'], [1.9 * a3, ''], [7.1 * a3, '3S NODE']].forEach(([r, t]) => { const c = L.ell(C0[0], C0[1], r, r * 0.94, 90); for (let i = 0; i < 90; i += 2) k.line(c[i], c[i + 1], 0.8, '#8ab0ff', 0.35); if (t) k.text(t, C0[0] + r * 0.72, C0[1] - r * 0.7 * 0.94, 8, '#8ab0ff', { a: 0.55 }); });
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ux, uy]) => { const lobe = []; for (let i = 0; i <= 40; i++) { const t = -Math.PI / 2 + Math.PI * i / 40, r = 380 * Math.pow(Math.cos(t), 2); lobe.push([C0[0] + (ux * Math.cos(t) - uy * Math.sin(t)) * r * (ux ? 1 : 0.94) , C0[1] + (uy * Math.cos(t) + ux * Math.sin(t)) * r * 0.94]); } for (let i = 0; i + 1 < lobe.length; i += 2) k.line(lobe[i], lobe[i + 1], 0.9, '#60f0e0', 0.35); });
      k.line([C0[0] - 700, C0[1]], [C0[0] + 700, C0[1]], 0.6, '#40e0d0', 0.12); k.line([C0[0], C0[1] - 500], [C0[0], C0[1] + 500], 0.6, '#40c8e8', 0.12);
      // the nucleus: a hot ball, and inside it, the night
      k.glow(C0[0], C0[1], NR * 3.2, '#ff9a60', 0.25); k.glow(C0[0], C0[1], NR * 1.6, '#ffd8a0', 0.4);
      const nuc = L.ell(C0[0], C0[1], NR, NR, 64); k.fill(nuc, '#02030a'); k.rad(nuc, C0[0], C0[1], NR, '#02030a', 1, '#2a1030', 1);
      // the margin
      const note = (s, x, y, sz = 14, c = '#b8c8ff', a = 0.75) => P.label(s, x, y, { size: sz, c, a });
      note('MG', 90, 120, 60, '#8aa0e0', 0.35); note('12 ELECTRONS, AS CLOUDS OF CHANCE', 94, 150, 13, '#8aa0e0', 0.6);
      note('1S2', 900, 390, 20, '#d0b8ff', 0.85); note('2S2', 1020, 290, 20, '#9ac0ff', 0.85); note('2P6', 1250, 516, 20, '#70f8e8', 0.85); note('3S2 - THE TWO IT LENDS TO THE RING', 1040, 106, 18, '#ffd070', 0.85);
      k.curve([[1060, 116], [980, 150], [940, 190]], 0.8, '#ffd070', 0.5); k.curve([[1248, 506], [1180, 480], [1100, 500]], 0.8, '#60f0e0', 0.5);
      note('NUCLEUS: 12 PROTONS, 12 NEUTRONS', 430, 744, 17, '#ffb890', 0.85); note('AND INSIDE IT, EVERYTHING ELSE', 430, 768, 17, '#ffb890', 0.85); k.curve([[640, 732], [700, 660], [740, 580]], 0.8, '#ffb890', 0.55); k.line([740, 580], [732, 592], 0.8, '#ffb890', 0.55); k.line([740, 580], [744, 594], 0.8, '#ffb890', 0.55);
      k.line([1340, 930], [1340 + 70, 930], 1.2, '#8aa0e0', 0.6); note('1 A', 1350, 920, 10, '#8aa0e0', 0.6);
    },
    over(P, cx) {
      // the nucleons ring the window, hiding its corners
      const k = L.kit(P, K, { rough: 0.05 }), R = (a, b) => P.r(a, b);
      for (let i = 0; i < 26; i++) { const a = i * TAU / 26 + R(-0.05, 0.05), r = NR - 6 + R(-3, 3), x = C0[0] + Math.cos(a) * r, y = C0[1] + Math.sin(a) * r, pr = i % 2 === 0, col = pr ? '#e84a4a' : '#9aa0b8', e = L.ell(x, y, 15, 15, 20); k.fill(e, col); k.rad(e, x - 5, y - 5, 20, '#ffffff', 0.6, L.shade(col, -0.5), 0.8); k.outline(e, 0.8, L.shade(col, -0.6), 0.8); if (pr) k.text('+', x - 3.4, y + 3.6, 9, '#ffffff', { a: 0.8 }); }
      L.blend(P, 'lighter', () => k.rad(L.ell(C0[0], C0[1], NR + 20, NR + 20, 48), C0[0], C0[1], NR + 20, '#ff9a60', 0, '#ff9a60', 0.35, NR - 10));
    }
  });
})();
