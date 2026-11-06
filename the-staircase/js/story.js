// THE STAIRCASE - the story applied to the scene each frame: poses for every character, the ropes, the steps being
// built / standing / dissolving into blueprint, and the small effects (dust, motes, build glow, scissors, lasso).
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, CH = S.choreo, T3 = THREE, PAL = S.PAL;
  const D = S.D, N = ST.N, L = ST.L, LAP = ST.LAP, C = CH.C;
  const PI = Math.PI;

  // ---------------------------------------------------------------- small helpers
  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const heading = (s) => { const p = ST.pathXZ(s, {}); return Math.atan2(p.tx, p.tz); };
  const OUT = (() => { const p = ST.pathXZ(0.5, {}); return Math.sign(-p.tz * p.x + p.tx * p.z) || 1; })();  // onStair side that points away from the ring centre
  function rotYXZ(yaw, pitch, roll, x, y, z) {
    // Rz
    let cx = Math.cos(roll), sx = Math.sin(roll);
    let x1 = x * cx - y * sx, y1 = x * sx + y * cx, z1 = z;
    // Rx
    cx = Math.cos(pitch); sx = Math.sin(pitch);
    const y2 = y1 * cx - z1 * sx, z2 = y1 * sx + z1 * cx;
    // Ry
    cx = Math.cos(yaw); sx = Math.sin(yaw);
    return { x: x1 * cx + z2 * sx, y: y2, z: -x1 * sx + z2 * cx };
  }
  // local point (in the pelvis frame, optionally through the spine) -> helix space
  function xf(P, lx, ly, lz, spineY) {
    const sc = P.scale || 1;
    if (spineY != null) {
      const sp = P.spine || {};
      const r = rotYXZ(sp.yaw || 0, sp.pitch || 0, sp.roll || 0, lx, ly, lz);
      lx = r.x; ly = r.y + spineY; lz = r.z;
    }
    const r = rotYXZ(P.yaw || 0, P.pitch || 0, P.roll || 0, lx * sc, ly * sc, lz * sc);
    return { x: P.x + r.x, y: P.y + r.y, z: P.z + r.z };
  }
  const lerp3 = (a, b, u) => ({ x: U.lerp(a.x, b.x, u), y: U.lerp(a.y, b.y, u), z: U.lerp(a.z, b.z, u) });
  function lerpPose(A, B, w) {
    if (w <= 0) return A; if (w >= 1) return B;
    const P = Object.assign({}, B);
    for (const k of ['x', 'y', 'z']) P[k] = U.lerp(A[k], B[k], w);
    P.yaw = U.angLerp(A.yaw, B.yaw, w); P.pitch = U.lerp(A.pitch || 0, B.pitch || 0, w); P.roll = U.lerp(A.roll || 0, B.roll || 0, w);
    P.spine = { pitch: U.lerp((A.spine || {}).pitch || 0, (B.spine || {}).pitch || 0, w), yaw: U.lerp((A.spine || {}).yaw || 0, (B.spine || {}).yaw || 0, w), roll: U.lerp((A.spine || {}).roll || 0, (B.spine || {}).roll || 0, w) };
    P.head = { pitch: U.lerp((A.head || {}).pitch || 0, (B.head || {}).pitch || 0, w), yaw: U.lerp((A.head || {}).yaw || 0, (B.head || {}).yaw || 0, w), roll: U.lerp((A.head || {}).roll || 0, (B.head || {}).roll || 0, w) };
    P.hands = [0, 1].map((i) => lerp3(A.hands[i], B.hands[i], w));
    P.feet = [0, 1].map((i) => { const f = lerp3(A.feet[i], B.feet[i], w); f.yaw = U.angLerp(A.feet[i].yaw || 0, B.feet[i].yaw || 0, w); f.pitch = U.lerp(A.feet[i].pitch || 0, B.feet[i].pitch || 0, w); return f; });
    P.knee = A.knee || B.knee ? [0, 1].map((i) => lerp3((A.knee || [v3(), v3()])[i], (B.knee || [v3(), v3()])[i], w)) : null;
    P.squash = U.lerp(A.squash || 1, B.squash || 1, w);
    P.expr = Object.assign({}, A.expr || {}); for (const [k, v] of Object.entries(B.expr || {})) P.expr[k] = U.lerp((A.expr || {})[k] || 0, v, w);
    P.kf = w < 0.5 ? A.kf : B.kf; P.k = w < 0.5 ? A.k : B.k; P.kh = w < 0.5 ? A.kh : B.kh;
    return P;
  }
  // blinks: a few per loop per character, periodic
  function blink(t, seed) {
    let b = 0;
    for (let i = 0; i < 6; i++) { const tb = (i + 0.2 + 0.6 * U.hash(seed * 7.1 + i)) * D / 6; const d = Math.abs(U.wrapS(t - tb, D)); b = Math.max(b, 1 - U.smooth(0.0, 0.08, d)); }
    return b;
  }
  // a foot on step J (helix), on the left (side -1) or right (+1) of the centre line
  function stepFoot(J, side, sep) {
    const s = ST.stepSc(J), p = ST.onStair(s, side * sep, {});
    p.yaw = Math.atan2(p.tx, p.tz); p.J = J; return p;
  }
  // walking gait in step space: left foot on even steps, right on odd; returns feet + fold per foot
  function gait(u, sep, lift, out) {
    const feet = [], kf = [];
    for (let p = 0; p < 2; p++) {
      const m = u + 0.5, k = Math.floor(m), ph = m - k, side = p === 0 ? -1 : 1;
      if (U.wrap(k, 2) === p) { const f = stepFoot(k, side, sep); f.pitch = 0; feet.push(f); kf.push(Math.floor(k / N)); }
      else {
        const q = U.smooth(0.12, 0.88, ph);
        const a = stepFoot(k - 1, side, sep), b = stepFoot(k + 1, side, sep);
        const f = lerp3(a, b, q); f.y += lift * Math.sin(PI * q); f.yaw = U.angLerp(a.yaw, b.yaw, q); f.pitch = 0.45 * Math.sin(PI * q) - 0.15 * U.smooth(0.7, 1, q);
        feet.push(f); kf.push(Math.floor((q < 0.5 ? k - 1 : k + 1) / N));
      }
    }
    out.feet = feet; out.kf = kf;
    return out;
  }
  const foldS = (s) => ST.fold(s);

  // ---------------------------------------------------------------- build the cast
  function build(env, stairs) {
    const scene = env.scene;
    const M = S.chars;
    const teams = [
      { id: 0, climber: M.makePip(scene, false), mini: M.makePip(scene, true), h: [M.makeHuman(scene, 'researcher'), M.makeHuman(scene, 'suit')], glow: '#ffb070', gait: { bob: 0.055, sway: 0.05, lean: 0.1, arm: 1.0, pel: 0.5 } },
      { id: 1, climber: M.makeKip(scene, false), mini: M.makeKip(scene, true), h: [M.makeHuman(scene, 'hoodie'), M.makeHuman(scene, 'evaluator')], glow: '#7dffd8', gait: { bob: 0.022, sway: 0.025, lean: 0.17, arm: 0.65, pel: 0.58 } },
    ];
    const ropeMat = G.toon({ color: PAL.rope, rim: 0.5 });
    for (const T of teams) {
      T.rope = new S.rope.Rope(scene, 150, 0.036);
      // lasso loop around the waist (child of the climber's spine)
      T.waistLoop = new T3.Mesh(new T3.TorusGeometry(T.id === 0 ? 0.33 : 0.33, 0.036, 8, 40), T.rope.mat);
      T.waistLoop.rotation.x = PI / 2; T.waistLoop.position.set(0, T.id === 0 ? 0.08 : 0.06, 0); T.waistLoop.scale.set(1, T.id === 0 ? 0.88 : 0.72, 1);
      G.reg(T.waistLoop, { line: 0.75 }); T.climber.spine.add(T.waistLoop);
      // the flying lasso loop and the coil in the thrower's hand
      T.lasso = new T3.Mesh(new T3.TorusGeometry(0.24, 0.04, 8, 36), T.rope.mat); G.reg(T.lasso, { line: 0.75 }); scene.add(T.lasso);
      T.coil = new T3.Group();
      for (let k = 0; k < 3; k++) { const m = new T3.Mesh(new T3.TorusGeometry(0.13 + k * 0.012, 0.035, 8, 28), T.rope.mat); m.rotation.set(0.3 * k, 0.5 * k, 0); G.reg(m, { line: 0.6 }); T.coil.add(m); }
      scene.add(T.coil);
      // scissors (mini-me)
      T.scissors = makeScissors(); scene.add(T.scissors.group);
      // build glow at the mini-me's hand
      T.glowBall = new T3.Mesh(new T3.SphereGeometry(0.07, 16, 12), new T3.MeshBasicMaterial({ color: new T3.Color(T.glow).multiplyScalar(3) }));
      G.reg(T.glowBall, { line: 0, cast: false }); scene.add(T.glowBall);
      // dust puffs and motes
      const puffMat = G.toon({ color: '#fbf1e2', rim: 0.2, flat: 0.55 });
      T.puffs = []; for (let k = 0; k < 30; k++) { const m = new T3.Mesh(new T3.SphereGeometry(0.16, 14, 10), puffMat); G.reg(m, { line: 0, cast: false }); m.visible = false; scene.add(m); T.puffs.push(m); }
      // the snip: a little star-burst of light where the blades meet
      T.spark = new T3.Group(); for (let k = 0; k < 8; k++) { const r = new T3.Mesh(new T3.BoxGeometry(0.035, 0.035, 0.42), new T3.MeshBasicMaterial({ color: new T3.Color('#fff2c4').multiplyScalar(3.2) })); r.position.z = 0.3; const p = new T3.Group(); p.rotation.set((k % 2 ? 0.6 : -0.6), k / 8 * 2 * PI, 0, 'YXZ'); p.add(r); G.reg(r, { line: 0, cast: false }); T.spark.add(p); } T.spark.visible = false; scene.add(T.spark);
      T.motes = []; for (let k = 0; k < 18; k++) { const m = new T3.Mesh(new T3.BoxGeometry(0.06, 0.06, 0.06), new T3.MeshBasicMaterial({ color: new T3.Color(PAL.ghost).multiplyScalar(2.2) })); G.reg(m, { line: 0, cast: false }); m.visible = false; scene.add(m); T.motes.push(m); }
    }
    return { update: (t) => update(t, teams, stairs), teams };
  }

  function makeScissors() {
    const g = new T3.Group();
    const steel = G.toon({ color: '#d9dee8', rim: 0.8 }), handle = G.toon({ color: '#e8473f', rim: 0.5 });
    const mk = (sgn) => {
      const p = new T3.Group();
      const blade = new T3.Mesh(G.roundedBox(0.05, 0.02, 0.36, 0.01), steel); blade.position.set(0, 0, 0.17); p.add(blade);
      const ring = new T3.Mesh(new T3.TorusGeometry(0.06, 0.02, 6, 16), handle); ring.position.set(sgn * 0.04, 0, -0.09); ring.rotation.x = PI / 2; p.add(ring);
      for (const m of p.children) G.reg(m, { line: 0.6 });
      return p;
    };
    const a = mk(1), b = mk(-1); g.add(a, b);
    const pin = new T3.Mesh(new T3.CylinderGeometry(0.018, 0.018, 0.06, 8), steel); pin.rotation.x = PI / 2; G.reg(pin); g.add(pin);
    return { group: g, a, b };
  }

  // ---------------------------------------------------------------- climber
  function climberPose(T, t) {
    const team = T.id, c = CH.cOf(t, team), g = T.gait;
    const s = CH.climberS(t, team), u = ST.uOfS(s);
    const P = { scale: S.CS };
    gait(u, (team === 0 ? 0.17 : 0.15) * S.CS, (team === 0 ? 0.24 : 0.2) * S.CS, P);
    const p = ST.pathXZ(s, {});
    P.yaw = Math.atan2(p.tx, p.tz);
    // strain: taut and pulling; 0 while free
    const free = U.smooth(C.cut, C.cut + 0.08, c) * (1 - U.smooth(C.catch + 0.1, C.catch + 0.7, c));
    const strain = (1 - free) * (0.75 + 0.25 * U.smooth(2.2, 3.6, c) * (1 - U.smooth(C.cut, C.cut + 0.1, c)));
    const lurch = U.bump(c, C.cut + 0.02, C.cut + 0.35, 0.12);
    const jolt = U.bump(c, C.catch + 0.02, C.catch + 0.3, 0.1);
    const bob = g.bob * S.CS * (0.5 + 0.5 * Math.cos(2 * PI * u)) * (1 + 0.5 * free);
    const sway = g.sway * S.CS * Math.cos(PI * u);
    P.x = p.x + (-p.tz) * sway; P.z = p.z + p.tx * sway;
    P.y = ST.OY + ST.h * u + g.pel * S.CS + bob - 0.05 * strain;
    P.pitch = g.lean + 0.3 * strain + 0.4 * lurch - 0.4 * jolt + (team === 0 ? 0.04 * Math.sin(2 * PI * u) : 0);
    P.roll = -sway * 1.2;
    P.spine = { pitch: 0.08 * strain, yaw: 0.12 * Math.sin(PI * u) * g.arm, roll: 0 };
    // head: looks a little up the stairs; glances back at the snip, looks back at the lasso
    const lookBack = U.bump(c, 3.45, 3.9, 0.15) * 0.9 + U.bump(c, C.catch + 0.05, C.catch + 0.6, 0.15) * 1.1;
    const camSide = Math.sign(ST.VIEW.x * Math.cos(P.yaw) - ST.VIEW.z * Math.sin(P.yaw)) || 1;   // turn the face toward the camera
    P.head = { pitch: -0.12 - 0.1 * strain + 0.3 * lurch, yaw: camSide * lookBack * 0.95, roll: (team === 0 ? 0.08 : 0.03) * Math.sin(PI * u) };
    // arms: swing when walking, pump when straining, fly up in the lurch
    const sw = Math.sin(PI * u) * (0.18 + 0.1 * free) * g.arm;
    const hands = [];
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1, w = i === 0 ? sw : -sw;
      let lx = sd * (team === 0 ? 0.36 : 0.38), ly = 0.12 + Math.abs(w) * 0.2 + 0.08 * strain, lz = w + 0.12 * strain;
      lx = U.lerp(lx, sd * 0.42, lurch); ly = U.lerp(ly, 0.95, lurch); lz = U.lerp(lz, 0.2, lurch);
      hands.push(xf(P, lx, ly, lz, (P.scale, 0.06)));
    }
    P.hands = hands;
    const k = foldS(s); P.k = k; P.kh = [k, k];
    P.expr = { blink: blink(t, team * 3 + 1), squint: strain * 0.85 * (1 - lurch), surprise: U.bump(c, C.cut, C.cut + 0.5, 0.08), happy: free * (1 - U.bump(c, C.cut, C.cut + 0.6, 0.1)) * (team === 0 ? 1 : 0.7), look: 0 };
    P.s = s; P.u = u; P.c = c; P.strain = strain;
    return P;
  }

  // ---------------------------------------------------------------- humans
  function draggedPose(s, t, i, team, lean) {
    const P = { scale: S.HS };
    const p = ST.pathXZ(s, {}), yaw = Math.atan2(p.tx, p.tz);
    const f0 = CH.dragFootY(s + 0.36), f1 = CH.dragFootY(s + 0.27);
    const fl = ST.onStair(s + 0.36, -0.15 * S.HS, {}), fr = ST.onStair(s + 0.27, 0.15 * S.HS, {});
    fl.y = f0.y; fr.y = f1.y; fl.yaw = fr.yaw = yaw; fl.pitch = 0.38 + 0.2 * Math.sin(PI * f0.p); fr.pitch = 0.38 + 0.2 * Math.sin(PI * f1.p);
    P.feet = [fl, fr]; P.kf = [foldS(s + 0.36), foldS(s + 0.27)];
    const fy = (f0.y + f1.y) / 2;
    const hop = Math.sin(PI * f0.p) * 0.5 + Math.sin(PI * f1.p) * 0.5;
    P.x = p.x; P.z = p.z; P.y = fy + 0.4 * S.HS + 0.04 * hop;
    P.yaw = yaw; P.pitch = -lean + 0.06 * hop + 0.03 * Math.sin(t * 2 * PI * 1.5 + i * 2);
    P.roll = 0.04 * Math.sin(t * 2 * PI * 0.5 + i + team);
    P.spine = { pitch: 0.28, yaw: 0, roll: 0 };
    P.head = { pitch: -0.05, yaw: 0.05 * Math.sin(t * 2 * PI * 0.5 + i), roll: 0 };   // every oscillator completes whole cycles per loop
    const g = CH.gripDragged(s, {}), r = CH.rearGrip(s, {});
    P.hands = [{ x: g.x - p.tz * 0.03, y: g.y + 0.01, z: g.z + p.tx * 0.03 }, { x: r.x + p.tz * 0.03, y: r.y, z: r.z - p.tx * 0.03 }];
    P.kh = [foldS(s + 0.42), foldS(s + 0.1)];
    P.k = foldS(s);
    P.knee = [v3(0, 0.6, 0), v3(0, 0.6, 0)];
    P.expr = { effort: 1, blink: blink(t, 11 + team * 5 + i) };
    P.grips = [g, r];
    return P;
  }
  function sitPose(s, t, i, team, c) {
    const P = { scale: S.HS };
    const p = ST.pathXZ(s, {}), yaw = Math.atan2(p.tx, p.tz);
    const J = ST.stepAt(s), y = ST.stepY(J);
    P.x = p.x; P.z = p.z; P.y = y + 0.15 * S.HS; P.yaw = yaw; P.pitch = -0.32; P.roll = 0;
    const fl = ST.onStair(s + 0.66 * S.HS, -0.16 * S.HS, {}), fr = ST.onStair(s + 0.6 * S.HS, 0.16 * S.HS, {});
    fl.y = ST.stepY(ST.stepAt(s + 0.66 * S.HS)); fr.y = ST.stepY(ST.stepAt(s + 0.6 * S.HS)); fl.yaw = fr.yaw = yaw; fl.pitch = fr.pitch = 0.5;
    P.feet = [fl, fr]; P.kf = [foldS(s + 0.66), foldS(s + 0.6)];
    P.knee = [v3(0, 1, 0), v3(0, 1, 0)];
    const daze = Math.sin((c - C.sit) * 2 * PI * 1.6);
    P.spine = { pitch: 0.1, yaw: 0, roll: 0.05 * daze };
    P.head = { pitch: 0.05, yaw: 0.15 * daze, roll: 0.18 * daze };
    const hb = ST.onStair(s - 0.28 * S.HS, -0.3 * S.HS, {}); hb.y += 0.05;
    const hr = xf(P, -0.18, 0.18, 0.3, 0.04);
    P.hands = [hb, hr];
    P.kh = [foldS(s - 0.28), foldS(s)];
    P.k = foldS(s);
    P.expr = { blink: 0.6 + 0.4 * Math.abs(daze), surprise: 0 };
    return P;
  }
  function runPose(s, t, i, team, c) {
    const P = { scale: S.HS };
    const u = ST.uOfS(s);
    gait(u, 0.14 * S.HS, 0.28, P);
    const p = ST.pathXZ(s, {});
    P.yaw = Math.atan2(p.tx, p.tz);
    const bob = 0.06 * Math.abs(Math.cos(PI * u));
    P.x = p.x; P.z = p.z; P.y = ST.OY + ST.h * u + 0.56 * S.HS + bob;
    P.pitch = 0.3; P.roll = 0.05 * Math.cos(PI * u);
    P.spine = { pitch: 0.05, yaw: 0.15 * Math.sin(PI * u), roll: 0 };
    P.head = { pitch: -0.3, yaw: 0, roll: 0 };
    const sw = Math.sin(PI * u) * 0.3;
    P.hands = [xf(P, 0.3, 0.32 + Math.max(0, sw) * 0.3, sw + 0.1, 0.04), xf(P, -0.3, 0.32 + Math.max(0, -sw) * 0.3, -sw + 0.1, 0.04)];
    const k = foldS(s); P.k = k; P.kh = [k, k];
    P.expr = { effort: 0.5, blink: blink(t, 21 + team * 3 + i) };
    return P;
  }
  function humanPose(T, t, i, cl) {
    const team = T.id, c = CH.cOf(t, team), s = CH.humanS(t, team, i), mode = CH.humanMode(c, i);
    const d = i ? 0.12 : 0;
    const leanBase = i === 0 ? 0.62 : 0.55;
    let P;
    if (mode === 'taut') {
      const snap = U.wobble(c - CH.RETAUT[i], 3.2, 5);
      P = draggedPose(s, t, i, team, leanBase + 0.08 * snap + 0.12 * U.smooth(2.4, 3.9, c) * (c < C.cut ? 1 : 0));
      P.expr.surprise = U.bump(c, 3.55, 3.95, 0.1) * (i === 0 ? 0.8 : 0.4);
    } else if (mode === 'fall') {
      const uf = U.sat((c - C.cut - d) / (C.sit - C.cut));
      const A = draggedPose(s, t, i, team, leanBase), B = sitPose(s, t, i, team, C.sit + d);
      P = lerpPose(A, B, U.easeIn(uf));
      const arc = Math.sin(PI * uf);
      P.y += 0.14 * arc; P.pitch -= 0.5 * arc;
      P.hands = [xf(P, 0.32, 0.95, 0.05, 0.04), xf(P, -0.32, 0.92, 0.1, 0.04)].map((h, k) => lerp3(lerp3(A.hands[k], h, U.smooth(0, 0.35, uf)), B.hands[k], U.smooth(0.65, 1, uf)));
      P.feet = P.feet.map((f) => { const g = Object.assign({}, f); g.y += 0.3 * arc; return g; });
      P.expr = { surprise: 1, blink: 0 };
    } else if (mode === 'sit') {
      P = sitPose(s, t, i, team, c);
      if (T.h[i].kind === 'evaluator') {   // makes a note
        const w = U.bump(c, C.sit + d + 0.12, C.getup + d - 0.05, 0.1);
        P.hands[0] = lerp3(P.hands[0], xf(P, 0.12, 0.42, 0.34, 0.04), w);
        P.hands[1] = lerp3(P.hands[1], xf(P, -0.04 + 0.04 * Math.sin(c * 30), 0.45 + 0.03 * Math.sin(c * 23), 0.36, 0.04), w);
        P.head.pitch = U.lerp(P.head.pitch, 0.45, w); P.head.roll *= 1 - w; P.head.yaw *= 1 - w;
        P.expr.blink = U.lerp(P.expr.blink, 0, w); P.expr.effort = 0.4 * w;
      }
    } else if (mode === 'getup') {
      const w = U.smooth(C.getup + d, C.run + d, c);
      P = lerpPose(sitPose(s, t, i, team, c), runPose(s, t, i, team, c), w);
      P.squash = 1 - 0.08 * Math.sin(PI * w);
      P.expr = { blink: 0, effort: 0.3 };
    } else if (mode === 'run' || mode === 'brace') {
      const R = runPose(s, t, i, team, c);
      const Bp = draggedPose(s, t, i, team, U.lerp(-0.02, leanBase, U.smooth(C.catch, CH.RETAUT[i] + 0.1, c)));
      Bp.expr = { effort: U.smooth(C.catch, CH.RETAUT[i], c), blink: Bp.expr.blink };
      Bp.spine.pitch = U.lerp(0.05, 0.28, U.smooth(C.catch, CH.RETAUT[i], c));
      P = lerpPose(R, Bp, U.smooth(C.plant - 0.12, C.plant + 0.1, c));
      if (i === 0 && c < C.catch + 0.3) {
        // lasso: the coil in the left hand; spin overhead with the right; throw
        const spin = U.smooth(C.spin - 0.2, C.spin + 0.1, c) * (1 - U.smooth(C.throw, C.throw + 0.12, c));
        const thr = U.smooth(C.throw - 0.05, C.throw + 0.2, c);
        P.hands[0] = lerp3(P.hands[0], xf(P, 0.24, 0.42, 0.3, 0.04), U.smooth(C.run, C.run + 0.3, c) * (1 - U.smooth(C.throw + 0.1, C.catch + 0.25, c)));
        const overhead = xf(P, -0.18, 1.1, 0.08, 0.04);
        const fwd = xf(P, -0.22, 0.55, 0.6, 0.04);
        P.hands[1] = lerp3(lerp3(P.hands[1], overhead, spin), fwd, thr * (1 - U.smooth(C.throw + 0.45, C.catch + 0.25, c)));
        P.head.pitch = U.lerp(P.head.pitch, -0.35, spin);
        P.expr.effort = 0.2; P.expr.surprise = 0;
      }
    }
    // the evaluator's clipboard: tucked under the arm, or in hand while making a note
    if (T.h[i].kind === 'evaluator') {
      const w = mode === 'sit' ? U.bump(c, C.sit + d + 0.12, C.getup + d - 0.05, 0.1) : 0;
      const tuck = xf(P, 0.27, 0.32, -0.02, 0.04);
      const hold = lerp3(P.hands[0], xf(P, 0.04, 0.44, 0.38, 0.04), 0.6);
      const b = lerp3(tuck, hold, w);
      const k = P.k || 0;
      P.board = { x: b.x - k * LAP.x, y: b.y - k * LAP.y, z: b.z - k * LAP.z, ry: P.yaw + U.lerp(PI / 2, 0, w), rx: U.lerp(0.1, -1.0, w), rz: U.lerp(0.25, 0, w) };
    }
    P.mode = mode; P.c = c; P.s = s;
    return P;
  }

  // ---------------------------------------------------------------- mini-me
  function miniPose(T, t, cl) {
    const team = T.id, c = CH.cOf(t, team);
    const B = CH.buildIdx(t, team), b = Math.floor(B + 1e-9), ph = B - b;
    const P = { scale: 0.5 * S.CS };
    const spot = (J) => { const s = ST.stepS0(J) + ST.stepLen(J) * 0.7; const p = ST.onStair(s, OUT * 0.36, {}); p.s = s; return p; };
    const pel = (T.id === 0 ? 0.25 : 0.29) * S.CS;
    let pos, yaw, mode = 'build', hop = 0, air = 0;
    const inTrip = c >= C.tripStart && c < C.buildResume;
    const scState = { show: 0, open: 0 };
    let glow = 0, arm = 0;
    if (!inTrip) {
      const a = spot(b), bb = spot(b + 1);
      const q = U.smooth(0.64, 0.94, ph);
      pos = lerp3(a, bb, q); air = Math.sin(PI * q);
      pos.y += 0.42 * air;
      pos.s = U.lerp(a.s, bb.s, q);
      const hd = heading(pos.s);
      yaw = U.angLerp(hd - OUT * 0.9 * (team === 0 ? 1 : 1), hd, U.smooth(0.5, 0.7, ph) * (1 - U.smooth(0.95, 1.0, ph)));
      if (ph < 0.02) yaw = hd - OUT * 0.9;
      glow = U.bump(ph, 0.05, 0.5, 0.06); arm = U.bump(ph, 0.02, 0.58, 0.08);
      hop = air;
    } else {
      mode = 'trip';
      const front = spot(b);
      const snipPt = (tt) => { const sc = CH.climberS(tt, team) - 0.6; const p = ST.onStair(sc, OUT * 0.5, {}); p.s = sc; return p; };
      const hd = heading(front.s);
      const tAt = (cc) => t + (cc - c);
      const headTop = cl.y + 1.25 * S.CS;
      if (c < C.hopBack0) { pos = front; yaw = U.angLerp(hd - OUT * 0.9, hd + PI, U.smooth(C.tripStart, C.hopBack0, c)); }
      else if (c < C.hopBack1) {
        const q = U.smooth(C.hopBack0, C.hopBack1, c), e = snipPt(tAt(C.hopBack1));
        pos = lerp3(front, e, q); pos.s = U.lerp(front.s, e.s, q);
        const apex = Math.max(headTop + 0.6, Math.max(front.y, e.y) + 1.2);
        pos.y = U.lerp(front.y, e.y, q) + (apex - Math.max(front.y, e.y)) * 4 * q * (1 - q);
        yaw = hd + PI; air = Math.sin(PI * q);
      } else if (c < C.hopFwd0) {
        pos = snipPt(t); yaw = heading(pos.s) + PI + OUT * 0.9;
      } else if (c < C.hopFwd1) {
        const q = U.smooth(C.hopFwd0, C.hopFwd1, c), a = snipPt(tAt(C.hopFwd0));
        pos = lerp3(a, front, q); pos.s = U.lerp(a.s, front.s, q);
        const apex = Math.max(headTop + 0.6, Math.max(front.y, a.y) + 1.2);
        pos.y = U.lerp(a.y, front.y, q) + (apex - Math.max(front.y, a.y)) * 4 * q * (1 - q);
        yaw = hd; air = Math.sin(PI * q);
      } else { pos = front; yaw = U.angLerp(hd, hd - OUT * 0.9, U.smooth(C.hopFwd1, C.buildResume, c)); }
      scState.show = U.smooth(C.hopBack0 - 0.05, C.hopBack0 + 0.08, c) * (1 - U.smooth(C.hopFwd1 - 0.15, C.hopFwd1, c));
      const o1 = U.bump(c, 3.42, 3.6, 0.06), o2 = U.bump(c, 3.72, 3.92, 0.06);
      scState.open = Math.max(o1, o2);
      hop = air;
    }
    // land squash
    const landSq = !inTrip ? U.bump(ph, 0.95, 0.98, 0.03) : U.bump(c, C.hopBack1, C.hopBack1 + 0.05, 0.05) + U.bump(c, C.hopFwd1, C.hopFwd1 + 0.05, 0.05);
    P.x = pos.x; P.z = pos.z; P.y = pos.y + pel; P.yaw = yaw;
    P.pitch = 0.08 * hop - 0.1 * arm; P.roll = 0;
    P.squash = 1 - 0.18 * landSq + 0.1 * air;
    P.spine = { pitch: 0, yaw: 0, roll: 0 };
    P.head = { pitch: -0.15 + 0.2 * arm, yaw: 0, roll: 0.15 * arm * OUT };
    // feet: planted under the body (or tucked in the air)
    const fx = (sd) => { const f = xf(P, sd * 0.09 / 0.5 * 0.5 * 2, -pel / 0.5 + 0.0, 0.02, null); return f; };
    const fl = xf(P, 0.16, -pel / P.scale + 0.12 * air, 0.04 + 0.1 * air, null), fr = xf(P, -0.16, -pel / P.scale + 0.12 * air, -0.02 + 0.08 * air, null);
    if (air < 0.01) { fl.y = pos.y; fr.y = pos.y; }
    fl.yaw = fr.yaw = yaw; fl.pitch = fr.pitch = 0.3 * air;
    P.feet = [fl, fr];
    // hands: one arm reaching out to the incoming block (glowing), or up in the hop, or holding scissors
    const up = 0.95 * air;
    let hl = xf(P, 0.36, 0.15 + up, 0.12, 0.06), hr = xf(P, -0.36, 0.15 + up, 0.12, 0.06);
    if (arm > 0) { const reach = xf(P, -0.25 * OUT, 0.62, 0.42, 0.06); if (OUT > 0) hl = lerp3(hl, reach, arm); else hr = lerp3(hr, reach, arm); }
    if (scState.show > 0) { hr = lerp3(hr, xf(P, -0.1, 0.38, 0.4, 0.06), scState.show); hl = lerp3(hl, xf(P, 0.12, 0.36, 0.38, 0.06), scState.show); }
    P.hands = [hl, hr];
    const k = foldS(pos.s); P.k = k; P.kf = [k, k]; P.kh = [k, k];
    P.expr = { blink: blink(t, 40 + team), happy: (!inTrip ? U.bump(ph, 0.55, 0.85, 0.06) : 0) * 0.9, squint: scState.open * 0.5, surprise: 0 };
    P.glow = glow; P.sc = scState; P.mode = mode; P.B = B; P.ph = ph; P.pos = pos;
    return P;
  }

  // ---------------------------------------------------------------- steps: built / building / blueprint / dissolving
  function stepStates(t, teams, stairs) {
    const res = stairs.blocks.map(() => ({ solid: 1, ghost: 0, fly: 0, ph: 0, glow: 0.1, glowCol: null, team: -1 }));
    for (const T of teams) {
      const B = CH.buildIdx(t, T.id), Q = CH.ghostFront(t, T.id), b = Math.floor(B + 1e-9), ph = B - b;
      for (let j = 0; j < N; j++) {
        const J = j + N * Math.round((B + 1 - j) / N);   // the copy of step j nearest the build front
        const r = res[j];
        if (J === b + 1) { r.solid = U.smooth(0.0, 0.32, ph); r.ghost = 1 - U.smooth(0.4, 0.58, ph); r.fly = ph; r.team = T.id; r.glow = 0.4 + 3.0 * U.bump(ph, 0.5, 0.6, 0.06) + 1.2 * U.smooth(0.5, 0.6, ph); r.glowCol = T.glow; r.building = true; }
        else if (J > b + 1 && J <= Q) { r.solid = 0; r.ghost = 1; r.team = T.id; }
        else if (J > Q && J <= Q + 1 && J > b + 1) { r.solid = J - Q; r.ghost = 1 - r.solid; r.team = T.id; r.dissolving = 1 - r.solid; }
        else if (J <= b && J > b - N / 2) {
          const age = B - J;      // in steps since built
          r.glow = 0.12 + 1.6 * Math.exp(-age * 0.55) + 0.6 * Math.exp(-age * 0.12); r.glowCol = T.glow;
        }
      }
    }
    return res;
  }

  const tmpC = new T3.Color();
  function applySteps(t, teams, stairs, states) {
    const tmpOut = {};
    stairs.blocks.forEach((bl, j) => {
      const r = states[j], st = bl.st;
      bl.mat.userData.u.uSolid.value = r.solid;
      bl.mesh.visible = r.solid > 0.001;
      bl.mesh.position.copy(bl.home); bl.mesh.rotation.set(0, 0, 0); bl.mesh.scale.set(1, 1, 1);
      if (r.building) {
        const ph = r.fly, p = U.sat(ph / 0.55);
        // fly in from below and outside, ease-out-back, a little tumble, then a squash on landing
        const pc = ST.pathXZ(st.s0 + st.len / 2, tmpOut);
        const ox = -pc.tz * OUT, oz = pc.tx * OUT;
        const e = 1 - U.easeOutBack(p, 1.3);
        bl.mesh.position.x += ox * 1.7 * e; bl.mesh.position.z += oz * 1.7 * e; bl.mesh.position.y += -1.5 * e + 0.0;
        const tilt = 0.7 * e;
        bl.mesh.rotation.set(oz * tilt, 0.35 * e, -ox * tilt);
        const sq = U.bump(ph, 0.55, 0.62, 0.05);
        bl.mesh.scale.set(1 + 0.05 * sq, 1 - 0.1 * sq, 1 + 0.05 * sq);
        bl.mesh.castShadow = true;
      }
      bl.mat.userData.u.uGlow.value = r.glow;
      if (r.glowCol) bl.mat.userData.u.uGlowCol.value.set(r.glowCol); else bl.mat.userData.u.uGlowCol.value.set('#ffd27a');
      bl.ghost.visible = r.ghost > 0.003;
      bl.ghost.material.uniforms.uA.value = r.ghost;
      bl.ghost.material.uniforms.uT.value = t;
      if (r.team >= 0) bl.ghost.material.uniforms.uCol.value.set(r.team === 0 ? '#ffc58c' : PAL.ghost);
    });
  }

  // ---------------------------------------------------------------- per-frame update
  const W = new T3.Vector3();
  function update(t, teams, stairs) {
    const states = stepStates(t, teams, stairs);
    applySteps(t, teams, stairs, states);
    for (const T of teams) {
      const c = CH.cOf(t, T.id);
      // climber
      const P = climberPose(T, t);
      T.climber.apply(P);
      // waist loop: on while lassoed; springs off at the cut, drops on at the catch
      const lassoed = c < C.cut || c >= C.catch;
      const cutA = U.sat((c - C.cut) / 0.14), catchA = U.sat((c - C.catch) / 0.16);
      T.waistLoop.visible = lassoed || c < C.cut + 0.14;
      if (c >= C.cut && c < C.cut + 0.14) { T.waistLoop.scale.set(1 + 0.6 * cutA, (T.id === 0 ? 0.88 : 0.72) * (1 - cutA), 1 + 0.6 * cutA); T.waistLoop.position.y = (T.id === 0 ? 0.08 : 0.06) - 0.2 * cutA; }
      else if (c >= C.catch && c < C.catch + 0.16) { const k = 1.5 - 0.5 * U.easeOutBack(catchA); T.waistLoop.scale.set(k, (T.id === 0 ? 0.88 : 0.72) * k, k); T.waistLoop.position.y = (T.id === 0 ? 0.08 : 0.06) + 0.35 * (1 - catchA); }
      else { T.waistLoop.scale.set(1, T.id === 0 ? 0.88 : 0.72, 1); T.waistLoop.position.y = T.id === 0 ? 0.08 : 0.06; }
      T.climber.root.updateMatrixWorld(true);
      const waist = T.climber.pointOn(T.climber.spine, T.climber.waist, P, W).clone();
      // humans
      const HP = [0, 1].map((i) => humanPose(T, t, i, P));
      HP.forEach((hp, i) => T.h[i].apply(hp));
      // the mini-me
      const MP = miniPose(T, t, P);
      T.mini.apply(MP);
      applyMiniProps(T, MP, t);
      // rope
      applyRope(T, t, c, P, HP, waist);
      applyEffects(T, t, c, HP, MP, states, stairs);
    }
  }

  function applyMiniProps(T, MP, t) {
    const k = MP.k, hnd = MP.hands[OUT > 0 ? 0 : 1];
    T.glowBall.visible = MP.glow > 0.02;
    T.glowBall.position.set(hnd.x - k * LAP.x, hnd.y - k * LAP.y, hnd.z - k * LAP.z);
    T.glowBall.scale.setScalar(0.5 + 1.1 * MP.glow);
    const sc = MP.sc;
    // spark at the cut
    const c = CH.cOf(t, T.id), sa = c - C.cut;
    T.spark.visible = sa >= -0.02 && sa < 0.3;
    if (T.spark.visible) {
      const tc = t - sa, sC = CH.climberS(tc, T.id), w = CH.waistApprox(sC, T.id, {}), kk = ST.fold(sC);
      T.spark.position.set(w.x - kk * LAP.x, w.y - kk * LAP.y, w.z - kk * LAP.z);
      const e = U.sat((sa + 0.02) / 0.3);
      T.spark.scale.setScalar(Math.max(0.001, 1.6 * Math.sin(PI * Math.sqrt(e)) * (0.6 + 0.6 * e)));
      T.spark.rotation.set(0, e * 0.8, 0);
    }
    T.scissors.group.visible = sc.show > 0.01;
    if (sc.show > 0.01) {
      const h = MP.hands[1];
      T.scissors.group.position.set(h.x - k * LAP.x, h.y - k * LAP.y + 0.03, h.z - k * LAP.z);
      T.scissors.group.rotation.set(-0.3, MP.yaw, 0, 'YXZ');
      T.scissors.group.scale.setScalar(Math.max(0.001, U.easeOutBack(sc.show, 2.0)) * 1.7);
      const a = 0.05 + 0.5 * sc.open;
      T.scissors.a.rotation.y = a; T.scissors.b.rotation.y = -a;
    }
  }

  // rope anchors for this frame
  const tmp = {};
  function applyRope(T, t, c, P, HP, waist) {
    const h1 = HP[0], h2 = HP[1];
    const s1 = h1.s, s2 = h2.s, sC = P.s;
    const tailPt = (() => { const p = ST.onStair(s2 - 0.78, 0.12, {}); p.y += 0.04; p.s = s2 - 0.78; return p; })();
    const withS = (p, s) => ({ x: p.x, y: p.y, z: p.z, s });
    const g1f = withS(h1.hands[0], s1 + 0.4), g1r = withS(h1.hands[1], s1 + 0.1);
    const g2f = withS(h2.hands[0], s2 + 0.4), g2r = withS(h2.hands[1], s2 + 0.1);
    const J0 = Math.floor(ST.uOfS(Math.min(s2, s1) - 2)) - 1, J1 = Math.ceil(ST.uOfS(sC + 1)) + 1;
    let anchors, lens;
    T.lasso.visible = false; T.coil.visible = false;
    const mode = h1.mode;
    const lasso = (p, r, rx, ry, rz) => { T.lasso.visible = true; const k = ST.fold(p.s); T.lasso.position.set(p.x - k * LAP.x, p.y - k * LAP.y, p.z - k * LAP.z); T.lasso.scale.setScalar(r); T.lasso.rotation.set(rx, ry, rz, 'YXZ'); };
    const coil = (p, s, sc) => { T.coil.visible = sc > 0.01; const k = ST.fold(s); T.coil.position.set(p.x - k * LAP.x, p.y - k * LAP.y - 0.05, p.z - k * LAP.z); T.coil.scale.setScalar(Math.max(0.001, sc)); T.coil.rotation.set(0.4, h1.yaw, 0.3, 'YXZ'); };
    if (c < C.cut) {
      anchors = [withS(waist, sC - 0.3), g1f, g1r, g2f, g2r, tailPt];
      lens = [CH.ROPE1 * (1.014 + 0.006 * Math.sin(t * 2 * PI * 1.3 + T.id)), null, CH.ROPE2 * 1.02, null, 1.35];
    } else if (c < C.getup + 0.3) {
      // cut: the free end whips back and lands on the steps ahead of h1, then h1 gathers it up
      const tCut = t - (c - C.cut);
      const sCcut = CH.climberS(tCut, T.id);
      const start = CH.waistApprox(sCcut, T.id, {});
      const land = ST.onStair(s1 + 1.0, 0.18, {}); land.y += 0.045;
      const q = U.easeOut(U.sat((c - C.cut) / 0.42));
      const E = lerp3(start, land, q); E.y += 0.7 * Math.sin(PI * q) * (1 - q * 0.3);
      const pick = U.smooth(C.getup - 0.05, C.getup + 0.3, c);
      const E2 = lerp3(E, h1.hands[0], pick);
      const se = U.lerp(U.lerp(sCcut - 0.3, s1 + 1.0, q), s1 + 0.4, pick);
      anchors = [withS(E2, se), g1r, g2f, g2r, tailPt];
      lens = [CH.ROPE1 * (1 - 0.75 * pick), CH.ROPE2 * 1.05, null, 1.35];
      coil(h1.hands[0], s1, pick);
    } else if (c < C.spin) {
      anchors = [withS(h1.hands[0], s1 + 0.4), g1r, g2f, g2r, tailPt];
      lens = [0.55, CH.ROPE2 * 1.25, null, 1.35];
      coil(h1.hands[0], s1, 1);
    } else if (c < C.catch) {
      // spin overhead, then throw: the loop flies along an arc to the climber's waist
      const hand = h1.hands[1];
      const ang = (c - C.spin) * 2 * PI * 2.3;
      const yaw = h1.yaw;
      const orbit = { x: hand.x + Math.cos(ang) * 0.42, y: hand.y + 0.12 + 0.05 * Math.sin(ang), z: hand.z + Math.sin(ang) * 0.42, s: s1 + 0.3 };
      const thr = U.sat((c - C.throw) / (C.catch - C.throw));
      let E = orbit, r = 1.0;
      if (c >= C.throw) {
        const tgt = { x: waist.x, y: waist.y + 0.3, z: waist.z };
        const q = U.easeInOut(thr);
        const rel = { x: hand.x, y: hand.y + 0.15, z: hand.z };
        E = lerp3(rel, tgt, q); E.y += 1.25 * Math.sin(PI * q); E.s = U.lerp(s1 + 0.3, sC - 0.2, q);
        r = 1.0 + 0.35 * q;
        lasso(E, r, 0.25 * (1 - q), yaw, 0);
      } else lasso(orbit, 1.0, 0.25, ang, 0);
      const d = Math.hypot(E.x - g1r.x, E.y - g1r.y, E.z - g1r.z);
      anchors = [E, g1r, g2f, g2r, tailPt];
      lens = [Math.max(d * 1.04, 0.5), CH.ROPE2 * 1.2, null, 1.35];
      coil(h1.hands[0], s1, 1 - U.smooth(C.throw, C.throw + 0.5, c));
    } else {
      anchors = [withS(waist, sC - 0.3), g1f, g1r, g2f, g2r, tailPt];
      const thrum = 0.03 * Math.abs(U.wobble(c - CH.RETAUT[0], 5, 5));
      lens = [CH.ROPE1 * (1.014 + thrum + 0.006 * Math.sin(t * 2 * PI * 1.3 + T.id)), null, CH.ROPE2 * (1.02 + thrum), null, 1.35];
    }
    T.rope.update(anchors, lens, J0, J1);
  }

  // dust puffs at landings and falls; motes rising off dissolving steps
  function applyEffects(T, t, c, HP, MP, states, stairs) {
    let pi = 0;
    const puff = (p, s, age, size, n, seed) => {
      if (age < 0 || age > 0.6) return;
      const k = ST.fold(s);
      for (let i = 0; i < n && pi < T.puffs.length; i++, pi++) {
        const m = T.puffs[pi]; m.visible = true;
        const a = (i / n) * 2 * PI + seed, sp = 0.28 + 0.22 * U.hash(seed + i);
        const e = 1 - Math.pow(1 - U.sat(age / 0.6), 3);
        m.position.set(p.x + Math.cos(a) * sp * e - k * LAP.x, p.y + 0.08 + 0.22 * e * (0.6 + 0.4 * U.hash(seed * 3 + i)) - k * LAP.y, p.z + Math.sin(a) * sp * e - k * LAP.z);
        m.scale.setScalar(Math.max(0.001, size * U.smooth(0, 0.08, age) * (0.75 + 0.5 * U.hash(seed + i * 7)) * (1 - U.smooth(0.12, 0.6, age))));
      }
    };
    for (const m of T.puffs) m.visible = false;
    // block landing (the step being built lands at ph 0.55)
    const B = MP.B, b = Math.floor(B + 1e-9);
    for (const kk of [b + 1, b]) {
      // time since this block landed: solve buildIdx(t') = kk - 1 + 0.55
      const target = kk - 1 + 0.55;
      if (CH.buildIdx(t, T.id) < target) continue;
      let lo = t - 1.0, hi = t;
      if (CH.buildIdx(lo, T.id) > target) continue;
      for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (CH.buildIdx(m, T.id) < target) lo = m; else hi = m; }
      const age = t - hi;
      const st = ST.stepRec(kk), sC = ST.stepSc(kk);
      const p = ST.onStair(sC, 0, {}); p.y -= 0.02;
      puff(p, sC, age, 1.0, 7, kk * 1.7);
    }
    // falls
    for (let i = 0; i < 2; i++) {
      const d = i ? 0.12 : 0, age = c - (C.sit + d);
      if (age >= 0 && age < 0.6) { const h = HP[i]; puff({ x: h.x, y: ST.stepY(ST.stepAt(h.s)), z: h.z }, h.s, age, 1.3, 8, 3.3 + i); }
    }
    // mini-me landings after its hops
    for (const cc of [C.hopBack1, C.hopFwd1]) { const age = c - cc; if (age >= 0 && age < 0.6) puff({ x: MP.pos.x, y: MP.pos.y, z: MP.pos.z }, MP.pos.s, age, 0.55, 5, cc); }
    // motes: rise off the step that is dissolving into blueprint (this team's)
    let mi = 0;
    for (const m of T.motes) m.visible = false;
    states.forEach((r, j) => {
      if (r.team !== T.id || !r.dissolving) return;
      const st = ST.steps[j];
      const B = CH.buildIdx(t, T.id), J = j + N * Math.round((B + 1 - j) / N);
      const kL = Math.floor(J / N);
      for (let i = 0; i < 9 && mi < T.motes.length; i++, mi++) {
        const m = T.motes[mi]; const q = r.dissolving;
        const rx = (U.hash(j * 13 + i) - 0.5) * st.sx * 0.9, rz = (U.hash(j * 7 + i * 3) - 0.5) * st.sz * 0.9;
        const rise = q * (0.6 + 0.9 * U.hash(i * 5 + j));
        m.visible = true;
        m.position.set(st.cx + rx, st.y + 0.05 + rise, st.cz + rz);
        m.rotation.set(q * 3 + i, q * 2 + j, 0);
        m.scale.setScalar(Math.max(0.001, Math.sin(PI * U.sat(q * 1.1)) * (0.6 + 0.6 * U.hash(i + j))));
      }
    });
  }

  S.story = { build };
})();
