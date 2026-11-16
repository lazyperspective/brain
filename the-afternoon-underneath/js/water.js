// water.js -- the water. Round its edges it shows tonight, as water should. In the middle it has kept
// an afternoon: the same cloud, lit; a sun where the moon is; a sky nobody has painted over.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, fbm = A.fbm, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c;
  const YH = Wd.YH;
  const o8 = new Float32Array(8), rp = [0, 0, 0], tc = [0, 0, 0];

  // ------------------------------------------------------------------ that afternoon's cloud
  const DC = { hi: hx('#fffdf4'), warm: hx('#fff0cc'), s1: hx('#e2ddfa'), s2: hx('#b6b9f2'), s3: hx('#8d9fe6'), s4: hx('#6f88d6'), under: hx('#6d95cc'), pink: hx('#ffd9d2') };
  function dayLit(x, y, o) {
    // the sun is on the left, a little above, a little behind us; the far side of the cloud, and its foot, are in its own shade
    return 0.62 * (o[1] * -0.84 + o[2] * -0.31 + o[3] * 0.45) + 0.38 * (o[5] * -0.84 + o[6] * -0.31 + o[7] * 0.45) + 0.07 * (vn(x / 12, y / 12, 83) - 0.5) - 0.20 * ss(1180, 1640, x) - 0.10 * ss(280, 400, y);
  }
  const TH = [0.40, 0.19, -0.04, -0.30];
  // colour of the lit cloud at a point of the sky; returns the tone, leaves in out[3] how close we are to a shadow's edge
  function dayCloudCol(x, y, o, out, small) {
    const t = dayLit(x, y, o) + (small ? 0.16 : 0);
    const hi = mix(DC.hi, DC.warm, ss(60, 380, y) * 0.8);
    let col = hi;
    col = mix(col, DC.s1, ss(TH[0] + 0.02, TH[0] - 0.02, t));
    col = mix(col, DC.s2, ss(TH[1] + 0.025, TH[1] - 0.025, t));
    col = mix(col, DC.s3, ss(TH[2] + 0.03, TH[2] - 0.03, t));
    col = mix(col, DC.s4, ss(TH[3] + 0.04, TH[3] - 0.04, t));
    // a breath of pink where the shadows turn back toward the light, low down
    const pk = Math.exp(-Math.pow((t - TH[0] + 0.07) / 0.07, 2)) * ss(120, 360, y) * 0.5; col = mix(col, DC.pink, pk);
    let e = 0; for (let i = 0; i < 4; i++) { const d = (TH[i] - 0.012 - t) / 0.018; if (d > 0) e += Math.exp(-d * d) * (0.9 - i * 0.12); }
    // the foot of the cloud goes into the haze
    const hz = ss(318, 412, y) * 0.78; Wd.day(x, 418, tc);
    out[0] = col[0] + (tc[0] - col[0]) * hz; out[1] = col[1] + (tc[1] - col[1]) * hz; out[2] = col[2] + (tc[2] - col[2]) * hz; out[3] = e * (1 - hz);
    return t;
  }
  Wd.dayCloudCol = dayCloudCol; Wd.dayLit = dayLit;

  // what that afternoon looked like at a point of its sky. out[0..2] colour, out[3] pooled-pigment hint; returns 1 sky, 2 cloud
  const q4 = [0, 0, 0, 0];
  Wd.thenSky = function (xs, ys, out) {
    let v = Wd.cloud(xs, ys, o8);
    if (v > 0) { dayCloudCol(xs, ys, o8, out, false); if (v < 2.5) { const a = ss(0, 2.5, v); Wd.day(xs, ys, tc); out[0] = tc[0] + (out[0] - tc[0]) * a; out[1] = tc[1] + (out[1] - tc[1]) * a; out[2] = tc[2] + (out[2] - tc[2]) * a; out[3] = out[3] * a + 0.5 * (1 - a) * a * 4; } return 2; }
    v = Wd.fair(xs, ys, o8);
    if (v > 0) { dayCloudCol(xs, ys, o8, out, true); const a = ss(0, 2.2, v); Wd.day(xs, ys, tc); out[0] = tc[0] + (out[0] - tc[0]) * a; out[1] = tc[1] + (out[1] - tc[1]) * a; out[2] = tc[2] + (out[2] - tc[2]) * a; out[3] *= a; return 2; }
    Wd.day(xs, ys, out); out[3] = 0; return 1;
  };
  // what tonight's sky looks like at a point of the sky
  Wd.nowSky = function (xs, ys, out) {
    const v = Wd.cloud(xs, ys, o8);
    if (v > 0) { Wd.duskCloudCol(xs, ys, o8, out); if (v < 2.5) { const a = ss(0, 2.5, v); Wd.dusk(xs, ys, tc); out[0] = tc[0] + (out[0] - tc[0]) * a; out[1] = tc[1] + (out[1] - tc[1]) * a; out[2] = tc[2] + (out[2] - tc[2]) * a; } return 2; }
    Wd.dusk(xs, ys, out); return 1;
  };
  // the same two, as the water shows them at a point of the sheet below the horizon
  Wd.then = function (x, y, out) {
    Wd.rip(x, y, rp); const v = y - YH;
    const k = Wd.thenSky(x + rp[0], clamp(YH - v * (1 + rp[1]), -60, YH - 0.5), out);
    const dp = 1 - 0.05 * ss(0, 460, v) + rp[2] * 0.07; out[0] *= dp; out[1] *= dp; out[2] *= dp * 1.0;
    return k;
  };
  Wd.now = function (x, y, out) {
    Wd.rip(x, y, rp); const v = y - YH;
    const k = Wd.nowSky(x + rp[0] * 1.5, clamp(YH - v * (1 + rp[1] * 1.6), -60, YH - 0.5), out);
    const dp = 0.84 + rp[2] * 0.22; out[0] = out[0] * dp * 0.96; out[1] = out[1] * dp * 0.90; out[2] = out[2] * dp + 0.02;
    return k;
  };

  // ------------------------------------------------------------------ washes
  S.waterWash = function (C, R) {
    const Mg = C.M, W = C.W, k = C.k;
    C.wash(0, YH - 1, 1600, 900, function (x, y, pig) {
      const edge = y - (YH + 1.0 + 2.0 * (vn(x / 19, 7.7, 606) - 0.5)); if (edge <= 0) return 0;
      const m = Mg[((y * k) | 0) * W + ((x * k) | 0)]; if (m >= 0.995) return 0;
      Wd.now(x, y, pig);
      const w = (1 - m) * (0.96 + 0.26 * (vn(x / 200, y / 7, 607) - 0.5) * 2 + 0.2 * (fbm(x / 70, y / 40, 608, 3) - 0.5) * 2);
      return w * A.wc(edge, 1.4, 0.3) * (1 + 0.5 * m);        // pigment gathers where tonight's water meets the afternoon
    }, { gran: 0.44 });
  };
  S.memWash = function (C, R, pass) {
    const Mg = C.M, W = C.W, k = C.k, q = [0, 0, 0, 0];
    C.wash(0, YH, 1600, 900, function (x, y, pig) {
      const m = Mg[((y * k) | 0) * W + ((x * k) | 0)]; if (m <= 0.004) return 0;
      const kind = Wd.then(x, y, q); pig[0] = q[0]; pig[1] = q[1]; pig[2] = q[2];
      let w = (pass === 0 ? 0.58 : 0.50) * (1 + 0.20 * (vn(x / 180 + pass * 5, y / (8 + pass * 6), 611 + pass) - 0.5) * 2 + 0.16 * (fbm(x / 60, y / 50, 613 + pass, 3) - 0.5) * 2);
      if (kind === 2) w *= 1 + 0.55 * q[3];
      return w * m;
    }, { gran: pass === 0 ? 0.42 : 0.3 });
    if (pass === 1) for (let i = 0; i < 7; i++) { const x = R.r(160, 1440), y = R.r(560, 880); if (Wd.mem(C, x, y) > 0.9) C.bloom(x, y, R.r(14, 34), { lift: R.r(0.10, 0.2), dark: R.r(0.05, 0.10), sq: R.r(1.6, 2.6) }); }
  };

  // ------------------------------------------------------------------ pastel laid along the water
  S.waterHatch = function (C, R) {
    const q = [0, 0, 0, 0];
    C.clip(0, YH + 1, 1600, 900);
    // tonight's water, round the edges
    S.hatch(C, R, {
      n: 900, box: [-30, YH + 2, 1630, 905], w: [3, 9], len: [40, 190], p: [0.3, 0.5], ang: () => 0, spread: 0.015, wob: 0.8,
      col: (x, y, R) => { if (Wd.mem(C, x, y) > 0.45) return null; Wd.now(x + R.g() * 20, y, q); return [q[0], q[1], q[2]]; },
    });
    // the afternoon: its sky
    S.hatch(C, R, {
      n: 1500, box: [60, YH + 16, 1540, 905], w: [4, 12], len: [40, 200], p: [0.24, 0.42], ang: () => 0, spread: 0.015, wob: 0.8,
      col: (x, y, R) => { if (Wd.mem(C, x, y) < 0.6) return null; const k = Wd.then(x + R.g() * 16, y, q); if (k === 2) return null; return [q[0], q[1], q[2]]; },
    });
    C.clip();
  };
  // the lit cloud, in pastel: white laid thick on the sunward shoulders, pencil in the blue
  S.memCloud = function (C, R) {
    const q = [0, 0, 0, 0];
    const map = pts => { const out = new Array(pts.length); let ok = 0; for (let i = 0; i < pts.length; i += 2) { const b = Wd.bend(pts[i], 2 * YH - pts[i + 1]); out[i] = b[0]; out[i + 1] = b[1]; if (Wd.mem(C, b[0], b[1]) > 0.55) ok++; } return ok * 2 > pts.length * 0.6 ? out : null; };
    const light = (x, y) => [Wd.MOON[0] - x, Wd.MOON[1] - 60 - y];
    C.clip(0, YH + 1, 1600, 900);
    for (const fld of [Wd.CB, Wd.FW]) {
      const small = fld === Wd.FW, at = small ? Wd.fair : Wd.cloud;
      // strokes that go round the lobes, in whatever tone the place has
      S.formHatch(C, R, {
        n: small ? 1500 : 5200, box: small ? [0, 20, 1040, 400] : [820, 0, 1600, 412], at, w: [2.5, 6.5], len: [10, 36], p: [0.34, 0.6], map,
        col: (x, y, v, o, R) => { if (v < 1.5) return null; const t = dayCloudCol(x, y, o, q, small); const j = R.g() * 0.03; return t > TH[0] ? [q[0] + 0.02, q[1] + 0.02, q[2] + 0.02] : [q[0] + j + 0.02 * R(), q[1] + j, q[2] + j + 0.02]; },
      });
      // the brightest shoulders, thick white
      S.cloudArcs(C, R, fld.puffs, {
        light, keep: 0.7, rmin: 5, p: [0.6, 0.9], map, wk: 0.8, fld,
        col: (x, y, i) => { if (i > 0) return null; const v = at(x, y, o8); if (v < 0.5 || v > 22) return null; const t = dayCloudCol(x, y, o8, q, small); if (t < TH[0] + 0.12) return null; return DC.hi; },
      });
    }
    for (const fld of [Wd.CB, Wd.FW]) S.cloudContours(C, R, fld, fld === Wd.FW ? Wd.fair : Wd.cloud, { map, p: [0.3, 0.55], col: (x, y) => (y > 404 ? null : hx('#6f7fd2')) });
    // pencil hatching in the shadows, slanted the same way as the hand's hatching in the sky above -- folded over
    S.hatch(C, R, {
      n: 2200, box: [100, YH + 20, 1560, 880], m: M.pencil, w: [0.9, 1.4], len: [12, 34], p: [0.3, 0.55], ang: () => 0.95, spread: 0.1, wob: 0.4,
      col: (x, y) => { if (Wd.mem(C, x, y) < 0.7) return null; const k = Wd.then(x, y, q); if (k !== 2) return null; const l = q[0] + q[1] + q[2]; if (l > 2.62) return null; return l < 2.2 ? hx('#4f6cc4') : hx('#8a94e0'); },
    });
    // and warm cream stroked into the lit side, low down, where the afternoon is going gold
    S.hatch(C, R, {
      n: 600, box: [100, YH + 20, 1560, 880], m: M.pastel, w: [2, 5], len: [10, 40], p: [0.3, 0.5], ang: () => 0, spread: 0.2, wob: 0.6,
      col: (x, y) => { if (Wd.mem(C, x, y) < 0.7) return null; const k = Wd.then(x, y, q); if (k !== 2) return null; const l = q[0] + q[1] + q[2]; if (l < 2.86) return null; return y < 640 ? hx('#ffefc4') : c.white; },
    });
    C.clip();
  };

  // ------------------------------------------------------------------ the sun that is where the moon is
  S.sun = function (C, R) {
    const sx = Wd.MOON[0], sy = 2 * YH - Wd.MOON[1];
    C.clip(0, YH + 1, 1600, 900);
    C.veil(sx - 330, sy - 240, sx + 330, sy + 170, (x, y, col) => { const m = Wd.mem(C, x, y); if (m <= 0) return 0; const d = Math.hypot(x - sx, (y - sy) * 1.1); col[0] = 1; col[1] = 0.99; col[2] = 0.88; return m * (0.95 * Math.exp(-d * d / 1500) + 0.42 * Math.exp(-d / 52) + 0.14 * Math.exp(-d / 150)); }, { g: 0.55, mode: 'lend' });
    // rays, the way a child draws them and the way a lens does
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + R.g() * 0.04, L = (i % 2 ? R.r(52, 84) : R.r(90, 160)) * (0.75 + 0.25 * Math.abs(Math.cos(a))), r0 = R.r(27, 33);
      C.stroke(P.line(R, sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * L, sy + Math.sin(a) * L, 0.5, 0.01, 4), { w: R.r(1.4, 3.0), c: mix(c.white, c.cream, R() * 0.6), m: M.glow, p: R.r(0.4, 0.62), ti: 0.05, to: 0.75 });
      if (i % 2 === 0) C.stroke(P.line(R, sx + Math.cos(a + 0.03) * r0, sy + Math.sin(a + 0.03) * r0, sx + Math.cos(a + 0.03) * L * 0.8, sy + Math.sin(a + 0.03) * L * 0.8, 0.4, 0.01, 4), { w: 0.9, c: c.white, m: M.wax, p: 0.6, ti: 0.05, to: 0.6 });
    }
    // the disc, broken by the water into bars
    const rd = 23;
    for (let i = -11; i <= 11; i++) {
      const yy = i * 2.5, y = sy + yy + R.g() * 0.4, hw = Math.sqrt(Math.max(0, rd * rd - yy * yy)) * R.r(0.92, 1.18) + R.r(0, 3), sh = R.g() * 2.0;
      if (hw < 2) continue;
      C.stroke(P.line(R, sx - hw + sh, y, sx + hw + sh, y + R.g() * 0.3, 0.3, 0, 3), { w: R.r(2.6, 3.4), c: c.white, m: M.glow, p: 1, ti: 0.2, to: 0.2 });
    }
    for (let i = 0; i < 30; i++) { // glitter running down toward us
      const y = sy + 28 + i * R.r(3.4, 5.6) + R.r(0, 3), hw = R.r(4, 18) * (1 - i / 44); if (y > 895) break;
      C.stroke(P.line(R, sx - hw + R.g() * 7, y, sx + hw + R.g() * 7, y, 0.3, 0, 3), { w: R.r(1.0, 2.2), c: mix(c.white, c.cream, R()), m: M.glow, p: R.r(0.6, 0.95), ti: 0.3, to: 0.3 });
    }
    for (let i = 0; i < 16; i++) { const y = sy - 28 - i * R.r(3, 5), hw = R.r(4, 14) * (1 - i / 20); C.stroke(P.line(R, sx - hw + R.g() * 5, y, sx + hw + R.g() * 5, y, 0.3, 0, 3), { w: R.r(1.0, 2.0), c: c.white, m: M.glow, p: R.r(0.5, 0.9), ti: 0.3, to: 0.3 }); }
    // the long cross
    C.stroke(P.line(R, sx - 210, sy + 1, sx + 210, sy - 1, 0.4, 0.002, 4), { w: 1.7, c: c.white, m: M.glow, p: 0.8, ti: 0.5, to: 0.5 });
    C.stroke(P.line(R, sx + 1, sy - 150, sx - 1, sy + 140, 0.4, 0.002, 4), { w: 1.7, c: c.white, m: M.glow, p: 0.8, ti: 0.5, to: 0.5 });
    for (const a of [0.78, 2.36]) C.stroke(P.line(R, sx - 62 * Math.cos(a), sy - 62 * Math.sin(a), sx + 62 * Math.cos(a), sy + 62 * Math.sin(a), 0.3, 0.002, 4), { w: 1.2, c: c.white, m: M.glow, p: 0.6, ti: 0.5, to: 0.5 });
    // a ring of colour that old lenses threw
    C.stroke(P.circle(R, sx, sy, 58, 1.02, 0.015), { w: 2.2, c: hx('#ffd9e6'), m: M.glow, p: 0.3 });
    C.stroke(P.circle(R, sx, sy, 61, 1.02, 0.015), { w: 1.6, c: hx('#d9f6ff'), m: M.glow, p: 0.26 });
    C.clip();
  };
  // a pencil going round the outline of a cloud, lobe by lobe
  S.cloudContours = function (C, R, fld, at, o) {
    const f8 = new Float32Array(8);
    for (const p of fld.puffs) {
      const r = p[2]; if (r < 4.5) continue;
      for (let k = 0; k < 4; k++) {
        const a = R.r(0, 6.283), ox = Math.cos(a), oy = Math.sin(a);
        if (at(p[0] + ox * (r + 2.5), p[1] + oy * (r + 2.5), f8) > -0.5) continue;
        if (at(p[0] + ox * (r - 3), p[1] + oy * (r - 3), f8) < 0.5) continue;
        const sp = R.r(0.3, 0.75); let pts = P.arc(R, p[0], p[1], r * 1.0, a - sp, a + sp, 0.03);
        const col = o.col(p[0] + ox * r, p[1] + oy * r, a); if (!col) continue;
        if (o.map) { pts = o.map(pts); if (!pts) continue; }
        C.stroke(pts, { w: R.r(0.8, 1.2), c: col, m: o.m || M.pencil, p: R.r(o.p[0], o.p[1]), ti: 0.3, to: 0.4 });
      }
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
