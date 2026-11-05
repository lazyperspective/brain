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
    const bands = [[1.235, 1.5], [1.5, 1.94], [2.03, 2.235]];
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
    // light-matched under-plate: wedges coloured one step below the strokes, so no dark stitches show in the glow
    {
      const sunv = [SC.sun.x - PL.x, SC.sun.y - PL.y], sl0 = Math.hypot(sunv[0], sunv[1]);
      const under = new LW.FillBatch();
      const NW = 420;
      for (const [a, b] of [[1.235, 1.5], [1.5, 1.94], [2.03, 2.235]]) {
        const cRing = a < 1.3;
        for (let k = 0; k < NW; k++) {
          const ta = t0 + ((t1 - t0) * k) / NW, tb = t0 + ((t1 - t0) * (k + 1.15)) / NW, tm = (ta + tb) / 2;
          const qm = ringPoint(((a + b) / 2) * R, tm);
          const mx = qm[0], my = qm[1], ml = Math.hypot(mx, my) || 1;
          const towardSun = (mx * sunv[0] + my * sunv[1]) / (ml * sl0);
          const g = SC.glow(PL.x + mx, PL.y + my);
          const sh = planetShadowOnRing(qm);
          const warm = (towardSun > 0.55 ? (towardSun - 0.55) * 1.6 : 0) + g * 0.9;
          const v = (cRing ? 0.42 : 0.6) * (0.5 + 0.5 * Math.max(0, towardSun)) * sh;
          let col = '#0d1828';
          if (sh >= 0.3) {
            if (warm > 0.55) col = v > 0.42 ? P.amber : P.orange;
            else if (v > 0.4) col = P.sea;
            else if (v > 0.25) col = P.teal;
            else col = P.deep;
          }
          const p1 = ringPoint(a * R, ta), p2 = ringPoint(b * R, ta), p3 = ringPoint(b * R, tb), p4 = ringPoint(a * R, tb);
          const q = under.p(col);
          q.moveTo(PL.x + p1[0], PL.y + p1[1]); q.lineTo(PL.x + p2[0], PL.y + p2[1]); q.lineTo(PL.x + p3[0], PL.y + p3[1]); q.lineTo(PL.x + p4[0], PL.y + p4[1]); q.closePath();
        }
      }
      ctx.save(); ctx.clip(ringFillPath(t0 - 0.002, t1 + 0.002));
      under.flush(ctx);
      ctx.restore();
    }
    const rng = new LW.RNG('rings-' + half);
    const fill = new LW.FillBatch();
    const sun = [SC.sun.x - PL.x, SC.sun.y - PL.y];
    const sl = Math.hypot(sun[0], sun[1]);
    for (let rr = RIN; rr <= ROUT; rr += 3.3 / R) {
      // ringlets of varied brightness: a per-ringlet gain on top of the density profile
      const D0 = ringD(rr);
      const gain = (0.78 + 0.44 * LW.hash2(Math.round(rr * R / 3.3), 17, 5)) * (0.9 + 0.2 * LW.N4(rr * 30, 0.7));
      if (D0 < 0.04) continue;
      const rho = rr * R;
      const dt = 2.4 / rho;
      const pts = [];
      for (let t = t0; t <= t1; t += dt) { const q = ringPoint(rho, t); pts.push(PL.x + q[0], PL.y + q[1]); }
      LW.dashes(pts, rng, 260, 900, 0.6, 2.2, (sub) => {
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
        const warm = (towardSun > 0.55 ? (towardSun - 0.55) * 1.6 : 0) + g * 0.9;
        const v2 = D0 * lit * (0.85 + 0.3 * rng.next()) * (warm > 0.55 ? 1 + (gain - 1) * 0.3 : gain);
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
          return w * LW.taper(tt, 0.03, 0.03);
        });
      });
    }
    fill.flush(ctx, ['#16303d', P.deep, P.teal, P.sea, P.pale, P.mist, P.amber, P.straw, P.cream]);
    {
      const trng = new LW.RNG('ring-tex-' + half);
      const tex = new LW.FillBatch();
      const ringLit = (rho, t) => {
        const q = ringPoint(rho, t);
        const ml = Math.hypot(q[0], q[1]) || 1;
        const ts = (q[0] * sun[0] + q[1] * sun[1]) / (ml * sl);
        const sh = planetShadowOnRing(q);
        return [PL.x + q[0], PL.y + q[1], (0.5 + 0.5 * Math.max(0, ts)) * sh, sh, ts];
      };
      // thin dark gaps between ringlets
      const gr = new LW.RNG('ring-gaps');
      const gaps = [];
      for (let i = 0; i < 22; i++) { const rr = gr.range(1.24, 2.23); if (ringD(rr) > 0.12 && Math.abs(rr - 2.155) > 0.01) gaps.push([rr, gr.range(0.55, 1.25)]); }
      for (const [rr, w] of gaps) {
        const pts = [];
        for (let t = t0; t <= t1; t += 2.2 / (rr * R)) { const q = ringPoint(rr * R, t); pts.push(PL.x + q[0], PL.y + q[1]); }
        LW.dashes(pts, trng, 120, 700, 4, 40, (sub) => {
          // gap colour: a plate below the local ring ink (black only where the ring is already dark)
          const mi = (sub.length >> 2) * 2;
          const mx = sub[mi] - PL.x, my = sub[mi + 1] - PL.y;
          const u = mx * PL.ct + my * PL.st, v = -mx * PL.st + my * PL.ct;
          const [, , lit, sh, ts] = ringLit(rr * R, Math.atan2(v / PL.sphi, u));
          const g = SC.glow(sub[mi], sub[mi + 1]);
          const warm = (ts > 0.55 ? (ts - 0.55) * 1.6 : 0) + g * 0.9;
          if (warm > 0.55 && trng.next() < 0.55) return;
          const col = sh < 0.3 ? '#070e16' : warm > 0.55 ? (lit > 0.5 ? P.amber : P.orange) : lit > 0.55 ? P.sea : lit > 0.4 ? P.teal : '#0b1520';
          LW.ribbon(tex.p(col), LW.wobble(sub, 0.4, 0.05, rr * 7), (tt) => w * (warm > 0.55 ? 0.6 : 1) * LW.taper(tt, 0.1, 0.1));
        });
      }
      // particle stipple fraying the ring edges
      for (const [er, dir] of [[1.235, -1], [1.5, 0], [1.94, 1], [2.03, -1], [2.235, 1], [2.29, 0]]) {
        const n = 2600;
        for (let i = 0; i < n; i++) {
          const t = trng.range(t0, t1);
          const off = dir === 0 ? trng.normal() * 3.5 : dir * Math.abs(trng.normal()) * 5 - dir * 1.5;
          const rho = er * R + off;
          const [x, y, lit, sh, ts] = ringLit(rho, t);
          if (sh < 0.3) { if (trng.next() < 0.5) LW.dot(tex.p('#16303d'), x, y, trng.range(0.4, 0.8)); continue; }
          const g = SC.glow(x, y);
          const warm = (ts > 0.55 ? (ts - 0.55) * 1.6 : 0) + g * 0.9;
          const v = lit * (0.55 + 0.4 * trng.next()) * (Math.abs(off) > 3 ? 0.7 : 1);
          const col = warm > 0.55 ? (v > 0.5 ? P.straw : P.amber) : v > 0.6 ? P.mist : v > 0.45 ? P.pale : v > 0.3 ? P.sea : P.teal;
          LW.dot(tex.p(col), x, y, trng.range(0.4, 0.9));
        }
      }
      // ring texture inside the planet's shadow: radial ink ticks across the ringlets, crossed by fine dust
      for (let i = 0; i < 9000; i++) {
        const t = trng.range(t0, t1), rr = trng.range(1.24, 2.24);
        if (ringD(rr) < 0.1) continue;
        const [x, y, , sh] = ringLit(rr * R, t);
        if (sh >= 0.3) continue;
        const [x2, y2] = ringLit(rr * R + trng.range(5, 10), t);
        LW.ribbon(tex.p('#070e16'), [x, y, x2, y2], (tt) => 0.65 * LW.taper(tt, 0.3, 0.3) + 0.1);
      }
      tex.flush(ctx, ['#0b1520', '#16303d', P.rust, P.orange, P.teal, P.sea, P.pale, P.mist, P.amber, P.straw, '#070e16']);
    }
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
    // smoothed density (no fine ringlets) so the shadow reads as clean bands, not ticks
    const sm = LW.smooth;
    const D = 0.22 * sm(1.22, 1.27, rr) * (1 - sm(1.48, 1.53, rr)) + 0.8 * sm(1.5, 1.55, rr) * (1 - sm(1.92, 1.96, rr)) + 0.62 * sm(2.02, 2.05, rr) * (1 - sm(2.21, 2.25, rr));
    return 1 - 0.85 * Math.min(1, (D + 0.12 * ringD(rr)) * 1.15);
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
    const base = LW.smooth(-0.02, 0.6, lam);
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
  const STORM = { t: 2.55, sb: -0.07, rt: 0.27, rs: 0.085, loops: 9, col: 0.04 };
  // band boundaries (where the warm/cool belts flip) and the small eddies, festoons and storms that ride them
  const BOUNDS = [];
  (function () {
    let prev = LW.N2(-0.99 * 6, 9.1) > 0.25;
    for (let sb = -0.99; sb <= 0.99; sb += 0.001) { const w = LW.N2(sb * 6, 9.1) > 0.25; if (w !== prev) BOUNDS.push(sb); prev = w; }
  })();
  function boundaryW(sb) { let d = 1; for (const b of BOUNDS) d = Math.min(d, Math.abs(sb - b)); return Math.exp(-((d / 0.03) ** 2)); }
  const STORMS = [STORM];
  (function () {
    const rng = new LW.RNG('eddies');
    const placed = [];
    for (let it = 0; it < 6000 && STORMS.length < 13; it++) {
      const b = BOUNDS.length ? BOUNDS[Math.floor(rng.next() * BOUNDS.length)] : 0;
      const sbx = b + rng.range(-0.018, 0.018);
      if (Math.abs(sbx) > 0.9) continue;
      const t = rng.range(0, Math.PI * 2);
      const cb = Math.sqrt(1 - sbx * sbx);
      const p = sphereRaw(sbx, t);
      if (p[2] < 0.35 * R) continue;
      const lam = (p[0] * L[0] + p[1] * L[1] + p[2] * L[2]) / R;
      if (lam < 0.05) continue;
      const sx = PL.x + p[0], sy = PL.y + p[1];
      if (placed.some((q) => Math.hypot(q[0] - sx, q[1] - sy) < 70)) continue;
      const big = rng.next() < 0.25;
      const w = (big ? rng.range(34, 52) : rng.range(18, 32));
      // eddies are sheared along the belt: long in longitude, thin in latitude, drawn as open swirls
      STORMS.push({ t, sb: sbx, rt: 1.7 * w / (R * cb), rs: (big ? 0.022 : 0.014) * cb, loops: big ? 4 : 3, col: (sbx > b ? -1 : 1) * 0.03, a0: rng.range(0, Math.PI * 2), span: rng.range(3.4, 4.6), dir: rng.next() < 0.5 ? 1 : -1 });
      placed.push([sx, sy]);
    }
  })();
  function sphereRaw(sb, t) {
    const cb = Math.sqrt(Math.max(0, 1 - sb * sb));
    const c = Math.cos(t), s = Math.sin(t);
    return [R * (cb * (c * E1[0] + s * E2[0]) + sb * NN[0]), R * (cb * (c * E1[1] + s * E2[1]) + sb * NN[1]), R * (cb * (c * E1[2] + s * E2[2]) + sb * NN[2])];
  }

  LW.drawPlanet = function (ctx) {
    // base disc
    ctx.fillStyle = '#183641';
    ctx.beginPath(); ctx.arc(PL.x, PL.y, R + 0.5, 0, Math.PI * 2); ctx.fill();
    // warm under-plate only in the most brightly lit zone, so dash gaps read as warm shadow rather than navy stitches
    {
      const S = LW.S;
      const x0 = Math.floor((PL.x - R - 2) * S), y0 = Math.floor((PL.y - R - 2) * S), w = Math.ceil((2 * R + 4) * S), h = w;
      const img = ctx.getImageData(x0, y0, w, h), d = img.data;
      const c1 = LW.hex('#5e2a22'), c2 = LW.hex('#9c4529');
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const lx = (x0 + i + 0.5) / S - PL.x, ly = (y0 + j + 0.5) / S - PL.y;
        const r2 = lx * lx + ly * ly;
        if (r2 > (R - 1.5) * (R - 1.5)) continue;
        const v = lightAt([lx, ly, Math.sqrt(R * R - r2)]) + 0.6 * SC.glow((x0 + i) / S, (y0 + j) / S);
        if (v < 0.78) continue;
        const c = v > 1.05 ? c2 : c1;
        const o = (j * w + i) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
      }
      ctx.putImageData(img, x0, y0);
    }
    const lats = [], latSb = [];
    const rng = new LW.RNG('planet');
    const fill = new LW.FillBatch();
    const NL = 196;
    function emit(pts, sbForCol) {
      LW.dashes(pts, rng, 140, 620, 0.8, 3, (sub) => {
        const r = rng.next();
        const wseed = rng.next() * 40;
        // split the dash wherever the light changes ink, so long strokes never carry the wrong colour
        const n = sub.length >> 1;
        const vals = new Float32Array(n), cols = new Array(n);
        for (let i = 0; i < n; i++) {
          const lx = sub[2 * i] - PL.x, ly = sub[2 * i + 1] - PL.y;
          const z = Math.sqrt(Math.max(0, R * R - lx * lx - ly * ly));
          vals[i] = lightAt([lx, ly, z]) * bandMod(sbForCol);
          cols[i] = vals[i] < 0.07 ? null : planetInk(vals[i], r, sbForCol);
        }
        let s0 = 0;
        for (let i = 1; i <= n; i++) {
          if (i === n || cols[i] !== cols[s0]) {
            if (cols[s0] && i - s0 >= 2) {
              const part = sub.slice(2 * s0, 2 * Math.min(n, i + 1));
              const first = s0 === 0, last = i >= n - 1;
              LW.ribbon(fill.p(cols[s0]), part, (tt, k, x, y) => {
                const ax = x - PL.x, ay = y - PL.y;
                const zz = Math.sqrt(Math.max(0, R * R - ax * ax - ay * ay));
                const vv = lightAt([ax, ay, zz]) * bandMod(sbForCol);
                const limb = LW.smooth(0, 0.25, zz / R);
                const w = (0.45 + 2.75 * Math.pow(Math.max(0, vv), 0.85)) * (0.75 + 0.25 * limb) * (0.85 + 0.3 * LW.N2(x * 0.025 + wseed, y * 0.025));
                return w * LW.taper(tt, first ? 0.08 : 0.001, last ? 0.08 : 0.001);
              });
            }
            s0 = i;
          }
        }
      });
    }
    for (let i = 0; i < NL; i++) {
      const sb0 = Math.sin(-Math.PI / 2 + (Math.PI * (i + 0.5)) / NL);
      let run = [];
      const cb = Math.sqrt(1 - sb0 * sb0);
      const dt = Math.min(0.05, 2.2 / (R * cb));
      const bw0 = boundaryW(sb0);
      for (let t = 0; t <= Math.PI * 2 + dt; t += dt) {
        let sb = sb0 + 0.0045 * LW.N1(t * 0.9, sb0 * 2.2);
        // turbulent band edges: lines near a belt boundary wander and curl
        if (bw0 > 0.02) sb += bw0 * (0.0065 * LW.N1(t * 4.2 + sb0 * 3, sb0 * 30) + 0.0018 * LW.N3(t * 11, sb0 * 60));
        // storm deflection
        for (const ST of STORMS) {
          let du = t - ST.t; du = Math.atan2(Math.sin(du), Math.cos(du));
          const dv = sb - ST.sb;
          const bump = Math.max(0, 1 - (du / (ST.rt * 1.6)) ** 2);
          if (bump > 0 && Math.abs(dv) < ST.rs * 3) {
            const sgn = dv >= 0 ? 1 : -1;
            const k = Math.pow(bump, 1.4) * (1 - LW.smooth(ST.rs * 1.5, ST.rs * 3, Math.abs(dv)));
            sb = ST.sb + sgn * Math.sqrt(dv * dv + (ST.rs * 1.05) ** 2 * k);
          }
        }
        const p = sphere(sb, t);
        if (p[2] > 1) run.push(PL.x + p[0], PL.y + p[1]);
        else if (run.length) { if (run.length > 6) { emit(run, sb0); lats.push(run); latSb.push(sb0); } run = []; }
      }
      if (run.length > 6) { emit(run, sb0); lats.push(run); latSb.push(sb0); }
    }
    // storm interiors: concentric spiralling loops (the great storm, then the eddies along the belts)
    for (const ST of STORMS) {
      const nl = ST.loops;
      for (let j = ST === STORM ? 1 : 2; j <= nl; j++) {
        const s = j / (nl + 0.6);
        const pts = [];
        const da = ST === STORM ? 0.035 : 0.09;
        const big = ST === STORM, aEnd = big ? Math.PI * 2 + 0.05 : ST.span - 0.5 * j;
        for (let a = 0; a <= aEnd; a += da) {
          const sp = s * (1 - (big ? 0.06 : 0.3) * a / 6.28);
          const aa = big ? a : ST.a0 + ST.dir * (a + j * 0.7);
          const t = ST.t + Math.cos(aa) * ST.rt * sp;
          const sb = ST.sb + Math.sin(aa) * ST.rs * sp;
          const p = sphere(sb, t);
          if (p[2] > 1) pts.push(PL.x + p[0], PL.y + p[1]);
        }
        if (pts.length > 6) emit(pts, ST.sb + ST.col);
      }
    }
    // night: dark ink cross-hatching that thickens toward the far limb (and inside the ring shadow)
    const night = new LW.FillBatch();
    const shade = (x, y) => {
      const ax = x - PL.x, ay = y - PL.y;
      const zz = Math.sqrt(Math.max(0, R * R - ax * ax - ay * ay));
      const p = [ax, ay, zz];
      const lam = (p[0] * L[0] + p[1] * L[1] + p[2] * L[2]) / R;
      const lit = LW.smooth(-0.02, 0.6, lam);
      return 1 - LW.smooth(0.0, 0.22, lit + 0.08 * lam);
    };
    const hatchAlong = (pts, wmax, base, cut) => {
      let run = [];
      const flush = () => {
        if (run.length >= 8) LW.ribbon(night.p('#0b1520'), run, (tt, i, x, y) => (base < 0 ? wmax * Math.pow(LW.smooth(cut, 1, shade(x, y)), 1.1) : base + wmax * Math.pow(shade(x, y), 1.4)) * LW.taper(tt, 0.06, 0.06));
        run = [];
      };
      for (let i = 0; i < pts.length; i += 2) { if (shade(pts[i], pts[i + 1]) > cut) run.push(pts[i], pts[i + 1]); else flush(); }
      flush();
    };
    // between-line latitude hatch: offset half a band so it falls in the gaps of the lit lines
    for (const run of lats) hatchAlong(run, 3.6, 0.3, 0.12);
    // meridians, only well into the night
    const NM = 150;
    for (let k = 0; k < NM; k++) {
      const t = (k / NM) * Math.PI * 2;
      const pts = [];
      for (let bt = -1.555; bt <= 1.555; bt += 0.004) {
        const sb = Math.sin(bt);
        const p = sphere(sb, t);
        if (p[2] > 1) pts.push(PL.x + p[0], PL.y + p[1]);
        else if (pts.length) break;
      }
      if (pts.length > 8) hatchAlong(pts, 1.9, -1, 0.45);
    }
    fill.flush(ctx, [P.deep, P.teal, P.sea, P.orange, P.amber, P.straw, P.cream]);
    night.flush(ctx);
    {
      const trng = new LW.RNG('planet-tex');
      const tex = new LW.FillBatch();
      const surf = (x, y) => { const ax = x - PL.x, ay = y - PL.y; const zz = Math.sqrt(Math.max(0, R * R - ax * ax - ay * ay)); return [ax, ay, zz]; };
      const inDisc = (x, y, m) => (x - PL.x) ** 2 + (y - PL.y) ** 2 < (R - (m || 3)) ** 2;
      // streaks within the belts: darker runs laid over the lit lines
      for (let li = 0; li < lats.length; li++) {
        const run = lats[li], sb = latSb[li];
        let seg = [], segV = 0;
        const flush = () => {
          if (seg.length >= 10) {
            const col = LW.darker(planetInk(segV, 0.5, sb), segV > 0.6 ? 2 : 1);
            LW.ribbon(tex.p(col), seg, (tt) => (0.55 + 1.1 * Math.min(1, segV)) * LW.taper(tt, 0.25, 0.25));
          }
          seg = [];
        };
        for (let i = 0; i < run.length; i += 2) {
          const x = run[i], y = run[i + 1];
          const nz = LW.N3(x * 0.012 + li * 0.37, y * 0.03);
          const v = lightAt(surf(x, y)) * bandMod(sb);
          if (nz > 0.42 && v > 0.2 && inDisc(x, y, 6)) { if (!seg.length) segV = v; seg.push(x, y); } else flush();
        }
        flush();
      }
      tex.flush(ctx);
      const ink = new LW.FillBatch();
      // night side: a diagonal third hatch, and a fourth in the deepest night
      for (const [ang, cut, wmax, gap] of [[0.62, 0.42, 1.35, 4.6], [-0.75, 0.72, 1.1, 5.4]]) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let k = -R; k <= R; k += gap * trng.range(0.7, 1.3)) {
          const aj = trng.range(-0.04, 0.04);
          const cj = Math.cos(ang + aj), sj = Math.sin(ang + aj);
          const ox = PL.x - sj * k, oy = PL.y + cj * k;
          let run = [];
          const wl = wmax * trng.range(0.7, 1.15);
          const flush = () => { if (run.length >= 6) LW.dashes(LW.wobble(run, 0.9, 0.03, k), trng, 30, 240, 2, 10, (sub) => LW.ribbon(ink.p('#070e16'), sub, (tt, i, x, y) => wl * Math.pow(LW.smooth(cut, 1, shade(x, y)), 0.9) * LW.taper(tt, 0.15, 0.15))); run = []; };
          for (let s = -R; s <= R; s += 3) {
            const x = ox + cj * s, y = oy + sj * s;
            if (inDisc(x, y, 2) && shade(x, y) > cut) run.push(x, y); else flush();
          }
          flush();
        }
      }
      // terminator drawn in hatching: short strokes thrown toward the light across the day/night line
      const ld = Math.hypot(L[0], L[1]), lx = L[0] / ld, ly = L[1] / ld;
      for (let i = 0; i < 9000; i++) {
        const a = trng.range(0, 6.283), d = Math.sqrt(trng.next()) * (R - 4);
        const x = PL.x + Math.cos(a) * d, y = PL.y + Math.sin(a) * d;
        const sh = shade(x, y);
        if (sh < 0.06 || sh > 0.8) continue;
        const band = Math.sin(Math.PI * LW.smooth(0.06, 0.8, sh));
        if (trng.next() > band * 0.85) continue;
        const len = trng.range(5, 16) * (0.6 + band);
        const aj = Math.atan2(ly, lx) + trng.range(-0.18, 0.18);
        LW.fleck(ink.p('#0b1520'), x, y, len, aj, 0.45 + 0.75 * sh);
      }
      // stipple in the ring shadow and along the terminator
      for (let i = 0; i < 26000; i++) {
        const a = trng.range(0, 6.283), d = Math.sqrt(trng.next()) * (R - 4);
        const x = PL.x + Math.cos(a) * d, y = PL.y + Math.sin(a) * d;
        const p = surf(x, y);
        const rs = ringShadowOnPlanet(p), sh = shade(x, y);
        const w = Math.max((1 - rs) * 0.8, sh > 0.04 && sh < 0.85 ? 0.45 * Math.sin(Math.PI * sh) : 0);
        if (trng.next() > w) continue;
        LW.dot(ink.p('#0b1520'), x, y, trng.range(0.45, 0.95));
      }
      ink.flush(ctx);
    }

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

    // ring-shine: a thin cool rim just inside the night limb
    const shine = new LW.FillBatch();
    for (const [inset, col, wmax] of [[4.5, '#2c5f66', 1.5], [9, '#1d3d49', 1.0]]) {
      const pts = [];
      for (let a = 0; a <= Math.PI * 2; a += 1.4 / R) pts.push(PL.x + Math.cos(a) * (R - inset), PL.y + Math.sin(a) * (R - inset));
      LW.dashes(pts, rng, 120, 500, 6, 30, (sub) => LW.ribbon(shine.p(col), sub, (tt, i, x, y) => {
        const a = Math.atan2(y - PL.y, x - PL.x);
        const nl = Math.cos(a) * L[0] + Math.sin(a) * L[1];
        return wmax * LW.smooth(-0.1, -0.5, nl) * LW.taper(tt, 0.15, 0.15);
      }));
    }
    shine.flush(ctx, ['#1d3d49', '#2c5f66']);
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
