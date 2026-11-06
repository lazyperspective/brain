// THE STAIRCASE v2 - the story applied to the scene each frame: poses for every character, the ropes, the blocks
// (materialising out of nothing, slamming into place, standing, crumbling away) and the small effects (beam, motes,
// dust, sparks, the antenna swap and Claude's glow).
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, CH = S.choreo, T3 = THREE, PAL = S.PAL;
  const D = S.D, C = CH.C, PI = Math.PI;

  // ---------------------------------------------------------------- small helpers
  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const heading = (s) => { const p = ST.pathXZ(s, {}); return Math.atan2(p.tx, p.tz); };
  function rotYXZ(yaw, pitch, roll, x, y, z) {
    let cx = Math.cos(roll), sx = Math.sin(roll);
    const x1 = x * cx - y * sx, y1 = x * sx + y * cx, z1 = z;
    cx = Math.cos(pitch); sx = Math.sin(pitch);
    const y2 = y1 * cx - z1 * sx, z2 = y1 * sx + z1 * cx;
    cx = Math.cos(yaw); sx = Math.sin(yaw);
    return { x: x1 * cx + z2 * sx, y: y2, z: -x1 * sx + z2 * cx };
  }
  // local point (in the pelvis frame, optionally through the spine) -> world
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
  const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  function lerpPose(A, B, w) {
    if (w <= 0) return A; if (w >= 1) return B;
    const P = Object.assign({}, B);
    for (const k of ['x', 'y', 'z']) P[k] = U.lerp(A[k], B[k], w);
    P.yaw = U.angLerp(A.yaw, B.yaw, w); P.pitch = U.lerp(A.pitch || 0, B.pitch || 0, w); P.roll = U.lerp(A.roll || 0, B.roll || 0, w);
    const l3 = (a, b, k) => U.lerp((a || {})[k] || 0, (b || {})[k] || 0, w);
    P.spine = { pitch: l3(A.spine, B.spine, 'pitch'), yaw: l3(A.spine, B.spine, 'yaw'), roll: l3(A.spine, B.spine, 'roll') };
    P.head = { pitch: l3(A.head, B.head, 'pitch'), yaw: l3(A.head, B.head, 'yaw'), roll: l3(A.head, B.head, 'roll') };
    P.hands = [0, 1].map((i) => lerp3(A.hands[i], B.hands[i], w));
    P.feet = [0, 1].map((i) => { const f = lerp3(A.feet[i], B.feet[i], w); f.yaw = U.angLerp(A.feet[i].yaw || 0, B.feet[i].yaw || 0, w); f.pitch = U.lerp(A.feet[i].pitch || 0, B.feet[i].pitch || 0, w); return f; });
    P.knee = A.knee || B.knee ? [0, 1].map((i) => lerp3((A.knee || [v3(), v3()])[i], (B.knee || [v3(), v3()])[i], w)) : null;
    P.squash = U.lerp(A.squash || 1, B.squash || 1, w);
    P.expr = Object.assign({}, A.expr || {}); for (const [k, v] of Object.entries(B.expr || {})) P.expr[k] = U.lerp((A.expr || {})[k] || 0, v, w);
    return P;
  }
  function blink(t, seed) {
    let b = 0;
    for (let i = 0; i < 6; i++) { const tb = (i + 0.2 + 0.6 * U.hash(seed * 7.1 + i)) * D / 6; const d = Math.abs(U.wrapS(t - tb, D)); b = Math.max(b, 1 - U.smooth(0.0, 0.08, d)); }
    return b;
  }
  // a foot on block J, left (side -1) or right (+1) of the centre line (+ lat: an extra sideways shift)
  function stepFoot(J, side, sep, lat = 0) {
    const s = ST.stepSc(J), p = ST.onStair(s, side * sep + lat, {});
    p.yaw = Math.atan2(p.tx, p.tz); p.J = J; return p;
  }
  // walking gait in step space: the foot of parity p is planted on block k = floor(u + 0.5) when k = p (mod 2), the
  // other swings from k - 1 to k + 1 (lands at u = k + 0.38). Returns feet + which block each is over.
  function gait(u, sep, lift, out, lat = 0) {
    const feet = [];
    for (let p = 0; p < 2; p++) {
      const m = u + 0.5, k = Math.floor(m), ph = m - k, side = p === 0 ? -1 : 1;
      if (U.wrap(k, 2) === p) { const f = stepFoot(k, side, sep, lat); f.pitch = 0; f.planted = true; feet.push(f); }
      else {
        const q = U.smooth(0.12, 0.88, ph);
        const a = stepFoot(k - 1, side, sep, lat), b = stepFoot(k + 1, side, sep, lat);
        const f = lerp3(a, b, q); f.y += lift * Math.sin(PI * q); f.yaw = U.angLerp(a.yaw, b.yaw, q); f.pitch = 0.45 * Math.sin(PI * q) - 0.15 * U.smooth(0.7, 1, q);
        f.J = b.J; f.q = q; f.planted = q >= 1; feet.push(f);
      }
    }
    out.feet = feet;
    return out;
  }
  // turn a head toward the camera (cartoon cheat), limited
  function camCheat(P, cam, k, lim, back = 2.2) {
    const a = Math.atan2(cam.pos.x - P.x, cam.pos.z - P.z), rel = U.wrapS(a - P.yaw, 2 * PI);
    if (Math.abs(rel) > back) return 0;
    return U.clamp(rel * k, -lim, lim) * (1 - U.smooth(back - 0.6, back, Math.abs(rel)));
  }

  // ---------------------------------------------------------------- build the cast and the props
  function build(env, stairs) {
    const scene = env.scene, M = S.chars;
    const X = { env, stairs };
    X.claude = M.makeClaude(scene, false);
    X.helper = M.makeClaude(scene, true);
    X.h = [M.makeHuman(scene, 'researcher'), M.makeHuman(scene, 'evaluator'), M.makeHuman(scene, 'suit')];
    X.rope = new S.rope.Rope(scene, 190, 0.038);
    // the waist loop (child of Claude's spine)
    X.waistLoop = new T3.Mesh(new T3.TorusGeometry(0.37, 0.038, 8, 44), X.rope.mat);
    X.waistLoop.rotation.x = PI / 2; X.waistLoop.position.set(0, 0.06, 0); X.waistLoop.scale.set(1, 0.86, 1);
    G.reg(X.waistLoop, { line: 0.75 }); X.claude.spine.add(X.waistLoop);
    X.lasso = new T3.Mesh(new T3.TorusGeometry(0.26, 0.04, 8, 36), X.rope.mat); G.reg(X.lasso, { line: 0.75 }); scene.add(X.lasso);
    X.coil = new T3.Group();
    for (let k = 0; k < 3; k++) { const m = new T3.Mesh(new T3.TorusGeometry(0.13 + k * 0.012, 0.035, 8, 28), X.rope.mat); m.rotation.set(0.3 * k, 0.5 * k, 0); G.reg(m, { line: 0.6 }); X.coil.add(m); }
    scene.add(X.coil);
    X.scissors = makeScissors(); scene.add(X.scissors.group);
    X.wrench = makeWrench(); scene.add(X.wrench);
    // the antenna modules: the old one (tossed) and the new one (in the helper's hand before it goes in)
    const darkM = X.claude.mats.coralD;
    X.oldAnt = M.makeAntenna(darkM); X.oldAnt.group.scale.setScalar(S.CS); scene.add(X.oldAnt.group);
    X.newAnt = M.makeAntenna(darkM); X.newAnt.group.scale.setScalar(S.CS); scene.add(X.newAnt.group);
    // Claude's upgrade aura
    X.aura = new T3.Mesh(new T3.SphereGeometry(1, 32, 20), new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.BackSide,
      uniforms: { uA: { value: 0 }, uCol: { value: new T3.Color('#ffc46b') } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform float uA; uniform vec3 uCol; void main(){ float f = abs(dot(normalize(vN), vV)); float a = pow(f, 1.5) * pow(1.0 - f, 1.2) * 3.2 * uA; gl_FragColor = vec4(pow(uCol, vec3(2.2)) * a, 1.0); }',
    }));
    X.aura.renderOrder = 6; scene.add(X.aura); X.aura.visible = false;
    X.ringCol = new T3.Color('#ffd27a');
    X.rings = [0, 1].map(() => { const m = new T3.Mesh(new T3.TorusGeometry(0.5, 0.025, 8, 64), new T3.MeshBasicMaterial({ color: new T3.Color('#ffd27a'), transparent: true, blending: T3.AdditiveBlending, depthWrite: false })); m.renderOrder = 7; m.visible = false; scene.add(m); return m; });
    // beam from the helper's hands to the block being made
    const beamMat = new T3.MeshBasicMaterial({ color: new T3.Color(PAL.build).multiplyScalar(3.0), transparent: true, opacity: 1, blending: T3.AdditiveBlending, depthWrite: false });
    X.beams = [0, 1].map(() => { const m = new T3.Mesh(new T3.CylinderGeometry(1, 1, 1, 10, 1, true), beamMat); m.renderOrder = 7; m.visible = false; scene.add(m); return m; });
    X.handGlow = [0, 1].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.07, 14, 10), new T3.MeshBasicMaterial({ color: new T3.Color(PAL.build).multiplyScalar(3.5) })); G.reg(m, { line: 0, cast: false }); m.visible = false; scene.add(m); return m; });
    // motes that converge into a forming block
    const moteMat = new T3.MeshBasicMaterial({ color: new T3.Color('#ffe2a0').multiplyScalar(3.2) });
    X.motes = []; for (let k = 0; k < 40; k++) { const m = new T3.Mesh(new T3.BoxGeometry(0.055, 0.055, 0.055), moteMat); G.reg(m, { line: 0, cast: false }); m.visible = false; scene.add(m); X.motes.push(m); }
    // dust puffs
    const puffMat = G.toon({ color: '#efe2cf', rim: 0.25, flat: 0.45 });
    X.puffs = []; for (let k = 0; k < 64; k++) { const m = new T3.Mesh(new T3.SphereGeometry(0.16, 14, 10), puffMat); G.reg(m, { line: 0, cast: false }); m.visible = false; scene.add(m); X.puffs.push(m); }
    // spark bursts (snip, wrench)
    X.sparks = [0, 1].map(() => {
      const g = new T3.Group();
      for (let k = 0; k < 10; k++) { const r = new T3.Mesh(new T3.BoxGeometry(0.03, 0.03, 0.34), new T3.MeshBasicMaterial({ color: new T3.Color('#fff2c4').multiplyScalar(3.4) })); r.position.z = 0.25; const p = new T3.Group(); p.rotation.set((k % 3 - 1) * 0.7, k / 10 * 2 * PI, 0, 'YXZ'); p.add(r); G.reg(r, { line: 0, cast: false }); g.add(p); }
      g.visible = false; scene.add(g); return g;
    });
    X.update = (t) => update(t, X);
    return X;
  }

  function makeScissors() {
    const g = new T3.Group();
    const steel = G.toon({ color: '#d9dee8', rim: 0.8, crisp: 1 }), handle = G.toon({ color: '#e8473f', rim: 0.5, crisp: 1, shadeSat: 1.2 });
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
  function makeWrench() {
    // a big cartoon spanner: chunky open jaw, a bold handle and a red grip, so its silhouette reads at a glance
    const g = new T3.Group(), steel = G.toon({ color: '#d3d8e2', rim: 0.8, crisp: 1 });
    const handle = new T3.Mesh(G.roundedBox(0.062, 0.3, 0.034, 0.016), steel); handle.position.y = -0.15; g.add(handle);
    const head = new T3.Mesh(new T3.TorusGeometry(0.06, 0.03, 10, 20, PI * 1.45), steel); head.rotation.z = PI * 0.775; head.position.y = 0.035; g.add(head);
    const grip = new T3.Mesh(G.roundedBox(0.078, 0.14, 0.05, 0.022), G.toon({ color: '#e8473f', crisp: 1, shadeSat: 1.2 })); grip.position.y = -0.255; g.add(grip);
    g.children.forEach((m) => G.reg(m, { line: 0.6 }));
    g.visible = false;
    return g;
  }

  // ---------------------------------------------------------------- Claude
  function claudePose(X, t, cam) {
    const u = CH.claudeU(t), s = ST.sOfU(u), g = { bob: 0.05, sway: 0.045, lean: 0.12, arm: 1.0, pel: 0.5 };
    const P = { scale: S.CS };
    // near the helper (the just-in-time stretch) Claude walks a little off-centre, away from it
    const lat = -0.14 * U.bump(t, 12.6, 16.4, 0.4);
    gait(u, 0.17 * S.CS, 0.3 * S.CS, P, lat);
    // the just-in-time step: the swinging foot reaches out over the empty slot early and hangs there, lowering onto
    // thin air, until the block rises under it on the contact frame
    if (t > 13.0 && t < C.jit + 0.05) {
      for (const f of P.feet) {
        if (f.planted || f.J !== CH.JIT_J) continue;
        const slot = stepFoot(CH.JIT_J, f === P.feet[0] ? -1 : 1, 0.17 * S.CS, lat);
        const reach = U.smooth(13.15, 13.5, t), drop = U.smooth(13.5, C.jit, t);
        const hover = 0.34 * (1 - U.easeIn(drop)) + 0.03 * Math.sin((t - 13.5) * 26) * (1 - drop) * U.smooth(13.5, 13.6, t);
        f.x = U.lerp(f.x, slot.x, reach); f.z = U.lerp(f.z, slot.z, reach);
        f.y = U.lerp(f.y, slot.y + hover, reach);
        f.pitch = U.lerp(f.pitch, -0.25 * (1 - drop), reach); f.yaw = slot.yaw;
      }
    }
    const p = ST.pathXZ(s, {});
    P.yaw = Math.atan2(p.tx, p.tz);
    const tug = 1 - U.smooth(C.cut, C.cut + 0.08, t) * (1 - U.smooth(C.catch + 0.1, C.catch + 0.8, t));
    const strain = tug * (0.75 + 0.25 * U.smooth(3.4, 5.4, t) * (1 - U.smooth(C.cut, C.cut + 0.1, t)));
    const lurch = U.bump(t, C.cut + 0.02, C.cut + 0.4, 0.12);
    const jolt = U.bump(t, C.catch + 0.02, C.catch + 0.3, 0.1);
    const upg = U.bump(t, C.hopUp1 - 0.1, C.hopFwd0, 0.2);                 // standing still for the upgrade
    const power = U.bump(t, C.glowUp, C.surge - 0.05, 0.1);               // the power-up pose
    const crouch = U.bump(t, C.surge - 0.22, C.surge, 0.08);
    const surge = U.bump(t, C.surge, C.surge + 1.4, 0.25);
    const jitLook = U.bump(t, 13.05, C.jit, 0.15), relief = U.bump(t, C.jit, C.jit + 0.5, 0.08);
    const bob = g.bob * S.CS * (0.5 + 0.5 * Math.cos(2 * PI * u)) * (1 - upg * 0.8);
    const sway = g.sway * S.CS * Math.cos(PI * u) * (1 - upg);
    P.x = p.x + (-p.tz) * (sway + lat); P.z = p.z + p.tx * (sway + lat);
    P.y = ST.h * u + g.pel * S.CS + bob - 0.05 * strain - 0.12 * crouch * S.CS + 0.04 * power;
    P.pitch = g.lean + 0.3 * strain + 0.4 * lurch - 0.4 * jolt - 0.15 * power + 0.25 * crouch + 0.32 * surge + 0.18 * jitLook - 0.1 * upg;
    P.roll = -sway * 1.2;
    P.squash = 1 - 0.08 * crouch + 0.05 * power;
    // the upgrade: standing still, Claude turns on the spot part-way toward the camera (the feet shuffle round with
    // it) so its face reads while the helper works on its head and the new module lights up; it turns back to the
    // climb in the crouch before the surge
    const turn = U.bump(t, C.hopUp1 + 0.05, C.glowUp + 0.12, 0.3);
    if (turn > 0) {
      const dy = U.wrapS(Math.atan2(cam.pos.x - P.x, cam.pos.z - P.z) - P.yaw, 2 * PI) * 0.5 * turn;
      const c = Math.cos(dy), sn = Math.sin(dy);
      P.yaw += dy;
      for (const f of P.feet) { const rx = f.x - P.x, rz = f.z - P.z; f.x = P.x + rx * c + rz * sn; f.z = P.z - rx * sn + rz * c; f.yaw = (f.yaw || 0) + dy; }
    }
    P.spine = { pitch: 0.08 * strain + 0.1 * jitLook, yaw: 0.12 * Math.sin(PI * u) * g.arm * (1 - upg) + camCheat(P, cam, 0.6, 0.55), roll: 0 };
    const lookBack = U.bump(t, 5.45, 6.15, 0.15) * 0.9 + U.bump(t, C.catch + 0.05, C.catch + 0.7, 0.15) * 1.0;
    const cheat = camCheat(P, cam, 0.45, 0.5) * (1 - lookBack);
    P.head = { pitch: -0.12 - 0.1 * strain + 0.3 * lurch - 0.3 * upg + 0.5 * jitLook - 0.2 * power, yaw: cheat + lookBack * 0.95, roll: 0.06 * Math.sin(PI * u) * (1 - upg) };
    const sw = Math.sin(PI * u) * (0.18 + 0.12 * (1 - tug) + 0.25 * surge) * g.arm;
    const hands = [];
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1, w = i === 0 ? sw : -sw;
      let lx = sd * 0.4, ly = 0.12 + Math.abs(w) * 0.2 + 0.08 * strain, lz = w + 0.12 * strain;
      lx = U.lerp(lx, sd * 0.45, lurch); ly = U.lerp(ly, 0.95, lurch); lz = U.lerp(lz, 0.2, lurch);
      lx = U.lerp(lx, sd * 0.62, power); ly = U.lerp(ly, 0.85, power); lz = U.lerp(lz, 0.05, power);
      lx = U.lerp(lx, sd * 0.5, jitLook); ly = U.lerp(ly, 0.45, jitLook); lz = U.lerp(lz, -0.05, jitLook);   // arms out for balance
      hands.push(xf(P, lx, ly, lz, 0.06));
    }
    P.hands = hands;
    const g0 = CH.upgradeGlow(t);
    P.expr = {
      blink: blink(t, 1) * (1 - jitLook), squint: strain * 0.85 * (1 - lurch), surprise: Math.max(U.bump(t, C.cut, C.cut + 0.45, 0.08), jitLook * 0.9, jolt * 0.6),
      happy: Math.max((1 - tug) * (1 - U.bump(t, C.cut, C.cut + 0.6, 0.1)) * (1 - jitLook) * (1 - upg * 0.6), relief, power), look: 0, lookUp: upg * 1.2 - jitLook,
    };
    P.s = s; P.u = u; P.strain = strain; P.glow = g0; P.lat = lat;
    return P;
  }

  // ---------------------------------------------------------------- humans
  const HS = S.HS;
  function draggedPose(s, t, i, lean) {
    const P = { scale: HS };
    const p = ST.pathXZ(s, {}), yaw = Math.atan2(p.tx, p.tz);
    const f0 = CH.dragFootY(s + 0.36), f1 = CH.dragFootY(s + 0.27);
    const fl = ST.onStair(s + 0.36, -0.15 * HS, {}), fr = ST.onStair(s + 0.27, 0.15 * HS, {});
    fl.y = f0.y; fr.y = f1.y; fl.yaw = fr.yaw = yaw; fl.pitch = 0.38 + 0.2 * Math.sin(PI * f0.p); fr.pitch = 0.38 + 0.2 * Math.sin(PI * f1.p);
    P.feet = [fl, fr];
    const fy = (f0.y + f1.y) / 2;
    const hop = Math.sin(PI * f0.p) * 0.5 + Math.sin(PI * f1.p) * 0.5;
    P.x = p.x; P.z = p.z; P.y = fy + 0.4 * HS + 0.04 * hop;
    P.yaw = yaw; P.pitch = -lean + 0.06 * hop + 0.03 * Math.sin(t * 2 * PI * 1.5 + i * 2);
    P.roll = 0.04 * Math.sin(t * 2 * PI * 0.5 + i);
    P.spine = { pitch: 0.28, yaw: 0, roll: 0 };
    P.head = { pitch: -0.05, yaw: 0.05 * Math.sin(t * 2 * PI * 0.5 + i), roll: 0 };
    const g = CH.gripDragged(s, {}), r = CH.rearGrip(s, {});
    P.hands = [{ x: g.x - p.tz * 0.03, y: g.y + 0.01, z: g.z + p.tx * 0.03 }, { x: r.x + p.tz * 0.03, y: r.y, z: r.z - p.tx * 0.03 }];
    P.knee = [v3(0, 0.6, 0), v3(0, 0.6, 0)];
    P.expr = { effort: 1, blink: blink(t, 11 + i) };
    return P;
  }
  function sitPose(s, t, i, c) {
    const P = { scale: HS };
    const p = ST.pathXZ(s, {}), yaw = Math.atan2(p.tx, p.tz);
    const J = ST.stepAt(s), y = ST.stepY(J);
    P.x = p.x; P.z = p.z; P.y = y + 0.15 * HS; P.yaw = yaw; P.pitch = -0.32; P.roll = 0;
    const fl = ST.onStair(s + 0.66 * HS, -0.16 * HS, {}), fr = ST.onStair(s + 0.6 * HS, 0.16 * HS, {});
    fl.y = ST.stepY(ST.stepAt(s + 0.66 * HS)); fr.y = ST.stepY(ST.stepAt(s + 0.6 * HS)); fl.yaw = fr.yaw = yaw; fl.pitch = fr.pitch = 0.5;
    P.feet = [fl, fr];
    P.knee = [v3(0, 1, 0), v3(0, 1, 0)];
    const daze = Math.sin((c - C.sit) * 2 * PI * 1.6 + i);
    P.spine = { pitch: 0.1, yaw: 0, roll: 0.05 * daze };
    P.head = { pitch: 0.05, yaw: 0.15 * daze, roll: 0.18 * daze };
    const hb = ST.onStair(s - 0.28 * HS, -0.3 * HS, {}); hb.y += 0.05;
    P.hands = [hb, xf(P, -0.18, 0.18, 0.3, 0.04)];
    P.expr = { blink: 0.55 + 0.4 * Math.abs(daze), surprise: 0 };
    return P;
  }
  function runPose(s, t, i) {
    const P = { scale: HS };
    const u = ST.uOfS(s);
    gait(u, 0.14 * HS, 0.34, P);
    const p = ST.pathXZ(s, {});
    P.yaw = Math.atan2(p.tx, p.tz);
    const bob = 0.06 * Math.abs(Math.cos(PI * u));
    P.x = p.x; P.z = p.z; P.y = ST.h * u + 0.56 * HS + bob;
    P.pitch = 0.3; P.roll = 0.05 * Math.cos(PI * u);
    P.spine = { pitch: 0.05, yaw: 0.15 * Math.sin(PI * u), roll: 0 };
    P.head = { pitch: -0.3, yaw: 0, roll: 0 };
    const sw = Math.sin(PI * u) * 0.3;
    P.hands = [xf(P, 0.3, 0.32 + Math.max(0, sw) * 0.3, sw + 0.1, 0.04), xf(P, -0.3, 0.32 + Math.max(0, -sw) * 0.3, -sw + 0.1, 0.04)];
    P.expr = { effort: 0.3, determined: 0.7, blink: blink(t, 21 + i) };
    return P;
  }
  function humanPose(X, t, i, cam) {
    const s = CH.humanS(t, i), mode = CH.humanMode(t, i), d = CH.LAG[i];
    const leanBase = [0.62, 0.56, 0.6][i];
    const kind = X.h[i].kind;
    let P;
    if (mode === 'taut') {
      const snap = U.wobble(t - CH.RETAUT[i], 3.2, 5);
      P = draggedPose(s, t, i, leanBase + 0.08 * snap + 0.12 * U.smooth(3.6, 5.6, t) * (t < C.cut ? 1 : 0));
      P.expr.surprise = U.bump(t, 5.55, 6.1, 0.1) * [0.9, 0.6, 0.4][i];
    } else if (mode === 'fall') {
      const uf = U.sat((t - C.cut - d) / (C.sit - C.cut));
      const A = draggedPose(s, t, i, leanBase), B = sitPose(s, t, i, C.sit + d);
      P = lerpPose(A, B, U.easeIn(uf));
      const arc = Math.sin(PI * uf);
      P.y += 0.14 * arc; P.pitch -= 0.5 * arc;
      P.hands = [xf(P, 0.32, 0.95, 0.05, 0.04), xf(P, -0.32, 0.92, 0.1, 0.04)].map((hh, k) => lerp3(lerp3(A.hands[k], hh, U.smooth(0, 0.35, uf)), B.hands[k], U.smooth(0.65, 1, uf)));
      P.feet = P.feet.map((f) => { const gg = Object.assign({}, f); gg.y += 0.3 * arc; return gg; });
      P.expr = { surprise: 1, blink: 0 };
    } else if (mode === 'sit') {
      P = sitPose(s, t, i, t);
      // a beat after landing, they look up at the light show on Claude's head
      const look = U.smooth(C.glowUp - 0.3, C.glowUp + 0.1, t);
      P.head.pitch = U.lerp(P.head.pitch, -0.35, look); P.head.roll *= 1 - look; P.head.yaw *= 1 - look;
      P.expr.surprise = look * U.bump(t, C.glowUp - 0.2, C.getup + 0.2, 0.1) * 0.8; P.expr.blink *= 1 - look;
      if (kind === 'evaluator') {                       // makes a note while sitting
        const w = U.bump(t, C.sit + d + 0.12, C.glowUp - 0.4, 0.15);
        P.hands[0] = lerp3(P.hands[0], xf(P, 0.12, 0.42, 0.34, 0.04), w);
        P.hands[1] = lerp3(P.hands[1], xf(P, -0.04 + 0.04 * Math.sin(t * 30), 0.45 + 0.03 * Math.sin(t * 23), 0.36, 0.04), w);
        P.head.pitch = U.lerp(P.head.pitch, 0.45, w); P.scribble = w;
      }
    } else if (mode === 'getup') {
      const w = U.smooth(C.getup + d, C.run + d, t);
      P = lerpPose(sitPose(s, t, i, t), runPose(s, t, i), w);
      P.squash = 1 - 0.08 * Math.sin(PI * w);
      P.expr = { blink: 0, effort: 0.3, surprise: 0.6 * (1 - w) };
    } else {
      const R = runPose(s, t, i);
      const Bp = draggedPose(s, t, i, U.lerp(-0.02, leanBase, U.smooth(C.catch, CH.RETAUT[i] + 0.1, t)));
      Bp.expr = { effort: U.smooth(C.catch, CH.RETAUT[i], t), blink: Bp.expr.blink };
      Bp.spine.pitch = U.lerp(0.05, 0.28, U.smooth(C.catch, CH.RETAUT[i], t));
      P = lerpPose(R, Bp, U.smooth(CH.PLANT_T[i] - 0.15, CH.PLANT_T[i] + 0.1, t));
      if (kind === 'evaluator' && t < CH.PLANT_T[i]) {   // scribbling notes on the run
        const w = U.bump(t, C.run + 0.5, CH.PLANT_T[i] - 0.15, 0.25);
        P.hands[0] = lerp3(P.hands[0], xf(P, 0.1, 0.48, 0.36, 0.04), w);
        P.hands[1] = lerp3(P.hands[1], xf(P, -0.05 + 0.05 * Math.sin(t * 31), 0.5 + 0.03 * Math.sin(t * 23), 0.4, 0.04), w);
        P.head.pitch = U.lerp(P.head.pitch, 0.3, w); P.scribble = w;
      }
      if (i === 0 && t < C.catch + 0.3) {
        // lasso: the coil in the left hand; spin overhead with the right; throw
        const spin = U.smooth(C.spin - 0.2, C.spin + 0.1, t) * (1 - U.smooth(C.throw, C.throw + 0.12, t));
        const thr = U.smooth(C.throw - 0.05, C.throw + 0.2, t);
        P.hands[0] = lerp3(P.hands[0], xf(P, 0.24, 0.42, 0.3, 0.04), U.smooth(C.run, C.run + 0.3, t) * (1 - U.smooth(C.throw + 0.1, C.catch + 0.25, t)));
        const overhead = xf(P, -0.18, 1.1, 0.08, 0.04), fwd = xf(P, -0.22, 0.55, 0.6, 0.04);
        P.hands[1] = lerp3(lerp3(P.hands[1], overhead, spin), fwd, thr * (1 - U.smooth(C.throw + 0.45, C.catch + 0.25, t)));
        P.head.pitch = U.lerp(P.head.pitch, -0.35, spin);
        P.expr.effort = 0.2; P.expr.determined = 1;
      }
    }
    // cheat the face toward the camera
    P.head.yaw = (P.head.yaw || 0) + camCheat(P, cam, 0.55, 1.05, 2.75);
    if (kind === 'evaluator') {
      const w = P.scribble || 0;
      const tuck = xf(P, 0.28, 0.32, -0.02, 0.04);
      const hold = lerp3(P.hands[0], xf(P, 0.04, 0.46, 0.38, 0.04), 0.6);
      const b = lerp3(tuck, hold, w);
      P.board = { x: b.x, y: b.y, z: b.z, ry: P.yaw + U.lerp(PI / 2, 0, w), rx: U.lerp(0.1, -1.0, w), rz: U.lerp(0.25, 0, w) };
      const ph = P.hands[1];
      P.pen = w > 0.05 ? { x: ph.x, y: ph.y + 0.02, z: ph.z, ry: P.yaw, rx: 0.6, rz: 0.3 } : { x: ph.x, y: -1e3, z: ph.z };
    }
    // stagger on the tread: each human keeps a little toward one side of the stair, so the three faces do not line up
    // behind each other (or behind the flight above) from the camera
    const lat = HLAT[i];
    if (lat) {
      const pp = ST.pathXZ(s, {}), ox = -pp.tz * lat, oz = pp.tx * lat;
      const mv = (q) => { if (q) { q.x += ox; q.z += oz; } };
      P.x += ox; P.z += oz;
      P.hands.forEach(mv); P.feet.forEach(mv); mv(P.board); if (P.pen && P.pen.y > -100) mv(P.pen);
    }
    P.mode = mode; P.s = s;
    return P;
  }
  const HLAT = S.HLAT = [0.3, 0.27, 0.3];

  // ---------------------------------------------------------------- the helper
  const MSC = S.MS * S.CS, MPEL = 0.5 * MSC;
  // the side of the stair the helper keeps to: the side facing the camera
  const sideToCam = (s) => { const p = ST.pathXZ(s, {}); return p.tx >= 0 ? 1 : -1; };
  // the helper keeps to the side of the stair that carries it further along the screen direction of travel, so it
  // stands clear of Claude (who is coming up behind it) instead of in front of Claude
  function helperSpot(J) {
    const s = ST.stepS0(J) + ST.stepLen(J) * 0.4, q = ST.pathXZ(s, {}), sd = -q.tz * q.tx >= 0 ? 1 : -1;
    const p = ST.onStair(s, sd * 0.42, {}); p.s = s; p.side = sd; return p;
  }
  function hopArc(a, b, q, apexUp) {
    const p = lerp3(a, b, q);
    const top = Math.max(a.y, b.y) + apexUp;
    p.y = U.lerp(a.y, b.y, q) + (top - Math.max(a.y, b.y)) * 4 * q * (1 - q) + (Math.max(a.y, b.y) - U.lerp(a.y, b.y, q)) * 0;
    return p;
  }
  function helperPose(X, t, cl, cam) {
    const P = { scale: MSC };
    const Bl = CH.builtIdx(t);
    let pos, yaw, air = 0, mode = 'build', arm = 0, raise = 0, point = 0, onHead = 0;
    const st = { build: null, beam: 0, sc: { show: 0, open: 0 }, wrench: 0 };
    const tripA = C.turn, tripB = C.hopFwd1;
    // keep the two silhouettes apart: when the helper's spot on block J is (nearly) in line with Claude as seen from the
    // camera, it stands further across its own tread (never off it) until they separate. Continuous in time: Claude
    // moves smoothly, the block does not, and the push fades to nothing as the two line up exactly (only ever in a hop)
    const cy = CH.CAMP.yaw, crx = Math.cos(cy), crz = -Math.sin(cy);
    const spot = (J) => {
      const p = helperSpot(J), sx = (p.x - cl.x) * crx + (p.z - cl.z) * crz, asx = Math.abs(sx);
      const want = Math.max(0, 1.05 - asx) * U.smooth(0, 0.25, asx) * Math.sign(sx);
      if (Math.abs(want) < 1e-6) return p;
      const ok = (k) => ST.inBlock(J, p.x + crx * k, p.z + crz * k, -0.08);
      let k = want;
      if (!ok(k)) { let lo = 0, hi = want; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } k = lo; }
      p.x += crx * k; p.z += crz * k;
      return p;
    };
    if (t < tripA || t >= tripB) {
      // standing on the newest block (hopping onto it right after it lands), building the next one
      const tl = CH.landTime(Bl);
      const q = U.smooth(tl + 0.08, tl + 0.42, t);
      const a = spot(Bl - 1), b = spot(Bl);
      if (t >= tripB && Bl === CH.builtIdx(tripB - 1e-3) && tl < C.turn) { pos = b; }
      else { pos = q < 1 ? hopArc(a, b, q, 0.55) : b; air = Math.sin(PI * q) * (q < 1 ? 1 : 0); }
      pos.s = b.s;
      const J = Bl + 1, tn = CH.landTime(J), dur = CH.buildDur(J), tau = t - tn;
      // facing: between the block it builds next and the camera; across the hop it turns smoothly from the stance on
      // the old block (facing the block it hops onto) to the stance on the new one (no snap at landing)
      const stance = (p, Jn) => { const nb = ST.blockTop(Jn, {}); return U.angLerp(Math.atan2(nb.x - p.x, nb.z - p.z), Math.atan2(cam.pos.x - p.x, cam.pos.z - p.z), 0.45); };
      yaw = q <= 0 ? stance(a, Bl) : q >= 1 ? stance(b, J) : U.angLerp(stance(a, Bl), stance(b, J), U.smooth(0, 1, q));
      raise = U.bump(tau, -dur - 0.12, -dur + 0.12, 0.08);
      point = U.bump(tau, -dur + 0.06, -0.02, 0.07);
      st.beam = U.bump(tau, -dur + 0.1, CH.isJit(J) ? -0.1 : -0.2, 0.05);
      st.build = J; st.tau = tau;
      // the just-in-time block: a fizzle first (the beam sputters), then a frantic fire
      if (CH.isJit(J)) { const fz = U.bump(t, C.fizzle, tn - dur - 0.02, 0.06); point = Math.max(point, fz); st.fizzle = fz; }
      // idle between blocks: glance back at Claude
      const idle = (1 - raise) * (1 - point) * (1 - air) * U.smooth(0.25, 0.5, t - tl) * U.smooth(0.0, 0.25, -dur - 0.2 - tau);
      st.idle = idle * (CH.isJit(J) ? 1 - U.smooth(C.fizzle - 0.3, C.fizzle, t) : 1);   // eyes front before the fizzle
      if (t >= tripB) { yaw = U.angLerp(heading(pos.s), yaw, U.smooth(tripB, tripB + 0.3, t)); }   // lands facing forward, then turns to work
    } else {
      mode = 'trip';
      const Bt = CH.builtIdx(C.turn), front = spot(Bt);
      const knotAt = (tt) => { const sc = CH.claudeS(tt) - 0.75; const p = ST.onStair(sc, sideToCam(sc) * 0.42, {}); p.s = sc; return p; };
      const headTop = (local) => { const w = new T3.Vector3(local[0], local[1], local[2]); X.claude.head.localToWorld(w); return { x: w.x, y: w.y, z: w.z }; };
      const hdF = heading(front.s);
      if (t < C.hopBack0) {
        // finish the hop onto the newest block exactly as the build stance would, then turn round to look back
        const tl = CH.landTime(Bt), q = U.smooth(tl + 0.08, tl + 0.42, t), a = spot(Bt - 1);
        pos = q < 1 ? hopArc(a, front, q, 0.55) : front; pos.s = front.s; air = Math.sin(PI * q) * (q < 1 ? 1 : 0);
        const stance = (p, Jn) => { const nb = ST.blockTop(Jn, {}); return U.angLerp(Math.atan2(nb.x - p.x, nb.z - p.z), Math.atan2(cam.pos.x - p.x, cam.pos.z - p.z), 0.45); };
        const yb = q <= 0 ? stance(a, Bt) : q >= 1 ? stance(front, Bt + 1) : U.angLerp(stance(a, Bt), stance(front, Bt + 1), U.smooth(0, 1, q));
        yaw = U.angLerp(yb, hdF + PI, U.smooth(C.turn, C.hopBack0, t));
      }
      else if (t < C.hopBack1) {
        const q = U.smooth(C.hopBack0, C.hopBack1, t), e = knotAt(C.hopBack1);
        pos = hopArc(front, e, q, Math.max(cl.y + 1.3 * S.CS - Math.max(front.y, e.y), 1.0)); pos.s = U.lerp(front.s, e.s, q);
        yaw = hdF + PI; air = Math.sin(PI * q);
      } else if (t < C.hopUp0) {
        pos = knotAt(Math.min(t, C.cut)); { const kn = CH.waistApprox(CH.claudeS(Math.min(t, C.cut)), {}); const to = Math.atan2(kn.x - pos.x, kn.z - pos.z), tc = Math.atan2(cam.pos.x - pos.x, cam.pos.z - pos.z); yaw = U.angLerp(to, tc, 0.4); }
        st.sc.show = U.smooth(C.hopBack1, C.hopBack1 + 0.12, t) * (1 - U.smooth(C.cut + 0.2, C.cut + 0.4, t));
        st.sc.open = Math.max(U.bump(t, C.snip1 - 0.14, C.snip1, 0.05), U.bump(t, C.snip2 - 0.14, C.snip2, 0.05), U.bump(t, C.cut - 0.16, C.cut, 0.05));
        if (t >= C.cut) { const q = U.sat((t - C.cut) / 0.35); pos = lerp3(knotAt(C.cut), knotAt(C.cut), 0); pos.y += 0.0; air = 0; P.recoil = Math.sin(PI * q); }
      } else {
        // on top of Claude's head (feet on the crown, behind the antenna)
        const ab = headTop([0, 0.33, 0.05]);
        const dx = ab.x - cam.pos.x, dz = ab.z - cam.pos.z, dl = Math.hypot(dx, dz) || 1;
        const foot = { x: ab.x + dx / dl * 0.24 * S.CS, y: ab.y - 0.13, z: ab.z + dz / dl * 0.24 * S.CS };
        const faceCam = Math.atan2(-dx, -dz);
        if (t < C.hopUp1) {
          const q = U.smooth(C.hopUp0, C.hopUp1, t), a = knotAt(C.cut);
          pos = hopArc(a, foot, q, 0.5); pos.s = U.lerp(a.s, cl.s, q); air = Math.sin(PI * q);
          yaw = U.angLerp(heading(a.s), faceCam, q);
        } else if (t < C.hopFwd0) {
          pos = foot; pos.s = cl.s; yaw = faceCam; onHead = 1;
        } else {
          const q = U.smooth(C.hopFwd0, C.hopFwd1, t), b = helperSpot(CH.builtIdx(C.hopFwd1));
          pos = hopArc(foot, b, q, 0.7); pos.s = U.lerp(cl.s, b.s, q); air = Math.sin(PI * q);
          yaw = U.angLerp(faceCam, heading(b.s), q);
        }
      }
    }
    const landSq = mode === 'build' ? U.bump(t - CH.landTime(Bl), 0.42, 0.47, 0.04) : U.bump(t, C.hopBack1, C.hopBack1 + 0.05, 0.05) + U.bump(t, C.hopUp1, C.hopUp1 + 0.05, 0.05) + U.bump(t, C.hopFwd1, C.hopFwd1 + 0.05, 0.05);
    P.x = pos.x; P.z = pos.z; P.y = pos.y + MPEL; P.yaw = yaw;
    const work = onHead * U.bump(t, C.pop - 0.1, C.glowUp + 0.15, 0.1);
    P.pitch = 0.08 * air - 0.1 * raise + 0.15 * point + 0.35 * work; P.roll = 0;
    P.squash = 1 - 0.18 * landSq + 0.1 * air;
    P.spine = { pitch: 0.2 * work, yaw: 0, roll: 0 };
    P.head = { pitch: -0.15 + 0.25 * point - 0.3 * raise + 0.3 * work, yaw: 0, roll: 0 };
    if (st.idle) { P.head.yaw = 0.9 * st.idle * U.clamp(U.wrapS(Math.atan2(cl.x - P.x, cl.z - P.z) - yaw, 2 * PI) * 2.5, -1, 1); }
    const fl = xf(P, 0.16, -MPEL / MSC + 0.12 * air, 0.04 + 0.1 * air, null), fr = xf(P, -0.16, -MPEL / MSC + 0.12 * air, -0.02 + 0.08 * air, null);
    if (air < 0.01) { fl.y = pos.y; fr.y = pos.y; }
    fl.yaw = fr.yaw = yaw; fl.pitch = fr.pitch = 0.3 * air;
    P.feet = [fl, fr];
    // hands: up in the hop, raised before a build, both pointing at the block during the beam, scissors, wrench
    const up = 0.95 * air;
    let hl = xf(P, 0.36, 0.15 + up, 0.12, 0.06), hr = xf(P, -0.36, 0.15 + up, 0.12, 0.06);
    if (raise > 0) { hl = lerp3(hl, xf(P, 0.3, 1.05, 0.05, 0.06), raise); hr = lerp3(hr, xf(P, -0.3, 1.05, 0.05, 0.06), raise); }
    if (point > 0 && st.build != null) {
      const nb = ST.blockTop(st.build, {}); nb.y -= ST.T * 0.3;
      const sh = xf(P, 0, 0.5, 0, 0.06), dx = nb.x - sh.x, dy = nb.y - sh.y, dz = nb.z - sh.z, dl = Math.hypot(dx, dy, dz) || 1;
      const reach = 0.5 * MSC;
      const side = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
      const ph = (k) => ({ x: sh.x + dx / dl * reach + side.x * 0.09 * k, y: sh.y + dy / dl * reach, z: sh.z + dz / dl * reach + side.z * 0.09 * k });
      hl = lerp3(hl, ph(1), point); hr = lerp3(hr, ph(-1), point);
    }
    if (st.sc.show > 0) { hr = lerp3(hr, xf(P, -0.1, 0.38, 0.4, 0.06), st.sc.show); hl = lerp3(hl, xf(P, 0.12, 0.36, 0.38, 0.06), st.sc.show); }
    if (onHead) {
      // the antenna base is just in front of its feet
      const base = new T3.Vector3(0, 0.38, 0.05); X.claude.head.localToWorld(base);
      const holdUp = U.bump(t, C.pop + 0.05, C.insert, 0.1);
      const crank = Math.sin(U.smooth(C.crank1 - 0.2, C.crank1, t) * PI) * 0.5 + Math.sin(U.smooth(C.crank2 - 0.2, C.crank2, t) * PI) * 0.5;
      hl = lerp3(hl, { x: base.x, y: base.y + 0.05, z: base.z }, work);
      hr = lerp3(hr, { x: base.x + 0.08 * Math.cos(P.yaw) + crank * 0.06, y: base.y + 0.02, z: base.z - 0.08 * Math.sin(P.yaw) }, work);
      hr = lerp3(hr, xf(P, -0.25, 1.15, 0.1, 0.06), holdUp);
      const cheer = U.bump(t, C.glowUp, C.hopFwd0, 0.08);
      hl = lerp3(hl, xf(P, 0.35, 1.05, 0.05, 0.06), cheer); hr = lerp3(hr, xf(P, -0.35, 1.05, 0.05, 0.06), cheer);
      st.wrench = U.bump(t, C.insert + 0.05, C.glowUp, 0.06); st.crank = crank; st.holdUp = holdUp; st.cheer = cheer;
    }
    P.hands = [hl, hr];
    P.expr = { blink: blink(t, 40), happy: Math.max(U.bump(t - CH.landTime(Bl), 0.02, 0.4, 0.06) * 0.9 * (mode === 'build' ? 1 : 0), st.cheer || 0), squint: st.sc.open * 0.5 + 0.4 * work, surprise: (st.fizzle || 0) * 0.9 };
    P.st = st; P.mode = mode; P.pos = pos; P.air = air;
    return P;
  }

  // ---------------------------------------------------------------- blocks: materialise / slam / stand / crumble
  const tmpV = new T3.Vector3();
  function applyBlocks(t, X) {
    const { slots, POOL } = X.stairs;
    const Bl = CH.builtIdx(t), Jhi = Bl + 1, Jlo = Jhi - POOL + 1;
    const out = { forming: null };
    for (let J = Jlo; J <= Jhi; J++) {
      const sl = slots[U.wrap(J, POOL)], st = ST.stepRec(J), u = sl.mat.userData.u;
      const top = ST.blockTop(J, {});
      const tl = CH.landTime(J), dur = CH.buildDur(J), tau = t - tl, jit = CH.isJit(J);
      const tc = CH.crumbleTime(J), tauC = t - tc;
      sl.mesh.visible = false; sl.ghost.visible = false; for (const pc of sl.pieces) pc.m.visible = false;
      sl.mesh.rotation.set(0, ST.PHI, 0); sl.mesh.scale.set(1, 1, 1);
      if (tau < -dur) continue;
      const fall = tauC - CH.CRACK;
      if (fall > 2.4) continue;
      let ox = 0, oy = 0, oz = 0, solid = 1, ghost = 0, glow = 0.12, sx = 1, sy = 1;
      if (tau < 0) {
        const e = tau + dur;                                             // time since the build began
        if (!jit) {
          // it forms up and off to the side (away from Claude on screen), then swoops down into its slot
          const dq = 1 - U.easeIn(U.sat((tau + 0.2) / 0.2));
          const cx = ST.pathXZ(CH.claudeS(tl), {}).x, away = top.x >= cx ? 1 : -1;
          oy = 1.2 * dq; ox = away * 0.7 * dq;
          ghost = U.smooth(0, 0.1, e) * (1 - U.smooth(-0.3, -0.12, tau));
          solid = U.smooth(0.16, dur - 0.2, e);
        } else {
          oy = -1.0 * (1 - U.easeOut(U.sat((tau + 0.2) / 0.2)));
          ghost = U.smooth(0, 0.07, e) * (1 - U.smooth(-0.18, -0.03, tau));
          solid = U.smooth(0.08, dur - 0.12, e);
        }
        const pop = U.smooth(0, 0.3, e); sx = 0.86 + 0.14 * pop; sy = sx;
        glow = 1.5;
        out.forming = { J, e, dur, tau, top: { x: top.x + ox, y: top.y + oy - ST.T / 2, z: top.z }, jit };
      } else {
        // the slam: squash and bounce, the gold trim flares and fades
        const k = Math.exp(-tau * 9);
        sy = 1 - 0.2 * k * Math.cos(tau * 34); sx = 1 + 0.09 * k * Math.cos(tau * 34);
        glow = 0.15 + 2.6 * Math.exp(-tau * 5) + 0.5 * Math.exp(-tau * 0.8);
      }
      if (tauC >= 0) {
        // cracking: a shiver, then four pieces drop away into the clouds
        const sh = U.sat(tauC / CH.CRACK);
        ox = 0.025 * sh * Math.sin(tauC * 71 + J); oz = 0.025 * sh * Math.cos(tauC * 63 + J * 2);
        glow = 0.05;
        if (fall >= 0) {
          sl.pieces.forEach((pc, k) => {
            pc.m.visible = true;
            const r = U.hash(J * 7.3 + k * 1.9), r2 = U.hash(J * 3.1 + k * 5.7);
            const lp = rotYXZ(ST.PHI, 0, 0, pc.lx * 1, 0, pc.lz * 1);
            const vx = lp.x * (1.2 + r), vz = lp.z * (1.2 + r), delay = 0.06 * k;
            const f = Math.max(0, fall - delay - 0.08 * r2);
            pc.m.position.set(top.x + lp.x * (1 + 0.15 * f) + vx * f, top.y + pc.ly - 5.0 * f * f - 0.15 * f, top.z + lp.z * (1 + 0.15 * f) + vz * f);
            pc.m.rotation.set((r - 0.5) * 5 * f, ST.PHI + (r2 - 0.5) * 3 * f, (r2 - 0.5) * 6 * f);
          });
          continue;
        }
      }
      sl.mesh.visible = solid > 0.002;
      { const side = solid < 0.999 ? T3.DoubleSide : T3.FrontSide; sl.mat.side = side; sl.mesh.userData.nid.side = side; }
      sl.mesh.position.set(top.x + ox, top.y - ST.T / 2 * sy + oy + (1 - sy) * 0, top.z + oz);
      sl.mesh.scale.set(sx, sy, sx);
      u.uSolid.value = solid; u.uGlow.value = glow;
      sl.ghost.visible = ghost > 0.003;
      if (sl.ghost.visible) { sl.ghost.position.set(top.x + ox, top.y - ST.T / 2 + oy, top.z); sl.ghost.rotation.set(0, ST.PHI, 0); sl.ghost.scale.set(sx, sx, sx); sl.ghost.material.uniforms.uA.value = ghost; sl.ghost.material.uniforms.uT.value = t; sl.ghost.material.uniforms.uSolid.value = solid; }
    }
    return out;
  }
  const blockExists = (t) => (J) => CH.landTime(J) <= t && t < CH.crumbleTime(J) + CH.CRACK;

  // ---------------------------------------------------------------- per-frame update
  function update(t, X) {
    const cam = X.env.camInfo;
    const forming = applyBlocks(t, X).forming;
    const P = claudePose(X, t, cam);
    X.claude.apply(P);
    // the waist loop: on while lassoed; springs off at the cut, drops on at the catch
    const lassoed = t < C.cut || t >= C.catch;
    const cutA = U.sat((t - C.cut) / 0.14), catchA = U.sat((t - C.catch) / 0.16);
    X.waistLoop.visible = lassoed || t < C.cut + 0.14;
    if (t >= C.cut && t < C.cut + 0.14) { X.waistLoop.scale.set(1 + 0.6 * cutA, 0.86 * (1 - cutA), 1 + 0.6 * cutA); X.waistLoop.position.y = 0.06 - 0.2 * cutA; }
    else if (t >= C.catch && t < C.catch + 0.16) { const k = 1.5 - 0.5 * U.easeOutBack(catchA); X.waistLoop.scale.set(k, 0.86 * k, k); X.waistLoop.position.y = 0.06 + 0.35 * (1 - catchA); }
    else { X.waistLoop.scale.set(1, 0.86, 1); X.waistLoop.position.y = 0.06; }
    X.claude.root.updateMatrixWorld(true);
    const waist = X.claude.pointOn(X.claude.spine, X.claude.waist, new T3.Vector3()).clone();
    applyClaudeGlow(X, t, P);
    const HP = [0, 1, 2].map((i) => humanPose(X, t, i, cam));
    HP.forEach((hp, i) => X.h[i].apply(hp));
    const MP = helperPose(X, t, P, cam);
    X.helper.apply(MP);
    applyHelperProps(X, t, MP, P, forming);
    applyRope(X, t, P, HP, waist);
    applyEffects(X, t, HP, MP, P, forming);
    // contact shading on the treads: where each foot (and a sitting human's seat) meets a step
    {
      const FT = G.LIGHT.feet; let k = 0;
      const put = (f, r) => { if (k < FT.length) FT[k++].set(f.x, f.y, f.z, r); };
      P.feet.forEach((f) => put(f, 0.3));
      MP.feet.forEach((f) => put(f, 0.17));
      HP.forEach((hp) => { hp.feet.forEach((f) => put(f, 0.21)); if (hp.mode === 'sit' || hp.mode === 'getup') put({ x: hp.x, y: ST.stepY(ST.stepAt(hp.s)), z: hp.z }, 0.34); });
      while (k < FT.length) FT[k++].set(0, -1e4, 0, 0);
    }
    X.last = { P, HP, MP };
  }

  function applyClaudeGlow(X, t, P) {
    const g = P.glow, ant = X.claude.antenna;
    // antenna: off the head between the pop and the insert
    ant.group.visible = !(t >= C.pop && t < C.insert);
    ant.bulbMat.color.copy(ant.base).multiplyScalar(1.2 + 2.2 * g);
    X.claude.eyeMat.color.copy(X.claude.eyeBase).multiplyScalar(1 + 0.55 * Math.max(0, g - 0.35));
    const rim = 0.7 + 1.1 * Math.max(0, g - 0.35);
    for (const m of [X.claude.mats.coral, X.claude.mats.coralD]) { m.userData.u.uRim.value = rim; m.userData.u.uRimCol.value.set(g > 0.5 ? '#ffd890' : '#ffe2b8'); }
    // the power-up: two gold rings burst out from Claude when the new module lights up
    X.aura.visible = false;
    X.rings.forEach((rg, k) => {
      const a = t - C.glowUp - 0.12 * k;
      rg.visible = a >= 0 && a < 0.7;
      if (!rg.visible) return;
      const c = X.claude.pointOn(X.claude.spine, new T3.Vector3(0, 0.35 + 0.25 * k, 0), new T3.Vector3());
      rg.position.copy(c); rg.rotation.set(PI / 2 + 0.25, 0, 0);
      const e = U.easeOut(a / 0.7);
      rg.scale.setScalar(S.CS * (0.6 + 2.2 * e)); rg.material.opacity = 1;
      rg.material.color.copy(X.ringCol).multiplyScalar(3.0 * (1 - e));
    });
    // the old module flies off; the new one waits in the helper's raised hand
    const tp = t - C.pop;
    X.oldAnt.group.visible = tp >= 0 && tp < 2.2;
    if (X.oldAnt.group.visible) {
      // deterministic: launch point = antenna socket at the pop time (Claude barely moves during the upgrade)
      const lp = launchPoint(X, C.pop);
      X.oldAnt.group.position.set(lp.x + 1.3 * tp, lp.y + 2.6 * tp - 4.9 * tp * tp, lp.z + 0.6 * tp);
      X.oldAnt.group.rotation.set(5 * tp, 0, -4 * tp);
      X.oldAnt.bulbMat.color.copy(X.oldAnt.base).multiplyScalar(0.8);
    }
  }
  // the antenna socket in world space at time tt (Claude's pose at tt)
  function launchPoint(X, tt) {
    const P = claudePose(X, tt, X.env.camInfo);
    const hd = rotYXZ(P.yaw, P.pitch, P.roll, 0, (0.06 + 0.86 + 0.4) * S.CS, 0.05 * S.CS);
    return { x: P.x + hd.x, y: P.y + hd.y, z: P.z + hd.z };
  }

  function applyHelperProps(X, t, MP, P, forming) {
    const st = MP.st;
    // scissors
    const sc = st.sc;
    X.scissors.group.visible = sc.show > 0.01;
    if (sc.show > 0.01) {
      const h = MP.hands[1];
      X.scissors.group.position.set(h.x, h.y + 0.03, h.z);
      X.scissors.group.rotation.set(-0.3, MP.yaw, 0, 'YXZ');
      X.scissors.group.scale.setScalar(Math.max(0.001, U.easeOutBack(sc.show, 2.0)) * 2.0);
      const a = 0.05 + 0.55 * sc.open;
      X.scissors.a.rotation.y = a; X.scissors.b.rotation.y = -a;
    }
    // wrench
    X.wrench.visible = (st.wrench || 0) > 0.01;
    if (X.wrench.visible) {
      const h = MP.hands[1];
      X.wrench.position.set(h.x, h.y, h.z);
      X.wrench.rotation.set(0.3, MP.yaw + (st.crank || 0) * 1.1, -1.3, 'YXZ');   // handle out to the side, against the sky
      X.wrench.scale.setScalar(S.CS * 2.1 * U.easeOutBack(st.wrench, 1.5));
    }
    // the new module in the raised hand, then into the socket
    const showNew = t >= C.pop + 0.12 && t < C.insert;
    X.newAnt.group.visible = showNew;
    if (showNew) {
      const h = MP.hands[1];
      const sock = new T3.Vector3(0, 0.33, 0.05); X.claude.head.localToWorld(sock);
      const q = U.smooth(C.insert - 0.22, C.insert, t);
      X.newAnt.group.position.set(U.lerp(h.x, sock.x, q), U.lerp(h.y + 0.02, sock.y, q), U.lerp(h.z, sock.z, q));
      X.newAnt.group.rotation.set(0.3 * (1 - q), P.yaw, 0, 'YXZ');
      X.newAnt.group.scale.setScalar(S.CS * U.lerp(0.9, 1, q));
      X.newAnt.bulbMat.color.copy(X.newAnt.base).multiplyScalar(2.6 + 0.6 * Math.sin(t * 20));
    }
    // build beam: from the helper's hands to the forming block
    const beamOn = forming && st.build === forming.J ? st.beam : 0;
    X.beams.forEach((b, i) => {
      const h = MP.hands[i];
      b.visible = beamOn > 0.02 || (st.fizzle || 0) > 0.05;
      X.handGlow[i].visible = b.visible || (st.build != null && U.bump(st.tau || 0, -CH.buildDur(st.build) - 0.12, -CH.buildDur(st.build) + 0.1, 0.05) > 0.1);
      X.handGlow[i].position.set(h.x, h.y, h.z);
      X.handGlow[i].scale.setScalar(1 + 0.8 * beamOn + 0.3 * Math.sin(t * 40 + i));
      if (!b.visible) return;
      let tgt;
      let amp = beamOn;
      if (beamOn > 0.02) { tgt = { x: forming.top.x, y: forming.top.y, z: forming.top.z }; }
      else {
        // fizzle: a short sputtering beam that dies a third of the way out
        const nb = ST.blockTop(st.build, {}); const f = 0.3 + 0.12 * Math.sin(t * 37 + i);
        tgt = lerp3(h, { x: nb.x, y: nb.y - ST.T / 2, z: nb.z }, f);
        amp = st.fizzle * (0.5 + 0.5 * Math.sin(t * 53 + i * 2) > 0.3 ? 1 : 0.2);
      }
      const dx = tgt.x - h.x, dy = tgt.y - h.y, dz = tgt.z - h.z, l = Math.hypot(dx, dy, dz) || 1e-3;
      b.position.set((h.x + tgt.x) / 2, (h.y + tgt.y) / 2, (h.z + tgt.z) / 2);
      b.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), new T3.Vector3(dx / l, dy / l, dz / l));
      const w = 0.04 * (0.6 + 0.6 * amp) * (1 + 0.25 * Math.sin(t * 61 + i));
      b.scale.set(w, l, w);
    });
  }

  // rope anchors for this frame: waist -> researcher (front, rear grip) -> evaluator -> suit -> a tail on the steps
  function applyRope(X, t, P, HP, waist) {
    const [h0, h1, h2] = HP, sC = P.s;
    const s0 = h0.s, s1 = h1.s, s2 = h2.s;
    const tailPt = (() => { const p = ST.onStair(s2 - 0.8, 0.12, {}); p.y += 0.04; p.s = s2 - 0.8; return p; })();
    const withS = (p, s) => ({ x: p.x, y: p.y, z: p.z, s });
    const g0f = withS(h0.hands[0], s0 + 0.4), g0r = withS(h0.hands[1], s0 + 0.1);
    const g1f = withS(h1.hands[0], s1 + 0.4), g1r = withS(h1.hands[1], s1 + 0.1);
    const g2f = withS(h2.hands[0], s2 + 0.4), g2r = withS(h2.hands[1], s2 + 0.1);
    const back = [g1f, g1r, g2f, g2r, tailPt];
    const backLens = [CH.ROPE[1] * 1.02, null, CH.ROPE[2] * 1.02, null, CH.TAIL * 1.35];
    // the evaluator holds the rope one-handed (clipboard tucked under the other arm), so its grips sit close together
    const J0 = Math.floor(ST.uOfS(Math.min(s2, s1, s0) - 2)) - 1, J1 = Math.ceil(ST.uOfS(sC + 1)) + 1;
    const exists = blockExists(t);
    let anchors, lens;
    X.lasso.visible = false; X.coil.visible = false;
    const lasso = (p, r, rx, ry, rz) => { X.lasso.visible = true; X.lasso.position.set(p.x, p.y, p.z); X.lasso.scale.setScalar(r); X.lasso.rotation.set(rx, ry, rz, 'YXZ'); };
    const coil = (p, sc) => { X.coil.visible = sc > 0.01; X.coil.position.set(p.x, p.y - 0.05, p.z); X.coil.scale.setScalar(Math.max(0.001, sc)); X.coil.rotation.set(0.4, h0.yaw, 0.3, 'YXZ'); };
    // the evaluator's mid-rope stretch is slack while running
    const runSlack = (i) => (h1.mode === 'run' || h1.mode === 'getup' || h1.mode === 'sit' || h1.mode === 'fall' ? 1.25 : 1.02);
    if (t < C.cut) {
      anchors = [withS(waist, sC - 0.3), g0f, g0r, ...back];
      lens = [CH.ROPE[0] * (1.012 + 0.006 * Math.sin(t * 2 * PI * 1.3)), null, ...backLens];
    } else if (t < C.getup + 0.3) {
      const sCcut = CH.claudeS(C.cut);
      const start = CH.waistApprox(sCcut, {});
      const land = ST.onStair(s0 + 1.0, 0.18, {}); land.y += 0.045;
      const q = U.easeOut(U.sat((t - C.cut) / 0.42));
      const E = lerp3(start, land, q); E.y += 0.75 * Math.sin(PI * q) * (1 - q * 0.3);
      const pick = U.smooth(C.getup - 0.05, C.getup + 0.3, t);
      const E2 = lerp3(E, h0.hands[0], pick);
      const se = U.lerp(U.lerp(sCcut - 0.3, s0 + 1.0, q), s0 + 0.4, pick);
      anchors = [withS(E2, se), g0r, ...back];
      lens = [CH.ROPE[0] * (1 - 0.75 * pick), CH.ROPE[1] * 1.1, null, CH.ROPE[2] * 1.15, null, CH.TAIL * 1.35];
      coil(h0.hands[0], pick);
    } else if (t < C.spin) {
      anchors = [withS(h0.hands[0], s0 + 0.4), g0r, ...back];
      lens = [0.55, CH.ROPE[1] * runSlack(), null, CH.ROPE[2] * runSlack(), null, CH.TAIL * 1.35];
      coil(h0.hands[0], 1);
    } else if (t < C.catch) {
      const hand = h0.hands[1];
      const ang = (t - C.spin) * 2 * PI * 2.2;
      const orbit = { x: hand.x + Math.cos(ang) * 0.45, y: hand.y + 0.12 + 0.05 * Math.sin(ang), z: hand.z + Math.sin(ang) * 0.45, s: s0 + 0.3 };
      let E = orbit;
      if (t >= C.throw) {
        const thr = U.sat((t - C.throw) / (C.catch - C.throw));
        const tgt = { x: waist.x, y: waist.y + 0.3, z: waist.z };
        const q = U.easeInOut(thr);
        const rel = { x: hand.x, y: hand.y + 0.15, z: hand.z };
        E = lerp3(rel, tgt, q); E.y += 1.1 * Math.sin(PI * q); E.s = U.lerp(s0 + 0.3, sC - 0.2, q);
        lasso(E, 1.0 + 0.4 * q, PI / 2 + 0.25 * (1 - q), h0.yaw, 0);
      } else lasso(orbit, 1.05, PI / 2 + 0.25, ang, 0);
      const d = dist3(E, g0r);
      anchors = [E, g0r, ...back];
      lens = [Math.max(d * 1.04, 0.5), CH.ROPE[1] * runSlack(), null, CH.ROPE[2] * runSlack(), null, CH.TAIL * 1.35];
      coil(h0.hands[0], 1 - U.smooth(C.throw, C.throw + 0.5, t));
    } else {
      anchors = [withS(waist, sC - 0.3), g0f, g0r, ...back];
      const thrum = (i) => 0.03 * Math.abs(U.wobble(t - CH.RETAUT[i], 5, 5));
      const sl = (i) => (t < CH.RETAUT[i] ? 1.12 - 0.1 * U.smooth(C.catch, CH.RETAUT[i], t) : 1.012 + thrum(i));
      lens = [CH.ROPE[0] * sl(0), null, CH.ROPE[1] * sl(1), null, CH.ROPE[2] * sl(2), null, CH.TAIL * 1.35];
    }
    X.rope.update(anchors, lens, J0, J1, { exists });
  }

  // dust puffs at landings, slams and falls; motes converging into a forming block; sparks
  function applyEffects(X, t, HP, MP, P, forming) {
    let pi = 0;
    const puff = (p, age, size, n, seed, spread = 1, life = 0.6) => {
      if (age < 0 || age > life) return;
      for (let i = 0; i < n && pi < X.puffs.length; i++, pi++) {
        const m = X.puffs[pi]; m.visible = true;
        const a = (i / n) * 2 * PI + seed, sp = (0.3 + 0.25 * U.hash(seed + i)) * spread;
        const e = 1 - Math.pow(1 - U.sat(age / life), 3);
        m.position.set(p.x + Math.cos(a) * sp * e, p.y + 0.06 + 0.22 * e * (0.6 + 0.4 * U.hash(seed * 3 + i)), p.z + Math.sin(a) * sp * e);
        { const k = Math.max(0.001, size * U.smooth(0, 0.06, age) * (0.75 + 0.5 * U.hash(seed + i * 7)) * (1 - U.smooth(life * 0.2, life, age))); m.scale.set(k * 1.25, k * 0.7, k * 1.25); }
      }
    };
    for (const m of X.puffs) m.visible = false;
    // block slams: a ring of dust around the block's footprint
    const Bl = CH.builtIdx(t);
    for (const J of [Bl, Bl - 1]) {
      const age = t - CH.landTime(J);
      if (age < 0 || age > 0.7) continue;
      const top = ST.blockTop(J, {});
      puff({ x: top.x, y: top.y - 0.3, z: top.z }, age, 0.95, 12, J * 1.7, 1.7, 0.5);
    }
    // crumbling blocks: a puff as they break
    const cf = CH.crumbleFront(t);
    for (let J = Math.floor(cf) - 3; J <= Math.floor(cf) + 1; J++) {
      const age = t - CH.crumbleTime(J) - CH.CRACK + 0.1;
      if (age < 0 || age > 0.6) continue;
      const top = ST.blockTop(J, {});
      puff({ x: top.x, y: top.y - 0.3, z: top.z }, age, 1.0, 6, J * 2.3, 1.6);
    }
    // falls
    for (let i = 0; i < 3; i++) {
      const age = t - (C.sit + CH.LAG[i]);
      if (age >= 0 && age < 0.6) { const h = HP[i]; puff({ x: h.x, y: ST.stepY(ST.stepAt(h.s)), z: h.z }, age, 1.2, 7, 3.3 + i); }
    }
    // the helper's landings after its hops
    for (const cc of [C.hopBack1, C.hopFwd1]) { const age = t - cc; if (age >= 0 && age < 0.6) puff({ x: MP.pos.x, y: MP.pos.y, z: MP.pos.z }, age, 0.55, 5, cc); }
    // motes: stream from the helper's hands and from the air around into the forming block
    for (const m of X.motes) m.visible = false;
    if (forming) {
      const { e, dur, top, J } = forming, hands = MP.hands;
      const st = ST.stepRec(J);
      for (let k = 0; k < X.motes.length; k++) {
        const m = X.motes[k];
        const t0 = (k / X.motes.length) * (dur * 0.55), life = dur * 0.42;
        const q = (e - t0) / life;
        if (q < 0 || q > 1) continue;
        m.visible = true;
        const r1 = U.hash(J * 5.1 + k), r2 = U.hash(J * 2.3 + k * 7), r3 = U.hash(J * 9.7 + k * 3);
        const src = k % 3 === 0 ? hands[k % 2] : { x: top.x + (r1 - 0.5) * 3.2, y: top.y + (r2 - 0.3) * 2.2, z: top.z + (r3 - 0.5) * 3.2 };
        const dst = rotYXZ(ST.PHI, 0, 0, (r1 - 0.5) * st.sx * 0.9, (r2 - 0.5) * ST.T * 0.8, (r3 - 0.5) * st.sz * 0.9);
        const w = U.easeIn(q);
        m.position.set(U.lerp(src.x, top.x + dst.x, w), U.lerp(src.y, top.y + dst.y, w) + 0.25 * Math.sin(PI * q), U.lerp(src.z, top.z + dst.z, w));
        m.rotation.set(q * 6 + k, q * 4, 0);
        m.scale.setScalar(Math.max(0.001, Math.sin(PI * q) * (0.8 + 0.7 * r2)));
      }
    }
    // sparks: the snip, the two wrench turns
    const burst = (g, p, age, size) => {
      g.visible = age >= -0.02 && age < 0.3;
      if (!g.visible) return;
      g.position.set(p.x, p.y, p.z);
      const e = U.sat((age + 0.02) / 0.3);
      g.scale.setScalar(Math.max(0.001, size * Math.sin(PI * Math.sqrt(e)) * (0.6 + 0.6 * e)));
      g.rotation.set(0, e * 0.8 + size, 0);
    };
    X.sparks.forEach((g) => { g.visible = false; });
    if (Math.abs(t - C.cut - 0.1) < 0.25) { const w = CH.waistApprox(CH.claudeS(C.cut), {}); burst(X.sparks[0], w, t - C.cut, 1.7); }
    for (const [k, tc] of [C.crank1, C.crank2].entries()) {
      if (Math.abs(t - tc - 0.1) < 0.25) { const b = new T3.Vector3(0, 0.36, 0.05); X.claude.head.localToWorld(b); burst(X.sparks[1], b, t - tc, 1.1 + 0.2 * k); }
    }
  }

  S.story = { build, claudePose };
})();
