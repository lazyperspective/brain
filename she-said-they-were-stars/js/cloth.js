// cloth.js -- the underside of the umbrella: one old dark cloth, eight gores, lit a little from below and
// glowing a little with whatever stands behind it. Its folds, its hem, the places it was mended -- and the holes.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, fbm = A.fbm, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c, N = Wd.N, UM = Wd.UM;
  const o3 = [0, 0, 0], t3 = [0, 0, 0], q3 = [0, 0, 0];
  const lum = v => 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];

  // a random place on the cloth that is on the sheet: { x, y, th, s, in }
  function spot(R, pad) {
    for (let k = 0; k < 60; k++) { const x = R.r(-pad, 1600 + pad), y = R.r(-pad, 900 + pad); if (Wd.at(x, y, o3)) return { x, y, th: o3[0], s: o3[1], in: o3[2] }; }
    return null;
  }
  Wd.spot = spot;
  // a line drawn on the cloth itself (so it bends the way the cloth does): from (th0, s0) to (th1, s1)
  function cline(th0, s0, th1, s1, n) {
    const pts = []; n = n || 8;
    for (let i = 0; i <= n; i++) { const t = i / n, p = Wd.cp(th0 + (th1 - th0) * t, s0 + (s1 - s0) * t); if (p[2] < 0.05) return null; pts.push(p[0], p[1]); }
    return pts;
  }
  Wd.cline = cline;
  // how many sheet units one unit of s (down the gore) and one unit of th (across it) cover at a point
  function scale(th, s, out) {
    const p = Wd.cp(th, s), x = p[0], y = p[1], ps = Wd.cp(th, s + 0.01), u = th - Math.floor(th), dt = u > 0.5 ? -0.01 : 0.01, pt = Wd.cp(th + dt, s);
    out[0] = Math.hypot(ps[0] - x, ps[1] - y) * 100; out[1] = Math.hypot(pt[0] - x, pt[1] - y) * 100; return out;
  }
  Wd.scale = scale;
  // real size on the cloth: metres per unit of s, and per unit of th at a given s
  const MS = UM.Ra * UM.alpha, mth = s => 2 * UM.Ra * Math.sin(clamp(s, 0.02, 1.1) * UM.alpha) * Math.sin(Math.PI / N);
  Wd.MS = MS; Wd.mth = mth;
  // a point a little way off across the cloth: dx metres across the gore, dy metres down it  -> sheet
  const off = (pt, dx, dy) => Wd.cp(pt.th + dx / mth(pt.s), pt.s + dy / MS);
  Wd.off = off;

  // ------------------------------------------------------------------ where the mended places are
  Wd.place = function () {
    if (Wd.MOON) return;
    const at = (x, y) => { Wd.at(x, y, o3); return { th: o3[0], s: o3[1], x, y }; };
    Wd.MOON = Object.assign(at(1166, 322), { r: 0.043 });                                            // a round patch, cut from something pale, right where the street lamp stands
    Wd.PATCH = [
      Object.assign(at(668, 668), { w: 0.034, h: 0.027, rot: 0.3, kind: 'gingham' }),
      Object.assign(at(905, 100), { w: 0.024, h: 0.030, rot: -0.2, kind: 'dots' }),
      Object.assign(at(152, 352), { w: 0.022, h: 0.017, rot: 0.9, kind: 'stripe' }),
    ];
    Wd.DARN = [[at(985, 705), at(1085, 640)], [at(330, 120), at(250, 180)]];                          // tears sewn shut, the stitches like the legs of something
    Wd.PINNED = [at(118, 478), at(170, 452)];                                                         // one that is only pinned
  };
  const inMoon = (th, s, k) => { const m = Wd.MOON; let d = th - m.th; if (d > N / 2) d -= N; else if (d < -N / 2) d += N; return Math.hypot(d * mth(m.s), (s - m.s) * MS) < m.r * (k || 1); };
  function inPatch(th, s, pad) {
    for (const p of Wd.PATCH) { const dx = (th - p.th) * mth(p.s), dy = (s - p.s) * MS, cr = Math.cos(p.rot), sr = Math.sin(p.rot), a = dx * cr + dy * sr, b = -dx * sr + dy * cr; if (Math.abs(a) < p.w + pad && Math.abs(b) < p.h + pad) return true; }
    return false;
  }

  // ------------------------------------------------------------------ first the cloth is stained: two glazes of watercolour
  S.clothWash = function (C, R, pass) {
    const sd = 700 + pass * 13;
    C.wash(0, 0, 1600, 900, (x, y, pig) => {
      if (!Wd.at(x, y, o3)) return 0;
      const th = o3[0], s = o3[1];
      Wd.clothCol(x, y, th, s, pig);
      const u = th - Math.floor(th);
      // the brush was pulled from the crown down each gore
      const br = vn(th * 46 + sd, s * 3.1, sd) - 0.5, bl = fbm(x / 150, y / 150, sd + 3, 3) - 0.5;
      if (pass === 0) {
        const q = vn(x / 260 + 9, y / 260, sd + 8) - 0.5;
        pig[0] = clamp(pig[0] * (1.05 + 0.5 * q) + 0.03, 0.004, 1); pig[1] = clamp(pig[1] * 1.1 + 0.03, 0.004, 1); pig[2] = clamp(pig[2] * 1.06 + 0.05, 0.004, 1);
        return 0.52 * (1 + 0.4 * bl + 0.3 * br);
      }
      // second glaze pools a little against every rib
      const pool = 1 + 0.16 * (Math.exp(-u * u / 0.002) + Math.exp(-(1 - u) * (1 - u) / 0.002));
      return 0.66 * (1 + 0.28 * br + 0.3 * bl) * pool;
    }, { gran: 0.4 });
  };

  // ------------------------------------------------------------------ then pastel, laid down the gores the way the cloth is pulled
  S.clothPastel = function (C, R, pass) {
    C.stencil(Wd.stencil(C), 1);
    const n = pass === 0 ? 4200 : pass === 1 ? 4600 : 2400, sc = [0, 0];
    for (let i = 0; i < n; i++) {
      const sp = spot(R, 20); if (!sp) continue;
      const th = sp.th, s = sp.s, g = Math.floor(th), u = th - g;
      const t = Wd.clothCol(sp.x, sp.y, th, s, t3), b = lum(t3);
      if (pass === 2 && b < 0.17 && R.chance(0.7)) continue;                 // the last, small strokes go where the light is
      scale(th, s, sc);
      let col = [t3[0], t3[1], t3[2]];
      // broken colour: a painter never puts the same blue down twice -- but its neighbours, not strangers
      const q = R(), j = R.g() * 0.02;
      if (pass < 2) { if (q < 0.16) col = mix(col, c.ultra, 0.16); else if (q < 0.30) col = mix(col, c.violet, 0.18); else if (q < 0.38) col = mix(col, c.magenta, 0.06 + 0.16 * clamp(t, 0, 1)); else if (q < 0.48) col = mix(col, c.dteal, 0.16); else if (q < 0.62) col = mix(col, c.ink, 0.25); }
      else { if (q < 0.4) col = mix(col, b > 0.3 ? c.rose : c.cobalt, 0.2); else if (q < 0.6) col = mix(col, b > 0.3 ? c.amber : c.orchid, 0.16); else col = mix(col, c.white, 0.05); }
      col = [clamp(col[0] + j, 0.004, 1), clamp(col[1] + j * 0.7, 0.004, 1), clamp(col[2] + j, 0.004, 1)];
      let pts, w;
      if (pass === 2 && R.chance(0.4)) { // across the gore, following the weft
        const half = R.r(14, 34) / Math.max(40, sc[1]); const ua = clamp(u - half, 0.03, 0.97), ub = clamp(u + half, 0.03, 0.97);
        pts = cline(g + ua, s, g + ub, s + R.g() * 0.004, 6); w = R.r(2.5, 5);
      } else {
        const L = (pass === 0 ? R.r(70, 170) : pass === 1 ? R.r(40, 110) : R.r(16, 44)) / Math.max(40, sc[0]) * 0.5;
        const du = R.g() * 0.008, sm = Wd.smax(th);
        const sa = clamp(s - L, 0.015, sm - 0.004), sb = clamp(s + L, 0.015, sm - 0.004); if (sb - sa < 0.004) continue;
        pts = cline(g + clamp(u - du, 0.012, 0.988), sa, g + clamp(u + du, 0.012, 0.988), sb, 8); w = pass === 0 ? R.r(12, 26) : pass === 1 ? R.r(6, 14) : R.r(2.5, 6);
      }
      if (!pts) continue;
      C.stroke(P.wob(R, pts, pass === 2 ? 0.5 : 1.0, 34), { w, c: col, m: M.pastel, p: pass === 0 ? R.r(0.5, 0.74) : pass === 1 ? R.r(0.42, 0.66) : R.r(0.34, 0.58), ti: 0.2, to: 0.32, cj: 0.016, nodust: pass === 0 });
    }
    C.stencil();
  };
  // the side of a hand, drawn down each gore
  S.clothRub = function (C, R) {
    for (let i = 0; i < 300; i++) {
      const sp = spot(R, 0); if (!sp) continue;
      const g = Math.floor(sp.th), u = sp.th - g, sm = Wd.smax(sp.th), L = R.r(0.08, 0.2);
      const pts = cline(g + clamp(u, 0.04, 0.96), clamp(sp.s - L, 0.03, sm - 0.03), g + clamp(u + R.g() * 0.01, 0.04, 0.96), clamp(sp.s + L, 0.03, sm - 0.03), 8); if (!pts) continue;
      C.smudge(pts, R.r(9, 17), R.r(0.22, 0.4), { carry: 0.2 });
    }
  };

  // ------------------------------------------------------------------ the folds it keeps from every time it was rolled shut
  S.creases = function (C, R) {
    C.stencil(Wd.stencil(C), 1);
    for (let g = 0; g < N; g++) {
      for (const [uc, k] of [[0.5, 1], [0.25, 0.5], [0.75, 0.5]]) {
        let s = 0.08 + R() * 0.05;
        while (s < 0.98) {
          const L = R.r(0.03, 0.11), th = g + uc + R.g() * 0.004, sm = Wd.smax(th) - 0.012, s1 = Math.min(sm, s + L); if (s1 - s < 0.01) break;
          const pm = Wd.cp(th, (s + s1) / 2); if (pm[0] > -30 && pm[0] < 1630 && pm[1] > -30 && pm[1] < 930 && R.chance(0.82)) {
            Wd.clothCol(pm[0], pm[1], th, (s + s1) / 2, t3);
            const pts = cline(th, s, th + R.g() * 0.003, s1, 6);
            if (pts) {
              // worn pale along the ridge of the fold, a shadow beside it
              C.stroke(P.wob(R, pts, 0.5, 20), { w: R.r(1.2, 2.2), c: mix(t3, c.lilac, 0.34 * k + 0.1), m: M.wax, p: R.r(0.25, 0.5) * (0.6 + 0.4 * k), ti: 0.3, to: 0.3 });
              const p2 = cline(th + 0.012, s, th + 0.012, s1, 6); if (p2) C.stroke(P.wob(R, p2, 0.5, 20), { w: R.r(2, 3.6), c: mix(t3, c.ink, 0.6), m: M.pastel, p: R.r(0.2, 0.36) * k, ti: 0.3, to: 0.3, nodust: true });
            }
          }
          s = s1 + R.r(0.005, 0.03);
        }
      }
      // the slanting creases of the wrap, fanning from each tip
      for (let i = 0; i < 5; i++) {
        const side = R.chance(0.5), u0 = side ? R.r(0.03, 0.1) : R.r(0.9, 0.97), u1 = side ? R.r(0.3, 0.6) : R.r(0.4, 0.7), s0 = R.r(0.85, 0.96), s1 = R.r(0.45, 0.75);
        const pts = cline(g + u0, Math.min(s0, Wd.smax(g + u0) - 0.02), g + u1, s1, 10); if (!pts) continue;
        const pm = Wd.cp(g + (u0 + u1) / 2, (s0 + s1) / 2); if (pm[0] < -40 || pm[0] > 1640 || pm[1] < -40 || pm[1] > 940) continue;
        Wd.clothCol(pm[0], pm[1], g + (u0 + u1) / 2, (s0 + s1) / 2, t3);
        C.stroke(P.wob(R, pts, 1.2, 40), { w: R.r(1.4, 3), c: mix(t3, c.ink, 0.5), m: M.pastel, p: R.r(0.16, 0.3), ti: 0.2, to: 0.5, nodust: true });
        C.stroke(P.wob(R, pts.map((v, k2) => v + (k2 & 1 ? -1.6 : 1.2)), 1.2, 40), { w: 1.2, c: mix(t3, c.lilac, 0.3), m: M.wax, p: R.r(0.14, 0.3), ti: 0.2, to: 0.5 });
      }
    }
    C.stencil();
  };

  // ------------------------------------------------------------------ where light comes through, the weave shows: warp and weft, thread by thread
  S.weave = function (C, R) {
    C.stencil(Wd.stencil(C), 1); const sc = [0, 0];
    for (let i = 0; i < 9000; i++) {
      const sp = spot(R, 0); if (!sp) continue;
      Wd.behind(sp.x, sp.y, t3); const gl = lum(t3) * Wd.thru(sp.th, sp.s); if (gl < 0.05 || R() > gl * 5) continue;
      if (inMoon(sp.th, sp.s, 1.3)) continue;
      scale(sp.th, sp.s, sc); const g = Math.floor(sp.th), u = sp.th - g; Wd.clothCol(sp.x, sp.y, sp.th, sp.s, q3);
      const dark = R.chance(0.62), col = dark ? mix(q3, c.ink, 0.5) : mix(q3, mix(t3, c.white, 0.3), 0.5);
      let pts;
      if (R.chance(0.5)) { const h = R.r(8, 22) / Math.max(40, sc[1]); pts = cline(g + clamp(u - h, 0.02, 0.98), sp.s, g + clamp(u + h, 0.02, 0.98), sp.s, 4); }
      else { const h = R.r(8, 22) / Math.max(40, sc[0]), sm = Wd.smax(sp.th) - 0.01; pts = cline(sp.th, clamp(sp.s - h, 0.02, sm), sp.th, clamp(sp.s + h, 0.02, sm), 4); }
      if (!pts) continue;
      C.stroke(pts, { w: R.r(0.7, 1.1), c: col, m: dark ? M.pencil : M.wax, p: R.r(0.3, 0.6) * (dark ? 1 : 0.7), ti: 0.3, to: 0.3, cj: 0.02 });
    }
    C.stencil();
  };

  // ------------------------------------------------------------------ the rain on the other side, seen where the cloth is lit from behind:
  // every drop that lands is a small dark thing sliding towards the hem
  S.rainShadow = function (C, R) {
    C.stencil(Wd.stencil(C), 1); const sc = [0, 0];
    for (let i = 0; i < 5200; i++) {
      const sp = spot(R, 0); if (!sp || sp.in < 0.03) continue;
      Wd.through(sp.x, sp.y, t3); const gl = lum(t3) * Wd.thru(sp.th, sp.s); if (gl < 0.045 || R() > gl * 6) continue;
      if (inMoon(sp.th, sp.s, 1.05)) continue;
      scale(sp.th, sp.s, sc); Wd.clothCol(sp.x, sp.y, sp.th, sp.s, q3);
      const run = R.chance(0.12), L = (run ? R.r(18, 60) : R.r(1.5, 6)) / Math.max(40, sc[0]), s1 = Math.min(sp.s + L, Wd.smax(sp.th) - 0.01), p1 = Wd.cp(sp.th + (run ? R.g() * 0.004 : 0), s1);
      C.stroke(run ? P.wob(R, [sp.x, sp.y, (sp.x + p1[0]) / 2, (sp.y + p1[1]) / 2, p1[0], p1[1]], 1.2, 12) : [sp.x, sp.y, p1[0], p1[1]], { w: run ? R.r(1.0, 1.6) : R.r(1.4, 3.0), c: mix(q3, c.ink, 0.5), m: M.pastel, p: R.r(0.25, 0.5), ti: run ? 0.5 : 0.1, to: 0.05, nodust: true });
      if (!run && R.chance(0.4)) C.dab(p1[0] + 0.8, p1[1] + 0.8, 0.7, mix(q3, mix(t3, c.white, 0.4), 0.6), M.wax, 0.5);         // the bright edge of a bead
    }
    C.stencil();
  };

  // ------------------------------------------------------------------ the hem
  S.hem = function (C, R) {
    for (let g = 0; g < N; g++) {
      const n = 44, inn = [], edge = [];
      for (let i = 0; i <= n; i++) { const th = g + (i / n) * 0.9999, sm = Wd.smax(th), a = Wd.cp(th, sm - 0.010), b = Wd.cp(th, sm + 0.004); if (a[2] < 0.05) continue; inn.push(a[0], a[1]); edge.push([b[0], b[1], th, sm]); }
      if (inn.length < 8) continue;
      // the turned edge: two thicknesses of cloth, the darkest line of the canopy -- as wide as a real hem is, at whatever distance it is
      { const q = Wd.rod(tt => Wd.cp(g + tt * 0.9999, Wd.smax(g + tt * 0.9999) - 0.0068), 60, 0.0050);
        Wd.drawRod(C, R, q, { c: c.ink, m: M.conte, p: 0.8, wob: 0.5, pv: 0.2, maxSeg: 8 });
        Wd.drawRod(C, R, q, { c: mix(c.ink, c.night, 0.5), m: M.conte, frac: 0.55, at: -0.2, p: 0.7, maxSeg: 8 });
        // the fold of the hem catches what light there is under the umbrella
        const m = q[q.length >> 1]; if (m) { const inside = Wd.at(m.x + m.nx * m.w * 1.5, m.y + m.ny * m.w * 1.5, o3) ? 1 : -1, wk = clamp(0.66 * (m.x / 1600) + 0.52 * (m.y / 900) - 0.12, 0, 1);
          Wd.drawRod(C, R, q, { c: mix(mix(c.cobalt, c.hot, ss(0.3, 0.75, wk)), c.salmon, ss(0.7, 1, wk)), m: M.wax, frac: 0.16, at: 0.92 * inside, p: 0.22 + 0.5 * wk, skip: 0.25, maxSeg: 5, wob: 0.3, minW: 0.8 }); } }
      // wet, and lit from behind by whatever it crosses
      let run = [], lastC = null;
      const flush = () => { if (run.length >= 6 && lastC) C.stroke(P.wob(R, run, 0.4, 20), { w: R.r(1.6, 2.5), c: lastC.c, m: M.wax, p: lastC.p, ti: 0.3, to: 0.3 }); run = []; };
      for (let i = 0; i < edge.length; i++) {
        const e = edge[i]; if (e[0] < -10 || e[0] > 1610 || e[1] < -10 || e[1] > 910) { flush(); continue; }
        Wd.night(e[0], e[1], t3); Wd.behind(e[0], e[1], q3); t3[0] = Math.max(t3[0], q3[0]); t3[1] = Math.max(t3[1], q3[1]); t3[2] = Math.max(t3[2], q3[2]); const lm = lum(t3);
        if (lm < 0.13 + 0.1 * vn(e[2] * 14, 2.2, 31)) { flush(); lastC = null; continue; }
        if (!lastC || run.length > 14) { flush(); lastC = { c: mix(t3, c.white, 0.42 + 0.3 * lm), p: clamp(0.36 + 1.1 * lm, 0.25, 0.95) }; }
        run.push(e[0], e[1]);
      }
      flush();
      // the hemming stitch
      C.stencil(Wd.stencil(C), 1);
      for (let i = 0; i < 70; i++) {
        const th = g + (i + R.r(0.1, 0.9)) / 70, sm = Wd.smax(th) - 0.032, a = Wd.cp(th, sm), b = Wd.cp(th + 0.006, sm + R.g() * 0.002); if (a[0] < -10 || a[0] > 1610 || a[1] < -10 || a[1] > 910) continue;
        C.stroke([a[0], a[1], b[0], b[1]], { w: 0.9, c: c.threadD, m: M.wax, p: R.r(0.25, 0.5), ti: 0, to: 0 });
      }
      C.stencil();
    }
  };

  // ------------------------------------------------------------------ the mending
  // a patch sewn on from underneath: gingham, spots, a stripe -- whatever was in the rag bag
  function patch(C, R, p) {
    const cr = Math.cos(p.rot), sr = Math.sin(p.rot), sd = (R() * 9999) | 0;
    const loc = (th, s, out) => { const dx = (th - p.th) * mth(p.s), dy = (s - p.s) * MS; out[0] = dx * cr + dy * sr; out[1] = -dx * sr + dy * cr; };
    const corner = (a, b) => off(p, a * cr - b * sr, a * sr + b * cr);
    const cs = [corner(-p.w, -p.h), corner(p.w, -p.h), corner(p.w, p.h), corner(-p.w, p.h)];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of cs) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const l2 = [0, 0];
    // a soft shadow where its thickness lifts it off the cloth
    C.veil(x0 - 8, y0 - 8, x1 + 8, y1 + 8, (x, y, col) => { if (!Wd.at(x, y, o3)) return 0; loc(o3[0], o3[1], l2); const e = Math.max(Math.abs(l2[0]) - p.w, Math.abs(l2[1]) - p.h); if (e > 0.006 || e < -0.004) return 0; col[0] = c.ink[0]; col[1] = c.ink[1]; col[2] = c.ink[2]; return 0.5 * (1 - Math.abs(e - 0.001) / 0.005); }, { g: 0.3 });
    C.veil(x0 - 4, y0 - 4, x1 + 4, y1 + 4, (x, y, col) => {
      if (!Wd.at(x, y, o3)) return 0; loc(o3[0], o3[1], l2);
      const wv = 0.0012 * (vn(l2[1] * 400, 1.5, sd) - 0.5) * 2, wh = 0.0012 * (vn(l2[0] * 400, 3.5, sd + 1) - 0.5) * 2;
      const e = Math.max(Math.abs(l2[0] + wv) - p.w, Math.abs(l2[1] + wh) - p.h); if (e > 0) return 0;
      const t = Wd.under(x, y, o3[0], o3[1], t3), lit = clamp(0.50 + 0.85 * t, 0.4, 1.15);
      let r, g2, b;
      if (p.kind === 'gingham') { const f = 0.0062, a = (Math.floor(l2[0] / f + 100) & 1), bb = (Math.floor(l2[1] / f + 100) & 1), k = a + bb; const m = k === 0 ? c.gingW : k === 1 ? mix(c.gingW, c.gingR, 0.55) : c.gingR; r = m[0]; g2 = m[1]; b = m[2]; }
      else if (p.kind === 'dots') { const f = 0.0125, yy = l2[1] / (f * 0.866), row = Math.round(yy), xx = l2[0] / f - (row & 1) * 0.5, dd = Math.hypot((xx - Math.round(xx)) * f, (yy - row) * f * 0.866); const m = dd < 0.0033 ? c.cream : c.dotT; r = m[0]; g2 = m[1]; b = m[2]; }
      else { const f = 0.0058, k = ((Math.floor(l2[0] / f + 100) % 3) + 3) % 3; const m = k === 0 ? c.gold : k === 1 ? c.cream : hx('#7f8fd0'); r = m[0]; g2 = m[1]; b = m[2]; }
      // faded, and seen by the light that reaches the underside here
      const fade = 0.8 + 0.5 * (fbm(x / 9, y / 9, sd + 2, 2) - 0.5), gy = (r + g2 + b) / 3, ds = p.kind === 'gingham' ? 0.25 : 0.34;         // washed and washed
      r += (gy - r) * ds; g2 += (gy - g2) * ds; b += (gy - b) * ds;
      col[0] = r * lit * fade * (0.42 + 0.5 * t3[0] + 0.2); col[1] = g2 * lit * fade * (0.40 + 0.5 * t3[1] + 0.18); col[2] = b * lit * fade * (0.5 + 0.5 * t3[2] + 0.2);
      return 0.9 * ss(0, -0.0016, e);
    }, { g: 0.5, fill: 0.3 });
    // whipped on all round with a thread that did not match
    const per = [[-p.w, -p.h, p.w, -p.h], [p.w, -p.h, p.w, p.h], [p.w, p.h, -p.w, p.h], [-p.w, p.h, -p.w, -p.h]];
    for (const e of per) {
      const len = Math.hypot(e[2] - e[0], e[3] - e[1]), n = Math.round(len / 0.0058), nx = -(e[3] - e[1]) / len, ny = (e[2] - e[0]) / len;
      for (let i = 0; i <= n; i++) {
        const t = (i + R.r(-0.2, 0.2)) / n, a = e[0] + (e[2] - e[0]) * t, b = e[1] + (e[3] - e[1]) * t, sl = R.r(-0.0015, 0.0015);
        const q0 = corner(a - nx * 0.0045 + sl, b - ny * 0.0045 + sl), q1 = corner(a + nx * 0.0035, b + ny * 0.0035);
        C.stroke([q0[0], q0[1], q1[0], q1[1]], { w: 1.25, c: mix(c.thread, c.cream, R()), m: M.wax, p: R.r(0.5, 0.8), ti: 0, to: 0.1 });
      }
    }
  }
  S.patches = function (C, R) { Wd.place(); for (const p of Wd.PATCH) patch(C, R, p); };

  // the moon: a round hole, and behind it a patch cut from something pale with flowers on it, long faded;
  // the street lamp stands exactly behind
  S.moon = function (C, R) {
    Wd.place(); const m = Wd.MOON, sd = 9191, l2 = [0, 0];
    const rs = Wd.cp(m.th, m.s + m.r / MS), rr = Math.hypot(rs[0] - m.x, rs[1] - m.y) * 1.25 + 12;
    const dist = (th, s) => { let d = th - m.th; if (d > N / 2) d -= N; else if (d < -N / 2) d += N; const dx = d * mth(m.s), dy = (s - m.s) * MS; l2[0] = dx; l2[1] = dy; return Math.hypot(dx, dy) / m.r; };
    // the faded flowers of the print: where they are on the patch (metres from its middle)
    const FL = []; { const Rf = A.rng(5150); for (let i = 0; i < 9; i++) { const a = Rf() * 6.283, rd = Math.sqrt(Rf()) * m.r * 0.92; FL.push([Math.cos(a) * rd, Math.sin(a) * rd, Rf.r(0.0075, 0.0125), Rf() * 6.283]); } }
    const flower = (x, y) => { let v = 0; for (const f of FL) { const dx = x - f[0], dy = y - f[1], d = Math.hypot(dx, dy) / f[2]; if (d > 1.25) continue; const a = Math.atan2(dy, dx) + f[3], pet = 0.70 + 0.28 * Math.cos(a * 5) + 0.12 * (vn(a * 2 + f[3] * 9, d * 3, sd + 7) - 0.5); v = Math.max(v, (1 - ss(pet * 0.62, pet * 1.08, d)) * (d < 0.22 ? 0.3 : 1) * (0.55 + 0.45 * vn(x * 500 + f[3], y * 500, sd + 8))); } return v; };
    C.stencil(Wd.stencil(C), 1);
    // its light on the cloth round it: the lamp is bigger than the hole, and wet air makes a ring
    C.glow(m.x, m.y, rr * 4.6, hx('#ff9a6a'), 0.16, { pow: 2, g: 0.6 }); C.glow(m.x, m.y, rr * 2.7, hx('#ffc070'), 0.26, { pow: 2, g: 0.6 }); C.glow(m.x, m.y, rr * 1.7, hx('#ffe09a'), 0.22, { pow: 2, g: 0.6 });
    for (let i = 0; i < 26; i++) { const a = R() * 6.283, r0 = rr * R.r(1.62, 1.74); C.stroke(P.arc(R, m.x, m.y, r0, a, a + R.r(0.2, 0.6), 0.02), { w: R.r(1.5, 3.5), c: hx('#ffd9a0'), m: M.pastel, p: R.r(0.12, 0.26), k: 0.5, ti: 0.4, to: 0.4, nodust: true }); }
    // the patch is bigger than the hole: round the moon the cloth is double, and a little darker for it
    C.veil(m.x - rr * 1.5, m.y - rr * 1.5, m.x + rr * 1.5, m.y + rr * 1.5, (x, y, col) => { if (!Wd.at(x, y, o3)) return 0; const d = dist(o3[0], o3[1]); if (d > 1.34 || d < 0.9) return 0; col[0] = 0.2; col[1] = 0.1; col[2] = 0.3; return 0.16 * ss(1.34, 1.26, d); }, { g: 0.4 });
    C.veil(m.x - rr * 1.2, m.y - rr * 1.2, m.x + rr * 1.2, m.y + rr * 1.2, (x, y, col) => {
      if (!Wd.at(x, y, o3)) return 0; let d = dist(o3[0], o3[1]); const ang = Math.atan2(l2[1], l2[0]);
      d /= 1 + 0.035 * (vn(ang * 2.2 + 1, 3.3, sd) - 0.5) * 2 + 0.02 * (vn(ang * 9, 1.3, sd + 1) - 0.5) * 2;              // cut by eye, with the kitchen scissors
      if (d >= 1.02) return 0;
      // the lamp behind: hottest a little off the middle
      const hot = 1 - ss(0.0, 1.0, Math.hypot(x - (m.x - 7), y - (m.y - 5)) / (rr * 1.0));
      let r = 1.0, g2 = 0.80 + 0.17 * hot, b = 0.47 + 0.36 * hot * hot;
      // the flowers that were printed on it, nearly gone: its seas
      const fl = flower(l2[0], l2[1]), stain = ss(0.5, 0.7, fbm(l2[0] * 40 + 3.1, l2[1] * 40 + 1.7, sd + 2, 3));
      r -= 0.07 * fl + 0.05 * stain; g2 -= 0.24 * fl + 0.09 * stain; b -= 0.12 * fl + 0.08 * stain;
      // limb: the cloth turns away, and the patch's own hem lies under it
      const limb = ss(0.6, 1.0, d); r -= 0.06 * limb; g2 -= 0.2 * limb; b -= 0.16 * limb;
      // its weave, coarser than the umbrella's
      const wv = 0.009 * (Math.sin(l2[0] * 4300 + 3 * vn(l2[1] * 300, 1.5, sd + 5)) + Math.sin(l2[1] * 4300 + 3 * vn(l2[0] * 300, 2.5, sd + 6))); r += wv; g2 += wv; b += wv;
      col[0] = clamp(r, 0, 1); col[1] = clamp(g2, 0, 1); col[2] = clamp(b, 0, 1);
      return 0.96 * (1 - ss(0.95, 1.02, d));
    }, { g: 0.26, fill: 0.4 });
    // pastel over it, to keep it a drawn thing: the pale stick, then a dusty rose into the flowers
    for (let i = 0; i < 70; i++) {
      const a = R() * 6.283, rd = Math.sqrt(R()) * m.r * 0.9, ox = Math.cos(a) * rd, oy = Math.sin(a) * rd, p = off(m, ox, oy), b2 = off(m, ox + R.r(-0.011, 0.011), oy + R.r(-0.006, 0.006));
      const fl = flower(ox, oy) > 0.5, hot = 1 - rd / m.r;
      C.stroke([p[0], p[1], b2[0], b2[1]], { w: R.r(2.5, 6), c: fl ? mix(hx('#e79a8a'), hx('#c98aa8'), R()) : mix(hx('#ffd98a'), c.white, 0.3 + 0.7 * hot * R()), m: M.pastel, p: R.r(0.2, 0.42), k: 0.55, ti: 0.3, to: 0.3, nodust: true });
    }
    // threads of its weave, in pencil
    for (let i = 0; i < 90; i++) {
      const a = R() * 6.283, rd = Math.sqrt(R()) * m.r * 0.93, ox = Math.cos(a) * rd, oy = Math.sin(a) * rd, hz = R.chance(0.5), L = R.r(0.004, 0.012);
      const p0 = off(m, ox - (hz ? L : 0), oy - (hz ? 0 : L)), p1 = off(m, ox + (hz ? L : 0), oy + (hz ? 0 : L));
      C.stroke([p0[0], p0[1], p1[0], p1[1]], { w: 0.8, c: hx('#c8804e'), m: M.pencil, p: R.r(0.25, 0.5), ti: 0.2, to: 0.2 });
    }
    // threads of the torn edge, lying over the light
    for (let i = 0; i < 70; i++) {
      const a = R() * 6.283, r0 = m.r * R.r(0.98, 1.05), r1 = m.r * R.r(0.84, 0.97), a1 = a + R.g() * 0.14, p0 = off(m, Math.cos(a) * r0, Math.sin(a) * r0), p1 = off(m, Math.cos(a1) * r1, Math.sin(a1) * r1);
      C.stroke([p0[0], p0[1], p1[0], p1[1]], { w: R.r(0.8, 1.3), c: R.chance(0.7) ? c.ink : c.violet, m: M.pencil, p: R.r(0.5, 0.9), ti: 0, to: 0.5 });
    }
    // the rim of the hole, where the cut edge has curled: a dark line that comes and goes
    for (let k = 0; k < 5; k++) { const a0 = k * 1.26 + R.r(0, 0.2), pts = []; for (let i = 0; i <= 14; i++) { const a = a0 + i / 14 * R.r(0.9, 1.15), q = off(m, Math.cos(a) * m.r * 1.012, Math.sin(a) * m.r * 1.012); pts.push(q[0], q[1]); } C.stroke(P.wob(R, pts, 0.5, 26), { w: R.r(1.3, 2.0), c: k % 2 ? c.ink : hx('#3a1c50'), m: M.conte, p: R.r(0.4, 0.62), ti: 0.25, to: 0.25, pv: 0.3 }); }
    // the stitches that hold the patch: a ring of them, each needle hole letting a pin of lamplight through
    const ns = 40;
    for (let i = 0; i < ns; i++) {
      const a = i / ns * 6.283 + R.g() * 0.02, a2 = a + 6.283 / ns * 0.62, rr2 = m.r * (1.27 + R.g() * 0.012), p0 = off(m, Math.cos(a) * rr2, Math.sin(a) * rr2), p1 = off(m, Math.cos(a2) * rr2, Math.sin(a2) * rr2);
      C.stroke([p0[0], p0[1], p1[0], p1[1]], { w: 1.5, c: mix(c.cream, c.gold, 0.3 + 0.4 * R()), m: M.wax, p: R.r(0.6, 0.9), ti: 0, to: 0.1 });
      if (R.chance(0.75)) C.pin(p0[0], p0[1], R.r(0.4, 0.7), hx('#ffd58a'), { a: R.r(0.6, 0.95), halo: 4.5 });
    }
    C.stencil();
  };

  // a tear sewn shut: a seam like a scar, cross-stitched
  S.darns = function (C, R) {
    Wd.place();
    for (const d of Wd.DARN) {
      const a = d[0], b = d[1], n = 14, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n, p = Wd.cp(a.th + (b.th - a.th) * t, a.s + (b.s - a.s) * t + 0.006 * Math.sin(t * 7)); pts.push(p[0], p[1]); }
      C.stroke(P.wob(R, pts, 0.8, 20), { w: 3.2, c: c.ink, m: M.conte, p: 0.6, ti: 0.3, to: 0.3 });
      Wd.clothCol(pts[14], pts[15], a.th, a.s, t3);
      C.stroke(P.wob(R, pts.map((v, i) => v + (i & 1 ? -1.8 : 0.6)), 0.8, 20), { w: 1.3, c: mix(t3, c.lilac, 0.45), m: M.wax, p: 0.4, ti: 0.3, to: 0.3 });
      const L = P.len(pts), m = Math.round(L / 7.5); let acc = 0, seg = 0;
      for (let i = 1; i < m; i++) {
        const want = i / m * L; while (seg < n - 1 && acc + Math.hypot(pts[seg * 2 + 2] - pts[seg * 2], pts[seg * 2 + 3] - pts[seg * 2 + 1]) < want) { acc += Math.hypot(pts[seg * 2 + 2] - pts[seg * 2], pts[seg * 2 + 3] - pts[seg * 2 + 1]); seg++; }
        const dx = pts[seg * 2 + 2] - pts[seg * 2], dy = pts[seg * 2 + 3] - pts[seg * 2 + 1], sl = Math.hypot(dx, dy) || 1, t = (want - acc) / sl, x = pts[seg * 2] + dx * t, y = pts[seg * 2 + 1] + dy * t, nx = -dy / sl, ny = dx / sl, h = R.r(4.5, 7), sk = R.r(-2, 2);
        C.stroke([x - nx * h + dx / sl * sk, y - ny * h + dy / sl * sk, x + nx * h - dx / sl * sk, y + ny * h - dy / sl * sk], { w: 1.25, c: mix(c.thread, c.rose, R() * 0.4), m: M.wax, p: R.r(0.5, 0.82), ti: 0, to: 0.1 });
        if (R.chance(0.35)) C.pin(x - nx * h, y - ny * h, R.r(0.35, 0.6), c.ice, { a: 0.6, halo: 4 });
      }
    }
  };

  // ------------------------------------------------------------------ the holes
  // where they are: most where the cloth is worn thin
  Wd.placeStars = function () {
    if (Wd.STARS) return Wd.STARS;
    Wd.place(); const R = A.rng(808017), st = (Wd.STARS = []);
    let guard = 0;
    while (st.length < 1750 && guard++ < 90000) {
      const sp = spot(R, 0); if (!sp || sp.s < 0.035 || sp.in < 0.02) continue;
      const w = Wd.wear(sp.th, sp.s); if (R() > 0.024 + 0.6 * Math.pow(w, 1.25)) continue;
      if (inMoon(sp.th, sp.s, 1.4) || inPatch(sp.th, sp.s, 0.004)) continue;
      const q = R(); let r = q < 0.84 ? R.r(0.28, 0.7) : q < 0.965 ? R.r(0.8, 1.5) : R.r(1.7, 2.9);
      if (w < 0.25 && r > 1.5) r *= 0.6;
      st.push({ x: sp.x, y: sp.y, th: sp.th, s: sp.s, r, w });
    }
    return st;
  };
  // the colour and strength of the light a hole lets through
  function starLight(x, y, out) {
    Wd.behind(x, y, t3); const lm = lum(t3), mx = Math.max(t3[0], t3[1], t3[2], 0.01), sat = clamp(lm * 3.4 - 0.12, 0, 1);
    out[0] = c.ice[0] + (t3[0] / mx - c.ice[0]) * sat; out[1] = c.ice[1] + (t3[1] / mx - c.ice[1]) * sat; out[2] = c.ice[2] + (t3[2] / mx - c.ice[2]) * sat;
    return clamp(0.5 + 0.9 * lm, 0.4, 1);
  }
  Wd.starLight = starLight;
  S.stars = function (C, R) {
    const st = Wd.placeStars(), col = [0, 0, 0], sc = [0, 0];
    for (const s of st) {
      const a = starLight(s.x, s.y, col);
      { const q = R(), tn = q < 0.12 ? c.lemon : q < 0.2 ? c.rose : q < 0.29 ? c.aqua : q < 0.34 ? c.salmon : null; if (tn) { const k = 0.55; col[0] += (tn[0] - col[0]) * k; col[1] += (tn[1] - col[1]) * k; col[2] += (tn[2] - col[2]) * k; } }
      if (s.r > 1.7 && R.chance(0)) { // not pricked but pulled: a short slit along the thread
        scale(s.th, s.s, sc); const along = R.chance(0.7), p1 = along ? Wd.cp(s.th, s.s + 0.01) : Wd.cp(s.th + 0.01, s.s), dl = Math.hypot(p1[0] - s.x, p1[1] - s.y) || 1, L = R.r(1.2, 2.6);
        C.pin(s.x, s.y, s.r * 0.6, col, { a, halo: 5, long: [(p1[0] - s.x) / dl * L, (p1[1] - s.y) / dl * L] });
      } else C.pin(s.x, s.y, s.r, col, { a, halo: s.r > 1.2 ? 7 : 4.6 });
    }
  };
  // long slits, down the fold lines: the cloth giving way along a thread. They look like something falling.
  S.slits = function (C, R) {
    const col = [0, 0, 0]; let made = 0, guard = 0;
    while (made < 11 && guard++ < 4000) {
      const sp = spot(R, 0); if (!sp || sp.s < 0.25 || sp.in < 0.08) continue;
      const u = sp.th - Math.floor(sp.th); if (Math.abs(u - 0.5) > 0.03 && Math.abs(u - 0.25) > 0.02 && Math.abs(u - 0.75) > 0.02) continue;
      if (inMoon(sp.th, sp.s, 1.6) || inPatch(sp.th, sp.s, 0.01)) continue;
      const L = R.r(0.02, 0.06), p0 = Wd.cp(sp.th, sp.s - L / 2), p1 = Wd.cp(sp.th, sp.s + L / 2), a = starLight(sp.x, sp.y, col);
      // widest at the head, a hair at the tail
      const n = Math.max(14, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 0.9)); for (let i = 0; i <= n; i++) { const t = i / n, x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t; C.pin(x + R.g() * 0.2, y + R.g() * 0.2, 0.3 + 0.95 * t * t * t, col, { a: a * (0.45 + 0.55 * t), halo: 3.2 + 2.4 * t }); }
      // frayed threads across it
      for (let i = 0; i < 5; i++) { const t = R.r(0.3, 1), x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t, dx = (p1[1] - p0[1]), dy = -(p1[0] - p0[0]), dl = Math.hypot(dx, dy) || 1, h = R.r(1.5, 4); C.stroke([x - dx / dl * h, y - dy / dl * h, x + dx / dl * h + R.g(), y + dy / dl * h + R.g()], { w: 0.8, c: c.ink, m: M.pencil, p: 0.7, ti: 0, to: 0.3 }); }
      made++;
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
