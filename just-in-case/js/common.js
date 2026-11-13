// common.js -- "Just In Case". The boxes of sticks, the camera, and the few habits of the hand
// that every part of the drawing shares. Design space is 1600 x 900 units.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp;
  const S = (A.S = {});

  // ------------------------------------------------------------------ the boxes of sticks
  // soft pastels: you can only draw with the colours you own
  S.PAS = new A.Sticks([
    '#100e36', '#161447', '#1a1d63', '#1f2f80', '#22419a', '#2a5cae', '#4d7fd0', '#7fa2e0', '#aec4ee', '#d2dff6',
    '#0e4f66', '#16708a', '#2590a0', '#3fb0aa', '#72cdb4', '#a6e0c0', '#d2efcf',
    '#2f2466', '#463690', '#6650b0', '#8a74cc', '#b09ee2', '#d6caf2',
    '#5e2260', '#8a2f7a', '#b84490', '#de5c98', '#f283ae', '#f9abc4', '#fcd3dc',
    '#d64a54', '#f06a6a', '#f98a8c', '#ffaa94', '#ffc6a8', '#ffe0c8',
    '#e88a2a', '#f7a84a', '#ffc070', '#ffd890', '#fbe8a8', '#fff4c8', '#fffbe8',
    '#0c0a22', '#221d40', '#3a3560', '#5a5684', '#8480a8', '#b4b0cc',
    '#7a5aa8', '#9a6aa8', '#c080b0', '#a05090', '#6a7cc8', '#5a60b0', '#54468e', '#3c4a9c',
    '#4a5c90', '#5f7ea6', '#7ea0b8', '#9cc0c4', '#bcdcd4', '#3a3a78', '#4a4488', '#2a2658', '#6a5a98', '#c89aa8', '#8a6a9c',
  ]);
  // pastel pencils / coloured pencils
  S.PEN = new A.Sticks([
    '#0c0a22', '#161447', '#1f2f80', '#2a5cae', '#4d7fd0', '#aec4ee', '#0e4f66', '#3fb0aa', '#a6e0c0',
    '#2f2466', '#6650b0', '#b09ee2', '#5e2260', '#de5c98', '#f9abc4', '#d64a54', '#ffaa94', '#f7a84a', '#fbe8a8', '#fffbe8',
    '#1a4a44', '#2a6a54', '#5a9a68', '#3a3560', '#8480a8',
  ]);
  S.c = {
    white: hx('#fffdf2'), cream: hx('#fff4c8'), lemon: hx('#fbe8a8'), gold: hx('#ffd890'), amber: hx('#ffc070'), orange: hx('#f7a84a'),
    deepor: hx('#e88a2a'), peach: hx('#ffc6a8'), coral: hx('#f98a8c'), red: hx('#d64a54'), pink: hx('#f283ae'), hot: hx('#de5c98'),
    rose: hx('#f9abc4'), magenta: hx('#b84490'), plum: hx('#5e2260'), lav: hx('#b09ee2'), violet: hx('#6650b0'), deepv: hx('#2f2466'),
    indigo: hx('#161447'), night: hx('#100e36'), black: hx('#0c0a22'), navy: hx('#1f2f80'), cobalt: hx('#22419a'), blue: hx('#4d7fd0'),
    sky: hx('#7fa2e0'), ice: hx('#d2dff6'), dteal: hx('#0e4f66'), teal: hx('#2590a0'), aqua: hx('#3fb0aa'), mint: hx('#a6e0c0'),
    grey: hx('#8480a8'), dgrey: hx('#5a5684'), slate: hx('#3a3560'), dslate: hx('#221d40'), leaf: hx('#2a6a54'), dleaf: hx('#1a4a44'), grass: hx('#5a9a68'),
  };

  // ------------------------------------------------------------------ the camera
  // We stand a little above a department-store roof, forty-odd metres over the town, looking out
  // past the parapet. x right, z away, heights measured up from the roof floor.
  const F = 1000, VX = 620, HY = 400, E = 3.0, GLX = 600;
  S.F = F; S.VX = VX; S.HY = HY; S.E = E; S.GLX = GLX;
  S.pr = (x, alt, z) => [VX + F * x / z, HY - F * alt / z];
  S.fl = (x, z, h) => [VX + F * x / z, HY - F * ((h || 0) - E) / z];
  // the parapet: it runs away to the right from under our left hand (seg 1), bends at K and goes
  // almost straight away from us (seg 2), then crosses behind everything at the far end (seg 3).
  const PA = [-3.843, 6.198], PD = [0.857, 0.515], PN = [-0.515, 0.857], TK = 8;
  const K = [PA[0] + PD[0] * TK, PA[1] + PD[1] * TK], D2 = [0.32, 0.9474], N2 = [-0.9474, 0.32], L2 = 20;
  const Q = [K[0] + D2[0] * L2, K[1] + D2[1] * L2];
  S.PA = PA; S.PD = PD; S.PN = PN; S.TK = TK; S.K = K; S.D2 = D2; S.N2 = N2; S.L2 = L2; S.Q = Q; S.PH = 1.15; S.PT = 0.32;
  S.par = (t, h, out) => S.fl(PA[0] + PD[0] * t + PN[0] * (out || 0), PA[1] + PD[1] * t + PN[1] * (out || 0), h);
  S.par2 = (t, h, out) => S.fl(K[0] + D2[0] * t + N2[0] * (out || 0), K[1] + D2[1] * t + N2[1] * (out || 0), h);
  const lineY = (a, b) => x => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  S.footY = lineY(S.par(0, 0), S.par(TK, 0));                 // seg 1, foot and top, as lines on the sheet
  S.topY = lineY(S.par(0, S.PH), S.par(TK, S.PH));
  const top1o = lineY(S.par(0, S.PH, S.PT), S.par(TK, S.PH, S.PT)), kO = S.par2(0, S.PH, S.PT), qO = S.par2(L2, S.PH, S.PT);
  S.KX = S.par(TK, 0)[0]; S.KO = kO; S.QO = qO; S.FARY = HY + F * E / Q[1]; S.FARTOP = HY + F * (E - S.PH) / Q[1];
  // the lowest the town can be seen at each x: the outer top edge of the wall
  S.topYo = x => (x <= kO[0] ? top1o(x) : x < qO[0] ? kO[1] + (qO[1] - kO[1]) * (x - kO[0]) / (qO[0] - kO[0]) : qO[1]);
  // is this point of the sheet roof floor?
  S.onFloor = (x, y) => {
    if (y <= S.FARY) return false;
    const kf = S.par(TK, 0), qf = S.par2(L2, 0);
    if (x < kf[0]) return y > S.footY(x);
    if (x < qf[0] && y < kf[1]) return x > kf[0] + (qf[0] - kf[0]) * (kf[1] - y) / (kf[1] - qf[1]);
    return true;
  };
  // depth of the floor seen at a screen point below the horizon
  S.floorAt = (sx, sy) => { const z = F * E / (sy - HY); return [(sx - VX) * z / F, z]; };

  // ------------------------------------------------------------------ small helpers
  S.grad = function (stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return mix3(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
    return stops[stops.length - 1][1];
  };
  S.gs = v => Math.exp(-v * v);
  S.inPoly = function (poly, x, y) {
    let inside = false;
    for (let i = 0, n = poly.length >> 1, j = n - 1; i < n; j = i++) {
      const xi = poly[i * 2], yi = poly[i * 2 + 1], xj = poly[j * 2], yj = poly[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  S.polySize = function (poly) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < poly.length; i += 2) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); } return [x0, y0, x1, y1, Math.min(x1 - x0, y1 - y0)]; };
  // lay a shape in solidly: two directions of hatching with a blunt stick
  S.solid = function (C, rng, poly, col, o) {
    o = o || {};
    const sz = S.polySize(poly)[4];
    const w = o.w || clamp(sz * 0.35, 1.2, 7), gap = o.gap || w * 0.5, ang = o.ang === undefined ? -0.62 : o.ang, med = o.med || M.conte, p = o.p || 1.05, over = o.over === undefined ? Math.min(0.8, w * 0.2) : o.over;
    A.hatch(C, rng, poly, { ang, gap, med, col, w, p, over, wob: o.wob === undefined ? 0.4 : o.wob, step: 5, skip: o.skip || 0 });
    if (!o.single) A.hatch(C, rng, poly, { ang: ang + (o.cross || 1.15), gap: gap * 1.6, med, col, w, p: p * 0.92, over, wob: 0.4, step: 5, skip: o.skip || 0 });
  };
  // go round a shape edge by edge, the way a pencil does: each side its own stroke, corners overshot
  S.outline = function (C, rng, poly, col, w, p, o) {
    o = o || {};
    const n = poly.length >> 1;
    for (let i = 0; i < n; i++) {
      if (o.open && i === n - 1) break;
      if (o.skipEdge && o.skipEdge(i)) continue;
      const k = (i + 1) % n, ax = poly[i * 2], ay = poly[i * 2 + 1], bx = poly[k * 2], by = poly[k * 2 + 1];
      const L = Math.hypot(bx - ax, by - ay) || 1, ov = (o.ov === undefined ? 1.2 : o.ov) * rng(), ux = (bx - ax) / L, uy = (by - ay) / L;
      A.line(C, rng, [ax - ux * ov, ay - uy * ov, bx + ux * ov * rng(), by + uy * ov * rng()], o.med || M.pencil, col, w, p, { wob: o.wob === undefined ? 0.35 : o.wob, reps: o.reps || 1, off: 0.4, pe: 0.5 });
    }
  };
  S.P4 = (a, b, cc, d) => [a[0], a[1], b[0], b[1], cc[0], cc[1], d[0], d[1]];
  S.seg = (C, rng, a, b, med, col, w, p, o) => A.line(C, rng, [a[0], a[1], b[0], b[1]], med, col, w, p, o || { wob: 0.3, pe: 0.5 });
  // a soft halo: pastel laid in rings and rubbed round and round with a fingertip
  S.glow = function (C, rng, x, y, r, col, n, p) {
    p = p || 0.55;
    for (let ring = 0; ring < 3; ring++) {
      const rr = r * (1 - ring * 0.3), m = Math.round((n || 8) * (1.6 - ring * 0.3));
      for (let k = 0; k < m; k++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr * 0.75; A.dot(C, rng, x + Math.cos(a) * d, y + Math.sin(a) * d, M.pastel, col, r * rng.r(0.3, 0.5), p * (0.75 + ring * 0.3)); }
      const xy = []; for (let a = 0; a < 18.9; a += 0.45) { const q = rr * 0.62 * (0.25 + 0.75 * a / 18.9); xy.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      if (r < 50) { C.rub(xy, rr * 0.5, 0.7, 0.5); C.rub(A.rev(xy), rr * 0.42, 0.5, 0.5); } else C.rub(xy, rr * 0.5, 0.55, 0.5);
    }
  };
  // a small lamp: a breath of colour rubbed round, then the wax point pressed in
  S.bulb = function (C, rng, x, y, r, col, core, on) {
    if (on === false) { A.dot(C, rng, x, y, M.pencil, S.c.dslate, r * 0.55, 0.9); A.dot(C, rng, x - r * 0.12, y - r * 0.12, M.pencil, S.c.grey, r * 0.2, 0.6); return; }
    if (r > 1.6) {
      for (let k = 0; k < 5; k++) { const a = rng() * 6.283, d = rng() * r * 0.8; A.dot(C, rng, x + Math.cos(a) * d, y + Math.sin(a) * d, M.pastel, col, r * rng.r(2.0, 2.8), 0.55); }
      C.rub([x - r * 0.9, y - r * 0.7, x + r * 0.8, y - r * 0.3, x + r * 0.7, y + r * 0.8, x - r * 0.8, y + r * 0.7, x - r * 0.3, y - r * 0.4], r * 2.2, 0.7, 0.5);
      C.rub([x + r * 0.9, y + r * 0.2, x, y + r * 0.9, x - r * 0.9, y, x, y - r * 0.9, x + r * 0.6, y - r * 0.5], r * 1.8, 0.55, 0.5);
      A.dot(C, rng, x, y, M.pastelTip, mix3(col, core, 0.45), r * 1.5, 0.95);
    }
    A.dot(C, rng, x, y, M.oil, core, Math.max(0.9, r * 0.9), 1.0);
  };
  // an oriented box standing on the roof. c = [x, h, z] centre (h above the floor), hs = half sizes
  // [along u, up, along n], yaw turns u in the floor plane. Returns the faces the eye can see.
  S.box3 = function (c, hs, yaw) {
    const cu = Math.cos(yaw || 0), su = Math.sin(yaw || 0);
    const u = [cu, 0, su], n = [-su, 0, cu], up = [0, 1, 0];
    const P = (a, b, d) => [c[0] + u[0] * a * hs[0] + n[0] * d * hs[2], c[1] + b * hs[1], c[2] + u[2] * a * hs[0] + n[2] * d * hs[2]];
    const faces = [
      { id: '+u', nr: u, q: [P(1, -1, -1), P(1, -1, 1), P(1, 1, 1), P(1, 1, -1)] },
      { id: '-u', nr: [-u[0], 0, -u[2]], q: [P(-1, -1, 1), P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1)] },
      { id: '+n', nr: n, q: [P(1, -1, 1), P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1)] },
      { id: '-n', nr: [-n[0], 0, -n[2]], q: [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)] },
      { id: 'top', nr: up, q: [P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)] },
      { id: 'bot', nr: [0, -1, 0], q: [P(-1, -1, 1), P(1, -1, 1), P(1, -1, -1), P(-1, -1, -1)] },
    ];
    const out = [];
    for (const f of faces) {
      const m = [(f.q[0][0] + f.q[2][0]) / 2, (f.q[0][1] + f.q[2][1]) / 2, (f.q[0][2] + f.q[2][2]) / 2];
      const d = f.nr[0] * (0 - m[0]) + f.nr[1] * (E - m[1]) + f.nr[2] * (0 - m[2]);
      if (d <= 0) continue;
      const poly = []; for (const p of f.q) { const s = S.fl(p[0], Math.max(0.3, p[2]), p[1]); poly.push(s[0], s[1]); }
      out.push({ id: f.id, poly, nr: f.nr, mid: m, depth: Math.hypot(m[0], m[2]) });
    }
    out.sort((a, b) => b.depth - a.depth);
    return out;
  };
})(typeof self !== 'undefined' ? self : globalThis);
