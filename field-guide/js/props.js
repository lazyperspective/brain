/* Fable 5.2: A Field Guide. Props. Every builder draws into the frame's builder B (and text into T) from parameters,
   so each prop is a pure function of the time-derived values the beats hand it. User things are lilac/violet; the
   hero and everything "alive" is coral; money and tokens are gold. */
(function (root) {
  'use strict';
  var FG = root.FG, M = FG.mat, V = FG.v, m = FG.m, C = FG.C;
  var P = FG.P = {};
  var INK = C.ink, INK_T = FG.col.srgb(0x2a1b17), CREAM_T = [1.0, 0.94, 0.86], VIOLET_T = FG.col.srgb(0x3b2f8f);

  /* ---------------------------------------------------------------- atlas entries (in-scene lettering) */
  FG.ATLAS_ENTRIES = {
    sign: { lines: ['ANSWER', 'DIRECTLY.', 'DON’T THINK.'], px: 92, font: 'FGDisplayBlack', lh: 1.06 },
    low: { lines: ['LOW'], px: 70, font: 'FGDisplayBlack' },
    high: { lines: ['HIGH'], px: 70, font: 'FGDisplayBlack' },
    med: { lines: ['MED'], px: 56, font: 'FGDisplayBlack' },
    effort: { lines: ['EFFORT'], px: 44, font: 'FGDisplayBlack' },
    ask: { lines: ['Want me', 'to continue?'], px: 66, font: 'FGDisplayXB', lh: 1.08 },
    banner: { lines: ['Yes, run the migration', 'on staging.'], px: 84, font: 'FGDisplayXB', lh: 1.12 },
    crown: { lines: ['YOU OWN THIS', 'CODEBASE'], px: 64, font: 'FGDisplayBlack', lh: 1.05 },
    tests: { lines: ['TESTS'], px: 56, font: 'FGDisplayBlack' },
    docs: { lines: ['DOCS'], px: 56, font: 'FGDisplayBlack' },
    tokens: { lines: ['TOKENS'], px: 50, font: 'FGDisplayBlack' },
    tokpct: { lines: ['+70–80%'], px: 84, font: 'FGDisplayBlack' },
    tok0: { lines: ['+0%'], px: 84, font: 'FGDisplayBlack' },
    tok1: { lines: ['+20%'], px: 84, font: 'FGDisplayBlack' },
    tok2: { lines: ['+45%'], px: 84, font: 'FGDisplayBlack' },
    tok3: { lines: ['+60%'], px: 84, font: 'FGDisplayBlack' },
    reg0: { lines: ['$0.00'], px: 76, font: 'FGDisplayBlack' },
    reg1: { lines: ['$0.40'], px: 76, font: 'FGDisplayBlack' },
    reg2: { lines: ['$1.20'], px: 76, font: 'FGDisplayBlack' },
    reg3: { lines: ['$2.80'], px: 76, font: 'FGDisplayBlack' },
    reg4: { lines: ['$6.00'], px: 76, font: 'FGDisplayBlack' },
    n0: { lines: ['never', 'retry'], px: 60, font: 'FGDisplayXB' },
    n1: { lines: ['ask', 'first'], px: 60, font: 'FGDisplayXB' },
    n2: { lines: ['stop at', 'first error'], px: 56, font: 'FGDisplayXB' },
    n3: { lines: ['NEVER', 'delete', 'files'], px: 56, font: 'FGDisplayBlack' },
    n4: { lines: ['never', 'guess'], px: 60, font: 'FGDisplayXB' },
    n5: { lines: ['always', 'ask'], px: 60, font: 'FGDisplayXB' },
    n6: { lines: ['never', 'refactor'], px: 56, font: 'FGDisplayXB' },
    n7: { lines: ['check', 'twice'], px: 60, font: 'FGDisplayXB' },
    n8: { lines: ['NEVER', 'push'], px: 60, font: 'FGDisplayBlack' },
    n9: { lines: ['wait for', 'review'], px: 56, font: 'FGDisplayXB' },
    clean: { lines: ['Ask for approval', 'before deleting', 'files.'], px: 58, font: 'FGDisplayXB', lh: 1.1 },
    card: { lines: ['Done.', 'Fixed the login bug.', '2 tests added.'], px: 64, font: 'FGDisplayXB', lh: 1.25, align: 'left' },
    j0: { lines: ['refactored the thing (see above)'], px: 56, font: 'FGBold' },
    j1: { lines: ['→ per prev. ctx ⇒ done-ish'], px: 56, font: 'FGBold' },
    j2: { lines: ['fixed X via Y (cf. §3)'], px: 56, font: 'FGBold' },
    j3: { lines: ['impl’d as discussed → ✓'], px: 56, font: 'FGBold' },
    j4: { lines: ['N.B. L42 ⇒ see other one'], px: 56, font: 'FGBold' },
    j5: { lines: ['s/foo/bar/ → ok (mostly)'], px: 56, font: 'FGBold' },
    j6: { lines: ['re: earlier ⇒ same as before'], px: 56, font: 'FGBold' },
    j7: { lines: ['ctx: the usual caveats'], px: 56, font: 'FGBold' },
    sym0: { lines: ['→'], px: 120, font: 'FGDisplayBlack' },
    sym1: { lines: ['⇒'], px: 120, font: 'FGDisplayBlack' },
    sym2: { lines: ['·.·'], px: 120, font: 'FGDisplayBlack' },
    sym3: { lines: ['§'], px: 120, font: 'FGDisplayBlack' },
    q: { lines: ['?'], px: 140, font: 'FGDisplayBlack' },
    chirp: { lines: ['chirp'], px: 50, font: 'FGDisplayXB' },
    dollar: { lines: ['$'], px: 120, font: 'FGDisplayBlack' },
    mine: { lines: ['MINE'], px: 56, font: 'FGDisplayBlack' },
    keyK: { lines: ['K'], px: 150, font: 'FGDisplayXB' },
    braces: { lines: ['{ }'], px: 110, font: 'FGDisplayBlack' }
  };

  /* ---------------------------------------------------------------- small helpers */
  P.basisY = function (p, yaw) { return M.mul(M.trans(p[0], p[1], p[2]), M.rotY(yaw)); };
  P.yawTo = function (from, to) { return Math.atan2(to[0] - from[0], to[2] - from[2]); };   // yaw so local +z points at 'to'
  // dust: a ring of faceted puffs expanding and shrinking away
  P.dust = function (B, p, t, size, n, seed, col) {
    if (t < 0 || t > 0.9) return;
    n = n || 8; size = size || 1;
    var u = t / 0.9, r = size * (0.35 + 0.9 * m.eo(u)), s = size * 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.4);
    if (s <= 0.004) return;
    for (var i = 0; i < n; i++) {
      var a = i / n * m.TAU + m.hash(i, seed || 1) * 0.6;
      B.push(M.trans(p[0] + Math.cos(a) * r, p[1] + 0.08 + u * 0.25 * size + m.hash(i, 9) * 0.1, p[2] + Math.sin(a) * r));
      B.ico(0, s * (0.7 + 0.6 * m.hash(i, (seed || 1) + 3)), col || FG.col.mix(C.sand, C.cream, 0.6), 0.05, 0, 0.2, i + (seed || 0) * 7);
      B.pop();
    }
  };
  // a camera-facing basis at p (x right, y up, z toward the camera)
  P.billboard = function (p, cam) { return M.basis(cam.right, cam.up, V.mul(cam.fwd, -1), p); };
  P.faceCam = function (p, eye) { var y = Math.atan2(eye[0] - p[0], eye[2] - p[2]); return M.mul(M.trans(p[0], p[1], p[2]), M.rotY(y)); };

  /* ---------------------------------------------------------------- thought cloud with gears and question marks */
  function gear(B, r, teeth, th, col, colTop, rot) {
    B.push(M.rotZ(rot));
    B.push(M.rotX(Math.PI / 2)); B.cyl(teeth * 2, r * 0.78, r * 0.78, -th, th, col, 0.04, colTop); B.pop();
    for (var i = 0; i < teeth; i++) {
      var a = i / teeth * m.TAU;
      B.push(M.mul(M.rotZ(a), M.trans(r * 0.88, 0, 0)));
      B.chamfer([0, 0, 0], [r * 0.16, r * 0.13, th * 0.95], r * 0.04, col, 0.04, colTop);
      B.pop();
    }
    B.push(M.rotX(Math.PI / 2)); B.cyl(8, r * 0.26, r * 0.26, -th * 1.3, th * 1.3, C.violetD, 0); B.pop();
    B.pop();
  }
  P.gear = gear;
  // o: { c (centre), s (scale), t, churn (0..1), gears (count), qs (count of ?), spin (speed), cam, puffT (array of trail puff times), head (point), deflate 0..1 }
  P.thought = function (B, o) {
    var s = o.s; if (s <= 0.01) return;
    var cam = o.cam, R = cam.right, U = cam.up, F = V.mul(cam.fwd, -1);
    var Mb = M.basis(R, U, F, o.c), t = o.t;
    B.push(Mb);
    var N = 11, df = o.deflate || 0;
    for (var i = 0; i < N; i++) {
      var a = i / N * m.TAU + 0.3, ring = i < 8;
      var px = ring ? Math.cos(a) * 1.15 : (i - 9) * 0.55, py = ring ? Math.sin(a) * 0.62 : 0.05 + (i === 9 ? 0.25 : -0.1), pz = ring ? -0.15 : -0.35;
      var ch = (o.churn || 0) * 0.08;
      px += Math.sin(t * 3.1 + i * 1.7) * ch; py += Math.cos(t * 2.7 + i * 2.3) * ch;
      var r = (ring ? 0.58 + 0.12 * m.hash(i, 3) : 0.85) * (1 + Math.sin(t * 4 + i) * 0.04 * (o.churn || 0));
      // deflating: puffs sag and wrinkle
      var sag = df * 0.25 * (py < 0 ? 1 : 0.4);
      B.push(M.mul(M.trans(px * s, (py - sag) * s, pz * s), M.mul(M.rotZ(t * 0.3 * (i & 1 ? 1 : -1) + i), M.scale(1 + df * 0.15, 1 - df * 0.35, 1))));
      B.ico(1, r * s, null, 0.2, 0, 0.1, 900 + i, function (k, n) { var u = n[1] * 0.5 + 0.5; return FG.col.mix(FG.col.mix(C.lilacHi, C.cream, 0.55), C.white, u * 0.8); });
      B.pop();
    }
    // gears in front
    var G = o.gears || 0, spin = o.spin || 1;
    var GP = [[-0.55, 0.08, 0.38, 0.30, 8], [0.42, 0.18, 0.42, 0.24, 7], [0.02, -0.28, 0.48, 0.18, 6], [-0.95, -0.22, 0.4, 0.15, 6], [0.95, -0.12, 0.4, 0.17, 6]];
    for (var g = 0; g < Math.min(G, GP.length); g++) {
      var q = GP[g], gs = m.clamp((G - g), 0, 1);
      B.push(M.trans(q[0] * s, q[1] * s, q[2] * s));
      gear(B, q[3] * s * gs, q[4], 0.05 * s, g % 2 ? C.gold : C.goldD, C.goldHi, t * spin * (g % 2 ? -2.2 : 2.6) * (8 / q[4]));
      B.pop();
    }
    // question marks (faceted)
    var QP = [[0.82, 0.55, 0.3], [-0.35, 0.62, 0.36], [-1.05, 0.35, 0.3], [1.15, 0.15, 0.25]];
    for (var k = 0; k < Math.min(o.qs || 0, QP.length); k++) {
      var qq = QP[k], bob = Math.sin(t * 5 + k * 2) * 0.06, rk = Math.sin(t * 3 + k) * 0.25;
      B.push(M.mul(M.trans(qq[0] * s, (qq[1] + bob) * s, qq[2] * s), M.rotZ(rk)));
      FG.blockWord(B, '?', 0.055 * s, { col: C.violet, colTop: C.lilac, th: 1.25, dep: 1.2 });
      B.pop();
    }
    B.pop();
    // trail puffs from the head
    if (o.head && o.puffs) {
      for (var j = 0; j < 3; j++) {
        var pu = o.puffs[j]; if (pu <= 0) continue;
        var w = (j + 1) / 4, pp = V.lerp(o.head, V.mad(o.c, U, -0.75 * s), w);
        B.push(M.trans(pp[0], pp[1], pp[2]));
        B.ico(1, (0.09 + j * 0.06) * pu * Math.max(0.6, s), null, 0.06, 0, 0.1, 950 + j, function () { return FG.col.mix(C.cream, C.white, 0.5); });
        B.pop();
      }
    }
  };

  /* ---------------------------------------------------------------- the sign ("ANSWER DIRECTLY. DON'T THINK.") */
  P.sign = function (B, T, p, yaw, sink, tilt, light) {
    var Mb = M.mul(M.mul(P.basisY(p, yaw), M.trans(0, -sink, 0)), M.rotZ(tilt || 0));
    B.push(Mb);
    B.cyl(6, 0.065, 0.06, -0.9, 1.1, C.wood, 0, C.woodL);
    B.chamfer([0, 1.52, 0], [0.82, 0.52, 0.07], 0.05, C.violet, 0.02, C.lilac);
    B.pop();
    T.quadM('sign', M.mul(Mb, M.trans(0, 1.5, 0.075)), [0, 0, 0], 0.88, CREAM_T, light || 1.0);
  };

  /* ---------------------------------------------------------------- the mini effort dial set into the ground (giant-hand-sized) */
  P.knob = function (B, T, p, yaw, ang, light) {
    var Mb = M.mul(P.basisY(p, yaw), M.scale(0.68, 0.68, 0.68));
    B.push(Mb);
    // a dial plate (a shallow faceted disc) with an arc of ticks
    B.cyl(16, 0.95, 0.9, 0, 0.08, C.violetD, 0, C.violet);
    for (var i = 0; i <= 8; i++) {
      var a = (-135 + i * 33.75) * Math.PI / 180;
      B.push(M.mul(M.rotY(-a), M.trans(0, 0.09, -0.78)));
      B.chamfer([0, 0, 0], [0.035, 0.02, i % 4 === 0 ? 0.1 : 0.06], 0.01, i === 0 ? C.sage : i === 8 ? C.coral : C.cream, 0.15);
      B.pop();
    }
    // the knob
    B.push(M.rotY(-ang));
    B.cyl(12, 0.42, 0.38, 0.08, 0.42, C.lilac, 0.02, C.lilacHi);
    B.chamfer([0, 0.44, -0.2], [0.05, 0.03, 0.2], 0.015, C.cream, 0.3);
    B.pop();
    B.pop();
    // LOW / HIGH legends lying on the plate, tilted up to read
    var lowP = M.mul(Mb, M.mul(M.mul(M.rotY(0.95), M.trans(0, 0.12, 0.62)), M.rotX(-1.15)));
    var highP = M.mul(Mb, M.mul(M.mul(M.rotY(-0.95), M.trans(0, 0.12, 0.62)), M.rotX(-1.15)));
    T.quadM('low', lowP, [0, 0, 0], 0.2, CREAM_T, light || 1);
    T.quadM('high', highP, [0, 0, 0], 0.2, CREAM_T, light || 1);
  };

  /* ---------------------------------------------------------------- the user's giant hand (a lilac glove with a cream cuff) */
  // pose: 'thumb' (thumbs-up fist) | 'grip' (fingers down around a knob) | 'point'
  P.glove = function (B, Mb, pose, k) {
    var L = C.lilac, L2 = FG.col.mix(C.lilac, C.violet, 0.45), LT = C.lilacHi;
    B.push(Mb);
    if (pose === 'thumb') {
      // fist: palm block, four curled finger rolls on the front, the thumb up on top; wrist + cuff below
      B.chamfer([0, 0, 0], [0.5, 0.48, 0.34], 0.14, L, 0, LT);
      for (var i = 0; i < 4; i++) B.chamfer([0.06, 0.33 - i * 0.215, 0.33], [0.42, 0.105, 0.13], 0.06, i % 2 ? L : L2, 0, LT);
      B.push(M.mul(M.trans(-0.18, 0.42, 0.05), M.rotZ(0.12)));
      B.chamfer([0, 0.3, 0], [0.15, 0.36, 0.16], 0.08, L, 0, LT);
      B.chamfer([0, 0.66, 0.0], [0.13, 0.08, 0.13], 0.06, LT, 0, LT);
      B.pop();
      B.chamfer([0, -0.62, -0.02], [0.4, 0.2, 0.3], 0.08, L2, 0);
      B.chamfer([0, -0.95, -0.02], [0.5, 0.18, 0.38], 0.1, C.cream, 0.02, C.white);
      // a collar of cloud where the wrist would be: the hand comes out of the sky
      for (var cpf = 0; cpf < 7; cpf++) { var ca = cpf / 7 * m.TAU; B.push(M.trans(Math.cos(ca) * 0.55, -1.2 + Math.sin(cpf * 2.1) * 0.08, Math.sin(ca) * 0.45)); B.ico(1, 0.34 + 0.06 * (cpf % 3), null, 0.3, 0, 0.12, 980 + cpf, function (k, n) { return FG.col.mix(FG.col.mix(C.lilacHi, C.cream, 0.55), C.white, (n[1] * 0.5 + 0.5) * 0.8); }); B.pop(); }
    } else if (pose === 'grip') {
      // palm flat above, fingers hanging down round the knob, curling in by k (0 open .. 1 closed)
      B.chamfer([0, 0.28, 0], [0.5, 0.18, 0.5], 0.12, L, 0, LT);
      for (var f = 0; f < 5; f++) {
        var a = (f === 4 ? Math.PI : (-0.55 + f * 0.37)) + Math.PI / 2, rr = 0.42 - 0.08 * (k || 0);
        B.push(M.mul(M.trans(Math.cos(a) * rr, 0.15, Math.sin(a) * rr), M.rotY(-a)));
        B.push(M.rotZ(0.25 * (k || 0)));
        B.chamfer([0, -0.28, 0], [0.11, 0.3, 0.11], 0.05, f % 2 ? L : L2, 0, LT);
        B.pop(); B.pop();
      }
      B.chamfer([0, 0.62, 0], [0.42, 0.2, 0.42], 0.1, C.cream, 0.02, C.white);
      B.cyl(10, 0.34, 0.38, 0.75, 3.5, L2, 0);
    }
    B.pop();
  };
  // the giant foot: a lilac sneaker, toe tapping (ang about the heel)
  P.foot = function (B, Mb, ang) {
    B.push(Mb);
    B.push(M.rotX(-ang));
    B.chamfer([0, 0.32, 0.9], [0.55, 0.32, 1.05], 0.22, C.lilac, 0, C.lilacHi);
    B.chamfer([0, 0.05, 0.95], [0.6, 0.07, 1.12], 0.05, C.cream, 0.02, C.white);
    B.chamfer([0, 0.62, 0.35], [0.5, 0.18, 0.5], 0.12, C.violet, 0);
    for (var i = 0; i < 3; i++) B.box(0, 0.66 + 0.0, 0.85 + i * 0.22, 0.32, 0.025, 0.035, C.cream, 0.05);
    B.pop();
    B.cyl(10, 0.42, 0.46, 0.7, 5.0, C.violet, 0);
    B.pop();
  };

  /* ---------------------------------------------------------------- planks, the bridge */
  P.plank = function (B, Mb, len, w, k) {
    B.push(Mb);
    B.chamfer([0, 0, 0], [w / 2, 0.045, len / 2], 0.02, (k & 1) ? C.wood : FG.col.mix(C.wood, C.woodL, 0.5), 0, C.woodL);
    B.box(0, 0.047, -len * 0.3, w * 0.22, 0.003, 0.01, C.woodD); B.box(0, 0.047, len * 0.3, w * 0.22, 0.003, 0.01, C.woodD);
    B.pop();
  };
  // a little card-on-a-stick the hero holds up
  P.handSign = function (B, T, Mb, id, w, h, light) {
    B.push(Mb);
    B.cyl(5, 0.022, 0.022, -0.35, 0.05, C.woodD);
    B.chamfer([0, h / 2 + 0.05, 0], [w / 2, h / 2, 0.02], 0.02, C.paper, 0.05, C.white);
    B.pop();
    T.quadM(id, M.mul(Mb, M.trans(0, h / 2 + 0.05, 0.022)), [0, 0, 0], h * 0.86, INK_T, light || 1);
  };

  /* ---------------------------------------------------------------- the banner from the sky */
  P.banner = function (B, T, Mb, w, h, unf, t, light) {
    if (unf <= 0.01) return;
    B.push(Mb);
    var hh = h * unf;
    // two ropes up into the sky
    for (var s = -1; s <= 1; s += 2) B.box(s * (w / 2 - 0.15), 6.0, 0, 0.02, 6.0, 0.02, C.cream, 0.1);
    B.chamfer([0, 0, 0], [w / 2 + 0.08, 0.07, 0.07], 0.03, C.goldD, 0.05, C.gold);           // top rod
    // the cloth, with a gentle wave
    var NS = 8;
    for (var i = 0; i < NS; i++) {
      var x0 = -w / 2 + i * w / NS, x1 = x0 + w / NS;
      var z0 = Math.sin(t * 2.5 + i * 0.9) * 0.05, z1 = Math.sin(t * 2.5 + (i + 1) * 0.9) * 0.05;
      B.poly([[x0, -0.02, z0], [x1, -0.02, z1], [x1, -hh, z1 + 0.02], [x0, -hh, z0 + 0.02]], i % 2 ? C.violet : FG.col.mix(C.violet, C.lilac2, 0.3), 0.04, 0, [0, -hh / 2, -1]);
    }
    if (unf > 0.9) B.chamfer([0, -hh, 0.02], [w / 2 + 0.05, 0.05, 0.05], 0.02, C.goldD, 0.05, C.gold);
    B.pop();
    if (unf > 0.6) T.quadM('banner', M.mul(Mb, M.trans(0, -hh / 2, 0.09)), [0, 0, 0], hh * 0.78, CREAM_T, light || 1.05, m.ss(0.6, 0.95, unf));
  };

  /* ---------------------------------------------------------------- houses, flags, paint, the token meter, the crown */
  P.house = function (B, Mb, wide, col, roofCol) {
    B.push(Mb);
    var hw = 0.42 * wide, hd = 0.4, hh = 0.36;
    B.chamfer([0, hh, 0], [hw, hh, hd], 0.04, col, 0, col);
    // gable roof: two slanted slabs
    var rh = 0.34, ov = 0.08;
    var r0 = [[-hw - ov, hh * 2, -hd - ov], [hw + ov, hh * 2, -hd - ov], [hw + ov, hh * 2 + rh, 0], [-hw - ov, hh * 2 + rh, 0]];
    var r1 = [[-hw - ov, hh * 2, hd + ov], [hw + ov, hh * 2, hd + ov], [hw + ov, hh * 2 + rh, 0], [-hw - ov, hh * 2 + rh, 0]];
    B.poly(r0, FG.col.mul(roofCol || C.roof, 0.92), 0, 0, [0, 0, 0]);
    B.poly(r1, roofCol || C.roof, 0, 0, [0, 0, 0]);
    B.poly([[-hw, hh * 2, -hd], [-hw, hh * 2, hd], [-hw, hh * 2 + rh - 0.02, 0]], col, 0, 0, [0, hh, 0]);
    B.poly([[hw, hh * 2, -hd], [hw, hh * 2, hd], [hw, hh * 2 + rh - 0.02, 0]], col, 0, 0, [0, hh, 0]);
    // door and windows on the front (+z)
    B.box(0, 0.17, hd + 0.005, 0.09, 0.17, 0.012, C.door);
    for (var s = -1; s <= 1; s += 2) if (wide > 1.3 || true) B.box(s * hw * 0.58, 0.46, hd + 0.005, 0.08, 0.07, 0.012, FG.col.srgb(0x5c4a8a), 0.15);
    B.box(hw * 0.55, hh * 2 + rh * 0.6, -0.1, 0.06, 0.16, 0.06, C.clay);   // chimney
    B.pop();
  };
  P.flag = function (B, T, Mb, id, k, t, light) {
    if (k <= 0.01) return;
    B.push(Mb);
    B.push(M.scale(1, k, 1));
    B.cyl(5, 0.02, 0.018, 0, 0.62, C.cream, 0.05);
    B.pop();
    if (k > 0.5) {
      var wv = Math.sin(t * 9) * 0.03;
      B.poly([[0.02, 0.62, 0], [0.42, 0.6 + wv, 0.02], [0.42, 0.4 + wv, 0.02], [0.02, 0.42, 0]], id === 'tests' ? C.teal : C.gold, 0.06, 0, [0.2, 0.5, -1]);
    }
    B.pop();
    if (k > 0.5) T.quadM(id, M.mul(Mb, M.trans(0.22, 0.51, 0.035)), [0, 0, 0], 0.12, id === 'tests' ? CREAM_T : INK_T, light || 1);
  };
  P.meter = function (B, T, Mb, u, t, light) {
    // a post with a round gauge: a gold needle sweeps up; a digital readout below
    B.push(Mb);
    B.cyl(6, 0.05, 0.05, 0, 2.3, C.woodD);
    B.push(M.trans(0, 2.55, 0));
    B.push(M.rotX(Math.PI / 2)); B.cyl(14, 0.42, 0.42, -0.05, 0.05, C.cream, 0.02, C.white); B.cyl(14, 0.46, 0.46, -0.04, 0.04, C.goldD); B.pop();
    // band: green -> gold -> coral arc ticks
    for (var i = 0; i <= 10; i++) {
      var a = (-120 + i * 24) * Math.PI / 180;
      B.push(M.mul(M.rotZ(-a), M.trans(0, 0.31, 0.06)));
      B.box(0, 0, 0, 0.018, 0.06, 0.01, i < 4 ? C.sage2 : i < 8 ? C.gold : C.coral, 0.1);
      B.pop();
    }
    var na = (-120 + 240 * u) * Math.PI / 180 + Math.sin(t * 40) * 0.03 * (u > 0.05 && u < 0.98 ? 1 : 0);
    B.push(M.mul(M.trans(0, 0, 0.08), M.rotZ(-na)));
    B.chamfer([0, 0.16, 0], [0.025, 0.18, 0.012], 0.008, C.coral, 0.25);
    B.pop();
    B.cyl(8, 0.05, 0.05, 0.06, 0.1, C.dark);
    B.pop();
    B.chamfer([0, 1.92, 0], [0.42, 0.14, 0.05], 0.03, C.violetD, 0);
    B.pop();
    var id = u < 0.2 ? 'tok0' : u < 0.45 ? 'tok1' : u < 0.7 ? 'tok2' : u < 0.9 ? 'tok3' : 'tokpct';
    T.quadM('tokens', M.mul(Mb, M.trans(0, 2.36, 0.07)), [0, 0, 0], 0.09, INK_T, light || 1);
    T.quadM(id, M.mul(Mb, M.trans(0, 1.92, 0.055)), [0, 0, 0], 0.2, C.goldHi, 1.3);
  };
  P.crown = function (B, T, Mb, sign, light) {
    B.push(Mb);
    B.cyl(10, 0.34, 0.36, 0, 0.12, C.gold, 0.1, C.goldHi);
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * m.TAU;
      B.push(M.trans(Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3));
      B.cyl(4, 0.08, 0.0, 0, 0.22, C.gold, 0.12, C.goldHi, 0, a);
      B.push(M.trans(0, 0.25, 0)); B.ico(0, 0.04, C.coral, 0.3); B.pop();
      B.pop();
    }
    if (sign) {
      // a little lilac placard on a stick rising from the crown
      B.cyl(4, 0.018, 0.018, 0.1, 0.62, C.cream, 0.05);
      B.chamfer([0, 0.84, 0], [0.5, 0.22, 0.02], 0.02, C.violet, 0.03, C.lilac);
    }
    B.pop();
    if (sign) T.quadM('crown', M.mul(Mb, M.trans(0, 0.84, 0.024)), [0, 0, 0], 0.34, CREAM_T, light || 1.05);
  };

  /* ---------------------------------------------------------------- tumbleweed, cricket */
  P.tumble = function (B, p, rot, s) {
    B.push(M.mul(M.trans(p[0], p[1], p[2]), M.mul(M.rotZ(rot), M.rotX(rot * 0.4))));
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * m.TAU;
      B.push(M.mul(M.rotY(a), M.rotX(0.6 + i * 0.3)));
      B.box(0, 0, 0, 0.32 * s, 0.018 * s, 0.018 * s, i % 2 ? C.woodL : C.sand2);
      B.pop();
    }
    B.ico(0, 0.2 * s, FG.col.mix(C.woodL, C.sand2, 0.5), 0, 0, 0.3, 77);
    B.pop();
  };

  /* ---------------------------------------------------------------- clones' magnifying glass, the work crate, the register */
  P.magnifier = function (B, Mb) {
    B.push(M.mul(Mb, M.scale(1.7, 1.7, 1.7)));
    B.cyl(5, 0.022, 0.022, -0.18, 0.0, C.woodD);
    B.push(M.mul(M.trans(0, 0.13, 0), M.rotX(Math.PI / 2)));
    for (var i = 0; i < 10; i++) { var a = i / 10 * m.TAU; B.push(M.mul(M.rotY(a), M.trans(0.11, 0, 0))); B.box(0, 0, 0, 0.022, 0.025, 0.04, C.goldD, 0.05, C.gold); B.pop(); }
    B.cyl(10, 0.095, 0.095, -0.006, 0.006, FG.col.mix(C.bubble, C.white, 0.4), 0.35);
    B.pop();
    B.pop();
  };
  P.crate = function (B, Mb) {
    B.push(Mb);
    B.chamfer([0, 0.22, 0], [0.26, 0.22, 0.26], 0.04, C.lilac2, 0.02, C.lilacHi);
    B.box(0, 0.22, 0.262, 0.2, 0.025, 0.005, C.cream, 0.1); B.box(0, 0.22, 0.262, 0.025, 0.17, 0.005, C.cream, 0.1);
    B.pop();
  };
  P.register = function (B, T, Mb, drawer, id, light) {
    B.push(Mb);
    B.chamfer([0, 0, 0], [0.9, 0.55, 0.62], 0.1, C.gold, 0.06, C.goldHi);
    B.chamfer([0, 0.7, -0.15], [0.68, 0.28, 0.12], 0.06, C.goldD, 0.04, C.gold);
    B.box(0, 0.7, -0.02, 0.58, 0.2, 0.01, C.violetD, 0.25);
    // keys
    for (var i = 0; i < 4; i++) for (var j = 0; j < 2; j++) B.chamfer([-0.45 + i * 0.3, 0.6, 0.18 + j * 0.2], [0.1, 0.06, 0.07], 0.03, C.cream, 0.04);
    // the drawer
    B.chamfer([0, -0.62, 0.3 + 0.45 * drawer], [0.82, 0.12, 0.5], 0.04, C.goldD, 0.05, C.gold);
    B.pop();
    T.quadM(id, M.mul(Mb, M.trans(0, 0.7, -0.005)), [0, 0, 0], 0.42, C.goldHi, 1.6);
  };

  /* ---------------------------------------------------------------- sticky notes */
  P.note = function (B, Mb, col, curl) {
    B.push(Mb);
    var s = 0.19, c = curl || 0;
    B.poly([[-s, -s, 0], [s, -s, 0], [s, s * 0.4, 0], [-s, s * 0.4, 0]], col, 0.08, 0, [0, 0, -1]);
    B.poly([[-s, s * 0.4, 0], [s, s * 0.4, 0], [s, s, c], [-s, s, c]], FG.col.mul(col, 1.05), 0.08, 0, [0, 0, -1]);
    B.box(0, s - 0.02, -0.004, s * 0.98, 0.022, 0.003, FG.col.mul(col, 0.85), 0.05);
    B.pop();
  };

  /* ---------------------------------------------------------------- the report: scroll, river, index card */
  P.scrollRoll = function (B, Mb, len, r) {
    B.push(Mb);
    B.push(M.rotZ(Math.PI / 2));
    B.cyl(10, r, r, -len / 2, len / 2, C.paper, 0.05, C.paper);
    B.cyl(8, r * 0.45, r * 0.45, -len / 2 - 0.08, len / 2 + 0.08, C.woodD, 0);
    B.pop();
    B.pop();
  };
  P.card = function (B, T, Mb, light, k) {
    if (k <= 0.01) return;
    B.push(M.mul(Mb, M.scale(k, k, k)));
    B.chamfer([0, 0, 0], [0.62, 0.42, 0.012], 0.012, C.white, 0.1);
    for (var i = 0; i < 4; i++) B.box(0, 0.22 - i * 0.16, 0.013, 0.56, 0.006, 0.002, FG.col.srgb(0xb9c9ec), 0.15);
    B.box(0, 0.33, 0.013, 0.58, 0.008, 0.002, C.coral, 0.2);
    B.pop();
    if (k > 0.6) T.quadM('card', M.mul(Mb, M.trans(0, -0.02, 0.016)), [0, 0, 0], 0.68 * k, INK_T, light || 1.05, m.ss(0.6, 0.95, k));
  };
})(typeof window !== 'undefined' ? window : globalThis);
