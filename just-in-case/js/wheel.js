// wheel.js -- the little wheel on the roof: every lamp lit, every cabin empty, one door left open.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp, mix = A.mix;
  const S = A.S, PAS = S.PAS, c = S.c, F = S.F, VX = S.VX, HY = S.HY, E = S.E, fl = S.fl;

  // a tube of painted steel: dark body, the side the sky reaches, a thread of light
  function beam(C, rng, a, b, w, o) {
    o = o || {};
    S.seg(C, rng, a, b, M.conte, o.dark || hx('#191646'), w, 1.05, { wob: o.wob === undefined ? 0.25 : o.wob, pe: 0.85 });
    let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; let nx = -dy / L, ny = dx / L;
    if (nx + ny * 0.8 > 0) { nx = -nx; ny = -ny; }                        // the lit side looks up and to the left, toward where the sun went
    if (w > 2.4) S.seg(C, rng, [a[0] + nx * w * 0.16, a[1] + ny * w * 0.16], [b[0] + nx * w * 0.16, b[1] + ny * w * 0.16], M.pastelTip, o.mid || hx('#6a62a4'), w * 0.55, 0.85, { wob: 0.25, pe: 0.6 });
    if (o.hi !== null) S.seg(C, rng, [a[0] + nx * w * 0.3, a[1] + ny * w * 0.3], [b[0] + nx * w * 0.3, b[1] + ny * w * 0.3], M.pencil, o.hi || hx('#ffc6a8'), Math.max(0.7, w * 0.2), o.hp || 0.7, { wob: 0.25, pe: 0.4, pj: 0.4 });
  }
  S.beam = beam;

  const BODY = ['#8fd0c0', '#f4a6b8', '#f6e4b0', '#9ab6ea', '#f8b494', '#bfaee6', '#a6e0c0', '#f9c4d0'].map(hx);

  S.drawWheel = function (C, rng) {
    const WH = S.WH, cu = Math.cos(WH.yaw), su = Math.sin(WH.yaw), u = [cu, su], n = [-su, cu], r = WH.r, sc = F / WH.z;
    const W = (th, rad, off, dh) => fl(WH.x + u[0] * rad * Math.cos(th) + n[0] * (off || 0), WH.z + u[1] * rad * Math.cos(th) + n[1] * (off || 0), WH.hub + rad * Math.sin(th) + (dh || 0));
    const Pw = (a, off, h) => fl(WH.x + u[0] * a + n[0] * off, WH.z + u[1] * a + n[1] * off, h);
    const hubS = W(0, 0, 0);
    // ---- the lamps make their own weather: a warm breath in the damp air
    for (let ringk = 0; ringk < 3; ringk++) {
      const rr = r * sc * [1.0, 0.72, 0.4][ringk];
      for (let k = 0; k < 44; k++) { const a = rng() * 6.283, d = rr + rng.g() * 12, x = hubS[0] + Math.cos(a) * d, y = hubS[1] + Math.sin(a) * d; if (y > 520) continue; A.dot(C, rng, x, y, M.pastel, hx(rng() < 0.5 ? '#c080b0' : '#a05090'), rng.r(16, 24), rng.r(0.24, 0.34)); }
      for (let pass = 0; pass < 3; pass++) { const xy = [], ro = rr + [0, -14, 14][pass]; for (let a = 0; a < 6.5; a += 0.1) { const y = hubS[1] + Math.sin(a) * ro; if (y < 530) xy.push(hubS[0] + Math.cos(a) * ro + rng.g() * 3, y + rng.g() * 3); } C.rub(pass % 2 ? A.rev(xy) : xy, 20, 0.6, 0.5); }
    }
    // ---- the platform
    const deckC = [WH.x, 0.15, WH.z];
    for (const f of S.box3(deckC, [3.8, 0.15, 1.55], WH.yaw)) {
      const col = f.id === 'top' ? (x, y) => PAS.near(mix3(hx('#8a5a8c'), hx('#ffb890'), 0.35 + 0.5 * S.gs((x - hubS[0]) / 150) + rng.g() * 0.05), rng, 0.04) : (x, y) => PAS.near(mix3(hx('#2a2258'), hx('#7a4a80'), 0.3 + rng.g() * 0.05), rng, 0.04);
      A.hatch(C, rng, f.poly, { ang: f.id === 'top' ? 0.05 : 1.5, gap: 1.8, med: M.pastelTip, col, w: 3.2, p: 1.05, over: 0.4 });
      if (f.id === 'top') A.hatch(C, rng, f.poly, { ang: -0.5, gap: 4, med: M.pencil, col: hx('#5e2260'), w: 1, p: 0.4, over: 0.3 });
      S.outline(C, rng, f.poly, hx('#14113a'), 1.2, 0.85, { reps: 2 });
      if (f.id === '-n') { // warning stripes worn nearly away along the step's edge
        for (let t = 0.03; t < 0.97; t += 0.045) { const x0 = mix(f.poly[0], f.poly[2], t), y0 = mix(f.poly[1], f.poly[3], t), x1 = mix(f.poly[6], f.poly[4], t + 0.02), y1 = mix(f.poly[7], f.poly[5], t + 0.02); if (rng() < 0.8) A.line(C, rng, [x0, y0 - 1, x1, y1 + 1], M.pastelTip, hx('#f7a84a'), 2.4, rng.r(0.35, 0.8), { wob: 0.2 }); }
        A.line(C, rng, [f.poly[6], f.poly[7], f.poly[4], f.poly[5]], M.pencil, hx('#ffe0c8'), 1.1, 0.8, { wob: 0.3, reps: 2 });
      }
    }
    // two steps up, toward us
    for (const [a, hgt, off] of [[2.3, 0.2, -1.9], [2.3, 0.1, -2.25]]) for (const f of S.box3([WH.x + u[0] * a + n[0] * off, hgt / 2, WH.z + u[1] * a + n[1] * off], [0.8, hgt / 2, 0.18], WH.yaw)) { S.solid(C, rng, f.poly, PAS.near(f.id === 'top' ? hx('#c08a9c') : hx('#3a2a66'), rng, 0.03), { ang: f.id === 'top' ? 0.05 : 1.5, w: 2.4, med: M.pastelTip, over: 0.3 }); S.outline(C, rng, f.poly, hx('#14113a'), 1.0, 0.8); }
    // the motor in its box behind, with a pilot light
    for (const f of S.box3([WH.x + u[0] * -0.2 + n[0] * 1.05, 0.3 + 0.45, WH.z + u[1] * -0.2 + n[1] * 1.05], [0.75, 0.45, 0.4], WH.yaw)) { S.solid(C, rng, f.poly, PAS.near(f.id === 'top' ? hx('#6a62a4') : hx('#2c2760'), rng, 0.03), { w: 3, over: 0.3 }); S.outline(C, rng, f.poly, hx('#14113a'), 1.1, 0.85); }
    { const p = Pw(0.2, 0.62, 0.95); S.bulb(C, rng, p[0], p[1], 2, hx('#3fb0aa'), hx('#d2efcf')); }

    // ---- the frames that carry the axle
    const legs = (off, front) => {
      const top = Pw(0, off, WH.hub);
      for (const a of [-2.5, 2.5]) { const foot = Pw(a, off * 1.25, 0.3); beam(C, rng, foot, top, (front ? 0.2 : 0.17) * sc, { mid: front ? hx('#7a70b4') : hx('#4a4488'), hi: front ? hx('#ffc6a8') : hx('#8a74cc'), hp: front ? 0.8 : 0.5 }); }
      const b0 = Pw(-2.5 * 0.56, off * 1.14, 0.3 + (WH.hub - 0.3) * 0.44), b1 = Pw(2.5 * 0.56, off * 1.14, 0.3 + (WH.hub - 0.3) * 0.44);
      beam(C, rng, b0, b1, 0.1 * sc, { mid: front ? hx('#6a62a4') : hx('#3c3880'), hi: front ? hx('#ffc6a8') : null });
      for (const a of [-2.5, 2.5]) { const p = Pw(a, off * 1.25, 0.3); S.rect(C, rng, p[0] - 0.22 * sc, p[1] - 0.07 * sc, p[0] + 0.22 * sc, p[1] + 0.03 * sc, hx('#14113a'), { w: 2 }); }
    };
    legs(0.85, false);
    // ---- the back rim and its spokes, seen through the front ones
    const ring = (rad, off, w, o) => { for (let k = 0; k < 48; k++) { const a = W(k / 48 * 6.2832, rad, off), b = W((k + 1) / 48 * 6.2832, rad, off); beam(C, rng, a, b, w, o); } };
    const NG = 8, gth = k => k * Math.PI / 4;
    ring(r, 0.42, 0.08 * sc, { mid: hx('#3c3880'), hi: hx('#6650b0'), hp: 0.5, wob: 0.15 });
    for (let k = 0; k < NG; k++) beam(C, rng, W(gth(k), 0.3, 0.42), W(gth(k), r, 0.42), 0.05 * sc, { hi: hx('#6650b0'), hp: 0.45 });

    // ---- the cabins
    const cabin = (k) => {
      const th = gth(k), px = WH.x + u[0] * r * Math.cos(th), pz = WH.z + u[1] * r * Math.cos(th), ph = WH.hub + r * Math.sin(th);
      const bc = BODY[k % BODY.length], open = k === 6;
      const top = fl(px, pz, ph), sway = k === 6 ? 0 : rng.g() * 0.012;
      // the axle between the two rims, and the hanger
      beam(C, rng, fl(px + n[0] * 0.42, pz + n[1] * 0.42, ph), fl(px - n[0] * 0.42, pz - n[1] * 0.42, ph), 0.07 * sc, { hi: hx('#ffc6a8') });
      const cx = px + sway * 8, roofH = ph - 0.36, lit = clamp(0.35 + 0.5 * (1 - (ph - 1.6) / 6.6), 0, 1);
      for (const s of [-1, 1]) beam(C, rng, fl(px + n[0] * 0.3 * s, pz + n[1] * 0.3 * s, ph), fl(cx + n[0] * 0.3 * s + u[0] * 0.0, pz + n[1] * 0.3 * s, roofH), 0.04 * sc, { hi: s < 0 ? hx('#ffc6a8') : null });
      const cz = pz, yaw = WH.yaw;
      const shade = (col, k2) => mix3(col, hx('#3a2e78'), k2);
      // far posts first, and the inside of the far panel glowing under its lamp
      const post = (a, d, strong) => { const p0 = fl(cx + u[0] * a + n[0] * d, cz + u[1] * a + n[1] * d, roofH - 0.1), p1 = fl(cx + u[0] * a + n[0] * d, cz + u[1] * a + n[1] * d, roofH - 0.62); A.line(C, rng, [p0[0], p0[1], p1[0], p1[1]], strong ? M.conte : M.pencil, strong ? shade(bc, 0.45) : hx('#2c2760'), (strong ? 0.085 : 0.05) * sc, 1.0, { wob: 0.15, pe: 0.85 }); if (strong) A.line(C, rng, [p0[0] - 1.4, p0[1], p1[0] - 1.4, p1[1]], M.pencil, mix3(bc, c.white, 0.5), 1.0, 0.8, { wob: 0.15 }); };
      post(-0.46, 0.36, false); post(0.46, 0.36, false);
      { // the inside back, lit warm: nobody on the bench
        const a = fl(cx - u[0] * 0.44 + n[0] * 0.34, cz - u[1] * 0.44 + n[1] * 0.34, roofH - 0.62), b = fl(cx + u[0] * 0.44 + n[0] * 0.34, cz + u[1] * 0.44 + n[1] * 0.34, roofH - 0.46);
        if (ph < E + 1.2) S.rect(C, rng, a[0], b[1], b[0], a[1], hx('#ffc070'), { med: M.pastelTip, w: 2.2, p: 0.9 });
      }
      // lower panel
      const lowC = [cx, roofH - 0.62 - 0.24, cz];
      for (const f of S.box3(lowC, [0.5, 0.24, 0.4], yaw)) {
        let col = f.id === '-n' ? shade(bc, 0.28) : f.id === 'top' ? mix3(bc, hx('#ffc070'), 0.5) : f.id === 'bot' ? mix3(shade(bc, 0.7), hx('#b84490'), 0.2) : shade(bc, 0.55);
        if (f.id === '-n') col = mix3(col, hx('#ffc6a8'), 0.18 * lit);
        S.solid(C, rng, f.poly, PAS.near(col, rng, 0.03), { ang: f.id === '-n' ? 1.45 : 0.3, w: 3.4, med: M.pastelTip, over: 0.3 });
        S.solid(C, rng, f.poly, PAS.near(col, rng, 0.04), { ang: -0.6, w: 2.2, med: M.pastelTip, over: 0.2, single: true, p: 0.8 });
        if (f.id === '-n') {
          const q = f.poly, tx = t => mix(q[0], q[2], t), bandY = t => mix(mix(q[7], q[5], t), mix(q[1], q[3], t), 0.36);
          A.line(C, rng, [tx(0.03), bandY(0.03), tx(0.97), bandY(0.97)], M.pastelTip, mix3(hx('#fffbe8'), bc, 0.15), 0.07 * sc, 0.9, { wob: 0.3 });         // a cream band
          A.line(C, rng, [tx(0.03), mix(q[7], q[1], 0.9), tx(0.97), mix(q[5], q[3], 0.9)], M.pencil, shade(bc, 0.75), 1.2, 0.7, { wob: 0.3 });
          // rust creeping up from the bottom seam
          for (let j = 0; j < 4; j++) A.dot(C, rng, tx(rng()), mix(q[1], q[7], rng.r(0, 0.25)), M.pastelTip, hx('#8a4a4a'), rng.r(1.5, 3), 0.4);
          if (!open) { A.line(C, rng, [tx(0.5), q[1] - 1, tx(0.5), q[7] + 1], M.pencil, shade(bc, 0.8), 1.0, 0.7, { wob: 0.2 }); A.dot(C, rng, tx(0.56), mix(q[7], q[1], 0.3), M.pencil, hx('#fffbe8'), 1.6, 0.9); }
        }
        S.outline(C, rng, f.poly, shade(bc, 0.85), 1.1, 0.8, { ov: 1.5 });
        if (f.id === '-n') A.line(C, rng, [f.poly[6], f.poly[7] + 0.6, f.poly[4], f.poly[5] + 0.6], M.pencil, hx('#fff4c8'), 1.0, 0.7 * lit, { wob: 0.3 });
      }
      if (open) { // the door stands open, the way it was left
        const hinge = [cx - u[0] * 0.5 - n[0] * 0.4, cz - u[1] * 0.5 - n[1] * 0.4], dd = [-0.55, -0.83];
        const q = S.P4(fl(hinge[0], hinge[1], roofH - 0.62), fl(hinge[0] + dd[0] * 0.5, hinge[1] + dd[1] * 0.5, roofH - 0.62), fl(hinge[0] + dd[0] * 0.5, hinge[1] + dd[1] * 0.5, roofH - 1.08), fl(hinge[0], hinge[1], roofH - 1.08));
        S.solid(C, rng, q, PAS.near(mix3(bc, hx('#ffc070'), 0.35), rng, 0.03), { ang: 1.4, w: 2.6, med: M.pastelTip, over: 0.2 });
        S.outline(C, rng, q, shade(bc, 0.85), 1.1, 0.85);
        // and the dark doorway it leaves, with the lit bench beyond
        const a = fl(cx - u[0] * 0.46 - n[0] * 0.4, cz - u[1] * 0.46 - n[1] * 0.4, roofH - 0.64), b = fl(cx - u[0] * 0.02 - n[0] * 0.4, cz - u[1] * 0.02 - n[1] * 0.4, roofH - 1.08);
        S.rect(C, rng, a[0], a[1], b[0], b[1], hx('#f7a84a'), { med: M.pastelTip, w: 2.4 });
        S.rect(C, rng, a[0] + 2, mix(a[1], b[1], 0.45), b[0] - 1, mix(a[1], b[1], 0.62), hx('#b84490'), { med: M.pencil, w: 1.6 });          // the bench
        S.rect(C, rng, a[0] + 1, mix(a[1], b[1], 0.8), b[0], b[1], hx('#5e2260'), { med: M.pencil, w: 1.6 });
      }
      post(-0.46, -0.36, true); post(0.46, -0.36, true);
      // the roof: a shallow cap with a rolled edge
      for (const f of S.box3([cx, roofH - 0.04, cz], [0.58, 0.075, 0.48], yaw)) {
        const col = f.id === 'top' ? mix3(shade(bc, 0.2), hx('#7fa2e0'), 0.25) : f.id === 'bot' ? mix3(shade(bc, 0.5), hx('#f7a84a'), 0.4) : shade(bc, 0.38);
        S.solid(C, rng, f.poly, PAS.near(col, rng, 0.03), { ang: 0.05, w: 2.6, med: M.pastelTip, over: 0.3, single: S.polySize(f.poly)[4] < 4 });
        S.outline(C, rng, f.poly, shade(bc, 0.85), 1.0, 0.8, { ov: 1.5 });
      }
      { // the crown of the roof, a shallow curve above the eaves
        const xy = []; for (let q = 0; q <= 6; q++) { const t = q / 6, p = fl(cx + u[0] * (t - 0.5) * 1.1 - n[0] * 0.46, cz + u[1] * (t - 0.5) * 1.1 - n[1] * 0.46, roofH + 0.035 + Math.sin(t * Math.PI) * 0.13); xy.push(p[0], p[1]); }
        const base = fl(cx - u[0] * 0.56 - n[0] * 0.46, cz - u[1] * 0.56 - n[1] * 0.46, roofH + 0.035), base2 = fl(cx + u[0] * 0.56 - n[0] * 0.46, cz + u[1] * 0.56 - n[1] * 0.46, roofH + 0.035);
        S.solid(C, rng, xy.concat([base2[0], base2[1], base[0], base[1]]), PAS.near(mix3(shade(bc, 0.25), hx('#7fa2e0'), 0.2), rng, 0.03), { ang: 0.05, w: 2.4, med: M.pastelTip, over: 0.2, single: true });
        A.line(C, rng, xy, M.pencil, mix3(bc, c.white, 0.55), 1.1, 0.85, { wob: 0.2, step: 4 });
        const tp = fl(cx - n[0] * 0.46, cz - n[1] * 0.46, roofH + 0.17); A.dot(C, rng, tp[0], tp[1] - 1, M.pencil, shade(bc, 0.6), 2.4, 0.9);
        // window rail
        const r0 = fl(cx - u[0] * 0.5 - n[0] * 0.4, cz - u[1] * 0.5 - n[1] * 0.4, roofH - 0.13), r1 = fl(cx + u[0] * 0.5 - n[0] * 0.4, cz + u[1] * 0.5 - n[1] * 0.4, roofH - 0.13);
        A.line(C, rng, [r0[0], r0[1], r1[0], r1[1]], M.conte, shade(bc, 0.4), 0.06 * sc, 0.95, { wob: 0.2, pe: 0.9 }); }
      // the lamp inside
      const lp = fl(cx - n[0] * 0.1, cz - n[1] * 0.1, roofH - 0.2);
      S.bulb(C, rng, lp[0], lp[1], 2.6, hx('#f7a84a'), hx('#fff4c8'));
    };
    const order = []; for (let k = 0; k < NG; k++) order.push(k);
    order.sort((a, b) => Math.cos(gth(b)) * u[1] - Math.cos(gth(a)) * u[1]);
    for (const k of order) cabin(k);

    // ---- the front rim, spokes, hub
    ring(r, -0.42, 0.085 * sc, { mid: hx('#7a70b4'), hi: hx('#ffd0b8'), hp: 0.8, wob: 0.15 });
    ring(r * 0.55, -0.42, 0.04 * sc, { hi: hx('#b09ee2'), hp: 0.5, wob: 0.15 });
    for (let k = 0; k < NG; k++) {
      beam(C, rng, W(gth(k), 0.3, -0.42), W(gth(k), r, -0.42), 0.055 * sc, { mid: hx('#6a62a4'), hi: hx('#ffc6a8'), hp: 0.7 });
      // light tie rods cross between the spokes
      const a = W(gth(k), r * 0.55, -0.42), b = W(gth(k + 1), r, -0.42), a2 = W(gth(k + 1), r * 0.55, -0.42), b2 = W(gth(k), r, -0.42);
      A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, hx('#28245c'), 0.9, 0.7, { wob: 0.2 }); A.line(C, rng, [a2[0], a2[1], b2[0], b2[1]], M.pencil, hx('#28245c'), 0.9, 0.7, { wob: 0.2 });
    }
    legs(-0.85, true);
    { // hub: a painted disc with a boss
      const hc = W(0, 0, -0.5), hr = 0.5 * sc;
      const disc = []; for (let a = 0; a < 6.3; a += 0.2) disc.push(hc[0] + Math.cos(a) * hr, hc[1] + Math.sin(a) * hr);
      S.solid(C, rng, disc, hx('#f6e4b0'), { w: 4, med: M.pastelTip, over: 0.3 });
      { const ringp = []; for (let a = 0; a < 6.4; a += 0.2) ringp.push(hc[0] + Math.cos(a) * hr * 0.68, hc[1] + Math.sin(a) * hr * 0.68); A.line(C, rng, ringp, M.pastelTip, hx('#de5c98'), hr * 0.22, 0.9, { wob: 0.3, step: 3 }); for (let j = 0; j < 5; j++) A.dot(C, rng, hc[0] + rng.g() * hr * 0.4, hc[1] + hr * rng.r(0.2, 0.8), M.pastelTip, hx('#8a4a4a'), rng.r(2, 4), 0.4); }
      A.line(C, rng, A.curve(disc.concat([disc[0], disc[1]]), 2), M.pencil, hx('#14113a'), 1.3, 0.9, { wob: 0.3, step: 4 });
      A.dot(C, rng, hc[0], hc[1], M.conte, hx('#221d50'), hr * 0.5, 1); A.dot(C, rng, hc[0] - 1.5, hc[1] - 1.5, M.oil, hx('#ffe0c8'), hr * 0.16, 1);
    }

    // ---- the lamps: every one of them on, except the ones that have given up
    const lamps = [];
    for (let k = 0; k < 32; k++) lamps.push([k / 32 * 6.2832 + 0.098, r * 1.0, 0.07]);
    for (let k = 0; k < NG; k++) for (const f of [0.3, 0.55, 0.78]) lamps.push([gth(k), r * f, 0.058]);
    for (let k = 0; k < 10; k++) lamps.push([k / 10 * 6.2832 + 0.2, 0.64, 0.045]);
    const dead = new Set([3, 13, 14, 27, 38, 45, 52, 60]);
    S.wheelLamps = [];
    lamps.forEach((l, i) => {
      const th = l[0], rad = l[1], x = WH.x + u[0] * rad * Math.cos(th) - n[0] * 0.5, z = WH.z + u[1] * rad * Math.cos(th) - n[1] * 0.5, h = WH.hub + rad * Math.sin(th), p = fl(x, z, h);
      const on = !dead.has(i), warm = i % 3 === 0 ? hx('#ffc070') : hx('#f7a84a');
      S.bulb(C, rng, p[0], p[1], l[2] * sc, warm, i % 5 === 0 ? hx('#fffbe8') : hx('#fff4c8'), on);
      if (on) S.wheelLamps.push([x, h, z, l[2]]);
    });
  };
})(typeof self !== 'undefined' ? self : globalThis);
