/* The Falls — piece 3.
 *
 * Palette cycling, the 1990s way. The whole landscape is painted exactly once, at mount, into a
 * 270 × 338 buffer of palette indices. Nothing in that buffer is ever redrawn. Every frame only the
 * palette changes: a dozen independent ranges of entries rotate at their own speeds, and because each
 * flowing thing was painted as a dithered strip of consecutive indices laid along its direction of
 * flow, rotating the colours reads as water falling, ripples spreading, mist rising and stars breathing.
 * D = 16 s and every range turns a whole number of times in D, so the loop is seamless.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H, D = 16;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // value noise, 1D and 2D, seeded; everything here is evaluated once at mount
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
    for (let k = 0; k < (o || 4); k++) { v += a * vn2(x, y, s + k * 31); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
    return v / n;
  }
  function rdg(x, y, s) { const n = fbm2(x, y, s, 3); return 1 - Math.abs(2 * n - 1); }
  function fbm1(x, s, o) {
    let v = 0, a = 0.5, n = 0;
    for (let k = 0; k < (o || 4); k++) { v += a * vn1(x, s + k * 31); n += a; x *= 2.1; a *= 0.5; }
    return v / n;
  }
  // 8 × 8 Bayer, values in [0, 1)
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette */
  // Static entries first, then the cycling ranges. Each range: colours laid out along the flow.
  const PAL = [];
  const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  function add(list) { const lo = PAL.length; for (const h of list) PAL.push(hex(h)); return lo; }

  const SKY = add(['070918', '0b1028', '111739', '1a1d4a', '282258', '3c2a64', '5a356e', '7a4272']);
  const MOON = add(['fff6dc', 'd9cfb0']);
  const HALO = add(['1a2250', '2a3464', '45528a']);
  const FAR = add(['2c2a5c', '3a3470', '524886']);
  const CL = add(['121430', '191b40', '22264f', '303a6c', '4b5b94']);
  const FG = add(['07081a', '0c0e22']);
  const LEAF = add(['0b1824', '15303c', '24504e']);
  const LIP = add(['b6d2f0']);

  // cycling ranges: { lo, n, k: whole rotations per loop, blend }
  const R = [];
  function range(cols, k, blend) { const r = { lo: add(cols), n: cols.length, k, blend, base: cols.map(hex) }; R.push(r); return r; }
  const STA = range(['2a3260', '6a78b0', 'eef2ff', '6a78b0'], 9, false);
  const STB = range(['2c2650', 'fff0e6', '8a7090'], 7, false);
  const AUA = range(['141c44', '16344e', '1c4c54', '206058', '18404f'], 3, true);   // aurora veil
  const AUB = range(['1c4a54', '267660', '42a87e', '90e8bc', '3a9474'], 3, true);   // aurora core
  const FARF = range(['3a3470', '46428a', '7a78ac', '4e4a86'], 60, false); // distant falls
  const FA = range(['1a2c5c', '1f3768', '284878', '33598c', '4c78aa', '7aa2d0', '4c78aa', '2a4a7e'], 60, false); // fall, shade
  const FB = range(['2e4f86', '3a6098', '4a74ac', '6690c4', '94b8e0', 'e6f4ff', 'a8c8ea', '5a84bc'], 60, false); // fall, lit
  const POOL = range(['0f1838', '111c40', '152250', '1d3062', '4468a6', '1c2c5c'], 16, true);
  const MIST = range(['232a56', '2a3462', '364672', '4c6296', '7088ba', '3c4e84'], 2, true);
  const RVA = range(['0e1534', '0f1738', '131d44', '1c2b58', '2e4478', '152048'], 16, true);
  const RVB = range(['22305e', '33467e', '5c78b0', 'dce8ff', '8aa6d8', '3a4e88'], 16, true);
  const FLY = range(['0c0e22', '0c0e22', '1c2018', '4a5428', 'a0b850', 'f6ffb0', '0c0e22', '0c0e22'], 12, false); // fireflies
  const NPAL = PAL.length; // 96

  /* ================================================================ the indexed image */
  const IDX = new Uint8Array(NP);
  const put = (x, y, i) => { if (x >= 0 && y >= 0 && x < W && y < H) IDX[y * W + x] = i; };
  const get = (x, y) => IDX[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
  const cyc = (r, p, x, y) => r.lo + (((fl(p + bay(x, y)) % r.n) + r.n) % r.n);

  // geometry, shared by several painters
  const MX = 211, MY = 50, MR = 11;            // moon
  const FX = 135, FTOP = 98, FBOT = 236;       // main fall
  const PX = 138, PY = 243, PRX = 74, PRY = 12; // plunge pool

  function farTop(x) { return 138 + 16 * (fbm1(x * 0.018, 3) - 0.5) + 7 * Math.abs(Math.sin(x * 0.045 + 1.3)) - 6 * sstep(150, 260, x); }
  function mainTop(x) {
    let t = 94 + 5 * (fbm1(x * 0.09, 5) - 0.5);
    t += Math.max(0, 92 - x) * 2.4 + Math.max(0, x - 182) * 2.1;
    const n = Math.abs(x - FX);
    if (n < 14) t += 4 * (1 - n / 14) * (1 - n / 14) + 1;
    return t;
  }
  function leftTop(x) { return 176 + 0.9 * Math.max(0, x - 40) + 10 * (fbm1(x * 0.07, 7) - 0.5) - 12 * sstep(30, 0, x) + (x > 60 && x < 76 ? -3 : 0); }
  function rightTop(x) { return 150 + 1.1 * Math.max(0, 212 - x) + 9 * (fbm1(x * 0.08, 9) - 0.5) - 10 * sstep(240, 270, x) + (x > 222 ? 6 : 0); }

  /* -------- river: a winding centre line from the pool to the bottom edge */
  const RIV = [];
  (function () {
    const P = [[146, 244], [140, 252], [124, 262], [102, 276], [92, 292], [108, 307], [150, 320], [200, 334], [226, 352]];
    for (let s = 0; s < P.length - 1; s++) {
      const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
      for (let k = 0; k < 40; k++) {
        const t = k / 40, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        RIV.push({ x, y });
      }
    }
    let ph = 0;
    for (let i = 0; i < RIV.length; i++) {
      const a = RIV[i], b = RIV[i - 1] || a;
      const ds = Math.hypot(a.x - b.x, a.y - b.y);
      const persp = 1 + (a.y - 248) / 30;          // ripples grow as they near the viewer
      ph += ds * 1.5 / persp;
      a.ph = ph;
      a.w = 6 + Math.pow(clamp((a.y - 246) / 96, 0, 1), 1.2) * 44;  // half width
    }
  })();
  function riverAt(x, y) {
    let best = 1e9, bi = 0;
    for (let i = 0; i < RIV.length; i += 2) { const a = RIV[i], d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y); if (d < best) { best = d; bi = i; } }
    for (let i = Math.max(0, bi - 2); i < Math.min(RIV.length, bi + 3); i++) { const a = RIV[i], d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y); if (d < best) { best = d; bi = i; } }
    return { i: bi, d: Math.sqrt(best), a: RIV[bi] };
  }

  /* ================================================================ painting, once */
  function paint() {
    IDX.fill(SKY);
    const MASK = new Uint8Array(NP); // which layer owns a pixel: 0 sky, 1 far, 2 main, 3 left, 4 right, 5 water, 6 bank, 7 fg
    const own = (x, y) => (y < 0 ? 0 : (x < 0 || x >= W || y >= H) ? 255 : MASK[y * W + x]);

    /* ---------- sky: a long dusk gradient, warm low on the left, dithered */
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const glow = 1.1 * Math.exp(-((x - 70) * (x - 70)) / (2 * 120 * 120)) * sstep(70, 175, y);
      let v = Math.pow(y / 178, 1.35) * 5.6 + glow;
      v = clamp(v, 0, 7.4);
      IDX[y * W + x] = SKY + clamp(fl(v + bay(x, y)), 0, 7);
    }

    /* ---------- halo around the moon */
    for (let y = 0; y < 120; y++) for (let x = 140; x < W; x++) {
      const d = Math.hypot(x - MX, (y - MY) * 1.0);
      if (d <= MR + 0.5) continue;
      const h = 4.6 * Math.exp(-(d - MR) / 11) + 0.9 * Math.exp(-(d - MR) / 34);
      const lv = fl(h + bay(x, y) - 0.25);
      if (lv >= 1) IDX[y * W + x] = HALO + Math.min(2, lv - 1);
    }

    /* ---------- aurora: a folded curtain, rays laid across x so the colours slide sideways */
    const auroraI = new Float32Array(NP);
    for (let x = 0; x < 200; x++) {
      const yb = 74 + 16 * Math.sin(x * 0.021 + 0.6) + 7 * Math.sin(x * 0.057 + 2.1) - x * 0.12;
      const env = sstep(-20, 30, x) * sstep(205, 120, x);
      const ray = 0.55 + 0.45 * fbm1(x * 0.21, 41, 3);
      for (let y = 0; y < 120; y++) {
        const up = yb - y;
        let I;
        if (up < 0) I = Math.exp(up / 2.2);
        else I = Math.exp(-up / (13 + 12 * vn1(x * 0.05, 43))) * (1 - sstep(48, 70, up));
        I *= env * ray;
        auroraI[y * W + x] = I;
        if (I + (bay(x, y) - 0.5) * 0.28 < 0.16) continue;
        const p = x * 0.16 + 5 * fbm1(x * 0.03, 47, 3) + up * 0.035 + 2.2 * vn1(x * 0.4, 49);
        const core = I + (bay(x + 3, y + 1) - 0.5) * 0.3 > 0.52;
        IDX[y * W + x] = cyc(core ? AUB : AUA, p, x, y);
      }
    }

    /* ---------- stars, twinkling on two tiny cycles */
    for (let k = 0; k < 210; k++) {
      const x = fl(ih(k, 1, 101) * W), y = fl(Math.pow(ih(k, 2, 101), 1.35) * 150);
      if (y > farTop(x) - 8 || y > mainTop(x) - 6) continue;
      if (Math.hypot(x - MX, y - MY) < MR + 16) continue;
      if (auroraI[y * W + x] > 0.45) continue;
      const r = ih(k, 3, 101) < 0.62 ? STA : STB;
      IDX[y * W + x] = r.lo + fl(ih(k, 4, 101) * r.n);
      if (ih(k, 5, 101) < 0.08 && y < 130) { // a few brighter stars with dim arms
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, HALO + 1);
      }
    }

    /* ---------- moon */
    for (let y = MY - MR - 1; y <= MY + MR + 1; y++) for (let x = MX - MR - 1; x <= MX + MR + 1; x++) {
      const dx = x - MX, dy = y - MY, d = Math.hypot(dx, dy);
      if (d > MR + 0.3) continue;
      let c = MOON;
      const m = fbm2(x * 0.22, y * 0.22, 61, 3);
      if (m > 0.56) c = MOON + 1;
      if (d > MR - 1.2 && dx < 0 && bay(x, y) < 0.6) c = MOON + 1;
      IDX[y * W + x] = c;
    }

    /* ---------- far range, with its distant thin falls */
    for (let x = 0; x < W; x++) {
      const t = fl(farTop(x));
      for (let y = t; y < H; y++) {
        MASK[y * W + x] = 1;
        const depth = y - t;
        const strata = fbm2(x * 0.12, y * 0.05, 71, 3);
        let v = 0.9 + (strata - 0.5) * 1.4 - depth * 0.015;
        if (depth < 2) v = 2.3;
        else if (depth < 5 && ih(x, y, 73) < 0.6) v += 0.8;
        IDX[y * W + x] = FAR + clamp(fl(v + bay(x, y)), 0, 2);
      }
    }
    for (const [fx, w] of [[28, 2], [58, 1], [246, 2], [226, 1]]) {
      const t = fl(farTop(fx)) + 2;
      for (let y = t; y < t + 46; y++) for (let x = fx - w; x <= fx + w; x++) {
        if (own(x, y) !== 1) continue;
        const p = (y - t) * 0.5 + 2.5 * vn1(x * 0.9, 77);
        if (ih(x, y, 79) < sstep(t + 30, t + 46, y)) continue;
        IDX[y * W + x] = cyc(FARF, p, x, y);
      }
    }

    /* ---------- cliffs: basalt columns, each lit on its right by the moon and split by joints */
    const haze = (x, y) => 1.2 * sstep(165, 246, y) * Math.exp(-(((x - FX) / 85) ** 2));
    const COLK = new Int32Array(NP).fill(-1), COLU = new Float32Array(NP), TOPY = new Int16Array(NP);
    function cliff(layer, topFn, x0, x1, o) {
      let x = x0, k = 0;
      while (x < x1) {
        const w = 3 + fl(ih(k, layer, 900) * o.wv);
        const xm = x + w / 2;
        const tc = topFn(xm) + (ih(k, layer, 901) - 0.5) * o.jag;
        const sl = (ih(k, layer, 902) - 0.5) * 0.8;
        for (let xx = x; xx < x + w && xx < x1; xx++) {
          if (xx < 0 || xx >= W) continue;
          const t = Math.max(0, fl(lerp(topFn(xx), tc + sl * (xx - xm), o.mix(xx))));
          for (let y = t; y < H; y++) { const i = y * W + xx; MASK[i] = layer; COLK[i] = k + layer * 1000; COLU[i] = (xx - x + 0.5) / w; TOPY[i] = t; }
        }
        x += w; k++;
      }
      for (let y = 0; y < H; y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x; if (MASK[i] !== layer) continue;
        const k = COLK[i], u = COLU[i], dep = y - TOPY[i];
        let rim = 9;
        for (let s = 1; s < 9; s++) { const ow = own(x + Math.round(s * 0.7), y - s); if (ow < layer) { rim = s; break; } }
        // a ridged height field, stretched tall: gullies and buttresses, lit from the moon side
        const hf = (xx, yy) => 1.0 * rdg(xx * 0.06, yy * 0.016, o.seed) + 0.5 * rdg(xx * 0.15, yy * 0.04, o.seed + 9) + 0.18 * vn2(xx * 0.45, yy * 0.12, o.seed + 13);
        const gx = hf(x + 1, y) - hf(x - 1, y), gy = hf(x, y + 1) - hf(x, y - 1);
        let v = o.base - gx * o.amp * 2.4 + gy * 0.8 + (ih(k, 9, o.seed) - 0.5) * 0.5 - dep * o.fade;
        if (x > 0 && COLK[i - 1] !== k && Math.abs(TOPY[i - 1] - TOPY[i]) > 3) v -= 0.9;
        if (rim <= 1) v = 4.3; else if (rim <= 2) v = Math.max(v + 1.2, 3.1); else if (rim <= 5) v += 0.5;
        if (o.shade) v += o.shade(x, y);
        const q = clamp(fl(v + bay(x, y)), 0, 4);
        IDX[i] = CL + q;
        // moss where the spray keeps the rock wet, and on the ledges of the side cliffs
        const wet = Math.exp(-(((x - FX) / 75) ** 2)) * sstep(150, 228, y) + (layer > 2 ? 0.35 : 0.12) * (gy > 0.03 ? 1 : 0);
        const mo = fbm2(x * 0.11, y * 0.07, o.seed + 21, 3);
        if (rim > 2 && Math.abs(x - FX) > 18 && mo + wet * 0.35 > 0.74) IDX[i] = q >= 3 ? LEAF + 2 : q >= 1 ? LEAF + 1 : LEAF;
      }
    }
    cliff(2, mainTop, -4, W + 4, {
      wv: 12, jag: 12, amp: 3.0, base: 1.5, fade: 0.0035, seed: 81,
      mix: (x) => sstep(14, 30, Math.abs(x - FX)) * 0.9,
      shade: (x, y) => -1.3 * Math.exp(-(((x - FX) / 24) ** 2)) * sstep(FTOP - 4, FTOP + 16, y) + 1.0 * Math.exp(-(((x - FX) / 40) ** 2) - ((y - FBOT) / 22) ** 2) + haze(x, y),
    });
    cliff(3, leftTop, -6, 112, { wv: 12, jag: 10, amp: 2.6, base: 0.85, fade: 0.006, seed: 91, mix: () => 0.85, shade: haze });
    cliff(4, rightTop, 158, W + 6, { wv: 12, jag: 10, amp: 2.6, base: 0.85, fade: 0.006, seed: 95, mix: () => 0.85, shade: haze });

    /* ---------- pines along the cliff tops */
    function topOf(x, layer) { for (let y = 0; y < H; y++) if (MASK[y * W + x] === layer) return y; return H; }
    function pine(px, py, h, layer, dark) {
      const tl = 3 + fl(h / 14);
      for (let j = 0; j < h; j++) {
        const y = py - j;
        const tf = (j % tl) / tl;
        let half = (h - j) * 0.3 * (0.5 + 0.5 * (1 - tf)) + (j < 2 ? -9 : 0);
        if (j >= h - 2) half = 0.4;
        const jl = (ih(j, px, 213) - 0.5) * 1.2, jr = (ih(j, px, 217) - 0.5) * 1.2;
        const xa = Math.round(px - Math.max(0, half) + jl), xb = Math.round(px + Math.max(0, half) + jr);
        for (let x = Math.min(xa, px); x <= Math.max(xb, px); x++) {
          const lit = (x >= xb && j > 1 && half > 1) || (x >= xb - 2 && tf < 0.34 && j > 1 && half > 2) || (tf < 0.2 && x > px && ih(x, y, 219) < 0.3);
          put(x, y, dark ? (lit ? (ih(x, y, 223) < 0.3 ? CL + 3 : CL + 2) : (x > px + 1 && ih(x, y, 227) < 0.12 ? CL : FG)) : (lit ? LEAF + 1 : LEAF));
          if (y >= 0 && y < H && x >= 0 && x < W) MASK[y * W + x] = layer;
        }
      }
    }
    for (let k = 0; k < 46; k++) {
      const x = fl(lerp(60, 210, ih(k, 1, 201)));
      if (Math.abs(x - FX) < 20) continue;
      const t = topOf(x, 2);
      if (t > 175) continue;
      pine(x, t + 1, fl(5 + ih(k, 2, 201) * 9), 2, false);
    }
    for (let k = 0; k < 30; k++) { const x = fl(ih(k, 1, 211) * 108); pine(x, topOf(x, 3) + 1, fl(6 + ih(k, 2, 211) * 10), 3, false); }
    for (let k = 0; k < 26; k++) { const x = fl(lerp(165, 270, ih(k, 1, 221))); pine(x, topOf(x, 4) + 1, fl(6 + ih(k, 2, 221) * 10), 4, false); }

    /* ---------- the falls. Indices run down the water along an accelerating clock, so a turn of the
       palette pours highlights downward, slow at the lip and stretched long near the pool. */
    function fallPhase(x, y, top) {
      const yy = Math.max(0, y - top);
      const sid = fl(x * 0.6 + 1.2 * vn1(x * 0.25, 303));
      return 40 * Math.log(1 + yy / 66.7) + 8 * ih(sid, 5, 304) + 1.5 * vn1(yy * 0.07 + sid * 3.1, 301);
    }
    function fallW(y) { const k = (y - FTOP) / (FBOT - FTOP); return 10.5 + 7 * k + 1.6 * (vn1(y * 0.3, 305) - 0.5); }
    for (let y = FTOP - 2; y < FBOT + 4; y++) {
      const hw = fallW(y), cx = FX + 1.5 * Math.sin((y - FTOP) * 0.03);
      for (let x = fl(cx - hw - 1); x <= Math.ceil(cx + hw + 1); x++) {
        const u = (x - cx) / hw;
        if (Math.abs(u) > 1) continue;
        if (y < mainTop(x) - 1) continue;
        // ragged edges: sparse droplets at the margins
        if (Math.abs(u) > 0.9 && ih(x, y, 307) < 0.55) continue;
        const lit = 0.5 + 0.32 * u - 0.5 * Math.pow(Math.abs(u), 5) + 0.3 * (vn1(x * 0.55, 309) - 0.5) + 0.3 * (ih(fl(x * 0.6 + 1.2 * vn1(x * 0.25, 303)), 6, 304) - 0.5) + 0.15 * sstep(FTOP + 6, FTOP, y);
        const tb = lit + (bay(x, y) - 0.5) * 0.45 > 0.5;
        const p = fallPhase(x, y, FTOP);
        IDX[y * W + x] = cyc(tb ? FB : FA, p, x, y);
        MASK[y * W + x] = 2;
        if (y - mainTop(x) < 2.5 && Math.abs(u) < 0.95 && bay(x, y) < 0.7) IDX[y * W + x] = LIP;
      }
    }
    // a thin ribbon fall from the shoulder of the tower, and side falls from the ledges
    function ribbon(x0, top, bot, w, dx, layer) {
      for (let y = top; y < bot; y++) {
        const cx = x0 + dx * (y - top) / (bot - top) + 0.8 * Math.sin((y - top) * 0.09);
        for (let x = fl(cx - w); x <= Math.ceil(cx + w); x++) {
          const u = (x - cx) / w;
          if (Math.abs(u) > 1) continue;
          if (Math.abs(u) > 0.75 && ih(x, y, 311) < 0.5) continue;
          const tb = 0.45 + 0.4 * u + (bay(x, y) - 0.5) * 0.5 > 0.62;
          IDX[y * W + x] = cyc(tb ? FB : FA, fallPhase(x, y, top) * 1.05 + 3, x, y);
          if (y - top < 2) IDX[y * W + x] = LIP;
          if (layer) MASK[y * W + x] = layer;
        }
      }
    }
    ribbon(176, fl(mainTop(176)) + 1, 224, 1.8, -2, 2);
    ribbon(70, fl(leftTop(70)) + 1, 238, 2.6, 3, 3);
    ribbon(216, fl(rightTop(216)) + 1, 196, 2.3, -1, 4);
    ribbon(208, 199, 238, 3.2, 1, 4);
    // the outcrop the right cascade breaks on
    for (let y = 192; y < 206; y++) for (let x = 198; x < 226; x++) {
      const ex = (x - 212) / 13, ey = (y - 197) / (y < 197 ? 4 : 8);
      if (ex * ex + ey * ey > 1 + 0.3 * (vn1(x * 0.4, 333) - 0.5)) continue;
      const lit = ex * 0.5 - ey * 0.9 + (vn2(x * 0.3, y * 0.3, 335) - 0.5) * 0.6;
      if (own(x, y) === 4 && IDX[y * W + x] >= FA.lo && IDX[y * W + x] < FB.lo + FB.n && y > 198) continue;
      put(x, y, lit + bay(x, y) * 0.4 > 0.75 ? CL + 4 : lit > 0.2 ? CL + 3 : lit > -0.4 ? CL + 1 : CL);
    }

    /* ---------- ground: banks under the cliffs, running forward to the viewer */
    const bankTop = (x) => 247 + 40 * sstep(84, 0, x) + 34 * sstep(196, 270, x) + 3 * (fbm1(x * 0.09, 341) - 0.5);
    for (let x = 0; x < W; x++) for (let y = fl(bankTop(x)); y < H; y++) {
      const i = y * W + x, d = y - bankTop(x);
      const g = fbm2(x * 0.07, y * 0.16, 343, 3);
      let v = 1.0 + (g - 0.5) * 1.8 - d * 0.014;
      if (d < 1.5) v = 2.4; else if (d < 3) v += 0.5;
      IDX[i] = v + bay(x, y) > 1.6 ? CL + 1 : (v + bay(x, y) > 0.9 ? CL : FG + 1);
      // grass: short vertical blades, mossy where the ground is high
      const gb = ih(x, fl(y / 3), 345);
      if (gb < 0.22 && d > 2) IDX[i] = g > 0.5 ? LEAF + 1 : LEAF;
      else if (gb > 0.97 && d > 2) IDX[i] = LEAF + 2;
      MASK[i] = 6;
    }

    /* ---------- plunge pool: rings laid out radially, so a turn spreads them outward */
    for (let y = PY - PRY - 4; y < PY + PRY + 8; y++) for (let x = PX - PRX - 6; x < PX + PRX + 6; x++) {
      const ex = (x - PX) / PRX, ey = (y - PY) / PRY;
      const e = ex * ex + ey * ey;
      const edge = 1 + 0.1 * (vn1(x * 0.2, 401) - 0.5);
      if (e > edge || y < FBOT - 3 + 4 * vn1(x * 0.1, 403) * sstep(20, 60, Math.abs(x - FX))) continue;
      const r = Math.hypot(x - FX, (y - (FBOT + 1)) * 3.4);
      const p = r * 0.6 + 2.4 * vn2(x * 0.09, y * 0.3, 405) + 1.2 * vn2(x * 0.3, y * 0.8, 407);
      IDX[y * W + x] = cyc(POOL, p, x, y);
      MASK[y * W + x] = 5;
    }

    /* ---------- river: indices run along its course, broken across it into short dashes of light */
    for (let y = PY; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (MASK[i] === 5) continue;
      const q = riverAt(x, y);
      const wob = 2.5 * (fbm1(y * 0.06 + x * 0.01, 501) - 0.5) * (0.5 + q.a.w / 25);
      if (q.d > q.a.w + wob) continue;
      const lat = q.d / (q.a.w + 1);
      const sc = 1 + (y - PY) / 45;
      const p = 45 * Math.log(1 + (y - PY + 4) / 30) + 7 * fbm2(x * 0.2 / sc, y * 0.7 / sc, 503, 3) + 2 * vn2(x * 0.05, y * 0.1, 504);
      const mx = MX - 3 + 5 * (vn1(y * 0.18, 505) - 0.5) * sc * 0.6;
      const mw = 1.5 + (y - PY) * 0.12;
      let glint = 1.0 - Math.abs(x - mx) / mw;
      glint = Math.max(glint, 0.62 * Math.exp(-(((x - FX) / 14) ** 2)) * sstep(PY + 30, PY, y));
      glint += (ih(x >> 1, y, 507) - 0.5) * 0.5 - 0.25 * sstep(0.75, 1, lat);
      const tb = glint + (bay(x, y) - 0.5) * 0.5 > 0.5;
      IDX[i] = cyc(tb ? RVB : RVA, p, x, y);
      if (lat > 0.93 && own(x, y - 1) === 6 && bay(x, y) < 0.7) IDX[i] = RVA; // the bank's shadow on the water
      MASK[i] = 5;
    }
    // moonlit lips where the far bank meets the water
    for (let y = PY; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (MASK[i] === 6 && MASK[i + W] === 5) IDX[i] = bay(x, y) < 0.55 ? CL + 3 : CL + 2;
    }
    // reeds and grass along the water
    for (let k = 0; k < 420; k++) {
      const x = fl(ih(k, 1, 351) * W), y = fl(lerp(250, H, ih(k, 2, 351)));
      if (own(x, y) !== 6) continue;
      let wet = false;
      for (let d = 1; d < 7; d++) if (own(x, y + d) === 5 || own(x + d, y) === 5 || own(x - d, y) === 5) { wet = true; break; }
      if (!wet && ih(k, 3, 351) < 0.75) continue;
      const h = 2 + fl(ih(k, 4, 351) * (3 + (y - 250) / 14));
      const lean = ih(k, 5, 351) < 0.5 ? -1 : 1;
      for (let j = 0; j < h; j++) {
        const xx = x + (j > h * 0.6 ? lean : 0);
        put(xx, y - j, j === h - 1 && ih(k, 6, 351) < 0.6 ? CL + 2 : (j > h / 2 ? CL : FG + 1));
      }
    }
    // shrubs on the banks, lit on their moon side
    function shrub(bx, by, r, dark) {
      for (let y = by - r * 1.6; y <= by; y++) for (let x = bx - r * 1.5; x <= bx + r * 1.5; x++) {
        const xx = Math.round(x), yy = Math.round(y);
        const ex = (xx - bx) / (r * 1.4), ey = (yy - by) / (r * 1.5);
        const n = fbm2(xx * 0.35, yy * 0.35, 361 + bx, 2);
        if (ex * ex + ey * ey > 0.75 + 0.6 * (n - 0.5)) continue;
        const lit = ex * 0.7 - ey * 0.5 - 0.35 + (n - 0.5) * 0.9;
        let c = dark ? FG : LEAF;
        if (lit + bay(xx, yy) * 0.4 > 0.4) c = dark ? CL + 1 : LEAF + 1;
        if (lit + bay(xx, yy) * 0.3 > 0.75) c = dark ? CL + 2 : LEAF + 2;
        put(xx, yy, c);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) MASK[yy * W + xx] = 6;
      }
    }
    for (const [bx, by, r] of [[52, 262, 4], [64, 257, 3], [40, 272, 5], [200, 262, 4], [214, 268, 5], [230, 278, 5], [178, 296, 4], [72, 306, 6], [244, 300, 7]])
      shrub(bx, by, r, false);
    // stones at the pool edge and in the stream, lit on their upper right
    for (const [bx, by, rx, ry] of [[88, 249, 7, 4], [99, 252, 4, 3], [186, 250, 6, 4], [176, 253, 3, 2], [122, 270, 3, 2], [150, 300, 4, 2], [236, 318, 9, 5], [60, 306, 7, 4]]) {
      for (let y = by - ry; y <= by + ry; y++) for (let x = bx - rx; x <= bx + rx; x++) {
        const ex = (x - bx) / rx, ey = (y - by) / ry, e = ex * ex + ey * ey;
        if (e > 1 || y > by + 1) continue;
        const lit = ex * 0.6 - ey * 0.9;
        IDX[y * W + x] = lit + bay(x, y) * 0.5 > 0.75 ? CL + 3 : (lit > 0.05 ? CL + 1 : FG + 1);
        MASK[y * W + x] = 6;
      }
      for (let x = bx - rx; x <= bx + rx; x++) if (own(x, by + 2) === 5 && bay(x, by + 2) < 0.5) put(x, by + 2, RVB + 4); // foam line
    }

    /* ---------- mist: veils rising off the plunge pool. Indices climb as y falls, painted over
       whatever is behind with a dithered density, so the slowest cycle lifts it. */
    for (let y = 120; y < 260; y++) for (let x = 30; x < 246; x++) {
      const up = FBOT + 2 - y;
      const col = Math.exp(-(((x - FX) / (16 + Math.max(0, up) * 0.32)) ** 2)) * sstep(-6, 8, up) * (1 - sstep(40, 110, up));
      const veil = Math.exp(-(((x - FX) / 72) ** 2) - ((y - (FBOT + 1)) / 7) ** 2);
      const side = 0.7 * Math.exp(-(((x - 72) / 12) ** 2) - ((y - 238) / 8) ** 2) + 0.7 * Math.exp(-(((x - 210) / 12) ** 2) - ((y - 238) / 8) ** 2);
      const wx = 9 * (vn2(x * 0.02, y * 0.04, 711) - 0.5), wy = 7 * (vn2(x * 0.03, y * 0.02, 713) - 0.5);
      const f = fbm2((x + wx) * 0.07, (y + wy) * 0.045, 701, 4);
      let dens = (col * 0.85 + veil * 1.15 + side) * (0.2 + 1.6 * sstep(0.3, 0.8, f));
      if (dens + (bay(x, y) - 0.5) * 0.55 < 0.5) continue;
      if (own(x, y) === 6 || own(x, y) === 7) continue;
      const p = -y * 0.075 + 7 * fbm2(x * 0.03, y * 0.05, 709, 3) + 0.02 * x;
      IDX[y * W + x] = cyc(MIST, p, x, y);
    }

    /* ---------- foreground: dark rocks and pines that frame the river */
    function fgMass(fn, x0, x1) {
      for (let x = x0; x < x1; x++) {
        const t = fl(fn(x));
        for (let y = Math.max(0, t); y < H; y++) {
          const i = y * W + x, d = y - t;
          let c = FG;
          if (d < 1) c = CL + 2; else if (d < 3) c = bay(x, y) < 0.5 ? CL + 1 : CL; else if (d < 6 && bay(x, y) < 0.3) c = CL;
          IDX[i] = c;
          MASK[i] = 7;
        }
      }
    }
    fgMass((x) => 296 + 26 * Math.pow(x / 72, 1.7) + 5 * (fbm1(x * 0.12, 811) - 0.5) + (x > 72 ? 99 : 0), 0, 80);
    fgMass((x) => 314 - 26 * sstep(240, 270, x) + 4 * (fbm1(x * 0.12, 813) - 0.5) + Math.max(0, 250 - x) * 2.2, 226, W);
    for (const [x, y, h] of [[6, 298, 70], [19, 301, 46], [32, 310, 30], [-4, 296, 90], [264, 300, 62], [252, 306, 38], [274, 290, 84]]) pine(x, y, h, 7, true);

    /* ---------- fireflies: short drifting paths of 8 pixels, one index each, so a single lit entry
       travels the path, fades and is born again at its start */
    for (let k = 0; k < 26; k++) {
      let x = lerp(14, 256, ih(k, 1, 901)), y = lerp(262, 326, ih(k, 2, 901));
      const c = own(fl(x), fl(y));
      if (c === 5) continue;
      let a = ih(k, 3, 901) * 6.283;
      const o = fl(ih(k, 4, 901) * 8);
      for (let j = 0; j < 8; j++) {
        put(fl(x), fl(y), FLY.lo + ((j + o) % 8));
        a += (ih(k, 10 + j, 901) - 0.5) * 1.4;
        x += Math.cos(a) * 1.15; y += Math.sin(a) * 0.8 - 0.25;
      }
    }
  }

  /* ================================================================ the palette, per frame */
  const LIVE = new Uint32Array(256);
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
  const pack = (r, g, b) => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
  function paletteAt(t) {
    for (let i = 0; i < NPAL; i++) LIVE[i] = pack(PAL[i][0], PAL[i][1], PAL[i][2]);
    const u = t / D;
    for (const r of R) {
      const o = u * r.k * r.n + 1e-7;
      const s = fl(o), f = r.blend ? o - s : 0;
      for (let j = 0; j < r.n; j++) {
        const a = r.base[(((j - s) % r.n) + r.n) % r.n];
        if (!f) { LIVE[r.lo + j] = pack(a[0], a[1], a[2]); continue; }
        const b = r.base[(((j - s - 1) % r.n) + r.n) % r.n];
        LIVE[r.lo + j] = pack(Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f)));
      }
    }
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    t = ((t % D) + D) % D;
    paletteAt(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    }
    for (let i = 0; i < NP; i++) PIX[i] = LIVE[IDX[i]];
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#05060f'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'the-falls',
    title: 'The Falls',
    medium: 'Palette cycling in 96 colours, 270 × 338 · 16 s loop',
    note: 'Nothing here is redrawn · tap to pause',
    about: 'A moonlit gorge painted exactly once, as a grid of palette numbers, and never touched again. Every bit of motion, the water pouring, rings spreading on the pool, mist lifting, the aurora sliding and the stars breathing, comes from turning small runs of the palette, the trick 1990s game artists used to make still pictures live.',
    tone: 'dark',
    room: '#05060f',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = 7; // the scene is composed for one seed; it is painted once and never changes
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#05060f';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4, OX = 0, OY = 0;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1080 * dpr); CH = Math.round(1350 * dpr);
          OX = 0; OY = 0;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H);
          K = Math.max(1, Math.floor(fit));
          CW = W * K; CH = H * K; OX = 0; OY = 0;
          cssW = CW / dpr; cssH = CH / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => drawFrame(t, g, CW, CH, K, OX, OY);
      layout();
      paint();
      built = true;
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__thefalls = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thefalls.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-falls';
        api.ready();
      } else {
        window.__thefalls = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__thefalls) delete window.__thefalls;
        },
      };
    },
  });
})();
