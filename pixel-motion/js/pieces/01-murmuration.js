/* Murmuration — Perpetual Motion, piece 1.
 *
 * A starling murmuration over a wetland at sunset, on a 270 × 338 grid of 42 palette indices shown at 4×.
 * Nothing is simulated forward. Every bird owns a fixed place (u, s, r) on the body of the flock, and the
 * body is a deforming 3D surface written as a closed function of t: a twisting ribbon, a broad sheet that
 * rolls edge-on, a spinning funnel that pours toward the reeds, and two curling lobes that part and meet
 * again, blended by a cyclic schedule and crossed by travelling compression waves that pulse the density.
 * The surface is turned, tilted and projected with a little perspective; birds are counted into a density
 * grid, so an edge-on fold piles them into a near-black line, and the densest parts fill in with Bayer
 * dither. Sky bands are dithered only at their seams; clouds drift by a crossfade of two shifted textures
 * so they loop at any speed; the water mirrors the finished sky, darker and rippled, with a glint path; the
 * reeds sway in rolling waves of wind. D = 20 s and every periodic term turns a whole number of times in D.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 20, HZ = 206;
  const TAU = Math.PI * 2, fl = Math.floor, PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const SEED = 7; // the scene is composed for one seed
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn1(x, s) {
    const i = fl(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(ih(i, 17, s), ih(i + 1, 17, s), u);
  }
  function vn2(x, y, s) {
    const i = fl(x), j = fl(y), fx = x - i, fy = y - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = ih(i, j, s), b = ih(i + 1, j, s), c = ih(i, j + 1, s), d = ih(i + 1, j + 1, s);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  function fbm2(x, y, s, o) {
    let v = 0, a = 0.5, n = 0;
    for (let k = 0; k < o; k++) { v += a * vn2(x, y, s + k * 31); n += a; x *= 2.07; y *= 1.93; a *= 0.5; }
    return v / n;
  }
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette (42) */
  const PAL_HEX = [
    '1b1230', '261638', '341b45', '46214f', '5c2858', '76315f', '913b65', 'ac4868', 'c55a69', 'da706a', 'e98a6d', 'f3a674', 'f9c47f', 'fddf9c', // 0-13 sky
    'fff0c4', 'fffbe8',                                                     // 14-15 sun
    '3c1f48', '552855', '6f325c', '8a3d62',                                 // 16-19 cloud bodies
    'c0566a', 'e57a68', 'fb9f6c', 'ffc27a', 'ffe3a0',                       // 20-24 cloud undersides lit
    '120a18', '24132a', '3a1d3c',                                           // 25-27 trees, far shore
    '0b0610', '170c19', '241322', '3a1e33',                                 // 28-31 birds
    '0a0610', '160b18', '24121f', '3c1d27', '6a3333', 'a85a42', 'e09a5c', 'ffd08a', // 32-39 reeds
    '140c22', '22153a',                                                     // 40-41 deep water
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  const SU1 = 14, SU0 = 15, CB0 = 16, CL0 = 20, T0 = 25, T1 = 26, T2 = 27, B0 = 28, B1 = 29, B2 = 30, B3 = 31;
  const R0 = 32, R1 = 33, R2 = 34, R3 = 35, R4 = 36, R5 = 37, R6 = 38, R7 = 39, W0 = 40, W1 = 41;
  // what each colour turns into when seen reflected in the water: one step darker, birds to near-black
  const DARK = new Uint8Array(NPAL);
  for (let i = 0; i < NPAL; i++) DARK[i] = i;
  for (let k = 1; k <= 13; k++) DARK[k] = k - 1;
  DARK[0] = W0; DARK[SU0] = SU1; DARK[SU1] = 13;
  DARK[16] = W1; DARK[17] = 16; DARK[18] = 17; DARK[19] = 18;
  DARK[20] = 7; DARK[21] = 20; DARK[22] = 21; DARK[23] = 22; DARK[24] = 23;
  DARK[T2] = T1; DARK[T1] = T0; DARK[T0] = T0;
  DARK[B1] = B0; DARK[B2] = B0; DARK[B3] = B1;
  const LIGHT = new Uint8Array(NPAL); // ripple crests catch the brighter sky
  for (let i = 0; i < NPAL; i++) LIGHT[i] = DARK[i];
  for (let k = 0; k <= 12; k++) LIGHT[k] = k + 1;

  /* ================================================================ the scene, built once */
  const SUNX = 188, SUNY = HZ - 9, SRX = 16, SRY = 14;
  const SKY = new Uint8Array(W * HZ);   // sky bands with glow, no sun
  const OV = new Uint8Array(W * HZ);    // far shore, trees, pylons, wires; 255 = nothing
  const TREE_TOP = new Int16Array(W);
  // cloud layers: each a long strip of noise that slides past and crossfades into its own shifted copy
  const LAYERS = [
    { y0: 18, y1: 66, v: 1.5, sx: 70, sy: 7, th: 0.56, s: 101, kind: 0 },
    { y0: 92, y1: 150, v: 3, sx: 54, sy: 6, th: 0.58, s: 202, kind: 1 },
    { y0: 168, y1: 198, v: 4.5, sx: 46, sy: 3.2, th: 0.35, s: 303, kind: 2 },
  ];
  let built = false;
  function build() {
    if (built) return;
    built = true;
    // ---- sky: deliberate bands, dithered only where one band hands over to the next
    for (let y = 0; y < HZ; y++) {
      const hy = y / (HZ - 1);
      for (let x = 0; x < W; x++) {
        const dx = (x - SUNX) / 105, dy = (y - SUNY) / 48;
        let q = 1.0 + 10.4 * Math.pow(hy, 1.2);
        q += 2.6 * Math.exp(-(dx * dx + dy * dy)) + 1.1 * Math.exp(-(dx * dx * 0.12 + dy * dy * 0.5));
        const rr = Math.hypot((x - SUNX) / 1.15, y - SUNY);
        q += 1.4 * Math.exp(-rr * rr / 500);
        q = clamp(q, 0, 14.6);
        let k = fl(q);
        const f = q - k;
        if (f > 0.68 && (f - 0.68) / 0.32 > bay(x, y)) k++;
        SKY[y * W + x] = Math.min(SU1, k);
      }
    }
    // ---- cloud textures
    for (const L of LAYERS) {
      L.shift = Math.round(L.v * D);
      L.tw = W + 2 * L.shift + 4;
      L.rows = L.y1 - L.y0 + 1;
      L.tex = new Float32Array(L.tw * L.rows);
      L.mean = new Float32Array(L.rows);
      for (let j = 0; j < L.rows; j++) {
        const y = L.y0 + j, e = Math.sin(PI * (j + 0.5) / L.rows);
        let m = 0;
        for (let x = 0; x < L.tw; x++) {
          const bank = sstep(0.3, 0.7, vn1(x / 80 + j * 0.004, L.s + 5));
          const n = fbm2(x / L.sx, y / L.sy + vn1(x / 40, L.s) * 1.2, L.s, 5);
          const v = e * (0.35 + 0.65 * bank) * n * 1.35;
          L.tex[j * L.tw + x] = v; m += v;
        }
        L.mean[j] = m / L.tw;
      }
    }
    // ---- far shore and tree line
    OV.fill(255);
    const clumps = [];
    for (let k = 0; k < 16; k++) clumps.push({ c: ih(k, 1, 40) * (W + 40) - 20, w: 8 + ih(k, 2, 40) * 22, h: 4 + ih(k, 3, 40) * 10 });
    for (let x = 0; x < W; x++) {
      let hb = 4 + 3 * vn1(x / 9, 41) + (ih(x, 5, 42) < 0.3 ? 1 : 0); // far hazy row
      let hf = 1.5 + 2 * vn1(x / 6, 43);                              // nearer low scrub
      for (const c of clumps) { const d = (x - c.c) / c.w; if (d * d < 1) hb = Math.max(hb, 3 + c.h * Math.sqrt(1 - d * d) + (ih(x, 7, 44) - 0.5) * 2); }
      // a few poplars
      for (const px of [22, 31, 118, 126, 233, 262]) { const d = Math.abs(x - px); if (d < 3) hf = Math.max(hf, 16 - d * 3 + ih(x, 8, 45) * 2); }
      hb = Math.round(hb); hf = Math.round(hf);
      TREE_TOP[x] = HZ - Math.max(hb, hf);
      for (let y = HZ - hb; y < HZ; y++) if (y >= 0) OV[y * W + x] = T2;
      for (let y = HZ - hf; y < HZ; y++) if (y >= 0) OV[y * W + x] = T1;
      OV[(HZ - 1) * W + x] = T0;
    }
    // ---- pylons and wires
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < HZ) OV[y * W + x] = c; };
    const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) put(lerp(x0, x1, i / n), lerp(y0, y1, i / n), c); };
    const tips = [];
    function pylon(cx, base, h, c) {
      const wb = h * 0.17, wt = h * 0.045, top = base - h;
      const xl = (y) => cx - lerp(wb, wt, (base - y) / h), xr = (y) => cx + lerp(wb, wt, (base - y) / h);
      line(xl(base), base, xl(top), top, c); line(xr(base), base, xr(top), top, c);
      const step = Math.max(4, Math.round(h / 9));
      for (let y = base; y > top + step; y -= step) { line(xl(y), y, xr(y - step), y - step, c); line(xr(y), y, xl(y - step), y - step, c); }
      line(cx, top, cx, top - h * 0.1, c);
      const arms = [[0.12, 0.5], [0.3, 0.42]];
      const res = [];
      for (const [fy, fw] of arms) {
        const y = top + h * fy, w = h * fw;
        line(cx - w, y, cx + w, y, c); line(cx - w, y, xl(y + h * 0.06), y + h * 0.06, c); line(cx + w, y, xr(y + h * 0.06), y + h * 0.06, c);
        put(cx - w, y + 1, c); put(cx + w, y + 1, c); put(cx - w, y + 2, c); put(cx + w, y + 2, c);
        res.push([cx - w, y + 2], [cx + w, y + 2]);
      }
      res.push([cx, top - h * 0.1]);
      return res;
    }
    const pa = pylon(40, HZ - 2, 76, T0), pb = pylon(230, HZ - 3, 44, T1);
    tips.push(pa, pb);
    const wire = (x0, y0, x1, y1, sag, c, perch) => {
      const n = Math.ceil(Math.abs(x1 - x0));
      let lastY = null;
      for (let i = 0; i <= n; i++) {
        const f = i / n, x = lerp(x0, x1, f), y = lerp(y0, y1, f) + sag * 4 * f * (1 - f);
        put(x, y, c);
        if (lastY !== null && Math.abs(Math.round(y) - lastY) > 1) line(x - 1, lastY, x, y, c);
        lastY = Math.round(y);
        if (perch && ih(i, Math.round(y0), 50) < perch && x > 0 && x < W) { put(x, y - 1, B0); if (ih(i, 3, 51) < 0.4) put(x, y - 2, B0); }
      }
    };
    for (let k = 0; k < 5; k++) {
      const A = pa[k], B = pb[k];
      if (k === 1 || k === 3 || k === 4) { const j = k === 4 ? 4 : k - 1; wire(A[0], A[1], pb[j][0], pb[j][1], 8 + (k >> 1), T0, k === 3 ? 0.07 : k === 1 ? 0.04 : 0); }
      if (k === 0 || k === 2 || k === 4) wire(-30, A[1] + 16, A[0], A[1], 4, T0, k === 2 ? 0.05 : 0);
      if (k === 1 || k === 3 || k === 4) wire(B[0], B[1], W + 40, B[1] + 5, 3, T1, 0);
    }
    buildFlock();
    buildReeds();
  }

  /* ================================================================ the flock */
  const N = 6000;
  const FU = new Float32Array(N), FS = new Float32Array(N), FR = new Float32Array(N);
  const FK1 = new Float32Array(N), FK2 = new Float32Array(N), FP1 = new Float32Array(N), FP2 = new Float32Array(N);
  const FKF = new Float32Array(N), FPF = new Float32Array(N), FBIG = new Uint8Array(N);
  function buildFlock() {
    for (let i = 0; i < N; i++) {
      // a jittered grid spreads the birds evenly over the body, so density comes from its shape, not from clumping
      const iu = i % 150, is = (i / 150) | 0;
      FU[i] = (iu + ih(i, 1, 60)) / 150;
      FS[i] = ((is + ih(i, 2, 60)) / 40) * 2 - 1;
      FR[i] = (ih(i, 3, 60) + ih(i, 4, 60) - 1) * 1.5;
      FK1[i] = 3 + fl(ih(i, 6, 60) * 7); FK2[i] = 3 + fl(ih(i, 7, 60) * 7);
      FP1[i] = ih(i, 8, 60) * TAU; FP2[i] = ih(i, 9, 60) * TAU;
      FKF[i] = 80 + fl(ih(i, 10, 60) * 40); FPF[i] = ih(i, 11, 60) * TAU;
      FBIG[i] = ih(i, 12, 60) < 0.28 ? 1 : 0;
    }
  }
  // shape schedule: A ribbon, B sheet, C funnel, D two lobes
  const KEYS = [[0, 0], [3.0, 0], [5.0, 1], [7.4, 1], [9.4, 2], [12.0, 2], [14.0, 3], [16.6, 3], [19.4, 0], [20, 0]];
  const WGT = new Float32Array(4);
  function weights(t) {
    WGT.fill(0);
    for (let k = 0; k < KEYS.length - 1; k++) {
      const [t0, a] = KEYS[k], [t1, b] = KEYS[k + 1];
      if (t >= t0 && t < t1) { const f = sstep(0, 1, (t - t0) / (t1 - t0)); WGT[a] += 1 - f; WGT[b] += f; return; }
    }
    WGT[0] = 1;
  }
  const CNT = new Uint16Array(W * HZ), BOX = new Uint16Array(W * HZ), TMP = new Uint16Array(W * HZ);
  const BX = new Int16Array(N), BY = new Int16Array(N);
  function drawFlock(t, buf) {
    const tau = TAU * t / D;
    weights(t);
    const wA = WGT[0], wB = WGT[1], wC = WGT[2], wD = WGT[3];
    // body-wide motion
    const Xc = 136 + 30 * Math.sin(tau + 0.4) + 10 * Math.sin(2 * tau + 2.1) + wC * 6 + wD * 16;
    const Yc = 108 + 10 * Math.sin(2 * tau + 1.2) + 5 * Math.sin(3 * tau + 0.3) + wC * 4 - wD * 6 + wB * 6;
    const yaw = 0.5 * Math.sin(tau + 1.0) + 0.22 * Math.sin(2 * tau + 0.2);
    const pit = 0.22 * Math.sin(tau + 2.0) + 0.1 * Math.sin(3 * tau);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const LA = 220 + 25 * Math.sin(tau + 0.3);
    // the sheet is a rippling cloth seen from below; its view angle rolls through edge-on at about 6.3 s
    const beB = 1.0 - 1.9 * sstep(3.6, 8.8, t), cbB = Math.cos(beB), sbB = Math.sin(beB);
    const pour = Math.sin(PI * sstep(8.6, 13.6, t));
    const split = Math.sin(PI * sstep(12.4, 19.2, t));
    const spinC = 2 * tau, spinD = 1.6 * tau;
    const tiltD = 0.6 * Math.sin(tau * 2 + 0.5);
    let minX = W, maxX = -1, minY = HZ, maxY = -1;
    for (let i = 0; i < N; i++) {
      const u = FU[i], s0 = FS[i], r = FR[i];
      let a = Math.asin(2 * u - 1) / PI; // thinner toward the ends of the body
      // travelling compression waves along the body and across it
      a += 0.034 * Math.sin(TAU * 3 * a - 5 * tau) + 0.016 * Math.sin(TAU * 5 * a + 7 * tau + 1.3);
      const s = s0 + 0.2 * (1 - s0 * s0) * Math.sin(TAU * 2 * a + 4 * tau + 0.7);
      let x = 0, y = 0, z = 0;
      if (wA > 0.001) { // ribbon with a travelling twist
        const cx = a * LA, cy = 20 * Math.sin(TAU * a + 2 * tau) + 8 * Math.sin(TAU * 2 * a - 3 * tau + 1);
        const cz = 45 * Math.sin(TAU * a * 0.9 + tau);
        const wd = 44 * (1 - 3.0 * a * a) * (0.85 + 0.15 * Math.sin(TAU * 2 * a - 2 * tau));
        const th = 0.9 * PI * a + 0.9 * Math.sin(tau) + 0.6 * Math.sin(TAU * 1.5 * a - 3 * tau);
        const c = Math.cos(th), sn = Math.sin(th);
        x += wA * cx;
        y += wA * (cy + s * wd * c - r * 7 * sn);
        z += wA * (cz + s * wd * sn + r * 7 * c);
      }
      if (wB > 0.001) { // broad rippling sheet: where a ripple slopes along the line of sight, the birds pile into a dark fold
        const dep = s * 62 * (1 - 1.6 * a * a);
        const h = 15 * Math.sin(TAU * (1.1 * a + 0.45 * s) - 3 * tau) + 9 * Math.sin(TAU * (0.5 * a - 1.0 * s) + 2 * tau + 1) + r * 3;
        x += wB * (a * 205 + 10 * Math.sin(TAU * s * 0.5 + tau));
        y += wB * (h * cbB + dep * sbB);
        z += wB * (-h * sbB + dep * cbB);
      }
      if (wC > 0.001) { // funnel, wide at the top, pouring down at the tip
        const uu = clamp(u + 0.03 * Math.sin(TAU * 3 * u - 5 * tau), 0, 1);
        const R = 6 + 66 * Math.pow(1 - uu, 1.5) + r * 5;
        const al = PI * s + spinC + 2.6 * uu;
        const len = 120 + 55 * pour;
        x += wC * (R * Math.cos(al) + 26 * Math.sin(PI * uu * 1.3 + tau) * (0.4 + uu));
        y += wC * (64 - uu * len);
        z += wC * (R * Math.sin(al));
      }
      if (wD > 0.001) { // two rippling discs, unequal, that part and come back together
        const cut = -0.1, lobe = a < cut ? -1 : 1;
        const q = lobe < 0 ? (cut - a) / (cut + 0.5) : (a - cut) / (0.5 - cut);
        const sep = 34 + 44 * split;
        const Rl = lobe < 0 ? 42 : 54;
        const rho = Rl * Math.sqrt(q), ang = PI * s + lobe * spinD;
        const lx = rho * Math.cos(ang) * 1.05, dep = rho * Math.sin(ang);
        const h = 9 * Math.sin(TAU * (q * 0.8 + 0.3 * s) - 4 * tau + lobe) + 5 * Math.sin(2 * ang + 3 * tau) + r * 3;
        const tl = 0.8 + tiltD * lobe, ct = Math.cos(tl), st = Math.sin(tl);
        x += wD * (lobe * sep + lx);
        y += wD * (h * ct + dep * st + lobe * 12 * split * Math.sin(tau * 2));
        z += wD * (-h * st + dep * ct + lobe * 20 * split);
      }
      // a blend of two shapes pulls the birds toward their average; push them back out
      const nf = Math.pow(wA * wA + wB * wB + wC * wC + wD * wD, -0.35);
      x *= nf; y *= nf; z *= nf;
      // turn the whole body
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const pers = 360 / (360 - z2);
      let X = Xc + x1 * pers * 1.05 + 1.3 * Math.sin(FK1[i] * tau + FP1[i]);
      let Y = Yc - y1 * pers * 1.05 + 1.0 * Math.sin(FK2[i] * tau + FP2[i]);
      const xi = Math.round(X), yi = Math.round(Y);
      BX[i] = -1;
      if (xi < 1 || xi >= W - 1 || yi < 0 || yi >= HZ) continue;
      BX[i] = xi; BY[i] = yi;
      const p = yi * W + xi;
      CNT[p]++;
      if ((FBIG[i] || pers > 1.12) && Math.sin(FKF[i] * tau + FPF[i]) > 0.2) CNT[p + (i & 1 ? 1 : -1)]++;
      if (xi < minX) minX = xi; if (xi > maxX) maxX = xi; if (yi < minY) minY = yi; if (yi > maxY) maxY = yi;
    }
    // small parties rising from the far reeds behind the tree line, streaming up to join the flock
    for (let gi = 0; gi < JOIN.length; gi++) {
      const G = JOIN[gi];
      for (let k = 0; k < G.n; k++) {
        const j = G.tgt + k * 7;
        let ex = BX[j], ey = BY[j];
        if (ex < 0) { ex = Xc; ey = Yc; }
        let p = ((t / D + G.ph - k * G.lag) % 1 + 1) % 1;
        const e = p * p * (3 - 2 * p);
        const sx = G.sx + (ih(k, gi, 77) - 0.5) * 10, sy = HZ - 2;
        const cx = lerp(sx, ex, 0.3) + G.bow, cy = lerp(sy, ey, 0.75) + 20;
        const w = (1 - e) * (ih(k, gi, 78) - 0.5) * 8 * Math.sin(PI * e);
        const X = Math.round((1 - e) * (1 - e) * sx + 2 * e * (1 - e) * cx + e * e * ex + w + Math.sin(FK1[k] * tau + k) * 0.8);
        const Y = Math.round((1 - e) * (1 - e) * sy + 2 * e * (1 - e) * cy + e * e * ey + w * 0.5);
        if (X < 1 || X >= W - 1 || Y < 0 || Y >= HZ) continue;
        CNT[Y * W + X]++;
        if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      }
    }
    if (maxX < 0) return;
    const x0 = Math.max(0, minX - 3), x1 = Math.min(W - 1, maxX + 3), y0 = Math.max(0, minY - 3), y1 = Math.min(HZ - 1, maxY + 3);
    // 5 × 5 box sum of the counts
    for (let y = y0; y <= y1; y++) {
      const o = y * W;
      for (let x = x0; x <= x1; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx >= 0 && xx < W) s += CNT[o + xx]; }
        TMP[o + x] = s;
      }
    }
    for (let y = y0; y <= y1; y++) {
      const o = y * W;
      for (let x = x0; x <= x1; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy >= y0 && yy <= y1) s += TMP[yy * W + x]; }
        BOX[o + x] = s;
      }
    }
    for (let y = y0; y <= y1; y++) {
      const o = y * W;
      for (let x = x0; x <= x1; x++) {
        const p = o + x, c = CNT[p], b = BOX[p];
        if (c > 0) buf[p] = b >= 25 ? B0 : b >= 14 ? B1 : b >= 6 ? B2 : B3;
        else if (b >= 12) {
          const f = (b - 12) / 16;
          if (f > bay(x, y)) buf[p] = b >= 23 ? B1 : B2;
        }
        CNT[p] = 0;
      }
    }
  }
  const JOIN = [];
  for (let g = 0; g < 5; g++) JOIN.push({ n: 26 + fl(ih(g, 1, 76) * 30), ph: g / 5 + ih(g, 2, 76) * 0.08, lag: 0.0016 + ih(g, 3, 76) * 0.002, sx: [20, 250, 95, 205, 150][g], bow: (ih(g, 4, 76) - 0.5) * 120, tgt: fl(ih(g, 5, 76) * 5000) });
  // a few nearer birds, big enough to show their wings, flying their own loops low over the water
  const NEAR = [];
  for (let k = 0; k < 11; k++) NEAR.push({ cx: 70 + ih(k, 1, 70) * 130, cy: 112 + ih(k, 2, 70) * 92, ax: 60 + ih(k, 3, 70) * 80, ay: 10 + ih(k, 4, 70) * 22, p: ih(k, 5, 70) * TAU, k: 1 + (k % 3 === 0 ? 1 : 0), dir: k & 1 ? 1 : -1, f: 80 + fl(ih(k, 6, 70) * 40), fp: ih(k, 7, 70) * TAU, gl: 2 + fl(ih(k, 8, 70) * 3), big: k % 4 === 1 });
  const SPR4 = [ // wings up, level, down
    [[0, 0], [3, 0], [1, 1], [2, 1]],
    [[0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
    [[1, 1], [2, 1], [0, 2], [3, 2]],
  ];
  const SPR5 = [
    [[0, 0], [4, 0], [1, 1], [3, 1], [2, 1], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [2, 2]],
    [[1, 1], [2, 1], [3, 1], [0, 2], [4, 2], [2, 2]],
  ];
  function drawNear(t, buf) {
    const tau = TAU * t / D;
    for (const b of NEAR) {
      const ang = b.dir * b.k * tau + b.p;
      const X = Math.round(b.cx + b.ax * Math.cos(ang)), Y = Math.round(b.cy + b.ay * Math.sin(2 * ang) * 0.7 + 6 * Math.sin(3 * tau + b.p));
      const glide = Math.sin(b.gl * tau + b.p) > 0.5;
      const ph = glide ? 1 : fl(((((b.f * tau + b.fp) / TAU) % 1) + 1) % 1 * 4);
      const fr = (b.big ? SPR5 : SPR4)[[0, 1, 2, 1][ph]];
      for (const [dx, dy] of fr) { const x = X + dx - 2, y = Y + dy - 1; if (x >= 0 && x < W && y >= 0 && y < H && (y >= HZ || OV[y * W + x] === 255)) buf[y * W + x] = B0; }
    }
  }

  /* ================================================================ reeds */
  const REEDS = [];
  const BASE = new Int16Array(W); // top of the dark mass the near reeds grow out of
  function wind(x, t) {
    const tau = TAU * t / D;
    const g = Math.sin(TAU * x / 300 - tau);
    return 0.55 * Math.sin(TAU * x / 110 - 3 * tau) + 0.25 * Math.sin(TAU * x / 47 - 5 * tau + 1) + 0.7 * g * g * g;
  }
  const sideH = (x) => { const l = sstep(130, 40, x), r = sstep(200, 262, x); return Math.max(l, r * 0.85); };
  function buildReeds() {
    // far islands of reed in the water
    const isl = [[8, 70, 236], [96, 140, 228], [214, 262, 240]];
    let id = 0;
    for (const [a, b, y] of isl) {
      for (let k = 0; k < (b - a) * 2.2; k++) {
        const x = lerp(a, b, ih(k, a, 80)), e = Math.sin(PI * (x - a) / (b - a));
        REEDS.push({ bx: x, by: y + 1 + ih(k, 2, 80) * 2, h: (4 + ih(k, 3, 80) * 9) * (0.4 + 0.6 * e), lean: (ih(k, 4, 80) - 0.5) * 0.3, ph: ih(k, 5, 80) * TAU, far: 1, plume: ih(k, 6, 80) < 0.4, leaf: 0, s: id++ });
      }
    }
    for (let x = 0; x < W; x++) BASE[x] = Math.round(334 - 16 * sideH(x) - 3 * vn1(x / 5, 85) + (ih(x, 1, 86) < 0.3 ? -1 : 0));
    // the near bed: tall at the sides, low in the middle so the glint path shows through
    const n = 190;
    for (let k = 0; k < n; k++) {
      const x = -10 + ih(k, 1, 81) * (W + 20);
      const sd = sideH(clamp(x, 0, W - 1));
      const by = BASE[clamp(Math.round(x), 0, W - 1)] + 2 + ih(k, 2, 81) * 14;
      const h = (14 + sd * 74) * (0.6 + 0.55 * ih(k, 3, 81));
      REEDS.push({ bx: x, by, h, lean: (ih(k, 4, 81) - 0.4) * 0.22, ph: ih(k, 5, 81) * TAU, far: 0, plume: ih(k, 6, 81) < 0.5, leaf: 1 + fl(ih(k, 7, 81) * 3.4), s: id++ });
    }
    REEDS.sort((p, q) => (q.far - p.far) * 1000 + (p.by - q.by));
  }
  function drawReeds(t, buf) {
    const tau = TAU * t / D;
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= HZ && y < H) buf[y * W + x] = c; };
    // dark mass of stems and mud at the foot of the near bed
    for (let x = 0; x < W; x++) for (let y = BASE[x]; y < H; y++) buf[y * W + x] = R0;
    for (const rd of REEDS) {
      const wv = wind(rd.bx, t);
      const flick = 0.025 * Math.sin(7 * tau + rd.ph) + 0.015 * Math.sin(11 * tau + rd.ph * 2);
      const bend = rd.lean + 0.1 * (wv + 0.5) + flick; // tip displacement per unit height
      const tipx = bend * rd.h;
      const n = Math.max(2, Math.ceil(rd.h));
      const big = !rd.far && rd.h > 45;
      const stalk = rd.far ? T1 : R0, rim = rd.far ? T2 : R2;
      const rimSide = rd.bx < SUNX ? 1 : -1, nearSun = Math.abs(rd.bx - SUNX) < 110;
      let px = 0, py = 0;
      for (let j = 0; j <= n; j++) {
        const f = j / n, ff = Math.pow(f, 1.7);
        px = rd.bx + tipx * ff; py = rd.by - rd.h * f;
        put(px, py, stalk);
        if (big && f < 0.55) put(px - rimSide, py, stalk);
        if (!rd.far && f > 0.2 && ((j + rd.s) % 3) !== 0) put(px + rimSide, py, f > 0.7 && nearSun ? R3 : rim);
      }
      // leaves: long blades that arch out and droop, pushed by the same wind
      for (let l = 0; l < rd.leaf; l++) {
        const f = 0.2 + 0.25 * l + ih(rd.s, l, 82) * 0.12, dir = (ih(rd.s, l + 4, 82) < 0.5 ? -1 : 1);
        const lx = rd.bx + tipx * Math.pow(f, 1.7), ly = rd.by - rd.h * f, len = (big ? 14 : 7) + ih(rd.s, l + 8, 82) * (big ? 16 : 8);
        for (let j = 1; j <= len; j++) {
          const sw = (wv * 0.18 + flick * 4) * j;
          const yy = ly - j * 0.85 + j * j * (0.05 + 0.03 * ih(rd.s, l, 87));
          put(lx + dir * j * 0.8 + sw, yy, R1);
          if (j < len * 0.5) put(lx + dir * j * 0.8 + sw, yy + 1, R1);
        }
      }
      // plume: a feathery panicle that arches over and droops to leeward, lit from behind
      if (rd.plume) {
        const L = rd.far ? 3 : big ? 15 + (rd.s % 5) : 8;
        const Wp = rd.far ? 0.6 : big ? 3.2 : 1.8;
        let sx = px, sy = py;
        const th0 = -PI / 2 + 0.35 + bend * 2.2, dth = (1.5 + bend * 1.5) / L;
        for (let j = 0; j < L; j++) {
          const g = j / L, th = th0 + dth * j;
          const cx = Math.cos(th), cy = Math.sin(th);
          sx += cx * 0.95; sy += cy * 0.95;
          const w = Wp * Math.sin(PI * Math.pow(g + 0.06, 0.65)) * (1 - 0.25 * g);
          const flut = 0.7 * Math.sin(9 * tau + rd.ph + j * 0.6);
          const nk = Math.ceil(w) + 1;
          for (let k = -nk; k <= nk; k++) {
            const kk = k / Math.max(0.5, w);
            if (kk * kk > 1.05) continue;
            const h1 = ih(rd.s, j * 16 + k + 8, 83);
            if (h1 > 0.95 - 0.55 * kk * kk + 0.25) continue; // feathery edge
            // perpendicular to the spine, the upper side is -cx, the lower +cx
            const ax = sx - cy * k + (k * k > 1 ? flut : 0), ay = sy + cx * k;
            let c;
            if (rd.far) c = ih(rd.s, j, 88) < 0.5 ? T2 : R3;
            else {
              const up = k * (cx >= 0 ? 1 : -1) <= -1 || (j === 0 && k === 0);
              const h2 = ih(rd.s, j * 16 + k + 8, 89);
              c = up ? (nearSun && h2 < 0.5 ? R7 : R6) : kk * kk > 0.4 ? (h2 < 0.5 ? R5 : R4) : (h2 < 0.6 ? R4 : R3);
            }
            put(ax, ay, c);
          }
        }
      }
    }
  }

  /* ================================================================ water */
  function drawWater(t, buf) {
    const tau = TAU * t / D;
    for (let y = HZ; y < H; y++) {
      const d = y - HZ, o = y * W;
      const ph0 = 300 / (d + 6), phase = ph0 + 6 * tau;
      const rw = Math.sin(phase);
      const amp = 0.4 + d * 0.035;
      const ym0 = 2 * HZ - 1 - y;
      const hw = 3 + d * 0.5;
      const rowOff = fl(ih(y, 1, 90) * 7);
      for (let x = 0; x < W; x++) {
        const wx = Math.sin(x * 0.045 * (1 + d / 30) + ph0 * 0.7 + 4 * tau + d * 0.2);
        const dx = Math.round(amp * (0.65 * rw + 0.5 * wx));
        const dy = Math.round(0.6 * Math.sin(ph0 * 1.3 + 8 * tau + x * 0.08));
        const sx = clamp(x + dx, 0, W - 1), sy = clamp(ym0 + dy, 0, HZ - 1);
        let c = buf[sy * W + sx];
        const crest = rw * 0.7 + wx * 0.5;
        c = crest > 0.95 ? LIGHT[c] : crest < -0.95 ? DARK[DARK[c]] : DARK[c];
        // the glint path under the sun
        const gx = Math.abs(x - SUNX);
        if (gx < hw) {
          const g = 1 - gx / hw;
          const dash = fl((x + rowOff) / (2 + (d >> 4)));
          const k = 5 + fl(ih(dash, y, 91) * 9);
          const sv = Math.sin(k * tau + ih(dash, y, 92) * TAU);
          if (sv > 1 - 1.5 * g * g) c = g > 0.6 && d < 70 ? SU0 : g > 0.35 ? SU1 : 13;
        }
        buf[o + x] = c;
      }
    }
  }

  /* ================================================================ clouds and sun */
  const DENS = new Float32Array(W * (HZ + 3));
  function drawSky(t, buf) {
    const tau = TAU * t / D;
    buf.set(SKY);
    // the sun, low and slightly flattened, its lower rows shimmering in the haze
    for (let y = SUNY - SRY; y <= SUNY + SRY && y < HZ; y++) {
      const dy = (y - SUNY) / SRY;
      const sh = y > SUNY - 3 ? Math.round(0.9 * Math.sin(y * 1.7 + 7 * tau)) : 0;
      const hw = SRX * Math.sqrt(Math.max(0, 1 - dy * dy));
      for (let x = Math.ceil(SUNX - hw); x <= SUNX + hw; x++) {
        const xx = x + sh; if (xx < 0 || xx >= W) continue;
        const e = hw - Math.abs(x - SUNX);
        buf[y * W + xx] = e < 1.5 ? SU1 : SU0;
      }
    }
    // clouds: sum of the layers, each a crossfade of its strip and the strip shifted by one loop of drift
    DENS.fill(0);
    const wb = t / D, wa = 1 - wb, nrm = 1 / Math.sqrt(wa * wa + wb * wb);
    for (const L of LAYERS) {
      const off = fl(L.v * t);
      for (let j = 0; j < L.rows; j++) {
        const y = L.y0 + j, m = L.mean[j], ro = j * L.tw, o = y * W;
        for (let x = 0; x < W; x++) {
          const A = L.tex[ro + x + off + L.shift] , B = L.tex[ro + x + off];
          DENS[o + x] += m + (wa * (A - m) + wb * (B - m)) * nrm;
        }
      }
    }
    for (const L of LAYERS) {
      for (let y = L.y0; y <= L.y1; y++) {
        const o = y * W, hy = y / HZ;
        for (let x = 0; x < W; x++) {
          const dd = DENS[o + x], e = dd - L.th;
          if (e < 0) continue;
          if (e < 0.03 && e / 0.03 < bay(x, y)) continue;
          const below = DENS[o + 2 * W + x], rim = dd - below;
          const sunk = Math.exp(-((x - SUNX) * (x - SUNX)) / 9000);
          let c;
          if (L.kind === 0) {
            c = rim > 0.07 ? (rim > 0.14 ? 21 : 20) : e > 0.08 ? 18 : 17;
            if (rim > 0.1 && sunk > 0.5) c = 22;
          } else if (L.kind === 1) {
            c = rim > 0.06 ? (rim > 0.13 ? 23 : 22) : e > 0.1 ? 17 : 18;
            if (rim > 0.06 && rim <= 0.13 && sunk < 0.3) c = 21;
          } else {
            c = rim > 0.05 ? (sunk > 0.55 ? 24 : 23) : e > 0.06 ? 18 : 19;
          }
          buf[o + x] = c;
        }
      }
    }
  }

  /* ================================================================ frame */
  const BUF = new Uint8Array(NP);
  function render(t) {
    t = ((t % D) + D) % D;
    build();
    drawSky(t, BUF);
    drawFlock(t, BUF);
    for (let i = 0; i < W * HZ; i++) if (OV[i] !== 255) BUF[i] = OV[i];
    drawWater(t, BUF);
    drawNear(t, BUF);
    drawReeds(t, BUF);
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
    g.fillStyle = '#120a18'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'murmuration',
    title: 'Murmuration',
    medium: 'Closed-loop flock of 6,000 birds in 42 colours, 270 × 338 · 20 s loop',
    note: 'One shape, thousands of birds · tap to pause',
    about: 'Starlings over a reed bed at sundown. Nothing here is simulated: every bird has a fixed place on the body of the flock, and the body is a surface that bends through a closed loop of shapes, a ribbon, a sheet rolling edge-on, a funnel pouring toward the reeds, two lobes that part and meet again, while waves of density run through it. Where the birds pile up the sky goes nearly black.',
    tone: 'dark',
    room: '#120a18',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, ready = false;
      el.style.background = '#120a18';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,240,220,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,240,220,.8)"/></svg>';
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
        window.__murmuration = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__murmuration.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'murmuration';
        api.ready();
      } else {
        window.__murmuration = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__murmuration) delete window.__murmuration;
        },
      };
    },
  });
})();
