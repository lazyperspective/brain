/* Fable 5.2: A Field Guide. The world: a floating island that is a giant effort dial.
   Seen from above it is a knob: a violet hub in the middle and five terraced segments around it, each a step higher
   than the last (LOW, MEDIUM, HIGH, XHIGH, MAX), ending at a cliff where MAX drops back down to LOW. Angles are measured
   clockwise from north (-z): HIGH faces north, MAX south-east, the cliff south-south-west. */
(function (root) {
  'use strict';
  var FG = root.FG, M = FG.mat, V = FG.v, m = FG.m, C = FG.C;
  var D2R = Math.PI / 180;

  var W = FG.W = {};
  W.R = 16;            // top surface radius
  W.HUB = 2.3;         // hub radius
  W.HUB_TOP = 2.95;    // hub top height
  W.SEG = [            // name, from, to (deg), height; MAX drops back to LOW at the cliff (due south)
    { name: 'LOW', a0: -180, a1: -108, h: 0.0 },
    { name: 'MEDIUM', a0: -108, a1: -36, h: 0.55 },
    { name: 'HIGH', a0: -36, a1: 36, h: 1.1 },
    { name: 'XHIGH', a0: 36, a1: 108, h: 1.75 },
    { name: 'MAX', a0: 108, a1: 180, h: 2.4 }
  ];
  function normA(a) { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; }
  W.segH = function (a) {
    a = normA(a);
    for (var i = 0; i < W.SEG.length; i++) if (a > W.SEG[i].a0 && a <= W.SEG[i].a1) return W.SEG[i].h;
    return W.SEG[4].h;
  };
  W.pol = function (a, r, h) { return [r * Math.sin(a * D2R), h == null ? W.ground(a, r) : h, -r * Math.cos(a * D2R)]; };
  W.angleOf = function (x, z) { return Math.atan2(x, -z) / D2R; };

  /* ---------------------------------------------------------------- sites (where the beats happen) */
  var S = W.S = {};
  S.think = { a: 0, r: 10 };
  S.key = { a: -60, r: 10.2 };
  S.clear = { a: -88, r: 10 };
  S.village = { a: -128, r: 10.4 };
  S.mine = { a: -160, r: 10.2 };
  S.cliffTop = { a: 173, r: 10.4 };
  S.clones = { a: 165, r: 8.6 };
  S.notes = { a: 148, r: 11.0 };
  S.scroll = { a: 128, r: 10.6 };
  S.peg = { a: 177, r: 13.9 };
  var FLATS = [S.think, S.key, S.clear, S.village, S.mine, S.cliffTop, S.clones, S.notes, S.scroll, S.peg];
  FLATS.forEach(function (s) { s.p = [s.r * Math.sin(s.a * D2R), 0, -s.r * Math.cos(s.a * D2R)]; });

  function flatMask(x, z) {
    var k = 1;
    for (var i = 0; i < FLATS.length; i++) { var d = Math.hypot(x - FLATS[i].p[0], z - FLATS[i].p[2]); k = Math.min(k, m.ss(2.4, 4.2, d)); }
    var r = Math.hypot(x, z);
    k = Math.min(k, m.ss(W.HUB + 0.4, W.HUB + 1.6, r));
    return k;
  }
  W.noiseH = function (x, z) {
    var n = (m.vn2(x * 0.42 + 3.1, z * 0.42 - 1.7, 11) - 0.5) * 0.32 + (m.vn2(x * 1.1, z * 1.1, 12) - 0.5) * 0.08;
    var r = Math.hypot(x, z);
    var lip = m.ss(W.R - 1.1, W.R - 0.15, r) * 0.18;
    return n * flatMask(x, z) + lip;
  };
  W.ground = function (a, r) { var x = r * Math.sin(a * D2R), z = -r * Math.cos(a * D2R); return W.segH(a) + W.noiseH(x, z); };
  W.groundXZ = function (x, z) { return W.segH(W.angleOf(x, z)) + W.noiseH(x, z); };

  /* ---------------------------------------------------------------- the dial's end-stop peg, at the top of MAX by the cliff */
  W.PEG_A = 177; W.PEG_R = 13.9; W.PEG_H = 0.62;
  W.PEG = [W.PEG_R * Math.sin(W.PEG_A * D2R), 0, -W.PEG_R * Math.cos(W.PEG_A * D2R)];
  /* ---------------------------------------------------------------- the keycap with the canyon (MEDIUM) */
  W.KEY = (function () {
    var s = S.key, c = [s.r * Math.sin(s.a * D2R), 0.55, -s.r * Math.cos(s.a * D2R)];
    var t = [Math.cos(s.a * D2R), 0, Math.sin(s.a * D2R)];          // tangent (clockwise direction)
    var rd = [Math.sin(s.a * D2R), 0, -Math.cos(s.a * D2R)];        // radial outward
    return { c: c, t: t, rd: rd, half: 3.0, top: 0.55 + 0.95, gap: 2.2, legend: 'K' };
  })();
  // world position on the key from (u along the crossing direction = counter-clockwise, v radial) relative to the key centre
  W.keyP = function (u, v, y) { var K = W.KEY; return [K.c[0] - K.t[0] * u + K.rd[0] * v, y == null ? K.top : y, K.c[2] - K.t[2] * u + K.rd[2] * v]; };

  /* ---------------------------------------------------------------- static build */
  W.buildStatic = function (B) {
    var rnd = m.mulberry(9177);
    var RINGS = [2.0, 2.8, 3.6, 4.4, 5.2, 6.3, 7.4, 8.5, 9.6, 10.7, 11.8, 12.9, 14.0, 15.0, 15.6, 16.0];
    var NS = 120, DA = 360 / NS;
    function jr(i, j) { i = i % NS; if (j === 0 || j === RINGS.length - 1) return 0; return (m.hash(i * 31 + 7, j * 17 + 3) - 0.5) * 0.42; }
    function ja(i, j) { i = i % NS; if (i % 12 === 0 || j === RINGS.length - 1) return 0; return (m.hash(i * 13 + 5, j * 29 + 1) - 0.5) * DA * 0.5; }
    function vtx(i, j, side) {
      var a = -180 + i * DA + ja(i, j), r = RINGS[j] + jr(i, j);
      var x = r * Math.sin(a * D2R), z = -r * Math.cos(a * D2R);
      var segA = a + side * 0.01;
      return [x, W.segH(segA) + W.noiseH(x, z), z];
    }
    var ARC = [FG.col.srgb(0xd3c9f6), FG.col.srgb(0xbcb0f0), FG.col.srgb(0xa597e6), FG.col.srgb(0x8b7dda), FG.col.srgb(0x6f61c8)];
    function terrCol(x, z, a, h, ny) {
      var n = m.vn2(x * 0.33 + 7, z * 0.33 - 2, 21), n2 = m.hash(Math.floor(x * 7.1) * 911 + Math.floor(z * 7.3), 5);
      if (Math.hypot(x, z) > 14.75) {
        // the gauge arc round the rim: pale lilac at LOW deepening to violet at MAX
        var sa = normA(a), si = sa <= -108 ? 0 : sa <= -36 ? 1 : sa <= 36 ? 2 : sa <= 108 ? 3 : 4;
        return FG.col.mul(ARC[si], 0.95 + 0.1 * n2);
      }
      var seg = W.segH(a), hi = seg >= 1.7;
      var col;
      if (n > 0.6) col = n2 < 0.5 ? C.sage : C.sage2;
      else if (n > 0.53) col = n2 < 0.5 ? C.teal : C.teal2;
      else col = n2 < 0.33 ? C.sand : n2 < 0.66 ? C.cream : C.sand2;
      if (hi && n < 0.4) col = FG.col.mix(col, C.lilacHi, 0.35);
      var tint = 0.93 + 0.12 * n2;
      return FG.col.mul(col, tint);
    }
    // top surface, sector by sector (each sector evaluates its own segment height so steps stay crisp)
    for (var i = 0; i < NS; i++) {
      var amid = -180 + (i + 0.5) * DA;
      for (var j = 0; j < RINGS.length - 1; j++) {
        var A = vtx(i, j, 1), Bv = vtx(i + 1, j, -1), Cv = vtx(i + 1, j + 1, -1), Dv = vtx(i, j + 1, 1);
        var cx = (A[0] + Bv[0] + Cv[0] + Dv[0]) / 4, cz = (A[2] + Bv[2] + Cv[2] + Dv[2]) / 4;
        var below = [cx, -20, cz];
        if ((i + j) & 1) { B.polyW([A, Bv, Cv], terrCol(cx + 0.3, cz, amid, 0, 1), 0, 1, below); B.polyW([A, Cv, Dv], terrCol(cx - 0.3, cz + 0.2, amid, 0, 1), 0, 1, below); }
        else { B.polyW([A, Bv, Dv], terrCol(cx + 0.2, cz - 0.3, amid, 0, 1), 0, 1, below); B.polyW([Bv, Cv, Dv], terrCol(cx - 0.2, cz + 0.3, amid, 0, 1), 0, 1, below); }
      }
    }
    // step walls at segment boundaries and the cliff
    var walls = [-108, -36, 36, 108, 180];
    walls.forEach(function (wa) {
      var i = Math.round((wa + 180) / DA);
      for (var j = 0; j < RINGS.length - 1; j++) {
        var a0 = vtx(i, j, -1), b0 = vtx(i, j + 1, -1), a1 = vtx(i, j, 1), b1 = vtx(i, j + 1, 1);
        var hiSide = a0[1] > a1[1];
        var top0 = hiSide ? a0 : a1, top1 = hiSide ? b0 : b1, bot0 = hiSide ? a1 : a0, bot1 = hiSide ? b1 : b0;
        var cliff = wa === 180;
        var n = (j * 7 + 3) % 5, col = cliff ? (n < 2 ? C.sand2 : n < 4 ? C.sandD : C.clay) : (n < 3 ? C.sand2 : C.sandD);
        var out = hiSide ? -1 : 1, aw = wa * D2R, tdir = [Math.cos(aw) * out, 0, Math.sin(aw) * out];
        var ctr = [(top0[0] + bot1[0]) / 2 - tdir[0], (top0[1] + bot0[1]) / 2, (top0[2] + bot1[2]) / 2 - tdir[2]];
        if (cliff) {
          // a rough cliff: split into two bands with a jagged middle
          var mid0 = V.lerp(bot0, top0, 0.5 + (m.hash(j, 77) - 0.5) * 0.2), mid1 = V.lerp(bot1, top1, 0.5 + (m.hash(j + 1, 77) - 0.5) * 0.2);
          mid0 = V.mad(mid0, tdir, 0.12 * m.hash(j, 78)); mid1 = V.mad(mid1, tdir, 0.12 * m.hash(j + 1, 78));
          B.polyW([bot0, bot1, mid1, mid0], FG.col.mul(C.sandD, 0.95), 0, 0, ctr);
          B.polyW([mid0, mid1, top1, top0], FG.col.mul(col, 1.0), 0, 0, ctr);
        } else B.polyW([bot0, bot1, top1, top0], col, 0, 0, ctr);
      }
    });
    // outer wall and the underside (an inverted faceted cone with strata)
    var UND = [[16.0, -0.35], [15.3, -1.5], [13.4, -3.2], [10.6, -5.4], [7.4, -7.8], [4.2, -10.2], [1.6, -12.4], [0.0, -13.8]];
    var NU = 40;
    function uv(i, k) {
      if (k === 0) return null;
      var a = i / NU * 360 + (m.hash(i, k * 3 + 1) - 0.5) * 4, R = UND[k][0] * (1 + (m.hash(i, k * 5 + 2) - 0.5) * (k > 0 ? 0.18 : 0)), y = UND[k][1] + (m.hash(i, k * 7 + 3) - 0.5) * 0.9 * (k > 1 ? 1 : 0.3);
      if (k === UND.length - 1) return [0, y, 0];
      return [R * Math.sin(a * D2R), y, -R * Math.cos(a * D2R)];
    }
    var rimTop = function (a) { var x = 16 * Math.sin(a * D2R), z = -16 * Math.cos(a * D2R); return [x, W.segH(a) + W.noiseH(x, z), z]; };
    var STRATA = [C.sand2, C.clay, C.rock, C.rockD, C.rockDD, C.rockDD, C.rockDD];
    for (i = 0; i < NS; i++) {
      // wall from the rim top down to the first underside ring
      var a0 = -180 + i * DA, a1 = a0 + DA;
      var t0 = rimTop(a0 + 0.01), t1 = rimTop(a1 - 0.01);
      var b0 = [t0[0] * 1.0, -0.35, t0[2]], b1 = [t1[0], -0.35, t1[2]];
      var sa0 = normA(a0 + DA / 2), si0 = sa0 <= -108 ? 0 : sa0 <= -36 ? 1 : sa0 <= 36 ? 2 : sa0 <= 108 ? 3 : 4;
      var wc = FG.col.mul(ARC[si0], (i % 2) ? 0.82 : 0.74);
      B.polyW([b0, b1, t1, t0], wc, 0, 0, [0, -2, 0]);
    }
    // close the cliff/steps on the outer wall: handled by the per-sector wall above (each sector's own heights)
    for (i = 0; i < NU; i++) {
      for (var k = 0; k < UND.length - 1; k++) {
        var p00 = k === 0 ? [16 * Math.sin(i / NU * 360 * D2R), -0.35, -16 * Math.cos(i / NU * 360 * D2R)] : uv(i, k);
        var p10 = k === 0 ? [16 * Math.sin((i + 1) / NU * 360 * D2R), -0.35, -16 * Math.cos((i + 1) / NU * 360 * D2R)] : uv((i + 1) % NU, k);
        var p01 = uv(i, k + 1), p11 = uv((i + 1) % NU, k + 1);
        var sc = STRATA[k], tn = 0.85 + 0.25 * m.hash(i, k + 40);
        B.polyW([p00, p10, p11], FG.col.mul(sc, tn), 0, 0, [0, -4, 0]);
        if (k < UND.length - 2) B.polyW([p00, p11, p01], FG.col.mul(STRATA[Math.min(k + 1, 6)], 0.9 + 0.2 * m.hash(i, k + 60)), 0, 0, [0, -4, 0]);
      }
    }
    // the hub: a knurled violet knob with a cream pointer toward HIGH
    var HN = 24;
    for (i = 0; i < HN; i++) {
      var aa0 = i / HN * Math.PI * 2, aa1 = (i + 1) / HN * Math.PI * 2, rr = (i & 1) ? W.HUB : W.HUB - 0.09;
      var q0 = [Math.cos(aa0) * rr, -0.4, Math.sin(aa0) * rr], q1 = [Math.cos(aa1) * rr, -0.4, Math.sin(aa1) * rr];
      var q2 = [q1[0], W.HUB_TOP - 0.22, q1[2]], q3 = [q0[0], W.HUB_TOP - 0.22, q0[2]];
      B.polyW([q0, q1, q2, q3], (i & 1) ? C.lilac2 : FG.col.mix(C.lilac2, C.violet, 0.6), 0.04, 0, [0, 1, 0]);
      var r2 = W.HUB - 0.28, q4 = [Math.cos(aa1) * r2, W.HUB_TOP, Math.sin(aa1) * r2], q5 = [Math.cos(aa0) * r2, W.HUB_TOP, Math.sin(aa0) * r2];
      B.polyW([q3, q2, q4, q5], C.lilac2, 0, 0, [0, 0, 0]);
    }
    var topP = []; for (i = 0; i < HN; i++) { var aa = i / HN * Math.PI * 2; topP.push([Math.cos(aa) * (W.HUB - 0.28), W.HUB_TOP, Math.sin(aa) * (W.HUB - 0.28)]); }
    B.polyW(topP, C.lilac, 0, 0, [0, 0, 0]);
    B.chamfer([0, W.HUB_TOP + 0.06, -1.3], [0.15, 0.07, 0.75], 0.05, C.cream, 0.05, C.white);
    B.chamfer([0, W.HUB_TOP + 0.04, 0], [0.42, 0.05, 0.42], 0.08, C.lilacHi, 0);
    // dial ticks on the rim (cream), larger at segment centres
    for (var ta = -174; ta <= 174; ta += 6) {
      var major = (ta + 144) % 72 === 0, edge = (ta + 180) % 72 === 0 && ta !== 180;
      var rt = 15.35, p = W.pol(ta, rt);
      B.push(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(-ta * D2R)));
      if (major) B.chamfer([0, 0.12, 0], [0.16, 0.16, 0.42], 0.05, C.cream, 0.04, C.white);
      else if (edge) B.chamfer([0, 0.1, 0], [0.1, 0.13, 0.36], 0.04, C.lilac, 0.05, C.lilacHi);
      else B.chamfer([0, 0.06, 0], [0.06, 0.07, 0.22], 0.03, C.paperD, 0, C.cream);
      B.pop();
    }
    // the keycap row on MEDIUM: J, K (cracked), L, set into the ground along the radius
    var K = W.KEY;
    function keycap(v0, legend, cracked) {
      var c = V.mad(K.c, K.rd, v0), hw = K.half, ht = K.top - K.c[1];
      var X = [-K.t[0], 0, -K.t[2]], Z = K.rd;
      B.push(M.basis(X, [0, 1, 0], Z, [c[0], K.c[1] - 0.25, c[2]]));
      var top = ht + 0.25;
      function capHalf(u0, u1) {
        // a tapered keycap block from u0..u1 across (x), full depth (z)
        var b = 0.25, tp = 0.22;
        var xs0 = u0 <= -hw + 1e-6 ? -hw : u0, xs1 = u1 >= hw - 1e-6 ? hw : u1;
        var xt0 = u0 <= -hw + 1e-6 ? -hw + tp : u0, xt1 = u1 >= hw - 1e-6 ? hw - tp : u1;
        var bot = [[xs0, 0, -hw], [xs1, 0, -hw], [xs1, 0, hw], [xs0, 0, hw]];
        var tpq = [[xt0, top, -hw + tp], [xt1, top, -hw + tp], [xt1, top, hw - tp], [xt0, top, hw - tp]];
        var ctr = [(xs0 + xs1) / 2, top / 2, 0];
        B.poly(tpq, C.key, 0, 0, ctr);
        for (var q = 0; q < 4; q++) { var r = (q + 1) % 4; B.poly([bot[q], bot[r], tpq[r], tpq[q]], (q === 0 || q === 2) ? C.keyS : C.keyS, 0, 0, ctr); }
        // dished top rim
        B.poly([[xt0 + 0.05, top + 0.004, -hw + tp + 0.05], [xt1 - 0.05, top + 0.004, -hw + tp + 0.05], [xt1 - 0.05, top + 0.004, -hw + tp + 0.2], [xt0 + 0.05, top + 0.004, -hw + tp + 0.2]], FG.col.mix(C.key, C.keyS, 0.3), 0, 0, [0, -5, 0]);
      }
      if (!cracked) capHalf(-hw, hw);
      else {
        var g = K.gap / 2;
        capHalf(-hw, -g); capHalf(g, hw);
        // the abyss: dark bands deepening toward the bottom of the crack (unlit), then the jagged walls
        B.poly([[-g, top * 0.62, -hw], [g, top * 0.62, -hw], [g, top * 0.62, hw], [-g, top * 0.62, hw]], [0.05, 0.03, 0.09], 0, 2, [0, top, 0]);
        B.poly([[-g, top * 0.62, hw], [g, top * 0.62, hw], [g, top + 0.25, hw], [-g, top + 0.25, hw]], [0.10, 0.07, 0.16], 0, 2, [0, top, 0]);
        B.poly([[-g, top * 0.62, -hw], [g, top * 0.62, -hw], [g, top + 0.25, -hw], [-g, top + 0.25, -hw]], [0.10, 0.07, 0.16], 0, 2, [0, top, 0]);
        // jagged canyon walls inside the crack and a dark floor far below
        for (var zz = -hw + 0.25; zz < hw - 0.25; zz += 0.5) {
          for (var sd = -1; sd <= 1; sd += 2) {
            var jx = sd * (g - 0.05 + 0.1 * m.hash(Math.round(zz * 10), sd + 5));
            B.poly([[sd * g, top, zz], [sd * g, top, zz + 0.5], [jx, top * 0.5, zz + 0.5], [jx, top * 0.5, zz]], C.keyD, 0, 0, [0, top / 2, 0]);
            B.poly([[jx, top * 0.5, zz], [jx, top * 0.5, zz + 0.5], [sd * g, top * 0.6, zz + 0.5], [sd * g, top * 0.6, zz]], FG.col.mix(C.rockD, C.rockDD, 0.6), 0, 0, [0, top / 2, 0]);
          }
        }
      }
      B.pop();
      return { c: c, top: K.c[1] - 0.25 + top };
    }
    keycap(0, 'K', true);
    // a dark crack continuing out of the key into the ground (the canyon), as a sunken strip
    // the mine: a timber frame over a dark hole, a lantern on a post (the glow is dynamic)
    var mp = W.pol(S.mine.a, S.mine.r), mf = V.norm([-mp[0], 0, -mp[2]]);
    W.MINE = { p: mp, hole: [mp[0], mp[1] + 0.012, mp[2]] };
    // stones round the hole
    for (i = 0; i < 11; i++) {
      var sa = i / 11 * Math.PI * 2, sr = 0.68 + 0.05 * m.hash(i, 3);
      B.push(M.mul(M.trans(mp[0] + Math.cos(sa) * sr, mp[1] + 0.04, mp[2] + Math.sin(sa) * sr), M.rotY(sa)));
      B.ico(0, 0.13 + 0.04 * m.hash(i, 4), FG.col.mix(C.rock, C.sandD, 0.4 + 0.3 * m.hash(i, 5)), 0, 0, 0.25, 40 + i);
      B.pop();
    }
    // timber frame (two posts and a beam), set back from the hole
    var side = V.norm(V.cross([0, 1, 0], mf));
    for (var sdd = -1; sdd <= 1; sdd += 2) {
      var pp = V.mad(V.mad(mp, side, sdd * 0.82), mf, -0.35);
      B.chamfer([pp[0], mp[1] + 0.62, pp[2]], [0.07, 0.62, 0.07], 0.02, C.wood, 0, C.woodL);
    }
    var beamC = V.mad(mp, mf, -0.35);
    B.push(M.basis(side, [0, 1, 0], mf, [beamC[0], mp[1] + 1.24, beamC[2]]));
    B.chamfer([0, 0, 0], [0.98, 0.07, 0.08], 0.02, C.woodD, 0, C.wood);
    B.pop();
    // the end-stop peg (where the dial stops turning): a gold-capped cream post at the rim of MAX
    W.PEG[1] = W.groundXZ(W.PEG[0], W.PEG[2]);
    B.push(M.trans(W.PEG[0], W.PEG[1] - 0.25, W.PEG[2]));
    B.cyl(10, 0.78, 0.72, 0, W.PEG_H + 0.25 - 0.08, C.cream, 0.03, C.cream);
    B.cyl(10, 0.74, 0.7, W.PEG_H + 0.25 - 0.1, W.PEG_H + 0.25, C.goldD, 0.06, C.gold);
    B.pop();
    // the hole on the cliff top (where it comes back out)
    var ct = W.pol(S.cliffTop.a, S.cliffTop.r);
    W.TOPHOLE = { p: ct, hole: [ct[0], ct[1] + 0.012, ct[2]] };
    for (i = 0; i < 9; i++) {
      var sa2 = i / 9 * Math.PI * 2;
      B.push(M.trans(ct[0] + Math.cos(sa2) * 0.62, ct[1] + 0.03, ct[2] + Math.sin(sa2) * 0.62));
      B.ico(0, 0.11 + 0.04 * m.hash(i, 13), FG.col.mix(C.rock, C.sandD, 0.5), 0, 0, 0.25, 70 + i);
      B.pop();
    }
    // scattery: little trees and rocks (LOW/MEDIUM/HIGH), crystal spires (XHIGH/MAX)
    var placed = 0;
    // keep the camera's path (and its line of sight) clear of trees and rocks
    var CS = [];
    if (FG.cameraAt) for (var ct = 0; ct <= 40; ct += 0.1) { var cc = FG.cameraAt(ct); CS.push([cc.eye[0], cc.eye[2], cc.tgt[0], cc.tgt[2]]); }
    function nearCam(x, z) {
      for (var q = 0; q < CS.length; q++) {
        var c = CS[q], dx = c[2] - c[0], dz = c[3] - c[1], l2 = dx * dx + dz * dz || 1, u = m.clamp(((x - c[0]) * dx + (z - c[1]) * dz) / l2, 0, 1);
        if (Math.hypot(x - (c[0] + dx * u), z - (c[1] + dz * u)) < 1.4) return true;
      }
      return false;
    }
    for (var tries = 0; tries < 700 && placed < 64; tries++) {
      var ra = rnd() * 360 - 180, rr2 = 4.6 + rnd() * 10.6;
      var x = rr2 * Math.sin(ra * D2R), z = -rr2 * Math.cos(ra * D2R);
      if (flatMask(x, z) < 0.98) continue;
      // keep clear of the keycaps, the walls and the path ring
      if (Math.hypot(x - K.c[0], z - K.c[2]) < 4.2) continue;
      var nearWall = walls.some(function (wa) { return Math.abs(normA(ra - wa)) < 3.5; });
      if (nearWall) continue;
      if (Math.abs(rr2 - 10.2) < 1.6 && rnd() < 0.85) continue;
      if (nearCam(x, z)) continue;
      var y = W.groundXZ(x, z), segh = W.segH(ra);
      B.push(M.mul(M.trans(x, y, z), M.rotY(rnd() * 6.28)));
      if (segh >= 1.7) {
        // crystal cluster
        var nC = 2 + Math.floor(rnd() * 3);
        for (var q = 0; q < nC; q++) {
          var hgt = 0.5 + rnd() * (segh > 2 ? 1.5 : 0.9);
          B.push(M.mul(M.mul(M.trans((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5), M.rotZ((rnd() - 0.5) * 0.5)), M.rotX((rnd() - 0.5) * 0.5)));
          B.cyl(5, 0.14 + rnd() * 0.08, 0.0, 0, hgt, rnd() < 0.5 ? C.crystal : C.lilac, 0.18, null, 0, rnd() * 3);
          B.pop();
        }
      } else if (rnd() < 0.62) {
        // a low-poly tree: trunk and two stacked faceted canopies
        var th = 0.35 + rnd() * 0.25, cc = rnd() < 0.5 ? C.sage2 : C.teal2;
        B.cyl(5, 0.07, 0.05, 0, th, C.woodD, 0);
        B.push(M.trans(0, th + 0.32, 0)); B.ico(0, 0.42 + rnd() * 0.12, cc, 0, 0, 0.18, 300 + tries); B.pop();
        B.push(M.trans(0.1, th + 0.68, 0.05)); B.ico(0, 0.28, FG.col.mix(cc, C.sage, 0.5), 0, 0, 0.18, 400 + tries); B.pop();
      } else {
        B.ico(0, 0.22 + rnd() * 0.25, FG.col.mix(C.rock, C.sand2, rnd() * 0.6), 0, 0, 0.3, 500 + tries);
      }
      B.pop();
      placed++;
    }
  };

  /* ---------------------------------------------------------------- floating labels and sky letters (dynamic) */
  // the dial's labels: giant faceted letters floating just beyond the rim, which slowly turn to face the viewer
  W.LABELS = W.SEG.map(function (s) {
    var a = (s.a0 + s.a1) / 2, r = 19.2;
    var p = [r * Math.sin(a * D2R), s.h + 3.6, -r * Math.cos(a * D2R)];
    return { word: s.name, p: p, a: a };
  });
  W.buildLabels = function (B, t, eye) {
    var e2 = FG.cameraAt ? FG.cameraAt(Math.max(0, t - 0.6)).eye : eye;
    var gather = m.ss(35.4, 38.3, t);
    W.LABELS.forEach(function (L, i) {
      var bob = Math.sin(t * 0.5 + i * 1.7) * 0.18 * (1 - 0.6 * gather), rock = Math.sin(t * 0.37 + i) * 0.04;
      var near = L.word === 'LOW' || L.word === 'MAX', top = L.word === 'HIGH';
      // at the end they gather into a gauge's scale, arching over the far rim: LOW left .. HIGH on top .. MAX right
      var ARCH = { LOW: [-37, 2.3], MEDIUM: [-19.5, 4.35], HIGH: [0, 5.25], XHIGH: [19.5, 4.35], MAX: [37, 2.3] }[L.word];
      var a0 = L.a, a1 = ARCH[0], aa = m.lerp(a0, a1, gather), a = aa * D2R;
      var r = m.lerp(19.2, 21.0, gather);
      var p = [r * Math.sin(a), m.lerp(L.p[1], ARCH[1], gather), -r * Math.cos(a)];
      var yaw = Math.atan2(e2[0] - p[0], e2[2] - p[2]);
      var pit = Math.atan2(e2[1] - p[1], Math.hypot(e2[0] - p[0], e2[2] - p[2]));
      B.push(M.mul(M.mul(M.trans(p[0], p[1] + bob, p[2]), M.rotY(yaw)), M.mul(M.rotZ(rock), M.rotX(-0.12 - 0.6 * pit * gather))));
      FG.blockWord(B, L.word, m.lerp(0.32, 0.235, gather), { col: C.cream, colTop: C.white, th: 1.25, dep: 1.3, gap: 1.6, emis: 0.08 });
      B.pop();
    });
  };
  var SKYL = [];
  (function () {
    var r = m.mulberry(4401), chars = ['?', '{', 'A', '&', '}', '@', 'K', '#', 'Q', 'Y', 'R', 'Z'];
    for (var i = 0; i < chars.length; i++) {
      var a = i / chars.length * 360 + r() * 20, d = 34 + r() * 22, y = -6 + r() * 22;
      SKYL.push({ ch: chars[i], p: [d * Math.sin(a * D2R), y, -d * Math.cos(a * D2R)], s: 0.55 + r() * 0.5, sp: (r() - 0.5) * 0.25, ph: r() * 6.28, tilt: (r() - 0.5) * 0.6 });
    }
  })();
  W.buildSkyLetters = function (B, t) {
    SKYL.forEach(function (L, i) {
      var p = [L.p[0] + Math.sin(t * 0.08 + L.ph) * 1.5, L.p[1] + Math.sin(t * 0.21 + L.ph) * 0.6, L.p[2] + Math.cos(t * 0.07 + L.ph) * 1.5];
      B.push(M.mul(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(L.ph + t * L.sp)), M.rotZ(L.tilt)));
      FG.blockWord(B, L.ch, L.s, { col: i % 3 === 0 ? C.lilacHi : i % 3 === 1 ? C.cream : C.lilac, colTop: C.white, th: 1.25, dep: 1.4, emis: 0.03 });
      B.pop();
    });
  };
  // drifting faceted clouds around and below the island
  var CLOUDS = [];
  (function () {
    var r = m.mulberry(8123);
    for (var i = 0; i < 16; i++) {
      var a = r() * 360, d = 22 + r() * 30, y = i < 7 ? -9 - r() * 7 : -2 + r() * 12;
      var puffs = [], np = 4 + Math.floor(r() * 4), sz = 1.6 + r() * 2.2;
      for (var k = 0; k < np; k++) puffs.push([(k - np / 2) * sz * 0.75 + (r() - 0.5) * sz * 0.4, (r() - 0.3) * sz * 0.35, (r() - 0.5) * sz * 0.6, sz * (0.55 + r() * 0.5)]);
      CLOUDS.push({ p: [d * Math.sin(a * D2R), y, -d * Math.cos(a * D2R)], puffs: puffs, sp: 0.12 + r() * 0.15, ph: r() * 6.28, rot: r() * 6.28 });
    }
  })();
  W.cloudCol = function (k, n) { var u = n[1] * 0.5 + 0.5; return FG.col.mix(FG.col.mix(C.lilacHi, C.cream, 0.5), C.white, u * 0.7); };
  W.buildClouds = function (B, t) {
    CLOUDS.forEach(function (Cl, i) {
      var p = [Cl.p[0] + Math.cos(Cl.ph) * t * Cl.sp, Cl.p[1] + Math.sin(t * 0.3 + Cl.ph) * 0.25, Cl.p[2] + Math.sin(Cl.ph) * t * Cl.sp];
      B.push(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(Cl.rot)));
      Cl.puffs.forEach(function (q, k) {
        B.push(M.mul(M.trans(q[0], q[1], q[2]), M.scale(1, 0.72, 1)));
        B.ico(1, q[3], null, 0.3, 0, 0.12, 700 + i * 10 + k, W.cloudCol);
        B.pop();
      });
      B.pop();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
