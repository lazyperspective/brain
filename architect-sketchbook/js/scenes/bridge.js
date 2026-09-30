/* SHEET 3 — Suspension bridge (coloured: pencil + watercolour) */
(window.SCENES = window.SCENES || []).push({
  name: 'Bridge', seed: 37, ink: '#2a2b30',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp;
    P.frame('SUSPENSION BRIDGE', 'SPAN 1,280 m  ELEVATION', n, t, { scale: 'SCALE  1 : 900', note: 'pencil + watercolour, orange paint' });
    const TX1 = 460, TX2 = 1140, TT = 150, DK = 510, DB = 534, WY = 650, ORANGE = '#d9482b';
    const mirror = x => 1600 - x;

    /* ---------- sky, sun, mountains, sea (washes first, line work over them) ---------- */
    P.wash([[48, 48], [1552, 48], [1552, 600], [48, 600]], '#cfe3ee', 0.4, { grad: { x0: 0, y0: 48, x1: 0, y1: 600, c0: '#a9cde3', c1: '#f9dcb8', a0: 0.5, a1: 0.5 }, jit: 0.5, edge: 0 });
    P.circle(1268, 190, 36, { w: 1.2, passes: 2 });
    for (let a = 0; a < 28; a++) { const an = a * TAU / 28, r0 = 44, r1 = a % 2 ? 56 : 66; P.line(1268 + Math.cos(an) * r0, 190 + Math.sin(an) * r0, 1268 + Math.cos(an) * r1, 190 + Math.sin(an) * r1, { w: 0.6, a: 0.55, passes: 1, over: 0, rough: 0.4, c: '#c17a1a' }); }
    P.wash(P.sample([[1232, 190], [1268, 154], [1304, 190], [1268, 226]], true, 5), '#ffd36b', 0.9, { edge: 0.5 });
    const ridgeL = [[48, 430], [110, 392], [180, 352], [260, 394], [330, 432], [400, 484], [440, 540]];
    const ridgeR = ridgeL.map(([x, y]) => [mirror(x), y]);
    const ridgeFarL = [[48, 470], [140, 440], [230, 448], [330, 470], [420, 520]];
    const ridgeFarR = ridgeFarL.map(([x, y]) => [mirror(x), y]);
    [ridgeFarL, ridgeFarR].forEach(r => P.curve(r, { w: 0.7, a: 0.5, rough: 1 }));
    [ridgeL, ridgeR].forEach((r, i) => {
      P.curve(r, { w: 1.1, a: 0.85, rough: 1.1 });
      const poly = P.sample(r, false, 8).concat(i ? [[1160, 600], [1552, 600]] : [[420, 600], [48, 600]]);
      P.wash(poly, '#6f8fa8', 0.42, { grad: { x0: 0, y0: 350, x1: 0, y1: 600, c0: '#5f7f9a', c1: '#a9bfd0', a0: 0.5, a1: 0.2 }, edge: 0.5 });
      P.hatch(poly, { ang: -60, gap: 5, a: 0.3, w: 0.5, fade: (x, y) => Math.max(0, 1 - (y - 350) / 200), piece: 14 });
    });
    // horizon haze
    for (let i = 0; i < 5; i++) P.line(430 + P.r(0, 60), 580 + i * 3, 1170 - P.r(0, 60), 580 + i * 3, { w: 0.5, a: 0.3, rough: 0.8, passes: 1 });
    // sea strip
    const sea = [[300, 606], [1300, 606], [1300, 740], [300, 740]];
    P.wash(sea, '#5e9db4', 0.5, { grad: { x0: 0, y0: 598, x1: 0, y1: 740, c0: '#9ccbd8', c1: '#2f6f8c', a0: 0.45, a1: 0.7 }, jit: 0.8 });
    for (let i = 0; i < 300; i++) {
      const y = 604 + Math.pow(P.r(), 1.3) * 134, sc = 0.5 + (y - 598) / 90;
      const x = P.r(360, 1240), l = P.r(14, 46) * sc; if (x + l > 1250) continue;
      P.curve([[x, y], [x + l / 2, y - 1.4 * sc], [x + l, y + 0.5]], { w: 0.5 + sc * 0.15, a: 0.28 + (y - 598) / 300, c: '#28566f', rough: 0.6 });
    }
    // land (left / right headlands) with surface height function
    const landY = x => { const p = [[46, 536], [120, 538], [190, 552], [250, 578], [300, 606], [340, 640], [352, 700], [340, 740]]; for (let i = 0; i + 1 < p.length; i++) if (x >= p[i][0] && x <= p[i + 1][0]) return lerp(p[i][1], p[i + 1][1], (x - p[i][0]) / (p[i + 1][0] - p[i][0])); return 740; };
    const landL = [[46, 536], [120, 538], [190, 552], [250, 578], [300, 606], [340, 640], [352, 700], [340, 740], [46, 740]];
    const landR = landL.map(([x, y]) => [mirror(x), y]);
    [landL, landR].forEach(l => {
      P.erase(l);
      P.pl(l.slice(0, 8), { w: 1.4, rough: 1 });
      P.wash(l, '#7ea060', 0.5, { grad: { x0: 0, y0: 540, x1: 0, y1: 740, c0: '#9bb56c', c1: '#587a45', a0: 0.5, a1: 0.7 }, jit: 1 });
      P.hatch(l, { ang: 65, gap: 4, a: 0.35, w: 0.5, fade: (x, y) => Math.min(1, (y - 540) / 130), piece: 12 });
      P.stipple(l, 90, { a: 0.5, r: 1 });
    });
    // small trees on the headlands
    [[80, 552], [104, 555], [140, 558], [1520, 552], [1496, 555], [1460, 558], [225, 590], [1375, 590]].forEach(([x, y]) => {
      P.line(x, y + 2, x, y - 12, { w: 1, passes: 1, over: 0 }); P.curve([[x - 8, y - 6], [x - 6, y - 20], [x, y - 24], [x + 7, y - 18], [x + 8, y - 6], [x, y - 4]], { closed: true, w: 0.8, rough: 0.8 });
      P.wash(P.sample([[x - 8, y - 6], [x - 6, y - 20], [x, y - 24], [x + 7, y - 18], [x + 8, y - 6], [x, y - 4]], true, 3), '#3f7a4a', 0.65, { jit: 0.6, edge: 0.4 });
    });

    /* ---------- deck: chord lines, Warren truss, rail ---------- */
    P.line(46, DK, 1554, DK, { w: 1.7, rough: 0.5 }); P.line(46, DB, 1554, DB, { w: 1.7, rough: 0.5 });
    P.line(46, DB - 6, 1554, DB - 6, { w: 0.6, a: 0.6, rough: 0.5, passes: 1 });
    for (let x = 50; x < 1548; x += 12) { P.line(x, DB, x + 6, DK, { w: 0.55, a: 0.6, passes: 1, over: 0, rough: 0.2 }); P.line(x + 6, DK, x + 12, DB, { w: 0.55, a: 0.6, passes: 1, over: 0, rough: 0.2 }); }
    for (let x = 48; x < 1552; x += 24) P.line(x, DK, x, DK - 9, { w: 0.6, a: 0.7, passes: 1, over: 0, rough: 0.2 });
    P.line(46, DK - 9, 1554, DK - 9, { w: 0.7, rough: 0.5 });
    P.wash([[46, DK], [1554, DK], [1554, DB], [46, DB]], '#a8a49a', 0.45, { jit: 0.4, edge: 0.3 });
    // approach piers on land
    [[96], [156], [216], [276], [1600 - 96], [1600 - 156], [1600 - 216], [1600 - 276]].forEach(([x]) => {
      const gy = landY(x < 800 ? x : mirror(x)); if (gy < DB + 8) return;
      P.line(x - 5, DB, x - 6, gy, { w: 1.2, rough: 0.4, passes: 1 }); P.line(x + 5, DB, x + 6, gy, { w: 1.2, rough: 0.4, passes: 1 });
      for (let y = DB + 8; y < gy - 8; y += 9) { P.line(x - 5, y, x + 5, y + 9, { w: 0.4, a: 0.5, passes: 1, over: 0 }); }
      P.wash([[x - 6, DB], [x + 6, DB], [x + 6, gy], [x - 6, gy]], '#b5b0a5', 0.55, { jit: 0.4, edge: 0.3 });
    });
    // anchorage blocks
    [[46, 110], [1490, 1554]].forEach(([a, b]) => { P.rect(a, 470, b - a, 66, { w: 1.4, rough: 0.5 }); P.hatch([[a, 470], [b, 470], [b, 536], [a, 536]], { ang: 60, gap: 3.4, a: 0.4 }); P.wash([[a, 470], [b, 470], [b, 536], [a, 536]], '#a8a49a', 0.4, { edge: 0.3 }); });

    /* ---------- cables and suspenders ---------- */
    const midY = 490, cyMain = x => midY - (midY - (TT + 2)) * Math.pow((x - 800) / 340, 2);
    const anc = 70, ancY = 486, cySide = (x, side) => { const xx = side < 0 ? x : mirror(x); const tt = (xx - anc) / (TX1 - anc); return lerp(ancY, TT + 2, tt) + 28 * 4 * tt * (1 - tt); };
    const mainS = []; for (let x = TX1; x <= TX2; x += 10) mainS.push([x, cyMain(x)]);
    const sideL = []; for (let x = anc; x <= TX1; x += 10) sideL.push([x, cySide(x, -1)]);
    const sideR = sideL.map(([x, y]) => [mirror(x), y]).reverse();
    [mainS, sideL, sideR].forEach(c => { P.path(c, { w: 1.9, rough: 0.5, passes: 2 }); P.path(c.map(([x, y]) => [x, y + 4]), { w: 1.4, rough: 0.5 }); });
    // cable bands (clamps) where suspenders attach + suspenders
    const susp = (x, cy) => { if (DK - 9 - cy < 5) return; P.line(x, cy + 2, x, DK - 9, { w: 0.65, a: 0.75, passes: 1, over: 0, rough: 0.35, step: 25 }); P.line(x - 2, cy - 1, x + 2, cy + 5, { w: 1.3, a: 0.85, passes: 1, over: 0, rough: 0.1 }); };
    for (let x = TX1 + 17; x < TX2 - 10; x += 17) susp(x, cyMain(x));
    for (let x = anc + 20; x < TX1 - 12; x += 17) { susp(x, cySide(x, -1)); susp(mirror(x), cySide(x, -1)); }

    /* ---------- towers (erase the deck behind, then draw) ---------- */
    const tower = cx => {
      const poly = [[cx - 14, TT], [cx + 14, TT], [cx + 22, WY + 6], [cx - 22, WY + 6]];
      P.erase(poly);
      P.line(cx - 14, TT, cx - 22, WY + 6, { w: 1.9, rough: 0.35 }); P.line(cx + 14, TT, cx + 22, WY + 6, { w: 1.9, rough: 0.35 });
      P.line(cx - 10.5, TT + 4, cx - 18.5, WY, { w: 0.6, a: 0.6, rough: 0.3, passes: 1 }); P.line(cx + 10.5, TT + 4, cx + 18.5, WY, { w: 0.6, a: 0.6, rough: 0.3, passes: 1 });
      const wAt = y => lerp(14, 22, (y - TT) / (WY + 6 - TT));
      for (let y = TT + 10; y < WY; y += 22) P.line(cx - wAt(y), y, cx + wAt(y), y, { w: 0.7, a: 0.7, passes: 1, over: 0.2, rough: 0.25 });
      const dots = []; for (let y = TT + 6; y < WY; y += 11) { dots.push([cx - wAt(y) + 3.4, y, 0.9]); dots.push([cx + wAt(y) - 3.4, y, 0.9]); }
      P.dots(dots, null, 0.7);
      P.line(cx, TT + 8, cx, WY, { w: 0.4, a: 0.35, passes: 1, over: 0 });
      P.pl([[cx - 16, TT], [cx - 11, TT - 12], [cx + 11, TT - 12], [cx + 16, TT]], { w: 1.4, closed: false });
      P.line(cx - 16, TT, cx + 16, TT, { w: 1.4, rough: 0.2 });
      P.line(cx, TT - 12, cx, TT - 30, { w: 0.9, passes: 1, over: 0 }); P.circle(cx, TT - 33, 3, { w: 0.9, passes: 1 });
      // saddle
      P.arc(cx, TT + 2, 12, 5, Math.PI, TAU, { w: 1.2, passes: 1 });
      // pier & fender at the water line
      const pier = [[cx - 28, WY - 24], [cx + 28, WY - 24], [cx + 34, WY + 8], [cx - 34, WY + 8]];
      P.erase(pier);
      P.poly(pier, { w: 1.6, rough: 0.5 });
      for (let y = WY - 18; y < WY + 6; y += 7) P.line(cx - 30, y, cx + 30, y, { w: 0.4, a: 0.4, passes: 1, over: 0 });
      P.ellipse(cx, WY + 10, 44, 8, { w: 1.1, a: 0.85 });
      // wash
      P.wash(poly, ORANGE, 0.8, { grad: { x0: cx - 22, y0: 0, x1: cx + 22, y1: 0, c0: '#ee6b43', c1: '#b73a1f', a0: 0.75, a1: 0.9 } });
      P.wash(pier, '#b3aea3', 0.65, { edge: 0.4 });
      P.hatch(poly, { ang: 84, gap: 2.6, a: 0.5, w: 0.5, fade: x => Math.max(0, (x - cx + 4) / 22), piece: 10 });
      P.hatch(pier, { ang: 40, gap: 3, a: 0.4 });
      // reflection in the sea
      for (let k = 0; k < 9; k++) { const y = WY + 16 + k * 8, w = 20 - k * 1.2, o = P.r(-5, 5); P.wash([[cx - w + o, y], [cx + w + o, y], [cx + w * 0.9 + o, y + 3.5], [cx - w * 0.9 + o, y + 3.5]], ORANGE, 0.35 - k * 0.025, { jit: 0.6, edge: 0, steps: 3 }); }
    };
    tower(TX1); tower(TX2);

    /* ---------- container ship, sail boat ---------- */
    { const wl = 706;
      // wake
      for (let i = 0; i < 6; i++) { P.line(650, wl + 1 + i * 1.6, 560 - i * 36, wl + 6 + i * 3.4, { w: 0.5, a: 0.5 - i * 0.05, c: '#f4f1e8', rough: 0.8, passes: 1 }); }
      const hull = [[642, 678], [990, 678], [1018, 662], [1000, 698], [985, 708], [668, 708], [650, 698]];
      P.poly(hull, { w: 1.6, rough: 0.5 });
      P.line(646, 690, 1004, 690, { w: 0.6, a: 0.6, rough: 0.3 });
      // superstructure + funnel
      P.rect(654, 640, 46, 38, { w: 1.3, rough: 0.3 }); P.rect(662, 618, 30, 22, { w: 1.2, rough: 0.3 }); P.rect(670, 604, 14, 14, { w: 1.1, rough: 0.3 });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) P.rect(658 + c * 7, 646 + r * 10, 4.5, 5, { w: 0.5, a: 0.8, passes: 1 });
      P.rect(714, 626, 14, 52, { w: 1.2, rough: 0.3 }); P.line(714, 636, 728, 636, { w: 0.9, passes: 1, over: 0 });
      P.line(677, 604, 677, 588, { w: 0.9, passes: 1, over: 0 }); P.line(669, 592, 685, 592, { w: 0.8, passes: 1, over: 0 });
      // containers
      const cols = ['#c8452f', '#2f6fa8', '#4f9d69', '#e0a13a', '#d97a2b', '#8a5ea8', '#3a8f9e'];
      let ci = 0;
      for (let row = 0; row < 3; row++) for (let c = 0; c < 12; c++) {
        const x = 740 + c * 21.5, y = 678 - (row + 1) * 12 + (c > 9 ? 0 : 0); if (x + 21.5 > 990) continue;
        const col = cols[(ci++ * 5 + row * 3) % cols.length];
        P.rect(x, y, 21, 11.4, { w: 0.85, rough: 0.2, passes: 1, over: 0.3 });
        for (let k = 3; k < 21; k += 3) P.line(x + k, y + 1.4, x + k, y + 10, { w: 0.3, a: 0.4, passes: 1, over: 0 });
        P.wash([[x + 0.5, y + 0.5], [x + 20.5, y + 0.5], [x + 20.5, y + 11], [x + 0.5, y + 11]], col, 0.72, { jit: 0.3, edge: 0, steps: 2 });
      }
      P.line(714, 678, 740, 678, { w: 0.6, passes: 1, over: 0 });
      P.wash(hull, '#3b3f4a', 0.75, { edge: 0.6 });
      P.wash([[654, 640], [700, 640], [700, 678], [654, 678]], '#f0eee6', 0.85, { edge: 0.2 });
      P.wash([[662, 618], [692, 618], [692, 640], [662, 640]], '#f0eee6', 0.85, { edge: 0.2 });
      P.wash([[714, 626], [728, 626], [728, 678], [714, 678]], '#c8452f', 0.75, { edge: 0.3 });
      P.wash([[642, 692], [1010, 692], [1000, 698], [985, 708], [668, 708], [650, 698]], '#a8322b', 0.6, { edge: 0.3 });
      P.hatch(hull, { ang: -20, gap: 3, a: 0.4, w: 0.5, piece: 10, fade: () => 0.6 });
      // bow wave
      P.curve([[1006, 692], [1022, 700], [1040, 706]], { w: 0.7, a: 0.6, rough: 0.6 }); P.curve([[1000, 704], [1016, 712], [1030, 716]], { w: 0.6, a: 0.5, rough: 0.6 });
      P.text('CONTAINER SHIP ~ 300 m', 700, 736, { size: 15 });
    }
    { const bx = 1210, by = 706; // sailing boat
      P.pl([[bx - 30, by - 6], [bx + 32, by - 6], [bx + 20, by + 4], [bx - 20, by + 4]], { w: 1.3, closed: true });
      P.line(bx, by - 6, bx, by - 64, { w: 1, rough: 0.3, passes: 1 });
      P.pl([[bx + 2, by - 62], [bx + 2, by - 10], [bx + 26, by - 10]], { w: 1, closed: true, rough: 0.4 });
      P.pl([[bx - 2, by - 56], [bx - 2, by - 10], [bx - 22, by - 10]], { w: 1, closed: true, rough: 0.4 });
      P.wash([[bx + 2, by - 62], [bx + 2, by - 10], [bx + 26, by - 10]], '#f4efe2', 0.9, { edge: 0.4 }); P.wash([[bx - 2, by - 56], [bx - 2, by - 10], [bx - 22, by - 10]], '#e56b3a', 0.7, { edge: 0.4 });
      P.wash([[bx - 30, by - 6], [bx + 32, by - 6], [bx + 20, by + 4], [bx - 20, by + 4]], '#3b4a6b', 0.75, { edge: 0.5 });
      for (let i = 0; i < 3; i++) P.line(bx - 34 + i * 4, by + 7 + i * 3, bx + 40 - i * 6, by + 7 + i * 3, { w: 0.5, a: 0.4, c: '#28566f', rough: 0.6, passes: 1 });
    }
    // gulls
    [[820, 300], [850, 320], [790, 336], [500, 400], [524, 412], [1350, 300], [1372, 316], [1000, 250]].forEach(([x, y]) => { P.curve([[x - 9, y - 3], [x - 4, y - 8], [x, y]], { w: 0.9, rough: 0.2 }); P.curve([[x, y], [x + 4, y - 8], [x + 9, y - 3]], { w: 0.9, rough: 0.2 }); });
    // a few clouds
    const cloud = (cx, cy, w, h) => { const b = []; for (let i = 0; i < 6; i++) { const u = i / 5; b.push([cx - w / 2 + u * w, cy - Math.sin(u * Math.PI) * h * (0.7 + 0.5 * P.r())]); } const pts = [[cx - w / 2 - 6, cy + 2]].concat(b, [[cx + w / 2 + 6, cy + 2]]); P.curve(pts, { w: 0.8, a: 0.6, rough: 0.9 }); P.wash(P.sample(pts.concat([[cx, cy + 4]]), true, 5), '#ffffff', 0.55, { edge: 0.2 }); P.hatch([[cx - w / 2, cy + 2], [cx + w / 2, cy + 2], [cx + w / 2 - 10, cy + 8], [cx - w / 2 + 10, cy + 8]], { ang: -30, gap: 2.6, a: 0.28, w: 0.45 }); };
    cloud(330, 78, 150, 20); cloud(720, 90, 120, 16); cloud(1000, 190, 110, 18); cloud(1420, 300, 100, 16);

    /* ---------- dimensions & notes ---------- */
    P.dim(TX1, TT - 14, TX2, TT - 14, 'MAIN SPAN  1,280 m', -36, { size: 18 });
    P.dim(1156, TT, 1156, DK, 'TOWER 160 m', -40, { size: 15 });
    P.dim(1156, DB, 1156, WY, 'CLEARANCE 67 m', -40, { size: 15 });
    const NT = (lines, x, y, tx, ty, o = {}) => { P.note(lines[0], x, y, tx, ty, o); lines.slice(1).forEach((s, i) => P.text(s, x, y + 20 * (i + 1), { size: o.size ?? 19, a: 0.8, align: o.align })); };
    NT(['MAIN CABLE  (0.92 m)', '27,572 WIRES  x  61 STRANDS'], 580, 262, 640, cyMain(640) - 2, { size: 19 });
    NT(['VERTICAL SUSPENDER ROPES', 'EVERY 15 m'], 700, 372, 851, 470, { size: 19 });
    NT(['STIFFENING TRUSS  7.6 m'], 620, 578, 700, DB, { size: 19 });
    NT(['INTERNATIONAL ORANGE', 'RED LEAD + TOPCOAT'], 120, 190, TX1 - 15, 250, { size: 19 });
    NT(['CABLE ANCHORAGE'], 60, 596, 82, 540, { size: 19 });
    NT(['APPROACH SPAN', 'ON PIERS'], 100, 680, 156, 590, { size: 19 });
    NT(['SADDLE'], 528, 128, TX1 + 10, TT, { size: 19 });
    NT(['FENDER RING'], 366, 728, TX1 - 30, WY + 14, { size: 17 });
    NT(['SEA  -  DEPTH 100 m'], 1300, 640, 1250, 660, { size: 17 });
    P.text('WIND SWAY AT MIDSPAN  +/- 8 m', 720, 132, { size: 15, a: 0.7 });

    /* ---------- details row ---------- */
    const cap = (x, y, a, b) => { P.label(a, x, y, { size: 18 }); P.text(b, x + P.measure(a, 18) + 12, y, { size: 15 }); };
    P.line(46, 758, 1130, 758, { w: 0.8, a: 0.6, rough: 0.6, passes: 1 });
    // A: tower portal, front view
    { const cx = 232, y0 = 790, y1 = 930, lw = 20;
      const legL = [[cx - 62 - 10, y0], [cx - 62 + 10, y0], [cx - 62 + 13, y1], [cx - 62 - 13, y1]], legR = legL.map(([x, y]) => [x + 124, y]);
      [legL, legR].forEach(l => { P.poly(l, { w: 1.5, rough: 0.35 }); P.wash(l, ORANGE, 0.78, { edge: 0.5 }); P.hatch(l, { ang: 84, gap: 2.4, a: 0.5, fade: x => (x > l[0][0] + 10 ? 0.9 : 0.3), piece: 8 }); });
      [800, 830, 862, 894, 924].forEach((y, i) => { P.rect(cx - 62 + 10, y - 4, 104, 8, { w: 1, rough: 0.3 }); P.wash([[cx - 52, y - 4], [cx + 52, y - 4], [cx + 52, y + 4], [cx - 52, y + 4]], ORANGE, 0.55, { edge: 0.2, steps: 3 }); });
      [[804, 826], [834, 858], [866, 890], [898, 920]].forEach(([a, b]) => { P.line(cx - 52, a, cx + 52, b, { w: 0.7, a: 0.8, rough: 0.3, passes: 1 }); P.line(cx + 52, a, cx - 52, b, { w: 0.7, a: 0.8, rough: 0.3, passes: 1 }); });
      P.pl([[cx - 74, y0], [cx - 66, y0 - 12], [cx - 58, y0]], { w: 1, closed: false }); P.pl([[cx + 74, y0], [cx + 66, y0 - 12], [cx + 58, y0]], { w: 1, closed: false });
      P.dashed(cx, y0 - 10, cx, y1 + 8, [12, 4, 3, 4], { w: 0.5, a: 0.5 });
      const d = []; for (let y = y0 + 8; y < y1; y += 9) { d.push([cx - 62 - 8 + (y - y0) * 0.02, y, 0.9]); d.push([cx - 62 + 8, y, 0.9]); d.push([cx + 62 - 8, y, 0.9]); d.push([cx + 62 + 8, y, 0.9]); } P.dots(d, null, 0.6);
      cap(108, 950, 'DETAIL A', 'TOWER PORTAL, FRONT');
    }
    // B: main cable section, 61 hex-packed strands
    { const cx = 510, cy = 856, r = 6.4;
      const strands = [[0, 0]]; for (let ring = 1; ring <= 4; ring++) { for (let k = 0; k < 6 * ring; k++) { const side = Math.floor(k / ring), pos = k % ring; const a0 = side * Math.PI / 3, a1 = (side + 1) * Math.PI / 3; const p0 = [Math.cos(a0) * ring, Math.sin(a0) * ring], p1 = [Math.cos(a1) * ring, Math.sin(a1) * ring]; strands.push([lerp(p0[0], p1[0], pos / ring), lerp(p0[1], p1[1], pos / ring)]); } }
      P.circle(cx, cy, 8.2 * r, { w: 1.8 }); P.circle(cx, cy, 8.8 * r, { w: 0.9, a: 0.8 });
      strands.forEach(([u, v], i) => { const x = cx + u * 2 * r, y = cy + v * 2 * r; P.circle(x, y, r * 0.93, { w: 0.65, passes: 1, rough: 0.3 }); P.wash(P.sample([[x - r * 0.9, y], [x, y - r * 0.9], [x + r * 0.9, y], [x, y + r * 0.9]], true, 2), i % 7 === 0 ? '#e0a13a' : '#8e9298', 0.55, { jit: 0.3, edge: 0, steps: 2 }); if (i % 3 === 0) P.hatch(P.sample([[x - r * 0.9, y], [x, y - r * 0.9], [x + r * 0.9, y], [x, y + r * 0.9]], true, 2), { ang: 50, gap: 1.8, a: 0.4, w: 0.4 }); });
      P.dashed(cx - 78, cy, cx + 78, cy, [12, 4, 3, 4], { w: 0.5, a: 0.5 });
      cap(430, 950, 'DETAIL B', 'CABLE SECTION, 61 STRANDS');
      P.dim(cx - 8.8 * r, cy + 8.8 * r + 2, cx + 8.8 * r, cy + 8.8 * r + 2, '92 cm', 20, { size: 13 });
    }
    // C: deck cross-section
    { const x0 = 720, x1 = 1070, y0 = 806;
      P.rect(x0, y0, x1 - x0, 8, { w: 1.5, rough: 0.3 }); P.hatch([[x0, y0], [x1, y0], [x1, y0 + 8], [x0, y0 + 8]], { ang: 45, gap: 2.4, a: 0.55, inset: 0.3 });
      P.dashed(x0 + 60, y0 - 1, x1 - 60, y0 - 1, [14, 10], { w: 1.4, a: 0.9, c: '#c9a21f' });
      [x0 + 60, x1 - 60].forEach(x => P.line(x - 1, y0 - 1, x - 1, y0 - 1, { w: 1 }));
      P.rect(x0 + 14, y0 - 6, 34, 6, { w: 1, rough: 0.2 }); P.rect(x1 - 48, y0 - 6, 34, 6, { w: 1, rough: 0.2 });
      // cars
      [[x0 + 100, 1], [x0 + 160, 1], [x1 - 150, 1], [x1 - 220, 1]].forEach(([x]) => { P.pl([[x, y0 - 1], [x, y0 - 11], [x + 10, y0 - 15], [x + 24, y0 - 15], [x + 30, y0 - 11], [x + 36, y0 - 10], [x + 36, y0 - 1]], { w: 1, closed: false }); P.circle(x + 8, y0 - 1, 3.2, { w: 0.8, passes: 1 }); P.circle(x + 28, y0 - 1, 3.2, { w: 0.8, passes: 1 }); });
      // trusses
      [[x0 + 6], [x1 - 34]].forEach(([tx]) => {
        P.rect(tx, y0 + 8, 28, 64, { w: 1.2, rough: 0.3 });
        for (let y = y0 + 8; y < y0 + 68; y += 16) { P.line(tx, y, tx + 28, y + 16, { w: 0.6, a: 0.8, passes: 1 }); P.line(tx + 28, y, tx, y + 16, { w: 0.6, a: 0.8, passes: 1 }); }
        P.wash([[tx, y0 + 8], [tx + 28, y0 + 8], [tx + 28, y0 + 72], [tx, y0 + 72]], ORANGE, 0.5, { edge: 0.3 });
      });
      // lower lateral bracing
      P.line(x0 + 6, y0 + 72, x1 - 6, y0 + 72, { w: 1.2, rough: 0.3 });
      for (let x = x0 + 34; x < x1 - 40; x += 28) { P.line(x, y0 + 72, x + 14, y0 + 56, { w: 0.6, a: 0.8, passes: 1 }); P.line(x + 14, y0 + 56, x + 28, y0 + 72, { w: 0.6, a: 0.8, passes: 1 }); }
      P.line(x0 + 34, y0 + 56, x1 - 34, y0 + 56, { w: 0.6, a: 0.7, passes: 1 });
      // suspender & cable circles
      [x0 + 20, x1 - 20].forEach(x => { P.line(x, y0 - 6, x, y0 - 44, { w: 0.9, passes: 1, over: 0 }); P.circle(x, y0 - 52, 8, { w: 1.4 }); P.wash(P.sample([[x - 8, y0 - 52], [x, y0 - 60], [x + 8, y0 - 52], [x, y0 - 44]], true, 3), '#8e9298', 0.6, { jit: 0.3, edge: 0.3 }); P.hatch(P.sample([[x - 8, y0 - 52], [x, y0 - 60], [x + 8, y0 - 52], [x, y0 - 44]], true, 3), { ang: 40, gap: 1.8, a: 0.5 }); });
      P.dim(x0 + 6, y0 + 88, x1 - 6, y0 + 88, 'TRUSS TO TRUSS  27 m', 6, { size: 14 });
      cap(x0, 950, 'DETAIL C', 'DECK, 6 LANES + 2 WALKS');
    }
    P.text('ALL DIMENSIONS ROUNDED', 780, 776, { size: 13, a: 0.55 });
  }
});
