/* The Throne — A Song of Pixels, piece 3.
 *
 * A 24-second seamless loop: one full orbit around a throne of fused swords on a stepped dais, in a
 * round, dark hall. Everything is a true 3D scene projected to a 270 × 338 grid, every frame:
 *   - the hall (floor, wall, windows, vault, two rings of pillars, the stepped octagonal dais and the
 *     iron core of the throne) is ray-cast per pixel;
 *   - the throne itself is about five hundred procedural swords: each blade is a twisted, tapering
 *     screen-space wedge with a bevelled ridge normal, each hilt a grip, guard and pommel, plus melted
 *     blobs and frozen drips. Blades are shaded as metal against an analytic environment of windows and
 *     candle rings, so the glints slide along them as the view turns;
 *   - long cloth banners in house colours ripple as meshes driven by travelling waves;
 *   - seven hundred candles on iron stands flicker, pool light on the floor (a per-frame lightmap) and
 *     glow; sun shafts from the high windows carry dust and are shadowed by the throne (a shadow map
 *     baked once along the sun direction), raymarched per pixel;
 *   - the polished floor shows a mirror pass of the whole hall (the scene rendered again from the
 *     camera reflected in the floor, only where the floor is seen).
 * Every motion has a period dividing D, and the camera turns exactly 360° in D. The float image is
 * Bayer-dithered into a 45-colour palette and scaled up 4× nearest-neighbour.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 24;
  const TAU = Math.PI * 2;
  const fl = Math.floor, sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, abs = Math.abs;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const fract = (x) => x - fl(x);
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  let RS = 1;
  function rnd() {
    RS = (RS + 0x6d2b79f5) | 0;
    let t = Math.imul(RS ^ (RS >>> 15), 1 | RS);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rnd();
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
  const wave = (n, t, ph) => sin(TAU * n * t / D + ph); // n whole cycles per loop

  /* ================================================================ palette (45) */
  const PAL_HEX = [
    '06050a', '0d0b14', '15131f', '1f1c2c', '2b2839',                // 0-4 shadow
    '3a3c52', '4e546d', '69728b', '8a95aa', 'aeb9c9', 'd2dbe4', 'f2f5f6', // 5-11 steel
    '1e1412', '2f1f1a', '45302a', '5f4232',                          // 12-15 warm shadow
    '4a4542', '6e675d', '958c7c', 'bcb29c',                          // 16-19 haze stone
    '7a5228', 'a06d2c', 'c8913a', 'e4b754', 'f5d886', 'fff2c0',      // 20-25 gold
    'ff8f3a', 'd4542a',                                              // 26-27 fire
    '3d0d18', '701726', 'a8283a', 'd65a4e',                          // 28-31 crimson
    '0c2a22', '16513a', '2b7f55',                                    // 32-34 emerald
    '111a42', '1e3678', '3359ad', '6b93d6',                          // 35-38 sapphire
    '2c1338', '52256a', '7d4594',                                    // 39-41 amethyst
    '0f3438', '1d6164', '3f9490',                                    // 42-44 teal
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const LUT = new Uint8Array(32768), LUTS = new Uint8Array(32768);
  function nearest(r, g, b, nofire) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < PAL.length; k++) {
      if (nofire && (k === 26 || k === 27)) continue;
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
      const rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++)
      { LUT[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4); LUTS[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, true); }
  }

  /* ================================================================ hall layout */
  const RC = 15, HC = 2.6, FOC = 300, CXS = W / 2, CYS = H / 2, TH0 = 0.62, TGY = 5.3, NEAR = 0.25;
  const STEP_H = 0.3, DAIS_A = [4.7, 4.25, 3.8, 3.35, 2.9], TY = 1.5, TZ = -0.6, TS = 1.3;
  const WALL_R = 23, VAULT_Y = 22.5;
  const WIN_N = 16, WIN_Y0 = 8.4, WIN_Y1 = 17.6, WIN_HW = 1.25, WIN_ARCH = 2.4;
  const OCT = [[1, 0], [0.70710678, 0.70710678], [0, 1], [-0.70710678, 0.70710678]]; // dais slab normals

  // sun through the high windows
  const SUN_PHI = 1.5 * TAU / WIN_N, SUN_EL = 0.355;
  const SX = -cos(SUN_PHI) * cos(SUN_EL), SY = -sin(SUN_EL), SZ = -sin(SUN_PHI) * cos(SUN_EL);
  const SHX = -SX / Math.hypot(SX, SZ), SHZ = -SZ / Math.hypot(SX, SZ); // horizontal, toward the sun
  const SUN_C = [1.18, 1.1, 0.96];

  /* ================================================================ lights (candle stands) */
  const LX = [], LY = [], LZ = [], LI0 = [], LIR2 = [], LRM2 = [], LPH = [];
  let LI = null;
  function nearestLights(list, x, z, n) {
    return list.slice().sort((a, b) => Math.hypot(LX[a] - x, LZ[a] - z) - Math.hypot(LX[b] - x, LZ[b] - z)).slice(0, n);
  }
  function addLight(x, y, z, I, r, rmax) {
    LX.push(x); LY.push(y); LZ.push(z); LI0.push(I); LIR2.push(1 / (r * r)); LRM2.push(rmax * rmax);
    LPH.push([rnd() * TAU, rnd() * TAU, rnd() * TAU]);
    return LX.length - 1;
  }

  /* ================================================================ geometry stores */
  // blade segments
  const SEG = [];
  // capsules {ax,ay,az,bx,by,bz,r,m}
  const CAP = [];
  // spheres {x,y,z,r,m}
  const SPH = [];
  // flames {x,y,z,s,ph0,ph1,ph2,amp}
  const FLM = [];
  // boxes [x0,y0,z0,x1,y1,z1,m]
  const BOX = [];
  // pillars {x,z,r,top,lights}
  const PIL = [];
  // banners
  const BAN = [];
  // shafts
  const SHAFT = [];
  // dust
  const DUST = [];
  // metal materials: albedo, spec colour, env strength
  const MAT = [
    { a: [0.24, 0.26, 0.31], s: [0.85, 0.93, 1.05], e: 1.1 },  // 0 bright steel
    { a: [0.13, 0.13, 0.15], s: [0.62, 0.64, 0.72], e: 0.8 },  // 1 blackened steel
    { a: [0.30, 0.24, 0.18], s: [0.95, 0.78, 0.52], e: 0.9 },  // 2 old bronze-steel
    { a: [0.52, 0.36, 0.13], s: [1.05, 0.80, 0.40], e: 1.0 },  // 3 gold
    { a: [0.11, 0.10, 0.10], s: [0.56, 0.52, 0.50], e: 0.6 },  // 4 iron
    { a: [0.07, 0.065, 0.06], s: [0.40, 0.37, 0.34], e: 0.35 }, // 5 stand iron
    { a: [0.80, 0.74, 0.58], s: [0, 0, 0], e: 0 },            // 6 wax
  ];

  function basis(dx, dy, dz) {
    // two unit vectors perpendicular to d
    let ax, ay, az;
    if (abs(dy) < 0.92) { ax = -dz; ay = 0; az = dx; } else { ax = 0; ay = dz; az = -dy; }
    let l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
    const bx = dy * az - dz * ay, by = dz * ax - dx * az, bz = dx * ay - dy * ax;
    return [ax, ay, az, bx, by, bz];
  }
  function rotAxis(vx, vy, vz, kx, ky, kz, a) { // Rodrigues, k unit
    const c = cos(a), s = sin(a), d = (kx * vx + ky * vy + kz * vz) * (1 - c);
    return [vx * c + (ky * vz - kz * vy) * s + kx * d, vy * c + (kz * vx - kx * vz) * s + ky * d, vz * c + (kx * vy - ky * vx) * s + kz * d];
  }
  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  function pushSeg(p0, p1, e0, e1, h0, h1, m) {
    SEG.push({ ax: p0[0], ay: p0[1], az: p0[2], bx: p1[0], by: p1[1], bz: p1[2], e0x: e0[0], e0y: e0[1], e0z: e0[2], e1x: e1[0], e1y: e1[1], e1z: e1[2], h0, h1, m });
  }
  // sword in world coords: base = pommel end, d = unit direction toward the tip
  function addSword(bx, by, bz, d, L, hw, o) {
    o = o || {};
    d = norm3(d);
    const bs = basis(d[0], d[1], d[2]);
    const roll = o.roll !== undefined ? o.roll : rnd() * TAU;
    let e = norm3([bs[0] * cos(roll) + bs[3] * sin(roll), bs[1] * cos(roll) + bs[4] * sin(roll), bs[2] * cos(roll) + bs[5] * sin(roll)]);
    if (o.e) e = norm3(o.e);
    const g = 0.17 + 0.05 * L;
    const G = [bx + d[0] * g, by + d[1] * g, bz + d[2] * g];
    const m = o.m !== undefined ? o.m : (rnd() < 0.62 ? 0 : rnd() < 0.6 ? 1 : 2);
    const hilt = o.hilt !== undefined ? o.hilt : 0;
    if (hilt === 1 || hilt === 2) {
      const hm = hilt === 2 ? 3 : 4;
      CAP.push({ ax: bx, ay: by, az: bz, bx: G[0], by: G[1], bz: G[2], r: 0.024, m: hm });
      const cg = 0.12 + 0.07 * rnd();
      CAP.push({ ax: G[0] - e[0] * cg, ay: G[1] - e[1] * cg, az: G[2] - e[2] * cg, bx: G[0] + e[0] * cg, by: G[1] + e[1] * cg, bz: G[2] + e[2] * cg, r: 0.026, m: hm });
      SPH.push({ x: bx - d[0] * 0.02, y: by - d[1] * 0.02, z: bz - d[2] * 0.02, r: 0.042, m: hm });
    } else if (hilt === 3) {
      SPH.push({ x: G[0], y: G[1], z: G[2], r: 0.07 + 0.06 * rnd(), m: 4 });
    }
    const twist = o.twist || 0;
    const kink = o.kink || 0;
    // blade: up to two straight pieces, each a full-width section and a tapering point
    let P = G, dd = d, ee = e, rem = L;
    const pieces = [];
    if (kink) {
      const at = o.kinkAt || rr(0.35, 0.6);
      pieces.push([L * at, 0]);
      pieces.push([L * (1 - at), 1]);
    } else pieces.push([L, 1]);
    for (let pi = 0; pi < pieces.length; pi++) {
      const len = pieces[pi][0], last = pieces[pi][1];
      const tw = twist * len / L;
      if (last) {
        const k1 = len * 0.78;
        const P1 = [P[0] + dd[0] * k1, P[1] + dd[1] * k1, P[2] + dd[2] * k1];
        const e1 = rotAxis(ee[0], ee[1], ee[2], dd[0], dd[1], dd[2], tw * 0.78);
        const P2 = [P[0] + dd[0] * len, P[1] + dd[1] * len, P[2] + dd[2] * len];
        const e2 = rotAxis(ee[0], ee[1], ee[2], dd[0], dd[1], dd[2], tw);
        const hA = pi === 0 ? hw : hw * 0.92;
        pushSeg(P, P1, ee, e1, hA, hA * 0.8, m);
        pushSeg(P1, P2, e1, e2, hA * 0.8, 0, m);
      } else {
        const P1 = [P[0] + dd[0] * len, P[1] + dd[1] * len, P[2] + dd[2] * len];
        const e1 = rotAxis(ee[0], ee[1], ee[2], dd[0], dd[1], dd[2], tw);
        pushSeg(P, P1, ee, e1, hw, hw * 0.92, m);
        // bend for the next piece
        let ax = o.kinkAxis;
        if (!ax) { const b2 = basis(dd[0], dd[1], dd[2]); const a = rnd() * TAU; ax = [b2[0] * cos(a) + b2[3] * sin(a), b2[1] * cos(a) + b2[4] * sin(a), b2[2] * cos(a) + b2[5] * sin(a)]; }
        else { // project to perpendicular
          const dp = ax[0] * dd[0] + ax[1] * dd[1] + ax[2] * dd[2];
          ax = norm3([ax[0] - dd[0] * dp, ax[1] - dd[1] * dp, ax[2] - dd[2] * dp]);
        }
        const nd = norm3(rotAxis(dd[0], dd[1], dd[2], ax[0], ax[1], ax[2], kink));
        ee = norm3(rotAxis(e1[0], e1[1], e1[2], ax[0], ax[1], ax[2], kink));
        if (o.blob !== false) SPH.push({ x: P1[0], y: P1[1], z: P1[2], r: hw * 1.25, m: 4 });
        P = P1; dd = nd;
        rem -= len;
      }
    }
  }

  /* ================================================================ the throne */
  // local throne coords: x right, y up from the dais top, z toward the front
  const tw = (x, y, z) => [x * TS, y * TS + TY, z * TS + TZ];
  function swordL(x, y, z, d, L, hw, o) { const p = tw(x, y, z); addSword(p[0], p[1], p[2], d, L * TS, hw * TS, o); }
  function hiltPick(pIron, pGold) { const r = rnd(); return r < pGold ? 2 : r < pGold + pIron ? 1 : 0; }
  function buildThrone() {
    RS = 0x5eed1 + SEED * 101;
    const B = (x0, y0, z0, x1, y1, z1, m) => { const a = tw(x0, y0, z0), b = tw(x1, y1, z1); BOX.push([a[0], a[1], a[2], b[0], b[1], b[2], m]); };
    B(-1.1, 0, -0.95, 1.1, 2.1, 0.75, 0);        // body
    B(-0.95, 2.1, -0.95, 0.95, 3.9, -0.55, 0);   // back slab
    B(0.72, 2.1, -0.55, 1.1, 2.5, 0.85, 0);      // arms
    B(-1.1, 2.1, -0.55, -0.72, 2.5, 0.85, 0);
    for (let k = 0; k < 7; k++) B(-0.5, 0, 0.75, 0.5, (k + 1) * 0.3, 0.75 + (7 - k) * 0.2, 1); // iron stair
    // stair treads: swords laid across
    for (let k = 0; k < 7; k++) {
      const zf = 0.75 + (7 - k) * 0.2;
      for (let j = 0; j < 3; j++) {
        if (k === 6 && j > 0) break;
        const s = (k + j) % 2 ? 1 : -1;
        swordL(-s * rr(0.62, 0.8), (k + 1) * 0.3 + 0.018, zf - 0.035 - j * 0.065, [s, rr(-0.02, 0.03), rr(-0.08, 0.08)], rr(1.0, 1.35), 0.04,
          { e: [0, 0, 1], hilt: rnd() < 0.7 ? (rnd() < 0.3 ? 2 : 1) : 3 });
      }
      // jagged points along the stair cheeks
      for (const s of [-1, 1]) if (rnd() < 0.8) {
        swordL(s * 0.52, (k + 0.5) * 0.3, zf - 0.12, [s * rr(0.6, 1), rr(-0.5, 0.4), rr(-0.2, 0.5)], rr(0.4, 0.8), 0.035, { hilt: 0 });
      }
    }
    // seat: blades across
    for (let j = 0; j < 7; j++) swordL(rr(-0.95, -0.8), 2.115, -0.48 + j * 0.18, [1, 0, rr(-0.04, 0.04)], rr(1.6, 1.8), 0.05, { e: [0, 0, 1], hilt: 0, m: rnd() < 0.5 ? 0 : 2 });
    // inner back: two rows of upright blades
    for (let row = 0; row < 2; row++) {
      const n = row ? 12 : 13;
      for (let i = 0; i < n; i++) {
        const x = -0.66 + (i + row * 0.5) * 0.11;
        const bump = 1 + 0.55 * Math.exp(-(((x + 0.25) / 0.35) ** 2));
        swordL(x, 1.95, -0.5 - row * 0.13, [x * 0.16, 1, -0.07 - row * 0.05], (1.55 + rnd() * 0.35) * bump + row * 0.35, 0.056,
          { e: [1, 0, 0.1 * gauss()], hilt: 0, m: rnd() < 0.7 ? 0 : 3, twist: rnd() < 0.25 ? gauss() * 0.6 : 0 });
      }
    }
    // the crown: rays of fused swords fanning from behind the seat, taller on the left
    const prof = (x) => 1.0 + 2.1 * Math.exp(-(((x + 0.38) / 0.42) ** 2)) + 1.2 * Math.exp(-(((x - 0.52) / 0.3) ** 2)) + 0.45 * Math.exp(-(((x - 0.06) / 0.18) ** 2));
    const crownLen = (a) => 1.3 + 2.5 * Math.exp(-(((a + 0.3) / 0.32) ** 2)) + 1.4 * Math.exp(-(((a - 0.42) / 0.2) ** 2)) + 0.7 * Math.exp(-(((a + 0.95) / 0.18) ** 2)) + 0.5 * Math.exp(-(((a - 0.95) / 0.15) ** 2));
    const chain = (x, y, z, a, tilt, len, hw0, layer) => {
      // a ray of swords welded end to end, each a little askew
      let px = x, py = y, pz = z, got = 0, k = 0;
      while (got < len - 0.25 && k < 5) {
        const aa = a + gauss() * 0.07, tt = tilt + gauss() * 0.06;
        const d = [sin(aa) * cos(tt), cos(aa) * cos(tt), -sin(tt)];
        const L = Math.min(len - got + 0.15, rr(0.95, 1.5));
        const hw = hw0 * (1 - 0.12 * k);
        swordL(px, py, pz, d, L, hw, {
          hilt: k === 0 ? (rnd() < 0.4 ? 3 : 0) : hiltPick(0.45, 0.22), twist: rnd() < 0.35 ? gauss() * 1.1 : 0,
          kink: rnd() < 0.1 ? rr(0.15, 0.35) : 0, m: rnd() < 0.08 ? 3 : undefined, roll: layer === 0 ? rr(-0.5, 0.5) : undefined,
        });
        const adv = (0.17 + 0.05 * L) / TS + L * rr(0.62, 0.8);
        px += d[0] * adv; py += d[1] * adv; pz += d[2] * adv; got += adv; k++;
      }
    };
    const NR = 38;
    for (let r = 0; r < NR; r++) {
      const a = -1.32 + 2.55 * (r + 0.5) / NR + gauss() * 0.03;
      const len = crownLen(a) * (0.8 + 0.4 * rnd());
      const ox = 0.55 * sin(a), oy = 2.45 + 0.55 * cos(a);
      chain(ox, oy, -0.72 - rr(0, 0.12), a, 0.12 + 0.12 * abs(a), len, rr(0.045, 0.06), 0);
      const nc = 2 + fl(rnd() * 3);
      for (let c = 0; c < nc; c++) {
        const lay = 1 + fl(rnd() * 2);
        chain(ox + gauss() * 0.08, oy - rr(0, 0.35), -0.72 - 0.16 * lay, a + gauss() * 0.11, 0.18 + 0.1 * lay + 0.1 * abs(a), len * rr(0.45, 0.85), rr(0.036, 0.05), lay);
      }
    }
    // filler: short spikes bristling over the back slab
    for (let i = 0; i < 70; i++) {
      const x0 = rr(-0.95, 0.95), y0 = rr(2.3, 3.9);
      const psi = x0 * 0.9 + gauss() * 0.3;
      swordL(x0, y0, rr(-0.95, -0.6), [sin(psi), cos(psi), -rr(0.1, 0.6)], rr(0.5, 1.1), rr(0.032, 0.05), {
        hilt: hiltPick(0.15, 0.08), twist: rnd() < 0.3 ? gauss() : 0, kink: rnd() < 0.15 ? rr(0.2, 0.5) : 0,
      });
    }
    // wings
    for (let i = 0; i < 26; i++) { // left: high and big
      const a = rr(0.1, 1.2);
      swordL(rr(-1.1, -0.85), rr(2.8, 4.0), rr(-0.95, -0.55), [-cos(a), sin(a), rr(-0.4, 0.15)], rr(1.2, 2.2), rr(0.04, 0.06), {
        hilt: hiltPick(0.25, 0.1), kink: rnd() < 0.3 ? rr(0.25, 0.6) : 0, kinkAxis: [0, 0, 1], twist: rnd() < 0.3 ? gauss() : 0,
      });
    }
    for (let i = 0; i < 18; i++) { // right: lower, broken, drooping
      const a = rr(-0.15, 0.9);
      swordL(rr(0.85, 1.1), rr(2.6, 3.5), rr(-0.95, -0.55), [cos(a), sin(a), rr(-0.4, 0.2)], rr(0.8, 1.6), rr(0.04, 0.06), {
        hilt: hiltPick(0.25, 0.1), kink: rnd() < 0.5 ? rr(0.3, 0.7) : 0, kinkAxis: [0, 0, 1], twist: rnd() < 0.3 ? gauss() : 0,
      });
    }
    // arms
    for (const s of [-1, 1]) {
      for (let j = 0; j < 8; j++) {
        swordL(s * (0.76 + 0.045 * j), 2.17 + 0.05 * j + rr(-0.02, 0.02), -0.55 + rr(0, 0.25), [s * rr(0.03, 0.28), rr(-0.18, 0.12), 1], rr(1.35, 1.9), 0.046,
          { roll: rr(-0.3, 0.3) + (rnd() < 0.5 ? 0 : 1.57), hilt: 0, m: rnd() < 0.2 ? 3 : undefined, twist: rnd() < 0.3 ? gauss() * 0.8 : 0 });
      }
      for (let j = 0; j < 6; j++) { // claws at the arm ends
        swordL(s * rr(0.8, 1.05), rr(2.25, 2.5), rr(0.75, 0.9), [s * rr(0.2, 0.8), rr(-0.9, 0.1), rr(0.3, 1)], rr(0.55, 1.1), 0.04,
          { hilt: hiltPick(0.3, 0.2), kink: rnd() < 0.5 ? rr(0.3, 0.7) : 0, kinkAxis: [s, 0, 0] });
      }
      for (let j = 0; j < 5; j++) { // frozen drips
        let x = s * rr(0.76, 1.08), z = rr(0.0, 0.85), y = 2.08, r = rr(0.05, 0.07);
        const n = 3 + fl(rnd() * 5);
        for (let q = 0; q < n; q++) { const p = tw(x, y, z); SPH.push({ x: p[0], y: p[1], z: p[2], r: r * TS, m: 4 }); y -= r * 1.4; r *= 0.82; }
      }
    }
    // spikes from the body and the back
    for (let i = 0; i < 175; i++) {
      const f = i >= 120 ? 0.56 + 0.29 * rnd() : rnd();
      let x, y, z, n;
      if (f < 0.3) { x = -1.1; y = rr(0.2, 2.4); z = rr(-0.9, 0.7); n = [-1, 0, 0]; }
      else if (f < 0.55) { x = 1.1; y = rr(0.2, 2.4); z = rr(-0.9, 0.7); n = [1, 0, 0]; }
      else if (f < 0.85) { x = rr(-0.95, 0.95); y = rr(0.2, 3.8); z = -0.95; n = [0, 0, -1]; }
      else { x = (rnd() < 0.5 ? -1 : 1) * rr(0.72, 1.1); y = rr(0.1, 2.0); z = 0.75; n = [0, 0, 1]; }
      const d = norm3([n[0] + gauss() * 0.75, n[1] + gauss() * 0.75 + 0.15, n[2] + gauss() * 0.75]);
      const L = rr(0.45, 1.3) * (x < 0 ? 1.15 : 0.95);
      const g = 0.17 + 0.05 * L;
      swordL(x - d[0] * g * 0.7, y - d[1] * g * 0.7, z - d[2] * g * 0.7, d, L, rr(0.032, 0.05), {
        hilt: rnd() < 0.25 ? 3 : hiltPick(0.25, 0.08), twist: rnd() < 0.3 ? gauss() : 0, kink: rnd() < 0.2 ? rr(0.2, 0.6) : 0,
      });
    }
    // melted blobs on the body edges
    for (let i = 0; i < 46; i++) {
      const e = fl(rnd() * 6);
      let x, y, z;
      if (e === 0) { x = rnd() < 0.5 ? -1.1 : 1.1; y = 2.1; z = rr(-0.95, 0.75); }
      else if (e === 1) { x = rr(-1.1, 1.1); y = 2.1; z = -0.95; }
      else if (e === 2) { x = rnd() < 0.5 ? -1.1 : 1.1; y = rr(0, 2.1); z = rnd() < 0.5 ? -0.95 : 0.75; }
      else if (e === 3) { x = rnd() < 0.5 ? -0.95 : 0.95; y = rr(2.1, 3.9); z = -0.55; }
      else if (e === 4) { x = rr(-1.1, 1.1); y = 0.02; z = rr(-0.95, 0.75); }
      else { x = rnd() < 0.5 ? -0.91 : 0.91; y = 2.5; z = rr(-0.5, 0.85); }
      const p = tw(x, y, z);
      SPH.push({ x: p[0], y: p[1], z: p[2], r: rr(0.06, 0.15) * TS, m: 4 });
    }
    // swords stuck in the dais top, hilts up, and a few fallen
    let placed = 0, guard = 0;
    while (placed < 44 && guard++ < 2000) {
      const a = rnd() * TAU, r = rr(1.35, 2.7) / TS;
      const x = r * cos(a), z = (r * sin(a) * TS - TZ) / TS;
      if (abs(x) < 0.85 && z > 0.6) continue;
      if (abs(x) < 1.25 && z > -1.1 && z < 0.9) continue;
      const up = norm3([rr(-0.45, 0.45), 1, rr(-0.45, 0.45)]);
      const L = rr(0.6, 1.05), g = 0.17 + 0.05 * L;
      const tip = [x, -0.08, z];
      const base = [tip[0] + up[0] * (L + g), tip[1] + up[1] * (L + g), tip[2] + up[2] * (L + g)];
      swordL(base[0], base[1], base[2], [-up[0], -up[1], -up[2]], L, rr(0.035, 0.05), { hilt: rnd() < 0.3 ? 2 : 1, twist: rnd() < 0.3 ? gauss() * 0.5 : 0 });
      placed++;
    }
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TAU, r = rr(1.5, 2.7) / TS, x = r * cos(a), z = (r * sin(a) * TS - TZ) / TS;
      if (abs(x) < 1.0 && z > 0.5) continue;
      const da = rnd() * TAU;
      swordL(x, 0.03, z, [cos(da), 0.02, sin(da)], rr(0.7, 1.1), 0.042, { e: [-sin(da), 0, cos(da)], hilt: rnd() < 0.5 ? 1 : 2 });
    }
  }

  /* ================================================================ candles and stands */
  const RING_A = [], RING_B = [], RING_C = [], DAIS_L = [];
  function addCandle(x, y, z, hc, big) {
    CAP.push({ ax: x, ay: y, az: z, bx: x, by: y + hc, bz: z, r: big ? 0.05 : 0.034, m: 6, wax: 1 });
    FLM.push({ x, y: y + hc + 0.045, z, s: big ? 1.15 : 1, ph0: rnd() * TAU, ph1: rnd() * TAU, ph2: rnd() * TAU, n: 1 + fl(rnd() * 3) });
  }
  function addStand(x, z, h, tiers, y0, thick) {
    y0 = y0 || 0; thick = thick || 1;
    CAP.push({ ax: x, ay: y0, az: z, bx: x, by: y0 + h, bz: z, r: 0.045 * thick, m: 5 });
    for (let f = 0; f < 3; f++) { const a = f * TAU / 3 + rnd(); CAP.push({ ax: x, ay: y0 + 0.35 * thick, az: z, bx: x + 0.36 * thick * cos(a), by: y0 + 0.02, bz: z + 0.36 * thick * sin(a), r: 0.03 * thick, m: 5 }); }
    for (let k = 0; k < tiers.length; k++) {
      const rho = tiers[k][0], yy = tiers[k][1] + y0, n = tiers[k][2];
      const seg = 10, a0 = rnd() * TAU;
      for (let s = 0; s < seg; s++) {
        const a = a0 + s * TAU / seg, b = a0 + (s + 1) * TAU / seg;
        CAP.push({ ax: x + rho * cos(a), ay: yy, az: z + rho * sin(a), bx: x + rho * cos(b), by: yy, bz: z + rho * sin(b), r: 0.02, m: 5 });
      }
      for (let s = 0; s < 3; s++) { const a = a0 + s * TAU / 3 + 0.3; CAP.push({ ax: x, ay: yy - 0.18, az: z, bx: x + rho * cos(a), by: yy, bz: z + rho * sin(a), r: 0.018, m: 5 }); }
      for (let c = 0; c < n; c++) { const a = a0 + (c + 0.5) * TAU / n; addCandle(x + rho * cos(a), yy, z + rho * sin(a), rr(0.1, 0.24), false); }
    }
    addCandle(x, h + y0, z, rr(0.16, 0.26), true);
  }
  function buildCandles() {
    RS = 0xca9d1e + SEED * 13;
    for (let k = 0; k < 8; k++) { // ring A, around the dais
      const a = (k + 0.5) * TAU / 8, x = 6.6 * cos(a), z = 6.6 * sin(a);
      addStand(x, z, 1.8, [[0.5, 1.15, 10], [0.34, 1.45, 7], [0.18, 1.68, 4]]);
      RING_A.push(addLight(x, 1.55, z, 1.6, 2.2, 7));
    }
    for (let k = 0; k < 12; k++) { // ring B, low trees between the pillars and the camera path
      const a = (k + 0.5) * TAU / 12, x = 11.2 * cos(a), z = 11.2 * sin(a);
      addStand(x, z, 1.45, [[0.45, 0.95, 9], [0.3, 1.2, 6], [0.15, 1.38, 3]]);
      RING_B.push(addLight(x, 1.3, z, 1.35, 2.0, 6.5));
    }
    for (let k = 0; k < WIN_N; k++) { // ring C, under each window
      const a = (k + 0.5) * TAU / WIN_N, x = 20.2 * cos(a), z = 20.2 * sin(a);
      addStand(x, z, 2.2, [[0.42, 1.75, 8], [0.25, 2.0, 5]]);
      RING_C.push(addLight(x, 2.0, z, 1.45, 2.4, 7));
    }
    // four great candle trees on the dais, flanking the throne
    for (const a of [0.62, Math.PI - 0.62, Math.PI + 0.75, -0.75]) {
      const x = 2.62 * cos(a), z = 2.62 * sin(a);
      addStand(x, z, 2.7, [[0.44, 1.95, 9], [0.3, 2.3, 6], [0.17, 2.55, 4]], TY, 1.3);
      DAIS_L.push(addLight(x, TY + 2.4, z, 1.15, 2.0, 7));
    }
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; DAIS_L.push(addLight(4.0 * cos(a), 0.9, 4.0 * sin(a), 0.75, 1.8, 5)); }
    // candles along the dais treads
    for (let s = 0; s < 4; s++) {
      const ap = DAIS_A[s] - 0.2, y = (s + 1) * STEP_H, side = 2 * ap * Math.tan(Math.PI / 8);
      const per = Math.max(2, fl(side / 0.62));
      for (let f = 0; f < 8; f++) {
        const fa = f * TAU / 8, nx = cos(fa), nz = sin(fa), tx = -nz, tz = nx;
        for (let c = 0; c < per; c++) {
          if (rnd() < 0.3) continue;
          const o = (c + 0.5) / per - 0.5;
          const x = nx * ap + tx * o * side, z = nz * ap + tz * o * side;
          if (abs(x) < 0.9 && z > 0) continue;
          addCandle(x, y, z, rr(0.12, 0.38), rnd() < 0.3);
        }
      }
    }
  }

  /* ================================================================ pillars, banners, shafts, dust */
  function buildHall() {
    RS = 0xba77e5 + SEED * 7;
    for (let k = 0; k < 6; k++) { const a = (k + 0.5) * TAU / 6; PIL.push({ x: 9.0 * cos(a), z: 9.0 * sin(a), r: 0.5, top: VAULT_Y, inner: 1 }); }
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; PIL.push({ x: 17.6 * cos(a), z: 17.6 * sin(a), r: 0.95, top: VAULT_Y, inner: 0 }); }
    for (const p of PIL) {
      p.lights = [];
      for (let k = 0; k < LX.length; k++) if (Math.hypot(LX[k] - p.x, LZ[k] - p.z) < sqrt(LRM2[k]) + p.r) p.lights.push(k);
      p.lights = nearestLights(p.lights, p.x, p.z, 4);
    }
    // banners: field, charge, shape
    const SCHEMES = [
      [[0.60, 0.10, 0.13], [0.86, 0.64, 0.26]], // crimson / gold
      [[0.10, 0.36, 0.22], [0.82, 0.80, 0.70]], // emerald / bone
      [[0.13, 0.22, 0.58], [0.86, 0.64, 0.26]], // sapphire / gold
      [[0.34, 0.15, 0.46], [0.82, 0.80, 0.70]], // amethyst / bone
      [[0.78, 0.55, 0.18], [0.08, 0.07, 0.09]], // gold / sable
      [[0.08, 0.075, 0.09], [0.66, 0.12, 0.13]], // sable / crimson
      [[0.10, 0.36, 0.38], [0.86, 0.64, 0.26]], // teal / gold
      [[0.80, 0.76, 0.66], [0.13, 0.22, 0.58]], // bone / sapphire
    ];
    const addBanner = (a, r, top, L, w, k, shape) => {
      const lights = [];
      const bx = r * cos(a), bz = r * sin(a);
      for (let q = 0; q < LX.length; q++) if (Math.hypot(LX[q] - bx, LZ[q] - bz) < sqrt(LRM2[q]) + 0.5) lights.push(q);
      BAN.push({
        cx: bx, cy: top, cz: bz, tx: -sin(a), tz: cos(a), nx: -cos(a), nz: -sin(a), L, hw: w / 2,
        f: SCHEMES[k % 8][0], c: SCHEMES[k % 8][1], shape, tail: k % 3,
        n1: 1 + fl(rnd() * 2), n2: 3 + fl(rnd() * 2), n3: 5 + fl(rnd() * 3), p1: rnd() * TAU, p2: rnd() * TAU, p3: rnd() * TAU, p4: rnd() * TAU,
        lights,
      });
      CAP.push({ ax: bx - sin(a) * (w / 2 + 0.15), ay: top + 0.05, az: bz + cos(a) * (w / 2 + 0.15), bx: bx + sin(a) * (w / 2 + 0.15), by: top + 0.05, bz: bz - cos(a) * (w / 2 + 0.15), r: 0.05, m: 3 });
    };
    for (let k = 0; k < 16; k++) addBanner(k * TAU / 16, 16.45, 18.2, 11.6, 2.0, k, k % 9);
    for (let k = 0; k < 6; k++) addBanner((k + 0.5) * TAU / 6, 8.3, 17.0, 7.6, 1.5, k + 3, (k * 4 + 2) % 9);
    // shafts
    for (let k = 0; k <= 2; k++) {
      const phi = (k + 0.5) * TAU / WIN_N;
      const c = [WALL_R * cos(phi), (WIN_Y0 + WIN_Y1) / 2, WALL_R * sin(phi)];
      const T = [-sin(phi), 0, cos(phi)], U = [0, 1, 0], S = [SX, SY, SZ];
      // inverse of the matrix with columns T, U, S
      const m = [[T[0], U[0], S[0]], [T[1], U[1], S[1]], [T[2], U[2], S[2]]];
      const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const inv = [
        [(m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det],
        [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det, (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det],
        [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det, (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det, (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det],
      ];
      const dphi = Math.atan2(sin(phi - SUN_PHI), cos(phi - SUN_PHI));
      const I = Math.pow(cos(dphi), 2.2) * (k === 1 ? 1.0 : 0.85);
      SHAFT.push({ cx: c[0], cy: c[1], cz: c[2], m: Float64Array.from([inv[0][0], inv[0][1], inv[0][2], inv[1][0], inv[1][1], inv[1][2], inv[2][0], inv[2][1], inv[2][2]]), u0: 0, v0: 0, l0: 0, hw: WIN_HW * 0.96, vmin: WIN_Y0 - c[1], vmax: WIN_Y1 - c[1] + WIN_ARCH * 0.6, I });
    }
    // dust in the shafts
    RS = 0xd057 + SEED;
    for (let i = 0; i < 1900; i++) {
      const s = fl(rnd() * SHAFT.length), sh = SHAFT[s];
      const u = rr(-sh.hw, sh.hw), v = rr(sh.vmin, sh.vmax);
      const lmax = (sh.cy + v) / -SY;
      const lam = Math.pow(rnd(), 0.8) * lmax;
      DUST.push({
        s, u, v, lam, sr: rr(0.08, 0.55), sn: 1 + fl(rnd() * 3), sp: rnd() * TAU, ln: 1 + fl(rnd() * 2), la: rr(0.3, 1.4), lp: rnd() * TAU,
        vn: 1 + fl(rnd() * 3), va: rr(0.1, 0.5), vp: rnd() * TAU, tn: 3 + fl(rnd() * 8), tp: rnd() * TAU, b: rr(0.4, 1.0),
      });
    }
  }

  /* ================================================================ sun shadow map (baked once) */
  const SAX = -SZ / Math.hypot(SX, SZ), SAY = 0, SAZ = SX / Math.hypot(SX, SZ); // A = perpendicular to S, horizontal
  const SBX = SAY * SZ - SAZ * SY, SBY = SAZ * SX - SAX * SZ, SBZ = SAX * SY - SAY * SX; // B = A × S
  const SMR = 0.032;
  let SMW = 0, SMH = 0, SMA0 = 0, SMB0 = 0, SM = null;
  let RD_T = 0, RD_NX = 0, RD_NY = 0, RD_NZ = 0, RD_S = 0;
  function rayDais(ox, oy, oz, dx, dy, dz) { // nearest hit into RD_*; returns true on a hit
    let bt = 1e9, bs = -1, bnx = 0, bny = 0, bnz = 0;
    for (let s = 0; s < 5; s++) {
      const a = DAIS_A[s], top = (s + 1) * STEP_H;
      let t0 = -1e9, t1 = 1e9, nx = 0, ny = 0, nz = 0;
      // y slab
      if (abs(dy) < 1e-9) { if (oy < 0 || oy > top) continue; }
      else {
        let ta = (0 - oy) / dy, tb = (top - oy) / dy, sgn = -1;
        if (ta > tb) { const q = ta; ta = tb; tb = q; sgn = 1; }
        if (ta > t0) { t0 = ta; nx = 0; ny = sgn; nz = 0; }
        if (tb < t1) t1 = tb;
      }
      let ok = true;
      for (let q = 0; q < 4; q++) {
        const cx = OCT[q][0], cz = OCT[q][1];
        const po = ox * cx + oz * cz, pd = dx * cx + dz * cz;
        if (abs(pd) < 1e-9) { if (po < -a || po > a) { ok = false; break; } continue; }
        let ta = (-a - po) / pd, tb = (a - po) / pd, sgn = -1;
        if (ta > tb) { const w = ta; ta = tb; tb = w; sgn = 1; }
        if (ta > t0) { t0 = ta; nx = cx * sgn; ny = 0; nz = cz * sgn; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (!ok || t0 > t1 || t1 < 0) continue;
      if (t0 > 0 && t0 < bt) { bt = t0; bnx = nx; bny = ny; bnz = nz; bs = s; }
    }
    if (bs < 0) return false;
    RD_T = bt; RD_NX = bnx; RD_NY = bny; RD_NZ = bnz; RD_S = bs;
    return true;
  }
  function rayBoxes(ox, oy, oz, dx, dy, dz, tmax) {
    let bt = tmax, bn = -1, bax = 0, bsg = 0;
    for (let b = 0; b < BOX.length; b++) {
      const q = BOX[b];
      let t0 = -1e9, t1 = 1e9, ax = -1, sg = 0;
      // x
      if (abs(dx) < 1e-9) { if (ox < q[0] || ox > q[3]) continue; } else {
        let ta = (q[0] - ox) / dx, tb = (q[3] - ox) / dx, s = -1; if (ta > tb) { const w = ta; ta = tb; tb = w; s = 1; }
        if (ta > t0) { t0 = ta; ax = 0; sg = s; } if (tb < t1) t1 = tb;
      }
      if (abs(dy) < 1e-9) { if (oy < q[1] || oy > q[4]) continue; } else {
        let ta = (q[1] - oy) / dy, tb = (q[4] - oy) / dy, s = -1; if (ta > tb) { const w = ta; ta = tb; tb = w; s = 1; }
        if (ta > t0) { t0 = ta; ax = 1; sg = s; } if (tb < t1) t1 = tb;
      }
      if (abs(dz) < 1e-9) { if (oz < q[2] || oz > q[5]) continue; } else {
        let ta = (q[2] - oz) / dz, tb = (q[5] - oz) / dz, s = -1; if (ta > tb) { const w = ta; ta = tb; tb = w; s = 1; }
        if (ta > t0) { t0 = ta; ax = 2; sg = s; } if (tb < t1) t1 = tb;
      }
      if (t0 <= t1 && t0 > 0 && t0 < bt) { bt = t0; bn = b; bax = ax; bsg = sg; }
    }
    RB_T = bt; RB_I = bn; RB_AX = bax; RB_SG = bsg;
    return bn;
  }
  let RB_T = 0, RB_I = -1, RB_AX = 0, RB_SG = 0;
  function buildShadowMap() {
    // bounds from the dais and the throne
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    const acc = (x, y, z) => { const a = x * SAX + y * SAY + z * SAZ, b = x * SBX + y * SBY + z * SBZ; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b; };
    for (let i = 0; i < 16; i++) { const an = i * TAU / 16, r = DAIS_A[0] / cos(Math.PI / 8); acc(r * cos(an), 0, r * sin(an)); acc(r * cos(an), TY, r * sin(an)); }
    for (const s of SEG) { acc(s.ax, s.ay, s.az); acc(s.bx, s.by, s.bz); }
    a0 -= 0.3; b0 -= 0.3; a1 += 0.3; b1 += 0.3;
    SMA0 = a0; SMB0 = b0; SMW = Math.ceil((a1 - a0) / SMR); SMH = Math.ceil((b1 - b0) / SMR);
    SM = new Float32Array(SMW * SMH).fill(1e9);
    // dais and boxes: a ray along S per texel
    for (let j = 0; j < SMH; j++) for (let i = 0; i < SMW; i++) {
      const a = SMA0 + (i + 0.5) * SMR, b = SMB0 + (j + 0.5) * SMR;
      const ox = SAX * a + SBX * b - SX * 60, oy = SAY * a + SBY * b - SY * 60, oz = SAZ * a + SBZ * b - SZ * 60;
      let best = 1e9;
      if (rayDais(ox, oy, oz, SX, SY, SZ)) best = RD_T;
      if (rayBoxes(ox, oy, oz, SX, SY, SZ, best) >= 0) best = RB_T;
      if (best < 1e9) SM[j * SMW + i] = best - 60; // depth along S relative to the plane through the origin
    }
    const splat = (x, y, z, rad) => {
      const a = x * SAX + y * SAY + z * SAZ, b = x * SBX + y * SBY + z * SBZ, d = x * SX + y * SY + z * SZ;
      const ci = (a - SMA0) / SMR, cj = (b - SMB0) / SMR, rp = Math.max(0.7, rad / SMR);
      for (let j = Math.max(0, fl(cj - rp)); j <= Math.min(SMH - 1, Math.ceil(cj + rp)); j++)
        for (let i = Math.max(0, fl(ci - rp)); i <= Math.min(SMW - 1, Math.ceil(ci + rp)); i++) {
          const di = i + 0.5 - ci, dj = j + 0.5 - cj;
          if (di * di + dj * dj > rp * rp) continue;
          const k = j * SMW + i; if (d < SM[k]) SM[k] = d;
        }
    };
    for (const s of SEG) {
      const L = Math.hypot(s.bx - s.ax, s.by - s.ay, s.bz - s.az), n = Math.max(2, Math.ceil(L / 0.016));
      for (let q = 0; q <= n; q++) { const u = q / n; splat(s.ax + (s.bx - s.ax) * u, s.ay + (s.by - s.ay) * u, s.az + (s.bz - s.az) * u, (s.h0 + (s.h1 - s.h0) * u) * 0.8); }
    }
    for (const c of CAP) {
      if (c.m === 5 || c.m === 6) continue;
      if (Math.hypot(c.ax, c.az) > 6) continue;
      const L = Math.hypot(c.bx - c.ax, c.by - c.ay, c.bz - c.az), n = Math.max(2, Math.ceil(L / 0.016));
      for (let q = 0; q <= n; q++) { const u = q / n; splat(c.ax + (c.bx - c.ax) * u, c.ay + (c.by - c.ay) * u, c.az + (c.bz - c.az) * u, c.r); }
    }
    for (const s of SPH) if (Math.hypot(s.x, s.z) < 6) splat(s.x, s.y, s.z, s.r);
  }
  function shadowAt(x, y, z) {
    const a = x * SAX + y * SAY + z * SAZ, b = x * SBX + y * SBY + z * SBZ;
    const i = fl((a - SMA0) / SMR), j = fl((b - SMB0) / SMR);
    if (i < 0 || j < 0 || i >= SMW || j >= SMH) return 1;
    const d = x * SX + y * SY + z * SZ;
    return d > SM[j * SMW + i] + 0.07 ? 0 : 1;
  }
  function pillarShadow(x, z) {
    for (let k = 0; k < PIL.length; k++) {
      const p = PIL[k], qx = p.x - x, qz = p.z - z;
      const pr = qx * SHX + qz * SHZ;
      if (pr < 0.05) continue;
      const pp = qx * qx + qz * qz - pr * pr, r = p.r - 0.03;
      if (pp < r * r) return true;
    }
    return false;
  }
  // irradiance factor of the sun at a surface point (0..~1)
  function sunAt(x, y, z) {
    let best = 0;
    for (let s = 0; s < SHAFT.length; s++) {
      const sh = SHAFT[s], m = sh.m, qx = x - sh.cx, qy = y - sh.cy, qz = z - sh.cz;
      const u = m[0] * qx + m[1] * qy + m[2] * qz;
      const au = abs(u); if (au > sh.hw) continue;
      const v = m[3] * qx + m[4] * qy + m[5] * qz;
      const vtop = sh.vmax - WIN_ARCH * 0.6 * (au / sh.hw) * (au / sh.hw);
      if (v < sh.vmin || v > vtop) continue;
      const l = m[6] * qx + m[7] * qy + m[8] * qz;
      if (l < 0) continue;
      const e = Math.min(1, (sh.hw - au) * 4) * Math.min(1, (v - sh.vmin) * 3) * Math.min(1, (vtop - v) * 3) * sh.I;
      if (e > best) best = e;
    }
    if (best <= 0) return 0;
    if (!shadowAt(x, y, z)) return 0;
    if (pillarShadow(x, z)) return 0;
    return best;
  }

  /* ================================================================ camera */
  let OX = 0, OY = 0, OZ = 0, FX = 0, FY = 0, FZ = 0, RX = 0, RY = 0, RZ = 0, UX = 0, UY = 0, UZ = 0;
  let CAM = null;
  function camAt(t) {
    const th = TH0 + TAU * t / D;
    const rc = RC + 0.45 * wave(2, t, 0.4);
    const hc = HC + 0.35 * wave(1, t, 2.1) + 0.12 * wave(3, t, 0.3);
    const cx = rc * sin(th), cz = rc * cos(th);
    const tx = 0.35 * wave(1, t, 1.0), ty = TGY + 0.25 * wave(2, t, 1.7), tz = TZ * 0.4;
    let fx = tx - cx, fy = ty - hc, fz = tz - cz;
    const fl_ = Math.hypot(fx, fy, fz); fx /= fl_; fy /= fl_; fz /= fl_;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    return { ox: cx, oy: hc, oz: cz, fx, fy, fz, rx, ry: 0, rz, ux, uy, uz };
  }
  function useCam(c, mirror) {
    OX = c.ox; OY = mirror ? -c.oy : c.oy; OZ = c.oz;
    FX = c.fx; FY = mirror ? -c.fy : c.fy; FZ = c.fz;
    RX = c.rx; RY = 0; RZ = c.rz;
    UX = c.ux; UY = mirror ? -c.uy : c.uy; UZ = c.uz;
  }
  let PX = 0, PY = 0, PZ = 0;
  function proj(x, y, z) {
    const vx = x - OX, vy = y - OY, vz = z - OZ;
    const zc = vx * FX + vy * FY + vz * FZ;
    if (zc < NEAR) return false;
    PZ = zc;
    PX = CXS + FOC * (vx * RX + vy * RY + vz * RZ) / zc;
    PY = CYS - FOC * (vx * UX + vy * UY + vz * UZ) / zc;
    return true;
  }

  /* ================================================================ buffers */
  const ZM = new Float32Array(NP), CRM = new Float32Array(NP), CGM = new Float32Array(NP), CBM = new Float32Array(NP);
  const ZR = new Float32Array(NP), CRR = new Float32Array(NP), CGR = new Float32Array(NP), CBR = new Float32Array(NP);
  const FLOORM = new Uint8Array(NP);
  // deferred metal shading for the impostors (no cost for overdraw)
  const GPX = new Float32Array(NP), GPY = new Float32Array(NP), GPZ = new Float32Array(NP);
  const GNX = new Float32Array(NP), GNY = new Float32Array(NP), GNZ = new Float32Array(NP), GTN = new Float32Array(NP);
  const GMT = new Int8Array(NP).fill(-1), GLS = new Uint16Array(NP);
  const LISTS = [];
  function gput(i, z, x, y, zz, nx, ny, nz, m, tint, li) {
    ZB[i] = z; GPX[i] = x; GPY[i] = y; GPZ[i] = zz; GNX[i] = nx; GNY[i] = ny; GNZ[i] = nz; GMT[i] = m; GTN[i] = tint; GLS[i] = li;
  }
  function resolve() {
    for (let i = 0; i < NP; i++) {
      const m = GMT[i];
      if (m < 0) continue;
      shadeMetal(GPX[i], GPY[i], GPZ[i], GNX[i], GNY[i], GNZ[i], m, LISTS[GLS[i]], GTN[i]);
      BR[i] = OR; BG[i] = OG; BB[i] = OB; GMT[i] = -1;
    }
  }
  const OUT = new Uint8Array(NP), EMI = new Uint8Array(NP);
  let ZB = ZM, BR = CRM, BG = CGM, BB = CBM, MASK = null, MIRROR = false;
  function target(mirror) {
    MIRROR = mirror;
    if (mirror) { ZB = ZR; BR = CRR; BG = CGR; BB = CBR; MASK = FLOORM; } else { ZB = ZM; BR = CRM; BG = CGM; BB = CBM; MASK = null; }
  }

  /* ================================================================ lighting */
  let LR = 0, LG = 0, LB = 0, KR = 0, KG = 0, KB = 0, SUNV = 0;
  // diffuse light (LR..) and specular (KR..) at a point; v = unit vector toward the eye; sq = spec sharpness (squarings)
  function lightUp(x, y, z, nx, ny, nz, vx, vy, vz, list, sq, spec, nosun) {
    const hemi = 0.5 + 0.5 * ny;
    LR = 0.02 + 0.024 * hemi; LG = 0.024 + 0.03 * hemi; LB = 0.04 + 0.055 * hemi;
    KR = 0; KG = 0; KB = 0;
    for (let j = 0; j < list.length; j++) {
      const k = list[j];
      const lx = LX[k] - x, ly = LY[k] - y, lz = LZ[k] - z;
      const d2 = lx * lx + ly * ly + lz * lz, rm = LRM2[k];
      if (d2 > rm) continue;
      const id = 1 / sqrt(d2 + 1e-6), ux = lx * id, uy = ly * id, uz = lz * id;
      const ndl = nx * ux + ny * uy + nz * uz;
      if (ndl <= -0.2) continue;
      const fo = 1 - d2 / rm, att = LI[k] * fo * fo / (1 + d2 * LIR2[k]);
      const a = att * (ndl > 0 ? 0.2 + 0.8 * ndl : (ndl + 0.2));
      LR += a; LG += a * 0.68; LB += a * 0.38;
      if (spec) {
        let hx = ux + vx, hy = uy + vy, hz = uz + vz;
        const hl = 1 / sqrt(hx * hx + hy * hy + hz * hz + 1e-9);
        let hn = (nx * hx + ny * hy + nz * hz) * hl;
        if (hn > 0.6) {
          for (let q = 0; q < sq; q++) hn *= hn;
          const s = hn * att * 1.5;
          KR += s; KG += s * 0.76; KB += s * 0.48;
        }
      }
    }
    SUNV = nosun ? 0 : sunAt(x, y, z);
    if (SUNV > 0) {
      const ndl = -(nx * SX + ny * SY + nz * SZ);
      if (ndl > 0) { const a = SUNV * ndl; LR += a * SUN_C[0]; LG += a * SUN_C[1]; LB += a * SUN_C[2]; }
      if (spec) {
        let hx = vx - SX, hy = vy - SY, hz = vz - SZ;
        const hl = 1 / sqrt(hx * hx + hy * hy + hz * hz + 1e-9);
        let hn = (nx * hx + ny * hy + nz * hz) * hl;
        if (hn > 0.7) { for (let q = 0; q < sq + 1; q++) hn *= hn; const s = hn * SUNV * 5; KR += s * 1.1; KG += s; KB += s * 0.85; }
      }
    }
  }
  // environment seen in a mirror direction (windows, candle rings, floor, vault)
  let ER = 0, EG = 0, EB = 0;
  const WINB = new Float32Array(WIN_N), WINS = new Float32Array(WIN_N);
  function env(rx, ry, rz) {
    ER = 0.045; EG = 0.05; EB = 0.075;
    if (ry > 0.1 && ry < 0.66) {
      const az = Math.atan2(rz, rx);
      const w = az * (WIN_N / TAU) - 0.5, wr = Math.round(w), fw = abs(w - wr);
      if (fw < 0.1) {
        const k = ((wr % WIN_N) + WIN_N) % WIN_N;
        const e = 1 - fw / 0.1, band = sstep(0.1, 0.2, ry) * (1 - sstep(0.52, 0.66, ry));
        const b = e * e * band * WINB[k], sn = WINS[k];
        ER += b * (0.5 + 0.5 * sn); EG += b * (0.58 + 0.36 * sn); EB += b * (0.85 - 0.1 * sn);
      }
      ER += 0.02; EG += 0.022; EB += 0.03;
    } else if (ry <= 0.1 && ry > -0.42) {
      const az = Math.atan2(rz, rx);
      let c1 = cos(8 * az - Math.PI / 2), c2 = cos(12 * az - Math.PI), c3 = cos(16 * az - Math.PI);
      c1 = c1 > 0 ? c1 * c1 : 0; c1 *= c1; c1 *= c1; c1 *= c1;
      c2 = c2 > 0 ? c2 * c2 : 0; c2 *= c2; c2 *= c2; c2 *= c2;
      c3 = c3 > 0 ? c3 * c3 : 0; c3 *= c3; c3 *= c3;
      const band = sstep(-0.42, -0.25, ry) * (1 - sstep(-0.02, 0.1, ry));
      const b = band * (0.1 + 0.55 * c1 * sstep(-0.35, -0.2, ry) + 0.45 * c2 * (1 - sstep(-0.2, -0.05, ry)) + 0.35 * c3);
      ER += b; EG += b * 0.6; EB += b * 0.28;
    } else if (ry <= -0.42) { ER = 0.05; EG = 0.035; EB = 0.03; }
  }

  // metal surface: writes OR, OG, OB
  let OR = 0, OG = 0, OB = 0;
  function shadeMetal(x, y, z, nx, ny, nz, mat, list, tint) {
    let vx = OX - x, vy = OY - y, vz = OZ - z;
    const vl = 1 / sqrt(vx * vx + vy * vy + vz * vz); vx *= vl; vy *= vl; vz *= vl;
    let ndv = nx * vx + ny * vy + nz * vz;
    if (ndv < 0) { nx -= 2 * ndv * vx; ny -= 2 * ndv * vy; nz -= 2 * ndv * vz; ndv = -ndv; }
    const M = MAT[mat];
    lightUp(x, y, z, nx, ny, nz, vx, vy, vz, list, 4, true);
    const rx = 2 * ndv * nx - vx, ry = 2 * ndv * ny - vy, rz = 2 * ndv * nz - vz;
    env(rx, ry, rz);
    const fr = 0.65 + 0.35 * (1 - ndv) * (1 - ndv);
    const e = M.e * fr * tint;
    OR = M.a[0] * LR * tint + M.s[0] * (ER * e + KR);
    OG = M.a[1] * LG * tint + M.s[1] * (EG * e + KG);
    OB = M.a[2] * LB * tint + M.s[2] * (EB * e + KB);
  }
  let THRONE_L = [];

  /* ================================================================ background ray cast */
  // pillar screen ranges for the current camera
  const PXR0 = new Float32Array(32), PXR1 = new Float32Array(32), PVIS = new Uint8Array(32);
  let DAIS_BB = [0, 0, 0, 0], BOX_BB = [0, 0, 0, 0];
  function screenBB(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false, behind = false;
    for (const p of pts) {
      if (!proj(p[0], p[1], p[2])) { behind = true; continue; }
      any = true; if (PX < x0) x0 = PX; if (PX > x1) x1 = PX; if (PY < y0) y0 = PY; if (PY > y1) y1 = PY;
    }
    if (behind) return any ? [0, 0, W, H] : [1, 1, 0, 0];
    return [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
  }
  const PCOL = []; for (let x = 0; x < W; x++) PCOL.push([]);
  function prepBG() {
    for (let k = 0; k < PIL.length; k++) {
      const p = PIL[k], R = p.r * 1.35;
      const pts = [];
      for (const yy of [0, p.top]) for (const s of [-1, 1]) pts.push([p.x + RX * R * s, yy, p.z + RZ * R * s]);
      // nearest/farthest points along view to catch near-plane cases
      pts.push([p.x - FX * R, 0, p.z - FZ * R], [p.x - FX * R, p.top, p.z - FZ * R]);
      const bb = screenBB(pts);
      PVIS[k] = bb[2] > bb[0] ? 1 : 0;
      PXR0[k] = bb[0]; PXR1[k] = bb[2];
    }
    for (let x = 0; x < W; x++) PCOL[x].length = 0;
    for (let k = 0; k < PIL.length; k++) {
      if (!PVIS[k]) continue;
      for (let x = Math.max(0, fl(PXR0[k])); x <= Math.min(W - 1, Math.ceil(PXR1[k])); x++) PCOL[x].push(k);
    }
    const dp = [];
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8, r = DAIS_A[0] / cos(Math.PI / 8); dp.push([r * cos(a), 0, r * sin(a)], [r * cos(a), TY, r * sin(a)]); }
    DAIS_BB = screenBB(dp);
    const bp = [];
    for (const q of BOX) for (let c = 0; c < 8; c++) bp.push([c & 1 ? q[3] : q[0], c & 2 ? q[4] : q[1], c & 4 ? q[5] : q[2]]);
    BOX_BB = screenBB(bp);
  }
  // returns material info through globals
  function bgPass() {
    const mirror = MIRROR;
    for (let py = 0; py < H; py++) {
      const b = (py + 0.5 - CYS) / FOC;
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        if (mirror && !FLOORM[i]) { ZB[i] = 1e9; BR[i] = BG[i] = BB[i] = 0; continue; }
        const a = (px + 0.5 - CXS) / FOC;
        const dx = FX + RX * a - UX * b, dy = FY + RY * a - UY * b, dz = FZ + RZ * a - UZ * b;
        let best = 1e9, type = 0, pk = -1, nx = 0, ny = 0, nz = 0, aux = 0;
        // wall & vault (always hit from inside)
        {
          const A = dx * dx + dz * dz, Bq = 2 * (OX * dx + OZ * dz), C = OX * OX + OZ * OZ - WALL_R * WALL_R;
          const tw_ = (-Bq + sqrt(Bq * Bq - 4 * A * C)) / (2 * A);
          const yw = OY + dy * tw_;
          if (yw < VAULT_Y) { best = tw_; type = 2; }
          else { best = (VAULT_Y - OY) / dy; type = 3; }
        }
        if (!mirror && dy < 0) { const tf = -OY / dy; if (tf < best) { best = tf; type = 1; } }
        // pillars
        const pc = PCOL[px];
        for (let kk = 0; kk < pc.length; kk++) {
          const k = pc[kk];
          const p = PIL[k], qx = OX - p.x, qz = OZ - p.z;
          const A = dx * dx + dz * dz, Bq = 2 * (qx * dx + qz * dz);
          // shaft and the wider base drum
          for (let pass = 0; pass < 2; pass++) {
            const r = pass ? p.r * 1.28 : p.r;
            const C = qx * qx + qz * qz - r * r, disc = Bq * Bq - 4 * A * C;
            if (disc < 0) continue;
            const t = (-Bq - sqrt(disc)) / (2 * A);
            if (t <= 0.05 || t >= best) continue;
            const y = OY + dy * t;
            if (y < 0 || y > (pass ? 0.85 : p.top)) continue;
            best = t; type = 4; pk = k; aux = pass;
          }
        }
        // dais
        if (px >= DAIS_BB[0] && px <= DAIS_BB[2] && py >= DAIS_BB[1] && py <= DAIS_BB[3]) {
          if (rayDais(OX, OY, OZ, dx, dy, dz) && RD_T < best) { best = RD_T; type = 5; nx = RD_NX; ny = RD_NY; nz = RD_NZ; aux = RD_S; }
        }
        // throne core
        if (px >= BOX_BB[0] && px <= BOX_BB[2] && py >= BOX_BB[1] && py <= BOX_BB[3]) {
          if (rayBoxes(OX, OY, OZ, dx, dy, dz, best) >= 0) {
            best = RB_T; type = 6; aux = RB_I;
            nx = RB_AX === 0 ? RB_SG : 0; ny = RB_AX === 1 ? RB_SG : 0; nz = RB_AX === 2 ? RB_SG : 0;
          }
        }
        const x = OX + dx * best, y = OY + dy * best, z = OZ + dz * best;
        ZB[i] = best;
        if (!mirror) FLOORM[i] = type === 1 ? 1 : 0;
        if (type === 1) continue; // floor is shaded after the mirror pass
        if (type === 2) shadeWall(x, y, z, px, py);
        else if (type === 3) shadeVault(x, y, z);
        else if (type === 4) shadePillar(PIL[pk], x, y, z, aux);
        else if (type === 5) shadeDais(x, y, z, nx, ny, nz, aux, px, py);
        else shadeCore(x, y, z, nx, ny, nz, BOX[aux][6]);
        BR[i] = OR; BG[i] = OG; BB[i] = OB;
      }
    }
  }

  const WALL_L = [];
  function shadeWall(x, y, z, px, py) {
    const az = Math.atan2(z, x);
    const w = az * (WIN_N / TAU) - 0.5, wr = Math.round(w);
    const s = (w - wr) * TAU / WIN_N * WALL_R; // metres from the window centre
    const k = ((wr % WIN_N) + WIN_N) % WIN_N;
    const as = abs(s);
    // window opening (lancet)
    const ytop = WIN_Y1 + WIN_ARCH * sqrt(Math.max(0, 1 - as / WIN_HW));
    if (as < WIN_HW && y > WIN_Y0 && y < ytop) {
      const edge = Math.min(WIN_HW - as, y - WIN_Y0, ytop - y);
      const sun = WINS[k];
      let lead = 0;
      let r = 0.36 + 0.64 * sun, g = 0.46 + 0.5 * sun, b = 0.8 + 0.02 * sun;
      const cyM = WIN_Y1 - 0.9, dyM = y - cyM, rM = Math.hypot(s, dyM * 0.92);
      if (edge < 0.08) lead = 1;
      else if (rM < 0.98) { // rose medallion
        const ang = Math.atan2(dyM, s), pf = fract((ang / TAU + 0.5) * 8 + 0.0625);
        if (abs(rM - 0.3) < 0.05 || rM > 0.92 || pf < 0.07) lead = 1;
        else if (rM < 0.3) { r = 1.1; g = 0.86; b = 0.4; }
        else if (fl((ang / TAU + 0.5) * 8 + 0.0625) & 1) { r = 0.85; g = 0.22; b = 0.26; }
        else { r = 0.3; g = 0.42; b = 1.0; }
      } else if (as > WIN_HW - 0.24) { // border of alternating panes
        if (as < WIN_HW - 0.21 || fract(y / 0.45) < 0.12) lead = 1;
        else if (fl(y / 0.45) & 1) { r = 1.0; g = 0.78; b = 0.36; } else { r = 0.8; g = 0.24; b = 0.28; }
      } else if (abs(fract((y - WIN_Y0) / 2.3) - 0.5) > 0.48 || as < 0.04) lead = 1;
      else {
        const g1 = fract((s + y * 0.6) / 0.36), g2 = fract((s - y * 0.6) / 0.36);
        if (g1 < 0.1 || g2 < 0.1) lead = 0.75;
        else { const q = ih(fl((s + y * 0.6) / 0.36), fl((s - y * 0.6) / 0.36), k); const v = 0.84 + 0.22 * q; r *= v; g *= v; b *= v; }
      }
      const br = WINB[k] * (0.8 + 0.2 * (y - WIN_Y0) / (ytop - WIN_Y0));
      const f = br * (1 - lead * 0.93);
      OR = r * f; OG = g * f; OB = b * f;
      return;
    }
    // stone blocks
    const row = fl(y / 0.7), col = fl((az * WALL_R + (row & 1) * 0.6) / 1.2);
    const fy = fract(y / 0.7), fx = fract((az * WALL_R + (row & 1) * 0.6) / 1.2);
    const mortar = fy < 0.07 || fx < 0.04;
    const v = 0.75 + 0.5 * ih(row, col, 77);
    let al = mortar ? 0.06 : 0.17 * v;
    // window reveal glow
    const glow = as < WIN_HW + 0.7 && y > WIN_Y0 - 0.6 && y < ytop + 0.6 ? 0.3 * WINB[k] * (1 - Math.max(0, as - WIN_HW) / 0.7) : 0;
    const nx = -x / WALL_R, nz = -z / WALL_R;
    const list = WALL_L[k] || [];
    lightUp(x, y, z, nx, 0, nz, 0, 0, 0, list, 0, false, true);
    OR = al * (LR + glow) * 1.0; OG = al * (LG + glow * 0.9) * 0.97; OB = al * (LB + glow * 0.75) * 1.02;
  }
  function shadeVault(x, y, z) {
    const r = Math.hypot(x, z), az = Math.atan2(z, x);
    const rib = abs(fract(az * 16 / TAU) - 0.5) > 0.47 || abs(fract(r / 3.2) - 0.5) > 0.45;
    const v = rib ? 0.042 : 0.026;
    OR = v * 0.9; OG = v * 0.9; OB = v * 1.2;
  }
  function shadePillar(p, x, y, z, base) {
    let nx = (x - p.x), nz = (z - p.z);
    const nl = 1 / Math.hypot(nx, nz); nx *= nl; nz *= nl;
    const ang = Math.atan2(nz, nx);
    let a0 = 0.22, a1 = 0.2, a2 = 0.2, metal = false;
    if (!base) {
      // fluting
      const fl_ = sin(ang * 20);
      const tx = -nz, tz = nx;
      nx += tx * fl_ * 0.35; nz += tz * fl_ * 0.35;
      const l2 = 1 / Math.hypot(nx, nz); nx *= l2; nz *= l2;
      const band = fract(y / 4.5);
      if (band < 0.045 || (band > 0.06 && band < 0.075)) metal = true;
      const vein = 0.85 + 0.3 * ih(fl(ang * 3), fl(y / 1.1), 5);
      a0 = 0.29 * vein; a1 = 0.27 * vein; a2 = 0.26 * vein;
    } else {
      if (y > 0.72) metal = true;
    }
    if (metal) { shadeMetal(x, y, z, nx, 0, nz, 3, p.lights, 0.8); return; }
    lightUp(x, y, z, nx, 0, nz, 0, 0, 0, p.lights, 0, false);
    // cool rim from the windows
    OR = a0 * LR; OG = a1 * LG; OB = a2 * LB;
  }
  function shadeDais(x, y, z, nx, ny, nz, s, px, py) {
    const top = (s + 1) * STEP_H;
    if (ny < 0.5 && y > top - 0.03) { shadeMetal(x, y, z, nx, 0.3, nz, 3, THRONE_L, 0.32); return; } // gilt nosing
    const vein = 0.8 + 0.4 * ih(fl(x * 2.3), fl(z * 2.3), 11 + s);
    const al = ny > 0.5 ? 0.13 * vein : 0.09 * vein;
    let vx = OX - x, vy = OY - y, vz = OZ - z; const vl = 1 / sqrt(vx * vx + vy * vy + vz * vz); vx *= vl; vy *= vl; vz *= vl;
    lightUp(x, y, z, nx, ny, nz, vx, vy, vz, THRONE_L, 3, true);
    const ndv = nx * vx + ny * vy + nz * vz;
    env(2 * ndv * nx - vx, 2 * ndv * ny - vy, 2 * ndv * nz - vz);
    const k = 0.25;
    OR = al * LR + (ER * k + KR * 0.15); OG = al * LG * 0.97 + (EG * k + KG * 0.15); OB = al * LB * 1.05 + (EB * k + KB * 0.15);
  }
  function shadeCore(x, y, z, nx, ny, nz, m) {
    // fused blades: bevelled stripes across the face
    let s;
    if (ny !== 0) s = (x + z * 0.3) * 9;
    else s = y * 11 + (nx !== 0 ? z : x) * 0.8;
    const id = fl(s), f = s - id - 0.5;
    const h = ih(id, m, 31);
    let px = nx, py = ny, pz = nz;
    if (ny !== 0) { px += f * 0.8; } else { py += f * 0.9; }
    const l = 1 / sqrt(px * px + py * py + pz * pz);
    shadeMetal(x, y, z, px * l, py * l, pz * l, h < 0.5 ? 4 : h < 0.85 ? 1 : 0, THRONE_L, 0.4 + 0.45 * h);
  }

  /* ================================================================ floor */
  const LMN = 160, LMS = 0.3, LM0 = -24;
  const LMR = new Float32Array(LMN * LMN), LMG = new Float32Array(LMN * LMN), LMB = new Float32Array(LMN * LMN);
  function buildLightmap() {
    LMR.fill(0);
    for (let k = 0; k < LX.length; k++) {
      const rm = sqrt(LRM2[k]), ci = (LX[k] - LM0) / LMS, cj = (LZ[k] - LM0) / LMS, rp = rm / LMS;
      const I = LI[k], ly2 = LY[k] * LY[k];
      for (let j = Math.max(0, fl(cj - rp)); j <= Math.min(LMN - 1, Math.ceil(cj + rp)); j++) {
        const dz = LM0 + (j + 0.5) * LMS - LZ[k];
        for (let i = Math.max(0, fl(ci - rp)); i <= Math.min(LMN - 1, Math.ceil(ci + rp)); i++) {
          const dx = LM0 + (i + 0.5) * LMS - LX[k];
          const d2 = dx * dx + dz * dz + ly2;
          if (d2 > LRM2[k]) continue;
          const fo = 1 - d2 / LRM2[k];
          LMR[j * LMN + i] += I * fo * fo / (1 + d2 * LIR2[k]) * (0.35 + 0.65 * LY[k] / sqrt(d2));
        }
      }
    }
  }
  function lmAt(x, z) {
    const fx = (x - LM0) / LMS - 0.5, fz = (z - LM0) / LMS - 0.5;
    const i = fl(fx), j = fl(fz);
    if (i < 0 || j < 0 || i >= LMN - 1 || j >= LMN - 1) return 0;
    const u = fx - i, v = fz - j, k = j * LMN + i;
    return (LMR[k] * (1 - u) + LMR[k + 1] * u) * (1 - v) + (LMR[k + LMN] * (1 - u) + LMR[k + LMN + 1] * u) * v;
  }
  function floorPass() {
    for (let py = 0; py < H; py++) {
      const b = (py + 0.5 - CYS) / FOC;
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        if (!FLOORM[i]) continue;
        const a = (px + 0.5 - CXS) / FOC;
        const dx = FX + RX * a - UX * b, dy = FY + RY * a - UY * b, dz = FZ + RZ * a - UZ * b;
        const t = ZB[i], x = OX + dx * t, z = OZ + dz * t;
        const r = Math.hypot(x, z), az = Math.atan2(z, x);
        // slabs: concentric rings, radial joints
        let joint = 0, gold = 0;
        const ring = (r - 5.3) / 1.5;
        if (r > 5.3) {
          const fr = fract(ring), ri = fl(ring);
          const nseg = Math.max(8, fl((5.3 + ri * 1.5) * TAU / 1.6));
          const fa = fract(az / TAU * nseg + ri * 0.5);
          if (fr < 0.025 || fa < 0.02) joint = 1;
          if (abs(r - 6.1) < 0.07 || abs(r - 11.0) < 0.06 || abs(r - 14.6) < 0.05) gold = 1;
          // compass star inlay inside the first ring
          if (r < 7.2 && r > 6.2) { const st = abs(fract(az * 8 / TAU) - 0.5) * 2; if (abs((r - 6.2) / 1.0 - st) < 0.04) gold = 1; }
        }
        const vein = abs(sin(x * 1.3 + 2.1 * sin(z * 0.7 + x * 0.2) + 0.7 * sin(z * 2.9)));
        let al = 0.07 + (vein < 0.06 ? 0.09 : 0) + 0.03 * ih(fl(ring), fl(az * 8), 3);
        const lm = lmAt(x, z);
        let lr = 0.025 + lm, lg = 0.03 + lm * 0.68, lb = 0.045 + lm * 0.38;
        const sv = sunAt(x, 0, z);
        if (sv > 0) { const k = sv * -SY; lr += k * SUN_C[0]; lg += k * SUN_C[1]; lb += k * SUN_C[2]; }
        let refl = 0.42 + 0.4 * Math.pow(1 - Math.min(1, abs(dy) * 1.3), 3);
        if (joint) { refl *= 0.25; al *= 0.5; }
        let r_ = al * lr, g_ = al * lg, b_ = al * lb;
        if (gold) { r_ = 0.5 * lr * 0.5 + 0.08; g_ = 0.36 * lg * 0.5 + 0.055; b_ = 0.13 * lb * 0.5 + 0.02; refl = 0.6; }
        // reflection, gently broken at the slab joints
        let ri_ = i;
        if (py + 1 < H && ((fl(ring * 3) + fl(az * 30)) & 1) && FLOORM[i + W]) ri_ = i + W;
        const rz = ZR[ri_] < 1e8 ? 1 : 0;
        BR[i] = r_ + refl * CRR[ri_] * rz * (gold ? 1.0 : 0.9);
        BG[i] = g_ + refl * CGR[ri_] * rz * (gold ? 0.8 : 0.9);
        BB[i] = b_ + refl * CBR[ri_] * rz * (gold ? 0.5 : 0.95);
      }
    }
  }

  /* ================================================================ impostors */
  function clipSeg(ax, ay, az, bx, by, bz) {
    // clip a segment against the near plane; returns false if fully behind
    const za = (ax - OX) * FX + (ay - OY) * FY + (az - OZ) * FZ;
    const zb = (bx - OX) * FX + (by - OY) * FY + (bz - OZ) * FZ;
    if (za < NEAR && zb < NEAR) return false;
    C0 = [ax, ay, az]; C1 = [bx, by, bz];
    if (za < NEAR) { const u = (NEAR + 0.01 - za) / (zb - za); C0 = [ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u]; }
    if (zb < NEAR) { const u = (NEAR + 0.01 - zb) / (za - zb); C1 = [bx + (ax - bx) * u, by + (ay - by) * u, bz + (az - bz) * u]; }
    return true;
  }
  let C0 = null, C1 = null;
  function drawBlade(s) {
    if (!proj(s.ax, s.ay, s.az)) return;
    const x0 = PX, y0 = PY, z0 = PZ;
    if (!proj(s.bx, s.by, s.bz)) return;
    const x1 = PX, y1 = PY, z1 = PZ;
    proj(s.ax + s.e0x * s.h0, s.ay + s.e0y * s.h0, s.az + s.e0z * s.h0);
    const w0x = PX - x0, w0y = PY - y0;
    const h1r = s.h1 > 0 ? s.h1 : s.h0;
    proj(s.bx + s.e1x * h1r, s.by + s.e1y * h1r, s.bz + s.e1z * h1r);
    let w1x = PX - x1, w1y = PY - y1;
    if (s.h1 === 0) { w1x = 0; w1y = 0; }
    const ax = x1 - x0, ay = y1 - y0, len2 = ax * ax + ay * ay;
    if (len2 < 0.04) return;
    const il = 1 / sqrt(len2), ux = ax * il, uy = ay * il, qx_ = -uy, qy_ = ux;
    const hp0 = abs(w0x * qx_ + w0y * qy_), hp1 = abs(w1x * qx_ + w1y * qy_);
    const sg0 = (w0x * qx_ + w0y * qy_) >= 0 ? 1 : -1;
    const hm = Math.max(hp0, hp1, 0.6) + 1;
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - hm)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + hm));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - hm)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + hm));
    if (bx0 > bx1 || by0 > by1) return;
    const dxw = s.bx - s.ax, dyw = s.by - s.ay, dzw = s.bz - s.az;
    const dl = 1 / sqrt(dxw * dxw + dyw * dyw + dzw * dzw), ddx = dxw * dl, ddy = dyw * dl, ddz = dzw * dl;
    const iz0 = 1 / z0, iz1 = 1 / z1;
    const mat = s.m;
    for (let py = by0; py <= by1; py++) {
      for (let px = bx0; px <= bx1; px++) {
        const i = py * W + px;
        if (MASK && !MASK[i]) continue;
        const qx = px + 0.5 - x0, qy = py + 0.5 - y0;
        const t = (qx * ax + qy * ay) / len2;
        if (t < 0 || t > 1) continue;
        const dp = qx * qx_ + qy * qy_;
        const hp = hp0 + (hp1 - hp0) * t;
        const lim = hp > 0.5 ? hp : (s.h1 === 0 && t > 0.93 ? 0.35 : 0.5);
        if (dp > lim || dp < -lim) continue;
        const iz = iz0 + (iz1 - iz0) * t, z = 1 / iz;
        if (z >= ZB[i]) continue;
        const tw_ = t * iz1 * z;
        const x = s.ax + dxw * tw_, y = s.ay + dyw * tw_, zz = s.az + dzw * tw_;
        // width vector & flat normal
        let ex = s.e0x + (s.e1x - s.e0x) * tw_, ey = s.e0y + (s.e1y - s.e0y) * tw_, ez = s.e0z + (s.e1z - s.e0z) * tw_;
        let nx = ddy * ez - ddz * ey, ny = ddz * ex - ddx * ez, nz = ddx * ey - ddy * ex;
        const nl = 1 / sqrt(nx * nx + ny * ny + nz * nz + 1e-12); nx *= nl; ny *= nl; nz *= nl;
        if (nx * (OX - x) + ny * (OY - y) + nz * (OZ - zz) < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const q = (dp / lim) * sg0 * 0.62;
        nx += ex * q; ny += ey * q; nz += ez * q;
        const n2 = 1 / sqrt(nx * nx + ny * ny + nz * nz);
        gput(i, z, x, y, zz, nx * n2, ny * n2, nz * n2, mat, 1, 0);
      }
    }
  }
  function drawCap(c, list) {
    if (!clipSeg(c.ax, c.ay, c.az, c.bx, c.by, c.bz)) return;
    proj(C0[0], C0[1], C0[2]); const x0 = PX, y0 = PY, z0 = PZ;
    proj(C1[0], C1[1], C1[2]); const x1 = PX, y1 = PY, z1 = PZ;
    const r0 = c.r * FOC / z0, r1 = c.r * FOC / z1;
    let ax = x1 - x0, ay = y1 - y0, len2 = ax * ax + ay * ay;
    const hm = Math.max(r0, r1, 0.6) + 1;
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - hm)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + hm));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - hm)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + hm));
    if (bx0 > bx1 || by0 > by1) return;
    if (len2 < 1e-4) { ax = 0.01; ay = 0; len2 = 1e-4; }
    const il = 1 / sqrt(len2), qx_ = -ay * il, qy_ = ax * il;
    // world perpendicular corresponding to the screen perpendicular
    const pwx = RX * qx_ - UX * qy_, pwy = RY * qx_ - UY * qy_, pwz = RZ * qx_ - UZ * qy_;
    const iz0 = 1 / z0, iz1 = 1 / z1;
    const dxw = C1[0] - C0[0], dyw = C1[1] - C0[1], dzw = C1[2] - C0[2];
    const wax = c.wax;
    for (let py = by0; py <= by1; py++) {
      for (let px = bx0; px <= bx1; px++) {
        const i = py * W + px;
        if (MASK && !MASK[i]) continue;
        const qx = px + 0.5 - x0, qy = py + 0.5 - y0;
        let t = (qx * ax + qy * ay) / len2;
        const tc = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = qx - ax * tc, ey = qy - ay * tc;
        const rr_ = r0 + (r1 - r0) * tc, lim = rr_ > 0.5 ? rr_ : 0.5;
        const d2 = ex * ex + ey * ey;
        if (d2 > lim * lim) continue;
        const iz = iz0 + (iz1 - iz0) * tc, z = 1 / iz;
        if (z >= ZB[i]) continue;
        const tw_ = tc * iz1 * z;
        const x = C0[0] + dxw * tw_, y = C0[1] + dyw * tw_, zz = C0[2] + dzw * tw_;
        const q = (ex * qx_ + ey * qy_) / lim, qq = Math.min(1, q * q), ff = sqrt(1 - qq);
        let nx = pwx * q - FX * ff, ny = pwy * q - FY * ff, nz = pwz * q - FZ * ff;
        if (wax) {
          // glowing wax: brighter toward the flame
          const hgt = clamp((y - c.ay) / (c.by - c.ay), 0, 1);
          const g = 0.12 + 0.9 * hgt * hgt;
          const sh = 0.7 + 0.3 * ff;
          ZB[i] = z - c.r * ff; GMT[i] = -1;
          BR[i] = 0.95 * g * sh; BG[i] = 0.68 * g * sh; BB[i] = 0.36 * g * sh;
        } else {
          const nl = 1 / sqrt(nx * nx + ny * ny + nz * nz + 1e-12);
          gput(i, z - c.r * ff, x, y, zz, nx * nl, ny * nl, nz * nl, c.m, 1, c.li);
        }
      }
    }
  }
  function drawSph(s) {
    if (!proj(s.x, s.y, s.z)) return;
    const cx = PX, cy = PY, z0 = PZ, rp = Math.max(0.55, s.r * FOC / z0);
    const bx0 = Math.max(0, fl(cx - rp)), bx1 = Math.min(W - 1, fl(cx + rp));
    const by0 = Math.max(0, fl(cy - rp)), by1 = Math.min(H - 1, fl(cy + rp));
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const i = py * W + px;
      if (MASK && !MASK[i]) continue;
      const qx = (px + 0.5 - cx) / rp, qy = (py + 0.5 - cy) / rp, q2 = qx * qx + qy * qy;
      if (q2 > 1) continue;
      const f = sqrt(1 - q2), z = z0 - s.r * f;
      if (z >= ZB[i]) continue;
      const nx = RX * qx - UX * qy - FX * f, ny = RY * qx - UY * qy - FY * f, nz = RZ * qx - UZ * qy - FZ * f;
      gput(i, z, s.x + nx * s.r, s.y + ny * s.r, s.z + nz * s.r, nx, ny, nz, s.m, 1, 0);
    }
  }
  // flames: emissive teardrops + additive glow
  const FLI = [];
  function drawFlames(t) {
    for (let k = 0; k < FLM.length; k++) {
      const f = FLM[k];
      const fk = 0.78 + 0.13 * wave(5 + f.n, t, f.ph0) + 0.09 * wave(13 + f.n * 2, t, f.ph1) * wave(3, t, f.ph2);
      const sway = 0.012 * wave(2 + f.n, t, f.ph1);
      if (!proj(f.x + sway, f.y, f.z)) continue;
      const cx = PX, cy = PY, z0 = PZ;
      const rp = 0.028 * f.s * FOC / z0, hp = rp * 2.3 * fk;
      const ix = fl(cx), iy = fl(cy);
      if (ix < -12 || ix > W + 12 || iy < -12 || iy > H + 12) continue;
      const vis = ix >= 0 && iy >= 0 && ix < W && iy < H && (!MASK || MASK[iy * W + ix]) && z0 < ZB[iy * W + ix] + 0.1;
      if (rp < 0.7) {
        if (vis) { const i = iy * W + ix; BR[i] = 1.25 * fk; BG[i] = 0.95 * fk; BB[i] = 0.55 * fk; ZB[i] = z0; GMT[i] = -1; if (!MIRROR) EMI[i] = 1; }
      } else {
        const bx0 = Math.max(0, fl(cx - rp - 1)), bx1 = Math.min(W - 1, fl(cx + rp + 1));
        const by0 = Math.max(0, fl(cy - hp - 1)), by1 = Math.min(H - 1, fl(cy + rp + 1));
        for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
          const i = py * W + px;
          if (MASK && !MASK[i]) continue;
          if (z0 >= ZB[i]) continue;
          const qx = (px + 0.5 - cx) / rp, qyr = (py + 0.5 - cy);
          const qy = qyr > 0 ? qyr / rp : qyr / hp;
          const wdt = qyr > 0 ? 1 : 1 + qy * 0.4;
          const q2 = qx * qx / (wdt * wdt + 1e-3) + qy * qy;
          if (q2 > 1) continue;
          const core = q2 < 0.35;
          BR[i] = core ? 1.4 : 1.15 * fk; BG[i] = core ? 1.25 : 0.62 * fk; BB[i] = core ? 0.85 : 0.22 * fk; ZB[i] = z0; GMT[i] = -1; if (!MIRROR) EMI[i] = 1;
        }
      }
      if (vis) FLI.push(cx, cy, z0, fk);
    }
  }
  function drawGlows() {
    for (let k = 0; k < FLI.length; k += 4) {
      const cx = FLI[k], cy = FLI[k + 1], z0 = FLI[k + 2], fk = FLI[k + 3];
      const R = clamp(0.2 * FOC / z0, 1.5, 7), I = 0.2 * fk * (MIRROR ? 0.8 : 1);
      const bx0 = Math.max(0, fl(cx - R)), bx1 = Math.min(W - 1, fl(cx + R));
      const by0 = Math.max(0, fl(cy - R * 1.2)), by1 = Math.min(H - 1, fl(cy + R * 0.8));
      const ir = 1 / R;
      for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
        const i = py * W + px;
        if (MASK && !MASK[i]) continue;
        const dx = (px + 0.5 - cx) * ir, dy = (py + 0.5 - cy) * ir * 0.9;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const g = (1 - d2); const a = g * g * g * I;
        BR[i] += a; BG[i] += a * 0.6; BB[i] += a * 0.25;
      }
    }
    FLI.length = 0;
  }

  /* ================================================================ banners */
  const BNU = 5, BNV = 30;
  const BVX = new Float32Array((BNU + 1) * (BNV + 1)), BVY = new Float32Array(BVX.length), BVZ = new Float32Array(BVX.length);
  const BNX = new Float32Array(BVX.length), BNY = new Float32Array(BVX.length), BNZ = new Float32Array(BVX.length);
  const BSX = new Float32Array(BVX.length), BSY = new Float32Array(BVX.length), BIZ = new Float32Array(BVX.length), BOK = new Uint8Array(BVX.length);
  function bannerGeom(b, t) {
    const NU = BNU + 1;
    for (let j = 0; j <= BNV; j++) {
      const v = j / BNV;
      for (let i = 0; i <= BNU; i++) {
        const u = -1 + 2 * i / BNU;
        const d = Math.pow(v, 1.15) * (0.42 * sin(TAU * b.n1 * t / D - 6.5 * v + b.p1 + 0.5 * u)
          + 0.17 * sin(TAU * b.n2 * t / D - 12.5 * v + b.p2 - 1.2 * u)
          + 0.07 * sin(TAU * b.n3 * t / D - 22 * v + b.p3 + 2.2 * u))
          + 0.11 * sin(Math.PI * 2.5 * (u + 1)) * (0.6 + 0.4 * v);
        const sw = 0.28 * v * v * sin(TAU * t / D + b.p4) + 0.06 * v * sin(TAU * 2 * t / D + b.p2);
        const lift = 0.02 * d * d;
        const k = j * NU + i;
        const ox = u * b.hw + sw;
        BVX[k] = b.cx + b.tx * ox + b.nx * d;
        BVY[k] = b.cy - v * b.L + lift;
        BVZ[k] = b.cz + b.tz * ox + b.nz * d;
      }
    }
    for (let j = 0; j <= BNV; j++) for (let i = 0; i <= BNU; i++) {
      const k = j * NU + i;
      const i0 = i > 0 ? k - 1 : k, i1 = i < BNU ? k + 1 : k, j0 = j > 0 ? k - NU : k, j1 = j < BNV ? k + NU : k;
      const ux = BVX[i1] - BVX[i0], uy = BVY[i1] - BVY[i0], uz = BVZ[i1] - BVZ[i0];
      const vx = BVX[j1] - BVX[j0], vy = BVY[j1] - BVY[j0], vz = BVZ[j1] - BVZ[j0];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = 1 / sqrt(nx * nx + ny * ny + nz * nz + 1e-12);
      BNX[k] = nx * l; BNY[k] = ny * l; BNZ[k] = nz * l;
      BOK[k] = proj(BVX[k], BVY[k], BVZ[k]) ? 1 : 0;
      BSX[k] = PX; BSY[k] = PY; BIZ[k] = 1 / PZ;
    }
  }
  function bannerAlbedo(b, u, v) {
    // u in -1..1, v in 0..1 down; X, Y metres from the top centre
    const X = u * b.hw, Y = v * b.L;
    if (abs(u) > 0.88) return 2; // gold edging
    if (Y < 0.35) return 3;       // dark heading
    const cy = Math.min(3.4, b.L * 0.32), r = Math.hypot(X, Y - cy);
    let ch = false;
    switch (b.shape) {
      case 0: ch = r < 0.62; break;                                       // roundel
      case 1: ch = abs(Y - cy - 0.3 + abs(X) * 0.95) < 0.24; break;        // chevron
      case 2: ch = abs(X) < 0.24; break;                                  // pale
      case 3: ch = abs(Y - cy - X * 1.4) < 0.3; break;                    // bend
      case 4: ch = abs(X) + abs(Y - cy) * 0.62 < 0.62; break;             // lozenge
      case 5: ch = r < 0.65 && Math.hypot(X - 0.26, Y - cy - 0.12) > 0.52; break; // crescent
      case 6: ch = Y > 1.2 && Y < cy + 2.2 && fract((Y - 1.2) / 0.85) < 0.36; break; // bars
      case 7: { const a = Math.atan2(Y - cy, X); ch = r < 0.34 + 0.32 * Math.pow(abs(cos(a * 4)), 6); break; } // star
      default: ch = r > 0.36 && r < 0.6; break;                           // annulet
    }
    if (b.shape !== 2 && b.shape !== 6 && abs(Y - (b.L - 1.6)) < 0.1) ch = true; // a band near the foot
    return ch ? 1 : 0;
  }
  function drawBanner(b, t) {
    bannerGeom(b, t);
    const NU = BNU + 1;
    for (let j = 0; j < BNV; j++) for (let i = 0; i < BNU; i++) {
      const k00 = j * NU + i, k10 = k00 + 1, k01 = k00 + NU, k11 = k01 + 1;
      if (!BOK[k00] || !BOK[k10] || !BOK[k01] || !BOK[k11]) continue;
      rasterTri(b, k00, k10, k11, i, j);
      rasterTri(b, k00, k11, k01, i, j);
    }
  }
  function rasterTri(b, a, c, d, ci, cj) {
    const ax = BSX[a], ay = BSY[a], bx = BSX[c], by = BSY[c], cx = BSX[d], cy = BSY[d];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (abs(area) < 1e-6) return;
    const x0 = Math.max(0, fl(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, fl(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x0 > x1 || y0 > y1) return;
    const ia = 1 / area;
    const za = BIZ[a], zb = BIZ[c], zc = BIZ[d];
    const NU = BNU + 1;
    const ua = -1 + 2 * (a % NU) / BNU, ub = -1 + 2 * (c % NU) / BNU, uc = -1 + 2 * (d % NU) / BNU;
    const va = fl(a / NU) / BNV, vb = fl(c / NU) / BNV, vc = fl(d / NU) / BNV;
    for (let py = y0; py <= y1; py++) {
      const sy = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const i = py * W + px;
        if (MASK && !MASK[i]) continue;
        const sx = px + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) * ia;
        const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) * ia;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const iz = w0 * za + w1 * zb + w2 * zc, z = 1 / iz;
        if (z >= ZB[i]) continue;
        const p0 = w0 * za * z, p1 = w1 * zb * z, p2 = w2 * zc * z;
        const u = p0 * ua + p1 * ub + p2 * uc, v = p0 * va + p1 * vb + p2 * vc;
        // swallowtails and points
        const tl = 0.1 * b.L / 11.6;
        if (b.tail === 0 && v > 1 - tl * (1 - abs(u))) continue;
        if (b.tail === 1 && v > 1 - tl * abs(u)) continue;
        const x = p0 * BVX[a] + p1 * BVX[c] + p2 * BVX[d];
        const y = p0 * BVY[a] + p1 * BVY[c] + p2 * BVY[d];
        const zz = p0 * BVZ[a] + p1 * BVZ[c] + p2 * BVZ[d];
        let nx = p0 * BNX[a] + p1 * BNX[c] + p2 * BNX[d], ny = p0 * BNY[a] + p1 * BNY[c] + p2 * BNY[d], nz = p0 * BNZ[a] + p1 * BNZ[c] + p2 * BNZ[d];
        let vx = OX - x, vy = OY - y, vz = OZ - zz; const vl = 1 / sqrt(vx * vx + vy * vy + vz * vz); vx *= vl; vy *= vl; vz *= vl;
        const nl = 1 / sqrt(nx * nx + ny * ny + nz * nz + 1e-12); nx *= nl; ny *= nl; nz *= nl;
        let ndv = nx * vx + ny * vy + nz * vz;
        if (ndv < 0) { nx = -nx; ny = -ny; nz = -nz; ndv = -ndv; }
        const al = bannerAlbedo(b, u, v);
        let ar, ag, ab;
        if (al === 2) { ar = 0.72; ag = 0.52; ab = 0.2; }
        else if (al === 3) { ar = b.f[0] * 0.5; ag = b.f[1] * 0.5; ab = b.f[2] * 0.5; }
        else if (al === 1) { ar = b.c[0]; ag = b.c[1]; ab = b.c[2]; }
        else { ar = b.f[0]; ag = b.f[1]; ab = b.f[2]; }
        lightUp(x, y, zz, nx, ny, nz, vx, vy, vz, b.lights, 0, false);
        // window light from behind / above, and silk sheen
        const fold = 0.3 + 0.7 * Math.max(0, nx * -b.nx * 0.2 + ny * 0.3 + ndv * 0.75);
        const sheen = Math.pow(1 - ndv, 3) * 0.12;
        const amb = 0.2 + 0.08 * (1 - v);
        OR = ar * (LR + amb) * fold * 1.25 + sheen * 0.9;
        OG = ag * (LG + amb) * fold * 1.25 + sheen * 0.75;
        OB = ab * (LB + amb * 1.1) * fold * 1.25 + sheen * 0.6;
        if (al === 2) { env(2 * ndv * nx - vx, 2 * ndv * ny - vy, 2 * ndv * nz - vz); OR += ER * 0.8; OG += EG * 0.6; OB += EB * 0.3; }
        ZB[i] = z; BR[i] = OR; BG[i] = OG; BB[i] = OB; GMT[i] = -1;
      }
    }
  }

  /* ================================================================ volumetric shafts + dust */
  function shaftPass(t) {
    for (let s = 0; s < SHAFT.length; s++) {
      const sh = SHAFT[s], m = sh.m, qx = OX - sh.cx, qy = OY - sh.cy, qz = OZ - sh.cz;
      sh.u0 = m[0] * qx + m[1] * qy + m[2] * qz; sh.v0 = m[3] * qx + m[4] * qy + m[5] * qz; sh.l0 = m[6] * qx + m[7] * qy + m[8] * qz;
    }
    for (let py = 0; py < H; py++) {
      const b = (py + 0.5 - CYS) / FOC;
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const a = (px + 0.5 - CXS) / FOC;
        const dx = FX + RX * a - UX * b, dy = FY + RY * a - UY * b, dz = FZ + RZ * a - UZ * b;
        const tmax = Math.min(ZB[i], 70);
        let acc = 0;
        for (let s = 0; s < SHAFT.length; s++) {
          const sh = SHAFT[s], m = sh.m;
          const u0 = sh.u0, du = m[0] * dx + m[1] * dy + m[2] * dz;
          const v0 = sh.v0, dv = m[3] * dx + m[4] * dy + m[5] * dz;
          const l0 = sh.l0, dl = m[6] * dx + m[7] * dy + m[8] * dz;
          let t0 = 0, t1 = tmax;
          if (abs(du) < 1e-9) { if (abs(u0) > sh.hw) continue; } else {
            let ta = (-sh.hw - u0) / du, tb = (sh.hw - u0) / du; if (ta > tb) { const w = ta; ta = tb; tb = w; }
            if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
          }
          if (t0 >= t1) continue;
          if (abs(dv) < 1e-9) { if (v0 < sh.vmin || v0 > sh.vmax) continue; } else {
            let ta = (sh.vmin - v0) / dv, tb = (sh.vmax - v0) / dv; if (ta > tb) { const w = ta; ta = tb; tb = w; }
            if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
          }
          if (t0 >= t1) continue;
          if (abs(dl) < 1e-9) { if (l0 < 0) continue; } else {
            const ta = -l0 / dl; if (dl > 0) { if (ta > t0) t0 = ta; } else { if (ta < t1) t1 = ta; }
          }
          if (t0 >= t1) continue;
          const len = t1 - t0, n = Math.min(7, 2 + fl(len / 1.4)), st = len / n;
          let sum = 0;
          let tt = t0 + st * bay(px, py);
          for (let q = 0; q < n; q++, tt += st) {
            const u = u0 + du * tt, v = v0 + dv * tt;
            const au = abs(u), vtop = sh.vmax - WIN_ARCH * 0.6 * (au / sh.hw) * (au / sh.hw);
            if (v > vtop) continue;
            let e = Math.min(1, (sh.hw - au) * 2.5);
            const y = OY + dy * tt;
            if (y < 0) continue;
            e *= Math.min(1, (v - sh.vmin) * 0.8) * (0.55 + 0.45 * Math.min(1, y / 3));
            if (e <= 0) continue;
            e *= shadowAt(OX + dx * tt, y, OZ + dz * tt);
            sum += e;
          }
          acc += sum * st * sh.I;
        }
        if (acc > 0) {
          const h = (1 - Math.exp(-acc * 0.16)) * 0.3;
          BR[i] += h * 1.0; BG[i] += h * 0.94; BB[i] += h * 0.84;
        }
      }
    }
  }
  function dustPass(t) {
    for (let k = 0; k < DUST.length; k++) {
      const m = DUST[k], sh = SHAFT[m.s];
      const a = TAU * m.sn * t / D + m.sp;
      const u = m.u + m.sr * cos(a);
      const v = m.v + m.sr * 0.8 * sin(a) + m.va * wave(m.vn, t, m.vp);
      const l = m.lam + m.la * wave(m.ln, t, m.lp);
      // shaft basis back to world: columns T, U, S
      const phiT = Math.atan2(sh.cz, sh.cx);
      const x = sh.cx - sin(phiT) * u + SX * l, y = sh.cy + v + SY * l, z = sh.cz + cos(phiT) * u + SZ * l;
      if (y < 0.05) continue;
      const sv = sunAt(x, y, z);
      if (sv <= 0.05) continue;
      if (!proj(x, y, z)) continue;
      const ix = fl(PX), iy = fl(PY);
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      const i = iy * W + ix;
      if (PZ >= ZB[i]) continue;
      const tw_ = 0.5 + 0.5 * wave(m.tn, t, m.tp);
      const br = sv * m.b * (0.25 + 0.75 * tw_ * tw_) * Math.min(1, 9 / PZ) * 0.9;
      BR[i] += br; BG[i] += br * 0.9; BB[i] += br * 0.7;
      if (PZ < 7 && br > 0.25) { const j = ix + 1 < W ? i + 1 : i; BR[j] += br * 0.5; BG[j] += br * 0.45; BB[j] += br * 0.35; }
    }
  }

  /* ================================================================ frame */
  function sceneObjects(t) {
    for (let k = 0; k < BAN.length; k++) drawBanner(BAN[k], t);
    for (let k = 0; k < SEG.length; k++) drawBlade(SEG[k]);
    for (let k = 0; k < SPH.length; k++) drawSph(SPH[k]);
    for (let k = 0; k < CAP.length; k++) drawCap(CAP[k], null);
    drawFlames(t);
    resolve();
    drawGlows();
  }
  function updateLights(t) {
    for (let k = 0; k < LX.length; k++) {
      const p = LPH[k];
      LI[k] = LI0[k] * (1 + 0.1 * wave(7, t, p[0]) + 0.06 * wave(17, t, p[1]) + 0.04 * wave(29, t, p[2]));
    }
    for (let k = 0; k < WIN_N; k++) {
      const phi = (k + 0.5) * TAU / WIN_N, dphi = Math.atan2(sin(phi - SUN_PHI), cos(phi - SUN_PHI));
      const sunny = Math.max(0, cos(dphi));
      WINS[k] = Math.pow(sunny, 2); WINB[k] = 0.36 + 0.95 * WINS[k] + 0.04 * wave(1, t, k);
    }
  }
  function drawFrame(t, g, cw, ch) {
    t = ((t % D) + D) % D;
    updateLights(t);
    buildLightmap();
    const cam = camAt(t);
    const PR = window.__ttprof = {}; let T0 = performance.now();
    const mark = (k) => { const n = performance.now(); PR[k] = +(n - T0).toFixed(1); T0 = n; };
    mark('lm');
    // main background first (to know where the floor is seen)
    useCam(cam, false); target(false); prepBG(); bgPass(); mark('bg');
    // mirror pass: the hall seen in the floor
    useCam(cam, true); target(true); prepBG(); bgPass(); mark('mbg'); sceneObjects(t); mark('mobj');
    // back to the real camera
    useCam(cam, false); target(false);
    floorPass(); mark('floor');
    sceneObjects(t); mark('obj');
    shaftPass(t); mark('shaft');
    dustPass(t); mark('dust');
    // quantise
    for (let py = 0; py < H; py++) {
      const vy = (py - CYS) / H;
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const vx = (px - CXS) / W;
        const vig = 1 - 0.55 * (vx * vx * 1.1 + vy * vy * 0.9);
        const d = (bay(px, py) - 0.5) * 20;
        let r = BR[i] * vig * 255 + d, gg = BG[i] * vig * 255 + d, b = BB[i] * vig * 255 + d;
        r = r < 0 ? 0 : r > 255 ? 255 : r; gg = gg < 0 ? 0 : gg > 255 ? 255 : gg; b = b < 0 ? 0 : b > 255 ? 255 : b;
        const li = ((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3);
        OUT[i] = EMI[i] ? LUT[li] : LUTS[li]; EMI[i] = 0;
      }
    }
    present(g, cw, ch);
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SCX = null;
  function present(g, cw, ch) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SCX = SMALL.getContext('2d'); IMG = SCX.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SCX.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const k = Math.max(cw / W, ch / H);
    const dw = W * k, dh = H * k;
    g.drawImage(SMALL, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  }

  /* ================================================================ mount */
  let BUILT = false;
  function init() {
    if (BUILT) return;
    buildLUT();
    buildCandles();
    buildThrone();
    buildHall();
    LI = new Float32Array(LX.length);
    for (let k = 0; k < LX.length; k++) LI[k] = LI0[k];
    THRONE_L = [];
    for (let k = 0; k < LX.length; k++) if (Math.hypot(LX[k], LZ[k]) < 7.5) THRONE_L.push(k);
    for (let k = 0; k < WIN_N; k++) {
      const a = (k + 0.5) * TAU / WIN_N, x = WALL_R * cos(a), z = WALL_R * sin(a), l = [];
      for (let q = 0; q < LX.length; q++) if (Math.hypot(LX[q] - x, LZ[q] - z) < sqrt(LRM2[q]) + 4) l.push(q);
      WALL_L[k] = nearestLights(l, x, z, 4);
    }
    LISTS.length = 0; LISTS.push(THRONE_L);
    for (const c of CAP) {
      const mx = (c.ax + c.bx) / 2, mz = (c.az + c.bz) / 2;
      if (Math.hypot(mx, mz) < 6) { c.li = 0; continue; }
      const l = [];
      for (let q = 0; q < LX.length; q++) if (Math.hypot(LX[q] - mx, LZ[q] - mz) < 5) l.push(q);
      c.li = LISTS.length; LISTS.push(l);
    }
    buildShadowMap();
    BUILT = true;
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'the-throne',
    title: 'The Throne',
    medium: 'Pixel art in 45 colours, 270 × 338, drawn in JavaScript · 24 s loop',
    note: 'One slow turn around a seat of a thousand swords · tap to pause',
    about: 'A throne forged from hundreds of fused swords, all spikes, twisted blades and melted hilts, high on a stepped dais in a vast, dark round hall. The camera makes one full turn around it: pillars sweep past in front and behind, sun shafts from the high windows carry swirling dust, seven hundred candles flicker on iron stands and pool their light on the polished floor, and long banners in jewel colours ripple in the draught. Every blade is a small 3D shape, so its glint slides along it as the view turns. Inspired by the novels of George R. R. Martin; an unofficial fan tribute.',
    tone: 'dark',
    room: '#06050a',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = '#06050a';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,236,220,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,236,220,.8)"/></svg>';
      el.appendChild(pauseMark);
      let CW = W * 4, CH = H * 4;
      function layout() {
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; CW = 1080; CH = 1350;
          cv.style.position = 'fixed';
          cv.width = CW; cv.height = CH;
        } else {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          let k = Math.max(1, Math.floor(fit));
          if (k < fit * 0.86) k = fit;
          CW = Math.round(W * k); CH = Math.round(H * k);
          cssW = CW / dpr; cssH = CH / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      SEED = 7;
      init();
      drawFrame(0, g, CW, CH);
      const hook = {
        duration: D,
        isReady: () => {
          if (!BUILT) return false;
          if (!EXPORT) return true;
          const st = el.parentElement;
          return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999;
        },
        renderAt(t) {
          return new Promise((res) => {
            playing = false; clock = t;
            const t0 = performance.now();
            drawFrame(t, g, CW, CH);
            hook.lastMs = performance.now() - t0;
            requestAnimationFrame(() => requestAnimationFrame(res));
          });
        },
        lastMs: 0,
      };
      window.__thethrone = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'the-throne';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        drawFrame(clock, g, CW, CH);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); drawFrame(clock, g, CW, CH); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__thethrone === hook) delete window.__thethrone;
        },
      };
    },
  });
})();
