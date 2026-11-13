// near.js -- what stands in front of things, what is closest to us, the markers and far bushes,
// and the last hour of fiddling.
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.W, K = Wd.K, T = A.TOOL, v = Wd.v, fbm = A.fbm, vn = A.vn, ss = A.ss, clamp = A.clamp;
  const S = (A.S = A.S || {});

  // ---- withies still marking the channel, and a few bushes a long way off
  S.props = function (C, rng) {
    const rl = Wd.riverLine, n = rl.length / 3;
    // sticks pushed into the mud once, to show boats where the deep water was
    const marks = [[13.4, 1, 1.15], [17.2, -1, 1.0], [21.5, 1, 1.2], [27.5, -1, 1.25], [35, 1, 1.2], [45, -1, 1.4], [58, 1, 1.4], [74, -1, 1.6], [96, 1, 1.8], [128, -1, 2.0]];
    for (const m of marks) {
      let best = 0, bd = 1e9;
      for (let k = 0; k < n; k++) { const dz = Math.abs(rl[k * 3 + 1] - m[0]); if (dz < bd) { bd = dz; best = k; } }
      const k0 = Math.max(0, best - 1), k1 = Math.min(n - 1, best + 1);
      let tx = rl[k1 * 3] - rl[k0 * 3], tz = rl[k1 * 3 + 1] - rl[k0 * 3 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const hw = rl[best * 3 + 2] * 0.98, X = rl[best * 3] + -tz * hw * m[1], Z = rl[best * 3 + 1] + tx * hw * m[1];
      const b = Wd.proj(X, 0, Z), lean = rng.g() * 0.16 + 0.05, top = Wd.proj(X + lean * m[2], m[2], Z), ppm = Wd.ppm(b[1]);
      if (b[0] < 5 || b[0] > 1595 || !Wd.clear(b[0], b[1])) continue;
      const w = Math.max(1.1, ppm * 0.035);
      // shadow first
      const sh = Wd.proj(X - Wd.SUN[0] / Wd.SUN[1] * m[2], 0, Z - Wd.SUN[2] / Wd.SUN[1] * m[2]);
      if (Wd.light(b[0], b[1]) > 0.5) C.line(rng, T.pencil, K.spruce, [b[0], b[1], sh[0], sh[1]], Math.max(1.1, w), 0.6, { wob: 0.4, pe: 0.3 });
      C.line(rng, T.pencil, K.walnut, [b[0], b[1], (b[0] + top[0]) / 2 + rng.g() * w * 0.4, (b[1] + top[1]) / 2, top[0], top[1]], Math.max(1.2, w * 1.3), 0.9, { wob: 0.3, pe: 0.7 });
      if (w > 1.5) C.line(rng, T.chalk, K.bone, [b[0] - w * 0.4, b[1], top[0] - w * 0.4, top[1]], Math.max(1, w * 0.5), 0.6, { wob: 0.3 });
      // a twiggy fork at the top, and on some a tin or a rag gone pale
      if (ppm > 6) {
        C.line(rng, T.pencil, K.walnut, [top[0], top[1], top[0] - ppm * 0.14, top[1] - ppm * 0.2], Math.max(1, w * 0.7), 0.8, { wob: 0.2 });
        C.line(rng, T.pencil, K.walnut, [top[0], top[1] + ppm * 0.1, top[0] + ppm * 0.16, top[1] - ppm * 0.12], Math.max(1, w * 0.7), 0.8, { wob: 0.2 });
      }
      if (rng.chance(0.6)) C.dab(T.crayonTip, rng.chance(0.5) ? K.salmon : K.bone, top[0] + rng.g() * 0.4, top[1] + ppm * 0.12, Math.max(1.5, ppm * 0.09), 0.9);
    }
    // bushes: the kind you draw as a cloud on a stick
    const bushes = [[40, 112, 3.0], [-58, 86, 2.6], [29, 60, 2.0], [-24.5, 46, 1.9], [34, 37, 2.1]];
    bushes.sort((a, b) => b[1] - a[1]);
    for (const q of bushes) {
      const b = Wd.proj(q[0], 0, q[1]), ppm = Wd.ppm(b[1]), h = q[2] * ppm, r = h * rng.r(0.36, 0.5);
      if (b[0] < -20 || b[0] > 1620 || Wd.riv(b[0], b[1]) > -0.1) continue;
      const lit = Wd.light(b[0], b[1]) > 0.5, cx = b[0] + rng.g() * r * 0.1, cy = b[1] - h + r;
      // shadow on the grass, long, to the right
      if (lit) { const sx = b[0] + h * 1.5, sy = b[1] - h * 0.07; const pl = A.poly([b[0] - r * 0.3, b[1] + 0.5, sx, sy - r * 0.22, sx + r * 0.8, sy, sx, sy + r * 0.2]); const R = A.region(pl.bbox, (x, y) => pl.inside(x, y) && Wd.riv(x, y) < 0); A.scribble(C, rng, R, { tool: T.crayonTip, col: K.moss, w: Math.max(1.6, r * 0.4), gap: Math.max(1, r * 0.2), ang: 0, p: 0.7, over: 1, under: 0, run: 4, wob: 0.3 }); A.hatch(C, rng, R, { tool: T.pencil, col: K.spruce, w: 1.2, gap: 1.8 + r * 0.1, ang: 0.7, p: 0.7, seg: 8 }); }
      C.line(rng, T.pencil, K.walnut, [b[0], b[1], b[0] + rng.g() * 0.4, b[1] - h * 0.55], Math.max(1.2, r * 0.16), 0.9, { wob: 0.3, pe: 0.8 });
      // two or three lumps, looped, lighter on the sun's side
      const lump = (ox, oy, rad, col, pr) => { const o = []; const t0 = rng() * 6; for (let a = 0; a <= 2.6 * 6.283; a += 0.55) { const rr = rad * (0.3 + 0.7 * a / 16.3); o.push(cx + ox + Math.cos(a + t0) * rr * 1.15, cy + oy + Math.sin(a + t0) * rr * 0.85); } C.line(rng, T.crayonTip, col, o, Math.max(1.5, rad * 0.5), pr, { wob: 0.5, step: 2.5, pe: 0.9 }); };
      lump(r * 0.25, r * 0.1, r * 0.85, lit ? K.moss : K.spruce, 0.85);
      lump(-r * 0.3, -r * 0.05, r * 0.75, lit ? K.sap : K.moss, 0.85);
      lump(r * 0.05, -r * 0.4, r * 0.6, lit ? K.sap : K.moss, 0.8);
      if (lit) lump(-r * 0.4, -r * 0.35, r * 0.4, K.pist, 0.7);
      A.hatch(C, rng, A.region([cx - r * 0.2, cy - r * 0.3, cx + r * 1.2, cy + r], (x, y) => Math.hypot((x - cx - r * 0.3) / 0.9, y - cy - r * 0.2) < r * 0.72), { tool: T.pencil, col: K.spruce, w: 1.1, gap: 1.6 + r * 0.08, ang: 0.8, p: 0.6, seg: 7 });
    }
  };

  // ---- flowers and grass that stand in front of the boat and the jetty; the rope
  S.front = function (C, rng) {
    const B = Wd.boat, Pr = Wd.pier;
    // grass grown up against her side
    for (let k = 0; k < B.sil.length - 1; k++) {
      const a = B.sil[k], b = B.sil[k + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.2);
      for (let q = 0; q < n; q++) {
        if (rng.chance(0.35)) continue;
        const f = rng(), x = a[0] + (b[0] - a[0]) * f + rng.g() * 1.2, y = a[1] + (b[1] - a[1]) * f + rng.r(0.5, 5);
        const dens = fbm(x / 40, y / 20, 2, 913);
        const len = rng.r(5, 12) + 16 * Math.max(0, dens - 0.45) * rng();
        Wd.flick(C, rng, rng.chance(0.5) ? T.crayonTip : T.pencil, rng.pick([K.sap, K.moss, K.pist, K.sap, K.spruce, K.lemon]), x, y, len, rng.g() * 0.35, rng.r(1.3, 2.4), 0.88);
      }
    }
    // along the foot of the jetty's dark side, and round the feet of the posts
    for (let s = -1.2; s < Pr.LEN + 0.2; s += 0.035) {
      if (rng.chance(0.3)) continue;
      const p = Pr.at(s, 0.64 + rng.r(0.0, 0.12), 0), ppm = Wd.ppm(p[1]);
      if (p[1] > 915) continue;
      const L = Wd.light(p[0], p[1]);
      Wd.flick(C, rng, rng.chance(0.5) ? T.crayonTip : T.pencil, L > 0.5 ? rng.pick([K.sap, K.moss, K.pist, K.lemon, K.straw, K.spruce]) : rng.pick([K.moss, K.spruce, K.sap]), p[0], p[1], ppm * rng.r(0.1, 0.42), rng.g() * 0.35 + 0.1, 1.2 + ppm * 0.012, 0.88);
    }
    Wd.drawFlowers(C, rng.fork(), f => f.where === 'front');
    // ---- the rope: from the stern to the end post, slack, lying in the flowers for most of its length
    const post = Pr.posts[0];
    if (B.sternCleat && post.ring) {
      const a = B.sternCleat, b = post.ring, low = Math.max(a[1], b[1]) + 34;
      const pts = A.curve([a[0], a[1] - 1, a[0] + 5, a[1] + 16, a[0] + (b[0] - a[0]) * 0.42, low - 3, a[0] + (b[0] - a[0]) * 0.7, low - 6, b[0] - 5, b[1] + 16, b[0], b[1]], 9);
      C.line(rng, T.pencil, K.spruce, pts.map((z, j) => (j & 1 ? z + 2.4 : z + 2)), 1.6, 0.5, { wob: 0.5 });
      C.line(rng, T.crayonTip, K.straw, pts, 2.6, 0.95, { wob: 0.35, step: 3, pe: 0.9 });
      C.line(rng, T.chalk, K.cream, pts.map((z, j) => (j & 1 ? z - 0.7 : z)), 1.1, 0.7, { wob: 0.4, pj: 0.6 });
      for (let i = 2; i < pts.length - 2; i += 2) { // the lay of the rope: little slanting ticks
        if (rng.chance(0.25)) continue;
        const dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        C.line(rng, T.pencil, K.umber, [pts[i] + nx * 1.3 - dx / l * 0.6, pts[i + 1] + ny * 1.3 - dy / l * 0.6, pts[i] - nx * 1.3 + dx / l * 0.6, pts[i + 1] - ny * 1.3 + dy / l * 0.6], 1.0, 0.7, { wob: 0.1, step: 2 });
      }
      // turns round the post, and a knot that has held
      for (let k = 0; k < 3; k++) { const y = b[1] - 1 + k * 2.6; C.line(rng, T.crayonTip, K.straw, [post.base[0] - post.r - 0.6, y + 0.8, post.base[0], y + 1.6, post.base[0] + post.r + 0.6, y + 0.3], 2.3, 0.95, { wob: 0.2, pe: 0.9, step: 2 }); C.line(rng, T.pencil, K.umber, [post.base[0] - post.r - 0.6, y + 2.2, post.base[0], y + 3, post.base[0] + post.r + 0.6, y + 1.7], 1.0, 0.7, { wob: 0.2, step: 2 }); }
      C.dab(T.crayonTip, K.ochre, b[0] - 1, b[1] + 3, 3.2, 0.9);
      // a few flowers have grown over it
      for (let k = 0; k < 9; k++) { const i = 2 * rng.i(6, (pts.length >> 1) - 7), x = pts[i] + rng.g() * 4, y = pts[i + 1] + rng.r(-2, 5); Wd.flower(C, rng, x, y, rng.r(8, 12), 0.9, true); }
      for (let k = 0; k < 26; k++) { const i = 2 * rng.i(4, (pts.length >> 1) - 5); Wd.flick(C, rng, T.pencil, rng.pick([K.sap, K.moss, K.pist]), pts[i] + rng.g() * 3, pts[i + 1] + rng.r(1, 6), rng.r(5, 12), rng.g() * 0.4, 1.4, 0.85); }
    }
  };

  // one tall grass with its head
  function stem(C, rng, x, y, h, lean, L, kind) {
    const dark = L < 0.45;
    const tipx = x + Math.sin(lean) * h * 1.15, tipy = y - Math.cos(lean) * h, mx = x + Math.sin(lean * 0.45) * h * 0.55, my = y - h * 0.55;
    const path = A.curve([x, y, mx, my, tipx, tipy], 8);
    const col = dark ? rng.pick([K.moss, K.spruce, K.sap, K.pine]) : rng.pick([K.sap, K.pist, K.moss, K.lemon, K.olive, K.straw]);
    C.line(rng, T.crayonTip, col, path, kind === 2 ? 3.4 : 2.2, 0.9, { wob: 0.6, wl: 60, a0: 0.0, a1: 0.5, pe: 0.35, step: 4 });
    C.line(rng, T.pencil, dark ? K.pine : K.moss, path.map((z, j) => (j & 1 ? z : z + 1.2)), 1.1, 0.6, { wob: 0.6, wl: 60, a1: 0.4, step: 4 });
    if (kind === 0) { // an oat: spikelets hanging off one side
      const n = rng.i(5, 9);
      for (let k = 0; k < n; k++) {
        const t = 0.62 + 0.38 * k / n, i = 2 * Math.floor(t * ((path.length >> 1) - 1)), px = path[i], py = path[i + 1];
        const sd = (k % 2 ? 1 : -1) * rng.r(0.4, 1), L2 = h * rng.r(0.05, 0.09);
        const ex = px + sd * L2 * 0.9 + Math.sin(lean) * L2, ey = py + L2 * rng.r(0.3, 0.9);
        C.line(rng, T.pencil, dark ? K.sage : K.olive, [px, py, ex, ey], 1.0, 0.8, { wob: 0.2, step: 2 });
        C.stroke([ex, ey, 0.9, 0.6, ex + sd * 1.2, ey + L2 * 0.5, 1, 1, ex + sd * 1.4, ey + L2 * 1.1, 0.6, 0.4], T.crayonTip, dark ? rng.pick([K.sage, K.far, K.haze]) : rng.pick([K.straw, K.butter, K.cream, K.ochre]), 3.2, 0.92);
      }
    } else if (kind === 1) { // a foxtail: a soft spike
      const i0 = Math.floor(0.72 * ((path.length >> 1) - 1));
      const head = path.slice(i0 * 2);
      C.line(rng, T.crayonTip, dark ? K.sage : rng.pick([K.straw, K.butter, K.lemon]), head, 5.2, 0.92, { wob: 0.3, pe: 0.6, a0: 0.15, a1: 0.3, step: 3 });
      for (let q = 0; q < head.length; q += 2) for (const sd of [-1, 1]) if (rng.chance(0.8)) C.line(rng, T.pencil, dark ? K.slate : K.ochre, [head[q], head[q + 1], head[q] + sd * rng.r(2.5, 4.5), head[q + 1] - rng.r(1.5, 4)], 1.0, 0.75, { wob: 0.1, step: 2 });
    } else { // a broad blade, folded, with its middle line
      C.line(rng, T.chalk, dark ? K.sage : K.cream, path.map((z, j) => (j & 1 ? z : z - 0.8)).slice(4, -6), 1.0, 0.5, { wob: 0.4, pj: 0.6 });
    }
  }

  // a flower close enough to count the petals of
  function bigFlower(C, rng, x, y, s, L) {
    const dark = L < 0.45, sq = rng.r(0.62, 0.9), tilt = rng.g() * 0.5, n = rng.i(11, 16), a0 = rng() * 6.283;
    const sx = x + rng.g() * s * 0.3, sy = y + s * rng.r(1.6, 3.2);
    const st = A.curve([x, y + s * 0.1, (x + sx) / 2 + rng.g() * s * 0.2, (y + sy) / 2, sx, sy], 8);
    C.line(rng, T.crayonTip, dark ? K.spruce : K.moss, st, 2.6, 0.92, { wob: 0.5, step: 3, pe: 0.9 });
    C.line(rng, T.pencil, dark ? K.pine : K.spruce, st.map((z, j) => (j & 1 ? z : z + 1.6)), 1.1, 0.65, { wob: 0.5, step: 3 });
    A.hatch(C, rng, A.region([x - s * 0.75, y - s * 0.6, x + s * 0.85, y + s * 0.75], (px, py) => { const dx = (px - x - s * 0.12) / (s * 0.72), dy = (py - y - s * 0.1) / (s * 0.72 * sq); return dx * dx + dy * dy < 1 + (vn(px / 5, py / 5, 77) - 0.5) * 0.5; }), { tool: T.pencil, colAt: (px, py, r) => (r.chance(0.6) ? K.spruce : K.pine), w: 1.5, gap: 2.2, ang: 0.8, p: 0.8, seg: 14 });
    A.scribble(C, rng, A.region([x - s * 0.7, y - s * 0.55, x + s * 0.8, y + s * 0.7], (px, py) => { const dx = (px - x - s * 0.1) / (s * 0.6), dy = (py - y - s * 0.08) / (s * 0.6 * sq); return dx * dx + dy * dy < 1; }), { tool: T.crayonTip, col: dark ? K.spruce : K.moss, w: 3.4, gap: 3.4, ang: 0.3, p: 0.7, over: 2, under: 0, run: 4, wob: 0.6 });
    const pc = dark ? [K.shadew, K.shadew, K.far, K.white] : [K.white, K.white, K.cream];
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 6.283 / n + rng.g() * 0.1, len = s * (0.5 + 0.07 * rng.g()), wd = s * 0.2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const P = (r, o) => { const px = ca * r - sa * o, py = sa * r + ca * o; const rx = px * Math.cos(tilt) - py * Math.sin(tilt), ry = (px * Math.sin(tilt) + py * Math.cos(tilt)) * sq; return [x + rx, y + ry]; };
      const col = rng.pick(pc);
      const p0 = P(s * 0.13, 0), p1 = P(len * 0.6, 0), p2 = P(len, 0);
      C.stroke([p0[0], p0[1], 0.9, 0.55, p1[0], p1[1], 1, 1, p2[0], p2[1], 0.9, 0.7], dark ? T.crayonTip : T.chalk, col, wd, 0.95);
      if (!dark) C.stroke([p0[0], p0[1], 0.9, 0.5, p1[0], p1[1], 1, 0.8, p2[0], p2[1], 0.7, 0.6], T.crayonTip, K.white, wd * 0.8, 0.9);
      // the petal's outline, and the crease down it
      const o = []; for (let t = 0; t <= 1.001; t += 0.125) { const q = P(s * 0.13 + (len - s * 0.13) * Math.sin(t * 3.14159), (t < 0.5 ? 1 : -1) * wd * 0.52 * Math.sin(t * 6.283) ** 2 * 0 + (0.5 - Math.abs(t - 0.5)) * 0); o.push(q[0], q[1]); }
      const e1 = P(len * 0.55, wd * 0.5), e2 = P(len * 0.55, -wd * 0.5);
      C.line(rng, T.pencil, dark ? K.slate : rng.chance(0.5) ? K.far : K.slate, [p0[0], p0[1], e1[0], e1[1], p2[0], p2[1], e2[0], e2[1], p0[0], p0[1]], 1.0, dark ? 0.6 : 0.45, { wob: 0.3, step: 2.5, pe: 0.7 });
      if (rng.chance(0.5)) C.line(rng, T.pencil, dark ? K.bluepencil : K.far, [P(s * 0.2, 0)[0], P(s * 0.2, 0)[1], P(len * 0.8, 0)[0], P(len * 0.8, 0)[1]], 1.0, 0.4, { wob: 0.2 });
    }
    // the middle: yellow, stippled, darker on the side away from the sun
    const cr = s * 0.17;
    for (let k = 0; k < 10; k++) C.dab(T.crayonTip, dark ? K.ochre : K.mustard, x + rng.g() * cr * 0.3, y + rng.g() * cr * 0.3 * sq, cr * 1.1, 0.95);
    for (let k = 0; k < 14; k++) { const a = rng() * 6.283, r = cr * 0.7 * Math.sqrt(rng()); C.dab(T.pencil, a > 5 || a < 1.2 ? K.rust : K.ochre, x + Math.cos(a) * r, y + Math.sin(a) * r * sq, 1.2, 0.85); }
    if (!dark) C.dab(T.chalk, K.butter, x - cr * 0.3, y - cr * 0.3 * sq, cr * 0.5, 0.8);
  }

  // ---- the cloud's shadow, pulled together with one pencil laid over everything in it, flowers and all
  S.shade = function (C, rng) {
    const R = A.region([-4, 560, 1100, 905], (x, y) => Wd.light(x, y) < 0.36 && Wd.clear(x, y));
    A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.6) ? K.slate : K.bluepencil), w: 1.7, gap: 3.0, ang: -0.24, p: 0.6, seg: 70, skip: 0.06, jit: 0.04 });
    A.hatch(C, rng, A.region(R.bbox, (x, y) => Wd.light(x, y) < 0.16), { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.5) ? K.slate : K.spruce), w: 1.7, gap: 4.2, ang: 0.3, p: 0.52, seg: 50, skip: 0.12, jit: 0.05 });
    // the same for the band of shade lying across the channel further off
    const R2 = A.region([-4, 330, 1604, 470], (x, y) => Wd.light(x, y) < 0.3 && Wd.riv(x, y) > 0);
    A.hatch(C, rng, R2, { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.6) ? K.slate : K.bluepencil), w: 1.3, gap: 2.2, ang: -0.2, p: 0.55, seg: 40, skip: 0.1 });
  };

  // ---- the bank we are standing on: only its tallest things reach up into the picture
  S.near = function (C, rng) {
    const list = [];
    for (let x = -10; x < 1612; x += rng.r(3, 9)) {
      // most on the left, a clump under the jetty on the right, thin in the middle so you can see
      const want = 0.16 + 0.84 * ss(430, 40, x) + 0.5 * ss(1050, 1250, x) * ss(1420, 1300, x) + 0.3 * (fbm(x / 70, 3, 2, 951) - 0.4);
      if (!rng.chance(clamp(want, 0, 1))) continue;
      const h = (60 + 150 * rng() * rng()) * (0.5 + 0.9 * ss(520, 0, x)) * (x > 1000 ? 0.75 : 1);
      list.push({ x, y: 900 + rng.r(4, 26), h, kind: rng.chance(0.38) ? 0 : rng.chance(0.4) ? 1 : 2, z: rng() });
    }
    for (let x = 50; x < 1180; x += rng.r(46, 130)) {
      if (x > 560 && x < 700) continue;
      const s = rng.r(32, 52) * (0.85 + 0.35 * ss(520, 0, x));
      list.push({ x: x + rng.g() * 12, y: 900 - rng.r(8, 70) - 40 * ss(420, 0, x) * rng(), s, flower: true, z: 0.5 + 0.5 * rng() });
    }
    for (let k = 0; k < 16; k++) { const x = rng.r(430, 1130); list.push({ x, y: 900 + rng.r(4, 20), h: rng.r(50, 120), kind: rng.chance(0.6) ? 0 : 1, z: rng() * 0.5 }); }
    list.sort((a, b) => a.z - b.z);
    for (const q of list) {
      const L = Wd.light(q.x, 880) + rng.g() * 0.05;
      if (q.flower) bigFlower(C, rng, q.x, q.y, q.s, L);
      else stem(C, rng, q.x, q.y, q.h, Wd.lean(q.x, 890) * 0.45 + rng.g() * 0.12, L, q.kind);
    }
  };

  // ---- last touches: the pencil comes back out
  S.last = function (C, rng) {
    // grass the way you always drew it: a row of sharp points, without lifting
    for (let k = 0; k < 230; k++) {
      const x = rng.r(0, 1600), y = rng.r(250, 880);
      if (Wd.riv(x, y) > -0.25 || !Wd.clear(x, y) || !Wd.clear(x, y - 12) || !Wd.clear(x + 20, y)) continue;
      if (fbm(x / 210 + 9, y / 120, 2, 981) < 0.5) continue;
      const d = Wd.d(y), L = Wd.light(x, y), sz = 2.5 + 15 * d, n = rng.i(3, 8), pts = [];
      let ok = true;
      for (let q = 0; q <= n * 2; q++) { const px = x + q * sz * 0.42 + rng.g() * sz * 0.06, py = y - (q % 2 ? sz * (0.7 + 0.5 * rng()) : 0) + rng.g() * sz * 0.05; if (!Wd.clear(px, py) || Wd.riv(px, py) > -0.15) ok = false; pts.push(px, py); }
      if (!ok) continue;
      C.line(rng, rng.chance(0.5) ? T.pencil : T.crayonTip, L > 0.5 ? rng.pick([K.moss, K.sap, K.olive, K.spruce]) : rng.pick([K.spruce, K.pine]), pts, 1.1 + 1.3 * d, 0.85, { wob: 0.15, step: 3, pe: 0.8, trem: 0.05 });
    }
    // the horizon, once more, where it got lost
    const hz = [];
    for (let x = -10; x <= 1610; x += 30) hz.push(x, Wd.HZ + 0.6 + rng.g() * 0.25);
    C.line(rng, T.pencil, K.slate, hz, 1.2, 0.5, { wob: 0.5, wl: 120, pj: 0.6 });
    // a thumb dragged along the far haze
    for (let k = 0; k < 6; k++) { const y = 196 + rng.r(-4, 6), x0 = rng.r(0, 1200); C.smudge([x0, y, x0 + 200, y + rng.g(), x0 + 400, y + rng.g()], 5, 0.35, 0.7); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
