// things.js -- what was left out on the roof: the stair-house, the ticket hut, the rails for a queue,
// the lamp pole with its two silent loudspeakers, and the coin telescope with a step for small people.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp, mix = A.mix;
  const S = A.S, PAS = S.PAS, c = S.c, F = S.F, VX = S.VX, HY = S.HY, E = S.E, fl = S.fl, beam = (...a) => S.beam(...a);
  const INK = hx('#14113a');

  // ------------------------------------------------------------------ behind the wheel
  S.drawBack = function (C, rng) {
    const WH = S.WH, glowX = VX + F * WH.x / 24;
    // the stair-house at the back of the roof
    for (const f of S.box3([22.5, 1.7, 26.6], [5.5, 1.7, 2.6], 0)) {
      if (f.id === '-u') {
        A.hatch(C, rng, f.poly, { ang: 1.5, gap: 1.9, med: M.pastelTip, col: (x, y) => PAS.near(mix3(hx('#4a3a78'), hx('#d88a84'), clamp(0.25 + 0.5 * ss(380, 530, y) + rng.g() * 0.04, 0, 1)), rng, 0.04), w: 3.4, p: 1.05, over: 0.4 });
        A.hatch(C, rng, f.poly, { ang: 0.3, gap: 3.6, med: M.pastelTip, col: (x, y) => PAS.near(mix3(hx('#4a3a78'), hx('#d88a84'), clamp(0.25 + 0.5 * ss(380, 530, y), 0, 1)), rng, 0.05), w: 2.6, p: 0.85, over: 0.3 });
      } else {
        S.solid(C, rng, f.poly, hx('#221d4e'), { w: 7, med: M.pastel, over: 0.5 });
        A.hatch(C, rng, f.poly, { ang: 1.5, gap: 1.7, med: M.pastelTip, col: (x, y) => PAS.near(mix3(hx('#231e50'), hx('#7a4a80'), clamp(0.5 * S.gs((x - 1330) / 120) + 0.12 * ss(400, 520, y) + rng.g() * 0.03, 0, 1)), rng, 0.04), w: 4, p: 1.05, over: 0.4 });
        A.hatch(C, rng, f.poly, { ang: -0.6, gap: 4, med: M.pencil, col: hx('#17143c'), w: 1.1, p: 0.5, over: 0.3 });
      }
      S.outline(C, rng, f.poly, INK, 1.3, 0.85, { reps: 2 });
    }
    { // coping, door, caged lamp, a pipe, the ladder to its roof
      const P = (x, h, z) => fl(x, z, h);
      const a = P(17, 3.4, 24), b = P(28, 3.4, 24), d = P(17, 3.4, 29.2);
      A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pastelTip, hx('#6a70c0'), 2.6, 0.95, { wob: 0.3, step: 10 }); A.line(C, rng, [d[0], d[1], a[0], a[1]], M.pastelTip, hx('#ffb09a'), 2.2, 0.9, { wob: 0.3 });
      A.line(C, rng, [a[0], a[1] - 1.6, b[0], b[1] - 1.6], M.pencil, hx('#d2dff6'), 0.9, 0.6, { wob: 0.3, step: 10 });
      const d0 = P(19.3, 0, 24), d1 = P(20.25, 2.05, 24);
      S.rect(C, rng, d0[0], d1[1], d1[0], d0[1], hx('#3a5a78'), { med: M.pastelTip, w: 3 }); S.outline(C, rng, [d0[0], d1[1], d1[0], d1[1], d1[0], d0[1], d0[0], d0[1]], INK, 1.1, 0.85);
      S.rect(C, rng, mix(d0[0], d1[0], 0.25), mix(d1[1], d0[1], 0.14), mix(d0[0], d1[0], 0.75), mix(d1[1], d0[1], 0.36), hx('#1a1742'), { med: M.pencil, w: 1.6 });   // wired glass, dark
      A.dot(C, rng, mix(d0[0], d1[0], 0.82), mix(d1[1], d0[1], 0.55), M.pencil, hx('#d2dff6'), 1.5, 0.9);
      const lp = P(19.78, 2.42, 23.9); S.glow(C, rng, lp[0], lp[1] + 5, 24, hx('#3fb0aa'), 7, 0.6); S.glow(C, rng, lp[0], lp[1] + 2, 12, hx('#72cdb4'), 6, 0.7); S.bulb(C, rng, lp[0], lp[1], 4.6, hx('#a6e0c0'), hx('#fffbe8'));
      for (let k = 0; k < 4; k++) A.line(C, rng, [lp[0] - 4 + k * 2.6, lp[1] - 4, lp[0] - 4 + k * 2.6, lp[1] + 4], M.pencil, INK, 0.6, 0.7);
      for (let k = 0; k < 12; k++) dabv(C, rng, mix(d0[0], d1[0], rng()), d0[1] + rng.r(3, 30), rng.r(4, 12), 1.6, hx('#72cdb4'), 0.5);        // its light on the wet floor
      const p0 = P(22.4, 0, 24), p1 = P(22.4, 3.4, 24); A.line(C, rng, [p0[0], p0[1], p1[0], p1[1]], M.conte, hx('#14113a'), 2.2, 0.95, { wob: 0.2 }); A.line(C, rng, [p0[0] - 0.8, p0[1], p1[0] - 0.8, p1[1]], M.pencil, hx('#8480a8'), 0.7, 0.5);
      for (const zz of [25.2, 25.9]) { const l0 = P(17, 0.3, zz), l1 = P(17, 4.0, zz); A.line(C, rng, [l0[0], l0[1], l1[0], l1[1]], M.pencil, INK, 1.1, 0.9, { wob: 0.15 }); }
      for (let hh = 0.5; hh < 3.9; hh += 0.36) { const l0 = P(17, hh, 25.2), l1 = P(17, hh, 25.9); A.line(C, rng, [l0[0], l0[1], l1[0], l1[1]], M.pencil, INK, 0.8, 0.85); }
      // a water tank on the roof, an aerial, and the back of the store's big sign: all struts, no words from here
      const t0 = P(18.6, 3.4, 26.5), t1 = P(20.6, 5.3, 26.5);
      for (const xx of [18.8, 20.4]) { const q0 = P(xx, 3.4, 26.5), q1 = P(xx, 3.9, 26.5); A.line(C, rng, [q0[0], q0[1], q1[0], q1[1]], M.pencil, INK, 1.2, 0.9); }
      const ty0 = P(18.6, 3.9, 26.5)[1];
      A.hatch(C, rng, [t0[0], ty0, t1[0], ty0, t1[0], t1[1], t0[0], t1[1]], { ang: 1.5, gap: 1.8, med: M.pastelTip, col: (x, y) => PAS.near(mix3(hx('#d88a84'), hx('#3a3478'), ss(t0[0], t1[0], x) * 0.9), rng, 0.04), w: 3, p: 1.05, over: 0.3 });
      { const xy = []; for (let q = 0; q <= 8; q++) { const u = q / 8; xy.push(mix(t0[0], t1[0], u), t1[1] - Math.sin(u * Math.PI) * 5); } A.line(C, rng, xy, M.pastelTip, hx('#8a84cc'), 2.4, 0.9, { wob: 0.2 }); A.line(C, rng, xy, M.pencil, hx('#d2dff6'), 0.8, 0.6, { wob: 0.2 }); }
      for (const hh of [4.3, 4.8]) { const q0 = P(18.6, hh, 26.5), q1 = P(20.6, hh, 26.5); A.line(C, rng, [q0[0], q0[1], q1[0], q1[1]], M.pencil, INK, 0.8, 0.6, { wob: 0.2 }); }
      const an = P(21.6, 3.4, 27), an1 = P(21.6, 7.2, 27); A.line(C, rng, [an[0], an[1], an1[0], an1[1]], M.pencil, INK, 1.2, 0.95, { wob: 0.2, reps: 2, off: 0.3 });
      for (let q = 0; q < 4; q++) { const yy = mix(an1[1], an[1], 0.05 + q * 0.09), wd = 16 - q * 3; A.line(C, rng, [an1[0] - wd, yy + 1, an1[0] + wd, yy - 1], M.pencil, INK, 0.9, 0.9); }
      A.dot(C, rng, an1[0], an1[1] - 2, M.oil, hx('#f06a6a'), 2.2, 1);
      { const hs2 = [3.4, 4.4, 5.6, 6.9, 8.2]; let ci = 0;
        for (let xx = 22.6; xx < 31; xx += 1.7) for (let j = 0; j < 4; j++) { ci++; const q0 = P(xx, hs2[j], 28.4), q1 = P(xx + 1.7, hs2[j + 1], 28.4); if (q0[0] > 1620) break; if ([2, 7, 9, 12, 16, 21].includes(ci)) continue;
          S.solid(C, rng, [q0[0] + 1, q1[1] + 1, q1[0] - 1, q1[1] + 1, q1[0] - 1, q0[1] - 1, q0[0] + 1, q0[1] - 1], PAS.near(mix3(hx('#1d1a4a'), hx('#3a2a6a'), rng()), rng, 0.03), { ang: 1.5, w: 4, med: M.pastel, over: 0.2 });
          if (rng() < 0.6) A.hatch(C, rng, [q0[0] + 1, q1[1] + 1, q1[0] - 1, q1[1] + 1, q1[0] - 1, q0[1] - 1, q0[0] + 1, q0[1] - 1], { ang: 1.57, gap: 5, med: M.pencil, col: hx('#4a3a80'), w: 1, p: 0.5, over: 0 });          // corrugations
          if (rng() < 0.4) for (let k = 0; k < 3; k++) A.dot(C, rng, mix(q0[0], q1[0], rng()), mix(q1[1], q0[1], rng.r(0.5, 1)), M.pastelTip, hx('#6a3a5a'), rng.r(2, 5), 0.4); } }                 // rust
      for (let xx = 22.6; xx <= 31; xx += 1.7) { const q0 = P(xx, 3.4, 28.4), q1 = P(xx, 8.2, 28.4); if (q0[0] > 1625) break; beam(C, rng, q0, q1, 3.6, { hi: hx('#de5c98'), hp: 0.6 }); const r0 = P(xx + 1.3, 3.4, 26.8); A.line(C, rng, [r0[0], r0[1], q1[0], mix(q0[1], q1[1], 0.7)], M.pencil, INK, 1.0, 0.85, { wob: 0.2 }); }
      for (const hh of [4.4, 5.6, 6.9, 8.2]) { const q0 = P(22.6, hh, 28.4); A.line(C, rng, [q0[0] - 3, q0[1], 1625, q0[1]], M.conte, INK, hh > 8 ? 2.8 : 1.8, 0.95, { wob: 0.3, step: 10 }); if (hh > 8) A.line(C, rng, [q0[0] - 3, q0[1] - 1.2, 1625, q0[1] - 1.2], M.pencil, hx('#f283ae'), 0.9, 0.6, { wob: 0.3, step: 10 }); }
      for (let xx = 22.6; xx < 31; xx += 1.7) for (const hh of [4.4, 5.6, 6.9]) { const q0 = P(xx, hh, 28.4), q1 = P(xx + 1.7, hh + 1.25, 28.4); if (q0[0] > 1620) break; if (rng() < 0.75) A.line(C, rng, [q0[0], q0[1], q1[0], q1[1]], M.pencil, INK, 0.8, 0.7, { wob: 0.2 }); }
      // the sign still throws its colour over the edge, down the side that faces the town
      { const ty = P(22, 8.2, 28.4)[1], lx = P(22.6, 8.2, 28.4)[0];
        for (let k = 0; k < 26; k++) A.dot(C, rng, rng.r(lx - 6, 1610), ty - rng.r(3, 16), M.pastel, hx(rng() < 0.6 ? '#de5c98' : '#f283ae'), rng.r(10, 18), 0.4);
        for (let pass = 0; pass < 2; pass++) C.rub(pass ? [1610, ty - 9, 1520, ty - 10, lx - 8, ty - 8] : [lx - 8, ty - 8, 1520, ty - 10, 1610, ty - 9], 11, 0.65, 0.5);
        A.line(C, rng, [lx - 2, ty - 2.5, 1620, ty - 2.5], M.pastelTip, hx('#f283ae'), 2.2, 0.85, { wob: 0.4, step: 10 }); A.line(C, rng, [lx, ty - 3, 1620, ty - 3.2], M.oil, hx('#fcd3dc'), 1.0, 0.8, { wob: 0.4, step: 10, pj: 0.5 });
        for (let k = 0; k < 14; k++) A.dot(C, rng, lx - rng.r(2, 12), mix(ty, P(22, 3.4, 28.4)[1], rng()), M.pastel, hx('#b84490'), rng.r(6, 12), 0.3); C.rub([lx - 7, ty, lx - 7, P(22, 3.4, 28.4)[1]], 8, 0.6, 0.5); }
    }
  };
  function dabv(C, rng, x, y, len, w, col, p, med) { C.stroke(A.hand(rng, [x + rng.g() * 0.4, y - len / 2, x + rng.g() * 0.6, y + len / 2], { wob: 0.5, step: 3, pe: 0.2, t0: 0.3, t1: 0.4 }), med || M.pastelTip, col, w, p || 0.8); }

  // ------------------------------------------------------------------ in front
  S.drawThings = function (C, rng) {
    const WH = S.WH, cu = Math.cos(WH.yaw), su = Math.sin(WH.yaw), u = [cu, su], n = [-su, cu];
    const P = (x, h, z) => fl(x, z, h);

    // ---- everything the wheel throws down onto the wet floor
    for (const L of S.wheelLamps || []) {
      const sx = VX + F * L[0] / L[2], sy = HY + F * (E + L[1]) / L[2];
      if (sy > 906 || !S.onFloor(sx, sy)) continue;
      const fp = S.floorAt(sx, sy), pd = S.puddle(fp[0], fp[1]), sc = F / L[2];
      if (pd > 0.05) { // on still water a lamp comes back as a ladder of short level dashes
        dabv(C, rng, sx, sy + 6, rng.r(26, 44), L[3] * sc * 2.2, hx('#c0607a'), 0.26, M.pastel);
        const n = rng.i(4, 7), w0 = L[3] * sc * rng.r(1.5, 2.1); let y = sy - 3;
        for (let q = 0; q < n; q++) { const ww = w0 * (1 - q * 0.1) * rng.r(0.7, 1.2); S.dab(C, rng, sx + rng.g() * 1.4, y, ww, rng.r(1.1, 1.9), q === 1 ? hx('#fff4c8') : q < 3 ? hx('#ffc070') : hx('#f7a84a'), q < 2 ? M.oil : M.pastelTip, 0.95 - q * 0.09); y += rng.r(3.2, 6.5); }
      } else { dabv(C, rng, sx, sy + rng.r(2, 10), rng.r(26, 48), L[3] * sc * 2.0, hx('#d0706a'), rng.r(0.28, 0.42), M.pastel); dabv(C, rng, sx, sy + rng.r(0, 6), rng.r(12, 26), L[3] * sc * 1.2, hx('#e88a2a'), rng.r(0.4, 0.6)); if (rng() < 0.7) dabv(C, rng, sx, sy, rng.r(4, 9), L[3] * sc * 0.8, hx('#ffc070'), 0.7); }
    }
    { // the cabins and the legs, upside down in the water
      const BODY = ['#8fd0c0', '#f4a6b8', '#f6e4b0', '#9ab6ea', '#f8b494', '#bfaee6', '#a6e0c0', '#f9c4d0'].map(hx);
      for (let k = 0; k < 8; k++) {
        const th = k * Math.PI / 4, px = WH.x + u[0] * WH.r * Math.cos(th), pz = WH.z + u[1] * WH.r * Math.cos(th), ph = WH.hub + WH.r * Math.sin(th);
        for (let q = 0; q < 26; q++) {
          const a = rng.r(-0.5, 0.5), hh = ph - 0.36 - rng.r(0, 1.1), sx = VX + F * (px + u[0] * a) / pz, sy = HY + F * (E + hh) / pz;
          if (sy > 906 || !S.onFloor(sx, sy)) continue;
          const fp = S.floorAt(sx, sy), pd = S.puddle(fp[0], fp[1]), inWin = ph - 0.36 - hh > 0.1 && ph - 0.36 - hh < 0.6;
          const col = inWin ? hx('#ffc070') : mix3(BODY[k], hx('#3a2e78'), 0.35);
          dabv(C, rng, sx, sy, rng.r(6, 14), rng.r(2.5, 5), col, pd > 0 ? 0.85 : 0.3);
        }
      }
      for (const a of [-2.5, 2.5]) for (let q = 0; q < 16; q++) { const t = q / 16, x = WH.x + u[0] * a * (1 - t) - n[0] * 0.85, z = WH.z + u[1] * a * (1 - t) - n[1] * 0.85, hh = 0.3 + (WH.hub - 0.3) * t, sx = VX + F * x / z, sy = HY + F * (E + hh) / z; if (sy > 906 || !S.onFloor(sx, sy)) continue; const fp = S.floorAt(sx, sy); if (S.puddle(fp[0], fp[1]) > 0) dabv(C, rng, sx + rng.g() * 1.5, sy, rng.r(8, 16), 4, hx('#2a2460'), 0.8); }
      // the rim itself, an arch of broken strokes standing on its head
      for (const [off, col, pp] of [[-0.42, hx('#3a3478'), 0.75], [0.42, hx('#2a2460'), 0.5]]) for (let a = Math.PI; a < 2 * Math.PI; a += 0.035) {
        const x = WH.x + u[0] * WH.r * Math.cos(a) + n[0] * off, z = WH.z + u[1] * WH.r * Math.cos(a) + n[1] * off, hh = WH.hub + WH.r * Math.sin(a), sx = VX + F * x / z, sy = HY + F * (E + hh) / z;
        if (sy > 906 || !S.onFloor(sx, sy) || rng() < 0.25) continue;
        const fp = S.floorAt(sx, sy), pd = S.puddle(fp[0], fp[1]);
        dabv(C, rng, sx + rng.g() * (pd > 0 ? 1 : 2.5), sy, rng.r(5, 12), rng.r(2.4, 4), pd > 0 ? col : mix3(col, hx('#5a4a90'), 0.4), pd > 0 ? pp : pp * 0.4);
      }
      for (let k = 4; k <= 8; k++) for (let f = 0.12; f < 1; f += 0.05) { const th = k * Math.PI / 4, x = WH.x + u[0] * WH.r * f * Math.cos(th) - n[0] * 0.42, z = WH.z + u[1] * WH.r * f * Math.cos(th) - n[1] * 0.42, hh = WH.hub + WH.r * f * Math.sin(th), sx = VX + F * x / z, sy = HY + F * (E + hh) / z; if (sy > 906 || !S.onFloor(sx, sy) || rng() < 0.4) continue; const fp = S.floorAt(sx, sy); if (S.puddle(fp[0], fp[1]) > 0) dabv(C, rng, sx + rng.g() * 1.2, sy, rng.r(4, 9), 2.2, hx('#3a3478'), 0.6); }
      // the platform's warm underline
      const d0 = fl(WH.x - u[0] * 3.8 - n[0] * 1.55, WH.z - u[1] * 3.8 - n[1] * 1.55, 0), d1 = fl(WH.x + u[0] * 3.8 - n[0] * 1.55, WH.z + u[1] * 3.8 - n[1] * 1.55, 0);
      for (let q = 0; q < 60; q++) { const t = rng(), sx = mix(d0[0], d1[0], t), sy = mix(d0[1], d1[1], t) + rng.r(2, 20); dabv(C, rng, sx, sy, rng.r(5, 16), rng.r(2, 4), rng() < 0.5 ? hx('#ffaa94') : hx('#f98a8c'), rng.r(0.25, 0.6)); }
      A.line(C, rng, [d0[0], d0[1] + 1, d1[0], d1[1] + 1], M.conte, hx('#100e36'), 2.4, 0.95, { wob: 0.5, step: 10 });
    }

    // ---- the ticket hut: light on, shutter up, nobody in
    {
      const bc = [14.6, 1.1, 17.5], hs = [0.65, 1.1, 0.65];
      for (const f of S.box3(bc, hs, 0)) {
        const lit = f.id === '-u';
        A.hatch(C, rng, f.poly, { ang: 1.5, gap: 1.8, med: M.pastelTip, col: (x, y) => PAS.near(lit ? mix3(hx('#b06a8c'), hx('#f6b094'), ss(590, 450, y) * 0.5 + rng.g() * 0.04) : mix3(hx('#3a5a80'), hx('#2a3466'), ss(450, 590, y) + rng.g() * 0.04), rng, 0.04), w: 3.2, p: 1.05, over: 0.3 });
        // planks
        const q = f.poly; for (let t = 0.14; t < 1; t += 0.145) A.line(C, rng, [mix(q[0], q[2], t), mix(q[1], q[3], t), mix(q[6], q[4], t), mix(q[7], q[5], t)], M.pencil, lit ? hx('#6a3a68') : hx('#17143c'), 0.9, 0.55, { wob: 0.3 });
        S.outline(C, rng, f.poly, INK, 1.3, 0.9, { reps: 2 });
        // the window: a lit room the size of a cupboard
        const wq = (a0, a1, h0, h1) => { const g = (a, h) => [mix(mix(q[0], q[2], a), mix(q[6], q[4], a), h), mix(mix(q[1], q[3], a), mix(q[7], q[5], a), h)]; const p0 = g(a0, h0), p1 = g(a1, h0), p2 = g(a1, h1), p3 = g(a0, h1); return [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]; };
        const w = wq(0.16, 0.84, 0.42, 0.8);
        S.solid(C, rng, w, hx('#ffd890'), { ang: 0.1, w: 3, med: M.pastelTip, over: 0.2 }); S.solid(C, rng, wq(0.16, 0.84, 0.62, 0.8), hx('#fff4c8'), { ang: 0.1, w: 2.4, med: M.oil, over: 0.1, single: true });
        S.solid(C, rng, wq(0.2, 0.8, 0.42, 0.5), hx('#f7a84a'), { ang: 0.1, w: 2, med: M.pastelTip, over: 0.1, single: true });
        S.outline(C, rng, w, INK, 1.2, 0.9, { reps: 2 });
        { const s0 = wq(0.1, 0.9, 0.39, 0.42); S.solid(C, rng, s0, lit ? hx('#ffe0c8') : hx('#6a84c0'), { ang: 0.1, w: 1.6, med: M.pencil, single: true }); }           // the sill
        if (f.id === '-n') { const lv = wq(0.6, 0.66, 0.42, 0.6); A.line(C, rng, [lv[0], lv[1], lv[6] + 2, lv[7]], M.pencil, INK, 1.6, 0.95); A.dot(C, rng, lv[6] + 2, lv[7], M.conte, hx('#d64a54'), 3, 1); // the lever, with its red knob
          const rl = wq(0.3, 0.42, 0.42, 0.56); S.solid(C, rng, rl, hx('#f4a6b8'), { w: 1.6, med: M.pencil, single: true }); } // a roll of tickets
      }
      // roof with an overhang, and its lamp
      for (const f of S.box3([14.6, 2.26, 17.5], [0.85, 0.06, 0.85], 0)) { S.solid(C, rng, f.poly, PAS.near(f.id === 'bot' ? hx('#c08a70') : hx('#2a2458'), rng, 0.03), { ang: 0.05, w: 2.6, med: M.pastelTip, over: 0.3 }); S.outline(C, rng, f.poly, INK, 1.2, 0.9); }
      const lp = P(13.9, 2.06, 16.8); S.glow(C, rng, lp[0], lp[1] + 3, 22, hx('#e88a2a'), 7, 0.6); S.glow(C, rng, lp[0], lp[1] + 1, 11, hx('#f7a84a'), 6, 0.75); S.bulb(C, rng, lp[0], lp[1], 4.8, hx('#ffc070'), hx('#fffbe8'));
      // the hut's light spilt on the floor
      const f0 = P(13.95, 0, 16.85), f1 = P(15.25, 0, 16.85);
      for (let q = 0; q < 130; q++) { const t = rng(), sx = mix(f0[0] - 46, f1[0], t), sy = f0[1] + rng.r(2, 120) * rng(); if (S.onFloor(sx, sy)) dabv(C, rng, sx, sy, rng.r(8, 26), rng.r(2, 5), rng() < 0.4 ? hx('#ffd890') : rng() < 0.5 ? hx('#ffc070') : hx('#f7a84a'), rng.r(0.35, 0.85) * (1 - (sy - f0[1]) / 160)); }
      A.line(C, rng, [f0[0] - 2, f0[1] + 1, f1[0] + 2, f1[1] + 1], M.conte, hx('#100e36'), 2.2, 0.95, { wob: 0.3 });
    }

    // ---- rails for a queue: three lanes, switchback, empty
    {
      const rc = hx('#191646');
      const lane = (off, a0, a1) => {
        const pts = []; for (let a = a0; a <= a1 + 1e-6; a += 1.2) pts.push([WH.x + u[0] * a + n[0] * off, WH.z + u[1] * a + n[1] * off]);
        for (const p of pts) { const s0 = fl(p[0], p[1], 0), s1 = fl(p[0], p[1], 0.95), w = 0.05 * F / p[1]; beam(C, rng, s0, s1, w * 1.5, { dark: hx('#14113a'), mid: hx('#a096d8'), hi: hx('#ffd0b8'), hp: 0.95 });
          // each post stands on its own reflection
          if (S.puddle(p[0], p[1]) > -0.2) dabv(C, rng, s0[0], s0[1] + 14, 26, w * 0.9, hx('#221d50'), 0.6); }
        for (const hh of [0.95, 0.5]) for (let i = 0; i + 1 < pts.length; i++) { const s0 = fl(pts[i][0], pts[i][1], hh), s1 = fl(pts[i + 1][0], pts[i + 1][1], hh); beam(C, rng, s0, s1, (hh > 0.9 ? 0.075 : 0.04) * F / pts[i][1], { dark: hx('#14113a'), mid: hx('#a096d8'), hi: hh > 0.9 ? hx('#ffd0b8') : hx('#8a74cc'), hp: hh > 0.9 ? 0.95 : 0.6 }); }
        return pts;
      };
      const l1 = lane(-2.9, -1.0, 3.8), l2 = lane(-3.8, -1.0, 3.8), l3 = lane(-4.7, -1.0, 3.8);
      // a chain across the way in, with a small plate hanging from the middle of it
      const e0 = fl(l2[0][0], l2[0][1], 0.8), e1 = fl(l3[0][0], l3[0][1], 0.8), mid = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2 + 9];
      A.line(C, rng, A.curve([e0[0], e0[1], mid[0], mid[1], e1[0], e1[1]], 6), M.pencil, hx('#b4b0cc'), 1.2, 0.9, { wob: 0.3, step: 3 });
      S.rect(C, rng, mid[0] - 7, mid[1] + 1, mid[0] + 7, mid[1] + 11, hx('#f6e4b0'), { med: M.pastelTip, w: 2.4 }); A.line(C, rng, [mid[0] - 4, mid[1] + 6, mid[0] + 4, mid[1] + 6], M.pencil, hx('#d64a54'), 1.2, 0.8);
    }

    // ---- the lamp pole, close on the left: two loudspeakers with nothing to play
    {
      const px = -2.95, pz = 5.4, wd = 0.13 * F / pz, x = fl(px, pz, 0)[0];
      // its light first: a pale green breath in the damp air under the lamp
      for (let pass = 0; pass < 3; pass++) {
        for (const off of [-0.25, 0.25, 0]) for (let y = -20; y < 910; y += 150) C.stroke(A.hand(rng, [x + off * wd, y, x + off * wd + rng.g() * 0.3, y + 170], { wob: 0.3, step: 10, pe: 0.9, t0: 0.05, t1: 0.05 }), M.pastel, PAS.near(off > 0 ? hx('#2a2760') : hx('#14123c'), rng, 0.02), wd * 0.55, 1.2);
        if (pass < 2) for (let y = -10; y < 910; y += 50) C.rub([x, y, x + rng.g() * 0.5, y + 25, x, y + 50], wd * 0.4, 0.55, 0.6);
      }
      A.line(C, rng, [x - wd / 2, -10, x - wd / 2 + 0.3, 450, x - wd / 2, 910], M.conte, hx('#0c0a22'), 2.2, 1, { wob: 0.4, step: 14 }); A.line(C, rng, [x + wd / 2, -10, x + wd / 2 - 0.3, 450, x + wd / 2, 910], M.conte, hx('#0c0a22'), 1.8, 1, { wob: 0.4, step: 14 });
      A.line(C, rng, [x + wd / 2 - 2.2, -10, x + wd / 2 - 2, 300, x + wd / 2 - 2.4, 910], M.pastelTip, hx('#72cdb4'), 2.6, 0.8, { wob: 0.5, step: 12, pj: 0.4 });           // the lamp's light down one side
      A.line(C, rng, [x + wd / 2 - 1, -10, x + wd / 2 - 0.8, 420], M.pencil, hx('#d2efcf'), 0.9, 0.7, { wob: 0.4, step: 12, t1: 0.6 });
      A.line(C, rng, [x - wd / 2 + 1.6, 200, x - wd / 2 + 1.4, 910], M.pencil, hx('#de5c98'), 0.9, 0.45, { wob: 0.4, step: 12 });            // a last trace of the sunset on the other
      for (const y of [150, 468, 742]) { A.line(C, rng, [x - wd / 2 - 1, y, x + wd / 2 + 1, y - 2], M.conte, hx('#0c0a22'), 3.2, 1, { wob: 0.2 }); A.line(C, rng, [x - wd / 2, y - 3, x + wd / 2, y - 5], M.pencil, hx('#6a7cc8'), 0.8, 0.6); }   // bands
      // the horns
      const horn = (cy, dir, len, r0, r1, lit) => {
        const bx = x + dir * wd * 0.5, mx = bx + dir * len, tilt = -len * 0.22;
        const q = [bx, cy - r0, mx, cy + tilt - r1, mx, cy + tilt + r1, bx, cy + r0];
        A.hatch(C, rng, q, { ang: 0.2 * dir, gap: 2.0, med: M.pastelTip, col: (xx, yy) => PAS.near(mix3(lit ? hx('#8fb8c4') : hx('#5a5a98'), hx('#221d50'), clamp((yy - (cy + tilt - r1)) / (2.2 * r1), 0, 1) * 0.9), rng, 0.03), w: 3.4, p: 1.05, over: 0.3 });
        const mouth = []; for (let a = 0; a < 6.3; a += 0.3) mouth.push(mx + Math.cos(a) * r1 * 0.34 * dir, cy + tilt + Math.sin(a) * r1);
        S.solid(C, rng, mouth, hx('#100e36'), { w: 3.6, over: 0.2 });
        A.line(C, rng, A.curve(mouth.concat([mouth[0], mouth[1]]), 2), M.pencil, lit ? hx('#d2efcf') : hx('#8a84c4'), 1.2, 0.8, { wob: 0.3, step: 4 });
        A.line(C, rng, [q[0], q[1], q[2], q[3]], M.pencil, lit ? hx('#d2efcf') : hx('#b09ee2'), 1.1, 0.8, { wob: 0.3 }); A.line(C, rng, [q[6], q[7], q[4], q[5]], M.pencil, INK, 1.3, 0.9, { wob: 0.3 });
        S.rect(C, rng, bx - dir * 1 - 5, cy - r0 - 3, bx - dir * 1 + 5, cy + r0 + 3, hx('#14123c'), { w: 3 });
      };
      horn(246, 1, 62, 8, 30, true); horn(292, -1, 48, 7, 24, false);
      A.line(C, rng, [x - 34, 300, x - 30, 340, x - wd / 2, 372], M.pencil, INK, 1.1, 0.85, { wob: 0.6 }); A.line(C, rng, [x + 40, 262, x + 34, 320, x + wd / 2, 356], M.pencil, INK, 1.1, 0.85, { wob: 0.6 });       // their wires
      // a switch box, and the cable going down to the wall
      S.rect(C, rng, x - 13, 596, x + 15, 640, hx('#5a6aa0'), { med: M.pastelTip, w: 3.4 }); S.outline(C, rng, [x - 13, 596, x + 15, 596, x + 15, 640, x - 13, 640], INK, 1.3, 0.9, { reps: 2 });
      A.line(C, rng, [x - 12, 598, x + 14, 598], M.pencil, hx('#d2efcf'), 1.1, 0.8); A.dot(C, rng, x + 7, 628, M.pencil, INK, 2.4, 0.9); A.line(C, rng, [x - 8, 606, x + 2, 606], M.pencil, hx('#fbe8a8'), 2.2, 0.8);
      A.line(C, rng, A.curve([x + 6, 640, x + 12, 700, x + 30, 790, x + 26, 846], 6), M.pencil, INK, 1.6, 0.9, { wob: 0.6, step: 5 });
    }

    // ---- the coin telescope, and the step
    drawViewer(C, rng);
  };

  function drawViewer(C, rng) {
    const bx = -2.2, bz = 6.75, KS = 1.2, sc = F / bz * KS, P = (x, h, z) => fl(bx + (x - bx) * KS, bz + (z - bz) * KS, h * KS);
    const lampC = hx('#c6eede'), bodyL = hx('#bfe6d8'), bodyM = hx('#6f9cb4'), bodyD = hx('#34407c'), deep = hx('#1a1848');
    const psi = 0.62, lat = [Math.cos(psi), -Math.sin(psi)], dir = [Math.sin(psi), Math.cos(psi)], hc = 1.36;
    // its shadow, short, lying toward the wall
    { const s0 = P(bx + 0.1, 0, bz + 0.12), s2 = P(bx + 0.3, 0, bz + 0.42);
      for (let k = 0; k < 14; k++) A.line(C, rng, [s0[0] + rng.g() * 10, s0[1] + rng.g() * 3, s2[0] + rng.g() * 12, s2[1] + rng.g() * 3], M.pastelTip, deep, rng.r(6, 11), 0.55, { wob: 0.8 });
      C.rub([s0[0] - 8, s0[1], s2[0] + 8, s2[1]], 12, 0.4, 0.6); }
    // base plate
    { const b = P(bx, 0.03, bz), rx = 0.25 * sc, ry = rx * 0.42, el = []; for (let a = 0; a < 6.3; a += 0.25) el.push(b[0] + Math.cos(a) * rx, b[1] + Math.sin(a) * ry);
      S.solid(C, rng, el, PAS.near(mix3(bodyM, lampC, 0.35), rng, 0.03), { ang: 0.05, w: 4, med: M.pastelTip, over: 0.3 });
      A.line(C, rng, A.curve(el.concat([el[0], el[1]]), 2), M.pencil, deep, 1.4, 0.9, { wob: 0.3, step: 4 });
      for (let a = 0.4; a < 6.2; a += 1.05) A.dot(C, rng, b[0] + Math.cos(a) * rx * 0.76, b[1] + Math.sin(a) * ry * 0.76, M.pencil, deep, 2.6, 0.9);
      for (let a = 0.5; a < 3; a += 0.25) A.line(C, rng, [b[0] + Math.cos(a) * rx, b[1] + Math.sin(a) * ry, b[0] + Math.cos(a) * rx + rng.g(), b[1] + Math.sin(a) * ry + rng.r(3, 9)], M.pastelTip, hx('#7a3a4a'), 2, 0.5, { wob: 0.4 }); }   // rust runs off the plate
    // column: a fat painted pipe
    const c0 = P(bx, 0.05, bz), c1 = P(bx, 1.04, bz), cw = 0.15 * sc;
    A.hatch(C, rng, [c0[0] - cw / 2, c0[1], c0[0] + cw / 2, c0[1], c1[0] + cw / 2, c1[1], c1[0] - cw / 2, c1[1]], { ang: 1.57, gap: 2.0, med: M.pastelTip, col: (x, y) => { const t = (x - (c0[0] - cw / 2)) / cw; return PAS.near(t < 0.3 ? mix3(bodyL, lampC, 0.4) : t < 0.62 ? bodyM : bodyD, rng, 0.03); }, w: 4, p: 1.1, over: 0.2 });
    A.line(C, rng, [c0[0] - cw / 2, c0[1], c1[0] - cw / 2, c1[1]], M.pencil, hx('#4a6a90'), 1.2, 0.85, { wob: 0.3, reps: 2, off: 0.4 });
    A.line(C, rng, [c0[0] + cw / 2, c0[1], c1[0] + cw / 2, c1[1]], M.pencil, deep, 1.5, 0.9, { wob: 0.3, reps: 2, off: 0.4 });
    A.line(C, rng, [c0[0] + cw / 2 - 2.2, c0[1] - 6, c1[0] + cw / 2 - 2.2, c1[1] + 4], M.pencil, hx('#ffaa94'), 1.0, 0.7, { wob: 0.3 });                       // the wheel's lamps, a long way off, find its edge
    A.line(C, rng, [c0[0] - cw * 0.26, c0[1] - 4, c1[0] - cw * 0.26, c1[1] + 4], M.oil, hx('#fffbe8'), 1.6, 0.8, { wob: 0.3, pj: 0.5 });
    for (const hh of [0.1, 0.98]) { const p = P(bx, hh, bz); A.line(C, rng, [p[0] - cw * 0.62, p[1], p[0] + cw * 0.62, p[1] + 1], M.conte, bodyD, 4, 1, { wob: 0.2 }); A.line(C, rng, [p[0] - cw * 0.6, p[1] - 2, p[0] + cw * 0.3, p[1] - 1.6], M.pencil, lampC, 1, 0.8); }
    // chipped paint, a scratch or two
    for (let k = 0; k < 9; k++) { const t = rng(), y = mix(c0[1], c1[1], t); A.dot(C, rng, c0[0] + rng.r(-0.4, 0.4) * cw, y, M.pencil, hx(rng() < 0.5 ? '#7a3a4a' : '#34407c'), rng.r(1.2, 2.4), 0.7); }
    // coin box on the side, with its slot
    for (const f of S.box3([bx + 0.15 * KS, 0.78 * KS, bz - 0.02 * KS], [0.085 * KS, 0.13 * KS, 0.07 * KS], -0.15)) {
      S.solid(C, rng, f.poly, PAS.near(f.id === 'top' ? mix3(bodyL, lampC, 0.5) : f.id === '-n' ? hx('#d0667a') : hx('#7a2f5e'), rng, 0.03), { w: 3, med: M.pastelTip, over: 0.2 }); S.outline(C, rng, f.poly, deep, 1.2, 0.9, { reps: 2 });
      if (f.id === '-n') { const q = f.poly, gx = t => mix(q[0], q[2], t), gy = t => mix(q[5], q[1], t); A.line(C, rng, [gx(0.5), gy(0.2), gx(0.5), gy(0.42)], M.pencil, deep, 1.6, 1); S.rect(C, rng, gx(0.22), gy(0.9), gx(0.78), gy(0.62), hx('#fbe8a8'), { med: M.pencil, w: 1.6 }); A.dot(C, rng, gx(0.5), gy(0.76), M.pencil, hx('#d64a54'), 2.2, 0.9); }
    }
    // the step: two treads of painted wood, red once, set where a child would stand to reach the eyepieces
    const stepAt = (back, w, hgt, d) => {
      for (const f of S.box3([bx - dir[0] * back * KS, hgt * KS / 2, bz - dir[1] * back * KS], [w * KS, hgt * KS / 2, d * KS], -psi)) {
        const col = f.id === 'top' ? mix3(hx('#e46464'), lampC, 0.3) : f.id === '-n' ? hx('#a23a4c') : hx('#5e2650');
        S.solid(C, rng, f.poly, PAS.near(col, rng, 0.03), { ang: f.id === 'top' ? -0.3 : 1.45, w: 3.4, med: M.pastelTip, over: 0.3 });
        S.solid(C, rng, f.poly, PAS.near(mix3(col, hx('#ffc6a8'), f.id === 'top' ? 0.25 : 0.05), rng, 0.04), { ang: 0.35, w: 2.2, med: M.pastelTip, over: 0.2, single: true, p: 0.7, skip: 0.3 });
        if (f.id !== 'top') { // not a box: a little stool, open underneath between its two board legs
          const q = f.poly, g = (a2, b2) => { const u2 = (a2 + 1) / 2, v2 = (b2 + 1) / 2; return [mix(mix(q[0], q[2], u2), mix(q[6], q[4], u2), v2), mix(mix(q[1], q[3], u2), mix(q[7], q[5], u2), v2)]; };
          const c0 = g(-0.66, -1), c1 = g(0.66, -1), c2 = g(0.66, 0.38), c3 = g(-0.66, 0.38);
          S.solid(C, rng, [c0[0], c0[1], c1[0], c1[1], c2[0], c2[1], c3[0], c3[1]], hx('#1c1244'), { ang: 1.4, w: 2.6, over: 0.1 });
          A.line(C, rng, [c3[0], c3[1], c2[0], c2[1]], M.pencil, hx('#f4a6b8'), 0.9, 0.6, { wob: 0.2 });
        }
        S.outline(C, rng, f.poly, hx('#2a1040'), 1.3, 0.9, { reps: 2, ov: 2 });
        if (f.id === 'top') { // paint worn through where small feet stood
          const q = f.poly, cx = (q[0] + q[2] + q[4] + q[6]) / 4, cy = (q[1] + q[3] + q[5] + q[7]) / 4;
          for (const sgn of [-1, 1]) for (let k = 0; k < 5; k++) A.dot(C, rng, cx + sgn * (q[2] - q[0]) * 0.2 + rng.g() * 3, cy + sgn * (q[3] - q[1]) * 0.2 + rng.g() * 1.6, M.pastelTip, hx('#fbe0d0'), rng.r(2.5, 4.5), rng.r(0.4, 0.75));
          A.line(C, rng, [q[0], q[1], q[2], q[3]], M.pencil, hx('#fffbe8'), 1.1, 0.8, { wob: 0.3 });
        } else for (let k = 0; k < 3; k++) A.dot(C, rng, mix(f.poly[0], f.poly[2], rng()), mix(f.poly[1], f.poly[7], rng.r(0.1, 0.5)), M.pencil, hx('#f4a6b8'), rng.r(1.2, 2.2), 0.6);   // chips
      }
    };
    stepAt(0.3, 0.17, 0.22, 0.085); stepAt(0.49, 0.17, 0.11, 0.095);
    // the yoke
    for (const s of [-1, 1]) { const a = P(bx + lat[0] * 0.05 * s, 1.04, bz + lat[1] * 0.05 * s), b = P(bx + lat[0] * 0.2 * s, 1.14, bz + lat[1] * 0.2 * s), d = P(bx + lat[0] * 0.2 * s, hc - 0.02, bz + lat[1] * 0.2 * s);
      A.line(C, rng, [a[0], a[1], b[0], b[1], d[0], d[1]], M.conte, s > 0 ? bodyD : hx('#4a6a90'), 0.055 * sc, 1.05, { wob: 0.2, pe: 0.9 }); A.line(C, rng, [a[0] - 1.5, a[1] - 1, b[0] - 1.8, b[1], d[0] - 1.8, d[1]], M.pencil, lampC, 1, 0.7, { wob: 0.2 }); }
    // the two barrels: it is looking out over the wall, a little down, toward where the avenue ends
    const pitch = 0.17;
    const barrel = (s, front) => {
      const ox = lat[0] * 0.098 * s, oz = lat[1] * 0.098 * s;
      const B = P(bx + ox - dir[0] * 0.25, hc + 0.25 * pitch, bz + oz - dir[1] * 0.25), Fp = P(bx + ox + dir[0] * 0.3, hc - 0.3 * pitch, bz + oz + dir[1] * 0.3);
      const w = 0.185 * sc, wf = 0.2 * KS * F / (bz + 0.3 * KS);
      const pts = (a, b, wa, wb) => [a[0], a[1], 1, 1, b[0], b[1], 1, wb / wa];
      C.stroke(pts(B, Fp, w, wf), M.conte, bodyD, w, 1.1);
      const up = [0, -1];
      C.stroke([B[0] - 1.5, B[1] - w * 0.14, 1, 1, Fp[0], Fp[1] - w * 0.14, 1, 0.95], M.pastelTip, PAS.near(bodyM, rng, 0.02), w * 0.74, 1.05);
      C.stroke(A.hand(rng, [B[0] - 1, B[1] - w * 0.3, Fp[0] - 1, Fp[1] - w * 0.3], { wob: 0.3, pe: 0.8 }), M.pastelTip, PAS.near(bodyL, rng, 0.02), w * 0.42, 1.0);
      C.stroke(A.hand(rng, [B[0], B[1] - w * 0.4, Fp[0] - 2, Fp[1] - w * 0.4], { wob: 0.3, pe: 0.5 }), M.oil, hx('#f4fff4'), w * 0.14, 0.95);
      // under the barrel: reflected rose from the wheel side
      A.line(C, rng, [B[0] + 2, B[1] + w * 0.36, Fp[0], Fp[1] + w * 0.36], M.pencil, hx('#f283ae'), 1.1, front ? 0.75 : 0.4, { wob: 0.3 });
      // the hood at the far end, and a band
      const el = []; for (let a = 0; a < 6.3; a += 0.3) el.push(Fp[0] + Math.cos(a) * wf * 0.2, Fp[1] + Math.sin(a) * wf * 0.52);
      A.line(C, rng, A.curve(el.concat([el[0], el[1]]), 2), M.pencil, deep, 1.5, 0.9, { wob: 0.3, step: 3 });
      const m = [mix(B[0], Fp[0], 0.55), mix(B[1], Fp[1], 0.55)]; A.line(C, rng, [m[0] + 1, m[1] - w * 0.5, m[0] + 3, m[1] + w * 0.5], M.pencil, deep, 1.6, 0.85, { wob: 0.2 }); A.line(C, rng, [m[0] - 1.4, m[1] - w * 0.5, m[0] + 0.6, m[1] + w * 0.3], M.pencil, hx('#f4fff4'), 0.9, 0.6);
      // the eyepiece, a rubber cup worn smooth
      const er = w * 0.36, ep = [B[0] - 2.5, B[1] + 0.5], cup = []; for (let a = 0; a < 6.3; a += 0.3) cup.push(ep[0] + Math.cos(a) * er * 0.72, ep[1] + Math.sin(a) * er);
      S.solid(C, rng, cup, hx('#14123c'), { w: 3, over: 0.1 });
      A.line(C, rng, A.curve(cup.concat([cup[0], cup[1]]), 2), M.pencil, hx('#0c0a22'), 1.5, 0.95, { wob: 0.2, step: 3 });
      { const hl = []; for (let a = 3.3; a < 5.2; a += 0.3) hl.push(ep[0] + Math.cos(a) * er * 0.72, ep[1] + Math.sin(a) * er); A.line(C, rng, hl, M.pencil, lampC, 1.2, 0.9, { wob: 0.1, step: 3 }); }
      A.dot(C, rng, ep[0] + 0.5, ep[1] + 0.5, M.pencil, hx('#2a5cae'), er * 0.6, 0.8); A.dot(C, rng, ep[0] - 0.6, ep[1] - 1, M.oil, hx('#d2dff6'), 1.3, 0.9);
      // outline
      A.line(C, rng, [B[0], B[1] - w / 2, Fp[0], Fp[1] - wf / 2], M.pencil, hx('#4a6a90'), 1.1, 0.75, { wob: 0.3 }); A.line(C, rng, [B[0], B[1] + w / 2, Fp[0], Fp[1] + wf / 2], M.pencil, deep, 1.5, 0.9, { wob: 0.3, reps: 2, off: 0.4 });
    };
    barrel(-1, false);
    { const a = P(bx - dir[0] * 0.05, hc + 0.06, bz - dir[1] * 0.05); S.rect(C, rng, a[0] - 0.07 * sc, a[1] - 0.05 * sc, a[0] + 0.07 * sc, a[1] + 0.05 * sc, bodyD, { w: 3 }); }    // the bridge between them
    barrel(1, true);
    { const a = P(bx + lat[0] * 0.02 - dir[0] * 0.02, hc + 0.105, bz + lat[1] * 0.02 - dir[1] * 0.02); A.dot(C, rng, a[0], a[1], M.conte, hx('#d64a54'), 0.05 * sc, 1); A.dot(C, rng, a[0] - 1, a[1] - 1, M.oil, hx('#ffc6a8'), 1.4, 0.9); }   // focus knob, red
  }

  // ------------------------------------------------------------------ last touches
  S.finishing = function (C, rng) {
    const WH = S.WH;
    // the moon again, small, in the puddle by the corner of the wall
    { const mx = 940, my = 2 * HY - 96 + 0, r = 13;
      for (let k = 0; k < 2; k++) { const xy = []; for (let a = 0.55; a <= 2.75; a += 0.2) xy.push(mx + Math.cos(-(a + 0.35)) * r + rng.g() * 0.8, my + Math.sin(-(a + 0.35)) * r * 0.82); C.stroke(A.hand(rng, xy, { wob: 0.5, t0: 0.4, t1: 0.4, pe: 0.1, step: 2 }), k ? M.oil : M.pastelTip, k ? hx('#fffbe8') : hx('#fbe8a8'), k ? 2 : 3, 0.95); }
      for (let k = 0; k < 4; k++) A.line(C, rng, [mx - rng.r(4, 12), my + r + 3 + k * 3.5, mx + rng.r(2, 10), my + r + 3 + k * 3.5 + rng.g() * 0.4], M.pencil, hx('#fbe8a8'), 0.9, 0.6 - k * 0.1, { wob: 0.3 }); }
    // sparkle on wet things
    for (let k = 0; k < 110; k++) { const x = rng.r(0, 1600), y = rng.r(510, 898); if (!S.onFloor(x, y)) continue; const g = S.floorCol(x, y); if (g[0] + g[1] + g[2] < 1.0 && rng() < 0.7) continue; A.dot(C, rng, x, y, M.oil, rng() < 0.5 ? c.white : hx('#d2dff6'), rng.r(0.9, 1.7), 1.0); }
    // construction lines never quite rubbed out: the circle of the wheel, struck with a string and a pencil, and the floor's vanishing lines
    { const hub = fl(WH.x, WH.z, WH.hub), R = WH.r * F / WH.z * 1.035;
      for (const [a0, a1] of [[3.5, 4.3], [5.3, 5.9], [0.5, 1.0], [2.2, 2.6]]) { const xy = []; for (let a = a0; a <= a1; a += 0.05) xy.push(hub[0] + Math.cos(a) * R, hub[1] + Math.sin(a) * R); A.line(C, rng, xy, M.pencil, hx('#d6caf2'), 0.7, 0.3, { wob: 0.3, step: 4 }); }
      A.line(C, rng, [hub[0] - R - 22, hub[1], hub[0] - R + 16, hub[1]], M.pencil, hx('#d6caf2'), 0.7, 0.3, { wob: 0.2 }); A.line(C, rng, [hub[0], hub[1] - R - 14, hub[0], hub[1] - R + 12], M.pencil, hx('#d6caf2'), 0.7, 0.3, { wob: 0.2 }); }
    for (const xb of [980, 1290, 1560]) { const y1 = rng.r(745, 790); A.line(C, rng, [VX + (xb - VX) * (y1 - HY) / 480, y1, xb, HY + 480], M.pencil, hx('#b09ee2'), 0.7, 0.26, { wob: 0.5, pj: 0.4 }); }
    A.line(C, rng, [700, HY + 0.5, 930, HY + 1], M.pencil, hx('#5e2260'), 0.7, 0.3, { wob: 0.3, pj: 0.4 });
    // pastel dust that settled where it fell
    for (let k = 0; k < 650; k++) { const x = rng.r(0, 1600), y = rng.r(0, 900); A.dot(C, rng, x, y, M.pastelTip, PAS.c[rng.i(0, PAS.c.length - 1)], rng.r(0.5, 1.2), rng.r(0.3, 0.6)); }
    // where the heel of the hand rested and dragged
    for (const [x, y, r] of [[1500, 874, 22], [520, 888, 18], [1210, 30, 16]]) C.rub([x - 26, y + 4, x, y, x + 30, y - 5], r, 0.2, 0.75);
  };
})(typeof self !== 'undefined' ? self : globalThis);
