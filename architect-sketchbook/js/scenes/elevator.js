/* SHEET 4 — Space elevator (graphite only, drawn on a logarithmic altitude axis) */
(window.SCENES = window.SCENES || []).push({
  name: 'Space Elevator', seed: 41, ink: '#23262e',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp;
    P.frame('SPACE ELEVATOR', 'OCEAN ANCHOR TO GEO', n, t, { scale: 'ALTITUDE AXIS  LOG', note: 'graphite; nothing here is to scale' });
    const CX = 560, SY = 850;
    const Y = alt => SY - Math.log10(1 + alt / 10) / 4 * 760;
    const stY = Y(35786);

    /* ---------- stars, moon, plotted constellation ---------- */
    for (let i = 0; i < 70; i++) {
      const x = P.r(60, 1140), y = P.r(56, 620);
      if (Math.abs(x - CX) < 60 || Math.abs(x - 250) < 10) continue;
      const s = P.r(1.5, 3.4);
      if (P.R() > 0.55) { P.line(x - s, y, x + s, y, { w: 0.6, a: 0.6, passes: 1, over: 0, rough: 0.1 }); P.line(x, y - s, x, y + s, { w: 0.6, a: 0.6, passes: 1, over: 0, rough: 0.1 }); }
      else P.dot(x, y, P.r(0.7, 1.3), { a: 0.7 });
    }
    { const dip = [[830, 96], [858, 108], [884, 112], [908, 122], [910, 148], [948, 150], [960, 122]];
      dip.forEach(([x, y], i) => { P.circle(x, y, 2.2, { w: 0.7, passes: 1 }); if (i) P.line(dip[i - 1][0], dip[i - 1][1], x, y, { w: 0.4, a: 0.35, passes: 1, over: -2, rough: 0.2 }); });
      P.line(908, 122, 948, 150, { w: 0.4, a: 0.35, passes: 1 }); }
    // moon
    { const mx = 116, my = 176, r = 34;
      P.circle(mx, my, r, { w: 1.3 });
      [[-10, -8, 8], [9, 4, 6], [-6, 14, 5], [14, -12, 4], [-18, 6, 4]].forEach(([dx, dy, rr]) => { P.circle(mx + dx, my + dy, rr, { w: 0.6, a: 0.7, passes: 1 }); P.arc(mx + dx, my + dy, rr * 0.8, rr * 0.8, 0.3, 2.4, { w: 0.4, a: 0.5, passes: 1 }); });
      const disk = []; for (let a = 0; a < 40; a++) disk.push([mx + Math.cos(a * TAU / 40) * r, my + Math.sin(a * TAU / 40) * r]);
      P.hatch(disk, { ang: -50, gap: 2.6, a: 0.6, fade: (x, y) => Math.max(0, (x - mx + 6) / 34), piece: 8 });
    }

    /* ---------- the altitude ruler (logarithmic) & orbit lines ---------- */
    P.line(250, SY, 250, Y(100000), { w: 1, rough: 0.4 });
    for (let k = 0; k <= 4; k++) for (let d = 1; d <= 9; d++) {
      const alt = d * Math.pow(10, k); if (alt > 100000) continue;
      P.line(250, Y(alt), 250 + (d === 1 ? 14 : 7), Y(alt), { w: d === 1 ? 1.2 : 0.7, a: 0.85, passes: 1, over: 0, rough: 0.15 });
    }
    P.line(250, Y(100000), 264, Y(100000), { w: 1.2, passes: 1, over: 0 });
    [[10, '10'], [100, '100'], [1000, '1,000'], [10000, '10,000'], [100000, '100,000']].forEach(([a, l]) => P.text(l, 242, Y(a) + 4, { size: 14, align: 'right', font: S.HAND }));
    P.text('KM', 228, Y(100000) - 14, { size: 13, align: 'right', font: S.HAND });
    // van allen belt band
    { const yb = Y(6000), ya = Y(1000);
      P.hatch([[264, yb], [900, yb], [900, ya], [264, ya]], { ang: -20, gap: 4.5, a: 0.22, w: 0.45, piece: 30, fade: () => 0.85, ragged: 2 });
      P.line(264, yb, 900, yb, { w: 0.5, a: 0.4, passes: 1, rough: 0.6 }); P.line(264, ya, 900, ya, { w: 0.5, a: 0.4, passes: 1, rough: 0.6 });
      P.text('VAN ALLEN RADIATION BELT', 596, yb + 24, { size: 15, a: 0.8 }); P.text('CLIMBERS MUST BE SHIELDED', 596, yb + 42, { size: 15, a: 0.8 });
    }
    const rows = [[0, 'SEA LEVEL'], [10, '10 km  AIRLINERS'], [100, '100 km  KARMAN LINE'], [408, '408 km  ISS'], [2000, '2,000 km  LOW ORBIT ENDS'], [20200, '20,200 km  GPS'], [35786, '35,786 km  GEOSTATIONARY'], [100000, '100,000 km  COUNTERWEIGHT']];
    rows.forEach(([a, l], i) => {
      const y = Y(a); if (a === 0) return;
      const x1 = a === 100000 ? 620 : 268;
      P.dashed(x1, y, 880, y, [10, 6], { w: 0.6, a: 0.5 });
      P.text(l, 892, y + 5, { size: 16, a: 0.85 });
    });
    P.text('SEA LEVEL', 268, SY + 14, { size: 14, a: 0.8 });

    /* ---------- ribbon tether ---------- */
    const rTop = stY + 18, rBot = 790;
    P.line(CX - 4, rTop, CX - 4, rBot, { w: 1.3, rough: 0.35, passes: 2 }); P.line(CX + 4, rTop, CX + 4, rBot, { w: 1.3, rough: 0.35, passes: 2 });
    for (let y = rTop + 4; y < rBot - 4; y += 6) { P.line(CX - 4, y, CX + 4, y + 6, { w: 0.4, a: 0.5, passes: 1, over: 0, rough: 0.1 }); if (Math.floor(y / 6) % 2) P.line(CX + 4, y, CX - 4, y + 6, { w: 0.4, a: 0.4, passes: 1, over: 0, rough: 0.1 }); }
    P.hatch([[CX + 1, rTop], [CX + 4, rTop], [CX + 4, rBot], [CX + 1, rBot]], { ang: 80, gap: 1.6, a: 0.55, w: 0.4, inset: 0 });
    // upper tether to the counterweight
    const astY = 76;
    P.line(CX - 2, astY + 34, CX - 2, stY - 20, { w: 1.1, rough: 0.35 }); P.line(CX + 2, astY + 34, CX + 2, stY - 20, { w: 1.1, rough: 0.35 });

    /* ---------- earth limb, atmosphere & ocean ---------- */
    const CY = 1580, R0 = 720;
    const limb = (r, o) => {
      let run = [];
      const flush = () => { if (run.length > 3) P.path(run, o); run = []; };
      for (let a = Math.PI; a <= TAU + 0.001; a += 0.006) {
        const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
        if (x > 60 && x < 1140 && y < 952) run.push([x, y]); else flush();
      }
      flush();
    };
    limb(R0, { w: 2, rough: 0.6, passes: 2 });
    [8, 15, 24, 36].forEach((d, i) => limb(R0 + d, { w: 0.7, a: 0.55 - i * 0.12, rough: 0.5 }));
    for (let k = 1; k < 24; k++) limb(R0 - k * 4.2 - k * k * 0.06, { w: 0.5, a: 0.5 - k * 0.018, rough: 0.7 });
    // clouds along the limb
    for (let i = 0; i < 16; i++) {
      const a = Math.PI + 0.62 + i * 0.062 + P.r(0, 0.03), r = R0 - 6 - P.r(0, 28), x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
      if (y > 948) continue; const w = P.r(20, 46);
      P.curve([[x - w / 2, y + 2], [x - w / 4, y - 5], [x, y - 7], [x + w / 3, y - 4], [x + w / 2, y + 2]], { w: 0.8, a: 0.7, rough: 0.5 });
    }
    // ocean platform
    { const px = CX, py = 857;
      P.erase([[px - 90, py - 78], [px + 90, py - 78], [px + 90, py + 2], [px - 90, py + 2]]);
      P.line(px - 76, py - 20, px + 76, py - 20, { w: 1.5, rough: 0.3 }); P.line(px - 76, py - 26, px + 76, py - 26, { w: 1.1, rough: 0.3 });
      P.line(px - 76, py - 26, px - 76, py - 20, { w: 1, passes: 1 }); P.line(px + 76, py - 26, px + 76, py - 20, { w: 1, passes: 1 });
      [-56, -18, 18, 56].forEach(dx => { P.line(px + dx - 3, py - 20, px + dx - 3, py - 4, { w: 1.1, passes: 1, rough: 0.2 }); P.line(px + dx + 3, py - 20, px + dx + 3, py - 4, { w: 1.1, passes: 1, rough: 0.2 }); P.line(px + dx - 3, py - 20, px + dx + 3, py - 4, { w: 0.5, a: 0.7, passes: 1, over: 0 }); });
      [[-78, -40], [40, 78]].forEach(([a, b]) => { P.rrect(px + a, py - 8, b - a, 10, 5, { w: 1.1 }); P.hatch([[px + a + 4, py - 6], [px + b - 4, py - 6], [px + b - 4, py], [px + a + 4, py]], { ang: 30, gap: 2.2, a: 0.5, w: 0.4 }); });
      // mast (lattice)
      const mt = 796; P.line(px - 16, py - 26, px - 5, mt, { w: 1.4, rough: 0.3 }); P.line(px + 16, py - 26, px + 5, mt, { w: 1.4, rough: 0.3 });
      for (let y = py - 26; y > mt + 4; y -= 10) { const w0 = lerp(5, 16, (y - mt) / (py - 26 - mt)), w1 = lerp(5, 16, (y - 10 - mt) / (py - 26 - mt)); P.line(px - w0, y, px + w1, y - 10, { w: 0.45, a: 0.7, passes: 1, over: 0, rough: 0.1 }); P.line(px + w0, y, px - w1, y - 10, { w: 0.45, a: 0.7, passes: 1, over: 0, rough: 0.1 }); P.line(px - w0, y, px + w0, y, { w: 0.5, a: 0.5, passes: 1, over: 0, rough: 0.1 }); }
      P.circle(px, mt - 2, 7, { w: 1.2, passes: 1 }); P.line(px - 5, mt + 3, px + 5, mt + 3, { w: 1, passes: 1, over: 0 });
      // stays
      [-70, -44, 44, 70].forEach(dx => P.line(px, mt + 6, px + dx, py - 26, { w: 0.5, a: 0.65, passes: 1, over: 0, rough: 0.25 }));
      // helipad, crane, tiny ship
      P.ellipse(px + 56, py - 30, 15, 3, { w: 0.9, passes: 1 }); P.text('H', px + 56, py - 27, { size: 8, align: 'center', a: 0.7 });
      P.line(px - 62, py - 26, px - 62, py - 60, { w: 0.9, passes: 1 }); P.line(px - 62, py - 60, px - 34, py - 44, { w: 0.9, passes: 1 }); P.line(px - 34, py - 44, px - 34, py - 36, { w: 0.5, passes: 1, over: 0 });
      P.hatch([[px - 16, py - 26], [px + 16, py - 26], [px + 5, 796], [px + 1, 796]], { ang: 80, gap: 2, a: 0.5, w: 0.4 });
      // ship beside
      const sx = px + 130; P.pl([[sx - 24, py - 6], [sx + 26, py - 6], [sx + 20, py + 0], [sx - 20, py + 0]], { w: 1.1, closed: true }); P.rect(sx - 14, py - 14, 12, 8, { w: 0.8 }); P.line(sx + 4, py - 6, sx + 4, py - 20, { w: 0.7, passes: 1, over: 0 });
    }
    // ribbon lower attach + label
    P.line(CX - 5, 790, CX - 3, 796, { w: 1, passes: 1, over: 0 });

    /* ---------- climbers ---------- */
    const climber = (cx, cy, s = 1) => {
      const w = 15 * s, h = 19 * s, body = [[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h]];
      P.erase(body);
      P.rrect(cx - w, cy - h, w * 2, h * 2, 5 * s, { w: 1.3 });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { P.circle(cx + a * 8 * s, cy + b * 9 * s, 4.6 * s, { w: 0.9, passes: 1 }); P.dot(cx + a * 8 * s, cy + b * 9 * s, 1, {}); });
      P.line(cx - 4, cy - h, cx - 4, cy + h, { w: 0.9, passes: 1, over: 0, rough: 0.1 }); P.line(cx + 4, cy - h, cx + 4, cy + h, { w: 0.9, passes: 1, over: 0, rough: 0.1 });
      P.rrect(cx - 10 * s, cy - h - 12 * s, 20 * s, 12 * s, 4 * s, { w: 1.1 }); P.circle(cx, cy - h - 6 * s, 2.6 * s, { w: 0.7, passes: 1 });
      const skirt = [[cx - 9 * s, cy + h], [cx + 9 * s, cy + h], [cx + 24 * s, cy + h + 32 * s], [cx - 24 * s, cy + h + 32 * s]];
      P.poly(skirt, { w: 1, rough: 0.3 });
      for (let i = 1; i < 5; i++) { const f = i / 5; P.line(lerp(cx - 9 * s, cx - 24 * s, f), lerp(cy + h, cy + h + 32 * s, f), lerp(cx + 9 * s, cx + 24 * s, f), lerp(cy + h, cy + h + 32 * s, f), { w: 0.4, a: 0.6, passes: 1, over: 0, rough: 0.1 }); }
      for (let i = 1; i < 6; i++) { const f = i / 6; P.line(lerp(cx - 9 * s, cx + 9 * s, f), cy + h, lerp(cx - 24 * s, cx + 24 * s, f), cy + h + 32 * s, { w: 0.4, a: 0.6, passes: 1, over: 0, rough: 0.1 }); }
      P.hatch(skirt, { ang: 50, gap: 2.6, a: 0.5, w: 0.4 });
      P.hatch([[cx + 4, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx + 4, cy + h]], { ang: 70, gap: 2, a: 0.5, w: 0.4 });
    };
    climber(CX, 700); climber(CX, 604); climber(CX, 352); climber(CX, 268);
    P.dashed(CX, 860, CX, 740, [3, 6], { w: 0.8, a: 0.6 }); // laser beam, dotted
    P.text('LASER', CX + 34, 770, { size: 14, a: 0.8 }); P.text('BEAM', CX + 34, 786, { size: 14, a: 0.8 });

    /* ---------- GEO station ---------- */
    { const sy = stY, cx = CX;
      P.erase([[cx - 20, sy - 60], [cx + 20, sy - 60], [cx + 20, sy + 28], [cx - 20, sy + 28]]);
      // hub
      P.rrect(cx - 15, sy - 46, 30, 72, 6, { w: 1.6 }); P.line(cx - 15, sy - 18, cx + 15, sy - 18, { w: 0.9, passes: 1 }); P.line(cx - 15, sy + 8, cx + 15, sy + 8, { w: 0.9, passes: 1 });
      P.rect(cx - 8, sy - 58, 16, 12, { w: 1.1, rough: 0.3 }); P.rect(cx - 6, sy + 26, 12, 8, { w: 1.1, rough: 0.3 });
      // ring habitat (seen at an angle) — front and back halves
      P.arc(cx, sy - 5, 70, 17, 0.05, Math.PI - 0.05, { w: 1.8 }); P.arc(cx, sy - 5, 60, 13, 0.05, Math.PI - 0.05, { w: 1.1 });
      P.arc(cx, sy - 5, 70, 17, Math.PI + 0.05, TAU - 0.05, { w: 1, a: 0.5 }); P.arc(cx, sy - 5, 60, 13, Math.PI + 0.05, TAU - 0.05, { w: 0.6, a: 0.4 });
      P.line(cx - 70, sy - 5, cx - 60, sy - 5, { w: 1, passes: 1, over: 0 }); P.line(cx + 70, sy - 5, cx + 60, sy - 5, { w: 1, passes: 1, over: 0 });
      for (let a = 0.35; a < Math.PI - 0.2; a += 0.3) P.line(cx + Math.cos(a) * 60, sy - 5 + Math.sin(a) * 13, cx + Math.cos(a) * 70, sy - 5 + Math.sin(a) * 17, { w: 0.5, a: 0.6, passes: 1, over: 0, rough: 0.1 });
      for (let a = 0.45; a < Math.PI - 0.3; a += 0.48) P.rrect(cx + Math.cos(a) * 65 - 3, sy - 5 + Math.sin(a) * 15 - 2, 6, 4, 1.5, { w: 0.5, passes: 1 });
      P.line(cx - 15, sy - 5, cx - 60, sy - 5, { w: 0.9, a: 0.8, rough: 0.2 }); P.line(cx + 15, sy - 5, cx + 60, sy - 5, { w: 0.9, a: 0.8, rough: 0.2 });
      // solar wings
      [-1, 1].forEach(sg => {
        const x0 = cx + sg * 84, x1 = cx + sg * 210;
        P.line(cx + sg * 15, sy - 32, x0, sy - 32, { w: 0.9, rough: 0.2 });
        [[sy - 60, sy - 40], [sy - 36, sy - 16]].forEach(([a, b]) => {
          const pa = [[Math.min(x0, x1), a], [Math.max(x0, x1), a], [Math.max(x0, x1), b], [Math.min(x0, x1), b]];
          P.poly(pa, { w: 1.1, rough: 0.3 });
          for (let x = Math.min(x0, x1) + 20; x < Math.max(x0, x1); x += 20) P.line(x, a, x, b, { w: 0.4, a: 0.6, passes: 1, over: 0, rough: 0.1 });
          P.line(Math.min(x0, x1), (a + b) / 2, Math.max(x0, x1), (a + b) / 2, { w: 0.4, a: 0.5, passes: 1, over: 0, rough: 0.1 });
          P.hatch(pa, { ang: 60, gap: 3.2, a: 0.32, w: 0.4, fade: () => 0.7, piece: 14 });
        });
        P.line(x0, sy - 32, x0, sy - 36, { w: 1, passes: 1, over: 0 }); P.line(x0, sy - 32, x0, sy - 40, { w: 1, passes: 1, over: 0 });
      });
      // dish & thrusters & docked shuttle
      [[-30, 30], [30, 30]].forEach(([dx, dy]) => { P.pl([[cx + dx - 4, sy + dy - 8], [cx + dx + 4, sy + dy - 8], [cx + dx + 7, sy + dy + 2], [cx + dx - 7, sy + dy + 2]], { w: 0.9, closed: true, rough: 0.2 }); });
      // tiny ship docked
      P.pl([[cx + 20, sy + 14], [cx + 56, sy + 12], [cx + 62, sy + 16], [cx + 56, sy + 20], [cx + 20, sy + 18]], { w: 1.1, closed: true, rough: 0.2 }); P.line(cx + 38, sy + 12, cx + 30, sy + 4, { w: 0.9, passes: 1, over: 0 }); P.line(cx + 38, sy + 20, cx + 30, sy + 28, { w: 0.9, passes: 1, over: 0 });
      P.hatch([[cx + 15, sy - 46], [cx + 15, sy - 46], [cx + 15, sy + 26], [cx + 5, sy + 26], [cx + 5, sy - 46]], { ang: 80, gap: 2.2, a: 0.55, w: 0.4 });
      P.hatch([[cx - 70, sy - 5 + 9], [cx + 70, sy - 5 + 9], [cx + 60, sy + 12], [cx - 60, sy + 12]], { ang: 20, gap: 2.4, a: 0.4, w: 0.4, fade: () => 0.6, piece: 12 });
    }

    /* ---------- counterweight asteroid ---------- */
    { const ax = CX, ay = astY;
      const rock = [[ax - 46, ay + 6], [ax - 40, ay - 12], [ax - 22, ay - 24], [ax + 4, ay - 26], [ax + 30, ay - 20], [ax + 46, ay - 4], [ax + 40, ay + 14], [ax + 18, ay + 26], [ax - 6, ay + 24], [ax - 30, ay + 20]];
      P.erase(rock); P.curve(rock, { closed: true, w: 1.7, rough: 1.4, passes: 2 });
      [[-18, -6, 9], [12, -10, 7], [16, 10, 6], [-6, 12, 5], [28, 0, 4], [-32, 8, 4]].forEach(([dx, dy, r]) => { P.ellipse(ax + dx, ay + dy, r, r * 0.6, { w: 0.8, rot: -0.3, passes: 1, rough: 0.8 }); P.arc(ax + dx, ay + dy + 1, r * 0.8, r * 0.45, 0.2, Math.PI - 0.2, { w: 0.5, a: 0.5, passes: 1, rot: -0.3 }); });
      P.hatch(P.sample(rock, true, 6), { ang: -50, gap: 2.6, a: 0.6, w: 0.5, fade: (x, y) => Math.max(0, (x - ax + 15) / 55) + (y - ay) / 90, piece: 8 });
      P.rect(ax - 4, ay + 24, 8, 8, { w: 1, rough: 0.2 });
    }

    /* ---------- satellites on their orbits ---------- */
    const sat = (x, y, s = 1) => {
      P.rect(x - 5 * s, y - 4 * s, 10 * s, 8 * s, { w: 1, rough: 0.2 });
      [-1, 1].forEach(sg => { const a = x + sg * 6 * s, b = x + sg * 24 * s; P.line(x + sg * 5 * s, y, a, y, { w: 0.8, passes: 1, over: 0 }); P.rect(Math.min(a, b), y - 4 * s, 18 * s, 8 * s, { w: 0.9, rough: 0.2 }); for (let k = 1; k < 3; k++) P.line(Math.min(a, b) + k * 6 * s, y - 4 * s, Math.min(a, b) + k * 6 * s, y + 4 * s, { w: 0.35, a: 0.6, passes: 1, over: 0 }); });
      P.line(x, y - 4 * s, x, y - 10 * s, { w: 0.8, passes: 1, over: 0 }); P.circle(x, y - 11 * s, 1.5 * s, { w: 0.6, passes: 1 });
    };
    sat(380, Y(20200), 1); sat(760, Y(20200), 1); sat(360, Y(35786) - 1, 1.15);
    // ISS-ish truss
    { const x = 760, y = Y(408); P.line(x - 40, y, x + 40, y, { w: 1.2, rough: 0.3 }); for (let i = -40; i < 40; i += 8) { P.line(x + i, y - 3, x + i + 4, y + 3, { w: 0.4, a: 0.7, passes: 1, over: 0 }); P.line(x + i + 4, y - 3, x + i, y + 3, { w: 0.4, a: 0.7, passes: 1, over: 0 }); }
      [-32, -20, 20, 32].forEach(dx => { P.rect(x + dx - 4, y - 22, 8, 18, { w: 0.9, rough: 0.2 }); P.rect(x + dx - 4, y + 4, 8, 18, { w: 0.9, rough: 0.2 }); });
      P.rrect(x - 8, y - 5, 16, 10, 3, { w: 1 }); }

    /* ---------- callouts ---------- */
    const circleA = [CX, 604], circleB = [CX, 380];
    P.circle(...circleA, 40, { w: 1, a: 0.85 }); P.text('A', CX - 62, 612, { size: 22, font: S.HAND });
    P.circle(...circleB, 30, { w: 1, a: 0.85 }); P.text('B', CX - 52, 388, { size: 22, font: S.HAND });
    P.dashed(CX + 40, 604, 1164, 604, [8, 5], { w: 0.6, a: 0.55 }); P.dashed(1164, 604, 1164, 300, [8, 5], { w: 0.6, a: 0.55 }); P.dashed(1164, 300, 1190, 300, [8, 5], { w: 0.6, a: 0.55 });
    P.dashed(CX + 30, 380, 1150, 380, [8, 5], { w: 0.6, a: 0.55 }); P.dashed(1150, 380, 1150, 450, [8, 5], { w: 0.6, a: 0.55 }); P.dashed(1150, 450, 1190, 450, [8, 5], { w: 0.6, a: 0.55 });
    P.note('CLIMBER, LASER-POWERED', 300, 690, CX - 22, 700, { size: 18 });
    P.note('CARBON NANOTUBE RIBBON', 300, 470, CX - 6, 468, { size: 18 });
    P.note('HABITAT RING + DOCKS', 300, stY + 92, CX - 62, stY + 2, { size: 17 });
    P.note('SOLAR WINGS', 800, stY - 40, CX + 186, stY - 40, { size: 17 });
    P.note('MOON  (for company)', 60, 232, 116, 214, { size: 17 });
    P.dim(CX - 60, Y(100), CX - 60, Y(35786), '', 20);
    P.text('ONE STRAIGHT LINE, 35,786 km LONG  -  DRAWN ON A LOG AXIS', 640, 62, { size: 15, a: 0.75 });

    /* ---------- DETAIL A : the climber, front view, big ---------- */
    { const x = 1370, y0 = 86, y1 = 332;
      P.text('DETAIL A', 1196, 76, { size: 20, font: S.HAND }); P.text('CLIMBER - PINCH ROLLERS', 1284, 76, { size: 15 });
      P.line(x - 12, y0 + 10, x - 12, y1 - 20, { w: 1.5, rough: 0.3 }); P.line(x + 12, y0 + 10, x + 12, y1 - 20, { w: 1.5, rough: 0.3 });
      const body = [[x - 84, y0 + 44], [x + 84, y0 + 44], [x + 84, y0 + 176], [x - 84, y0 + 176]];
      P.erase(body); P.rrect(x - 84, y0 + 44, 168, 132, 10, { w: 1.7 });
      [0, 1, 2].forEach(i => { const cy = y0 + 76 + i * 44; [-1, 1].forEach(sg => {
        const cx = x + sg * 27; P.circle(cx, cy, 15, { w: 1.3 }); P.circle(cx, cy, 4, { w: 0.9, passes: 1 });
        for (let a = 0; a < 16; a++) { const an = a * TAU / 16; P.line(cx + Math.cos(an) * 15, cy + Math.sin(an) * 15, cx + Math.cos(an) * 12, cy + Math.sin(an) * 12, { w: 0.5, a: 0.8, passes: 1, over: 0, rough: 0.1 }); }
        P.line(cx, cy, cx + sg * 30, cy, { w: 1, passes: 1, over: 0 }); P.rrect(cx + sg * 30 - (sg < 0 ? 22 : 0), cy - 14, 22, 28, 3, { w: 1.1 });
        P.line(cx + sg * 36, cy - 8, cx + sg * 36, cy + 8, { w: 0.4, a: 0.6, passes: 1, over: 0 });
        P.arc(cx, cy, 6, 6, 0, TAU * 0.7, { w: 0.6, a: 0.6, passes: 1 });
      }); P.line(x - 12, cy - 2, x + 12, cy + 2, { w: 0.4, a: 0.4, passes: 1, over: 0 }); });
      P.line(x - 12, y0 + 44, x - 12, y0 + 176, { w: 0.6, a: 0.4, passes: 1, over: 0 });
      // payload above, PV skirt below
      P.rrect(x - 44, y0 + 8, 88, 36, 12, { w: 1.5 }); [-24, 0, 24].forEach(dx => P.circle(x + dx, y0 + 26, 7, { w: 0.9, passes: 1 }));
      P.text('PAYLOAD', x, y0 + 4, { size: 13, align: 'center', a: 0.7 });
      const sk = [[x - 78, y0 + 176], [x + 78, y0 + 176], [x + 126, y1], [x - 126, y1]];
      P.poly(sk, { w: 1.4, rough: 0.4 });
      for (let i = 1; i < 6; i++) { const f = i / 6; P.line(lerp(x - 78, x - 126, f), lerp(y0 + 176, y1, f), lerp(x + 78, x + 126, f), lerp(y0 + 176, y1, f), { w: 0.4, a: 0.65, passes: 1, over: 0, rough: 0.15 }); }
      for (let i = 1; i < 10; i++) { const f = i / 10; P.line(lerp(x - 78, x + 78, f), y0 + 176, lerp(x - 126, x + 126, f), y1, { w: 0.4, a: 0.65, passes: 1, over: 0, rough: 0.15 }); }
      P.hatch(sk, { ang: 55, gap: 3, a: 0.42, w: 0.45, fade: () => 0.8, piece: 16 });
      P.hatch([[x + 44, y0 + 44], [x + 84, y0 + 44], [x + 84, y0 + 176], [x + 44, y0 + 176]], { ang: 70, gap: 2.4, a: 0.45, w: 0.45 });
      // beam arrows
      [-80, -20, 40, 100].forEach(dx => { P.dashed(x + dx, y1 + 16, x + dx * 0.7, y1 + 2, [4, 3], { w: 0.6, a: 0.6 }); });
    }

    /* ---------- DETAIL B : ribbon weave (graphene lattice) ---------- */
    { const x0 = 1200, y0 = 456, w = 340, h = 78, s = 11;
      P.text('DETAIL B', 1196, 396, { size: 20, font: S.HAND }); P.text('RIBBON - CARBON LATTICE', 1284, 396, { size: 15 });
      P.text('1 m WIDE  x  1 MICRON THICK', 1196, 420, { size: 15, a: 0.85 });
      const dx = s * Math.sqrt(3);
      for (let r = 0; r * s * 1.5 < h + s; r++) for (let c = 0; c * dx < w + dx; c++) {
        const cx = x0 + c * dx + (r % 2 ? dx / 2 : 0), cy = y0 + r * s * 1.5;
        if (cx > x0 + w || cy > y0 + h) continue;
        const v = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; v.push([cx + Math.cos(a) * s, cy + Math.sin(a) * s]); }
        for (let i = 0; i < 6; i++) if ([0, 1, 2, 5].includes(i)) P.line(v[i][0], v[i][1], v[(i + 1) % 6][0], v[(i + 1) % 6][1], { w: 0.65, a: 0.8, passes: 1, over: 0.2, rough: 0.2 });
        if ((r + c) % 5 === 0) v.forEach(p => P.dot(p[0], p[1], 1.3, { a: 0.85 }));
      }
      P.rect(x0 - 2, y0 - s, w + 4, h + s * 2, { w: 1.3, rough: 0.3, over: 0 });
      P.hatch([[x0 + w - 60, y0 - s], [x0 + w, y0 - s], [x0 + w, y0 + h + s], [x0 + w - 60, y0 + h + s]], { ang: 70, gap: 2.5, a: 0.4, w: 0.4, fade: x => (x - (x0 + w - 60)) / 60, piece: 6 });
      P.dim(x0, y0 + h + s + 4, x0 + w, y0 + h + s + 4, 'ONE SHEET, ~1 m WIDE', 12, { size: 14 });
    }

    /* ---------- DETAIL C : why it stays up (top-down) ---------- */
    { const ex = 1262, ey = 738, re = 16, rg = 96;
      P.text('DETAIL C', 1196, 616, { size: 20, font: S.HAND }); P.text('WHY IT STAYS UP  (TOP VIEW)', 1284, 616, { size: 15 });
      P.circle(ex, ey, re, { w: 1.5 }); P.arc(ex, ey, re * 0.8, re * 0.35, 0, TAU, { w: 0.5, a: 0.6, passes: 1 });
      const d = []; for (let a = 0; a < 30; a++) d.push([ex + Math.cos(a * 0.21) * re, ey + Math.sin(a * 0.21) * re]); P.hatch(d, { ang: -50, gap: 2.4, a: 0.55, fade: x => (x - ex + 6) / 22, piece: 6 });
      P.circle(ex, ey, rg, { w: 0.8, a: 0.7, passes: 1 }); P.dashed(ex + rg, ey, ex + rg + 12, ey, [12, 3], { w: 0.5 });
      P.circle(ex, ey, 60, { w: 0.4, a: 0.3, passes: 1 });
      P.line(ex + re, ey, ex + 214, ey, { w: 1.5, rough: 0.3 }); P.line(ex + re, ey + 4, ex + 214, ey + 4, { w: 0.9, rough: 0.3 });
      P.circle(ex + 226, ey + 2, 12, { w: 1.3 }); P.hatch(P.sample([[ex + 214, ey + 2], [ex + 226, ey - 10], [ex + 238, ey + 2], [ex + 226, ey + 14]], true, 3), { ang: -40, gap: 2.4, a: 0.55, piece: 5 });
      P.circle(ex + rg, ey + 2, 5, { w: 1.1, passes: 1 });
      // rotation arrow
      P.arc(ex, ey, 130, 130, -0.9, -0.2, { w: 0.9, passes: 1 }); P.line(ex + Math.cos(-0.2) * 130, ey + Math.sin(-0.2) * 130, ex + Math.cos(-0.35) * 136, ey + Math.sin(-0.35) * 136, { w: 0.9, passes: 1, over: 0 }); P.line(ex + Math.cos(-0.2) * 130, ey + Math.sin(-0.2) * 130, ex + Math.cos(-0.36) * 124, ey + Math.sin(-0.36) * 124, { w: 0.9, passes: 1, over: 0 });
      P.text('1 REV / DAY', ex + 96, ey - 118, { size: 14, a: 0.8, rot: 0.6 });
      // force arrows at GEO
      const gx = ex + rg, gy = ey + 2;
      P.line(gx, gy, gx - 34, gy, { w: 1.1, passes: 1, over: 0 }); P.pl([[gx - 27, gy - 5], [gx - 34, gy], [gx - 27, gy + 5]], { w: 1.1 });
      P.line(gx, gy, gx + 34, gy, { w: 1.1, passes: 1, over: 0 }); P.pl([[gx + 27, gy - 5], [gx + 34, gy], [gx + 27, gy + 5]], { w: 1.1 });
      P.text('GRAVITY', gx - 34, gy + 24, { size: 13, align: 'center' }); P.text('SPIN', gx + 36, gy + 24, { size: 13, align: 'center' });
      P.text('BELOW GEO: GRAVITY WINS  -  ABOVE: SPIN WINS', 1196, 818, { size: 13.5, a: 0.85 });
      P.text('THE RIBBON IS PULLED TAUT BETWEEN THEM', 1196, 836, { size: 13.5, a: 0.85 });
      P.note('EARTH', ex - 34, ey + 52, ex - 8, ey + 12, { size: 15 }); P.text('GEO  36,000 km', ex - 90, ey - rg - 10, { size: 14, a: 0.85 }); P.note('BALLAST', ex + 200, ey - 40, ex + 226, ey - 14, { size: 14 });
    }
  }
});
