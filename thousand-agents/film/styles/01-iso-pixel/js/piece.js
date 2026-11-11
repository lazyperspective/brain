/* 1000 Agents — the film, section 2 of 7: CODE (5.0–10.5 s, rendered 4.6–10.9 s), as a 2.5D isometric pixel diorama.
   Extended from the 3 s style preview. Pure Canvas 2D. The scene is a small voxel world projected with the classic 2:1 pixel
   isometric projection into a 384x216 buffer with a depth buffer, shown at exactly 5x with smoothing off.
   Agents march in from the upper left along the grid axes carrying lilac code blocks, turn down the streets between the
   files, drop their block on a stack and march out to the lower right. Stacks of blocks become files; files make tidy rows. */
FILM.define('01-iso-pixel', function (canvas, opts) {
  'use strict';
  const W = 384, H = 216, SCALE = 5;
  const OX = 190, OY = 165;
  const PI = Math.PI, TAU = PI * 2, fl = Math.floor;
  const FM = FILM.m;
  const clamp = FM.clamp, c01 = FM.sat, lerp = FM.lerp;
  const seg = (a, b, t) => c01((t - a) / (b - a));
  const eio = (k) => k * k * (3 - 2 * k);
  const eo = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
  function ih(a, b) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const DW = 0.3;
  function quant(v, levels, x, y) { const s = v * levels, i = fl(s), f = s - i; return (i + (f > 1 - DW && bay(x, y) < (f - (1 - DW)) / DW ? 1 : 0)) / levels; }

  const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const C = {
    coral: hex('d97757'), cord: hex('a8553b'), corl: hex('f2a585'), cdark: hex('6e2a1a'), cream: hex('ffe2cf'),
    cmid: hex('c26548'), edge: hex('f8c4aa'), cdeep: hex('8a4230'),
    white: hex('ffffff'), black: hex('0a0610'),
    lilac: hex('a9a3e6'), violet: hex('6c64bd'), vmid: hex('4d4799'), vdim: hex('37336b'), vdeep: hex('24204d'),
    teal: hex('5fd6c4'), tealD: hex('2f8f86'),
  };

  /* ------------------------------------------------------------------ buffers */
  const BUF = new Float32Array(W * H * 3), BG = new Float32Array(W * H * 3), DEP = new Float32Array(W * H);
  const RB = new Float32Array(W * H * 3), RA = new Float32Array(W * H), RD = new Float32Array(W * H);
  function pset(x, y, c, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    if (a === undefined || a >= 1) { BUF[i] = c[0]; BUF[i + 1] = c[1]; BUF[i + 2] = c[2]; }
    else if (a > 0) { BUF[i] += (c[0] - BUF[i]) * a; BUF[i + 1] += (c[1] - BUF[i + 1]) * a; BUF[i + 2] += (c[2] - BUF[i + 2]) * a; }
  }
  function dput(x, y, c, d) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x; if (d <= DEP[p]) return;
    DEP[p] = d; const i = p * 3; BUF[i] = c[0]; BUF[i + 1] = c[1]; BUF[i + 2] = c[2];
  }
  function rput(x, y, c, d, a) {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const p = y * W + x; if (d <= RD[p]) return;
    RD[p] = d; RA[p] = a; const i = p * 3; RB[i] = c[0]; RB[i + 1] = c[1]; RB[i + 2] = c[2];
  }
  function glow(cx, cy, rx, ry, c, a, levels) {
    if (a <= 0) return;
    const x0 = Math.max(0, fl(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx)), y0 = Math.max(0, fl(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry); if (d >= 1) continue;
      const k = quant((1 - d) * (1 - d) * a, levels, x, y); if (k <= 0) continue;
      const i = (y * W + x) * 3; BUF[i] += c[0] * k; BUF[i + 1] += c[1] * k; BUF[i + 2] += c[2] * k;
    }
  }
  const prx = (x, y) => OX + x - y, pry = (x, y, z) => OY + (x + y) / 2 - z;

  /* ------------------------------------------------------------------ the floor */
  const GRID = 16, FLC = [-6, -22];
  (function buildBG() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x + 0.5 - OX, v = y + 0.5 - OY, wx = v + u / 2, wy = v - u / 2;
      const dd = Math.hypot(wx - FLC[0], wy - FLC[1]);
      const d = Math.min(1, dd / 300), k0 = (1 - d) * (1 - d), k = quant(k0, 14, x, y);
      let r = 9 + 21 * k, g = 7 + 15 * k, b = 22 + 50 * k;
      const mx = wx - Math.floor(wx / GRID) * GRID, my = wy - Math.floor(wy / GRID) * GRID, gx = mx < 0.5, gy = my < 0.5;
      const gf = 1.7 * c01(1.1 - dd / 175);
      if (gx || gy) { const q = gf * (gx && gy ? 2.4 : 1); r += 7 * q; g += 6 * q; b += 17 * q; }
      const i = (y * W + x) * 3; BG[i] = r; BG[i + 1] = g; BG[i + 2] = b;
    }
  })();

  /* ------------------------------------------------------------------ voxel models */
  class Model {
    constructor(nx, ny, nz, ox, oy) { this.nx = nx; this.ny = ny; this.nz = nz; this.ox = ox; this.oy = oy; this.g = new Uint8Array(nx * ny * nz); }
    clear() { this.g.fill(0); }
    set(x, y, z, m) { x = Math.round(x) + this.ox; y = Math.round(y) + this.oy; z = Math.round(z); if (x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz) this.g[(z * this.ny + y) * this.nx + x] = m; }
    box(x, y, z, w, d, h, m) { for (let k = 0; k < h; k++) for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, z + k, m); }
    draw(wx, wy, wz, mats, mirror, ra) {
      const ax = Math.round(prx(wx, wy)), bd = wx + wy + wz, { nx, ny, nz, g } = this;
      const ay = Math.round(pry(wx, wy, mirror ? 0 : wz)), mz = Math.round(wz), RA0 = ra == null ? 0.3 : ra;
      for (let z = 0; z < nz; z++) for (let yy = 0; yy < ny; yy++) for (let xx = 0; xx < nx; xx++) {
        const m = g[(z * ny + yy) * nx + xx]; if (!m) continue;
        const x = xx - this.ox, y = yy - this.oy, M = mats[m], up = z + 1 < nz ? g[((z + 1) * ny + yy) * nx + xx] : 0;
        const cl = ax + x - y - 1, base = ay + ((x + y) >> 1), cf = up ? M.f : M.fe, cs = up ? M.s : M.se;
        if (mirror) {
          const py = base + z + mz + 1, d = bd + x + y - z, a = RA0 * (1 - (z + mz) / 26);
          rput(cl, py, cf, d, a); rput(cl + 1, py, cs, d, a);
        } else {
          const py = base - z, d = bd + x + y + z;
          if (!up) { dput(cl, py - 1, M.t, d + 0.1); dput(cl + 1, py - 1, M.t, d + 0.1); }
          dput(cl, py, cf, d); dput(cl + 1, py, cs, d);
        }
      }
    }
  }
  const mat = (t, f, s, fe, se) => ({ t, f, s, fe: fe || f, se: se || s });
  const flat = (c) => mat(c, c, c);

  /* ------------------------------------------------------------------ the hero (a slightly larger voxel build than the preview, to hold the anchor size) */
  const HM = new Model(84, 24, 56, 42, 2), BODY = 1, BASE = 2, LEGF = 3, LEGB = 4, BLK = 5, WHT = 6, ARM = 7, MOU = 8;
  const BD = 15, LH = 8;
  function heroMats(lit) {
    const s = mix(C.cord, C.coral, lit * 0.75), se = mix(C.cmid, C.corl, lit * 0.8);
    const M = [];
    M[BODY] = mat(C.corl, C.coral, s, C.edge, se);
    M[BASE] = mat(C.corl, C.cord, mix(C.cdeep, C.cord, lit * 0.7), C.coral, se);
    M[LEGF] = mat(C.coral, C.coral, mix(C.cord, C.cmid, lit));
    M[LEGB] = mat(C.cord, C.cord, C.cdeep);
    M[ARM] = mat(C.corl, C.coral, s, C.edge, se);
    M[BLK] = flat(C.black); M[WHT] = flat(C.white); M[MOU] = flat(C.cdark);
    return M;
  }
  function buildHero(o) {
    HM.clear();
    const sq = o.sq || 0, bw = Math.round(33 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(13, Math.round(25 * (1 - sq * 0.4)));
    const x0 = -bw / 2, x1 = x0 + bw - 1, zb = LH, zt = LH + bh - 1, yf = BD - 1;
    const lift = o.legs || [0, 0, 0, 0], inx = Math.round(bw * 0.2);
    const legs = [[x0 + 1, BD - 6, LEGF], [x0 + 1 + inx, 1, LEGB], [x1 - 5 - inx, 1, LEGB], [x1 - 5, BD - 6, LEGF]];
    for (let k = 0; k < 4; k++) { const l = Math.min(LH - 1, lift[k] | 0); HM.box(legs[k][0], legs[k][1], l, 5, 5, LH - l, legs[k][2]); }
    for (let z = zb; z <= zt; z++) for (let y = 0; y < BD; y++) for (let x = x0; x <= x1; x++) {
      const e = (x === x0 || x === x1 ? 1 : 0) + (y === 0 || y === yf ? 1 : 0) + (z === zb || z === zt ? 1 : 0); if (e >= 2) continue;
      HM.set(x, y, z, z <= zb + 1 || (z === zb + 2 && (x & 1) && y === yf) ? BASE : BODY);
    }
    const ah = Math.max(3, Math.round(bh * 0.3)), sz = zt - Math.round(bh * 0.36) - ah / 2 + 0.5, armA = o.armA || 0, reach = o.reach || 0;
    const limb = (sx, a, len, y0) => { const ca = Math.cos(a), sa = Math.sin(a); for (let q = 0; q <= len; q += 0.5) for (let v = -ah / 2 + 0.25; v < ah / 2; v += 0.5) for (let y = 0; y < 5; y++) HM.set(sx + ca * q - sa * v, y0 + y, sz + sa * q + ca * v, ARM); };
    limb(x0 - 0.5, PI - armA * 0.5, 4.5, BD - 5); limb(x1 + 0.5, armA, 3.4 + reach, BD - 8);
    const lk = o.look || [0, 0], e = o.eyes || 'normal';
    const ex0 = x0 + Math.round(bw * 0.17) + lk[0], ex1 = x1 + 1 - Math.round(bw * 0.17) - 3 + lk[0], ez = zt - Math.round(bh * 0.28) + lk[1];
    const eye = (ex, side) => {
      if (e === 'closed') { HM.box(ex, yf, ez - 2, 3, 1, 1, BLK); return; }
      HM.box(ex, yf, ez - 3, 3, 1, 4, BLK); HM.set(ex + (side < 0 ? 0 : 2), yf, ez, WHT);
    };
    eye(ex0, -1); eye(ex1, 1);
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 5 : 2, mz = ez - 6; HM.box(-mw / 2, yf, mz - mh + 1, mw, 1, mh, BLK); if (o.mouth > 1) HM.box(-mw / 2 + 1, yf, mz - mh + 1, mw - 2, 1, 1, MOU); }
    return { bw, bh };
  }
  // the shared performance, translated into voxels: the anchor is world (-34, 0) on the floor
  const HERO_X = -34;
  function heroAt(T) {
    const s = FILM.heroAt(T);
    const o = { sq: s.sq * 1.6, legs: [0, 0, 0, 0], look: [Math.round(s.look[0] * 1.2), Math.round(s.look[1] * 1.4)], eyes: s.blink > 0.5 ? 'closed' : 'normal',
      mouth: s.mouth > 0.5 ? 2 : s.mouth > 0.15 ? 1 : 0, armA: 1.3 * s.arm + 0.12 * s.point, reach: 4 * s.arm + 7 * s.point };
    if (s.moving) { const l = s.air > 0.5 ? 2 : 1; o.legs = [1, l, l, 2]; }
    return { x: HERO_X + s.dx * 20, z: s.lift * 27, o };
  }

  /* ------------------------------------------------------------------ the folder: still open and glowing from the sketch; it sinks into the floor */
  const FMd = new Model(36, 26, 28, 1, 1), PAN = 1, LID = 2, G0 = 3, G1 = 4, G2 = 5, G3 = 6, SCAN = 7, FRT = 8;
  const FW = 30, FX = -5, FY = -47;
  const FCX = FX + FW / 2, FCY = FY + 4;
  function folderMats(op) {
    const M = [];
    M[PAN] = mat(C.lilac, C.vmid, C.vdim, C.violet, C.vmid);
    M[FRT] = mat(mix(C.lilac, C.cream, op), C.vmid, C.vdim, mix(C.lilac, C.corl, op), mix(C.vmid, C.coral, op * 0.8));
    M[LID] = mat(C.vdeep, C.vdeep, C.vdeep);
    M[G0] = flat(C.cream); M[G1] = flat(C.corl); M[G2] = flat(C.coral); M[G3] = flat(mix(C.cord, C.vmid, 0.35));
    M[SCAN] = flat(mix(C.lilac, C.white, 0.5));
    return M;
  }
  const frontY = (z, op) => 5 + Math.round(op * 9 * z / 17);
  function buildFolder(op, reveal) {
    FMd.clear();
    const zr = reveal * 24, cut = (z) => z <= zr, top = fl(zr), growing = reveal < 1;
    const put = (x, y, z, m) => { if (cut(z)) FMd.set(x, y, z, growing && z === top ? SCAN : m); };
    for (let x = 0; x < FW; x++) {
      const hb = 20 + (x <= 1 ? 2 : x <= 10 ? 3 : x <= 12 ? 13 - x : 0) - (x === FW - 1 ? 1 : 0);
      for (let z = 0; z < hb; z++) {
        let m = PAN;
        if (op > 0.02) { const k = z / (2 + op * 19); m = k < 0.3 ? G0 : k < 0.52 ? G1 : k < 0.78 ? G2 : k < 1 ? G3 : PAN; if (x === 0 || x === FW - 1) m = PAN; }
        put(x, 0, z, PAN); put(x, 1, z, m);
      }
      const hf = 18 - (x === 0 || x === FW - 1 ? 1 : 0);
      for (let z = 0; z < hf; z++) { const y = frontY(z, op); put(x, y, z, FRT); put(x, y + 1, z, FRT); }
      if (op > 0.02 && x > 0 && x < FW - 1) { for (let z = 0; z < 2; z++) for (let y = 2; y < frontY(z, op); y++) put(x, y, z, G0); }
    }
  }

  /* ------------------------------------------------------------------ the files: a 4 x 3 grid of stacks of code blocks */
  const COLS = [-4, 9, 22, 35], ROWS = [-50, -37.5, -25], NLAY = 8, SW = 8;
  const STACKS = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) STACKS.push({ c, r, x: COLS[c], y: ROWS[r] });
  // completion order: first two at the hero's hops (7.62, 8.70), then the rest
  const DONE = [7.62, 8.70, 8.95, 9.15, 9.3, 9.45, 9.6, 9.72, 9.84, 9.95, 10.06, 10.16];
  const ORDER = [5, 2, 6, 1, 9, 10, 4, 7, 0, 3, 8, 11];        // stack index completing at DONE[k]
  STACKS.forEach((s) => { s.done = DONE[ORDER.indexOf(STACKS.indexOf(s))]; s.start = 5.75 + 0.18 * ORDER.indexOf(STACKS.indexOf(s)) * 0.6; });
  function layersAt(s, T) {                                   // how many blocks the stack holds (fractional: the newest is still falling)
    if (T < s.start) return 0;
    const u = c01((T - s.start) / (s.done - s.start));
    return Math.min(NLAY, u * NLAY);
  }
  const SM = new Model(SW + 2, SW + 2, NLAY * 2 + 8, SW / 2 + 1, SW / 2 + 1), L0 = 1, L1 = 2, CODE = 3, CODE2 = 4, TK = 5;
  const stackMats = [null, mat(C.lilac, C.vmid, C.vdim, C.violet, C.vmid), mat(C.lilac, C.violet, C.vmid, C.lilac, C.violet),
    mat(C.vmid, C.vmid, C.vmid), mat(C.violet, C.violet, C.violet), mat(C.teal, C.tealD, C.tealD)];
  function buildStack(s, T) {
    SM.clear();
    const n = layersAt(s, T), full = fl(n), frac = n - full;
    for (let k = 0; k < full; k++) {
      SM.box(-SW / 2, -SW / 2, k * 2, SW, SW, 1, L0); SM.box(-SW / 2, -SW / 2, k * 2 + 1, SW, SW, 1, L1);
    }
    let topZ = full * 2;
    if (frac > 0 && full < NLAY) {                           // the newest block, settling into place
      const drop = Math.round((1 - eo(c01(frac * 3))) * 5);
      SM.box(-SW / 2, -SW / 2, topZ + drop, SW, SW, 1, L0); SM.box(-SW / 2, -SW / 2, topZ + drop + 1, SW, SW, 1, L1);
    }
    // the top block shows its code: short lines of marks
    if (full > 0) {
      const z = full * 2 - 1;
      for (let row = 0; row < 3; row++) {
        const len = 2 + fl(ih(STACKS.indexOf(s) * 7 + row, full) * 4);
        for (let i = 0; i < len; i++) SM.set(-SW / 2 + 1 + i, -SW / 2 + 1 + row * 2 + 1, z, row === 0 ? CODE2 : CODE);
      }
    }
    // a teal tick on a finished file
    if (T >= s.done) {
      const k = c01((T - s.done) / 0.2), z = NLAY * 2 + Math.round(3 * (1 - eo(k)));
      SM.set(-1, 1, z, TK); SM.set(0, 2, z + 1, TK); SM.set(1, 1, z + 2, TK); SM.set(2, 0, z + 3, TK);
    }
    return topZ;
  }

  /* ------------------------------------------------------------------ the agents: one-way conveyor paths along the grid axes
     column c: in along +x on lane y = LANEY[c] (from off-screen upper left), down its street x = COLS[c]+6.5 along +y,
     past its stacks (dropping its block at its own row), out along +x at y = EXITY to the lower right (off-screen). */
  const LANEY = [-62, -64.5, -67, -69.5], EXITY = -14, V = 34;
  const PATHS = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) {
    const xs = COLS[c] + 6.6;
    const pts = [[xs, -330 - xs], [xs, EXITY], [xs + 230, EXITY]];
    let len = 0; const cum = [0];
    for (let k = 1; k < pts.length; k++) { len += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]); cum.push(len); }
    const drop = ROWS[r] - (-330 - xs);
    PATHS.push({ pts, cum, len, drop, c, r });
  }
  const AGP = [];
  for (let i = 0; i < FILM.N; i++) {
    const A = FILM.AG[i], pi = Math.floor(A.r[0] * 12), P = PATHS[pi];
    AGP.push({ pi, side: (i & 1 ? 1 : -1) * 0.9, ph: A.r[1], te: A.te, ph2: A.r[2] * TAU });
  }
  const T_IN = 4.6;                                           // agents out before this are already marching
  function agentAt(i, T, out) {
    const g = AGP[i], P = PATHS[g.pi];
    if (T < g.te) return false;
    let s;
    if (g.te <= T_IN) s = (g.ph * P.len + (T - T_IN) * V) % P.len;
    else s = (T - g.te) * V;                                  // a newcomer enters at the start of its path
    if (s > P.len) s %= P.len;
    let k = 1; while (k < P.cum.length - 1 && s > P.cum[k]) k++;
    const a = P.pts[k - 1], b = P.pts[k], u = (s - P.cum[k - 1]) / (P.cum[k] - P.cum[k - 1]);
    const horiz = a[1] === b[1];
    out[0] = lerp(a[0], b[0], u) + (horiz ? 0 : g.side); out[1] = lerp(a[1], b[1], u) + (horiz ? g.side : 0);
    out[2] = Math.abs(Math.sin(T * 13 + g.ph2)) * 1.2;
    out[3] = s < P.drop ? 1 : 0;                              // still carrying its block
    return true;
  }

  /* ------------------------------------------------------------------ one frame */
  const P = [0, 0, 0, 0];
  function floorRegion(cx, cy, r, fn) {
    const sx = prx(cx, cy), sy = pry(cx, cy, 0);
    const x0 = Math.max(0, fl(sx - r * 1.5)), x1 = Math.min(W - 1, Math.ceil(sx + r * 1.5)), y0 = Math.max(0, fl(sy - r * 0.75)), y1 = Math.min(H - 1, Math.ceil(sy + r * 0.75));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const u = x + 0.5 - OX, v = y + 0.5 - OY; fn(x, y, v + u / 2, v - u / 2); }
  }
  function mul(x, y, k) { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; BUF[i] *= k; BUF[i + 1] *= k; BUF[i + 2] *= k; }
  function render(T) {
    BUF.set(BG); DEP.fill(-1e9); RD.fill(-1e9); RA.fill(0);
    const sink = eio(seg(5.55, 6.35, T)), op = 1, reveal = 1 - sink;
    const hero = heroAt(T), warmF = (1 - sink);
    const lit = warmF * 0.9;

    // grid pads under the files: faint violet outlines that appear as the folder goes
    const pa = 0.25 + 0.35 * sink;
    for (const s of STACKS) floorRegion(s.x, s.y, 9, (px, py, wx, wy) => {
      const lx = wx - s.x, ly = wy - s.y, e = SW / 2 + 1;
      if ((Math.abs(lx) <= e && Math.abs(Math.abs(ly) - e) < 0.5) || (Math.abs(ly) <= e && Math.abs(Math.abs(lx) - e) < 0.5)) pset(px, py, C.violet, pa * 0.7);
    });
    // warm light pooled on the floor from the open folder, fading as it sinks
    if (warmF > 0) floorRegion(FCX, FCY + 6, 92, (px, py, wx, wy) => {
      const d = Math.hypot(wx - FCX, (wy - FCY - 6) * 0.9) / 92; if (d >= 1) return;
      const k = quant((1 - d) * (1 - d) * (1 - d) * warmF * 0.95, 8, px, py); if (k <= 0) return;
      const i = (py * W + px) * 3; BUF[i] += 120 * k; BUF[i + 1] += 50 * k; BUF[i + 2] += 34 * k;
    });

    const dims = buildHero(hero.o);
    if (reveal > 0.01) buildFolder(op, reveal);
    const hmats = heroMats(lit * 0.6), fmats = folderMats(op);
    // shadows
    const hs = 1 - hero.z / 70, hrx = dims.bw / 2 + 4, hry = BD / 2 + 4;
    floorRegion(hero.x + 1, 1, 30, (px, py, wx, wy) => {
      const d = Math.hypot((wx - hero.x - 1) / (hrx * hs), (wy - 1) / (hry * hs)); if (d >= 1) return;
      mul(px, py, d < 0.72 || bay(px, py) > (d - 0.72) / 0.28 ? 1 - 0.62 * hs : 1);
    });
    if (reveal > 0.01) floorRegion(FCX, FCY, 30, (px, py, wx, wy) => {
      const lx = wx - FX, ly = wy - FY; if (lx > -1 && lx < FW + 2 && ly > -1 && ly < 8 + op * 9) mul(px, py, 1 - 0.55 * reveal);
    });
    for (const s of STACKS) if (layersAt(s, T) > 0) floorRegion(s.x, s.y, 9, (px, py, wx, wy) => {
      const lx = wx - s.x - 1.5, ly = wy - s.y - 1.5; if (Math.abs(lx) < SW / 2 + 1 && Math.abs(ly) < SW / 2 + 1) mul(px, py, 0.62);
    });
    // mirror images in the polished floor
    HM.draw(hero.x, -BD / 2, hero.z, hmats, true);
    if (reveal > 0.01) FMd.draw(FX, FY, 0, fmats, true);
    for (const s of STACKS) if (layersAt(s, T) > 0) { buildStack(s, T); SM.draw(s.x, s.y, 0, stackMats, true, 0.22); }
    const N = FILM.N;
    for (let i = 0; i < N; i++) {
      if (!agentAt(i, T, P)) continue;
      const sx = Math.round(prx(P[0], P[1])), fy = Math.round(pry(P[0], P[1], 0));
      if (sx < -2 || sx > W + 2 || fy < -2 || fy > H + 2) continue;
      mul(sx, fy, 0.6); mul(sx + 1, fy, 0.6);
      rput(sx, fy + 1, C.coral, P[0] + P[1], 0.3); rput(sx + 1, fy + 1, C.cord, P[0] + P[1], 0.3);
    }
    for (let p = 0; p < W * H; p++) { const a = RA[p]; if (a > 0) { const i = p * 3; BUF[i] += (RB[i] - BUF[i]) * a; BUF[i + 1] += (RB[i + 1] - BUF[i + 1]) * a; BUF[i + 2] += (RB[i + 2] - BUF[i + 2]) * a; } }

    // solid things, depth sorted
    if (reveal > 0.01) FMd.draw(FX, FY, 0, fmats, false);
    for (const s of STACKS) if (layersAt(s, T) > 0 || T >= s.done) { buildStack(s, T); SM.draw(s.x, s.y, 0, stackMats, false); }
    HM.draw(hero.x, -BD / 2, hero.z, hmats, false);
    for (let i = 0; i < N; i++) {
      if (!agentAt(i, T, P)) continue;
      const sx = Math.round(prx(P[0], P[1])), sy = Math.round(pry(P[0], P[1], P[2])), d = P[0] + P[1] + P[2];
      if (sx < -2 || sx > W + 2 || sy < -6 || sy > H + 2) continue;
      const age = T - AGP[i].te, hot = AGP[i].te > T_IN ? 1 - c01(age / 0.3) : 0;
      dput(sx, sy - 1, mix(C.corl, C.cream, 0.35 + 0.65 * hot), d + 0.1); dput(sx + 1, sy - 1, mix(C.corl, C.cream, 0.35 + 0.65 * hot), d + 0.1);
      dput(sx, sy, mix(C.coral, C.cream, hot * 0.8), d); dput(sx + 1, sy, mix(C.cord, C.corl, hot * 0.8), d);
      if (P[3]) {                                              // its code block, carried on its back
        dput(sx - 1, sy - 2, C.lilac, d + 0.3); dput(sx, sy - 2, C.lilac, d + 0.3); dput(sx + 1, sy - 2, C.lilac, d + 0.3); dput(sx + 2, sy - 2, C.violet, d + 0.3);
        dput(sx, sy - 3, C.vmid, d + 0.32); dput(sx + 1, sy - 3, C.lilac, d + 0.32);
      }
    }

    // the light in the folder's mouth, fading as it sinks
    if (warmF > 0.01) {
      const gx = prx(FCX, FCY), gy = pry(FCX, FCY, 15 * reveal);
      glow(gx, gy, 54, 42, [150, 64, 40], warmF * 0.62, 6); glow(gx, gy + 2, 20, 13, [120, 84, 60], warmF * 0.8, 4);
    }
    // a soft glint where a file has just completed
    for (const s of STACKS) { const k = T - s.done; if (k > 0 && k < 0.6) glow(prx(s.x, s.y), pry(s.x, s.y, NLAY * 2 + 4), 10, 7, [40, 110, 100], 0.6 * (1 - k / 0.6), 4); }
  }

  /* ------------------------------------------------------------------ canvas: the buffer at exactly 5x, nearest neighbour */
  const cv = canvas, ctx = cv.getContext('2d');
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H; const lctx = lo.getContext('2d'), img = lctx.createImageData(W, H);
  for (let p = 0; p < W * H; p++) img.data[p * 4 + 3] = 255;
  function renderAt(T) {
    render(T);
    const d = img.data; for (let p = 0, i = 0, j = 0; p < W * H; p++, i += 3, j += 4) { d[j] = BUF[i]; d[j + 1] = BUF[i + 1]; d[j + 2] = BUF[i + 2]; }
    lctx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, cv.width, cv.height);
  }
  return { renderAt, isReady: () => true };
});
