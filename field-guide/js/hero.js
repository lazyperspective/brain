/* Fable 5.2: A Field Guide. The hero: the coral block of the Fable Saga, rebuilt as a rigged low-poly character.
   Body: a rounded block (two-facet bevels), two black eyes with a white glint, two arm nubs, four leg stubs, a mouth only
   when it reacts. Rig: root (position, yaw, squash/stretch about the feet), body (lean, tilt, twist about the hips),
   legs (lift, swing, splay per leg), arms (elevation, azimuth, length), eyes (open, look, shape), mouth (shape, amount).
   Faces local +z. About 560 triangles. */
(function (root) {
  'use strict';
  var FG = root.FG, M = FG.mat, V = FG.v, m = FG.m, C = FG.C;

  var BW = 0.72, BH = 0.45, BD = 0.44, LEG = 0.27, YC = LEG + BH - 0.04;
  FG.HERO = { BW: BW, BH: BH, BD: BD, LEG: LEG, YC: YC, H: YC + BH };
  var GRID = [-1, -0.9, -0.66, 0.66, 0.9, 1];
  var BODY_TOP = C.light, BODY = C.coral, BODY_SH = C.shade, BODY_DK = C.dark;
  var topCol = FG.col.mix(C.coral, C.light, 0.62), sideCol = C.coral, botCol = FG.col.mix(C.shade, C.dark, 0.35);
  function bodyCol(n) {
    if (n[1] > 0.75) return topCol;
    if (n[1] > 0.3) return FG.col.mix(C.coral, C.light, 0.3);
    if (n[1] < -0.6) return botCol;
    if (n[1] < -0.2) return FG.col.mix(C.coral, C.shade, 0.6);
    return sideCol;
  }

  FG.defaultPose = function () {
    return {
      p: [0, 0, 0], yaw: 0, sq: 0, lean: 0, tilt: 0, twist: 0, sit: 0,
      legs: [[0, 0], [0, 0], [0, 0], [0, 0]], splay: 0,
      arms: [{ el: -0.55, az: 0.15, len: 1 }, { el: -0.55, az: 0.15, len: 1 }],
      eyes: { open: 1, look: [0, 0], shape: 'open', size: 1, l: 1, r: 1 },
      mouth: { shape: 'none', amt: 0 }, brow: 0, sweat: 0, scale: 1, tint: null
    };
  };

  // world matrix of the body (centre of the block) and the root, for attachments
  function rootM(P) {
    var s = P.scale || 1, sy = 1 - 0.55 * P.sq, sxz = 1 / Math.sqrt(Math.max(sy, 0.2));
    return M.mul(M.mul(M.trans(P.p[0], P.p[1], P.p[2]), M.rotY(P.yaw)), M.scale(sxz * s, sy * s, sxz * s));
  }
  function bodyM(P) {
    var R = rootM(P);
    // sitting lowers the body and tips it back a little (the Thinker sits on its hind legs)
    var sitY = -LEG * 0.75 * P.sit;
    R = M.mul(R, M.trans(0, LEG + sitY, -0.0));
    R = M.mul(R, M.rotY(P.twist)); R = M.mul(R, M.rotX(P.lean)); R = M.mul(R, M.rotZ(-P.tilt));
    return M.mul(R, M.trans(0, BH - 0.04, 0));
  }
  FG.heroBodyM = bodyM; FG.heroRootM = rootM;

  function limb(B, from, dir, len, half, col, colTip) {
    // a chamfered stub from 'from' along unit 'dir' (local coords of the current matrix)
    var X = V.norm(dir), up = Math.abs(X[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    var Z = V.norm(V.cross(X, up)), Y = V.cross(Z, X);
    B.push(M.basis(X, Y, Z, from));
    B.chamfer([len / 2, 0, 0], [len / 2 + half * 0.15, half, half], half * 0.42, col, 0, colTip);
    B.pop();
  }

  // eyes, glints, brows and mouth on the front face (local body coordinates, face at z = BD)
  function face(B, P) {
    var E = P.eyes, fz = BD + 0.004, lx = E.look[0] * 0.05, ly = E.look[1] * 0.04;
    for (var s = -1; s <= 1; s += 2) {
      var open = E.open * (s < 0 ? (E.l == null ? 1 : E.l) : (E.r == null ? 1 : E.r));
      var ex = s * 0.36 + lx, ey = 0.12 + ly, sz = E.size || 1;
      var hw = 0.075 * sz, hh = 0.105 * sz * Math.max(open, 0.1);
      if (E.shape === 'happy') {
        // ^ ^ : two short bars in an arch
        B.push(M.mul(M.trans(ex - 0.04, ey - 0.0, fz + 0.01), M.rotZ(0.75))); B.box(0, 0, 0, 0.055, 0.02, 0.012, C.ink); B.pop();
        B.push(M.mul(M.trans(ex + 0.04, ey - 0.0, fz + 0.01), M.rotZ(-0.75))); B.box(0, 0, 0, 0.055, 0.02, 0.012, C.ink); B.pop();
        continue;
      }
      if (E.shape === 'x') {
        B.push(M.mul(M.trans(ex, ey, fz + 0.01), M.rotZ(0.78))); B.box(0, 0, 0, 0.075, 0.018, 0.012, C.ink); B.pop();
        B.push(M.mul(M.trans(ex, ey, fz + 0.01), M.rotZ(-0.78))); B.box(0, 0, 0, 0.075, 0.018, 0.012, C.ink); B.pop();
        continue;
      }
      if (E.shape === 'squint') hh = Math.min(hh, 0.05 * sz);
      if (open < 0.16) { B.box(ex, ey - 0.02, fz + 0.008, hw * 1.05, 0.016, 0.012, C.ink); continue; }
      B.chamfer([ex, ey, fz + 0.012], [hw, hh, 0.014], 0.02, C.ink, 0);
      if (open > 0.45) {
        var gs = 0.026 * sz;
        B.box(ex - hw + gs + 0.012, ey + hh - gs - 0.014, fz + 0.03, gs, gs, 0.004, C.glint, 0.9, null, 2);
        if (E.shape === 'wide') B.box(ex + hw * 0.35, ey - hh * 0.45, fz + 0.03, gs * 0.45, gs * 0.45, 0.004, C.glint, 0.6, null, 2);
      }
    }
    if (P.brow > 0.01) {
      for (s = -1; s <= 1; s += 2) {
        B.push(M.mul(M.trans(s * 0.34 + lx, 0.29 + ly, fz + 0.012), M.rotZ(s * 0.32 * P.brow)));
        B.box(0, 0, 0, 0.09, 0.02 * P.brow + 0.004, 0.012, C.ink); B.pop();
      }
    }
    var Mo = P.mouth, a = Mo.amt;
    if (a > 0.02 && Mo.shape !== 'none') {
      var my = -0.14;
      if (Mo.shape === 'o') { B.chamfer([0, my, fz + 0.01], [0.055 * a + 0.01, 0.07 * a + 0.01, 0.012], 0.025, C.ink); }
      else if (Mo.shape === 'flat') { B.box(0, my, fz + 0.01, 0.08 * a, 0.016, 0.012, C.ink); }
      else if (Mo.shape === 'smile') {
        var w = 0.12 * a;
        B.box(0, my - 0.025, fz + 0.01, w * 0.55, 0.018, 0.012, C.ink);
        B.push(M.mul(M.trans(-w * 0.62, my - 0.005, fz + 0.01), M.rotZ(-0.55))); B.box(0, 0, 0, w * 0.32, 0.018, 0.012, C.ink); B.pop();
        B.push(M.mul(M.trans(w * 0.62, my - 0.005, fz + 0.01), M.rotZ(0.55))); B.box(0, 0, 0, w * 0.32, 0.018, 0.012, C.ink); B.pop();
      } else if (Mo.shape === 'beam') {
        // a big open D smile with a tongue
        var bw = 0.15 * a, bh = 0.085 * a;
        B.poly([[-bw, my + 0.02, fz + 0.012], [bw, my + 0.02, fz + 0.012], [bw * 0.7, my - bh * 0.7, fz + 0.012], [0, my - bh, fz + 0.012], [-bw * 0.7, my - bh * 0.7, fz + 0.012]], C.ink, 0, 0, [0, my, 0]);
        B.poly([[-bw * 0.45, my - bh * 0.45, fz + 0.02], [bw * 0.45, my - bh * 0.45, fz + 0.02], [bw * 0.3, my - bh * 0.85, fz + 0.02], [-bw * 0.3, my - bh * 0.85, fz + 0.02]], FG.col.mix(C.dark, C.coral, 0.45), 0, 0, [0, my, 0]);
      } else if (Mo.shape === 'wobble') {
        for (var k = -2; k <= 1; k++) { B.push(M.mul(M.trans(k * 0.035 + 0.0175, my, fz + 0.01), M.rotZ(k & 1 ? 0.6 : -0.6))); B.box(0, 0, 0, 0.022 * a, 0.012, 0.012, C.ink); B.pop(); }
      }
    }
    if (P.sweat > 0.02) {
      var sy = 0.38 - 0.25 * (1 - P.sweat);
      B.push(M.trans(BW * 0.8, sy, BD * 0.6)); B.ico(0, 0.05 * Math.min(1, P.sweat * 2), C.bubble, 0.25); B.pop();
    }
  }

  // build the hero into B; returns attachment points in world space
  FG.buildHero = function (B, P) {
    var R = rootM(P), Bm = bodyM(P);
    var out = {};
    // legs: hips under the body, in root space
    var lx = 0.44, lz = 0.23;
    for (var i = 0; i < 4; i++) {
      var sx = (i & 1) ? 1 : -1, sz = (i & 2) ? -1 : 1;      // 0 FL, 1 FR, 2 BL, 3 BR
      var L = P.legs[i], lift = L[0], swing = L[1];
      var hip = M.xf(Bm, [sx * lx, -BH + 0.08, sz * lz]);
      // hip in root-local coordinates
      var Rinv = invRigid(R);
      var hipL = M.xf(Rinv, hip);
      var sitFold = P.sit * (sz < 0 ? 1 : 0.4);
      var foot = [sx * (lx + P.splay * 0.06), Math.max(0.0, lift) + sitFold * 0.02, sz * lz + swing - sz * sitFold * 0.0];
      if (sz < 0 && P.sit > 0) { foot[2] -= 0.16 * P.sit; foot[1] = Math.min(foot[1], hipL[1] - 0.05); }
      var dir = V.sub(foot, hipL), len = V.len(dir);
      B.push(R);
      limb(B, hipL, dir, Math.max(len, 0.05), 0.118, sz > 0 ? C.coral : C.shade, sz > 0 ? C.coral : C.shade);
      B.pop();
      out['foot' + i] = M.xf(R, foot);
    }
    // body
    B.push(Bm);
    var tint = P.tint;
    B.roundedBox([BW, BH, BD], 0.15, GRID, tint ? function (n) { return FG.col.mix(bodyCol(n), tint[0], tint[1]); } : bodyCol, 0);
    // arms
    for (var s = 0; s < 2; s++) {
      var A = P.arms[s], sd = s === 0 ? -1 : 1;
      var dirA = [sd * Math.cos(A.el) * Math.cos(A.az), Math.sin(A.el), Math.cos(A.el) * Math.sin(A.az)];
      var sh = [sd * (BW - 0.1), -0.05, 0.05];
      var al = 0.24 * (A.len == null ? 1 : A.len);
      limb(B, sh, dirA, al + 0.06, 0.092, FG.col.mix(C.coral, C.shade, 0.35), C.coral);
      out[s === 0 ? 'handL' : 'handR'] = M.xf(Bm, V.mad(sh, dirA, al + 0.08));
      out[s === 0 ? 'armDirL' : 'armDirR'] = V.norm(M.xd(Bm, dirA));
    }
    face(B, P);
    B.pop();
    out.body = M.xf(Bm, [0, 0, 0]);
    out.top = M.xf(Bm, [0, BH, 0]);
    out.face = M.xf(Bm, [0, 0.05, BD]);
    out.mouth = M.xf(Bm, [0, -0.14, BD]);
    out.bm = Bm; out.rm = R;
    out.fwd = V.norm(M.xd(Bm, [0, 0, 1])); out.up = V.norm(M.xd(Bm, [0, 1, 0])); out.right = V.norm(M.xd(Bm, [1, 0, 0]));
    return out;
  };
  // inverse of a matrix made of rotation, uniform-ish scale and translation (general 4x4 inverse for safety)
  function invRigid(a) {
    var b = new Array(16), i;
    var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[4], a11 = a[5], a12 = a[6], a20 = a[8], a21 = a[9], a22 = a[10];
    var b01 = a22 * a11 - a12 * a21, b11 = -a22 * a10 + a12 * a20, b21 = a21 * a10 - a11 * a20;
    var det = a00 * b01 + a01 * b11 + a02 * b21; det = 1 / det;
    b[0] = b01 * det; b[1] = (-a22 * a01 + a02 * a21) * det; b[2] = (a12 * a01 - a02 * a11) * det; b[3] = 0;
    b[4] = b11 * det; b[5] = (a22 * a00 - a02 * a20) * det; b[6] = (-a12 * a00 + a02 * a10) * det; b[7] = 0;
    b[8] = b21 * det; b[9] = (-a21 * a00 + a01 * a20) * det; b[10] = (a11 * a00 - a01 * a10) * det; b[11] = 0;
    for (i = 0; i < 3; i++) b[12 + i] = -(b[i] * a[12] + b[4 + i] * a[13] + b[8 + i] * a[14]);
    b[15] = 1;
    return b;
  }
  FG.invM = invRigid;

  /* ---------------------------------------------------------------- acting helpers */
  // trot cycle: phase in cycles; amt 0..1. Diagonal pairs (FL+BR, FR+BL)
  FG.trot = function (P, phase, amt, stride) {
    var st = stride || 0.13;
    for (var i = 0; i < 4; i++) {
      var off = (i === 0 || i === 3) ? 0 : 0.5, ph = (phase + off) * m.TAU;
      P.legs[i][0] = Math.max(0, Math.sin(ph)) * 0.12 * amt;
      P.legs[i][1] = Math.cos(ph) * st * amt;
    }
    P.p[1] += Math.abs(Math.sin(phase * m.TAU * 2)) * 0.035 * amt;
    P.tilt += Math.sin(phase * m.TAU) * 0.05 * amt;
  };
  // automatic blinks: seeded times, each ~5 frames
  FG.blinkAt = function (t, seed, every) {
    every = every || 2.6;
    var k = Math.floor(t / every), best = 1;
    for (var j = k - 1; j <= k + 1; j++) {
      var tb = j * every + m.hash(j, seed) * every * 0.7;
      var d = (t - tb) / 0.14;
      if (d >= 0 && d < 1) best = Math.min(best, Math.abs(d - 0.45) / 0.45);
    }
    return m.clamp(best, 0, 1);
  };
  // a hop: returns {y, sq, air} for t relative to a hop from t0 (takeoff) to t1 (landing), apex h
  FG.hopAt = function (t, t0, t1, h) {
    var o = { y: 0, sq: 0, air: 0, u: 0 };
    var ant = 0.12, rec = 0.22;
    if (t < t0 - ant || t > t1 + rec) return o;
    if (t < t0) { var a = (t - (t0 - ant)) / ant; o.sq = 0.32 * Math.sin(a * Math.PI * 0.5); return o; }
    if (t <= t1) {
      var u = (t - t0) / (t1 - t0); o.u = u; o.air = 1;
      o.y = 4 * h * u * (1 - u);
      o.sq = -0.22 * Math.sin(Math.PI * Math.min(1, u * 1.25)) * (1 - u) - 0.06 * (u < 0.15 ? (1 - u / 0.15) : 0);
      return o;
    }
    var r = (t - t1) / rec; o.sq = 0.36 * Math.exp(-r * 3.5) * Math.cos(r * 7) * (1 - r); o.u = 1;
    return o;
  };
})(typeof window !== 'undefined' ? window : globalThis);
