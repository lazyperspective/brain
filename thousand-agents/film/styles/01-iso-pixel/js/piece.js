/* 1000 agents: the first 3 seconds as a 2.5D isometric pixel diorama.
   Pure Canvas 2D, no dependencies. Every frame is a pure function of time: renderAt(t).
   The scene is a small voxel world (hero and folder are voxel models, agents are micro cubes) projected with the classic
   2:1 pixel isometric projection into a 384x216 buffer with a depth buffer, then shown at exactly 5x with smoothing off. */
(() => {
  'use strict';
  const W = 384, H = 216, SCALE = 5, DUR = 3, N_OUT = 250;
  const OX = 190, OY = 142;                         // where the world origin sits on screen
  const PI = Math.PI, TAU = PI * 2, fl = Math.floor;

  /* ------------------------------------------------------------------ maths */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const c01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (a, b, t) => c01((t - a) / (b - a));
  const eio = (k) => k * k * (3 - 2 * k);
  const eo = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
  // seeded hash -> [0, 1): the only source of "randomness"
  function ih(a, b) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  // v (0..1) in `levels` flat bands; only the last part of each band dithers into the next, so gradients stay clean pixel bands
  const DW = 0.3;
  function quant(v, levels, x, y) { const s = v * levels, i = fl(s), f = s - i; return (i + (f > 1 - DW && bay(x, y) < (f - (1 - DW)) / DW ? 1 : 0)) / levels; }

  /* ------------------------------------------------------------------ palette */
  const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const C = {
    coral: hex('d97757'), cord: hex('a8553b'), corl: hex('f2a585'), cdark: hex('6e2a1a'), cream: hex('ffe2cf'),
    cmid: hex('c26548'), edge: hex('f8c4aa'), cdeep: hex('8a4230'),
    white: hex('ffffff'), black: hex('0a0610'),
    lilac: hex('a9a3e6'), violet: hex('6c64bd'), vmid: hex('4d4799'), vdim: hex('37336b'), vdeep: hex('24204d'),
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
  function dput(x, y, c, d) {                        // depth tested pixel
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x; if (d <= DEP[p]) return;
    DEP[p] = d; const i = p * 3; BUF[i] = c[0]; BUF[i + 1] = c[1]; BUF[i + 2] = c[2];
  }
  function rput(x, y, c, d, a) {                     // pixel of the mirror image in the floor
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const p = y * W + x; if (d <= RD[p]) return;
    RD[p] = d; RA[p] = a; const i = p * 3; RB[i] = c[0]; RB[i + 1] = c[1]; RB[i + 2] = c[2];
  }
  // light added in a few dithered steps, so that every gradient stays on the pixel grid
  function glow(cx, cy, rx, ry, c, a, levels) {
    if (a <= 0) return;
    const x0 = Math.max(0, fl(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx)), y0 = Math.max(0, fl(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry); if (d >= 1) continue;
      const k = quant((1 - d) * (1 - d) * a, levels, x, y); if (k <= 0) continue;
      const i = (y * W + x) * 3; BUF[i] += c[0] * k; BUF[i + 1] += c[1] * k; BUF[i + 2] += c[2] * k;
    }
  }

  /* ------------------------------------------------------------------ projection: x runs down-right, y down-left, z up */
  const prx = (x, y) => OX + x - y, pry = (x, y, z) => OY + (x + y) / 2 - z;

  /* ------------------------------------------------------------------ 3x5 pixel lettering (flat for the HUD, sheared 2:1 for the floor) */
  const GL = { A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75716', ' ': '00000' };
  function text(s, x, y, c, a, iso) {
    for (let k = 0; k < s.length; k++) { const g = GL[s[k]] || GL[' ']; for (let j = 0; j < 5; j++) { const row = +g[j]; for (let i = 0; i < 3; i++) if (row & (4 >> i)) { if (iso) { const q = k * 4 + i; pset(x + q * 2, y + j + q, c, a); pset(x + q * 2 + 1, y + j + q, c, a); } else pset(x + k * 4 + i, y + j, c, a); } } }
  }

  /* ------------------------------------------------------------------ the floor: a pool of deep indigo with a faint isometric grid */
  const GRID = 16;
  (function buildBG() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x + 0.5 - OX, v = y + 0.5 - OY, wx = v + u / 2, wy = v - u / 2;
      const d = Math.min(1, Math.hypot(wx - 4, wy + 4) / 205), k0 = (1 - d) * (1 - d), k = quant(k0, 12, x, y);
      let r = 6 + 11 * k, g = 4 + 8 * k, b = 13 + 27 * k;
      const mx = wx - Math.floor(wx / GRID) * GRID, my = wy - Math.floor(wy / GRID) * GRID, gx = mx < 0.5, gy = my < 0.5;
      const gf = 1.7 * c01(1.1 - Math.hypot(wx - 4, wy + 4) / 165);
      if (gx || gy) { const q = gf * (gx && gy ? 2.4 : 1); r += 7 * q; g += 6 * q; b += 17 * q; }
      const i = (y * W + x) * 3; BG[i] = r; BG[i + 1] = g; BG[i + 2] = b;
    }
  })();

  /* ------------------------------------------------------------------ voxel models
     A voxel is 2 px wide and 1 px tall on screen: a 2x1 top, then one pixel of front (+y) face and one of side (+x) face.
     Rows of voxels give the clean 2:1 stair lines of pixel isometry; the depth buffer sorts everything. */
  class Model {
    constructor(nx, ny, nz, ox, oy) { this.nx = nx; this.ny = ny; this.nz = nz; this.ox = ox; this.oy = oy; this.g = new Uint8Array(nx * ny * nz); }
    clear() { this.g.fill(0); }
    set(x, y, z, m) { x = Math.round(x) + this.ox; y = Math.round(y) + this.oy; z = Math.round(z); if (x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz) this.g[(z * this.ny + y) * this.nx + x] = m; }
    get(x, y, z) { x += this.ox; y += this.oy; if (x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz) return 0; return this.g[(z * this.ny + y) * this.nx + x]; }
    box(x, y, z, w, d, h, m) { for (let k = 0; k < h; k++) for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, z + k, m); }
    // wx, wy, wz: world position of the model origin. mats[m] = { t, f, s, fe, se } (fe/se: faces under an open top edge)
    draw(wx, wy, wz, mats, mirror) {
      const ax = Math.round(prx(wx, wy)), bd = wx + wy + wz, { nx, ny, nz, g } = this;
      const ay = Math.round(pry(wx, wy, mirror ? 0 : wz)), mz = Math.round(wz);
      for (let z = 0; z < nz; z++) for (let yy = 0; yy < ny; yy++) for (let xx = 0; xx < nx; xx++) {
        const m = g[(z * ny + yy) * nx + xx]; if (!m) continue;
        const x = xx - this.ox, y = yy - this.oy, M = mats[m], up = z + 1 < nz ? g[((z + 1) * ny + yy) * nx + xx] : 0;
        const cl = ax + x - y - 1, base = ay + ((x + y) >> 1), cf = up ? M.f : M.fe, cs = up ? M.s : M.se;
        if (mirror) {
          const py = base + z + mz + 1, d = bd + x + y - z, a = 0.3 * (1 - (z + mz) / 26);
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

  /* ------------------------------------------------------------------ the hero: the coral block of the Fable Saga as a voxel creature.
     A 32 x 14 x 20 body with chamfered edges (so it reads rounded), four leg stubs, two arm nubs, eyes with a glint on its wide
     front face. Top faces light, front coral, side in shade. */
  const HM = new Model(72, 22, 48, 36, 2), BODY = 1, BASE = 2, LEGF = 3, LEGB = 4, BLK = 5, WHT = 6, ARM = 7, MOU = 8;
  const BD = 14, LH = 7;
  function heroMats(lit) {                            // lit: warm light from the open folder on the side that faces it
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
    const sq = o.sq || 0, bw = Math.round(32 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(12, Math.round(20 * (1 - sq * 0.4)));
    const x0 = -bw / 2, x1 = x0 + bw - 1, zb = LH, zt = LH + bh - 1, yf = BD - 1;
    // legs: the front pair at the outer corners, the back pair set in and in shade
    const lift = o.legs || [0, 0, 0, 0], inx = Math.round(bw * 0.2);
    const legs = [[x0 + 1, BD - 6, LEGF], [x0 + 1 + inx, 1, LEGB], [x1 - 5 - inx, 1, LEGB], [x1 - 5, BD - 6, LEGF]];
    for (let k = 0; k < 4; k++) { const l = Math.min(LH - 1, lift[k] | 0); HM.box(legs[k][0], legs[k][1], l, 5, 5, LH - l, legs[k][2]); }
    // body, edges chamfered by one voxel
    for (let z = zb; z <= zt; z++) for (let y = 0; y < BD; y++) for (let x = x0; x <= x1; x++) {
      const e = (x === x0 || x === x1 ? 1 : 0) + (y === 0 || y === yf ? 1 : 0) + (z === zb || z === zt ? 1 : 0); if (e >= 2) continue;
      HM.set(x, y, z, z <= zb + 1 || (z === zb + 2 && (x & 1) && y === yf) ? BASE : BODY);
    }
    // arms: nubs near the front of each side; the one facing the folder can rise
    const ah = Math.max(3, Math.round(bh * 0.3)), sz = zt - Math.round(bh * 0.36) - ah / 2 + 0.5, armA = o.armA || 0, reach = o.reach || 0;
    const limb = (sx, a, len, y0) => { const ca = Math.cos(a), sa = Math.sin(a); for (let q = 0; q <= len; q += 0.5) for (let v = -ah / 2 + 0.25; v < ah / 2; v += 0.5) for (let y = 0; y < 5; y++) HM.set(sx + ca * q - sa * v, y0 + y, sz + sa * q + ca * v, ARM); };
    limb(x0 - 0.5, PI - armA * 0.5, 4.5, BD - 5); limb(x1 + 0.5, armA, 3.4 + reach, BD - 8);
    // eyes (they glance a pixel to either side, or up), on the front face
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

  /* the hero's performance, all a function of t */
  const HERO_X = -41, HERO_FROM = -211, T_ARR0 = -0.07, T_ARR1 = 1.25, HOPS = 5, T_SIGNAL = 1.95, T_OPEN = 2.08;
  function heroAt(t) {
    const o = { sq: 0, legs: [0, 0, 0, 0], look: [0, 0], eyes: 'normal', mouth: 0, armA: 0, reach: 0 };
    let x = HERO_X, z = 0;
    if (t < T_ARR1) {
      const p = (t - T_ARR0) / (T_ARR1 - T_ARR0) * HOPS, i = fl(p), f = p - i, GND = 0.22, a = c01((f - GND) / (1 - GND));
      x = lerp(HERO_FROM, HERO_X, (i + a) / HOPS); z = 15 * 4 * a * (1 - a);
      if (f < GND) o.sq = 0.3 * Math.sin(PI * f / GND); else { o.sq = -0.14 * Math.sin(PI * a); const l = a < 0.5 ? 2 : 1; o.legs = [1, l, l, 2]; }
      o.look = [1, 0];
    } else {
      const s = t - T_ARR1;
      o.sq = 0.3 * Math.exp(-s * 13) * Math.cos(s * 26);                       // settles
      if (t < 1.52) o.look = [1, 0]; else if (t < 1.7) o.look = [-1, 0]; else o.look = [1, 0];   // looks at the folder, glances away, back
      if (t >= 1.76 && t < 1.85) o.eyes = 'closed';
      // the signal: a crouch, a hop, an arm up, a call
      const cr = seg(1.84, 1.93, t) * (1 - seg(1.93, 1.97, t)); o.sq += 0.24 * cr;
      const a = seg(1.95, 2.27, t); if (a > 0 && a < 1) { z = 15 * 4 * a * (1 - a); o.sq -= 0.13 * Math.sin(PI * a); o.legs = [1, 2, 2, 1]; }
      const ld = t - 2.27; if (ld >= 0) o.sq += 0.2 * Math.exp(-ld * 14) * Math.cos(ld * 26);
      o.armA = 1.3 * eo(seg(1.9, 2.02, t)) * (1 - eio(seg(2.5, 2.74, t))); o.reach = 4 * seg(1.9, 2.02, t) * (1 - seg(2.5, 2.74, t));
      if (t >= 1.95 && t < 2.24) o.mouth = 2; else if (t >= 2.24 && t < 2.34) o.mouth = 1;
      if (t >= 2.3) o.look = [1, 1];                                           // watches them pour out
      if (t >= 2.62 && t < 2.7) o.eyes = 'closed';
    }
    return { x, z, o };
  }

  /* ------------------------------------------------------------------ the folder: a standing voxel folder, tab at the back, front cover that leans open */
  const FM = new Model(36, 26, 28, 1, 1), PAN = 1, LID = 2, G0 = 3, G1 = 4, G2 = 5, G3 = 6, SCAN = 7, FRT = 8;
  const FW = 30, FX = 12, FY = -4;                    // width, and world position of its local origin
  const FCX = FX + FW / 2, FCY = FY + 4;              // centre of the mouth
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
    FM.clear();
    const zr = reveal * 24, cut = (z) => z <= zr, top = fl(zr), growing = reveal < 1;
    const put = (x, y, z, m) => { if (cut(z)) FM.set(x, y, z, growing && z === top ? SCAN : m); };
    for (let x = 0; x < FW; x++) {
      const hb = 20 + (x <= 1 ? 2 : x <= 10 ? 3 : x <= 12 ? 13 - x : 0) - (x === FW - 1 ? 1 : 0);          // back panel with the tab
      for (let z = 0; z < hb; z++) {
        let m = PAN;
        if (op > 0.02) { const k = z / (2 + op * 19); m = k < 0.3 ? G0 : k < 0.52 ? G1 : k < 0.78 ? G2 : k < 1 ? G3 : PAN; if (x === 0 || x === FW - 1) m = PAN; }
        put(x, 0, z, PAN); put(x, 1, z, m);
      }
      const hf = 18 - (x === 0 || x === FW - 1 ? 1 : 0);
      for (let z = 0; z < hf; z++) { const y = frontY(z, op); put(x, y, z, FRT); put(x, y + 1, z, FRT); }
      if (op <= 0.02) { for (let y = 2; y < 5; y++) for (let z = 0; z < 17; z++) put(x, y, z, LID); }
      else if (x > 0 && x < FW - 1) { for (let z = 0; z < 2; z++) for (let y = 2; y < frontY(z, op); y++) put(x, y, z, G0); }
    }
  }

  /* ------------------------------------------------------------------ the agents: micro cubes on ballistic arcs out of the folder, then on foot along the grid */
  const GRAV = 640, AG = [];
  for (let i = 0; i < N_OUT; i++) {
    const u = (i + 0.5) / N_OUT, tb = T_OPEN + 0.04 + (DUR - T_OPEN - 0.04) * Math.pow(u, 1 / 1.55);
    const hi = Math.pow(ih(i, 2), 0.6), vz = 150 + 235 * hi, vh = (14 + 52 * ih(i, 3)) * (1.3 - 0.75 * hi), an = ih(i, 4) * TAU;
    let vx = Math.cos(an) * vh, vy = Math.sin(an) * vh; if (vx < 0) vx *= 0.7;
    const x0 = FCX + (ih(i, 5) - 0.5) * 18, y0 = FCY + (ih(i, 6) - 0.5) * 2, z0 = 5;
    const T = (vz + Math.sqrt(vz * vz + 2 * GRAV * z0)) / GRAV;
    const ax = Math.abs(vx) > Math.abs(vy);
    AG.push({ tb, vx, vy, vz, x0, y0, z0, T, wx: ax ? Math.sign(vx) : 0, wy: ax ? 0 : Math.sign(vy), ph: ih(i, 7) * TAU, sp: 20 + 14 * ih(i, 8) });
  }
  function agentPos(a, age, out) {
    if (age < a.T) { out[0] = a.x0 + a.vx * age; out[1] = a.y0 + a.vy * age; out[2] = a.z0 + a.vz * age - GRAV / 2 * age * age; return true; }
    const w = age - a.T, k = 1 - Math.exp(-w * 9);                              // lands, finds its feet, walks off along a grid axis
    out[0] = a.x0 + a.vx * a.T + a.wx * a.sp * (w - (1 - Math.exp(-w * 9)) / 9); out[1] = a.y0 + a.vy * a.T + a.wy * a.sp * (w - k / 9);
    out[2] = Math.abs(Math.sin(w * 15 + a.ph)) * 2.2 * Math.exp(-w * 2.5) + Math.abs(Math.sin(w * 11)) * 1.1 * k;
    return false;
  }
  const agentsOut = (t) => t <= T_OPEN + 0.04 ? 0 : Math.min(N_OUT, fl(N_OUT * Math.pow((t - T_OPEN - 0.04) / (DUR - T_OPEN - 0.04), 1.55) + 0.5));

  /* ------------------------------------------------------------------ one frame */
  const P = [0, 0, 0];
  function floorRegion(cx, cy, r, fn) {                // run fn(px, py, wx, wy) over floor pixels within r world units of (cx, cy)
    const sx = prx(cx, cy), sy = pry(cx, cy, 0);
    const x0 = Math.max(0, fl(sx - r * 1.5)), x1 = Math.min(W - 1, Math.ceil(sx + r * 1.5)), y0 = Math.max(0, fl(sy - r * 0.75)), y1 = Math.min(H - 1, Math.ceil(sy + r * 0.75));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const u = x + 0.5 - OX, v = y + 0.5 - OY; fn(x, y, v + u / 2, v - u / 2); }
  }
  function mul(x, y, k) { const i = (y * W + x) * 3; BUF[i] *= k; BUF[i + 1] *= k; BUF[i + 2] *= k; }
  function render(t) {
    BUF.set(BG); DEP.fill(-1e9); RD.fill(-1e9); RA.fill(0);
    const op = eio(seg(T_OPEN, T_OPEN + 0.34, t)), reveal = eo(seg(-0.06, 0.46, t));
    const hero = heroAt(t), lit = op * (0.75 + 0.25 * seg(2.3, 2.8, t));

    // the folder's footprint, marked on the floor from the first frame
    const fa = 0.2 + 0.5 * (1 - seg(0.3, 0.9, t));
    floorRegion(FCX, FCY, 30, (px, py, wx, wy) => {
      const lx = wx - FX, ly = wy - FY, inx = lx > -3 && lx < FW + 3, iny = ly > -3 && ly < 10;
      if ((inx && (Math.abs(ly + 3) < 0.5 || Math.abs(ly - 10) < 0.5)) || (iny && (Math.abs(lx + 3) < 0.5 || Math.abs(lx - FW - 3) < 0.5))) pset(px, py, C.violet, fa * (0.55 + 0.45 * reveal));
    });
    // warm light pooled on the floor in front of the open folder
    if (op > 0) floorRegion(FCX, FCY + 6, 92, (px, py, wx, wy) => {
      const d = Math.hypot(wx - FCX, (wy - FCY - 6) * 0.9) / 92; if (d >= 1) return;
      const k = quant((1 - d) * (1 - d) * (1 - d) * op * 0.95, 8, px, py); if (k <= 0) return;
      const i = (py * W + px) * 3; BUF[i] += 120 * k; BUF[i + 1] += 50 * k; BUF[i + 2] += 34 * k;
    });

    // models
    const dims = buildHero(hero.o); buildFolder(op, reveal);
    const hmats = heroMats(lit), fmats = folderMats(op);
    // shadows on the floor
    const hs = 1 - hero.z / 70, hrx = dims.bw / 2 + 4, hry = BD / 2 + 4;
    floorRegion(hero.x + 1, 1, 26, (px, py, wx, wy) => {
      const d = Math.hypot((wx - hero.x - 1) / (hrx * hs), (wy - 1) / (hry * hs)); if (d >= 1) return;
      mul(px, py, d < 0.72 || bay(px, py) > (d - 0.72) / 0.28 ? 1 - 0.62 * hs : 1);
    });
    floorRegion(FCX, FCY, 30, (px, py, wx, wy) => {
      const lx = wx - FX, ly = wy - FY; if (lx > -1 && lx < FW + 2 && ly > -1 && ly < 8 + op * 9) mul(px, py, 1 - 0.55 * reveal);
    });
    // mirror images in the polished floor
    HM.draw(hero.x, -BD / 2, hero.z, hmats, true); FM.draw(FX, FY, 0, fmats, true);
    const nOut = agentsOut(t);
    for (let i = 0; i < nOut; i++) {
      const a = AG[i]; agentPos(a, t - a.tb, P);
      const sx = Math.round(prx(P[0], P[1])), fy = Math.round(pry(P[0], P[1], 0)), zz = Math.round(P[2]);
      if (sx >= 0 && sx < W - 1 && fy >= 0 && fy < H) { const k = 1 - 0.5 * (1 - c01(P[2] / 150)); mul(sx, fy, k); mul(sx + 1, fy, k); }   // its shadow
      rput(sx, fy + zz + 1, C.coral, P[0] + P[1] - P[2], 0.34 * (1 - P[2] / 70)); rput(sx + 1, fy + zz + 1, C.cord, P[0] + P[1] - P[2], 0.34 * (1 - P[2] / 70));
    }
    for (let p = 0; p < W * H; p++) { const a = RA[p]; if (a > 0) { const i = p * 3; BUF[i] += (RB[i] - BUF[i]) * a; BUF[i + 1] += (RB[i + 1] - BUF[i + 1]) * a; BUF[i + 2] += (RB[i + 2] - BUF[i + 2]) * a; } }

    // "0 ITEMS", lettered along the floor in front of the folder
    const la = seg(0.22, 0.5, t) * (1 - seg(T_OPEN, T_OPEN + 0.2, t));
    if (la > 0) text('0 ITEMS', Math.round(prx(FCX, FY + 7)) - 30, Math.round(pry(FCX, FY + 7, 0)) + 9, C.lilac, la * 0.9, false);

    // solid things, depth sorted
    FM.draw(FX, FY, 0, fmats, false); HM.draw(hero.x, -BD / 2, hero.z, hmats, false);
    for (let i = 0; i < nOut; i++) {
      const a = AG[i], age = t - a.tb, fly = agentPos(a, age, P), d = P[0] + P[1] + P[2];
      const sx = Math.round(prx(P[0], P[1])), sy = Math.round(pry(P[0], P[1], P[2]));
      if (fly) for (let k = 2; k >= 1; k--) {                                  // a short cooling trail
        const ag2 = age - k * 0.02; if (ag2 < 0) continue; const x = a.x0 + a.vx * ag2, y = a.y0 + a.vy * ag2, z = a.z0 + a.vz * ag2 - GRAV / 2 * ag2 * ag2;
        const tx = Math.round(prx(x, y)), ty = Math.round(pry(x, y, z)), c = k === 1 ? C.cord : C.cdark;
        dput(tx, ty, c, x + y + z); if (k === 1) dput(tx + 1, ty, c, x + y + z);
      }
      const hot = 1 - c01(age / 0.22);
      dput(sx, sy - 1, mix(C.corl, C.cream, 0.35 + 0.65 * hot), d + 0.1); dput(sx + 1, sy - 1, mix(C.corl, C.cream, 0.35 + 0.65 * hot), d + 0.1);
      dput(sx, sy, mix(C.coral, C.cream, hot * 0.8), d); dput(sx + 1, sy, mix(C.cord, C.corl, hot * 0.8), d);
    }

    // the light in the folder's mouth
    if (op > 0) {
      const gx = prx(FCX, FCY) , gy = pry(FCX, FCY, 15);
      glow(gx, gy, 54, 42, [150, 64, 40], op * 0.62, 6); glow(gx, gy + 2, 20, 13, [120, 84, 60], op * 0.8, 4);
    }

    // HUD
    const ha = seg(T_OPEN, T_OPEN + 0.2, t);
    if (ha > 0) { text('AGENTS', 11, 10, C.violet, ha); text(String(nOut).padStart(4, '0'), 39, 10, C.corl, ha); }
  }

  /* ------------------------------------------------------------------ canvas: the buffer at exactly 5x, nearest neighbour */
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H; const lctx = lo.getContext('2d'), img = lctx.createImageData(W, H);
  for (let p = 0; p < W * H; p++) img.data[p * 4 + 3] = 255;
  function renderAt(t) {
    render(clamp(t, 0, DUR));
    const d = img.data; for (let p = 0, i = 0, j = 0; p < W * H; p++, i += 3, j += 4) { d[j] = BUF[i]; d[j + 1] = BUF[i + 1]; d[j + 2] = BUF[i + 2]; }   // clamped by the array
    lctx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, W * SCALE, H * SCALE);
  }
  function fit() { const s = Math.min(innerWidth / cv.width, innerHeight / cv.height), k = s >= 1 ? fl(s) : s; cv.style.width = cv.width * k + 'px'; cv.style.height = cv.height * k + 'px'; }
  addEventListener('resize', fit); fit();

  const q = new URLSearchParams(location.search);
  if (q.has('export')) { window.__piece = { renderAt, duration: DUR, isReady: () => true }; renderAt(0); }
  else if (q.has('t')) renderAt(parseFloat(q.get('t')) || 0);
  else { let t0 = null; const tick = (now) => { if (t0 === null) t0 = now; renderAt(((now - t0) / 1000) % DUR); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
})();
