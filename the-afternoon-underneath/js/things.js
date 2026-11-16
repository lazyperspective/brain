// things.js -- what stands in the water. Each thing is drawn twice: once as it is tonight, upright and
// dark against the afterglow; once folded under itself, as the water remembers it.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c;
  const YH = Wd.YH, F = Wd.F;

  // ------------------------------------------------------------------ the pen: draws in the world, upright or folded
  function Pen(C, R, refl) { this.C = C; this.R = R; this.refl = !!refl; }
  Pen.prototype.pt = function (X, Y, Z) { return Wd.pr(X, this.refl ? -Y : Y, Z); };
  function resample(pts, step) {
    const out = [pts[0], pts[1]]; let acc = 0;
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0); if (L < 1e-6) continue;
      let d = step - acc;
      while (d <= L) { out.push(x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L); d += step; }
      acc = L - (d - step);
    }
    const n = pts.length; if (Math.hypot(out[out.length - 2] - pts[n - 2], out[out.length - 1] - pts[n - 1]) > 0.3) out.push(pts[n - 2], pts[n - 1]);
    return out;
  }
  const NIGHTW = hx('#241c56');
  // a path on the sheet. Upright: one wobbling stroke. Folded: bent by the ripples and broken into the short
  // bars a reflection is really made of.
  Pen.prototype.path = function (pts, o) {
    const C = this.C, R = this.R;
    if (!this.refl) { C.stroke(o.wob === 0 ? pts : P.wob(R, pts, o.wob === undefined ? 0.3 : o.wob, 34), o); return; }
    const rs = resample(pts, 2.2), n = rs.length >> 1; if (n < 2) return;
    for (let i = 0; i < n; i++) { const b = Wd.bend(rs[i * 2], rs[i * 2 + 1]); rs[i * 2] = b[0]; rs[i * 2 + 1] = b[1]; }
    let i = 0;
    while (i < n - 1) {
      const y = rs[i * 2 + 1], dep = Math.max(0, y - YH), m = Math.max(2, Math.round(R.r(5, 12) * (1 + dep / 240))), j = Math.min(n - 1, i + m);
      const mi = (i + j) >> 1, zone = Wd.mem(C, rs[mi * 2], rs[mi * 2 + 1]);
      const sh = R.g() * 0.35 * (1 + dep / 160), ch = new Array((j - i + 1) * 2);
      for (let q = i; q <= j; q++) { ch[(q - i) * 2] = rs[q * 2] + sh; ch[(q - i) * 2 + 1] = rs[q * 2 + 1]; }
      const oo = Object.assign({}, o); oo.ti = 0.22; oo.to = 0.22; oo.p = (o.p === undefined ? 0.6 : o.p) * R.r(0.72, 1.0); oo.w = (o.w || 1) * R.r(0.9, 1.2);
      if (zone < 0.5) { if (o.day) { i = j + 1; continue; } oo.c = mix(o.c, NIGHTW, 0.72); }      // outside the afternoon, the water only has tonight to show
      else if (o.night) { i = j + 1; continue; }
      C.stroke(ch, oo);
      i = j + (R() < 0.22 ? R.i(1, 2) : 0); if (i === j && j >= n - 1) break; if (j >= n - 1) break;
    }
  };
  Pen.prototype.line = function (a, b, o) {
    const p0 = this.pt(a[0], a[1], a[2]), p1 = this.pt(b[0], b[1], b[2]);
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(2, Math.ceil(L / 5) + 1), pts = new Array(n * 2);
    for (let i = 0; i < n; i++) { const t = i / (n - 1), q = this.pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); pts[i * 2] = q[0]; pts[i * 2 + 1] = q[1]; }
    return pts;
  };
  Pen.prototype.poly = function (list) { const pts = []; for (const a of list) { const q = this.pt(a[0], a[1], a[2]); pts.push(q[0], q[1]); } return pts; };
  const off = (pts, d) => { const n = pts.length >> 1, out = new Array(n * 2); for (let i = 0; i < n; i++) { const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1; let tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1]; const l = Math.hypot(tx, ty) || 1; out[i * 2] = pts[i * 2] - ty / l * d; out[i * 2 + 1] = pts[i * 2 + 1] + tx / l * d; } return out; };
  // a round bar between two points of the world. sty: { body, dark, light, line, lit: +1 light falls on its right / -1 left }
  Pen.prototype.tube = function (a, b, diam, sty, o) {
    o = o || {};
    const pts = o.pts || this.line(a, b), zm = (a[2] + b[2]) / 2, w = Math.max(0.9, diam * F / zm), lit = (sty.lit || 1) * (this.refl && sty.flip ? -1 : 1);
    if (w < 2.2) { // too thin to model: one firm line and a lick of light
      this.path(pts, { w: w * 1.15, c: sty.body, m: sty.m || M.conte, p: 0.8, cj: 0.02 });
      if (sty.light && w > 1.1) this.path(off(pts, lit * w * 0.25), { w: Math.max(0.7, w * 0.4), c: sty.light, m: M.wax, p: 0.55, cj: 0.02 });
      return;
    }
    this.path(pts, { w: w * 1.05, c: sty.body, m: sty.m || M.pastel, p: 0.85, cj: 0.02, nodust: true });
    this.path(pts, { w: w * 0.9, c: sty.body, m: M.conte, p: 0.7, cj: 0.03 });
    if (sty.dark) this.path(off(pts, -lit * w * 0.27), { w: w * 0.42, c: sty.dark, m: M.conte, p: 0.6, cj: 0.02 });
    if (sty.light) this.path(off(pts, lit * w * 0.26), { w: Math.max(0.8, w * 0.26), c: sty.light, m: M.wax, p: 0.7, cj: 0.02 });
    if (sty.line) { this.path(off(pts, w * 0.5), { w: 0.9, c: sty.line, m: M.pencil, p: 0.6, wob: 0.35 }); this.path(off(pts, -w * 0.5), { w: 0.9, c: sty.line, m: M.pencil, p: 0.6, wob: 0.35 }); }
    if (sty.rust && !this.refl) for (let i = 0; i < 3; i++) { const t0 = this.R.r(0, 0.85), n = pts.length >> 1, i0 = Math.floor(t0 * (n - 1)), i1 = Math.min(n - 1, i0 + 2 + this.R.i(0, 3)); if (i1 > i0) this.path(pts.slice(i0 * 2, i1 * 2 + 2), { w: w * 0.6, c: sty.rust, m: M.conte, p: 0.45 }); }
  };
  Wd.Pen = Pen;

  // ------------------------------------------------------------------ palettes: tonight / that afternoon
  const NOW = {
    frame: { body: hx('#241b4c'), dark: hx('#120e30'), light: hx('#f2a878'), line: hx('#0e0a28'), rust: hx('#4a2444'), lit: 1 },
    wood: { body: hx('#1c1640'), dark: hx('#0f0b2a'), light: hx('#e8627e'), line: hx('#0c0824'), lit: 1 },
    post: { body: hx('#262052'), dark: hx('#120e30'), light: hx('#ffb68a'), line: hx('#0e0a28'), rust: hx('#43213f'), lit: -1 },
    chain: hx('#221a4c'), chain2: hx('#f2a878'), seat: hx('#4a2a58'), seatDark: hx('#1c1440'), seatTop: hx('#e8a488'), seatHi: hx('#ffd9a8'), wire: hx('#1a1440'),
  };
  const THEN = {
    frame: { body: hx('#f04660'), dark: hx('#b52552'), light: hx('#ffb0a8'), line: hx('#7c1840'), lit: -1 },
    wood: { body: hx('#9a6450'), dark: hx('#5e3a48'), light: hx('#e0aa84'), line: hx('#3c2238'), lit: -1 },
    post: { body: hx('#7fd0b4'), dark: hx('#3f9a90'), light: hx('#e4fbe8'), line: hx('#2a5a66'), lit: -1 },
    chain: hx('#3d4c98'), chain2: hx('#f6f8ff'), seat: hx('#ffcf2e'), seatDark: hx('#e09a20'), seatTop: hx('#ffe678'), seatHi: hx('#fffbe0'), wire: hx('#3a4a8c'),
  };

  // ------------------------------------------------------------------ the swings
  S.swings = function (C, R, refl) {
    const pen = new Pen(C, R, refl), then = refl, pal = then ? THEN : NOW, sw = Wd.SWING;
    const ca = Math.cos(sw.yaw), sa = Math.sin(sw.yaw), W3 = (u, v, h) => [sw.X + ca * u - sa * v, h, sw.Z + sa * u + ca * v];
    const L2 = sw.len / 2, H = sw.H, sp = sw.spread, fr = pal.frame;
    // which things are in front: far A-frame, hangers, bar, near A-frame
    const aFrame = (u, out) => {
      const top = W3(u, 0, H + 0.02);
      for (const sgn of [1, -1]) { // far leg first
        const foot = W3(u + out * 0.14, sgn * sp, 0);
        pen.tube(top, foot, 0.068, fr);
        if (!refl) { const f2 = pen.pt(foot[0], 0, foot[2]); S.ring(C, R, f2[0], f2[1], 9 * 13.6 / foot[2], 1); }
      }
      const t = 0.60, a = W3(u + out * 0.14 * t, sp * t, H * (1 - t)), b = W3(u + out * 0.14 * t, -sp * t, H * (1 - t));
      pen.tube(a, b, 0.045, fr);
    };
    aFrame(L2, 1);
    // hangers
    const hang = (u, th, k) => {
      const Lc = 1.86, piv = H - 0.05, s = Math.sin(th), co = Math.cos(th);
      const end = du => { const p = W3(u + du, 0, piv); return [p[0] - sa * Lc * s, piv - Lc * co, p[2] + ca * Lc * s]; };
      const e0 = end(-0.2), e1 = end(0.2);
      for (const du of [-0.2, 0.2]) {
        const top = W3(u + du, 0, piv), e = end(du), pts = pen.line(top, e);
        if (then) { pen.path(pts, { w: 2.9, c: pal.chain2, m: M.pastel, p: 0.97, wob: 0.15, nodust: true }); pen.path(off(pts, 1.5), { w: 1.0, c: pal.chain, m: M.pencil, p: 0.85, wob: 0.15 }); }
        else pen.path(pts, { w: 1.5, c: pal.chain, m: M.pencil, p: 0.9, wob: 0.15 });
        // links
        const n = pts.length >> 1; for (let i = 1; i < n - 1; i += 1) { if (i % 2) continue; pen.path([pts[i * 2] - 0.2, pts[i * 2 + 1] - 0.9, pts[i * 2] + 0.2, pts[i * 2 + 1] + 0.9], { w: then ? 1.2 : 2.0, c: pal.chain, m: M.pencil, p: 0.75, wob: 0 }); }
        for (let i = 2; i < n - 1; i += 3) {
          if (then) { /* the white chain is its own glint */ }
          else if (R.chance(0.3)) pen.path([pts[i * 2] - 0.4, pts[i * 2 + 1], pts[i * 2] + 0.5, pts[i * 2 + 1]], { w: 1.0, c: hx('#f2a878'), m: M.wax, p: 0.5, wob: 0 });
        }
        // the hook on the bar
        pen.path(P.circle(R, pen.pt(top[0], top[1], top[2])[0], pen.pt(top[0], top[1], top[2])[1], 1.6, 1.1, 0.05), { w: 0.9, c: pal.chain, m: M.pencil, p: 0.8, wob: 0 });
      }
      // the seat: a plank with some thickness; its long faces first, then the top
      const tx = -sa * co, ty = s, tz = ca * co, d = then ? 0.095 : 0.105, thk = then ? 0.07 : 0.06;        // t: along the swing's travel
      const ux = sa * s, uy = co, uz = -ca * s;                                 // u: from the seat toward the pivot
      const q = (e, sg, ex, dn) => [e[0] + tx * d * sg + ca * ex - ux * dn, e[1] + ty * d * sg - uy * dn, e[2] + tz * d * sg + sa * ex - uz * dn];
      const A0 = q(e0, -1, -0.06, 0), B0 = q(e1, -1, 0.06, 0), A1 = q(e0, 1, -0.06, 0), B1 = q(e1, 1, 0.06, 0);
      const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const sc = F / e0[2], sides = [[q(e0, -1, -0.06, thk / 2), q(e1, -1, 0.06, thk / 2)], [q(e0, 1, -0.06, thk / 2), q(e1, 1, 0.06, thk / 2)]];
      sides.sort((a, b) => b[0][2] - a[0][2]);
      pen.path(pen.line(sides[0][0], sides[0][1]), { w: thk * sc, c: pal.seatDark, m: M.conte, p: 0.9, wob: 0.1 });
      for (let i = 0; i <= 4; i++) pen.path(pen.line(mid(A0, A1, i / 4), mid(B0, B1, i / 4)), { w: 2.2, c: pal.seatTop, m: M.pastel, p: 0.85, nodust: true, wob: 0.15 });
      pen.path(pen.line(sides[1][0], sides[1][1]), { w: thk * sc, c: pal.seat, m: M.conte, p: 0.92, wob: 0.1 });
      pen.path(pen.line(sides[1][0], sides[1][1]), { w: thk * sc * 0.8, c: pal.seat, m: M.pastel, p: 0.8, wob: 0.1, nodust: true });
      const nearTop = sides[1][0][2] < (A0[2] + A1[2]) / 2 ? (A0[2] < A1[2] ? [A0, B0] : [A1, B1]) : [A0, B0];
      pen.path(pen.line(nearTop[0], nearTop[1]), { w: 1.3, c: pal.seatHi, m: M.wax, p: 0.85, wob: 0.1 });
      if (then) { // folded: the plank as one solid shape, bent by the water as a whole
        const bq = P3 => { const q = pen.pt(P3[0], P3[1], P3[2]); return Wd.bend(q[0], q[1]); }, dn = P3 => [P3[0] - ux * thk, P3[1] - uy * thk, P3[2] - uz * thk];
        const quad = [bq(A0), bq(B0), bq(B1), bq(A1)], ang = Math.atan2(quad[1][1] - quad[0][1], quad[1][0] - quad[0][0]);
        if (Wd.mem(C, quad[0][0], quad[0][1]) > 0.5) {
          S.fillPoly(C, R, [bq(dn(A0)), bq(dn(B0)), bq(dn(B1)), bq(dn(A1))], { c: pal.seatDark, gap: 1.2, ang, p: 0.95 });
          S.fillPoly(C, R, quad, { c: pal.seat, gap: 1.2, ang, p: 0.95 });
          C.stroke(P.line(R, quad[0][0], quad[0][1], quad[1][0], quad[1][1], 0.2, 0.01, 3), { w: 1.4, c: pal.seatHi, m: M.wax, p: 0.9 });
          const o2 = quad.concat([quad[0]]), fl = []; for (const q of o2) fl.push(q[0], q[1]);
          C.stroke(fl, { w: 0.9, c: hx('#8a5a10'), m: M.pencil, p: 0.75 });
        }
      } else pen.path(pen.poly([A0, B0, B1, A1, A0]), { w: 0.8, c: hx('#100c2c'), m: M.pencil, p: 0.6, wob: 0.2 });
      return [e0, e1];
    };
    const th = then ? [0.98, -0.88] : [0.035, -0.02];
    if (then) for (const sw2 of [[0.78, th[1]], [-0.78, th[0]]]) { // the arc each seat has just come along, the way a pencil says "moving"
      for (let k = 0; k < 4; k++) {
        const Lc = 1.86 + 0.07 + k * 0.045, sg = sw2[1] > 0 ? 1 : -1, a0 = sw2[1] - sg * (0.13 + k * 0.03), a1 = sw2[1] - sg * R.r(0.5, 0.95), list = [];
        for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * i / 12, p = W3(sw2[0] + (k - 1.5) * 0.11, 0, H - 0.05); list.push([p[0] - sa * Lc * Math.sin(a), H - 0.05 - Lc * Math.cos(a), p[2] + ca * Lc * Math.sin(a)]); }
        pen.path(pen.poly(list), { w: 1.2, c: k % 2 ? hx('#fffdf0') : hx('#e6f2ff'), m: M.wax, p: R.r(0.6, 0.85), wob: 0.2, day: 1 });
      }
    }
    hang(0.78, th[1], 1);
    // the bar
    pen.tube(W3(-L2 - 0.08, 0, H), W3(L2 + 0.08, 0, H), 0.075, fr);
    hang(-0.78, th[0], 0);
    aFrame(-L2, -1);
    // joints: a plate and two bolts at each end of the bar
    for (const u of [-L2, L2]) { const p = W3(u, 0, H), q = pen.pt(p[0], p[1], p[2]); pen.path(P.circle(R, q[0], q[1], 0.06 * F / p[2], 1.2, 0.05), { w: 1.6, c: fr.dark, m: M.conte, p: 0.7, wob: 0 }); pen.path([q[0] - 0.6, q[1], q[0] + 0.6, q[1]], { w: 1.6, c: fr.light, m: M.wax, p: 0.7, wob: 0 }); }
    if (!refl) {
      // tonight: a creeper has gone up the near leg, and what is left of a kite string still hangs from the far end of the bar
      S.creeper(C, R, pen, W3(-L2 - 0.14, sp, 0), W3(-L2, 0, H), 0.72);
      S.creeper(C, R, pen, W3(L2 + 0.14, -sp, 0), W3(L2, 0, H), 0.38);
      const e = W3(L2 + 0.06, 0, H - 0.03), q = pen.pt(e[0], e[1], e[2]);
      const ctrl = [[q[0], q[1]], [q[0] + 2, q[1] + 16], [q[0] + 5.5, q[1] + 30], [q[0] + 4, q[1] + 43], [q[0] + 7, q[1] + 52]];
      C.stroke(P.spline(ctrl, 3), { w: 0.9, c: hx('#cdb9c8'), m: M.wax, p: 0.55 });
      C.stroke([q[0] + 6.4, q[1] + 49, q[0] + 9.5, q[1] + 56], { w: 2.2, c: hx('#c98aa0'), m: M.pastel, p: 0.6, nodust: true });
      C.stroke([q[0] + 5.2, q[1] + 51, q[0] + 4.4, q[1] + 58], { w: 1.6, c: hx('#9a7fb0'), m: M.pastel, p: 0.5, nodust: true });
    }
  };
  // a morning-glory vine winding up a leg
  S.creeper = function (C, R, pen, foot, top, upto) {
    const n = 60, pts = [], lv = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n * upto, X = foot[0] + (top[0] - foot[0]) * t, Y = foot[1] + (top[1] - foot[1]) * t, Z = foot[2] + (top[2] - foot[2]) * t, q = pen.pt(X, Y, Z);
      const wv = Math.sin(i * 0.62) * (3.4 - 1.2 * t / upto); pts.push(q[0] + wv, q[1]);
      if (i % 3 === 1) lv.push([q[0] + wv * 1.5 + R.g() * 1.4, q[1] + R.g(), t / upto]);
    }
    C.stroke(pts, { w: 1.3, c: hx('#123a3a'), m: M.pencil, p: 0.8 });
    for (const l of lv) {
      const r = R.r(2.0, 3.6) * (1 - 0.35 * l[2]), a = R.r(0, 6.28);
      C.stroke([l[0] - Math.cos(a) * r, l[1] - Math.sin(a) * r * 0.7, l[0] + Math.cos(a) * r, l[1] + Math.sin(a) * r * 0.7], { w: r * 1.5, c: R.chance(0.5) ? hx('#17463f') : hx('#1c3550'), m: M.pastel, p: 0.75, nodust: true, ti: 0.4, to: 0.1 });
      if (R.chance(0.45)) C.stroke([l[0] + r * 0.2, l[1] - r * 0.5, l[0] + r * 0.9, l[1] - r * 0.1], { w: 1.0, c: hx('#e89a7a'), m: M.wax, p: 0.5 });
    }
    // a few flowers, shut for the night
    for (let i = 0; i < 4; i++) { const l = R.pick(lv); C.stroke([l[0] + 2, l[1], l[0] + 4.5, l[1] - 3.5], { w: 2.0, c: hx('#9c8ad8'), m: M.pastel, p: 0.7, nodust: true, ti: 0, to: 0.6 }); }
  };

  // rings where something stands in (or touches) the water
  S.ring = function (C, R, x, y, r, k) {
    for (let i = 0; i < 3; i++) {
      const rr = r * (0.55 + i * 0.5), a0 = R.r(0, 6.28);
      C.stroke(P.arc(R, x, y + 0.4, rr, a0, a0 + R.r(2.2, 4.6), 0.03, 0.2), { w: 0.9, c: i % 2 ? hx('#fff2c8') : hx('#30245c'), m: M.wax, p: 0.5 * k, ti: 0.4, to: 0.4 });
    }
  };

  // ------------------------------------------------------------------ the lamp that is still on
  S.lamp = function (C, R, refl) {
    const pen = new Pen(C, R, refl), then = refl, pal = then ? THEN : NOW, L = Wd.LAMP, st = pal.post;
    pen.tube([L.X, 0, L.Z], [L.X, L.H - 0.35, L.Z], 0.12, st);
    pen.tube([L.X, 0, L.Z], [L.X, 0.5, L.Z], 0.17, st);
    // the gooseneck
    const neck = []; for (let i = 0; i <= 14; i++) { const a = Math.PI * (i / 14) * 0.92; neck.push([L.X - L.arm * 0.5 * (1 - Math.cos(a)), L.H - 0.35 + 0.33 * Math.sin(a) + 0.06 * (i / 14), L.Z]); }
    pen.tube(neck[0], neck[14], 0.07, st, { pts: pen.poly(neck) });
    const hd = neck[14], hp = pen.pt(hd[0] - 0.02, hd[1] - 0.06, hd[2]), sc = F / L.Z, sg = refl ? -1 : 1;
    // the enamel shade: a shallow dish
    const shade = (col, w, k) => pen.path([hp[0] - 0.30 * sc * k, hp[1] + sg * 0.12 * sc, hp[0] - 0.10 * sc * k, hp[1] - sg * 0.03 * sc, hp[0] + 0.10 * sc * k, hp[1] - sg * 0.03 * sc, hp[0] + 0.30 * sc * k, hp[1] + sg * 0.12 * sc], { w, c: col, m: M.conte, p: 0.85, wob: 0.1 });
    if (!then) {
      const gx = hp[0], gy = hp[1] + 0.2 * sc;
      // the light it lends: wide and warm; the paper was left bare under it
      C.veil(gx - 300, gy - 240, gx + 300, gy + 330, (x, y, col) => {
        const dx = x - gx, dy = y - gy, d = Math.hypot(dx, dy);
        col[0] = 1; col[1] = 0.86; col[2] = 0.56;
        let a = 0.62 * Math.exp(-d / 34) + 0.26 * Math.exp(-d / 110);
        if (dy > 0) a += 0.17 * Math.exp(-Math.pow(dx / (18 + dy * 0.42), 2)) * Math.exp(-dy / 210);      // the cone it throws down
        return y > YH ? a * 0.5 : a;
      }, { g: 0.75, mode: 'lend' });
      C.veil(gx - 40, gy - 40, gx + 40, gy + 40, (x, y, col) => { const d = Math.hypot(x - gx, y - gy); col[0] = 1; col[1] = 0.985; col[2] = 0.86; return 0.95 * Math.exp(-d * d / 110); }, { g: 0.3, mode: 'lend' });
      { const rx = 0.31 * sc, ry = 0.075 * sc, cy0 = gy - 0.11 * sc, el = []; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; el.push([gx + Math.cos(a) * rx, cy0 + Math.sin(a) * ry]); }
        S.fillPoly(C, R, [[gx - rx, cy0], [gx - rx * 0.36, cy0 - 0.17 * sc], [gx + rx * 0.36, cy0 - 0.17 * sc], [gx + rx, cy0]], { c: hx('#191338'), gap: 1.1, w: 1.8, p: 0.95, m: M.conte });
        S.fillPoly(C, R, el, { c: hx('#fff0b0'), gap: 1.0, w: 1.6, p: 0.95, m: M.glow });
        C.stroke(P.arc(R, gx, cy0, rx, Math.PI, 2 * Math.PI, 0.01, ry / rx), { w: 1.0, c: hx('#191338'), m: M.pencil, p: 0.8 });
        C.stroke(P.arc(R, gx, cy0, rx * 1.02, 0.1, Math.PI - 0.1, 0.01, ry / rx), { w: 0.9, c: hx('#c98a5a'), m: M.wax, p: 0.6 }); }
      // the bulb, and the cross of light
      C.dab(gx, gy - 0.07 * sc, 4.6, c.white, M.glow, 1); C.dab(gx, gy - 0.07 * sc, 3.2, c.white, M.glow, 1);
      for (const a of [0.02, Math.PI / 2 + 0.03]) { const Lr = a < 1 ? 58 : 40; C.stroke(P.line(R, gx - Lr * Math.cos(a), gy - 0.07 * sc - Lr * Math.sin(a), gx + Lr * Math.cos(a), gy - 0.07 * sc + Lr * Math.sin(a), 0.2, 0, 3), { w: 1.2, c: hx('#fff6d2'), m: M.glow, p: 0.75, ti: 0.5, to: 0.5 }); }
      for (const a of [0.8, 2.35]) C.stroke(P.line(R, gx - 17 * Math.cos(a), gy - 0.07 * sc - 17 * Math.sin(a), gx + 17 * Math.cos(a), gy - 0.07 * sc + 17 * Math.sin(a), 0.2, 0, 3), { w: 0.9, c: hx('#ffeeb8'), m: M.glow, p: 0.55, ti: 0.5, to: 0.5 });
      // rays of pastel combed outward by hand
      for (let i = 0; i < 46; i++) { const a = R.r(0, 6.283), r0 = R.r(9, 22), r1 = r0 + R.r(10, 46); C.stroke(P.line(R, gx + Math.cos(a) * r0, gy + Math.sin(a) * r0, gx + Math.cos(a) * r1, gy + Math.sin(a) * r1, 0.4, 0.02, 4), { w: R.r(1.2, 2.6), c: mix(hx('#ffe9a8'), hx('#ffb07a'), R()), m: M.glow, p: R.r(0.22, 0.42), ti: 0.1, to: 0.7 }); }
      // moths
      for (let i = 0; i < 13; i++) { const a = R.r(0, 6.283), d = R.r(9, 44), x = gx + Math.cos(a) * d, y = gy + Math.sin(a) * d * 0.8; C.stroke([x - 1.2, y - R.r(0.3, 1.2), x, y, x + 1.2, y - R.r(0.3, 1.2)], { w: 1.0, c: hx('#fff8e0'), m: M.wax, p: R.r(0.5, 0.9) }); }
      // the light it lays on the water under itself
      const base = pen.pt(L.X - L.arm, 0, L.Z);
      for (let i = 0; i < 34; i++) { const y = base[1] + R.r(-4, 46) * R.r(0.3, 1), hw = R.r(3, 16) * (1 + (y - base[1]) / 40), x = base[0] + R.g() * (10 + (y - base[1]) * 0.7); C.stroke(P.line(R, x - hw, y, x + hw, y + R.g() * 0.2, 0.2, 0, 3), { w: R.r(0.9, 1.7), c: mix(hx('#fff0b8'), hx('#ffc890'), R()), m: M.glow, p: R.r(0.35, 0.7), ti: 0.4, to: 0.4 }); }
      const f = pen.pt(L.X, 0, L.Z); S.ring(C, R, f[0], f[1], 7, 1);
    } else {
      shade(hx('#f4f1e4'), 4.4, 1); shade(hx('#a9b6e6'), 1.4, 0.8);
      pen.path(P.circle(R, hp[0], hp[1] + sg * 0.15 * sc, 2.6, 1.1, 0.04), { w: 1.6, c: hx('#fdfbe8'), m: M.pastel, p: 0.8, wob: 0, nodust: true });
    }
  };

  // ------------------------------------------------------------------ the poles, walking toward where the sun went
  const POLES = []; { const ts = [0, 15, 32, 52, 76, 105, 140, 185, 245, 330]; for (const t of ts) POLES.push({ X: -10.5 - 0.22 * t, Z: 22 + t, H: 7.0 }); }
  Wd.POLES = POLES;
  const wireY = (p0, p1, off, t, sag) => { // a point on the wire between two poles
    const a = [p0.X + off, p0.H - 0.42, p0.Z], b = [p1.X + off, p1.H - 0.42, p1.Z];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  };
  S.poles = function (C, R, refl) {
    const pen = new Pen(C, R, refl), then = refl, pal = then ? THEN : NOW, st = pal.wood;
    const prev = { X: POLES[0].X + 0.22 * 14, Z: POLES[0].Z - 14, H: 7.0 };   // the pole behind us, off the sheet
    for (let i = POLES.length - 1; i >= 0; i--) {
      const p = POLES[i], q = i > 0 ? POLES[i - 1] : prev, sag = 0.5 + 0.02 * (p.Z - q.Z);
      // wires from this pole back toward us
      for (const o of [-0.78, 0, 0.78, 0.4]) {
        const lower = o === 0.4, pts = [];
        for (let k = 0; k <= 26; k++) { const w = wireY(q, p, lower ? 0.3 : o, k / 26, sag * (lower ? 1.25 : 1)); if (lower) w[1] -= 0.75; if (w[2] < 6) continue; const s = pen.pt(w[0], w[1], w[2]); pts.push(s[0], s[1]); }
        if (pts.length < 4) continue;
        const wth = clamp(0.03 * F / ((p.Z + q.Z) / 2), 0.45, 1.5);
        pen.path(pts, { w: wth, c: pal.wire, m: M.pencil, p: i > 5 ? 0.5 : 0.8, wob: 0.1 });
        if (!then && i < 3 && !lower) pen.path(off(pts, -0.5), { w: 0.6, c: hx('#f08a8a'), m: M.wax, p: 0.3, wob: 0.1 });
      }
      const sc = F / p.Z;
      pen.tube([p.X, 0, p.Z], [p.X, p.H, p.Z], 0.26, st);
      if (sc * 0.26 > 2) { // grain and a lean of light on the near ones
        pen.tube([p.X - 0.92, p.H - 0.45, p.Z], [p.X + 0.92, p.H - 0.45, p.Z], 0.12, st);
        pen.tube([p.X - 0.3, p.H - 1.2, p.Z], [p.X + 0.62, p.H - 1.2, p.Z], 0.09, st);
        for (const o of [-0.78, 0, 0.78]) { const s = pen.pt(p.X + o, p.H - 0.36, p.Z), sg = refl ? -1 : 1; pen.path([s[0], s[1], s[0], s[1] - sg * 0.13 * sc], { w: Math.max(1.2, 0.09 * sc), c: then ? hx('#f6f4ea') : hx('#6a5a9a'), m: M.conte, p: 0.85, wob: 0 }); }
        if (i === 0) { // a can on the nearest pole, and the brace under the arm
          pen.tube([p.X + 0.34, p.H - 2.3, p.Z], [p.X + 0.34, p.H - 1.5, p.Z], 0.42, then ? { body: hx('#9aa8c8'), dark: hx('#5f6fa6'), light: hx('#f0f4ff'), line: hx('#3c4470'), lit: -1 } : st);
          pen.tube([p.X, p.H - 1.0, p.Z], [p.X - 0.6, p.H - 0.45, p.Z], 0.05, st);
        }
      } else { const a = pen.pt(p.X - 0.92, p.H - 0.45, p.Z), b = pen.pt(p.X + 0.92, p.H - 0.45, p.Z); pen.path([a[0], a[1], b[0], b[1]], { w: Math.max(0.7, 0.12 * sc), c: st.body, m: M.conte, p: 0.8, wob: 0 }); }
      if (!refl && sc * 0.26 > 1.4) { const f = pen.pt(p.X, 0, p.Z); S.ring(C, R, f[0], f[1], 0.16 * sc + 3, 1); }
    }
    // who is on the wire: tonight one; that afternoon, two
    const birds = then ? [0.52, 0.565] : [0.52];
    for (const t of birds) {
      const w = wireY(POLES[0], POLES[1], 0, t, 0.5 + 0.02 * 15), s = pen.pt(w[0], w[1], w[2]), sg = refl ? -1 : 1, sc = F / w[2] * 0.17, cb = then ? hx('#2a2a5e') : hx('#140f34');
      pen.path([s[0] - sc * 0.15, s[1] - sg * sc * 0.25, s[0] + sc * 0.2, s[1] - sg * sc * 0.75], { w: sc * 0.62, c: cb, m: M.conte, p: 0.9, wob: 0 });   // body
      pen.path([s[0] + sc * 0.3, s[1] - sg * sc * 0.95, s[0] + sc * 0.42, s[1] - sg * sc * 1.0], { w: sc * 0.42, c: cb, m: M.conte, p: 0.9, wob: 0 });  // head
      pen.path([s[0] - sc * 0.2, s[1] - sg * sc * 0.2, s[0] - sc * 0.75, s[1] + sg * sc * 0.45], { w: sc * 0.2, c: cb, m: M.conte, p: 0.85, wob: 0 });   // tail
      if (then) pen.path([s[0] + sc * 0.05, s[1] - sg * sc * 0.4, s[0] + sc * 0.25, s[1] - sg * sc * 0.7], { w: sc * 0.22, c: hx('#fff4e0'), m: M.wax, p: 0.8, wob: 0 });
    }
  };

  // ------------------------------------------------------------------ the seesaw: tonight it rests on one end
  S.seesaw = function (C, R, refl) {
    const pen = new Pen(C, R, refl), then = refl, O = [-4.5, 0, 19.2], ya = 0.22, ca = Math.cos(ya), sa = Math.sin(ya), hl = 1.55, ph = 0.52;
    const tilt = then ? 0.0 : 0.27;                                       // level only when there are two
    const st = then ? { body: hx('#ffd43a'), dark: hx('#e0962a'), light: hx('#fff6b8'), line: hx('#8a5a10'), lit: -1 } : NOW.frame;
    const st2 = then ? { body: hx('#3f8fe0'), dark: hx('#2a5cb8'), light: hx('#bfe4ff'), line: hx('#1a3470'), lit: -1 } : NOW.post;
    const at = (u, h) => [O[0] + ca * u * Math.cos(tilt), ph + u * Math.sin(tilt) + h, O[2] + sa * u * Math.cos(tilt)];
    // stand
    pen.tube([O[0] - 0.22, 0, O[2] - 0.05], [O[0], ph, O[2]], 0.07, st2); pen.tube([O[0] + 0.22, 0, O[2] + 0.05], [O[0], ph, O[2]], 0.07, st2);
    // beam: left end (u = -hl) down when tilted
    const a = at(-hl, 0), b = at(hl, 0);
    pen.tube(a, b, 0.11, st);
    for (const u of [-hl + 0.42, hl - 0.42]) { const p = at(u, 0), q = [p[0], p[1] + 0.32, p[2]]; pen.tube(p, q, 0.035, st2); pen.tube([q[0] - 0.02, q[1], q[2] - 0.16], [q[0] + 0.02, q[1], q[2] + 0.16], 0.035, st2); }
    for (const u of [-hl + 0.12, hl - 0.12]) { const p = at(u, 0.05); pen.tube([p[0] - ca * 0.14, p[1], p[2] - sa * 0.14], [p[0] + ca * 0.14, p[1], p[2] + sa * 0.14], 0.14, then ? { body: hx('#f04660'), dark: hx('#b52552'), light: hx('#ffb0a8'), lit: -1 } : NOW.wood); }
    if (!refl) { const f = pen.pt(a[0], 0, a[2]); S.ring(C, R, f[0], f[1], 10, 1); S.ring(C, R, f[0] + 3, f[1] + 1, 16, 0.7); const g = pen.pt(O[0], 0, O[2]); S.ring(C, R, g[0], g[1], 8, 1); }
  };

  // ------------------------------------------------------------------ the climbing dome
  S.dome = function (C, R, refl) {
    const pen = new Pen(C, R, refl), then = refl, O = [7.6, 0, 27.5], r = 1.3;
    const st = then ? { body: hx('#3f8fe0'), dark: hx('#2a5cb8'), light: hx('#c8ecff'), line: hx('#1a3470'), lit: -1 } : { body: hx('#221a4a'), dark: hx('#120e30'), light: hx('#f2a070'), lit: -1 };
    const pt = (lon, lat) => [O[0] + r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), O[2] + r * Math.cos(lat) * Math.sin(lon)];
    for (let i = 0; i < 8; i++) { const lon = i / 8 * 6.283 + 0.2, list = []; for (let k = 0; k <= 10; k++) list.push(pt(lon, k / 10 * Math.PI / 2)); pen.tube(list[0], list[10], 0.045, st, { pts: pen.poly(list) }); }
    for (const lat of [0.42, 0.95]) { const list = []; for (let k = 0; k <= 28; k++) list.push(pt(k / 28 * 6.283, lat)); pen.tube(list[0], list[14], 0.04, st, { pts: pen.poly(list) }); }
    if (!refl) { const f = pen.pt(O[0], 0, O[2] - r); S.ring(C, R, f[0], f[1], 22, 0.8); }
  };

  // ------------------------------------------------------------------ what was in the air that afternoon
  S.kite = function (C, R) {
    const pen = new Pen(C, R, true), sw = Wd.SWING, ca = Math.cos(sw.yaw), sa = Math.sin(sw.yaw);
    const tie = [sw.X + ca * (sw.len / 2 + 0.06), sw.H - 0.03, sw.Z + sa * (sw.len / 2 + 0.06)], K = [6.1, 5.15, 24];
    const str = []; for (let i = 0; i <= 30; i++) { const t = i / 30; str.push([tie[0] + (K[0] - tie[0]) * t, tie[1] + (K[1] - tie[1]) * t - 1.5 * 4 * t * (1 - t) * (1 - t * 0.55), tie[2] + (K[2] - tie[2]) * t]); }
    pen.path(pen.poly(str), { w: 1.3, c: hx('#fffdf0'), m: M.pastel, p: 0.9, wob: 0.1, day: 1, nodust: true });
    pen.path(off(pen.poly(str), 0.9), { w: 0.8, c: hx('#34449a'), m: M.pencil, p: 0.7, wob: 0.1, day: 1 });
    // the kite: a diamond, cherry and yellow, leaning into the wind
    const u = [0.86, 0.5], v = [-0.5, 0.86], k = (a, b) => { const q = pen.pt(K[0] + (u[0] * a + v[0] * b) * 1.3, K[1] + (u[1] * a + v[1] * b) * 1.3, K[2]); return Wd.bend(q[0], q[1]); };
    const top = k(0, 0.72), bot = k(0, -0.95), lf = k(-0.56, 0.1), rt = k(0.56, 0.1), cen = k(0, 0.1);
    if (Wd.mem(C, cen[0], cen[1]) > 0.5) {
      const ang = Math.atan2(rt[1] - lf[1], rt[0] - lf[0]);
      S.fillPoly(C, R, [top, lf, cen], { c: hx('#f0445e'), gap: 1.5, ang, p: 0.9 }); S.fillPoly(C, R, [top, cen, rt], { c: hx('#ffd43a'), gap: 1.5, ang, p: 0.9 });
      S.fillPoly(C, R, [bot, cen, lf], { c: hx('#ffd43a'), gap: 1.5, ang, p: 0.9 }); S.fillPoly(C, R, [bot, rt, cen], { c: hx('#f0445e'), gap: 1.5, ang, p: 0.9 });
      const ln = (a, b, w) => C.stroke(P.line(R, a[0], a[1], b[0], b[1], 0.3, 0.01, 3), { w: w || 0.9, c: hx('#7c1840'), m: M.pencil, p: 0.75 });
      ln(top, rt); ln(rt, bot); ln(bot, lf); ln(lf, top); ln(top, bot, 0.8); ln(lf, rt, 0.8);
      C.stroke(P.line(R, top[0] + 1, top[1], lf[0] + 1.4, lf[1] - 0.6, 0.2, 0, 3), { w: 1.0, c: hx('#ffc0c0'), m: M.wax, p: 0.6 });
      // the tail, with its bows
      const tail = []; for (let i = 0; i <= 26; i++) { const t = i / 26, q = pen.pt(K[0] + (-0.5 * -0.95) * 1.3 + 0.5 * Math.sin(t * 7.5) * (0.3 + t) + t * 1.6, K[1] + (0.86 * -0.95) * 1.3 - t * 2.3, K[2]), bq = Wd.bend(q[0], q[1]); tail.push(bq); }
      const tp = []; for (const q of tail) tp.push(q[0], q[1]);
      C.stroke(tp, { w: 1.2, c: hx('#fff6e0'), m: M.wax, p: 0.85 }); C.stroke(tp.map((v2, i) => v2 + (i % 2 ? 0.8 : 0.6)), { w: 0.9, c: hx('#5a4a9c'), m: M.pencil, p: 0.75 });
      for (let i = 4; i <= 26; i += 5) { const q = tail[i], col = (i / 5 | 0) % 2 ? hx('#f0445e') : hx('#ffd43a'); S.fillPoly(C, R, [[q[0], q[1]], [q[0] - 5, q[1] - 2.6], [q[0] - 5, q[1] + 2.6]], { c: col, gap: 1.1, w: 1.6, p: 0.9, ang: 1.57 }); S.fillPoly(C, R, [[q[0], q[1]], [q[0] + 5, q[1] - 2.6], [q[0] + 5, q[1] + 2.6]], { c: col, gap: 1.1, w: 1.6, p: 0.9, ang: 1.57 }); }
    }
  };
  S.ball = function (C, R) {
    const pen = new Pen(C, R, true), B = [-3.75, 1.5, 18.4], q = pen.pt(B[0], B[1], B[2]), b = Wd.bend(q[0], q[1]), r = 0.2 * F / B[2];
    if (Wd.mem(C, b[0], b[1]) < 0.5) return;
    for (let i = -3; i <= 3; i++) { const y = b[1] + i * r / 3.4, hw = Math.sqrt(Math.max(0, 1 - Math.pow(i / 3.6, 2))) * r, col = i < -1 ? hx('#f0445e') : i < 1 ? hx('#fffbe8') : hx('#3f8fe0'); C.stroke([b[0] - hw + R.g() * 0.6, y, b[0] + hw + R.g() * 0.6, y], { w: r / 1.5, c: col, m: M.pastel, p: 0.85, nodust: true, ti: 0.2, to: 0.2 }); }
    C.stroke(P.circle(R, b[0], b[1], r * 1.02, 1.1, 0.04), { w: 0.9, c: hx('#2a3a8c'), m: M.pencil, p: 0.6 });
    C.stroke(P.arc(R, b[0], b[1], r * 0.6, 3.4, 4.6, 0.03), { w: 1.3, c: c.white, m: M.wax, p: 0.8 });
  };

  // ------------------------------------------------------------------ the far shore
  S.shore = function (C, R) {
    const prof = x => (x < 700 ? 2 + 13 * Math.pow(ss(700, 60, x), 1.6) * (0.75 + 0.5 * vn(x / 46, 2.2, 91)) + 2.4 * vn(x / 9, 5.5, 92) : 0) + (x > 930 ? 1.5 + 3.5 * ss(930, 1500, x) * (0.6 + 0.8 * vn(x / 60, 7.7, 93)) : 0);
    // land: low, laid in with the side of a Conte stick, darker toward us
    for (const fr of [0.94, 0.8, 0.66, 0.52, 0.38, 0.24, 0.1]) for (const seg of [[-6, 706], [928, 1606]]) {
      const pts = []; for (let x = seg[0]; x <= seg[1]; x += 4) { const h = prof(x); pts.push(x, YH + 0.4 - h * fr + R.g() * 0.15); }
      C.stroke(pts, { w: fr > 0.9 ? 1.6 : 3.4, c: mix(hx('#5d2c7a'), hx('#2f2264'), 1 - fr * 0.7), m: M.pastel, p: 0.9, ti: 0.05, to: 0.05, cj: 0.015, nodust: true });
    }
    for (const seg of [[-6, 706], [928, 1606]]) { const pts = []; for (let x = seg[0]; x <= seg[1]; x += 4) pts.push(x, YH + 1.6 + prof(x) * 0.35); C.stroke(pts, { w: 2.6, c: hx('#30225e'), m: M.conte, p: 0.6, ti: 0.05, to: 0.05 }); }
    // a few trees and roofs breaking the line
    for (let i = 0; i < 60; i++) { const x = R.r(0, 640), h = prof(x); if (h < 3) continue; C.dab(x, YH - h - R.r(0, 1.2), R.r(0.8, 2.0), hx('#3a2468'), M.conte, 0.85); }
    // the line of light where the sea meets the sky under the afterglow
    C.stroke(P.line(R, 690, YH + 0.4, 950, YH + 0.2, 0.2, 0, 4), { w: 1.2, c: hx('#fff0b4'), m: M.wax, p: 0.7, ti: 0.4, to: 0.4 });
    // lights of the town along the shore: somebody is home
    const lights = [];
    for (let i = 0; i < 46; i++) { const x = R.r(8, 640), h = prof(x); lights.push([x, YH - R.r(0.5, Math.max(1.2, h * 0.7)), R()]); }
    for (let i = 0; i < 12; i++) lights.push([R.r(1000, 1596), YH - R.r(0.5, 3), R()]);
    for (const l of lights) {
      const col = l[2] < 0.55 ? hx('#fff0b0') : l[2] < 0.8 ? hx('#ffd0a0') : l[2] < 0.93 ? hx('#fffbe8') : hx('#aef0e6');
      const lr = R.r(0.7, 1.5); C.dab(l[0], l[1], lr, col, M.glow, 1); if (lr > 1.2) C.dab(l[0], l[1], lr * 2.2, col, M.glow, 0.3);
      if (l[2] > 0.4) { const L2 = R.r(3, 11); C.stroke([l[0] + R.g() * 0.3, YH + 1.5 + (YH - l[1]), l[0] + R.g() * 0.6, YH + 1.5 + (YH - l[1]) + L2], { w: 1.0, c: col, m: M.glow, p: R.r(0.3, 0.6), ti: 0.1, to: 0.7 }); }
    }
    // a small light at the end of the land that turns: lit, this instant
    const lx = 664, ly = YH - 9.5;
    C.stroke([lx, YH - 1, lx, ly + 1], { w: 1.5, c: hx('#f2e6f0'), m: M.conte, p: 0.8, ti: 0, to: 0 });
    C.veil(lx - 30, ly - 22, lx + 30, ly + 22, (x, y, col) => { const d = Math.hypot(x - lx, (y - ly) * 1.4); col[0] = 1; col[1] = 0.97; col[2] = 0.8; return 0.5 * Math.exp(-d / 5); }, { g: 0.4, mode: 'lend' });
    C.dab(lx, ly, 1.5, c.white, M.glow, 1);
    C.stroke(P.line(R, lx - 20, ly + 0.5, lx + 20, ly - 0.5, 0.1, 0, 3), { w: 0.8, c: hx('#fff6d2'), m: M.glow, p: 0.6, ti: 0.5, to: 0.5 });
  };
})(typeof self !== 'undefined' ? self : globalThis);
