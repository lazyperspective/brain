// earth.js -- what is under the ground (the sheet shows it, the way a child's drawing does),
// the small hill, the surface between, and the thread.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, P = A.P, M = A.MED, vn = A.vn, sstep = A.sstep, PI = Math.PI;
  const MT = Wd.MT, HL = Wd.HL, PAL = Wd.PAL, HZ = Wd.horizon, I = Wd.IN;

  const DEPTH = [0, 23, 52, 86, 122, 161, 210];
  const bnd = (i, x) => i === 0 ? HZ(x) : Math.min(I.y1, HZ(x) + DEPTH[i] + 10 * (vn(x / 130 + i * 9, i * 3.3, 61) - 0.5) * 2 + 3 * (vn(x / 37 + i * 5, 1.1, 62) - 0.5) * 2 + 8 * Math.sin(x / 210 + i * 1.7));
  Wd.bnd = bnd;
  const warmAt = x => sstep(720, 1480, x);
  function blob(R, cx, cy, rx, ry) { const a0 = R() * 6.283, n = Math.max(9, Math.ceil((rx + ry) * 2)), out = [], s = R() * 99, tilt = R.g() * 0.25, ct = Math.cos(tilt), st = Math.sin(tilt); for (let i = 0; i <= n + 1; i++) { const a = a0 + i / n * 6.283, k = 1 + 0.16 * (vn(a * 1.3 + s, 1.1, 85) - 0.5) * 2, x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; out.push(cx + x * ct - y * st, cy + x * st + y * ct); } return out; }
  Wd.blob = blob;

  // the thread's road under the ground (used by the earth too, to keep it warm there)
  Wd.THREAD = [[MT.cx, MT.cy + 12], [MT.cx + 10, MT.cy + 44], [MT.cx + 66, MT.cy + 92], [735, 770], [838, 742], [938, 774], [1040, 792], [1142, 752], [1236, 778], [1302, 738], [HL.cx - 6, HL.cy + 40], [HL.cx, HL.cy + 10]];
  Wd.THREAD2 = [[-8, 813], [56, 818], [170, 827], [320, 807], [480, 831], [650, 813], [830, 837], [1000, 821], [1160, 839], [1292, 818], [1386, 776], [1399, 706], [1389, 656], [HL.cx + 31, HL.cy - 14], [HL.cx + 17, HL.cy - 31]];
  let TH = null;
  const threadPts = () => TH || (TH = P.spline(Wd.THREAD, 3).concat(P.spline(Wd.THREAD2, 3)));
  Wd.nearThread = function (x, y) { const t = threadPts(); let best = 1e9; for (let i = 0; i < t.length; i += 8) { const d = (t[i] - x) * (t[i] - x) + (t[i + 1] - y) * (t[i + 1] - y); if (d < best) best = d; } return Math.sqrt(best); };

  S.earth = function (C, R) { for (let i = 0; i < 6; i++) S.earthLayer(C, R, i); S.earthThings(C, R); };
  S.earthLayer = function (C, R, i) {
    {
      const thick = DEPTH[i + 1] - DEPTH[i], lanes = thick > 31 ? 3 : 2;
      const inBand = (x, y) => x > I.x0 && x < I.x1 && y > bnd(i, x) + 0.5 && y < bnd(i + 1, x) - 0.5 && y < I.y1;
      for (let pass = 0; pass < 4; pass++) for (let lane = 0; lane < lanes; lane++) {
        let x = I.x0 - 6;
        while (x < I.x1) {
          const len = R.r(55, 170), x1 = Math.min(I.x1 + 5, x + len), f = (lane + 0.5) / lanes + (R() - 0.5) * 0.2, pts = [];
          for (let xx = x; xx <= x1; xx += 4.5) pts.push(xx, bnd(i, xx) + (bnd(i + 1, xx) - bnd(i, xx)) * f);
          if (pts.length >= 4 && (pass < 2 || R.chance(pass === 2 ? 0.55 : 0.28))) {
            const xm = (x + x1) / 2, warm = warmAt(xm) + (R() - 0.5) * 0.7 > 0.5;
            let c = warm ? PAL.earthWarm[i % 7] : PAL.earthCold[i % 7], p = R.r(0.56, 0.74), w = thick / lanes * 1.3;
            if (pass === 2) { c = warm ? PAL.earthWarm[(i + 3) % 7] : PAL.earthCold[(i + 2) % 7]; p = R.r(0.36, 0.5); w *= 0.6; }
            if (pass === 3) { c = warm ? R.pick([PAL.shell[0], PAL.dawn[0], PAL.earthWarm[2]]) : R.pick([PAL.nightLight[1], PAL.earthCold[5], PAL.night[5]]); p = R.r(0.3, 0.4); w *= 0.42; }
            for (const run of Wd.runs(P.wob(R, pts, 1.0, 30), (px, py) => px > I.x0 - 2 && px < I.x1 + 2 && py < I.y1 + 1)) C.stroke(run, { w, c, m: M.pastel, p, cj: 0.03 });
          }
          x += len * R.r(0.72, 1.0);
        }
      }
      // the seam below
      if (i < 5) { let x = I.x0; while (x < I.x1) { const x1 = Math.min(I.x1, x + R.r(90, 300)), pts = []; for (let xx = x; xx <= x1; xx += 4.5) pts.push(xx, bnd(i + 1, xx)); if (pts.length >= 4 && R.chance(0.9)) { const warm = warmAt((x + x1) / 2) > 0.5; C.stroke(P.wob(R, pts, 0.7, 30), warm ? { w: R.r(1.1, 1.6), c: R.chance(0.5) ? PAL.bole : PAL.soot, m: M.conte, p: R.r(0.6, 0.8) } : { w: R.r(1.1, 1.7), c: PAL.soot, m: M.char, p: R.r(0.6, 0.8) }); if (R.chance(0.3)) C.stroke(P.wob(R, pts, 0.9, 30), { w: 0.9, c: warm ? PAL.chalk : PAL.nightLight[0], m: M.conte, p: 0.5 }); } if (x1 >= I.x1) break; x = x1 - R.r(0, 16); } }
      // hatching: a different lean for each layer
      const ang = [Wd.HAND, Wd.HAND + PI / 2, Wd.HAND, 0.12, Wd.HAND + PI / 2, Wd.HAND][i] + R.g() * 0.05, ns = R() * 99, whole = i % 2 === 0;
      Wd.hatch(R, (x, y) => inBand(x, y) && (whole || vn(x / 60 + ns, y / 40, 55) > 0.46), I.x0, 640, I.x1, I.y1, ang, 3.4, { len: Math.min(22, thick * 0.8), jit: 1.6, step: 3 },
        (x0, y0, x1, y1) => {
          const warm = warmAt((x0 + x1) / 2) + (R() - 0.5) * 0.3 > 0.5;
          if (warm) C.stroke(P.line(R, x0, y0, x1, y1, 0.3, 0.04, 6), { w: 1.05, c: [PAL.umberP, PAL.vermP, PAL.violetP, PAL.umberP, PAL.roseP, PAL.indigoP][i], m: M.pencil, p: R.r(0.55, 0.8) });
          else C.stroke(P.line(R, x0, y0, x1, y1, 0.3, 0.04, 6), { w: 0.95, c: [PAL.nightLight[0], PAL.nightLight[1], PAL.lavP, PAL.earthWarm[1], PAL.nightLight[1], PAL.nightLight[2]][i], m: M.conte, p: R.r(0.36, 0.52) });
        });
    }
  };
  S.earthThings = function (C, R) {
    // stones
    for (const i of [1, 3, 4]) {
      let x = I.x0 + R.r(4, 20);
      while (x < I.x1 - 10) {
        const big = i === 4, rx = big ? R.r(5, 10) : R.r(2.6, 5.5), ry = rx * R.r(0.55, 0.8), f = R.r(0.3, 0.7), y = bnd(i, x) + (bnd(i + 1, x) - bnd(i, x)) * f, warm = warmAt(x) > 0.5;
        if (y + ry < I.y1 - 2 && Wd.nearThread(x, y) > 14) {
          if (R.chance(0.55)) for (let q = 0; q < 3; q++) C.stroke(P.line(R, x - rx * 0.6, y + (q - 1) * ry * 0.5, x + rx * 0.6, y + (q - 1) * ry * 0.5 + R.g() * 0.4, 0.3, 0.04, 3), { w: ry * 0.8, c: warm ? R.pick([PAL.shell[2], PAL.dawn[4], PAL.earthWarm[2]]) : R.pick([PAL.nightLight[1], [0.5, 0.47, 0.5], PAL.night[5]]), m: M.pastel, p: R.r(0.45, 0.62) });
          C.stroke(blob(R, x, y, rx, ry), warm ? { w: 1.1, c: PAL.soot, m: M.char, p: 0.7 } : { w: 1.1, c: PAL.chalk, m: M.chalk, p: R.r(0.55, 0.75) });
        }
        x += rx * 2 + (big ? R.r(8, 46) : R.r(3, 22));
      }
    }
    // the signs that were rubbed off the mound are down here, pressed like shells into the layers
    for (let q = 0; q < 150; q++) {
      const under = R.chance(0.72), x = under ? R.r(90, 1130) : R.r(I.x0 + 14, I.x1 - 14), i = R.pick([0, 2, 2, 3, 5, 5, 4]), f = R.r(0.3, 0.7), y = bnd(i, x) + (bnd(i + 1, x) - bnd(i, x)) * f, size = Math.min(19, (DEPTH[i + 1] - DEPTH[i]) * 0.55) * R.r(0.8, 1.05);
      if (y + size * 0.6 > I.y1 || Wd.nearThread(x, y) < 13) continue;
      const warm = warmAt(x) > 0.5, near = sstep(70, 14, Wd.nearThread(x, y));
      Wd.sign(C, R, R.i(0, 23), x, y, size, R.g() * 0.5, near > 0.3 ? { c: [0.95, 0.80, 0.50], m: M.conte, w: 1.05, p: 0.62 } : warm ? { c: R.chance(0.5) ? PAL.chalk : PAL.soot, m: M.conte, w: 1.0, p: 0.5 } : { c: R.chance(0.7) ? PAL.chalk : PAL.nightLight[0], m: M.chalk, w: 1.0, p: R.r(0.42, 0.56) }, { sloppy: 1.2, part: R.chance(0.35) ? R.r(0.4, 0.8) : 1 });
    }
    // rows of dots, and the deepest layer's small arcs
    for (const i of [2, 5]) {
      let x = I.x0 + 4; const f = i === 2 ? 0.14 : 0.2;
      while (x < I.x1 - 3) { const y = bnd(i, x) + (bnd(i + 1, x) - bnd(i, x)) * f; if (y < I.y1 - 2) C.dab(x, y + R.g() * 0.4, R.r(0.8, 1.2), warmAt(x) > 0.5 ? PAL.dawn[1] : PAL.chalk, M.chalk, 0.78); x += R.r(5.5, 7.5); }
    }
    { let x = I.x0 + 6; while (x < I.x1 - 12) { const w = R.r(12, 17), y = Math.min(I.y1 - 3, bnd(5, x) + (bnd(6, x) - bnd(5, x)) * 0.78); C.stroke(P.wob(R, P.spline([[x, y], [x + w / 2, y - w * 0.42], [x + w, y]], 2.5), 0.3, 10), { w: 1.05, c: warmAt(x) > 0.5 ? PAL.dawn[6] : PAL.nightLight[1], m: M.conte, p: 0.6 }); x += w * R.r(0.95, 1.05); } }
  };

  // ---------- the small hill ----------
  S.hill = function (C, R) {
    const HS = Wd.HS, cols = [PAL.hill[1], PAL.hill[3], PAL.hill[2], PAL.hill[4]], pens = [PAL.vermP, PAL.ochreP, PAL.tealP, PAL.greenP];
    const above = (x, y) => y < HZ(x) - 0.5;
    // heart of the hill
    for (let q = 0; q < 16; q++) { const s = R.r(0.03, 0.17), a = R.r(0.1, 1.6), b = a + R.r(0.8, 1.6); const pts = Wd.until(P.wob(R, HL.arc(s, a, Math.min(PI - 0.02, b), 2.5), 0.4, 12), above); if (pts.length >= 4) C.stroke(pts, { w: R.r(5, 8), c: R.chance(0.6) ? PAL.hill[0] : PAL.dawn[1], m: M.pastel, p: R.r(0.5, 0.68) }); }
    for (let b = 0; b < 4; b++) {
      const s0 = HS[b], s1 = HS[b + 1], sm = (s0 + s1) / 2, ds = s1 - s0, thick = ds * 128;
      for (let pass = 0; pass < 3; pass++) for (let lane = 0; lane < 2; lane++) {
        let th = 0.004;
        while (th < PI) {
          const r = HL.R(th) * sm, dth = R.r(24, 64) / r, s = s0 + (lane + 0.5) / 2 * ds + (R() - 0.5) * 0.18 * ds;
          if (pass === 0 || R.chance(0.7)) { const pts = Wd.until(P.wob(R, HL.arc(s, th, Math.min(PI - 0.004, th + dth), 3), 0.7, 18), above); if (pts.length >= 4) C.stroke(pts, { w: thick * 0.6, c: pass === 2 ? (b === 3 ? (R.chance(0.5) ? PAL.sour : PAL.dawn[2]) : PAL.hill[(b + 3) % 5]) : cols[b], m: M.pastel, p: pass === 2 ? R.r(0.36, 0.48) : R.r(0.56, 0.74), cj: 0.03 }); }
          th += dth * R.r(0.7, 1.0);
        }
      }
      // a child's scribble: back and forth without lifting the pencil
      { let th = 0.03; while (th < PI - 0.03) { const zig = [], nz = R.i(8, 22); for (let q = 0; q < nz && th < PI - 0.02; q++) { const p = HL.pt(q % 2 ? s0 + R.r(0.1, 0.22) * ds : s1 - R.r(0.1, 0.22) * ds, th); if (above(p[0], p[1] + 1.5)) zig.push(p[0], p[1]); th += R.r(1.9, 3.0) / (HL.R(th) * sm); } if (zig.length >= 6 && R.chance(0.72)) C.stroke(P.wob(R, zig, 0.35, 10), { w: 1.1, c: pens[b], m: M.pencil, p: R.r(0.6, 0.8), ti: 0.03, to: 0.05 }); th += R.r(0, 0.12); } }
      // outline of the ring, gone over twice
      for (let pass = 0; pass < 2; pass++) { let th = 0.002; while (th < PI) { const dth = R.r(40, 130) / (HL.R(th) * s1); if (pass === 0 || R.chance(0.6)) { const pts = Wd.until(P.wob(R, HL.arc(s1 * (1 + R.g() * 0.006), th, Math.min(PI - 0.002, th + dth), 3), 0.6, 20), above); if (pts.length >= 4) C.stroke(pts, b === 3 && pass === 0 ? { w: 1.2, c: PAL.soot, m: M.char, p: 0.6 } : { w: 1.3, c: PAL.violetP, m: M.pencil, p: R.r(0.75, 0.95) }); } th += dth * R.r(0.85, 1.0); } }
      // the old signs, handed on
      if (b === 0 || b === 2) {
        const pat = b === 0 ? [Wd.OLD[0], Wd.OLD[2]] : [Wd.OLD[1], Wd.OLD[4], Wd.OLD[3]], size = thick * 0.62; let th = size * 1.0 / (HL.R(0) * sm), q = 0;
        while (th < PI - size * 0.9 / (HL.R(PI) * sm)) { const p = HL.pt(sm, th); if (p[1] < HZ(p[0]) - size * 0.55 && Math.hypot(p[0] - HL.cx - 17, p[1] - HL.cy + 31) > 17) Wd.sign(C, R, pat[q % pat.length], p[0], p[1], size, PI / 2 - th + R.g() * 0.08, b === 0 ? { c: PAL.indigoP, m: M.pencil, w: 1.35, p: 0.92 } : { c: PAL.chalk, m: M.chalk, w: 1.25, p: 0.85 }, { sloppy: 1.25 }); q++; th += size * R.r(1.5, 1.8) / (HL.R(th) * sm); }
      }
      if (b === 1) { let th = 0.05; while (th < PI - 0.05) { const p = HL.pt(sm, th); if (p[1] < HZ(p[0]) - 3) C.dab(p[0] + R.g() * 0.3, p[1] + R.g() * 0.3, R.r(1.0, 1.5), PAL.vermP, M.conte, 0.85); th += R.r(6, 8) / (HL.R(th) * sm); } }
    }
    // short bright marks all round it, the way a child draws something that glows
    { let th = 0.06; while (th < PI - 0.05) { const a = HL.pt(R.r(1.09, 1.13), th), b = HL.pt(R.r(1.2, 1.3), th + R.g() * 0.015); C.stroke(P.line(R, a[0], a[1], b[0], b[1], 0.3, 0.05, 3), R.chance(0.5) ? { w: 1.5, c: R.pick([PAL.vermP, PAL.roseP, PAL.ochreP]), m: M.pencil, p: 0.9 } : { w: 1.6, c: R.chance(0.5) ? PAL.chalk : PAL.hill[1], m: M.chalk, p: 0.8 }); th += R.r(0.085, 0.13); } }
  };

  // ---------- the line where the sky meets the ground ----------
  S.surface = function (C, R) {
    // the top of the earth
    { let x = I.x0; while (x < I.x1) { const x1 = Math.min(I.x1, x + R.r(80, 260)), pts = []; for (let xx = x; xx <= x1; xx += 4.5) pts.push(xx, HZ(xx) + 0.8); if (pts.length >= 4) C.stroke(P.wob(R, pts, 0.6, 30), { w: R.r(1.4, 2.2), c: PAL.soot, m: M.char, p: R.r(0.6, 0.8) }); if (x1 >= I.x1) break; x = x1 - R.r(0, 14); } }
    // frost, on the winter side
    for (let x = I.x0 + 2; x < 1180;) {
      const len = R.r(14, 60), k = 1 - sstep(980, 1180, x), core = Math.abs(x - MT.cx) < 150 ? 0.35 : 1;
      if (R.chance(0.82 * k * core)) { const pts = []; for (let xx = x; xx <= x + len; xx += 4) pts.push(xx, HZ(xx) - 1.6 + R.g() * 0.3); C.stroke(P.wob(R, pts, 0.5, 14), { w: R.r(1.8, 3.4), c: PAL.chalk, m: M.chalk, p: R.r(0.5, 0.8) }); if (R.chance(0.6)) C.stroke(P.wob(R, pts.map((v, q) => q % 2 ? v + 4.2 : v), 0.5, 14), { w: R.r(2, 3.2), c: PAL.nightLight[0], m: M.pastel, p: R.r(0.36, 0.5) }); }
      x += len * R.r(0.8, 1.4);
    }
    // last year's stubble
    for (let q = 0; q < 240; q++) { const x = R.r(I.x0 + 2, 1150); if (Math.abs(x - MT.cx) < 150 || R() < sstep(900, 1150, x)) continue; const y = HZ(x) - 1, l = R.r(3, 8), lean = R.g() * 0.3 + 0.15; C.stroke(P.line(R, x, y, x + lean * l, y - l, 0.2, 0.08, 3), { w: 0.9, c: PAL.soot, m: M.char, p: R.r(0.55, 0.75), ti: 0, to: 0.5 }); }
    // the first green: thick by the small hill, and a very little of it where the mound used to stand
    const shoot = (x, y, ang, l, bright) => {
      const cur = R.g() * 0.35, pts = []; for (let q = 0; q <= 5; q++) { const t = q / 5; pts.push(x + Math.cos(ang + cur * t) * l * t, y + Math.sin(ang + cur * t) * l * t); }
      const r = R();
      if (r < 0.34) C.stroke(pts, { w: R.r(1.2, 1.9), c: PAL.sour, m: M.pastel, p: R.r(0.6, 0.8), ti: 0, to: 0.6, nodust: true });
      else if (r < 0.6) C.stroke(pts, { w: R.r(1.1, 1.7), c: PAL.hill[4], m: M.pastel, p: R.r(0.6, 0.8), ti: 0, to: 0.6, nodust: true });
      else if (r < 0.86) C.stroke(pts, { w: 1.15, c: PAL.greenP, m: M.pencil, p: R.r(0.75, 0.95), ti: 0, to: 0.5 });
      else C.stroke(pts, { w: 1.2, c: bright ? PAL.dawn[1] : PAL.chalk, m: M.chalk, p: 0.75, ti: 0, to: 0.6 });
    };
    for (let q = 0; q < 620; q++) { const x = R.r(990, I.x1 - 2); if (R() > sstep(990, 1200, x) || Math.abs(x - HL.cx) < 120) continue; shoot(x, HZ(x) - 0.5, -PI / 2 + R.g() * 0.28, R.r(4, 15) * (0.5 + 0.5 * sstep(990, 1250, x)), true); }
    for (let q = 0; q < 110; q++) { const th = R.r(0.05, PI - 0.05), p = HL.pt(1.0, th); shoot(p[0], p[1], -th + R.g() * 0.3, R.r(3, 8), true); }
    for (let q = 0; q < 26; q++) { const x = R.chance(0.75) ? R.r(MT.cx - 330, MT.cx + 420) : R.r(120, 1000); if (Math.abs(x - MT.cx) < 150) continue; shoot(x, HZ(x) - 0.5, -PI / 2 + R.g() * 0.25, R.r(3, 8), false); }
    // their roots
    for (let q = 0; q < 170; q++) { const x = R.r(1150, I.x1 - 4), l = R.r(8, 34), pts = [x, HZ(x) + 2]; let a = PI / 2 + R.g() * 0.3, px = x, py = HZ(x) + 2; for (let d = 0; d < l; d += 3) { a += R.g() * 0.3; px += Math.cos(a) * 3; py += Math.sin(a) * 3; pts.push(px, py); } C.stroke(pts, { w: 0.85, c: R.chance(0.6) ? PAL.dawn[1] : PAL.chalk, m: M.conte, p: R.r(0.45, 0.62), ti: 0, to: 0.6 }); }
  };

  // ---------- the thread, and what it joins ----------
  function seed(C, R, x, y, r) {
    for (let q = 0; q < 3; q++) C.stroke(P.circle(R, x, y, r * R.r(1.5, 1.8), 1.1), { w: 1.3, c: PAL.vermP, m: M.pencil, p: 0.9 });
    for (let rr = r * 1.14; rr > 0.6; rr -= 1.5) C.stroke(P.circle(R, x, y, rr, 1.05, 0.04), { w: 2.4, c: PAL.bole, m: M.conte, p: 0.88, ti: 0, to: 0 });
    for (let rr = r; rr > 0.5; rr -= 1.3) C.stroke(P.circle(R, x, y, rr, 1.05, 0.04), { w: 2.2, c: PAL.gold, m: M.gold, p: 0.96, ti: 0, to: 0 });
    C.stroke(P.circle(R, x, y, r * 0.56, 1.08), { w: 1.0, c: PAL.bole, m: M.pencil, p: 0.95 });
    C.dab(x, y, r * 0.2, [1, 0.985, 0.9], M.chalk, 0.95);
  }
  function runThread(C, R, ctrl, wGold, glowN, knotGap) {
    const t = P.spline(ctrl, 3), np = t.length >> 1;
    // the ground is warm where it runs
    for (let q = 0; q < glowN; q++) { const i = R.i(2, np - 26) * 2, pts = []; for (let k = 0; k < R.i(8, 22) * 2 && i + k + 1 < t.length; k += 2) pts.push(t[i + k], t[i + k + 1]); if (pts.length < 6 || pts[1] < HZ(pts[0]) + 6 || pts[0] < I.x0 + 4) continue; const off = R.g() * 9; C.stroke(P.wob(R, pts.map((v, k) => k % 2 ? v + off : v), 1.2, 16), { w: R.r(7, 18) * wGold / 3.9, c: R.pick([PAL.earthWarm[0], PAL.earthWarm[2], PAL.shell[0], PAL.earthWarm[4], PAL.shell[1], PAL.shell[0]]), m: M.pastel, p: R.r(0.34, 0.5) * (1 - Math.min(0.6, Math.abs(off) / 22)) }); }
    for (let q = 0; q < glowN / 6; q++) { const i = R.i(4, np - 30) * 2, pts = []; for (let k = 0; k < 40 && i + k + 1 < t.length; k += 2) pts.push(t[i + k], t[i + k + 1]); if (pts[1] > HZ(pts[0]) + 8 && pts[0] > I.x0 + 6) C.smudge(pts, R.r(7, 12), 0.06); }
    // bole first, then the gold laid on it
    C.stroke(P.wob(R, t, 0.5, 30), { w: wGold * 1.55, c: PAL.bole, m: M.conte, p: 0.86, ti: 0.004, to: 0, wv: 0.2 });
    const tg = P.wob(R, t, 0.35, 22);
    C.stroke(tg, { w: wGold, c: PAL.gold, m: M.gold, p: 0.96, ti: 0.004, to: 0, wv: 0.22 });
    for (let i = 0; i < tg.length - 12;) { const l = R.i(4, 14) * 2; if (R.chance(0.55)) C.stroke(tg.slice(i, i + l).map((v, q) => q % 2 ? v - wGold * 0.18 : v), { w: 1.0, c: [1, 0.96, 0.74], m: M.chalk, p: R.r(0.55, 0.8) }); i += l + R.i(2, 10) * 2; }
    // knots, and hair-roots
    let acc = 0, next = 38;
    for (let i = 2; i < tg.length - 2; i += 2) {
      acc += Math.hypot(tg[i] - tg[i - 2], tg[i + 1] - tg[i - 1]);
      if (acc > next && tg[i + 1] > HZ(tg[i]) + 16 && tg[i] > I.x0 + 8) {
        acc = 0; next = R.r(knotGap * 0.7, knotGap * 1.3); const x = tg[i], y = tg[i + 1], r = R.r(3.0, 4.4) * wGold / 3.9;
        C.dab(x, y, r + 1.1, PAL.bole, M.conte, 0.9); C.dab(x, y, r, PAL.gold, M.gold, 0.97);
        const nh = R.i(0, 3);
        for (let h = 0; h < nh; h++) { let a = R() * 6.283, px = x, py = y; const pts = [x, y], l = R.r(10, 32); for (let d = 0; d < l; d += 2.5) { a += R.g() * 0.35; px += Math.cos(a) * 2.5; py += Math.sin(a) * 2.5; if (py < HZ(px) + 5 || py > I.y1 - 3) break; pts.push(px, py); } if (pts.length >= 6) C.stroke(pts, { w: 1.3 * wGold / 3.9, c: PAL.gold, m: M.gold, p: 0.92, ti: 0, to: 0.6 }); }
      }
    }
  }
  S.thread = function (C, R) {
    // glow at the heart of the mound
    for (let q = 0; q < 26; q++) { const sv = R.r(0.02, 0.066), a = R.r(0.05, 1.8), b = a + R.r(0.5, 1.3); const pts = Wd.until(P.wob(R, MT.arc(sv, a, Math.min(PI - 0.03, b), 2.5), 0.5, 12), (x, y) => y < HZ(x) - 0.5); if (pts.length >= 4) C.stroke(pts, { w: R.r(4, 8), c: R.pick([PAL.shell[0], PAL.dawn[1], PAL.dawn[3], [0.98, 0.62, 0.36]]), m: M.pastel, p: R.r(0.5, 0.7) }); }
    // the second thread: thinner, deeper, and it comes in from beyond the edge of the sheet --
    // from someone who is not in the picture at all
    runThread(C, R, Wd.THREAD2, 2.5, 150, 84);
    // the first: from the heart of the mound
    runThread(C, R, Wd.THREAD, 3.9, 260, 62);
    // the seed at the heart of the mound; and in the small hill, the same seed -- and one more
    seed(C, R, MT.cx, MT.cy - 1, 13);
    seed(C, R, HL.cx, HL.cy - 1, 10.5);
    seed(C, R, HL.cx + 17, HL.cy - 31, 6.6);
    // small rays round the old seed
    for (let q = 0; q < 13; q++) { const a = PI + 0.25 + q / 12 * (PI - 0.5) + R.g() * 0.05, r0 = R.r(24, 27), r1 = R.r(31, 37); C.stroke(P.line(R, MT.cx + Math.cos(a) * r0, MT.cy + Math.sin(a) * r0, MT.cx + Math.cos(a) * r1, MT.cy + Math.sin(a) * r1, 0.3, 0.05, 3), { w: 1.3, c: PAL.gold, m: M.gold, p: R.r(0.7, 0.95) }); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
