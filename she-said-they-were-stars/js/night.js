// night.js -- everything beyond the hem: the rain, and the lights of a street nobody is looking at,
// all of them out of focus because the eye is on the cloth half a metre away.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, fbm = A.fbm, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c, N = Wd.N;
  const o3 = [0, 0, 0], t3 = [0, 0, 0];
  const lum = v => 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];
  // rain falls away from this point of the sheet (straight up is far above the top edge; the wind leans it)
  Wd.RAINVP = [590, -820];

  // ------------------------------------------------------------------ the plan, in graphite
  S.plan = function (C, R) {
    const g = { c: c.graphite, m: M.pencil, w: 1.0, p: 0.3, cj: 0.01 };
    const hub = Wd.ap(0);
    const path = (f, n) => { const pts = []; for (let i = 0; i <= n; i++) { const p = f(i / n); if (p[2] > 0.05 && p[0] > -300 && p[0] < 1900 && p[1] > -300 && p[1] < 1200) pts.push(p[0], p[1]); } return pts; };
    // the ribs, drawn through and past their ends the way a ruler-less hand finds them
    for (let r = 0; r < N; r++) {
      const pts = path(t => Wd.rp(r, -0.03 + t * 1.12), 40); if (pts.length < 6) continue;
      C.stroke(P.wob(R, pts, 1.2, 60), Object.assign({}, g, { p: 0.26 }));
      if (R.chance(0.6)) C.stroke(P.wob(R, pts, 1.6, 50), Object.assign({}, g, { p: 0.14, w: 0.8 }));
    }
    // rings round the crown, to keep the bowl honest
    for (const s of [0.2, 0.47, 0.75, 1.0]) for (let r = 0; r < N; r++) { const pts = path(t => Wd.cp(r + t * 0.9999, s), 14); if (pts.length >= 6) C.stroke(P.wob(R, pts, 0.8, 40), Object.assign({}, g, { p: s === 1 ? 0.12 : 0.16, w: 0.8 })); }
    // the hem
    for (let r = 0; r < N; r++) { const pts = path(t => Wd.cp(r + t * 0.9999, Wd.smax(r + t)), 30); if (pts.length >= 6) C.stroke(P.wob(R, pts, 1.0, 40), Object.assign({}, g, { p: 0.3 })); }
    // the shaft
    const s0 = Wd.ap(0), s1 = Wd.ap(0.52);
    C.stroke(P.line(R, s0[0], s0[1], s1[0], s1[1], 0.8, 0.004, 6), Object.assign({}, g, { p: 0.3 }));
    // where the rain comes from
    for (let i = 0; i < 9; i++) { const x = R.r(60, 1560), y = R.r(650, 890), dx = x - Wd.RAINVP[0], dy = y - Wd.RAINVP[1], l = Math.hypot(dx, dy); C.stroke(P.line(R, x - dx / l * 260, y - dy / l * 260, x, y, 0.5, 0.003, 8), Object.assign({}, g, { p: 0.1, w: 0.7 })); }
    // the lights, each found with a turn of the wrist
    for (let i = 0; i < Wd.nMajor; i++) { const l = Wd.LIGHTS[i]; C.stroke(P.circle(R, l.x, l.y, l.r, 1.12, 0.03), Object.assign({}, g, { p: 0.16, w: 0.8 })); }
  };

  // ------------------------------------------------------------------ the wet night, in two glazes
  S.nightWash = function (C, R, pass) {
    const sd = 300 + pass * 31, vp = Wd.RAINVP;
    C.wash(0, 0, 1600, 900, (x, y, pig) => {
      if (Wd.at(x, y, o3) && o3[2] > 0.012) return 0;
      Wd.night(x, y, pig);
      // the brush went the way the rain goes
      const dx = x - vp[0], dy = y - vp[1], ang = Math.atan2(dy, dx), rad = Math.hypot(dx, dy);
      const br = vn(ang * 260 + sd, rad / 190, sd) - 0.5, bl = fbm(x / 130, y / 130, sd + 3, 3) - 0.5;
      if (pass === 0) { // first: thinner, and pulled towards blue-green and rose so the second glaze has something to sit on
        const q = vn(x / 300 + 5, y / 300, sd + 8);
        pig[0] = pig[0] * (0.9 + 0.3 * q) + 0.03; pig[1] = pig[1] * 1.08 + 0.03; pig[2] = pig[2] * 1.05 + 0.05;
        return 0.5 * (1 + 0.45 * bl + 0.22 * br);
      }
      return 0.66 * (1 + 0.3 * br + 0.3 * bl);
    }, { gran: 0.42 });
    if (pass === 1) { // water run back into the drying wash
      const spots = [[1480, 250, 44], [1560, 560, 36], [1250, 830, 30], [860, 880, 22], [180, 850, 34], [1400, 700, 26]];
      C.stencil(Wd.stencil(C), 0);
      for (const s of spots) C.bloom(s[0] + R.r(-10, 10), s[1] + R.r(-8, 8), s[2] * R.r(0.8, 1.2), { lift: 0.12, dark: 0.12 });
      C.stencil();
    }
  };

  // ------------------------------------------------------------------ pastel laid into the rainy air
  S.nightHatch = function (C, R) {
    const vp = Wd.RAINVP; C.stencil(Wd.stencil(C), 0);
    for (let i = 0; i < 5200; i++) {
      const x = R.r(-10, 1610), y = R.r(180, 910); if (Wd.at(x, y, o3) && o3[2] > 0.03) continue;
      Wd.night(x, y, t3);
      const j = R.g() * 0.035, q = R(); let col = [clamp(t3[0] + j, 0.01, 1), clamp(t3[1] + j * 0.6, 0.01, 1), clamp(t3[2] + j, 0.01, 1)];
      if (q < 0.22) col = mix(col, c.ultra, 0.25); else if (q < 0.4) col = mix(col, c.magenta, 0.2); else if (q < 0.5) col = mix(col, c.teal, 0.22);
      const dx = x - vp[0], dy = y - vp[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, L = R.r(22, 70);
      C.stroke(P.line(R, x - ux * L, y - uy * L, x + ux * L, y + uy * L, 1.2, 0.02, 6), { w: R.r(5, 13), c: col, m: M.pastel, p: R.r(0.34, 0.62), ti: 0.25, to: 0.35, cj: 0.03, nodust: true });
    }
    C.stencil();
  };

  // ------------------------------------------------------------------ the lights: discs of rubbed pastel
  function disc(C, R, l, cut) {
    const rr = l.r, sd = (R() * 9999) | 0, big = rr > 24, a0 = l.a * (big ? 0.9 : 0.84);
    const hot = mix(l.c, c.white, 0.62), body = mix(l.c, c.white, 0.14);
    C.veil(l.x - rr * 1.1, l.y - rr * 1.1, l.x + rr * 1.1, l.y + rr * 1.1, (x, y, col) => {
      if (cut && Wd.at(x, y, o3)) return 0;
      const dx = x - l.x, dy = y - l.y, d0 = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const d = d0 / (rr * (1 + 0.035 * (vn(ang * 1.4 + 3, sd * 0.01, sd) - 0.5) * 2 + 0.012 * (vn(ang * 6, 1.1, sd + 1) - 0.5) * 2));
      if (d >= 1.05) return 0;
      const edge = 1 - ss(0.94, 1.04, d), ring = ss(0.66, 0.96, d), inner = 0.74 + 0.36 * (fbm(x / (rr * 0.5) + sd, y / (rr * 0.5), sd, 2) - 0.5) * 2 * 0.5;
      // the rubbing went round: fine rings of thick and thin
      const turn = 1 + 0.10 * Math.sin(d * rr * 0.9 + 2 * vn(ang * 2, d * 3, sd + 2));
      const q = clamp(ring * 0.45 + 0.22 * (dx - dy) / rr, 0, 1); col[0] = body[0] + (hot[0] - body[0]) * q; col[1] = body[1] + (hot[1] - body[1]) * q; col[2] = body[2] + (hot[2] - body[2]) * q;
      return Math.min(0.96, a0 * edge * inner * turn * (0.86 + 0.36 * ring) * (1 + 0.14 * (dx - dy) / rr));
    }, { mode: 'lend', g: 0.26, fill: 0.2 });
    C.stencil(Wd.stencil(C), 0); C.glow(l.x, l.y, rr * 1.9, l.c, 0.26 * l.a, { pow: 2, g: 0.5 }); C.stencil();
    if (!big) return;
    // the stick itself, still showing: arcs round the rim and a few across
    C.stencil(Wd.stencil(C), 0);
    const n = Math.round(rr * 0.22);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.283, sp = R.r(0.5, 1.5), r1 = rr * R.r(0.55, 0.95);
      C.stroke(P.arc(R, l.x, l.y, r1, a, a + sp, 0.03), { w: R.r(3, 7), c: mix(l.c, c.white, R.r(0.1, 0.5)), m: M.pastel, p: R.r(0.22, 0.4), k: 0.5, ti: 0.3, to: 0.4, nodust: true });
    }
    C.stroke(P.circle(R, l.x, l.y, rr * 0.965, 1.06, 0.022), { w: 1.6, c: mix(l.c, c.white, 0.6), m: M.wax, p: 0.36, k: 0.7, ti: 0.3, to: 0.3 });
    C.stencil();
  }
  S.disc = disc;
  S.discs = function (C, R) {
    const Ls = Wd.LIGHTS.slice().sort((a, b) => a.r - b.r);
    // haze round the big ones first: wet air holds light
    for (const l of Ls) {
      if (l.r < 16) continue;
      if (Wd.at(l.x, l.y, o3) && o3[2] > 0.3) continue;
      C.veil(l.x - l.r * 3.4, l.y - l.r * 3.4, l.x + l.r * 3.4, l.y + l.r * 3.4, (x, y, col) => {
        if (Wd.at(x, y, o3)) return 0;
        const d = Math.hypot(x - l.x, y - l.y) / (l.r * 3.3); if (d >= 1) return 0;
        col[0] = l.c[0]; col[1] = l.c[1]; col[2] = l.c[2]; const f = 1 - d; return 0.13 * l.a * f * f * (0.6 + 0.8 * vn(x / 40, y / 40, 17));
      }, { mode: 'lend', g: 0.55, fill: 0.05 });
    }
    for (const l of Ls) {
      const inC = Wd.at(l.x, l.y, o3) ? o3[2] : -1;
      // lights wholly behind sound cloth are not drawn as discs: they will glow through it instead
      if (inC > 0) { const p0 = Wd.cp(o3[0], o3[1]), p1 = Wd.cp(o3[0], Math.min(o3[1] + inC, 1.1)); if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > l.r * 1.05) { let near = false; for (let a = 0; a < 6.28; a += 0.4) if (!Wd.at(l.x + Math.cos(a) * l.r, l.y + Math.sin(a) * l.r, t3)) near = true; if (!near) continue; } }
      disc(C, R, l, true);
    }
  };

  // ------------------------------------------------------------------ rain
  S.rain = function (C, R, layer) {
    const vp = Wd.RAINVP; C.stencil(Wd.stencil(C), 0);
    const n = layer === 0 ? 1500 : layer === 1 ? 1100 : 170;
    for (let i = 0; i < n; i++) {
      const x = R.r(-20, 1620), y = R.r(150, 930); if (Wd.at(x, y, o3) && o3[2] > 0.02) continue;
      Wd.behind(x, y, t3); const lm = lum(t3);
      const dx = x - vp[0], dy = y - vp[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      let L, w, p, col;
      if (layer === 0) { L = R.r(10, 34); w = R.r(0.7, 1.2); p = 0.08 + 0.5 * lm * R.r(0.5, 1); col = mix(t3, c.ice, 0.22); }            // the far rain: a grey silk
      else if (layer === 1) { L = R.r(30, 90); w = R.r(1.0, 1.9); p = 0.22 + 0.7 * lm * R.r(0.5, 1); col = mix(t3, c.white, 0.6); }
      else { L = R.r(90, 220); w = R.r(1.8, 3.2); p = 0.3 + 0.5 * lm; col = mix(t3, c.white, 0.72); }                                     // a few drops close by
      if (R() > 0.35 + lm * 1.2 && layer < 2) continue;
      const a = Math.atan2(uy, ux) + R.g() * 0.012, ax = Math.cos(a), ay = Math.sin(a);
      // a falling drop is drawn as a line that breaks
      const pts = P.line(R, x - ax * L * 0.5, y - ay * L * 0.5, x + ax * L * 0.5, y + ay * L * 0.5, 0.25, 0.004, 5);
      C.stroke(pts, { w, c: col, m: layer === 0 ? M.wax : M.chalk, p: clamp(p, 0.1, 0.95), ti: 0.5, to: 0.12, pv: 0.45, cj: 0.02, nodust: true });
      if (layer > 0 && R.chance(0.3)) { const q = L * 0.5 + R.r(4, 14), L2 = R.r(4, 16); C.stroke([x + ax * q, y + ay * q, x + ax * (q + L2), y + ay * (q + L2)], { w: w * 0.9, c: col, m: M.chalk, p: clamp(p * 0.8, 0.1, 0.9), ti: 0.3, to: 0.3, nodust: true }); }
    }
    C.stencil();
  };
})(typeof self !== 'undefined' ? self : globalThis);
