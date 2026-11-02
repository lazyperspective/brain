/* The Knock — In Imagination, piece 03.
 *
 * "There are more things likely to frighten us than there are to crush us;
 *  we suffer more often in imagination than in reality."  (Seneca)
 *
 * A stormy evening in a small cottage hallway. KNOCK. KNOCK. KNOCK. Through the frosted glass of the front door a
 * small, round shape waits. In the reader's imagination it is drawn over in ink: it stretches too tall, its hat
 * keeps growing, it puts out too many arms and drags long fingers down the glass; lightning shows more of them in
 * the garden; the handle turns by itself; the hall stretches into a tunnel; the rain on the glass crawls. She
 * breathes, walks up, and opens the door: an elderly neighbour in a yellow sou'wester, soaked and beaming, holding
 * her muddy, wagging terrier. The ink runs off in the rain and the pixels beneath were never touched. The door
 * closes on the warm light, the words come, the dog slips out of its flap again, and the neighbour comes back up
 * the path to knock.
 *
 * Two media in one frame. Reality is a 360 × 450 world, ray-cast per pixel (a box of a hallway with a door that
 * really swings, props, and characters drawn as shaded primitives with pixel outlines), quantised with a 4 × 4
 * Bayer dither to a 64-colour palette and shown at exactly 3×. Imagination is drawn at the full 1080 × 1350 over
 * it with Canvas 2D: boiling ink lines (re-drawn at 10 fps with jitter), dry-brush ribbons, hatching, charcoal
 * smears and splatter, anchored to the world through the same camera. Every frame is a pure function of t; the
 * 39 s loop is seamless (the last frame flows into frame 0, where the first knock lands).
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 39, SC = 3, BW = W * SC, BH = H * SC;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const mod = (a, n) => ((a % n) + n) % n;
  const fr = (v) => v - fl(v);
  const env = (t, a, b, c, d) => s5(ph(t, a, b)) * (1 - s5(ph(t, c, d)));
  const back = (u, c) => { u = clamp(u, 0, 1); c = c === undefined ? 1.7 : c; const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
  const SEED = 3;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const hs = (a, b, c) => ih(a, b, c) * 2 - 1;
  function vn1(x, s) { const i = fl(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(ih(i, s, 77), ih(i + 1, s, 77), u); }
  function vn2(x, y, s) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(ih(xi, yi, s), ih(xi + 1, yi, s), u), lerp(ih(xi, yi + 1, s), ih(xi + 1, yi + 1, s), u), v);
  }
  function fbm(x, y, s, o) {
    let a = 0, amp = 0.5, n = 0;
    for (let k = 0; k < (o || 4); k++) { a += amp * vn2(x, y, s + k * 31); n += amp; x = x * 2.03 + 5.1; y = y * 2.03 + 1.7; amp *= 0.5; }
    return a / n;
  }
  // precomputed, tileable noise (value noise and a 3-octave fBm) sampled bilinearly: the per-pixel textures use these
  const TNN = 256, TNC = 8, TN = new Float32Array(TNN * TNN), TF = new Float32Array(TNN * TNN);
  function buildNoise() {
    const P = TNN / TNC;
    const pv = (x, y, s, per_) => { const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const h = (i, j) => ih(mod(i, per_), mod(j, per_), s);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); };
    for (let y = 0; y < TNN; y++) for (let x = 0; x < TNN; x++) {
      TN[y * TNN + x] = pv(x / TNC, y / TNC, 701, P);
      let a = 0, amp = 0.5, n = 0, c = TNC, pr = P;
      for (let o = 0; o < 3; o++) { a += amp * pv(x / c, y / c, 711 + o, pr); n += amp; amp *= 0.5; c /= 2; pr *= 2; }
      TF[y * TNN + x] = a / n;
    }
  }
  function samp(T, x, y) {
    x *= TNC; y *= TNC;
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
    const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) * TNN, y1 = ((yi + 1) & 255) * TNN;
    return (T[y0 + x0] * (1 - fx) + T[y0 + x1] * fx) * (1 - fy) + (T[y1 + x0] * (1 - fx) + T[y1 + x1] * fx) * fy;
  }
  const tn = (x, y, s) => samp(TN, x + s * 7.31, y + s * 3.17);
  const tf = (x, y, s) => samp(TF, x * 0.5 + s * 5.13, y * 0.5 + s * 2.71);
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  // a periodic time phase: turns k whole times per loop
  const per = (k, t) => TAU * k * t / D;
  // coverage of a line of half-width hw at signed distance d, for a pixel footprint fp (box-filtered)
  const cov = (d, hw, fp) => clamp((hw + fp * 0.5 - Math.abs(d)) / fp, 0, 1);

  /* ================================================================ palette (64) */
  const PAL_HEX = [
    '0c0b10', '16141d', '221f2c', '2e2c3e', '3b3f57', '4f5a74', '687895', '8798b2', 'a9b9cb', 'cdd8e1', 'eaf0f2', // 0-10 night, storm, glass
    '1d130f', '2f1f17', '45301f', '5e3f25', '7b532c', '9b6b37', 'ba8746', 'd6a55c', 'eac47e', 'f7e0a8', 'fff4dc', // 11-21 wood, honey, lamplight
    'cab592', 'dccaa6', 'ebe0c3', 'a99273', '86735d', '62534a',                                                 // 22-27 cream walls
    '3c4a3c', '536452', '6c8166', '8ba283', 'adc2a1',                                                           // 28-32 sage
    '5a2422', '8b3529', 'b6533b', 'd97c58',                                                                     // 33-36 rust, rug, socks, hair
    '6b3d31', '9e5f4c', 'c7896d', 'e2ab8c', 'f4cfb3',                                                           // 37-41 skin
    '7d5f14', 'c0951f', 'ecc13a', 'ffe382',                                                                     // 42-45 sou'wester yellow
    'cf6a78', 'eea3a6',                                                                                         // 46-47 pinks (cheeks, tongue)
    '17231e', '23342c',                                                                                         // 48-49 night garden
    '746760', '9a8c80', '3a302d', '261d1d', '4b3c37',                                                           // 50-54 warm greys
    'b9a68d', '6a5b4d', 'ffd88a', 'fffbf2', 'e0963a', '4c6a8a', '7592b4', '2e3e57', '1f2a3d',                   // 55-63
  ];
  const PAL = PAL_HEX.map(hx), NPAL = PAL.length;
  // colours only the characters may use (the room, however it is lit, stays in its own family)
  const CHAR_ONLY = new Set([42, 43, 44, 45, 46, 47, 59, 41]);
  const QN = 64, LUTE = new Uint8Array(QN * QN * QN), LUTC = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b, charOK) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      if (!charOK && CHAR_ONLY.has(k)) continue;
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
      const s = 1 / (14 + (r + g + b + p[0] + p[1] + p[2]) / 6);
      const d = ((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) * s;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    const dec = new Float32Array(QN);
    for (let q = 0; q < QN; q++) { const u = q / (QN - 1); dec[q] = 255 * u * u; }
    for (let r = 0; r < QN; r++) for (let g = 0; g < QN; g++) for (let b = 0; b < QN; b++) {
      const i = (r << 12) | (g << 6) | b;
      LUTE[i] = nearest(dec[r], dec[g], dec[b], false);
      LUTC[i] = nearest(dec[r], dec[g], dec[b], true);
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

  /* ================================================================ frame buffers */
  const C = new Float32Array(NP * 3);   // colour, 0..255 sRGB-ish
  const DEP = new Float32Array(NP);     // depth along the camera axis (m)
  const FLG = new Uint8Array(NP);       // 1: character pixel (clean dither, full palette); 2: text
  const OBJ = new Uint8Array(NP);       // which character drew this pixel (outlines)
  const PART = new Uint8Array(NP);      // which part of it (inner lines)
  const OUT = new Uint8Array(NP);       // palette index

  /* ================================================================ the clock: shots and story beats */
  const KN = [0.0, 0.40, 0.80, 4.30, 4.60];            // knocks (the neighbour's knuckles on the door)
  const T = {
    flinch: 0.03,
    s2: 1.30, s3: 2.70, s4: 5.40, s5: 7.00, s6: 10.20, s7: 12.40, s8: 14.40, s9: 17.60, s10: 20.00,
    s11: 22.60, s12: 26.40, s13: 29.30, s14: 31.10,
    dart: 1.95,
    lightning: 10.80, thunder: 11.30,
    handle0: 12.75, handle1: 13.95,
    eyesShut: 17.85, breathIn: 18.05, breathOut: 18.85, eyesOpen: 19.40, mugDown: 19.55,
    steps: [20.30, 20.75, 21.20, 21.65, 22.10], grip: 22.38, latch: 22.62,
    open0: 22.70, open1: 23.70,
    wash0: 22.78, wash1: 25.40,
    barks: [23.80, 24.25, 28.40],
    offer0: 25.15, take0: 25.75, take1: 26.30,
    licks: [26.75, 27.20, 27.65, 28.75],
    wave0: 29.45, close0: 30.05, close1: 30.80,
    leave0: 30.80, leave1: 32.40,
    q1in: 31.60, q2in: 33.00, qout: 37.80,
    dogUp: 36.30, flapIn: 37.95, flapOut: 38.45, arrive0: 37.75, arrive1: 38.75, pick: 38.55,
    scratch: [[7.65, 8.30], [8.55, 9.20], [9.45, 10.10]],
    sips: [[33.6, 35.6]],
  };
  const SHOTS = [0, T.s2, T.s3, T.s4, T.s5, T.s6, T.s7, T.s8, T.s9, T.s10, T.s11, T.s12, T.s13, T.s14];
  const shotAt = (t) => { let k = 0; while (k + 1 < SHOTS.length && t >= SHOTS[k + 1] - 1e-6) k++; return k; };
  // the fear: how much of the imagination is drawn (0 calm .. 1 overwhelming)
  function fearAt(t) {
    if (t >= T.wash1 + 0.5) return 0;
    const u = Math.min(t, T.wash0);
    return clamp(0.06 * sstep(0.6, 1.4, u) + 0.16 * s5(ph(u, 1.4, 5.4)) + 0.26 * s5(ph(u, 5.4, 10.2)) + 0.2 * s5(ph(u, 10.2, 14.4)) +
      0.32 * s5(ph(u, 14.4, 17.3)), 0, 1);
  }
  // the knocks as a shove (door, camera) and the flinch
  function knockShake(t) {
    let s = 0;
    for (const k of KN) { const d = t - k; if (d >= 0 && d < 0.5) s += Math.sin(d * TAU * 19) * Math.exp(-d / 0.07) * (k > 4 ? 1.35 : 1); }
    return s;
  }
  const knockEnv = (t) => { let e = 0; for (const k of KN) { const d = t - k; if (d >= 0 && d < 0.6) e = Math.max(e, Math.exp(-d / 0.12)); } return e; };

  /* ================================================================ the world (metres; x right, y up, z toward the door) */
  const HW = 0.62, HC = 2.4, ZD = 4.4, ZB = -1.4;               // hall half-width, ceiling, door wall, far wall
  const DX0 = -0.52, DWID = 0.82, DX1 = DX0 + DWID, DH = 2.0;    // the door (hinged on the left, opens inward)
  const SL0 = 0.37, SL1 = 0.57, SLY0 = 0.32, SLY1 = 1.98;        // sidelight (clear glass, to the right of the door)
  const FLY0 = 2.07, FLY1 = 2.29;                                 // fanlight over the door
  const GS0 = 0.14, GS1 = 0.68, GY0 = 1.08, GY1 = 1.86;           // frosted pane, in door-leaf coordinates
  const HDS = 0.735, HDY = 1.0;                                   // handle, leaf coordinates
  const FPS0 = 0.28, FPS1 = 0.54, FPY0 = 0.05, FPY1 = 0.30;       // the dog flap
  const ZG = ZD + 7;                                              // the garden backdrop
  const HER = { x: 0.30, z: 0.55 };                               // where she stands to read
  const ATDOOR = { x: 0.07, z: 3.80 };

  /* ================================================================ camera */
  const CAM = { ex: 0, ey: 1.5, ez: 0, yaw: 0, pitch: 0, roll: 0, f: 330, ox: 0, oy: 0 };
  let FX = 0, FY = 0, FZ = 1, RX = 1, RZ = 0, UX = 0, UY = 1, UZ = 0, CR = 1, SR = 0, CX = W / 2, CY = H / 2;
  function camBasis() {
    const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw), cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
    FX = sy * cp; FY = sp; FZ = cy * cp;
    RX = cy; RZ = -sy;
    UX = -sy * sp; UY = cp; UZ = -cy * sp;
    CR = Math.cos(CAM.roll); SR = Math.sin(CAM.roll);
    CX = W / 2 + CAM.ox; CY = H / 2 + CAM.oy;
  }
  let PX = 0, PY = 0, PZ = 0;
  function proj(X, Y, Z) {
    const vx = X - CAM.ex, vy = Y - CAM.ey, vz = Z - CAM.ez;
    const zc = vx * FX + vy * FY + vz * FZ, xc = vx * RX + vz * RZ, yc = vx * UX + vy * UY + vz * UZ;
    const iz = CAM.f / Math.max(1e-3, zc);
    const dx = xc * iz, dy = -yc * iz;
    PX = CX + dx * CR - dy * SR; PY = CY + dx * SR + dy * CR; PZ = zc;
    return zc;
  }
  let DXr = 0, DYr = 0, DZr = 1;
  function ray(sx, sy) {
    const ax = sx - CX, ay = sy - CY;
    const dx = ax * CR + ay * SR, dy = -ax * SR + ay * CR;
    DXr = FX * CAM.f + RX * dx - UX * dy; DYr = FY * CAM.f - UY * dy; DZr = FZ * CAM.f + RZ * dx - UZ * dy;
  }
  // aim the camera from an eye at a target
  function aim(c, ex, ey, ez, tx, ty, tz) {
    c.ex = ex; c.ey = ey; c.ez = ez;
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    c.yaw = Math.atan2(dx, dz); c.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  const K0 = { e: [-0.02, 1.52, -0.40], tg: [-0.08, 1.12, ZD], f: 420 };       // the opening (and closing) over-the-shoulder
  function camKey(o, t, keys) {
    // keys: [[time, ex,ey,ez, tx,ty,tz, f, roll]], eased between
    let k = 0; while (k + 1 < keys.length && t >= keys[k + 1][0]) k++;
    const a = keys[k], b = keys[Math.min(k + 1, keys.length - 1)];
    const u = b === a ? 0 : s5(ph(t, a[0], b[0]));
    const L = (i) => lerp(a[i], b[i], u);
    aim(o, L(1), L(2), L(3), L(4), L(5), L(6));
    o.f = L(7); o.roll = a.length > 8 ? L(8) : 0;
  }
  function camAt(t) {
    const s = shotAt(t), c = CAM;
    c.ox = 0; c.oy = 0; c.roll = 0;
    const K = (time, e, tg, f, r) => [time, e[0], e[1], e[2], tg[0], tg[1], tg[2], f, r || 0];
    switch (s) {
      case 0: camKey(c, t, [K(0, K0.e, K0.tg, K0.f), K(T.s2, [-0.02, 1.52, -0.32], [-0.08, 1.14, ZD], 455)]); break;
      case 1: camKey(c, t, [K(T.s2, [HER.x - 0.08, 1.50, 1.32], [HER.x, 1.43, HER.z], 560), K(T.s3, [HER.x - 0.08, 1.50, 1.22], [HER.x, 1.45, HER.z], 640)]); break;
      case 2: camKey(c, t, [K(T.s3, [0.26, 1.56, 0.6], [-0.11, 1.42, ZD], 430), K(4.25, [0.22, 1.54, 0.95], [-0.11, 1.45, ZD], 640),
        K(T.s4, [0.18, 1.52, 1.25], [-0.11, 1.46, ZD], 760)]); break;
      case 3: camKey(c, t, [K(T.s4, [HER.x - 0.06, 1.53, 1.05], [HER.x, 1.47, HER.z], 600), K(T.s5, [HER.x - 0.06, 1.53, 1.02], [HER.x, 1.48, HER.z], 680, -0.03)]); break;
      case 4: camKey(c, t, [K(T.s5, [-0.04, 1.50, 2.15], [-0.11, 1.52, ZD], 690, 0.02), K(T.s6, [-0.08, 1.50, 2.55], [-0.11, 1.56, ZD], 640, -0.025)]); break;
      case 5: camKey(c, t, [K(T.s6, [0.40, 1.34, 3.98], [0.52, 1.25, ZD + 3], 330), K(T.s7, [0.42, 1.32, 4.05], [0.52, 1.22, ZD + 3], 350)]); break;
      case 6: camKey(c, t, [K(T.s7, [0.04, 1.12, 3.62], [DX0 + HDS - 0.04, 1.00, ZD], 860), K(T.s8, [0.05, 1.10, 3.75], [DX0 + HDS - 0.04, 0.99, ZD], 980, 0.03)]); break;
      case 7: camKey(c, t, [K(T.s8, [0.16, 1.50, 1.35], [-0.06, 1.25, ZD], 420, 0.0), K(16.2, [0.15, 1.48, 1.05], [-0.06, 1.25, ZD], 330, 0.05),
        K(T.s9, [0.14, 1.46, 0.85], [-0.06, 1.22, ZD], 270, 0.09)]); break;
      case 8: camKey(c, t, [K(T.s9, [HER.x - 0.02, 1.535, 0.92], [HER.x, 1.535, HER.z], 600), K(19.3, [HER.x - 0.02, 1.535, 0.95], [HER.x, 1.53, HER.z], 560),
        K(T.s10, [HER.x - 0.04, 1.53, 1.02], [HER.x, 1.49, HER.z], 470)]); break;
      case 9: {
        const w = walkZ(t);
        aim(c, lerp(0.34, 0.10, s5(ph(t, T.s10, T.s11))), 1.55, w - 1.55, 0.0, 1.30, ZD);
        c.f = lerp(360, 420, ph(t, T.s10, T.s11));
        break;
      }
      case 10: camKey(c, t, [K(T.s11, [0.10, 1.50, 2.40], [-0.02, 1.20, ZD], 470), K(23.9, [0.05, 1.50, 2.30], [-0.12, 1.26, ZD + 0.42], 540),
        K(T.s12, [-0.07, 1.36, 3.22], [-0.1, 1.15, ZD + 0.4], 600)]); break;
      case 11: camKey(c, t, [K(T.s12, [0.0, 1.46, ZD + 1.05], [0.12, 1.47, 3.85], 640), K(T.s13, [0.0, 1.47, ZD + 0.98], [0.12, 1.48, 3.85], 720)]); break;
      case 12: camKey(c, t, [K(T.s13, [0.04, 1.50, 2.32], [-0.10, 1.28, ZD + 0.4], 560), K(T.s14, [0.04, 1.50, 2.26], [-0.10, 1.25, ZD], 590)]); break;
      default: camKey(c, t, [K(T.s14, [-0.30, 1.6, -0.3], [0.28, 0.3, ZD], 760), K(35.5, [-0.2, 1.57, -0.35], [0.08, 0.8, ZD], 480), K(38.2, K0.e, K0.tg, K0.f), K(D, K0.e, K0.tg, K0.f)]);
    }
    // the knocks shove the camera a little (only in the shots that see the door)
    const sk = knockShake(t);
    if (s === 0 || s === 2) { c.ox += sk * 3.2; c.oy += sk * 2.0; }
    if (s === 13 && t > D - 0.3) { /* the loop: nothing */ }
    // handheld unease during the spiral (smooth, periodic)
    const fe = fearAt(t), hh = fe * fe * 1.3 * (s === 10 || s >= 11 ? 0 : 1);
    c.ox += hh * (Math.sin(per(23, t)) * 0.7 + Math.sin(per(37, t) + 1.3) * 0.5);
    c.oy += hh * (Math.sin(per(19, t) + 0.4) * 0.6 + Math.sin(per(41, t) + 2.1) * 0.4);
    camBasis();
  }
  // her position along the hall while she walks to the door
  function walkZ(t) { return lerp(HER.z, ATDOOR.z, s5(ph(t, T.s10 + 0.1, T.grip - 0.05)) * 0.15 + ph(t, T.s10 + 0.1, T.grip - 0.05) * 0.85); }
  function walkX(t) { return lerp(HER.x, ATDOOR.x, s5(ph(t, T.s10 + 0.1, T.grip))); }

  /* ================================================================ light */
  const LT = { lamp: 1, door: 1, far: 1, lightning: 0, spill: 0, porch: 1 };
  const PEND = [0, 2.08, 1.6], LAMP = [0.47, 1.17, 3.0], GLASS = [DX0 + (GS0 + GS1) / 2, (GY0 + GY1) / 2, ZD], FARL = [0, 1.1, ZB + 0.05];
  function lightningAt(t) {
    // one soft swell (flash-safe): 0.22 s rise, 1.1 s fall, and a faint after-glow
    const d = t - T.lightning;
    if (d < -0.25 || d > 2.0) return 0;
    return d < 0 ? s5((d + 0.25) / 0.25) : Math.exp(-d / 0.38) * 0.85 + 0.15 * Math.exp(-d / 1.0);
  }
  function setLights(t) {
    LT.lightning = lightningAt(t);
    const open = doorAngle(t);
    LT.spill = clamp(open / 1.2, 0, 1);
    LT.door = (1 + LT.lightning * 1.4) * (1 - 0.85 * LT.spill);
    LT.lamp = 1;
  }
  // door leaf angle (radians, inward), and the dog flap
  function doorAngle(t) {
    if (t < T.open0 || t > T.close1 + 0.02) return 0;
    const o = back(ph(t, T.open0, T.open1), 0.9) * 1.42;
    const c = s5(ph(t, T.close0, T.close1));
    return Math.max(0, o * (1 - c));
  }
  function flapAngle(t) {
    // + outward. the dog pushes out at flapIn and the flap swings shut, into the start of the loop
    const d = mod(t - T.flapIn, D);
    if (d > 3.6) return 0;
    if (d < 0.25) return 1.1 * s5(d / 0.25);
    if (d < 0.5) return 1.1;
    const u = d - 0.5;
    return 1.1 * Math.cos(u * TAU * 1.25) * Math.exp(-u / 0.55);
  }

  /* ================================================================ lighting of the room */
  let LR = 0, LG = 0, LB = 0, LDG = 0, LSP = 0;
  // the lights in three parts: the house's own warm lights (LR, LG, LB), the door's glass (LDG) and the open door (LSP)
  function lightParts(x, y, z, nx, ny, nz) {
    LR = 0.27; LG = 0.245; LB = 0.22;
    // the table lamp: brightest straight up and down through the shade, softer through its fabric
    let dx = LAMP[0] - x, dy = LAMP[1] - y, dz = LAMP[2] - z;
    let d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) + 1e-6;
    let ndl = (nx * dx + ny * dy + nz * dz) / d;
    let a = (0.42 + 0.58 * sstep(0.28, 0.72, Math.abs(dy) / d)) / (1 + d2 / 0.85) * Math.max(0, ndl * 0.85 + 0.15);
    if (y < 0.775) {                      // the table top shadows what is under it
      const s = (0.78 - y) / (LAMP[1] - y), xc = x + s * dx, zc = z + s * dz;
      if (xc > 0.30 && xc < 0.62 && zc > 2.75 && zc < 3.25) a *= 0.1;
    }
    LR += 1.45 * a; LG += 1.12 * a; LB += 0.7 * a;
    // the pendant over the hall
    dx = PEND[0] - x; dy = PEND[1] - y; dz = PEND[2] - z; d2 = dx * dx + dy * dy + dz * dz; d = Math.sqrt(d2) + 1e-6;
    ndl = (nx * dx + ny * dy + nz * dz) / d;
    a = (0.3 + 0.7 * sstep(0.2, 0.9, -dy / d)) / (1 + d2 / 1.4) * Math.max(0, ndl * 0.85 + 0.15);
    LR += 0.62 * a; LG += 0.5 * a; LB += 0.34 * a;
    // the living room's warm glow at the far end
    dx = FARL[0] - x; dy = FARL[1] - y; dz = FARL[2] - z;
    d2 = dx * dx + dy * dy + dz * dz; d = Math.sqrt(d2) + 1e-6;
    ndl = (nx * dx + ny * dy + nz * dz) / d;
    a = Math.max(0, -dz / d) / (1 + d2 / 2.6) * Math.max(0, ndl * 0.8 + 0.2);
    LR += 0.55 * a; LG += 0.38 * a; LB += 0.22 * a;
    // the door's frosted glass: cool light from the porch and the street lamp (and the lightning)
    dx = GLASS[0] - x; dy = GLASS[1] - y; dz = GLASS[2] - z;
    d2 = dx * dx + dy * dy + dz * dz; d = Math.sqrt(d2) + 1e-6;
    ndl = (nx * dx + ny * dy + nz * dz) / d;
    LDG = Math.max(0, dz / d) / (1 + d2 / 2.4) * Math.max(0, ndl * 0.8 + 0.2);
    // the open door lets the storm's grey light in
    dx = -0.11 - x; dy = 1.1 - y; dz = ZD - z; d2 = dx * dx + dy * dy + dz * dz; d = Math.sqrt(d2) + 1e-6;
    ndl = (nx * dx + ny * dy + nz * dz) / d;
    LSP = Math.max(0, dz / d) / (1 + d2 / 1.6) * Math.max(0, ndl * 0.8 + 0.2);
  }
  function addParts() {
    const a = LT.door * LDG, b = LT.spill * LSP;
    LR += 0.26 * a + 0.16 * b; LG += 0.34 * a + 0.2 * b; LB += 0.52 * a + 0.28 * b;
  }
  function lightAt(x, y, z, nx, ny, nz) { lightParts(x, y, z, nx, ny, nz); addParts(); }
  // baked light maps for the six plain surfaces of the hall (the lights never move; only their strengths change)
  const LMS = 0.015, LMAPS = [];
  function bakeMap(u0, u1, v0, v1, P, n) {
    const nu = Math.ceil((u1 - u0) / LMS) + 2, nv = Math.ceil((v1 - v0) / LMS) + 2, A = new Float32Array(nu * nv * 5);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const p = P(u0 + i * LMS, v0 + j * LMS);
      lightParts(p[0], p[1], p[2], n[0], n[1], n[2]);
      const k = (j * nu + i) * 5; A[k] = LR; A[k + 1] = LG; A[k + 2] = LB; A[k + 3] = LDG; A[k + 4] = LSP;
    }
    return { u0, v0, nu, nv, A };
  }
  function buildLightMaps() {
    LMAPS[1] = bakeMap(ZB, ZD, 0, HC, (u, v) => [-HW, v, u], [1, 0, 0]);
    LMAPS[2] = bakeMap(ZB, ZD, 0, HC, (u, v) => [HW, v, u], [-1, 0, 0]);
    LMAPS[3] = bakeMap(-HW, HW, ZB, ZD, (u, v) => [u, 0, v], [0, 1, 0]);
    LMAPS[4] = bakeMap(-HW, HW, ZB, ZD, (u, v) => [u, HC, v], [0, -1, 0]);
    LMAPS[5] = bakeMap(-HW, HW, 0, HC, (u, v) => [u, v, ZD], [0, 0, -1]);
    LMAPS[6] = bakeMap(-HW, HW, 0, HC, (u, v) => [u, v, ZB], [0, 0, 1]);
  }
  function lightMap(m, u, v) {
    let fu = (u - m.u0) / LMS, fv = (v - m.v0) / LMS;
    fu = fu < 0 ? 0 : fu > m.nu - 1.001 ? m.nu - 1.001 : fu; fv = fv < 0 ? 0 : fv > m.nv - 1.001 ? m.nv - 1.001 : fv;
    const i = fu | 0, j = fv | 0, a = fu - i, b = fv - j, A = m.A, k0 = (j * m.nu + i) * 5, k1 = k0 + m.nu * 5;
    const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
    LR = A[k0] * w00 + A[k0 + 5] * w10 + A[k1] * w01 + A[k1 + 5] * w11;
    LG = A[k0 + 1] * w00 + A[k0 + 6] * w10 + A[k1 + 1] * w01 + A[k1 + 6] * w11;
    LB = A[k0 + 2] * w00 + A[k0 + 7] * w10 + A[k1 + 2] * w01 + A[k1 + 7] * w11;
    LDG = A[k0 + 3] * w00 + A[k0 + 8] * w10 + A[k1 + 3] * w01 + A[k1 + 8] * w11;
    LSP = A[k0 + 4] * w00 + A[k0 + 9] * w10 + A[k1 + 4] * w01 + A[k1 + 9] * w11;
    addParts();
  }
  // surface outputs
  let AR = 0, AG = 0, AB = 0, ER = 0, EG = 0, EB = 0, SNX = 0, SNY = 0, SNZ = 0, GL = 0, DAX = 1;
  const alb = (r, g, b) => { AR = r; AG = g; AB = b; };
  const mixA = (r, g, b, u) => { AR += (r - AR) * u; AG += (g - AG) * u; AB += (b - AB) * u; };

  /* ---------------------------------------------------------------- floor: honey boards and a runner */
  function floorTex(x, z, fp) {
    SNX = 0; SNY = 1; SNZ = 0; GL = 0.5;
    const fine = 1 - sstep(0.004, 0.014, fp);
    if (Math.abs(x) < 0.37 && z > 0.12 && z < 3.92) {          // the runner
      GL = 0;
      const ax = Math.abs(x), b = Math.min(0.37 - ax, z - 0.12, 3.92 - z);
      if (b < 0.05) { alb(0.80, 0.72, 0.56); if (b > 0.012 && b < 0.022) mixA(0.42, 0.18, 0.14, 0.8 * fine + 0.2); }
      else {
        const u = x / 0.115, v = (z - 0.12) / 0.115;
        const d1 = Math.abs(fr(u + v) - 0.5), d2 = Math.abs(fr(u - v) - 0.5);
        alb(0.55, 0.20, 0.15);
        const ln = Math.max(cov(Math.min(d1, d2) * 0.115, 0.005, fp), 0);
        mixA(0.82, 0.70, 0.52, ln * 0.75);
        const cx = fr(u + 0.5) - 0.5, cz = fr(v + 0.5) - 0.5;
        if (Math.abs(cx) + Math.abs(cz) < 0.16) mixA(0.43, 0.48, 0.36, 0.8 * fine + 0.1);
        const ed = 0.37 - ax - 0.05;
        if (ed < 0.022) mixA(0.30, 0.13, 0.11, 0.6);
      }
      const fz = (tn(x * 260, z * 260, 9) - 0.5) * 0.12 * fine;
      AR *= 1 + fz; AG *= 1 + fz; AB *= 1 + fz;
      // fringes at the two ends
      return;
    }
    const PW = 0.118, u = (x + 3) / PW, pi = fl(u), xf = u - pi;
    const L = 1.5 + ih(pi, 3, 1) * 0.9, zz = z + ih(pi, 4, 1) * 5, si = fl(zz / L), zf = zz - si * L;
    const hv = ih(pi, si, 2);
    alb(lerp(0.60, 0.74, hv), lerp(0.40, 0.50, hv), lerp(0.22, 0.28, hv));
    const g = tf(x * 30 + pi * 3.7, z * 2.2 + si, 5, 3);
    const gr = 0.84 + 0.32 * lerp(0.5, g, fine);
    AR *= gr; AG *= gr; AB *= gr;
    const de = Math.min(xf, 1 - xf) * PW, dz = Math.min(zf, L - zf);
    const gap = Math.max(cov(de, 0.0045, fp), cov(dz, 0.0035, fp));
    mixA(0.20, 0.12, 0.07, gap * 0.8);
    // the ambient occlusion along the walls
    const ao = 1 - 0.4 * Math.exp(-(HW - Math.abs(x)) / 0.05) - 0.3 * Math.exp(-(ZD - z) / 0.05);
    AR *= ao; AG *= ao; AB *= ao;
  }

  /* ---------------------------------------------------------------- walls: wallpaper over sage panelling */
  function paperTex(u, y, fp, s) {
    alb(0.86, 0.79, 0.64);
    const fine = 1 - sstep(0.006, 0.016, fp);
    if (fine > 0) {
      const row = fl(y / 0.16), du = (row & 1) ? 0.07 : 0;
      const cu = fr((u + du) / 0.14) - 0.5, cv = fr(y / 0.16) - 0.5;
      const px = cu * 0.14, py = cv * 0.16;
      // a small sprig: two leaves and a berry
      const l1 = ((px - 0.008) / 0.012) ** 2 + ((py - 0.006) / 0.006) ** 2, l2 = ((px + 0.008) / 0.012) ** 2 + ((py - 0.006) / 0.006) ** 2;
      const be = (px * px + (py + 0.01) ** 2) / (0.0055 * 0.0055);
      if (l1 < 1 || l2 < 1) mixA(0.55, 0.62, 0.46, 0.8 * fine);
      else if (be < 1) mixA(0.78, 0.52, 0.26, 0.8 * fine);
      // faint vertical stripes
      const st = Math.abs(fr(u / 0.07) - 0.5) * 0.07;
      mixA(0.90, 0.85, 0.72, cov(st, 0.008, fp) * 0.35 * fine);
    }
    const n = (tn(u * 40, y * 40, s) - 0.5) * 0.05 * fine;
    AR *= 1 + n; AG *= 1 + n; AB *= 1 + n;
  }
  function wallTex(side, u, y, fp, t) {
    // side: -1 left wall (normal +x), +1 right wall (normal -x), 0 the door wall (normal -z), 2 far wall (normal +z)
    SNX = side === -1 ? 1 : side === 1 ? -1 : 0; SNY = 0; SNZ = side === 0 ? -1 : side === 2 ? 1 : 0; GL = 0;
    if (y < 0.115) {
      alb(0.88, 0.84, 0.74);
      if (y > 0.098) { mixA(1, 0.97, 0.88, 0.6); }
      if (y < 0.012) mixA(0.3, 0.25, 0.2, 0.6);
    } else if (y < 0.905) {
      alb(0.43, 0.52, 0.41);
      const gu = fr(u / 0.088) * 0.088, dg = Math.min(gu, 0.088 - gu);
      mixA(0.22, 0.28, 0.21, cov(dg, 0.0035, fp) * 0.85);
      if (gu > 0.004 && gu < 0.012) mixA(0.58, 0.66, 0.53, 0.5 * (1 - sstep(0.006, 0.014, fp)));
    } else if (y < 0.965) {
      const v = (y - 0.905) / 0.06;
      alb(0.88, 0.84, 0.73);
      const sh = 0.78 + 0.3 * Math.sin(v * PI);
      AR *= sh; AG *= sh; AB *= sh;
      if (v < 0.12) mixA(0.35, 0.3, 0.24, 0.6);
    } else if (y > 2.27) {
      alb(0.90, 0.86, 0.76);
      if (y < 2.29) mixA(0.5, 0.42, 0.33, 0.7);
      else if (y > 2.33 && y < 2.345) mixA(0.62, 0.55, 0.45, 0.5);
    } else paperTex(u, y, fp, side + 5);
    // corner occlusion
    const ao = 1 - 0.35 * Math.exp(-y / 0.04) - 0.25 * Math.exp(-(HC - y) / 0.05);
    AR *= ao; AG *= ao; AB *= ao;
  }
  // what hangs on the left wall: a rail of hooks, a wool coat, a striped scarf, the dog's red lead
  function hooksTex(z, y, fp, t) {
    const sway = knockEnv(t) * 0.012 * Math.sin((t - 0) * 31);
    // the rail
    if (y > 1.70 && y < 1.785 && z > 3.22 && z < 4.28) {
      const v = (y - 1.70) / 0.085; alb(0.52, 0.34, 0.18); const sh = 0.75 + 0.35 * Math.sin(v * PI); AR *= sh; AG *= sh; AB *= sh;
      for (let q = 0; q < 3; q++) if (Math.hypot(z - HOOKZ[q], y - 1.742) < 0.017) { alb(0.85, 0.66, 0.30); GL = 1; }
      return true;
    }
    // coat on hook 1
    {
      const zz = z - 3.45 - sway * (1.74 - y) * 1.5, v = 1.74 - y;
      if (v > 0 && v < 0.98) {
        const half = v < 0.1 ? 0.04 + v * 1.4 : Math.min(0.19 + (v - 0.1) * 0.06, 0.24);
        if (Math.abs(zz) < half) {
          alb(0.19, 0.26, 0.31);
          const fold = Math.sin(zz * 60 + v * 3) * 0.08 + (tn(zz * 90, v * 90, 3) - 0.5) * 0.08;
          AR *= 1 + fold; AG *= 1 + fold; AB *= 1 + fold;
          if (Math.abs(Math.abs(zz) - half) < 0.012) mixA(0.10, 0.14, 0.17, 0.7);
          if (v > 0.1 && v < 0.62 && Math.abs(zz) < 0.012) mixA(0.10, 0.14, 0.17, 0.6);                 // the front opening
          if (v > 0.18 && v < 0.6 && Math.abs(zz - 0.03) < 0.009 && fr(v / 0.13) < 0.25) { alb(0.6, 0.48, 0.28); }  // buttons
          if (v > 0.2 && v < 0.75 && Math.abs(Math.abs(zz) - half + 0.05) < 0.012) mixA(0.12, 0.16, 0.2, 0.55);    // sleeves
          return true;
        }
      }
    }
    // scarf on hook 2: two hanging tails, rust and cream stripes
    {
      const zz = z - 3.78 - sway * (1.74 - y) * 2, v = 1.74 - y;
      if (v > 0 && v < 0.72) {
        const off = v < 0.08 ? 0 : 0.035;
        const a = Math.abs(zz - off * 0.8), b = Math.abs(zz + off * 1.1);
        if ((v < 0.08 && Math.abs(zz) < 0.05) || (a < 0.033 && v < 0.70) || (b < 0.03 && v < 0.6)) {
          const st = fr(v / 0.07);
          if (st < 0.5) alb(0.66, 0.26, 0.18); else alb(0.86, 0.80, 0.66);
          if (v > 0.66 || (b < 0.03 && v > 0.56)) { if (fr(zz / 0.008) < 0.5) alb(0.6, 0.3, 0.2); }
          return true;
        }
      }
    }
    // the dog's lead on hook 3: a red loop and a brass clip
    {
      const zz = z - 4.08 - sway * (1.74 - y) * 2.5, v = 1.74 - y;
      const ex = zz / 0.07, ey = (v - 0.2) / 0.2;
      const r = Math.hypot(ex, ey);
      if (v > 0 && v < 0.42 && Math.abs(r - 1) * 0.07 < 0.008) { alb(0.70, 0.18, 0.14); return true; }
      if (v > 0.38 && v < 0.5 && Math.abs(zz - 0.01) < 0.009) { alb(0.82, 0.62, 0.28); GL = 1; return true; }
    }
    return false;
  }
  // a framed photograph on the right wall: her and the dog in a field
  function photoTex(z, y, fp) {
    const z0 = 2.80, z1 = 3.22, y0 = 1.40, y1 = 1.72;
    if (z < z0 || z > z1 || y < y0 || y > y1) return false;
    const b = Math.min(z - z0, z1 - z, y - y0, y1 - y);
    if (b < 0.024) { alb(0.42, 0.27, 0.15); if (b < 0.006) mixA(0.2, 0.12, 0.07, 0.6); else if (b > 0.016) mixA(0.62, 0.44, 0.25, 0.5); return true; }
    if (b < 0.05) { alb(0.92, 0.88, 0.78); return true; }
    const u = (z - z0 - 0.05) / (z1 - z0 - 0.1), v = (y - y0 - 0.05) / (y1 - y0 - 0.1);   // u 0..1 left..right as seen from the hall
    alb(lerp(0.62, 0.78, v), lerp(0.74, 0.84, v), lerp(0.82, 0.88, v));               // sky
    if (v < 0.42 + 0.06 * Math.sin(u * 7)) alb(0.45, 0.60, 0.36);                        // a green field
    const hx = 0.62, hy = 0.6;
    if (((u - hx) / 0.1) ** 2 + ((v - hy) / 0.13) ** 2 < 1) alb(0.60, 0.25, 0.14);      // her hair
    if (((u - hx) / 0.07) ** 2 + ((v - hy + 0.02) / 0.09) ** 2 < 1) alb(0.94, 0.75, 0.6); // her face
    if (((u - hx) / 0.16) ** 2 + ((v - 0.18) / 0.22) ** 2 < 1 && v < 0.4) alb(0.88, 0.68, 0.24); // cardigan
    if (((u - 0.32) / 0.14) ** 2 + ((v - 0.28) / 0.12) ** 2 < 1) alb(0.95, 0.92, 0.85);  // the dog
    if (((u - 0.25) / 0.05) ** 2 + ((v - 0.40) / 0.06) ** 2 < 1) alb(0.72, 0.5, 0.28);   // its ear
    return true;
  }
  function lightSwitch(z, y) {
    // a cream switch plate on the right wall near the door
    return Math.abs(z - 4.12) < 0.04 && Math.abs(y - 1.3) < 0.04;
  }

  /* ---------------------------------------------------------------- outside: porch, garden, storm */
  let GN = null;   // the neighbour's silhouette parameters for this frame (set in story)
  const RC = new Float64Array(3);
  const V3 = (a, b, c) => { RC[0] = a; RC[1] = b; RC[2] = c; return RC; };
  function skyAt(x, y, t) {
    // x, y on the backdrop plane (m). Storm clouds that drift and return each loop
    const cx = Math.cos(per(1, t)) * 1.6, cy = Math.sin(per(1, t)) * 0.8;
    const c = tf(x * 0.32 + cx, y * 0.55 + cy, 41, 4);
    const v = clamp((y - 1.0) / 5, 0, 1);
    let r = lerp(0.20, 0.07, v), g = lerp(0.22, 0.08, v), b = lerp(0.29, 0.12, v);
    const k = 0.6 + 0.8 * c;
    r *= k; g *= k; b *= k;
    const L = LT.lightning;
    if (L > 0) { const lc = (0.5 + c) * L; r += 0.55 * lc; g += 0.6 * lc; b += 0.75 * lc; }
    return V3(r, g, b);
  }
  function gardenAt(x, y, t) {
    // returns [r,g,b] 0..1 (already lit) for the backdrop plane at ZG
    const L = LT.lightning;
    let col = skyAt(x, y, t);
    // the neighbour's cottage across the lane: a roof, a chimney, one warm window
    const roof = 2.35 - Math.abs(x + 2.4) * 0.55;
    if (x > -4.6 && x < -0.3 && y < Math.max(1.6, roof) ) {
      col = V3(0.07 + 0.25 * L, 0.075 + 0.27 * L, 0.10 + 0.33 * L);
      if (y < 1.6) col = V3(0.10 + 0.2 * L, 0.10 + 0.21 * L, 0.12 + 0.26 * L);
      if (Math.abs(x + 1.6) < 0.32 && y > 0.75 && y < 1.3) {
        col = V3(0.95, 0.70, 0.36);
        if (Math.abs(x + 1.6) < 0.015 || Math.abs(y - 1.02) < 0.015) col = V3(0.3, 0.2, 0.14);
      }
    }
    if (x > -3.3 && x < -3.0 && y < 2.75 && y > 1.6) col = V3(0.07 + 0.25 * L, 0.075 + 0.27 * L, 0.10 + 0.33 * L);
    // the big tree, swaying
    const sw = Math.sin(per(5, t)) * 0.06 + Math.sin(per(11, t) + 1) * 0.03;
    const tx = x - 2.3 - sw * (y / 3);
    if (Math.abs(tx) < 0.13 + 0.05 * Math.max(0, 1 - y) && y < 2.6) col = V3(0.05 + 0.2 * L, 0.05 + 0.21 * L, 0.06 + 0.25 * L);
    const cr = ((tx) / 1.7) ** 2 + ((y - 3.5) / 1.5) ** 2 + (tf(x * 1.4 + sw, y * 1.4, 61, 3) - 0.5) * 0.9;
    if (cr < 1) { const k = tf(x * 3, y * 3, 62, 2); col = V3(0.04 + 0.05 * k + 0.2 * L, 0.06 + 0.06 * k + 0.22 * L, 0.06 + 0.05 * k + 0.25 * L); }
    // the street lamp and its halo
    const lx = x + 0.9, ly = y - 2.6;
    if (Math.abs(lx) < 0.03 && y < 2.55) col = V3(0.08, 0.08, 0.1);
    const hd = Math.hypot(lx, ly);
    if (hd < 0.09) col = V3(1, 0.93, 0.74);
    else { const h = 0.5 * Math.exp(-hd / 0.45); col = V3(col[0] + h * 0.95, col[1] + h * 0.85, col[2] + h * 0.62); }
    // the hedge
    const hh = 0.95 + 0.12 * Math.sin(x * 2.3) + 0.12 * (tf(x * 1.3, 0, 63, 3) - 0.5);
    if (y < hh) {
      const k = tf(x * 6, y * 6, 64, 3);
      const lamp = 0.35 * Math.exp(-Math.abs(x + 0.9) / 0.9);
      col = V3(0.04 + 0.05 * k + lamp * 0.25 + 0.16 * L, 0.08 + 0.08 * k + lamp * 0.3 + 0.2 * L, 0.06 + 0.05 * k + lamp * 0.2 + 0.2 * L);
    }
    // the white gate and pickets, catching the porch light
    if (y < 0.85 && Math.abs(x) < 0.9) {
      const px = fr(x / 0.16) * 0.16;
      if ((px < 0.045 && y < 0.82 - 0.03 * (px > 0.0225 ? 1 : 0)) || Math.abs(y - 0.62) < 0.025 || Math.abs(y - 0.2) < 0.025) {
        const k = 0.45 + 0.2 * (1 - Math.abs(x)) + 0.4 * L; col = V3(0.62 * k, 0.64 * k, 0.66 * k);
      }
    }
    return col;
  }
  // the porch and the path, wet, under the porch lamp; returns [r,g,b] lit
  function groundAt(x, z, t) {
    const L = LT.lightning;
    let r, g, b;
    if (z < ZD + 1.25 && Math.abs(x) < 1.0) {
      // stone flags
      const u = (x + 3) / 0.38, v = (z - ZD) / 0.38;
      const ln = Math.min(Math.abs(fr(u) - 0.5), Math.abs(fr(v + (fl(u) & 1) * 0.5) - 0.5));
      const k = 0.85 + 0.3 * tn(x * 20, z * 20, 71);
      r = 0.30 * k; g = 0.30 * k; b = 0.33 * k;
      if (ln > 0.46) { r *= 0.5; g *= 0.5; b *= 0.5; }
      // porch lamp pool and the warm spill from the open door
      const pl = 0.9 / (1 + ((x - 0.8) ** 2 + (z - ZD) ** 2) / 0.6);
      r *= 0.35 + pl; g *= 0.35 + pl * 0.95; b *= 0.4 + pl * 0.85;
      const sp = LT.spill * Math.exp(-Math.abs(x + 0.11) / 0.4) * Math.exp(-(z - ZD) / 0.9) * 1.5;
      r += sp * 0.45; g += sp * 0.3; b += sp * 0.16;
      // puddle ripples
      const rp = Math.sin(Math.hypot(x - 0.3, z - ZD - 0.8) * 70 - per(60, t)) * 0.04;
      r += rp; g += rp; b += rp * 1.2;
    } else {
      // the garden path toward the gate, and wet lawn
      const path = Math.abs(x + 0.05) < 0.45;
      const k = tn(x * 8, z * 8, 72);
      if (path) { r = 0.16 + 0.05 * k; g = 0.16 + 0.05 * k; b = 0.19 + 0.05 * k; }
      else { r = 0.05 + 0.03 * k; g = 0.09 + 0.04 * k; b = 0.07 + 0.03 * k; }
      const lampRefl = 0.3 * Math.exp(-Math.abs(x + 0.9) / 0.5) * (path ? 1 : 0.4);
      r += lampRefl * 0.9; g += lampRefl * 0.8; b += lampRefl * 0.6;
    }
    return V3(r + 0.12 * L, g + 0.13 * L, b + 0.16 * L);
  }
  // the view out through an opening: [r,g,b] 0..1 and the depth along the ray (in t units)
  let ODEP = 0;
  function outsideRay(ex, ey, ez, dx, dy, dz, t) {
    if (dy < 0) {
      const tg = -ey / dy, z = ez + tg * dz;
      if (z < ZG) { ODEP = tg; return groundAt(ex + tg * dx, z, t); }
    }
    if (dy > 0) {
      const tr = (2.52 - ey) / dy, z = ez + tr * dz;
      if (z < ZD + 1.15 && z > ZD) {
        ODEP = tr; const x = ex + tr * dx;
        const pl = 0.5 / (1 + ((x - 0.8) ** 2 + (z - ZD) ** 2) / 0.4);
        const bm = Math.abs(fr((x + 3) / 0.3) - 0.5) < 0.08 ? 0.6 : 1;
        return [0.12 * bm + pl * 0.55, 0.10 * bm + pl * 0.48, 0.10 * bm + pl * 0.4];
      }
    }
    const tb = (ZG - ez) / dz; ODEP = tb;
    return gardenAt(ex + tb * dx, ey + tb * dy, t);
  }

  /* ---------------------------------------------------------------- rain on glass */
  // beads that sit and runnels that slide down, periodic with the loop. Returns 0 (none) or a shading code in RAIN_*
  let RSH = 0, RHL = 0;
  function rainOnGlass(u, v, t, s) {
    // u, v: metres on the pane. RSH: refraction darkening 0..1; RHL: highlight 0..1
    RSH = 0; RHL = 0;
    const cu = 0.022, ci = fl(u / cu), lu = u - (ci + 0.5) * cu;
    // a runnel in this column: slides down with a period that divides the loop
    const n = 9 + fl(ih(ci, s, 5) * 9), P = D / n, ph0 = ih(ci, s, 6);
    const run = fr(t / P + ph0), vy = 2.2 - run * 2.6 + ih(ci, s, 7) * 0.3;
    const wob = Math.sin(v * 40 + ci) * 0.002;
    const rr = 0.0045 + ih(ci, s, 8) * 0.003;
    const dd = Math.hypot(lu - wob, (v - vy) * 0.8);
    if (dd < rr) { RSH = 0.6; RHL = (lu < -rr * 0.2 && v > vy) ? 1 : 0; return; }
    if (v > vy && v < vy + 0.25 && Math.abs(lu - wob) < 0.0012) { RSH = 0.25; return; }
    // static beads on a grid
    const bu = 0.016, bv = 0.02, bi = fl(u / bu), bj = fl(v / bv);
    const hb = ih(bi, bj, s + 11);
    if (hb < 0.45) {
      const ox = (ih(bi, bj, s + 12) - 0.5) * bu * 0.6, oy = (ih(bi, bj, s + 13) - 0.5) * bv * 0.6;
      const r2 = 0.0016 + hb * 0.003;
      const du = u - (bi + 0.5) * bu - ox, dv = v - (bj + 0.5) * bv - oy;
      const dq = Math.hypot(du, dv);
      if (dq < r2) { RSH = 0.45; RHL = du < 0 && dv > 0 && dq > r2 * 0.4 ? 0.8 : 0; }
    }
  }

  /* ---------------------------------------------------------------- the frosted pane and what stands behind it */
  // the silhouette density (0 none .. 1 solid) at a world point (x, y) on the glass, with blur b
  function sdBox(px, py, hx, hy) { const dx = Math.abs(px) - hx, dy = Math.abs(py) - hy; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); }
  function silAt(x, y) {
    const g = GN;
    if (!g || g.a <= 0) return 0;
    const px = (x - g.x) / g.k, py = (y - g.y0) / g.k;      // her own coordinates, feet at 0 (k: apparent scale)
    let d = 9;
    // body: a round, short coat
    { const w = 0.2 + Math.max(0, 1.18 - py) * 0.08; d = Math.min(d, Math.max(Math.abs(px) - w, py - 1.18) - 0.02); }
    { const dx = px, dy = py - 1.17; d = Math.min(d, Math.hypot(dx / 1.25, dy) - 0.16); }
    // head
    d = Math.min(d, Math.hypot(px - g.hx, py - 1.32) - 0.085);
    // sou'wester: brim and crown
    d = Math.min(d, Math.hypot((px - g.hx) / 2.3, (py - 1.405 + Math.abs(px - g.hx) * 0.12) / 0.5) - 0.085);
    d = Math.min(d, Math.hypot((px - g.hx) / 1.1, (py - 1.45) / 0.9) - 0.075);
    // the knocking arm, raised to the door
    if (g.arm > 0) {
      const ax = 0.17 + 0.03 * g.arm, ay = 0.98 + 0.12 * g.arm;
      d = Math.min(d, segD(px, py, 0.17, 1.12, ax, ay) - 0.045, Math.hypot(px - ax, py - ay) - 0.05 * (1 + 0.2 * g.knock));
    }
    // the dog in her arms: body, head, ears; paws at the glass when it scrabbles
    if (g.dog > 0) {
      const dx0 = -0.02, dy0 = 1.06 + g.dogY;
      d = Math.min(d, Math.hypot((px - dx0) / 1.7, py - dy0) - 0.075);
      const hx = -0.12 + g.dogHx, hy = 1.17 + g.dogY + g.dogHy;
      d = Math.min(d, Math.hypot(px - hx, py - hy) - 0.06);
      d = Math.min(d, Math.hypot((px - hx + 0.045) / 0.6, py - hy - 0.05) - 0.03, Math.hypot((px - hx - 0.045) / 0.6, py - hy - 0.05) - 0.03);
      if (g.paw > 0) {
        d = Math.min(d, segD(px, py, hx + 0.02, hy - 0.04, -0.17, g.p1) - 0.022, segD(px, py, hx + 0.06, hy - 0.04, -0.06, g.p2) - 0.022);
      }
    }
    return d;
  }
  function segD(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const u = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy + 1e-9), 0, 1);
    return Math.hypot(wx - vx * u, wy - vy * u);
  }
  function frostedAt(x, y, fp, t) {
    // returns lit colour [0..1] of the frosted pane at world (x, y) on the door
    const L = LT.lightning;
    const gy = (y - GY0) / (GY1 - GY0);
    let r = 0.44 + 0.12 * gy, g = 0.50 + 0.12 * gy, b = 0.62 + 0.10 * gy;
    // the street lamp shines through from the upper left
    const lg = 0.22 * Math.exp(-Math.hypot(x - (DX0 + 0.2), y - 1.75) / 0.25);
    r += lg; g += lg * 0.95; b += lg * 0.8;
    r += L * 0.45; g += L * 0.48; b += L * 0.5;
    // the silhouette, blurred by the glass
    let dn = 0;
    if (GN && GN.a > 0) {
      const d = silAt(x, y), bl = GN.blur;
      dn = clamp(0.5 - d / (2 * bl), 0, 1) * GN.a;
      dn = dn * dn * (3 - 2 * dn);
      const k = 1 - 0.8 * dn;
      r = r * k + 0.03 * dn; g = g * k + 0.03 * dn; b = b * k + 0.05 * dn;
    }
    // the pebbled texture of obscure glass
    const fine = 1 - sstep(0.0025, 0.008, fp);
    if (fine > 0) {
      const p = tn(x * 160, y * 160, 81), q = tn(x * 160 + 0.37, y * 160 + 0.21, 81);
      const s = (p - q) * 0.35 * fine;
      r += s * 0.5; g += s * 0.52; b += s * 0.55;
    }
    // rain on the outside, seen softly
    rainOnGlass(x + 3, y, t, 2);
    if (RSH) { const k = 1 - RSH * 0.3; r *= k; g *= k; b *= k; if (RHL) { r += 0.12 * RHL; g += 0.13 * RHL; b += 0.15 * RHL; } }
    // a faint warm reflection of the lamp on the glass
    r += 0.03; g += 0.02;
    return V3(r, g, b);
  }

  /* ---------------------------------------------------------------- the door leaf (inner face) */
  let HANDLE_A = 0;
  const PANELS = [[0.10, 0.38, 0.40, 0.94], [0.44, 0.72, 0.40, 0.94]], HOOKZ = [3.45, 3.78, 4.08];
  function leafTex(s, y, fp, t, outside) {
    // s: metres from the hinge; y: up. Sets the albedo etc. or returns a lit colour via LITC
    SNX = 0; SNY = 0; SNZ = -1; GL = 0;
    alb(0.34, 0.53, 0.40);
    const n = (tn(s * 50, y * 50, 91) - 0.5) * 0.05;
    AR *= 1 + n; AG *= 1 + n; AB *= 1 + n;
    // recessed panels with a bevel
    for (const pn of PANELS) {
      if (s > pn[0] && s < pn[1] && y > pn[2] && y < pn[3]) {
        const dl = s - pn[0], dr = pn[1] - s, db = y - pn[2], dt = pn[3] - y, m = Math.min(dl, dr, db, dt);
        if (m < 0.026) {
          if (m === dl) { SNX = 0.55; SNZ = -0.83; } else if (m === dr) { SNX = -0.55; SNZ = -0.83; }
          else if (m === db) { SNY = 0.55; SNZ = -0.83; } else { SNY = -0.55; SNZ = -0.83; }
        } else { AR *= 0.94; AG *= 0.94; AB *= 0.94; }
        if (Math.abs(m - 0.026) < fp * 0.6) mixA(0.25, 0.32, 0.25, 0.5);
      }
    }
    // the moulding round the glass
    const gm = Math.min(s - GS0, GS1 - s, y - GY0, GY1 - y);
    if (gm > -0.022 && gm < 0) { SNZ = -0.85; SNY = gm > -0.011 ? -0.5 : 0.5; mixA(0.48, 0.58, 0.47, 0.5); }
    // scuffs at the bottom where a dog asks to go out
    if (y < 0.36 && y > 0.02 && s > 0.2 && s < 0.62) {
      const sc = Math.abs(fr((s + y * 0.3) / 0.018) - 0.5);
      if (sc < 0.08 && tn(s * 40, y * 25, 92) > 0.62) mixA(0.62, 0.66, 0.55, 0.45);
    }
    // the letterbox (brass)
    if (s > 0.25 && s < 0.53 && y > 0.985 && y < 1.045) {
      alb(0.80, 0.60, 0.26); GL = 1;
      if (y > 1.006 && y < 1.024 && s > 0.27 && s < 0.51) alb(0.16, 0.11, 0.07);
      else if (y > 1.035) mixA(1, 0.88, 0.55, 0.6);
    }
    // the handle: backplate, keyhole, and the lever (which turns only when she turns it)
    if (s > HDS - 0.019 && s < HDS + 0.019 && y > HDY - 0.135 && y < HDY + 0.1) {
      alb(0.78, 0.58, 0.25); GL = 1;
      if (s > HDS + 0.012) mixA(0.45, 0.30, 0.12, 0.5); else if (s < HDS - 0.012) mixA(1, 0.86, 0.5, 0.4);
      const kx = s - HDS, ky = y - (HDY - 0.085);
      if ((Math.hypot(kx, ky - 0.006) < 0.0065) || (Math.abs(kx) < 0.003 && ky < 0 && ky > -0.016)) alb(0.08, 0.06, 0.05);
    }
    {
      const a = HANDLE_A, ca = Math.cos(a), sa = Math.sin(a);
      const lx = s - HDS, ly = y - HDY;
      const u = -(lx * ca + ly * sa), v = -lx * sa + ly * ca;     // along the lever (toward the hinge), across it
      if (u > -0.012 && u < 0.115 && Math.abs(v) < 0.011 + (u > 0.09 ? 0.003 : 0)) {
        alb(0.82, 0.62, 0.27); GL = 1.4;
        SNY = clamp(v / 0.012, -1, 1) * 0.7; SNZ = -Math.sqrt(1 - SNY * SNY);
        if (v > 0.004) mixA(1, 0.9, 0.6, 0.5);
        if (v < -0.006) mixA(0.42, 0.28, 0.1, 0.6);
      }
      if (Math.hypot(lx, ly) < 0.017) { alb(0.85, 0.66, 0.3); GL = 1.2; if (lx < -0.004 && ly > 0.004) mixA(1, 0.92, 0.65, 0.7); }
    }
    // the dog flap
    if (s > FPS0 && s < FPS1 && y > FPY0 && y < FPY1) {
      const b = Math.min(s - FPS0, FPS1 - s, y - FPY0, FPY1 - y);
      if (b < 0.02) { alb(0.22, 0.22, 0.24); if (b > 0.014) mixA(0.4, 0.4, 0.42, 0.6); return; }
      const a = FLAP_A, top = FPY1 - 0.02, hgt = top - FPY0 - 0.02;
      const vis = hgt * Math.cos(a);
      if (y > top - vis) {
        alb(0.30, 0.31, 0.33);
        const k = a > 0 ? 1 - 0.5 * Math.sin(a) : 1 + 0.25 * Math.sin(-a);
        AR *= k; AG *= k; AB *= k;
        if (y > top - 0.012) mixA(0.18, 0.18, 0.2, 0.6);
      } else { alb(0, 0, 0); ER = 22; EG = 24; EB = 32; }          // the wet night through the gap
    }
  }
  let FLAP_A = 0;

  /* ---------------------------------------------------------------- the living room, seen through the far arch */
  const SPINES = [[0.55, 0.2, 0.15], [0.3, 0.42, 0.32], [0.78, 0.62, 0.3], [0.25, 0.3, 0.45], [0.7, 0.66, 0.55]];
  function livingAt(x, y, t) {
    // a backdrop 2.4 m behind the far wall; returns lit colour 0..1
    let r = 0.62, g = 0.44, b = 0.27;
    const lx = x + 0.78;
    const glow = Math.exp(-Math.hypot(lx, y - 1.45) / 0.7);
    r = 0.42 + 0.5 * glow; g = 0.29 + 0.38 * glow; b = 0.18 + 0.2 * glow;
    if (y < 0.05) { r = 0.36; g = 0.22; b = 0.12; }
    if (y < 0.08 && Math.abs(x) < 1.1) { r = 0.5; g = 0.2; b = 0.15; }
    // a bookshelf, its spines in a dozen colours
    if (x > -1.85 && x < -1.12 && y < 2.0) {
      r = 0.28; g = 0.17; b = 0.1;
      const sh = fr(y / 0.38);
      if (sh > 0.1 && x > -1.82 && x < -1.15) {
        const bi = fl((x + 2) / 0.045), hh = 0.62 + 0.3 * ih(bi, fl(y / 0.38), 5);
        if (sh < hh) { const c = ih(bi, fl(y / 0.38), 6); const p = SPINES[fl(c * 5)]; r = p[0] * (0.6 + glow); g = p[1] * (0.6 + glow); b = p[2] * (0.6 + glow); }
      }
    }
    // the standing lamp
    if (Math.abs(lx) < 0.012 && y < 1.4) { r = 0.2; g = 0.14; b = 0.1; }
    if (Math.abs(lx) < 0.16 - (y - 1.4) * 0.25 && y > 1.4 && y < 1.68) { r = 1.0; g = 0.86; b = 0.58; }
    // the armchair (rust velvet) with a cushion and a throw
    const ax = x - 0.45;
    if ((Math.abs(ax) < 0.42 && y < 0.5) || (Math.abs(ax) < 0.36 && y < 0.95 + 0.05 * Math.cos(ax * 4))) {
      r = 0.52 * (0.5 + 0.6 * glow); g = 0.2 * (0.5 + 0.6 * glow); b = 0.14 * (0.5 + 0.6 * glow);
      if (Math.abs(Math.abs(ax) - 0.36) < 0.06 && y < 0.62) { r *= 0.8; g *= 0.8; b *= 0.8; }
      if (Math.abs(ax + 0.08) < 0.13 && y > 0.45 && y < 0.72) { r = 0.82; g = 0.74; b = 0.55; }
    }
    // a window with the storm in it
    if (x > 1.05 && x < 1.75 && y > 0.85 && y < 1.95) {
      r = 0.10 + 0.4 * LT.lightning; g = 0.12 + 0.42 * LT.lightning; b = 0.18 + 0.5 * LT.lightning;
      if (Math.abs(x - 1.4) < 0.015 || Math.abs(y - 1.4) < 0.015) { r = 0.4; g = 0.3; b = 0.2; }
      const st = fr((y + t * 1.7 + ih(fl(x / 0.03), 1, 3) * 3) / 0.4);
      if (st < 0.06 && fr(x / 0.03) < 0.3) { r += 0.12; g += 0.13; b += 0.16; }
    }
    return V3(r, g, b);
  }

  /* ---------------------------------------------------------------- the room, ray-cast per pixel */
  const TONE = (c) => (c > 205 ? 205 + (c - 205) / (1 + (c - 205) / 85) : c);
  function shadeOut(i, r, g, b, depth) {
    const j = i * 3;
    C[j] = TONE(r); C[j + 1] = TONE(g); C[j + 2] = TONE(b); DEP[i] = depth; FLG[i] = 0; OBJ[i] = 0; PART[i] = 0;
  }
  function litOut(i, px, py, pz, nx, ny, nz, vx, vy, vz, depth, lm, lu, lv) {
    if (lm) lightMap(lm, lu, lv); else lightAt(px, py, pz, nx, ny, nz);
    let r = 255 * AR * LR + ER, g = 255 * AG * LG + EG, b = 255 * AB * LB + EB;
    if (GL > 0) {
      // highlights: the lamp and the glass, reflected (Blinn)
      const vl = Math.hypot(vx, vy, vz);
      const wx = -vx / vl, wy = -vy / vl, wz = -vz / vl;
      let lx = LAMP[0] - px, ly = LAMP[1] - py, lz = LAMP[2] - pz; let ll = Math.hypot(lx, ly, lz);
      let hx = lx / ll + wx, hy = ly / ll + wy, hz = lz / ll + wz, hl = Math.hypot(hx, hy, hz);
      let sp = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), GL > 0.9 ? 40 : 14) / (1 + ll * ll / 1.2);
      r += GL * sp * 260; g += GL * sp * 200; b += GL * sp * 120;
      lx = GLASS[0] - px; ly = GLASS[1] - py; lz = GLASS[2] - pz; ll = Math.hypot(lx, ly, lz);
      hx = lx / ll + wx; hy = ly / ll + wy; hz = lz / ll + wz; hl = Math.hypot(hx, hy, hz);
      sp = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), GL > 0.9 ? 40 : 10) * LT.door * Math.max(0, lz / ll) / (1 + ll * ll / 3);
      r += GL * sp * 110; g += GL * sp * 135; b += GL * sp * 170;
    }
    shadeOut(i, r, g, b, depth);
  }
  function drawRoom(t) {
    const ex = CAM.ex, ey = CAM.ey, ez = CAM.ez, f = CAM.f;
    const th = doorAngle(t), cth = Math.cos(th), sth = Math.sin(th);
    const nX = sth, nZ = cth, uX = cth, uZ = -sth;
    const open = th > 0.0005, outsideCam = ez > ZD;
    const sk = knockShake(t) * 0.012;           // the door rattles in its frame
    HANDLE_A = handleAngle(t);
    FLAP_A = flapAngle(t);
    for (let y = 0, i = 0; y < H; y++) {
      ray(0.5, y + 0.5); const ax = DXr, ay = DYr, az = DZr;
      ray(1.5, y + 0.5); const sx_ = DXr - ax, sy_ = DYr - ay, sz_ = DZr - az;
    for (let x = 0; x < W; x++, i++) {
      const dx = ax + sx_ * x, dy = ay + sy_ * x, dz = az + sz_ * x;
      ER = EG = EB = 0; GL = 0;
      let tt = 1e9, surf = 0, ls = 0, ly = 0;
      if (outsideCam) {
        // standing on the porch looking in
        const tw = (ZD - ez) / dz;
        let hit = false;
        if (dy < 0) { const tg = -ey / dy; if (tg < tw) { const c = groundAt(ex + tg * dx, ez + tg * dz, t); shadeOut(i, c[0] * 255, c[1] * 255, c[2] * 255, tg * f); hit = true; } }
        if (!hit && dy > 0) { const tr = (2.52 - ey) / dy; if (tr < tw) { const c = outsideRay(ex, ey, ez, dx, dy, dz, t); shadeOut(i, c[0] * 255, c[1] * 255, c[2] * 255, tr * f); hit = true; } }
        if (hit) continue;
        const wx = ex + tw * dx, wy = ey + tw * dy;
        if (!(wx > DX0 && wx < DX1 && wy < DH && wy > 0)) {
          // the outside of the cottage: whitewashed render, the porch lamp, the door frame
          const fp = tw * f > 0 ? tw / 1 : 0.01;
          const fpp = (tw * f) / f / f * 1;
          alb(0.78, 0.76, 0.70);
          const n = (tf(wx * 14, wy * 14, 93, 3) - 0.5) * 0.18; AR *= 1 + n; AG *= 1 + n; AB *= 1 + n;
          const fd = Math.min(Math.abs(wx - DX0), Math.abs(wx - DX1), Math.abs(wy - DH));
          if (fd < 0.08 && wx > DX0 - 0.08 && wx < DX1 + 0.08 && wy < DH + 0.08) alb(0.86, 0.84, 0.78);
          if (wx > SL0 && wx < SL1 && wy > SLY0 && wy < SLY1) { alb(0.0, 0.0, 0.0); ER = 120; EG = 88; EB = 50; }
          const pl = 1.1 / (1 + ((wx - 0.8) ** 2 + (wy - 2.05) ** 2) / 0.12);
          const sp = LT.spill * 0.4;
          const lr = 0.16 + pl * 0.85 + sp, lg = 0.16 + pl * 0.78 + sp * 0.7, lb = 0.2 + pl * 0.62 + sp * 0.4;
          if (Math.hypot(wx - 0.8, wy - 2.05) < 0.06) { shadeOut(i, 255, 240, 200, tw * f); continue; }
          shadeOut(i, 255 * AR * lr + ER, 255 * AG * lg + EG, 255 * AB * lb + EB, tw * f);
          void fp; void fpp;
          continue;
        }
      }
      if (dx > 0) { const q = (HW - ex) / dx; if (q < tt) { tt = q; surf = 2; } } else if (dx < 0) { const q = (-HW - ex) / dx; if (q < tt) { tt = q; surf = 1; } }
      if (dy > 0) { const q = (HC - ey) / dy; if (q < tt) { tt = q; surf = 4; } } else if (dy < 0) { const q = -ey / dy; if (q < tt) { tt = q; surf = 3; } }
      if (dz > 0) { const q = (ZD - ez) / dz; if (q < tt) { tt = q; surf = 5; } } else if (dz < 0) { const q = (ZB - ez) / dz; if (q < tt) { tt = q; surf = 6; } }
      if (open) {
        const den = nX * dx + nZ * dz;
        if (Math.abs(den) > 1e-9) {
          const q = (nX * (DX0 - ex) + nZ * (ZD - ez)) / den;
          if (q > 0 && q < tt) {
            const hx = ex + q * dx, hz = ez + q * dz, hy = ey + q * dy, s = (hx - DX0) * uX + (hz - ZD) * uZ;
            if (s >= 0 && s <= DWID && hy >= 0 && hy <= DH) { tt = q; surf = 7; ls = s; ly = hy; }
          }
        }
      }
      const px = ex + tt * dx, py = ey + tt * dy, pz = ez + tt * dz, depth = tt * f, fp = depth / f;
      if (surf === 1 || surf === 2) {
        if (surf === 1 ? !hooksTex(pz, py, fp, t) : !(photoTex(pz, py, fp) || false)) wallTex(surf === 1 ? -1 : 1, pz, py, fp, t);
        else { SNX = surf === 1 ? 1 : -1; SNY = 0; SNZ = 0; }
        if (surf === 2 && lightSwitch(pz, py)) { alb(0.9, 0.87, 0.8); if (Math.abs(pz - 4.12) < 0.008 && Math.abs(py - 1.3) < 0.015) alb(0.6, 0.55, 0.45); }
        // a little corner shadow where the walls meet the door wall and the far wall
        const ao = 1 - 0.3 * Math.exp(-(ZD - pz) / 0.05) - 0.3 * Math.exp(-(pz - ZB) / 0.05);
        AR *= ao; AG *= ao; AB *= ao;
        litOut(i, px, py, pz, SNX, SNY, SNZ, dx, dy, dz, depth, LMAPS[surf], pz, py);
      } else if (surf === 3) {
        floorTex(px, pz, fp);
        litOut(i, px, py, pz, 0, 1, 0, dx, dy, dz, depth, LMAPS[3], px, pz);
      } else if (surf === 4) {
        alb(0.82, 0.78, 0.69);
        const rd = Math.hypot(px, pz - 2.0);
        if (rd < 0.14) { alb(0.88, 0.85, 0.77); if (Math.abs(rd - 0.1) < fp * 0.7 || Math.abs(rd - 0.13) < fp * 0.7) mixA(0.6, 0.55, 0.47, 0.6); }
        const ao = 1 - 0.35 * Math.exp(-(HW - Math.abs(px)) / 0.06) - 0.3 * Math.exp(-(ZD - pz) / 0.06);
        AR *= ao; AG *= ao; AB *= ao;
        litOut(i, px, py, pz, 0, -1, 0, dx, dy, dz, depth, LMAPS[4], px, pz);
      } else if (surf === 5) {
        // the door wall: doorway, sidelight, fanlight, architraves
        const wx = px, wy = py;
        const inDoor = wx > DX0 && wx < DX1 && wy < DH;
        if (inDoor && !open) {
          const s = wx - DX0 + sk, yy = wy + sk * 0.4;
          if (s > GS0 && s < GS1 && yy > GY0 && yy < GY1) { const c = frostedAt(wx + sk, yy, fp, t); shadeOut(i, c[0] * 255, c[1] * 255, c[2] * 255, depth); }
          else { leafTex(s, yy, fp, t, false); litOut(i, px, py, pz, SNX, SNY, SNZ, dx, dy, dz, depth); }
        } else if (inDoor) {
          const c = outsideRay(ex, ey, ez, dx, dy, dz, t); shadeOut(i, c[0] * 255, c[1] * 255, c[2] * 255, ODEP * f);
        } else if ((wx > SL0 && wx < SL1 && wy > SLY0 && wy < SLY1) || (wx > DX0 && wx < DX1 && wy > FLY0 && wy < FLY1)) {
          // clear glass, glazing bars, rain
          const isSL = wx > SL0;
          const bar = isSL ? Math.abs(wy - 1.15) < 0.012 : (Math.abs(wx - (DX0 + DWID / 3)) < 0.01 || Math.abs(wx - (DX0 + 2 * DWID / 3)) < 0.01);
          if (bar) { alb(0.88, 0.85, 0.78); litOut(i, px, py, pz, 0, 0, -1, dx, dy, dz, depth); continue; }
          const c = outsideRay(ex, ey, ez, dx, dy, dz, t);
          rainOnGlass(wx + 7, wy, t, isSL ? 3 : 4);
          let r = c[0] * 0.92 + 0.012, g = c[1] * 0.93 + 0.012, b = c[2] * 0.95 + 0.02;
          if (RSH) { const k = 1 - RSH * 0.45; r = r * k + 0.04 * RSH; g = g * k + 0.045 * RSH; b = b * k + 0.06 * RSH; if (RHL) { r += 0.3 * RHL; g += 0.32 * RHL; b += 0.36 * RHL; } }
          shadeOut(i, r * 255, g * 255, b * 255, Math.min(ODEP * f, 1e4));
        } else {
          // architraves and frames (cream), otherwise the wall
          const fr0 = (wx > DX0 - 0.07 && wx < SL1 + 0.05 && wy < FLY1 + 0.07) && !(wx > DX1 + 0.005 && wx < SL0 - 0.005 && wy < SLY0 - 0.04 && false);
          if (fr0) {
            alb(0.90, 0.87, 0.80); SNX = 0; SNY = 0; SNZ = -1;
            const e1 = Math.abs(wx - (DX0 - 0.07)), e2 = Math.abs(wx - (SL1 + 0.05)), e3 = Math.abs(wy - (FLY1 + 0.07));
            if (Math.min(e1, e2, e3) < 0.012) mixA(0.62, 0.57, 0.48, 0.6);
            if (wx > DX1 && wx < SL0 && wy < SLY0) { /* the mullion */ }
            if (wx > SL0 && wx < SL1 && wy < SLY0) { alb(0.42, 0.52, 0.41); if (Math.min(wx - SL0, SL1 - wx, SLY0 - wy) < 0.02) mixA(0.3, 0.38, 0.3, 0.5); }
            litOut(i, px, py, pz, SNX, SNY, SNZ, dx, dy, dz, depth);
          } else { wallTex(0, wx, wy, fp, t); litOut(i, px, py, pz, 0, 0, -1, dx, dy, dz, depth, LMAPS[5], wx, wy); }
        }
      } else if (surf === 6) {
        const inArch = Math.abs(px) < 0.40 && (py < 1.62 || Math.hypot(px, py - 1.62) < 0.40);
        if (inArch) {
          const tb = (ZB - 2.4 - ez) / dz;
          const c = livingAt(ex + tb * dx, ey + tb * dy, t);
          shadeOut(i, c[0] * 255, c[1] * 255, c[2] * 255, tb * f);
        } else {
          const ar = Math.abs(px) < 0.47 && (py < 1.62 || Math.hypot(px, py - 1.62) < 0.47);
          if (ar) { alb(0.90, 0.87, 0.80); } else wallTex(2, px, py, fp, t);
          litOut(i, px, py, pz, 0, 0, 1, dx, dy, dz, depth, LMAPS[6], px, py);
        }
      } else if (surf === 7) {
        // the open leaf
        if (ls > GS0 && ls < GS1 && ly > GY0 && ly < GY1) {
          const c = frostedAt(DX0 + ls, ly, fp, t); const k = den2(dx, dz, nX, nZ);
          shadeOut(i, c[0] * 255 * k, c[1] * 255 * k, c[2] * 255 * k, depth);
        } else {
          leafTex(ls, ly, fp, t, false);
          const wnx = SNX * uX + SNZ * nX, wnz = SNX * uZ + SNZ * nZ;
          litOut(i, px, py, pz, wnx, SNY, wnz, dx, dy, dz, depth);
        }
      }
    }
    }
  }
  const den2 = (dx, dz, nX, nZ) => 0.75 + 0.25 * Math.abs(nX * dx + nZ * dz) / Math.hypot(dx, dz);
  function handleAngle(t) {
    // only she turns it: at the grip, down, and back as the door opens; and at the close
    let a = 0;
    a += 0.62 * env(t, T.grip, T.latch, T.open0 + 0.25, T.open0 + 0.6);
    a += 0.5 * env(t, T.close1 - 0.25, T.close1 - 0.1, T.close1 + 0.05, T.close1 + 0.25);
    return a;
  }

  /* ---------------------------------------------------------------- props: ray-cast boxes, cylinders, ellipsoids */
  const PROPS = [];
  function box(x0, y0, z0, x1, y1, z1, sh) { PROPS.push({ k: 0, x0, y0, z0, x1, y1, z1, sh }); }
  function cyl(cx, cz, r, y0, y1, sh) { PROPS.push({ k: 1, cx, cz, r, y0, y1, sh, x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r }); }
  function ell(cx, cy, cz, rx, ry, rz, sh, ycut) { PROPS.push({ k: 2, cx, cy, cz, rx, ry, rz, sh, ycut: ycut === undefined ? 9 : ycut, x0: cx - rx, x1: cx + rx, y0: cy - ry, y1: cy + ry, z0: cz - rz, z1: cz + rz }); }
  function buildProps() {
    // the side table, the lamp, a small plant
    const wood = () => { alb(0.48, 0.30, 0.16); };
    box(0.30, 0.745, 2.75, 0.62, 0.785, 3.25, (p, n) => { wood(); if (n[1] > 0.5) { const g = tf(p[0] * 30, p[2] * 6, 95, 2); AR *= 0.85 + 0.3 * g; AG *= 0.85 + 0.3 * g; GL = 0.4; } });
    for (const [lx, lz] of [[0.315, 2.765], [0.585, 2.765], [0.315, 3.215], [0.585, 3.215]]) box(lx - 0.016, 0, lz - 0.016, lx + 0.016, 0.745, lz + 0.016, () => wood());
    box(0.31, 0.2, 2.76, 0.61, 0.222, 3.24, () => wood());
    cyl(LAMP[0], LAMP[2], 0.065, 0.785, 0.86, (p, n) => { alb(0.52, 0.62, 0.50); GL = 0.8; if (n[1] > 0.5) alb(0.6, 0.7, 0.57); });
    cyl(LAMP[0], LAMP[2], 0.011, 0.86, 1.06, () => { alb(0.8, 0.6, 0.28); GL = 1; });
    cyl(LAMP[0], LAMP[2], 0.135, 1.05, 1.29, (p, n) => {
      alb(0, 0, 0);
      const v = (p[1] - 1.05) / 0.24;
      const k = 0.8 + 0.25 * Math.sin(v * PI);
      ER = 250 * k; EG = 205 * k; EB = 140 * k;
      if (v < 0.06 || v > 0.94) { ER *= 0.75; EG *= 0.7; EB *= 0.6; }
      if (n[1] > 0.5) { ER = 255; EG = 238; EB = 190; }
      const pl = Math.abs(fr(Math.atan2(p[2] - LAMP[2], p[0] - LAMP[0]) / TAU * 26) - 0.5);
      if (pl < 0.08) { ER *= 0.9; EG *= 0.88; EB *= 0.85; }
    });
    cyl(0.375, 3.14, 0.042, 0.785, 0.86, () => { alb(0.62, 0.32, 0.2); });
    ell(0.375, 0.9, 3.14, 0.05, 0.05, 0.05, (p) => { alb(0.32, 0.46, 0.28); const k = tn(p[0] * 120, p[1] * 120, 96); if (k > 0.6) alb(0.48, 0.62, 0.38); if (k < 0.3) alb(0.2, 0.3, 0.18); });
    ell(0.40, 0.95, 3.12, 0.022, 0.05, 0.022, () => { alb(0.4, 0.56, 0.34); });
    ell(0.35, 0.93, 3.17, 0.03, 0.035, 0.02, () => { alb(0.36, 0.5, 0.3); });
    // a bowl for keys
    ell(0.50, 0.79, 3.17, 0.05, 0.02, 0.04, (p, n) => { alb(0.82, 0.78, 0.68); if (n[1] > 0.7) alb(0.5, 0.42, 0.3); }, 0.796);
    // the pendant lamp over the hall: a cable and a glowing glass shade
    cyl(PEND[0], PEND[2], 0.004, 2.16, 2.4, () => { alb(0.2, 0.18, 0.16); });
    ell(PEND[0], 2.12, PEND[2], 0.1, 0.07, 0.1, (p, n) => { alb(0, 0, 0); const k = 0.75 + 0.3 * Math.max(0, -n[1]); ER = 245 * k; EG = 200 * k; EB = 135 * k; if (n[1] > 0.4) { ER *= 0.6; EG *= 0.55; EB *= 0.5; } }, 2.13);
    // the dog's bed (tartan rim, cream fleece), its water bowl
    ell(0.37, 0.07, 3.98, 0.235, 0.085, 0.2, (p, n) => {
      const u = (p[0] + p[2]) / 0.06, v = (p[0] - p[2]) / 0.06;
      const a = fr(u) < 0.25, b = fr(v) < 0.25;
      alb(0.55, 0.22, 0.16);
      if (a || b) alb(0.40, 0.46, 0.36);
      if (a && b) alb(0.86, 0.80, 0.62);
    }, 0.115);
    ell(0.37, 0.045, 3.98, 0.175, 0.05, 0.145, (p) => { alb(0.88, 0.84, 0.74); const k = tn(p[0] * 200, p[2] * 200, 97); AR *= 0.9 + 0.15 * k; AG *= 0.9 + 0.15 * k; AB *= 0.9 + 0.15 * k; });
    cyl(0.53, 3.55, 0.07, 0, 0.055, (p, n) => { alb(0.62, 0.22, 0.17); GL = 0.6; if (n[1] > 0.5) { const r = Math.hypot(p[0] - 0.53, p[2] - 3.55); if (r < 0.056) { alb(0.4, 0.5, 0.6); GL = 1.2; } } });
    // wellies by the door
    for (const [bx, bz] of [[-0.47, 4.2], [-0.36, 4.23]]) {
      cyl(bx, bz, 0.052, 0, 0.34, (p, n) => { alb(0.25, 0.34, 0.25); GL = 0.9; if (p[1] > 0.31) alb(0.18, 0.24, 0.18); });
      box(bx - 0.05, 0, bz - 0.13, bx + 0.05, 0.08, bz, () => { alb(0.22, 0.30, 0.22); GL = 0.6; });
    }
  }
  function drawProps(t) {
    const ex = CAM.ex, ey = CAM.ey, ez = CAM.ez, f = CAM.f;
    const P = [0, 0, 0], N = [0, 0, 0];
    for (const pr of PROPS) {
      // screen bounds of the prop
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
      for (let c = 0; c < 8; c++) {
        const z = proj(c & 1 ? pr.x1 : pr.x0, c & 2 ? pr.y1 : pr.y0, c & 4 ? pr.z1 : pr.z0);
        if (z < 0.05) { behind = true; break; }
        x0 = Math.min(x0, PX); x1 = Math.max(x1, PX); y0 = Math.min(y0, PY); y1 = Math.max(y1, PY);
      }
      if (behind) continue;
      x0 = Math.max(0, fl(x0) - 1); y0 = Math.max(0, fl(y0) - 1); x1 = Math.min(W - 1, Math.ceil(x1) + 1); y1 = Math.min(H - 1, Math.ceil(y1) + 1);
      if (x0 > x1 || y0 > y1) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        ray(x + 0.5, y + 0.5);
        const dx = DXr, dy = DYr, dz = DZr;
        let tn = -1;
        if (pr.k === 0) {
          let ta = -1e9, tb = 1e9, ax = 0;
          const sl = (o, d, a, b, axis) => {
            if (Math.abs(d) < 1e-12) { if (o < a || o > b) tb = -1e9; return; }
            let q0 = (a - o) / d, q1 = (b - o) / d, sg = -1;
            if (q0 > q1) { const q = q0; q0 = q1; q1 = q; sg = 1; }
            if (q0 > ta) { ta = q0; ax = axis * sg; }
            if (q1 < tb) tb = q1;
          };
          sl(ex, dx, pr.x0, pr.x1, 1); sl(ey, dy, pr.y0, pr.y1, 2); sl(ez, dz, pr.z0, pr.z1, 3);
          if (ta <= tb && ta > 0) { tn = ta; N[0] = Math.abs(ax) === 1 ? Math.sign(ax) : 0; N[1] = Math.abs(ax) === 2 ? Math.sign(ax) : 0; N[2] = Math.abs(ax) === 3 ? Math.sign(ax) : 0; }
        } else if (pr.k === 1) {
          const ox = ex - pr.cx, oz = ez - pr.cz;
          const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - pr.r * pr.r, disc = b * b - 4 * a * c;
          if (disc >= 0 && a > 1e-12) {
            const q = (-b - Math.sqrt(disc)) / (2 * a), yy = ey + q * dy;
            if (q > 0 && yy >= pr.y0 && yy <= pr.y1) { tn = q; N[0] = (ox + q * dx) / pr.r; N[1] = 0; N[2] = (oz + q * dz) / pr.r; }
            else if (dy < 0 && ey > pr.y1) {
              const qc = (pr.y1 - ey) / dy, cx = ox + qc * dx, cz = oz + qc * dz;
              if (cx * cx + cz * cz <= pr.r * pr.r) { tn = qc; N[0] = 0; N[1] = 1; N[2] = 0; }
            }
          }
        } else {
          const ox = (ex - pr.cx) / pr.rx, oy = (ey - pr.cy) / pr.ry, oz = (ez - pr.cz) / pr.rz;
          const ddx = dx / pr.rx, ddy = dy / pr.ry, ddz = dz / pr.rz;
          const a = ddx * ddx + ddy * ddy + ddz * ddz, b = 2 * (ox * ddx + oy * ddy + oz * ddz), c = ox * ox + oy * oy + oz * oz - 1, disc = b * b - 4 * a * c;
          if (disc >= 0) {
            const sq = Math.sqrt(disc);
            let q = (-b - sq) / (2 * a), flip = 1;
            if (ey + q * dy > pr.ycut) { q = (-b + sq) / (2 * a); flip = -1; if (ey + q * dy > pr.ycut) q = -1; }
            if (q > 0) {
              tn = q;
              const hx = (ox + q * ddx) / pr.rx, hy = (oy + q * ddy) / pr.ry, hz = (oz + q * ddz) / pr.rz, hl = Math.hypot(hx, hy, hz);
              N[0] = flip * hx / hl; N[1] = flip * hy / hl; N[2] = flip * hz / hl;
            }
          }
        }
        if (tn <= 0) continue;
        const i = y * W + x, depth = tn * f;
        if (depth >= DEP[i]) continue;
        P[0] = ex + tn * dx; P[1] = ey + tn * dy; P[2] = ez + tn * dz;
        ER = EG = EB = 0; GL = 0;
        pr.sh(P, N);
        litOut(i, P[0], P[1], P[2], N[0], N[1], N[2], dx, dy, dz, depth);
      }
    }
  }

  /* ---------------------------------------------------------------- rain, falling outside and dripping off the porch */
  const RAIN = [];
  function buildRain() {
    for (let k = 0; k < 230; k++) {
      const n = 22 + fl(ih(k, 1, 31) * 14);
      RAIN.push({ x: -2.6 + ih(k, 2, 31) * 5.2, z: ZD + 0.25 + ih(k, 3, 31) * 6, P: D / n, ph: ih(k, 4, 31), drip: false });
    }
    for (let k = 0; k < 14; k++) {
      const n = 30 + fl(ih(k, 5, 32) * 18);
      RAIN.push({ x: -1.1 + k * 0.17 + ih(k, 6, 32) * 0.06, z: ZD + 1.15, P: D / n, ph: ih(k, 7, 32), drip: true });
    }
  }
  function blendPx(x, y, r, g, b, a, depth) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (depth >= DEP[i]) return;
    const j = i * 3;
    C[j] += (r - C[j]) * a; C[j + 1] += (g - C[j + 1]) * a; C[j + 2] += (b - C[j + 2]) * a;
  }
  function drawRain(t) {
    const L = LT.lightning;
    for (const d of RAIN) {
      const u = fr(t / d.P + d.ph);
      let y0, len;
      if (d.drip) { y0 = 2.52 - u * u * 3.2; len = 0.05 + u * 0.08; if (y0 < 0) continue; }
      else { y0 = 3.4 - u * 3.6; len = 0.17; if (y0 < -0.1) continue; }
      const wind = 0.045;
      const z0 = proj(d.x, y0, d.z); if (z0 < 0.1) continue;
      const ax = PX, ay = PY;
      proj(d.x - wind, y0 - len, d.z);
      const bx = PX, by = PY;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      const near = d.z < ZD + 1.4 ? 1 : 0.55;
      const a = (0.28 + 0.3 * L) * near;
      for (let s = 0; s <= n; s++) blendPx(ax + (bx - ax) * s / n, ay + (by - ay) * s / n, 170 + 60 * L, 185 + 60 * L, 205 + 50 * L, a, z0);
    }
  }

  /* ================================================================ characters: shaded primitives with pixel outlines */
  const SPR = { ox: 0, oy: 0, s: 1, z: 1, id: 1, cr: 1, sr: 0, mir: 1, gx: 0, gy: 0, gc: 1, gs: 0, gtx: 0, gty: 0, clip: null };
  let SX0 = W, SY0 = H, SX1 = -1, SY1 = -1, PT = 1;
  const RIG = { amb: [0.2, 0.17, 0.15], L: [] };            // the light rig for the character being drawn
  function rigAt(X, Y, Z, outside) {
    // gather the scene's lights as directions in the sprite's frame (x screen-right, y up, z toward the camera)
    RIG.L.length = 0;
    const add = (lx, ly, lz, r, g, b, fall, cap) => {
      let dx = lx - X, dy = ly - Y, dz = lz - Z; const d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) + 1e-6;
      dx /= d; dy /= d; dz /= d;
      const sx = dx * RX + dz * RZ, sy = dx * UX + dy * UY + dz * UZ, sz = -(dx * FX + dy * FY + dz * FZ);
      const k = Math.min(cap || 9, 1 / (1 + d2 / fall));
      RIG.L.push([sx * SPR.mir, sy, sz, r * k, g * k, b * k]);
    };
    if (!outside) {
      RIG.amb = [0.32, 0.27, 0.22];
      add(LAMP[0], LAMP[1], LAMP[2], 1.25, 1.06, 0.76, 0.9, 0.4);
      add(GLASS[0], GLASS[1], GLASS[2], 0.36 * LT.door, 0.46 * LT.door, 0.7 * LT.door, 3.5);
      add(FARL[0], FARL[1], FARL[2], 0.62, 0.42, 0.25, 3.5);
      add(PEND[0], PEND[1], PEND[2], 0.62, 0.5, 0.34, 1.6);
      if (LT.spill > 0) { add(-0.1, 1.2, ZD + 0.5, 0.12 * LT.spill, 0.14 * LT.spill, 0.2 * LT.spill, 2.5); add(0.6, 1.9, ZD + 0.3, 1.35 * LT.spill, 1.05 * LT.spill, 0.66 * LT.spill, 1.8); }
    } else {
      RIG.amb = [0.16, 0.16, 0.19];
      add(0.8, 2.05, ZD + 0.05, 1.05, 0.95, 0.75, 0.5);                                    // the porch lamp
      add(-0.1, 1.3, ZD - 0.6, 1.25 * LT.spill + 0.1, 0.9 * LT.spill + 0.07, 0.52 * LT.spill + 0.05, 1.6); // the warm hall
      add(-0.9, 2.6, ZG, 0.5, 0.48, 0.42, 60);                                              // the street lamp (rim)
      add(0, 4, ZG, 0.6 * LT.lightning, 0.65 * LT.lightning, 0.8 * LT.lightning, 200);
    }
  }
  function spBegin(X, Y, Z, id, lean, mir, outside) {
    proj(X, Y, Z);
    SPR.ox = PX; SPR.oy = PY; SPR.z = PZ; SPR.s = CAM.f / Math.max(0.05, PZ); SPR.id = id;
    const a = CAM.roll + (lean || 0); SPR.cr = Math.cos(a); SPR.sr = Math.sin(a); SPR.mir = mir || 1;
    SPR.gx = 0; SPR.gy = 0; SPR.gc = 1; SPR.gs = 0; SPR.gtx = 0; SPR.gty = 0; SPR.clip = null;
    SX0 = W; SY0 = H; SX1 = -1; SY1 = -1; PT = 1;
    rigAt(X, Y + 1.2, Z, outside);
    return PZ > 0.08;
  }
  // a group transform (a head that tilts, an arm that swings): rotate by a about (gx, gy), then move by (tx, ty)
  function grp(gx, gy, a, tx, ty) { SPR.gx = gx; SPR.gy = gy; SPR.gc = Math.cos(a); SPR.gs = Math.sin(a); SPR.gtx = tx || 0; SPR.gty = ty || 0; }
  const nogrp = () => grp(0, 0, 0, 0, 0);
  // local (after group) → screen, for bounds and anchors
  let QX = 0, QY = 0;
  function toScreen(lx, ly) {
    const rx = SPR.gx + (lx - SPR.gx) * SPR.gc - (ly - SPR.gy) * SPR.gs + SPR.gtx;
    const ry = SPR.gy + (lx - SPR.gx) * SPR.gs + (ly - SPR.gy) * SPR.gc + SPR.gty;
    const mx = rx * SPR.mir;
    QX = SPR.ox + SPR.s * (mx * SPR.cr + ry * SPR.sr); QY = SPR.oy + SPR.s * (mx * SPR.sr - ry * SPR.cr);
  }
  let CR_ = 0, CG_ = 0, CB_ = 0;
  function shadeRig(r, g, b, nx, ny, nz) {
    let lr = RIG.amb[0], lg = RIG.amb[1], lb = RIG.amb[2];
    for (const l of RIG.L) {
      const d = nx * l[0] + ny * l[1] + nz * l[2];
      if (d > -0.15) { const k = (d + 0.15) / 1.15; lr += l[3] * k; lg += l[4] * k; lb += l[5] * k; }
    }
    CR_ = 255 * r * lr; CG_ = 255 * g * lg; CB_ = 255 * b * lb;
  }
  // rasterise a local-space region; inside(lx, ly) returns false or sets MAT (colour, normal) and returns true
  const MAT = { r: 0, g: 0, b: 0, nx: 0, ny: 0, nz: 1, a: 1, e: 0, line: true };
  function rast(lx0, ly0, lx1, ly1, inside) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let c = 0; c < 4; c++) { toScreen(c & 1 ? lx1 : lx0, c & 2 ? ly1 : ly0); x0 = Math.min(x0, QX); x1 = Math.max(x1, QX); y0 = Math.min(y0, QY); y1 = Math.max(y1, QY); }
    x0 = Math.max(0, fl(x0)); y0 = Math.max(0, fl(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    if (x0 > x1 || y0 > y1) return;
    const is = 1 / SPR.s, cr = SPR.cr, sr = SPR.sr, mir = SPR.mir, gc = SPR.gc, gs = SPR.gs, gx = SPR.gx, gy = SPR.gy, gtx = SPR.gtx, gty = SPR.gty;
    const clip = SPR.clip;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const i = py * W + px;
      if (SPR.z >= DEP[i] && OBJ[i] !== SPR.id) continue;
      const qx = (px + 0.5 - SPR.ox) * is, qy = (py + 0.5 - SPR.oy) * is;
      const rx = (qx * cr + qy * sr) * mir, ry = qx * sr - qy * cr;
      if (clip && !clip(rx, ry)) continue;
      const ux = rx - gx - gtx, uy = ry - gy - gty;
      const lx = gx + ux * gc + uy * gs, ly = gy - ux * gs + uy * gc;
      if (lx < lx0 || lx > lx1 || ly < ly0 || ly > ly1) continue;
      MAT.a = 1; MAT.e = 0; MAT.nx = 0; MAT.ny = 0; MAT.nz = 1; MAT.line = true;
      if (!inside(lx, ly)) continue;
      shadeRig(MAT.r, MAT.g, MAT.b, MAT.nx, MAT.ny, MAT.nz);
      if (MAT.e) { CR_ += MAT.r * 255 * MAT.e; CG_ += MAT.g * 255 * MAT.e; CB_ += MAT.b * 255 * MAT.e; }
      { const m = Math.max(CR_, CG_, CB_); if (m > 225) { const k = (225 + (m - 225) / (1 + (m - 225) / 60)) / m; CR_ *= k; CG_ *= k; CB_ *= k; } }
      const j = i * 3;
      if (MAT.a < 1) { C[j] += (CR_ - C[j]) * MAT.a; C[j + 1] += (CG_ - C[j + 1]) * MAT.a; C[j + 2] += (CB_ - C[j + 2]) * MAT.a; if (OBJ[i] !== SPR.id) continue; }
      else {
        C[j] = CR_; C[j + 1] = CG_; C[j + 2] = CB_;
        DEP[i] = SPR.z; FLG[i] = 1; OBJ[i] = SPR.id; PART[i] = MAT.line ? PT : 0;
      }
      if (px < SX0) SX0 = px; if (px > SX1) SX1 = px; if (py < SY0) SY0 = py; if (py > SY1) SY1 = py;
    }
  }
  // primitives (all in local metres)
  function mat(c, nx, ny, nz) { MAT.r = c[0]; MAT.g = c[1]; MAT.b = c[2]; MAT.nx = nx; MAT.ny = ny; MAT.nz = nz; }
  function E(cx, cy, rx, ry, rot, c, tex, flat) {
    const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0), R = Math.max(rx, ry);
    rast(cx - R, cy - R, cx + R, cy + R, (lx, ly) => {
      const dx = lx - cx, dy = ly - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry, q = u * u + v * v;
      if (q > 1) return false;
      const nz = Math.sqrt(1 - q) * (flat || 1);
      const nl = Math.hypot(u, v, nz);
      mat(c, (u * ca - v * sa) / nl, (u * sa + v * ca) / nl, nz / nl);
      if (tex) return tex(lx, ly, u, v, q) !== false;
      return true;
    });
  }
  // a tapered capsule (a limb, a strand, a stroke)
  function Cp(ax, ay, bx, by, ra, rb, c, tex, flat) {
    const R = Math.max(ra, rb);
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy + 1e-12, L = Math.sqrt(L2);
    rast(Math.min(ax, bx) - R, Math.min(ay, by) - R, Math.max(ax, bx) + R, Math.max(ay, by) + R, (lx, ly) => {
      const wx = lx - ax, wy = ly - ay, u = clamp((wx * vx + wy * vy) / L2, 0, 1);
      const ex = wx - vx * u, ey = wy - vy * u, d = Math.hypot(ex, ey), r = ra + (rb - ra) * u;
      if (d > r) return false;
      const k = d / r, nz = Math.sqrt(Math.max(0, 1 - k * k)) * (flat || 1), sgn = (ex * -vy + ey * vx) >= 0 ? 1 : -1;
      const px = -vy / L * k * sgn, py = vx / L * k * sgn, nl = Math.hypot(px, py, nz);
      mat(c, px / nl, py / nl, nz / nl);
      if (tex) return tex(lx, ly, u, k * sgn) !== false;
      return true;
    });
  }
  // a polygon (even-odd), flat-shaded with an optional normal function
  function Pg(pts, c, tex, nrm) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const n = pts.length;
    rast(x0, y0, x1, y1, (lx, ly) => {
      let ins = false;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const pa = pts[a], pb = pts[b];
        if ((pa[1] > ly) !== (pb[1] > ly) && lx < (pb[0] - pa[0]) * (ly - pa[1]) / (pb[1] - pa[1]) + pa[0]) ins = !ins;
      }
      if (!ins) return false;
      if (nrm) { nrm(lx, ly); mat(c, MAT.nx, MAT.ny, MAT.nz); } else mat(c, 0, 0, 1);
      if (tex) return tex(lx, ly) !== false;
      return true;
    });
  }
  // a soft blended mark (blush, glare, steam)
  function Soft(cx, cy, rx, ry, c, a, e) {
    rast(cx - rx, cy - ry, cx + rx, cy + ry, (lx, ly) => {
      const q = ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2;
      if (q > 1) return false;
      mat(c, 0, 0, 1); MAT.a = a * (1 - q); MAT.e = e || 0; return true;
    });
  }
  // outlines: dark edge pixels on the outside of the figure, finer lines where parts overlap
  const OMARK = new Uint8Array(NP);
  function outline(dark, inner) {
    if (SX1 < SX0) return;
    const id = SPR.id;
    for (let y = SY0; y <= SY1; y++) for (let x = SX0; x <= SX1; x++) {
      const i = y * W + x;
      if (OBJ[i] !== id) continue;
      let edge = 0;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const k of nb) {
        if (k < 0) continue;
        if (OBJ[k] !== id) { edge = 2; break; }
        if (PART[i] && PART[k] > PART[i]) edge = 1;
      }
      OMARK[i] = edge;
    }
    if (SPR.s > 950) for (let y = SY0; y <= SY1; y++) for (let x = SX0; x <= SX1; x++) {
      const i = y * W + x;
      if (OBJ[i] !== id || OMARK[i] === 2) continue;
      if ((x > 0 && OMARK[i - 1] === 2) || (x < W - 1 && OMARK[i + 1] === 2) || (y > 0 && OMARK[i - W] === 2) || (y < H - 1 && OMARK[i + W] === 2)) OMARK[i] = 3;
    }
    for (let y = SY0; y <= SY1; y++) for (let x = SX0; x <= SX1; x++) {
      const i = y * W + x;
      if (OBJ[i] !== id || !OMARK[i]) continue;
      const j = i * 3, k = OMARK[i] === 2 ? dark : OMARK[i] === 3 ? (dark + 1) * 0.5 : inner;
      C[j] = C[j] * k + 18 * (1 - k); C[j + 1] = C[j + 1] * k + 11 * (1 - k); C[j + 2] = C[j + 2] * k + 12 * (1 - k);
      OMARK[i] = 0;
    }
  }

  /* ---------------------------------------------------------------- palette of the characters (albedo 0..1) */
  const SKIN = [0.95, 0.72, 0.57], SKIN_D = [0.78, 0.52, 0.42], HAIR = [0.56, 0.23, 0.12], HAIR_L = [0.74, 0.36, 0.18], HAIR_D = [0.33, 0.12, 0.07];
  const CARD = [0.74, 0.49, 0.2], CARD_D = [0.56, 0.35, 0.12], TOP = [0.93, 0.89, 0.79], TROU = [0.30, 0.37, 0.29];
  const SOCK_A = [0.74, 0.22, 0.17], SOCK_B = [0.94, 0.90, 0.80], TORT = [0.40, 0.21, 0.10], MUG = [0.45, 0.60, 0.48], MUGB = [0.93, 0.89, 0.79];
  const LIP = [0.80, 0.42, 0.40], MOUTH = [0.32, 0.10, 0.10], TEETH = [0.98, 0.95, 0.88], TONGUE = [0.93, 0.52, 0.55], BLUSH = [0.95, 0.45, 0.48];
  const EYEW = [0.97, 0.95, 0.92], IRIS = [0.36, 0.22, 0.12], PUPIL = [0.06, 0.04, 0.04], BROW = [0.42, 0.17, 0.09];
  const YEL = [1.0, 0.80, 0.16], YEL_D = [0.80, 0.55, 0.08], NSKIN = [0.96, 0.76, 0.64], WHITEH = [0.95, 0.94, 0.92], GOLD = [0.88, 0.70, 0.32], WELLY = [0.30, 0.42, 0.30];
  const DOGW = [0.97, 0.95, 0.90], DOGT = [0.80, 0.52, 0.27], MUD = [0.42, 0.28, 0.16], NOSE = [0.08, 0.06, 0.06], COLLAR = [0.80, 0.18, 0.15];

  /* ---------------------------------------------------------------- shapes for bodies: a rounded trapezoid (torso, coat) */
  function RT(cx, yb, yt, wb, wt, r, c, tex, bulge) {
    const R = Math.max(wb, wt);
    rast(cx - R, yb, cx + R, yt, (lx, ly) => {
      const v = (ly - yb) / (yt - yb), w = wb + (wt - wb) * v, x = Math.abs(lx - cx);
      if (x > w) return false;
      if (ly > yt - r && x > w - r && Math.hypot(x - (w - r), ly - (yt - r)) > r) return false;
      const u = clamp((lx - cx) / w, -1, 1), b = bulge || 0.8;
      const nyTop = ly > yt - r ? (ly - (yt - r)) / r * 0.7 : 0;
      MAT.nx = u * b; MAT.ny = 0.08 + nyTop; MAT.nz = Math.sqrt(Math.max(0.05, 1 - u * u * b * b - nyTop * nyTop));
      mat(c, MAT.nx, MAT.ny, MAT.nz);
      if (tex) return tex(lx, ly, u, v) !== false;
      return true;
    });
  }
  // hair: irregular strand clumps flowing from a centre, with a soft sheen band
  function hairShade(cx, cy, kind) {
    return (lx, ly) => {
      const a = Math.atan2(ly - cy, lx - cx), r = Math.hypot(lx - cx, ly - cy);
      const st = vn1(a * 26 + kind * 13.7, 40 + kind) * 0.7 + vn1(a * 61 + r * 40, 50 + kind) * 0.3;
      let k = 0.8 + 0.3 * st;
      const sheen = Math.exp(-(((MAT.ny - 0.45) / 0.16) ** 2)) * (0.5 + 0.7 * st);
      MAT.r *= k + sheen * 0.22; MAT.g *= k + sheen * 0.16; MAT.b *= k + sheen * 0.1;
    };
  }
  const knit = (lx, ly, cols, amp) => {
    // cable columns and a fine rib, gentle (the cardigan is chunky but soft)
    const cu = fr((lx + 1) / cols) - 0.5, inC = Math.abs(cu) < 0.22;
    const cab = inC ? Math.sin(ly * 110 + Math.sign(cu) * Math.abs(cu) * 18) : 0;
    const rib = Math.sin(lx * 520) > 0.2 ? 1 : 0;
    const k = 1 + (inC ? cab * 0.09 : (rib ? 0.03 : -0.035)) * amp;
    MAT.r *= k; MAT.g *= k; MAT.b *= k;
    if (Math.abs(Math.abs(cu) - 0.25) < 0.025) { MAT.r *= 0.88; MAT.g *= 0.86; MAT.b *= 0.84; }
  };

  /* ---------------------------------------------------------------- her face (front), the heart of the film */
  // expression: eo eye-open (1 normal), px/py gaze, ps pupil size, bl brow lift, ba brow tilt (worry +), mo mouth open,
  // sm smile (-1..1), mw mouth width, bs blush, tilt head roll, hy head nod, sh shoulders raised, closed: 'happy'|'shut'|null
  const FACE = { x: 0, y: 0, s: 1, mx: 0, my: 0 };          // screen anchors for the ink (head centre, mouth)
  function drawHerFront(X, Z, ex, pose, t) {
    if (!spBegin(X, 0, Z, 2, 0, 1, false)) return;
    const sh = ex.sh || 0, hy = ex.hy || 0, tilt = ex.tilt || 0, br = Math.sin(per(13, t)) * 0.004;
    const sy = 1.425 + sh + br;
    // ---- torso: an oversized honey cardigan over a cream top
    PT = 2;
    RT(0, 0.86, sy, 0.235, 0.2, 0.075, CARD, (lx, ly) => {
      knit(lx, ly, 0.085, 1);
      if (Math.abs(lx) < 0.003 + Math.max(0, ly - (sy - 0.2)) * 0.36) { MAT.r = TOP[0]; MAT.g = TOP[1]; MAT.b = TOP[2]; if (ly > sy - 0.03) { MAT.r *= 0.9; MAT.g *= 0.88; MAT.b *= 0.86; } }
      else if (Math.abs(Math.abs(lx) - (0.003 + Math.max(0, ly - (sy - 0.2)) * 0.36)) < 0.012) { MAT.r *= 0.86; MAT.g *= 0.82; MAT.b *= 0.78; const rb = Math.sin(ly * 400) > 0 ? 1.05 : 0.95; MAT.r *= rb; MAT.g *= rb; MAT.b *= rb; }
      if (ly < 0.92) { const rb = Math.sin(lx * 600) > 0 ? 0.9 : 1; MAT.r *= rb; MAT.g *= rb; MAT.b *= rb; }
    }, 0.75);
    for (let k = 0; k < 3; k++) E(0.016, sy - 0.235 - k * 0.075, 0.0095, 0.0095, 0, [0.62, 0.42, 0.24], (lx, ly) => { if (Math.hypot(lx - 0.013, ly - (sy - 0.235 - k * 0.075) - 0.003) < 0.0028) { MAT.r = 0.95; MAT.g = 0.8; MAT.b = 0.6; } });
    // neck
    PT = 3;
    Cp(0, sy - 0.035, 0, sy + 0.03, 0.03, 0.029, SKIN, (lx, ly) => { const k = ly > sy + 0.005 ? 0.74 : 0.9; MAT.r *= k; MAT.g *= k; MAT.b *= k; });
    rast(-0.05, sy - 0.05, 0.05, sy - 0.02, (lx, ly) => { const d = Math.abs(Math.hypot(lx / 1.25, ly - (sy + 0.005)) - 0.042); if (d > 0.0055) return false; mat(TOP, 0, 0.3, 0.95); return true; });
    // ---- arms and what they hold
    const mug = pose.mug, dog = pose.dog;
    const sleeve = (sg, ex_, ey_, hx, hy_) => {
      PT = 4;
      Cp(sg * 0.185, sy - 0.07, ex_, ey_, 0.062, 0.054, CARD, (lx, ly) => knit(lx * 0.5, ly, 0.05, 0.6));
      PT = 5;
      Cp(ex_, ey_, hx, hy_, 0.054, 0.047, CARD, (lx, ly, u) => { knit(lx * 0.5, ly, 0.05, 0.6); if (u > 0.8) { const rb = Math.sin(lx * 700 + ly * 700) > 0 ? 0.86 : 0.95; MAT.r *= rb; MAT.g *= rb; MAT.b *= rb; } });
    };
    if (dog) { sleeve(-1, -0.235, 1.12, -0.02, 1.2); sleeve(1, 0.235, 1.13, 0.1, 1.23); }
    else if (mug) {
      const lift = pose.mugY || 0;
      sleeve(-1, -0.24, 1.1 + lift * 0.4, -0.065, 1.15 + lift); sleeve(1, 0.24, 1.1 + lift * 0.4, 0.065, 1.15 + lift);
    } else { sleeve(-1, -0.235, 1.12, -0.24, 0.98); sleeve(1, 0.235, 1.12, 0.24, 0.98); }
    if (mug) {
      PT = 6;
      const mx = pose.mugX || 0, my = 1.165 + (pose.mugY || 0);
      E(mx - 0.054, my + 0.006, 0.02, 0.028, 0, MUG, (lx, ly, u, v, q) => q > 0.3);
      RT(mx, my - 0.045, my + 0.05, 0.041, 0.044, 0.006, MUG, (lx, ly) => {
        if (ly > my - 0.006 && ly < my + 0.012) { MAT.r = MUGB[0]; MAT.g = MUGB[1]; MAT.b = MUGB[2]; }
        if (ly > my + 0.044) { MAT.r *= 1.1; MAT.g *= 1.1; MAT.b *= 1.1; }
      }, 0.9);
      PT = 7;
      for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) E(mx + sg * 0.036, my - 0.012 - k * 0.018 + (sg > 0 ? 0.004 : 0), 0.016, 0.0095, sg * 0.25, SKIN);
      E(mx - 0.028, my + 0.034, 0.011, 0.008, 0.5, SKIN);
      for (let k = 0; k < 3; k++) {
        const u = fr(t / (D / 29) + k / 3), ax = mx + Math.sin(u * 7 + k * 2 + per(3, t)) * 0.012 + (k - 1) * 0.012, ay = my + 0.07 + u * 0.12;
        Soft(ax, ay, 0.011 + u * 0.01, 0.017 + u * 0.01, [1, 1, 1], 0.25 * Math.sin(u * PI), 0.3);
      }
    }
    if (dog) { PT = 8; drawDogHeld(0.115 + (dog.dx || 0), 1.30 + (dog.dy || 0), 1.05, dog, t, 2, false, 'body'); }
    // ---- the head
    grp(0, sy + 0.04, tilt, (ex.hx || 0), sh * 0.6 + hy + br);
    PT = 10;
    // hair: the mass on top, the bun and its pencil
    E(0, 1.565, 0.104, 0.112, 0, HAIR, hairShade(0.004, 1.64, 0));
    E(0.012, 1.69, 0.062, 0.05, 0.15, HAIR, (lx, ly, u, v) => { const a = Math.atan2(v, u), r = Math.hypot(u, v); const k = 0.86 + 0.18 * Math.sin(a * 2 + r * 8) + 0.1 * MAT.ny; MAT.r *= k; MAT.g *= k; MAT.b *= k; });
    PT = 11;
    pencil(0.072, 1.737, -0.048, 1.708);
    PT = 12;
    for (const sg of [-1, 1]) E(sg * 0.08, 1.518, 0.014, 0.022, 0, SKIN, (lx, ly, u, v, q) => { if (q < 0.35) { MAT.r *= 0.86; MAT.g *= 0.78; MAT.b *= 0.75; } });
    // the face: soft cheeks, a small chin
    PT = 13;
    rast(-0.085, 1.42, 0.085, 1.63, (lx, ly) => {
      const v = (ly - 1.526) / 0.094, w = 0.079 * (1 - 0.24 * Math.max(0, -v) ** 1.8), u = lx / w;
      const q = u * u + v * v;
      if (q > 1) return false;
      const nz = Math.sqrt(1 - q) * 1.35, nl = Math.hypot(u, v * 0.8, nz);
      mat(SKIN, u / nl, v * 0.8 / nl, nz / nl);
      return true;
    });
    toScreen(0, 1.526); FACE.x = QX; FACE.y = QY; FACE.s = SPR.s; toScreen(0, 1.474); FACE.mx = QX; FACE.my = QY;
    const bs = 0.3 + (ex.bs || 0);
    for (const sg of [-1, 1]) Soft(sg * 0.046, 1.494, 0.02, 0.012, BLUSH, 0.42 * bs);
    for (let k = 0; k < 10; k++) {
      const sg = k & 1 ? 1 : -1, fx = sg * (0.018 + ih(k, 1, 51) * 0.035), fy = 1.502 + (ih(k, 2, 51) - 0.5) * 0.016;
      E(fx, fy, 0.0017, 0.0017, 0, [0.76, 0.46, 0.32]);
    }
    // a small nose: one shadow, one light
    E(0.006, 1.5, 0.007, 0.005, 0.4, SKIN_D, null, 0.4);
    E(-0.002, 1.506, 0.004, 0.006, 0, [1, 0.86, 0.74], null, 0.6);
    // eyes
    PT = 14;
    for (const sg of [-1, 1]) drawEye(sg * 0.031, 1.527, ex, sg);
    // brows
    PT = 15;
    for (const sg of [-1, 1]) {
      const bl = (ex.bl || 0) * 0.011, ba = (ex.ba || 0) * 0.007;
      Cp(sg * 0.014, 1.556 + bl + ba, sg * 0.031, 1.561 + bl + ba * 0.3, 0.0034, 0.003, BROW);
      Cp(sg * 0.031, 1.561 + bl + ba * 0.3, sg * 0.048, 1.556 + bl - ba * 0.4, 0.003, 0.0022, BROW);
    }
    // mouth
    PT = 16;
    drawMouth(0, 1.474, ex);
    // the fringe: two curtains from a centre parting, and loose strands
    PT = 17;
    E(-0.044, 1.612, 0.054, 0.025, -0.42, HAIR, hairShade(0.0, 1.66, 2));
    E(0.047, 1.608, 0.05, 0.023, 0.4, HAIR, hairShade(0.0, 1.66, 3));
    Cp(-0.072, 1.6, -0.079, 1.53, 0.008, 0.004, HAIR); Cp(-0.079, 1.53, -0.074, 1.47, 0.004, 0.0018, HAIR);
    Cp(0.074, 1.598, 0.082, 1.535, 0.007, 0.0035, HAIR); Cp(0.082, 1.535, 0.079, 1.49, 0.0035, 0.0016, HAIR);
    // glasses: thin tortoiseshell rings, a bridge, a soft glare
    PT = 18;
    for (const sg of [-1, 1]) {
      const cx = sg * 0.031, cy = 1.528;
      rast(cx - 0.031, cy - 0.031, cx + 0.031, cy + 0.031, (lx, ly) => {
        const r = Math.hypot(lx - cx, ly - cy);
        if (r > 0.0295 || r < 0.0262) return false;
        mat(TORT, (lx - cx) / r * 0.5, (ly - cy) / r * 0.5, 0.7);
        if (tn(lx * 300, ly * 300, 52) > 0.6) { MAT.r = 0.66; MAT.g = 0.4; MAT.b = 0.18; }
        return true;
      });
      const g = ex.glare === undefined ? 0.5 : ex.glare;
      rast(cx - 0.026, cy - 0.026, cx + 0.026, cy + 0.026, (lx, ly) => {
        const r = Math.hypot(lx - cx, ly - cy);
        if (r > 0.026) return false;
        const band = Math.abs((lx - cx) + (ly - cy) * 0.9 - 0.008);
        if (band > 0.004) return false;
        mat([0.9, 0.95, 1], 0, 0, 1); MAT.a = 0.25 * g; MAT.e = 0.5; return true;
      });
    }
    Cp(-0.005, 1.532, 0.005, 1.532, 0.0024, 0.0024, TORT);
    nogrp();
    if (dog) { PT = 30; drawDogHeld(0.115 + (dog.dx || 0), 1.30 + (dog.dy || 0), 1.05, dog, t, 2, false, 'head'); }
    outline(0.4, 0.74);
  }
  function pencil(ax, ay, bx, by) {
    Cp(ax, ay, bx, by, 0.006, 0.006, [0.98, 0.8, 0.2], (lx, ly, u, k) => {
      if (u < 0.07) { MAT.r = 0.25; MAT.g = 0.22; MAT.b = 0.2; } else if (u < 0.16) { MAT.r = 0.94; MAT.g = 0.8; MAT.b = 0.6; }
      else if (u > 0.9) { MAT.r = 0.92; MAT.g = 0.55; MAT.b = 0.58; } else if (u > 0.84) { MAT.r = 0.75; MAT.g = 0.75; MAT.b = 0.72; }
      else if (k > 0.35) { MAT.r *= 0.85; MAT.g *= 0.82; }
    });
  }
  function drawEye(cx, cy, ex, sg) {
    const eo = ex.eo === undefined ? 1 : ex.eo, ps = ex.ps || 1;
    const lash = [0.17, 0.08, 0.06];
    if (ex.closed || eo < 0.12) {
      const happy = ex.closed === 'happy';
      for (let k = 0; k <= 10; k++) {
        const u = k / 10 - 0.5, yy = cy + (happy ? -(u * u) * 0.028 + 0.004 : (u * u) * 0.018 - 0.003);
        E(cx + u * 0.032, yy, 0.0026, 0.0024, 0, lash);
      }
      if (!happy) Cp(cx + sg * 0.016, cy + 0.001, cx + sg * 0.021, cy + 0.004, 0.0018, 0.001, lash);
      return;
    }
    const ry = 0.0118 * eo, rx = 0.0172;
    rast(cx - rx, cy - ry - 0.004, cx + rx, cy + ry, (lx, ly) => {
      const u = (lx - cx) / rx, v = (ly - cy) / ry;
      if (u * u + v * v > 1) return false;
      mat(EYEW, 0, 0, 1);
      const ix = cx + (ex.px || 0) * 0.0062, iy = cy + (ex.py || 0) * 0.004 - 0.0008, ir = 0.0098 * Math.min(1.08, 0.82 + 0.2 * eo);
      const di = Math.hypot(lx - ix, ly - iy);
      if (di < ir) {
        MAT.r = IRIS[0]; MAT.g = IRIS[1]; MAT.b = IRIS[2];
        if (ly < iy - ir * 0.2) { MAT.r *= 1.35; MAT.g *= 1.3; MAT.b *= 1.2; }
        if (di < 0.0049 * ps) { MAT.r = PUPIL[0]; MAT.g = PUPIL[1]; MAT.b = PUPIL[2]; }
      }
      if (Math.hypot(lx - ix + 0.0035, ly - iy - 0.0035) < 0.0024 || Math.hypot(lx - ix - 0.003, ly - iy + 0.003) < 0.0011) { MAT.r = 1; MAT.g = 1; MAT.b = 1; MAT.e = 0.6; }
      if (v > 0.5) { MAT.r *= 0.86; MAT.g *= 0.86; MAT.b *= 0.9; }
      return true;
    });
    for (let k = 0; k <= 12; k++) {
      const u = k / 12 * 2 - 1, yy = cy + ry * Math.sqrt(Math.max(0, 1 - u * u)) * 0.96 + 0.0008;
      E(cx + u * rx * 1.02, yy, 0.0023, 0.0021 + (u * sg > 0.4 ? 0.0006 : 0), 0, lash);
    }
    Cp(cx + sg * rx * 0.96, cy + ry * 0.25, cx + sg * (rx + 0.0055), cy + ry * 0.25 + 0.005, 0.0019, 0.001, lash);
    if (eo > 0.6) for (let k = 0; k <= 6; k++) { const u = k / 6 * 2 - 1; E(cx + u * rx * 0.8, cy + ry + 0.0058 * (1 - u * u * 0.4) + 0.0015, 0.0016, 0.001, 0, SKIN_D); }
  }
  function drawMouth(cx, cy, ex) {
    const mo = ex.mo || 0, sm = ex.sm || 0, mw = 0.016 * (ex.mw || 1);
    if (mo < 0.08) {
      for (let k = 0; k <= 10; k++) {
        const u = k / 10 * 2 - 1, yy = cy + sm * 0.006 * (u * u - 0.4);
        E(cx + u * mw, yy, 0.0026, 0.0019, 0, [0.58, 0.24, 0.22]);
      }
      E(cx, cy - 0.0065, mw * 0.5, 0.0032, 0, LIP, null, 0.5);
      return;
    }
    const rx = mw * (0.55 + 0.5 * Math.max(0, sm)), ry = 0.005 + 0.011 * mo;
    rast(cx - rx - 0.004, cy - ry - 0.004, cx + rx + 0.004, cy + ry + 0.004, (lx, ly) => {
      const u = (lx - cx) / rx, v = (ly - cy) / ry;
      const top = sm > 0 ? 0.25 + 0.3 * u * u * sm : 0;
      if (u * u + v * v > 1 || v > 1 - top) {
        if (u * u + v * v < 1.3 && v < 1.1 - top) { mat(LIP, 0, 0, 1); return true; }
        return false;
      }
      mat(MOUTH, 0, 0, 1);
      if (sm > 0.2 && v > 0.45 - top) { MAT.r = TEETH[0]; MAT.g = TEETH[1]; MAT.b = TEETH[2]; }
      if (v < -0.35) { MAT.r = TONGUE[0] * 0.8; MAT.g = TONGUE[1] * 0.75; MAT.b = TONGUE[2] * 0.75; }
      return true;
    });
  }

  /* ---------------------------------------------------------------- her, from behind (the hall shots) */
  const BACK = { hx: 0, hy: 0, s: 1 };
  function drawHerBack(X, Z, pose, t) {
    if (!spBegin(X, 0, Z, 3, pose.lean || 0, 1, false)) return;
    const sh = pose.sh || 0, wp = pose.walk, bob = pose.bob || 0, br = Math.sin(per(13, t)) * 0.004;
    // legs, socks, heels
    PT = 2;
    const hipY = 0.88 + bob, sw = pose.sway || 0;
    for (const sg of [-1, 1]) {
      const lift = wp === undefined ? 0 : Math.max(0, Math.sin(wp + (sg > 0 ? 0 : PI))) * 0.085;
      const fx = sg * 0.078 + sw * 0.3, fy = 0.0 + lift;
      Cp(sg * 0.075, hipY, fx, fy + 0.15, 0.072, 0.055, TROU, (lx, ly) => { const k = Math.sin(lx * 650) > 0.3 ? 0.94 : 1.03; MAT.r *= k; MAT.g *= k; MAT.b *= k; });
      Cp(fx, fy + 0.16, fx, fy + 0.04, 0.047, 0.044, SOCK_A, (lx, ly) => { if (fr((ly - fy) / 0.028) < 0.5) { MAT.r = SOCK_B[0]; MAT.g = SOCK_B[1]; MAT.b = SOCK_B[2]; } });
      E(fx, fy + 0.032, 0.046, 0.032 + lift * 0.15, 0, lift > 0.015 ? [0.82, 0.76, 0.66] : SOCK_A, (lx, ly) => { if (lift <= 0.015 && fr((ly - fy) / 0.028) < 0.5) { MAT.r = SOCK_B[0]; MAT.g = SOCK_B[1]; MAT.b = SOCK_B[2]; } });
    }
    // the cardigan from the back
    PT = 3;
    const sy = 1.40 + sh + br;
    grp(0, 0.9, sw * 0.6, 0, bob);
    RT(sw * 0.4, 0.78 + bob, sy, 0.245, 0.205, 0.08, CARD, (lx, ly) => {
      knit(lx, ly, 0.08, 1);
      if (ly < 0.84 + bob) { const rb = Math.sin(lx * 600) > 0 ? 0.88 : 1; MAT.r *= rb; MAT.g *= rb; MAT.b *= rb; }
    }, 0.75);
    nogrp();
    // arms: shoulder → elbow → hand, wide soft sleeves with ribbed cuffs
    const arm = (sg, hx, hy, ex_, ey_) => {
      PT = 4;
      Cp(sg * 0.19 + sw * 0.4, sy - 0.075, ex_, ey_, 0.056, 0.049, CARD, (lx, ly) => knit(lx * 0.5, ly, 0.05, 0.6));
      PT = 5;
      Cp(ex_, ey_, hx, hy + 0.03, 0.049, 0.044, CARD, (lx, ly, u) => { knit(lx * 0.5, ly, 0.05, 0.6); if (u > 0.78) { const rb = Math.sin(lx * 700 + ly * 600) > 0 ? 0.86 : 0.95; MAT.r *= rb; MAT.g *= rb; MAT.b *= rb; } });
      PT = 6;
      E(hx, hy - 0.012, 0.026, 0.032, 0, SKIN);
    };
    const swing = wp === undefined ? 0 : Math.sin(wp) * 0.03;
    if (pose.dog) arm(-1, -0.15, 1.2, -0.25, 1.16);
    else arm(-1, -0.245 - swing * 0.2, 0.93 + swing, -0.25, 1.14);
    let mugAt = null;
    if (pose.reach) arm(1, pose.reach[0], pose.reach[1], 0.27, 1.17);
    else if (pose.dog) arm(1, 0.12, 1.07, 0.26, 1.1);
    else if (pose.sip > 0) {
      const u = pose.sip;
      arm(1, lerp(0.24, 0.1, u), lerp(0.96, 1.46, u), lerp(0.25, 0.28, u), lerp(1.14, 1.28, u));
      mugAt = [lerp(0.27, 0.1, u), lerp(0.985, 1.5, u)];
    } else if (pose.mug) {
      const jx = pose.jolt || 0;
      arm(1, 0.245 + jx * 0.02, 0.965 + jx * 0.06, 0.255, 1.15);
      mugAt = [0.275 + jx * 0.02, 0.975 + jx * 0.06];
    } else arm(1, 0.245 + swing * 0.2, 0.93 - swing, 0.25, 1.14);
    if (mugAt && !(pose.sip > 0.6)) {
      PT = 7;
      const mx = mugAt[0], my = mugAt[1];
      E(mx + 0.05, my + 0.004, 0.017, 0.025, 0, MUG, (lx, ly, u, v, q) => q > 0.3);
      RT(mx + 0.008, my - 0.04, my + 0.048, 0.038, 0.041, 0.005, MUG, (lx, ly) => { if (ly > my - 0.004 && ly < my + 0.012) { MAT.r = MUGB[0]; MAT.g = MUGB[1]; MAT.b = MUGB[2]; } }, 0.9);
      E(mx + 0.008, my + 0.047, 0.035, 0.007, 0, [0.42, 0.24, 0.1]);
      E(mx - 0.008, my + 0.002, 0.016, 0.026, 0, SKIN);
      if (pose.slosh > 0) {
        const u = pose.slosh;
        for (let k = 0; k < 8; k++) {
          const vx = (ih(k, 1, 53) - 0.35) * 0.6, vy = 0.7 + ih(k, 2, 53) * 0.8, tt = u * 0.5;
          const dx = mx + vx * tt, dy = my + 0.05 + vy * tt - 4.9 * tt * tt;
          if (dy < my - 0.35) continue;
          E(dx, dy, 0.011 + ih(k, 3, 53) * 0.006, 0.014, 0, [0.55, 0.33, 0.13], () => { MAT.e = 0.15; });
        }
      } else for (let k = 0; k < 3; k++) {
        const u = fr(t / (D / 29) + k / 3), ax = mx + Math.sin(u * 7 + k * 2 + per(3, t)) * 0.012 + (k - 1) * 0.01, ay = my + 0.07 + u * 0.13;
        Soft(ax, ay, 0.013 + u * 0.01, 0.02 + u * 0.012, [1, 1, 1], 0.22 * Math.sin(u * PI), 0.3);
      }
    }
    // nape and collar
    PT = 8;
    Cp(0, sy - 0.02, 0, sy + 0.07, 0.033, 0.031, SKIN, () => { MAT.r *= 0.86; MAT.g *= 0.82; MAT.b *= 0.8; });
    E(0, sy + 0.002, 0.066, 0.018, 0, TOP);
    // the head from behind: hair gathered up into the bun, ears, glasses' arms
    const ht = pose.headTurn || 0;
    grp(0, sy + 0.05, (pose.tilt || 0), ht * 0.02, sh * 0.5 + br);
    PT = 9;
    E(0, 1.55, 0.097, 0.112, 0, HAIR, hairShade(0, 1.71, 4));
    for (let k = 0; k < 5; k++) Cp(-0.04 + k * 0.02, 1.45, -0.045 + k * 0.022 + Math.sin(k) * 0.006, 1.425 - (k & 1) * 0.01, 0.006, 0.0025, HAIR);
    PT = 10;
    for (const sg of [-1, 1]) E(sg * 0.093 - ht * 0.01, 1.52, 0.014, 0.022, 0, SKIN, (lx, ly, u, v, q) => { if (q < 0.3) { MAT.r *= 0.85; MAT.g *= 0.8; } });
    for (const sg of [-1, 1]) Cp(sg * 0.088 - ht * 0.01, 1.543, sg * 0.1, 1.53, 0.0025, 0.0025, TORT);
    PT = 11;
    E(0.004, 1.672, 0.064, 0.052, 0.1, HAIR, (lx, ly, u, v) => { const a = Math.atan2(v, u), r = Math.hypot(u, v); const k = 0.86 + 0.16 * Math.sin(a * 2 + r * 8) + 0.12 * MAT.ny; MAT.r *= k; MAT.g *= k; MAT.b *= k; });
    PT = 12;
    pencil(0.068, 1.722, -0.052, 1.693);
    toScreen(0, 1.55); BACK.hx = QX; BACK.hy = QY; BACK.s = SPR.s;
    nogrp();
    if (pose.dog) { PT = 20; drawDogHeld(-0.1, 1.42, 1.0, pose.dog, t, 3, true); }
    outline(0.4, 0.76);
  }

  /* ---------------------------------------------------------------- the neighbour (front), on the porch */
  function drawNeighbour(X, Z, pose, t) {
    if (!spBegin(X, 0, Z, 4, pose.lean || 0, 1, true)) return;
    const wet = (lx, ly) => {
      const st = tn(lx * 70, ly * 9 + t * 0.0, 54);
      if (st > 0.72) { MAT.r = Math.min(1, MAT.r * 1.18); MAT.g = Math.min(1, MAT.g * 1.18); MAT.b = Math.min(1, MAT.b * 1.3); MAT.e = 0.1; }
      if (st < 0.2) { MAT.r *= 0.9; MAT.g *= 0.88; MAT.b *= 0.85; }
    };
    const br = Math.sin(per(14, t)) * 0.004, bob = pose.bob || 0;
    // wellies and stockings
    PT = 2;
    for (const sg of [-1, 1]) {
      Cp(sg * 0.065, 0.5, sg * 0.068, 0.3, 0.032, 0.03, [0.32, 0.26, 0.28]);
      Cp(sg * 0.07, 0.3, sg * 0.072, 0.04, 0.05, 0.052, WELLY, (lx, ly) => { if (ly > 0.27) { MAT.r *= 0.8; MAT.g *= 0.8; MAT.b *= 0.8; } MAT.e = 0.05; });
      E(sg * 0.08, 0.035, 0.065, 0.035, 0, WELLY);
    }
    // the raincoat: an A-line in yellow, wet, with toggles
    PT = 3;
    const sy = 1.20 + br + bob;
    Pg([[-0.17, sy - 0.03], [-0.1, sy + 0.01], [0.1, sy + 0.01], [0.17, sy - 0.03], [0.28, 0.42], [0.14, 0.40], [0, 0.41], [-0.14, 0.40], [-0.28, 0.42]], YEL,
      (lx, ly) => { wet(lx, ly); if (Math.abs(lx) < 0.006) { MAT.r *= 0.75; MAT.g *= 0.72; MAT.b *= 0.7; } const fold = Math.sin(lx * 40 + ly * 4); if (fold > 0.85) { MAT.r *= 0.88; MAT.g *= 0.85; MAT.b *= 0.8; } },
      (lx, ly) => { const u = clamp(lx / (0.17 + (sy - ly) * 0.16), -1, 1); MAT.nx = u * 0.8; MAT.ny = 0.05; MAT.nz = Math.sqrt(1 - u * u * 0.64); });
    for (let k = 0; k < 4; k++) Cp(-0.012, sy - 0.14 - k * 0.15, 0.012, sy - 0.14 - k * 0.15, 0.007, 0.007, [0.42, 0.26, 0.14]);
    Pg([[-0.1, sy + 0.012], [0, sy - 0.06], [0.1, sy + 0.012], [0.07, sy + 0.04], [-0.07, sy + 0.04]], YEL_D);
    // arms
    PT = 4;
    const off = pose.offer || 0, wave = pose.wave;
    if (pose.dog) {
      Cp(-0.17, sy - 0.04, -0.2, 0.98 + off * 0.1, 0.045, 0.042, YEL, wet); Cp(-0.2, 0.98 + off * 0.1, 0.05, 1.0 + off * 0.12, 0.042, 0.038, YEL, wet);
      Cp(0.17, sy - 0.04, 0.2, 0.98 + off * 0.1, 0.045, 0.042, YEL, wet); Cp(0.2, 0.98 + off * 0.1, -0.02, 0.94 + off * 0.12, 0.042, 0.038, YEL, wet);
      E(0.06, 1.0 + off * 0.12, 0.025, 0.022, 0, NSKIN); E(-0.03, 0.94 + off * 0.12, 0.025, 0.022, 0, NSKIN);
    } else if (wave !== undefined) {
      const wr = s5(wave / 0.3), wa = Math.sin(wave * TAU * 2.2) * 0.35 * wr;
      const ex_ = lerp(-0.21, -0.27, wr), ey_ = lerp(0.98, sy + 0.02, wr);
      Cp(-0.17, sy - 0.04, ex_, ey_, 0.045, 0.042, YEL, wet);
      const hx = lerp(-0.21, -0.27 + Math.sin(wa) * 0.1, wr), hy = lerp(0.82, sy + 0.02 + Math.cos(wa) * 0.15, wr);
      Cp(ex_, ey_, hx, hy, 0.042, 0.038, YEL, wet);
      E(hx, hy + 0.03, 0.026, 0.03, wa, NSKIN);
      Cp(0.17, sy - 0.04, 0.21, 0.82, 0.045, 0.04, YEL, wet); E(0.21, 0.79, 0.025, 0.026, 0, NSKIN);
    } else {
      Cp(-0.17, sy - 0.04, -0.21, 0.82, 0.045, 0.04, YEL, wet); E(-0.21, 0.79, 0.025, 0.026, 0, NSKIN);
      Cp(0.17, sy - 0.04, 0.21, 0.82, 0.045, 0.04, YEL, wet); E(0.21, 0.79, 0.025, 0.026, 0, NSKIN);
    }
    // the head
    const tilt = pose.tilt || 0;
    grp(0, sy + 0.04, tilt, 0, br + bob);
    PT = 5;
    // white curls framing the face
    for (let k = 0; k < 9; k++) {
      const a = -0.55 + k / 8 * (PI + 1.1), cx = Math.cos(a) * 0.072, cy = 1.335 - Math.abs(Math.sin(a)) * 0.0 + Math.sin(a) * 0.03 - 0.01;
      if (Math.sin(a) > 0.5) continue;
      E(cx, cy, 0.022, 0.02, 0, WHITEH, (lx, ly, u, v) => { if (u * u + v * v > 0.55 && u > 0) { MAT.r *= 0.85; MAT.g *= 0.85; MAT.b *= 0.88; } });
    }
    PT = 6;
    E(0, 1.33, 0.068, 0.074, 0, NSKIN);
    for (const sg of [-1, 1]) Soft(sg * 0.04, 1.31, 0.02, 0.014, BLUSH, 0.7);
    E(0, 1.322, 0.012, 0.011, 0, [0.98, 0.7, 0.62], (lx, ly) => { if (Math.hypot(lx + 0.004, ly - 1.326) < 0.004) { MAT.r = 1; MAT.g = 0.92; MAT.b = 0.85; } });
    // her smile and happy eyes
    PT = 7;
    rast(-0.04, 1.27, 0.04, 1.31, (lx, ly) => {
      const u = lx / 0.028, v = (ly - 1.296) / 0.017;
      if (v > 0 || u * u + v * v > 1) { if (v > 0 && v < 0.25 && Math.abs(u) < 1.05) { mat(LIP, 0, 0, 1); return true; } return false; }
      mat(MOUTH, 0, 0, 1);
      if (v > -0.35) { MAT.r = TEETH[0]; MAT.g = TEETH[1]; MAT.b = TEETH[2]; }
      if (v < -0.75) { MAT.r = TONGUE[0] * 0.8; MAT.g = TONGUE[1] * 0.7; MAT.b = TONGUE[2] * 0.7; }
      return true;
    });
    for (const sg of [-1, 1]) {
      for (let k = 0; k <= 6; k++) { const u = k / 6 - 0.5; E(sg * 0.026 + u * 0.022, 1.345 - u * u * 0.03 + 0.004, 0.0028, 0.0025, 0, [0.25, 0.12, 0.1]); }
      Cp(sg * 0.042, 1.338, sg * 0.05, 1.333, 0.0012, 0.0012, SKIN_D); Cp(sg * 0.042, 1.346, sg * 0.05, 1.35, 0.0012, 0.0012, SKIN_D);
    }
    // round gold glasses, rain on the lenses
    PT = 8;
    for (const sg of [-1, 1]) {
      const cx = sg * 0.026, cy = 1.344;
      rast(cx - 0.025, cy - 0.025, cx + 0.025, cy + 0.025, (lx, ly) => {
        const r = Math.hypot(lx - cx, ly - cy);
        if (r > 0.0225) return false;
        if (r > 0.0195) { mat(GOLD, (lx - cx) / r * 0.5, (ly - cy) / r * 0.5, 0.7); MAT.e = 0.1; return true; }
        const drop = ih(fl((lx + 1) / 0.006), fl((ly + 1) / 0.006), 55) > 0.82;
        if (drop) { mat([0.85, 0.9, 1], 0, 0, 1); MAT.a = 0.55; MAT.e = 0.5; return true; }
        if (Math.abs((lx - cx) + (ly - cy) - 0.006) < 0.003) { mat([1, 1, 1], 0, 0, 1); MAT.a = 0.3; MAT.e = 0.5; return true; }
        return false;
      });
    }
    Cp(-0.004, 1.346, 0.004, 1.346, 0.0018, 0.0018, GOLD);
    // the sou'wester: crown and wide brim, stitched, glossy wet
    PT = 9;
    E(0, 1.445, 0.098, 0.078, 0, YEL, (lx, ly, u, v) => { wet(lx, ly); if (Math.abs(Math.hypot(u, v * 1.2) - 0.7) < 0.04) { MAT.r *= 0.82; MAT.g *= 0.8; MAT.b *= 0.75; } });
    PT = 10;
    rast(-0.2, 1.36, 0.2, 1.45, (lx, ly) => {
      const u = lx / 0.192, cy = 1.405 - u * u * 0.03, v = (ly - cy) / 0.03;
      if (u * u + v * v > 1) return false;
      mat(YEL, u * 0.5, v * 0.6, 0.6); wet(lx, ly);
      if (Math.abs(v + 0.35) < 0.12) { MAT.r *= 0.82; MAT.g *= 0.8; MAT.b *= 0.75; }
      if (v > 0.45) { MAT.r *= 1.06; MAT.g *= 1.06; MAT.b *= 1.1; MAT.e = 0.08; }
      return true;
    });
    nogrp();
    // drips from the brim
    for (let k = 0; k < 5; k++) {
      const P = D / (31 + k * 4), u = fr(t / P + k * 0.37), x = -0.17 + k * 0.085, y = 1.375 - (Math.abs(x) / 0.192) ** 2 * 0.03 - u * u * 0.9;
      if (y > 0.2) E(x, y, 0.004, 0.007, 0, [0.8, 0.86, 0.95], () => { MAT.e = 0.6; });
    }
    if (pose.dog) drawDogHeld(0.01 + (pose.dog.dx || 0), 1.05 + off * 0.14 + (pose.dog.dy || 0), 1.0, pose.dog, t, 4);
    outline(0.4, 0.78);
  }

  /* ---------------------------------------------------------------- the dog */
  // held against a chest, facing us; (cx, cy) its chest in the holder's local frame; k scale
  function drawDogHeld(cx, cy, k, dg, t, id, overShoulder, part) {
    const wagA = Math.sin(t * TAU * (dg.wagHz || 4.2)) * (dg.wag === undefined ? 1 : dg.wag);
    const muddy = dg.mud === undefined ? 1 : dg.mud;
    const ear = Math.sin(t * TAU * 2.1) * 0.15 * (dg.excite || 1);
    const dirt = (lx, ly) => {
      if (muddy <= 0) return;
      const low = clamp((cy - 0.02 - ly) / 0.08, 0, 1), m = tn(lx * 45 + 3, ly * 45, 56) * (0.4 + 0.8 * low) + low * 0.25;
      if (m > 0.78 - 0.18 * muddy) { MAT.r = MUD[0]; MAT.g = MUD[1]; MAT.b = MUD[2]; }
      else if (m > 0.7 - 0.1 * muddy) { MAT.r *= 0.82; MAT.g *= 0.72; MAT.b *= 0.62; }
      const sp = Math.sin(lx * 900 + ly * 300) > 0.92;
      if (sp) { MAT.r *= 0.85; MAT.g *= 0.85; MAT.b *= 0.85; }
    };
    const s = k;
    if (part === 'head') { /* body already drawn */ } else if (!overShoulder) {
      // the tail, wagging behind and above
      PT = 20;
      const ta = 0.9 + wagA * 0.55;
      Cp(cx + 0.09 * s, cy - 0.05 * s, cx + (0.09 + Math.cos(ta) * 0.1) * s, cy + (-0.05 + Math.sin(ta) * 0.1) * s, 0.02 * s, 0.01 * s, DOGW, (lx, ly, u) => { if (u > 0.7) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
      // body and front legs over the arm
      PT = 21;
      E(cx, cy - 0.06 * s, 0.11 * s, 0.085 * s, 0, DOGW, dirt);
      for (const sg of [-1, 1]) Cp(cx + sg * 0.045 * s, cy - 0.07 * s, cx + sg * 0.05 * s, cy - 0.15 * s, 0.022 * s, 0.02 * s, DOGW, (lx, ly) => { dirt(lx, ly); if (ly < cy - 0.12 * s) { MAT.r = MUD[0]; MAT.g = MUD[1]; MAT.b = MUD[2]; } });
    } else {
      // over her shoulder: the tail is by her other hip
      PT = 20;
      const ta = 1.2 + wagA * 0.6;
      Cp(0.2, 1.0, 0.2 + Math.cos(ta) * 0.11, 1.0 + Math.sin(ta) * 0.11, 0.02, 0.011, DOGW, (lx, ly, u) => { if (u > 0.7) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
      E(0.19, 0.99, 0.05, 0.045, 0, DOGW, dirt);
    }
    if (part === 'body') return;
    // the head, ears, face
    const hx = cx + (dg.hx || 0) * s, hy = cy + 0.05 * s + (dg.hy || 0) * s, ht = dg.tilt || 0;
    const sgx = SPR.gx, sgy = SPR.gy, sgc = SPR.gc, sgs = SPR.gs, stx = SPR.gtx, sty = SPR.gty;
    grp(hx, hy, ht, 0, 0);
    PT = 22;
    for (const sg of [-1, 1]) {
      const ea = sg * (0.5 + ear * sg) ;
      Pg([[hx + sg * 0.04 * s, hy + 0.06 * s], [hx + sg * 0.085 * s, hy + 0.065 * s], [hx + sg * (0.095 + ear * 0.05) * s, hy + (0.0 + ear * 0.03) * s]], DOGT, (lx, ly) => { if (Math.abs(lx - hx) > 0.08 * s) { MAT.r *= 0.75; MAT.g *= 0.7; MAT.b *= 0.7; } });
      void ea;
    }
    PT = 23;
    rast(hx - 0.09 * s, hy - 0.08 * s, hx + 0.09 * s, hy + 0.09 * s, (lx, ly) => {
      const u = (lx - hx) / (0.074 * s), v = (ly - hy) / (0.068 * s);
      const spike = 1 + 0.06 * Math.sin(Math.atan2(v, u) * 13) * (v > 0.3 ? 1 : 0);
      if (u * u + v * v > spike * spike) return false;
      const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v)), nl = Math.hypot(u, v, nz) || 1;
      mat(DOGW, u / nl, v / nl, nz / nl);
      // a tan patch over one eye, wet dark tips
      if (((u + 0.42) / 0.42) ** 2 + ((v - 0.25) / 0.4) ** 2 < 1) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; }
      if (v < -0.5) dirt(lx, ly);
      return true;
    });
    // muzzle, nose, mouth, tongue
    PT = 24;
    E(hx, hy - 0.035 * s, 0.042 * s, 0.03 * s, 0, [0.99, 0.97, 0.93]);
    E(hx, hy - 0.02 * s, 0.015 * s, 0.011 * s, 0, NOSE, (lx, ly) => { if (Math.hypot(lx - hx + 0.004 * s, ly - hy + 0.016 * s) < 0.004 * s) { MAT.r = 0.7; MAT.g = 0.7; MAT.b = 0.75; MAT.e = 0.4; } });
    const pant = 0.5 + 0.5 * Math.sin(t * TAU * 3.1);
    const tl = (dg.tongue === undefined ? 1 : dg.tongue) * (0.7 + 0.3 * pant);
    if (tl > 0.05) {
      E(hx, hy - 0.052 * s, 0.022 * s, 0.01 * s, 0, MOUTH);
      Cp(hx + 0.003 * s, hy - 0.055 * s, hx + (0.006 + (dg.lick || 0) * 0.04) * s, hy - (0.06 + 0.035 * tl) * s + (dg.lick || 0) * 0.05 * s, 0.012 * s, 0.014 * s, TONGUE, (lx, ly, u, k2) => { if (Math.abs(k2) < 0.2) { MAT.r *= 0.85; MAT.g *= 0.8; MAT.b *= 0.8; } });
    } else Cp(hx - 0.018 * s, hy - 0.05 * s, hx + 0.018 * s, hy - 0.05 * s, 0.003 * s, 0.003 * s, [0.3, 0.2, 0.2]);
    // eyes, bright
    PT = 25;
    const eo = dg.eyes === undefined ? 1 : dg.eyes;
    for (const sg of [-1, 1]) {
      if (eo < 0.3) { Cp(hx + sg * 0.038 * s, hy + 0.012 * s, hx + sg * 0.018 * s, hy + 0.015 * s, 0.004 * s, 0.004 * s, NOSE); continue; }
      E(hx + sg * 0.028 * s, hy + 0.012 * s, 0.011 * s, 0.012 * s * eo, 0, NOSE, (lx, ly) => { if (Math.hypot(lx - hx - sg * 0.028 * s + 0.004 * s, ly - hy - 0.017 * s) < 0.004 * s) { MAT.r = 1; MAT.g = 1; MAT.b = 1; MAT.e = 0.7; } });
      E(hx + sg * 0.03 * s, hy + 0.033 * s, 0.007 * s, 0.004 * s, sg * 0.3, [0.85, 0.62, 0.35]);
    }
    // the red collar and its tag
    PT = 26;
    rast(hx - 0.07 * s, hy - 0.1 * s, hx + 0.07 * s, hy - 0.06 * s, (lx, ly) => {
      const u = (lx - hx) / (0.062 * s), yc = hy - 0.075 * s + u * u * 0.012 * s;
      if (Math.abs(u) > 1 || Math.abs(ly - yc) > 0.009 * s) return false;
      mat(COLLAR, 0, (ly - yc) / (0.009 * s) * 0.5, 0.85); return true;
    });
    E(hx, hy - 0.093 * s, 0.01 * s, 0.012 * s, 0, GOLD, () => { MAT.e = 0.15; });
    SPR.gx = sgx; SPR.gy = sgy; SPR.gc = sgc; SPR.gs = sgs; SPR.gtx = stx; SPR.gty = sty;
    PT = 27;
    void id;
  }
  // the dog alone in the hall: curled in its bed, getting up, trotting to the flap (side view), going out (rear view)
  function drawDogSolo(X, Z, st, t) {
    if (!spBegin(X, 0, Z, 5, 0, st.face || 1, false)) return;
    if (st.clip) SPR.clip = st.clip;
    if (st.mode === 'curl') {
      const brt = 1 + Math.sin(per(17, t)) * 0.04;
      PT = 2;
      E(0, 0.085, 0.16, 0.075 * brt, 0, DOGW, (lx, ly) => { if (tn(lx * 40, ly * 40, 57) > 0.75) { MAT.r *= 0.9; MAT.g *= 0.85; MAT.b *= 0.8; } });
      E(-0.11, 0.075, 0.055, 0.03, 0.2, DOGW);
      Cp(0.13, 0.06, -0.02, 0.025, 0.022, 0.014, DOGW, (lx, ly, u) => { if (u > 0.75) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
      PT = 3;
      E(-0.12, 0.13, 0.062, 0.05, -0.2, DOGW, (lx, ly) => { if (lx < -0.13) { } });
      E(-0.10, 0.155, 0.035, 0.03, 0.4, DOGT);
      Pg([[-0.15, 0.17], [-0.09, 0.18], [-0.11, 0.12]], DOGT);
      E(-0.175, 0.115, 0.022, 0.018, 0, [0.99, 0.97, 0.93]);
      E(-0.195, 0.12, 0.008, 0.007, 0, NOSE);
      Cp(-0.15, 0.14, -0.12, 0.138, 0.004, 0.004, NOSE);
      outline(0.45, 0.8);
      return;
    }
    if (st.mode === 'rear') {
      const wag = Math.sin(t * TAU * 5) * 0.6;
      PT = 2;
      for (const sg of [-1, 1]) Cp(sg * 0.05, 0.14, sg * 0.055, 0.02, 0.025, 0.022, DOGW, (lx, ly) => { if (ly < 0.05) { MAT.r = MUD[0] * 1.4; MAT.g = MUD[1] * 1.4; MAT.b = MUD[2] * 1.4; } });
      E(0, 0.17, 0.085, 0.075, 0, DOGW);
      Cp(0, 0.2, Math.sin(wag) * 0.09, 0.2 + Math.cos(wag) * 0.09, 0.02, 0.011, DOGW, (lx, ly, u) => { if (u > 0.7) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
      for (const sg of [-1, 1]) Pg([[sg * 0.03, 0.27], [sg * 0.08, 0.27], [sg * 0.07, 0.22]], DOGT);
      outline(0.45, 0.8);
      return;
    }
    // side view, trotting; local +x is the way it faces
    const ph_ = st.phase || 0;
    PT = 2;
    const leg = (x0, a) => Cp(x0, 0.13, x0 + Math.sin(a) * 0.04, 0.02 + Math.max(0, Math.cos(a)) * 0.02, 0.02, 0.017, DOGW, (lx, ly) => { if (ly < 0.05) { MAT.r *= 0.85; MAT.g *= 0.85; MAT.b *= 0.85; } });
    leg(-0.08, ph_ + PI); leg(0.08, ph_);
    const wag = Math.sin(t * TAU * 4.5) * 0.5;
    Cp(-0.12, 0.17, -0.12 - Math.cos(0.9 + wag) * 0.08, 0.17 + Math.sin(0.9 + wag) * 0.09, 0.02, 0.011, DOGW, (lx, ly, u) => { if (u > 0.7) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
    PT = 3;
    E(0, 0.16, 0.13, 0.06, 0, DOGW, (lx, ly) => { if (((lx + 0.04) / 0.05) ** 2 + ((ly - 0.19) / 0.03) ** 2 < 1) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
    PT = 4;
    leg(-0.06, ph_); leg(0.1, ph_ + PI);
    PT = 5;
    const hb = Math.sin(ph_ * 2) * 0.006;
    E(0.14, 0.23 + hb, 0.055, 0.05, 0, DOGW, (lx, ly) => { if (lx < 0.15 && ly > 0.23 + hb) { MAT.r = DOGT[0]; MAT.g = DOGT[1]; MAT.b = DOGT[2]; } });
    E(0.19, 0.215 + hb, 0.035, 0.025, -0.2, [0.99, 0.97, 0.93]);
    E(0.225, 0.222 + hb, 0.01, 0.009, 0, NOSE);
    E(0.155, 0.242 + hb, 0.007, 0.008, 0, NOSE);
    Pg([[0.11, 0.28 + hb], [0.15, 0.275 + hb], [0.12, 0.235 + hb]], DOGT);
    Cp(0.1, 0.2, 0.12, 0.17, 0.008, 0.008, COLLAR);
    outline(0.45, 0.8);
  }

  /* ================================================================ the story, frame by frame */
  // the shape behind the glass (reality): a short round neighbour with a dog in her arms
  function silParams(t) {
    const g = { a: 1, x: -0.13, y0: 0, k: 1, hx: 0, blur: 0.034, arm: 0, knock: 0, dog: 1, dogY: 0, dogHx: 0, dogHy: 0, paw: 0, p1: 1.2, p2: 1.2 };
    g.x += Math.sin(per(7, t)) * 0.012; g.hx = Math.sin(per(5, t) + 1) * 0.015;
    if (t >= T.open0 - 0.02 && t < T.close1) {
      // while the door swings shut she is already there behind its glass, fading in with the closing
      g.a = t > T.close0 ? s5(ph(t, T.close0 + 0.25, T.close1)) : 0; g.dog = 0; g.arm = 0; return g;
    }
    if (t >= T.close1 && t < T.arrive0) {
      // she goes back down the path, waddling
      const u = ph(t, T.close1, T.leave1);
      g.x = -0.13 - s5(u) * 0.75; g.k = 1 - u * 0.3; g.blur = lerp(0.034, 0.09, u); g.dog = 0; g.y0 = Math.abs(Math.sin(u * 14)) * 0.012;
      g.a = 1 - s5(ph(t, T.leave1 - 0.6, T.leave1));
      return g;
    }
    if (t >= T.arrive0) {
      // and comes back up it, the dog in her arms again: the next knock
      const u = s5(ph(t, T.arrive0, T.arrive1));
      g.x = lerp(0.45, -0.13, u); g.k = lerp(0.65, 1, u); g.blur = lerp(0.1, 0.034, u); g.a = sstep(0, 0.35, u);
      g.y0 = Math.abs(Math.sin(u * 12)) * 0.01 * (1 - u);
      const pk = s5(ph(t, T.pick, T.pick + 0.3));
      g.dog = pk > 0.02 ? 1 : 0; g.dogY = -(1 - pk) * 0.45;
    }
    // her arm comes up to knock at the end of the loop, holds through the first knocks, and again at 4.3
    g.arm = Math.max(t > 38.55 ? s5(ph(t, 38.55, 38.9)) : 0, t < 1.4 ? 1 - s5(ph(t, 1.0, 1.4)) : 0, env(t, 3.95, 4.2, 4.85, 5.2));
    g.knock = knockEnv(t);
    // the dog scrabbles at the glass: the scratching
    let pw = 0;
    for (const [a, b] of T.scratch) pw = Math.max(pw, env(t, a - 0.15, a + 0.05, b - 0.05, b + 0.2));
    g.paw = pw;
    if (pw > 0) {
      g.dogHy = 0.03 * pw; g.dogHx = 0.02 * pw;
      g.p1 = 1.26 + 0.1 * pw + Math.sin(t * TAU * 3.4) * 0.05 * pw; g.p2 = 1.26 + 0.1 * pw + Math.sin(t * TAU * 3.4 + PI) * 0.05 * pw;
    }
    return g;
  }
  // her expression in the reverse shots
  function exprAt(t) {
    const e = { eo: 1, px: 0, py: 0, ps: 1, bl: 0, ba: 0, mo: 0, sm: 0, mw: 1, bs: 0, tilt: 0, hy: 0, hx: 0, sh: 0, glare: 0.5, closed: null };
    const trem = (a) => { e.hx += Math.sin(per(83, t)) * a; e.hy += Math.sin(per(71, t) + 1) * a * 0.6; };
    if (t < T.s3) {
      // startled, frozen; eyes dart to the door and back; a swallow
      e.eo = 1.38; e.ps = 0.68; e.bl = 1.0; e.ba = 0.6; e.mo = 0.28; e.mw = 0.6; e.sh = 0.03;
      const d = t - T.dart;
      e.px = d < 0 ? 0 : d < 0.12 ? -0.9 * (d / 0.12) : d < 0.45 ? -0.9 : d < 0.55 ? lerp(-0.9, 0.5, (d - 0.45) / 0.1) : d < 0.8 ? 0.5 : lerp(0.5, 0, ph(d, 0.8, 0.95));
      e.hy = -0.004 * env(t, 2.25, 2.35, 2.4, 2.55);
      trem(0.0008);
    } else if (t < T.s5) {
      // fear sinking in: worried brows, small pupils, breath that fogs
      e.eo = 1.22; e.ps = 0.58; e.bl = 0.8; e.ba = 1.1; e.sh = 0.035;
      e.mo = 0.12 + 0.3 * Math.max(env(t, 5.6, 5.75, 5.95, 6.2), env(t, 6.35, 6.5, 6.7, 6.95));
      e.mw = 0.7; e.px = 0.15 * Math.sin(t * 2.3); e.glare = 0.8;
      trem(0.0012);
    } else if (t < T.s11) {
      // the decision: wide eyes, shut tight, a breath in, a breath out, open: determined
      e.sh = 0.03;
      if (t < T.eyesShut) { e.eo = 1.3; e.ps = 0.55; e.bl = 0.9; e.ba = 1.2; e.mo = 0.2; e.mw = 0.6; trem(0.0015); }
      else if (t < T.eyesOpen) {
        e.closed = 'shut'; e.bl = -0.5; e.ba = 1.3; e.mo = 0; e.sm = -0.4;
        e.sh = 0.03 + 0.025 * env(t, T.breathIn, T.breathOut - 0.05, T.breathOut, T.eyesOpen);
        e.mo = 0.35 * env(t, T.breathOut, T.breathOut + 0.12, T.eyesOpen - 0.2, T.eyesOpen);
        e.mw = 0.55;
        trem(0.0008 * (1 - ph(t, T.breathIn, T.eyesOpen)));
      } else {
        const u = ph(t, T.eyesOpen, T.eyesOpen + 0.25);
        e.eo = lerp(0.3, 1.0, s5(u)); e.ps = 1.0; e.bl = -0.25; e.ba = -0.35; e.sm = 0.18; e.sh = lerp(0.03, 0.0, ph(t, T.eyesOpen, T.s10));
        e.hy = -0.008 * env(t, 19.7, 19.8, 19.85, 20.0);
        e.glare = 0.3;
      }
    } else {
      // laughing with the dog in her arms
      const lk = lickAt(t);
      e.closed = (lk > 0.3 || env(t, 27.2, 27.4, 28.2, 28.4) > 0.5) ? 'happy' : null;
      e.eo = 0.85; e.sm = 1; e.mo = 0.45 + 0.35 * Math.abs(Math.sin(t * TAU * 2.6)) * env(t, 26.7, 27.0, 28.6, 29.0); e.mw = 1.25;
      e.bs = 0.5; e.tilt = -0.08 - 0.05 * lk; e.bl = 0.35; e.hx = -0.004 * lk; e.glare = 0.4;
      e.hy = 0.004 * Math.sin(t * TAU * 2.6) * env(t, 26.7, 27.0, 28.6, 29.0);
    }
    return e;
  }
  function lickAt(t) { let l = 0; for (const k of T.licks) { const d = t - k; if (d > -0.12 && d < 0.3) l = Math.max(l, d < 0 ? 1 + d / 0.12 : 1 - d / 0.3); } return clamp(l, 0, 1); }
  function walkPhase(t) {
    const st = T.steps;
    if (t < st[0] - 0.4) return undefined;
    if (t > st[st.length - 1] + 0.3) return undefined;
    // one half-cycle per step
    let k = 0; while (k + 1 < st.length && t >= st[k + 1]) k++;
    const a = st[k], b = k + 1 < st.length ? st[k + 1] : a + 0.45;
    return PI * (k + clamp((t - a) / (b - a), 0, 1)) + PI * 0.5;
  }

  /* ---------------------------------------------------------------- compose the pixel frame */
  const SHOT_R = new Set([1, 3, 8]);
  function drawScene(t) {
    const s = shotAt(t);
    setLights(t);
    GN = silParams(t);
    stage('room', drawRoom, t);
    stage('props', drawProps, t);
    stage('rain', drawRain, t);
    const tc = PROF ? performance.now() : 0;
    drawChars(t, s);
    if (PROF) PROF.chars = (PROF.chars || 0) + performance.now() - tc;
  }
  function drawChars(t, s) {
    if (SHOT_R.has(s)) {
      // the reverse shots: her face
      const e = exprAt(t);
      const pose = { mug: s !== 8 || t < T.mugDown, mugY: 0, mugX: 0 };
      if (s === 8) pose.mugY = -0.25 * s5(ph(t, T.mugDown - 0.25, T.mugDown + 0.15));
      drawHerFront(HER.x, HER.z, e, pose, t);
    } else if (s === 11) {
      // from the porch: her in the doorway with the dog, the warm hall behind her
      const e = exprAt(t), lk = lickAt(t);
      drawHerFront(0.12, 3.85, e, { dog: { dx: 0.115, dy: 0.04, hx: -0.035 * lk, hy: 0.01 * lk, tilt: 0.3 + 0.2 * lk, lick: lk, wag: 1, excite: 1.3, mud: 1 }, mug: false }, t);
    } else {
      // the hall shots
      // the dog, at home, in the end
      if (t >= T.s14) {
        if (t < T.dogUp) drawDogSolo(0.37, 3.98, { mode: 'curl' }, t);
        else if (t < T.flapIn - 0.2) {
          const u = ph(t, T.dogUp + 0.25, T.flapIn - 0.25);
          const x = lerp(0.37, -0.12, s5(u)), z = lerp(3.92, 4.22, s5(u));
          drawDogSolo(x, z, { mode: 'trot', face: -1, phase: u * 22 }, t);
        } else if (t < T.flapOut) {
          const u = ph(t, T.flapIn - 0.2, T.flapOut), sc = 1 - s5(u);
          drawDogSolo(-0.11, 4.28 + u * 0.08, { mode: 'rear', clip: (lx, ly) => ly < FPY1 - 0.01 && ly > (1 - sc) * 0.25 }, t);
        }
      }
      // her
      let X = HER.x, Z = HER.z, pose = { mug: true };
      if (t < T.s10) {
        pose.sh = 0.04 * s5(ph(t, T.flinch, T.flinch + 0.1)) * (1 - 0.35 * ph(t, 1.0, 4.0));
        pose.jolt = t >= T.flinch ? Math.exp(-(t - T.flinch) / 0.15) * Math.sin((t - T.flinch) * 30) : 0;
        pose.slosh = t >= T.flinch && t < T.flinch + 0.62 ? (t - T.flinch) / 0.62 : 0;
        pose.headTurn = 0;
      } else if (t < T.grip - 0.05) {
        X = walkX(t); Z = walkZ(t); pose.mug = false;
        const wp = walkPhase(t); pose.walk = wp;
        if (wp !== undefined) { pose.bob = Math.abs(Math.sin(wp)) * 0.018; pose.sway = Math.cos(wp) * 0.012; }
        if (t > 21.8) pose.reach = reachAt(t, X, Z);
      } else if (t < T.s14) {
        pose.mug = false;
        if (s === 12) { X = 0.30; Z = 3.62; }
        else {
          // she pulls the door open stepping back, then steps up again to take the dog
          const bk = s5(ph(t, 23.0, 23.75));
          X = lerp(ATDOOR.x, 0.31, bk); Z = lerp(ATDOOR.z, 3.56, bk);
          if (t > 23.0 && t < 23.75) pose.walk = PI * (t - 23.0) / 0.375 + PI * 0.5;
        }
        if (t < 23.15) pose.reach = reachAt(t, X, Z);
        else if (t < 23.45) { const u = s5(ph(t, 23.15, 23.45)), r = reachAt(23.15, X, Z); pose.reach = [lerp(r[0], 0.25, u), lerp(r[1], 0.94, u)]; }
        if (s === 12) pose.dog = { wag: 1, excite: 1.2, mud: 1, hx: 0, hy: 0, tilt: Math.sin(t * 3) * 0.15 };
        pose.sh = 0.01 * Math.sin(t * TAU * 2.6) * env(t, 23.9, 24.1, 26.0, 26.4);
      } else {
        const sp = env(t, T.sips[0][0], T.sips[0][0] + 0.6, T.sips[0][1] - 0.7, T.sips[0][1]);
        pose.sip = sp;
      }
      drawHerBack(X, Z, pose, t);
      // the neighbour, when the door is open
      if (doorAngle(t) > 0.02) {
        const np = { dog: t < T.take1 ? { wag: 1, excite: 1.3, mud: 1, hx: Math.sin(t * 2.5) * 0.01, tilt: Math.sin(t * 2.1) * 0.12 } : null };
        np.offer = s5(ph(t, T.offer0, T.take0)) * (1 - s5(ph(t, T.take1, T.take1 + 0.5)));
        if (np.dog) { const u = s5(ph(t, T.take0, T.take1)); np.dog.dy = -0.02 * np.offer + 0.06 * u; np.dog.dx = 0.55 * u; }
        if (t > T.wave0 && t < T.close1) np.wave = t - T.wave0;
        np.tilt = Math.sin(t * TAU * 1.3) * 0.04 * env(t, 23.6, 24.0, 29.0, 30.0);
        np.bob = Math.abs(Math.sin(t * TAU * 1.3)) * 0.006 * env(t, 23.6, 24.0, 29.0, 30.0);
        drawNeighbour(-0.13 + 0.08 * np.offer, ZD + 0.42 - 0.12 * np.offer, np, t);
      }
    }
  }
  // her right hand on the door handle: the handle's screen position, brought back into her own frame
  function reachAt(t, X, Z) {
    const th = doorAngle(t), s = HDS - 0.06;
    const hx = DX0 + Math.cos(th) * s, hz = ZD - Math.sin(th) * s;
    const zc = proj(hx, HDY + 0.01, hz);
    const hsx = PX, hsy = PY;
    proj(X, 0, Z);
    const k = CAM.f / Math.max(0.05, PZ);
    let lx = (hsx - PX) / k, ly = -(hsy - PY) / k;
    // reach out from the side as the walk ends
    const u = s5(ph(t, 21.8, T.grip));
    void zc;
    return [lerp(0.24, lx, u), lerp(0.95, ly, u)];
  }

  /* ================================================================ IMAGINATION: ink and charcoal at 1080 × 1350 */
  let IC = null, ig = null, PATC = null, PATG = null, BF = 0, INKAMP = 1;
  const INK = 'rgba(16,13,20,', GREY = 'rgba(64,60,72,', CHALK = 'rgba(214,214,222,', PURP = 'rgba(92,52,112,', ACID = 'rgba(170,204,58,', ORNG = 'rgba(178,86,40,';
  function P3(X, Y, Z) { const z = proj(X, Y, Z); return [PX * SC, PY * SC, z]; }
  const bj = (seed, k, ch) => hs(seed, k, BF * 5 + ch);
  function buildInk() {
    if (typeof document === 'undefined') return;
    IC = document.createElement('canvas'); IC.width = BW; IC.height = BH;
    ig = IC.getContext('2d');
    // a charcoal grain: dark, porous, with a diagonal drag
    const mk = (n, f) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); const im = g.createImageData(n, n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = f(x, y); const k = (y * n + x) * 4; im.data[k] = v[0]; im.data[k + 1] = v[1]; im.data[k + 2] = v[2]; im.data[k + 3] = v[3]; } g.putImageData(im, 0, 0); return c; };
    const cc = mk(256, (x, y) => {
      const a = fbmP(x, y, 256, 8, 3), b = fbmP(x + y * 0.6, y - x * 0.25, 256, 32, 2), r = ih(x, y, 501);
      const v = clamp(0.62 + (a - 0.5) * 0.9 + (b - 0.5) * 0.5 + (r - 0.5) * 0.55, 0, 1);
      return [14, 12, 18, Math.round(255 * v)];
    });
    PATC = ig.createPattern(cc, 'repeat');
    const cg = mk(256, (x, y) => {
      const a = fbmP(x, y, 256, 16, 3), r = ih(x, y, 502);
      const v = clamp(0.5 + (a - 0.5) * 1.2 + (r - 0.5) * 0.4, 0, 1);
      return [58, 54, 66, Math.round(255 * v)];
    });
    PATG = ig.createPattern(cg, 'repeat');
  }
  // periodic fbm for tileable textures
  function fbmP(x, y, n, cell, oct) {
    let a = 0, amp = 0.5, s = 0, c = cell;
    for (let o = 0; o < oct; o++) {
      const P = n / c, fx = x / c, fy = y / c, xi = fl(fx), yi = fl(fy), u = fx - xi, v = fy - yi;
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const h = (i, j) => ih(mod(i, P), mod(j, P), 600 + o);
      a += amp * lerp(lerp(h(xi, yi), h(xi + 1, yi), su), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), su), sv);
      s += amp; amp *= 0.5; c /= 2;
    }
    return a / s;
  }
  function crSpline(P, sub) {
    const out = [], n = P.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let s = 0; s < sub; s++) {
        const u = s / sub, u2 = u * u, u3 = u2 * u;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]);
      }
    }
    out.push(P[n - 1]);
    return out;
  }
  // a boiling, tapered, dry-edged brush stroke through the points
  function stroke(pts, w, o) {
    o = o || {};
    const seed = o.seed || 0, amp = (o.amp === undefined ? 2.4 : o.amp) * INKAMP, a = o.a === undefined ? 0.92 : o.a;
    if (a <= 0.01 || pts.length < 2 || w <= 0.2) return;
    const B = [];
    for (let k = 0; k < pts.length; k++) B.push([pts[k][0] + amp * bj(seed, k, 1), pts[k][1] + amp * bj(seed, k, 2)]);
    const S = crSpline(B, o.sub || 3), m = S.length;
    const tin = o.tin === undefined ? 0.12 : o.tin, tout = o.tout === undefined ? 0.4 : o.tout;
    const L = [], R = [];
    for (let i = 0; i < m; i++) {
      const p = S[i], q = S[Math.min(m - 1, i + 1)], r0 = S[Math.max(0, i - 1)];
      let tx = q[0] - r0[0], ty = q[1] - r0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const u = i / (m - 1);
      const tp = Math.min(1, tin > 0 ? u / tin : 1, tout > 0 ? (1 - u) / tout : 1);
      const pr = 0.65 + 0.7 * vn1(i * 0.33 + seed * 3.1, (BF + seed) | 0);
      const ww = w * 0.5 * Math.pow(Math.max(0.02, tp), 0.7) * pr;
      L.push([p[0] - ty * ww, p[1] + tx * ww]); R.push([p[0] + ty * ww, p[1] - tx * ww]);
    }
    const col = o.col || INK;
    ig.fillStyle = col + a + ')';
    ig.beginPath(); ig.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < m; i++) ig.lineTo(L[i][0], L[i][1]);
    for (let i = m - 1; i >= 0; i--) ig.lineTo(R[i][0], R[i][1]);
    ig.closePath(); ig.fill();
    if (o.dry !== 0 && w > 2.5) {
      ig.strokeStyle = col + (a * 0.55) + ')'; ig.lineWidth = Math.max(0.9, w * 0.11);
      ig.beginPath();
      for (const side of [-1, 1]) {
        let pen = false;
        for (let i = 0; i < m; i++) {
          const on = vn1(i * 0.45 + side * 7.3 + seed, (BF * 3 + seed) | 0) > 0.42;
          const p = side < 0 ? L[i] : R[i], c = S[i];
          const x = c[0] + (p[0] - c[0]) * 1.55, y = c[1] + (p[1] - c[1]) * 1.55;
          if (on) { if (!pen) { ig.moveTo(x, y); pen = true; } else ig.lineTo(x, y); } else pen = false;
        }
      }
      ig.stroke();
    }
    if (o.splat) splat(S[m - 1][0], S[m - 1][1], w * 2.2 + 6, o.splat, seed, a, col);
  }
  function splat(x, y, r, n, seed, a, col) {
    ig.fillStyle = (col || INK) + (a * 0.85) + ')';
    ig.beginPath();
    for (let k = 0; k < n; k++) {
      const an = ih(seed, k, 801) * TAU, d = r * Math.pow(ih(seed, k, 802), 0.6), rr = 0.8 + 3.2 * Math.pow(ih(seed, k, 803), 3);
      const jx = bj(seed, k, 9) * 0.8, jy = bj(seed, k, 10) * 0.8;
      ig.moveTo(x + Math.cos(an) * d + rr + jx, y + Math.sin(an) * d + jy);
      ig.arc(x + Math.cos(an) * d + jx, y + Math.sin(an) * d + jy, rr, 0, TAU);
    }
    ig.fill();
  }
  // parallel strokes over a region (clipped), broken and jittered; one path, one stroke call
  function hatch(poly, ang, gap, lw, a, seed, col) {
    if (a <= 0.01 || poly.length < 3) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    x0 = Math.max(x0, -50); y0 = Math.max(y0, -50); x1 = Math.min(x1, BW + 50); y1 = Math.min(y1, BH + 50);
    if (x0 >= x1 || y0 >= y1) return;
    ig.save();
    ig.beginPath(); ig.moveTo(poly[0][0], poly[0][1]); for (let k = 1; k < poly.length; k++) ig.lineTo(poly[k][0], poly[k][1]); ig.closePath(); ig.clip();
    const ca = Math.cos(ang), sa = Math.sin(ang), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 10;
    ig.strokeStyle = (col || INK) + a + ')'; ig.lineWidth = lw; ig.lineCap = 'round';
    ig.beginPath();
    let k = 0;
    for (let d = -R; d <= R; d += gap, k++) {
      const jx = bj(seed, k, 3) * gap * 0.25, jy = bj(seed, k, 4) * 2;
      const px = cx - sa * (d + jx), py = cy + ca * (d + jx);
      let s = -R + ih(seed, k, 5) * 20;
      while (s < R) {
        const len = 30 + ih(seed, k * 7 + fl(s), 6) * 90;
        const e = Math.min(R, s + len);
        ig.moveTo(px + ca * s + jy, py + sa * s + bj(seed, k, 7) * 1.5);
        ig.lineTo(px + ca * e + bj(seed, k, 8) * 2, py + sa * e + jy);
        s = e + 4 + ih(seed, k * 3 + fl(s), 9) * 14;
      }
    }
    ig.stroke();
    ig.restore();
  }
  function smear(poly, a, pat, evenOdd) {
    if (a <= 0.01) return;
    ig.save();
    ig.globalAlpha = a;
    const p = pat || PATC;
    p.setTransform(new DOMMatrix().translate(bj(3, 1, 1) * 12, bj(3, 2, 2) * 12));
    ig.fillStyle = p;
    ig.beginPath();
    for (const ring of (Array.isArray(poly[0][0]) ? poly : [poly])) { ig.moveTo(ring[0][0], ring[0][1]); for (let k = 1; k < ring.length; k++) ig.lineTo(ring[k][0], ring[k][1]); ig.closePath(); }
    ig.fill(evenOdd ? 'evenodd' : 'nonzero');
    ig.restore();
  }
  function blob(x, y, r, col, a) {
    if (a <= 0.005) return;
    const g = ig.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col + a + ')'); g.addColorStop(1, col + '0)');
    ig.fillStyle = g; ig.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // a wobbly closed outline around a centre (polar), in screen px
  function ring(cx, cy, rx, ry, n, wob, seed, ph0) {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + (ph0 || 0), w = 1 + wob * (vn1(k * 0.9 + seed, 7) - 0.5) * 2 + wob * 0.35 * bj(seed, k, 11);
      pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
    }
    return pts;
  }
  // an eye that should not be there: acid green, slit pupil
  function inkEye(x, y, r, open, seed, look) {
    if (open <= 0.02 || r < 1) return;
    blob(x, y, r * 3.2, ACID, 0.16 * open);
    const h = r * 0.55 * open;
    ig.fillStyle = 'rgba(232,240,170,' + (0.9 * open) + ')';
    ig.beginPath(); ig.moveTo(x - r, y);
    ig.quadraticCurveTo(x, y - h * 2, x + r, y); ig.quadraticCurveTo(x, y + h * 2, x - r, y); ig.fill();
    ig.fillStyle = ACID + (0.95 * open) + ')';
    ig.beginPath(); ig.ellipse(x + (look || 0) * r * 0.25, y, r * 0.5, h * 0.95, 0, 0, TAU); ig.fill();
    ig.fillStyle = INK + '0.95)';
    ig.beginPath(); ig.ellipse(x + (look || 0) * r * 0.25, y, r * 0.11, h * 0.9, 0, 0, TAU); ig.fill();
    stroke([[x - r * 1.15, y + r * 0.05], [x - r * 0.4, y - h * 1.15], [x + r * 0.5, y - h * 1.1], [x + r * 1.2, y]], Math.max(2, r * 0.22), { seed, amp: 1.2, tin: 0.2, tout: 0.3 });
    stroke([[x - r * 1.0, y + r * 0.05], [x, y + h * 1.0], [x + r * 1.05, y + r * 0.02]], Math.max(1.5, r * 0.12), { seed: seed + 1, amp: 1.2, a: 0.7 });
  }

  /* ---------------------------------------------------------------- the edges: it crawls in */
  function edgeCreep(A, t) {
    if (A <= 0.01) return;
    // a ring of charcoal that closes in, its inner edge boiling
    const inner = [];
    const n = 96, cx = BW / 2, cy = BH * 0.48;
    const R0 = lerp(1.35, 0.6, Math.pow(A, 0.8));
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, w = 1 + 0.16 * (vn1(k * 0.47 + 3, 12) - 0.5) * 2 + 0.025 * bj(77, k, 1);
      inner.push([cx + Math.cos(a) * BW * 0.5 * R0 * w * 1.08, cy + Math.sin(a) * BH * 0.5 * R0 * w]);
    }
    const outer = [[-40, -40], [BW + 40, -40], [BW + 40, BH + 40], [-40, BH + 40]];
    smear([outer, inner], 0.42 * Math.min(1, A * 1.6), PATG, true);
    smear([outer, inner.map(([x, y]) => [cx + (x - cx) * 1.12, cy + (y - cy) * 1.12])], 0.75 * A, PATC, true);
    // bruise-purple in the corners
    for (let k = 0; k < 4; k++) blob(k & 1 ? BW : 0, k & 2 ? BH : 0, 480 * (0.6 + A), PURP, 0.13 * A);
    // tendrils crawling in from the edges
    const N = 46;
    for (let k = 0; k < N; k++) {
      const side = k % 4, u = (ih(k, 1, 901) * 0.9 + 0.05);
      let x0, y0, dx, dy;
      if (side === 0) { x0 = u * BW; y0 = -10; dx = 0; dy = 1; } else if (side === 1) { x0 = BW + 10; y0 = u * BH; dx = -1; dy = 0; }
      else if (side === 2) { x0 = u * BW; y0 = BH + 10; dx = 0; dy = -1; } else { x0 = -10; y0 = u * BH; dx = 1; dy = 0; }
      const grow = clamp((A - ih(k, 2, 901) * 0.35) / 0.65, 0, 1);
      if (grow <= 0) continue;
      const L = grow * (120 + 330 * ih(k, 3, 901)) * (side & 1 ? 1 : 1.15);
      const pts = [], segs = 7, wv = 26 + 30 * ih(k, 4, 901), fq = 1.5 + ih(k, 5, 901) * 2, ph0 = ih(k, 6, 901) * TAU + t * (0.6 + ih(k, 7, 901));
      for (let s = 0; s <= segs; s++) {
        const v = s / segs, along = L * v, side_ = Math.sin(v * fq * PI + ph0) * wv * v;
        pts.push([x0 + dx * along - dy * side_, y0 + dy * along + dx * side_]);
      }
      stroke(pts, 9 + 9 * ih(k, 8, 901), { seed: k + 100, tin: 0, tout: 0.6, a: 0.9, splat: ih(k, 9, 901) > 0.7 ? 6 : 0 });
      // little claws at the tips
      if (grow > 0.6) {
        const tip = pts[segs], pr = pts[segs - 1], ang = Math.atan2(tip[1] - pr[1], tip[0] - pr[0]);
        for (let c = -1; c <= 1; c++) {
          const a2 = ang + c * 0.55, l2 = 26 + 16 * ih(k, 10 + c, 901);
          stroke([tip, [tip[0] + Math.cos(a2) * l2 * 0.6, tip[1] + Math.sin(a2) * l2 * 0.6], [tip[0] + Math.cos(a2 + c * 0.4) * l2, tip[1] + Math.sin(a2 + c * 0.4) * l2]], 3.2, { seed: k * 3 + c + 300, tin: 0, tout: 0.9, dry: 0 });
        }
      }
    }
    // scratchy hatching in a band round the frame
    hatch([[0, 0], [BW, 0], [BW, BH], [0, BH], [0, 0], ...inner.slice().reverse()], -0.75, 13, 1.6, 0.35 * A, 51);
    hatch([[0, 0], [BW, 0], [BW, BH], [0, BH], [0, 0], ...inner.slice().reverse()], 0.62, 17, 1.3, 0.22 * A * A, 52);
  }

  /* ---------------------------------------------------------------- the knock marks, and the flinch */
  function knockMarks(t) {
    for (const k of KN) {
      const d = t - k;
      if (d < 0 || d > 0.55) continue;
      const a = Math.exp(-d / 0.2), grow = s5(d / 0.12);
      const p = P3(GN ? GN.x + 0.24 : 0.1, 1.0, ZD);
      const sc = CAM.f / Math.max(0.3, p[2]) * SC;
      for (let r = 0; r < 9; r++) {
        const an = r / 9 * TAU + ih(fl(k * 10), r, 911) * 0.5, r0 = 0.09 * sc * (0.6 + grow * 0.5), r1 = r0 + 0.32 * sc * grow * (0.6 + ih(fl(k * 10), r, 912) * 0.6);
        stroke([[p[0] + Math.cos(an) * r0, p[1] + Math.sin(an) * r0], [p[0] + Math.cos(an) * r1, p[1] + Math.sin(an) * r1]], Math.max(6, 0.035 * sc), { seed: r + fl(k * 100), a: 0.85 * a, tin: 0.05, tout: 0.7, dry: 0 });
      }
      stroke(ring(p[0], p[1], 0.08 * sc, 0.08 * sc, 10, 0.25, fl(k * 10)).concat([[p[0] + 0.085 * sc, p[1]]]), Math.max(4, 0.02 * sc), { seed: fl(k * 10) + 5, a: 0.7 * a, tin: 0, tout: 0 });
    }
  }
  function flinchLines(t) {
    const d = t - T.flinch;
    if (d < 0 || d > 0.9 || shotAt(t) !== 0) return;
    const a = Math.exp(-d / 0.35) * s5(d / 0.05);
    const x = BACK.hx * SC, y = BACK.hy * SC, s = BACK.s * SC;
    for (let k = 0; k < 7; k++) {
      const an = -PI * 0.92 + k / 6 * PI * 0.84, r0 = 0.16 * s, r1 = r0 + 0.07 * s * (0.7 + ih(k, 1, 913) * 0.6);
      const ox = Math.cos(an), oy = Math.sin(an);
      stroke([[x + ox * r0, y + oy * r0 * 1.2], [x + ox * (r0 + r1) / 2 + oy * 4, y + oy * (r0 + r1) / 2 * 1.2], [x + ox * r1, y + oy * r1 * 1.2]], Math.max(3, 0.012 * s), { seed: 920 + k, a: 0.8 * a, tin: 0.1, tout: 0.6, amp: 3 });
    }
  }

  /* ---------------------------------------------------------------- the Thing behind the glass */
  function thingGrowth(t) {
    if (t < 2.85) return { o: 0, hs: 0, hat: 0, arms: 0, eyes: 0, clip: 1 };
    const kj = (k) => 0.12 * s5(ph(t, k, k + 0.1));
    const o = s5(ph(t, 2.9, 3.6));
    const hs = 0.18 * s5(ph(t, 3.2, 4.3)) + kj(4.3) + kj(4.6) + 0.35 * s5(ph(t, 5.0, 9.5)) + 0.25 * s5(ph(t, 10.0, 16.5)) - 0.25 * s5(ph(t, 20.3, 22.3)) * 0;
    const hat = 0.3 * s5(ph(t, 3.6, 5.3)) + 0.5 * s5(ph(t, 7.0, 10.0)) + 0.9 * s5(ph(t, 14.4, 17.3));
    const arms = 2.2 * s5(ph(t, 6.9, 7.8)) + 2 * s5(ph(t, 8.2, 9.6)) + 2 * s5(ph(t, 12.4, 14.4)) + 2 * s5(ph(t, 15.0, 17.0));
    const eyes = s5(ph(t, 4.45, 4.75));
    const clip = 1 - s5(ph(t, 6.6, 8.0));
    return { o, hs, hat, arms, eyes, clip };
  }
  function drawThing(t, alpha, scaleMul) {
    const g = thingGrowth(t);
    if (g.o <= 0 || alpha <= 0) return;
    const a = g.o * alpha;
    const gx = (GN && GN.a > 0 ? GN.x : -0.13), Z = ZD + 0.03;
    const W3 = (x, y) => P3(x, y, Z);
    const pc = W3(gx, 1.3), sc = CAM.f / Math.max(0.2, pc[2]) * SC * (scaleMul || 1);
    // clip to the pane at first; it breaks out later
    ig.save();
    if (g.clip > 0.01) {
      const q = [W3(DX0 + GS0, GY0), W3(DX0 + GS1, GY0), W3(DX0 + GS1, GY1), W3(DX0 + GS0, GY1)];
      const grow = (1 - g.clip) * 0.9;
      const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
      ig.beginPath();
      q.forEach((p, k) => { const x = cx + (p[0] - cx) * (1 + grow * 2.5), y = cy + (p[1] - cy) * (1 + grow * 3); k ? ig.lineTo(x, y) : ig.moveTo(x, y); });
      ig.closePath(); ig.clip();
    }
    const hs = g.hs, shY = 1.18 + 0.28 * hs, shW = 0.22 + 0.14 * hs;
    const hx = gx + (GN ? GN.hx : 0) + Math.sin(t * 1.3) * 0.02 * hs, hy = 1.32 + 0.62 * hs, hr = 0.088 * (1 + 0.25 * hs);
    // the body: the real shape, grown
    const body = [];
    const bl = [[gx - shW - 0.08, 0.6], [gx - shW - 0.02, 0.95], [gx - shW, shY - 0.04], [gx - shW * 0.6, shY + 0.03], [hx - 0.05, hy - hr * 0.8],
      [hx - hr, hy], [hx - hr * 0.7, hy + hr * 0.8], [hx, hy + hr], [hx + hr * 0.7, hy + hr * 0.8], [hx + hr, hy], [hx + 0.05, hy - hr * 0.8],
      [gx + shW * 0.6, shY + 0.03], [gx + shW, shY - 0.04], [gx + shW + 0.02, 0.95], [gx + shW + 0.08, 0.6]];
    const bl0 = [];
    for (const [x, y] of bl) { const p = W3(x, y); bl0.push([p[0] + bj(41, bl0.length, 1) * 3, p[1] + bj(41, bl0.length, 2) * 3]); }
    body.push(...crSpline(bl0, 4));
    smear(body, 0.88 * a);
    smear(body, 0.35 * a, PATG);
    hatch(body, 1.1, 9, 1.5, 0.5 * a, 43);
    stroke(bl0.slice(0, 8), 9, { seed: 44, a, tin: 0.05, tout: 0.1 });
    stroke(bl0.slice(7), 9, { seed: 45, a, tin: 0.1, tout: 0.05 });
    // drips off its lower edge
    for (let k = 0; k < 6; k++) {
      const x = gx - shW + (k + 0.5) / 6 * shW * 2, p = W3(x, shY - 0.1), L = (0.06 + 0.12 * ih(k, 1, 931)) * sc * (0.5 + hs) * (0.6 + 0.4 * Math.sin(t * 1.7 + k));
      stroke([p, [p[0] + bj(46, k, 1) * 2, p[1] + L * 0.5], [p[0], p[1] + L]], 6, { seed: 46 + k, a: a * 0.8, tin: 0, tout: 0.5, splat: 3 });
    }
    // the hat: brim, and a crown that does not stop growing
    {
      const by = hy + hr * 0.75, bw = 0.2 * (1 + 0.45 * hs);
      const brim = [];
      for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1; const p = W3(hx + u * bw, by - Math.pow(Math.abs(u), 1.6) * 0.09 * (1 + hs) + 0.012); brim.push(p); }
      stroke(brim, 0.045 * sc, { seed: 47, a, tin: 0.15, tout: 0.15 });
      const H = 0.12 + g.hat * 1.1, sw = 0.09 * (1 + 0.3 * hs);
      const L = [], R = [];
      for (let k = 0; k <= 10; k++) {
        const v = k / 10, bend = Math.sin(v * 2.2 + t * 0.6) * 0.08 * g.hat * v + v * v * 0.25 * g.hat;
        const w = sw * (1 - v * 0.42) * (1 + 0.14 * Math.sin(v * 9 + t * 1.3));
        L.push(W3(hx - w + bend, by + v * H)); R.push(W3(hx + w + bend, by + v * H));
      }
      const crown = L.concat(R.reverse());
      smear(crown, 0.9 * a);
      stroke(L, 7, { seed: 48, a, tin: 0, tout: 0.2 }); stroke(R.slice().reverse(), 7, { seed: 49, a, tin: 0, tout: 0.2 });
      hatch(crown, -0.9, 10, 1.4, 0.4 * a, 50);
      // the band, too bright, too orange
      if (g.hat > 0.3) stroke([W3(hx - sw * 0.98, by + 0.02 * H + 0.02), W3(hx + sw * 0.98 + 0.01, by + 0.02 * H + 0.025)], 0.016 * sc, { seed: 51, col: ORNG, a: a * 0.55 * clamp(g.hat - 0.3, 0, 1), dry: 0 });
    }
    // eyes under the brim, then more of them
    if (g.eyes > 0) {
      const e1 = W3(hx - hr * 0.38, hy + hr * 0.1), e2 = W3(hx + hr * 0.38, hy + hr * 0.1);
      const er = Math.max(3, hr * 0.32 * sc), blink = 1 - env(fr(t / 3.1), 0.0, 0.03, 0.05, 0.08);
      inkEye(e1[0], e1[1], er, g.eyes * blink * a, 61, Math.sin(t * 0.7));
      inkEye(e2[0], e2[1], er, g.eyes * blink * a, 62, Math.sin(t * 0.7));
      const more = clamp((hs - 0.5) / 0.4, 0, 1);
      for (let k = 0; k < 6; k++) {
        const ek = clamp(more * 6 - k, 0, 1);
        if (ek <= 0) continue;
        const ex = gx + (ih(k, 1, 941) - 0.5) * shW * 1.6, ey = 0.7 + ih(k, 2, 941) * (shY - 0.75);
        const p = W3(ex, ey);
        inkEye(p[0], p[1], er * (0.5 + 0.5 * ih(k, 3, 941)), ek * a, 63 + k, Math.sin(t * 0.9 + k));
      }
      // a mouth that is just a seam, glowing dull orange inside
      if (hs > 0.6) {
        const m0 = W3(hx - hr * 0.5, hy - hr * 0.45), m1 = W3(hx + hr * 0.5, hy - hr * 0.45);
        const ma = clamp((hs - 0.6) / 0.3, 0, 1) * a;
        const pts = [];
        for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push([lerp(m0[0], m1[0], u), lerp(m0[1], m1[1], u) + (k & 1 ? 1 : -1) * 0.012 * sc]); }
        stroke(pts, 0.022 * sc, { seed: 70, col: ORNG, a: ma * 0.7, amp: 1.5, dry: 0 });
        stroke(pts, 0.008 * sc, { seed: 71, a: ma, amp: 1.5 });
      }
    }
    // arms: too many, too long, jointed; long fingers that drag down the glass
    const nA = g.arms;
    for (let k = 0; k < 8; k++) {
      const gr = clamp(nA - k, 0, 1);
      if (gr <= 0) continue;
      const side = k & 1 ? 1 : -1, tier = k >> 1;
      const root = [gx + side * shW * 0.95, shY - 0.04 - tier * 0.12];
      const L1 = (0.22 + 0.12 * ih(k, 1, 951)) * (1 + 0.5 * hs) * gr, L2 = (0.26 + 0.14 * ih(k, 2, 951)) * (1 + 0.5 * hs) * gr;
      const sway = Math.sin(t * (0.7 + 0.3 * ih(k, 3, 951)) + k) * 0.25;
      // the scratch: arms 0 and 1 drag their hands down the glass in the scratch windows
      let drag = 0, dragU = 0;
      if (k < 2 || k === 4) for (const [s0, s1] of T.scratch) { if (t > s0 - 0.1 && t < s1 + 0.6) { dragU = ph(t, s0, s1); drag = env(t, s0 - 0.1, s0, s1, s1 + 0.6); } }
      const a1 = side > 0 ? (0.5 + tier * 0.35 + sway) : PI - (0.5 + tier * 0.35 + sway);
      const elbow = [root[0] + Math.cos(a1) * L1, root[1] + Math.sin(a1) * L1 + 0.05];
      let a2 = a1 - side * (1.9 - 0.3 * ih(k, 4, 951)) + Math.sin(t * 1.1 + k * 2) * 0.2;
      let hand = [elbow[0] + Math.cos(a2) * L2, elbow[1] + Math.sin(a2) * L2];
      if (drag > 0) {
        const hx0 = DX0 + (k === 4 ? 0.3 : side > 0 ? 0.52 : 0.26), hy0 = GY1 - 0.1;
        const tx = hx0, ty = hy0 - dragU * 0.55;
        hand = [lerp(hand[0], tx, drag), lerp(hand[1], ty, drag)];
        // the trails it leaves on the glass
        for (let f = 0; f < 4; f++) {
          const fx = tx + (f - 1.5) * 0.03, top = W3(fx, hy0), bot = W3(fx + bj(80, f, 1) * 0.002, ty - 0.06);
          stroke([top, [(top[0] + bot[0]) / 2 + bj(81, f, 1) * 3, (top[1] + bot[1]) / 2], bot], 0.006 * sc + 1.5, { seed: 82 + f, a: a * 0.75 * drag, tin: 0.02, tout: 0.3, dry: 0 });
        }
      }
      const pR = W3(root[0], root[1]), pE = W3(elbow[0], elbow[1]), pH = W3(hand[0], hand[1]);
      // one long sinuous limb: root, a bowed upper arm, a sharp elbow, a bowed forearm, the wrist
      const bow = (p, q, amt, ph0) => { const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; const o = amt * l * Math.sin(t * 0.9 + ph0); return [mx - dy / l * o, my + dx / l * o]; };
      const limb = [pR, bow(pR, pE, 0.16, k), pE, bow(pE, pH, -0.12, k * 2), pH];
      const lw = 0.026 * sc * (0.55 + 0.45 * gr);
      stroke(limb, lw, { seed: 91 + k, a, tin: 0, tout: 0.18, sub: 4 });
      // a second, hairline pass beside it: drawn twice, not quite in register
      stroke(limb.map((p, q) => [p[0] + bj(95, q + k * 9, 1) * 5 + 4, p[1] + bj(95, q + k * 9, 2) * 5 - 3]), Math.max(1.6, lw * 0.18), { seed: 96 + k, a: a * 0.55, dry: 0, tin: 0, tout: 0 });
      splat(pE[0], pE[1], 0.018 * sc, 5, 94 + k, a * 0.8);
      // fingers: long, jointed, hooked into claws
      const fa = Math.atan2(pH[1] - pE[1], pH[0] - pE[0]);
      const fl_ = (0.1 + 0.05 * ih(k, 5, 951)) * sc * (1 + 0.4 * hs) * gr;
      for (let f = 0; f < 4; f++) {
        const b = drag > 0 ? PI / 2 + (f - 1.5) * 0.13 : fa + (f - 1.5) * 0.36;
        const curl = (drag > 0 ? 0.15 : 0.55) * side + Math.sin(t * 1.7 + f + k) * 0.12;
        const p1 = [pH[0] + Math.cos(b) * fl_ * 0.45, pH[1] + Math.sin(b) * fl_ * 0.45];
        const p2 = [p1[0] + Math.cos(b + curl) * fl_ * 0.38, p1[1] + Math.sin(b + curl) * fl_ * 0.38];
        const p3 = [p2[0] + Math.cos(b + curl * 2.4) * fl_ * 0.25, p2[1] + Math.sin(b + curl * 2.4) * fl_ * 0.25];
        stroke([pH, p1, p2, p3], Math.max(2.2, 0.011 * sc), { seed: 100 + k * 4 + f, a, tin: 0, tout: 0.6, dry: 0 });
        splat(p1[0], p1[1], 0.006 * sc, 2, 200 + k * 4 + f, a * 0.7);
      }
    }
    ig.restore();
  }

  /* ---------------------------------------------------------------- rain on the glass turns to tendrils; it seeps under the door */
  function rainTendrils(t, A) {
    if (A <= 0) return;
    const panes = [[DX0 + GS0, DX0 + GS1, GY0, GY1, 9], [SL0, SL1, SLY0, SLY1, 6], [DX0, DX1, FLY0, FLY1, 4]];
    let id = 0;
    for (const [x0, x1, y0, y1, n] of panes) for (let k = 0; k < n; k++, id++) {
      const x = x0 + (k + 0.5) / n * (x1 - x0) + (ih(id, 1, 961) - 0.5) * 0.02;
      const top = y1 - ih(id, 2, 961) * (y1 - y0) * 0.4;
      const len = (y1 - y0) * (0.25 + 0.75 * ih(id, 3, 961)) * clamp(A * 1.6 - ih(id, 4, 961) * 0.6, 0, 1.4);
      if (len <= 0.01) continue;
      const pts = [];
      for (let s = 0; s <= 6; s++) {
        const v = s / 6, y = top - len * v;
        pts.push(P3(x + Math.sin(v * 9 + t * 2.1 + id) * 0.012 * v, y, ZD - 0.005));
      }
      const p0 = P3(x, top, ZD), sc = CAM.f / Math.max(0.2, p0[2]) * SC;
      stroke(pts, Math.max(2.5, 0.012 * sc), { seed: 970 + id, a: 0.9, tin: 0.05, tout: 0.5, splat: 2 });
      blob(p0[0], p0[1], 0.02 * sc, INK, 0.5);
    }
    // under the door, along the floor, toward her
    const F = clamp((A - 0.3) / 0.7, 0, 1);
    if (F <= 0) return;
    for (let k = 0; k < 9; k++) {
      const x = DX0 + 0.06 + k / 8 * (DWID - 0.12);
      let len = (0.6 + 1.6 * ih(k, 5, 961)) * F;
      const pts = [];
      let fx = x, fz = ZD - 0.01;
      for (let s = 0; s <= 8; s++) {
        const v = s / 8; fz = ZD - 0.01 - len * v; fx = x + Math.sin(v * 5 + t * 1.3 + k) * 0.06 * v + (x + 0.11) * v * 0.6;
        // in the walk she steps and it pulls back from her feet
        if (t > T.s10 && t < T.s11) { const wz = walkZ(t), wx = walkX(t), dzz = fz - wz, dxx = fx - wx, dd = Math.hypot(dxx, dzz); if (dd < 0.35) { fx += dxx / (dd + 1e-3) * (0.35 - dd); fz += dzz / (dd + 1e-3) * (0.35 - dd); } }
        pts.push(P3(fx, 0.003, fz));
      }
      if (pts[0][2] < 0.1 || pts[pts.length - 1][2] < 0.1) continue;
      const sc = CAM.f / Math.max(0.3, pts[0][2]) * SC;
      stroke(pts, Math.max(3, 0.03 * sc), { seed: 990 + k, a: 0.9, tin: 0, tout: 0.6, splat: 4 });
    }
  }

  /* ---------------------------------------------------------------- the garden, in the lightning */
  function gardenInk(t) {
    const L = lightningAt(t), A = clamp(0.5 + 0.8 * L, 0, 1) * s5(ph(t, T.s6 - 0.1, T.s6 + 0.25));
    if (A <= 0) return;
    ig.save();
    const q = [P3(SL0, SLY0, ZD), P3(SL1, SLY0, ZD), P3(SL1, SLY1, ZD), P3(SL0, SLY1, ZD)];
    ig.beginPath(); q.forEach((p, k) => (k ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.closePath(); ig.clip();
    const Zf = ZD + 3.2;
    const W3 = (x, y) => P3(x, y, Zf);
    const sc = CAM.f / Math.max(0.3, W3(0, 0)[2]) * SC;
    // a tall thing by the gate: a neck too long, arms to the ground
    const fx = 1.05 + Math.sin(t * 0.8) * 0.03;
    const sp = [W3(fx, 0), W3(fx - 0.05, 1.2), W3(fx + 0.04, 2.0), W3(fx - 0.08, 2.9)];
    stroke(sp, 0.09 * sc, { seed: 1100, a: A });
    const head = W3(fx - 0.1, 3.1);
    smear(ring(head[0], head[1], 0.22 * sc, 0.3 * sc, 14, 0.3, 1101), A);
    inkEye(head[0] - 0.07 * sc, head[1], 0.05 * sc, A, 1102, 0); inkEye(head[0] + 0.08 * sc, head[1] + 0.02 * sc, 0.04 * sc, A, 1103, 0);
    for (const sg of [-1, 1]) {
      const sh = W3(fx + sg * 0.05, 2.2), el = W3(fx + sg * 0.6, 1.5), hd = W3(fx + sg * 0.35 + Math.sin(t + sg) * 0.05, 0.2);
      stroke([sh, el, hd], 0.05 * sc, { seed: 1104 + sg, a: A, tout: 0.3 });
      for (let f = 0; f < 4; f++) stroke([hd, [hd[0] + (f - 1.5) * 0.05 * sc, hd[1] + 0.12 * sc]], 0.015 * sc + 2, { seed: 1110 + f + sg * 10, a: A, tin: 0, tout: 0.6, dry: 0 });
    }
    // the tree reaches with clawed branches
    const TX = 0.05, tr = W3(TX, 0.0), tt = W3(TX - 0.05, 2.4);
    stroke([tr, W3(TX + 0.1, 1.2), tt], 0.2 * sc, { seed: 1120, a: A });
    for (let b = 0; b < 6; b++) {
      const by = 1.2 + b * 0.3, base = W3(TX + Math.sin(b) * 0.05, by), dir = b & 1 ? 1 : -1;
      const reach = (0.6 + 0.4 * ih(b, 1, 1121)) * (0.7 + 0.3 * L);
      const mid = W3(TX + dir * reach * 0.5, by + 0.25), end = W3(TX + dir * reach, by + 0.1 + Math.sin(t * 1.4 + b) * 0.08);
      stroke([base, mid, end], 0.075 * sc, { seed: 1122 + b, a: A, tout: 0.5 });
      for (let f = 0; f < 3; f++) stroke([end, [end[0] + dir * (0.04 + f * 0.03) * sc, end[1] + (f - 1) * 0.06 * sc]], 0.012 * sc + 2, { seed: 1130 + b * 3 + f, a: A, tin: 0, tout: 0.7, dry: 0 });
    }
    // the hedge has a row of eyes, and teeth
    for (let k = 0; k < 7; k++) {
      const p = W3(-0.9 + k * 0.32, 0.75 + Math.sin(k * 2.1) * 0.08);
      inkEye(p[0], p[1], 0.05 * sc, A * clamp(L * 2 + 0.45, 0, 1), 1140 + k, Math.sin(t + k));
    }
    const teeth = [];
    for (let k = 0; k <= 14; k++) teeth.push(W3(-1.1 + k * 0.17, 0.45 + (k & 1 ? 0.12 : 0)));
    stroke(teeth, 0.03 * sc, { seed: 1150, a: A * 0.9, amp: 2 });
    ig.restore();
  }

  /* ---------------------------------------------------------------- the handle turns by itself */
  function inkHandle(t) {
    const A = s5(ph(t, T.s7 - 0.4, T.s7 + 0.3)) * (t < T.s8 + 0.5 ? 1 : 0.6);
    if (A <= 0) return;
    const turn = 0.18 * s5(ph(t, T.handle0, T.handle0 + 0.25)) + 0.2 * s5(ph(t, 13.25, 13.45)) + 0.25 * s5(ph(t, 13.7, 13.95)) - 0.08 * Math.max(0, Math.sin((t - 13.95) * 9)) * env(t, 13.95, 14.0, 14.2, 14.4);
    const piv = P3(DX0 + HDS, HDY, ZD - 0.012), sc = CAM.f / Math.max(0.2, piv[2]) * SC;
    // the lever, drawn: two edges, a rounded end, hatching; and fainter ghosts of where it just was
    const lever = (ang, al, seed) => {
      const ca = Math.cos(ang), sa = Math.sin(ang), L = 0.115 * sc, w = 0.012 * sc;
      const P = (u, v) => [piv[0] - ca * u + sa * v, piv[1] + sa * u + ca * v];
      const poly = [P(-0.01 * sc, -w), P(L, -w * 1.1), P(L + w, 0), P(L, w * 1.2), P(-0.01 * sc, w)];
      hatch(poly, ang + 0.9, Math.max(4, 0.006 * sc), 1.6, al * 0.7, seed);
      stroke([P(-0.01 * sc, -w), P(L * 0.5, -w * 1.05), P(L, -w * 1.1), P(L + w, 0)], Math.max(3, 0.006 * sc), { seed, a: al, tin: 0, tout: 0.1 });
      stroke([P(L + w, 0), P(L, w * 1.2), P(L * 0.5, w * 1.1), P(-0.01 * sc, w)], Math.max(3, 0.006 * sc), { seed: seed + 1, a: al, tin: 0.1, tout: 0 });
    };
    for (let g = 2; g >= 1; g--) { const ta = Math.max(0, turn - g * 0.07); if (turn > 0.02) lever(ta, A * 0.22 / g, 1196 + g * 3); }
    lever(turn, A, 1200);
    stroke(ring(piv[0], piv[1], 0.02 * sc, 0.02 * sc, 9, 0.2, 1201).concat([[piv[0] + 0.02 * sc, piv[1]]]), 0.006 * sc, { seed: 1202, a: A, tin: 0, tout: 0 });
    // motion scratches round it
    for (let k = 0; k < 5; k++) {
      const an = PI + 0.15 + k * 0.08, r0 = 0.13 * sc, r1 = 0.15 * sc;
      stroke([[piv[0] + Math.cos(an) * r0, piv[1] + Math.sin(an) * r0], [piv[0] + Math.cos(an + 0.3) * r1, piv[1] + Math.sin(an + 0.3) * r1]], 3, { seed: 1203 + k, a: A * 0.7 * clamp(turn * 3, 0, 1), dry: 0 });
    }
    // an eye at the keyhole
    const kh = P3(DX0 + HDS, HDY - 0.085, ZD - 0.012);
    inkEye(kh[0], kh[1], 0.012 * sc, A * s5(ph(t, 13.1, 13.4)), 1210, Math.sin(t * 2));
    // fingers curling round the edge of the door, from outside
    const fA = A * s5(ph(t, 12.9, 13.8));
    for (let f = 0; f < 4; f++) {
      const y = HDY + 0.16 + f * 0.035, e0 = P3(DX1 + 0.005, y, ZD), m = P3(DX1 - 0.03, y + 0.01, ZD - 0.01), e1 = P3(DX1 - 0.06 - f * 0.005, y - 0.012, ZD - 0.01);
      stroke([e0, m, e1], 0.013 * sc * fA + 1, { seed: 1220 + f, a: fA, tin: 0, tout: 0.6 });
    }
  }

  /* ---------------------------------------------------------------- the hall becomes a tunnel; the house turns on her */
  function tunnel(t, k0) {
    // k0 0..1: how long the hall has grown
    if (k0 <= 0.01) return;
    const sp = 0.25 + 0.7 * k0, K = 7, a = clamp(k0 * 1.5, 0, 1);
    const fr_ = [];
    for (let k = 0; k <= K; k++) {
      const z = ZD + k * sp * (1 + k * 0.12);
      const sh = Math.sin(k * 1.3 + t * 0.7) * 0.03 * k;
      fr_.push([P3(-HW + sh, 0, z), P3(HW + sh, 0, z), P3(HW + sh, HC, z), P3(-HW + sh, HC, z)]);
    }
    // the far end: a small door with a pale pane and the shape in it
    const last = fr_[K], zl = ZD + K * sp * (1 + K * 0.12);
    // cover the real door wall with the tunnel walls
    smear([fr_[0], fr_[K].slice().reverse()], 0.9 * a);
    for (let c = 0; c < 4; c++) stroke(fr_.map((f) => f[c]), 10, { seed: 1300 + c, a, tin: 0, tout: 0 });
    for (let k = 1; k <= K; k++) stroke(fr_[k].concat([fr_[k][0]]), Math.max(3, 9 - k), { seed: 1310 + k, a: a * (1 - k / (K + 3)), tin: 0, tout: 0 });
    // boards and panelling, receding
    for (let s = 0; s < 6; s++) {
      const x = -HW + (s + 0.5) / 6 * 2 * HW;
      stroke([P3(x, 0, ZD), P3(x, 0, zl)], 3, { seed: 1320 + s, a: a * 0.6, tin: 0, tout: 0, dry: 0 });
    }
    for (const side of [-1, 1]) for (const y of [0.9, 2.27]) stroke([P3(side * HW, y, ZD), P3(side * HW, y, zl)], 3, { seed: 1330 + y * 10 + side, a: a * 0.6, dry: 0 });
    hatch(fr_[0].concat(fr_[K].slice().reverse()), 0.4, 14, 1.5, 0.3 * a, 1340);
    // the door at the end, glowing, and the shape behind its pane
    const dw = [P3(DX0, 0, zl), P3(DX1, 0, zl), P3(DX1, DH, zl), P3(DX0, DH, zl)];
    ig.fillStyle = 'rgba(214,222,232,' + (0.92 * a) + ')';
    const gq = [P3(DX0 + GS0, GY0, zl), P3(DX0 + GS1, GY0, zl), P3(DX0 + GS1, GY1, zl), P3(DX0 + GS0, GY1, zl)];
    ig.beginPath(); gq.forEach((p, k) => (k ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.closePath(); ig.fill();
    stroke(dw.concat([dw[0]]), 5, { seed: 1350, a, tin: 0, tout: 0 });
    const gc = P3(DX0 + 0.4, 1.4, zl), gs = CAM.f / Math.max(0.3, gc[2]) * SC;
    smear(ring(gc[0], gc[1] - 0.05 * gs, 0.16 * gs, 0.36 * gs, 12, 0.25, 1351), a);
    inkEye(gc[0] - 0.04 * gs, gc[1] - 0.25 * gs, Math.max(2, 0.025 * gs), a, 1352, 0);
    inkEye(gc[0] + 0.04 * gs, gc[1] - 0.25 * gs, Math.max(2, 0.025 * gs), a, 1353, 0);
  }
  function houseThreats(t, A) {
    if (A <= 0.01) return;
    // the coat on its hook reaches out along the wall
    const cz = 3.45, coat = [];
    for (let k = 0; k <= 12; k++) { const v = k / 12; const half = v < 0.1 ? 0.04 + v * 1.4 : Math.min(0.19 + (v - 0.1) * 0.06, 0.24); coat.push(P3(-HW + 0.01, 1.74 - v * 0.98, cz - half)); }
    for (let k = 12; k >= 0; k--) { const v = k / 12; const half = v < 0.1 ? 0.04 + v * 1.4 : Math.min(0.19 + (v - 0.1) * 0.06, 0.24); coat.push(P3(-HW + 0.01, 1.74 - v * 0.98, cz + half)); }
    stroke(coat, 6, { seed: 1400, a: A, tin: 0, tout: 0 });
    hatch(coat, 1.3, 8, 1.5, 0.55 * A, 1401);
    for (let k = 0; k < 2; k++) {
      const g = clamp(A * 1.4 - k * 0.3, 0, 1), y = 1.35 - k * 0.15;
      const pts = [];
      for (let s = 0; s <= 6; s++) { const v = s / 6; pts.push(P3(-HW + 0.02 + v * 0.1 * g, y - Math.sin(v * 3 + t + k) * 0.05, cz - 0.2 - v * 1.3 * g)); }
      stroke(pts, 12, { seed: 1402 + k, a: A * g, tin: 0, tout: 0.25 });
      const tip = pts[6];
      for (let f = 0; f < 4; f++) stroke([tip, [tip[0] + (f - 1.5) * 9, tip[1] + 30 + f * 4]], 3, { seed: 1404 + k * 4 + f, a: A * g, tin: 0, tout: 0.7, dry: 0 });
    }
    // the lamp shade opens an eye
    const lp = P3(LAMP[0], 1.17, LAMP[2] - 0.14), ls = CAM.f / Math.max(0.2, lp[2]) * SC;
    inkEye(lp[0], lp[1], 0.07 * ls, A * s5(ph(t, 15.0, 15.6)), 1410, Math.sin(t * 0.8) - 0.5);
    for (let k = 0; k < 7; k++) { const an = PI + 0.3 + k * 0.4, r0 = 0.085 * ls; stroke([[lp[0] + Math.cos(an) * r0, lp[1] + Math.sin(an) * r0 * 0.6], [lp[0] + Math.cos(an) * r0 * 1.4, lp[1] + Math.sin(an) * r0 * 0.9]], 2.5, { seed: 1411 + k, a: A * s5(ph(t, 15.0, 15.6)), dry: 0 }); }
    // the lead is a snake
    const sn = [];
    for (let k = 0; k <= 10; k++) { const v = k / 10; sn.push(P3(-HW + 0.02, 1.74 - v * 0.75, 4.08 + Math.sin(v * 8 + t * 2.4) * 0.06 * v)); }
    stroke(sn, 10, { seed: 1420, a: A, tin: 0, tout: 0.05 });
    const hd = sn[10];
    ig.fillStyle = INK + A + ')'; ig.beginPath(); ig.ellipse(hd[0], hd[1] + 6, 11, 16, 0, 0, TAU); ig.fill();
    stroke([[hd[0], hd[1] + 20], [hd[0] + Math.sin(t * 9) * 4, hd[1] + 34], [hd[0] + Math.sin(t * 9 + 1) * 6, hd[1] + 40]], 3, { seed: 1421, col: ORNG, a: A * 0.8, dry: 0 });
    // ink weeps from the ceiling
    for (let k = 0; k < 8; k++) {
      const x = -HW + 0.1 + k / 7 * (2 * HW - 0.2), z = 1.0 + ih(k, 1, 1430) * 3;
      const L = (0.1 + 0.4 * ih(k, 2, 1430)) * A * (0.7 + 0.3 * Math.sin(t * 1.3 + k));
      const p0 = P3(x, HC, z), p1 = P3(x, HC - L, z);
      if (p0[2] < 0.2) continue;
      stroke([p0, p1], 5, { seed: 1431 + k, a: A * 0.8, tin: 0, tout: 0.3, splat: 2 });
    }
  }

  /* ---------------------------------------------------------------- on her: hatching, breath that fogs, the shape behind her */
  function herInk(t, A, s) {
    if (A <= 0.01) return;
    const x = FACE.x * SC, y = FACE.y * SC, k = FACE.s * SC;
    // hatched shadow down her far side, and under her eyes
    const calm = s === 8 ? 1 - 0.65 * s5(ph(t, T.breathOut, T.eyesOpen + 0.3)) : 1;
    void calm;
    // a shape in the arch behind her
    const bp = P3(0.25, 0.9, ZB - 1.6), bs = CAM.f / Math.max(0.3, bp[2]) * SC;
    if (bp[2] > 0.3) {
      const B = A * clamp(A * 1.5 - 0.3, 0, 1);
      ig.save(); ig.beginPath(); ig.rect(0, 0, BW, BH);
      ig.ellipse(x, y - 0.01 * k, 0.12 * k, 0.15 * k, 0, 0, TAU); ig.ellipse(x, y + 0.36 * k, 0.29 * k, 0.26 * k, 0, 0, TAU); ig.clip('evenodd');
      const hump = ring(bp[0], bp[1], 0.55 * bs, 0.5 * bs, 18, 0.22, 1510);
      smear(hump, 0.85 * B);
      for (let k2 = 0; k2 < 7; k2++) { const an = -PI * 0.85 + k2 * 0.28, r0 = 0.5 * bs; stroke([[bp[0] + Math.cos(an) * r0, bp[1] + Math.sin(an) * r0 * 0.9], [bp[0] + Math.cos(an) * r0 * 1.35, bp[1] + Math.sin(an) * r0 * 1.3]], 0.03 * bs, { seed: 1511 + k2, a: B, tin: 0, tout: 0.8 }); }
      for (let e = 0; e < 4; e++) inkEye(bp[0] - 0.2 * bs + e * 0.13 * bs, bp[1] - 0.12 * bs + Math.sin(e * 2) * 0.04 * bs, 0.035 * bs, B, 1520 + e, Math.sin(t + e));
      ig.restore();
    }
  }
  function herMarks(t, A, s) {
    if (A <= 0.01) return;
    const x = FACE.x * SC, y = FACE.y * SC, k = FACE.s * SC;
    const calm = s === 8 ? 1 - 0.7 * s5(ph(t, T.breathOut, T.eyesOpen + 0.3)) : 1;
    // hatched shadow down the far side of her face and neck, cross-hatched as it deepens
    const side = [[x + 0.035 * k, y - 0.1 * k], [x + 0.085 * k, y - 0.07 * k], [x + 0.095 * k, y + 0.02 * k], [x + 0.06 * k, y + 0.09 * k], [x + 0.03 * k, y + 0.16 * k], [x + 0.25 * k, y + 0.16 * k], [x + 0.25 * k, y - 0.1 * k]];
    hatch(side, -1.0, Math.max(4, 0.0065 * k), Math.max(1.1, 0.0014 * k), 0.5 * A * calm, 1500);
    hatch(side, 0.45, Math.max(6, 0.009 * k), Math.max(1.0, 0.0012 * k), 0.3 * A * A * calm, 1501);
    // shadows under the eyes
    for (const sg of [-1, 1]) stroke([[x + sg * 0.047 * k, y + 0.012 * k], [x + sg * 0.031 * k, y + 0.02 * k], [x + sg * 0.015 * k, y + 0.014 * k]], Math.max(2, 0.0032 * k), { seed: 1502 + sg, a: 0.5 * A * calm, dry: 0, amp: 1 });
  }
  function breath(t, s) {
    const puffs = s === 3 ? [5.68, 6.42] : s === 8 ? [T.breathOut] : [];
    const mx = FACE.mx * SC, my = FACE.my * SC, k = FACE.s * SC;
    for (const p0 of puffs) {
      const d = t - p0, life = s === 8 ? 1.6 : 1.0;
      if (d < 0 || d > life) continue;
      const u = d / life, a = Math.sin(Math.min(1, u * 3) * PI / 2) * (1 - s5(u));
      for (let c = 0; c < 6; c++) {
        const dir = -0.2 + (c - 2.5) * 0.18, dist = (0.02 + 0.12 * u * (0.6 + 0.4 * ih(c, 1, 1530))) * k;
        const bx = mx + Math.sin(dir) * dist * 1.3 + 0.03 * k * u, by = my + 0.01 * k - Math.cos(dir) * dist * 0.2 - 0.05 * k * u * u;
        const r = (0.014 + 0.04 * u) * k * (0.7 + 0.5 * ih(c, 2, 1530));
        blob(bx, by, r, CHALK, 0.2 * a);
      }
      // a few chalk scribbles round its edge
      for (let c = 0; c < 4; c++) {
        // curling wisps of breath, drawn in chalk
        const r = (0.012 + 0.04 * u) * k * (1 + c * 0.2), cx = mx + (0.02 + 0.1 * u) * k * (c & 1 ? 1 : 0.55), cy = my - (0.005 + 0.05 * u * u) * k - c * 0.008 * k;
        const arc = [];
        for (let q = 0; q <= 5; q++) { const an = c * 1.7 + q * 0.55 + u * 2, rr = r * (1 - q * 0.06); arc.push([cx + Math.cos(an) * rr * 1.3, cy + Math.sin(an) * rr * 0.7]); }
        stroke(arc, Math.max(1.5, 0.0035 * k), { seed: 1540 + c, col: CHALK, a: 0.6 * a, dry: 0, amp: 1.5 });
      }
    }
  }

  /* ---------------------------------------------------------------- the whole layer for a frame */
  function drawInk(t) {
    BF = fl(t * 10);
    if (window.__knockNoInk) return false;
    const s = shotAt(t), A = fearAt(t);
    ig.setTransform(1, 0, 0, 1, 0, 0);
    ig.clearRect(0, 0, BW, BH);
    let any = false;
    const washing = t >= T.wash0 && t < T.wash1 + 0.5;
    if (A <= 0 && !washing && !(t < 1.2 || (t > 4.2 && t < 5.3))) return false;
    INKAMP = 0.8 + 0.7 * A;
    const At = washing ? fearAt(T.wash0 - 0.01) : A;
    // the hall views
    const hall = !SHOT_R.has(s) && s !== 11;
    if (hall) {
      if (s === 7 || s === 9 || s === 10) {
        const k0 = s === 7 ? s5(ph(t, T.s8, 17.2)) : s === 9 ? 1 - s5(ph(t, T.s10, T.grip)) : 1 - s5(ph(t, T.s11, T.s11 + 0.2));
        tunnel(t, k0 * (washing ? 1 : 1));
        houseThreats(t, At);
      }
      if (s === 4 || s === 2 || s === 10 || s === 0) drawThing(t, 1);
      if (s === 9) drawThing(t, s5(ph(t, T.s10 + 0.3, T.grip)));
      if (s >= 4 && At > 0.3) rainTendrils(t, clamp((At - 0.35) / 0.5, 0, 1));
      if (s === 5) gardenInk(t);
      if (s === 6 || s === 9 || s === 10) inkHandle(t);
      knockMarks(t);
      flinchLines(t);
      any = true;
    } else if (SHOT_R.has(s)) {
      herInk(t, At, s);
      any = true;
    }
    edgeCreep(At * (s === 0 ? 0.6 : 1), t);
    if (SHOT_R.has(s)) {
      // her face stays hers: a soft clearing that widens as she finds her courage
      const cour = s === 8 ? s5(ph(t, T.breathIn, T.eyesOpen + 0.4)) : 0;
      const r = FACE.s * SC * (0.1 + 0.05 * (1 - At) + 0.14 * cour);
      ig.save(); ig.globalCompositeOperation = 'destination-out'; ig.translate(FACE.x * SC, FACE.y * SC + 0.02 * FACE.s * SC); ig.scale(0.85, 1);
      const g = ig.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.75 + 0.2 * cour) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ig.fillStyle = g; ig.fillRect(-r, -r, 2 * r, 2 * r); ig.restore();
      // then the fear's marks on her: hatching on the shadow side, breath that fogs
      herMarks(t, At, s);
      breath(t, s);
    }
    if (s === 9) {
      // she walks in a little clearing of her own
      const p = P3(walkX(t), 0.95, walkZ(t)), r = 0.95 * CAM.f / Math.max(0.3, p[2]) * SC;
      ig.save(); ig.globalCompositeOperation = 'destination-out'; ig.translate(p[0], p[1]); ig.scale(0.55, 1);
      const g = ig.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ig.fillStyle = g; ig.fillRect(-r, -r, 2 * r, 2 * r); ig.restore();
    }
    return any || At > 0;
  }

  /* ================================================================ the words: clean pixel type */
  const GLYPH = {
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    S: ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
    a: ['', '', '.###.', '....#', '.####', '#...#', '.####'],
    c: ['', '', '.###.', '#...#', '#....', '#...#', '.###.'],
    e: ['', '', '.###.', '#...#', '#####', '#....', '.###.'],
    f: ['..##', '.#..', '.#..', '####', '.#..', '.#..', '.#..'],
    g: ['', '', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
    h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
    i: ['.#', '', '##', '.#', '.#', '.#', '.#'],
    k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
    l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
    m: ['', '', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
    n: ['', '', '#.##.', '##..#', '#...#', '#...#', '#...#'],
    o: ['', '', '.###.', '#...#', '#...#', '#...#', '.###.'],
    r: ['', '', '#.##', '##..', '#...', '#...', '#...'],
    s: ['', '', '.###', '#...', '.##.', '...#', '###.'],
    t: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'],
    u: ['', '', '#...#', '#...#', '#...#', '#..##', '.##.#'],
    w: ['', '', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
    y: ['', '', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
    ';': ['', '', '', '#', '', '', '#', '#'],
    '.': ['', '', '', '', '', '', '#'],
    '—': ['', '', '', '', '#####', '', ''],
  };
  const CARD1 = ['There are more things', 'likely to frighten us', 'than there are', 'to crush us;'];
  const CARD2 = ['we suffer more often', 'in imagination', 'than in reality.'];
  const SIGN = '— Seneca';
  const TXT = [];      // [x, y, letterIndex, card, line]
  const FS = 2;        // art pixels per font pixel
  function gw(ch) { if (ch === ' ') return 3; const g = GLYPH[ch]; return g.reduce((m, r) => Math.max(m, r.length), 0); }
  function layLine(str, cx, y0, card, line, base) {
    let w = 0; for (const ch of str) w += gw(ch) + 1; w -= 1;
    let x = Math.round(cx - (w * FS) / 2), li = 0;
    for (const ch of str) {
      if (ch !== ' ') GLYPH[ch].forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') for (let a = 0; a < FS; a++) for (let b = 0; b < FS; b++) TXT.push([x + rx * FS + a, y0 + ry * FS + b, base + li, card, line]); });
      x += (gw(ch) + 1) * FS; li++;
    }
    return base + li;
  }
  const TXT_Y1 = 20, TXT_Y2 = 318, LH = 21, TXN = [0, 0, 0];
  function buildText() {
    let n = 0;
    CARD1.forEach((s, k) => { n = layLine(s, 180, TXT_Y1 + k * LH, 1, k, n); });
    TXN[1] = n; n = 0;
    CARD2.forEach((s, k) => { n = layLine(s, 180, TXT_Y2 + k * LH, 2, k, n); });
    TXN[2] = n;
    layLine(SIGN, 180, TXT_Y2 + 3 * LH + 6, 3, 0, 0);
  }
  const TMASK = new Uint8Array(NP);
  function quoteVis(t) {
    // how much of each card shows (letters arrive one after another, then all dissolve together)
    return { c1: ph(t, T.q1in, T.q1in + 1.3), c2: ph(t, T.q2in, T.q2in + 1.15), sg: ph(t, T.q2in + 1.2, T.q2in + 1.6), out: 1 - ph(t, T.qout, T.qout + 0.6) };
  }
  function drawText(t) {
    if (t < T.q1in - 0.8 || t > T.qout + 0.8) return;
    const q = quoteVis(t);
    // dim the room a little behind the words (slowly)
    const dim = 0.42 * s5(ph(t, T.q1in - 0.6, T.q1in + 0.4)) * (1 - s5(ph(t, T.qout, T.qout + 0.8)));
    if (dim > 0) {
      for (let y = 0; y < H; y++) {
        const band = Math.max(sstep(150, 40, y), sstep(270, 380, y));
        const k = 1 - dim * (0.45 + 0.55 * band);
        for (let x = 0, i = y * W; x < W; x++, i++) { const j = i * 3; C[j] *= k; C[j + 1] *= k * 0.98; C[j + 2] *= k * 0.96; }
      }
    }
    if (q.out <= 0) return;
    TMASK.fill(0);
    const lit = [];
    for (const p of TXT) {
      const [x, y, li, card] = p;
      let v;
      if (card === 1) v = q.c1 * (TXN[1] + 3) - li; else if (card === 2) v = q.c2 * (TXN[2] + 3) - li; else v = q.sg * 3;
      v = clamp(v, 0, 1) * q.out;
      if (v <= 0) continue;
      // a pixel dissolve: each pixel comes in at its own threshold
      if (BAY[((y & 3) << 2) | (x & 3)] + 0.5 > v * 1.02) continue;
      lit.push(p);
    }
    // a soft dark halo first, then a drop shadow, then the letters
    for (const [x, y] of lit) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx; if (TMASK[i]) continue; TMASK[i] = 1;
      const j = i * 3, k = 0.62; C[j] *= k; C[j + 1] *= k; C[j + 2] *= k;
    }
    for (const [x, y] of lit) {
      const xx = x + 1, yy = y + 1; if (xx >= W || yy >= H) continue;
      const i = yy * W + xx, j = i * 3; C[j] = 46; C[j + 1] = 29; C[j + 2] = 31; FLG[i] = 2;
    }
    for (const [x, y, , card] of lit) {
      const i = y * W + x, j = i * 3;
      if (card === 3) { C[j] = 236; C[j + 1] = 196; C[j + 2] = 126; } else { C[j] = 255; C[j + 1] = 244; C[j + 2] = 222; }
      FLG[i] = 2;
    }
  }

  /* ================================================================ quantise */
  function quantise() {
    const K = 63 / Math.sqrt(255);
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        const j = i * 3, fg = FLG[i], DA = fg === 0 ? 4.2 : fg === 1 ? 1.7 : 0, d = BAY[by | (x & 3)] * DA;
        let r = C[j], g = C[j + 1], b = C[j + 2];
        r = r <= 0 ? 0 : r >= 255 ? 63 : Math.sqrt(r) * K; g = g <= 0 ? 0 : g >= 255 ? 63 : Math.sqrt(g) * K; b = b <= 0 ? 0 : b >= 255 ? 63 : Math.sqrt(b) * K;
        let qr = (r + d + 0.5) | 0, qg = (g + d + 0.5) | 0, qb = (b + d + 0.5) | 0;
        qr = qr < 0 ? 0 : qr > 63 ? 63 : qr; qg = qg < 0 ? 0 : qg > 63 ? 63 : qg; qb = qb < 0 ? 0 : qb > 63 ? 63 : qb;
        OUT[i] = (fg ? LUTC : LUTE)[(qr << 12) | (qg << 6) | qb];
      }
    }
  }

  /* ================================================================ a frame */
  let PROF = null;
  const stage = (name, fn, t) => { if (!PROF) { fn(t); return; } const t0 = performance.now(); fn(t); PROF[name] = (PROF[name] || 0) + performance.now() - t0; };
  let INK_ON = false, LAST_T = 0;
  function render(t) {
    t = mod(t, D) + 1e-6; LAST_T = t;     // frame times like 933/30 sit a hair under 31.1: nudge them onto the beat
    camAt(t);
    drawScene(t);
    stage('text', drawText, t);
    stage('quantise', quantise, t);
    if (ig) { const t0 = PROF ? performance.now() : 0; INK_ON = drawInk(t); if (PROF) PROF.ink = (PROF.ink || 0) + performance.now() - t0; }
  }
  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildNoise();
    buildLUT();
    buildLightMaps();
    buildProps();
    buildRain();
    buildText();
    buildInk();
    BUILT = true;
  }

  /* ================================================================ the timeline, for the score and the checks */
  const EV = {
    D, knocks: KN, shots: SHOTS, flinch: T.flinch, lightning: T.lightning, thunder: T.thunder,
    scratch: T.scratch, handle: [T.handle0, 13.25, 13.7], creakInk: [T.handle0, T.handle1],
    eyesShut: T.eyesShut, breathIn: T.breathIn, breathOut: T.breathOut, eyesOpen: T.eyesOpen,
    steps: T.steps, grip: T.grip, latch: T.latch, open: [T.open0, T.open1], wash: [T.wash0, T.wash1],
    barks: T.barks, licks: T.licks, close: [T.close0, T.close1], q1: T.q1in, q2: T.q2in, qout: T.qout,
    flap: [T.flapIn, T.flapOut], dogUp: T.dogUp, arrive: [T.arrive0, T.arrive1], tunnel: [T.s8, 17.2],
    fear: Array.from({ length: Math.round(D * 10) }, (_, k) => +fearAt(k / 10).toFixed(3)),
  };
  const core = { W, H, D, PAL, OUT, C, build, render, EV, T, fearAt, shotAt, prof(on) { PROF = on ? {} : null; return PROF; }, get PROF() { return PROF; } };
  window.__knockCore = core;
  if (typeof document === 'undefined') return;

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
  const PACK = new Uint32Array(NPAL);
  function present(g) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
      for (let n = 0; n < NPAL; n++) { const p = PAL[n]; PACK[n] = (LE ? ((255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]) : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | 255)) >>> 0; }
    }
    for (let i = 0; i < NP; i++) PIX[i] = PACK[OUT[i]];
    SG.putImageData(IMG, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(SMALL, 0, 0, BW, BH);
    if (!INK_ON) return;
    const t = LAST_T;
    if (t >= T.wash0 && t < T.wash1 + 0.5) washDraw(g, t);
    else g.drawImage(IC, 0, 0);
  }
  // the reveal: the ink is eaten away from the open door outward, and what is left runs down in the rain
  function washDraw(g, t) {
    const u = ph(t, T.wash0, T.wash1);
    const c = P3(-0.11, 1.15, ZD);
    const R = 60 + Math.pow(u, 1.25) * 1900;
    ig.save();
    ig.setTransform(1, 0, 0, 1, 0, 0);
    ig.globalCompositeOperation = 'destination-out';
    const gr = ig.createRadialGradient(c[0], c[1], R * 0.55, c[0], c[1], R);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ig.fillStyle = gr;
    ig.beginPath();
    const n = 40;
    for (let k = 0; k <= n; k++) { const a = k / n * TAU, w = 1 + 0.18 * (vn1(k * 0.8, 5) - 0.5) * 2; const x = c[0] + Math.cos(a) * R * w, y = c[1] + Math.sin(a) * R * w * 1.15; k ? ig.lineTo(x, y) : ig.moveTo(x, y); }
    ig.fill();
    ig.restore();
    const sw = 6;
    for (let x = 0; x < BW; x += sw) {
      const h = ih(x / sw, 1, 1600), h2 = ih(x / sw, 2, 1600);
      const dy = u * u * (90 + 520 * h) + u * 30 * Math.sin(x * 0.045);
      const st = 1 + u * (0.1 + 0.6 * h2);
      g.globalAlpha = clamp(1 - u * (0.7 + 0.6 * h), 0, 1);
      if (g.globalAlpha <= 0.01) continue;
      g.drawImage(IC, x, 0, sw, BH, x, dy, sw, BH * st);
    }
    g.globalAlpha = 1;
  }
  function pixelsB64(cv) {
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, BW, BH).data;
    const buf = new Uint8Array(BW * BH * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { buf[j] = d[i]; buf[j + 1] = d[i + 1]; buf[j + 2] = d[i + 2]; }
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ================================================================ mount */
  const ROOM = '#141015';
  (window.PIECES = window.PIECES || []).push({
    id: 'the-knock',
    title: 'The Knock',
    medium: 'Pixel art in 64 colours under boiling ink, drawn in JavaScript · 39 s loop',
    note: 'we suffer more often in imagination than in reality · tap to pause',
    about: 'A stormy evening in a cottage hallway; three knocks at the front door. Through the frosted glass a small round shape waits, and in her imagination it is drawn over in ink: too tall, a hat that will not stop growing, too many arms, long fingers dragged down the glass. Lightning shows more of them in the garden; the handle turns by itself; the hall stretches into a tunnel. She breathes, walks up and opens the door, and the ink runs off in the rain: an elderly neighbour in a yellow sou\'wester, soaked and beaming, with her muddy, wagging dog.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = ROOM;
      const cv = document.createElement('canvas');
      cv.width = BW; cv.height = BH;
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false, willReadFrequently: EXPORT });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/></svg>';
      el.appendChild(pauseMark);
      function fit() {
        let left = 0, top = 0, cssW = BW, cssH = BH;
        if (EXPORT) { cv.style.position = 'fixed'; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const f = Math.min(w / BW, h / BH) * 0.97;
          cssW = BW * f; cssH = BH * f;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => { render(t); present(g); };
      fit();
      build();
      built = true;
      draw(0);
      const hook = {
        duration: D,
        isReady: () => built && (!EXPORT || (() => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; })()),
        renderAt(t) { return new Promise((res) => { playing = false; clock = t; const t0 = performance.now(); draw(t); hook.lastMs = performance.now() - t0; requestAnimationFrame(() => res()); }); },
        pixels: () => pixelsB64(cv),
        lastMs: 0,
        events: EV,
        prof: core.prof,
      };
      window.__knock = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'the-knock';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.3, (now - last) / 1000) : 0; last = now;   // real time, dropping frames if it must
        if (!playing) return;
        clock = (clock + dt) % D;
        const t0 = performance.now();
        draw(clock);
        hook.lastMs = performance.now() - t0;
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; fit(); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__knock === hook) delete window.__knock;
        },
      };
    },
  });
})();
