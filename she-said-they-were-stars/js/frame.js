// frame.js -- the iron of it: eight ribs, eight stretchers, the runner, the shaft going down out of the sheet
// to a hand that is not drawn. Then the water: beads along the hem, drops let go from the rib tips.
// The metal is drawn the way a cel painter would: a dark, a middle, one hard light, one borrowed colour.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, fbm = A.fbm, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c, N = Wd.N, UM = Wd.UM;
  const o3 = [0, 0, 0], t3 = [0, 0, 0], q3 = [0, 0, 0], F = Wd.CAM.F;
  const lum = v => 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];
  const onSheet = (p, pad) => p[0] > -pad && p[0] < 1600 + pad && p[1] > -pad && p[1] < 900 + pad;

  // a rod in the world, seen on the sheet: f(t) -> [x, y, depth], rad = its real half-thickness.
  // returns [{x, y, w, nx, ny}] ; w = its width on the sheet there, (nx, ny) = across it
  function rod(f, n, rad) {
    const q = []; for (let i = 0; i <= n; i++) { const p = f(i / n); if (p[2] < 0.06) continue; q.push({ x: p[0], y: p[1], w: 2 * rad * F / p[2], t: i / n }); }
    for (let i = 0; i < q.length; i++) { const a = q[Math.max(0, i - 1)], b = q[Math.min(q.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; q[i].nx = -dy / l; q[i].ny = dx / l; }
    return q;
  }
  // stroke a rod (or a stripe of it: o.at = where across it, -1..1; o.frac = how much of its width), in pieces as its width changes
  function draw(C, R, q, o) {
    if (q.length < 2) return;
    let i0 = 0;
    while (i0 < q.length - 1) {
      let i1 = i0 + 1; while (i1 < q.length - 1 && Math.abs(q[i1 + 1].w - q[i0].w) < q[i0].w * 0.16 && i1 - i0 < (o.maxSeg || 14)) i1++;
      const pts = []; let w = 0;
      for (let i = i0; i <= i1; i++) { const off = (o.at || 0) * q[i].w * 0.5; pts.push(q[i].x + q[i].nx * off, q[i].y + q[i].ny * off); w += q[i].w; }
      w = w / (i1 - i0 + 1) * (o.frac === undefined ? 1 : o.frac);
      if (!o.skip || !R.chance(o.skip)) C.stroke(o.wob ? P.wob(R, pts, o.wob, 30) : pts, { w: Math.max(o.minW || 0.9, w), c: o.c, m: o.m || M.conte, p: o.p === undefined ? 0.8 : o.p, ti: i0 === 0 ? (o.ti || 0.02) : 0, to: i1 === q.length - 1 ? (o.to || 0.02) : 0, pv: o.pv === undefined ? 0.12 : o.pv, cj: o.cj === undefined ? 0.012 : o.cj, nodust: true });
      i0 = i1;
    }
  }
  Wd.rod = rod; Wd.drawRod = draw;
  // the colour a piece of dark metal borrows at a point of the sheet: warm from the right and below, cold from the left
  function borrow(x, y, out) {
    const w = clamp(0.66 * (x / 1600) + 0.52 * (y / 900) - 0.12, 0, 1), k = ss(0.2, 0.85, w);
    const warm = mix(c.orchid, mix(c.hot, c.salmon, ss(0.55, 1, w)), ss(0.25, 0.75, w)), cold = mix(c.cobalt, c.cerul, ss(700, 60, x));
    out.warm = warm; out.cold = cold; out.k = k; return out;
  }
  const bw = {};
  const _a = [0, 0, 0], _b = [0, 0, 0];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ribF = g => t => Wd.rp(g, 0.02 + t * 1.015);
  function strF(g) { const a = Wd.axis(UM.runner, [0, 0, 0]), b = Wd.rib(g, UM.joint, [0, 0, 0]); const ph = UM.phi0 + g * 2 * Math.PI / N, k = 0.017; a[0] += (UM.e1[0] * Math.cos(ph) + UM.e2[0] * Math.sin(ph)) * k; a[1] += (UM.e1[1] * Math.cos(ph) + UM.e2[1] * Math.sin(ph)) * k; a[2] += (UM.e1[2] * Math.cos(ph) + UM.e2[2] * Math.sin(ph)) * k; return t => Wd.pr(lerp3(a, b, t)); }
  Wd.strFn = strF;
  Wd.zen = () => Wd.vanish([0, 0, 1]);
  // which way is down, on the sheet, at a point
  function down(x, y) { const z = Wd.zen(), dx = x - z[0], dy = y - z[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  Wd.down = down;

  // ------------------------------------------------------------------ shadows first: the seam under every rib, and what the stretchers throw up onto the cloth
  S.frameShadows = function (C, R) {
    C.stencil(Wd.stencil(C), 1);
    for (let g = 0; g < N; g++) {
      const q = rod(ribF(g), 46, 0.002);
      draw(C, R, q, { c: c.ink, m: M.pastel, frac: 3.6, p: 0.3, wob: 0.8 });
      draw(C, R, q, { c: c.ink, m: M.pastel, frac: 2.0, p: 0.34, wob: 0.6, at: 0.8 });
    }
    for (let g = 0; g < N; g++) {
      const f = strF(g), pts = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16, p = f(t), lift = (1 - t); pts.push(p[0] - 15 * lift - 1, p[1] - 21 * lift - 1); }
      if (!onSheet([pts[16], pts[17]], 300)) continue;
      C.stroke(P.wob(R, pts, 1.0, 30), { w: 7, c: c.ink, m: M.pastel, p: 0.26, ti: 0.4, to: 0.1, nodust: true });
      C.stroke(P.wob(R, pts, 1.0, 30), { w: 3.4, c: c.ink, m: M.pastel, p: 0.3, ti: 0.5, to: 0.1, nodust: true });
    }
    C.stencil();
  };

  // ------------------------------------------------------------------ ribs
  function bar(C, R, q, o) {
    o = o || {};
    draw(C, R, q, { c: c.iron, frac: 1.25, p: 0.86, wob: 0.35, minW: 2.2 });
    draw(C, R, q, { c: c.ink, frac: 0.8, p: 0.8, at: -0.2, minW: 1.4 });
    // one side borrows the warm of the street, the other the cold
    const m = q[q.length >> 1]; borrow(m.x, m.y, bw);
    const warmSide = o.warmSide === undefined ? 1 : o.warmSide;
    draw(C, R, q, { c: mix(bw.warm, c.white, 0.12), m: M.wax, frac: 0.32, at: 0.72 * warmSide, p: 0.3 + 0.55 * bw.k, minW: 0.9, skip: 0.12, maxSeg: 6, wob: 0.2 });
    draw(C, R, q, { c: bw.cold, m: M.wax, frac: 0.26, at: -0.8 * warmSide, p: 0.26 + 0.3 * (1 - bw.k), minW: 0.8, skip: 0.3, maxSeg: 5, wob: 0.2 });
  }
  // iron near the moon takes a gold edge on the side that faces it
  function moonEdge(C, R, q) {
    const m = Wd.MOON; let run = [], pk = 0;
    const flush = () => { if (run.length >= 6) C.stroke(run, { w: 1.3, c: mix(c.gold, c.white, 0.25), m: M.wax, p: pk, ti: 0.4, to: 0.4 }); run = []; pk = 0; };
    for (const k of q) {
      const dx = m.x - k.x, dy = m.y - k.y, d = Math.hypot(dx, dy); if (d > 330 || d < 60) { flush(); continue; }
      const sg = (dx * k.nx + dy * k.ny) > 0 ? 1 : -1; run.push(k.x + k.nx * sg * k.w * 0.42, k.y + k.ny * sg * k.w * 0.42); pk = Math.max(pk, 0.85 * (1 - d / 330));
    }
    flush();
  }
  S.ribs = function (C, R) {
    for (let g = 0; g < N; g++) {
      const q = rod(ribF(g), 60, 0.0021); if (q.length < 3) continue;
      bar(C, R, q, { warmSide: (g === 0 || g === 7 || g === 6) ? 1 : -1 }); moonEdge(C, R, q);
      // chipped enamel and rust
      for (let i = 0; i < 26; i++) { const k = q[R.i(1, q.length - 2)]; if (!onSheet([k.x, k.y], 5)) continue; C.dab(k.x + R.g() * k.w * 0.2, k.y + R.g() * k.w * 0.2, R.r(0.6, 1.4), R.chance(0.6) ? c.rust : c.rustD, M.conte, R.r(0.4, 0.7)); }
      // the cloth is tied to the rib in two places with a loop of thread
      for (const s of [0.36, 0.68]) { const p = Wd.rp(g, s); if (!onSheet(p, 0)) continue; const w = 2 * 0.0021 * F / p[2] * 1.2, k = q[Math.round(s / 1.035 * 60)] || q[q.length - 1]; for (let j = -1; j <= 1; j++) C.stroke([p[0] - k.nx * w + k.ny * j * 1.3, p[1] - k.ny * w - k.nx * j * 1.3, p[0] + k.nx * w + k.ny * j * 1.3, p[1] + k.ny * w - k.nx * j * 1.3], { w: 1.0, c: c.thread, m: M.wax, p: 0.6, ti: 0, to: 0 }); }
    }
    // the bent one was never made straight again, only bound: wire wound round the kink, then thread over the wire
    const bg = Wd.BENT, pk = Wd.rp(bg, 0.66);
    if (onSheet(pk, 0)) {
      const q = rod(t => Wd.rp(bg, 0.60 + t * 0.12), 30, 0.0021);
      for (let i = 0; i < q.length; i++) { const k = q[i], w = k.w * 0.95; C.stroke([k.x - k.nx * w + k.ny * 0.8, k.y - k.ny * w - k.nx * 0.8, k.x + k.nx * w - k.ny * 0.8, k.y + k.ny * w + k.nx * 0.8], { w: 1.5, c: i % 5 === 2 ? c.steelL : i % 2 ? c.brass : c.brassD, m: M.wax, p: 0.78, ti: 0, to: 0 }); }
      const e = q[q.length - 1]; C.stroke(P.spline([[e.x, e.y], [e.x + 5, e.y + 4], [e.x + 3, e.y + 9], [e.x + 7, e.y + 11]], 2), { w: 1.0, c: c.brass, m: M.wax, p: 0.7 });
    }
  };

  // ------------------------------------------------------------------ the crown, where the ribs hang
  S.crown = function (C, R) {
    const h = Wd.ap(0.014), r = 0.014 * F / h[2];
    // the cloth gathered round it
    C.stencil(Wd.stencil(C), 1);
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, r0 = r * R.r(1.0, 1.4), r1 = r * R.r(2.0, 3.6); C.stroke(P.line(R, h[0] + Math.cos(a) * r0, h[1] + Math.sin(a) * r0 * 0.9, h[0] + Math.cos(a) * r1, h[1] + Math.sin(a) * r1 * 0.9, 0.6, 0.05, 3), { w: R.r(1.2, 2.6), c: R.chance(0.6) ? c.ink : c.indigo, m: M.pastel, p: R.r(0.3, 0.55), ti: 0.1, to: 0.6, nodust: true }); }
    C.stencil();
    for (let i = 0; i < 5; i++) C.stroke(P.circle(R, h[0], h[1], r * (0.3 + i * 0.17), 1.05, 0.04), { w: r * 0.36, c: i % 2 ? c.iron : c.ink, m: M.conte, p: 0.85 });
    C.stroke(P.arc(R, h[0], h[1], r * 1.05, 0.4, 2.2, 0.03), { w: 1.6, c: c.hot, m: M.wax, p: 0.55 });
    C.stroke(P.arc(R, h[0], h[1], r * 1.05, 3.4, 4.9, 0.03), { w: 1.3, c: c.cerul, m: M.wax, p: 0.5 });
    for (let g = 0; g < N; g++) { const p = Wd.rp(g, 0.022); C.dab(p[0], p[1], 1.5, c.steelL, M.wax, 0.7); }
  };

  // ------------------------------------------------------------------ stretchers, and the little hinges where they take the ribs
  S.stretchers = function (C, R) {
    for (let g = 0; g < N; g++) {
      const q = rod(strF(g), 30, 0.0017); if (q.length < 3) continue;
      bar(C, R, q, { warmSide: (g >= 5 || g === 0) ? 1 : -1 }); moonEdge(C, R, q);
      const j = Wd.rp(g, UM.joint); if (!onSheet(j, 10)) continue;
      const r = 0.0042 * F / j[2];
      C.dab(j[0], j[1], r * 1.2, c.iron, M.conte, 0.9); C.stroke(P.circle(R, j[0], j[1], r, 1.1, 0.05), { w: 1.3, c: c.steel, m: M.wax, p: 0.7 });
      C.dab(j[0] - r * 0.25, j[1] - r * 0.3, 0.9, c.white, M.wax, 0.95);
      C.dab(j[0] + r * 0.5, j[1] + r * 0.5, 1.0, c.rust, M.conte, 0.6);
    }
  };

  // ------------------------------------------------------------------ the shaft and its runner
  S.shaft = function (C, R) {
    const f = t => Wd.ap(0.02 + t * 0.66), q = rod(f, 70, 0.0064);
    // steel that has been outdoors: its dark, its middle
    draw(C, R, q, { c: c.iron, frac: 1.08, p: 0.9, wob: 0.3 });
    draw(C, R, q, { c: c.steelD, m: M.pastel, frac: 0.86, p: 0.8, at: 0.05 });
    draw(C, R, q, { c: c.ink, frac: 0.3, p: 0.8, at: -0.42 });
    draw(C, R, q, { c: c.steel, m: M.pastel, frac: 0.3, p: 0.62, at: 0.16, maxSeg: 9 });
    // what it reflects: the cold street on its left, the warm one on its right, drawn hard-edged
    draw(C, R, q, { c: c.cerul, m: M.wax, frac: 0.13, p: 0.72, at: -0.8, skip: 0.06, maxSeg: 8 });
    draw(C, R, q, { c: c.cobalt, m: M.wax, frac: 0.1, p: 0.5, at: -0.62, skip: 0.2, maxSeg: 6 });
    draw(C, R, q, { c: c.hot, m: M.wax, frac: 0.2, p: 0.8, at: 0.62, skip: 0.05, maxSeg: 8 });
    draw(C, R, q, { c: c.amber, m: M.wax, frac: 0.1, p: 0.7, at: 0.8, skip: 0.15, maxSeg: 6 });
    draw(C, R, q, { c: c.white, m: M.wax, frac: 0.085, p: 0.9, at: -0.12, skip: 0.1, maxSeg: 7 });
    draw(C, R, q, { c: c.lilac, m: M.wax, frac: 0.05, p: 0.5, at: 0.3, skip: 0.4, maxSeg: 5 });
    // rust in freckles, more of it near the runner where the rain gets in
    for (let i = 0; i < 150; i++) { const k = q[R.i(0, q.length - 1)], a = R.r(-0.9, 0.9); if (R() > 0.25 + 0.75 * Math.exp(-Math.pow((k.t - 0.37) / 0.2, 2))) continue; C.dab(k.x + k.nx * a * k.w * 0.5 + R.g(), k.y + k.ny * a * k.w * 0.5 + R.g(), R.r(0.6, 1.8), R.chance(0.5) ? c.rust : c.rustD, M.conte, R.r(0.35, 0.7)); }
    // the runner: a sleeve, the ring the stretchers hinge on, the spring catch below it
    const rq = rod(t => Wd.ap(UM.runner - 0.010 + t * 0.052), 14, 0.0092);
    draw(C, R, rq, { c: c.iron, frac: 1.06, p: 0.92 });
    draw(C, R, rq, { c: c.brassD, m: M.pastel, frac: 0.86, p: 0.82 });
    draw(C, R, rq, { c: c.rustD, m: M.pastel, frac: 0.34, p: 0.7, at: -0.52 });
    draw(C, R, rq, { c: hx('#5a3a3a'), m: M.conte, frac: 0.16, p: 0.6, at: 0.9 });
    draw(C, R, rq, { c: c.brass, m: M.pastel, frac: 0.26, p: 0.8, at: 0.18 });
    draw(C, R, rq, { c: c.cream, m: M.wax, frac: 0.1, p: 0.9, at: -0.1 });
    draw(C, R, rq, { c: c.hot, m: M.wax, frac: 0.14, p: 0.7, at: 0.7 });
    draw(C, R, rq, { c: c.cerul, m: M.wax, frac: 0.1, p: 0.6, at: -0.8 });
    for (const i of [0, 4, rq.length - 1]) { const k = rq[i], w = k.w * 0.56; C.stroke([k.x - k.nx * w, k.y - k.ny * w, k.x + k.nx * w, k.y + k.ny * w], { w: i === 4 ? 2.4 : 3, c: c.ink, m: M.conte, p: 0.85, ti: 0, to: 0 }); if (i === 4) C.stroke([k.x - k.nx * w * 0.8 + k.ny * 2, k.y - k.ny * w * 0.8 - k.nx * 2, k.x + k.nx * w * 0.5 + k.ny * 2, k.y + k.ny * w * 0.5 - k.nx * 2], { w: 1.1, c: c.lemon, m: M.wax, p: 0.7, ti: 0, to: 0 }); }
    // the spring catch that holds it up: a small tongue of steel standing out of the shaft below the runner
    { const k = rod(t => Wd.ap(UM.runner + 0.058 + t * 0.022), 6, 0.0064), a = k[0], b = k[k.length - 1]; C.stroke([a.x + a.nx * a.w * 0.5, a.y + a.ny * a.w * 0.5, b.x + b.nx * b.w * 0.72, b.y + b.ny * b.w * 0.72], { w: 3.4, c: c.iron, m: M.conte, p: 0.9, ti: 0, to: 0 }); C.stroke([a.x + a.nx * a.w * 0.55, a.y + a.ny * a.w * 0.55, b.x + b.nx * b.w * 0.76, b.y + b.ny * b.w * 0.76], { w: 1.3, c: c.hot, m: M.wax, p: 0.8, ti: 0, to: 0 }); }
  };

  // ------------------------------------------------------------------ the tips of the ribs, and the water
  function bead(C, R, x, y, r, o) {
    o = o || {}; const d = down(x, y);
    Wd.behind(x, y, t3); const lm = lum(t3), body = mix(t3, c.white, 0.4 + 0.3 * lm);
    // a drop is a lens: dark on the side the light comes from, bright on the far side, one hard point of light
    C.stroke([x - d[0] * r * 0.5, y - d[1] * r * 0.5, x + d[0] * r * (o.long || 0.6), y + d[1] * r * (o.long || 0.6)], { w: r * 2, c: mix(body, c.ink, 0.45), m: M.wax, p: 0.85, ti: 0.4, to: 0.05, pv: 0 });
    C.stroke([x + d[0] * r * 0.1, y + d[1] * r * 0.1, x + d[0] * r * (o.long || 0.6), y + d[1] * r * (o.long || 0.6)], { w: r * 1.3, c: body, m: M.wax, p: 0.9, ti: 0.3, to: 0.05, pv: 0 });
    if (r > 1.6) C.glow(x, y, r * 4.5, t3, 0.3 * lm + 0.08);
    C.pin(x - r * 0.3 - d[0] * r * 0.1, y - r * 0.32 - d[1] * r * 0.1, Math.max(0.36, r * 0.24), mix(t3, c.white, 0.5), { a: 1, halo: 3.6 });
  }
  Wd.bead = bead;
  S.tips = function (C, R) {
    Wd.TIPS = [];
    for (let g = 0; g < N; g++) {
      const p = Wd.rp(g, 1.036); if (!onSheet(p, 40)) continue;
      const r = 0.0042 * F / p[2];
      // the cloth is sewn to the tip in a little cap
      const pa = Wd.rp(g, 0.985); C.stroke([pa[0], pa[1], p[0], p[1]], { w: r * 1.5, c: c.ink, m: M.conte, p: 0.85, ti: 0, to: 0 });
      C.dab(p[0], p[1], r * 1.15, c.brassD, M.conte, 0.9); C.dab(p[0] + r * 0.1, p[1] + r * 0.1, r * 0.7, c.brass, M.pastel, 0.8);
      borrow(p[0], p[1], bw); C.stroke(P.arc(R, p[0], p[1], r * 1.05, 0.2, 1.9, 0.02), { w: 1.2, c: bw.warm, m: M.wax, p: 0.7 });
      C.dab(p[0] - r * 0.3, p[1] - r * 0.35, Math.max(0.8, r * 0.26), c.white, M.wax, 0.95);
      Wd.TIPS.push([p[0], p[1], r]);
    }
  };
  S.water = function (C, R) {
    // beads strung along the wet hem
    for (let g = 0; g < N; g++) {
      let th = g + R.r(0.01, 0.05);
      while (th < g + 0.99) {
        const p = Wd.cp(th, Wd.smax(th) + 0.004);
        if (onSheet(p, 0)) { const d = down(p[0], p[1]), r = R.r(1.3, 2.9) * (0.6 / Math.max(0.4, p[2])) * (R.chance(0.14) ? 1.5 : 1); bead(C, R, p[0] + d[0] * r * 0.7, p[1] + d[1] * r * 0.7, r, { long: R.r(0.5, 1.3) }); }
        th += R.r(0.010, 0.05);
      }
    }
    // the tips let go of theirs one at a time
    for (const t of Wd.TIPS || []) {
      const d = down(t[0], t[1]); let x = t[0] + d[0] * t[2] * 1.9, y = t[1] + d[1] * t[2] * 1.9;
      bead(C, R, x, y, t[2] * 0.85, { long: 1.5 });
      let gap = R.r(16, 40);
      for (let k = 0; k < 4; k++) {
        x += d[0] * gap; y += d[1] * gap; if (y > 905 || x < -5 || x > 1605) break;
        const L = 5 + k * 5 + R.r(0, 5), r = Math.max(1.3, t[2] * (0.62 - k * 0.07));
        Wd.behind(x, y, t3);
        C.stroke([x - d[0] * L, y - d[1] * L, x, y], { w: r * 1.5, c: mix(t3, c.white, 0.7), m: M.chalk, p: 0.7, ti: 0.7, to: 0.02, pv: 0.1, nodust: true });
        bead(C, R, x, y, r, { long: 0.9 });
        gap *= R.r(1.5, 2.1);
      }
    }
  };

  // ------------------------------------------------------------------ it leaks, of course it leaks. A drop that comes through a hole falls
  // across the whole sky with the lamp in it.
  S.leaks = function (C, R) {
    const fall = (x, y, L, r) => {
      const d = down(x, y), hx2 = x + d[0] * L, hy = y + d[1] * L, col = [0, 0, 0]; Wd.starLight(x, y, col);
      const warm = mix(col, c.lemon, 0.4);
      C.pin(x, y, 1.5, col, { a: 1, halo: 6 });                                                      // the hole it came by
      C.glow(hx2, hy, r * 7, warm, 0.3, { pow: 2 });
      // its fall: a line that thins behind it
      C.stroke(P.line(R, x + d[0] * L * 0.18, y + d[1] * L * 0.18, hx2, hy, 0.3, 0.004, 4), { w: r * 1.5, c: mix(warm, c.white, 0.5), m: M.chalk, p: 0.74, ti: 0.85, to: 0.02, pv: 0.1, nodust: true });
      C.stroke(P.line(R, x + d[0] * L * 0.55, y + d[1] * L * 0.55, hx2, hy, 0.2, 0.004, 4), { w: r * 0.8, c: c.white, m: M.wax, p: 0.9, ti: 0.7, to: 0.02 });
      bead(C, R, hx2, hy, r, { long: 1.1 });
      Wd.FLARES.push([hx2 - r * 0.3, hy - r * 0.3, 12 + r * 3]);
    };
    fall(1004, 262, 92, 3.0); fall(486, 632, 54, 2.2); fall(1238, 446, 40, 1.9);
    // and one that has not let go yet
    { const x = 836, y = 352, d = down(x, y), col = [0, 0, 0]; Wd.starLight(x, y, col); C.pin(x, y, 1.3, col, { a: 1, halo: 6 }); bead(C, R, x + d[0] * 4, y + d[1] * 4, 2.6, { long: 1.5 }); }
  };

  // ------------------------------------------------------------------ the two sticks of chalk, each on its thread, tied to a stretcher where a small
  // hand could reach them. The yellow one is worn to a stub. The pink one has hardly been used since.
  S.sticks = function (C, R) {
    const f = Wd.strFn(7);
    const hang = (t, L, len, wd, col, lean) => {
      const a = f(t), d = down(a[0], a[1]), ang = Math.atan2(d[1], d[0]) + lean, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const k = [a[0] + d[0] * L + nx * 2, a[1] + d[1] * L + ny * 2];                 // where the thread is tied round the stick
      const top = [k[0] - ux * len * 0.22, k[1] - uy * len * 0.22], bot = [k[0] + ux * len * 0.78, k[1] + uy * len * 0.78];
      // what it throws on the cloth behind
      C.stencil(Wd.stencil(C), 1);
      C.stroke([top[0] - 10, top[1] - 14, bot[0] - 10, bot[1] - 14], { w: wd * 1.2, c: c.ink, m: M.pastel, p: 0.36, ti: 0.2, to: 0.2, nodust: true });
      C.stencil();
      // the thread: knotted on the iron, hanging a little slack
      C.stroke(P.spline([[a[0], a[1]], [a[0] + d[0] * L * 0.5 - nx * 1.5, a[1] + d[1] * L * 0.5 - ny * 1.5], [k[0], k[1]]], 3), { w: 1.2, c: c.thread, m: M.wax, p: 0.8, ti: 0, to: 0 });
      C.stroke(P.circle(R, a[0], a[1], 2.6, 1.4, 0.05), { w: 1.1, c: c.thread, m: M.wax, p: 0.8 }); C.stroke([a[0], a[1], a[0] + 4, a[1] + 5], { w: 0.8, c: c.thread, m: M.wax, p: 0.7, ti: 0, to: 0.5 });
      // the stick: a dark side, a middle, the side the street lights
      C.stroke([top[0], top[1], bot[0], bot[1]], { w: wd, c: mix(col, c.violet, 0.5), m: M.pastel, p: 0.92, ti: 0, to: 0, pv: 0.04, nodust: true });
      C.stroke([top[0] + nx * wd * 0.12, top[1] + ny * wd * 0.12, bot[0] + nx * wd * 0.12, bot[1] + ny * wd * 0.12], { w: wd * 0.66, c: col, m: M.pastel, p: 0.9, ti: 0, to: 0.02, pv: 0.04, nodust: true });
      C.stroke([top[0] + nx * wd * 0.26, top[1] + ny * wd * 0.26, bot[0] + nx * wd * 0.26, bot[1] + ny * wd * 0.26], { w: wd * 0.24, c: mix(col, c.white, 0.6), m: M.wax, p: 0.8, ti: 0.05, to: 0.1 });
      C.stroke([top[0] - nx * wd * 0.4, top[1] - ny * wd * 0.4, bot[0] - nx * wd * 0.4, bot[1] - ny * wd * 0.4], { w: 1.0, c: c.cerul, m: M.wax, p: 0.4, ti: 0.1, to: 0.1 });
      // sawn square at the top; the worn end rubbed to a slant
      C.stroke([top[0] - nx * wd * 0.5 - ux * wd * 0.42, top[1] - ny * wd * 0.5 - uy * wd * 0.42, top[0] + nx * wd * 0.5 - ux * wd * 0.42, top[1] + ny * wd * 0.5 - uy * wd * 0.42], { w: wd * 0.5, c: c.indigo, m: M.pastel, p: 0.95, ti: 0, to: 0, nodust: true });
      C.stroke([top[0] - nx * wd * 0.42 - ux * wd * 0.1, top[1] - ny * wd * 0.42 - uy * wd * 0.1, top[0] + nx * wd * 0.42 - ux * wd * 0.1, top[1] + ny * wd * 0.42 - uy * wd * 0.1], { w: 1.4, c: mix(col, c.white, 0.5), m: M.wax, p: 0.8, ti: 0, to: 0 });
      C.stroke([bot[0] - nx * wd * 0.4, bot[1] - ny * wd * 0.4, bot[0] + nx * wd * 0.42 - ux * wd * 0.35, bot[1] + ny * wd * 0.42 - uy * wd * 0.35], { w: 1.6, c: mix(col, c.white, 0.75), m: M.wax, p: 0.8, ti: 0, to: 0 });
      // thread wound round it three times
      for (let j = -1; j <= 1; j++) C.stroke([k[0] - nx * wd * 0.55 + ux * j * 1.4, k[1] - ny * wd * 0.55 + uy * j * 1.4, k[0] + nx * wd * 0.55 + ux * (j * 1.4 + 0.8), k[1] + ny * wd * 0.55 + uy * (j * 1.4 + 0.8)], { w: 0.9, c: j ? c.thread : c.threadD, m: M.wax, p: 0.85, ti: 0, to: 0 });
      // dust it has shed down the cloth
      C.stencil(Wd.stencil(C), 1); for (let j = 0; j < 14; j++) C.dab(bot[0] + R.g() * 5 + d[0] * R.r(4, 26), bot[1] + R.g() * 4 + d[1] * R.r(4, 26), R.r(0.5, 1.1), col, M.chalk, R.r(0.3, 0.6)); C.stencil();
    };
    hang(0.33, 48, 25, 11, c.chalkY, 0.24);
    hang(0.43, 38, 60, 11, c.chalkP, -0.13);
  };

  // ------------------------------------------------------------------ the strap that ties it shut, hanging from the hem with its press-stud
  S.strap = function (C, R) {
    const th = 6.3, p = Wd.cp(th, Wd.smax(th) - 0.02), d = down(p[0], p[1]), nx = -d[1], ny = d[0], L = 104, sw = 15;
    const ctrl = [[p[0], p[1]], [p[0] + d[0] * L * 0.35 + nx * 6, p[1] + d[1] * L * 0.35 + ny * 6], [p[0] + d[0] * L * 0.7 + nx * 15, p[1] + d[1] * L * 0.7 + ny * 15], [p[0] + d[0] * L + nx * 17, p[1] + d[1] * L + ny * 17]];
    const pts = P.spline(ctrl, 3), e = ctrl[3];
    Wd.STRAP = e;
    // a band of the same cloth, doubled and stitched, rounded off at the end where the stud is
    C.stroke(pts, { w: sw, c: c.ink, m: M.conte, p: 0.9, ti: 0, to: 0, wv: 0.03 });
    C.dab(e[0] - d[0] * 2, e[1] - d[1] * 2, sw * 0.52, c.ink, M.conte, 0.9);
    C.stroke(pts, { w: sw * 0.72, c: mix(c.indigo, c.violet, 0.6), m: M.pastel, p: 0.74, ti: 0, to: 0.02, nodust: true });
    C.stroke(pts.map((v, i) => v + (i & 1 ? ny : nx) * sw * 0.14), { w: sw * 0.3, c: mix(c.purple, c.orchid, 0.5), m: M.pastel, p: 0.5, ti: 0.05, to: 0.1, nodust: true });
    Wd.behind(e[0], e[1], t3);
    C.stroke(pts.map((v, i) => v + (i & 1 ? ny : nx) * sw * 0.44), { w: 1.6, c: mix(mix(t3, c.hot, 0.5), c.white, 0.35), m: M.wax, p: 0.8, ti: 0.05, to: 0.1 });
    C.stroke(pts.map((v, i) => v - (i & 1 ? ny : nx) * sw * 0.44), { w: 1.1, c: c.cerul, m: M.wax, p: 0.5, ti: 0.1, to: 0.1 });
    // stitching down both edges
    for (let i = 2; i < pts.length - 4; i += 4) for (const sgn of [-1, 1]) C.stroke([pts[i] + nx * sw * 0.27 * sgn, pts[i + 1] + ny * sw * 0.27 * sgn, pts[i + 2] + nx * sw * 0.27 * sgn, pts[i + 3] + ny * sw * 0.27 * sgn], { w: 0.9, c: c.thread, m: M.wax, p: 0.62, ti: 0, to: 0 });
    // the stud
    const sx = e[0] - d[0] * 8, sy = e[1] - d[1] * 8;
    C.dab(sx, sy, 5.0, c.brassD, M.conte, 0.95); C.stroke(P.circle(R, sx, sy, 4.1, 1.1, 0.03), { w: 1.5, c: c.brass, m: M.wax, p: 0.9 }); C.dab(sx, sy, 1.8, c.ink, M.conte, 0.8);
    C.pin(sx - 1.8, sy - 2.0, 0.7, c.lemon, { a: 1, halo: 5 });
    bead(C, R, e[0] + d[0] * 6, e[1] + d[1] * 6, 2.4, { long: 1.2 });
  };

  // ------------------------------------------------------------------ the tear that is only pinned
  S.pinned = function (C, R) {
    Wd.place(); const a = Wd.PINNED[0], b = Wd.PINNED[1], col = [0, 0, 0];
    const lt = Wd.starLight((a.x + b.x) / 2, (a.y + b.y) / 2, col), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    // the gape between the pins
    for (let i = 0; i <= 26; i++) { const t = i / 26, gp = Math.sin(Math.PI * t) * (0.6 + 0.9 * Math.abs(Math.sin(t * 9.4))); C.pin(a.x + dx * t + nx * R.g() * 0.3, a.y + dy * t + ny * R.g() * 0.3, 0.3 + gp * 0.75, col, { a: lt, halo: 4 }); }
    C.stroke(P.line(R, a.x - ux * 3, a.y - uy * 3 + 1.4, b.x + ux * 3, b.y + uy * 3 + 1.4, 0.6, 0.02, 3), { w: 1.4, c: c.ink, m: M.pencil, p: 0.8 });
    const pin = (t, ang) => {
      const x = a.x + dx * t, y = a.y + dy * t, ca = Math.cos(ang), sa = Math.sin(ang), h = 15, X = (u, v) => [x + ca * u - sa * v, y + sa * u + ca * v];
      const p0 = X(-h, -1.6), p1 = X(h, -1.6), p2 = X(h, 1.8), p3 = X(-h + 3, 1.8), hd = X(-h, 0), cl = X(h + 1.5, 0);
      C.stroke([p3[0], p3[1], p2[0], p2[1]], { w: 1.1, c: c.steel, m: M.wax, p: 0.8, ti: 0, to: 0 });
      C.stroke([p0[0], p0[1], p1[0], p1[1]], { w: 1.3, c: c.steelL, m: M.wax, p: 0.9, ti: 0, to: 0 });
      C.stroke(P.circle(R, cl[0], cl[1], 2.1, 1.3, 0.03), { w: 1.0, c: c.steelL, m: M.wax, p: 0.85 });
      C.stroke([hd[0] - ca * 2.5, hd[1] - sa * 2.5, hd[0] + ca * 2.5, hd[1] + sa * 2.5], { w: 5.4, c: c.steel, m: M.wax, p: 0.9, ti: 0, to: 0 });
      C.stroke([hd[0] - ca * 2, hd[1] - sa * 2 - 1, hd[0] + ca * 2, hd[1] + sa * 2 - 1], { w: 1.6, c: c.white, m: M.wax, p: 0.9, ti: 0, to: 0 });
      C.pin(x + ca * 3 - sa * -1.6, y + sa * 3 + ca * -1.6, 0.5, c.white, { a: 1, halo: 5 });
    };
    const ang = Math.atan2(dy, dx);
    pin(0.27, ang + 1.25); pin(0.72, ang + 1.05);
  };
})(typeof self !== 'undefined' ? self : globalThis);
