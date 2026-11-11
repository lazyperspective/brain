/* Fable 5.2: A Field Guide. The beats: the hero's performance and every prop, as pure functions of film time.
   Site frames: o = outward (away from the hub), tw = clockwise tangent, up. The hero travels counter-clockwise round
   the dial (screen-left in the outward-looking shots). */
(function (root) {
  'use strict';
  var FG = root.FG, W = FG.W, M = FG.mat, V = FG.v, m = FG.m, C = FG.C, P = FG.P, TL = FG.TL, E = TL.E;
  var D2R = Math.PI / 180, HERO = FG.HERO, CREAM_T = [1.0, 0.94, 0.86];

  /* ---------------------------------------------------------------- site frames */
  function frame(a, r) {
    var o = [Math.sin(a * D2R), 0, -Math.cos(a * D2R)], tw = [Math.cos(a * D2R), 0, Math.sin(a * D2R)];
    var p = [r * o[0], 0, r * o[2]]; p[1] = W.groundXZ(p[0], p[2]);
    return { a: a, r: r, o: o, tw: tw, p: p };
  }
  // a point in a site frame: a (outward), b (clockwise), y (absolute height, or null = on the ground + c)
  function at(F, a, b, c, abs) {
    var x = F.p[0] + F.o[0] * a + F.tw[0] * b, z = F.p[2] + F.o[2] * a + F.tw[2] * b;
    return [x, abs ? c : W.groundXZ(x, z) + (c || 0), z];
  }
  function yawDir(d) { return Math.atan2(d[0], d[2]); }
  function yawToward(from, to) { return Math.atan2(to[0] - from[0], to[2] - from[2]); }
  function angLerp(a, b, u) { var d = b - a; while (d > Math.PI) d -= m.TAU; while (d < -Math.PI) d += m.TAU; return a + d * u; }
  var S = {};
  S.think = frame(0, 10);
  S.key = frame(-60, 10.2);
  S.clear = frame(-88, 10);
  S.village = frame(-128, 10.4);
  S.mine = frame(-160, 10.2);
  S.top = frame(165, 10.0);
  S.clones = frame(153, 8.8);
  S.notes = frame(141, 10.5);
  S.scroll = frame(120, 10.8);
  FG.SITES = S; FG.siteAt = at;

  // the key: u along the crossing direction (counter-clockwise), v outward
  var KEY = W.KEY;
  function keyP(u, v, y) { return [KEY.c[0] - KEY.t[0] * u + KEY.rd[0] * v, y == null ? KEY.top : y, KEY.c[2] - KEY.t[2] * u + KEY.rd[2] * v]; }
  var PL = { n: 6, w: 0.34, len: 1.3 };
  PL.u = function (k) { return -KEY.gap / 2 + KEY.gap / PL.n * (k + 0.5); };
  var CCW_KEY = [-KEY.t[0], 0, -KEY.t[2]];

  /* ---------------------------------------------------------------- shared acting helpers */
  function base(p, yaw, t) {
    var P0 = FG.defaultPose();
    P0.p = p.slice(); P0.yaw = yaw;
    P0.sq = 0.018 * Math.sin(t * 2.6);                         // breathing
    P0.eyes.open = FG.blinkAt(t, 7, 2.9);
    return P0;
  }
  function lookAt(Pz, target) {
    var Bm = FG.heroBodyM(Pz), head = M.xf(Bm, [0, 0.1, HERO.BD]);
    var r = V.norm(M.xd(Bm, [1, 0, 0])), u = V.norm(M.xd(Bm, [0, 1, 0])), f = V.norm(M.xd(Bm, [0, 0, 1]));
    var d = V.sub(target, head), lz = Math.max(0.4, V.dot(d, f));
    Pz.eyes.look = [m.clamp(V.dot(d, r) / lz * 1.2, -1, 1), m.clamp(V.dot(d, u) / lz * 1.2, -1, 1)];
  }
  function hop(Pz, t, t0, t1, h, from, to) {
    var H = FG.hopAt(t, t0, t1, h);
    if (t >= t0 && t <= t1) { var u = (t - t0) / (t1 - t0); Pz.p = V.lerp(from, to, u); Pz.p[1] += H.y; }
    else if (t > t1) Pz.p = to.slice(); else Pz.p = from.slice();
    Pz.sq += H.sq;
    if (H.air) { for (var i = 0; i < 4; i++) Pz.legs[i][0] = 0.05; Pz.splay = 0.6; Pz.arms[0].el = Pz.arms[1].el = 0.2; }
    return H;
  }
  // walk along points (array of [t, pos]) with a trot; returns the facing direction
  function walk(Pz, t, path, speedPh) {
    var n = path.length, i = 1;
    if (t <= path[0][0]) { Pz.p = path[0][1].slice(); return null; }
    if (t >= path[n - 1][0]) { Pz.p = path[n - 1][1].slice(); return null; }
    while (i < n - 1 && t > path[i][0]) i++;
    var a = path[i - 1], b = path[i], u = (t - a[0]) / (b[0] - a[0]);
    // ease only at the very start and end of the whole path
    var e = u;
    if (i === 1 && n === 2) e = m.eio(u); else if (i === 1) e = u * u * (2 - u) * 0.5 + u * 0.5; else if (i === n - 1) e = 1 - (1 - u) * (1 - u) * 0.5 - (1 - u) * 0.5;
    Pz.p = V.lerp(a[1], b[1], e);
    var d = V.sub(b[1], a[1]), sp = V.len(d) / (b[0] - a[0]);
    FG.trot(Pz, t * (speedPh || 3.2) * Math.min(1.6, 0.6 + sp * 0.35), Math.min(1, sp * 0.8));
    return V.norm(d);
  }
  function groundAt(p) { return [p[0], W.groundXZ(p[0], p[2]), p[2]]; }
  // turn a travel heading part of the way toward the lens (three-quarter view), so the face always reads
  function tq(Pz, yaw, camP, k) { return angLerp(yaw, yawToward(Pz.p, camP), k == null ? 0.38 : k); }

  /* ================================================================ BEATS 1-2: the "hi" and the effort dial */
  var B1 = {};
  B1.hero = at(S.think, 0, -0.15);
  B1.hiP = at(S.think, 1.35, -1.55);
  B1.signP = at(S.think, 0.75, 1.25);
  B1.knobP = at(S.think, -0.45, 1.2);
  B1.cloudC = function (t) { return V.add(B1.hero, [S.think.o[0] * 0.1, 2.45, S.think.o[2] * 0.1]); };
  function hiLetters(B, t) {
    // the giant "hi" falls from the sky and thuds down; a squash and a little settle
    var land = E.hiLand, y0 = 3.6, ground = B1.hiP[1];
    var y = t < land ? ground + y0 * (1 - Math.pow((t + 0.12) / (land + 0.12), 2)) : ground, sq = 0, tilt = 0;
    if (t >= land) { var d = t - land; sq = 0.18 * Math.exp(-d * 9) * Math.cos(d * 26); tilt = 0.06 * Math.exp(-d * 5) * Math.sin(d * 14); }
    var yaw = yawToward(B1.hiP, at(S.think, -5, 0.2)) + 0.2;
    B.push(M.mul(M.mul(M.trans(B1.hiP[0], y, B1.hiP[2]), M.rotY(yaw)), M.mul(M.rotZ(tilt + (t < land ? 0.12 * (1 - t / land) : 0)), M.scale(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5))));
    FG.blockWord(B, 'hi', 0.29, { col: C.lilac, colTop: C.lilacHi, th: 1.35, dep: 1.4, gap: 1.2 });
    B.pop();
  }
  function cloudState(t) {
    // scale, churn, gears, ?s, deflate amount, extra position offset (the balloon zip)
    var s = 0, gears = 0, qs = 0, churn = 0.4, df = 0, spin = 1, off = [0, 0, 0];
    if (t >= E.cloudIn) s = 0.56 * m.spring(t - E.cloudIn, 2.6, 0.32);
    if (t >= E.cloudIn + 0.1) { gears = m.clamp((t - E.cloudIn - 0.1) / 0.25 * 3, 0, 3); qs = t > E.cloudIn + 0.3 ? 2 : t > E.cloudIn + 0.2 ? 1 : 0; churn = 0.6; }
    if (t >= E.cloudDouble) { s = 0.56 + 0.4 * m.spring(t - E.cloudDouble, 3.2, 0.3); gears = 5; qs = 4; churn = 1.4; spin = 2.4; }
    if (t >= E.deflate) {
      var u = t - E.deflate;
      s = 0.96 - 0.36 * m.eo(u / 0.4) + 0.06 * m.wob(u, 7, 4);
      df = m.clamp(u / 0.4, 0, 1); gears = Math.max(0, 5 - u * 14); qs = u < 0.12 ? 4 : 0; churn = 0.5; spin = 0.6;
    }
    if (t >= E.cloudZip) {
      // the half-deflated cloud zips off like a balloon losing air, straight at the lens
      var z = (t - E.cloudZip);
      s = Math.max(0.45, 0.6 - z * 0.25) * (1 - m.ss(6.62, 6.8, t));
      off = V.sub(FG.cloudZipAt(t), B1.cloudC(t));
    }
    return { s: s, gears: gears, qs: qs, churn: churn, df: df, spin: spin, off: off };
  }
  function heroB12(t, cam) {
    var toCam = yawToward(B1.hero, at(S.think, -5, 0.3));
    var Pz = base(B1.hero, toCam, t);
    var hiTop = V.add(B1.hiP, [0, 1.6, 0]);
    // 0 .. hiLand: looking up at the falling letters, alarmed
    if (t < E.hiLand) {
      lookAt(Pz, V.add(B1.hiP, [0, 1.2 + 3.6 * (1 - Math.pow((t + 0.12) / (E.hiLand + 0.12), 2)), 0]));
      Pz.eyes.shape = 'wide'; Pz.eyes.size = 1.12; Pz.eyes.open = 1;
      Pz.mouth = { shape: 'o', amt: 0.4 + 0.5 * (t / E.hiLand) }; Pz.lean = -0.08; Pz.arms[0].el = Pz.arms[1].el = -0.2;
      Pz.sq -= 0.05 * (t / E.hiLand);
    } else if (t < E.sit) {
      // the thud: a startled hop
      var hH = hop(Pz, t, E.hiLand + 0.04, E.hiLand + 0.3, 0.32, B1.hero, B1.hero);
      Pz.eyes.shape = 'wide'; Pz.eyes.size = 1.22; Pz.eyes.open = 1; Pz.mouth = { shape: 'o', amt: 1 };
      Pz.arms[0].el = Pz.arms[1].el = 0.9; Pz.lean = -0.12; lookAt(Pz, hiTop);
      Pz.yaw = toCam - 0.15 * m.ss(E.hiLand, E.sit, t);
    }
    var sitU = m.ss(E.sit, E.sit + 0.26, t), standU = m.ss(E.hiSay2 - 0.05, E.hiSay2 + 0.12, t);
    var sitK = sitU * (1 - standU);
    if (t >= E.sit && t < E.hiSay2 + 0.4) {
      Pz.sit = sitK; Pz.lean = 0.2 * sitK; Pz.tilt = 0.08 * sitK;
      // the Thinker: right paw to the chin, left paw on the knee
      Pz.arms[1] = { el: m.lerp(-0.5, 0.3, sitK), az: m.lerp(0.15, 2.0, sitK), len: m.lerp(1, 1.9, sitK) };
      Pz.arms[0] = { el: m.lerp(-0.5, -0.35, sitK), az: m.lerp(0.15, 0.95, sitK), len: 1 };
      Pz.eyes.shape = 'open'; Pz.brow = 0.55 * sitK;
      Pz.eyes.look = [-0.45, 0.55];
      if (t > E.cloudIn) {
        var dart = t < 1.75 ? [-0.55, 0.65] : t < 2.0 ? [0.5, 0.75] : t < 2.25 ? [-0.2, 0.9] : [0.05, 0.5];
        Pz.eyes.look = dart;
      }
      Pz.sq += 0.05 * sitK * m.wob(t - E.sit - 0.2, 3, 4);
      // "hi." : a small satisfied nod
      if (t >= E.hiSay && t < E.signHits[0]) {
        var nod = m.pulse(E.hiSay, E.hiSay + 0.1, E.hiSay + 0.3, E.hiSay + 0.45, t);
        Pz.lean += 0.12 * nod; Pz.eyes.open = 1 - 0.85 * nod; Pz.mouth = { shape: 'smile', amt: 0.6 * nod + 0.2 };
        Pz.eyes.look = [0, 0.1];
      }
      // the sign hits: flinches, then reads it
      if (t >= E.signHits[0] - 0.05) {
        var fl = 0;
        E.signHits.forEach(function (h) { fl += 0.12 * Math.exp(-Math.max(0, t - h) * 14) * (t >= h ? 1 : 0); });
        Pz.sq += fl; Pz.eyes.shape = 'wide';
        lookAt(Pz, V.add(B1.signP, [0, 1.75, 0]));
        Pz.twist = -0.22 * m.ss(E.signHits[0], E.read, t);
      }
      if (t >= E.read && t < E.cloudDouble) {
        var ln = Math.floor((t - E.read) / 0.15), lu = ((t - E.read) / 0.15) % 1;
        var sx = V.mad(V.add(B1.signP, [0, 2.05 - Math.min(ln, 2) * 0.32, 0]), S.think.tw, (lu - 0.5) * 1.5);
        lookAt(Pz, sx); Pz.eyes.shape = 'open'; Pz.brow = 0.3;
      }
      if (t >= E.cloudDouble) {
        // it tried not to think: the cloud doubles. sweat, wide eyes, a wobbly mouth, a little shake
        var dd = t - E.cloudDouble;
        Pz.eyes.shape = 'wide'; Pz.eyes.size = 1.2; Pz.sweat = m.ss(0, 0.2, dd); Pz.mouth = { shape: 'wobble', amt: 1 };
        Pz.tilt += 0.06 * Math.sin(dd * 40) * Math.exp(-dd * 4); Pz.lean -= 0.06; Pz.twist = -0.22 * (1 - m.ss(0, 0.3, dd));
        lookAt(Pz, V.add(B1.cloudC(t), [0, 0.4, 0]));
        if (t > E.handDown) { lookAt(Pz, V.add(B1.knobP, [0, 0.6 + 2.5 * (1 - m.ss(E.handDown, E.knobClicks[0], t)), 0])); }
      }
    }
    if (t >= E.hiSay2 - 0.05) {
      // answers instantly and beams; a happy hop; then trots off left
      Pz.sit = sitK; Pz.lean = 0.2 * sitK; Pz.brow = 0; Pz.sweat = 0;
      Pz.mouth = { shape: 'beam', amt: m.ss(E.hiSay2 - 0.05, E.hiSay2 + 0.08, t) };
      Pz.eyes.shape = 'happy';
      var hp = hop(Pz, t, E.beamHop + 0.05, E.beamHop + 0.3, 0.26, B1.hero, B1.hero);
      Pz.arms[0] = { el: 1.0 + 0.2 * Math.sin(t * 18), az: 0.2, len: 1 }; Pz.arms[1] = { el: 1.0 + 0.2 * Math.sin(t * 18 + 1), az: 0.2, len: 1 };
      if (t > E.cloudZip) {
        var dir = V.mul(S.think.tw, -1);
        var wd = walk(Pz, t, [[E.cloudZip + 0.1, B1.hero], [E.cloudZip + 0.95, groundAt(V.mad(B1.hero, dir, 2.6))]], 3.6);
        Pz.yaw = angLerp(toCam, yawDir(dir) - 0.3, m.ss(E.cloudZip, E.cloudZip + 0.2, t));
        Pz.arms[0].el = Pz.arms[1].el = -0.2; Pz.mouth = { shape: 'smile', amt: 1 }; Pz.eyes.shape = 'open';
      }
    }
    return Pz;
  }
  function buildB12(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var hP = heroB12(t, ctx.cam);
    var h = null;
    if (t < E.flyIn + 0.15) { h = FG.buildHero(B, hP); ctx.anchors.hero = V.add(h.top, [0, 0.22, 0]); ctx.anchors.mouth = h.mouth; }
    return { hero: h, pose: hP };
  }
  // world items at the HIGH site that persist through the film
  function buildHighProps(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    hiLetters(B, t);
    // the sign: falls from the sky and is hammered in (three hits)
    var sh = E.signHits, sink = 0, y = 0, tilt = 0;
    if (t < sh[0]) { var u = m.sat((t - (sh[0] - 0.22)) / 0.22); y = 6 * (1 - u * u); sink = 0; }
    else { sink = 0.25 * m.ss(sh[0], sh[0] + 0.03, t) + 0.15 * m.ss(sh[1], sh[1] + 0.03, t) + 0.1 * m.ss(sh[2], sh[2] + 0.03, t); }
    sh.forEach(function (hh, i) { if (t >= hh) tilt += 0.05 * (i % 2 ? -1 : 1) * Math.exp(-(t - hh) * 10) * Math.cos((t - hh) * 30); });
    if (t > sh[0] - 0.22) {
      var sp = V.add(B1.signP, [0, y + 0.5, 0]);
      P.sign(B, T, sp, yawToward(B1.signP, at(S.think, -6, 0.3)), sink + 0.5, tilt, 1.0);
      sh.forEach(function (hh, i) { if (t > hh) P.dust(B, B1.signP, t - hh, 0.55 - i * 0.1, 7, 30 + i); });
    }
    // the mini dial knob in the ground, turned HIGH -> LOW by the user's giant glove
    var kc = E.knobClicks, ang = -60;
    if (t > kc[0] - 0.05) { ang = -60 + 120 * m.ss(kc[0] - 0.05, kc[2] + 0.04, t); }
    var kyaw = yawToward(B1.knobP, at(S.think, -5, 0.6));
    P.knob(B, T, B1.knobP, kyaw, ang, 1.0);
    // dust from the "hi" landing
    if (t > E.hiLand) P.dust(B, B1.hiP, t - E.hiLand, 1.5, 12, 3);
    // the glove (descends, grips, turns, leaves)
    var hd = E.handDown, gEnd = kc[2] + 0.45;
    if (t > hd - 0.05 && t < gEnd + 0.5) {
      var down = m.eo((t - hd) / 0.3), up = m.ei((t - gEnd) / 0.4);
      var gy = B1.knobP[1] + 0.02 + 4.5 * (1 - down) + 5 * up;
      var grip = m.ss(kc[0] - 0.12, kc[0], t) * (1 - m.ss(gEnd - 0.1, gEnd + 0.05, t));
      var gm = M.mul(M.mul(M.trans(B1.knobP[0], gy, B1.knobP[2]), M.rotY(kyaw + (ang + 60) * D2R)), M.scale(0.85, 0.85, 0.85));
      P.glove(B, gm, 'grip', grip);
    }
    // the thought cloud
    if (t > E.cloudPuff[0] - 0.02 && t < E.flyOut + 0.3) {
      var cs = cloudState(t);
      var cc = V.add(B1.cloudC(t), cs.off);
      var puffs = E.cloudPuff.map(function (pt) { return t < pt ? 0 : m.spring(t - pt, 4, 0.35) * (t > E.cloudZip ? Math.max(0, 1 - (t - E.cloudZip) * 3) : 1); });
      var head = V.add(B1.hero, [0, 1.4, 0]);
      if (cs.s > 0.01 || puffs[0] > 0) ctx.thoughtArgs = { c: cc, s: cs.s, t: t, churn: cs.churn, gears: cs.gears, qs: cs.qs, spin: cs.spin, cam: ctx.C, head: head, puffs: puffs, deflate: cs.df };
      ctx.cloudC = cc; ctx.cloudS = cs.s;
    }
  }

  /* ================================================================ BEAT 3: the plank bridge */
  var B3 = {};
  B3.start = keyP(-1.58, 0.05);
  function plankLand(k) { return k < 5 ? E.planks[k] : E.lastPlank; }
  function heroB3(t) {
    var camP = FG.cameraAt(t).eye;
    var faceU = yawDir(CCW_KEY);
    var Pz = base(B3.start, faceU, t);
    var u = -1.58;
    // advance with each plank: a small hop forward after it lands
    for (var k = 0; k < 5; k++) {
      var tl = E.planks[k], target = PL.u(k) - (k === 4 ? 0.85 : 0.55);
      if (t > tl + 0.02) {
        var hu = m.sat((t - tl - 0.02) / 0.12);
        u = Math.max(u, m.lerp(u, target, hu));
        if (hu < 1) { Pz.p[1] += Math.sin(hu * Math.PI) * 0.12; Pz.sq += -0.08 * Math.sin(hu * Math.PI); FG.trot(Pz, hu * 0.5, 0.8); }
      }
      // a throw before each plank lands
      var th = m.pulse(tl - 0.16, tl - 0.08, tl - 0.04, tl + 0.02, t);
      Pz.arms[1].el = Math.max(Pz.arms[1].el, -0.5 + 1.6 * th); Pz.arms[1].az = 0.15 + 1.0 * th;
      Pz.arms[0].el = Math.max(Pz.arms[0].el, -0.5 + 1.0 * th);
    }
    Pz.p = keyP(u, 0.05);
    if (t < E.turnAsk) Pz.yaw = tq(Pz, faceU, camP, 0.32);
    if (t < E.stopShort) { Pz.eyes.shape = 'squint'; Pz.brow = 0.4; Pz.mouth = { shape: 'flat', amt: 0.6 }; lookAt(Pz, keyP(u + 1.0, 0, KEY.top - 0.2)); Pz.lean = 0.12; }
    // stops one plank short, turns to the camera with a tiny sign
    var turn = m.ss(E.turnAsk, E.turnAsk + 0.15, t) * (1 - m.ss(E.toss + 0.05, E.toss + 0.22, t));
    var yCam = yawToward(Pz.p, camP);
    Pz.yaw = angLerp(t < E.turnAsk ? tq(Pz, faceU, camP, 0.32) : faceU, yCam, turn);
    var ask = m.ss(E.turnAsk, E.turnAsk + 0.15, t) * (1 - m.ss(E.toss - 0.02, E.toss + 0.06, t));
    if (t >= E.stopShort) {
      Pz.eyes.shape = 'open'; Pz.brow = 0; Pz.lean = 0;
      Pz.mouth = { shape: 'smile', amt: 0.55 * ask };
      Pz.tilt = 0.16 * ask * (t > E.scratch ? 1 : m.ss(E.turnAsk, E.scratch, t));
      if (ask > 0) { lookAt(Pz, camP); Pz.arms[1] = { el: m.lerp(-0.5, 1.2, ask), az: m.lerp(0.15, 0.55, ask), len: 1.0 }; }
      // two expectant blinks during the hold
      Pz.eyes.open = Math.min(Pz.eyes.open, 1 - 0.95 * (m.pulse(8.62, 8.66, 8.7, 8.74, t) + m.pulse(8.98, 9.02, 9.06, 9.1, t)));
      if (t >= E.scratch && t < E.scratch + 0.16) Pz.sq += 0.0;           // freeze-hold (no breathing jiggle)
    }
    // toss, grab the last plank, slap it in, trot across and hop down
    if (t >= E.toss) {
      var sw = m.pulse(E.toss - 0.03, E.toss + 0.05, E.toss + 0.1, E.toss + 0.2, t);
      Pz.arms[1] = { el: 0.2 + 1.1 * sw, az: -0.4 + 1.2 * sw, len: 1 };
      Pz.eyes.shape = 'open'; Pz.mouth = { shape: 'smile', amt: 0.4 };
      var slap = m.pulse(E.lastPlank - 0.2, E.lastPlank - 0.08, E.lastPlank, E.lastPlank + 0.1, t);
      Pz.arms[0].el = Math.max(Pz.arms[0].el, -0.5 + 1.4 * slap); Pz.arms[1].el = Math.max(Pz.arms[1].el, -0.5 + 1.4 * slap);
      Pz.lean = 0.18 * slap; Pz.sq += t > E.lastPlank ? 0.12 * Math.exp(-(t - E.lastPlank) * 10) : 0;
    }
    if (t >= E.cross) {
      var path = [[E.cross, keyP(u, 0.05)], [E.hopDown - 0.02, keyP(2.35, 0.05)]];
      var wd = walk(Pz, t, path, 3.4);
      Pz.yaw = tq(Pz, faceU, camP, 0.42); Pz.mouth = { shape: 'smile', amt: 0.8 }; Pz.eyes.look = [0.3, 0];
      if (t >= E.hopDown - 0.12) {
        var land = groundAt(V.mad(keyP(3.0, 0.05, 0), CCW_KEY, 0.65));
        hop(Pz, t, E.hopDown, E.hopDown + 0.26, 0.35, keyP(2.35, 0.05), land);
        if (t > E.hopDown + 0.26) {
          var nx = S.clear.p;
          walk(Pz, t, [[E.hopDown + 0.3, land], [11.0, at(S.clear, 0.05, 0.15)]], 3.4);
          Pz.yaw = tq(Pz, yawToward(land, nx), camP, 0.4);
        }
      }
    }
    return Pz;
  }
  function buildB3(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var hP = heroB3(t), h = FG.buildHero(B, hP);
    ctx.anchors.hero = V.add(h.top, [0, 0.3, 0]);
    // the tiny sign "Want me to continue?"
    var ask = m.ss(E.turnAsk + 0.02, E.turnAsk + 0.16, t);
    if (t > E.turnAsk && t < E.toss + 0.5) {
      var hand = V.lerp(h.handR, V.add(h.top, [0, 0.5, 0]), 0.55), Mb;
      if (t < E.toss) {
        var cam = FG.cameraAt(t);
        var yw = yawToward(hand, cam.eye);
        Mb = M.mul(M.mul(M.trans(hand[0], hand[1] + 0.05, hand[2]), M.mul(M.rotY(yw), M.rotZ(0.06 * Math.sin(t * 5)))), M.scale(ask, ask, ask));
      } else {
        var u = (t - E.toss) / 0.5, p = V.add(hand, [-1.4 * u * KEY.t[0], 1.8 * u - 3 * u * u + 0.05, -1.4 * u * KEY.t[2]]);
        Mb = M.mul(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(u * 9)), M.rotZ(u * 5));
      }
      P.handSign(B, T, Mb, 'ask', 1.02, 0.52, 1.05);
    }
    return { hero: h, pose: hP };
  }
  function buildBridge(ctx) {
    var t = ctx.t, B = ctx.B;
    // the keycap's legend, printed on the near half
    ctx.T.quad('keyK', keyP(-2.05, 1.35, KEY.top + 0.006), [KEY.t[0], 0, KEY.t[2]], [KEY.rd[0], 0, KEY.rd[2]], 1.05, FG.col.srgb(0x8f84b8), 1.0);
    // a small pile of planks at the start; planks fly from it and slap into the gap
    var pile = keyP(-2.5, -0.55);
    var used = 0; for (var k = 0; k < 6; k++) if (t > plankLand(k) - 0.16) used++;
    for (var i = 0; i < 6 - used; i++) P.plank(B, M.mul(M.trans(pile[0], pile[1] + 0.05 + i * 0.09, pile[2]), M.rotY(yawDir(CCW_KEY) + 0.1 * (i % 2))), PL.len, PL.w, i);
    for (k = 0; k < 6; k++) {
      var tl = plankLand(k), fly = 0.16;
      if (t < tl - fly) continue;
      var dst = keyP(PL.u(k), 0, KEY.top - 0.045), u = m.sat((t - (tl - fly)) / fly);
      var src = V.add(pile, [0, 0.3, 0]), p = V.lerp(src, dst, u); p[1] += Math.sin(u * Math.PI) * 0.7;
      var bounce = t > tl ? 0.06 * Math.exp(-(t - tl) * 18) * Math.cos((t - tl) * 40) : 0;
      var rot = (1 - u) * 2.5;
      p[1] += bounce;
      if (k === 5 && t < tl - fly + 0.0001) continue;
      P.plank(B, M.mul(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(yawDir(CCW_KEY) + Math.PI / 2)), M.rotX(rot)), PL.len, PL.w, k);
      if (t > tl) P.dust(B, V.add(dst, [0, -0.2, 0]), t - tl, k === 5 ? 0.7 : 0.35, 6, 50 + k, FG.col.mix(C.key, C.cream, 0.5));
    }
  }

  /* ================================================================ BEAT 4: the thumbs-up */
  var B4 = {};
  B4.spot = at(S.clear, 0.05, 0.15);
  B4.thumbP = function (t) {
    var d = m.eo((t - E.thumbDown) / (E.thumbStop - E.thumbDown)), up = m.ei((t - E.thumbUp) / 0.55);
    var base = at(S.clear, 1.2, -0.2, 2.75);
    return V.add(base, [0, 9 * (1 - d) + 9 * up + 0.08 * Math.sin(t * 2.2), 0]);
  };
  function heroB4(t) {
    var camP = FG.cameraAt(t).eye;
    var Pz = base(B4.spot, yawToward(B4.spot, camP) - 0.35, t);
    var tp = B4.thumbP(t);
    if (t < 10.95) { var Pw = heroB3(t); return Pw; }
    var settle = m.ss(10.95, 11.15, t);
    Pz.sq += 0.08 * Math.exp(-(t - 10.95) * 8) * (t > 10.95 ? 1 : 0);
    lookAt(Pz, tp);
    Pz.eyes.shape = 'open';
    if (t > E.thumbStop - 0.2) { Pz.eyes.size = 1.08; }
    if (t > E.huh[0] - 0.15 && t < E.banner + 0.3) {
      var hu = m.ss(E.huh[0] - 0.15, E.huh[0] + 0.05, t);
      Pz.tilt = 0.32 * hu; Pz.eyes.l = 0.62; Pz.eyes.r = 1.0; Pz.mouth = { shape: 'wobble', amt: 0.7 * hu };
      Pz.arms[1] = { el: m.lerp(-0.5, 0.1, hu), az: m.lerp(0.15, 0.9, hu), len: 0.9 };
    }
    var bn = m.ss(E.bannerSet, E.bannerSet + 0.1, t);
    if (t > E.bannerSet) {
      // reads the banner, line by line
      var rd = (t - E.bannerSet) / 0.3, ln = Math.min(1, Math.floor(rd)), lu = rd % 1;
      var bc = at(S.clear, 1.0, -0.15, 2.45);
      if (t < 12.9) lookAt(Pz, V.mad(V.add(bc, [0, 0.25 - ln * 0.45, 0]), S.clear.tw, (lu - 0.5) * 2.0));
      Pz.tilt = 0.32 * (1 - m.ss(E.bannerSet, E.bannerSet + 0.2, t));
    }
    if (t > 12.9) {
      // gets it: bright eyes, then a salute
      Pz.eyes.shape = 'wide'; Pz.eyes.size = 1.12; Pz.mouth = { shape: 'smile', amt: 1 };
      var sal = m.ss(E.salute, E.salute + 0.12, t) * (1 - m.ss(E.sprint - 0.05, E.sprint + 0.05, t));
      Pz.arms[1] = { el: m.lerp(-0.5, 1.35, sal), az: m.lerp(0.15, 1.15, sal), len: m.lerp(1, 1.1, sal) };
      Pz.sq += -0.08 * sal; lookAt(Pz, camP);
      Pz.yaw = yawToward(B4.spot, camP) - 0.15;
    }
    if (t >= E.sprint - 0.08) {
      // the sprint: anticipation, then a zip left into the village
      var ant = m.pulse(E.sprint - 0.08, E.sprint, E.sprint + 0.04, E.sprint + 0.1, t);
      Pz.sq += 0.2 * ant; Pz.lean = -0.15 * ant;
      var dirL = V.norm(V.sub(at(S.village, -0.4, 1.25), B4.spot));
      Pz.yaw = angLerp(yawToward(B4.spot, camP), yawDir(dirL), m.ss(E.sprint - 0.05, E.sprint + 0.08, t));
      if (t > E.sprint + 0.06) {
        var mid = groundAt(V.add(V.lerp(B4.spot, at(S.village, -0.4, 1.25), 0.5), V.mul(S.clear.o, -0.8)));
        walk(Pz, t, [[E.sprint + 0.06, B4.spot], [13.72, mid], [E.arrive, at(S.village, -0.4, 1.25)]], 7.5);
        Pz.yaw = tq(Pz, yawDir(V.norm(V.sub(at(S.village, -0.4, 1.25), Pz.p))), camP, 0.3);
        Pz.lean = 0.28; Pz.eyes.shape = 'squint'; Pz.brow = 0.8; Pz.mouth = { shape: 'smile', amt: 0.8 };
        Pz.arms[0].el = Pz.arms[1].el = -0.1; Pz.arms[0].az = Pz.arms[1].az = -0.9;
      }
    }
    return Pz;
  }
  function buildB4(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var hP = heroB4(t), h = FG.buildHero(B, hP);
    ctx.anchors.hero = V.add(h.top, [0, 0.3, 0]);
    // the giant thumbs-up from the clouds
    if (t > E.thumbDown - 0.05 && t < E.thumbUp + 0.7) {
      var tp = B4.thumbP(t), cam = FG.cameraAt(t);
      var yw = yawToward(tp, cam.eye) + 0.35;
      P.glove(B, M.mul(M.mul(M.trans(tp[0], tp[1], tp[2]), M.rotY(yw)), M.scale(1.12, 1.12, 1.12)), 'thumb');
      var gl = m.ss(E.thumbDown, E.thumbStop, t) * (1 - m.ss(E.thumbUp, E.thumbUp + 0.4, t));
      if (gl > 0) ctx.G.halo(V.add(tp, [0, 0.4, 0]), 3.2, [0.32 * gl, 0.24 * gl, 0.12 * gl], ctx.C);
    }
    // two "?" pop above its head
    E.huh.forEach(function (ht, i) {
      if (t < ht || t > E.banner + 0.25) return;
      var k = m.spring(t - ht, 4, 0.35) * (1 - m.ss(E.banner, E.banner + 0.2, t));
      var q = V.add(h.top, [0, 0.42 + i * 0.12, 0]); q = V.mad(q, ctx.C.right, (i ? 0.38 : -0.22));
      B.push(M.mul(M.mul(P.billboard(q, ctx.C), M.rotZ((i ? -0.2 : 0.25) + 0.08 * Math.sin(t * 9 + i))), M.scale(k, k, k)));
      FG.blockWord(B, '?', 0.065, { col: C.violet, colTop: C.lilac, th: 1.25, dep: 1.2 });
      B.pop();
    });
    return { hero: h, pose: hP };
  }

  function buildBanner(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    // the banner descending on two ropes
    if (t > E.banner && t < 15.3) {
      var unf = m.ss(E.banner, E.bannerSet, t);
      var bc = at(S.clear, 1.0, -0.15, 2.95 + 2.5 * (1 - m.eo((t - E.banner) / 0.38)) + 9 * m.ei((t - 14.3) / 0.9));
      var cam2 = FG.cameraAt(Math.min(t, 13.3));
      var yb = yawToward(bc, cam2.eye);
      P.banner(B, T, M.mul(M.trans(bc[0], bc[1], bc[2]), M.rotY(yb)), 2.5, 0.95, unf, t, 1.05);
    }
  }

  /* ================================================================ BEAT 5: the village and the crown */
  var B5 = {};
  B5.houses = [[0.65, -1.3], [0.65, 0], [0.65, 1.3], [2.0, -1.3], [2.0, 0], [2.0, 1.3]];
  B5.flags = [[-0.05, 1.95, 'tests'], [1.35, 0.65, 'docs'], [-0.1, -0.65, 'tests'], [1.35, -0.65, 'docs'], [-0.1, -1.95, 'tests'], [2.75, 1.95, 'docs']];
  B5.meter = [3.05, -0.55];
  function heroB5(t) {
    var camP = FG.cameraAt(t).eye, Pz;
    if (t < E.arrive) return heroB4(t);
    var spot0 = at(S.village, -0.4, 1.25);
    Pz = base(spot0, yawToward(spot0, camP) - 0.2, t);
    // skid to a stop
    var sk = Math.exp(-(t - E.arrive) * 7);
    Pz.lean = -0.25 * sk; Pz.sq += 0.12 * sk;
    var crownK = m.ss(E.crown, E.crown + 0.05, t);
    if (t < E.crown + 0.2) lookAt(Pz, V.add(Pz.p, [0, 2.0, 0]));
    if (t > E.crown) { Pz.sq += 0.15 * Math.exp(-(t - E.crown) * 10); }
    if (t > E.crown + 0.25) {
      // determined: brows down, a proud stretch, looking round the village
      Pz.eyes.shape = 'squint'; Pz.brow = 1.0; Pz.mouth = { shape: 'smile', amt: 0.7 };
      Pz.sq += -0.08 * m.pulse(E.crown + 0.25, E.crown + 0.35, E.crown + 0.5, E.crown + 0.6, t);
      lookAt(Pz, at(S.village, 1.3, t < 14.8 ? -1.3 : 1.0, 0.5));
    }
    // merge: push the right front house into the middle one
    if (t >= 14.95) {
      var pth = [[14.95, spot0], [E.merge, at(S.village, 0.15, 1.95)], [E.mergeDone, at(S.village, 0.15, 1.5)]];
      var wd = walk(Pz, t, pth, 5);
      Pz.yaw = tq(Pz, t < E.merge ? yawDir(V.norm(V.sub(pth[1][1], spot0))) : yawDir(V.mul(S.village.tw, -1)), camP, 0.3);
      if (t >= E.merge) { var push = m.ss(E.merge, E.merge + 0.08, t); Pz.arms[0] = { el: 0.1, az: 1.3 * push, len: 1.15 }; Pz.arms[1] = { el: 0.1, az: 1.3 * push, len: 1.15 }; Pz.lean = 0.3 * push; Pz.mouth = { shape: 'flat', amt: 0.8 }; }
    }
    // flags: a zippy frenzy from flag to flag
    if (t >= E.mergeDone + 0.05) {
      var pts = [[E.mergeDone + 0.05, at(S.village, 0.15, 1.5)]];
      E.flags.forEach(function (ft, i) { var f = B5.flags[i]; pts.push([ft - 0.02, at(S.village, f[0] - 0.42, f[1] + 0.12)]); });
      walk(Pz, t, pts, 9);
      var nxt = 0; for (var i = 0; i < E.flags.length; i++) if (t > E.flags[i] - 0.02) nxt = Math.min(i + 1, E.flags.length - 1);
      Pz.yaw = tq(Pz, yawToward(Pz.p, pts[Math.min(nxt + 1, pts.length - 1)][1]), camP, 0.3);
      Pz.lean = 0.25; Pz.eyes.shape = 'squint'; Pz.brow = 1; Pz.mouth = { shape: 'beam', amt: 0.8 };
      E.flags.forEach(function (ft) { var pl = m.pulse(ft - 0.06, ft - 0.02, ft, ft + 0.05, t); Pz.arms[1].el = Math.max(Pz.arms[1].el, -0.5 + 1.6 * pl); Pz.sq += 0.1 * pl; });
    }
    // paint the front-left house (nobody asked)
    if (t >= E.flags[5] + 0.03) {
      var pp = at(S.village, 0.35, -2.25);
      walk(Pz, t, [[E.flags[5] + 0.03, at(S.village, B5.flags[5][0] - 0.42, B5.flags[5][1] + 0.12)], [E.paint - 0.02, pp]], 8);
      if (t > E.paint - 0.02) {
        Pz.yaw = tq(Pz, yawDir(S.village.tw), camP, 0.45);
        var sw = Math.sin((t - E.paint) * Math.PI / 0.18);
        Pz.arms[1] = { el: 0.6 + 0.5 * sw, az: 0.9, len: 1.1 }; Pz.arms[0] = { el: 0.3 - 0.4 * sw, az: 0.9, len: 1.1 };
        Pz.tilt = 0.1 * sw;
      }
    }
    // proud, then dash to the mine
    if (t >= E.paintDone + 0.05) {
      var pr = at(S.village, -0.55, -0.3);
      walk(Pz, t, [[E.paintDone + 0.05, at(S.village, 0.35, -2.25)], [E.proud, pr]], 5);
      Pz.yaw = yawToward(pr, camP) - 0.1; Pz.eyes.shape = 'happy'; Pz.brow = 0; Pz.mouth = { shape: 'beam', amt: 1 }; Pz.lean = -0.06;
      var dust = m.pulse(E.proud, E.proud + 0.05, E.proud + 0.3, E.proud + 0.38, t);
      Pz.arms[0] = { el: 0.1 + 0.25 * Math.sin(t * 30) * dust, az: 1.2 * dust, len: 1 }; Pz.arms[1] = { el: 0.1 - 0.25 * Math.sin(t * 30) * dust, az: 1.2 * dust, len: 1 };
      Pz.sq += -0.06 * m.ss(E.proud, E.proud + 0.2, t);
    }
    if (t >= E.dash - 0.08) {
      var pr2 = at(S.village, -0.55, -0.3), mine = at(S.mine, -0.25, 0.55);
      var ant = m.pulse(E.dash - 0.08, E.dash, E.dash + 0.03, E.dash + 0.08, t);
      Pz.sq += 0.2 * ant;
      var dirM = V.norm(V.sub(mine, pr2));
      Pz.yaw = angLerp(Pz.yaw, tq(Pz, yawDir(dirM), camP, 0.3), m.ss(E.dash - 0.06, E.dash + 0.04, t));
      if (t > E.dash + 0.03) { walk(Pz, t, [[E.dash + 0.03, pr2], [E.dive - 0.03, mine]], 9); Pz.lean = 0.3; Pz.eyes.shape = 'squint'; Pz.mouth = { shape: 'smile', amt: 1 }; }
    }
    return Pz;
  }
  function houseState(i, t) {
    var h = B5.houses[i], b = h[1], wide = 1, col = C.house, roof = C.roof, show = true, sq = 0;
    if (i === 1 || i === 2) {
      // the two front houses (middle, right) slide together and become one wide house
      var u = m.ss(E.merge, E.mergeDone - 0.04, t);
      if (t < E.mergeDone) { b = m.lerp(h[1], 0.65, u * 0.62); sq = 0.1 * u; }
      else if (i === 2) show = false;
      else { b = 0.65; wide = 2.05; sq = 0.22 * Math.exp(-(t - E.mergeDone) * 8) * Math.cos((t - E.mergeDone) * 30); }
    }
    if (i === 0) {
      var pu = m.ss(E.paint, E.paint + 0.1, t) * 0.5 + m.ss(E.paint + 0.2, E.paint + 0.3, t) * 0.5;
      col = FG.col.mix(C.house, FG.col.mix(C.coral, C.light, 0.35), pu); roof = FG.col.mix(C.roof, C.gold, pu);
    }
    return { a: h[0], b: b, wide: wide, col: col, roof: roof, show: show, sq: sq };
  }
  function buildVillage(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var fy = yawDir(V.mul(S.village.o, -1));
    for (var i = 0; i < 6; i++) {
      var hs = houseState(i, t); if (!hs.show) continue;
      var p = at(S.village, hs.a, hs.b);
      P.house(B, M.mul(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(fy)), M.scale(1 + hs.sq * 0.4, 1 - hs.sq, 1)), hs.wide, hs.col, hs.roof);
    }
    if (t > E.mergeDone) P.dust(B, at(S.village, 0.9, 0.65), t - E.mergeDone, 1.3, 10, 61);
    if (t > E.paint && t < E.paint + 0.9) P.dust(B, at(S.village, 0.95, -1.3, 0.3), t - E.paint, 0.6, 7, 62, FG.col.mix(C.coral, C.light, 0.4));
    B5.flags.forEach(function (f, i) {
      var ft = E.flags[i]; if (t < ft) return;
      var k = m.spring(t - ft, 5, 0.3), p = at(S.village, f[0], f[1]);
      P.flag(B, T, M.mul(M.trans(p[0], p[1], p[2]), M.rotY(fy + 0.25)), f[2], k, t + i, 1.0);
    });
    // the token meter
    var mp = at(S.village, B5.meter[0], B5.meter[1]);
    var mu = t < 15.0 ? 0 : t < E.meterTop ? m.eio((t - 15.0) / (E.meterTop - 15.0)) * 0.97 : 0.97 + 0.02 * Math.sin((t - E.meterTop) * 3);
    P.meter(B, T, M.mul(M.trans(mp[0], mp[1], mp[2]), M.rotY(fy + 0.45)), mu, t, 1.0);
  }
  function buildB5(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var hP = heroB5(t), h = FG.buildHero(B, hP);
    ctx.anchors.hero = V.add(h.top, [0, 0.3, 0]);
    // the crown drops onto its head (and stays for the rest of the film)
    if (t > E.crown - 0.3) {
      var fall = m.sat((t - (E.crown - 0.3)) / 0.3), yoff = 4 * (1 - fall * fall);
      var bounce = t > E.crown ? 0.1 * Math.exp(-(t - E.crown) * 9) * Math.abs(Math.sin((t - E.crown) * 20)) : 0;
      var cm = M.mul(h.bm, M.mul(M.trans(0.05, HERO.BH - 0.02 + yoff + bounce, -0.02), M.rotZ(0.12)));
      var cam = FG.cameraAt(t);
      if (t < 18.0) { P.crown(B, T, cm, false, 1.05); P.placard(B, T, cm, FG.cameraAt(t).eye, 1.05); }
    }
    return { hero: h, pose: hP };
  }

  /* ================================================================ BEAT 6: the quiet mine */
  var B6 = {};
  B6.hole = function () { return W.MINE.hole; };
  function heroB6(t) {
    var camP = FG.cameraAt(t).eye, hole = W.MINE.p;
    if (t < E.dive - 0.03) return heroB5(t);
    var Pz = base(hole, yawDir(V.norm(V.sub(hole, at(S.mine, -0.25, 0.55)))), t);
    if (t < E.dive + 0.35) {
      // the dive: up, flip head-first, down the hole
      var u = m.sat((t - (E.dive - 0.03)) / 0.38);
      var from = at(S.mine, -0.25, 0.55);
      Pz.p = V.lerp(from, hole, Math.min(1, u * 1.5)); Pz.p[1] += Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.55 - Math.max(0, u - 0.55) * 4.0;
      Pz.lean = Math.min(1.5, u * 2.6); Pz.sq = -0.25 * Math.sin(u * Math.PI);
      Pz.arms[0] = { el: 1.3, az: 1.2, len: 1.1 }; Pz.arms[1] = { el: 1.3, az: 1.2, len: 1.1 };
      Pz.eyes.shape = 'squint'; Pz.mouth = { shape: 'beam', amt: 1 }; Pz.legFollow = 1;
      return Pz;
    }
    // head pops out of the hole (three times)
    Pz.p = [hole[0], hole[1] - 3, hole[2]]; Pz.legFollow = 1;
    Pz.yaw = yawToward(hole, camP) - 0.1;
    for (var i = 0; i < 3; i++) {
      var tp = E.pops[i], up = m.spring(t - tp, 3.6, 0.42) * (1 - m.ss(tp + 0.42, tp + 0.56, t));
      if (t >= tp && t < tp + 0.6) {
        Pz.p = [hole[0], hole[1] - 1.3 + up * 0.95, hole[2]];
        Pz.eyes.shape = i === 1 ? 'wide' : 'open'; Pz.mouth = { shape: i === 1 ? 'o' : 'smile', amt: 0.9 };
        lookAt(Pz, camP); Pz.tilt = (i - 1) * 0.12;
        Pz.arms[0] = { el: 0.9, az: 0.4, len: 1 }; Pz.arms[1] = { el: i === 1 ? 1.25 : 0.9, az: 0.4, len: 1 };
        Pz.sq = -0.1 * m.wob(t - tp, 4, 6);
      }
    }
    return Pz;
  }
  function buildB6(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T, hole = W.MINE.hole;
    var hP = heroB6(t);
    var h = null;
    if (t < E.dive + 0.38 || (t > E.pops[0] - 0.01 && t < E.pops[2] + 0.62)) {
      var visible = t < E.dive + 0.38 || E.pops.some(function (tp) { return t >= tp && t < tp + 0.6; });
      if (visible) h = FG.buildHero(B, hP);
    }
    if (h) ctx.anchors.pop = V.add(h.top, [0, 0.25, 0]), ctx.anchors.hero = ctx.anchors.pop;
    if (t > E.pops[0] - 0.02) ctx.anchors.pop = ctx.anchors.pop || V.add(hole, [0, 1.0, 0]);
    // the bug it found
    if (h && t >= E.pops[1] && t < E.pops[1] + 0.6) {
      var bp = V.add(h.handR, [0, 0.08, 0]);
      B.push(M.mul(M.trans(bp[0], bp[1], bp[2]), M.rotY(t * 3)));
      B.chamfer([0, 0, 0], [0.09, 0.05, 0.12], 0.03, FG.col.srgb(0x3d6b4a), 0.05, FG.col.srgb(0x5fae7e));
      for (var l = 0; l < 3; l++) for (var s = -1; s <= 1; s += 2) B.box(s * 0.11, -0.02, -0.07 + l * 0.07, 0.04, 0.008, 0.008, C.ink);
      B.pop();
    }
    // dirt flying out while it digs
    if (t > E.dive + 0.2 && t < E.pops[2] + 0.4) {
      for (var k = 0; k < 3; k++) {
        var ph = (t * 2.2 + k * 0.33) % 1, a = k * 2.1 + Math.floor(t * 2.2 + k * 0.33) * 1.3;
        if (t < 18.8 || (t > 18.95 && t < 20.3)) continue;      // silence is silent: no dirt during the quiet bit
        var p = V.add(hole, [Math.cos(a) * ph * 0.8, Math.sin(ph * Math.PI) * 0.7, Math.sin(a) * ph * 0.8]);
        B.push(M.trans(p[0], p[1], p[2])); B.ico(0, 0.05 * (1 - ph), C.sandD, 0, 0, 0.3, 90 + k); B.pop();
      }
    }
    if (t > E.dive + 0.25) P.dust(B, hole, t - E.dive - 0.25, 0.9, 9, 81);
    return { hero: h, pose: hP };
  }
  function buildMineProps(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T, mp = W.MINE.p, hole = W.MINE.hole;
    // the dark hole
    B.push(M.trans(hole[0], hole[1], hole[2]));
    B.cyl(12, 0.6, 0.6, -0.02, 0.0, [0.025, 0.012, 0.02], 0, [0.025, 0.012, 0.02], 2);
    B.cyl(12, 0.6, 0.52, -1.6, -0.02, [0.04, 0.02, 0.03], 0, null, 2, 0, true);
    B.pop();
    // lantern on the beam: a warm glow
    var mf = V.norm([-mp[0], 0, -mp[2]]), lp = V.add(V.mad(mp, mf, -0.35), [0, 1.0, 0]);
    var sideV = V.norm(V.cross([0, 1, 0], mf)); lp = V.mad(lp, sideV, 0.45);
    var sway = Math.sin(t * 1.7) * 0.06;
    B.push(M.mul(M.trans(lp[0], lp[1], lp[2]), M.rotZ(sway)));
    B.box(0, 0.16, 0, 0.008, 0.08, 0.008, C.ink);
    B.chamfer([0, 0, 0], [0.09, 0.12, 0.09], 0.03, FG.col.srgb(0xffd27a), 2.2);
    B.chamfer([0, 0.13, 0], [0.1, 0.025, 0.1], 0.01, C.ink);
    B.pop();
    ctx.G.halo(lp, 0.9, [0.5, 0.3, 0.12], ctx.C);
    // tumbleweed rolls through the silence
    if (t > E.tumble - 0.1 && t < E.tumble + 1.3) {
      var u = (t - E.tumble) / 1.15, from = at(S.mine, -1.6, 3.2), to = at(S.mine, -0.9, -3.6);
      var p = V.lerp(from, to, u); p[1] = W.groundXZ(p[0], p[2]) + 0.24 + Math.abs(Math.sin(u * 9)) * 0.22;
      P.tumble(B, p, -u * 14, 1.0);
    }
    // a cricket on a stone, chirping
    var cp = at(S.mine, -0.95, -1.05, 0.0);
    B.push(M.trans(cp[0], cp[1], cp[2])); B.ico(0, 0.16, FG.col.mix(C.rock, C.sand2, 0.5), 0, 0, 0.2, 120); B.pop();
    var ck = V.add(cp, [0, 0.16, 0]), cy = yawToward(ck, FG.cameraAt(t).eye) + 1.4;
    B.push(M.mul(M.trans(ck[0], ck[1], ck[2]), M.rotY(cy)));
    var chirping = E.chirps.some(function (c) { return t > c && t < c + 0.2; });
    B.chamfer([0, 0.03, 0], [0.07, 0.025, 0.03], 0.012, FG.col.srgb(0x4f8a4a), 0.05);
    B.chamfer([0.07, 0.04, 0], [0.025, 0.022, 0.022], 0.01, FG.col.srgb(0x3d6b3a));
    B.push(M.mul(M.trans(-0.02, 0.06, 0), M.rotZ(chirping ? 0.5 + 0.2 * Math.sin(t * 90) : 0.25))); B.box(-0.04, 0, 0, 0.05, 0.006, 0.025, FG.col.srgb(0x6fae5a)); B.pop();
    B.pop();
    E.chirps.forEach(function (c, i) {
      if (t < c || t > c + 0.45) return;
      var k = m.ss(c, c + 0.06, t) * (1 - m.ss(c + 0.3, c + 0.45, t));
      var q = V.add(ck, [0, 0.32 + (t - c) * 0.4, 0]); q = V.mad(q, ctx.C.right, 0.12 * (i % 2 ? 1 : -1));
      T.quad('chirp', q, ctx.C.right, ctx.C.up, 0.14, [0.75, 0.93, 0.62], 1.2, k);
    });
    // the giant foot taps, impatient (the user is waiting)
    if (t > E.taps[0] - 0.4 && t < E.taps[2] + 0.55) {
      var dn = m.eo((t - (E.taps[0] - 0.4)) / 0.28), upf = m.ei((t - (E.taps[2] + 0.18)) / 0.35);
      var fp = at(S.mine, 0.95, -1.85, 0.0);
      fp[1] += 3.8 * (1 - dn) + 4 * upf;
      var tap = 0;
      E.taps.forEach(function (tt) { tap = Math.max(tap, m.pulse(tt - 0.12, tt - 0.05, tt - 0.05, tt, t) * 1.0 + (t >= tt - 0.12 && t < tt ? 0 : 0)); });
      var raise = 0;
      E.taps.forEach(function (tt) { if (t > tt - 0.14 && t < tt) raise = Math.max(raise, Math.sin((t - (tt - 0.14)) / 0.14 * Math.PI)); });
      var fyaw = yawDir(V.mul(S.mine.tw, 1)) - 0.35;
      P.foot(B, M.mul(M.mul(M.trans(fp[0], fp[1], fp[2]), M.rotY(fyaw)), M.scale(0.95, 0.95, 0.95)), 0.35 * raise);
      E.taps.forEach(function (tt, i) { if (t > tt) P.dust(B, V.mad(fp, [Math.sin(fyaw), 0, Math.cos(fyaw)], 1.6), t - tt, 0.45, 6, 140 + i); });
    }
  }

  /* ================================================================ BEAT 7: clones */
  var B7 = {};
  B7.crate = at(S.clones, 0.55, -0.05);
  B7.home = at(S.clones, 0.15, 1.35);
  B7.spots = (function () {
    // arcs behind the crate (outward), facing it; the last wave stands on the shoulders of the first ones
    var out = [], ca = 0.55, cb = -0.05, D = Math.PI / 180;
    function sp(phi, R) { return { a: ca + Math.cos(phi * D) * R, b: cb + Math.sin(phi * D) * R }; }
    var L = [sp(0, 1.3), sp(-52, 1.3), sp(52, 1.3), sp(-26, 2.25), sp(26, 2.25), sp(-80, 1.95), sp(80, 1.95),
      sp(0, 3.0), sp(-48, 3.05), sp(48, 3.05), null, null, null, null];
    L[10] = { on: 0 }; L[11] = { on: 1 }; L[12] = { on: 2 }; L[13] = { on: 4 };
    L.forEach(function (q, i) { q.seed = i; out.push(q); });
    return out;
  })();
  B7.cloneT = (function () { var o = []; E.cloneWaves.forEach(function (w) { w.forEach(function (tt) { o.push(tt); }); }); return o; })();
  B7.popped = [13, 10, 8, 12, 7, 11, 9];      // the outer wave turns into soap bubbles (in this order)
  // where the seven survivors end up: a little crowd on the rim beside the end-stop peg
  B7.final = {};
  [[0, 163, 13.7], [1, 166.5, 13.75], [2, 160, 13.5], [3, 164.5, 12.55], [4, 169.6, 13.65], [5, 168, 12.6], [6, 161.5, 12.45]].forEach(function (q) { B7.final[q[0]] = W.pol(q[1], q[2], 0); });
  function clonePose(i, t) {
    var sp = B7.spots[i], t0 = B7.cloneT[i];
    var target = sp.on != null ? null : at(S.clones, sp.a, sp.b);
    var base0 = sp.on != null ? V.add(at(S.clones, B7.spots[sp.on].a, B7.spots[sp.on].b), [0, HERO.H * 0.8 - 0.05, 0]) : target;
    var u = m.sat((t - t0) / 0.2), from = V.add(B7.home, [0, 0.25, 0]);
    var p = V.lerp(from, base0, m.eo(u)); p[1] += Math.sin(u * Math.PI) * 0.6;
    var Pz = base(p, yawToward(p, B7.crate) + (sp.on != null ? 0.6 : 0), t + i * 0.37);
    Pz.scale = 0.8;
    Pz.sq += 0.3 * Math.exp(-(t - t0) * 9) * Math.cos((t - t0) * 25) * (t > t0 ? 1 : 0);
    Pz.eyes.shape = 'squint'; Pz.brow = 0.5;
    lookAt(Pz, V.add(B7.crate, [0, 0.25, 0]));
    Pz.arms[1] = { el: 0.45 + 0.08 * Math.sin(t * 3 + i), az: 1.15, len: 1.05 };
    Pz.lean = 0.18 + 0.05 * Math.sin(t * 2 + i);
    var home = B7.final[i];
    if (home && t > 25.95) {
      var t0w = 25.95 + (i % 4) * 0.09, t1w = t0w + 0.95;
      var u = m.sat((t - t0w) / (t1w - t0w)), from = p.slice(), to = groundAt(home);
      Pz.p = V.lerp(from, to, m.eio(u));
      if (u > 0 && u < 1) { Pz.p[1] += Math.abs(Math.sin(u * Math.PI * 5)) * 0.18; Pz.yaw = yawToward(from, to); Pz.lean = 0.12; }
      else if (u >= 1) { Pz.yaw = yawToward(to, [0, 0, 26]); Pz.lean = 0; Pz.arms[1] = { el: -0.5, az: 0.15, len: 1 }; Pz.eyes.shape = 'open'; Pz.brow = 0; }
    }
    if (t > 36.4) {
      // the survivors wave at the camera in the final shot
      var cam = FG.cameraAt(t).eye; Pz.yaw = angLerp(Pz.yaw, yawToward(Pz.p, cam), m.ss(36.4, 36.9, t));
      Pz.eyes.shape = 'happy'; Pz.brow = 0; Pz.lean = 0;
      Pz.arms[1] = { el: 0.85 + 0.3 * Math.sin(t * 9 + i * 1.3), az: 0.3, len: 1.8 }; Pz.mouth = { shape: 'beam', amt: 1 };
    }
    return Pz;
  }
  function buildClones(ctx) {
    var t = ctx.t, B = ctx.B;
    for (var i = 0; i < B7.spots.length; i++) {
      var t0 = B7.cloneT[i]; if (t < t0) continue;
      var pi = B7.popped.indexOf(i), popT = pi >= 0 ? E.bubblePops[pi] : 1e9;
      if (t > popT + 0.25) continue;
      var Pz = clonePose(i, t);
      if (t > popT - 0.25) {
        // turns into a soap bubble and pops
        var u = m.sat((t - (popT - 0.25)) / 0.25);
        var bp = V.add(Pz.p, [0, 0.6 + u * 0.3, 0]);
        if (t < popT) {
          if (u < 0.5) { Pz.scale = 0.8 * (1 - u * 1.4); FG.buildHero(B, Pz); }
          B.push(M.trans(bp[0], bp[1], bp[2]));
          B.ico(1, 0.42 * m.ss(0.1, 0.6, u) * (1 + 0.15 * u), null, 0.55, 0, 0.0, 600 + i, function (k, n) { var hue = (n[0] * 0.5 + 0.5); return FG.col.mix(FG.col.mix(C.bubble, C.lilacHi, hue), C.light, Math.max(0, n[1]) * 0.4); });
          B.pop();
          ctx.G.halo(bp, 0.5, [0.05, 0.06, 0.08], ctx.C);
        } else {
          var d = (t - popT) / 0.25;
          for (var k = 0; k < 7; k++) {
            var a = k / 7 * m.TAU, q = V.add(bp, [Math.cos(a) * 0.5 * (0.4 + d), Math.sin(a * 1.3) * 0.3 * d - d * d * 0.5, Math.sin(a) * 0.5 * (0.4 + d)]);
            B.push(M.trans(q[0], q[1], q[2])); B.ico(0, 0.045 * (1 - d), C.bubble, 0.6, 0, 0, 610 + k); B.pop();
          }
        }
        continue;
      }
      var h = FG.buildHero(B, Pz);
      P.magnifier(B, M.mul(M.trans(h.handR[0], h.handR[1], h.handR[2]), M.mul(M.rotY(Pz.yaw), M.rotX(t > 36.4 ? 0 : -0.5))));
      if (t - t0 < 0.3) P.dust(B, Pz.p, t - t0, 0.5, 5, 700 + i, C.light);
    }
  }
  function heroB7(t) {
    var camP = FG.cameraAt(t).eye, top = W.TOPHOLE.hole;
    var Pz = base(B7.home, yawToward(B7.home, B7.crate), t);
    if (t < E.burst) { Pz.p = [top[0], top[1] - 3, top[2]]; return Pz; }
    if (t < E.plop + 0.1) {
      // bursts out of the hole on the cliff top, carrying its work
      var H = FG.hopAt(t, E.burst, E.burst + 0.3, 0.9), u = m.sat((t - E.burst) / 0.3);
      Pz.p = V.lerp([top[0], top[1] - 1.0, top[2]], B7.home, u); Pz.p[1] += H.y + (u < 0.3 ? 0 : 0);
      Pz.sq += H.sq; Pz.eyes.shape = 'happy'; Pz.mouth = { shape: 'beam', amt: 1 };
      Pz.arms[0] = { el: 0.5, az: 1.3, len: 1 }; Pz.arms[1] = { el: 0.5, az: 1.3, len: 1 };
      Pz.yaw = yawToward(B7.home, camP) - 0.3;
      return Pz;
    }
    // spawns clones: each wave it squashes and a copy pops out of it
    Pz.yaw = tq(Pz, yawToward(B7.home, B7.crate), camP, 0.5);
    Pz.eyes.shape = 'open'; lookAt(Pz, V.add(B7.crate, [0, 0.3, 0]));
    B7.cloneT.forEach(function (ct) { var k = m.pulse(ct - 0.06, ct - 0.02, ct, ct + 0.1, t); Pz.sq += 0.22 * k; Pz.arms[0].el = Math.max(Pz.arms[0].el, -0.5 + 1.2 * k); Pz.arms[1].el = Math.max(Pz.arms[1].el, -0.5 + 1.2 * k); });
    Pz.mouth = { shape: 'smile', amt: 0.8 };
    if (t > E.kaching[2]) { Pz.mouth = { shape: 'beam', amt: 1 }; Pz.eyes.shape = 'happy'; }
    if (t > E.bubblePops[0] - 0.3) {
      // cost explained: watches half of them pop, then nods
      Pz.eyes.shape = 'wide'; Pz.mouth = { shape: 'o', amt: 0.6 }; lookAt(Pz, at(S.clones, 1.0, 0.2, 0.9));
      if (t > E.bubblePops[6] + 0.1) { Pz.eyes.shape = 'open'; Pz.mouth = { shape: 'smile', amt: 0.7 }; lookAt(Pz, camP); var nd = m.pulse(25.75, 25.85, 25.95, 26.05, t); Pz.lean = 0.15 * nd; }
    }
    if (t > 26.15) {
      var dest = at(S.notes, -0.1, 0.1);
      var wd = walk(Pz, t, [[26.15, B7.home], [26.95, dest]], 3.4);
      if (wd) Pz.yaw = tq(Pz, yawDir(wd), camP, 0.6); else Pz.yaw = yawToward(dest, camP) - 0.25;
      Pz.eyes.shape = 'open'; Pz.mouth = { shape: 'smile', amt: 0.6 };
    }
    return Pz;
  }
  function buildB7(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T, top = W.TOPHOLE.hole;
    var hP = heroB7(t), h = null;
    if (t >= E.burst) { h = FG.buildHero(B, hP); ctx.anchors.hero = V.add(h.top, [0, 0.3, 0]); }
    if (t > E.burst) P.dust(B, top, t - E.burst, 1.0, 10, 160);
    // the crate (its work): carried out, then set down
    if (t >= E.burst) {
      var cp = t < E.plop ? V.add(V.lerp(h.handL, h.handR, 0.5), [0, -0.42, 0.0]) : B7.crate;
      var sq = t > E.plop ? 0.15 * Math.exp(-(t - E.plop) * 10) : 0;
      var crM = M.mul(M.mul(M.trans(cp[0], cp[1], cp[2]), M.rotY(yawToward(cp, FG.cameraAt(t).eye) - 0.2)), M.scale(1 + sq, 1 - sq, 1 + sq));
      P.crate(B, crM); T.quadM('braces', crM, [0, 0.22, 0.27], 0.26, CREAM_T, 1.1);
    }
    return { hero: h, pose: hP };
  }
  function buildRegister(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var appear = m.spring(t - (E.kaching[0] - 0.25), 2.5, 0.4);
    if (t < E.kaching[0] - 0.25) return;
    if (t > 27.6) return;
    var rp = at(S.clones, 3.4, 2.3, 1.85 + 0.12 * Math.sin(t * 1.5));
    rp[1] += 6 * (1 - Math.min(1, appear)) + 8 * m.ei((t - 26.3) / 1.2);
    var drawer = 0, id = 'reg0', n = 0;
    E.kaching.forEach(function (k, i) { if (t >= k) { n = i + 1; drawer = Math.max(drawer, Math.exp(-(t - k) * 6)); } });
    id = 'reg' + n;
    if (t > E.bubblePops[3]) id = 'reg3';
    var cam = FG.cameraAt(t);
    var yw = yawToward(rp, cam.eye) - 0.25;
    var bob = n > 0 ? 0.05 * Math.exp(-(t - E.kaching[n - 1]) * 8) : 0;
    P.register(B, T, M.mul(M.mul(M.trans(rp[0], rp[1] + bob, rp[2]), M.rotY(yw)), M.mul(M.rotX(0.12), M.scale(0.9, 0.9, 0.9))), Math.min(1, drawer), id, 1.0);
    ctx.G.halo(V.add(rp, [0, 0.3, 0]), 2.2, [0.12, 0.09, 0.02], ctx.C);
    // "$" and coins spray out on each ka-ching
    E.kaching.forEach(function (k, i) {
      if (t < k || t > k + 0.7) return;
      var d = (t - k) / 0.7;
      for (var j = 0; j < 4; j++) {
        var a = (j / 4 - 0.4) * 1.6 + i;
        var q = V.add(rp, [Math.cos(a) * d * 1.4, 0.4 + d * 1.1 - d * d * 1.2, Math.sin(a) * d * 0.6]);
        T.quad('dollar', q, cam.right || ctx.C.right, ctx.C.up, 0.32, C.goldHi, 1.4, 1 - m.ss(0.6, 1, d));
      }
    });
  }

  /* ================================================================ BEAT 8: sticky notes */
  var B8 = {};
  B8.spot = at(S.notes, -0.1, 0.1);
  // where notes stick on the body (body-local: x, y on the front face unless side), and their text
  B8.stuck = [
    { x: -0.42, y: -0.18, f: 'front', id: 'n0', r: 0.18 }, { x: 0.43, y: -0.2, f: 'front', id: 'n1', r: -0.15 },
    { x: 0.0, y: -0.27, f: 'front', id: 'n3', r: 0.04, big: 1.25 }, { x: -0.05, y: 0.42, f: 'top', id: 'n2', r: 0.3 },
    { x: 0.55, y: 0.3, f: 'front', id: 'n4', r: 0.35 }, { x: -0.58, y: 0.33, f: 'front', id: 'n5', r: -0.3 },
    { x: 0.0, y: 0.05, f: 'side+', id: 'n6', r: 0.1 }, { x: 0.0, y: 0.05, f: 'side-', id: 'n7', r: -0.1 },
    { x: 0.35, y: 0.4, f: 'top', id: 'n8', r: -0.5 }, { x: -0.4, y: 0.38, f: 'top', id: 'n9', r: 0.7 },
    { x: 0.62, y: 0.2, f: 'side+', id: null, r: 0.4 },
    { x: -0.62, y: -0.05, f: 'front', id: null, r: 0.5 }, { x: 0.62, y: -0.02, f: 'front', id: null, r: -0.45 }, { x: 0.0, y: -0.25, f: 'side-', id: null, r: 0.3 },
    { x: 0.0, y: -0.2, f: 'side+', id: null, r: -0.3 }, { x: 0.0, y: 0.15, f: 'top', id: null, r: 1.2 }, { x: -0.3, y: 0.42, f: 'front', id: null, r: -0.25 },
    { x: 0.32, y: 0.43, f: 'front', id: null, r: 0.2 }, { x: 0.0, y: 0.3, f: 'top', id: null, r: -1.0 }
  ];
  function noteMatrix(Bm, s, peel, i) {
    var M0;
    if (s.f === 'front') M0 = M.mul(Bm, M.mul(M.trans(s.x, s.y, HERO.BD + 0.012 + i * 0.002), M.rotZ(s.r)));
    else if (s.f === 'top') M0 = M.mul(Bm, M.mul(M.mul(M.trans(s.x, HERO.BH + 0.012 + i * 0.002, s.y - 0.38), M.rotX(-Math.PI / 2)), M.rotZ(s.r)));
    else { var sd = s.f === 'side+' ? 1 : -1; M0 = M.mul(Bm, M.mul(M.mul(M.trans(sd * (HERO.BW + 0.012), s.y, s.x), M.rotY(sd * Math.PI / 2)), M.rotZ(s.r))); }
    if (peel > 0) {
      var w = M.xf(M0, [0, 0, 0]);
      var d = [2.5 * peel + 0.6 * peel * peel, 1.2 * peel + 0.4 * Math.sin(peel * 6 + i), -0.8 * peel];
      M0 = M.mul(M.trans(d[0] * 1.6, d[1], d[2]), M.mul(M0, M.mul(M.rotX(peel * (3 + i)), M.rotZ(peel * (2 + i % 3)))));
    }
    return M0;
  }
  function heroB8(t) {
    var camP = FG.cameraAt(t).eye;
    if (t < 26.95) return heroB7(t);
    var Pz = base(B8.spot, yawToward(B8.spot, camP) - 0.3, t);
    if (t < 27.25) Pz.yaw = angLerp(heroB7(26.94).yaw, Pz.yaw, m.ss(26.95, 27.22, t));
    var n = 0; E.slaps.forEach(function (st) { if (t > st) n++; });
    var stiff = Math.min(1, n / 10);
    Pz.sq *= 1 - stiff;
    lookAt(Pz, V.add(Pz.p, [0, 3, 0])); Pz.eyes.shape = 'open';
    if (t < E.slaps[0]) lookAt(Pz, V.add(Pz.p, [0.3, 3, 0]));
    E.slaps.forEach(function (st, i) { if (t > st) { var k = Math.exp(-(t - st) * 12); Pz.sq += 0.1 * k * (1 - stiff * 0.6); Pz.tilt += 0.08 * k * (i % 2 ? 1 : -1); } });
    if (n > 3) { Pz.eyes.shape = 'wide'; Pz.mouth = { shape: 'none', amt: 0 }; lookAt(Pz, camP); }
    Pz.arms[0].el = m.lerp(-0.55, -0.85, stiff); Pz.arms[1].el = m.lerp(-0.55, -0.85, stiff);
    Pz.eyes.open = n > 5 && t < E.relief ? 1 : Pz.eyes.open;                       // mummified: it can't blink
    if (t > E.paw - 0.05 && t < E.gust + 0.2) {
      var pw = m.ss(E.paw - 0.05, E.paw + 0.35, t);
      Pz.arms[0] = { el: m.lerp(-0.85, 1.25, pw), az: 0.3, len: 1.0 };
      Pz.arms[0].el += 0.05 * Math.sin(t * 25) * pw;                                 // a tiny trembling paw
    }
    if (t > E.gust) {
      var g = m.ss(E.gust, E.gust + 0.12, t), gb = Math.exp(-(t - E.gust) * 4);
      Pz.lean = -0.2 * gb; Pz.tilt = -0.25 * gb; Pz.eyes.shape = 'squint';
      if (t > E.cleanNote) { Pz.eyes.shape = 'open'; Pz.sq += 0.12 * Math.exp(-(t - E.cleanNote) * 10); }
      if (t > E.relief) {
        // relief: blinks, blinks, blinks; a happy wiggle
        var rb = t - E.relief;
        Pz.eyes.open = 1 - 0.95 * (m.pulse(0.0, 0.03, 0.06, 0.09, rb) + m.pulse(0.14, 0.17, 0.2, 0.23, rb) + m.pulse(0.28, 0.31, 0.34, 0.37, rb));
        Pz.eyes.shape = rb > 0.42 ? 'happy' : 'open'; Pz.mouth = { shape: 'smile', amt: m.ss(0.1, 0.3, rb) };
        Pz.sq += 0.06 * Math.sin(rb * 22) * Math.exp(-rb * 3);
      }
    }
    if (t > 30.62) {
      var dest = at(S.scroll, -0.2, 0.2);
      var wd = walk(Pz, t, [[30.62, B8.spot], [31.12, dest]], 3.8);
      if (wd) Pz.yaw = tq(Pz, yawDir(wd), camP, 0.4);
      Pz.eyes.shape = 'open'; Pz.mouth = { shape: 'smile', amt: 0.7 };
    }
    return Pz;
  }
  function buildB8(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var hP = heroB8(t), h = FG.buildHero(B, hP);
    ctx.anchors.hero = V.add(h.top, [0, 0.4, 0]);
    // notes stuck to it, peeled away by the gust
    E.slaps.forEach(function (st, i) {
      if (t < st - 0.18) return;
      var s = B8.stuck[i], peel = t > E.gust + i * 0.03 ? m.sat((t - E.gust - i * 0.03) / 0.7) : 0;
      if (peel >= 1) return;
      var Mn;
      if (t < st) {
        // flying in
        var u = (t - (st - 0.18)) / 0.18, M1 = noteMatrix(h.bm, s, 0, i), w1 = M.xf(M1, [0, 0, 0]);
        var w0 = V.add(w1, [0.9 * (i % 2 ? 1 : -1), 1.4, 0.6]), wp = V.lerp(w0, w1, u);
        Mn = M.mul(M.trans(wp[0] - w1[0], wp[1] - w1[1], wp[2] - w1[2]), M.mul(M1, M.rotZ((1 - u) * 3)));
      } else Mn = noteMatrix(h.bm, s, peel, i);
      var sc = s.big || (s.id ? 1.0 : 0.95);
      if (s.wide) Mn = M.mul(Mn, M.scale(2.6, 0.55, 1)); else Mn = M.mul(Mn, M.scale(sc, sc, sc));
      var col = (i % 4 === 3) ? C.noteL : C.note;
      if (s.wide) col = C.note;
      P.note(B, Mn, col, 0.02);
      if (s.id) T.quadM(s.id, Mn, [0, -0.02, 0.006], 0.25, FG.col.srgb(0x2a1b17), 1.0);
    });
    // the one clean note
    if (t > E.cleanNote - 0.15) {
      var u = m.sat((t - (E.cleanNote - 0.15)) / 0.15), Mf = M.mul(h.bm, M.mul(M.trans(0.0, -0.12, HERO.BD + 0.03), M.rotZ(-0.04)));
      var w1 = M.xf(Mf, [0, 0, 0]), w0 = V.add(w1, [-1.5, 1.0, 0.4]), wp = V.lerp(w0, w1, m.eo(u));
      var Mc = M.mul(M.trans(wp[0] - w1[0], wp[1] - w1[1], wp[2] - w1[2]), M.mul(Mf, M.mul(M.rotZ((1 - u) * 2), M.scale(1.65, 1.3, 1))));
      if (t > 31.15) Mc = M.mul(Mc, M.scale(1, 1, 1));
      P.note(B, Mc, C.paper, 0.0);
      T.quadM('clean', Mc, [0, -0.01, 0.006], 0.26, FG.col.srgb(0x2a1b17), 1.0);
    }
    return { hero: h, pose: hP };
  }
  // the snow of sticky notes (falls 26.45 .. 30.0, in front of the camera)
  var SNOW = (function () { var r = m.mulberry(3131), o = []; for (var i = 0; i < 90; i++) o.push({ a: (r() - 0.5) * 7, b: (r() - 0.5) * 6, h0: 1.6 + r() * 3.6, sp: 0.55 + r() * 0.5, ph: r() * 6.28, t0: r() * 1.8, col: r() < 0.2 ? 1 : 0, s: 0.7 + r() * 0.5 }); return o; })();
  function buildSnow(ctx) {
    var t = ctx.t, B = ctx.B;
    if (t < E.snow || t > 31.5) return;
    var fade = 1 - m.ss(29.8, 30.4, t);
    SNOW.forEach(function (n, i) {
      var tt = t - E.snow - n.t0 * 0.7; if (tt < 0) return;
      var y = n.h0 - tt * n.sp; if (y < -0.2) return;
      var base0 = at(S.notes, n.a * 0.8 - 1.0, n.b, 0);
      var gust = t > E.gust ? (t - E.gust) * (t - E.gust) * 6 : 0;
      var p = [base0[0] + Math.sin(tt * 2 + n.ph) * 0.3 + gust * 1.5, base0[1] + y + 0.1, base0[2] + Math.cos(tt * 1.7 + n.ph) * 0.3 + gust * 0.8];
      var k = n.s * Math.min(1, fade + (y > 0.5 ? 0 : 1) * 0) * 0.9;
      if (k < 0.05 || V.dist(p, ctx.cam.eye) < 2.2) return;
      B.push(M.mul(M.mul(M.trans(p[0], p[1], p[2]), M.rotY(tt * 2 + n.ph)), M.mul(M.rotX(Math.sin(tt * 3 + n.ph) * 0.9), M.scale(k, k, k))));
      P.note(B, M.ident(), n.col ? C.noteL : C.note, 0.03);
      B.pop();
    });
  }

  /* ================================================================ BEAT 9: the report */
  var B9 = {};
  B9.spot = at(S.scroll, -0.2, 0.2);
  B9.offer = at(S.scroll, -0.55, 0.15);
  function heroB9(t) {
    var camP = FG.cameraAt(t).eye;
    if (t < 31.12) return heroB8(t);
    var Pz = base(B9.spot, yawToward(B9.spot, camP), t);
    walk(Pz, t, [[31.12, B9.spot], [31.55, B9.offer]], 3.0);
    Pz.yaw = angLerp(heroB8(31.11).yaw, yawToward(Pz.p, camP), m.ss(31.12, 31.35, t));
    // holds the scroll out toward the camera, proud
    var off = m.ss(E.offer, E.offer + 0.2, t);
    Pz.arms[0] = { el: m.lerp(-0.5, 0.35, off), az: m.lerp(0.15, 1.35, off), len: 1.1 }; Pz.arms[1] = { el: m.lerp(-0.5, 0.35, off), az: m.lerp(0.15, 1.35, off), len: 1.1 };
    Pz.eyes.shape = 'happy'; Pz.mouth = { shape: 'beam', amt: off }; Pz.lean = 0.1 * off;
    if (t > E.river) { Pz.eyes.shape = 'open'; lookAt(Pz, camP); Pz.mouth = { shape: 'smile', amt: 0.9 }; }
    if (t > E.collapse) {
      // rewinds the report, then holds up one clean card
      Pz.eyes.shape = 'squint'; Pz.mouth = { shape: 'flat', amt: 0.7 };
      if (t > E.card) {
        Pz.eyes.shape = 'happy'; Pz.mouth = { shape: 'beam', amt: 1 };
        var up = m.ss(E.card, E.card + 0.15, t);
        Pz.arms[0] = { el: m.lerp(0.35, 0.95, up), az: 1.2, len: 1.15 }; Pz.arms[1] = { el: m.lerp(0.35, 0.95, up), az: 1.2, len: 1.15 };
        Pz.sq += 0.12 * Math.exp(-(t - E.card) * 8) * (t > E.card ? 1 : 0);
      }
    }
    if (t > E.hops[0] - 0.25) {
      // three hops up onto the hub, the top of the dial
      var P0 = B9.offer, P3 = [PEG[0], PEG[1] + W.PEG_H, PEG[2]];
      var dir = V.norm([P3[0] - P0[0], 0, P3[2] - P0[2]]);
      var p1 = groundAt(W.pol(141, 11.2, 0)), p2 = groundAt(W.pol(170, 11.0, 0));
      var y1 = yawToward(P0, p1), y2 = yawToward(p1, p2), y3 = yawToward(p2, P3);
      var yh = angLerp(angLerp(y1, y2, m.ss(E.hops[1] - 0.16, E.hops[1], t)), y3, m.ss(E.hops[2] - 0.16, E.hops[2], t));
      Pz.yaw = angLerp(Pz.yaw, tq(Pz, yh, camP, 0.3), m.ss(E.hops[0] - 0.25, E.hops[0] - 0.05, t));
      Pz.arms[0] = { el: -0.3, az: 0.2, len: 1 }; Pz.arms[1] = { el: -0.3, az: 0.2, len: 1 };
      Pz.eyes.shape = 'open'; Pz.mouth = { shape: 'smile', amt: 0.8 };
      if (t < E.hops[1] - 0.12) hop(Pz, t, E.hops[0], E.hops[0] + 0.38, 0.75, P0, p1);
      else if (t < E.hops[2] - 0.12) hop(Pz, t, E.hops[1], E.hops[1] + 0.38, 0.75, p1, p2);
      else hop(Pz, t, E.hops[2], E.landTop, 1.3, p2, P3);
    }
    return Pz;
  }
  // the river: a strip of paper from the scroll toward (and past) the camera
  B9.riverPath = function () {
    var pts = [], s0 = V.add(B9.offer, [0, 0, 0]), F = S.scroll;
    for (var i = 0; i <= 14; i++) {
      var u = i / 14, a = -0.85 - u * 9.5, b = 0.15 + Math.sin(u * 5.5) * 0.9 * u;
      var p = at(F, a, b, 0.03);
      pts.push(p);
    }
    return pts;
  };
  function buildB9(ctx) {
    var t = ctx.t, B = ctx.B, T = ctx.T;
    var hP = heroB9(t), h = FG.buildHero(B, hP);
    ctx.anchors.hero = V.add(h.top, [0, 0.3, 0]);
    var hand = V.lerp(h.handL, h.handR, 0.5), cam = FG.cameraAt(t);
    var rollYaw = yawToward(hand, cam.eye);
    // the scroll appears in its paws, then unrolls into a river of jargon
    var ext = t < E.unroll ? 0 : t < E.collapse ? m.eo((t - E.unroll) / 0.35) : 1 - m.ei((t - E.collapse) / 0.3);
    if (t > E.offer - 0.02 && t < E.card) {
      var k = m.spring(t - E.offer, 4, 0.4);
      var rp = V.add(hand, [0, 0.04, 0]);
      P.scrollRoll(B, M.mul(M.mul(M.trans(rp[0], rp[1], rp[2]), M.rotY(rollYaw)), M.mul(M.rotX(t * (ext > 0 && ext < 1 ? 30 : 0)), M.scale(k, k * (1 - 0.3 * ext), k * (1 - 0.3 * ext)))), 0.75, 0.11);
    }
    if (ext > 0.001) {
      var pts = B9.riverPath(), n = pts.length, L = (n - 1) * ext;
      var start = V.add(hand, [0, -0.05, 0]);
      var half = 0.85;
      var prevL = null, prevR = null;
      for (var i = 0; i < n; i++) {
        var fi = Math.min(i, L), i0 = Math.floor(fi), fu = fi - i0;
        var p = i === 0 ? start : V.lerp(pts[Math.min(i0, n - 1)], pts[Math.min(i0 + 1, n - 1)], fu);
        if (i === 1) p = V.lerp(start, p, 0.6);
        var nx = pts[Math.min(i + 1, n - 1)], d = V.norm(V.sub(nx, pts[Math.max(i - 1, 0)])), side = V.norm(V.cross([0, 1, 0], d));
        var wave = Math.sin(t * 7 - i * 0.9) * 0.06 * Math.min(1, i / 2);
        var w = half * Math.min(1, 0.4 + i * 0.3);
        var Lp = V.add(V.mad(p, side, w), [0, wave, 0]), Rp = V.add(V.mad(p, side, -w), [0, wave * 0.6, 0]);
        if (prevL) {
          B.polyW([prevL, prevR, Rp, Lp], (i % 2) ? C.paper : FG.col.mix(C.paper, C.paperD, 0.5), 0.12, 0, V.add(p, [0, -2, 0]));
          B.polyW([prevL, prevR, Rp, Lp], C.paperD, 0.0, 0, V.add(p, [0, 2, 0]));
        }
        prevL = Lp; prevR = Rp;
        if (i >= Math.ceil(L)) break;
      }
      // jargon and symbols flowing along it
      if (t > E.river - 0.1 && t < E.collapse + 0.15) {
        var flow = (t - E.river) * 0.55, aK = m.ss(E.river - 0.1, E.river + 0.1, t) * (1 - m.ss(E.collapse, E.collapse + 0.15, t));
        for (var j = 0; j < 26; j++) {
          var pos = ((((j / 26 + flow) % 1) + 1) % 1) * (n - 1) * 0.92 + 0.6, k0 = Math.max(0, Math.floor(pos)), ku = pos - k0;
          if (pos > L) continue;
          var q = V.lerp(pts[Math.min(k0, n - 1)], pts[Math.min(k0 + 1, n - 1)], ku);
          var dd = V.norm(V.sub(pts[Math.min(k0 + 1, n - 1)], pts[Math.max(k0, 0)])), sd = V.norm(V.cross([0, 1, 0], dd));
          var off = ((j * 7) % 5 - 2) * 0.2;
          q = V.add(V.mad(q, sd, off), [0, 0.04 + Math.sin(t * 7 - pos * 0.9) * 0.06, 0]);
          var id = j % 3 === 2 ? 'sym' + (j % 4) : 'j' + (j % 8);
          var r = sd, up = V.norm(V.add(V.mul(dd, -0.9), [0, 0.6, 0]));
          var hgt = id.charAt(0) === 's' ? 0.36 : 0.17;
          T.quad(id, q, r, up, hgt, id.charAt(0) === 's' ? C.violet : VIOLET_T, 1.0, aK);
        }
      }
    }
    // the clean index card
    if (t > E.card - 0.05) {
      var k2 = m.spring(t - E.card + 0.05, 3.5, 0.45) * (1 - m.ss(E.hops[0] - 0.2, E.hops[0], t));
      var cp = M.xf(h.bm, [0, -0.36, HERO.BD + 0.3]);
      P.card(B, T, M.mul(M.mul(M.trans(cp[0], cp[1], cp[2]), M.rotY(yawToward(cp, cam.eye))), M.mul(M.rotX(-0.12), M.scale(0.8, 0.8, 0.8))), 1.08, k2);
    }
    return { hero: h, pose: hP };
  }
  var VIOLET_T = FG.col.srgb(0x3b2f8f);

  /* ================================================================ BEAT 10: the top (the dial's end-stop peg) */
  var PEG = W.PEG;
  function heroB10(t) {
    var camP = FG.cameraAt(t).eye;
    if (t < E.landTop + 0.02) return heroB9(t);
    var hub = [PEG[0], PEG[1] + W.PEG_H, PEG[2]];
    var Pz = base(hub, yawToward(hub, camP), t);
    var ld = t - E.landTop;
    Pz.sq += 0.3 * Math.exp(-ld * 7) * Math.cos(ld * 18);
    var turn = m.ss(E.landTop, E.landTop + 0.5, t);
    Pz.yaw = angLerp(yawToward(B9.offer, hub), yawToward(hub, camP), turn);
    Pz.eyes.shape = 'open'; lookAt(Pz, camP); Pz.mouth = { shape: 'smile', amt: 0.9 };
    var w = m.ss(E.wave, E.wave + 0.2, t);
    if (w > 0) {
      var wv = Math.sin((t - E.wave) * 9.5) * (t < 38.75 ? 1 : 0.5 + 0.5 * Math.cos(Math.min(1, (t - 38.75) / 0.4) * Math.PI));
      Pz.arms[1] = { el: m.lerp(-0.5, 0.92 + 0.3 * wv, w), az: 0.3, len: m.lerp(1, 2.3, w) };
      if (t > 38.9) Pz.arms[1].az = 0.3 + 0.38 * Math.sin((38.75 - E.wave) * 9.5) * 0;
      Pz.mouth = { shape: 'beam', amt: w }; Pz.tilt = 0.08 * w;
    }
    // the last blink, and a final settle
    Pz.eyes.open = 1 - 0.95 * m.pulse(E.blinkEnd, E.blinkEnd + 0.04, E.blinkEnd + 0.08, E.blinkEnd + 0.13, t);
    if (t > 37.0 && (t < E.blinkEnd - 0.1 || t > E.blinkEnd + 0.2)) Pz.eyes.open = Math.max(Pz.eyes.open, 0.999);
    Pz.sq = t > 38.3 ? 0.012 * Math.sin(t * 2.6) : Pz.sq;
    return Pz;
  }
  function buildB10(ctx) {
    var t = ctx.t, B = ctx.B;
    var hP = heroB10(t), h = FG.buildHero(B, hP);
    ctx.anchors.hero = V.add(h.top, [0, 0.3, 0]);
    // the crown it won in the village is still on its head
    P.crown(B, ctx.T, M.mul(h.bm, M.mul(M.trans(0.05, HERO.BH - 0.02, -0.02), M.rotZ(0.12))), false);
    return { hero: h, pose: hP };
  }

  /* ================================================================ the frame */
  FG.heroPoseAt = function (t) {
    if (t < 6.6) return heroB12(t);
    if (t < 10.95) return heroB3(t);
    if (t < 14.05) return heroB4(t);
    if (t < 18.37) return heroB5(t);
    if (t < 22.9) return heroB6(t);
    if (t < 26.95) return heroB7(t);
    if (t < 31.12) return heroB8(t);
    if (t < E.landTop + 0.02) return heroB9(t);
    return heroB10(t);
  };
  FG.buildFrame = function (ctx) {
    var t = ctx.t, B = ctx.B, cam = ctx.cam;
    // casters first: the island's movable things and the hero
    buildHighProps(ctx);
    buildBridge(ctx);
    if (t > 6.0) buildVillage(ctx); else buildVillage(ctx);
    buildMineProps(ctx);
    buildClones(ctx);
    var res;
    if (t < 6.6) res = buildB12(ctx);
    else if (t < 10.95) res = buildB3(ctx);
    else if (t < 14.05) res = buildB4(ctx);
    else if (t < 18.37) res = buildB5(ctx);
    else if (t < 22.9) res = buildB6(ctx);
    else if (t < 26.95) res = buildB7(ctx);
    else if (t < 31.12) res = buildB8(ctx);
    else if (t < E.landTop + 0.02) res = buildB9(ctx);
    else res = buildB10(ctx);
    if (t >= 22.9 && t < 26.95) { /* hero drawn above */ }
    if (t >= 22.9) buildB7Crate(ctx);
    if (t > 14.0 && t < 14.05 + 0 && res.hero) { /* */ }
    if (t >= 18.37 && res.hero && t < 22.9) { /* crown rides along into the hole */ }
    // the crown stays on from the village to the end
    if (t >= 18.0 && res.hero && t < E.landTop + 0.02) P.crown(B, ctx.T, M.mul(res.hero.bm, M.mul(M.trans(0.05, HERO.BH - 0.02, -0.02), M.rotZ(0.12))), false);
    buildRegister(ctx);
    buildBanner(ctx);
    buildSnow(ctx);
    var nCast = B.n;
    // non-casters: the thought cloud (it would throw a heavy blot of shadow), floating labels, sky letters, clouds
    if (ctx.thoughtArgs) P.thought(B, ctx.thoughtArgs);
    // non-casters: floating labels, sky letters, clouds
    W.buildLabels(B, t, cam.eye);
    W.buildSkyLetters(B, t);
    W.buildClouds(B, t);
    var fr = FG.shotParams(t, ctx);
    fr.dynCasters = nCast;
    return fr;
  };
  function buildB7Crate(ctx) {
    var t = ctx.t;
    if (t >= 26.95 && t >= E.burst) {
      var B = ctx.B, sq = 0;
      var crM = M.mul(M.trans(B7.crate[0], B7.crate[1], B7.crate[2]), M.rotY(yawToward(B7.crate, FG.cameraAt(Math.min(t, 26.9)).eye) - 0.2));
      P.crate(B, crM); ctx.T.quadM('braces', crM, [0, 0.22, 0.27], 0.26, CREAM_T, 1.1);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
