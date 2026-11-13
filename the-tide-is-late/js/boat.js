// boat.js -- the one thing that stayed. A small clinker rowing boat, red outside (the flat lumber crayon),
// yellow inside, lying over on her side in the flowers at the end of the jetty, still tied up.
// She is built as a real hull (stations, sheer, keel, a roll to port) and looked at through the same
// lens as the land, so the drawing has something true to wobble around.
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.W, K = Wd.K, T = A.TOOL, v = Wd.v, fbm = A.fbm, vn = A.vn, ss = A.ss, clamp = A.clamp;
  const S = (A.S = A.S || {});

  const L = 3.95, BH = 0.78, D = 0.63, PHI = 0.36, RHO = 0.15;
  const C0 = [-1.72, 0, 9.0];
  const ax = [-Math.cos(PHI), 0, Math.sin(PHI)], sd = [Math.sin(PHI), 0, Math.cos(PHI)];
  const breadth = u => (u < 0.45 ? BH * (0.68 + 0.32 * Math.sin((u / 0.45) * 1.5708)) : BH * (1 - Math.pow((u - 0.45) / 0.55, 2.25)));
  const sheer = u => D * (1 + 0.5 * Math.pow(u, 2.2) + 0.12 * (1 - u) * (1 - u));
  const keel = u => D * (0.05 * (1 - u) * (1 - u) + 0.22 * Math.pow(ss(0.7, 1, u), 1.5));
  let LIFT = 0;
  function local(u, side, t) {
    const b = breadth(u), h = sheer(u), k = keel(u), th = clamp(t, 0, 1) * 1.5707963;
    const y = b * Math.pow(Math.sin(th), 0.75), w = k + (h - k) * (1 - Math.pow(Math.max(0, Math.cos(th)), 1.15));
    return [(u - 0.5) * L + 0.085 * L * t * ss(0.82, 1, u), side * y, w];
  }
  const cr = Math.cos(RHO), sr = Math.sin(RHO);
  function world3(xl, vv, w) {
    const v2 = vv * cr - w * sr, w2 = vv * sr + w * cr - LIFT;
    return [C0[0] + ax[0] * xl + sd[0] * v2, w2, C0[2] + ax[2] * xl + sd[2] * v2];
  }
  const P3 = (u, side, t) => { const l = local(u, side, t); return world3(l[0], l[1], l[2]); };
  (function () { let m = 1e9; for (let u = 0.1; u <= 0.9; u += 0.05) for (let t = 0; t <= 1; t += 0.05) { const l = local(u, -1, t); const w2 = l[1] * sr + l[2] * cr; if (w2 < m) m = w2; } LIFT = m + 0.07; })();
  const scr = p => Wd.proj(p[0], p[1], p[2]);
  const SP = (u, side, t) => scr(P3(u, side, t));

  // ---- the lines of the hull on the sheet
  const NU = 48;
  const gN = [], gF = [], sil = [], tsil = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    gN.push(SP(u, -1, 1)); gF.push(SP(u, 1, 1));
    let best = null, bt = 0;
    for (let t = 0; t <= 1.0001; t += 0.04) { const p = SP(u, -1, t); if (!best || p[1] > best[1]) { best = p; bt = t; } }
    sil.push(best); tsil.push(bt);
  }
  const flat = a => { const o = []; for (const p of a) o.push(p[0], p[1]); return o; };
  const rev = a => a.slice().reverse();
  const hullPoly = A.poly(flat(gN.concat(rev(sil))));
  const inPoly = A.poly(flat(gF.concat(rev(gN))));
  const transom = (() => { const a = []; for (let t = 1; t >= 0; t -= 0.1) a.push(SP(0, -1, t)); for (let t = 0; t <= 1.0001; t += 0.1) a.push(SP(0, 1, t)); return a; })();
  const transomPoly = A.poly(flat(transom));
  const along = (arr, x) => { // y of a left-to-right-ish screen chain at x (chains run stern (right) to bow (left))
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i], b = arr[i + 1];
      if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return null;
  };
  const X0 = Math.min(...sil.map(p => p[0]), ...gN.map(p => p[0])), X1 = Math.max(...transom.map(p => p[0]), ...sil.map(p => p[0]));
  Wd.boat = { gN, gF, sil, X0, X1, SP, P3, scr, hullPoly, inPoly, L, at3: (xl, vv, w) => scr(world3(xl, vv, w)) };
  const lowY = x => { const y = along(sil, x); if (y !== null) return y; if (x > sil[0][0] && x <= X1) { let m = -1e9; for (const p of transom) if (Math.abs(p[0] - x) < 6 && p[1] > m) m = p[1]; return m > 0 ? m : null; } return null; };
  const topY = x => { const y = along(gF, x); return y === null ? along(gN, x) : y; };
  Wd.keep.push((x, y) => x > X0 - 1 && x < X1 + 1 && (hullPoly.inside(x, y) || inPoly.inside(x, y) || transomPoly.inside(x, y)));
  // flowers: hidden under her, or standing in front of her
  (Wd.occ = Wd.occ || []).push(function (f) {
    if (f.x < X0 - 2 || f.x > X1 + 2) return null;
    const lo = lowY(f.x), hi = topY(f.x);
    if (lo === null || hi === null) return null;
    if (f.y >= lo - 3.5) return f.y < lo + 60 ? 'front' : null;
    if (f.y > hi + 2) return 'skip';
    return null;
  });

  const axAng = Math.atan2(gN[NU][1] - gN[0][1], gN[NU][0] - gN[0][0]);   // direction of the boat on the sheet (stern -> bow)

  function chain(u0, u1, side, t, n) { const o = []; for (let i = 0; i <= n; i++) { const p = SP(u0 + (u1 - u0) * i / n, side, typeof t === 'function' ? t(u0 + (u1 - u0) * i / n) : t); o.push(p[0], p[1]); } return o; }
  // draw the parts of a polyline that satisfy a test, as separate strokes
  function runs(xy, ok, fn) {
    let cur = [];
    for (let i = 0; i < xy.length; i += 2) {
      if (ok(xy[i], xy[i + 1], i / 2)) cur.push(xy[i], xy[i + 1]);
      else { if (cur.length >= 4) fn(cur); cur = []; }
    }
    if (cur.length >= 4) fn(cur);
  }
  // the sun on a facing
  const sunOn = n => clamp(n[0] * Wd.SUN[0] + n[1] * Wd.SUN[1] + n[2] * Wd.SUN[2], -1, 1);

  S.boat = function (C, rng) {
    // ---------------- her shadow, lying on the flowers behind and to the right
    {
      const pts = [];
      const cast = p => { const t = Math.max(0, p[1]) / Wd.SUN[1]; return scr([p[0] - Wd.SUN[0] * t, 0, p[2] - Wd.SUN[2] * t]); };
      for (let i = 0; i <= NU; i += 2) { const u = i / NU; pts.push(cast(P3(u, 1, 1)), cast(P3(u, -1, 1)), scr(P3(u, -1, 0.3)), scr(P3(u, 1, 0.3))); }
      // convex hull
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of rev(pts)) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      const hull = A.poly(flat(lo.slice(0, -1).concat(up.slice(0, -1))));
      const b = hull.bbox, R = A.region([b[0] - 6, b[1] - 6, b[2] + 6, b[3] + 6], (x, y) => hull.inside(x + (vn(x / 9, y / 9, 31) - 0.5) * 7, y + (vn(x / 9, y / 9, 37) - 0.5) * 5) && !inPoly.inside(x, y) && !hullPoly.inside(x, y));
      A.scribble(C, rng, R, { tool: T.crayon, col: K.spruce, w: 7, gap: 5.2, ang: axAng + 0.1, p: 0.52, over: 2, under: 1, run: 5, wob: 0.8 });
      A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.5) ? K.slate : r.chance(0.6) ? K.pine : K.bluepencil), w: 1.6, gap: 2.6, ang: 0.75, p: 0.8, seg: 30 });
      A.hatch(C, rng, R, { tool: T.pencil, col: K.pine, w: 1.5, gap: 4.2, ang: -0.4, p: 0.6, seg: 22, skip: 0.2 });
    }

    // ---------------- inside: yellow paint, worn through to the wood along the bottom
    const inside = (x, y) => inPoly.inside(x, y);
    {
      const b = inPoly.bbox, R = A.region(b, inside);
      A.scribble(C, rng, R, { tool: T.crayon, col: K.butter, w: 7, gap: 3.4, ang: axAng, p: 0.95, over: 0.5, under: 0.5, run: 6, wob: 0.6 });
      A.scribble(C, rng, R, { tool: T.crayon, col: K.mustard, w: 6, gap: 5, ang: axAng + 0.06, p: 0.6, over: 0, under: 1.5, run: 4, wob: 0.6, skip: 0.2 });
    }
    // shade inside: the near side and the bow throw it. Work station by station.
    const shadeAt = (u, side, t) => { // 0 lit .. 1 dark
      let s = 0;
      s += side < 0 ? 0.85 : 0.75 * ss(0.5, 0.0, t) * 0.8;         // floor near the low side sits under the gunwale
      s += 0.8 * ss(0.7, 0.98, u);                                  // up in the bow
      s -= side > 0 ? 0.55 * ss(0.3, 0.9, t) : 0;                   // the far planking faces the sun
      return clamp(s, 0, 1);
    };
    for (let i = 0; i < 150; i++) { // small strokes following the planks
      const u = rng.r(0.02, 0.98), side = rng.chance(0.72) ? 1 : -1, t = rng.r(0.03, 0.98);
      const sh = shadeAt(u, side, t) + rng.g() * 0.12;
      const du = rng.r(0.04, 0.12), xy = chain(u, Math.min(0.995, u + du), side, t, 5);
      const mx = xy[4], my = xy[5];
      if (!inside(mx, my)) continue;
      const col = sh > 0.7 ? (rng.chance(0.5) ? K.umber : K.olive) : sh > 0.42 ? K.ochre : sh > 0.2 ? (rng.chance(0.5) ? K.mustard : K.straw) : rng.chance(0.6) ? K.butter : K.cream;
      runs(xy, inside, q => C.line(rng, sh > 0.42 ? T.pencil : T.crayonTip, col, q, sh > 0.42 ? 1.7 : 2.6, sh > 0.42 ? 0.8 : 0.7, { wob: 0.4, step: 3 }));
    }
    for (let i = 0; i < 260; i++) { // pencil hatching for the deep shade
      const u = rng.r(0.02, 0.99), side = rng.chance(0.5) ? 1 : -1, t = rng.r(0.0, 0.95);
      if (shadeAt(u, side, t) + rng.g() * 0.1 < 0.6) continue;
      const p = SP(u, side, t);
      if (!inside(p[0], p[1])) continue;
      const Ln = rng.r(4, 9);
      C.line(rng, T.pencil, rng.chance(0.55) ? K.walnut : rng.chance(0.5) ? K.umber : K.olive, [p[0] - Ln * 0.5, p[1] + Ln * 0.42, p[0] + Ln * 0.5, p[1] - Ln * 0.42], 1.4, 0.72, { wob: 0.3 });
    }
    { // the floor tucked in behind the near gunwale is the darkest place in her; the bow is dim too
      const b = inPoly.bbox;
      const deep = (x, y) => { const g = along(gN, x); if (g === null) return 0; return ss(17, 3, g - y) * (0.55 + 0.45 * ss(X0, X0 + 120, x)) + 0.75 * ss(X0 + 95, X0 + 25, x) * ss(34, 8, g - y); };
      A.scribble(C, rng, A.region(b, (x, y) => inside(x, y) && deep(x, y) + (vn(x / 9, y / 4, 21) - 0.5) * 0.3 > 0.42), { tool: T.crayonTip, col: K.ochre, w: 3.6, gap: 2.6, ang: axAng, p: 0.8, over: 0, under: 0.5, run: 5, wob: 0.4 });
      A.hatch(C, rng, A.region(b, (x, y) => inside(x, y) && deep(x, y) > 0.5), { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.5) ? K.umber : r.chance(0.5) ? K.olive : K.walnut), w: 1.5, gap: 2.2, ang: axAng - 0.9, p: 0.75, seg: 9 });
      A.hatch(C, rng, A.region(b, (x, y) => inside(x, y) && deep(x, y) > 0.72), { tool: T.pencil, col: K.walnut, w: 1.4, gap: 3, ang: axAng + 0.5, p: 0.6, seg: 8, skip: 0.2 });
    }
    // bare boards down the middle
    for (let k = 0; k < 5; k++) {
      const tt = 0.05 + k * 0.045, side = k % 2 ? 1 : -1;
      runs(chain(0.06, 0.86, side, tt, 40), inside, q => C.line(rng, T.crayonTip, rng.chance(0.5) ? K.bone : K.drift, q, 2.6, 0.62, { wob: 0.5, pj: 0.5 }));
    }
    // plank seams
    for (const side of [1, -1]) for (const tt of [0.26, 0.46, 0.66, 0.86]) {
      runs(chain(0.0, 0.99, side, tt, 60), inside, q => { C.line(rng, T.pencil, K.ochre, q, 1.3, 0.8, { wob: 0.45, wl: 40 }); if (rng.chance(0.7)) C.line(rng, T.pencil, K.umber, q.map((z, j) => (j & 1 ? z + 0.9 : z)), 1.0, 0.45, { wob: 0.6, wl: 30, pj: 0.7 }); });
    }
    // ribs
    for (let u = 0.09; u < 0.97; u += 0.104 + rng.g() * 0.006) {
      for (const side of [1, -1]) {
        const xy = []; for (let t = 0.02; t <= 1.0; t += 0.07) { const p = SP(u, side, t); xy.push(p[0], p[1]); }
        runs(xy, inside, q => { C.line(rng, T.crayonTip, side > 0 ? K.cream : K.ochre, q, 2.4, 0.85, { wob: 0.3, step: 3 }); C.line(rng, T.pencil, K.umber, q.map((z, j) => (j & 1 ? z : z + 1.5)), 1.1, 0.6, { wob: 0.35, step: 3 }); });
      }
    }

    // ---------------- a little water still in her, with the sky in it
    {
      const hw = 0.085, far = [], near = [];
      for (let u = 0.2; u <= 0.72; u += 0.02) {
        let tf = null, tn = null;
        for (let t = 0; t <= 1; t += 0.01) { const l = local(u, 1, t); if (tf === null && l[1] * sr + l[2] * cr - LIFT >= hw) tf = t; const m = local(u, -1, t); if (tn === null && m[1] * sr + m[2] * cr - LIFT >= hw && t > 0.25) tn = t; }
        if (tf === null) continue;
        far.push(SP(u, 1, tf)); near.push(SP(u, -1, tn === null ? 0.3 : tn));
      }
      if (far.length > 3) {
        const wp = A.poly(flat(far.concat(rev(near))));
        const inW = (x, y) => wp.inside(x, y) && inside(x, y + 2.5);
        const R = A.region(wp.bbox, inW);
        A.scribble(C, rng, R, { tool: T.crayonTip, col: K.tile, w: 4, gap: 2.2, ang: axAng, p: 0.95, over: 0, under: 0.5, run: 8, wob: 0.3 });
        A.scribble(C, rng, R, { tool: T.crayonTip, col: K.milk, w: 3.5, gap: 4.4, ang: axAng + 0.05, p: 0.7, over: 0, under: 1, run: 3, wob: 0.3, skip: 0.3 });
        // the far edge: the planking, upside down and dark
        const fe = flat(far);
        C.line(rng, T.pencil, K.walnut, fe.map((z, j) => (j & 1 ? z + 1.6 : z)), 1.6, 0.7, { wob: 0.4 });
        C.line(rng, T.pencil, K.olive, fe.map((z, j) => (j & 1 ? z + 3.4 : z)), 1.4, 0.5, { wob: 0.6 });
        C.line(rng, T.chalk, K.white, fe.map((z, j) => (j & 1 ? z + 0.2 : z)), 1.2, 0.8, { wob: 0.3, pj: 0.6 });
        // three small clouds in it
        for (let k = 0; k < 7; k++) {
          const u = rng.r(0.27, 0.66), a = SP(u, 1, 0.12), b2 = SP(u, -1, 0.22), f = rng.r(0.25, 0.7);
          const x = a[0] + (b2[0] - a[0]) * f, y = a[1] + (b2[1] - a[1]) * f;
          if (!inW(x, y)) continue;
          C.line(rng, T.chalk, K.white, [x - rng.r(3, 7), y + 0.5, x + rng.r(3, 7), y - 0.8], rng.r(1.8, 3), 0.85, { wob: 0.3 });
        }
        // and two petals afloat
        for (let k = 0; k < 4; k++) { const u = rng.r(0.3, 0.6), a = SP(u, 1, 0.1), b2 = SP(u, -1, 0.2), f = rng.r(0.3, 0.6), x = a[0] + (b2[0] - a[0]) * f, y = a[1] + (b2[1] - a[1]) * f; if (inW(x, y)) C.dab(T.chalk, K.white, x, y, 1.8, 0.95); }
      }
    }

    // ---------------- thwarts: bare grey wood
    const seat = (u0, u1, hf) => {
      const edge = (u, side) => { const h = sheer(u), k = keel(u), w = k + (h - k) * hf; let t = 0; while (t < 1 && local(u, 1, t)[2] < w) t += 0.01; const l = local(u, side, t); return scr(world3(l[0], l[1], w)); };
      const a = edge(u0, 1), b = edge(u1, 1), c = edge(u1, -1), d = edge(u0, -1);
      const pl = A.poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
      const R = A.region(pl.bbox, (x, y) => pl.inside(x, y) && inside(x, y));
      // its shadow on the bottom, thrown right and back
      const off = [9, -2.5];
      const Rs = A.region([pl.bbox[0] + off[0] - 2, pl.bbox[1] + off[1] - 2, pl.bbox[2] + off[0] + 14, pl.bbox[3] + off[1] + 6], (x, y) => { for (let q = 0.3; q <= 1.6; q += 0.42) if (pl.inside(x - off[0] * q, y - off[1] * q + 4)) return inside(x, y) && !pl.inside(x, y); return false; });
      A.hatch(C, rng, Rs, { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.6) ? K.walnut : K.olive), w: 1.5, gap: 2.1, ang: 0.8, p: 0.78, seg: 12 });
      A.scribble(C, rng, R, { tool: T.crayonTip, col: K.bone, w: 4, gap: 2.1, ang: Math.atan2(d[1] - a[1], d[0] - a[0]), p: 0.95, over: 0, under: 0, run: 6, wob: 0.3 });
      A.scribble(C, rng, R, { tool: T.crayonTip, col: K.drift, w: 3, gap: 4.6, ang: Math.atan2(d[1] - a[1], d[0] - a[0]) + 0.04, p: 0.6, over: 0, under: 0.5, run: 2, wob: 0.3, skip: 0.25 });
      for (let k = 0; k < 5; k++) { const f = rng.r(0.1, 0.9), p0 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], p1 = [d[0] + (c[0] - d[0]) * f, d[1] + (c[1] - d[1]) * f]; runs(A.curve([p0[0], p0[1], (p0[0] + p1[0]) / 2 + rng.g(), (p0[1] + p1[1]) / 2, p1[0], p1[1]], 6), inside, q => C.line(rng, T.pencil, K.umber, q, 1.0, 0.5, { wob: 0.4 })); }
      for (const e of [[a, d], [b, c], [a, b]]) runs([e[0][0], e[0][1], (e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2, e[1][0], e[1][1]], (x, y) => inside(x, y), q => C.line(rng, T.pencil, K.walnut, q, 1.4, 0.78, { wob: 0.4 }));
      // front edge catches the light
      runs([b[0], b[1] - 0.8, c[0], c[1] - 0.8], inside, q => C.line(rng, T.chalk, K.white, q, 1.2, 0.6, { wob: 0.3 }));
    };
    seat(0.01, 0.13, 0.66); seat(0.335, 0.405, 0.64); seat(0.61, 0.675, 0.66);
    { // breasthook: the little triangle in the bow
      const a = SP(0.9, 1, 0.97), b = SP(0.9, -1, 0.97), c = SP(0.995, 1, 1), pl = A.poly([a[0], a[1], b[0], b[1], c[0], c[1]]);
      A.scribble(C, rng, A.region(pl.bbox, (x, y) => pl.inside(x, y) && inside(x, y)), { tool: T.crayonTip, col: K.bone, w: 3, gap: 1.8, ang: axAng + 1.2, p: 0.9, over: 0, under: 0, run: 5, wob: 0.2 });
      runs([a[0], a[1], b[0], b[1]], inside, q => C.line(rng, T.pencil, K.walnut, q, 1.3, 0.75, { wob: 0.3 }));
    }

    // ---------------- flowers that seeded themselves in the bow (their feet are down out of sight)
    const bowFlowers = [];
    for (let k = 0; k < 11; k++) {
      const u = rng.r(0.66, 0.9), f = rng.r(0.2, 0.75), a = SP(u, 1, 0.3), b = SP(u, -1, 0.3);
      const bx = a[0] + (b[0] - a[0]) * f, by = a[1] + (b[1] - a[1]) * f;
      const hgt = rng.r(46, 84), tx = bx + rng.g() * 7 - 3, ty = by - hgt;
      const gy = along(gN, tx);
      if (gy !== null && ty > gy - 5) continue;
      bowFlowers.push({ bx, by, tx, ty, s: rng.r(9, 13.5) });
    }
    bowFlowers.sort((p, q) => p.ty - q.ty);
    for (const q of bowFlowers) {
      const st = A.curve([q.tx, q.ty, (q.bx + q.tx) / 2 + rng.g() * 3, (q.by + q.ty) / 2, q.bx, q.by], 10);
      const vis = (x, y) => { const g = along(gN, x); return g === null || y < g - 2.5; };
      runs(st, vis, z => { C.line(rng, T.crayonTip, rng.chance(0.5) ? K.moss : K.sap, z, 1.9, 0.9, { wob: 0.3, step: 3, pe: 0.9 }); C.line(rng, T.pencil, K.spruce, z.map((w, j) => (j & 1 ? w : w + 1.1)), 1.0, 0.6, { wob: 0.3, step: 3 }); });
      for (let l = 0; l < 2; l++) { const i = 2 * rng.i(3, 8), x = st[i], y = st[i + 1]; if (vis(x, y + 4)) Wd.flick(C, rng, T.crayonTip, rng.pick([K.sap, K.pist, K.moss]), x, y + 3, rng.r(8, 16), (l ? 1 : -1) * rng.r(0.5, 1.1), 2.2, 0.85); }
    }
    Wd.boat.bowFlowers = bowFlowers;

    // ---------------- outside: red
    {
      const b = hullPoly.bbox, R = A.region(b, (x, y) => hullPoly.inside(x, y));
      A.scribble(C, rng, R, { tool: T.lumber, col: K.red, w: 8, gap: 3.6, ang: axAng + 0.02, p: 0.95, over: 0.6, under: 0.4, run: 7, wob: 0.6 });
      A.scribble(C, rng, R, { tool: T.lumber, col: v(K.red, rng, 0.02), w: 7, gap: 5.5, ang: axAng - 0.07, p: 0.8, over: 0.3, under: 1, run: 4, wob: 0.6, skip: 0.15 });
      // where she turns under, and toward the stern: the darker red, then pencil
      const under = (x, y) => { const g = along(gN, x), s = along(sil, x); if (g === null || s === null) return 0; const f = (y - g) / Math.max(1, s - g); return ss(0.45, 1.0, f) * 0.8 + 0.5 * ss(X0 + (X1 - X0) * 0.55, X1, x); };
      A.scribble(C, rng, A.region(b, (x, y) => R.inside(x, y) && under(x, y) + (vn(x / 14, y / 5, 5) - 0.5) * 0.4 > 0.45), { tool: T.lumber, col: K.brick, w: 6, gap: 4.2, ang: axAng + 0.04, p: 0.75, over: 0, under: 0.5, run: 5, wob: 0.6 });
      A.hatch(C, rng, A.region(b, (x, y) => R.inside(x, y) && under(x, y) > 0.62), { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.6) ? K.walnut : K.rust), w: 1.5, gap: 2.6, ang: 0.85, p: 0.7, seg: 11, skip: 0.1 });
      // sun on the shoulder of the bow
      A.scribble(C, rng, A.region(b, (x, y) => { const g = along(gN, x); return R.inside(x, y) && g !== null && y - g < 15 && x < X0 + (X1 - X0) * 0.42 && vn(x / 20, y / 6, 9) > 0.4; }), { tool: T.chalk, col: K.salmon, w: 4, gap: 4.6, ang: axAng, p: 0.5, over: 0, under: 1, run: 3, wob: 0.5, skip: 0.2 });
      // laps of the planking
      for (const tt of [0.3, 0.44, 0.58, 0.72, 0.86]) {
        const xy = [], us = [];
        for (let i = 0; i <= 64; i++) { const u = i / 64 * 0.995; if (tt <= tsil[Math.round(u * NU)] + 0.04) { xy.push(-999, -999); continue; } const p = SP(u, -1, tt); xy.push(p[0], p[1]); }
        runs(xy, (x, y) => x > -900 && hullPoly.inside(x, y), q => {
          C.line(rng, T.pencil, K.walnut, q, 1.5, 0.82, { wob: 0.45, wl: 50 });
          C.line(rng, T.pencil, K.brick, q.map((z, j) => (j & 1 ? z + 1.5 : z)), 1.6, 0.6, { wob: 0.5, wl: 40 });
          if (rng.chance(0.8)) C.line(rng, T.chalk, K.salmon, q.map((z, j) => (j & 1 ? z - 1.6 : z)), 1.2, 0.5, { wob: 0.5, wl: 40, pj: 0.7 });
        });
      }
      // the white sheer strake, flaking
      {
        const top = chain(0, 0.995, -1, 1, 64), botc = chain(0, 0.995, -1, 0.87, 64), ban = [];
        for (let i = 0; i < top.length; i += 2) ban.push(top[i], top[i + 1]);
        for (let i = botc.length - 2; i >= 0; i -= 2) ban.push(botc[i], botc[i + 1]);
        const bp = A.poly(ban);
        A.scribble(C, rng, A.region(bp.bbox, (x, y) => bp.inside(x, y) && vn(x / 7, y / 3, 13) > 0.2), { tool: T.chalk, col: K.white, w: 3.6, gap: 1.9, ang: axAng, p: 0.95, over: 1, under: 0.5, run: 6, wob: 0.4 });
        A.scribble(C, rng, A.region(bp.bbox, (x, y) => bp.inside(x, y)), { tool: T.crayonTip, col: K.white, w: 3, gap: 2.6, ang: axAng + 0.03, p: 0.8, over: 0.5, under: 0.5, run: 4, wob: 0.4, skip: 0.2 });
      }
      // weather: bare patches, scrapes, the green tide-mark she still wears
      for (let k = 0; k < 26; k++) {
        const u = rng.r(0.04, 0.95), tt = rng.r(tsil[Math.round(u * NU)] + 0.08, 0.84), p = SP(u, -1, tt);
        if (!hullPoly.inside(p[0], p[1])) continue;
        const Ln = rng.r(3, 13), q = SP(Math.min(0.99, u + Ln / 330), -1, tt);
        C.line(rng, T.chalk, rng.chance(0.5) ? K.bone : K.salmon, [p[0], p[1], q[0], q[1]], rng.r(1.4, 3.2), 0.7, { wob: 0.5, pj: 0.7 });
      }
      for (let k = 0; k < 70; k++) {
        const u = rng.r(0.03, 0.97), tt = tsil[Math.round(u * NU)] + rng.r(0.03, 0.2), p = SP(u, -1, tt);
        if (!hullPoly.inside(p[0], p[1])) continue;
        C.line(rng, T.pencil, rng.chance(0.6) ? K.moss : K.spruce, [p[0], p[1], p[0] + rng.r(2, 8) * Math.cos(axAng), p[1] + rng.r(2, 8) * Math.sin(axAng)], 1.6, 0.6, { wob: 0.3 });
      }
      for (let k = 0; k < 16; k++) { // nail heads weeping rust
        const u = rng.r(0.05, 0.95), tt = rng.pick([0.44, 0.58, 0.72, 0.86]) + 0.03, p = SP(u, -1, tt);
        if (!hullPoly.inside(p[0], p[1] + 3)) continue;
        C.dab(T.pencil, K.walnut, p[0], p[1], 1.5, 0.9);
        if (rng.chance(0.6)) C.line(rng, T.pencil, K.rust, [p[0], p[1] + 0.5, p[0] + rng.g() * 0.5, p[1] + rng.r(3, 7)], 1.2, 0.55, { wob: 0.2 });
      }
      // her number, painted on by hand a long time ago
      {
        const o = SP(0.3, -1, 0.56), cl = Math.cos(axAng), sl = Math.sin(axAng), sc = 1.3;
        const map = (px, py) => [o[0] + px * sc * cl - py * sc * 0.16, o[1] + px * sc * sl + py * sc * 0.95];
        A.scribble(C, rng, A.region([o[0] - 12, o[1] - 10, o[0] + 12, o[1] + 10], (x, y) => Math.abs(x - o[0]) < 10 && Math.abs(y - o[1] - (x - o[0]) * Math.tan(axAng)) < 8 && hullPoly.inside(x, y)), { tool: T.lumber, col: K.red, w: 5, gap: 2.4, ang: axAng, p: 0.95, over: 1, under: 0, run: 5, wob: 0.4 });
        const seven = [[-4.6, -5.2], [3.6, -5.6], [4.2, -4.6], [0.6, 0.4], [-1.0, 5.6]];
        const mp = []; for (const q of seven) { const m = map(q[0], q[1]); mp.push(m[0], m[1]); }
        C.line(rng, T.pencil, K.brick, mp.map((z, j) => (j & 1 ? z + 1 : z + 1)), 1.4, 0.7, { wob: 0.3, step: 2.5 });
        C.line(rng, T.chalk, K.white, mp, 2.3, 0.95, { wob: 0.35, pe: 0.85, step: 2.5, a0: 0.05, a1: 0.05 });
        C.line(rng, T.crayonTip, K.white, mp, 1.7, 0.9, { wob: 0.4, pe: 0.85, step: 2.5, a0: 0.05, a1: 0.05 });
      }
    }

    // ---------------- transom, in shade
    {
      const R = A.region(transomPoly.bbox, (x, y) => transomPoly.inside(x, y) && !inPoly.inside(x, y));
      A.scribble(C, rng, R, { tool: T.lumber, col: K.brick, w: 5, gap: 2.4, ang: 1.45, p: 0.95, over: 0.4, under: 0.3, run: 6, wob: 0.4 });
      A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.65) ? K.walnut : K.bluepencil), w: 1.5, gap: 2.3, ang: 0.8, p: 0.75, seg: 14 });
      C.line(rng, T.pencil, K.walnut, flat(transom), 1.5, 0.85, { wob: 0.5, wl: 30 });
    }

    // ---------------- rails, stem, the outline said twice
    const gNf = flat(gN), gFf = flat(gF), silf = flat(sil);
    C.line(rng, T.crayonTip, K.bone, gFf.map((z, j) => (j & 1 ? z + 1.0 : z)), 2.6, 0.85, { wob: 0.4, wl: 60 });
    C.line(rng, T.pencil, K.walnut, gFf.map((z, j) => (j & 1 ? z - 0.6 : z)), 1.5, 0.85, { wob: 0.6, wl: 70 });
    C.line(rng, T.pencil, K.umber, gFf.map((z, j) => (j & 1 ? z + 2.6 : z)), 1.1, 0.6, { wob: 0.7, wl: 50 });
    C.line(rng, T.crayonTip, K.white, gNf.map((z, j) => (j & 1 ? z - 0.6 : z)), 3.2, 0.92, { wob: 0.4, wl: 60 });
    C.line(rng, T.crayonTip, K.bone, gNf.map((z, j) => (j & 1 ? z + 1.2 : z)), 1.6, 0.6, { wob: 0.5, wl: 40, pj: 0.6 });
    C.line(rng, T.pencil, K.walnut, gNf.map((z, j) => (j & 1 ? z - 2.3 : z)), 1.5, 0.9, { wob: 0.6, wl: 70 });
    C.line(rng, T.pencil, K.walnut, gNf.map((z, j) => (j & 1 ? z + 2.2 : z)), 1.2, 0.7, { wob: 0.7, wl: 50 });
    C.line(rng, T.pencil, K.walnut, silf, 1.7, 0.9, { wob: 0.8, wl: 60 });
    C.line(rng, T.pencil, K.walnut, silf.map((z, j) => (j & 1 ? z + 1.2 + rng.g() * 0.3 : z + 1)), 1.2, 0.5, { wob: 1.2, wl: 45 });
    { // stem post
      const st = []; for (let t = 0; t <= 1.12; t += 0.08) { const l = local(1, 1, Math.min(1, t)); const p = scr(world3(l[0] + (t > 1 ? 0.02 : 0), 0, l[2] + (t > 1 ? (t - 1) * 0.5 : 0))); st.push(p[0], p[1]); }
      C.line(rng, T.crayonTip, K.umber, st, 3.2, 0.92, { wob: 0.3, pe: 0.9 });
      C.line(rng, T.pencil, K.walnut, st.map((z, j) => (j & 1 ? z : z - 1.6)), 1.4, 0.85, { wob: 0.4 });
      C.line(rng, T.chalk, K.bone, st.map((z, j) => (j & 1 ? z : z + 0.2)), 1.1, 0.6, { wob: 0.3 });
    }
    // rowlock blocks, empty
    for (const side of [-1, 1]) {
      const a = SP(0.43, side, 1), b = SP(0.5, side, 1);
      C.line(rng, T.crayonTip, K.drift, [a[0], a[1] - 1.5, b[0], b[1] - 1.5], 3.4, 0.9, { wob: 0.2, pe: 0.9 });
      C.line(rng, T.pencil, K.walnut, [a[0], a[1] - 3.2, b[0], b[1] - 3.2], 1.2, 0.8, { wob: 0.3 });
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3];
      C.line(rng, T.pencil, K.walnut, [m[0] - 2.4, m[1] - 5.5, m[0] - 2, m[1] - 0.5, m[0] + 2, m[1] - 0.5, m[0] + 2.4, m[1] - 5.5], 1.5, 0.9, { wob: 0.2, step: 2 });
    }
    for (const q of bowFlowers) Wd.flower(C, rng, q.tx, q.ty, q.s, 0.9, true);
    Wd.boat.sternCleat = SP(0.03, -1, 1);
    Wd.boat.sternTop = SP(0.0, 1, 1);
  };
})(typeof self !== 'undefined' ? self : globalThis);
