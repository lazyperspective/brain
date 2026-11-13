// mound.js -- the great mound: drawn whole, ring by ring, sign by sign -- and then rubbed out.
// (It really is drawn first and erased after.  What is left in the valleys of the paper is the ghost.)
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, P = A.P, M = A.MED, vn = A.vn, sstep = A.sstep, PI = Math.PI;
  const MT = Wd.MT, PAL = Wd.PAL;

  // faint graphite: the plan of the whole sheet
  S.under = function (C, R) {
    const g = { w: 0.7, c: PAL.graphite, m: M.pencil, p: 0.46, pv: 0.3 }, I = Wd.IN;
    const inPic = (x, y) => x > I.x0 && x < I.x1 && y > I.y0 && y < Wd.horizon(x);
    for (const arr of [Wd.SM, Wd.SK]) for (const s of arr) {
      const r = 470 * s; let th = 0;
      while (th < PI) { const d = R.r(90, 260) / r; if (R.chance(0.78)) for (const run of Wd.runs(P.wob(R, MT.arc(s * (1 + R.g() * 0.004), th, Math.min(PI, th + d), 5), 0.9, 40), inPic)) C.stroke(run, g); th += d * R.r(0.9, 1.15); }
    }
    for (let q = 0; q < 2; q++) { let x = I.x0 - 8; while (x < I.x1) { const x1 = Math.min(I.x1 + 8, x + R.r(120, 380)); C.stroke(P.line(R, x, Wd.horizon(x) + R.g() * 0.8, x1, Wd.horizon(x1) + R.g() * 0.8, 0.8, 0.004), g); if (x1 >= I.x1 + 8) break; x = x1 - R.r(0, 20); } }
    // a plumb line through the heart, and the frame, ruled by eye
    C.stroke(P.line(R, MT.cx + 1, 120, MT.cx - 1, 700, 0.7, 0.003), g);
    for (const d of [0, 2.2]) {
      C.stroke(P.line(R, I.x0 - 30, I.y0 - d, I.x1 + 30, I.y0 - d + R.g(), 0.7, 0.002), g); C.stroke(P.line(R, I.x0 - 30, I.y1 + d, I.x1 + 30, I.y1 + d + R.g(), 0.7, 0.002), g);
      C.stroke(P.line(R, I.x0 - d, I.y0 - 30, I.x0 - d + R.g(), I.y1 + 30, 0.7, 0.002), g); C.stroke(P.line(R, I.x1 + d, I.y0 - 30, I.x1 + d + R.g(), I.y1 + 30, 0.7, 0.002), g);
    }
  };

  const PENC = [PAL.vermP, PAL.umberP, PAL.roseP, PAL.ochreP, PAL.violetP, PAL.tealP, PAL.indigoP, PAL.vermP, PAL.umberP, PAL.roseP];

  S.mound = function (C, R) { for (let j = 0; j < Wd.SM.length - 1; j++) S.moundRing(C, R, j); };
  S.moundRing = function (C, R, j) {
    const SM = Wd.SM, n = SM.length - 1, HZ = Wd.horizon;
    const above = (x, y) => y < HZ(x) - 0.5;
    {
      const s0 = SM[j], s1 = SM[j + 1], sm = (s0 + s1) / 2, thick = (s1 - s0) * 468;
      const stick = PAL.shell[(j + 1) % PAL.shell.length], stick2 = PAL.shell[(j + 5) % PAL.shell.length], dark = Wd.lumOf(stick) < 0.45;
      // the ground colour of the ring: the side of a pastel, dragged round
      for (let pass = 0; pass < 3; pass++) for (let lane = 0; lane < 2; lane++) {
        if (pass === 2 && R.chance(0.4)) continue;
        let th = -0.01;
        while (th < PI) {
          const r = MT.R(th) * sm, dth = R.r(46, 135) / r, s = s0 + (lane + 0.5) / 2 * (s1 - s0) + (R() - 0.5) * 0.22 * (s1 - s0);
          if (pass === 0 || R.chance(pass === 1 ? 0.75 : 0.45)) {
            const pts = Wd.until(P.wob(R, MT.arc(s, Math.max(0.004, th), Math.min(PI - 0.004, th + dth), 4), 0.9, 30), above);
            if (pts.length >= 4) C.stroke(pts, { w: thick * (pass === 2 ? 0.34 : 0.54), c: pass === 2 ? stick2 : stick, m: M.pastel, p: pass === 0 ? R.r(0.52, 0.68) : pass === 1 ? R.r(0.44, 0.62) : R.r(0.36, 0.5), cj: 0.03 });
          }
          th += dth * R.r(0.7, 1.0);
        }
      }
      // pencil worked over it, at the hand's own angle
      const pc = dark ? (j % 2 ? PAL.lavP : PAL.ochreP) : PENC[j % PENC.length], full = R.chance(0.55), ns = R() * 99;
      Wd.hatch(R, (x, y) => { if (y >= HZ(x) - 1) return false; const s = MT.sOf(x, y); return s > s0 + 0.004 && s < s1 - 0.004 && (full || vn(x / 55 + ns, y / 55, 51) > 0.47); },
        MT.cx - 480 * s1, MT.cy - 505 * s1, MT.cx + 575 * s1, MT.cy, Wd.HAND + R.g() * 0.05, 3.3, { len: thick * 0.75, jit: 1.5 },
        (x0, y0, x1, y1) => C.stroke(P.line(R, x0, y0, x1, y1, 0.3, 0.04, 5), { w: 1.05, c: pc, m: M.pencil, p: R.r(0.5, 0.72) }));
      // the line between rings, in charcoal, gone over where it broke
      for (let pass = 0; pass < 2; pass++) {
        let th = 0;
        while (th < PI) {
          const r = MT.R(th) * s1, dth = R.r(70, 240) / r;
          if (pass === 0 ? R.chance(0.93) : R.chance(0.3)) { const pts = Wd.until(P.wob(R, MT.arc(s1 * (1 + R.g() * 0.0025), Math.max(0.003, th), Math.min(PI - 0.003, th + dth), 4), 0.7, 34), above); if (pts.length >= 4) C.stroke(pts, { w: R.r(1.0, 1.5), c: PAL.soot, m: M.char, p: R.r(0.6, 0.78) }); }
          th += dth * R.r(0.85, 1.02);
        }
      }
      // the row of signs: the same few, over and over, all the way round
      const size = thick * 0.6, pat = j < 5 ? [Wd.OLD[j % 5], Wd.OLD[(j + 2) % 5]] : [R.i(0, 23), R.i(0, 23), R.i(0, 23)].concat(R.chance(0.5) ? [R.i(0, 23)] : []);
      const stA = dark ? { c: PAL.chalk, m: M.chalk, w: 1.25, p: 0.82 } : (j % 4 === 2 ? { c: PAL.indigoP, m: M.pencil, w: 1.35, p: 0.9 } : j % 5 === 3 ? { c: PAL.bole, m: M.conte, w: 1.2, p: 0.8 } : { c: PAL.soot, m: M.char, w: 1.15, p: 0.78 });
      let th = (size * 0.9) / (MT.R(0) * sm) + R() * 0.03, q = 0;
      while (th < PI - (size * 0.8) / (MT.R(PI) * sm)) {
        const p = MT.pt(sm + (R() - 0.5) * 0.004, th);
        if (p[1] < HZ(p[0]) - size * 0.55) Wd.sign(C, R, pat[q % pat.length], p[0], p[1], size, PI / 2 - th + R.g() * 0.07, stA, { sloppy: 1 });
        q++; th += size * R.r(1.45, 1.75) / (MT.R(th) * sm);
      }
      // some rings carry a string of chalk beads as well
      if (j % 3 === 1 || j === 0) {
        let t2 = 0.02; const sb = s0 + 0.16 * (s1 - s0);
        while (t2 < PI - 0.02) { const p = MT.pt(sb, t2); if (p[1] < HZ(p[0]) - 2) C.dab(p[0] + R.g() * 0.3, p[1] + R.g() * 0.3, R.r(0.8, 1.2), dark ? PAL.chalk : (j % 2 ? PAL.chalk : PAL.bole), dark ? M.chalk : M.conte, 0.85); t2 += R.r(5.5, 7.5) / (MT.R(t2) * sb); }
      }
    }
  };

  // ---------- the forgetting ----------
  S.forget = function (C, R, part) {
    const on = k => part === undefined || part === k;
    const HZ = Wd.horizon, gone = Wd.gone;
    const pick = (lo) => { for (let t = 0; t < 400; t++) { const x = R.r(MT.cx - 480, MT.cx + 575), y = R.r(MT.cy - 505, MT.cy); if (y > HZ(x) - 3 || MT.sOf(x, y) > 1.0) continue; const g = gone(x, y); if (g > (lo || 0) && R() < g) return [x, y, g]; } return [MT.cx - 100, MT.cy - 380, 1]; };
    const tangent = (x, y) => { const th = MT.th(x, y); return Math.atan2(Math.cos(th), Math.sin(th)); };
    const sweep = (x, y, ang, len, stop) => { const ca = Math.cos(ang), sa = Math.sin(ang), f = R.r(0.3, 0.7); const pts = P.line(R, x - ca * len * f, y - sa * len * f, x + ca * len * (1 - f), y + sa * len * (1 - f), 2.5, 0.07, 4); return Wd.runs(pts, (px, py) => py < HZ(px) - 2 && gone(px, py) > stop && MT.sOf(px, py) < 1.03); };
    // first the flat of the hand: colour dragged out of its rings
    if (on(0)) for (let i = 0; i < 300; i++) {
      const p = pick(0.2), ang = (R.chance(0.6) ? Wd.HAND + R.g() * 0.22 : tangent(p[0], p[1]) + R.g() * 0.15) + (R.chance(0.5) ? PI : 0);
      for (const run of sweep(p[0], p[1], ang, R.r(60, 200), R.r(0.1, 0.4))) C.smudge(run, R.r(8, 20), 0.03 + 0.08 * p[2]);
    }
    // then the rubber, pass after pass, never quite the same way twice
    if (on(1) || on(2)) for (let i = 0; i < (part === undefined ? 620 : 310); i++) {
      const p = pick(0.08), ang = (R.chance(0.72) ? Wd.HAND + R.g() * 0.2 : tangent(p[0], p[1]) + R.g() * 0.2) + (R.chance(0.5) ? PI : 0);
      for (const run of sweep(p[0], p[1], ang, R.r(50, 210), R.r(0.03, 0.3))) C.erase(run, { w: R.r(9, 30), p: 0.52 + 0.4 * p[2], s: (0.17 + 0.27 * p[2]) * R.r(0.7, 1.15) });
    }
    // the hand again, now grey with what it has taken
    if (on(3)) for (let i = 0; i < 90; i++) {
      const p = pick(0.5), ang = Wd.HAND + R.g() * 0.3 + (R.chance(0.5) ? PI : 0);
      for (const run of sweep(p[0], p[1], ang, R.r(80, 240), 0.35)) C.smudge(run, R.r(12, 26), 0.05 + 0.06 * R());
    }
    // a few last hard strokes of the rubber that cut into rings it meant to keep
    if (on(3)) for (let i = 0; i < 46; i++) {
      let p; for (let t = 0; t < 60; t++) { p = pick(0.02); if (p[2] < 0.6) break; }
      const ang = Wd.HAND + R.g() * 0.16 + (R.chance(0.5) ? PI : 0);
      for (const run of sweep(p[0], p[1], ang, R.r(30, 90), 0.004)) C.erase(run, { w: R.r(3.5, 8), p: 0.85, s: R.r(0.55, 0.85) });
    }
    // and the kneaded rubber, pressed and lifted
    if (on(3)) for (let i = 0; i < 240; i++) { const p = pick(0.6); C.stroke([p[0], p[1], p[0] + R.g() * 2, p[1] + R.g() * 2], { w: R.r(8, 22), m: M.rubber, p: 0.62, erase: R.r(0.3, 0.6), ti: 0, to: 0 }); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
