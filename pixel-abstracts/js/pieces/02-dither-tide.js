/* Dither Tide — Small Infinities, piece 2.
 *
 * A moonlit sea drawn in two colours at a time. Every tone in the picture is made by dithering, and the
 * dithering is the subject: the sea is laid out in bands of different dither vocabularies (checkerboard
 * haze on the horizon, engraved dash lines, Bayer 4×4 and 8×8, halftone dots on the water plane, blue-noise
 * foam on the crests) whose borders ride the swells and breathe with the tide, so one pattern hands over to
 * the next like foam on a wave. Two raindrops on the moon path spread ring screens that overlap into moiré.
 * Every frame is a pure function of t on a 216 × 270 grid, shown at 5×. The ink and paper pair changes three
 * times per loop, each time in a dithered sweep, never a fade, and is back on the first pair at t = D.
 */
(function () {
  'use strict';

  /* ================================================================ constants */
  const W = 216, H = 270, N = W * H, D = 18;
  const YH = 112, HS = H - YH, CX = 108;           // horizon row, sea height, vanishing column
  const MX = 108, MY = 60, MR = 31;                // the moon
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fr = (v) => v - fl(v);
  const tri = (v) => { const f = v - fl(v); return f < 0.5 ? 2 * f : 2 - 2 * f; }; // 0 at line centre... 1 between
  const io = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ================================================================ palettes: one ink, one paper */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PAIRS = [
    [hex('#0d0b1a'), hex('#f2e6c9')],   // indigo night on warm paper
    [hex('#14386a'), hex('#eef0ea')],   // cyanotype: prussian on white
    [hex('#2a0e12'), hex('#f0d5aa')],   // oxblood on apricot
  ];
  // sweeps: [start, duration, from, to, kind]  kind 0: tide rising, 1: night falling, 2: out from the moon
  const SWEEPS = [
    [4.6, 2.4, 0, 1, 0],
    [10.6, 2.4, 1, 2, 1],
    [15.4, 2.4, 2, 0, 2],
  ];

  /* ================================================================ threshold maps */
  function bayer(n) {
    let m = [0];
    for (let s = 1; s < n; s *= 2) {
      const nm = new Array(4 * s * s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const v = 4 * m[y * s + x];
        nm[y * 2 * s + x] = v;
        nm[y * 2 * s + x + s] = v + 2;
        nm[(y + s) * 2 * s + x] = v + 3;
        nm[(y + s) * 2 * s + x + s] = v + 1;
      }
      m = nm;
    }
    return Float32Array.from(m, (v) => (v + 0.5) / (n * n));
  }
  const B2 = bayer(2), B4 = bayer(4), B8 = bayer(8);

  // void-and-cluster blue noise, 64 × 64, seeded
  const BS = 64, BM = BS - 1;
  let BN = null;
  function buildBlueNoise(seed) {
    const n = BS * BS, rnd = mulberry32(seed * 2654435761 + 12345);
    const sig = 1.6, K = new Float32Array(n);
    for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) {
      const dx = Math.min(x, BS - x), dy = Math.min(y, BS - y);
      K[y * BS + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
    }
    const E = new Float32Array(n), P = new Uint8Array(n);
    const add = (p, s) => {
      const px = p & BM, py = p >> 6;
      for (let y = 0; y < BS; y++) {
        const ky = ((y - py) & BM) * BS, ry = y * BS;
        for (let x = 0; x < BS; x++) E[ry + x] += s * K[ky + ((x - px) & BM)];
      }
    };
    const tight = (arr, en) => { let b = -1, bv = -1e9; for (let i = 0; i < n; i++) if (arr[i] && en[i] > bv) { bv = en[i]; b = i; } return b; };
    const voidp = (arr, en) => { let b = -1, bv = 1e9; for (let i = 0; i < n; i++) if (!arr[i] && en[i] < bv) { bv = en[i]; b = i; } return b; };
    const ones = fl(n * 0.1);
    let c = 0;
    while (c < ones) { const p = fl(rnd() * n); if (!P[p]) { P[p] = 1; add(p, 1); c++; } }
    for (let it = 0; it < 4000; it++) {
      const a = tight(P, E); P[a] = 0; add(a, -1);
      const b = voidp(P, E);
      if (a === b) { P[a] = 1; add(a, 1); break; }
      P[b] = 1; add(b, 1);
    }
    const R = new Int32Array(n);
    const P2 = P.slice(), E2 = E.slice();
    // phase 1: rank the initial points by removing tightest clusters
    {
      const Ps = P.slice(), Es = E.slice();
      const addS = (p, s) => {
        const px = p & BM, py = p >> 6;
        for (let y = 0; y < BS; y++) {
          const ky = ((y - py) & BM) * BS, ry = y * BS;
          for (let x = 0; x < BS; x++) Es[ry + x] += s * K[ky + ((x - px) & BM)];
        }
      };
      for (let r = ones - 1; r >= 0; r--) { const a = tight(Ps, Es); Ps[a] = 0; addS(a, -1); R[a] = r; }
    }
    // phase 2 and 3: fill the largest voids
    P.set(P2); E.set(E2);
    for (let r = ones; r < n; r++) { const b = voidp(P, E); P[b] = 1; add(b, 1); R[b] = r; }
    BN = new Float32Array(n);
    for (let i = 0; i < n; i++) BN[i] = (R[i] + 0.5) / n;
  }
  const bn = (x, y) => BN[((y & BM) << 6) | (x & BM)];

  /* ================================================================ the sea */
  // swells in the sea plane, in log-perspective coordinates (X across, L = ln u toward the viewer)
  // [kx, kl, amplitude, cycles per loop]
  const SW = [
    [1.60, 17, 0.42, 3],
    [-2.40, 12, 0.30, 2],
    [2.10, 25, 0.16, 5],
    [0.20, 7.5, 0.38, 1],
  ];
  const SWA = SW.reduce((s, w) => s + w[2], 0);
  const SWK = SW.reduce((s, w) => s + w[2] * w[1], 0);

  // dither vocabularies
  const V_B2 = 0, V_B4 = 1, V_DASH2 = 2, V_BN = 3, V_DASH3 = 4, V_B8 = 5, V_DOT = 6;
  const EDGES = [-9, 0.05, 0.13, 0.24, 0.39, 0.58, 9];
  const VOCAB = [V_B2, V_DASH2, V_B4, V_DASH3, V_B8, V_DOT];

  // per-row tables
  const RU = new Float32Array(H), RL = new Float32Array(H), RX = new Float32Array(H);
  const RW = new Float32Array(H * (SW.length + 1));
  function buildRows() {
    for (let y = YH; y < H; y++) {
      const u = (y - YH + 0.6) / HS;
      RU[y] = u; RL[y] = Math.log(u); RX[y] = 1 / (u * HS);
      for (let k = 0; k <= SW.length; k++) {
        const kl = k < SW.length ? SW[k][1] : 50, kx = k < SW.length ? SW[k][0] : 20;
        const f = Math.max(Math.abs(kl), Math.abs(kx)) * RX[y];   // radians per pixel
        RW[y * (SW.length + 1) + k] = sstep(1.25, 0.55, f);
      }
    }
  }

  /* ================================================================ frame */
  const OUT = new Uint8Array(N);   // 0 ink, 1 paper
  const PAIR = new Uint8Array(N);  // palette pair per pixel
  let SWK_ON = null;               // active sweep or null
  let SW_P = 0, BASEP = 0;

  function sweepState(t) {
    BASEP = 0; SWK_ON = null;
    for (const s of SWEEPS) {
      if (t >= s[0] + s[1]) BASEP = s[3];
      else if (t >= s[0]) { BASEP = s[2]; SWK_ON = s; SW_P = io((t - s[0]) / s[1]); }
    }
  }
  function pairAt(x, y, h) {
    const s = SWK_ON;
    if (!s) return BASEP;
    let v;
    if (s[4] === 0) v = (H - y) / H + (y >= YH ? 0.035 * h : 0.012 * Math.sin(x * 0.07 + y * 0.02));
    else if (s[4] === 1) v = y / H - (y >= YH ? 0.035 * h : 0.0);
    else { const dx = x - MX, dy = (y - MY) * (y >= YH ? 2.2 : 1); v = Math.sqrt(dx * dx + dy * dy) / 260 + (y >= YH ? 0.02 * h : 0); }
    const p = -0.1 + 1.2 * SW_P;
    return v + 0.11 * (bn(x + 29, y + 7) - 0.5) < p ? s[3] : s[2];
  }

  function drawFrame(t) {
    t = ((t % D) + D) % D;
    sweepState(t);
    const ph = t / D;
    drawSky(t, ph);
    drawSea(t, ph);
  }

  /* ---------------------------------------------------------------- static tables */
  const SK_TONE = new Float32Array(YH * W), SK_TH = new Float32Array(YH * W), SK_G = new Float32Array(YH * W);
  const SK_KIND = new Uint8Array(YH * W);          // 0 sky, 1 moon, 2 halo rings, 3 horizon line
  const SE_X = new Float32Array(N), SE_COL = new Float32Array(N), SE_BASE = new Float32Array(H);
  function buildTables() {
    for (let y = 0; y < YH; y++) {
      const vy = y / YH;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const dx = x - MX, dy = y - MY, r = Math.sqrt(dx * dx + dy * dy);
        let tone = 0.028 + 0.09 * vy * vy * vy, kind = 0;
        // the sky: blue-noise stars overhead hand over to a Bayer 8×8 dusk near the sea
        let th = bn(x + 31, y + 3) > sstep(0.45, 0.95, vy) ? bn(x, y) : B8[((y & 7) << 3) | (x & 7)];
        if (r < MR) {
          // the moon: paper with faint seas, Bayer 8×8
          const m = 0.5 + 0.5 * Math.sin(dx * 0.19 + dy * 0.11 + 1.3) * Math.sin(dx * 0.09 - dy * 0.21 + 0.4)
            + 0.25 * Math.sin(dx * 0.37 + 2) * Math.sin(dy * 0.33);
          tone = 0.97 - 0.22 * sstep(0.55, 1.1, m) - 0.25 * sstep(0.80, 1.0, r / MR);
          th = B8[((y & 7) << 3) | (x & 7)];
          kind = 1;
        } else {
          const g = r - MR;
          const glow = 0.44 * Math.exp(-g / 9);
          tone += glow; SK_G[i] = glow;
          // halo rings breathing outward; hand over to the sky further out
          if (sstep(20, 8, g) > bn(x + 17, y + 41)) { kind = 2; th = g / 3.0; }
        }
        if (y === YH - 1) { tone = 0.12 + 0.86 * Math.exp(-Math.pow((x - MX) / 64, 2)); th = B8[x & 7] * 0.5 + 0.25; kind = 3; }
        SK_TONE[i] = tone; SK_TH[i] = th; SK_KIND[i] = kind;
      }
    }
    for (let y = YH; y < H; y++) {
      const u = RU[y];
      SE_BASE[y] = 0.11 + 0.40 * Math.exp(-u * 12);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        SE_X[i] = (x + 0.5 - CX) * RX[y];
        const cdx = (x + 0.5 - CX) / (3 + 40 * u);
        SE_COL[i] = Math.exp(-cdx * cdx) * (0.55 + 0.45 * sstep(0, 0.3, u));
      }
    }
  }

  /* ---------------------------------------------------------------- sky */
  const CL = new Float32Array(W * 6);
  function drawSky(t, ph) {
    // clouds: two long streaks drifting slowly, drawn as dash lines
    for (let x = 0; x < W; x++) {
      const o = x * 6;
      CL[o] = 73 + 3 * Math.sin(x * 0.021 + TAU * ph + 1);
      CL[o + 1] = 1 / (2.2 + 1.6 * Math.sin(x * 0.043 - TAU * ph));
      CL[o + 2] = sstep(-0.3, 0.6, Math.sin(x * 0.028 + TAU * ph));
      CL[o + 3] = 84 + 2 * Math.sin(x * 0.03 - TAU * 2 * ph);
      CL[o + 4] = 1 / (1.6 + 1.1 * Math.sin(x * 0.06 + TAU * ph + 2));
      CL[o + 5] = sstep(-0.2, 0.7, Math.sin(x * 0.037 - TAU * ph + 1.3));
    }
    const sweeping = !!SWK_ON;
    for (let y = 0; y < YH; y++) {
      const cloudRow = y > 60 && y < 96;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, kind = SK_KIND[i];
        let tone = SK_TONE[i], th = SK_TH[i];
        if (kind === 2) {
          // thin pixel circles, three pixels apart, breathing outward; they break into dots as the glow fades
          const dd = Math.abs(fr(th - ph * 3) - 0.5) * 3;
          th = dd < 0.5 ? 0.6 * B4[((y & 3) << 2) | (x & 3)] : 1;
        }
        if (cloudRow && kind !== 3) {
          const o = x * 6;
          let cw = 0;
          if (CL[o + 2] > 0) { const z = (y - CL[o]) * CL[o + 1]; cw += CL[o + 2] * Math.exp(-z * z); }
          if (CL[o + 5] > 0) { const z = (y - CL[o + 3]) * CL[o + 4]; cw += CL[o + 5] * Math.exp(-z * z); }
          if (kind === 1) { if (cw > 0.25) { tone -= 0.8 * cw; th = (y & 1) ? 0.2 : 0.7; } }
          else if (cw > 0.3) { tone = 0.06 + 0.42 * cw * (0.35 + SK_G[i] * 2.2); th = dashTh(x, y, 2, RANK2, 13, 0, ph, 5); }
        }
        OUT[i] = tone > th ? 1 : 0;
        PAIR[i] = sweeping ? pairAt(x, y, 0) : BASEP;
      }
    }
  }

  /* ---------------------------------------------------------------- sea */
  // engraved dash lines: rows of moonlit dashes; the rows ride the swells, dashes drift sideways
  const RANK2 = [0, 1], RANK3 = [0, 2, 1];
  function dashTh(x, y, p, rank, dp, lift, ph, k) {
    const yy = y + lift;
    const li = fl(yy / p), r = yy - li * p;
    const dir = (li & 1) ? 1 : -1;
    const off = ih(li, k, 11) * dp + dir * ph * dp * 2;
    return (rank[r] + tri((x + off) / dp)) / p;
  }
  // two raindrops on the moon path; their ring screens overlap into moiré
  const DROPS = [
    { x: -0.30, l: Math.log(0.43), t0: 0.6 },
    { x: 0.34, l: Math.log(0.36), t0: 3.4 },
  ];
  const RING_F = 17, RING_V = 0.075;   // rings per world unit; world units per second
  const DR = DROPS.map(() => ({ on: false, front: 0, life: 0 }));
  const DOT_S = 1 / 0.085, DOT_U = new Float32Array(160);
  const SC = new Float64Array(SW.length * 4);

  function drawSea(t, ph) {
    const nW = SW.length + 1;
    const tide = Math.sin(TAU * ph);
    const sweeping = !!SWK_ON;
    let anyDrop = false;
    for (let d = 0; d < DROPS.length; d++) {
      let age = t - DROPS[d].t0; if (age < 0) age += D;
      const R = DR[d];
      R.front = age * RING_V; R.life = sstep(13.5, 9, age) * sstep(0, 0.6, age);
      R.on = R.life > 0; anyDrop = anyDrop || R.on;
    }
    for (let k = 0; k < 160; k++) DOT_U[k] = Math.exp((k - 150 + ph * 2) / DOT_S) * HS / DOT_S;
    const sprayY = fl(t * 12), sprayX = fl(t * 4);
    for (let y = YH; y < H; y++) {
      const u = RU[y], L = RL[y], sx = RX[y];
      const wo = y * nW;
      const bscale = 0.012 + 0.13 * u;
      const liftA = 1 + 6 * u;
      const base = SE_BASE[y], crestW = sstep(0.0, 0.2, u), foamU = sstep(0.08, 0.2, u);
      // swell phasors for this row, rotated pixel by pixel
      const X0 = SE_X[y * W];
      for (let k = 0; k < SW.length; k++) {
        const s = SW[k];
        const p = s[0] * X0 + s[1] * L - TAU * s[3] * ph, d = s[0] * sx;
        SC[k * 4] = Math.cos(p); SC[k * 4 + 1] = Math.sin(p); SC[k * 4 + 2] = Math.cos(d); SC[k * 4 + 3] = Math.sin(d);
      }
      const p0row = SW[0][1] * L - TAU * SW[0][3] * ph;
      const ringRow = anyDrop && u > 0.2 && u < 0.75;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const X = SE_X[i];
        // swells
        let h = 0, sl = 0, hm = 0, ht = 0;
        for (let k = 0; k < SW.length; k++) {
          const o = k * 4, c = SC[o], sv = SC[o + 1];
          SC[o] = c * SC[o + 2] - sv * SC[o + 3]; SC[o + 1] = sv * SC[o + 2] + c * SC[o + 3];
          const w = RW[wo + k];
          if (w <= 0) continue;
          const a = w * SW[k][2];
          if (k === 0) hm = sv;
          h += a * sv;
          if (k !== 2) ht += a * sv;
          sl += a * SW[k][1] * c;
        }
        h /= SWA; sl /= SWK; ht /= SWA;
        // tone: a little haze toward the horizon, swells, the moon path
        let tone = base + 0.22 * sstep(-0.2, 0.8, ht) * crestW;
        tone += SE_COL[i] * (0.18 + 0.5 * sstep(-0.25, 0.65, sl));
        // which vocabulary: the band borders ride the swells and the tide
        const up = u + bscale * (0.75 * hm + 0.9 * h + 0.55 * tide);
        let b = 0;
        while (up >= EDGES[b + 1]) b++;
        const lo = EDGES[b], hi = EDGES[b + 1], tw = bscale * 0.3;
        const nb = bn(x + 23, y + 41);
        if (up - lo < tw && b > 0) { if (nb > 0.5 + 0.5 * (up - lo) / tw) b--; }
        else if (hi - up < tw && b < VOCAB.length - 1) { if (nb > 0.5 + 0.5 * (hi - up) / tw) b++; }
        let v = VOCAB[b];
        // crests turn to foam: blue noise
        const foam = sstep(0.42, 0.66, h) * foamU;
        if (foam > bn(x + 45, y + 9)) { v = V_BN; tone += 0.18 * foam; }
        let th;
        switch (v) {
          case V_B2: th = B2[((y & 1) << 1) | (x & 1)]; break;
          case V_B4: th = B4[((y & 3) << 2) | (x & 3)]; break;
          case V_B8: th = B8[((y & 7) << 3) | (x & 7)]; break;
          case V_BN: th = bn(x, y); break;
          case V_DASH2: th = dashTh(x, y, 2, RANK2, 9, Math.round(hm * 0.7 * liftA), ph, 1); break;
          case V_DASH3: th = dashTh(x, y, 3, RANK3, 15, Math.round(hm * 0.7 * liftA), ph, 2); break;
          case V_DOT: {
            // halftone dots on the water plane: rows recede, dots stay round, the field drifts in
            const rb = (L + 0.03 * h - ph * 2 / DOT_S) * DOT_S, ri = Math.round(rb);
            const a = (x + 0.5 - CX) / DOT_U[ri + 150], bb = rb - ri;
            th = 0.5 - 0.25 * (Math.cos(TAU * a) + Math.cos(TAU * bb));
            break;
          }
          default: th = 0.5;
        }
        // raindrop rings: line screens of their own; where two overlap, moiré
        if (ringRow) {
          const nr = bn(x + 7, y + 53);
          let r0 = 2, r1 = 2;
          for (let d = 0; d < 2; d++) {
            const R = DR[d];
            if (!R.on) continue;
            const dl = (L - DROPS[d].l) * 2.6;
            if (dl > R.front || dl < -R.front) continue;
            const dx = X - DROPS[d].x, r = Math.sqrt(dx * dx + dl * dl);
            if (r > R.front) continue;
            const w = R.life * sstep(R.front, R.front - 0.12, r) * sstep(R.front - 0.75, R.front - 0.25, r);
            if (w > nr) { const q = tri((r - R.front) * RING_F); if (d === 0) r0 = q; else r1 = q; }
          }
          if (r0 < 2 || r1 < 2) {
            if (r0 < 2 && r1 < 2) { const m = r0 < r1 ? r0 : r1; th = 1 - (1 - m) * (1 - m); }
            else th = r0 < 2 ? r0 : r1;
            tone = 0.18 + 0.5 * tone;
          }
        }
        let on = tone > th ? 1 : 0;
        // spray: just above the crests of the long swell, scattered pixels drifting up
        if (u > 0.14 && !on) {
          let dl = (1.5707963 - (p0row + SW[0][0] * X)) % TAU; if (dl < 0) dl += TAU;
          const dmax = (5 + 12 * u) * SW[0][1] * sx;
          if (dl < dmax) {
            const f = 1 - dl / dmax;
            const sz = 0.3 * f * f * sstep(-0.05, 0.3, h - hm * SW[0][2] / SWA) * sstep(0.14, 0.26, u);
            if (ih((x + sprayX) % 72, (y + sprayY) % 216, 3) < sz) on = 1;
          }
        }
        OUT[i] = on;
        PAIR[i] = sweeping ? pairAt(x, y, h) : BASEP;
      }
    }
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < N; i++, j += 4) { const p = PAIRS[PAIR[i]][OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, g.canvas.width, g.canvas.height);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'dither-tide',
    title: 'Dither Tide',
    medium: 'Two colours at a time, 216 × 270, dithered in JavaScript · 18 s loop',
    note: 'Every tone here is a pattern · tap to pause',
    about: 'A moonlit sea in two colours at a time. All of its light is made by dithering: checkerboard haze on the horizon, rows of engraved dashes, Bayer grids, blue-noise stars and foam, halftone dots in the foreground, and two raindrops whose ring screens overlap into moiré. The borders between the patterns ride the swells and breathe with the tide, so one texture hands over to the next like foam on a wave, and three times a loop the ink and the paper change in a dithered sweep, never a fade.',
    tone: 'dark',
    room: '#0d0b1a',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#0d0b1a';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,230,201,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,230,201,.85)"/></svg>';
      el.appendChild(pauseMark);
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          const K = Math.max(1, Math.round(5 * dpr)); cv.width = W * K; cv.height = H * K;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          let k = Math.max(1, Math.floor(fit));
          if (k < fit * 0.9) { k = Math.max(1, Math.ceil(fit)); cssW = W * fit / dpr; cssH = H * fit / dpr; }
          else { cssW = W * k / dpr; cssH = H * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== W * k || cv.height !== H * k) { cv.width = W * k; cv.height = H * k; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      buildBlueNoise(SEED); buildRows(); buildTables();
      built = true;
      const render = (t) => { drawFrame(t); present(g); };
      render(0);
      if (EXPORT) {
        const mo = new MutationObserver(() => { if (!built && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__dithertide = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); render(t); window.__dithertide.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'dither-tide';
        api.ready();
      } else {
        window.__dithertide = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; render(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        render(clock);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); render(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__dithertide) delete window.__dithertide;
        },
      };
    },
  });
})();
