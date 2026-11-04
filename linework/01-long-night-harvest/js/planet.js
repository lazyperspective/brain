/* The ringed planet: latitude-band engraving, storm, ring shadow, rings in two halves. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC, P = LW.P, PL = SC.planet;
  const R = PL.R, E1 = PL.E1, E2 = PL.E2, NN = PL.N, L = PL.L;
  const LN = L[0] * NN[0] + L[1] * NN[1] + L[2] * NN[2];

  function ringD(rr) {
    if (rr < 1.22 || rr > 2.32) return 0;
    const s = LW.smooth;
    const fine = 0.5 + 0.5 * LW.N3(rr * 55, 0.3);
    const fine2 = 0.5 + 0.5 * LW.N1(rr * 140, 2.1);
    let d = 0;
    d += (0.16 + 0.12 * fine) * s(1.22, 1.26, rr) * (1 - s(1.5, 1.53, rr));                       // C
    d += (0.62 + 0.25 * fine + 0.13 * fine2) * s(1.5, 1.54, rr) * (1 - s(1.93, 1.955, rr));         // B
    d += (0.5 + 0.14 * fine + 0.1 * fine2) * s(2.02, 2.04, rr) * (1 - s(2.22, 2.24, rr));          // A
    d *= 1 - 0.9 * Math.exp(-(((rr - 2.155) / 0.006) ** 2));                                      // Encke
    d += 0.42 * Math.exp(-(((rr - 2.29) / 0.006) ** 2));                                           // F
    return d;
  }
  LW.ringD = ringD;
  const RIN = 1.22, ROUT = 2.31;

  function ringPoint(rho, t) {
    const c = Math.cos(t), s = Math.sin(t);
    return [rho * (c * E1[0] + s * E2[0]), rho * (c * E1[1] + s * E2[1]), rho * (c * E1[2] + s * E2[2])];
  }
  function planetShadowOnRing(Q) {
    const qd = Q[0] * L[0] + Q[1] * L[1] + Q[2] * L[2];
    if (qd >= 0) return 1;
    const q2 = Q[0] * Q[0] + Q[1] * Q[1] + Q[2] * Q[2] - qd * qd;
    if (q2 < (R * 0.985) ** 2) return 0.12;
    if (q2 < (R * 1.02) ** 2) return 0.5;
    return 1;
  }

  // ---------------------------------------------------------------- rings
  function ringFillPath(t0, t1) {
    const path = new Path2D();
    const bands = [[1.5, 1.94], [2.03, 2.235]];
    for (const [a, b] of bands) {
      const pts = [];
      const n = 260;
      for (let i = 0; i <= n; i++) { const q = ringPoint(b * R, t0 + ((t1 - t0) * i) / n); pts.push(PL.x + q[0], PL.y + q[1]); }
      for (let i = n; i >= 0; i--) { const q = ringPoint(a * R, t0 + ((t1 - t0) * i) / n); pts.push(PL.x + q[0], PL.y + q[1]); }
      LW.polyPath(path, pts, true);
    }
    return path;
  }

  LW.drawRings = function (ctx, half) {
    const front = half === 'front';
    const t0 = front ? -0.012 : Math.PI - 0.012, t1 = front ? Math.PI + 0.012 : 2 * Math.PI + 0.012;
    ctx.fillStyle = '#0d1828';
    LW.offset(ctx, LW.REG.cool, () => ctx.fill(ringFillPath(t0 - 0.002, t1 + 0.002)));
    const rng = new LW.RNG('rings-' + half);
    const fill = new LW.FillBatch();
    const sun = [SC.sun.x - PL.x, SC.sun.y - PL.y];
    const sl = Math.hypot(sun[0], sun[1]);
    for (let rr = RIN; rr <= ROUT; rr += 3.3 / R) {
      const D0 = ringD(rr);
      if (D0 < 0.04) continue;
      const rho = rr * R;
      const dt = 2.4 / rho;
      const pts = [];
      for (let t = t0; t <= t1; t += dt) { const q = ringPoint(rho, t); pts.push(PL.x + q[0], PL.y + q[1]); }
      LW.dashes(pts, rng, 60, 420, 1.5, 7, (sub) => {
        const n = sub.length >> 1, mi = (n >> 1) * 2;
        const mx = sub[mi] - PL.x, my = sub[mi + 1] - PL.y;
        // recover t for 3D tests
        const u = mx * PL.ct + my * PL.st, v = -mx * PL.st + my * PL.ct;
        const t = Math.atan2(v / PL.sphi, u);
        const Q = ringPoint(rho, t);
        const sh = planetShadowOnRing(Q);
        const ml = Math.hypot(mx, my) || 1;
        const towardSun = (mx * sun[0] + my * sun[1]) / (ml * sl);
        const g = SC.glow(sub[mi], sub[mi + 1]);
        const lit = (0.5 + 0.5 * Math.max(0, towardSun)) * sh;
        const v2 = D0 * lit * (0.85 + 0.3 * rng.next());
        const warm = (towardSun > 0.55 ? (towardSun - 0.55) * 1.6 : 0) + g * 0.9;
        let col;
        if (sh < 0.3) col = v2 > 0.06 ? P.deep : '#16303d';
        else if (warm > 0.55 && v2 > 0.3) col = v2 > 0.62 ? P.straw : v2 > 0.42 ? P.amber : P.orange;
        else if (v2 > 0.62) col = P.cream;
        else if (v2 > 0.48) col = P.mist;
        else if (v2 > 0.36) col = P.pale;
        else if (v2 > 0.24) col = P.sea;
        else if (v2 > 0.13) col = P.teal;
        else col = P.deep;
        const wseed = rng.next() * 50;
        LW.ribbon(fill.p(col), sub, (tt, i, x, y) => {
          const w = 0.35 + 1.25 * D0 * (sh < 0.3 ? 0.4 : 1) * (0.8 + 0.4 * LW.N2(x * 0.03 + wseed, y * 0.03));
          return w * LW.taper(tt, 0.1, 0.1);
        });
      });
    }
    fill.flush(ctx, ['#16303d', P.deep, P.teal, P.sea, P.pale, P.mist, P.amber, P.straw, P.cream]);
    // ink edges
    const ink = new Path2D();
    for (const rr of [1.5, 1.94, 2.03, 2.235]) {
      const pts = [];
      for (let t = t0; t <= t1 + 1e-6; t += 2 / (rr * R)) { const q = ringPoint(rr * R, t); pts.push(PL.x + q[0], PL.y + q[1]); }
      LW.ribbon(ink, LW.wobble(pts, 0.6, 0.04, rr * 10), (tt, i, x, y) => (rr === 2.235 ? 1.3 : 0.8) * (0.7 + 0.5 * LW.N1(x * 0.02, y * 0.02)) * LW.taper(tt, 0.02, 0.02));
    }
    ctx.fillStyle = P.ink;
    ctx.fill(ink);
  };

  // ---------------------------------------------------------------- planet body
  function ringShadowOnPlanet(p) {
    const pn = p[0] * NN[0] + p[1] * NN[1] + p[2] * NN[2];
    const s = -pn / LN;
    if (s <= 0) return 1;
    const q = [p[0] + s * L[0], p[1] + s * L[1], p[2] + s * L[2]];
    const rr = Math.hypot(q[0], q[1], q[2]) / R;
    const D = ringD(rr);
    return 1 - 0.88 * Math.min(1, D * 1.35);
  }
  function sphere(sb, t) {
    const cb = Math.sqrt(Math.max(0, 1 - sb * sb));
    const c = Math.cos(t), s = Math.sin(t);
    return [
      R * (cb * (c * E1[0] + s * E2[0]) + sb * NN[0]),
      R * (cb * (c * E1[1] + s * E2[1]) + sb * NN[1]),
      R * (cb * (c * E1[2] + s * E2[2]) + sb * NN[2]),
    ];
  }
  function lightAt(p) {
    const lam = (p[0] * L[0] + p[1] * L[1] + p[2] * L[2]) / R;
    const base = LW.smooth(-0.08, 0.75, lam);
    return base * ringShadowOnPlanet(p);
  }
  function bandMod(sb) {
    return 0.78 + 0.32 * LW.N3(sb * 7.5, 0.5) + 0.12 * LW.N1(sb * 31, 1.5);
  }
  function planetInk(v, r, sb) {
    const warmBand = LW.N2(sb * 6, 9.1) > 0.25;
    v += (r - 0.5) * 0.06;
    if (v > 0.8) return warmBand ? P.straw : P.cream;
    if (v > 0.62) return warmBand ? P.amber : P.straw;
    if (v > 0.4) return P.amber;
    if (v > 0.31) return warmBand ? P.orange : P.amber;
    if (v > 0.24) return P.rust;
    if (v > 0.17) return P.sea;
    if (v > 0.1) return P.teal;
    return P.deep;
  }
  // storm in (t, sb) parameter space
  const STORM = { t: 2.55, sb: -0.07, rt: 0.27, rs: 0.085 };

  LW.drawPlanet = function (ctx) {
    // base disc
    ctx.fillStyle = '#0e1a2a';
    ctx.beginPath(); ctx.arc(PL.x, PL.y, R + 0.5, 0, Math.PI * 2); ctx.fill();
    const rng = new LW.RNG('planet');
    const fill = new LW.FillBatch();
    const NL = 122;
    function emit(pts, sbForCol) {
      LW.dashes(pts, rng, 90, 520, 1.5, 6, (sub) => {
        const n = sub.length >> 1, mi = (n >> 1) * 2;
        const lx = sub[mi] - PL.x, ly = sub[mi + 1] - PL.y;
        const z = Math.sqrt(Math.max(0, R * R - lx * lx - ly * ly));
        const v = lightAt([lx, ly, z]) * bandMod(sbForCol);
        const col = planetInk(v, rng.next(), sbForCol);
        const wseed = rng.next() * 40;
        LW.ribbon(fill.p(col), sub, (tt, i, x, y) => {
          const ax = x - PL.x, ay = y - PL.y;
          const zz = Math.sqrt(Math.max(0, R * R - ax * ax - ay * ay));
          const vv = lightAt([ax, ay, zz]) * bandMod(sbForCol);
          const limb = LW.smooth(0, 0.25, zz / R);
          const w = (0.45 + 2.75 * Math.pow(Math.max(0, vv), 0.85)) * (0.75 + 0.25 * limb) * (0.85 + 0.3 * LW.N2(x * 0.025 + wseed, y * 0.025));
          return w * LW.taper(tt, 0.08, 0.08);
        });
      });
    }
    for (let i = 0; i < NL; i++) {
      const sb0 = -0.985 + (1.97 * (i + 0.5)) / NL;
      let run = [];
      const cb = Math.sqrt(1 - sb0 * sb0);
      const dt = 2.2 / (R * cb);
      for (let t = 0; t <= Math.PI * 2 + dt; t += dt) {
        let sb = sb0 + 0.012 * LW.N1(t * 1.1, sb0 * 2.6) + 0.002 * LW.N2(t * 3.2, sb0 * 9);
        // storm deflection
        let du = t - STORM.t; du = Math.atan2(Math.sin(du), Math.cos(du));
        const dv = sb - STORM.sb;
        const bump = Math.max(0, 1 - (du / (STORM.rt * 1.6)) ** 2);
        if (bump > 0 && Math.abs(dv) < STORM.rs * 3) {
          const sgn = dv >= 0 ? 1 : -1;
          const k = Math.pow(bump, 1.4) * (1 - LW.smooth(STORM.rs * 1.5, STORM.rs * 3, Math.abs(dv)));
          sb = STORM.sb + sgn * Math.sqrt(dv * dv + (STORM.rs * 1.05) ** 2 * k);
        }
        const p = sphere(sb, t);
        if (p[2] > 1) run.push(PL.x + p[0], PL.y + p[1]);
        else if (run.length) { if (run.length > 6) emit(run, sb0); run = []; }
      }
      if (run.length > 6) emit(run, sb0);
    }
    // storm interior: concentric spiralling loops
    for (let j = 1; j <= 9; j++) {
      const s = j / 9.6;
      const pts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.035) {
        const sp = s * (1 - 0.06 * a / 6.28);
        const t = STORM.t + Math.cos(a) * STORM.rt * sp;
        const sb = STORM.sb + Math.sin(a) * STORM.rs * sp;
        const p = sphere(sb, t);
        if (p[2] > 1) pts.push(PL.x + p[0], PL.y + p[1]);
      }
      if (pts.length > 6) emit(pts, STORM.sb + 0.04);
    }
    fill.flush(ctx, [P.deep, P.teal, P.sea, P.orange, P.amber, P.straw, P.cream]);

    // atmosphere: arcs hugging the lit limb
    const halo = new LW.FillBatch();
    const hcols = [P.straw, P.amber, P.orange, P.rust, P.teal];
    for (let k = 0; k < 5; k++) {
      const rad = R + 5 + k * 7;
      const pts = [];
      for (let a = 0; a <= Math.PI * 2; a += 1.5 / rad) {
        const nl = Math.cos(a) * L[0] + Math.sin(a) * L[1];
        if (nl > 0.12 + k * 0.07) pts.push(PL.x + Math.cos(a) * rad, PL.y + Math.sin(a) * rad);
        else if (pts.length) break;
      }
      if (pts.length < 4) continue;
      LW.dashes(pts, rng, 80, 400, 3, 10, (sub) => {
        LW.ribbon(halo.p(hcols[k]), sub, (tt, i, x, y) => {
          const a = Math.atan2(y - PL.y, x - PL.x);
          const nl = Math.cos(a) * L[0] + Math.sin(a) * L[1];
          return (2.4 - k * 0.38) * LW.smooth(0.1 + k * 0.07, 0.6, nl) * LW.taper(tt, 0.1, 0.1);
        });
      });
    }
    halo.flush(ctx, hcols.slice().reverse());

    // limb ink: heavier on the shadow side
    const limb = [];
    for (let a = 0; a < Math.PI * 2; a += 1.4 / R) limb.push(PL.x + Math.cos(a) * R, PL.y + Math.sin(a) * R);
    const ink = new Path2D();
    LW.ribbonClosed(ink, LW.wobble(limb, 0.7, 0.03, 3, true), (t, i, x, y) => {
      const a = Math.atan2(y - PL.y, x - PL.x);
      const nl = Math.cos(a) * L[0] + Math.sin(a) * L[1];
      return (1.0 + 1.9 * LW.smooth(0.3, -0.4, nl)) * (0.8 + 0.35 * LW.N2(x * 0.02, y * 0.02));
    });
    ctx.fillStyle = P.ink;
    ctx.fill(ink);
  };
})();
