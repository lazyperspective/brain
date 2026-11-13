// last.js -- the outline gone over once more, the frieze that forgets its own pattern, and what time did to the sheet.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, P = A.P, M = A.MED, vn = A.vn, sstep = A.sstep, PI = Math.PI;
  const MT = Wd.MT, HL = Wd.HL, PAL = Wd.PAL, HZ = Wd.horizon, I = Wd.IN;

  S.outline = function (C, R) {
    const above = (x, y) => y < HZ(x) - 1 && y > I.y0 - 4;
    // where the edge of the mound was: charcoal, tried three times, pressed hardest on the night side
    for (let pass = 0; pass < 4; pass++) {
      let th = 0.004;
      while (th < PI) {
        const dth = R.r(60, 230) / (MT.R(th) * 1), mid = MT.pt(1, th + dth / 2), lost = Wd.dawn(mid[0], mid[1]);
        if (R.chance(pass === 0 ? 0.9 - 0.45 * lost : 0.42 - 0.25 * lost)) { const pts = Wd.runs(P.wob(R, MT.arc(1 - Math.abs(R.g()) * (pass ? 0.007 : 0.002), th, Math.min(PI - 0.004, th + dth), 4), 0.8, 36), above); for (const run of pts) C.stroke(run, { w: R.r(0.9, 1.5), c: PAL.soot, m: M.char, p: (pass === 0 ? R.r(0.52, 0.68) : R.r(0.42, 0.55)) * (1 - 0.3 * lost) }); }
        th += dth * R.r(0.8, 1.0);
      }
    }
    // a rim of chalk outside it: light round the place where it is not
    for (let pass = 0; pass < 2; pass++) {
      let th = 0.01;
      while (th < PI) {
        const dth = R.r(40, 160) / MT.R(th), mid = MT.pt(1, th + dth / 2), lost = Wd.dawn(mid[0], mid[1]);
        if (R.chance(pass === 0 ? 0.85 : 0.4)) for (const run of Wd.runs(P.wob(R, MT.arc(1.006 + R() * 0.006, th, Math.min(PI - 0.01, th + dth), 4), 0.6, 30), above)) C.stroke(run, { w: R.r(1.3, 2.3), c: PAL.chalk, m: M.chalk, p: R.r(0.5, 0.72) * (1 - 0.4 * lost) });
        th += dth * R.r(0.85, 1.05);
      }
    }
    // light on the place where it stood: the morning on one flank, the cold on the other -- so lightly
    // that the pastel only catches the highest grain of the paper
    for (let q = 0; q < 1500; q++) {
      const x = R.r(MT.cx - 470, MT.cx + 560), y = R.r(MT.cy - 500, MT.cy - 6); if (y > HZ(x) - 5) continue;
      const s = MT.sOf(x, y); if (s > 0.985) continue; const g = Wd.gone(x, y); if (g < 0.7) continue;
      const warm = sstep(640, 1080, x + 0.25 * (y - 400)), cold = sstep(520, 190, x + 0.2 * (y - 400)), rim = sstep(0.5, 0.98, s);
      const pr = R(); let c, f;
      if (pr < warm) { c = R.pick([PAL.dawn[4], PAL.dawn[1], PAL.dawn[0], PAL.dawn[3], PAL.dawn[4]]); f = warm; } else if (pr > 1 - cold * 0.55) { c = R.pick([PAL.nightLight[0], PAL.nightLight[2], PAL.nightLight[1], PAL.chalk]); f = cold; } else continue;
      if (R() > 0.35 + 0.65 * rim) continue;
      const th = MT.th(x, y), ang = R.chance(0.5) ? Math.atan2(Math.cos(th), Math.sin(th)) + R.g() * 0.1 : Wd.HAND + R.g() * 0.15, len = R.r(26, 80);
      for (const run of Wd.runs(P.line(R, x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2, 1.2, 0.05, 4), (px, py) => py < HZ(px) - 4 && MT.sOf(px, py) < 0.99 && Wd.gone(px, py) > 0.6)) C.stroke(run, { w: R.r(8, 20), c, m: M.pastel, p: R.r(0.24, 0.31) + 0.05 * f * rim, nodust: true });
    }
    // the hand went on rubbing past the edge, and pulled a little night in with it
    for (let q = 0; q < 26; q++) {
      const th = R.r(0.5, 2.9), a = MT.pt(R.r(1.02, 1.07), th), ang = Wd.HAND + PI + R.g() * 0.25 + (th < 1.2 ? PI : 0), len = R.r(30, 80);
      const pts = Wd.runs(P.line(R, a[0], a[1], a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len, 1.5, 0.06, 3), above);
      for (const run of pts) C.smudge(run, R.r(5, 10), R.r(0.05, 0.1), { carry: 0.1 });
    }
    for (let q = 0; q < 12; q++) {
      const th = R.r(0.9, 2.8), a = MT.pt(R.r(0.93, 0.98), th), ang = Wd.HAND + R.g() * 0.2 + (R.chance(0.5) ? PI : 0), len = R.r(26, 60);
      for (const run of Wd.runs(P.line(R, a[0] - Math.cos(ang) * len / 2, a[1] - Math.sin(ang) * len / 2, a[0] + Math.cos(ang) * len / 2, a[1] + Math.sin(ang) * len / 2, 1.2, 0.06, 3), above)) C.erase(run, { w: R.r(5, 10), p: 0.8, s: R.r(0.45, 0.7) });
    }
    // what the rubber could not lift: grains of the gold, still sitting where the rings ran
    const SMs = Wd.SM;
    for (let j = 4; j < SMs.length - 1; j++) {
      const sm = (SMs[j] + SMs[j + 1]) / 2; let th = R.r(0.03, 0.12);
      while (th < PI - 0.03) { const p = MT.pt(sm + R.g() * 0.004, th); if (p[1] < HZ(p[0]) - 4 && Wd.gone(p[0], p[1]) > 0.55 && R.chance(0.6)) { const r = R.r(0.9, 1.6); C.dab(p[0], p[1], r + 0.5, PAL.bole, M.conte, 0.7); C.dab(p[0], p[1], r, PAL.gold, M.gold, 0.96); } th += R.r(44, 96) / (MT.R(th) * sm); }
    }
    // and here and there somebody has tried, in thin graphite, to put a sign back from memory -- and not finished it
    for (let q = 0; q < 34; q++) {
      const j = R.i(5, SMs.length - 2), sm = (SMs[j] + SMs[j + 1]) / 2, th = R.r(0.25, PI - 0.25), p = MT.pt(sm, th); if (Wd.gone(p[0], p[1]) < 0.8) continue;
      Wd.sign(C, R, R.i(0, 23), p[0], p[1], (SMs[j + 1] - SMs[j]) * 468 * 0.6, PI / 2 - th + R.g() * 0.15, { c: PAL.graphite, m: M.pencil, w: 0.85, p: R.r(0.55, 0.8) }, { sloppy: 1.7, part: R.r(0.3, 0.75) });
    }
    // the edge of what was kept
    const SM = Wd.SM;
    for (let q = 0; q < 34; q++) { const th = R.r(0.05, PI - 0.05), s = R.r(0.27, 0.34), p = MT.pt(s, th); if (Wd.gone(p[0], p[1]) > 0.45) continue; C.dab(p[0], p[1], R.r(0.8, 1.3), PAL.chalk, M.chalk, 0.8); }
  };

  // ---------- the frieze ----------
  // One short figure -- a door, a gold bead, a coil -- repeated all the way round the sheet.
  // Toward the upper left it is remembered less and less.  The gold bead is never left out.
  const kept = (x, y) => sstep(500, 1390, x + 0.32 * y);
  S.frieze = function (C, R) {
    const B0 = 11, B1 = 41, mid = 26;                 // band: from B0 to B1 in from each edge
    const sides = [
      { n: 26, at: (t, o) => [I.x0 + t * (I.x1 - I.x0), mid + o], rot: 0 },                    // top
      { n: 14, at: (t, o) => [1600 - mid - o, I.y0 + t * (I.y1 - I.y0)], rot: PI / 2 },        // right
      { n: 26, at: (t, o) => [I.x1 - t * (I.x1 - I.x0), 900 - mid - o], rot: PI },             // bottom
      { n: 14, at: (t, o) => [mid + o, I.y1 - t * (I.y1 - I.y0)], rot: -PI / 2 },              // left
    ];
    for (const sd of sides) {
      const n = sd.n, seg = (t0, t1, o0, o1) => { const a = sd.at(t0, o0), b = sd.at(t1, o1 === undefined ? o0 : o1); return P.line(R, a[0], a[1], b[0], b[1], 0.6, 0.006, 4); };
      // ground colour
      for (let u = 0; u < n; u++) for (let pass = 0; pass < 3; pass++) for (let lane = 0; lane < 2; lane++) {
        const c0 = sd.at((u + 0.5) / n, 0), k = kept(c0[0], c0[1]) + (R() - 0.5) * 0.16; if (k < 0.22) continue;
        if (pass > 0 && R.chance(0.35)) continue;
        const t0 = (u - 0.1 + R() * 0.2) / n, t1 = (u + 0.9 + R() * 0.25) / n;
        if (pass > 0 && R() > sstep(0.2, 0.8, k)) continue;
        C.stroke(seg(Math.max(-0.012, t0), Math.min(1.012, t1), -7 + lane * 14 + R.g() * 1.2), { w: 15, c: pass === 2 ? (R.chance(0.5) ? PAL.shell[7] : PAL.shell[3]) : R.chance(0.7) ? [0.66, 0.37, 0.29] : PAL.shell[14], m: M.pastel, p: 0.34 + 0.26 * sstep(0.2, 0.95, k) - (pass === 1 ? 0.06 : 0), cj: 0.035 });
      }
      // the two rules
      for (const o of [-15.5, 15.5]) for (let pass = 0; pass < 2; pass++) { let t = -0.02; while (t < 1.02) { const t1 = Math.min(1.03, t + R.r(0.08, 0.3)), c0 = sd.at((t + t1) / 2, o), k = kept(c0[0], c0[1]); if (pass === 0 || R.chance(0.35 * k)) C.stroke(seg(t, t1, o + R.g() * 0.3), k > 0.25 ? { w: R.r(1.1, 1.6), c: PAL.soot, m: M.char, p: 0.4 + 0.36 * k } : { w: 0.8, c: PAL.graphite, m: M.pencil, p: 0.5 }); t = t1 - R.r(0, 0.01); } }
      // unit by unit
      for (let u = 0; u < n; u++) {
        const c0 = sd.at((u + 0.5) / n, 0), k = kept(c0[0], c0[1]) + (R() - 0.5) * 0.2, at = (f, o) => sd.at((u + f) / n, o);
        const light = { c: PAL.chalk, m: M.chalk, w: 1.25, p: 0.84 }, trace = { c: PAL.graphite, m: M.pencil, w: 0.8, p: 0.5 };
        // door
        { const p = at(0.24, 0); if (k > 0.56) Wd.sign(C, R, Wd.OLD[1], p[0], p[1], 17, sd.rot + R.g() * 0.06, light, { sloppy: 1 }); else if (k > 0.36) Wd.sign(C, R, Wd.OLD[1], p[0], p[1], 17, sd.rot + R.g() * 0.1, { c: PAL.chalk, m: M.chalk, w: 1.2, p: 0.66 }, { sloppy: 1.5, part: (k - 0.2) * 1.6 }); else if (k > 0.14 && R.chance(0.6)) Wd.sign(C, R, Wd.OLD[1], p[0], p[1], 17, sd.rot + R.g() * 0.1, trace, { sloppy: 1.4, part: 0.5 }); }
        // coil -- or, where the memory slips, some other sign in its place
        { const p = at(0.76, 0); if (k > 0.72) Wd.sign(C, R, Wd.OLD[0], p[0], p[1], 16, sd.rot + R.g() * 0.06, light, { sloppy: 1 }); else if (k > 0.48) { if (R.chance(0.4)) Wd.sign(C, R, R.pick([5, 13, 12, 19, 1]), p[0], p[1], 16, sd.rot + R.g() * 0.3, light, { sloppy: 1.5 }); else Wd.sign(C, R, Wd.OLD[0], p[0], p[1], 16, sd.rot + R.g() * 0.15, { c: PAL.chalk, m: M.chalk, w: 1.2, p: 0.7 }, { sloppy: 1.6, part: (k - 0.3) * 1.5 }); } else if (k > 0.2 && R.chance(0.5)) Wd.sign(C, R, Wd.OLD[0], p[0], p[1], 16, sd.rot + R.g() * 0.2, trace, { sloppy: 1.6, part: 0.45 }); }
        // the running teeth along the outside, the beads along the inside
        if (k > 0.62) { const z = [], nz = 9; for (let q = 0; q <= nz; q++) { if (k < 0.8 && R.chance(0.25)) { if (z.length >= 6) C.stroke(z.slice(), { w: 1.1, c: PAL.soot, m: M.char, p: 0.72 }); z.length = 0; continue; } const p = at(q / nz, -11.5 + (q % 2 ? 2.4 : -2.4)); z.push(p[0] + R.g() * 0.3, p[1] + R.g() * 0.3); } if (z.length >= 6) C.stroke(z, { w: 1.1, c: PAL.soot, m: M.char, p: 0.72 }); }
        if (k > 0.4) for (let q = 0; q < 9; q++) { if (R() > (k - 0.3) * 2.2) continue; const p = at((q + 0.5) / 9, 11.5); C.dab(p[0] + R.g() * 0.3, p[1] + R.g() * 0.3, R.r(0.8, 1.2), PAL.chalk, M.chalk, 0.82); }
        // the gold bead: always
        { const p = at(0.5, 0); C.stroke(P.circle(R, p[0], p[1], 4.6, 1.1), { w: 1.1, c: PAL.bole, m: M.conte, p: 0.5 + 0.4 * sstep(0.1, 0.6, k) }); C.dab(p[0], p[1], 3.5, PAL.bole, M.conte, 0.85); C.dab(p[0], p[1], 2.7, PAL.gold, M.gold, 0.97); }
      }
    }
    // corners
    for (const c of [[mid, mid], [1600 - mid, mid], [1600 - mid, 900 - mid], [mid, 900 - mid]]) {
      const k = kept(c[0], c[1]);
      if (k > 0.3) for (let q = 0; q < 4; q++) C.stroke(P.line(R, c[0] - 13, c[1] - 9 + q * 6, c[0] + 13, c[1] - 9 + q * 6 + R.g(), 0.5, 0.02), { w: 9, c: PAL.shell[7], m: M.pastel, p: 0.4 + 0.25 * k });
      C.stroke(P.wob(R, [c[0] - 14, c[1] - 14, c[0] + 14, c[1] - 14, c[0] + 14, c[1] + 14, c[0] - 14, c[1] + 14, c[0] - 14, c[1] - 15], 0.4, 12), k > 0.25 ? { w: 1.3, c: PAL.soot, m: M.char, p: 0.45 + 0.3 * k } : { w: 0.8, c: PAL.graphite, m: M.pencil, p: 0.5 });
      C.stroke(P.circle(R, c[0], c[1], 7.4, 1.1), { w: 1.2, c: PAL.vermP, m: M.pencil, p: 0.9 }); C.dab(c[0], c[1], 5.4, PAL.bole, M.conte, 0.88); for (let rr = 4.4; rr > 0.5; rr -= 1.3) C.stroke(P.circle(R, c[0], c[1], rr, 1.05, 0.04), { w: 2, c: PAL.gold, m: M.gold, p: 0.96, ti: 0, to: 0 });
    }
  };

  // ---------- time ----------
  S.time = function (C, R) {
    const rub = { m: M.rubber, ti: 0, to: 0 };
    // the sheet was folded in four and kept somewhere for a long while
    const folds = [[803 + R.g() * 2, -5, 801 + R.g() * 2, 905], [-5, 452 + R.g() * 2, 1605, 449 + R.g() * 2]];
    for (const f of folds) {
      const line = P.line(R, f[0], f[1], f[2], f[3], 0.7, 0.0015, 5), n = line.length >> 1;
      for (let i = 0; i < n - 1;) { const l = R.i(2, 9), seg = line.slice(i * 2, Math.min(n, i + l + 1) * 2); if (seg.length >= 4) { if (R.chance(0.8)) C.stroke(seg, Object.assign({ w: R.r(0.9, 1.9), p: R.r(0.55, 0.85), erase: R.r(0.25, 0.6) }, rub)); const side = d => seg.map((v, q) => v + (((q % 2) === 0) === (f === folds[0]) ? d : 0)); if (R.chance(0.75)) C.stroke(side(1.2), { w: 0.9, c: [0.36, 0.30, 0.26], m: M.pencil, p: R.r(0.5, 0.75), k: 0.7 }); if (R.chance(0.6)) C.stroke(side(-0.9), { w: 0.9, c: [0.88, 0.83, 0.75], m: M.conte, p: R.r(0.42, 0.6), k: 0.6 }); } i += l; }
      for (let q = 0; q < 170; q++) { const i = R.i(0, n - 1), x = line[i * 2] + R.g() * 2.2, y = line[i * 2 + 1] + R.g() * 2.2; C.stroke([x, y, x + R.g(), y + R.g()], Object.assign({ w: R.r(0.8, 2.6), p: 0.85, erase: R.r(0.4, 0.85) }, rub)); }
    }
    // small losses, where pigment let go of the paper
    for (let q = 0; q < 520; q++) { const x = R.r(8, 1592), y = R.r(8, 892); C.stroke([x, y, x + R.g() * 1.2, y + R.g() * 1.2], Object.assign({ w: R.r(0.7, 2.4), p: 0.8, erase: R.r(0.35, 0.8) }, rub)); }
    // the edges handled most
    for (let q = 0; q < 240; q++) { const e = R.i(0, 3), t = R(), d = R() * R() * 16; const x = e === 0 ? t * 1600 : e === 1 ? 1600 - d : e === 2 ? t * 1600 : d, y = e === 0 ? d : e === 1 ? t * 900 : e === 2 ? 900 - d : t * 900; C.stroke([x, y, x + R.g() * 4, y + R.g() * 4], Object.assign({ w: R.r(2, 7), p: 0.6, erase: R.r(0.2, 0.5) }, rub)); }
    // foxing that came after the drawing, and a thumb or two of somebody who held it
    for (let q = 0; q < 46; q++) { const x = R.r(10, 1590), y = R.r(10, 890), r = R.r(0.8, 2.6); for (let k = 0; k < 3; k++) C.dab(x + R.g() * r * 0.5, y + R.g() * r * 0.5, r, [0.56, 0.38, 0.22], M.pastel, 0.5, { k: 0.3 }); }
    for (const p of [[30, 500], [1578, 360], [700, 884], [1210, 14]]) for (let q = 0; q < 3; q++) C.smudge(P.line(R, p[0] + R.g() * 6, p[1] + R.g() * 6, p[0] + R.g() * 14, p[1] + R.g() * 14, 1, 0.1, 3), R.r(7, 11), 0.08);
    // the maker's mark, lower right: a small red block with the coil in it
    { const x = 1532, y = 836; for (let q = 0; q < 5; q++) C.stroke(P.line(R, x - 6.5, y - 5.6 + q * 2.8, x + 6.5, y - 5.6 + q * 2.8 + R.g() * 0.3, 0.3, 0.02, 3), { w: 3.6, c: PAL.vermP, m: M.conte, p: 0.86 }); Wd.sign(C, R, 0, x, y, 9, R.g() * 0.1, { c: PAL.chalk, m: M.chalk, w: 1.0, p: 0.85 }, { sloppy: 0.8 }); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
