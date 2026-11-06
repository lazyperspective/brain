// THE STAIRCASE v2 - choreography: where everyone is and what they are doing, as pure functions of t (no THREE, no
// state, no randomness; also loaded by the Node checks and the sound's event list in production/).
//
// Over one loop (D = 20 s) Claude climbs exactly one module (12 blocks, 5.04 m); so do the humans, the helper, the
// build front, the crumble front and the camera. Step coordinates below are absolute block indices (u = J on block J).
//
//   0.0- 4.6  tug-of-war on F1 (facing the camera): the humans lean back and are dragged up; the helper builds ahead
//   4.6- 5.0  the helper stops, turns and looks back at the strain
//   5.0- 5.5  it hops back over Claude's head to the knot;  5.5-6.2 snip, snip, SNIP (spark)
//   6.2- 6.6  the rope whips back; the humans tumble and sit; Claude lurches forward a step
//   6.6- 7.0  the helper hops up onto Claude's shoulders
//   7.0- 8.8  upgrade: old antenna module out (tossed), a new glowing one in, two wrench turns with sparks; glow up
//   8.8- 9.3  the helper hops forward to the build front;  9.0 Claude SURGES up F2 (seen from behind)
//   9.1- 9.7  the humans scramble up;  9.7-13.6 they chase (the evaluator scribbling notes on the run)
//  12.9-14.1  lasso spinning;  13.2-13.95 Claude's foot swings out over empty air; the block rises under it at 13.95
//  14.1-14.55 the throw and the catch;  14.55-15.6 brace, rope snaps taut, the drag resumes into the opening pose
(function () {
  const S = window.STAIR, U = S.U, ST = S.stairs;
  const D = S.D, N = ST.N;
  const J0 = 2;                                   // Claude is on block 2 (F1) at t = 0

  const C = {
    turn: 4.6, hopBack0: 5.0, hopBack1: 5.5, snip1: 5.72, snip2: 5.95, cut: 6.2, hopUp0: 6.62, hopUp1: 7.0,
    pop: 7.2, show: 7.45, insert: 7.7, crank1: 8.0, crank2: 8.4, glowUp: 8.45, hopFwd0: 8.82, hopFwd1: 9.3, surge: 9.0,
    sit: 6.55, getup: 9.1, run: 9.55, spin: 12.9, plant: 13.55, throw: 14.1, catch: 14.55, jit: 419 / 30, fizzle: 13.0,
  };

  // ---- Claude: step coordinate (relative to J0), monotone, +12 per loop
  const claudeRel = U.pmono([[0, 0], [5.0, 2.0], [6.2, 2.3], [7.0, 3.3], [9.0, 3.45], [10.5, 5.8], [12.0, 7.4], [419 / 30, 9.38], [14.6, 9.5], [15.5, 9.6]], D, N);
  const claudeU = (t) => J0 + claudeRel(t);
  const claudeS = (t) => ST.sOfU(claudeU(t));

  // ---- the build: landing time of every block (n = J - J0). Block J0+10 is the just-in-time block: it lands on the
  // very frame Claude's foot comes down on it (u = J - 0.62, see the gait in story.js).
  const TL = { 3: 0.4, 4: 1.7, 5: 3.0, 6: 4.3, 7: 10.0, 8: 10.95, 9: 11.9, 10: C.jit, 11: 15.2, 12: 16.5, 13: 17.8, 14: 19.1 };
  const JIT_N = 10, JIT_J = J0 + JIT_N;
  function landTime(J) { const n = J - J0, k = Math.floor((n - 3) / N); return TL[n - k * N] + k * D; }
  const isJit = (J) => U.wrap(J - JIT_J, N) === 0;
  // materialisation lead (s before landing) per block
  const buildDur = (J) => { const n = U.wrap(J - J0, N); return isJit(J) ? 0.5 : n === 8 || n === 9 ? 0.58 : n === 7 ? 0.7 : 0.78; };
  // the newest landed block at time t
  function builtIdx(t) {
    let J = Math.floor(claudeU(t)) + 6;
    while (landTime(J) > t) J--;
    while (landTime(J + 1) <= t) J++;
    return J;
  }
  // the gait: the foot that lands on block k swings during u in [k - 1.38, k - 0.62] and is planted from u = k - 0.62
  const swingStartU = (k) => k - 1.38, contactU = (k) => k - 0.62;
  function timeAtU(u) { let lo = -2 * D, hi = 3 * D; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (claudeU(m) < u) lo = m; else hi = m; } return (lo + hi) / 2; }

  // ---- the humans on the rope (0 researcher, 1 evaluator, 2 suit)
  const ROPE = [1.85, 0.8, 0.8];                  // waist -> h0 front grip, h0 rear -> h1 front, h1 rear -> h2 front
  const TAIL = 1.0;
  const HS = S.HS;
  function dragFootY(sf) {
    const J = ST.stepAt(sf + 0.15), b = ST.stepS0(J);
    const y1 = ST.stepY(J), y0 = ST.stepY(J - 1);
    const p = U.sat((sf - (b - 0.15)) / 0.19);
    return { y: U.lerp(y0, y1, U.smooth(0, 1, p)) + 0.13 * Math.sin(Math.PI * p), p, J };
  }
  const feetHeightDragged = (s) => (dragFootY(s + 0.36).y + dragFootY(s + 0.28).y) / 2;
  function gripDragged(s, out) {
    ST.pathXZ(s, out);
    out.x += out.tx * 0.42 * HS; out.z += out.tz * 0.42 * HS; out.y = feetHeightDragged(s) + 0.62 * HS;
    return out;
  }
  function rearGrip(s, out) { gripDragged(s, out); const p = ST.pathXZ(s, {}); out.x -= p.tx * 0.3; out.z -= p.tz * 0.3; out.y -= 0.03; return out; }
  function waistApprox(s, out) {
    ST.pathXZ(s, out);
    out.y = ST.uOfS(s) * ST.h + 0.62 * S.CS;
    out.x -= out.tx * 0.32 * S.CS; out.z -= out.tz * 0.32 * S.CS;
    return out;
  }
  const tmpB = {};
  function solveBehind(anchor, sHi, len) {
    let lo = sHi - len * 2.5 - 1, hi = sHi;
    for (let it = 0; it < 40; it++) {
      const m = (lo + hi) / 2; gripDragged(m, tmpB);
      if (Math.hypot(tmpB.x - anchor.x, tmpB.y - anchor.y, tmpB.z - anchor.z) > len) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  function tautHumans(sC) {
    const w = waistApprox(sC, {});
    const s0 = solveBehind(w, sC - 0.3, ROPE[0]);
    const s1 = solveBehind(rearGrip(s0, {}), s0 - 0.1, ROPE[1]);
    const s2 = solveBehind(rearGrip(s1, {}), s1 - 0.1, ROPE[2]);
    return [s0, s1, s2];
  }
  const LAG = [0, 0.1, 0.2];                      // the humans react one after another
  const FREE = (i) => {
    const d = LAG[i];
    return [[C.cut, 0], [C.cut + 0.12 + d * 0.5, -0.12], [C.sit + d, -0.42 + 0.04 * i], [C.getup + d, -0.42 + 0.04 * i], [C.run + d, -0.3], [C.run + d + 0.4, 0.08]];
  };
  // where each plants their feet for the throw: just short of where the rope will hold them once it is taut again,
  // so the snap is a small jolt forward
  const RETAUT = [C.catch + 0.2, C.catch + 0.36, C.catch + 0.52];
  const RT_END = RETAUT[2] + 0.55;
  const PLANT_T = [C.plant, C.plant + 0.1, C.plant + 0.2];
  const PLANT_BACK = [0.85, 0.75, 0.65];
  let PLANT_S = null;
  function humanFreeS(t, i) {
    if (!PLANT_S) PLANT_S = tautHumans(claudeS(RT_END)).map((s, k) => s - PLANT_BACK[k]);
    const sCut = tautHumans(claudeS(C.cut))[i];
    const keys = FREE(i), k0 = keys[keys.length - 1];
    if (t <= k0[0]) return sCut + U.skeys(keys, t);
    const sA = sCut + k0[1];
    const sB = PLANT_S[i];
    const tStop = PLANT_T[i];
    if (t <= tStop) {
      const u = (t - k0[0]) / (tStop - k0[0]);
      const v0 = (k0[1] - keys[keys.length - 2][1]) / (k0[0] - keys[keys.length - 2][0]) * (tStop - k0[0]);
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u;
      return h00 * sA + h10 * v0 + h01 * sB;
    }
    return sB;
  }
  function humanS(t, i) {
    t = U.wrap(t, D); const k = 0;
    if (t < C.cut || t >= RT_END) { const tw = t; return tautHumans(claudeS(tw))[i]; }
    if (t < RETAUT[i]) return humanFreeS(t, i) + k;
    const sT = tautHumans(claudeS(t))[i], sF = humanFreeS(t, i);
    return U.lerp(sF, sT, U.smooth(RETAUT[i], RT_END, t));
  }
  // unwrapped (continuous across loops) path position: + one module of path per loop
  const humanSU = (t, i) => humanS(t, i) + Math.floor(t / D) * ST.L;
  function humanMode(t, i) {
    t = U.wrap(t, D); const d = LAG[i];
    if (t < C.cut || t >= RT_END) return 'taut';
    if (t < C.sit + d) return 'fall';
    if (t < C.getup + d) return 'sit';
    if (t < C.run + d) return 'getup';
    if (t < PLANT_T[i] - 0.12) return 'run';
    if (t < RETAUT[i]) return 'brace';
    return 'taut';
  }

  // ---- the crumble front: blocks drop away behind the last human. Block J starts to crack when the front passes it.
  // The front is the minimum of the tail's step coordinate over the next 8 s (so nobody ever needs a crumbled block,
  // even after tumbling back), minus a margin; it never moves back.
  const TAILU = (t) => ST.uOfS(humanSU(t, 2) - 0.5);
  const CF_N = 2000, CF_W = 8, CF = new Float64Array(CF_N + 1);
  (function () {
    const n = Math.round(CF_N * (D + CF_W) / D), arr = new Float64Array(n + 1), w = Math.round(CF_N * CF_W / D);
    for (let i = 0; i <= n; i++) arr[i] = TAILU((i / CF_N) * D);
    for (let i = 0; i <= CF_N; i++) { let m = Infinity; for (let k = i; k <= i + w; k++) m = Math.min(m, arr[k]); CF[i] = m - 0.35; }
    for (let i = 1; i <= CF_N; i++) CF[i] = Math.max(CF[i], CF[i - 1]);
  })();
  function crumbleFront(t) { const w = Math.floor(t / D), x = t - w * D, fi = (x / D) * CF_N, i = Math.min(CF_N - 1, Math.floor(fi)); return U.lerp(CF[i], CF[i + 1], fi - i) + w * N; }
  // the time block J starts to crack (front crosses J + 0.5)
  function crumbleTime(J) {
    let lo = landTime(J), hi = lo + 3 * D;
    for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (crumbleFront(m) < J + 0.5) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  const CRACK = 0.45;                             // shaking before the pieces drop
  const solidAt = (J, t) => t >= landTime(J) && t < crumbleTime(J);    // safe to stand on

  // ---- the antenna module's glow: dim baseline g0; jumps when the new module goes in; decays back by loop end
  function upgradeGlow(t) {
    t = U.wrap(t, D);
    const g0 = 0.35;
    if (t < C.glowUp) return g0 * (1 - 0.0 * t);
    const a = t - C.glowUp;
    const peak = 1.0 + 1.6 * Math.exp(-a / 0.5);  // bright flare, then a long settle
    const settle = U.smooth(0, D - C.glowUp - 0.5, a);
    return U.lerp(peak, g0, settle) * U.smooth(0, 0.25, a) + g0 * (1 - U.smooth(0, 0.25, a));
  }

  // ---- the camera: a smoothed follow of the action (Claude, the build slot and the lead human), so it rises with
  // the climb; tabulated over one loop, periodic with exactly one module of rise per loop.
  const CAM_N = 2000, CAM = { x: new Float64Array(CAM_N + 1), y: new Float64Array(CAM_N + 1), z: new Float64Array(CAM_N + 1) };
  (function () {
    const raw = (t) => {
      const sC = claudeS(t), p = ST.pathXZ(sC, {}), uC = claudeU(t);
      const b = ST.blockTop(builtIdx(t) + 1, {});
      const sh = humanSU(t, 0), ph = ST.pathXZ(sh, {}), uh = ST.uOfS(sh);
      return { x: 0.55 * p.x + 0.25 * b.x + 0.2 * ph.x, y: 0.62 * uC * ST.h + 0.25 * b.y + 0.13 * uh * ST.h, z: 0.55 * p.z + 0.25 * b.z + 0.2 * ph.z };
    };
    const M = 3 * CAM_N, xs = new Float64Array(M), ys = new Float64Array(M), zs = new Float64Array(M);
    for (let i = 0; i < M; i++) { const t = ((i - CAM_N) / CAM_N) * D, r = raw(t); xs[i] = r.x; ys[i] = r.y; zs[i] = r.z; }
    const sig = 1.1 / D * CAM_N, R = Math.ceil(sig * 3.5), w = [];
    let ws = 0; for (let k = -R; k <= R; k++) { const v = Math.exp(-0.5 * (k / sig) ** 2); w.push(v); ws += v; }
    for (let i = 0; i <= CAM_N; i++) {
      let ax = 0, ay = 0, az = 0;
      for (let k = -R; k <= R; k++) { const j = i + CAM_N + k, ww = w[k + R] / ws; ax += xs[j] * ww; ay += ys[j] * ww; az += zs[j] * ww; }
      CAM.x[i] = ax; CAM.y[i] = ay; CAM.z[i] = az;
    }
    // exact periodicity of the table ends (sampling error only): end = start + one module
    CAM.x[CAM_N] = CAM.x[0]; CAM.z[CAM_N] = CAM.z[0]; CAM.y[CAM_N] = CAM.y[0] + ST.H;
  })();
  const CAMP = { dist: 13.5, below: 0.15, yaw: 0.0, fov: 34, lookUp: 0.6 };
  function camera(t) {
    const w = Math.floor(t / D), x = t - w * D, fi = (x / D) * CAM_N, i = Math.min(CAM_N - 1, Math.floor(fi)), f = fi - i;
    const tx = U.lerp(CAM.x[i], CAM.x[i + 1], f), ty = U.lerp(CAM.y[i], CAM.y[i + 1], f) + w * ST.H, tz = U.lerp(CAM.z[i], CAM.z[i + 1], f);
    const yaw = CAMP.yaw;
    const px = tx + Math.sin(yaw) * CAMP.dist, pz = tz + Math.cos(yaw) * CAMP.dist, py = ty - CAMP.below;
    return { pos: { x: px, y: py, z: pz }, look: { x: tx, y: ty + CAMP.lookUp, z: tz }, fov: CAMP.fov };
  }

  S.choreo = {
    C, J0, D, claudeU, claudeS, claudeRel, landTime, builtIdx, buildDur, isJit, JIT_J, swingStartU, contactU, timeAtU,
    ROPE, TAIL, dragFootY, feetHeightDragged, gripDragged, rearGrip, waistApprox, tautHumans, humanS, humanSU, humanMode,
    RETAUT, RT_END, LAG, PLANT_T, crumbleFront, crumbleTime, CRACK, solidAt, upgradeGlow, camera, CAMP,
  };
})();
