/* hand.js — a procedural hand, built from first principles.
 *
 * A jointed skeleton (forward kinematics) drives lofted, tapered tubes for the
 * fingers and thumb; the palm + wrist + forearm is one lofted slab with tendon,
 * thenar and hypothenar displacements; nails and webbing are extra patches.
 * Units are centimetres. Canonical hand: RIGHT hand, fingers along +Y, back of
 * the hand toward +Z, radial (thumb) side toward -X.
 */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, sgnpow, gauss, curve1, V, TAU, PI } = HS;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt, abs = Math.abs;

  /* ---------- frames (l = lateral, d = along bone, n = dorsal; l × d = n) ---------- */
  const identF = () => ({ l: [1, 0, 0], d: [0, 1, 0], n: [0, 0, 1] });
  function rotFlex(F, a) { // curl toward the palm (-n)
    const c = cos(a), s = sin(a), d = F.d, n = F.n;
    return { l: F.l, d: [d[0] * c - n[0] * s, d[1] * c - n[1] * s, d[2] * c - n[2] * s],
                     n: [n[0] * c + d[0] * s, n[1] * c + d[1] * s, n[2] * c + d[2] * s] };
  }
  function rotAbd(F, a) { // swing toward +l
    const c = cos(a), s = sin(a), d = F.d, l = F.l;
    return { l: [l[0] * c - d[0] * s, l[1] * c - d[1] * s, l[2] * c - d[2] * s],
             d: [d[0] * c + l[0] * s, d[1] * c + l[1] * s, d[2] * c + l[2] * s], n: F.n };
  }
  function rotRoll(F, a) { // twist about the bone axis
    const c = cos(a), s = sin(a), l = F.l, n = F.n;
    return { l: [l[0] * c + n[0] * s, l[1] * c + n[1] * s, l[2] * c + n[2] * s], d: F.d,
             n: [n[0] * c - l[0] * s, n[1] * c - l[1] * s, n[2] * c - l[2] * s] };
  }
  function fk(origin, F0, segs) {
    const joints = [origin.slice()], frames = [];
    let F = F0;
    for (const s of segs) {
      F = s.rot(F);
      frames.push(F);
      joints.push(V.madd(joints[joints.length - 1], F.d, s.len));
    }
    return { joints, frames };
  }

  /* ---------- generalised-cylinder tube ---------- */
  function makeTube(spec) {
    const { joints, frames, W, wKnots, tKnots, cut, capS, capE } = spec;
    const ds = spec.ds || 0.11, M = spec.M || 44;
    const pw0 = spec.pw0 || 2.3, pw1 = spec.pw1 || 2.6, hdFrac = spec.hdFrac || 0.4;
    const m = frames.length;

    // 1. centreline polyline with rounded corners
    const poly = [{ p: joints[0].slice(), l: frames[0].l }];
    const jIdx = [0];
    for (let s = 0; s < m; s++) {
      const B = joints[s + 1];
      if (s < m - 1) {
        const dP = frames[s].d, dN = frames[s + 1].d;
        const lp = V.len(V.sub(joints[s + 1], joints[s])), ln = V.len(V.sub(joints[s + 2], joints[s + 1]));
        const c = Math.min(cut, 0.45 * lp, 0.45 * ln);
        const P0 = V.madd(B, dP, -c), P2 = V.madd(B, dN, c);
        poly.push({ p: P0, l: frames[s].l });
        const K = 8;
        for (let k = 1; k < K; k++) {
          const t = k / K, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), cc = t * t;
          poly.push({ p: [a * P0[0] + b * B[0] + cc * P2[0], a * P0[1] + b * B[1] + cc * P2[1], a * P0[2] + b * B[2] + cc * P2[2]],
                      l: V.norm(V.lerp(frames[s].l, frames[s + 1].l, t)) });
          if (k === K / 2) jIdx.push(poly.length - 1);
        }
        poly.push({ p: P2, l: frames[s + 1].l });
      } else {
        poly.push({ p: V.madd(B, frames[s].d, -capE), l: frames[s].l });
      }
    }
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + V.len(V.sub(poly[i].p, poly[i - 1].p)));
    const total = cum[cum.length - 1];
    const jointS = jIdx.map((i) => cum[i]);
    jointS.push(total);

    // 2. resample uniformly
    const N = Math.max(4, Math.round(total / ds));
    const dsA = total / N;
    const body = [];
    let seg = 0;
    for (let k = 0; k <= N; k++) {
      const s = k * dsA;
      while (seg < poly.length - 2 && cum[seg + 1] < s) seg++;
      const t = clamp((s - cum[seg]) / (cum[seg + 1] - cum[seg] || 1), 0, 1);
      body.push({ p: V.lerp(poly[seg].p, poly[seg + 1].p, t), l: V.norm(V.lerp(poly[seg].l, poly[seg + 1].l, t)), s });
    }
    for (let k = 0; k <= N; k++) {
      const a = body[Math.max(0, k - 1)].p, b = body[Math.min(N, k + 1)].p;
      const d = V.norm(V.sub(b, a));
      let l = body[k].l;
      l = V.norm(V.sub(l, V.mul(d, V.dot(l, d))));
      body[k].d = d; body[k].l = l; body[k].n = V.cross(l, d);
    }

    // 3. profile
    const sOf = (kn) => jointS[kn[0]] + kn[1] * (jointS[kn[0] + 1] - jointS[kn[0]]);
    const wf = curve1(wKnots.map(sOf), wKnots.map((k) => k[2]));
    const tf = curve1(tKnots.map(sOf), tKnots.map((k) => k[2]));
    const bends = [];
    for (let j = 1; j < m; j++) bends.push({ s: jointS[j], b: Math.acos(clamp(V.dot(frames[j - 1].d, frames[j].d), -1, 1)) });
    function attrs(s) {
      const hw = 0.5 * W * wf(s);
      const T = tf(s) * 2 * hw;
      let hd = hdFrac * T, hp = (1 - hdFrac) * T;
      for (const bj of bends) {
        const g = gauss((s - bj.s) / (0.5 + 0.3 * bj.b), 1);
        const q = sin(bj.b * 0.5) * g;
        hp *= 1 - 0.30 * q;
        hd *= 1 + 0.10 * q;
      }
      return { w: hw, hd, hp, pw: lerp(pw0, pw1, clamp(s / total, 0, 1)) };
    }

    // 4. rows: start cap, body, end cap
    const rows = [];
    const nCS = capS > 0 ? 7 : 0, nCE = 9;
    const b0 = body[0], bN = body[N];
    const a0 = attrs(0), aN = attrs(total);
    for (let i = 0; i < nCS; i++) {
      const th = (PI / 2) * (1 - i / nCS), sc = cos(th);
      rows.push({ C: V.madd(b0.p, b0.d, -capS * sin(th)), l: b0.l, n: b0.n, d: b0.d, w: a0.w * sc, hd: a0.hd * sc, hp: a0.hp * sc, pw: a0.pw, s: -capS * sin(th) });
    }
    for (let k = 0; k <= N; k++) {
      const a = attrs(body[k].s);
      rows.push({ C: body[k].p, l: body[k].l, n: body[k].n, d: body[k].d, w: a.w, hd: a.hd, hp: a.hp, pw: a.pw, s: body[k].s });
    }
    for (let j = 1; j <= nCE; j++) {
      const th = (PI / 2) * (j / nCE), sc = cos(th);
      rows.push({ C: V.madd(bN.p, bN.d, capE * sin(th)), l: bN.l, n: bN.n, d: bN.d, w: aN.w * sc, hd: aN.hd * sc, hp: aN.hp * sc, pw: aN.pw, s: total + capE * sin(th) });
    }
    const nu = rows.length, nv = M + 1;

    function ring(row, phi, out) {
      const c = cos(phi), s = sin(phi), e = 2 / row.pw;
      const xn = sgnpow(c, e), yn = sgnpow(s, e);
      const x = row.w * xn, y = (yn > 0 ? row.hd : row.hp) * yn;
      out[0] = row.C[0] + row.l[0] * x + row.n[0] * y;
      out[1] = row.C[1] + row.l[1] * x + row.n[1] * y;
      out[2] = row.C[2] + row.l[2] * x + row.n[2] * y;
      return out;
    }
    const P = new Float32Array(nu * nv * 3), R = new Float32Array(nu * nv * 3);
    const tmp = [0, 0, 0];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      ring(rows[i], (TAU * j) / M, tmp);
      const o = (i * nv + j) * 3;
      P[o] = tmp[0]; P[o + 1] = tmp[1]; P[o + 2] = tmp[2];
      R[o] = rows[i].C[0]; R[o + 1] = rows[i].C[1]; R[o + 2] = rows[i].C[2];
    }

    const cm = new Float32Array(nu * nv).fill(1);
    if (spec.cmFn) for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) cm[i * nv + j] = spec.cmFn(rows[i].s);
    const tube = {
      cm, kind: 'tube', id: spec.id || 1, nu, nv, cyc: true, P, R, rows, jointS, total, ds: dsA, nCS, nCE, N,
      rowOfS: (s) => nCS + s / dsA,
      ringAt(r, phi) {
        r = clamp(r, 0, nu - 1.001);
        const i = Math.floor(r), t = r - i, A = rows[i], B = rows[i + 1];
        const row = {
          C: V.lerp(A.C, B.C, t), l: V.norm(V.lerp(A.l, B.l, t)), n: V.norm(V.lerp(A.n, B.n, t)),
          w: lerp(A.w, B.w, t), hd: lerp(A.hd, B.hd, t), hp: lerp(A.hp, B.hp, t), pw: lerp(A.pw, B.pw, t),
        };
        return { p: ring(row, phi, [0, 0, 0]), c: row.C, n: row.n, l: row.l, row };
      },
      frameAtS(s) {
        const r = clamp(this.rowOfS(s), 0, nu - 1.001), i = Math.floor(r), t = r - i;
        const A = rows[i], B = rows[i + 1];
        return { C: V.lerp(A.C, B.C, t), l: V.norm(V.lerp(A.l, B.l, t)), n: V.norm(V.lerp(A.n, B.n, t)), d: V.norm(V.lerp(A.d, B.d, t)),
                 w: lerp(A.w, B.w, t), hd: lerp(A.hd, B.hd, t), hp: lerp(A.hp, B.hp, t) };
      },
      pointAtS(s, phi) { return this.ringAt(this.rowOfS(s), phi).p; },
    };
    return tube;
  }

  /* ---------- palm + wrist + forearm slab ---------- */
  const MCP = [
    { x: -2.75, y: 9.4 }, { x: -0.9, y: 9.7 }, { x: 0.95, y: 9.2 }, { x: 2.75, y: 8.1 },
  ];
  const cupZ = (cup, x, y) => -cup * 0.09 * (x + 1.5) * (x + 1.5) * smooth(0, 8, y);

  function makePalm(pose) {
    const arm = pose.arm == null ? 7.5 : pose.arm;
    const y0 = -arm;
    const cup = pose.cup || 0;
    const PWk = curve1([-8, -4, -1, 1, 3, 5.5, 8, 10], [3.3, 3.05, 2.85, 3.25, 3.85, 3.95, 3.95, 3.95]);
    const PHk = curve1([-8, -4, -1, 1, 3, 5.5, 8, 10], [2.3, 2.15, 1.9, 1.7, 1.45, 1.25, 1.15, 1.1]);
    const Ymax = curve1([-4.7, -3.6, -2.75, -0.9, 0.95, 2.75, 3.7, 4.4], [8.9, 9.6, 9.95, 10.25, 9.75, 8.65, 7.6, 6.6]);
    const Wr = (y) => PWk(y) + 1.25 * gauss(y - 2.9, 2.0);
    const Wu = (y) => PWk(y) - 0.25 * smooth(6, 9, y) + 0.35 * gauss(y - 4.0, 2.0);
    const pw = 2.55;
    const ext = pose.fingers.map((f) => clamp(1 - (f.mcp || 0) / 1.0, 0.25, 1));
    const thenarAmp = pose.thenar == null ? 0.9 : pose.thenar;
    const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

    function dispTop(x, y) {
      let d = 0;
      const ramp = smooth(1.2, 4.5, y) * (1 - smooth(8.4, 10.4, y));
      for (let i = 0; i < 4; i++) {
        const xt = MCP[i].x * lerp(0.5, 1.0, smooth(0, 9, y));
        d += 0.15 * ext[i] * gauss(x - xt, 0.4) * ramp;
      }
      d += 0.4 * g2(x, y, -3.2, 5.2, 1.3, 1.7) * (pose.interosseous == null ? 1 : pose.interosseous);
      d += 0.3 * g2(x, y, 2.4, -0.5, 0.55, 0.75);
      d += 0.22 * g2(x, y, -2.6, -0.6, 0.6, 0.8);
      d += 0.28 * g2(x, y, -0.6, -5, 1.7, 2.2);
      return d;
    }
    function dispBot(x, y) {
      let d = thenarAmp * g2(x, y, -2.4, 3.0, 2.0, 2.5);
      d += 0.5 * g2(x, y, 2.4, 3.9, 1.2, 2.4);
      for (let i = 0; i < 4; i++) d += 0.2 * g2(x, y, MCP[i].x, MCP[i].y - 0.8, 0.75, 0.55);
      d -= 0.4 * (0.4 + cup) * g2(x, y, 0.2, 5.4, 1.7, 1.7);
      for (let k = 0; k < 3; k++) d += 0.12 * gauss(x - (-0.9 + k * 1.2), 0.4) * smooth(-5, -2, y) * (1 - smooth(0.5, 2.5, y));
      return d;
    }
    const slabZ = (x, y, zn, ymaxX) => {
      const yd = ymaxX - y;
      const capf = yd < 1.5 ? sqrt(Math.max(0, 1 - ((1.5 - yd) / 1.5) ** 2)) : 1;
      const H = PHk(y) * capf;
      const zc = cupZ(cup, x, y) - (pose.arch || 0) * 0.03 * Math.max(0, y - 2) ** 2 * 0.3;
      if (zn >= 0) return zc + 0.93 * H * zn + dispTop(x, y) * zn * capf;
      return zc + 1.07 * H * zn - dispBot(x, y) * -zn * capf;
    };

    const NB = 120, M = 64, nu = NB + 1, nv = M + 1;
    const P = new Float32Array(nu * nv * 3), R = new Float32Array(nu * nv * 3), att = new Float32Array(nu * nv).fill(1);
    const e = 2 / pw;
    for (let i = 0; i < nu; i++) {
      const bp = i / NB;
      for (let j = 0; j < nv; j++) {
        const phi = (TAU * j) / M, c = cos(phi), s = sin(phi);
        const xn = sgnpow(c, e), zn = sgnpow(s, e);
        let x = 3.5 * xn, y = 0;
        for (let it = 0; it < 4; it++) {
          y = y0 + bp * (Ymax(x) - y0);
          x = (xn >= 0 ? Wu(y) : Wr(y)) * xn;
        }
        y = y0 + bp * (Ymax(x) - y0);
        const z = slabZ(x, y, zn, Ymax(x));
        const o = (i * nv + j) * 3;
        P[o] = x; P[o + 1] = y; P[o + 2] = z;
        R[o] = 0; R[o + 1] = y; R[o + 2] = cupZ(cup, 0, y);
        if (pose.fadeArm) att[i * nv + j] = smooth(-arm, -arm + (arm > 4 ? 4.5 : 2.5), y);
      }
    }
    const cm = new Float32Array(nu * nv).fill(1);
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const o = (i * nv + j) * 3;
      cm[i * nv + j] = smooth(0.4, 1.4, Ymax(P[o]) - P[o + 1]);
    }
    const palm = { kind: 'palm', id: 1, nu, nv, cyc: true, P, R, att, cm };

    // point on the palm surface (top: dorsal, else palmar)
    function surfPoint(x, y, top, lift) {
      const W = x >= 0 ? Wu(y) : Wr(y);
      const xn = clamp(x / W, -0.995, 0.995);
      const zn = Math.pow(Math.max(0, 1 - Math.pow(abs(xn), pw)), 1 / pw) * (top ? 1 : -1);
      const z = slabZ(x, y, zn, Ymax(x)) + (top ? 1 : -1) * (lift || 0.03);
      return [x, y, z];
    }

    // cut cap
    const capP = new Float32Array(2 * nv * 3), capR = new Float32Array(2 * nv * 3);
    for (let j = 0; j < nv; j++) {
      const o0 = j * 3, o1 = (nv + j) * 3, o = j * 3;
      const ctr = [0, y0, cupZ(cup, 0, y0)];
      capP[o0] = ctr[0]; capP[o0 + 1] = ctr[1]; capP[o0 + 2] = ctr[2];
      capP[o1] = P[o]; capP[o1 + 1] = P[o + 1]; capP[o1 + 2] = P[o + 2];
      capR[o0] = capR[o1] = ctr[0]; capR[o0 + 1] = capR[o1 + 1] = ctr[1] - 3; capR[o0 + 2] = capR[o1 + 2] = ctr[2];
    }
    const cap = { kind: 'cut', id: 4, nu: 2, nv, cyc: false, P: capP, R: capR, att: new Float32Array(2 * nv).fill(pose.fadeArm ? 0 : 1) };
    return { palm, cap, surfPoint, Wr, Wu, Ymax };
  }

  /* ---------- skin webs between digits ---------- */
  function makeWeb(tA, tB, o) {
    const sMidA = 0.5 * (o.sA0 + o.sA1), sMidB = 0.5 * (o.sB0 + o.sB1);
    const fA = tA.frameAtS(sMidA), fB = tB.frameAtS(sMidB);
    const pick = (tube, sMid, target) => {
      const a = tube.pointAtS(sMid, 0), b = tube.pointAtS(sMid, PI);
      return V.len(V.sub(a, target)) < V.len(V.sub(b, target)) ? 0 : PI;
    };
    const phA = pick(tA, sMidA, fB.C), phB = pick(tB, sMidB, fA.C);
    const nu = 14, nv = 24;
    const arch = o.arch == null ? 0.6 : o.arch;
    const Pm = new Float32Array(nu * nv * 3), NB = new Float32Array(nu * nv * 3), TH = new Float32Array(nu * nv * 2);
    for (let i = 0; i < nu; i++) {
      const q = i / (nu - 1);
      for (let j = 0; j < nv; j++) {
        const t = j / (nv - 1);
        const e = 1 - arch * (1 - (2 * t - 1) * (2 * t - 1));
        const qq = q * e;
        const sA = lerp(o.sA0, o.sA1, qq), sB = lerp(o.sB0, o.sB1, qq);
        const pA = tA.pointAtS(sA, phA), pB = tB.pointAtS(sB, phB);
        const pm = V.lerp(pA, pB, t);
        const fa = tA.frameAtS(sA), fb = tB.frameAtS(sB);
        const nb = V.norm(V.lerp(fa.n, fb.n, t));
        const o3 = (i * nv + j) * 3;
        Pm[o3] = pm[0]; Pm[o3 + 1] = pm[1]; Pm[o3 + 2] = pm[2];
        NB[o3] = nb[0]; NB[o3 + 1] = nb[1]; NB[o3 + 2] = nb[2];
        const prof = 0.5 * Math.pow(sin(PI * t), 0.8) * (1 - 0.94 * smooth(0.5, 1, q) * Math.pow(sin(PI * t), 0.5));
        TH[(i * nv + j) * 2] = lerp(fa.hd, fb.hd, t) * prof;
        TH[(i * nv + j) * 2 + 1] = lerp(fa.hp, fb.hp, t) * prof;
      }
    }
    const mk = () => ({ P: new Float32Array(nu * nv * 3), R: Pm });
    const top = mk(), bot = mk();
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const o3 = (i * nv + j) * 3;
      const ia = Math.max(0, i - 1), ib = Math.min(nu - 1, i + 1), ja = Math.max(0, j - 1), jb = Math.min(nv - 1, j + 1);
      const g = (a, b) => [Pm[a * 3] - Pm[b * 3], Pm[a * 3 + 1] - Pm[b * 3 + 1], Pm[a * 3 + 2] - Pm[b * 3 + 2]];
      let nrm = V.norm(V.cross(g(ib * nv + j, ia * nv + j), g(i * nv + jb, i * nv + ja)));
      const nb = [NB[o3], NB[o3 + 1], NB[o3 + 2]];
      if (V.dot(nrm, nb) < 0) nrm = V.mul(nrm, -1);
      const T = V.madd([Pm[o3], Pm[o3 + 1], Pm[o3 + 2]], nrm, TH[(i * nv + j) * 2]);
      const B = V.madd([Pm[o3], Pm[o3 + 1], Pm[o3 + 2]], nrm, -TH[(i * nv + j) * 2 + 1]);
      top.P[o3] = T[0]; top.P[o3 + 1] = T[1]; top.P[o3 + 2] = T[2];
      bot.P[o3] = B[0]; bot.P[o3 + 1] = B[1]; bot.P[o3 + 2] = B[2];
    }
    const base = { kind: 'web', id: 3, nu, nv, cyc: false, edges: ['u1'] };
    return [Object.assign({ P: top.P, R: top.R }, base), Object.assign({ P: bot.P, R: bot.R }, base)];
  }

  /* ---------- nail plate ---------- */
  function makeNail(tube, lines, rand) {
    const m = 3;
    const r0 = tube.rowOfS(tube.jointS[m - 1] + 0.38 * (tube.jointS[m] - tube.jointS[m - 1]));
    const r1 = tube.nCS + tube.N + 0.42 * tube.nCE;
    const nu = 18, nv = 20, thMax = 0.8;
    const P = new Float32Array(nu * nv * 3), R = new Float32Array(nu * nv * 3);
    const shape = (q) => Math.pow(smooth(0, 0.24, q), 0.55) * (1 - 0.1 * smooth(0.7, 1, q));
    const at = (q, p, off) => {
      const r = lerp(r0, r1, q);
      const phi = PI / 2 + p * thMax * shape(q);
      const rg = tube.ringAt(r, phi);
      const out = V.norm(V.sub(rg.p, rg.c));
      const o = off * smooth(0, 0.12, q) + 0.012;
      return { p: V.madd(rg.p, out, o), c: rg.c };
    };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const q = i / (nu - 1), p = (j / (nv - 1)) * 2 - 1;
      const a = at(q, p, 0.045 * (1 - p * p * p * p));
      const o3 = (i * nv + j) * 3;
      P[o3] = a.p[0]; P[o3 + 1] = a.p[1]; P[o3 + 2] = a.p[2];
      R[o3] = a.c[0]; R[o3 + 1] = a.c[1]; R[o3 + 2] = a.c[2];
    }
    // lunula + free-edge line
    const lun = [], fe = [];
    for (let k = 0; k <= 14; k++) {
      const p = (k / 14) * 1.7 - 0.85;
      const q = 0.27 + 0.11 * (1 - p * p) * 1.0;
      lun.push(at(q, p * 0.8, 0.05).p);
      const q2 = 0.9 + 0.02 * p * p;
      fe.push(at(q2, p * 0.9, 0.05).p);
    }
    lines.push({ pts: lun, w: 0.7, kind: 'nailfine' });
    lines.push({ pts: fe, w: 0.85, kind: 'nailfine' });
    return { kind: 'nail', id: 2, nu, nv, cyc: false, P, R, edges: ['u0', 'u1', 'v0', 'v1'], noSil: true };
  }

  /* ---------- the hand ---------- */
  const FINGERS = [
    { name: 'index',  L: [4.0, 2.4, 2.0], W: 1.95, rest: -0.10 },
    { name: 'middle', L: [4.4, 2.7, 2.2], W: 2.0,  rest: -0.02 },
    { name: 'ring',   L: [4.1, 2.6, 2.1], W: 1.85, rest: 0.06 },
    { name: 'pinky',  L: [3.2, 1.9, 1.9], W: 1.6,  rest: 0.16 },
  ];

  HS.buildHand = function (pose, seed) {
    const rand = HS.rng(seed || 1);
    const surfs = [], lines = [];
    const cup = pose.cup || 0;
    const palmObj = makePalm(pose);
    surfs.push(palmObj.palm);
    if (!pose.fadeArm) surfs.push(palmObj.cap);

    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const D = FINGERS[i], fp = pose.fingers[i];
      const x = MCP[i].x, y = MCP[i].y;
      const origin = [x, y, cupZ(cup, x, y)];
      let F0 = rotRoll(identF(), -Math.atan(0.18 * cup * (x + 1.5)));
      F0 = rotAbd(F0, D.rest + (fp.abd || 0));
      const { joints, frames } = fk(origin, F0, [
        { len: D.L[0], rot: (F) => rotFlex(rotRoll(F, fp.roll || 0), fp.mcp || 0) },
        { len: D.L[1], rot: (F) => rotFlex(rotAbd(F, fp.pipAbd || 0), fp.pip || 0) },
        { len: D.L[2], rot: (F) => rotFlex(F, fp.dip || 0) },
      ]);
      const tube = makeTube({
        joints, frames, W: D.W * 1.1, cut: 0.55 * D.W, capS: 0.5 * D.W, capE: 0.46 * D.W,
        wKnots: [[0, 0, 1.04], [0, 0.55, 0.94], [1, 0, 0.99], [1, 0.5, 0.9], [2, 0, 0.93], [2, 0.5, 0.87], [2, 1, 0.74]],
        tKnots: [[0, 0, 0.95], [1, 0, 0.92], [2, 0, 0.84], [2, 1, 0.7]],
        pw0: 2.3, pw1: 2.7,
      });
      tube.name = D.name; tube.style = { fingerIdx: i };
      surfs.push(tube);
      fingers.push({ tube, joints, frames, def: D });
      surfs.push(makeNail(tube, lines, rand));
    }

    // thumb
    const th = pose.thumb;
    const tOrigin = [-1.5, 1.5, cupZ(cup, -1.5, 1.5) - 0.6];
    let TF = identF();
    TF = rotAbd(TF, -(th.abd == null ? 0.6 : th.abd));
    TF = rotFlex(TF, th.flex == null ? 0.3 : th.flex);
    TF = rotRoll(TF, th.roll == null ? 0.9 : th.roll);
    const TL = [4.6, 3.3, 2.8];
    const tk = fk(tOrigin, TF, [
      { len: TL[0], rot: (F) => F },
      { len: TL[1], rot: (F) => rotFlex(rotAbd(F, th.mcpAbd || 0), th.mcp || 0) },
      { len: TL[2], rot: (F) => rotFlex(F, th.ip || 0) },
    ]);
    const thumbW = 2.35;
    const thumbTube = makeTube({
      joints: tk.joints, frames: tk.frames, W: thumbW, cut: 1.2, capS: 1.3, capE: 0.44 * thumbW,
      wKnots: [[0, 0, 1.45], [0, 0.5, 1.22], [0, 0.95, 1.02], [1, 0, 1.05], [1, 0.5, 0.88], [1, 0.95, 0.9], [2, 0, 1.0], [2, 0.5, 0.96], [2, 1, 0.8]],
      tKnots: [[0, 0, 1.0], [0, 0.6, 0.95], [1, 0, 0.95], [2, 0, 0.88], [2, 1, 0.72]],
      pw0: 2.3, pw1: 2.7, hdFrac: 0.42,
      cmFn: (s) => 0.3 + 0.7 * smooth(0.35 * 4.6, 0.95 * 4.6, s),
    });
    thumbTube.name = 'thumb'; thumbTube.style = { fingerIdx: 4 };
    surfs.push(thumbTube);
    surfs.push(makeNail(thumbTube, lines, rand));

    // webs
    const wl = pose.webLen == null ? 0.5 : pose.webLen;
    for (let i = 0; i < 3; i++) {
      const A = fingers[i].tube, B = fingers[i + 1].tube;
      const sA1 = wl * fingers[i].def.L[0], sB1 = wl * fingers[i + 1].def.L[0] * (i === 2 ? 0.9 : 1);
      const ws = makeWeb(A, B, { sA0: 0.0, sA1, sB0: 0.0, sB1, arch: pose.webArch == null ? 0.5 : pose.webArch });
      for (const w of ws) { w.name = 'web' + i; w.style = {}; surfs.push(w); }
    }
    {
      const A = thumbTube, B = fingers[0].tube;
      const ws = makeWeb(A, B, { sA0: 0.75 * TL[0], sA1: TL[0] + 0.4 * TL[1], sB0: 0.0, sB1: 0.4 * fingers[0].def.L[0], arch: 0.55 });
      for (const w of ws) { w.name = 'thumbweb'; w.style = {}; surfs.push(w); }
    }

    /* ----- drawn anatomy lines (in local coordinates) ----- */
    const P = palmObj;
    const spl = (pts, top, lift) => HS.catmull(pts, 8).map((p) => P.surfPoint(p[0], p[1], top, lift));
    const palmar = (pts, w, kind) => lines.push({ pts: spl(pts, false, 0.03), w, kind: kind || 'crease' });
    // palmar creases
    palmar([[3.9, 6.5], [2.4, 6.95], [0.7, 7.45], [-1.2, 8.05], [-2.7, 8.55]], 1.25);          // heart line
    palmar([[-3.5, 6.6], [-1.7, 5.95], [0.3, 5.5], [2.1, 5.0], [3.5, 4.3]], 1.15);              // head line
    palmar([[-3.4, 6.7], [-3.75, 5.4], [-3.4, 3.8], [-2.6, 2.2], [-1.6, 1.0], [-0.9, 0.3]], 1.35); // life line
    palmar([[-2.9, 0.15], [-1.4, 0.4], [0, 0.42], [1.4, 0.35], [2.8, 0.1]], 1.0);              // wrist crease
    palmar([[-2.7, -0.9], [-1.2, -0.7], [0.1, -0.65], [1.4, -0.75], [2.6, -0.95]], 0.8);
    palmar([[-3.0, 4.0], [-2.4, 4.6], [-1.6, 5.4]], 0.7, 'crease');                              // fine thenar folds
    palmar([[2.9, 3.0], [2.2, 3.9], [1.6, 4.6]], 0.6, 'crease');
    // dorsal: wrist folds + veins
    const dor = (pts, w, kind) => lines.push({ pts: spl(pts, true, 0.03), w, kind });
    dor([[-2.6, -0.4], [-1.0, -0.15], [0.6, -0.15], [2.4, -0.35]], 0.75, 'crease');
    dor([[-2.5, -1.5], [-1.0, -1.35], [0.6, -1.35], [2.3, -1.5]], 0.6, 'crease');
    const veinCount = 3 + Math.floor(rand() * 2);
    for (let v = 0; v < veinCount; v++) {
      let x = lerp(-2.8, 2.6, (v + rand() * 0.7) / veinCount), y = 7.8 + rand() * 0.6;
      const pts = [[x, y]];
      let vx = (rand() - 0.5) * 0.5;
      for (let k = 0; k < 9; k++) {
        y -= 0.8 + rand() * 0.25; vx += (rand() - 0.5) * 0.35 - x * 0.05; x += vx * 0.5;
        pts.push([clamp(x, -3.2, 3.2), y]);
      }
      const cl = spl(pts, true, 0.035);
      lines.push({ pts: cl, w: 0.75, kind: 'vein', off: 0.13 });
    }

    // digital creases and knuckle wrinkles
    const allTubes = fingers.map((f) => f.tube).concat([thumbTube]);
    allTubes.forEach((tube, ti) => {
      const js = tube.jointS;
      const first = ti === 4 ? 1 : 1;
      const wid = tube.rows[tube.nCS + 3].w;
      for (let j = first; j <= 2; j++) {
        const sj = js[j];
        const offs = j === 1 ? [-0.16, 0.06, 0.28] : [-0.08, 0.16];
        offs.forEach((so, k) => {
          const pts = [];
          const span = 0.5 + rand() * 0.06;
          for (let a = 0; a <= 12; a++) {
            const ph = PI + span * 0.9 + (a / 12) * (PI - span * 1.8);
            pts.push(tube.ringAt(tube.rowOfS(sj + so + 0.05 * sin((a / 12) * PI)), ph).p);
          }
          const w = k === 0 ? 1.15 : 0.8;
          lines.push({ pts: pts.map((p, i) => V.madd(p, V.norm(V.sub(p, tube.ringAt(tube.rowOfS(sj), PI * 1.5).c)), 0.02)), w, kind: 'crease' });
        });
        // dorsal wrinkles over the knuckle
        const nw = j === 1 ? 4 : 3;
        for (let k = 0; k < nw; k++) {
          const so = (k - (nw - 1) / 2) * 0.17 + (rand() - 0.5) * 0.05;
          const pts = [];
          const a0 = 0.5 + rand() * 0.3, a1 = PI - 0.5 - rand() * 0.3;
          for (let a = 0; a <= 8; a++) {
            const ph = lerp(a0, a1, a / 8);
            const bow = 0.06 * (1 - ((ph - PI / 2) / 1.1) ** 2);
            pts.push(tube.ringAt(tube.rowOfS(sj + so + bow), ph).p);
          }
          lines.push({ pts, w: 0.6, kind: 'wrinkle' });
        }
      }
      // proximal digital crease near the base (palmar)
      if (ti < 4) {
        const pts = [];
        for (let a = 0; a <= 12; a++) {
          const ph = PI + 0.7 + (a / 12) * (PI - 1.4);
          pts.push(tube.ringAt(tube.rowOfS(0.75 + 0.1 * sin((a / 12) * PI)), ph).p);
        }
        lines.push({ pts, w: 0.9, kind: 'crease' });
      }
    });

    return { surfs, lines, fingers, thumb: { tube: thumbTube, joints: tk.joints }, palmObj };
  };
})();
