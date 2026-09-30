/* WORLD 12 — EARTH, AT NIGHT.
   From orbit, facing the dark side: continents traced in city light, clouds silver in moonlight, a green aurora
   along the limb, the thin blue skin of air. Where night meets day, the terminator burns orange, and under a gap in
   the sunset clouds there is a city at dusk. That is where we started. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#cfe0ff', EC = [760, 1760], ER = 1320, PC = [980, 720];
  const S = (() => { const v = [0.95, 0.1, -0.134], l = Math.hypot(...v); return v.map(x => x / l); })();
  const nrm = (x, y) => { const dx = (x - EC[0]) / ER, dy = (y - EC[1]) / ER, d2 = dx * dx + dy * dy; return d2 >= 1 ? null : [dx, dy, Math.sqrt(1 - d2)]; };

  Z.world({
    name: 'Earth, at night', scale: '12,000 km', seed: 1212, ink: K,
    portal: { cx: PC[0], cy: PC[1], w: 1600 / 9, rot: 0, feather: 60 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], add = (pts, col, a) => L.blend(P, 'lighter', () => k.dots(pts, col, a));
      const land = n => L.fbm(n[0] * 2.4 + 5, n[1] * 2.4 + n[2] * 1.3, 5, 21) + 0.18 * L.noise(n[0] * 9, n[1] * 9 + n[2] * 4, 3) - 0.09;
      /* ================================ the sky above the limb ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#020308');
      { const st = []; for (let i = 0; i < 3600; i++) st.push([R(-20, 1620), R(-20, 700), R(0.3, 1.1)]); k.dots(st, '#dfe6ff', 0.45); }
      L.blend(P, 'lighter', () => { const band = [[-40, -40], [1640, -400], [1640, 520], [-40, 880]]; k.lin(band, '#8a7ab8', 0.14, '#8a7ab8', 0, 800, 170, 860, 440); k.lin(band, '#8a7ab8', 0.14, '#8a7ab8', 0, 800, 170, 740, -100); const dust = []; for (let i = 0; i < 9000; i++) { const t = R(0, 1), x = lerp(-40, 1640, t), yc = lerp(300, 10, t), y = yc + (P.R() - 0.5) * 240; dust.push([x, y, R(0.3, 0.9)]); } k.dots(dust, '#e8dcff', 0.3); });
      L.blend(P, 'multiply', () => { const lane = []; for (let x = -40; x < 1640; x += 20) lane.push([x, lerp(300, 10, (x + 40) / 1680) + Math.sin(x / 90) * 20]); k.ink(lane, 26, '#3a2a40', 0.35); });
      // the Moon, and the space station crossing in sunlight
      { const mx = 1420, my = 150, mr = 26, lit = []; for (let i = 0; i <= 24; i++) { const t = -Math.PI / 2 + Math.PI * i / 24; lit.push([mx + mr * Math.cos(t), my + mr * Math.sin(t)]); } for (let i = 24; i >= 0; i--) { const t = -Math.PI / 2 + Math.PI * i / 24; lit.push([mx + mr * 0.2 * Math.cos(t), my + mr * Math.sin(t)]); } k.fill(L.ell(mx, my, mr, mr, 40), '#2a2e40'); k.fill(lit, '#f4f0e0'); k.glow(mx, my, 70, '#f4f0e0', 0.18); for (let i = 0; i < 8; i++) k.dot(mx + R(3, 20), my + R(-18, 18), R(1, 3), '#c8c4b0', 0.7); }
      { const ix = 380, iy = 290; k.line([ix - 16, iy], [ix + 16, iy], 1.4, '#c8c8c8'); [-14, -7, 7, 14].forEach(d => k.fill(L.rect(ix + d - 2.6, iy - 9, ix + d + 2.6, iy + 9), '#c89a3a')); k.fill(L.rect(ix - 4, iy - 2, ix + 4, iy + 2), '#f0f0f0'); k.glow(ix, iy, 10, '#ffffff', 0.6); for (let i = 1; i < 9; i++) k.dot(ix - i * 22, iy + i * 6, 0.9, '#ffffff', 0.5 - i * 0.05); }
      /* ================================ the planet ================================ */
      const disk = L.ell(EC[0], EC[1], ER, ER, 360); k.fill(disk, '#050a18');
      // the day side, its oceans and the long blue gradient into dark
      { const u = (() => { const a = Math.abs(S[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], d = a[0] * S[0] + a[1] * S[1] + a[2] * S[2], v = [a[0] - d * S[0], a[1] - d * S[1], a[2] - d * S[2]], l = Math.hypot(...v); return v.map(x => x / l); })(), v = [S[1] * u[2] - S[2] * u[1], S[2] * u[0] - S[0] * u[2], S[0] * u[1] - S[1] * u[0]];
        const term = []; for (let i = 0; i <= 720; i++) { const ph = i / 720 * TAU, n = [Math.cos(ph) * u[0] + Math.sin(ph) * v[0], Math.cos(ph) * u[1] + Math.sin(ph) * v[1], Math.cos(ph) * u[2] + Math.sin(ph) * v[2]]; if (n[2] > 0) term.push([EC[0] + n[0] * ER, EC[1] + n[1] * ER]); }
        const dayPoly = disk.filter(([x, y]) => { const n = [(x - EC[0]) / ER, (y - EC[1]) / ER, 0]; return n[0] * S[0] + n[1] * S[1] > 0; });
        if (term.length > 2) { const tsort = term.slice().sort((a, b) => a[1] - b[1]); const poly = tsort.concat(dayPoly.filter(([x, y]) => y > -200).sort((a, b) => b[1] - a[1])); k.fill(poly, '#2a5a9a', 0.9); }
        L.blend(P, 'lighter', () => { for (let w = 0; w < 14; w++) { const off = w * 7; k.ink(term.map(([x, y]) => [x - S[0] * off, y - S[1] * off]), 14, L.mix('#ffb060', '#6a3a8a', w / 13), 0.07 * (1 - w / 16)); } k.ink(term, 5, '#ffd090', 0.25); }); }
      // land, lights, clouds: a pointillist planet
      { const dayL = [], dayO = [], nightL = [], lights = [], lightsB = [], cloudD = [], cloudN = [], cloudT = [];
        for (let i = 0; i < 90000; i++) { const x = R(-20, 1620), y = R(430, 1020), n = nrm(x, y); if (!n) continue; const ld = land(n), sun = n[0] * S[0] + n[1] * S[1] + n[2] * S[2], cl = L.fbm(n[0] * 4 + L.noise(n[1] * 6, n[0] * 6, 5) * 1.2, n[1] * 5 + n[2] * 3, 4, 77);
          if (cl > 0.58) { (sun > 0.05 ? cloudD : sun > -0.08 ? cloudT : cloudN).push([x, y, R(0.8, 2.2)]); continue; }
          if (sun > 0) { (ld > 0.5 ? dayL : dayO).push([x, y, R(0.7, 1.8)]); } else if (ld > 0.5) { nightL.push([x, y, R(0.6, 1.4)]); const pop = Math.pow(L.noise(x / 38, y / 38, 9), 3) * 2.2; if (ld < 0.58 && P.R() < 0.75) lights.push([x, y, R(0.5, 1.4)]); else if (P.R() < pop) lightsB.push([x, y, R(0.6, 1.5)]); } }
        k.dots(dayO, '#3a78c0', 0.5); k.dots(dayL, '#8a9a5a', 0.7); k.dots(nightL, '#0c1424', 0.8); add(lights, '#ffc860', 0.85); add(lightsB, '#ffd890', 0.7); k.dots(cloudN, '#3a4a6a', 0.22); k.dots(cloudD, '#f4f6ff', 0.8); add(cloudT, '#ff9a6a', 0.45); }
      // a great city sprawled around the gap in the clouds, right on the line between night and day
      { const pts = []; for (let i = 0; i < 1400; i++) { const a = R(0, TAU), r = Math.pow(P.R(), 1.6) * 160, x = PC[0] + Math.cos(a) * r * 1.3 - 40, y = PC[1] + Math.sin(a) * r * 0.7; pts.push([x, y, R(0.6, 1.8)]); } add(pts, '#ffc860', 0.7); for (let i = 0; i < 9; i++) { const a = R(0, TAU), r0 = R(60, 260), road = []; for (let q = 0; q < 14; q++) { const r = lerp(r0 * 0.2, r0, q / 13); road.push([PC[0] + Math.cos(a + q * 0.02) * r * 1.3 - 40, PC[1] + Math.sin(a + q * 0.02) * r * 0.7]); } L.blend(P, 'lighter', () => k.ink(road, 1.4, '#ffb040', 0.5)); } }
      // the limb: a thin shell of air, blue by day, a green aurora curtain in the north
      L.blend(P, 'lighter', () => { const limb = L.ell(EC[0], EC[1], ER, ER, 360).filter(([x, y]) => y < 1060); k.ink(limb, 10, '#3a7aff', 0.35); k.ink(limb, 3, '#8ab8ff', 0.5); const out = L.ell(EC[0], EC[1], ER + 14, ER + 14, 360).filter(([x, y]) => y < 1060); k.ink(out, 18, '#2a4aa0', 0.18); });
      L.blend(P, 'lighter', () => { for (let i = 0; i < 140; i++) { const t = lerp(-2.25, -1.62, i / 140) + R(-0.004, 0.004), base = [EC[0] + Math.cos(t) * (ER - 10), EC[1] + Math.sin(t) * (ER - 10)], h = R(30, 90) * (0.6 + 0.4 * Math.sin(i * 0.3)), top = [EC[0] + Math.cos(t) * (ER + h), EC[1] + Math.sin(t) * (ER + h)]; k.lin([[base[0] - 4, base[1]], [top[0] - 4, top[1]], [top[0] + 4, top[1]], [base[0] + 4, base[1]]], '#40ff90', 0.22, '#ff60a0', 0, base[0], base[1], top[0], top[1]); } });
      // the edge of this world is the dark between the galaxy's arms
      k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 960, '#18142b', 0, '#18142b', 1, 520);
      P.label('HOME', 250, 560, { size: 22, c: '#9ab0e0', a: 0.55 }); P.label('ONE CITY UNDER A GAP IN THE CLOUDS, AT DUSK', 254, 588, { size: 11, c: '#9ab0e0', a: 0.5 });
    },
    over(P, cx) {
      // the gap: cumulus heaped around the way back in, lit orange from the sunset side, blue on the night side
      const k2 = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), pw = 1600 / 9, ph = 1000 / 9, puffs = [];
      for (let i = 0; i < 64; i++) { const t = i / 64 * TAU + R(-0.03, 0.03), ex = pw * 0.5 + R(-8, 26), ey = ph * 0.5 + R(-6, 22), c = [PC[0] + Math.cos(t) * ex * (1 + 0.25 * Math.abs(Math.sin(t))), PC[1] + Math.sin(t) * ey * (1 + 0.2 * Math.abs(Math.cos(t)))]; for (let q = 0; q < 3; q++) puffs.push([c[0] + R(-10, 10), c[1] + R(-8, 8), R(8, 19)]); }
      puffs.sort((a, b) => a[1] - b[1]);
      puffs.forEach(([x, y, r]) => k2.fill(L.blob(x - r * 0.5, y + r * 0.5, r, 12, 0.2, P.R, 0.75), '#05060e', 0.25));
      puffs.forEach(([x, y, r]) => { const b = L.blob(x, y, r, 14, 0.18, P.R, 0.78), day = Math.max(0, Math.min(1, (x - PC[0] + 60) / 180)); k2.fill(b, L.mix('#3a3e5e', '#b89aa8', day)); k2.rad(b, x + r * 0.55, y - r * 0.2, r * 1.5, L.mix('#8a8ab8', '#ffc098', day), 0.9, '#2a2a48', 0.2); k2.outline(b, 0.4, '#2a2a40', 0.25); });
      L.blend(P, 'lighter', () => { k2.glow(PC[0] + 80, PC[1] - 10, 190, '#ff9a5a', 0.14); puffs.forEach(([x, y, r]) => { if (x > PC[0]) k2.fill(L.ell(x + r * 0.45, y - r * 0.25, r * 0.4, r * 0.25, 10, -0.5), '#ffe0c0', 0.25); }); });
    }
  });
})();
