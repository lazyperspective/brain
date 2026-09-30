/* WORLD 8 — THE THYLAKOID MEMBRANE.
   In the manner of David Goodsell's molecular watercolours: a slice through one lamella, stroma above and below, the
   lumen in between, and the machines of photosynthesis bolted through the two membranes. Photosystem II splits water
   and lets oxygen go; cytochrome b6f pumps protons; photosystem I hands electrons to ferredoxin; ATP synthase spins.
   Out in the stroma, RuBisCO everywhere. Inside one light-harvesting complex, a single chlorophyll is the way on. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#1a2a1a';
  const UM = [325, 445], LM = [555, 675];      // upper and lower membranes
  const COL = { psii: '#5aa88a', lhc: '#8ac85a', b6f: '#d8904a', psi: '#3f8a5a', atpH: '#e87a7a', atpS: '#c85a8a', atpC: '#9a6ac8', oec: '#f0b050', rub: '#c8c060', fd: '#b85a3a', fnr: '#e8d060', pc: '#5a8ad8', rib: '#a07ab8', lipid: '#f0d8a0' };

  const MB = Z.lib.membrane = (() => {
    const proteins = [], stroma = [], rr = L.rng(8801);
    // where the complexes sit: [kind, x, membrane (0 upper / 1 lower)]
    const layout = [['psii', 210, 0], ['lhc', 450, 0], ['b6f', 640, 0], ['lhc', 760, 0], ['psi', 960, 0], ['atp', 1300, 0], ['lhc', 1500, 0], ['psi', 220, 1], ['atp', 560, 1], ['lhc', 760, 1], ['psii', 1020, 1], ['b6f', 1330, 1], ['lhc', 1520, 1]];
    layout.forEach(([kind, x, m]) => { const mid = m ? (LM[0] + LM[1]) / 2 : (UM[0] + UM[1]) / 2, w = { psii: 300, lhc: 130, b6f: 150, psi: 250, atp: 130 }[kind]; proteins.push({ kind, x, m, c: [x, mid], rx: w / 2, ry: 70, col: COL[kind === 'atp' ? 'atpC' : kind] }); if (kind === 'atp') proteins.push({ kind: 'atpH', x, m, c: [x, m ? 800 : 200], rx: 90, ry: 80, col: COL.atpH }); });
    for (let i = 0; i < 60; i++) { const x = rr() * 1600, y = rr() < 0.5 ? rr() * 300 : 700 + rr() * 300; stroma.push({ c: [x, y], r: 30 + rr() * 16, col: COL.rub }); }
    // the chlorophyll we go into: inside the first light-harvesting complex, upper membrane
    const PC = [452, 372];
    return { proteins, stroma, layout, PC, UM, LM };
  })();

  Z.world({
    name: 'The thylakoid membrane', scale: '100 nm', seed: 8808, ink: K,
    portal: { cx: MB.PC[0], cy: MB.PC[1], w: 64, rot: 15, feather: 300 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.15 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], chance = p => P.R() < p;
      const occ = []; const free = (x, y, r) => occ.every(([ox, oy, or]) => Math.hypot(ox - x, oy - y) > or + r); const take = (x, y, r) => occ.push([x, y, r]);
      const blob = (x, y, rx, ry, col, o = {}) => { const b = L.blob(x, y, rx, o.n ?? 14, o.j ?? 0.12, P.R, ry / rx).map(([px, py]) => o.rot ? [x + (px - x) * Math.cos(o.rot) - (py - y) * Math.sin(o.rot), y + (px - x) * Math.sin(o.rot) + (py - y) * Math.cos(o.rot)] : [px, py]); const S = P.sample(b, true, 3); k.fill(S, col); k.rad(S, x - rx * 0.35, y - ry * 0.4, Math.max(rx, ry) * 1.3, '#ffffff', o.hl ?? 0.35, col, 0); k.outline(S, o.w ?? 1.1, L.shade(col, -0.45), 0.85); return S; };
      const cluster = (x, y, w, h, col, n, o = {}) => { for (let i = 0; i < n; i++) blob(x + R(-w / 2, w / 2) * 0.8, y + R(-h / 2, h / 2) * 0.8, R(w * 0.18, w * 0.32), R(h * 0.2, h * 0.34), L.shade(col, R(-0.08, 0.1)), o); take(x, y, Math.max(w, h) / 2); };

      /* ================================ the three waters: stroma, lumen, stroma ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#dde8b4'); k.fill(L.rect(-40, UM[1], 1640, LM[0]), '#b8d8a8');
      { const w = []; for (let i = 0; i < 5000; i++) w.push([R(-20, 1620), R(-20, 1020), R(1, 2.4)]); k.dots(w, '#b8c8d8', 0.35); }
      // the membranes themselves: lipid heads in two rows, tails between
      const bilayer = ([y0, y1]) => { k.fill(L.rect(-40, y0, 1640, y1), '#f4e8b8'); k.fill(L.rect(-40, y0 + 22, 1640, y1 - 22), '#e8d890', 0.8); for (let x = -30; x < 1640; x += 11) { [[y0 + 9, 1], [y1 - 9, -1]].forEach(([hy, d]) => { const hx = x + R(-2, 2); k.ink([[hx - 2, hy + d * 8], [hx - 3 + R(-2, 2), hy + d * 24], [hx - 2 + R(-3, 3), hy + d * 42]], 1.1, '#c8b060', 0.8); k.ink([[hx + 2, hy + d * 8], [hx + 3 + R(-2, 2), hy + d * 24], [hx + 2 + R(-3, 3), hy + d * 44]], 1.1, '#c8b060', 0.8); k.fill(L.ell(hx, hy, 5.8, 6.2, 12), COL.lipid); k.outline(L.ell(hx, hy, 5.8, 6.2, 12), 0.7, '#a88a40', 0.9); k.dot(hx - 1.6, hy - 1.8, 1.6, '#ffffff', 0.6); }); } };
      bilayer(UM); bilayer(LM);

      /* ================================ the machines ================================ */
      const psii = (x, m) => { const d = m ? -1 : 1, M0 = m ? LM : UM, midY = (M0[0] + M0[1]) / 2; k.fill(L.rect(x - 150, M0[0] + 4, x + 150, M0[1] - 4), '#f4e8b8'); cluster(x, midY, 300, 120, COL.psii, 16); for (let i = 0; i < 26; i++) { const cx2 = x + R(-130, 130), cy2 = midY + R(-40, 40); k.fill(L.rect(cx2 - 4, cy2 - 4, cx2 + 4, cy2 + 4), '#2f8a3a', 0.9); k.line([cx2 + 4, cy2], [cx2 + 14, cy2 + R(-8, 8)], 0.8, '#6a8a3a', 0.8); }
        const ly = m ? M0[0] : M0[1]; [-70, 70].forEach(dx => { blob(x + dx, ly + d * 40, 50, 40, COL.oec); blob(x + dx + d * 20, ly + d * 70, 30, 24, '#f0c878'); blob(x + dx - 26, ly + d * 60, 22, 20, '#e8a860'); }); const mn = [x, ly + d * 30]; [[0, 0], [8, 4], [-6, 6], [4, -6]].forEach(([a, b]) => k.dot(mn[0] + a, mn[1] + b, 3.4, '#8a3ab0')); k.dot(mn[0] + 12, mn[1] - 2, 3, '#e05050'); blob(x - 20, (m ? M0[1] : M0[0]) - d * 26, 70, 26, L.shade(COL.psii, 0.1)); };
      const lhc = (x, m, isPortal) => { const M0 = m ? LM : UM, midY = (M0[0] + M0[1]) / 2; k.fill(L.rect(x - 64, M0[0] + 4, x + 64, M0[1] - 4), '#f4e8b8'); for (let t = 0; t < 3; t++) { const a = t * TAU / 3 + 0.3; blob(x + Math.cos(a) * 30, midY + Math.sin(a) * 26, 42, 52, L.shade(COL.lhc, (t - 1) * 0.06)); } take(x, midY, 64);
        for (let i = 0; i < 22; i++) { const px = x + R(-50, 50), py = midY + R(-48, 48); if (isPortal && Math.hypot(px - MB.PC[0], py - MB.PC[1]) < 30) continue; const a = R(0, TAU), hd = L.rot(L.rect(px - 5, py - 5, px + 5, py + 5), px, py, a); k.fill(hd, '#1f7a2a'); k.dot(px, py, 1.6, '#c8e0a8'); k.curve([[px + Math.cos(a) * 5, py + Math.sin(a) * 5], [px + Math.cos(a + 0.4) * 14, py + Math.sin(a + 0.4) * 14], [px + Math.cos(a) * 22, py + Math.sin(a) * 22]], 0.9, '#8a9a4a', 0.8); }
        for (let i = 0; i < 5; i++) { const px = x + R(-44, 44), py = midY + R(-44, 44); k.fill(L.ell(px, py, 7, 3, 10, R(0, TAU)), '#f0a020', 0.9); } };
      const b6f = (x, m) => { const d = m ? -1 : 1, M0 = m ? LM : UM, midY = (M0[0] + M0[1]) / 2; k.fill(L.rect(x - 75, M0[0] + 4, x + 75, M0[1] - 4), '#f4e8b8'); cluster(x, midY, 150, 120, COL.b6f, 10); const ly = m ? M0[0] : M0[1]; [-36, 36].forEach(dx => blob(x + dx, ly + d * 36, 32, 28, '#e8b060')); [[x - 20, midY - 10], [x + 24, midY + 14]].forEach(([hx, hy]) => { k.fill(L.rect(hx - 6, hy - 6, hx + 6, hy + 6), '#b8302a'); k.dot(hx, hy, 2.4, '#f0a040'); }); blob(x, (m ? M0[1] : M0[0]) - d * 20, 40, 20, L.shade(COL.b6f, 0.12)); };
      const psi = (x, m) => { const d = m ? -1 : 1, M0 = m ? LM : UM, midY = (M0[0] + M0[1]) / 2; k.fill(L.rect(x - 125, M0[0] + 4, x + 125, M0[1] - 4), '#f4e8b8'); cluster(x, midY, 250, 120, COL.psi, 14); for (let i = 0; i < 30; i++) { const cx2 = x + R(-110, 110), cy2 = midY + R(-42, 42); k.fill(L.rect(cx2 - 4, cy2 - 4, cx2 + 4, cy2 + 4), '#1f6a2a', 0.9); }
        const sy = m ? M0[1] : M0[0]; blob(x - 30, sy - d * 34, 44, 30, '#5a9a6a'); blob(x + 24, sy - d * 46, 36, 26, '#6aaa7a'); blob(x + 70, sy - d * 30, 30, 24, '#4a8a5a'); const fe = [x + 20, sy - d * 44]; [[0, 0], [5, 3], [-3, 5], [3, -4]].forEach(([a, b]) => k.dot(fe[0] + a, fe[1] + b, 2.6, '#e8c040')); blob(x + 40, sy - d * 90, 26, 22, COL.fd); [[0, 0], [5, 3]].forEach(([a, b]) => k.dot(x + 40 + a, sy - d * 90 + b, 2.8, '#f0d040')); blob(x - 80, sy - d * 80, 44, 34, COL.fnr); blob(x - 80, sy - d * 80, 16, 12, '#f8f0a0'); };
      const atp = (x, m) => { const d = m ? -1 : 1, M0 = m ? LM : UM, midY = (M0[0] + M0[1]) / 2; k.fill(L.rect(x - 64, M0[0] + 4, x + 64, M0[1] - 4), '#f4e8b8'); for (let i = 0; i < 14; i++) { const t = i / 13, bx = x - 56 + t * 112; blob(bx, midY, 11, 50, L.shade(COL.atpC, (i % 2) * 0.1), { j: 0.05 }); } take(x, midY, 64); blob(x + 80, midY + 10, 22, 56, '#b88ad0');
        const sy = m ? M0[1] : M0[0], hy = sy - d * 150; k.fill(L.rect(x - 9, Math.min(sy, hy), x + 9, Math.max(sy, hy)), '#8a4a9a'); k.outline(L.rect(x - 9, Math.min(sy, hy), x + 9, Math.max(sy, hy)), 1, '#5a2a6a'); blob(x, sy - d * 30, 24, 16, '#9a5aa8'); k.fill(L.rect(x + 86, Math.min(sy, hy - d * 60), x + 96, Math.max(sy, hy - d * 60)), '#c898d8'); k.outline(L.rect(x + 86, Math.min(sy, hy - d * 60), x + 96, Math.max(sy, hy - d * 60)), 1, '#7a4a8a');
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6, bx = x + Math.cos(a) * 46, by = hy - d * 10 + Math.sin(a) * 30; blob(bx, by, 36, 34, i % 2 ? COL.atpH : '#f09a8a'); } blob(x, hy - d * 60, 30, 22, '#f0b0a0'); take(x, hy, 100);
        const arc = []; for (let i = 0; i <= 16; i++) { const a = -Math.PI * 0.8 + i / 16 * Math.PI * 0.9; arc.push([x + Math.cos(a) * 110, hy + d * 10 + Math.sin(a) * 60 * d]); } k.ink(arc, 1.4, '#a04a6a', 0.6); const e = arc[arc.length - 1]; k.line(e, [e[0] - 10, e[1] - 4 * d], 1.4, '#a04a6a', 0.6); k.line(e, [e[0] - 2, e[1] - 10 * d], 1.4, '#a04a6a', 0.6); };
      MB.layout.forEach(([kind, x, m]) => { if (kind === 'psii') psii(x, m); else if (kind === 'lhc') lhc(x, m, x === 450 && !m); else if (kind === 'b6f') b6f(x, m); else if (kind === 'psi') psi(x, m); else atp(x, m); });
      // plastoquinone ferrying electrons through the oily middle
      [UM, LM].forEach(M0 => { for (let i = 0; i < 16; i++) { const x = R(0, 1600), y = (M0[0] + M0[1]) / 2 + R(-20, 20); if (!free(x, y, 8)) continue; k.fill(L.rect(x - 5, y - 5, x + 5, y + 5), '#e8c040'); k.outline(L.rect(x - 5, y - 5, x + 5, y + 5), 0.7, '#8a6a10'); k.curve([[x + 5, y], [x + 16, y + R(-6, 6)], [x + 30, y + R(-6, 6)]], 1, '#b8a040', 0.8); } });

      /* ================================ the lumen: water, protons, plastocyanin, oxygen escaping ================================ */
      for (let i = 0; i < 60; i++) { const x = R(20, 1580), y = R(UM[1] + 18, LM[0] - 18); if (!free(x, y, 20)) continue; blob(x, y, 18, 15, chance(0.6) ? COL.pc : pick(['#a8c8e8', '#c8b8e0', '#e8d0b0'])); if (chance(0.6)) k.dot(x + 2, y, 3.4, '#40c0c0'); take(x, y, 18); }
      for (let i = 0; i < 140; i++) { const x = R(0, 1600), y = R(UM[1] + 8, LM[0] - 8); if (!free(x, y, 5)) continue; if (chance(0.3)) { k.dot(x, y, 3.4, '#e04848'); k.text('+', x + 5, y - 2, 5, '#c02020'); } else { k.dot(x, y, 3.2, '#e04848', 0.9); k.dot(x - 4, y + 3, 2, '#ffffff', 0.9); k.dot(x + 4, y + 3, 2, '#ffffff', 0.9); } }
      [[190, 520], [240, 540], [1030, 490]].forEach(([x, y]) => { k.dot(x - 5, y, 5, '#e04848'); k.dot(x + 5, y, 5, '#e04848'); k.dot(x - 6.4, y - 1.4, 1.6, '#ffffff', 0.7); });

      /* ================================ the stroma: RuBisCO, ferredoxin, ribosomes on a messenger ================================ */
      const rubisco = (x, y) => { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; blob(x + Math.cos(a) * 20, y + Math.sin(a) * 16, 16, 15, i % 2 ? COL.rub : '#d8d070', { hl: 0.25, w: 0.9 }); } blob(x, y, 14, 12, '#e8e098', { w: 0.8 }); take(x, y, 38); };
      const ribosome = (x, y) => { blob(x, y + 20, 60, 42, '#8a6aa8'); blob(x - 6, y - 26, 44, 32, '#b89ad0'); take(x, y, 64); };
      { const mr = []; for (let x = -20; x < 1640; x += 12) mr.push([x, 900 + Math.sin(x / 70) * 22]); k.ink(mr, 2.2, '#5a4a8a', 0.9); [200, 520, 840, 1160].forEach(x => ribosome(x, 870 + Math.sin(x / 70) * 22)); }
      MB.stroma.forEach(m => { const [x, y] = m.c; if (free(x, y, 38)) rubisco(x, y); });
      for (let i = 0; i < 900; i++) { const x = R(0, 1600), y = chance(0.5) ? R(0, UM[0] - 10) : R(LM[1] + 10, 1000); if (!free(x, y, 16)) continue; const t = P.R(); if (t < 0.3) blob(x, y, 14, 12, COL.fd); else if (t < 0.5) blob(x, y, 22, 18, COL.fnr); else if (t < 0.75) { k.fill(L.ell(x, y, 8, 5, 10, R(0, TAU)), '#e8a0c0'); k.outline(L.ell(x, y, 8, 5, 10), 0.6, '#8a4a6a'); for (let q = 0; q < 3; q++) k.dot(x + 8 + q * 5, y + R(-2, 2), 2.4, '#f0c040'); } else blob(x, y, R(10, 20), R(9, 16), pick(['#a8c8a0', '#c8b0d8', '#b8d0e0', '#e0c8a8'])); take(x, y, 16); }
      { const d = []; for (let i = 0; i < 4000; i++) { const x = R(-20, 1620), y = R(-20, 1020); if ((y > UM[0] - 4 && y < UM[1] + 4) || (y > LM[0] - 4 && y < LM[1] + 4)) continue; d.push([x, y, R(1.2, 2.6)]); } k.dots(d, '#9aa89a', 0.4); }
      // labels, small, as in a textbook margin
      [['PHOTOSYSTEM II', 210, 300], ['CYT B6F', 640, 300], ['PHOTOSYSTEM I', 960, 300], ['ATP SYNTHASE', 1300, 44], ['LUMEN', 800, 505], ['STROMA', 110, 40], ['RUBISCO', 700, 250]].forEach(([t, x, y]) => k.text(t, x, y, 10, '#4a5a4a', { align: 'center', a: 0.55 }));
      k.text('H2O > O2', 190, 590, 8, '#a02020', { align: 'center', a: 0.6 });
      L.blend(P, 'multiply', () => k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 1100, '#ffffff', 0, '#9a8aa0', 0.35));
    }
  });
})();
