/* SHEET 1 — Spaceship (coloured: pencil + watercolour) */
(window.SCENES = window.SCENES || []).push({
  name: 'Spaceship', seed: 11, ink: '#26272d',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp;
    P.frame('SPACESHIP', 'ISV ARGO-7 CRUISER', n, t, { scale: 'SCALE  1 : 200', note: 'pencil + watercolour wash' });
    const AX = 402; // centre line of the ship

    const spanAt = (poly, x) => {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) {
          const y = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]); lo = Math.min(lo, y); hi = Math.max(hi, y);
        }
      }
      return [lo, hi];
    };

    /* ---- construction lines: axis, stations, guide ellipse ---- */
    P.dashed(60, AX, 1540, AX, [30, 6, 4, 6], { w: 0.7, a: 0.5 });
    [232, 330, 520, 760, 1000, 1150, 1452].forEach(x => P.guide(x, 120, x, 720, { a: 0.18 }));
    P.text('CL', 66, AX - 6, { size: 16, a: 0.5 });
    P.ellipse(880, AX, 590, 118, { w: 0.5, a: 0.16, rough: 0.5, passes: 1 });

    /* ---- ringed planet & stars (top left) ---- */
    const pc = [140, 195];
    P.circle(pc[0], pc[1], 44, { w: 1, a: 0.8, passes: 2 });
    P.arc(pc[0], pc[1], 84, 20, Math.PI, TAU, { rot: -0.28, w: 0.9, a: 0.75 });
    P.arc(pc[0], pc[1], 70, 15, Math.PI, TAU, { rot: -0.28, w: 0.7, a: 0.6 });
    P.arc(pc[0], pc[1], 84, 20, 0.1, Math.PI, { rot: -0.28, w: 0.9, a: 0.75 });
    P.arc(pc[0], pc[1], 70, 15, 0.1, Math.PI, { rot: -0.28, w: 0.7, a: 0.6 });
    for (let i = 0; i < 5; i++) P.curve([[pc[0] - 42, pc[1] - 10 + i * 8 + 4], [pc[0], pc[1] - 14 + i * 8], [pc[0] + 42, pc[1] - 10 + i * 8 + 5]], { w: 0.5, a: 0.4, rough: 0.6 });
    [[300, 120], [430, 84], [640, 110], [1010, 96], [1190, 130], [1350, 90], [1480, 150], [90, 300], [60, 470], [1490, 300], [1500, 480], [720, 84]].forEach(([x, y], i) => {
      const s = 3 + (i % 3) * 2;
      P.line(x - s, y, x + s, y, { w: 0.7, a: 0.7, passes: 1, over: 0, rough: 0.2 });
      P.line(x, y - s, x, y + s, { w: 0.7, a: 0.7, passes: 1, over: 0, rough: 0.2 });
      if (i % 2) { P.line(x - s * 0.5, y - s * 0.5, x + s * 0.5, y + s * 0.5, { w: 0.4, a: 0.5, passes: 1, over: 0 }); P.line(x + s * 0.5, y - s * 0.5, x - s * 0.5, y + s * 0.5, { w: 0.4, a: 0.5, passes: 1, over: 0 }); }
    });

    /* ---- hull (closed spline) ---- */
    const hullPts = [[330, 325], [470, 300], [700, 286], [940, 292], [1140, 318], [1290, 357], [1400, 394], [1452, 412], [1440, 426], [1330, 452], [1150, 484], [900, 502], [650, 504], [440, 492], [335, 468], [312, 400]];
    const hull = P.sample(hullPts, true, 5);

    /* ---- fins & wing (drawn first, hull then erases their roots) ---- */
    const dorsal = [[470, 306], [534, 170], [622, 158], [706, 288]];
    const ventral = [[470, 494], [514, 598], [594, 606], [694, 506]];
    const wing = [[1130, 486], [1050, 606], [880, 694], [704, 706], [734, 642], [790, 496]];
    P.poly(dorsal, { w: 1.6, rough: 0.8 }); P.poly(ventral, { w: 1.6, rough: 0.8 });
    P.poly(wing, { w: 1.6, rough: 0.8 });
    // dorsal fin: rudder hinge, ribs, stripe
    P.line(600, 160, 676, 290, { w: 0.9, a: 0.8, rough: 0.5 });
    P.line(556, 172, 590, 296, { w: 0.6, a: 0.6, rough: 0.5 });
    for (let i = 0; i < 5; i++) P.line(lerp(486, 540, i / 4) + 8, lerp(290, 176, i / 4) + 6, lerp(600, 692, i / 4), lerp(170, 288, i / 4) + 2, { w: 0.4, a: 0.35, passes: 1, rough: 0.6 });
    P.rrect(588, 188, 32, 14, 5, { w: 0.9 }); P.dot(604, 195, 3, { a: 0.9 });
    // ventral fin ribs
    P.line(606, 508, 578, 604, { w: 0.9, a: 0.8, rough: 0.5 });
    for (let i = 0; i < 4; i++) P.line(500 + i * 10, 500 + i * 26, 640 - i * 14, 508 + i * 22, { w: 0.4, a: 0.35, passes: 1, rough: 0.6 });
    // wing ribs, flaps, tip pod
    for (let i = 1; i < 6; i++) { const f = i / 6; P.line(lerp(790, 704, f) + 2, lerp(496, 706, f), lerp(1130, 880, f) - 2, lerp(486, 694, f), { w: 0.5, a: 0.4, passes: 1, rough: 0.6 }); }
    P.pl([[860, 500], [790, 630], [880, 640], [960, 510]], { w: 0.8, a: 0.7, rough: 0.6 });
    P.pl([[1010, 494], [960, 580], [1050, 606]], { w: 0.6, a: 0.55, rough: 0.6 });
    P.ellipse(722, 690, 9, 18, { w: 1, a: 0.85, rot: 0.5 });
    P.dot(716, 700, 3.4, { c: '#1f9d55', a: 0.95 });
    P.dashed(740, 640, 690, 700, [5, 3], { w: 0.5, a: 0.5 });

    /* ---- hull ---- */
    P.erase(hull);
    P.path(hull, { closed: true, w: 2, rough: 0.9, passes: 2 });
    // belt lines & racing stripe
    const stripeA = [[338, 452], [520, 462], [800, 478], [1040, 470], [1260, 446], [1380, 424]];
    const stripeB = stripeA.map(p => [p[0], p[1] + 15]);
    P.curve(stripeA, { w: 0.9, rough: 0.5 }); P.curve(stripeB, { w: 0.9, rough: 0.5 });
    P.curve([[340, 378], [700, 370], [1100, 380], [1310, 402]], { w: 0.6, a: 0.6, rough: 0.5 });
    // panel seams + rivets
    [372, 520, 700, 880, 1030].forEach((x, i) => {
      const [y0, y1] = spanAt(hull, x);
      P.line(x, y0 + 3, x, y1 - 3, { w: 0.7, a: 0.7, rough: 0.5 });
      const d = [];
      for (let y = y0 + 9; y < y1 - 6; y += 11) { d.push([x - 5, y + P.r(-1, 1), 0.9]); d.push([x + 5, y + P.r(-1, 1), 0.9]); }
      P.dots(d, null, 0.7);
    });
    // dorsal vent grille & sensor blisters
    for (let i = 0; i < 12; i++) { const x = 766 + i * 9; const [y0] = spanAt(hull, x); P.line(x, y0 + 4, x, y0 + 15, { w: 0.8, a: 0.75, passes: 1, over: 0, rough: 0.3 }); }
    P.rect(760, 300, 108, 18, { w: 0.6, a: 0.5, rough: 0.3 });
    P.ellipse(420, 338, 14, 6, { w: 0.9, a: 0.8 }); P.ellipse(960, 314, 12, 5, { w: 0.9, a: 0.8 });
    // hull lettering
    P.text('ARGO-7', 706, 366, { size: 36, font: S.HAND, rot: -0.008, a: 0.85, ls: 4 });
    P.text('ISV', 1048, 372, { size: 20, font: S.HAND, a: 0.8 });
    P.text('A-07', 470, 372, { size: 14, font: S.HAND, a: 0.7 });
    // windows
    const wins = [];
    for (let x = 566; x < 1070; x += 34) {
      P.rrect(x, 412, 22, 14, 5, { w: 0.9, passes: 1 });
      P.line(x + 11, 413, x + 11, 425, { w: 0.35, a: 0.5, passes: 1, over: 0 });
      wins.push([x, 412]);
    }
    for (let x = 583; x < 1050; x += 68) P.rrect(x, 436, 14, 9, 4, { w: 0.7, a: 0.7, passes: 1 });
    // airlock hatch
    P.rrect(1098, 392, 46, 74, 9, { w: 1.2 });
    P.circle(1121, 430, 14, { w: 0.9 }); P.circle(1121, 430, 4, { w: 0.8 });
    for (let a = 0; a < 6; a++) P.line(1121 + Math.cos(a * 1.047) * 4, 430 + Math.sin(a * 1.047) * 4, 1121 + Math.cos(a * 1.047) * 14, 430 + Math.sin(a * 1.047) * 14, { w: 0.6, passes: 1, over: 0, rough: 0.2 });
    P.dots([[1104, 398, 1], [1138, 398, 1], [1104, 460, 1], [1138, 460, 1]], null, 0.8);
    // big airlock porthole aft
    P.circle(452, 428, 17, { w: 1.1 }); P.circle(452, 428, 12, { w: 0.7 });
    { const d = []; for (let a = 0; a < 8; a++) d.push([452 + Math.cos(a * 0.785) * 14.6, 428 + Math.sin(a * 0.785) * 14.6, 1]); P.dots(d, null, 0.8); }
    // RCS thrusters at the nose
    [[1338, 366, -0.5], [1350, 442, 0.5]].forEach(([x, y, r]) => { P.poly([[x - 9, y - 6], [x + 9, y - 6 + r * 6], [x + 9, y + 6 + r * 6], [x - 9, y + 6]], { w: 1, rough: 0.3 }); });

    /* ---- cockpit canopy ---- */
    const canopy = [[1148, 336], [1192, 310], [1252, 312], [1312, 342], [1366, 386], [1300, 398], [1200, 392]];
    P.curve(canopy, { closed: true, w: 1.7, rough: 0.5, passes: 2 });
    P.curve([[1160, 352], [1200, 326], [1256, 326], [1300, 352], [1340, 384]], { w: 0.6, a: 0.7, rough: 0.4 });
    [[1200, 392, 1206, 316], [1252, 393, 1252, 314], [1300, 398, 1296, 338]].forEach(([x1, y1, x2, y2]) => P.curve([[x1, y1], [(x1 + x2) / 2 + 3, (y1 + y2) / 2], [x2, y2]], { w: 0.9, a: 0.85, rough: 0.4 }));
    [1226, 1274].forEach(x => { P.circle(x, 366, 9, { w: 1, passes: 1 }); P.arc(x, 392, 16, 20, Math.PI * 1.15, Math.PI * 1.85, { w: 0.9 }); P.line(x - 6, 364, x + 6, 364, { w: 0.6, a: 0.7, passes: 1, over: 0 }); });
    P.line(1180, 388, 1330, 388, { w: 0.6, a: 0.7 });

    /* ---- comms mast, dish, beacon ---- */
    { const [y0] = spanAt(hull, 900);
      P.line(900, y0 + 3, 900, 206, { w: 1.1, rough: 0.4 });
      [[236, 44], [252, 30], [268, 18]].forEach(([y, w]) => P.line(900 - w / 2, y, 900 + w / 2, y, { w: 1, rough: 0.3, passes: 1 }));
      P.circle(900, 200, 5, { w: 1, passes: 1 });
      for (let a = 0; a < 8; a++) P.line(900 + Math.cos(a * 0.785) * 9, 200 + Math.sin(a * 0.785) * 9, 900 + Math.cos(a * 0.785) * 15, 200 + Math.sin(a * 0.785) * 15, { w: 0.5, a: 0.55, passes: 1, over: 0, rough: 0.2 });
      const [y1] = spanAt(hull, 1030);
      P.line(1030, y1 + 3, 1030, y1 - 34, { w: 1.1, rough: 0.4 });
      P.arc(1030, y1 - 40, 26, 14, 0.15, Math.PI - 0.15, { w: 1.3, rot: -0.5 });
      P.line(1012, y1 - 30, 1050, y1 - 48, { w: 0.7, a: 0.7 });
      P.line(1030, y1 - 34, 1044, y1 - 46, { w: 0.5, a: 0.6, passes: 1 });
    }

    /* ---- main engine (bell, ribs, rim) & the flame ---- */
    const half = x => lerp(49, 81, (325 - x) / 93);
    const bell = [[326, 352], [232, 320], [232, 484], [326, 450]];
    P.erase([[326, 348], [230, 316], [230, 488], [326, 454]]);
    P.line(326, 352, 232, 320, { w: 1.7, rough: 0.4 }); P.line(326, 450, 232, 482, { w: 1.7, rough: 0.4 });
    P.line(328, 352, 328, 450, { w: 1.2, rough: 0.3 });
    [304, 282, 262, 246].forEach(x => { const tt = (325 - x) / 93; P.arc(x, AX, lerp(6, 16, tt), half(x), -Math.PI / 2, Math.PI / 2, { w: 0.9, a: 0.85, passes: 1 }); });
    P.ellipse(232, AX, 16, 81, { w: 1.9, passes: 2 });
    P.ellipse(233, AX, 11, 66, { w: 1, a: 0.85 });
    for (let i = -5; i <= 5; i++) P.line(326, AX + i * 9.5, 232, AX + i * 15.5, { w: 0.4, a: 0.4, passes: 1, over: 0, rough: 0.3 });
    { const d = []; for (let a = 0; a < 18; a++) d.push([232 + Math.cos(a * 0.349) * 13.5, AX + Math.sin(a * 0.349) * 75, 1.1]); P.dots(d, null, 0.75); }
    P.hatch(S.catmull([[233, AX - 64], [223, AX], [233, AX + 64], [243, AX]], true, 4), { ang: 70, gap: 3, a: 0.6, w: 0.6 });

    const flameTop = [[226, 336], [182, 348], [130, 366], [76, 388], [26, 402]];
    const flameBot = [[26, 402], [76, 418], [130, 438], [182, 458], [226, 468]];
    const flame = P.sample(flameTop.concat(flameBot.slice(1)), false, 5);
    const core = P.sample([[226, 372], [170, 383], [110, 396], [70, 402], [110, 410], [170, 421], [226, 432]], false, 5);
    P.path(flame, { w: 1.1, rough: 1.4, c: '#b3411a', a: 0.85 });
    for (let i = 0; i < 11; i++) {
      const y = 340 + i * 12.6, e = 226 - P.r(90, 200) * (1 - Math.abs(y - AX) / 160);
      const pts = []; for (let x = 226; x > e; x -= 12) pts.push([x, lerp(y, AX + (y - AX) * 0.35, (226 - x) / 200) + P.r(-3, 3)]);
      if (pts.length > 2) P.curve(pts, { w: 0.8, a: 0.6, c: '#c8531e', rough: 1.2 });
    }

    /* ---- washes (colour) ---- */
    P.wash(hull, '#dbe6f0', 0.72, { grad: { x0: 0, y0: 286, x1: 0, y1: 504, c0: '#e4edf5', c1: '#6684a3', a0: 0.62, a1: 0.8 } });
    P.wash(dorsal, '#c8452f', 0.55); P.wash(ventral, '#c8452f', 0.6);
    P.wash(wing, '#9fb6ce', 0.5, { grad: { x0: 900, y0: 490, x1: 740, y1: 700, c0: '#c5d4e3', c1: '#5d7a99', a0: 0.5, a1: 0.75 } });
    P.wash([[1010, 494], [960, 580], [1050, 606], [1080, 560]], '#c8452f', 0.45);
    P.wash(P.sample(canopy, true, 5), '#7cd3e6', 0.7, { grad: { x0: 1150, y0: 310, x1: 1350, y1: 398, c0: '#c9f1f8', c1: '#4bb3cf', a0: 0.65, a1: 0.85 } });
    { const B = P.sample(stripeA, false, 5).concat(P.sample(stripeB, false, 5).reverse()); P.wash(B, '#c8452f', 0.6); }
    wins.forEach(([x, y], i) => { const lit = (i * 7 + 3) % 5 !== 0; P.wash([[x + 1, y + 1], [x + 21, y + 1], [x + 21, y + 13], [x + 1, y + 13]], lit ? '#f6cf55' : '#7f93a6', lit ? 0.85 : 0.55, { jit: 0.4, steps: 3, edge: 0 }); });
    P.wash([[1101, 395], [1141, 395], [1141, 463], [1101, 463]], '#e0a13a', 0.4, { jit: 0.6 });
    P.wash(bell, '#8b9098', 0.6, { grad: { x0: 326, y0: 0, x1: 232, y1: 0, c0: '#b6bbc2', c1: '#6a6f78', a0: 0.6, a1: 0.8 } });
    P.wash(flame, '#f28c28', 0.8, { grad: { x0: 226, y0: 0, x1: 26, y1: 0, c0: '#ffd35a', c1: '#e8512b', a0: 0.85, a1: 0.45 }, steps: 6 });
    P.wash(core, '#fff3b8', 0.85, { steps: 4, edge: 0, jit: 2 });
    [[190, 402, 10, 5], [150, 402, 8, 4], [112, 402, 6, 3]].forEach(([x, y, rx, ry]) => { P.ellipse(x, y, rx, ry, { w: 0.8, a: 0.6, c: '#b3411a', passes: 1 }); });
    P.wash([[898, 210], [902, 210], [902, 226], [898, 226]], '#e63946', 0.9, { steps: 3, edge: 0, jit: 0.3 });
    P.wash(P.sample([[pc[0] - 44, pc[1]], [pc[0], pc[1] - 44], [pc[0] + 44, pc[1]], [pc[0], pc[1] + 44]], true, 6), '#e0b56a', 0.55, { grad: { x0: pc[0] - 40, y0: pc[1] - 40, x1: pc[0] + 40, y1: pc[1] + 40, c0: '#f3d79a', c1: '#b07a3a', a0: 0.55, a1: 0.7 } });
    // planet ring wash
    P.wash(P.sample([[pc[0] - 84, pc[1] + 10], [pc[0], pc[1] - 8], [pc[0] + 84, pc[1] - 26], [pc[0] + 70, pc[1] - 24], [pc[0], pc[1] - 4], [pc[0] - 70, pc[1] + 8]], true, 5), '#c9a26a', 0.4, { edge: 0 });

    /* ---- pencil shading over the colour ---- */
    P.hatch(hull, { ang: -62, gap: 3.6, a: 0.55, w: 0.5, fade: (x, y) => Math.max(0, Math.min(1, (y - 448) / 55)) * 0.95 + (y > 490 ? 0.05 : 0), piece: 12, cross: 40 });
    P.hatch(hull, { ang: -62, gap: 5, a: 0.4, w: 0.5, fade: (x, y) => y < 300 ? 0.55 : 0, piece: 12 });
    P.hatch(dorsal, { ang: 60, gap: 4, a: 0.45, fade: (x, y) => (x > 590 ? 0.8 : 0.15), piece: 14 });
    P.hatch(ventral, { ang: 60, gap: 3.6, a: 0.55, cross: 50 });
    P.hatch(wing, { ang: 55, gap: 3.6, a: 0.5, w: 0.5, fade: (x, y) => Math.max(0.1, Math.min(1, (y - 520) / 150)), piece: 14, cross: 45 });
    P.hatch(bell, { ang: 80, gap: 3, a: 0.5, fade: (x, y) => Math.abs(y - AX) / 90 + 0.1, piece: 10 });
    P.hatch(P.sample(canopy, true, 5), { ang: 40, gap: 9, a: 0.35, w: 0.5, fade: () => 0.6, piece: 20 });
    P.hatch(P.sample([[pc[0] - 44, pc[1]], [pc[0], pc[1] - 44], [pc[0] + 44, pc[1]], [pc[0], pc[1] + 44]], true, 6), { ang: -45, gap: 3.4, a: 0.5, fade: (x, y) => Math.max(0, (x - pc[0] + 20) / 60) + (y - pc[1]) / 120, piece: 8 });
    // cast shadow of the hull under the wing
    P.hatch([[880, 700], [1010, 640], [1100, 640], [1060, 700]], { ang: 20, gap: 5, a: 0.18, w: 0.5 });

    /* ---- section plane A–A on the elevation ---- */
    P.dashed(760, 240, 760, 730, [26, 6, 4, 6], { w: 0.8, a: 0.6 });
    [[760, 244, -1], [760, 726, 1]].forEach(([x, y, s]) => { P.line(x, y, x + 22, y, { w: 1.3, rough: 0.2, passes: 1, over: 0 }); P.line(x + 22, y, x + 14, y - 6 * s, { w: 1.1, rough: 0.2, passes: 1, over: 0 }); P.line(x + 22, y, x + 14, y + 6 * s, { w: 1.1, rough: 0.2, passes: 1, over: 0 }); P.text('A', x - 22, y + 6, { size: 20, font: S.HAND }); });

    /* ---- DETAIL A : nozzle seen from behind ---- */
    { const cx = 210, cy = 815, R = 86;
      P.circle(cx, cy, R, { w: 1.7 }); P.circle(cx, cy, R - 9, { w: 0.9 }); P.circle(cx, cy, R - 24, { w: 1.2 }); P.circle(cx, cy, R - 42, { w: 1 });
      P.circle(cx, cy, 20, { w: 1.3 });
      { const d = []; for (let a = 0; a < 20; a++) d.push([cx + Math.cos(a * 0.314) * (R - 4.5), cy + Math.sin(a * 0.314) * (R - 4.5), 1.3]); P.dots(d, null, 0.85); }
      for (let a = 0; a < 22; a++) { const an = a * TAU / 22; P.curve([[cx + Math.cos(an) * 22, cy + Math.sin(an) * 22], [cx + Math.cos(an + 0.22) * 34, cy + Math.sin(an + 0.22) * 34], [cx + Math.cos(an + 0.42) * (R - 43), cy + Math.sin(an + 0.42) * (R - 43)]], { w: 0.8, a: 0.8, passes: 1, rough: 0.3 }); }
      for (let a = 0; a < 12; a++) { const an = a * TAU / 12 + 0.2; P.line(cx + Math.cos(an) * (R - 42), cy + Math.sin(an) * (R - 42), cx + Math.cos(an) * (R - 24), cy + Math.sin(an) * (R - 24), { w: 0.9, passes: 1, over: 0, rough: 0.2 }); }
      const ring = (r0, r1) => { const p = []; for (let a = 0; a <= 40; a++) p.push([cx + Math.cos(a * TAU / 40) * r1, cy + Math.sin(a * TAU / 40) * r1]); for (let a = 40; a >= 0; a--) p.push([cx + Math.cos(a * TAU / 40) * r0, cy + Math.sin(a * TAU / 40) * r0]); return p; };
      P.wash(ring(R - 24, R), '#8b9098', 0.5, { jit: 0.4, edge: 0 });
      P.wash(ring(0, 20), '#ffb347', 0.85, { jit: 0.4 });
      P.wash(ring(20, R - 42), '#6b7280', 0.35, { jit: 0.4, edge: 0 });
      P.hatch(ring(R - 42, R - 24), { ang: 30, gap: 3.2, a: 0.4 });
      P.hatch(ring(R - 24, R - 9), { ang: -30, gap: 3.4, a: 0.35, fade: (x, y) => (x - cx) / R * 0.5 + 0.5 });
      P.dashed(cx - R - 18, cy, cx + R + 18, cy, [14, 4, 3, 4], { w: 0.6, a: 0.5 }); P.dashed(cx, cy - R - 18, cx, cy + R + 18, [14, 4, 3, 4], { w: 0.6, a: 0.5 });
      P.dashed(233, 484, 214, 722, [6, 4], { w: 0.6, a: 0.55 });
      P.label('DETAIL A', cx - 70, 930, { size: 20 }); P.text('nozzle, seen from aft', cx - 70, 950, { size: 17 });
      P.note('22 turbine vanes', cx + 100, 742, cx + 40, 770, { size: 18 });
      P.note('flame tube', cx + 100, 860, cx + 8, 820, { size: 18 });
    }
    /* ---- SECTION A–A : two decks in a pressure hull ---- */
    { const cx = 560, cy = 815, R = 86;
      P.circle(cx, cy, R, { w: 1.7 }); P.circle(cx, cy, R - 8, { w: 0.9 });
      const chord = dy => Math.sqrt(R * R - dy * dy) - 9;
      [-46, -14, 20, 52].forEach((dy, i) => { const c = chord(dy); P.line(cx - c, cy + dy, cx + c, cy + dy, { w: i === 1 ? 1.5 : 1, rough: 0.4 }); });
      P.line(cx, cy - 46, cx, cy - 14, { w: 0.8, a: 0.7, rough: 0.3 }); P.line(cx, cy + 20, cx, cy + 52, { w: 0.8, a: 0.7 });
      // bunks, tables, crew
      P.rect(cx - 50, cy - 30, 22, 14, { w: 0.7, rough: 0.3 }); P.rect(cx + 28, cy - 30, 22, 14, { w: 0.7, rough: 0.3 });
      P.circle(cx - 39, cy - 36, 4, { w: 0.8, passes: 1 }); P.line(cx - 39, cy - 32, cx - 39, cy - 26, { w: 0.8, passes: 1, over: 0 });
      P.circle(cx + 14, cy - 55, 4.4, { w: 0.9, passes: 1 }); P.line(cx + 14, cy - 51, cx + 14, cy - 40, { w: 0.9, passes: 1, over: 0 }); P.line(cx + 6, cy - 46, cx + 22, cy - 46, { w: 0.9, passes: 1, over: 0 });
      P.circle(cx - 20, cy - 55, 4.4, { w: 0.9, passes: 1 }); P.line(cx - 20, cy - 51, cx - 20, cy - 40, { w: 0.9, passes: 1, over: 0 });
      P.circle(cx - 26, cy + 38, 9, { w: 1 }); P.circle(cx, cy + 38, 9, { w: 1 }); P.circle(cx + 26, cy + 38, 9, { w: 1 });
      P.circle(cx - 26, cy + 38, 4, { w: 0.5, a: 0.6, passes: 1 }); P.circle(cx, cy + 38, 4, { w: 0.5, a: 0.6, passes: 1 }); P.circle(cx + 26, cy + 38, 4, { w: 0.5, a: 0.6, passes: 1 });
      P.rect(cx - 34, cy + 62, 68, 10, { w: 0.8, rough: 0.3 });
      for (let i = 0; i < 6; i++) P.line(cx - 30 + i * 12, cy + 62, cx - 30 + i * 12, cy + 72, { w: 0.5, a: 0.6, passes: 1, over: 0 });
      const ring = []; for (let a = 0; a <= 48; a++) ring.push([cx + Math.cos(a * TAU / 48) * R, cy + Math.sin(a * TAU / 48) * R]); for (let a = 48; a >= 0; a--) ring.push([cx + Math.cos(a * TAU / 48) * (R - 8), cy + Math.sin(a * TAU / 48) * (R - 8)]);
      P.hatch(ring, { ang: 45, gap: 2.6, a: 0.7, inset: 0.2 });
      P.wash(ring, '#6684a3', 0.55, { jit: 0.3, edge: 0 });
      P.wash([[cx - 42, cy - 12], [cx + 42, cy - 12], [cx + 42, cy + 18], [cx - 42, cy + 18]], '#f6cf55', 0.35, { jit: 0.4, edge: 0 });
      [[-26], [0], [26]].forEach(([dx]) => P.wash(P.sample([[cx + dx - 9, cy + 38], [cx + dx, cy + 29], [cx + dx + 9, cy + 38], [cx + dx, cy + 47]], true, 3), '#c8452f', 0.45, { jit: 0.3, edge: 0 }));
      P.label('SECTION  A – A', cx - 70, 930, { size: 20 }); P.text('pressure hull, 2 decks', cx - 70, 950, { size: 17 });
      P.note('crew deck', cx + 100, 752, cx + 30, 780, { size: 18 });
      P.note('cargo drums', cx + 100, 892, cx + 34, 858, { size: 18 });
    }
    /* ---- PLAN VIEW (mirrored about the axis) ---- */
    { const ay = 822, mir = pts => pts.map(([x, y]) => [x, 2 * ay - y]);
      const halfHull = [[770, ay - 2], [790, ay - 14], [860, ay - 20], [980, ay - 22], [1090, ay - 16], [1150, ay - 6], [1174, ay]];
      P.curve(halfHull, { w: 1.5, rough: 0.5 }); P.curve(mir(halfHull), { w: 1.5, rough: 0.5 });
      P.line(770, ay - 2, 770, ay + 2, { w: 1.2, passes: 1 });
      const w1 = [[1040, ay - 20], [990, ay - 44], [880, ay - 86], [808, ay - 96], [800, ay - 88], [826, ay - 30], [850, ay - 20]];
      P.pl(w1, { w: 1.4, rough: 0.6 }); P.pl(mir(w1), { w: 1.4, rough: 0.6 });
      P.ellipse(806, ay - 92, 4, 10, { w: 0.9, rot: 0.3, passes: 1 }); P.ellipse(806, ay + 92, 4, 10, { w: 0.9, rot: -0.3, passes: 1 });
      const tail = [[790, ay - 14], [772, ay - 34], [790, ay - 32], [826, ay - 18]];
      P.pl(tail, { w: 1.1 }); P.pl(mir(tail), { w: 1.1 });
      P.ellipse(1112, ay, 40, 11, { w: 0.8, a: 0.8, passes: 1 });
      P.line(760, ay, 1190, ay, { w: 0.5, a: 0.4 });
      P.dashed(700, ay, 1200, ay, [24, 5, 3, 5], { w: 0.6, a: 0.5 });
      for (let i = 0; i < 5; i++) { const f = i / 5; P.line(lerp(1000, 830, f), ay - lerp(22, 88, f), lerp(1030, 842, f), ay - 22, { w: 0.4, a: 0.4, passes: 1, over: 0 }); P.line(lerp(1000, 830, f), ay + lerp(22, 88, f), lerp(1030, 842, f), ay + 22, { w: 0.4, a: 0.4, passes: 1, over: 0 }); }
      const hp = P.sample(halfHull.concat(mir(halfHull).reverse()), false, 5);
      P.wash(hp, '#c5d4e3', 0.55); P.wash(w1, '#9fb6ce', 0.5); P.wash(mir(w1), '#9fb6ce', 0.5);
      P.wash([[806, ay - 88], [826, ay - 30], [800, ay - 88]], '#c8452f', 0.5); P.wash(P.sample([[820, ay - 60], [850, ay - 62], [808, ay - 96], [800, ay - 88]], true, 4), '#c8452f', 0.5); P.wash(mir(P.sample([[820, ay - 60], [850, ay - 62], [808, ay - 96], [800, ay - 88]], true, 4)), '#c8452f', 0.5);
      P.hatch(mir(halfHull).concat(halfHull.slice().reverse()).length ? P.sample(halfHull.concat(mir(halfHull).reverse()), false, 5) : hp, { ang: 60, gap: 4, a: 0.5, fade: (x, y) => y > ay ? 0.9 : 0.1, piece: 12 });
      P.label('PLAN', 900, 930, { size: 20 }); P.text('wing-span 190 ft, sweep 34°', 900, 950, { size: 17 });
      P.dim(806, ay - 92, 806, ay + 92, 'span 58 m', 52);
    }

    /* ---- overall dimension & notes ---- */
    P.dashed(232, 388, 232, 116, [8, 5], { w: 0.5, a: 0.4 }); P.dashed(1452, 405, 1452, 116, [8, 5], { w: 0.5, a: 0.4 });
    P.dim(232, 130, 1452, 130, 'L.O.A.   182 m', -20, { size: 17 });
    P.dim(1462, 158, 1462, 606, 'ht. 46 m', -30, { size: 15 });
    P.note('comms mast', 940, 178, 903, 214, { size: 21 });
    P.note('heat vents', 760, 212, 800, 296, { size: 20 });
    P.note('dorsal fin  (fleet red)', 402, 150, 484, 214, { size: 20 });
    P.note('cockpit: 2 seats + jump seat', 1200, 250, 1240, 316, { size: 20 });
    P.note('airlock', 1196, 526, 1142, 462, { size: 20 });
    P.note('passenger windows  x15', 1210, 618, 1032, 430, { size: 20 });
    P.note('cooling ribs', 300, 250, 280, 336, { size: 20 });
    P.note('main drive  (fusion torch)', 60, 590, 200, 452, { size: 21 });
    P.note('exhaust: 3,000 K, shock diamonds', 34, 300, 130, 372, { size: 18 });
    P.note('wing-tip nav light', 900, 738, 718, 700, { size: 18, align: 'left' });
    P.note('ventral fin', 470, 650, 540, 590, { size: 20 });
    P.note('RCS block', 1300, 496, 1350, 446, { size: 19 });
    P.text('rev. C  –  fins repainted', 1200, 700, { size: 17, a: 0.6, rot: -0.03 });
  }
});
