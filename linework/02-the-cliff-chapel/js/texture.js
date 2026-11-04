// texture.js - hand-made engraving texture marks: pits, fossils, fracture
// hairlines, solution runnels, lichen speckle, drip stains, plate grain,
// cross-hatch helpers. Every mark is a real ink or plate mark (no overlays),
// and every mark is darker than the surface it sits on, so texture never lifts
// the value structure.
(function () {
  'use strict';
  const LW = window.LW;
  const T = (LW.tex = {});
  const LA = Math.atan2(LW.LIGHT2[1], LW.LIGHT2[0]); // angle toward the light (upper left)

  // a small hollow: dark crescent on its light side (the wall there faces away from the sun)
  T.pit = function (pen, x, y, r, w, sq = 0.75) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const a = LA - 1.3 + (2.6 * k) / 6;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * sq]);
    }
    pen.line(pts, w, 0.5, 0.1);
  };
  // an irregular dark hole (filled), its shadow pooled toward the light side
  T.hole = function (pen, x, y, r, rnd) {
    const pts = [];
    const n = 7, s0 = rnd() * 9;
    const ox = Math.cos(LA) * r * 0.25, oy = Math.sin(LA) * r * 0.25;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * LW.TAU;
      const rr = r * 0.6 * (0.6 + 0.6 * (0.5 + 0.5 * LW.noise(Math.cos(a) + s0, Math.sin(a) + s0)));
      pts.push([x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr * 0.7]);
    }
    pen.poly(pts);
  };
  // dry, broken short strokes along a direction (worn stone surface)
  T.dry = function (pen, bb, inside, n, rnd, ang, len, w, dark) {
    for (let k = 0; k < n; k++) {
      const x = rnd.range(bb.x0, bb.x1), y = rnd.range(bb.y0, bb.y1);
      if (!inside(x, y)) continue;
      if (dark && rnd() > dark(x, y)) continue;
      const a = ang + rnd.gauss() * 0.08, L = rnd.range(len[0], len[1]);
      const pts = [];
      for (let s = 0; s <= L; s += 2) {
        const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
        if (!inside(px, py)) break;
        pts.push([px + LW.noise3(px * 0.2, py * 0.2) * 0.5, py]);
      }
      if (pts.length < 3) continue;
      // broken into two or three dashes like a dry pen
      let run = [];
      for (let i = 0; i < pts.length; i++) {
        if (LW.noise(pts[i][0] * 0.35 + k, pts[i][1] * 0.35) > 0.45) { if (run.length > 1) pen.line(run, w, 0.45, 0.15); run = []; } else run.push(pts[i]);
      }
      if (run.length > 1) pen.line(run, w, 0.45, 0.15);
    }
  };
  // clustered pitting
  T.pits = function (pen, bb, inside, n, rnd, o = {}) {
    const rr = o.r || [1.0, 3.2], ww = o.w || [0.7, 1.5];
    let made = 0;
    for (let c = 0; c < n && made < n; c++) {
      const cx = rnd.range(bb.x0, bb.x1), cy = rnd.range(bb.y0, bb.y1);
      const m = rnd.int(1, o.cluster || 6);
      const spread = o.spread || 9;
      for (let k = 0; k < m; k++) {
        const x = cx + rnd.gauss() * spread, y = cy + rnd.gauss() * spread * 0.7;
        if (!inside(x, y)) continue;
        if (o.dark && rnd() > o.dark(x, y)) continue;
        const r = rnd.range(rr[0], rr[1]);
        if (r < 1.4) pen.dot(x, y, r * 0.6);
        else if (rnd() < 0.5) T.hole(pen, x, y, r, rnd);
        else T.pit(pen, x, y, r, rnd.range(ww[0], ww[1]));
        made++;
      }
    }
  };
  // fine plate grain: tiny ink specks
  T.grain = function (pen, bb, inside, n, rnd, r = [0.35, 0.8], dark) {
    for (let k = 0; k < n; k++) {
      const x = rnd.range(bb.x0, bb.x1), y = rnd.range(bb.y0, bb.y1);
      if (inside && !inside(x, y)) continue;
      if (dark && rnd() > dark(x, y)) continue;
      pen.dot(x, y, rnd.range(r[0], r[1]));
    }
  };
  // branching hairline fracture
  T.fracture = function (pen, x, y, a, len, w, rnd, depth = 1, inside = null, step = 5) {
    let run = [[x, y]];
    const flush = () => { if (run.length > 1) pen.line(run, (t) => w * (1 - 0.65 * t), 0.25, 0.2); run = []; };
    const n = Math.max(2, Math.round(len / step));
    for (let m = 0; m < n; m++) {
      a += rnd.gauss() * 0.38;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      if (inside && !inside(x, y)) { flush(); break; }
      run.push([x, y]);
      if (depth > 0 && rnd() < 0.14) T.fracture(pen, x, y, a + rnd.sign() * rnd.range(0.5, 1.2), len * rnd.range(0.25, 0.55), w * 0.7, rnd, depth - 1, inside, step);
    }
    flush();
  };
  // solution runnels (rillenkarren): a group of sinuous grooves running down the fall line
  T.runnels = function (pen, x, y, fall, n, len, sp, rnd, inside, lw = 1) {
    for (let k = 0; k < n; k++) {
      let px = x + (k - n / 2) * sp + rnd.gauss() * sp * 0.2, py = y + rnd.range(0, 4);
      let a = fall + rnd.gauss() * 0.05;
      const L = len * rnd.range(0.55, 1.1);
      const dk = [], lt = [];
      const seed = rnd() * 50;
      for (let s = 0; s < L; s += 3) {
        a = fall + 0.18 * LW.noise(s * 0.04 + seed, k);
        px += Math.cos(a) * 3; py += Math.sin(a) * 3;
        if (!inside(px, py)) break;
        dk.push([px, py]);
        lt.push([px + Math.cos(LA) * -2.2, py + Math.sin(LA) * -2.2]);
      }
      if (dk.length > 3) {
        pen.line(dk, 1.25 * lw, 0.4, 0.1); // shadowed wall of the groove
        pen.line(lt, 0.45 * lw, 0.5, 0.1); // far lip
      }
    }
  };
  // ---- fossil traces (limestone): ammonite, bivalve, crinoid stem, shell hash
  T.ammonite = function (pen, x, y, R, rot, w, sq = 0.8) {
    const r0 = R * 0.07, turns = 3.0, TAU = LW.TAU;
    const b = Math.log(R / r0) / (turns * TAU);
    const rad = (t) => r0 * Math.exp(b * t);
    const P = (t, r) => [x + Math.cos(t + rot) * r, y + Math.sin(t + rot) * r * sq];
    const sp = [];
    for (let t = 0; t <= turns * TAU; t += 0.22) sp.push(P(t, rad(t)));
    pen.line(sp, w, 0.15, 0.3);
    for (let t = (turns - 1) * TAU; t <= turns * TAU; t += 0.32) {
      const a = P(t - TAU, rad(t - TAU) * 1.04), c = P(t, rad(t) * 0.97);
      pen.line([a, c], w * 0.6, 0.3);
    }
  };
  T.bivalve = function (pen, x, y, R, rot, w, sq = 0.8) {
    const P = (a, r) => [x + Math.cos(a + rot) * r, y + Math.sin(a + rot) * r * sq];
    const rim = [];
    for (let a = -1.15; a <= 1.15001; a += 0.115) rim.push(P(a, R * (1 - 0.12 * a * a)));
    pen.line([P(-1.4, R * 0.18)].concat(rim, [P(1.4, R * 0.18)]), w, 0.1);
    for (let a = -0.9; a <= 0.9001; a += 0.3) pen.line([P(a * 0.3, R * 0.12), P(a, R * 0.92 * (1 - 0.12 * a * a))], w * 0.55, 0.3);
    const g = [];
    for (let a = -1.0; a <= 1.0001; a += 0.15) g.push(P(a, R * 0.6 * (1 - 0.1 * a * a)));
    pen.line(g, w * 0.5, 0.3);
  };
  T.crinoid = function (pen, x, y, L, rot, w) {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const hw = Math.max(1.6, L * 0.09);
    pen.line([[x - sa * hw, y + ca * hw], [x - sa * hw + ca * L, y + ca * hw + sa * L]], w * 0.7, 0.15);
    pen.line([[x + sa * hw, y - ca * hw], [x + sa * hw + ca * L, y - ca * hw + sa * L]], w * 0.7, 0.15);
    for (let s = 0; s <= L; s += 2.6) pen.line([[x - sa * hw + ca * s, y + ca * hw + sa * s], [x + sa * hw + ca * s, y - ca * hw + sa * s]], w * 0.5, 0.1);
  };
  T.shellHash = function (pen, bb, inside, n, rnd, w = 0.8) {
    for (let k = 0; k < n; k++) {
      const x = rnd.range(bb.x0, bb.x1), y = rnd.range(bb.y0, bb.y1);
      if (!inside(x, y)) continue;
      const r = rnd.range(1.5, 4), a0 = rnd() * LW.TAU;
      const pts = [];
      for (let a = 0; a <= 2.2; a += 0.4) pts.push([x + Math.cos(a0 + a) * r, y + Math.sin(a0 + a) * r * 0.7]);
      pen.line(pts, w, 0.4, 0.1);
    }
  };
  T.fossil = function (pen, x, y, s, rnd, w = 0.9) {
    const k = rnd();
    if (k < 0.4) T.ammonite(pen, x, y, s, rnd() * LW.TAU, w);
    else if (k < 0.75) T.bivalve(pen, x, y, s, -Math.PI / 2 + rnd.gauss() * 0.8, w);
    else T.crinoid(pen, x, y, s * 2.2, rnd.gauss() * 0.4 + (rnd() < 0.5 ? 0 : Math.PI), w);
  };
  // ---- lichen: speckled crustose patches (ochre, grey-green) with dark fruiting dots
  // fills go into per-colour pens supplied by the caller (so they are drawn in one go)
  T.lichen = function (fills, pen, cx, cy, r, rnd, sq = 0.6) {
    const fp = fills[rnd() < 0.55 ? 0 : 1];
    const nc = 2 + Math.floor(r / 6);
    for (let c = 0; c < nc; c++) { // a patch is a few merging colonies
      const ca = rnd() * LW.TAU, cd = Math.sqrt(rnd()) * r * 0.7;
      const ccx = cx + Math.cos(ca) * cd, ccy = cy + Math.sin(ca) * cd * sq, cr = r * rnd.range(0.35, 0.6);
      const n = Math.round(cr * cr * 0.35) + 5;
      for (let k = 0; k < n; k++) {
        const a = rnd() * LW.TAU, d = Math.sqrt(rnd()) * cr;
        const x = ccx + Math.cos(a) * d, y = ccy + Math.sin(a) * d * sq;
        fp.dot(x, y, rnd.range(1.0, 2.8) * (1 - 0.45 * d / cr));
        if (rnd() < 0.5) pen.dot(x + rnd.gauss(), y + rnd.gauss(), rnd.range(0.45, 0.95));
      }
      // scalloped colony rim, dotted
      for (let t = 0; t < LW.TAU; t += 0.45) if (rnd() < 0.7) pen.dot(ccx + Math.cos(t) * cr, ccy + Math.sin(t) * cr * sq, rnd.range(0.5, 0.9));
    }
    // a couple of rosette rims
    for (let m = 0; m < 2; m++) {
      const a = rnd() * LW.TAU, d = rnd() * r * 0.6;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * sq, rr = rnd.range(2.5, 5);
      for (let t = 0; t < LW.TAU; t += 0.8) pen.dot(x + Math.cos(t) * rr, y + Math.sin(t) * rr * sq, 0.6);
    }
  };
  // ---- a drip stain: darker streak in the colour plate + broken ink threads
  T.drip = function (fillPen, pen, x, y, len, w, rnd, inside = null) {
    const pts = [];
    let px = x, a = Math.PI / 2;
    for (let s = 0; s <= len; s += 4) {
      a = Math.PI / 2 + 0.08 * LW.noise(s * 0.05, x * 0.1);
      if (inside && s > 0 && !inside(px, y + s)) break;
      pts.push([px, y + s]);
      px += Math.cos(a) * 4 - 0;
    }
    if (pts.length < 3) return;
    fillPen.line(pts, (t) => w * (1 - 0.6 * t) * (0.7 + 0.3 * Math.sin(t * 9 + x)), 0.25, 0.2);
    const th = Math.max(1, Math.round(w / 3));
    for (let k = 0; k < th + 1; k++) {
      const off = (k / Math.max(1, th) - 0.5) * w * 0.7;
      let run = [];
      for (const [qx, qy] of pts) {
        if ((inside && !inside(qx + off, qy)) || LW.noise3(qx * 0.3 + k * 7, qy * 0.08) > 0.35) { if (run.length > 2) pen.line(run, 0.6, 0.4); run = []; continue; }
        run.push([qx + off, qy]);
      }
      if (run.length > 2) pen.line(run, 0.6, 0.4);
    }
  };
  // ---- small crack-plant: a few blades / leaves sprouting from a joint (scale s px)
  T.sprig = function (fillPen, pen, x, y, s, rnd) {
    const nb = rnd.int(3, 6);
    for (let k = 0; k < nb; k++) {
      const a = -Math.PI / 2 + rnd.gauss() * 0.7;
      const L = s * rnd.range(0.5, 1.0), bend = rnd.gauss() * 0.6;
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.25) { const aa = a + bend * t * t; pts.push([x + Math.cos(aa) * L * t + (k - nb / 2), y + Math.sin(aa) * L * t]); }
      if (pts.length < 3) return;
    fillPen.line(pts, (t) => 2.4 * (1 - t) + 0.5, 0.05);
      pen.line(pts, (t) => 1.0 * (1 - 0.6 * t), 0.15);
    }
  };
  // crossing hatch layers in the deep shadows of an area: each layer only where dark exceeds its threshold
  T.deepHatch = function (pen, bb, inside, dark, base, o = {}) {
    const layers = o.layers || [[base + 0.9, 0.62, 3.4], [base - 0.75, 0.78, 4.2]];
    layers.forEach(([ang, thr, sp], i) => {
      LW.hatchDither(pen, bb, ang, {
        spacing: sp, step: 3, wob: 0.8, seed: (o.seed || 0) + i * 17, jitter: 0.06, inside,
        dark: (x, y) => (dark(x, y) - thr) / (1 - thr), w: (x, y, d) => (0.55 + 0.7 * d) * (o.lw || 1), taper: 0.3,
      });
    });
  };
})();
