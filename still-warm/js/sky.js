// sky.js -- the sky is the mound's own outline, said again and again, further and further off:
// night where it is close, morning where it is far.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, P = A.P, M = A.MED, vn = A.vn, sstep = A.sstep, PI = Math.PI;
  const MT = Wd.MT, HL = Wd.HL, PAL = Wd.PAL;

  const NSEQ = [0, 1, 2, 3, 4, 5, 6, 7, 1, 2], TSEQ = [0, 1, 2, 3, 4, 5], DSEQ = [0, 1, 2, 3, 4, 5, 6, 7];
  function zone(R, x, y, spread) { const d = Wd.dawn(x, y) + (R() - 0.5) * (spread === undefined ? 0.3 : spread); return d < 0.3 ? 0 : d < 0.62 ? 1 : 2; }
  function stick(j, z, shift) { j += shift || 0; return z === 0 ? PAL.night[NSEQ[j % NSEQ.length]] : z === 1 ? PAL.turn[TSEQ[(j * 2 + 1) % TSEQ.length]] : PAL.dawn[DSEQ[(j * 3) % DSEQ.length]]; }
  Wd.skyStick = stick;

  S.sky = function (C, R) { const n = Wd.SK.length - 1; for (let j = 0; j < n; j++) S.skyBase(C, R, j); S.skyGlow(C, R); for (let j = 0; j < n; j++) S.skyLines(C, R, j); };
  S.skyBase = function (C, R, j) {
    const SK = Wd.SK, n = SK.length - 1;
    {
      const s0 = SK[j], s1 = SK[j + 1], sm = (s0 + s1) / 2, ds = s1 - s0;
      if (s0 > 2.75) return;
      const lanes = ds * 470 > 36 ? 3 : 2;
      // ground colour: side of the stick, dragged along the echo
      for (let pass = 0; pass < 5; pass++) for (let lane = 0; lane < lanes; lane++) {
        let th = -0.005;
        while (th < PI) {
          const r = MT.R(th) * sm, dth = R.r(50, 150) / r;
          const mid = MT.pt(sm, Math.min(PI, th + dth / 2));
          if (mid[0] > -80 && mid[0] < 1680 && mid[1] > -80 && (pass < 2 || R.chance(pass === 2 ? 0.55 : pass === 3 ? 0.3 : 0.75))) {
            const s = pass === 4 ? s0 + R.r(-0.08, 1.08) * ds : s0 + (lane + 0.5) / lanes * ds + (R() - 0.5) * 0.2 * ds, mg = R.r(-1.5, 3.5);
            const pts = P.wob(R, MT.arc(s, Math.max(0.002, th), Math.min(PI - 0.002, th + dth), 4.5), 1.1, 34);
            for (const run of Wd.runs(pts, (x, y) => Wd.inSky(x, y, mg))) {
              const k = (run.length >> 2) << 1, z = zone(R, run[k], run[k + 1]), wd = ds * MT.R(th) / lanes;
              let c, p, w = wd * 1.42;
              if (pass === 4) { if (z !== 0) continue; c = stick(j, 0); p = R.r(0.5, 0.66); w = wd * 0.9; }  // night wants one more going-over
              else if (pass < 2) { c = stick(j, z); p = z === 0 ? R.r(0.56, 0.74) : R.r(0.5, 0.68); }
              else if (pass === 2) { c = stick(j + 1, z, 0); p = R.r(0.36, 0.5); w = wd * 0.8; }       // a neighbour dragged across
              else { c = z === 0 ? R.pick(PAL.nightLight) : z === 1 ? PAL.dawn[(j * 3) % 8] : R.chance(0.2) ? PAL.sour : PAL.chalk; p = R.r(0.3, 0.42); w = wd * 0.5; } // a breath of light
              C.stroke(run, { w, c, m: M.pastel, p, cj: 0.03 });
            }
          }
          th += dth * R.r(0.72, 1.0);
        }
      }
    }
  };
  S.skyGlow = function (C, R) {
    // the low light of the morning, rubbed in with the side of the hand
    for (let i = 0; i < 90; i++) {
      const x = R.r(1100, 1560), hz = Wd.horizon(x), y = hz - R() * R() * 190 - 6, len = R.r(60, 180);
      for (const run of Wd.runs(P.line(R, x - len / 2, y + R.g() * 3, x + len / 2, y + R.g() * 3, 1.5, 0.02), (px, py) => Wd.inSky(px, py, 2))) C.stroke(run, { w: R.r(14, 30), c: R.pick([PAL.dawn[1], PAL.dawn[4], PAL.dawn[1], PAL.dawn[6], PAL.chalk]), m: M.pastel, p: R.r(0.3, 0.42) * (1 - 0.5 * (hz - y) / 200) });
    }
    for (let i = 0; i < 70; i++) {
      const x = R.r(1120, 1540), y = Wd.horizon(x) - R.r(10, 170), len = R.r(50, 140), a = R.chance(0.5) ? 0 : Wd.HAND;
      for (const run of Wd.runs(P.line(R, x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, 2, 0.04), (px, py) => Wd.inSky(px, py, 6))) C.smudge(run, R.r(10, 20), 0.07);
    }
  };
  // the lines between echoes, and the pencil
  S.skyLines = function (C, R, j) {
    const SK = Wd.SK, n = SK.length - 1;
    {
      const s0 = SK[j], s1 = SK[j + 1], sm = (s0 + s1) / 2, ds = s1 - s0, thick = ds * 470; if (s0 > 2.75) return;
      if (j > 0) {
        let th = 0;
        while (th < PI) {
          const r = MT.R(th) * s0, dth = R.r(80, 260) / r;
          if (R.chance(0.86)) for (const run of Wd.runs(P.wob(R, MT.arc(s0 * (1 + R.g() * 0.002), th, Math.min(PI, th + dth), 4.5), 0.9, 36), (x, y) => Wd.inSky(x, y, 1))) {
            const k = (run.length >> 2) << 1, z = zone(R, run[k], run[k + 1], 0.2);
            if (z === 0) { if (j % 3 === 0 && R.chance(0.8)) C.stroke(run, { w: 1.0, c: R.pick(PAL.nightLight), m: M.conte, p: R.r(0.5, 0.66) }); else C.stroke(run, { w: R.r(1.1, 1.7), c: PAL.soot, m: M.char, p: R.r(0.55, 0.72) }); }
            else if (z === 1) C.stroke(run, { w: 1.2, c: R.pick([PAL.violetP, PAL.indigoP, PAL.bole]), m: M.pencil, p: R.r(0.7, 0.9) });
            else C.stroke(run, { w: 1.15, c: R.pick([PAL.roseP, PAL.violetP, PAL.tealP, PAL.vermP]), m: M.pencil, p: R.r(0.6, 0.85) });
          }
          th += dth * R.r(0.9, 1.05);
        }
      }
      // hatching, band by band, some bands left plain
      const mode = R.chance(0.3) ? 0 : R.chance(0.5) ? 1 : 2, ns = R() * 99;   // 0 plain   1 whole band   2 patches
      if (mode) {
        const pn = [PAL.lavP, PAL.nightLight[1], PAL.nightLight[2]][j % 3], pt = [PAL.violetP, PAL.indigoP, PAL.roseP][j % 3], pd = [PAL.roseP, PAL.tealP, PAL.vermP, PAL.violetP, PAL.ochreP, PAL.greenP][j % 6];
        Wd.hatch(R, (x, y) => { if (!Wd.inSky(x, y, 1.5)) return false; const s = MT.sOf(x, y); return s > s0 + 0.004 && s < s1 - 0.004 && (mode === 1 || vn(x / 70 + ns, y / 70, 53) > 0.5); },
          Wd.IN.x0, Wd.IN.y0, Wd.IN.x1, 660, Wd.HAND + R.g() * 0.05, mode === 1 ? 3.6 : 3.0, { len: Math.min(26, thick * 0.8), jit: 1.8, step: 3 },
          (x0, y0, x1, y1) => {
            const z = zone(R, (x0 + x1) / 2, (y0 + y1) / 2, 0.24);
            if (z === 0) C.stroke(P.line(R, x0, y0, x1, y1, 0.3, 0.04, 6), { w: 0.95, c: pn, m: M.conte, p: R.r(0.42, 0.6) });
            else C.stroke(P.line(R, x0, y0, x1, y1, 0.3, 0.04, 6), { w: 1.05, c: z === 1 ? pt : pd, m: M.pencil, p: R.r(0.5, 0.75) });
          });
      }
      // a row of ornament riding in the band
      const orn = j === 0 ? 0 : [1, 6, 0, 2, 5, 4, 0, 7, 1, 3, 8, 0, 5, 2, 6, 4][j % 16];
      if (orn) {
        const step = orn === 1 ? R.r(6, 8) : orn === 2 ? thick * 0.8 : orn === 3 ? thick * 0.42 : orn === 4 ? R.r(4.6, 6) : orn === 6 ? thick * 0.75 : orn === 7 ? thick * 0.5 : orn === 8 ? thick * 0.7 : R.r(58, 80);
        let th = 0, q = 0; const so = sm + (orn === 1 ? (R() - 0.5) * 0.5 * ds : 0), pat = [R.i(0, 23), R.i(0, 23), R.i(0, 23)];
        let zig = [];
        const flushZig = () => { if (zig.length >= 6) { const k = (zig.length >> 2) << 1, z = zone(R, zig[k], zig[k + 1], 0.16); C.stroke(P.wob(R, zig, 0.3, 20), z === 0 ? { w: 1.1, c: PAL.chalk, m: M.chalk, p: 0.66 } : { w: 1.2, c: z === 1 ? PAL.indigoP : R.pick([PAL.vermP, PAL.tealP, PAL.violetP]), m: M.pencil, p: 0.85 }); } zig = []; };
        while (th < PI) {
          const p = MT.pt(so, th), ok = Wd.inSky(p[0], p[1], thick * 0.42), z = ok ? zone(R, p[0], p[1], 0.16) : 0, rot = PI / 2 - th;
          const lightSt = z === 0 ? { c: R.chance(0.85) ? PAL.chalk : PAL.nightLight[0], m: M.chalk, w: 1.1, p: 0.7 } : z === 1 ? { c: R.chance(0.5) ? PAL.chalk : PAL.indigoP, m: R.chance(0.5) ? M.chalk : M.pencil, w: 1.15, p: 0.8 } : { c: R.pick([PAL.vermP, PAL.roseP, PAL.tealP, PAL.violetP]), m: M.pencil, w: 1.2, p: 0.85 };
          if (orn === 3 || orn === 7) { // zigzag or slow wave: one continuous line
            if (ok) { const p2 = MT.pt(so + (orn === 3 ? (q % 2 ? 0.26 : -0.26) : 0.2 * Math.sin(q * 0.8)) * ds, th); zig.push(p2[0], p2[1]); } else flushZig();
          } else if (ok) {
            if (orn === 1) C.dab(p[0] + R.g() * 0.4, p[1] + R.g() * 0.4, R.r(0.8, 1.3), lightSt.c, z === 2 ? M.conte : M.chalk, 0.8);
            else if (orn === 2) { // scallops
              const dq = step * 0.46 / (MT.R(th) * so), a0 = MT.pt(so - 0.2 * ds, th - dq), a05 = MT.pt(so + 0.14 * ds, th - dq * 0.62), a1 = MT.pt(so + 0.26 * ds, th), a15 = MT.pt(so + 0.14 * ds, th + dq * 0.62), a2 = MT.pt(so - 0.2 * ds, th + dq);
              C.stroke(P.wob(R, P.spline([a0, a05, a1, a15, a2], 2.5), 0.3, 12), lightSt);
            } else if (orn === 4) { // short ticks standing across the band
              const a0 = MT.pt(so - R.r(0.2, 0.3) * ds, th), a1 = MT.pt(so + R.r(0.2, 0.3) * ds, th + R.g() * 0.002); C.stroke(P.line(R, a0[0], a0[1], a1[0], a1[1], 0.25, 0.05, 4), lightSt);
            } else if (orn === 5) Wd.sign(C, R, pat[q % 3], p[0], p[1], thick * 0.56, rot + R.g() * 0.08, lightSt, { sloppy: 1.1 });
            else if (orn === 6) C.stroke(P.circle(R, p[0], p[1], thick * R.r(0.17, 0.22), 1.12, 0.1), lightSt);
            else if (orn === 8) { const r = thick * 0.2, a = R.g() * 0.2 + rot; for (const k of [0.785, -0.785]) C.stroke(P.line(R, p[0] - Math.cos(a + k) * r, p[1] - Math.sin(a + k) * r, p[0] + Math.cos(a + k) * r, p[1] + Math.sin(a + k) * r, 0.2, 0.05, 3), lightSt); }
          }
          q++; th += step * R.r(0.92, 1.08) / (MT.R(th) * so);
        }
        flushZig();
      }
    }
  };

  S.stars = function (C, R) {
    // the finest marks: a sleet of chalk at the hand's angle, thickest close round the place where the mound was
    for (let i = 0; i < 9000; i++) {
      const x = R.r(50, 1550), y = R.r(50, 650); if (!Wd.inSky(x, y, 4)) continue;
      const d = Wd.dawn(x, y), s = MT.sOf(x, y); if (R() < d * 1.4 || R() > 0.16 + 0.84 * Math.exp(-(s - 1) * 5.5)) continue;
      const l = R.r(1.5, 4.5), a = Wd.HAND + R.g() * 0.12;
      C.stroke([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l], { w: R.r(0.8, 1.2), c: R.chance(0.2) ? PAL.nightLight[0] : PAL.chalk, m: M.chalk, p: R.r(0.55, 0.82), ti: 0, to: 0.4 });
    }
    for (let i = 0; i < 2600; i++) {
      const x = R.r(50, 1550), y = R.r(50, 650); if (!Wd.inSky(x, y, 3)) continue;
      const d = Wd.dawn(x, y); if (R() < d * 1.25) continue;
      const big = R() < 0.07;
      C.dab(x, y, big ? R.r(1.4, 2.2) : R.r(0.6, 1.2), R.chance(0.12) ? [0.98, 0.9, 0.66] : R.chance(0.15) ? PAL.nightLight[0] : PAL.chalk, M.chalk, big ? 0.9 : R.r(0.6, 0.85));
    }
    // a few stars drawn the way a child draws them
    for (let i = 0; i < 60; i++) {
      const x = R.r(60, 1100), y = R.r(60, 600); if (!Wd.inSky(x, y, 10) || Wd.dawn(x, y) > 0.35) continue;
      Wd.sign(C, R, 16, x, y, R.r(6, 11), R() * 3, { c: PAL.chalk, m: M.chalk, w: 1.0, p: 0.7 }, { sloppy: 1.4 });
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
