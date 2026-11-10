/* 1000 agents — the first 3 seconds as a voxel miniature.
   Hand-written WebGL2: voxel meshing with per-vertex ambient occlusion, a PCSS soft shadow map, HDR, a depth-of-field
   (tilt-shift) gather blur, bloom and a filmic finish. Every frame is a pure function of t. No libraries, no assets. */
(() => {
  'use strict';
  const W = 1920, H = 1080, DUR = 3;
  const PI = Math.PI, TAU = PI * 2;
  const c01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const lerp = (a, b, k) => a + (b - a) * k;
  const sstep = (a, b, x) => { const k = c01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  function hash(n, s) {
    let h = Math.imul(n | 0, 374761393) ^ Math.imul((s | 0) + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  const hash3 = (x, y, z, s) => hash(x * 73856093 ^ y * 19349663 ^ z * 83492791, s);
  const lin = (h) => [0, 2, 4].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
  const C = {
    coral: lin('d97757'), shade: lin('a8553b'), light: lin('f2a585'), dark: lin('6e2a1a'), cream: lin('ffe2cf'),
    lilac: lin('a9a3e6'), violet: lin('6c64bd'), vdim: lin('37336b'), vdeep: lin('1b1838'),
  };

  /* ------------------------------------------------------------------ matrices (column-major 4x4) */
  const mIdent = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function mMul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  const mChain = (...m) => m.reduce((a, b) => mMul(a, b));
  const mTrans = (x, y, z) => { const m = mIdent(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const mScale = (x, y, z) => { const m = mIdent(); m[0] = x; m[5] = y; m[10] = z; return m; };
  const mRotY = (a) => { const m = mIdent(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
  const mRotX = (a) => { const m = mIdent(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
  function mRotAxis(x, y, z, a) {
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c, m = mIdent();
    m[0] = t * x * x + c; m[1] = t * x * y + s * z; m[2] = t * x * z - s * y;
    m[4] = t * x * y - s * z; m[5] = t * y * y + c; m[6] = t * y * z + s * x;
    m[8] = t * x * z + s * y; m[9] = t * y * z - s * x; m[10] = t * z * z + c;
    return m;
  }
  function mPersp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  }
  function mOrtho(l, r, b, t, n, f) {
    const m = mIdent(); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); return m;
  }
  function mLook(e, c, up) {
    let fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2]; let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
    let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0]; l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
    const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx, m = mIdent();
    m[0] = sx; m[4] = sy; m[8] = sz; m[1] = ux; m[5] = uy; m[9] = uz; m[2] = -fx; m[6] = -fy; m[10] = -fz;
    m[12] = -(sx * e[0] + sy * e[1] + sz * e[2]); m[13] = -(ux * e[0] + uy * e[1] + uz * e[2]); m[14] = fx * e[0] + fy * e[1] + fz * e[2];
    return m;
  }

  /* ------------------------------------------------------------------ geometry stream: pos3 nrm3 col3 (ao, emissive, u, v) */
  const STRIDE = 13;
  let OUT = new Float32Array(STRIDE * 400000), on = 0;
  function vert(m, x, y, z, nx, ny, nz, col, ao, e, u, v) {
    if (on + STRIDE > OUT.length) { const n = new Float32Array(OUT.length * 2); n.set(OUT); OUT = n; }
    OUT[on++] = m[0] * x + m[4] * y + m[8] * z + m[12]; OUT[on++] = m[1] * x + m[5] * y + m[9] * z + m[13]; OUT[on++] = m[2] * x + m[6] * y + m[10] * z + m[14];
    OUT[on++] = nx; OUT[on++] = ny; OUT[on++] = nz;
    OUT[on++] = col[0]; OUT[on++] = col[1]; OUT[on++] = col[2];
    OUT[on++] = ao; OUT[on++] = e; OUT[on++] = u; OUT[on++] = v;
  }
  const DIRS = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
  ];
  const AOV = [0.26, 0.50, 0.76, 1.0];
  const QP = new Float32Array(12), QA = new Float32Array(4), QU = [0, 0, 1, 0, 0, 1, 1, 1];
  function nrm(m, n) {
    const x = m[0] * n[0] + m[4] * n[1] + m[8] * n[2], y = m[1] * n[0] + m[5] * n[1] + m[9] * n[2], z = m[2] * n[0] + m[6] * n[1] + m[10] * n[2], l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }
  function quadOut(m, n, col, e) {
    const N = nrm(m, n);
    const order = QA[0] + QA[3] >= QA[1] + QA[2] ? [0, 1, 3, 0, 3, 2] : [0, 1, 2, 1, 3, 2];
    for (const k of order) vert(m, QP[k * 3], QP[k * 3 + 1], QP[k * 3 + 2], N[0], N[1], N[2], col, QA[k], e, QU[k * 2], QU[k * 2 + 1]);
  }
  /* a voxel grid -> faces with corner ambient occlusion. g = {nx, ny, nz, v:Uint8Array, pal:[[r,g,b,emissive]], ox, oy, oz, seed} */
  function meshGrid(g, m, floorSolid) {
    const { nx, ny, nz, v, pal } = g;
    const S = (x, y, z) => y < 0 ? (floorSolid ? 1 : 0) : (x < 0 || z < 0 || x >= nx || y >= ny || z >= nz) ? 0 : (v[(z * ny + y) * nx + x] ? 1 : 0);
    const col = [0, 0, 0];
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const ci = v[(z * ny + y) * nx + x]; if (!ci) continue;
      const p = pal[ci], j = 1 + (hash3(x, y, z, g.seed) - 0.5) * (p[4] === undefined ? 0.13 : p[4]);
      col[0] = p[0] * j; col[1] = p[1] * j; col[2] = p[2] * j;
      for (let d = 0; d < 6; d++) {
        const n = DIRS[d][0], u = DIRS[d][1], w = DIRS[d][2];
        const ax = x + n[0], ay = y + n[1], az = z + n[2];
        if (S(ax, ay, az)) continue;
        const bx = x + (n[0] > 0 ? 1 : 0) - g.ox, by = y + (n[1] > 0 ? 1 : 0) - g.oy, bz = z + (n[2] > 0 ? 1 : 0) - g.oz;
        for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
          const k = b * 2 + a, sa = a ? 1 : -1, sb = b ? 1 : -1;
          QP[k * 3] = bx + a * u[0] + b * w[0]; QP[k * 3 + 1] = by + a * u[1] + b * w[1]; QP[k * 3 + 2] = bz + a * u[2] + b * w[2];
          const s1 = S(ax + sa * u[0], ay + sa * u[1], az + sa * u[2]), s2 = S(ax + sb * w[0], ay + sb * w[1], az + sb * w[2]);
          const cc = S(ax + sa * u[0] + sb * w[0], ay + sa * u[1] + sb * w[1], az + sa * u[2] + sb * w[2]);
          QA[k] = AOV[s1 && s2 ? 0 : 3 - (s1 + s2 + cc)];
        }
        quadOut(m, n, col, p[3]);
      }
    }
  }
  /* one free cube, unit size, centred on the origin of m */
  function cube(m, col, e, ground) {
    for (let d = 0; d < 6; d++) {
      const n = DIRS[d][0], u = DIRS[d][1], w = DIRS[d][2];
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const k = b * 2 + a;
        QP[k * 3] = n[0] * 0.5 + (a - 0.5) * u[0] + (b - 0.5) * w[0]; QP[k * 3 + 1] = n[1] * 0.5 + (a - 0.5) * u[1] + (b - 0.5) * w[1]; QP[k * 3 + 2] = n[2] * 0.5 + (a - 0.5) * u[2] + (b - 0.5) * w[2];
        QA[k] = ground && QP[k * 3 + 1] < 0 ? 0.5 : 1;
      }
      quadOut(m, n, col, e);
    }
  }

  /* ------------------------------------------------------------------ the hero: the coral block of the Fable Saga, in cubes
     body 20 x 12 x 12 voxels with softened edges, four 3x3 leg stubs (the back pair in shade), two arm nubs,
     2x3 black eyes with a white glint voxel, a recessed mouth only when it calls. */
  const HNX = 30, HNY = 22, HNZ = 12, HBX = 5, HBY = 4, BW = 20, BH = 12, BD = 10;
  const HG = { nx: HNX, ny: HNY, nz: HNZ, v: new Uint8Array(HNX * HNY * HNZ), ox: HBX + BW / 2, oy: 0, oz: BD / 2, seed: 7,
    pal: [null, [...C.coral, 0], [...C.shade, 0], [...C.coral.map((c, i) => lerp(c, C.light[i], 0.55)), 0], [0.004, 0.003, 0.004, 0, 0], [1, 1, 1, 0.12, 0], [...C.dark, 0, 0.05], [0.012, 0.004, 0.004, 0, 0]] };
  function buildHero(st) {
    const v = HG.v; v.fill(0);
    const set = (x, y, z, c) => { if (x >= 0 && y >= 0 && z >= 0 && x < HNX && y < HNY && z < HNZ) v[(z * HNY + y) * HNX + x] = c; };
    const box = (x0, y0, z0, w, h, d, c) => { for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x0 + x, y0 + y, z0 + z, c); };
    for (let z = 0; z < BD; z++) for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const dx = Math.max(0, 2 - Math.min(x, BW - 1 - x)), dy = Math.max(0, 2 - Math.min(y, BH - 1 - y)), dz = Math.max(0, 2 - Math.min(z, BD - 1 - z));
      if ((dx === 2) + (dy === 2) + (dz === 2) >= 2) continue;
      set(HBX + x, HBY + y, z, y === 0 ? 2 : y === BH - 1 ? 3 : 1);
    }
    // legs
    const len = st.tuck ? 3 : 4;
    for (const lx of [1, BW - 4]) for (const lz of [1, BD - 4]) {
      const c = lz === 1 ? 2 : 1;
      box(HBX + lx, HBY - len, lz, 3, len + 2, 3, c);
      box(HBX + lx, HBY - len, lz, 3, 1, 3, 2);
      if (c === 1) box(HBX + lx, HBY, lz, 3, 2, 3, 1); box(HBX + lx, HBY, lz, 3, 1, 3, 2);
    }
    // arms: the left one a plain nub; the right one (folder side) can rise
    box(HBX - 3, HBY + 5, 3, 3, 3, 4, 2);
    const R = HBX + BW;
    if (!st.arm) box(R, HBY + 5, 3, 3, 3, 4, 1);
    else {
      box(R, HBY + 6, 3, 2, 3, 4, 1); box(R + 1, HBY + 8, 3, 2, 3, 4, 1);
      if (st.arm > 1) { box(R + 2, HBY + 10, 3, 2, 3, 4, 1); box(R + 2, HBY + 12, 3, 2, 1, 4, 3); } else box(R + 1, HBY + 10, 3, 2, 1, 4, 3);
    }
    // face (on the +z side)
    const fz = BD - 1, lk = st.look || 0, lu = st.lookUp || 0;
    for (const [ex, side] of [[3, -1], [BW - 5, 1]]) {
      const x0 = HBX + ex + lk, y0 = HBY + 6 + lu;
      if (st.eyes === 'closed') box(x0, y0, fz, 2, 1, 1, 6);
      else { box(x0, y0, fz, 2, 3, 1, 4); set(x0 + (side < 0 ? 0 : 1), y0 + 2, fz, 5); }
    }
    if (st.mouth) {
      const mw = st.mouth > 1 ? 6 : 4, mh = st.mouth > 1 ? 3 : 2, x0 = HBX + BW / 2 - mw / 2, y0 = HBY + 5 - mh;
      box(x0, y0 + (st.mouth > 1 ? 0 : 0), fz, mw, mh, 1, 0); box(x0, y0, fz - 1, mw, mh, 1, 7); box(x0 + 1, y0, fz - 1, mw - 2, 1, 1, 6);
    }
  }

  /* the hero's performance, all a function of t */
  const HERO_FROM = [-84, -40], HERO_AT = [-28, 5];
  const HOP0 = -0.09, HOPD = 0.335, NHOP = 4, T_LAND = HOP0 + HOPD * NHOP;      // 1.25
  const T_SIG = 1.95;
  function keyed(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i + 1 < keys.length; i++) if (t < keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], sstep(keys[i][0], keys[i + 1][0], t));
    return keys[keys.length - 1][1];
  }
  const D2R = PI / 180;
  const YAW = [[0, 46], [1.02, 46], [1.3, 24], [1.36, 24], [1.52, 50], [1.62, 50], [1.74, -6], [1.82, -6], [1.94, 26], [2.3, 26], [2.5, 40], [3, 44]];
  function heroAt(t) {
    const st = { x: 0, y: 0, z: 0, yaw: keyed(YAW, t) * D2R, pitch: 0, sq: 0, tuck: 0, eyes: 'open', look: 0, lookUp: 0, mouth: 0, arm: 0 };
    if (t < T_LAND) {
      const ph = (t - HOP0) / HOPD, k = Math.floor(ph), f = ph - k, AIR = 0.76, u = c01(f / AIR);
      const s = (k + sstep(0, 1, u) * 0.35 + u * 0.65) / NHOP;
      st.x = lerp(HERO_FROM[0], HERO_AT[0], s); st.z = lerp(HERO_FROM[1], HERO_AT[1], s);
      st.y = 4 * 7.5 * u * (1 - u);
      st.pitch = -0.16 * (1 - 2 * u) * (u < 1 ? 1 : 0);
      st.sq = f < AIR ? -0.07 * Math.sin(PI * u) : 0.15 * Math.sin(PI * (f - AIR) / (1 - AIR));
      st.tuck = u > 0.12 && u < 0.88 ? 1 : 0;
    } else {
      st.x = HERO_AT[0]; st.z = HERO_AT[1];
      const tl = t - T_LAND; st.sq = 0.15 * Math.exp(-tl * 9) * Math.cos(tl * 19) + 0.012 * Math.sin(t * 5.2);
      // the signal: crouch, hop, arm up, call
      const a0 = T_SIG - 0.09, a1 = T_SIG + 0.27;
      if (t > a0 && t < T_SIG) st.sq += 0.13 * Math.sin(PI * 0.5 * (t - a0) / (T_SIG - a0));
      if (t >= T_SIG && t < a1) { const u = (t - T_SIG) / (a1 - T_SIG); st.y = 4 * 6.5 * u * (1 - u); st.sq -= 0.07 * Math.sin(PI * u); st.tuck = u > 0.12 && u < 0.88 ? 1 : 0; st.pitch = 0.1 * Math.sin(PI * u); }
      if (t >= a1) { const tl2 = t - a1; st.sq += 0.14 * Math.exp(-tl2 * 9) * Math.cos(tl2 * 19); }
    }
    // eyes
    if (t > 1.36 && t < 1.64) st.look = 1;
    if (t > 1.68 && t < 1.86) st.look = -1;
    if ((t > 1.865 && t < 1.93) || (t > 0.62 && t < 0.68)) st.eyes = 'closed';
    if (t > 2.36) { st.look = 1; st.lookUp = 1; }
    if (t > 2.74 && t < 2.80) st.eyes = 'closed';
    // arm and mouth
    if (t > T_SIG - 0.04) st.arm = 1;
    if (t > T_SIG + 0.02 && t < 2.78) st.arm = 2;
    if (t > T_SIG + 0.01 && t < 2.42) st.mouth = 2; else if (t >= 2.42 && t < 2.56) st.mouth = 1;
    return st;
  }
  function heroMatrix(st) {
    const sy = 1 - st.sq, sxz = 1 + st.sq * 0.5;
    return mChain(mTrans(st.x, st.y, st.z), mRotY(st.yaw), mTrans(0, 4, 0), mRotX(st.pitch), mTrans(0, -4, 0), mScale(sxz, sy, sxz));
  }

  /* ------------------------------------------------------------------ the folder: a back plate with a tab, a hinged front plate, a core that lights up */
  const FNX = 24, FNY = 18, FNZ = 5;
  const FB = { nx: FNX, ny: FNY, nz: FNZ, v: new Uint8Array(FNX * FNY * FNZ), ox: 12, oy: 0, oz: 3.5, seed: 21, pal: null };
  const FF = { nx: FNX, ny: 14, nz: 2, v: new Uint8Array(FNX * 14 * 2), ox: 12, oy: 0, oz: 0, seed: 33, pal: null };
  const FBfull = new Uint8Array(FNX * FNY * FNZ), FFfull = new Uint8Array(FNX * 14 * 2);
  (function () {
    const set = (x, y, z, c) => { FBfull[(z * FNY + y) * FNX + x] = c; };
    for (let x = 0; x < FNX; x++) for (let y = 0; y < FNY; y++) {
      const top = x < 9 ? 18 : x === 9 ? 17 : 16;
      if (y < top) { set(x, y, 0, y === top - 1 ? 2 : 1); set(x, y, 1, y === top - 1 ? 2 : 1); }
    }
    for (let x = 0; x < FNX; x++) for (let z = 2; z < 5; z++) set(x, 0, z, 1);
    for (let x = 1; x < FNX - 1; x++) for (let z = 2; z < 5; z++) for (let y = 1; y < 4; y++) set(x, y, z, 3);
    for (let x = 0; x < FNX; x++) for (let y = 0; y < 14; y++) for (let z = 0; z < 2; z++) FFfull[(z * 14 + y) * FNX + x] = y === 13 ? 2 : (y === 9 && x >= 3 && x < 10 && z === 1) ? 2 : 1;
  })();
  const FOLD_YAW = 6 * D2R;
  const arrive = (x, y, z, s) => 0.05 + 0.33 * (y / 18) + 0.11 * hash3(x, y, z, s);
  const FALL = 0.17;
  function drawFolderPart(g, full, m, t, seed, floorSolid) {
    const { nx, ny, nz } = g; let any = false;
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = (z * ny + y) * nx + x, c = full[i]; g.v[i] = 0; if (!c) continue;
      const a = arrive(x, y, z, seed);
      if (t >= a) { g.v[i] = c; continue; }
      const k = (t - (a - FALL)) / FALL; if (k <= 0) continue;
      const e = 1 - Math.pow(1 - k, 3), p = g.pal[c], s = 0.25 + 0.75 * e;
      cube(mChain(m, mTrans(x + 0.5 - g.ox, y + 0.5 - g.oy + (1 - e) * 11, z + 0.5 - g.oz), mScale(s, s, s)), p, p[3] + (1 - e) * 0.5, false);
      any = true;
    }
    meshGrid(g, m, floorSolid);
    return any;
  }

  /* ------------------------------------------------------------------ voxel lettering laid flat on the floor */
  const GL = { A: '25755', E: '74647', G: '34553', I: '72227', M: '57755', N: '65555', S: '34216', T: '72222',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75716', ' ': '00000' };
  function label(s, x0, z0, fn) {           // fn(k, i, j) -> [scale, col, emissive] or null
    for (let k = 0; k < s.length; k++) {
      const g = GL[s[k]]; for (let j = 0; j < 5; j++) { const row = +g[j]; for (let i = 0; i < 3; i++) if (row & (4 >> i)) {
        const r = fn(k, i, j); if (!r || r[0] <= 0.01) continue;
        const sc = r[0];
        cube(mChain(mTrans(x0 + k * 4 + i + 0.5, 0.32 * sc, z0 + j + 0.5), mScale(sc * 0.94, 0.64 * sc, sc * 0.94)), r[1], r[2], true);
      } }
    }
  }

  /* ------------------------------------------------------------------ the agents: single glowing cubes, a fountain out of the folder */
  const NAG = 250, T_OPEN = 2.1, T_POUR = 2.16;
  const AG = [];
  for (let i = 0; i < NAG; i++) {
    const r = (s) => hash(i, s), g = (s) => (hash(i, s) + hash(i, s + 50) + hash(i, s + 90) - 1.5) * 1.15;
    const pick = r(9);
    AG.push({
      b: T_POUR + 0.86 * Math.pow((i + 0.5) / NAG, 1 / 1.35),
      x: (r(1) - 0.5) * 18, z: (r(2) - 0.5) * 2.0,
      vx: g(3) * 9 + (r(1) - 0.5) * 54, vy: 74 + r(4) * 56, vz: Math.max(-6, g(5) * 12 + 5),
      ax: [r(10) - 0.5, r(11) - 0.5, r(12) - 0.5], w: 5 + r(13) * 9, ph: r(14) * TAU,
      col: pick < 0.5 ? C.light : pick < 0.88 ? C.coral : C.cream, e: 0.95 + r(15) * 0.75, s: 0.95 + r(16) * 0.3,
    });
  }
  const GRAV = 150;
  function agentCount(t) { let n = 0; for (const a of AG) if (a.b <= t) n++; return n; }
  function drawAgents(t, FM) {
    for (const a of AG) {
      let tl = t - a.b; if (tl <= 0) continue;
      const y0 = 4.5, yg = a.s * 0.5;
      let x = a.x + a.vx * tl, z = a.z + a.vz * tl, y, vy = a.vy, rest = false;
      // ballistic arcs with two damped bounces, then rest
      const d0 = y0 - yg; let T = (vy + Math.sqrt(vy * vy + 2 * GRAV * d0)) / GRAV;
      if (tl < T) y = y0 + vy * tl - 0.5 * GRAV * tl * tl;
      else {
        let tt = tl - T, v = (GRAV * T - vy) * 0.34; y = yg;
        for (let k = 0; k < 2; k++) { const Tb = 2 * v / GRAV; if (tt < Tb) { y = yg + v * tt - 0.5 * GRAV * tt * tt; tt = -1; break; } tt -= Tb; v *= 0.4; }
        if (tt >= 0) rest = true;
      }
      const p = [FM[0] * x + FM[8] * z + FM[12], y, FM[2] * x + FM[10] * z + FM[14]];
      const sc = a.s * sstep(0, 0.07, tl);
      const rot = rest ? mIdent() : mRotAxis(a.ax[0], a.ax[1], a.ax[2], a.ph + a.w * tl);
      cube(mChain(mTrans(p[0], p[1], p[2]), rot, mScale(sc, sc, sc)), a.col, a.e, false);
    }
  }

  /* a few spare cubes lying about, mostly far from the plane of focus */
  const STRAY = [[-58, 46, 1.6, 0.4, 0], [34, 60, 2.2, 1.1, 1], [58, -26, 1.4, 0.7, 0], [-30, -74, 2.0, 0.2, 1], [22, -58, 1.5, 0.9, 0], [-96, -8, 1.8, 1.3, 0], [70, 22, 1.2, 0.5, 1], [-12, 74, 1.5, 0.8, 0], [88, -70, 2.4, 0.1, 1], [-70, -110, 2.4, 0.6, 1], [10, -120, 2.0, 0.3, 0]];

  /* ------------------------------------------------------------------ the frame's geometry */
  function buildScene(t) {
    on = 0;
    const st = heroAt(t);
    buildHero(st);
    const HM = heroMatrix(st);
    meshGrid(HG, HM, false);

    // folder
    const glow = sstep(T_OPEN - 0.02, T_OPEN + 0.4, t);
    const pulse = glow * (1 + 0.06 * Math.sin((t - T_OPEN) * 9));
    const warmCol = [lerp(C.vdeep[0], 1.0, glow), lerp(C.vdeep[1], 0.60, glow), lerp(C.vdeep[2], 0.30, glow)];
    const fcol = C.violet.map((c, i) => lerp(c, C.vdim[i], 0.62)), ftrim = C.violet.map((c, i) => lerp(c, C.lilac[i], 0.55));
    FB.pal = [null, [...fcol, 0], [...ftrim, 0], [...warmCol, 1.05 * pulse, 0.05]];
    FF.pal = [null, [...fcol.map((c) => c * 1.18), 0], [...ftrim, 0]];
    const FM = mChain(mRotY(FOLD_YAW));
    drawFolderPart(FB, FBfull, FM, t, 3, true);
    const ko = c01((t - T_OPEN) / 0.36), back = 1 + 2.2 * Math.pow(ko - 1, 3) + 1.2 * Math.pow(ko - 1, 2);
    const open = 50 * D2R * (ko <= 0 ? 0 : back) + (t > T_OPEN ? 0.012 * Math.sin((t - T_OPEN) * 7) * glow : 0);
    const FFM = mChain(FM, mTrans(0, 0, 1.5), mRotX(open));
    drawFolderPart(FF, FFfull, FFM, t, 5, open < 0.02);

    // label: "0 ITEMS" laid on the floor; the number becomes the count of agents and lights up
    {
      const n = agentCount(t), str = String(n).padStart(3, ' ') + ' ITEMS', hot = sstep(T_POUR - 0.02, T_POUR + 0.12, t);
      const dcol = C.lilac.map((c, i) => lerp(c, C.light[i], hot));
      label(str, -21.5, 15.5, (k, i, j) => {
        const a = 0.26 + (k * 4 + i) * 0.006 + j * 0.006, s = k < 2 ? 1 : sstep(a, a + 0.09, t);
        return [s * (1 + 0.25 * Math.sin(PI * s)), k < 3 ? dcol : C.lilac, k < 3 ? lerp(0.22, 1.05, hot) : 0.22];
      });
    }
    for (let i = 0; i < STRAY.length; i++) {
      const s = STRAY[i];
      cube(mChain(mTrans(s[0], s[2] / 2, s[1]), mRotY(s[3]), mScale(s[2], s[2], s[2])), s[4] ? C.violet : C.vdim, s[4] ? 0.16 : 0, true);
    }
    const nShadow = on / STRIDE;
    drawAgents(t, FM);
    // floor
    const F = 1400, fc = [0, 0, 0], I = mIdent();
    vert(I, -F, 0, -F, 0, 1, 0, fc, 1, -1, 0, 0); vert(I, F, 0, -F, 0, 1, 0, fc, 1, -1, 0, 0); vert(I, F, 0, F, 0, 1, 0, fc, 1, -1, 0, 0);
    vert(I, -F, 0, -F, 0, 1, 0, fc, 1, -1, 0, 0); vert(I, F, 0, F, 0, 1, 0, fc, 1, -1, 0, 0); vert(I, -F, 0, F, 0, 1, 0, fc, 1, -1, 0, 0);
    return { st, nShadow, nAll: on / STRIDE, glow: pulse, pour: sstep(T_POUR, 3.0, t) };
  }

  /* ------------------------------------------------------------------ WebGL */
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) { document.body.textContent = 'WebGL2 is needed'; return; }
  const HDR = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  function prog(vs, fs) {
    const p = gl.createProgram();
    for (const [ty, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(ty); gl.shaderSource(s, '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n' + src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aN'); gl.bindAttribLocation(p, 2, 'aC'); gl.bindAttribLocation(p, 3, 'aM');
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name.replace('[0]', '')] = gl.getUniformLocation(p, inf.name); }
    return { p, u };
  }
  function tex(w, h, kind, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (kind === 'depth') gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    else if (HDR) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = kind === 'depth' ? gl.NEAREST : (filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h, withDepth) {
    const fb = gl.createFramebuffer(), color = tex(w, h), o = { fb, color, w, h };
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    if (withDepth) { o.depth = tex(w, h, 'depth'); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, o.depth, 0); }
    return o;
  }
  const SM = 2048;
  const shadowT = (() => { const fb = gl.createFramebuffer(), depth = tex(SM, SM, 'depth'); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); return { fb, depth }; })();
  const SAMPLES = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
  const msT = (() => {
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, SAMPLES, HDR ? gl.RGBA16F : gl.RGBA8, W, H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, SAMPLES, gl.DEPTH_COMPONENT24, W, H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    return { fb, ok: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE };
  })();
  const sceneT = target(W, H, true), halfT = target(W / 2, H / 2), half2T = target(W / 2, H / 2), compT = target(W, H);
  const bl = [4, 8, 16, 32].map((d) => ({ a: target(Math.ceil(W / d), Math.ceil(H / d)), b: target(Math.ceil(W / d), Math.ceil(H / d)) }));

  const vao = gl.createVertexArray(), vbo = gl.createBuffer(), emptyVao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const BS = STRIDE * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, BS, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, BS, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, BS, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, BS, 36);
  gl.bindVertexArray(null);

  const P_SHADOW = prog(`in vec3 aP; uniform mat4 uLVP; void main(){ gl_Position = uLVP*vec4(aP,1.); }`, `void main(){}`);
  const P_SCENE = prog(`
    in vec3 aP; in vec3 aN; in vec3 aC; in vec4 aM;
    uniform mat4 uVP; out vec3 vP, vN, vC; out vec4 vM;
    void main(){ vP=aP; vN=aN; vC=aC; vM=aM; gl_Position = uVP*vec4(aP,1.); }`, `
    in vec3 vP, vN, vC; in vec4 vM; out vec4 o;
    uniform mat4 uLVP; uniform sampler2D uShadow; uniform vec3 uL, uEye;
    uniform vec4 uHero; uniform vec3 uHeroB; uniform vec4 uFold; uniform vec4 uWarm; uniform float uPour;
    float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
    float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    float shadow(vec3 wp, vec3 N){
      vec4 lp = uLVP*vec4(wp + N*0.22, 1.); vec3 s = lp.xyz*0.5+0.5;
      if (s.x<0.||s.y<0.||s.x>1.||s.y>1.) return 1.;
      float a0 = ign(gl_FragCoord.xy)*6.2831853, bias = 0.0009;
      float bs = 0., bn = 0.;
      for (int i=0;i<12;i++){ float fi=float(i); float r = sqrt((fi+.5)/12.)*0.011; float a=a0+fi*2.39996;
        float d = texture(uShadow, s.xy+vec2(cos(a),sin(a))*r).r; if (d < s.z-bias){ bs+=d; bn+=1.; } }
      if (bn<.5) return 1.;
      float pen = clamp((s.z - bs/bn)*0.16, 0.0006, 0.012);
      float sum = 0.;
      for (int i=0;i<28;i++){ float fi=float(i); float r = sqrt((fi+.5)/28.)*pen; float a=a0+1.7+fi*2.39996;
        sum += step(s.z-bias, texture(uShadow, s.xy+vec2(cos(a),sin(a))*r).r); }
      return sum/28.;
    }
    float boxAO(vec2 p, vec4 c, vec3 b, float k){
      vec2 d = p-c.xy; vec2 l = vec2(c.z*d.x - c.w*d.y, c.w*d.x + c.z*d.y);
      float dist = length(max(abs(l)-b.xy, 0.));
      return 1. - k*exp(-dist/4.6)*exp(-b.z/6.);
    }
    void main(){
      vec3 N = normalize(vN); float ao = vM.x, e = vM.y; vec3 alb = vC;
      bool isFloor = e < -0.5;
      float pool = 1. - smoothstep(22., 132., length(vP.xz - vec2(-8., 2.)));
      float gloss = 0.;
      if (isFloor) {
        vec2 q = vP.xz/4.; vec2 id = floor(q), f = fract(q);
        float w = fwidth(q.x)+fwidth(q.y);
        float d = min(min(f.x,1.-f.x), min(f.y,1.-f.y));
        float groove = mix(smoothstep(0.0, 0.035+w, d), 0.9, clamp(w*4.,0.,1.));
        float var = mix(h1(id), 0.5, clamp(w*3.,0.,1.));
        alb = vec3(0.0132, 0.0092, 0.0420)*(0.74+0.52*var)*mix(0.45, 1., groove);
        ao = boxAO(vP.xz, uHero, uHeroB, 0.74) * boxAO(vP.xz, vec4(uFold.xy, uFold.z, uFold.w), vec3(12.5, 3.6, 0.), 0.72);
        e = 0.;
      } else {
        float d = min(min(vM.z,1.-vM.z), min(vM.w,1.-vM.w));
        alb *= mix(0.80, 1., smoothstep(0.015, 0.075, d));
      }
      float sh = shadow(vP, N);
      float ndl = max(dot(N, uL), 0.);
      vec3 key = vec3(1.0, 0.94, 0.86)*1.18*ndl*sh*mix(0.72, 1., ao)*(0.25+0.75*pool);
      vec3 amb = mix(vec3(0.040, 0.034, 0.085), vec3(0.20, 0.19, 0.36), N.y*.5+.5)*ao*ao*(0.3+0.7*pool)*(isFloor ? 0.6 : 1.);
      vec3 fill = vec3(0.26, 0.22, 0.52)*0.30*max(dot(N, normalize(vec3(-0.85, 0.25, 0.2))), 0.)*ao;
      // the warm light of the open folder and of the fountain above it
      vec3 wd = uWarm.xyz - vP; float wl = length(wd);
      float wn = max(dot(N, wd/wl), 0.);
      vec3 warm = vec3(1.0, 0.58, 0.32)*uWarm.w*(wn*0.85+0.15)/(1. + wl*wl/420.);
      vec3 wd2 = vec3(uWarm.x, 30., uWarm.z+3.) - vP; float wl2 = length(wd2);
      warm += vec3(1.0, 0.62, 0.38)*uPour*1.1*max(dot(N, wd2/wl2), 0.)/(1. + wl2*wl2/1500.);
      vec3 walb = isFloor ? mix(alb, vec3(dot(alb, vec3(.3,.5,.2)))*2.2, 0.75) : mix(alb, vec3(dot(alb, vec3(.3,.5,.2)))*1.5, 0.5);
      vec3 col = alb*(key + amb + fill) + walb*warm*mix(0.6,1.,ao);
      if (e > 0.) col += vC*e*(0.62 + 0.38*(N.y*0.6 + N.z*0.3 + 0.4));
      o = vec4(col, 1.);
    }`);
  const VS_FS = `out vec2 vUV; void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vUV = p; gl_Position = vec4(p*2.-1., 0., 1.); }`;
  const DOF_COMMON = `
    uniform sampler2D uCol, uDep; uniform vec4 uCam; /* near, far, focus, k */ uniform vec2 uPx;
    float linz(float d){ return 2.*uCam.x*uCam.y/(uCam.y+uCam.x - (d*2.-1.)*(uCam.y-uCam.x)); }
    float coc(float z){ return clamp(uCam.w*max(abs(z-uCam.z)-9., 0.)/z, 0., 22.); }`;
  // half-resolution scatter-as-gather blur on a golden-angle spiral; alpha carries the blur that landed on the pixel
  const P_DOF = prog(VS_FS, `in vec2 vUV; out vec4 o;` + DOF_COMMON + `
    void main(){
      float z0 = linz(texture(uDep, vUV).r), c0 = coc(z0);
      vec3 col = texture(uCol, vUV).rgb; float tot = 1., cs = c0;
      float rad = 0.9, a = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))*6.2831853;
      for (int i=0;i<140;i++){
        if (rad > 22.) break;
        vec2 tc = vUV + vec2(cos(a), sin(a))*uPx*rad;
        vec3 sc = texture(uCol, tc).rgb; float sz = linz(texture(uDep, tc).r), ss = coc(sz);
        if (sz > z0) ss = min(ss, c0*2.);
        float m = smoothstep(rad-1., rad+1., ss);
        col += mix(col/tot, sc, m); cs += mix(cs/tot, ss, m); tot += 1.;
        a += 2.39996323; rad += 2.3/rad;
      }
      o = vec4(col/tot, cs/tot);
    }`);
  const P_FILL = prog(VS_FS, `in vec2 vUV; out vec4 o; uniform sampler2D uCol; uniform vec2 uPx;
    void main(){ vec4 c = texture(uCol, vUV); float r = clamp(c.a*0.5, 0., 3.)*0.5; vec4 s = c*2.;
      s += texture(uCol, vUV+uPx*vec2(r, r*.4)) + texture(uCol, vUV+uPx*vec2(-r*.4, r)) + texture(uCol, vUV+uPx*vec2(-r, -r*.4)) + texture(uCol, vUV+uPx*vec2(r*.4, -r));
      o = s/6.; }`);
  const P_COMP = prog(VS_FS, `in vec2 vUV; out vec4 o; uniform sampler2D uBlur;` + DOF_COMMON + `
    void main(){
      vec3 sharp = texture(uCol, vUV).rgb; vec4 b = texture(uBlur, vUV);
      float c = max(coc(linz(texture(uDep, vUV).r)), b.a);
      o = vec4(mix(sharp, b.rgb, smoothstep(1.0, 3.2, c)), 1.);
    }`);
  const P_BRIGHT = prog(VS_FS, `in vec2 vUV; out vec4 o; uniform sampler2D uCol; uniform vec2 uPx;
    vec3 br(vec2 uv){ vec3 c = min(texture(uCol, uv).rgb, vec3(6.)); float l = max(c.r, max(c.g, c.b)); return c*smoothstep(0.75, 1.5, l); }
    void main(){ o = vec4((br(vUV+uPx*vec2(-1.,-1.))+br(vUV+uPx*vec2(1.,-1.))+br(vUV+uPx*vec2(-1.,1.))+br(vUV+uPx*vec2(1.,1.)))*.25, 1.); }`);
  const P_DOWN = prog(VS_FS, `in vec2 vUV; out vec4 o; uniform sampler2D uCol; uniform vec2 uPx;
    void main(){ o = (texture(uCol, vUV+uPx*vec2(-.5,-.5))+texture(uCol, vUV+uPx*vec2(.5,-.5))+texture(uCol, vUV+uPx*vec2(-.5,.5))+texture(uCol, vUV+uPx*vec2(.5,.5)))*.25; }`);
  const P_BLUR = prog(VS_FS, `in vec2 vUV; out vec4 o; uniform sampler2D uCol; uniform vec2 uDir;
    void main(){ vec4 s = texture(uCol, vUV)*0.2270270;
      s += (texture(uCol, vUV+uDir*1.3846154)+texture(uCol, vUV-uDir*1.3846154))*0.3162162;
      s += (texture(uCol, vUV+uDir*3.2307692)+texture(uCol, vUV-uDir*3.2307692))*0.0702703; o = s; }`);
  const P_FINAL = prog(VS_FS, `in vec2 vUV; out vec4 o; uniform sampler2D uCol, uB0, uB1, uB2, uB3; uniform float uSeed;
    float h(vec2 p){ vec3 q = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
    vec3 tone(vec3 x){ vec3 a = vec3(0.62); return mix(x, a + (1.-a)*tanh((x-a)/(1.-a)), step(a, x)); }
    void main(){
      vec3 c = texture(uCol, vUV).rgb;
      vec3 bloom = texture(uB0, vUV).rgb*0.34 + texture(uB1, vUV).rgb*0.30 + texture(uB2, vUV).rgb*0.26 + texture(uB3, vUV).rgb*0.22;
      c += bloom*0.40;
      vec2 q = vUV-0.5; q.x *= 1.3; float vig = 1. - 0.55*smoothstep(0.25, 0.95, length(q));
      c *= vig;
      c = tone(c*1.04);
      float l = dot(c, vec3(.2126,.7152,.0722)); c = max(mix(vec3(l), c, 1.12), 0.);
      c = mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-0.055, step(0.0031308, c));
      c += (h(gl_FragCoord.xy + uSeed*vec2(37.,17.)) + h(gl_FragCoord.yx*1.37 + uSeed*vec2(11.,71.)) - 1.)*(1.6/255.);
      o = vec4(c, 1.);
    }`);

  const LDIR = (() => { const v = [0.62, 0.85, 0.45], l = Math.hypot(...v); return v.map((x) => x / l); })();
  const LVP = (() => {
    const c = [-24, 0, -6], e = [c[0] + LDIR[0] * 220, c[1] + LDIR[1] * 220, c[2] + LDIR[2] * 220];
    return mMul(mOrtho(-105, 105, -78, 78, 60, 380), mLook(e, c, [0, 1, 0]));
  })();
  const NEAR = 30, FAR = 1400, FOV = 23 * D2R;
  function camera(t) {
    const k = t / DUR, e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    const az = lerp(15, 25, e) * D2R, pit = lerp(25.5, 23.5, e) * D2R, dist = lerp(268, 246, e);
    const tg = [lerp(-15, -7, e), lerp(9, 19, sstep(1.9, 3.0, t) * 0.8 + e * 0.2), 3];
    const eye = [tg[0] + dist * Math.sin(az) * Math.cos(pit), tg[1] + dist * Math.sin(pit), tg[2] + dist * Math.cos(az) * Math.cos(pit)];
    const fw = [tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]].map((x) => x / dist);
    const fp = [-10, 6, 10], focus = (fp[0] - eye[0]) * fw[0] + (fp[1] - eye[1]) * fw[1] + (fp[2] - eye[2]) * fw[2];
    return { eye, vp: mMul(mPersp(FOV, W / H, NEAR, FAR), mLook(eye, tg, [0, 1, 0])), focus };
  }
  function bindTex(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  function pass(P, tgt, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.fb : null); gl.viewport(0, 0, tgt ? tgt.w : W, tgt ? tgt.h : H);
    gl.useProgram(P.p); setup(P.u); gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function renderAt(t) {
    t = Math.max(0, Math.min(DUR, t));
    const sc = buildScene(t), cam = camera(t), st = sc.st;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, OUT.subarray(0, on), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(vao); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    // shadow map
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowT.fb); gl.viewport(0, 0, SM, SM); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P_SHADOW.p); gl.uniformMatrix4fv(P_SHADOW.u.uLVP, false, LVP);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
    gl.drawArrays(gl.TRIANGLES, 0, sc.nShadow);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, msT.ok ? msT.fb : sceneT.fb); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const u = P_SCENE.u; gl.useProgram(P_SCENE.p);
    gl.uniformMatrix4fv(u.uVP, false, cam.vp); gl.uniformMatrix4fv(u.uLVP, false, LVP);
    gl.uniform3fv(u.uL, LDIR); gl.uniform3fv(u.uEye, cam.eye);
    gl.uniform4f(u.uHero, st.x, st.z, Math.cos(st.yaw), Math.sin(st.yaw)); gl.uniform3f(u.uHeroB, 10, 5, st.y);
    gl.uniform4f(u.uFold, 0, 0, Math.cos(FOLD_YAW), Math.sin(FOLD_YAW));
    gl.uniform4f(u.uWarm, 0, 7, 1.5, sc.glow * 1.25); gl.uniform1f(u.uPour, sc.pour);
    bindTex(0, shadowT.depth, u.uShadow);
    gl.drawArrays(gl.TRIANGLES, 0, sc.nAll);
    if (msT.ok) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msT.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sceneT.fb);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    }
    gl.disable(gl.DEPTH_TEST);
    // depth of field
    const camU = [NEAR, FAR, cam.focus, 100];
    pass(P_DOF, halfT, (q) => { bindTex(0, sceneT.color, q.uCol); bindTex(1, sceneT.depth, q.uDep); gl.uniform4fv(q.uCam, camU); gl.uniform2f(q.uPx, 1 / W, 1 / H); });
    pass(P_FILL, half2T, (q) => { bindTex(0, halfT.color, q.uCol); gl.uniform2f(q.uPx, 1 / W, 1 / H); });
    pass(P_COMP, compT, (q) => { bindTex(0, sceneT.color, q.uCol); bindTex(1, sceneT.depth, q.uDep); bindTex(2, half2T.color, q.uBlur); gl.uniform4fv(q.uCam, camU); gl.uniform2f(q.uPx, 1 / W, 1 / H); });
    // bloom
    pass(P_BRIGHT, bl[0].a, (q) => { bindTex(0, compT.color, q.uCol); gl.uniform2f(q.uPx, 1 / W, 1 / H); });
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      if (i > 0) pass(P_DOWN, b.a, (q) => { bindTex(0, bl[i - 1].a.color, q.uCol); gl.uniform2f(q.uPx, 1 / bl[i - 1].a.w, 1 / bl[i - 1].a.h); });
      for (let r = 0; r < 2; r++) {
        pass(P_BLUR, b.b, (q) => { bindTex(0, b.a.color, q.uCol); gl.uniform2f(q.uDir, 1 / b.a.w, 0); });
        pass(P_BLUR, b.a, (q) => { bindTex(0, b.b.color, q.uCol); gl.uniform2f(q.uDir, 0, 1 / b.a.h); });
      }
    }
    pass(P_FINAL, null, (q) => { bindTex(0, compT.color, q.uCol); bindTex(1, bl[0].a.color, q.uB0); bindTex(2, bl[1].a.color, q.uB1); bindTex(3, bl[2].a.color, q.uB2); bindTex(4, bl[3].a.color, q.uB3); gl.uniform1f(q.uSeed, Math.round(t * 30) % 64); });
  }

  /* ------------------------------------------------------------------ run */
  const qs = new URLSearchParams(location.search);
  window.__piece = { renderAt, duration: DUR, isReady: () => true, info: { HDR, SAMPLES, ms: msT.ok } };
  if (qs.has('export')) { renderAt(0); }
  else if (qs.has('t')) { renderAt(parseFloat(qs.get('t')) || 0); }
  else {
    let t0 = null;
    const tick = (now) => { if (t0 === null) t0 = now; renderAt(((now - t0) / 1000) % DUR); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
})();
