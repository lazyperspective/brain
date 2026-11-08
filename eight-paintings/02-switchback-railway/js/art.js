/* Switchback Railway — a hand-pixelled autumn mountain railway at first evening light.
 * Native 432 x 540, indexed palette, every pixel placed by deterministic rules
 * (seeded PRNG + hashed value noise; no Math.random, no Date).
 * window.ART.render(seed) -> { W, H, buf (palette indices), pal (rgb), toRGBA(), stats() }
 */
(function () {
  'use strict';
  const W = 432, H = 540;

  /* ------------------------------------------------------------ palette (42) */
  const PAL = [
    ['K0', '#0c0a17'], ['K1', '#17152b'],
    ['B1', '#1f2441'], ['B2', '#2b3558'], ['B3', '#3c4972'], ['B4', '#50608b'], ['B5', '#6b7da4'],
    ['B6', '#8d9ebe'], ['B7', '#b4c1d7'], ['B8', '#d8e0ec'], ['W', '#f6f2e6'],
    ['L1', '#57598b'], ['L2', '#7b709d'], ['L3', '#a6819e'], ['L4', '#cf8f97'], ['L5', '#eba68b'], ['L6', '#f8c68a'],
    ['G0', '#ffe8a6'], ['G1', '#ffcf68'], ['G2', '#f2a43f'], ['G3', '#d9792a'], ['G4', '#b3521f'],
    ['G5', '#84361c'], ['G6', '#58231b'], ['G7', '#36171b'],
    ['E0', '#0f1d1c'], ['E1', '#17302a'], ['E2', '#234536'], ['E3', '#395d40'], ['E4', '#5f7944'], ['E5', '#94953f'],
    ['T0', '#2b2433'], ['T1', '#463a46'], ['T2', '#635253'], ['T3', '#867065'], ['T4', '#aa8f79'], ['T5', '#cdb293'], ['T6', '#ebd6b3'],
    ['R1', '#a8342a'], ['R2', '#d8593a'], ['V1', '#3f2f4f'], ['V2', '#6a5276'],
  ];
  const C = {};
  PAL.forEach((p, i) => { C[p[0]] = i; });
  const RGB = PAL.map((p) => [parseInt(p[1].slice(1, 3), 16), parseInt(p[1].slice(3, 5), 16), parseInt(p[1].slice(5, 7), 16)]);
  const NP = PAL.length;

  /* ------------------------------------------------------------- utilities */
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, o = 4) {
    let t = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i * 31); n += a; a *= 0.5; f *= 2.03; }
    return t / n;
  }
  // piecewise-linear through [[k, v], ...] sorted by k
  function pwl(pts) {
    return function (k) {
      if (k <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) {
        if (k <= pts[i][0]) {
          const a = pts[i - 1], b = pts[i];
          return a[1] + (b[1] - a[1]) * (k - a[0]) / (b[0] - a[0]);
        }
      }
      return pts[pts.length - 1][1];
    };
  }
  const BAY2 = [0.125, 0.625, 0.875, 0.375];
  const bay2 = (x, y) => BAY2[((y & 1) << 1) | (x & 1)];
  const BAY4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay4 = (x, y) => (BAY4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  // banded ordered dither: integer level from continuous f; dither only inside a band of width dw
  function dq(f, x, y, dw) {
    const i = Math.floor(f), fr = f - i;
    if (!dw) return fr < 0.5 ? i : i + 1;
    const lo = 0.5 - dw / 2, hi = 0.5 + dw / 2;
    if (fr < lo) return i;
    if (fr >= hi) return i + 1;
    return (fr - lo) / (hi - lo) > bay2(x, y) ? i + 1 : i;
  }
  function rampAt(ramp, v, x, y, dw) {
    const i = dq(clamp(v) * (ramp.length - 1), x, y, dw || 0);
    return ramp[Math.max(0, Math.min(ramp.length - 1, i))];
  }

  // nearest palette colour of a mix (keeps every derived tone inside the palette)
  const mixCache = new Map();
  function nearest(r, g, b, exclude) {
    let best = 0, bd = 1e18;
    for (let i = 0; i < NP; i++) {
      if (exclude && exclude[i]) continue;
      const c = RGB[i];
      const dr = c[0] - r, dg = c[1] - g, db = c[2] - b;
      const rm = (c[0] + r) / 2;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  const NOACCENT = new Uint8Array(NP); NOACCENT[C.R1] = 1; NOACCENT[C.R2] = 1;
  function mix(i, target, t) {
    if (t <= 0) return i;
    const tq = Math.round(t * 8) / 8;
    const key = i * 100000 + target * 100 + tq * 16;
    let v = mixCache.get(key);
    if (v === undefined) {
      const a = RGB[i], b = RGB[target];
      v = nearest(lerp(a[0], b[0], tq), lerp(a[1], b[1], tq), lerp(a[2], b[2], tq), NOACCENT);
      mixCache.set(key, v);
    }
    return v;
  }

  /* ------------------------------------------------------------ the canvas */
  let buf, flag, R;
  const F_NONE = 0, F_ORG = 1, F_PROT = 2;
  let curF = F_NONE;
  function P(x, y, c, f) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    buf[k] = c; flag[k] = f === undefined ? curF : f;
  }
  const G = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : buf[y * W + x]);
  function rect(x, y, w, h, c, f) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c, f); }
  function hl(x0, x1, y, c, f) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) P(x, y, c, f); }
  function vl(x, y0, y1, c, f) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) P(x, y, c, f); }
  function line(x0, y0, x1, y1, c, f) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      P(x0, y0, c, f);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // char sprite: rows of chars, map char -> palette index ('.' transparent)
  function spr(x, y, rows, map, f) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.' || ch === ' ') continue;
        const c = map[ch];
        if (c === undefined) continue;
        P(x + i, y + j, c, f);
      }
    }
  }
  function sprFlip(x, y, rows, map, f) { spr(x, y, rows.map((r) => r.split('').reverse().join('')), map, f); }
  // mist / haze overlay on existing pixels
  function veil(x, y, target, t, steps, dw) {
    if (x < 0 || y < 0 || x >= W || y >= H || t <= 0) return;
    const lv = dq(clamp(t) * steps, x, y, dw === undefined ? 0.5 : dw);
    if (lv <= 0) return;
    const k = y * W + x;
    if (flag[k] === F_PROT) return;
    buf[k] = mix(buf[k], target, lv / steps);
  }

  /* ---------------------------------------------------------- scene layout */
  const DECK = 330;            // rail level on the viaduct
  const VX0 = 118, VX1 = 334;  // viaduct abutment faces
  const J = [36, 302];         // switchback reversing point
  const BR = { y: 254, x0: 176, x1: 248, cx: 209 }; // stone arch over the falls (upper leg)
  const TUN = [292, 237];      // tunnel portal (upper leg)
  const upperY = (x) => (x <= BR.x0 ? J[1] - (x - J[0]) / 3 : x >= BR.x1 ? BR.y - (x - BR.x1) / 3 : BR.y);
  const lowerY = (x) => DECK - (VX0 - x) / 3; // from viaduct (VX0,DECK) up-left to J
  // gorge rims (x as a function of y)
  const rimL0 = pwl([[244, 186], [262, 178], [290, 160], [314, 138], [332, VX0], [380, 110], [440, 98], [540, 86]]);
  const rimR0 = pwl([[238, 250], [262, 270], [300, 302], [332, VX1], [380, 342], [460, 352], [540, 360]]);
  const rimL = (y) => rimL0(y) + (fbm(y * 0.09, 1, 61, 3) - 0.5) * 7;
  const rimR = (y) => rimR0(y) + (fbm(y * 0.09, 2, 63, 3) - 0.5) * 7;
  const bwL = pwl([[256, 187], [330, 182], [480, 168], [540, 160]]);
  const bwR = pwl([[256, 247], [330, 254], [480, 272], [540, 280]]);
  const skyLb = pwl([[0, 166], [22, 163], [40, 170], [64, 178], [92, 190], [120, 204], [148, 219], [170, 233], [186, 244]]);
  const skyRb = pwl([[250, 238], [262, 226], [280, 212], [302, 198], [330, 186], [362, 177], [396, 168], [432, 160]]);
  const crag = (x, s) => {
    let n = (fbm(x * 0.07, 5, s, 3) - 0.5) * 9;
    // a few blocky rock knobs on the crest
    const k = Math.sin(x * 0.11 + s) * Math.sin(x * 0.043 + s * 0.3);
    if (k > 0.55) n -= (k - 0.55) * 14;
    return n;
  };
  const skyL = (x) => Math.round(skyLb(x) + (x < 176 ? crag(x, 17) : 0));
  const skyR = (x) => Math.round(skyRb(x) + (x > 262 ? crag(x, 29) : 0));
  const SUN = [-30, 172];

  /* ------------------------------------------------------------------ sky */
  const SKY = [C.G0, C.L6, C.L5, C.L4, C.L3, C.L2, C.L1, C.B3, C.B2];
  function skyU(x, y) {
    let u = 0.92 * (SUN[1] - y) / 185 + 0.34 * clamp(Math.abs(x - SUN[0]) / 470);
    u -= 0.2 * Math.exp(-(((x - SUN[0]) / 150) ** 2 + ((y - SUN[1]) / 70) ** 2));
    return clamp(u + 0.06);
  }
  function sky() {
    curF = F_NONE;
    for (let y = 0; y < 260; y++) for (let x = 0; x < W; x++) P(x, y, rampAt(SKY, skyU(x, y), x, y, 0.42));
    // cirrus streaks, lit from beneath by the low sun
    const banks = [
      { cx: 150, cy: 24, w: 230, n: 7, sp: 3 }, { cx: 330, cy: 58, w: 150, n: 5, sp: 3 },
      { cx: 95, cy: 92, w: 150, n: 5, sp: 2 }, { cx: 260, cy: 112, w: 120, n: 4, sp: 2 },
      { cx: 400, cy: 126, w: 90, n: 3, sp: 2 }, { cx: 30, cy: 132, w: 70, n: 3, sp: 2 },
    ];
    banks.forEach((b, bi) => {
      for (let r = 0; r < b.n; r++) {
        const fr = (r + 0.5) / b.n;
        const prof = Math.sqrt(1 - (2 * fr - 1) ** 2);
        const segs = 1 + ((hash2(bi, r, 7) * 3) | 0);
        for (let s = 0; s < segs; s++) {
          const len = b.w * prof * (0.35 + 0.55 * hash2(bi, r * 7 + s, 9)) / Math.sqrt(segs);
          const x0 = b.cx - b.w * 0.5 * prof + (b.w * prof - len) * hash2(bi, r * 13 + s, 3) + (r - b.n / 2) * 6;
          const y = b.cy + r * b.sp - (s % 2);
          for (let x = Math.round(x0); x < x0 + len; x++) {
            const e = Math.min(x - x0, x0 + len - x);
            const lift = (e > 10 ? 2 : e > 3 ? 1 : (x & 1) ? 1 : 0) + (r >= b.n - 2 ? 1 : 0);
            const u = skyU(x, y);
            const k = Math.max(0, Math.round(u * (SKY.length - 1)) - lift);
            P(x, y, SKY[k]);
          }
        }
      }
    });
    // waxing crescent near the sunset, and the evening star
    curF = F_PROT;
    const mx = 74, my = 44;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const d1 = x * x + y * y, d2 = (x - 2.6) ** 2 + (y + 2.2) ** 2;
      if (d1 <= 30 && d2 > 28) P(mx + x, my + y, d1 > 20 ? C.W : C.B8);
    }
    P(122, 70, C.W); P(121, 70, C.B8); P(123, 70, C.B7); P(122, 69, C.B7); P(122, 71, C.B7);
    P(318, 16, C.B7); P(401, 30, C.B6); P(262, 8, C.B6); P(176, 12, C.L3);
    curF = F_NONE;
  }

  /* ------------------------------------------------------- ridge profiles */
  function ridge(pts, amp, sc, seed) {
    const base = pwl(pts), r = new Float32Array(W + 40);
    for (let x = -20; x < W + 20; x++) {
      let n = 0, a = amp, f = 1 / sc;
      for (let o = 0; o < 4; o++) { n += (vnoise(x * f, o * 7.3, seed + o) - 0.5) * a; a *= 0.5; f *= 2.1; }
      r[x + 20] = base(x) + n;
    }
    return (x) => r[clamp(Math.round(x), -20, W + 19) + 20];
  }
  function smoothSlope(rf, x, s) {
    s = Math.max(1, Math.round(s));
    let a = 0, b = 0;
    for (let i = 1; i <= s; i++) { a += rf(x - i); b += rf(x + i); }
    return (b - a) / (s * s);
  }

  /* ----------------------------------------------------- the snow range */
  function snowRange() {
    curF = F_ORG;
    const rf = ridge([[0, 124], [18, 114], [36, 120], [54, 100], [68, 106], [84, 88], [98, 97], [112, 93], [130, 112],
      [148, 104], [162, 118], [180, 108], [198, 96], [214, 82], [228, 90], [246, 70], [262, 58], [276, 51], [290, 61],
      [304, 59], [320, 77], [336, 88], [352, 83], [368, 101], [386, 95], [402, 110], [420, 104], [432, 116]], 7, 9, 101);
    const SH = [C.B2, C.B3, C.B4, C.B5, C.B6];            // shadowed snow
    const LT = [C.L4, C.L5, C.L6, C.G0, C.W];             // alpenglow snow
    // spur ridges fan down from every summit; each face between two spurs is lit on the
    // flank that looks toward the sun (left) and in shadow on the flank that looks away
    const spurs = [];
    let sid = 0;
    const addSpur = (x0, y0, drift, len, depth) => {
      const id = sid++;
      const ph = hash2(id, 1, 251) * 6;
      spurs.push({ x0, y0, drift, len, id, ph, lv: hash2(id, 2, 251), end: y0 + len });
      if (depth < 1 && len > 60 && hash2(id, 14, 251) < 0.5) {
        const at = 0.35 + 0.3 * hash2(id, 3, 251);
        const nd = drift + (hash2(id, 4, 251) < 0.5 ? -1 : 1) * (0.35 + 0.3 * hash2(id, 5, 251));
        addSpur(x0 + drift * len * at, y0 + len * at, nd, len * (0.45 + 0.3 * hash2(id, 6, 251)), depth + 1);
      }
    };
    const spurX = (sp, y) => sp.x0 + sp.drift * (y - sp.y0) + 2.2 * Math.sin((y - sp.y0) * 0.21 + sp.ph) + (vnoise((y - sp.y0) * 0.15, sp.id, 257) - 0.5) * 3;
    for (let x = 2; x < W - 2; x++) {
      const y = rf(x);
      let peak = true;
      for (let k = -12; k <= 12; k++) if (k && rf(x + k) < y) { peak = false; break; }
      if (!peak) continue;
      const big = 150 - y;
      addSpur(x, y, -(0.3 + 0.4 * hash2(x, 7, 251)), 232 - y, 0);
      addSpur(x, y, 0.35 + 0.45 * hash2(x, 8, 251), 232 - y, 0);
      if (big > 40) addSpur(x, y + 2, (hash2(x, 10, 251) - 0.5) * 0.25, 232 - y, 1);
    }
    // extra spurs from shoulders between peaks

    for (let y = 40; y < 230; y++) {
      const row = [];
      for (const sp of spurs) if (y >= sp.y0 && y <= sp.end) row.push([spurX(sp, y), sp]);
      row.sort((p, q) => p[0] - q[0]);
      // where two spurs meet they merge: the lesser one ends in the valley between them
      for (let i = 0; i + 1 < row.length; i++) {
        const a = row[i], b = row[i + 1];
        if (b[0] - a[0] < 1.5 && y > Math.max(a[1].y0, b[1].y0) + 2) {
          const v = a[1].y0 > b[1].y0 ? a : b;
          v[1].end = y; row.splice(row.indexOf(v), 1); i--;
        }
      }
      for (let x = 0; x < W; x++) {
        const top = Math.round(rf(x));
        if (y < top) continue;
        const d = y - top;
        // macro facing from the silhouette, used where no spurs reach
        const g = smoothSlope(rf, x + (fbm(y * 0.06, x * 0.013, 211) - 0.5) * (4 + d * 0.5), 1 + d * 0.55);
        let lit = -g * 1.5 + 0.42 > 0.5, lv = clamp(-g * 1.5 + 0.42);
        let A = null, B = null;
        for (const e of row) { if (e[0] <= x) A = e; else { B = e; break; } }
        let edgeL = false, edgeR = false;
        if (A && B && B[0] - A[0] < 70) {
          const t = (x - A[0]) / (B[0] - A[0]);
          const gf = 0.3 + 0.4 * hash2(A[1].id, B[1].id, 253);
          if (t < gf) { lit = false; lv = 0.15 + 0.6 * A[1].lv; edgeR = x - A[0] < 1.2; }
          else { lit = true; lv = 0.25 + 0.75 * B[1].lv; edgeL = B[0] - x < 1.2; }
        } else if (A && x - A[0] < 30) { lit = false; lv = 0.2 + 0.5 * A[1].lv; }
        else if (B && B[0] - x < 30) { lit = true; lv = 0.3 + 0.6 * B[1].lv; }
        lv -= d * 0.004;
        // exposed rock: ribs along spur crests, and gullies of scree in the lower faces
        const gully = fbm(x * 0.12, y * 0.03, 223, 3);
        const rock = edgeL || edgeR || gully > 0.66 - d * 0.0035;
        let c;
        if (rock) c = lit ? (lv > 0.55 ? C.L4 : C.L3) : (lv > 0.5 ? C.L1 : C.B2);
        else if (lit && x < 64 && d > 1) c = [C.L2, C.L3, C.L4][clamp(Math.round(lv * 2 + x / 40), 0, 2)];   // backlit near the sun
        else if (lit) c = LT[clamp(Math.round(lv * 4.2 + (d < 2 ? 0.8 : 0)), 0, 4)];
        else c = SH[clamp(Math.round(lv * 4.2 + (d < 1 ? 0.8 : 0)), 0, 4)];
        if (d === 0) c = lit || -g > 0 ? (x > 150 ? C.G0 : C.L6) : C.B5;
        P(x, y, c);
        const hz = clamp((y - 168) / 60) * 0.85;
        veil(x, y, x < 160 ? C.L4 : C.L3, hz, 4, 0.6);
      }
    }
  }

  /* ------------------------------------------------- distant forested ranges */
  function treeColors(sp, lit) {
    // [dark, shade, mid, light, highlight]
    if (sp === 0) return lit ? [C.E0, C.E1, C.E2, C.E3, C.E4] : [C.K0, C.K1, C.E0, C.B1, C.B2];        // spruce
    if (sp === 1) return lit ? [C.G6, C.G4, C.G3, C.G2, C.G1] : [C.K1, C.V1, C.G7, C.G6, C.V2];         // larch
    if (sp === 2) return lit ? [C.G5, C.G3, C.G2, C.G1, C.G0] : [C.K1, C.V1, C.G7, C.V2, C.L2];         // birch
    if (sp === 3) return lit ? [C.G6, C.R1, C.R2, C.G3, C.G2] : [C.K1, C.G7, C.G6, C.G5, C.G5];         // rowan
    return lit ? [C.E1, C.E3, C.E4, C.E5, C.G2] : [C.K1, C.E1, C.E2, C.E3, C.V2];                        // pine/olive
  }
  // h: height in px; lit: 0..1 (sunlit), hz: haze amount toward hzT
  function tree(x, yb, h, sp, lit, hz, hzT, seed, cols) {
    x = Math.round(x); yb = Math.round(yb);
    const L = lit > 0.5;
    let col = cols ? cols(sp, L) : treeColors(sp, L);
    if (!L && !cols && yb > 372) col = sp === 0 ? [C.K0, C.K0, C.K1, C.B1, C.B2] : [C.K0, C.K1, C.V1, C.G7, C.V1];
    if (hz > 0) col = col.map((c) => mix(c, hzT, hz));
    const rnd = (i) => hash2(x * 7 + i, yb * 13 + i * 3, seed);
    if (sp === 2 || sp === 3) {
      // broadleaf: birch / rowan — clumpy crown, white trunk
      const rx = Math.max(1, h * 0.36), ry = Math.max(1, h * 0.42), cy = yb - h + ry;
      if (h >= 5 && sp === 2) { vl(x, Math.round(cy), yb, hz > 0.4 ? col[3] : L ? C.T6 : C.B3); if (h > 7) P(x, Math.round(cy + ry * 0.7), C.K1); }
      for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) {
        const e = (i / (rx + 0.5)) ** 2 + (j / (ry + 0.5)) ** 2;
        const jag = (hash2(x + i, yb + j, seed + 5) - 0.5) * 0.5;
        if (e > 1 + jag * (h > 4 ? 1 : 0)) continue;
        const sh = -(i / (rx + 0.5)) * 0.7 - (j / (ry + 0.5)) * 0.7 + (hash2(x + i, yb + j, seed + 9) - 0.5) * 0.6;
        let k = sh > 0.55 ? 4 : sh > 0.1 ? 3 : sh > -0.45 ? 2 : 1;
        if (!L && k === 4) k = 3;
        P(x + i, Math.round(cy) + j, col[k]);
      }
      if (sp === 3 && h > 4) for (let b = 0; b < 3; b++) P(x + Math.round((rnd(b) - 0.5) * rx * 1.4), Math.round(cy + (rnd(b + 4) - 0.3) * ry), L ? C.R2 : C.R1);
      return;
    }
    // conifers: spruce (0), larch (1), pine (4)
    const top = yb - h + 1;
    const narrow = sp === 0 ? 0.33 : sp === 1 ? 0.4 : 0.42;
    for (let j = 0; j < h; j++) {
      const y = top + j;
      let half = Math.round(j * narrow + (sp === 1 ? 0.2 : 0));
      if (h >= 6 && sp !== 4) {
        const tier = (j + (x & 1)) % 3;
        if (tier === 0 && j > 1) half = Math.max(0, half - 1);
      }
      if (j === h - 1 && h >= 5) half = Math.max(0, half - 1);
      for (let i = -half; i <= half; i++) {
        if (sp === 1 && Math.abs(i) === half && half > 1 && rnd(j * 9 + i + 50) < 0.35) continue; // airy larch edge
        let k;
        const rel = half ? i / half : 0;
        if (j === 0) k = 3;
        else if (rel < -0.45) k = 3;
        else if (rel < 0.15) k = 2;
        else k = 1;
        if (h >= 6 && (j + (x & 1)) % 3 === 2 && rel > -0.2) k = Math.max(0, k - 1);
        if (L && k === 3 && rel <= -0.99 && j > 1 && (j + (x & 1)) % 3 === 1) k = 4;
        if (sp === 1 && h >= 7 && rnd(j * 17 + i) < 0.12 && Math.abs(rel) < 0.7) k = 0;
        P(x + i, y, col[k]);
      }
    }
    if (h >= 6) P(x, yb + 1, col[0]);
  }

  function pickSpecies(x, y, seed) {
    const n = fbm(x * 0.03, y * 0.045, seed, 3);
    const r = hash2(x | 0, y | 0, seed + 1);
    if (r < 0.03) return 3;
    if (n > 0.57) return r < 0.12 ? 2 : r < 0.86 ? 1 : 0;   // larch stands
    if (n < 0.45) return r < 0.1 ? 1 : 0;                   // dark spruce stands
    return r < 0.1 ? 2 : r < 0.5 ? 1 : 0;
  }

  function forest(o) {
    const list = [];
    for (let y = o.y0; y <= o.y1; y += o.sy) {
      for (let x = o.x0; x <= o.x1; x += o.sx) {
        const jx = x + (hash2(x, y, o.seed) - 0.5) * o.sx * 1.2;
        const jy = y + (hash2(x, y, o.seed + 3) - 0.5) * o.sy * 1.1;
        if (!o.inside(jx, jy)) continue;
        if (o.dens && hash2(x, y, o.seed + 4) > o.dens(jx, jy)) continue;
        list.push([jx, jy]);
      }
    }
    list.sort((a, b) => a[1] - b[1]);
    curF = F_ORG;
    for (const [x, y] of list) {
      const sp = o.species ? o.species(x, y) : pickSpecies(x, y, o.seed + 11, o.mixB);
      const h = Math.max(2, Math.round(o.h(x, y) * (0.75 + 0.5 * hash2(Math.round(x), Math.round(y), o.seed + 7))));
      const lit = o.lit(x, y - h * 0.5);
      tree(x, y, h, sp, lit, o.hz ? o.hz(x, y) : 0, o.hzT || C.B5, o.seed, o.cols);
    }
  }

  function midRanges() {
    // far blue range
    curF = F_ORG;
    const r1 = ridge([[0, 178], [30, 170], [62, 174], [86, 158], [112, 165], [140, 150], [168, 158], [192, 147], [216, 160],
      [242, 152], [270, 166], [300, 157], [330, 170], [362, 161], [400, 176], [432, 170]], 6, 8, 301);
    const M1 = [C.B3, C.B4, C.L1, C.L2, C.L3, C.L4];
    for (let x = 0; x < W; x++) {
      const top = Math.round(r1(x));
      for (let y = top; y < 250; y++) {
        const d = y - top;
        const g = smoothSlope(r1, x + (fbm(y * 0.08, x * 0.02, 311) - 0.5) * d * 0.4, 1 + d * 0.6);
        const light = clamp(-g * 1.3 + 0.4);
        // haze follows the contours: deeper below each crest = paler
        const v = light * 0.62 + clamp(d / 34) * 0.32 + (d === 0 ? 0.25 : 0);
        P(x, y, M1[clamp(Math.round(v * 5), 0, 5)]);
      }
    }
    // valley mist between the snow range and the far range: a lit crest, a soft body
    for (let x = 0; x < W; x++) {
      const mt = Math.round(192 + 5 * Math.sin(x * 0.023 + 0.7) + 7 * (fbm(x * 0.03, 1, 33) - 0.5));
      for (let y = mt - 3; y < mt; y++) if (bay2(x, y) < (y === mt - 1 ? 0.62 : y === mt - 2 ? 0.37 : 0.13)) P(x, y, C.L3);
      for (let y = mt; y < 262; y++) P(x, y, y === mt ? (x < 200 ? C.L5 : C.L4) : y < mt + 3 ? C.L4 : C.L3);
    }
    // nearer range behind the gorge head, forested, catching low light
    const r2 = ridge([[90, 214], [118, 204], [146, 196], [172, 187], [196, 194], [220, 184], [242, 190], [268, 181],
      [296, 192], [324, 188], [350, 196]], 5, 7, 333);
    const M2 = [C.B2, C.B2, C.B3, C.L1, C.L2, C.L3];
    curF = F_ORG;
    for (let x = 90; x < 352; x++) {
      const top = Math.round(r2(x));
      for (let y = top; y < 262; y++) {
        const d = y - top;
        const g = smoothSlope(r2, x + (fbm(y * 0.09, x * 0.02, 341) - 0.5) * d * 0.5, 1 + d * 0.7);
        const light = clamp(-g * 1.4 + 0.35);
        P(x, y, rampAt(M2, light * 0.62 + (d === 0 ? 0.45 : d === 1 ? 0.15 : 0), x, y, 0));
      }
    }
    forest({ x0: 90, x1: 352, y0: 186, y1: 262, sx: 3, sy: 3, seed: 451,
      inside: (x, y) => y > r2(x) + 1,
      dens: (x, y) => (fbm(x * 0.05, y * 0.05, 455, 2) > 0.42 ? 0.9 : 0.12) * (y - r2(x) < 16 ? 1 : 0.55),
      h: (x, y) => 3 + (y - 190) / 30,
      species: () => 0,
      lit: (x, y) => (y < 204 ? 1 : 0),
      cols: (sp, L) => (sp === 0 ? (L ? [C.B2, C.B2, C.B3, C.L1, C.L1] : [C.B1, C.B2, C.B2, C.B3, C.B3])
        : (L ? [C.L1, C.L2, C.L3, C.L4, C.L5] : [C.B2, C.L1, C.L1, C.L2, C.L2])) });
    // a soft shelf of mist in the hanging valley above the falls
    for (let x = 100; x < 345; x++) {
      const top = Math.round(242 + 2.5 * Math.sin(x * 0.06 + 1) + 6 * (fbm(x * 0.04, 3, 77) - 0.5));
      for (let y = top - 4; y < top + 10; y++) {
        const t = y < top ? 0.35 * (1 - (top - y) / 4) : 0.42 - (y - top) * 0.03;
        veil(x, y, C.L3, t, 3, 0.8);
      }
    }
  }

  /* ------------------------------------------------------- rock (faceted) */
  // Worley-cell rock: flat facets, lit top-left edges, dark cracks bottom-right
  function rockCell(x, y, cw, ch, seed) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch);
    let best = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = (gx + i + hash2(gx + i, gy + j, seed)) * cw;
      const cy = (gy + j + hash2(gx + i, gy + j, seed + 1)) * ch;
      const d = Math.abs((x - cx) / cw) + Math.abs((y - cy) / ch) * 0.8 + Math.max(Math.abs((x - cx) / cw), Math.abs((y - cy) / ch)) * 0.6;
      if (d < best) { best = d; id = (gx + i) * 7919 + (gy + j) * 104729; }
    }
    return id;
  }
  function rockFill(inside, x0, x1, y0, y1, rampFn, cw, ch, seed) {
    curF = F_ORG;
    const ids = new Int32Array((x1 - x0 + 3) * (y1 - y0 + 3));
    const ww = x1 - x0 + 3;
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++)
      ids[(y - y0 + 1) * ww + (x - x0 + 1)] = rockCell(x + (vnoise(x * 0.1, y * 0.1, seed + 9) - 0.5) * 3, y, cw, ch, seed);
    const id = (x, y) => ids[(y - y0 + 1) * ww + (x - x0 + 1)];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const me = id(x, y);
      const tone = hash2(me, 3, seed);
      let e = 0;
      if (id(x, y - 1) !== me || id(x - 1, y) !== me) e = 1;
      if (id(x, y + 1) !== me || id(x + 1, y) !== me) e = -1;
      const ramp = rampFn(x, y);
      let k = 1 + (tone > 0.66 ? 1 : tone < 0.25 ? -1 : 0) + e + Math.round((fbm(x * 0.035, y * 0.025, seed + 21, 3) - 0.5) * 2.6);
      if (e === -1 && id(x + 1, y + 1) !== me && id(x, y + 1) !== me) k = 0;
      P(x, y, ramp[clamp(k, 0, ramp.length - 1)]);
    }
  }

  /* ----------------------------------------------------- gorge & waterfall */
  const RK_SH = [C.K1, C.B1, C.B2, C.B3, C.B4];          // rock in blue shadow
  const RK_DEEP = [C.K0, C.K1, C.B1, C.B2, C.B3];
  const RK_LIT = [C.G7, C.T2, C.T3, C.T4, C.T5];         // rock in warm light
  const RK_GOLD = [C.G6, C.G5, C.T4, C.L6, C.G0];
  const rightWallLit = (x, y) => y < 292 + (x - 250) * 0.62 + (fbm(x * 0.1, y * 0.05, 91) - 0.5) * 8;

  function gorge() {
    // back wall (gorge head), in shadow below its lit lip
    rockFill((x, y) => x >= bwL(y) - 1 && x <= bwR(y) + 1 && y >= 257, 160, 290, 257, 539,
      (x, y) => (y < 272 && x > 222 ? RK_LIT : y > 420 ? RK_DEEP : RK_SH), 5, 6, 501);
    // left inner wall: faces right, away from the sun
    rockFill((x, y) => y >= 244 && x > rimL(y) && x < bwL(y) + 1, 80, 200, 244, 539,
      (x, y) => (y > 400 ? RK_DEEP : RK_SH), 4, 8, 511);
    // right inner wall: faces the sun; lit until the left rim's cast shadow
    rockFill((x, y) => y >= 238 && x < rimR(y) && x > bwR(y) - 1, 240, 362, 238, 539,
      (x, y) => (rightWallLit(x, y) ? (y < 292 + (x - 250) * 0.62 - 12 ? RK_GOLD : RK_LIT) : y > 420 ? RK_DEEP : RK_SH), 4, 7, 521);
    // ledges with clinging trees
    forest({ x0: 160, x1: 290, y0: 270, y1: 470, sx: 6, sy: 7, seed: 531,
      inside: (x, y) => x > bwL(y) + 2 && x < bwR(y) - 2 && Math.abs(x - 209) > 12 + (y - 270) * 0.05,
      dens: (x, y) => 0.45, h: (x, y) => 4 + (y - 270) / 60, species: (x, y) => (hash2(x | 0, y | 0, 5) < 0.6 ? 0 : 1),
      lit: (x, y) => (y < 275 && x > 222 ? 1 : 0) });
    forest({ x0: 86, x1: 200, y0: 250, y1: 520, sx: 5, sy: 6, seed: 541,
      inside: (x, y) => x > rimL(y) + 2 && x < bwL(y) - 1,
      dens: (x, y) => 0.5, h: (x, y) => 5 + (y - 250) / 40,
      species: (x, y) => (hash2(x | 0, y | 0, 6) < 0.55 ? 0 : hash2(x | 0, y | 0, 8) < 0.5 ? 1 : 2), lit: () => 0 });
    forest({ x0: 240, x1: 362, y0: 245, y1: 520, sx: 5, sy: 6, seed: 551,
      inside: (x, y) => x < rimR(y) - 2 && x > bwR(y) + 1,
      dens: (x, y) => 0.5, h: (x, y) => 5 + (y - 245) / 40, lit: (x, y) => (rightWallLit(x, y) ? 1 : 0) });
    // a thin side-cascade down the right wall, catching gold
    curF = F_PROT;
    let sx = 296;
    for (let y = 268; y < 380; y++) {
      sx += (hash2(y, 1, 61) - 0.5) * 0.9 + 0.12;
      const lit = rightWallLit(sx, y);
      const c = lit ? (y % 5 === 0 ? C.W : C.G0) : (y % 4 === 0 ? C.B8 : C.B6);
      P(Math.round(sx), y, c);
      if (y % 7 < 2) P(Math.round(sx) + 1, y, lit ? C.L6 : C.B5);
    }
    curF = F_NONE;
  }

  function waterfall() {
    curF = F_PROT;
    const WF = [C.B4, C.B5, C.B6, C.B7, C.B8, C.W];
    const top = 268, bot = 452;
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const cx = BR.cx + 1 + Math.sin(y * 0.03) * 0.8;
      const half = 5 + t * 5 + (y < top + 4 ? -1 : 0);
      for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
        const rel = (x - cx) / half;
        if (Math.abs(rel) > 1.05 + (vnoise(x * 0.5, y * 0.06, 71) - 0.5) * 0.5) continue;
        const streak = fbm(x * 0.55, y * 0.045 - x * 0.03, 73, 3);
        let v = 0.32 + streak * 0.8 - Math.abs(rel) * 0.35 - t * 0.62;
        if (y < top + 3) v += 0.35;
        const c = rampAt(WF, v, x, y, 0);
        // edge strands break apart into droplets
        if (Math.abs(rel) > 0.85 && hash2(x, y, 75) < 0.45) continue;
        P(x, y, c);
      }
    }
    // lip catching the last light under the bridge arch
    hl(BR.cx - 5, BR.cx + 6, top, C.G0); hl(BR.cx - 3, BR.cx + 4, top + 1, C.B8);
    curF = F_NONE;
    // spray cloud at the plunge, swallowed by the gorge mist
    for (let y = 400; y < 500; y++) for (let x = 150; x < 280; x++) {
      const d = Math.hypot((x - BR.cx) / 26, (y - 440) / 22);
      veil(x, y, C.B7, clamp(1.1 - d) * 1.2 * (0.75 + 0.5 * fbm(x * 0.08, y * 0.08, 79)), 3, 0.5);
    }
  }

  /* ----------------------------------------------- left & right mountain masses */
  const MEADOW_LIT = [C.G5, C.G4, C.G3, C.G2, C.G1];
  const MEADOW_SH = [C.V1, C.G7, C.G6, C.V2, C.G5];
  const shadowLineL = (x) => 334 + x * 0.03 + (fbm(x * 0.03, 4, 93) - 0.5) * 26;
  const shadowLineR = (x) => 350 + (x - 250) * 0.24 + (fbm(x * 0.05, 9, 95) - 0.5) * 8;
  const inLeft = (x, y) => y >= skyL(Math.min(x, 186)) && x < (y < 244 ? 186 : rimL(y));
  const inRight = (x, y) => x >= 250 && y >= skyR(x) && (y < 238 ? true : x > rimR(y));
  const nearTrack = (x, y, pad) => {
    if (x > J[0] - 32 && x <= BR.x0 && Math.abs(y - upperY(Math.max(x, J[0]))) < pad) return true;
    if (x >= J[0] && x <= VX0 + 2 && Math.abs(y - lowerY(x)) < pad) return true;
    if (x >= BR.x1 && x <= TUN[0] && Math.abs(y - upperY(x)) < pad) return true;
    if (x > VX1 - 2 && Math.abs(y - DECK) < pad + 2) return true;
    return false;
  };

  // light on the near masses: the left mass faces the sun but turns away into the gorge near its rim;
  // the right mass faces the sun; the low ground already lies in the evening shadow
  const turnL = (y) => 102 + (y - 170) * 0.2 + (fbm(y * 0.05, 3, 97) - 0.5) * 16;
  const litLeft = (x, y) => y < shadowLineL(x) && x < turnL(y);
  const litRight = (x, y) => y < shadowLineR(x);
  const isMeadow = (x, y, L) => {
    const sk = L ? skyL(Math.min(x, 186)) : skyR(x);
    return fbm(x * 0.022, y * 0.04, L ? 1801 : 1811, 3) + clamp(1 - (y - sk) / 18) * 0.32 + (L && x < 60 && y > 275 && y < 312 ? 0.3 : 0) > 0.6;
  };
  const GRASS_LIT = [C.G6, C.G5, C.G4, C.G3, C.G2, C.G1];
  const GRASS_SH = [C.K0, C.K1, C.K1, C.V1, C.B1, C.B2];
  const FLOOR_LIT = [C.E0, C.G7, C.E1, C.G6];
  const FLOOR_SH = [C.K0, C.K1, C.E0, C.V1];

  function masses() {
    curF = F_ORG;
    for (let y = 150; y < H; y++) for (let x = 0; x < W; x++) {
      const L = inLeft(x, y), Rr = inRight(x, y);
      if (!L && !Rr) continue;
      const lit = L ? litLeft(x, y) : litRight(x, y);
      const sk = L ? skyL(Math.min(x, 186)) : skyR(x);
      if (isMeadow(x, y, L)) {
        // alpine grass gone to gold: soft value drift + short vertical blade strokes
        const hf = (a, b) => fbm(a * 0.035, b * 0.06, 1825, 3);
        const dhx = hf(x + 1, y) - hf(x - 1, y), dhy = hf(x, y + 1) - hf(x, y - 1);
        let v = 2.6 + clamp(dhx * 40 - dhy * 14, -1.6, 1.4) + (fbm(x * 0.07, y * 0.12, 1821, 2) - 0.5) * 0.8 + (y - sk < 3 ? 1.2 : 0);
        const blade = hash2(x, (y + (x % 3)) >> 1, 1823);
        if (blade < 0.07) v += 1; else if (blade > 0.95) v -= 1;
        P(x, y, (lit ? GRASS_LIT : GRASS_SH)[clamp(Math.round(v), 0, 5)]);
      } else {
        const n = fbm(x * 0.12, y * 0.12, 1831, 2);
        P(x, y, (lit ? FLOOR_LIT : FLOOR_SH)[Math.min(3, (n * 4.2) | 0)]);
      }
    }
    // crests: thin sunlit rim against the sky
    curF = F_NONE;
    for (let x = 0; x < W; x++) {
      if (x <= 186) { const y = skyL(x); P(x, y, litLeft(x, y + 1) ? C.G1 : C.L4); if (x % 3 === 0 && litLeft(x, y + 1)) P(x, y + 1, C.G2); }
      if (x >= 250) { const y = skyR(x); P(x, y, C.G1); if (x % 4 === 1) P(x, y + 1, C.G2); }
    }
    // rocky outcrops and scree in the meadows
    const crg = (cx, cy, rx, ry, seed) => {
      const lit = cx < 250 ? litLeft(cx, cy) : litRight(cx, cy);
      rockFill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 - (vnoise(x * 0.3, y * 0.3, seed) - 0.5) * 0.7,
        cx - rx - 2, cx + rx + 2, cy - ry - 2, cy + ry + 2, () => (lit ? RK_LIT : RK_SH), 4, 3, seed);
    };
    crg(70, 192, 9, 5, 621); crg(118, 218, 6, 4, 622); crg(14, 182, 8, 5, 623); crg(40, 196, 5, 3, 627);
    crg(372, 190, 8, 4, 624); crg(420, 186, 7, 4, 625); crg(268, 232, 6, 4, 626); crg(318, 212, 5, 3, 628);
    // forests
    forest({ x0: 0, x1: 190, y0: 168, y1: 540, sx: 3, sy: 3, seed: 701,
      inside: (x, y) => inLeft(x, y) && y > skyL(Math.min(x | 0, 186)) + 2 && !nearTrack(x, y, 6) && y < 470,
      dens: (x, y) => (isMeadow(x | 0, y | 0, true) ? 0.05 : 0.92),
      h: (x, y) => 5 + (y - 170) / 24, lit: litLeft,
      species: (x, y) => { const sp = pickSpecies(x, y, 712); return !litLeft(x, y) && sp !== 0 && hash2(x | 0, y | 0, 713) < 0.55 ? 0 : sp; } });
    forest({ x0: 250, x1: W, y0: 160, y1: 540, sx: 3, sy: 3, seed: 731,
      inside: (x, y) => inRight(x, y) && y > skyR(x | 0) + 2 && !nearTrack(x, y, 6) && !(x > 326 && y > 286 && y < 346) && !(x > 382 && x < 422 && y > 188 && y < 210) && !(x > 362 && x < 382 && y > 205 && y < 222) && y < 470,
      dens: (x, y) => (isMeadow(x | 0, y | 0, false) ? 0.05 : 0.92),
      h: (x, y) => 5 + (y - 165) / 24, lit: litRight,
      species: (x, y) => { const sp = pickSpecies(x, y, 742); return !litRight(x, y) && sp !== 0 && hash2(x | 0, y | 0, 743) < 0.55 ? 0 : sp; } });
  }

  /* ----------------------------------------------------------------- track */
  function trackBed(x0, x1, yf, lit) {
    // ballast shelf with retaining edge, sleepers and two rails seen from slightly above
    for (let x = x0; x <= x1; x++) {
      const y = Math.round(yf(x));
      const L = lit(x, y);
      curF = F_NONE;
      P(x, y + 1, L ? C.T4 : C.T1); P(x, y + 2, L ? C.T3 : C.T0); P(x, y + 3, L ? C.G6 : C.K1);
      P(x, y + 4, L ? C.T2 : C.K1);
      if (x % 3 === 0) P(x, y + 4, L ? C.T3 : C.T1);
      P(x, y - 1, L ? C.T3 : C.T1);
      curF = F_PROT;
      P(x, y, x % 2 ? (L ? C.G6 : C.K1) : (L ? C.T2 : C.T0));
      P(x, y - 1, L ? C.B6 : C.B3);
      P(x, y + 1, L ? C.B7 : C.B4);
      if (x % 2 === 0) P(x, y, L ? C.G6 : C.K1);
    }
    curF = F_NONE;
  }
  function telegraph(pts, lit) {
    // poles and sagging wires
    curF = F_PROT;
    const tops = [];
    for (const [x, yb] of pts) {
      const L = lit(x, yb);
      vl(x, yb - 9, yb, L ? C.G6 : C.K1);
      P(x - 1, yb - 9, L ? C.G4 : C.T1); P(x - 1, yb - 8, L ? C.G5 : C.K1);
      hl(x - 2, x + 2, yb - 8, L ? C.G6 : C.K1);
      P(x - 2, yb - 9, C.B8); P(x + 2, yb - 9, C.B8);
      tops.push([x, yb - 9]);
    }
    for (let i = 1; i < tops.length; i++) {
      const [ax, ay] = tops[i - 1], [bx, by] = tops[i];
      for (const off of [-2, 2]) {
        for (let x = Math.min(ax, bx) + 1; x < Math.max(ax, bx); x++) {
          const t = (x - ax) / (bx - ax);
          const y = Math.round(ay + (by - ay) * t + 3 * 4 * t * (1 - t));
          P(x + off, y, C.K1);
        }
      }
    }
    curF = F_NONE;
  }

  function tracks() {
    const litL = litLeft, litR = litRight;
    trackBed(J[0] - 30, BR.x0, (x) => (x < J[0] ? J[1] - (x < J[0] - 26 ? 0 : 0) : upperY(x)), litL);
    trackBed(J[0] + 2, VX0, lowerY, litL);
    trackBed(BR.x1, TUN[0], upperY, litR);
    trackBed(VX1, W - 1, () => DECK, litR);
    // point blades at the reversing point
    curF = F_PROT;
    P(J[0] - 1, J[1], C.B8); P(J[0], J[1] + 1, C.B8);
    // buffer stop at the end of the spur
    const bx = J[0] - 31;
    rect(bx, J[1] - 4, 2, 4, C.G6); rect(bx + 1, J[1] - 4, 3, 2, C.R1); P(bx + 1, J[1] - 4, C.R2); P(bx + 3, J[1] - 3, C.W);
    // switchman's hut beside the reversing point
    hut(J[0] - 14, J[1] - 3, true);
    // retaining walls under the upper shelf
    for (let x = J[0] + 4; x < BR.x0 - 2; x++) {
      const y = Math.round(upperY(x)) + 5;
      const L = litL(x, y);
      P(x, y, L ? C.T3 : C.T1); if ((x >> 2) % 2) P(x, y + 1, L ? C.T2 : C.T0);
    }
    // tunnel portal
    portal(TUN[0], Math.round(upperY(TUN[0])));
    // telegraph line along the lower leg and down to the station
    telegraph([[18, 312], [44, 318], [70, 325], [96, 334]], litL);
    curF = F_NONE;
  }
  function hut(x, yb, lit) {
    curF = F_PROT;
    // timber hut 9 wide, pitched roof, lit window, stovepipe
    const by = yb - 7;
    rect(x, by + 2, 9, 6, lit ? C.G5 : C.G6);
    vl(x, by + 2, yb, lit ? C.G3 : C.G5);
    for (let i = 0; i < 9; i += 2) vl(x + i, by + 3, yb - 1, lit ? C.G6 : C.G7);
    rect(x + 4, by + 3, 2, 2, C.G0); P(x + 5, by + 4, C.G1);
    rect(x + 1, yb - 3, 2, 3, C.G7);
    hl(x - 1, x + 9, by + 1, C.T1); hl(x, x + 8, by, C.T3); hl(x + 1, x + 7, by - 1, C.T4); P(x - 1, by + 1, C.T2);
    hl(x, x + 3, by, C.T5);
    vl(x + 7, by - 4, by - 1, C.K1); P(x + 7, by - 5, C.T2);
    // smoke wisp
    const wisp = [[8, -6], [8, -7], [9, -8], [9, -9], [10, -10], [11, -11], [11, -12], [12, -13], [13, -14], [14, -14]];
    wisp.forEach(([dx, dy], i) => { if (i % 4 !== 3) P(x + dx, by + dy, i < 5 ? C.B7 : C.L4); });
    curF = F_NONE;
  }
  function portal(x, y) {
    curF = F_PROT;
    // stone portal facing the sun: dressed voussoirs and dark bore
    rect(x - 7, y - 13, 15, 14, C.T3);
    for (let j = -13; j <= 0; j++) for (let i = -7; i <= 7; i++) {
      if ((j + 13) % 3 === 2) P(x + i, y + j, C.T2);
      else if (((i + 7 + ((j + 13) / 3 | 0) * 2) % 5) === 0) P(x + i, y + j, C.T2);
      if (i === -7) P(x + i, y + j, C.T5);
    }
    hl(x - 8, x + 8, y - 14, C.T5); hl(x - 8, x + 8, y - 13, C.T2); P(x - 8, y - 14, C.T6);
    for (let j = -9; j <= 0; j++) for (let i = -4; i <= 4; i++) {
      const inside = j >= -5 || (i * i + (j + 5) * (j + 5) * 1.0) <= 16.5;
      if (inside) P(x + i, y + j, j < -6 || i > 2 ? C.K1 : C.K0);
    }
    for (let a = 0; a <= 12; a++) {
      const t = Math.PI * a / 12, px = Math.round(x - Math.cos(t) * 5.4), py = Math.round(y - 5 - Math.sin(t) * 5.4);
      P(px, py, a % 3 === 0 ? C.T6 : C.T5);
    }
    vl(x - 5, y - 4, y, C.T4); vl(x + 5, y - 4, y, C.T2);
    curF = F_NONE;
  }

  /* -------------------------------------------- stone arch over the falls */
  function upperBridge() {
    curF = F_PROT;
    const { y, x0, x1, cx } = BR;
    const r = 13, crown = y + 5, spring = crown + r;
    for (let yy = y - 1; yy <= spring + 2; yy++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, ad = Math.abs(dx);
        if (yy > crown && ad <= r && (yy >= spring || dx * dx + (yy - spring) ** 2 <= r * r)) continue;
        const deck = yy <= y + 4;
        const ring = ad <= r + 4 + (yy - crown) * 0.35;
        if (!deck && !ring) continue;
        const lit = x > 170;
        let c = lit ? C.T4 : C.T2;
        if ((yy - y) % 3 === 0) c = lit ? C.T3 : C.T1;
        else if (((x + ((yy - y) / 3 | 0) * 3) % 6) === 0) c = lit ? C.T3 : C.T1;
        if (!deck && ad > r + 2 + (yy - crown) * 0.35) c = lit ? C.T5 : C.T3;   // pier edge catches light
        P(x, yy, c);
      }
    }
    // voussoir ring and intrados shadow
    for (let a = 0; a <= 24; a++) {
      const t = Math.PI * a / 24;
      for (const rr of [r + 1, r + 2]) {
        const px = Math.round(cx - Math.cos(t) * rr), py = Math.round(spring - Math.sin(t) * rr);
        P(px, py, a % 2 ? C.T5 : (rr === r + 2 ? C.T4 : C.T3));
      }
      const px = Math.round(cx - Math.cos(t) * r), py = Math.round(spring - Math.sin(t) * r);
      P(px, py, C.K1);
      if (a > 12) P(px - 1, py + 1, C.B1);
    }
    P(cx, crown - 2, C.T6);
    // string course, parapet and coping catching gold
    hl(x0 - 1, x1 + 1, y - 3, C.T6); hl(x0 - 1, x1 + 1, y - 2, C.T4);
    for (let x = x0; x <= x1; x += 4) P(x, y - 2, C.T3);
    hl(x0, x1, y + 5, C.T5);
    trackBedFlat(x0 - 4, x1 + 4, y);
    curF = F_NONE;
  }
  function trackBedFlat(x0, x1, y) {
    curF = F_PROT;
    for (let x = x0; x <= x1; x++) { P(x, y, x % 2 ? C.G6 : C.T2); P(x, y - 1, C.B6); P(x, y + 1, C.T5); }
    curF = F_NONE;
  }

  /* ---------------------------------------------------- gorge depth & mist */
  function depths() {
    // the gorge floor: dark stream with a few cold glints, boulders
    curF = F_ORG;
    for (let y = 470; y < H; y++) for (let x = Math.round(bwL(y)); x <= Math.round(bwR(y)); x++) {
      const n = fbm(x * 0.1, y * 0.2, 801, 3);
      P(x, y, n > 0.62 ? C.B3 : n > 0.48 ? C.B2 : C.B1);
    }
    curF = F_PROT;
    for (let i = 0; i < 26; i++) {
      const y = 476 + ((hash2(i, 1, 803) * 60) | 0), cx = 205 + (hash2(i, 2, 803) - 0.5) * 50;
      hl(Math.round(cx), Math.round(cx + 1 + hash2(i, 3, 803) * 4), y, i % 3 ? C.B5 : C.B7);
    }
    curF = F_NONE;
  }
  // a sea of mist filling the gorge: rolling layers, each lit along its crest by the sky,
  // the piers sinking into it through a dithered seam
  function rollTop(base, xa, xb, n, amp, seed, taper) {
    const arcs = [];
    for (let i = 0; i < n; i++) {
      const ex = xa + (xb - xa) * (i + 0.5 + (hash2(i, 1, seed) - 0.5) * 0.8) / n;
      arcs.push([ex, (xb - xa) / n * (0.7 + 1.0 * hash2(i, 3, seed)), 0.3 + 0.7 * hash2(i, 2, seed)]);
    }
    const out = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let b = 0;
      for (const [ex, rx, k] of arcs) { const dx = (x - ex) / rx; if (Math.abs(dx) < 1) b = Math.max(b, k * Math.sqrt(1 - dx * dx)); }
      const f = clamp((x - xa) / (xb - xa) * 1.0001);
      const env = !taper ? 1 : f <= 0 || f >= 1 ? 0 : Math.pow(Math.sin(Math.PI * f), 0.6);
      const swell = 4 * Math.sin(x * 0.019 + seed) + 3 * (fbm(x * 0.05, 1, seed) - 0.5);
      out[x] = env > 0 ? Math.round(base - amp * b * env + swell + (taper ? 4 * (1 - env) : 0)) : 1e9;
    }
    return out;
  }
  // the gorge floor drowned in mist: a lit mist crest, then receding ranks of spruce
  // silhouettes, each rank one flat value with a sky-lit left edge, dissolving at its feet
  const sideDrop = (x) => Math.round(26 * Math.pow(clamp((Math.abs(x - 226) - 80) / 130), 1.4));
  function spruceRank(base, hmin, hmax, gap, seed, fill, edge, larch, larchCols) {
    const prof = new Float32Array(W).fill(1e9);
    const kind = new Int8Array(W), kb = new Float32Array(W);
    for (let tx = -8; tx < W + 8; tx += gap * (0.6 + 0.8 * hash2(tx, 1, seed))) {
      const x0 = Math.round(tx);
      if (fbm(x0 * 0.04, 1, seed + 5, 2) < 0.3) continue;
      const side = 0;
      const th = (hmin + (hmax - hmin) * hash2(x0, 2, seed)) * (0.8 + 0.4 * fbm(x0 * 0.06, 2, seed + 6, 2)) + side * hmax * 0.6;
      const isL = larch && hash2(x0, 3, seed) < larch;
      const bb = base + sideDrop(x0) * (base < 480 ? 1 : 0.4) + Math.round((hash2(x0, 4, seed) - 0.5) * 4 + 3 * Math.sin(x0 * 0.03 + seed));
      for (let dx = -12; dx <= 12; dx++) {
        const x = x0 + dx;
        if (x < 0 || x >= W) continue;
        const a = Math.abs(dx);
        // tiered spruce flank: steep, with a droop every few px
        const top = isL ? bb - th * 0.85 + a * 1.7 + (a < 2 ? 0 : 1) - (hash2(x, x0, seed) < 0.35 ? 1 : 0)
          : bb - th + a * 2.6 + (a % 3 === 2 ? 1 : 0) - (a > 0 && hash2(x, x0, seed) < 0.2 ? 1 : 0);
        if (top < prof[x]) { prof[x] = top; kind[x] = isL ? 1 : 0; kb[x] = bb - Math.round(th * 0.3); }
      }
    }
    for (let x = 0; x < W; x++) {
      const t = Math.round(prof[x]);
      for (let y = Math.max(0, t); y < H; y++) {
        let c = fill;
        if (y < t + 4 && x > 0 && Math.round(prof[x - 1]) > t - 1 + (y - t) && y - t < 2) c = edge;   // sky-lit left flank
        if (y === t && x > 0 && prof[x - 1] >= prof[x]) c = edge;
        if (kind[x] === 1 && y < kb[x]) c = c === edge ? larchCols[1] : larchCols[0];
        P(x, y, c);
      }
    }
  }
  function fogVeil(y0, y1, target, t0, t1) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) veil(x, y, target, lerp(t0, t1, (y - y0) / (y1 - y0)), 3, 0.5);
  }
  function mistSea() {
    curF = F_NONE;
    const roll = rollTop(0, -20, W + 20, 16, 9, 853, false);
    const top = (x) => Math.round(434 + 3 * Math.sin(x * 0.045 + 1) + 6 * (fbm(x * 0.03, 1, 851) - 0.5) + roll[clamp(x, 0, W - 1)] - Math.max(0, 7 - Math.abs(x - 226) / 18) + sideDrop(x));
    for (let x = 0; x < W; x++) {
      const t = top(x);
      for (let y = t - 3; y < t; y++) if (bay2(x, y) < (y === t - 1 ? 0.7 : y === t - 2 ? 0.4 : 0.15)) P(x, y, C.B5);
      for (let y = t; y < H; y++) {
        let c = y === t ? (top(x - 1) >= t ? C.B8 : C.B7) : y < t + 2 ? C.B7 : y < t + 5 ? C.B6 : C.B5;
        if (y >= t + 4 && y <= t + 5 && bay2(x, y) < 0.5) c = C.B6;
        // seams where one roll of mist overlaps the next
        if (y > t && y < t + 3 && (top(x - 1) < t - 2 || top(x + 1) < t - 2)) c = C.B6;
        P(x, y, c);
      }
    }
    spruceRank(446, 7, 15, 6, 861, C.B4, C.B5, 0, [C.L2, C.L3]);
    spruceRank(470, 9, 20, 7, 863, C.B3, C.B4, 0, [C.V2, C.L2]);
    spruceRank(500, 12, 26, 8, 865, C.B2, C.B3, 0, [C.V1, C.V2]);
    spruceRank(532, 14, 30, 9, 867, C.B1, C.B2, 0, [C.G7, C.V1]);
  }
  function lowerMist() {}

  /* --------------------------------------------------------------- viaduct */
  function viaduct() {
    curF = F_NONE;
    const span = 28, pier = 8, n = 6;
    const start = VX0 + 2;
    const arches = [];
    for (let k = 0; k < n; k++) arches.push(start + k * (span + pier) + span / 2);
    const r = span / 2, crown = DECK + 12, spring = crown + r;
    const shadowY = (x) => DECK + 17 + Math.round((x - VX0) * 0.035 + (fbm(x * 0.08, 1, 901) - 0.5) * 4);
    const bottomY = 540;
    for (let y = DECK - 3; y < bottomY; y++) {
      // piers batter outward as they descend
      const bat = Math.max(0, Math.floor((y - spring) / 14));
      for (let x = VX0 - 4; x <= VX1 + 4; x++) {
        let inStruct = x >= VX0 && x <= VX1;
        let archK = -1;
        for (let k = 0; k < n; k++) {
          const dx = x - arches[k];
          const hw = r - bat;
          if (y > crown && (y >= spring ? Math.abs(dx) < hw : dx * dx + (y - spring) ** 2 < r * r)) { inStruct = false; archK = k; break; }
        }
        if (!inStruct) continue;
        // abutments only extend down into the rock
        if ((x < VX0 + 2 && y > DECK + 30) || (x > VX1 - 2 && y > DECK + 26)) continue;
        const lit = y < shadowY(x);
        const deep = y > 410;
        // ashlar courses: 3px courses, staggered joints every 5px
        const course = Math.floor((y - DECK) / 3);
        const jx = (x + course * 3) % 6;
        let c;
        if (lit) c = (y - DECK) % 3 === 0 ? C.T3 : jx === 0 ? C.T3 : C.T4;
        else c = (y - DECK) % 3 === 0 ? (deep ? C.B1 : C.T1) : jx === 0 ? (deep ? C.B1 : C.T1) : (deep ? C.B2 : C.T2);
        // occasional lighter stones for life
        if (jx !== 0 && (y - DECK) % 3 !== 0 && hash2(Math.floor((x + course * 3) / 6), course, 907) < 0.18) c = lit ? C.T5 : (deep ? C.B3 : C.T3);
        // pier faces: sunward left edge lit, right edge in shade
        for (let k = 0; k < n; k++) {
          const left = arches[k] + r - bat, right = arches[k] - r + bat; // edges of opening
          if (y > spring && x === Math.round(left)) c = lit ? C.T6 : C.T3;            // left face of the next pier
          if (y > spring && x === Math.round(right) - 1) c = lit ? C.T2 : C.K1;       // right face of the previous pier
        }
        P(x, y, c);
      }
    }
    // voussoirs and the shadowed intrados of each arch
    for (const ax of arches) {
      for (let a = 0; a <= 28; a++) {
        const t = Math.PI * a / 28;
        for (const rr of [r + 1, r + 2]) {
          const px = Math.round(ax - Math.cos(t) * rr), py = Math.round(spring - Math.sin(t) * rr);
          const lit = py < shadowY(px);
          P(px, py, a % 2 ? (lit ? C.T5 : C.T2) : (lit ? C.T4 : C.T1));
        }
        const px = Math.round(ax - Math.cos(t) * r), py = Math.round(spring - Math.sin(t) * r);
        P(px, py, C.K1); if (a < 14) P(px + 1, py, C.B1);
      }
      // keystone
      P(Math.round(ax), crown - 2, C.T6); P(Math.round(ax), crown - 1, C.T5);
    }
    // string course and parapet with coping, lit by the low sun
    for (let x = VX0 - 3; x <= VX1 + 3; x++) {
      P(x, DECK + 6, C.T6); P(x, DECK + 7, C.T2); P(x, DECK + 8, C.T1);
      P(x, DECK - 3, C.T6); P(x, DECK - 2, x % 7 === 0 ? C.T4 : C.T5);
      for (let y = DECK - 1; y <= DECK + 5; y++) P(x, y, (y - DECK) % 3 === 2 || (x + (y - DECK > 1 ? 3 : 0)) % 7 === 0 ? C.T3 : C.T4);
    }
    // refuges over each pier, with drain spouts
    for (let k = 0; k < n - 1; k++) {
      const px = Math.round(arches[k] + r + pier / 2);
      rect(px - 3, DECK - 4, 7, 1, C.T6); rect(px - 3, DECK - 3, 7, 12, C.T4);
      vl(px - 3, DECK - 3, DECK + 8, C.T6); vl(px + 3, DECK - 3, DECK + 8, C.T2);
      P(px, DECK + 10, C.K1); P(px, DECK + 11, C.T1);
      hl(px - 3, px + 3, DECK + 9, C.T2);
    }
    // weathering: rust/moss tracery down from the spouts and in the courses
    curF = F_NONE;
    for (let k = 0; k < n - 1; k++) {
      const px = Math.round(arches[k] + r + pier / 2);
      for (let y = DECK + 12; y < DECK + 30 + k * 3; y++) if (hash2(px, y, 911) < 0.7) P(px + ((y >> 3) & 1), y, y < shadowY(px) ? C.T3 : C.T1);
    }
    // ivy / creeper turned crimson on two piers
    for (const [px, py, len] of [[arches[0] + r + 3, DECK + 20, 26], [arches[3] + r + 4, DECK + 16, 34], [VX1 - 3, DECK + 8, 18]]) {
      for (let j = 0; j < len; j++) {
        const w = Math.round(2 + 2 * Math.sin(j * 0.4) + hash2(px, j, 913) * 2);
        for (let i = -w; i <= w; i++) {
          if (hash2(px + i, py + j, 915) < 0.45) continue;
          const x = Math.round(px + i + Math.sin(j * 0.2) * 2), y = py + j;
          const lit = y < shadowY(x);
          P(x, y, lit ? (i < 0 ? C.R2 : C.R1) : (i < 0 ? C.G5 : C.G6));
        }
      }
    }
    // rails on the deck
    curF = F_PROT;
    hl(VX0 - 3, VX1 + 3, DECK - 4, C.B6);
    curF = F_NONE;
  }

  /* ---------------------------------------------------------- the train */
  function loco(ox, by) {
    curF = F_PROT;
    const t = by - 17;
    // chimney (capuchon), smokebox
    rect(ox + 2, t + 1, 4, 5, C.K1); vl(ox + 2, t + 1, t + 5, C.E4); P(ox + 3, t + 1, C.E3);
    hl(ox + 1, ox + 6, t, C.K0); hl(ox + 1, ox + 6, t + 1, C.K1); P(ox + 1, t, C.G2); P(ox + 2, t, C.G1); P(ox + 1, t + 1, C.G4);
    rect(ox + 1, t + 6, 5, 6, C.K1); vl(ox + 1, t + 6, t + 11, C.E3); P(ox + 1, t + 6, C.E4);
    // boiler cylinder
    rect(ox + 6, t + 6, 13, 5, C.E2);
    hl(ox + 6, ox + 18, t + 6, C.E4); hl(ox + 6, ox + 18, t + 7, C.E4); hl(ox + 6, ox + 18, t + 10, C.K1);
    vl(ox + 9, t + 6, t + 10, C.G3); vl(ox + 14, t + 6, t + 10, C.G3); P(ox + 9, t + 6, C.G1); P(ox + 14, t + 6, C.G1);
    // brass dome & safety valves catching the sun
    hl(ox + 10, ox + 12, t + 4, C.G3); hl(ox + 10, ox + 12, t + 5, C.G4); P(ox + 11, t + 3, C.G2); P(ox + 10, t + 4, C.G1); P(ox + 10, t + 3, C.G0);
    vl(ox + 16, t + 4, t + 5, C.G3); P(ox + 16, t + 3, C.G1);
    // whistle steam
    P(ox + 17, t + 2, C.W); P(ox + 18, t + 1, C.B8);
    // side tank
    rect(ox + 6, t + 8, 12, 4, C.E1); hl(ox + 6, ox + 17, t + 8, C.E4); vl(ox + 6, t + 8, t + 11, C.E3);
    hl(ox + 7, ox + 16, t + 11, C.K0); P(ox + 7, t + 9, C.G2); hl(ox + 8, ox + 15, t + 9, C.E2);
    // cab
    rect(ox + 19, t + 3, 7, 9, C.E2); hl(ox + 18, ox + 26, t + 2, C.K1); hl(ox + 18, ox + 26, t + 1, C.E4); P(ox + 18, t + 1, C.B6);
    vl(ox + 19, t + 3, t + 11, C.E4);
    rect(ox + 21, t + 4, 3, 3, C.G1); P(ox + 21, t + 4, C.G0); P(ox + 23, t + 6, C.G2);
    P(ox + 22, t + 4, C.K1); P(ox + 22, t + 5, C.L6); // driver's head in the firelit window
    hl(ox + 19, ox + 25, t + 8, C.E3);
    // bunker
    rect(ox + 26, t + 5, 2, 7, C.E1); hl(ox + 26, ox + 27, t + 5, C.K0); P(ox + 26, t + 4, C.E3);
    // running plate, buffer beam, headlamp
    hl(ox, ox + 27, t + 12, C.K0); hl(ox + 1, ox + 27, t + 13, C.E3);
    rect(ox, t + 11, 2, 3, C.R1); P(ox, t + 11, C.R2); P(ox, t + 12, C.R2);
    P(ox + 2, t + 9, C.G0); P(ox + 2, t + 10, C.G1);
    // last sun along the top edges of boiler, tank and cab roof
    hl(ox + 6, ox + 13, t + 6, C.G3); P(ox + 7, t + 6, C.G1); hl(ox + 7, ox + 12, t + 8, C.G4);
    hl(ox + 18, ox + 23, t + 1, C.G3); P(ox + 18, t + 1, C.G1); P(ox + 2, t + 2, C.G4); P(ox + 1, t + 6, C.G3);
    // wheels & motion (mostly behind the parapet)
    // (wheels and motion are hidden behind the parapet; only the drain-cock steam shows)
    P(ox - 1, t + 12, C.W); P(ox - 2, t + 11, C.B8); P(ox - 3, t + 12, C.B7); P(ox - 4, t + 11, C.B7);
    curF = F_NONE;
    return [ox + 3, t - 1];
  }
  function coach(ox, by, opts) {
    curF = F_PROT;
    const t = by - 16, L = 21;
    // roof: clerestory-less arc, lit along the top
    hl(ox + 1, ox + L - 2, t, C.T4); hl(ox, ox + L - 1, t + 1, C.T2); hl(ox, ox + L - 1, t + 2, C.T1);
    P(ox + 1, t, C.T6); hl(ox + 2, ox + 8, t, C.T5);
    // upper cream panel with windows
    rect(ox, t + 3, L, 5, C.T5);
    vl(ox, t + 3, t + 7, C.T6);
    for (let w = 0; w < 4; w++) {
      const wx = ox + 2 + w * 5;
      rect(wx, t + 4, 3, 3, w === opts.dark ? C.B3 : C.G1);
      P(wx, t + 4, w === opts.dark ? C.B5 : C.G0);
      if (opts.heads && opts.heads.includes(w)) { P(wx + 1, t + 5, C.T1); P(wx + 1, t + 6, C.G6); P(wx + 1, t + 4, C.G5); }
    }
    hl(ox, ox + L - 1, t + 7, C.T4);
    // waist lining & maroon lower panels
    hl(ox, ox + L - 1, t + 8, C.G2);
    rect(ox, t + 9, L, 3, C.G5); vl(ox, t + 9, t + 11, C.R1);
    for (let p = 0; p < L; p += 5) vl(ox + p, t + 9, t + 11, C.G6);
    hl(ox, ox + L - 1, t + 12, C.K0);
    // bogies
    // end balcony on the last coach, with the guard
    if (opts.balcony) {
      hl(ox + L, ox + L + 2, t + 8, C.K1); vl(ox + L + 2, t + 8, t + 12, C.K1); hl(ox + L, ox + L + 2, t + 10, C.K1);
      P(ox + L + 1, t + 4, C.B2); P(ox + L + 1, t + 5, C.B1); P(ox + L + 1, t + 3, C.L6); P(ox + L + 1, t + 2, C.K1);
      vl(ox + L + 1, t + 6, t + 7, C.B1);
      P(ox + L + 2, t + 4, C.R2); // red flag held out
      P(ox + L + 3, t + 3, C.R1);
    }
    curF = F_NONE;
  }
  function trainAndSteam() {
    const ox = 136;
    const chim = loco(ox, DECK);
    coach(ox + 30, DECK, { heads: [1, 2], dark: -1 });
    coach(ox + 53, DECK, { heads: [0, 3], dark: 2 });
    coach(ox + 76, DECK, { heads: [2], dark: -1, balcony: true });
    // couplings
    curF = F_PROT;
    hl(ox + 28, ox + 29, DECK - 5, C.K0); hl(ox + 51, ox + 52, DECK - 5, C.K0); hl(ox + 74, ox + 75, DECK - 5, C.K0);
    curF = F_NONE;
    plume(chim[0], chim[1]);
  }
  function plume(cx, cy) {
    // steam built from overlapping puffs (a cauliflower silhouette); each puff is shaded as a
    // small sphere lit by the low sun from the left, so every billow carries its own lit crescent
    const puffs = [];
    const path = (s) => [cx + 2 * s + 64 * Math.pow(s, 2.3) + (vnoise(s * 7, 1, 1001) - 0.5) * 8 * s,
      cy - 1 - 112 * Math.pow(s, 0.88)];
    const rad = (s) => 1.3 + 13 * Math.pow(s, 0.85);
    const N = 30;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1) * 0.82;
      const [x, y] = path(s);
      const r = rad(s) * (0.85 + 0.3 * hash2(i, 1, 1011));
      puffs.push([x + (hash2(i, 2, 1011) - 0.5) * r * 0.7, y + (hash2(i, 5, 1011) - 0.5) * r * 0.5, r, s]);
      if (s > 0.12) {
        const m = s > 0.5 ? 3 : 2;
        for (let k = 0; k < m; k++) {
          const a = (k / m) * Math.PI * 2 + hash2(i, k + 3, 1011) * 2.2;
          const d = r * (0.6 + 0.3 * hash2(i, k + 7, 1011));
          puffs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * (0.42 + 0.25 * hash2(i, k + 11, 1011)), s]);
        }
      }
    }
    // the plume breaks into separate drifting puffs at the top
    const [ex, ey] = path(0.82), er = rad(0.82);
    [[14, -5, 0.66], [33, -12, 0.46], [50, -15, 0.3], [63, -21, 0.2], [22, -21, 0.26]].forEach(([dx, dy, k], i) => {
      puffs.push([ex + dx, ey + dy, er * k, 0.9]);
      puffs.push([ex + dx + er * k * (0.5 + 0.4 * hash2(i, 1, 1013)), ey + dy + er * k * 0.3, er * k * (0.5 + 0.3 * hash2(i, 2, 1013)), 0.9]);
      puffs.push([ex + dx - er * k * 0.6, ey + dy + er * k * 0.45, er * k * (0.35 + 0.3 * hash2(i, 3, 1013)), 0.9]);
      if (i < 3) puffs.push([ex + dx + er * k * 1.1, ey + dy + er * k * 0.55, er * k * 0.38, 0.9]);
    });
    // paint oldest (highest) first so younger, lower billows sit in front
    puffs.forEach((p, i) => { p[4] = p[3] + (hash2(i, 9, 1015) - 0.5) * 0.12; });
    puffs.sort((p, q) => q[4] - p[4]);
    const ST = [C.V2, C.L2, C.L3, C.L4, C.L6, C.G0, C.W];
    const Lx = -0.78, Ly = -0.5, Lz = 0.36;
    curF = F_PROT;
    for (const [px, py, r, s] of puffs) {
      const R2 = r * r, sq = 0.82;
      for (let y = Math.floor(py - r - 1); y <= Math.ceil(py + r + 1); y++) for (let x = Math.floor(px - r - 1); x <= Math.ceil(px + r + 1); x++) {
        const dx = x - px, dy = (y - py) / sq, q = dx * dx + dy * dy;
        if (q > R2 + 0.2 * r) continue;
        const nx = dx / r, ny = dy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let l = nx * Lx + ny * Ly + nz * Lz;          // -1..1
        let v = 0.4 + 0.62 * l - (s > 0.88 ? 0.1 : 0);
        let c = ST[clamp(Math.round(v * (ST.length - 1)), 0, ST.length - 1)];
        if (s < 0.07) c = l > 0.35 ? C.T4 : l > -0.1 ? C.T2 : C.T1;     // coal smoke at the stack
        P(x, y, c);
      }
    }
    curF = F_NONE;
  }

  /* --------------------------------------------------------------- station */
  function station() {
    curF = F_NONE;
    const py = DECK; // platform/rail level
    // ledge: platform gravel, edge stones, retaining wall below
    for (let x = VX1 + 1; x < W; x++) {
      for (let y = py - 9; y < py - 1; y++) if (y >= py - 8) P(x, y, y === py - 8 ? C.T5 : ((x * 3 + y * 5) % 11 === 0 ? C.T3 : C.T4));
      P(x, py - 2, C.T6); P(x, py - 1, C.T2);
    }
    for (let y = py + 5; y < py + 22; y++) for (let x = VX1 + 2; x < W; x++) {
      const c = (y - py) % 3 === 0 || (x + ((y - py) / 3 | 0) * 4) % 8 === 0 ? C.T1 : C.T2;
      P(x, y, y < py + 7 ? C.T3 : c);
    }
    // building: stone ground storey, timber gable, deep eaves
    const bx = 356, bw = 42, wy = py - 9; // wall base
    const top = wy - 20;
    rect(bx, top + 8, bw, 12, C.T4);       // stone
    for (let y = top + 8; y < wy; y++) for (let x = bx; x < bx + bw; x++) {
      if ((y - top) % 3 === 2 || (x + ((y - top) / 3 | 0) * 3) % 7 === 0) P(x, y, C.T3);
    }
    vl(bx, top + 8, wy - 1, C.T6);
    rect(bx, top, bw, 8, C.G4);             // timber upper storey
    for (let x = bx; x < bx + bw; x += 2) vl(x, top, top + 7, C.G5);
    vl(bx, top, top + 7, C.G2); hl(bx, bx + bw - 1, top + 7, C.G6);
    // roof: steep, shingled, gold on the sunward hip
    for (let j = 0; j < 12; j++) {
      const y = top - 1 - j, x0 = bx - 4 + Math.round(j * 0.9), x1 = bx + bw + 3 - Math.round(j * 0.9);
      for (let x = x0; x <= x1; x++) {
        let c = (j % 2 === 0) ? C.G6 : C.G5;
        if (((x + (j % 2) * 2) % 4) === 0) c = C.G7;
        if (x < x0 + 2 + j * 0.2) c = j % 2 ? C.G3 : C.G4;
        P(x, y, c);
      }
    }
    hl(bx + 7, bx + bw - 8, top - 12, C.G2);
    hl(bx - 5, bx + bw + 4, top, C.K1); hl(bx - 4, bx + bw + 3, top + 1, C.G7);
    // eave brackets
    for (let x = bx - 2; x < bx + bw + 2; x += 6) { P(x, top + 2, C.G6); P(x + 1, top + 3, C.G6); }
    // chimney + smoke
    rect(bx + 30, top - 15, 3, 6, C.T3); P(bx + 30, top - 15, C.T5); hl(bx + 29, bx + 33, top - 16, C.T2);
    curF = F_PROT;
    const smoke = [[31, -18], [31, -19], [32, -20], [32, -21], [33, -22], [34, -23], [35, -23], [36, -24], [37, -25], [39, -25], [40, -26], [42, -26]];
    smoke.forEach(([dx, dy], i) => P(bx + dx, top + dy, i < 6 ? C.B7 : i % 2 ? C.L4 : C.L3));
    // upper windows (lamp-lit) with shutters
    for (const wx of [bx + 6, bx + 18, bx + 30]) {
      rect(wx, top + 2, 4, 4, C.G1); P(wx, top + 2, C.G0); P(wx + 1, top + 2, C.G0); vl(wx + 2, top + 2, top + 5, C.G5); hl(wx, wx + 3, top + 4, C.G5);
      vl(wx - 1, top + 2, top + 5, C.E3); vl(wx + 4, top + 2, top + 5, C.E2);
      hl(wx - 1, wx + 4, top + 6, C.R1); P(wx, top + 6, C.R2); P(wx + 2, top + 6, C.G2);
    }
    // ground floor: door, ticket window, notice board (blank), bench
    rect(bx + 4, wy - 9, 5, 9, C.G6); vl(bx + 4, wy - 9, wy - 1, C.G4); P(bx + 7, wy - 5, C.G1); hl(bx + 3, bx + 9, wy - 10, C.T6);
    rect(bx + 13, wy - 8, 6, 5, C.G0); vl(bx + 16, wy - 8, wy - 4, C.G3); hl(bx + 13, bx + 18, wy - 6, C.G3); P(bx + 13, wy - 8, C.W);
    hl(bx + 12, bx + 19, wy - 3, C.T6);
    rect(bx + 24, wy - 8, 5, 4, C.G6); rect(bx + 25, wy - 7, 3, 2, C.T5); P(bx + 25, wy - 7, C.T6);
    rect(bx + 32, wy - 8, 6, 5, C.G1); vl(bx + 35, wy - 8, wy - 4, C.G4); P(bx + 32, wy - 8, C.G0); hl(bx + 31, bx + 38, wy - 3, C.T6);
    // wall clock under the eaves
    P(bx + 21, top + 9, C.W); P(bx + 22, top + 9, C.T6); P(bx + 21, top + 10, C.T6); P(bx + 22, top + 10, C.T5); P(bx + 22, top + 9, C.K1);
    // bench with a waiting passenger
    hl(bx + 20, bx + 25, wy - 3, C.G5); P(bx + 20, wy - 2, C.G6); P(bx + 25, wy - 2, C.G6); hl(bx + 20, bx + 25, wy - 4, C.G4);
    spr(bx + 22, wy - 9, ['.k.', 'kLk', 'RRR', 'RRR', 'GGG', '.k.'], { k: C.K1, L: C.L6, R: C.R1, G: C.B2 });
    P(bx + 22, wy - 8, C.L5);
    // firewood stack against the gable end
    for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) P(bx + bw + 1 + i, wy - 1 - j, (i + j) % 2 ? C.G4 : C.T5);
    hl(bx + bw, bx + bw + 6, wy - 7, C.T2);
    // luggage trolley with trunks and milk churns
    hl(bx - 14, bx - 6, wy - 2, C.G6); P(bx - 13, wy - 1, C.K1); P(bx - 7, wy - 1, C.K1); vl(bx - 5, wy - 6, wy - 2, C.G6);
    rect(bx - 13, wy - 5, 5, 3, C.G4); hl(bx - 13, bx - 9, wy - 5, C.G2); vl(bx - 11, wy - 5, wy - 3, C.G1);
    rect(bx - 12, wy - 7, 3, 2, C.E3); P(bx - 12, wy - 7, C.E4);
    for (const mx of [bx - 3, bx - 1]) { vl(mx, wy - 4, wy - 1, C.B6); P(mx, wy - 4, C.B8); P(mx, wy - 5, C.B4); }
    // platform lamp, just lit
    const lx = VX1 + 8;
    vl(lx, py - 26, py - 9, C.K1); P(lx - 1, py - 9, C.K1); P(lx + 1, py - 9, C.K1); hl(lx - 1, lx + 1, py - 18, C.K1);
    hl(lx - 2, lx + 2, py - 30, C.K1); P(lx, py - 31, C.K1);
    rect(lx - 1, py - 29, 3, 3, C.G0); P(lx, py - 28, C.W); vl(lx - 2, py - 29, py - 27, C.K1); vl(lx + 2, py - 29, py - 27, C.K1);
    hl(lx - 1, lx + 1, py - 26, C.K1);
    // semaphore signal at the viaduct end: arm raised (line clear), lamp green
    const sx = VX1 - 1;
    vl(sx, py - 34, py - 4, C.T1); P(sx, py - 35, C.K1);
    line(sx + 1, py - 31, sx + 6, py - 35, C.R1); P(sx + 6, py - 35, C.W); P(sx + 1, py - 31, C.R2);
    P(sx - 1, py - 30, C.E4); P(sx - 1, py - 29, C.K1);
    hl(sx - 1, sx + 1, py - 22, C.T1); // ladder
    for (let y = py - 21; y < py - 4; y += 2) P(sx + 1, y, C.T1);
    // water tower for the locos
    const tx = 412;
    vl(tx - 4, py - 22, py - 9, C.G6); vl(tx + 4, py - 22, py - 9, C.G6); line(tx - 4, py - 20, tx + 4, py - 12, C.G7); line(tx + 4, py - 20, tx - 4, py - 12, C.G7);
    rect(tx - 6, py - 32, 13, 9, C.G4); for (let x = tx - 6; x <= tx + 6; x += 2) vl(x, py - 32, py - 24, C.G5);
    vl(tx - 6, py - 32, py - 24, C.G2); hl(tx - 6, tx + 6, py - 29, C.K1); hl(tx - 6, tx + 6, py - 26, C.K1);
    hl(tx - 7, tx + 7, py - 33, C.T2); hl(tx - 6, tx + 6, py - 34, C.T4); hl(tx - 4, tx + 4, py - 35, C.T3);
    line(tx - 6, py - 25, tx - 11, py - 22, C.K1); P(tx - 11, py - 21, C.B6);
    // the stationmaster: dark uniform, peaked cap, lantern raised toward the departing train
    const mx = VX1 + 14, my = py - 18;
    spr(mx, my, [
      '.kkk.',
      'kbbbk',
      'kkkk.',
      '.sS..',
      '.sS..',
      'bBBB.',
      'hBBBB',
      'hBGB.',
      'hBBB.',
      '.BBB.',
      '.BkB.',
      '.k.k.',
      '.k.k.',
    ], { k: C.K1, b: C.B2, s: C.L6, S: C.L4, B: C.B2, h: C.B4, G: C.G2 });
    P(mx - 1, my + 5, C.B4); P(mx - 2, my + 4, C.L6); // raised arm and hand
    rect(mx - 3, my + 1, 2, 2, C.G0); P(mx - 3, my + 1, C.W); P(mx - 2, my, C.K1); // lantern
    // a dog at his heel
    spr(mx + 5, my + 9, ['k..k.', 'kTTTk', '.TTTT', '.k.k.'], { k: C.G6, T: C.G3 });
    curF = F_NONE;
  }

  /* ---------------------------------------------- foreground framing trees */
  function bigLarch(x, yb, h, seed, sunTop, shRamp) {
    // trunk
    curF = F_ORG;
    const lit = (y) => y < sunTop;
    for (let y = yb - h + 3; y <= yb; y++) {
      const w = y > yb - h * 0.25 ? 2 : 1;
      for (let i = 0; i < w; i++) P(x + i, y, i === 0 && lit(y) ? C.G5 : C.K1);
    }
    // drooping branch tiers built from small shaded clusters
    const tiers = Math.round(h / 4.2);
    for (let t = 0; t < tiers; t++) {
      const ty = yb - h + 2 + t * (h - 6) / tiers;
      const span = 1.5 + (t + 1) * (h * 0.32) / tiers;
      for (const side of [-1, 1]) {
        const n = Math.max(1, Math.round(span / 2.2));
        for (let c = 0; c < n; c++) {
          const fx = x + side * (1 + c * 2.1) + (hash2(t, c * side, seed) - 0.5) * 2;
          const fy = ty + c * 0.7 + (hash2(t, c * side + 9, seed) - 0.5) * 2;
          const r = 1.6 + hash2(t, c + side * 5, seed + 3) * 1.4;
          clump(fx, fy, r, lit(fy) ? [C.G6, C.G4, C.G3, C.G2, C.G1] : (shRamp || [C.V1, C.G7, C.G6, C.G5, C.G4]), seed + t * 13 + c);
        }
      }
    }
    clump(x + 0.5, yb - h + 1, 1.2, lit(yb - h) ? [C.G6, C.G4, C.G3, C.G2, C.G1] : (shRamp || [C.V1, C.G7, C.G6, C.G5, C.G4]), seed + 999);
  }
  function clump(cx, cy, r, ramp, seed) {
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r + 1); i <= Math.ceil(r + 1); i++) {
      const e = (i / (r + 0.8)) ** 2 + (j / r) ** 2;
      if (e > 1 + (hash2(Math.round(cx) + i, Math.round(cy) + j, seed) - 0.5) * 0.6) continue;
      const l = -i / (r + 1) * 0.65 - j / r * 0.75 + (hash2(i, j, seed + 1) - 0.5) * 0.35;
      const k = l > 0.6 ? 4 : l > 0.15 ? 3 : l > -0.35 ? 2 : l > -0.8 ? 1 : 0;
      P(Math.round(cx) + i, Math.round(cy) + j, ramp[k]);
    }
  }
  function bigBirch(x, yb, h, seed, sunTop, lean) {
    curF = F_ORG;
    const lit = (y) => y < sunTop;
    // white trunk with lenticel marks, slight curve
    const tx = (y) => Math.round(x + lean * ((yb - y) / h) ** 1.5 * 6);
    for (let y = yb - Math.round(h * 0.85); y <= yb; y++) {
      const X = tx(y), L = lit(y);
      P(X, y, L ? C.W : C.B6); P(X + 1, y, L ? C.T5 : C.B4);
      if (hash2(X, y, seed) < 0.2) { P(X, y, C.K1); if (hash2(X, y, seed + 1) < 0.5) P(X + 1, y, C.T1); }
      if (y > yb - 6) P(X + 1, y, C.T1);
    }
    // branches and yellow crown
    const crownY = yb - h * 0.62;
    for (let b = 0; b < 26; b++) {
      const a = (hash2(b, 1, seed) - 0.5) * 2.4 - Math.PI / 2;
      const d = 2 + hash2(b, 2, seed) * h * 0.32;
      const cxp = tx(crownY) + Math.cos(a) * d * 0.9, cyp = crownY + Math.sin(a) * d * 0.9 + (hash2(b, 3, seed) - 0.3) * h * 0.4;
      clump(cxp, cyp, 1.5 + hash2(b, 4, seed) * 1.5, lit(cyp) ? [C.G5, C.G3, C.G2, C.G1, C.G0] : [C.K1, C.V1, C.G7, C.V2, C.L2], seed + b * 7);
    }
  }
  function bigSpruce(x, yb, h, seed, ramp) {
    const top = yb - h, tl = Math.round(5 + h / 18);
    for (let j = 0; j < h; j++) {
      const y = top + j, prog = j / h;
      const tp = (j % tl) / tl;
      const half = Math.round((1 + prog * h * 0.27) * (0.5 + 0.5 * tp) + (hash2(j, 1, seed) - 0.5) * 1.6);
      for (let i = -half; i <= half; i++) {
        if (Math.abs(i) > half - 2 && tp > 0.7 && hash2(i, j, seed) < 0.55) continue;
        const rel = i / Math.max(1, half);
        let k = rel < -0.55 ? 3 : rel < 0.25 ? 2 : 1;
        if (tp > 0.8) k = Math.max(0, k - 1);
        if (tp < 0.2 && rel < -0.2 && hash2(i, j, seed + 3) < 0.6) k = 4;
        P(x + i, y, ramp[k]);
      }
    }
  }
  function foreground() {
    // the near slope in deep evening shadow frames the lit middle distance
    curF = F_ORG;
    const gl = (x) => 492 + x * 0.45 + (fbm(x * 0.06, 1, 1201) - 0.5) * 8;
    const gr = (x) => 506 + (W - x) * 0.5 + (fbm(x * 0.06, 2, 1203) - 0.5) * 8;
    for (let y = 470; y < H; y++) for (let x = 0; x < W; x++) {
      const inL = x < 110 && y > gl(x), inR = x > 322 && y > gr(x);
      if (!inL && !inR) continue;
      const n = fbm(x * 0.09, y * 0.12, 1205, 3);
      P(x, y, n > 0.6 ? C.V1 : n > 0.42 ? C.K1 : C.K0);
    }
    const SPR = [C.K0, C.K0, C.K1, C.B1, C.B3];
    const LAR = [C.K0, C.K1, C.V1, C.V1, C.V2];
    curF = F_ORG;
    bigSpruce(96, 548, 74, 1701, SPR);
    bigLarch(58, 552, 92, 1711, 0, LAR);
    bigSpruce(16, 556, 118, 1703, SPR);
    bigBirch(82, 548, 58, 1721, 0, 0.6);
    bigLarch(396, 552, 64, 1713, 0, LAR);
    bigSpruce(424, 556, 96, 1707, SPR);
    curF = F_NONE;
  }

  /* ---------------------------------------------------------- life & extras */
  function clearing(cx, cy, rx, ry, seed) {
    curF = F_ORG;
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e > 1 + (hash2(x, y, seed) - 0.5) * 0.5) continue;
      const blade = hash2(x, (y + (x % 3)) >> 1, seed + 1);
      const v = 0.5 + (blade < 0.12 ? 0.2 : blade > 0.88 ? -0.2 : 0) + (fbm(x * 0.1, y * 0.1, seed + 2, 2) - 0.5) * 0.4 - (y - cy) / ry * 0.1;
      P(x, y, GRASS_LIT[clamp(Math.round(v * 5), 0, 5)]);
    }
  }
  function chapel(x, yb) {
    // whitewashed chapel with a shingled roof and a slim spire, sunlit on its west wall
    curF = F_PROT;
    rect(x, yb - 7, 11, 8, C.T6); vl(x, yb - 7, yb, C.W); rect(x + 7, yb - 7, 4, 8, C.T5);
    vl(x + 10, yb - 7, yb, C.T4);
    // gable roof seen from the side, long eave
    for (let j = 0; j < 5; j++) hl(x - 1 + j, x + 11 - j, yb - 8 - j, j === 0 ? C.G7 : j % 2 ? C.G5 : C.G6);
    hl(x - 1, x + 3, yb - 8, C.G4); hl(x, x + 2, yb - 9, C.G3);
    // tower with a needle spire
    rect(x - 4, yb - 14, 4, 15, C.T6); vl(x - 4, yb - 14, yb, C.W); vl(x - 1, yb - 14, yb, C.T4);
    P(x - 3, yb - 12, C.K1); P(x - 2, yb - 12, C.K1); P(x - 3, yb - 11, C.T2);
    hl(x - 5, x, yb - 15, C.G6);
    for (let j = 0; j < 7; j++) { const w = j < 2 ? 2 : j < 4 ? 1 : 0; hl(x - 2 - w, x - 3 + w, yb - 16 - j, j % 2 ? C.G6 : C.G5); P(x - 2 - w, yb - 16 - j, C.G2); }
    P(x - 2, yb - 23, C.G1); P(x - 2, yb - 24, C.G0);
    // arched door and a lit window
    P(x + 3, yb - 3, C.G6); P(x + 4, yb - 3, C.G6); rect(x + 3, yb - 2, 2, 3, C.G6);
    P(x + 7, yb - 5, C.G1); P(x + 7, yb - 4, C.G2);
    hl(x - 5, x + 12, yb + 1, C.T3);
  }
  function cow(x, y, f, c) {
    curF = F_PROT;
    const rows = c ? ['.bbbb..', 'bBwBBbh', '.k..k..'] : ['.bbbb..', 'bBBBBbh', '.k..k..'];
    const map = { b: C.G6, B: C.G7, w: C.T6, h: C.T5, k: C.K1 };
    if (f) sprFlip(x, y, rows, map); else spr(x, y, rows, map);
    P(x + (f ? 0 : 6), y, C.G6); P(x + (f ? 1 : 5), y, C.T6);
  }
  function hayRack(x, yb) {
    curF = F_PROT;
    // a timber drying rack hung with hay, roofed with boards
    for (const px of [0, 6, 12]) vl(x + px, yb - 8, yb, C.G6);
    hl(x - 1, x + 13, yb - 9, C.T2); hl(x, x + 12, yb - 10, C.T4);
    for (let j = 0; j < 5; j++) for (let i = 1; i < 12; i++) if (i % 6) P(x + i, yb - 7 + j, (i + j) % 3 ? C.G2 : C.G3);
    hl(x + 1, x + 11, yb - 7, C.G1);
  }
  function extras() {
    // a chapel in a clearing high on the sunward slope, a path down to the reversing point
    clearing(46, 196, 14, 7, 1901);
    chapel(44, 198);
    curF = F_PROT;
    for (let i = 0; i < 70; i++) {
      const t = i / 70, x = Math.round(52 - 30 * Math.sin(t * 7.5) * (0.4 + t * 0.6) + t * 6), y = Math.round(200 + t * 82);
      if (G(x, y) !== -1) { P(x, y, litLeft(x, y) ? C.T5 : C.T2); P(x + 1, y, litLeft(x, y) ? C.T4 : C.T1); }
    }
    // cattle grazing in a high meadow; a hay rack
    clearing(350, 202, 16, 7, 1911);
    cow(340, 199, false, 1); cow(352, 202, true, 0); cow(358, 197, false, 1); cow(345, 205, true, 1);
    hayRack(322, 222);
    // the pointsman by the reversing point, lantern in hand
    curF = F_PROT;
    spr(J[0] + 8, J[1] - 8, ['.k.', 'kLk', 'BBB', 'BBB', 'B.B', 'k.k'], { k: C.K1, L: C.L6, B: C.B2 });
    P(J[0] + 7, J[1] - 5, C.G0); P(J[0] + 7, J[1] - 4, C.G1);
    curF = F_PROT;
    // ravens heading for the cliffs
    const birds = [[248, 132, 0], [258, 138, 1], [241, 141, 1], [266, 129, 0]];
    for (const [x, y, f] of birds) {
      if (f) { P(x - 1, y, C.T1); P(x, y + 1, C.K1); P(x + 1, y, C.T1); P(x - 2, y - 1, C.T1); P(x + 2, y - 1, C.T1); }
      else { P(x - 2, y + 1, C.T1); P(x - 1, y, C.T1); P(x, y + 1, C.K1); P(x + 1, y, C.T1); P(x + 2, y + 1, C.T1); }
    }
    // chamois on a sunlit crag of the right rim
    spr(264, 228, ['k.k..', '.kk..', '.TTTT', '.T..T'], { k: C.K1, T: C.G6 });
    P(265, 230, C.G4);
    // alpine chalet and hay barn high on the right slope, catching the sun
    const cx = 392, cy = 206;
    rect(cx, cy - 6, 14, 7, C.G5); for (let x = cx; x < cx + 14; x += 2) vl(x, cy - 6, cy, C.G6); vl(cx, cy - 6, cy, C.G2);
    rect(cx + 3, cy - 4, 2, 2, C.G0); rect(cx + 9, cy - 4, 2, 2, C.G1);
    for (let j = 0; j < 6; j++) hl(cx - 2 + j, cx + 15 - j, cy - 7 - j, j === 0 ? C.T1 : j % 2 ? C.T3 : C.T2);
    hl(cx - 2, cx + 3, cy - 7, C.T5); P(cx + 1, cy - 8, C.T6);
    hl(cx - 1, cx + 14, cy + 1, C.T2);
    // chimney smoke from the chalet, drifting right
    [[11, -13], [11, -14], [12, -15], [13, -16], [14, -16], [15, -17], [17, -17], [18, -18], [20, -18]].forEach(([dx, dy], i) => P(cx + dx, cy + dy, i < 4 ? C.B7 : C.L4));
    // barn
    const hx = 368, hy = 218;
    rect(hx, hy - 5, 10, 6, C.G6); for (let x = hx; x < hx + 10; x += 2) vl(x, hy - 5, hy, C.G7); vl(hx, hy - 5, hy, C.G4);
    for (let j = 0; j < 4; j++) hl(hx - 1 + j, hx + 10 - j, hy - 6 - j, j % 2 ? C.T2 : C.T3);
    hl(hx - 1, hx + 2, hy - 6, C.T5);
    // fence along the meadow
    for (let x = 360; x < 420; x += 3) { P(x, 224 + ((x - 360) * 0.1 | 0), C.G6); }
    hl(360, 419, 223, C.G6);
    // a hiker on the path below the tunnel, red jacket
    spr(314, 241, ['.k.', '.L.', 'RRk', 'RR.', 'B.B'], { k: C.K1, L: C.L6, R: C.R2, B: C.B2 });
    // path zigzag
    for (let x = 300; x < 345; x++) { const y = Math.round(248 + Math.abs(((x - 300) % 30) - 15) * 0.6); if (x % 2) P(x, y, C.T5); }
    curF = F_NONE;
  }

  /* -------------------------------------------------- glows & final passes */
  function glow(x, y, r, strength, target) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const d = Math.hypot(i, j * 1.1) / r;
      if (d > 1) continue;
      veil(x + i, y + j, target, (1 - d) * strength, 3, 0.6);
    }
  }
  function cleanup() {
    // remove orphan pixels and single-pixel jaggies in organic regions only
    for (let pass = 0; pass < 2; pass++) {
      const src = buf.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const k = y * W + x;
        if (flag[k] !== F_ORG) continue;
        const c = src[k];
        const n = [src[k - 1], src[k + 1], src[k - W], src[k + W]];
        let same = 0;
        for (const v of n) if (v === c) same++;
        if (same > 0) continue;
        // majority of 4-neighbours
        const cnt = {};
        let best = n[0], bc = 0;
        for (const v of n) { cnt[v] = (cnt[v] || 0) + 1; if (cnt[v] > bc) { bc = cnt[v]; best = v; } }
        if (bc >= 3) { buf[k] = best; continue; }
        // a pixel unlike all eight neighbours is noise, not a cluster: fold it into its surroundings
        const n8 = [src[k - W - 1], src[k - W + 1], src[k + W - 1], src[k + W + 1]];
        let alone = true;
        for (const v of n8) if (v === c) alone = false;
        if (!alone) continue;
        const all = n.concat(n8), cnt8 = {};
        let b8 = all[0], c8 = 0;
        for (const v of all) { cnt8[v] = (cnt8[v] || 0) + 1; if (cnt8[v] > c8) { c8 = cnt8[v]; b8 = v; } }
        if (c8 >= 3) buf[k] = b8;
      }
    }
  }

  function render(seed) {
    buf = new Uint8Array(W * H); flag = new Uint8Array(W * H);
    R = mulberry32(seed >>> 0);
    sky();
    snowRange();
    midRanges();
    gorge();
    waterfall();
    masses();
    tracks();
    upperBridge();
    depths();
    lowerMist();
    viaduct();
    mistSea();
    extras();
    station();
    trainAndSteam();
    foreground();
    cleanup();
    // lamp glows (after cleanup so the dither halo stays)
    glow(VX1 + 8, DECK - 28, 7, 0.9, C.G1);
    glow(J[0] - 9, J[1] - 7, 4, 0.6, C.G2);
    glow(J[0] + 7, J[1] - 5, 3, 0.5, C.G1);
    return {
      W, H, buf, pal: RGB, names: PAL.map((p) => p[0]),
      toRGBA() {
        const o = new Uint8ClampedArray(W * H * 4);
        for (let i = 0; i < W * H; i++) { const c = RGB[buf[i]]; o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }
        return o;
      },
      stats() { const s = new Set(buf); return s.size; },
    };
  }
  window.ART = { render, W, H };
})();
