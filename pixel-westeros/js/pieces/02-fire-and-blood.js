/* Fire and Blood — A Song of Pixels, piece 2.
 *
 * Three dragons circle one another over a burning city, on a 270 × 338 grid of 44 palette indices shown at 4×.
 * Nothing is simulated forward; every frame is a pure function of t. The dragons are small 3D models (tube
 * bodies, jointed bat wings with scalloped membranes, horns, spines, tail blades), posed, banked and flapped
 * analytically, flown along a (2,3) torus knot: three riders spaced a third of the knot apart are always
 * rotations of one another, so whenever the knot pulls them to its waist and the camera swings under them
 * they lock into a turning triskelion. They are rasterised with a depth buffer, flat-lit from the fire below,
 * rim-lit along their undersides and ordered-dithered into their own ramps. Each breath of fire is a stream
 * of emission slots: every particle is born at the mouth at some past moment, carried out along the head’s
 * aim at that moment, braided round its neighbours, slowed, lifted and burnt down to smoke, then splatted
 * into a heat buffer that maps to white, gold, orange and red. Behind them a smoke ceiling churns, lit from
 * beneath; the sky streams; a volcano spits and bleeds lava; ash falls in three layers and embers spiral up.
 * D = 24 s and every periodic term turns a whole number of times in D.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 24;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mod = (a, m) => ((a % m) + m) % m;
  const SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // value noise whose lattice wraps (mx, my cells; 0 = no wrap), so textures tile exactly
  function vnp(x, y, c, mx, my, s) {
    const gx = x / c, gy = y / c, i = fl(gx), j = fl(gy), fx = gx - i, fy = gy - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const i0 = mx ? mod(i, mx) : i, i1 = mx ? mod(i + 1, mx) : i + 1;
    const j0 = my ? mod(j, my) : j, j1 = my ? mod(j + 1, my) : j + 1;
    return lerp(lerp(ih(i0, j0, s), ih(i1, j0, s), ux), lerp(ih(i0, j1, s), ih(i1, j1, s), ux), uy);
  }
  function fbmp(x, y, cells, px, py, s) {
    let v = 0, a = 1, n = 0;
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      v += a * vnp(x, y, c, px ? px / c : 0, py ? py / c : 0, s + k * 31); n += a; a *= 0.55;
    }
    return v / n;
  }
  // looping 1D value noise: M lattice cells per loop
  function lvn(x, M, s) {
    const i = fl(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(ih(mod(i, M), 3, s), ih(mod(i + 1, M), 3, s), u);
  }
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette (44) */
  const PAL_HEX = [
    '060406', '0d080b', '150c10', '1e1115', '29161a', '36191c', '451d1e',                                     // 0-6 obsidian smoke
    '5a1f1c', '74241b', '922c1a', 'b23a19', 'cf5418', 'e8731d', 'f6982e', 'fdbd4c', 'ffdc80', 'fff1bf', 'fffbee', // 7-17 glow and fire
    '2a2224', '3d3234', '564849', '7b6a66', 'a8968c', 'd2c2b2',                                               // 18-23 smoke and ash
    '050305', '0e070a', '1b0d10', '2c1216', '4a1418',                                                         // 24-28 black dragon
    '3b2414', '5e3c1f', '8a5f2e', 'b8873f', 'dbb766', 'f1dca0', 'fbf1d4',                                     // 29-35 cream and gold
    '08120f', '0f1f17', '18301f', '23432a', '355a33', '6a5a28', '9a7a34', 'c9a24c',                           // 36-43 green and bronze
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  const GLOWTOP = 17; // 0..17 is one continuous ramp, obsidian to white heat

  /* ================================================================ camera & flight */
  const CX = 135, FOC = 335, CDIST = 5.1;
  let CY = 170;
  const KR = 1.14, Kr = 0.25, KH = 0.30, BANK = 0.45;
  const cam = { x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, wx: 0, wy: 0, wz: -1 };
  function setCamera(t) {
    const c = 0.5 + 0.5 * Math.cos(TAU * t / 8);           // 1 at t = 0, 8, 16: straight under the knot
    const e = lerp(0.85, 1.5, Math.pow(c, 0.8));
    CY = lerp(176, 146, c);
    const se = Math.sin(e), ce = Math.cos(e);
    cam.x = 0; cam.y = -CDIST * se; cam.z = CDIST * ce;
    cam.wx = 0; cam.wy = se; cam.wz = -ce;                 // view direction
    cam.ux = 0; cam.uy = ce; cam.uz = se;                  // screen up
    cam.rx = cam.wy * cam.uz - cam.wz * cam.uy;            // right = w × u
    cam.ry = cam.wz * cam.ux - cam.wx * cam.uz;
    cam.rz = cam.wx * cam.uy - cam.wy * cam.ux;
  }
  let PX = 0, PY = 0, PZ = 0;
  function project(x, y, z) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const zc = dx * cam.wx + dy * cam.wy + dz * cam.wz;
    const iz = FOC / Math.max(0.05, zc);
    PX = CX + (dx * cam.rx + dy * cam.ry + dz * cam.rz) * iz;
    PY = CY - (dx * cam.ux + dy * cam.uy + dz * cam.uz) * iz;
    PZ = zc;
  }

  // where dragon i is on the knot at time t, and its banked flight frame
  const FR = { px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 0, fz: 0, ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0, out: 1 };
  function flight(i, t, o) {
    const ph = TAU * (t / D + i / 3), k3 = 3 * ph + PI;
    const ca = Math.cos(2 * ph), sa = Math.sin(2 * ph), c3 = Math.cos(k3), s3 = Math.sin(k3);
    const rho = KR + Kr * c3;
    o.px = rho * ca; o.py = KH * Math.sin(k3 + PI / 3); o.pz = rho * sa;
    const drho = -3 * Kr * s3, w = TAU / D;
    o.vx = (drho * ca - 2 * rho * sa) * w; o.vy = 3 * KH * Math.cos(k3 + PI / 3) * w; o.vz = (drho * sa + 2 * rho * ca) * w;
    let n = Math.hypot(o.vx, o.vy, o.vz);
    o.fx = o.vx / n; o.fy = o.vy / n; o.fz = o.vz / n;
    const cb = Math.cos(BANK), sb = Math.sin(BANK);
    let ux = -ca * sb, uy = cb, uz = -sa * sb;
    const d = ux * o.fx + uy * o.fy + uz * o.fz;
    ux -= d * o.fx; uy -= d * o.fy; uz -= d * o.fz;
    n = Math.hypot(ux, uy, uz); o.ux = ux / n; o.uy = uy / n; o.uz = uz / n;
    o.rx = o.fy * o.uz - o.fz * o.uy; o.ry = o.fz * o.ux - o.fx * o.uz; o.rz = o.fx * o.uy - o.fy * o.ux;
    o.out = (o.rx * ca + o.rz * sa) > 0 ? 1 : -1;          // which local side faces away from the axis
  }

  /* ================================================================ breath schedule */
  const win = (x, a, b) => sstep(a, a + 0.35, x) * (1 - sstep(b - 0.5, b, x));
  function triW(t) {                     // the shared glide around each triskelion
    t = mod(t, D);
    let e = 0;
    for (let c = 0; c <= 24; c += 8) e = Math.max(e, win(t - c, -1.7, 1.9));
    return e;
  }
  function breath(i, t) {
    t = mod(t, D);
    let e = 0;
    for (let c = 0; c <= 24; c += 8) e = Math.max(e, win(t - c, -1.1, 1.9));   // all three at the triskelion
    const s = 4 + 8 * i;                                                        // and each alone between
    e = Math.max(e, win(t - s, -1.2, 1.4));
    return e;
  }

  /* ================================================================ dragon designs */
  // stations along the spine in the rest pose: x (forward), vertical radius, horizontal radius
  const ST = [
    [0.67, 0.012, 0.018], [0.63, 0.023, 0.032], [0.575, 0.033, 0.043], [0.52, 0.041, 0.052], [0.47, 0.030, 0.034],
    [0.41, 0.024, 0.024], [0.35, 0.026, 0.026], [0.29, 0.031, 0.033], [0.23, 0.044, 0.050], [0.16, 0.060, 0.066],
    [0.08, 0.067, 0.070], [0.00, 0.064, 0.064], [-0.08, 0.056, 0.055], [-0.15, 0.046, 0.045], [-0.24, 0.035, 0.033],
    [-0.34, 0.027, 0.025], [-0.44, 0.020, 0.018], [-0.54, 0.014, 0.013], [-0.64, 0.010, 0.009], [-0.74, 0.006, 0.006],
    [-0.83, 0.003, 0.003],
  ];
  const NS = ST.length, RING = 6;
  const DESIGN = [
    { // obsidian: the biggest, broad heavy wings, long swept horns, a tail blade
      sc: 0.88, beats: 12, amp: 0.95, neck: 1.0, tail: 1.05, girth: 1.45,
      hum: 0.22, fore: 0.30, fing: [[-0.32, 0.50], [0.10, 0.56], [0.52, 0.50], [0.95, 0.40]], horn: 0, tip: 0, spike: 0.045,
    },
    { // cream: slender, long-necked, narrow pointed wings, forward-hooked horns, a fan of tail fins
      sc: 0.8, beats: 15, amp: 1.0, neck: 1.22, tail: 1.15, girth: 1.2,
      hum: 0.20, fore: 0.33, fing: [[-0.25, 0.58], [0.15, 0.58], [0.55, 0.46], [0.98, 0.34]], horn: 1, tip: 1, spike: 0.03,
    },
    { // green: compact, a crest frill, notched wings, a double barb
      sc: 0.84, beats: 10, amp: 0.9, neck: 0.92, tail: 1.0, girth: 1.35,
      hum: 0.21, fore: 0.29, fing: [[-0.30, 0.52], [0.05, 0.50], [0.40, 0.52], [0.78, 0.44], [1.12, 0.32]], horn: 2, tip: 2, spike: 0.038,
    },
  ];

  // material ramps per dragon (palette indices, dark → light)
  const BODY = [[24, 25, 26, 27], [29, 30, 31, 32, 33, 34], [36, 37, 38, 39, 40]];
  const MEMB = [[24, 25, 26, 27], [30, 31, 32, 33, 34], [36, 37, 38, 39, 40]];
  const TRANS = [[26, 28, 7, 8, 9], [31, 32, 13, 14], [38, 41, 42, 43]];
  const HORN = [[25, 27, 28, 9], [31, 32, 33, 34, 35], [41, 42, 43]];
  const RIM = [[8, 10, 11], [33, 34, 35], [41, 42, 43]];
  const BONE = [[27, 28, 9, 10], [30, 31, 32, 33], [37, 40, 41, 42]];
  const OUTL = [24, 29, 36];

  /* ================================================================ geometry */
  const MAXV = 900, MAXT = 900;
  const LX = new Float32Array(MAXV), LY = new Float32Array(MAXV), LZ = new Float32Array(MAXV), VA = new Float32Array(MAXV);  // local, attribute
  const SX = new Float32Array(MAXV), SY = new Float32Array(MAXV), SZ = new Float32Array(MAXV);  // screen
  const WXs = new Float32Array(MAXV), WYs = new Float32Array(MAXV), WZs = new Float32Array(MAXV); // world
  const TA = new Uint16Array(MAXT), TB = new Uint16Array(MAXT), TC = new Uint16Array(MAXT), TM = new Uint8Array(MAXT);
  const LA = new Uint16Array(200), LB = new Uint16Array(200), LM = new Uint8Array(200), LWD = new Uint8Array(200);
  let nv = 0, nt = 0, nl = 0;
  const vtx = (x, y, z, a) => { LX[nv] = x; LY[nv] = y; LZ[nv] = z; VA[nv] = a === undefined ? 0.5 : a; return nv++; };
  const tri = (a, b, c, m) => { TA[nt] = a; TB[nt] = b; TC[nt] = c; TM[nt] = m; nt++; };
  const seg = (a, b, m, w) => { LA[nl] = a; LB[nl] = b; LM[nl] = m; LWD[nl] = w; nl++; };

  // neck pose: yaw / pitch for the breath and an idle sway
  const NECK = { yaw: 0, pitch: 0, env: 0, jaw: 0 };
  function neckPose(i, t, out, o) {
    const env = breath(i, t);
    o.env = env;
    o.yaw = out * env * (0.62 + 0.22 * Math.sin(TAU * t / 1.5 + i)) + 0.10 * Math.sin(TAU * t * 3 / D + i * 2);
    o.pitch = -0.18 * env + 0.06 * Math.sin(TAU * t * 4 / D + i);
    o.jaw = env * (0.55 + 0.1 * Math.sin(TAU * t / 0.75));
  }
  const NX0 = 0.22, NX1 = 0.47;
  // bend a rest-pose point of the neck/head; dragon-specific neck length already applied
  let BX = 0, BY = 0, BZ = 0;
  function bend(x, y, z, yaw, pitch, hx) {
    const wgt = clamp((x - NX0) / (hx - NX0), 0, 1);
    if (wgt <= 0) { BX = x; BY = y; BZ = z; return; }
    const w = wgt * wgt * (3 - 2 * wgt), Y = yaw * w, P = pitch * w;
    let dx = x - NX0, dy = y - 0.03, dz = z;
    const cp = Math.cos(P), sp = Math.sin(P);
    const ex = dx * cp - dy * sp, ey = dx * sp + dy * cp;
    const cy = Math.cos(Y), sy = Math.sin(Y);
    BX = NX0 + ex * cy - dz * sy; BY = 0.03 + ey; BZ = ex * sy + dz * cy;
  }
  const neckRise = (x) => 0.075 * sstep(NX0, NX1 + 0.05, x);
  const stx = (dz, x) => (x > NX0 ? NX0 + (x - NX0) * dz.neck : x < -0.15 ? -0.15 + (x + 0.15) * dz.tail : x);

  // mouth position and aim in world space at time t (used by the fire, at past moments)
  const MO = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, vx: 0, vy: 0, vz: 0, env: 0 };
  const FT = { px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 0, fz: 0, ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0, out: 1 };
  const NK = { yaw: 0, pitch: 0, env: 0, jaw: 0 };
  function mouthAt(i, t, o) {
    const dz = DESIGN[i];
    flight(i, t, FT);
    neckPose(i, t, FT.out, NK);
    const hx = NX0 + (NX1 - NX0) * dz.neck, sx = stx(dz, 0.66);
    const bob = bodyBob(dz, t);
    bend(sx, neckRise(0.66) - 0.012 + bob, 0, NK.yaw, NK.pitch, hx);
    const mx = BX, my = BY, mz = BZ;
    bend(sx + 0.2, neckRise(0.66) - 0.012 - 0.035 + bob, 0, NK.yaw, NK.pitch, hx);
    let ax = BX - mx, ay = BY - my, az = BZ - mz;
    const s = dz.sc;
    o.x = FT.px + s * (mx * FT.fx + my * FT.ux + mz * FT.rx);
    o.y = FT.py + s * (mx * FT.fy + my * FT.uy + mz * FT.ry);
    o.z = FT.pz + s * (mx * FT.fz + my * FT.uz + mz * FT.rz);
    let dx = ax * FT.fx + ay * FT.ux + az * FT.rx, dy = ax * FT.fy + ay * FT.uy + az * FT.ry, dw = ax * FT.fz + ay * FT.uz + az * FT.rz;
    const n = Math.hypot(dx, dy, dw);
    o.dx = dx / n; o.dy = dy / n; o.dz = dw / n;
    o.vx = FT.vx; o.vy = FT.vy; o.vz = FT.vz; o.env = NK.env;
  }
  function wingPhase(dz, i, t) { const q = t * dz.beats / D + i * 0.37; return q + 0.07 * Math.sin(TAU * q); }
  function bodyBob(dz, t) { return 0.028 * Math.cos(TAU * (t * dz.beats / D) + 0.6); }

  // build dragon i in local coordinates (into LX/LY/LZ from index nv), with triangles and bone lines
  const RV = new Uint16Array(NS * RING), SPX = new Float32Array(NS), SPY = new Float32Array(NS), SPZ = new Float32Array(NS);
  function buildDragon(i, t) {
    const dz = DESIGN[i], m0 = i * 4 + 1;
    flight(i, t, FR);
    neckPose(i, t, FR.out, NECK);
    const glide = triW(t), q = wingPhase(dz, i, t), amp = dz.amp * (1 - 0.35 * NECK.env) * (1 - 0.82 * glide);
    const bob = bodyBob(dz, t), hx = NX0 + (NX1 - NX0) * dz.neck;
    // spine
    for (let k = 0; k < NS; k++) {
      const x0 = stx(dz, ST[k][0]);
      let y = neckRise(ST[k][0]) + bob, z = 0;
      if (ST[k][0] < -0.05) {                               // tail waves, lagging the wings
        const u = (-0.05 - ST[k][0]) / 0.78;
        z += 0.07 * u * u * Math.sin(TAU * (q * 0.5) - 5.5 * u + i);
        y += 0.06 * u * u * Math.sin(TAU * q - 4.5 * u) - 0.03 * u;
      }
      bend(x0, y, z, NECK.yaw, NECK.pitch, hx);
      SPX[k] = BX; SPY[k] = BY; SPZ[k] = BZ;
    }
    // rings
    for (let k = 0; k < NS; k++) {
      const a = Math.max(0, k - 1), b = Math.min(NS - 1, k + 1);
      let tx = SPX[a] - SPX[b], ty = SPY[a] - SPY[b], tz = SPZ[a] - SPZ[b];
      let n = Math.hypot(tx, ty, tz); tx /= n; ty /= n; tz /= n;
      let nx = -tx * ty, ny = 1 - ty * ty, nz = -tz * ty;
      n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      const rv = ST[k][1] * dz.girth, rh = ST[k][2] * dz.girth;
      for (let j = 0; j < RING; j++) {
        const th = TAU * j / RING + PI / 2, sv = Math.sin(th) * rv, ch = Math.cos(th) * rh;
        RV[k * RING + j] = vtx(SPX[k] + nx * sv + bx * ch, SPY[k] + ny * sv + by * ch, SPZ[k] + nz * sv + bz * ch);
      }
    }
    for (let k = 0; k < NS - 1; k++) {
      for (let j = 0; j < RING; j++) {
        const j1 = (j + 1) % RING;
        const a = RV[k * RING + j], b = RV[k * RING + j1], c = RV[(k + 1) * RING + j], d = RV[(k + 1) * RING + j1];
        const mm = (j === 2 || j === 3) && k >= 4 && k <= 16 ? m0 + 3 : m0;   // belly plates
        tri(a, b, c, mm); tri(b, d, c, mm);
      }
    }
    const top = (k) => RV[k * RING], bot = (k) => RV[k * RING + 3];
    const ringP = (k, j) => RV[k * RING + j];
    // jaw: drops open while breathing
    {
      const hk = 3, sk = 0;
      const hxp = SPX[hk], hyp = SPY[hk], hzp = SPZ[hk];
      let ax = SPX[sk] - hxp, ay = SPY[sk] - hyp - 0.012, az = SPZ[sk] - hzp;
      // rotate the jaw line downward about the head's side axis (approximate: drop in local y)
      const L = Math.hypot(ax, ay, az), dn = Math.sin(NECK.jaw) * L * 0.9;
      const tip = vtx(hxp + ax * Math.cos(NECK.jaw), hyp + ay - dn, hzp + az * Math.cos(NECK.jaw));
      tri(ringP(hk, 2), ringP(hk, 4), tip, m0);
      tri(ringP(hk, 2), ringP(1, 3), tip, m0);
      tri(ringP(hk, 4), ringP(1, 3), tip, m0);
    }
    // horns
    {
      const hk = 3, fx = SPX[1] - SPX[4], fy = SPY[1] - SPY[4], fz = SPZ[1] - SPZ[4];
      const fn = Math.hypot(fx, fy, fz), ux = fx / fn, uy = fy / fn, uz = fz / fn;
      // side axis of the head
      let sx = uy * 0 - uz * 1, sy = uz * 0 - ux * 0, sz = ux * 1 - uy * 0;
      const sn = Math.hypot(sx, sy, sz) || 1; sx /= sn; sy /= sn; sz /= sn;
      const hb = vtx(SPX[hk], SPY[hk], SPZ[hk]);
      for (const side of [-1, 1]) {
        const base1 = ringP(hk, side > 0 ? 1 : 5), base2 = ringP(hk, 0);
        if (dz.horn === 0) {          // long, straight, swept back
          const tip = vtx(SPX[hk] - ux * 0.20 + sx * side * 0.06, SPY[hk] - uy * 0.20 + 0.075, SPZ[hk] - uz * 0.20 + sz * side * 0.06);
          tri(base1, base2, tip, m0 + 3); seg(base1, tip, m0 + 3, 1);
          const cheek = vtx(SPX[hk + 1] - ux * 0.07 + sx * side * 0.05, SPY[hk + 1] - uy * 0.07 - 0.01, SPZ[hk + 1] - uz * 0.07 + sz * side * 0.05);
          tri(ringP(hk + 1, side > 0 ? 2 : 4), ringP(hk, side > 0 ? 2 : 4), cheek, m0 + 3);
        } else if (dz.horn === 1) {   // back, then hooked up and forward
          const mid = vtx(SPX[hk] - ux * 0.10 + sx * side * 0.035, SPY[hk] - uy * 0.10 + 0.05, SPZ[hk] - uz * 0.10 + sz * side * 0.035);
          const tip = vtx(SPX[hk] - ux * 0.07 + sx * side * 0.05, SPY[hk] - uy * 0.07 + 0.11, SPZ[hk] - uz * 0.07 + sz * side * 0.05);
          tri(base1, base2, mid, m0 + 3); seg(base1, mid, m0 + 3, 1); seg(mid, tip, m0 + 3, 1);
        } else {                       // a frill: three spines with skin between
          const tips = [];
          for (let f = 0; f < 3; f++) {
            const a = 0.35 + f * 0.5, L = 0.12 - f * 0.015;
            tips.push(vtx(SPX[hk] - ux * L * Math.cos(a) + sx * side * (0.03 + 0.03 * f), SPY[hk] + L * Math.sin(a) * 0.8 - uy * L * 0.3, SPZ[hk] - uz * L * Math.cos(a) + sz * side * (0.03 + 0.03 * f)));
          }
          tri(base1, tips[0], tips[1], m0 + 1); tri(base1, tips[1], tips[2], m0 + 1); tri(base1, tips[2], ringP(hk + 2, side > 0 ? 1 : 5), m0 + 1);
          for (const tp of tips) seg(base1, tp, m0 + 3, 1);
        }
      }
      void hb;
    }
    // dorsal spikes
    for (let k = 6; k < NS - 3; k += 1) {
      if (k % 2 && k > 9) continue;
      const h = dz.spike * (k < 9 ? 0.7 : k < 13 ? 1.0 : 1.0 - (k - 13) * 0.14);
      if (h <= 0.004) continue;
      const ux = SPX[k] - SPX[k + 1], uy = SPY[k] - SPY[k + 1], uz = SPZ[k] - SPZ[k + 1];
      const tip = vtx(SPX[k] - ux * 0.6, SPY[k] + ST[k][1] * dz.girth + h, SPZ[k] - uz * 0.6);
      tri(top(k), top(k + 1), tip, m0 + 3);
    }
    // tail tip
    {
      const k = NS - 3, e = NS - 1;
      const ux = SPX[k] - SPX[e], uz = SPZ[k] - SPZ[e];
      const un = Math.hypot(ux, uz) || 1, sxv = -uz / un, szv = ux / un;
      const P = (fx, side, dy) => vtx(SPX[e] + ux * fx + sxv * side, SPY[e] + dy, SPZ[e] + uz * fx + szv * side);
      if (dz.tip === 0) {             // blade
        const a = P(1.2, 0.07, 0), b = P(1.2, -0.07, 0), tip = P(-0.9, 0, 0), back = P(2.0, 0, 0);
        tri(a, tip, back, m0 + 3); tri(b, tip, back, m0 + 3);
      } else if (dz.tip === 1) {      // fan of three fins
        const root = P(1.0, 0, 0);
        const f1 = P(-0.6, 0.08, 0.02), f2 = P(-0.9, 0, 0.03), f3 = P(-0.6, -0.08, 0.02);
        tri(root, f1, f2, m0 + 1); tri(root, f2, f3, m0 + 1);
        seg(root, f1, m0 + 3, 1); seg(root, f2, m0 + 3, 1); seg(root, f3, m0 + 3, 1);
      } else {                         // double barb
        const a = P(0.2, 0.0, 0), tip = P(-0.7, 0, 0);
        const b1 = P(0.5, 0.07, 0), b2 = P(0.5, -0.07, 0);
        tri(a, tip, b1, m0 + 3); tri(a, tip, b2, m0 + 3);
        const c1 = P(1.4, 0.05, 0), c2 = P(1.4, -0.05, 0), r = P(1.9, 0, 0);
        tri(r, c1, a, m0 + 3); tri(r, c2, a, m0 + 3);
      }
    }
    // hind legs, tucked
    for (const side of [-1, 1]) {
      const k = 13;
      const hip = ringP(k, side > 0 ? 2 : 4), hip2 = ringP(k + 1, 3);
      const knee = vtx(SPX[k] + 0.02, SPY[k] - 0.075, SPZ[k] + side * 0.05);
      const foot = vtx(SPX[k] - 0.11, SPY[k] - 0.085, SPZ[k] + side * 0.06);
      tri(hip, hip2, knee, m0); tri(hip2, knee, foot, m0);
      seg(knee, foot, m0, 1);
    }
    // wings
    const up = Math.cos(TAU * q), fold = Math.max(0, -Math.sin(TAU * q)) * (1 - glide);
    const th1 = amp * 0.62 * up + 0.08 + 0.1 * glide, th2 = amp * 0.32 * Math.cos(TAU * q - 0.9), th3 = amp * 0.38 * Math.cos(TAU * q - 1.8);
    const swp = 0.16 * Math.sin(TAU * q);
    const bill = 0.035 * Math.sin(TAU * q - 1.2);
    let wx = 0, wy = 0, wz = 0;
    const wd = (psi, th, side) => { const c = Math.cos(psi); wx = -Math.sin(psi); wy = c * Math.sin(th); wz = c * Math.cos(th) * side; };
    for (const side of [-1, 1]) {
      const sk = 8, hk = 13;
      const Sx = SPX[sk] - 0.01, Sy = SPY[sk] + 0.035, Sz = SPZ[sk] + side * 0.045;
      const S = vtx(Sx, Sy, Sz, 0.2);
      wd(0.35 + 0.3 * fold - swp, th1, side);
      const Ex = Sx + dz.hum * wx, Ey = Sy + dz.hum * wy, Ez = Sz + dz.hum * wz;
      const E = vtx(Ex, Ey, Ez, 0);
      wd(-0.55 + 0.55 * fold - swp, th1 + th2, side);
      const Rx = Ex + dz.fore * wx, Ry = Ey + dz.fore * wy, Rz = Ez + dz.fore * wz;
      const R = vtx(Rx, Ry, Rz, 0);
      const Hx = SPX[hk] - 0.02, Hy = SPY[hk] + 0.01, Hz = SPZ[hk] + side * 0.04;
      const Hp = vtx(Hx, Hy, Hz, 0.3);
      const nf = dz.fing.length, tips = [];
      for (let f = 0; f < nf; f++) {
        const [ps, L] = dz.fing[f];
        wd(lerp(ps, 1.3, fold * 0.3) - swp * 0.5, th1 + th2 + th3 * (0.6 + 0.4 * f / nf), side);
        tips.push([Rx + L * wx, Ry + L * wy, Rz + L * wz]);
      }
      const T = tips.map((p) => vtx(p[0], p[1], p[2], 0));
      // membrane, with scalloped trailing edge and a little billow
      const mid = (a, b, pull, bl) => vtx(Rx + ((a[0] + b[0]) / 2 - Rx) * pull, Ry + ((a[1] + b[1]) / 2 - Ry) * pull + bl, Rz + ((a[2] + b[2]) / 2 - Rz) * pull, 1);
      for (let f = 0; f < nf - 1; f++) {
        const notch = dz.tip === 2 ? 0.58 : 0.68;
        const M = mid(tips[f], tips[f + 1], notch, bill);
        tri(R, T[f], M, m0 + 1); tri(R, M, T[f + 1], m0 + 1);
      }
      const last = tips[nf - 1];
      const M4 = vtx(lerp(last[0], Hx, 0.5) * 0.85 + Rx * 0.15, lerp(last[1], Hy, 0.5) * 0.85 + Ry * 0.15 + bill, lerp(last[2], Hz, 0.5) * 0.85 + Rz * 0.15, 1);
      tri(R, T[nf - 1], M4, m0 + 1); tri(R, M4, Hp, m0 + 1);
      tri(R, Hp, E, m0 + 1); tri(E, Hp, S, m0 + 1); tri(S, E, R, m0 + 1);
      // bones
      seg(S, E, m0 + 2, 2); seg(E, R, m0 + 2, 2);
      for (let f = 0; f < nf; f++) seg(R, T[f], m0 + 2, 1);
      wd(-1.1, th1 + th2, side);
      const claw = vtx(Rx + 0.05 * wx, Ry + 0.05 * wy - 0.01, Rz + 0.05 * wz);
      seg(R, claw, m0 + 3, 1);
    }
    return FR;
  }

  /* ================================================================ rasteriser */
  const ZB = new Float32Array(NP), IDB = new Uint8Array(NP), SHB = new Float32Array(NP);
  const LIGHT = (() => { const x = 0.25, y = -1, z = 0.45, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();
  function raster(a, b, c, mat, sh, gr) {
    const ax = SX[a], ay = SY[a], bx = SX[b], by = SY[b], cx = SX[c], cy = SY[c];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area * area < 1e-8) return;
    const inv = 1 / area;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const az = SZ[a], bz = SZ[b], cz = SZ[c];
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
        if (w0 < 0) continue;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
        if (w1 < 0) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < 0) continue;
        const z = w0 * az + w1 * bz + w2 * cz, i = y * W + x;
        if (z < ZB[i]) { ZB[i] = z; IDB[i] = mat; SHB[i] = gr ? sh * (0.55 + 0.75 * (w0 * VA[a] + w1 * VA[b] + w2 * VA[c])) : sh; }
      }
    }
  }
  function rline(a, b, mat, sh, wide) {
    const ax = SX[a], ay = SY[a], bx = SX[b], by = SY[b];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let k = 0; k <= n; k++) {
      const f = k / n, x = fl(lerp(ax, bx, f)), y = fl(lerp(ay, by, f)), z = lerp(SZ[a], SZ[b], f) - 0.02;
      for (let d = 0; d < wide; d++) {
        const xx = x, yy = y + d;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const i = yy * W + xx;
        if (z < ZB[i]) { ZB[i] = z; IDB[i] = mat; SHB[i] = sh; }
      }
    }
  }
  function drawDragons(t) {
    ZB.fill(1e9); IDB.fill(0);
    for (let i = 0; i < 3; i++) {
      nv = 0; nt = 0; nl = 0;
      const f = buildDragon(i, t), s = DESIGN[i].sc;
      for (let v = 0; v < nv; v++) {
        const x = LX[v], y = LY[v], z = LZ[v];
        const wx = f.px + s * (x * f.fx + y * f.ux + z * f.rx), wy = f.py + s * (x * f.fy + y * f.uy + z * f.ry), wz = f.pz + s * (x * f.fz + y * f.uz + z * f.rz);
        WXs[v] = wx; WYs[v] = wy; WZs[v] = wz;
        project(wx, wy, wz); SX[v] = PX; SY[v] = PY; SZ[v] = PZ;
      }
      for (let k = 0; k < nt; k++) {
        const a = TA[k], b = TB[k], c = TC[k];
        const ex = WXs[b] - WXs[a], ey = WYs[b] - WYs[a], ez = WZs[b] - WZs[a];
        const gx = WXs[c] - WXs[a], gy = WYs[c] - WYs[a], gz = WZs[c] - WZs[a];
        let nx = ey * gz - ez * gy, ny = ez * gx - ex * gz, nz = ex * gy - ey * gx;
        const nn = Math.hypot(nx, ny, nz); if (nn < 1e-12) continue;
        nx /= nn; ny /= nn; nz /= nn;
        if (nx * (cam.x - WXs[a]) + ny * (cam.y - WYs[a]) + nz * (cam.z - WZs[a]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const kind = (TM[k] - 1) & 3;
        let sh;
        if (kind === 1) sh = l >= 0 ? 0.15 + 0.85 * l : -(0.25 + 0.75 * -l);
        else sh = 0.1 + 0.9 * Math.max(0, l) * (0.85 + 0.15 * ny);
        raster(a, b, c, TM[k], sh, kind === 1);
      }
      for (let k = 0; k < nl; k++) rline(LA[k], LB[k], LM[k], 0.55, SZ[LA[k]] < 3.6 ? LWD[k] : 1);
    }
  }

  /* ================================================================ fire */
  const HEAT = new Float32Array(NP), SMK = new Float32Array(NP);
  const RATE = 100, FLIFE = 1.2, SLIFE = 2.8, NSLOT = RATE * D;
  const MOS = [];
  for (let i = 0; i < 3; i++) { const a = []; for (let k = 0; k < 400; k++) a.push({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, vx: 0, vy: 0, vz: 0, env: 0 }); MOS.push(a); }
  function splatHeat(x, y, z, r, h) {
    const xi = fl(x), yi = fl(y);
    if (r < 0.75) {
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
      const i = yi * W + xi; if (z < ZB[i]) HEAT[i] += h; return;
    }
    const R = Math.ceil(r), r2 = r * r;
    for (let dy = -R; dy <= R; dy++) {
      const yy = yi + dy; if (yy < 0 || yy >= H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = xi + dx; if (xx < 0 || xx >= W) continue;
        const d2 = dx * dx + dy * dy; if (d2 > r2) continue;
        const i = yy * W + xx; if (z < ZB[i]) HEAT[i] += h * (1 - 0.6 * d2 / r2);
      }
    }
  }
  function splatSmoke(x, y, z, r, h) {
    const xi = fl(x), yi = fl(y), R = Math.ceil(r), r2 = r * r + 0.5;
    for (let dy = -R; dy <= R; dy++) {
      const yy = yi + dy; if (yy < 0 || yy >= H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = xi + dx; if (xx < 0 || xx >= W) continue;
        const d2 = dx * dx + dy * dy; if (d2 > r2) continue;
        const i = yy * W + xx; if (z < ZB[i]) SMK[i] += h * (1 - d2 / r2);
      }
    }
  }
  function heatLine(x0, y0, z0, x1, y1, z1, h) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k < n; k++) {
      const f = k / n, x = fl(x0 + (x1 - x0) * f), y = fl(y0 + (y1 - y0) * f);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x; if (z0 + (z1 - z0) * f < ZB[i]) HEAT[i] += h;
    }
  }
  const NSTR = 9, NSPK = 9;
  const PVX = new Float32Array(NSTR), PVY = new Float32Array(NSTR), PVZ = new Float32Array(NSTR), PVOK = new Uint8Array(NSTR);
  const PB = { x: 0, y: 0, z: 0 };
  // position of a fire particle born at slot n (time te), now tau old; strand k in 0..2, radius scale rs, phase jitter pj
  function firePos(M, tau, k, rs, sp, pj, i, o) {
    let e1x = -M.dz, e1y = 0, e1z = M.dx;
    let en = Math.hypot(e1x, e1z); if (en < 1e-4) { e1x = 1; e1z = 0; en = 1; }
    e1x /= en; e1z /= en;
    const e2x = M.dy * e1z - M.dz * e1y, e2y = M.dz * e1x - M.dx * e1z, e2z = M.dx * e1y - M.dy * e1x;
    const K = 1.45, tf = (1 - Math.exp(-K * tau)) / K;
    let x = M.x + M.dx * sp * tf + M.vx * tf * 0.6, y = M.y + M.dy * sp * tf + M.vy * tf * 0.6, z = M.z + M.dz * sp * tf + M.vz * tf * 0.6;
    const lift = 0.34 * tau * tau;
    x += cam.ux * lift; y += cam.uy * lift; z += cam.uz * lift;
    const ang = TAU * (2.3 * tau + k / 3 + pj) + i * 2;
    const rb = (0.02 + 0.15 * tau + 0.07 * tau * tau) * rs;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    x += (ca * e1x + sa * e2x) * rb; y += (ca * e1y + sa * e2y) * rb; z += (ca * e1z + sa * e2z) * rb;
    const tw = 0.06 * tau * tau, ph = pj * 9 + i;
    x += tw * Math.sin(5 * tau + ph); y += tw * Math.sin(4 * tau + ph * 1.3); z += tw * Math.cos(6 * tau + ph);
    o.x = x; o.y = y; o.z = z;
  }
  function drawFire(t) {
    HEAT.fill(0); SMK.fill(0);
    for (let i = 0; i < 3; i++) {
      const n1 = fl(t * RATE), n0 = Math.ceil((t - SLIFE) * RATE);
      PVOK.fill(0);
      for (let n = n1; n >= n0; n--) {            // newest first, so strands are drawn from the mouth outward
        const te = n / RATE, tau = t - te;
        const env = breath(i, te);
        if (env <= 0.01) { PVOK.fill(0); continue; }
        const M = MOS[i][mod(n, 400)];
        if (M.n !== n) { mouthAt(i, te, M); M.n = n; }
        const ns = mod(n, NSLOT), stage = tau / FLIFE;
        const wob = lvn(te * 6, 6 * D, 200 + i);
        // braided strands: continuous threads joined slot to slot
        for (let j = 0; j < NSTR; j++) {
          if (tau > SLIFE) { PVOK[j] = 0; continue; }
          const rs = j < 3 ? 0.45 + 0.25 * wob : j < 6 ? 1.0 + 0.3 * wob : 1.6 + 0.4 * wob;
          const sp = 2.7 * (j < 3 ? 1 : 0.93) * (0.55 + 0.45 * env);
          firePos(M, tau, j % 3, rs, sp, j < 3 ? 0 : j < 6 ? 0.5 : 0.25, i, PB);
          project(PB.x, PB.y, PB.z);
          const ok = PZ > 0.3;
          if (stage < 1 && ok) {
            const flick = 0.72 + 0.28 * Math.sin(TAU * (tau * 9 + j * 0.37 + i * 0.2));
            const temp = env * Math.pow(1 - stage, 1.0) * flick * (j < 3 ? 0.7 : j < 6 ? 0.45 : 0.28);
            if (PVOK[j] && Math.abs(PX - PVX[j]) < 14 && Math.abs(PY - PVY[j]) < 14) heatLine(PVX[j], PVY[j], PVZ[j], PX, PY, PZ, temp);
            else splatHeat(PX, PY, PZ, 0, temp);
          }
          if (stage > 0.6 && ok && (n & 1) === 0 && j < 6) {
            const ss = clamp((tau - FLIFE * 0.6) / (SLIFE - FLIFE * 0.6), 0, 1);
            const r = (0.015 + 0.06 * ss) * FOC / PZ;
            splatSmoke(PX, PY, PZ, Math.min(6, r), 0.16 * env * Math.sin(PI * Math.min(1, ss * 1.3 + 0.15)));
          }
          PVX[j] = PX; PVY[j] = PY; PVZ[j] = PZ; PVOK[j] = ok ? 1 : 0;
        }
        // loose embers through the body, and sparks flung out
        for (let j = 0; j < NSPK; j++) {
          const h1 = ih(ns, j, i * 11 + 1), h2 = ih(ns, j, i * 11 + 2), h3 = ih(ns, j, i * 11 + 3);
          const spark = j >= NSPK - 2;
          const life = spark ? 0.7 + 0.9 * h3 : FLIFE * (0.7 + 0.4 * h3);
          if (tau > life) continue;
          firePos(M, tau, fl(h1 * 3), spark ? 1.8 + 1.8 * h2 : 0.2 + 1.8 * h2, 2.7 * (0.8 + 0.35 * h1) * (0.55 + 0.45 * env), h3, i, PB);
          project(PB.x, PB.y, PB.z);
          if (PZ < 0.3) continue;
          const st = tau / life;
          const flick = 0.5 + 0.5 * Math.sin(TAU * (h1 * 7 + tau * (spark ? 13 : 8)));
          splatHeat(PX, PY, PZ, 0, env * (spark ? 1.6 : 0.9) * (1 - st) * (0.4 + 0.6 * flick));
        }
      }
    }
  }

  /* ================================================================ static scene */
  const CEH = 150;
  const CT1 = new Float32Array(W * (CEH + 4));
  const SKYQ = new Float32Array(NP);
  const STREAK = new Float32Array(W * H);
  const LAND = new Uint8Array(NP);
  const PLT = new Float32Array(64 * 360);
  const WINDOWS = [], FIRES = [], LAVA = [];
  const HZ = 272;
  const VOLC = [{ x: 64, y: 240, s: 0.56 }, { x: 222, y: 257, s: 0.7 }];
  let built = false;
  const CELLS = [45, 27, 15, 9, 5];
  function build() {
    if (built) return;
    built = true;
    // smoke ceiling textures, periodic in x
    for (let y = 0; y < CEH + 4; y++) {
      for (let x = 0; x < W; x++) {
        const wq = fbmp(x, y * 1.4, [45, 27, 15], W, 0, 11);
        const wr = fbmp(x + 31, y * 1.4 + 17, [45, 27, 15], W, 0, 12);
        const xx = x + (wq - 0.5) * 50, yy = y + (wr - 0.5) * 26;
        CT1[y * W + x] = fbmp(xx, yy, CELLS, W, 0, 21);
      }
    }
    // sky glow
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let q = 3.6 + 9.6 * Math.exp(-(HZ - y) / 88);
        const dv = (x - VOLC[0].x) / 60;
        q += 2.4 * Math.exp(-dv * dv) * Math.exp(-Math.max(0, VOLC[0].y - y) / 70);
        const dw = (x - 175) / 90;
        q += 1.0 * Math.exp(-dw * dw) * Math.exp(-Math.max(0, HZ - y) / 50);
        SKYQ[y * W + x] = Math.min(15.4, q);
        STREAK[y * W + x] = fbmp(x, y * 6.5, [45, 27, 15], W, 0, 55) - 0.5;
      }
    }
    // rising plume texture, periodic in y (360) so it can scroll one wrap per loop
    for (let y = 0; y < 360; y++) for (let x = 0; x < 64; x++) PLT[y * 64 + x] = fbmp(x * 1.3, y, [40, 24, 12, 8], 0, 360, 66);
    buildLand();
    buildEmbers();
  }
  function buildLand() {
    LAND.fill(255);
    const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) LAND[y * W + x] = c; };
    // volcanoes (far): obsidian cones with cracked ridges
    for (let x = 0; x < W; x++) {
      for (const [vi, v] of VOLC.entries()) {
        const dx = Math.abs(x - v.x);
        let top = v.y + dx * v.s + (fbmp(x, vi * 50, [9, 5], 0, 0, 70 + vi) - 0.5) * 7 + Math.max(0, dx - 40) * 0.25;
        if (dx < 6) top = v.y + 2 + (6 - dx) * 0.4 * (dx < 4 ? 1 : 0);       // crater notch
        top = Math.round(top);
        for (let y = Math.max(0, top); y < H; y++) {
          const cur = LAND[y * W + x];
          const c = y < top + 1 ? 5 : vi === 0 ? 3 : 4;
          if (cur === 255 || (cur !== 255 && c < cur)) LAND[y * W + x] = c;
        }
      }
    }
    // lava rivers from the craters
    for (const [vi, v] of VOLC.entries()) {
      const nr = vi === 0 ? 5 : 3;
      for (let r = 0; r < nr; r++) {
        let x = v.x + (ih(r, vi, 80) - 0.5) * 8, y = v.y + 3;
        const dir = (r % 2 ? 1 : -1) * (0.3 + ih(r, vi, 81) * 0.6);
        const len = 14 + ih(r, vi, 82) * 34, path = [];
        for (let k = 0; k < len; k++) {
          x += dir * (0.6 + 0.8 * Math.sin(k / 5 + r)) + (ih(k, r * 7 + vi, 83) - 0.5) * 1.2; y += 1;
          path.push([Math.round(x), Math.round(y)]);
        }
        LAVA.push({ path, ph: ih(r, vi, 84), sp: 3 + fl(ih(r, vi, 85) * 3), vi });
      }
    }
    // the far ruined city
    let x = -4;
    let bi = 0;
    while (x < W + 4) {
      const w = 4 + fl(ih(bi, 1, 90) * 9), h = 10 + ih(bi, 2, 90) * 20, base = 296;
      const type = ih(bi, 3, 90);
      for (let xx = x; xx < x + w; xx++) {
        let top = base - h + fl(ih(xx, bi, 91) * 3);
        if (type < 0.25) top = base - h + Math.abs(xx - x - w / 2) * 1.6;     // gable
        for (let y = Math.round(top); y < H; y++) put(xx, y, 2);
      }
      if (type > 0.8) for (let k = 0; k < 6; k++) put(x + fl(w / 2), Math.round(base - h - k), 2); // spire stub
      for (let k = 0; k < w * h * 0.015; k++) WINDOWS.push({ x: x + 1 + fl(ih(bi, k, 92) * (w - 2)), y: Math.round(base - h + 3 + ih(bi, k, 93) * (h - 4)), ph: ih(bi, k, 94), far: 1 });
      x += w + (ih(bi, 4, 90) < 0.25 ? 2 : 0); bi++;
    }
    // a great broken dome
    {
      const dcx = 182, dcy = 266, R = 18;
      for (let yy = dcy - R; yy <= dcy; yy++) for (let xx = dcx - R; xx <= dcx + R; xx++) {
        const d = Math.hypot(xx - dcx, (yy - dcy) * 1.1);
        if (d > R) continue;
        const ang = Math.atan2(dcy - yy, xx - dcx);
        if (ang > 0.5 && ang < 1.25 && d > R * 0.35 + ih(xx, yy, 95) * 4) continue;   // the bite out of it
        put(xx, yy, 2);
      }
      for (let yy = dcy; yy < 300; yy++) for (let xx = dcx - R - 2; xx <= dcx + R + 2; xx++) put(xx, yy, 2);
      for (let k = 0; k < 9; k++) put(dcx - 6 + (k % 3), dcy - R - 1 - fl(k / 3), 2);
    }
    // the near ruined city
    x = -6; bi = 0;
    while (x < W + 6) {
      const w = 5 + fl(ih(bi, 1, 100) * 12), base = 310;
      let h = 8 + ih(bi, 2, 100) * 22;
      const type = ih(bi, 3, 100);
      if (type > 0.86) h += 22;
      const brk = ih(bi, 5, 100);
      for (let xx = x; xx < x + w; xx++) {
        const u = (xx - x) / w;
        let top = base - h;
        if (type > 0.86) top += Math.max(0, Math.abs(u - 0.5) * 2 - 0.4) * 30;            // tower with shoulders
        if (brk > 0.4) top += fl(Math.max(0, (brk > 0.7 ? u : 1 - u) - 0.3) * h * 0.9 * ih(xx, bi, 101));  // ruined top
        top += fl(ih(xx, bi, 102) * 2);
        for (let y = Math.round(top); y < H; y++) put(xx, y, 1);
      }
      for (let k = 0; k < w * h * 0.012; k++) WINDOWS.push({ x: x + 1 + fl(ih(bi, k, 104) * (w - 2)), y: Math.round(base - h + 4 + ih(bi, k, 105) * (h - 4)), ph: ih(bi, k, 106), far: 0 });
      if (ih(bi, 9, 100) < 0.35) FIRES.push({ x: x + fl(w / 2), y: null, w: Math.max(3, fl(w * 0.6)), ph: ih(bi, 10, 100), s: bi });
      x += w + (ih(bi, 4, 100) < 0.3 ? 1 + fl(ih(bi, 11, 100) * 4) : 0); bi++;
    }
    for (const f of FIRES) { let y = 0; while (y < H && LAND[y * W + f.x] === 255) y++; f.y = y; }
    // foreground rubble
    for (let xx = 0; xx < W; xx++) {
      const top = Math.round(326 + (fbmp(xx, 0, [15, 9, 5], 0, 0, 110) - 0.5) * 10);
      for (let y = top; y < H; y++) put(xx, y, 0);
    }
  }

  /* ================================================================ particles */
  const ASH = [];
  for (let k = 0; k < 380; k++) {
    const layer = k < 170 ? 0 : k < 300 ? 1 : 2;
    ASH.push({ layer, x: ih(k, 1, 120) * 300 - 15, y: ih(k, 2, 120) * 360, sw: 1 + ih(k, 3, 120) * 3, sp: ih(k, 4, 120), sc: 1 + fl(ih(k, 5, 120) * 3), hot: ih(k, 6, 120) < 0.12 });
  }
  const EMB = [];
  function buildEmbers() {
    const src = FIRES.map((f) => [f.x, f.y - 2, 1]).concat([[VOLC[0].x, VOLC[0].y, 2.5], [VOLC[1].x, VOLC[1].y, 1]]);
    let tot = 0; for (const s of src) tot += s[2];
    for (let k = 0; k < 230; k++) {
      let u = ih(k, 7, 120) * tot, sI = 0;
      while (sI < src.length - 1 && u > src[sI][2]) { u -= src[sI][2]; sI++; }
      const [sx, sy] = src[sI];
      EMB.push({ sx: sx + (ih(k, 1, 121) - 0.5) * 6, sy, y: ih(k, 2, 121), r: 1.5 + ih(k, 3, 121) * 6, cyc: 4 + fl(ih(k, 4, 121) * 8), ph: ih(k, 5, 121), v: 1 + fl(ih(k, 6, 121) * 2), tw: 10 + fl(ih(k, 8, 121) * 20), near: ih(k, 9, 121) < 0.22, wind: 0.08 + ih(k, 10, 121) * 0.2 });
    }
  }
  const VORT = [];
  for (let k = 0; k < 170; k++) {
    VORT.push({ r: 1.25 + ih(k, 1, 130) * 1.1, a: ih(k, 2, 130) * TAU, w: (ih(k, 3, 130) < 0.5 ? 2 : 3), y: ih(k, 4, 130) * 3, v: 1 + fl(ih(k, 5, 130) * 2), tw: 12 + fl(ih(k, 6, 130) * 24), ph: ih(k, 7, 130), wob: ih(k, 8, 130) });
  }
  const FOUNT = [];
  for (let k = 0; k < 46; k++) FOUNT.push({ ph: ih(k, 1, 140), vx: (ih(k, 2, 140) - 0.5) * 16, vy: 20 + ih(k, 3, 140) * 22, P: [1.5, 2, 3][fl(ih(k, 4, 140) * 3)] });

  /* ================================================================ background */
  const BUF = new Uint8Array(NP), BG = new Uint8Array(NP);
  let FLARE = 0;
  const RB = new Float32Array(H);
  function drawSky(t, buf) {
    // streaming haze in the open sky
    const off = (W / D) * t * 2;   // two wraps per loop, drifting left
    const so = fl(off);
    for (let y = 0; y < H; y++) { const b = 0.5 + 0.5 * Math.sin(TAU * (y / 46 + t * 4 / D)); RB[y] = 0.55 * Math.pow(b, 6) * sstep(110, 250, y); }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let q = SKYQ[i] + 2.0 * STREAK[y * W + mod(x + so, W)] * sstep(60, 190, y) + FLARE * 0.8 * sstep(40, 200, y) + RB[y];
        let k = fl(q); const f = q - k;
        if (f > 0.55 && (f - 0.55) / 0.45 > bay(x, y)) k++;
        buf[i] = clamp(k, 0, 16);
      }
    }
    drawCeiling(t, buf);
  }
  // the smoke ceiling: hundreds of billows, each shaded as a ball lit from the fire below, drifting at its own
  // speed (each wraps exactly once per loop) and churning on a small circle
  const PUFFS = [], PTIER = new Int8Array(400);
  {
    // [count, y0, y1, r0, r1, span]: each tier is an evenly spaced row of overlapping lobes sharing one drift
    const tiers = [[22, -12, 22, 26, 40, W + 100], [30, 16, 54, 18, 30, W + 140], [34, 50, 84, 13, 22, W + 70], [34, 76, 92, 10, 15, W + 110]];
    let k = 0, TIER = -1;
    for (const [n, y0, y1, r0, r1, span] of tiers) {
      TIER++;
      for (let j = 0; j < n; j++, k++) {
        const r = r0 + ih(k, 1, 300) * (r1 - r0);
        PUFFS.push({ tier: TIER, x: (j + 0.7 * ih(k, 2, 300)) / n, y: y0 + ih(k, 3, 300) * (y1 - y0), r, span, ph: ih(k, 5, 300), cy: 1 + fl(ih(k, 6, 300) * 3), tex: ih(k, 7, 300) * 200 });
      }
    }
    PUFFS.sort((a, b) => a.y - b.y);
    for (let k = 0; k < PUFFS.length; k++) PTIER[k] = PUFFS[k].tier;
  }
  const PID = new Int16Array(W * CEH), RUN = new Uint8Array(W * CEH);
  function drawCeiling(t, buf) {
    // a dark lid at the very top
    for (let y = 0; y < 26; y++) for (let x = 0; x < W; x++) {
      const q = 0.6 + (y / 26) * 1.2 + (CT1[y * W + mod(x + fl(t * W / D), W)] - 0.5) * 2;
      buf[y * W + x] = clamp(fl(q + bay(x, y) - 0.5), 0, 2);
    }
    // 1. every billow paints its id; lower billows are nearer and paint last
    PID.fill(-1);
    for (let k = 0; k < PUFFS.length; k++) {
      const p = PUFFS[k];
      const ang = TAU * (p.cy * t / D + p.ph);
      const cx = mod(p.x * p.span + (p.span / D) * t, p.span) - 45;
      const cy = p.y + 2.5 * Math.sin(ang);
      const r = p.r * (1 + 0.07 * Math.cos(ang + 1.3));
      const x0 = Math.max(0, fl(cx - r - 2)), x1 = Math.min(W - 1, Math.ceil(cx + r + 2));
      const y0 = Math.max(0, fl(cy - r - 2)), y1 = Math.min(CEH - 1, Math.ceil(cy + r + 2));
      for (let y = y0; y <= y1; y++) {
        const dy = (y + 0.5 - cy) / r;
        for (let x = x0; x <= x1; x++) {
          const dx = (x + 0.5 - cx) / r;
          const tx = CT1[y * W + mod(x + fl(p.tex), W)] - 0.5;
          if (Math.sqrt(dx * dx + dy * dy) + tx * 0.6 > 0.95) continue;
          PID[y * W + x] = k;
        }
      }
    }
    // 2. distance up from the nearest visible underside (a 90-degree chamfer), then light by it
    for (let y = CEH - 1; y >= 0; y--) {
      for (let x = 0; x < W; x++) {
        const j = y * W + x, k = PID[j];
        if (k < 0) { RUN[j] = 0; continue; }
        let rr = 0;
        const tk = PTIER[k];
        const tb = (jj) => (PID[jj] < 0 ? -1 : PTIER[PID[jj]]);
        if (y < CEH - 1) {
          const jb = j + W;
          if (tb(jb) >= tk) {
            let m = RUN[jb];
            if (x > 0) m = Math.min(m, tb(jb - 1) >= tk ? RUN[jb - 1] : 0);
            if (x < W - 1) m = Math.min(m, tb(jb + 1) >= tk ? RUN[jb + 1] : 0);
            if (x > 1) m = Math.min(m, tb(jb - 2) >= tk ? RUN[jb - 2] : 0);
            if (x < W - 2) m = Math.min(m, tb(jb + 2) >= tk ? RUN[jb + 2] : 0);
            rr = Math.min(250, m + 1);
          }
        }
        RUN[j] = rr;
        const p = PUFFS[k];
        const low = sstep(-10, 115, p.y);
        const hot = SKYQ[Math.min(H - 1, y + 70) * W + x] - 5;
        const L = (3.6 + 5.0 * low + 0.6 * hot + FLARE * 2.6) * (0.15 + 0.85 * low * low);
        const tx = CT1[y * W + mod(x + fl(p.tex) + 40, W)] - 0.5;
        const g = rr <= 0 ? 1 : rr <= 1 ? 0.84 : rr <= 2 ? 0.68 : rr <= 4 ? 0.5 : rr <= 7 ? 0.32 : rr <= 12 ? 0.17 : 0.06;
        let q = 0.7 + 1.1 * low + g * L + tx * 1.6;
        let kk = fl(q); if (q - kk > bay(x, y)) kk++;
        buf[j] = clamp(kk, 0, 13);
      }
    }
  }
  function drawPlumes(t, buf) {
    const rise = (360 / D) * t;
    const plumes = [[VOLC[0].x, VOLC[0].y + 2, 0.3, 1]];
    for (const [pi, p] of plumes.entries()) {
      const [x0, y0, lean, glow] = p;
      for (let y = Math.max(30, y0 - 120); y < y0; y++) {
        const hgt = y0 - y, w = 3 + hgt * (glow ? 0.22 : 0.16);
        const xc = x0 + lean * hgt + 5 * Math.sin(hgt / 23 + pi) * Math.min(1, hgt / 60);
        const fade = sstep(120, 40, hgt);
        for (let x = Math.max(0, fl(xc - w)); x <= Math.min(W - 1, Math.ceil(xc + w)); x++) {
          const u = (x - xc) / w, prof = 1 - u * u;
          if (prof <= 0) continue;
          const n = PLT[mod(fl(y + rise + pi * 90), 360) * 64 + mod(fl((x - xc) * 1.2 + 32 + pi * 7), 64)];
          const v = prof * fade * (0.45 + n) - 0.55;
          if (v <= 0) continue;
          const i = y * W + x;
          if (v < 0.06 && v / 0.06 < bay(x, y)) continue;
          if (glow) {
            const g = sstep(110, 0, hgt) ;
            let q = 3.6 + g * 7 - Math.max(0, u) * 1.4 + (n - 0.5) * 2 + FLARE;
            let k = fl(q); if (q - k > bay(x, y)) k++;
            buf[i] = clamp(k, 1, 14);
          } else {
            const lit = u < -0.35 ? 1 : 0;
            buf[i] = Math.max(1, Math.min(buf[i], (v > 0.2 ? 3 : 4) + lit + (n > 0.6 ? 1 : 0)));
          }
        }
      }
    }
  }
  function drawLand(t, buf) {
    for (let i = 0; i < NP; i++) if (LAND[i] !== 255) buf[i] = LAND[i];
    // crater glow
    for (const [vi, v] of VOLC.entries()) {
      for (let dy = -2; dy < 5; dy++) for (let dx = -6; dx <= 6; dx++) {
        const x = v.x + dx, y = v.y + 2 + dy; if (x < 0 || x >= W) continue;
        const i = y * W + x; if (LAND[i] === 255) continue;
        const d = Math.hypot(dx * 0.6, dy);
        const pulse = 0.5 + 0.5 * Math.sin(TAU * (t * 6 / D) + vi * 2 + dx * 0.3);
        const q = 15 - d * 2.4 + pulse * 1.5 - vi * 2;
        if (q > 8) buf[i] = clamp(fl(q + bay(x, y) - 0.5), 8, 16);
      }
    }
    // lava rivers, pulses running down
    for (const L of LAVA) {
      const n = L.path.length;
      for (let k = 0; k < n; k++) {
        const [x, y] = L.path[k]; if (x < 0 || x >= W || y >= H) continue;
        const i = y * W + x; if (LAND[i] === 255 || LAND[i] < 2) continue;
        const u = k / n;
        const pulse = 0.5 + 0.5 * Math.sin(TAU * (k / 9 - t * L.sp * 4 / D + L.ph));
        const q = 13.5 - u * 5 - L.vi * 1.5 + pulse * 2.2;
        buf[i] = clamp(fl(q + bay(x, y) - 0.5), 7, 15);
        if (u < 0.5 && pulse > 0.7 && x + 1 < W && LAND[i + 1] !== 255 && LAND[i + 1] >= 2) buf[i + 1] = 8;
      }
    }
    // lava fountain over the main crater
    const v = VOLC[0];
    for (const [k, p] of FOUNT.entries()) {
      const tt = mod(t / p.P + p.ph, 1) * p.P;
      const x = v.x + p.vx * tt, y = v.y + 1 - p.vy * tt + 26 * tt * tt;
      if (y > v.y + 3) continue;
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || xi >= W || yi < 0) continue;
      const u = tt / p.P;
      buf[yi * W + xi] = u < 0.3 ? 16 : u < 0.6 ? 14 : 12;
      if (u < 0.5 && yi + 1 < H) buf[(yi + 1) * W + xi] = 11;
      void k;
    }
    // windows and arches
    for (const w of WINDOWS) {
      if (w.x < 0 || w.x >= W) continue;
      const i = w.y * W + w.x; if (LAND[i] === 255) continue;
      const fl1 = lvn(t * 3 + w.ph * 50, 72, 150 + fl(w.ph * 100));
      const q = (w.far ? 8.5 : 10.5) + fl1 * 4;
      buf[i] = clamp(fl(q), 7, 15);
    }
    // the streets burn: firelight climbs the lower walls of the near city
    for (let x = 0; x < W; x++) {
      const fx = lvn(x / 9 + t * 1.5, 36, 190);
      const base = Math.round(326 + (fbmp(x, 0, [15, 9, 5], 0, 0, 110) - 0.5) * 10);
      const fl2 = 0.75 + 0.25 * lvn(t * 3 + x / 5, 72, 191);
      for (let y = base - 30; y < base; y++) {
        const i = y * W + x, L = LAND[i]; if (L !== 1 && L !== 2) continue;
        const u = (y - (base - 30)) / 30;
        const q = L + Math.pow(u, 1.6) * (4.5 + 5.5 * fx) * fl2 * (L === 2 ? 1.15 : 1);
        let k = fl(q); if (q - k > bay(x, y)) k++;
        buf[i] = Math.min(11, k);
      }
      if (LAND[(base - 1) * W + x] !== 0 && base < H) buf[base * W + x] = fx > 0.5 ? 5 : 4;   // the rubble's lit lip
    }
    // rooftop fires: a few licking tongues each
    for (const f of FIRES) {
      for (let k = 0; k < 3; k++) {
        const cx = f.x + (k - 1) * f.w * 0.45;
        const hh = (3 + f.w * 0.9) * (0.55 + 0.45 * lvn(t * 3 + k * 7 + f.ph * 40, 72, 160 + f.s)) * (k === 1 ? 1.2 : 0.8);
        const hw = 1 + f.w * 0.22;
        const sway = 2.2 * (lvn(t * 2 + k * 3 + f.ph * 20, 48, 170 + f.s) - 0.5);
        let gy = f.y; const xi = Math.round(cx); if (xi < 0 || xi >= W) continue;
        while (gy < H && LAND[gy * W + xi] === 255) gy++;
        for (let yy = 0; yy < hh; yy++) {
          const u = yy / hh, half = hw * Math.pow(1 - u, 0.8) + 0.3, xc = cx + sway * u * u;
          const y = gy - 1 - yy; if (y < 0) break;
          for (let x = Math.round(xc - half); x <= Math.round(xc + half); x++) {
            if (x < 0 || x >= W) continue;
            const e = Math.abs(x - xc) / (half + 0.5);
            const q = 16 - u * 6.5 - e * 3.5;
            if (q < 9.2 && bay(x, y) > (q - 8) / 1.2) continue;
            buf[y * W + x] = clamp(fl(q + bay(x, y) * 0.8), 9, 16);
          }
        }
      }
    }
  }
  function shimmer(t, buf) {
    // heat shimmer: whole-pixel row shifts in bands that roll upward
    for (let y = 120; y < H; y++) {
      const band = 0.5 + 0.5 * Math.sin(TAU * (y / 46 + t * 4 / D));
      const amp = sstep(120, 290, y) * band * band * 1.8;
      const s = Math.round(amp * Math.sin(TAU * (y / 7 + t * 12 / D)));
      if (!s) continue;
      const o = y * W;
      for (let x = 0; x < W; x++) BG[x] = buf[o + clamp(x - s, 0, W - 1)];
      for (let x = 0; x < W; x++) buf[o + x] = BG[x];
    }
  }

  /* ================================================================ particles */
  function drawAsh(t, buf, layer) {
    for (const a of ASH) {
      if (a.layer !== layer) continue;
      const wraps = layer + 1, span = 360;
      const y = mod(a.y + (span * wraps / D) * t, span) - 12;
      const drift = layer === 0 ? 0 : (300 / D) * t * (layer === 2 ? 2 : 1);
      const x = mod(a.x + drift + a.sw * 2 * Math.sin(TAU * (t * (3 + layer) / D + a.sp)), 300) - 15;
      const xi = Math.round(x), yi = Math.round(y);
      const col = a.hot ? (lvn(t * 4 + a.sp * 40, 96, 170) > 0.5 ? 11 : 9) : layer === 0 ? 19 : layer === 1 ? 20 : 22;
      const shape = layer === 2 ? mod(fl(t * 8 + a.sp * 4), 4) : layer === 1 && a.sc > 2 ? 1 : 0;
      const pts = shape === 0 ? [[0, 0]] : shape === 1 ? [[0, 0], [1, 0]] : shape === 2 ? [[0, 0], [1, 1]] : [[0, 0], [0, 1]];
      if (layer === 2 && a.sc > 1) pts.push([shape === 3 ? 1 : 0, shape === 1 ? 1 : shape === 3 ? 0 : -1]);
      for (const [dx, dy] of pts) {
        const xx = xi + dx, yy = yi + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        buf[yy * W + xx] = dx === 0 && dy === 0 && layer === 2 && !a.hot ? 23 : col;
      }
    }
  }
  function drawEmbers(t, buf, near) {
    // embers stream up from every fire, spiralling wider and cooling as they climb
    for (const e of EMB) {
      if (e.near !== near) continue;
      const span = e.sy + 30, h = mod(e.y * span + (span * e.v / D) * t, span), yy = e.sy - h;
      if (yy < -2) continue;
      const age = h / span;
      const x = e.sx + e.r * (0.3 + 2.2 * age) * Math.sin(TAU * (e.cyc * t / D + e.ph)) + h * e.wind;
      const xi = Math.round(x), yi = Math.round(yy);
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue;
      const tw = 0.5 + 0.5 * Math.sin(TAU * (e.tw * t / D + e.ph * 3));
      let c = age < 0.12 ? 15 : age < 0.3 ? 14 : age < 0.5 ? 12 : age < 0.75 ? 11 : 9;
      if (tw < 0.25) c -= 2;
      if (tw < 0.1 && age > 0.5) continue;
      buf[yi * W + xi] = c;
      if (near && xi + 1 < W) buf[yi * W + xi + 1] = Math.max(7, c - 2);
    }
  }
  function drawVortex(t, buf) {
    for (const p of VORT) {
      const a = p.a + TAU * p.w * t / D;
      const yy = mod(p.y + 3 * p.v * t / D, 3) - 1.5;
      const rr = p.r * (1 + 0.15 * Math.sin(TAU * (t * 2 / D + p.wob)));
      project(rr * Math.cos(a), yy, rr * Math.sin(a));
      const xi = fl(PX), yi = fl(PY);
      if (xi < 0 || xi >= W || yi < 0 || yi >= H || PZ < 0.3) continue;
      const edge = 1.5 - Math.abs(yy);
      if (edge < 0.3 && edge / 0.3 < bay(xi, yi)) continue;
      const i = yi * W + xi;
      if (PZ > ZB[i]) continue;
      const tw = 0.5 + 0.5 * Math.sin(TAU * (p.tw * t / D + p.ph));
      const c = tw > 0.8 ? 15 : tw > 0.45 ? 13 : tw > 0.15 ? 11 : 9;
      buf[i] = c;
      if (FOC / PZ > 92 && xi + 1 < W) buf[i + 1] = Math.max(8, c - 2);
    }
  }

  /* ================================================================ compositing */
  const GLW = 135, GLH = 169, GLO = new Float32Array(GLW * GLH), GLT = new Float32Array(GLW * GLH);
  function computeGlow() {
    GLO.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = HEAT[y * W + x]; if (h > 0) GLO[(y >> 1) * GLW + (x >> 1)] += Math.min(h, 2); }
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < GLH; y++) for (let x = 0; x < GLW; x++) {
        const i = y * GLW + x;
        GLT[i] = (GLO[i] * 2 + (x > 0 ? GLO[i - 1] : 0) + (x < GLW - 1 ? GLO[i + 1] : 0)) * 0.25;
      }
      for (let y = 0; y < GLH; y++) for (let x = 0; x < GLW; x++) {
        const i = y * GLW + x;
        GLO[i] = (GLT[i] * 2 + (y > 0 ? GLT[i - GLW] : 0) + (y < GLH - 1 ? GLT[i + GLW] : 0)) * 0.25;
      }
    }
  }
  const glowAt = (x, y) => GLO[(y >> 1) * GLW + (x >> 1)];
  function applyGlow(buf) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (IDB[i]) continue;
      const g = glowAt(x, y);
      if (g < 0.04) continue;
      const c = buf[i];
      if (c > 16) continue;
      buf[i] = Math.min(16, c + fl(g * 3.2 + bay(x, y)));
    }
  }
  function resolveDragons(buf) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, m = IDB[i];
      if (!m) continue;
      const d = (m - 1) >> 2, kind = (m - 1) & 3, z = ZB[i];
      const g = glowAt(x, y);
      let s = SHB[i];
      let ramp;
      if (kind === 1 && s < 0) { ramp = TRANS[d]; s = -s + g * 0.4; }
      else { ramp = kind === 1 ? MEMB[d] : kind === 3 ? HORN[d] : kind === 2 ? BONE[d] : BODY[d]; s += g * 0.45; }
      const n = ramp.length;
      let c = ramp[clamp(fl(s * (n - 1) + bay(x, y)), 0, n - 1)];
      // silhouette edges: rim light underneath, a dark line on top
      const open = (j) => !IDB[j] || ZB[j] > z + 0.1;
      const b1 = y + 1 < H && open(i + W), b2 = y + 2 < H && open(i + 2 * W);
      const a1 = y > 0 && open(i - W);
      const sd = (x > 0 && open(i - 1)) || (x < W - 1 && open(i + 1));
      const rim = RIM[d];
      if (b1) c = rim[clamp(1 + (g > 0.3 ? 1 : 0) + (bay(x, y) < 0.35 ? 0 : 0), 0, rim.length - 1)];
      else if (b2 && bay(x, y) < 0.6) c = rim[0];
      else if (a1 || sd) c = d === 0 ? c : OUTL[d];
      if (d === 0 && b1 && g > 0.5) c = 12;
      buf[i] = c;
    }
  }
  function compositeFire(buf) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = HEAT[i], s = SMK[i], b = bay(x, y);
      if (h > 0.06) {
        let c;
        const v = h + (b - 0.5) * 0.18;
        if (v > 2.4) c = 17; else if (v > 1.7) c = 16; else if (v > 1.25) c = 15; else if (v > 0.92) c = 14;
        else if (v > 0.66) c = 13; else if (v > 0.46) c = 12; else if (v > 0.3) c = 11; else if (v > 0.18) c = 10; else if (v > 0.11) c = 9;
        else { if (b < 0.5) c = 8; else c = -1; }
        if (c >= 0) { buf[i] = c; continue; }
      }
      if (s > 0.04) {
        // smoke as dithered coverage: thin smoke is a sparse veil, thick smoke nearly solid
        const cov = Math.min(0.92, s * 1.5);
        if (b > cov) continue;
        const warm = h > 0.02 || glowAt(x, y) > 0.3;
        const cur = buf[i];
        buf[i] = warm ? (s > 0.45 ? 5 : 6) : cur <= 17 ? Math.min(cur, s > 0.5 ? 2 : s > 0.25 ? 3 : 4) : 19;
      }
    }
  }

  /* ================================================================ frame */
  function render(t) {
    t = mod(t, D);
    build();
    setCamera(t);
    FLARE = 0.35 * (breath(0, t) + breath(1, t) + breath(2, t));
    drawSky(t, BUF);
    drawLand(t, BUF);
    shimmer(t, BUF);
    drawAsh(t, BUF, 0);
    drawEmbers(t, BUF, false);
    drawDragons(t);
    drawFire(t);
    computeGlow();
    applyGlow(BUF);
    resolveDragons(BUF);
    compositeFire(BUF);
    drawVortex(t, BUF);
    drawAsh(t, BUF, 1);
    drawEmbers(t, BUF, true);
    drawAsh(t, BUF, 2);
  }

  /* ================================================================ present */
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
  const pack = (r, g, b) => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
  const LIVE = new Uint32Array(256);
  for (let i = 0; i < NPAL; i++) LIVE[i] = pack(PAL[i][0], PAL[i][1], PAL[i][2]);
  let SMALL = null, SG = null, IMG = null, PIX = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    }
    for (let i = 0; i < NP; i++) PIX[i] = LIVE[BUF[i]];
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#060406'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'fire-and-blood',
    title: 'Fire and Blood',
    medium: 'Pixel art in 44 colours, 270 × 338, drawn in JavaScript · 24 s loop',
    note: 'Three dragons, one knot · tap to pause',
    about: 'Three dragons, one black and red, one cream and gold, one green and bronze, circle one another over a burning city. They fly a single closed knot in the sky, a third of it apart, so every eight seconds the knot draws them in and they lock into a turning three-armed wheel and breathe together, and in between each one breathes alone. Every flame is drawn as braided embers that cool from white to gold, orange and red and burn down to smoke; under them the smoke ceiling churns, a volcano spits and bleeds, ash falls in three layers and embers spiral up. Inspired by the novels of George R. R. Martin; an unofficial fan tribute.',
    tone: 'dark',
    room: '#060406',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, ready = false;
      el.style.background = '#060406';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,230,200,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,230,200,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1080 * dpr); CH = Math.round(1350 * dpr);
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          K = Math.max(1, Math.floor(fit));
          let show = K;
          if (K < fit * 0.88) { K = Math.max(1, Math.ceil(fit)); show = fit; }
          CW = W * K; CH = H * K;
          cssW = W * show / dpr; cssH = H * show / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => drawFrame(t, g, CW, CH, K, 0, 0);
      layout();
      draw(0);
      ready = true;
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__fireandblood = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__fireandblood.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'fire-and-blood';
        api.ready();
      } else {
        window.__fireandblood = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        draw(clock);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__fireandblood) delete window.__fireandblood;
        },
      };
    },
  });
})();
