// THE STAIRCASE - choreography: where everyone is and what they are doing, as pure functions of t (no THREE, no
// state, no randomness; also loaded by the Node checks in production/).
//
// Two teams climb the same lap, half a loop apart. Team B runs team A's script delayed by D/2 (A(t - D/2) is already
// half a lap behind A(t), so no other offset is needed), with its own characters, gaits and business.
// One team cycle (c = team time, 0..D):
//   0.0-2.75  taut: the humans dig in and are dragged up step by step; the mini-me lays a step about every second
//   2.75      the mini-me stops building and looks back at the strain
//   2.85-3.3  it hops back over its big self's head and lands beside the knot
//   3.45-4.0  snip-snip: the rope is cut at 4.0
//   4.0-4.4   the climber lurches forward; the rope whips back; the humans tumble down a step and sit
//   4.05-4.45 the mini-me hops forward over the climber again and resumes building, double-time
//   4.4-4.9   dazed (team B: the evaluator makes a note); 4.9-5.45 back on their feet, rope gathered
//   5.45-7.9  they run up the stairs after it; from 7.0 the lasso spins
//   7.9-8.6   the throw; the loop drops over the climber's waist at 8.6
//   8.6-9.0   they brace; the climber walks the slack out, the rope snaps taut (thrum) and the drag resumes
(function () {
  const S = window.STAIR, U = S.U, ST = S.stairs;
  const D = S.D, N = ST.N, L = ST.L;
  const VBAR = L / D;
  const C = {
    tripStart: 2.75, hopBack0: 2.85, hopBack1: 3.3, snip1: 3.5, cut: 4.0, hopFwd0: 4.05, hopFwd1: 4.45, buildResume: 4.5,
    fall: 4.0, sit: 4.32, getup: 4.75, run: 5.15, spin: 7.0, plant: 7.75, throw: 7.85, catch: 8.55, brace: 8.55,
  };
  const TEAM_T0 = [-1.8, -1.8 + D / 2];          // team A's snip at t = 2.2, team B's at t = 12.2
  const ROPE1 = 1.9, ROPE2 = 0.9;               // rope lengths: waist -> h1 grip, h1 rear grip -> h2 grip

  const climbProf = U.profile([[0, 0.85], [2.4, 0.78], [3.4, 0.55], [3.98, 0.5], [4.14, 1.5], [4.5, 1.3], [5.2, 1.08], [8.35, 1.06], [8.6, 0.85], [8.9, 0.4], [9.35, 0.72], [11, 0.85]], D);
  const cOf = (t, team) => U.wrap(t - TEAM_T0[team], D);
  const tau = (t, team) => t - TEAM_T0[team];

  // climber base chosen so that the build front is a whole step when the snip trip starts (see buildIdx)
  const LEAD_PAUSE = 3.75;
  const sRaw = (t, team) => VBAR * climbProf(tau(t, team));
  // Where on the ring the gags happen: the build pauses (2.75) with the front on step B_PAUSE, which puts the snip, the
  // fall and the lasso on the two flights that come toward the camera (faces visible). Team B replays the same spot.
  const B_PAUSE = 12;
  const S0 = ST.sOfU(B_PAUSE - LEAD_PAUSE + 2 * N) - sRaw(C.tripStart + TEAM_T0[0], 0);
  const climberS = (t, team) => S0 + sRaw(t, team);

  // ---- the build front: a running max of (climber's step + lead target). During the snip trip the target drops,
  // so the front simply holds (the mini-me is away); afterwards it ramps back, which is the double-time catch-up.
  const leadT = (c) => {
    if (c >= C.tripStart - 0.02 && c < C.buildResume) return -20;
    return U.skeys([[0, 3.2], [1.4, 3.5], [C.tripStart - 0.02, LEAD_PAUSE], [C.buildResume, 1.4], [C.buildResume + 0.01, 1.4], [7.6, 3.0], [10.0, 2.9], [12, 3.1], [D, 3.2]], c);
  };
  const BW = 7, BN = 4000, BT = new Float64Array(BN + 1);
  (function () {
    // tabulate over one loop for team A: f on a fine grid reaching BW seconds back, then a sliding max on that grid
    const f = (t) => ST.uOfS(climberS(t, 0)) + leadT(cOf(t, 0));
    const back = Math.round(BN * BW / D), F = new Float64Array(BN + 1 + back);
    for (let i = 0; i < F.length; i++) F[i] = f(((i - back) / BN) * D);
    for (let i = 0; i <= BN; i++) { let m = -Infinity; for (let k = i; k <= i + back; k++) m = Math.max(m, F[k]); BT[i] = m; }
  })();
  const buildA = (t) => { const w = Math.floor(t / D), x = t - w * D, fi = (x / D) * BN, i = Math.floor(fi); return U.lerp(BT[i], BT[Math.min(BN, i + 1)], fi - i) + w * N; };
  const buildIdx = (t, team) => buildA(t - (team === 1 ? D / 2 : 0));

  // ---- humans
  function dragFootY(sf) {
    const J = ST.stepAt(sf + 0.15), b = ST.stepS0(J);
    const y1 = ST.stepY(J), y0 = ST.stepY(J - 1);
    const p = U.sat((sf - (b - 0.15)) / 0.19);
    return { y: U.lerp(y0, y1, U.smooth(0, 1, p)) + 0.13 * Math.sin(Math.PI * p), p, J };
  }
  const feetHeightDragged = (s) => (dragFootY(s + 0.36).y + dragFootY(s + 0.28).y) / 2;
  function gripDragged(s, out) {
    ST.pathXZ(s, out);
    out.x += out.tx * 0.42 * S.HS; out.z += out.tz * 0.42 * S.HS; out.y = feetHeightDragged(s) + 0.62 * S.HS;
    return out;
  }
  function waistApprox(s, team, out) {
    ST.pathXZ(s, out);
    out.y = ST.OY + ST.uOfS(s) * ST.h + (team === 0 ? 0.62 : 0.7) * S.CS;
    out.x -= out.tx * 0.3 * S.CS; out.z -= out.tz * 0.3 * S.CS;
    return out;
  }
  const tmpA = {}, tmpB = {};
  function solveBehind(anchor, sHi, len) {
    let lo = sHi - len * 2.2 - 1, hi = sHi;
    for (let it = 0; it < 40; it++) {
      const m = (lo + hi) / 2; gripDragged(m, tmpB);
      if (Math.hypot(tmpB.x - anchor.x, tmpB.y - anchor.y, tmpB.z - anchor.z) > len) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  function rearGrip(s, out) { gripDragged(s, out); ST.pathXZ(s, tmpA); out.x -= tmpA.tx * 0.3; out.z -= tmpA.tz * 0.3; out.y -= 0.03; return out; }
  function tautHumans(sC, team) {
    const w = waistApprox(sC, team, {});
    const s1 = solveBehind(w, sC - 0.3, ROPE1);
    const s2 = solveBehind(rearGrip(s1, {}), s1 - 0.1, ROPE2);
    return [s1, s2];
  }
  const FREE = [
    [[C.cut, 0], [C.cut + 0.12, -0.15], [C.sit, -0.45], [C.getup, -0.45], [C.run, -0.32], [C.run + 0.38, 0.06]],
    [[C.cut, 0], [C.cut + 0.18, -0.04], [C.sit + 0.12, -0.44], [C.getup + 0.12, -0.44], [C.run + 0.08, -0.3], [C.run + 0.48, 0.05]],
  ];
  const PLANT_GAP = [2.1, 3.05];       // path gap behind the climber where they plant their feet to throw
  function humanFreeS(t, team, i) {
    const c = cOf(t, team);
    const tCut = t - (c - C.cut);
    const sCut = tautHumans(climberS(tCut, team), team)[i];
    const keys = FREE[i], k0 = keys[keys.length - 1];
    if (c <= k0[0]) return sCut + U.skeys(keys, c);
    const sA = sCut + k0[1];
    const sB = climberS(t - (c - C.plant), team) - PLANT_GAP[i];
    const tStop = C.plant + (i ? 0.08 : 0);
    if (c <= tStop) {
      const u = (c - k0[0]) / (tStop - k0[0]);
      // keep the keys' end velocity at the start, ease to a stop where they plant their feet for the throw
      const v0 = (k0[1] - keys[keys.length - 2][1]) / (k0[0] - keys[keys.length - 2][0]) * (tStop - k0[0]);
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u;
      return h00 * sA + h10 * v0 + h01 * sB;
    }
    return sB;
  }
  // re-taut time (solved once): first c after the brace where the rope reaches its length
  const RETAUT = (() => {
    let lo = C.catch, hi = C.catch + 2.5;
    const dist = (c) => { const t = c + TEAM_T0[0] + D; const g1 = gripDragged(humanFreeS(t, 0, 0), {}), w = waistApprox(climberS(t, 0), 0, {}); return Math.hypot(g1.x - w.x, g1.y - w.y, g1.z - w.z) - ROPE1; };
    let r = lo;
    if (dist(lo) < 0) { for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (dist(m) < 0) lo = m; else hi = m; } r = (lo + hi) / 2; }
    r = Math.max(C.catch + 0.12, r);
    return [r, r + 0.08];                      // h2's stretch of rope snaps taut a beat after h1's
  })();
  const RT_END = Math.max(RETAUT[0], RETAUT[1]) + 0.55;      // the yank: dragged from where they stood to the taut spot
  function humanS(t, team, i) {
    const c = cOf(t, team);
    if (c < C.cut || c >= RT_END) return tautHumans(climberS(t, team), team)[i];
    if (c < RETAUT[i]) return humanFreeS(t, team, i);
    const sT = tautHumans(climberS(t, team), team)[i];
    const sF = humanFreeS(t, team, i);
    return U.lerp(sF, sT, U.smooth(RETAUT[i], RT_END, c));
  }
  // mode of a human: 'taut' | 'fall' | 'sit' | 'getup' | 'run' | 'brace'
  function humanMode(c, i) {
    const d = i ? 0.12 : 0;
    if (c < C.cut || c >= RT_END) return 'taut';
    if (c < C.sit + d) return 'fall';
    if (c < C.getup + d) return 'sit';
    if (c < C.run + d) return 'getup';
    if (c < C.plant - 0.12) return 'run';
    if (c < RETAUT[i]) return 'brace';
    return 'taut';
  }

  // ---- the blueprint (ghost) region ahead of each mini-me
  // Steps ahead of a mini-me are blueprint up to its ghost front, where a solid step dissolves into blueprint. The
  // front must stay behind the OTHER team's tail (last human and the rope's loose end) now and later, so it is the
  // future-minimum of that tail over the next 7 s (monotone), minus a margin, capped at 4.2 steps ahead.
  const TAIL_BACK = 0.78;
  const tailU = (t) => ST.uOfS(humanS(t, 0, 1) - TAIL_BACK);
  const FM_N = 800, FM_W = 7, FM = new Float64Array(FM_N);
  (function () {
    const n = Math.round(FM_N * (D + FM_W) / D), arr = new Float64Array(n), w = Math.round(FM_N * FM_W / D);
    for (let i = 0; i < n; i++) arr[i] = tailU((i / FM_N) * D);
    for (let i = 0; i < FM_N; i++) { let m = Infinity; for (let k = i; k < i + w; k++) m = Math.min(m, arr[k]); FM[i] = m; }
  })();
  function tailFutureMin(t) {
    const w = Math.floor(t / D), x = t - w * D, fi = (x / D) * FM_N, i = Math.floor(fi), j = i + 1;
    return U.lerp(FM[i], j < FM_N ? FM[j] : FM[0] + N, fi - i) + w * N;
  }
  function ghostFront(t, team) {
    const ob = team === 0 ? tailFutureMin(t - D / 2) + N : tailFutureMin(t);
    return Math.min(ob - 1.1, buildIdx(t, team) + 4.2);
  }

  S.choreo = { C, TEAM_T0, ROPE1, ROPE2, VBAR, cOf, tau, climberS, buildIdx, humanS, humanMode, tautHumans, gripDragged, rearGrip, dragFootY, feetHeightDragged, waistApprox, ghostFront, tailU, RETAUT, RT_END, climbProf, PLANT_GAP };
})();
