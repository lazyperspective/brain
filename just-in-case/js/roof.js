// roof.js -- the roof garden after rain: parapet, wet floor, puddles holding the sky.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp, mix = A.mix;
  const S = A.S, PAS = S.PAS, c = S.c, F = S.F, VX = S.VX, HY = S.HY, E = S.E, fl = S.fl, gs = S.gs;

  // the wheel stands here; its lamps warm everything near it
  const WH = (S.WH = { x: 10, z: 17, hub: 4.9, r: 3.3, yaw: 0.17 });
  // a mercury lamp on a pole, out of the picture above our left shoulder
  const LAMP = (S.LAMP = [-2.5, 5.6, 5.9]);
  const lampI = (S.lampI = (x, h, z, nx, ny, nz) => { const dx = LAMP[0] - x, dy = LAMP[1] - h, dz = LAMP[2] - z, d = Math.hypot(dx, dy, dz); return clamp(24 * Math.max(0, nx * dx + ny * dy + nz * dz) / (d * d * d), 0, 1.3); });
  const warmI = (S.warmI = (x, z) => Math.exp(-Math.hypot((x - WH.x) * 0.8, z - (WH.z - 1.6)) / 5.2));
  const cMint = hx('#9ccfc6'), cWarm = hx('#f0907a');

  // puddles: [x, z, rx, rz]
  const PUD = [[3.4, 9.9, 1.9, 1.0], [8.2, 11.6, 3.0, 1.5], [0.6, 6.5, 1.6, 0.55], [5.0, 7.3, 1.9, 0.7], [12.2, 9.2, 2.2, 1.0], [6.0, 14.6, 1.5, 1.3], [13, 13.4, 1.6, 0.8], [11, 22.5, 4, 2.6], [-1.2, 7.7, 0.9, 0.45], [8.6, 5.9, 1.4, 0.5], [15, 18.5, 2.4, 1.5]];
  function puddle(x, z) {
    let v = -9;
    for (const p of PUD) { const a = (x - p[0]) / p[2], b = (z - p[1]) / p[3], d = 1 - a * a - b * b; if (d > v) v = d; }
    return v + 0.6 * (A.fbm(x * 0.8, z * 0.8, 3, 51) - 0.5);
  }
  S.puddle = puddle;
  function concrete(x, z) {
    const tile = A.ih(Math.floor(x / 2), Math.floor(z / 2), 77), n = A.fbm(x * 0.7, z * 0.7, 3, 31);
    return mix3(hx('#272352'), hx('#403a72'), clamp(0.2 + 0.55 * n + 0.3 * (tile - 0.5), 0, 1));
  }
  // the inner face of the near wall
  function wallCol(sx, y) {
    const fy = S.footY(sx), ty = S.topY(sx), v = clamp((y - ty) / (fy - ty), 0, 1);
    const z = F * E / (fy - HY), x = (sx - VX) * z / F, h = (1 - v) * S.PH;
    let col = mix3(hx('#2b275e'), hx('#3b3672'), A.fbm(sx / 90, y / 40, 2, 41));
    col = mix3(col, hx('#1a1742'), clamp(0.55 * v * v * v + 0.16 * ss(0.5, 0.75, A.fbm(sx / 26, y / 90, 2, 43)), 0, 0.8));   // grime and old runs
    col = mix3(col, hx('#4a55a8'), 0.2 * (1 - v));
    col = mix3(col, cMint, clamp(lampI(x, h, z, 0.515, 0, -0.857) * 3.4 - 0.12, 0, 0.55));
    return col;
  }
  S.wallCol = wallCol;
  // what a perfect mirror lying on the floor would show
  function mirror(sx, sy) {
    if (sx < S.KX) { const fy = S.footY(sx), hgt = fy - S.topY(sx); if (sy - fy < hgt) return mix3(wallCol(sx, fy - (sy - fy)), hx('#1d1a46'), 0.25); }
    if (sy < S.FARY + (S.FARY - S.FARTOP)) return hx('#4a3466');
    { const zf = 24; if (sx > VX + F * 17 / zf && sy < HY + F * (E + 3.4) / zf) return mix3(hx('#2a2458'), hx('#5a3a78'), ss(680, 540, sy));
      if (sx > VX + F * 17 / 29 && sx <= VX + F * 17 / zf) { const z = 17 * F / (sx - VX); if (sy < HY + F * (E + 3.4) / z) return hx('#27224e'); } }
    { const hubX = VX + F * WH.x / WH.z, g = gs((sx - hubX) / 190) * ss(560, 700, sy) * ss(905, 760, sy);
      return mix3(S.skyAll(sx + (A.vn(sx / 40, sy / 6, 3) - 0.5) * 14, clamp(HY - 22 - (sy - HY) * 0.56, 3, 396)), hx('#b070a8'), 0.3 * g); }       // (the sheet is kinder than optics: more of the sky gets into the water)
  }
  function floorCol(sx, sy) {
    const p = S.floorAt(sx, sy), x = p[0], z = p[1], pd = puddle(x, z);
    let base = concrete(x, z);
    base = mix3(base, cMint, clamp(lampI(x, 0, z, 0, 1, 0) * 0.85 - 0.05, 0, 0.78));
    const wi = warmI(x, z);
    base = mix3(base, cWarm, clamp(wi * 0.85, 0, 0.7));
    let wet = 0.26 + 0.26 * A.fbm(x * 0.5 + 9, z * 0.5, 2, 61) + 0.45 * ss(680, 505, sy) + 0.34 * ss(0.5, 0.66, A.fbm(x * 0.2 + 3, z * 1.7, 3, 71));   // long streaks where a film of water still lies
    if (pd > 0) wet = 0.93; else if (pd > -0.3) wet = Math.max(wet, 0.55);
    let m = mirror(sx, sy);
    if (pd <= 0) m = mix3(m, hx('#ff9c8a'), clamp(wi * 0.5, 0, 0.45));          // damp concrete takes the lamps as a sheen
    return mix3(base, m, clamp(wet, 0, 0.95));
  }
  S.floorCol = floorCol;

  S.drawRoof = function (C, rng) {
    const PH = S.PH, PT = S.PT, TK = S.TK, L2 = S.L2;
    // ---------------- the floor
    const onF = (x, y) => (S.onFloor(x, y) ? 1 : 0);
    A.field(C, rng, { box: [-40, 498, 1640, 915], sp: 13, order: 'scan', mask: (x, y) => (S.onFloor(x, y - 4) || S.onFloor(x, y) ? 1 : 0), col: floorCol, dir: () => 0.0, len: [40, 150], w: [9, 18], p: [0.9, 1.1], med: M.pastel, sticks: PAS, spread: 0.035, wob: 0.9, dj: 0.03 });
    for (let y = 508; y < 905; y += 10) { const xy = []; for (let x = -20; x <= 1620; x += 12) if (S.onFloor(x, y)) xy.push(x, y + rng.g()); if (xy.length > 6) C.rub(rng() < 0.5 ? xy : A.rev(xy), 10, 0.45, 0.7); }
    A.field(C, rng, { box: [-40, 500, 1640, 915], sp: 8.5, mask: onF, clip: true, col: floorCol, dir: () => 0.0, len: [20, 90], w: [4, 9], p: [0.75, 1.0], med: M.pastel, sticks: PAS, spread: 0.05, wob: 0.6, dj: 0.03, overP: 0 });
    // standing water: laid level, then smoothed with a fingertip until it is glass
    const inP = (x, y) => { if (!S.onFloor(x, y)) return 0; const p = S.floorAt(x, y); return puddle(p[0], p[1]) > 0.06 ? 1 : 0; };
    A.field(C, rng, { box: [-40, 500, 1640, 915], sp: 6, order: 'scan', mask: inP, clip: true, col: mirror, dir: () => 0, len: [16, 60], w: [3.5, 7], p: [0.95, 1.1], med: M.pastel, sticks: PAS, spread: 0.03, wob: 0.4, dj: 0.02, overP: 0 });
    for (let pass = 0; pass < 2; pass++) for (let y = 506; y < 904; y += 5) {
      let run = [];
      const flush = () => { if (run.length >= 4) C.rub(pass ? A.rev(run) : run, 5.5, 0.55, 0.6); run = []; };
      for (let x = -10; x <= 1610; x += 9) { if (inP(x, y)) run.push(x, y + rng.g() * 0.6); else flush(); }
      flush();
    }
    A.field(C, rng, { box: [-40, 500, 1640, 915], sp: 7, mask: inP, clip: true, col: (x, y) => mix3(mirror(x, y), c.white, 0.08), dir: () => 0, len: [10, 44], w: [1.6, 3.4], p: [0.5, 0.8], med: M.pastelTip, sticks: PAS, spread: 0.05, wob: 0.3, dj: 0.02, overP: 0, prob: () => 0.5 });
    // the merely damp: a few upright touches where something bright stands over it
    A.field(C, rng, { box: [-40, 500, 1640, 915], sp: 9, mask: (x, y) => (onF(x, y) && !inP(x, y) ? 1 : 0), clip: true, col: (x, y) => mix3(floorCol(x, y), mirror(x, y), 0.5), dir: () => 1.57, len: [8, 26], w: [2, 4.4], p: [0.4, 0.7], med: M.pastelTip, sticks: PAS, spread: 0.05, wob: 0.5, dj: 0.05, overP: 0, prob: () => 0.22 });
    for (let k = 0; k < 200; k++) { const x = rng.r(0, 1600), y = rng.r(510, 900); if (!S.onFloor(x, y) || inP(x, y)) continue; C.rub([x - 26, y, x, y + rng.g(), x + 26, y], rng.r(4, 8), 0.3, 0.75); }
    // joints between the slabs, drawn toward the vanishing point and across
    const jc = hx('#17143c');
    const jseg = (x0, z0, x1, z1) => {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.9); let run = [];
      const flush = () => { if (run.length >= 4) A.line(C, rng, run, M.pencil, jc, clamp(26 / (run.z || 10), 0.7, 2.2), rng.r(0.45, 0.8), { wob: 0.25, pj: 0.5, step: 6 }); run = []; };
      for (let k = 0; k <= n; k++) {
        const x = mix(x0, x1, k / n), z = mix(z0, z1, k / n);
        if (z < 3.4) { flush(); continue; }
        const s = fl(x, z, 0);
        if (s[1] > 905 || s[0] < -10 || s[0] > 1610 || !S.onFloor(s[0], s[1] + 0.5) || puddle(x, z) > 0.05 || rng() < 0.04) { flush(); continue; }
        run.push(s[0], s[1]); run.z = z;
      }
      flush();
    };
    for (let x = -6; x <= 30; x += 2) jseg(x, 3.5, x, 29.2);
    for (let z = 4; z <= 29; z += 2) jseg(-6, z, 30, z);
    // a pale edge on the far side of each joint where the slab has lifted a little
    for (let k = 0; k < 220; k++) { const x = Math.round(rng.r(-3, 15)) * 2 + 0.03, z = rng.r(4, 26), s0 = fl(x, z, 0), s1 = fl(x, z + rng.r(0.4, 1.2), 0); if (!S.onFloor(s0[0], s0[1]) || !S.onFloor(s1[0], s1[1]) || puddle(x, z) > 0) continue; A.line(C, rng, [s0[0] + 1.2, s0[1], s1[0] + 1.2, s1[1]], M.pencil, hx('#6a7cc8'), 0.7, 0.35, { wob: 0.2 }); }
    // puddle rims: dark on the near lip, a line of sky on the far one
    for (const p of PUD) {
      let prev = null;
      for (let a = 0; a <= 6.4; a += 0.09) {
        let lo = 0.3, hi = 1.9;                               // find the rim along this ray
        for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (puddle(p[0] + Math.cos(a) * p[2] * m, p[1] + Math.sin(a) * p[3] * m) > 0) lo = m; else hi = m; }
        const x = p[0] + Math.cos(a) * p[2] * lo, z = p[1] + Math.sin(a) * p[3] * lo, s = fl(x, Math.max(3.4, z), 0);
        const ok = z > 3.5 && s[1] < 905 && S.onFloor(s[0], s[1]);
        if (prev && ok && prev.ok && rng() < 0.9) {
          const nearLip = Math.sin(a) < 0;
          A.line(C, rng, [prev.s[0], prev.s[1], s[0], s[1]], M.pencil, nearLip ? hx('#14113a') : hx('#aec4ee'), nearLip ? 1.3 : 0.8, nearLip ? 0.7 : 0.45, { wob: 0.3 });
        }
        prev = { s, ok };
      }
    }
    // painted footprints from long ago, leading a queue that isn't there toward the wheel
    {
      const path = A.curve([1.6, 6.0, 3.6, 7.6, 6.2, 9.4, 8.6, 11.2, 10.4, 12.6, 11.6, 13.4], 10);
      let acc = 0, side = 1;
      for (let i = 2; i < path.length; i += 2) {
        const dx = path[i] - path[i - 2], dz = path[i + 1] - path[i - 1], d = Math.hypot(dx, dz); acc += d;
        if (acc < 0.52) continue; acc = 0; side = -side;
        const ux = dx / d, uz = dz / d, cx = path[i] - uz * 0.14 * side, cz = path[i + 1] + ux * 0.14 * side;
        if (puddle(cx, cz) > 0.1) continue;
        const fade = rng.r(0.35, 0.9);
        const a = fl(cx - ux * 0.08, cz - uz * 0.08, 0), b = fl(cx + ux * 0.1, cz + uz * 0.1, 0), hl = fl(cx - ux * 0.17, cz - uz * 0.17, 0), sc = F / cz;
        if (!S.onFloor(a[0], a[1])) continue;
        const col = mix3(hx('#fbe8a8'), floorCol(a[0], a[1]), 0.25);
        C.stroke(A.hand(rng, [a[0], a[1], b[0], b[1]], { wob: 0.2, step: 2, pe: 0.7 }), M.pastelTip, col, 0.085 * sc, fade);
        A.dot(C, rng, hl[0], hl[1], M.pastelTip, col, 0.07 * sc, fade * 0.9);
      }
    }

    // ---------------- the near wall
    const wallM = (x, y) => (x < S.KX + 1 && y > S.topY(x) && y < S.footY(x) + 1 ? 1 : 0);
    const wdir = -0.208;
    A.field(C, rng, { box: [-40, 560, 930, 900], sp: 9, order: 'scan', mask: wallM, clip: true, col: wallCol, dir: () => wdir, len: [40, 120], w: [8, 14], p: [0.95, 1.12], med: M.pastel, sticks: PAS, spread: 0.03, wob: 0.6, dj: 0.02, overP: 0 });
    for (let pass = 0; pass < 2; pass++) for (let v = 0.08; v < 1; v += 0.11) { const xy = []; for (let x = -10; x <= S.KX; x += 14) xy.push(x, mix(S.topY(x), S.footY(x), v) + rng.g()); C.rub(pass ? A.rev(xy) : xy, 9, 0.5, 0.65); }
    A.field(C, rng, { box: [-40, 560, 930, 900], sp: 7, mask: wallM, clip: true, col: wallCol, dir: () => wdir, len: [20, 70], w: [3, 6], p: [0.6, 0.9], med: M.pastelTip, sticks: PAS, spread: 0.04, wob: 0.4, dj: 0.03, overP: 0, prob: () => 0.7 });
    for (let v = 0.12; v < 1; v += 0.2) { const xy = []; for (let x = -10; x <= S.KX; x += 14) xy.push(x, mix(S.topY(x), S.footY(x), v) + rng.g()); C.rub(xy, 7, 0.3, 0.7); }
    A.field(C, rng, { box: [-40, 560, 930, 900], sp: 6.5, mask: wallM, clip: true, col: (x, y) => mix3(wallCol(x, y), hx('#14113a'), 0.45), dir: () => -0.78, len: [7, 18], w: [0.9, 1.4], p: [0.3, 0.55], med: M.pencil, wob: 0.3, dj: 0.06, overP: 0, prob: (x, y) => 0.25 + 0.4 * ss(0.4, 1, (y - S.topY(x)) / (S.footY(x) - S.topY(x))) });
    // the dark seam where wall meets floor
    { const a = S.par(-0.5, 0), b = S.par(TK, 0); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.conte, hx('#100e36'), 2.6, 0.95, { wob: 0.6, step: 10, pj: 0.3 }); A.line(C, rng, [a[0], a[1] + 1, b[0], b[1] + 0.6], M.pencil, hx('#0c0a22'), 1.2, 0.8, { wob: 0.6, step: 10 }); }
    // the board marks of the formwork, a joint every few metres, rust weeping from the rail posts
    for (const hh of [0.38, 0.77]) for (let t = -0.4; t < TK; t += 1.5) { const a = S.par(t, hh), b = S.par(Math.min(TK, t + rng.r(1.0, 1.5)), hh); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, hx('#1d1a46'), 0.9, rng.r(0.25, 0.55), { wob: 0.4 }); }
    for (let t = 0.6; t < TK; t += 3) { const a = S.par(t, PH), b = S.par(t, 0); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, hx('#17143c'), 1.3 * (9 / (6 + t * 0.5)), 0.7, { wob: 0.3, reps: 2, off: 0.5 }); A.line(C, rng, [a[0] + 1.6, a[1], b[0] + 1.6, b[1]], M.pencil, hx('#6a7cc8'), 0.7, 0.35, { wob: 0.3 }); }
    for (let t = 0.25; t < TK; t += 1.2) {
      const n = rng.i(1, 3);
      for (let q = 0; q < n; q++) { const tt = t + rng.g() * 0.05, len = rng.r(0.25, 0.9), a = S.par(tt, PH - 0.02), b = S.par(tt + rng.g() * 0.02, PH - len); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pastelTip, hx(rng() < 0.5 ? '#8a4a4a' : '#5e2a50'), rng.r(1.2, 3) * (9 / (6 + t * 0.5)), rng.r(0.3, 0.6), { wob: 0.5, t0: 0.05, t1: 0.7, pe: 0.1 }); }
    }
    // a scupper where the rain goes out, and its stain
    { const t = 4.6, a = S.par(t - 0.16, 0.2), b = S.par(t + 0.16, 0.02); S.rect(C, rng, a[0], a[1], b[0], b[1], hx('#0c0a22'), { w: 2 }); A.line(C, rng, [a[0] - 1, a[1] - 1, b[0] + 1, a[1] - 1.6], M.pencil, hx('#6a7cc8'), 0.9, 0.6);
      for (let q = 0; q < 6; q++) { const s = S.par(t + rng.g() * 0.2, 0); A.line(C, rng, [s[0], s[1], s[0] + rng.r(-30, 10), s[1] + rng.r(6, 20)], M.pastelTip, hx('#17143c'), rng.r(2, 5), 0.4, { wob: 1, pe: 0.1, t1: 0.6 }); } }
    // electrical conduit along the foot, with its clamps and a junction box
    { const xy = []; for (let t = -0.4; t <= 2.6; t += 0.3) { const s = S.par(t, 0.24); xy.push(s[0], s[1]); } A.line(C, rng, xy, M.pencil, hx('#14113a'), 2.2, 0.9, { wob: 0.3, step: 8 }); const xy2 = xy.map((v, i) => (i % 2 ? v - 1.3 : v)); A.line(C, rng, xy2, M.pencil, hx('#8a9ad8'), 0.8, 0.55, { wob: 0.3, step: 8 });
      for (let t = 0; t <= 2.6; t += 0.65) { const s = S.par(t, 0.24); A.line(C, rng, [s[0], s[1] - 3, s[0], s[1] + 3], M.pencil, hx('#8480a8'), 1.1, 0.7); } }
    // the top of the wall: it sees the whole sky, and the lamp
    const topCol = (t, seg) => { const p = seg === 2 ? [S.K[0] + S.D2[0] * t, S.K[1] + S.D2[1] * t] : [S.PA[0] + S.PD[0] * t, S.PA[1] + S.PD[1] * t]; return mix3(mix3(mix3(hx('#5a60b0'), hx('#7a84cc'), rng()), cMint, clamp(lampI(p[0], PH, p[1], 0, 1, 0) * 0.5, 0, 0.75)), hx('#ffaa94'), clamp(warmI(p[0], p[1]) * 0.9, 0, 0.6)); };
    for (let t = -0.5; t < TK; t += 0.45) {
      const q = S.P4(S.par(t, PH), S.par(t + 0.5, PH), S.par(t + 0.5, PH, PT), S.par(t, PH, PT));
      S.solid(C, rng, q, PAS.near(topCol(t, 1), rng, 0.03), { ang: Math.atan2(q[3] - q[1], q[2] - q[0]), w: clamp((q[1] - q[7]) * 0.6, 1.4, 5), med: M.pastelTip, single: true, over: 0.6 });
    }
    { const a = S.par(-0.5, PH), b = S.par(TK, PH); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, hx('#d2dff6'), 1.1, 0.7, { wob: 0.5, reps: 2, off: 0.5, step: 10 }); const a2 = S.par(-0.5, PH, PT), b2 = S.par(TK, PH, PT); A.line(C, rng, [a2[0], a2[1], b2[0], b2[1]], M.pencil, hx('#17143c'), 1.0, 0.8, { wob: 0.4, step: 10 }); }
    // ---------------- seg 2 and the far wall: the wheel's lamps reach these
    {
      const f0 = S.par2(0, 0), f1 = S.par2(L2, 0), t0 = S.par2(0, PH), t1 = S.par2(L2, PH), o0 = S.par2(0, PH, PT), o1 = S.par2(L2, PH, PT);
      A.hatch(C, rng, [f0[0], f0[1], t0[0], t0[1], t1[0], t1[1], f1[0], f1[1]], { ang: 1.5, gap: 1.6, med: M.pastelTip, col: (x, y) => PAS.near(mix3(hx('#3c3270'), hx('#c0707c'), ss(700, 480, y) * 0.8), rng, 0.04), w: 3, p: 1.05, over: 0.4 });
      A.hatch(C, rng, [t0[0], t0[1], o0[0], o0[1], o1[0], o1[1], t1[0], t1[1]], { ang: 1.45, gap: 1.6, med: M.pastelTip, col: (x, y) => PAS.near(mix3(hx('#6a70c0'), hx('#ffb09a'), ss(620, 470, y) * 0.7), rng, 0.04), w: 3, p: 1.05, over: 0.4 });
      A.line(C, rng, [t0[0], t0[1], t1[0], t1[1]], M.pencil, hx('#ffe0c8'), 1.0, 0.7, { wob: 0.3 });
      A.line(C, rng, [f0[0], f0[1], f1[0], f1[1]], M.pencil, hx('#17143c'), 1.4, 0.85, { wob: 0.3, reps: 2, off: 0.4 });
      A.line(C, rng, [o0[0], o0[1], o1[0], o1[1]], M.pencil, hx('#17143c'), 1.0, 0.8, { wob: 0.3 });
      A.line(C, rng, [f0[0], f0[1] + 2, t0[0], t0[1] - 1], M.pencil, hx('#17143c'), 1.6, 0.9, { wob: 0.3, reps: 2, off: 0.5 });
      // far wall
      const X0 = f1[0], Y0 = S.FARTOP, Y1 = S.FARY;
      const farC = (x, y) => mix3(mix3(hx('#3a3270'), hx('#d0807a'), 0.75 * gs((x - (VX + F * WH.x / S.Q[1])) / 170)), hx('#1d1a46'), 0.3 * ss(Y0, Y1, y));
      A.hatch(C, rng, [X0, Y0, 1620, Y0, 1620, Y1 + 1, X0, Y1 + 1], { ang: 1.5, gap: 2.0, med: M.pastelTip, col: (x, y) => PAS.near(farC(x, y), rng, 0.04), w: 3.4, p: 1.05, over: 0.4 });
      A.hatch(C, rng, [X0, Y0, 1620, Y0, 1620, Y1 + 1, X0, Y1 + 1], { ang: 0.02, gap: 3.4, med: M.pastelTip, col: (x, y) => PAS.near(farC(x, y), rng, 0.05), w: 2.6, p: 0.9, over: 0.4 });
      A.line(C, rng, [X0, Y0, 1620, Y0 - 0.5], M.pencil, hx('#ffc6a8'), 1.1, 0.75, { wob: 0.4, reps: 2, off: 0.4, step: 10 });
      A.line(C, rng, [X0, Y0 - 2.8, 1620, Y0 - 3.2], M.pastelTip, hx('#7a84cc'), 2.4, 0.9, { wob: 0.3, step: 10 });
      A.line(C, rng, [X0, Y1, 1620, Y1], M.pencil, hx('#17143c'), 1.3, 0.85, { wob: 0.4, reps: 2, off: 0.4, step: 10 });
      for (let x = S.Q[0] + 3; x < 40; x += 6) { const sx = VX + F * x / S.Q[1]; if (sx > 1620) break; A.line(C, rng, [sx, Y0, sx, Y1], M.pencil, hx('#231e50'), 0.9, 0.45, { wob: 0.2 }); }
    }
    // ---------------- the handrail: one pipe on short posts, all round
    {
      const rc = hx('#12103a'), hi = hx('#9aa6e0');
      const rail = (fn, t0, t1, dt) => {
        const xy = []; for (let t = t0; t <= t1 + 1e-6; t += dt / 3) { const s = fn(t, PH + 0.3, PT * 0.5); xy.push(s[0], s[1]); }
        const wd = z => clamp(0.055 * F / z, 0.8, 9);
        for (let t = t0; t <= t1 + 1e-6; t += dt) {
          const a = fn(t, PH, PT * 0.5), b = fn(t, PH + 0.3, PT * 0.5), z = F * (E - PH) / (a[1] - HY);
          A.line(C, rng, [a[0], a[1], b[0], b[1] - 0.5], M.conte, rc, wd(z), 1.05, { wob: 0.1, pe: 0.8 });
          if (wd(z) > 2.5) A.line(C, rng, [a[0] - wd(z) * 0.3, a[1], b[0] - wd(z) * 0.3, b[1]], M.pencil, hi, 0.8, 0.6, { wob: 0.1 });
        }
        for (let i = 0; i + 3 < xy.length; i += 2) {
          const z = F * (E - PH - 0.3) / (xy[i + 1] - HY), w = wd(z);
          A.line(C, rng, [xy[i], xy[i + 1], xy[i + 2], xy[i + 3]], M.conte, rc, w, 1.05, { wob: 0.15, pe: 0.9 });
          if (w > 1.6) A.line(C, rng, [xy[i], xy[i + 1] - w * 0.3, xy[i + 2], xy[i + 3] - w * 0.3], M.pencil, hi, Math.max(0.7, w * 0.22), 0.7, { wob: 0.15 });
        }
      };
      rail(S.par, -0.6, TK, 1.2); rail(S.par2, 0, L2, 2.5);
      const Y = HY + F * (E - PH - 0.3) / S.Q[1]; A.line(C, rng, [S.par2(L2, 0)[0], Y, 1620, Y - 0.4], M.pencil, rc, 1.3, 0.95, { wob: 0.3, step: 10 });
      for (let x = S.Q[0]; x < 40; x += 2.5) { const sx = VX + F * x / S.Q[1]; if (sx > 1620) break; A.line(C, rng, [sx, S.FARTOP, sx, Y], M.pencil, rc, 1.1, 0.9); }
    }
    // a creeper has come over the wall from somewhere below and is letting itself down the inside
    {
      const leafC = () => { const r = rng(); return r < 0.34 ? hx('#123a44') : r < 0.62 ? hx('#1a4a44') : r < 0.82 ? hx('#2a6a54') : r < 0.93 ? hx('#5a9a68') : r < 0.98 ? hx('#a6e0c0') : hx('#b84490'); };
      const leaf = (t, h, out, big) => {
        const s0 = S.par(t, h, out), sc = 7 / (6.2 + t * 0.515), a = rng() * 6.283, l = rng.r(4.5, 8.5) * sc * (big || 1);
        C.stroke([s0[0], s0[1], 1, 0.5, s0[0] + Math.cos(a) * l * 0.5, s0[1] + Math.sin(a) * l * 0.5, 1, 1, s0[0] + Math.cos(a) * l, s0[1] + Math.sin(a) * l, 0.8, 0.25], M.pastelTip, PAS.near(leafC(), rng, 0.02), l * 0.72, rng.r(0.85, 1.05));
      };
      for (const [tc, spread, lenMax, n] of [[3.25, 0.34, 0.5, 9], [4.45, 0.6, 0.95, 20], [5.3, 0.4, 0.6, 10], [6.35, 0.7, 0.85, 22], [7.35, 0.4, 0.55, 10]]) {
        // the mass on top of the wall and through the rail
        for (let k = 0; k < n * 4; k++) { const t = tc + rng.g() * spread * 0.5; if (t > TK - 0.05) continue; const sp = S.par(t, PH + rng.r(-0.16, 0.1) * Math.exp(-Math.pow((t - tc) / spread, 2) * 2), rng.r(0, PT)), sc = 7 / (6.2 + t * 0.515); A.dot(C, rng, sp[0], sp[1], M.pastelTip, hx(rng() < 0.5 ? '#0f2c38' : '#123a44'), rng.r(9, 15) * sc, 1); }
        for (let k = 0; k < n * 12; k++) { const t = tc + rng.g() * spread * 0.55; if (t > TK - 0.05) continue; leaf(t, PH + Math.abs(rng.g()) * 0.13, rng.r(-0.04, PT), 1.1); }
        // strands hanging down the face
        for (let k = 0; k < n; k++) {
          const t0 = tc + rng.g() * spread * 0.6, len = lenMax * rng.r(0.25, 1) * Math.exp(-Math.pow((t0 - tc) / spread, 2));
          if (t0 > TK - 0.08 || len < 0.08) continue;
          const xy = [], ph = rng() * 9, pts = [];
          for (let d = 0; d <= len; d += 0.04) { const t = t0 + 0.035 * Math.sin(d * 9 + ph) + d * 0.03, h = PH - d, sp = S.par(t, h, -0.01); xy.push(sp[0], sp[1]); pts.push([t, h]); }
          if (xy.length >= 4) A.line(C, rng, xy, M.pencil, hx('#0f2c38'), 1.0, 0.8, { wob: 0.3, step: 4 });
          for (const p of pts) { if (rng() < 0.85) leaf(p[0] + rng.g() * 0.02, p[1] + rng.g() * 0.015, -0.01); if (rng() < 0.3) leaf(p[0] + rng.g() * 0.05, p[1], -0.01, 0.8); }
          const end = pts[pts.length - 1]; leaf(end[0], end[1] - 0.03, -0.01, 0.7);
        }
        // a few leaves have let go and lie on the wet floor
        for (let k = 0; k < 3; k++) { const t = tc + rng.g() * spread, sp = S.par(t, 0); if (t < TK - 0.3) A.dot(C, rng, sp[0] + rng.r(-10, 30), sp[1] + rng.r(4, 26), M.pastelTip, hx(rng() < 0.5 ? '#2a6a54' : '#b84490'), rng.r(3, 5), 0.9); }
      }
    }
    // weeds in the crack along the wall's foot, and a few small flowers nobody planted
    for (let t = -0.3; t < TK - 0.2; t += rng.r(0.12, 0.55)) {
      if (rng() < 0.35) continue;
      const s = S.par(t, 0), sc = 7 / (6.2 + t * 0.515), n = rng.i(3, 8), lit = lampI(S.PA[0] + S.PD[0] * t, 0.1, S.PA[1] + S.PD[1] * t, 0, 1, 0);
      for (let q = 0; q < n; q++) {
        const a = -1.57 + rng.g() * 0.5, len = rng.r(6, 20) * sc;
        A.line(C, rng, [s[0] + rng.g() * 3, s[1] + 1, s[0] + Math.cos(a) * len * 0.5 + rng.g(), s[1] + Math.sin(a) * len * 0.6, s[0] + Math.cos(a) * len + rng.g() * 2, s[1] + Math.sin(a) * len], M.pencil, mix3(hx(rng() < 0.5 ? '#1a4a44' : '#2a6a54'), hx('#a6e0c0'), clamp(lit * rng.r(0.3, 1), 0, 0.8)), rng.r(0.9, 1.6) * sc, rng.r(0.6, 0.95), { wob: 0.4, t1: 0.4, pe: 0.3 });
      }
      if (rng() < 0.3) for (let q = 0; q < rng.i(1, 3); q++) A.dot(C, rng, s[0] + rng.g() * 5, s[1] - rng.r(5, 16) * sc, M.oil, hx(rng() < 0.6 ? '#fffbe8' : '#fbe8a8'), rng.r(1.3, 2.2) * sc, 1);
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
